/**
 * Three.js Scene Setup - Phase 6A
 * Core scene initialization and agent avatar rendering
 */

import * as THREE from 'three';
import { AgentStatus, Agent3DObject, SceneConfig, TaskFlow } from '../types/floor-3d';

const DEFAULT_CONFIG: SceneConfig = {
  canvasSize: { width: 1920, height: 1080 },
  cameraDistance: 25,
  agentRadius: 15,
  lightIntensity: 1.5,
  targetFPS: 60,
  performanceMode: 'high'
};

/**
 * Main 3D scene manager for agent visualization
 */
export class AgentFloorScene {
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private canvas: HTMLCanvasElement;
  private agents: Map<string, Agent3DObject> = new Map();
  private taskFlows: Map<string, THREE.Group> = new Map();
  private config: SceneConfig;
  
  private animationFrameId: number | null = null;
  private clock = new THREE.Clock();
  
  private onAgentClickCallback: ((agentName: string) => void) | null = null;
  private onTaskRightClickCallback: ((taskId: string) => void) | null = null;
  
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  
  private orbitControls: any; // Will be imported from drei in React component

  constructor(canvas: HTMLCanvasElement, config?: Partial<SceneConfig>) {
    this.canvas = canvas;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize Three.js components
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f172a);
    
    // Setup renderer
    this.renderer = new THREE.WebGLRenderer({ 
      canvas, 
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(
      this.config.canvasSize!.width, 
      this.config.canvasSize!.height
    );
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    
    // Setup camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      this.config.canvasSize!.width / this.config.canvasSize!.height,
      0.1,
      1000
    );
    this.camera.position.set(0, this.config.cameraDistance!, this.config.cameraDistance!);
    this.camera.lookAt(0, 0, 0);
    
    // Setup lighting
    this.setupLighting();
    
    // Add center anchor
    this.addCenterAnchor();
    
    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Setup 3-point lighting
   */
  private setupLighting(): void {
    // Key light (main)
    const keyLight = new THREE.DirectionalLight(0xffffff, this.config.lightIntensity!);
    keyLight.position.set(20, 20, 20);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    this.scene.add(keyLight);
    
    // Fill light
    const fillLight = new THREE.DirectionalLight(0x0099ff, 0.5);
    fillLight.position.set(-15, 5, -15);
    this.scene.add(fillLight);
    
    // Back light
    const backLight = new THREE.DirectionalLight(0xff00ff, 0.3);
    backLight.position.set(-10, 10, -20);
    this.scene.add(backLight);
    
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);
  }

  /**
   * Add center anchor (ORBIT router visualization)
   */
  private addCenterAnchor(): void {
    // Center sphere (ORBIT)
    const centerGeom = new THREE.SphereGeometry(0.5, 32, 32);
    const centerMat = new THREE.MeshPhongMaterial({
      color: 0xa855f7,
      emissive: 0xa855f7,
      emissiveIntensity: 0.8,
      shininess: 100
    });
    const centerMesh = new THREE.Mesh(centerGeom, centerMat);
    centerMesh.userData.isCenter = true;
    this.scene.add(centerMesh);
    
    // Orbital ring around center
    const ringGeom = new THREE.TorusGeometry(1.2, 0.08, 16, 100);
    const ringMat = new THREE.MeshPhongMaterial({
      color: 0xa855f7,
      emissive: 0xa855f7,
      emissiveIntensity: 0.6
    });
    const ringMesh = new THREE.Mesh(ringGeom, ringMat);
    ringMesh.userData.isOrbitalRing = true;
    this.scene.add(ringMesh);
  }

