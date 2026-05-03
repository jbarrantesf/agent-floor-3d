/**
 * Real-time Cost Tracker
 * Phase 5B: Real-time cost tracking from Supabase
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  Task,
  TaskEvent,
  EfficiencyMetrics,
  DailyCostTrend,
  AgentCostBreakdown,
  DailyCostSummary,
} from '../types/cost';
import { CostCalculator, costCalculator } from './cost-calculator';

export interface CostTrackerConfig {
  supabase: SupabaseClient;
  calculator?: CostCalculator;
  pollIntervalMs?: number;
}

export class CostTracker {
  private supabase: SupabaseClient;
  private calculator: CostCalculator;
  private dailyCosts = new Map<string, number>();
  private agentCosts = new Map<string, number>();
  private subscribers: ((event: CostUpdateEvent) => void)[] = [];
  private pollIntervalMs: number = 60000; // 1 minute
  private pollInterval?: NodeJS.Timeout;

  constructor(config: CostTrackerConfig) {
    this.supabase = config.supabase;
    this.calculator = config.calculator || costCalculator;
    if (config.pollIntervalMs) {
      this.pollIntervalMs = config.pollIntervalMs;
    }
  }

  /**
   * Subscribe to cost updates
   */
  subscribe(callback: (event: CostUpdateEvent) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter((cb) => cb !== callback);
    };
  }

  /**
   * Publish cost update to all subscribers
   */
  private publishCostUpdate(event: CostUpdateEvent): void {
    this.subscribers.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in cost update subscriber:', error);
      }
    });
  }

  /**
   * Start listening to task completions via Supabase real-time
   */
  subscribeToTaskCosts(): void {
    const channel = this.supabase
      .channel('task_costs')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'task_events',
          filter: 'event_type=eq.completed',
        },
        async (payload) => {
          try {
            const event = payload.new as TaskEvent;
            const cost = await this.recordTaskCost(event);
            this.publishCostUpdate({
              type: 'task_completed',
              taskId: event.task_id,
              cost,
              timestamp: new Date(),
            });
          } catch (error) {
            console.error('Error processing task completion event:', error);
          }
        }
      )
      .subscribe();

    console.log('✅ Cost tracker subscribed to task completions');
  }

  /**
   * Record task cost in database and memory
   */
  async recordTaskCost(event: TaskEvent): Promise<number> {
    const cost = this.calculator.calculateTaskCost(event, event.execution_time_ms);
    const today = new Date().toISOString().split('T')[0];
    const executorName = event.executor_name || event.agent_name || 'unknown';

    try {
      // Upsert into cost_daily_summary table
      const { error } = await this.supabase
        .from('cost_daily_summary')
        .upsert(
          {
            date: today,
            task_type: this.getTaskType(event),
            executor_name: executorName,
            total_tasks: 1,
            success_count: event.event_type === 'completed' ? 1 : 0,
            total_cost_usd: cost,
            avg_execution_time_ms: event.execution_time_ms,
          },
          { onConflict: 'date,task_type,executor_name' }
        );

      if (error) {
        console.error('Cost tracking error:', error);
        return cost; // Still return cost even if DB update fails
      }

      // Update in-memory daily total
      const currentDaily = this.dailyCosts.get(today) || 0;
      this.dailyCosts.set(today, currentDaily + cost);

      // Update agent cost
      const currentAgent = this.agentCosts.get(executorName) || 0;
      this.agentCosts.set(executorName, currentAgent + cost);

      return cost;
    } catch (error) {
      console.error('Error recording task cost:', error);
      return cost;
    }
  }

  /**
   * Get daily cost for a specific date
   */
  getDailyCost(date?: string): number {
    const targetDate = date || new Date().toISOString().split('T')[0];
    return this.dailyCosts.get(targetDate) || 0;
  }

  /**
   * Get cost breakdown by agent for a date
   */
  async getCostByAgent(date: string): Promise<AgentCostBreakdown[]> {
    try {
      const { data, error } = await this.supabase
        .from('cost_daily_summary')
        .select('executor_name, total_cost_usd, total_tasks, success_count')
        .eq('date', date);

      if (error) {
        console.error('Error fetching agent costs:', error);
        return [];
      }

      const breakdown = new Map<string, AgentCostBreakdown>();

      data?.forEach((row) => {
        const agent = row.executor_name;
        const existing = breakdown.get(agent) || {
          agent,
          totalCost: 0,
          taskCount: 0,
          successCount: 0,
          costPerTask: 0,
        };

        existing.totalCost += row.total_cost_usd;
        existing.taskCount += row.total_tasks;
        existing.successCount += row.success_count;
        existing.costPerTask =
          existing.taskCount > 0
            ? existing.totalCost / existing.taskCount
            : 0;

        breakdown.set(agent, existing);
      });

      return Array.from(breakdown.values());
    } catch (error) {
      console.error('Error getting cost by agent:', error);
      return [];
    }
  }

  /**
   * Get efficiency metrics for a date
   */
  async getEfficiencyMetrics(date: string): Promise<EfficiencyMetrics> {
    try {
      const { data, error } = await this.supabase
        .from('cost_daily_summary')
        .select('total_tasks, success_count, total_cost_usd, avg_execution_time_ms')
        .eq('date', date);

      if (error) {
        console.error('Error fetching efficiency metrics:', error);
        return this.getEmptyMetrics();
      }

      const totalTasks = data?.reduce((sum, row) => sum + row.total_tasks, 0) || 0;
      const successCount = data?.reduce((sum, row) => sum + row.success_count, 0) || 0;
      const totalCost = data?.reduce((sum, row) => sum + row.total_cost_usd, 0) || 0;
      const totalExecutionTime =
        data?.reduce((sum, row) => sum + row.avg_execution_time_ms * row.total_tasks, 0) || 0;

      return {
        totalTasks,
        successCount,
        successRate: totalTasks > 0 ? successCount / totalTasks : 0,
        totalCost,
        costPerTask: totalTasks > 0 ? totalCost / totalTasks : 0,
        costPerSuccess: successCount > 0 ? totalCost / successCount : 0,
        totalExecutionTime,
        averageExecutionTime: totalTasks > 0 ? totalExecutionTime / totalTasks : 0,
      };
    } catch (error) {
      console.error('Error getting efficiency metrics:', error);
      return this.getEmptyMetrics();
    }
  }

  /**
   * Get cost trends for the last N days
   */
  async getCostTrends(days: number = 7): Promise<DailyCostTrend[]> {
    try {
      const trends: DailyCostTrend[] = [];
      const today = new Date();

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const metrics = await this.getEfficiencyMetrics(dateStr);
        trends.push({
          date: dateStr,
          totalCost: metrics.totalCost,
          totalTasks: metrics.totalTasks,
          successRate: metrics.successRate,
          costPerTask: metrics.costPerTask,
        });
      }

      return trends;
    } catch (error) {
      console.error('Error getting cost trends:', error);
      return [];
    }
  }

  /**
   * Get all cost data for export
   */
  async getAllCostData(
    startDate: string,
    endDate: string
  ): Promise<DailyCostSummary[]> {
    try {
      const { data, error } = await this.supabase
        .from('cost_daily_summary')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching cost data:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error getting all cost data:', error);
      return [];
    }
  }

  /**
   * Clear cached cost data
   */
  clearCache(): void {
    this.dailyCosts.clear();
    this.agentCosts.clear();
  }

  /**
   * Stop polling for cost updates
   */
  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = undefined;
    }
  }

  /**
   * Get task type from event
   */
  private getTaskType(event: TaskEvent): string {
    if ('task_type' in event && event.task_type) {
      return event.task_type;
    } else if ('task' in event && event.task && 'task_type' in event.task) {
      return event.task.task_type;
    }
    return 'shell'; // default
  }

  /**
   * Helper to get empty metrics
   */
  private getEmptyMetrics(): EfficiencyMetrics {
    return {
      totalTasks: 0,
      successCount: 0,
      successRate: 0,
      totalCost: 0,
      costPerTask: 0,
      costPerSuccess: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
    };
  }
}

/**
 * Cost update event
 */
export interface CostUpdateEvent {
  type: 'task_completed' | 'metrics_updated' | 'trend_updated';
  taskId?: string;
  cost?: number;
  timestamp: Date;
  [key: string]: any;
}
