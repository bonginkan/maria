/**
 * Type Guards and Utilities
 * Common type checking utilities to handle unknown types safely
 */

// Basic type guards
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function';
}

export function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

// Complex type guards
export function hasProperty<K extends string>(obj: unknown, key: K): obj is Record<K, unknown> {
  return isObject(obj) && key in obj;
}

export function hasStringProperty<K extends string>(
  obj: unknown,
  key: K,
): obj is Record<K, string> {
  return hasProperty(obj, key) && isString(obj[key]);
}

export function hasNumberProperty<K extends string>(
  obj: unknown,
  key: K,
): obj is Record<K, number> {
  return hasProperty(obj, key) && isNumber(obj[key]);
}

export function hasBooleanProperty<K extends string>(
  obj: unknown,
  key: K,
): obj is Record<K, boolean> {
  return hasProperty(obj, key) && isBoolean(obj[key]);
}

export function hasArrayProperty<K extends string>(
  obj: unknown,
  key: K,
): obj is Record<K, unknown[]> {
  return hasProperty(obj, key) && isArray(obj[key]);
}

// Safe accessors
export function safeString(value: unknown, defaultValue = ''): string {
  return isString(value) ? value : defaultValue;
}

export function safeNumber(value: unknown, defaultValue = 0): number {
  return isNumber(value) ? value : defaultValue;
}

export function safeBoolean(value: unknown, defaultValue = false): boolean {
  return isBoolean(value) ? value : defaultValue;
}

export function safeArray<T = unknown>(value: unknown, defaultValue: T[] = []): T[] {
  return isArray(value) ? (value as T[]) : defaultValue;
}

export function safeObject(
  value: unknown,
  defaultValue: Record<string, unknown> = {},
): Record<string, unknown> {
  return isObject(value) ? value : defaultValue;
}

// Property accessors
export function getStringProperty(obj: unknown, key: string, defaultValue = ''): string {
  if (isObject(obj) && key in obj) {
    return safeString(obj[key], defaultValue);
  }
  return defaultValue;
}

export function getNumberProperty(obj: unknown, key: string, defaultValue = 0): number {
  if (isObject(obj) && key in obj) {
    return safeNumber(obj[key], defaultValue);
  }
  return defaultValue;
}

export function getBooleanProperty(obj: unknown, key: string, defaultValue = false): boolean {
  if (isObject(obj) && key in obj) {
    return safeBoolean(obj[key], defaultValue);
  }
  return defaultValue;
}

export function getArrayProperty<T = unknown>(
  obj: unknown,
  key: string,
  defaultValue: T[] = [],
): T[] {
  if (isObject(obj) && key in obj) {
    return safeArray<T>(obj[key], defaultValue);
  }
  return defaultValue;
}

export function getObjectProperty(
  obj: unknown,
  key: string,
  defaultValue: Record<string, unknown> = {},
): Record<string, unknown> {
  if (isObject(obj) && key in obj) {
    return safeObject(obj[key], defaultValue);
  }
  return defaultValue;
}

// Error handling
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

export function getErrorMessage(error: unknown): string {
  if (isError(error)) return error.message;
  if (isString(error)) return error;
  if (isObject(error) && hasStringProperty(error, 'message')) {
    return error.message;
  }
  return 'Unknown error occurred';
}

// JSON safe parsing
export function safeJsonParse<T = unknown>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json) as Record<string, unknown> as T;
  } catch {
    return defaultValue;
  }
}

// Type assertion helpers
export function assertIsString(
  value: unknown,
  message = 'Expected string',
): asserts value is string {
  if (!isString(value)) {
    throw new Error(message);
  }
}

export function assertIsNumber(
  value: unknown,
  message = 'Expected number',
): asserts value is number {
  if (!isNumber(value)) {
    throw new Error(message);
  }
}

export function assertIsObject(
  value: unknown,
  message = 'Expected object',
): asserts value is Record<string, unknown> {
  if (!isObject(value)) {
    throw new Error(message);
  }
}

export function assertIsArray(
  value: unknown,
  message = 'Expected array',
): asserts value is unknown[] {
  if (!isArray(value)) {
    throw new Error(message);
  }
}

// Specific domain type guards
export function isCommandResult(
  value: unknown,
): value is { success: boolean; message: string; data?: unknown } {
  return (
    isObject(value) && hasBooleanProperty(value, 'success') && hasStringProperty(value, 'message')
  );
}

export function isAnalysisResult(value: unknown): value is {
  metrics: Record<string, number>;
  communities: unknown[];
  paths: unknown[];
} {
  return (
    isObject(value) &&
    hasProperty(value, 'metrics') &&
    isObject(value['metrics']) &&
    hasArrayProperty(value, 'communities') &&
    hasArrayProperty(value, 'paths')
  );
}

export function isHealthStatus(value: unknown): value is {
  overall: string;
  timestamp: string;
  system: unknown;
  services: unknown;
  cloudAPIs: unknown;
  recommendations: string[];
} {
  return (
    isObject(value) &&
    hasStringProperty(value, 'overall') &&
    hasStringProperty(value, 'timestamp') &&
    hasProperty(value, 'system') &&
    hasProperty(value, 'services') &&
    hasProperty(value, 'cloudAPIs') &&
    hasArrayProperty(value, 'recommendations')
  );
}
