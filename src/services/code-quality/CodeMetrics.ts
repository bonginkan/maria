/**
 * CodeMetrics - Telemetry and loop detection system for /code command
 * Tracks execution metrics, detects infinite loops, and provides analytics
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { createHash } from "crypto";

export interface MetricEvent {
  t: string; // Event type
  ts: number; // Timestamp
  sessionId?: string; // Session identifier
  state?: string; // Current state
  iter?: number; // Iteration count
  duration?: number; // Duration in ms
  artifactHash?: string; // Hash of generated artifact
  templateHit?: boolean; // Template was used
  cacheHit?: boolean; // Cache was hit
  model?: string; // AI model used
  error?: string; // Error message if any
  transition?: string; // State transition
  [key: string]: any; // Additional fields
}

export interface SessionSummary {
  sessionId: string;
  startTime: number;
  endTime: number;
  totalDuration: number;
  iterations: number;
  states: string[];
  transitions: string[];
  templateHit: boolean;
  cacheHit: boolean;
  model?: string;
  success: boolean;
  loopDetected: boolean;
  errorCount: number;
}

/**
 * Metrics and telemetry system with loop detection
 */
export class CodeMetrics {
  private readonly logDir: string;
  private readonly logPath: string;
  private currentSession: MetricEvent[] = [];
  private sessionId: string;
  private loopDetected = false;
  private writeStream: fs.WriteStream | null = null;

  constructor() {
    // Create log directory in user home
    this.logDir = path.join(os.homedir(), ".maria", "logs");
    this.logPath = path.join(this.logDir, "code-metrics.jsonl");
    this.sessionId = this.generateSessionId();

    // Ensure log directory exists
    this.ensureLogDir();

    // Open write stream for append
    this.openStream();
  }

  /**
   * Record a metric event
   */
  record(event: Partial<MetricEvent>): void {
    const fullEvent: MetricEvent = {
      t: event.t || "event",
      ts: Date.now(),
      sessionId: this.sessionId,
      ...event,
    };

    // Add to current session
    this.currentSession.push(fullEvent);

    // Write to JSONL file
    this.writeToLog(fullEvent);

    // Check for loops if state transition
    if (event.state || event.transition) {
      this.detectLoop();
    }

    // Auto-detect certain conditions
    this.detectAnomalies(fullEvent);
  }

  /**
   * Start a new session
   */
  startSession(sessionId?: string): void {
    this.sessionId = sessionId || this.generateSessionId();
    this.currentSession = [];
    this.loopDetected = false;

    this.record({
      t: "session_start",
      sessionId: this.sessionId,
    });
  }

  /**
   * End current session and generate summary
   */
  endSession(): SessionSummary {
    const summary = this.generateSummary();

    this.record({
      t: "session_end",
      summary,
    });

    // Reset for next session
    this.currentSession = [];
    this.loopDetected = false;

    return summary;
  }

