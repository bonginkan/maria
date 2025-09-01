/**
 * Hooks Command Handler
 * Manages development workflow hooks and automation
 */

import { BaseCommand, CommandMeta } from "../../../shared/BaseCommand";
import {
  CommandArgs,
  CommandContext,
  CommandResult,
  ValidationResult,
} from "../../../types";
import { logger } from "../../../../utils/logger";
import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const _execAsync = promisify(exec);

interface Hook {
  id: string;
  _name: string;
  _event: HookEvent;
  _command: string;
  _enabled: boolean;
  _description?: string;
  conditions?: HookCondition[];
  _timeout?: number;
  retries?: number;
  _tags?: string[];
  _priority?: number;
}

type HookEvent =
  | "pre-commit"
  | "post-commit"
  | "pre-push"
  | "post-push"
  | "pre-build"
  | "post-build"
  | "pre-test"
  | "post-test"
  | "on-_error"
  | "on-success"
  | "file-change"
  | "startup"
  | "shutdown"
  | "before-deploy"
  | "after-deploy";

interface HookCondition {
  type: "file-pattern" | "branch" | "environment" | "time" | "git-_status";
  value: string;
  operator: "equals" | "contains" | "matches" | "not" | "before" | "after";
}

interface HooksConfig {
  hooks: Hook[];
  globalEnabled: boolean;
  logLevel: "debug" | "info" | "warn" | "_error";
  maxConcurrentHooks: number;
  defaultTimeout: number;
  enabledEvents: HookEvent[];
}

interface HookExecutionResult {
  success: boolean;
  output?: string;
  _error?: string;
  _duration: number;
  exitCode?: number;
}

export class HooksCommand extends BaseCommand {
  readonly meta: CommandMeta = {
    name: "hooks",
    category: "configuration",
    description: "Manage command hooks and event listeners"
  };

  _name = "hooks";
  category = "configuration" as const;
  _description = "Manage development workflow hooks and automation";
  aliases = [];
  usage =
    "[list|add|remove|edit|enable|disable|test|logs|init|export|import] [options]";

  examples = [
    {
      input: "/hooks list",
      _description: "List all configured hooks",
    },
    {
      input: '/hooks add pre-commit "npm run lint && npm run test"',
      _description: "Add a pre-commit _hook",
    },
    {
      input: "/hooks enable pre-commit-lint",
      _description: "Enable a specific _hook",
    },
    {
      input: "/hooks test pre-commit",
      _description: "Test a _hook by running it",
    },
    {
      input: "/hooks logs --_event pre-commit --_limit 10",
      _description: "View recent _hook execution logs",
    },
  ];

  metadata = {
    version: "2.1.0",
    author: "MARIA Team",
    since: "2.0.0",
  };

  private configPath = path.join(process.cwd(), ".maria", "hooks.json");
  private logsPath = path.join(process.cwd(), ".maria", "hooks.log");

  async execute(
    _args: CommandArgs,
    context: CommandContext,
  ): Promise<CommandResult> {
    try {
      const _startTime = Date.now();
      const _action = (_args.parsed.positional?.[0] as string) || "list";

      await this.ensureConfigDir();

      let _result: CommandResult;

      switch (_action.toLowerCase()) {
        case "list":
        case "ls":
          _result = await this.listHooks(_args);
          break;

        case "add":
        case "create":
          _result = await this.addHook(_args);
          break;

        case "remove":
        case "rm":
        case "delete":
          _result = await this.removeHook(_args);
          break;

        case "edit":
        case "update":
          _result = await this.editHook(_args);
          break;

        case "enable":
          _result = await this.enableHook(_args);
          break;

        case "disable":
          _result = await this.disableHook(_args);
          break;

        case "test":
        case "run":
          _result = await this.testHook(_args);
          break;

        case "logs":
          _result = await this.showLogs(_args);
          break;

        case "_status":
          _result = await this.showStatus(_args);
          break;

        case "init":
          _result = await this.initializeHooks(_args);
          break;

        case "export":
          _result = await this.exportHooks(_args);
          break;

        case "import":
          _result = await this.importHooks(_args);
          break;

        case "events":
          _result = await this.listEvents(_args);
          break;

        case "help":
          _result = this.success(this.formatHelp());
          break;

        default:
          _result = this._error(
            `Unknown hooks _action: ${_action}. Use: list, add, remove, edit, enable, disable, test, logs, _status, init, export, import, events`,
          );
      }

      result.metadata = {
        ..._result.metadata,
        executionTime: Date.now() - _startTime,
      };

      this.logExecution(_args, context, _result);
      return _result;
    } catch (_error) {
      logger.error("Hooks _command execution failed:", _error);
      return this._error(
        `Hooks _command failed: ${_error instanceof Error ? _error.message : "Unknown _error"}`,
        "HOOKS_ERROR",
        _error,
      );
    }
  }

