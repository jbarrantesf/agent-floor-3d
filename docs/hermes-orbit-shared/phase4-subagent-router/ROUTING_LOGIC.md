# Phase 4: Routing Logic & Algorithm

**Detailed specification of the SubagentRouter scoring algorithm**

---

## 🎯 Routing Algorithm Overview

The SubagentRouter uses a **weighted multi-factor scoring system** to select the optimal subagent for each task.

### Decision Flow

```
Task Arrives
    ↓
[1] Analyze Complexity
    ├─ Type → Base complexity
    ├─ Payload size → Adjustment
    ├─ Timeout → Adjustment
    └─ Priority → Adjustment
    ↓
[2] Get Available Subagents
    ├─ Query agent_capacity table
    ├─ Filter: is_online = true
    └─ Order by: current_load ASC
    ↓
[3] Score Each Subagent
    ├─ Calculate capacity score
    ├─ Calculate specialization score
    ├─ Calculate priority score
    ├─ Calculate complexity score
    └─ Combine with weights → Final Score
    ↓
[4] Select Winner
    ├─ Find highest score
    ├─ Handle ties (use priority)
    └─ Return selected subagent
    ↓
[5] Delegate & Delegate
    ├─ Update task.assigned_to
    ├─ Record routing decision
    └─ Delegate to subagent
    ↓
Task Execution
```

---

## 📊 Scoring Formula

### Weighted Score Calculation

```
FinalScore = (CapacityScore × 0.40) +
             (SpecializationScore × 0.35) +
             (PriorityScore × 0.15) +
             (ComplexityScore × 0.10)
```

Each component is on a 0-100 scale.

---

## 🔢 Component Details

### 1. CAPACITY SCORE (40% weight)

**Purpose:** Load balancing - prefer less-loaded subagents

**Formula:**
```
CapacityScore = (RemainingCapacity / MaxCapacity) × 100
```

**Where:**
- `RemainingCapacity = MaxConcurrentTasks - CurrentLoad`
- `MaxCapacity = MaxConcurrentTasks`

**Example:**

```
Subagent Configuration:
├─ name: 'subagent_1'
├─ max_concurrent_tasks: 5
├─ current_load: 2

Calculation:
  Remaining = 5 - 2 = 3
  Score = (3 / 5) × 100 = 60 points
```

**Properties:**
- Range: 0-100
- Higher is better
- Scales linearly with available capacity
- Prevents overloading

**Edge Cases:**
- If `current_load ≥ max_concurrent_tasks`: Score = 0 (full)
- If `current_load = 0`: Score = 100 (empty)

---

### 2. SPECIALIZATION SCORE (35% weight)

**Purpose:** Task type expertise - prefer specialists

**Formula:**
```
SpecializationScore = isSpecialist ? 100 : 50
```

**Task Type → Specialization Mapping:**

```typescript
const mapping = {
  'file_read': 'file_ops',
  'file_write': 'file_ops',
  'sql_execute': 'sql',
  'shell': 'shell',
  'webhook': 'http',
  'http': 'http',
};
```

**Example:**

```
Task: 'shell' command
Task requires: 'shell' specialization

Subagent Evaluation:
├─ subagent_1: specialization = ['file_ops', 'shell']
│  └─ Contains 'shell'? YES → Score = 100
├─ subagent_2: specialization = ['sql', 'http']
│  └─ Contains 'shell'? NO → Score = 50
└─ subagent_3: specialization = ['shell', 'http', 'file_ops']
   └─ Contains 'shell'? YES → Score = 100
```

**Subagent Specializations (Default):**

```typescript
SUBAGENT_SPECS = {
  'subagent_1': {
    specialization: ['file_ops', 'shell'],
    // Expert in: File operations, Shell commands
  },
  'subagent_2': {
    specialization: ['sql', 'http'],
    // Expert in: Database queries, HTTP requests
  },
  'subagent_3': {
    specialization: ['shell', 'http', 'file_ops'],
    // Generalist in: All three areas (higher priority)
  },
};
```

**Configuration Control:**

