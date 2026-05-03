# TaskQueue API Reference

## TaskQueue Class

### Constructor

```typescript
constructor(
  supabase: SupabaseClient,
  agentName?: string,
  config?: TaskQueueConfig
)
```

**Parameters:**
- `supabase` - Supabase client instance
- `agentName` - Name of this agent (default: 'orbit')
- `config` - Configuration object

**Example:**
```typescript
const queue = new TaskQueue(supabase, 'orbit', {
  pollIntervalMs: 2000,
  maxConcurrentTasks: 5,
});
```

---

## Core Methods

### start()

Starts polling for tasks and subscribes to realtime updates.

```typescript
async start(): Promise<void>
```

**Example:**
```typescript
await queue.start();
console.log('TaskQueue started');
```

**Behavior:**
- Initializes agent capacity in database
- Starts polling interval
- Subscribes to realtime task updates
- Non-blocking if already running

---

### stop()

Stops polling and closes subscriptions gracefully.

```typescript
async stop(): Promise<void>
```

**Example:**
```typescript
await queue.stop();
console.log('TaskQueue stopped');
```

**Behavior:**
- Clears polling interval
- Closes realtime subscriptions
- Waits for current tasks to complete (max 30s)
- Safe to call multiple times

---

## Subscription Methods

### subscribeToUpdates()

Subscribe to realtime task notifications.

```typescript
subscribeToUpdates(
  callback: (task: Task) => void
): () => void
```

**Parameters:**
- `callback` - Function called when new task is assigned

**Returns:**
- Unsubscribe function

**Example:**
```typescript
const unsubscribe = queue.subscribeToUpdates((task) => {
  console.log('New task:', task.id);
  console.log('Type:', task.task_type);
});

// Later...
unsubscribe();
```

---

## Statistics Methods

### getStats()

Get current queue statistics.

```typescript
getStats(): TaskQueueStats
```

**Returns:**

```typescript
interface TaskQueueStats {
  totalProcessed: number;        // Total tasks executed
  totalFailed: number;           // Total failed/timed out
  totalSucceeded: number;        // Total successfully completed
  currentLoad: number;           // Currently executing tasks
  averageExecutionTimeMs: number;// Average task duration
  uptime: number;                // Time since start() (ms)
}
```

**Example:**
```typescript
const stats = queue.getStats();
console.log(`
  Tasks: ${stats.totalProcessed}
  Success Rate: ${(stats.totalSucceeded / stats.totalProcessed * 100).toFixed(2)}%
  Avg Time: ${stats.averageExecutionTimeMs.toFixed(0)}ms
  Uptime: ${(stats.uptime / 1000).toFixed(1)}s
`);
```

---

## Custom Executor Methods

### registerExecutor()

Register a custom executor for a task type.

```typescript
registerExecutor(
  taskType: string,
  executor: (task: Task) => Promise<TaskExecutionResult>
): void
```

**Parameters:**
- `taskType` - Unique task type identifier
- `executor` - Async function that executes the task

**Example:**
```typescript
queue.registerExecutor('custom_task', async (task) => {
  try {
    const result = await doCustomWork(task.payload);
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
});
```

---

## Type Definitions

### Task

```typescript
interface Task {
  id: string;                           // UUID
  delegated_by: string;                 // Agent that created task
  assigned_to: string;                  // Agent to execute (ORBIT)
  task_type: string;                    // Type of task
  priority: 0 | 1 | 2 | 3;             // 0=lowest, 3=highest
  status: TaskStatus;                   // Current status
  payload: TaskPayload;                 // Task parameters
  result?: Record<string, any>;        // Execution result
  error_message?: string;               // Error details if failed
  created_at: string;                   // ISO timestamp
  started_at?: string;                  // When execution started
  completed_at?: string;                // When execution finished
  timeout_seconds: number;              // Max execution time
  retry_count: number;                  // Current retry count
  max_retries: number;                  // Max retries allowed
  updated_at?: string;                  // Last update time
}
```

### TaskStatus

```typescript
type TaskStatus = 'QUEUED' | 'EXECUTING' | 'COMPLETED' | 'FAILED' | 'TIMEOUT'
```

### TaskPayload

```typescript
interface TaskPayload {
  action: string;                       // What to do
  params: Record<string, any>;         // Parameters
}
```

### TaskExecutionResult

```typescript
interface TaskExecutionResult {
  success: boolean;
  data?: Record<string, any>;          // Execution result
  error?: string;                       // Error message
  executionTimeMs?: number;             // How long it took
}
```

