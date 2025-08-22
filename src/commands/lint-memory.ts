/**
 * Memory-Enhanced Lint Analysis Command
 *
 * Leverages memory system for intelligent code quality analysis:
 * - System 1: Fast pattern matching for lint violations
 * - System 2: Deep reasoning for code quality improvements
 * - Learning from previous lint fixes and patterns
 * - Proactive quality suggestions based on project patterns
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ESLint } from 'eslint';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DualMemoryEngine } from '../services/memory-system/dual-memory-engine';
import { logger } from '../utils/logger';
import type {
  MemoryQuery,
  CodePattern,
  QualityMetrics,
} from '../services/memory-system/types/memory-interfaces';

interface LintContext {
  files?: string[];
  project?: string;
  framework?: string;
  rules?: string[];
  severity?: 'error' | 'warning' | 'info';
}

interface LintPattern {
  rule: string;
  frequency: number;
  fixRate: number;
  description: string;
  autoFixable: boolean;
}

export default function registerLintMemoryCommand(program: Command) {
  program
    .command('lint')
    .description('Memory-enhanced ESLint code quality analysis')
    .argument('[files...]', 'Files or directories to lint')
    .option('--fix', 'Auto-fix lint issues')
    .option('--predict', 'Predict future lint issues')
    .option('--learn', 'Learn from lint patterns')
    .option('--reason', 'Deep analysis of code quality')
    .option('--strict', 'Apply strict quality standards')
    .option('--no-memory', 'Disable memory system')
    .action(async (files: string[], options) => {
      const spinner = ora('Initializing memory-enhanced lint analysis...').start();

      try {
        // Initialize memory system
        let memoryEngine: DualMemoryEngine | null = null;
        if (options.memory !== false) {
          memoryEngine = await initializeMemorySystem();
          spinner.text = 'Memory system loaded';
        }

        // Build lint context
        const context: LintContext = {
          files: files.length > 0 ? files : ['.'],
          project: process.cwd().split('/').pop(),
          severity: options.strict ? 'error' : 'warning',
        };

        // Query memory for common lint patterns
        let memoryPatterns: any = null;
        if (memoryEngine) {
          spinner.text = 'Analyzing project lint patterns...';
          memoryPatterns = await queryLintMemory(memoryEngine, context);

          if (memoryPatterns.commonViolations.length > 0) {
            spinner.succeed(`Found ${memoryPatterns.commonViolations.length} common lint patterns`);
            displayCommonPatterns(memoryPatterns.commonViolations);
          }
        }

        // Start reasoning for code quality
        let reasoningTraceId: string | null = null;
        if (options.reason && memoryEngine) {
          spinner.text = 'Starting deep code quality analysis...';
          reasoningTraceId = await startQualityReasoning(memoryEngine, context);
          spinner.succeed('Quality reasoning initiated');
        }

        // Run ESLint with memory-enhanced configuration
        spinner.text = 'Running ESLint analysis...';
        const results = await runLintWithMemory(context, memoryPatterns, options);

        // Complete reasoning with results
        if (reasoningTraceId && memoryEngine) {
          await completeQualityReasoning(memoryEngine, reasoningTraceId, results);
        }

        // Predict future issues if requested
        if (options.predict && memoryEngine) {
          spinner.text = 'Predicting future lint issues...';
          const predictions = await predictLintIssues(memoryEngine, context, results);
          displayPredictions(predictions);
        }

        // Learn from patterns if requested
        if (options.learn && memoryEngine) {
          spinner.text = 'Learning lint patterns...';
          await learnFromLintResults(memoryEngine, context, results);
          spinner.succeed('Lint patterns learned');
        }

        // Display results
        spinner.stop();
        displayLintResults(results, memoryPatterns);

        // Show memory statistics
        if (memoryEngine) {
          const metrics = memoryEngine.getMetrics();
          console.log(
            chalk.gray(
              `\n📊 Memory: ${metrics.system1Operations} patterns, ${metrics.system2Operations} quality analyses`,
            ),
          );
        }

        // Exit with appropriate code
        process.exit(results.errorCount > 0 ? 1 : 0);
      } catch (error) {
        spinner.fail('Lint analysis failed');
        logger.error('Lint error:', error);
        console.error(chalk.red('Error:'), (error as Error).message);
        process.exit(1);
      }
    });
}

async function initializeMemorySystem(): Promise<DualMemoryEngine> {
  return new DualMemoryEngine({
    system1: {
      maxKnowledgeNodes: 1500,
      embeddingDimension: 1536,
      cacheSize: 150,
      compressionThreshold: 0.75,
      accessDecayRate: 0.04,
    },
    system2: {
      maxReasoningTraces: 150,
      qualityThreshold: 0.8,
      reflectionFrequency: 12,
      enhancementEvaluationInterval: 8,
    },
    coordinator: {
      syncInterval: 4000,
      conflictResolutionStrategy: 'balanced',
      learningRate: 0.18,
      adaptationThreshold: 0.8,
    },
    performance: {
      targetLatency: 40,
      maxMemoryUsage: 512,
      cacheStrategy: 'lru',
      preloadPriority: 'high',
      backgroundOptimization: true,
    },
  });
}

async function queryLintMemory(engine: DualMemoryEngine, context: LintContext): Promise<any> {
  // Query for common lint violations
  const violationQuery: MemoryQuery = {
    type: 'pattern',
    query: 'lint violations',
    context: { project: context.project } as Record<string, unknown>,
    urgency: 'medium',
    limit: 10,
  };

  const violations = await engine.query(violationQuery);

  // Query for successful fixes
  const fixQuery: MemoryQuery = {
    type: 'knowledge',
    query: 'lint fixes',
    context: { project: context.project } as Record<string, unknown>,
    urgency: 'low',
    limit: 5,
  };

  const fixes = await engine.query(fixQuery);

  // Query for code quality metrics
  const qualityQuery: MemoryQuery = {
    type: 'quality',
    query: 'code quality metrics',
    context: { project: context.project } as Record<string, unknown>,
    urgency: 'low',
    limit: 1,
  };

  const quality = await engine.query(qualityQuery);

  return {
    commonViolations: violations.data || [],
    successfulFixes: fixes.data || [],
    qualityHistory: quality.data || {},
  };
}

async function startQualityReasoning(
  engine: DualMemoryEngine,
  context: LintContext,
): Promise<string> {
  const trace = await engine.getSystem2().startReasoningTrace({
    problem: 'Analyze code quality and suggest improvements',
    goals: [
      'Identify code quality issues',
      'Suggest best practices',
      'Recommend refactoring opportunities',
    ],
    constraints: [`Project: ${context.project || 'unknown'}`, `Severity: ${context.severity}`],
    assumptions: ['Code follows common patterns', 'Project uses standard conventions'],
    availableResources: ['ESLint rules', 'Memory patterns', 'Best practices database'],
  });

  return trace.id;
}

async function completeQualityReasoning(
  engine: DualMemoryEngine,
  traceId: string,
  results: any,
): Promise<void> {
  const quality = calculateQualityScore(results);
  const outcome = `Quality Score: ${quality}/100\nErrors: ${results.errorCount}\nWarnings: ${results.warningCount}`;

  await engine.getSystem2().completeReasoningTrace(traceId, outcome, quality / 100);
}

async function runLintWithMemory(
  context: LintContext,
  memoryPatterns: any,
  options: any,
): Promise<any> {
  // Configure ESLint with memory insights
  const eslint = new ESLint({
    fix: options.fix,
    cache: true,
    cacheLocation: '.eslintcache',
  });

  // Add custom rules based on memory patterns
  const customRules = memoryPatterns ? getCustomRulesFromMemory(memoryPatterns) : {};

  // Run linting
  const results = await eslint.lintFiles(context.files || ['.']);

  // Apply fixes if requested
  if (options.fix) {
    await ESLint.outputFixes(results);
  }

  // Calculate summary
  let errorCount = 0;
  let warningCount = 0;
  let fixableCount = 0;

  for (const result of results) {
    errorCount += result.errorCount;
    warningCount += result.warningCount;
    fixableCount += result.fixableErrorCount + result.fixableWarningCount;
  }

  return {
    results,
    errorCount,
    warningCount,
    fixableCount,
    fileCount: results.length,
  };
}

async function predictLintIssues(
  engine: DualMemoryEngine,
  context: LintContext,
  currentResults: any,
): Promise<any[]> {
  // Query for evolving patterns
  const evolutionQuery: MemoryQuery = {
    type: 'pattern',
    query: 'evolving lint patterns',
    context: {
      project: context.project,
      currentErrors: currentResults.errorCount,
    } as Record<string, unknown>,
    urgency: 'low',
    limit: 5,
  };

  const response = await engine.query(evolutionQuery);
  const patterns = response.data || [];

  // Analyze trends
  const predictions: any[] = [];

  patterns.forEach((pattern: any) => {
    if (pattern.frequency > 3 && pattern.trend === 'increasing') {
      predictions.push({
        rule: pattern.rule,
        likelihood: pattern.frequency > 10 ? 'high' : 'medium',
        description: `This violation is becoming more common`,
        prevention: pattern.fix || 'Review code for this pattern',
      });
    }
  });

  return predictions;
}

async function learnFromLintResults(
  engine: DualMemoryEngine,
  context: LintContext,
  results: any,
): Promise<void> {
  // Process each unique rule violation
  const ruleFrequency = new Map<string, number>();

  for (const result of results.results) {
    for (const message of result.messages) {
      const count = ruleFrequency.get(message.ruleId) || 0;
      ruleFrequency.set(message.ruleId, count + 1);
    }
  }

  // Store patterns in System 1
  for (const [rule, frequency] of ruleFrequency.entries()) {
    const embedding = await generateEmbedding(`lint rule: ${rule}`);

    await engine.getSystem1().addKnowledgeNode(
      'lint_pattern',
      `lint_${rule}_${Date.now()}`,
      JSON.stringify({
        rule,
        frequency,
        project: context.project,
        severity: frequency > 10 ? 'high' : 'medium',
      }),
      embedding,
      {
        timestamp: new Date().toISOString(),
        autoFixable: true,
      },
    );
  }

  // Store quality metrics in System 2
  const qualityMetrics: QualityMetrics = {
    maintainability: calculateMaintainability(results),
    readability: calculateReadability(results),
    testability: 0.7, // Default
    performance: 0.8, // Default
    security: 0.8, // Default
    bugDensity: results.errorCount / results.fileCount,
    complexity: calculateComplexity(results),
  };

  await engine.processEvent({
    type: 'quality_assessment',
    timestamp: new Date(),
    source: 'lint_command',
    data: qualityMetrics,
    metadata: {
      project: context.project,
      fileCount: results.fileCount,
    },
  });
}

// Helper functions
function getCustomRulesFromMemory(patterns: any): any {
  const rules: any = {};

  if (patterns.commonViolations) {
    patterns.commonViolations.forEach((violation: any) => {
      if (violation.frequency > 5) {
        // Escalate common violations to errors
        rules[violation.rule] = 'error';
      }
    });
  }

  return rules;
}

function calculateQualityScore(results: any): number {
  const baseScore = 100;
  const errorPenalty = results.errorCount * 2;
  const warningPenalty = results.warningCount * 0.5;

  return Math.max(0, baseScore - errorPenalty - warningPenalty);
}

function calculateMaintainability(results: any): number {
  // Simple maintainability calculation
  const issueRatio = (results.errorCount + results.warningCount) / results.fileCount;
  return Math.max(0, 1 - issueRatio / 10);
}

function calculateReadability(results: any): number {
  // Check for specific readability-related rules
  let readabilityIssues = 0;

  for (const result of results.results) {
    for (const message of result.messages) {
      if (
        message.ruleId?.includes('naming') ||
        message.ruleId?.includes('comment') ||
        message.ruleId?.includes('complexity')
      ) {
        readabilityIssues++;
      }
    }
  }

  return Math.max(0, 1 - readabilityIssues / (results.fileCount * 10));
}

function calculateComplexity(results: any): number {
  // Check for complexity-related rules
  let complexityIssues = 0;

  for (const result of results.results) {
    for (const message of result.messages) {
      if (message.ruleId?.includes('complex') || message.ruleId?.includes('max-')) {
        complexityIssues++;
      }
    }
  }

  return complexityIssues / results.fileCount;
}

async function generateEmbedding(text: string): Promise<number[]> {
  // Simplified embedding - in production, use proper embedding model
  const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return Array(100)
    .fill(0)
    .map((_, i) => Math.sin(hash + i) * 0.5 + 0.5);
}

// Display functions
function displayCommonPatterns(patterns: any[]): void {
  console.log(chalk.yellow('\n📋 Common lint patterns in this project:'));
  patterns.slice(0, 5).forEach((pattern, i) => {
    console.log(
      chalk.gray(`  ${i + 1}. ${pattern.rule || pattern.description} (${pattern.frequency}x)`),
    );
  });
}

function displayPredictions(predictions: any[]): void {
  if (predictions.length > 0) {
    console.log(chalk.yellow('\n🔮 Predicted future lint issues:'));
    predictions.forEach((pred, i) => {
      console.log(chalk.yellow(`  ${i + 1}. [${pred.likelihood}] ${pred.rule}`));
      console.log(chalk.gray(`     ${pred.description}`));
      console.log(chalk.cyan(`     Prevention: ${pred.prevention}`));
    });
  }
}

function displayLintResults(results: any, memoryPatterns: any): void {
  const { errorCount, warningCount, fixableCount, fileCount } = results;

  console.log(chalk.blue('\n📝 Lint Analysis Results:'));
  console.log(chalk.white(`  Files analyzed: ${fileCount}`));

  if (errorCount > 0) {
    console.log(chalk.red(`  ❌ Errors: ${errorCount}`));
  } else {
    console.log(chalk.green(`  ✅ Errors: 0`));
  }

  if (warningCount > 0) {
    console.log(chalk.yellow(`  ⚠️  Warnings: ${warningCount}`));
  } else {
    console.log(chalk.green(`  ✅ Warnings: 0`));
  }

  if (fixableCount > 0) {
    console.log(chalk.cyan(`  🔧 Auto-fixable: ${fixableCount}`));
  }

  const qualityScore = calculateQualityScore(results);
  const scoreColor =
    qualityScore >= 90 ? chalk.green : qualityScore >= 70 ? chalk.yellow : chalk.red;

  console.log(scoreColor(`\n📊 Quality Score: ${qualityScore}/100`));

  // Show insights from memory
  if (memoryPatterns && memoryPatterns.qualityHistory) {
    const prevScore = memoryPatterns.qualityHistory.score;
    if (prevScore) {
      const diff = qualityScore - prevScore;
      const trend =
        diff > 0
          ? chalk.green(`↑ +${diff}`)
          : diff < 0
            ? chalk.red(`↓ ${diff}`)
            : chalk.gray('→ 0');
      console.log(chalk.gray(`  Trend from last analysis: ${trend}`));
    }
  }

  // Show detailed results for files with issues
  const filesWithIssues = results.results.filter(
    (r: any) => r.errorCount > 0 || r.warningCount > 0,
  );

  if (filesWithIssues.length > 0) {
    console.log(chalk.yellow('\n📁 Files with issues:'));
    filesWithIssues.slice(0, 10).forEach((file: any) => {
      console.log(chalk.gray(`  ${file.filePath}`));
      console.log(
        chalk.red(`    Errors: ${file.errorCount}`),
        chalk.yellow(`Warnings: ${file.warningCount}`),
      );

      // Show first few messages
      file.messages.slice(0, 3).forEach((msg: any) => {
        const icon = msg.severity === 2 ? '❌' : '⚠️';
        console.log(
          chalk.gray(`    ${icon} [${msg.line}:${msg.column}] ${msg.message} (${msg.ruleId})`),
        );
      });

      if (file.messages.length > 3) {
        console.log(chalk.gray(`    ... and ${file.messages.length - 3} more`));
      }
    });

    if (filesWithIssues.length > 10) {
      console.log(chalk.gray(`\n  ... and ${filesWithIssues.length - 10} more files`));
    }
  }
}