  /**
   * Detect infinite loops in state transitions
   */
  detectLoop(): boolean {
    const states = this.currentSession
      .filter((e) => e.state)
      .map((e) => e.state);

    if (states.length < 2) return false;

    // Check for immediate illegal transitions
    for (let i = 0; i < states.length - 1; i++) {
      const current = states[i];
      const next = states[i + 1];

      // FINAL → anything except DONE/ERROR is a loop
      if (current === "FINAL" && next !== "DONE" && next !== "ERROR") {
        this.loopDetected = true;
        this.record({
          t: "loop_detected",
          error: "Illegal transition from FINAL",
          transition: `${current} → ${next}`,
          severity: "critical",
        });

        console.error(`🚨 LOOP DETECTED: ${current} → ${next}`);

        // Force process exit to prevent infinite loop
        if (process.env.NODE_ENV !== "test") {
          process.exit(1);
        }

        return true;
      }

      // DONE → anything is a loop
      if (current === "DONE" && next !== "DONE") {
        this.loopDetected = true;
        this.record({
          t: "loop_detected",
          error: "Illegal transition from DONE",
          transition: `${current} → ${next}`,
          severity: "critical",
        });

        return true;
      }
    }

    // Check for repetitive patterns
    if (states.length >= 6) {
      const recent = states.slice(-6).join(",");
      const pattern1 = states.slice(-6, -3).join(",");
      const pattern2 = states.slice(-3).join(",");

      if (pattern1 === pattern2 && pattern1.length > 0) {
        this.loopDetected = true;
        this.record({
          t: "loop_detected",
          error: "Repetitive state pattern",
          pattern: pattern1,
          severity: "warning",
        });

        console.warn(`⚠️ Repetitive pattern detected: ${pattern1}`);
        return true;
      }
    }

    // Check for too many iterations
    const iterations = this.currentSession
      .filter((e) => e.iter)
      .map((e) => e.iter);
    const maxIter = Math.max(...iterations, 0);

    if (maxIter > 5) {
      this.loopDetected = true;
      this.record({
        t: "loop_detected",
        error: "Too many iterations",
        iterations: maxIter,
        severity: "warning",
      });

      console.warn(`⚠️ High iteration count: ${maxIter}`);
      return true;
    }

    return false;
  }

  /**
   * Detect anomalies in metrics
   */
  private detectAnomalies(event: MetricEvent): void {
    // Detect long execution times
    if (event.duration && event.duration > 10000) {
      this.record({
        t: "anomaly",
        type: "slow_execution",
        duration: event.duration,
        threshold: 10000,
      });
    }

    // Detect duplicate artifact generation
    if (event.artifactHash) {
      const previousHashes = this.currentSession
        .filter((e) => e.artifactHash && e.ts < event.ts)
        .map((e) => e.artifactHash);

      if (previousHashes.includes(event.artifactHash)) {
        this.record({
          t: "anomaly",
          type: "duplicate_artifact",
          hash: event.artifactHash,
          occurrences:
            previousHashes.filter((h) => h === event.artifactHash).length + 1,
        });
      }
    }

    // Detect error accumulation
    const errorCount = this.currentSession.filter((e) => e.error).length;
    if (errorCount > 3) {
      this.record({
        t: "anomaly",
        type: "high_error_rate",
        errorCount,
      });
    }
  }

  /**
   * Generate session summary
   */
  private generateSummary(): SessionSummary {
    const events = this.currentSession;
    if (events.length === 0) {
      return {
        sessionId: this.sessionId,
        startTime: Date.now(),
        endTime: Date.now(),
        totalDuration: 0,
        iterations: 0,
        states: [],
        transitions: [],
        templateHit: false,
        cacheHit: false,
        success: false,
        loopDetected: false,
        errorCount: 0,
      };
    }

    const startTime = events[0].ts;
    const endTime = events[events.length - 1].ts;

    const states = [
      ...new Set(events.filter((e) => e.state).map((e) => e.state!)),
    ];
    const transitions = events
      .filter((e) => e.transition)
      .map((e) => e.transition!);

    const iterations = Math.max(
      ...events.filter((e) => e.iter !== undefined).map((e) => e.iter!),
      0,
    );

    const templateHit = events.some((e) => e.templateHit);
    const cacheHit = events.some((e) => e.cacheHit);
    const model = events.find((e) => e.model)?.model;
    const errorCount = events.filter((e) => e.error).length;
    const success = errorCount === 0 && !this.loopDetected;

    return {
      sessionId: this.sessionId,
      startTime,
      endTime,
      totalDuration: endTime - startTime,
      iterations,
      states,
      transitions,
      templateHit,
      cacheHit,
      model,
      success,
      loopDetected: this.loopDetected,
      errorCount,
    };
  }

  /**
   * Get current session metrics
   */
  getCurrentSession(): MetricEvent[] {
    return [...this.currentSession];
  }

