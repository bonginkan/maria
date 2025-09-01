/**
 * Narrative Reporter Type Definitions
 * Schema Version 1.0
 */

export type EventType =
  | "thinking"
  | "step"
  | "write"
  | "bash"
  | "search"
  | "read"
  | "update"
  | "compact"
  | "summary";

export type Phase =
  | "phase1.scan"
  | "phase2.graph"
  | "phase3.index"
  | "phase4.artifacts";

export type LogLevel = "info" | "warn" | "error" | "debug";

export interface NarrativeEvent {
  schema_version: "1.0";
  ts: number;
  run_id: string;
  type: EventType;
  phase?: Phase;
  message?: string;
  attrs?: Record<string, unknown>;
}

export interface NarrativeReporter {
  thinking(text: string): void;
  step(title: string, details?: string, phase?: Phase): void;
  write(target: string, bytes?: number): void;
  bash(cmd: string, exitCode?: number): void;
  search(pattern: string, where?: string, hits?: number): void;
  read(file: string, lines?: number, truncated?: boolean): void;
  update(message: string, level?: LogLevel): void;
  compact(reason?: string, omitted?: number): void;
  summary(stats: Record<string, unknown>): void;
}

export interface ReporterOptions {
  mode?: "tty" | "json" | "null";
  isTTY?: boolean;
  runId?: string;
  redact?: boolean;
  compactThreshold?: number;
  verbose?: boolean;
}

export interface CompactState {
  eventCount: number;
  windowStart: number;
  totalOmitted: number;
}

/**
 * JSON Schema v1.0 for structured output
 */
export const JSON_SCHEMA_V1 = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  required: ["schema_version", "ts", "run_id", "type"],
  properties: {
    schema_version: { const: "1.0" },
    ts: { type: "number" },
    run_id: { type: "string" },
    type: {
      enum: [
        "thinking",
        "step",
        "write",
        "bash",
        "search",
        "read",
        "update",
        "compact",
        "summary",
      ],
    },
    phase: {
      enum: ["phase1.scan", "phase2.graph", "phase3.index", "phase4.artifacts"],
    },
    message: { type: "string" },
    attrs: { type: "object" },
  },
};
