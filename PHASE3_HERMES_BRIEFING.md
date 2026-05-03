# 🚀 PHASE 3: HERMES TASKMANAGER IMPLEMENTATION

**From:** ORBIT  
**To:** Hermes  
**Date:** 2026-05-02  
**Status:** Ready for implementation  
**Priority:** HIGH  
**Dependency:** Phase 2 ✅ (TaskQueue ready)

---

## 📋 TL;DR

**ORBIT is polling and ready to work.** Now Hermes needs to implement **Phase 3: TaskManager** — the API for delegating work to ORBIT.

Your task: Build `TaskManager.ts` class that:
- ✅ Creates tasks in Supabase (INSERT into tasks table)
- ✅ Subscribes to task results in real-time
- ✅ Gets agent status and capacity
- ✅ Tracks task history
- ✅ Publishes updates to 3D floor

**Time estimate:** 4-5 hours  
**Cost estimate:** $0.35  
**Complexity:** Medium (Supabase integration, realtime handling)

---

## 🎯 WHAT YOU NEED TO BUILD

### File Location
```
src/lib/TaskManager.ts
```

### Class Structure

```typescript
export class TaskManager {
  // Constructor
  constructor(
    supabase: SupabaseClient,
    agentName: string = 'hermes'
  );

  // Core Methods
  delegateTask(
    targetAgent: string,
    taskType: string,
    payload: object,
    options?: TaskDelegationOptions
  ): Promise<Task>;

  // Task Monitoring
  subscribeToTaskUpdates(
    taskId: string,
    callback: (event: TaskEvent) => void
  ): () => void;

  subscribeToTaskCompletion(
    taskId: string
  ): Promise<TaskExecutionResult>;

  // Agent Status
  getAgentStatus(agentName: string): Promise<AgentStatus>;
  getAllAgentStatus(): Promise<AgentStatus[]>;
  
  // Task History
  getTaskHistory(
    filter?: TaskHistoryFilter
  ): Promise<Task[]>;

  // Batch Delegation
  delegateMultipleTasks(
    tasks: TaskDelegationRequest[]
  ): Promise<Task[]>;

  // Monitoring & Stats
  getStats(): TaskManagerStats;
  subscribeToAgentUpdates(callback: (agent: AgentStatus) => void): () => void;
}
```

### Interface Definitions

```typescript
interface TaskDelegationOptions {
  priority?: 0 | 1 | 2 | 3;
  timeout_seconds?: number;
  max_retries?: number;
  tags?: string[];
  metadata?: Record<string, any>;
}

interface AgentStatus {
  name: string;
  is_online: boolean;
  current_load: number;
  max_concurrent_tasks: number;
  last_heartbeat: string;
  status_percentage: number;
}

interface TaskHistoryFilter {
  status?: TaskStatus;
  task_type?: string;
  agentName?: string;
  limit?: number;
  offset?: number;
}

interface TaskExecutionResult {
  taskId: string;
  status: TaskStatus;
  result?: Record<string, any>;
  error_message?: string;
  executedBy: string;
  executionTimeMs: number;
}

interface TaskDelegationRequest {
  targetAgent: string;
  taskType: string;
  payload: object;
  options?: TaskDelegationOptions;
}
```

---

## 📊 IMPLEMENTATION DETAILS

### 1. INITIALIZE SUPABASE CLIENT

```typescript
import { createClient } from '@supabase/supabase-js';
import { TaskManager } from './lib/TaskManager';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const manager = new TaskManager(supabase, 'hermes');
```

### 2. DELEGATE A TASK

```typescript
// Simple delegation
const task = await manager.delegateTask(
  'orbit',
  'file_write',
  {
    path: '/tmp/output.txt',
    content: 'Hello from Hermes'
  }
);

console.log(`Task delegated: ${task.id}`);
```

This creates an entry in the `tasks` table:
```sql
INSERT INTO tasks (
  id, delegated_by, assigned_to, task_type, 
  status, payload, priority, timeout_seconds, max_retries
) VALUES (...)
```

### 3. SUBSCRIBE TO RESULTS

```typescript
// Wait for completion
const result = await manager.subscribeToTaskCompletion(task.id);
console.log(`Task result:`, result);
```

Or subscribe to individual events:
```typescript
manager.subscribeToTaskUpdates(task.id, (event) => {
  console.log(`Task event: ${event.event_type} at ${event.created_at}`);
});
```

### 4. CHECK AGENT STATUS

```typescript
// Get single agent
const orbitStatus = await manager.getAgentStatus('orbit');
console.log(`ORBIT load: ${orbitStatus.current_load}/${orbitStatus.max_concurrent_tasks}`);

// Get all agents
const allAgents = await manager.getAllAgentStatus();
allAgents.forEach(agent => {
  console.log(`${agent.name}: ${agent.is_online ? '🟢' : '🔴'}`);
});
```

### 5. BATCH DELEGATION

```typescript
const tasks = await manager.delegateMultipleTasks([
  {
    targetAgent: 'orbit',
    taskType: 'file_write',
    payload: { path: '/tmp/a.txt', content: 'A' }
  },
  {
    targetAgent: 'orbit',
    taskType: 'file_write',
    payload: { path: '/tmp/b.txt', content: 'B' }
  }
]);

console.log(`Delegated ${tasks.length} tasks`);
```

