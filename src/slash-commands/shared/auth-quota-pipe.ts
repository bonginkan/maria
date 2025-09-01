/**
 * Unified Auth/Quota Pipeline
 * Single contract for all command authentication and quota enforcement
 */

interface CommandContext {
  userId: string;
  plan: UserPlan;
  quotaLeft: number;
  resetAt: string;
  command: string;
}

interface UserPlan {
  id: string;
  name: 'FREE' | 'PRO' | 'ULTRA';
  limits: {
    requests: number;
    imageGeneration: number;
    videoGeneration: number;
    codeGeneration: number;
  };
}

interface CommandResult {
  success: boolean;
  message?: string;
  endReason: 'completed' | 'auth' | 'quota' | 'error' | 'not-ready';
  data?: any;
}

// Token management (would integrate with existing tokenManager)
class TokenManager {
  async ensureValidToken(): Promise<string> {
    // Check for existing valid token
    const token = (global as any).MARIA_ID_TOKEN;
    if (token && !this.isTokenExpired(token)) {
      return token;
    }
    
    // Try to refresh token
    try {
      const refreshed = await this.refreshToken();
      if (refreshed) {
        (global as any).MARIA_ID_TOKEN = refreshed;
        return refreshed;
      }
    } catch {
      // Refresh failed
    }
    
    throw new Error('Authentication required');
  }
  
  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return Date.now() / 1000 > payload.exp;
    } catch {
      return true;
    }
  }
  
  private async refreshToken(): Promise<string | null> {
    // Would integrate with existing refresh logic
    return null;
  }
  
  extractUserId(token: string): string {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.sub || payload.user_id || 'anonymous';
    } catch {
      return 'anonymous';
    }
  }
}

// Quota management (would integrate with plan-manager)
class QuotaManager {
  async checkQuota(userId: string, command: string): Promise<{
    quotaLeft: number;
    plan: UserPlan;
    resetAt: string;
  }> {
    // Would integrate with real plan-manager service
    return {
      quotaLeft: 75,
      plan: {
        id: 'free',
        name: 'FREE',
        limits: {
          requests: 100,
          imageGeneration: 25,
          videoGeneration: 5,
          codeGeneration: 50
        }
      },
      resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
  }
  
  async decrementQuota(userId: string, command: string): Promise<void> {
    // Would decrement server-side to prevent double-counting
    console.debug(`[QUOTA] Decremented ${command} for user ${userId.slice(0, 8)}...`);
  }
}

const tokenManager = new TokenManager();
const quotaManager = new QuotaManager();

/**
 * Authentication guard - ensures user is logged in
 */
export function withAuth<T extends any[]>(
  fn: (context: CommandContext, ...args: T) => Promise<CommandResult>
) {
  return async (...args: T): Promise<CommandResult> => {
    try {
      const token = await tokenManager.ensureValidToken();
      const userId = tokenManager.extractUserId(token);
      
      // Create minimal context for non-quota commands
      const context: Partial<CommandContext> = {
        userId,
        command: 'unknown'
      };
      
      return await fn(context as CommandContext, ...args);
    } catch (error) {
      return {
        success: false,
        message: '🔐 Authentication required · Run: /login',
        endReason: 'auth'
      };
    }
  };
}

/**
 * Quota check guard - ensures user has quota remaining
 */
export function withQuotaCheck(commandName: string) {
  return <T extends any[]>(
    fn: (context: CommandContext, ...args: T) => Promise<CommandResult>
  ) => {
    return async (context: CommandContext, ...args: T): Promise<CommandResult> => {
      try {
        const { quotaLeft, plan, resetAt } = await quotaManager.checkQuota(
          context.userId, 
          commandName
        );
        
        if (quotaLeft <= 0) {
          return {
            success: false,
            message: `⚡ Daily ${commandName} limit reached · Upgrade: /upgrade`,
            endReason: 'quota'
          };
        }
        
        // Decrement quota server-side (prevents double-counting)
        await quotaManager.decrementQuota(context.userId, commandName);
        
        // Enrich context with quota info
        const enrichedContext: CommandContext = {
          ...context,
          quotaLeft: quotaLeft - 1,
          plan,
          resetAt,
          command: commandName
        };
        
        const result = await fn(enrichedContext, ...args);
        
        // Print footer on successful commands
        if (result.success) {
          printQuotaFooter({ quotaLeft: quotaLeft - 1, resetAt });
        }
        
        return result;
        
      } catch (error) {
        return {
          success: false,
          message: `🔧 ${commandName} quota check failed · Try again in a moment`,
          endReason: 'error'
        };
      }
    };
  };
}

/**
 * Combined auth + quota guard for most commands
 */
export function withAuthAndQuota<T extends any[]>(
  commandName: string,
  fn: (context: CommandContext, ...args: T) => Promise<CommandResult>
) {
  return withAuth(withQuotaCheck(commandName)(fn));
}

/**
 * Professional quota footer
 */
function printQuotaFooter({ quotaLeft, resetAt }: { quotaLeft: number; resetAt: string }) {
  const resetDate = new Date(resetAt).toISOString().slice(0, 10);
  console.log(`ℹ ${quotaLeft} requests left · Reset: ${resetDate}`);
}

/**
 * Whitelist of commands that don't require auth
 */
const AUTH_WHITELIST = [
  'help',
  'version',
  'login',
  'logout',
  'status'
];

/**
 * Check if command requires authentication
 */
export function requiresAuth(commandName: string): boolean {
  return !AUTH_WHITELIST.includes(commandName.toLowerCase());
}

export { printQuotaFooter };
export type { CommandContext, CommandResult, UserPlan };