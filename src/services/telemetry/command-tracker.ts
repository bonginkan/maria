/**
 * Command Telemetry Tracker
 * Minimal but complete tracking for all commands
 */

interface CommandEvent {
  cmd: string;
  status: 'success' | 'error' | 'auth' | 'quota' | 'throttled';
  latencyMs: number;
  plan: string;
  quotaLeft: number;
  userId?: string; // hashed server-side if needed
}

interface TelemetryData extends CommandEvent {
  timestamp: number;
  version: string;
  buildId?: string;
  cliVersion?: string;
  region?: string;
}

/**
 * Track command execution for analytics
 */
export async function trackCommand(event: CommandEvent): Promise<void> {
  try {
    const telemetryData: TelemetryData = {
      ...event,
      timestamp: Date.now(),
      version: getPackageVersion(),
      buildId: getBuildId(),
      cliVersion: getCliVersion(),
      region: getRegion()
    };

    // Ship to Cloud Logging in production
    if (process.env.NODE_ENV === 'production') {
      await sendToCloudLogging('maria-command-usage', telemetryData);
    }

    // Development-only local logging
    if (process.env.NODE_ENV === 'development') {
      console.debug(`📊 [TELEMETRY] ${event.cmd}: ${event.status} (${event.latencyMs}ms)`);
    }

  } catch (error) {
    // Telemetry should never block command execution
    if (process.env.NODE_ENV === 'development') {
      console.warn('📊 [TELEMETRY] Failed to track command:', error);
    }
  }
}

/**
 * Send telemetry data to Cloud Logging
 */
async function sendToCloudLogging(logName: string, data: TelemetryData): Promise<void> {
  try {
    // In production, this would integrate with Google Cloud Logging
    // For now, just log structured data
    console.log(JSON.stringify({
      timestamp: new Date(data.timestamp).toISOString(),
      severity: 'INFO',
      logName,
      jsonPayload: data
    }));
  } catch (error) {
    // Silent failure for telemetry
  }
}

/**
 * Get package version
 */
function getPackageVersion(): string {
  try {
    // Would read from package.json in real implementation
    return process.env.npm_package_version || '4.0.0';
  } catch {
    return 'unknown';
  }
}

/**
 * Get build ID for tracking
 */
function getBuildId(): string | undefined {
  return process.env.MARIA_BUILD_ID || undefined;
}

/**
 * Get CLI version
 */
function getCliVersion(): string | undefined {
  return process.env.MARIA_CLI_VERSION || undefined;
}

/**
 * Get deployment region
 */
function getRegion(): string | undefined {
  return process.env.MARIA_REGION || process.env.GOOGLE_CLOUD_REGION || undefined;
}

export type { CommandEvent, TelemetryData };