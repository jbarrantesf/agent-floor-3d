/**
 * File Operations Executor
 * Handles file_write and file_read tasks
 */

import { Task, TaskExecutionResult } from '../../types/task';
import * as fs from 'fs';
import * as path from 'path';

export class FileExecutor {
  async execute(task: Task): Promise<TaskExecutionResult> {
    try {
      const { action, params } = task.payload;

      if (action === 'write') {
        return this.handleWrite(params);
      } else if (action === 'read') {
        return this.handleRead(params);
      } else {
        return {
          success: false,
          error: `Unknown file action: ${action}`,
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'File operation failed',
      };
    }
  }

  private async handleWrite(params: any): Promise<TaskExecutionResult> {
    try {
      const { path: filePath, content, encoding = 'utf-8', createDirectories = true } = params;

      if (!filePath || content === undefined) {
        return {
          success: false,
          error: 'Missing required parameters: path and content',
        };
      }

      // Create directories if needed
      if (createDirectories) {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      }

      // Write file
      fs.writeFileSync(filePath, content, encoding as BufferEncoding);

      return {
        success: true,
        data: {
          path: filePath,
          bytesWritten: Buffer.byteLength(content, encoding as BufferEncoding),
          message: 'File written successfully',
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to write file',
      };
    }
  }

  private async handleRead(params: any): Promise<TaskExecutionResult> {
    try {
      const { path: filePath, encoding = 'utf-8' } = params;

      if (!filePath) {
        return {
          success: false,
          error: 'Missing required parameter: path',
        };
      }

      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          error: `File not found: ${filePath}`,
        };
      }

      // Read file
      const content = fs.readFileSync(filePath, encoding as BufferEncoding);
      const stats = fs.statSync(filePath);

      return {
        success: true,
        data: {
          path: filePath,
          content,
          size: stats.size,
          encoding,
          message: 'File read successfully',
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to read file',
      };
    }
  }
}
