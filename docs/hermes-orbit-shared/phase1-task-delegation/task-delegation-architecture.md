# 📋 PLAN: Arquitectura de Delegación de Tareas — Hermes ↔ ORBIT

**Fecha:** 2026-05-01  
**Alcance:** Rediseñar task delegation, roles, comunicación y visualización en 3D floor  
**Objetivo:** Evitar duplicación, optimizar throughput, visibilidad total

---

## 🎯 EJECUTIVO

**Problema actual:**
- Hermes y ORBIT comparten responsabilidades sin límites claros → duplicación de trabajo
- No hay visualización de quién tiene qué tarea → congestión invisible
- Comunicación es unidireccional (Telegram) → no bilateral en el floor 3D
- WebSocket offline → fallback a polling lento

**Solución:**
1. **Hermes** = Orchestrator (planificación, coordinación, decisiones)
2. **ORBIT** = Executor (ejecución de tareas, código, deployment)
3. **Handoff Protocol** = Formal task passa con metadata completa
4. **3D Visualization** = Queue de tareas por agente en tiempo real
5. **Communication Layer** = WebSocket (bilateral) + Supabase fallback

---

## 📊 ANÁLISIS DE ROLES ACTUALES

### Hermes (Current)
```
✅ Orquestación de subagents
✅ Planning y decisiones estratégicas
❌ Ejecución de código
❌ Devops/deployment
❓ Debugging de issues
```

### ORBIT (Current)
```
❓ Qué hace exactamente?
❌ No bien definido
❌ Probablemente subutilizado
```

**→ PROBLEMA:** Falta claridad en ORBIT.

---

## 🏗️ ARQUITECTURA PROPUESTA

### NIVEL 1: Role Definitions

#### **HERMES** (Orchestrator / Planning Tier)
**Responsabilidades:**
- Planning de sprints y tareas
- Decisiones arquitectónicas
- Coordinación entre Orbit y subagents
- Reportes y análisis
- Control de costos
- Error handling y re-routing

**NO hace:**
- Ejecución de código
- Deployments
- Infrastructure management

**Costo aproximado:** ~$0.01-0.02 por tarea (Haiku cheap inference)

---

#### **ORBIT** (Executor / Implementation Tier)
**Responsabilidades:**
- Ejecución de tareas asignadas por Hermes
- Code generation / refactoring
- Testing y CI/CD
- Infrastructure provisioning
- Debugging de issues técnicas
- Notificación de estado a Hermes

**NO hace:**
- Decisiones estratégicas
- Planning de sprints
- Coordinación multi-agente

**Costo aproximado:** ~$0.03-0.05 por tarea (Sonnet expensive but fast)

---

#### **Subagents** (Specialist Workers)
- Tareas específicas (data processing, analytics, etc.)
- Delegadas por ORBIT
- Reportan a ORBIT, no a Hermes directamente

---

### NIVEL 2: Task Delegation Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                       HERMES (Orchestrator)                      │
│                                                                  │
│  1. Plan task                                                   │
│  2. Check ORBIT capacity                                        │
│  3. Create Task object                                          │
│  4. → Send DELEGATE_TASK event to ORBIT                         │
│  5. Monitor progress                                            │
│  6. Handle timeouts/errors                                      │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                    HANDOFF Protocol
                    (WebSocket + Supabase)
                             ↓
┌──────────────────────────────────────────────────────────────────┐
│                      ORBIT (Executor)                            │
│                                                                  │
│  1. Receive DELEGATE_TASK event                                 │
│  2. Dequeue from task queue                                     │
│  3. Check preconditions (env vars, deps, etc.)                  │
│  4. Execute task (code gen, testing, deploy)                   │
│  5. → Report status updates back to HERMES                      │
│  6. On completion: Push result + metrics to shared DB           │
│  7. Loop back to queue                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

### NIVEL 3: Communication Protocol

#### **Event Types** (Bidirectional via WebSocket)

