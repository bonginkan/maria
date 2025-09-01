// src/services/hsr-system/themes/branded-style.ts
/**
 * HSR Branded Style System - Simple Text-Based Design
 * シンプルな文字ベースのブランデッドスタイル
 */

export class HSRBrandedStyle {
  // Core Brand Elements (文字ベース)
  brand(text: string): string {
    return `[${text}]`; // Simple brackets for branding
  }

  heading(text: string): string {
    return text.toUpperCase(); // Bold through caps
  }

  accent(text: string): string {
    return `>> ${text}`; // Simple ASCII accent
  }

  muted(text: string): string {
    return `(${text})`; // Parentheses for muted text
  }

  hint(text: string): string {
    return `<${text}>`; // Angle brackets for hints
  }

  // Status Indicators (文字ベース)
  ok(text: string): string {
    return `[OK] ${text}`;
  }

  warn(text: string): string {
    return `[WARN] ${text}`;
  }

  err(text: string): string {
    return `[ERROR] ${text}`;
  }

  // Interactive Elements
  selected(text: string): string {
    return `=> ${text}`;
  }

  option(text: string): string {
    return `- ${text}`;
  }

  checkbox(checked: boolean): string {
    return checked ? "[x]" : "[ ]";
  }

  // Progress Visualization (文字ベース)
  progress(percent: number): string {
    const _filled = Math.floor(percent / 10);
    const _empty = 10 - _filled;
    return "[" + "=".repeat(_filled) + "-".repeat(_empty) + "]";
  }

  // Layout Helpers
  separator(): string {
    return "-- ";
  }

  divider(): string {
    return " | ";
  }

  bullet(): string {
    return "* ";
  }

  // Interactive Prompt Styling
  suggestions(text: string): string {
    return `* ${text}`;
  }

  controls(text: string): string {
    return `(${text})`;
  }
}
