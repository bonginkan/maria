/**
 * BaseCommand Template v2.0
 * Standardized command implementation with SSOT metadata and authentication guards
 */

import { authManager, User, AuthenticationRequiredError, QuotaExceededError, PlanRestrictedError, ERROR_MESSAGES } from '../../services/cli-auth';

export interface CommandMeta {
  name: string;
  category: string;
  description: string;
  deps?: string[];
  aliases?: string[];
  status?: 'stable' | 'beta' | 'experimental';
  requiresAuth?: boolean;
  planRestrictions?: string[];
}

export interface CommandResult {
  requiresInput: boolean;
  endReason: 'success' | 'error' | 'partial' | 'timeout' | 'cancel';
  message?: string;
  data?: any;
  mocked?: boolean;
  beta?: boolean;
  error?: string;
  code?: string;
  usage?: {
    requestsLeft: number;
    resetDate: string;
    modelsAvailable: string[];
  };
}

export interface CommandContext {
  args?: string[];
  env?: Record<string, string | undefined>;
  user?: any;
  session?: any;
}

export abstract class BaseCommand {
  abstract readonly meta: CommandMeta;
  
  constructor(protected context: CommandContext = {}) {}
  
  abstract execute(): Promise<CommandResult>;

  /**
   * Enforce authentication requirement
   * Throws AuthenticationRequiredError if not authenticated
   */
  protected async requireAuth(): Promise<User> {
    try {
      return await authManager.requireUser();
    } catch (error) {
      if (error instanceof AuthenticationRequiredError) {
        throw error;
      }
      throw new AuthenticationRequiredError(ERROR_MESSAGES.AUTH_REQUIRED);
    }
  }

  /**
   * Check authentication status without throwing
   */
  protected async checkAuth(): Promise<User | null> {
    try {
      if (await authManager.isAuthenticated()) {
        return await authManager.getCurrentUser();
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check if user has sufficient quota
   */
  protected async checkQuota(): Promise<void> {
    const user = await this.requireAuth();
    const usage = user.usage;
    
    if (usage.requests >= usage.requestLimit) {
      throw new QuotaExceededError(ERROR_MESSAGES.QUOTA_EXCEEDED);
    }
  }

  /**
   * Check if feature is available for user's plan
   */
  protected async checkPlanAccess(feature: string): Promise<void> {
    const user = await this.requireAuth();
    
    // Define feature restrictions for FREE plan
    const restrictedFeatures = ['image', 'video', 'voice', 'advanced-search'];
    
    if (user.plan === 'FREE' && restrictedFeatures.includes(feature)) {
      throw new PlanRestrictedError(ERROR_MESSAGES.PLAN_RESTRICTED);
    }
  }

  /**
   * Execute command with automatic auth/quota checks
   */
  protected async executeWithGuards(executeImpl: (user: User) => Promise<CommandResult>): Promise<CommandResult> {
    try {
      // Skip auth checks for auth commands and help commands
      const skipAuthCommands = ['login', 'help', 'version'];
      if (skipAuthCommands.includes(this.meta.name)) {
        const fakeUser = { email: 'anonymous', plan: 'FREE' } as User;
        return await executeImpl(fakeUser);
      }

      // Check authentication
      const user = await this.requireAuth();
      
      // Check quota for commands that consume requests
      const quotaConsumingCommands = ['code', 'search', 'image', 'video', 'voice'];
      if (quotaConsumingCommands.includes(this.meta.name)) {
        await this.checkQuota();
      }

      // Check plan restrictions
      if (this.meta.planRestrictions) {
        for (const feature of this.meta.planRestrictions) {
          await this.checkPlanAccess(feature);
        }
      }

      // Execute command
      const result = await executeImpl(user);

      // Add usage information to result
      return this.addUsageInfo(result, user);
      
    } catch (error) {
      if (error instanceof AuthenticationRequiredError) {
        return this.error(ERROR_MESSAGES.AUTH_REQUIRED, 'AUTH_REQUIRED');
      }
      if (error instanceof QuotaExceededError) {
        return this.error(ERROR_MESSAGES.QUOTA_EXCEEDED, 'QUOTA_EXCEEDED');
      }
      if (error instanceof PlanRestrictedError) {
        return this.error(ERROR_MESSAGES.PLAN_RESTRICTED, 'PLAN_RESTRICTED');
      }
      throw error;
    }
  }

  /**
   * Add usage information to command result
   */
  private addUsageInfo(result: CommandResult, user: User): CommandResult {
    const usage = user.usage;
    const requestsLeft = usage.requestLimit - usage.requests;

    return {
      ...result,
      usage: {
        requestsLeft,
        resetDate: usage.resetDate,
        modelsAvailable: user.models || []
      }
    };
  }
  
  protected success(message: string, data?: any): CommandResult {
    return {
      requiresInput: false,
      endReason: 'success',
      message,
      data
    };
  }
  
  protected error(message: string, code = 'ERROR', data?: any): CommandResult {
    return {
      requiresInput: false,
      endReason: 'error',
      error: message,
      code,
      data
    };
  }
  
  protected partial(message: string, data?: any): CommandResult {
    return {
      requiresInput: false,
      endReason: 'partial',
      message,
      data
    };
  }
  
  protected timeout(message = 'Command timed out'): CommandResult {
    return {
      requiresInput: false,
      endReason: 'timeout',
      error: message
    };
  }
  
  protected cancel(message = 'Command cancelled'): CommandResult {
    return {
      requiresInput: false,
      endReason: 'cancel',
      message
    };
  }
  
  protected mockedSuccess(message: string, data: any, setupHint = '/setup'): CommandResult {
    return {
      requiresInput: false,
      endReason: 'success',
      message: `⚠️ ${message} (Demo Mode)`,
      data: {
        ...data,
        note: `Enable full features: ${setupHint}`
      },
      mocked: true
    };
  }
  
  protected betaSuccess(message: string, data: any): CommandResult {
    return {
      requiresInput: false,
      endReason: 'partial',
      message: `🚧 ${message} (Beta)`,
      data,
      beta: true
    };
  }
}

/**
 * Helper to validate command metadata
 */
export function isValidCommandMeta(meta: any): meta is CommandMeta {
  return (
    typeof meta === 'object' &&
    typeof meta.name === 'string' &&
    typeof meta.category === 'string' &&
    typeof meta.description === 'string' &&
    /^[a-z0-9-]+$/.test(meta.name) // Enforce naming convention
  );
}

/**
 * Command factory helper
 */
export function createCommand<T extends BaseCommand>(
  CommandClass: new (context: CommandContext) => T,
  context: CommandContext = {}
): T {
  return new CommandClass(context);
}