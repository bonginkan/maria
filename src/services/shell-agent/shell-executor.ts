import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ShellPlan, ShellStep, ShellStepResult, SECURITY_LIMITS } from './shell-plan.js';
import { 
  assertSafePath, 
  safeGlob, 
  assertNoShellMeta, 
  assertArgsBudget,
  _assertResourceBudget,
  assertNoForbiddenTokens,
  SANDBOX_CONFIG 
} from './sandbox.js';

/**
 * Execution options for shell operations
 */
export interface ExecOptions {
  dryRun?: boolean;          // Preview mode without actual changes
  enableEdit?: boolean;      // Allow patch operations (Phase B+)
  autoApprove?: boolean;     // Skip interactive approval for patches
  timeLimit?: number;        // Custom execution timeout
}

/**
 * Execution result containing success status and output
 */
export interface ExecResult {
  success: boolean;
  results: ShellStepResult[];
  totalExecutionTime: number;
  formatted: string;         // Human-readable output
  metadata: {
    timestamp: string;
    securityLevel: 'safe' | 'moderate' | 'restricted';
    resourceUsage: {
      filesRead: number;
      bytesProcessed: number;
      operationsExecuted: number;
    };
  };
}

/**
 * Secure shell executor for read-only operations
 * Implements multi-layer security with strict sandboxing
 */
export class ShellExecutor {
  private workspaceRoot: string;
  private executionTimeLimit: number;

  constructor(options: { workspaceRoot: string; timeLimit?: number }) {
    this.workspaceRoot = options.workspaceRoot;
    this.executionTimeLimit = options.timeLimit ?? SANDBOX_CONFIG.EXECUTION_TIMEOUT;
  }

  /**
   * Execute a complete shell plan with security validation
   */
  async execute(plan: ShellPlan, _opts: ExecOptions = {}): Promise<ExecResult> {
    const startTime = Date.now();
    const results: ShellStepResult[] = [];
    const resourceUsage = { filesRead: 0, bytesProcessed: 0, operationsExecuted: 0 };

    // Pre-execution validation
    try {
      await this.validatePlan(plan);
    } catch (error) {
      return {
        success: false,
        results,
        totalExecutionTime: Date.now() - startTime,
        formatted: `❌ Plan validation failed: ${(error as Error).message}`,
        metadata: {
          timestamp: new Date().toISOString(),
          securityLevel: 'restricted',
          resourceUsage
        }
      };
    }

    // Execute each step with timeout protection
    for (const step of plan.steps) {
      const stepStartTime = Date.now();
      
      try {
        // Individual step timeout
        const result = await Promise.race([
          this.executeStep(step),
          this.createTimeoutPromise(this.executionTimeLimit)
        ]);

        const executionTime = Date.now() - stepStartTime;
        resourceUsage.operationsExecuted++;
        resourceUsage.bytesProcessed += result.outputSizeBytes;
        resourceUsage.filesRead += result.filesRead || 1;
        
        results.push({
          step,
          success: true,
          output: result.output,
          executionTimeMs: executionTime,
          outputSizeBytes: result.outputSizeBytes
        });

      } catch (innerError) {
        const executionTime = Date.now() - stepStartTime;
        
        results.push({
          step,
          success: false,
          error: (error as Error).message,
          executionTimeMs: executionTime,
          outputSizeBytes: 0
        });
        
        // Stop execution on first error for safety
        return {
          success: false,
          results,
          totalExecutionTime: Date.now() - startTime,
          formatted: this.formatResults(results, false, resourceUsage),
          metadata: {
            timestamp: new Date().toISOString(),
            securityLevel: 'restricted',
            resourceUsage
          }
        };
      }
    }

    return {
      success: true,
      results,
      totalExecutionTime: Date.now() - startTime,
      formatted: this.formatResults(results, true, resourceUsage),
      metadata: {
        timestamp: new Date().toISOString(),
        securityLevel: 'safe',
        resourceUsage
      }
    };
  }

  /**
   * Execute individual step with operation-specific logic
   */
  private async executeStep(step: ShellStep): Promise<{ output: string; outputSizeBytes: number; filesRead?: number }> {
    // Validate step arguments
    assertArgsBudget(step.args, { 
      maxArgs: SECURITY_LIMITS.MAX_ARGS_PER_STEP,
      maxLen: SECURITY_LIMITS.MAX_ARG_LENGTH 
    });

    // Security checks for all arguments
    for (const arg of step.args) {
      assertNoShellMeta(arg);
      assertNoForbiddenTokens(arg);
    }

    switch (step.op) {
      case 'read':
        return await this.executeRead(step);
      case 'search':
        return await this.executeSearch(step);
      default:
        throw new Error(`Operation '${step.op}' not supported in read-only mode`);
    }
  }

