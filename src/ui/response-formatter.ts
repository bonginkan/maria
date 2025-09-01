export interface FormatOptions {
  format?: "json" | "text" | "table" | "markdown";
  pretty?: boolean;
  colors?: boolean;
}

export class ResponseFormatter {
  static format(_data: unknown, options: FormatOptions = {}): string {
    const { format = "text", pretty = true, colors = true } = options;

    switch (format) {
      case "json":
        return pretty ? JSON.stringify(_data, null, 2) : JSON.stringify(_data);

      case "markdown":
        return this.toMarkdown(_data);

      case "table":
        return this.toTable(_data);

      case "text":
      default:
        return this.toText(_data, colors);
    }
  }

  private static toText(_data: unknown, colors: boolean): string {
    if (typeof _data === "string") {
      return _data;
    }
    if (typeof _data === "number" || typeof _data === "boolean") {
      return String(_data);
    }
    if (Array.isArray(_data)) {
      return _data.map((_item) => this.toText(_item, colors)).join("\n");
    }
    if (typeof _data === "object" && _data !== null) {
      return Object.entries(_data)
        .map(([key, value]) => `${key}: ${this.toText(value, colors)}`)
        .join("\n");
    }
    return "";
  }

  private static toMarkdown(data: unknown): string {
    if (typeof data === "string") {
      return data;
    }
    if (Array.isArray(data)) {
      return data.map((_item) => `- ${this.toMarkdown(_item)}`).join("\n");
    }
    if (typeof data === "object" && data !== null) {
      return Object.entries(data)
        .map(([key, value]) => `**${key}**: ${this.toMarkdown(value)}`)
        .join("\n\n");
    }
    return String(data);
  }

  private static toTable(data: unknown): string {
    if (!Array.isArray(data) || data.length === 0) {
      return this.toText(data, false);
    }

    const _firstItem = data[0];
    if (typeof _firstItem !== "object" || _firstItem === null) {
      return this.toText(data, false);
    }

    const _headers = Object.keys(_firstItem);
    const _rows = data.map((_item) =>
      headers.map((h) => String((_item as Record<string, unknown>)[h] ?? "")),
    );

    const _columnWidths = _headers.map((h, _i) =>
      Math.max(h.length, ..._rows.map((r) => r[_i]?.length || 0)),
    );

    const _separator = `+${_columnWidths.map((w) => "-".repeat(w + 2)).join("+")}+`;
    const _headerRow = `|${_headers.map((h, _i) => ` ${h.padEnd(_columnWidths[_i] || 0)} `).join("|")}|`;
    const _dataRows = _rows.map(
      (row) =>
        `|${row.map((cell, _i) => ` ${cell.padEnd(_columnWidths[_i] || 0)} `).join("|")}|`,
    );

    return [_separator, _headerRow, _separator, ..._dataRows, _separator].join(
      "\n",
    );
  }
}