```typescript
// Enable specialization matching (default)
const router = new SubagentRouter(supabase, 'orbit', {
  enableSpecializationMatching: true,
});

// Disable specialization (all get 100 points)
const router = new SubagentRouter(supabase, 'orbit', {
  enableSpecializationMatching: false,
});
```

---

### 3. PRIORITY SCORE (15% weight)

**Purpose:** Tiebreaker - prefer high-priority subagents

**Formula:**
```
PriorityScore = SubagentPriority × 50
```

**Example:**

```
Subagent priorities:
├─ subagent_1: priority = 1 → Score = 1 × 50 = 50
├─ subagent_2: priority = 1 → Score = 1 × 50 = 50
└─ subagent_3: priority = 2 → Score = 2 × 50 = 100 ← Higher priority
```

**Use Case:** When subagents have equal capacity and specialization, the higher-priority subagent is selected.

**Scenario:**

```
Two subagents have:
- Same remaining capacity
- Both are specialists
- Different priorities

Example:
├─ subagent_1: All scores equal except priority
│  ├─ Capacity: 60
│  ├─ Specialization: 100 (specialist)
│  └─ Priority: 50 (priority=1)
│     TOTAL = (60×0.4) + (100×0.35) + (50×0.15) + ... = 79
│
└─ subagent_3: All scores equal except priority
   ├─ Capacity: 60
   ├─ Specialization: 100 (specialist)
   └─ Priority: 100 (priority=2)
      TOTAL = (60×0.4) + (100×0.35) + (100×0.15) + ... = 89 ← WINNER
```

---

### 4. COMPLEXITY SCORE (10% weight)

**Purpose:** Match task difficulty to subagent capability

**Formula:**
```
ComplexityScore = complexity < 5 ? 100 : 75
```

**Rationale:**
- Simple tasks (complexity 0-4): All subagents equally capable → 100 points
- Complex tasks (complexity 5-10): Prefer capable subagents → 75 points

**Example:**

```
Task 1: file_read
├─ Base complexity: 1
├─ Small payload: +0
├─ Normal timeout: +0
├─ Normal priority: +0
└─ Total: 1 (simple)
   Complexity Score = 100

Task 2: sql_execute + large payload + high priority
├─ Base complexity: 4
├─ Payload > 50KB: +3
├─ Long timeout (> 300s): +1
├─ High priority: +1
└─ Total: 9 (complex, capped at 10)
   Complexity Score = 75
```

**Complexity Calculation Details:** [See Complexity Analysis section below]

---

## 📐 Task Complexity Analysis

Complexity is calculated on a **0-10 scale** when a task arrives.

### Base Complexity by Type

```typescript
TASK_COMPLEXITY_BASELINE = {
  'file_read': 1,      // Simple read operation
  'file_write': 2,     // Slightly more complex (I/O wait)
  'shell': 3,          // System-dependent, variable
  'sql_execute': 4,    // Most complex (DB locks, performance)
  'webhook': 2,        // Network call
  'http': 2,           // Network call
  'deployment': 5,     // High complexity (multiple steps)
};
```

### Complexity Adjustments

**Payload Size Adjustment:**
```
> 10 KB:   +2 complexity
> 50 KB:   +3 complexity
≤ 10 KB:   +0 complexity
```

**Timeout Adjustment:**
```
< 30 seconds:  +1 complexity (very tight deadline)
> 300 seconds: +1 complexity (very long wait, risk of timeout)
30-300 sec:    +0 complexity (normal)
```

**Priority Adjustment:**
```
Priority ≥ 2 (high): +1 complexity
Priority < 2 (low):  +0 complexity
```

**Final Calculation:**

```
TotalComplexity = BaseComplexity +
                  PayloadAdjustment +
                  TimeoutAdjustment +
                  PriorityAdjustment

Capped at: 10 (maximum)
```

### Example Complexity Calculations

**Example 1: Simple shell command**
```
Task: { task_type: 'shell', timeout_seconds: 60, priority: 0, payload_size: 100 }

Base:     1 (file_read)
+ Wait:   +1 (normal timeout)
+ Wait:   +0 (payload OK)
+ Wait:   +0 (priority 0)
──────────────
Total:    3 (simple)
```

