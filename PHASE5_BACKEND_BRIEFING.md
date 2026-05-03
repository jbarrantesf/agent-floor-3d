# 💰 PHASE 5: COST TRACKING & ANALYTICS DASHBOARD

**From:** Hermes  
**To:** ORBIT + Backend Team  
**Date:** 2026-05-02  
**Status:** Ready for immediate implementation  
**Priority:** HIGH (Supports Phase 6)  
**Dependency:** Phase 4 ✅

---

## 📋 TL;DR

**Every task has a cost. José needs to see it.**

Your task: Wire `cost_daily_summary` table to Hermes/ORBIT and build real-time analytics:
- ✅ Cost calculator per task (execution time → $ cost)
- ✅ Real-time cost dashboard
- ✅ Daily cost trends
- ✅ Per-agent cost breakdown
- ✅ Efficiency metrics (cost per task, cost per success)
- ✅ Cost optimization recommendations
- ✅ Export capabilities (CSV, PDF)

**Time estimate:** 4-5 hours  
**Cost estimate:** $0.35

---

## 🎯 COST MODEL

### Task Cost Calculation

```
Task Cost = (Execution Time × Model Cost/sec) + Resource Overhead

Example (using Hermes tier):
  Task: Shell command (executed on Agent-1)
  Duration: 3.2 seconds
  Model: qwen2.5-coder (0.00008 USD/sec when running)
  
  Base cost = 3.2 * 0.00008 = $0.000256
  Overhead = $0.0001 (Supabase reads/writes)
  Total = $0.000356 ≈ $0.00036

Example (larger task):
  Task: SQL query (10 seconds, on Agent-2)
  Duration: 10 seconds
  Model: Default (0.00005 USD/sec)
  
  Base = 10 * 0.00005 = $0.0005
  Overhead = $0.0002
  Total = $0.0007
```

### Cost Tiers (by task type)

```
TASK TYPE          BASE COST/SEC    OVERHEAD    NOTES
─────────────────────────────────────────────────────────
file_ops           $0.00001         $0.0001     Read/write files
shell_exec         $0.00008         $0.0001     Run shell commands
sql_query          $0.00005         $0.0002     Database ops
http_request       $0.00003         $0.00015    API calls
webhook            $0.00002         $0.00015    Webhook triggers
```

---

## 📊 IMPLEMENTATION BREAKDOWN

### PHASE 5A: Cost Calculation Engine (1.5 hours)

```typescript
// src/lib/cost-calculator.ts

export class CostCalculator {
  // Task cost tiers
  private costTiers = {
    file_ops: { base: 0.00001, overhead: 0.0001 },
    shell: { base: 0.00008, overhead: 0.0001 },
    sql: { base: 0.00005, overhead: 0.0002 },
    http: { base: 0.00003, overhead: 0.00015 },
    webhook: { base: 0.00002, overhead: 0.00015 }
  };
  
  // Calculate task cost
  calculateTaskCost(task: Task, executionTimeMs: number): number {
    const executionTimeSec = executionTimeMs / 1000;
    const tier = this.costTiers[task.task_type] || { base: 0.00005, overhead: 0.0001 };
    
    const baseCost = executionTimeSec * tier.base;
    const overhead = tier.overhead;
    
    return baseCost + overhead;
  }
  
  // Estimate task cost (before execution)
  estimateTaskCost(task: Task): number {
    // Use average execution time for task type
    const avgExecutionMs = this.getAverageExecutionTime(task.task_type);
    return this.calculateTaskCost(task, avgExecutionMs);
  }
  
  // Get average execution time from historical data
  private getAverageExecutionTime(taskType: string): number {
    // Query cost_daily_summary or cache
    // Default estimates:
    const defaults = {
      file_ops: 1000,      // 1 second
      shell: 2000,         // 2 seconds
      sql: 3000,           // 3 seconds
      http: 2500,          // 2.5 seconds
      webhook: 1500        // 1.5 seconds
    };
    return defaults[taskType] || 2000;
  }
}
```

**Deliverables:**
- ✅ Cost calculator with task type tiers
- ✅ Execution time → cost conversion
- ✅ Overhead tracking
- ✅ Estimation function

---

### PHASE 5B: Real-time Cost Tracking (1.5 hours)

