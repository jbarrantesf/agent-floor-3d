/**
 * 3D Floor Visualization Types - Phase 6
 * Types for agent avatars, task flows, and scene management
 */

import * as THREE from 'three';

/**
 * Agent status for 3D rendering
 */
export interface AgentStatus {
  agent_name: string;
  status: 'idle' | 'working' | 'error' | 'queued' | 'offline';
  current_load: number;
  max_concurrent_tasks: number;
  is_online: boolean;
  total_tasks_completed: number;
  total_cost_usd: number;
  last_result?: Record<string, any>;
  color?: string;
  position?: THREE.Vector3;
}

/**
 * Task flow visualization
 */
export interface TaskFlow {
  id: string;
  from_agent: string;
  to_agent: string;
  task_id: string;
  priority: 0 | 1 | 2; // 0=low, 1=medium, 2=high
  complexity: number;
  timeout_seconds: number;
  progress: number; // 0-1
  status: 'pending' | 'in_transit' | 'executing' | 'completed' | 'failed';
  created_at: string;
}

/**
 * Rendered agent object
 */
export interface Agent3DObject {
  mesh: THREE.Group;
  cube: THREE.Mesh;
  sphere: THREE.Mesh;
  ring: THREE.Mesh;
  label: THREE.Sprite;
  status: AgentStatus;
  animationState: {
    targetColor: THREE.Color;
    targetScale: number;
    rotationSpeed: number;
  };
}

/**
 * Cost ticker data
 */
export interface CostData {
  lastTaskCost: number;
  dailyAgentCost: Record<string, number>;
  totalDailyCost: number;
  runningTasksCost: number;
  taskCount: number;
  costPerSecond: number;
}

/**
 * Scene configuration
 */
export interface SceneConfig {
  canvasSize?: { width: number; height: number };
  cameraDistance?: number;
  agentRadius?: number;
  lightIntensity?: number;
  targetFPS?: number;
  performanceMode?: 'low' | 'medium' | 'high';
}

/**
 * Interaction state
 */
export interface InteractionState {
  selectedAgent: string | null;
  hoveredTask: string | null;
  contextMenuVisible: boolean;
  contextMenuPosition: { x: number; y: number };
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  fps: number;
  renderTime: number;
  memoryUsage: number;
  drawCalls: number;
  triangles: number;
}
