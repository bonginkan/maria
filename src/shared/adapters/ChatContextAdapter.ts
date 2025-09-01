/**
 * ChatContextAdapter
 * Wraps the existing ChatContext to conform to ContextPort interface
 */

import type { ContextPort, Message, ContextOptions } from "../types/context";

export class ChatContextAdapter implements ContextPort {
  private messages: Message[] = [];
  private maxMessages: number;
  private maxTokens: number;

  constructor(
    private context: any,
    options?: ContextOptions,
  ) {
    this.maxMessages = options?.maxMessages || 100;
    this.maxTokens = options?.maxTokens || 8000;

    // Initialize from existing context if available
    if (context?.messages) {
      this.messages = this.normalizeMessages(context.messages);
    }
  }

  /**
   * Add a message to the context
   */
  async add(message: Message, opts?: { signal?: AbortSignal }): Promise<void> {
    // Check for abort signal
    if (opts?.signal?.aborted) {
      throw new Error("AbortError");
    }

    try {
      // Validate message
      if (!message.role || !message.content) {
        throw new Error("Invalid message: role and content are required");
      }

      // Add to internal store
      this.messages.push({
        ...message,
        timestamp: message.timestamp || new Date(),
      });

      // Sync with underlying context if available
      if (this.context?.addMessage) {
        await this.context.addMessage(message);
      }

      // Enforce limits
      this.enforceLimit();

      // Check again after async operation
      if (opts?.signal?.aborted) {
        throw new Error("AbortError");
      }
    } catch (error: any) {
      if (error.message === "AbortError") throw error;
      throw new Error(
        `Failed to add message: ${error.message || "Unknown error"}`,
      );
    }
  }

  /**
   * Get messages from the context
   */
  async get(opts?: {
    signal?: AbortSignal;
    limit?: number;
    since?: Date;
  }): Promise<Message[]> {
    // Check for abort signal
    if (opts?.signal?.aborted) {
      throw new Error("AbortError");
    }

    try {
      let messages = [...this.messages];

      // Filter by date if specified
      if (opts?.since) {
        messages = messages.filter(
          (m) => (m.timestamp || new Date()) >= opts.since!,
        );
      }

      // Apply limit if specified
      if (opts?.limit) {
        messages = messages.slice(-opts.limit);
      }

      // Check again after processing
      if (opts?.signal?.aborted) {
        throw new Error("AbortError");
      }

      return messages;
    } catch (error: any) {
      if (error.message === "AbortError") throw error;
      console.error("ChatContextAdapter.get error:", error);
      return [];
    }
  }

  /**
   * Clear the context
   */
  async clear(opts?: { signal?: AbortSignal }): Promise<void> {
    // Check for abort signal
    if (opts?.signal?.aborted) {
      throw new Error("AbortError");
    }

    try {
      this.messages = [];

      // Clear underlying context if available
      if (this.context?.clear) {
        await this.context.clear();
      }

      // Check again after async operation
      if (opts?.signal?.aborted) {
        throw new Error("AbortError");
      }
    } catch (error: any) {
      if (error.message === "AbortError") throw error;
      throw new Error(
        `Failed to clear context: ${error.message || "Unknown error"}`,
      );
    }
  }

  /**
   * Summarize the context
   */
  async summarize(opts?: { signal?: AbortSignal }): Promise<string> {
    // Check for abort signal
    if (opts?.signal?.aborted) {
      throw new Error("AbortError");
    }

    try {
      // Use underlying context's summarize if available
      if (this.context?.summarize) {
        const summary = await this.context.summarize();

        // Check again after async operation
        if (opts?.signal?.aborted) {
          throw new Error("AbortError");
        }

        return summary;
      }

      // Simple fallback summarization
      const messageCount = this.messages.length;
      const roles = new Set(this.messages.map((m) => m.role));
      const firstMessage = this.messages[0];
      const lastMessage = this.messages[this.messages.length - 1];

      let summary = `Conversation with ${messageCount} messages`;
      if (roles.size > 0) {
        summary += ` between ${Array.from(roles).join(", ")}`;
      }
      if (firstMessage) {
        summary += `. Started: ${firstMessage.timestamp || "unknown"}`;
      }
      if (lastMessage && lastMessage !== firstMessage) {
        summary += `. Last message: ${lastMessage.timestamp || "unknown"}`;
      }

      return summary;
    } catch (error: any) {
      if (error.message === "AbortError") throw error;
      return "Unable to summarize context";
    }
  }

  /**
   * Normalize messages from various formats
   */
  private normalizeMessages(messages: any[]): Message[] {
    return messages.map((m) => ({
      role: m.role || "user",
      content: m.content || m.text || m.message || "",
      timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
      metadata: m.metadata || {},
    }));
  }

  /**
   * Enforce message and token limits
   */
  private enforceLimit(): void {
    // Enforce message count limit
    while (this.messages.length > this.maxMessages) {
      this.messages.shift();
    }

    // Simple token estimation (can be enhanced with actual tokenizer)
    let totalTokens = 0;
    let messagesToKeep = this.messages.length;

    for (let i = this.messages.length - 1; i >= 0; i--) {
      const estimatedTokens = this.estimateTokens(this.messages[i]);
      if (totalTokens + estimatedTokens > this.maxTokens) {
        messagesToKeep = this.messages.length - i - 1;
        break;
      }
      totalTokens += estimatedTokens;
    }

    if (messagesToKeep < this.messages.length) {
      this.messages = this.messages.slice(-messagesToKeep);
    }
  }

  /**
   * Estimate token count for a message
   */
  private estimateTokens(message: Message): number {
    // Simple estimation: ~4 characters per token
    const content =
      typeof message.content === "string"
        ? message.content
        : JSON.stringify(message.content);
    return Math.ceil(content.length / 4);
  }

  /**
   * Get context statistics (extension for convenience)
   */
  async getStats(): Promise<{
    messageCount: number;
    estimatedTokens: number;
    oldestMessage?: Date;
    newestMessage?: Date;
    roles: string[];
  }> {
    const stats: any = {
      messageCount: this.messages.length,
      estimatedTokens: 0,
      roles: [],
    };

    if (this.messages.length > 0) {
      stats.oldestMessage = this.messages[0].timestamp;
      stats.newestMessage = this.messages[this.messages.length - 1].timestamp;
      stats.roles = [...new Set(this.messages.map((m) => m.role))];
      stats.estimatedTokens = this.messages.reduce(
        (sum, m) => sum + this.estimateTokens(m),
        0,
      );
    }

    return stats;
  }
}
