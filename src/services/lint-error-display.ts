import chalk from 'chalk';
import { highlight } from 'cli-highlight';

export interface LintError {
  file: string;
  line: number;
  column: number;
  rule: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  code?: string;
}

export interface PastedContent {
  content: string;
  lineCount: number;
  type: 'code' | 'error' | 'log' | 'text';
  language?: string;
}

export class LintErrorDisplayService {
  private static instance: LintErrorDisplayService;

  public static getInstance(): LintErrorDisplayService {
    if (!LintErrorDisplayService.instance) {
      LintErrorDisplayService.instance = new LintErrorDisplayService();
    }
    return LintErrorDisplayService.instance;
  }

  /**
   * Parse pasted text content and detect if it contains lint errors
   */
  public parsePastedContent(content: string): PastedContent {
    const lines = content.split('\n');
    const lineCount = lines.length;

    // Detect content type based on patterns
    let type: PastedContent['type'] = 'text';
    let language: string | undefined;

    // Check for ESLint output
    if (
      content.includes('eslint') ||
      content.includes('.eslintrc') ||
      content.match(/\d+:\d+\s+(error|warning|info)/)
    ) {
      type = 'error';
      language = 'text';
    }
    // Check for TypeScript errors
    else if (content.includes('TS') && content.match(/TS\d+:/)) {
      type = 'error';
      language = 'typescript';
    }
    // Check for code patterns
    else if (
      content.includes('function') ||
      content.includes('const ') ||
      content.includes('import ') ||
      content.includes('export ')
    ) {
      type = 'code';
      language = this.detectLanguage(content);
    }
    // Check for log patterns
    else if (
      content.includes('ERROR') ||
      content.includes('WARN') ||
      content.includes('[ERROR]') ||
      content.includes('[WARN]')
    ) {
      type = 'log';
      language = 'text';
    }

    return {
      content,
      lineCount,
      type,
      language,
    };
  }

  /**
   * Detect programming language from code content
   */
  private detectLanguage(content: string): string {
    if (
      content.includes('import React') ||
      content.includes('useState') ||
      content.includes('jsx') ||
      content.includes('tsx')
    ) {
      return 'typescript';
    }
    if (
      content.includes('function') ||
      content.includes('const ') ||
      content.includes('let ') ||
      content.includes('var ')
    ) {
      return 'javascript';
    }
    if (content.includes('def ') || (content.includes('import ') && content.includes('from '))) {
      return 'python';
    }
    if (content.includes('package ') || content.includes('func ')) {
      return 'go';
    }
    if (content.includes('fn ') || content.includes('use ') || content.includes('impl ')) {
      return 'rust';
    }
    return 'text';
  }

  /**
   * Parse ESLint error output
   */
  public parseESLintErrors(output: string): LintError[] {
    const errors: LintError[] = [];
    const lines = output.split('\n');

    let currentFile = '';

    for (const line of lines) {
      // File path detection
      const fileMatch = line.match(/^(.+\.(?:js|ts|jsx|tsx))$/);
      if (fileMatch && fileMatch[1]) {
        currentFile = fileMatch[1];
        continue;
      }

      // Error line detection
      const errorMatch = line.match(
        /^\s*(\d+):(\d+)\s+(error|warning|info)\s+(.+?)\s+([a-z-/@]+)$/,
      );
      if (errorMatch && currentFile) {
        const [, lineNum, colNum, severity, message, rule] = errorMatch;
        if (lineNum && colNum && severity && message && rule) {
          errors.push({
            file: currentFile,
            line: parseInt(lineNum, 10),
            column: parseInt(colNum, 10),
            severity: severity as LintError['severity'],
            message: message.trim(),
            rule: rule.trim(),
          });
        }
      }
    }

    return errors;
  }

