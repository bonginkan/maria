/**
 * Fixed Chat Context Service - Clean Implementation
 * Handles conversation context with proper TypeScript typing
 */

import { EventEmitter } from "node:events";
import * as fs from "fs/promises";
import * as path from "path";

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  tokens?: number;
  metadata?: Record<string, unknown>;
}

export interface ContextWindowConfig {
  maxTokens: number;
  compressionThreshold: number;
  summaryTokenLimit: number;
  persistPath?: string;
}

export interface ContextStats {
  totalMessages: number;
  totalTokens: number;
  maxTokens: number;
  usagePercentage: number;
  messagesInWindow: number;
  compressedCount: number;
}

export class ChatContextService extends EventEmitter {
  private static instance: ChatContextService | null = null;
  private contextWindow: Message[] = [];
  private fullHistory: Message[] = [];
  private config: ContextWindowConfig;
  private currentTokens: number = 0;
  private compressionCount: number = 0;
  private sessionId: string;

  private constructor(config?: Partial<ContextWindowConfig>) {
    super();
    this.config = {
      maxTokens: config?.maxTokens || 128000,
      compressionThreshold: config?.compressionThreshold || 0.8,
      summaryTokenLimit: config?.summaryTokenLimit || 2000,
      persistPath:
        config?.persistPath ||
        path.join(process.env["HOME"] || "", ".maria", "context"),
    };
    this.sessionId = this.generateSessionId();
  }

  public static getInstance(
    config?: Partial<ContextWindowConfig>,
  ): ChatContextService {
    if (!ChatContextService.instance) {
      ChatContextService.instance = new ChatContextService(config);
    }
    return ChatContextService.instance;
  }

  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private countTokens(text: string): number {
    try {
      // Fallback token counting - approximate 4 chars per token
      return Math.ceil(text.length / 4);
    } catch {
      return Math.ceil(text.length / 4);
    }
  }

  public async addMessage(
    message: Omit<Message, "timestamp" | "tokens">,
  ): Promise<void> {
    const tokens = this.countTokens(message.content);
    const fullMessage: Message = {
      ...message,
      timestamp: new Date(),
      tokens,
    };

    this.fullHistory.push(fullMessage);
    this.contextWindow.push(fullMessage);
    this.currentTokens += tokens;

    await this.optimizeMemory();
    this.emit("message-added", fullMessage);
    this.emit("context-updated", this.getStats());
  }

  private async optimizeMemory(): Promise<void> {
    const usageRatio = this.currentTokens / this.config.maxTokens;

    if (usageRatio >= this.config.compressionThreshold) {
      await this.compressContext();
    }

    while (
      this.currentTokens > this.config.maxTokens &&
      this.contextWindow.length > 1
    ) {
      const removed = this.contextWindow.shift();
      if (removed?.tokens) {
        this.currentTokens -= removed.tokens;
      }
    }
  }

  private async compressContext(): Promise<void> {
    if (this.contextWindow.length <= 2) return;

    const middleMessages = this.contextWindow.slice(1, -1);
    const summary = await this.generateSummary(middleMessages);

    if (summary) {
      const summaryMessage: Message = {
        role: "system",
        content: `[Compressed context summary]: ${summary}`,
        timestamp: new Date(),
        tokens: this.countTokens(summary),
        metadata: { compressed: true, originalCount: middleMessages.length },
      };

      const firstMessage = this.contextWindow[0];
      const lastMessage = this.contextWindow[this.contextWindow.length - 1];

      if (!firstMessage || !lastMessage) return;

      this.contextWindow = [firstMessage, summaryMessage, lastMessage];
      this.recalculateTokens();
      this.compressionCount++;

      this.emit("context-compressed", {
        originalCount: middleMessages.length,
        summaryTokens: summaryMessage.tokens,
      });
    }
  }

  private async generateSummary(messages: Message[]): Promise<string> {
    // Simple summarization - can be enhanced with AI integration
    const keyPoints = messages
      .filter((m) => m.role === "user")
      .map((m) => m.content.substring(0, 100))
      .join("; ");

    return `Previous discussion covered: ${keyPoints}`;
  }

  private recalculateTokens(): void {
    this.currentTokens = this.contextWindow.reduce(
      (sum, msg) => sum + (msg.tokens || 0),
      0,
    );
  }

  public clearContext(options?: { soft?: boolean; summary?: boolean }): void {
    if (options?.soft) {
      this.emit("display-cleared");
      return;
    }

    if (options?.summary && this.contextWindow.length > 0) {
      this.generateSummary(this.contextWindow).then((summary) => {
        this.emit("summary-generated", summary);
      });
    }

    const previousStats = this.getStats();
    this.contextWindow = [];
    this.currentTokens = 0;
    this.compressionCount = 0;

    if (!options?.soft) {
      this.fullHistory = [];
      this.sessionId = this.generateSessionId();
    }

    this.emit("context-cleared", previousStats);
  }

  public getContext(): Message[] {
    return [...this.contextWindow];
  }

  public getFullHistory(): Message[] {
    return [...this.fullHistory];
  }

  public getStats(): ContextStats {
    return {
      totalMessages: this.fullHistory.length,
      totalTokens: this.currentTokens,
      maxTokens: this.config.maxTokens,
      usagePercentage: (this.currentTokens / this.config.maxTokens) * 100,
      messagesInWindow: this.contextWindow.length,
      compressedCount: this.compressionCount,
    };
  }

  public async persistSession(): Promise<void> {
    if (!this.config.persistPath) return;

    try {
      await fs.mkdir(this.config.persistPath, { recursive: true });
      const sessionFile = path.join(
        this.config.persistPath,
        `${this.sessionId}.json`,
      );

      const sessionData = {
        sessionId: this.sessionId,
        timestamp: new Date().toISOString(),
        stats: this.getStats(),
        contextWindow: this.contextWindow,
        fullHistory: this.fullHistory,
        compressionCount: this.compressionCount,
      };

      await fs.writeFile(sessionFile, JSON.stringify(sessionData, null, 2));
      this.emit("session-persisted", sessionFile);
    } catch (error: unknown) {
      this.emit(
        "persist-error",
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  public getTokenUsageIndicator(): string {
    const stats = this.getStats();
    const percentage = Math.round(stats.usagePercentage);
    const blocks = Math.round(percentage / 10);
    const filled = "█".repeat(blocks);
    const empty = "░".repeat(10 - blocks);

    let color = "\u001b[32m"; // Green
    if (percentage > 80)
      color = "\u001b[31m"; // Red
    else if (percentage > 60) color = "\u001b[33m"; // Yellow

    return `${color}[${filled}${empty}] ${percentage}% (${stats.totalTokens}/${stats.maxTokens} tokens)\u001b[0m`;
  }

  public reset(): void {
    this.contextWindow = [];
    this.fullHistory = [];
    this.currentTokens = 0;
    this.compressionCount = 0;
    this.sessionId = this.generateSessionId();
    ChatContextService.instance = null;
  }
}
