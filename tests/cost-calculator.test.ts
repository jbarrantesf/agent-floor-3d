/**
 * Cost Calculator Tests
 * Phase 5A: Unit tests for cost calculation engine
 */

import { CostCalculator } from '../src/lib/cost-calculator';
import { Task } from '../src/types/cost';

describe('CostCalculator', () => {
  let calculator: CostCalculator;

  beforeEach(() => {
    calculator = new CostCalculator();
  });

  describe('calculateTaskCost', () => {
    it('should calculate cost for shell task', () => {
      const task: Task = { id: '1', task_type: 'shell' };
      const cost = calculator.calculateTaskCost(task, 3200); // 3.2 seconds

      // base: 0.00008 * 3.2 = 0.000256
      // overhead: 0.0001
      // total: 0.000356
      expect(cost).toBeCloseTo(0.000356, 6);
    });

    it('should calculate cost for sql task', () => {
      const task: Task = { id: '1', task_type: 'sql' };
      const cost = calculator.calculateTaskCost(task, 10000); // 10 seconds

      // base: 0.00005 * 10 = 0.0005
      // overhead: 0.0002
      // total: 0.0007
      expect(cost).toBeCloseTo(0.0007, 6);
    });

    it('should calculate cost for file operations', () => {
      const task: Task = { id: '1', task_type: 'file_ops' };
      const cost = calculator.calculateTaskCost(task, 1000); // 1 second

      // base: 0.00001 * 1 = 0.00001
      // overhead: 0.0001
      // total: 0.00011
      expect(cost).toBeCloseTo(0.00011, 6);
    });

    it('should use default tier for unknown task type', () => {
      const task: Task = { id: '1', task_type: 'unknown' };
      const cost = calculator.calculateTaskCost(task, 2000); // 2 seconds

      // base: 0.00005 * 2 = 0.0001
      // overhead: 0.0001
      // total: 0.0002
      expect(cost).toBeCloseTo(0.0002, 6);
    });

    it('should handle zero execution time', () => {
      const task: Task = { id: '1', task_type: 'shell' };
      const cost = calculator.calculateTaskCost(task, 0);

      // Only overhead: 0.0001
      expect(cost).toBeCloseTo(0.0001, 6);
    });
  });

  describe('calculateBatchCost', () => {
    it('should calculate batch cost correctly', () => {
      const tasks = [
        { taskType: 'shell', executionTimeMs: 3200 },
        { taskType: 'sql', executionTimeMs: 10000 },
      ];

      const cost = calculator.calculateBatchCost(tasks);

      // shell: 0.000256 + 0.0001 = 0.000356
      // sql: 0.0005 + 0.0002 = 0.0007
      // total: 0.001056
      expect(cost).toBeCloseTo(0.001056, 6);
    });

    it('should handle empty batch', () => {
      const cost = calculator.calculateBatchCost([]);
      expect(cost).toBe(0);
    });
  });

  describe('estimateTaskCost', () => {
    it('should estimate shell task cost', () => {
      const task: Task = { id: '1', task_type: 'shell' };
      const cost = calculator.estimateTaskCost(task);

      // shell default: 2 seconds
      // base: 0.00008 * 2 = 0.00016
      // overhead: 0.0001
      // total: 0.00026
      expect(cost).toBeCloseTo(0.00026, 6);
    });

    it('should estimate sql task cost', () => {
      const task: Task = { id: '1', task_type: 'sql' };
      const cost = calculator.estimateTaskCost(task);

      // sql default: 3 seconds
      // base: 0.00005 * 3 = 0.00015
      // overhead: 0.0002
      // total: 0.00035
      expect(cost).toBeCloseTo(0.00035, 6);
    });
  });

  describe('calculateHourlyCost', () => {
    it('should calculate hourly cost', () => {
      // shell: 1 task per hour, 2s average
      const cost = calculator.calculateHourlyCost('shell', 1);

      // 0.00026 * 1 = 0.00026
      expect(cost).toBeGreaterThan(0.0002);
    });

    it('should scale with task count', () => {
      const cost1 = calculator.calculateHourlyCost('shell', 1);
      const cost10 = calculator.calculateHourlyCost('shell', 10);

      expect(cost10).toBeCloseTo(cost1 * 10, 6);
    });
  });

  describe('calculateSavings', () => {
    it('should calculate correct savings', () => {
      const original = 1.0;
      const optimized = 0.85;
      const result = calculator.calculateSavings(original, optimized);

      expect(result.savings).toBe(0.15);
      expect(result.percentageReduction).toBeCloseTo(15, 1);
    });

    it('should handle zero savings', () => {
      const result = calculator.calculateSavings(1.0, 1.0);

      expect(result.savings).toBe(0);
      expect(result.percentageReduction).toBe(0);
    });
  });

  describe('projectMonthlyCost', () => {
    it('should project monthly cost', () => {
      const monthlyCost = calculator.projectMonthlyCost(1.0);
      expect(monthlyCost).toBe(30);
    });
  });

  describe('projectYearlyCost', () => {
    it('should project yearly cost', () => {
      const yearlyCost = calculator.projectYearlyCost(1.0);
      expect(yearlyCost).toBe(365);
    });
  });

  describe('getCostTier', () => {
    it('should return correct tier for task type', () => {
      const tier = calculator.getCostTier('shell');
      expect(tier.base).toBe(0.00008);
      expect(tier.overhead).toBe(0.0001);
    });

    it('should return default tier for unknown type', () => {
      const tier = calculator.getCostTier('unknown');
      expect(tier.base).toBe(0.00005);
      expect(tier.overhead).toBe(0.0001);
    });
  });

  describe('setCostTier', () => {
    it('should update cost tier', () => {
      calculator.setCostTier('custom', { base: 0.0001, overhead: 0.00005 });
      const tier = calculator.getCostTier('custom');

      expect(tier.base).toBe(0.0001);
      expect(tier.overhead).toBe(0.00005);
    });
  });

  describe('getAllCostTiers', () => {
    it('should return all cost tiers', () => {
      const tiers = calculator.getAllCostTiers();

      expect(tiers).toHaveProperty('shell');
      expect(tiers).toHaveProperty('sql');
      expect(tiers).toHaveProperty('file_ops');
      expect(tiers).toHaveProperty('http');
      expect(tiers).toHaveProperty('webhook');
    });
  });
});