  /**
   * Create agent avatar (glowing cube + sphere + ring)
   */
  createAgentAvatar(agent: AgentStatus): Agent3DObject {
    const group = new THREE.Group();
    
    // Determine status color
    const statusColor = this.getStatusColor(agent.status);
    
    // Calculate scale based on load
    const loadRatio = agent.current_load / agent.max_concurrent_tasks;
    const scale = 0.5 + loadRatio * 1.5;
    
    // Create main cube
    const cubeGeom = new THREE.BoxGeometry(1, 1, 1);
    const cubeMat = new THREE.MeshPhongMaterial({
      color: statusColor,
      emissive: statusColor,
      emissiveIntensity: 0.6,
      shininess: 100
    });
    const cube = new THREE.Mesh(cubeGeom, cubeMat);
    cube.castShadow = true;
    cube.receiveShadow = true;
    cube.userData.agentName = agent.agent_name;
    group.add(cube);
    
    // Create inner sphere (heartbeat indicator)
    const sphereGeom = new THREE.SphereGeometry(0.3, 32, 32);
    const sphereMat = new THREE.MeshPhongMaterial({
      color: 0x00ff00,
      wireframe: true,
      transparent: true,
      opacity: 0.7
    });
    const sphere = new THREE.Mesh(sphereGeom, sphereMat);
    sphere.userData.isHeartbeat = true;
    group.add(sphere);
    
    // Create orbital ring (activity indicator)
    const ringGeom = new THREE.TorusGeometry(1.3, 0.1, 16, 100);
    const ringMat = new THREE.MeshPhongMaterial({
      color: 0x00ccff,
      emissive: 0x00ccff,
      emissiveIntensity: 0.8
    });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.userData.isActivityRing = true;
    ring.userData.rotationSpeed = 0;
    group.add(ring);
    
    // Set scale and position
    group.scale.set(scale, scale, scale);
    group.userData.agentName = agent.agent_name;
    
    return {
      mesh: group,
      cube,
      sphere,
      ring,
      label: new THREE.Sprite(),
      status: agent,
      animationState: {
        targetColor: new THREE.Color(statusColor),
        targetScale: scale,
        rotationSpeed: (loadRatio / 5) * Math.PI
      }
    };
  }

  /**
   * Get color based on agent status
   */
  private getStatusColor(status: string): number {
    switch (status) {
      case 'idle': return 0x10b981; // Green
      case 'working': return 0x0ea5e9; // Blue
      case 'error': return 0xef4444; // Red
      case 'queued': return 0xf59e0b; // Amber
      case 'offline': return 0x6b7280; // Gray
      default: return 0x9ca3af;
    }
  }

  /**
   * Add agent to scene
   */
  addAgent(agent: AgentStatus): void {
    if (this.agents.has(agent.agent_name)) {
      console.warn(`Agent ${agent.agent_name} already exists`);
      return;
    }
    
    const avatar = this.createAgentAvatar(agent);
    
    // Position agents in circular layout
    const agentCount = this.agents.size;
    const angle = (agentCount * 2 * Math.PI) / 10; // Up to 10 agents
    const radius = this.config.agentRadius!;
    
    avatar.mesh.position.set(
      Math.cos(angle) * radius,
      0,
      Math.sin(angle) * radius
    );
    
    this.scene.add(avatar.mesh);
    this.agents.set(agent.agent_name, avatar);
  }

  /**
   * Update agent status and appearance
   */
  updateAgent(agent: AgentStatus): void {
    const avatar = this.agents.get(agent.agent_name);
    if (!avatar) {
      this.addAgent(agent);
      return;
    }
    
    avatar.status = agent;
    
    // Update color
    const targetColor = this.getStatusColor(agent.status);
    avatar.animationState.targetColor = new THREE.Color(targetColor);
    
    // Update scale based on load
    const loadRatio = agent.current_load / agent.max_concurrent_tasks;
    avatar.animationState.targetScale = 0.5 + loadRatio * 1.5;
    avatar.animationState.rotationSpeed = (loadRatio / 5) * Math.PI;
  }

  /**
   * Remove agent from scene
   */
  removeAgent(agentName: string): void {
    const avatar = this.agents.get(agentName);
    if (avatar) {
      this.scene.remove(avatar.mesh);
      this.agents.delete(agentName);
    }
  }

