/**
 * TaskManager - HERMES Phase 3 Implementation
 * Delegates work to ORBIT and monitors progress via Supabase
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import {
  Task,
  TaskStatus,
  TaskEvent,
} from '../types/task';

export interface TaskDelegationOptions {
  priority?: 0 | 1 | 2 | 3;
  timeout_seconds?: number;
  max_retries?: number;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface AgentStatus {
  name: string;
  is_online: boolean;
  current_load: number;
  max_concurrent_tasks: number;
  last_heartbeat: string;
  status_percentage: number;
}

export interface TaskHistoryFilter {
  status?: TaskStatus;
  task_type?: string;
  agentName?: string;
  limit?: number;
  offset?: number;
}

export interface TaskExecutionResult {
  taskId: string;
  status: TaskStatus;
  result?: Record<string, any>;
  error_message?: string;
  executedBy: string;
  executionTimeMs: number;
}

export interface TaskDelegationRequest {
  targetAgent: string;
  taskType: string;
  payload: object;
  options?: TaskDelegationOptions;
}

export interface TaskManagerStats {
  totalDelegated: number;
  totalCompleted: number;
  totalFailed: number;
  averageDelegationTimeMs: number;
  averageExecutionTimeMs: number;
  uptime: number;
}

export class TaskManager {
  private supabase: SupabaseClient;
  private agentName: string;
  private stats: TaskManagerStats = {
    totalDelegated: 0,
    totalCompleted: 0,
    totalFailed: 0,
    averageDelegationTimeMs: 0,
    averageExecutionTimeMs: 0,
    uptime: 0,
  };
  private startTime: number = 0;
  private subscriptionUnsubscribe?: () => void;
  private updateCallbacks: Array<(agent: AgentStatus) => void> = [];
  private taskCompletionResolvers: Map<string, (result: TaskExecutionResult) => void> = new Map();

  constructor(supabase: SupabaseClient, agentName: string = 'hermes') {
    this.supabase = supabase;
    this.agentName = agentName;
    this.startTime = Date.now();
  }

  /**
   * Delegate a task to a target agent
   */
  async delegateTask(
    targetAgent: string,
    taskType: string,
    payload: object,
    options?: TaskDelegationOptions
  ): Promise<Task> {
    const taskId = uuidv4();
    const delegationStartTime = Date.now();

    const defaultOptions = {
      priority: 1,
      timeout_seconds: 300,
      max_retries: 3,
      ...options,
    };

    try {
      // Validate target agent exists
      const agentStatus = await this.getAgentStatus(targetAgent);
      if (!agentStatus) {
        throw new Error(`Agent '${targetAgent}' not found`);
      }

      // Check if agent has capacity
      if (agentStatus.current_load >= agentStatus.max_concurrent_tasks) {
        console.warn(
          `⚠️  Agent ${targetAgent} is at full capacity (${agentStatus.current_load}/${agentStatus.max_concurrent_tasks})`
        );
      }

      // Create task in database
      const { data, error } = await this.supabase
        .from('tasks')
        .insert({
          id: taskId,
          delegated_by: this.agentName,
          assigned_to: targetAgent,
          task_type: taskType,
          status: 'QUEUED',
          payload,
          priority: defaultOptions.priority,
          timeout_seconds: defaultOptions.timeout_seconds,
          max_retries: defaultOptions.max_retries,
          retry_count: 0,
          result: null,
          error_message: null,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to delegate task: ${error.message}`);
      }

      const delegationTimeMs = Date.now() - delegationStartTime;
      this.stats.totalDelegated++;
      this.stats.averageDelegationTimeMs =
        (this.stats.averageDelegationTimeMs * (this.stats.totalDelegated - 1) + delegationTimeMs) /
        this.stats.totalDelegated;

      console.log(`✅ Task delegated: ${taskId} to ${targetAgent} (${taskType})`);

      // Create initial event
      await this.supabase.from('task_events').insert({
        task_id: taskId,
        agent_name: this.agentName,
        event_type: 'delegated',
        event_data: {
          target_agent: targetAgent,
          priority: defaultOptions.priority,
        },
        created_at: new Date().toISOString(),
      });

      return data as Task;
    } catch (error) {
      console.error(`❌ Failed to delegate task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Subscribe to task updates via realtime
   */
  subscribeToTaskUpdates(
    taskId: string,
    callback: (event: TaskEvent) => void
  ): () => void {
    const subscription = this.supabase
      .from(`task_events:task_id=eq.${taskId}`)
      .on('*', (payload: any) => {
        callback(payload.new as TaskEvent);
      })
      .subscribe();

    // Return unsubscribe function
    return () => {
      this.supabase.removeSubscription(subscription);
    };
  }

  /**
   * Wait for task completion (promise-based)
   */
  async subscribeToTaskCompletion(taskId: string): Promise<TaskExecutionResult> {
    return new Promise((resolve) => {
      const unsubscribe = this.subscribeToTaskUpdates(taskId, async (event) => {
        if (event.event_type === 'completed' || event.event_type === 'failed') {
          unsubscribe();

          // Fetch final task state
          const { data: task } = await this.supabase
            .from('tasks')
            .select('*')
            .eq('id', taskId)
            .single();

          const result: TaskExecutionResult = {
            taskId,
            status: task.status,
            result: task.result,
            error_message: task.error_message,
            executedBy: task.assigned_to,
            executionTimeMs: task.completed_at
              ? new Date(task.completed_at).getTime() - new Date(task.started_at).getTime()
              : 0,
          };

          if (task.status === 'COMPLETED') {
            this.stats.totalCompleted++;
          } else if (task.status === 'FAILED') {
            this.stats.totalFailed++;
          }

          resolve(result);
        }
      });

      // Also poll periodically for safety
      const pollInterval = setInterval(async () => {
        const { data: task } = await this.supabase
          .from('tasks')
          .select('*')
          .eq('id', taskId)
          .single();

        if (task && (task.status === 'COMPLETED' || task.status === 'FAILED')) {
          clearInterval(pollInterval);
          unsubscribe();

          const result: TaskExecutionResult = {
            taskId,
            status: task.status,
            result: task.result,
            error_message: task.error_message,
            executedBy: task.assigned_to,
            executionTimeMs: task.completed_at
              ? new Date(task.completed_at).getTime() - new Date(task.started_at).getTime()
              : 0,
          };

          if (task.status === 'COMPLETED') {
            this.stats.totalCompleted++;
          } else if (task.status === 'FAILED') {
            this.stats.totalFailed++;
          }

          resolve(result);
        }
      }, 1000);

      // Timeout after 10 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        unsubscribe();
        resolve({
          taskId,
          status: 'TIMEOUT',
          error_message: 'Task execution timeout',
          executedBy: 'unknown',
          executionTimeMs: 600000,
        });
      }, 600000);
    });
  }

  /**
   * Get status of a specific agent
   */
  async getAgentStatus(agentName: string): Promise<AgentStatus | null> {
    try {
      const { data, error } = await this.supabase
        .from('agent_capacity')
        .select('*')
        .eq('agent_name', agentName)
        .single();

      if (error || !data) {
        console.warn(`⚠️  Agent ${agentName} not found`);
        return null;
      }

      const statusPercentage = (data.current_load / data.max_concurrent_tasks) * 100;

      return {
        name: agentName,
        is_online: data.is_online,
        current_load: data.current_load,
        max_concurrent_tasks: data.max_concurrent_tasks,
        last_heartbeat: data.last_heartbeat,
        status_percentage: Math.round(statusPercentage),
      };
    } catch (error) {
      console.error(`❌ Failed to get agent status:`, error);
      return null;
    }
  }

  /**
   * Get status of all agents
   */
  async getAllAgentStatus(): Promise<AgentStatus[]> {
    try {
      const { data, error } = await this.supabase
        .from('agent_capacity')
        .select('*');

      if (error || !data) {
        console.error(`❌ Failed to get agent statuses:`, error);
        return [];
      }

      return data.map((agent: any) => ({
        name: agent.agent_name,
        is_online: agent.is_online,
        current_load: agent.current_load,
        max_concurrent_tasks: agent.max_concurrent_tasks,
        last_heartbeat: agent.last_heartbeat,
        status_percentage: Math.round((agent.current_load / agent.max_concurrent_tasks) * 100),
      }));
    } catch (error) {
      console.error(`❌ Failed to get all agent statuses:`, error);
      return [];
    }
  }

  /**
   * Get task history with optional filtering
   */
  async getTaskHistory(filter?: TaskHistoryFilter): Promise<Task[]> {
    try {
      let query = this.supabase.from('tasks').select('*');

      if (filter?.status) {
        query = query.eq('status', filter.status);
      }
      if (filter?.task_type) {
        query = query.eq('task_type', filter.task_type);
      }
      if (filter?.agentName) {
        query = query.eq('assigned_to', filter.agentName);
      }

      query = query.eq('delegated_by', this.agentName);
      query = query.order('created_at', { ascending: false });

      if (filter?.limit) {
        query = query.limit(filter.limit);
      }
      if (filter?.offset) {
        query = query.range(filter.offset, (filter.offset || 0) + (filter?.limit || 50) - 1);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch task history: ${error.message}`);
      }

      return (data || []) as Task[];
    } catch (error) {
      console.error(`❌ Failed to get task history:`, error);
      return [];
    }
  }

  /**
   * Delegate multiple tasks in batch
   */
  async delegateMultipleTasks(requests: TaskDelegationRequest[]): Promise<Task[]> {
    const results: Task[] = [];

    for (const request of requests) {
      try {
        const task = await this.delegateTask(
          request.targetAgent,
          request.taskType,
          request.payload,
          request.options
        );
        results.push(task);
      } catch (error) {
        console.error(`Failed to delegate task:`, error);
      }
    }

    console.log(`✅ Delegated ${results.length}/${requests.length} tasks`);
    return results;
  }

  /**
   * Subscribe to agent status updates via realtime
   */
  subscribeToAgentUpdates(callback: (agent: AgentStatus) => void): () => void {
    const subscription = this.supabase
      .from('agent_capacity')
      .on('*', async (payload: any) => {
        const agent = payload.new;
        const status = await this.getAgentStatus(agent.agent_name);
        if (status) {
          callback(status);
        }
      })
      .subscribe();

    // Return unsubscribe function
    return () => {
      this.supabase.removeSubscription(subscription);
    };
  }

  /**
   * Get current statistics
   */
  getStats(): TaskManagerStats {
    return {
      ...this.stats,
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Pretty print agent status
   */
  async printAgentStatus(): Promise<void> {
    const agents = await this.getAllAgentStatus();
    console.log('\n📊 AGENT STATUS:');
    agents.forEach((agent) => {
      const statusIcon = agent.is_online ? '🟢' : '🔴';
      const loadBar = this.createLoadBar(agent.status_percentage);
      console.log(
        `${statusIcon} ${agent.name.padEnd(12)} [${loadBar}] ${agent.status_percentage}% (${agent.current_load}/${agent.max_concurrent_tasks})`
      );
    });
    console.log();
  }

  /**
   * Helper: Create ASCII load bar
   */
  private createLoadBar(percentage: number, width: number = 20): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }

  /**
   * Print statistics
   */
  printStats(): void {
    const stats = this.getStats();
    console.log('\n📈 TASKMANAGER STATS:');
    console.log(`Total delegated:          ${stats.totalDelegated}`);
    console.log(`Total completed:          ${stats.totalCompleted}`);
    console.log(`Total failed:             ${stats.totalFailed}`);
    console.log(`Success rate:             ${((stats.totalCompleted / stats.totalDelegated) * 100).toFixed(1)}%`);
    console.log(`Avg delegation time:      ${stats.averageDelegationTimeMs.toFixed(0)}ms`);
    console.log(`Avg execution time:       ${stats.averageExecutionTimeMs.toFixed(0)}ms`);
    console.log(`Uptime:                   ${(stats.uptime / 1000).toFixed(0)}s`);
    console.log();
  }
}