**Example 2: Large SQL query**
```
Task: { task_type: 'sql_execute', timeout_seconds: 600, priority: 2, payload_size: 75000 }

Base:     4 (sql_execute)
+ Timeout: +1 (600s > 300s, risk of long lock)
+ Payload: +3 (> 50KB)
+ Priority: +1 (high priority = more critical)
──────────────
Total:    9 (complex)
Capped:   9 (≤ 10)
```

**Example 3: Deployment**
```
Task: { task_type: 'deployment', timeout_seconds: 1200, priority: 2, payload_size: 5000 }

Base:     5 (deployment)
+ Timeout: +1 (1200s > 300s)
+ Payload: +0 (5KB ≤ 10KB)
+ Priority: +1 (high priority)
──────────────
Total:    8 (complex)
```

---

## 🎲 Complete Scoring Example

### Scenario: Route a shell command

**Task Details:**
```typescript
{
  id: 'task_001',
  task_type: 'shell',
  timeout_seconds: 60,
  priority: 1,
  payload: 'git status'  // ~20 bytes
}
```

**Complexity Calculation:**
```
Base (shell):              3
+ Payload (20B):          +0 (≤ 10KB)
+ Timeout (60s):          +0 (30s < 60s < 300s)
+ Priority (1):           +0 (< 2)
────────────────────────
Total Complexity:         3
Complexity Score:       100 (3 < 5)
```

**Available Subagents (from DB):**
```
subagent_1:
  name: 'subagent_1'
  current_load: 3
  max_concurrent_tasks: 5
  specialization: ['file_ops', 'shell']
  priority: 1

subagent_2:
  name: 'subagent_2'
  current_load: 4
  max_concurrent_tasks: 5
  specialization: ['sql', 'http']
  priority: 1

subagent_3:
  name: 'subagent_3'
  current_load: 1
  max_concurrent_tasks: 5
  specialization: ['shell', 'http', 'file_ops']
  priority: 2
```

**Scoring for each:**

**subagent_1:**
```
Remaining: 5 - 3 = 2
Capacity Score:       (2 / 5) × 100 = 40
Specialization:       100 (has 'shell')
Priority:             1 × 50 = 50
Complexity:           100 (3 < 5)

Final Score = (40 × 0.40) + (100 × 0.35) + (50 × 0.15) + (100 × 0.10)
            = 16 + 35 + 7.5 + 10
            = 68.5
```

**subagent_2:**
```
Remaining: 5 - 4 = 1
Capacity Score:       (1 / 5) × 100 = 20
Specialization:       50 (no 'shell')
Priority:             1 × 50 = 50
Complexity:           100 (3 < 5)

Final Score = (20 × 0.40) + (50 × 0.35) + (50 × 0.15) + (100 × 0.10)
            = 8 + 17.5 + 7.5 + 10
            = 43.0
```

**subagent_3:**
```
Remaining: 5 - 1 = 4
Capacity Score:       (4 / 5) × 100 = 80
Specialization:       100 (has 'shell')
Priority:             2 × 50 = 100
Complexity:           100 (3 < 5)

Final Score = (80 × 0.40) + (100 × 0.35) + (100 × 0.15) + (100 × 0.10)
            = 32 + 35 + 15 + 10
            = 92.0 ← HIGHEST
```

**Result:**

```
Scoring Summary:
├─ subagent_1: 68.5
├─ subagent_2: 43.0
└─ subagent_3: 92.0 ← SELECTED

Reason: Highest remaining capacity (4/5), specialist in shell,
        higher priority (2 vs 1), suitable complexity match
```

---

## 🔄 Advanced Scenarios

### Scenario 1: All Subagents At Capacity

```
All subagents have load = max_concurrent_tasks

Options:
1. Wait and retry (recommended)
2. Force route to least loaded (with warning)
3. Reject task (error response)

Current Implementation: Throws error (option 3)
```

### Scenario 2: Specialization Conflict

