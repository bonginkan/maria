/**
 * Command Middleware Integration
 * Applies rate limiting and usage tracking to commands
 */

import { CommandContext, CommandResult } from '../types/command.types';
import { planRateLimiters, RateLimitError } from './rate-limiter';
import { usageTracker, usageTelemetry } from '../services/usage-tracker/usage-tracker';
import { FreeModelSelector } from '../services/model-selector/free-model-selector';
import chalk from 'chalk';

export interface MiddlewareContext extends CommandContext {
  planId?: string;
  skipRateLimit?: boolean;
  skipUsageTracking?: boolean;
}

/**
 * Apply usage middleware to command execution
 */
export async function applyUsageMiddleware(
  commandName: string,
  context: MiddlewareContext,
  execute: () => Promise<CommandResult>
): Promise<CommandResult> {
  return applyFreeMiddleware(commandName, context, execute);
}

/**
 * Apply FREE plan middleware to command execution
 */
export async function applyFreeMiddleware(
  commandName: string,
  context: MiddlewareContext,
  execute: () => Promise<CommandResult>
): Promise<CommandResult> {
  const userId = context.userId || 'anonymous';
  const planId = context.planId || 'free';
  const startTime = Date.now();
  
  // Track command start
  usageTelemetry.trackCommand(userId, commandName, true, {
    planId,
    startTime
  });
  
  try {
    // 1. Apply rate limiting (unless skipped)
    if (!context.skipRateLimit) {
      try {
        await planRateLimiters.applyLimit(context, planId, async () => {
          // Rate limit check passed
          return true;
        });
      } catch (error) {
        if (error instanceof RateLimitError) {
          // Track rate limit hit
          usageTelemetry.trackRateLimit(userId, planId, error.retryAfter);
          
          // Return formatted error
          return {
            success: false,
            message: formatRateLimitError(error, planId),
            error: error.message
          };
        }
        throw error;
      }
    }
    
    // 2. Check usage limits based on command type
    const usageType = getUsageType(commandName);
    const usageAmount = getUsageAmount(commandName, context);
    
    if (usageType) {
      const usageCheck = await usageTracker.checkUsage(
        userId,
        usageType,
        usageAmount,
        planId
      );
      
      if (!usageCheck.allowed) {
        // Track quota exceeded
        usageTelemetry.trackQuotaExceeded(
          userId,
          usageType,
          usageCheck.current,
          usageCheck.limit
        );
        
        // Return formatted error
        return {
          success: false,
          message: formatQuotaError(usageCheck, usageType, planId),
          error: 'Quota exceeded'
        };
      }
    }
    
    // 3. Execute the actual command
    const result = await execute();
    
    // 4. Track successful execution and consume resources
    if (result.success && !context.skipUsageTracking) {
      if (usageType) {
        await usageTracker.consume({
          userId,
          type: usageType,
          amount: usageAmount,
          metadata: {
            command: commandName,
            model: getModelUsed(context)
          }
        });
      }
      
      // Track success
      const latency = Date.now() - startTime;
      usageTelemetry.trackCommand(userId, commandName, true, {
        planId,
        latency
      });
      
      // Track model usage if applicable
      const model = getModelUsed(context);
      if (model) {
        usageTelemetry.trackModelUsage(
          userId,
          model,
          getModelType(commandName),
          undefined,
          latency
        );
      }
    }
    
    return result;
    
  } catch (error: any) {
    // Track error
    usageTelemetry.trackError(userId, error.message, {
      command: commandName,
      planId
    });
    
    // Track failed command
    usageTelemetry.trackCommand(userId, commandName, false, {
      planId,
      error: error.message
    });
    
    throw error;
  }
}

/**
 * Get usage type for command
 */
function getUsageType(commandName: string): keyof any | null {
  const usageMap: Record<string, keyof any> = {
    'code': 'code',
    'image': 'image',
    'video': 'video',
    'chat': 'req',
    'ask': 'req',
    'search': 'req',
    'explain': 'req',
    'translate': 'req',
    'summarize': 'req'
  };
  
  return usageMap[commandName] || null;
}

/**
 * Get usage amount for command
 */
function getUsageAmount(commandName: string, context: any): number {
  // Check for long context multiplier for text commands
  if (commandName === 'code' || commandName === 'chat' || commandName === 'ask') {
    const tokenCount = estimateTokens(context);
    if (tokenCount > 8000) {
      return 2; // Double consumption for long context
    }
  }
  
  return 1;
}

/**
 * Estimate token count from context
 */
function estimateTokens(context: any): number {
  // Rough estimation: 4 characters = 1 token
  const text = JSON.stringify(context.args || []).length;
  return Math.ceil(text / 4);
}

/**
 * Get model used from context
 */
function getModelUsed(context: any): string | undefined {
  // Try to extract model from context or options
  return context.options?.model || 
         context.model || 
         getDefaultModel(context.command);
}

/**
 * Get default model for command
 */
function getDefaultModel(commandName: string): string {
  const modelSelector = new FreeModelSelector('free');
  
  switch (commandName) {
    case 'code':
    case 'chat':
    case 'ask':
      return modelSelector.getModelDisplayName('google:gemini-2.5-flash');
    case 'image':
      return modelSelector.getModelDisplayName('google:imagen-4-fast');
    case 'video':
      return modelSelector.getModelDisplayName('google:veo-3-fast');
    default:
      return 'unknown';
  }
}

/**
 * Get model type for command
 */
