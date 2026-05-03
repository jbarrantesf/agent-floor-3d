/**
 * Cost Calculator Engine
 * Phase 5A: Cost Calculation & Estimation
 */

import { Task, TaskEvent, CostTier, CostTiers } from '../types/cost';

export class CostCalculator {
  private costTiers: CostTiers = {
    file_ops: { base: 0.00001, overhead: 0.0001 },
    shell: { base: 0.00008, overhead: 0.0001 },
    sql: { base: 0.00005, overhead: 0.0002 },
    http: { base: 0.00003, overhead: 0.00015 },
    webhook: { base: 0.00002, overhead: 0.00015 },
  };

  private defaultTier: CostTier = { base: 0.00005, overhead: 0.0001 };

  /**
   * Calculate actual task cost based on execution time
   */
  calculateTaskCost(task: Task | TaskEvent, executionTimeMs: number): number {
    const executionTimeSec = executionTimeMs / 1000;
    const taskType = this.getTaskType(task);
    const tier = this.costTiers[taskType] || this.defaultTier;

    const baseCost = executionTimeSec * tier.base;
    const overhead = tier.overhead;

    return baseCost + overhead;
  }

  /**
   * Calculate batch cost for multiple tasks
   */
  calculateBatchCost(
    tasks: Array<{ taskType: string; executionTimeMs: number }>
  ): number {
    return tasks.reduce((sum, task) => {
      const tier = this.costTiers[task.taskType] || this.defaultTier;
      const executionTimeSec = task.executionTimeMs / 1000;
      const baseCost = executionTimeSec * tier.base;
      const overhead = tier.overhead;
      return sum + baseCost + overhead;
    }, 0);
  }

  /**
   * Estimate task cost before execution (using average times)
   */
  estimateTaskCost(task: Task): number {
    const avgExecutionMs = this.getAverageExecutionTime(this.getTaskType(task));
    return this.calculateTaskCost(task, avgExecutionMs);
  }

  /**
   * Get default average execution time for task type
   */
  private getAverageExecutionTime(taskType: string): number {
    const defaults: { [key: string]: number } = {
      file_ops: 1000, // 1 second
      shell: 2000, // 2 seconds
      sql: 3000, // 3 seconds
      http: 2500, // 2.5 seconds
      webhook: 1500, // 1.5 seconds
    };
    return defaults[taskType] || 2000;
  }

  /**
   * Get task type from task or task event
   */
  private getTaskType(task: Task | TaskEvent): string {
    if ('task_type' in task) {
      return task.task_type;
    } else if ('task' in task && task.task) {
      return task.task.task_type;
    }
    return 'shell'; // default
  }

  /**
   * Calculate cost per hour for ongoing task type
   */
  calculateHourlyCost(taskType: string, tasksPerHour: number = 1): number {
    const avgTimeMs = this.getAverageExecutionTime(taskType);
    const taskCost = this.calculateTaskCost(
      { task_type: taskType } as Task,
      avgTimeMs
    );
    return taskCost * tasksPerHour;
  }

  /**
   * Calculate cost savings from optimization
   */
  calculateSavings(
    originalCost: number,
    optimizedCost: number
  ): { savings: number; percentageReduction: number } {
    const savings = originalCost - optimizedCost;
    const percentageReduction = (savings / originalCost) * 100;
    return { savings, percentageReduction };
  }

  /**
   * Get cost tier for task type
   */
  getCostTier(taskType: string): CostTier {
    return this.costTiers[taskType] || this.defaultTier;
  }

  /**
   * Update cost tier (for custom configurations)
   */
  setCostTier(taskType: string, tier: CostTier): void {
    this.costTiers[taskType] = tier;
  }

  /**
   * Get all cost tiers
   */
  getAllCostTiers(): CostTiers {
    return { ...this.costTiers };
  }

  /**
   * Calculate projected monthly cost based on daily average
   */
  projectMonthlyCost(dailyAverageCost: number): number {
    return dailyAverageCost * 30;
  }

  /**
   * Calculate projected yearly cost based on daily average
   */
  projectYearlyCost(dailyAverageCost: number): number {
    return dailyAverageCost * 365;
  }

  /**
   * Estimate cost reduction from reducing failed tasks
   */
  estimateFailureReduction(
    totalCost: number,
    currentFailureRate: number,
    targetFailureRate: number
  ): number {
    const failedTasksCost = totalCost * currentFailureRate;
    const targetFailedTasksCost = totalCost * targetFailureRate;
    return failedTasksCost - targetFailedTasksCost;
  }
}

// Singleton instance
export const costCalculator = new CostCalculator();
