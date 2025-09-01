/**
 * Unified AI Provider Manager v2.0
 * Single source of truth for all AI provider management (Node 20+)
 */

import type {
  IUnifiedAIProvider,
  ProviderId,
  ProviderRequest,
  ProviderResponse,
  ProviderStream,
  ProviderHealth,
  ProviderManagerConfig,
} from "./config";
import { DEFAULT_PROVIDER, DEFAULT_MODEL } from "./config";
import { UnifiedBaseProvider } from "./base-provider";

/**
 * Manager
 */
export class UnifiedAIProviderManager {
  private readonly providers = new Map<ProviderId, IUnifiedAIProvider>();
  private readonly available = new Set<ProviderId>();
  private readonly healthCache = new Map<ProviderId, ProviderHealth>();

  private current?: ProviderId;
  private readonly cfg: Required<
    Pick<
      ProviderManagerConfig,
      "defaultProvider" | "fallbackProvider" | "healthCacheTtl" | "retryAttempts" | "timeout"
    >
  >;

  // Singleton instance
  private static instance: UnifiedAIProviderManager | null = null;

  constructor(config: ProviderManagerConfig = {}) {
    this.cfg = {
      defaultProvider: (config.defaultProvider as ProviderId) || (DEFAULT_PROVIDER as ProviderId),
      fallbackProvider: (config.fallbackProvider as ProviderId) || "openai",
      healthCacheTtl: config.healthCacheTtl ?? 30_000,
      retryAttempts: config.retryAttempts ?? 3,
      timeout: config.timeout ?? 30_000,
    };
    this.current = this.cfg.defaultProvider;
  }

  /** Get singleton instance */
  static getInstance(config: ProviderManagerConfig = {}): UnifiedAIProviderManager {
    if (!UnifiedAIProviderManager.instance) {
      UnifiedAIProviderManager.instance = new UnifiedAIProviderManager(config);
    }
    return UnifiedAIProviderManager.instance;
  }

  /** Reset singleton (for testing) */
  static resetInstance(): void {
    UnifiedAIProviderManager.instance = null;
  }

  /** Public bootstrap */
  async initialize(): Promise<void> {
    await this.initializeProviders();
    await this.refreshAvailability();
  }

  /** Register adapter */
  register(provider: IUnifiedAIProvider): void {
    this.providers.set(provider.id, provider);
  }

  getProvider(id: ProviderId): IUnifiedAIProvider | undefined {
    return this.providers.get(id);
  }

  /** Update the current/default provider */
  setCurrentProvider(id: ProviderId): void {
    // If providers haven't been initialized yet, just set the current provider
    // The validation will happen during initialization
    if (this.providers.size === 0) {
      this.current = id;
      return;
    }
    
    // If initialized, validate that the provider exists
    if (this.providers.has(id)) {
      this.current = id;
    } else {
      throw new Error(`Provider ${id} not found`);
    }
  }

  /** Get current provider ID */
  getCurrentProvider(): ProviderId | undefined {
    return this.current;
  }

  /** Active provider selection with health check + fallback */
  async pick(preferred?: ProviderId): Promise<IUnifiedAIProvider> {
    // 1) preferred
    if (preferred && this.providers.has(preferred)) {
      const p = this.providers.get(preferred)!;
      const h = await this.healthWithCache(preferred);
      if (h.ok) {
        this.current = preferred;
        return p;
      }
    }

    // 2) current
    if (this.current && this.providers.has(this.current)) {
      const p = this.providers.get(this.current)!;
      const h = await this.healthWithCache(this.current);
      if (h.ok) return p;
    }

    // 3) priority fallback
    const order: ProviderId[] = [
      "openai",
      "anthropic",
      "google",
      "grok",
      "ollama",
      "lmstudio",
      "vllm",
      "groq",
    ];

    for (const id of order) {
      if (!this.providers.has(id)) continue;
      const h = await this.healthWithCache(id);
      if (h.ok) {
        this.current = id;
        return this.providers.get(id)!;
      }
    }

    throw new Error("No healthy AI provider available");
  }

