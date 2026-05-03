# Phase 4: SubagentRouter Usage Examples

**Practical examples and use cases for the SubagentRouter**

---

## 🚀 Quick Start

### Basic Setup

```typescript
import { createClient } from '@supabase/supabase-js';
import { SubagentRouter } from './src/lib/SubagentRouter';

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Create router
const router = new SubagentRouter(supabase, 'orbit');

// Start listening
await router.start();
```

---

## 📋 Examples

### Example 1: Route a Single Task

```typescript
// Task to route
const task = {
  id: 'task_abc123',
  delegated_by: 'hermes',
  assigned_to: 'orbit',
  task_type: 'shell',
  priority: 1,
  status: 'QUEUED',
  payload: {
    action: 'exec',
    params: { cmd: 'ls -la /home' }
  },
  created_at: new Date().toISOString(),
  timeout_seconds: 60,
  retry_count: 0,
  max_retries: 3,
};

// Route the task
await router.routeTask(task);

// Get routing decision
const decision = router.getRoutingDecision('task_abc123');
console.log('Routed to:', decision?.selectedSubagent);
console.log('Complexity:', decision?.complexity);
console.log('Reason:', decision?.reason);
```

**Output:**
```
Routed to: subagent_3
Complexity: 3
Reason: Selected subagent_3 based on load (1/5) and specialization match
```

---

### Example 2: Route Multiple Tasks (Batch)

```typescript
const tasks = [
  {
    id: 'task_file_1',
    task_type: 'file_write',
    payload: { params: { path: '/tmp/file1.txt', content: 'data' } },
    timeout_seconds: 30,
    priority: 1,
    ...commonFields,
  },
  {
    id: 'task_sql_1',
    task_type: 'sql_execute',
    payload: { params: { sql: 'SELECT * FROM users' } },
    timeout_seconds: 60,
    priority: 1,
    ...commonFields,
  },
  {
    id: 'task_shell_1',
    task_type: 'shell',
    payload: { params: { cmd: 'git status' } },
    timeout_seconds: 45,
    priority: 2,  // High priority
    ...commonFields,
  },
];

// Route all tasks
for (const task of tasks) {
  await router.routeTask(task);
  
  const decision = router.getRoutingDecision(task.id);
  console.log(`Task ${task.id} → ${decision?.selectedSubagent}`);
}

// Results:
// Task task_file_1 → subagent_1 (file_ops specialist)
// Task task_sql_1 → subagent_2 (sql specialist)
// Task task_shell_1 → subagent_3 (high priority, shell specialist)
```

---

### Example 3: Subscribe to Routing Events

```typescript
// Listen for all routing events
const unsubscribe = router.subscribeToRoutingEvents((event) => {
  console.log(`[${event.eventType}] Task ${event.taskId}:`, event.data);
});

// Route a task
await router.routeTask(task);

// Console output:
// [routed] Task task_abc123: {
//   routingId: '12345',
//   complexity: 3,
//   selectedSubagent: 'subagent_3',
//   routingTimeMs: 45
// }
// [delegated] Task task_abc123: {
//   delegatedTo: 'subagent_3',
//   delegatedAt: '2026-05-02T18:30:00Z'
// }

// Cleanup
unsubscribe();
```

---

### Example 4: Monitor Routing Events Selectively

```typescript
// Only listen for routing failures
router.subscribeToRoutingEvents((event) => {
  if (event.eventType === 'failed') {
    console.error('Routing failed:', event.data);
    // Send alert, log to monitoring system, etc.
  }
});

// Only listen for aggregation completions
router.subscribeToRoutingEvents((event) => {
  if (event.eventType === 'aggregated') {
    console.log('Aggregation complete:', {
      taskId: event.taskId,
      subtasks: event.data.subtaskCount,
      success: event.data.successCount,
      time: event.data.totalTimeMs,
    });
  }
});
```

---

### Example 5: Aggregate Results from Multiple Subagents

```typescript
// Simulate execution on multiple subagents
const subtaskResults = [
  {
    status: 'COMPLETED',
    data: { output: 'File written successfully' },
    executedBy: 'subagent_1',
    executionTimeMs: 120,
  },
  {
    status: 'COMPLETED',
    data: { rows: 42 },
    executedBy: 'subagent_2',
    executionTimeMs: 250,
  },
  {
    status: 'COMPLETED',
    data: { status: 'clean' },
    executedBy: 'subagent_3',
    executionTimeMs: 85,
  },
];

// Aggregate results
const aggregated = await router.aggregateResults('batch_task_1', subtaskResults);

console.log(aggregated);
// Output:
// {
//   taskId: 'batch_task_1',
//   status: 'COMPLETED',
//   result: {
//     subtasks: [
//       { subagent: 'subagent_1', status: 'COMPLETED', result: {...}, executionTimeMs: 120 },
//       { subagent: 'subagent_2', status: 'COMPLETED', result: {...}, executionTimeMs: 250 },
//       { subagent: 'subagent_3', status: 'COMPLETED', result: {...}, executionTimeMs: 85 },
//     ],
//     totalExecutionTimeMs: 455,
//     averagePerTask: 152,
//     successCount: 3,
//     failureCount: 0,
//   },
//   executedBy: 'orbit-router',
//   executionTimeMs: 12,
//   aggregatedAt: '2026-05-02T18:30:00Z',
// }
```

