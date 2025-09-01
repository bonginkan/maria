/**
 * FastCodeGenerator - High-speed code generation with templates and caching
 * Achieves 1-2 second response times through intelligent optimization
 */

import { TemplateManager } from "./TemplateManager";
import { PromptCache } from "./PromptCache";
import {
  StreamingRenderer,
  UIPort,
  CompletionChunk,
} from "./StreamingRenderer";
import { BackpressureController } from "./BackpressureController";
// Use UnifiedAIProviderManager instead of ProviderHub
import { getProviderManager } from "../../providers/index";
import { createHash } from "crypto";

export interface GenerationOptions {
  prompt: string;
  signal?: AbortSignal;
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
  ui?: UIPort;
  twoPass?: boolean; // Enable 2-pass generation
}

export type StackType = 
  | 'html-game'
  | 'nextjs-app'
  | 'nextjs-pages'
  | 'typescript'
  | 'python-script'
  | 'python-api'
  | 'node-express'
  | 'react'
  | 'general';

export interface GenerationMetrics {
  type: "template_hit" | "cache_hit" | "generated";
  prompt: string;
  model?: string;
  duration: number;
  tokenCount?: number;
  firstTokenMs?: number;
  throughputTokensPerSec?: number;
}

/**
 * Fast code generator with multiple optimization layers
 */
export class FastCodeGenerator {
  private templateManager: TemplateManager;
  private cache: PromptCache;
  private providerHub: ReturnType<typeof getProviderManager>;
  private metrics: GenerationMetrics[] = [];
  private streamingRenderer: StreamingRenderer | null = null;
  private backpressureController: BackpressureController | null = null;

  constructor(providerHub?: ReturnType<typeof getProviderManager>) {
    this.templateManager = new TemplateManager();
    this.cache = new PromptCache();
    this.providerHub = providerHub || getProviderManager();
  }
  
  /**
   * Helper method to chunk response for simulated streaming
   */
  private chunkResponse(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    const words = text.split(' ');
    
    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(words.slice(i, i + chunkSize).join(' ') + ' ');
    }
    