  /** Complete a prompt with current provider, fallback to configured fallback */
  async complete(req: {
    prompt: string;
    maxTokens?: number;
    temperature?: number;
    model?: string;
  }): Promise<string> {
    const provider = await this.pick(this.current || this.cfg.defaultProvider);

    const preq: ProviderRequest = {
      model: req.model || DEFAULT_MODEL,
      maxTokens: req.maxTokens ?? 2000,
      temperature: req.temperature ?? 0.7,
    };

    try {
      const r = await provider.complete(req.prompt, preq);
      return r.content;
    } catch (err: any) {
      // Show timeout errors differently
      if (err.message?.includes('⏱️')) {
        console.error(err.message);
      } else {
        console.error(`Provider ${provider.id} failed:`, err);
      }
      if (this.cfg.fallbackProvider && this.cfg.fallbackProvider !== provider.id) {
        const fb = await this.pick(this.cfg.fallbackProvider);
        const r = await fb.complete(req.prompt, preq);
        return r.content;
      }
      throw err;
    }
  }

  setActiveProvider(id: ProviderId): void {
    if (!this.providers.has(id)) throw new Error(`Provider ${id} not registered`);
    this.current = id;
  }

  getAvailableProviders(): ProviderId[] {
    return [...this.available];
  }

  /** Legacy sync method kept for backward compatibility (minimal) */
  getAvailableModels(): string[] {
    // Fast path for UI: declare commonly used models (accurate listは getAvailableModelsAsync 推奨)
    const out: string[] = [];
    if (this.available.has("openai")) out.push("gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo");
    if (this.available.has("anthropic")) out.push("claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022");
    if (this.available.has("google")) out.push("gemini-2.5-pro", "gemini-2.5-flash");
    if (this.available.has("grok")) out.push("grok-4", "grok-beta");
    return out;
  }

  /** Accurate async model listing for /model UI */
  async getAvailableModelsAsync(): Promise<Record<ProviderId, string[]>> {
    const result: Record<ProviderId, string[]> = {} as any;
    for (const [id, p] of this.providers) {
      const h = await this.healthWithCache(id);
      if (!h.ok) continue;
      try {
        result[id] = await p.getModels();
      } catch {
        result[id] = [];
      }
    }
    return result;
  }

  /** Aggregate provider health */
  async getProvidersHealth(): Promise<Record<ProviderId, ProviderHealth>> {
    const map: Record<ProviderId, ProviderHealth> = {} as any;
    await Promise.all(
      [...this.providers.entries()].map(async ([id, p]) => {
        try {
          map[id] = await p.health();
        } catch (e) {
          map[id] = { ok: false, reason: e instanceof Error ? e.message : "Unknown error", timestamp: Date.now() };
        }
      }),
    );
    return map;
  }

  async refreshAvailability(): Promise<void> {
    this.available.clear();
    this.healthCache.clear();

    await Promise.all(
      [...this.providers.entries()].map(async ([id, p]) => {
        try {
          const h = await p.health();
          this.healthCache.set(id, h);
          if (h.ok) this.available.add(id);
        } catch (e) {
          this.healthCache.set(id, {
            ok: false,
            reason: e instanceof Error ? e.message : "Health check failed",
            timestamp: Date.now(),
          });
        }
      }),
    );
  }

  /** Register adapters based on env keys (OpenAI is real, others placeholder but safe) */
  private async initializeProviders(): Promise<void> {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GOOGLE_AI_API_KEY;
    const GROK_API_KEY = process.env.GROK_API_KEY || process.env.XAI_API_KEY;

    if (OPENAI_API_KEY) this.register(new UnifiedOpenAIProvider(OPENAI_API_KEY));
    if (ANTHROPIC_API_KEY) this.register(new UnifiedAnthropicProvider(ANTHROPIC_API_KEY));
    if (GOOGLE_API_KEY) this.register(new UnifiedGoogleProvider(GOOGLE_API_KEY));
    if (GROK_API_KEY) this.register(new UnifiedGrokProvider(GROK_API_KEY));

    // Local LLM providers - always register (they check availability themselves)
    this.register(new UnifiedOllamaProvider());
    this.register(new UnifiedLMStudioProvider());
    this.register(new UnifiedVLLMProvider());
  }

