/**
 * Auto Research Service
 * Main service that orchestrates automatic URL detection and research
 */

import { logger } from "../../utils/logger";
import { BaseService } from "../../internal-mode/core/BaseService";
import {
  URLDetectionService,
  DetectedURL,
  ContextAnalysis,
} from "./URLDetectionService";
import {
  AsyncResearchQueue,
  AutoResearchJob,
  _Progress,
} from "./AsyncResearchQueue";
import { EventEmitter } from "node:events";

export interface AutoResearchConfig {
  enabled: boolean;
  maxConcurrentResearch: number;
  autoNotifyCompletion: boolean;
  saveToKnowledgeBase: boolean;
  minPriorityForAutoStart: "high" | "medium" | "low";
  notificationChannels: ("console" | "ui" | "webhook")[];
}

export interface ResearchNotification {
  type: "started" | "progress" | "completed" | "failed";
  _jobId: string;
  url: string;
  message: string;
  data?: any;
  timestamp: Date;
}

export class AutoResearchService extends BaseService {
  id = "auto-research-service";
  version = "1.0.0";

  private urlDetector: URLDetectionService;
  private researchQueue: AsyncResearchQueue;
  private eventEmitter: EventEmitter;

  private config: AutoResearchConfig = {
    enabled: true,
    maxConcurrentResearch: 3,
    autoNotifyCompletion: true,
    saveToKnowledgeBase: true,
    minPriorityForAutoStart: "medium",
    notificationChannels: ["console", "ui"],
  };

  private conversationHistory: Map<string, string[]> = new Map();
  private activeJobs: Map<string, string[]> = new Map(); // userId -> jobIds

  constructor(config?: Partial<AutoResearchConfig>) {
    super();

    if (config) {
      this.config = { ...this.config, ...config };
    }

    this.urlDetector = new URLDetectionService();
    this.researchQueue = new AsyncResearchQueue();
    this.eventEmitter = new EventEmitter();
  }

  async initialize(): Promise<void> {
    await this.urlDetector.initialize();
    await this.researchQueue.initialize();

    // Set up event listeners
    this.setupEventListeners();

    logger.info("AutoResearchService initialized", { config: this.config });
  }

  /**
   * Process a user message for automatic URL research
   */
  async processMessage(
    userId: string,
    message: string,
    conversationContext?: string[],
  ): Promise<{
    _detectedUrls: DetectedURL[];
    startedJobs: string[];
    notifications: ResearchNotification[];
  }> {
    if (!this.config.enabled) {
      return { _detectedUrls: [], startedJobs: [], notifications: [] };
    }

    // Update conversation _history
    this.updateConversationHistory(userId, message);

    // Detect URLs in the message
    const _detectedUrls = this.urlDetector.detectURLs(message);

    if (_detectedUrls.length === 0) {
      return { _detectedUrls: [], startedJobs: [], notifications: [] };
    }

    const startedJobs: string[] = [];
    const notifications: ResearchNotification[] = [];

    // Get conversation _context
    const _contextHistory =
      conversationContext || this.getConversationHistory(userId);

    // Process each detected URL
    for (const detectedUrl of _detectedUrls) {
      try {
        // Analyze _context
        const _context = this.urlDetector.analyzeContext(
          detectedUrl.url,
          _contextHistory,
        );

        // Calculate _priority
        const _priority = this.urlDetector.calculatePriority(
          detectedUrl.url,
          _context,
        );

        // Check if we should auto-start research
        const _shouldAutoResearch = this.shouldStartAutoResearch(
          _priority,
          _context,
        );

        if (_shouldAutoResearch) {
          // Start research job
          const _jobId = await this.researchQueue.addJob(
            detectedUrl,
            _context,
            _priority,
            userId,
          );
          startedJobs.push(_jobId);

          // Track job for user
          this.addUserJob(userId, _jobId);

          // Create notification
          const notification: ResearchNotification = {
            type: "started",
            _jobId,
            url: detectedUrl.url,
            message: `🔍 URLを検知しました。バックグラウンドでリサーチを開始します... (優先度: ${_priority.level})`,
            data: { _priority, _context },
            timestamp: new Date(),
          };

          notifications.push(notification);
          this.emitNotification(notification);

          logger.info(`Started auto-research for URL: ${detectedUrl.url}`, {
            _jobId,
            _priority: _priority.level,
            userId,
          });
        } else {
          logger.debug(`Skipped auto-research for URL: ${detectedUrl.url}`, {
            _priority: _priority.level,
            reason: "Priority below threshold",
          });
        }
      } catch (_error) {
        logger.error(`Error processing URL ${detectedUrl.url}:`, _error);

        const errorNotification: ResearchNotification = {
          type: "failed",
          _jobId: "unknown",
          url: detectedUrl.url,
          message: `❌ URL処理でエラーが発生しました: ${detectedUrl.url}`,
          data: {
            _error: _error instanceof Error ? _error.message : String(_error),
          },
          timestamp: new Date(),
        };

        notifications.push(errorNotification);
        this.emitNotification(errorNotification);
      }
    }

    return { _detectedUrls, startedJobs, notifications };
  }

  /**
   * Get research job status
   */
  async getJobStatus(_jobId: string): Promise<AutoResearchJob | null> {
    return this.researchQueue.getJob(_jobId);
  }

