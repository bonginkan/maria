// src/services/shell-agent/sandbox.ts
import * as fs from "node:fs/promises";
import * as path from "node:path";
import fg from "fast-glob";

/** Shell metacharacter detection */
const _META_CHARS = /[;&|><`$]/;

/** Allowed commands whitelist */
const _ALLOW_CMDS = new Set(["ls", "cat", "grep", "head", "tail", "sed"]);

/** Forbidden command tokens */
const _FORBIDDEN_TOKENS = /\b(rm|sudo|curl|wget|scp|ssh)\b/i;

/** Assert no shell metacharacters in argument */
export function assertNoShellMeta(s: string): void {
  if (_META_CHARS.test(s)) {
    throw new Error(`shell metacharacters not allowed: ${s}`);
  }
}

/** Assert command is in whitelist */
export function assertSafeCommand(cmd: string): void {
  if (!_ALLOW_CMDS.has(cmd)) {
    throw new Error(`command not allowed: ${cmd}`);
  }
}

/** Assert arguments within budget limits */
export function assertArgsBudget(
  args: string[],
  { maxArgs = 4, maxLen = 200 }: { maxArgs?: number; maxLen?: number } = {},
): void {
  if (args.length > maxArgs) {
    throw new Error(`too many args: ${args.length} (max ${maxArgs})`);
  }

  for (const a of args) {
    if (a.length > maxLen) {
      throw new Error(`arg too long: ${a.slice(0, 50)}... (max ${maxLen})`);
    }
  }
}

/**
 * Enhanced safe path validation with symlink protection
 * Uses realpath + lstat for comprehensive security
 */
export async function assertSafePath(
  workspaceRoot: string,
  rel: string,
): Promise<{ abs: string; real: string }> {
  const rootReal = await fs.realpath(path.resolve(workspaceRoot));
  const abs = path.resolve(rootReal, rel);
  const real = await fs.realpath(abs).catch(() => abs); // Handle non-existent files

  // Workspace boundary check
  if (!real.startsWith(rootReal + path.sep) && real !== rootReal) {
    throw new Error(`path escapes workspace: ${rel}`);
  }

  // Symlink protection
  const st = await fs.lstat(abs).catch(() => undefined);
  if (st?.isSymbolicLink()) {
    throw new Error(`symlink denied: ${rel}`);
  }

  // Denied path patterns (strict regex matching)
  const denied = [
    /[/\\]\.git([/\\]|$)/,
    /[/\\]node_modules([/\\]|$)/,
    /^[/\\]$/,
  ];

  // Special check for tilde paths (home directory)
  if (rel.startsWith("~/")) {
    throw new Error(`path denied: ${rel}`);
  }

  for (const d of denied) {
    if (d.test(real) || d.test(abs)) {
      throw new Error(`path denied: ${rel}`);
    }
  }

  return { abs, real };
}

/**
 * Safe glob expansion with limits
 * Prevents glob bombs and excessive file enumeration
 */
export async function safeGlob(
  patterns: string | string[],
  _root: string,
  {
    maxMatches = 2000,
    cwd = _root,
  }: { maxMatches?: number; cwd?: string } = {},
): Promise<string[]> {
  const list = await fg(patterns, {
    cwd,
    dot: false,
    onlyFiles: true,
    unique: true,
    deep: 8, // Reasonable depth limit
  });

  if (list.length > maxMatches) {
    throw new Error(
      `glob expands too many files: ${list.length} (max ${maxMatches})`,
    );
  }

  return list;
}

/**
 * Resource budget validation
 * Prevents resource exhaustion attacks
 */
export function assertResourceBudget(options: {
  fileCount?: number;
  totalSize?: number;
  maxFiles?: number;
  maxSize?: number;
}): void {
  const {
    fileCount = 0,
    totalSize = 0,
    maxFiles = 1000,
    maxSize = 5_000_000,
  } = options;

  if (fileCount > maxFiles) {
    throw new Error(`too many files: ${fileCount} (max ${maxFiles})`);
  }

  if (totalSize > maxSize) {
    throw new Error(
      `total size too large: ${totalSize} bytes (max ${maxSize})`,
    );
  }
}

/** Enhanced security validation for forbidden tokens */
export function assertNoForbiddenTokens(text: string): void {
  if (_FORBIDDEN_TOKENS.test(text)) {
    throw new Error(`forbidden tokens detected: ${text}`);
  }
}

/** Security configuration constants */
export const SANDBOX_CONFIG = {
  MAX_FILE_MATCHES: 2000,
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_PREVIEW_SIZE: 50 * 1024, // 50KB
  MAX_ARGS: 4,
  MAX_ARG_LENGTH: 200,
  MAX_GLOB_DEPTH: 8,
  EXECUTION_TIMEOUT: 10000, // 10 seconds
} as const;

export type SandboxConfig = typeof SANDBOX_CONFIG;
