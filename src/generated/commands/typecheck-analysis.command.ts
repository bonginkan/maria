/**
 * /typecheck Command - Comprehensive TypeScript Type Checking Analysis
 * 
 * Analyzes TypeScript code for type errors, missing types, unsafe type assertions,
 * and provides comprehensive type safety analysis with auto-fix capabilities.
 */

import { BaseCommand } from './base-command';
import { _CommandContext, CommandResult, _CommandArgs } from './types';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface TypeError {
  severity: 'error' | 'warning' | 'suggestion';
  code: string;
  file: string;
  line: number;
  column: number;
  message: string;
  category: string;
  fixable: boolean;
  suggestion?: string;
  codeSnippet?: string;
}

interface TypeCheckResult {
  totalErrors: number;
  totalWarnings: number;
  totalSuggestions: number;
  errors: TypeError[];
  warnings: TypeError[];
  suggestions: TypeError[];
  filesAnalyzed: number;
  typeCoverage: number;
  strictModeEnabled: boolean;
  compilerOptions: any;
  scanDuration: number;
}

export class TypeCheckAnalysisCommand extends BaseCommand {
  name = 'typecheck';
  description = 'Analyze TypeScript code for type errors and type safety issues';
  usage = '/typecheck [--fix] [--strict] [--path=<dir>] [--coverage]';
  category = 'development' as const;
  
  private typePatterns = [
    // Unsafe Type Assertions
    {
      pattern: /as\s+any\b/g,
      category: 'unsafe-types',
      severity: 'warning' as const,
      message: 'Use of "any" type defeats type safety',
      fixable: true,
      suggestion: 'Replace with specific type or unknown'
    },
    {
      pattern: /as\s+\w+\s*\[\]/g,
      category: 'unsafe-types',
      severity: 'warning' as const,
      message: 'Type assertion without runtime validation',
      fixable: false,
      suggestion: 'Add runtime type checking'
    },
    {
      pattern: /@ts-ignore/g,
      category: 'type-suppression',
      severity: 'error' as const,
      message: 'TypeScript error suppression without justification',
      fixable: false,
      suggestion: 'Fix underlying type issue or use @ts-expect-error with explanation'
    },
    {
      pattern: /@ts-nocheck/g,
      category: 'type-suppression',
      severity: 'error' as const,
      message: 'File excluded from type checking',
      fixable: false,
      suggestion: 'Enable type checking and fix type errors'
    },
    
    // Missing Type Annotations
    {
      pattern: /function\s+\w+\s*\([^)]*\)\s*{/g,
      category: 'missing-types',
      severity: 'suggestion' as const,
      message: 'Function missing return type annotation',
      fixable: true,
      suggestion: 'Add explicit return type annotation'
    },
    {
      pattern: /const\s+\w+\s*=\s*\([^)]*\)\s*=>/g,
      category: 'missing-types',
      severity: 'suggestion' as const,
      message: 'Arrow function missing type annotations',
      fixable: true,
      suggestion: 'Add parameter and return type annotations'
    },
    {
      pattern: /let\s+\w+(?:\s*:\s*any)?\s*;/g,
      category: 'missing-types',
      severity: 'warning' as const,
      message: 'Variable declared without type annotation',
      fixable: true,
      suggestion: 'Add explicit type annotation'
    },
    
    // Potentially Unsafe Operations
    {
      pattern: /\w+!\.\w+/g,
      category: 'unsafe-operations',
      severity: 'warning' as const,
      message: 'Non-null assertion without null check',
      fixable: false,
      suggestion: 'Add null check or use optional chaining'
    },
    {
      pattern: /\w+\?\.\w+\s*as\s+\w+/g,
      category: 'unsafe-operations',
      severity: 'warning' as const,
      message: 'Type assertion on optional property',
      fixable: false,
      suggestion: 'Check for undefined before assertion'
    },
    
    // Interface and Type Issues
    {
      pattern: /interface\s+\w+\s*{\s*\[key:\s*string\]:\s*any\s*}/g,
      category: 'interface-issues',
      severity: 'warning' as const,
      message: 'Interface with any index signature',
      fixable: true,
      suggestion: 'Use specific types or unknown for index signature'
    },
    {
      pattern: /type\s+\w+\s*=\s*any/g,
      category: 'interface-issues',
      severity: 'error' as const,
      message: 'Type alias defined as any',
      fixable: true,
      suggestion: 'Define proper type structure'
    },
    
