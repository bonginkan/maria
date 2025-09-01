/**
 * Async Research Queue Service
 * Manages background URL research processing with priority queuing
 */

import { logger } from "../../utils/logger";
import { BaseService } from "../../internal-mode/core/BaseService";
import { EventEmitter } from "node:events";
import { ResearchCommand } from "../../shared/handlers/SlashCommandHandler";
import { DetectedURL, ContextAnalysis, Priority } from "./URLDetectionService";

export interface AutoResearchJob {
  id: string;
  url: string;
  priority: Priority;
  requestedBy: string;
  context: ContextAnalysis;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  estimatedCompletion?: Date;
  results?: ResearchResults;
  _error?: string;
  retryCount: number;
  maxRetries: number;
}

export interface ResearchResults {
  content: {
    title: string;
    summary: string;
    keyPoints: string[];
    fullText?: string;
    wordCount: number;
  };
  analysis: {
    insights: string[];
    actionItems: string[];
    questions: string[];
    relatedTopics: string[];
  };
  metadata: {
    _processingTime: number;
    confidence: number;
    sources: string[];
    analyzedAt: Date;
  };
  knowledgeBaseId?: string;
}

export interface Progress {
  stage:
    | "queued"
    | "fetching"
    | "extracting"
    | "analyzing"
    | "saving"
    | "completed";
  progress: number; // 0-100
  message: string;
  estimatedTimeRemaining?: number; // seconds
}

export class AsyncResearchQueue extends BaseService {
  id = "async-research-queue";
  version = "1.0.0";
  
  private _jobs = new Map<string, AutoResearchJob>();
  private processingQueue: string[] = [];
  private isProcessing = false;
  private maxConcurrentJobs = 3;
  private currentJobs = new Set<string>();
  private eventEmitter = new EventEmitter();

  private researchService: ResearchCommand;

  constructor() {
    super();
    this.researchService = new ResearchCommand();
  }

  async initialize(): Promise<void> {
    await this.researchService.initialize?.();

    // Start queue processing
    this.startQueueProcessor();

    logger.info("AsyncResearchQueue initialized");
  }

  /**
   * Add a new research _job to the queue
   */
  async addJob(
    detectedUrl: DetectedURL,
    context: ContextAnalysis,
    priority: Priority,
    requestedBy: string,
  ): Promise<string> {
    const _jobId = this.generateJobId();

    const _job: AutoResearchJob = {
      id: _jobId,
      url: detectedUrl.url,
      priority,
      requestedBy,
      context,
      status: "pending",
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: 2,
    };

    // Estimate completion time based on queue and priority
    job.estimatedCompletion = this.estimateCompletionTime(priority);

    this.jobs.set(_jobId, _job);
    this.addToQueue(_jobId, priority);

    logger.info(`Added research _job ${_jobId} for URL: ${detectedUrl.url}`);

    // Emit _job added event
    this.eventEmitter.emit("jobAdded", _job);

    return _jobId;
  }

  /**
   * Get _job by ID
   */
  async getJob(_jobId: string): Promise<AutoResearchJob | null> {
    return this.jobs.get(_jobId) || null;
  }

