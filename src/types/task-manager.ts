/**
 * TaskManager TypeScript Types
 */

import { Task, TaskStatus, TaskEvent } from './task';

export type { Task, TaskStatus, TaskEvent };

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
