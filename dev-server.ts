/**
 * Bun-native dev server that mirrors Cloudflare Pages Functions API.
 * Used for local development only — production uses CF Pages Functions directly.
 *
 * Usage: bun run dev-server.ts
 */
import { Database } from "bun:sqlite";
import { readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const PORT = 8788;
const DB_DIR = join(import.meta.dir, ".wrangler", "state", "dev-db");
const DB_PATH = join(DB_DIR, "pastebin.sqlite");
const SCHEMA_PATH = join(import.meta.dir, "schema.sql");
const AUTH_KEY = process.env.AUTH_KEY ?? (() => {
  // Try .env first, then .dev.vars (wrangler compat)
  for (const file of [".env", ".dev.vars"]) {
    try {
      const vars = readFileSync(join(import.meta.dir, file), "utf-8");
      const match = vars.match(/^AUTH_KEY=(.+)$/m);
      if (match) return match[1].trim();
    } catch { /* ignore */ }
  }
  console.warn("⚠  AUTH_KEY not found in .env or .dev.vars — using 'dev123'");
  return "dev123";
})();

// ---------------------------------------------------------------------------
// Database setup
// ---------------------------------------------------------------------------
if (!existsSync(DB_DIR)) mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

// Apply schema
const schema = readFileSync(SCHEMA_PATH, "utf-8");
db.exec(schema);

// ---------------------------------------------------------------------------
// Auth helpers  (mirrors functions/lib/auth.ts exactly)
// ---------------------------------------------------------------------------
const COOKIE_NAME = "pastebin_auth";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function createToken(key: string): string {
  return btoa(`pastebin:${key}`);
}

function parseCookies(header: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  header.split(";").forEach((c) => {
    const [name, ...rest] = c.trim().split("=");
    if (name) cookies[name.trim()] = rest.join("=").trim();
  });
  return cookies;
}

function isAuthenticated(req: Request): boolean {
  const cookie = parseCookies(req.headers.get("Cookie") || "");
  const token = cookie[COOKIE_NAME];
  return !!token && token === createToken(AUTH_KEY);
}

function authCookie(): string {
  return `${COOKIE_NAME}=${createToken(AUTH_KEY)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
}

function clearCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

// ---------------------------------------------------------------------------
// Slug generator  (mirrors functions/lib/slugs.ts)
// ---------------------------------------------------------------------------
const adjectives = [
  "autumn", "hidden", "bitter", "misty", "silent", "empty", "dry", "dark", "summer",
  "icy", "quiet", "white", "cool", "spring", "winter", "crimson", "broken", "bold",
  "polished", "purple", "frosty", "wild", "black", "young", "holy", "solitary",
  "fragrant", "aged", "snowy", "proud", "floral", "green", "golden", "rapid", "calm",
  "damp", "morning", "rough", "still", "small", "sparkling", "wandering", "ancient",
  "twilight", "long", "lingering", "bold", "little", "celestial", "weathered", "blue",
  "lively", "restless", "cold", "sleepy", "shrill", "falling", "patient", "gentle",
  "lucky", "orange", "shy", "muddy", "scarlet", "floating", "singing", "rustic",
  "swift", "clever", "bright", "cosmic", "velvet", "crystal", "amber", "silver",
];
const nouns = [
  "waterfall", "river", "breeze", "moon", "rain", "wind", "sea", "morning", "snow",
  "lake", "sunset", "pine", "shadow", "leaf", "dawn", "forest", "hill", "cloud",
  "meadow", "sun", "glade", "bird", "brook", "butterfly", "bush", "dew", "dust",
  "field", "fire", "flower", "firefly", "feather", "grass", "haze", "mountain",
  "night", "pond", "darkness", "snowflake", "silence", "sound", "sky", "shape",
  "surf", "thunder", "violet", "water", "wildflower", "wave", "resonance", "dream",
  "cherry", "tree", "fog", "frost", "star", "paper", "stone", "smoke", "frog",
  "glitter", "pebble", "flame", "ocean", "canyon", "harbor", "reef", "riddle",
  "echo", "orbit",
];
const verbs = [
  "drifts", "falls", "rises", "sings", "rests", "flies", "grows", "shines", "flows",
  "glows", "hums", "fades", "leaps", "swirls", "blooms", "sparks", "floats",
  "whispers", "dances", "wanders", "rolls", "turns", "bends", "reaches", "stands",
  "lingers", "dreams", "breaks", "echoes", "runs",
];
const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];
const generateSlug = () => `${pick(adjectives)}-${pick(nouns)}-${pick(verbs)}`;

// ---------------------------------------------------------------------------
// JSON helpers
// ---------------------------------------------------------------------------
function json(data: unknown, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

function handlePing() {
  return new Response("pong");
}

// POST /api/auth/login
async function handleLogin(req: Request) {
  try {
    const body = (await req.json()) as { passphrase?: string };
    if (!body.passphrase) return json({ error: "Passphrase is required" }, 400);
    if (body.passphrase !== AUTH_KEY) return json({ error: "Invalid passphrase" }, 401);
    return json({ success: true }, 200, { "Set-Cookie": authCookie() });
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
}

// GET /api/auth/login
function handleAuthCheck(req: Request) {
  return json({ authenticated: isAuthenticated(req) });
}

// POST /api/auth/logout
function handleLogout() {
  return json({ success: true }, 200, { "Set-Cookie": clearCookie() });
}

// GET /api/paste
function handleListPastes(req: Request) {
  try {
    const authenticated = isAuthenticated(req);
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);
    const offset = (page - 1) * limit;

    const whereClause = authenticated ? "" : "WHERE visibility = 'public'";

    const pastes = db
      .query(
        `SELECT id, slug, title, content, language, visibility, pinned, created_at, updated_at, substr(content, 1, 200) as preview FROM pastes ${whereClause} ORDER BY pinned DESC, created_at DESC LIMIT ? OFFSET ?`
      )
      .all(limit, offset);

    const countRow = db
      .query(`SELECT COUNT(*) as total FROM pastes ${whereClause}`)
      .get() as { total: number } | null;

    const total = countRow?.total ?? 0;
    return json({ pastes, total, page, limit, hasMore: offset + limit < total });
  } catch (err) {
    console.error("Failed to list pastes:", err);
    return json({ error: "Failed to load pastes" }, 500);
  }
}

// POST /api/paste
async function handleCreatePaste(req: Request) {
  if (!isAuthenticated(req)) return json({ error: "Unauthorized" }, 401);

  try {
    const body = (await req.json()) as {
      title?: string;
      content: string;
      language?: string;
      visibility?: "public" | "private";
    };

    if (!body.content || body.content.trim() === "")
      return json({ error: "Content is required" }, 400);

    let slug = generateSlug();
    let attempts = 0;
    while (attempts < 5) {
      const existing = db.query("SELECT id FROM pastes WHERE slug = ?").get(slug);
      if (!existing) break;
      slug = generateSlug();
      attempts++;
    }

    db.query(
      "INSERT INTO pastes (slug, title, content, language, visibility) VALUES (?, ?, ?, ?, ?)"
    ).run(
      slug,
      body.title || "",
      body.content,
      body.language || "plaintext",
      body.visibility || "private"
    );

    return json({ slug, success: true }, 201);
  } catch {
    return json({ error: "Invalid request" }, 400);
  }
}

// GET /api/paste/:slug
function handleGetPaste(req: Request, slug: string) {
  const paste = db.query("SELECT * FROM pastes WHERE slug = ?").get(slug);
  if (!paste) return json({ error: "Paste not found" }, 404);
  if ((paste as { visibility: string }).visibility === "private" && !isAuthenticated(req))
    return json({ error: "This paste is private" }, 403);
  return json({ paste });
}

// PUT /api/paste/:slug
async function handleUpdatePaste(req: Request, slug: string) {
  if (!isAuthenticated(req)) return json({ error: "Unauthorized" }, 401);

  try {
    const body = (await req.json()) as {
      title?: string;
      content?: string;
      language?: string;
      visibility?: "public" | "private";
      pinned?: number;
    };

    const existing = db.query("SELECT id FROM pastes WHERE slug = ?").get(slug);
    if (!existing) return json({ error: "Paste not found" }, 404);

    const updates: string[] = [];
    const values: (string | number | undefined)[] = [];

    if (body.title !== undefined) { updates.push("title = ?"); values.push(body.title); }
    if (body.content !== undefined) { updates.push("content = ?"); values.push(body.content); }
    if (body.language !== undefined) { updates.push("language = ?"); values.push(body.language); }
    if (body.visibility !== undefined) { updates.push("visibility = ?"); values.push(body.visibility); }
    if (body.pinned !== undefined) { updates.push("pinned = ?"); values.push(body.pinned); }

    if (updates.length === 0) return json({ error: "No fields to update" }, 400);

    updates.push("updated_at = datetime('now')");

    db.query(`UPDATE pastes SET ${updates.join(", ")} WHERE slug = ?`).run(...(values as any[]), slug);
    return json({ success: true });
  } catch (err) {
    console.error("Failed to update paste:", err);
    return json({ error: "Invalid request" }, 400);
  }
}

// DELETE /api/paste/:slug
function handleDeletePaste(req: Request, slug: string) {
  if (!isAuthenticated(req)) return json({ error: "Unauthorized" }, 401);

  const existing = db.query("SELECT id FROM pastes WHERE slug = ?").get(slug);
  if (!existing) return json({ error: "Paste not found" }, 404);

  db.query("DELETE FROM pastes WHERE slug = ?").run(slug);
  return json({ success: true });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
function addCors(res: Response): Response {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type");
  res.headers.set("Access-Control-Allow-Credentials", "true");
  return res;
}

async function router(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // CORS preflight
  if (method === "OPTIONS") return addCors(new Response(null, { status: 204 }));

  let res: Response;

  // /api/ping
  if (path === "/api/ping") {
    res = handlePing();

    // /api/auth/login
  } else if (path === "/api/auth/login") {
    res = method === "POST" ? await handleLogin(req) : handleAuthCheck(req);

    // /api/auth/logout
  } else if (path === "/api/auth/logout" && method === "POST") {
    res = handleLogout();

    // /api/paste  (list / create)
  } else if (path === "/api/paste" || path === "/api/paste/") {
    res = method === "POST" ? await handleCreatePaste(req) : handleListPastes(req);

    // /api/paste/:slug
  } else if (path.startsWith("/api/paste/")) {
    const slug = path.replace("/api/paste/", "").replace(/\/$/, "");
    if (!slug) {
      res = json({ error: "Missing slug" }, 400);
    } else if (method === "GET") {
      res = handleGetPaste(req, slug);
    } else if (method === "PUT") {
      res = await handleUpdatePaste(req, slug);
    } else if (method === "DELETE") {
      res = handleDeletePaste(req, slug);
    } else {
      res = json({ error: "Method not allowed" }, 405);
    }

  } else {
    res = json({ error: "Not found" }, 404);
  }

  return addCors(res);
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
console.log(`
  Pastebin Dev API Server
  -----------------------
  http://localhost:${PORT}
  DB: ${DB_PATH}
  AUTH_KEY loaded from .env / .dev.vars
`);

Bun.serve({
  port: PORT,
  fetch: router,
});
