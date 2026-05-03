/**
 * TaskManager Tests
 */

import { TaskManager } from '../src/lib/TaskManager';
import { createClient } from '@supabase/supabase-js';
import { SupabaseClient } from '@supabase/supabase-js';

// Mock Supabase client
const mockSupabase = {
  from: jest.fn(),
  on: jest.fn(),
  removeSubscription: jest.fn(),
  rpc: jest.fn(),
} as unknown as SupabaseClient;

describe('TaskManager', () => {
  let manager: TaskManager;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new TaskManager(mockSupabase, 'hermes');
  });

  describe('delegateTask', () => {
    it('should delegate a task to target agent', async () => {
      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'task-123',
              delegated_by: 'hermes',
              assigned_to: 'orbit',
              task_type: 'file_write',
              status: 'QUEUED',
              payload: { path: '/tmp/file.txt', content: 'test' },
              priority: 1,
              timeout_seconds: 300,
              max_retries: 3,
              created_at: new Date().toISOString(),
            },
            error: null,
          }),
        }),
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: {
            agent_name: 'orbit',
            is_online: true,
            current_load: 2,
            max_concurrent_tasks: 5,
            last_heartbeat: new Date().toISOString(),
          },
        }),
      });

      (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'tasks') {
          return { insert: mockInsert };
        } else if (table === 'agent_capacity') {
          return { select: mockSelect };
        } else if (table === 'task_events') {
          return { insert: jest.fn().mockResolvedValue({}) };
        }
      });

      const task = await manager.delegateTask('orbit', 'file_write', {
        path: '/tmp/file.txt',
        content: 'test',
      });

      expect(task.id).toBe('task-123');
      expect(task.assigned_to).toBe('orbit');
      expect(task.status).toBe('QUEUED');
    });

    it('should throw error if agent not found', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Not found' },
        }),
      });

      (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'agent_capacity') {
          return { select: mockSelect };
        }
      });

      await expect(
        manager.delegateTask('nonexistent', 'file_write', { path: '/tmp/file.txt' })
      ).rejects.toThrow();
    });

    it('should respect priority option', async () => {
      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'task-456',
              priority: 3,
            },
          }),
        }),
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: { agent_name: 'orbit', is_online: true, current_load: 1, max_concurrent_tasks: 5 },
        }),
      });

      (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'tasks') return { insert: mockInsert };
        if (table === 'agent_capacity') return { select: mockSelect };
        if (table === 'task_events') return { insert: jest.fn().mockResolvedValue({}) };
      });

      const task = await manager.delegateTask('orbit', 'file_write', { path: '/tmp/file.txt' }, {
        priority: 3,
      });

      expect(task.priority).toBe(3);
    });
  });

  describe('getAgentStatus', () => {
    it('should fetch agent status', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              agent_name: 'orbit',
              is_online: true,
              current_load: 3,
              max_concurrent_tasks: 5,
              last_heartbeat: new Date().toISOString(),
            },
          }),
        }),
      });

      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      });

      const status = await manager.getAgentStatus('orbit');

      expect(status?.name).toBe('orbit');
      expect(status?.is_online).toBe(true);
      expect(status?.status_percentage).toBe(60); // 3/5 = 60%
    });

    it('should return null if agent not found', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Not found' },
          }),
        }),
      });

      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      });

      const status = await manager.getAgentStatus('nonexistent');

      expect(status).toBeNull();
    });
  });

  describe('getAllAgentStatus', () => {
    it('should fetch all agent statuses', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        data: [
          {
            agent_name: 'hermes',
            is_online: true,
            current_load: 1,
            max_concurrent_tasks: 20,
            last_heartbeat: new Date().toISOString(),
          },
          {
            agent_name: 'orbit',
            is_online: true,
            current_load: 3,
            max_concurrent_tasks: 5,
            last_heartbeat: new Date().toISOString(),
          },
        ],
      });

      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      });

      const statuses = await manager.getAllAgentStatus();

      expect(statuses).toHaveLength(2);
      expect(statuses[0].name).toBe('hermes');
      expect(statuses[1].name).toBe('orbit');
    });
  });

  describe('getTaskHistory', () => {
    it('should fetch task history', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn()
          .mockReturnValue({
            eq: jest.fn()
              .mockReturnValue({
                order: jest.fn()
                  .mockReturnValue({
                    limit: jest.fn()
                      .mockReturnValue({
                        data: [
                          {
                            id: 'task-1',
                            status: 'COMPLETED',
                            task_type: 'file_write',
                          },
                          {
                            id: 'task-2',
                            status: 'COMPLETED',
                            task_type: 'shell',
                          },
                        ],
                      }),
                  }),
              }),
          }),
      });

      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      });

      const history = await manager.getTaskHistory({ limit: 10 });

      expect(history).toHaveLength(2);
      expect(history[0].id).toBe('task-1');
    });
  });

  describe('delegateMultipleTasks', () => {
    it('should delegate multiple tasks', async () => {
      const mockInsert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn()
            .mockResolvedValueOnce({
              data: { id: 'task-1', status: 'QUEUED' },
            })
            .mockResolvedValueOnce({
              data: { id: 'task-2', status: 'QUEUED' },
            }),
        }),
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: { agent_name: 'orbit', is_online: true, current_load: 0, max_concurrent_tasks: 5 },
        }),
      });

      (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'tasks') return { insert: mockInsert };
        if (table === 'agent_capacity') return { select: mockSelect };
        if (table === 'task_events') return { insert: jest.fn().mockResolvedValue({}) };
      });

      const tasks = await manager.delegateMultipleTasks([
        { targetAgent: 'orbit', taskType: 'file_write', payload: { path: '/a.txt', content: 'A' } },
        { targetAgent: 'orbit', taskType: 'file_write', payload: { path: '/b.txt', content: 'B' } },
      ]);

      expect(tasks).toHaveLength(2);
    });
  });

  describe('getStats', () => {
    it('should return statistics', () => {
      const stats = manager.getStats();

      expect(stats).toHaveProperty('totalDelegated');
      expect(stats).toHaveProperty('totalCompleted');
      expect(stats).toHaveProperty('totalFailed');
      expect(stats).toHaveProperty('uptime');
    });
  });
});
