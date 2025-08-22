/**
 * Memory-Enhanced TypeScript Type Safety Analysis Command
 * 
 * Leverages memory system for intelligent type checking:
 * - System 1: Fast pattern matching for type violations
 * - System 2: Deep reasoning for type system improvements
 * - Learning from type error patterns and fixes
 * - Predictive type safety analysis
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as ts from 'typescript';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DualMemoryEngine } from '../services/memory-system/dual-memory-engine';
import { logger } from '../utils/logger';
import type {
  MemoryQuery,
  CodePattern,
  QualityMetrics,
  ReasoningTrace,
} from '../services/memory-system/types/memory-interfaces';

interface TypeCheckContext {
  files?: string[];
  project?: string;
  tsConfig?: string;
  strictMode?: boolean;
  coverage?: boolean;
}

interface TypeViolation {
  file: string;
  line: number;
  column: number;
  error: string;
  category: string;
  fixable: boolean;
  suggestion?: string;
}

interface TypeCoverageMetrics {
  totalLines: number;
  typedLines: number;
  coverage: number;
  anyUsage: number;
  unknownUsage: number;
  strictCompliance: boolean;
}

export default function registerTypeCheckMemoryCommand(program: Command) {
  program
    .command('typecheck')
    .description('Memory-enhanced TypeScript type safety analysis')
    .argument('[files...]', 'Files or directories to check')
    .option('-c, --config <path>', 'Path to tsconfig.json')
    .option('--strict', 'Enable strict type checking')
    .option('--coverage', 'Calculate type coverage')
    .option('--fix', 'Attempt to fix type issues')
    .option('--predict', 'Predict future type safety issues')
    .option('--learn', 'Learn from type patterns')
    .option('--reason', 'Deep type system analysis')
    .option('--no-memory', 'Disable memory system')
    .action(async (files: string[], options) => {
      const spinner = ora('Initializing memory-enhanced type checking...').start();
      
      try {
        // Initialize memory system
        let memoryEngine: DualMemoryEngine | null = null;
        if (options.memory !== false) {
          memoryEngine = await initializeMemorySystem();
          spinner.text = 'Memory system activated';
        }

        // Build context
        const context: TypeCheckContext = {
          files: files.length > 0 ? files : undefined,
          project: process.cwd().split('/').pop(),
          tsConfig: options.config || 'tsconfig.json',
          strictMode: options.strict,
          coverage: options.coverage,
        };

        // Query memory for type patterns
        let memoryPatterns: any = null;
        if (memoryEngine) {
          spinner.text = 'Analyzing type patterns from memory...';
          memoryPatterns = await queryTypeMemory(memoryEngine, context);
          
          if (memoryPatterns.typeViolations.length > 0) {
            spinner.succeed(`Found ${memoryPatterns.typeViolations.length} type patterns`);
            displayTypePatterns(memoryPatterns.typeViolations);
          }
        }

        // Start reasoning for type system analysis
        let reasoningTraceId: string | null = null;
        if (options.reason && memoryEngine) {
          spinner.text = 'Starting deep type system analysis...';
          reasoningTraceId = await startTypeReasoning(memoryEngine, context);
          spinner.succeed('Type reasoning initiated');
        }

        // Run TypeScript compiler with memory insights
        spinner.text = 'Running TypeScript type checker...';
        const results = await runTypeCheckWithMemory(context, memoryPatterns, options);
        
        // Calculate type coverage if requested
        let coverage: TypeCoverageMetrics | null = null;
        if (options.coverage) {
          spinner.text = 'Calculating type coverage...';
          coverage = await calculateTypeCoverage(context, memoryEngine);
          displayTypeCoverage(coverage);
        }

        // Complete reasoning with results
        if (reasoningTraceId && memoryEngine) {
          await completeTypeReasoning(memoryEngine, reasoningTraceId, results, coverage);
        }

        // Predict future type issues if requested
        if (options.predict && memoryEngine) {
          spinner.text = 'Predicting type safety issues...';
          const predictions = await predictTypeIssues(memoryEngine, context, results);
          displayTypePredictions(predictions);
        }

        // Apply fixes if requested
        if (options.fix && results.violations.length > 0) {
          spinner.text = 'Attempting type fixes...';
          const fixes = await applyTypeFixes(results.violations, memoryEngine);
          displayFixResults(fixes);
        }

        // Learn from type patterns if requested
        if (options.learn && memoryEngine) {
          spinner.text = 'Learning type patterns...';
          await learnFromTypeCheck(memoryEngine, context, results, coverage);
          spinner.succeed('Type patterns learned');
        }

        // Display results
        spinner.stop();
        displayTypeCheckResults(results, coverage, memoryPatterns);

        // Show memory statistics
        if (memoryEngine) {
          const metrics = memoryEngine.getMetrics();
          console.log(chalk.gray(`\n📊 Memory: ${metrics.system1Operations} patterns, ${metrics.system2Operations} type analyses`));
        }

        // Exit with appropriate code
        process.exit(results.errorCount > 0 ? 1 : 0);

      } catch (error) {
        spinner.fail('Type check failed');
        logger.error('TypeCheck error:', error);
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
      qualityThreshold: 0.85,
      reflectionFrequency: 12,
      enhancementEvaluationInterval: 8,
    },
    coordinator: {
      syncInterval: 4000,
      conflictResolutionStrategy: 'system2_priority', // Prefer deep type analysis
      learningRate: 0.2,
      adaptationThreshold: 0.85,
    },
    performance: {
      targetLatency: 40,
      maxMemoryUsage: 512,
      cacheStrategy: 'lru',
      preloadPriority: 'high',
      backgroundOptimization: true,
    }
  });
}

async function queryTypeMemory(
  engine: DualMemoryEngine,
  context: TypeCheckContext
): Promise<any> {
  // Query for type violations
  const violationQuery: MemoryQuery = {
    type: 'pattern',
    query: 'type violations',
    context: { 
      project: context.project,
      strict: context.strictMode,
    } as Record<string, unknown>,
    urgency: 'high',
    limit: 10,
  };
  
  const violations = await engine.query(violationQuery);

  // Query for type fixes
  const fixQuery: MemoryQuery = {
    type: 'knowledge',
    query: 'type fixes',
    context: { project: context.project } as Record<string, unknown>,
    urgency: 'medium',
    limit: 5,
  };
  
  const fixes = await engine.query(fixQuery);

  // Query for type coverage history
  const coverageQuery: MemoryQuery = {
    type: 'quality',
    query: 'type coverage metrics',
    context: { project: context.project } as Record<string, unknown>,
    urgency: 'low',
    limit: 1,
  };
  
  const coverage = await engine.query(coverageQuery);

  return {
    typeViolations: violations.data || [],
    typeFixes: fixes.data || [],
    coverageHistory: coverage.data || {},
  };
}

async function startTypeReasoning(
  engine: DualMemoryEngine,
  context: TypeCheckContext
): Promise<string> {
  const trace = await engine.getSystem2().startReasoningTrace({
    problem: 'Analyze type system and improve type safety',
    goals: [
      'Identify type safety violations',
      'Suggest type improvements',
      'Improve type coverage',
      'Reduce any/unknown usage',
    ],
    constraints: [
      `Project: ${context.project || 'unknown'}`,
      `Strict mode: ${context.strictMode ? 'enabled' : 'disabled'}`,
      `Config: ${context.tsConfig}`,
    ],
    assumptions: [
      'TypeScript compiler is properly configured',
      'Type definitions are available',
    ],
    availableResources: [
      'TypeScript compiler',
      'Type definitions',
      'Memory patterns',
    ],
  });
  
  return trace.id;
}

async function completeTypeReasoning(
  engine: DualMemoryEngine,
  traceId: string,
  results: any,
  coverage: TypeCoverageMetrics | null
): Promise<void> {
  const quality = coverage ? coverage.coverage / 100 : 0.7;
  const outcome = `Type Errors: ${results.errorCount}\nCoverage: ${coverage?.coverage || 'N/A'}%\nStrict: ${coverage?.strictCompliance || false}`;
  
  await engine.getSystem2().completeReasoningTrace(traceId, outcome, quality);
}

async function runTypeCheckWithMemory(
  context: TypeCheckContext,
  memoryPatterns: any,
  options: any
): Promise<any> {
  // Parse tsconfig
  const configPath = ts.findConfigFile(
    process.cwd(),
    ts.sys.fileExists,
    context.tsConfig
  );
  
  if (!configPath) {
    throw new Error('Could not find tsconfig.json');
  }

  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(configPath)
  );

  // Apply strict mode if requested
  if (context.strictMode) {
    parsedConfig.options.strict = true;
    parsedConfig.options.noImplicitAny = true;
    parsedConfig.options.strictNullChecks = true;
    parsedConfig.options.strictFunctionTypes = true;
    parsedConfig.options.strictBindCallApply = true;
    parsedConfig.options.strictPropertyInitialization = true;
    parsedConfig.options.noImplicitThis = true;
    parsedConfig.options.alwaysStrict = true;
  }

  // Create program
  const program = ts.createProgram(
    parsedConfig.fileNames,
    parsedConfig.options
  );

  // Get diagnostics
  const allDiagnostics = ts.getPreEmitDiagnostics(program);
  
  // Process diagnostics
  const violations: TypeViolation[] = [];
  let errorCount = 0;
  let warningCount = 0;

  allDiagnostics.forEach(diagnostic => {
    if (diagnostic.file) {
      const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(
        diagnostic.start!
      );
      
      const message = ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        '\n'
      );

      const violation: TypeViolation = {
        file: diagnostic.file.fileName,
        line: line + 1,
        column: character + 1,
        error: message,
        category: getCategoryName(diagnostic.category),
        fixable: isFixable(message, memoryPatterns),
        suggestion: getSuggestion(message, memoryPatterns),
      };

      violations.push(violation);

      if (diagnostic.category === ts.DiagnosticCategory.Error) {
        errorCount++;
      } else if (diagnostic.category === ts.DiagnosticCategory.Warning) {
        warningCount++;
      }
    }
  });

  return {
    violations,
    errorCount,
    warningCount,
    fileCount: parsedConfig.fileNames.length,
  };
}

async function calculateTypeCoverage(
  context: TypeCheckContext,
  engine: DualMemoryEngine | null
): Promise<TypeCoverageMetrics> {
  // This is a simplified type coverage calculation
  // In production, use a proper type coverage tool
  
  let totalLines = 0;
  let typedLines = 0;
  let anyUsage = 0;
  let unknownUsage = 0;

  const files = context.files || ['.'];
  
  for (const file of files) {
    if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');
        
        totalLines += lines.length;
        
        lines.forEach(line => {
          // Check for explicit type annotations
          if (line.includes(':') && !line.includes('//')) {
            typedLines++;
          }
          
          // Count any usage
          if (line.includes(': any') || line.includes('<any>') || line.includes('as any')) {
            anyUsage++;
          }
          
          // Count unknown usage
          if (line.includes(': unknown') || line.includes('<unknown>') || line.includes('as unknown')) {
            unknownUsage++;
          }
        });
      } catch (error) {
        logger.debug(`Could not analyze file ${file}:`, error);
      }
    }
  }

  const coverage = totalLines > 0 ? (typedLines / totalLines) * 100 : 0;

  const metrics: TypeCoverageMetrics = {
    totalLines,
    typedLines,
    coverage: Math.round(coverage * 100) / 100,
    anyUsage,
    unknownUsage,
    strictCompliance: anyUsage === 0 && coverage > 80,
  };

  // Store in memory if available
  if (engine) {
    await engine.processEvent({
      type: 'type_coverage',
      timestamp: new Date(),
      source: 'typecheck_command',
      data: metrics,
      metadata: {
        project: context.project,
        strictMode: context.strictMode,
      },
    });
  }

  return metrics;
}

async function predictTypeIssues(
  engine: DualMemoryEngine,
  context: TypeCheckContext,
  results: any
): Promise<any[]> {
  // Query for evolving type patterns
  const evolutionQuery: MemoryQuery = {
    type: 'pattern',
    query: 'evolving type patterns',
    context: {
      project: context.project,
      currentErrors: results.errorCount,
    } as Record<string, unknown>,
    urgency: 'low',
    limit: 5,
  };
  
  const response = await engine.query(evolutionQuery);
  const patterns = response.data || [];

  const predictions: any[] = [];
  
  patterns.forEach((pattern: any) => {
    if (pattern.trend === 'increasing') {
      predictions.push({
        issue: pattern.error,
        likelihood: pattern.frequency > 10 ? 'high' : 'medium',
        impact: 'Type safety degradation',
        prevention: pattern.suggestion || 'Add explicit type annotations',
      });
    }
  });

  // Predict based on any/unknown usage
  if (results.violations.some((v: TypeViolation) => v.error.includes('any'))) {
    predictions.push({
      issue: 'Increasing any usage',
      likelihood: 'high',
      impact: 'Loss of type safety benefits',
      prevention: 'Replace any with specific types or unknown',
    });
  }

  return predictions;
}

async function applyTypeFixes(
  violations: TypeViolation[],
  engine: DualMemoryEngine | null
): Promise<any> {
  const fixes: any[] = [];
  const fixableViolations = violations.filter(v => v.fixable);

  for (const violation of fixableViolations) {
    // Query memory for similar fixes
    let fixSuggestion = violation.suggestion;
    
    if (engine) {
      const fixQuery: MemoryQuery = {
        type: 'knowledge',
        query: `fix for: ${violation.error}`,
        context: { file: violation.file } as Record<string, unknown>,
        urgency: 'high',
        limit: 1,
      };
      
      const response = await engine.query(fixQuery);
      if (response.data && response.data.length > 0) {
        fixSuggestion = response.data[0].fix || fixSuggestion;
      }
    }

    fixes.push({
      file: violation.file,
      line: violation.line,
      error: violation.error,
      fix: fixSuggestion,
      applied: false, // In production, would actually apply the fix
    });
  }

  return fixes;
}

async function learnFromTypeCheck(
  engine: DualMemoryEngine,
  context: TypeCheckContext,
  results: any,
  coverage: TypeCoverageMetrics | null
): Promise<void> {
  // Store type violation patterns
  const violationMap = new Map<string, number>();
  
  results.violations.forEach((violation: TypeViolation) => {
    const key = violation.category;
    violationMap.set(key, (violationMap.get(key) || 0) + 1);
  });

  // Store patterns in System 1
  for (const [category, count] of violationMap.entries()) {
    const embedding = await generateEmbedding(`type error: ${category}`);
    
    await engine.getSystem1().addKnowledgeNode(
      'type_pattern',
      `type_${category}_${Date.now()}`,
      JSON.stringify({
        category,
        count,
        project: context.project,
        strictMode: context.strictMode,
      }),
      embedding,
      {
        timestamp: new Date().toISOString(),
        fixable: true,
      }
    );
  }

  // Store quality metrics in System 2
  if (coverage) {
    const qualityMetrics: QualityMetrics = {
      maintainability: coverage.strictCompliance ? 0.9 : 0.6,
      readability: coverage.coverage > 80 ? 0.8 : 0.5,
      testability: coverage.anyUsage === 0 ? 0.9 : 0.6,
      performance: 0.7, // Default
      security: coverage.unknownUsage < 5 ? 0.8 : 0.6,
      bugDensity: results.errorCount / results.fileCount,
      complexity: (coverage.anyUsage + coverage.unknownUsage) / coverage.totalLines,
    };

    await engine.getSystem2().assessCodeQuality(
      'TypeScript project',
      'typescript',
      { metrics: qualityMetrics }
    );
  }
}

// Helper functions
function getCategoryName(category: ts.DiagnosticCategory): string {
  switch (category) {
    case ts.DiagnosticCategory.Error:
      return 'error';
    case ts.DiagnosticCategory.Warning:
      return 'warning';
    case ts.DiagnosticCategory.Suggestion:
      return 'suggestion';
    case ts.DiagnosticCategory.Message:
      return 'message';
    default:
      return 'unknown';
  }
}

function isFixable(error: string, memoryPatterns: any): boolean {
  // Check if this type of error is fixable
  const fixablePatterns = [
    'implicit any',
    'missing return type',
    'possibly undefined',
    'possibly null',
  ];
  
  return fixablePatterns.some(pattern => 
    error.toLowerCase().includes(pattern)
  );
}

function getSuggestion(error: string, memoryPatterns: any): string | undefined {
  // Get suggestion based on error type
  if (error.includes('implicit any')) {
    return 'Add explicit type annotation';
  }
  if (error.includes('possibly undefined')) {
    return 'Add null check or use optional chaining';
  }
  if (error.includes('possibly null')) {
    return 'Add null check or non-null assertion';
  }
  if (error.includes('missing return type')) {
    return 'Add explicit return type annotation';
  }
  
  // Check memory for suggestions
  if (memoryPatterns?.typeFixes) {
    const fix = memoryPatterns.typeFixes.find((f: any) => 
      error.includes(f.pattern)
    );
    if (fix) {
      return fix.suggestion;
    }
  }
  
  return undefined;
}

async function generateEmbedding(text: string): Promise<number[]> {
  // Simplified embedding - in production, use proper embedding model
  const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return Array(100).fill(0).map((_, i) => Math.sin(hash + i) * 0.5 + 0.5);
}

// Display functions
function displayTypePatterns(patterns: any[]): void {
  console.log(chalk.yellow('\n📋 Common type violations in this project:'));
  patterns.slice(0, 5).forEach((pattern, i) => {
    console.log(chalk.gray(`  ${i + 1}. ${pattern.category || pattern.error} (${pattern.count || pattern.frequency}x)`));
  });
}

function displayTypeCoverage(coverage: TypeCoverageMetrics): void {
  console.log(chalk.blue('\n📊 Type Coverage Analysis:'));
  
  const coverageColor = coverage.coverage >= 80 ? chalk.green :
                       coverage.coverage >= 60 ? chalk.yellow :
                       chalk.red;
  
  console.log(coverageColor(`  Type Coverage: ${coverage.coverage}%`));
  console.log(chalk.white(`  Total Lines: ${coverage.totalLines}`));
  console.log(chalk.white(`  Typed Lines: ${coverage.typedLines}`));
  
  if (coverage.anyUsage > 0) {
    console.log(chalk.yellow(`  ⚠️  'any' usage: ${coverage.anyUsage} occurrences`));
  } else {
    console.log(chalk.green(`  ✅ No 'any' usage`));
  }
  
  if (coverage.unknownUsage > 0) {
    console.log(chalk.blue(`  ℹ️  'unknown' usage: ${coverage.unknownUsage} occurrences`));
  }
  
  if (coverage.strictCompliance) {
    console.log(chalk.green(`  ✅ Strict mode compliant`));
  } else {
    console.log(chalk.yellow(`  ⚠️  Not strict mode compliant`));
  }
}

function displayTypePredictions(predictions: any[]): void {
  if (predictions.length > 0) {
    console.log(chalk.yellow('\n🔮 Predicted type safety issues:'));
    predictions.forEach((pred, i) => {
      console.log(chalk.yellow(`  ${i + 1}. [${pred.likelihood}] ${pred.issue}`));
      console.log(chalk.gray(`     Impact: ${pred.impact}`));
      console.log(chalk.cyan(`     Prevention: ${pred.prevention}`));
    });
  }
}

function displayFixResults(fixes: any[]): void {
  if (fixes.length > 0) {
    console.log(chalk.green('\n🔧 Type fixes available:'));
    fixes.forEach((fix, i) => {
      console.log(chalk.green(`  ${i + 1}. ${fix.file}:${fix.line}`));
      console.log(chalk.gray(`     Error: ${fix.error}`));
      console.log(chalk.cyan(`     Fix: ${fix.fix}`));
    });
  }
}

function displayTypeCheckResults(
  results: any,
  coverage: TypeCoverageMetrics | null,
  memoryPatterns: any
): void {
  console.log(chalk.blue('\n🔍 TypeScript Type Check Results:'));
  console.log(chalk.white(`  Files checked: ${results.fileCount}`));
  
  if (results.errorCount > 0) {
    console.log(chalk.red(`  ❌ Errors: ${results.errorCount}`));
  } else {
    console.log(chalk.green(`  ✅ Errors: 0`));
  }
  
  if (results.warningCount > 0) {
    console.log(chalk.yellow(`  ⚠️  Warnings: ${results.warningCount}`));
  } else {
    console.log(chalk.green(`  ✅ Warnings: 0`));
  }
  
  // Show type safety score
  const safetyScore = calculateTypeSafetyScore(results, coverage);
  const scoreColor = safetyScore >= 90 ? chalk.green :
                    safetyScore >= 70 ? chalk.yellow :
                    chalk.red;
  
  console.log(scoreColor(`\n🛡️  Type Safety Score: ${safetyScore}/100`));
  
  // Show trend from memory
  if (memoryPatterns?.coverageHistory?.coverage) {
    const prevCoverage = memoryPatterns.coverageHistory.coverage;
    const currentCoverage = coverage?.coverage || 0;
    const diff = currentCoverage - prevCoverage;
    const trend = diff > 0 ? chalk.green(`↑ +${diff.toFixed(1)}%`) :
                 diff < 0 ? chalk.red(`↓ ${diff.toFixed(1)}%`) :
                 chalk.gray('→ 0%');
    console.log(chalk.gray(`  Coverage trend: ${trend}`));
  }
  
  // Show violations
  if (results.violations.length > 0) {
    console.log(chalk.yellow('\n📁 Type violations:'));
    
    // Group by file
    const fileViolations = new Map<string, TypeViolation[]>();
    results.violations.forEach((v: TypeViolation) => {
      const violations = fileViolations.get(v.file) || [];
      violations.push(v);
      fileViolations.set(v.file, violations);
    });
    
    // Display up to 5 files
    let fileCount = 0;
    for (const [file, violations] of fileViolations.entries()) {
      if (fileCount >= 5) break;
      
      console.log(chalk.gray(`\n  ${file}`));
      violations.slice(0, 3).forEach(v => {
        const icon = v.category === 'error' ? '❌' : '⚠️';
        console.log(chalk.gray(`    ${icon} [${v.line}:${v.column}] ${v.error}`));
        if (v.suggestion) {
          console.log(chalk.cyan(`       💡 ${v.suggestion}`));
        }
      });
      
      if (violations.length > 3) {
        console.log(chalk.gray(`    ... and ${violations.length - 3} more`));
      }
      
      fileCount++;
    }
    
    if (fileViolations.size > 5) {
      console.log(chalk.gray(`\n  ... and ${fileViolations.size - 5} more files`));
    }
  }
}

function calculateTypeSafetyScore(
  results: any,
  coverage: TypeCoverageMetrics | null
): number {
  let score = 100;
  
  // Deduct for errors
  score -= results.errorCount * 2;
  
  // Deduct for warnings
  score -= results.warningCount * 0.5;
  
  // Factor in coverage if available
  if (coverage) {
    const coverageWeight = coverage.coverage * 0.3;
    score = score * 0.7 + coverageWeight;
    
    // Deduct for any usage
    score -= coverage.anyUsage * 0.5;
    
    // Bonus for strict compliance
    if (coverage.strictCompliance) {
      score += 5;
    }
  }
  
  return Math.max(0, Math.min(100, Math.round(score)));
}