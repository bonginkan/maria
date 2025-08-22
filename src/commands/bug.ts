/**
 * Bug Command
 * Bug detection, analysis, and fixing assistance
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import prompts from 'prompts';
import { logger } from '../utils/logger.js';
import { DualMemoryEngine } from '../services/memory-system/dual-memory-engine.js';
import { MemoryCoordinator } from '../services/memory-system/memory-coordinator.js';

export const bugCommand = new Command('bug')
  .description('AI-powered bug detection and fixing')
  .option('-f, --file <path>', 'Analyze specific file for bugs')
  .option('-e, --error <message>', 'Analyze specific error message')
  .option('-l, --logs', 'Analyze recent logs for errors')
  .option('-t, --test', 'Run tests and analyze failures')
  .option('--fix', 'Attempt to auto-fix detected bugs')
  .option('--stack-trace <trace>', 'Analyze stack trace')
  .option('--recent', 'Analyze recent changes for potential bugs')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🐛 AI Bug Detector'));
      console.log(chalk.gray('Analyzing for potential bugs...\n'));

      const bugs: Bug[] = [];

      // Analyze based on options
      if (options.file) {
        // Analyze specific file
        const fileBugs = await analyzeFile(options.file);
        bugs.push(...fileBugs);
      } else if (options.error) {
        // Analyze error message
        const errorBugs = analyzeError(options.error);
        bugs.push(...errorBugs);
      } else if (options.logs) {
        // Analyze logs
        const logBugs = await analyzeLogs();
        bugs.push(...logBugs);
      } else if (options.test) {
        // Run tests and analyze failures
        const testBugs = await analyzeTests();
        bugs.push(...testBugs);
      } else if (options.stackTrace) {
        // Analyze stack trace
        const stackBugs = analyzeStackTrace(options.stackTrace);
        bugs.push(...stackBugs);
      } else if (options.recent) {
        // Analyze recent changes
        const recentBugs = await analyzeRecentChanges();
        bugs.push(...recentBugs);
      } else {
        // Default: scan project for common bugs
        const projectBugs = await scanProject();
        bugs.push(...projectBugs);
      }

      // Display results
      if (bugs.length === 0) {
        console.log(chalk.green('✅ No bugs detected!'));
        console.log(chalk.gray('Your code looks clean.'));
      } else {
        displayBugs(bugs);

        // Offer to fix bugs if --fix flag is set
        if (options.fix) {
          await attemptAutoFix(bugs);
        } else if (bugs.some((b) => b.autoFixAvailable)) {
          const { shouldFix } = await prompts({
            type: 'confirm',
            name: 'shouldFix',
            message: 'Auto-fixes are available. Would you like to apply them?',
            initial: false,
          });

          if (shouldFix) {
            await attemptAutoFix(bugs);
          }
        }
      }
    } catch (error: unknown) {
      console.error(chalk.red('Bug detection failed:'), error);
      process.exit(1);
    }
  });

interface Bug {
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  file?: string;
  line?: number;
  column?: number;
  message: string;
  description?: string;
  suggestion?: string;
  autoFixAvailable: boolean;
  autoFix?: () => Promise<void>;
}

// Initialize memory system (singleton pattern)
let memoryEngine: DualMemoryEngine | null = null;
let memoryCoordinator: MemoryCoordinator | null = null;

async function initializeMemory() {
  if (!memoryEngine) {
    try {
      memoryEngine = new DualMemoryEngine();
      memoryCoordinator = new MemoryCoordinator(memoryEngine);
      await memoryEngine.initialize();
    } catch (error) {
      logger.warn('Memory system not available for bug command');
    }
  }
  return { memoryEngine, memoryCoordinator };
}

async function analyzeFile(filePath: string): Promise<Bug[]> {
  const bugs: Bug[] = [];

  // Initialize memory system
  const { memoryEngine } = await initializeMemory();

  try {
    const absolutePath = path.resolve(filePath);
    const content = await fs.readFile(absolutePath, 'utf8');
    const ext = path.extname(filePath);
    const lines = content.split('\n');

    // Check memory for previous bug patterns in similar files
    if (memoryEngine) {
      try {
        const previousBugs = await memoryEngine.recall({
          query: `bug patterns for ${ext} files`,
          type: 'bug_analysis',
          limit: 5,
        });

        if (previousBugs.length > 0) {
          logger.debug(`Found ${previousBugs.length} previous bug patterns in memory`);
        }
      } catch (error) {
        logger.debug('Memory recall failed:', error);
      }
    }

    // JavaScript/TypeScript specific bugs
    if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
      // Check for common bugs
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;

        // Null/undefined checks
        if (line && line.includes('.') && !line.includes('?.') && !line.includes('!.')) {
          const matches = line.match(/(\w+)\.(\w+)/g);
          if (matches) {
            matches.forEach((match) => {
              const firstPart = match.split('.')[0];
              if (
                firstPart &&
                !line.includes(`${firstPart}?`) &&
                !line.includes(`if (${firstPart}`) &&
                !line.includes(`${firstPart} &&`) &&
                !line.includes(`${firstPart} ||`)
              ) {
                bugs.push({
                  severity: 'medium',
                  type: 'null-reference',
                  file: filePath,
                  line: lineNum,
                  message: 'Potential null reference error',
                  description: `Object '${firstPart}' may be null or undefined`,
                  suggestion: 'Use optional chaining (?.) or add null check',
                  autoFixAvailable: true,
                  autoFix: async () => {
                    const fixed = line.replace(match, match.replace('.', '?.'));
                    lines[i] = fixed;
                    await fs.writeFile(absolutePath, lines.join('\n'));
                  },
                });
              }
            });
          }
        }

        // Array index access without bounds check
        if (line && line.match(/\[(\d+)\]/) && !line.includes('length')) {
          bugs.push({
            severity: 'low',
            type: 'array-bounds',
            file: filePath,
            line: lineNum,
            message: 'Array access without bounds check',
            suggestion: 'Check array length before accessing index',
            autoFixAvailable: false,
          });
        }

        // Async function without error handling
        if (
          line?.includes('async') &&
          line?.includes('=>') &&
          !content.includes('try') &&
          !content.includes('catch')
        ) {
          bugs.push({
            severity: 'medium',
            type: 'error-handling',
            file: filePath,
            line: lineNum,
            message: 'Async function without error handling',
            suggestion: 'Wrap async operations in try-catch',
            autoFixAvailable: false,
          });
        }

        // Memory leaks - event listeners without cleanup
        if (line?.includes('addEventListener') && !content.includes('removeEventListener')) {
          bugs.push({
            severity: 'medium',
            type: 'memory-leak',
            file: filePath,
            line: lineNum,
            message: 'Event listener without cleanup',
            description: 'Event listeners should be removed when no longer needed',
            suggestion: 'Add removeEventListener in cleanup/unmount',
            autoFixAvailable: false,
          });
        }

        // == instead of ===
        if (line?.includes('==') && !line?.includes('===') && !line?.includes('!==')) {
          bugs.push({
            severity: 'low',
            type: 'comparison',
            file: filePath,
            line: lineNum,
            message: 'Using == instead of ===',
            suggestion: 'Use strict equality (===) for comparisons',
            autoFixAvailable: true,
            autoFix: async () => {
              const fixed = line?.replace(/==/g, '===').replace(/!=/g, '!==') || '';
              lines[i] = fixed;
              await fs.writeFile(absolutePath, lines.join('\n'));
            },
          });
        }
      }
    }
  } catch (error: unknown) {
    logger.error(`Failed to analyze file ${filePath}:`, error);
  }

  return bugs;
}

function analyzeError(errorMessage: string): Bug[] {
  const bugs: Bug[] = [];

  // Common error patterns
  const patterns = [
    {
      pattern: /Cannot read prop(?:erty|erties) ['"]?(\w+)['"]? of (null|undefined)/i,
      type: 'null-reference',
      severity: 'high' as const,
      getMessage: (match: RegExpMatchArray) =>
        `Null reference: trying to access '${match[1]}' of ${match[2]}`,
      suggestion: 'Add null/undefined checks before accessing properties',
    },
    {
      pattern: /(\w+) is not defined/i,
      type: 'undefined-variable',
      severity: 'high' as const,
      getMessage: (match: RegExpMatchArray) => `Undefined variable: '${match[1]}'`,
      suggestion: 'Declare the variable or check for typos',
    },
    {
      pattern: /(\w+) is not a function/i,
      type: 'type-error',
      severity: 'high' as const,
      getMessage: (match: RegExpMatchArray) => `Type error: '${match[1]}' is not a function`,
      suggestion: 'Check the type of the variable before calling it',
    },
    {
      pattern: /Maximum call stack size exceeded/i,
      type: 'stack-overflow',
      severity: 'critical' as const,
      getMessage: () => 'Stack overflow: infinite recursion detected',
      suggestion: 'Check for infinite loops or recursive calls without base case',
    },
    {
      pattern: /out of memory/i,
      type: 'memory-error',
      severity: 'critical' as const,
      getMessage: () => 'Out of memory error',
      suggestion: 'Check for memory leaks or reduce memory usage',
    },
  ];

  for (const { pattern, type, severity, getMessage, suggestion } of patterns) {
    const match = errorMessage.match(pattern);
    if (match) {
      const bug = {
        severity,
        type,
        message: getMessage(match),
        description: errorMessage,
        suggestion,
        autoFixAvailable: false,
      };
      bugs.push(bug);

      // Store bug pattern in memory for future reference
      const { memoryEngine } = await initializeMemory();
      if (memoryEngine) {
        try {
          await memoryEngine.store({
            type: 'bug_pattern',
            pattern: type,
            severity,
            message: bug.message,
            suggestion,
            timestamp: new Date(),
            context: {
              errorMessage,
              detectedBy: 'error_analysis',
            },
          });
        } catch (error) {
          logger.debug('Failed to store bug in memory:', error);
        }
      }
    }
  }

  return bugs;
}

async function analyzeLogs(): Promise<Bug[]> {
  const bugs: Bug[] = [];

  try {
    // Check for common log files
    const logPaths = ['logs/error.log', 'logs/app.log', 'error.log', 'debug.log'];

    for (const logPath of logPaths) {
      try {
        const content = await fs.readFile(logPath, 'utf8');
        const lines = content.split('\n').slice(-100); // Last 100 lines

        for (const line of lines) {
          if (
            line.toLowerCase().includes('error') ||
            line.toLowerCase().includes('exception') ||
            line.toLowerCase().includes('failed')
          ) {
            // Extract error information
            const errorBugs = analyzeError(line);
            bugs.push(...errorBugs);
          }
        }
      } catch {
        // Log file doesn't exist, skip
      }
    }
  } catch (error: unknown) {
    logger.error('Failed to analyze logs:', error);
  }

  return bugs;
}

async function analyzeTests(): Promise<Bug[]> {
  const bugs: Bug[] = [];

  try {
    // Run tests and capture output
    console.log(chalk.gray('Running tests...'));
    const testOutput = execSync('npm test 2>&1', { encoding: 'utf8' });

    // Parse test output for failures
    const lines = testOutput.split('\n');
    let currentTest = '';

    for (const line of lines) {
      if (line.includes('FAIL')) {
        currentTest = line;
      } else if (line.includes('Error:') || line.includes('AssertionError')) {
        bugs.push({
          severity: 'high',
          type: 'test-failure',
          message: `Test failure: ${currentTest}`,
          description: line,
          suggestion: 'Fix the failing test or update test expectations',
          autoFixAvailable: false,
        });
      }
    }
  } catch (error: unknown) {
    // Tests failed to run
    const output = (error as { stdout?: string }).stdout || '';
    if (output) {
      const errorBugs = analyzeError(output);
      bugs.push(...errorBugs);
    }
  }

  return bugs;
}

function analyzeStackTrace(stackTrace: string): Bug[] {
  const bugs: Bug[] = [];
  const lines = stackTrace.split('\n');

  // Extract file and line information from stack trace
  const stackPattern = /at\s+.*?\s+\((.*?):(\d+):(\d+)\)/;

  for (const line of lines) {
    const match = line.match(stackPattern);
    if (match) {
      const [, file, lineNum, colNum] = match;

      bugs.push({
        severity: 'high',
        type: 'runtime-error',
        file: file?.replace('file://', '') || 'unknown',
        line: parseInt(lineNum || '0'),
        column: parseInt(colNum || '0'),
        message: 'Error location in stack trace',
        description: lines[0], // Usually the error message
        suggestion: 'Check this location for the error cause',
        autoFixAvailable: false,
      });

      break; // Only report the first user code location
    }
  }

  return bugs;
}

async function analyzeRecentChanges(): Promise<Bug[]> {
  const bugs: Bug[] = [];

  try {
    // Get recent changes
    const diff = execSync('git diff HEAD~1', { encoding: 'utf8' });
    const files = execSync('git diff --name-only HEAD~1', { encoding: 'utf8' })
      .split('\n')
      .filter((f) => f);

    // Analyze each changed file
    for (const file of files) {
      if (
        file.endsWith('.js') ||
        file.endsWith('.ts') ||
        file.endsWith('.jsx') ||
        file.endsWith('.tsx')
      ) {
        const fileBugs = await analyzeFile(file);
        bugs.push(...fileBugs);
      }
    }

    // Look for common bug patterns in diff
    if (diff.includes('TODO') || diff.includes('FIXME') || diff.includes('XXX')) {
      bugs.push({
        severity: 'low',
        type: 'todo',
        message: 'Unfinished code detected',
        description: 'Found TODO/FIXME comments in recent changes',
        suggestion: 'Complete the TODO items before committing',
        autoFixAvailable: false,
      });
    }
  } catch (error: unknown) {
    logger.error('Failed to analyze recent changes:', error);
  }

  return bugs;
}

async function scanProject(): Promise<Bug[]> {
  const bugs: Bug[] = [];

  console.log(chalk.gray('Scanning project for common bugs...'));

  try {
    // Find all JS/TS files
    const jsFiles = execSync(
      'find . -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" | grep -v node_modules | head -20',
      { encoding: 'utf8', shell: '/bin/sh' },
    )
      .split('\n')
      .filter((f) => f);

    // Analyze each file
    for (const file of jsFiles) {
      const fileBugs = await analyzeFile(file);
      bugs.push(...fileBugs);
    }
  } catch (error: unknown) {
    logger.error('Failed to scan project:', error);
  }

  return bugs;
}

function displayBugs(bugs: Bug[]): void {
  console.log(chalk.bold(`\n🐛 Found ${bugs.length} potential bug(s):\n`));

  // Group by severity
  const critical = bugs.filter((b) => b.severity === 'critical');
  const high = bugs.filter((b) => b.severity === 'high');
  const medium = bugs.filter((b) => b.severity === 'medium');
  const low = bugs.filter((b) => b.severity === 'low');

  if (critical.length > 0) {
    console.log(chalk.red.bold('🚨 Critical Issues:'));
    critical.forEach((bug) => displayBug(bug, chalk.red));
  }

  if (high.length > 0) {
    console.log(chalk.redBright.bold('\n⚠️  High Priority:'));
    high.forEach((bug) => displayBug(bug, chalk.redBright));
  }

  if (medium.length > 0) {
    console.log(chalk.yellow.bold('\n⚡ Medium Priority:'));
    medium.forEach((bug) => displayBug(bug, chalk.yellow));
  }

  if (low.length > 0) {
    console.log(chalk.blue.bold('\nℹ️  Low Priority:'));
    low.forEach((bug) => displayBug(bug, chalk.blue));
  }
}

function displayBug(bug: Bug, color: typeof chalk.red): void {
  console.log(color(`  • ${bug.message}`));

  if (bug.file) {
    let location = `    📍 ${bug.file}`;
    if (bug.line) {location += `:${bug.line}`;}
    if (bug.column) {location += `:${bug.column}`;}
    console.log(chalk.gray(location));
  }

  if (bug.description) {
    console.log(chalk.gray(`    ${bug.description}`));
  }

  if (bug.suggestion) {
    console.log(chalk.cyan(`    💡 ${bug.suggestion}`));
  }

  if (bug.autoFixAvailable) {
    console.log(chalk.green(`    🔧 Auto-fix available`));
  }

  console.log();
}

async function attemptAutoFix(bugs: Bug[]): Promise<void> {
  const fixableBugs = bugs.filter((b) => b.autoFixAvailable && b.autoFix);

  if (fixableBugs.length === 0) {
    console.log(chalk.yellow('No auto-fixable bugs found'));
    return;
  }

  console.log(chalk.blue(`\n🔧 Attempting to fix ${fixableBugs.length} bug(s)...\n`));

  for (const bug of fixableBugs) {
    try {
      if (bug.autoFix) {
        await bug.autoFix();
        console.log(chalk.green(`✅ Fixed: ${bug.message}`));
        if (bug.file) {
          console.log(chalk.gray(`   in ${bug.file}`));
        }
      }
    } catch (error: unknown) {
      console.log(chalk.red(`❌ Failed to fix: ${bug.message}`));
      logger.error('Auto-fix failed:', error);
    }
  }

  console.log(chalk.green('\n✨ Auto-fix complete!'));
  console.log(chalk.gray('Please review the changes and run tests.'));
}

export default bugCommand;