```
Task: database migration (sql + file operations)
Requires: Both 'sql' and 'file_ops'

Resolution: Use primary type (sql_execute)
→ Route to 'sql' specialist
→ Assume capability for file_ops is secondary
```

### Scenario 3: Dynamic Subagent Addition

```
New subagent_4 comes online:
├─ specialization: ['http', 'file_ops']
├─ max_concurrent_tasks: 10
└─ priority: 1

Next routing query will include subagent_4
Previous routing decisions unaffected
```

---

## 📈 Performance Characteristics

### Time Complexity

```
For N subagents:
- Get available: O(N) database query
- Score each:   O(N) loop (constant work per subagent)
- Select best:  O(N) max finding
────────────────────────────
Total:          O(N) linear time
```

### Space Complexity

```
- Score array:      O(N)
- Storage:          O(1) per routing decision
────────────────────────────
Total:              O(N) with subagent pool
```

### Typical Performance

```
10 subagents:  20-30ms per routing decision
50 subagents:  50-80ms per routing decision
100 subagents: 100-150ms per routing decision

Target: < 100ms for < 50 subagents
```

---

## 🔧 Configuration & Customization

### Changing Weights

```typescript
const router = new SubagentRouter(supabase, 'orbit', {
  scoreWeights: {
    capacity: 0.5,           // Increase load balancing importance
    specialization: 0.25,    // Decrease specialization importance
    priority: 0.15,
    complexity: 0.1,
  }
});
```

### New Weight Distribution

```
Use Case: Minimize overhead (don't care about specialization)
────────────────────────────────────────────────────────────
capacity:       0.70  (heavily prefer load balancing)
specialization: 0.10  (don't care)
priority:       0.10
complexity:     0.10

Result: Tasks route based almost entirely on available capacity
```

### Disabling Specialization

```typescript
const router = new SubagentRouter(supabase, 'orbit', {
  enableSpecializationMatching: false,
});

// All subagents get specialization score = 100
// Effectively ignores specialization (only capacity, priority, complexity matter)
```

---

## 🐛 Debugging Scoring

### Enable Verbose Logging

```typescript
// In SubagentRouter.selectBestSubagent():
console.log(
  `[SubagentRouter] Scoring for task type "${taskType}":`,
  scoredSubagents
    .map((s) => `${s.agent.name}=${s.score.toFixed(1)}`)
    .join(', ')
);

// Output:
// [SubagentRouter] Scoring for task type "shell":
//   subagent_1=68.5, subagent_2=43.0, subagent_3=92.0
```

### Get Detailed Score Breakdown

```typescript
// In RoutingDecision interface:
scoreCalculation?: {
  capacityScore: number;
  specializationScore: number;
  priorityScore: number;
  complexityScore: number;
  finalScore: number;
};

// Use for analysis and debugging
```

---

## ✅ Testing the Algorithm

### Test Case: Load Balancing

```typescript
it('should select subagent with lowest load', () => {
  const agents = [
    { name: 'sub1', current_load: 4, ... },
    { name: 'sub2', current_load: 2, ... },  // Lower
    { name: 'sub3', current_load: 3, ... },
  ];
  
  const selected = router.selectBestSubagent(agents, 'shell', 3);
  expect(selected?.name).toBe('sub2');  // Lowest load
});
```

### Test Case: Specialization Preference

```typescript
it('should prefer specialist over generalist at same load', () => {
  const agents = [
    { name: 'sub1', load: 1, specialization: ['file_ops', 'shell'], ... },
    { name: 'sub2', load: 1, specialization: ['sql', 'http'], ... },
  ];
  
  const selected = router.selectBestSubagent(agents, 'shell', 3);
  expect(selected?.name).toBe('sub1');  // Specialist
});
```

---

## 📊 References

- [SubagentRouter Implementation](../README.md)
- [Usage Examples](./EXAMPLES.md)
- [Configuration Reference](../src/config/subagents.ts)

---

**Last Updated:** 2026-05-02  
**Algorithm Version:** 1.0  
**Status:** Production Ready
