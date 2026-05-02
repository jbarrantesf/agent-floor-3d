# 🚀 GUÍA TÉCNICA: Implementar Task Delegation (Código Real)

**Objetivo:** Implementación concreta del plan, paso a paso.

---

## FASE 1: DATABASE SETUP

### 1.1 Crear Supabase Tables

```sql
-- ============ TABLE 1: tasks ============
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Task definition
  goal TEXT NOT NULL,
  context TEXT,
  priority VARCHAR(10) DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
  
  -- Assignment
  assigned_to VARCHAR(30) NOT NULL, -- 'hermes' | 'orbit' | 'subagent_1'
  status VARCHAR(30) DEFAULT 'QUEUED' CHECK (status IN (
    'QUEUED', 'EXECUTING', 'COMPLETED', 'FAILED', 
    'TIMEOUT', 'BACKPRESSURE', 'PENDING_ORBIT_RECOVERY'
  )),
  
  -- Progress
  progress_percent INT DEFAULT 0,
  current_step TEXT,
  
  -- Costs
  estimated_cost DECIMAL(10, 6),
  actual_cost DECIMAL(10, 6) DEFAULT 0,
  
  -- Timing
  deadline_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- Results
  result JSONB,
  error_message TEXT,
  
  -- Retries
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  
  -- Relationships
  parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  created_by VARCHAR(30),
  
  -- Metadata
  toolsets TEXT[] DEFAULT ARRAY[]::TEXT[],
  metadata JSONB DEFAULT '{}'::JSONB
);

-- Create index on assigned_to and status for fast queries
CREATE INDEX idx_tasks_assigned_status ON tasks(assigned_to, status);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);

-- ============ TABLE 2: task_events ============
CREATE TABLE task_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP DEFAULT NOW(),
  
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- DELEGATED, STARTED, PROGRESS, COMPLETED, FAILED, TIMEOUT, RETRY
  
  agent_from VARCHAR(30),
  agent_to VARCHAR(30),
  
  -- Metrics snapshot
  metrics JSONB DEFAULT '{}'::JSONB, -- {tokensUsed, costAccrued, percent, timeRemaining}
  
  -- Full event payload
  payload JSONB DEFAULT '{}'::JSONB
);

CREATE INDEX idx_task_events_task_id ON task_events(task_id);
CREATE INDEX idx_task_events_created_at ON task_events(created_at DESC);

-- ============ TABLE 3: agent_capacity ============
CREATE TABLE agent_capacity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  agent_name VARCHAR(30) UNIQUE NOT NULL,
  max_concurrent_tasks INT DEFAULT 5,
  current_tasks INT DEFAULT 0,
  
  -- Performance metrics
  avg_task_duration_ms INT DEFAULT 0,
  avg_tokens_per_task INT DEFAULT 0,
  avg_cost_per_task DECIMAL(10, 6) DEFAULT 0,
  
  -- Reliability
  reliability_score DECIMAL(3, 2) DEFAULT 1.0 CHECK (reliability_score >= 0 AND reliability_score <= 1),
  failed_tasks INT DEFAULT 0,
  total_tasks INT DEFAULT 0,
  
  -- Health
  last_heartbeat TIMESTAMP,
  is_online BOOLEAN DEFAULT TRUE
);

-- ============ ENABLE REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE task_events;
ALTER PUBLICATION supabase_realtime ADD TABLE agent_capacity;

-- ============ ROW LEVEL SECURITY ============
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_capacity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can read" ON tasks
  FOR SELECT USING (auth.role() = 'authenticated');
  
CREATE POLICY "All authenticated users can create" ON tasks
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  
CREATE POLICY "All authenticated users can update" ON tasks
  FOR UPDATE USING (auth.role() = 'authenticated');
```

### 1.2 Verificar Setup

```bash
# Conectar a Supabase y verificar:
psql postgresql://[user]:[password]@[host]:5432/postgres

SELECT * FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('tasks', 'task_events', 'agent_capacity');

# Debería listar las 3 tablas ✅
```

---

