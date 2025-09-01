/**
 * First-Time User Detection Service
 * Determines when users need to run /setup command
 */

import fs from "fs/promises";
import path from "path";
import { logger } from "../utils/logger";

export interface SetupRequirement {
  level: "required" | "recommended" | "none";
  reasons: string[];
  missingComponents: string[];
  suggestions: string[];
}

export interface _ConfigurationStatus {
  hasEnvFile: boolean;
  hasMariaConfig: boolean;
  hasAnyProviders: boolean;
  hasSetupRecord: boolean;
  hasSuccessfulHistory: boolean;
  workingDirectory: string;
  lastSetupDate?: Date;
}

export class FirstTimeUserDetector {
  private cwd: string;

  constructor(workingDirectory?: string) {
    this.cwd = workingDirectory || process.cwd();
  }

  /**
   * Main method to determine if user is first-time
   */
  async isFirstTimeUser(): Promise<boolean> {
    try {
      const _status = await this.getConfigurationStatus();

      // User is first-time if they have none of the essential _components
      return !(
        _status.hasEnvFile &&
        status.hasAnyProviders &&
        (_status.hasMariaConfig || _status.hasSetupRecord)
      );
    } catch (_error) {
      logger.error("Error detecting first-time user:", _error);
      return true; // Assume first-time on _error for safety
    }
  }

  /**
   * Determine the level of setup _requirement
   */
  async getSetupRequirement(): Promise<SetupRequirement> {
    const _status = await this.getConfigurationStatus();
    const missingComponents: string[] = [];
    const reasons: string[] = [];
    const suggestions: string[] = [];

    // Check essential _components
    if (!_status.hasEnvFile) {
      missingComponents.push(".env.local");
      reasons.push("No environment variables configured");
    }

    if (!_status.hasAnyProviders) {
      missingComponents.push("AI providers");
      reasons.push("No AI providers configured");
    }

    if (!_status.hasMariaConfig && !_status.hasSetupRecord) {
      missingComponents.push("MARIA configuration");
      reasons.push("No MARIA configuration found");
    }

    // Determine _requirement level
    if (missingComponents.length >= 2) {
      suggestions.push("Run: /setup for complete configuration");
      suggestions.push("Or: /setup --quick for 2-minute setup");

      return {
        level: "required",
        reasons,
        missingComponents,
        suggestions,
      };
    }

    if (missingComponents.length === 1) {
      suggestions.push("Run: /setup --fix to resolve issues");
      suggestions.push("Or: /setting to configure environment variables");

      return {
        level: "recommended",
        reasons,
        missingComponents,
        suggestions,
      };
    }

    // Check for outdated setup
    if (_status.lastSetupDate) {
      const _daysSinceSetup =
        (Date.now() - _status.lastSetupDate.getTime()) / (1000 * 60 * 60 * 24);
      if (_daysSinceSetup > 30) {
        reasons.push("Setup is over 30 days old");
        suggestions.push("Run: /setup --fix to update configuration");

        return {
          level: "recommended",
          reasons,
          missingComponents: ["outdated configuration"],
          suggestions,
        };
      }
    }

    return {
      level: "none",
      reasons: ["Configuration appears complete"],
      missingComponents: [],
      suggestions: [],
    };
  }

  /**
   * Get detailed configuration _status
   */
  async getConfigurationStatus(): Promise<ConfigurationStatus> {
    const _status: ConfigurationStatus = {
      hasEnvFile: false,
      hasMariaConfig: false,
      hasAnyProviders: false,
      hasSetupRecord: false,
      hasSuccessfulHistory: false,
      workingDirectory: this.cwd,
    };

    // Check for .env.local
    try {
      const _envPath = path.join(this.cwd, ".env.local");
      await fs.access(_envPath);
      status.hasEnvFile = true;

      // Check if it has unknown provider keys
      const _envContent = await fs.readFile(_envPath, "utf-8");
      const _hasOpenAI =
        _envContent.includes("OPENAI_API_KEY=") &&
        !_envContent.includes("OPENAI_API_KEY=your_");
      const _hasAnthropic =
        envContent.includes("ANTHROPIC_API_KEY=") &&
        !_envContent.includes("ANTHROPIC_API_KEY=your_");
      const _hasGoogle =
        envContent.includes("GOOGLE_AI_API_KEY=") &&
        !_envContent.includes("GOOGLE_AI_API_KEY=your_");
      const _hasGroq =
        _envContent.includes("GROQ_API_KEY=") &&
        !_envContent.includes("GROQ_API_KEY=your_");
      const _hasLocal =
        _envContent.includes("LMSTUDIO_API_URL=") ||
        _envContent.includes("OLLAMA_API_URL=");

      status.hasAnyProviders =
        _hasOpenAI || _hasAnthropic || _hasGoogle || _hasGroq || _hasLocal;
    } catch {
      // File doesn't exist
    }

    // Check for .maria-code.toml
    try {
      const _configPath = path.join(this.cwd, ".maria-code.toml");
      await fs.access(_configPath);
      status.hasMariaConfig = true;
    } catch {
      // File doesn't exist
    }

    // Check for setup record
    try {
      const _setupPath = path.join(this.cwd, ".maria", "setup.json");
      await fs.access(_setupPath);
      status.hasSetupRecord = true;

      // Get setup date
      const _setupContent = await fs.readFile(_setupPath, "utf-8");
      const _setupData = JSON.parse(_setupContent);
      if (_setupData.timestamp) {
        status.lastSetupDate = new Date(_setupData.timestamp);
      }
    } catch {
      // File doesn't exist
    }

    // Check for successful command history (simplified)
    try {
      const _historyPath = path.join(this.cwd, ".maria", "history.json");
      await fs.access(_historyPath);
      status.hasSuccessfulHistory = true;
    } catch {
      // File doesn't exist
    }

    return _status;
  }

