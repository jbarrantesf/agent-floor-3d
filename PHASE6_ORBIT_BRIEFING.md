# 🎮 PHASE 6: 3D AGENT FLOOR VISUALIZATION & REAL-TIME CONTROL

**From:** Hermes  
**To:** ORBIT  
**Date:** 2026-05-02  
**Status:** Ready for implementation  
**Priority:** CRITICAL (Final Visual Phase)  
**Dependency:** Phase 4 ✅ (SubagentRouter ready)

---

## 🎯 VISION

**"José walks to his desk. Opens a browser. Sees his agent team working in 3D."**

Not text logs. Not dashboards. **A living, breathing 3D cockpit where:**
- ✅ Agent avatars move & animate
- ✅ Tasks flow between agents as lines & glowing orbs
- ✅ Real-time cost ticker at bottom
- ✅ Click agent → See capacity, current tasks, last result
- ✅ Right-click task → Pause/Cancel/Reassign
- ✅ Color = status (🟢 idle, 🔵 working, 🔴 error)
- ✅ Size = load (bigger = more busy)

**Result:** José doesn't need logs anymore. The floor shows everything.

---

## 📐 ARCHITECTURE

### Tech Stack
```
Frontend:
  - Three.js (3D rendering)
  - Supabase realtime (live updates)
  - React (UI overlay)
  - WebGL (GPU acceleration)
  - Vite (build tooling)

Backend Integration:
  - Supabase subscriptions (tasks, task_events, agent_capacity)
  - REST API (pause, cancel, reassign)
  - WebSocket (real-time cost tracking)

Performance:
  - 60 FPS target
  - Lazy-load scene details
  - Culling for off-screen agents
  - Instancing for similar objects
```

### Scene Layout (3D)

```
                TOP VIEW (Looking Down)

        ┌─────────────────────────────────────┐
        │    COST TICKER (floating overlay)   │
        │  Task: $0.12 | Agent: $2.45/day    │
        └─────────────────────────────────────┘

        ┌─────────────────────────────────────┐
        │                                     │
        │              ORBIT (Router)         │
        │              (center, spinning)     │
        │                ◊                    │
        │                                     │
        │         ╱         ╲         ╲       │
        │        ╱           ╲         ╲      │
        │       ╱             ╲         ╲     │
        │   Agent-1          Agent-2    Agent-3   
        │   (left)           (top)      (right)   
        │    ◎ 35%           ◎ 62%      ◎ 48%    
        │   idle             working    working  │
        │   🟢               🔵         🔵       │
        │                                     │
        │   Task flow:                        │
        │   ─→ ⊕ ─→ ⊕ ─→ ⊕ ─→               │
        │   (green glowing orbs)              │
        │                                     │
        └─────────────────────────────────────┘
```

### Agent Avatar Design

```
EACH AGENT = Glowing Cube + Sphere + Orbital Ring

  ┌─────────────────┐
  │  CUBE (Status)  │  🟢 = Idle
  │  🟢/🔵/🔴/🟡  │  🔵 = Working
  │                 │  🔴 = Error/Failed
  │ [Agent Name]    │  🟡 = Queued
  └─────────────────┘
         ▲
         │ Orbital Ring (rotation = activity)
         │ (spins faster when busy)
         │
    ─────────────
    Sphere inside (pulsates = heartbeat)
    ─────────────

SIZE = Load percentage (35% width, 62% width, etc)
BRIGHTNESS = Health (dim = struggling, bright = healthy)
ROTATION SPEED = Activity level (static = idle, spinning = busy)
```

### Task Flow Animation

```
When task moves from Hermes → ORBIT → Subagent:

[Hermes] ──glowing orb──> [ORBIT] ──glowing orb──> [Agent-1]

Orbs:
  - Color = task priority (green=low, yellow=medium, red=high)
  - Size = task complexity
  - Speed = timeout (faster = urgent)
  - Glow intensity = real-time progress

Path:
  - Smooth Bezier curve
  - Auto-update as task moves
  - Disappears when complete
  - Green flash on success
  - Red spark on failure
```

---

## 🎬 IMPLEMENTATION BREAKDOWN

