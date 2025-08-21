import { BaseCommand } from '../base-command';
import { Command, RequireAuth, RateLimit, Cache, Validate } from '../decorators';
import { CommandContext, CommandOptions, CommandResult } from '../types';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import { logger } from '../../utils/logger';
import { AIRouterService } from '../../services/ai-router';
import { FileSystemService } from '../../services/file-system-service';
import { TestRunnerService } from '../../services/test-runner';
import { CoverageAnalyzerService } from '../../services/coverage-analyzer';

const execAsync = promisify(exec);

const testSchema = z.object({
  files: z.array(z.string()).optional(),
  pattern: z.string().optional(),
  type: z.enum(['unit', 'integration', 'e2e', 'all']).optional().default('unit'),
  coverage: z.boolean().optional().default(true),
  watch: z.boolean().optional().default(false),
  parallel: z.boolean().optional().default(true),
  verbose: z.boolean().optional().default(false),
  generate: z.boolean().optional().default(false),
  fix: z.boolean().optional().default(false),
  framework: z.string().optional(),
  timeout: z.number().optional().default(30000),
  bail: z.boolean().optional().default(false),
  updateSnapshots: z.boolean().optional().default(false),
});

export type TestOptions = z.infer<typeof testSchema>;

/**
 * Advanced Test Management Command
 *
 * Features:
 * - Automatic test generation with AI
 * - Multiple test framework support
 * - Coverage analysis and reporting
 * - Test fixing suggestions
 * - Parallel execution
 * - Watch mode
 * - Snapshot testing
 * - Performance benchmarking
 */
@Command({
  name: 'test',
  aliases: ['t', 'spec', 'verify'],
  description: 'Run tests or generate test cases with AI',
  category: 'development',
  priority: 95,
  version: '2.0.0',
})
@RequireAuth({ level: 'basic' })
@RateLimit(20, '1m')
@Cache({ ttl: 60, key: 'pattern' })
@Validate(testSchema)
export class TestCommand extends BaseCommand<TestOptions> {
  private aiRouter: AIRouterService;
  private fileSystem: FileSystemService;
  private testRunner: TestRunnerService;
  private coverageAnalyzer: CoverageAnalyzerService;

  constructor() {
    super();
    this.aiRouter = new AIRouterService();
    this.fileSystem = new FileSystemService();
    this.testRunner = new TestRunnerService();
    this.coverageAnalyzer = new CoverageAnalyzerService();
  }

