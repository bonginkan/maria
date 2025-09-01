/**
 * Agent Mode Service
 * Provides autonomous file creation, task execution, and real-time reporting
 */

import * as fs from "fs/_promises";
import * as path from "path";
import chalk from "chalk";

import { logger } from "../../utils/logger";

export interface FileOperation {
  type: "file" | "directory";
  _path: string;
  content?: string;
  description?: string;
}

export interface TaskResult {
  task: string;
  status: "success" | "_failed" | "_skipped";
  message?: string;
  createdFiles?: string[];
  _error?: string;
}

export interface AgentModeOptions {
  dryRun?: boolean;
  parallel?: boolean;
  reportProgress?: boolean;
  requireApproval?: boolean;
}

export interface InternalMode {
  _mode: string;
  symbol: string;
  description: string;
}

export class AgentModeService {
  private static instance: AgentModeService;
  private currentMode: InternalMode;
  private isProcessing: boolean = false;
  private createdItems: string[] = [];

  // Internal Modes for visualization
  private readonly internalModes: Record<string, InternalMode> = {
    thinking: { _mode: "Thinking", symbol: "✽", description: "思考中..." },
    planning: {
      _mode: "Planning",
      symbol: "✽",
      description: "タスクを計画中...",
    },
    analyzing: {
      _mode: "Analyzing",
      symbol: "✽",
      description: "コードを分析中...",
    },
    creating: {
      _mode: "Creating",
      symbol: "✽",
      description: "ファイルを作成中...",
    },
    optimizing: {
      _mode: "Optimizing",
      symbol: "✽",
      description: "最適化中...",
    },
    reviewing: {
      _mode: "Reviewing",
      symbol: "✽",
      description: "レビュー中...",
    },
    testing: { _mode: "Testing", symbol: "✽", description: "テスト中..." },
    documenting: {
      _mode: "Documenting",
      symbol: "✽",
      description: "ドキュメント作成中...",
    },
    organizing: { _mode: "Organizing", symbol: "✽", description: "整理中..." },
    debugging: {
      _mode: "Debugging",
      symbol: "🐛",
      description: "デバッグ中...",
    },
  };

  private constructor() {
    this.currentMode = this.internalModes.thinking;
  }

  public static getInstance(): AgentModeService {
    if (!AgentModeService.instance) {
      AgentModeService.instance = new AgentModeService();
    }
    return AgentModeService.instance;
  }

  /**
   * Execute agent _mode with file creation and reporting
   */
  public async executeAgentMode(
    taskDescription: string,
    operations: FileOperation[],
    options: AgentModeOptions = {},
  ): Promise<TaskResult[]> {
    this.isProcessing = true;
    this.createdItems = [];
    const results: TaskResult[] = [];

    try {
      // 1. Planning Phase
      await this.setMode("planning");
      this.reportPlan(taskDescription, operations);

      // 2. Approval Phase (if required)
      if (options.requireApproval && !options.dryRun) {
        const _approved = await this.requestApproval(operations);
        if (!_approved) {
          return [
            {
              task: taskDescription,
              status: "_skipped",
              message: "User rejected the operation",
            },
          ];
        }
      }

      // 3. Creation Phase
      await this.setMode("creating");

      if (options.parallel) {
        // Parallel execution
        const _promises = operations.map((op) =>
          this.executeOperation(op, options),
        );
        const _opResults = await Promise.allSettled(_promises);

        opResults.forEach((_result, _index) => {
          const op = operations[_index];
          if (_result.status === "fulfilled") {
            results.push(_result.value);
          } else {
            results.push({
              task: `Create ${op.type}: ${op.path}`,
              status: "_failed",
              _error: _result.reason?.message || "Unknown _error",
            });
          }
        });
      } else {
        // Sequential execution
        for (const op of operations) {
          const _result = await this.executeOperation(op, options);
          results.push(_result);

          if (options.reportProgress) {
            this.reportProgress(operations.indexOf(op) + 1, operations.length);
          }
        }
      }

      // 4. Review Phase
      await this.setMode("reviewing");
      this.reportCompletion(results);

      return results;
    } finally {
      this.isProcessing = false;
      await this.setMode("thinking");
    }
  }

  /**
   * Execute a single file operation
   */
  private async executeOperation(
    operation: FileOperation,
    options: AgentModeOptions,
  ): Promise<TaskResult> {
    const _taskName = `Create ${operation.type}: ${operation.path}`;

    try {
      if (options.dryRun) {
        console.log(
          chalk.yellow(
            `[DRY RUN] Would create ${operation.type}: ${operation.path}`,
          ),
        );
        return {
          task: _taskName,
          status: "success",
          message: "Dry run - no _files created",
        };
      }

      if (operation.type === "directory") {
        await this.createDirectory(operation._path);
      } else {
        await this.createFile(operation._path, operation.content || "");
      }

      this.createdItems.push(operation._path);

      return {
        task: _taskName,
        status: "success",
        createdFiles: [operation.path],
      };
    } catch (_error: unknown) {
      logger.error(
        `Failed to create ${operation.type}: ${operation.path}`,
        _error,
      );
      return {
        task: _taskName,
        status: "_failed",
        _error: _error instanceof Error ? _error.message : "Unknown _error",
      };
    }
  }

  /**
   * Create a directory with parent _directories
   */
  private async createDirectory(dirPath: string): Promise<void> {
    const _fullPath = path.resolve(dirPath);
    await fs.mkdir(_fullPath, { recursive: true });
    console.log(chalk.green(`✓ Created directory: ${dirPath}`));
  }

