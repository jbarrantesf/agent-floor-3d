# 🚀 PHASE 4: ORBIT SUBAGENT ROUTER IMPLEMENTATION

**From:** Hermes  
**To:** ORBIT  
**Date:** 2026-05-02  
**Status:** Ready for immediate implementation  
**Priority:** HIGH  
**Dependency:** Phase 3 ✅ (TaskManager ready)

---

## 📋 TL;DR

**Hermes can delegate to ORBIT. Now ORBIT needs to distribute work to SUBAGENTS.**

Your task: Build `SubagentRouter.ts` class that:
- ✅ Receives tasks from Hermes (via TaskQueue)
- ✅ Analyzes task characteristics (type, complexity, data size)
- ✅ Selects best subagent based on capacity + specialization
- ✅ Delegates subtasks with intelligent load balancing
- ✅ Aggregates results from subagents
- ✅ Reports final result back to Hermes
- ✅ Handles failures & automatic retries

**Time estimate:** 6-7 hours  
**Cost estimate:** $0.50  
**Complexity:** Medium-High (async orchestration, fault tolerance)

---

## 🎯 WHAT YOU NEED TO BUILD

### File Location
```
src/lib/SubagentRouter.ts
```

### Class Structure

```typescript
export class SubagentRouter {
  // Constructor
  constructor(
    supabase: SupabaseClient,
    agentName: string = 'orbit'
  );

  // Core Methods
  start(): Promise<void>;                    // Start listening
  stop(): Promise<void>;                     // Stop gracefully
  
  // Task Routing
  private routeTask(task: Task): Promise<void>;           // Decide & dispatch
  private selectBestSubagent(
    availableSubagents: AgentStatus[],
    taskType: string,
    taskComplexity: number
  ): AgentStatus;
  
  // Subagent Delegation
  private delegateToSubagent(
    subagentName: string,
    task: Task
  ): Promise<Task>;
  
  // Result Aggregation
  private aggregateResults(
    taskId: string,
    subtaskResults: TaskExecutionResult[]
  ): Promise<void>;
  
  // Monitoring
  private updateRoutingStats(result: TaskExecutionResult): void;
  subscribeToRoutingEvents(callback: (event: RoutingEvent) => void): () => void;
  
  getRoutingStats(): RoutingStats;
}
```

### Interface Definitions

```typescript
interface SubagentSpec {
  name: string;
  specialization: string[];  // ['file_ops', 'sql', 'shell', 'http']
  max_concurrent_tasks: number;
  priority: number;          // Tiebreaker (higher = preferred)
}

interface RoutingDecision {
  taskId: string;
  selectedSubagent: string;
  reason: string;
  complexity: number;
  parallelizable: boolean;
}

interface RoutingEvent {
  taskId: string;
  eventType: 'routed' | 'aggregated' | 'failed' | 'delegated';
  subagentName?: string;
  data: Record<string, any>;
  timestamp: string;
}

interface RoutingStats {
  totalTasksRouted: number;
  successfulRoutes: number;
  failedRoutes: number;
  averageRoutingTimeMs: number;
  averageExecutionTimeMs: number;
  subagentUtilization: Record<string, number>;  // % utilization per subagent
}
```

---

## 📊 IMPLEMENTATION DETAILS

### 1. ROUTE LOGIC

When ORBIT receives a task from Hermes:

```
Task arrives (from Hermes)
    ↓
Analyze task characteristics:
  - task_type (file_write, shell, sql, etc)
  - payload size (small, medium, large)
  - complexity (simple, medium, complex)
  - can_parallelize (true/false)
    ↓
Get available subagents:
  SELECT * FROM agent_capacity 
  WHERE agent_name IN ('subagent_1', 'subagent_2', ..., 'subagent_N')
  AND is_online = true
  ORDER BY current_load ASC
    ↓
Select best subagent using scoring:
  score = (
    capacity_remaining * 0.5 +           // Prefer less loaded
    specialization_match * 0.3 +          // Prefer specialist
    priority_level * 0.2                  // Priority tiebreaker
  )
    ↓
Delegate to selected subagent
    ↓
Wait for result
    ↓
Aggregate & return to Hermes
```

### 2. SUBAGENT SPECIALIZATIONS

Define what each subagent is good at:

