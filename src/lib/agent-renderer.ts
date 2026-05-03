/**
 * Agent Avatar Animation Engine - Phase 6B
 * Handles real-time agent state animations
 */

import * as THREE from 'three';
import { Agent3DObject, AgentStatus } from '../types/floor-3d';

/**
 * Animation configuration
 */
interface AnimationConfig {
  colorTransitionDuration: number;
  scaleTransitionDuration: number;
  heartbeatIntensity: number;
  maxRotationSpeed: number;
}

const DEFAULT_ANIMATION_CONFIG: AnimationConfig = {
  colorTransitionDuration: 500, // ms
  scaleTransitionDuration: 600, // ms
  heartbeatIntensity: 1.5,
  maxRotationSpeed: Math.PI * 2
};

/**
 * Agent animation controller
 */
export class AgentAnimator {
  private agents: Map<string, Agent3DObject>;
  private config: AnimationConfig;
  private tweens: Map<string, any> = new Map();

  constructor(agents: Map<string, Agent3DObject>, config?: Partial<AnimationConfig>) {
    this.agents = agents;
    this.config = { ...DEFAULT_ANIMATION_CONFIG, ...config };
  }

  /**
   * Update agent status with smooth color transition
   */
  updateStatus(agentName: string, status: AgentStatus): void {
    const agent = this.agents.get(agentName);
    if (!agent) return;

    agent.status = status;

    // Update target color
    const targetColor = this.getStatusColor(status.status);
    agent.animationState.targetColor = new THREE.Color(targetColor);

    // Update material color over time
    const material = agent.cube.material as THREE.MeshPhongMaterial;
    this.animateColorTransition(
      material,
      material.color.getHex(),
      targetColor,
      this.config.colorTransitionDuration
    );
  }

  /**
   * Update agent load with scale transition
   */
  updateLoadLevel(agentName: string, currentLoad: number, maxLoad: number): void {
    const agent = this.agents.get(agentName);
    if (!agent) return;

    const loadRatio = currentLoad / maxLoad;
    const targetScale = 0.5 + loadRatio * 1.5;

    // Store target scale for smooth animation
    agent.animationState.targetScale = targetScale;

    // Update rotation speed based on load
    agent.animationState.rotationSpeed = (loadRatio / 5) * this.config.maxRotationSpeed;
  }

  /**
   * Animate color transition (simple lerp)
   */
  private animateColorTransition(
    material: THREE.MeshPhongMaterial,
    fromColor: number,
    toColor: number,
    duration: number
  ): void {
    // The actual lerp happens in the scene's animation loop
    // This just updates the target color which is used in the lerp
  }

  /**
   * Get status color
   */
  private getStatusColor(status: string): number {
    switch (status) {
      case 'idle': return 0x10b981; // Green
      case 'working': return 0x0ea5e9; // Blue
      case 'error': return 0xef4444; // Red
      case 'queued': return 0xf59e0b; // Amber
      case 'offline': return 0x6b7280; // Gray
      default: return 0x9ca3af; // Gray
    }
  }

  /**
   * Pulse heartbeat effect
   */
  pulseHeartbeat(agentName: string): void {
    const agent = this.agents.get(agentName);
    if (!agent) return;

    // Reset sphere scale and let animation loop handle pulsing
    // The pulse is done via Math.sin in the animation loop
  }

  /**
   * Set ring rotation speed (activity indicator)
   */
  setRingRotationSpeed(agentName: string, speed: number): void {
    const agent = this.agents.get(agentName);
    if (!agent) return;

    agent.animationState.rotationSpeed = Math.min(
      speed,
      this.config.maxRotationSpeed
    );
  }

  /**
   * Flash effect (for alerts)
   */
  flashAgent(agentName: string, color: number, duration: number = 300): void {
    const agent = this.agents.get(agentName);
    if (!agent) return;

    const material = agent.cube.material as THREE.MeshPhongMaterial;
    const originalColor = new THREE.Color(material.color);
    const flashColor = new THREE.Color(color);

    material.emissiveIntensity = 1.0;
    material.emissive = flashColor;

    setTimeout(() => {
      material.emissive = originalColor;
      material.emissiveIntensity = 0.6;
    }, duration);
  }