    // Generic Issues
    {
      pattern: /<\s*any\s*>/g,
      category: 'generic-issues',
      severity: 'warning' as const,
      message: 'Generic parameter specified as any',
      fixable: true,
      suggestion: 'Use specific type or constraint'
    },
    {
      pattern: /extends\s+any\b/g,
      category: 'generic-issues',
      severity: 'warning' as const,
      message: 'Generic constraint extends any',
      fixable: true,
      suggestion: 'Use more specific constraint'
    },
    
    // React-specific Type Issues
    {
      pattern: /React\.FC<unknown>/g,
      category: 'react-types',
      severity: 'warning' as const,
      message: 'React component with any props type',
      fixable: true,
      suggestion: 'Define proper props interface'
    },
    {
      pattern: /useState<unknown>/g,
      category: 'react-types',
      severity: 'warning' as const,
      message: 'useState hook with any type',
      fixable: true,
      suggestion: 'Specify proper state type'
    },
    
    // Import/Export Type Issues
    {
      pattern: /import\s+\*\s+as\s+\w+\s+from\s+['"][^'"]+['"](?![^;]*type)/g,
      category: 'import-issues',
      severity: 'suggestion' as const,
      message: 'Star import without type-only import',
      fixable: true,
      suggestion: 'Use type-only imports for types'
    },
    
