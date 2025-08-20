/**
 * First-Time User Detection Service
 * Determines when users need to run /setup command
 */

import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger';

export interface SetupRequirement {
  level: 'required' | 'recommended' | 'none';
  reasons: string[];
  missingComponents: string[];
  suggestions: string[];
}

export interface ConfigurationStatus {
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
      const status = await this.getConfigurationStatus();

      // User is first-time if they have none of the essential components
      return !(
        status.hasEnvFile &&
        status.hasAnyProviders &&
        (status.hasMariaConfig || status.hasSetupRecord)
      );
    } catch (error) {
      logger.error('Error detecting first-time user:', error);
      return true; // Assume first-time on error for safety
    }
  }

  /**
   * Determine the level of setup requirement
   */
  async getSetupRequirement(): Promise<SetupRequirement> {
    const status = await this.getConfigurationStatus();
    const missingComponents: string[] = [];
    const reasons: string[] = [];
    const suggestions: string[] = [];

    // Check essential components
    if (!status.hasEnvFile) {
      missingComponents.push('.env.local');
      reasons.push('No environment variables configured');
    }

    if (!status.hasAnyProviders) {
      missingComponents.push('AI providers');
      reasons.push('No AI providers configured');
    }

    if (!status.hasMariaConfig && !status.hasSetupRecord) {
      missingComponents.push('MARIA configuration');
      reasons.push('No MARIA configuration found');
    }

    // Determine requirement level
    if (missingComponents.length >= 2) {
      suggestions.push('Run: /setup for complete configuration');
      suggestions.push('Or: /setup --quick for 2-minute setup');

      return {
        level: 'required',
        reasons,
        missingComponents,
        suggestions,
      };
    }

    if (missingComponents.length === 1) {
      suggestions.push('Run: /setup --fix to resolve issues');
      suggestions.push('Or: /setting to configure environment variables');

      return {
        level: 'recommended',
        reasons,
        missingComponents,
        suggestions,
      };
    }

    // Check for outdated setup
    if (status.lastSetupDate) {
      const daysSinceSetup = (Date.now() - status.lastSetupDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceSetup > 30) {
        reasons.push('Setup is over 30 days old');
        suggestions.push('Run: /setup --fix to update configuration');

        return {
          level: 'recommended',
          reasons,
          missingComponents: ['outdated configuration'],
          suggestions,
        };
      }
    }

    return {
      level: 'none',
      reasons: ['Configuration appears complete'],
      missingComponents: [],
      suggestions: [],
    };
  }

  /**
   * Get detailed configuration status
   */
  async getConfigurationStatus(): Promise<ConfigurationStatus> {
    const status: ConfigurationStatus = {
      hasEnvFile: false,
      hasMariaConfig: false,
      hasAnyProviders: false,
      hasSetupRecord: false,
      hasSuccessfulHistory: false,
      workingDirectory: this.cwd,
    };

    // Check for .env.local
    try {
      const envPath = path.join(this.cwd, '.env.local');
      await fs.access(envPath);
      status.hasEnvFile = true;

      // Check if it has any provider keys
      const envContent = await fs.readFile(envPath, 'utf-8');
      const hasOpenAI =
        envContent.includes('OPENAI_API_KEY=') && !envContent.includes('OPENAI_API_KEY=your_');
      const hasAnthropic =
        envContent.includes('ANTHROPIC_API_KEY=') &&
        !envContent.includes('ANTHROPIC_API_KEY=your_');
      const hasGoogle =
        envContent.includes('GOOGLE_AI_API_KEY=') &&
        !envContent.includes('GOOGLE_AI_API_KEY=your_');
      const hasGroq =
        envContent.includes('GROQ_API_KEY=') && !envContent.includes('GROQ_API_KEY=your_');
      const hasLocal =
        envContent.includes('LMSTUDIO_API_URL=') || envContent.includes('OLLAMA_API_URL=');

      status.hasAnyProviders = hasOpenAI || hasAnthropic || hasGoogle || hasGroq || hasLocal;
    } catch {
      // File doesn't exist
    }

    // Check for .maria-code.toml
    try {
      const configPath = path.join(this.cwd, '.maria-code.toml');
      await fs.access(configPath);
      status.hasMariaConfig = true;
    } catch {
      // File doesn't exist
    }

    // Check for setup record
    try {
      const setupPath = path.join(this.cwd, '.maria', 'setup.json');
      await fs.access(setupPath);
      status.hasSetupRecord = true;

      // Get setup date
      const setupContent = await fs.readFile(setupPath, 'utf-8');
      const setupData = JSON.parse(setupContent);
      if (setupData.timestamp) {
        status.lastSetupDate = new Date(setupData.timestamp);
      }
    } catch {
      // File doesn't exist
    }

    // Check for successful command history (simplified)
    try {
      const historyPath = path.join(this.cwd, '.maria', 'history.json');
      await fs.access(historyPath);
      status.hasSuccessfulHistory = true;
    } catch {
      // File doesn't exist
    }

    return status;
  }

  /**
   * Generate setup notification message
   */
  async getSetupNotification(): Promise<string | null> {
    const requirement = await this.getSetupRequirement();

    if (requirement.level === 'required') {
      return `
🚨 First-time setup required!

MARIA CODE needs to be configured before use.
Missing: ${requirement.missingComponents.join(', ')}

This will only take 2-3 minutes.
${requirement.suggestions.join('\n')}
      `.trim();
    }

    if (requirement.level === 'recommended') {
      return `
⚠️ Setup incomplete or outdated

Issues found: ${requirement.reasons.join(', ')}
${requirement.suggestions.join('\n')}
      `.trim();
    }

    return null;
  }

  /**
   * Check if a specific component is configured
   */
  async hasComponent(component: 'env' | 'config' | 'providers' | 'setup'): Promise<boolean> {
    const status = await this.getConfigurationStatus();

    switch (component) {
      case 'env':
        return status.hasEnvFile;
      case 'config':
        return status.hasMariaConfig;
      case 'providers':
        return status.hasAnyProviders;
      case 'setup':
        return status.hasSetupRecord;
      default:
        return false;
    }
  }

  /**
   * Mark setup as completed (for testing/debugging)
   */
  async markSetupCompleted(): Promise<void> {
    const mariaDir = path.join(this.cwd, '.maria');
    await fs.mkdir(mariaDir, { recursive: true });

    const setupRecord = {
      success: true,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      stepsCompleted: ['manual-mark'],
      providersConfigured: ['manual'],
      filesGenerated: [],
      errors: [],
      warnings: [],
    };

    const recordPath = path.join(mariaDir, 'setup.json');
    await fs.writeFile(recordPath, JSON.stringify(setupRecord, null, 2), 'utf-8');
  }

  /**
   * Reset setup state (for testing/debugging)
   */
  async resetSetupState(): Promise<void> {
    const filesToRemove = [
      '.env.local',
      '.maria-code.toml',
      '.maria/setup.json',
      '.maria/history.json',
    ];

    for (const file of filesToRemove) {
      try {
        await fs.unlink(path.join(this.cwd, file));
        logger.debug(`Removed ${file}`);
      } catch {
        // Ignore if file doesn't exist
      }
    }
  }

  /**
   * Get human-readable status summary
   */
  async getStatusSummary(): Promise<string> {
    const status = await this.getConfigurationStatus();
    const requirement = await this.getSetupRequirement();

    const components = [
      `Environment file: ${status.hasEnvFile ? '✅' : '❌'}`,
      `AI providers: ${status.hasAnyProviders ? '✅' : '❌'}`,
      `MARIA config: ${status.hasMariaConfig ? '✅' : '❌'}`,
      `Setup record: ${status.hasSetupRecord ? '✅' : '❌'}`,
    ];

    let summary = `MARIA Setup Status:\n${components.join('\n')}`;

    if (status.lastSetupDate) {
      summary += `\nLast setup: ${status.lastSetupDate.toLocaleDateString()}`;
    }

    summary += `\nOverall status: ${requirement.level.toUpperCase()}`;

    if (requirement.suggestions.length > 0) {
      summary += `\nSuggestions:\n${requirement.suggestions.map((s) => `  ${s}`).join('\n')}`;
    }

    return summary;
  }
}

// Export singleton instance
export const firstTimeUserDetector = new FirstTimeUserDetector();

// Export for CLI integration
export async function checkSetupRequirement(workingDirectory?: string): Promise<{
  shouldBlock: boolean;
  message: string | null;
  requirement: SetupRequirement;
}> {
  const detector = new FirstTimeUserDetector(workingDirectory);
  const requirement = await detector.getSetupRequirement();
  const notification = await detector.getSetupNotification();

  return {
    shouldBlock: requirement.level === 'required',
    message: notification,
    requirement,
  };
}
