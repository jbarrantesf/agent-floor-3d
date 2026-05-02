# QUICK REFERENCE — Task Delegation (One-Pager)

## 🎯 ROLES

```
HERMES (🟦)          │ ORBIT (🟪)
──────────────────────────────────────
Planning    ✅       │  Code exec    ✅
Decisions   ✅       │  Testing      ✅
Monitoring  ✅       │  Deploy       ✅
Cost track  ✅       │  Subagents    ✅
──────────────────────────────────────
Code exec   ❌       │  Planning     ❌
```

---

## 📡 COMMUNICATION LAYERS

```
Layer 1: Event Bus (WebSocket)
  Hermes → DELEGATE_TASK → ORBIT
  ORBIT → TASK_STATUS_UPDATE → Hermes
  ORBIT → EXECUTION_COMPLETE → Hermes

Layer 2: Persistent Store (Supabase)
  - tasks table (task queue)
  - task_events table (audit)
  - agent_capacity table (limits)

Layer 3: Fallback (Polling)
  If WebSocket down → Supabase polling every 5s
```

---

## 📊 3D FLOOR VISUALIZATION

```
┌─────────────────────────────────────┐
│  🟦 HERMES                          │
│  Status: PLANNING                   │
│  Queue: 2/10                        │
│  ┌────────────────────┐             │
│  │ 🟡[45%] Task 1     │             │
│  │ 🟢[QUEUED] Task 2  │             │
│  └────────────────────┘             │
└────────────┬──────────────────────────┘
             │ DELEGATION LINE
             │ (pulses when active)
┌────────────▼──────────────────────────┐
│  🟪 ORBIT                             │
│  Status: EXECUTING                    │
│  Queue: 3/5                           │
│  ┌────────────────────┐               │
│  │ 🟢[100%] Task 3 ✓  │               │
│  │ 🟡[72%] Task 4     │               │
│  │ 🟢[QUEUED] Task 5  │               │
│  └────────────────────┘               │
└──────────────────────────────────────┘
   💰 Cost particles floating: $0.017
```

---

## 📋 EVENT TYPES

| Event | From | To | Example |
|-------|------|-----|---------|
| DELEGATE_TASK | Hermes | ORBIT | "Improve 3D floor" |
| TASK_STATUS_UPDATE | ORBIT | Hermes | {progress: 45%, cost: $0.017} |
| EXECUTION_COMPLETE | ORBIT | Hermes | {success: true, cost: $0.042} |
| TIMEOUT | ORBIT | Hermes | Task exceeded 5min limit |
| ERROR | ORBIT | Hermes | Code execution failed |

---

## 🗄️ DATABASE TABLES

```sql
-- Main task queue
CREATE TABLE tasks (
  id UUID,
  goal TEXT,
  assigned_to VARCHAR,
  status VARCHAR,
  progress_percent INT,
  estimated_cost DECIMAL,
  actual_cost DECIMAL
)

-- Audit trail
CREATE TABLE task_events (
  task_id UUID,
  event_type VARCHAR,
  agent_from VARCHAR,
  agent_to VARCHAR,
  metrics JSONB
)

-- Agent limits
CREATE TABLE agent_capacity (
  agent_name VARCHAR,
  max_concurrent_tasks INT,
  current_tasks INT,
  reliability_score DECIMAL
)
```

---

## 🔄 TASK LIFECYCLE

```
1. HERMES checks ORBIT capacity
   └─ If available: proceed
   └─ If full: wait or alert

2. HERMES creates task
   └─ INSERT into tasks table
   └─ status = 'QUEUED'

3. HERMES emits DELEGATE_TASK
   └─ WebSocket broadcast to ORBIT

4. ORBIT dequeues task
   └─ UPDATE tasks table
   └─ status = 'EXECUTING'

5. ORBIT runs task, reports progress
   └─ Every 5s: INSERT task_events
   └─ Update actual_cost
   └─ Update progress_percent

6. ORBIT completes task
   └─ UPDATE tasks table
   └─ status = 'COMPLETED'
   └─ Emit EXECUTION_COMPLETE

7. HERMES aggregates metrics
   └─ Update dashboard
   └─ Update cost tracking
```

---

## ⚠️ ERROR RECOVERY

```
SCENARIO: Task timeout (120s no response)
├─ Mark task as TIMEOUT
├─ Check retry_count < max_retries
├─ YES: Create new task with retry_count++
├─ NO: Mark as FAILED, alert Hermes
└─ Hermes escalates to José

SCENARIO: ORBIT offline
├─ WebSocket connection DOWN
├─ Fallback to Supabase polling
├─ After 3 failed polls: mark PENDING_ORBIT_RECOVERY
├─ Continue polling every 10s
└─ Alert if > 5 minutes down

SCENARIO: Cost exceeds budget
├─ Task budget: $0.05
├─ At $0.051: BudgetWarningEvent
├─ Options: continue or terminate
└─ Logged to audit trail
```

---

## 💡 COST TRACKING

```
Per-task:
  - estimated_cost (at create)
  - actual_cost (incremental, every 5s)
  - tokens_used (tracked from API)
  - variance (actual vs estimated)

Per-agent (aggregate):
  - total_cost = SUM(task.actual_cost WHERE assigned_to = agent)
  - avg_cost_per_task
  - cost_trend (historical)

Per-day:
  - Total spend across all agents
  - Budget utilization
  - Forecast for month
```

---

## 🚀 IMPLEMENTATION PHASES

```
PHASE 1 (6h, $0.50) — Database
  □ Create 3 Supabase tables
  □ Enable RLS + realtime
  □ Create indexes
  □ Test with dummy data

PHASE 2 (4h, $0.30) — Hermes
  □ Implement TaskManager
  □ delegateTaskToOrbit()
  □ subscribeToUpdates()
  □ handleCompletion()

PHASE 3 (5h, $0.40) — ORBIT
  □ Implement TaskQueue
  □ Listen for DELEGATE_TASK
  □ executeTask() loop
  □ reportProgress()

PHASE 4 (13h, $1.00) — Dashboard
  □ API endpoints (/api/tasks, /api/metrics)
  □ React hooks (useTaskQueue)
  □ 3D floor component updates
  □ Cost particle system

PHASE 5 (5h, $0.50) — Testing & Hardening
  □ Unit tests
  □ E2E tests
  □ Load testing
  □ Production deployment

TOTAL: 33h, $2.70
```

---

## ✅ DEFINITION OF SUCCESS

- [ ] Hermes never needs to manually "ping" ORBIT
- [ ] ORBIT dequeues task within 2 seconds
- [ ] 3D floor shows task progress in real-time
- [ ] Cost per task tracked automatically
- [ ] Duplicate work reduced by 80%
- [ ] Throughput increased from 1 to 3+ tasks/min
- [ ] Zero manual cost accounting

---

## 📞 YOUR 5 DECISIONS

```
1. ORBIT capabilities?
   ⬜ Full (terminal/Git/Vercel)
   ⬜ Inference only

2. Subagents always via ORBIT?
   ⬜ Yes
   ⬜ Sometimes direct

3. Task timeout default?
   ⬜ 30 seconds
   ⬜ 5 minutes ← recommended
   ⬜ 10 minutes

4. Queue strategy?
   ⬜ Priority-based ← recommended
   ⬜ FIFO

5. Overload alerts?
   ⬜ Yes, to Telegram ← recommended
   ⬜ Dashboard only
```

---

**Status:** Ready to implement  
**Next:** Your 5 decisions → Phase 1 kickoff tomorrow

