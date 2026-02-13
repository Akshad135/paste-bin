# One-click setup script for Pastebin
Write-Host "🚀 Setting up Pastebin..." -ForegroundColor Cyan

# 1. Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
bun install

# 2. Setup Database
Write-Host "🗄️ Setting up Local D1 Database..." -ForegroundColor Yellow
$dbExists = bunx wrangler d1 info pastebin-db --local 2>$null
if (-not $dbExists) {
    Write-Host "Creating database..."
    bunx wrangler d1 create pastebin-db
}
Write-Host "Applying migrations..."
bunx wrangler d1 execute pastebin-db --local --file=schema.sql

# 3. Build Frontend
Write-Host "🏗️ Building Frontend..." -ForegroundColor Yellow
bun run build

# 4. Start Server
Write-Host "✨ Starting Server..." -ForegroundColor Green
Write-Host "The app will be available at http://localhost:8788" -ForegroundColor Gray
bun run dev:api