  /**
   * Error shake effect
   */
  shakeAgent(agentName: string, intensity: number = 0.1): void {
    const agent = this.agents.get(agentName);
    if (!agent) return;

    const originalPosition = agent.mesh.position.clone();
    const shakeDuration = 400;
    const startTime = Date.now();

    const shake = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / shakeDuration;

      if (progress >= 1) {
        agent.mesh.position.copy(originalPosition);
        return;
      }

      agent.mesh.position.x = originalPosition.x + (Math.random() - 0.5) * intensity;
      agent.mesh.position.y = originalPosition.y + (Math.random() - 0.5) * intensity;
      agent.mesh.position.z = originalPosition.z + (Math.random() - 0.5) * intensity;

      requestAnimationFrame(shake);
    };

    shake();
  }

  /**
   * Glow/highlight effect
   */
  highlightAgent(agentName: string, enabled: boolean): void {
    const agent = this.agents.get(agentName);
    if (!agent) return;

    const material = agent.cube.material as THREE.MeshPhongMaterial;
    
    if (enabled) {
      material.emissiveIntensity = 1.0;
    } else {
      material.emissiveIntensity = 0.6;
    }
  }

  /**
   * Fade in effect
   */
  fadeInAgent(agentName: string, duration: number = 500): void {
    const agent = this.agents.get(agentName);
    if (!agent) return;

    agent.mesh.visible = true;
    const material = agent.cube.material as THREE.MeshPhongMaterial;
    material.transparent = true;

    const startTime = Date.now();
    const startOpacity = 0;
    const endOpacity = 1;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      material.opacity = startOpacity + (endOpacity - startOpacity) * progress;

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }

  /**
   * Fade out effect
   */
  fadeOutAgent(agentName: string, duration: number = 500): void {
    const agent = this.agents.get(agentName);
    if (!agent) return;

    const material = agent.cube.material as THREE.MeshPhongMaterial;
    material.transparent = true;

    const startTime = Date.now();
    const startOpacity = 1;
    const endOpacity = 0;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      material.opacity = startOpacity + (endOpacity - startOpacity) * progress;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        agent.mesh.visible = false;
      }
    };

    animate();
  }

  /**
   * Spin effect (loading/processing)
   */
  spinAgent(agentName: string, duration: number): void {
    const agent = this.agents.get(agentName);
    if (!agent) return;

    const startRotation = agent.mesh.rotation.y;
    const targetRotation = startRotation + Math.PI * 2;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      agent.mesh.rotation.y = startRotation + (targetRotation - startRotation) * progress;

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }

  /**
   * Scale pulse effect
   */
  scalePulse(agentName: string, targetScale: number, duration: number = 400): void {
    const agent = this.agents.get(agentName);
    if (!agent) return;

    const originalScale = agent.mesh.scale.x;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease in-out
      const easeProgress = progress < 0.5
        ? 2 * progress * progress
        : -1 + (4 - 2 * progress) * progress;

      const scale = originalScale + (targetScale - originalScale) * easeProgress;
      agent.mesh.scale.set(scale, scale, scale);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }

  /**
   * Update all agent animations (called per frame)
   */
  updateAnimations(deltaTime: number): void {
    // Animations are mostly handled in the scene's animation loop
    // This is for any frame-based updates
  }

  /**
   * Get agent animation state
   */
  getAnimationState(agentName: string) {
    const agent = this.agents.get(agentName);
    return agent?.animationState || null;
  }

  /**
   * Reset all animations for agent
   */
  resetAnimations(agentName: string): void {
    const agent = this.agents.get(agentName);
    if (!agent) return;

    agent.mesh.position.set(0, 0, 0);
    agent.mesh.rotation.set(0, 0, 0);
    agent.mesh.scale.set(1, 1, 1);

    const material = agent.cube.material as THREE.MeshPhongMaterial;
    material.opacity = 1;
    material.emissiveIntensity = 0.6;
  }
}

/**
 * Helper function to create animator
 */
export function createAgentAnimator(
  agents: Map<string, Agent3DObject>,
  config?: Partial<AnimationConfig>
): AgentAnimator {
  return new AgentAnimator(agents, config);
}
