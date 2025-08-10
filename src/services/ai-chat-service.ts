// Migration: Using new AI provider system instead of @maria/ai-agents
import { 
  IAIProvider, 
  Message as AIMessage, 
  AIProviderRegistry,
  registerAllProviders,
  initializeProvider,
  getProviderConfigFromEnv
} from '../providers/index.js';
import { getAIProviderConfig } from '../providers/config.js';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ChatContext {
  sessionId: string;
  projectRoot: string;
  mode: 'chat' | 'research' | 'creative' | 'command';
  history: ChatMessage[];
}

export class AIChatService {
  private provider: IAIProvider | null = null;
  private currentModel: string | null = null;
  private initialized = false;
  // private isOfflineMode = false; // Currently unused

  constructor() {
    this.initializeServices();
  }

  private async initializeServices() {
    try {
      // Check for offline mode first (currently unused)
      // this.isOfflineMode = process.env.OFFLINE_MODE === 'true';
      
      // Register all providers
      registerAllProviders();

      // Try to get configuration
      let config = await getAIProviderConfig();
      if (!config) {
        config = getProviderConfigFromEnv();
      }
      
      if (config) {
        try {
          await initializeProvider(config);
          this.provider = AIProviderRegistry.get(config.provider) || null;
          if (this.provider) {
            this.currentModel = config.model || this.provider.getDefaultModel();
            this.initialized = true;
            console.log(`✅ AI provider initialized: ${config.provider} (${this.currentModel})`);
            return;
          }
        } catch (error) {
          console.warn(`Failed to initialize preferred provider ${config.provider}:`, error);
        }
      }

      // Auto-detect and initialize any available provider
      const allProviders = AIProviderRegistry.getAll();
      
      // Try local providers first for privacy
      const localProviders = allProviders.filter(p => 
        ['lmstudio', 'vllm', 'ollama'].includes(p.name.toLowerCase())
      );
      
      for (const provider of localProviders) {
        try {
          const defaultConfig = this.getDefaultConfigForProvider(provider.name);
          if (defaultConfig) {
            await provider.initialize(defaultConfig.apiKey, defaultConfig.config);
            if (await this.testProvider(provider)) {
              this.provider = provider;
              this.currentModel = provider.getDefaultModel();
              this.initialized = true;
              console.log(`✅ Auto-selected local AI provider: ${provider.name}`);
              return;
            }
          }
        } catch (error) {
          console.debug(`Local provider ${provider.name} not available:`, error);
        }
      }

      // Try cloud providers if no local ones work
      const cloudProviders = allProviders.filter(p => 
        !['lmstudio', 'vllm', 'ollama'].includes(p.name.toLowerCase())
      );
      
      for (const provider of cloudProviders) {
        try {
          const defaultConfig = this.getDefaultConfigForProvider(provider.name);
          if (defaultConfig) {
            await provider.initialize(defaultConfig.apiKey, defaultConfig.config);
            this.provider = provider;
            this.currentModel = provider.getDefaultModel();
            this.initialized = true;
            console.log(`✅ Auto-selected cloud AI provider: ${provider.name}`);
            return;
          }
        } catch (error) {
          console.debug(`Cloud provider ${provider.name} not available:`, error);
        }
      }

      console.warn('⚠️ No AI providers available. Please configure API keys or start local models.');
    } catch (error) {
      console.warn('Failed to initialize AI services:', error);
    }
  }

  private getDefaultConfigForProvider(providerName: string): { apiKey: string; config?: Record<string, any> } | null {
    switch (providerName.toLowerCase()) {
      case 'lmstudio':
        return { apiKey: 'lm-studio' };
      case 'vllm':
        return { apiKey: 'vllm-local' };
      case 'ollama':
        return { apiKey: 'ollama' };
      case 'openai':
        return process.env.OPENAI_API_KEY ? { apiKey: process.env.OPENAI_API_KEY } : null;
      case 'anthropic':
        return process.env.ANTHROPIC_API_KEY ? { apiKey: process.env.ANTHROPIC_API_KEY } : null;
      case 'googleai':
        const googleKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
        return googleKey ? { apiKey: googleKey } : null;
      case 'grok':
        return process.env.GROK_API_KEY ? { apiKey: process.env.GROK_API_KEY } : null;
      default:
        return null;
    }
  }

