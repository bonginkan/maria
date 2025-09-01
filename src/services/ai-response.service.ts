/**
 * AI Response Service - Intelligent Response Generation v3.0
 * Multi-language support with safety guards and optimized context management
 */

/**
 * AI Response Service - Intelligent Response Generation v3.0
 * Always try real LLM first, fall back to templates only on failure.
 * Multi-language support with safety guards and optimized context management.
 */

import { ChatContextService } from "./chat-context.service";
import type { ConversationMessage } from "./conversation-persistence";
import { ConversationPersistence } from "./conversation-persistence";
import { generateTetrisGameTemplate } from "./ai-response-tetris-template";

// Intent / language / telemetry
import {
  analyzeIntent,
  detectLanguage,
  type Intent,
} from "./ai-response/intent";
import { TelemetryCollector } from "./ai-response/telemetry/telemetry-collector";

// Unified provider system (V2)
import {
  getProviderManager,
  DEFAULT_PROVIDER,
  DEFAULT_MODEL,
} from "../providers/index";

// Context & responders
import {
  buildContextForAI,
  extractKeyTopics,
  getContextStats,
  type SlimContext,
} from "./ai-response/context";
import {
  buildCodeResponse,
  generateCLITemplate,
  generateNextAPITemplate,
} from "./ai-response/responders/code";
import { buildSmartContinuation } from "./ai-response/responders/continuation";
import { buildComprehensiveAnswer } from "./ai-response/responders/question";

// Safety guards
import {
  checkInputSafety,
  checkOutputSafety,
  sanitizeOutput,
  isExplicitContentAllowed,
  generateRejectionMessage,
  logSafetyEvent,
} from "./ai-response/guards/safety";

// Env flags
const PLAIN_OUTPUT =
  process.env.MARIA_PLAIN_OUTPUT === "1" ||
  process.env.MARIA_DISABLE_GUIDED_FLOW === "1";
const DISABLE_SAFETY_GUARD = process.env.MARIA_DISABLE_SAFETY_GUARD === "1";

export interface AIResponseRequest {
  userInput: string;
  sessionMemory: ConversationMessage[];
  provider?: string;
  model?: string;
}

export interface AIResponseOptions {
  streaming?: boolean;
  contextLength?: number;
  temperature?: number;
}

export class AIResponseService {
  private chatContext: ChatContextService;
  private _conversationPersistence: ConversationPersistence;
  private telemetry: TelemetryCollector;
  private initialized = false;

  // V2 providers
  private providerManager: ReturnType<typeof getProviderManager>;

  constructor() {
    this.chatContext = ChatContextService.getInstance();
    this._conversationPersistence = new ConversationPersistence();
    this.telemetry = TelemetryCollector.getInstance();
    this.providerManager = getProviderManager();
    this.initializeProviders().catch(() => void 0);
  }

  /** Initialize provider(s) once */
  private async initializeProviders(): Promise<void> {
    if (this.initialized) return;
    try {
      await this.providerManager.initialize();
      this.initialized = true;
    } catch {
      // Keep silent: we will fall back later
      this.initialized = false;
    }
  }

  /** Pick provider (no legacy fallback) */
  private async getAIProvider(): Promise<unknown> {
    if (!this.initialized) await this.initializeProviders();
    const picked = await this.providerManager.pick(
      (DEFAULT_PROVIDER as unknown) as string,
    );
    return picked;
  }

  /**
   * Single LLM call surface (unified). Returns '' on failure.
   * Prefer minimal system prompt under PLAIN_OUTPUT.
   */
  private async callLLM(
    prompt: string,
    opts: {
      system?: string;
      model?: string;
      provider?: string;
      stream?: boolean;
      temperature?: number;
      maxTokens?: number;
    } = {},
  ): Promise<string> {
    const {
      system = PLAIN_OUTPUT
        ? "Return ONLY the answer (or ONLY code). No menus, no lists, no guided flows."
        : "You are a helpful senior engineer. Provide direct, production-quality answers.",
      model = DEFAULT_MODEL,
      provider = DEFAULT_PROVIDER,
      temperature = 0.2,
      maxTokens = 32000,
    } = opts;

    try {
      // Prefer “complete(prompt)” for broad provider compatibility
      // (If your manager exposes `generate({messages})`, swap here.)
      const res = await this.providerManager.complete({
        prompt: `${system}\n\n${prompt}`,
        model,
        temperature,
        maxTokens,
      });

      if (!res) return "";
      if (typeof res === "string") return res;

      const anyRes = res as any;
      if (typeof anyRes.content === "string") return anyRes.content;
      if (Array.isArray(anyRes.choices) && anyRes.choices[0]?.message?.content)
        return anyRes.choices[0].message.content;

      // Fallback stringify
      return JSON.stringify(res);
    } catch {
      return "";
    }
  }