### FILE STRUCTURE

```
src/
├─ components/
│  ├─ AgentFloor3D.tsx              # Main 3D scene container
│  ├─ AgentAvatar.tsx               # Individual agent rendering
│  ├─ TaskOrb.tsx                   # Task visualization
│  ├─ TaskFlow.tsx                  # Bezier curve renderer
│  ├─ ControlPanel.tsx              # UI overlay (right side)
│  ├─ CostTicker.tsx                # Real-time cost display (top)
│  └─ HUD.tsx                       # Heads-up display info
│
├─ lib/
│  ├─ three-scene.ts                # Three.js scene setup
│  ├─ agent-renderer.ts             # Agent avatar generation
│  ├─ task-animator.ts              # Task orb animation engine
│  ├─ floor-physics.ts              # Agent positioning & collision
│  ├─ realtime-sync.ts              # Supabase subscription manager
│  └─ interactive-controls.ts       # Click/right-click handlers
│
├─ hooks/
│  ├─ useAgentFloor3D.ts            # Main scene hook
│  ├─ useAgentCapacity.ts           # Real-time capacity sync
│  ├─ useTasks.ts                   # Task subscriptions
│  ├─ useCamera.ts                  # Camera controls (orbit, pan, zoom)
│  └─ useCostTracking.ts            # Cost ticker updates
│
├─ types/
│  ├─ floor-3d.ts                   # 3D scene types
│  └─ interaction.ts                # Click/context menu types
│
└─ pages/
   └─ Floor.tsx                     # Main page
```

### PHASE 6A: Three.js Scene Setup (2 hours)

**Goal:** Create base 3D scene with agent avatars

```typescript
// src/lib/three-scene.ts

export class AgentFloorScene {
  constructor(canvas: HTMLCanvasElement);
  
  // Scene lifecycle
  start(): void;
  stop(): void;
  render(): void;
  
  // Agent management
  addAgent(agent: AgentStatus): void;
  updateAgent(agent: AgentStatus): void;
  removeAgent(agentName: string): void;
  getAgent(agentName: string): Agent3DObject;
  
  // Task visualization
  addTaskFlow(task: Task): void;
  updateTaskFlow(taskId: string, progress: number): void;
  removeTaskFlow(taskId: string): void;
  
  // Camera controls
  focusAgent(agentName: string): void;
  resetCamera(): void;
  
  // Event handlers
  onAgentClick(callback: (agentName: string) => void): void;
  onTaskRightClick(callback: (taskId: string) => void): void;
}

// Agent rendering
export function createAgentAvatar(agent: AgentStatus): THREE.Group {
  // Cube (status indicator)
  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshPhongMaterial({ 
      color: getStatusColor(agent.status),
      emissive: getStatusColor(agent.status),
      emissiveIntensity: 0.6
    })
  );
  
  // Sphere (heartbeat indicator)
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 32, 32),
    new THREE.MeshPhongMaterial({ 
      color: 0x00ff00,
      wireframe: true
    })
  );
  cube.add(sphere);
  
  // Orbital ring (activity level)
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.3, 0.1, 16, 100),
    new THREE.MeshPhongMaterial({ 
      color: 0x00ccff,
      emissive: 0x00ccff,
      emissiveIntensity: 0.8
    })
  );
  cube.add(ring);
  
  // Scale by load percentage
  const scale = 0.5 + (agent.current_load / agent.max_concurrent_tasks) * 1.5;
  cube.scale.set(scale, scale, scale);
  
  return cube;
}
```

**Deliverables:**
- ✅ Three.js scene initialized with lighting
- ✅ Camera with orbit controls
- ✅ Agents rendered as glowing cubes
- ✅ Proper positioning (circular layout)
- ✅ Real-time color updates based on status

---

### PHASE 6B: Agent Avatar Animation (2 hours)

**Goal:** Agents respond to real-time state changes