  /**
   * Get all _jobs for a user
   */
  async getUserJobs(userId: string): Promise<AutoResearchJob[]> {
    return Array.from(this.jobs.values())
      .filter((_job) => _job.requestedBy === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Cancel a pending or processing _job
   */
  async cancelJob(_jobId: string): Promise<boolean> {
    const _job = this.jobs.get(_jobId);
    if (!_job || _job.status === "completed" || _job.status === "failed") {
      return false;
    }

    _job.status = "cancelled";
    job.completedAt = new Date();

    // Remove from queue if pending
    const _queueIndex = this.processingQueue.indexOf(_jobId);
    if (_queueIndex > -1) {
      this.processingQueue.splice(_queueIndex, 1);
    }

    // Remove from current _jobs if processing
    this.currentJobs.delete(_jobId);

    this.eventEmitter.emit("jobCancelled", _job);
    logger.info(`Cancelled research _job ${_jobId}`);

    return true;
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    totalJobs: number;
    pendingJobs: number;
    processingJobs: number;
    _completedJobs: number;
    failedJobs: number;
    averageProcessingTime: number;
  } {
    const _jobs = Array.from(this._jobs.values());

    return {
      totalJobs: _jobs.length,
      pendingJobs: _jobs.filter((j) => j.status === "pending").length,
      processingJobs: _jobs.filter((j) => j.status === "processing").length,
      _completedJobs: _jobs.filter((j) => j.status === "completed").length,
      failedJobs: _jobs.filter((j) => j.status === "failed").length,
      averageProcessingTime: this.calculateAverageProcessingTime(_jobs),
    };
  }

  /**
   * Subscribe to _job events
   */
  onJobUpdate(_callback: (_job: AutoResearchJob) => void): void {
    this.eventEmitter.on("jobUpdated", _callback);
  }

  onJobCompleted(_callback: (_job: AutoResearchJob) => void): void {
    this.eventEmitter.on("jobCompleted", _callback);
  }

  onJobFailed(_callback: (_job: AutoResearchJob) => void): void {
    this.eventEmitter.on("jobFailed", _callback);
  }

  // Private methods

  private generateJobId(): string {
    return `research_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private addToQueue(_jobId: string, priority: Priority): void {
    // Insert _job based on priority
    if (priority.level === "high") {
      // Add to beginning for high priority
      this.processingQueue.unshift(_jobId);
    } else if (priority.level === "medium") {
      // Add after high priority _jobs but before low priority
      const _highPriorityCount = this.processingQueue.filter((id) => {
        const _job = this.jobs.get(id);
        return _job?.priority.level === "high";
      }).length;
      this.processingQueue.splice(_highPriorityCount, 0, _jobId);
    } else {
      // Add to end for low priority
      this.processingQueue.push(_jobId);
    }
  }

  private estimateCompletionTime(priority: Priority): Date {
    const _baseProcessingTime = 45; // seconds
    const _queueWaitTime = this.processingQueue.length * 15; // 15s per _job in queue

    let priorityMultiplier = 1;
    if (priority.level === "high") priorityMultiplier = 0.8;
    else if (priority.level === "low") priorityMultiplier = 1.2;

    const _totalSeconds =
      (_baseProcessingTime + _queueWaitTime) * priorityMultiplier;
    return new Date(Date.now() + _totalSeconds * 1000);
  }

  private startQueueProcessor(): void {
    if (this.isProcessing) return;

    this.isProcessing = true;
    this.processQueueLoop();
  }

  private async processQueueLoop(): Promise<void> {
    while (this.isProcessing) {
      try {
        await this.processNextJobs();
        await this.sleep(1000); // Check every second
      } catch (_error) {
        logger.error("Error in queue processing loop:", _error);
        await this.sleep(5000); // Wait longer on _error
      }
    }
  }

  private async processNextJobs(): Promise<void> {
    while (
      this.currentJobs.size < this.maxConcurrentJobs &&
      this.processingQueue.length > 0
    ) {
      const _jobId = this.processingQueue.shift();
      if (!_jobId) continue;

      const _job = this.jobs.get(_jobId);
      if (!_job || _job.status !== "pending") continue;

      this.currentJobs.add(_jobId);

      // Process _job asynchronously
      this.processJob(_job)
        .catch((_error) => {
          logger.error(`Error processing _job ${_jobId}:`, _error);
        })
        .finally(() => {
          this.currentJobs.delete(_jobId);
        });
    }
  }

  private async processJob(_job: AutoResearchJob): Promise<void> {
    try {
      job.status = "processing";
      job.startedAt = new Date();

      this.updateProgress(job.id, {
        stage: "fetching",
        progress: 10,
        message: "Fetching URL content...",
        estimatedTimeRemaining: 30,
      });

      // Use research service to process the URL
      const _researchResult = await this.conductResearch(_job);

      job.results = _researchResult;
      job.status = "completed";
      job.completedAt = new Date();

      this.updateProgress(job.id, {
        stage: "completed",
        progress: 100,
        message: "Research completed successfully!",
      });

      this.eventEmitter.emit("jobCompleted", _job);
      logger.info(`Completed research _job ${job.id}`);
    } catch (_error) {
      await this.handleJobError(_job, _error);
    }
  }

  private async conductResearch(
    _job: AutoResearchJob,
  ): Promise<ResearchResults> {
    const _startTime = Date.now();

    try {
      // Update progress
      this.updateProgress(_job.id, {
        stage: "extracting",
        progress: 30,
        message: "Extracting content...",
        estimatedTimeRemaining: 25,
      });

      // Mock research execution (in real implementation, would use ResearchCommand)
      // For now, simulate the research process
      await this.sleep(2000); // Simulate content extraction

      this.updateProgress(_job.id, {
        stage: "analyzing",
        progress: 60,
        message: "Analyzing content with AI...",
        estimatedTimeRemaining: 15,
      });

      await this.sleep(3000); // Simulate AI analysis

      this.updateProgress(_job.id, {
        stage: "saving",
        progress: 90,
        message: "Saving to knowledge base...",
        estimatedTimeRemaining: 5,
      });

      await this.sleep(1000); // Simulate KB save

      // Create mock results (in real implementation, would come from ResearchCommand)
      const _processingTime = Date.now() - _startTime;

      return {
        content: {
          title: `Research Results for ${new URL(_job.url).hostname}`,
          summary: `Automated research completed for ${_job.url}`,
          keyPoints: [
            "Content successfully extracted and analyzed",
            "Added to knowledge base",
            `Processing completed in ${Math.round(_processingTime / 1000)} seconds`,
          ],
          wordCount: 500,
        },
        analysis: {
          insights: ["Valuable information source identified"],
          actionItems: [
            "Review research results",
            "Consider follow-up research",
          ],
          questions: ["What additional information might be needed?"],
          relatedTopics: _job.context.relatedKeywords,
        },
        metadata: {
          _processingTime,
          confidence: 0.85,
          sources: [_job.url],
          analyzedAt: new Date(),
        },
      };
    } catch (_error) {
      logger.error(`Research failed for _job ${_job.id}:`, _error);
      throw _error;
    }
  }

  private async handleJobError(
    _job: AutoResearchJob,
    _error: unknown,
  ): Promise<void> {
    job.retryCount++;

    if (job.retryCount <= job.maxRetries) {
      // Retry the _job
      logger.info(
        `Retrying _job ${job.id} (attempt ${job.retryCount}/${job.maxRetries})`,
      );
      job.status = "pending";
      this.addToQueue(job.id, job.priority);

      this.updateProgress(job.id, {
        stage: "queued",
        progress: 0,
        message: `Retrying... (attempt ${job.retryCount}/${job.maxRetries})`,
        estimatedTimeRemaining: 30,
      });
    } else {
      // Job failed permanently
      job.status = "failed";
      job.completedAt = new Date();
      job.error = _error instanceof Error ? error.message : String(_error);

      this.updateProgress(job.id, {
        stage: "completed",
        progress: 100,
        message: `Research failed: ${job.error}`,
      });

      this.eventEmitter.emit("jobFailed", _job);
      logger.error(`Job ${job.id} failed permanently:`, _error);
    }
  }

  private updateProgress(_jobId: string, progress: Progress): void {
    this.eventEmitter.emit("progressUpdate", { _jobId, progress });
  }

  private calculateAverageProcessingTime(_jobs: AutoResearchJob[]): number {
    const _completedJobs = _jobs.filter(
      (_job) =>
        _job.status === "completed" && _job.startedAt && _job.completedAt,
    );

    if (_completedJobs.length === 0) return 0;

    const _totalTime = _completedJobs.reduce((sum, _job) => {
      const _processingTime =
        _job.completedAt!.getTime() - _job.startedAt!.getTime();
      return sum + _processingTime;
    }, 0);

    return Math.round(_totalTime / _completedJobs.length / 1000); // Convert to seconds
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async cleanup(): Promise<void> {
    this.isProcessing = false;
    this.eventEmitter.removeAllListeners();
    logger.info("AsyncResearchQueue cleaned up");
  }
}
