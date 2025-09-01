/**
 * Feature Gate Service
 * Controls access to premium features based on subscription plan
 */

import { getUserPlan, Plan } from './subscription-manager.js';
import { renderUpgradePrompt } from '../../ui/components/plan-aware-ui.js';

export interface FeatureConfig {
  id: string;
  name: string;
  requiredPlan: Plan;
  fallbackBehavior?: 'block' | 'sample' | 'limit';
  sampleData?: any;
  limitConfig?: {
    freeLimit: number;
    proLimit?: number;
  };
}

// Feature registry with plan requirements
export const FEATURES: Record<string, FeatureConfig> = {
  // Code features
  'code.advanced': {
    id: 'code.advanced',
    name: 'Advanced Code Generation',
    requiredPlan: 'PRO',
    fallbackBehavior: 'sample'
  },
  'code.refactor': {
    id: 'code.refactor',
    name: 'AI Refactoring',
    requiredPlan: 'PRO',
    fallbackBehavior: 'block'
  },
  'code.review': {
    id: 'code.review',
    name: 'AI Code Review',
    requiredPlan: 'PRO',
    fallbackBehavior: 'sample'
  },
  'code.test': {
    id: 'code.test',
    name: 'AI Test Generation',
    requiredPlan: 'PRO',
    fallbackBehavior: 'sample'
  },
  
  // Image features
  'image.hd': {
    id: 'image.hd',
    name: 'HD Image Generation',
    requiredPlan: 'PRO',
    fallbackBehavior: 'block'
  },
  'image.batch': {
    id: 'image.batch',
    name: 'Batch Image Processing',
    requiredPlan: 'ULTRA',
    fallbackBehavior: 'block'
  },
  
  // Video features
  'video.generate': {
    id: 'video.generate',
    name: 'Video Generation',
    requiredPlan: 'PRO',
    fallbackBehavior: 'sample'
  },
  'video.edit': {
    id: 'video.edit',
    name: 'AI Video Editing',
    requiredPlan: 'ULTRA',
    fallbackBehavior: 'block'
  },
  
  // Model features
  'model.custom': {
    id: 'model.custom',
    name: 'Custom AI Models',
    requiredPlan: 'ULTRA',
    fallbackBehavior: 'block'
  },
  'model.finetune': {
    id: 'model.finetune',
    name: 'Model Fine-tuning',
    requiredPlan: 'ULTRA',
    fallbackBehavior: 'block'
  },
  
  // API features
  'api.access': {
    id: 'api.access',
    name: 'API Access',
    requiredPlan: 'ULTRA',
    fallbackBehavior: 'block'
  },
  'api.webhooks': {
    id: 'api.webhooks',
    name: 'Webhooks',
    requiredPlan: 'PRO',
    fallbackBehavior: 'block'
  },
  
  // Collaboration features
  'team.share': {
    id: 'team.share',
    name: 'Team Sharing',
    requiredPlan: 'PRO',
    fallbackBehavior: 'block'
  },
  'team.realtime': {
    id: 'team.realtime',
    name: 'Real-time Collaboration',
    requiredPlan: 'ULTRA',
    fallbackBehavior: 'block'
  },
  
  // Analytics features
  'analytics.basic': {
    id: 'analytics.basic',
    name: 'Basic Analytics',
    requiredPlan: 'PRO',
    fallbackBehavior: 'sample'
  },
  'analytics.advanced': {
    id: 'analytics.advanced',
    name: 'Advanced Analytics',
    requiredPlan: 'ULTRA',
    fallbackBehavior: 'block'
  }
};

/**
 * Check if a feature is available for the current user
 */
export function isFeatureAvailable(
  featureId: string,
  userPlan: Plan = getUserPlan()
): boolean {
  const feature = FEATURES[featureId];
  if (!feature) {
    console.warn(`Unknown feature: ${featureId}`);
    return true; // Allow unknown features by default
  }
  
  return isPlanSufficient(userPlan, feature.requiredPlan);
}

/**
 * Gate a feature and handle fallback behavior
 */
export async function gateFeature<T>(
  featureId: string,
  callback: () => Promise<T>,
  options?: {
    userPlan?: Plan;
    silent?: boolean;
  }
): Promise<T | null> {
  const userPlan = options?.userPlan || getUserPlan();
  const feature = FEATURES[featureId];
  
  if (!feature) {
    // Unknown feature, allow by default
    return callback();
  }
  
  if (isFeatureAvailable(featureId, userPlan)) {
    // Feature available, execute callback
    return callback();
  }
  
  // Feature not available, handle fallback
  if (!options?.silent) {
    console.log(renderUpgradePrompt(feature.name, feature.requiredPlan, userPlan));
  }
  
  switch (feature.fallbackBehavior) {
    case 'sample':
      return getSampleData(featureId) as T;
    case 'limit':
      return handleLimitedAccess(featureId, callback, userPlan);
    case 'block':
    default:
      return null;
  }
}

