/**
 * Subagent Configuration
 * Phase 4: Defines subagent specializations, capacities, and profiles
 */

import { SubagentSpec } from '../types/router';

/**
 * Subagent Specifications
 * Each subagent has specific capabilities and capacity limits
 */
export const SUBAGENT_SPECS: Record<string, SubagentSpec> = {
  subagent_1: {
    name: 'subagent_1',
    specialization: ['file_ops', 'shell'],
    max_concurrent_tasks: 5,
    priority: 1,
    description: 'File operations and shell command specialist',
  },
  subagent_2: {
    name: 'subagent_2',
    specialization: ['sql', 'http'],
    max_concurrent_tasks: 5,
    priority: 1,
    description: 'Database and HTTP request specialist',
  },
  subagent_3: {
    name: 'subagent_3',
    specialization: ['shell', 'http', 'file_ops'],
    max_concurrent_tasks: 5,
    priority: 2,
    description: 'Generalist with high priority - handles multiple task types',
  },
};

/**
 * Scoring Weights for Routing Algorithm
 * These weights determine how routing decisions are made
 */
export const ROUTING_SCORE_WEIGHTS = {
  capacity: 0.4,        // Remaining capacity is 40% of scoring
  specialization: 0.35, // Task-type specialization is 35%
  priority: 0.15,       // Subagent priority is 15%
  complexity: 0.1,      // Task complexity adjustment is 10%
};

/**
 * Task Complexity Baselines
 * Starting complexity for each task type
 */
export const TASK_COMPLEXITY_BASELINE: Record<string, number> = {
  file_read: 1,
  file_write: 2,
  shell: 3,
  sql_execute: 4,
  webhook: 2,
  http: 2,
  deployment: 5,
};

/**
 * Complexity Adjustments
 */
export const COMPLEXITY_ADJUSTMENTS = {
  payloadSize: {
    large_10kb: 2,      // > 10KB
    large_50kb: 3,      // > 50KB
  },
  timeout: {
    short: 1,    // < 30s
    long: 1,     // > 300s
  },
  priority: {
    high: 1,     // Priority >= 2
  },
};

/**
 * Performance Targets
 */
export const PERFORMANCE_TARGETS = {
  routingDecision: 100,      // ms
  subagentSelection: 20,     // ms
  resultAggregation: 50,     // ms
  totalE2E: 5000,            // ms (depends on actual task)
  concurrentCapacity: 100,   // simultaneous routes
  routingAccuracy: 0.9,      // 90%+ optimal selection
};

/**
 * Get all subagent names
 */
export function getSubagentNames(): string[] {
  return Object.keys(SUBAGENT_SPECS);
}

/**
 * Get subagent by name
 */
export function getSubagent(name: string): SubagentSpec | undefined {
  return SUBAGENT_SPECS[name];
}

/**
 * Get subagents with specific specialization
 */
export function getSubagentsBySpecialization(specialization: string): SubagentSpec[] {
  return Object.values(SUBAGENT_SPECS).filter((spec) =>
    spec.specialization.includes(specialization)
  );
}

/**
 * Get total pool capacity
 */
export function getTotalPoolCapacity(): number {
  return Object.values(SUBAGENT_SPECS).reduce(
    (total, spec) => total + spec.max_concurrent_tasks,
    0
  );
}

/**
 * Check if task type is supported by subagent
 */
export function isTaskTypeSupported(taskType: string, subagentName: string): boolean {
  const spec = SUBAGENT_SPECS[subagentName];
  if (!spec) return false;
  
  // Map task_type to specialization
  const specializationMap: Record<string, string> = {
    file_write: 'file_ops',
    file_read: 'file_ops',
    sql_execute: 'sql',
    shell: 'shell',
    webhook: 'http',
    http: 'http',
  };
  
  const requiredSpecialization = specializationMap[taskType];
  if (!requiredSpecialization) {
    // Unknown task types can be handled by any subagent
    return true;
  }
  
  return spec.specialization.includes(requiredSpecialization);
}

/**
 * Get default router configuration
 */
export const DEFAULT_ROUTER_CONFIG = {
  enableLoadBalancing: true,
  enableSpecializationMatching: true,
  scoreWeights: ROUTING_SCORE_WEIGHTS,
  maxRoutingTimeMs: 5000,
  enableMonitoring: true,
  enableAggregation: true,
};