function getModelType(commandName: string): 'text' | 'image' | 'video' {
  switch (commandName) {
    case 'image':
      return 'image';
    case 'video':
      return 'video';
    default:
      return 'text';
  }
}

/**
 * Format rate limit error message
 */
function formatRateLimitError(error: RateLimitError, planId: string): string {
  const waitTime = error.retryAfter;
  const resetTime = new Date(error.resetTime).toLocaleTimeString();
  
  return chalk.red(`
⏱️  Rate Limit Exceeded

${chalk.yellow(error.message)}

${chalk.gray(`Please wait ${chalk.white(waitTime)} second${waitTime !== 1 ? 's' : ''} before trying again.`)}
${chalk.gray(`Limit resets at: ${chalk.white(resetTime)}`)}

${planId === 'free' ? chalk.cyan('💡 Tip: Upgrade to Pro for 5x faster access: /upgrade') : ''}
`);
}

/**
 * Format quota error message
 */
function formatQuotaError(usage: any, type: string, planId: string): string {
  const typeNames: Record<string, string> = {
    code: 'code generations',
    image: 'images',
    video: 'videos',
    req: 'requests',
    tokens: 'tokens'
  };
  
  const typeName = typeNames[type] || type;
  const resetDate = usage.periodEnd.toLocaleDateString();
  
  return chalk.red(`
📊  Monthly Quota Exceeded

You've used all your ${chalk.yellow(typeName)} for this month.

${chalk.gray('Usage:')} ${chalk.white(usage.current)} / ${chalk.white(usage.limit)}
${chalk.gray('Resets on:')} ${chalk.white(resetDate)}

${planId === 'free' ? chalk.cyan(`💡 Upgrade to Pro for more ${typeName}: /upgrade`) : ''}
${chalk.gray('Check your usage: /usage')}
`);
}

/**
 * Display usage summary command
 */
export async function displayUsageSummary(userId: string, planId: string = 'free'): Promise<string> {
  const summary = await usageTracker.getUsageSummary(userId, planId);
  
  let output = chalk.cyan('📊 Usage Summary\n\n');
  output += chalk.gray(`Period: ${summary.period}\n`);
  output += chalk.gray(`Last Updated: ${summary.lastUpdated.toLocaleString()}\n\n`);
  
  // Display buckets with progress bars
  output += chalk.white('Resource Usage:\n');
  
  for (const [key, data] of Object.entries(summary.buckets)) {
    const percentage = data.percentage;
    const barLength = 20;
    const filled = Math.round((percentage / 100) * barLength);
    const empty = barLength - filled;
    
    const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    
    const keyNames: Record<string, string> = {
      code: 'Code',
      image: 'Images',
      video: 'Videos',
      req: 'Requests',
      tokens: 'Tokens',
      attachment: 'Attachments'
    };
    
    const name = keyNames[key] || key;
    
    output += `  ${name.padEnd(12)} ${bar} ${data.used}/${data.limit} (${percentage}%)\n`;
  }
  
  // Display top models
  if (summary.topModels.length > 0) {
    output += chalk.white('\nTop Models:\n');
    summary.topModels.forEach((item: any, index: number) => {
      output += chalk.gray(`  ${index + 1}. ${item.model}: ${item.count} uses\n`);
    });
  }
  
  // Display top commands
  if (summary.topCommands.length > 0) {
    output += chalk.white('\nTop Commands:\n');
    summary.topCommands.forEach((item: any, index: number) => {
      output += chalk.gray(`  ${index + 1}. /${item.command}: ${item.count} uses\n`);
    });
  }
  
  // Display errors if any
  if (summary.errors.length > 0) {
    output += chalk.red('\nErrors:\n');
    summary.errors.forEach((item: any) => {
      output += chalk.gray(`  • ${item.error}: ${item.count} times\n`);
    });
  }
  
  return output;
}

/**
 * Generate telemetry report
 */
export function generateTelemetryReport(windowMs?: number): string {
  const metrics = usageTelemetry.generateMetrics(windowMs);
  
  let output = chalk.cyan('📈 Telemetry Report\n\n');
  
  output += chalk.white('Overview:\n');
  output += chalk.gray(`  Total Events: ${metrics.totalEvents}\n`);
  output += chalk.gray(`  Unique Users: ${metrics.uniqueUsers}\n`);
  output += chalk.gray(`  Success Rate: ${Math.round((metrics.commandSuccess / (metrics.commandSuccess + metrics.commandFailure)) * 100)}%\n`);
  output += chalk.gray(`  Avg Latency: ${metrics.avgLatency}ms\n`);
  
  if (metrics.rateLimits > 0) {
    output += chalk.yellow(`  Rate Limits Hit: ${metrics.rateLimits}\n`);
  }
  
  if (metrics.quotaExceeded > 0) {
    output += chalk.red(`  Quota Exceeded: ${metrics.quotaExceeded}\n`);
  }
  
  // Model usage
  if (Object.keys(metrics.modelUsage).length > 0) {
    output += chalk.white('\nModel Usage:\n');
    for (const [model, count] of Object.entries(metrics.modelUsage)) {
      output += chalk.gray(`  ${model}: ${count}\n`);
    }
  }
  
  // Top commands
  if (Object.keys(metrics.topCommands).length > 0) {
    output += chalk.white('\nTop Commands:\n');
    const sorted = Object.entries(metrics.topCommands)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    for (const [command, count] of sorted) {
      output += chalk.gray(`  /${command}: ${count}\n`);
    }
  }
  
  return output;
}