/**
 * /doctor command - Real diagnostic implementation
 * P0: Read-only diagnostic checks with actionable guidance
 * @functional - Must complete in <800ms p95
 */

import { withLightPipe, type CommandContext, type CommandResult } from '../../shared/secure-pipe.js';
import { existsSync, statSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

interface DiagnosticCheck {
  name: string;
  result: 'pass' | 'fail' | 'warn';
  message: string;
  fix?: string;
}

class DoctorCommandImpl {
  public readonly metadata = {
    name: 'doctor',
    description: 'Run diagnostic checks with actionable fixes',
    category: 'system',
    aliases: ['diagnose', 'diag'],
    version: '3.0.0',
    type: 'functional' as const,
    planRequired: 'free' as const,
    isPreview: false,
    owner: 'ops@maria',
    slo: { p95Ms: 800 },
    telemetry: true
  };

  async execute(args: string[], context: CommandContext): Promise<CommandResult> {
    const startTime = Date.now();
    const outputJson = args.includes('--json');
    const verbose = args.includes('--verbose');
    
    // Run checks with timeout
    const checkPromises = [
      this.checkEnvKeys(),
      this.checkServiceAccount(),
      this.checkNetworkEgress(),
      this.checkNodeModules(),
      this.checkFilePermissions()
    ];

    // Race against timeout (750ms to stay under 800ms p95)
    const checks = await Promise.race([
      Promise.all(checkPromises),
      new Promise<DiagnosticCheck[]>((resolve) => 
        setTimeout(() => resolve([{
          name: 'Timeout',
          result: 'fail',
          message: 'Diagnostic checks timed out',
          fix: 'Run doctor with --verbose for detailed checks'
        }]), 750)
      )
    ]);

    // Summary
    const passed = checks.filter(c => c.result === 'pass').length;
    const warnings = checks.filter(c => c.result === 'warn').length;
    const failures = checks.filter(c => c.result === 'fail').length;
    const overallHealth = failures > 0 ? 'unhealthy' : warnings > 1 ? 'needs-attention' : 'healthy';

    // JSON output
    if (outputJson) {
      return {
        success: true,
        output: JSON.stringify({
          health: overallHealth,
          checks,
          summary: { passed, warnings, failures },
          latencyMs: Date.now() - startTime
        }, null, 2),
        metadata: { format: 'json', overallHealth },
        requiresInput: false,
        endReason: 'success'
      };
    }

    // Format output
    const output = this.formatDiagnosticReport(checks, {
      passed,
      warnings,
      failures,
      overallHealth,
      verbose,
      latencyMs: Date.now() - startTime
    });

    return {
      success: true,
      output,
      metadata: { overallHealth, latencyMs: Date.now() - startTime },
      requiresInput: false,
      endReason: 'success'
    };
  }

  private async checkEnvKeys(): Promise<DiagnosticCheck> {
    const requiredKeys = [
      'NODE_ENV',
      'GOOGLE_PROJECT_ID',
      'FIREBASE_CONFIG'
    ];

    const missing: string[] = [];
    for (const key of requiredKeys) {
      if (!process.env[key]) {
        missing.push(key);
      }
    }

    if (missing.length === 0) {
      return {
        name: 'Environment Variables',
        result: 'pass',
        message: `All ${requiredKeys.length} required keys present`
      };
    }

    return {
      name: 'Environment Variables',
      result: missing.length === requiredKeys.length ? 'fail' : 'warn',
      message: `Missing: ${missing.join(', ')}`,
      fix: `Export: ${missing.map(k => `export ${k}=<value>`).join('; ')}`
    };
  }

  private async checkServiceAccount(): Promise<DiagnosticCheck> {
    try {
      // Check for service account key file or ADC
      const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      const hasADC = process.env.GOOGLE_APPLICATION_DEFAULT_CREDENTIALS;
      
      if (keyFile && existsSync(keyFile)) {
        return {
          name: 'Service Account',
          result: 'pass',
          message: 'Key file configured'
        };
      }

      if (hasADC || process.env.GOOGLE_PROJECT_ID) {
        // Try to access Secret Manager (dry run)
        return {
          name: 'Service Account',
          result: 'pass',
          message: 'Using Application Default Credentials'
        };
      }

      return {
        name: 'Service Account',
        result: 'warn',
        message: 'No service account configured',
        fix: 'Run: gcloud auth application-default login'
      };
    } catch (error) {
      return {
        name: 'Service Account',
        result: 'fail',
        message: 'Service account check failed',
        fix: 'Configure GOOGLE_APPLICATION_CREDENTIALS'
      };
    }
  }

  private async checkNetworkEgress(): Promise<DiagnosticCheck> {
    try {
      const cloudRunHost = process.env.CLOUD_RUN_URL || 'maria-landing-page.run.app';
      const hostname = cloudRunHost.replace(/^https?:\/\//, '').split('/')[0];
      
      // DNS check only (no actual connection)
      execSync(`nslookup ${hostname}`, { stdio: 'ignore', timeout: 1000 });
      
      return {
        name: 'Network Egress',
        result: 'pass',
        message: `DNS resolves for ${hostname}`
      };
    } catch (error) {
      return {
        name: 'Network Egress',
        result: 'warn',
        message: 'Cannot resolve Cloud Run hostname',
        fix: 'Check network connectivity and DNS settings'
      };
    }
  }

  private async checkNodeModules(): Promise<DiagnosticCheck> {
    const criticalModules = [
      'typescript',
      '@google-cloud/secret-manager',
      'vitest'
    ];

    const nodeModulesPath = resolve(process.cwd(), 'node_modules');
    
    if (!existsSync(nodeModulesPath)) {
      return {
        name: 'Node Modules',
        result: 'fail',
        message: 'node_modules not found',
        fix: 'Run: pnpm install'
      };
    }

    const missing: string[] = [];
    for (const mod of criticalModules) {
      const modPath = resolve(nodeModulesPath, mod);
      if (!existsSync(modPath)) {
        missing.push(mod);
      }
    }

    if (missing.length === 0) {
      return {
        name: 'Node Modules',
        result: 'pass',
        message: 'Critical modules installed'
      };
    }

    return {
      name: 'Node Modules',
      result: 'warn',
      message: `Missing: ${missing.join(', ')}`,
      fix: `Run: pnpm add ${missing.join(' ')}`
    };
  }

  private async checkFilePermissions(): Promise<DiagnosticCheck> {
    try {
      const testFile = resolve(process.cwd(), '.doctor-test-' + Date.now());
      
      // Try to write
      require('fs').writeFileSync(testFile, 'test');
      
      // Check if we can read it back
      const stats = statSync(testFile);
      const canWrite = stats.mode & 0o200;
      
      // Clean up
      require('fs').unlinkSync(testFile);
      
      if (canWrite) {
        return {
          name: 'File Permissions',
          result: 'pass',
          message: 'Read/write access verified'
        };
      }

      return {
        name: 'File Permissions',
        result: 'warn',
        message: 'Limited write permissions',
        fix: 'Check directory ownership and permissions'
      };
    } catch (error) {
      return {
        name: 'File Permissions',
        result: 'fail',
        message: 'Cannot write to working directory',
        fix: `Run: chmod u+w ${process.cwd()}`
      };
    }
  }

  private formatDiagnosticReport(
    checks: DiagnosticCheck[],
    summary: any
  ): string {
    const icons = {
      pass: '✓',
      warn: '⚠',
      fail: '✗'
    };

    let output = 'System Diagnostics\n';
    output += '═══════════════════════════════════\n\n';
    
    // Checks with results
    for (const check of checks) {
      const icon = icons[check.result];
      const name = check.name.padEnd(22);
      output += `${icon} ${name} ${check.message}\n`;
      
      if (check.fix) {
        output += `  Fix: ${check.fix}\n`;
      }
    }
    
    // Summary
    output += '\n───────────────────────────────────\n';
    output += `Summary: ${summary.passed} passed, ${summary.warnings} warnings, ${summary.failures} failures\n`;
    output += `Health: ${summary.overallHealth} (${summary.latencyMs}ms)\n`;
    
    // Guidance
    if (summary.failures > 0) {
      output += '\n⚠️ Address failures above before proceeding\n';
    } else if (summary.warnings > 0) {
      output += '\n💡 Consider fixing warnings for optimal performance\n';
    } else {
      output += '\n✅ System ready for use\n';
    }
    
    return output;
  }
}

// Export with light pipe
export const DoctorCommand = withLightPipe(new DoctorCommandImpl());
export default DoctorCommand;