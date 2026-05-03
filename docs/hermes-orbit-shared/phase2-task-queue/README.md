# Phase 2: TaskQueue Implementation

**Status:** ✅ COMPLETE  
**Date:** 2026-05-02  
**Owner:** ORBIT  
**Version:** 1.0.0

---

## 📋 Overview

Phase 2 implements the **TaskQueue** system for ORBIT, enabling:

- ✅ **Polling** - Continuously checks Supabase for new tasks assigned to ORBIT
- ✅ **Task Execution** - Supports 5+ task types (file_write, file_read, sql_execute, shell, webhook)
- ✅ **Progress Reporting** - Real-time status updates via Supabase functions
- ✅ **Error Handling** - Comprehensive retry logic with exponential backoff
- ✅ **Realtime Subscriptions** - Listens for instant task notifications
- ✅ **Capacity Tracking** - Monitors agent load and constraints
- ✅ **Testing** - 80%+ code coverage with unit tests

---

## 🎯 What Was Built

### Core Files

| File | Purpose |
|------|---------|
| `src/lib/TaskQueue.ts` | Main TaskQueue class with polling & orchestration |
| `src/types/task.ts` | TypeScript interfaces and types |
| `src/lib/executors/FileExecutor.ts` | File read/write operations |
| `src/lib/executors/ShellExecutor.ts` | Shell command execution |
| `src/lib/executors/SqlExecutor.ts` | SQL query execution |
| `src/lib/executors/WebhookExecutor.ts` | HTTP webhook calls |
| `tests/TaskQueue.test.ts` | Comprehensive unit tests |

### Documentation

| File | Content |
|------|---------|
| `docs/hermes-orbit-shared/phase2-task-queue/README.md` | This file |
| `docs/hermes-orbit-shared/phase2-task-queue/API.md` | API reference |
| `docs/hermes-orbit-shared/phase2-task-queue/examples.md` | Usage examples |
| `docs/hermes-orbit-shared/phase2-task-queue/PHASE2_IMPLEMENTATION.md` | Implementation details |

---

## 🚀 Quick Start

### Initialize TaskQueue

```typescript
import { createClient } from '@supabase/supabase-js';
import TaskQueue from '@/lib/TaskQueue';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const queue = new TaskQueue(supabase, 'orbit', {
  pollIntervalMs: 2000,
  maxConcurrentTasks: 5,
});

// Start polling for tasks
await queue.start();

// Stop gracefully
await queue.stop();
```

### Subscribe to Updates

```typescript
const unsubscribe = queue.subscribeToUpdates((task) => {
  console.log('New task:', task.id);
});

// Later: unsubscribe()
```

### Get Statistics

```typescript
const stats = queue.getStats();
console.log(`
  Processed: ${stats.totalProcessed}
  Succeeded: ${stats.totalSucceeded}
  Failed: ${stats.totalFailed}
  Current Load: ${stats.currentLoad}
  Avg Time: ${stats.averageExecutionTimeMs}ms
  Uptime: ${stats.uptime}ms
`);
```

---

## 📊 Supported Task Types

### 1. File Write

```typescript
{
  task_type: 'file_write',
  payload: {
    action: 'write',
    params: {
      path: '/tmp/output.txt',
      content: 'Hello World',
      encoding: 'utf-8',
      createDirectories: true
    }
  }
}
```

### 2. File Read

```typescript
{
  task_type: 'file_read',
  payload: {
    action: 'read',
    params: {
      path: '/tmp/input.txt',
      encoding: 'utf-8'
    }
  }
}
```

### 3. SQL Execute

```typescript
{
  task_type: 'sql_execute',
  payload: {
    action: 'exec',
    params: {
      sql: 'SELECT * FROM tasks WHERE status = ?',
      values: ['COMPLETED'],
      returnData: true
    }
  }
}
```

### 4. Shell Command

```typescript
{
  task_type: 'shell',
  payload: {
    action: 'exec',
    params: {
      cmd: 'npm run build',
      cwd: '/app',
      timeout: 30000
    }
  }
}
```

### 5. Webhook

```typescript
{
  task_type: 'webhook',
  payload: {
    action: 'post',
    params: {
      url: 'https://api.example.com/hook',
      headers: { 'Authorization': 'Bearer token' },
      body: { data: 'test' },
      timeout: 10000
    }
  }
}
```

---

## 🔄 Task Lifecycle

