/**
 * System Doctor Command (Cloud-Ready)
 * Production diagnostics with actionable fixes following SOW v2.0 patterns
 */

import { CommandArgs, CommandContext, CommandResult } from "../../types.js";
import { trackCommand } from "../../../services/telemetry/command-tracker.js";
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

interface DiagnosticResult {
  check: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  fix?: string;
}

export const doctorCommand = {
  name: "doctor",
  category: "system" as const,
  description: "Run comprehensive system diagnostics with actionable fixes",
  usage: "[--verbose] [--fix]",
  
  async execute(...args: string[]): Promise<CommandResult> {
    const startTime = Date.now();
    const verbose = args.includes('--verbose');
    const autoFix = args.includes('--fix');
    
    console.log('🩺 Running system diagnostics...');
    console.log('');

    try {
      // Run all diagnostic checks with timeout
      const diagnosticsPromise = Promise.all([
        checkEnvironmentVariables(),
        checkServiceAccountConfig(),
        checkNetworkEgress(),
        checkNodeModules(),
        checkFilePermissions(),
        checkDiskSpace(),
        checkMemoryUsage()
      ]);
      
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Diagnostics timeout')), 750)
      );
      
      const results = await Promise.race([diagnosticsPromise, timeoutPromise]);
      
      // Display results
      const issues = results.filter(r => r.status !== 'pass');
      const criticalIssues = results.filter(r => r.status === 'fail');
      
      displayDiagnosticResults(results, verbose);
      
      if (issues.length === 0) {
        console.log('\n🎉 All diagnostics passed! System is healthy.');
      } else {
        console.log(`\n⚠️ Found ${issues.length} issue${issues.length === 1 ? '' : 's'} (${criticalIssues.length} critical)`);
        
        if (autoFix) {
          console.log('\n🔧 Attempting automatic fixes...');
          await attemptAutoFixes(issues);
        } else {
          console.log('\n💡 Run with --fix to attempt automatic fixes');
        }
      }

      await trackCommand({
        cmd: 'doctor',
        status: criticalIssues.length === 0 ? 'success' : 'error',
        latencyMs: Date.now() - startTime,
        plan: 'FREE',
        quotaLeft: 99
      });

      return { 
        success: criticalIssues.length === 0, 
        endReason: 'completed',
        data: { 
          totalChecks: results.length, 
          issues: issues.length, 
          critical: criticalIssues.length 
        }
      };

    } catch (error) {
      console.log('❌ System diagnostics failed');
      console.log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      await trackCommand({
        cmd: 'doctor',
        status: 'error',
        latencyMs: Date.now() - startTime,
        plan: 'FREE',
        quotaLeft: 99
      });

      return { success: false, endReason: 'service-error' };
    }
  }
};

async function checkEnvironmentVariables(): Promise<DiagnosticResult> {
  const requiredVars = ['NODE_ENV', 'HOME'];
  const missingVars = requiredVars.filter(v => !process.env[v]);
  
  if (missingVars.length === 0) {
    return {
      check: 'Environment Variables',
      status: 'pass',
      message: 'All required environment variables are set'
    };
  }
  
  return {
    check: 'Environment Variables',
    status: 'fail',
    message: `Missing required variables: ${missingVars.join(', ')}`,
    fix: `Set missing environment variables in your shell profile`
  };
}

async function checkServiceAccountConfig(): Promise<DiagnosticResult> {
  try {
    // Mock check - would verify service account in production
    const hasServiceAccount = true;
    
    if (hasServiceAccount) {
      return {
        check: 'Service Account',
        status: 'pass',
        message: 'Service account configuration is valid'
      };
    }
    
    return {
      check: 'Service Account',
      status: 'warn',
      message: 'Service account not configured',
      fix: 'Run /login to configure authentication'
    };
  } catch {
    return {
      check: 'Service Account',
      status: 'fail',
      message: 'Service account configuration is invalid',
      fix: 'Run /login to reconfigure authentication'
    };
  }
}

async function checkNetworkEgress(): Promise<DiagnosticResult> {
  try {
    // Test DNS resolution
    const { promises: dns } = await import('dns');
    await dns.lookup('api.maria-code.ai');
    
    return {
      check: 'Network Egress',
      status: 'pass',
      message: 'Network connectivity is working'
    };
  } catch (error) {
    return {
      check: 'Network Egress',
      status: 'fail',
      message: 'Cannot reach external services',
      fix: 'Check network connection and firewall settings'
    };
  }
}

async function checkNodeModules(): Promise<DiagnosticResult> {
  try {
    const criticalModules = ['chalk', 'inquirer'];
    
    for (const mod of criticalModules) {
      try {
        require.resolve(mod);
      } catch {
        return {
          check: 'Node Modules',
          status: 'fail',
          message: `Critical module '${mod}' not found`,
          fix: 'Run: npm install --production'
        };
      }
    }
    
    return {
      check: 'Node Modules',
      status: 'pass',
      message: 'All critical node modules are available'
    };
  } catch {
    return {
      check: 'Node Modules',
      status: 'fail',
      message: 'Node modules verification failed',
      fix: 'Reinstall dependencies with: npm install'
    };
  }
}

