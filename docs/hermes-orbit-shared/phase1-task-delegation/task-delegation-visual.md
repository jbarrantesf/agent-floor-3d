# 🎭 DIAGRAMA: Delegación de Tareas — Hermes ↔ ORBIT

## 1️⃣ ARQUITECTURA DE ALTO NIVEL

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE (Telegram)                        │
│                     "José: Mejorar el floor 3D"                          │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
                    ┌────────────────▼─────────────────┐
                    │   HERMES (Orchestrator)          │
                    │   - Planning                     │
                    │   - Task creation                │
                    │   - Monitoring                   │
                    │   - Cost tracking                │
                    │   - Decision making              │
                    └────────────────┬─────────────────┘
                                     │
                    ┌────────────────▼─────────────────┐
                    │     EVENT BUS (WebSocket)        │
                    │  Supabase Realtime Channel       │
                    │  - DELEGATE_TASK                 │
                    │  - TASK_STATUS_UPDATE            │
                    │  - EXECUTION_COMPLETE            │
                    └────────────────┬─────────────────┘
                                     │
                    ┌────────────────▼─────────────────┐
                    │    ORBIT (Executor)              │
                    │    - Task dequeue                │
                    │    - Code execution              │
                    │    - Testing/deployment          │
                    │    - Status reporting            │
                    │    - Subagent delegation         │
                    └─────────────────────────────────┘
                                     │
                    ┌────────────────▼─────────────────┐
                    │  SHARED STATE (Supabase)         │
                    │  - tasks table                   │
                    │  - task_events (audit)           │
                    │  - agent_capacity                │
                    │  - real-time subscriptions       │
                    └─────────────────────────────────┘
                                     │
                    ┌────────────────▼─────────────────┐
                    │  3D FLOOR VISUALIZATION          │
                    │  - Task queue above agents       │
                    │  - Delegation lines              │
                    │  - Cost particles                │
                    │  - Progress indicators           │
                    └─────────────────────────────────┘
