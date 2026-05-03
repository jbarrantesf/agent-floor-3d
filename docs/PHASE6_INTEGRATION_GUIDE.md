# Phase 6: 3D Agent Floor Visualization - Complete Implementation Guide

## 📖 Table of Contents
1. [Quick Start](#quick-start)
2. [Architecture](#architecture)
3. [Component Reference](#component-reference)
4. [Integration Guide](#integration-guide)
5. [API Reference](#api-reference)
6. [Performance Tuning](#performance-tuning)
7. [Troubleshooting](#troubleshooting)
8. [Deployment](#deployment)

---

## 🚀 Quick Start

### Installation

```bash
# Clone repository
git clone https://github.com/jbarrantesf/agent-floor-3d.git
cd agent-floor-3d

# Install dependencies
npm install

# Environment setup
cp .env.example .env.local
# Edit .env.local with your Supabase credentials:
# VITE_SUPABASE_URL=your_url
# VITE_SUPABASE_KEY=your_key
```

### Basic Usage

```tsx
import React from 'react';
import { AgentFloor3D } from '@/components/AgentFloor3D';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY
);

export default function Dashboard() {
  return <AgentFloor3D supabase={supabase} />;
}
```

### Development Server

```bash
# Start dev server
npm run dev

# The 3D floor will be available at http://localhost:5173
# Open browser console to see initialization logs
```

---

## 🏗️ Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    React Application                     │
├─────────────────────────────────────────────────────────┤
│                   AgentFloor3D (Container)               │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ ControlPanel    │  │ CostTicker   │  │ HUD Stats  │  │
│  │ (React UI)      │  │ (Real-time)  │  │ (FPS, RAM) │  │
│  └─────────────────┘  └──────────────┘  └────────────┘  │
├─────────────────────────────────────────────────────────┤
│            Canvas + Three.js Rendering                   │
├─────────────────────────────────────────────────────────┤
│  useAgentFloor3D (Main Hook)                             │
│  ┌──────────────────────────────────────────────────┐   │
│  │ ┌────────────────┐  ┌─────────────────────────┐  │   │
│  │ │ AgentFloor     │  │ Agent/Task Animators    │  │   │
│  │ │ Scene          │  │ - Color transitions     │  │   │
│  │ │ - Agents       │  │ - Size scaling          │  │   │
│  │ │ - Tasks        │  │ - Rotation effects      │  │   │
│  │ │ - Rendering    │  │ - Pulsing heartbeat     │  │   │
│  │ └────────────────┘  └─────────────────────────┘  │   │
│  │ ┌────────────────────────────────────────────┐   │   │
│  │ │ Interaction Manager                        │   │   │
│  │ │ - Raycasting                               │   │   │
│  │ │ - Click handlers                           │   │   │
│  │ │ - Context menus                            │   │   │
│  │ └────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│            Supabase Real-time Subscriptions              │
│  - agent_capacity (agent status updates)                │
│  - task_events (task lifecycle events)                  │
│  - tasks (task details)                                 │
│  - cost_tracking (cost data)                            │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

```
Supabase Event
    ↓
FloorRealtimeSync (subscription handler)
    ↓
Event processed (INSERT/UPDATE/DELETE)
    ↓
Scene state updated (agent/task)
    ↓
Animator calculates transitions
    ↓
Three.js renders frame
    ↓
React components update (UI, ticker)
```

---

## 📦 Component Reference

### AgentFloor3D

**Main container component**

```tsx
interface AgentFloor3DProps {
  supabase: SupabaseClient;
  config?: {
    maxAgents?: number;           // Default: 100
    targetFPS?: number;           // Default: 60
    enablePerformanceMonitoring?: boolean; // Default: true
    enableStats?: boolean;        // Default: true
  };
}

<AgentFloor3D supabase={supabase} />
```

**Features:**
- Canvas initialization
- Keyboard shortcuts (R=reset, S=toggle stats, Esc=clear)
- Performance stats display
- Error boundary wrapper
- Context menu rendering

**Keyboard Shortcuts:**
- `R` - Reset camera to home view
- `S` - Toggle performance stats overlay
- `Esc` - Clear agent selection

### ControlPanel

**Agent details and controls sidebar**

```tsx
interface ControlPanelProps {
  selectedAgent?: Agent3DObject;
  onFocusAgent?: (agentName: string) => void;
  onResetCamera?: () => void;
}
```

**Displays:**
- Agent status (idle/working/error)
- Load percentage with visual bar
- Active tasks count
- Last task result
- Camera focus button

### CostTicker

**Real-time cost tracking display**

```tsx
interface CostTickerProps {
  onCostUpdate?: (totalCost: number) => void;
}
```

**Shows:**
- Accumulated cost (scrolling)
- Cost per second
- Last task cost with animation
- Daily total
- Task completion count

---

## 🔌 Integration Guide

### Adding AgentFloor3D to Existing App

```tsx
// pages/agents.tsx
import { AgentFloor3D } from '@/components/AgentFloor3D';
import { supabase } from '@/lib/supabase';

export default function AgentsPage() {
  return (
    <div className="agents-container">
      <AgentFloor3D 
        supabase={supabase}
        config={{
          maxAgents: 50,
          enablePerformanceMonitoring: true
        }}
      />
    </div>
  );
}
```

### Custom Hook Usage

```tsx
import { useAgentFloor3D } from '@/hooks/useAgentFloor3D';

function MyComponent() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { 
    focusAgent, 
    resetCamera, 
    scene,
    isReady 
  } = useAgentFloor3D(canvasRef, supabase);

  useEffect(() => {
    if (isReady) {
      // Scene is initialized, you can interact with it
      focusAgent('Agent-1');
    }
  }, [isReady]);

  return <canvas ref={canvasRef} />;
}
```

### Programmatic Agent Management

```tsx
import { useAgentFloor3D } from '@/hooks/useAgentFloor3D';

function AgentManager() {
  const { scene } = useAgentFloor3D(canvasRef, supabase);

  const handleAddAgent = (agentData: AgentStatus) => {
    scene.addAgent(agentData);
  };

  const handleUpdateAgent = (agentData: AgentStatus) => {
    scene.updateAgent(agentData);
  };

  const handleRemoveAgent = (agentName: string) => {
    scene.removeAgent(agentName);
  };

  return (
    // Your component JSX
  );
}
```

### Subscribing to Events

```tsx
import { useAgentFloor3D } from '@/hooks/useAgentFloor3D';

function EventListener() {
  const { scene } = useAgentFloor3D(canvasRef, supabase);

  useEffect(() => {
    // Listen to agent clicks
    const unsubscribeClick = scene.onAgentClick((agentName) => {
      console.log('Agent clicked:', agentName);
    });

    // Listen to task events
    const unsubscribeTask = scene.onTaskUpdate((taskId, progress) => {
      console.log('Task progress:', progress);
    });

    return () => {
      unsubscribeClick();
      unsubscribeTask();
    };
  }, [scene]);

  return null;
}
```

---

## 📚 API Reference

### AgentFloorScene

Main Three.js scene manager.

```typescript
class AgentFloorScene {
  // Agent management
  addAgent(agent: AgentStatus): void
  updateAgent(agent: AgentStatus): void
  removeAgent(agentName: string): void
  getAgent(agentName: string): Agent3DObject | undefined
  getAgents(): Map<string, Agent3DObject>

  // Task management
  addTaskFlow(taskId: string, from: Vector3, to: Vector3, 
             priority: number, duration: number): void
  updateTaskFlow(taskId: string, progress: number): void
  completeTask(taskId: string): void
  failTask(taskId: string): void
  getTaskFlow(taskId: string): TaskFlowObject | undefined

  // Scene control
  start(): void
  stop(): void
  dispose(): void
  getScene(): THREE.Scene
  getCamera(): THREE.Camera
  getRenderer(): THREE.WebGLRenderer

  // Camera control
  focusOnAgent(agentName: string): Promise<void>
  resetCamera(): void
  
  // Event handlers
  onAgentClick(callback: (agentName: string) => void): () => void
  onTaskUpdate(callback: (taskId: string, progress: number) => void): () => void
}
```

### AgentAnimator

Agent animation engine.

```typescript
class AgentAnimator {
  updateStatus(agentName: string, status: AgentStatus): void
  updateLoadLevel(agentName: string, current: number, max: number): void
  pulseHeartbeat(agentName: string, intensity: number): void
  flashAgent(agentName: string, color: Color): void
  shakeAgent(agentName: string, intensity: number): void
  fadeInAgent(agentName: string, duration: number): void
  fadeOutAgent(agentName: string, duration: number): void
  getAnimationState(agentName: string): AnimationState | undefined
}
```

### TaskFlowVisualizer

Task animation and visualization.

```typescript
class TaskFlowVisualizer {
  addTaskFlow(taskId: string, from: Vector3, to: Vector3,
             priority: number, duration: number): Mesh
  updateTaskFlowProgress(taskId: string, progress: number): void
  completeTaskAnimation(taskId: string, callback?: () => void): void
  failTaskAnimation(taskId: string, callback?: () => void): void
  getTaskOrb(taskId: string): Mesh | undefined
  clearAll(): void
}
```

### FloorRealtimeSync

Supabase real-time synchronization.

```typescript
class FloorRealtimeSync {
  async subscribeToAgentCapacity(
    callback: (agent: AgentStatus) => void
  ): Promise<() => void>
  
  async subscribeToTaskEvents(
    callback: (event: TaskEvent) => void
  ): Promise<() => void>
  
  async subscribeToTasks(
    callback: (task: Task) => void
  ): Promise<() => void>
  
  async subscribeToCosting(
    callback: (cost: CostData) => void
  ): Promise<() => void>

  async getInitialAgents(): Promise<AgentStatus[]>
  async getInitialTasks(): Promise<Task[]>
}
```

---

## ⚙️ Performance Tuning

### Configuration Options

```tsx
<AgentFloor3D 
  supabase={supabase}
  config={{
    maxAgents: 100,                    // Adjust based on target devices
    targetFPS: 60,                     // Can lower to 30 on mobile
    enablePerformanceMonitoring: true, // Set false in production
    maxTasksPerAgent: 10,             // Limit tasks shown per agent
    updateFrequency: 30,              // Updates per second
    renderQuality: 'high'             // 'low', 'medium', 'high'
  }}
/>
```

### Memory Optimization

```typescript
// Use object pooling for frequent allocations
const pool = new ObjectPool<Mesh>(() => createTaskOrb(), 100);

// Dispose of unused objects properly
scene.dispose();

// Monitor memory
performanceMonitor.trackMemory();
```

### Rendering Optimization

```typescript
// Enable view frustum culling
scene.traverse(obj => {
  obj.frustumCulled = true;
});

// Use LOD for distant agents
const lod = new THREE.LOD();
lod.addLevel(highDetailMesh, 0);
lod.addLevel(lowDetailMesh, 50);
```

### Network Optimization

```typescript
// Batch Supabase updates
const updates: AgentStatus[] = [];
const batchUpdate = () => {
  // Process all updates at once
  updates.forEach(agent => scene.updateAgent(agent));
  updates.length = 0;
};

// Debounce frequent updates
const debouncedUpdate = debounce(batchUpdate, 100);
```

---

## 🔍 Troubleshooting

### Scene Not Loading

**Issue:** Canvas shows blank or black screen

**Solutions:**
1. Check browser console for errors
2. Verify WebGL support: `console.log(canvas.getContext('webgl2'))`
3. Ensure Three.js is installed: `npm list three`
4. Check Supabase connection is valid

```typescript
// Debug script
const canvas = document.querySelector('canvas');
const gl = canvas.getContext('webgl2');
console.log('WebGL supported:', !!gl);
console.log('Three.js version:', THREE.REVISION);
```

### Low Frame Rate

**Issue:** FPS dropping below 60

**Solutions:**
1. Reduce maxAgents in config
2. Disable performance monitoring: `enablePerformanceMonitoring: false`
3. Lower renderQuality to 'medium' or 'low'
4. Check memory usage (should be <200MB)

```typescript
// Monitor performance
const monitor = new PerformanceMonitor();
monitor.startTracking();
console.log('FPS:', monitor.getFPS());
console.log('Memory:', monitor.getMemoryUsage());
```

### Supabase Connection Issues

**Issue:** Real-time updates not working

**Solutions:**
1. Verify Supabase URL and key are correct
2. Check network tab for WebSocket connection
3. Ensure tables exist: agent_capacity, tasks, task_events, cost_tracking
4. Check Supabase JWT token validity

```typescript
// Test Supabase connection
const { data, error } = await supabase
  .from('agent_capacity')
  .select('*')
  .limit(1);

console.log('Connection test:', error ? 'Failed' : 'Success');
```

### Memory Leaks

**Issue:** Memory usage keeps increasing

**Solutions:**
1. Ensure proper cleanup in useEffect: `return () => { unsubscribe(); dispose(); }`
2. Dispose Three.js objects: `geometry.dispose(); material.dispose();`
3. Unsubscribe from Supabase on unmount
4. Check for event listener accumulation

```typescript
// Proper cleanup example
useEffect(() => {
  const unsubscribe = scene.onAgentClick(...);
  return () => unsubscribe();
}, [scene]);
```

### Interaction Not Working

**Issue:** Clicks/right-clicks not registering

**Solutions:**
1. Check browser console for raycasting errors
2. Verify canvas is focused (click on it first)
3. Ensure interactive controls are initialized
4. Check for z-index conflicts with overlays

```typescript
// Test raycasting
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
console.log('Raycaster ready');
```

---

## 🚀 Deployment

### Pre-Deployment Checklist

- [ ] All tests passing: `npm test`
- [ ] No console errors
- [ ] Performance targets met (60 FPS, <3s load)
- [ ] Environment variables configured
- [ ] Supabase tables and RLS policies set up
- [ ] Sentry configured (optional)

### Build for Production

```bash
# Build optimized bundle
npm run build

# Analyze bundle size
npm run build:analyze

# Should be < 2MB gzipped
```

### Environment Variables

Create `.env.production`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_KEY=your-public-key
VITE_ENVIRONMENT=production
VITE_ENABLE_SENTRY=true
VITE_SENTRY_DSN=your-sentry-dsn
```

### Deployment Services

**Vercel:**
```bash
npm install -g vercel
vercel
```

**Netlify:**
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

**Self-hosted:**
```bash
npm run build
# Deploy dist/ to your server
```

### Monitoring

Set up alerts for:
- Error rate > 5/minute
- FPS dropping below 50
- Memory usage > 300MB
- Supabase latency > 1000ms

---

## 📝 License

MIT - See LICENSE file for details

---

## 🤝 Support

For issues:
1. Check this documentation
2. Review test files for usage examples
3. Check GitHub issues
4. Create new issue with reproduction steps

---

**Status:** ✅ Complete  
**Version:** 1.0.0  
**Last Updated:** 2026-05-02
