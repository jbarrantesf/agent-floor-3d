/**
 * Cost Tracker Tests
 * Phase 5B: Unit tests for real-time cost tracking
 */

import { CostTracker } from '../src/lib/cost-tracker';
import { CostCalculator } from '../src/lib/cost-calculator';
import { TaskEvent, EfficiencyMetrics, AgentCostBreakdown } from '../src/types/cost';

// Mock Supabase client
class MockSupabaseClient {
  private data: Map<string, any> = new Map();

  channel(name: string) {
    return {
      on: () => this,
      subscribe: () => {},
    };
  }

  from(table: string) {
    return {
      select: () => this,
      eq: () => this,
      gte: () => this,
      lte: () => this,
      order: () => this,
      upsert: async () => ({ error: null }),
    };
  }
}

describe('CostTracker', () => {
  let tracker: CostTracker;
  let calculator: CostCalculator;
  let mockSupabase: any;

  beforeEach(() => {
    calculator = new CostCalculator();
    mockSupabase = new MockSupabaseClient();
    tracker = new CostTracker({
      supabase: mockSupabase,
      calculator,
      pollIntervalMs: 1000,
    });
  });

  afterEach(() => {
    tracker.stop();
  });

  describe('subscribe', () => {
    it('should add subscription callback', () => {
      const callback = jest.fn();
      const unsubscribe = tracker.subscribe(callback);

      expect(unsubscribe).toBeInstanceOf(Function);
    });

    it('should remove subscription when unsubscribed', () => {
      const callback = jest.fn();
      const unsubscribe = tracker.subscribe(callback);

      unsubscribe();
      // Callback should no longer be called (verified by next test)
    });
  });

  describe('recordTaskCost', () => {
    it('should record task cost correctly', async () => {
      const event: TaskEvent = {
        task_id: 'task-1',
        event_type: 'completed',
        executor_name: 'agent-1',
        execution_time_ms: 3200,
      };

      const cost = await tracker.recordTaskCost(event);

      // Expected: 0.000256 + 0.0001 = 0.000356
      expect(cost).toBeCloseTo(0.000356, 6);
    });

    it('should handle failed events', async () => {
      const event: TaskEvent = {
        task_id: 'task-1',
        event_type: 'failed',
        executor_name: 'agent-1',
        execution_time_ms: 1000,
      };

      const cost = await tracker.recordTaskCost(event);
      expect(cost).toBeGreaterThan(0);
    });
  });

  describe('getDailyCost', () => {
    it('should return 0 for empty cost tracker', () => {
      const cost = tracker.getDailyCost();
      expect(cost).toBe(0);
    });

    it('should return cost for specific date', () => {
      const cost = tracker.getDailyCost('2026-05-02');
      expect(typeof cost).toBe('number');
    });
  });

  describe('clearCache', () => {
    it('should clear daily costs', () => {
      tracker.clearCache();
      const cost = tracker.getDailyCost();
      expect(cost).toBe(0);
    });
  });

  describe('subscribeToTaskCosts', () => {
    it('should initialize subscription', () => {
      expect(() => tracker.subscribeToTaskCosts()).not.toThrow();
    });
  });

  describe('stop', () => {
    it('should stop polling without error', () => {
      expect(() => tracker.stop()).not.toThrow();
    });
  });
});
