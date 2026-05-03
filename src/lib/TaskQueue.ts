/**
 * TaskQueue - ORBIT Phase 2 Implementation
 * Polls for tasks, executes them, and reports progress to Hermes via Supabase
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  Task,
  TaskStatus,
  TaskExecutionResult,
  TaskQueueConfig,
  TaskQueueStats,
  TaskType,
  TaskPayload,
} from '../types/task';
import { FileExecutor } from './executors/FileExecutor';
import { SqlExecutor } from './executors/SqlExecutor';
import { ShellExecutor } from './executors/ShellExecutor';
import { WebhookExecutor } from './executors/WebhookExecutor';

export class TaskQueue {
  private supabase: SupabaseClient;
  private agentName: string;
  private isRunning: boolean = false;
  private pollIntervalMs: number = 2000;
  private maxConcurrentTasks: number = 5;
  private pollIntervalId?: NodeJS.Timeout;
  private currentTaskCount: number = 0;
  private executors: Map<string, (task: Task) => Promise<TaskExecutionResult>> = new Map();
  private stats: TaskQueueStats = {
    totalProcessed: 0,
    totalFailed: 0,
    totalSucceeded: 0,
    currentLoad: 0,
    averageExecutionTimeMs: 0,
    uptime: 0,
  };
  private startTime: number = 0;
  private subscriptionUnsubscribe?: () => void;
  private updateCallbacks: Array<(task: Task) => void> = [];

  constructor(supabase: SupabaseClient, agentName: string = 'orbit', config?: TaskQueueConfig) {
    this.supabase = supabase;
    this.agentName = agentName;
    
    if (config) {
      if (config.pollIntervalMs) this.pollIntervalMs = config.pollIntervalMs;
      if (config.maxConcurrentTasks) this.maxConcurrentTasks = config.maxConcurrentTasks;
      if (config.agentName) this.agentName = config.agentName;
    }

    this.initializeExecutors();
  }

  /**
   * Initialize task executors
   */
  private initializeExecutors(): void {
    const fileExecutor = new FileExecutor();
    const sqlExecutor = new SqlExecutor(this.supabase);
    const shellExecutor = new ShellExecutor();
    const webhookExecutor = new WebhookExecutor();

    this.executors.set('file_write', (task) => fileExecutor.execute(task));
    this.executors.set('file_read', (task) => fileExecutor.execute(task));
    this.executors.set('sql_execute', (task) => sqlExecutor.execute(task));
    this.executors.set('shell', (task) => shellExecutor.execute(task));
    this.executors.set('webhook', (task) => webhookExecutor.execute(task));
  }

  /**
   * Start the TaskQueue polling
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('[TaskQueue] Already running, ignoring start() call');
      return;
    }

    this.isRunning = true;
    this.startTime = Date.now();
    console.log(`[TaskQueue] Starting for agent: ${this.agentName}`);

    // Initialize capacity if not exists
    await this.initializeAgentCapacity();

    // Start polling
    this.pollIntervalId = setInterval(() => {
      this.pollForTasks().catch((err) => {
        console.error('[TaskQueue] Error in polling:', err);
      });
    }, this.pollIntervalMs);

    // Subscribe to realtime updates
    if (true) {
      this.subscribeToUpdates((task) => {
        console.log(`[TaskQueue] Realtime notification for task: ${task.id}`);
      });
    }

    console.log(`[TaskQueue] Started with poll interval ${this.pollIntervalMs}ms`);
  }

  /**
   * Stop the TaskQueue gracefully
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.warn('[TaskQueue] Not running, ignoring stop() call');
      return;
    }

    this.isRunning = false;
    
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
    }

    if (this.subscriptionUnsubscribe) {
      this.subscriptionUnsubscribe();
    }

    // Wait for current tasks to complete
    let waitTime = 0;
    while (this.currentTaskCount > 0 && waitTime < 30000) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      waitTime += 100;
    }

    console.log(`[TaskQueue] Stopped for agent: ${this.agentName}`);
  }

  /**
   * Initialize agent capacity in database
   */
  private async initializeAgentCapacity(): Promise<void> {
    try {
      const { data: existing } = await this.supabase
        .from('agent_capacity')
        .select('*')
        .eq('agent_name', this.agentName)
        .single();

      if (!existing) {
        await this.supabase.from('agent_capacity').insert({
          agent_name: this.agentName,
          max_concurrent_tasks: this.maxConcurrentTasks,
          current_load: 0,
          is_online: true,
        });
      }
    } catch (err) {
      console.error('[TaskQueue] Error initializing capacity:', err);
    }
  }

  /**
   * Poll for new tasks assigned to this agent
   */
  private async pollForTasks(): Promise<void> {
    if (!this.isRunning || this.currentTaskCount >= this.maxConcurrentTasks) {
      return;
    }

    try {
      // Query for pending tasks
      const { data: tasks, error } = await this.supabase.rpc('get_pending_tasks_for_agent', {
        p_agent_name: this.agentName,
        p_limit: this.maxConcurrentTasks - this.currentTaskCount,
      });

      if (error) {
        console.error('[TaskQueue] Error fetching tasks:', error);
        return;
      }

      if (!tasks || tasks.length === 0) {
        return;
      }

      // Process each task
      for (const taskRow of tasks) {
        if (this.currentTaskCount >= this.maxConcurrentTasks) {
          break;
        }

        // Get full task details
        const { data: fullTask, error: taskError } = await this.supabase
          .from('tasks')
          .select('*')
          .eq('id', taskRow.task_id)
          .single();

        if (taskError || !fullTask) {
          console.error('[TaskQueue] Error fetching task details:', taskError);
          continue;
        }

        // Execute task asynchronously
        this.executeTask(fullTask).catch((err) => {
          console.error(`[TaskQueue] Error executing task ${fullTask.id}:`, err);
        });
      }
    } catch (err) {
      console.error('[TaskQueue] Polling error:', err);
    }
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: Task): Promise<void> {
    this.currentTaskCount++;
    this.stats.currentLoad = this.currentTaskCount;

    const executionStartTime = Date.now();
    let result: TaskExecutionResult | null = null;

    try {
      // Mark as executing
      await this.reportProgress(task.id, 'EXECUTING');

      // Update capacity
      await this.updateCapacity(1);

      // Get executor for task type
      const executor = this.executors.get(task.task_type);
      if (!executor) {
        throw new Error(`No executor found for task type: ${task.task_type}`);
      }

      // Set up timeout
      const timeout = task.timeout_seconds * 1000;
      const timeoutPromise = new Promise<TaskExecutionResult>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Task timeout after ${task.timeout_seconds} seconds`));
        }, timeout);
      });

      // Execute with timeout
      try {
        result = await Promise.race([executor(task), timeoutPromise]);
      } catch (timeoutErr: any) {
        if (timeoutErr.message.includes('timeout')) {
          await this.reportProgress(task.id, 'TIMEOUT', {
            error: timeoutErr.message,
            executionTimeMs: Date.now() - executionStartTime,
          });
          this.stats.totalFailed++;
          return;
        }
        throw timeoutErr;
      }

      if (result.success) {
        await this.reportProgress(task.id, 'COMPLETED', {
          result: result.data,
          executionTimeMs: Date.now() - executionStartTime,
        });
        this.stats.totalSucceeded++;
      } else {
        throw new Error(result.error || 'Task execution failed');
      }
    } catch (error: any) {
      await this.handleTaskError(task.id, error);
      this.stats.totalFailed++;
    } finally {
      // Update capacity
      await this.updateCapacity(-1);
      
      this.currentTaskCount--;
      this.stats.currentLoad = this.currentTaskCount;
      this.stats.totalProcessed++;

      // Update average execution time
      if (result?.executionTimeMs) {
        const totalTime = this.stats.averageExecutionTimeMs * (this.stats.totalProcessed - 1);
        this.stats.averageExecutionTimeMs = (totalTime + result.executionTimeMs) / this.stats.totalProcessed;
      }
    }
  }

  /**
   * Report task progress
   */
  private async reportProgress(
    taskId: string,
    status: TaskStatus,
    data?: Record<string, any>
  ): Promise<void> {
    try {
      // Determine if there's a result
      let result = null;
      let errorMessage = null;

      if (status === 'COMPLETED' && data?.result) {
        result = data.result;
      }

      if (status === 'FAILED' && data?.error) {
        errorMessage = data.error;
      }

      if (status === 'TIMEOUT' && data?.error) {
        errorMessage = data.error;
      }

      // Call update_task_status function
      const { error } = await this.supabase.rpc('update_task_status', {
        p_task_id: taskId,
        p_new_status: status,
        p_agent_name: this.agentName,
        p_result: result ? { ...data, executionTimeMs: data.executionTimeMs } : null,
        p_error_message: errorMessage,
      });

      if (error) {
        console.error('[TaskQueue] Error reporting progress:', error);
      } else {
        console.log(`[TaskQueue] Task ${taskId} status updated to ${status}`);
      }
    } catch (err) {
      console.error('[TaskQueue] Error in reportProgress:', err);
    }
  }

  /**
   * Handle task error
   */
  private async handleTaskError(taskId: string, error: Error): Promise<void> {
    console.error(`[TaskQueue] Task ${taskId} failed:`, error.message);

    try {
      // Check retry count
      const { data: task } = await this.supabase
        .from('tasks')
        .select('retry_count, max_retries')
        .eq('id', taskId)
        .single();

      if (task && task.retry_count < task.max_retries) {
        // Increment retry count
        await this.supabase
          .from('tasks')
          .update({
            retry_count: task.retry_count + 1,
            status: 'QUEUED',
          })
          .eq('id', taskId);

        console.log(`[TaskQueue] Task ${taskId} queued for retry (${task.retry_count + 1}/${task.max_retries})`);
      } else {
        // Mark as failed
        await this.reportProgress(taskId, 'FAILED', {
          error: error.message,
        });
      }
    } catch (err) {
      console.error('[TaskQueue] Error in error handling:', err);
    }
  }

  /**
   * Update agent capacity
   */
  private async updateCapacity(delta: number): Promise<void> {
    try {
      const { error } = await this.supabase.rpc('update_agent_load', {
        p_agent_name: this.agentName,
        p_delta: delta,
      });

      if (error) {
        console.error('[TaskQueue] Error updating capacity:', error);
      }
    } catch (err) {
      console.error('[TaskQueue] Error in updateCapacity:', err);
    }
  }

  /**
   * Subscribe to task updates (realtime)
   */
  subscribeToUpdates(callback: (task: Task) => void): () => void {
    this.updateCallbacks.push(callback);

    try {
      const subscription = this.supabase
        .from(`tasks:assigned_to=eq.${this.agentName}`)
        .on('*', (payload: any) => {
          if (payload.new && payload.new.status === 'QUEUED') {
            callback(payload.new as Task);
          }
        })
        .subscribe();

      this.subscriptionUnsubscribe = () => {
        subscription.unsubscribe();
      };

      return () => {
        subscription.unsubscribe();
      };
    } catch (err) {
      console.error('[TaskQueue] Error subscribing to updates:', err);
      return () => {};
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): TaskQueueStats {
    return {
      ...this.stats,
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Register a custom executor
   */
  registerExecutor(
    taskType: string,
    executor: (task: Task) => Promise<TaskExecutionResult>
  ): void {
    this.executors.set(taskType, executor);
    console.log(`[TaskQueue] Registered executor for task type: ${taskType}`);
  }
}

export default TaskQueue;