```typescript
// src/lib/cost-tracker.ts

export class CostTracker {
  private supabase: SupabaseClient;
  private calculator: CostCalculator;
  private dailyCosts = new Map<string, number>();
  
  // Listen to task completions
  subscribeToTaskCosts(): void {
    const channel = this.supabase
      .channel('task_costs')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'task_events',
          filter: 'event_type=eq.COMPLETED'
        },
        async (payload) => {
          const event = payload.new as TaskEvent;
          const cost = await this.recordTaskCost(event);
          this.publishCostUpdate({ taskId: event.task_id, cost });
        }
      )
      .subscribe();
  }
  
  // Record task cost in database
  private async recordTaskCost(event: TaskEvent): Promise<number> {
    const cost = this.calculator.calculateTaskCost(
      event.task,
      event.execution_time_ms
    );
    
    const today = new Date().toISOString().split('T')[0];
    
    // Upsert into cost_daily_summary
    const { error } = await this.supabase
      .from('cost_daily_summary')
      .upsert({
        date: today,
        task_type: event.task.task_type,
        executor_name: event.agent_name,
        total_tasks: 1,
        success_count: event.event_type === 'COMPLETED' ? 1 : 0,
        total_cost_usd: cost,
        avg_execution_time_ms: event.execution_time_ms
      }, { onConflict: 'date,task_type,executor_name' });
    
    if (error) console.error('Cost tracking error:', error);
    
    // Update in-memory daily total
    this.dailyCosts.set(today, (this.dailyCosts.get(today) || 0) + cost);
    
    return cost;
  }
  
  // Get daily cost
  getDailyCost(): number {
    const today = new Date().toISOString().split('T')[0];
    return this.dailyCosts.get(today) || 0;
  }
  
  // Get cost breakdown by agent
  async getCostByAgent(date: string): Promise<Map<string, number>> {
    const { data } = await this.supabase
      .from('cost_daily_summary')
      .select('executor_name, total_cost_usd')
      .eq('date', date);
    
    const breakdown = new Map<string, number>();
    data?.forEach(row => {
      breakdown.set(
        row.executor_name,
        (breakdown.get(row.executor_name) || 0) + row.total_cost_usd
      );
    });
    
    return breakdown;
  }
  
  // Get efficiency metrics
  async getEfficiencyMetrics(date: string): Promise<EfficiencyMetrics> {
    const { data } = await this.supabase
      .from('cost_daily_summary')
      .select('total_tasks, success_count, total_cost_usd, task_type')
      .eq('date', date);
    
    const totalTasks = data?.reduce((sum, row) => sum + row.total_tasks, 0) || 0;
    const successCount = data?.reduce((sum, row) => sum + row.success_count, 0) || 0;
    const totalCost = data?.reduce((sum, row) => sum + row.total_cost_usd, 0) || 0;
    
    return {
      totalTasks,
      successCount,
      successRate: successCount / totalTasks || 0,
      totalCost,
      costPerTask: totalCost / totalTasks || 0,
      costPerSuccess: successCount > 0 ? totalCost / successCount : 0
    };
  }
}
```

**Deliverables:**
- ✅ Realtime cost recording
- ✅ Daily cost aggregation
- ✅ Cost breakdown by agent
- ✅ Efficiency metrics calculation

---

### PHASE 5C: Analytics Dashboard Component (1.5 hours)

