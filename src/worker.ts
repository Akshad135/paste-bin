/// <reference types="@cloudflare/workers-types" />

/**
 * Cloudflare Worker entry point.
 * Handles /api/* routes and falls through to static assets for everything else.
 * Production only — local dev uses dev-server.ts + Vite proxy.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Env {
    DB: D1Database;
    AUTH_KEY: string;
    ASSETS: { fetch: (request: Request) => Promise<Response> };
}

// ---------------------------------------------------------------------------
// Auth helpers (mirrors functions/lib/auth.ts)
// ---------------------------------------------------------------------------
const COOKIE_NAME = 'pastebin_auth';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function createToken(key: string): string {
    return btoa(`pastebin:${key}`);
}

function parseCookies(header: string): Record<string, string> {
    const cookies: Record<string, string> = {};
    header.split(';').forEach((c) => {
        const [name, ...rest] = c.trim().split('=');
        if (name) cookies[name.trim()] = rest.join('=').trim();
    });
    return cookies;
}

function isAuthenticated(request: Request, env: Env): boolean {
    const cookie = parseCookies(request.headers.get('Cookie') || '');
    const token = cookie[COOKIE_NAME];
    return !!token && token === createToken(env.AUTH_KEY);
}

function createAuthCookie(authKey: string): string {
    const token = createToken(authKey);
    return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
}

function clearAuthCookie(): string {
    return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

// ---------------------------------------------------------------------------
// Slug generator (mirrors functions/lib/slugs.ts)
// ---------------------------------------------------------------------------
const adjectives = [
    'autumn', 'hidden', 'bitter', 'misty', 'silent', 'empty', 'dry', 'dark',
    'summer', 'icy', 'quiet', 'white', 'cool', 'spring', 'winter', 'crimson',
    'broken', 'bold', 'polished', 'purple', 'frosty', 'wild', 'black', 'young',
    'holy', 'solitary', 'fragrant', 'aged', 'snowy', 'proud', 'floral', 'green',
    'golden', 'rapid', 'calm', 'damp', 'morning', 'rough', 'still', 'small',
    'sparkling', 'wandering', 'ancient', 'twilight', 'long', 'lingering', 'bold',
    'little', 'celestial', 'weathered', 'blue', 'lively', 'restless', 'cold',
    'sleepy', 'shrill', 'falling', 'patient', 'gentle', 'lucky', 'orange',
    'shy', 'muddy', 'scarlet', 'floating', 'singing', 'rustic', 'swift',
    'clever', 'bright', 'cosmic', 'velvet', 'crystal', 'amber', 'silver',
];

const nouns = [
    'waterfall', 'river', 'breeze', 'moon', 'rain', 'wind', 'sea', 'morning',
    'snow', 'lake', 'sunset', 'pine', 'shadow', 'leaf', 'dawn', 'forest',
    'hill', 'cloud', 'meadow', 'sun', 'glade', 'bird', 'brook', 'butterfly',
    'bush', 'dew', 'dust', 'field', 'fire', 'flower', 'firefly', 'feather',
    'grass', 'haze', 'mountain', 'night', 'pond', 'darkness', 'snowflake',
    'silence', 'sound', 'sky', 'shape', 'surf', 'thunder', 'violet', 'water',
    'wildflower', 'wave', 'resonance', 'dream', 'cherry', 'tree', 'fog',
    'frost', 'star', 'paper', 'stone', 'smoke', 'frog', 'glitter', 'pebble',
    'flame', 'ocean', 'canyon', 'harbor', 'reef', 'riddle', 'echo', 'orbit',
];

const verbs = [
    'drifts', 'falls', 'rises', 'sings', 'rests', 'flies', 'grows', 'shines',
    'flows', 'glows', 'hums', 'fades', 'leaps', 'swirls', 'blooms', 'sparks',
    'floats', 'whispers', 'dances', 'wanders', 'rolls', 'turns', 'bends',
    'reaches', 'stands', 'lingers', 'dreams', 'breaks', 'echoes', 'runs',
];

const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
const generateSlug = () => `${pick(adjectives)}-${pick(nouns)}-${pick(verbs)}`;

// ---------------------------------------------------------------------------
// Expiration helpers
// ---------------------------------------------------------------------------
const EXPIRES_IN_MAP: Record<string, number> = {
    '10m': 10 * 60,
    '45m': 45 * 60,
    '2h': 2 * 60 * 60,
    '1d': 24 * 60 * 60,
    '1w': 7 * 24 * 60 * 60,
};

function computeExpiresAt(expiresIn?: string): string | null {
    if (!expiresIn || expiresIn === 'never') return null;
    const seconds = EXPIRES_IN_MAP[expiresIn];
    if (!seconds) return null;
    const d = new Date(Date.now() + seconds * 1000);
    return d.toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
}

const NOT_EXPIRED_CLAUSE = "(expires_at IS NULL OR expires_at > datetime('now'))";

// ---------------------------------------------------------------------------
// JSON helper
// ---------------------------------------------------------------------------
function json(data: unknown, status = 200, headers?: Record<string, string>) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...headers },
    });
}

// ---------------------------------------------------------------------------
// API route handlers
// ---------------------------------------------------------------------------

// GET /api/ping
function handlePing() {
    return new Response('pong');
}

// POST /api/auth/login
async function handleLogin(request: Request, env: Env) {
    try {
        const body = (await request.json()) as { passphrase?: string };
        if (!body.passphrase) return json({ error: 'Passphrase is required' }, 400);
        if (body.passphrase !== env.AUTH_KEY) return json({ error: 'Invalid passphrase' }, 401);
        return json({ success: true }, 200, { 'Set-Cookie': createAuthCookie(env.AUTH_KEY) });
    } catch {
        return json({ error: 'Invalid request' }, 400);
    }
}

// GET /api/auth/login
function handleAuthCheck(request: Request, env: Env) {
    return json({ authenticated: isAuthenticated(request, env) });
}

// POST /api/auth/logout
function handleLogout() {
    return json({ success: true }, 200, { 'Set-Cookie': clearAuthCookie() });
}

// GET /api/paste
async function handleListPastes(request: Request, env: Env, url: URL) {
    try {
        const authenticated = isAuthenticated(request, env);
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
        const offset = (page - 1) * limit;

        const conditions = [NOT_EXPIRED_CLAUSE];
        if (!authenticated) conditions.push("visibility = 'public'");
        const whereClause = `WHERE ${conditions.join(' AND ')}`;

        const query = `SELECT id, slug, title, content, language, visibility, pinned, expires_at, created_at, updated_at, substr(content, 1, 200) as preview FROM pastes ${whereClause} ORDER BY pinned DESC, created_at DESC LIMIT ? OFFSET ?`;
        const countQuery = `SELECT COUNT(*) as total FROM pastes ${whereClause}`;

        const pastes = await env.DB.prepare(query).bind(limit, offset).all();
        const countResult = await env.DB.prepare(countQuery).first<{ total: number }>();

        return json({
            pastes: pastes.results,
            total: countResult?.total || 0,
            page,
            limit,
            hasMore: offset + limit < (countResult?.total || 0),
        });
    } catch (err) {
        console.warn('[worker] Failed to list pastes:', err instanceof Error ? err.message : err);
        return json({ error: 'Failed to load pastes' }, 500);
    }
}

// POST /api/paste
async function handleCreatePaste(request: Request, env: Env) {
    if (!isAuthenticated(request, env)) return json({ error: 'Unauthorized' }, 401);

    try {
        const body = (await request.json()) as {
            title?: string;
            content: string;
            language?: string;
            visibility?: 'public' | 'private';
            expires_in?: string;
        };

        if (!body.content || body.content.trim() === '') {
            return json({ error: 'Content is required' }, 400);
        }

        let slug = generateSlug();
        let attempts = 0;
        while (attempts < 5) {
            const existing = await env.DB.prepare('SELECT id FROM pastes WHERE slug = ?').bind(slug).first();
            if (!existing) break;
            slug = generateSlug();
            attempts++;
        }

        const expiresAt = computeExpiresAt(body.expires_in);

        const result = await env.DB.prepare(
            'INSERT INTO pastes (slug, title, content, language, visibility, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
        )
            .bind(slug, body.title || '', body.content, body.language || 'plaintext', body.visibility || 'private', expiresAt)
            .run();

        if (!result.success) return json({ error: 'Failed to create paste' }, 500);
        return json({ slug, success: true }, 201);
    } catch {
        return json({ error: 'Invalid request' }, 400);
    }
}

// GET /api/paste/:slug
async function handleGetPaste(request: Request, env: Env, slug: string) {
    const paste = await env.DB.prepare('SELECT * FROM pastes WHERE slug = ?').bind(slug).first();
    if (!paste) return json({ error: 'Paste not found' }, 404);
    // Check expiration
    if (paste.expires_at && new Date(paste.expires_at as string + 'Z') <= new Date()) {
        return json({ error: 'This paste has expired' }, 410);
    }
    if (paste.visibility === 'private' && !isAuthenticated(request, env)) {
        return json({ error: 'This paste is private' }, 403);
    }
    return json({ paste });
}

// PUT /api/paste/:slug
async function handleUpdatePaste(request: Request, env: Env, slug: string) {
    if (!isAuthenticated(request, env)) return json({ error: 'Unauthorized' }, 401);

    try {
        const body = (await request.json()) as {
            title?: string;
            content?: string;
            language?: string;
            visibility?: 'public' | 'private';
            pinned?: number;
            expires_in?: string;
        };

        const existing = await env.DB.prepare('SELECT id FROM pastes WHERE slug = ?').bind(slug).first();
        if (!existing) return json({ error: 'Paste not found' }, 404);

        const updates: string[] = [];
        const values: (string | number | null)[] = [];

        if (body.title !== undefined) { updates.push('title = ?'); values.push(body.title); }
        if (body.content !== undefined) { updates.push('content = ?'); values.push(body.content); }
        if (body.language !== undefined) { updates.push('language = ?'); values.push(body.language); }
        if (body.visibility !== undefined) { updates.push('visibility = ?'); values.push(body.visibility); }
        if (body.pinned !== undefined) { updates.push('pinned = ?'); values.push(body.pinned); }
        if (body.expires_in !== undefined) { updates.push('expires_at = ?'); values.push(computeExpiresAt(body.expires_in)); }

        if (updates.length === 0) return json({ error: 'No fields to update' }, 400);

        updates.push("updated_at = datetime('now')");

        const result = await env.DB.prepare(
            `UPDATE pastes SET ${updates.join(', ')} WHERE slug = ?`
        )
            .bind(...values, slug)
            .run();

        if (!result.success) return json({ error: 'Failed to update paste' }, 500);
        return json({ success: true });
    } catch {
        return json({ error: 'Invalid request' }, 400);
    }
}

// DELETE /api/paste/:slug
async function handleDeletePaste(request: Request, env: Env, slug: string) {
    if (!isAuthenticated(request, env)) return json({ error: 'Unauthorized' }, 401);

    const existing = await env.DB.prepare('SELECT id FROM pastes WHERE slug = ?').bind(slug).first();
    if (!existing) return json({ error: 'Paste not found' }, 404);

    const result = await env.DB.prepare('DELETE FROM pastes WHERE slug = ?').bind(slug).run();
    if (!result.success) return json({ error: 'Failed to delete paste' }, 500);
    return json({ success: true });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
    const path = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Credentials': 'true',
            },
        });
    }

    let res: Response;

    if (path === '/api/ping') {
        res = handlePing();
    } else if (path === '/api/auth/login') {
        res = method === 'POST' ? await handleLogin(request, env) : handleAuthCheck(request, env);
    } else if (path === '/api/auth/logout' && method === 'POST') {
        res = handleLogout();
    } else if (path === '/api/paste' || path === '/api/paste/') {
        res = method === 'POST' ? await handleCreatePaste(request, env) : await handleListPastes(request, env, url);
    } else if (path.startsWith('/api/paste/')) {
        const slug = path.replace('/api/paste/', '').replace(/\/$/, '');
        if (!slug) {
            res = json({ error: 'Missing slug' }, 400);
        } else if (method === 'GET') {
            res = await handleGetPaste(request, env, slug);
        } else if (method === 'PUT') {
            res = await handleUpdatePaste(request, env, slug);
        } else if (method === 'DELETE') {
            res = await handleDeletePaste(request, env, slug);
        } else {
            res = json({ error: 'Method not allowed' }, 405);
        }
    } else {
        res = json({ error: 'Not found' }, 404);
    }

    // Add CORS headers
    res.headers.set('Access-Control-Allow-Origin', '*');
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    return res;
}

// ---------------------------------------------------------------------------
// Worker export
// ---------------------------------------------------------------------------
export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        // Route API requests
        if (url.pathname.startsWith('/api/')) {
            return handleApi(request, env, url);
        }

        // Everything else → static assets (SPA)
        return env.ASSETS.fetch(request);
    },
};