---

### Example 6: Handle Partial Failures

```typescript
// Some tasks fail
const mixedResults = [
  {
    status: 'COMPLETED',
    data: { ok: true },
    executedBy: 'subagent_1',
    executionTimeMs: 100,
  },
  {
    status: 'FAILED',
    error: 'Timeout after 60s',
    executedBy: 'subagent_2',
    executionTimeMs: 60000,
  },
  {
    status: 'COMPLETED',
    data: { ok: true },
    executedBy: 'subagent_3',
    executionTimeMs: 95,
  },
];

const aggregated = await router.aggregateResults('batch_partial', mixedResults);

console.log(aggregated.status);  // 'FAILED'
console.log(aggregated.error_message);  // 'Some subtasks failed'
console.log(aggregated.result.successCount);  // 2
console.log(aggregated.result.failureCount);  // 1

// Handle failure
if (aggregated.status === 'FAILED') {
  console.error('Batch had failures:');
  aggregated.result.subtasks.forEach(st => {
    if (st.status === 'FAILED') {
      console.error(`  - ${st.subagent}: ${st.result?.error}`);
    }
  });
}
```

---

### Example 7: Get Routing Statistics

```typescript
// After routing several tasks
const stats = router.getRoutingStats();

console.log('Routing Statistics:');
console.log('─────────────────────');
console.log(`Total tasks routed: ${stats.totalTasksRouted}`);
console.log(`Successful: ${stats.successfulRoutes}`);
console.log(`Failed: ${stats.failedRoutes}`);
console.log(`Avg routing time: ${stats.averageRoutingTimeMs}ms`);
console.log(`Avg execution time: ${stats.averageExecutionTimeMs}ms`);
console.log('\nSubagent Utilization:');
Object.entries(stats.subagentUtilization).forEach(([name, util]) => {
  console.log(`  ${name}: ${util.toFixed(1)}%`);
});

// Output:
// Routing Statistics:
// ─────────────────────
// Total tasks routed: 15
// Successful: 14
// Failed: 1
// Avg routing time: 67ms
// Avg execution time: 245ms
//
// Subagent Utilization:
//   subagent_1: 45.2%
//   subagent_2: 62.1%
//   subagent_3: 38.7%
```

---

### Example 8: Get Router Status

```typescript
const status = router.getStatus();

console.log('Router Status:');
console.log(`  Running: ${status.isRunning}`);
console.log(`  Agent: ${status.agentName}`);
console.log(`  Uptime: ${Math.round(status.uptime / 1000)}s`);
console.log(`  Tasks routed: ${status.stats.totalTasksRouted}`);
console.log(`  Success rate: ${(
  (status.stats.successfulRoutes / status.stats.totalTasksRouted) * 100
).toFixed(1)}%`);
```

---

### Example 9: Custom Configuration

```typescript
// Prioritize load balancing over specialization
const balanceRouter = new SubagentRouter(supabase, 'orbit', {
  enableLoadBalancing: true,
  enableSpecializationMatching: true,
  scoreWeights: {
    capacity: 0.6,           // Higher weight on load
    specialization: 0.2,     // Lower weight on specialization
    priority: 0.1,
    complexity: 0.1,
  },
  maxRoutingTimeMs: 5000,
  enableMonitoring: true,
  enableAggregation: true,
});

await balanceRouter.start();

// Now routing decisions favor less-loaded subagents
```

---

### Example 10: Disable Specialization Matching

```typescript
// Use if all subagents are equivalent
const genericRouter = new SubagentRouter(supabase, 'orbit', {
  enableLoadBalancing: true,
  enableSpecializationMatching: false,  // Disable specialization
  scoreWeights: {
    capacity: 0.7,           // 70% on capacity
    specialization: 0.0,     // 0% on specialization (all get 100)
    priority: 0.2,
    complexity: 0.1,
  },
});

await genericRouter.start();

// Result: Tasks route based purely on available capacity
```

---

### Example 11: Clear Old Routing Records (Memory Management)

```typescript
// Run periodically (e.g., daily)
const router = new SubagentRouter(supabase, 'orbit');

// Clear routing decisions older than 24 hours
router.clearOldDecisions(24 * 60 * 60 * 1000);

// Clear with custom threshold (7 days)
router.clearOldDecisions(7 * 24 * 60 * 60 * 1000);

// This helps prevent memory bloat in long-running processes
```

---

### Example 12: Integration with TaskManager (Hermes)

