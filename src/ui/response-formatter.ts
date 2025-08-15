export interface FormatOptions {
  format?: 'json' | 'text' | 'table' | 'markdown';
  pretty?: boolean;
  colors?: boolean;
}

export class ResponseFormatter {
  static format(data: unknown, options: FormatOptions = {}): string {
    const { format = 'text', pretty = true, colors = true } = options;

    switch (format) {
      case 'json':
        return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);

      case 'markdown':
        return this.toMarkdown(data);

      case 'table':
        return this.toTable(data);

      case 'text':
      default:
        return this.toText(data, colors);
    }
  }

  private static toText(data: unknown, colors: boolean): string {
    if (typeof data === 'string') {
      return data;
    }
    if (typeof data === 'number' || typeof data === 'boolean') {
      return String(data);
    }
    if (Array.isArray(data)) {
      return data.map((item) => this.toText(item, colors)).join('\n');
    }
    if (typeof data === 'object' && data !== null) {
      return Object.entries(data)
        .map(([key, value]) => `${key}: ${this.toText(value, colors)}`)
        .join('\n');
    }
    return '';
  }

  private static toMarkdown(data: unknown): string {
    if (typeof data === 'string') {
      return data;
    }
    if (Array.isArray(data)) {
      return data.map((item) => `- ${this.toMarkdown(item)}`).join('\n');
    }
    if (typeof data === 'object' && data !== null) {
      return Object.entries(data)
        .map(([key, value]) => `**${key}**: ${this.toMarkdown(value)}`)
        .join('\n\n');
    }
    return String(data);
  }

  private static toTable(data: unknown): string {
    if (!Array.isArray(data) || data.length === 0) {
      return this.toText(data, false);
    }

    const firstItem = data[0];
    if (typeof firstItem !== 'object' || firstItem === null) {
      return this.toText(data, false);
    }

    const headers = Object.keys(firstItem);
    const rows = data.map((item) =>
      headers.map((h) => String((item as Record<string, unknown>)[h] ?? '')),
    );

    const columnWidths = headers.map((h, i) =>
      Math.max(h.length, ...rows.map((r) => r[i]?.length || 0)),
    );

    const separator = '+' + columnWidths.map((w) => '-'.repeat(w + 2)).join('+') + '+';
    const headerRow =
      '|' + headers.map((h, i) => ` ${h.padEnd(columnWidths[i] || 0)} `).join('|') + '|';
    const dataRows = rows.map(
      (row) => '|' + row.map((cell, i) => ` ${cell.padEnd(columnWidths[i] || 0)} `).join('|') + '|',
    );

    return [separator, headerRow, separator, ...dataRows, separator].join('\n');
  }
}
