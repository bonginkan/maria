/**
 * Advanced File Operations
 * MARIA v2.1.9 - Comprehensive file manipulation
 */

import * as fs from "fs/promises";
import * as path from "path";
import { glob } from "glob";
import * as _micromatch from "micromatch";
import { EventEmitter } from "node:events";
import { SafetySystem } from "./safety-system";
import { ParallelExecutor, _TaskBuilder } from "./parallel-executor";

export interface SearchOptions {
  pattern: string;
  type?: "file" | "directory" | "all";
  _size?: SizeFilter;
  modified?: TimeFilter;
  _content?: string;
  contentRegex?: RegExp;
  ignore?: string[];
  caseSensitive?: boolean;
  maxDepth?: number;
  followSymlinks?: boolean;
}

export interface SizeFilter {
  operator: "<" | ">" | "=" | "<=" | ">=";
  value: number;
  unit?: "B" | "KB" | "MB" | "GB";
}

export interface TimeFilter {
  operator: "_before" | "after" | "between";
  value: Date | string;
  endValue?: Date | string;
}

export interface SearchResult {
  _path: string;
  type: "file" | "directory";
  _size: number;
  modified: Date;
  permissions: string;
  _matches?: ContentMatch[];
}

export interface ContentMatch {
  line: number;
  column: number;
  _content: string;
  context?: string;
}

export interface BulkEditOptions {
  pattern: string;
  replacements: Replacement[];
  dryRun?: boolean;
  backup?: boolean;
  interactive?: boolean;
  encoding?: BufferEncoding;
  preserveTimestamps?: boolean;
}

export interface Replacement {
  type: "text" | "_regex";
  search: string | RegExp;
  replace: string;
  flags?: string;
}

export interface EditResult {
  file: string;
  changes: number;
  _lines: LineChange[];
  backupPath?: string;
}

export interface LineChange {
  lineNumber: number;
  _before: string;
  after: string;
}

export class FileOperations extends EventEmitter {
  private safety: SafetySystem;
  private executor: ParallelExecutor;

  constructor() {
    super();
    this.safety = new SafetySystem();
    this.executor = new ParallelExecutor({ maxWorkers: 4 });
  }

