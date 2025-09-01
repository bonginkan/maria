/**
 * CLI Native Command Registry System
 * MARIA v2.1.9 - Complete CLI _command management
 */

import { EventEmitter } from "node:events";

export interface CLICommand {
  name: string;
  description: string;
  category: CLICategory;
  aliases?: string[];
  usage: string;
  examples: string[];
  flags?: CommandFlag[];
  requiresConfirmation?: boolean;
  isDangerous?: boolean;
  supportsParallel?: boolean;
  maxParallelJobs?: number;
}

export interface CommandFlag {
  name: string;
  short?: string;
  description: string;
  type: "boolean" | "string" | "number" | "array";
  default?: any;
  required?: boolean;
}

export type CLICategory =
  | "file-ops"
  | "code-dev"
  | "build-test"
  | "deploy-ops"
  | "git-ops"
  | "monitoring"
  | "security"
  | "performance"
  | "automation"
  | "data-ops"
  | "code-analysis"
  | "refactoring";

export interface CommandResult {
  success: boolean;
  output?: string;
  _error?: string;
  duration?: number;
  affectedFiles?: string[];
  rollbackable?: boolean;
  rollbackId?: string;
}

export interface CommandContext {
  workingDirectory: string;
  dryRun: boolean;
  parallel: boolean;
  interactive: boolean;
  verbose: boolean;
  userId?: string;
  sessionId: string;
  timestamp: number;
}

export class CLICommandRegistry extends EventEmitter {
  private _commands: Map<string, CLICommand> = new Map();
  private aliases: Map<string, string> = new Map();
  private executionHistory: CommandResult[] = [];
  private rollbackStack: Map<string, () => Promise<void>> = new Map();

  constructor() {
    super();
    this.registerCoreCommands();
  }