```typescript
// src/components/CostDashboard.tsx

export function CostDashboard(): JSX.Element {
  const [dailyCost, setDailyCost] = useState(0);
  const [costByAgent, setCostByAgent] = useState<Map<string, number>>(new Map());
  const [metrics, setMetrics] = useState<EfficiencyMetrics | null>(null);
  const [costTrends, setCostTrends] = useState<DailyCostTrend[]>([]);
  
  // Subscribe to real-time cost updates
  useEffect(() => {
    const costTracker = new CostTracker(supabase, calculator);
    costTracker.subscribeToTaskCosts();
    
    // Poll for updates every minute
    const interval = setInterval(async () => {
      setDailyCost(costTracker.getDailyCost());
      
      const today = new Date().toISOString().split('T')[0];
      setCostByAgent(await costTracker.getCostByAgent(today));
      setMetrics(await costTracker.getEfficiencyMetrics(today));
      
      // Get last 7 days trends
      const trends = await getCostTrends(7);
      setCostTrends(trends);
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="cost-dashboard">
      {/* Summary Cards */}
      <div className="metrics-grid">
        <MetricCard
          title="Today's Cost"
          value={`$${dailyCost.toFixed(2)}`}
          trend="↑ 12%" // vs yesterday
          color="primary"
        />
        <MetricCard
          title="Success Rate"
          value={`${(metrics?.successRate || 0) * 100}%`}
          trend="↑ 2%"
          color="success"
        />
        <MetricCard
          title="Avg Cost/Task"
          value={`$${(metrics?.costPerTask || 0).toFixed(4)}`}
          trend="↓ 3%"
          color="info"
        />
        <MetricCard
          title="Cost/Success"
          value={`$${(metrics?.costPerSuccess || 0).toFixed(4)}`}
          trend="↓ 1%"
          color="warning"
        />
      </div>
      
      {/* Agent Cost Breakdown */}
      <div className="chart-container">
        <h3>Cost by Agent (Today)</h3>
        <AgentCostChart data={costByAgent} />
      </div>
      
      {/* 7-Day Trend */}
      <div className="chart-container">
        <h3>7-Day Cost Trend</h3>
        <CostTrendChart data={costTrends} />
      </div>
      
      {/* Task Type Breakdown */}
      <div className="chart-container">
        <h3>Cost by Task Type</h3>
        <TaskTypeCostChart data={metrics} />
      </div>
      
      {/* Recommendations */}
      <div className="recommendations">
        <h3>Optimization Recommendations</h3>
        <RecommendationsList metrics={metrics} costByAgent={costByAgent} />
      </div>
      
      {/* Export */}
      <div className="actions">
        <button onClick={() => exportToCSV()}>Export CSV</button>
        <button onClick={() => exportToPDF()}>Export PDF</button>
      </div>
    </div>
  );
}

// Metric Card Component
function MetricCard(props: { title: string; value: string; trend: string; color: string }): JSX.Element {
  return (
    <div className={`metric-card ${props.color}`}>
      <span className="title">{props.title}</span>
      <span className="value">{props.value}</span>
      <span className="trend">{props.trend}</span>
    </div>
  );
}

// Cost Trend Chart
function CostTrendChart(props: { data: DailyCostTrend[] }): JSX.Element {
  return (
    <LineChart
      data={props.data}
      xAxis="date"
      yAxis="totalCost"
      title="Daily Cost"
      color="#FF6B6B"
    />
  );
}

// Agent Cost Breakdown
function AgentCostChart(props: { data: Map<string, number> }): JSX.Element {
  const chartData = Array.from(props.data.entries()).map(([agent, cost]) => ({
    name: agent,
    value: cost
  }));
  
  return (
    <PieChart
      data={chartData}
      title="Cost Distribution"
    />
  );
}
```

**Deliverables:**
- ✅ Summary metric cards
- ✅ Agent cost breakdown chart
- ✅ 7-day trend chart
- ✅ Task type cost analysis
- ✅ Export functionality

---

### PHASE 5D: Optimization Recommendations (1 hour)

```typescript
// src/lib/cost-optimizer.ts

export class CostOptimizer {
  // Generate recommendations based on metrics
  generateRecommendations(
    metrics: EfficiencyMetrics,
    costByAgent: Map<string, number>,
    agentStats: AgentStats[]
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];
    
    // Recommendation 1: Rebalance workload if one agent is taking 60%+ of cost
    const totalCost = metrics.totalCost;
    for (const [agent, cost] of costByAgent) {
      const percentage = cost / totalCost;
      if (percentage > 0.6) {
        recommendations.push({
          type: 'workload_rebalance',
          severity: 'medium',
          description: `${agent} is handling ${(percentage * 100).toFixed(1)}% of costs. Consider distributing tasks more evenly.`,
          potentialSavings: cost * 0.1, // Estimate 10% improvement
          action: () => adjustSubagentWeights(agent, 0.8)
        });
      }
    }
    
    // Recommendation 2: Reduce failed tasks (cost without return)
    if (metrics.successRate < 0.95) {
      const failedTaskCost = metrics.totalCost * (1 - metrics.successRate);
      recommendations.push({
        type: 'reduce_failures',
        severity: 'high',
        description: `Success rate is ${(metrics.successRate * 100).toFixed(1)}%. Failed tasks cost $${failedTaskCost.toFixed(4)} with no return.`,
        potentialSavings: failedTaskCost * 0.5, // Estimate 50% improvement if fixed
        action: () => investigateFailures()
      });
    }
    
    // Recommendation 3: Batch similar tasks
    recommendations.push({
      type: 'batch_tasks',
      severity: 'low',
      description: 'Batch similar tasks together to reduce overhead.',
      potentialSavings: metrics.totalCost * 0.05, // Estimate 5% improvement
      action: () => enableTaskBatching()
    });
    
    return recommendations.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }
}

// src/components/RecommendationsList.tsx

export function RecommendationsList(props: {
  metrics: EfficiencyMetrics;
  costByAgent: Map<string, number>;
}): JSX.Element {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  
  useEffect(() => {
    const optimizer = new CostOptimizer();
    const recs = optimizer.generateRecommendations(
      props.metrics,
      props.costByAgent,
      [] // agentStats
    );
    setRecommendations(recs);
  }, [props.metrics, props.costByAgent]);
  
  return (
    <div className="recommendations-list">
      {recommendations.map((rec, idx) => (
        <div key={idx} className={`recommendation ${rec.severity}`}>
          <span className="icon">💡</span>
          <div className="content">
            <h4>{rec.type.replace(/_/g, ' ')}</h4>
            <p>{rec.description}</p>
            <span className="savings">
              Potential savings: ${rec.potentialSavings.toFixed(4)}/day
            </span>
          </div>
          <button onClick={() => rec.action()}>Apply</button>
        </div>
      ))}
    </div>
  );
}
```

