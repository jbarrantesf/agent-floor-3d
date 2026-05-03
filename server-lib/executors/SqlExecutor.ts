/**
 * SQL Execution Executor
 * Handles sql_execute tasks
 */

import { Task, TaskExecutionResult } from '../../types/task';
import { SupabaseClient } from '@supabase/supabase-js';

export class SqlExecutor {
  constructor(private supabase: SupabaseClient) {}

  async execute(task: Task): Promise<TaskExecutionResult> {
    try {
      const { action, params } = task.payload;

      if (action === 'exec' || action === 'query') {
        return this.handleExec(params);
      } else {
        return {
          success: false,
          error: `Unknown SQL action: ${action}`,
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'SQL execution failed',
      };
    }
  }

  private async handleExec(params: any): Promise<TaskExecutionResult> {
    try {
      const { sql, values = [], returnData = false } = params;

      if (!sql || typeof sql !== 'string') {
        return {
          success: false,
          error: 'Missing or invalid SQL query',
        };
      }

      // Execute raw SQL
      const { data, error } = await this.supabase.rpc('execute_sql', {
        query: sql,
        values: values,
      }).catch(() => {
        // Fallback: try to execute using query method if RPC fails
        // This is a limitation - actual SQL execution would need a backend endpoint
        return {
          data: null,
          error: new Error('SQL execution requires backend support'),
        };
      });

      if (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }

      if (returnData && data) {
        return {
          success: true,
          data: {
            rowCount: Array.isArray(data) ? data.length : 1,
            rows: data,
            message: 'SQL executed successfully',
          },
        };
      }

      return {
        success: true,
        data: {
          message: 'SQL executed successfully',
          rowsAffected: 1,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to execute SQL',
      };
    }
  }
}
