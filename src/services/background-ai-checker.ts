/**
 * Background AI Service Checker
 * Checks local AI services asynchronously without blocking startup
 */

import chalk from 'chalk';
import fetch from 'node-fetch';

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
    if (this.checking) return;
    this.checking = true;

    // Run checks in parallel, but don't wait for them
    Promise.all([this.checkLMStudio(), this.checkOllama(), this.checkVLLM()])
      .then(() => {
        this.checking = false;
        this.reportStatus();
      })
      .catch(() => {
        this.checking = false;
      });
  }

  private static async checkLMStudio(): Promise<void> {
    try {
      const response = await fetch('http://localhost:1234/v1/models', {
        method: 'GET',
        signal: AbortSignal.timeout(2000), // Quick 2-second timeout
      });
      this.status.lmstudio = response.ok;
    } catch {
      this.status.lmstudio = false;
    }
  }

  private static async checkOllama(): Promise<void> {
    try {
      const response = await fetch('http://localhost:11434/api/version', {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      this.status.ollama = response.ok;
    } catch {
      this.status.ollama = false;
    }
  }

  private static async checkVLLM(): Promise<void> {
    try {
      const response = await fetch('http://localhost:8000/v1/models', {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      this.status.vllm = response.ok;
    } catch {
      this.status.vllm = false;
    }
  }

  private static reportStatus(): void {
    // Only report if any local AI is available
    const hasLocalAI = this.status.lmstudio || this.status.ollama || this.status.vllm;

    if (hasLocalAI) {
      console.log('');
      console.log(chalk.cyan('📡 Local AI Update:'));

      if (this.status.lmstudio) {
        console.log(chalk.green('  ✅ LM Studio is now available'));
      }
      if (this.status.ollama) {
        console.log(chalk.green('  ✅ Ollama is now available'));
      }
      if (this.status.vllm) {
        console.log(chalk.green('  ✅ vLLM is now available'));
      }

      console.log(chalk.gray('  Type /model to switch to local models'));
      console.log('');
    }
  }

  static getStatus(): LocalAIStatus {
    return { ...this.status };
  }

  static isAnyLocalAIAvailable(): boolean {
    return this.status.lmstudio || this.status.ollama || this.status.vllm;
  }
}
