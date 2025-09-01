/**
 * Groq Provider Implementation (Fast Inference)
 */

import { BaseProvider } from "./base-provider";
import { AIRequest, AIResponse, ModelInfo } from "../types";

export class GroqProvider extends BaseProvider {
  name = "groq";
  private modelsCache?: ModelInfo[];

  constructor(apiKey?: string) {
    super({
      apiKey,
      apiBase: "https://api.groq.com/openai/v1",
    });
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey || this.apiKey.startsWith("gsk_your-groq-")) {
      return false;
    }

    try {
      await this.makeRequest(`${this.apiBase}/models`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  async getModels(): Promise<ModelInfo[]> {
    if (this.modelsCache) {
      return this.modelsCache;
    }

    const models: ModelInfo[] = [
      {
        id: "llama-3.3-70b-versatile",
        name: "Llama 3.3 70B",
        provider: this.name,
        description: "Most capable Llama _model with versatile performance",
        contextLength: 32768,
        capabilities: ["text", "reasoning", "code"],
        _pricing: { input: 0.00059, output: 0.00079 },
        available: await this.isAvailable(),
        recommendedFor: ["complex_reasoning", "coding", "analysis"],
      },
      {
        id: "llama-3.2-90b-vision-preview",
        name: "Llama 3.2 90B Vision",
        provider: this.name,
        description: "Vision-capable Llama _model for multimodal tasks",
        contextLength: 128000,
        capabilities: ["text", "vision", "reasoning"],
        _pricing: { input: 0.0009, output: 0.0009 },
        available: await this.isAvailable(),
        recommendedFor: ["vision_tasks", "multimodal", "analysis"],
      },
      {
        id: "mixtral-8x7b-32768",
        name: "Mixtral 8x7B",
        provider: this.name,
        description: "Mixture of experts _model for balanced performance",
        contextLength: 32768,
        capabilities: ["text", "reasoning", "code"],
        _pricing: { input: 0.00024, output: 0.00024 },
        available: await this.isAvailable(),
        recommendedFor: ["balanced_performance", "multilingual"],
      },
      {
        id: "gemma2-9b-it",
        name: "Gemma 2 9B",
        provider: this.name,
        description: "Google's efficient open _model",
        contextLength: 8192,
        capabilities: ["text", "reasoning"],
        _pricing: { input: 0.0002, output: 0.0002 },
        available: await this.isAvailable(),
        recommendedFor: ["quick_tasks", "cost_effective"],
      },
    ];

    this.modelsCache = models;
    return models;
  }

  async chat(request: AIRequest): Promise<AIResponse> {
    if (!(await this.isAvailable())) {
      throw new Error("Groq API not available");
    }

    const _model = request._model || "mixtral-8x7b-32768";
    const _startTime = Date.now();

    const _payload = {
      _model,
      messages: request.messages,
      temperature: request.temperature || 0.7,
      maxtokens: request.maxTokens || 4000,
      _stream: request._stream || false,
    };

    if (request._stream) {
      const _stream = await this.makeStreamRequest(
        `${this.apiBase}/chat/completions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(_payload),
        },
      );

      return {
        _stream,
        _model,
        provider: this.name,
        responseTime: Date.now() - _startTime,
      };
    }

    const _response = (await this.makeRequest(
      `${this.apiBase}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(_payload),
      },
    )) as {
      choices: Array<{ message?: { content?: string } }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };

    return {
      content: _response.choices[0]?.message?.content || "",
      _model,
      provider: this.name,
      usage: {
        promptTokens: _response.usage?.prompt_tokens || 0,
        completionTokens: _response.usage?.completion_tokens || 0,
        totalTokens: _response.usage?.total_tokens || 0,
      },
      responseTime: Date.now() - _startTime,
    };
  }

  override async vision(_image: Buffer, prompt: string): Promise<AIResponse> {
    if (!(await this.isAvailable())) {
      throw new Error("Groq API not available");
    }

    const _base64Image = _image.toString("base64");
    const _startTime = Date.now();

    const _payload = {
      _model: "llama-3.2-90b-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              imageurl: {
                url: `data:image/jpeg;base64,${_base64Image}`,
              },
            },
          ],
        },
      ],
      maxtokens: 4000,
    };

    const _response = (await this.makeRequest(
      `${this.apiBase}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(_payload),
      },
    )) as {
      choices: Array<{ message?: { content?: string } }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };

    return {
      content: _response.choices[0]?.message?.content || "",
      _model: "llama-3.2-90b-vision-preview",
      provider: this.name,
      usage: {
        promptTokens: _response.usage?.prompt_tokens || 0,
        completionTokens: _response.usage?.completion_tokens || 0,
        totalTokens: _response.usage?.total_tokens || 0,
      },
      responseTime: Date.now() - _startTime,
    };
  }

  override estimateCost(
    _tokens: number,
    _model = "mixtral-8x7b-32768",
  ): number {
    const _pricing = {
      "llama-3.3-70b-versatile": { input: 0.00059, output: 0.00079 },
      "llama-3.2-90b-vision-preview": { input: 0.0009, output: 0.0009 },
      "mixtral-8x7b-32768": { input: 0.00024, output: 0.00024 },
      "gemma2-9b-it": { input: 0.0002, output: 0.0002 },
    };

    const _modelPricing =
      _pricing[_model as keyof typeof _pricing] ||
      _pricing["mixtral-8x7b-32768"];
    return (
      _tokens * 0.75 * _modelPricing.input +
      _tokens * 0.25 * _modelPricing.output
    );
  }
}