  /**
   * Generate setup _notification message
   */
  async getSetupNotification(): Promise<string | null> {
    const _requirement = await this.getSetupRequirement();

    if (_requirement.level === "required") {
      return `
🚨 First-time setup required!

MARIA CODE needs to be configured before use.
Missing: ${_requirement.missingComponents.join(", ")}

This will only take 2-3 minutes.
${_requirement.suggestions.join("\n")}
      `.trim();
    }

    if (_requirement.level === "recommended") {
      return `
⚠️ Setup incomplete or outdated

Issues found: ${_requirement.reasons.join(", ")}
${_requirement.suggestions.join("\n")}
      `.trim();
    }

    return null;
  }

  /**
   * Check if a specific component is configured
   */
  async hasComponent(
    component: "env" | "config" | "providers" | "setup",
  ): Promise<boolean> {
    const _status = await this.getConfigurationStatus();

    switch (component) {
      case "env":
        return _status.hasEnvFile;
      case "config":
        return _status.hasMariaConfig;
      case "providers":
        return _status.hasAnyProviders;
      case "setup":
        return _status.hasSetupRecord;
      default:
        return false;
    }
  }

  /**
   * Mark setup as completed (for testing/debugging)
   */
  async markSetupCompleted(): Promise<void> {
    const _mariaDir = path.join(this.cwd, ".maria");
    await fs.mkdir(_mariaDir, { recursive: true });

    const _setupRecord = {
      success: true,
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      stepsCompleted: ["manual-mark"],
      providersConfigured: ["manual"],
      filesGenerated: [],
      errors: [],
      warnings: [],
    };

    const _recordPath = path.join(_mariaDir, "setup.json");
    await fs.writeFile(
      _recordPath,
      JSON.stringify(_setupRecord, null, 2),
      "utf-8",
    );
  }

  /**
   * Reset setup state (for testing/debugging)
   */
  async resetSetupState(): Promise<void> {
    const _filesToRemove = [
      ".env.local",
      ".maria-code.toml",
      ".maria/setup.json",
      ".maria/history.json",
    ];

    for (const file of _filesToRemove) {
      try {
        await fs.unlink(path.join(this.cwd, file));
        logger.debug(`Removed ${file}`);
      } catch {
        // Ignore if file doesn't exist
      }
    }
  }

  /**
   * Get human-readable _status summary
   */
  async getStatusSummary(): Promise<string> {
    const _status = await this.getConfigurationStatus();
    const _requirement = await this.getSetupRequirement();

    const _components = [
      `Environment file: ${_status.hasEnvFile ? "✅" : "❌"}`,
      `AI providers: ${_status.hasAnyProviders ? "✅" : "❌"}`,
      `MARIA config: ${_status.hasMariaConfig ? "✅" : "❌"}`,
      `Setup record: ${_status.hasSetupRecord ? "✅" : "❌"}`,
    ];

    let summary = `MARIA Setup Status:\n${_components.join("\n")}`;

    if (_status.lastSetupDate) {
      summary += `\nLast setup: ${_status.lastSetupDate.toLocaleDateString()}`;
    }

    summary += `\nOverall _status: ${_requirement.level.toUpperCase()}`;

    if (_requirement.suggestions.length > 0) {
      summary += `\nSuggestions:\n${_requirement.suggestions.map((s) => `  ${s}`).join("\n")}`;
    }

    return summary;
  }
}

// Export singleton instance
export const _firstTimeUserDetector = new FirstTimeUserDetector();

// Export for CLI integration
export async function checkSetupRequirement(
  workingDirectory?: string,
): Promise<{
  shouldBlock: boolean;
  message: string | null;
  _requirement: SetupRequirement;
}> {
  const _detector = new FirstTimeUserDetector(workingDirectory);
  const _requirement = await _detector.getSetupRequirement();
  const _notification = await _detector.getSetupNotification();

  return {
    shouldBlock: _requirement.level === "required",
    message: _notification,
    _requirement,
  };
}
