/**
 * Webhook Execution Executor
 * Handles webhook task execution
 */

import { Task, TaskExecutionResult } from '../../types/task';

export class WebhookExecutor {
  async execute(task: Task): Promise<TaskExecutionResult> {
    try {
      const { action, params } = task.payload;

      const method = action?.toUpperCase() || 'POST';
      if (['POST', 'GET', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        return this.handleWebhook(params, method);
      } else {
        return {
          success: false,
          error: `Unknown webhook method: ${action}`,
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Webhook execution failed',
      };
    }
  }

  private async handleWebhook(
    params: any,
    method: string
  ): Promise<TaskExecutionResult> {
    try {
      const { url, headers = {}, body, timeout = 30000 } = params;

      if (!url || typeof url !== 'string') {
        return {
          success: false,
          error: 'Missing or invalid URL',
        };
      }

      const startTime = Date.now();

      try {
        // Use dynamic import for fetch to ensure availability
        const fetchFn = typeof fetch !== 'undefined' ? fetch : (await import('node-fetch')).default;

        const options: RequestInit = {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
        };

        if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
          options.body = typeof body === 'string' ? body : JSON.stringify(body);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetchFn(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const contentType = response.headers.get('content-type');
        let responseData: any = null;

        if (contentType?.includes('application/json')) {
          responseData = await response.json();
        } else {
          responseData = await response.text();
        }

        const executionTime = Date.now() - startTime;

        if (response.ok) {
          return {
            success: true,
            data: {
              statusCode: response.status,
              statusText: response.statusText,
              response: responseData,
              executionTimeMs: executionTime,
              message: 'Webhook executed successfully',
            },
            executionTimeMs: executionTime,
          };
        } else {
          return {
            success: false,
            error: `HTTP ${response.status}: ${response.statusText}`,
            executionTimeMs: executionTime,
          };
        }
      } catch (error: any) {
        const executionTime = Date.now() - startTime;

        return {
          success: false,
          error: error.message || 'Webhook request failed',
          executionTimeMs: executionTime,
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to execute webhook',
      };
    }
  }
}
