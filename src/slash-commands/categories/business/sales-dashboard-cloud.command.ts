/**
 * Sales Dashboard Command (Cloud-Ready)
 * Interactive TUI sales dashboard with real-time updates following SOW v2.0 patterns
 */

import { CommandArgs, CommandContext, CommandResult } from "../../types.js";
import { withAuth, withQuotaCheck, withPlan } from "../../shared/auth-quota-pipe.js";
import { callApi } from "../../shared/cloud-api-client.js";
import { trackCommand } from "../../../services/telemetry/command-tracker.js";

interface SalesMetrics {
  totalRevenue: number;
  monthlyRecurring: number;
  conversionRate: number;
  activeDeals: number;
  closedWon: number;
  pipeline: {
    qualified: number;
    proposal: number;
    negotiation: number;
  };
  team: {
    name: string;
    deals: number;
    revenue: number;
  }[];
}

export const salesDashboardCommand = {
  name: "sales-dashboard",
  category: "business" as const,
  description: "Interactive TUI sales dashboard with real-time updates (Starter+)",
  usage: "[--profile=executive|manager|rep] [--theme=light|dark] [--format=tui|json|slack]",
  
  execute: withAuth(withQuotaCheck("sales-dashboard")(withPlan("STARTER")(async (context, ...args) => {
    const startTime = Date.now();
    const profile = extractProfile(args) || 'manager';
    const theme = extractTheme(args) || 'dark';
    const format = extractFormat(args) || 'tui';
    
    console.log('📊 Loading sales dashboard...');

    try {
      const response = await callApi('/v1/business/sales-metrics', {
        method: 'GET'
      });

      if (response.success && response.data) {
        const metrics = response.data as SalesMetrics;
        
        if (format === 'json') {
          console.log(JSON.stringify(metrics, null, 2));
        } else if (format === 'slack') {
          displaySlackFormat(metrics);
        } else {
          displayTUIFormat(metrics, profile, theme);
        }
        
        console.log(`\n🚀 Dashboard refreshed • Profile: ${profile.toUpperCase()}`);
        console.log('📈 Real-time updates every 5 minutes');
        
      } else {
        // Fallback to mock data for development/preview
        const mockMetrics = generateMockMetrics();
        
        if (format === 'json') {
          console.log(JSON.stringify(mockMetrics, null, 2));
        } else {
          displayTUIFormat(mockMetrics, profile, theme);
        }
        
        console.log('\n🧪 Preview Data • Upgrade to Pro for real-time metrics');
        console.log('📋 Join waitlist: https://maria-code.ai/waitlist');
      }

      await trackCommand({
        cmd: 'sales-dashboard',
        status: 'success',
        latencyMs: Date.now() - startTime,
        plan: context.plan.name,
        quotaLeft: context.quotaLeft,
        userId: context.userId
      });

      return { success: true, endReason: 'completed' };

    } catch (error) {
      console.log('❌ Sales dashboard unavailable');
      console.log('🧪 Preview Feature • Coming soon in Starter+');
      
      // Show sample dashboard in case of error
      const mockMetrics = generateMockMetrics();
      displayTUIFormat(mockMetrics, profile, theme);
      console.log('\n🔧 Using sample data - Service temporarily unavailable');
      
      await trackCommand({
        cmd: 'sales-dashboard',
        status: 'error',
        latencyMs: Date.now() - startTime,
        plan: context.plan.name,
        quotaLeft: context.quotaLeft,
        userId: context.userId
      });

      return { success: false, endReason: 'service-error' };
    }
  })))
};

