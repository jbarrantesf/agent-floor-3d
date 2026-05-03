/**
 * SubagentRouter - ORBIT Phase 4 Implementation
 * Intelligent routing, load balancing, and result aggregation for subagent pool
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { Task, TaskStatus } from '../types/task';
import {
  SubagentSpec,
  AgentStatus,
  RoutingDecision,
  RoutingEvent,
  RoutingStats,
  TaskComplexityScore,
  AggregatedResult,
  RouterConfig,
} from '../types/router';
import {
  SUBAGENT_SPECS,
  ROUTING_SCORE_WEIGHTS,
  TASK_COMPLEXITY_BASELINE,
  COMPLEXITY_ADJUSTMENTS,
  isTaskTypeSupported,
  DEFAULT_ROUTER_CONFIG,
} from '../config/subagents';

export class SubagentRouter {
  private supabase: SupabaseClient;
  private agentName: string;
  private isRunning: boolean = false;
  private config: RouterConfig;
  private stats: RoutingStats = {
    totalTasksRouted: 0,
    successfulRoutes: 0,
    failedRoutes: 0,
    averageRoutingTimeMs: 0,
    averageExecutionTimeMs: 0,
    subagentUtilization: {},
    lastUpdated: new Date().toISOString(),
  };
  private routingEventCallbacks: Array<(event: RoutingEvent) => void> = [];
  private routingDecisions: Map<string, RoutingDecision> = new Map();
  private aggregationResults: Map<string, AggregatedResult> = new Map();
  private startTime: number = 0;

  constructor(supabase: SupabaseClient, agentName: string = 'orbit', config?: RouterConfig) {
    this.supabase = supabase;
    this.agentName = agentName;
    this.config = { ...DEFAULT_ROUTER_CONFIG, ...config };
    this.startTime = Date.now();
    this.initializeUtilization();
  }

  /**
   * Initialize utilization tracking
   */
  private initializeUtilization(): void {
    Object.keys(SUBAGENT_SPECS).forEach((name) => {
      this.stats.subagentUtilization[name] = 0;
    });
  }

  /**
   * Start the router
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('[SubagentRouter] Already running, ignoring start() call');
      return;
    }

    this.isRunning = true;
    console.log('[SubagentRouter] Started on agent:', this.agentName);
  }

  /**
   * Stop the router gracefully
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.warn('[SubagentRouter] Not running, ignoring stop() call');
      return;
    }

    this.isRunning = false;
    this.routingEventCallbacks = [];
    console.log('[SubagentRouter] Stopped');
  }

  /**
   * Route a task to the best subagent
   */
  async routeTask(task: Task): Promise<void> {
    const routeStartTime = Date.now();
    const routingId = uuidv4();

    try {
      // Step 1: Analyze task complexity
      const complexity = this.analyzeTaskComplexity(task);

      // Step 2: Get available subagents
      const availableSubagents = await this.getAvailableSubagents();

      if (availableSubagents.length === 0) {
        throw new Error('No available subagents for task routing');
      }

      // Step 3: Select best subagent
      const selectedSubagent = this.selectBestSubagent(
        availableSubagents,
        task.task_type,
        complexity.totalComplexity
      );

      if (!selectedSubagent) {
        throw new Error('Failed to select subagent for task');
      }

      // Step 4: Create routing decision record
      const decision: RoutingDecision = {
        taskId: task.id,
        selectedSubagent: selectedSubagent.name,
        reason: `Selected ${selectedSubagent.name} based on load (${selectedSubagent.current_load}/${selectedSubagent.max_concurrent_tasks}) and specialization match`,
        complexity: complexity.totalComplexity,
        parallelizable: this.isParallelizable(task),
        timestamp: new Date().toISOString(),
      };

      this.routingDecisions.set(task.id, decision);

      // Step 5: Delegate to subagent
      await this.delegateToSubagent(selectedSubagent.name, task);

      // Step 6: Update stats
      const routingTimeMs = Date.now() - routeStartTime;
      this.updateRoutingStats({
        taskId: task.id,
        status: 'COMPLETED',
        executedBy: selectedSubagent.name,
        executionTimeMs: routingTimeMs,
      });

      // Step 7: Emit routing event
      this.emitRoutingEvent({
        taskId: task.id,
        eventType: 'routed',
        subagentName: selectedSubagent.name,
        data: {
          routingId,
          complexity: complexity.totalComplexity,
          selectedSubagent: selectedSubagent.name,
          routingTimeMs,
          decision,
        },
        timestamp: new Date().toISOString(),
      });

      console.log(`[SubagentRouter] Task ${task.id} routed to ${selectedSubagent.name} (${routingTimeMs}ms)`);
    } catch (error) {
      this.stats.failedRoutes++;

      this.emitRoutingEvent({
        taskId: task.id,
        eventType: 'failed',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
          routingId,
        },
        timestamp: new Date().toISOString(),
      });

      console.error(`[SubagentRouter] Failed to route task ${task.id}:`, error);
      throw error;
    }
  }

  /**
   * Analyze task complexity
   */
  private analyzeTaskComplexity(task: Task): TaskComplexityScore {
    let complexity = 0;

    // Base complexity by type
    const baseComplexity = TASK_COMPLEXITY_BASELINE[task.task_type] || 3;
    complexity += baseComplexity;

    // Payload size adjustment
    let payloadAdjustment = 0;
    const payloadSize = JSON.stringify(task.payload).length;
    if (payloadSize > 50000) {
      payloadAdjustment = COMPLEXITY_ADJUSTMENTS.payloadSize.large_50kb;
    } else if (payloadSize > 10000) {
      payloadAdjustment = COMPLEXITY_ADJUSTMENTS.payloadSize.large_10kb;
    }
    complexity += payloadAdjustment;

    // Timeout adjustment
    let timeoutAdjustment = 0;
    if (task.timeout_seconds < 30 || task.timeout_seconds > 300) {
      timeoutAdjustment = COMPLEXITY_ADJUSTMENTS.timeout.short;
    }
    complexity += timeoutAdjustment;

    // Priority adjustment
    let priorityAdjustment = 0;
    if (task.priority >= 2) {
      priorityAdjustment = COMPLEXITY_ADJUSTMENTS.priority.high;
    }
    complexity += priorityAdjustment;

    const totalComplexity = Math.min(complexity, 10); // Cap at 10

    return {
      baseComplexity,
      payloadAdjustment,
      timeoutAdjustment,
      priorityAdjustment,
      totalComplexity,
      analysis: {
        type: task.task_type,
        payloadSize,
        timeout: task.timeout_seconds,
        priority: task.priority,
      },
    };
  }

  /**
   * Get available subagents from database
   */
  private async getAvailableSubagents(): Promise<AgentStatus[]> {
    try {
      // Query agent_capacity table for subagents
      const subagentNames = Object.keys(SUBAGENT_SPECS);

      const { data, error } = await this.supabase
        .from('agent_capacity')
        .select('*')
        .in('agent_name', subagentNames)
        .eq('is_online', true)
        .order('current_load', { ascending: true });

      if (error) {
        console.error('[SubagentRouter] Error fetching agent capacity:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('[SubagentRouter] Exception getting available subagents:', error);
      return [];
    }
  }

  /**
   * Select best subagent using scoring algorithm
   */
  selectBestSubagent(
    availableSubagents: AgentStatus[],
    taskType: string,
    complexity: number
  ): AgentStatus | undefined {
    if (availableSubagents.length === 0) return undefined;

    // Score each available subagent
    const scoredSubagents = availableSubagents
      .map((agent) => ({
        agent,
        score: this.scoreSubagent(agent, taskType, complexity),
      }))
      .sort((a, b) => b.score - a.score);

    if (scoredSubagents.length === 0) return undefined;

    const best = scoredSubagents[0];
    console.log(
      `[SubagentRouter] Scoring for task type "${taskType}":`,
      scoredSubagents
        .map((s) => `${s.agent.name}=${s.score.toFixed(1)}`)
        .join(', ')
    );

    return best.agent;
  }

  /**
   * Score a subagent for a given task
   */
  private scoreSubagent(agent: AgentStatus, taskType: string, complexity: number): number {
    const spec = SUBAGENT_SPECS[agent.name];
    if (!spec) return 0;

    const weights = this.config.scoreWeights || ROUTING_SCORE_WEIGHTS;

    // Capacity score (0-100): remaining capacity
    const capacityRemaining = agent.max_concurrent_tasks - agent.current_load;
    const capacityScore = (capacityRemaining / agent.max_concurrent_tasks) * 100;

    // Specialization score (0-100): task matches specialization
    const isSpecialist = this.config.enableSpecializationMatching
      ? isTaskTypeSupported(taskType, agent.name)
      : true;
    const specializationScore = isSpecialist ? 100 : 50;

    // Priority score (0-100): subagent priority
    const priorityScore = spec.priority * 50;

    // Complexity score (0-100): prefer handling appropriate complexity
    const complexityScore = complexity < 5 ? 100 : 75;

    // Final weighted score
    const finalScore =
      capacityScore * weights.capacity +
      specializationScore * weights.specialization +
      priorityScore * weights.priority +
      complexityScore * weights.complexity;

    return finalScore;
  }

  /**
   * Delegate task to subagent
   */
  private async delegateToSubagent(subagentName: string, task: Task): Promise<void> {
    try {
      // Update task to assign to subagent
      const { error } = await this.supabase
        .from('tasks')
        .update({
          assigned_to: subagentName,
          status: 'QUEUED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', task.id);

      if (error) {
        throw new Error(`Failed to assign task to subagent: ${error.message}`);
      }

      // Record delegation event
      await this.recordRoutingEvent(task.id, 'delegated', subagentName, {
        delegatedTo: subagentName,
        delegatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`[SubagentRouter] Error delegating to ${subagentName}:`, error);
      throw error;
    }
  }

  /**
   * Record a routing event in the database
   */
  private async recordRoutingEvent(
    taskId: string,
    eventType: string,
    subagentName: string,
    data: Record<string, any>
  ): Promise<void> {
    try {
      await this.supabase.from('task_events').insert({
        task_id: taskId,
        event_type: eventType,
        agent_name: this.agentName,
        event_data: { ...data, subagent: subagentName },
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[SubagentRouter] Error recording routing event:', error);
    }
  }

  /**
   * Aggregate results from multiple subagents
   */
  async aggregateResults(
    taskId: string,
    subtaskResults: any[]
  ): Promise<AggregatedResult> {
    const aggregationStartTime = Date.now();

    const allSuccessful = subtaskResults.every(
      (r) => r.status === 'COMPLETED' || r.success
    );

    const result: AggregatedResult = {
      taskId,
      status: allSuccessful ? 'COMPLETED' : 'FAILED',
      result: {
        subtasks: subtaskResults.map((r) => ({
          subagent: r.executedBy || 'unknown',
          status: r.status || 'COMPLETED',
          result: r.result || r.data,
          executionTimeMs: r.executionTimeMs || 0,
        })),
        totalExecutionTimeMs: subtaskResults.reduce((sum, r) => sum + (r.executionTimeMs || 0), 0),
        averagePerTask:
          subtaskResults.length > 0
            ? Math.round(
                subtaskResults.reduce((sum, r) => sum + (r.executionTimeMs || 0), 0) /
                  subtaskResults.length
              )
            : 0,
        successCount: subtaskResults.filter((r) => r.status === 'COMPLETED' || r.success).length,
        failureCount: subtaskResults.filter((r) => r.status !== 'COMPLETED' && !r.success).length,
      },
      error_message: allSuccessful ? undefined : 'Some subtasks failed',
      executedBy: 'orbit-router',
      executionTimeMs: Date.now() - aggregationStartTime,
      aggregatedAt: new Date().toISOString(),
    };

    // Store aggregation result
    this.aggregationResults.set(taskId, result);

    // Emit aggregation event
    this.emitRoutingEvent({
      taskId,
      eventType: 'aggregated',
      data: {
        subtaskCount: subtaskResults.length,
        successCount: result.result.successCount,
        failureCount: result.result.failureCount,
        totalTimeMs: result.result.totalExecutionTimeMs,
        aggregationTimeMs: result.executionTimeMs,
      },
      timestamp: new Date().toISOString(),
    });

    return result;
  }

  /**
   * Check if a task can be parallelized
   */
  private isParallelizable(task: Task): boolean {
    // Most tasks can be parallelized at the routing level
    // SQL transactions might need special handling
    if (task.task_type === 'sql_execute') {
      const payload = task.payload.params as any;
      return !(payload?.transaction === true);
    }
    return true;
  }

  /**
   * Update routing statistics
   */
  private updateRoutingStats(result: any): void {
    this.stats.totalTasksRouted++;
    this.stats.successfulRoutes++;

    // Update average routing time
    const currentAverage = this.stats.averageRoutingTimeMs || 0;
    this.stats.averageRoutingTimeMs = Math.round(
      (currentAverage * (this.stats.successfulRoutes - 1) + result.executionTimeMs) /
        this.stats.successfulRoutes
    );

    // Update subagent utilization
    if (result.executedBy) {
      try {
        const spec = SUBAGENT_SPECS[result.executedBy];
        if (spec) {
          // Estimate utilization
          this.stats.subagentUtilization[result.executedBy] =
            Math.random() * 100; // This would be updated from DB in production
        }
      } catch (error) {
        console.error('[SubagentRouter] Error updating utilization:', error);
      }
    }

    this.stats.lastUpdated = new Date().toISOString();
  }

  /**
   * Emit routing event to subscribers
   */
  private emitRoutingEvent(event: RoutingEvent): void {
    this.routingEventCallbacks.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error('[SubagentRouter] Error in routing event callback:', error);
      }
    });
  }

  /**
   * Subscribe to routing events
   */
  subscribeToRoutingEvents(callback: (event: RoutingEvent) => void): () => void {
    this.routingEventCallbacks.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.routingEventCallbacks.indexOf(callback);
      if (index > -1) {
        this.routingEventCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get routing statistics
   */
  getRoutingStats(): RoutingStats {
    return { ...this.stats };
  }

  /**
   * Get routing decision for a task
   */
  getRoutingDecision(taskId: string): RoutingDecision | undefined {
    return this.routingDecisions.get(taskId);
  }

  /**
   * Get aggregation result for a task
   */
  getAggregationResult(taskId: string): AggregatedResult | undefined {
    return this.aggregationResults.get(taskId);
  }

  /**
   * Clear old routing decisions and results (for memory management)
   */
  clearOldDecisions(maxAgeMs: number = 86400000): void {
    const now = Date.now();
    const oldDecisions: string[] = [];

    this.routingDecisions.forEach((decision, taskId) => {
      const decisionTime = new Date(decision.timestamp).getTime();
      if (now - decisionTime > maxAgeMs) {
        oldDecisions.push(taskId);
      }
    });

    oldDecisions.forEach((taskId) => {
      this.routingDecisions.delete(taskId);
      this.aggregationResults.delete(taskId);
    });

    console.log(`[SubagentRouter] Cleared ${oldDecisions.length} old routing records`);
  }

  /**
   * Get router status
   */
  getStatus(): {
    isRunning: boolean;
    uptime: number;
    agentName: string;
    stats: RoutingStats;
  } {
    return {
      isRunning: this.isRunning,
      uptime: Date.now() - this.startTime,
      agentName: this.agentName,
      stats: this.getRoutingStats(),
    };
  }
}
