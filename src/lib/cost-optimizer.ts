/**
 * Cost Optimizer & Recommendation Engine
 * Phase 5D: Optimization recommendations
 */

import {
  EfficiencyMetrics,
  Recommendation,
  AgentStats,
  AgentCostBreakdown,
} from '../types/cost';

export class CostOptimizer {
  /**
   * Generate cost optimization recommendations
   */
  generateRecommendations(
    metrics: EfficiencyMetrics,
    costByAgent: AgentCostBreakdown[],
    agentStats?: AgentStats[]
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    if (!metrics || metrics.totalTasks === 0) {
      return recommendations;
    }

    // Recommendation 1: Rebalance workload
    const rebalanceRec = this.checkWorkloadBalance(metrics, costByAgent);
    if (rebalanceRec) {
      recommendations.push(rebalanceRec);
    }

    // Recommendation 2: Reduce failures
    const failureRec = this.checkFailureRate(metrics);
    if (failureRec) {
      recommendations.push(failureRec);
    }

    // Recommendation 3: Batch similar tasks
    const batchRec = this.checkBatchingOpportunity(metrics);
    if (batchRec) {
      recommendations.push(batchRec);
    }

    // Recommendation 4: Optimize execution time
    const optimizeRec = this.checkExecutionOptimization(metrics);
    if (optimizeRec) {
      recommendations.push(optimizeRec);
    }

    // Sort by severity
    return recommendations.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  /**
   * Check for workload imbalance between agents
   */
  private checkWorkloadBalance(
    metrics: EfficiencyMetrics,
    costByAgent: AgentCostBreakdown[]
  ): Recommendation | null {
    if (!costByAgent || costByAgent.length < 2) {
      return null;
    }

    const totalCost = metrics.totalCost;
    const maxCostAgent = costByAgent.reduce((max, agent) =>
      agent.totalCost > max.totalCost ? agent : max
    );

    const percentage = maxCostAgent.totalCost / totalCost;

    if (percentage > 0.6) {
      const potentialSavings = maxCostAgent.totalCost * 0.1; // 10% improvement estimate

      return {
        type: 'workload_rebalance',
        severity: 'medium',
        description: `Agent "${maxCostAgent.agent}" is handling ${(percentage * 100).toFixed(1)}% of costs. Consider distributing tasks more evenly across ${costByAgent.length} agents.`,
        potentialSavings,
        action: async () => {
          console.log(`Rebalancing workload for agent ${maxCostAgent.agent}`);
          // Action would be implemented by caller
        },
      };
    }

    return null;
  }

  /**
   * Check for high failure rate
   */
  private checkFailureRate(metrics: EfficiencyMetrics): Recommendation | null {
    const failureRate = 1 - metrics.successRate;

    if (failureRate > 0.05) {
      // More than 5% failure rate
      const failedTaskCount = metrics.totalTasks * failureRate;
      const failedTaskCost = metrics.totalCost * failureRate;
      const potentialSavings = failedTaskCost * 0.5; // Estimate 50% improvement if failures are reduced

      return {
        type: 'reduce_failures',
        severity: failureRate > 0.1 ? 'high' : 'medium',
        description: `Success rate is ${(metrics.successRate * 100).toFixed(1)}%. Failed ${failedTaskCount.toFixed(0)} tasks cost $${failedTaskCost.toFixed(4)} with no return. Investigate and fix failures.`,
        potentialSavings,
        action: async () => {
          console.log('Investigating task failures');
          // Action would be implemented by caller
        },
      };
    }

    return null;
  }

  /**
   * Check for batching opportunities
   */
  private checkBatchingOpportunity(
    metrics: EfficiencyMetrics
  ): Recommendation | null {
    // If average execution time is very low, batching could help
    if (
      metrics.averageExecutionTime &&
      metrics.averageExecutionTime < 1000 &&
      metrics.totalTasks > 50
    ) {
      const potentialSavings = metrics.totalCost * 0.05; // 5% improvement estimate

      return {
        type: 'batch_tasks',
        severity: 'low',
        description: `With ${metrics.totalTasks} tasks at ${(metrics.averageExecutionTime / 1000).toFixed(2)}s average, batch similar tasks together to reduce overhead.`,
        potentialSavings,
        action: async () => {
          console.log('Enabling task batching');
          // Action would be implemented by caller
        },
      };
    }

    return null;
  }

  /**
   * Check for execution time optimization
   */
  private checkExecutionOptimization(
    metrics: EfficiencyMetrics
  ): Recommendation | null {
    // If average execution time is high, suggest optimization
    if (metrics.averageExecutionTime && metrics.averageExecutionTime > 5000) {
      // More than 5 seconds
      const potentialSavings = metrics.totalCost * 0.15; // 15% improvement estimate

      return {
        type: 'optimize_execution',
        severity: 'medium',
        description: `Average execution time is ${(metrics.averageExecutionTime / 1000).toFixed(1)}s. Optimize task execution to reduce cost.`,
        potentialSavings,
        action: async () => {
          console.log('Optimizing execution time');
          // Action would be implemented by caller
        },
      };
    }

    return null;
  }

  /**
   * Calculate ROI for a recommendation
   */
  calculateRecommendationROI(
    recommendation: Recommendation,
    implementationCost: number = 0,
    daysToRecoup: number = 30
  ): { roi: number; paybackDays: number; worthImplementing: boolean } {
    const monthlySavings = recommendation.potentialSavings * 30;
    const roi = ((monthlySavings - implementationCost) / implementationCost) * 100;
    const paybackDays =
      monthlySavings > 0
        ? Math.ceil((implementationCost / monthlySavings) * 30)
        : Infinity;

    return {
      roi,
      paybackDays,
      worthImplementing: paybackDays <= daysToRecoup,
    };
  }

  /**
   * Prioritize recommendations by potential savings
   */
  prioritizeByImpact(recommendations: Recommendation[]): Recommendation[] {
    return [...recommendations].sort(
      (a, b) => b.potentialSavings - a.potentialSavings
    );
  }

  /**
   * Get summary of all recommendations
   */
  getRecommendationsSummary(
    recommendations: Recommendation[]
  ): {
    count: number;
    totalSavings: number;
    highPriority: number;
    mediumPriority: number;
    lowPriority: number;
  } {
    return {
      count: recommendations.length,
      totalSavings: recommendations.reduce(
        (sum, rec) => sum + rec.potentialSavings,
        0
      ),
      highPriority: recommendations.filter((r) => r.severity === 'high').length,
      mediumPriority: recommendations.filter((r) => r.severity === 'medium').length,
      lowPriority: recommendations.filter((r) => r.severity === 'low').length,
    };
  }

  /**
   * Estimate cost savings if all recommendations are applied
   */
  estimateTotalSavings(
    metrics: EfficiencyMetrics,
    recommendations: Recommendation[]
  ): {
    dailySavings: number;
    monthlySavings: number;
    yearlySavings: number;
    reductionPercentage: number;
  } {
    const totalSavings = recommendations.reduce(
      (sum, rec) => sum + rec.potentialSavings,
      0
    );

    return {
      dailySavings: totalSavings,
      monthlySavings: totalSavings * 30,
      yearlySavings: totalSavings * 365,
      reductionPercentage:
        metrics.totalCost > 0 ? (totalSavings / metrics.totalCost) * 100 : 0,
    };
  }
}

export const costOptimizer = new CostOptimizer();