  private registerCoreCommands(): void {
    // File Operations
    this.register({
      name: "find",
      description: "Advanced file search with multiple criteria",
      category: "file-ops",
      aliases: ["search", "locate"],
      usage: "find [pattern] [--type TYPE] [--size SIZE] [--modified TIME]",
      examples: [
        'find "*.ts" --type file --size "<1M"',
        'find "TODO" --content --ignore node_modules',
        'find --modified "last 7 days" --type directory',
      ],
      flags: [
        {
          name: "type",
          short: "t",
          description: "File type (file/directory)",
          type: "string",
        },
        {
          name: "size",
          short: "s",
          description: "Size filter",
          type: "string",
        },
        {
          name: "modified",
          short: "m",
          description: "Modified time filter",
          type: "string",
        },
        {
          name: "content",
          short: "c",
          description: "Search in file contents",
          type: "boolean",
        },
        {
          name: "ignore",
          short: "i",
          description: "Ignore patterns",
          type: "array",
        },
        {
          name: "regex",
          short: "r",
          description: "Use regex pattern",
          type: "boolean",
        },
        {
          name: "case-sensitive",
          description: "Case sensitive search",
          type: "boolean",
          default: false,
        },
      ],
      supportsParallel: true,
      maxParallelJobs: 10,
    });

    this.register({
      name: "bulk-edit",
      description: "Edit multiple files simultaneously",
      category: "file-ops",
      aliases: ["mass-edit", "multi-edit"],
      usage: "bulk-edit [pattern] --replace OLD NEW [--dry-run]",
      examples: [
        'bulk-edit "*.ts" --replace "console.log" "logger.debug"',
        'bulk-edit "src/**/*.tsx" --replace-regex "import (.+) from" "import type $1 from" --dry-run',
      ],
      flags: [
        {
          name: "replace",
          description: "Simple text replacement",
          type: "array",
        },
        {
          name: "replace-regex",
          description: "Regex replacement",
          type: "array",
        },
        {
          name: "dry-run",
          description: "Preview changes without applying",
          type: "boolean",
          default: true,
        },
        {
          name: "backup",
          description: "Create backups before editing",
          type: "boolean",
          default: true,
        },
        {
          name: "confirm-each",
          description: "Confirm each file change",
          type: "boolean",
        },
      ],
      requiresConfirmation: true,
      isDangerous: true,
      supportsParallel: true,
    });

    this.register({
      name: "organize",
      description: "Organize files based on rules",
      category: "file-ops",
      usage: "organize [directory] --by TYPE [--dry-run]",
      examples: [
        "organize downloads --by extension",
        'organize project --by date --format "YYYY/MM"',
        'organize images --by size --buckets "small,medium,large"',
      ],
      flags: [
        {
          name: "by",
          description: "Organization criteria",
          type: "string",
          required: true,
        },
        {
          name: "format",
          description: "Date format for organization",
          type: "string",
        },
        {
          name: "buckets",
          description: "Size buckets for organization",
          type: "string",
        },
        {
          name: "dry-run",
          description: "Preview organization",
          type: "boolean",
          default: true,
        },
      ],
      requiresConfirmation: true,
    });

    // Code Development
    this.register({
      name: "refactor",
      description: "Intelligent code refactoring",
      category: "code-dev",
      usage: "refactor [file/directory] --type TYPE [--options]",
      examples: [
        'refactor src/utils.ts --extract-function "lines:10-25" --name "processData"',
        'refactor src/ --rename-symbol "oldName" "newName"',
        "refactor component.tsx --convert-to-hooks",
      ],
      flags: [
        {
          name: "type",
          description: "Refactoring type",
          type: "string",
          required: true,
        },
        {
          name: "extract-function",
          description: "Extract code to function",
          type: "string",
        },
        {
          name: "rename-symbol",
          description: "Rename variable/function",
          type: "array",
        },
        {
          name: "convert-to-hooks",
          description: "Convert class to hooks",
          type: "boolean",
        },
        {
          name: "optimize-imports",
          description: "Optimize import statements",
          type: "boolean",
        },
        {
          name: "preview",
          description: "Preview refactoring",
          type: "boolean",
          default: true,
        },
      ],
      requiresConfirmation: true,
    });

    this.register({
      name: "analyze-deps",
      description: "Analyze and optimize dependencies",
      category: "code-dev",
      aliases: ["deps", "dependencies"],
      usage: "analyze-deps [--fix] [--update]",
      examples: [
        "analyze-deps --unused",
        "analyze-deps --circular",
        "analyze-deps --outdated --update",
      ],
      flags: [
        {
          name: "unused",
          description: "Find unused dependencies",
          type: "boolean",
        },
        {
          name: "circular",
          description: "Detect circular dependencies",
          type: "boolean",
        },
        {
          name: "outdated",
          description: "Check for outdated packages",
          type: "boolean",
        },
        { name: "update", description: "Update packages", type: "boolean" },
        { name: "security", description: "Security audit", type: "boolean" },
        { name: "fix", description: "Auto-fix issues", type: "boolean" },
      ],
      supportsParallel: true,
    });

    // Build & Test
    this.register({
      name: "smart-test",
      description: "Intelligent test execution",
      category: "build-test",
      aliases: ["test-smart", "st"],
      usage: "smart-test [--affected] [--failed] [--coverage]",
      examples: [
        "smart-test --affected",
        "smart-test --failed-last",
        "smart-test --coverage-threshold 80",
      ],
      flags: [
        {
          name: "affected",
          description: "Test only affected files",
          type: "boolean",
        },
        {
          name: "failed-last",
          description: "Re-run failed tests",
          type: "boolean",
        },
        {
          name: "coverage-threshold",
          description: "Coverage threshold",
          type: "number",
        },
        {
          name: "parallel",
          description: "Run tests in parallel",
          type: "boolean",
          default: true,
        },
        { name: "watch", description: "Watch mode", type: "boolean" },
      ],
      supportsParallel: true,
      maxParallelJobs: 4,
    });

    this.register({
      name: "build-optimize",
      description: "Optimized build with analysis",
      category: "build-test",
      aliases: ["build-opt", "bo"],
      usage: "build-optimize [--profile] [--cache]",
      examples: [
        "build-optimize --profile",
        "build-optimize --analyze-bundle",
        "build-optimize --incremental",
      ],
      flags: [
        {
          name: "profile",
          description: "Profile build performance",
          type: "boolean",
        },
        {
          name: "analyze-bundle",
          description: "Analyze bundle size",
          type: "boolean",
        },
        {
          name: "incremental",
          description: "Incremental build",
          type: "boolean",
        },
        {
          name: "cache",
          description: "Use build cache",
          type: "boolean",
          default: true,
        },
        {
          name: "parallel",
          description: "Parallel compilation",
          type: "boolean",
          default: true,
        },
      ],
      supportsParallel: true,
    });

    // Deployment Operations
    this.register({
      name: "safe-deploy",
      description: "Safe deployment with rollback",
      category: "deploy-ops",
      aliases: ["deploy-safe", "sd"],
      usage: "safe-deploy [environment] [--strategy STRATEGY]",
      examples: [
        "safe-deploy production --strategy blue-green",
        "safe-deploy staging --canary 10%",
        "safe-deploy prod --health-check --auto-rollback",
      ],
      flags: [
        {
          name: "strategy",
          description: "Deployment strategy",
          type: "string",
        },
        {
          name: "canary",
          description: "Canary deployment percentage",
          type: "string",
        },
        {
          name: "health-check",
          description: "Enable health checks",
          type: "boolean",
          default: true,
        },
        {
          name: "auto-rollback",
          description: "Auto rollback on failure",
          type: "boolean",
          default: true,
        },
        {
          name: "dry-run",
          description: "Simulate deployment",
          type: "boolean",
        },
      ],
      requiresConfirmation: true,
      isDangerous: true,
    });

    // Git Operations
    this.register({
      name: "smart-commit",
      description: "Intelligent commit with AI messages",
      category: "git-ops",
      aliases: ["commit-smart", "sc"],
      usage: "smart-commit [--type TYPE] [--scope SCOPE]",
      examples: [
        "smart-commit --type feat --scope auth",
        "smart-commit --conventional",
        "smart-commit --split-changes",
      ],
      flags: [
        {
          name: "type",
          description: "Commit type (feat/fix/docs/etc)",
          type: "string",
        },
        { name: "scope", description: "Commit scope", type: "string" },
        {
          name: "conventional",
          description: "Use conventional commits",
          type: "boolean",
          default: true,
        },
        {
          name: "split-changes",
          description: "Split into multiple commits",
          type: "boolean",
        },
        {
          name: "verify",
          description: "Run pre-commit checks",
          type: "boolean",
          default: true,
        },
      ],
    });

    // Monitoring
    this.register({
      name: "monitor",
      description: "Real-time system monitoring",
      category: "monitoring",
      usage: "monitor [--metrics METRICS] [--interval SECONDS]",
      examples: [
        "monitor --metrics cpu,memory,disk",
        "monitor --processes --top 10",
        "monitor --logs --filter _error",
      ],
      flags: [
        { name: "metrics", description: "Metrics to monitor", type: "array" },
        {
          name: "interval",
          description: "Update interval",
          type: "number",
          default: 5,
        },
        {
          name: "processes",
          description: "Monitor processes",
          type: "boolean",
        },
        { name: "logs", description: "Monitor logs", type: "boolean" },
        { name: "alert", description: "Alert thresholds", type: "string" },
      ],
    });

    // Code Analysis Commands
    this.register({
      name: "analyze-code",
      description: "Comprehensive code quality analysis",
      category: "code-analysis",
      aliases: ["analyze", "quality"],
      usage: "analyze-code [file/pattern] [--format FORMAT]",
      examples: [
        "analyze-code src/utils.ts",
        'analyze-code "src/**/*.ts" --format json',
        "analyze-code . --dependencies --security",
      ],
      flags: [
        {
          name: "format",
          description: "Output format (text/json/html)",
          type: "string",
          default: "text",
        },
        {
          name: "dependencies",
          description: "Include dependency analysis",
          type: "boolean",
        },
        {
          name: "security",
          description: "Include security scan",
          type: "boolean",
        },
        {
          name: "threshold",
          description: "Quality threshold (0-100)",
          type: "number",
          default: 80,
        },
        {
          name: "report",
          description: "Generate detailed report",
          type: "boolean",
        },
      ],
      supportsParallel: true,
      maxParallelJobs: 4,
    });

    this.register({
      name: "refactor-suggest",
      description: "Generate intelligent refactoring suggestions",
      category: "refactoring",
      aliases: ["suggest-refactor", "rf-suggest"],
      usage: "refactor-suggest [file] [--type TYPE] [--auto-fix]",
      examples: [
        "refactor-suggest src/legacy.js",
        "refactor-suggest src/ --type complexity --auto-fix",
        "refactor-suggest . --severity critical",
      ],
      flags: [
        { name: "type", description: "Refactoring type filter", type: "array" },
        {
          name: "severity",
          description: "Minimum severity (info/warning/_error/critical)",
          type: "string",
        },
        {
          name: "auto-fix",
          description: "Apply auto-fixable suggestions",
          type: "boolean",
        },
        {
          name: "plan",
          description: "Generate refactoring plan",
          type: "boolean",
        },
        {
          name: "batch",
          description: "Batch process multiple files",
          type: "boolean",
        },
      ],
      requiresConfirmation: true,
      supportsParallel: true,
    });

    this.register({
      name: "extract-function",
      description: "Extract code into a function",
      category: "refactoring",
      aliases: ["extract-method", "extract"],
      usage: "extract-function [file] --lines START:END --name FUNCTION_NAME",
      examples: [
        "extract-function src/app.ts --lines 45:67 --name validateUser",
        "extract-function utils.js --lines 10:20 --name helper --async",
      ],
      flags: [
        {
          name: "lines",
          description: "Line range (start:end)",
          type: "string",
          required: true,
        },
        {
          name: "name",
          description: "Function name",
          type: "string",
          required: true,
        },
        { name: "async", description: "Make function async", type: "boolean" },
        { name: "export", description: "Export the function", type: "boolean" },
        {
          name: "preview",
          description: "Preview changes without applying",
          type: "boolean",
          default: true,
        },
      ],
      requiresConfirmation: true,
    });

    this.register({
      name: "rename-symbol",
      description: "Rename variables, functions, or classes",
      category: "refactoring",
      aliases: ["rename", "mv-symbol"],
      usage: "rename-symbol [file/pattern] --old NAME --new NAME",
      examples: [
        "rename-symbol src/app.ts --old oldFunction --new newFunction",
        'rename-symbol "src/**/*.ts" --old UserModel --new User --scope project',
      ],
      flags: [
        {
          name: "old",
          description: "Current name",
          type: "string",
          required: true,
        },
        {
          name: "new",
          description: "New name",
          type: "string",
          required: true,
        },
        {
          name: "scope",
          description: "Rename scope (file/project)",
          type: "string",
          default: "file",
        },
        {
          name: "case-sensitive",
          description: "Case sensitive matching",
          type: "boolean",
          default: true,
        },
        {
          name: "preview",
          description: "Preview changes",
          type: "boolean",
          default: true,
        },
      ],
      requiresConfirmation: true,
      supportsParallel: true,
    });

    this.register({
      name: "dependency-graph",
      description: "Analyze and visualize project dependencies",
      category: "code-analysis",
      aliases: ["deps-graph", "dg"],
      usage:
        "dependency-graph [project-root] [--format FORMAT] [--output FILE]",
      examples: [
        "dependency-graph . --format mermaid",
        "dependency-graph src/ --cycles --export graph.json",
        "dependency-graph . --unused --high-coupling",
      ],
      flags: [
        {
          name: "format",
          description: "Output format (json/dot/mermaid)",
          type: "string",
          default: "json",
        },
        { name: "output", description: "Output file path", type: "string" },
        {
          name: "cycles",
          description: "Detect circular dependencies",
          type: "boolean",
        },
        {
          name: "unused",
          description: "Find unused dependencies",
          type: "boolean",
        },
        {
          name: "high-coupling",
          description: "Find highly coupled modules",
          type: "boolean",
        },
        {
          name: "external",
          description: "Include external dependencies",
          type: "boolean",
        },
        {
          name: "depth",
          description: "Maximum analysis depth",
          type: "number",
        },
      ],
      supportsParallel: true,
    });

    this.register({
      name: "technical-debt",
      description: "Calculate and analyze technical debt",
      category: "code-analysis",
      aliases: ["debt", "td"],
      usage: "technical-debt [path] [--report] [--priority]",
      examples: [
        "technical-debt src/",
        "technical-debt . --report --export debt-report.json",
        "technical-debt src/ --priority --threshold 10",
      ],
      flags: [
        {
          name: "report",
          description: "Generate detailed report",
          type: "boolean",
        },
        {
          name: "priority",
          description: "Show priority items only",
          type: "boolean",
        },
        {
          name: "threshold",
          description: "Minimum debt hours to report",
          type: "number",
          default: 1,
        },
        { name: "category", description: "Filter by category", type: "string" },
        { name: "export", description: "Export to file", type: "string" },
      ],
      supportsParallel: true,
    });

    this.register({
      name: "optimize-imports",
      description: "Optimize and organize import statements",
      category: "refactoring",
      aliases: ["organize-imports", "opt-imports"],
      usage: "optimize-imports [file/pattern] [--remove-unused] [--sort]",
      examples: [
        "optimize-imports src/app.ts",
        'optimize-imports "src/**/*.ts" --remove-unused --sort',
        "optimize-imports . --group-external --preview",
      ],
      flags: [
        {
          name: "remove-unused",
          description: "Remove unused imports",
          type: "boolean",
          default: true,
        },
        {
          name: "sort",
          description: "Sort imports alphabetically",
          type: "boolean",
          default: true,
        },
        {
          name: "group-external",
          description: "Group external imports",
          type: "boolean",
        },
        {
          name: "preview",
          description: "Preview changes",
          type: "boolean",
          default: true,
        },
        {
          name: "auto-fix",
          description: "Apply changes automatically",
          type: "boolean",
        },
      ],
      supportsParallel: true,
      requiresConfirmation: true,
    });
  }

