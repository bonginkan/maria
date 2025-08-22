/**
 * MARIA AI - Core AI Assistant class
 * Handles provider management and intelligent routing
 */

import { AIRequest, AIResponse, ModelInfo } from './types';
import { AIProviderManager } from './providers/manager';
import { IntelligentRouter } from './services/intelligent-router';
import { HealthMonitor } from './services/health-monitor';
import { ConfigManager } from './config/config-manager';
import { DualMemoryEngine } from './services/memory-system/dual-memory-engine';
import { MemoryCoordinator } from './services/memory-system/memory-coordinator';

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
  private memoryEngine: DualMemoryEngine | null = null;
  private memoryCoordinator: MemoryCoordinator | null = null;
  private isInitialized: boolean = false;

  constructor(config: MariaAIConfig = {}) {
    this.config = new ConfigManager(config);
    this.providerManager = new AIProviderManager(this.config);
    this.router = new IntelligentRouter(this.providerManager, this.config);
    this.healthMonitor = new HealthMonitor();

    if (config.autoStart !== false) {
      this.initialize();
    }
  }

  // Memory system setter for interactive session
  setMemorySystem(memoryEngine: DualMemoryEngine, memoryCoordinator: MemoryCoordinator): void {
    this.memoryEngine = memoryEngine;
    this.memoryCoordinator = memoryCoordinator;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return; // Already initialized
    }

    await this.providerManager.initialize();

    if (this.config.get('healthMonitoring', true)) {
      this.healthMonitor.start();
    }

    this.isInitialized = true;
  }

  /**
   * Send a chat message and get AI response
   */
  async chat(message: string, options: Partial<AIRequest> = {}): Promise<AIResponse> {
    const request: AIRequest = {
      messages: [{ role: 'user', content: message }],
      ...options,
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
      ...options,
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
   * Generate code with memory context
   */
  async generateCode(prompt: string, language?: string): Promise<AIResponse> {
    // Enhance prompt with memory context if available
    let enhancedPrompt = prompt;
    
    if (this.memoryEngine && this.memoryCoordinator) {
      try {
        // Get relevant code patterns and user preferences from memory
        const context = await this.memoryEngine.getContext({
          query: prompt,
          type: 'code_generation',
          language: language
        });
        
        if (context.codePatterns?.length > 0) {
          enhancedPrompt = `${prompt}\n\nContext from memory:\n`;
          enhancedPrompt += `Previous patterns: ${context.codePatterns.slice(0, 3).map(p => p.pattern).join(', ')}\n`;
        }
        
        if (context.userPreferences) {
          enhancedPrompt += `User preferences: ${JSON.stringify(context.userPreferences)}\n`;
        }
        
        // Store the interaction in memory for future reference
        await this.memoryEngine.storeInteraction({
          type: 'code_generation',
          input: prompt,
          language: language,
          timestamp: new Date()
        });
      } catch (error) {
        console.warn('Memory context enhancement failed:', error);
      }
    }
    
    return this.router.routeCode(enhancedPrompt, language);
  }

  /**
   * Get available models
   */
  async getModels(): Promise<ModelInfo[]> {
    // Ensure provider manager is initialized
    if (!this.isInitialized) {
      await this.initialize();
    }
    return this.providerManager.getAvailableModels();
  }

  /**
   * Get system health status
   */
  async getHealth(): Promise<unknown> {
    return this.healthMonitor.getSystemHealth();
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
  getConfig(): unknown {
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
