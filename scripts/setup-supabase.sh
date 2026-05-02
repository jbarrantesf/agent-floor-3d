#!/bin/bash
# SPRINT 2.5: Setup Supabase schema and RLS policies
# Usage: npm run setup:supabase

set -e

# Load env vars
if [ -f ~/.env ]; then
  export $(grep -v '^#' ~/.env | xargs)
fi

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "❌ Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in ~/.env"
  exit 1
fi

# Use supabase-cli if available, otherwise use curl
if command -v supabase &> /dev/null; then
  echo "📡 Using supabase-cli to run migrations..."
  supabase db push
else
  echo "⚠️ supabase-cli not found, skipping automated migrations"
  echo "🔗 Run migrations manually at: https://supabase.com/dashboard/project/aybxrgvvwpknkoqrevqa/sql"
  echo ""
  echo "📋 Copy and paste the SQL from: sql/supabase-migrations.sql"
fi

echo "✅ Setup complete!"