  async execute(
    args: string[],
    options: TestOptions,
    context: CommandContext,
  ): Promise<CommandResult> {
    try {
      this.emit('start', { command: 'test', options });

      // Detect test framework
      const framework = options.framework || (await this.detectTestFramework(context));
      logger.info(chalk.blue(`🧪 Using test framework: ${framework}`));

      // Handle test generation
      if (options.generate) {
        return await this.generateTests(args, options, context, framework);
      }

      // Find test files
      const testFiles = await this.findTestFiles(args, options, context);

      if (testFiles.length === 0) {
        logger.warn(chalk.yellow('No test files found'));
        return {
          success: false,
          data: { message: 'No test files found' },
        };
      }

      logger.info(chalk.cyan(`Found ${testFiles.length} test file(s)`));

      // Run tests
      const testResults = await this.runTests(testFiles, options, framework);

      // Analyze coverage if enabled
      let coverageReport = null;
      if (options.coverage && testResults.success) {
        coverageReport = await this.analyzeCoverage(framework);
        this.displayCoverageReport(coverageReport);
      }

      // Handle test failures
      if (!testResults.success && options.fix) {
        await this.suggestFixes(testResults.failures, context);
      }

      this.emit('complete', { testResults, coverageReport });

      return {
        success: testResults.success,
        data: {
          ...testResults,
          coverage: coverageReport,
        },
        metadata: {
          framework,
          duration: testResults.duration,
          testsRun: testResults.total,
          testsPassed: testResults.passed,
          testsFailed: testResults.failed,
        },
      };
    } catch (error) {
      this.emit('error', { error });
      logger.error(chalk.red(`Test execution failed: ${error.message}`));
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async detectTestFramework(context: CommandContext): Promise<string> {
    const packageJson = await this.fileSystem.readPackageJson(context.projectPath);

    if (!packageJson) {
      return 'jest'; // Default
    }

    const { dependencies = {}, devDependencies = {} } = packageJson;
    const allDeps = { ...dependencies, ...devDependencies };

    if (allDeps.jest) return 'jest';
    if (allDeps.mocha) return 'mocha';
    if (allDeps.vitest) return 'vitest';
    if (allDeps.ava) return 'ava';
    if (allDeps.tape) return 'tape';
    if (allDeps['@playwright/test']) return 'playwright';
    if (allDeps.cypress) return 'cypress';
    if (allDeps.pytest) return 'pytest';
    if (allDeps.unittest) return 'unittest';
    if (allDeps.rspec) return 'rspec';

    return 'jest'; // Default fallback
  }

  private async findTestFiles(
    args: string[],
    options: TestOptions,
    context: CommandContext,
  ): Promise<string[]> {
    if (options.files && options.files.length > 0) {
      return options.files;
    }

    const pattern = options.pattern || this.getDefaultPattern(options.type);
    return await this.fileSystem.glob(pattern, {
      cwd: context.projectPath,
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    });
  }

  private getDefaultPattern(type: string): string {
    const patterns: Record<string, string> = {
      unit: '**/*.{test,spec}.{js,ts,jsx,tsx}',
      integration: '**/integration/**/*.{test,spec}.{js,ts,jsx,tsx}',
      e2e: '**/e2e/**/*.{test,spec}.{js,ts,jsx,tsx}',
      all: '**/*.{test,spec}.{js,ts,jsx,tsx}',
    };
    return patterns[type] || patterns.all;
  }

  private async runTests(
    files: string[],
    options: TestOptions,
    framework: string,
  ): Promise<unknown> {
    const command = this.buildTestCommand(files, options, framework);
    logger.info(chalk.gray(`Running: ${command}`));

    try {
      const startTime = Date.now();
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout: options.timeout,
      });

      const duration = Date.now() - startTime;
      const results = this.parseTestOutput(stdout, stderr, framework);

      // Display results
      this.displayTestResults(results);

      return {
        ...results,
        duration,
        success: results.failed === 0,
      };
    } catch (error) {
      // Even if command fails, parse the output for test results
      const output = error.stdout || error.stderr || '';
      const results = this.parseTestOutput(output, '', framework);

      return {
        ...results,
        success: false,
        error: error.message,
      };
    }
  }

  private buildTestCommand(files: string[], options: TestOptions, framework: string): string {
    const commands: Record<string, string> = {
      jest: this.buildJestCommand(files, options),
      mocha: this.buildMochaCommand(files, options),
      vitest: this.buildVitestCommand(files, options),
      playwright: this.buildPlaywrightCommand(files, options),
      cypress: this.buildCypressCommand(files, options),
      pytest: this.buildPytestCommand(files, options),
    };

    return commands[framework] || commands.jest;
  }

  private buildJestCommand(files: string[], options: TestOptions): string {
    const args = ['npx jest'];

    if (files.length > 0) {
      args.push(files.join(' '));
    }

    if (options.coverage) args.push('--coverage');
    if (options.watch) args.push('--watch');
    if (options.verbose) args.push('--verbose');
    if (options.bail) args.push('--bail');
    if (options.updateSnapshots) args.push('-u');
    if (!options.parallel) args.push('--runInBand');

    return args.join(' ');
  }

  private buildMochaCommand(files: string[], options: TestOptions): string {
    const args = ['npx mocha'];

    if (files.length > 0) {
      args.push(files.join(' '));
    }

    if (options.watch) args.push('--watch');
    if (options.verbose) args.push('--reporter spec');
    if (options.bail) args.push('--bail');
    if (options.parallel) args.push('--parallel');
    args.push(`--timeout ${options.timeout}`);

    return args.join(' ');
  }

