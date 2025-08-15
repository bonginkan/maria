/**
 * MARIA CODE Offline AI Service
 * Optimized for local LLM operations during offline work
 */

import { LMStudioProvider } from '../providers/lmstudio-provider.js';
import { IAIProvider, Message } from '../providers/ai-provider.js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

export class OfflineAIService {
  private provider: IAIProvider | null = null;
  private isOfflineMode: boolean = false;
  private modelType: '120b' | '20b' = '120b';

  constructor() {
    this.loadOfflineConfig();
  }

  private loadOfflineConfig(): void {
    // Load LM Studio specific config
    const lmstudioEnvPath = path.join(process.cwd(), '.env.lmstudio');
    if (fs.existsSync(lmstudioEnvPath)) {
      dotenv.config({ path: lmstudioEnvPath });
      this.isOfflineMode = process.env['OFFLINE_MODE'] === 'true';
    }

    // Load regular .env.local as fallback
    const localEnvPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(localEnvPath)) {
      dotenv.config({ path: localEnvPath });
    }
  }

  async initialize(): Promise<boolean> {
    try {
      console.log('🚀 Initializing Offline AI Service with LM Studio...');

      this.provider = new LMStudioProvider();
      await this.provider.initialize(process.env['LMSTUDIO_API_KEY'] || 'lm-studio', {
        apiBase: process.env['LMSTUDIO_API_BASE'] || 'http://localhost:1234/v1',
        model: this.modelType === '120b' ? 'gpt-oss-120b' : 'gpt-oss-20b',
        maxTokens: parseInt(process.env['LMSTUDIO_MAX_TOKENS'] || '8192'),
        temperature: parseFloat(process.env['LMSTUDIO_TEMPERATURE'] || '0.7'),
        stream: process.env['LMSTUDIO_STREAM'] === 'true',
        timeout: parseInt(process.env['LMSTUDIO_TIMEOUT'] || '600000'),
      });

      // Verify server is running
      const isRunning = await (this.provider as LMStudioProvider).isServerRunning();
      if (!isRunning) {
        console.error('❌ LM Studio server is not running');
        console.log('💡 Run: ./scripts/start-lmstudio-120b.sh');
        return false;
      }

      // Get available models
      const models = await (this.provider as LMStudioProvider).getAvailableModels();
      console.log('✅ Available models:', models);

      console.log(`✅ Offline AI Service initialized with ${this.modelType} model`);
      return true;
    } catch (error: unknown) {
      console.error('❌ Failed to initialize Offline AI Service:', error);
      return false;
    }
  }

  async chat(messages: Message[]): Promise<string> {
    if (!this.provider) {
      throw new Error('Offline AI Service not initialized');
    }

    try {
      const response = await this.provider.chat(messages);
      return response;
    } catch (error: unknown) {
      console.error('Chat error:', error);
      throw error;
    }
  }

  async *streamChat(messages: Message[]): AsyncGenerator<string> {
    if (!this.provider) {
      throw new Error('Offline AI Service not initialized');
    }

    try {
      yield* this.provider.chatStream(messages);
    } catch (error: unknown) {
      console.error('Stream chat error:', error);
      throw error;
    }
  }

  async switchModel(modelType: '120b' | '20b'): Promise<void> {
    this.modelType = modelType;
    if (this.provider) {
      // Re-initialize with new model
      await this.provider.initialize(process.env['LMSTUDIO_API_KEY'] || 'lm-studio', {
        apiBase: process.env['LMSTUDIO_API_BASE'] || 'http://localhost:1234/v1',
        model: this.modelType === '120b' ? 'gpt-oss-120b' : 'gpt-oss-20b',
        maxTokens: parseInt(process.env['LMSTUDIO_MAX_TOKENS'] || '8192'),
        temperature: parseFloat(process.env['LMSTUDIO_TEMPERATURE'] || '0.7'),
        stream: process.env['LMSTUDIO_STREAM'] === 'true',
        timeout: parseInt(process.env['LMSTUDIO_TIMEOUT'] || '600000'),
      });
      console.log(`✅ Switched to ${modelType} model`);
    }
  }

  isOffline(): boolean {
    return this.isOfflineMode;
  }

  getStatus(): {
    mode: string;
    provider: string;
    model: string;
    isOffline: boolean;
  } {
    return {
      mode: 'offline',
      provider: 'LM Studio',
      model: this.modelType === '120b' ? 'gpt-oss-120b' : 'gpt-oss-20b',
      isOffline: this.isOfflineMode,
    };
  }
}

// Export singleton instance
export const offlineAI = new OfflineAIService();
