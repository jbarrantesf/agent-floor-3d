/**
 * useAgentFloor3D - Main 3D floor scene hook
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { AgentFloorScene } from '../lib/three-scene';
import { AgentAnimator } from '../lib/agent-renderer';
import { TaskFlowVisualizer } from '../lib/task-animator';
import { FloorRealtimeSync } from '../lib/realtime-sync';
import { FloorInteraction } from '../lib/interactive-controls';
import { AgentStatus, TaskFlow, PerformanceMetrics } from '../types/floor-3d';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Main hook for managing 3D agent floor
 */
export function useAgentFloor3D(
  canvasRef: React.RefObject<HTMLCanvasElement>,
  supabase: SupabaseClient
) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    renderTime: 0,
    memoryUsage: 0,
    drawCalls: 0,
    triangles: 0
  });

  const sceneRef = useRef<AgentFloorScene | null>(null);
  const animatorRef = useRef<AgentAnimator | null>(null);
  const visualizerRef = useRef<TaskFlowVisualizer | null>(null);
  const syncRef = useRef<FloorRealtimeSync | null>(null);
  const interactionRef = useRef<FloorInteraction | null>(null);

  // Initialize scene
  useEffect(() => {
    if (!canvasRef.current) return;

    try {
      // Create scene
      const scene = new AgentFloorScene(canvasRef.current, {
        canvasSize: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        performanceMode: 'high'
      });

      // Create animator
      const animator = new AgentAnimator(scene['agents'], {
        colorTransitionDuration: 500,
        scaleTransitionDuration: 600
      });

      // Create task visualizer
      const visualizer = new TaskFlowVisualizer(scene.getScene());

      // Create interaction handler
      const interaction = new FloorInteraction(
        scene.getCamera(),
        scene.getScene(),
        canvasRef.current
      );

      // Setup interaction callbacks
      interaction.onAgentClick((agentName) => {
        setSelectedAgent(agentName);
        animator.highlightAgent(agentName, true);
      });

      // Create sync manager
      const sync = new FloorRealtimeSync(supabase, scene);

      // Setup sync handlers
      sync.on('agent_capacity_update', (agent: AgentStatus) => {
        animator.updateStatus(agent.agent_name, agent);
        animator.updateLoadLevel(
          agent.agent_name,
          agent.current_load,
          agent.max_concurrent_tasks
        );
      });

      sync.on('task_created', (event: any) => {
        // Task visualization will be handled by task_assigned
      });

      sync.on('task_assigned', (event: any) => {
        const task: TaskFlow = {
          id: event.task_id,
          from_agent: event.delegated_by,
          to_agent: event.assigned_to,
          task_id: event.task_id,
          priority: event.priority || 1,
          complexity: event.complexity || 0.5,
          timeout_seconds: event.timeout_seconds || 30,
          progress: 0.25,
          status: 'in_transit',
          created_at: new Date().toISOString()
        };

        const fromAgent = scene.getAgent(task.from_agent);
        const toAgent = scene.getAgent(task.to_agent);

        if (fromAgent && toAgent) {
          visualizer.addTaskFlow(
            task.id,
            fromAgent.mesh.position,
            toAgent.mesh.position,
            task.priority,
            task.timeout_seconds * 1000
          );
        }
      });

      sync.on('task_progress', (event: any) => {
        scene.updateTaskFlow(event.task_id, event.progress || 0);
      });

      sync.on('task_completed', (event: any) => {
        visualizer.completeTaskAnimation(event.task_id);
      });

      sync.on('task_failed', (event: any) => {
        visualizer.failTaskAnimation(event.task_id);
      });

      // Store references
      sceneRef.current = scene;
      animatorRef.current = animator;
      visualizerRef.current = visualizer;
      syncRef.current = sync;
      interactionRef.current = interaction;

      // Fetch initial data
      (async () => {
        const agents = await sync.fetchAgentCapacity();
        agents.forEach(agent => {
          scene.addAgent(agent);
          animator.updateStatus(agent.agent_name, agent);
        });

        const tasks = await sync.fetchActiveTasks();
        tasks.forEach(task => {
          const fromAgent = scene.getAgent(task.delegated_by);
          const toAgent = scene.getAgent(task.assigned_to);

          if (fromAgent && toAgent) {
            visualizer.addTaskFlow(
              task.id,
              fromAgent.mesh.position,
              toAgent.mesh.position,
              task.priority || 1,
              (task.timeout_seconds || 30) * 1000
            );
          }
        });
      })();

      // Subscribe to real-time updates
      sync.subscribeToAgentCapacity();
      sync.subscribeToTaskEvents();
      sync.subscribeToTasks();
      sync.subscribeToCosting();

      // Start rendering
      scene.start();

      setIsInitialized(true);
    } catch (error) {
      console.error('Failed to initialize 3D floor:', error);
    }

    return () => {
      // Cleanup
      if (syncRef.current) syncRef.current.unsubscribeAll();
      if (sceneRef.current) sceneRef.current.dispose();
      if (visualizerRef.current) visualizerRef.current.clearAll();
    };
  }, [canvasRef, supabase]);

  // Monitor performance
  useEffect(() => {
    if (!sceneRef.current) return;

    const interval = setInterval(() => {
      const renderer = sceneRef.current?.getRenderer();
      if (renderer) {
        const info = renderer.info;
        setMetrics({
          fps: Math.round(1000 / 16.67), // Target 60 FPS
          renderTime: 0,
          memoryUsage: (performance as any).memory?.usedJSHeapSize || 0,
          drawCalls: info.render.calls,
          triangles: info.render.triangles
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Camera controls
  const focusAgent = useCallback((agentName: string) => {
    if (sceneRef.current) {
      sceneRef.current.focusAgent(agentName);
    }
  }, []);

  const resetCamera = useCallback(() => {
    if (sceneRef.current) {
      sceneRef.current.resetCamera();
    }
  }, []);

  // Clear selection
  const clearSelection = useCallback(() => {
    if (selectedAgent && animatorRef.current) {
      animatorRef.current.highlightAgent(selectedAgent, false);
    }
    setSelectedAgent(null);
  }, [selectedAgent]);

  return {
    isInitialized,
    selectedAgent,
    metrics,
    focusAgent,
    resetCamera,
    clearSelection,
    scene: sceneRef.current,
    animator: animatorRef.current,
    visualizer: visualizerRef.current,
    sync: syncRef.current,
    interaction: interactionRef.current
  };
}