  /** Cached health */
  private async healthWithCache(id: ProviderId): Promise<ProviderHealth> {
    const now = Date.now();
    const cached = this.healthCache.get(id);
    if (cached && now - (cached.timestamp ?? 0) < this.cfg.healthCacheTtl) return cached;

    const p = this.providers.get(id);
    if (!p) {
      const h = { ok: false, reason: "Provider not found", timestamp: now };
      this.healthCache.set(id, h);
      return h;
    }

    try {
      const h = await p.health();
      this.healthCache.set(id, h);
      return h;
    } catch (e) {
      const h = { ok: false, reason: e instanceof Error ? e.message : "Health check failed", timestamp: now };
      this.healthCache.set(id, h);
      return h;
    }
  }
}

/**
 * Legacy compatibility (minimal async-to-sync wrapper)
 */
class LegacyCompatibleProvider {
  constructor(private readonly p: IUnifiedAIProvider) {}

  get name(): string {
    return this.p.name;
  }

  async generateCompletion(req: {
    messages: Array<{ role: string; content: string }>;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<{ content: string; model?: string }> {
    const prompt = req.messages.map(m => `${m.role}: ${m.content}`).join("\n");
    const r = await this.p.complete(prompt, {
      model: req.model || DEFAULT_MODEL,
      temperature: req.temperature,
      maxTokens: req.maxTokens,
    });
    return { content: r.content, model: r.model };
  }

  async streamCompletion(
    req: {
      messages: Array<{ role: string; content: string }>;
      model?: string;
      temperature?: number;
      maxTokens?: number;
    },
    onChunk: (chunk: string) => void,
  ): Promise<{ content: string; model?: string }> {
    const prompt = req.messages.map(m => `${m.role}: ${m.content}`).join("\n");
    const stream = await this.p.stream(prompt, {
      model: req.model || DEFAULT_MODEL,
      temperature: req.temperature,
      maxTokens: req.maxTokens,
      stream: true,
    });
    let full = "";
    for await (const ch of stream) {
      full += ch.content;
      onChunk(ch.content);
    }
    return { content: full, model: req.model };
  }

  isAvailable(): boolean {
    return true;
  }
  getAvailableModels(): string[] {
    return [];
  }
}

/* -------------------------
 * Provider adapters (OpenAI = real)
 * ------------------------ */

class UnifiedOpenAIProvider extends UnifiedBaseProvider {
  id = "openai" as const;
  name = "OpenAI";

  constructor(apiKey: string) {
    super({ apiKey });
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async health(): Promise<ProviderHealth> {
    // 軽いヘルス: APIキーだけでOK（将来は /models 叩いても良い）
    return { ok: !!this.apiKey, timestamp: Date.now() };
  }

  async complete(prompt: string, req: ProviderRequest): Promise<ProviderResponse> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OpenAI API key not configured");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300_000); // 300 seconds (5 minutes) for long responses

    const modelName = req.model || "gpt-5-mini-2025-08-07";
    const isGPT5 = modelName.includes("gpt-5");
    
    const bodyParams: any = {
      model: modelName,
      messages: [
        { role: "system", content: "You are a helpful assistant. Provide direct, clear answers without menus or numbered options." },
        { role: "user", content: prompt },
      ],
    };

    // GPT-5 models have special requirements
    if (isGPT5) {
      // GPT-5 only supports temperature=1.0 (don't send it)
      // Use max_completion_tokens instead of max_tokens
      bodyParams.max_completion_tokens = req.maxTokens ?? 32000;
    } else {
      // Non-GPT-5 models use standard parameters
      bodyParams.temperature = req.temperature ?? 0.7;
      bodyParams.max_tokens = req.maxTokens ?? 2000;
    }

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(bodyParams),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`OpenAI ${res.status}: ${txt}`);
      }
      const json: any = await res.json();
      return { content: json.choices?.[0]?.message?.content ?? "" };
    } catch (error: any) {
      clearTimeout(timeout);
      
      // Check if it's a timeout error
      if (error.name === 'AbortError' || error.message?.includes('abort')) {
        throw new Error('⏱️ Response timeout - The AI needs more time for this request. Please try a shorter question or wait a moment and try again.');
      }
      
      // Re-throw other errors
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async stream(_prompt: string, _req: ProviderRequest): Promise<ProviderStream> {
    // TODO: implement SSE streaming against /chat/completions?stream=true
    async function* g() {
      // minimal stub
      yield { content: "" };
    }
    return g();
  }

  async getModels(): Promise<string[]> {
    // Updated model list including GPT-5 series
    return [
      "gpt-5",
      "gpt-5-mini", 
      "gpt-5-mini-2025-08-07",
      "gpt-4o",
      "gpt-4o-mini"
    ];
  }
}

class UnifiedAnthropicProvider extends UnifiedBaseProvider {
  id = "anthropic" as const;
  name = "Anthropic";
  constructor(apiKey: string) {
    super({ apiKey });
  }
  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }
  async health(): Promise<ProviderHealth> {
    return { ok: !!this.apiKey, timestamp: Date.now() };
  }
  async complete(prompt: string, req: ProviderRequest): Promise<ProviderResponse> {
    // TODO: Implement real Claude API call
    return { content: `Anthropic (stub) → ${prompt.slice(0, 60)}` };
  }
  async stream(prompt: string, req: ProviderRequest): Promise<ProviderStream> {
    async function* g() {
      yield { content: `Anthropic streaming (stub) → ${prompt.slice(0, 40)}` };
    }
    return g();
  }
  async getModels(): Promise<string[]> {
    return [
      "claude-opus-4-1-20250805",
      "claude-opus-4-20250514",
      "claude-sonnet-4-20250514"
    ];
  }
}

