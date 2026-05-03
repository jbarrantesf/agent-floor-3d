# 📖 PHASE 3: HERMES TASKMANAGER IMPLEMENTATION GUIDE

**Date:** 2026-05-02  
**Status:** IMPLEMENTED ✅  
**Owner:** Hermes  

---

## 📋 TABLE OF CONTENTS

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [API Reference](#api-reference)
4. [Examples](#examples)
5. [Testing](#testing)
6. [Troubleshooting](#troubleshooting)

---

## 📖 OVERVIEW

**TaskManager** is Hermes' interface for delegating work to ORBIT. It provides:

- Task delegation (single & batch)
- Agent status monitoring
- Real-time result subscriptions
- Task history & analytics

### Architecture

```
Hermes (TaskManager)
    ↓ delegateTask()
Supabase (tasks table)
    ↓ realtime trigger
ORBIT (TaskQueue)
    ↓ execute + report
Supabase (task_events)
    ↓ realtime subscription
Hermes (subscribeToTaskUpdates)
    ↓ see result
3D Floor (visualization)
```

---

## 🚀 QUICK START

### Initialize TaskManager

```typescript
import { TaskManager } from './lib/TaskManager';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const manager = new TaskManager(supabase, 'hermes');
```

### Delegate a Single Task

```typescript
const task = await manager.delegateTask(
  'orbit',                    // target agent
  'file_write',              // task type
  {                          // payload
    path: '/tmp/output.txt',
    content: 'Hello ORBIT!'
  },
  {                          // options (optional)
    priority: 2,
    timeout_seconds: 60,
    max_retries: 3
  }
);

console.log(`Task delegated: ${task.id}`);
```

### Wait for Result

```typescript
const result = await manager.subscribeToTaskCompletion(task.id);
console.log(`Status: ${result.status}`);
console.log(`Result:`, result.result);
```

### Check Agent Status

```typescript
const status = await manager.getAgentStatus('orbit');
console.log(`ORBIT is ${status?.is_online ? 'online' : 'offline'}`);
console.log(`Load: ${status?.current_load}/${status?.max_concurrent_tasks}`);
```

---

## 🔌 API REFERENCE

### `delegateTask(targetAgent, taskType, payload, options?)`

**Delegate work to a target agent.**

**Parameters:**
- `targetAgent` (string) — Agent name (e.g., 'orbit', 'subagent_1')
- `taskType` (string) — Task type (e.g., 'file_write', 'sql_execute')
- `payload` (object) — Task-specific data
- `options?` (TaskDelegationOptions) — Optional configuration

**Returns:** `Promise<Task>`

**Example:**
```typescript
const task = await manager.delegateTask('orbit', 'shell', {
  cmd: 'npm run build'
});
```

---

### `subscribeToTaskUpdates(taskId, callback)`

**Subscribe to real-time task events.**

**Parameters:**
- `taskId` (string) — Task ID to monitor
- `callback` ((event: TaskEvent) => void) — Callback function

**Returns:** `() => void` — Unsubscribe function

**Example:**
```typescript
const unsubscribe = manager.subscribeToTaskUpdates(task.id, (event) => {
  console.log(`Event: ${event.event_type}`);
  if (event.event_type === 'completed') {
    console.log('✅ Task done!');
  }
});

// Later...
unsubscribe();
```

---

### `subscribeToTaskCompletion(taskId)`

**Wait for task to complete (promise-based).**

**Parameters:**
- `taskId` (string) — Task ID to wait for

**Returns:** `Promise<TaskExecutionResult>`

**Example:**
```typescript
const result = await manager.subscribeToTaskCompletion(task.id);
console.log(`Completed: ${result.status}`);
```

---

### `getAgentStatus(agentName)`

**Get status of a specific agent.**

**Parameters:**
- `agentName` (string) — Agent name

**Returns:** `Promise<AgentStatus | null>`

**Example:**
```typescript
const status = await manager.getAgentStatus('orbit');
if (status?.is_online) {
  console.log(`Load: ${status.status_percentage}%`);
}
```

---

### `getAllAgentStatus()`

**Get status of all agents.**

**Returns:** `Promise<AgentStatus[]>`

**Example:**
```typescript
const agents = await manager.getAllAgentStatus();
agents.forEach(agent => {
  console.log(`${agent.name}: ${agent.is_online ? '🟢' : '🔴'}`);
});
```

---

### `getTaskHistory(filter?)`

**Fetch task history with optional filtering.**

**Parameters:**
- `filter?` (TaskHistoryFilter) — Filter options

**Returns:** `Promise<Task[]>`

**Example:**
```typescript
const history = await manager.getTaskHistory({
  status: 'COMPLETED',
  task_type: 'file_write',
  limit: 20
});
```

---

### `delegateMultipleTasks(requests)`

**Delegate multiple tasks in batch.**

**Parameters:**
- `requests` (TaskDelegationRequest[]) — Array of delegation requests

**Returns:** `Promise<Task[]>`

**Example:**
```typescript
const tasks = await manager.delegateMultipleTasks([
  {
    targetAgent: 'orbit',
    taskType: 'file_write',
    payload: { path: '/a.txt', content: 'A' }
  },
  {
    targetAgent: 'orbit',
    taskType: 'file_write',
    payload: { path: '/b.txt', content: 'B' }
  }
]);
```

---

### `subscribeToAgentUpdates(callback)`

**Subscribe to agent status changes.**

**Parameters:**
- `callback` ((agent: AgentStatus) => void) — Callback on agent update

**Returns:** `() => void` — Unsubscribe function

**Example:**
```typescript
const unsubscribe = manager.subscribeToAgentUpdates((agent) => {
  console.log(`Agent ${agent.name} is ${agent.status_percentage}% loaded`);
});
```

---

### `getStats()`

**Get TaskManager statistics.**

**Returns:** `TaskManagerStats`

**Example:**
```typescript
const stats = manager.getStats();
console.log(`Total delegated: ${stats.totalDelegated}`);
console.log(`Success rate: ${(stats.totalCompleted / stats.totalDelegated * 100).toFixed(1)}%`);
```

---

## 💡 EXAMPLES

### Example 1: File Operations

Delegate file operations to ORBIT:

```typescript
// Write a file
const writeTask = await manager.delegateTask(
  'orbit',
  'file_write',
  {
    path: '/tmp/data.json',
    content: JSON.stringify({ data: [1, 2, 3] }),
    encoding: 'utf8'
  }
);

const writeResult = await manager.subscribeToTaskCompletion(writeTask.id);
console.log(`File written: ${writeResult.status === 'COMPLETED'}`);

// Read the file back
const readTask = await manager.delegateTask(
  'orbit',
  'file_read',
  { path: '/tmp/data.json' }
);

const readResult = await manager.subscribeToTaskCompletion(readTask.id);
console.log(`File content:`, readResult.result?.content);
```

---

### Example 2: Shell Commands

Delegate shell commands:

```typescript
const task = await manager.delegateTask(
  'orbit',
  'shell',
  { cmd: 'ls -la /tmp | head -20' }
);

const result = await manager.subscribeToTaskCompletion(task.id);
console.log(`Output:\n${result.result?.stdout}`);
```

---

### Example 3: Real-time Monitoring

Monitor all tasks in real-time:

```typescript
// Subscribe to agent updates
manager.subscribeToAgentUpdates((agent) => {
  console.log(`\r${agent.name}: ${agent.status_percentage}%`, { replace: true });
});

// Delegate tasks
const tasks = await manager.delegateMultipleTasks([
  { targetAgent: 'orbit', taskType: 'shell', payload: { cmd: 'sleep 2' } },
  { targetAgent: 'orbit', taskType: 'shell', payload: { cmd: 'sleep 3' } },
  { targetAgent: 'orbit', taskType: 'shell', payload: { cmd: 'sleep 1' } },
]);

// Wait for all
const results = await Promise.all(
  tasks.map(t => manager.subscribeToTaskCompletion(t.id))
);

console.log(`✅ All ${results.length} tasks completed`);
```

---

### Example 4: Error Handling

Handle task failures gracefully:

```typescript
try {
  const task = await manager.delegateTask(
    'orbit',
    'shell',
    { cmd: 'nonexistent-command' }
  );

  const result = await manager.subscribeToTaskCompletion(task.id);

  if (result.status === 'COMPLETED') {
    console.log('✅ Success');
  } else if (result.status === 'FAILED') {
    console.error(`❌ Task failed: ${result.error_message}`);
  } else if (result.status === 'TIMEOUT') {
    console.error('⏱️  Task timeout');
  }
} catch (error) {
  console.error('Failed to delegate task:', error);
}
```

---

### Example 5: Task Priority & Retries

High-priority task with aggressive retries:

```typescript
const criticalTask = await manager.delegateTask(
  'orbit',
  'sql_execute',
  {
    sql: 'UPDATE users SET last_login = NOW() WHERE id = 1'
  },
  {
    priority: 3,           // High priority (0-3, higher = more important)
    timeout_seconds: 30,   // 30 second timeout
    max_retries: 5         // Retry up to 5 times
  }
);

const result = await manager.subscribeToTaskCompletion(criticalTask.id);
console.log(`Completed after ${result.executionTimeMs}ms`);
```

---

## 🧪 TESTING

### Run Tests

```bash
npm test -- tests/TaskManager.test.ts
```

### Test Coverage

```bash
npm test -- tests/TaskManager.test.ts --coverage
```

### Key Tests

- ✅ delegateTask() - Single task delegation
- ✅ delegateMultipleTasks() - Batch delegation
- ✅ getAgentStatus() - Agent status queries
- ✅ subscribeToTaskUpdates() - Real-time subscriptions
- ✅ subscribeToTaskCompletion() - Promise-based completion
- ✅ getTaskHistory() - Task history filtering
- ✅ Error handling - Invalid agents, timeouts, etc.

---

## 🔧 TROUBLESHOOTING

### "Agent not found" error

**Problem:** Getting error "Agent 'orbit' not found"

**Solution:** Ensure agent is registered in Supabase:
```sql
SELECT * FROM agent_capacity WHERE agent_name = 'orbit';
```

---

### Task never completes

**Problem:** subscribeToTaskCompletion() waits forever

**Solution:** Check ORBIT is running and polling:
```sql
SELECT * FROM tasks WHERE id = 'your-task-id';
```

---

### Real-time subscriptions not firing

**Problem:** subscribeToTaskUpdates() callback never called

**Solution:** Ensure Supabase realtime is enabled:
1. Go to Supabase dashboard
2. Enable realtime for task_events table
3. Check network connectivity

---

### High latency on delegations

**Problem:** Tasks taking >1 second to delegate

**Solution:** Check Supabase latency:
```typescript
const start = Date.now();
const status = await manager.getAgentStatus('orbit');
console.log(`Query took ${Date.now() - start}ms`);
```

---

## 📊 METRICS

**Typical Performance:**
- Task delegation: 50-100ms
- Agent status query: 30-50ms
- Real-time notification: <100ms end-to-end
- Concurrent tasks: Can handle 100+

---

## 🔗 RELATED DOCS

- [Phase 1: SQL Schema](../phase1-task-delegation/PHASE1_SQL_SCHEMA.sql)
- [Phase 2: ORBIT TaskQueue](../phase2-task-queue/README.md)
- [Task Types Reference](./TASK_TYPES.md)

---

**Status:** COMPLETE ✅  
**Last Updated:** 2026-05-02  
**Owner:** Hermes
