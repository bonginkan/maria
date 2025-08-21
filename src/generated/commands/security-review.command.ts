/**
 * /security-review Command - Comprehensive Security Analysis
 * 
 * Performs thorough security analysis of the codebase to identify vulnerabilities,
 * security risks, and compliance issues with automated remediation suggestions.
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

interface SecurityIssue {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  rule: string;
  file: string;
  line?: number;
  column?: number;
  title: string;
  description: string;
  impact: string;
  remediation: string;
  cweId?: string;
  owaspCategory?: string;
  confidence: 'high' | 'medium' | 'low';
  codeSnippet?: string;
}

interface SecurityReport {
  totalIssues: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  issues: SecurityIssue[];
  filesAnalyzed: number;
  securityScore: number;
  compliance: {
    owasp: number;
    cwe: number;
  };
  scanDuration: number;
}

export class SecurityReviewCommand extends BaseCommand {
  name = 'security-review';
  description = 'Comprehensive security analysis and vulnerability assessment';
  usage = '/security-review [--fix] [--path=<dir>] [--severity=<level>] [--format=<json|html>]';
  category = 'development' as const;
  
  private securityRules = [
    // Injection Vulnerabilities
    {
      rule: 'sql-injection',
      pattern: /query\s*\+|execute\s*\(.*\+|sql\s*=.*\+/gi,
      category: 'injection',
      severity: 'critical' as const,
      title: 'Potential SQL Injection',
      description: 'Dynamic SQL query construction detected',
      impact: 'Database compromise, data theft, unauthorized access',
      remediation: 'Use parameterized queries or prepared statements',
      cweId: 'CWE-89',
      owaspCategory: 'A03:2021 – Injection',
      confidence: 'medium' as const
    },
    {
      rule: 'command-injection',
      pattern: /exec\s*\(.*\+|system\s*\(.*\+|shell_exec\s*\(.*\+/gi,
      category: 'injection',
      severity: 'critical' as const,
      title: 'Command Injection Vulnerability',
      description: 'Dynamic command execution with user input',
      impact: 'Remote code execution, system compromise',
      remediation: 'Validate input and use safe execution methods',
      cweId: 'CWE-78',
      owaspCategory: 'A03:2021 – Injection',
      confidence: 'high' as const
    },
    {
      rule: 'eval-injection',
      pattern: /eval\s*\(/gi,
      category: 'injection',
      severity: 'critical' as const,
      title: 'Code Injection via eval()',
      description: 'Use of eval() with potentially unsafe input',
      impact: 'Arbitrary code execution, application compromise',
      remediation: 'Remove eval() or use JSON.parse() for data',
      cweId: 'CWE-95',
      owaspCategory: 'A03:2021 – Injection',
      confidence: 'high' as const
    },
    
    // XSS Vulnerabilities
    {
      rule: 'dom-xss',
      pattern: /innerHTML\s*=\s*[^'"`]/gi,
      category: 'xss',
      severity: 'high' as const,
      title: 'DOM-based XSS Vulnerability',
      description: 'Unsafe DOM manipulation with innerHTML',
      impact: 'Cross-site scripting, session hijacking, defacement',
      remediation: 'Use textContent or sanitize HTML with DOMPurify',
      cweId: 'CWE-79',
      owaspCategory: 'A03:2021 – Injection',
      confidence: 'medium' as const
    },
    {
      rule: 'reflected-xss',
      pattern: /document\.write\s*\(.*req\.|res\.send\s*\(.*req\./gi,
      category: 'xss',
      severity: 'high' as const,
      title: 'Reflected XSS Vulnerability',
      description: 'User input directly written to page without sanitization',
      impact: 'Cross-site scripting attacks, credential theft',
      remediation: 'Sanitize and encode all user inputs before output',
      cweId: 'CWE-79',
      owaspCategory: 'A03:2021 – Injection',
      confidence: 'high' as const
    },
    
    // Authentication and Authorization
    {
      rule: 'hardcoded-credentials',
      pattern: /password\s*[:=]\s*['"][^'"]+['"]|api[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi,
      category: 'authentication',
      severity: 'critical' as const,
      title: 'Hardcoded Credentials',
      description: 'Sensitive credentials stored in source code',
      impact: 'Unauthorized access, credential compromise',
      remediation: 'Use environment variables or secure vault storage',
      cweId: 'CWE-798',
      owaspCategory: 'A07:2021 – Identification and Authentication Failures',
      confidence: 'high' as const
    },
    {
      rule: 'weak-crypto',
      pattern: /md5|sha1(?!0)|des(?!_)|rc4/gi,
      category: 'cryptography',
      severity: 'high' as const,
      title: 'Weak Cryptographic Algorithm',
      description: 'Use of deprecated or weak cryptographic functions',
      impact: 'Data compromise, cryptographic attacks',
      remediation: 'Use strong algorithms like AES-256, SHA-256, or bcrypt',
      cweId: 'CWE-327',
      owaspCategory: 'A02:2021 – Cryptographic Failures',
      confidence: 'high' as const
    },
    {
      rule: 'jwt-no-verify',
      pattern: /jwt\.decode\s*\([^,]*\)|verify:\s*false/gi,
      category: 'authentication',
      severity: 'high' as const,
      title: 'JWT Token Not Verified',
      description: 'JWT tokens used without proper signature verification',
      impact: 'Authentication bypass, token forgery',
      remediation: 'Always verify JWT signatures and expiration',
      cweId: 'CWE-345',
      owaspCategory: 'A07:2021 – Identification and Authentication Failures',
      confidence: 'medium' as const
    },
    
    // Input Validation
    {
      rule: 'path-traversal',
      pattern: /\.\.\//g,
      category: 'path-traversal',
      severity: 'high' as const,
      title: 'Path Traversal Vulnerability',
      description: 'Potential directory traversal attack vector',
      impact: 'Unauthorized file access, information disclosure',
      remediation: 'Validate and sanitize file paths, use allowlists',
      cweId: 'CWE-22',
      owaspCategory: 'A01:2021 – Broken Access Control',
      confidence: 'medium' as const
    },
    {
      rule: 'open-redirect',
      pattern: /location\.href\s*=\s*[^'"`]|window\.open\s*\([^'"`]/gi,
      category: 'redirect',
      severity: 'medium' as const,
      title: 'Open Redirect Vulnerability',
      description: 'Unvalidated redirect to external URLs',
      impact: 'Phishing attacks, malicious redirections',
      remediation: 'Validate redirect URLs against allowlist',
      cweId: 'CWE-601',
      owaspCategory: 'A01:2021 – Broken Access Control',
      confidence: 'low' as const
    },
    
    // Session Management
    {
      rule: 'session-fixation',
      pattern: /session_regenerate_id\s*\(\s*false\s*\)|regenerate:\s*false/gi,
      category: 'session',
      severity: 'medium' as const,
      title: 'Session Fixation Vulnerability',
      description: 'Session ID not regenerated after authentication',
      impact: 'Session hijacking, unauthorized access',
      remediation: 'Regenerate session ID after login/privilege changes',
      cweId: 'CWE-384',
      owaspCategory: 'A07:2021 – Identification and Authentication Failures',
      confidence: 'medium' as const
    },
    {
      rule: 'insecure-cookies',
      pattern: /httpOnly:\s*false|secure:\s*false|sameSite:\s*['"]?none['"]?/gi,
      category: 'session',
      severity: 'medium' as const,
      title: 'Insecure Cookie Configuration',
      description: 'Cookies configured without security flags',
      impact: 'Session hijacking, CSRF attacks',
      remediation: 'Set httpOnly, secure, and sameSite flags on cookies',
      cweId: 'CWE-614',
      owaspCategory: 'A05:2021 – Security Misconfiguration',
      confidence: 'high' as const
    },
    
    // Information Disclosure
    {
      rule: 'debug-info',
      pattern: /console\.log\s*\(.*password|console\.log\s*\(.*token|printStackTrace/gi,
      category: 'information-disclosure',
      severity: 'medium' as const,
      title: 'Information Disclosure',
      description: 'Sensitive information logged to console or exposed',
      impact: 'Information leakage, credential exposure',
      remediation: 'Remove or sanitize debug statements in production',
      cweId: 'CWE-200',
      owaspCategory: 'A05:2021 – Security Misconfiguration',
      confidence: 'medium' as const
    },
    {
      rule: 'error-disclosure',
      pattern: /throw\s+new\s+Error\s*\(.*password|Error\s*\(.*internal/gi,
      category: 'information-disclosure',
      severity: 'low' as const,
      title: 'Verbose Error Messages',
      description: 'Error messages may expose sensitive information',
      impact: 'Information disclosure, system fingerprinting',
      remediation: 'Use generic error messages for public-facing errors',
      cweId: 'CWE-209',
      owaspCategory: 'A05:2021 – Security Misconfiguration',
      confidence: 'low' as const
    },
    
    // CORS and Security Headers
    {
      rule: 'cors-wildcard',
      pattern: /Access-Control-Allow-Origin.*\*/gi,
      category: 'cors',
      severity: 'medium' as const,
      title: 'Overly Permissive CORS Policy',
      description: 'CORS policy allows requests from any origin',
      impact: 'Cross-origin attacks, data theft',
      remediation: 'Restrict CORS to specific trusted origins',
      cweId: 'CWE-942',
      owaspCategory: 'A05:2021 – Security Misconfiguration',
      confidence: 'high' as const
    },
    
    // File Upload Vulnerabilities
    {
      rule: 'unrestricted-upload',
      pattern: /upload.*\.(php|jsp|asp|exe|sh|bat)/gi,
      category: 'file-upload',
      severity: 'high' as const,
      title: 'Unrestricted File Upload',
      description: 'File upload without proper extension validation',
      impact: 'Remote code execution, malware upload',
      remediation: 'Validate file types, scan uploads, isolate upload directory',
      cweId: 'CWE-434',
      owaspCategory: 'A03:2021 – Injection',
      confidence: 'medium' as const
    },
    
    // API Security
    {
      rule: 'api-key-exposure',
      pattern: /Authorization:\s*Bearer\s*[^'"`\s]+|api[_-]?key[^'"`\s]+/gi,
      category: 'api-security',
      severity: 'high' as const,
      title: 'API Key Exposure',
      description: 'API keys or tokens exposed in client-side code',
      impact: 'Unauthorized API access, quota abuse',
      remediation: 'Use server-side proxy for API calls',
      cweId: 'CWE-798',
      owaspCategory: 'A07:2021 – Identification and Authentication Failures',
      confidence: 'medium' as const
    },
    
    // Dependency Vulnerabilities
    {
      rule: 'vulnerable-dependency',
      pattern: /require\s*\(\s*['"](?:lodash|moment|jquery)['"]|import.*from\s*['"](?:lodash|moment|jquery)['"]/gi,
      category: 'dependencies',
      severity: 'medium' as const,
      title: 'Potentially Vulnerable Dependency',
      description: 'Use of dependency with known vulnerabilities',
      impact: 'Application compromise via dependency exploits',
      remediation: 'Update to latest secure version or find alternatives',
      cweId: 'CWE-1104',
      owaspCategory: 'A06:2021 – Vulnerable and Outdated Components',
      confidence: 'low' as const
    },
    
    // Insecure Direct Object References
    {
      rule: 'idor',
      pattern: /req\.params\.\w+.*query|req\.query\.\w+.*find/gi,
      category: 'access-control',
      severity: 'high' as const,
      title: 'Insecure Direct Object Reference',
      description: 'Direct object access without authorization check',
      impact: 'Unauthorized data access, privilege escalation',
      remediation: 'Implement proper authorization checks',
      cweId: 'CWE-639',
      owaspCategory: 'A01:2021 – Broken Access Control',
      confidence: 'medium' as const
    }
  ];

  async execute(args: CommandArgs, context: CommandContext): Promise<CommandResult> {
    const startTime = Date.now();
    const targetPath = args.path || process.cwd();
    const shouldFix = args.fix === true;
    const severityFilter = args.severity as SecurityIssue['severity'] | undefined;
    const outputFormat = args.format as 'json' | 'html' | undefined;
    
    console.log(chalk.blue('🔒 Starting comprehensive security analysis...'));
    console.log(chalk.gray(`Target: ${targetPath}`));
    
    try {
      // Run automated security scanning tools if available
      const npmAuditResult = await this.runNpmAudit(targetPath);
      
      // Get all source files
      const files = await this.getSourceFiles(targetPath);
      console.log(chalk.gray(`Found ${files.length} files to analyze`));
      
      const allIssues: SecurityIssue[] = [];
      let processedFiles = 0;
      
      // Analyze each file
      for (const file of files) {
        const fileIssues = await this.analyzeSecurityFile(file);
        allIssues.push(...fileIssues);
        processedFiles++;
        
        // Progress indicator
        if (processedFiles % 10 === 0) {
          process.stdout.write(chalk.gray(`.`));
        }
      }
      
      console.log(); // New line after progress dots
      
      // Combine with npm audit results
      if (npmAuditResult) {
        allIssues.push(...npmAuditResult);
      }
      
      // Additional security checks
      allIssues.push(...await this.performAdvancedSecurityChecks(targetPath));
      
      // Filter by severity if specified
      const filteredIssues = severityFilter 
        ? allIssues.filter(issue => issue.severity === severityFilter)
        : allIssues;
      
      // Sort by severity
      const sortedIssues = this.sortIssuesBySeverity(filteredIssues);
      
      // Calculate security metrics
      const securityScore = this.calculateSecurityScore(sortedIssues);
      const compliance = this.calculateCompliance(sortedIssues);
      
      // Generate report
      const report: SecurityReport = {
        totalIssues: sortedIssues.length,
        critical: sortedIssues.filter(i => i.severity === 'critical').length,
        high: sortedIssues.filter(i => i.severity === 'high').length,
        medium: sortedIssues.filter(i => i.severity === 'medium').length,
        low: sortedIssues.filter(i => i.severity === 'low').length,
        info: sortedIssues.filter(i => i.severity === 'info').length,
        issues: sortedIssues.slice(0, 100),
        filesAnalyzed: files.length,
        securityScore,
        compliance,
        scanDuration: Date.now() - startTime
      };
      
      // Display results
      this.displayResults(report);
      
      // Generate formatted output if requested
      if (outputFormat) {
        await this.generateFormattedReport(report, outputFormat);
      }
      
      // Auto-remediation if requested
      if (shouldFix && report.totalIssues > 0) {
        console.log(chalk.yellow('\n🔧 Attempting automated security fixes...'));
        const fixedCount = await this.autoRemediateIssues(report.issues.filter(i => this.isFixable(i)));
        console.log(chalk.green(`✅ Applied ${fixedCount} security fixes automatically`));
      }
      
      // Generate security SOW
      if (report.totalIssues > 0) {
        await this.generateSecuritySOW(report);
      }
      
      return {
        success: true,
        message: `Security analysis complete: ${report.totalIssues} issues found (Score: ${report.securityScore}/100)`,
        data: report
      };
      
    } catch (error) {
      return {
        success: false,
        message: `Security analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  private async runNpmAudit(targetPath: string): Promise<SecurityIssue[] | null> {
    try {
      const packageJsonPath = path.join(targetPath, 'package.json');
      await fs.access(packageJsonPath);
      
      const { stdout } = await execAsync('npm audit --json', { 
        cwd: targetPath,
        maxBuffer: 5 * 1024 * 1024 
      });
      
      const auditResult = JSON.parse(stdout);
      const issues: SecurityIssue[] = [];
      
      if (auditResult.vulnerabilities) {
        for (const [pkg, vuln] of Object.entries(auditResult.vulnerabilities as any)) {
          issues.push({
            severity: this.mapNpmSeverity(vuln.severity),
            category: 'dependencies',
            rule: 'npm-vulnerability',
            file: 'package.json',
            title: `Vulnerable Dependency: ${pkg}`,
            description: `${vuln.title || 'Security vulnerability in dependency'}`,
            impact: vuln.url ? `See: ${vuln.url}` : 'Potential security compromise',
            remediation: `Update ${pkg} to version ${vuln.fixAvailable?.version || 'latest'}`,
            cweId: vuln.cwe?.[0] || 'CWE-1104',
            owaspCategory: 'A06:2021 – Vulnerable and Outdated Components',
            confidence: 'high'
          });
        }
      }
      
      return issues;
      
    } catch (error) {
      // npm audit might fail, but that's not critical
      return null;
    }
  }
  
  private mapNpmSeverity(npmSeverity: string): SecurityIssue['severity'] {
    switch (npmSeverity) {
      case 'critical': return 'critical';
      case 'high': return 'high';
      case 'moderate': return 'medium';
      case 'low': return 'low';
      default: return 'info';
    }
  }
  
  private async getSourceFiles(targetPath: string): Promise<string[]> {
    const patterns = [
      '**/*.ts',
      '**/*.tsx',
      '**/*.js',
      '**/*.jsx',
      '**/*.json',
      '**/*.env*',
      '**/Dockerfile*',
      '**/*.yml',
      '**/*.yaml'
    ];
    
    const ignorePatterns = [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/coverage/**',
      '**/*.test.*',
      '**/*.spec.*'
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
  
  private async analyzeSecurityFile(filePath: string): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const relativePath = path.relative(process.cwd(), filePath);
      
      // Apply each security rule
      for (const rule of this.securityRules) {
        const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
        let match;
        
        while ((match = regex.exec(content)) !== null) {
          const lineNumber = this.getLineNumber(content, match.index);
          const columnNumber = this.getColumnNumber(content, match.index);
          const codeSnippet = this.getCodeSnippet(lines, lineNumber);
          
          // Additional context-based validation
          if (this.validateSecurityRule(rule, content, match)) {
            issues.push({
              severity: rule.severity,
              category: rule.category,
              rule: rule.rule,
              file: relativePath,
              line: lineNumber,
              column: columnNumber,
              title: rule.title,
              description: rule.description,
              impact: rule.impact,
              remediation: rule.remediation,
              cweId: rule.cweId,
              owaspCategory: rule.owaspCategory,
              confidence: rule.confidence,
              codeSnippet
            });
          }
        }
      }
      
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Failed to analyze ${filePath}: ${error}`));
    }
    
    return issues;
  }
  
  private validateSecurityRule(rule: any, content: string, match: RegExpExecArray): boolean {
    // Additional validation to reduce false positives
    switch (rule.rule) {
      case 'hardcoded-credentials':
        // Skip if it's in a comment or test file
        const line = this.getLineContent(content, match.index);
        return !line.trim().startsWith('//') && 
               !line.trim().startsWith('*') &&
               !content.includes('process.env');
               
      case 'sql-injection':
        // Check if parameterized queries are used
        return !content.includes('prepared') && !content.includes('$1');
        
      case 'path-traversal':
        // Check if it's in a comment or string literal context
        return !this.isInComment(content, match.index);
        
      case 'vulnerable-dependency':
        // Check package.json for actual dependency
        return content.includes('"dependencies"') || content.includes('"devDependencies"');
        
      default:
        return true;
    }
  }
  
  private async performAdvancedSecurityChecks(targetPath: string): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];
    
    // Check for security-sensitive files
    const sensitiveFiles = [
      '.env',
      '.env.local',
      '.env.production',
      'config.json',
      'secrets.json',
      'private.key',
      'id_rsa'
    ];
    
    for (const filename of sensitiveFiles) {
      const filePath = path.join(targetPath, filename);
      try {
        await fs.access(filePath);
        issues.push({
          severity: 'high',
          category: 'configuration',
          rule: 'sensitive-file',
          file: filename,
          title: 'Sensitive File Exposed',
          description: `Sensitive file ${filename} found in repository`,
          impact: 'Credential exposure, configuration leakage',
          remediation: 'Add to .gitignore and remove from repository',
          cweId: 'CWE-200',
          owaspCategory: 'A05:2021 – Security Misconfiguration',
          confidence: 'high'
        });
      } catch {
        // File doesn't exist, which is good
      }
    }
    
    // Check Docker security
    const dockerfilePath = path.join(targetPath, 'Dockerfile');
    try {
      const dockerfile = await fs.readFile(dockerfilePath, 'utf-8');
      if (dockerfile.includes('FROM scratch') || dockerfile.includes('USER root')) {
        issues.push({
          severity: 'medium',
          category: 'container-security',
          rule: 'insecure-docker',
          file: 'Dockerfile',
          title: 'Insecure Docker Configuration',
          description: 'Docker container running as root or using insecure base image',
          impact: 'Container escape, privilege escalation',
          remediation: 'Use non-root user and secure base images',
          cweId: 'CWE-250',
          owaspCategory: 'A05:2021 – Security Misconfiguration',
          confidence: 'medium'
        });
      }
    } catch {
      // No Dockerfile
    }
    
    // Check package.json for security issues
    const packageJsonPath = path.join(targetPath, 'package.json');
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      
      if (packageJson.scripts) {
        for (const [script, command] of Object.entries(packageJson.scripts)) {
          if (typeof command === 'string' && command.includes('rm -rf')) {
            issues.push({
              severity: 'medium',
              category: 'script-security',
              rule: 'dangerous-script',
              file: 'package.json',
              title: 'Dangerous NPM Script',
              description: `Script "${script}" contains potentially dangerous commands`,
              impact: 'Accidental file deletion, system damage',
              remediation: 'Review and sanitize npm scripts',
              cweId: 'CWE-78',
              owaspCategory: 'A03:2021 – Injection',
              confidence: 'medium'
            });
          }
        }
      }
    } catch {
      // No package.json or invalid JSON
    }
    
    return issues;
  }
  
  private sortIssuesBySeverity(issues: SecurityIssue[]): SecurityIssue[] {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    return issues.sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      
      // Secondary sort by confidence
      const confidenceOrder = { high: 0, medium: 1, low: 2 };
      return confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
    });
  }
  
  private calculateSecurityScore(issues: SecurityIssue[]): number {
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
        case 'info':
          score -= 1;
          break;
      }
    }
    
    return Math.max(0, score);
  }
  
  private calculateCompliance(issues: SecurityIssue[]): { owasp: number; cwe: number } {
    const owaspCategories = new Set(issues.map(i => i.owaspCategory).filter(Boolean));
    const cweIds = new Set(issues.map(i => i.cweId).filter(Boolean));
    
    // OWASP Top 10 has 10 categories
    const owaspCompliance = Math.max(0, 100 - (owaspCategories.size * 10));
    
    // Arbitrary scoring for CWE (lower is better)
    const cweCompliance = Math.max(0, 100 - (cweIds.size * 2));
    
    return {
      owasp: owaspCompliance,
      cwe: cweCompliance
    };
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
  
  private isInComment(content: string, index: number): boolean {
    const line = this.getLineContent(content, index);
    return line.trim().startsWith('//') || line.trim().startsWith('*');
  }
  
  private displayResults(report: SecurityReport): void {
    console.log('\n' + chalk.bold('═══════════════════════════════════════════════════════════'));
    console.log(chalk.bold.red('                   SECURITY ANALYSIS REPORT                 '));
    console.log(chalk.bold('═══════════════════════════════════════════════════════════\n'));
    
    // Security Score
    const scoreColor = report.securityScore >= 80 ? chalk.green : 
                      report.securityScore >= 60 ? chalk.yellow : chalk.red;
    console.log(chalk.bold('🛡️  Security Score: ') + scoreColor(`${report.securityScore}/100`));
    
    // Summary
    console.log(chalk.bold('\n📊 Summary:'));
    console.log(chalk.gray('├─') + ` Files analyzed: ${chalk.cyan(report.filesAnalyzed)}`);
    console.log(chalk.gray('├─') + ` Total issues: ${chalk.yellow(report.totalIssues)}`);
    console.log(chalk.gray('├─') + ` Critical: ${chalk.red(report.critical)}`);
    console.log(chalk.gray('├─') + ` High: ${chalk.magenta(report.high)}`);
    console.log(chalk.gray('├─') + ` Medium: ${chalk.yellow(report.medium)}`);
    console.log(chalk.gray('├─') + ` Low: ${chalk.blue(report.low)}`);
    console.log(chalk.gray('└─') + ` Scan duration: ${chalk.green(report.scanDuration + 'ms')}\n`);
    
    // Compliance
    console.log(chalk.bold('📋 Compliance Status:'));
    console.log(chalk.gray('├─') + ` OWASP Top 10: ${report.compliance.owasp >= 80 ? chalk.green('✓') : chalk.red('✗')} ${report.compliance.owasp}%`);
    console.log(chalk.gray('└─') + ` CWE Coverage: ${report.compliance.cwe >= 80 ? chalk.green('✓') : chalk.red('✗')} ${report.compliance.cwe}%\n`);
    
    // Top Issues
    if (report.issues.length > 0) {
      console.log(chalk.bold('🚨 Critical Security Issues:'));
      console.log(chalk.gray('─'.repeat(60)));
      
      const displayCount = Math.min(10, report.issues.length);
      for (let i = 0; i < displayCount; i++) {
        const issue = report.issues[i];
        const severityColor = this.getSeverityColor(issue.severity);
        const confidenceIcon = issue.confidence === 'high' ? '🎯' : 
                              issue.confidence === 'medium' ? '🎲' : '❓';
        
        console.log(`\n${severityColor(`[${issue.severity.toUpperCase()}]`)} ${confidenceIcon} ${issue.title}`);
        console.log(chalk.gray(`📁 ${issue.file}${issue.line ? `:${issue.line}` : ''}`));
        console.log(chalk.gray(`🔗 ${issue.owaspCategory || 'General'} | ${issue.cweId || 'N/A'}`));
        console.log(chalk.dim(`📝 ${issue.description}`));
        console.log(chalk.red(`💥 Impact: ${issue.impact}`));
        console.log(chalk.green(`🔧 Fix: ${issue.remediation}`));
        
        if (issue.codeSnippet) {
          console.log(chalk.dim('\nCode:'));
          console.log(chalk.dim(issue.codeSnippet));
        }
      }
      
      if (report.issues.length > displayCount) {
        console.log(chalk.gray(`\n... and ${report.issues.length - displayCount} more security issues`));
      }
    } else {
      console.log(chalk.green('\n✅ No security issues detected! Your code appears secure.'));
    }
    
    // Recommendations
    if (report.totalIssues > 0) {
      console.log(chalk.bold('\n💡 Immediate Actions Required:'));
      console.log(chalk.red('  1. Fix all critical and high severity issues immediately'));
      console.log(chalk.yellow('  2. Review and address medium severity issues'));
      console.log(chalk.blue('  3. Implement security monitoring and alerting'));
      console.log(chalk.green('  4. Regular security audits and dependency updates'));
    }
    
    console.log('\n' + chalk.bold('═══════════════════════════════════════════════════════════\n'));
  }
  
  private getSeverityColor(severity: SecurityIssue['severity']): (text: string) => string {
    switch (severity) {
      case 'critical': return chalk.bgRed.white;
      case 'high': return chalk.red;
      case 'medium': return chalk.yellow;
      case 'low': return chalk.blue;
      case 'info': return chalk.gray;
    }
  }
  
  private isFixable(issue: SecurityIssue): boolean {
    const fixableRules = [
      'hardcoded-credentials',
      'debug-info',
      'insecure-cookies',
      'cors-wildcard',
      'error-disclosure'
    ];
    return fixableRules.includes(issue.rule);
  }
  
  private async autoRemediateIssues(issues: SecurityIssue[]): Promise<number> {
    let fixedCount = 0;
    
    // Group issues by file for batch fixing
    const fileIssues = new Map<string, SecurityIssue[]>();
    for (const issue of issues) {
      const list = fileIssues.get(issue.file) || [];
      list.push(issue);
      fileIssues.set(issue.file, list);
    }
    
    for (const [file, fileIssueList] of fileIssues) {
      try {
        const fullPath = path.join(process.cwd(), file);
        const content = await fs.readFile(fullPath, 'utf-8');
        let modifiedContent = content;
        
        for (const issue of fileIssueList) {
          switch (issue.rule) {
            case 'debug-info':
              modifiedContent = modifiedContent.replace(
                /console\.log\s*\([^)]*(?:password|token)[^)]*\)/gi,
                '// Debug statement removed for security'
              );
              fixedCount++;
              break;
              
            case 'cors-wildcard':
              modifiedContent = modifiedContent.replace(
                /Access-Control-Allow-Origin.*\*/gi,
                'Access-Control-Allow-Origin: https://yourdomain.com'
              );
              fixedCount++;
              break;
              
            case 'insecure-cookies':
              modifiedContent = modifiedContent.replace(
                /httpOnly:\s*false/gi,
                'httpOnly: true'
              );
              modifiedContent = modifiedContent.replace(
                /secure:\s*false/gi,
                'secure: true'
              );
              fixedCount++;
              break;
          }
        }
        
        if (modifiedContent !== content) {
          await fs.writeFile(fullPath, modifiedContent);
        }
        
      } catch (error) {
        console.warn(chalk.yellow(`Failed to auto-fix ${file}: ${error}`));
      }
    }
    
    return fixedCount;
  }
  
  private async generateFormattedReport(report: SecurityReport, format: 'json' | 'html'): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    if (format === 'json') {
      const jsonPath = path.join(process.cwd(), `security-report-${timestamp}.json`);
      await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));
      console.log(chalk.green(`\n📄 JSON report generated: ${jsonPath}`));
    } else if (format === 'html') {
      const htmlPath = path.join(process.cwd(), `security-report-${timestamp}.html`);
      const html = this.generateHTMLReport(report);
      await fs.writeFile(htmlPath, html);
      console.log(chalk.green(`\n📄 HTML report generated: ${htmlPath}`));
    }
  }
  
  private generateHTMLReport(report: SecurityReport): string {
    const severityColors = {
      critical: '#dc3545',
      high: '#fd7e14',
      medium: '#ffc107',
      low: '#20c997',
      info: '#6c757d'
    };
    
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Security Analysis Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .issue { border-left: 4px solid #dee2e6; padding: 15px; margin: 15px 0; background: #ffffff; }
        .critical { border-left-color: ${severityColors.critical}; }
        .high { border-left-color: ${severityColors.high}; }
        .medium { border-left-color: ${severityColors.medium}; }
        .low { border-left-color: ${severityColors.low}; }
        .info { border-left-color: ${severityColors.info}; }
        .code { background: #f8f9fa; padding: 10px; font-family: monospace; white-space: pre-wrap; }
        .severity { font-weight: bold; color: white; padding: 4px 8px; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🛡️ Security Analysis Report</h1>
        <p>Generated: ${new Date().toISOString()}</p>
        <h2>Security Score: ${report.securityScore}/100</h2>
    </div>
    
    <div class="summary">
        <h3>Summary</h3>
        <p><strong>Files Analyzed:</strong> ${report.filesAnalyzed}</p>
        <p><strong>Total Issues:</strong> ${report.totalIssues}</p>
        <p><strong>Critical:</strong> ${report.critical} | <strong>High:</strong> ${report.high} | 
           <strong>Medium:</strong> ${report.medium} | <strong>Low:</strong> ${report.low}</p>
        <p><strong>OWASP Compliance:</strong> ${report.compliance.owasp}%</p>
        <p><strong>CWE Coverage:</strong> ${report.compliance.cwe}%</p>
    </div>
    
    <h3>Security Issues</h3>
    ${report.issues.map(issue => `
        <div class="issue ${issue.severity}">
            <span class="severity" style="background-color: ${severityColors[issue.severity]}">${issue.severity.toUpperCase()}</span>
            <h4>${issue.title}</h4>
            <p><strong>File:</strong> ${issue.file}${issue.line ? `:${issue.line}` : ''}</p>
            <p><strong>Description:</strong> ${issue.description}</p>
            <p><strong>Impact:</strong> ${issue.impact}</p>
            <p><strong>Remediation:</strong> ${issue.remediation}</p>
            <p><strong>References:</strong> ${issue.owaspCategory || 'N/A'} | ${issue.cweId || 'N/A'}</p>
            ${issue.codeSnippet ? `<div class="code">${issue.codeSnippet}</div>` : ''}
        </div>
    `).join('')}
</body>
</html>`;
  }
  
  private async generateSecuritySOW(report: SecurityReport): Promise<void> {
    const sowPath = path.join(process.cwd(), 'docs', '03-sow', 'SECURITY_FIX_SOW.md');
    
    const issuesByCategory: Record<string, SecurityIssue[]> = {};
    for (const issue of report.issues) {
      if (!issuesByCategory[issue.category]) {
        issuesByCategory[issue.category] = [];
      }
      issuesByCategory[issue.category].push(issue);
    }
    
    const sow = `# 🛡️ Security Fix SOW (Statement of Work)

**Generated**: ${new Date().toISOString()}
**Security Score**: ${report.securityScore}/100
**Total Issues**: ${report.totalIssues}
**Priority**: ${report.critical > 0 ? '🔴 CRITICAL' : report.high > 0 ? '⚡ HIGH' : '🟡 MEDIUM'}

## 🚨 Executive Summary

This security analysis identified **${report.totalIssues}** security issues across **${report.filesAnalyzed}** files. 
Immediate action is required to address **${report.critical + report.high}** critical and high-severity vulnerabilities.

### 📊 Security Metrics

- **Security Score**: ${report.securityScore}/100
- **OWASP Top 10 Compliance**: ${report.compliance.owasp}%
- **CWE Coverage Score**: ${report.compliance.cwe}%

### 🎯 Severity Distribution

- **Critical**: ${report.critical} issues
- **High**: ${report.high} issues  
- **Medium**: ${report.medium} issues
- **Low**: ${report.low} issues
- **Info**: ${report.info} issues

## 🚀 Remediation Plan

### Phase 1: Critical Issues (IMMEDIATE - 24 hours)
${report.issues.filter(i => i.severity === 'critical').slice(0, 10).map(issue => 
  `- [ ] **${issue.title}** in ${issue.file}${issue.line ? `:${issue.line}` : ''}
    - Impact: ${issue.impact}
    - Fix: ${issue.remediation}`
).join('\n')}

### Phase 2: High Priority (1-3 days)
${report.issues.filter(i => i.severity === 'high').slice(0, 10).map(issue => 
  `- [ ] **${issue.title}** in ${issue.file}${issue.line ? `:${issue.line}` : ''}
    - Impact: ${issue.impact}
    - Fix: ${issue.remediation}`
).join('\n')}

### Phase 3: Medium Priority (1-2 weeks)
${report.issues.filter(i => i.severity === 'medium').slice(0, 10).map(issue => 
  `- [ ] **${issue.title}** in ${issue.file}${issue.line ? `:${issue.line}` : ''}
    - Fix: ${issue.remediation}`
).join('\n')}

## 📋 Issues by Category

${Object.entries(issuesByCategory).map(([category, issues]) => `
### ${category.charAt(0).toUpperCase() + category.slice(1)}
${issues.slice(0, 5).map(issue => 
  `- **${issue.severity}**: ${issue.title} (${issue.file})`
).join('\n')}
`).join('')}

## 🔧 Implementation Guidelines

### Immediate Actions (Next 24 hours)
1. **Deploy Critical Fixes**: Address all critical vulnerabilities immediately
2. **Security Monitoring**: Implement monitoring for detected attack patterns
3. **Access Review**: Review and restrict access to sensitive endpoints
4. **Incident Response**: Prepare incident response procedures

### Short-term Actions (Next Week)
1. **Code Review**: Implement security-focused code review processes
2. **Dependency Updates**: Update all vulnerable dependencies
3. **Security Testing**: Integrate security testing into CI/CD pipeline
4. **Developer Training**: Security awareness training for development team

### Long-term Actions (Next Month)
1. **Security Architecture**: Review and enhance security architecture
2. **Automated Scanning**: Deploy continuous security scanning
3. **Compliance Framework**: Implement OWASP/CWE compliance monitoring
4. **Regular Audits**: Schedule quarterly security assessments

## 📊 Success Metrics

- [ ] Security score > 85/100
- [ ] Zero critical and high-severity issues
- [ ] OWASP Top 10 compliance > 90%
- [ ] All dependencies up-to-date and secure
- [ ] Security testing integrated in CI/CD
- [ ] Regular security training completed

## 💰 Resource Requirements

- **Security Engineers**: 2-3 engineers for critical fixes
- **Development Time**: 40-80 hours for complete remediation
- **Tools/Licenses**: Security scanning tools, dependency monitoring
- **Training**: Security awareness training for 5-10 developers

---
**⚠️ URGENT**: Critical and high-severity issues require immediate attention to prevent potential security breaches.

Generated by MARIA Security Analysis Tool
`;
    
    try {
      await fs.mkdir(path.dirname(sowPath), { recursive: true });
      await fs.writeFile(sowPath, sow);
      console.log(chalk.green(`\n📄 Security fix SOW generated: ${sowPath}`));
    } catch (error) {
      console.warn(chalk.yellow(`Failed to generate SOW: ${error}`));
    }
  }
}

export default SecurityReviewCommand;