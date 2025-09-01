/**
 * Dependency Management System v2.0
 * Graceful degradation and runtime health checks
 */

import type { CommandMeta } from './BaseCommand';

export interface DependencyCheck {
  ok: boolean;
  missing: string[];
  available: string[];
}

/**
 * Check environment variables
 */
export function requireEnv(vars: string[]): DependencyCheck {
  const missing: string[] = [];
  const available: string[] = [];
  
  for (const v of vars) {
    if (process.env[v]) {
      available.push(v);
    } else {
      missing.push(v);
    }
  }
  
  return {
    ok: missing.length === 0,
    missing,
    available
  };
}

/**
 * Dependency guard with graceful fallback
 */
export async function withDependencyGuard<T>(
  deps: string[],
  execute: () => Promise<T>,
  fallback: () => Promise<T> | T
): Promise<T> {
  const { ok, missing } = requireEnv(deps);
  
  if (!ok) {
    console.warn(`[DependencyGuard] Missing: ${missing.join(', ')}`);
    return fallback();
  }
  
  try {
    return await execute();
  } catch (error) {
    console.error('[DependencyGuard] Execution failed, using fallback:', error);
    return fallback();
  }
}

/**
 * Runtime check for command runnability
 * Used by help system for double-filtering
 */
export function isRunnable(command: CommandMeta): boolean {
  // No dependencies = always runnable
  if (!command.deps || command.deps.length === 0) {
    return true;
  }
  
  // Check if dependencies are met
  const { ok } = requireEnv(command.deps);
  
  // Beta/experimental commands can run with missing deps
  if (command.status === 'beta' || command.status === 'experimental') {
    return true;
  }
  
  return ok;
}

/**
 * Check if command is currently broken
 * Additional runtime health check
 */
export function isCurrentlyBroken(command: CommandMeta): boolean {
  // Check for known broken patterns
  const brokenPatterns = [
    'backup',
    'original',
    'test',
    'mock'
  ];
  
  for (const pattern of brokenPatterns) {
    if (command.name.includes(pattern)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Service connectivity check
 */
export async function checkService(
  url: string,
  timeout = 5000
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Batch service health check
 */
export async function checkServices(
  services: Record<string, string>
): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};
  
  for (const [name, url] of Object.entries(services)) {
    results[name] = await checkService(url);
  }
  
  return results;
}

/**
 * Get dependency report for diagnostics
 */
export function getDependencyReport(commands: CommandMeta[]): {
  totalDeps: number;
  uniqueDeps: Set<string>;
  commandsWithDeps: number;
  missingDeps: string[];
} {
  const uniqueDeps = new Set<string>();
  let commandsWithDeps = 0;
  
  for (const cmd of commands) {
    if (cmd.deps && cmd.deps.length > 0) {
      commandsWithDeps++;
      cmd.deps.forEach(dep => uniqueDeps.add(dep));
    }
  }
  
  const allDeps = Array.from(uniqueDeps);
  const { missing } = requireEnv(allDeps);
  
  return {
    totalDeps: uniqueDeps.size,
    uniqueDeps,
    commandsWithDeps,
    missingDeps: missing
  };
}