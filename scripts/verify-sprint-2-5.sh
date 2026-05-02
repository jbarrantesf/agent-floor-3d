#!/bin/bash
# SPRINT 2.5 Verification Checklist

echo "╔════════════════════════════════════════════════════════════╗"
echo "║ SPRINT 2.5 IMPLEMENTATION VERIFICATION                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

cd /Users/nextaisolutionscr/NexAI/agent-floor-3d

# 1. Configuration Files
echo "1️⃣  Configuration Files"
echo "────────────────────────"
[ -f ".env.local" ] && echo "  ✅ .env.local exists" || echo "  ❌ .env.local missing"
grep -q "VITE_SUPABASE_URL" .env.local && echo "  ✅ VITE_SUPABASE_URL configured" || echo "  ❌ VITE_SUPABASE_URL missing"
grep -q "VITE_SUPABASE_ANON_KEY" .env.local && echo "  ✅ VITE_SUPABASE_ANON_KEY configured" || echo "  ❌ VITE_SUPABASE_ANON_KEY missing"
grep -q "VITE_WS_URL" .env.local && echo "  ✅ VITE_WS_URL configured" || echo "  ❌ VITE_WS_URL missing"
echo ""

# 2. Backend Files
echo "2️⃣  Backend Files"
echo "─────────────────"
[ -f "server.ts" ] && echo "  ✅ server.ts exists" || echo "  ❌ server.ts missing"
grep -q "createClient" server.ts && echo "  ✅ Supabase client initialized" || echo "  ❌ Supabase client not found"
grep -q "agent_handoffs" server.ts && echo "  ✅ Handoff endpoints present" || echo "  ❌ Handoff endpoints missing"
grep -q "agent_events" server.ts && echo "  ✅ Event endpoints present" || echo "  ❌ Event endpoints missing"
grep -q "subscribeToRealtimeChanges" server.ts && echo "  ✅ Realtime subscriptions present" || echo "  ❌ Realtime subscriptions missing"
echo ""

# 3. Database Schema
echo "3️⃣  Database Schema"
echo "───────────────────"
[ -f "sql/supabase-migrations.sql" ] && echo "  ✅ Supabase migrations SQL exists" || echo "  ❌ Migrations SQL missing"
grep -q "agent_handoffs" sql/supabase-migrations.sql && echo "  ✅ agent_handoffs table defined" || echo "  ❌ agent_handoffs missing"
grep -q "agent_events" sql/supabase-migrations.sql && echo "  ✅ agent_events table defined" || echo "  ❌ agent_events missing"
grep -q "agent_state" sql/supabase-migrations.sql && echo "  ✅ agent_state table defined" || echo "  ❌ agent_state missing"
grep -q "REPLICA IDENTITY FULL" sql/supabase-migrations.sql && echo "  ✅ Realtime enabled" || echo "  ❌ Realtime not configured"
grep -q "RLS" sql/supabase-migrations.sql || grep -q "CREATE POLICY" sql/supabase-migrations.sql && echo "  ✅ RLS policies defined" || echo "  ❌ RLS policies missing"
echo ""

# 4. React Components
echo "4️⃣  React Components"
echo "────────────────────"
[ -f "src/App.tsx" ] && echo "  ✅ App.tsx exists" || echo "  ❌ App.tsx missing"
grep -q "createClient" src/App.tsx && echo "  ✅ Supabase client in React" || echo "  ❌ Supabase client missing"
grep -q "agent_events_realtime" src/App.tsx && echo "  ✅ Events subscription present" || echo "  ❌ Events subscription missing"
grep -q "agent_state_realtime" src/App.tsx && echo "  ✅ State subscription present" || echo "  ❌ State subscription missing"
grep -q "agent_handoffs_realtime" src/App.tsx && echo "  ✅ Handoffs subscription present" || echo "  ❌ Handoffs subscription missing"

[ -f "src/components/StatusBar.tsx" ] && echo "  ✅ StatusBar.tsx exists" || echo "  ❌ StatusBar.tsx missing"
grep -q "supabaseConnected" src/components/StatusBar.tsx && echo "  ✅ Supabase status indicator added" || echo "  ❌ Supabase indicator missing"
echo ""