class UnifiedGoogleProvider extends UnifiedBaseProvider {
  id = "google" as const;
  name = "Google AI";
  constructor(apiKey: string) {
    super({ apiKey });
  }
  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }
  async health(): Promise<ProviderHealth> {
    return { ok: !!this.apiKey, timestamp: Date.now() };
  }
  async complete(prompt: string, req: ProviderRequest): Promise<ProviderResponse> {
    return { content: `Google (stub) → ${prompt.slice(0, 60)}` };
  }
  async stream(prompt: string, req: ProviderRequest): Promise<ProviderStream> {
    async function* g() {
      yield { content: `Google streaming (stub) → ${prompt.slice(0, 40)}` };
    }
    return g();
  }
  async getModels(): Promise<string[]> {
    return [
      "gemini-2.5-pro",
      "gemini-2.5-flash", 
      "gemini-2.5-flash-image-preview",
      "gemini-2.5-flash-lite"
    ];
  }
}

class UnifiedGrokProvider extends UnifiedBaseProvider {
  id = "grok" as const;
  name = "xAI Grok";
  constructor(apiKey: string) {
    super({ apiKey });
  }
  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }
  async health(): Promise<ProviderHealth> {
    return { ok: !!this.apiKey, timestamp: Date.now() };
  }
  async complete(prompt: string, req: ProviderRequest): Promise<ProviderResponse> {
    return { content: `Grok (stub) → ${prompt.slice(0, 60)}` };
  }
  async stream(prompt: string, req: ProviderRequest): Promise<ProviderStream> {
    async function* g() {
      yield { content: `Grok streaming (stub) → ${prompt.slice(0, 40)}` };
    }
    return g();
  }
  async getModels(): Promise<string[]> {
    return ["grok-4", "grok-beta"];
  }
}

