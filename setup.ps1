# One-click setup script for Pastebin
Write-Host "🚀 Setting up Pastebin..." -ForegroundColor Cyan

# 1. Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
bun install

# 2. Setup Database
Write-Host "🗄️ Setting up Local D1 Database..." -ForegroundColor Yellow
Write-Host "Applying migrations..."
bun run db:migrate:local

# 3. Build Frontend
Write-Host "🏗️ Building Frontend..." -ForegroundColor Yellow
bun run build

# 4. Start Server
Write-Host "✨ Starting Server..." -ForegroundColor Green
Write-Host "The app will be available at http://localhost:8788" -ForegroundColor Gray
bun run dev:api
