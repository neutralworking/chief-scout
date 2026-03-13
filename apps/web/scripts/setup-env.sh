#!/bin/bash
# Setup .env.local for the web Next.js app.
# Usage: ./scripts/setup-env.sh
#
# Requires the Supabase anon key. Get it from:
#   Supabase Dashboard → Settings → API → anon / public key

set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=".env.local"

if [ -f "$ENV_FILE" ]; then
  echo "⚠ $ENV_FILE already exists. Delete it first to re-run setup."
  exit 1
fi

SUPABASE_URL="https://fnvlemkbhohyouhjebwf.supabase.co"

echo "Supabase URL: $SUPABASE_URL"
echo ""
read -rp "Paste your Supabase anon (public) key: " ANON_KEY

if [ -z "$ANON_KEY" ]; then
  echo "Error: anon key cannot be empty."
  exit 1
fi

cat > "$ENV_FILE" <<EOF
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
EOF

echo ""
echo "✓ Created $ENV_FILE"
echo "  Run 'npm run dev' to start the app."