### TaskQueueConfig

```typescript
interface TaskQueueConfig {
  pollIntervalMs?: number;              // Polling frequency (default: 2000)
  maxConcurrentTasks?: number;          // Max parallel tasks (default: 5)
  agentName?: string;                   // Agent name (default: 'orbit')
  enableRealtime?: boolean;             // Enable subscriptions (default: true)
}
```

---

## Task Type Payloads

### file_write

Write file to disk.

```typescript
{
  task_type: 'file_write',
  payload: {
    action: 'write',
    params: {
      path: string;              // File path
      content: string;           // File content
      encoding?: 'utf-8';        // Encoding (default: utf-8)
      createDirectories?: true;  // Create parent dirs
    }
  }
}
```

**Result:**
```typescript
{
  path: string;
  bytesWritten: number;
  message: string;
}
```

---

### file_read

Read file from disk.

```typescript
{
  task_type: 'file_read',
  payload: {
    action: 'read',
    params: {
      path: string;              // File path
      encoding?: 'utf-8';        // Encoding (default: utf-8)
    }
  }
}
```

**Result:**
```typescript
{
  path: string;
  content: string;
  size: number;
  encoding: string;
  message: string;
}
```

---

### sql_execute

Execute SQL query.

```typescript
{
  task_type: 'sql_execute',
  payload: {
    action: 'exec' | 'query',
    params: {
      sql: string;               // SQL query
      values?: any[];            // Query parameters
      returnData?: boolean;      // Return result rows
    }
  }
}
```

**Result:**
```typescript
{
  rowCount: number;              // Affected rows
  rows?: any[];                  // Result rows (if returnData=true)
  message: string;
}
```

---

### shell

Execute shell command.

```typescript
{
  task_type: 'shell',
  payload: {
    action: 'exec',
    params: {
      cmd: string;               // Command to run
      cwd?: string;              // Working directory
      timeout?: number;          // Timeout in ms
      env?: Record<string, string>; // Environment variables
    }
  }
}
```

**Result:**
```typescript
{
  command: string;
  output: string;                // stdout
  exitCode: number;
  executionTimeMs: number;
  message: string;
}
```

---

### webhook

Call HTTP webhook.

```typescript
{
  task_type: 'webhook',
  payload: {
    action: 'post' | 'get' | 'put' | 'delete',
    params: {
      url: string;               // URL to call
      method?: string;           // HTTP method
      headers?: Record<string, string>; // HTTP headers
      body?: Record<string, any>;// Request body
      timeout?: number;          // Timeout in ms
    }
  }
}
```

**Result:**
```typescript
{
  statusCode: number;
  statusText: string;
  response: any;                 // Response body
  executionTimeMs: number;
  message: string;
}
```

---

## Error Handling

### Task Failures

When a task fails:
1. Error is caught and logged
2. Error message stored in task `error_message`
3. `task_events` entry created with failure details
4. If `retry_count < max_retries`, task returns to QUEUED
5. Otherwise, status set to FAILED

### Timeouts

If a task exceeds `timeout_seconds`:
1. Execution is terminated
2. Status set to TIMEOUT
3. Error message indicates timeout
4. Task not automatically retried (considered final failure)

### Custom Executor Errors

Executors should return:

```typescript
{
  success: false,
  error: 'Descriptive error message',
  executionTimeMs: 1234
}
```

---

## Logging

All operations log to console with `[TaskQueue]` prefix:

```
[TaskQueue] Starting for agent: orbit
[TaskQueue] Task abc123 status updated to EXECUTING
[TaskQueue] Task abc123 status updated to COMPLETED
[TaskQueue] Polling error: Connection timeout
```

---

## Performance Tips

1. **Set appropriate `maxConcurrentTasks`**
   - Higher = more parallel, but more resource usage
   - Default 5 is conservative

2. **Tune `pollIntervalMs`**
   - Lower = faster detection, more queries
   - Higher = fewer queries, higher latency
   - Default 2000ms (2s) is good balance

3. **Monitor stats regularly**
   ```typescript
   setInterval(() => {
     const stats = queue.getStats();
     console.log(`Load: ${stats.currentLoad}/${maxConcurrentTasks}`);
   }, 10000);
   ```

4. **Implement graceful shutdown**
   ```typescript
   process.on('SIGTERM', async () => {
     await queue.stop();
     process.exit(0);
   });
   ```

---

## Examples

See [examples.md](./examples.md) for complete working examples.

---

**Version:** 1.0.0  
**Last Updated:** 2026-05-02
