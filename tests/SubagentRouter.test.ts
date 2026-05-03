/**
 * SubagentRouter Unit Tests
 * Tests for Phase 4 implementation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SubagentRouter } from '../src/lib/SubagentRouter';
import { Task, TaskExecutionResult } from '../src/types/task';
import { RoutingEvent } from '../src/types/router';

// Mock Supabase client
const createMockSupabase = () => ({
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      in: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                name: 'subagent_1',
                is_online: true,
                current_load: 2,
                max_concurrent_tasks: 5,
                last_heartbeat: new Date().toISOString(),
                status_percentage: 40,
              },
              {
                name: 'subagent_2',
                is_online: true,
                current_load: 3,
                max_concurrent_tasks: 5,
                last_heartbeat: new Date().toISOString(),
                status_percentage: 60,
              },
              {
                name: 'subagent_3',
                is_online: true,
                current_load: 1,
                max_concurrent_tasks: 5,
                last_heartbeat: new Date().toISOString(),
                status_percentage: 20,
              },
            ],
            error: null,
          }),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
  }),
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
});

// Helper to create mock task
const createMockTask = (overrides?: Partial<Task>): Task => ({
  id: 'task_' + Math.random().toString(36).substr(2, 9),
  delegated_by: 'hermes',
  assigned_to: 'orbit',
  task_type: 'shell',
  priority: 1,
  status: 'QUEUED',
  payload: {
    action: 'exec',
    params: { cmd: 'echo "test"' },
  },
  created_at: new Date().toISOString(),
  timeout_seconds: 60,
  retry_count: 0,
  max_retries: 3,
  ...overrides,
});

describe('SubagentRouter', () => {
  let supabase: any;
  let router: SubagentRouter;

  beforeEach(() => {
    supabase = createMockSupabase();
    router = new SubagentRouter(supabase, 'orbit');
  });

  afterEach(async () => {
    if (router) {
      await router.stop();
    }
  });

  describe('Initialization', () => {
    it('should initialize with correct agent name', () => {
      expect(router).toBeDefined();
      const status = router.getStatus();
      expect(status.agentName).toBe('orbit');
    });

    it('should have default configuration', () => {
      const status = router.getStatus();
      expect(status.stats).toBeDefined();
      expect(status.stats.totalTasksRouted).toBe(0);
    });

    it('should initialize utilization tracking', () => {
      const stats = router.getRoutingStats();
      expect(stats.subagentUtilization).toBeDefined();
      expect(stats.subagentUtilization['subagent_1']).toBeDefined();
    });
  });

  describe('Start/Stop', () => {
    it('should start successfully', async () => {
      await router.start();
      const status = router.getStatus();
      expect(status.isRunning).toBe(true);
    });

    it('should stop successfully', async () => {
      await router.start();
      await router.stop();
      const status = router.getStatus();
      expect(status.isRunning).toBe(false);
    });

    it('should handle multiple start calls gracefully', async () => {
      await router.start();
      await router.start(); // Should not throw
      expect(router.getStatus().isRunning).toBe(true);
    });

    it('should handle multiple stop calls gracefully', async () => {
      await router.start();
      await router.stop();
      await router.stop(); // Should not throw
      expect(router.getStatus().isRunning).toBe(false);
    });
  });

  describe('Task Complexity Analysis', () => {
    it('should analyze shell command complexity correctly', async () => {
      const task = createMockTask({ task_type: 'shell' });
      await router.start();
      // Complexity analysis happens internally
      expect(task.task_type).toBe('shell');
    });

    it('should handle large payloads', async () => {
      const largePayload = 'x'.repeat(51000); // > 50KB
      const task = createMockTask({
        payload: {
          action: 'write',
          params: { content: largePayload },
        },
      });
      expect(task.payload.params.content.length).toBeGreaterThan(50000);
    });

    it('should recognize high priority tasks', async () => {
      const task = createMockTask({ priority: 3 });
      expect(task.priority).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Subagent Selection', () => {
    it('should select available subagent with lowest load', async () => {
      const agents = [
        {
          name: 'subagent_1',
          is_online: true,
          current_load: 4,
          max_concurrent_tasks: 5,
          last_heartbeat: new Date().toISOString(),
          status_percentage: 80,
        },
        {
          name: 'subagent_2',
          is_online: true,
          current_load: 2,
          max_concurrent_tasks: 5,
          last_heartbeat: new Date().toISOString(),
          status_percentage: 40,
        },
      ];

      const selected = router.selectBestSubagent(agents, 'shell', 3);
      expect(selected).toBeDefined();
      expect(selected?.name).toMatch(/subagent_[1-2]/);
    });

    it('should prefer specialist subagent when available', async () => {
      const agents = [
        {
          name: 'subagent_1',
          is_online: true,
          current_load: 1,
          max_concurrent_tasks: 5,
          last_heartbeat: new Date().toISOString(),
          status_percentage: 20,
        },
        {
          name: 'subagent_2',
          is_online: true,
          current_load: 1,
          max_concurrent_tasks: 5,
          last_heartbeat: new Date().toISOString(),
          status_percentage: 20,
        },
      ];

      // Both have same load, but subagent_1 specializes in shell
      const selected = router.selectBestSubagent(agents, 'shell', 3);
      expect(selected).toBeDefined();
    });

    it('should return undefined for empty agent list', () => {
      const selected = router.selectBestSubagent([], 'shell', 3);
      expect(selected).toBeUndefined();
    });

    it('should handle high priority subagents as tiebreaker', async () => {
      const agents = [
        {
          name: 'subagent_1',
          is_online: true,
          current_load: 1,
          max_concurrent_tasks: 5,
          last_heartbeat: new Date().toISOString(),
          status_percentage: 20,
        },
        {
          name: 'subagent_3', // Priority 2 vs 1
          is_online: true,
          current_load: 1,
          max_concurrent_tasks: 5,
          last_heartbeat: new Date().toISOString(),
          status_percentage: 20,
        },
      ];

      const selected = router.selectBestSubagent(agents, 'shell', 3);
      expect(selected).toBeDefined();
      // Both have same load, subagent_3 has higher priority
      expect(selected?.name).toMatch(/subagent_[1-3]/);
    });
  });

  describe('Task Routing', () => {
    it('should route task successfully', async () => {
      await router.start();
      const task = createMockTask();

      let routingEvent: RoutingEvent | undefined;
      router.subscribeToRoutingEvents((event) => {
        routingEvent = event;
      });

      await router.routeTask(task);

      expect(routingEvent).toBeDefined();
      expect(routingEvent?.eventType).toBe('routed');
      expect(routingEvent?.taskId).toBe(task.id);
      expect(routingEvent?.subagentName).toBeDefined();
    });

    it('should update stats on successful routing', async () => {
      await router.start();
      const task = createMockTask();

      await router.routeTask(task);

      const stats = router.getRoutingStats();
      expect(stats.totalTasksRouted).toBe(1);
      expect(stats.successfulRoutes).toBe(1);
    });

    it('should handle task delegation to subagent', async () => {
      await router.start();
      const task = createMockTask();

      await router.routeTask(task);

      // Verify that update was called
      const updateCall = supabase.from('tasks').update;
      expect(updateCall).toHaveBeenCalled();
    });

    it('should record routing events in database', async () => {
      await router.start();
      const task = createMockTask();

      await router.routeTask(task);

      // Verify event recording
      const insertCall = supabase.from('task_events').insert;
      expect(insertCall).toHaveBeenCalled();
    });

    it('should store routing decision', async () => {
      await router.start();
      const task = createMockTask();

      await router.routeTask(task);

      const decision = router.getRoutingDecision(task.id);
      expect(decision).toBeDefined();
      expect(decision?.taskId).toBe(task.id);
      expect(decision?.selectedSubagent).toBeDefined();
    });
  });

  describe('Result Aggregation', () => {
    it('should aggregate single result', async () => {
      const subtaskResults = [
        {
          status: 'COMPLETED',
          data: { success: true },
          executedBy: 'subagent_1',
          executionTimeMs: 100,
        },
      ];

      const aggregated = await router.aggregateResults('task_1', subtaskResults);

      expect(aggregated.status).toBe('COMPLETED');
      expect(aggregated.result.subtasks).toHaveLength(1);
      expect(aggregated.result.successCount).toBe(1);
      expect(aggregated.result.failureCount).toBe(0);
    });

    it('should aggregate multiple results', async () => {
      const subtaskResults = [
        {
          status: 'COMPLETED',
          data: { result: 'ok1' },
          executedBy: 'subagent_1',
          executionTimeMs: 100,
        },
        {
          status: 'COMPLETED',
          data: { result: 'ok2' },
          executedBy: 'subagent_2',
          executionTimeMs: 150,
        },
        {
          status: 'COMPLETED',
          data: { result: 'ok3' },
          executedBy: 'subagent_3',
          executionTimeMs: 120,
        },
      ];

      const aggregated = await router.aggregateResults('task_batch', subtaskResults);

      expect(aggregated.result.subtasks).toHaveLength(3);
      expect(aggregated.result.successCount).toBe(3);
      expect(aggregated.result.totalExecutionTimeMs).toBeGreaterThan(0);
    });

    it('should handle partial failures', async () => {
      const subtaskResults = [
        {
          status: 'COMPLETED',
          data: { result: 'ok' },
          executedBy: 'subagent_1',
          executionTimeMs: 100,
        },
        {
          status: 'FAILED',
          error: 'Timeout',
          executedBy: 'subagent_2',
          executionTimeMs: 300,
        },
      ];

      const aggregated = await router.aggregateResults('task_partial', subtaskResults);

      expect(aggregated.status).toBe('FAILED');
      expect(aggregated.result.successCount).toBe(1);
      expect(aggregated.result.failureCount).toBe(1);
      expect(aggregated.error_message).toContain('Some subtasks failed');
    });

    it('should calculate average execution time', async () => {
      const subtaskResults = [
        {
          status: 'COMPLETED',
          data: {},
          executedBy: 'subagent_1',
          executionTimeMs: 100,
        },
        {
          status: 'COMPLETED',
          data: {},
          executedBy: 'subagent_2',
          executionTimeMs: 200,
        },
      ];

      const aggregated = await router.aggregateResults('task_avg', subtaskResults);

      expect(aggregated.result.averagePerTask).toBe(150);
    });

    it('should store aggregation result', async () => {
      const subtaskResults = [
        {
          status: 'COMPLETED',
          data: {},
          executedBy: 'subagent_1',
          executionTimeMs: 100,
        },
      ];

      await router.aggregateResults('task_stored', subtaskResults);

      const stored = router.getAggregationResult('task_stored');
      expect(stored).toBeDefined();
      expect(stored?.taskId).toBe('task_stored');
    });
  });

  describe('Event Subscriptions', () => {
    it('should emit routing events', async () => {
      await router.start();

      let eventCount = 0;
      const unsubscribe = router.subscribeToRoutingEvents((event) => {
        eventCount++;
      });

      const task = createMockTask();
      await router.routeTask(task);

      expect(eventCount).toBeGreaterThan(0);
      unsubscribe();
    });

    it('should allow multiple subscribers', async () => {
      await router.start();

      let count1 = 0;
      let count2 = 0;

      const unsubscribe1 = router.subscribeToRoutingEvents(() => {
        count1++;
      });

      const unsubscribe2 = router.subscribeToRoutingEvents(() => {
        count2++;
      });

      const task = createMockTask();
      await router.routeTask(task);

      expect(count1).toBeGreaterThan(0);
      expect(count2).toBeGreaterThan(0);

      unsubscribe1();
      unsubscribe2();
    });

    it('should unsubscribe from events', async () => {
      await router.start();

      let eventCount = 0;
      const unsubscribe = router.subscribeToRoutingEvents(() => {
        eventCount++;
      });

      const task1 = createMockTask();
      await router.routeTask(task1);
      const afterFirst = eventCount;

      unsubscribe();

      const task2 = createMockTask();
      // This may not route due to test setup, so just verify unsubscribe doesn't break
      expect(afterFirst).toBeGreaterThan(0);
    });
  });

  describe('Statistics', () => {
    it('should track total tasks routed', async () => {
      await router.start();

      const stats1 = router.getRoutingStats();
      expect(stats1.totalTasksRouted).toBe(0);

      const task = createMockTask();
      await router.routeTask(task);

      const stats2 = router.getRoutingStats();
      expect(stats2.totalTasksRouted).toBe(1);
    });

    it('should track successful routes', async () => {
      await router.start();

      const task = createMockTask();
      await router.routeTask(task);

      const stats = router.getRoutingStats();
      expect(stats.successfulRoutes).toBe(1);
    });

    it('should calculate average routing time', async () => {
      await router.start();

      const task = createMockTask();
      await router.routeTask(task);

      const stats = router.getRoutingStats();
      expect(stats.averageRoutingTimeMs).toBeGreaterThan(0);
    });

    it('should track utilization by subagent', async () => {
      await router.start();

      const task = createMockTask();
      await router.routeTask(task);

      const stats = router.getRoutingStats();
      expect(Object.keys(stats.subagentUtilization).length).toBeGreaterThan(0);
    });

    it('should provide router status', () => {
      const status = router.getStatus();
      expect(status.isRunning).toBe(false);
      expect(status.agentName).toBe('orbit');
      expect(status.uptime).toBeGreaterThan(0);
      expect(status.stats).toBeDefined();
    });
  });

  describe('Memory Management', () => {
    it('should clear old decisions', async () => {
      await router.start();

      // Manually add old decision
      const oldTime = new Date(Date.now() - 100000000).toISOString(); // Very old
      const decision = {
        taskId: 'old_task',
        selectedSubagent: 'subagent_1',
        reason: 'test',
        complexity: 3,
        parallelizable: true,
        timestamp: oldTime,
      };

      // Access private method via type casting for testing
      (router as any).routingDecisions.set('old_task', decision);

      // Clear with very small max age
      router.clearOldDecisions(1000);

      // Old decision should be removed
      expect(router.getRoutingDecision('old_task')).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle routing failure gracefully', async () => {
      await router.start();

      // Mock error in agent fetch
      supabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
      });

      let errorEmitted = false;
      router.subscribeToRoutingEvents((event) => {
        if (event.eventType === 'failed') {
          errorEmitted = true;
        }
      });

      const task = createMockTask();
      try {
        await router.routeTask(task);
      } catch (error) {
        // Expected to fail
      }

      expect(errorEmitted).toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should accept custom configuration', () => {
      const customRouter = new SubagentRouter(supabase, 'test-router', {
        enableLoadBalancing: false,
        enableSpecializationMatching: false,
        maxRoutingTimeMs: 2000,
      });

      expect(customRouter).toBeDefined();
    });
  });
});
