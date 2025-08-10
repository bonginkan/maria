/**
 * MARIA AI - Core AI Assistant class
 * Handles provider management and intelligent routing
 */

import { AIProvider, AIRequest, AIResponse, ModelInfo } from './types';
import { AIProviderManager } from './providers/manager';
import { IntelligentRouter } from './services/intelligent-router';
import { HealthMonitor } from './services/health-monitor';
import { ConfigManager } from './config/config-manager';

export interface MariaAIConfig {
  priority?: 'privacy-first' | 'performance' | 'cost-effective' | 'auto';
  enabledProviders?: string[];
  apiKeys?: Record<string, string>;
  localProviders?: {
    lmstudio?: boolean;
    ollama?: boolean;
    vllm?: boolean;
  };
  autoStart?: boolean;
  healthMonitoring?: boolean;
}

export class MariaAI {
  private providerManager: AIProviderManager;
  private router: IntelligentRouter;
  private healthMonitor: HealthMonitor;
  private config: ConfigManager;

  constructor(config: MariaAIConfig = {}) {
    this.config = new ConfigManager(config);
    this.providerManager = new AIProviderManager(this.config);
    this.router = new IntelligentRouter(this.providerManager, this.config);
    this.healthMonitor = new HealthMonitor(this.providerManager);

    if (config.autoStart !== false) {
      this.initialize();
    }
  }

  private async initialize(): Promise<void> {
    await this.providerManager.initialize();
    
    if (this.config.get('healthMonitoring', true)) {
      this.healthMonitor.start();
    }
  }

  /**
   * Send a chat message and get AI response
   */
  async chat(message: string, options: Partial<AIRequest> = {}): Promise<AIResponse> {
    const request: AIRequest = {
      messages: [{ role: 'user', content: message }],
      ...options
    };

    return this.router.route(request);
  }

  /**
   * Stream a chat response
   */
  async *chatStream(message: string, options: Partial<AIRequest> = {}): AsyncGenerator<string> {
    const request: AIRequest = {
      messages: [{ role: 'user', content: message }],
      stream: true,
      ...options
    };

    const response = await this.router.route(request);
    if (response.stream) {
      yield* response.stream;
    } else {
      yield response.content || '';
    }
  }

  /**
   * Process vision tasks (image + text)
   */
  async vision(image: Buffer, prompt: string): Promise<AIResponse> {
    return this.router.routeVision(image, prompt);
  }

  /**
   * Generate code
   */
  async generateCode(prompt: string, language?: string): Promise<AIResponse> {
    return this.router.routeCode(prompt, language);
  }

  /**
   * Get available models
   */
  async getModels(): Promise<ModelInfo[]> {
    return this.providerManager.getAvailableModels();
  }

  /**
   * Get system health status
   */
  async getHealth(): Promise<any> {
    return this.healthMonitor.getStatus();
  }

  /**
   * Switch provider priority mode
   */
  setPriorityMode(mode: 'privacy-first' | 'performance' | 'cost-effective' | 'auto'): void {
    this.config.set('priority', mode);
    this.router.updatePriorityMode(mode);
  }

  /**
   * Get current configuration
   */
  getConfig(): any {
    return this.config.getAll();
  }

  /**
   * Close connections and cleanup
   */
  async close(): Promise<void> {
    await this.healthMonitor.stop();
    await this.providerManager.close();
  }
}