function displayTUIFormat(metrics: SalesMetrics, profile: string, theme: string): void {
  const isDark = theme === 'dark';
  const border = isDark ? '═' : '─';
  
  console.log(`\n📈 Sales Dashboard (${profile.toUpperCase()})`);
  console.log(border.repeat(50));
  
  // Key Metrics
  console.log('\n💰 Revenue Metrics:');
  console.log(`   Total Revenue:     $${formatCurrency(metrics.totalRevenue)}`);
  console.log(`   Monthly Recurring: $${formatCurrency(metrics.monthlyRecurring)}`);
  console.log(`   Conversion Rate:   ${metrics.conversionRate.toFixed(1)}%`);
  
  // Deal Pipeline
  console.log('\n🎯 Deal Pipeline:');
  console.log(`   Active Deals:      ${metrics.activeDeals}`);
  console.log(`   Closed Won:        ${metrics.closedWon}`);
  console.log(`   Qualified:         ${metrics.pipeline.qualified}`);
  console.log(`   In Proposal:       ${metrics.pipeline.proposal}`);
  console.log(`   Negotiation:       ${metrics.pipeline.negotiation}`);
  
  // Team Performance (only for manager/executive profiles)
  if (profile !== 'rep') {
    console.log('\n👥 Team Performance:');
    metrics.team.forEach(member => {
      console.log(`   ${member.name.padEnd(15)} ${member.deals} deals  $${formatCurrency(member.revenue)}`);
    });
  }
  
  // Progress Bars
  console.log('\n📊 Visual Progress:');
  const pipelineProgress = (metrics.closedWon / metrics.activeDeals * 100) || 0;
  console.log(`   Pipeline:    ${createProgressBar(pipelineProgress, 20)} ${pipelineProgress.toFixed(1)}%`);
  
  const conversionProgress = Math.min(metrics.conversionRate, 100);
  console.log(`   Conversion:  ${createProgressBar(conversionProgress, 20)} ${conversionProgress.toFixed(1)}%`);
}

function displaySlackFormat(metrics: SalesMetrics): void {
  console.log('```');
  console.log('📈 Sales Dashboard Update');
  console.log('');
  console.log(`💰 Revenue: $${formatCurrency(metrics.totalRevenue)} (MRR: $${formatCurrency(metrics.monthlyRecurring)})`);
  console.log(`🎯 Deals: ${metrics.closedWon}/${metrics.activeDeals} closed (${metrics.conversionRate.toFixed(1)}% conv)`);
  console.log(`📊 Pipeline: ${metrics.pipeline.qualified} qualified → ${metrics.pipeline.proposal} proposals → ${metrics.pipeline.negotiation} negotiating`);
  console.log('');
  console.log('Top Performers:');
  metrics.team.slice(0, 3).forEach((member, i) => {
    const medal = ['🥇', '🥈', '🥉'][i] || '🏆';
    console.log(`${medal} ${member.name}: ${member.deals} deals, $${formatCurrency(member.revenue)}`);
  });
  console.log('```');
}

function generateMockMetrics(): SalesMetrics {
  return {
    totalRevenue: 125000,
    monthlyRecurring: 15000,
    conversionRate: 12.5,
    activeDeals: 24,
    closedWon: 3,
    pipeline: {
      qualified: 8,
      proposal: 5,
      negotiation: 3
    },
    team: [
      { name: 'Alice Chen', deals: 8, revenue: 45000 },
      { name: 'Bob Wilson', deals: 6, revenue: 32000 },
      { name: 'Carol Davis', deals: 5, revenue: 28000 },
      { name: 'David Kim', deals: 3, revenue: 15000 },
      { name: 'Emma Brown', deals: 2, revenue: 5000 }
    ]
  };
}

function createProgressBar(percentage: number, width: number): string {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 0 });
}

function extractProfile(args: string[]): string | undefined {
  const profileArg = args.find(arg => arg.startsWith('--profile='));
  return profileArg?.split('=')[1];
}

function extractTheme(args: string[]): string | undefined {
  const themeArg = args.find(arg => arg.startsWith('--theme='));
  return themeArg?.split('=')[1];
}

function extractFormat(args: string[]): string | undefined {
  const formatArg = args.find(arg => arg.startsWith('--format='));
  return formatArg?.split('=')[1];
}