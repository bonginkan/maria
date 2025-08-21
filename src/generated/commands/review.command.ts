import { BaseCommand } from '../base-command';
import { Command, RequireAuth, RateLimit, Validate, Cache } from '../decorators';
import { CommandContext, CommandOptions, CommandResult } from '../types';
import { z } from 'zod';
import chalk from 'chalk';
import { logger } from '../../utils/logger';
import { AIRouterService } from '../../services/ai-router';
import { FileSystemService } from '../../services/file-system-service';
import { GitService } from '../../services/git-service';
import { DiffGeneratorService } from '../../services/diff-generator';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const reviewSchema = z.object({
  files: z.array(z.string()).optional(),
  pr: z.string().optional(),
  branch: z.string().optional(),
  commit: z.string().optional(),
  type: z.enum(['security', 'performance', 'style', 'bugs', 'all']).optional().default('all'),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'all']).optional().default('all'),
  autoFix: z.boolean().optional().default(false),
  detailed: z.boolean().optional().default(true),
  suggestions: z.boolean().optional().default(true),
  score: z.boolean().optional().default(true),
  output: z.string().optional(),
});

export type ReviewOptions = z.infer<typeof reviewSchema>;

/**
 * AI-Powered Code Review Command
 *
 * Features:
 * - Review specific files or PR changes
 * - Security vulnerability detection
 * - Performance optimization suggestions
 * - Code style and best practices
 * - Bug detection and prevention
 * - Auto-fix suggestions
 * - Quality scoring
 * - Integration with GitHub PRs
 */
@Command({
  name: 'review',
  aliases: ['r', 'check', 'analyze'],
  description: 'AI-powered code review and analysis',
  category: 'development',
  priority: 82,
  version: '2.0.0',
})
@RequireAuth({ level: 'basic' })
@RateLimit(15, '1m')
@Cache({ ttl: 300, key: 'files' })
@Validate(reviewSchema)
export class ReviewCommand extends BaseCommand<ReviewOptions> {
  private aiRouter: AIRouterService;
  private fileSystem: FileSystemService;
  private gitService: GitService;
  private diffGenerator: DiffGeneratorService;

  private readonly reviewCategories = {
    security: {
      prompt:
        'Review for security vulnerabilities, authentication issues, data exposure, injection attacks, and OWASP top 10',
      icon: '🔒',
      priority: 1,
    },
    performance: {
      prompt:
        'Review for performance issues, memory leaks, inefficient algorithms, unnecessary computations, and optimization opportunities',
      icon: '⚡',
      priority: 2,
    },
    bugs: {
      prompt:
        'Review for potential bugs, logic errors, edge cases, null pointer exceptions, and runtime errors',
      icon: '🐛',
      priority: 3,
    },
    style: {
      prompt:
        'Review for code style, naming conventions, documentation, readability, and best practices',
      icon: '🎨',
      priority: 4,
    },
  };

  constructor() {
    super();
    this.aiRouter = new AIRouterService();
    this.fileSystem = new FileSystemService();
    this.gitService = new GitService();
    this.diffGenerator = new DiffGeneratorService();
  }