/**
 * Check if plan is sufficient for feature
 */
function isPlanSufficient(userPlan: Plan, requiredPlan: Plan): boolean {
  const planHierarchy: Record<Plan, number> = {
    FREE: 0,
    PRO: 1,
    ULTRA: 2
  };
  
  return planHierarchy[userPlan] >= planHierarchy[requiredPlan];
}

/**
 * Get sample data for demo purposes
 */
function getSampleData(featureId: string): any {
  const sampleData: Record<string, any> = {
    'code.advanced': {
      code: '// Advanced code generation is available in PRO plan\n// This is a sample output\nfunction example() {\n  return "Upgrade to PRO for full functionality";\n}',
      message: 'Sample code shown. Upgrade to PRO for advanced generation.'
    },
    'code.review': {
      review: {
        score: 85,
        issues: [
          { type: 'info', message: 'Sample review - PRO feature' }
        ],
        suggestions: ['Upgrade to PRO for full code review']
      }
    },
    'code.test': {
      tests: '// Sample test - PRO feature\ntest("example", () => {\n  expect(true).toBe(true);\n});',
      message: 'Sample test shown. Upgrade to PRO for AI test generation.'
    },
    'video.generate': {
      url: 'https://example.com/sample-video.mp4',
      message: 'Sample video. Upgrade to PRO for custom video generation.'
    },
    'analytics.basic': {
      stats: {
        totalCommands: 42,
        successRate: 0.95,
        message: 'Sample analytics. Upgrade to PRO for detailed insights.'
      }
    }
  };
  
  return sampleData[featureId] || null;
}

/**
 * Handle limited access for certain features
 */
async function handleLimitedAccess<T>(
  featureId: string,
  callback: () => Promise<T>,
  userPlan: Plan
): Promise<T | null> {
  const feature = FEATURES[featureId];
  const limitConfig = feature.limitConfig;
  
  if (!limitConfig) {
    return null;
  }
  
  // Check usage against limits
  const currentUsage = await getFeatureUsage(featureId);
  const limit = userPlan === 'FREE' ? limitConfig.freeLimit : 
                userPlan === 'PRO' ? (limitConfig.proLimit || Infinity) : 
                Infinity;
  
  if (currentUsage < limit) {
    await incrementFeatureUsage(featureId);
    return callback();
  }
  
  console.log(`\n⚠️  Limit reached for ${feature.name}`);
  console.log(`  Used: ${currentUsage}/${limit}`);
  console.log(`  Upgrade to increase limits: /upgrade\n`);
  
  return null;
}

/**
 * Get current usage count for a feature
 */
async function getFeatureUsage(featureId: string): Promise<number> {
  // In production, this would read from database
  // For now, using in-memory counter
  if (!featureUsageCounter[featureId]) {
    featureUsageCounter[featureId] = 0;
  }
  return featureUsageCounter[featureId];
}

/**
 * Increment usage count for a feature
 */
async function incrementFeatureUsage(featureId: string): Promise<void> {
  if (!featureUsageCounter[featureId]) {
    featureUsageCounter[featureId] = 0;
  }
  featureUsageCounter[featureId]++;
}

// In-memory usage counter (replace with persistent storage in production)
const featureUsageCounter: Record<string, number> = {};

/**
 * Get list of available features for a plan
 */
export function getAvailableFeatures(plan: Plan): string[] {
  return Object.entries(FEATURES)
    .filter(([_, feature]) => isPlanSufficient(plan, feature.requiredPlan))
    .map(([id]) => id);
}

/**
 * Get list of locked features for a plan
 */
export function getLockedFeatures(plan: Plan): FeatureConfig[] {
  return Object.values(FEATURES)
    .filter(feature => !isPlanSufficient(plan, feature.requiredPlan));
}

/**
 * Reset feature usage (for testing or monthly reset)
 */
export function resetFeatureUsage(featureId?: string): void {
  if (featureId) {
    delete featureUsageCounter[featureId];
  } else {
    // Reset all
    Object.keys(featureUsageCounter).forEach(key => {
      delete featureUsageCounter[key];
    });
  }
}