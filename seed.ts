/**
 * Seed script — populates the local dev database with 12 sample pastes.
 * Usage: bun run seed.ts
 */

const API = "http://localhost:8788";
const AUTH_KEY = "test123";

// Login first
const loginRes = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passphrase: AUTH_KEY }),
});
const cookies = loginRes.headers.getSetCookie?.() ?? [loginRes.headers.get("set-cookie") ?? ""];
const cookie = cookies.join("; ");
console.log("Logged in:", (await loginRes.json()).success ? "✅" : "❌");

const pastes = [
    // 1. Pinned + Public — Python
    {
        title: "FastAPI Server Setup",
        language: "python",
        visibility: "public",
        pinned: true,
        content: `from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import uvicorn

app = FastAPI(title="Notes API", version="1.0.0")

class Note(BaseModel):
    title: str
    content: str
    tags: Optional[list[str]] = None

notes_db: dict[int, Note] = {}
counter = 0

@app.post("/notes", status_code=201)
async def create_note(note: Note):
    global counter
    counter += 1
    notes_db[counter] = note
    return {"id": counter, **note.model_dump()}

@app.get("/notes/{note_id}")
async def get_note(note_id: int):
    if note_id not in notes_db:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"id": note_id, **notes_db[note_id].model_dump()}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)`,
    },

    // 2. Pinned + Private — TypeScript
    {
        title: "React Custom Hook — useDebounce",
        language: "typescript",
        visibility: "private",
        pinned: true,
        content: `import { useState, useEffect } from 'react';

/**
 * Debounces a value by the specified delay.
 * Useful for search inputs, API calls, etc.
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// Usage example:
// const [search, setSearch] = useState('');
// const debouncedSearch = useDebounce(search, 500);
//
// useEffect(() => {
//   fetchResults(debouncedSearch);
// }, [debouncedSearch]);`,
    },

    // 3. Pinned + Public — Bash
    {
        title: "Docker Compose Cheatsheet",
        language: "bash",
        visibility: "public",
        pinned: true,
        content: `#!/bin/bash
# Docker Compose Cheatsheet — common commands

# Start all services in detached mode
docker compose up -d

# Rebuild and start
docker compose up -d --build

# Stop all services
docker compose down

# Stop and remove volumes (⚠️ destructive)
docker compose down -v

# View logs (follow mode)
docker compose logs -f

# View logs for a specific service
docker compose logs -f api

# Scale a service
docker compose up -d --scale worker=3

# Execute command in running container
docker compose exec api sh

# List running services
docker compose ps

# Pull latest images
docker compose pull

# Restart a specific service
docker compose restart api`,
    },

    // 4. Not pinned + Public — JavaScript
    {
        title: "Express Middleware Stack",
        language: "javascript",
        visibility: "public",
        pinned: false,
        content: `const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();

// Security headers
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, slow down.' },
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('combined'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.listen(3000, () => console.log('Server running on :3000'));`,
    },

    // 5. Not pinned + Private — CSS
    {
        title: "Glassmorphism Card Styles",
        language: "css",
        visibility: "private",
        pinned: false,
        content: `/* Glassmorphism card styles with animated gradient border */

.glass-card {
  position: relative;
  padding: 2rem;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.glass-card:hover {
  transform: translateY(-4px);
  box-shadow:
    0 16px 48px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.glass-card::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: 17px;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.15),
    rgba(255, 255, 255, 0),
    rgba(255, 255, 255, 0.08)
  );
  z-index: -1;
  animation: shimmer 3s ease-in-out infinite;
}

@keyframes shimmer {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}`,
    },

    // 6. Not pinned + Public — Rust
    {
        title: "Rust CLI Argument Parser",
        language: "rust",
        visibility: "public",
        pinned: false,
        content: `use std::env;
use std::process;

#[derive(Debug)]
struct Config {
    input: String,
    output: String,
    verbose: bool,
    threads: usize,
}

impl Config {
    fn parse(args: &[String]) -> Result<Self, String> {
        let mut input = String::new();
        let mut output = String::from("output.txt");
        let mut verbose = false;
        let mut threads: usize = 4;

        let mut i = 1;
        while i < args.len() {
            match args[i].as_str() {
                "-i" | "--input" => {
                    i += 1;
                    input = args.get(i).ok_or("Missing input value")?.clone();
                }
                "-o" | "--output" => {
                    i += 1;
                    output = args.get(i).ok_or("Missing output value")?.clone();
                }
                "-v" | "--verbose" => verbose = true,
                "-t" | "--threads" => {
                    i += 1;
                    threads = args.get(i)
                        .ok_or("Missing threads value")?
                        .parse()
                        .map_err(|_| "Invalid thread count")?;
                }
                _ => return Err(format!("Unknown argument: {}", args[i])),
            }
            i += 1;
        }

        if input.is_empty() {
            return Err("Input file is required".into());
        }

        Ok(Config { input, output, verbose, threads })
    }
}

fn main() {
    let args: Vec<String> = env::args().collect();
    let config = Config::parse(&args).unwrap_or_else(|e| {
        eprintln!("Error: {e}");
        process::exit(1);
    });

    if config.verbose {
        println!("Config: {config:#?}");
    }

    println!("Processing {} → {}", config.input, config.output);
}`,
    },

    // 7. Not pinned + Private — SQL
    {
        title: "Analytics Queries Collection",
        language: "sql",
        visibility: "private",
        pinned: false,
        content: `-- Daily active users (last 30 days)
SELECT
    DATE(created_at) AS day,
    COUNT(DISTINCT user_id) AS dau
FROM events
WHERE created_at >= DATE('now', '-30 days')
GROUP BY DATE(created_at)
ORDER BY day DESC;

-- Top 10 most viewed pages
SELECT
    page_path,
    COUNT(*) AS views,
    COUNT(DISTINCT session_id) AS unique_views,
    ROUND(AVG(time_on_page), 1) AS avg_seconds
FROM page_views
WHERE viewed_at >= DATE('now', '-7 days')
GROUP BY page_path
ORDER BY views DESC
LIMIT 10;

-- User retention cohort (week-over-week)
WITH cohort AS (
    SELECT
        user_id,
        DATE(MIN(created_at), 'weekday 0', '-6 days') AS cohort_week
    FROM users
    GROUP BY user_id
)
SELECT
    c.cohort_week,
    COUNT(DISTINCT c.user_id) AS cohort_size,
    COUNT(DISTINCT CASE
        WHEN e.created_at BETWEEN c.cohort_week AND DATE(c.cohort_week, '+6 days')
        THEN e.user_id END) AS week_0,
    COUNT(DISTINCT CASE
        WHEN e.created_at BETWEEN DATE(c.cohort_week, '+7 days') AND DATE(c.cohort_week, '+13 days')
        THEN e.user_id END) AS week_1
FROM cohort c
LEFT JOIN events e ON c.user_id = e.user_id
GROUP BY c.cohort_week
ORDER BY c.cohort_week DESC;`,
    },

    // 8. Not pinned + Public — JSON config
    {
        title: "ESLint Flat Config",
        language: "json",
        visibility: "public",
        pinned: false,
        content: `{
  "extends": ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2024,
    "sourceType": "module",
    "project": "./tsconfig.json"
  },
  "plugins": ["@typescript-eslint", "import"],
  "rules": {
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": ["error", {
      "argsIgnorePattern": "^_",
      "varsIgnorePattern": "^_"
    }],
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-explicit-any": "warn",
    "import/order": ["error", {
      "groups": ["builtin", "external", "internal", "parent", "sibling"],
      "newlines-between": "always",
      "alphabetize": { "order": "asc" }
    }],
    "prefer-const": "error",
    "no-var": "error"
  },
  "ignorePatterns": ["dist/", "node_modules/", "*.config.js"]
}`,
    },

    // 9. Not pinned + Private — Go
    {
        title: "Go HTTP Server with Middleware",
        language: "go",
        visibility: "private",
        pinned: false,
        content: `package main

import (
\t"encoding/json"
\t"log"
\t"net/http"
\t"time"
)

type Response struct {
\tMessage string \`json:"message"\`
\tTime    string \`json:"time"\`
}

// Logging middleware
func withLogging(next http.Handler) http.Handler {
\treturn http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
\t\tstart := time.Now()
\t\tnext.ServeHTTP(w, r)
\t\tlog.Printf("%s %s %v", r.Method, r.URL.Path, time.Since(start))
\t})
}

// CORS middleware
func withCORS(next http.Handler) http.Handler {
\treturn http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
\t\tw.Header().Set("Access-Control-Allow-Origin", "*")
\t\tw.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
\t\tw.Header().Set("Access-Control-Allow-Headers", "Content-Type")
\t\tif r.Method == "OPTIONS" {
\t\t\tw.WriteHeader(http.StatusNoContent)
\t\t\treturn
\t\t}
\t\tnext.ServeHTTP(w, r)
\t})
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
\tw.Header().Set("Content-Type", "application/json")
\tjson.NewEncoder(w).Encode(Response{
\t\tMessage: "ok",
\t\tTime:    time.Now().Format(time.RFC3339),
\t})
}

func main() {
\tmux := http.NewServeMux()
\tmux.HandleFunc("/health", healthHandler)

\thandler := withLogging(withCORS(mux))

\tlog.Println("Server starting on :8080")
\tlog.Fatal(http.ListenAndServe(":8080", handler))
}`,
    },

    // 10. Not pinned + Public — YAML
    {
        title: "GitHub Actions CI Pipeline",
        language: "yaml",
        visibility: "public",
        pinned: false,
        content: `name: CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

concurrency:
  group: \${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install --frozen-lockfile
      - run: bun run lint

  test:
    needs: lint
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun test
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: test-results
          path: coverage/

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun run build
      - run: bunx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: \${{ secrets.CF_API_TOKEN }}`,
    },

    // 11. Not pinned + Private — HTML
    {
        title: "Email Template — Welcome",
        language: "html",
        visibility: "private",
        pinned: false,
        content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome!</title>
</head>
<body style="margin:0; padding:0; background:#f4f4f5; font-family:'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background:#fff; border-radius:12px; overflow:hidden;
                      box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);
                       padding:40px 32px; text-align:center;">
              <h1 style="color:#fff; margin:0; font-size:28px;">Welcome aboard! 🎉</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="color:#374151; font-size:16px; line-height:1.6;">
                Hey there! Thanks for signing up. We're excited to have you.
              </p>
              <a href="#" style="display:inline-block; background:#6366f1; color:#fff;
                 padding:12px 32px; border-radius:8px; text-decoration:none;
                 font-weight:600; margin-top:16px;">
                Get Started →
              </a>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px; background:#f9fafb; text-align:center;">
              <p style="color:#9ca3af; font-size:13px; margin:0;">
                You received this because you signed up at example.com
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    },

    // 12. Not pinned + Public — Markdown
    {
        title: "Project Architecture Notes",
        language: "markdown",
        visibility: "public",
        pinned: false,
        content: `# Architecture Overview

## Stack
- **Frontend**: React 19 + Vite + TypeScript
- **Backend**: Cloudflare Workers (prod) / Bun (dev)
- **Database**: Cloudflare D1 (SQLite at the edge)
- **Auth**: Cookie-based, single passphrase

## Directory Structure
\`\`\`
src/
├── components/     # Reusable UI components
├── pages/          # Route-level page components
├── lib/            # Utilities, API client, themes
├── worker.ts       # Cloudflare Worker entry (prod)
migrations/         # D1 SQL migrations
dev-server.ts       # Bun dev API server (local only)
\`\`\`

## Data Flow
1. User hits the SPA (served from Workers \`[assets]\`)
2. SPA makes \`/api/*\` calls → Worker routes them
3. Worker reads/writes D1 via binding
4. Auth cookie set on login, checked on every mutating request

## Design Decisions
- **No accounts** — single-user, passphrase auth keeps it simple
- **Edge-first** — D1 + Workers = globally fast, zero cold starts
- **PWA** — installable, works offline for cached pastes
- **Themes** — 5 palettes × 2 modes = 10 visual options`,
    },
];

// Create all pastes
for (const paste of pastes) {
    const { pinned, ...createBody } = paste;
    const res = await fetch(`${API}/api/paste`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify(createBody),
    });
    const data = await res.json() as { slug?: string; success?: boolean };

    if (data.success && data.slug) {
        console.log(`✅ Created: "${paste.title}" → ${data.slug} (${paste.language}, ${paste.visibility})`);

        // Pin if needed
        if (pinned) {
            await fetch(`${API}/api/paste/${data.slug}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", Cookie: cookie },
                body: JSON.stringify({ pinned: 1 }),
            });
            console.log(`   📌 Pinned`);
        }
    } else {
        console.log(`❌ Failed: "${paste.title}"`, data);
    }
}

console.log("\n🎉 Done! 12 sample pastes created.");
