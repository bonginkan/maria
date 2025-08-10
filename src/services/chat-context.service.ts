import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
// @ts-ignore - no types available
import { encode } from 'gpt-3-encoder';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  tokens?: number;
  metadata?: Record<string, any>;
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
  private static instance: ChatContextService;
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
      persistPath: config?.persistPath || path.join(process.env.HOME || '', '.maria', 'context')
    };
    this.sessionId = this.generateSessionId();
  }

  public static getInstance(config?: Partial<ContextWindowConfig>): ChatContextService {
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
      return encode(text).length;
    } catch {
      // Fallback to approximate count
      return Math.ceil(text.length / 4);
    }
  }

  public async addMessage(message: Omit<Message, 'timestamp' | 'tokens'>): Promise<void> {
    const tokens = this.countTokens(message.content);
    const fullMessage: Message = {
      ...message,
      timestamp: new Date(),
      tokens
    };

    this.fullHistory.push(fullMessage);
    this.contextWindow.push(fullMessage);
    this.currentTokens += tokens;

    await this.optimizeMemory();
    this.emit('message-added', fullMessage);
    this.emit('context-updated', this.getStats());
  }

  private async optimizeMemory(): Promise<void> {
    const usageRatio = this.currentTokens / this.config.maxTokens;
    
    if (usageRatio >= this.config.compressionThreshold) {
      await this.compressContext();
    }

    while (this.currentTokens > this.config.maxTokens && this.contextWindow.length > 1) {
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
        role: 'system',
        content: `[Compressed context summary]: ${summary}`,
        timestamp: new Date(),
        tokens: this.countTokens(summary),
        metadata: { compressed: true, originalCount: middleMessages.length }
      };

      const firstMessage = this.contextWindow[0];
      const lastMessage = this.contextWindow[this.contextWindow.length - 1];
      
      if (!firstMessage || !lastMessage) return;
      
      this.contextWindow = [firstMessage, summaryMessage, lastMessage];
      this.recalculateTokens();
      this.compressionCount++;
      
      this.emit('context-compressed', {
        originalCount: middleMessages.length,
        summaryTokens: summaryMessage.tokens
      });
    }
  }

  private async generateSummary(messages: Message[]): Promise<string> {
    // This would integrate with AI service for actual summarization
    // For now, return a simple concatenation with key points
    const keyPoints = messages
      .filter(m => m.role === 'user')
      .map(m => m.content.substring(0, 100))
      .join('; ');
    
    return `Previous discussion covered: ${keyPoints}`;
  }

  private recalculateTokens(): void {
    this.currentTokens = this.contextWindow.reduce((sum, msg) => sum + (msg.tokens || 0), 0);
  }

  public clearContext(options?: { soft?: boolean; summary?: boolean }): void {
    if (options?.soft) {
      // Keep context but clear display
      this.emit('display-cleared');
      return;
    }

    if (options?.summary && this.contextWindow.length > 0) {
      this.generateSummary(this.contextWindow).then(summary => {
        this.emit('summary-generated', summary);
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

    this.emit('context-cleared', previousStats);
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
      compressedCount: this.compressionCount
    };
  }

  public async persistSession(): Promise<void> {
    if (!this.config.persistPath) return;

    try {
      await fs.mkdir(this.config.persistPath, { recursive: true });
      const sessionFile = path.join(this.config.persistPath, `${this.sessionId}.json`);
      
      const sessionData = {
        sessionId: this.sessionId,
        timestamp: new Date().toISOString(),
        stats: this.getStats(),
        contextWindow: this.contextWindow,
        fullHistory: this.fullHistory,
        compressionCount: this.compressionCount
      };

      await fs.writeFile(sessionFile, JSON.stringify(sessionData, null, 2));
      this.emit('session-persisted', sessionFile);
    } catch (error: unknown) {
      this.emit('persist-error', error instanceof Error ? error : new Error(String(error)));
    }
  }

  public async loadSession(sessionId: string): Promise<boolean> {
    if (!this.config.persistPath) return false;

    try {
      const sessionFile = path.join(this.config.persistPath, `${sessionId}.json`);
      const data = await fs.readFile(sessionFile, 'utf-8');
      const sessionData = JSON.parse(data);

      this.sessionId = sessionData.sessionId;
      this.contextWindow = sessionData.contextWindow;
      this.fullHistory = sessionData.fullHistory;
      this.compressionCount = sessionData.compressionCount;
      this.recalculateTokens();

      this.emit('session-loaded', sessionId);
      return true;
    } catch (error: unknown) {
      this.emit('load-error', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  public async exportContext(format: 'json' | 'markdown' = 'json'): Promise<string> {
    if (format === 'markdown') {
      return this.contextWindow
        .map(msg => `### ${msg.role.toUpperCase()} (${msg.timestamp.toISOString()})\n${msg.content}\n`)
        .join('\n---\n\n');
    }

    return JSON.stringify({
      sessionId: this.sessionId,
      exportDate: new Date().toISOString(),
      stats: this.getStats(),
      context: this.contextWindow,
      fullHistory: this.fullHistory
    }, null, 2);
  }

  public async importContext(data: string): Promise<void> {
    try {
      const imported = JSON.parse(data);
      
      if (imported.context && Array.isArray(imported.context)) {
        this.contextWindow = imported.context;
        this.fullHistory = imported.fullHistory || imported.context;
        this.recalculateTokens();
        this.sessionId = imported.sessionId || this.generateSessionId();
        
        this.emit('context-imported', this.getStats());
      }
    } catch (error: unknown) {
      this.emit('import-error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  public getTokenUsageIndicator(): string {
    const stats = this.getStats();
    const percentage = Math.round(stats.usagePercentage);
    const blocks = Math.round(percentage / 10);
    const filled = '█'.repeat(blocks);
    const empty = '░'.repeat(10 - blocks);
    
    let color = '\x1b[32m'; // Green
    if (percentage > 80) color = '\x1b[31m'; // Red
    else if (percentage > 60) color = '\x1b[33m'; // Yellow
    
    return `${color}[${filled}${empty}] ${percentage}% (${stats.totalTokens}/${stats.maxTokens} tokens)\x1b[0m`;
  }

  public reset(): void {
    this.contextWindow = [];
    this.fullHistory = [];
    this.currentTokens = 0;
    this.compressionCount = 0;
    this.sessionId = this.generateSessionId();
    ChatContextService.instance = null as any;
  }
}

export class ConversationMemory {
  private memories: Map<string, any> = new Map();
  private persistPath: string;

  constructor(persistPath?: string) {
    this.persistPath = persistPath || path.join(process.env.HOME || '', '.maria', 'memory');
  }

  public async set(key: string, value: any): Promise<void> {
    this.memories.set(key, {
      value,
      timestamp: new Date(),
      accessCount: 0
    });
    await this.persist();
  }

  public get(key: string): any {
    const memory = this.memories.get(key);
    if (memory) {
      memory.accessCount++;
      memory.lastAccessed = new Date();
      return memory.value;
    }
    return undefined;
  }

  public has(key: string): boolean {
    return this.memories.has(key);
  }

  public delete(key: string): boolean {
    const result = this.memories.delete(key);
    if (result) {
      this.persist();
    }
    return result;
  }

  public clear(): void {
    this.memories.clear();
    this.persist();
  }

  private async persist(): Promise<void> {
    try {
      await fs.mkdir(this.persistPath, { recursive: true });
      const memoryFile = path.join(this.persistPath, 'conversation-memory.json');
      
      const data = Array.from(this.memories.entries()).map(([key, value]) => ({
        key,
        ...value
      }));

      await fs.writeFile(memoryFile, JSON.stringify(data, null, 2));
    } catch (error: unknown) {
      console.error('Failed to persist conversation memory:', error instanceof Error ? error.message : String(error));
    }
  }

  public async load(): Promise<void> {
    try {
      const memoryFile = path.join(this.persistPath, 'conversation-memory.json');
      const data = await fs.readFile(memoryFile, 'utf-8');
      const memories = JSON.parse(data);

      this.memories.clear();
      for (const item of memories) {
        this.memories.set(item.key, {
          value: item.value,
          timestamp: new Date(item.timestamp),
          accessCount: item.accessCount || 0,
          lastAccessed: item.lastAccessed ? new Date(item.lastAccessed) : undefined
        });
      }
    } catch {
      // Memory file doesn't exist or is corrupted, start fresh
      this.memories.clear();
    }
  }

  public getStats(): any {
    const totalMemories = this.memories.size;
    const memoryUsage = JSON.stringify(Array.from(this.memories.values())).length;
    
    return {
      totalMemories,
      memoryUsage,
      oldestMemory: this.getOldestMemory(),
      mostAccessed: this.getMostAccessedMemory()
    };
  }

  private getOldestMemory(): any {
    let oldest = null;
    let oldestTime = new Date();

    for (const [key, value] of this.memories.entries()) {
      if (value.timestamp < oldestTime) {
        oldestTime = value.timestamp;
        oldest = { key, ...value };
      }
    }

    return oldest;
  }

  private getMostAccessedMemory(): any {
    let mostAccessed = null;
    let maxAccess = 0;

    for (const [key, value] of this.memories.entries()) {
      if (value.accessCount > maxAccess) {
        maxAccess = value.accessCount;
        mostAccessed = { key, ...value };
      }
    }

    return mostAccessed;
  }
}