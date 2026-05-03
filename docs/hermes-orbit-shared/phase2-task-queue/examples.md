# TaskQueue Usage Examples

## 1. Basic Setup

### Initialize and Start

```typescript
import { createClient } from '@supabase/supabase-js';
import TaskQueue from '@/lib/TaskQueue';

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Create TaskQueue
const queue = new TaskQueue(supabase, 'orbit', {
  pollIntervalMs: 2000,
  maxConcurrentTasks: 5,
  enableRealtime: true,
});

// Start polling
await queue.start();

// Handle shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await queue.stop();
  process.exit(0);
});
```

---

## 2. File Operations

### Write a File

```typescript
// Hermes delegates this task
const task = {
  id: 'task-001',
  delegated_by: 'hermes',
  assigned_to: 'orbit',
  task_type: 'file_write',
  priority: 2,
  status: 'QUEUED',
  payload: {
    action: 'write',
    params: {
      path: '/tmp/report.txt',
      content: 'Daily Report\n\nCompleted 5 tasks',
      encoding: 'utf-8',
      createDirectories: true,
    },
  },
  timeout_seconds: 10,
  retry_count: 0,
  max_retries: 3,
  created_at: new Date().toISOString(),
};

// Hermes inserts into Supabase
await supabase.from('tasks').insert(task);

// ORBIT automatically polls, finds, and executes
// Result: File written to /tmp/report.txt
// Status: COMPLETED with bytesWritten in result
```

### Read a File

```typescript
const readTask = {
  delegated_by: 'hermes',
  assigned_to: 'orbit',
  task_type: 'file_read',
  priority: 1,
  payload: {
    action: 'read',
    params: {
      path: '/tmp/config.json',
      encoding: 'utf-8',
    },
  },
  // ... rest of fields
};

await supabase.from('tasks').insert(readTask);

// Result includes:
// {
//   content: '{"key": "value"}',
//   size: 18,
//   encoding: 'utf-8'
// }
```

---

## 3. Shell Commands

### Run Build Command

```typescript
const buildTask = {
  delegated_by: 'hermes',
  assigned_to: 'orbit',
  task_type: 'shell',
  priority: 3,  // High priority
  payload: {
    action: 'exec',
    params: {
      cmd: 'npm run build',
      cwd: '/app',
      timeout: 60000,  // 60 seconds
    },
  },
  timeout_seconds: 120,
  // ...
};

await supabase.from('tasks').insert(buildTask);

// Result includes:
// {
//   command: 'npm run build',
//   output: 'dist/index.js created...',
//   exitCode: 0,
//   executionTimeMs: 45000
// }
```

### Run System Command

```typescript
const systemTask = {
  delegated_by: 'hermes',
  assigned_to: 'orbit',
  task_type: 'shell',
  priority: 1,
  payload: {
    action: 'exec',
    params: {
      cmd: 'df -h',
      timeout: 5000,
    },
  },
  // ...
};

// Result shows disk usage output
```

---

## 4. SQL Execution

### Query Database

```typescript
const sqlTask = {
  delegated_by: 'hermes',
  assigned_to: 'orbit',
  task_type: 'sql_execute',
  priority: 1,
  payload: {
    action: 'query',
    params: {
      sql: 'SELECT COUNT(*) as total FROM tasks WHERE status = ?',
      values: ['COMPLETED'],
      returnData: true,
    },
  },
  // ...
};

await supabase.from('tasks').insert(sqlTask);

// Result:
// {
//   rowCount: 1,
//   rows: [{ total: 42 }]
// }
```

---

## 5. Webhook Calls

### Call External API

```typescript
const webhookTask = {
  delegated_by: 'hermes',
  assigned_to: 'orbit',
  task_type: 'webhook',
  priority: 2,
  payload: {
    action: 'post',
    params: {
      url: 'https://api.slack.com/api/chat.postMessage',
      headers: {
        'Authorization': 'Bearer xoxb-xxx',
      },
      body: {
        channel: '#alerts',
        text: 'TaskQueue running smoothly',
      },
      timeout: 10000,
    },
  },
  timeout_seconds: 30,
  // ...
};

await supabase.from('tasks').insert(webhookTask);

// Result:
// {
//   statusCode: 200,
//   statusText: 'OK',
//   response: { ok: true, ts: '...' }
// }
```

---

## 6. Monitoring and Statistics

### Track Queue Health

```typescript
// Start queue
await queue.start();

// Monitor every 10 seconds
const monitor = setInterval(() => {
  const stats = queue.getStats();
  
  console.log(`
    📊 TaskQueue Stats (${new Date().toLocaleTimeString()})
    ─────────────────────────────────
    Total Processed: ${stats.totalProcessed}
    Succeeded: ${stats.totalSucceeded}
    Failed: ${stats.totalFailed}
    Current Load: ${stats.currentLoad} / 5
    Success Rate: ${(stats.totalSucceeded / stats.totalProcessed * 100).toFixed(1)}%
    Avg Time: ${stats.averageExecutionTimeMs.toFixed(0)}ms
    Uptime: ${(stats.uptime / 1000 / 60).toFixed(1)}min
  `);
}, 10000);

// Cleanup
process.on('SIGTERM', () => {
  clearInterval(monitor);
  queue.stop();
});
```

### Subscribe to Real-time Updates

