/**
 * Controlled escape hatch for `any` types
 * Phase 1: This is the ONLY file where `any` is allowed
 * All other files should use proper TypeScript types
 */

export type Raw = unknown;

// Type guards for safe narrowing
export function isString(value: Raw): value is string {
  return typeof value === "string";
}

export function isNumber(value: Raw): value is number {
  return typeof value === "number" && !isNaN(value);
}

export function isObject(value: Raw): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function isArray(value: Raw): value is unknown[] {
  return Array.isArray(value);
}

// Emergency any cast (use sparingly)
export function emergencyAnycast<T>(value: unknown): T {
  return value as any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

// Safe parsing utilities
export function parseUser(v: Raw) {
  if (!isObject(v) || !isString(v.id)) {
    throw new Error("Invalid user object");
  }
  return v as { id: string; [key: string]: unknown };
}

export function parseConfig(v: Raw) {
  if (!isObject(v)) {
    throw new Error("Invalid config object");
  }
  return v as Record<string, unknown>;
}