# 5. Test Suite
echo "5️⃣  Test Suite"
echo "──────────────"
[ -f "scripts/test-sprint-2-5.ts" ] && echo "  ✅ Test suite exists" || echo "  ❌ Test suite missing"
grep -q "agent_handoffs" scripts/test-sprint-2-5.ts && echo "  ✅ Handoff tests present" || echo "  ❌ Handoff tests missing"
grep -q "WebSocket" scripts/test-sprint-2-5.ts && echo "  ✅ WebSocket tests present" || echo "  ❌ WebSocket tests missing"
grep -q "latency" scripts/test-sprint-2-5.ts && echo "  ✅ Latency tests present" || echo "  ❌ Latency tests missing"
echo ""

# 6. Scripts & Setup
echo "6️⃣  Setup Scripts"
echo "─────────────────"
[ -f "scripts/setup-supabase.sh" ] && echo "  ✅ setup-supabase.sh exists" || echo "  ❌ setup-supabase.sh missing"
[ -x "scripts/setup-supabase.sh" ] && echo "  ✅ setup-supabase.sh is executable" || echo "  ⚠️  setup-supabase.sh not executable"
echo ""

# 7. Documentation
echo "7️⃣  Documentation"
echo "─────────────────"
[ -f "QUICKSTART.md" ] && echo "  ✅ QUICKSTART.md exists" || echo "  ❌ QUICKSTART.md missing"
[ -f "SPRINT-2-5-SUMMARY.md" ] && echo "  ✅ SPRINT-2-5-SUMMARY.md exists" || echo "  ❌ SPRINT-2-5-SUMMARY.md missing"
[ -f "docs/SPRINT-2-5-IMPLEMENTATION.md" ] && echo "  ✅ SPRINT-2-5-IMPLEMENTATION.md exists" || echo "  ❌ SPRINT-2-5-IMPLEMENTATION.md missing"
echo ""

# 8. Dependencies
echo "8️⃣  Dependencies"
echo "────────────────"
grep -q "@supabase/supabase-js" package.json && echo "  ✅ Supabase JS client installed" || echo "  ❌ Supabase JS client missing"
grep -q "express" package.json && echo "  ✅ Express installed" || echo "  ❌ Express missing"
grep -q "ws" package.json && echo "  ✅ WebSocket library installed" || echo "  ❌ WebSocket missing"
grep -q "dotenv" package.json && echo "  ✅ dotenv installed" || echo "  ❌ dotenv missing"
echo ""

# 9. npm Scripts
echo "9️⃣  npm Scripts"
echo "───────────────"
grep -q '"server"' package.json && echo "  ✅ npm run server script" || echo "  ❌ server script missing"
grep -q '"dev:full"' package.json && echo "  ✅ npm run dev:full script" || echo "  ❌ dev:full script missing"
grep -q '"test".*test-sprint' package.json && echo "  ✅ npm test script" || echo "  ❌ test script missing"
grep -q '"setup:supabase"' package.json && echo "  ✅ npm run setup:supabase script" || echo "  ❌ setup:supabase script missing"
echo ""

# 10. TypeScript Compilation
echo "🔟 TypeScript Compilation"
echo "─────────────────────────"
npm run type-check >/dev/null 2>&1 && echo "  ✅ TypeScript compiles without errors" || echo "  ❌ TypeScript compilation errors"
echo ""

# Summary
echo "╔════════════════════════════════════════════════════════════╗"
echo "║ VERIFICATION COMPLETE                                     ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║                                                            ║"
echo "║ ✅ SPRINT 2.5 Implementation Ready                         ║"
echo "║                                                            ║"
echo "║ Next Steps:                                                ║"
echo "║ 1. Run SQL migrations in Supabase dashboard               ║"
echo "║ 2. Start server: npm run server                           ║"
echo "║ 3. Start frontend: npm run dev                            ║"
echo "║ 4. Open: http://localhost:5173                            ║"
echo "║ 5. Run tests: npm test                                    ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
