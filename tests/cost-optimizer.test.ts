/**
 * Cost Optimizer Tests
 * Phase 5D: Unit tests for optimization recommendations
 */

import { CostOptimizer } from '../src/lib/cost-optimizer';
import {
  EfficiencyMetrics,
  Recommendation,
  AgentCostBreakdown,
} from '../src/types/cost';

describe('CostOptimizer', () => {
  let optimizer: CostOptimizer;

  beforeEach(() => {
    optimizer = new CostOptimizer();
  });

  const mockMetrics: EfficiencyMetrics = {
    totalTasks: 100,
    successCount: 95,
    successRate: 0.95,
    totalCost: 1.0,
    costPerTask: 0.01,
    costPerSuccess: 0.0105,
    totalExecutionTime: 200000,
    averageExecutionTime: 2000,
  };

  const mockAgentCosts: AgentCostBreakdown[] = [
    {
      agent: 'agent-1',
      totalCost: 0.4,
      taskCount: 40,
      successCount: 38,
      costPerTask: 0.01,
    },
    {
      agent: 'agent-2',
      totalCost: 0.3,
      taskCount: 30,
      successCount: 29,
      costPerTask: 0.01,
    },
    {
      agent: 'agent-3',
      totalCost: 0.3,
      taskCount: 30,
      successCount: 28,
      costPerTask: 0.01,
    },
  ];

  describe('generateRecommendations', () => {
    it('should generate recommendations for valid metrics', () => {
      const recs = optimizer.generateRecommendations(mockMetrics, mockAgentCosts);

      expect(Array.isArray(recs)).toBe(true);
      recs.forEach((rec) => {
        expect(rec).toHaveProperty('type');
        expect(rec).toHaveProperty('severity');
        expect(rec).toHaveProperty('description');
        expect(rec).toHaveProperty('potentialSavings');
      });
    });

    it('should return empty array for empty metrics', () => {
      const emptyMetrics: EfficiencyMetrics = {
        totalTasks: 0,
        successCount: 0,
        successRate: 0,
        totalCost: 0,
        costPerTask: 0,
        costPerSuccess: 0,
      };

      const recs = optimizer.generateRecommendations(emptyMetrics, []);
      expect(recs).toEqual([]);
    });

    it('should detect workload imbalance', () => {
      const imbalancedCosts: AgentCostBreakdown[] = [
        {
          agent: 'agent-1',
          totalCost: 0.7,
          taskCount: 70,
          successCount: 70,
          costPerTask: 0.01,
        },
        {
          agent: 'agent-2',
          totalCost: 0.3,
          taskCount: 30,
          successCount: 30,
          costPerTask: 0.01,
        },
      ];

      const recs = optimizer.generateRecommendations(mockMetrics, imbalancedCosts);
      const workloadRec = recs.find((r) => r.type === 'workload_rebalance');

      expect(workloadRec).toBeDefined();
      expect(workloadRec?.severity).toBe('medium');
    });

    it('should detect high failure rate', () => {
      const highFailureMetrics: EfficiencyMetrics = {
        ...mockMetrics,
        successRate: 0.85,
        successCount: 85,
      };

      const recs = optimizer.generateRecommendations(highFailureMetrics, mockAgentCosts);
      const failureRec = recs.find((r) => r.type === 'reduce_failures');

      expect(failureRec).toBeDefined();
    });

    it('should detect batching opportunities', () => {
      const batchableMetrics: EfficiencyMetrics = {
        ...mockMetrics,
        totalTasks: 100,
        averageExecutionTime: 800, // Low execution time
      };

      const recs = optimizer.generateRecommendations(batchableMetrics, mockAgentCosts);
      const batchRec = recs.find((r) => r.type === 'batch_tasks');

      expect(batchRec).toBeDefined();
    });

    it('should sort recommendations by severity', () => {
      const recs = optimizer.generateRecommendations(mockMetrics, mockAgentCosts);

      let lastSeverity = -1;
      const severityOrder = { high: 0, medium: 1, low: 2 };

      for (const rec of recs) {
        const currentSeverity = severityOrder[rec.severity];
        expect(currentSeverity >= lastSeverity).toBe(true);
        lastSeverity = currentSeverity;
      }
    });
  });

  describe('calculateRecommendationROI', () => {
    it('should calculate positive ROI', () => {
      const rec: Recommendation = {
        type: 'workload_rebalance',
        severity: 'medium',
        description: 'Test',
        potentialSavings: 0.01,
      };

      const roi = optimizer.calculateRecommendationROI(rec, 0.001);

      expect(roi.roi).toBeGreaterThan(0);
      expect(roi.paybackDays).toBeGreaterThan(0);
    });

    it('should mark low ROI as not worth implementing', () => {
      const rec: Recommendation = {
        type: 'workload_rebalance',
        severity: 'low',
        description: 'Test',
        potentialSavings: 0.001,
      };

      const roi = optimizer.calculateRecommendationROI(rec, 1.0, 30);

      expect(roi.worthImplementing).toBe(false);
    });
  });

  describe('prioritizeByImpact', () => {
    it('should sort recommendations by potential savings', () => {
      const recs: Recommendation[] = [
        {
          type: 'batch_tasks',
          severity: 'low',
          description: 'Test 1',
          potentialSavings: 0.001,
        },
        {
          type: 'reduce_failures',
          severity: 'high',
          description: 'Test 2',
          potentialSavings: 0.01,
        },
        {
          type: 'workload_rebalance',
          severity: 'medium',
          description: 'Test 3',
          potentialSavings: 0.005,
        },
      ];

      const prioritized = optimizer.prioritizeByImpact(recs);

      expect(prioritized[0].potentialSavings).toBe(0.01);
      expect(prioritized[1].potentialSavings).toBe(0.005);
      expect(prioritized[2].potentialSavings).toBe(0.001);
    });
  });

  describe('getRecommendationsSummary', () => {
    it('should calculate summary correctly', () => {
      const recs: Recommendation[] = [
        {
          type: 'reduce_failures',
          severity: 'high',
          description: 'Test 1',
          potentialSavings: 0.01,
        },
        {
          type: 'workload_rebalance',
          severity: 'medium',
          description: 'Test 2',
          potentialSavings: 0.005,
        },
        {
          type: 'batch_tasks',
          severity: 'low',
          description: 'Test 3',
          potentialSavings: 0.001,
        },
      ];

      const summary = optimizer.getRecommendationsSummary(recs);

      expect(summary.count).toBe(3);
      expect(summary.totalSavings).toBeCloseTo(0.016, 3);
      expect(summary.highPriority).toBe(1);
      expect(summary.mediumPriority).toBe(1);
      expect(summary.lowPriority).toBe(1);
    });
  });

  describe('estimateTotalSavings', () => {
    it('should estimate total savings', () => {
      const recs: Recommendation[] = [
        {
          type: 'reduce_failures',
          severity: 'high',
          description: 'Test',
          potentialSavings: 0.01,
        },
      ];

      const savings = optimizer.estimateTotalSavings(mockMetrics, recs);

      expect(savings.dailySavings).toBe(0.01);
      expect(savings.monthlySavings).toBe(0.3);
      expect(savings.yearlySavings).toBe(3.65);
      expect(savings.reductionPercentage).toBe(1);
    });
  });
});