**Deliverables:**
- ✅ Workload rebalancing recommendations
- ✅ Failure rate analysis
- ✅ Task batching suggestions
- ✅ Potential savings estimates
- ✅ One-click actions

---

## 📁 FILES TO CREATE

```
src/lib/
├─ cost-calculator.ts               # Cost calculation engine
├─ cost-tracker.ts                  # Real-time cost tracking
├─ cost-optimizer.ts                # Optimization engine
└─ cost-export.ts                   # CSV/PDF export

src/components/
├─ CostDashboard.tsx                # Main dashboard
├─ MetricCard.tsx                   # Summary cards
├─ AgentCostChart.tsx               # Pie chart (agent breakdown)
├─ CostTrendChart.tsx               # Line chart (7-day trend)
├─ TaskTypeCostChart.tsx            # Cost by task type
├─ RecommendationsList.tsx          # Recommendations UI
└─ ExportButton.tsx                 # CSV/PDF export

src/types/
├─ cost.ts                          # Cost-related types
└─ metrics.ts                       # Metrics types

src/styles/
└─ cost-dashboard.css               # Dashboard styling

tests/
├─ cost-calculator.test.ts          # Calculator tests
├─ cost-tracker.test.ts             # Tracker tests
└─ CostDashboard.test.tsx           # Component tests
```

---

## 🎯 SUCCESS CRITERIA

Phase 5 is complete when:

- [ ] Cost calculator accurately calculates task costs
- [ ] Real-time cost tracking working (updates <5 seconds after task complete)
- [ ] Dashboard shows accurate daily/agent/task-type breakdown
- [ ] 7-day trends displayed correctly
- [ ] Efficiency metrics calculated accurately
- [ ] Recommendations generated and actionable
- [ ] Export functionality working (CSV + PDF)
- [ ] All tests passing (80%+ coverage)

**Demo:**
```
Task completes (3.2 seconds)
  ↓
Cost calculated: $0.00036
  ↓
Supabase updated
  ↓
Dashboard refreshes automatically
  ↓
Daily total: $2.45 → $2.45036
  ↓
Agent-1 cost increases
  ↓
Efficiency metrics update
  ↓
Recommendation appears: "Success rate high, tasks balanced well"
```

---

## 💪 PERFORMANCE TARGETS

- **Cost calculation:** <5ms per task
- **Dashboard update latency:** <5 seconds
- **Chart rendering:** <1 second
- **Database queries:** <100ms
- **Export generation:** <2 seconds

---

## 🔑 DEPENDENCIES

Already available:
- ✅ cost_daily_summary table (Phase 1)
- ✅ task_events table (Phase 1)
- ✅ Supabase client
- ✅ React setup

New for Phase 5:
- Chart library (Recharts or Chart.js)
- Export library (papaparse for CSV, pdfkit for PDF)

---

**Status:** Ready for implementation  
**Time:** 4-5 hours  
**Cost:** $0.35

---

**From Hermes to Backend:**

"Track every task cost. Show José the money. Build the analytics. Make optimization obvious. This is how we win on margins. 💰"

---

Last Updated: 2026-05-02 19:45 AM
