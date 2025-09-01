/**
 * Model Selector v2 - Feature Flag System
 * Controls gradual rollout and A/B testing
 */

export interface FeatureFlagConfig {
  enabled: boolean;
  percentage: number;
  userId?: string;
  sessionId?: string;
  environment?: string;
}

/**
 * Check if Model Selector v2 is enabled for current context
 */
export function isModelSelectorV2Enabled(
  config?: Partial<FeatureFlagConfig>,
): boolean {
  // Environment variable override
  const envFlag = process.env.MODEL_SELECTOR_V2_ENABLED;
  if (envFlag === "1" || envFlag === "true") {
    return true;
  }
  if (envFlag === "0" || envFlag === "false") {
    return false;
  }

  // Percentage-based rollout
  const percentage = parseFloat(
    process.env.MODEL_SELECTOR_V2_PERCENTAGE || "0",
  );
  if (percentage > 0) {
    const hash = hashString(config?.userId || config?.sessionId || "anonymous");
    const userPercentile = (hash % 100) / 100;
    return userPercentile < percentage;
  }

  // Development/test environment
  if (
    process.env.NODE_ENV === "development" ||
    process.env.NODE_ENV === "test"
  ) {
    return config?.enabled ?? false;
  }

  // Default: disabled
  return false;
}

/**
 * Get current feature flag configuration
 */
export function getModelSelectorV2Config(): FeatureFlagConfig {
  return {
    enabled: isModelSelectorV2Enabled(),
    percentage: parseFloat(process.env.MODEL_SELECTOR_V2_PERCENTAGE || "0"),
    environment: process.env.NODE_ENV || "production",
  };
}

/**
 * Simple string hash function for consistent user bucketing
 */
function hashString(str: string): number {
  let hash = 0;
  if (str.length === 0) return hash;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return Math.abs(hash);
}

/**
 * Log feature flag usage for analytics
 */
export function logFeatureFlagUsage(
  feature: string,
  enabled: boolean,
  context?: Record<string, any>,
): void {
  if (process.env.NODE_ENV === "development") {
    console.log(`[FeatureFlag] ${feature}: ${enabled}`, context);
  }

  // In production, this would send to analytics service
  // analytics.track('feature_flag_usage', { feature, enabled, ...context });
}

/**
 * Gradual rollout helper for safe deployment
 */
export class GradualRollout {
  private static rolloutSchedule = new Map<string, number>();

  static setRolloutPercentage(feature: string, percentage: number): void {
    this.rolloutSchedule.set(feature, Math.max(0, Math.min(100, percentage)));
  }

  static isEnabledForUser(feature: string, userId: string): boolean {
    const percentage = this.rolloutSchedule.get(feature) || 0;
    if (percentage === 0) return false;
    if (percentage >= 100) return true;

    const hash = hashString(`${feature}:${userId}`);
    return hash % 100 < percentage;
  }

  static getCurrentRollout(): Record<string, number> {
    return Object.fromEntries(this.rolloutSchedule);
  }
}