  /**
   * Execute read operation - safe file content reading
   */
  private async executeRead(step: ShellStep): Promise<{ output: string; outputSizeBytes: number; filesRead: number }> {
    if (step.args.length === 0) {
      throw new Error('Read operation requires at least one path argument');
    }

    const targetPath = step.args[0];
    const previewLimit = step.previewLimit ?? SANDBOX_CONFIG.MAX_PREVIEW_SIZE;
    
    // Path safety validation
    const { abs } = await assertSafePath(this.workspaceRoot, targetPath);
    
    // Check if it's a directory or file
    const stats = await fs.stat(abs);
    
    if (stats.isDirectory()) {
      return await this.readDirectory(abs, previewLimit);
    } else {
      return await this.readFile(abs, previewLimit);
    }
  }

  /**
   * Execute search operation - safe pattern matching
   */
  private async executeSearch(step: ShellStep): Promise<{ output: string; outputSizeBytes: number; filesRead: number }> {
    if (step.args.length < 2) {
      throw new Error('Search operation requires pattern and path arguments');
    }

    const [pattern, searchPath] = step.args;
    const previewLimit = step.previewLimit ?? SANDBOX_CONFIG.MAX_PREVIEW_SIZE;
    
    // Validate search pattern
    assertNoShellMeta(pattern);
    
    // Path safety validation
    const { abs } = await assertSafePath(this.workspaceRoot, searchPath);
    
    return await this.searchInPath(abs, pattern, previewLimit);
  }

  /**
   * Safe directory listing
   */
  private async readDirectory(dirPath: string, limit: number): Promise<{ output: string; outputSizeBytes: number; filesRead: number }> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      // Apply file count limits
      if (entries.length > SANDBOX_CONFIG.MAX_FILE_MATCHES) {
        throw new Error(`Directory has too many entries: ${entries.length}`);
      }

      const lines: string[] = [];
      let totalSize = 0;

      for (const entry of entries.slice(0, 200)) { // Hard limit for safety
        const type = entry.isDirectory() ? 'DIR' : 'FILE';
        const _line = `${type.padEnd(4)} ${entry.name}`;
        lines.push(_line);
        
        totalSize += _line.length;
        if (totalSize > limit) {
          lines.push('... (output truncated)');
          break;
        }
      }

