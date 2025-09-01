/**
 * Batch Service Interfaces
 * Circular dependency resolution for batch-execution ⟷ slash-command-handler
 */

export interface IBatchService {
  run(plan: string[]): Promise<BatchResult>;
}

export interface BatchResult {
  success: boolean;
  results: Array<{
    command: string;
    success: boolean;
    message?: string;
  }>;
}
