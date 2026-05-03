/**
 * Shell Command Executor
 * Handles shell task execution
 */

import { Task, TaskExecutionResult } from '../../types/task';
import { execSync, spawn } from 'child_process';

export class ShellExecutor {
  async execute(task: Task): Promise<TaskExecutionResult> {
    try {
      const { action, params } = task.payload;

      if (action === 'exec') {
        return this.handleExec(params);
      } else {
        return {
          success: false,
          error: `Unknown shell action: ${action}`,
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Shell execution failed',
      };
    }
  }

  private async handleExec(params: any): Promise<TaskExecutionResult> {
    try {
      const { cmd, cwd, timeout = 30000, env = {} } = params;

      if (!cmd || typeof cmd !== 'string') {
        return {
          success: false,
          error: 'Missing or invalid command',
        };
      }

      const startTime = Date.now();
      const executionEnv = { ...process.env, ...env };

      try {
        const output = execSync(cmd, {
          cwd: cwd || process.cwd(),
          timeout,
          env: executionEnv,
          encoding: 'utf-8',
        });

        const executionTime = Date.now() - startTime;

        return {
          success: true,
          data: {
            command: cmd,
            output: output || '',
            exitCode: 0,
            executionTimeMs: executionTime,
            message: 'Command executed successfully',
          },
          executionTimeMs: executionTime,
        };
      } catch (error: any) {
        const executionTime = Date.now() - startTime;

        return {
          success: false,
          error: error.message || 'Command execution failed',
          executionTimeMs: executionTime,
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Shell execution failed',
      };
    }
  }

  /**
   * Execute shell command asynchronously with streaming output
   * Useful for long-running commands
   */
  async executeAsync(cmd: string, cwd?: string, timeout?: number): Promise<TaskExecutionResult> {
    return new Promise((resolve) => {
      try {
        const parts = cmd.split(' ');
        const command = parts[0];
        const args = parts.slice(1);

        const startTime = Date.now();
        let output = '';
        let errorOutput = '';

        const child = spawn(command, args, {
          cwd: cwd || process.cwd(),
          shell: true,
        });

        const timeoutHandle = timeout
          ? setTimeout(() => {
              child.kill();
              resolve({
                success: false,
                error: `Command timeout after ${timeout}ms`,
                executionTimeMs: Date.now() - startTime,
              });
            }, timeout)
          : null;

        child.stdout?.on('data', (data) => {
          output += data.toString();
        });

        child.stderr?.on('data', (data) => {
          errorOutput += data.toString();
        });

        child.on('close', (code) => {
          if (timeoutHandle) clearTimeout(timeoutHandle);

          const executionTime = Date.now() - startTime;

          if (code === 0) {
            resolve({
              success: true,
              data: {
                output,
                exitCode: code,
                executionTimeMs: executionTime,
              },
              executionTimeMs: executionTime,
            });
          } else {
            resolve({
              success: false,
              error: errorOutput || `Command failed with exit code ${code}`,
              executionTimeMs: executionTime,
            });
          }
        });
      } catch (error: any) {
        resolve({
          success: false,
          error: error.message || 'Failed to execute shell command',
        });
      }
    });
  }
}
