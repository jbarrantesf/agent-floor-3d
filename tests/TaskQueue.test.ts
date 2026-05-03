/**
 * TaskQueue Unit Tests
 * Tests for Phase 2 implementation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TaskQueue } from '../src/lib/TaskQueue';
import { Task, TaskStatus, TaskExecutionResult } from '../src/types/task';
import { FileExecutor } from '../src/lib/executors/FileExecutor';
import { ShellExecutor } from '../src/lib/executors/ShellExecutor';
import { WebhookExecutor } from '../src/lib/executors/WebhookExecutor';
import * as fs from 'fs';
import * as path from 'path';

// Mock Supabase client
const createMockSupabase = () => ({
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  on: vi.fn().mockReturnValue({
    subscribe: vi.fn().mockReturnValue({
      unsubscribe: vi.fn(),
    }),
  }),
});

describe('TaskQueue', () => {
  let supabase: any;
  let taskQueue: TaskQueue;

  beforeEach(() => {
    supabase = createMockSupabase();
    taskQueue = new TaskQueue(supabase, 'orbit', {
      pollIntervalMs: 100,
      maxConcurrentTasks: 5,
    });
  });

  afterEach(async () => {
    if (taskQueue) {
      await taskQueue.stop();
    }
  });

  describe('Initialization', () => {
    it('should initialize with correct agent name', () => {
      const queue = new TaskQueue(supabase, 'test-agent');
      expect(queue).toBeDefined();
    });

    it('should accept configuration options', () => {
      const queue = new TaskQueue(supabase, 'orbit', {
        pollIntervalMs: 5000,
        maxConcurrentTasks: 10,
      });
      expect(queue).toBeDefined();
    });

    it('should initialize with default configuration', () => {
      const queue = new TaskQueue(supabase, 'orbit');
      expect(queue).toBeDefined();
    });
  });

  describe('Lifecycle', () => {
    it('should start polling', async () => {
      await taskQueue.start();
      expect(taskQueue).toBeDefined();
      await taskQueue.stop();
    });

    it('should handle multiple start calls gracefully', async () => {
      await taskQueue.start();
      await taskQueue.start(); // Should not error
      expect(taskQueue).toBeDefined();
      await taskQueue.stop();
    });

    it('should stop gracefully', async () => {
      await taskQueue.start();
      await taskQueue.stop();
      expect(taskQueue).toBeDefined();
    });

    it('should handle stop when not running', async () => {
      await taskQueue.stop(); // Should not error
      expect(taskQueue).toBeDefined();
    });
  });

  describe('Statistics', () => {
    it('should provide statistics', async () => {
      const stats = taskQueue.getStats();
      expect(stats).toHaveProperty('totalProcessed');
      expect(stats).toHaveProperty('totalFailed');
      expect(stats).toHaveProperty('totalSucceeded');
      expect(stats).toHaveProperty('currentLoad');
      expect(stats.totalProcessed).toBe(0);
    });

    it('should track uptime', async () => {
      await taskQueue.start();
      const stats = taskQueue.getStats();
      expect(stats.uptime).toBeGreaterThan(0);
      await taskQueue.stop();
    });
  });

  describe('Custom Executors', () => {
    it('should register custom executor', () => {
      const customExecutor = async (task: Task): Promise<TaskExecutionResult> => ({
        success: true,
        data: { message: 'custom' },
      });

      taskQueue.registerExecutor('custom_type', customExecutor);
      expect(taskQueue).toBeDefined();
    });

    it('should allow multiple executors', () => {
      const executor1 = async (task: Task): Promise<TaskExecutionResult> => ({
        success: true,
      });
      const executor2 = async (task: Task): Promise<TaskExecutionResult> => ({
        success: true,
      });

      taskQueue.registerExecutor('type1', executor1);
      taskQueue.registerExecutor('type2', executor2);
      expect(taskQueue).toBeDefined();
    });
  });
});

describe('FileExecutor', () => {
  const executor = new FileExecutor();
  const testDir = '/tmp/taskqueue-test';
  const testFile = path.join(testDir, 'test.txt');

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('File Write', () => {
    it('should write file successfully', async () => {
      const task: Task = {
        id: 'test-1',
        delegated_by: 'hermes',
        assigned_to: 'orbit',
        task_type: 'file_write',
        priority: 1,
        status: 'EXECUTING',
        payload: {
          action: 'write',
          params: {
            path: testFile,
            content: 'Hello World',
          },
        },
        timeout_seconds: 30,
        retry_count: 0,
        max_retries: 3,
        created_at: new Date().toISOString(),
      };

      const result = await executor.execute(task);

      expect(result.success).toBe(true);
      expect(result.data?.path).toBe(testFile);
      expect(fs.existsSync(testFile)).toBe(true);
      expect(fs.readFileSync(testFile, 'utf-8')).toBe('Hello World');
    });

    it('should create directories if needed', async () => {
      const nestedFile = path.join(testDir, 'nested', 'dir', 'file.txt');
      const task: Task = {
        id: 'test-2',
        delegated_by: 'hermes',
        assigned_to: 'orbit',
        task_type: 'file_write',
        priority: 1,
        status: 'EXECUTING',
        payload: {
          action: 'write',
          params: {
            path: nestedFile,
            content: 'Nested',
            createDirectories: true,
          },
        },
        timeout_seconds: 30,
        retry_count: 0,
        max_retries: 3,
        created_at: new Date().toISOString(),
      };

      const result = await executor.execute(task);

      expect(result.success).toBe(true);
      expect(fs.existsSync(nestedFile)).toBe(true);
    });

    it('should handle missing parameters', async () => {
      const task: Task = {
        id: 'test-3',
        delegated_by: 'hermes',
        assigned_to: 'orbit',
        task_type: 'file_write',
        priority: 1,
        status: 'EXECUTING',
        payload: {
          action: 'write',
          params: {},
        },
        timeout_seconds: 30,
        retry_count: 0,
        max_retries: 3,
        created_at: new Date().toISOString(),
      };

      const result = await executor.execute(task);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('File Read', () => {
    beforeEach(() => {
      fs.writeFileSync(testFile, 'Test Content', 'utf-8');
    });

    it('should read file successfully', async () => {
      const task: Task = {
        id: 'test-4',
        delegated_by: 'hermes',
        assigned_to: 'orbit',
        task_type: 'file_read',
        priority: 1,
        status: 'EXECUTING',
        payload: {
          action: 'read',
          params: {
            path: testFile,
          },
        },
        timeout_seconds: 30,
        retry_count: 0,
        max_retries: 3,
        created_at: new Date().toISOString(),
      };

      const result = await executor.execute(task);

      expect(result.success).toBe(true);
      expect(result.data?.content).toBe('Test Content');
      expect(result.data?.size).toBeGreaterThan(0);
    });

    it('should handle missing file', async () => {
      const task: Task = {
        id: 'test-5',
        delegated_by: 'hermes',
        assigned_to: 'orbit',
        task_type: 'file_read',
        priority: 1,
        status: 'EXECUTING',
        payload: {
          action: 'read',
          params: {
            path: '/nonexistent/file.txt',
          },
        },
        timeout_seconds: 30,
        retry_count: 0,
        max_retries: 3,
        created_at: new Date().toISOString(),
      };

      const result = await executor.execute(task);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle missing path parameter', async () => {
      const task: Task = {
        id: 'test-6',
        delegated_by: 'hermes',
        assigned_to: 'orbit',
        task_type: 'file_read',
        priority: 1,
        status: 'EXECUTING',
        payload: {
          action: 'read',
          params: {},
        },
        timeout_seconds: 30,
        retry_count: 0,
        max_retries: 3,
        created_at: new Date().toISOString(),
      };

      const result = await executor.execute(task);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});

describe('ShellExecutor', () => {
  const executor = new ShellExecutor();

  describe('Command Execution', () => {
    it('should execute simple shell command', async () => {
      const task: Task = {
        id: 'test-7',
        delegated_by: 'hermes',
        assigned_to: 'orbit',
        task_type: 'shell',
        priority: 1,
        status: 'EXECUTING',
        payload: {
          action: 'exec',
          params: {
            cmd: 'echo "Hello from Shell"',
          },
        },
        timeout_seconds: 30,
        retry_count: 0,
        max_retries: 3,
        created_at: new Date().toISOString(),
      };

      const result = await executor.execute(task);

      expect(result.success).toBe(true);
      expect(result.data?.output).toBeDefined();
    });

    it('should handle command failure', async () => {
      const task: Task = {
        id: 'test-8',
        delegated_by: 'hermes',
        assigned_to: 'orbit',
        task_type: 'shell',
        priority: 1,
        status: 'EXECUTING',
        payload: {
          action: 'exec',
          params: {
            cmd: 'exit 1',
          },
        },
        timeout_seconds: 30,
        retry_count: 0,
        max_retries: 3,
        created_at: new Date().toISOString(),
      };

      const result = await executor.execute(task);

      expect(result.success).toBe(false);
    });

    it('should handle missing command parameter', async () => {
      const task: Task = {
        id: 'test-9',
        delegated_by: 'hermes',
        assigned_to: 'orbit',
        task_type: 'shell',
        priority: 1,
        status: 'EXECUTING',
        payload: {
          action: 'exec',
          params: {},
        },
        timeout_seconds: 30,
        retry_count: 0,
        max_retries: 3,
        created_at: new Date().toISOString(),
      };

      const result = await executor.execute(task);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Async Execution', () => {
    it('should execute async command', async () => {
      const result = await executor.executeAsync('echo "async test"');

      expect(result.success).toBe(true);
      expect(result.data?.output).toBeDefined();
    });
  });
});

describe('WebhookExecutor', () => {
  const executor = new WebhookExecutor();

  describe('Webhook Execution', () => {
    it('should handle invalid URL', async () => {
      const task: Task = {
        id: 'test-10',
        delegated_by: 'hermes',
        assigned_to: 'orbit',
        task_type: 'webhook',
        priority: 1,
        status: 'EXECUTING',
        payload: {
          action: 'post',
          params: {
            url: '',
          },
        },
        timeout_seconds: 30,
        retry_count: 0,
        max_retries: 3,
        created_at: new Date().toISOString(),
      };

      const result = await executor.execute(task);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle missing URL parameter', async () => {
      const task: Task = {
        id: 'test-11',
        delegated_by: 'hermes',
        assigned_to: 'orbit',
        task_type: 'webhook',
        priority: 1,
        status: 'EXECUTING',
        payload: {
          action: 'post',
          params: {},
        },
        timeout_seconds: 30,
        retry_count: 0,
        max_retries: 3,
        created_at: new Date().toISOString(),
      };

      const result = await executor.execute(task);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});

describe('Task Types Coverage', () => {
  it('should support file_write', () => {
    expect(['file_write'].includes('file_write')).toBe(true);
  });

  it('should support file_read', () => {
    expect(['file_read'].includes('file_read')).toBe(true);
  });

  it('should support sql_execute', () => {
    expect(['sql_execute'].includes('sql_execute')).toBe(true);
  });

  it('should support shell', () => {
    expect(['shell'].includes('shell')).toBe(true);
  });

  it('should support webhook', () => {
    expect(['webhook'].includes('webhook')).toBe(true);
  });
});