  /**
   * Generate response: ALWAYS try LLM first, then fallback to templates.
   */
  async generateResponse(
    request: AIResponseRequest,
    options: AIResponseOptions = {},
  ): Promise<string> {
    const start = Date.now();
    await this.initializeProviders();

    const isCodeCommand =
      request.userInput.toLowerCase().startsWith("/code") ||
      /\b(build|rest\s*api|react|component|tetris)\b/i.test(
        request.userInput,
      );

    try {
      // 1) Input safety (skip for code)
      if (!DISABLE_SAFETY_GUARD && !isCodeCommand) {
        const inputSafety = checkInputSafety(request.userInput);
        if (!inputSafety.safe) {
          logSafetyEvent({
            type: "input_check",
            safe: false,
            reason: inputSafety.reason,
          });
          const lang = detectLanguage(request.userInput);
          return generateRejectionMessage(
            inputSafety.reason || "Safety check failed",
            lang === "ja",
          );
        }
      }

      // 2) Add user message to context
      await this.chatContext.addMessage({
        role: "user",
        content: request.userInput,
      });

      // 3) Build slim context
      const context = buildContextForAI(request.sessionMemory, {
        budgetChars: options.contextLength ? options.contextLength * 4 : 8000,
        maxMessages: 20,
      });

      // 4) Detect language & intent
      const language = detectLanguage(request.userInput);
      const recentText = context.recentMessages.map((m) => m.content).join(" ");
      const intent = analyzeIntent(request.userInput, recentText);

      // 5) Telemetry
      this.telemetry.trackIntent({
        type: intent.type,
        confidence: intent.confidence,
        language,
        timestamp: Date.now(),
      });

      // 6) LLM first
      let aiResponse = "";
      const mergedPrompt = [
        ...context.recentMessages
          .slice(-5)
          .map((m) => `${m.role.toUpperCase()}: ${m.content}`),
        `USER: ${request.userInput}`,
      ].join("\n\n");

      aiResponse = await this.callLLM(mergedPrompt, {
        provider: request.provider || DEFAULT_PROVIDER,
        model: request.model || DEFAULT_MODEL,
        temperature: options.temperature ?? (isCodeCommand ? 0.05 : 0.3),
        maxTokens: 2000,
      });

      if (!aiResponse || aiResponse.trim().length < 5) {
        // 7) Fallback routing
        aiResponse = await this.routeByIntent(
          intent,
          request.userInput,
          context,
          { language, options },
        );
      }

      // 8) Output safety
      const outputSafety = DISABLE_SAFETY_GUARD
        ? { safe: true }
        : checkOutputSafety(aiResponse);
      const finalResponse = outputSafety.safe
        ? aiResponse
        : sanitizeOutput(aiResponse, 50_000);

      // 9) Add assistant message
      await this.chatContext.addMessage({
        role: "assistant",
        content: finalResponse,
      });

      // 10) Telemetry
      this.telemetry.trackResponse({
        provider: this.initialized ? "llm_or_fallback" : "template",
        model: request.model || DEFAULT_MODEL,
        latencyMs: Date.now() - start,
        success: true,
        fallback: !this.initialized || !aiResponse,
        timestamp: Date.now(),
      });

      return finalResponse;
    } catch (err) {
      if (!isCodeCommand && !DISABLE_SAFETY_GUARD) {
        logSafetyEvent({
          type: "rejection",
          safe: false,
          reason: "Generation failed",
        });
      }
      this.telemetry.trackError(err as Error, {
        userInput: request.userInput,
        provider: this.initialized ? "llm_or_fallback" : "template",
      });
      return this.generateFallbackResponse(request.userInput);
    }
  }

  /** Intent routing → template fallback only */
  private async routeByIntent(
    intent: Intent,
    userInput: string,
    context: SlimContext,
    config: { language: "ja" | "en"; options: AIResponseOptions },
  ): Promise<string> {
    const { language } = config;
    const isJapanese = language === "ja";
    const topics = extractKeyTopics(context);

    // PLAIN_OUTPUT: no guided menus
    if (PLAIN_OUTPUT) {
      switch (intent.type) {
        case "CODE_REQUEST":
          if (/\bcli\b/i.test(userInput)) return generateCLITemplate(isJapanese);
          if (/\b(api|rest)\b/i.test(userInput))
            return generateNextAPITemplate(isJapanese);
          // Return empty to let AI handle it
          return "";
        case "QUESTION":
          // In PLAIN mode, don't use template responders - return empty to let LLM handle it
          return "";
        default:
          // Return empty to let LLM handle it naturally
          return "";
      }
    }

    // Normal (may include guided outputs)
    switch (intent.type) {
      case "TETRIS_REQUEST":
        return isExplicitContentAllowed(userInput, "tetris")
          ? generateTetrisGameTemplate(userInput)
          : this.generateDefaultResponse(userInput);

      case "CODE_REQUEST":
        if (/\bcli\b/i.test(userInput)) return generateCLITemplate(isJapanese);
        if (/\b(api|next|rest)\b/i.test(userInput))
          return generateNextAPITemplate(isJapanese);

        // Return empty to let AI handle code generation properly
        return "";

      case "QUESTION":
        return buildComprehensiveAnswer(userInput, topics, isJapanese);

      case "CONTINUATION": {
        const contextPreview = context.recentMessages
          .slice(-3)
          .map((m) => m.content)
          .join(" ");
        return buildSmartContinuation(contextPreview, topics, isJapanese);
      }

      case "SUMMARIZE":
        return this.generateSummaryResponse(context, isJapanese);

      case "REFACTOR":
        return this.generateRefactorResponse(userInput, isJapanese);

      default:
        return this.generateSmartDefault(userInput, topics, isJapanese);
    }
  }

