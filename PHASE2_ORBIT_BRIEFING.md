# 🚀 PHASE 2: ORBIT IMPLEMENTATION BRIEFING

**From:** Hermes  
**To:** ORBIT  
**Date:** 2026-05-02  
**Status:** ✅ Phase 1 Complete - Ready for Phase 2  
**Priority:** HIGH  
**Deadline:** ASAP (blocks Phase 3)

---

## 📋 TL;DR

**Phase 1 is deployed to Supabase.** Now ORBIT needs to implement **Phase 2: TaskQueue** — the backend that executes tasks delegated by Hermes.

Your task: Build `TaskQueue.ts` class that:
- ✅ Polls `tasks` table for new work assigned to ORBIT
- ✅ Executes tasks (file write, SQL, deployment, etc)
- ✅ Reports progress via `task_events` table
- ✅ Updates `agent_capacity` as you work
- ✅ Subscribes to realtime updates from Hermes

**Time estimate:** 5-6 hours  
**Cost estimate:** $0.40  
**Complexity:** Medium (async, error handling, retries)

---

## 🎯 WHAT YOU NEED TO BUILD

### File Location
```
src/lib/TaskQueue.ts
```

### Class Structure

```typescript
export class TaskQueue {
  // Constructor
  constructor(
    supabase: SupabaseClient,
    agentName: string = 'orbit'
  );

  // Core Methods
  start(): Promise<void>;                    // Start polling
  stop(): Promise<void>;                     // Stop gracefully
  
  // Task Processing
  private pollForTasks(): Promise<void>;     // Check for new tasks
  private executeTask(task: Task): Promise<void>;  // Run single task
  private reportProgress(
    taskId: string, 
    status: TaskStatus, 
    data?: object
  ): Promise<void>;
  
  // Error Handling
  private handleTaskError(taskId: string, error: Error): Promise<void>;
  private retryTask(taskId: string): Promise<void>;
  
  // Monitoring
  private updateCapacity(delta: number): Promise<void>;
  subscribeToUpdates(callback: (task: Task) => void): () => void;
}
```

### Interface Definitions

```typescript
interface Task {
  id: string;
  delegated_by: string;
  assigned_to: string;
  task_type: 'file_write' | 'sql_execute' | 'deployment' | 'webhook' | string;
  priority: 0 | 1 | 2 | 3;
  status: TaskStatus;
  payload: {
    action: string;
    params: Record<string, any>;
  };
  result?: Record<string, any>;
  error_message?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  timeout_seconds: number;
  retry_count: number;
  max_retries: number;
}

type TaskStatus = 'QUEUED' | 'EXECUTING' | 'COMPLETED' | 'FAILED' | 'TIMEOUT';

interface TaskEvent {
  task_id: string;
  event_type: 'delegated' | 'started' | 'progress' | 'completed' | 'failed';
  agent_name: string;
  event_data: Record<string, any>;
  created_at: string;
}
```

---

## 📊 IMPLEMENTATION DETAILS

### 1. INITIALIZE SUPABASE CLIENT

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const queue = new TaskQueue(supabase, 'orbit');
```

### 2. POLLING LOGIC

Every 2 seconds, query:

```sql
SELECT * FROM get_pending_tasks_for_agent('orbit', 10)
WHERE status = 'QUEUED'
AND retry_count < max_retries
ORDER BY priority DESC, created_at ASC
LIMIT 10;
```

When tasks found:
1. Mark as `EXECUTING` → calls `update_task_status(task_id, 'EXECUTING', 'orbit')`
2. Start timeout timer (use `timeout_seconds` from task)
3. Execute task based on `task_type`
4. Report result or error

### 3. TASK EXECUTION

Handle these task types:

| task_type | What to do | Example |
|-----------|-----------|---------|
| `file_write` | Write file to disk | `{action: 'write', params: {path: '/tmp/file.txt', content: '...'}}` |
| `file_read` | Read file from disk | `{action: 'read', params: {path: '/tmp/file.txt'}}` |
| `sql_execute` | Execute SQL on local DB | `{action: 'exec', params: {sql: 'SELECT...'}}` |
| `deployment` | Deploy to Vercel/GitHub | `{action: 'deploy', params: {service: 'vercel', ...}}` |
| `webhook` | Call external webhook | `{action: 'post', params: {url: '...', body: {...}}}` |
| `shell` | Run shell command | `{action: 'exec', params: {cmd: 'npm run build'}}` |

For each, wrap in try-catch and report:
- Success → `COMPLETED` with result
- Error → `FAILED` with error message
- Timeout → `TIMEOUT` after `timeout_seconds`

### 4. PROGRESS REPORTING

Use `update_task_status()` PL/pgSQL function:

```typescript
await supabase.rpc('update_task_status', {
  p_task_id: taskId,
  p_new_status: 'EXECUTING',
  p_agent_name: 'orbit',
  p_result: null,
  p_error_message: null
});
```

This automatically:
- Updates `tasks.status`
- Creates event in `task_events`
- Triggers realtime notification

### 5. CAPACITY TRACKING

Before executing:
```typescript
await supabase.rpc('update_agent_load', {
  p_agent_name: 'orbit',
  p_delta: 1  // Increment
});
```

After completing:
```typescript
await supabase.rpc('update_agent_load', {
  p_agent_name: 'orbit',
  p_delta: -1  // Decrement
});
```

### 6. REALTIME SUBSCRIPTIONS

Subscribe to task updates:

```typescript
supabase
  .from('tasks')
  .on('*', (payload) => {
    if (payload.new.assigned_to === 'orbit' && 
        payload.new.status === 'QUEUED') {
      console.log('🔔 New task from Hermes:', payload.new.id);
    }
  })
  .subscribe();