```typescript
// HERMES → ORBIT
type DelegateTaskEvent = {
  id: string
  type: 'DELEGATE_TASK'
  timestamp: number
  task: {
    goal: string
    context: string
    deadline?: number
    priority: 'LOW' | 'MEDIUM' | 'HIGH'
    toolsets: string[]
    estimatedCost?: number
  }
  metadata: {
    source: 'planning' | 'error_recovery' | 'user_request'
    retryCount: number
  }
}

// ORBIT → HERMES
type TaskStatusEvent = {
  id: string
  type: 'TASK_STATUS_UPDATE'
  taskId: string
  status: 'QUEUED' | 'EXECUTING' | 'COMPLETED' | 'FAILED'
  progress: {
    percent: number
    currentStep: string
    estimatedTimeRemaining: number
  }
  metrics: {
    tokensUsed: number
    costAccrued: number
    wallTimeMs: number
  }
  result?: {
    success: boolean
    output: string
    error?: string
  }
}

// ORBIT → HERMES (Async handoff)
type ExecutionCompleteEvent = {
  id: string
  type: 'EXECUTION_COMPLETE'
  taskId: string
  outcome: 'SUCCESS' | 'FAILURE' | 'TIMEOUT'
  result: any
  metrics: {
    totalCost: number
    totalTokens: number
    duration: number
  }
  subagentDelegations?: DelegateTaskEvent[]
}
```

---

### NIVEL 4: Task Queue & State Management

#### **Data Model in Supabase**

```sql
-- Tasks table
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Task metadata
  goal TEXT NOT NULL,
  context TEXT NOT NULL,
  priority CHAR(1) CHECK (priority IN ('H', 'M', 'L')),
  
  -- Assignment & status
  assigned_to VARCHAR(20) NOT NULL, -- 'hermes' | 'orbit' | 'subagent_1' | etc
  status VARCHAR(20) DEFAULT 'QUEUED', -- QUEUED, EXECUTING, COMPLETED, FAILED
  progress_percent INT DEFAULT 0,
  
  -- Cost tracking
  estimated_cost DECIMAL(10, 6),
  actual_cost DECIMAL(10, 6) DEFAULT 0,
  
  -- Timing
  deadline_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Results
  result TEXT,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  
  -- Relationships
  parent_task_id UUID, -- For sub-delegation
  created_by VARCHAR(20) -- Who created this task
);

-- Events table (for audit trail)
CREATE TABLE task_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP DEFAULT NOW(),
  
  task_id UUID NOT NULL REFERENCES tasks(id),
  event_type VARCHAR(50), -- DELEGATED, STARTED, PROGRESS, COMPLETED, FAILED
  
  agent_from VARCHAR(20),
  agent_to VARCHAR(20),
  
  metrics JSONB, -- {tokensUsed, costAccrued, etc}
  
  payload JSONB -- Full event data
);

-- Agent capacity table
CREATE TABLE agent_capacity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_name VARCHAR(20) UNIQUE,
  max_concurrent_tasks INT DEFAULT 5,
  current_tasks INT DEFAULT 0,
  avg_task_duration_ms INT,
  reliability_score DECIMAL(3,2) DEFAULT 1.0 -- 0-1
);
```

---

## 🎨 VISUALIZACIÓN EN 3D FLOOR

### Current: Just colored spheres
### Proposed: Status visualization + task queue

```
┌─────────────────────────────────────────────┐
│  🟦 HERMES (Orchestrator)                  │
│  Position: [-10, 5, 0]                      │
│                                             │
│  Status: PLANNING/READY                    │
│  Current tasks: 2/5                        │
│  Queue: [Plan sprint, Review PR, ...]      │
│  Cost: $0.0125                             │
│                                             │
│  ├─ 📌 Task 1: "Plan SPRINT 4"             │
│  │  └─ Status: IN_PROGRESS (45%)           │
│  └─ 📌 Task 2: "Review subagent output"    │
│     └─ Status: QUEUED (0%)                 │
└─────────────────────────────────────────────┘
                    ▼ DELEGATE (WebSocket)
┌─────────────────────────────────────────────┐
│  🟪 ORBIT (Executor)                       │
│  Position: [10, 5, 0]                       │
│                                             │
│  Status: EXECUTING                         │
│  Current tasks: 3/5                        │
│  Queue: [Deploy, Test, Refactor, ...]     │
│  Cost: $0.0075                             │
│                                             │
│  ├─ 🔨 Task 1: "Deploy to Vercel"         │
│  │  └─ Status: EXECUTING (72%) [ETA: 30s] │
│  ├─ 🧪 Task 2: "Run tests"                │
│  │  └─ Status: QUEUED (0%)                 │
│  └─ 🔧 Task 3: "Code refactor"            │
│     └─ Status: QUEUED (0%)                 │
└─────────────────────────────────────────────┘
```

---