    return chunks;
  }

  /**
   * Clear cache when provider/model changes
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Generate code with optimized fast path
   */
  async generate(options: GenerationOptions): Promise<string> {
    const { prompt, signal } = options;
    const startTime = Date.now();

    // 1. FAST PATH: Template check (0.01 seconds)
    // Skip template for testing AI
    const skipTemplate = false; // Templates enabled again
    if (!skipTemplate) {
      const template = await this.templateManager.match(prompt);
      if (template) {
        this.recordMetric({
          type: "template_hit",
          prompt,
          duration: Date.now() - startTime,
        });
        console.log(`⚡ Template hit for "${prompt}": ${Date.now() - startTime}ms`);
        console.log(`⚠ AI unavailable, using template fallback:`);
        return template;
      }
    }

    // 2. FAST PATH: Cache check (0.01 seconds)
    const cached = this.cache.get(prompt);
    if (cached) {
      this.recordMetric({
        type: "cache_hit",
        prompt,
        duration: Date.now() - startTime,
      });
      console.debug(`⚡ Cache hit: ${Date.now() - startTime}ms`);
      return cached;
    }

    // 3. AI Generation with optimal model selection (1-2 seconds)
    const model = this.selectOptimalModel(prompt);
    console.debug(`🤖 Using model: ${model}`);

    try {
      // Ensure provider hub is initialized with latest config
      await this.providerHub.initialize();
      
      const code = await this.generateWithAI({
        ...options,
        model,
        stream: options.stream ?? true,
        ui: options.ui,
      });

      // Cache the result
      this.cache.set(prompt, code);

      this.recordMetric({
        type: "generated",
        prompt,
        model,
        duration: Date.now() - startTime,
        tokenCount: code.length,
      });

      console.debug(`✓ Generated in ${Date.now() - startTime}ms`);
      return code;
    } catch (error) {
      console.error(`🚫 AI generation failed:`, error);
      if (signal?.aborted) {
        throw new Error("Generation aborted");
      }
      // Re-enable template fallback on error
      const template = await this.templateManager.match(prompt);
      if (template) {
        console.log(`⚠ Falling back to template`);
        return template;
      }
      throw error;
    }
  }

  /**
   * Detect stack type from prompt
   */
  private detectStack(prompt: string): StackType {
    const lower = prompt.toLowerCase();
    
    // HTML/Canvas/Game detection
    if (lower.match(/\b(game|canvas|tetris|invader|snake|pong|breakout|インベーダー|テトリス|ゲーム)\b/)) {
      return 'html-game';
    }
    
    // Next.js detection
    if (lower.match(/\b(next\.?js|app router|pages router|api route|getserversideprops|getinitialprops)\b/)) {
      return lower.includes('pages') ? 'nextjs-pages' : 'nextjs-app';
    }
    
    // React detection
    if (lower.match(/\b(react|jsx|tsx|component|hooks?|usestate|useeffect)\b/) && !lower.includes('next')) {
      return 'react';
    }
    
    // Python detection
    if (lower.match(/\b(python|py|flask|fastapi|django|uvicorn)\b/)) {
      return lower.match(/\b(flask|fastapi|django|api|web|server)\b/) ? 'python-api' : 'python-script';
    }
    
    // Node/Express detection
    if (lower.match(/\b(node|express|koa|fastify|npm|yarn|pnpm)\b/)) {
      return 'node-express';
    }
    
    // TypeScript detection
    if (lower.match(/\b(typescript|ts|types?|interface|enum)\b/)) {
      return 'typescript';
    }
    
    return 'general';
  }

  /**
   * Get stack-specific system prompt
   */
  private getStackPrompt(stack: StackType): string {
    const basePrompt = `You are a senior full-stack engineer (Next.js/TypeScript/Python/Node).
Return ONLY code in one triple-backticked block with a correct language tag.
No menus, no bullet lists, no numbered "options", no prose.

General Requirements:
- Produce COMPLETE, WORKING code that runs immediately
- Prefer modern patterns, robust error handling
- Inline comments only where logic is non-obvious
- Use UTF-8 and avoid non-ASCII quotes`;
    
    switch (stack) {
      case 'html-game':
        return `${basePrompt}

Stack: HTML+CSS+JavaScript (single file).
- Produce a SINGLE self-contained HTML5 document with embedded <style> and <script>
- Include all game logic, input handling, scoring, animation frames
- No external CDNs or images; draw with Canvas APIs only
- window.onload or DOMContentLoaded must start the game loop
- For games: Include player controls, enemies/obstacles, collision detection, score, game over, restart`;
      
      case 'nextjs-app':
        return `${basePrompt}

Stack: Next.js (TypeScript, App Router).
- Output a minimal project skeleton files concatenated in one block:
  1) /app/page.tsx  (client component where needed: 'use client')
  2) /app/api/hello/route.ts (GET returns JSON)
  3) package.json (next, react, react-dom, typescript, @types/node, @types/react)
  4) next.config.ts (if needed)
- No other files
- Use modern React, Server/Client components appropriately
- Build must pass: \`pnpm i && pnpm next dev\``;
      
      case 'nextjs-pages':
        return `${basePrompt}

Stack: Next.js (TypeScript, Pages Router).
- Output minimal files:
  1) /pages/index.tsx
  2) /pages/api/hello.ts
  3) package.json
- Use getServerSideProps or getStaticProps where appropriate`;
      
      case 'typescript':
        return `${basePrompt}

Stack: TypeScript (ESM).
- Output index.ts only; include types and JSDoc
- No external deps unless essential
- \`tsc\` should pass with {"module":"esnext"}; avoid DOM APIs unless stated`;
      
      case 'python-script':
        return `${basePrompt}

Stack: Python 3.11+
- One .py file runnable with \`python script.py\`
- Include necessary imports
- Use type hints where appropriate`;
      
      case 'python-api':
        return `${basePrompt}

Stack: Python 3.11+ (Flask or FastAPI)
- Single file API server
- Include run instructions in comments at top
- FastAPI: with uvicorn.run() at bottom
- Flask: with app.run() at bottom`;
      
      case 'node-express':
        return `${basePrompt}

Stack: Node.js + Express
- Single server.js or index.js
- Include package.json with dependencies
- Use ES6+ features, async/await
- Include start script`;
      
      case 'react':
        return `${basePrompt}

Stack: React (single HTML file)
- Single HTML with React via CDN
- Use babel standalone for JSX transformation
- Include all components in <script type="text/babel">`;
      
      default:
        return `${basePrompt}

- Generate appropriate code for the request
- Prefer single-file solutions where possible
- Include all necessary dependencies and setup`;
    }
  }

  /**
   * Refine prompt for second pass
   */
  private getRefinePrompt(code: string, stack: StackType): string {
    return `Review this code and fix ONLY critical issues (undefined variables, missing imports, syntax errors).
Return the complete, corrected code in a triple-backticked block.
Do not add explanations or change the structure unless fixing errors.

Code to refine:
\`\`\`
${code}
\`\`\`

Requirements:
- Fix any undefined variables or functions
- Add missing imports
- Ensure the code runs without errors
- Keep the same structure and approach
- For games: Ensure all game mechanics work (movement, collision, scoring)`;
  }

  /**
   * Generate code using AI provider with 2-pass generation
   */
  private async generateWithAI(options: {
    prompt: string;
    model: string;
    signal?: AbortSignal;
    stream?: boolean;
    temperature?: number;
    maxTokens?: number;
    ui?: UIPort;
  }): Promise<string> {
    const {
      prompt,
      model,
      signal,
      stream,
      temperature = 0.2, // Lower temperature for better accuracy
      maxTokens = 8000, // Increased for complete code
    } = options;

    // Detect stack type
    const stack = this.detectStack(prompt);
    console.debug(`🎯 Detected stack: ${stack}`);
    
    // Get stack-specific system prompt
    const systemPrompt = this.getStackPrompt(stack);

    // Use streaming for real-time output (currently always use non-streaming)
    // TODO: Add streaming support to UnifiedAIProviderManager
    // eslint-disable-next-line no-constant-condition
    if (stream && false) { // Temporarily disabled until streaming is implemented
      return await this.generateStreaming({
        model,
        systemPrompt,
        userPrompt: prompt,
        temperature,
        maxTokens,
        signal,
        ui: options.ui,
      });
    }

    // PASS 1: Initial generation with stack-specific prompt
    console.debug(`📝 Pass 1: Generating initial code...`);
    const draftResponse = await this.providerHub.complete({
      prompt: `${systemPrompt}\n\nUser request: ${prompt}`,
      maxTokens,
      temperature,
    });
    
    let code = this.extractCode(draftResponse);
    
    // Quality check
    if (!code || code.length < 100 || code.includes('// TODO') || code.includes('console.log(\'Hello World\')')) {
      console.debug(`⚠️ Draft code quality too low, forcing regeneration...`);
      
      // Try again with more explicit prompt
      const explicitPrompt = `${systemPrompt}\n\nIMPORTANT: Generate COMPLETE, WORKING code. No templates, no TODOs, no Hello World.\n\nUser request: ${prompt}\n\nMust include ALL functionality requested.`;
      
      const retryResponse = await this.providerHub.complete({
        prompt: explicitPrompt,
        maxTokens,
        temperature: temperature + 0.1, // Slightly higher temperature for variety
      });
      
      code = this.extractCode(retryResponse);
    }
    
    // PASS 2: Refinement (only for complex stacks)
    if (stack !== 'general' && code.length > 200) {
      console.debug(`🔧 Pass 2: Refining code...`);
      
      const refinePrompt = this.getRefinePrompt(code, stack);
      const refinedResponse = await this.providerHub.complete({
        prompt: refinePrompt,
        maxTokens: maxTokens,
        temperature: 0.1, // Very low temperature for refinement
      });
      
      const refinedCode = this.extractCode(refinedResponse);
      if (refinedCode && refinedCode.length > code.length * 0.8) {
        // Only use refined code if it's substantial
        code = refinedCode;
      }
    }
    
    return code;
  }

  /**
   * Generate code with streaming for real-time output
   */
  private async generateStreaming(options: {
    model: string;
    systemPrompt: string;
    userPrompt: string;
    temperature: number;
    maxTokens: number;
    signal?: AbortSignal;
    ui?: UIPort;
  }): Promise<string> {
    const {
      model,
      systemPrompt,
      userPrompt,
      temperature,
      maxTokens,
      signal,
      ui,
    } = options;

    // Use streaming renderer if UI is provided
    if (ui) {
      // Initialize streaming components
      if (!this.streamingRenderer) {
        this.streamingRenderer = new StreamingRenderer(ui);
      }

      if (!this.backpressureController) {
        this.backpressureController = new BackpressureController(
          async (chunk: string) => ui.writeChunk(chunk),
          { maxQueueSize: 50, processBatchSize: 5 },
        );
      }

      // Get stream from provider
      const stream = await this.providerHub.streamGenerate({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature,
        max_tokens: maxTokens,
      });

      // Render with streaming renderer
      const result = await this.streamingRenderer.renderStream(stream, signal);

      // Update metrics with streaming data
      const streamMetrics = this.streamingRenderer.getMetrics();
      if (this.metrics.length > 0) {
        const lastMetric = this.metrics[this.metrics.length - 1];
        lastMetric.firstTokenMs = streamMetrics.firstTokenMs;
        lastMetric.throughputTokensPerSec =
          streamMetrics.throughputTokensPerSec;
      }

      return result.content;
    }

    // Fallback to simple streaming without UI
    let code = "";
    // UnifiedAIProviderManager doesn't have streaming yet, use complete instead
    const response = await this.providerHub.complete({
      prompt: `${systemPrompt}\n\n${userPrompt}`,
      maxTokens,
      temperature,
    });
    
    // Simulate streaming by chunking the response
    const chunks = this.chunkResponse(response, 20);
    const stream = (async function* () {
      for (const chunk of chunks) {
        yield { choices: [{ delta: { content: chunk } }] };
      }
    })();

    for await (const chunk of stream) {
      if (signal?.aborted) {
        break;
      }

      const content = chunk.choices?.[0]?.delta?.content || "";
      code += content;

      // Real-time output to console
      if (content) {
        process.stdout.write(content);
      }
    }

    return code;
  }

  /**
   * Select optimal model based on prompt characteristics
   */
  private selectOptimalModel(prompt: string): string {
    const promptLower = prompt.toLowerCase();
    const wordCount = prompt.split(/\s+/).length;
    const hasJapanese =
      /[\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(prompt);

    // Fast models for common requests
    const fastPatterns = [
      "tetris",
      "todo",
      "calculator",
      "hello world",
      "fizzbuzz",
      "fibonacci",
      "palindrome",
      "sort",
    ];

    if (fastPatterns.some((pattern) => promptLower.includes(pattern))) {
      return "gpt-4o-mini"; // Fastest model
    }

    // Simple requests
    if (wordCount < 10 && !hasJapanese) {
      return "gpt-4o-mini";
    }

    // Medium complexity
    if (wordCount < 30) {
      return "gpt-4o";
    }

    // Complex requests or Japanese
    if (
      hasJapanese ||
      promptLower.includes("complex") ||
      promptLower.includes("system")
    ) {
      return "gpt-4";
    }

    // Default to balanced model
    return "gpt-4o";
  }

  /**
   * Extract code from AI response
   */
  private extractCode(response: string): string {
    // Remove markdown code blocks if present
    const codeBlockRegex = /```[\w]*\n([\s\S]*?)\n```/g;
    const matches = response.match(codeBlockRegex);

    if (matches && matches.length > 0) {
      // Extract content from code blocks
      return matches
        .map((block) => block.replace(/```[\w]*\n/, "").replace(/\n```$/, ""))
        .join("\n\n");
    }

    // Return as-is if no code blocks
    return response.trim();
  }

  /**
   * Record generation metrics
   */
  private recordMetric(metric: GenerationMetrics): void {
    this.metrics.push(metric);

    // Keep only last 100 metrics
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }
  }

  /**
   * Get generation statistics
   */
  getStats(): {
    totalRequests: number;
    templateHits: number;
    cacheHits: number;
    averageLatency: number;
    modelUsage: Record<string, number>;
  } {
    const total = this.metrics.length;
    const templateHits = this.metrics.filter(
      (m) => m.type === "template_hit",
    ).length;
    const cacheHits = this.metrics.filter((m) => m.type === "cache_hit").length;

    const totalLatency = this.metrics.reduce((sum, m) => sum + m.duration, 0);
    const averageLatency = total > 0 ? totalLatency / total : 0;

    const modelUsage: Record<string, number> = {};
    for (const metric of this.metrics) {
      if (metric.model) {
        modelUsage[metric.model] = (modelUsage[metric.model] || 0) + 1;
      }
    }

    return {
      totalRequests: total,
      templateHits,
      cacheHits,
      averageLatency,
      modelUsage,
    };
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear();
    this.metrics = [];
  }

  /**
   * Preload templates for faster access
   */
  async preloadTemplates(): Promise<void> {
    await this.templateManager.preloadTemplates();
  }
}

/**
 * Create singleton instance
 */
let instance: FastCodeGenerator | null = null;

export function getFastCodeGenerator(
  providerHub: ProviderHub,
): FastCodeGenerator {
  if (!instance) {
    instance = new FastCodeGenerator(providerHub);
  }
  return instance;
}
