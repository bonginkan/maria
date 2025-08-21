/**
 * /lint Command - Comprehensive Lint Error Analysis
 * 
 * Analyzes the codebase for lint errors, style violations, and code quality issues
 * using ESLint, TSLint patterns, and custom rule checking.
 */

import { BaseCommand } from './base-command';
import { CommandContext, CommandResult, CommandArgs } from './types';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface LintError {
  severity: 'error' | 'warning' | 'info';
  rule: string;
  file: string;
  line: number;
  column: number;
  message: string;
  fixable: boolean;
  category: string;
}

interface LintResult {
  totalErrors: number;
  totalWarnings: number;
  errors: LintError[];
  warnings: LintError[];
  fixableCount: number;
  filesAnalyzed: number;
  rulesViolated: Set<string>;
  scanDuration: number;
}

export class LintAnalysisCommand extends BaseCommand {
  name = 'lint';
  description = 'Analyze codebase for lint errors and style violations';
  usage = '/lint [--fix] [--path=<dir>] [--severity=<level>] [--rule=<name>]';
  category = 'development' as const;
  
  private customRules = [
    // Import/Export Rules
    {
      name: 'import-order',
      pattern: /^import\s+.+$/gm,
      category: 'imports',
      check: (lines: string[]): LintError[] => {
        const errors: LintError[] = [];
        const importLines: Array<{line: number, text: string, type: string}> = [];
        
        lines.forEach((line, index) => {
          if (line.trim().startsWith('import')) {
            let type = 'external';
            if (line.includes('./') || line.includes('../')) {
              type = 'relative';
            } else if (line.includes('@/')) {
              type = 'alias';
            } else if (line.includes('react') || line.includes('next')) {
              type = 'framework';
            }
            importLines.push({ line: index + 1, text: line, type });
          }
        });
        
        // Check import order
        const expectedOrder = ['framework', 'external', 'alias', 'relative'];
        let lastTypeIndex = -1;
        
        for (const imp of importLines) {
          const currentTypeIndex = expectedOrder.indexOf(imp.type);
          if (currentTypeIndex < lastTypeIndex) {
            errors.push({
              severity: 'warning',
              rule: 'import-order',
              file: '',
              line: imp.line,
              column: 1,
              message: `Import should be grouped with other ${imp.type} imports`,
              fixable: true,
              category: 'imports'
            });
          }
          lastTypeIndex = Math.max(lastTypeIndex, currentTypeIndex);
        }
        
        return errors;
      }
    },
    
    // Naming Conventions
    {
      name: 'naming-convention',
      pattern: /(?:const|let|var|function)\s+(\w+)/g,
      category: 'naming',
      check: (lines: string[]): LintError[] => {
        const errors: LintError[] = [];
        
        lines.forEach((line, index) => {
          // Check for camelCase in variables
          const varMatch = line.match(/(?:const|let|var)\s+([A-Z_]+[A-Z0-9_]*)\s*=/);
          if (varMatch && !line.includes('process.env')) {
            const varName = varMatch[1];
            if (varName === varName.toUpperCase() && varName.length > 1) {
              // Allow CONSTANTS
              return;
            }
            if (varName[0] === varName[0].toUpperCase()) {
              errors.push({
                severity: 'warning',
                rule: 'naming-convention',
                file: '',
                line: index + 1,
                column: line.indexOf(varName) + 1,
                message: `Variable "${varName}" should be in camelCase`,
                fixable: true,
                category: 'naming'
              });
            }
          }
          
          // Check for PascalCase in functions (unless React component)
          const funcMatch = line.match(/function\s+([a-z]\w*)/);
          if (funcMatch && !line.includes('export default')) {
            const funcName = funcMatch[1];
            if (funcName[0] === funcName[0].toLowerCase() && lines[index - 1]?.includes('@Component')) {
              errors.push({
                severity: 'warning',
                rule: 'naming-convention',
                file: '',
                line: index + 1,
                column: line.indexOf(funcName) + 1,
                message: `Component function "${funcName}" should be in PascalCase`,
                fixable: true,
                category: 'naming'
              });
            }
          }
        });
        
        return errors;
      }
    },
    
    // Code Style Rules
    {
      name: 'max-line-length',
      pattern: /.{121,}/g,
      category: 'style',
      check: (lines: string[]): LintError[] => {
        const errors: LintError[] = [];
        const maxLength = 120;
        
        lines.forEach((line, index) => {
          if (line.length > maxLength && !line.includes('http') && !line.includes('data:')) {
            errors.push({
              severity: 'warning',
              rule: 'max-line-length',
              file: '',
              line: index + 1,
              column: maxLength + 1,
              message: `Line exceeds maximum length of ${maxLength} characters (${line.length})`,
              fixable: false,
              category: 'style'
            });
          }
        });
        
        return errors;
      }
    },
    
    // Semicolon Rules
    {
      name: 'semi',
      pattern: /[^;]\s*$/gm,
      category: 'style',
      check: (lines: string[]): LintError[] => {
        const errors: LintError[] = [];
        
        lines.forEach((line, index) => {
          const trimmed = line.trim();
          if (trimmed && 
              !trimmed.endsWith(';') && 
              !trimmed.endsWith('{') && 
              !trimmed.endsWith('}') &&
              !trimmed.endsWith(',') &&
              !trimmed.endsWith('(') &&
              !trimmed.endsWith(')') &&
              !trimmed.startsWith('//') &&
              !trimmed.startsWith('*') &&
              !trimmed.startsWith('import') &&
              !trimmed.startsWith('export') &&
              (trimmed.includes('const ') || 
               trimmed.includes('let ') || 
               trimmed.includes('var ') ||
               trimmed.includes('return ') ||
               trimmed.includes('break') ||
               trimmed.includes('continue'))) {
            errors.push({
              severity: 'error',
              rule: 'semi',
              file: '',
              line: index + 1,
              column: line.length,
              message: 'Missing semicolon',
              fixable: true,
              category: 'style'
            });
          }
        });
        
        return errors;
      }
    },
    
    // Spacing Rules
    {
      name: 'indent',
      pattern: /^[ \t]+/gm,
      category: 'style',
      check: (lines: string[]): LintError[] => {
        const errors: LintError[] = [];
        const expectedIndent = 2;
        
        lines.forEach((line, index) => {
          const leadingWhitespace = line.match(/^([ \t]+)/);
          if (leadingWhitespace) {
            const spaces = leadingWhitespace[1];
            
            // Check for tabs
            if (spaces.includes('\t')) {
              errors.push({
                severity: 'error',
                rule: 'no-tabs',
                file: '',
                line: index + 1,
                column: 1,
                message: 'Unexpected tab character',
                fixable: true,
                category: 'style'
              });
            }
            
            // Check for proper indentation
            if (spaces.length % expectedIndent !== 0) {
              errors.push({
                severity: 'warning',
                rule: 'indent',
                file: '',
                line: index + 1,
                column: 1,
                message: `Expected indentation of ${expectedIndent} spaces`,
                fixable: true,
                category: 'style'
              });
            }
          }
        });
        
        return errors;
      }
    },
    
    // Unused Code Detection
    {
      name: 'no-unused-vars',
      pattern: /(?:const|let|var)\s+(\w+)\s*=/g,
      category: 'quality',
      check: (lines: string[]): LintError[] => {
        const errors: LintError[] = [];
        const content = lines.join('\n');
        
        lines.forEach((line, index) => {
          const match = line.match(/(?:const|let|var)\s+(\w+)\s*=/);
          if (match) {
            const varName = match[1];
            // Simple check - count occurrences
            const occurrences = (content.match(new RegExp(`\\b${varName}\\b`, 'g')) || []).length;
            
            if (occurrences === 1 && !varName.startsWith('_')) {
              errors.push({
                severity: 'warning',
                rule: 'no-unused-vars',
                file: '',
                line: index + 1,
                column: line.indexOf(varName) + 1,
                message: `'${varName}' is defined but never used`,
                fixable: false,
                category: 'quality'
              });
            }
          }
        });
        
        return errors;
      }
    },
    
    // Console Statements
    {
      name: 'no-console',
      pattern: /console\.\w+\(/g,
      category: 'quality',
      check: (lines: string[]): LintError[] => {
        const errors: LintError[] = [];
        
        lines.forEach((line, index) => {
          if (line.includes('console.') && !line.trim().startsWith('//')) {
            const match = line.match(/console\.(\w+)/);
            if (match) {
              errors.push({
                severity: 'warning',
                rule: 'no-console',
                file: '',
                line: index + 1,
                column: line.indexOf('console.') + 1,
                message: `Unexpected console.${match[1]} statement`,
                fixable: true,
                category: 'quality'
              });
            }
          }
        });
        
        return errors;
      }
    },
    
    // Debugger Statements
    {
      name: 'no-debugger',
      pattern: /\bdebugger\b/g,
      category: 'quality',
      check: (lines: string[]): LintError[] => {
        const errors: LintError[] = [];
        
        lines.forEach((line, index) => {
          if (line.includes('debugger') && !line.trim().startsWith('//')) {
            errors.push({
              severity: 'error',
              rule: 'no-debugger',
              file: '',
              line: index + 1,
              column: line.indexOf('debugger') + 1,
              message: 'Unexpected debugger statement',
              fixable: true,
              category: 'quality'
              });
          }
        });
        
        return errors;
      }
    },
    
    // Trailing Spaces
    {
      name: 'no-trailing-spaces',
      pattern: /\s+$/gm,
      category: 'style',
      check: (lines: string[]): LintError[] => {
        const errors: LintError[] = [];
        
        lines.forEach((line, index) => {
          if (line !== line.trimEnd()) {
            errors.push({
              severity: 'warning',
              rule: 'no-trailing-spaces',
              file: '',
              line: index + 1,
              column: line.trimEnd().length + 1,
              message: 'Trailing spaces not allowed',
              fixable: true,
              category: 'style'
            });
          }
        });
        
        return errors;
      }
    },
    
    // Quotes Consistency
    {
      name: 'quotes',
      pattern: /["'`]/g,
      category: 'style',
      check: (lines: string[]): LintError[] => {
        const errors: LintError[] = [];
        
        lines.forEach((line, index) => {
          // Check for inconsistent quotes (prefer single quotes)
          const doubleQuotes = line.match(/"([^"]*)"/g);
          if (doubleQuotes && !line.includes('import') && !line.includes('export')) {
            doubleQuotes.forEach(match => {
              if (!match.includes("'")) {  // Don't flag if it contains single quotes
                errors.push({
                  severity: 'warning',
                  rule: 'quotes',
                  file: '',
                  line: index + 1,
                  column: line.indexOf(match) + 1,
                  message: 'Strings must use single quotes',
                  fixable: true,
                  category: 'style'
                });
              }
            });
          }
        });
        
        return errors;
      }
    }
  ];

  async execute(args: CommandArgs, context: CommandContext): Promise<CommandResult> {
    const startTime = Date.now();
    const targetPath = args.path || process.cwd();
    const shouldFix = args.fix === true;
    const severityFilter = args.severity as LintError['severity'] | undefined;
    const ruleFilter = args.rule as string | undefined;
    
    console.log(chalk.blue('🔍 Starting comprehensive lint analysis...'));
    console.log(chalk.gray(`Target: ${targetPath}`));
    
    try {
      // First, try to run ESLint if available
      const eslintResult = await this.runESLint(targetPath, shouldFix);
      
      // Get all source files
      const files = await this.getSourceFiles(targetPath);
      console.log(chalk.gray(`Found ${files.length} files to analyze`));
      
      const allErrors: LintError[] = [];
      let processedFiles = 0;
      
      // Analyze each file with custom rules
      for (const file of files) {
        const fileErrors = await this.analyzeFile(file);
        allErrors.push(...fileErrors);
        processedFiles++;
        
        // Progress indicator
        if (processedFiles % 10 === 0) {
          process.stdout.write(chalk.gray(`.`));
        }
      }
      
      console.log(); // New line after progress dots
      
      // Combine ESLint and custom rule results
      if (eslintResult) {
        allErrors.push(...eslintResult);
      }
      
      // Filter by severity and rule if specified
      let filteredErrors = allErrors;
      if (severityFilter) {
        filteredErrors = filteredErrors.filter(e => e.severity === severityFilter);
      }
      if (ruleFilter) {
        filteredErrors = filteredErrors.filter(e => e.rule === ruleFilter);
      }
      
      // Separate errors and warnings
      const errors = filteredErrors.filter(e => e.severity === 'error');
      const warnings = filteredErrors.filter(e => e.severity === 'warning');
      const fixable = filteredErrors.filter(e => e.fixable);
      
      // Get violated rules
      const rulesViolated = new Set(filteredErrors.map(e => e.rule));
      
      // Generate result
      const result: LintResult = {
        totalErrors: errors.length,
        totalWarnings: warnings.length,
        errors: errors.slice(0, 50),
        warnings: warnings.slice(0, 50),
        fixableCount: fixable.length,
        filesAnalyzed: files.length,
        rulesViolated,
        scanDuration: Date.now() - startTime
      };
      
      // Display results
      this.displayResults(result);
      
      // Auto-fix if requested
      if (shouldFix && result.fixableCount > 0) {
        console.log(chalk.yellow('\n🔧 Attempting to auto-fix issues...'));
        const fixedCount = await this.autoFixErrors(filteredErrors.filter(e => e.fixable));
        console.log(chalk.green(`✅ Fixed ${fixedCount} issues automatically`));
      }
      
      // Generate SOW if errors found
      if (result.totalErrors > 0 || result.totalWarnings > 0) {
        await this.generateLintFixSOW(result);
      }
      
      return {
        success: true,
        message: `Lint analysis complete: ${result.totalErrors} errors, ${result.totalWarnings} warnings`,
        data: result
      };
      
    } catch (error) {
      return {
        success: false,
        message: `Lint analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  private async runESLint(targetPath: string, fix: boolean): Promise<LintError[] | null> {
    try {
      // Check if ESLint is available
      const eslintConfigPath = path.join(targetPath, '.eslintrc.json');
      const eslintExists = await fs.access(eslintConfigPath).then(() => true).catch(() => false);
      
      if (!eslintExists) {
        console.log(chalk.gray('ESLint configuration not found, using custom rules only'));
        return null;
      }
      
      // Run ESLint
      const command = fix 
        ? `npx eslint . --ext .ts,.tsx,.js,.jsx --format json --fix`
        : `npx eslint . --ext .ts,.tsx,.js,.jsx --format json`;
        
      const { stdout } = await execAsync(command, { cwd: targetPath, maxBuffer: 10 * 1024 * 1024 });
      
      // Parse ESLint output
      const eslintResults = JSON.parse(stdout);
      const errors: LintError[] = [];
      
      for (const file of eslintResults) {
        for (const message of file.messages) {
          errors.push({
            severity: message.severity === 2 ? 'error' : 'warning',
            rule: message.ruleId || 'unknown',
            file: path.relative(targetPath, file.filePath),
            line: message.line,
            column: message.column,
            message: message.message,
            fixable: message.fix !== undefined,
            category: this.categorizeRule(message.ruleId || '')
          });
        }
      }
      
      return errors;
      
    } catch (error) {
      // ESLint might exit with non-zero code even when it works
      if (error instanceof Error && error.message.includes('Command failed')) {
        // Try to parse the output anyway
        const output = (error as any).stdout;
        if (output) {
          try {
            const eslintResults = JSON.parse(output);
            const errors: LintError[] = [];
            
            for (const file of eslintResults) {
              for (const message of file.messages) {
                errors.push({
                  severity: message.severity === 2 ? 'error' : 'warning',
                  rule: message.ruleId || 'unknown',
                  file: path.relative(targetPath, file.filePath),
                  line: message.line,
                  column: message.column,
                  message: message.message,
                  fixable: message.fix !== undefined,
                  category: this.categorizeRule(message.ruleId || '')
                });
              }
            }
            
            return errors;
          } catch {
            // Failed to parse, return null
          }
        }
      }
      
      return null;
    }
  }
  
  private categorizeRule(ruleId: string): string {
    if (ruleId.includes('import') || ruleId.includes('require')) return 'imports';
    if (ruleId.includes('naming') || ruleId.includes('camel') || ruleId.includes('pascal')) return 'naming';
    if (ruleId.includes('indent') || ruleId.includes('space') || ruleId.includes('quote')) return 'style';
    if (ruleId.includes('unused') || ruleId.includes('console') || ruleId.includes('debug')) return 'quality';
    if (ruleId.includes('security') || ruleId.includes('xss') || ruleId.includes('eval')) return 'security';
    return 'general';
  }
  
  private async getSourceFiles(targetPath: string): Promise<string[]> {
    const patterns = [
      '**/*.ts',
      '**/*.tsx',
      '**/*.js',
      '**/*.jsx'
    ];
    
    const ignorePatterns = [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/coverage/**',
      '**/*.test.*',
      '**/*.spec.*',
      '**/*.d.ts'
    ];
    
    const files: string[] = [];
    
    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: targetPath,
        ignore: ignorePatterns,
        absolute: true
      });
      files.push(...matches);
    }
    
    return files;
  }
  
  private async analyzeFile(filePath: string): Promise<LintError[]> {
    const errors: LintError[] = [];
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const relativePath = path.relative(process.cwd(), filePath);
      
      // Run each custom rule
      for (const rule of this.customRules) {
        const ruleErrors = rule.check(lines);
        
        // Add file path to each error
        for (const error of ruleErrors) {
          error.file = relativePath;
          errors.push(error);
        }
      }
      
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Failed to analyze ${filePath}: ${error}`));
    }
    
    return errors;
  }
  