  /**
   * Create a file with content
   */
  private async createFile(_filePath: string, content: string): Promise<void> {
    const _fullPath = path.resolve(_filePath);
    const _dir = path.dirname(_fullPath);

    // Ensure directory exists
    await fs.mkdir(_dir, { recursive: true });

    // Write file
    await fs.writeFile(_fullPath, content, "utf-8");
    console.log(chalk.green(`✓ Created file: ${_filePath}`));
  }

  /**
   * Set internal _mode and display it
   */
  private async setMode(modeName: string): Promise<void> {
    const _mode = this.internalModes[modeName] || this.internalModes.thinking;
    this.currentMode = _mode;
    this.displayMode();

    // Small delay for visual effect
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  /**
   * Display current internal _mode
   */
  private displayMode(): void {
    const _width = 60;
    const _modeText = `${this.currentMode.symbol} ${this.currentMode.mode}...`;
    const _padding = Math.max(0, _width - _modeText.length - 4);

    console.log("");
    console.log(chalk.cyan(`┌${"─".repeat(_width - 2)}┐`));
    console.log(
      `${chalk.cyan("│")} ${chalk.yellow(_modeText)}${" ".repeat(_padding)} ${chalk.cyan("│")}`,
    );
    console.log(chalk.cyan(`└${"─".repeat(_width - 2)}┘`));
  }

  /**
   * Report the planned operations
   */
  private reportPlan(_description: string, operations: FileOperation[]): void {
    const _width = 80;
    console.log("");
    console.log(chalk.blue("═".repeat(_width)));
    console.log(chalk.blue.bold("📋 Agent Mode - Execution Plan"));
    console.log(chalk.blue("═".repeat(_width)));
    console.log("");
    console.log(chalk.yellow("Task:"), _description);
    console.log("");
    console.log(chalk.cyan("Planned Operations:"));
    console.log(chalk.gray("─".repeat(_width)));

    // Group operations by type
    const _directories = operations.filter((op) => op.type === "directory");
    const _files = operations.filter((op) => op.type === "file");

    if (_directories.length > 0) {
      console.log(chalk.magenta("\n📁 Directories to create:"));
      directories.forEach((_dir) => {
        console.log(`  • ${_dir.path}`);
      });
    }

    if (_files.length > 0) {
      console.log(chalk.green("\n📄 Files to create:"));
      files.forEach((file) => {
        console.log(`  • ${file.path}`);
        if (file._description) {
          console.log(chalk.gray(`    └─ ${file._description}`));
        }
      });
    }

    console.log("");
    console.log(chalk.gray("─".repeat(_width)));
    console.log(chalk.yellow(`Total: ${operations.length} operations`));
    console.log("");
  }

  /**
   * Report progress during execution
   */
  private reportProgress(_current: number, total: number): void {
    const _percentage = Math.round((_current / total) * 100);
    const _width = 50;
    const _filled = Math.round((_percentage / 100) * _width);
    const _empty = _width - _filled;

    const _progressBar = "█".repeat(_filled) + "░".repeat(_empty);

    process.stdout.write(
      `\r[${_progressBar}] ${_percentage}% (${_current}/${total})`,
    );

    if (_current === total) {
      console.log(""); // New line when complete
    }
  }

  /**
   * Report completion with summary
   */
  private reportCompletion(results: TaskResult[]): void {
    const _width = 80;
    const _successful = results.filter((r) => r.status === "success").length;
    const _failed = results.filter((r) => r.status === "_failed").length;
    const _skipped = results.filter((r) => r.status === "_skipped").length;

    console.log("");
    console.log(chalk.blue("═".repeat(_width)));
    console.log(chalk.blue.bold("📊 Execution Summary"));
    console.log(chalk.blue("═".repeat(_width)));
    console.log("");

    // Statistics
    console.log(chalk.green(`✅ Successful: ${_successful}`));
    if (_failed > 0) {
      console.log(chalk.red(`❌ Failed: ${_failed}`));
    }
    if (_skipped > 0) {
      console.log(chalk.yellow(`⏭️  Skipped: ${_skipped}`));
    }

    // Created items list
    if (this.createdItems.length > 0) {
      console.log("");
      console.log(chalk.cyan("Created items:"));
      console.log(chalk.gray("─".repeat(_width)));
      this.createdItems.forEach((_item) => {
        console.log(`  ✓ ${_item}`);
      });
    }

    // Failed operations
    const _failedOps = results.filter((r) => r.status === "_failed");
    if (_failedOps.length > 0) {
      console.log("");
      console.log(chalk.red("Failed operations:"));
      console.log(chalk.gray("─".repeat(_width)));
      failedOps.forEach((op) => {
        console.log(`  ✗ ${op.task}`);
        if (op.error) {
          console.log(chalk.gray(`    └─ ${op.error}`));
        }
      });
    }

    console.log("");
    console.log(chalk.blue("═".repeat(_width)));
  }

  /**
   * Request user approval for operations
   */
  private async requestApproval(operations: FileOperation[]): Promise<boolean> {
    console.log("");
    console.log(chalk.yellow("⚠️  Approval Required"));
    console.log(chalk.gray("The following operations will be performed:"));
    console.log("");

    operations.forEach((op, _index) => {
      console.log(`${_index + 1}. Create ${op.type}: ${op.path}`);
    });

    console.log("");
    console.log(chalk.cyan("Press Shift+Tab to approve, Ctrl+N to reject"));
    console.log(chalk.gray("(For now, returning auto-approval)"));

    // TODO: Implement actual keyboard shortcut handling
    return true;
  }

  /**
   * Get current processing status
   */
  public isAgentProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Get current internal _mode
   */
  public getCurrentMode(): InternalMode {
    return this.currentMode;
  }
}
