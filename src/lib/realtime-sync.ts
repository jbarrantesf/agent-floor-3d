/**
 * Real-time Sync with Supabase - Phase 6D
 * Manages real-time subscriptions for agent capacity and task events
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { AgentFloorScene } from './three-scene';
import { AgentStatus, TaskFlow } from '../types/floor-3d';

/**
 * Real-time synchronization manager
 */
export class FloorRealtimeSync {
  private supabase: SupabaseClient;
  private scene: AgentFloorScene;
  private subscriptions: any[] = [];
  private handlers: Map<string, Function> = new Map();

  constructor(supabase: SupabaseClient, scene: AgentFloorScene) {
    this.supabase = supabase;
    this.scene = scene;
  }

  /**
   * Subscribe to agent capacity changes
   */
  subscribeToAgentCapacity(onUpdate?: (agent: AgentStatus) => void): void {
    const channel = this.supabase
      .channel('agent_capacity_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_capacity'
        },
        (payload: any) => {
          const agent = payload.new as AgentStatus;
          this.scene.updateAgent(agent);
          
          if (onUpdate) onUpdate(agent);
          
          const handler = this.handlers.get('agent_capacity_update');
          if (handler) handler(agent);
        }
      )
      .subscribe();

    this.subscriptions.push(channel);
  }

  /**
   * Subscribe to task events
   */
  subscribeToTaskEvents(onEvent?: (event: any) => void): void {
    const channel = this.supabase
      .channel('task_events_channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_events'
        },
        (payload: any) => {
          const event = payload.new;
          this.handleTaskEvent(event);
          
          if (onEvent) onEvent(event);
          
          const handler = this.handlers.get('task_event');
          if (handler) handler(event);
        }
      )
      .subscribe();

    this.subscriptions.push(channel);
  }

  /**
   * Subscribe to tasks table for status updates
   */
  subscribeToTasks(onUpdate?: (task: any) => void): void {
    const channel = this.supabase
      .channel('tasks_channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks'
        },
        (payload: any) => {
          const task = payload.new;
          
          if (onUpdate) onUpdate(task);
          
          const handler = this.handlers.get('task_update');
          if (handler) handler(task);
        }
      )
      .subscribe();

    this.subscriptions.push(channel);
  }

  /**
   * Handle task events
   */
  private handleTaskEvent(event: any): void {
    const { task_id, event_type, delegated_by, assigned_to, cost_usd } = event;

    switch (event_type) {
      case 'CREATED':
        // Task created
        this.handlers.get('task_created')?.(event);
        break;

      case 'ASSIGNED':
        // Task assigned to agent
        this.handlers.get('task_assigned')?.(event);
        break;

      case 'RUNNING':
        // Task started running
        this.handlers.get('task_running')?.(event);
        break;

      case 'COMPLETED':
        // Task completed successfully
        this.scene.removeTaskFlow(task_id);
        this.handlers.get('task_completed')?.(event);
        break;

      case 'FAILED':
        // Task failed
        this.scene.removeTaskFlow(task_id);
        this.handlers.get('task_failed')?.(event);
        break;

      case 'PROGRESS':
        // Task progress update
        const progress = event.progress || 0;
        this.scene.updateTaskFlow(task_id, progress);
        this.handlers.get('task_progress')?.(event);
        break;

      default:
        break;
    }
  }

  /**
   * Register event handler
   */
  on(eventType: string, handler: Function): void {
    this.handlers.set(eventType, handler);
  }

  /**
   * Unregister event handler
   */
  off(eventType: string): void {
    this.handlers.delete(eventType);
  }

  /**
   * Fetch initial agent capacity data
   */
  async fetchAgentCapacity(): Promise<AgentStatus[]> {
    try {
      const { data, error } = await this.supabase
        .from('agent_capacity')
        .select('*');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to fetch agent capacity:', error);
      return [];
    }
  }

  /**
   * Fetch active tasks
   */
  async fetchActiveTasks(): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('tasks')
        .select('*')
        .in('status', ['QUEUED', 'EXECUTING']);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to fetch active tasks:', error);
      return [];
    }
  }

  /**
   * Fetch recent task events
   */
  async fetchRecentTaskEvents(limit: number = 100): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('task_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to fetch task events:', error);
      return [];
    }
  }

  /**
   * Subscribe to cost ticker updates
   */
  subscribeToCosting(onCostUpdate?: (costData: any) => void): void {
    const channel = this.supabase
      .channel('cost_updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'cost_tracking'
        },
        (payload: any) => {
          const costData = payload.new;
          
          if (onCostUpdate) onCostUpdate(costData);
          
          const handler = this.handlers.get('cost_update');
          if (handler) handler(costData);
        }
      )
      .subscribe();

    this.subscriptions.push(channel);
  }

  /**
   * Get subscription status
   */
  getSubscriptionStatus(): {
    isConnected: boolean;
    activeChannels: number;
  } {
    return {
      isConnected: this.subscriptions.length > 0,
      activeChannels: this.subscriptions.length
    };
  }

  /**
   * Unsubscribe from all channels
   */
  unsubscribeAll(): void {
    this.subscriptions.forEach((channel) => {
      this.supabase.removeChannel(channel);
    });
    this.subscriptions = [];
    this.handlers.clear();
  }

  /**
   * Reconnect subscriptions
   */
  reconnect(): void {
    this.unsubscribeAll();
    
    // Re-subscribe to all channels
    this.subscribeToAgentCapacity();
    this.subscribeToTaskEvents();
    this.subscribeToTasks();
    this.subscribeToCosting();
  }
}

/**
 * Helper function to create sync manager
 */
export function createFloorRealtimeSync(
  supabase: SupabaseClient,
  scene: AgentFloorScene
): FloorRealtimeSync {
  return new FloorRealtimeSync(supabase, scene);
}
