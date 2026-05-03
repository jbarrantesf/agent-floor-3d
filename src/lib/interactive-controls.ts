/**
 * Interactive Controls - Phase 6E
 * Handles click and right-click interactions
 */

import * as THREE from 'three';

/**
 * Context menu item
 */
export interface ContextMenuItem {
  label: string;
  action: () => void;
  icon?: string;
}

/**
 * Interaction handler
 */
export class FloorInteraction {
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private camera: THREE.Camera;
  private scene: THREE.Scene;
  
  private onAgentClickCallback: ((agentName: string, event: MouseEvent) => void) | null = null;
  private onTaskRightClickCallback: ((taskId: string, event: MouseEvent) => void) | null = null;
  private onEmptyClickCallback: (() => void) | null = null;

  constructor(camera: THREE.Camera, scene: THREE.Scene, canvas: HTMLCanvasElement) {
    this.camera = camera;
    this.scene = scene;
    
    this.setupEventListeners(canvas);
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('click', (event) => this.handleLeftClick(event));
    canvas.addEventListener('contextmenu', (event) => this.handleRightClick(event));
    canvas.addEventListener('mousemove', (event) => this.handleMouseMove(event));
  }

  /**
   * Update mouse coordinates
   */
  private updateMouseCoordinates(event: MouseEvent): void {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  /**
   * Handle left click
   */
  private handleLeftClick(event: MouseEvent): void {
    this.updateMouseCoordinates(event);
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    
    if (intersects.length > 0) {
      let object = intersects[0].object as any;
      
      // Traverse up to find agent
      while (object && !object.userData.agentName) {
        object = object.parent;
      }
      
      if (object && object.userData.agentName) {
        if (this.onAgentClickCallback) {
          this.onAgentClickCallback(object.userData.agentName, event);
        }
      } else if (this.onEmptyClickCallback) {
        this.onEmptyClickCallback();
      }
    } else if (this.onEmptyClickCallback) {
      this.onEmptyClickCallback();
    }
  }

  /**
   * Handle right click (context menu)
   */
  private handleRightClick(event: MouseEvent): void {
    event.preventDefault();
    
    this.updateMouseCoordinates(event);
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    
    if (intersects.length > 0) {
      let object = intersects[0].object as any;
      
      // Traverse up to find task
      while (object && !object.userData.taskId) {
        object = object.parent;
      }
      
      if (object && object.userData.taskId) {
        if (this.onTaskRightClickCallback) {
          this.onTaskRightClickCallback(object.userData.taskId, event);
        }
      }
    }
  }

  /**
   * Handle mouse move (hover effects)
   */
  private handleMouseMove(event: MouseEvent): void {
    this.updateMouseCoordinates(event);
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    
    if (intersects.length > 0) {
      (event.target as HTMLElement).style.cursor = 'pointer';
    } else {
      (event.target as HTMLElement).style.cursor = 'grab';
    }
  }

  /**
   * Setup agent click handler
   */
  onAgentClick(callback: (agentName: string, event: MouseEvent) => void): void {
    this.onAgentClickCallback = callback;
  }

  /**
   * Setup task right-click handler
   */
  onTaskRightClick(callback: (taskId: string, event: MouseEvent) => void): void {
    this.onTaskRightClickCallback = callback;
  }

  /**
   * Setup empty space click handler
   */
  onEmptyClick(callback: () => void): void {
    this.onEmptyClickCallback = callback;
  }

  /**
   * Show context menu for task
   */
  showTaskContextMenu(
    taskId: string,
    x: number,
    y: number,
    items: ContextMenuItem[]
  ): void {
    // Create menu element
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    
    items.forEach((item) => {
      const menuItem = document.createElement('div');
      menuItem.className = 'context-menu-item';
      menuItem.innerHTML = item.icon ? `<span class="icon">${item.icon}</span>` : '';
      menuItem.innerHTML += `<span>${item.label}</span>`;
      
      menuItem.addEventListener('click', () => {
        item.action();
        document.body.removeChild(menu);
      });
      
      menu.appendChild(menuItem);
    });
    
    document.body.appendChild(menu);
    
    // Remove menu when clicking elsewhere
    const closeMenu = () => {
      if (document.body.contains(menu)) {
        document.body.removeChild(menu);
      }
      document.removeEventListener('click', closeMenu);
    };
    
    setTimeout(() => {
      document.addEventListener('click', closeMenu);
    }, 0);
  }

  /**
   * Show agent details panel
   */
  showAgentDetailsPanel(agentName: string): void {
    const event = new CustomEvent('agentSelected', { detail: { agentName } });
    document.dispatchEvent(event);
  }

  /**
   * Dispose
   */
  dispose(): void {
    // Cleanup if needed
  }
}

/**
 * Helper function to create interaction handler
 */
export function createFloorInteraction(
  camera: THREE.Camera,
  scene: THREE.Scene,
  canvas: HTMLCanvasElement
): FloorInteraction {
  return new FloorInteraction(camera, scene, canvas);
}

/**
 * Control API for task actions
 */
export const TaskControlAPI = {
  /**
   * Pause task
   */
  async pauseTask(taskId: string): Promise<void> {
    // Will be implemented with actual API client
    console.log(`Pause task: ${taskId}`);
  },

  /**
   * Resume task
   */
  async resumeTask(taskId: string): Promise<void> {
    // Will be implemented with actual API client
    console.log(`Resume task: ${taskId}`);
  },

  /**
   * Cancel task
   */
  async cancelTask(taskId: string): Promise<void> {
    // Will be implemented with actual API client
    console.log(`Cancel task: ${taskId}`);
  },

  /**
   * Reassign task to different agent
   */
  async reassignTask(taskId: string, newAgent: string): Promise<void> {
    // Will be implemented with actual API client
    console.log(`Reassign task ${taskId} to ${newAgent}`);
  },

  /**
   * View task details
   */
  async getTaskDetails(taskId: string): Promise<any> {
    // Will be implemented with actual API client
    console.log(`Get task details: ${taskId}`);
    return {};
  }
};
