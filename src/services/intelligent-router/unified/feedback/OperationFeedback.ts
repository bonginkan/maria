/**
 * Operation Feedback System
 * Provides real-time visual feedback for _operations
 */

import { EventEmitter } from "node:events";
import chalk from "chalk";

export interface Operation {
  description: string;
  startTime: number;
  endTime?: number;
  status: "running" | "completed" | "failed";
  result?: any;
  error?: Error;
}

export interface SubOperation {
  action: string;
  details: string;
  timestamp: number;
  expandable?: boolean;
  expanded?: boolean;
}

export interface Todo {
  description: string;
  completed: boolean;
  level?: number;
  activeForm?: string;
}

export class OperationFeedback extends EventEmitter {
  private outputStream: NodeJS.WriteStream;
  private currentOperation: Operation | null = null;
  private subOperations: SubOperation[] = [];
  private todos: Todo[] = [];
  private verbose: boolean;

  constructor(
    outputStream: NodeJS.WriteStream = process.stdout,
    verbose: boolean = true,
  ) {
    super();
    this.outputStream = outputStream;
    this.verbose = verbose;
  }

  /**
   * Start a new operation with visual feedback
   */
  startOperation(description: string): void {
    const _symbol = chalk.blue("⏺");
    this.outputStream.write(`${_symbol} ${description}\n`);

    this.currentOperation = {
      description,
      startTime: Date.now(),
      status: "running",
    };

    this.emit("operation:start", this.currentOperation);
  }

  /**
   * Add a sub-operation with indented display
   */
  addSubOperation(
    _action: string,
    details: string,
    expandable: boolean = false,
  ): void {
    const _indent = "  ";
    const _symbol = chalk.gray("⎿");
    const _actionText = chalk.cyan(_action);
    const _detailsText = chalk.gray(`(${details})`);
    const _expand = expandable ? chalk.dim(" (ctrl+r to _expand)") : "";

    this.outputStream.write(
      `${_indent}${_symbol} ${_actionText} ${_detailsText}${_expand}\n`,
    );

    const subOp: SubOperation = {
      action: "",
      details,
      timestamp: Date.now(),
      expandable,
      expanded: false,
    };

    this.subOperations.push(subOp);
    this.emit("suboperation:add", subOp);
  }

  /**
   * Show thinking process
   */
  showThinking(thought?: string): void {
    const _symbol = chalk.yellow("✻");
    const _text = chalk.italic("Thinking…");

    this.outputStream.write(`\n${_symbol} ${_text}\n`);

    if (thought && this.verbose) {
      const _lines = thought.split("\n");
      lines.forEach((line) => {
        this.outputStream.write(`  ${chalk.gray(line)}\n`);
      });
    }

    this.outputStream.write("\n");
    this.emit("thinking", thought);
  }

  /**
   * Update and display TODO list
   */
  updateTodos(todos: Todo[]): void {
    this.todos = todos;

    const _symbol = chalk.blue("⏺");
    this.outputStream.write(`\n${_symbol} Update Todos\n`);

    todos.forEach((todo) => {
      this.displayTodo(todo);
    });

    this.outputStream.write("\n");
    this.emit("todos:update", todos);
  }

  /**
   * Display a single TODO item
   */
  private displayTodo(todo: Todo): void {
    const _indent = "  ";
    const _symbol = chalk.gray("⎿");
    const _levelIndent = todo.level ? "  ".repeat(todo.level) : "";
    const _checkbox = todo.completed ? chalk.green("☑") : chalk.gray("☐");
    const _text = todo.completed
      ? chalk.strikethrough.gray(todo.description)
      : chalk.white(todo.description);

    this.outputStream.write(
      `${_indent}${_symbol} ${_levelIndent}${_checkbox} ${_text}\n`,
    );
  }

  /**
   * Show success message
   */
  showSuccess(message: string): void {
    const _symbol = chalk.green("✓");
    this.outputStream.write(
      `  ${chalk.gray("⎿")} ${_symbol} ${chalk.green(message)}\n`,
    );
    this.emit("success", message);
  }