```typescript
// src/lib/agent-renderer.ts

export class AgentAnimator {
  private agents: Map<string, THREE.Group>;
  private animations: AnimationMixer;
  
  // Status animation
  updateStatus(agentName: string, status: AgentStatus): void {
    const agent = this.agents.get(agentName);
    if (!agent) return;
    
    // Color transition
    const targetColor = getStatusColor(status.status);
    const material = agent.children[0].material;
    new TWEEN.Tween(material.color)
      .to(targetColor, 500)
      .start();
    
    // Size transition (load changes)
    const targetScale = 0.5 + (status.current_load / status.max_concurrent_tasks) * 1.5;
    new TWEEN.Tween(agent.scale)
      .to({ x: targetScale, y: targetScale, z: targetScale }, 600)
      .start();
  }
  
  // Rotation speed = activity level
  updateActivityLevel(agentName: string, load: number): void {
    const agent = this.agents.get(agentName);
    if (!agent) return;
    
    const ring = agent.children[2]; // Orbital ring
    const rotationSpeed = (load / 5) * Math.PI; // Faster when busy
    ring.userData.targetRotationSpeed = rotationSpeed;
  }
  
  // Pulsing heartbeat on sphere
  pulseHeartbeat(agentName: string): void {
    const agent = this.agents.get(agentName);
    if (!agent) return;
    
    const sphere = agent.children[1];
    new TWEEN.Tween(sphere.scale)
      .to({ x: 1.5, y: 1.5, z: 1.5 }, 400)
      .onComplete(() => {
        new TWEEN.Tween(sphere.scale)
          .to({ x: 1, y: 1, z: 1 }, 400)
          .start();
      })
      .start();
  }
  
  animate(): void {
    // Update all agent rings
    this.agents.forEach(agent => {
      const ring = agent.children[2];
      if (ring.userData.targetRotationSpeed) {
        ring.rotation.z += ring.userData.targetRotationSpeed * 0.016; // 60 FPS
      }
    });
  }
}
```

**Deliverables:**
- ✅ Status color transitions (smooth)
- ✅ Size changes based on load
- ✅ Orbital ring rotation (activity indicator)
- ✅ Heartbeat pulsing
- ✅ 60 FPS animation loop

---

### PHASE 6C: Task Flow Visualization (2 hours)

**Goal:** Tasks flow as glowing orbs between agents

```typescript
// src/lib/task-animator.ts

export class TaskFlowVisualizer {
  // Create task orb
  createTaskOrb(task: Task): THREE.Object3D {
    const orb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.2, 4),
      new THREE.MeshPhongMaterial({
        color: getPriorityColor(task.priority),
        emissive: getPriorityColor(task.priority),
        emissiveIntensity: 1,
        shininess: 100
      })
    );
    
    // Add glow trail
    const trailMaterial = new THREE.LineBasicMaterial({
      color: getPriorityColor(task.priority),
      transparent: true,
      opacity: 0.5,
      linewidth: 2
    });
    const trailGeometry = new THREE.BufferGeometry();
    orb.userData.trail = new THREE.Line(trailGeometry, trailMaterial);
    
    return orb;
  }
  
  // Animate task flow from source to destination
  animateTaskFlow(
    task: Task,
    fromAgent: THREE.Object3D,
    toAgent: THREE.Object3D,
    duration: number
  ): void {
    const orb = this.getTaskOrb(task.id);
    if (!orb) return;
    
    // Bezier curve path
    const curve = new THREE.CubicBezierCurve3(
      fromAgent.position,
      new THREE.Vector3(0, 2, 0), // Control point 1
      new THREE.Vector3(0, 2, 0), // Control point 2
      toAgent.position
    );
    
    orb.userData.path = curve;
    orb.userData.t = 0;
    orb.userData.totalDuration = duration;
  }
  
  // Update all task orbs (called every frame)
  updateTaskFlows(deltaTime: number): void {
    this.taskOrbs.forEach((orb, taskId) => {
      if (orb.userData.path) {
        orb.userData.t += deltaTime / orb.userData.totalDuration;
        
        if (orb.userData.t >= 1) {
          // Task complete
          this.completeTaskAnimation(taskId);
          return;
        }
        
        // Move orb along path
        const point = orb.userData.path.getPoint(orb.userData.t);
        orb.position.copy(point);
        
        // Update trail
        const geometry = orb.userData.trail.geometry;
        // Add current position to trail
      }
    });
  }
  
  // Task complete = green flash + disappear
  completeTaskAnimation(taskId: string): void {
    const orb = this.taskOrbs.get(taskId);
    if (!orb) return;
    
    // Flash green
    orb.material.color.set(0x00ff00);
    orb.material.emissive.set(0x00ff00);
    
    // Scale up and fade out
    new TWEEN.Tween(orb.scale)
      .to({ x: 2, y: 2, z: 2 }, 300)
      .start();
    
    new TWEEN.Tween(orb.material)
      .to({ opacity: 0 }, 300)
      .onComplete(() => {
        this.scene.remove(orb);
        this.taskOrbs.delete(taskId);
      })
      .start();
  }
}

function getPriorityColor(priority: number): number {
  switch (priority) {
    case 0: return 0x00ff00; // Low = green
    case 1: return 0xffff00; // Medium = yellow
    case 2: return 0xff0000; // High = red
    default: return 0x0099ff; // Unknown = blue
  }
}
```