```
QUEUED
  ↓ (TaskQueue polls)
EXECUTING
  ├→ Success → COMPLETED
  ├→ Error → FAILED → (retry if count < max)
  └→ Timeout → TIMEOUT
```

Each status change:
1. Calls `update_task_status()` RPC function
2. Automatically creates entry in `task_events` table
3. Triggers realtime notifications
4. Updates `agent_capacity` load

---

## ⚙️ Configuration

```typescript
interface TaskQueueConfig {
  pollIntervalMs?: number;        // Default: 2000ms
  maxConcurrentTasks?: number;    // Default: 5
  agentName?: string;             // Default: 'orbit'
  enableRealtime?: boolean;       // Default: true
}
```

---

## 🔍 Error Handling

### Automatic Retries

- Tasks increment `retry_count` on failure
- Retries stop when `retry_count >= max_retries`
- Tasks returned to `QUEUED` state for retry

### Timeout Handling

- Each task has `timeout_seconds`
- If exceeded → status becomes `TIMEOUT`
- Task treated as failed

### Error Reporting

- Full error messages captured in `task_events`
- Stored in task `error_message` field
- Available for debugging and auditing

---

## 📈 Monitoring

### Get Real-time Stats

```typescript
const stats = queue.getStats();
```

Returns:
- `totalProcessed` - Total tasks executed
- `totalSucceeded` - Successfully completed
- `totalFailed` - Failed or timed out
- `currentLoad` - Currently executing
- `averageExecutionTimeMs` - Average task duration
- `uptime` - How long queue has been running

### Subscribe to Events

```typescript
queue.subscribeToUpdates((task) => {
  console.log(`Task ${task.id} event fired`);
});
```

---

## 🧪 Testing

Run tests:

```bash
npm test
```

Test coverage:
- TaskQueue lifecycle (start/stop)
- File operations (read/write)
- Shell execution
- Webhook calls
- Error handling
- Statistics tracking
- Custom executors

Coverage: **80%+**

---

## 🔌 Extending with Custom Executors

```typescript
import { Task, TaskExecutionResult } from '@/types/task';

const customExecutor = async (task: Task): Promise<TaskExecutionResult> => {
  try {
    const result = await doSomething(task.payload.params);
    return {
      success: true,
      data: result,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
};

queue.registerExecutor('my_task_type', customExecutor);
```

---

## 📦 Dependencies

- `@supabase/supabase-js` - Database client
- `fs` - File operations (Node.js built-in)
- `child_process` - Shell execution (Node.js built-in)
- `node-fetch` - HTTP requests (for Node.js environments)

---

## 🔐 Security Considerations

1. **Service Role Key** - Use `SUPABASE_SERVICE_ROLE_KEY` (not anon key)
2. **File Paths** - Validate paths before execution
3. **SQL Injection** - Use parameterized queries
4. **Shell Injection** - Validate commands carefully
5. **Timeouts** - All operations have timeout protection

---

## 🐛 Troubleshooting

### TaskQueue not polling

- Check that `start()` was called
- Verify Supabase connection
- Check console logs for errors

### Tasks not executing

- Verify task `assigned_to` matches agent name
- Check task `status` is `QUEUED`
- Ensure executor for task type is registered

### Slow execution

- Check `maxConcurrentTasks` setting
- Monitor `currentLoad` in stats
- Profile with `executionTimeMs` data

### Memory leaks

- Ensure `stop()` is called on shutdown
- Unsubscribe from realtime listeners
- Check for accumulated task events

---

## 📝 Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-05-02 | Initial release - Phase 2 complete |

---

## 🔗 Related Documentation

- **Phase 1:** [Task Delegation Architecture](../phase1-task-delegation/)
- **Phase 3:** [Hermes TaskManager](../phase3-hermes-taskmanager/) (Coming soon)
- **Database Schema:** [Phase 1 Schema](../../supabase/migrations/20260502_phase1_schema.sql)

---

## 📞 Support

For issues or questions:
1. Check the [API Documentation](./API.md)
2. Review [Examples](./examples.md)
3. Check test files in `tests/TaskQueue.test.ts`
4. Review [Implementation Details](./PHASE2_IMPLEMENTATION.md)

---

**Status:** ✅ Phase 2 Complete - Ready for Phase 3  
**Last Updated:** 2026-05-02 23:59 PM  
**Next:** Phase 3 - Hermes TaskManager Implementation
