/**
 * Smart Executor
 * Intelligent command execution with monitoring
 */

import { executeWithIntelligence } from "./LinuxIntelligenceEngine";

export class SmartExecutor {
  async execute(command: string): Promise<any> {
    return executeWithIntelligence(command);
  }

  async executeWithRetry(
    _command: string,
    maxRetries: number = 3,
  ): Promise<any> {
    for (let i = 0; i < maxRetries; i++) {
      const _result = await executeWithIntelligence(_command);
      if (_result.success) return _result;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
    throw new Error(`Command failed after ${maxRetries} retries`);
  }
}