  /**
   * Parse TypeScript error output
   */
  public parseTypeScriptErrors(output: string): LintError[] {
    const errors: LintError[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
      // TypeScript error pattern: file.ts(line,col): error TSxxxx: message
      const tsMatch = line.match(/^(.+\.ts)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/);
      if (tsMatch) {
        const [, file, lineNum, colNum, severity, code, message] = tsMatch;
        if (file && lineNum && colNum && severity && code && message) {
          errors.push({
            file,
            line: parseInt(lineNum, 10),
            column: parseInt(colNum, 10),
            severity: severity as LintError['severity'],
            message: message.trim(),
            rule: code,
            code,
          });
        }
      }
    }

    return errors;
  }

  /**
   * Display pasted content with appropriate formatting
   */
  public displayPastedContent(pastedContent: PastedContent): void {
    const { content, lineCount, type, language } = pastedContent;

    // Display header with metadata
    console.log('\n' + chalk.cyan('📋 Pasted Content Analysis'));
    console.log(chalk.gray('=' + '='.repeat(50)));
    console.log(
      chalk.gray(`Type: ${type} | Lines: ${lineCount} | Language: ${language || 'auto-detected'}`),
    );
    console.log('');

    // Display content based on type
    switch (type) {
      case 'error':
        this.displayErrorContent(content);
        break;
      case 'code':
        this.displayCodeContent(content, language || 'typescript');
        break;
      case 'log':
        this.displayLogContent(content);
        break;
      default:
        this.displayTextContent(content);
        break;
    }
  }

  /**
   * Display error content with syntax highlighting and parsing
   */
  private displayErrorContent(content: string): void {
    // Try to parse as ESLint errors
    const eslintErrors = this.parseESLintErrors(content);
    if (eslintErrors.length > 0) {
      this.displayLintErrors(eslintErrors);
      return;
    }

    // Try to parse as TypeScript errors
    const tsErrors = this.parseTypeScriptErrors(content);
    if (tsErrors.length > 0) {
      this.displayLintErrors(tsErrors);
      return;
    }

    // Fallback to raw error display
    console.log(chalk.red('❌ Error Output:'));
    console.log(chalk.gray('─'.repeat(40)));

    const lines = content.split('\n');
    lines.forEach((line, index) => {
      const lineNum = chalk.gray(`${(index + 1).toString().padStart(3)}: `);

      // Highlight error patterns
      let formattedLine = line;
      if (line.includes('error')) {
        formattedLine = line.replace(/error/gi, chalk.red.bold('ERROR'));
      }
      if (line.includes('warning')) {
        formattedLine = formattedLine.replace(/warning/gi, chalk.yellow.bold('WARNING'));
      }
      if (line.match(/\d+:\d+/)) {
        formattedLine = formattedLine.replace(
          /(\d+):(\d+)/,
          chalk.cyan('$1') + ':' + chalk.cyan('$2'),
        );
      }

      console.log(lineNum + formattedLine);
    });
  }

  /**
   * Display parsed lint errors in a clean format
   */
  public displayLintErrors(errors: LintError[]): void {
    if (errors.length === 0) {
      console.log(chalk.green('✅ No lint errors found!'));
      return;
    }

    console.log(chalk.red.bold(`❌ Found ${errors.length} lint error(s):`));
    console.log('');

    // Group errors by file
    const errorsByFile = errors.reduce(
      (acc, error) => {
        if (!acc[error.file]) {
          acc[error.file] = [];
        }
        acc[error.file]!.push(error);
        return acc;
      },
      {} as Record<string, LintError[]>,
    );

    // Display errors grouped by file
    Object.entries(errorsByFile).forEach(([file, fileErrors]) => {
      console.log(chalk.bold.white(`📁 ${file}`));
      console.log(chalk.gray('─'.repeat(file.length + 2)));

      fileErrors.forEach((error) => {
        const severityIcon = {
          error: chalk.red('❌'),
          warning: chalk.yellow('⚠️'),
          info: chalk.blue('ℹ️'),
        }[error.severity];

        const location = chalk.cyan(`${error.line}:${error.column}`);
        const rule = chalk.gray(`[${error.rule}]`);

        console.log(`  ${severityIcon} ${location} ${error.message} ${rule}`);
      });

      console.log('');
    });

    // Display summary
    const errorCount = errors.filter((e) => e.severity === 'error').length;
    const warningCount = errors.filter((e) => e.severity === 'warning').length;

    console.log(chalk.gray('Summary:'));
    if (errorCount > 0) {
      console.log(`  ${chalk.red('❌')} ${errorCount} error(s)`);
    }
    if (warningCount > 0) {
      console.log(`  ${chalk.yellow('⚠️')} ${warningCount} warning(s)`);
    }
  }

