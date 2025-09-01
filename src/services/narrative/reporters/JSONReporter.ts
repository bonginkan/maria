/**
 * JSON Reporter - Structured output for CI/CD
 */

import type {
  NarrativeReporter,
  NarrativeEvent,
  Phase,
  LogLevel,
} from "../types.js";
import { RunIdGenerator } from "../utils/RunIdGenerator.js";
import { Masker } from "../security/Masker.js";

export class JSONReporter implements NarrativeReporter {
  private readonly runId: string;
  private readonly masker: Masker;
  private currentPhase?: Phase;

  constructor(runId?: string, redact: boolean = true) {
    this.runId = runId || RunIdGenerator.getInstance().getCurrent();
    this.masker = new Masker(redact);
  }

  private emit(event: Partial<NarrativeEvent>): void {
    const fullEvent: NarrativeEvent = {
      schema_version: "1.0",
      ts: Date.now(),
      run_id: this.runId,
      type: event.type || "update",
      phase: event.phase || this.currentPhase,
      message: event.message,
      attrs: event.attrs,
    };

    // Mask sensitive content in message
    if (fullEvent.message) {
      fullEvent.message = this.masker.mask(fullEvent.message);
    }

    // Output as single-line JSON
    process.stdout.write(JSON.stringify(fullEvent) + "\n");
  }

  thinking(text: string): void {
    this.emit({
      type: "thinking",
      message: `Thinking: ${text}`,
      attrs: { text },
    });
  }

  step(title: string, details?: string, phase?: Phase): void {
    if (phase) {
      this.currentPhase = phase;
    }

    this.emit({
      type: "step",
      phase,
      message: title,
      attrs: { title, details },
    });
  }

  write(target: string, bytes?: number): void {
    this.emit({
      type: "write",
      message: `Write(${target})`,
      attrs: { target, bytes },
    });
  }

  bash(cmd: string, exitCode?: number): void {
    const maskedCmd = this.masker.maskCommand(cmd);

    this.emit({
      type: "bash",
      message: `Bash(${maskedCmd})`,
      attrs: {
        cmd: maskedCmd,
        exitCode,
        success: exitCode === 0 || exitCode === undefined,
      },
    });
  }

  search(pattern: string, where?: string, hits?: number): void {
    this.emit({
      type: "search",
      message: `Search(pattern: "${pattern}"${where ? `, path: "${where}"` : ""}${hits !== undefined ? `, hits: ${hits}` : ""})`,
      attrs: { pattern, where, hits },
    });
  }

  read(file: string, lines?: number, truncated?: boolean): void {
    // Check if file should be redacted
    if (this.masker.isFileRedacted(file)) {
      this.emit({
        type: "read",
        message: this.masker.getRedactedFileSummary(file),
        attrs: {
          file,
          redacted: true,
        },
      });
      return;
    }

    this.emit({
      type: "read",
      message: `Read(${file})${lines ? ` ${lines} lines` : ""}${truncated ? " (truncated)" : ""}`,
      attrs: { file, lines, truncated },
    });
  }

  update(message: string, level: LogLevel = "info"): void {
    const maskedMessage = this.masker.mask(message);

    this.emit({
      type: "update",
      message: maskedMessage,
      attrs: { level },
    });
  }

  compact(reason?: string, omitted?: number): void {
    this.emit({
      type: "compact",
      message: `Compacting conversation${reason ? `: ${reason}` : ""}`,
      attrs: { reason, omitted },
    });
  }

  summary(stats: Record<string, unknown>): void {
    this.emit({
      type: "summary",
      message: "Summary",
      attrs: { stats },
    });
  }
}