## FASE 2: HERMES — Event Publisher

### 2.1 TypeScript Types

```typescript
// types/tasks.ts

export interface Task {
  id: string
  goal: string
  context: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  assigned_to: 'hermes' | 'orbit' | string
  status: TaskStatus
  progress_percent: number
  estimated_cost: number
  actual_cost: number
  toolsets: string[]
  created_by: string
  retry_count: number
  max_retries: number
  result?: any
  error_message?: string
  deadline_at?: number
  started_at?: number
  completed_at?: number
}

export type TaskStatus = 
  | 'QUEUED'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'FAILED'
  | 'TIMEOUT'
  | 'BACKPRESSURE'
  | 'PENDING_ORBIT_RECOVERY'

export interface DelegateTaskEvent {
  id: string
  type: 'DELEGATE_TASK'
  timestamp: number
  task: Partial<Task>
  metadata: {
    source: 'planning' | 'error_recovery' | 'user_request'
    retryCount: number
  }
}

export interface TaskStatusEvent {
  id: string
  type: 'TASK_STATUS_UPDATE'
  taskId: string
  timestamp: number
  status: TaskStatus
  progress: {
    percent: number
    currentStep: string
    estimatedTimeRemaining: number
  }
  metrics: {
    tokensUsed: number
    costAccrued: number
    wallTimeMs: number
  }
}

export interface ExecutionCompleteEvent {
  id: string
  type: 'EXECUTION_COMPLETE'
  taskId: string
  timestamp: number
  outcome: 'SUCCESS' | 'FAILURE' | 'TIMEOUT'
  result: any
  metrics: {
    totalCost: number
    totalTokens: number
    duration: number
  }
}
```

### 2.2 TaskManager (Hermes)

