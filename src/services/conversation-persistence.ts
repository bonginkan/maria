/**
 * Conversation Persistence System
 * Handles saving and loading conversation history between sessions
 */

import { promises as fs } from "fs";
import * as path from "path";
import * as os from "os";

export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  model?: string;
  provider?: string;
}

export interface ConversationSession {
  id: string;
  messages: ConversationMessage[];
  lastActivity: Date;
  metadata?: {
    provider?: string;
    model?: string;
    mode?: string;
  };
}

export class ConversationPersistence {
  private sessionFile: string;
  private maxHistorySize: number;
  private autoSaveInterval: NodeJS.Timeout | null = null;
  private pendingWrites: ConversationMessage[] = [];

  constructor(maxHistorySize: number = 100) {
    const configDir = path.join(os.homedir(), ".maria");
    this.sessionFile = path.join(configDir, "conversation-history.json");
    this.maxHistorySize = maxHistorySize;

    // Ensure config directory exists
    this.ensureConfigDir();

    // Start auto-save with batching
    this.startAutoSave();
  }

  /**
   * Ensure the configuration directory exists
   */
  private async ensureConfigDir(): Promise<void> {
    try {
      const configDir = path.dirname(this.sessionFile);
      await fs.mkdir(configDir, { recursive: true });
    } catch (error) {
      console.warn("Failed to create config directory:", error);
    }
  }

  /**
   * Load conversation history from disk
   */
  async loadHistory(): Promise<ConversationMessage[]> {
    try {
      const data = await fs.readFile(this.sessionFile, "utf-8");
      const session: ConversationSession = JSON.parse(data);

      // Convert timestamp strings back to Date objects
      const messages = session.messages.map((msg) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      }));

      // Keep only recent messages within the limit
      return messages.slice(-this.maxHistorySize);
    } catch (innerError) {
      // File doesn't exist or is corrupted - start fresh
      return [];
    }
  }

  /**
   * Add a message to the conversation and queue for saving
   */
  addMessage(message: ConversationMessage): void {
    this.pendingWrites.push(message);
  }

  /**
   * Save conversation history to disk (batched)
   */
  private async saveHistory(messages: ConversationMessage[]): Promise<void> {
    try {
      // Load existing history and merge with new messages
      let existingMessages: ConversationMessage[] = [];
      try {
        existingMessages = await this.loadHistory();
      } catch {
        // Ignore errors, start fresh
      }

      // Combine existing and new messages
      const allMessages = [...existingMessages, ...messages];

      // Keep only the most recent messages
      const recentMessages = allMessages.slice(-this.maxHistorySize);

      const session: ConversationSession = {
        id: this.generateSessionId(),
        messages: recentMessages,
        lastActivity: new Date(),
        metadata: {
          provider: messages[messages.length - 1]?.provider,
          model: messages[messages.length - 1]?.model,
        },
      };

      await fs.writeFile(this.sessionFile, JSON.stringify(session, null, 2));
    } catch (error) {
      console.warn("Failed to save conversation history:", error);
    }
  }

  /**
   * Clear conversation history
   */
  async clearHistory(): Promise<void> {
    try {
      await fs.unlink(this.sessionFile);
    } catch (innerError) {
      // File doesn't exist - that's fine
    }
    this.pendingWrites = [];
  }

  /**
   * Get conversation statistics
   */
  async getStats(): Promise<{
    totalMessages: number;
    oldestMessage?: Date;
    newestMessage?: Date;
    fileSize?: number;
  }> {
    try {
      const messages = await this.loadHistory();
      const stats = await fs.stat(this.sessionFile);

      return {
        totalMessages: messages.length,
        oldestMessage: messages[0]?.timestamp,
        newestMessage: messages[messages.length - 1]?.timestamp,
        fileSize: stats.size,
      };
    } catch (error) {
      return {
        totalMessages: 0,
      };
    }
  }

  /**
   * Start auto-save with batching to reduce disk I/O
   */
  private startAutoSave(): void {
    this.autoSaveInterval = setInterval(async () => {
      if (this.pendingWrites.length > 0) {
        const batch = [...this.pendingWrites];
        this.pendingWrites = [];
        await this.saveHistory(batch);
      }
    }, 2000); // Save every 2 seconds if there are pending writes
  }

  /**
   * Stop auto-save and perform final save
   */
  async close(): Promise<void> {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }

    // Final save of any pending writes
    if (this.pendingWrites.length > 0) {
      await this.saveHistory(this.pendingWrites);
      this.pendingWrites = [];
    }
  }

  /**
   * Generate a session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current session file path
   */
  getSessionFilePath(): string {
    return this.sessionFile;
  }
}