  private buildVitestCommand(files: string[], options: TestOptions): string {
    const args = ['npx vitest'];

    if (files.length > 0) {
      args.push(files.join(' '));
    }

    if (options.coverage) args.push('--coverage');
    if (options.watch) args.push('--watch');
    if (!options.parallel) args.push('--no-threads');
    if (options.updateSnapshots) args.push('-u');

    return args.join(' ');
  }

  private buildPlaywrightCommand(files: string[], options: TestOptions): string {
    const args = ['npx playwright test'];

    if (files.length > 0) {
      args.push(files.join(' '));
    }

    if (options.verbose) args.push('--reporter=list');
    if (!options.parallel) args.push('--workers=1');

    return args.join(' ');
  }

  private buildCypressCommand(files: string[], options: TestOptions): string {
    return options.watch
      ? 'npx cypress open'
      : `npx cypress run ${files.length > 0 ? `--spec ${files.join(',')}` : ''}`;
  }

  private buildPytestCommand(files: string[], options: TestOptions): string {
    const args = ['pytest'];

    if (files.length > 0) {
      args.push(files.join(' '));
    }

    if (options.coverage) args.push('--cov');
    if (options.verbose) args.push('-v');
    if (options.bail) args.push('-x');
    if (options.parallel) args.push('-n auto');

    return args.join(' ');
  }

  private parseTestOutput(stdout: string, stderr: string, framework: string): unknown {
    // Framework-specific parsing would go here
    // This is a simplified version

    const output = stdout + stderr;
    const results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      failures: [] as unknown[],
    };

    // Parse common patterns
    const totalMatch = output.match(/(\d+) (total|tests?)/i);
    const passedMatch = output.match(/(\d+) pass(ed|ing)?/i);
    const failedMatch = output.match(/(\d+) fail(ed|ing)?/i);
    const skippedMatch = output.match(/(\d+) skip(ped)?/i);

    if (totalMatch) results.total = parseInt(totalMatch[1]);
    if (passedMatch) results.passed = parseInt(passedMatch[1]);
    if (failedMatch) results.failed = parseInt(failedMatch[1]);
    if (skippedMatch) results.skipped = parseInt(skippedMatch[1]);

    // Extract failure details
    const failureRegex = /(?:✗|✕|FAIL|FAILED)\s+(.+)/g;
    let match;
    while ((match = failureRegex.exec(output)) !== null) {
      results.failures.push({
        test: match[1],
        error: this.extractErrorMessage(output, match.index),
      });
    }

