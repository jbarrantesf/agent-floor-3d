/**
 * Cost Tracking Types and Interfaces
 * Phase 5: Cost Tracking & Analytics Dashboard
 */

export type TaskType = 'file_ops' | 'shell' | 'sql' | 'http' | 'webhook' | string;

/**
 * Cost tier configuration for different task types
 */
export interface CostTier {
  base: number; // Cost per second
  overhead: number; // Fixed overhead cost
}

/**
 * Cost tiers by task type
 */
export interface CostTiers {
  file_ops: CostTier;
  shell: CostTier;
  sql: CostTier;
  http: CostTier;
  webhook: CostTier;
  [key: string]: CostTier;
}

/**
 * Task interface for cost calculation
 */
export interface Task {
  id: string;
  task_type: TaskType;
  delegated_by?: string;
  assigned_to?: string;
  status?: string;
  created_at?: string;
  completed_at?: string;
  [key: string]: any;
}

/**
 * Task event for tracking task completion and cost
 */
export interface TaskEvent {
  id?: string;
  task_id: string;
  task?: Task;
  event_type: string;
  agent_name?: string;
  executor_name?: string;
  execution_time_ms: number;
  event_data?: Record<string, any>;
  created_at?: string;
  [key: string]: any;
}

/**
 * Efficiency metrics for analytics
 */
export interface EfficiencyMetrics {
  totalTasks: number;
  successCount: number;
  successRate: number;
  totalCost: number;
  costPerTask: number;
  costPerSuccess: number;
  totalExecutionTime?: number;
  averageExecutionTime?: number;
}

/**
 * Daily cost summary
 */
export interface DailyCostSummary {
  date: string;
  task_type: TaskType;
  executor_name: string;
  total_tasks: number;
  success_count: number;
  total_cost_usd: number;
  avg_execution_time_ms: number;
}

/**
 * Daily cost trend for charting
 */
export interface DailyCostTrend {
  date: string;
  totalCost: number;
  totalTasks: number;
  successRate?: number;
  costPerTask?: number;
}

/**
 * Agent cost breakdown
 */
export interface AgentCostBreakdown {
  agent: string;
  totalCost: number;
  taskCount: number;
  successCount: number;
  costPerTask: number;
}

/**
 * Cost optimization recommendation
 */
export interface Recommendation {
  type: 'workload_rebalance' | 'reduce_failures' | 'batch_tasks' | 'optimize_execution';
  severity: 'high' | 'medium' | 'low';
  description: string;
  potentialSavings: number;
  action?: () => void | Promise<void>;
}

/**
 * Agent statistics for recommendations
 */
export interface AgentStats {
  name: string;
  totalCost: number;
  taskCount: number;
  successRate: number;
  averageExecutionTime: number;
  costPerTask: number;
}

/**
 * Cost export data
 */
export interface CostExportData {
  exportDate: string;
  period: 'daily' | 'weekly' | 'monthly';
  data: DailyCostSummary[];
  summary: {
    totalCost: number;
    totalTasks: number;
    averageCostPerTask: number;
    successRate: number;
  };
}