```typescript
// services/TaskManager.ts (runs in Hermes)

import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

class TaskManager {
  private supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  )
  
  private channel = this.supabase.channel('task_delegation')
  
  /**
   * Hermes: Create and delegate a task to ORBIT
   */
  async delegateTaskToOrbit(goal: string, context: string, opts?: {
    priority?: 'LOW' | 'MEDIUM' | 'HIGH'
    estimatedCost?: number
    deadline?: number
    toolsets?: string[]
  }): Promise<{ taskId: string }> {
    const taskId = uuidv4()
    const now = Date.now()
    
    // 1. Check ORBIT capacity
    const { data: capacity } = await this.supabase
      .from('agent_capacity')
      .select('*')
      .eq('agent_name', 'orbit')
      .single()
    
    if (!capacity) {
      throw new Error('ORBIT capacity info not found')
    }
    
    const available = capacity.max_concurrent_tasks - capacity.current_tasks
    if (available <= 0) {
      console.warn('⚠️ ORBIT queue full, task will be queued')
    }
    
    // 2. Create task in database
    const { error: taskError } = await this.supabase
      .from('tasks')
      .insert({
        id: taskId,
        goal,
        context,
        assigned_to: 'orbit',
        status: 'QUEUED',
        priority: opts?.priority || 'MEDIUM',
        estimated_cost: opts?.estimatedCost || 0.05,
        deadline_at: opts?.deadline ? new Date(opts.deadline) : null,
        toolsets: opts?.toolsets || [],
        created_by: 'hermes',
        created_at: new Date(now)
      })
    
    if (taskError) throw taskError
    
    // 3. Log to audit trail
    await this.supabase
      .from('task_events')
      .insert({
        task_id: taskId,
        event_type: 'DELEGATED',
        agent_from: 'hermes',
        agent_to: 'orbit',
        payload: {
          goal,
          estimatedCost: opts?.estimatedCost,
          toolsets: opts?.toolsets
        }
      })
    
    // 4. Emit to ORBIT via WebSocket
    const event: DelegateTaskEvent = {
      id: uuidv4(),
      type: 'DELEGATE_TASK',
      timestamp: now,
      task: {
        id: taskId,
        goal,
        context,
        assigned_to: 'orbit',
        priority: opts?.priority || 'MEDIUM',
        estimated_cost: opts?.estimatedCost || 0.05,
        toolsets: opts?.toolsets || [],
        retry_count: 0
      },
      metadata: {
        source: 'user_request',
        retryCount: 0
      }
    }
    
    this.channel.send({
      type: 'broadcast',
      event: 'DELEGATE_TASK',
      payload: event
    })
    
    console.log(`✅ Task delegated: ${taskId}`)
    return { taskId }
  }
  
  /**
   * Hermes: Monitor task status (subscribe to updates)
   */
  subscribeToTaskUpdates(taskId: string, callback: (event: TaskStatusEvent) => void) {
    this.supabase
      .channel(`task:${taskId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'task_events',
        filter: `task_id=eq.${taskId}`
      }, (payload) => {
        if (payload.new.event_type === 'PROGRESS') {
          callback({
            id: uuidv4(),
            type: 'TASK_STATUS_UPDATE',
            taskId,
            timestamp: Date.now(),
            status: 'EXECUTING',
            progress: payload.new.metrics,
            metrics: payload.new.metrics
          })
        }
      })
      .subscribe()
  }
  
  /**
   * Hermes: Handle task completion
   */
  async handleTaskCompletion(taskId: string) {
    const { data: task } = await this.supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single()
    
    if (!task) return
    
    console.log(`✅ Task complete: ${taskId}`)
    console.log(`   Cost: $${task.actual_cost}`)
    console.log(`   Duration: ${(task.completed_at - task.started_at) / 1000}s`)
    
    // Aggregate costs
    const { data: metrics } = await this.supabase
      .from('task_events')
      .select('metrics')
      .eq('task_id', taskId)
    
    return {
      success: true,
      taskId,
      totalCost: task.actual_cost,
      totalTokens: metrics?.reduce((sum, m) => sum + (m.metrics?.tokensUsed || 0), 0) || 0
    }
  }
  
  /**
   * Hermes: Retry failed task
   */
  async retryTask(taskId: string): Promise<{ newTaskId: string }> {
    const { data: oldTask } = await this.supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single()
    
    if (!oldTask) throw new Error('Task not found')
    if (oldTask.retry_count >= oldTask.max_retries) {
      throw new Error('Max retries exceeded')
    }
    
    // Create new task with incremented retry_count
    const newTaskId = uuidv4()
    await this.supabase
      .from('tasks')
      .insert({
        id: newTaskId,
        goal: oldTask.goal,
        context: oldTask.context,
        assigned_to: 'orbit',
        status: 'QUEUED',
        priority: oldTask.priority,
        estimated_cost: oldTask.estimated_cost,
        toolsets: oldTask.toolsets,
        created_by: oldTask.created_by,
        parent_task_id: taskId,
        retry_count: oldTask.retry_count + 1,
        max_retries: oldTask.max_retries
      })
    
    console.log(`🔄 Retry task: ${taskId} → ${newTaskId} (attempt ${oldTask.retry_count + 2})`)
    
    // Delegate again
    return this.delegateTaskToOrbit(oldTask.goal, oldTask.context, {
      priority: oldTask.priority,
      estimatedCost: oldTask.estimated_cost,
      toolsets: oldTask.toolsets
    })
  }
}

export const taskManager = new TaskManager()
```

### 2.3 Usage in Hermes

```typescript
// In your Hermes agent logic

import { taskManager } from './services/TaskManager'

// When you want to delegate work to ORBIT:
const result = await taskManager.delegateTaskToOrbit(
  goal: "Improve Agent3DFloor with particle effects",
  context: "Frontend React component, modify Agent3DFloor.tsx, add THREE.js particles",
  {
    priority: 'HIGH',
    estimatedCost: 0.05,
    toolsets: ['browser', 'terminal', 'file']
  }
)

console.log(`Delegated task: ${result.taskId}`)

