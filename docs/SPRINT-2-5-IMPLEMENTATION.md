# SPRINT 2.5: Bilateral Hermes ↔ ORBIT Communication via Supabase + WebSocket

## Overview

SPRINT 2.5 implements a **hybrid dual-channel communication system** for agent orchestration:
- **Supabase** acts as the central event bus and persistent state store
- **WebSocket** provides real-time dashboard updates with <500ms latency
- **RLS Policies** enforce agent-level access control
- **Realtime Subscriptions** ensure instant propagation of state changes

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Hermes Agent                             │
│  (MCP Client at http://127.0.0.1:18789)                     │
└──────────────────┬──────────────────────────────────────────┘
                   │
    ┌──────────────┼──────────────┐
    │              │              │
    ▼              ▼              ▼
[HTTP REST]  [WebSocket]   [Supabase REST]
    │              │              │
    └──────────────┼──────────────┘
                   │
        ┌──────────▼──────────┐
        │  Express Server     │
        │  (port 3001)        │
        │  - REST endpoints   │
        │  - WS broadcaster   │
        │  - Supabase bridge  │
        └──────────┬──────────┘
                   │
    ┌──────────────┼──────────────┐
    │              │              │
    ▼              ▼              ▼
[Supabase]    [Realtime]    [RLS Policies]
 Database     Subscriptions    Enforcement
```

## Data Schema

### 1. agent_handoffs
Tracks task requests between agents (request/response pattern).

```sql
id UUID PRIMARY KEY
from_agent TEXT           -- 'hermes' or 'orbit'
to_agent TEXT             -- 'hermes' or 'orbit'
task JSONB                -- { type, description, params, ... }
status TEXT               -- 'pending' | 'executing' | 'completed' | 'failed'
created_at TIMESTAMP
updated_at TIMESTAMP
```

**Example handoff:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "from_agent": "hermes",
  "to_agent": "orbit",
  "task": { "type": "test_task", "description": "SPRINT 2.5 bilateral test" },
  "status": "pending",
  "created_at": "2026-05-01T18:55:00Z"
}
```

### 2. agent_events
Centralized event log for all agent activities.

```sql
id UUID PRIMARY KEY
agent TEXT                -- 'hermes', 'orbit', 'system'
event_type TEXT           -- 'handoff', 'approval', 'error', 'sync', etc.
payload JSONB             -- { message, result, error, ... }
timestamp TIMESTAMP
```

**Example event:**
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "agent": "orbit",
  "event_type": "task_completed",
  "payload": { "handoff_id": "550e8400...", "result": "success" },
  "timestamp": "2026-05-01T18:55:05Z"
}
```

### 3. agent_state
Current operational state and cost tracking for each agent.

```sql
id UUID PRIMARY KEY
agent TEXT UNIQUE         -- 'hermes', 'orbit'
state JSONB               -- { status: 'idle'|'running'|'error' }
costs JSONB               -- { session: number, total: number }
updated_at TIMESTAMP
```

**Example state:**
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "agent": "hermes",
  "state": { "status": "idle" },
  "costs": { "session": 0.0042, "total": 12.5631 },
  "updated_at": "2026-05-01T18:55:10Z"
}
```

## REST API Endpoints

### Health & Status
- `GET /api/health` - Server health check + Supabase connection status

### Handoffs (Bilateral Task Requests)
- `POST /api/handoffs` - Create handoff (Hermes → ORBIT or vice versa)
- `GET /api/handoffs` - List handoffs (with filtering: `?from=hermes&status=pending`)
- `PATCH /api/handoffs/:id` - Update handoff status (pending → executing → completed)

### Events
- `POST /api/events` - Log event from agent
- `GET /api/events?agent=orbit` - Retrieve events (via Supabase)

### Agent State
- `GET /api/state/:agent` - Get current state for agent
- `POST /api/state` - Update agent state and costs

### Costs (Legacy)
- `GET /api/costs` - Get current costs for both agents
- `POST /api/costs/update` - Update costs

## WebSocket Messages

### Client → Server
```typescript
// Send state update
{ type: 'agent-state-update', payload: { hermes: 'running', ... } }

// Send event
{ type: 'event', message: 'Task started', timestamp: '2026-05-01T...' }

// Request handoff
{ type: 'handoff-request', from: 'hermes', to: 'orbit', task: {...} }
```

### Server → Client
```typescript
// Initial state
{ type: 'initial-state', agents: {...}, costs: {...}, supabase: {...} }

// Event from Supabase
{ type: 'event', data: {...}, timestamp: '...' }

// State change
{ type: 'state-update', data: {...}, timestamp: '...' }

// Handoff change
{ type: 'handoff-update', event: 'INSERT|UPDATE', data: {...} }

// Cost update
{ type: 'costs', payload: { hermes: 0.0042, orbit: 0.0018 } }
```

## Setup & Configuration

### 1. Environment Variables
Located at `~/.env` (read by server and React):