  register(_command: CLICommand): void {
    this.commands.set(command.name, _command);

    // Register aliases
    if (command.aliases) {
      command.aliases.forEach((alias) => {
        this.aliases.set(alias, command.name);
      });
    }

    this.emit("_command:registered", _command);
  }

  get(name: string): CLICommand | undefined {
    // Check if it's an alias
    const _actualName = this.aliases.get(name) || name;
    return this.commands.get(_actualName);
  }

  list(category?: CLICategory): CLICommand[] {
    const _commands = Array.from(this._commands.values());
    if (category) {
      return _commands.filter((cmd) => cmd.category === category);
    }
    return _commands;
  }

  getCategories(): CLICategory[] {
    const _categories = new Set<CLICategory>();
    this.commands.forEach((cmd) => _categories.add(cmd.category));
    return Array.from(_categories);
  }

  async execute(
    commandName: string,
    args: string[],
    context: CommandContext,
  ): Promise<CommandResult> {
    const _command = this.get(commandName);
    if (!_command) {
      return {
        success: false,
        _error: `Command not found: ${commandName}`,
      };
    }

    const _startTime = Date.now();

    try {
      // Check for dangerous operations
      if (_command.isDangerous && !context.dryRun) {
        this.emit("_command:dangerous", _command, args);
      }

      // Execute _command (placeholder for actual implementation)
      const result: CommandResult = {
        success: true,
        output: `Executing ${commandName} with args: ${args.join(" ")}`,
        duration: Date.now() - _startTime,
      };

      // Store in history
      this.executionHistory.push(result);

      this.emit("_command:executed", _command, result);
      return result;
    } catch (_error) {
      const result: CommandResult = {
        success: false,
        _error: _error instanceof Error ? _error.message : String(_error),
        duration: Date.now() - _startTime,
      };

      this.executionHistory.push(result);
      this.emit("_command:_error", _command, result);
      return result;
    }
  }

  getHistory(limit: number = 10): CommandResult[] {
    return this.executionHistory.slice(-limit);
  }

  async rollback(rollbackId: string): Promise<void> {
    const _rollbackFn = this.rollbackStack.get(rollbackId);
    if (!_rollbackFn) {
      throw new Error(`No rollback available for ID: ${rollbackId}`);
    }

    await _rollbackFn();
    this.rollbackStack.delete(rollbackId);
    this.emit("_command:rolledback", rollbackId);
  }
}

export const _cliRegistry = new CLICommandRegistry();