  /**
   * Get agent by name
   */
  getAgent(agentName: string): Agent3DObject | undefined {
    return this.agents.get(agentName);
  }

  /**
   * Add task flow visualization
   */
  addTaskFlow(task: TaskFlow): void {
    if (this.taskFlows.has(task.id)) {
      console.warn(`Task ${task.id} already visualized`);
      return;
    }
    
    const fromAgent = this.agents.get(task.from_agent);
    const toAgent = this.agents.get(task.to_agent);
    
    if (!fromAgent || !toAgent) {
      console.warn(`Agents not found for task ${task.id}`);
      return;
    }
    
    // Create task orb
    const orbGeom = new THREE.IcosahedronGeometry(0.2, 4);
    const orbMat = new THREE.MeshPhongMaterial({
      color: this.getPriorityColor(task.priority),
      emissive: this.getPriorityColor(task.priority),
      emissiveIntensity: 1,
      shininess: 100
    });
    const orb = new THREE.Mesh(orbGeom, orbMat);
    orb.userData.taskId = task.id;
    
    const group = new THREE.Group();
    group.add(orb);
    group.userData.taskId = task.id;
    group.userData.fromAgent = fromAgent.mesh;
    group.userData.toAgent = toAgent.mesh;
    group.userData.progress = 0;
    group.userData.totalDuration = task.timeout_seconds * 1000; // ms
    group.userData.startTime = Date.now();
    
    this.scene.add(group);
    this.taskFlows.set(task.id, group);
  }

  /**
   * Update task flow progress
   */
  updateTaskFlow(taskId: string, progress: number): void {
    const flow = this.taskFlows.get(taskId);
    if (flow) {
      flow.userData.progress = Math.min(Math.max(progress, 0), 1);
    }
  }

  /**
   * Remove task flow
   */
  removeTaskFlow(taskId: string): void {
    const flow = this.taskFlows.get(taskId);
    if (flow) {
      this.scene.remove(flow);
      this.taskFlows.delete(taskId);
    }
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
   * Focus camera on agent
   */
  focusAgent(agentName: string): void {
    const avatar = this.agents.get(agentName);
    if (avatar) {
      const position = avatar.mesh.position;
      this.camera.position.lerp(
        new THREE.Vector3(
          position.x + 10,
          this.config.cameraDistance!,
          position.z + 10
        ),
        0.1
      );
      this.camera.lookAt(position);
    }
  }

  /**
   * Reset camera to default position
   */
  resetCamera(): void {
    this.camera.position.lerp(
      new THREE.Vector3(0, this.config.cameraDistance!, this.config.cameraDistance!),
      0.05
    );
    this.camera.lookAt(0, 0, 0);
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    document.addEventListener('click', (event) => this.handleClick(event));
    document.addEventListener('contextmenu', (event) => this.handleContextMenu(event));
    window.addEventListener('resize', () => this.handleResize());
  }

  /**
   * Handle left click
   */
  private handleClick(event: MouseEvent): void {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    
    if (intersects.length > 0) {
      const object = intersects[0].object;
      const agentName = object.userData.agentName;
      if (agentName && this.onAgentClickCallback) {
        this.onAgentClickCallback(agentName);
      }
    }
  }

  /**
   * Handle right click (context menu)
   */
  private handleContextMenu(event: MouseEvent): void {
    event.preventDefault();
    
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    
    if (intersects.length > 0) {
      const object = intersects[0].object;
      const taskId = object.userData.taskId;
      if (taskId && this.onTaskRightClickCallback) {
        this.onTaskRightClickCallback(taskId);
      }
    }
  }

  /**
   * Handle window resize
   */
  private handleResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(width, height);
  }

  /**
   * Setup click handler callback
   */
  onAgentClick(callback: (agentName: string) => void): void {
    this.onAgentClickCallback = callback;
  }