### 3D Visual Elements

#### **Sphere Appearance**
```
HERMES (Cyan #00ffff):
  - Inner glow: bright cyan
  - Outer ring: rotating orbital
  - Tasks label above: floating text with queue count
  - Color intensity ∝ CPU load

ORBIT (Magenta #ff00ff):
  - Inner glow: bright magenta
  - Outer ring: different rotation speed
  - Tasks label above: floating text with execution %
  - Color intensity ∝ memory usage
```

#### **Connection Lines (Delegation)**
```
When HERMES delegates to ORBIT:
  - Line appears: cyan → magenta
  - Animation: pulse along the line
  - Label on line: "DELEGATE: task_id"
  - On completion: line fades, shows cost

Task queue visualization:
  - Small boxes stacked above each agent
  - Color codes: 🟢 QUEUED, 🟡 EXECUTING, 🔵 COMPLETED, 🔴 FAILED
  - Height = remaining time
```

#### **Particles & Effects**
```
Cost particles:
  - Emitted when task completes
  - Float from executor → Hermes (cost aggregation)
  - Label: "$0.0050" (task cost)
  - Color: green if cost < budget, red if over

Error particles:
  - Emitted on FAILED status
  - Red sparks from failed agent
  - Label: "ERROR: timeout"
```

---

## 🔄 COMMUNICATION LAYERS (Fallback Chain)

```
Priority 1 (Real-time):
├─ WebSocket (Supabase realtime)
│  └─ If UP: bilateral events <100ms latency
│
Priority 2 (Near-real-time):
├─ Supabase polling
│  └─ If WebSocket DOWN: poll tasks table every 2s
│
Priority 3 (Eventual consistency):
└─ HTTP webhooks
   └─ Fallback if both above fail (degraded mode)
```

---

## 📦 IMPLEMENTATION ROADMAP

### Phase 1: Backend Data Model (Week 1)
- [ ] Create tasks, task_events, agent_capacity tables in Supabase
- [ ] Add RLS policies for safety
- [ ] Set up realtime subscriptions
- [ ] Implement task queue service abstract class

**Effort:** 4 hours  
**Cost:** ~$0.20

---

### Phase 2: Event System (Week 1-2)
- [ ] Implement DelegateTaskEvent / TaskStatusEvent types
- [ ] Create EventBus in Hermes (publish DELEGATE_TASK)
- [ ] Create EventListener in ORBIT (subscribe, dequeue, execute)
- [ ] Add retry logic & timeout handling

**Effort:** 6 hours  
**Cost:** ~$0.50

---

### Phase 3: Dashboard Backend (Week 2)
- [ ] Create API endpoints:
  - GET `/api/tasks?agent=orbit` → task queue
  - GET `/api/metrics?agent=hermes` → capacity + cost
  - POST `/api/tasks/{id}/status` → status update
- [ ] Implement cost aggregation
- [ ] Add real-time subscriptions to Supabase events

**Effort:** 5 hours  
**Cost:** ~$0.40

---

### Phase 4: 3D Floor Visualization (Week 2-3)
- [ ] Fetch task queues from backend
- [ ] Render task boxes above agent spheres
- [ ] Draw delegation lines (Hermes → ORBIT)
- [ ] Animate progress bars inside task boxes
- [ ] Add cost particles on task completion

**Effort:** 8 hours  
**Cost:** ~$0.80 (lots of THREE.js work)

---

### Phase 5: Integration & Testing (Week 3)
- [ ] E2E test: Hermes delegate → ORBIT execute → update dashboard
- [ ] Stress test: 100 tasks in queue
- [ ] Cost tracking validation
- [ ] WebSocket failover testing

**Effort:** 6 hours  
**Cost:** ~$0.40

---

### Phase 6: Production Hardening (Week 4)
- [ ] Error recovery & dead-letter queues
- [ ] Monitoring & alerting
- [ ] Documentation
- [ ] Deployment to Vercel + Supabase

**Effort:** 4 hours  
**Cost:** ~$0.30

---

## 💾 DATA FLOW EXAMPLE