  private async testProvider(provider: IAIProvider): Promise<boolean> {
    try {
      // Test with a simple message
      await provider.chat([{ role: 'user', content: 'Hi' }], undefined, { maxTokens: 1 });
      return true;
    } catch {
      return false;
    }
  }

  async processMessage(
    message: string, 
    context: ChatContext
  ): Promise<ChatMessage> {
    try {
      // Check if this is a request for SOW or architecture design
      const isSOWRequest = this.isSOWRequest(message);
      const isArchitectureRequest = this.isArchitectureRequest(message);

      if (isSOWRequest) {
        // Generate SOW using AI provider
        return await this.generateSOWResponse(message, context);
      } else if (isArchitectureRequest) {
        // Generate architecture/design response
        return await this.generateArchitectureResponse(message, context);
      } else {
        // Use regular chat for other requests
        return await this.generateChatResponse(message, context);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      return {
        role: 'assistant',
        content: 'I apologize, but I encountered an error processing your request. Please try again or rephrase your question.',
        timestamp: new Date(),
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  private isSOWRequest(message: string): boolean {
    const sowKeywords = ['sow', 'statement of work', 'project plan', 'proposal', 'estimate', 'timeline', 'deliverables'];
    const lowerMessage = message.toLowerCase();
    return sowKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  private isArchitectureRequest(message: string): boolean {
    const archKeywords = ['architecture', 'design', 'system design', 'technical design', 'implementation', 'structure', 'component', 'diagram'];
    const lowerMessage = message.toLowerCase();
    return archKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  private async generateSOWResponse(
    message: string, 
    context: ChatContext
  ): Promise<ChatMessage> {
    if (!this.provider || !this.initialized) {
      await this.initializeServices();
      if (!this.provider) {
        throw new Error('AI provider not initialized');
      }
    }

    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `You are an expert project manager. Generate a detailed Statement of Work (SOW) with:
        - Clear project overview and objectives
        - Detailed deliverables with acceptance criteria
        - Realistic timeline with phases
        - Resource requirements and budget estimates
        - Risk assessment and mitigation strategies
        Format as a professional SOW document.`
      },
      ...context.history.slice(-5).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

    const response = await this.provider.chat(messages, this.currentModel || undefined, {
      temperature: 0.7,
      maxTokens: 4000
    });

    return {
      role: 'assistant',
      content: response,
      timestamp: new Date(),
      metadata: { 
        type: 'sow',
        provider: this.provider.name,
        model: this.currentModel
      }
    };
  }

  private async generateArchitectureResponse(
    message: string, 
    context: ChatContext
  ): Promise<ChatMessage> {
    if (!this.provider || !this.initialized) {
      await this.initializeServices();
      if (!this.provider) {
        throw new Error('AI provider not initialized');
      }
    }

    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `You are an expert software architect and system designer. 
        Provide detailed technical designs, architecture diagrams (in text/ASCII art), 
        component breakdowns, technology recommendations, and implementation guidelines.
        Be specific about technologies, frameworks, and best practices.`
      },
      ...context.history.slice(-5).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

    const response = await this.provider.chat(messages, this.currentModel || undefined, {
      temperature: 0.7,
      maxTokens: 4000
    });

    return {
      role: 'assistant',
      content: response,
      timestamp: new Date(),
      metadata: { 
        type: 'architecture',
        provider: this.provider.name,
        model: this.currentModel 
      }
    };
  }

  private async generateChatResponse(
    message: string, 
    context: ChatContext
  ): Promise<ChatMessage> {
    if (!this.provider || !this.initialized) {
      await this.initializeServices();
      if (!this.provider) {
        throw new Error('AI provider not initialized');
      }
    }

    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `You are MARIA CODE, an advanced AI development assistant. 
        You help with coding, debugging, architecture design, and software development tasks.
        Provide helpful, accurate, and detailed responses.
        When appropriate, include code examples, best practices, and step-by-step guidance.`
      },
      ...context.history.slice(-10).map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

    const temperature = context.mode === 'creative' ? 0.9 : context.mode === 'research' ? 0.5 : 0.7;

    const response = await this.provider.chat(messages, this.currentModel || undefined, {
      temperature,
      maxTokens: 2000
    });

    return {
      role: 'assistant',
      content: response,
      timestamp: new Date(),
      metadata: { 
        provider: this.provider.name,
        model: this.currentModel
      }
    };
  }

  // Add method to switch providers at runtime
  async switchProvider(providerName: string, model?: string): Promise<void> {
    const provider = AIProviderRegistry.get(providerName);
    if (!provider) {
      throw new Error(`Provider ${providerName} not found`);
    }

    if (!provider.isInitialized()) {
      const config = await getAIProviderConfig();
      if (!config || config.provider !== providerName) {
        throw new Error(`Provider ${providerName} is not configured`);
      }
      await initializeProvider(config);
    }

    this.provider = provider;
    this.currentModel = model || provider.getDefaultModel();
  }

  // Add method to get current provider info
  getProviderInfo(): { provider: string; model: string } | null {
    if (!this.provider) return null;
    return {
      provider: this.provider.name,
      model: this.currentModel || this.provider.getDefaultModel()
    };
  }

  // @ts-ignore - Used in future features  
  private _formatSOWResponse(sow: any): string { // Legacy method - used in future features
    return `# Statement of Work: ${sow.title}

## Overview
${sow.description}

## Scope
${sow.scope.overview}

### Objectives
${sow.scope.objectives.map((obj: string) => `- ${obj}`).join('\n')}

## Deliverables
${sow.deliverables.map((d: any) => `
### ${d.name}
- **Description**: ${d.description}
- **Priority**: ${d.priority}
- **Estimated Effort**: ${d.estimatedEffort.expected} hours
- **Acceptance Criteria**:
${d.acceptanceCriteria.map((ac: string) => `  - ${ac}`).join('\n')}
`).join('\n')}

## Timeline
- **Start Date**: ${new Date(sow.timeline.startDate).toLocaleDateString()}
- **End Date**: ${new Date(sow.timeline.endDate).toLocaleDateString()}
- **Total Duration**: ${sow.timeline.totalDuration}

### Project Phases
${sow.timeline.phases.map((phase: any) => `
#### ${phase.name}
- ${phase.description}
- Duration: ${new Date(phase.startDate).toLocaleDateString()} - ${new Date(phase.endDate).toLocaleDateString()}
`).join('\n')}

## Resource Requirements
### Human Resources
${sow.resources.humanResources.map((hr: any) => `
- **${hr.role}**
  - Skills: ${hr.skillsRequired.join(', ')}
  - Effort: ${hr.effortRequired.expected} hours
  - Availability: ${hr.availability}
`).join('\n')}

## Budget Estimate
- **Total Cost**: $${sow.budget.totalCost.toLocaleString()} ${sow.budget.currency}
- **Risk Buffer**: ${sow.budget.riskBuffer}%

## Risk Assessment
- **Overall Risk Level**: ${sow.riskAssessment.overallRiskLevel}

### Key Risks
${sow.riskAssessment.risks.slice(0, 3).map((risk: any) => `
- **${risk.description}**
  - Category: ${risk.category}
  - Probability: ${(risk.probability * 100).toFixed(0)}%
  - Impact: ${(risk.impact * 100).toFixed(0)}%
`).join('\n')}

## Success Criteria
${sow.successCriteria.map((sc: any) => `- ${sc.description}`).join('\n')}

---
*This SOW was generated by MARIA CODE AI. Please review and adjust as needed for your specific requirements.*`;
  }
}