  /**
   * Show error message
   */
  showError(message: string): void {
    const _symbol = chalk.red("✗");
    this.outputStream.write(
      `  ${chalk.gray("⎿")} ${_symbol} ${chalk.red(message)}\n`,
    );
    this.emit("error", message);
  }

  /**
   * Show warning message
   */
  showWarning(message: string): void {
    const _symbol = chalk.yellow("⚠");
    this.outputStream.write(
      `  ${chalk.gray("⎿")} ${_symbol} ${chalk.yellow(message)}\n`,
    );
    this.emit("warning", message);
  }

  /**
   * Complete the current operation
   */
  completeOperation(_success: boolean = true, result?: unknown): void {
    if (!this.currentOperation) return;

    this.currentOperation.endTime = Date.now();
    this.currentOperation.status = _success ? "completed" : "failed";
    this.currentOperation.result = result;

    const _duration =
      this.currentOperation.endTime - this.currentOperation.startTime;
    const _durationText = chalk.gray(`(${this.formatDuration(_duration)})`);

    if (_success) {
      this.showSuccess(`Operation completed ${_durationText}`);
    } else {
      this.showError(`Operation failed ${_durationText}`);
    }

    this.emit("operation:complete", this.currentOperation);
    this.currentOperation = null;
    this.subOperations = [];
  }

  /**
   * Format _duration for display
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  }

  /**
   * Show progress _bar
   */
  showProgress(_current: number, total: number, label?: string): void {
    const _percentage = Math.round((_current / total) * 100);
    const _barLength = 30;
    const _filledLength = Math.round((_percentage / 100) * _barLength);
    const _bar =
      "█".repeat(_filledLength) + "░".repeat(_barLength - _filledLength);

    const _progressText = `[${chalk.cyan(_bar)}] ${_percentage}%`;
    const _labelText = label ? ` - ${label}` : "";

    // Clear line and update
    this.outputStream.write(`\r${_progressText}${_labelText}`);

    if (_current >= total) {
      this.outputStream.write("\n");
    }

    this.emit("progress", { _current, total, _percentage });
  }

  /**
   * Clear the current line
   */
  clearLine(): void {
    this.outputStream.write("\r" + " ".repeat(80) + "\r");
  }

  /**
   * Show file operation details
   */
  showFileOperation(
    operation: "create" | "read" | "modify" | "delete",
    fileName: string,
    size?: number,
  ): void {
    const _operations = {
      create: { _symbol: "✚", color: chalk.green, _text: "Create" },
      read: { _symbol: "👁", color: chalk.blue, _text: "Read" },
      modify: { _symbol: "✏", color: chalk.yellow, _text: "Modify" },
      delete: { _symbol: "🗑", color: chalk.red, _text: "Delete" },
    };

    const op = _operations[operation];
    const _sizeText = size ? chalk.gray(` (${this.formatSize(size)})`) : "";

    this.addSubOperation(op.text, `${fileName}${_sizeText}`);
  }

  /**
   * Format file size for display
   */
  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
  }

  /**
   * Show Linux command execution
   */
  showLinuxCommand(
    _command: string,
    risk: "SAFE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  ): void {
    const _riskColors = {
      SAFE: chalk.green,
      LOW: chalk.blue,
      MEDIUM: chalk.yellow,
      HIGH: chalk.magenta,
      CRITICAL: chalk.red,
    };

    const _riskColor = _riskColors[risk];
    const _commandText = chalk.cyan.bold(`$ ${_command}`);
    const _riskText = _riskColor(`[${risk}]`);

    this.addSubOperation("Execute", `${_commandText} ${_riskText}`);
  }

  /**
   * Set verbose mode
   */
  setVerbose(verbose: boolean): void {
    this.verbose = verbose;
  }

  /**
   * Get current operation status
   */
  getCurrentOperation(): Operation | null {
    return this.currentOperation;
  }

  /**
   * Get sub-_operations
   */
  getSubOperations(): SubOperation[] {
    return [...this.subOperations];
  }

  /**
   * Get current TODOs
   */
  getTodos(): Todo[] {
    return [...this.todos];
  }
}