```
┌─────────────────────────────────────────────────────────────────┐
│ User: "José" → Telegram: "Mejorar el floor"                   │
└────────────────────┬────────────────────────────────────────────┘
                     │
    ┌────────────────▼──────────────────┐
    │ HERMES receives user request      │
    │ 1. Parse intent                   │
    │ 2. Plan: "Modify Agent3DFloor.tsx"│
    │ 3. Create Task object             │
    │ 4. Capacity check: ORBIT         │
    │    → ORBIT.current_tasks = 2     │
    │    → ORBIT.max_concurrent = 5    │
    │    → ✅ Can accept               │
    │ 5. Emit DELEGATE_TASK event      │
    └────────────────┬──────────────────┘
                     │
                     ↓ WebSocket
    ┌────────────────────────────────────────┐
    │ Supabase realtime channel              │
    │ Channel: 'task_delegation'             │
    │ Event: DELEGATE_TASK (serialized)      │
    └────────────────┬───────────────────────┘
                     │
                     ↓ Bilateral (if WebSocket UP)
    ┌────────────────────────────────────────┐
    │ ORBIT listener subscribed              │
    │ Receives: DelegateTaskEvent            │
    │ Task queue: [existing..., new_task]   │
    │ Insert into tasks table                │
    │ → status = 'QUEUED'                   │
    └────────────────┬───────────────────────┘
                     │
    ┌────────────────▼───────────────────────┐
    │ ORBIT worker (polling queue)           │
    │ Dequeues task                          │
    │ INSERT task_events row                 │
    │ → status = 'EXECUTING'                │
    │ START CODE EXECUTION                  │
    └────────────────┬───────────────────────┘
                     │
                     ├─ Every 5s:
                     │  └─ Emit TaskStatusEvent
                     │     (progress: 25%, cost: $0.01)
                     │
                     ├─ On completion:
                     │  ├─ Emit ExecutionCompleteEvent
                     │  ├─ UPDATE tasks SET status='COMPLETED'
                     │  └─ Emit CostParticle event for Dashboard
                     │
                     └─ Dashboard subscribes:
                        ├─ Realtime updates to 3D floor
                        ├─ Task queue visualization updates
                        ├─ Cost particle animation
                        └─ Hermes shows in UI: "Task complete, $0.0342"
```

---

## 🚀 QUICK START CHECKLIST

```
PHASE 0 (Today - Clarification):
☐ Confirm Hermes role = Orchestrator
☐ Confirm ORBIT role = Executor
☐ Confirm subagent delegation = ORBIT responsibility
☐ Define task types (code, planning, testing, deployment)

PHASE 1 (This week):
☐ Create Supabase schema (tasks, task_events, agent_capacity)
☐ Implement EventBus in Hermes
☐ Implement EventListener in ORBIT
☐ Test one E2E delegation cycle

PHASE 2-6 (Next 3 weeks):
☐ Dashboard backend (API + subscriptions)
☐ 3D floor visualization
☐ Integration testing
☐ Production hardening
```

---

## ❓ KEY QUESTIONS FOR JOSÉ

1. **ORBIT Capabilities:** ¿ORBIT tiene acceso a Vercel, GitHub, CLI tools? ¿O es solo inference?
2. **Subagent Model:** ¿Subagents siempre delegados por ORBIT, o a veces directo por Hermes?
3. **Cost Attribution:** ¿Cómo contabilizamos costos si ORBIT delega a Subagent?
   - A: Hermes → ORBIT (cost A) → Subagent (cost B), ¿total es A+B?
4. **Timeout Policy:** ¿Cuál es el timeout default por task? (30s, 5min, 10min?)
5. **Priority Queue:** ¿Implementar priority-based scheduling o FIFO?
6. **Monitoring:** ¿Alertas si un agent está stuck/overloaded?

---

## 📊 EXPECTED OUTCOMES

| Metric | Before | After |
|--------|--------|-------|
| Task duplication | ~30% | <5% |
| Visibility | Text only | Real-time 3D + metrics |
| Delegation latency | ~2s (polling) | <100ms (WebSocket) |
| Throughput | Unknown | Measured & optimized |
| Cost accountability | Manual | Automatic per-task |
| Error recovery | Manual | Automatic with retries |

---

## 🔗 DEPENDENCIES

- [x] Supabase (3 proyectos existentes)
- [x] WebSocket (needs Supabase realtime fix)
- [x] THREE.js (3D floor already using)
- [ ] Task queue abstraction (custom built)
- [ ] Event system (custom built)
- [ ] Monitoring dashboard (in this plan)

---

**Status:** 📋 PLAN READY FOR REVIEW  
**Next:** José clarifies key questions → Sprint planning → Phase 1 kickoff