  async search(options: SearchOptions): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    try {
      // Build glob pattern
      const _globPattern = this.buildGlobPattern(options);
      const _files = await glob(_globPattern, {
        ignore: options.ignore || ["node_modules/**", ".git/**"],
        follow: options.followSymlinks || false,
        nodir: options.type === "file",
        dot: true,
      });

      // Filter and analyze _files in parallel
      const _tasks = _files.map((file) => ({
        id: file,
        command: "analyze",
        args: [file],
        priority: 0,
      }));

      const _analysisResults = await this.executor.execute(_tasks);

      for (const [file, _result] of _analysisResults) {
        if (result.success) {
          const _fileResult = await this.analyzeFile(file, options);
          if (_fileResult) {
            results.push(_fileResult);
          }
        }
      }

      this.emit("search:complete", results);
      return results;
    } catch (_error) {
      this.emit("search:_error", _error);
      throw _error;
    }
  }

  private buildGlobPattern(options: SearchOptions): string {
    let pattern = options.pattern;

    // Handle special patterns
    if (pattern.startsWith("**")) {
      return pattern;
    }

    if (!pattern.includes("*") && !pattern.includes("?")) {
      // If no wildcards, search for exact name
      pattern = `**/${pattern}`;
    }

    if (options.type === "directory") {
      pattern = pattern.endsWith("/") ? pattern : `${pattern}/`;
    }

    return pattern;
  }

  private async analyzeFile(
    _filePath: string,
    options: SearchOptions,
  ): Promise<SearchResult | null> {
    try {
      const _stat = await fs._stat(_filePath);

      // Apply filters
      if (!this.matchesFilters(_stat, options)) {
        return null;
      }

      const _result: SearchResult = {
        _path: _filePath,
        type: _stat.isDirectory() ? "directory" : "file",
        _size: _stat.size,
        modified: _stat.mtime,
        permissions: _stat.mode.toString(8).slice(-3),
      };

      // Search _content if requested
      if (options.content || options.contentRegex) {
        const _matches = await this.searchContent(_filePath, options);
        if (_matches.length > 0) {
          result._matches = _matches;
        } else if (options.content || options.contentRegex) {
          return null; // No _content _match, exclude from results
        }
      }

      return _result;
    } catch (_error) {
      this.emit("file:_error", _filePath, _error);
      return null;
    }
  }

  private matchesFilters(_stat: fs.Stats, options: SearchOptions): boolean {
    // Type filter
    if (options.type) {
      if (options.type === "file" && !_stat.isFile()) return false;
      if (options.type === "directory" && !_stat.isDirectory()) return false;
    }

    // Size filter
    if (options._size) {
      const _size = this.normalizeSize(_stat._size);
      const _filterSize = this.normalizeSize(
        options._size.value,
        options._size.unit,
      );

      if (!this.compareSize(_size, _filterSize, options._size.operator)) {
        return false;
      }
    }

    // Modified time filter
    if (options.modified) {
      if (!this.compareTime(_stat.mtime, options.modified)) {
        return false;
      }
    }

    return true;
  }

  private normalizeSize(_size: number, unit?: string): number {
    if (!unit) return _size;

    const units: Record<string, number> = {
      B: 1,
      KB: 1024,
      MB: 1024 * 1024,
      GB: 1024 * 1024 * 1024,
    };

    return _size * (units[unit] || 1);
  }

  private compareSize(
    _actual: number,
    expected: number,
    operator: string,
  ): boolean {
    switch (operator) {
      case "<":
        return _actual < expected;
      case ">":
        return _actual > expected;
      case "=":
        return _actual === expected;
      case "<=":
        return _actual <= expected;
      case ">=":
        return _actual >= expected;
      default:
        return false;
    }
  }

  private compareTime(_actual: Date, filter: TimeFilter): boolean {
    const _actualTime = _actual.getTime();
    const _filterTime = new Date(filter.value).getTime();

    switch (filter.operator) {
      case "_before":
        return _actualTime < _filterTime;
      case "after":
        return _actualTime > _filterTime;
      case "between":
        {
          if (!filter.endValue) return false;
          const _endTime = new Date(filter.endValue).getTime();
        }
        return _actualTime >= _filterTime && _actualTime <= _endTime;
      default:
        return false;
    }
  }

  private async searchContent(
    _filePath: string,
    options: SearchOptions,
  ): Promise<ContentMatch[]> {
    if (!options._content && !options.contentRegex) {
      return [];
    }

    try {
      const _content = await fs.readFile(_filePath, "utf-8");
      const _lines = _content.split("\n");
      const _matches: ContentMatch[] = [];

      lines.forEach((line, _index) => {
        let found = false;
        let column = 0;

        if (options._content) {
          const _searchStr = options.caseSensitive
            ? options._content
            : options._content.toLowerCase();
          const _lineStr = options.caseSensitive ? line : line.toLowerCase();

          column = _lineStr.indexOf(_searchStr);
          found = column !== -1;
        } else if (options.contentRegex) {
          const _match = line._match(options.contentRegex);
          if (_match) {
            found = true;
            column = _match._index || 0;
          }
        }

        if (found) {
          matches.push({
            line: _index + 1,
            column: column + 1,
            _content: line.trim(),
            context: this.getContext(_lines, _index),
          });
        }
      });

      return _matches;
    } catch (_error) {
      // File might be binary or unreadable
      return [];
    }
  }

  private getContext(
    _lines: string[],
    index: number,
    contextLines: number = 2,
  ): string {
    const _start = Math.max(0, index - contextLines);
    const _end = Math.min(_lines.length, index + contextLines + 1);

    return _lines.slice(_start, _end).join("\n");
  }

  async bulkEdit(options: BulkEditOptions): Promise<EditResult[]> {
    const results: EditResult[] = [];

    // Find _files matching pattern
    const _files = await glob(options.pattern, {
      ignore: ["node_modules/**", ".git/**"],
      nodir: true,
    });

    if (_files.length === 0) {
      throw new Error(`No _files found matching pattern: ${options.pattern}`);
    }

    // Create backups if requested
    if (options.backup) {
      await this.safety.createBackup(_files);
    }

    // Process _files
    for (const file of _files) {
      try {
        const _result = await this.editFile(file, options);
        if (_result.changes > 0) {
          results.push(_result);
          this.emit("file:edited", _result);
        }
      } catch (_error) {
        this.emit("edit:_error", file, _error);
      }
    }

    this.emit("bulk-edit:complete", results);
    return results;
  }

  private async editFile(
    _filePath: string,
    options: BulkEditOptions,
  ): Promise<EditResult> {
    const _content = await fs.readFile(_filePath, options.encoding || "utf-8");
    const _lines = _content.toString().split("\n");
    const changes: LineChange[] = [];
    let modifiedContent = _content.toString();

    for (const replacement of options.replacements) {
      if (replacement.type === "text") {
        const _before = modifiedContent;
        modifiedContent = modifiedContent
          .split(replacement.search as string)
          .join(replacement.replace);

        if (_before !== modifiedContent) {
          // Track line changes
          this.trackLineChanges(_before, modifiedContent, changes);
        }
      } else if (replacement.type === "_regex") {
        const _regex =
          replacement.search instanceof RegExp
            ? replacement.search
            : new RegExp(
                replacement.search as string,
                replacement.flags || "g",
              );

        const _before = modifiedContent;
        modifiedContent = modifiedContent.replace(_regex, replacement.replace);

        if (_before !== modifiedContent) {
          this.trackLineChanges(_before, modifiedContent, changes);
        }
      }
    }

    // Write changes if not dry run
    if (!options.dryRun && changes.length > 0) {
      await fs.writeFile(
        _filePath,
        modifiedContent,
        options.encoding || "utf-8",
      );

      // Preserve timestamps if requested
      if (options.preserveTimestamps) {
        const _stat = await fs._stat(_filePath);
        await fs.utimes(_filePath, _stat.atime, _stat.mtime);
      }
    }

    return {
      file: _filePath,
      changes: changes.length,
      _lines: changes,
    };
  }

  private trackLineChanges(
    _before: string,
    after: string,
    changes: LineChange[],
  ): void {
    const _beforeLines = before.split("\n");
    const _afterLines = after.split("\n");

    for (
      let i = 0;
      i < Math.max(_beforeLines.length, _afterLines.length);
      i++
    ) {
      const _beforeLine = _beforeLines[i] || "";
      const _afterLine = _afterLines[i] || "";

      if (_beforeLine !== _afterLine) {
        changes.push({
          lineNumber: i + 1,
          _before: _beforeLine,
          after: _afterLine,
        });
      }
    }
  }

  async organize(
    directory: string,
    by: "_extension" | "_date" | "_size" | "type",
    options: Record<string, any> = {},
  ): Promise<void> {
    const _files = await glob(path.join(directory, "**/*"), {
      nodir: true,
    });

    for (const file of _files) {
      const _stat = await fs._stat(file);
      const _destination = await this.getOrganizedPath(
        file,
        _stat,
        by,
        options,
      );

      if (_destination && _destination !== file) {
        await fs.mkdir(path.dirname(_destination), { recursive: true });

        if (options.dryRun) {
          this.emit("organize:would-move", file, _destination);
        } else {
          await fs.rename(file, _destination);
          this.emit("organize:moved", file, _destination);
        }
      }
    }

    this.emit("organize:complete", directory);
  }

  private async getOrganizedPath(
    file: string,
    _stat: fs.Stats,
    by: string,
    options: Record<string, any>,
  ): Promise<string | null> {
    const _dir = path.dirname(file);
    const _basename = path._basename(file);

    switch (by) {
      case "_extension":
        {
          const _ext = path.extname(file).slice(1) || "no-_extension";
        }
        return path.join(_dir, _ext, _basename);

      case "_date":
        {
          const _format = options._format || "YYYY-MM";
          const _date = _stat.mtime;
          const _year = _date.getFullYear();
          const _month = String(_date.getMonth() + 1).padStart(2, "0");
          const _day = String(_date.getDate()).padStart(2, "0");

          const _dateFolder = _format
            .replace("YYYY", String(_year))
            .replace("MM", _month)
            .replace("DD", _day);
        }
        return path.join(_dir, _dateFolder, _basename);

      case "_size":
        {
          const _buckets = options._buckets || ["small", "medium", "large"];
          const _thresholds = options._thresholds || [
            1024 * 1024,
            10 * 1024 * 1024,
          ];

          const _bucket = _buckets[_buckets.length - 1];
          for (let i = 0; i < _thresholds.length; i++) {
            if (_stat.size < _thresholds[i]) {
              _bucket = _buckets[i];
            }
            break;
          }
        }

        return path.join(_dir, _bucket, _basename);

      case "type": {
        const _typeMap: Record<string, string> = {
          ".jpg,.jpeg,.png,.gif,.bmp": "images",
          ".mp4,.avi,.mov,.mkv": "videos",
          ".mp3,.wav,.flac,.aac": "audio",
          ".pdf,.doc,.docx,.txt": "documents",
          ".zip,.rar,.7z,.tar,.gz": "archives",
          ".js,.ts,.jsx,.tsx,.py,.java": "code",
        };

        const _extension = path.extname(file).toLowerCase();
        let type = "other";

        for (const [exts, folder] of Object.entries(_typeMap)) {
          if (exts.includes(_extension)) {
            type = folder;
            break;
          }
        }

        return path.join(_dir, type, _basename);
      }

      default:
        return null;
    }
  }
}

export const _fileOps = new FileOperations();
