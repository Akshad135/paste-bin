#!/bin/bash
# deploy.sh — One-command deploy to Cloudflare Pages
set -e

echo "📦 Building..."
bun run build

# Check if database exists
if ! bunx wrangler d1 list 2>/dev/null | grep -q "pastebin-db"; then
  echo "🗄️ Creating D1 database..."
  bunx wrangler d1 create pastebin-db
  echo ""
  echo "⚠️  IMPORTANT: Copy the database_id from above and update wrangler.toml"
  echo "   Then set AUTH_KEY in Cloudflare dashboard → Pages → Settings → Environment variables"
  echo ""
  read -p "Press Enter after updating wrangler.toml..."
fi

echo "🗃️ Running database migrations..."
bunx wrangler d1 execute pastebin-db --remote --file=schema.sql

echo "🚀 Deploying to Cloudflare Pages..."
bunx wrangler pages deploy dist

echo "✅ Done! Your pastebin is live."
echo ""
echo "Don't forget to set AUTH_KEY in:"
echo "  Cloudflare Dashboard → Pages → pastebin → Settings → Environment variables"