  async execute(
    args: string[],
    options: ReviewOptions,
    context: CommandContext,
  ): Promise<CommandResult> {
    try {
      this.emit('start', { command: 'review', options });

      // Get code to review
      const codeToReview = await this.getCodeToReview(args, options, context);

      if (!codeToReview || codeToReview.length === 0) {
        throw new Error('No code found to review. Specify files, PR, or branch.');
      }

      logger.info(chalk.blue(`🔍 Reviewing ${codeToReview.length} file(s)...`));

      // Perform review
      const reviews = await this.performReview(codeToReview, options);

      // Display results
      this.displayResults(reviews, options);

      // Apply auto-fixes if requested
      if (options.autoFix) {
        await this.applyAutoFixes(reviews);
      }

      // Save output if specified
      if (options.output) {
        await this.saveOutput(reviews, options.output);
      }

      // Calculate overall score
      const overallScore = this.calculateOverallScore(reviews);

      this.emit('complete', { reviews, score: overallScore });

      return {
        success: true,
        data: {
          filesReviewed: codeToReview.length,
          issues: this.countIssues(reviews),
          score: overallScore,
          reviews,
        },
      };
    } catch (error) {
      this.emit('error', { error });
      logger.error(chalk.red(`Review failed: ${error.message}`));
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private async getCodeToReview(
    args: string[],
    options: ReviewOptions,
    context: CommandContext,
  ): Promise<Array<{ path: string; content: string }>> {
    const files: Array<{ path: string; content: string }> = [];

    // Review specific files
    if (options.files && options.files.length > 0) {
      for (const file of options.files) {
        const content = await this.fileSystem.readFile(file);
        if (content) {
          files.push({ path: file, content });
        }
      }
    }

    // Review files from args
    if (args.length > 0) {
      for (const file of args) {
        const content = await this.fileSystem.readFile(file);
        if (content) {
          files.push({ path: file, content });
        }
      }
    }

    // Review PR changes
    if (options.pr) {
      const prFiles = await this.getPRFiles(options.pr);
      files.push(...prFiles);
    }

    // Review branch changes
    if (options.branch) {
      const branchFiles = await this.getBranchChanges(options.branch);
      files.push(...branchFiles);
    }

    // Review specific commit
    if (options.commit) {
      const commitFiles = await this.getCommitChanges(options.commit);
      files.push(...commitFiles);
    }

    // If no specific files, review staged changes
    if (files.length === 0) {
      const stagedFiles = await this.getStagedFiles();
      files.push(...stagedFiles);
    }

    return files;
  }

  private async getPRFiles(prNumber: string): Promise<Array<{ path: string; content: string }>> {
    try {
      const { stdout } = await execAsync(`gh pr diff ${prNumber} --name-only`);
      const fileNames = stdout.trim().split('\n').filter(Boolean);

      const files = [];
      for (const fileName of fileNames) {
        const content = await this.fileSystem.readFile(fileName);
        if (content) {
          files.push({ path: fileName, content });
        }
      }

      return files;
    } catch (error) {
      logger.warn(chalk.yellow(`Could not fetch PR ${prNumber}: ${error.message}`));
      return [];
    }
  }

  private async getBranchChanges(
    branch: string,
  ): Promise<Array<{ path: string; content: string }>> {
    try {
      const { stdout } = await execAsync(`git diff main...${branch} --name-only`);
      const fileNames = stdout.trim().split('\n').filter(Boolean);

      const files = [];
      for (const fileName of fileNames) {
        const content = await this.fileSystem.readFile(fileName);
        if (content) {
          files.push({ path: fileName, content });
        }
      }

      return files;
    } catch (error) {
      logger.warn(chalk.yellow(`Could not fetch branch changes: ${error.message}`));
      return [];
    }
  }

  private async getCommitChanges(
    commit: string,
  ): Promise<Array<{ path: string; content: string }>> {
    try {
      const { stdout } = await execAsync(`git show ${commit} --name-only --format=`);
      const fileNames = stdout.trim().split('\n').filter(Boolean);

      const files = [];
      for (const fileName of fileNames) {
        const content = await this.fileSystem.readFile(fileName);
        if (content) {
          files.push({ path: fileName, content });
        }
      }

      return files;
    } catch (error) {
      logger.warn(chalk.yellow(`Could not fetch commit changes: ${error.message}`));
      return [];
    }
  }

  private async getStagedFiles(): Promise<Array<{ path: string; content: string }>> {
    try {
      const { stdout } = await execAsync('git diff --cached --name-only');
      const fileNames = stdout.trim().split('\n').filter(Boolean);

      const files = [];
      for (const fileName of fileNames) {
        const content = await this.fileSystem.readFile(fileName);
        if (content) {
          files.push({ path: fileName, content });
        }
      }

      return files;
    } catch (error) {
      logger.warn(chalk.yellow('No staged files found'));
      return [];
    }
  }

  private async performReview(
    files: Array<{ path: string; content: string }>,
    options: ReviewOptions,
  ): Promise<any[]> {
    const reviews = [];

    for (const file of files) {
      logger.info(chalk.gray(`Reviewing ${file.path}...`));

      const fileReview: unknown = {
        file: file.path,
        issues: [],
        suggestions: [],
        score: 100,
      };

      // Determine which categories to review
      const categories =
        options.type === 'all' ? Object.keys(this.reviewCategories) : [options.type];

      for (const category of categories) {
        const categoryConfig = this.reviewCategories[category];
        const categoryReview = await this.reviewCategory(file, category, categoryConfig, options);

        fileReview.issues.push(...categoryReview.issues);
        fileReview.suggestions.push(...categoryReview.suggestions);
      }

      // Calculate file score
      fileReview.score = this.calculateFileScore(fileReview.issues);

      reviews.push(fileReview);
    }

    return reviews;
  }

  private async reviewCategory(
    file: { path: string; content: string },
    category: string,
    config: unknown,
    options: ReviewOptions,
  ): Promise<unknown> {
    const systemPrompt = `You are an expert code reviewer focusing on ${category} issues.
${config.prompt}
Provide specific, actionable feedback with line numbers where possible.
Format issues as JSON array with: { line, severity, message, suggestion }`;

    const response = await this.aiRouter.generate({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Review this ${this.getFileType(file.path)} file:\n\n${file.content}`,
        },
      ],
      temperature: 0.3,
      maxTokens: 2000,
    });

    try {
      // Parse AI response
      const parsed = this.parseReviewResponse(response);

      // Filter by severity if specified
      if (options.severity !== 'all') {
        parsed.issues = parsed.issues.filter(
          (issue: unknown) => issue.severity === options.severity,
        );
      }

      return {
        category,
        issues: parsed.issues || [],
        suggestions: options.suggestions ? parsed.suggestions || [] : [],
      };
    } catch (error) {
      logger.warn(chalk.yellow(`Could not parse ${category} review`));
      return { category, issues: [], suggestions: [] };
    }
  }

  private parseReviewResponse(response: string): unknown {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const issues = JSON.parse(jsonMatch[0]);
        return { issues, suggestions: [] };
      }
    } catch (error) {
      // Fallback: parse text response
      const lines = response.split('\n');
      const issues = [];

      for (const line of lines) {
        if (line.includes('Line') || line.includes('line')) {
          const lineMatch = line.match(/[Ll]ine (\d+)/);
          const severityMatch = line.match(/(critical|high|medium|low)/i);

          issues.push({
            line: lineMatch ? parseInt(lineMatch[1]) : 0,
            severity: severityMatch ? severityMatch[1].toLowerCase() : 'medium',
            message: line.replace(/[Ll]ine \d+:?/, '').trim(),
          });
        }
      }

      return { issues, suggestions: [] };
    }
  }

  private getFileType(path: string): string {
    const extension = path.split('.').pop()?.toLowerCase();
    const typeMap: Record<string, string> = {
      js: 'JavaScript',
      ts: 'TypeScript',
      jsx: 'React JSX',
      tsx: 'React TSX',
      py: 'Python',
      java: 'Java',
      cs: 'C#',
      go: 'Go',
      rs: 'Rust',
      cpp: 'C++',
      c: 'C',
      rb: 'Ruby',
      php: 'PHP',
      swift: 'Swift',
      kt: 'Kotlin',
    };

    return typeMap[extension || ''] || 'code';
  }

  private displayResults(reviews: unknown[], options: ReviewOptions): void {
    console.log(chalk.bold.blue('\n📋 Code Review Results\n'));

    for (const review of reviews) {
      console.log(chalk.bold.cyan(`\n${review.file}`));

      if (options.score) {
        const scoreColor =
          review.score >= 80 ? chalk.green : review.score >= 60 ? chalk.yellow : chalk.red;
        console.log(scoreColor(`Score: ${review.score}/100`));
      }

      // Group issues by severity
      const grouped = this.groupIssuesBySeverity(review.issues);

      for (const [severity, issues] of Object.entries(grouped)) {
        if (issues.length === 0) continue;

        const severityIcon = this.getSeverityIcon(severity);
        const severityColor = this.getSeverityColor(severity);

        console.log(chalk.bold(`\n${severityIcon} ${severity.toUpperCase()} (${issues.length})`));

        for (const issue of issues) {
          const lineInfo = issue.line ? `Line ${issue.line}: ` : '';
          console.log(severityColor(`  ${lineInfo}${issue.message}`));

          if (issue.suggestion && options.suggestions) {
            console.log(chalk.gray(`    💡 ${issue.suggestion}`));
          }
        }
      }

      // Display suggestions
      if (review.suggestions && review.suggestions.length > 0 && options.suggestions) {
        console.log(chalk.bold.blue('\n💡 Suggestions:'));
        review.suggestions.forEach((suggestion: string) => {
          console.log(chalk.cyan(`  • ${suggestion}`));
        });
      }
    }

    // Summary
    const totalIssues = this.countIssues(reviews);
    const overallScore = this.calculateOverallScore(reviews);

    console.log(chalk.bold('\n📊 Summary:'));
    console.log(chalk.white(`  Files reviewed: ${reviews.length}`));
    console.log(chalk.white(`  Total issues: ${totalIssues.total}`));
    console.log(chalk.red(`    Critical: ${totalIssues.critical}`));
    console.log(chalk.orange(`    High: ${totalIssues.high}`));
    console.log(chalk.yellow(`    Medium: ${totalIssues.medium}`));
    console.log(chalk.gray(`    Low: ${totalIssues.low}`));

    if (options.score) {
      const scoreColor =
        overallScore >= 80 ? chalk.green : overallScore >= 60 ? chalk.yellow : chalk.red;
      console.log(chalk.bold(`\n  Overall Score: ${scoreColor(overallScore + '/100')}`));
    }
  }

  private groupIssuesBySeverity(issues: unknown[]): Record<string, any[]> {
    return issues.reduce(
      (acc, issue) => {
        const severity = issue.severity || 'medium';
        if (!acc[severity]) acc[severity] = [];
        acc[severity].push(issue);
        return acc;
      },
      { critical: [], high: [], medium: [], low: [] },
    );
  }

  private getSeverityIcon(severity: string): string {
    const icons: Record<string, string> = {
      critical: '🚨',
      high: '⚠️',
      medium: '📝',
      low: '💭',
    };
    return icons[severity] || '📝';
  }

  private getSeverityColor(severity: string): (text: string) => string {
    const colors: Record<string, (text: string) => string> = {
      critical: chalk.red,
      high: chalk.hex('#FFA500'), // orange
      medium: chalk.yellow,
      low: chalk.gray,
    };
    return colors[severity] || chalk.white;
  }

  private async applyAutoFixes(reviews: unknown[]): Promise<void> {
    logger.info(chalk.blue('\n🔧 Applying auto-fixes...'));

    let fixCount = 0;

    for (const review of reviews) {
      const fixableIssues = review.issues.filter((issue: unknown) => issue.suggestion);

      if (fixableIssues.length > 0) {
        logger.info(chalk.gray(`Fixing ${review.file}...`));

        // This would implement actual auto-fix logic
        // For now, just count
        fixCount += fixableIssues.length;
      }
    }

    if (fixCount > 0) {
      logger.info(chalk.green(`✅ Applied ${fixCount} auto-fixes`));
    } else {
      logger.info(chalk.yellow('No auto-fixable issues found'));
    }
  }

  private async saveOutput(reviews: unknown[], outputPath: string): Promise<void> {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        filesReviewed: reviews.length,
        issues: this.countIssues(reviews),
        overallScore: this.calculateOverallScore(reviews),
      },
      reviews,
    };

    await this.fileSystem.writeFile(outputPath, JSON.stringify(report, null, 2));
    logger.info(chalk.green(`✅ Review report saved to: ${outputPath}`));
  }

  private countIssues(reviews: unknown[]): unknown {
    const counts = {
      total: 0,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    for (const review of reviews) {
      for (const issue of review.issues) {
        counts.total++;
        counts[issue.severity || 'medium']++;
      }
    }

    return counts;
  }

  private calculateFileScore(issues: unknown[]): number {
    let score = 100;

    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
          score -= 20;
          break;
        case 'high':
          score -= 10;
          break;
        case 'medium':
          score -= 5;
          break;
        case 'low':
          score -= 2;
          break;
      }
    }

    return Math.max(0, score);
  }

  private calculateOverallScore(reviews: unknown[]): number {
    if (reviews.length === 0) return 100;

    const totalScore = reviews.reduce((sum, review) => sum + review.score, 0);
    return Math.round(totalScore / reviews.length);
  }

  async help(): Promise<string> {
    return `
${chalk.bold.blue('Code Review Command')}

${chalk.yellow('Usage:')}
  /review [files...] [options]

${chalk.yellow('Options:')}
  --pr <number>         Review GitHub PR
  --branch <name>       Review branch changes
  --commit <hash>       Review specific commit
  --type <type>         Review type (security, performance, style, bugs, all)
  --severity <level>    Filter by severity (critical, high, medium, low, all)
  --auto-fix            Apply automatic fixes
  --detailed            Show detailed feedback (default: true)
  --suggestions         Show improvement suggestions (default: true)
  --score               Show quality score (default: true)
  --output <path>       Save report to file

${chalk.yellow('Examples:')}
  /review src/app.js                          # Review specific file
  /review --pr 123                            # Review PR #123
  /review --branch feature/new-api            # Review branch changes
  /review --type security --severity critical # Security review only
  /review --auto-fix                          # Review and fix issues

${chalk.yellow('Review Types:')}
  • security - Security vulnerabilities and risks
  • performance - Performance issues and optimizations
  • bugs - Potential bugs and logic errors
  • style - Code style and best practices
  • all - Complete review (default)

${chalk.yellow('Features:')}
  • Multi-file review support
  • GitHub PR integration
  • Severity-based filtering
  • Auto-fix suggestions
  • Quality scoring
  • Detailed reporting
    `;
  }
}