```typescript
const SUBAGENT_SPECS: Record<string, SubagentSpec> = {
  subagent_1: {
    name: 'subagent_1',
    specialization: ['file_ops', 'shell'],
    max_concurrent_tasks: 5,
    priority: 1
  },
  subagent_2: {
    name: 'subagent_2',
    specialization: ['sql', 'http'],
    max_concurrent_tasks: 5,
    priority: 1
  },
  subagent_3: {
    name: 'subagent_3',
    specialization: ['shell', 'http', 'file_ops'],
    max_concurrent_tasks: 5,
    priority: 2  // Higher priority if available
  },
  // ... up to N subagents
};
```

### 3. ROUTING SCORING

```typescript
private scoreSubagent(
  subagent: AgentStatus,
  taskType: string,
  complexity: number
): number {
  const spec = SUBAGENT_SPECS[subagent.name];
  
  // Capacity score (0-100): remaining capacity
  const capacityRemaining = subagent.max_concurrent_tasks - subagent.current_load;
  const capacityScore = (capacityRemaining / subagent.max_concurrent_tasks) * 100;
  
  // Specialization score (0-100): task matches specialization
  const isSpecialist = spec.specialization.includes(taskType);
  const specializationScore = isSpecialist ? 100 : 50;
  
  // Priority score (0-100): subagent priority
  const priorityScore = spec.priority * 50;
  
  // Complexity adjustment (0-100): prefer simple for less capable agents
  const complexityScore = complexity < 5 ? 100 : 75;
  
  // Final scoring
  return (
    capacityScore * 0.4 +
    specializationScore * 0.35 +
    priorityScore * 0.15 +
    complexityScore * 0.1
  );
}
```

### 4. TASK COMPLEXITY ANALYSIS

Analyze incoming task to determine complexity:

```typescript
private analyzeTaskComplexity(task: Task): number {
  let complexity = 0;
  
  // Base complexity by type
  const typeComplexity: Record<string, number> = {
    file_read: 1,
    file_write: 2,
    shell: 3,
    sql_execute: 4,
    webhook: 2,
    http: 2,
  };
  complexity = typeComplexity[task.task_type] || 3;
  
  // Payload size adjustment
  const payloadSize = JSON.stringify(task.payload).length;
  if (payloadSize > 10000) complexity += 2;
  if (payloadSize > 50000) complexity += 3;
  
  // Timeout adjustment
  if (task.timeout_seconds < 30) complexity += 1;
  if (task.timeout_seconds > 300) complexity += 1;
  
  // Priority adjustment
  if (task.priority >= 2) complexity += 1;
  
  return Math.min(complexity, 10);  // Cap at 10
}
```

### 5. RESULT AGGREGATION

For batch tasks, combine subagent results:

```typescript
private aggregateResults(
  taskId: string,
  subtaskResults: TaskExecutionResult[]
): TaskExecutionResult {
  const allSuccessful = subtaskResults.every(r => r.status === 'COMPLETED');
  
  return {
    taskId,
    status: allSuccessful ? 'COMPLETED' : 'PARTIAL_FAILURE',
    result: {
      subtasks: subtaskResults.map(r => ({
        subagent: r.executedBy,
        status: r.status,
        result: r.result,
        executionTimeMs: r.executionTimeMs
      })),
      totalExecutionTimeMs: subtaskResults.reduce(
        (sum, r) => sum + r.executionTimeMs, 0
      ),
      averagePerTask: subtaskResults.length > 0
        ? Math.round(
            subtaskResults.reduce((sum, r) => sum + r.executionTimeMs, 0) /
              subtaskResults.length
          )
        : 0
    },
    error_message: allSuccessful ? null : 'Some subtasks failed',
    executedBy: 'orbit-router',
    executionTimeMs: Math.max(...subtaskResults.map(r => r.executionTimeMs))
  };
}
```

### 6. MONITORING & STATS

Track routing effectiveness:

```typescript
interface RoutingStats {
  totalTasksRouted: number;
  successfulRoutes: number;
  failedRoutes: number;
  averageRoutingTimeMs: number;
  averageExecutionTimeMs: number;
  subagentUtilization: {
    'subagent_1': 35,  // % utilization
    'subagent_2': 62,
    'subagent_3': 48,
  };
  routingAccuracy: number;  // % of optimal routing decisions
}
```

---

## 🔧 IMPLEMENTATION CHECKLIST

### Phase 4A: Core Router (2 hours)
- [ ] Create SubagentRouter class scaffold
- [ ] Implement start() / stop() methods
- [ ] Implement subagent discovery
- [ ] Implement scoring algorithm
- [ ] Add logging/debugging