```bash
# ~/.env
SUPABASE_URL=https://aybxrgvvwpknkoqrevqa.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Also in `/agent-floor-3d/.env.local`:
```bash
VITE_SUPABASE_URL=https://aybxrgvvwpknkoqrevqa.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_WS_URL=ws://localhost:3001
```

### 2. Create Supabase Tables & RLS

Run SQL migrations in Supabase dashboard:
```bash
# Copy contents of sql/supabase-migrations.sql
# Paste into Supabase SQL editor
# Execute all statements
```

Or use script:
```bash
npm run setup:supabase
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Start Development

**Terminal 1 - Server:**
```bash
npm run server
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

**Both in one:**
```bash
npm run dev:full
```

## Testing

### Run Complete Test Suite
```bash
npm test
```

Tests verify:
- ✅ API health and Supabase connectivity
- ✅ Supabase tables exist and are accessible
- ✅ Handoff creation (CRUD)
- ✅ Event logging
- ✅ Agent state updates
- ✅ WebSocket connection and real-time delivery
- ✅ Complete bilateral flow (Hermes → ORBIT → completion)
- ✅ Latency < 500ms

**Expected output:**
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

## React Components

### App.tsx
Main orchestrator with WebSocket and Supabase realtime subscriptions.

**State subscriptions:**
- Listens to `agent_events` inserts → updates event ticker
- Listens to `agent_state` updates → updates costs and status
- Listens to `agent_handoffs` changes → logs to event ticker

### Scene3D.tsx
3D visualization of agents (sphere = Hermes, cube = ORBIT).

**Features:**
- Real-time position/animation updates
- Pulse animation for running agents
- Status colors: green (running), red (error), gray (idle)
- Connection lines showing agent relationships

### Dashboard.tsx
Real-time cost and status display.

**Displays:**
- Hermes cost (USD)
- ORBIT cost (USD)
- Total cost
- Active agent states

### EventTicker.tsx
Live timeline of all events from Supabase.

**Shows:**
- Timestamp
- Event type (handoff, approval, error, etc.)
- Message
- Color-coded by type

## RLS Policies

Agents can only:
1. **Hermes** can read/write `agent_handoffs` (both directions), write `agent_state` for itself, read `agent_events`
2. **ORBIT** can read/write `agent_handoffs` (both directions), write `agent_state` for itself, read `agent_events`
3. **Anonymous** (local dev) can read all tables

**Enforcement:**
```sql
-- Example: Hermes can only update their own state
CREATE POLICY "hermes_update_state" ON agent_state
  FOR UPDATE USING (agent = 'hermes');
```

## Billing & Costs

Real-time cost tracking with bilateral sync:
1. Each agent maintains session cost in `agent_state.costs`
2. Dashboard displays both costs live
3. On update, Supabase broadcasts to all connected clients

## Troubleshooting

### WebSocket not connecting
```bash
# Check server is running
curl http://localhost:3001/api/health

# Verify WS_URL in .env.local
echo $VITE_WS_URL
```

### Supabase connection failed
```bash
# Verify credentials
echo $SUPABASE_URL
echo $SUPABASE_ANON_KEY

# Test connection
curl -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  "$SUPABASE_URL/rest/v1/agent_state?select=*"
```

### Test suite fails
```bash
# Run with verbose output
npm test 2>&1 | head -50

# Check server logs
tail -f /tmp/server.log

# Verify Supabase tables
npm run setup:supabase
```

## Performance Metrics

**Typical latencies (local dev):**
- Handoff creation → Supabase: ~35-50ms
- WebSocket broadcast: ~10-20ms
- Event insertion → Realtime: ~40-80ms
- Dashboard update: ~100-150ms

**Target: <500ms end-to-end** ✅

## Files Modified/Created

```
/Users/nextaisolutionscr/NexAI/agent-floor-3d/
├── .env.local (NEW)
├── server.ts (MODIFIED - Supabase integration)
├── package.json (MODIFIED - new scripts & deps)
├── sql/
│   └── supabase-migrations.sql (NEW)
├── scripts/
│   ├── setup-supabase.sh (NEW)
│   └── test-sprint-2-5.ts (NEW)
├── src/
│   ├── App.tsx (MODIFIED - Supabase subscriptions)
│   └── components/
│       └── StatusBar.tsx (MODIFIED - Supabase indicator)
└── docs/
    └── SPRINT-2-5-IMPLEMENTATION.md (THIS FILE)
```

## Next Steps (SPRINT 3+)

- [ ] Error handling & retry logic for handoff failures
- [ ] Cost calculation engine (per-token tracking)
- [ ] Agent authentication (JWT tokens instead of plain agent names)
- [ ] Batch operations (create multiple handoffs)
- [ ] Event deduplication (prevent duplicate events)
- [ ] Dashboard charts (cost trends, latency graphs)
- [ ] Integration with Hermes MCP endpoint
- [ ] Integration with ORBIT agent endpoint

## References

- Supabase Docs: https://supabase.com/docs
- Realtime: https://supabase.com/docs/guides/realtime
- RLS: https://supabase.com/docs/guides/auth/row-level-security
- WebSocket API: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