  /**
   * Get all jobs for a user
   */
  async getUserJobs(userId: string): Promise<AutoResearchJob[]> {
    return this.researchQueue.getUserJobs(userId);
  }

  /**
   * Cancel a research job
   */
  async cancelJob(_jobId: string): Promise<boolean> {
    return this.researchQueue.cancelJob(_jobId);
  }

  /**
   * Get queue statistics
   */
  getQueueStatus() {
    return this.researchQueue.getQueueStatus();
  }

  /**
   * Subscribe to research notifications
   */
  onNotification(
    _callback: (notification: ResearchNotification) => void,
  ): void {
    this.eventEmitter.on("notification", _callback);
  }

  /**
   * Update service configuration
   */
  updateConfig(config: Partial<AutoResearchConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info("AutoResearchService config updated", { config: this.config });
  }

  // Private methods

  private setupEventListeners(): void {
    // Listen for job completion
    this.researchQueue.onJobCompleted((job) => {
      const notification: ResearchNotification = {
        type: "completed",
        _jobId: job.id,
        url: job.url,
        message: `🎉 リサーチ完了! ${new URL(job.url).hostname} の分析結果をナレッジベースに保存しました。`,
        data: {
          results: job.results,
          processingTime: job.completedAt
            ? job.completedAt.getTime() - job.startedAt!.getTime()
            : 0,
        },
        timestamp: new Date(),
      };

      this.emitNotification(notification);
      logger.info(`Research completed for job ${job.id}`);
    });

    // Listen for job failures
    this.researchQueue.onJobFailed((job) => {
      const notification: ResearchNotification = {
        type: "failed",
        _jobId: job.id,
        url: job.url,
        message: `❌ リサーチに失敗しました: ${job.url} - ${job.error}`,
        data: { _error: job.error },
        timestamp: new Date(),
      };

      this.emitNotification(notification);
      logger.error(`Research failed for job ${job.id}:`, job.error);
    });
  }

  private updateConversationHistory(_userId: string, message: string): void {
    const _history = this.conversationHistory.get(_userId) || [];
    history.push(message);

    // Keep only last 10 messages
    if (_history.length > 10) {
      _history.splice(0, _history.length - 10);
    }

    this.conversationHistory.set(_userId, _history);
  }

  private getConversationHistory(userId: string): string[] {
    return this.conversationHistory.get(userId) || [];
  }

  private shouldStartAutoResearch(
    _priority: unknown,
    _context: ContextAnalysis,
  ): boolean {
    const _minPriorityOrder = { low: 0, medium: 1, high: 2 };
    const _currentPriorityLevel =
      _minPriorityOrder[_priority.level as keyof typeof _minPriorityOrder];
    const _requiredPriorityLevel =
      _minPriorityOrder[this.config.minPriorityForAutoStart];

    // Check _priority threshold
    if (_currentPriorityLevel < _requiredPriorityLevel) {
      return false;
    }

    // Additional _context-based checks
    if (
      _context.userIntent === "research" ||
      _context.userIntent === "question"
    ) {
      return true;
    }

    if (_priority.level === "high") {
      return true;
    }

    if (_priority.level === "medium" && _context.urgencyLevel !== "low") {
      return true;
    }

    return false;
  }

  private addUserJob(_userId: string, _jobId: string): void {
    const _userJobs = this.activeJobs.get(_userId) || [];
    userJobs.push(_jobId);
    this.activeJobs.set(_userId, _userJobs);
  }

  private emitNotification(notification: ResearchNotification): void {
    this.eventEmitter.emit("notification", notification);

    // Handle different notification channels
    if (this.config.notificationChannels.includes("console")) {
      console.log(`[AutoResearch] ${notification.message}`);
    }

    // UI notifications would be handled by the UI layer
    // Webhook notifications would be sent to configured endpoints
  }

  /**
   * Manual research trigger (bypass auto-detection)
   */
  async startManualResearch(
    userId: string,
    url: string,
    options: {
      _priority?: "high" | "medium" | "low";
      _context?: string[];
    } = {},
  ): Promise<string> {
    const detectedUrl: DetectedURL = {
      url,
      originalText: url,
      position: { start: 0, end: url.length },
      type: url.startsWith("https") ? "https" : "http",
      domain: new URL(url).hostname,
      _path: new URL(url).pathname,
      isValid: true,
    };

    const _contextHistory =
      options._context || this.getConversationHistory(userId);
    const _context = this.urlDetector.analyzeContext(url, _contextHistory);

    let _priority = this.urlDetector.calculatePriority(url, _context);
    if (options._priority) {
      _priority = { ..._priority, level: options._priority };
    }

    const _jobId = await this.researchQueue.addJob(
      detectedUrl,
      _context,
      _priority,
      userId,
    );
    this.addUserJob(userId, _jobId);

    const notification: ResearchNotification = {
      type: "started",
      _jobId,
      url,
      message: `🔍 手動リサーチを開始しました: ${url}`,
      data: { _priority, _context },
      timestamp: new Date(),
    };

    this.emitNotification(notification);
    logger.info(`Started manual research for URL: ${url}`, { _jobId, userId });

    return _jobId;
  }

  async cleanup(): Promise<void> {
    await this.researchQueue.cleanup();
    this.eventEmitter.removeAllListeners();
    this.conversationHistory.clear();
    this.activeJobs.clear();
    logger.info("AutoResearchService cleaned up");
  }
}