// Local LLM Providers
class UnifiedOllamaProvider extends UnifiedBaseProvider {
  id = "ollama" as const;
  name = "Ollama";
  constructor() {
    super({ apiKey: "local" }); // No API key needed for local
  }
  async isAvailable(): Promise<boolean> {
    // Check if Ollama is running locally
    try {
      const response = await fetch("http://localhost:11434/api/tags");
      return response.ok;
    } catch {
      return false;
    }
  }
  async health(): Promise<ProviderHealth> {
    const available = await this.isAvailable();
    return { ok: available, timestamp: Date.now(), reason: available ? undefined : "Ollama not running" };
  }
  async complete(prompt: string, req: ProviderRequest): Promise<ProviderResponse> {
    // TODO: Implement real Ollama API call
    return { content: `Ollama (local) → ${prompt.slice(0, 60)}` };
  }
  async stream(prompt: string, req: ProviderRequest): Promise<ProviderStream> {
    async function* g() {
      yield { content: `Ollama streaming (local) → ${prompt.slice(0, 40)}` };
    }
    return g();
  }
  async getModels(): Promise<string[]> {
    try {
      const response = await fetch("http://localhost:11434/api/tags");
      if (response.ok) {
        const data = await response.json();
        return data.models?.map((m: any) => m.name) || ["llama3.2", "mistral", "codellama"];
      }
    } catch {
      // Fallback models
    }
    return ["llama3.2", "mistral", "codellama", "phi3", "gemma2"];
  }
}

class UnifiedLMStudioProvider extends UnifiedBaseProvider {
  id = "lmstudio" as const;
  name = "LM Studio";
  constructor() {
    super({ apiKey: "local" });
  }
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch("http://localhost:1234/v1/models");
      return response.ok;
    } catch {
      return false;
    }
  }
  async health(): Promise<ProviderHealth> {
    const available = await this.isAvailable();
    return { ok: available, timestamp: Date.now(), reason: available ? undefined : "LM Studio not running" };
  }
  async complete(prompt: string, req: ProviderRequest): Promise<ProviderResponse> {
    return { content: `LM Studio (local) → ${prompt.slice(0, 60)}` };
  }
  async stream(prompt: string, req: ProviderRequest): Promise<ProviderStream> {
    async function* g() {
      yield { content: `LM Studio streaming (local) → ${prompt.slice(0, 40)}` };
    }
    return g();
  }
  async getModels(): Promise<string[]> {
    try {
      const response = await fetch("http://localhost:1234/v1/models");
      if (response.ok) {
        const data = await response.json();
        return data.data?.map((m: any) => m.id) || ["qwen3-30b", "mistral-7b-instruct", "gpt-oss-120b", "gpt-oss-20b"];
      }
    } catch {
      // Fallback to known models from screenshot
    }
    return ["qwen3-30b", "mistral-7b-instruct-v0.3", "gpt-oss-120b", "gpt-oss-20b"];
  }
}

class UnifiedVLLMProvider extends UnifiedBaseProvider {
  id = "vllm" as const;
  name = "vLLM";
  constructor() {
    super({ apiKey: "local" });
  }
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch("http://localhost:8000/v1/models");
      return response.ok;
    } catch {
      return false;
    }
  }
  async health(): Promise<ProviderHealth> {
    const available = await this.isAvailable();
    return { ok: available, timestamp: Date.now(), reason: available ? undefined : "vLLM not running" };
  }
  async complete(prompt: string, req: ProviderRequest): Promise<ProviderResponse> {
    return { content: `vLLM (local) → ${prompt.slice(0, 60)}` };
  }
  async stream(prompt: string, req: ProviderRequest): Promise<ProviderStream> {
    async function* g() {
      yield { content: `vLLM streaming (local) → ${prompt.slice(0, 40)}` };
    }
    return g();
  }
  async getModels(): Promise<string[]> {
    try {
      const response = await fetch("http://localhost:8000/v1/models");
      if (response.ok) {
        const data = await response.json();
        return data.data?.map((m: any) => m.id) || ["vllm-model"];
      }
    } catch {
      // Fallback
    }
    return ["vllm-model", "high-performance-model"];
  }
}

/** Dual export kept by index.ts */
export { UnifiedAIProviderManager as AIProviderManager };
export default UnifiedAIProviderManager;