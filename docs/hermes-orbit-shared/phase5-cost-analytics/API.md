# Phase 5 API Reference

## CostCalculator

### Class: CostCalculator

Core calculation engine for task costs.

#### Methods

##### calculateTaskCost(task, executionTimeMs): number

Calculate actual task cost based on execution time.

```typescript
const cost = calculator.calculateTaskCost(
  { task_type: 'shell' },
  3200
); // $0.000356
```

**Parameters:**
- `task` - Task or TaskEvent object with `task_type`
- `executionTimeMs` - Execution time in milliseconds

**Returns:** Number - Cost in USD

**Algorithm:**
```
costSec = executionTimeMs / 1000
tier = costTiers[taskType]
baseCost = costSec * tier.base
totalCost = baseCost + tier.overhead
```

---

##### calculateBatchCost(tasks): number

Calculate combined cost for multiple tasks.

```typescript
const cost = calculator.calculateBatchCost([
  { taskType: 'shell', executionTimeMs: 3200 },
  { taskType: 'sql', executionTimeMs: 10000 }
]); // $0.001056
```

**Parameters:**
- `tasks` - Array of {taskType, executionTimeMs}

**Returns:** Number - Total cost in USD

---

##### estimateTaskCost(task): number

Estimate task cost before execution using average times.

```typescript
const estimate = calculator.estimateTaskCost({
  task_type: 'sql'
}); // Uses 3000ms average
```

**Parameters:**
- `task` - Task object with `task_type`

**Returns:** Number - Estimated cost in USD

**Default Times:**
- file_ops: 1000ms
- shell: 2000ms
- sql: 3000ms
- http: 2500ms
- webhook: 1500ms

---

##### calculateHourlyCost(taskType, tasksPerHour): number

Project hourly cost for repeated task type.

```typescript
const hourly = calculator.calculateHourlyCost('shell', 120);
// 120 shell tasks per hour
```

**Parameters:**
- `taskType` - Type of task
- `tasksPerHour` - Expected tasks per hour (default: 1)

**Returns:** Number - Hourly cost in USD

---

##### calculateSavings(originalCost, optimizedCost): object

Calculate cost reduction and percentage.

```typescript
const result = calculator.calculateSavings(1.0, 0.85);
// { savings: 0.15, percentageReduction: 15 }
```

**Returns:**
```typescript
{
  savings: number,
  percentageReduction: number
}
```

---

##### projectMonthlyCost(dailyAverageCost): number

Project 30-day cost.

```typescript
const monthly = calculator.projectMonthlyCost(1.5);
// Returns: 45.0
```

---

##### projectYearlyCost(dailyAverageCost): number

Project 365-day cost.

```typescript
const yearly = calculator.projectYearlyCost(1.5);
// Returns: 547.5
```

---

##### getCostTier(taskType): CostTier

Retrieve cost tier for task type.

```typescript
const tier = calculator.getCostTier('shell');
// { base: 0.00008, overhead: 0.0001 }
```

---

##### setCostTier(taskType, tier): void

Update cost tier for task type.

```typescript
calculator.setCostTier('custom', {
  base: 0.0001,
  overhead: 0.00005
});
```

---

##### getAllCostTiers(): CostTiers

Get all configured cost tiers.

```typescript
const tiers = calculator.getAllCostTiers();
// { shell: {...}, sql: {...}, ... }
```

---

## CostTracker

### Class: CostTracker

Real-time cost tracking from Supabase.

#### Constructor

```typescript
const tracker = new CostTracker({
  supabase: supabaseClient,
  calculator: costCalculator, // optional
  pollIntervalMs: 60000 // optional
});
```

**Config:**
- `supabase` - SupabaseClient instance
- `calculator` - CostCalculator (uses default if not provided)
- `pollIntervalMs` - Polling interval in ms (default: 60000)

#### Methods

##### subscribe(callback): function

Subscribe to cost update events.

```typescript
const unsubscribe = tracker.subscribe((event) => {
  console.log(`Task ${event.taskId} cost: $${event.cost}`);
});

// Later: unsubscribe()
```

**Returns:** Unsubscribe function

---

##### subscribeToTaskCosts(): void

Start listening for task completions via Supabase real-time.

```typescript
tracker.subscribeToTaskCosts();
```

---

##### recordTaskCost(event): Promise<number>

Record task cost and update database.

```typescript
const cost = await tracker.recordTaskCost({
  task_id: 'task-123',
  event_type: 'completed',
  executor_name: 'agent-1',
  execution_time_ms: 3200
});
```

**Parameters:**
- `event` - TaskEvent object

**Returns:** Promise<number> - Calculated cost

---

##### getDailyCost(date?): number

Get total cost for a date (from memory cache).

```typescript
const cost = tracker.getDailyCost(); // Today
const cost = tracker.getDailyCost('2026-05-02');
```

**Returns:** Number - Cost in USD (0 if not in cache)

---

##### getCostByAgent(date): Promise<AgentCostBreakdown[]>

Get cost breakdown by agent for a date.

```typescript
const agents = await tracker.getCostByAgent('2026-05-02');
agents.forEach(a => {
  console.log(`${a.agent}: $${a.totalCost}`);
});
```

**Returns:** Promise<AgentCostBreakdown[]>

**Format:**
```typescript
{
  agent: string,
  totalCost: number,
  taskCount: number,
  successCount: number,
  costPerTask: number
}
```

---

##### getEfficiencyMetrics(date): Promise<EfficiencyMetrics>

Get efficiency metrics for a date.

```typescript
const metrics = await tracker.getEfficiencyMetrics('2026-05-02');
```

**Returns:** Promise<EfficiencyMetrics>