  private displayResults(result: LintResult): void {
    console.log('\n' + chalk.bold('═══════════════════════════════════════════════════════════'));
    console.log(chalk.bold.cyan('                    LINT ANALYSIS REPORT                    '));
    console.log(chalk.bold('═══════════════════════════════════════════════════════════\n'));
    
    // Summary
    console.log(chalk.bold('📊 Summary:'));
    console.log(chalk.gray('├─') + ` Files analyzed: ${chalk.cyan(result.filesAnalyzed)}`);
    console.log(chalk.gray('├─') + ` Total errors: ${chalk.red(result.totalErrors)}`);
    console.log(chalk.gray('├─') + ` Total warnings: ${chalk.yellow(result.totalWarnings)}`);
    console.log(chalk.gray('├─') + ` Fixable issues: ${chalk.green(result.fixableCount)}`);
    console.log(chalk.gray('├─') + ` Rules violated: ${chalk.magenta(result.rulesViolated.size)}`);
    console.log(chalk.gray('└─') + ` Scan duration: ${chalk.green(result.scanDuration + 'ms')}\n`);
    
    // Rules violated
    if (result.rulesViolated.size > 0) {
      console.log(chalk.bold('📋 Rules Violated:'));
      const ruleArray = Array.from(result.rulesViolated);
      const ruleGroups: Record<string, string[]> = {};
      
      for (const rule of ruleArray) {
        const errors = [...result.errors, ...result.warnings].filter(e => e.rule === rule);
        const category = errors[0]?.category || 'general';
        if (!ruleGroups[category]) ruleGroups[category] = [];
        ruleGroups[category].push(`${rule} (${errors.length})`);
      }
      
      for (const [category, rules] of Object.entries(ruleGroups)) {
        console.log(chalk.gray(`  ${category}:`));
        for (const rule of rules) {
          console.log(chalk.gray(`    • ${rule}`));
        }
      }
    }
    
    // Top errors
    if (result.errors.length > 0) {
      console.log(chalk.bold('\n❌ Errors:'));
      console.log(chalk.gray('─'.repeat(60)));
      
      const displayCount = Math.min(10, result.errors.length);
      for (let i = 0; i < displayCount; i++) {
        const error = result.errors[i];
        console.log(`\n${chalk.red('error')}  ${error.message}`);
        console.log(chalk.gray(`  ${error.file}:${error.line}:${error.column}`));
        console.log(chalk.dim(`  Rule: ${error.rule}`) + (error.fixable ? chalk.green(' (fixable)') : ''));
      }
      
      if (result.errors.length > displayCount) {
        console.log(chalk.gray(`\n... and ${result.errors.length - displayCount} more errors`));
      }
    }
    
    // Top warnings
    if (result.warnings.length > 0) {
      console.log(chalk.bold('\n⚠️  Warnings:'));
      console.log(chalk.gray('─'.repeat(60)));
      
      const displayCount = Math.min(10, result.warnings.length);
      for (let i = 0; i < displayCount; i++) {
        const warning = result.warnings[i];
        console.log(`\n${chalk.yellow('warning')}  ${warning.message}`);
        console.log(chalk.gray(`  ${warning.file}:${warning.line}:${warning.column}`));
        console.log(chalk.dim(`  Rule: ${warning.rule}`) + (warning.fixable ? chalk.green(' (fixable)') : ''));
      }
      
      if (result.warnings.length > displayCount) {
        console.log(chalk.gray(`\n... and ${result.warnings.length - displayCount} more warnings`));
      }
    }
    
    if (result.totalErrors === 0 && result.totalWarnings === 0) {
      console.log(chalk.green('\n✅ No lint issues found! Your code is clean.'));
    } else if (result.fixableCount > 0) {
      console.log(chalk.yellow(`\n💡 ${result.fixableCount} issues can be automatically fixed with --fix`));
    }
    
    console.log('\n' + chalk.bold('═══════════════════════════════════════════════════════════\n'));
  }
  