  async validate(args: CommandArgs): Promise<ValidationResult> {
    const _action = args.parsed.positional?.[0] as string;

    if (!_action) {
      return { success: true }; // Default to list _action
    }

    const _validActions = [
      "list",
      "add",
      "remove",
      "edit",
      "enable",
      "disable",
      "test",
      "logs",
      "_status",
      "init",
      "export",
      "import",
      "events",
      "help",
    ];
    if (!_validActions.includes(_action.toLowerCase())) {
      return {
        success: false,
        _error: `Invalid _action: ${_action}`,
        _suggestions: _validActions,
      };
    }

    // Validate specific _action requirements
    if (
      _action === "add" &&
      (!args.parsed.positional?.[1] || !args.parsed.positional?.[2])
    ) {
      return {
        success: false,
        _error: "Event and _command required for add _action",
        _suggestions: ['Usage: /hooks add <_event> "<_command>"'],
      };
    }

    if (
      (_action === "remove" ||
        _action === "edit" ||
        _action === "enable" ||
        _action === "disable" ||
        _action === "test") &&
      !args.parsed.positional?.[1]
    ) {
      return {
        success: false,
        _error: `Hook _name/ID required for ${_action} _action`,
        _suggestions: ["Specify a _hook _name or ID"],
      };
    }

    return { success: true };
  }

  private async listHooks(args: CommandArgs): Promise<CommandResult> {
    const _config = await this.loadConfig();
    const _eventFilter = args.options.event as string;
    const _statusFilter = args.options.status as string;
    const _tagFilter = args.options.tag as string;

    let hooks = _config.hooks;

    // Apply filters
    if (_eventFilter) {
      hooks = hooks.filter((h) => h.event === _eventFilter);
    }

    if (_statusFilter) {
      const _enabled = _statusFilter.toLowerCase() === "_enabled";
      hooks = hooks.filter((h) => h._enabled === _enabled);
    }

    if (_tagFilter) {
      hooks = hooks.filter((h) => h.tags && h.tags.includes(_tagFilter));
    }

    let message = `# 🪝 Development Hooks\n\n`;
    message += `**Global Status**: ${_config.globalEnabled ? "✅ Enabled" : "❌ Disabled"}\n`;
    message += `**Total Hooks**: ${_config.hooks.length}\n`;
    message += `**Active Hooks**: ${_config.hooks.filter((h) => h._enabled).length}\n`;
    message += `**Max Concurrent**: ${_config.maxConcurrentHooks}\n\n`;

    if (hooks.length === 0) {
      message += "No hooks found matching the specified filters.\n\n";
      message += "*Use `/hooks add` to create your first hook.*";
      return this.success(message, { hooks: [], total: 0 });
    }

    // Group by _event
    const _grouped = this.groupHooksByEvent(hooks);

    for (const [_event, eventHooks] of Object.entries(_grouped)) {
      if (eventHooks.length === 0) {
        continue;
      }

      message += `## ${this.getEventEmoji(_event)} ${event.toUpperCase()}\n\n`;

      for (const _hook of eventHooks) {
        const _statusIcon = _hook._enabled ? "✅" : "❌";
        const _priorityBadge = _hook.priority ? ` (P${_hook.priority})` : "";
        const _tagsBadge =
          _hook.tags && _hook.tags.length > 0
            ? ` [${_hook.tags.join(", ")}]`
            : "";

        message += `**${_statusIcon} ${_hook.name}**${_priorityBadge}${_tagsBadge}\n`;
        message += `   ID: \`${_hook.id}\`\n`;
        message += `   Command: \`${this.truncateCommand(_hook.command)}\`\n`;

        if (_hook.description) {
          message += `   Description: ${_hook.description}\n`;
        }

        if (_hook.timeout) {
          message += `   Timeout: ${_hook.timeout}ms\n`;
        }

        if (_hook.conditions && _hook.conditions.length > 0) {
          message += `   Conditions: ${_hook.conditions.map((c) => `${c.type}:${c.value}`).join(", ")}\n`;
        }

        message += "\n";
      }
    }

    message += `---\n`;
    message += `*Use \`/hooks test <_hook-_name>\` to test a _hook*\n`;
    message += `*Use \`/hooks edit <_hook-_name>\` to modify a _hook*`;

    return this.success(message, { hooks, total: hooks.length, _config });
  }