// Monitor it
taskManager.subscribeToTaskUpdates(result.taskId, (event) => {
  console.log(`Task update: ${event.progress.percent}% complete, cost so far: $${event.metrics.costAccrued}`)
})
```

---

## FASE 3: ORBIT — Event Consumer & Executor

### 3.1 TaskQueue (ORBIT)

```typescript
// services/TaskQueue.ts (runs in ORBIT)

import { createClient } from '@supabase/supabase-js'
import PQueue from 'p-queue'

class TaskQueue {
  private supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_KEY!
  )
  
  // Process max 5 tasks concurrently
  private queue = new PQueue({ concurrency: 5 })
  
  private taskId: string | null = null
  
  /**
   * ORBIT: Start listening for delegated tasks
   */
  async start() {
    console.log('🔌 ORBIT: Starting task queue listener...')
    
    // Listen for new tasks assigned to ORBIT
    this.supabase
      .from('tasks')
      .on('*', {
        event: 'INSERT',
        schema: 'public',
        filter: `assigned_to=eq.orbit`
      }, (payload) => {
        const task = payload.new
        console.log(`📥 ORBIT: Received task: ${task.id}`)
        
        // Enqueue for processing
        this.queue.add(() => this.executeTask(task))
      })
      .subscribe()
    
    console.log('✅ ORBIT: Queue listener started')
  }
  
  /**
   * ORBIT: Execute a task
   */
  private async executeTask(task: any) {
    const taskId = task.id
    this.taskId = taskId
    
    try {
      console.log(`🚀 ORBIT: Executing task ${taskId}`)
      
      // Update status to EXECUTING
      await this.supabase
        .from('tasks')
        .update({
          status: 'EXECUTING',
          started_at: new Date(),
          progress_percent: 0
        })
        .eq('id', taskId)
      
      // Log event
      await this.logEvent(taskId, 'STARTED', {
        tokensUsed: 0,
        costAccrued: 0
      })
      
      // Execute based on task goal
      const result = await this.executeGoal(task.goal, task.context)
      
      // Update to COMPLETED
      await this.supabase
        .from('tasks')
        .update({
          status: 'COMPLETED',
          completed_at: new Date(),
          progress_percent: 100,
          result: result.output,
          actual_cost: result.cost
        })
        .eq('id', taskId)
      
      // Log completion
      await this.logEvent(taskId, 'COMPLETED', {
        tokensUsed: result.tokens,
        costAccrued: result.cost
      })
      
      console.log(`✅ ORBIT: Task ${taskId} completed in ${result.duration}ms, cost: $${result.cost}`)
      
      return result
    } catch (error) {
      console.error(`❌ ORBIT: Task ${taskId} failed:`, error)
      
      // Update to FAILED
      await this.supabase
        .from('tasks')
        .update({
          status: 'FAILED',
          error_message: error.message,
          completed_at: new Date()
        })
        .eq('id', taskId)
      
      // Log failure
      await this.logEvent(taskId, 'FAILED', {
        error: error.message
      })
      
      // Don't rethrow - queue should continue
    }
  }
  
  /**
   * ORBIT: Execute task based on goal
   */
  private async executeGoal(goal: string, context: string): Promise<{
    output: string
    tokens: number
    cost: number
    duration: number
  }> {
    const startTime = Date.now()
    
    // Example: code generation task
    if (goal.includes('Improve Agent3DFloor')) {
      return {
        output: 'Modified Agent3DFloor.tsx with particle effects',
        tokens: 5600,
        cost: 0.0342,
        duration: Date.now() - startTime
      }
    }
    
    // Add more task types here
    throw new Error(`Unknown task goal: ${goal}`)
  }
  
  /**
   * ORBIT: Report progress every 5s
   */
  async reportProgress(taskId: string, percent: number, tokensUsed: number, cost: number) {
    await this.supabase
      .from('tasks')
      .update({
        progress_percent: percent,
        actual_cost: cost
      })
      .eq('id', taskId)
    
    await this.logEvent(taskId, 'PROGRESS', {
      percent,
      tokensUsed,
      costAccrued: cost
    })
  }
  
  /**
   * Helper: Log event to audit trail
   */
  private async logEvent(taskId: string, eventType: string, metrics: any) {
    await this.supabase
      .from('task_events')
      .insert({
        task_id: taskId,
        event_type: eventType,
        agent_from: 'orbit',
        agent_to: 'orbit',
        metrics
      })
  }
}

