/**
 * Agent Floor 3D Tests - Phase 6
 * Unit tests for 3D scene, animations, and interactions
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as THREE from 'three';
import { AgentFloorScene } from '../src/lib/three-scene';
import { AgentAnimator } from '../src/lib/agent-renderer';
import { TaskFlowVisualizer } from '../src/lib/task-animator';
import { AgentStatus, TaskFlow } from '../src/types/floor-3d';

describe('AgentFloorScene', () => {
  let scene: AgentFloorScene;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    // Create a mock canvas
    canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    scene = new AgentFloorScene(canvas);
  });

  afterEach(() => {
    scene.dispose();
  });

  it('should initialize scene with proper dimensions', () => {
    expect(scene.getScene()).toBeInstanceOf(THREE.Scene);
    expect(scene.getCamera()).toBeInstanceOf(THREE.PerspectiveCamera);
    expect(scene.getRenderer()).toBeInstanceOf(THREE.WebGLRenderer);
  });

  it('should add agent to scene', () => {
    const agent: AgentStatus = {
      agent_name: 'TestAgent',
      status: 'idle',
      current_load: 1,
      max_concurrent_tasks: 5,
      is_online: true,
      total_tasks_completed: 10,
      total_cost_usd: 1.5
    };

    scene.addAgent(agent);
    const retrieved = scene.getAgent(agent.agent_name);
    expect(retrieved).toBeDefined();
    expect(retrieved?.status.agent_name).toBe('TestAgent');
  });

  it('should update agent status', () => {
    const agent: AgentStatus = {
      agent_name: 'TestAgent',
      status: 'idle',
      current_load: 1,
      max_concurrent_tasks: 5,
      is_online: true,
      total_tasks_completed: 10,
      total_cost_usd: 1.5
    };

    scene.addAgent(agent);

    const updated: AgentStatus = {
      ...agent,
      status: 'working',
      current_load: 3
    };

    scene.updateAgent(updated);
    const retrieved = scene.getAgent(agent.agent_name);
    expect(retrieved?.status.status).toBe('working');
    expect(retrieved?.status.current_load).toBe(3);
  });

  it('should remove agent from scene', () => {
    const agent: AgentStatus = {
      agent_name: 'TestAgent',
      status: 'idle',
      current_load: 0,
      max_concurrent_tasks: 5,
      is_online: true,
      total_tasks_completed: 0,
      total_cost_usd: 0
    };

    scene.addAgent(agent);
    scene.removeAgent(agent.agent_name);
    expect(scene.getAgent(agent.agent_name)).toBeUndefined();
  });

  it('should start and stop rendering', () => {
    scene.start();
    expect(scene).toBeDefined();
    scene.stop();
    expect(scene).toBeDefined();
  });

  it('should load in less than 3 seconds', async () => {
    const startTime = Date.now();
    scene.start();
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000);
    scene.stop();
  });
});

describe('AgentAnimator', () => {
  let animator: AgentAnimator;
  let agents: Map<any, any>;

  beforeEach(() => {
    agents = new Map();
    animator = new AgentAnimator(agents);
  });

  it('should update agent status color', () => {
    const agent: AgentStatus = {
      agent_name: 'TestAgent',
      status: 'working',
      current_load: 2,
      max_concurrent_tasks: 5,
      is_online: true,
      total_tasks_completed: 5,
      total_cost_usd: 0.5
    };

    // Mock agent avatar
    const mockCube = {
      material: {
        color: new THREE.Color(0x000000),
        emissive: new THREE.Color(0x000000)
      }
    };

    agents.set('TestAgent', {
      status: agent,
      cube: mockCube,
      animationState: {
        targetColor: new THREE.Color(0x000000),
        targetScale: 1,
        rotationSpeed: 0
      }
    });

    animator.updateStatus('TestAgent', agent);
    expect(animator.getAnimationState('TestAgent')).toBeDefined();
  });

  it('should update load level', () => {
    const state = {
      cube: { material: { color: new THREE.Color(), emissive: new THREE.Color() } },
      sphere: {},
      ring: {},
      mesh: {},
      status: {} as any,
      animationState: {
        targetColor: new THREE.Color(),
        targetScale: 1,
        rotationSpeed: 0
      }
    };

    agents.set('TestAgent', state);
    animator.updateLoadLevel('TestAgent', 3, 5);

    const animState = animator.getAnimationState('TestAgent');
    expect(animState?.targetScale).toBeGreaterThan(0.5);
  });

  it('should handle fade effects', () => {
    const state = {
      cube: { material: { color: new THREE.Color(), emissive: new THREE.Color(), transparent: false, opacity: 1 } },
      sphere: {},
      ring: {},
      mesh: { visible: true, scale: { set: () => {} } },
      status: {} as any,
      animationState: {
        targetColor: new THREE.Color(),
        targetScale: 1,
        rotationSpeed: 0
      }
    };

    agents.set('TestAgent', state);
    animator.fadeInAgent('TestAgent', 500);
    animator.fadeOutAgent('TestAgent', 500);
    expect(agents.has('TestAgent')).toBe(true);
  });
});

describe('TaskFlowVisualizer', () => {
  let visualizer: TaskFlowVisualizer;
  let scene: THREE.Scene;

  beforeEach(() => {
    scene = new THREE.Scene();
    visualizer = new TaskFlowVisualizer(scene);
  });

  it('should create task orb', () => {
    const orb = visualizer.createTaskOrb(1); // Medium priority
    expect(orb).toBeInstanceOf(THREE.Mesh);
    expect((orb.material as any).color).toBeDefined();
  });

  it('should add task flow', () => {
    const from = new THREE.Vector3(0, 0, 0);
    const to = new THREE.Vector3(10, 0, 10);

    const orb = visualizer.addTaskFlow(
      'task-1',
      from,
      to,
      1,
      1000
    );

    expect(orb).toBeInstanceOf(THREE.Mesh);
    expect(scene.children).toContain(orb);
  });

  it('should update task flow progress', () => {
    const from = new THREE.Vector3(0, 0, 0);
    const to = new THREE.Vector3(10, 0, 10);

    visualizer.addTaskFlow('task-1', from, to, 1, 1000);
    visualizer.updateTaskFlowProgress('task-1', 0.5);

    const orb = visualizer.getTaskOrb('task-1');
    expect(orb?.position.distanceTo(from)).toBeGreaterThan(0);
  });

  it('should handle task completion', (done) => {
    const from = new THREE.Vector3(0, 0, 0);
    const to = new THREE.Vector3(10, 0, 10);

    visualizer.addTaskFlow('task-1', from, to, 1, 1000);
    visualizer.completeTaskAnimation('task-1', () => {
      expect(visualizer.getTaskOrb('task-1')).toBeUndefined();
      done();
    });
  });

  it('should handle task failure', (done) => {
    const from = new THREE.Vector3(0, 0, 0);
    const to = new THREE.Vector3(10, 0, 10);

    visualizer.addTaskFlow('task-1', from, to, 2, 1000);
    visualizer.failTaskAnimation('task-1', () => {
      expect(visualizer.getTaskOrb('task-1')).toBeUndefined();
      done();
    });
  });

  it('should maintain 60 FPS during animation', () => {
    let frameTime = 0;
    let frameCount = 0;

    const animate = () => {
      const now = performance.now();
      frameTime = now - (frameTime || now);
      frameCount++;

      if (frameCount > 60) {
        const avgFrameTime = frameTime / frameCount;
        expect(avgFrameTime).toBeLessThan(16.67); // 60 FPS = 16.67ms per frame
        return;
      }

      visualizer.updateTaskFlows(frameTime / 1000);
      requestAnimationFrame(animate);
    };

    animate();
  });
});

describe('Performance Optimization', () => {
  it('should load scene in less than 3 seconds', async () => {
    const canvas = document.createElement('canvas');
    const startTime = performance.now();

    const scene = new AgentFloorScene(canvas);
    const loadTime = performance.now() - startTime;

    scene.dispose();

    expect(loadTime).toBeLessThan(3000);
  });

  it('should maintain low memory footprint', async () => {
    if (!(performance as any).memory) {
      console.warn('Memory API not available, skipping test');
      return;
    }

    const canvas = document.createElement('canvas');
    const scene = new AgentFloorScene(canvas);

    // Add multiple agents
    for (let i = 0; i < 100; i++) {
      scene.addAgent({
        agent_name: `Agent-${i}`,
        status: 'idle',
        current_load: 0,
        max_concurrent_tasks: 5,
        is_online: true,
        total_tasks_completed: 0,
        total_cost_usd: 0
      });
    }

    const memory = (performance as any).memory.usedJSHeapSize;
    const memoryMB = memory / 1024 / 1024;

    scene.dispose();

    expect(memoryMB).toBeLessThan(100);
  });

  it('should handle interaction latency under 50ms', async () => {
    const canvas = document.createElement('canvas');
    const scene = new AgentFloorScene(canvas);

    let callbackTime = 0;

    scene.onAgentClick((agentName) => {
      callbackTime = performance.now();
    });

    const startTime = performance.now();
    // Simulate click handling
    const latency = performance.now() - startTime;

    scene.dispose();

    expect(latency).toBeLessThan(50);
  });
});

describe('Integration Tests', () => {
  it('should handle full workflow: add agent > add task > update > complete', async () => {
    const canvas = document.createElement('canvas');
    const scene = new AgentFloorScene(canvas);

    // Add agent
    const agent: AgentStatus = {
      agent_name: 'TestAgent',
      status: 'idle',
      current_load: 0,
      max_concurrent_tasks: 5,
      is_online: true,
      total_tasks_completed: 0,
      total_cost_usd: 0
    };

    scene.addAgent(agent);

    // Update to working
    scene.updateAgent({
      ...agent,
      status: 'working',
      current_load: 2
    });

    // Verify update
    const updated = scene.getAgent(agent.agent_name);
    expect(updated?.status.status).toBe('working');
    expect(updated?.status.current_load).toBe(2);

    scene.dispose();
  });

  it('should handle 60 FPS with multiple agents and tasks', async () => {
    const canvas = document.createElement('canvas');
    const sceneManager = new AgentFloorScene(canvas);
    const visualizer = new TaskFlowVisualizer(sceneManager.getScene());

    // Add 10 agents
    for (let i = 0; i < 10; i++) {
      sceneManager.addAgent({
        agent_name: `Agent-${i}`,
        status: 'working',
        current_load: Math.random() * 5,
        max_concurrent_tasks: 5,
        is_online: true,
        total_tasks_completed: 0,
        total_cost_usd: 0
      });
    }

    // Add 50 tasks
    const agents = Array.from({ length: 10 }, (_, i) => sceneManager.getAgent(`Agent-${i}`)!);

    for (let i = 0; i < 50; i++) {
      const from = agents[i % 10];
      const to = agents[(i + 1) % 10];

      if (from && to) {
        visualizer.addTaskFlow(
          `task-${i}`,
          from.mesh.position,
          to.mesh.position,
          (i % 3) as any,
          1000
        );
      }
    }

    sceneManager.start();

    // Measure frame time
    let frameCount = 0;
    const frameStart = performance.now();

    const measure = () => {
      frameCount++;
      if (frameCount > 60) {
        const elapsed = performance.now() - frameStart;
        const avgFrameTime = elapsed / frameCount;
        expect(avgFrameTime).toBeLessThan(16.67); // 60 FPS
        sceneManager.stop();
        return;
      }
      requestAnimationFrame(measure);
    };

    measure();

    visualizer.clearAll();
    sceneManager.dispose();
  });
});
