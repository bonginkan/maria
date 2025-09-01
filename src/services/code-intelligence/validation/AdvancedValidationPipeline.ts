import { BaseService } from '../../BaseService.js';
import { execSync, spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { TypeScriptEngine } from '../EnterpriseTypeScriptEngine.js';

export interface ValidationResult {
  stage: string;
  success: boolean;
  errors: ValidationError[];
  warnings: string[];
  duration: number;
  details?: any;
}

export interface ValidationError {
  type: 'syntax' | 'semantic' | 'test' | 'build' | 'security';
  message: string;
  file?: string;
  line?: number;
  column?: number;
  severity: 'error' | 'warning' | 'info';
}

export interface ValidationConfig {
  enableSyntaxCheck: boolean;
  enableSemanticCheck: boolean;
  enableTestExecution: boolean;
  enableBuildVerification: boolean;
  enableSecurityScan: boolean;
  strictMode: boolean;
  timeoutMs: number;
}

export class AdvancedValidationPipeline extends BaseService {
  private config: ValidationConfig;
  private tsEngine: TypeScriptEngine;

  constructor(config: Partial<ValidationConfig> = {}) {
    super();
    this.config = {
      enableSyntaxCheck: true,
      enableSemanticCheck: true,
      enableTestExecution: true,
      enableBuildVerification: true,
      enableSecurityScan: true,
      strictMode: false,
      timeoutMs: 300000, // 5 minutes
      ...config
    };
    this.tsEngine = new TypeScriptEngine();
  }

  async validateChanges(
    workingDir: string,
    changedFiles: string[] = []
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    const startTime = Date.now();

    try {
      // Stage 1: Syntax Check
      if (this.config.enableSyntaxCheck) {
        const syntaxResult = await this.runSyntaxCheck(workingDir, changedFiles);
        results.push(syntaxResult);
        
        if (!syntaxResult.success && this.config.strictMode) {
          return results; // Fail fast in strict mode
        }
      }

      // Stage 2: Semantic Check (ESLint)
      if (this.config.enableSemanticCheck) {
        const semanticResult = await this.runSemanticCheck(workingDir, changedFiles);
        results.push(semanticResult);
        
        if (!semanticResult.success && this.config.strictMode) {
          return results;
        }
      }

      // Stage 3: Test Execution
      if (this.config.enableTestExecution) {
        const testResult = await this.runTestExecution(workingDir, changedFiles);
        results.push(testResult);
        
        if (!testResult.success && this.config.strictMode) {
          return results;
        }
      }

      // Stage 4: Build Verification
      if (this.config.enableBuildVerification) {
        const buildResult = await this.runBuildVerification(workingDir);
        results.push(buildResult);
        
        if (!buildResult.success && this.config.strictMode) {
          return results;
        }
      }

      // Stage 5: Security Scan
      if (this.config.enableSecurityScan) {
        const securityResult = await this.runSecurityScan(workingDir, changedFiles);
        results.push(securityResult);
      }

    } catch (error) {
      results.push({
        stage: 'pipeline_error',
        success: false,
        errors: [{
          type: 'build',
          message: `Pipeline execution failed: ${error.message}`,
          severity: 'error'
        }],
        warnings: [],
        duration: Date.now() - startTime
      });
    }

    return results;
  }

  private async runSyntaxCheck(
    workingDir: string, 
    changedFiles: string[]
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    try {
      // Use TypeScript compiler API for syntax checking
      const filesToCheck = changedFiles.length > 0 
        ? changedFiles.filter(f => f.endsWith('.ts') || f.endsWith('.tsx'))
        : await this.findTypeScriptFiles(workingDir);

      for (const file of filesToCheck) {
        const fullPath = path.resolve(workingDir, file);
        const diagnostics = await this.tsEngine.getDiagnostics(fullPath);
        
        for (const diagnostic of diagnostics) {
          if (diagnostic.category === 1) { // Error
            errors.push({
              type: 'syntax',
              message: diagnostic.messageText as string,
              file: file,
              line: diagnostic.line,
              column: diagnostic.character,
              severity: 'error'
            });
          } else if (diagnostic.category === 0) { // Warning
            warnings.push(`${file}: ${diagnostic.messageText}`);
          }
        }
      }

      return {
        stage: 'syntax_check',
        success: errors.length === 0,
        errors,
        warnings,
        duration: Date.now() - startTime,
        details: { filesChecked: filesToCheck.length }
      };

    } catch (error) {
      return {
        stage: 'syntax_check',
        success: false,
        errors: [{
          type: 'syntax',
          message: `Syntax check failed: ${error.message}`,
          severity: 'error'
        }],
        warnings,
        duration: Date.now() - startTime
      };
    }
  }

  private async runSemanticCheck(
    workingDir: string,
    changedFiles: string[]
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    try {
      const command = 'pnpm';
      const args = ['lint:errors-only'];
      
      if (changedFiles.length > 0) {
        // Only lint changed files
        args.push('--', ...changedFiles);
      }

      const result = execSync(`${command} ${args.join(' ')}`, {
        cwd: workingDir,
        encoding: 'utf-8',
        timeout: this.config.timeoutMs
      });

      // Parse ESLint output
      const lines = result.split('\n');
      for (const line of lines) {
        if (line.includes('error')) {
          const match = line.match(/(.+):(\d+):(\d+): error (.+)/);
          if (match) {
            errors.push({
              type: 'semantic',
              message: match[4],
              file: match[1],
              line: parseInt(match[2]),
              column: parseInt(match[3]),
              severity: 'error'
            });
          }
        } else if (line.includes('warning')) {
          warnings.push(line);
        }
      }

      return {
        stage: 'semantic_check',
        success: errors.length === 0,
        errors,
        warnings,
        duration: Date.now() - startTime
      };

    } catch (error) {
      // ESLint returns non-zero exit code when errors found
      const errorOutput = error.stdout || error.message;
      
      return {
        stage: 'semantic_check',
        success: false,
        errors: [{
          type: 'semantic',
          message: `ESLint check failed: ${errorOutput}`,
          severity: 'error'
        }],
        warnings,
        duration: Date.now() - startTime
      };
    }
  }

  private async runTestExecution(
    workingDir: string,
    changedFiles: string[]
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    try {
      // Run smoke tests first for fast feedback
      const smokeResult = execSync('pnpm test:smoke', {
        cwd: workingDir,
        encoding: 'utf-8',
        timeout: 60000 // 1 minute for smoke tests
      });

      // If changed files include test files, run related tests
      const testFiles = changedFiles.filter(f => f.includes('.test.') || f.includes('.spec.'));
      
      if (testFiles.length > 0) {
        for (const testFile of testFiles) {
          try {
            execSync(`pnpm test ${testFile}`, {
              cwd: workingDir,
              encoding: 'utf-8',
              timeout: 120000 // 2 minutes per test file
            });
          } catch (testError) {
            errors.push({
              type: 'test',
              message: `Test failed: ${testFile}`,
              file: testFile,
              severity: 'error'
            });
          }
        }
      }

      return {
        stage: 'test_execution',
        success: errors.length === 0,
        errors,
        warnings,
        duration: Date.now() - startTime,
        details: { testFilesRun: testFiles.length }
      };

    } catch (error) {
      return {
        stage: 'test_execution',
        success: false,
        errors: [{
          type: 'test',
          message: `Test execution failed: ${error.message}`,
          severity: 'error'
        }],
        warnings,
        duration: Date.now() - startTime
      };
    }
  }

  private async runBuildVerification(workingDir: string): Promise<ValidationResult> {
    const startTime = Date.now();
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    try {
      // Clean build to ensure no cached issues
      execSync('pnpm clean', {
        cwd: workingDir,
        encoding: 'utf-8',
        timeout: 30000
      });

      // Run production build
      const buildResult = execSync('pnpm build', {
        cwd: workingDir,
        encoding: 'utf-8',
        timeout: this.config.timeoutMs
      });

      // Check if build output exists
      const distPath = path.join(workingDir, 'dist');
      const distExists = await fs.access(distPath).then(() => true).catch(() => false);
      
      if (!distExists) {
        errors.push({
          type: 'build',
          message: 'Build completed but dist directory not found',
          severity: 'error'
        });
      }

      return {
        stage: 'build_verification',
        success: errors.length === 0,
        errors,
        warnings,
        duration: Date.now() - startTime,
        details: { buildOutput: buildResult.length }
      };

    } catch (error) {
      return {
        stage: 'build_verification',
        success: false,
        errors: [{
          type: 'build',
          message: `Build verification failed: ${error.message}`,
          severity: 'error'
        }],
        warnings,
        duration: Date.now() - startTime
      };
    }
  }

  private async runSecurityScan(
    workingDir: string,
    changedFiles: string[]
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    try {
      // Basic security checks
      const securityPatterns = [
        { pattern: /process\.env\.[A-Z_]+/g, message: 'Environment variable usage detected' },
        { pattern: /console\.log|console\.error|console\.warn/g, message: 'Console statement detected' },
        { pattern: /eval\s*\(/g, message: 'Unsafe eval() usage detected' },
        { pattern: /innerHTML\s*=/g, message: 'Potentially unsafe innerHTML usage' },
        { pattern: /\.system\(|exec\(|spawn\(/g, message: 'System command execution detected' }
      ];

      const filesToScan = changedFiles.length > 0 ? changedFiles : await this.findSourceFiles(workingDir);

      for (const file of filesToScan) {
        const fullPath = path.resolve(workingDir, file);
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          
          for (const { pattern, message } of securityPatterns) {
            const matches = content.match(pattern);
            if (matches) {
              warnings.push(`${file}: ${message} (${matches.length} occurrences)`);
            }
          }
        } catch (readError) {
          warnings.push(`Could not read file for security scan: ${file}`);
        }
      }

      return {
        stage: 'security_scan',
        success: true, // Security scan generates warnings, not errors
        errors,
        warnings,
        duration: Date.now() - startTime,
        details: { filesScanned: filesToScan.length }
      };

    } catch (error) {
      return {
        stage: 'security_scan',
        success: false,
        errors: [{
          type: 'security',
          message: `Security scan failed: ${error.message}`,
          severity: 'error'
        }],
        warnings,
        duration: Date.now() - startTime
      };
    }
  }

  private async findTypeScriptFiles(workingDir: string): Promise<string[]> {
    const files: string[] = [];
    const srcDir = path.join(workingDir, 'src');
    
    try {
      const entries = await fs.readdir(srcDir, { recursive: true, withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          files.push(path.relative(workingDir, path.join(entry.path, entry.name)));
        }
      }
    } catch (error) {
      // Fallback to glob pattern
    }
    
    return files;
  }

  private async findSourceFiles(workingDir: string): Promise<string[]> {
    const files: string[] = [];
    const srcDir = path.join(workingDir, 'src');
    
    try {
      const entries = await fs.readdir(srcDir, { recursive: true, withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          files.push(path.relative(workingDir, path.join(entry.path, entry.name)));
        }
      }
    } catch (error) {
      // Fallback to current directory
    }
    
    return files;
  }

  async generateValidationReport(results: ValidationResult[]): Promise<string> {
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
    const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    
    const overallSuccess = results.every(r => r.success);
    
    let report = `\n🔍 Advanced Validation Pipeline Report\n`;
    report += `====================================\n\n`;
    report += `📊 Summary:\n`;
    report += `- Status: ${overallSuccess ? '✅ PASS' : '❌ FAIL'}\n`;
    report += `- Total Errors: ${totalErrors}\n`;
    report += `- Total Warnings: ${totalWarnings}\n`;
    report += `- Duration: ${(totalDuration / 1000).toFixed(2)}s\n\n`;

    for (const result of results) {
      const status = result.success ? '✅' : '❌';
      report += `${status} ${result.stage.toUpperCase().replace('_', ' ')} (${(result.duration / 1000).toFixed(2)}s)\n`;
      
      if (result.errors.length > 0) {
        report += `  Errors:\n`;
        for (const error of result.errors.slice(0, 5)) { // Limit to 5 errors per stage
          report += `    • ${error.message}\n`;
          if (error.file) {
            report += `      ${error.file}:${error.line || 0}:${error.column || 0}\n`;
          }
        }
        if (result.errors.length > 5) {
          report += `    ... and ${result.errors.length - 5} more errors\n`;
        }
      }
      
      if (result.warnings.length > 0) {
        report += `  Warnings:\n`;
        for (const warning of result.warnings.slice(0, 3)) { // Limit to 3 warnings per stage
          report += `    ⚠️  ${warning}\n`;
        }
        if (result.warnings.length > 3) {
          report += `    ... and ${result.warnings.length - 3} more warnings\n`;
        }
      }
      
      report += `\n`;
    }

    if (!overallSuccess) {
      report += `\n🚨 Validation Failed - Review errors above before proceeding\n`;
      report += `💡 Use --dry-run flag to see changes without applying them\n`;
    } else {
      report += `\n🎉 All validation checks passed - Safe to proceed\n`;
    }

    return report;
  }
}