  /**
   * Get aggregated statistics from log file
   */
  async getAggregatedStats(): Promise<{
    totalSessions: number;
    averageDuration: number;
    templateHitRate: number;
    cacheHitRate: number;
    loopRate: number;
    errorRate: number;
    modelUsage: Record<string, number>;
    stateDistribution: Record<string, number>;
  }> {
    try {
      const content = fs.readFileSync(this.logPath, "utf8");
      const lines = content.split("\n").filter(Boolean);
      const events = lines.map((line) => JSON.parse(line) as MetricEvent);

      // Group by session
      const sessions = new Map<string, MetricEvent[]>();
      for (const event of events) {
        const sid = event.sessionId || "unknown";
        if (!sessions.has(sid)) {
          sessions.set(sid, []);
        }
        sessions.get(sid)!.push(event);
      }

      // Calculate statistics
      let totalDuration = 0;
      let templateHits = 0;
      let cacheHits = 0;
      let loops = 0;
      let errors = 0;
      const modelUsage: Record<string, number> = {};
      const stateDistribution: Record<string, number> = {};

      for (const [_, sessionEvents] of sessions) {
        const summary = this.summarizeEvents(sessionEvents);
        totalDuration += summary.totalDuration;
        if (summary.templateHit) templateHits++;
        if (summary.cacheHit) cacheHits++;
        if (summary.loopDetected) loops++;
        if (summary.errorCount > 0) errors++;

        if (summary.model) {
          modelUsage[summary.model] = (modelUsage[summary.model] || 0) + 1;
        }

        for (const state of summary.states) {
          stateDistribution[state] = (stateDistribution[state] || 0) + 1;
        }
      }

      const totalSessions = sessions.size;

      return {
        totalSessions,
        averageDuration: totalSessions > 0 ? totalDuration / totalSessions : 0,
        templateHitRate: totalSessions > 0 ? templateHits / totalSessions : 0,
        cacheHitRate: totalSessions > 0 ? cacheHits / totalSessions : 0,
        loopRate: totalSessions > 0 ? loops / totalSessions : 0,
        errorRate: totalSessions > 0 ? errors / totalSessions : 0,
        modelUsage,
        stateDistribution,
      };
    } catch (error) {
      // Return empty stats if file doesn't exist
      return {
        totalSessions: 0,
        averageDuration: 0,
        templateHitRate: 0,
        cacheHitRate: 0,
        loopRate: 0,
        errorRate: 0,
        modelUsage: {},
        stateDistribution: {},
      };
    }
  }

  /**
   * Summarize events into a summary
   */
  private summarizeEvents(events: MetricEvent[]): SessionSummary {
    const oldSession = this.currentSession;
    const oldLoopDetected = this.loopDetected;

    this.currentSession = events;
    const summary = this.generateSummary();

    this.currentSession = oldSession;
    this.loopDetected = oldLoopDetected;

    return summary;
  }

  /**
   * Ensure log directory exists
   */
  private ensureLogDir(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Open write stream for logging
   */
  private openStream(): void {
    this.writeStream = fs.createWriteStream(this.logPath, {
      flags: "a", // Append mode
      encoding: "utf8",
    });
  }

  /**
   * Write event to log file
   */
  private writeToLog(event: MetricEvent): void {
    if (this.writeStream) {
      this.writeStream.write(JSON.stringify(event) + "\n");
    } else {
      // Fallback to sync write
      fs.appendFileSync(this.logPath, JSON.stringify(event) + "\n");
    }
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `code_${timestamp}_${random}`;
  }

  /**
   * Hash an artifact for comparison
   */
  hashArtifact(artifact: string): string {
    return createHash("sha256").update(artifact).digest("hex").substring(0, 16);
  }

  /**
   * Close the metrics system
   */
  close(): void {
    if (this.writeStream) {
      this.writeStream.end();
      this.writeStream = null;
    }
  }

  /**
   * Clear all metrics (for testing)
   */
  clear(): void {
    this.currentSession = [];
    this.loopDetected = false;
    if (fs.existsSync(this.logPath)) {
      fs.unlinkSync(this.logPath);
    }
  }
}

/**
 * Export singleton instance
 */
export const codeMetrics = new CodeMetrics();
