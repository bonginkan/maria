/**
 * Background AI Service Checker
 * Checks local AI services asynchronously without blocking startup
 */

import _chalk from "chalk";
import fetch from "node-fetch";

export interface LocalAIStatus {
  lmstudio: boolean;
  ollama: boolean;
  vllm: boolean;
}

export class BackgroundAIChecker {
  private static checking = false;
  private static status: LocalAIStatus = {
    lmstudio: false,
    ollama: false,
    vllm: false,
  };

  /**
   * Start checking local AI services in the background
   * This runs asynchronously and doesn't block the main process
   */
  static async startBackgroundCheck(): Promise<void> {
    if (this.checking) {
      return;
    }
    this.checking = true;

    // Run checks in parallel, but don't wait for them
    Promise.all([this.checkLMStudio(), this.checkOllama(), this.checkVLLM()])
      .then(() => {
        this.checking = false;
        // Skip reporting during startup to prevent display issues
      })
      .catch(() => {
        this.checking = false;
      });
  }

  private static async checkLMStudio(): Promise<void> {
    try {
      const _response = await fetch("http://localhost:1234/v1/models", {
        method: "GET",
        signal: AbortSignal.timeout(2000), // Quick 2-second timeout
      });
      this.status.lmstudio = _response.ok;
    } catch {
      this.status.lmstudio = false;
    }
  }

  private static async checkOllama(): Promise<void> {
    try {
      const _response = await fetch("http://localhost:11434/api/version", {
        method: "GET",
        signal: AbortSignal.timeout(2000),
      });
      this.status.ollama = _response.ok;
    } catch {
      this.status.ollama = false;
    }
  }

  private static async checkVLLM(): Promise<void> {
    try {
      const _response = await fetch("http://localhost:8000/v1/models", {
        method: "GET",
        signal: AbortSignal.timeout(2000),
      });
      this.status.vllm = _response.ok;
    } catch {
      this.status.vllm = false;
    }
  }

  private static reportStatus(): void {
    // Skip status reporting during startup to prevent display issues
    // Status can be checked later via /status command
  }

  static getStatus(): LocalAIStatus {
    return { ...this.status };
  }

  static isAnyLocalAIAvailable(): boolean {
    return this.status.lmstudio || this.status.ollama || this.status.vllm;
  }
}
