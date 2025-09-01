/**
 * Plan Manager Service
 * Clean stub implementation with realistic behavior
 * Replaces missing plan-manager.js dependency
 */

export interface UserPlan {
  id: string;
  name: 'FREE' | 'PRO' | 'ULTRA';
  limits: {
    requests: number;
    imageGeneration: number;
    videoGeneration: number;
    codeGeneration: number;
    memoryStorage: number;
  };
  features: string[];
  price: number;
}

export interface UsageData {
  used: number;
  limit: number;
  resetDate: string;
  percentage: number;
}

// Default plan configurations
const PLAN_CONFIGS: Record<string, UserPlan> = {
  FREE: {
    id: 'free',
    name: 'FREE',
    limits: {
      requests: 100,
      imageGeneration: 25,
      videoGeneration: 5,
      codeGeneration: 50,
      memoryStorage: 1000
    },
    features: [
      'Basic AI commands',
      'Image generation',
      'Code generation',
      'Memory system'
    ],
    price: 0
  },
  PRO: {
    id: 'pro', 
    name: 'PRO',
    limits: {
      requests: 1000,
      imageGeneration: 200,
      videoGeneration: 50,
      codeGeneration: 500,
      memoryStorage: 10000
    },
    features: [
      'All FREE features',
      'Priority processing',
      'Advanced AI models',
      'Business commands',
      'Batch operations'
    ],
    price: 20
  },
  ULTRA: {
    id: 'ultra',
    name: 'ULTRA',
    limits: {
      requests: 5000,
      imageGeneration: 1000,
      videoGeneration: 200,
      codeGeneration: 2000,
      memoryStorage: 50000
    },
    features: [
      'All PRO features',
      'Unlimited processing',
      'Custom integrations',
      'Priority support',
      'Enterprise features'
    ],
    price: 50
  }
};

/**
 * Get user's current plan
 * In production, this would query Firestore/database
 */
export async function getUserPlan(userId?: string): Promise<UserPlan> {
  if (process.env.NODE_ENV === 'development' && userId) {
    console.debug(`🔧 [plan-manager] Getting plan for user ${userId.slice(0, 8)}...`);
  }
  
  // Mock implementation - would query real data in production
  // For now, return FREE plan with realistic behavior
  return PLAN_CONFIGS.FREE;
}

/**
 * Check quota for a specific command/user
 */
export async function checkQuota(userId: string, command: string): Promise<{
  quotaLeft: number;
  plan: UserPlan;
  resetAt: string;
}> {
  const plan = await getUserPlan(userId);
  
  // Mock usage calculation (in production, would query usage data)
  const baseUsage = Math.floor(Math.random() * 30); // Simulate some usage
  const quotaLeft = Math.max(0, plan.limits.requests - baseUsage);
  
  // Next reset is tomorrow at midnight UTC
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  
  if (process.env.NODE_ENV === 'development') {
    console.debug(
      `🔧 [plan-manager] Quota check: ${command} ` +
      `(${quotaLeft}/${plan.limits.requests} remaining)`
    );
  }
  
  return {
    quotaLeft,
    plan,
    resetAt: tomorrow.toISOString()
  };
}

/**
 * Get detailed usage data for a user
 */
export async function getUserUsage(userId: string): Promise<UsageData> {
  const plan = await getUserPlan(userId);
  
  // Mock current usage
  const used = Math.floor(Math.random() * plan.limits.requests * 0.6);
  
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  
  return {
    used,
    limit: plan.limits.requests,
    resetDate: tomorrow.toISOString(),
    percentage: Math.round((used / plan.limits.requests) * 100)
  };
}

/**
 * Decrement quota (server-side to prevent double counting)
 */
export async function decrementQuota(userId: string, command: string): Promise<void> {
  if (process.env.NODE_ENV === 'development') {
    console.debug(`🔧 [plan-manager] Decremented ${command} quota for user ${userId.slice(0, 8)}...`);
  }
  
  // In production, this would update the database
  // For now, just log the decrement
}

/**
 * Check if user can upgrade to a specific plan
 */
export async function canUpgradeToPlan(userId: string, targetPlan: string): Promise<boolean> {
  const currentPlan = await getUserPlan(userId);
  const plans = ['FREE', 'PRO', 'ULTRA'];
  
  const currentIndex = plans.indexOf(currentPlan.name);
  const targetIndex = plans.indexOf(targetPlan.toUpperCase());
  
  return targetIndex > currentIndex;
}

/**
 * Get all available plans for comparison
 */
export function getAllPlans(): UserPlan[] {
  return Object.values(PLAN_CONFIGS);
}

export { PLAN_CONFIGS };