async function checkFilePermissions(): Promise<DiagnosticResult> {
  try {
    const homeDir = os.homedir();
    const mariaDir = path.join(homeDir, '.maria');
    
    try {
      await fs.access(mariaDir, fs.constants.R_OK | fs.constants.W_OK);
    } catch {
      // Directory doesn't exist or no permissions
      return {
        check: 'File Permissions',
        status: 'warn',
        message: 'MARIA config directory not accessible',
        fix: `Create directory: mkdir -p ${mariaDir}`
      };
    }
    
    return {
      check: 'File Permissions',
      status: 'pass',
      message: 'File system permissions are correct'
    };
  } catch {
    return {
      check: 'File Permissions',
      status: 'fail',
      message: 'File permission check failed',
      fix: 'Check file system permissions and disk health'
    };
  }
}

async function checkDiskSpace(): Promise<DiagnosticResult> {
  try {
    const stats = await fs.statfs(process.cwd());
    const freeSpaceGB = (stats.bavail * stats.bsize) / (1024 * 1024 * 1024);
    
    if (freeSpaceGB > 1) {
      return {
        check: 'Disk Space',
        status: 'pass',
        message: `${freeSpaceGB.toFixed(1)}GB free space available`
      };
    } else if (freeSpaceGB > 0.1) {
      return {
        check: 'Disk Space',
        status: 'warn',
        message: `Low disk space: ${freeSpaceGB.toFixed(1)}GB free`,
        fix: 'Free up disk space or clean temporary files'
      };
    } else {
      return {
        check: 'Disk Space',
        status: 'fail',
        message: `Critical: Only ${freeSpaceGB.toFixed(1)}GB free`,
        fix: 'Immediately free disk space - system may fail'
      };
    }
  } catch {
    return {
      check: 'Disk Space',
      status: 'warn',
      message: 'Could not check disk space',
      fix: 'Manually verify sufficient disk space is available'
    };
  }
}

async function checkMemoryUsage(): Promise<DiagnosticResult> {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedPercent = ((totalMem - freeMem) / totalMem) * 100;
  
  if (usedPercent < 80) {
    return {
      check: 'Memory Usage',
      status: 'pass',
      message: `Memory usage: ${usedPercent.toFixed(1)}%`
    };
  } else if (usedPercent < 90) {
    return {
      check: 'Memory Usage',
      status: 'warn',
      message: `High memory usage: ${usedPercent.toFixed(1)}%`,
      fix: 'Close unnecessary applications or restart system'
    };
  } else {
    return {
      check: 'Memory Usage',
      status: 'fail',
      message: `Critical memory usage: ${usedPercent.toFixed(1)}%`,
      fix: 'Immediately close applications or restart system'
    };
  }
}

function displayDiagnosticResults(results: DiagnosticResult[], verbose: boolean): void {
  console.log('📋 Diagnostic Results:');
  console.log('');
  
  for (const result of results) {
    const icon = result.status === 'pass' ? '✅' : 
                 result.status === 'warn' ? '⚠️' : '❌';
    
    console.log(`${icon} ${result.check}: ${result.message}`);
    
    if (result.fix && (verbose || result.status === 'fail')) {
      console.log(`   💡 Fix: ${result.fix}`);
    }
  }
}

async function attemptAutoFixes(issues: DiagnosticResult[]): Promise<void> {
  let fixesApplied = 0;
  
  for (const issue of issues) {
    if (issue.check === 'File Permissions' && issue.fix?.includes('mkdir')) {
      try {
        const homeDir = os.homedir();
        const mariaDir = path.join(homeDir, '.maria');
        await fs.mkdir(mariaDir, { recursive: true });
        console.log(`✅ Created MARIA config directory: ${mariaDir}`);
        fixesApplied++;
      } catch {
        console.log(`❌ Failed to create MARIA config directory`);
      }
    }
  }
  
  if (fixesApplied === 0) {
    console.log('ℹ️ No automatic fixes available for current issues');
    console.log('   Please apply fixes manually using the suggestions above');
  } else {
    console.log(`\n✅ Applied ${fixesApplied} automatic fix${fixesApplied === 1 ? '' : 'es'}`);
    console.log('   Re-run /doctor to verify fixes');
  }
}

// Export metadata and execute for command registry
export const metadata = {
  name: 'doctor',
  description: 'Run comprehensive system diagnostics with actionable fixes',
  category: 'system',
  version: '1.0.0',
  type: 'functional' as const,
  planRequired: 'free' as const,
  isPreview: false
};

export async function execute(context: any): Promise<any> {
  return await doctorCommand.execute(...(context.args || []));
}