**Format:**
```typescript
{
  totalTasks: number,
  successCount: number,
  successRate: number,
  totalCost: number,
  costPerTask: number,
  costPerSuccess: number,
  totalExecutionTime: number,
  averageExecutionTime: number
}
```

---

##### getCostTrends(days): Promise<DailyCostTrend[]>

Get cost trends for last N days.

```typescript
const trends = await tracker.getCostTrends(7);
```

**Returns:** Promise<DailyCostTrend[]>

**Format:**
```typescript
{
  date: string,
  totalCost: number,
  totalTasks: number,
  successRate: number,
  costPerTask: number
}
```

---

##### getAllCostData(startDate, endDate): Promise<DailyCostSummary[]>

Export all cost data for date range.

```typescript
const data = await tracker.getAllCostData('2026-04-02', '2026-05-02');
```

**Returns:** Promise<DailyCostSummary[]>

---

##### clearCache(): void

Clear in-memory cost cache.

```typescript
tracker.clearCache();
```

---

##### stop(): void

Stop polling and cleanup.

```typescript
tracker.stop();
```

---

## CostOptimizer

### Class: CostOptimizer

Recommendation engine for cost optimization.

#### Methods

##### generateRecommendations(metrics, costByAgent, agentStats?): Recommendation[]

Generate all applicable recommendations.

```typescript
const recs = optimizer.generateRecommendations(
  metrics,
  costByAgent,
  agentStats
);
```

**Parameters:**
- `metrics` - EfficiencyMetrics
- `costByAgent` - AgentCostBreakdown[]
- `agentStats` - AgentStats[] (optional)

**Returns:** Recommendation[] (sorted by severity)

**Recommendation Types:**
- `workload_rebalance` - Distribute load evenly
- `reduce_failures` - Lower failure rate
- `batch_tasks` - Group similar tasks
- `optimize_execution` - Reduce execution time

---

##### calculateRecommendationROI(rec, cost?, days?): object

Calculate ROI for a recommendation.

```typescript
const roi = optimizer.calculateRecommendationROI(
  recommendation,
  1000, // implementation cost
  30    // payback period target
);
```

**Returns:**
```typescript
{
  roi: number,
  paybackDays: number,
  worthImplementing: boolean
}
```

---

##### prioritizeByImpact(recommendations): Recommendation[]

Sort recommendations by potential savings.

```typescript
const prioritized = optimizer.prioritizeByImpact(recs);
```

**Returns:** Recommendation[] (sorted by savings, descending)

---

##### getRecommendationsSummary(recommendations): object

Get summary stats for recommendations.

```typescript
const summary = optimizer.getRecommendationsSummary(recs);
```

**Returns:**
```typescript
{
  count: number,
  totalSavings: number,
  highPriority: number,
  mediumPriority: number,
  lowPriority: number
}
```

---

##### estimateTotalSavings(metrics, recommendations): object

Calculate total potential savings.

```typescript
const savings = optimizer.estimateTotalSavings(metrics, recs);
```

**Returns:**
```typescript
{
  dailySavings: number,
  monthlySavings: number,
  yearlySavings: number,
  reductionPercentage: number
}
```

---

## Types

### EfficiencyMetrics

```typescript
interface EfficiencyMetrics {
  totalTasks: number;
  successCount: number;
  successRate: number; // 0-1
  totalCost: number;
  costPerTask: number;
  costPerSuccess: number;
  totalExecutionTime?: number;
  averageExecutionTime?: number;
}
```

### AgentCostBreakdown

```typescript
interface AgentCostBreakdown {
  agent: string;
  totalCost: number;
  taskCount: number;
  successCount: number;
  costPerTask: number;
}
```

### Recommendation

```typescript
interface Recommendation {
  type: 'workload_rebalance' | 'reduce_failures' | 'batch_tasks' | 'optimize_execution';
  severity: 'high' | 'medium' | 'low';
  description: string;
  potentialSavings: number;
  action?: () => void | Promise<void>;
}
```

### DailyCostTrend

```typescript
interface DailyCostTrend {
  date: string;
  totalCost: number;
  totalTasks: number;
  successRate?: number;
  costPerTask?: number;
}
```

### CostTier

```typescript
interface CostTier {
  base: number;      // Cost per second
  overhead: number;  // Fixed overhead
}
```

---

## Error Handling

### Cost Calculation

```typescript
try {
  const cost = await tracker.recordTaskCost(event);
  console.log(`Cost: $${cost.toFixed(6)}`);
} catch (error) {
  console.error('Failed to record cost:', error);
  // Cost is still returned even if DB update fails
}
```

### Metrics Retrieval

```typescript
const metrics = await tracker.getEfficiencyMetrics(date);
if (!metrics || metrics.totalTasks === 0) {
  console.log('No data for this date');
}
```

---

## Performance Tips

1. **Cache results locally**
   ```typescript
   const [metrics, setMetrics] = useState(null);
   useEffect(() => {
     fetchAndCache(date).then(setMetrics);
   }, [date]);
   ```

2. **Batch database queries**
   ```typescript
   const [metrics, agents, trends] = await Promise.all([
     tracker.getEfficiencyMetrics(date),
     tracker.getCostByAgent(date),
     tracker.getCostTrends(7),
   ]);
   ```

3. **Use memoization**
   ```typescript
   const recs = useMemo(
     () => optimizer.generateRecommendations(metrics, agents),
     [metrics, agents]
   );
   ```

4. **Debounce updates**
   ```typescript
   const handleUpdate = debounce(() => {
     fetchAndUpdate();
   }, 1000);
   ```

---

Last Updated: 2026-05-02