```

---

## 2️⃣ FLUJO DE DELEGACIÓN (Secuencia Completa)

```
TIEMPO │ HERMES                │ EVENT BUS           │ ORBIT               │ SUPABASE
       │                       │                     │                     │
  T=0  │ Parse: "Mejorar floor"│                     │                     │
       │ Plan task             │                     │                     │
       │ Check ORBIT capacity  │                     │                     │
       │                       │                     │                     │
  T=1  │ Create DelegateEvent  │                     │                     │
       │ {                     │                     │                     │
       │   id: "task_xyz",     │                     │                     │
       │   goal: "Modify...",  │                     │                     │
       │   priority: "HIGH",   │                     │                     │
       │   est_cost: $0.05     │                     │                     │
       │ }                     │                     │                     │
       │                       │                     │                     │
  T=2  │ Emit to EventBus ──────────────────────┐   │                     │
       │ (WebSocket)           │                │   │                     │
       │                       │  Broadcast    │   │                     │
       │                       │  DELEGATE_TASK│   │                     │
       │                       │                ├──→ Receive event       │
       │                       │                │   │                     │
       │                       │                │   │ Dequeue task       │
       │                       │                │   │ Insert into queue  │
       │                       │                │   │                     │
  T=3  │ Await status updates  │                │   │                    ↓
       │ (listening)           │                │   │                    Insert tasks row
       │                       │                │   │                    status='QUEUED'
       │                       │                │   │                    │
       │                       │                │   │ Start execution    │
       │                       │                │   │ status='EXECUTING' │
       │                       │                │   │                    │
  T=4  │                       │ ←───────────────── Emit StatusUpdate   ↓
       │ Receive progress: 10% │ PROGRESS      │   {                    Update row
       │ cost so far: $0.005   │              │     percent: 10,        cost_accrued=$0.005
       │                       │              │     tokens: 245,        progress=10%
       │                       │              │     cost: $0.005        │
  T=5  │                       │              │   }                     │
       │                       │              │                        │
       │                       │ ←───────────────── Emit StatusUpdate   ↓
       │ Receive progress: 50% │ PROGRESS      │   {                    Update row
       │ cost so far: $0.025   │              │     percent: 50,        cost_accrued=$0.025
       │                       │              │     tokens: 1,245,      progress=50%
       │                       │              │     cost: $0.025        │
  T=6  │                       │              │                        │
       │                       │              │                        │
       │                       │ ←───────────────── Emit StatusUpdate   ↓
       │ Receive progress: 100%│ PROGRESS      │   {                    Update row
       │ cost so far: $0.042   │              │     percent: 100,       cost_accrued=$0.042
       │                       │              │     tokens: 1,876,      progress=100%
       │                       │              │     cost: $0.042        │
       │                       │              │   }                     │
  T=7  │                       │              │                        │
       │                       │              │ Code complete!         │
       │                       │              │ Generate output        │
       │                       │              │                        │
  T=8  │                       │ ←───────────────── Emit CompletionEvent ↓
       │ Receive COMPLETED     │ COMPLETE      │   {                    Insert task_events row
       │ result: "✅ File...   │              │     taskId: 'task_xyz' │
       │ cost: $0.042          │              │     status: 'COMPLETED'│
       │ tokens: 1,876         │              │     result: {...}      │
       │                       │              │     totalCost: $0.042  │
       │ Aggregate costs:      │              │   }                    │
       │ hermes total: $0.015  │              │                        │
       │ orbit total: $0.042   │              │                        │
       │ → Update dashboard    │              │                        │
       │                       │              │                        │
  T=9  │                       │              │ Back to polling queue  │
       │ Ready for next task   │              │ (idle or next task)    │
       │                       │              │                        │
```

---

## 3️⃣ EJEMPLO: JSON EVENTS

### Event A: DELEGATE_TASK (Hermes → ORBIT)

```json
{
  "id": "evt_delegate_001",
  "type": "DELEGATE_TASK",
  "timestamp": 1714571400000,
  "task": {
    "id": "task_xyz",
    "goal": "Improve Agent3DFloor with better animations and lighting",
    "context": "Frontend React component using THREE.js, add particle effects",
    "priority": "HIGH",
    "toolsets": ["browser", "terminal", "file"],
    "estimatedCost": 0.05,
    "deadline_at": 1714574000000,
    "requirements": {
      "language": "TypeScript/React",
      "framework": "THREE.js",
      "tests": "required",
      "deployment": "Vercel"
    }
  },
  "metadata": {
    "source": "user_request",
    "createdBy": "hermes",
    "retryCount": 0,
    "maxRetries": 3
  }
}
```

### Event B: TASK_STATUS_UPDATE (ORBIT → Hermes, every 5s)

```json
{
  "id": "evt_status_002",
  "type": "TASK_STATUS_UPDATE",
  "taskId": "task_xyz",
  "timestamp": 1714571405000,
  "status": "EXECUTING",
  "progress": {
    "percent": 45,
    "currentStep": "Adding particle system to Agent3DFloor.tsx",
    "estimatedTimeRemaining": 120000,
    "subtasks": [
      { "name": "Analyze current code", "done": true },
      { "name": "Add THREE.Points system", "done": true },
      { "name": "Implement animations", "done": false },
      { "name": "Test in browser", "done": false }
    ]
  },
  "metrics": {
    "tokensUsed": 3450,
    "costAccrued": 0.0172,
    "wallTimeMs": 45000,
    "cpuPercent": 85,
    "memoryMb": 1024
  },
  "agentState": {
    "queueLength": 2,
    "currentCapacity": 3,
    "reliability": 0.98
  }
}
```

### Event C: EXECUTION_COMPLETE (ORBIT → Hermes)

```json
{
  "id": "evt_complete_003",
  "type": "EXECUTION_COMPLETE",
  "taskId": "task_xyz",
  "timestamp": 1714571530000,
  "outcome": "SUCCESS",
  "result": {
    "summary": "✅ Agent3DFloor improved with particle effects, new lighting system, and smooth animations",
    "filesModified": [
      "src/Agent3DFloor.tsx",
      "src/Agent3DFloor.test.tsx"
    ],
    "commitHash": "abc1234",
    "deploymentUrl": "https://agent-floor-3d.vercel.app",
    "testResults": {
      "passed": 12,
      "failed": 0,
      "coverage": 94
    }
  },
  "metrics": {
    "totalCost": 0.0342,
    "totalTokens": 6789,
    "totalDuration": 130000,
    "tokenPrice": 0.000005,
    "avgTokensPerSecond": 52
  },
  "subagentDelegations": []
}
```

---

## 4️⃣ ESTADO EN SUPABASE

### Tabla: `tasks`

```sql
│ id         │ goal                    │ assigned_to │ status     │ progress │ est_cost │ actual_cost │
├────────────┼─────────────────────────┼─────────────┼────────────┼──────────┼──────────┼─────────────┤
│ task_xyz   │ Improve 3D floor        │ orbit       │ EXECUTING  │ 45       │ 0.050    │ 0.0172      │
│ task_abc   │ Fix WebSocket           │ hermes      │ QUEUED     │ 0        │ 0.030    │ 0.000       │
│ task_def   │ Deploy to production    │ orbit       │ QUEUED     │ 0        │ 0.020    │ 0.000       │
│ task_old   │ Review PR               │ hermes      │ COMPLETED  │ 100      │ 0.015    │ 0.0145      │
```

### Tabla: `task_events` (Audit Trail)

```sql
│ id   │ task_id    │ event_type │ agent_from │ agent_to │ metrics              │ created_at          │
├──────┼────────────┼────────────┼────────────┼──────────┼──────────────────────┼─────────────────────┤
│ 1    │ task_xyz   │ DELEGATED  │ hermes     │ orbit    │ {cost: 0}            │ 2026-05-01 10:30:00 │
│ 2    │ task_xyz   │ STARTED    │ orbit      │ orbit    │ {cost: 0.002}        │ 2026-05-01 10:30:05 │
│ 3    │ task_xyz   │ PROGRESS   │ orbit      │ hermes   │ {pct: 45, cost: 0.017}│ 2026-05-01 10:30:35 │
│ 4    │ task_xyz   │ COMPLETED  │ orbit      │ hermes   │ {cost: 0.0342}       │ 2026-05-01 10:32:10 │
```

### Tabla: `agent_capacity`

```sql
│ agent_name │ max_concurrent │ current_tasks │ avg_duration_ms │ reliability │ last_heartbeat      │
├────────────┼────────────────┼───────────────┼─────────────────┼─────────────┼─────────────────────┤
│ hermes     │ 10             │ 2             │ 45000           │ 0.99        │ 2026-05-01 10:33:45 │
│ orbit      │ 5              │ 3             │ 130000          │ 0.98        │ 2026-05-01 10:33:40 │
│ subagent1  │ 3              │ 1             │ 25000           │ 0.95        │ 2026-05-01 10:33:30 │
```

---

## 5️⃣ 3D FLOOR: VISUALIZACIÓN EN TIEMPO REAL

### Current (Antes)
```
🟦 Hermes          🟪 ORBIT
(esferas rotando)
```

### Proposed (Después)
```
┌──────────────────────────────────────────────────────────────────┐
│                      3D FLOOR VISUALIZATION                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ╔════════════════════╗              ╔════════════════════╗    │
│   ║ 🟦 HERMES          ║              ║ 🟪 ORBIT           ║    │
│   ║ Status: PLANNING   ║              ║ Status: EXECUTING  ║    │
│   ║ Queue: 2/10        ║              ║ Queue: 3/5         ║    │
│   ║ Cost: $0.015       ║              ║ Cost: $0.0342      ║    │
│   ╠════════════════════╣              ╠════════════════════╣    │
│   ║ ┌─── Task Queue ──┐║              ║ ┌─── Task Queue ──┐║    │
│   ║ │🟡[45%] Improve 3D│              ║ │🟢[100%] Deploy  │║    │
│   ║ │      floor       │              ║ │   (complete)    │║    │
│   ║ │                  │              ║ │                  │║    │
│   ║ │🟢[QUEUED] Fix    │              ║ │🟡[72%] Code     │║    │
│   ║ │   WebSocket      │              ║ │      refactor    │║    │
│   ║ │                  │              ║ │                  │║    │
│   ║ │                  │              ║ │🟢[QUEUED] Test  │║    │
│   ║ └──────────────────┘║              ║ └──────────────────┘║    │
│   ╚════════════════════╝              ╚════════════════════╝    │
│           ▲                                      ▲                │
│           │                                      │                │
│           └──────────────┬───────────────────────┘                │
│                          │                                        │
│              ════════════ DELEGATION ═════════════                │
│              Line pulses when task active                         │
│              Label: "ORBIT: task_xyz (ETA 120s)"                  │
│                          │                                        │
│   ════════════════════════╧═══════════════════════════════════    │
│                                                                  │
│   💰 COST PARTICLES:                                             │
│      [✓] floating from ORBIT → HERMES: "$0.0172"                │
│      [✓] floating from ORBIT → HERMES: "$0.017"                 │
│                                                                  │
│   📊 METRICS (bottom panel):                                     │
│      Total Cost: $0.0492                                         │
│      Throughput: 2 tasks/min                                     │
│      Avg Duration: 87.5s                                         │
│      Reliability: 98.5%                                          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 6️⃣ FLUJO DE CAPACIDAD & BACKPRESSURE

```
HERMES wants to delegate task:

1. Check ORBIT capacity:
   ├─ max_concurrent = 5
   ├─ current_tasks = 3
   ├─ available = 5 - 3 = 2
   └─ ✅ CAN DELEGATE

2. If available > 0:
   ├─ Create task with status='QUEUED'
   ├─ Emit DELEGATE_TASK
   └─ ORBIT will pick up within 2s (polling)

3. If available == 0 (queue full):
   ├─ Create task with status='BACKPRESSURE'
   ├─ Wait and retry every 5s
   ├─ Alert HERMES: "ORBIT queue full, wait..."
   └─ Escalate to Hermes if timeout > 1 minute

4. If ORBIT offline:
   ├─ Mark task with status='PENDING_ORBIT_RECOVERY'
   ├─ Supabase polling will retry delivery
   ├─ After 3 retries, escalate to Hermes
   └─ Potential failover to alternative executor
```

---

## 7️⃣ COST FLOW & ACCOUNTING

```
Per-Task Cost Tracking:

┌─ Start: est_cost = $0.05 (estimate)
│
├─ During execution (every 5s):
│  └─ Update actual_cost based on tokens_used * token_price
│
├─ On completion:
│  ├─ Set final actual_cost = $0.0342
│  ├─ Calculate variance: $0.0342 / $0.05 = 68% ✅ (under budget)
│  ├─ Emit CostParticle: "$0.0342" (green)
│  └─ Aggregate to agent total: orbit.total_cost += $0.0342
│
└─ Dashboard shows:
   ├─ Per-task cost
   ├─ Per-agent cost (daily/weekly)
   ├─ Budget utilization
   └─ Cost trend (historical)
```

---

## 8️⃣ ROLES COMPARISON TABLE

```
┌──────────────────────┬──────────────────────────┬──────────────────────────┐
│ Responsibility       │ HERMES (Orchestrator)    │ ORBIT (Executor)         │
├──────────────────────┼──────────────────────────┼──────────────────────────┤
│ Planning/Design      │ ✅ YES (owns)            │ ❌ NO                    │
│ Task creation        │ ✅ YES (owns)            │ ❌ NO (receives)         │
│ Task execution       │ ❌ NO                    │ ✅ YES (owns)            │
│ Code generation      │ ❌ NO                    │ ✅ YES (owns)            │
│ Deployment           │ ❌ NO                    │ ✅ YES (owns)            │
│ Monitoring           │ ✅ YES (aggregate)       │ ⚠️ PARTIAL (self)        │
│ Cost tracking        │ ✅ YES (aggregate)       │ ✅ YES (per-task)        │
│ Error handling       │ ✅ YES (retry logic)     │ ✅ YES (report errors)   │
│ Subagent delegation  │ ❌ NO                    │ ✅ YES (owns)            │
│ Decision making      │ ✅ YES                   │ ❌ NO (follows orders)   │
│ Resource allocation  │ ✅ YES (queue mgmt)      │ ⚠️ PARTIAL (capacity)    │
└──────────────────────┴──────────────────────────┴──────────────────────────┘
```

---

## 9️⃣ ERROR SCENARIOS & RECOVERY

### Scenario A: ORBIT Task Timeout (120s)

```
T=0    HERMES delegates "Deploy to Vercel"
T=120  No completion event received
T=121  HERMES emits: TaskTimeoutEvent
       └─ Mark task as FAILED
       └─ Set error_message = "Timeout after 120s"

T=122  Retry logic:
       ├─ retry_count = 0 < max_retries = 3 ✅
       ├─ Create new task (same goal, retry_count=1)
       ├─ Emit DELEGATE_TASK again
       └─ Log to task_events: "RETRY_1"

T=242  Task completes ✅
       └─ Emit CompletionEvent with retry_count=1
```

### Scenario B: ORBIT Offline (WebSocket DOWN, Polling Fails)

```
T=0     HERMES delegates task
T=2     WebSocket DOWN → fallback to Supabase polling
T=4     Polling attempt 1: ❌ ORBIT not responding
T=6     Polling attempt 2: ❌ ORBIT not responding
T=8     Polling attempt 3: ❌ ORBIT not responding (max 3)

T=9     Mark task as PENDING_ORBIT_RECOVERY
        Escalate to HERMES:
        "⚠️ ORBIT offline, task stuck in queue"

T=10    HERMES options:
        ├─ Wait for ORBIT to come back (passive)
        ├─ Delegate to Subagent (active)
        └─ Notify José: "ORBIT is down"

T=300   ORBIT comes back online
        └─ Supabase syncs pending tasks
        └─ ORBIT picks up where it left off
```

### Scenario C: Cost Exceeds Budget

```
Task budget: $0.05
Est: $0.05

During execution:
├─ T=30s: tokens=1200, cost=$0.008 ✅ (16%)
├─ T=60s: tokens=2600, cost=$0.018 ✅ (36%)
├─ T=90s: tokens=4200, cost=$0.029 ✅ (58%)
└─ T=95s: tokens=5400, cost=$0.0540 ❌ (108% → OVER BUDGET!)

HERMES detects overage:
├─ Emit BudgetWarningEvent
├─ Alert: "$0.0540 > $0.050 budget"
├─ Options:
│  ├─ Allow completion (cost variance accepted)
│  └─ Terminate (kill execution, save money)
└─ Log to audit trail for José review
```

---

## 🔟 IMPLEMENTATION PHASES (Detailed)

### Phase 1A: Supabase Schema (2 hours)
```sql
-- Create tables
CREATE TABLE tasks (...)
CREATE TABLE task_events (...)
CREATE TABLE agent_capacity (...)

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY
ALTER TABLE task_events ENABLE ROW LEVEL SECURITY

-- Create policies
CREATE POLICY "allow all for auth'd users" ...

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE tasks
ALTER PUBLICATION supabase_realtime ADD TABLE task_events
```

### Phase 1B: Event System (4 hours)
```typescript
// Hermes
const delegateTask = (goal, context) => {
  const task = createTaskObject(goal, context)
  emit('DELEGATE_TASK', task)
}

// ORBIT
const subscribeToDelegate = () => {
  supabase
    .channel('task_delegation')
    .on('broadcast', { event: 'DELEGATE_TASK' }, (payload) => {
      taskQueue.enqueue(payload.task)
    })
    .subscribe()
}

const executeTaskLoop = async () => {
  while (true) {
    const task = taskQueue.dequeue()
    emit('TASK_STATUS_UPDATE', { taskId: task.id, status: 'EXECUTING' })
    
    const result = await executeTask(task)
    
    emit('EXECUTION_COMPLETE', { taskId: task.id, result })
  }
}
```

### Phase 1C: Dashboard API (3 hours)
```typescript
// Backend
app.get('/api/tasks', async (req, res) => {
  const { agent } = req.query
  const tasks = await supabase
    .from('tasks')
    .select('*')
    .eq('assigned_to', agent)
    .order('priority', { ascending: false })
  res.json(tasks)
})

app.get('/api/metrics/agent/:agent', async (req, res) => {
  const capacity = await supabase
    .from('agent_capacity')
    .select('*')
    .eq('agent_name', req.params.agent)
    .single()
  res.json(capacity)
})
```

---

## 📌 RESUMEN PARA JOSÉ

**¿Cuál es el problema?**
- Hermes y ORBIT hacen trabajo duplicado
- No hay visibilidad de quién tiene qué tarea
- Comunicación lenta (polling)
- No optimizado

**¿Cuál es la solución?**
- Hermes = Planner/Orchestrator (decide QUÉ)
- ORBIT = Executor/Implementer (hace CÓMO)
- Event-driven architecture (WebSocket bilateral)
- Real-time 3D visualization (quién está ocupado, qué cuesta)
- Formal task handoff protocol (estructura, no caos)

**¿Cuánto cuesta?**
- Phase 1-2: 10 horas = ~$0.80
- Phase 3-4: 13 horas = ~$1.20
- Phase 5-6: 10 horas = ~$0.70
- **Total: 33 horas = ~$2.70**

**¿Cuánto se ahorra?**
- Reduce duplicate work: +30% efficiency
- Real-time visibility: +25% speed
- Automatic cost tracking: saves ~1h/week manual accounting
- **ROI: ~8 horas/mes = $0.64/mes ongoing savings**

---

**Status: PLAN READY FOR APPROVAL ✅**