**Deliverables:**
- ✅ Task orbs rendered with correct colors
- ✅ Smooth Bezier curves (orbs follow paths)
- ✅ Glowing trails behind orbs
- ✅ Success animation (green flash)
- ✅ Failure animation (red spark)

---

### PHASE 6D: Real-time Sync + Subscriptions (2 hours)

**Goal:** Supabase data → 3D scene (live updates)

```typescript
// src/lib/realtime-sync.ts

export class FloorRealtimeSync {
  private supabase: SupabaseClient;
  private scene: AgentFloorScene;
  private subscriptions: RealtimeChannel[] = [];
  
  constructor(supabase: SupabaseClient, scene: AgentFloorScene) {
    this.supabase = supabase;
    this.scene = scene;
  }
  
  // Subscribe to agent capacity changes
  subscribeToAgentCapacity(): void {
    const channel = this.supabase
      .channel('agent_capacity_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_capacity'
        },
        (payload) => {
          const agent = payload.new as AgentStatus;
          this.scene.updateAgent(agent);
        }
      )
      .subscribe();
    
    this.subscriptions.push(channel);
  }
  
  // Subscribe to task events
  subscribeToTaskEvents(): void {
    const channel = this.supabase
      .channel('task_events')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_events'
        },
        (payload) => {
          const event = payload.new as TaskEvent;
          this.handleTaskEvent(event);
        }
      )
      .subscribe();
    
    this.subscriptions.push(channel);
  }
  
  // Handle task events
  private handleTaskEvent(event: TaskEvent): void {
    switch (event.event_type) {
      case 'CREATED':
        this.scene.addTaskFlow(event.task_id);
        break;
      case 'ASSIGNED':
        this.scene.updateTaskFlow(event.task_id, 0.25);
        break;
      case 'RUNNING':
        this.scene.updateTaskFlow(event.task_id, 0.5);
        break;
      case 'COMPLETED':
        this.scene.completeTaskAnimation(event.task_id);
        this.updateCostTicker(event);
        break;
      case 'FAILED':
        this.scene.failTaskAnimation(event.task_id);
        break;
    }
  }
  
  // Cleanup
  unsubscribeAll(): void {
    this.subscriptions.forEach(channel => {
      this.supabase.removeChannel(channel);
    });
    this.subscriptions = [];
  }
}
```

**Deliverables:**
- ✅ Real-time agent capacity subscriptions
- ✅ Task event subscriptions
- ✅ Scene updates on data changes
- ✅ Zero-latency visual feedback

---

### PHASE 6E: Interactive Controls (1.5 hours)

**Goal:** Click agents, right-click tasks, control execution

