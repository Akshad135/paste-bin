# pastebin

A self-hosted, private-first pastebin with syntax highlighting. Deploy on Cloudflare for free, or run it anywhere with Bun.

<div align="center">

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Akshad135/paste-bin)

</div>

## Features

- **Syntax highlighting** — 50+ languages via [Shiki](https://shiki.style)
- **Single-user auth** — passphrase-protected, no accounts needed
- **PWA** — installable on mobile (Samsung Internet, Chrome, etc.)
- **Offline support** — cached pastes viewable without internet
- **5 color palettes** — dark and light modes for each
- **Pin pastes** — keep important pastes at the top
- **Public / private** — share pastes or keep them to yourself
- **Responsive** — works on desktop, tablet, and mobile
- **Zero tracking** — no analytics, no cookies beyond auth

## Screenshots

<div align="center">

![Tokyo Night Dark](public/themes/tokyo-night-dark.png)

*Tokyo Night — Dark*

![Catppuccin Light](public/themes/catppuccin-light.png)

*Catppuccin — Light*

</div>

**Other themes:** [Catppuccin Dark](public/themes/catppuccin-dark.png) · [Dracula Dark](public/themes/dracula-dark.png) · [Dracula Light](public/themes/dracula-light.png) · [Nord Dark](public/themes/nord-dark.png) · [Nord Light](public/themes/nord-light.png) · [Tokyo Night Light](public/themes/tokyo-night-light.png) · [Shadcn Dark](public/themes/shadcn-dark.png) · [Shadcn Light](public/themes/shadcn-light.png)

## Deploy — One Click

Click the deploy button above, set your `AUTH_KEY` secret when prompted, and you're done. Cloudflare automatically creates the D1 database and runs migrations.

Cloudflare D1's free tier gives you 500 MB of storage — enough for roughly **100,000 pastes** at ~5 KB each.

<!-- TODO: Add Cloudflare deploy page screenshot -->

## Local Development

### Prerequisites

- [Bun](https://bun.sh) (v1.0+)

### Setup

```bash
# Install dependencies
bun install

# Create env file (edit AUTH_KEY at minimum)
cp .env.example .env

# Run local DB migration
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

Build the frontend and serve with Cloudflare Workers, or adapt the Bun dev server for production:

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
| `VITE_PWA_ICON_192` | `/icon-192.png` | PWA icon 192x192 |
| `VITE_PWA_ICON_512` | `/icon-512.png` | PWA icon 512x512 |
| `VITE_PWA_ICON_MASKABLE` | `/icon-maskable-512.png` | Maskable PWA icon |
| `VITE_APPLE_TOUCH_ICON` | `/icon-192.png` | iOS home screen icon |
| `AUTH_KEY` | *(required)* | Login passphrase (backend only) |

> **Icons**: Drop your own images into `public/` and set the corresponding env var, or provide an external URL. The bundled ghost icon is used by default.

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS |
| Backend | Cloudflare Workers (prod) / Bun (dev) |
| Database | Cloudflare D1 (SQLite) |
| Syntax highlighting | Shiki |
| Icons | Lucide React |
