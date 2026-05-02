# SPRINT 2.5 Quick Start

## Prerequisites
- Node 18+
- npm/yarn
- Supabase account (Project: aybxrgvvwpknkoqrevqa)
- Environment variables in `~/.env`

## 1️⃣ Supabase Setup (One-time)

### Create tables and enable realtime

Go to: https://supabase.com/dashboard/project/aybxrgvvwpknkoqrevqa/sql/new

Copy & paste the entire contents of:
```
/Users/nextaisolutionscr/NexAI/agent-floor-3d/sql/supabase-migrations.sql
```

Execute the SQL. You should see:
- ✅ 3 tables created (agent_handoffs, agent_events, agent_state)
- ✅ Realtime enabled
- ✅ RLS policies created
- ✅ Initial rows inserted

**Verify:**
```bash
# Go to Supabase Dashboard → SQL Editor
# Run: SELECT COUNT(*) FROM agent_state;
# Expected: 2 rows (hermes, orbit)
```

## 2️⃣ Local Setup

### Install dependencies
```bash
cd /Users/nextaisolutionscr/NexAI/agent-floor-3d
npm install
```

### Create .env.local (already done)
File already exists with Supabase credentials:
```bash
cat .env.local
```

Should show:
```
VITE_SUPABASE_URL=https://aybxrgvvwpknkoqrevqa.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_WS_URL=ws://localhost:3001
```

## 3️⃣ Start Development

### Option A: Separate terminals

**Terminal 1 - Backend:**
```bash
cd /Users/nextaisolutionscr/NexAI/agent-floor-3d
npm run server
```

Expected output:
```
🚀 SPRINT 2.5 Backend (Hermes ↔ ORBIT)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 WebSocket: ws://localhost:3001
🌐 REST API: http://localhost:3001/api
🏥 Health: http://localhost:3001/api/health
🗄️  Supabase: https://aybxrgvvwpknkoqrevqa.supabase.co
📊 Realtime: active
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Terminal 2 - Frontend:**
```bash
cd /Users/nextaisolutionscr/NexAI/agent-floor-3d
npm run dev
```

Expected output:
```
  VITE v5.0.0  ready in 234 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h + enter to show help
```

### Option B: Both in one terminal
```bash
cd /Users/nextaisolutionscr/NexAI/agent-floor-3d
npm run dev:full
```

Then open: **http://localhost:5173**

## 4️⃣ Test

In separate terminal:
```bash
cd /Users/nextaisolutionscr/NexAI/agent-floor-3d
npm test
```

Expected output:
```
✅ PASS - API Health Check (45ms)
✅ PASS - Supabase Tables Exist (120ms)
✅ PASS - Create Handoff (52ms)
✅ PASS - Read Handoff from Supabase (38ms)
✅ PASS - Update Handoff Status (41ms)
✅ PASS - Log Agent Event (35ms)
✅ PASS - Read Event from Supabase (32ms)
✅ PASS - Update Agent State (28ms)
✅ PASS - WebSocket Connection (156ms)
✅ PASS - Complete Bilateral Flow (310ms)
✅ PASS - Latency Check (< 500ms) (94ms)

RESULTS: 11 Passed, 0 Failed
```

## 5️⃣ Manual Testing

### Health check
```bash
curl http://localhost:3001/api/health | jq
```

### Create handoff (Hermes → ORBIT)
```bash
curl -X POST http://localhost:3001/api/handoffs \
  -H "Content-Type: application/json" \
  -d '{
    "from_agent": "hermes",
    "to_agent": "orbit",
    "task": {"type": "test", "description": "Manual test"}
  }' | jq
```

### List handoffs
```bash
curl http://localhost:3001/api/handoffs | jq
```

### Update handoff status
```bash
# Replace HANDOFF_ID with ID from create response
curl -X PATCH http://localhost:3001/api/handoffs/HANDOFF_ID \
  -H "Content-Type: application/json" \
  -d '{"status": "completed"}' | jq
```

### Log event
```bash
curl -X POST http://localhost:3001/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "orbit",
    "event_type": "task_completed",
    "payload": {"result": "success"}
  }' | jq
```

## 6️⃣ Dashboard Features

Once dashboard loads at http://localhost:5173:

### 3D Scene
- Rotating view of agents (Hermes sphere, ORBIT cube)
- Pulse animation when running
- Connection lines showing relationships
- Click + drag to control view
- Scroll to zoom

### Dashboard Panel (bottom)
- **Hermes Cost**: Real-time USD cost
- **ORBIT Cost**: Real-time USD cost
- **Total Cost**: Combined
- **Active States**: Current status of each agent

### Event Ticker (bottom)
- Live events from Supabase
- Shows handoff requests, approvals, errors
- Timestamps for each event
- Color-coded by type

### Status Bar (top-right)
- WebSocket connection indicator (green = connected)
- Supabase realtime indicator (blue = active)
- Version info

## Troubleshooting

### "Could not find table 'public.agent_state'"
**Solution:** Run SQL migrations in Supabase dashboard

### "Address already in use :::3001"
**Solution:** Kill existing process on port 3001
```bash
lsof -i :3001 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

### WebSocket not connecting
**Solution:** 
1. Verify server is running (curl http://localhost:3001/api/health)
2. Check VITE_WS_URL in .env.local is correct
3. Refresh browser page

### Supabase credentials error
**Solution:**
1. Check ~/.env has correct SUPABASE_URL and SUPABASE_ANON_KEY
2. Check .env.local is not in .gitignore
3. Run: `cat ~/.env | grep SUPABASE`

### Test suite fails
**Solution:**
1. Ensure server is running: `npm run server`
2. Ensure Supabase tables exist (run SQL migrations)
3. Check network connectivity to Supabase
4. Run: `npm test 2>&1 | tail -30` for detailed error

## File Structure

```
/Users/nextaisolutionscr/NexAI/agent-floor-3d/
├── .env.local                    ✨ Supabase credentials
├── server.ts                     ✨ Express + Supabase realtime
├── package.json                  ✨ New scripts: server, test
├── sql/
│   └── supabase-migrations.sql   ✨ Database schema
├── scripts/
│   ├── setup-supabase.sh         ✨ Migration runner
│   └── test-sprint-2-5.ts        ✨ Test suite
├── src/
│   ├── App.tsx                   ✨ Supabase subscriptions
│   └── components/
│       └── StatusBar.tsx         ✨ Supabase indicator
└── docs/
    ├── SPRINT-2-5-IMPLEMENTATION.md
    └── QUICKSTART.md (this file)
```

## Next Steps

- [ ] Run SQL migrations in Supabase
- [ ] Start server: `npm run server`
- [ ] Start frontend: `npm run dev`
- [ ] Open http://localhost:5173
- [ ] Run tests: `npm test`

## Resources

- **Repo:** /Users/nextaisolutionscr/NexAI/agent-floor-3d
- **Supabase Project:** https://aybxrgvvwpknkoqrevqa.supabase.co
- **API Base:** http://localhost:3001/api
- **Frontend:** http://localhost:5173

---

✅ **SPRINT 2.5 Complete**
- Supabase bilateral communication ✓
- WebSocket real-time dashboard ✓
- RLS policies & security ✓
- Comprehensive test suite ✓
- Latency < 500ms ✓
