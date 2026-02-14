import type { Paste } from './api';

const NOW = new Date().toISOString();

export const DEMO_PASTES: Paste[] = [
    // 1. Pinned + Public — Python
    {
        id: 1,
        slug: 'misty-mountain-flows',
        title: "FastAPI Server Setup",
        language: "python",
        visibility: "public",
        pinned: 1,
        created_at: NOW,
        updated_at: NOW,
        preview: 'from fastapi import FastAPI, HTTPException\nfrom pydantic import BaseModel...',
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
        id: 2,
        slug: 'silent-river-runs',
        title: "React Custom Hook — useDebounce",
        language: "typescript",
        visibility: "private",
        pinned: 1,
        created_at: NOW,
        updated_at: NOW,
        preview: "import { useState, useEffect } from 'react';\n\n/**\n * Debounces a value...",
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
        id: 3,
        slug: 'dark-sky-shines',
        title: "Docker Compose Cheatsheet",
        language: "bash",
        visibility: "public",
        pinned: 1,
        created_at: NOW,
        updated_at: NOW,
        preview: '#!/bin/bash\n# Docker Compose Cheatsheet — common commands\n\n# Start...',
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
        id: 4,
        slug: 'golden-sun-rises',
        title: "Express Middleware Stack",
        language: "javascript",
        visibility: "public",
        pinned: 0,
        created_at: NOW,
        updated_at: NOW,
        preview: "const express = require('express');\nconst cors = require('cors');...",
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
        id: 5,
        slug: 'crystal-lake-glimmers',
        title: "Glassmorphism Card Styles",
        language: "css",
        visibility: "private",
        pinned: 0,
        created_at: NOW,
        updated_at: NOW,
        preview: '/* Glassmorphism card styles with animated gradient border */\n\n.glass-card...',
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
        id: 6,
        slug: 'rustic-forest-grows',
        title: "Rust CLI Argument Parser",
        language: "rust",
        visibility: "public",
        pinned: 0,
        created_at: NOW,
        updated_at: NOW,
        preview: 'use std::env;\nuse std::process;\n\n#[derive(Debug)]\nstruct Config...',
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
        id: 7,
        slug: 'blue-ocean-waves',
        title: "Analytics Queries Collection",
        language: "sql",
        visibility: "private",
        pinned: 0,
        created_at: NOW,
        updated_at: NOW,
        preview: '-- Daily active users (last 30 days)\nSELECT\n    DATE(created_at) AS day...',
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
        id: 8,
        slug: 'crimson-fire-burns',
        title: "ESLint Flat Config",
        language: "json",
        visibility: "public",
        pinned: 0,
        created_at: NOW,
        updated_at: NOW,
        preview: '{\n  "extends": ["eslint:recommended", "plugin:@typescript-eslint/recommended"],\n...',
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
        id: 9,
        slug: 'wild-wind-blows',
        title: "Go HTTP Server with Middleware",
        language: "go",
        visibility: "private",
        pinned: 0,
        created_at: NOW,
        updated_at: NOW,
        preview: 'package main\n\nimport (\n\t"encoding/json"\n\t"log"\n\t"net/http"...',
        content: `package main

import (
	"encoding/json"
	"log"
	"net/http"
	"time"
)

type Response struct {
	Message string \`json:"message"\`
	Time    string \`json:"time"\`
}

// Logging middleware
func withLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %v", r.Method, r.URL.Path, time.Since(start))
	})
}

// CORS middleware
func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(Response{
		Message: "ok",
		Time:    time.Now().Format(time.RFC3339),
	})
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler)

	handler := withLogging(withCORS(mux))

	log.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", handler))
}`,
    },

    // 10. Not pinned + Public — YAML
    {
        id: 10,
        slug: 'calm-sea-rests',
        title: "GitHub Actions CI Pipeline",
        language: "yaml",
        visibility: "public",
        pinned: 0,
        created_at: NOW,
        updated_at: NOW,
        preview: 'name: CI Pipeline\n\non:\n  push:\n    branches: [main, develop]...',
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
        id: 11,
        slug: 'bright-star-falls',
        title: "Email Template — Welcome",
        language: "html",
        visibility: "private",
        pinned: 0,
        created_at: NOW,
        updated_at: NOW,
        preview: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">...',
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
        id: 12,
        slug: 'cool-breeze-whispers',
        title: "Project Architecture Notes",
        language: "markdown",
        visibility: "public",
        pinned: 0,
        created_at: NOW,
        updated_at: NOW,
        preview: '# Architecture Overview\n\n## Stack\n- **Frontend**: React 19 + Vite + TypeScript...',
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

    // 13. Not pinned + Public — C++ (Competitive Programming)
    {
        id: 13,
        slug: 'swift-arrow-flies',
        title: "CP Template (C++)",
        language: "cpp",
        visibility: "public",
        pinned: 0,
        created_at: NOW,
        updated_at: NOW,
        preview: '#include <bits/stdc++.h>\nusing namespace std;\n\ntypedef long long ll;...',
        content: `#include <bits/stdc++.h>
using namespace std;

typedef long long ll;
typedef vector<int> vi;
typedef pair<int, int> pii;

#define F first
#define S second
#define PB push_back
#define MP make_pair
#define REP(i, a, b) for (int i = a; i <= b; i++)

void solve() {
    int n;
    cin >> n;
    vi v(n);
    for (int &x : v) cin >> x;
    
    sort(v.begin(), v.end());
    
    for (int x : v) cout << x << " ";
    cout << "\\n";
}

int main() {
    ios::sync_with_stdio(0);
    cin.tie(0);
    
    int t;
    cin >> t;
    while (t--) {
        solve();
    }
    return 0;
}`,
    },

    // 14. Not pinned + Private — Java (Spring Boot)
    {
        id: 14,
        slug: 'green-leaf-dances',
        title: "Spring Boot User Controller",
        language: "java",
        visibility: "private",
        pinned: 0,
        created_at: NOW,
        updated_at: NOW,
        preview: 'package com.example.demo.controller;\n\nimport org.springframework.web.bind.annotation.*;...',
        content: `package com.example.demo.controller;

import com.example.demo.model.User;
import com.example.demo.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    public List<User> getAllUsers() {
        return userService.findAll();
    }

    @GetMapping("/{id}")
    public ResponseEntity<User> getUserById(@PathVariable Long id) {
        return userService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public User createUser(@RequestBody User user) {
        return userService.save(user);
    }
}`,
    },

    // 15. Not pinned + Public — Kotlin (Android)
    {
        id: 15,
        slug: 'icy-mountain-stands',
        title: "RecyclerView Adapter (Kotlin)",
        language: "kotlin",
        visibility: "public",
        pinned: 0,
        created_at: NOW,
        updated_at: NOW,
        preview: 'class ItemAdapter(private const val items: List<String>) :...',
        content: `import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

class ItemAdapter(private val items: List<String>) :
    RecyclerView.Adapter<ItemAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val textView: TextView = view.findViewById(R.id.textView)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_view, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.textView.text = items[position]
    }

    override fun getItemCount() = items.size
}`,
    },

    // 16. Not pinned + Private — Swift (SwiftUI)
    {
        id: 16,
        slug: 'velvet-night-dreams',
        title: "SwiftUI Profile View",
        language: "swift",
        visibility: "private",
        pinned: 0,
        created_at: NOW,
        updated_at: NOW,
        preview: 'import SwiftUI\n\nstruct ProfileView: View {\n    var user: User...',
        content: `import SwiftUI

struct ProfileView: View {
    var user: User

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "person.circle.fill")
                .resizable()
                .frame(width: 100, height: 100)
                .foregroundColor(.blue)

            Text(user.name)
                .font(.title)
                .fontWeight(.bold)

            Text(user.bio)
                .font(.body)
                .foregroundColor(.secondary)
            
            Button(action: {
                print("Edit profile")
            }) {
                Text("Edit Profile")
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                    .padding()
                    .frame(maxWidth: .infinity)
                    .background(Color.blue)
                    .cornerRadius(10)
            }
        }
        .padding()
    }
}

struct ProfileView_Previews: PreviewProvider {
    static var previews: some View {
        ProfileView(user: User(name: "John Doe", bio: "iOS Developer"))
    }
}`,
    }
];
