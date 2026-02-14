# One-click setup script for Pastebin
Write-Host "Setting up Pastebin..." -ForegroundColor Cyan

# 1. Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
bun install

# 2. Create .env if missing (for AUTH_KEY)
if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Created .env — edit AUTH_KEY before using." -ForegroundColor Magenta
}

# 3. Setup Database
Write-Host "Setting up local D1 database..." -ForegroundColor Yellow
bun run db:migrate:local

# 4. Start dev servers
Write-Host "Starting dev servers..." -ForegroundColor Green
Write-Host "API:      http://localhost:8788" -ForegroundColor Gray
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Gray
Start-Process -NoNewWindow -FilePath "bun" -ArgumentList "run","dev:api"
bun run dev
