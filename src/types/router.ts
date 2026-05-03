/**
 * Router Types and Interfaces for ORBIT SubagentRouter System
 * Phase 4: Subagent Distribution & Load Balancing
 */

import { Task, TaskStatus, TaskExecutionResult } from './task';

/**
 * Subagent Specification
 * Defines capabilities and capacity for each subagent
 */
export interface SubagentSpec {
  name: string;
  specialization: string[];  // ['file_ops', 'sql', 'shell', 'http']
  max_concurrent_tasks: number;
  priority: number;          // Higher = preferred for tiebreaker
  description?: string;
}

/**
 * Agent Status - from agent_capacity table
 */
export interface AgentStatus {
  name: string;
  is_online: boolean;
  current_load: number;
  max_concurrent_tasks: number;
  last_heartbeat: string;
  status_percentage: number;
}

/**
 * Routing Decision
 * Records what routing decision was made for a task
 */
export interface RoutingDecision {
  taskId: string;
  selectedSubagent: string;
  reason: string;
  complexity: number;
  parallelizable: boolean;
  scoreCalculation?: {
    capacityScore: number;
    specializationScore: number;
    priorityScore: number;
    complexityScore: number;
    finalScore: number;
  };
  timestamp: string;
}

/**
 * Routing Event
 * Real-time events for routing operations
 */
export interface RoutingEvent {
  taskId: string;
  eventType: 'routed' | 'aggregated' | 'failed' | 'delegated' | 'completed';
  subagentName?: string;
  data: Record<string, any>;
  timestamp: string;
}

/**
 * Routing Statistics
 * Aggregated metrics about routing effectiveness
 */
export interface RoutingStats {
  totalTasksRouted: number;
  successfulRoutes: number;
  failedRoutes: number;
  averageRoutingTimeMs: number;
  averageExecutionTimeMs: number;
  subagentUtilization: Record<string, number>;  // % utilization per subagent
  routingAccuracy?: number;  // % of optimal routing decisions
  lastUpdated: string;
}

/**
 * Task Complexity Score
 * Calculated when analyzing task
 */
export interface TaskComplexityScore {
  baseComplexity: number;
  payloadAdjustment: number;
  timeoutAdjustment: number;
  priorityAdjustment: number;
  totalComplexity: number;
  analysis: {
    type: string;
    payloadSize: number;
    timeout: number;
    priority: number;
  };
}

/**
 * Result Aggregation
 * For combining multiple subtask results
 */
export interface AggregatedResult {
  taskId: string;
  status: TaskStatus;
  result: {
    subtasks: Array<{
      subagent: string;
      status: TaskStatus;
      result: any;
      executionTimeMs: number;
    }>;
    totalExecutionTimeMs: number;
    averagePerTask: number;
    successCount: number;
    failureCount: number;
  };
  error_message?: string;
  executedBy: string;
  executionTimeMs: number;
  aggregatedAt: string;
}

/**
 * Routing Configuration
 */
export interface RouterConfig {
  enableLoadBalancing?: boolean;
  enableSpecializationMatching?: boolean;
  scoreWeights?: {
    capacity: number;      // Default: 0.4
    specialization: number; // Default: 0.35
    priority: number;      // Default: 0.15
    complexity: number;    // Default: 0.1
  };
  maxRoutingTimeMs?: number;  // Default: 5000
  enableMonitoring?: boolean; // Default: true
  enableAggregation?: boolean; // Default: true
}

/**
 * Batch Task Result
 * Result of routing a batch of tasks
 */
export interface BatchRoutingResult {
  batchId: string;
  totalTasks: number;
  successfullyRouted: number;
  failedToRoute: number;
  routingDetails: RoutingDecision[];
  errors: Array<{
    taskId: string;
    error: string;
  }>;
  totalRoutingTimeMs: number;
}

/**
 * Subagent Pool
 * Manages available subagents
 */
export interface SubagentPool {
  subagents: Map<string, SubagentSpec>;
  lastRefresh: string;
  totalCapacity: number;
  usedCapacity: number;
}

/**
 * Router Monitoring Event
 */
export interface RouterMonitoringEvent {
  eventType: 'route_start' | 'route_complete' | 'route_failed' | 'aggregation_start' | 'aggregation_complete';
  timestamp: string;
  duration?: number;
  taskCount?: number;
  data: Record<string, any>;
}