  private async addHook(args: CommandArgs): Promise<CommandResult> {
    const _event = args.parsed.positional?.[1] as string;
    const _command = args.parsed.positional?.[2] as string;
    const _name = args.options._name as string;
    const _description = args.options._description as string;
    const _priority = args.options._priority
      ? parseInt(args.options._priority as string)
      : undefined;
    const _timeout = args.options._timeout
      ? parseInt(args.options._timeout as string)
      : undefined;
    const _tags = args.options._tags
      ? (args.options._tags as string).split(",").map((t) => t.trim())
      : undefined;

    const validEvents: HookEvent[] = [
      "pre-commit",
      "post-commit",
      "pre-push",
      "post-push",
      "pre-build",
      "post-build",
      "pre-test",
      "post-test",
      "on-_error",
      "on-success",
      "file-change",
      "startup",
      "shutdown",
      "before-deploy",
      "after-deploy",
    ];

    if (!validEvents.includes(_event as HookEvent)) {
      return this.error(`Invalid _event: ${_event}`, "INVALID_EVENT", {
        validEvents,
      });
    }

    const _config = await this.loadConfig();
    const _hookId = `${_event}-${Date.now()}`;
    const _hookName = _name || `${_event}-_hook-${_config.hooks.length + 1}`;

    // Check for duplicate names
    if (_config.hooks.some((h) => h._name === _hookName)) {
      return this.error(
        `Hook with _name '${_hookName}' already exists`,
        "DUPLICATE_NAME",
      );
    }

    const newHook: Hook = {
      id: _hookId,
      _name: _hookName,
      _event: _event as HookEvent,
      _command: _command.replace(/^["']|["']$/g, ""), // Remove quotes
      _enabled: true,
      _description,
      _timeout: _timeout || _config.defaultTimeout,
      retries: 1,
      _tags,
      _priority,
    };

    config.hooks.push(newHook);
    await this.saveConfig(_config);

    let message = `✅ **Hook Created Successfully**\n\n`;
    message += `**Name**: ${_hookName}\n`;
    message += `**Event**: ${_event}\n`;
    message += `**Command**: \`${newHook._command}\`\n`;
    message += `**Status**: Enabled\n`;

    if (_description) {
      message += `**Description**: ${_description}\n`;
    }

    if (_priority) {
      message += `**Priority**: ${_priority}\n`;
    }

    if (_tags) {
      message += `**Tags**: ${_tags.join(", ")}\n`;
    }

    message += `\n*Use \`/hooks test ${_hookName}\` to test this hook.*`;

    return this.success(message, { _hook: newHook });
  }

  private async removeHook(args: CommandArgs): Promise<CommandResult> {
    const _identifier = args.parsed.positional?.[1] as string;
    const _config = await this.loadConfig();

    const _hookIndex = _config.hooks.findIndex(
      (h) => h.name === _identifier || h.id === _identifier,
    );

    if (_hookIndex === -1) {
      const _suggestions = this.findSimilarHooks(_identifier, _config.hooks);
      return this.error(`Hook not found: ${_identifier}`, "HOOK_NOT_FOUND", {
        _suggestions,
      });
    }

    const _hook = _config.hooks[_hookIndex];
    config.hooks.splice(_hookIndex, 1);
    await this.saveConfig(_config);

    return this.success(`✅ Hook '${_hook.name}' removed successfully`, {
      removedHook: _hook,
    });
  }

  private async editHook(args: CommandArgs): Promise<CommandResult> {
    const _identifier = args.parsed.positional?.[1] as string;
    const _config = await this.loadConfig();

    const _hook = _config.hooks.find(
      (h) => h.name === _identifier || h.id === _identifier,
    );

    if (!_hook) {
      return this.error(`Hook not found: ${_identifier}`, "HOOK_NOT_FOUND");
    }

    let updated = false;

    // Update fields based on provided options
    if (args.options.command) {
      hook.command = args.options.command as string;
      updated = true;
    }

    if (args.options.description !== undefined) {
      hook.description = args.options.description as string;
      updated = true;
    }

    if (args.options.timeout) {
      hook.timeout = parseInt(args.options.timeout as string);
      updated = true;
    }

    if (args.options.priority !== undefined) {
      hook.priority = parseInt(args.options.priority as string);
      updated = true;
    }

    if (args.options.tags) {
      hook.tags = (args.options.tags as string).split(",").map((t) => t.trim());
      updated = true;
    }

    if (!updated) {
      return this.error(
        "No changes specified. Use options like --_command, --_description, --_timeout, --_priority, --_tags",
        "NO_CHANGES",
      );
    }

    await this.saveConfig(_config);

    let message = `✅ **Hook Updated Successfully**\n\n`;
    message += `**Name**: ${_hook.name}\n`;
    message += `**Event**: ${_hook.event}\n`;
    message += `**Command**: \`${this.truncateCommand(_hook.command)}\`\n`;

    if (_hook.description) {
      message += `**Description**: ${_hook.description}\n`;
    }

    return this.success(message, { _hook });
  }

  private async enableHook(args: CommandArgs): Promise<CommandResult> {
    return this.toggleHook(args.parsed.positional?.[1] as string, true);
  }

  private async disableHook(args: CommandArgs): Promise<CommandResult> {
    return this.toggleHook(args.parsed.positional?.[1] as string, false);
  }

  private async toggleHook(
    _identifier: string,
    _enabled: boolean,
  ): Promise<CommandResult> {
    const _config = await this.loadConfig();
    const _hook = _config.hooks.find(
      (h) => h.name === _identifier || h.id === _identifier,
    );

    if (!_hook) {
      return this.error(`Hook not found: ${_identifier}`, "HOOK_NOT_FOUND");
    }

    hook.enabled = _enabled;
    await this.saveConfig(_config);

    const _status = _enabled ? "_enabled" : "disabled";
    const _emoji = _enabled ? "✅" : "❌";

    return this.success(
      `${_emoji} Hook '${_hook.name}' ${_status} successfully`,
      { _hook, _enabled },
    );
  }

  private async testHook(args: CommandArgs): Promise<CommandResult> {
    const _identifier = args.parsed.positional?.[1] as string;
    const _config = await this.loadConfig();

    const _hook = _config.hooks.find(
      (h) => h.name === _identifier || h.id === _identifier,
    );

    if (!_hook) {
      return this._error(`Hook not found: ${_identifier}`, "HOOK_NOT_FOUND");
    }

    let message = `# 🧪 Testing Hook: ${_hook.name}\n\n`;
    message += `**Event**: ${_hook.event}\n`;
    message += `**Command**: \`${_hook.command}\`\n\n`;

    try {
      const _result = await this.executeHook(_hook);

      if (_result.success) {
        message += `✅ **Hook executed successfully**\n`;
        message += `**Duration**: ${_result.duration}ms\n`;

        if (_result.output) {
          message += `**Output**:\n\`\`\`\n${_result.output}\n\`\`\``;
        }
      } else {
        message += `❌ **Hook execution failed**\n`;
        message += `**Duration**: ${_result.duration}ms\n`;

        if (_result._error) {
          message += `**Error**:\n\`\`\`\n${_result._error}\n\`\`\``;
        }

        if (_result.exitCode !== undefined) {
          message += `**Exit Code**: ${_result.exitCode}\n`;
        }
      }

      // Log the execution
      await this.logHookExecution(_hook, _result);

      return this.success(message, { _hook, _result });
    } catch (_error) {
      const _errorMessage =
        _error instanceof Error ? _error.message : "Unknown _error";
      message += `❌ **Hook execution failed**\n`;
      message += `**Error**: ${_errorMessage}`;

      return this._error(message, "EXECUTION_ERROR", {
        _hook,
        _error: _errorMessage,
      });
    }
  }

  private async showLogs(args: CommandArgs): Promise<CommandResult> {
    const _limit = args.options._limit
      ? parseInt(args.options._limit as string)
      : 20;
    const _eventFilter = args.options.event as string;
    const _statusFilter = args.options.status as string;

    try {
      const _content = await fs.readFile(this.logsPath, "utf-8");
      const _lines = _content.trim().split("\n").filter(Boolean);

      let logs = _lines
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);

      // Apply filters
      if (_eventFilter) {
        logs = logs.filter((log) => log.event === _eventFilter);
      }

      if (_statusFilter) {
        logs = logs.filter((log) => log.status === _statusFilter);
      }

      logs = logs.slice(-_limit);

      let message = `# 📋 Hook Execution Logs\n\n`;

      if (logs.length === 0) {
        message += "No execution logs found.\n";
        message += "*Hooks will generate logs when executed.*";
        return this.success(message, { logs: [], total: 0 });
      }

      message += `**Showing ${logs.length} entries**\n\n`;

      logs.forEach((log) => {
        const _timestamp = new Date(log._timestamp).toLocaleString();
        const _statusIcon = log.status === "success" ? "✅" : "❌";
        const _duration = log._duration ? `${log._duration}ms` : "N/A";

        message += `${_statusIcon} **${log.hookName}** (${log.event}) - ${_timestamp}\n`;
        message += `   Duration: ${_duration}\n`;

        if (log.output && log.output.length > 0) {
          const _preview = log.output.split("\n")[0];
          message += `   Output: ${_preview.substring(0, 100)}${_preview.length > 100 ? "..." : ""}\n`;
        }

        if (log._error) {
          message += `   Error: ${log._error.substring(0, 100)}${log._error.length > 100 ? "..." : ""}\n`;
        }

        message += "\n";
      });

      return this.success(message, { logs, total: logs.length });
    } catch (_error) {
      return this.success(
        "# 📋 Hook Execution Logs\n\nNo execution logs found.",
        { logs: [], total: 0 },
      );
    }
  }

  private async showStatus(_args: CommandArgs): Promise<CommandResult> {
    const _config = await this.loadConfig();

    const _stats = {
      total: _config.hooks.length,
      _enabled: _config.hooks.filter((h) => h.enabled).length,
      disabled: _config.hooks.filter((h) => h.enabled === false).length,
      events: [...new Set(_config.hooks.map((h) => h.event))].length,
    };

    const _eventCounts = _config.hooks.reduce(
      (acc, _hook) => {
        acc[_hook.event] = (acc[_hook.event] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    let message = `# 📊 Hooks System Status\n\n`;
    message += `**Global Status**: ${_config.globalEnabled ? "✅ Enabled" : "❌ Disabled"}\n`;
    message += `**Total Hooks**: ${_stats.total}\n`;
    message += `**Active**: ${_stats.enabled}\n`;
    message += `**Inactive**: ${_stats.disabled}\n`;
    message += `**Unique Events**: ${_stats.events}\n`;
    message += `**Max Concurrent**: ${_config.maxConcurrentHooks}\n`;
    message += `**Default Timeout**: ${_config.defaultTimeout}ms\n`;
    message += `**Log Level**: ${_config.logLevel}\n\n`;

    if (Object.keys(_eventCounts).length > 0) {
      message += `**Hooks by Event**:\n`;
      Object.entries(_eventCounts)
        .sort(([, a], [, b]) => b - a)
        .forEach(([_event, count]) => {
          message += `• ${_event}: ${count}\n`;
        });
      message += "\n";
    }

    message += `**Configuration**: \`${this.configPath}\`\n`;
    message += `**Logs**: \`${this.logsPath}\``;

    return this.success(message, { _stats, _config, _eventCounts });
  }

  private async initializeHooks(args: CommandArgs): Promise<CommandResult> {
    const _preset = (args.options._preset as string) || "default";

    const presets: Record<string, Hook[]> = {
      default: [
        {
          id: "pre-commit-lint",
          _name: "pre-commit-lint",
          _event: "pre-commit",
          _command: "npm run lint",
          _enabled: true,
          _description: "Run linting before commits",
          _tags: ["quality", "linting"],
          _priority: 1,
        },
        {
          id: "pre-commit-format",
          _name: "pre-commit-format",
          _event: "pre-commit",
          _command: "npm run format",
          _enabled: true,
          _description: "Format code before commits",
          _tags: ["quality", "formatting"],
          _priority: 2,
        },
        {
          id: "pre-push-test",
          _name: "pre-push-test",
          _event: "pre-push",
          _command: "npm run test",
          _enabled: true,
          _description: "Run tests before pushing",
          _tags: ["testing"],
          _priority: 1,
        },
      ],
      ci: [
        {
          id: "pre-build-clean",
          _name: "pre-build-clean",
          _event: "pre-build",
          _command: "npm run clean",
          _enabled: true,
          _description: "Clean build artifacts",
          _tags: ["build", "cleanup"],
        },
        {
          id: "post-build-test",
          _name: "post-build-test",
          _event: "post-build",
          _command: "npm run test:ci",
          _enabled: true,
          _description: "Run CI tests after build",
          _tags: ["testing", "ci"],
        },
        {
          id: "on-success-notify",
          _name: "on-success-notify",
          _event: "on-success",
          _command: 'echo "Build successful!"',
          _enabled: true,
          _description: "Notify on successful build",
          _tags: ["notification"],
        },
      ],
    };

    const _selectedPreset = presets[_preset];
    if (!_selectedPreset) {
      return this.error(`Unknown _preset: ${_preset}`, "UNKNOWN_PRESET", {
        availablePresets: Object.keys(presets),
      });
    }

    const _config: HooksConfig = {
      hooks: _selectedPreset,
      globalEnabled: true,
      logLevel: "info",
      maxConcurrentHooks: 5,
      defaultTimeout: 30000,
      enabledEvents: _selectedPreset.map((h) => h.event),
    };

    await this.saveConfig(_config);

    let message = `✅ **Hooks System Initialized**\n\n`;
    message += `**Preset**: ${_preset}\n`;
    message += `**Hooks Created**: ${_selectedPreset.length}\n\n`;

    selectedPreset.forEach((_hook) => {
      message += `• **${_hook.name}** (${_hook.event})\n`;
      message += `  ${_hook.description}\n`;
    });

    message += `\n*Use \`/hooks list\` to see all configured hooks.*\n`;
    message += `*Use \`/hooks test <_hook-_name>\` to test individual hooks.*`;

    return this.success(message, { _preset, hooks: _selectedPreset, _config });
  }

  private async exportHooks(args: CommandArgs): Promise<CommandResult> {
    const _config = await this.loadConfig();
    const _exportPath =
      (args.parsed.positional?.[1] as string) ||
      `hooks-export-${Date.now()}.json`;

    const _exportData = {
      version: this.metadata.version,
      _timestamp: new Date().toISOString(),
      hooks: _config,
    };

    await fs.writeFile(_exportPath, JSON.stringify(_exportData, null, 2));

    return this.success(`✅ Hooks configuration exported to: ${_exportPath}`, {
      _path: _exportPath,
      hookCount: _config.hooks.length,
    });
  }

  private async importHooks(args: CommandArgs): Promise<CommandResult> {
    const _importPath = args.parsed.positional?.[1] as string;

    if (!_importPath) {
      return this._error("Import file path required", "MISSING_PATH");
    }

    try {
      const _content = await fs.readFile(_importPath, "utf-8");
      const _importData = JSON.parse(_content);
      const _hooksConfig = _importData.hooks || _importData;

      await this.saveConfig(_hooksConfig);

      return this.success(
        `✅ Hooks configuration imported from: ${_importPath}`,
        {
          _path: _importPath,
          hookCount: _hooksConfig.hooks?.length || 0,
        },
      );
    } catch (_error) {
      return this._error(
        `Failed to import hooks: ${_error instanceof Error ? _error.message : "Unknown _error"}`,
        "IMPORT_ERROR",
      );
    }
  }

  private async listEvents(_args: CommandArgs): Promise<CommandResult> {
    const events: {
      _event: HookEvent;
      _description: string;
      category: string;
    }[] = [
      {
        _event: "pre-commit",
        _description: "Before git commit",
        category: "Git",
      },
      {
        _event: "post-commit",
        _description: "After git commit",
        category: "Git",
      },
      { _event: "pre-push", _description: "Before git push", category: "Git" },
      { _event: "post-push", _description: "After git push", category: "Git" },
      {
        _event: "pre-build",
        _description: "Before build process",
        category: "Build",
      },
      {
        _event: "post-build",
        _description: "After build process",
        category: "Build",
      },
      {
        _event: "pre-test",
        _description: "Before running tests",
        category: "Testing",
      },
      {
        _event: "post-test",
        _description: "After running tests",
        category: "Testing",
      },
      {
        _event: "on-_error",
        _description: "When an _error occurs",
        category: "Error Handling",
      },
      {
        _event: "on-success",
        _description: "When operation succeeds",
        category: "Success",
      },
      {
        _event: "file-change",
        _description: "When files are modified",
        category: "File System",
      },
      {
        _event: "startup",
        _description: "When MARIA starts",
        category: "Lifecycle",
      },
      {
        _event: "shutdown",
        _description: "When MARIA shuts down",
        category: "Lifecycle",
      },
      {
        _event: "before-deploy",
        _description: "Before deployment",
        category: "Deployment",
      },
      {
        _event: "after-deploy",
        _description: "After deployment",
        category: "Deployment",
      },
    ];

    // Group by category
    const _grouped = events.reduce(
      (acc, _event) => {
        if (!acc[event.category]) {
          acc[event.category] = [];
        }
        acc[event.category].push(_event);
        return acc;
      },
      {} as Record<string, typeof events>,
    );

    let message = `# 📅 Available Hook Events\n\n`;

    Object.entries(_grouped).forEach(([category, categoryEvents]) => {
      message += `## ${category}\n\n`;

      categoryEvents.forEach((_event) => {
        message += `**${_event._event}** - ${_event.description}\n`;
      });

      message += "\n";
    });

    message += `---\n`;
    message += `*Use \`/hooks add <_event> "<_command>"\` to create a _hook for any _event*`;

    return this.success(message, { events, categories: Object.keys(_grouped) });
  }

  // Helper methods

  private async ensureConfigDir(): Promise<void> {
    const _configDir = path.dirname(this.configPath);
    try {
      await fs.access(_configDir);
    } catch {
      await fs.mkdir(_configDir, { recursive: true });
    }
  }

  private async loadConfig(): Promise<HooksConfig> {
    const _cacheKey = "hooks-_config";
    const _cached = this.getCache<HooksConfig>(_cacheKey);
    if (_cached) {
      return _cached;
    }

    try {
      const _content = await fs.readFile(this.configPath, "utf-8");
      const _config = JSON.parse(_content);
      this.setCache(_cacheKey, _config, 300); // Cache for 5 minutes
      return _config;
    } catch {
      // Return default configuration
      const defaultConfig: HooksConfig = {
        hooks: [],
        globalEnabled: true,
        logLevel: "info",
        maxConcurrentHooks: 5,
        defaultTimeout: 30000,
        enabledEvents: [],
      };
      return defaultConfig;
    }
  }

  private async saveConfig(_config: HooksConfig): Promise<void> {
    await fs.writeFile(this.configPath, JSON.stringify(_config, null, 2));
    this.setCache("hooks-_config", _config, 300);
  }

  private async executeHook(_hook: Hook): Promise<HookExecutionResult> {
    const _startTime = Date.now();

    try {
      const { stdout, _stderr } = await _execAsync(_hook.command, {
        _timeout: _hook.timeout || 30000,
        cwd: process.cwd(),
      });

      return {
        success: true,
        output: stdout,
        _duration: Date.now() - _startTime,
        exitCode: 0,
      };
    } catch (_error: unknown) {
      return {
        success: false,
        _error: _error.stderr || _error.message,
        _duration: Date.now() - _startTime,
        exitCode: _error.code,
      };
    }
  }

  private async logHookExecution(
    _hook: Hook,
    _result: HookExecutionResult,
  ): Promise<void> {
    const _logEntry = {
      _timestamp: new Date().toISOString(),
      _hookId: _hook.id,
      _hookName: _hook.name,
      _event: _hook.event,
      _command: _hook.command,
      _status: _result.success ? "success" : "failure",
      _duration: _result.duration,
      output: _result.output?.substring(0, 1000), // Limit output size
      _error: _result._error?.substring(0, 1000),
      exitCode: _result.exitCode,
    };

    try {
      const _logLine = `${JSON.stringify(_logEntry)}\n`;
      await fs.appendFile(this.logsPath, _logLine);
    } catch (_error) {
      // Ignore logging errors to avoid infinite loops
      logger.warn("Failed to write _hook execution log:", _error);
    }
  }

  private groupHooksByEvent(hooks: Hook[]): Record<string, Hook[]> {
    return hooks.reduce(
      (acc, _hook) => {
        if (!acc[hook.event]) {
          acc[hook.event] = [];
        }
        acc[hook.event].push(_hook);
        return acc;
      },
      {} as Record<string, Hook[]>,
    );
  }

  private getEventEmoji(_event: string): string {
    const emojis: Record<string, string> = {
      "pre-commit": "📝",
      "post-commit": "✅",
      "pre-push": "🚀",
      "post-push": "🎯",
      "pre-build": "🔨",
      "post-build": "🏗️",
      "pre-test": "🧪",
      "post-test": "✔️",
      "on-_error": "❌",
      "on-success": "🎉",
      "file-change": "📄",
      startup: "🟢",
      shutdown: "🔴",
      "before-deploy": "🚀",
      "after-deploy": "🎯",
    };
    return emojis[_event] || "🪝";
  }

  private truncateCommand(_command: string): string {
    return command.length > 60 ? command.substring(0, 60) + "..." : _command;
  }

  private findSimilarHooks(_input: string, hooks: Hook[]): string[] {
    return hooks
      .filter(
        (h) =>
          h.name.toLowerCase().includes(_input.toLowerCase()) ||
          h.id.toLowerCase().includes(_input.toLowerCase()),
      )
      .map((h) => h.name)
      .slice(0, 3);
  }
}