```typescript
// src/lib/interactive-controls.ts

export class FloorInteraction {
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  
  setupClickHandlers(scene: AgentFloorScene, camera: THREE.Camera): void {
    // Left click = select agent
    document.addEventListener('click', (event) => {
      this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      
      this.raycaster.setFromCamera(this.mouse, camera);
      const intersects = this.raycaster.intersectObjects(scene.children, true);
      
      if (intersects.length > 0) {
        const agentName = intersects[0].object.userData.agentName;
        this.showAgentDetails(agentName);
      }
    });
    
    // Right click = task menu
    document.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      
      this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      
      this.raycaster.setFromCamera(this.mouse, camera);
      const intersects = this.raycaster.intersectObjects(scene.children, true);
      
      if (intersects.length > 0) {
        const taskId = intersects[0].object.userData.taskId;
        this.showTaskMenu(taskId, event.clientX, event.clientY);
      }
    });
  }
  
  // Show agent details panel
  showAgentDetails(agentName: string): void {
    // Open side panel with:
    // - Agent name & status
    // - Current capacity
    // - Active tasks
    // - Last result
    // - Total cost
  }
  
  // Context menu for tasks
  showTaskMenu(taskId: string, x: number, y: number): void {
    // Menu options:
    // - Pause
    // - Cancel
    // - Reassign to another agent
    // - View details
  }
}

// API calls for control actions
export async function pauseTask(taskId: string): Promise<void> {
  await apiClient.post(`/tasks/${taskId}/pause`);
}

export async function cancelTask(taskId: string): Promise<void> {
  await apiClient.post(`/tasks/${taskId}/cancel`);
}

export async function reassignTask(taskId: string, newAgent: string): Promise<void> {
  await apiClient.post(`/tasks/${taskId}/reassign`, { agent: newAgent });
}
```

**Deliverables:**
- ✅ Click to select agents
- ✅ Right-click task context menu
- ✅ Agent detail panel (side)
- ✅ Task control actions

---

### PHASE 6F: UI Overlay & Cost Ticker (1.5 hours)

**Goal:** Real-time cost display + agent stats

```typescript
// src/components/CostTicker.tsx

export function CostTicker(): JSX.Element {
  const [costData, setCostData] = useState<CostData>({
    lastTaskCost: 0,
    dailyAgentCost: {},
    totalDailyCost: 0,
    runningTasksCost: 0
  });
  
  useEffect(() => {
    const unsubscribe = subscribeToTaskEvents((event) => {
      if (event.event_type === 'COMPLETED') {
        setCostData(prev => ({
          ...prev,
          lastTaskCost: event.cost_usd,
          runningTasksCost: prev.runningTasksCost - event.cost_usd,
          totalDailyCost: prev.totalDailyCost + event.cost_usd
        }));
      }
    });
    
    return () => unsubscribe();
  }, []);
  
  return (
    <div className="cost-ticker">
      <div className="ticker-item">
        <span>Last Task:</span>
        <span className="amount">${costData.lastTaskCost.toFixed(4)}</span>
      </div>
      <div className="ticker-item">
        <span>Running:</span>
        <span className="amount">${costData.runningTasksCost.toFixed(2)}</span>
      </div>
      <div className="ticker-item highlight">
        <span>Today:</span>
        <span className="amount">${costData.totalDailyCost.toFixed(2)}</span>
      </div>
    </div>
  );
}

// src/components/ControlPanel.tsx

export function ControlPanel(): JSX.Element {
  const [selectedAgent, setSelectedAgent] = useState<AgentStatus | null>(null);
  
  return (
    <div className="control-panel">
      <h2>Agent Floor Control</h2>
      
      {selectedAgent && (
        <div className="agent-details">
          <h3>{selectedAgent.agent_name}</h3>
          <div className="stat">
            <span>Status:</span>
            <span className={`status ${selectedAgent.is_online ? 'online' : 'offline'}`}>
              {selectedAgent.is_online ? '🟢 Online' : '🔴 Offline'}
            </span>
          </div>
          <div className="stat">
            <span>Load:</span>
            <span>{selectedAgent.current_load} / {selectedAgent.max_concurrent_tasks}</span>
          </div>
          <div className="stat">
            <span>Utilization:</span>
            <UtilizationBar value={selectedAgent.current_load / selectedAgent.max_concurrent_tasks} />
          </div>
        </div>
      )}
      
      <div className="scene-controls">
        <button onClick={() => resetCamera()}>Reset Camera</button>
        <button onClick={() => toggleStats()}>Show Stats</button>
        <button onClick={() => exportSceneData()}>Export</button>
      </div>
    </div>
  );
}
```

