// src/services/interactive-session/display/FormatUtils.ts
// Pure functions for formatting - NO side effects, NO console.log

import chalk from "chalk";

/**
 * Format bytes to human readable string
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}

/**
 * Format duration in milliseconds to human readable string
 * @param ms - Duration in milliseconds
 * @returns Formatted string (e.g., "2m 30s")
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Format percentage with optional precision
 * @param value - Value (0-1 or 0-100)
 * @param precision - Decimal places
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number, precision = 0): string {
  const percentage = value <= 1 ? value * 100 : value;
  return `${percentage.toFixed(precision)}%`;
}

/**
 * Format progress bar
 * @param current - Current value
 * @param total - Total value
 * @param width - Bar width in characters
 * @returns Progress bar string
 */
export function formatProgressBar(
  current: number,
  total: number,
  width = 20,
): string {
  const percentage = Math.min(current / total, 1);
  const filled = Math.round(percentage * width);
  const empty = width - filled;

  const bar = "█".repeat(filled) + "░".repeat(empty);
  const percentText = formatPercentage(percentage, 0);

  return `[${bar}] ${percentText}`;
}

/**
 * Format command with proper styling (pure function)
 * @param command - Command name
 * @returns Styled command string
 */
export function formatCommand(command: string): string {
  return chalk.cyan(command);
}

/**
 * Format error message (pure function)
 * @param message - Error message
 * @param code - Optional error code
 * @returns Styled error string
 */
export function formatError(message: string, code?: string): string {
  const prefix = code ? `[${code}] ` : "";
  return chalk.red(`❌ ${prefix}${message}`);
}

/**
 * Format success message (pure function)
 * @param message - Success message
 * @returns Styled success string
 */
export function formatSuccess(message: string): string {
  return chalk.green(`✅ ${message}`);
}

/**
 * Format warning message (pure function)
 * @param message - Warning message
 * @returns Styled warning string
 */
export function formatWarning(message: string): string {
  return chalk.yellow(`⚠️  ${message}`);
}

/**
 * Format info message (pure function)
 * @param message - Info message
 * @returns Styled info string
 */
export function formatInfo(message: string): string {
  return chalk.blue(`ℹ️  ${message}`);
}

/**
 * Format table data
 * @param headers - Column headers
 * @param rows - Data rows
 * @param options - Formatting options
 * @returns Formatted table string
 */
export function formatTable(
  headers: string[],
  rows: string[][],
  options: {
    columnWidths?: number[];
    separator?: string;
    headerColor?: typeof chalk;
  } = {},
): string {
  const {
    columnWidths = headers.map(() => 20),
    separator = " | ",
    headerColor = chalk.cyan.bold,
  } = options;

  // Build header
  const headerRow = headers
    .map((h, i) => headerColor(h.padEnd(columnWidths[i])))
    .join(separator);

  // Build separator line
  const separatorLine = columnWidths.map((w) => "-".repeat(w)).join(separator);

  // Build data rows
  const dataRows = rows.map((row) =>
    row.map((cell, i) => (cell || "").padEnd(columnWidths[i])).join(separator),
  );

  return [headerRow, separatorLine, ...dataRows].join("\n");
}

/**
 * Format key-value pairs
 * @param data - Object with key-value pairs
 * @param options - Formatting options
 * @returns Formatted string
 */
export function formatKeyValue(
  data: Record<string, any>,
  options: {
    keyWidth?: number;
    keyColor?: typeof chalk;
    valueColor?: typeof chalk;
    separator?: string;
  } = {},
): string {
  const {
    keyWidth = 20,
    keyColor = chalk.gray,
    valueColor = chalk.white,
    separator = ": ",
  } = options;

  return Object.entries(data)
    .map(([key, value]) => {
      const formattedKey = keyColor(key.padEnd(keyWidth));
      const formattedValue = valueColor(String(value));
      return `${formattedKey}${separator}${formattedValue}`;
    })
    .join("\n");
}

/**
 * Format code block
 * @param code - Code content
 * @param language - Programming language
 * @returns Formatted code block string
 */
export function formatCodeBlock(code: string, language = "typescript"): string {
  const fence = "```";
  return `${chalk.gray(fence + language)}\n${code}\n${chalk.gray(fence)}`;
}

/**
 * Format list items
 * @param items - List items
 * @param options - Formatting options
 * @returns Formatted list string
 */
export function formatList(
  items: string[],
  options: {
    bullet?: string;
    indent?: number;
    bulletColor?: typeof chalk;
  } = {},
): string {
  const { bullet = "•", indent = 2, bulletColor = chalk.gray } = options;

  const indentStr = " ".repeat(indent);

  return items
    .map((item) => `${indentStr}${bulletColor(bullet)} ${item}`)
    .join("\n");
}

/**
 * Format timestamp
 * @param date - Date object or timestamp
 * @param format - Format type (short/long/iso)
 * @returns Formatted timestamp string
 */
export function formatTimestamp(
  date: Date | number,
  format: "short" | "long" | "iso" = "short",
): string {
  const d = typeof date === "number" ? new Date(date) : date;

  switch (format) {
    case "short":
      return d.toLocaleTimeString();
    case "long":
      return d.toLocaleString();
    case "iso":
      return d.toISOString();
    default:
      return d.toLocaleTimeString();
  }
}

/**
 * Format memory usage
 * @param usage - Memory usage object from process.memoryUsage()
 * @returns Formatted memory string
 */
export function formatMemoryUsage(usage: {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
}): string {
  return formatKeyValue({
    RSS: formatBytes(usage.rss),
    "Heap Total": formatBytes(usage.heapTotal),
    "Heap Used": formatBytes(usage.heapUsed),
    External: formatBytes(usage.external),
  });
}

/**
 * Truncate string with ellipsis
 * @param str - String to truncate
 * @param maxLength - Maximum length
 * @param ellipsis - Ellipsis string
 * @returns Truncated string
 */
export function truncate(
  str: string,
  maxLength: number,
  ellipsis = "...",
): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - ellipsis.length) + ellipsis;
}

/**
 * Wrap text to specified width
 * @param text - Text to wrap
 * @param width - Maximum line width
 * @param indent - Indentation for wrapped lines
 * @returns Wrapped text
 */
export function wrapText(text: string, width: number, indent = 0): string {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";
  const indentStr = " ".repeat(indent);

  for (const word of words) {
    if ((currentLine + " " + word).length > width) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = indentStr + word;
      } else {
        lines.push(word);
      }
    } else {
      currentLine = currentLine ? `${currentLine} ${word}` : word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.join("\n");
}
