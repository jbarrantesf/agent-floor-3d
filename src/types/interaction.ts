/**
 * Interaction Types
 */

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
 * Context menu item
 */
export interface ContextMenuItem {
  label: string;
  action: () => void | Promise<void>;
  icon?: string;
  disabled?: boolean;
  separator?: boolean;
}

/**
 * Task context menu
 */
export interface TaskContextMenu {
  taskId: string;
  x: number;
  y: number;
  items: ContextMenuItem[];
}

/**
 * Agent details panel data
 */
export interface AgentDetailsPanel {
  agentName: string;
  status: string;
  currentLoad: number;
  maxLoad: number;
  activeTasks: any[];
  completedTasks: number;
  failedTasks: number;
  totalCost: number;
  lastResult?: any;
}

/**
 * Selection event
 */
export interface SelectionEvent {
  type: 'agent' | 'task' | 'none';
  id?: string;
  x: number;
  y: number;
}
