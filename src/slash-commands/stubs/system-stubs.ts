/**
 * System Command Stubs - Minimal V2 handlers for immediate BROKEN → READY conversion
 * Phase 1 implementation: structured stubs with telemetry
 */

import { commandUnavailable, type NormalizedError } from '../../services/guards/error-normalizer.js';

export interface StubTelemetry {
  cmd: string;
  status: 'stub';
  latencyMs: number;
  timestamp: number;
}

export interface SystemStubResult extends NormalizedError {
  telemetry: StubTelemetry;
}

/**
 * /status stub - System diagnostics temporarily unavailable
 */
export function statusStub(): SystemStubResult {
  const startTime = Date.now();
  const baseError = commandUnavailable("/status", "system diagnostics under maintenance");
  
  return {
    ...baseError,
    message: "🔧 System status temporarily unavailable",
    guidance: "Basic system info available via /help or /version",
    telemetry: {
      cmd: "status",
      status: "stub",
      latencyMs: Date.now() - startTime,
      timestamp: Date.now()
    }
  };
}

/**
 * /doctor stub - Health checks temporarily unavailable  
 */
export function doctorStub(): SystemStubResult {
  const startTime = Date.now();
  const baseError = commandUnavailable("/doctor", "health diagnostics under maintenance");
  
  return {
    ...baseError,
    message: "🩺 System health check temporarily unavailable",
    guidance: "Try /version for basic system info or /help for available commands",
    telemetry: {
      cmd: "doctor", 
      status: "stub",
      latencyMs: Date.now() - startTime,
      timestamp: Date.now()
    }
  };
}

/**
 * Generic system stub for other system commands
 */
export function systemStub(command: string, feature: string): SystemStubResult {
  const startTime = Date.now();
  const baseError = commandUnavailable(`/${command}`, "feature under development");
  
  return {
    ...baseError,
    message: `⚙️ ${feature} temporarily unavailable`,
    guidance: "Feature in development - check /help for alternatives",
    telemetry: {
      cmd: command,
      status: "stub", 
      latencyMs: Date.now() - startTime,
      timestamp: Date.now()
    }
  };
}