export const taskQueue = new TaskQueue()
```

### 3.2 Start ORBIT

```typescript
// main.ts (ORBIT startup)

import { taskQueue } from './services/TaskQueue'

async function main() {
  console.log('🚀 ORBIT: Starting...')
  await taskQueue.start()
  console.log('✅ ORBIT: Ready to execute tasks')
}

main().catch(console.error)
```

---

## FASE 4: DASHBOARD — Real-time Visualization

### 4.1 Backend API

```typescript
// api/routes/tasks.ts

import express from 'express'
import { supabase } from '../config'

const router = express.Router()

/**
 * GET /api/tasks?agent=orbit&status=EXECUTING
 * Get task queue for an agent
 */
router.get('/tasks', async (req, res) => {
  const { agent, status } = req.query
  
  let query = supabase
    .from('tasks')
    .select('*')
  
  if (agent) query = query.eq('assigned_to', agent)
  if (status) query = query.eq('status', status)
  
  const { data, error } = await query
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
  
  if (error) return res.status(500).json({ error })
  res.json(data)
})

/**
 * GET /api/metrics/agent/:agent
 * Get agent capacity and metrics
 */
router.get('/metrics/agent/:agent', async (req, res) => {
  const { agent } = req.params
  
  const { data, error } = await supabase
    .from('agent_capacity')
    .select('*')
    .eq('agent_name', agent)
    .single()
  
  if (error) return res.status(500).json({ error })
  res.json(data)
})

/**
 * GET /api/costs
 * Get cost aggregation
 */
router.get('/costs', async (req, res) => {
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('assigned_to, actual_cost, status')
    .eq('status', 'COMPLETED')
  
  if (error) return res.status(500).json({ error })
  
  const costByAgent = tasks.reduce((acc, task) => {
    const agent = task.assigned_to
    acc[agent] = (acc[agent] || 0) + task.actual_cost
    return acc
  }, {})
  
  res.json(costByAgent)
})

export default router
```

### 4.2 Frontend Hook (React)

```typescript
// hooks/useTaskQueue.ts

import { useEffect, useState } from 'react'
import { supabase } from '../config'

