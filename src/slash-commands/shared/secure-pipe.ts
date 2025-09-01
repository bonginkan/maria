/**
 * Secure command pipe - Composable guards for all commands
 * Ensures consistent auth, plan, quota, and rate limit handling
 */

export interface CommandContext {
  user?: {
    id: string;
    email?: string;
    plan: 'free' | 'starter' | 'pro' | 'ultra';
  };
  auth?: {
    token: string;
    expiresAt: number;
  };
  quota?: {
    remaining: number;
    limit: number;
    resetAt: number;
  };
  rateLimit?: {
    remaining: number;
    limit: number;
    resetIn: number;
  };
  telemetry?: {
    track: (data: any) => Promise<void>;
  };
}

export interface CommandResult {
  success: boolean;
  output?: string;
  error?: string;
  metadata?: any;
  requiresInput: boolean;
  endReason: 'success' | 'error' | 'rate_limited' | 'quota_exceeded' | 'auth_required' | 'plan_required';
}

export interface Command {
  metadata: {
    name: string;
    category: string;
    type?: 'functional' | 'stub';
    planRequired?: 'free' | 'starter' | 'pro' | 'ultra';
    isPreview?: boolean;
  };
  execute(args: string[], context: CommandContext): Promise<CommandResult>;
}

/**
 * Auth guard - ensures user is authenticated
 */
export function withAuth(command: Command): Command {
  return {
    ...command,
    async execute(args: string[], context: CommandContext): Promise<CommandResult> {
      // Check for auth token
      if (!context.auth?.token || !context.user?.id) {
        return {
          success: false,
          error: '🔐 Authentication required',
          output: 'Please login first: /login',
          requiresInput: false,
          endReason: 'auth_required'
        };
      }

      // Check token expiry
      if (context.auth.expiresAt < Date.now()) {
        return {
          success: false,
          error: '🔐 Session expired',
          output: 'Your session has expired. Please login again: /login',
          requiresInput: false,
          endReason: 'auth_required'
        };
      }

      // Continue to next guard
      return command.execute(args, context);
    }
  };
}

/**
 * Plan guard - checks if user has required plan
 */
export function withPlan(command: Command): Command {
  return {
    ...command,
    async execute(args: string[], context: CommandContext): Promise<CommandResult> {
      const requiredPlan = command.metadata.planRequired || 'free';
      const userPlan = context.user?.plan || 'free';

      const planHierarchy = {
        'free': 0,
        'starter': 1,
        'pro': 2,
        'ultra': 3
      };

      if (planHierarchy[userPlan] < planHierarchy[requiredPlan]) {
        return {
          success: false,
          error: `🔒 ${requiredPlan.toUpperCase()} plan required`,
          output: `This command requires ${requiredPlan} plan or higher.
Current plan: ${userPlan}
  
📋 Join waitlist: https://maria-code.ai/waitlist
💳 Upgrade: /upgrade`,
          requiresInput: false,
          endReason: 'plan_required'
        };
      }

      return command.execute(args, context);
    }
  };
}

/**
 * Quota guard - checks and consumes quota
 */
export function withQuota(command: Command): Command {
  return {
    ...command,
    async execute(args: string[], context: CommandContext): Promise<CommandResult> {
      // Skip quota check for certain commands
      const quotaExempt = ['help', 'login', 'logout', 'status', 'doctor', 'usage', 'plan'];
      if (quotaExempt.includes(command.metadata.name)) {
        return command.execute(args, context);
      }

      const quota = context.quota || { remaining: 0, limit: 100, resetAt: Date.now() + 86400000 };
      
      if (quota.remaining <= 0) {
        const resetIn = Math.max(0, quota.resetAt - Date.now());
        const hours = Math.floor(resetIn / 3600000);
        const minutes = Math.floor((resetIn % 3600000) / 60000);
        
        return {
          success: false,
          error: '📊 Quota exceeded',
          output: `Monthly quota exhausted (0/${quota.limit} remaining)
Reset in: ${hours}h ${minutes}m

💡 Check usage: /usage
💳 Upgrade for more: /upgrade`,
          requiresInput: false,
          endReason: 'quota_exceeded'
        };
      }

      // Execute command and add quota footer
      const result = await command.execute(args, context);
      
      if (result.success && !result.output?.includes('Quota:')) {
        const quotaFooter = `\n─────────────────\nQuota: ${quota.remaining - 1}/${quota.limit} remaining`;
        result.output = (result.output || '') + quotaFooter;
      }

      return result;
    }
  };
}