    return results;
  }

  private extractErrorMessage(output: string, startIndex: number): string {
    const lines = output.substring(startIndex).split('\n');
    const errorLines = [];

    for (let i = 1; i < Math.min(lines.length, 10); i++) {
      const line = lines[i].trim();
      if (line && !line.startsWith('✓') && !line.startsWith('✗')) {
        errorLines.push(line);
      }
      if (line.startsWith('at ') || line.includes('    at ')) {
        break; // Stop at stack trace
      }
    }

    return errorLines.join('\n');
  }

  private displayTestResults(results: unknown): void {
    console.log('\n' + chalk.bold('Test Results:'));
    console.log(chalk.green(`  ✓ Passed: ${results.passed}`));

    if (results.failed > 0) {
      console.log(chalk.red(`  ✗ Failed: ${results.failed}`));
    }

    if (results.skipped > 0) {
      console.log(chalk.yellow(`  ○ Skipped: ${results.skipped}`));
    }

    console.log(chalk.gray(`  Total: ${results.total}`));

    if (results.failures && results.failures.length > 0) {
      console.log('\n' + chalk.bold.red('Failures:'));
      results.failures.forEach((failure: unknown, index: number) => {
        console.log(chalk.red(`  ${index + 1}. ${failure.test}`));
        if (failure.error) {
          console.log(chalk.gray(`     ${failure.error.replace(/\n/g, '\n     ')}`));
        }
      });
    }
  }

  private async analyzeCoverage(framework: string): Promise<unknown> {
    return await this.coverageAnalyzer.analyze(framework);
  }

  private displayCoverageReport(report: unknown): void {
    if (!report) return;

    console.log('\n' + chalk.bold('Coverage Report:'));
    console.log(chalk.cyan(`  Statements: ${report.statements}%`));
    console.log(chalk.cyan(`  Branches: ${report.branches}%`));
    console.log(chalk.cyan(`  Functions: ${report.functions}%`));
    console.log(chalk.cyan(`  Lines: ${report.lines}%`));

    if (report.uncoveredFiles && report.uncoveredFiles.length > 0) {
      console.log('\n' + chalk.yellow('Uncovered files:'));
      report.uncoveredFiles.forEach((file: string) => {
        console.log(chalk.yellow(`  - ${file}`));
      });
    }
  }

  private async generateTests(
    args: string[],
    options: TestOptions,
    context: CommandContext,
    framework: string,
  ): Promise<CommandResult> {
    const targetFile = args[0];

    if (!targetFile) {
      throw new Error('Please specify a file to generate tests for');
    }

    const sourceCode = await this.fileSystem.readFile(targetFile);

    if (!sourceCode) {
      throw new Error(`Could not read file: ${targetFile}`);
    }

    logger.info(chalk.blue('🤖 Generating tests with AI...'));

    const tests = await this.aiRouter.generate({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `Generate comprehensive ${framework} tests for the following code. Include edge cases, error handling, and achieve high coverage.`,
        },
        {
          role: 'user',
          content: sourceCode,
        },
      ],
      temperature: 0.3,
      maxTokens: 3000,
    });

    // Save generated tests
    const testFileName = this.getTestFileName(targetFile);
    await this.fileSystem.writeFile(testFileName, tests);

    logger.info(chalk.green(`✅ Tests generated: ${testFileName}`));

    return {
      success: true,
      data: {
        generatedFile: testFileName,
        tests,
      },
    };
  }

  private getTestFileName(sourceFile: string): string {
    const parts = sourceFile.split('.');
    const extension = parts.pop();
    const name = parts.join('.');
    return `${name}.test.${extension}`;
  }

  private async suggestFixes(failures: unknown[], context: CommandContext): Promise<void> {
    logger.info(chalk.blue('\n🔧 Analyzing test failures...'));

    for (const failure of failures.slice(0, 3)) {
      // Limit to first 3 failures
      const suggestion = await this.aiRouter.generate({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Analyze this test failure and suggest a fix. Be concise and specific.',
          },
          {
            role: 'user',
            content: `Test: ${failure.test}\nError: ${failure.error}`,
          },
        ],
        temperature: 0.3,
        maxTokens: 500,
      });

      console.log(chalk.yellow(`\n💡 Fix for "${failure.test}":`));
      console.log(chalk.gray(suggestion));
    }
  }

  async help(): Promise<string> {
    return `
${chalk.bold.blue('Test Command')}

${chalk.yellow('Usage:')}
  /test [files...] [options]

${chalk.yellow('Options:')}
  --type <type>         Test type (unit, integration, e2e, all)
  --pattern <glob>      File pattern to match
  --coverage            Generate coverage report
  --watch               Run in watch mode
  --parallel            Run tests in parallel (default: true)
  --verbose             Verbose output
  --generate            Generate tests with AI
  --fix                 Suggest fixes for failures
  --framework <name>    Test framework to use
  --timeout <ms>        Test timeout (default: 30000)
  --bail                Stop on first failure
  --update-snapshots    Update snapshots

${chalk.yellow('Examples:')}
  /test                                    # Run all tests
  /test src/utils.js --generate           # Generate tests for utils.js
  /test --type integration --coverage     # Run integration tests with coverage
  /test --watch                           # Run tests in watch mode
  /test --fix                             # Run tests and suggest fixes

${chalk.yellow('Supported Frameworks:')}
  Jest, Mocha, Vitest, Playwright, Cypress, Pytest, RSpec

${chalk.yellow('Features:')}
  • Automatic test framework detection
  • AI-powered test generation
  • Coverage analysis and reporting
  • Failure analysis with fix suggestions
  • Parallel execution for speed
  • Watch mode for development
  • Snapshot testing support
    `;
  }
}
