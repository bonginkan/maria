/**
 * Command Testing Framework
 * Phase 1 Track B: Automated testing with mock dependencies
 * 
 * Provides unified testing interface for all slash commands
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { 
  CommandReadinessContract, 
  CommandTestResult, 
  CommandStatus,
  TestOutcome,
  TestCategory,
  TestEnvironment,
  DEFAULT_READY_CONTRACT,
  isCommandResultV2
} from '../types/CommandReadiness';
import { MockDIHelper } from './MockDIHelper';

export interface TestOptions {
  mode: 'tty' | 'non-tty' | 'pipe' | 'ci';
  timeout?: number;
  env?: Record<string, string>;
  input?: string;
  mockDependencies?: boolean;
}

export interface TestResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
  timedOut: boolean;
  crashed: boolean;
  output?: any;  // Parsed output if JSON
}

export class CommandTester {
  private projectRoot: string;
  private cliPath: string;
  private mockDI: MockDIHelper;
  private testResults: Map<string, CommandTestResult> = new Map();

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
    this.cliPath = path.join(projectRoot, 'dist', 'cli.cjs');
    this.mockDI = MockDIHelper.setup();
  }

  /**
   * Run a command with specified options
   */
  async run(command: string, options: TestOptions = { mode: 'non-tty' }): Promise<TestResult> {
    const startTime = Date.now();
    const timeout = options.timeout || 10000;
    
    return new Promise<TestResult>((resolve) => {
      const env = this.setupEnvironment(options);
      const args = this.buildArgs(options);
      
      const child = spawn('node', [this.cliPath, ...args], {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false
      });

      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let crashed = false;

      // Timeout handler
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, timeout);

      // Collect output
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Handle process exit
      child.on('exit', (code, signal) => {
        clearTimeout(timer);
        const duration = Date.now() - startTime;
        
        if (signal) {
          crashed = true;
        }

        // Try to parse output as JSON
        let output;
        try {
          // Look for JSON in stdout
          const jsonMatch = stdout.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            output = JSON.parse(jsonMatch[0]);
          }
        } catch {
          // Not JSON, that's okay
        }

        resolve({
          command,
          exitCode: code || 0,
          stdout,
          stderr,
          duration,
          timedOut,
          crashed,
          output
        });
      });

      // Send command
      child.stdin.write(command + '\n');
      if (options.input) {
        child.stdin.write(options.input + '\n');
      }
      child.stdin.end();
    });
  }

  /**
   * Test a command against the READY contract
   */
  async testContract(command: string): Promise<CommandTestResult> {
    const testOutcomes: TestOutcome[] = [];
    const startTime = Date.now();
    
    // Test all execution modes
    const modes: TestOptions['mode'][] = ['tty', 'non-tty', 'pipe', 'ci'];
    const modeResults: Record<string, boolean> = {};
    
    for (const mode of modes) {
      const outcome = await this.testExecutionMode(command, mode);
      testOutcomes.push(outcome);
      modeResults[mode] = outcome.passed;
    }

    // Test performance
    const perfOutcome = await this.testPerformance(command);
    testOutcomes.push(perfOutcome);

    // Test output format
    const outputOutcome = await this.testOutputFormat(command);
    testOutcomes.push(outputOutcome);

    // Test error handling
    const errorOutcome = await this.testErrorHandling(command);
    testOutcomes.push(errorOutcome);

    // Test documentation
    const docOutcome = await this.testDocumentation(command);
    testOutcomes.push(docOutcome);

    // Determine overall status
    const status = this.determineStatus(testOutcomes);

    // Build contract from test results
    const contract: Partial<CommandReadinessContract> = {
      executionModes: {
        tty: modeResults['tty'] || false,
        nonTty: modeResults['non-tty'] || false,
        pipe: modeResults['pipe'] || false,
        ci: modeResults['ci'] || false
      },
      performance: {
        maxResponseTime: perfOutcome.details?.avgTime || 5000,
        timeout: 10000
      },
      output: {
        format: outputOutcome.details?.format || 'unknown',
        requiresInput: false,
        endReason: ['success', 'error', 'cancelled'],
        hasCleanOutput: outputOutcome.details?.cleanOutput || false
      }
    };

    const result: CommandTestResult = {
      command,
      status,
      contract,
      testsPassed: testOutcomes.filter(t => t.passed),
      testsFailed: testOutcomes.filter(t => !t.passed && t.error),
      testsSkipped: testOutcomes.filter(t => !t.passed && !t.error),
      metadata: {
        testedAt: new Date().toISOString(),
        duration: Date.now() - startTime,
        environment: this.getCurrentEnvironment()
      }
    };

    this.testResults.set(command, result);
    return result;
  }

  /**
   * Test execution in a specific mode
   */
  private async testExecutionMode(command: string, mode: TestOptions['mode']): Promise<TestOutcome> {
    const startTime = Date.now();
    
    try {
      const result = await this.run(command, { mode, timeout: 5000 });
      
      return {
        test: `Execution in ${mode} mode`,
        category: 'mode-compatibility',
        passed: result.exitCode === 0 && !result.crashed && !result.timedOut,
        duration: Date.now() - startTime,
        details: {
          exitCode: result.exitCode,
          crashed: result.crashed,
          timedOut: result.timedOut
        }
      };
    } catch (error) {
      return {
        test: `Execution in ${mode} mode`,
        category: 'mode-compatibility',
        passed: false,
        duration: Date.now() - startTime,
        error: String(error)
      };
    }
  }

  /**
   * Test command performance
   */
  private async testPerformance(command: string): Promise<TestOutcome> {
    const iterations = 3;
    const times: number[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const result = await this.run(command, { mode: 'non-tty', timeout: 5000 });
      times.push(result.duration);
    }
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const maxTime = Math.max(...times);
    
    return {
      test: 'Performance requirements',
      category: 'performance',
      passed: maxTime < DEFAULT_READY_CONTRACT.performance.maxResponseTime,
      duration: avgTime,
      details: {
        avgTime,
        maxTime,
        times
      }
    };
  }

  /**
   * Test output format compliance
   */
  private async testOutputFormat(command: string): Promise<TestOutcome> {
    const result = await this.run(command, { mode: 'non-tty' });
    
    // Check for CommandResultV2 format
    const isV2Format = result.output && isCommandResultV2(result.output);
    
    // Check for clean output (no UI decorations)
    const hasUIDecorations = /(\x1b\[|├|│|└|✓|✗|⚡|🔄|▶)/.test(result.stdout);
    const cleanOutput = !hasUIDecorations;
    
    return {
      test: 'Output format compliance',
      category: 'output',
      passed: isV2Format || (cleanOutput && result.exitCode === 0),
      duration: 0,
      details: {
        format: isV2Format ? 'CommandResultV2' : 'legacy',
        cleanOutput,
        hasUIDecorations
      }
    };
  }

  /**
   * Test error handling
   */
  private async testErrorHandling(command: string): Promise<TestOutcome> {
    // Test with invalid input
    const result = await this.run(`${command} --invalid-flag-12345`, { mode: 'non-tty' });
    
    // Should handle gracefully (not crash)
    const graceful = !result.crashed && result.exitCode !== 0;
    
    // Should provide informative error
    const informative = result.stderr.length > 0 || 
                       result.stdout.includes('error') || 
                       result.stdout.includes('Error');
    
    return {
      test: 'Error handling',
      category: 'error-handling',
      passed: graceful && informative,
      duration: result.duration,
      details: {
        gracefulFailure: graceful,
        informativeErrors: informative,
        errorMessage: result.stderr || result.stdout
      }
    };
  }

  /**
   * Test documentation availability
   */
  private async testDocumentation(command: string): Promise<TestOutcome> {
    // Test help flag
    const helpResult = await this.run(`${command} --help`, { mode: 'non-tty' });
    const hasHelp = helpResult.stdout.length > 50; // Reasonable help text
    
    // Check for usage info
    const hasUsage = helpResult.stdout.includes('Usage') || 
                    helpResult.stdout.includes('usage') ||
                    helpResult.stdout.includes(command);
    
    // Check for description
    const hasDescription = helpResult.stdout.length > 100;
    
    return {
      test: 'Documentation availability',
      category: 'documentation',
      passed: hasHelp && hasUsage,
      duration: helpResult.duration,
      details: {
        hasHelp,
        hasUsage,
        hasDescription,
        helpLength: helpResult.stdout.length
      }
    };
  }

  /**
   * Determine overall command status based on test outcomes
   */
  private determineStatus(outcomes: TestOutcome[]): CommandStatus {
    const passed = outcomes.filter(o => o.passed).length;
    const total = outcomes.length;
    const percentage = (passed / total) * 100;
    
    // Check for critical failures
    const criticalCategories: TestCategory[] = ['execution', 'error-handling'];
    const criticalFailures = outcomes.filter(o => 
      criticalCategories.includes(o.category) && !o.passed
    );
    
    if (criticalFailures.length > 0) {
      return CommandStatus.BROKEN;
    }
    
    // Check for dependency issues
    const depTest = outcomes.find(o => o.category === 'dependencies');
    if (depTest && !depTest.passed && depTest.error?.includes('missing')) {
      return CommandStatus.BLOCKED;
    }
    
    // Determine by pass percentage
    if (percentage >= 90) {
      return CommandStatus.READY;
    } else if (percentage >= 60) {
      return CommandStatus.PARTIAL;
    } else if (percentage >= 30) {
      return CommandStatus.EXPERIMENTAL;
    } else {
      return CommandStatus.BROKEN;
    }
  }

  /**
   * Setup environment for testing
   */
  private setupEnvironment(options: TestOptions): Record<string, string> {
    const baseEnv = { ...process.env };
    
    // Set mode-specific variables
    if (options.mode === 'non-tty' || options.mode === 'pipe') {
      baseEnv.TERM = 'dumb';
      baseEnv.CI = 'true';
      baseEnv.NO_COLOR = '1';
    }
    
    if (options.mode === 'ci') {
      baseEnv.CI = 'true';
      baseEnv.CONTINUOUS_INTEGRATION = 'true';
      baseEnv.GITHUB_ACTIONS = 'true';
    }
    
    // Apply mock dependencies if requested
    if (options.mockDependencies) {
      baseEnv.USE_MOCKS = 'true';
      baseEnv.MOCK_PROVIDERS = 'true';
    }
    
    // Merge custom environment
    return { ...baseEnv, ...options.env };
  }

  /**
   * Build command line arguments
   */
  private buildArgs(options: TestOptions): string[] {
    const args: string[] = [];
    
    if (options.mode === 'non-tty' || options.mode === 'pipe') {
      args.push('--no-interactive');
    }
    
    if (options.mode === 'ci') {
      args.push('--ci');
    }
    
    return args;
  }

  /**
   * Get current test environment details
   */
  private getCurrentEnvironment(): TestEnvironment {
    return {
      mode: process.stdout.isTTY ? 'tty' : 'non-tty',
      platform: process.platform,
      nodeVersion: process.version,
      cwd: process.cwd(),
      env: {
        CI: process.env.CI,
        NODE_ENV: process.env.NODE_ENV,
        TERM: process.env.TERM
      }
    };
  }

  /**
   * Export test results
   */
  async exportResults(outputPath: string): Promise<void> {
    const results = Array.from(this.testResults.values());
    const manifest = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      totalTested: results.length,
      results
    };
    
    const fs = await import('fs/promises');
    await fs.writeFile(outputPath, JSON.stringify(manifest, null, 2));
  }

  /**
   * Run contract tests for all commands
   */
  async testAll(commands: string[]): Promise<Map<string, CommandTestResult>> {
    console.log(`🧪 Testing ${commands.length} commands...`);
    
    for (const command of commands) {
      console.log(`  Testing ${command}...`);
      await this.testContract(command);
    }
    
    return this.testResults;
  }
}

export default CommandTester;