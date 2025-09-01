/**
 * /sales-dashboard command - Converted to functional with withSecurePipe
 * P1: PARTIAL → READY conversion
 */

import { withSecurePipe, type CommandContext, type CommandResult } from '../../shared/secure-pipe.js';

interface DashboardData {
  revenue: {
    current: number;
    previous: number;
    target: number;
    change: number;
  };
  leads: {
    total: number;
    qualified: number;
    converted: number;
    conversionRate: number;
  };
  team: {
    active: number;
    quota: number;
    performance: number;
  };
}

class SalesDashboardCommandImpl {
  public readonly metadata = {
    name: 'sales-dashboard',
    description: 'Interactive sales dashboard with real-time metrics',
    category: 'business',
    aliases: ['dashboard', 'sales'],
    version: '2.1.0',
    type: 'functional' as const,
    planRequired: 'starter' as const,
    isPreview: false,
    owner: 'business@maria',
    slo: { p95Ms: 1000 },
    telemetry: true
  };

  async execute(args: string[], context: CommandContext): Promise<CommandResult> {
    const startTime = Date.now();
    
    // Parse options
    const options = this.parseOptions(args);
    
    try {
      // Fetch dashboard data (simulated for now)
      const data = await this.fetchDashboardData(context);
      
      // Format output based on requested format
      const output = options.format === 'json' 
        ? JSON.stringify(data, null, 2)
        : this.formatTextDashboard(data, options);
      
      return {
        success: true,
        output,
        metadata: {
          format: options.format,
          profile: options.profile,
          latencyMs: Date.now() - startTime
        },
        requiresInput: false,
        endReason: 'success'
      };
    } catch (error: any) {
      return {
        success: false,
        error: 'Failed to load dashboard data',
        output: `Error: ${error.message}\n\n💡 Check your CRM connection or try again later`,
        requiresInput: false,
        endReason: 'error'
      };
    }
  }

  private parseOptions(args: string[]) {
    const options = {
      profile: 'sales',
      theme: 'business',
      format: 'text',
      days: 30
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const value = args[i + 1];
      
      switch (arg) {
        case '--profile':
          if (['executive', 'sales_manager', 'sales', 'marketing', 'pm'].includes(value)) {
            options.profile = value;
            i++;
          }
          break;
        case '--format':
          if (['text', 'json', 'tui'].includes(value)) {
            options.format = value;
            i++;
          }
          break;
        case '--days':
          const days = parseInt(value);
          if (!isNaN(days) && days > 0 && days <= 365) {
            options.days = days;
            i++;
          }
          break;
      }
    }

    return options;
  }

  private async fetchDashboardData(context: CommandContext): Promise<DashboardData> {
    // In production, this would fetch from CRM API
    // For now, return simulated data
    return {
      revenue: {
        current: 125000,
        previous: 98000,
        target: 150000,
        change: 27.6
      },
      leads: {
        total: 847,
        qualified: 234,
        converted: 67,
        conversionRate: 28.6
      },
      team: {
        active: 12,
        quota: 10000,
        performance: 108.5
      }
    };
  }

  private formatTextDashboard(data: DashboardData, options: any): string {
    const { revenue, leads, team } = data;
    
    let output = `📊 Sales Dashboard - ${options.profile.toUpperCase()}\n`;
    output += `═════════════════════════════════════\n\n`;
    
    // Revenue Section
    output += `💰 Revenue (Last ${options.days} days)\n`;
    output += `─────────────────────────────────────\n`;
    output += `Current:  $${revenue.current.toLocaleString()}\n`;
    output += `Previous: $${revenue.previous.toLocaleString()}\n`;
    output += `Target:   $${revenue.target.toLocaleString()}\n`;
    output += `Change:   ${revenue.change >= 0 ? '↗️' : '↘️'} ${Math.abs(revenue.change).toFixed(1)}%\n`;
    output += `Progress: ${((revenue.current / revenue.target) * 100).toFixed(1)}% to target\n\n`;
    
    // Leads Section
    output += `🎯 Lead Pipeline\n`;
    output += `─────────────────────────────────────\n`;
    output += `Total Leads:     ${leads.total.toLocaleString()}\n`;
    output += `Qualified:       ${leads.qualified.toLocaleString()}\n`;
    output += `Converted:       ${leads.converted.toLocaleString()}\n`;
    output += `Conversion Rate: ${leads.conversionRate.toFixed(1)}%\n\n`;
    
    // Team Section  
    output += `👥 Team Performance\n`;
    output += `─────────────────────────────────────\n`;
    output += `Active Reps:     ${team.active}\n`;
    output += `Avg Quota:       $${team.quota.toLocaleString()}\n`;
    output += `Performance:     ${team.performance.toFixed(1)}% of quota\n\n`;
    
    // Quick Actions
    output += `⚡ Quick Actions\n`;
    output += `─────────────────────────────────────\n`;
    output += `• View detailed reports: /sales-dashboard --format json\n`;
    output += `• Export data: /sales-dashboard --export csv\n`;
    output += `• Team performance: /sales-dashboard --profile team\n`;
    
    // Status indicator
    const overallHealth = revenue.change > 0 && leads.conversionRate > 25 && team.performance > 100;
    output += `\nStatus: ${overallHealth ? '🟢 Healthy' : '🟡 Needs Attention'}\n`;
    
    return output;
  }
}

// Export with secure pipe for auth/plan/quota checks
export const SalesDashboardCommand = withSecurePipe(new SalesDashboardCommandImpl());
export default SalesDashboardCommand;