```typescript
const unsubscribe = queue.subscribeToUpdates((task) => {
  console.log(`🔔 New task: ${task.id}`);
  console.log(`   Type: ${task.task_type}`);
  console.log(`   Priority: ${task.priority}`);
  console.log(`   Timeout: ${task.timeout_seconds}s`);
});

// Keep unsubscribe for cleanup
process.on('SIGTERM', () => {
  unsubscribe();
  queue.stop();
});
```

---

## 7. Error Scenarios

### Task Timeout

```typescript
// Create a task with short timeout
const slowTask = {
  delegated_by: 'hermes',
  assigned_to: 'orbit',
  task_type: 'shell',
  payload: {
    action: 'exec',
    params: {
      cmd: 'sleep 30',  // Long operation
    },
  },
  timeout_seconds: 5,  // Short timeout
  // ...
};

// ORBIT will:
// 1. Start executing
// 2. After 5 seconds, terminate
// 3. Set status to TIMEOUT
// 4. Store error: "Task timeout after 5 seconds"
```

### Failed Task with Retry

```typescript
const retryableTask = {
  delegated_by: 'hermes',
  assigned_to: 'orbit',
  task_type: 'file_write',
  payload: {
    action: 'write',
    params: {
      path: '/read-only-dir/file.txt',  // Permission denied
      content: 'test',
    },
  },
  retry_count: 0,
  max_retries: 3,  // Will retry up to 3 times
  // ...
};

// ORBIT will:
// 1. Try to execute → Permission denied error
// 2. Increment retry_count to 1
// 3. Set status back to QUEUED
// 4. Next poll: try again
// 5. After 3 failures: set status to FAILED
```

---

## 8. Custom Task Type

### Register Custom Executor

```typescript
import { Task, TaskExecutionResult } from '@/types/task';

// Define custom executor
const imageResizeExecutor = async (task: Task): Promise<TaskExecutionResult> => {
  try {
    const { input, output, width, height } = task.payload.params;
    
    // Use image library to resize
    const resized = await resizeImage(input, { width, height });
    await writeImageFile(output, resized);
    
    return {
      success: true,
      data: {
        inputSize: getFileSize(input),
        outputSize: getFileSize(output),
        dimensions: `${width}x${height}`,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
};

// Register with queue
queue.registerExecutor('image_resize', imageResizeExecutor);

// Now tasks can use it
const resizeTask = {
  delegated_by: 'hermes',
  assigned_to: 'orbit',
  task_type: 'image_resize',  // Uses custom executor
  payload: {
    action: 'resize',
    params: {
      input: '/images/original.jpg',
      output: '/images/thumbnail.jpg',
      width: 200,
      height: 200,
    },
  },
  // ...
};
```

---

## 9. Full Integration Example

```typescript
import { createClient } from '@supabase/supabase-js';
import TaskQueue from '@/lib/TaskQueue';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  // Initialize
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const queue = new TaskQueue(supabase, 'orbit', {
    pollIntervalMs: 2000,
    maxConcurrentTasks: 5,
  });

  // Subscribe to updates
  queue.subscribeToUpdates((task) => {
    console.log(`📥 New task: ${task.task_type}`);
  });

  // Monitor stats
  setInterval(() => {
    const stats = queue.getStats();
    console.log(`📊 Current Load: ${stats.currentLoad}`);
  }, 5000);

  // Start polling
  console.log('🚀 Starting ORBIT TaskQueue...');
  await queue.start();

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('⛔ Shutting down gracefully...');
    await queue.stop();
    process.exit(0);
  });

  // Delegate a test task (as Hermes would)
  const testTask = {
    delegated_by: 'hermes',
    assigned_to: 'orbit',
    task_type: 'shell',
    priority: 1,
    status: 'QUEUED',
    payload: {
      action: 'exec',
      params: {
        cmd: 'echo "TaskQueue is working!"',
      },
    },
    timeout_seconds: 30,
    retry_count: 0,
    max_retries: 3,
    created_at: new Date().toISOString(),
  };

  console.log('📤 Delegating test task...');
  await supabase.from('tasks').insert(testTask);

  console.log('⏳ Queue running... Press Ctrl+C to stop');
}

main().catch(console.error);
```

Output:
```
🚀 Starting ORBIT TaskQueue...
📥 New task: shell
⏳ Queue running... Press Ctrl+C to stop
📊 Current Load: 1
[TaskQueue] Task abc123 status updated to EXECUTING
[TaskQueue] Task abc123 status updated to COMPLETED
📊 Current Load: 0
```

---

## 10. Environment Setup

### .env Example

```bash
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxxxx
NODE_ENV=production
LOG_LEVEL=info
```

### Docker Deployment

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY src ./src
COPY .env .env

CMD ["node", "--loader", "tsx", "./src/index.ts"]
```

---

## Testing Examples

### Unit Test Template

```typescript
import { TaskQueue } from '@/lib/TaskQueue';
import { Task, TaskExecutionResult } from '@/types/task';

describe('Custom Task Executor', () => {
  it('should execute custom task', async () => {
    const mockSupabase = createMockSupabase();
    const queue = new TaskQueue(mockSupabase, 'orbit');

    let executionCalled = false;
    queue.registerExecutor('test', async (task) => {
      executionCalled = true;
      return { success: true, data: { test: 'passed' } };
    });

    expect(executionCalled).toBe(false);
  });
});
```

---

**Version:** 1.0.0  
**Last Updated:** 2026-05-02