  private async autoFixErrors(errors: LintError[]): Promise<number> {
    const fileFixMap = new Map<string, Array<{line: number, column: number, fix: string, rule: string}>>();
    
    // Group fixes by file
    for (const error of errors) {
      if (!error.fixable || !error.file) continue;
      
      const fixes = fileFixMap.get(error.file) || [];
      
      switch (error.rule) {
        case 'semi':
          fixes.push({
            line: error.line,
            column: error.column,
            fix: ';',
            rule: error.rule
          });
          break;
          
        case 'quotes':
          fixes.push({
            line: error.line,
            column: error.column,
            fix: 'replace-quotes',
            rule: error.rule
          });
          break;
          
        case 'no-trailing-spaces':
          fixes.push({
            line: error.line,
            column: error.column,
            fix: 'trim',
            rule: error.rule
          });
          break;
          
        case 'no-console':
          fixes.push({
            line: error.line,
            column: error.column,
            fix: 'remove-console',
            rule: error.rule
          });
          break;
          
        case 'no-debugger':
          fixes.push({
            line: error.line,
            column: error.column,
            fix: 'remove-debugger',
            rule: error.rule
          });
          break;
          
        case 'indent':
        case 'no-tabs':
          fixes.push({
            line: error.line,
            column: error.column,
            fix: 'fix-indent',
            rule: error.rule
          });
          break;
      }
      
      fileFixMap.set(error.file, fixes);
    }
    
    // Apply fixes to each file
    let totalFixed = 0;
    
    for (const [file, fixes] of fileFixMap) {
      try {
        const fullPath = path.join(process.cwd(), file);
        const content = await fs.readFile(fullPath, 'utf-8');
        const lines = content.split('\n');
        
        // Sort fixes by line number (reverse order to maintain line numbers)
        fixes.sort((a, b) => b.line - a.line);
        
        for (const fix of fixes) {
          const lineIndex = fix.line - 1;
          if (lineIndex >= 0 && lineIndex < lines.length) {
            let line = lines[lineIndex];
            
            switch (fix.fix) {
              case ';':
                if (!line.trimEnd().endsWith(';')) {
                  lines[lineIndex] = line.trimEnd() + ';';
                  totalFixed++;
                }
                break;
                
              case 'replace-quotes':
                lines[lineIndex] = line.replace(/"/g, "'");
                totalFixed++;
                break;
                
              case 'trim':
                lines[lineIndex] = line.trimEnd();
                totalFixed++;
                break;
                
              case 'remove-console':
                lines[lineIndex] = line.replace(/console\.\w+\([^)]*\);?/, '// console statement removed by linter');
                totalFixed++;
                break;
                
              case 'remove-debugger':
                lines[lineIndex] = line.replace(/\bdebugger\b;?/, '// debugger removed by linter');
                totalFixed++;
                break;
                
              case 'fix-indent':
                const leadingWhitespace = line.match(/^[\s\t]*/);
                if (leadingWhitespace) {
                  const spaces = leadingWhitespace[0].replace(/\t/g, '  ');
                  const indentLevel = Math.round(spaces.length / 2) * 2;
                  lines[lineIndex] = ' '.repeat(indentLevel) + line.trimStart();
                  totalFixed++;
                }
                break;
            }
          }
        }
        
        await fs.writeFile(fullPath, lines.join('\n'));
        
      } catch (error) {
        console.warn(chalk.yellow(`Failed to auto-fix ${file}: ${error}`));
      }
    }
    
    return totalFixed;
  }
  
