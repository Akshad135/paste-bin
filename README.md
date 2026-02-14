# pastebin

A self-hosted, private-first pastebin with syntax highlighting. Deploy on Cloudflare Pages for free, or run it anywhere with Bun.

## Features

- **Syntax highlighting** — 50+ languages via [Shiki](https://shiki.style)
- **Single-user auth** — passphrase-protected, no accounts needed
- **PWA** — installable on mobile (Samsung Internet, Chrome, etc.)
- **Offline support** — cached pastes viewable without internet
- **5 color palettes** — dark & light modes for each
- **Pin pastes** — keep important pastes at the top
- **Public / private** — share pastes or keep them to yourself
- **Responsive** — works on desktop, tablet, and mobile
- **Zero tracking** — no analytics, no cookies beyond auth

## Quick Start — Cloudflare Pages

The easiest way: fork → configure → deploy. Free tier is more than enough.

1. **Fork** this repo
2. Go to **Cloudflare Dashboard** → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. Select your fork and configure:
   - **Build command**: `bun run build`
   - **Build output**: `dist`
4. Add **environment variable**: `AUTH_KEY` = your secret passphrase
5. **Deploy**

### Database Setup (one-time)

After the first deploy:

1. **D1** → Create database → name it `pastebin-db`
2. **Pages project** → **Settings** → **Functions** → **D1 Bindings**:
   - Variable name: `DB`
   - Database: `pastebin-db`
3. **D1** → `pastebin-db` → **Console** → paste contents of `schema.sql` → **Execute**
4. **Redeploy** the latest commit

## Local Development

### Prerequisites

- [Bun](https://bun.sh) (v1.0+)

### Setup

```bash
# Install dependencies
bun install

# Create env file (edit AUTH_KEY at minimum)
cp .env.example .env

# Create and migrate the local database
bun run db:create
bun run db:migrate:local

# Start the API server (terminal 1)
bun run dev:api

# Start the frontend (terminal 2)
bun run dev
```

Open `http://localhost:5173` — the frontend proxies API requests to the dev server on `:8788`.

### Windows (PowerShell)

```powershell
.\setup.ps1
```

## VPS / Self-Hosted

Build the frontend and serve with Cloudflare Pages, or adapt the Bun dev server for production:

```bash
bun install
cp .env.example .env   # edit AUTH_KEY, branding, etc.
bun run build           # outputs to dist/
```

Serve `dist/` with any static file server and run `bun run dev:api` (or adapt it) as the API backend behind a reverse proxy.

## Environment Variables

All branding is configurable via `.env`. See [`.env.example`](.env.example) for the full list.

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_APP_NAME` | `pastebin` | Site name (navbar, tab title, PWA) |
| `VITE_APP_NAME_ACCENT` | `bin` | Colored portion of navbar logo text |
| `VITE_APP_DESCRIPTION` | *A simple, private-first…* | Meta description |
| `VITE_FAVICON_URL` | `/favicon.svg` | Favicon path or URL |
| `VITE_PWA_ICON_192` | `/icon-192.png` | PWA icon 192×192 |
| `VITE_PWA_ICON_512` | `/icon-512.png` | PWA icon 512×512 |
| `VITE_PWA_ICON_MASKABLE` | `/icon-maskable-512.png` | Maskable PWA icon |
| `VITE_APPLE_TOUCH_ICON` | `/icon-192.png` | iOS home screen icon |
| `AUTH_KEY` | *(required)* | Login passphrase (backend only) |

> **Icons**: Drop your own images into `public/` and set the corresponding env var, or provide an external URL. The bundled ghost icon is used by default.

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS |
| Backend | Cloudflare Pages Functions (prod) / Bun (dev) |
| Database | Cloudflare D1 (SQLite) |
| Syntax highlighting | Shiki |
| Icons | Lucide React |