    // Error Handling Types
    {
      pattern: /catch\s*\(\s*(\w+)\s*\)/g,
      category: 'error-handling',
      severity: 'suggestion' as const,
      message: 'Catch parameter without type annotation',
      fixable: true,
      suggestion: 'Type catch parameter as unknown and type guard'
    }
  ];

  async execute(args: CommandArgs, context: CommandContext): Promise<CommandResult> {
    const startTime = Date.now();
    const targetPath = args.path || process.cwd();
    const shouldFix = args.fix === true;
    const strictMode = args.strict === true;
    const showCoverage = args.coverage === true;
    
    console.log(chalk.blue('🔍 Starting comprehensive TypeScript type analysis...'));
    console.log(chalk.gray(`Target: ${targetPath}`));
    
    try {
      // Check for TypeScript configuration
      const tsConfigPath = await this.findTsConfig(targetPath);
      if (!tsConfigPath) {
        return {
          success: false,
          message: 'No TypeScript configuration found. Please ensure tsconfig.json exists.'
        };
      }
      
      // Run TypeScript compiler
      const tscResult = await this.runTypeScriptCompiler(targetPath, strictMode);
      
      // Get all TypeScript files
      const files = await this.getTypeScriptFiles(targetPath);
      console.log(chalk.gray(`Found ${files.length} TypeScript files`));
      
      const allErrors: TypeError[] = [];
      let processedFiles = 0;
      
      // Analyze each file with custom type patterns
      for (const file of files) {
        const fileErrors = await this.analyzeTypeFile(file);
        allErrors.push(...fileErrors);
        processedFiles++;
        
        // Progress indicator
        if (processedFiles % 10 === 0) {
          process.stdout.write(chalk.gray(`.`));
        }
      }
      
      console.log(); // New line after progress dots
      
      // Combine TypeScript compiler errors with custom analysis
      if (tscResult) {
        allErrors.push(...tscResult);
      }
      
      // Calculate type coverage
      const typeCoverage = showCoverage ? await this.calculateTypeCoverage(files) : 0;
      
      // Read compiler options
      const compilerOptions = await this.getCompilerOptions(tsConfigPath);
      
      // Categorize errors
      const errors = allErrors.filter(e => e.severity === 'error');
      const warnings = allErrors.filter(e => e.severity === 'warning');
      const suggestions = allErrors.filter(e => e.severity === 'suggestion');
      
      // Generate result
      const result: TypeCheckResult = {
        totalErrors: errors.length,
        totalWarnings: warnings.length,
        totalSuggestions: suggestions.length,
        errors: errors.slice(0, 50),
        warnings: warnings.slice(0, 50),
        suggestions: suggestions.slice(0, 30),
        filesAnalyzed: files.length,
        typeCoverage,
        strictModeEnabled: this.isStrictModeEnabled(compilerOptions),
        compilerOptions,
        scanDuration: Date.now() - startTime
      };
      
      // Display results
      this.displayResults(result);
      
      // Auto-fix if requested
      if (shouldFix && (result.totalErrors > 0 || result.totalWarnings > 0)) {
        console.log(chalk.yellow('\n🔧 Attempting to auto-fix type issues...'));
        const fixedCount = await this.autoFixTypeErrors([...errors, ...warnings].filter(e => e.fixable));
        console.log(chalk.green(`✅ Fixed ${fixedCount} type issues automatically`));
      }
      
      // Generate SOW
      if (result.totalErrors > 0 || result.totalWarnings > 0) {
        await this.generateTypeFixSOW(result);
      }
      
      return {
        success: true,
        message: `Type analysis complete: ${result.totalErrors} errors, ${result.totalWarnings} warnings`,
        data: result
      };
      
    } catch (error) {
      return {
        success: false,
        message: `Type analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  private async findTsConfig(targetPath: string): Promise<string | null> {
    const possiblePaths = [
      path.join(targetPath, 'tsconfig.json'),
      path.join(targetPath, 'tsconfig.base.json'),
      path.join(targetPath, 'src', 'tsconfig.json')
    ];
    
    for (const configPath of possiblePaths) {
      try {
        await fs.access(configPath);
        return configPath;
      } catch {
        continue;
      }
    }
    
    return null;
  }
  
  private async runTypeScriptCompiler(targetPath: string, strictMode: boolean): Promise<TypeError[] | null> {
    try {
      const command = strictMode 
        ? 'npx tsc --noEmit --strict --pretty false'
        : 'npx tsc --noEmit --pretty false';
        
      const { stdout, _stderr } = await execAsync(command, { 
        cwd: targetPath,
        maxBuffer: 10 * 1024 * 1024 
      });
      
      return this.parseTscOutput(stderr || stdout);
      
    } catch (error) {
      // TypeScript compilation might fail, but we can still parse the output
      if (error instanceof Error && 'stdout' in error) {
        const output = (error as any).stderr || (error as any).stdout || '';
        return this.parseTscOutput(output);
      }
      
      console.warn(chalk.yellow('Failed to run TypeScript compiler, using pattern analysis only'));
      return null;
    }
  }
  
  private parseTscOutput(output: string): TypeError[] {
    const errors: TypeError[] = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      // Parse TypeScript error format: file.ts(line,col): error TS####: message
      const match = line.match(/^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+TS(\d+):\s*(.+)$/);
      if (match) {
        const [, file, line, column, severity, code, message] = match;
        
        errors.push({
          severity: severity as 'error' | 'warning',
          code: `TS${code}`,
          file: path.relative(process.cwd(), file),
          line: parseInt(line),
          column: parseInt(column),
          message: message.trim(),
          category: this.categorizeTypeScriptError(code),
          fixable: this.isTypeScriptErrorFixable(code),
          suggestion: this.getTypeScriptErrorSuggestion(code, message)
        });
      }
    }
    
    return errors;
  }
  
  private categorizeTypeScriptError(code: string): string {
    const errorCategories: Record<string, string> = {
      '2322': 'type-mismatch',      // Type is not assignable
      '2339': 'property-missing',   // Property does not exist
      '2345': 'argument-mismatch',  // Argument type mismatch
      '2304': 'name-not-found',     // Cannot find name
      '2307': 'module-not-found',   // Cannot find module
      '2571': 'object-is-unknown',  // Object is of type unknown
      '2531': 'object-null',        // Object is possibly null
      '2532': 'object-undefined',   // Object is possibly undefined
      '2344': 'generic-mismatch',   // Generic type argument count
      '2769': 'excess-property',    // Type has excess property
      '2741': 'property-missing-type', // Property missing in type
      '7053': 'implicit-any',       // Element implicitly has any type
      '7030': 'not-all-paths-return', // Not all code paths return
      '2366': 'arithmetic-operand', // Left-hand side of arithmetic operation
      '2365': 'comparison-operator', // Operator cannot be applied
      '2349': 'call-signature',     // Expression is not callable
      '2448': 'block-scoped',       // Block-scoped variable used before declaration
      '2554': 'parameter-count',    // Expected parameters but got
      '2555': 'overload-match',     // No overload matches this call
    };
    
    return errorCategories[code] || 'general';
  }
  
  private isTypeScriptErrorFixable(code: string): boolean {
    const fixableErrors = [
      '7053', // implicit any
      '2531', // possibly null
      '2532', // possibly undefined
      '2322', // type mismatch (some cases)
      '2769', // excess property
    ];
    
    return fixableErrors.includes(code);
  }
  
  private getTypeScriptErrorSuggestion(code: string, message: string): string {
    const suggestions: Record<string, string> = {
      '2322': 'Check type compatibility and cast if necessary',
      '2339': 'Verify property exists or use optional chaining',
      '2345': 'Check function parameters match expected types',
      '2304': 'Import missing module or check spelling',
      '2307': 'Install package or check import path',
      '2571': 'Add type assertion or type guard',
      '2531': 'Add null check before accessing property',
      '2532': 'Add undefined check or use optional chaining',
      '2344': 'Check generic type argument count',
      '2769': 'Remove excess property or update interface',
      '2741': 'Add missing property to object',
      '7053': 'Add explicit type annotation',
      '7030': 'Ensure all code paths return a value',
      '2366': 'Check operand types for arithmetic operation',
      '2365': 'Verify operator compatibility with types',
      '2349': 'Check if expression is callable',
      '2448': 'Move declaration before usage',
      '2554': 'Check parameter count matches function signature',
      '2555': 'Review function overloads and argument types'
    };
    
    return suggestions[code] || 'Review TypeScript documentation for this error';
  }
  
  private async getTypeScriptFiles(targetPath: string): Promise<string[]> {
    const patterns = [
      '**/*.ts',
      '**/*.tsx'
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
  
  private async analyzeTypeFile(filePath: string): Promise<TypeError[]> {
    const errors: TypeError[] = [];
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const relativePath = path.relative(process.cwd(), filePath);
      
      // Check each type pattern
      for (const pattern of this.typePatterns) {
        const regex = new RegExp(pattern.pattern.source, pattern.pattern.flags);
        let match;
        
        while ((match = regex.exec(content)) !== null) {
          const lineNumber = this.getLineNumber(content, match.index);
          const columnNumber = this.getColumnNumber(content, match.index);
          const codeSnippet = this.getCodeSnippet(lines, lineNumber);
          
          errors.push({
            severity: pattern.severity,
            code: 'CUSTOM',
            file: relativePath,
            line: lineNumber,
            column: columnNumber,
            message: pattern.message,
            category: pattern.category,
            fixable: pattern.fixable,
            suggestion: pattern.suggestion,
            codeSnippet
          });
        }
      }
      
      // Additional complex type analysis
      errors.push(...await this.performAdvancedTypeAnalysis(filePath, content));
      
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Failed to analyze ${filePath}: ${error}`));
    }
    
    return errors;
  }
  
  private async performAdvancedTypeAnalysis(filePath: string, content: string): Promise<TypeError[]> {
    const errors: TypeError[] = [];
    const lines = content.split('\n');
    
    // Check for missing type imports
    const typeUsage = content.match(/:\s*(\w+)(?:\[\])?/g);
    const typeImports = content.match(/import\s+.*{([^}]+)}.*from/g);
    
    if (typeUsage && typeImports) {
      const usedTypes = new Set(typeUsage.map(t => t.replace(/:\s*/, '').replace(/\[\]$/, '')));
      const importedTypes = new Set();
      
      typeImports.forEach(imp => {
        const matches = imp.match(/{([^}]+)}/);
        if (matches) {
          matches[1].split(',').forEach(type => {
            importedTypes.add(type.trim());
          });
        }
      });
      
      for (const type of usedTypes) {
        if (!importedTypes.has(type) && !['string', 'number', 'boolean', 'object', 'any', 'unknown'].includes(type)) {
          errors.push({
            severity: 'warning',
            code: 'MISSING_IMPORT',
            file: path.relative(process.cwd(), filePath),
            line: 1,
            column: 1,
            message: `Type '${type}' is used but not imported`,
            category: 'import-issues',
            fixable: false,
            suggestion: `Import ${type} from appropriate module`
          });
        }
      }
    }
    
    // Check for complex any usage
    lines.forEach((line, _index) => {
      if (line.includes('any') && !line.trim().startsWith('//')) {
        const contexts = [
          'Record<string, any>',
          'any[]',
          'Promise<unknown>',
          'Observable<unknown>',
          'Subject<unknown>'
        ];
        
        for (const context of contexts) {
          if (line.includes(context)) {
            errors.push({
              severity: 'warning',
              code: 'COMPLEX_ANY',
              file: path.relative(process.cwd(), filePath),
              line: index + 1,
              column: line.indexOf(context) + 1,
              message: `Complex any type usage: ${context}`,
              category: 'unsafe-types',
              fixable: true,
              suggestion: 'Define specific type interface'
            });
          }
        }
      }
    });
    
    return errors;
  }
  
  private async calculateTypeCoverage(files: string[]): Promise<number> {
    let totalLines = 0;
    let typedLines = 0;
    
    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('*')) {
            totalLines++;
            
            // Simple heuristic for typed lines
            if (trimmed.includes(':') && !trimmed.includes('//') &&
                (trimmed.includes('string') || trimmed.includes('number') || 
                 trimmed.includes('boolean') || trimmed.includes('object') ||
                 trimmed.match(/:\s*\w+/) || trimmed.includes('interface') ||
                 trimmed.includes('type ') || trimmed.includes('enum '))) {
              typedLines++;
            }
          }
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }
    
    return totalLines > 0 ? Math.round((typedLines / totalLines) * 100) : 0;
  }
  
  private async getCompilerOptions(tsConfigPath: string): Promise<unknown> {
    try {
      const content = await fs.readFile(tsConfigPath, 'utf-8');
      const config = JSON.parse(content);
      return config.compilerOptions || {};
    } catch (error) {
      return {};
    }
  }
  
  private isStrictModeEnabled(compilerOptions: any): boolean {
    return compilerOptions.strict === true ||
           (compilerOptions.noImplicitAny === true &&
            compilerOptions.strictNullChecks === true &&
            compilerOptions.strictFunctionTypes === true &&
            compilerOptions.strictBindCallApply === true &&
            compilerOptions.strictPropertyInitialization === true);
  }
  
  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }
  
  private getColumnNumber(content: string, index: number): number {
    const lines = content.substring(0, index).split('\n');
    const lastLine = lines[lines.length - 1];
    return lastLine.length + 1;
  }
  
  private getCodeSnippet(lines: string[], lineNumber: number, context: number = 2): string {
    const start = Math.max(0, lineNumber - context - 1);
    const end = Math.min(lines.length, lineNumber + context);
    
    return lines.slice(start, end)
      .map((line, i) => {
        const currentLine = start + i + 1;
        const marker = currentLine === lineNumber ? '>' : ' ';
        return `${marker} ${currentLine.toString().padStart(4)}: ${line}`;
      })
      .join('\n');
  }
  
  private displayResults(result: TypeCheckResult): void {
    console.log('\n' + chalk.bold('═══════════════════════════════════════════════════════════'));
    console.log(chalk.bold.cyan('                 TYPESCRIPT TYPE ANALYSIS REPORT            '));
    console.log(chalk.bold('═══════════════════════════════════════════════════════════\n'));
    
    // Summary
    console.log(chalk.bold('📊 Summary:'));
    console.log(chalk.gray('├─') + ` Files analyzed: ${chalk.cyan(result.filesAnalyzed)}`);
    console.log(chalk.gray('├─') + ` Type errors: ${chalk.red(result.totalErrors)}`);
    console.log(chalk.gray('├─') + ` Type warnings: ${chalk.yellow(result.totalWarnings)}`);
    console.log(chalk.gray('├─') + ` Suggestions: ${chalk.blue(result.totalSuggestions)}`);
    if (result.typeCoverage > 0) {
      console.log(chalk.gray('├─') + ` Type coverage: ${chalk.green(result.typeCoverage + '%')}`);
    }
    console.log(chalk.gray('├─') + ` Strict mode: ${result.strictModeEnabled ? chalk.green('✓ Enabled') : chalk.yellow('✗ Disabled')}`);
    console.log(chalk.gray('└─') + ` Scan duration: ${chalk.green(result.scanDuration + 'ms')}\n`);
    
    // Compiler options
    if (Object.keys(result.compilerOptions).length > 0) {
      console.log(chalk.bold('⚙️  TypeScript Configuration:'));
      const importantOptions = ['strict', 'noImplicitAny', 'strictNullChecks', 'noUnusedLocals', 'noUnusedParameters'];
      for (const option of importantOptions) {
        if (option in result.compilerOptions) {
          const value = result.compilerOptions[option];
          const color = value ? chalk.green : chalk.red;
          console.log(chalk.gray(`  ${option}: `) + color(value.toString()));
        }
      }
      console.log();
    }
    
    // Type errors
    if (result.errors.length > 0) {
      console.log(chalk.bold('❌ Type Errors:'));
      console.log(chalk.gray('─'.repeat(60)));
      
      const displayCount = Math.min(10, result.errors.length);
      for (let i = 0; i < displayCount; i++) {
        const error = result.errors[i];
        console.log(`\n${chalk.red('error')} ${error.code}: ${error.message}`);
        console.log(chalk.gray(`  ${error.file}:${error.line}:${error.column}`));
        console.log(chalk.dim(`  Category: ${error.category}`) + (error.fixable ? chalk.green(' (fixable)') : ''));
        
        if (error.suggestion) {
          console.log(chalk.green(`  💡 ${error.suggestion}`));
        }
        
        if (error.codeSnippet) {
          console.log(chalk.dim('\nCode:'));
          console.log(chalk.dim(error.codeSnippet));
        }
      }
      
      if (result.errors.length > displayCount) {
        console.log(chalk.gray(`\n... and ${result.errors.length - displayCount} more errors`));
      }
    }
    
    // Type warnings
    if (result.warnings.length > 0) {
      console.log(chalk.bold('\n⚠️  Type Warnings:'));
      console.log(chalk.gray('─'.repeat(60)));
      
      const displayCount = Math.min(5, result.warnings.length);
      for (let i = 0; i < displayCount; i++) {
        const warning = result.warnings[i];
        console.log(`\n${chalk.yellow('warning')}: ${warning.message}`);
        console.log(chalk.gray(`  ${warning.file}:${warning.line}:${warning.column}`));
        console.log(chalk.dim(`  Category: ${warning.category}`) + (warning.fixable ? chalk.green(' (fixable)') : ''));
        
        if (warning.suggestion) {
          console.log(chalk.green(`  💡 ${warning.suggestion}`));
        }
      }
      
      if (result.warnings.length > displayCount) {
        console.log(chalk.gray(`\n... and ${result.warnings.length - displayCount} more warnings`));
      }
    }
    
    if (result.totalErrors === 0 && result.totalWarnings === 0) {
      console.log(chalk.green('\n✅ No type errors found! Your TypeScript code is type-safe.'));
    } else {
      const fixableCount = [...result.errors, ...result.warnings].filter(e => e.fixable).length;
      if (fixableCount > 0) {
        console.log(chalk.yellow(`\n💡 ${fixableCount} issues can be automatically fixed with --fix`));
      }
    }
    
    console.log('\n' + chalk.bold('═══════════════════════════════════════════════════════════\n'));
  }
  
  private async autoFixTypeErrors(errors: TypeError[]): Promise<number> {
    const fileFixMap = new Map<string, Array<{line: number, column: number, fix: string, original: string}>>();
    
    // Group fixes by file
    for (const error of errors) {
      if (!error.fixable || !error.file) continue;
      
      const fixes = fileFixMap.get(error.file) || [];
      
      switch (error.category) {
        case 'unsafe-types':
          if (error.message.includes('any')) {
            fixes.push({
              line: error.line,
              column: error.column,
              fix: 'unknown',
              original: 'any'
            });
          }
          break;
          
        case 'missing-types':
          if (error.message.includes('return type')) {
            fixes.push({
              line: error.line,
              column: error.column,
              fix: ': void',
              original: '{'
            });
          }
          break;
          
        case 'interface-issues':
          if (error.message.includes('any index signature')) {
            fixes.push({
              line: error.line,
              column: error.column,
              fix: 'unknown',
              original: 'any'
            });
          }
          break;
      }
      
      fileFixMap.set(error.file, fixes);
    }
    
    // Apply fixes to files
    let totalFixed = 0;
    
    for (const [file, fixes] of fileFixMap) {
      try {
        const fullPath = path.join(process.cwd(), file);
        const content = await fs.readFile(fullPath, 'utf-8');
        let modifiedContent = content;
        
        // Sort fixes by position (reverse order to maintain positions)
        fixes.sort((a, b) => b.line - a.line || b.column - a.column);
        
        for (const fix of fixes) {
          modifiedContent = modifiedContent.replace(fix.original, fix.fix);
          totalFixed++;
        }
        
        await fs.writeFile(fullPath, modifiedContent);
        
      } catch (error) {
        console.warn(chalk.yellow(`Failed to auto-fix ${file}: ${error}`));
      }
    }
    
    return totalFixed;
  }
  
  private async generateTypeFixSOW(result: TypeCheckResult): Promise<void> {
    const sowPath = path.join(process.cwd(), 'docs', '03-sow', 'TYPECHECK_FIX_SOW.md');
    
    const errorsByCategory: Record<string, number> = {};
    for (const error of [...result.errors, ...result.warnings]) {
      errorsByCategory[error.category] = (errorsByCategory[error.category] || 0) + 1;
    }
    
    const sow = `# 🎯 TypeScript Fix SOW (Statement of Work)

**Generated**: ${new Date().toISOString()}
**Total Issues**: ${result.totalErrors + result.totalWarnings}
**Priority**: ${result.totalErrors > 0 ? '🔴 CRITICAL' : '🟡 MEDIUM'}

## 📊 TypeScript Analysis Summary

- **Type Errors**: ${result.totalErrors}
- **Type Warnings**: ${result.totalWarnings}
- **Suggestions**: ${result.totalSuggestions}
- **Files Analyzed**: ${result.filesAnalyzed}
- **Type Coverage**: ${result.typeCoverage}%
- **Strict Mode**: ${result.strictModeEnabled ? '✅ Enabled' : '❌ Disabled'}

## 📋 Issues by Category

${Object.entries(errorsByCategory).sort(([,a], [,b]) => b - a).map(([category, count]) => 
  `- **${category}**: ${count} issues`
).join('\n')}

## ⚙️ Recommended TypeScript Configuration

\`\`\`json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true
  }
}
\`\`\`

## 🎯 Fix Priority Plan

### Phase 1: Critical Type Errors (Immediate)
${result.errors.slice(0, 15).map(error => 
  `- [ ] ${error.code}: ${error.message} in ${error.file}:${error.line}${error.fixable ? ' (auto-fixable)' : ''}`
).join('\n')}

### Phase 2: Type Safety Warnings (1-2 days)  
${result.warnings.slice(0, 15).map(warning => 
  `- [ ] ${warning.message} in ${warning.file}:${warning.line}${warning.fixable ? ' (auto-fixable)' : ''}`
).join('\n')}

### Phase 3: Type Coverage Improvement (1 week)
- [ ] Increase type coverage from ${result.typeCoverage}% to 90%+
- [ ] Add explicit return types to all functions
- [ ] Replace all \`any\` types with specific types
- [ ] Add type guards for runtime type checking
- [ ] Implement proper error type handling

## 🔧 Recommended Actions

1. **Immediate**: Fix all type errors preventing compilation
2. **Short-term**: Enable strict mode if not already enabled
3. **Medium-term**: Address type safety warnings
4. **Long-term**: Achieve 90%+ type coverage

## 📊 Success Metrics

- [ ] Zero TypeScript compilation errors
- [ ] Strict mode enabled with all flags
- [ ] Type coverage above 90%
- [ ] No \`any\` types in production code
- [ ] All catch blocks properly typed
- [ ] Full type safety in critical paths

---
Generated by MARIA TypeScript Analysis Tool
`;
    
    try {
      await fs.mkdir(path.dirname(sowPath), { recursive: true });
      await fs.writeFile(sowPath, sow);
      console.log(chalk.green(`\n📄 TypeScript fix SOW generated: ${sowPath}`));
    } catch (error) {
      console.warn(chalk.yellow(`Failed to generate SOW: ${error}`));
    }
  }
}

export default TypeCheckAnalysisCommand;