  private async generateLintFixSOW(result: LintResult): Promise<void> {
    const sowPath = path.join(process.cwd(), 'docs', '03-sow', 'LINT_FIX_SOW.md');
    
    const rulesByCategory: Record<string, Array<{rule: string, count: number}>> = {};
    
    for (const error of [...result.errors, ...result.warnings]) {
      const category = error.category;
      if (!rulesByCategory[category]) rulesByCategory[category] = [];
      
      const existing = rulesByCategory[category].find(r => r.rule === error.rule);
      if (existing) {
        existing.count++;
      } else {
        rulesByCategory[category].push({ rule: error.rule, count: 1 });
      }
    }
    
    const sow = `# 🧹 Lint Fix SOW (Statement of Work)

**Generated**: ${new Date().toISOString()}
**Total Issues**: ${result.totalErrors + result.totalWarnings}
**Priority**: ${result.totalErrors > 0 ? '🔴 HIGH' : '🟡 MEDIUM'}

## 📊 Lint Analysis Summary

- **Errors**: ${result.totalErrors}
- **Warnings**: ${result.totalWarnings}
- **Auto-fixable**: ${result.fixableCount}
- **Files Analyzed**: ${result.filesAnalyzed}
- **Rules Violated**: ${result.rulesViolated.size}

## 📋 Issues by Category

${Object.entries(rulesByCategory).map(([category, rules]) => `
### ${category.charAt(0).toUpperCase() + category.slice(1)}
${rules.sort((a, b) => b.count - a.count).map(r => 
  `- ${r.rule}: ${r.count} violations`
).join('\n')}
`).join('\n')}

## 🎯 Fix Priority Plan

### Phase 1: Errors (Immediate)
${result.errors.slice(0, 20).map(error => 
  `- [ ] Fix ${error.rule} in ${error.file}:${error.line}${error.fixable ? ' (auto-fixable)' : ''}`
).join('\n')}

### Phase 2: Warnings (1-2 days)
${result.warnings.slice(0, 20).map(warning => 
  `- [ ] Fix ${warning.rule} in ${warning.file}:${warning.line}${warning.fixable ? ' (auto-fixable)' : ''}`
).join('\n')}

## 🔧 Recommended Actions

1. **Immediate**: Run \`/lint --fix\` to auto-fix ${result.fixableCount} issues
2. **Short-term**: Manually fix remaining errors
3. **Medium-term**: Address warnings for code quality
4. **Long-term**: Add pre-commit hooks to prevent future issues

## 📝 ESLint Configuration Updates

Consider updating your ESLint configuration to enforce these rules:

\`\`\`json
{
  "rules": {
    "semi": ["error", "always"],
    "quotes": ["error", "single"],
    "indent": ["error", 2],
    "no-console": "warn",
    "no-debugger": "error",
    "no-trailing-spaces": "error",
    "no-unused-vars": "warn"
  }
}
\`\`\`

## 📊 Success Metrics

- [ ] Zero ESLint errors
- [ ] Warnings reduced by 80%
- [ ] Pre-commit hooks configured
- [ ] CI/CD lint checks passing
- [ ] Team adoption of lint standards

---
Generated by MARIA Lint Analysis Tool
`;
    
    try {
      await fs.mkdir(path.dirname(sowPath), { recursive: true });
      await fs.writeFile(sowPath, sow);
      console.log(chalk.green(`\n📄 Lint fix SOW generated: ${sowPath}`));
    } catch (error) {
      console.warn(chalk.yellow(`Failed to generate SOW: ${error}`));
    }
  }
}

export default LintAnalysisCommand;