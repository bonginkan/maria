/**
 * CSV Format Handler
 *
 * Handles CSV serialization/deserialization with streaming support
 */

import { EventEmitter } from "node:events";
import {
  IFormatHandler,
  SupportedFormat,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from "../../types/porter-types";

export interface CSVOptions {
  delimiter?: string;
  quote?: string;
  escape?: string;
  lineEnd?: string;
  header?: boolean;
  skipEmptyLines?: boolean;
  trim?: boolean;
  columns?: string[];
  maxFieldSize?: number;
  maxRecords?: number;
}

export class CSVFormatHandler extends EventEmitter implements IFormatHandler {
  readonly format: SupportedFormat = "csv";
  readonly supportedOperations: ("read" | "write" | "stream")[] = [
    "read",
    "write",
    "stream",
  ];

  private readonly defaultOptions: Required<CSVOptions> = {
    delimiter: ",",
    quote: '"',
    escape: '"',
    lineEnd: "\n",
    header: true,
    skipEmptyLines: true,
    trim: true,
    columns: [],
    maxFieldSize: 100000, // 100KB per field
    maxRecords: 1000000, // 1M records max
  };

  /**
   * Validate CSV data
   */
  async validate(data: any, schema?: any): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      if (!data) {
        errors.push({
          path: "root",
          message: "Data is null or undefined",
          value: data,
        });
        return { valid: false, errors, warnings };
      }

      // Handle different input types
      let records: any[] = [];
      if (typeof data === "string") {
        // Parse CSV string to validate structure
        records = await this.parseCSVString(data, this.defaultOptions);
      } else if (Array.isArray(data)) {
        records = data;
      } else {
        errors.push({
          path: "root",
          message: "Data must be a string (CSV) or array of records",
          value: typeof data,
        });
        return { valid: false, errors, warnings };
      }

      // Validate record count
      if (records.length > this.defaultOptions.maxRecords) {
        errors.push({
          path: "root",
          message: `Record count exceeds maximum (${this.defaultOptions.maxRecords})`,
          value: records.length,
          constraint: `maxRecords: ${this.defaultOptions.maxRecords}`,
        });
      }

      // Validate record structure
      const columns = new Set<string>();
      records.forEach((record, index) => {
        if (typeof record !== "object" || record === null) {
          errors.push({
            path: `record[${index}]`,
            message: "Record must be an object",
            value: record,
          });
          return;
        }

        // Collect all column names
        Object.keys(record).forEach((key) => columns.add(key));

        // Check field sizes
        Object.entries(record).forEach(([key, value]) => {
          if (
            typeof value === "string" &&
            value.length > this.defaultOptions.maxFieldSize
          ) {
            errors.push({
              path: `record[${index}].${key}`,
              message: `Field size exceeds maximum (${this.defaultOptions.maxFieldSize})`,
              value: `[String of length ${value.length}]`,
              constraint: `maxFieldSize: ${this.defaultOptions.maxFieldSize}`,
            });
          }
        });
      });

      // Check for consistent columns
      const columnArray = Array.from(columns);
      records.forEach((record, index) => {
        const recordColumns = Object.keys(record);
        const missingColumns = columnArray.filter((col) => !(col in record));
        const extraColumns = recordColumns.filter((col) => !columns.has(col));

        if (missingColumns.length > 0) {
          warnings.push({
            path: `record[${index}]`,
            message: `Missing columns: ${missingColumns.join(", ")}`,
            suggestion: "Ensure all records have consistent column structure",
          });
        }

        if (extraColumns.length > 0) {
          warnings.push({
            path: `record[${index}]`,
            message: `Extra columns: ${extraColumns.join(", ")}`,
            suggestion: "Ensure all records have consistent column structure",
          });
        }
      });

      // Schema validation if provided
      if (schema && schema.columns) {
        const schemaColumns = new Set(schema.columns);
        const dataColumns = columns;

        const missingSchemaColumns = Array.from(schemaColumns).filter(
          (col) => !dataColumns.has(col),
        );
        const extraDataColumns = Array.from(dataColumns).filter(
          (col) => !schemaColumns.has(col),
        );

        if (missingSchemaColumns.length > 0) {
          errors.push({
            path: "columns",
            message: `Missing required columns: ${missingSchemaColumns.join(", ")}`,
            constraint: "schema.columns",
          });
        }

        if (extraDataColumns.length > 0) {
          warnings.push({
            path: "columns",
            message: `Extra columns not in schema: ${extraDataColumns.join(", ")}`,
            suggestion: "Update schema or remove extra columns",
          });
        }
      }

      this.emit("validation_complete", {
        format: this.format,
        valid: errors.length === 0,
        recordCount: records.length,
        columnCount: columns.size,
        errorCount: errors.length,
        warningCount: warnings.length,
      });

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      errors.push({
        path: "root",
        message: `Validation error: ${error.message}`,
        value: data,
      });

      return { valid: false, errors, warnings };
    }
  }

  /**
   * Serialize array of objects to CSV
   */
  async serialize(data: any[], options: CSVOptions = {}): Promise<string> {
    try {
      const opts = { ...this.defaultOptions, ...options };

      if (!Array.isArray(data)) {
        throw new Error("Data must be an array of objects");
      }

      if (data.length === 0) {
        return "";
      }

      const records: string[] = [];

      // Determine columns
      let columns = opts.columns;
      if (columns.length === 0) {
        const columnSet = new Set<string>();
        data.forEach((record) => {
          if (record && typeof record === "object") {
            Object.keys(record).forEach((key) => columnSet.add(key));
          }
        });
        columns = Array.from(columnSet);
      }

      // Add header if required
      if (opts.header && columns.length > 0) {
        records.push(
          this.serializeRecord(
            columns.map((col) => ({ [col]: col })),
            columns,
            opts,
          ),
        );
      }

      // Serialize each record
      for (const record of data) {
        if (record && typeof record === "object") {
          const csvRecord = this.serializeRecord([record], columns, opts);
          records.push(csvRecord);
        }
      }

      const result = records.join(opts.lineEnd);

      this.emit("serialization_complete", {
        format: this.format,
        recordCount: data.length,
        columnCount: columns.length,
        size: result.length,
      });

      return result;
    } catch (error) {
      this.emit("serialization_error", {
        format: this.format,
        error: error.message,
      });
      throw new Error(`CSV serialization failed: ${error.message}`);
    }
  }

  /**
   * Deserialize CSV string to array of objects
   */
  async deserialize(data: string, options: CSVOptions = {}): Promise<any[]> {
    try {
      const opts = { ...this.defaultOptions, ...options };

      if (typeof data !== "string") {
        throw new Error("Input must be a CSV string");
      }

      const records = await this.parseCSVString(data, opts);

      this.emit("deserialization_complete", {
        format: this.format,
        inputSize: data.length,
        recordCount: records.length,
      });

      return records;
    } catch (error) {
      this.emit("deserialization_error", {
        format: this.format,
        error: error.message,
        inputLength: typeof data === "string" ? data.length : 0,
      });
      throw new Error(`CSV deserialization failed: ${error.message}`);
    }
  }

  /**
   * Stream serialize array of objects to CSV
   */
  async *streamSerialize(
    data: AsyncIterable<any>,
    options: CSVOptions = {},
  ): AsyncIterable<Buffer> {
    const opts = { ...this.defaultOptions, ...options };

    try {
      let headerEmitted = false;
      let columns: string[] = opts.columns;

      for await (const record of data) {
        if (!record || typeof record !== "object") {
          continue;
        }

        // Determine columns from first record if not provided
        if (columns.length === 0) {
          columns = Object.keys(record);

          // Emit header if required
          if (opts.header) {
            const header = this.serializeRecord(
              columns.map((col) => ({ [col]: col })),
              columns,
              opts,
            );
            yield Buffer.from(header + opts.lineEnd, "utf8");
            headerEmitted = true;
          }
        } else if (opts.header && !headerEmitted) {
          // Emit header for predefined columns
          const header = this.serializeRecord(
            columns.map((col) => ({ [col]: col })),
            columns,
            opts,
          );
          yield Buffer.from(header + opts.lineEnd, "utf8");
          headerEmitted = true;
        }

        // Serialize record
        const csvRecord = this.serializeRecord([record], columns, opts);
        yield Buffer.from(csvRecord + opts.lineEnd, "utf8");

        this.emit("stream_item_serialized", {
          format: this.format,
          columns: columns.length,
        });
      }

      this.emit("stream_serialization_complete", {
        format: this.format,
      });
    } catch (error) {
      this.emit("stream_serialization_error", {
        format: this.format,
        error: error.message,
      });
      throw new Error(`CSV stream serialization failed: ${error.message}`);
    }
  }

  /**
   * Stream deserialize CSV to objects
   */
  async *streamDeserialize(
    data: AsyncIterable<Buffer>,
    options: CSVOptions = {},
  ): AsyncIterable<any> {
    const opts = { ...this.defaultOptions, ...options };

    try {
      let buffer = "";
      let columns: string[] = [];
      let recordCount = 0;

      for await (const chunk of data) {
        buffer += chunk.toString("utf8");

        // Process complete lines
        const lines = buffer.split(opts.lineEnd);
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (opts.skipEmptyLines && line.trim() === "") {
            continue;
          }

          const fields = this.parseLine(line, opts);

          if (columns.length === 0) {
            if (opts.header) {
              columns = fields;
              continue;
            } else {
              // Generate column names
              columns = fields.map((_, index) => `column_${index}`);
            }
          }

          // Create record object
          const record: any = {};
          fields.forEach((field, index) => {
            const columnName = columns[index] || `column_${index}`;
            record[columnName] = field;
          });

          recordCount++;
          if (recordCount > opts.maxRecords) {
            throw new Error(
              `Record count exceeds maximum (${opts.maxRecords})`,
            );
          }

          yield record;

          this.emit("stream_item_deserialized", {
            format: this.format,
            recordNumber: recordCount,
          });
        }
      }

      // Process final line if exists
      if (buffer.trim()) {
        const fields = this.parseLine(buffer, opts);
        if (fields.length > 0) {
          const record: any = {};
          fields.forEach((field, index) => {
            const columnName = columns[index] || `column_${index}`;
            record[columnName] = field;
          });
          yield record;
        }
      }

      this.emit("stream_deserialization_complete", {
        format: this.format,
        totalRecords: recordCount,
      });
    } catch (error) {
      this.emit("stream_deserialization_error", {
        format: this.format,
        error: error.message,
      });
      throw new Error(`CSV stream deserialization failed: ${error.message}`);
    }
  }

  /**
   * Parse CSV string into records
   */
  private async parseCSVString(
    csvData: string,
    options: Required<CSVOptions>,
  ): Promise<any[]> {
    const lines = csvData
      .split(options.lineEnd)
      .filter((line) => !options.skipEmptyLines || line.trim() !== "");

    if (lines.length === 0) {
      return [];
    }

    let columns: string[] = [];
    const records: any[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const fields = this.parseLine(line, options);

      if (i === 0 && options.header) {
        columns = fields;
        continue;
      }

      if (columns.length === 0) {
        // Generate column names if no header
        columns = fields.map((_, index) => `column_${index}`);
      }

      // Create record object
      const record: any = {};
      fields.forEach((field, index) => {
        const columnName = columns[index] || `column_${index}`;
        record[columnName] = field;
      });

      records.push(record);
    }

    return records;
  }

  /**
   * Parse single CSV line into fields
   */
  private parseLine(line: string, options: Required<CSVOptions>): string[] {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === options.quote) {
        if (inQuotes && nextChar === options.quote) {
          // Escaped quote
          current += options.quote;
          i += 2;
          continue;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === options.delimiter && !inQuotes) {
        // Field separator
        fields.push(options.trim ? current.trim() : current);
        current = "";
      } else {
        current += char;
      }

      i++;
    }

    // Add final field
    fields.push(options.trim ? current.trim() : current);

    return fields;
  }

  /**
   * Serialize record to CSV line
   */
  private serializeRecord(
    records: any[],
    columns: string[],
    options: Required<CSVOptions>,
  ): string {
    if (records.length === 0) return "";

    const record = records[0];
    const fields = columns.map((column) => {
      let value = record[column];

      // Convert to string
      if (value === null || value === undefined) {
        value = "";
      } else {
        value = String(value);
      }

      // Check if quoting is needed
      const needsQuotes =
        value.includes(options.delimiter) ||
        value.includes(options.quote) ||
        value.includes(options.lineEnd) ||
        value.includes("\n") ||
        value.includes("\r");

      if (needsQuotes) {
        // Escape quotes
        value = value.replace(
          new RegExp(options.quote, "g"),
          options.escape + options.quote,
        );
        value = options.quote + value + options.quote;
      }

      return value;
    });

    return fields.join(options.delimiter);
  }

  /**
   * Get format-specific health status
   */
  getHealthStatus(): {
    status: "healthy" | "degraded" | "unhealthy";
    details: any;
  } {
    return {
      status: "healthy",
      details: {
        format: this.format,
        supportedOperations: this.supportedOperations,
        defaultOptions: this.defaultOptions,
      },
    };
  }
}