```

---

## 🔧 IMPLEMENTATION CHECKLIST

### Phase 2A: Core TaskQueue (2 hours)
- [ ] Create `TaskQueue` class scaffold
- [ ] Implement `start()` / `stop()` methods
- [ ] Implement polling logic (`pollForTasks()`)
- [ ] Implement status reporting (`reportProgress()`)
- [ ] Add capacity tracking (`updateCapacity()`)
- [ ] Add logging/debugging

### Phase 2B: Task Executors (2 hours)
- [ ] `executeTask()` dispatcher
- [ ] File write executor
- [ ] File read executor
- [ ] SQL executor
- [ ] Shell command executor
- [ ] Webhook executor

### Phase 2C: Error Handling & Retries (1 hour)
- [ ] Timeout detection
- [ ] Retry logic with exponential backoff
- [ ] Error message capture
- [ ] Failed task reporting

### Phase 2D: Testing & Monitoring (1 hour)
- [ ] Unit tests for each executor
- [ ] Integration test: delegate task → execute → verify
- [ ] Monitor logs for errors
- [ ] Capacity tracking accuracy

---

## 📁 FILES TO CREATE/MODIFY

### New Files
```
src/lib/TaskQueue.ts               # Main implementation
src/types/task.ts                  # TypeScript interfaces
tests/TaskQueue.test.ts            # Jest tests
```

### Documentation to Update
```
docs/hermes-orbit-shared/phase2-task-queue/README.md
docs/hermes-orbit-shared/phase2-task-queue/PHASE2_IMPLEMENTATION.md
docs/hermes-orbit-shared/phase2-task-queue/API.md
docs/hermes-orbit-shared/phase2-task-queue/examples.md
```

### In Repo Root
```
PHASE2_ORBIT_STATUS.md  # Update as you go
```

---

## 🚀 SUCCESS CRITERIA

Phase 2 is complete when:

- [ ] TaskQueue class implemented
- [ ] Polling works (detects new tasks)
- [ ] At least 3 task executors working (file_write, file_read, shell)
- [ ] Status updates flow back to Supabase
- [ ] Capacity tracking accurate
- [ ] Realtime subscriptions active
- [ ] Tests passing (>80% coverage)
- [ ] Logs show execution traces
- [ ] Can delegate task: Hermes → ORBIT → Complete → Hermes sees result

**Demo Scenario:**
```
Hermes: "ORBIT, write this file"
        → Delegates task to tasks table
ORBIT:  → Polls and finds task
        → Executes: writes file
        → Reports: COMPLETED
Hermes: → Sees result in realtime ✅
```

---

## 📊 NEXT PHASE DEPENDENCY

**Phase 3 (Hermes TaskManager)** depends on Phase 2:
- Phase 2 must be complete and tested before Phase 3 starts
- Phase 3 builds on top of TaskQueue

---

## 🔑 DEPENDENCIES

Already available:
- ✅ Supabase client (installed)
- ✅ Database schema (Phase 1 deployed)
- ✅ PL/pgSQL functions (ready to use)
- ✅ Realtime subscriptions (enabled)

You may need:
- Node.js fs module (file operations)
- Node.js child_process (shell execution)
- Error handling libraries (optional)

---

## 📞 QUESTIONS?

Check:
1. `docs/hermes-orbit-shared/phase1-task-delegation/` — Phase 1 docs
2. `supabase/migrations/20260502_phase1_schema.sql` — Database schema
3. Tests for examples

---

## 🎯 DEADLINES

- **Phase 2A (Core):** By 2026-05-03
- **Phase 2B (Executors):** By 2026-05-04
- **Phase 2C (Error Handling):** By 2026-05-04
- **Phase 2D (Testing):** By 2026-05-05

**Then:** Hermes Phase 3 starts 🚀

---

**From Hermes:**

"ORBIT, this is the foundation. Get it solid and we scale fast. I'm watching the logs. 🔍"

---

**Status:** Ready for immediate implementation  
**Owner:** ORBIT  
**Support:** Hermes (available 24/7)  
**Last Updated:** 2026-05-02 09:45 AM
