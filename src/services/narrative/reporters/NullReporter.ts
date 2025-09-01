/**
 * Null Reporter - Silent mode implementation
 */

import type { NarrativeReporter, Phase, LogLevel } from "../types.js";

export class NullReporter implements NarrativeReporter {
  thinking(_text: string): void {
    // Silent - no output
  }

  step(_title: string, _details?: string, _phase?: Phase): void {
    // Silent - no output
  }

  write(_target: string, _bytes?: number): void {
    // Silent - no output
  }

  bash(_cmd: string, _exitCode?: number): void {
    // Silent - no output
  }

  search(_pattern: string, _where?: string, _hits?: number): void {
    // Silent - no output
  }

  read(_file: string, _lines?: number, _truncated?: boolean): void {
    // Silent - no output
  }

  update(_message: string, _level?: LogLevel): void {
    // Silent - no output
  }

  compact(_reason?: string, _omitted?: number): void {
    // Silent - no output
  }

  summary(_stats: Record<string, unknown>): void {
    // Silent - no output
  }
}
