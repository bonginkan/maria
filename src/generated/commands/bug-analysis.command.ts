/**
 * /bug Command - Comprehensive Codebase Bug Analysis
 * 
 * Analyzes the entire codebase to identify potential bugs, code smells,
 * and problematic patterns using static analysis and AI-powered detection.
 */

import { BaseCommand } from './base-command';
import { _CommandContext, CommandResult, _CommandArgs } from './types';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import chalk from 'chalk';

interface BugReport {
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  file: string;
  line?: number;
  column?: number;
  message: string;
  suggestion?: string;
  codeSnippet?: string;
  pattern?: string;
}

interface AnalysisResult {
  totalBugs: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  bugs: BugReport[];
  analyzedFiles: number;
  scanDuration: number;
}

export class BugAnalysisCommand extends BaseCommand {
  name = 'bug';
  description = 'Analyze codebase for bugs and potential issues';
  usage = '/bug [--fix] [--path=<dir>] [--severity=<level>]';
  category = 'development' as const;
  
  private bugPatterns = [
    // Null/Undefined Issues
    {
      pattern: /(\w+)\.(\w+)\s*\(/g,
      type: 'Potential null reference',
      severity: 'medium' as const,
      check: (code: string, match: RegExpExecArray) => {
        const varName = match[1];
        // Check if variable is checked for null/undefined before use
        const nullCheckPattern = new RegExp(`if\\s*\\(\\s*!?${varName}\\s*[\\)|&]`, 'g');
        const hasNullCheck = nullCheckPattern.test(code.substring(0, match.index));
        return !hasNullCheck && !['console', 'process', 'Math', 'JSON', 'Date'].includes(varName);
      }
    },
    
    // Async/Await Issues
    {
      pattern: /\.then\s*\([^)]*\)\s*\.catch/g,
      type: 'Missing error handling in promise chain',
      severity: 'high' as const,
      check: (code: string, match: RegExpExecArray) => {
        return !code.substring(match.index, match.index + 200).includes('.catch');
      }
    },
    {
      pattern: /async\s+(\w+)\s*\([^)]*\)\s*{[^}]*(?:await\s+)?fetch\(/g,
      type: 'Unhandled fetch without try-catch',
      severity: 'high' as const,
      check: (code: string, match: RegExpExecArray) => {
        const functionBody = this.extractFunctionBody(code, match.index);
        return !functionBody.includes('try') || !functionBody.includes('catch');
      }
    },
    
    // Memory Leaks
    {
      pattern: /addEventListener\s*\([^)]+\)/g,
      type: 'Event listener without removeEventListener',
      severity: 'medium' as const,
      check: (code: string, match: RegExpExecArray) => {
        const eventMatch = match[0].match(/['"](\w+)['"]/);
        if (eventMatch) {
          const eventType = eventMatch[1];
          return !code.includes(`removeEventListener('${eventType}'`) && 
                 !code.includes(`removeEventListener("${eventType}"`);
        }
        return false;
      }
    },
    {
      pattern: /setInterval\s*\(/g,
      type: 'setInterval without clearInterval',
      severity: 'medium' as const,
      check: (code: string) => {
        return !code.includes('clearInterval');
      }
    },
    
    // Security Issues
    {
      pattern: /eval\s*\(/g,
      type: 'Use of eval() - security risk',
      severity: 'critical' as const,
      check: () => true
    },
    {
      pattern: /innerHTML\s*=\s*[^'"`]/g,
      type: 'Potential XSS vulnerability with innerHTML',
      severity: 'high' as const,
      check: (code: string, match: RegExpExecArray) => {
        const line = this.getLineContent(code, match.index);
        return !line.includes('DOMPurify') && !line.includes('sanitize');
      }
    },
    {
      pattern: /process\.env\.\w+/g,
      type: 'Environment variable used without validation',
      severity: 'medium' as const,
      check: (code: string, match: RegExpExecArray) => {
        const envVar = match[0];
        const beforeMatch = code.substring(Math.max(0, match.index - 100), match.index);
        return !beforeMatch.includes(`if (${envVar}`) && !beforeMatch.includes(`${envVar} ||`);
      }
    },
    
    // Type Issues
    {
      pattern: /as\s+any\b/g,
      type: 'Use of "any" type - type safety issue',
      severity: 'low' as const,
      check: () => true
    },
    {
      pattern: /@ts-ignore/g,
      type: 'TypeScript ignore directive used',
      severity: 'medium' as const,
      check: () => true
    },
    
    // Performance Issues
    {
      pattern: /for\s*\([^)]*\)\s*{[^}]*await\s+/g,
      type: 'Await inside loop - performance issue',
      severity: 'medium' as const,
      check: () => true
    },
    {
      pattern: /JSON\.parse\s*\([^)]+\)/g,
      type: 'JSON.parse without try-catch',
      severity: 'medium' as const,
      check: (code: string, match: RegExpExecArray) => {
        const surroundingCode = code.substring(Math.max(0, match.index - 50), match.index + 100);
        return !surroundingCode.includes('try');
      }
    },
    
    // React-specific Issues
    {
      pattern: /useEffect\s*\(\s*\(\)\s*=>\s*{[^}]*}\s*,\s*\[\s*\]\s*\)/g,
      type: 'useEffect with empty dependency array and external references',
      severity: 'medium' as const,
      check: (code: string, match: RegExpExecArray) => {
        const effectBody = this.extractFunctionBody(code, match.index);
        // Check if effect uses props or state
        return /props\.|state\.|use\w+\(/.test(effectBody);
      }
    },
    {
      pattern: /setState\s*\([^)]*state[^)]*\)/g,
      type: 'Direct state mutation in setState',
      severity: 'high' as const,
      check: () => true
    },
    
    // Resource Management
    {
      pattern: /new\s+WebSocket\s*\(/g,
      type: 'WebSocket without close handler',
      severity: 'medium' as const,
      check: (code: string) => {
        return !code.includes('.close()') && !code.includes('onclose');
      }
    },
    {
      pattern: /fs\.\w+Sync\s*\(/g,
      type: 'Synchronous file operation - blocks event loop',
      severity: 'medium' as const,
      check: () => true
    },
    
    // Error Handling
    {
      pattern: /catch\s*\(\s*\w+\s*\)\s*{\s*}/g,
      type: 'Empty catch block',
      severity: 'high' as const,
      check: () => true
    },
    {
      pattern: /throw\s+['"][^'"]+['"]/g,
      type: 'Throwing string instead of Error object',
      severity: 'medium' as const,
      check: () => true
    },
    
    // Logic Issues
    {
      pattern: /if\s*\([^)]*=[^=][^)]*\)/g,
      type: 'Assignment in condition (possible typo)',
      severity: 'high' as const,
      check: (code: string, match: RegExpExecArray) => {
        const condition = match[0];
        return !condition.includes('==') && !condition.includes('!=');
      }
    },
    {
      pattern: /switch\s*\([^)]+\)\s*{[^}]*case[^}]*(?!break|return|throw)[^}]*case/g,
      type: 'Missing break in switch case',
      severity: 'high' as const,
      check: () => true
    }
  ];

  async execute(args: CommandArgs, context: CommandContext): Promise<CommandResult> {
    const startTime = Date.now();
    const targetPath = args.path || process.cwd();
    const severityFilter = args.severity as BugReport['severity'] | undefined;
    const shouldFix = args.fix === true;
    
    console.log(chalk.blue('🔍 Starting comprehensive bug analysis...'));
    console.log(chalk.gray(`Target: ${targetPath}`));
    
    try {
      // Get all TypeScript and JavaScript files
      const files = await this.getSourceFiles(targetPath);
      console.log(chalk.gray(`Found ${files.length} files to analyze`));
      
      const bugs: BugReport[] = [];
      let processedFiles = 0;
      
      // Analyze each file
      for (const file of files) {
        const fileBugs = await this.analyzeFile(file);
        bugs.push(...fileBugs);
        processedFiles++;
        
        // Progress indicator
        if (processedFiles % 10 === 0) {
          process.stdout.write(chalk.gray(`.`));
        }
      }
      
      console.log(); // New line after progress dots
      
      // Filter by severity if specified
      const filteredBugs = severityFilter 
        ? bugs.filter(bug => bug.severity === severityFilter)
        : bugs;
      
      // Sort bugs by severity
      const sortedBugs = this.sortBugsBySeverity(filteredBugs);
      
      // Generate analysis result
      const result: AnalysisResult = {
        totalBugs: sortedBugs.length,
        critical: sortedBugs.filter(b => b.severity === 'critical').length,
        high: sortedBugs.filter(b => b.severity === 'high').length,
        medium: sortedBugs.filter(b => b.severity === 'medium').length,
        low: sortedBugs.filter(b => b.severity === 'low').length,
        bugs: sortedBugs.slice(0, 100), // Limit to top 100 bugs
        analyzedFiles: files.length,
        scanDuration: Date.now() - startTime
      };
      
      // Display results
      this.displayResults(result);
      
      // Auto-fix if requested
      if (shouldFix && result.totalBugs > 0) {
        console.log(chalk.yellow('\n🔧 Attempting to auto-fix issues...'));
        const fixedCount = await this.autoFixBugs(result.bugs);
        console.log(chalk.green(`✅ Fixed ${fixedCount} issues automatically`));
      }
      
      // Generate SOW if bugs found
      if (result.totalBugs > 0) {
        await this.generateBugFixSOW(result);
      }
      
      return {
        success: true,
        message: `Bug analysis complete: ${result.totalBugs} issues found`,
        data: result
      };
      
    } catch (error) {
      return {
        success: false,
        message: `Bug analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
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
  
  private async analyzeFile(filePath: string): Promise<BugReport[]> {
    const bugs: BugReport[] = [];
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      
      // Check each bug pattern
      for (const bugPattern of this.bugPatterns) {
        const regex = new RegExp(bugPattern.pattern.source, bugPattern.pattern.flags);
        let match;
        
        while ((match = regex.exec(content)) !== null) {
          // Run additional check if provided
          if (!bugPattern.check || bugPattern.check(content, match)) {
            const lineNumber = this.getLineNumber(content, match.index);
            const codeSnippet = this.getCodeSnippet(lines, lineNumber);
            
            bugs.push({
              severity: bugPattern.severity,
              type: bugPattern.type,
              file: path.relative(process.cwd(), filePath),
              line: lineNumber,
              column: this.getColumnNumber(content, match.index),
              message: `${bugPattern.type} detected`,
              codeSnippet,
              pattern: match[0],
              suggestion: this.getSuggestion(bugPattern.type)
            });
          }
        }
      }
      
      // Additional complex analysis
      bugs.push(...await this.performComplexAnalysis(filePath, content));
      
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Failed to analyze ${filePath}: ${error}`));
    }
    
    return bugs;
  }
  
  private async performComplexAnalysis(filePath: string, content: string): Promise<BugReport[]> {
    const bugs: BugReport[] = [];
    
    // Check for unused variables (TypeScript files only)
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      const unusedVars = this.findUnusedVariables(content);
      for (const varInfo of unusedVars) {
        bugs.push({
          severity: 'low',
          type: 'Unused variable',
          file: path.relative(process.cwd(), filePath),
          line: varInfo.line,
          message: `Variable "${varInfo.name}" is declared but never used`,
          suggestion: 'Remove unused variable or use it'
        });
      }
    }
    
    // Check for circular dependencies
    const circularDeps = this.findCircularDependencies(content, filePath);
    for (const dep of circularDeps) {
      bugs.push({
        severity: 'high',
        type: 'Potential circular dependency',
        file: path.relative(process.cwd(), filePath),
        message: `Circular dependency detected with ${dep}`,
        suggestion: 'Refactor to remove circular dependency'
      });
    }
    
    // Check for hardcoded credentials
    const credentials = this.findHardcodedCredentials(content);
    for (const cred of credentials) {
      bugs.push({
        severity: 'critical',
        type: 'Hardcoded credentials',
        file: path.relative(process.cwd(), filePath),
        line: cred.line,
        message: `Potential hardcoded ${cred.type} found`,
        suggestion: 'Use environment variables or secure key management'
      });
    }
    
    return bugs;
  }
  
  private findUnusedVariables(content: string): Array<{name: string, line: number}> {
    const unused: Array<{name: string, line: number}> = [];
    const lines = content.split('\n');
    
    // Simple pattern for const/let/var declarations
    const declPattern = /(?:const|let|var)\s+(\w+)\s*=/g;
    let match;
    
    while ((match = declPattern.exec(content)) !== null) {
      const varName = match[1];
      // Check if variable is used elsewhere (simple check)
      const usagePattern = new RegExp(`\\b${varName}\\b`, 'g');
      const usages = content.match(usagePattern);
      
      if (usages && usages.length === 1) {
        unused.push({
          name: varName,
          line: this.getLineNumber(content, match.index)
        });
      }
    }
    
    return unused;
  }
  
  private findCircularDependencies(content: string, currentFile: string): string[] {
    const circular: string[] = [];
    const importPattern = /import\s+.*\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = importPattern.exec(content)) !== null) {
      const importPath = match[1];
      // Simple check - if imported file also imports current file
      // This would need more sophisticated analysis in production
      if (importPath.includes(path.basename(currentFile, path.extname(currentFile)))) {
        circular.push(importPath);
      }
    }
    
    return circular;
  }
  
  private findHardcodedCredentials(content: string): Array<{type: string, line: number}> {
    const credentials: Array<{type: string, line: number}> = [];
    
    const patterns = [
      { regex: /api[_-]?key\s*[:=]\s*['"][^'"]{20,}['"]/gi, type: 'API key' },
      { regex: /password\s*[:=]\s*['"][^'"]+['"]/gi, type: 'password' },
      { regex: /secret\s*[:=]\s*['"][^'"]{10,}['"]/gi, type: 'secret' },
      { regex: /token\s*[:=]\s*['"][^'"]{20,}['"]/gi, type: 'token' },
      { regex: /private[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi, type: 'private key' }
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        // Exclude common false positives
        if (!match[0].includes('process.env') && !match[0].includes('import.meta.env')) {
          credentials.push({
            type: pattern.type,
            line: this.getLineNumber(content, match.index)
          });
        }
      }
    }
    
    return credentials;
  }
  
  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }
  
  private getColumnNumber(content: string, index: number): number {
    const lines = content.substring(0, index).split('\n');
    const lastLine = lines[lines.length - 1];
    return lastLine.length + 1;
  }
  
  private getLineContent(content: string, index: number): string {
    const lines = content.split('\n');
    const lineNumber = this.getLineNumber(content, index);
    return lines[lineNumber - 1] || '';
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
  
  private extractFunctionBody(content: string, startIndex: number): string {
    let braceCount = 0;
    let inBody = false;
    let bodyStart = -1;
    let bodyEnd = -1;
    
    for (let i = startIndex; i < content.length; i++) {
      if (content[i] === '{') {
        if (!inBody) {
          inBody = true;
          bodyStart = i;
        }
        braceCount++;
      } else if (content[i] === '}') {
        braceCount--;
        if (braceCount === 0 && inBody) {
          bodyEnd = i;
          break;
        }
      }
    }
    
    if (bodyStart !== -1 && bodyEnd !== -1) {
      return content.substring(bodyStart, bodyEnd + 1);
    }
    
    return '';
  }
  
  private sortBugsBySeverity(bugs: BugReport[]): BugReport[] {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return bugs.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  }
  
  private getSuggestion(bugType: string): string {
    const suggestions: Record<string, string> = {
      'Potential null reference': 'Add null/undefined check before accessing properties',
      'Missing error handling in promise chain': 'Add .catch() block to handle errors',
      'Unhandled fetch without try-catch': 'Wrap fetch call in try-catch block',
      'Event listener without removeEventListener': 'Store listener reference and remove on cleanup',
      'setInterval without clearInterval': 'Store interval ID and clear on cleanup',
      'Use of eval() - security risk': 'Use Function constructor or refactor to avoid dynamic code execution',
      'Potential XSS vulnerability with innerHTML': 'Use textContent or sanitize HTML with DOMPurify',
      'Environment variable used without validation': 'Validate and provide default value for env variables',
      'Use of "any" type - type safety issue': 'Define proper TypeScript types',
      'TypeScript ignore directive used': 'Fix underlying type issue instead of ignoring',
      'Await inside loop - performance issue': 'Use Promise.all() for parallel execution',
      'JSON.parse without try-catch': 'Wrap JSON.parse in try-catch block',
      'useEffect with empty dependency array and external references': 'Add dependencies or use useCallback',
      'Direct state mutation in setState': 'Create new object/array instead of mutating',
      'WebSocket without close handler': 'Add cleanup to close WebSocket connection',
      'Synchronous file operation - blocks event loop': 'Use async file operations (fs.promises)',
      'Empty catch block': 'Handle or log the error appropriately',
      'Throwing string instead of Error object': 'Throw new Error() instead of string',
      'Assignment in condition (possible typo)': 'Use === for comparison or move assignment outside',
      'Missing break in switch case': 'Add break statement or comment // falls through'
    };
    
    return suggestions[bugType] || 'Review and fix the identified issue';
  }
  
  private displayResults(result: AnalysisResult): void {
    console.log('\n' + chalk.bold('═══════════════════════════════════════════════════════════'));
    console.log(chalk.bold.cyan('                    BUG ANALYSIS REPORT                     '));
    console.log(chalk.bold('═══════════════════════════════════════════════════════════\n'));
    
    // Summary
    console.log(chalk.bold('📊 Summary:'));
    console.log(chalk.gray('├─') + ` Files analyzed: ${chalk.cyan(result.analyzedFiles)}`);
    console.log(chalk.gray('├─') + ` Total bugs found: ${chalk.yellow(result.totalBugs)}`);
    console.log(chalk.gray('└─') + ` Scan duration: ${chalk.green(result.scanDuration + 'ms')}\n`);
    
    // Severity breakdown
    console.log(chalk.bold('🎯 Severity Breakdown:'));
    if (result.critical > 0) {
      console.log(chalk.red(`  ⚠️  Critical: ${result.critical}`));
    }
    if (result.high > 0) {
      console.log(chalk.magenta(`  ⚡ High: ${result.high}`));
    }
    if (result.medium > 0) {
      console.log(chalk.yellow(`  ⚙️  Medium: ${result.medium}`));
    }
    if (result.low > 0) {
      console.log(chalk.blue(`  💡 Low: ${result.low}`));
    }
    
    // Top issues
    if (result.bugs.length > 0) {
      console.log(chalk.bold('\n🔍 Top Issues Found:'));
      console.log(chalk.gray('─'.repeat(60)));
      
      const displayCount = Math.min(10, result.bugs.length);
      for (let i = 0; i < displayCount; i++) {
        const bug = result.bugs[i];
        const severityColor = this.getSeverityColor(bug.severity);
        
        console.log(`\n${chalk.bold(severityColor(`[${bug.severity.toUpperCase()}]`))} ${bug.type}`);
        console.log(chalk.gray(`📁 ${bug.file}${bug.line ? `:${bug.line}` : ''}`));
        console.log(chalk.gray(`└─ ${bug.message}`));
        
        if (bug.codeSnippet) {
          console.log(chalk.dim('\nCode:'));
          console.log(chalk.dim(bug.codeSnippet));
        }
        
        if (bug.suggestion) {
          console.log(chalk.green(`💡 Suggestion: ${bug.suggestion}`));
        }
      }
      
      if (result.bugs.length > displayCount) {
        console.log(chalk.gray(`\n... and ${result.bugs.length - displayCount} more issues`));
      }
    } else {
      console.log(chalk.green('\n✅ No bugs detected! Your code looks clean.'));
    }
    
    console.log('\n' + chalk.bold('═══════════════════════════════════════════════════════════\n'));
  }
  
  private getSeverityColor(severity: BugReport['severity']): (text: string) => string {
    switch (severity) {
      case 'critical': return chalk.red;
      case 'high': return chalk.magenta;
      case 'medium': return chalk.yellow;
      case 'low': return chalk.blue;
    }
  }
  
  private async autoFixBugs(bugs: BugReport[]): Promise<number> {
    let fixedCount = 0;
    const fixableBugTypes = [
      'Use of "any" type - type safety issue',
      'Empty catch block',
      'TypeScript ignore directive used',
      'Missing break in switch case'
    ];
    
    const fileFixes = new Map<string, Array<{line: number, original: string, fixed: string}>>();
    
    for (const bug of bugs) {
      if (fixableBugTypes.includes(bug.type) && bug.file && bug.line) {
        const fixes = fileFixes.get(bug.file) || [];
        
        switch (bug.type) {
          case 'Use of "any" type - type safety issue':
            fixes.push({
              line: bug.line,
              original: 'as any',
              fixed: 'as unknown'
            });
            break;
            
          case 'Empty catch block':
            fixes.push({
              line: bug.line,
              original: '{}',
              fixed: '{ console.error("Error:", error); }'
            });
            break;
            
          case 'TypeScript ignore directive used':
            fixes.push({
              line: bug.line,
              original: '// @ts-ignore',
              fixed: '// TODO: Fix type issue'
            });
            break;
            
          case 'Missing break in switch case':
            fixes.push({
              line: bug.line,
              original: 'case',
              fixed: 'break;\n    case'
            });
            break;
        }
        
        fileFixes.set(bug.file, fixes);
        fixedCount++;
      }
    }
    
    // Apply fixes to files
    for (const [file, fixes] of fileFixes) {
      try {
        const fullPath = path.join(process.cwd(), file);
        const content = await fs.readFile(fullPath, 'utf-8');
        const lines = content.split('\n');
        
        for (const fix of fixes) {
          if (fix.line <= lines.length) {
            lines[fix.line - 1] = lines[fix.line - 1].replace(fix.original, fix.fixed);
          }
        }
        
        await fs.writeFile(fullPath, lines.join('\n'));
      } catch (error) {
        console.warn(chalk.yellow(`Failed to auto-fix ${file}: ${error}`));
        fixedCount--;
      }
    }
    
    return fixedCount;
  }
  
  private async generateBugFixSOW(result: AnalysisResult): Promise<void> {
    const sowPath = path.join(process.cwd(), 'docs', '03-sow', 'BUG_FIX_SOW.md');
    
    const sow = `# 🐛 Bug Fix SOW (Statement of Work)

**Generated**: ${new Date().toISOString()}
**Total Bugs**: ${result.totalBugs}
**Priority**: ${result.critical > 0 ? '🔴 CRITICAL' : result.high > 0 ? '⚡ HIGH' : '🟡 MEDIUM'}

## 📊 Bug Analysis Summary

- **Critical Issues**: ${result.critical}
- **High Priority**: ${result.high}
- **Medium Priority**: ${result.medium}
- **Low Priority**: ${result.low}
- **Files Analyzed**: ${result.analyzedFiles}

## 🎯 Fix Priority Plan

### Phase 1: Critical Issues (Immediate)
${result.bugs.filter(b => b.severity === 'critical').slice(0, 10).map(bug => 
  `- [ ] Fix ${bug.type} in ${bug.file}${bug.line ? `:${bug.line}` : ''}`
).join('\n')}

### Phase 2: High Priority (1-2 days)
${result.bugs.filter(b => b.severity === 'high').slice(0, 10).map(bug => 
  `- [ ] Fix ${bug.type} in ${bug.file}${bug.line ? `:${bug.line}` : ''}`
).join('\n')}

### Phase 3: Medium Priority (1 week)
${result.bugs.filter(b => b.severity === 'medium').slice(0, 10).map(bug => 
  `- [ ] Fix ${bug.type} in ${bug.file}${bug.line ? `:${bug.line}` : ''}`
).join('\n')}

### Phase 4: Low Priority (As time permits)
${result.bugs.filter(b => b.severity === 'low').slice(0, 10).map(bug => 
  `- [ ] Fix ${bug.type} in ${bug.file}${bug.line ? `:${bug.line}` : ''}`
).join('\n')}

## 📝 Detailed Bug List

${result.bugs.slice(0, 50).map((bug, i) => `
### ${i + 1}. ${bug.type}
- **Severity**: ${bug.severity}
- **File**: ${bug.file}${bug.line ? `:${bug.line}` : ''}
- **Message**: ${bug.message}
- **Suggestion**: ${bug.suggestion || 'Review and fix'}
${bug.codeSnippet ? `\n\`\`\`typescript\n${bug.codeSnippet}\n\`\`\`` : ''}
`).join('\n')}

## 🔧 Recommended Actions

1. **Immediate**: Fix all critical security issues
2. **Short-term**: Address high-priority bugs affecting functionality
3. **Medium-term**: Resolve medium priority issues for code quality
4. **Long-term**: Clean up low-priority issues and technical debt

## 📊 Success Metrics

- [ ] All critical bugs fixed
- [ ] High priority bugs reduced by 80%
- [ ] Zero security vulnerabilities
- [ ] TypeScript strict mode compliance
- [ ] 100% test coverage for fixed areas

---
Generated by MARIA Bug Analysis Tool
`;
    
    try {
      await fs.mkdir(path.dirname(sowPath), { recursive: true });
      await fs.writeFile(sowPath, sow);
      console.log(chalk.green(`\n📄 Bug fix SOW generated: ${sowPath}`));
    } catch (error) {
      console.warn(chalk.yellow(`Failed to generate SOW: ${error}`));
    }
  }
}

export default BugAnalysisCommand;