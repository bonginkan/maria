/**
 * Environment Variable Loader
 * Properly loads .env.local and .env files
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

export function loadEnvironmentVariables(): void {
  // Load .env.local first (higher priority)
  const localEnvPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(localEnvPath)) {
    const result = dotenv.config({ path: localEnvPath });
    if (result.error) {
      console.warn('Error loading .env.local:', result.error);
    } else {
      console.log('✅ Loaded environment from .env.local');
    }
  }

  // Load .env as fallback
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    // Don't override existing vars from .env.local
    const result = dotenv.config({ path: envPath, override: false });
    if (result.error) {
      console.warn('Error loading .env:', result.error);
    }
  }

  // Load .env.lmstudio if offline mode
  const lmstudioEnvPath = path.join(process.cwd(), '.env.lmstudio');
  if (fs.existsSync(lmstudioEnvPath)) {
    const result = dotenv.config({ path: lmstudioEnvPath, override: false });
    if (result.error) {
      console.warn('Error loading .env.lmstudio:', result.error);
    }
  }
}

export function getEnvironmentStatus(): {
  hasApiKeys: boolean;
  providers: string[];
  offlineMode: boolean;
  lmStudioEnabled: boolean;
} {
  const providers: string[] = [];

  if (process.env.OPENAI_API_KEY) providers.push('OpenAI');
  if (process.env.ANTHROPIC_API_KEY) providers.push('Anthropic');
  if (process.env.GEMINI_API_KEY) providers.push('Google Gemini');
  if (process.env.GROK_API_KEY) providers.push('Grok');
  if (process.env.LMSTUDIO_ENABLED === 'true') providers.push('LM Studio');

  return {
    hasApiKeys: providers.length > 0,
    providers,
    offlineMode: process.env.OFFLINE_MODE === 'true',
    lmStudioEnabled: process.env.LMSTUDIO_ENABLED === 'true',
  };
}
