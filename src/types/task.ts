/**
 * Task Types and Interfaces for ORBIT TaskQueue System
 * Phase 2: Task Delegation & Execution
 */

// Task Status enumeration
export type TaskStatus = 'QUEUED' | 'EXECUTING' | 'COMPLETED' | 'FAILED' | 'TIMEOUT';

// Event types for task lifecycle
export type TaskEventType = 'delegated' | 'started' | 'progress' | 'completed' | 'failed';

// Supported task types
export type TaskType = 'file_write' | 'file_read' | 'sql_execute' | 'shell' | 'webhook' | 'deployment' | string;

// Priority levels
export type TaskPriority = 0 | 1 | 2 | 3;

/**
 * Core Task Interface
 * Represents a task in the task queue
 */
export interface Task {
  id: string;
  delegated_by: string;
  assigned_to: string;
  task_type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  payload: TaskPayload;
  result?: Record<string, any>;
  error_message?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  timeout_seconds: number;
  retry_count: number;
  max_retries: number;
  updated_at?: string;
}

/**
 * Task Payload
 * Contains the action and parameters for task execution
 */
export interface TaskPayload {
  action: string;
  params: Record<string, any>;
}

/**
 * Task Event
 * Audit trail for task lifecycle events
 */
export interface TaskEvent {
  id?: string;
  task_id: string;
  event_type: TaskEventType;
  agent_name: string;
  event_data: Record<string, any>;
  created_at?: string;
}

/**
 * Task Execution Result
 * Returned after task execution
 */
export interface TaskExecutionResult {
  success: boolean;
  data?: Record<string, any>;
  error?: string;
  executionTimeMs?: number;
}

/**
 * Task Executor Function Type
 * Signature for task executor implementations
 */
export type TaskExecutor = (
  task: Task,
  onProgress: (status: TaskStatus, data?: Record<string, any>) => Promise<void>
) => Promise<TaskExecutionResult>;

/**
 * Task Queue Configuration
 */
export interface TaskQueueConfig {
  pollIntervalMs?: number;
  maxConcurrentTasks?: number;
  agentName?: string;
  enableRealtime?: boolean;
}

/**
 * Task Queue Statistics
 */
export interface TaskQueueStats {
  totalProcessed: number;
  totalFailed: number;
  totalSucceeded: number;
  currentLoad: number;
  averageExecutionTimeMs: number;
  uptime: number;
}

/**
 * File Write Task Payload
 */
export interface FileWritePayload extends TaskPayload {
  action: 'write';
  params: {
    path: string;
    content: string;
    encoding?: 'utf-8' | 'binary' | string;
    createDirectories?: boolean;
  };
}

/**
 * File Read Task Payload
 */
export interface FileReadPayload extends TaskPayload {
  action: 'read';
  params: {
    path: string;
    encoding?: 'utf-8' | 'binary' | string;
  };
}

/**
 * SQL Execute Task Payload
 */
export interface SqlExecutePayload extends TaskPayload {
  action: 'exec' | 'query';
  params: {
    sql: string;
    values?: any[];
    returnData?: boolean;
  };
}

/**
 * Shell Command Task Payload
 */
export interface ShellPayload extends TaskPayload {
  action: 'exec';
  params: {
    cmd: string;
    cwd?: string;
    timeout?: number;
    env?: Record<string, string>;
  };
}

/**
 * Webhook Task Payload
 */
export interface WebhookPayload extends TaskPayload {
  action: 'post' | 'get' | 'put' | 'delete';
  params: {
    url: string;
    method?: 'POST' | 'GET' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    body?: Record<string, any>;
    timeout?: number;
  };
}

/**
 * Deployment Task Payload
 */
export interface DeploymentPayload extends TaskPayload {
  action: 'deploy';
  params: {
    service: 'vercel' | 'github' | 'heroku';
    repository?: string;
    branch?: string;
    environment?: string;
  };
}