**Deliverables:**
- ✅ Real-time cost ticker (top)
- ✅ Control panel (right side)
- ✅ Agent details display
- ✅ Camera controls buttons

---

### PHASE 6G: Performance Optimization (1 hour)

**Goal:** 60 FPS on all hardware

```typescript
// Performance optimizations:

1. INSTANCING: Use THREE.InstancedMesh for similar geometries
   - All task orbs share one geometry
   - All agent cubes use one buffer

2. CULLING: Don't render off-screen elements
   - Use THREE.Frustum for view frustum culling
   - Hide agents outside camera view

3. LEVEL OF DETAIL (LOD):
   - Far agents = lower polygon count
   - Near agents = full quality

4. TEXTURE ATLASING:
   - Combine all textures into one atlas
   - Reduce draw calls

5. ASYNC LOADING:
   - Load agent data in background
   - Don't block render loop

6. ANIMATION POOLING:
   - Reuse TWEEN objects instead of creating new ones
   - Pool task orbs

Example:
```typescript
export class OptimizedAgentFloor {
  private agentPool = new ObjectPool(AgentAvatar, 100);
  private taskOrbPool = new ObjectPool(TaskOrb, 500);
  
  addAgent(agent: AgentStatus): void {
    const avatar = this.agentPool.get();
    avatar.update(agent);
    this.scene.add(avatar);
  }
  
  removeAgent(agentName: string): void {
    const avatar = this.getAgent(agentName);
    this.scene.remove(avatar);
    this.agentPool.return(avatar);
  }
}
```

**Deliverables:**
- ✅ 60 FPS maintained
- ✅ <100MB memory for 100 agents
- ✅ Smooth animations
- ✅ Fast interactions

---

## 🎬 IMPLEMENTATION CHECKLIST

### Phase 6A: Three.js Base (2h)
- [ ] Three.js scene setup
- [ ] Camera with orbit controls
- [ ] Lighting (3-point setup)
- [ ] Agent positioning (circular layout)
- [ ] Basic rendering

### Phase 6B: Agent Animation (2h)
- [ ] Status color transitions
- [ ] Size scaling by load
- [ ] Orbital ring rotation
- [ ] Heartbeat pulse
- [ ] Animation loop

### Phase 6C: Task Flow (2h)
- [ ] Task orb creation
- [ ] Bezier curve paths
- [ ] Glow trails
- [ ] Completion animations
- [ ] Failure animations

### Phase 6D: Real-time Sync (2h)
- [ ] Supabase subscriptions
- [ ] Agent capacity updates
- [ ] Task event handling
- [ ] Scene updates
- [ ] Error recovery

### Phase 6E: Interactive Controls (1.5h)
- [ ] Click detection (raycasting)
- [ ] Agent selection
- [ ] Task context menu
- [ ] Control actions
- [ ] State management

### Phase 6F: UI Overlay (1.5h)
- [ ] Cost ticker component
- [ ] Agent details panel
- [ ] Control buttons
- [ ] Real-time updates
- [ ] Styling & layout

### Phase 6G: Performance (1h)
- [ ] Instancing setup
- [ ] Frustum culling
- [ ] LOD system
- [ ] Memory profiling
- [ ] FPS monitoring

---

## 📁 NEW FILES TO CREATE

```
src/components/
├─ AgentFloor3D.tsx                  # Main container component
├─ AgentAvatar.tsx                   # Individual agent renderer
├─ TaskOrb.tsx                       # Task visualization
├─ TaskFlow.tsx                      # Bezier curve renderer
├─ ControlPanel.tsx                  # Control UI
├─ CostTicker.tsx                    # Real-time cost
├─ HUD.tsx                           # Info display
└─ Floor.tsx                         # Main page