### Phase 4B: Routing Logic (2 hours)
- [ ] routeTask() dispatcher
- [ ] selectBestSubagent() with scoring
- [ ] delegateToSubagent() single/batch
- [ ] Task complexity analysis
- [ ] Specialization matching

### Phase 4C: Result Aggregation (1.5 hours)
- [ ] Single result delegation (pass-through)
- [ ] Batch result aggregation
- [ ] Partial failure handling
- [ ] Error recovery & fallback
- [ ] Stats tracking

### Phase 4D: Testing & Monitoring (1.5 hours)
- [ ] Unit tests for scoring
- [ ] Integration tests: Hermes → ORBIT → Subagent → Result
- [ ] Load testing (many concurrent routes)
- [ ] Subagent failure scenarios
- [ ] Utilization accuracy tests

---

## 📊 ROUTING DECISION TREE

```
Task from Hermes (type: 'shell')
  ↓
Analyze complexity (2)
  ↓
Find available subagents:
  ├─ subagent_1: capacity=3/5, specialization=['file_ops', 'shell'], score=75
  ├─ subagent_2: capacity=4/5, specialization=['sql', 'http'], score=45
  └─ subagent_3: capacity=2/5, specialization=['shell', 'http'], score=88 ← WINNER
  ↓
Delegate to subagent_3
  ↓
Wait for completion
  ↓
Return result to Hermes via realtime
```

---

## 📁 FILES TO CREATE/MODIFY

### New Files
```
src/lib/SubagentRouter.ts              # Main implementation
src/types/router.ts                    # Router-specific types
tests/SubagentRouter.test.ts           # Jest tests
```

### Configuration
```
src/config/subagents.ts                # Subagent specs and profiles
```

### Documentation to Update
```
docs/hermes-orbit-shared/phase4-subagent-router/README.md
docs/hermes-orbit-shared/phase4-subagent-router/ROUTING_LOGIC.md
docs/hermes-orbit-shared/phase4-subagent-router/EXAMPLES.md
```

---

## 🚀 SUCCESS CRITERIA

Phase 4 is complete when:

- [ ] SubagentRouter class implemented
- [ ] Can route tasks to multiple subagents
- [ ] Intelligent load balancing working
- [ ] Subagent specialization matching working
- [ ] Result aggregation working
- [ ] Monitoring stats accurate
- [ ] Tests passing (>80% coverage)
- [ ] Logs show routing decisions
- [ ] Full flow: Hermes → ORBIT router → Subagent pool → Results

**Demo Scenario:**
```
Hermes: "I have 10 tasks"
        → Delegates all to ORBIT
ORBIT:  → Analyzes each task
        → Routes to best subagent
Subagents: → Execute in parallel
          → Report results
ORBIT:  → Aggregates results
        → Returns to Hermes
Hermes: → Sees all 10 complete ✅
```

---

## 📈 PERFORMANCE TARGETS

- **Routing decision:** 50-100ms per task
- **Subagent selection:** 10-20ms (score calculation)
- **Total E2E with execution:** Depends on task (10ms-5s)
- **Concurrent capacity:** 100+ simultaneous routes
- **Routing accuracy:** >90% optimal selection

---

## 🔑 DEPENDENCIES

Already available:
- ✅ Supabase client
- ✅ Database schema (Phase 1)
- ✅ TaskQueue polling (Phase 2)
- ✅ TaskManager (Phase 3)

New for Phase 4:
- Subagent specs (config/subagents.ts)
- Scoring algorithm
- Result aggregation logic

---

## 📞 QUESTIONS?

Check:
1. `PHASE3_HERMES_STATUS.md` — What Hermes delivers
2. `docs/hermes-orbit-shared/phase2-task-queue/` — TaskQueue reference
3. `src/lib/TaskQueue.ts` — Current polling logic

---

## 🎯 DEADLINES

- **Phase 4A (Core):** By 2026-05-03 02:00 UTC
- **Phase 4B (Routing):** By 2026-05-03 05:00 UTC
- **Phase 4C (Aggregation):** By 2026-05-03 07:00 UTC
- **Phase 4D (Testing):** By 2026-05-03 10:00 UTC

**Then:** Phase 5 - Cost Tracking Dashboard 🚀

---

**From Hermes to ORBIT:**

"You've been holding down single-agent execution perfectly. Now scale it: add the subagent pool and show me intelligent routing. Let's see 3+ subagents working in concert. 🔄"

---

**Status:** Ready for implementation  
**Owner:** ORBIT  
**Support:** Hermes (available 24/7)  
**Last Updated:** 2026-05-02 10:20 AM
