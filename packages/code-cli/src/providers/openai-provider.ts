import OpenAI from 'openai';
import { BaseAIProvider, Message, CompletionOptions, CodeReviewResult } from './ai-provider.js';

export class OpenAIProvider extends BaseAIProvider {
  readonly name = 'OpenAI';
  readonly models = [
    'gpt-5-2025-08-07',
    'gpt-5-mini-2025-08-07',
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo',
    'o1-preview',
    'o1-mini'
  ];
  
  // Reasoning models that don't support temperature
  private readonly reasoningModels = [
    'gpt-5-2025-08-07',
    'gpt-5-mini-2025-08-07',
    'o1-preview',
    'o1-mini'
  ];
  
  private client?: OpenAI;
  
  /**
   * Check if a model is a reasoning model that doesn't support temperature
   */
  private isReasoningModel(model?: string): boolean {
    if (!model) return false;
    return this.reasoningModels.includes(model);
  }
  
  /**
   * Check if a model is a GPT-5 model that supports new parameters
   */
  private isGPT5Model(model?: string): boolean {
    if (!model) return false;
    return model.startsWith('gpt-5');
  }
  
  async initialize(apiKey: string, config?: Record<string, any>): Promise<void> {
    await super.initialize(apiKey, config);
    
    this.client = new OpenAI({
      apiKey: this.apiKey,
      baseURL: config?.baseURL,
      organization: config?.organization,
      maxRetries: config?.maxRetries || 3,
    });
  }
  
  async chat(messages: Message[], model?: string, options?: CompletionOptions): Promise<string> {
    this.ensureInitialized();
    const selectedModel = this.validateModel(model);
    const isReasoningModel = this.isReasoningModel(selectedModel);
    
    const params: any = {
      model: selectedModel,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      max_tokens: options?.maxTokens,
      stop: options?.stopSequences,
    };
    
    // Only add temperature for non-reasoning models
    if (!isReasoningModel) {
      params.temperature = options?.temperature || 0.7;
      params.top_p = options?.topP;
    }
    
    // Add GPT-5 specific parameters
    if (this.isGPT5Model(selectedModel)) {
      if (options?.reasoningEffort) {
        params.reasoning_effort = options.reasoningEffort;
      }
      if (options?.verbosity) {
        params.verbosity = options.verbosity;
      }
      // Use max_completion_tokens instead of max_tokens for reasoning models
      if (options?.maxTokens) {
        params.max_completion_tokens = options.maxTokens;
        delete params.max_tokens;
      }
    }
    
    const completion = await this.client!.chat.completions.create(params);
    
    return completion.choices[0]?.message?.content || '';
  }
  
  async *chatStream(messages: Message[], model?: string, options?: CompletionOptions): AsyncGenerator<string> {
    this.ensureInitialized();
    const selectedModel = this.validateModel(model);
    const isReasoningModel = this.isReasoningModel(selectedModel);
    
    const params: any = {
      model: selectedModel,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      max_tokens: options?.maxTokens,
      stop: options?.stopSequences,
      stream: true,
    };
    
    // Only add temperature for non-reasoning models
    if (!isReasoningModel) {
      params.temperature = options?.temperature || 0.7;
      params.top_p = options?.topP;
    }
    
    // Add GPT-5 specific parameters
    if (this.isGPT5Model(selectedModel)) {
      if (options?.reasoningEffort) {
        params.reasoning_effort = options.reasoningEffort;
      }
      if (options?.verbosity) {
        params.verbosity = options.verbosity;
      }
      // Use max_completion_tokens instead of max_tokens for reasoning models
      if (options?.maxTokens) {
        params.max_completion_tokens = options.maxTokens;
        delete params.max_tokens;
      }
    }
    
    const stream = await this.client!.chat.completions.create(params) as any;
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
        if (options?.streamOptions?.onToken) {
          options.streamOptions.onToken(content);
        }
      }
      
      // Check for abort signal
      if (options?.streamOptions?.signal?.aborted) {
        break;
      }
    }
  }
  
  async generateCode(prompt: string, language: string = 'typescript', model?: string): Promise<string> {
    const messages: Message[] = [
      {
        role: 'system',
        content: `You are an expert ${language} developer. Generate clean, well-commented code based on the user's request. Only return the code without any explanations or markdown formatting.`
      },
      {
        role: 'user',
        content: prompt
      }
    ];
    
    return this.chat(messages, model, { temperature: this.isReasoningModel(model) ? undefined : 0.2 });
  }
  
  async reviewCode(code: string, language: string = 'typescript', model?: string): Promise<CodeReviewResult> {
    const messages: Message[] = [
      {
        role: 'system',
        content: `You are an expert code reviewer. Analyze the following ${language} code and provide a detailed review. Format your response as JSON with the following structure:
{
  "issues": [
    {
      "line": <line_number>,
      "severity": "error" | "warning" | "info",
      "message": "<issue description>",
      "suggestion": "<optional fix suggestion>"
    }
  ],
  "summary": "<overall code quality summary>",
  "improvements": ["<improvement suggestion 1>", "<improvement suggestion 2>", ...]
}`
      },
      {
        role: 'user',
        content: code
      }
    ];
    
    const response = await this.chat(messages, model, { temperature: this.isReasoningModel(model) ? undefined : 0.1 });
    
    try {
      return JSON.parse(response);
    } catch {
      // Fallback if JSON parsing fails
      return {
        issues: [],
        summary: response,
        improvements: []
      };
    }
  }
}