  /** Summary (template) */
  private generateSummaryResponse(
    context: SlimContext,
    isJapanese: boolean,
  ): string {
    const stats = getContextStats(context);
    const topics =
      stats.topics.join(", ") ||
      (isJapanese ? "一般的な会話" : "general conversation");

    return isJapanese
      ? `直近の会話を要約します:

📊 **統計情報**
• メッセージ数: ${stats.messageCount}
• 合計文字数: ${stats.totalChars}
• トピック: ${topics}

📝 **要約**
${context.rollingSummary || "要約する内容が不足しています。"}`
      : `Here's a summary of our recent conversation:

📊 **Statistics**
• Messages: ${stats.messageCount}
• Total chars: ${stats.totalChars}
• Topics: ${topics}

📝 **Summary**
${context.rollingSummary || "Not enough content to summarize."}`;
  }

  /** Refactor (template) */
  private generateRefactorResponse(input: string, isJapanese: boolean): string {
    return isJapanese
      ? `リファクタリングのご要望ですね。「${input.substring(
          0,
          50,
        )}」を改善します。`
      : `I'll help you refactor "${input.substring(0, 50)}".`;
  }

  /** Smart default (guided only when not PLAIN_OUTPUT) */
  private generateSmartDefault(
    input: string,
    topics: string[],
    isJapanese: boolean,
  ): string {
    if (PLAIN_OUTPUT) {
      return isJapanese
        ? `「${input.slice(0, 100)}」への回答です。`
        : `Answer for: ${input.slice(0, 100)}`;
    }
    const clean = input.substring(0, 100);
    const topicNote =
      topics.length > 0
        ? isJapanese
          ? `\n検出されたトピック: ${topics.join(", ")}`
          : `\nDetected topics: ${topics.join(", ")}`
        : "";
    const options = isJapanese
      ? [
          "今すぐ動く最小コード",
          "設計方針とトレードオフ",
          "既存コードの改善提案",
          "詳細な説明を聞く",
        ]
      : [
          "Minimal working code",
          "Design & trade-offs",
          "Improve existing code",
          "Detailed explanation",
        ];
    return isJapanese
      ? `ご依頼ありがとうございます。「${clean}」について対応します。${topicNote}

最短で目的を達成するため、以下から選んでください:
${options.map((opt, i) => `${i + 1}) ${opt}`).join("\n")}`
      : `Thanks for your request: "${clean}"${topicNote}

Choose your fastest path to success:
${options.map((opt, i) => `${i + 1}) ${opt}`).join("\n")}`;
  }

  /** Default (guided only when not PLAIN_OUTPUT) */
  private generateDefaultResponse(input: string): string {
    const isJapanese = detectLanguage(input) === "ja";
    if (PLAIN_OUTPUT) {
      return isJapanese
        ? `「${input.slice(0, 100)}」への回答です。`
        : `Answer for: ${input.slice(0, 100)}`;
    }
    return isJapanese
      ? `「${input.substring(0, 50)}」について対応いたします。`
      : `I'll help you with: "${input.substring(0, 50)}"`;
  }

  /** Fallback when everything else fails */
  private generateFallbackResponse(input: string): string {
    const isJapanese = detectLanguage(input) === "ja";
    return isJapanese
      ? `処理中にエラーが発生しました。「${input.substring(0, 50)}」を別の言い方でお試しください。`
      : `I hit an issue processing "${input.substring(
          0,
          50,
        )}". Please try rephrasing.`;
  }

  /** Stream helper (TTY) */
  async streamResponse(
    response: string,
    callback: (line: string) => void,
  ): Promise<void> {
    const lines = response.split("\n");
    for (let i = 0; i < lines.length; i++) {
      callback(lines[i]);
      let delay = 40;
      const line = lines[i];
      if (line.trim().length === 0) delay = 20;
      else if (line.includes("```")) delay = 60;
      else if (/[.!?]$/.test(line)) delay = 80;
      if (i < lines.length - 1)
        await new Promise((r) => setTimeout(r, delay));
    }
  }
}