/**
 * Rate limit guard - respects rate limiting
 */
export function withRateLimit(command: Command): Command {
  return {
    ...command,
    async execute(args: string[], context: CommandContext): Promise<CommandResult> {
      const rateLimit = context.rateLimit || { 
        remaining: 10, 
        limit: 10, 
        resetIn: 3 
      };

      if (rateLimit.remaining <= 0) {
        // Ensure resetIn is a finite positive number
        const waitSeconds = Math.max(1, Math.min(60, rateLimit.resetIn || 3));
        
        return {
          success: false,
          error: '⏱ Rate limited',
          output: `Rate limit exceeded. Wait ${waitSeconds}s

💡 Tip: Space out requests
💳 Upgrade for higher limits: /upgrade`,
          requiresInput: false,
          endReason: 'rate_limited'
        };
      }

      return command.execute(args, context);
    }
  };
}

/**
 * Preview wrapper - adds preview footer to stub commands
 */
export function withPreviewFooter(command: Command): Command {
  if (command.metadata.type !== 'stub' && !command.metadata.isPreview) {
    return command;
  }

  return {
    ...command,
    async execute(args: string[], context: CommandContext): Promise<CommandResult> {
      const result = await command.execute(args, context);
      
      if (result.success) {
        const previewFooter = `\n─────────────────\n🧪 Preview Feature • Coming soon in Pro
📋 Join waitlist: https://maria-code.ai/waitlist
💡 Current plan: ${context.user?.plan || 'free'} • Upgrade: /upgrade`;
        
        result.output = (result.output || '') + previewFooter;
      }

      return result;
    }
  };
}

/**
 * Telemetry wrapper - tracks all command executions
 */
export function withTelemetry(command: Command): Command {
  return {
    ...command,
    async execute(args: string[], context: CommandContext): Promise<CommandResult> {
      const startTime = Date.now();
      const result = await command.execute(args, context);
      
      if (context.telemetry) {
        await context.telemetry.track({
          command: command.metadata.name,
          category: command.metadata.category,
          type: command.metadata.type || 'unknown',
          status: result.endReason || (result.success ? 'success' : 'error'),
          latencyMs: Date.now() - startTime,
          plan: context.user?.plan || 'free',
          quotaRemaining: context.quota?.remaining || 0,
          timestamp: new Date().toISOString(),
          buildId: process.env.BUILD_ID || 'dev',
          cliVersion: process.env.CLI_VERSION || '3.8.0',
          error: result.error
        });
      }

      return result;
    }
  };
}

/**
 * Main secure pipe - composes all guards in order
 */
export function withSecurePipe(command: Command): Command {
  // Order matters: telemetry wraps everything, then auth, plan, quota, rate limit
  return withTelemetry(
    withRateLimit(
      withQuota(
        withPlan(
          withAuth(
            withPreviewFooter(command)
          )
        )
      )
    )
  );
}

/**
 * Light pipe for read-only commands (no quota/rate limit)
 */
export function withLightPipe(command: Command): Command {
  return withTelemetry(
    withAuth(
      withPreviewFooter(command)
    )
  );
}

/**
 * Public pipe for unauthenticated commands
 */
export function withPublicPipe(command: Command): Command {
  return withTelemetry(
    withRateLimit(
      withPreviewFooter(command)
    )
  );
}