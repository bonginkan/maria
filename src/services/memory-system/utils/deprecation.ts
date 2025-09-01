/**
 * Safe Deprecation Utilities
 * Provides one-time warnings and metrics tracking for deprecated features
 */

const _warnedKeys = new Set<string>();

/**
 * Warn once for deprecated features with metrics tracking
 */
export function warnOnce(
  key: string,
  message: string,
  replacement?: string,
): void {
  if (_warnedKeys.has(key)) return;
  _warnedKeys.add(key);

  const fullMessage = `[DEPRECATED] ${message}${replacement ? ` Use ${replacement} instead.` : ""}`;
  console.warn(fullMessage);

  // Metrics tracking (non-blocking)
  try {
    const metrics = require("../monitoring/metrics-collector");
    metrics.track("deprecation.warning", {
      key,
      component: "maria-memory-system",
      version: process.env.npm_package_version || "unknown",
      replacement,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // Silently fail - metrics should not break functionality
  }
}

/**
 * Check if deprecation warnings are disabled for a specific feature
 */
export function isDeprecationDisabled(feature: string): boolean {
  return process.env[`MARIA_DISABLE_${feature.toUpperCase()}`] === "true";
}

/**
 * Reset warning state (useful for testing)
 */
export function resetWarnings(): void {
  _warnedKeys.clear();
}

/**
 * Get list of warned keys (for debugging)
 */
export function getWarnedKeys(): string[] {
  return Array.from(_warnedKeys);
}

/**
 * Create a deprecation wrapper for functions
 */
export function deprecated<T extends (...args: any[]) => any>(
  fn: T,
  message: string,
  replacement?: string,
): T {
  return ((...args: any[]) => {
    warnOnce(fn.name || "anonymous-function", message, replacement);
    return fn(...args);
  }) as T;
}

/**
 * Create a deprecation wrapper for class methods
 */
export function deprecatedMethod<T>(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor,
  message?: string,
  replacement?: string,
): PropertyDescriptor {
  const originalMethod = descriptor.value;
  const deprecationMessage = message || `Method ${propertyKey} is deprecated`;

  descriptor.value = function (...args: any[]) {
    warnOnce(
      `${target.constructor.name}.${propertyKey}`,
      deprecationMessage,
      replacement,
    );
    return originalMethod(...args);
  };

  return descriptor;
}

/**
 * Environment-specific deprecation handling
 */
export function shouldWarnInEnvironment(): boolean {
  const env = process.env.NODE_ENV;
  const internalMode = process.env.MARIA_INTERNAL_MODE_SHIM;

  // Skip warnings in production unless explicitly enabled
  if (env === "production" && internalMode !== "warn") {
    return false;
  }

  // Force disable all warnings
  if (internalMode === "off") {
    return false;
  }

  return true;
}

/**
 * Safe deprecation for configuration properties
 */
export function deprecatedConfig<T>(
  config: T,
  oldKey: string,
  newKey: string,
  transformFn?: (oldValue: any) => any,
): T {
  const result = { ...config } as any;

  if (oldKey in result && !(newKey in result)) {
    warnOnce(
      `config.${oldKey}`,
      `Configuration property '${oldKey}' is deprecated`,
      newKey,
    );

    const oldValue = result[oldKey];
    result[newKey] = transformFn ? transformFn(oldValue) : oldValue;
    delete result[oldKey];
  }

  return result;
}
