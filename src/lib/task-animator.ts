/**
 * Task Animation Engine - Phase 6C
 * Handles task orb animations and flow visualization
 */

import * as THREE from 'three';
import { TaskFlow } from '../types/floor-3d';

/**
 * Task orb animation controller
 */
export class TaskFlowVisualizer {
  private scene: THREE.Scene;
  private taskOrbs: Map<string, THREE.Mesh> = new Map();
  private taskPaths: Map<string, THREE.CubicBezierCurve3> = new Map();
  private taskProgress: Map<string, number> = new Map();
  private taskStartTimes: Map<string, number> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Create task orb
   */
  createTaskOrb(priority: number): THREE.Mesh {
    const geom = new THREE.IcosahedronGeometry(0.2, 4);
    const color = this.getPriorityColor(priority);
    
    const mat = new THREE.MeshPhongMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 1,
      shininess: 100,
      wireframe: false
    });
    
    const mesh = new THREE.Mesh(geom, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    return mesh;
  }

  /**
   * Add task flow to visualization
   */
  addTaskFlow(
    taskId: string,
    fromPosition: THREE.Vector3,
    toPosition: THREE.Vector3,
    priority: number,
    duration: number
  ): THREE.Mesh {
    // Create orb
    const orb = this.createTaskOrb(priority);
    orb.position.copy(fromPosition);
    
    // Store data
    this.taskOrbs.set(taskId, orb);
    this.taskProgress.set(taskId, 0);
    this.taskStartTimes.set(taskId, Date.now());
    
    // Create Bezier curve path
    const controlPoint1 = new THREE.Vector3(
      (fromPosition.x + toPosition.x) / 2,
      5,
      (fromPosition.z + toPosition.z) / 2
    );
    const controlPoint2 = new THREE.Vector3(
      (fromPosition.x + toPosition.x) / 2,
      5,
      (fromPosition.z + toPosition.z) / 2
    );
    
    const curve = new THREE.CubicBezierCurve3(
      fromPosition,
      controlPoint1,
      controlPoint2,
      toPosition
    );
    
    this.taskPaths.set(taskId, curve);
    this.scene.add(orb);
    
    return orb;
  }

  /**
   * Update task flow progress
   */
  updateTaskFlowProgress(taskId: string, progress: number): void {
    const orb = this.taskOrbs.get(taskId);
    if (!orb) return;

    progress = Math.max(0, Math.min(progress, 1));
    this.taskProgress.set(taskId, progress);

    const curve = this.taskPaths.get(taskId);
    if (curve) {
      const point = curve.getPoint(progress);
      orb.position.copy(point);
    }

    // Update glow intensity based on progress
    const material = orb.material as THREE.MeshPhongMaterial;
    material.emissiveIntensity = 0.7 + progress * 0.3;
  }

  /**
   * Complete task animation (success)
   */
  completeTaskAnimation(taskId: string, onComplete?: () => void): void {
    const orb = this.taskOrbs.get(taskId);
    if (!orb) return;

    const material = orb.material as THREE.MeshPhongMaterial;
    const originalColor = material.color.getHex();
    
    // Green flash
    material.color.setHex(0x10b981);
    material.emissive.setHex(0x10b981);
    material.emissiveIntensity = 1.5;

    // Scale up
    const startScale = orb.scale.x;
    const startTime = Date.now();
    const duration = 300;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      orb.scale.set(
        startScale * (1 + progress * 1.5),
        startScale * (1 + progress * 1.5),
        startScale * (1 + progress * 1.5)
      );

      material.opacity = 1 - progress;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.removeTaskFlow(taskId);
        if (onComplete) onComplete();
      }
    };

    animate();
  }

  /**
   * Fail task animation (error)
   */
  failTaskAnimation(taskId: string, onComplete?: () => void): void {
    const orb = this.taskOrbs.get(taskId);
    if (!orb) return;

    const material = orb.material as THREE.MeshPhongMaterial;
    
    // Red spark
    material.color.setHex(0xef4444);
    material.emissive.setHex(0xef4444);
    material.emissiveIntensity = 2.0;

    // Violent rotation + scale down
    const startTime = Date.now();
    const duration = 400;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      orb.rotation.x += 0.3;
      orb.rotation.y += 0.3;
      orb.rotation.z += 0.3;

      orb.scale.set(
        1 * (1 - progress * 0.8),
        1 * (1 - progress * 0.8),
        1 * (1 - progress * 0.8)
      );

      material.opacity = 1 - progress;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.removeTaskFlow(taskId);
        if (onComplete) onComplete();
      }
    };

    animate();
  }

  /**
   * Pulse task orb
   */
  pulseTaskOrb(taskId: string): void {
    const orb = this.taskOrbs.get(taskId);
    if (!orb) return;

    const originalScale = orb.scale.x;
    const startTime = Date.now();
    const duration = 400;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / duration;

      const pulsed = originalScale * (1 + Math.sin(progress * Math.PI) * 0.3);
      orb.scale.set(pulsed, pulsed, pulsed);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }

  /**
   * Get priority color
   */
  private getPriorityColor(priority: number): number {
    switch (priority) {
      case 0: return 0x10b981; // Low = green
      case 1: return 0xf59e0b; // Medium = amber
      case 2: return 0xef4444; // High = red
      default: return 0x0ea5e9; // Default = blue
    }
  }

  /**
   * Remove task flow
   */
  removeTaskFlow(taskId: string): void {
    const orb = this.taskOrbs.get(taskId);
    if (orb) {
      this.scene.remove(orb);
      (orb.geometry as THREE.BufferGeometry).dispose();
      (orb.material as THREE.Material).dispose();
      this.taskOrbs.delete(taskId);
      this.taskPaths.delete(taskId);
      this.taskProgress.delete(taskId);
      this.taskStartTimes.delete(taskId);
    }
  }

  /**
   * Update all task flows (per frame)
   */
  updateTaskFlows(deltaTime: number): void {
    const now = Date.now();
    
    // Update orb rotations
    this.taskOrbs.forEach((orb) => {
      orb.rotation.x += 0.02;
      orb.rotation.y += 0.03;
      orb.rotation.z += 0.01;
    });
  }

  /**
   * Get task orb
   */
  getTaskOrb(taskId: string): THREE.Mesh | undefined {
    return this.taskOrbs.get(taskId);
  }

  /**
   * Clear all task flows
   */
  clearAll(): void {
    this.taskOrbs.forEach((orb) => {
      this.scene.remove(orb);
      (orb.geometry as THREE.BufferGeometry).dispose();
      (orb.material as THREE.Material).dispose();
    });
    
    this.taskOrbs.clear();
    this.taskPaths.clear();
    this.taskProgress.clear();
    this.taskStartTimes.clear();
  }

  /**
   * Get all active tasks
   */
  getActiveTasks(): string[] {
    return Array.from(this.taskOrbs.keys());
  }
}

/**
 * Helper function to create visualizer
 */
export function createTaskFlowVisualizer(scene: THREE.Scene): TaskFlowVisualizer {
  return new TaskFlowVisualizer(scene);
}
