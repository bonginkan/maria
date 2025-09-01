/**
 * Legacy Bridge - Minimal compatibility layer for legacy commands
 * This is a temporary solution that will be sunset on 2025-10-31
 * Only P1 target commands (/status, /doctor) are supported
 */

import { getVersion } from '../../utils/version';
import { logger } from '../../utils/logger';

export interface CommandResult {
  ok: boolean;
  endReason: 'success' | 'partial' | 'error' | 'timeout';
  message?: string;
  data?: unknown;
}

export class LegacyBridge {
  // Sunset date - after this date, CI will fail
  private readonly SUNSET_DATE = new Date('2025-10-31');
  private readonly LEGACY_TARGETS = ['/status', '/doctor'];
  
  constructor() {
    this.checkSunset();
  }
  
  private checkSunset(): void {
    const now = new Date();
    const daysUntilSunset = Math.ceil((this.SUNSET_DATE.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (now > this.SUNSET_DATE) {
      throw new Error(`Legacy bridge expired. All commands must be migrated to V2`);
    }
    
    if (daysUntilSunset < 30) {
      logger.warn(`⚠️ Legacy bridge will sunset in ${daysUntilSunset} days. Migrate to V2 urgently.`);
    }
  }
  
  async execute(command: string, args: any): Promise<CommandResult> {
    // Check sunset on every execution
    if (new Date() > this.SUNSET_DATE) {
      return {
        ok: false,
        endReason: 'error',
        message: `Legacy bridge expired. Command ${command} must be migrated to V2`
      };
    }
    
    // Only handle P1 target commands
    if (!this.LEGACY_TARGETS.includes(command)) {
      return {
        ok: false,
        endReason: 'error',
        message: `Legacy command not supported: ${command}. Only ${this.LEGACY_TARGETS.join(', ')} are available via legacy bridge.`
      };
    }
    
    // Minimal implementations for emergency recovery
    switch(command) {
      case '/status':
        return this.minimalStatus();
      case '/doctor':
        return this.minimalDoctor();
      default:
        return {
          ok: false,
          endReason: 'error',
          message: `Unexpected legacy command: ${command}`
        };
    }
  }
  
  /**
   * Minimal /status implementation for emergency recovery
   */
  private async minimalStatus(): Promise<CommandResult> {
    try {
      const uptime = process.uptime();
      const memUsage = process.memoryUsage();
      
      return {
        ok: true,
        endReason: 'success',
        message: `MARIA v${getVersion()} - Status OK`,
        data: {
          version: getVersion(),
          uptime: {
            seconds: Math.floor(uptime),
            human: this.formatUptime(uptime)
          },
          memory: {
            used: Math.round(memUsage.heapUsed / 1024 / 1024),
            total: Math.round(memUsage.heapTotal / 1024 / 1024),
            unit: 'MB'
          },
          node: process.version,
          platform: process.platform,
          pid: process.pid
        }
      };
    } catch (error) {
      return {
        ok: false,
        endReason: 'error',
        message: 'Failed to get system status',
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
  
  /**
   * Minimal /doctor implementation for system diagnostics
   */
  private async minimalDoctor(): Promise<CommandResult> {
    const issues: string[] = [];
    const warnings: string[] = [];
    
    // Check critical environment variables
    const requiredEnvVars = [
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'GOOGLE_API_KEY'
    ];
    
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        warnings.push(`Missing ${envVar} - some features may be unavailable`);
      }
    }
    
    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    if (majorVersion < 18) {
      issues.push(`Node.js version ${nodeVersion} is too old. Minimum required: v18.0.0`);
    }
    
    // Check memory usage
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
    const usagePercent = (heapUsedMB / heapTotalMB) * 100;
    
    if (usagePercent > 90) {
      issues.push(`High memory usage: ${usagePercent.toFixed(1)}%`);
    } else if (usagePercent > 75) {
      warnings.push(`Memory usage at ${usagePercent.toFixed(1)}%`);
    }
    
    // Determine overall health
    const hasIssues = issues.length > 0;
    const hasWarnings = warnings.length > 0;
    
    return {
      ok: !hasIssues,
      endReason: hasIssues ? 'error' : (hasWarnings ? 'partial' : 'success'),
      message: hasIssues 
        ? `❌ ${issues.length} critical issues found`
        : hasWarnings 
          ? `⚠️ System operational with ${warnings.length} warnings`
          : '✅ All systems operational',
      data: {
        issues,
        warnings,
        checks: {
          nodeVersion: nodeVersion,
          platform: process.platform,
          arch: process.arch,
          memory: {
            used: Math.round(heapUsedMB),
            total: Math.round(heapTotalMB),
            percent: usagePercent.toFixed(1)
          },
          uptime: this.formatUptime(process.uptime()),
          env: {
            configured: requiredEnvVars.filter(v => !!process.env[v]).length,
            total: requiredEnvVars.length
          }
        },
        legacyBridge: {
          sunset: this.SUNSET_DATE.toISOString().split('T')[0],
          daysRemaining: Math.ceil((this.SUNSET_DATE.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        }
      }
    };
  }
  
  /**
   * Format uptime in human-readable format
   */
  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
    
    return parts.join(' ');
  }
}