      const output = lines.join('\n');
      return { 
        output, 
        outputSizeBytes: Buffer.byteLength(output, 'utf-8'),
        filesRead: 1
      };
    } catch (error) {
      throw new Error(`Failed to read directory: ${(error as Error).message}`);
    }
  }

  /**
   * Safe file reading with size limits
   */
  private async readFile(_filePath: string, limit: number): Promise<{ output: string; outputSizeBytes: number; filesRead: number }> {
    try {
      const stats = await fs.stat(_filePath);
      
      // File size validation
      if (stats.size > SANDBOX_CONFIG.MAX_FILE_SIZE) {
        throw new Error(`File too large: ${stats.size} bytes`);
      }

      // Read file content with encoding detection
      let content: string;
      try {
        content = await fs.readFile(_filePath, 'utf-8');
      } catch (innerError) {
        throw new Error(`Failed to read file: ${(innerError as Error).message}`);
      }
      
      // Truncate content if too large
      if (content.length > limit) {
        content = content.slice(0, limit) + '\n... (truncated)';
      }
      
      return {
        output: content,
        outputSizeBytes: Buffer.byteLength(content, 'utf-8'),
        filesRead: 1
      };
    } catch (error) {
      throw new Error(`Failed to read file: ${(error as Error).message}`);
    }
  }

  /**
   * Safe pattern search in files
   */
  private async searchPattern(pattern: string, searchPath: string): Promise<string> {
    try {
      const stats = await fs.stat(searchPath);
      
      if (stats.isDirectory()) {
        // Search in directory using glob
        const files = await safeGlob('**/*', searchPath, {
          maxMatches: SANDBOX_CONFIG.MAX_FILE_MATCHES
        });
        
        const results: string[] = [];
        let totalSize = 0;
        let filesRead = 0;
        
        for (const file of files.slice(0, 50)) { // Limit files searched
          try {
            const fullPath = path.join(searchPath, file);
            const content = await fs.readFile(fullPath, 'utf-8');
            filesRead++;
            
            // Simple pattern matching (no regex for security)
            const lines = content.split('\n');
            for (let i = 0; i < lines.length && totalSize < limit; i++) {
              if (lines[i].includes(pattern)) {
                const result = `${file}:${i + 1}: ${lines[i].trim()}`;
                results.push(result);
                totalSize += result.length;
              }
            }
          } catch {
            // Skip files that can't be read
            continue;
          }
          
          if (totalSize > limit) break;
        }
        
        if (totalSize > limit) {
          results.push('... (search results truncated)');
        }
        
        const output = results.join('\n');
        return { 
          output, 
          outputSizeBytes: Buffer.byteLength(output, 'utf-8'),
          filesRead
        };
      } else {
        // Search in single file
        const content = await fs.readFile(searchPath, 'utf-8');
        const lines = content.split('\n');
        const matches: string[] = [];
        let totalSize = 0;
        
        for (let i = 0; i < lines.length && totalSize < limit; i++) {
          if (lines[i].includes(pattern)) {
            const result = `${i + 1}: ${lines[i].trim()}`;
            matches.push(result);
            totalSize += result.length;
          }
        }
        
        const output = matches.join('\n');
        return { 
          output, 
          outputSizeBytes: Buffer.byteLength(output, 'utf-8'),
          filesRead: 1
        };
      }
    } catch (error) {
      throw new Error(`Search failed: ${(error as Error).message}`);
    }
  }

  /**
   * Validate complete plan before execution
   */
  private async validatePlan(plan: ShellPlan): Promise<void> {
    // Enforce read-only mode for Phase A
    if (!plan.safety.readOnly) {
      throw new Error('Only read-only operations are allowed in Phase A');
    }

    // Validate step count
    if (plan.steps.length > SECURITY_LIMITS.MAX_STEPS) {
      throw new Error(`Too many steps: ${plan.steps.length} (max ${SECURITY_LIMITS.MAX_STEPS})`);
    }

    // Validate preview limits
    const totalPreview = plan.steps.reduce((sum, step) => sum + (step.previewLimit ?? 0), 0);
    if (totalPreview > SECURITY_LIMITS.MAX_PREVIEW_SIZE) {
      throw new Error(`Total preview size too large: ${totalPreview} bytes`);
    }

    // Validate all paths referenced in the plan
    const allPaths = new Set<string>();
    for (const step of plan.steps) {
      if (step.op === 'read' && step.args.length > 0) {
        allPaths.add(step.args[0]);
      }
      if (step.op === 'search' && step.args.length > 1) {
        allPaths.add(step.args[1]);
      }
    }

    // Validate each unique path
    for (const p of allPaths) {
      await assertSafePath(this.workspaceRoot, p);
    }
  }

  /**
   * Create timeout promise for step execution
   */
  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Step execution timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  /**
   * Format execution results for human consumption
   */
  private formatResults(
    results: ShellStepResult[], 
    success: boolean, 
    resourceUsage: { filesRead: number; bytesProcessed: number; operationsExecuted: number }
  ): string {
    const lines: string[] = [];
    
    if (success) {
      lines.push(`✅ Completed ${results.length} operations successfully`);
    } else {
      lines.push(`❌ Operation failed after ${results.filter(r => r.success).length}/${results.length} steps`);
    }
    
    lines.push(`📊 Resources: ${resourceUsage.filesRead} files, ${resourceUsage.bytesProcessed} bytes, ${resourceUsage.operationsExecuted} ops`);
    
    // Show outputs from successful steps
    for (const [i, result] of results.entries()) {
      if (result.success && result.output) {
        lines.push(`\n📄 Step ${i + 1} (${result.step.op}):`);
        
        // Truncate long outputs
        const output = result.output.length > 500 
          ? result.output.slice(0, 500) + '\n... (truncated)'
          : result.output;
        
        lines.push(output);
      } else if (!result.success) {
        lines.push(`\n❌ Step ${i + 1} (${result.step.op}): ${result.error}`);
      }
    }
    
    return lines.join('\n');
  }
}

/**
 * Factory function to create executor with validation
 */
export function createSecureExecutor(workspaceRoot: string): ShellExecutor {
  if (!workspaceRoot || typeof workspaceRoot !== 'string') {
    throw new Error('Valid workspace root is required');
  }

  // Resolve to absolute path
  const absoluteRoot = path.resolve(workspaceRoot);
  
  return new ShellExecutor({
    workspaceRoot: absoluteRoot,
    timeLimit: SANDBOX_CONFIG.EXECUTION_TIMEOUT
  });
}