/**
 * Review Command
 * コードレビュー機能の実装
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';
import { logger } from '../utils/logger.js';

export const reviewCommand = new Command('review')
  .description('AI-powered code review')
  .option('-f, --file <path>', 'Review specific file')
  .option('-d, --diff', 'Review git diff')
  .option('-b, --branch <branch>', 'Review changes in branch')
  .option('--pr <number>', 'Review pull request')
  .option('--security', 'Include security analysis')
  .option('--performance', 'Include performance analysis')
  .option('--style', 'Include code style analysis')
  .option('--all', 'Include all analysis types')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🔍 Starting AI Code Review...'));

      let filesToReview: string[] = [];
      let diffContent = '';

      // Determine what to review
      if (options.file) {
        // Review specific file
        const filePath = path.resolve(options.file);
        if (await fileExists(filePath)) {
          filesToReview.push(filePath);
          console.log(chalk.gray(`Reviewing file: ${filePath}`));
        } else {
          console.error(chalk.red(`File not found: ${filePath}`));
          process.exit(1);
        }
      } else if (options.diff) {
        // Review git diff
        try {
          diffContent = execSync('git diff HEAD', { encoding: 'utf8' });
          if (!diffContent) {
            diffContent = execSync('git diff --cached', { encoding: 'utf8' });
          }
          console.log(chalk.gray('Reviewing git diff...'));
        } catch (error: unknown) {
          console.error(chalk.red('Failed to get git diff'));
          process.exit(1);
        }
      } else if (options.branch) {
        // Review branch changes
        try {
          diffContent = execSync(`git diff main...${options.branch}`, { encoding: 'utf8' });
          console.log(chalk.gray(`Reviewing branch: ${options.branch}`));
        } catch (error: unknown) {
          console.error(chalk.red(`Failed to get diff for branch: ${options.branch}`));
          process.exit(1);
        }
      } else if (options.pr) {
        // Review PR (requires gh CLI)
        try {
          diffContent = execSync(`gh pr diff ${options.pr}`, { encoding: 'utf8' });
          console.log(chalk.gray(`Reviewing PR #${options.pr}`));
        } catch (error: unknown) {
          console.error(chalk.red(`Failed to get PR diff. Make sure 'gh' CLI is installed.`));
          process.exit(1);
        }
      } else {
        // Default: review changed files
        try {
          const changedFiles = execSync('git diff --name-only HEAD', { encoding: 'utf8' })
            .split('\n')
            .filter((f) => f);

          if (changedFiles.length === 0) {
            const stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf8' })
              .split('\n')
              .filter((f) => f);
            filesToReview = stagedFiles;
          } else {
            filesToReview = changedFiles;
          }

          if (filesToReview.length === 0) {
            console.log(chalk.yellow('No changes to review'));
            process.exit(0);
          }

          console.log(chalk.gray(`Reviewing ${filesToReview.length} changed files...`));
        } catch (error: unknown) {
          console.error(chalk.red('Failed to get changed files'));
          process.exit(1);
        }
      }

      // Perform review
      const review = await performReview(filesToReview, diffContent, options);

      // Display results
      displayReviewResults(review);
    } catch (error: unknown) {
      console.error(chalk.red('Review failed:'), error);
      process.exit(1);
    }
  });

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

interface ReviewResult {
  summary: string;
  issues: ReviewIssue[];
  suggestions: string[];
  metrics: ReviewMetrics;
}

interface ReviewIssue {
  severity: 'critical' | 'warning' | 'info';
  type: string;
  file?: string;
  line?: number;
  message: string;
  suggestion?: string;
}

interface ReviewMetrics {
  filesReviewed: number;
  issuesFound: number;
  criticalIssues: number;
  codeQualityScore: number;
}

interface ReviewOptions {
  all?: boolean;
  security?: boolean;
  performance?: boolean;
  style?: boolean;
  detailed?: boolean;
}

async function performReview(
  files: string[],
  diff: string,
  options: ReviewOptions,
): Promise<ReviewResult> {
  const issues: ReviewIssue[] = [];
  const suggestions: string[] = [];

  // Analyze files or diff
  if (diff) {
    // Analyze diff content
    const diffIssues = analyzeDiff(diff, options);
    issues.push(...diffIssues);
  } else {
    // Analyze files
    for (const file of files) {
      const fileIssues = await analyzeFile(file, options);
      issues.push(...fileIssues);
    }
  }

  // Generate suggestions
  if (options.all || options.security) {
    suggestions.push('Consider running security audit: npm audit');
  }

  if (options.all || options.performance) {
    suggestions.push('Profile performance with: npm run profile');
  }

  if (options.all || options.style) {
    suggestions.push('Format code with: npm run format');
  }

  // Calculate metrics
  const metrics: ReviewMetrics = {
    filesReviewed: files.length || 1,
    issuesFound: issues.length,
    criticalIssues: issues.filter((i) => i.severity === 'critical').length,
    codeQualityScore: calculateQualityScore(issues),
  };

  return {
    summary: generateSummary(metrics),
    issues,
    suggestions,
    metrics,
  };
}

function analyzeDiff(diff: string, options: ReviewOptions): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  const lines = diff.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Security checks
    if (options.all || options.security) {
      if (line?.includes('eval(') || line?.includes('exec(')) {
        issues.push({
          severity: 'critical',
          type: 'security',
          line: i + 1,
          message: 'Potential security risk: eval/exec usage',
          suggestion: 'Avoid using eval/exec, use safer alternatives',
        });
      }

      if (
        line &&
        /api[_-]?key|secret|password|token/i.test(line) &&
        !line.includes('process.env')
      ) {
        issues.push({
          severity: 'critical',
          type: 'security',
          line: i + 1,
          message: 'Potential hardcoded secret',
          suggestion: 'Use environment variables for sensitive data',
        });
      }
    }

    // Performance checks
    if (options.all || options.performance) {
      if (line?.includes('forEach') && line?.includes('async')) {
        issues.push({
          severity: 'warning',
          type: 'performance',
          line: i + 1,
          message: 'forEach with async/await may cause performance issues',
          suggestion: 'Use for...of or Promise.all() for async operations',
        });
      }
    }

    // Style checks
    if (options.all || options.style) {
      if (line?.includes('console.log') && !line?.includes('// eslint-disable')) {
        issues.push({
          severity: 'info',
          type: 'style',
          line: i + 1,
          message: 'Console.log found',
          suggestion: 'Remove console.log or use proper logging',
        });
      }
    }
  }

  return issues;
}

async function analyzeFile(filePath: string, options: unknown): Promise<ReviewIssue[]> {
  const issues: ReviewIssue[] = [];

  try {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n');
    const ext = path.extname(filePath);

    // TypeScript/JavaScript specific checks
    if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for any type
        if (line?.includes(': any') || line?.includes('<unknown>')) {
          issues.push({
            severity: 'warning',
            type: 'type-safety',
            file: filePath,
            line: i + 1,
            message: 'Usage of "any" type detected',
            suggestion: 'Use specific types instead of "any"',
          });
        }

        // Check for TODO comments
        if (line?.includes('TODO') || line?.includes('FIXME')) {
          issues.push({
            severity: 'info',
            type: 'maintenance',
            file: filePath,
            line: i + 1,
            message: 'TODO/FIXME comment found',
            suggestion: 'Address TODO items or create issues',
          });
        }

        // Check for long lines
        if (line && line.length > 120) {
          issues.push({
            severity: 'info',
            type: 'style',
            file: filePath,
            line: i + 1,
            message: 'Line exceeds 120 characters',
            suggestion: 'Break long lines for better readability',
          });
        }
      }
    }
  } catch (error: unknown) {
    logger.error(`Failed to analyze file ${filePath}:`, error);
  }

  return issues;
}

function calculateQualityScore(issues: ReviewIssue[]): number {
  let score = 100;

  for (const issue of issues) {
    switch (issue.severity) {
      case 'critical':
        score -= 10;
        break;
      case 'warning':
        score -= 5;
        break;
      case 'info':
        score -= 1;
        break;
    }
  }

  return Math.max(0, score);
}

function generateSummary(metrics: ReviewMetrics): string {
  const { filesReviewed, issuesFound, criticalIssues, codeQualityScore } = metrics;

  let summary = `Reviewed ${filesReviewed} file(s), found ${issuesFound} issue(s)`;

  if (criticalIssues > 0) {
    summary += ` (${criticalIssues} critical)`;
  }

  summary += `. Code quality score: ${codeQualityScore}/100`;

  return summary;
}

function displayReviewResults(review: ReviewResult): void {
  console.log(`\n${  chalk.bold('📊 Review Summary')}`);
  console.log(chalk.gray('─'.repeat(50)));
  console.log(review.summary);

  if (review.issues.length > 0) {
    console.log(`\n${  chalk.bold('🔍 Issues Found:')}`);

    // Group issues by severity
    const critical = review.issues.filter((i) => i.severity === 'critical');
    const warnings = review.issues.filter((i) => i.severity === 'warning');
    const info = review.issues.filter((i) => i.severity === 'info');

    if (critical.length > 0) {
      console.log(chalk.red('\n🚨 Critical Issues:'));
      critical.forEach((issue) => {
        console.log(chalk.red(`  • ${issue.message}`));
        if (issue.file) {
          console.log(chalk.gray(`    ${issue.file}:${issue.line || '?'}`));
        }
        if (issue.suggestion) {
          console.log(chalk.yellow(`    💡 ${issue.suggestion}`));
        }
      });
    }

    if (warnings.length > 0) {
      console.log(chalk.yellow('\n⚠️  Warnings:'));
      warnings.forEach((issue) => {
        console.log(chalk.yellow(`  • ${issue.message}`));
        if (issue.file) {
          console.log(chalk.gray(`    ${issue.file}:${issue.line || '?'}`));
        }
        if (issue.suggestion) {
          console.log(chalk.cyan(`    💡 ${issue.suggestion}`));
        }
      });
    }

    if (info.length > 0) {
      console.log(chalk.blue('\nℹ️  Information:'));
      info.forEach((issue) => {
        console.log(chalk.blue(`  • ${issue.message}`));
        if (issue.file) {
          console.log(chalk.gray(`    ${issue.file}:${issue.line || '?'}`));
        }
      });
    }
  }

  if (review.suggestions.length > 0) {
    console.log(`\n${  chalk.bold('💡 Suggestions:')}`);
    review.suggestions.forEach((suggestion) => {
      console.log(chalk.cyan(`  • ${suggestion}`));
    });
  }

  // Quality score visualization
  const score = review.metrics.codeQualityScore;
  let scoreColor = chalk.green;
  let scoreEmoji = '✅';

  if (score < 60) {
    scoreColor = chalk.red;
    scoreEmoji = '❌';
  } else if (score < 80) {
    scoreColor = chalk.yellow;
    scoreEmoji = '⚠️';
  }

  console.log(`\n${  chalk.bold('📈 Code Quality:')}`);
  console.log(scoreColor(`  ${scoreEmoji} Score: ${score}/100`));

  // Progress bar
  const barLength = 30;
  const filledLength = Math.round((score / 100) * barLength);
  const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
  console.log(chalk.gray('  [') + scoreColor(bar) + chalk.gray(']'));
}

export default reviewCommand;
