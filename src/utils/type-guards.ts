/**
 * Type Guards and Utilities
 * Common type checking utilities to handle unknown types safely
 */

// Basic type guards
export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function isNumber(value: unknown): value is number {
  return typeof value === "number" && !isNaN(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isFunction(
  value: unknown,
): value is (...args: unknown[]) => unknown {
  return typeof value === "function";
}

export function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

// Complex type guards
export function hasProperty<K extends string>(
  _obj: unknown,
  key: K,
): _obj is Record<K, unknown> {
  return isObject(_obj) && key in _obj;
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
export function safeString(_value: unknown, _defaultValue = ""): string {
  return isString(_value) ? _value : _defaultValue;
}

export function safeNumber(_value: unknown, _defaultValue = 0): number {
  return isNumber(_value) ? _value : _defaultValue;
}

export function safeBoolean(_value: unknown, _defaultValue = false): boolean {
  return isBoolean(_value) ? _value : _defaultValue;
}

export function safeArray<T = unknown>(
  _value: unknown,
  defaultValue: T[] = [],
): T[] {
  return isArray(_value) ? (_value as T[]) : defaultValue;
}

export function safeObject(
  _value: unknown,
  defaultValue: Record<string, _unknown> = {},
): Record<string, unknown> {
  return isObject(_value) ? _value : defaultValue;
}

// Property accessors
export function getStringProperty(
  _obj: unknown,
  key: string,
  _defaultValue = "",
): string {
  if (isObject(_obj) && key in _obj) {
    return safeString(_obj[key], _defaultValue);
  }
  return _defaultValue;
}

export function getNumberProperty(
  _obj: unknown,
  key: string,
  _defaultValue = 0,
): number {
  if (isObject(_obj) && key in _obj) {
    return safeNumber(_obj[key], _defaultValue);
  }
  return _defaultValue;
}

export function getBooleanProperty(
  _obj: unknown,
  key: string,
  _defaultValue = false,
): boolean {
  if (isObject(_obj) && key in _obj) {
    return safeBoolean(_obj[key], _defaultValue);
  }
  return _defaultValue;
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
  _obj: unknown,
  key: string,
  defaultValue: Record<string, _unknown> = {},
): Record<string, unknown> {
  if (isObject(_obj) && key in _obj) {
    return safeObject(_obj[key], defaultValue);
  }
  return defaultValue;
}

// Error handling
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (isString(error)) {
    return error;
  }
  if (isObject(error) && hasStringProperty(error, "message")) {
    return error.message;
  }
  return "Unknown error occurred";
}

// JSON safe parsing
export function safeJsonParse<T = unknown>(_json: string, defaultValue: T): T {
  try {
    return JSON.parse(_json) as Record<string, unknown> as T;
  } catch {
    return defaultValue;
  }
}

// Type assertion helpers
export function assertIsString(
  _value: unknown,
  _message = "Expected string",
): asserts _value is string {
  if (!isString(_value)) {
    throw new Error(_message);
  }
}

export function assertIsNumber(
  _value: unknown,
  _message = "Expected number",
): asserts _value is number {
  if (!isNumber(_value)) {
    throw new Error(_message);
  }
}

export function assertIsObject(
  _value: unknown,
  _message = "Expected object",
): asserts _value is Record<string, unknown> {
  if (!isObject(_value)) {
    throw new Error(_message);
  }
}

export function assertIsArray(
  _value: unknown,
  _message = "Expected array",
): asserts _value is unknown[] {
  if (!isArray(_value)) {
    throw new Error(_message);
  }
}

// Specific domain type guards
export function isCommandResult(
  _value: unknown,
): _value is { success: boolean; message: string; data?: unknown } {
  return (
    isObject(_value) &&
    hasBooleanProperty(_value, "success") &&
    hasStringProperty(_value, "message")
  );
}

export function isAnalysisResult(value: unknown): value is {
  metrics: Record<string, number>;
  communities: unknown[];
  paths: unknown[];
} {
  return (
    isObject(value) &&
    hasProperty(value, "metrics") &&
    isObject(value["metrics"]) &&
    hasArrayProperty(value, "communities") &&
    hasArrayProperty(value, "paths")
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
    hasStringProperty(value, "overall") &&
    hasStringProperty(value, "timestamp") &&
    hasProperty(value, "system") &&
    hasProperty(value, "services") &&
    hasProperty(value, "cloudAPIs") &&
    hasArrayProperty(value, "recommendations")
  );
}