  /**
   * Display code content with syntax highlighting
   */
  private displayCodeContent(content: string, language: string): void {
    console.log(chalk.green('💻 Code Content:'));
    console.log(chalk.gray('─'.repeat(40)));

    try {
      const highlighted = highlight(content, { language });
      console.log(highlighted);
    } catch {
      // Fallback to line-numbered display
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        const lineNum = chalk.gray(`${(index + 1).toString().padStart(3)}: `);
        console.log(lineNum + line);
      });
    }
  }

  /**
   * Display log content with color coding
   */
  private displayLogContent(content: string): void {
    console.log(chalk.blue('📄 Log Content:'));
    console.log(chalk.gray('─'.repeat(40)));

    const lines = content.split('\n');
    lines.forEach((line, index) => {
      const lineNum = chalk.gray(`${(index + 1).toString().padStart(3)}: `);

      let formattedLine = line;
      // Color code log levels
      if (line.includes('ERROR') || line.includes('[ERROR]')) {
        formattedLine = line.replace(/(ERROR|\[ERROR\])/gi, chalk.red.bold('$1'));
      } else if (line.includes('WARN') || line.includes('[WARN]')) {
        formattedLine = line.replace(/(WARN|\[WARN\])/gi, chalk.yellow.bold('$1'));
      } else if (line.includes('INFO') || line.includes('[INFO]')) {
        formattedLine = line.replace(/(INFO|\[INFO\])/gi, chalk.cyan.bold('$1'));
      } else if (line.includes('DEBUG') || line.includes('[DEBUG]')) {
        formattedLine = line.replace(/(DEBUG|\[DEBUG\])/gi, chalk.gray.bold('$1'));
      }

      console.log(lineNum + formattedLine);
    });
  }

  /**
   * Display plain text content
   */
  private displayTextContent(content: string): void {
    console.log(chalk.white('📝 Text Content:'));
    console.log(chalk.gray('─'.repeat(40)));

    const lines = content.split('\n');
    lines.forEach((line, index) => {
      const lineNum = chalk.gray(`${(index + 1).toString().padStart(3)}: `);
      console.log(lineNum + line);
    });
  }

  /**
   * Generate quick fix suggestions for common lint errors
   */
  public generateQuickFixes(errors: LintError[]): string[] {
    const suggestions: string[] = [];

    for (const error of errors) {
      const rule = error.rule.toLowerCase();

      if (rule.includes('no-unused-vars')) {
        suggestions.push(`Remove unused variable in ${error.file}:${error.line}`);
      } else if (rule.includes('no-console')) {
        suggestions.push(`Replace console.log with proper logging in ${error.file}:${error.line}`);
      } else if (rule.includes('prefer-const')) {
        suggestions.push(`Change 'let' to 'const' in ${error.file}:${error.line}`);
      } else if (rule.includes('no-var')) {
        suggestions.push(`Replace 'var' with 'let' or 'const' in ${error.file}:${error.line}`);
      } else if (rule.includes('semi')) {
        suggestions.push(`Fix semicolon usage in ${error.file}:${error.line}`);
      } else if (rule.includes('quotes')) {
        suggestions.push(`Fix quote style in ${error.file}:${error.line}`);
      }
    }

    return [...new Set(suggestions)]; // Remove duplicates
  }
}