```typescript
import { TaskManager } from './src/lib/TaskManager';

// Hermes delegates to ORBIT
const taskManager = new TaskManager(supabase, 'hermes');

// Subscribe to completion
const waitForResult = taskManager.subscribeToTaskCompletion('task_123');

// Meanwhile, ORBIT router routes the task
const router = new SubagentRouter(supabase, 'orbit');
await router.start();

// When subagent completes, Hermes gets notified
const result = await waitForResult;
console.log('Task completed:', result);
```

---

### Example 13: Task Complexity Analysis Examples

```typescript
// Example 1: Simple task
const simpleTask = {
  task_type: 'file_read',
  timeout_seconds: 60,
  priority: 0,
  payload: '{"path": "/tmp/file.txt"}',  // ~25 bytes
  // Complexity: 1 (file_read base)
  // → Routes to any available subagent
};

// Example 2: Complex task
const complexTask = {
  task_type: 'sql_execute',
  timeout_seconds: 900,  // 15 minutes
  priority: 3,           // High priority
  payload: 'SELECT * FROM huge_table WHERE...',  // ~50KB
  // Complexity: 4 (sql) + 3 (>50KB) + 1 (>300s) + 1 (priority≥2) = 9
  // → Routes to capable subagent with more capacity
};

// Example 3: Medium task
const mediumTask = {
  task_type: 'shell',
  timeout_seconds: 45,
  priority: 1,
  payload: '{"cmd": "git pull && npm install"}',  // ~100 bytes
  // Complexity: 3 (shell) + 0 (small payload) + 0 (45s normal) + 0 (priority<2) = 3
  // → Routes to available shell specialist
};
```

---

## 🔄 Complete Workflow Example

```typescript
// 1. Initialize
const supabase = createClient(URL, KEY);
const router = new SubagentRouter(supabase, 'orbit');

// 2. Subscribe to events
let routedCount = 0;
let aggregatedCount = 0;

router.subscribeToRoutingEvents((event) => {
  if (event.eventType === 'routed') {
    routedCount++;
    console.log(`✓ Routed task ${routedCount}`);
  }
  if (event.eventType === 'aggregated') {
    aggregatedCount++;
    console.log(`✓ Aggregated batch ${aggregatedCount}`);
  }
});

// 3. Start router
await router.start();
console.log('Router started');

// 4. Create and route tasks
const tasks = [
  createTask('file_write'),
  createTask('sql_execute'),
  createTask('shell'),
];

for (const task of tasks) {
  await router.routeTask(task);
}

// 5. Simulate execution and aggregation
const results = await Promise.all([
  executeOnSubagent('subagent_1'),
  executeOnSubagent('subagent_2'),
  executeOnSubagent('subagent_3'),
]);

const aggregated = await router.aggregateResults('batch_1', results);
console.log('Aggregated result:', aggregated);

// 6. Get final statistics
const stats = router.getRoutingStats();
console.log('Final stats:', stats);

// 7. Cleanup
await router.stop();
console.log('Router stopped');
```

---

## 📊 Performance Examples

### Example 1: Throughput Test

```typescript
// Route 100 tasks
const startTime = Date.now();
const tasks = generateTasks(100);

for (const task of tasks) {
  await router.routeTask(task);
}

const elapsed = Date.now() - startTime;
console.log(`Routed 100 tasks in ${elapsed}ms`);
console.log(`Average: ${(elapsed / 100).toFixed(1)}ms per task`);

// Expected output:
// Routed 100 tasks in 6750ms
// Average: 67.5ms per task
```

### Example 2: Load Distribution

```typescript
// Route tasks and verify distribution
const distribution: Record<string, number> = {
  subagent_1: 0,
  subagent_2: 0,
  subagent_3: 0,
};

const tasks = generateTasks(30);
for (const task of tasks) {
  await router.routeTask(task);
  const decision = router.getRoutingDecision(task.id);
  if (decision) {
    distribution[decision.selectedSubagent]++;
  }
}

console.log('Distribution:', distribution);
// Expected: ~10, ~10, ~10 (balanced)
// Or might see: ~5, ~7, ~18 (if one has high priority)
```

---

## 🧪 Testing Utilities

### Mock Subagent Results

```typescript
function createSubagentResult(subagentName: string, success = true) {
  return {
    status: success ? 'COMPLETED' : 'FAILED',
    data: success ? { ok: true, timestamp: Date.now() } : undefined,
    error: success ? undefined : 'Task execution failed',
    executedBy: subagentName,
    executionTimeMs: Math.random() * 500,
  };
}

// Use in tests
const results = [
  createSubagentResult('subagent_1', true),
  createSubagentResult('subagent_2', false),  // Simulated failure
  createSubagentResult('subagent_3', true),
];

const aggregated = await router.aggregateResults('test_batch', results);
```

---

## 🔗 Related Examples

- [PHASE3 TaskManager Examples](../phase3-task-manager/EXAMPLES.md)
- [PHASE2 TaskQueue Examples](../phase2-task-queue/examples.md)
- [Full Project Usage](../../../../README.md)

---

**Last Updated:** 2026-05-02  
**Examples Version:** 1.0  
**Status:** Production Ready