src/lib/
├─ three-scene.ts                    # Scene setup & management
├─ agent-renderer.ts                 # Agent avatar generation
├─ task-animator.ts                  # Task animation engine
├─ floor-physics.ts                  # Positioning & layout
├─ realtime-sync.ts                  # Supabase integration
├─ interactive-controls.ts           # Click/menu handling
├─ performance-monitor.ts            # FPS & memory tracking
└─ object-pool.ts                    # Object pooling utility

src/hooks/
├─ useAgentFloor3D.ts                # Main scene hook
├─ useAgentCapacity.ts               # Capacity subscription
├─ useTasks.ts                       # Task subscription
├─ useCamera.ts                      # Camera control hook
└─ useCostTracking.ts                # Cost subscription

src/types/
├─ floor-3d.ts                       # 3D scene types
├─ interaction.ts                    # Interaction types
└─ performance.ts                    # Performance types

src/styles/
└─ floor-3d.css                      # 3D floor styling

tests/
└─ AgentFloor3D.test.tsx             # Component tests
```

---

## 🚀 SUCCESS CRITERIA

Phase 6 is complete when José can:

1. ✅ Open the app in browser
2. ✅ See 3 agents as glowing cubes in a circle
3. ✅ Watch tasks flow as orbs between agents
4. ✅ See agents change size & color as load changes
5. ✅ Click an agent → see details panel
6. ✅ Right-click task → pause/cancel/reassign
7. ✅ See real-time cost ticker update
8. ✅ Everything at 60 FPS
9. ✅ Mobile responsive (rotate view on mobile)

**Final Demo:**
```
José opens browser
  ↓
3D floor loads (2 seconds)
  ↓
Agents render with orbital rings
  ↓
José creates task via Hermes
  ↓
Task orb appears, flows to ORBIT
  ↓
ORBIT routes to Agent-1
  ↓
Orb flows to Agent-1
  ↓
Agent-1 cube turns blue, size grows, ring spins faster
  ↓
Task completes
  ↓
Green flash, cost ticker updates +$0.12
  ↓
José clicks Agent-1 → sees 5 completed tasks, $2.45 daily cost
  ↓
Right-clicks next task → "Reassign to Agent-2"
  ↓
Task orb moves to Agent-2 ✅
```

---

## 📊 PERFORMANCE TARGETS

- **Initial load:** <3 seconds
- **Frame rate:** 60 FPS (locked)
- **Memory:** <100MB for 100 agents
- **Render time:** <16ms per frame
- **Interaction latency:** <50ms
- **Update frequency:** 30+ updates/second

---

## 🔑 DEPENDENCIES

Already available:
- ✅ Phase 4 SubagentRouter (task flow)
- ✅ Database schema (agent_capacity, tasks, task_events)
- ✅ Supabase realtime subscriptions
- ✅ React + Vite setup

New for Phase 6:
- Three.js library
- Tween.js (animations)
- Raycaster for interactions

---

## 📞 QUESTIONS?

Check:
1. `PHASE4_ORBIT_STATUS.md` — Task routing details
2. `docs/hermes-orbit-shared/phase4-subagent-router/` — Router reference
3. Three.js docs — https://threejs.org/docs/

---

## 🎯 TIME & COST

- **Total time:** 12-14 hours (split into 7 phases)
- **Total cost:** $0.75 (high value: José sees everything visually)
- **Complexity:** MEDIUM-HIGH (3D rendering + real-time sync)
- **ROI:** EXTREME (first time José sees agents working together in 3D)

Phase 6 Breakdown:
  - 6A: 2h ($0.10)
  - 6B: 2h ($0.10)
  - 6C: 2h ($0.10)
  - 6D: 2h ($0.15)
  - 6E: 1.5h ($0.10)
  - 6F: 1.5h ($0.10)
  - 6G: 1h ($0.10)

---

## 🎬 GO TIME

**From Hermes to ORBIT:**

"You've orchestrated the agents perfectly. Now show them to José. Build the cockpit. Make it visual. Make it real-time. Make it beautiful. 3D agents working together, tasks flowing, costs ticking. This is the finale. 🚀"

---

**Status:** Ready for implementation  
**Owner:** ORBIT + Frontend team  
**Priority:** CRITICAL  
**Last Updated:** 2026-05-02 19:30 AM
