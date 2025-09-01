/**
 * Rendering utilities for enhanced model selector
 */

/**
 * Move cursor to absolute position
 */
export function goto(row: number, col: number): void {
  process.stdout.write(`\x1b[${row};${col}H`);
}

/**
 * Erase line content
 * @param mode 0=to end, 1=to start, 2=entire line
 */
export function eraseLine(mode: 0 | 1 | 2 = 0): void {
  process.stdout.write(`\x1b[${mode}K`);
}

/**
 * Write text and move to next line
 */
export function writeLine(text: string): void {
  process.stdout.write(text + "\n");
}

/**
 * Clear screen and move to home position
 */
export function clearScreen(): void {
  process.stdout.write("\x1b[2J\x1b[H");
}

/**
 * Fit text to specified width, truncating with ellipsis if needed
 */
export function fitText(text: string, width: number): string {
  // Remove ANSI escape sequences to calculate actual width
  const plainText = stripAnsi(text);

  if (plainText.length <= width) {
    // Pad with spaces to exact width
    const padding = width - plainText.length;
    return text + " ".repeat(padding);
  }

  // Truncate and add ellipsis
  const truncated = plainText.substring(0, width - 1);
  return truncated + "…";
}

/**
 * Strip ANSI escape sequences from text
 */
export function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * Clamp number to range
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Format number with thousands separator
 */
export function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * Truncate text to max length
 */
export function truncate(
  text: string,
  maxLength: number,
  suffix = "...",
): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Center text within given width
 */
export function centerText(text: string, width: number): string {
  const plainText = stripAnsi(text);
  if (plainText.length >= width) return text;

  const padding = width - plainText.length;
  const leftPad = Math.floor(padding / 2);
  const rightPad = padding - leftPad;

  return " ".repeat(leftPad) + text + " ".repeat(rightPad);
}

/**
 * Create a progress bar
 */
export function createProgressBar(
  current: number,
  total: number,
  width: number = 20,
  filled = "█",
  empty = "░",
): string {
  if (total === 0) return empty.repeat(width);

  const progress = Math.min(1, Math.max(0, current / total));
  const filledWidth = Math.round(progress * width);
  const emptyWidth = width - filledWidth;

  return filled.repeat(filledWidth) + empty.repeat(emptyWidth);
}

/**
 * Box drawing characters
 */
export const BoxChars = {
  topLeft: "┌",
  topRight: "┐",
  bottomLeft: "└",
  bottomRight: "┘",
  horizontal: "─",
  vertical: "│",
  cross: "┼",
  teeUp: "┴",
  teeDown: "┬",
  teeLeft: "┤",
  teeRight: "├",
  heavyHorizontal: "━",
  heavyVertical: "┃",
  lightShade: "░",
  mediumShade: "▒",
  darkShade: "▓",
  block: "█",
} as const;

/**
 * ANSI color codes
 */
export const Colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",
  blink: "\x1b[5m",
  reverse: "\x1b[7m",
  strikethrough: "\x1b[9m",

  // Foreground colors
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",

  // Bright foreground colors
  brightRed: "\x1b[91m",
  brightGreen: "\x1b[92m",
  brightYellow: "\x1b[93m",
  brightBlue: "\x1b[94m",
  brightMagenta: "\x1b[95m",
  brightCyan: "\x1b[96m",
  brightWhite: "\x1b[97m",

  // Background colors
  bgBlack: "\x1b[40m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
  bgWhite: "\x1b[47m",
} as const;

/**
 * Create colored text
 */
export function colorize(text: string, color: string): string {
  return color + text + Colors.reset;
}

/**
 * Create bold text
 */
export function bold(text: string): string {
  return Colors.bright + text + Colors.reset;
}

/**
 * Create dim text
 */
export function dim(text: string): string {
  return Colors.dim + text + Colors.reset;
}

/**
 * Calculate optimal layout for two-panel display
 */
export function calculatePanelLayout(
  totalWidth: number,
  leftMinWidth: number = 40,
  rightMinWidth: number = 30,
): { leftWidth: number; rightWidth: number; rightX: number } | null {
  if (totalWidth < leftMinWidth + rightMinWidth + 3) {
    // Not enough space for two panels
    return null;
  }

  // Use golden ratio for pleasant proportions
  const leftWidth = Math.floor(totalWidth * 0.62);
  const rightWidth = totalWidth - leftWidth - 3; // 3 for separator
  const rightX = leftWidth + 2;

  return { leftWidth, rightWidth, rightX };
}