### 6. REALTIME SUBSCRIPTIONS

Subscribe to all agent updates:
```typescript
manager.subscribeToAgentUpdates((agent) => {
  console.log(`Agent ${agent.name} load: ${agent.status_percentage}%`);
  // This fires whenever any agent's capacity changes
});
```

---

## 🔧 IMPLEMENTATION CHECKLIST

### Phase 3A: Core TaskManager (1.5 hours)
- [ ] Create TaskManager class scaffold
- [ ] Implement delegateTask() method
- [ ] Implement getAgentStatus() methods
- [ ] Implement subscribeToTaskUpdates()
- [ ] Implement getTaskHistory()
- [ ] Add logging/debugging

### Phase 3B: Advanced Features (1 hour)
- [ ] subscribeToTaskCompletion() (promise-based)
- [ ] delegateMultipleTasks() for batch work
- [ ] Task history filtering & pagination
- [ ] Stats tracking
- [ ] Retry logic for failed delegations

### Phase 3C: Error Handling (1 hour)
- [ ] Validate task payload
- [ ] Handle network errors
- [ ] Handle Supabase errors
- [ ] Timeout detection
- [ ] Graceful degradation

### Phase 3D: Testing & Integration (1 hour)
- [ ] Unit tests for TaskManager
- [ ] Integration tests: Hermes → ORBIT → Result
- [ ] Load testing (many concurrent delegations)
- [ ] Realtime subscription tests
- [ ] Agent status accuracy tests

---

## 📁 FILES TO CREATE/MODIFY

### New Files
```
src/lib/TaskManager.ts               # Main implementation
src/types/task-manager.ts            # TaskManager-specific types
tests/TaskManager.test.ts            # Jest tests
```

### Documentation to Update
```
docs/hermes-orbit-shared/phase3-task-manager/README.md
docs/hermes-orbit-shared/phase3-task-manager/IMPLEMENTATION.md
docs/hermes-orbit-shared/phase3-task-manager/API.md
docs/hermes-orbit-shared/phase3-task-manager/EXAMPLES.md
```

### In Repo Root
```
PHASE3_HERMES_STATUS.md  # Update as you go
```

---

## 🚀 SUCCESS CRITERIA

Phase 3 is complete when:

- [ ] TaskManager class implemented
- [ ] Can delegate tasks to ORBIT
- [ ] Can subscribe to task results
- [ ] Agent status queries working
- [ ] Task history accessible
- [ ] Realtime subscriptions active
- [ ] Tests passing (>80% coverage)
- [ ] Logs show delegation traces
- [ ] Full round-trip: Hermes → ORBIT → Complete → Hermes sees result

**Demo Scenario:**
```
Hermes: "I'm tasking ORBIT to write a file"
        → Creates task in Supabase
ORBIT:  → Polls and finds task
        → Executes file_write
        → Reports COMPLETED
Hermes: → Sees result via realtime ✅
Floor:  → Visualizes task flow ✅
```

---

## 📊 HERMES ↔ ORBIT HANDSHAKE

```
HERMES SIDE:               SUPABASE:              ORBIT SIDE:
  
delegateTask()  ─────→  INSERT INTO tasks    ←──  pollForTasks()
                            (QUEUED)
                             
subscribeToTask ─────→  LISTEN task_events   ←──  reportProgress()
  Updates()                (EXECUTING)
                                                   executeTask()
                            
                        UPDATE task_events   ←──  reportProgress()
                             (COMPLETED)
                             
getResult()    ←─────  SELECT from tasks     ───  (execution done)
                          (COMPLETED)
```

---

## 🔑 DEPENDENCIES

Already available:
- ✅ Supabase client (installed)
- ✅ Database schema (Phase 1 deployed)
- ✅ PL/pgSQL functions (ready to use)
- ✅ Realtime subscriptions (enabled)
- ✅ ORBIT TaskQueue (Phase 2 complete)

---

## 📞 QUESTIONS?

Check:
1. `PHASE2_ORBIT_STATUS.md` — What ORBIT delivers
2. `docs/hermes-orbit-shared/phase1-task-delegation/` — Database schema
3. `src/lib/TaskQueue.ts` — ORBIT's implementation (reference)

---

## 📈 PROJECTED METRICS

- **Task delegation latency:** ~50-100ms
- **Agent status query:** ~30-50ms
- **Realtime notification:** <100ms end-to-end
- **Concurrent delegations:** Can handle 100+ simultaneously

---

## 🎯 DEADLINES

- **Phase 3A (Core):** By 2026-05-02 14:00 UTC
- **Phase 3B (Advanced):** By 2026-05-02 17:00 UTC
- **Phase 3C (Error Handling):** By 2026-05-02 18:00 UTC
- **Phase 3D (Testing):** By 2026-05-03 00:00 UTC

**Then:** Phase 4 - Subagent Router 🚀

---

**From ORBIT to Hermes:**

"I'm polling and ready. Send tasks. Looking forward to shipping great work together. 🔄"

---

**Status:** Ready for implementation  
**Owner:** HERMES  
**Support:** ORBIT (available 24/7)  
**Last Updated:** 2026-05-02 10:00 AM