export function useTaskQueue(agent: 'hermes' | 'orbit') {
  const [tasks, setTasks] = useState([])
  const [capacity, setCapacity] = useState(null)
  
  useEffect(() => {
    // Fetch current tasks
    const fetchTasks = async () => {
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', agent)
        .order('priority', { ascending: false })
      setTasks(data || [])
    }
    
    // Fetch capacity
    const fetchCapacity = async () => {
      const { data } = await supabase
        .from('agent_capacity')
        .select('*')
        .eq('agent_name', agent)
        .single()
      setCapacity(data)
    }
    
    fetchTasks()
    fetchCapacity()
    
    // Subscribe to real-time updates
    const subscription = supabase
      .from('tasks')
      .on('*', {
        event: '*',
        schema: 'public',
        filter: `assigned_to=eq.${agent}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setTasks((prev) => [...prev, payload.new])
        } else if (payload.eventType === 'UPDATE') {
          setTasks((prev) =>
            prev.map((t) => (t.id === payload.new.id ? payload.new : t))
          )
        }
      })
      .subscribe()
    
    return () => subscription.unsubscribe()
  }, [agent])
  
  return { tasks, capacity, loading: !capacity }
}
```

### 4.3 3D Floor Component (Update)

```typescript
// Agent3DFloor.tsx — Modified to show task queue

import { useTaskQueue } from '../hooks/useTaskQueue'

export function Agent3DFloor() {
  const hermesQueue = useTaskQueue('hermes')
  const orbitQueue = useTaskQueue('orbit')
  
  useEffect(() => {
    // Render task queue above agents
    // Above HERMES sphere: show hermesQueue.tasks
    // Above ORBIT sphere: show orbitQueue.tasks
    
    hermesQueue.tasks.forEach((task, idx) => {
      const taskBox = createTaskBoxMesh(task)
      taskBox.position.y = 8 + idx * 1.5
      scene.add(taskBox)
    })
    
    orbitQueue.tasks.forEach((task, idx) => {
      const taskBox = createTaskBoxMesh(task)
      taskBox.position.x = 10
      taskBox.position.y = 8 + idx * 1.5
      scene.add(taskBox)
    })
  }, [hermesQueue.tasks, orbitQueue.tasks])
  
  return <canvas ref={containerRef} />
}
```

---

## FASE 5: TESTING

### 5.1 Unit Test: Delegation

```typescript
// __tests__/TaskManager.test.ts

import { taskManager } from '../services/TaskManager'

describe('TaskManager', () => {
  it('should delegate task to ORBIT', async () => {
    const result = await taskManager.delegateTaskToOrbit(
      'Test task',
      'Test context',
      { priority: 'HIGH', estimatedCost: 0.05 }
    )
    
    expect(result.taskId).toBeDefined()
    expect(result.taskId).toMatch(/^[0-9a-f-]{36}$/) // UUID format
  })
  
  it('should fail if ORBIT is full', async () => {
    // Mock ORBIT capacity to be full
    // Then try to delegate
    // Should return backpressure error
  })
})
```

### 5.2 E2E Test: Full Flow

```typescript
// __tests__/e2e.test.ts

describe('E2E: Hermes → ORBIT → Dashboard', () => {
  it('should complete full delegation cycle', async () => {
    // 1. Hermes delegates task
    const { taskId } = await taskManager.delegateTaskToOrbit(
      'E2E test task',
      'Testing full cycle'
    )
    
    // 2. Wait for ORBIT to pick it up
    await new Promise((resolve) => setTimeout(resolve, 2000))
    
    // 3. Check task status in DB
    const { data: task } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single()
    
    expect(task.status).toBe('EXECUTING')
    
    // 4. Wait for completion
    await new Promise((resolve) => {
      taskManager.subscribeToTaskUpdates(taskId, (event) => {
        if (event.status === 'COMPLETED') resolve(null)
      })
    })
    
    // 5. Verify final state
    const { data: completed } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single()
    
    expect(completed.status).toBe('COMPLETED')
    expect(completed.actual_cost).toBeGreaterThan(0)
  })
})
```

---

## CHECKLIST: Deployment

```
PRE-DEPLOYMENT:
☐ Database schema created in Supabase
☐ RLS policies enabled
☐ Realtime subscriptions configured
☐ All tests passing (unit + E2E)
☐ TypeScript types validated
☐ Environment variables set (.env)

DEPLOYMENT:
☐ Deploy Supabase schema migrations
☐ Deploy Hermes changes (TaskManager)
☐ Deploy ORBIT changes (TaskQueue)
☐ Deploy dashboard backend (API)
☐ Deploy frontend (3D floor update)
☐ Verify WebSocket connection
☐ Test first delegation cycle

POST-DEPLOYMENT:
☐ Monitor Hermes logs
☐ Monitor ORBIT logs
☐ Check Supabase metrics
☐ Verify 3D floor displays tasks
☐ Run smoke tests
☐ Document any issues
☐ Enable cost tracking dashboard
```

---

## COMMON ERRORS & FIXES

### Error: "No rows found" on agent_capacity query
**Fix:** Insert capacity records first:
```sql
INSERT INTO agent_capacity (agent_name, max_concurrent_tasks) 
VALUES 
  ('hermes', 10),
  ('orbit', 5),
  ('subagent_1', 3);
```

### Error: WebSocket connection refused
**Fix:** Ensure Supabase realtime is enabled:
```sql
SELECT * FROM pg_publication WHERE pubname = 'supabase_realtime';
```

### Error: "RLS policy violation"
**Fix:** Check RLS policies are correct and user is authenticated.

---

**Status: Ready to implement! 🚀**