  /**
   * Setup context menu handler callback
   */
  onTaskRightClick(callback: (taskId: string) => void): void {
    this.onTaskRightClickCallback = callback;
  }

  /**
   * Main animation loop
   */
  private animate = (): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);
    
    const deltaTime = this.clock.getDelta();
    
    // Update agents
    this.agents.forEach((avatar) => {
      // Smooth color transition
      const material = avatar.cube.material as THREE.MeshPhongMaterial;
      material.color.lerp(avatar.animationState.targetColor, 0.05);
      material.emissive.lerp(avatar.animationState.targetColor, 0.05);
      
      // Smooth scale transition
      avatar.mesh.scale.lerp(
        new THREE.Vector3(
          avatar.animationState.targetScale,
          avatar.animationState.targetScale,
          avatar.animationState.targetScale
        ),
        0.05
      );
      
      // Rotate ring
      avatar.ring.rotation.z += avatar.animationState.rotationSpeed * deltaTime;
      
      // Pulse sphere based on activity
      const loadRatio = avatar.status.current_load / avatar.status.max_concurrent_tasks;
      const pulseScale = 1 + Math.sin(Date.now() * 0.003) * loadRatio * 0.3;
      avatar.sphere.scale.set(pulseScale, pulseScale, pulseScale);
    });
    
    // Update task flows (interpolate along path)
    this.taskFlows.forEach((flow) => {
      const fromPos = flow.userData.fromAgent.position;
      const toPos = flow.userData.toAgent.position;
      const progress = flow.userData.progress;
      
      // Bezier interpolation
      const controlPoint = new THREE.Vector3(0, 5, 0);
      const t = progress;
      
      const p1 = fromPos;
      const p2 = controlPoint;
      const p3 = controlPoint;
      const p4 = toPos;
      
      // Cubic Bezier formula
      const pos = new THREE.Vector3();
      const mt = 1 - t;
      const mt2 = mt * mt;
      const mt3 = mt2 * mt;
      const t2 = t * t;
      const t3 = t2 * t;
      
      pos.x = mt3 * p1.x + 3 * mt2 * t * p2.x + 3 * mt * t2 * p3.x + t3 * p4.x;
      pos.y = mt3 * p1.y + 3 * mt2 * t * p2.y + 3 * mt * t2 * p3.y + t3 * p4.y;
      pos.z = mt3 * p1.z + 3 * mt2 * t * p2.z + 3 * mt * t2 * p3.z + t3 * p4.z;
      
      flow.position.copy(pos);
      flow.rotation.z += 0.05;
    });
    
    // Rotate center orbital ring
    const centerRing = this.scene.children.find(obj => obj.userData.isOrbitalRing);
    if (centerRing) {
      centerRing.rotation.z += 0.01;
    }
    
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Start rendering
   */
  start(): void {
    if (!this.animationFrameId) {
      this.animate();
    }
  }

  /**
   * Stop rendering
   */
  stop(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Render single frame
   */
  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Get Three.js scene
   */
  getScene(): THREE.Scene {
    return this.scene;
  }

  /**
   * Get Three.js camera
   */
  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  /**
   * Get Three.js renderer
   */
  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.stop();
    
    this.agents.forEach((avatar) => {
      avatar.cube.geometry.dispose();
      (avatar.cube.material as THREE.Material).dispose();
      avatar.sphere.geometry.dispose();
      (avatar.sphere.material as THREE.Material).dispose();
      avatar.ring.geometry.dispose();
      (avatar.ring.material as THREE.Material).dispose();
    });
    
    this.taskFlows.forEach((flow) => {
      flow.children.forEach(child => {
        if ((child as any).geometry) (child as any).geometry.dispose();
        if ((child as any).material) (child as any).material.dispose();
      });
    });
    
    this.renderer.dispose();
  }
}

/**
 * Helper function to create agent avatar
 */
export function createAgentAvatar(agent: AgentStatus, scene: AgentFloorScene): Agent3DObject {
  return scene.createAgentAvatar(agent);
}
