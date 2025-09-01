/**
 * Environment Variable Loader
 * Loads .env files
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

export function loadEnvironmentVariables(): void {
  // Load .env file
  const _envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(_envPath)) {
    const _result = dotenv.config({ path: _envPath });
    if (_result.error) {
      console.warn("Error loading .env:", _result.error);
    }
  }

  // Load .env.lmstudio if offline mode
  const _lmstudioEnvPath = path.join(process.cwd(), ".env.lmstudio");
  if (fs.existsSync(_lmstudioEnvPath)) {
    const _result = dotenv.config({ path: _lmstudioEnvPath, override: false });
    if (_result.error) {
      console.warn("Error loading .env.lmstudio:", _result.error);
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

  if (process.env["OPENAI_API_KEY"]) {
    providers.push("OpenAI");
  }
  if (process.env["ANTHROPIC_API_KEY"]) {
    providers.push("Anthropic");
  }
  if (process.env["GEMINI_API_KEY"]) {
    providers.push("Google Gemini");
  }
  if (process.env["GROK_API_KEY"]) {
    providers.push("Grok");
  }
  if (process.env["LMSTUDIO_ENABLED"] === "true") {
    providers.push("LM Studio");
  }

  return {
    hasApiKeys: providers.length > 0,
    providers,
    offlineMode: process.env["OFFLINE_MODE"] === "true",
    lmStudioEnabled: process.env["LMSTUDIO_ENABLED"] === "true",
  };
}
