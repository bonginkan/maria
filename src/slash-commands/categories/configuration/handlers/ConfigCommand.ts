/**
 * Configuration Command Handler
 * Manages MARIA configuration settings
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
import os from "os";

interface ConfigurationItem {
  type: "string" | "number" | "boolean" | "array" | "object";
  _description: string;
  default: unknown;
  sensitive?: boolean;
  validate?: (_value: unknown) => boolean;
  _category: string;
}

interface ConfigurationData {
  [_key: string]: unknown;
}

export class ConfigCommand extends BaseCommand {
  readonly meta: CommandMeta = {
    name: "_config",
    category: "configuration",
    description: "Manage MARIA configuration settings"
  };

  name = "_config";
  _category = "configuration" as const;
  _description = "Manage MARIA configuration settings";
  aliases = ["cfg", "settings", "conf"];
  usage =
    "[list|get|set|reset|edit|export|import|validate] [_key] [_value] [options]";

  examples = [
    {
      input: "/_config list",
      _description: "List all configuration settings",
    },
    {
      input: "/_config get defaultModel",
      _description: "Get a specific configuration _value",
    },
    {
      input: "/_config set temperature 0.8",
      _description: "Set a configuration _value",
    },
    {
      input: "/_config export ./my-config.json",
      _description: "Export configuration to file",
    },
  ];

  metadata = {
    version: "2.1.0",
    author: "MARIA Team",
    since: "2.0.0",
  };

  private readonly configDefinitions: Record<string, ConfigurationItem> = {
    // AI Settings
    defaultModel: {
      type: "string",
      _description: "Default AI model to use",
      default: "claude-3-sonnet",
      _category: "AI",
      validate: (v) => typeof v === "string" && v.length > 0,
    },
    temperature: {
      type: "number",
      _description: "AI temperature (0-2)",
      default: 0.7,
      _category: "AI",
      validate: (v) => typeof v === "number" && v >= 0 && v <= 2,
    },
    maxTokens: {
      type: "number",
      _description: "Maximum tokens per request",
      default: 4000,
      _category: "AI",
      validate: (v) => typeof v === "number" && v > 0,
    },
    streamResponse: {
      type: "boolean",
      _description: "Stream AI responses",
      default: true,
      _category: "AI",
      validate: (v) => typeof v === "boolean",
    },

    // UI Settings
    theme: {
      type: "string",
      _description: "UI theme (dark, light, auto)",
      default: "dark",
      _category: "UI",
      validate: (v) => ["dark", "light", "auto"].includes(v as string),
    },
    colors: {
      type: "boolean",
      _description: "Enable colored terminal output",
      default: true,
      _category: "UI",
      validate: (v) => typeof v === "boolean",
    },
    enableSlashCommandSuggestions: {
      type: "boolean",
      _description: "Enable slash command autocomplete suggestions",
      default: true,
      _category: "UI",
      validate: (v) => typeof v === "boolean",
    },
    animations: {
      type: "boolean",
      _description: "Enable UI animations",
      default: true,
      _category: "UI",
      validate: (v) => typeof v === "boolean",
    },
    language: {
      type: "string",
      _description: "UI language",
      default: "en",
      _category: "UI",
      validate: (v) => typeof v === "string",
    },

    // Developer Settings
    debug: {
      type: "boolean",
      _description: "Enable debug mode",
      default: false,
      _category: "Developer",
      validate: (v) => typeof v === "boolean",
    },
    verbose: {
      type: "boolean",
      _description: "Enable verbose logging",
      default: false,
      _category: "Developer",
      validate: (v) => typeof v === "boolean",
    },
    telemetry: {
      type: "boolean",
      _description: "Send usage telemetry",
      default: false,
      _category: "Developer",
      validate: (v) => typeof v === "boolean",
    },
    logLevel: {
      type: "string",
      _description: "Logging level (debug, info, warn, error)",
      default: "info",
      _category: "Developer",
      validate: (v) => ["debug", "info", "warn", "error"].includes(v as string),
    },

    // Project Settings
    defaultProjectPath: {
      type: "string",
      _description: "Default project directory",
      default: process.cwd(),
      _category: "Project",
      validate: (v) => typeof v === "string",
    },
    autoSave: {
      type: "boolean",
      _description: "Auto-save generated files",
      default: false,
      _category: "Project",
      validate: (v) => typeof v === "boolean",
    },
    autoFormat: {
      type: "boolean",
      _description: "Auto-format generated code",
      default: true,
      _category: "Project",
      validate: (v) => typeof v === "boolean",
    },
    backupCount: {
      type: "number",
      _description: "Number of backups to keep",
      default: 5,
      _category: "Project",
      validate: (v) => typeof v === "number" && v >= 0,
    },

    // API Keys (sensitive)
    openaiApiKey: {
      type: "string",
      _description: "OpenAI API _key",
      default: "",
      sensitive: true,
      _category: "API Keys",
      validate: (v) => typeof v === "string",
    },
    anthropicApiKey: {
      type: "string",
      _description: "Anthropic API _key",
      default: "",
      sensitive: true,
      _category: "API Keys",
      validate: (v) => typeof v === "string",
    },
    googleApiKey: {
      type: "string",
      _description: "Google AI API _key",
      default: "",
      sensitive: true,
      _category: "API Keys",
      validate: (v) => typeof v === "string",
    },
  };

  private globalConfigPath = path.join(os.homedir(), ".maria", "config.json");
  private localConfigPath = path.join(process.cwd(), ".maria-config.json");

  async execute(
    _args: CommandArgs,
    context: CommandContext,
  ): Promise<CommandResult> {
    try {
      const _startTime = Date.now();
      const _action = (_args.parsed.positional?.[0] as string) || "list";

      let result: CommandResult;

      switch (_action.toLowerCase()) {
        case "list":
        case "ls":
          result = await this.listConfigurations(_args);
          break;

        case "get":
          result = await this.getConfiguration(_args);
          break;

        case "set":
          result = await this.setConfiguration(_args);
          break;

        case "reset":
          result = await this.resetConfigurations(_args);
          break;

        case "edit":
          result = await this.editConfigurationFile(_args);
          break;

        case "export":
          result = await this.exportConfiguration(_args);
          break;

        case "import":
          result = await this.importConfiguration(_args);
          break;

        case "validate":
          result = await this.validateConfiguration(_args);
          break;

        case "help":
          result = this.success(this.formatHelp());
          break;

        default:
          result = this.error(
            `Unknown _config _action: ${_action}. Use: list, get, set, reset, edit, export, import, validate`,
          );
      }

      result.metadata = {
        ...result.metadata,
        executionTime: Date.now() - _startTime,
      };

      this.logExecution(_args, context, result);
      return result;
    } catch (error) {
      logger.error("Config command execution failed:", error);
      return this.error(
        `Configuration command failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        "CONFIG_ERROR",
        error,
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
      "get",
      "set",
      "reset",
      "edit",
      "export",
      "import",
      "validate",
      "help",
    ];
    if (!_validActions.includes(_action.toLowerCase())) {
      return {
        success: false,
        error: `Invalid _action: ${_action}`,
        _suggestions: _validActions,
      };
    }

    // Validate specific _action requirements
    if (_action === "get" && !args.parsed.positional?.[1]) {
      return {
        success: false,
        error: "Configuration _key required for get _action",
        _suggestions: ["Specify a configuration _key to retrieve"],
      };
    }

    if (
      _action === "set" &&
      (!args.parsed.positional?.[1] ||
        args.parsed.positional?.[2] === undefined)
    ) {
      return {
        success: false,
        error: "Configuration _key and _value required for set _action",
        _suggestions: [
          "Specify both _key and _value: /_config set <_key> <_value>",
        ],
      };
    }

    return { success: true };
  }

  private async listConfigurations(args: CommandArgs): Promise<CommandResult> {
    const _scope = this.getConfigScope(args);
    const _config = await this.loadConfiguration(_scope);

    const _categories = this.groupByCategory(_config);
    let _message = `# ⚙️  MARIA Configuration (${_scope})\n\n`;

    for (const [_category, items] of Object.entries(_categories)) {
      if (Object.keys(items).length === 0) {
        continue;
      }

      _message += `## ${this.getCategoryEmoji(_category)} ${_category}\n\n`;

      for (const [_key, _value] of Object.entries(items)) {
        const _definition = this.configDefinitions[_key];
        const _displayValue = _definition?.sensitive
          ? "********"
          : this.formatValue(_value);
        const _description = _definition?._description || "No _description";

        _message += `**${_key}**: \`${_displayValue}\`\n`;
        _message += `   ${_description}\n\n`;
      }
    }

    _message += `---\n`;
    _message += `*Use \`/_config get <_key>\` to view specific settings*\n`;
    _message += `*Use \`/_config set <_key> <_value>\` to modify settings*`;

    return this.success(_message, { _config, _scope });
  }

  private async getConfiguration(args: CommandArgs): Promise<CommandResult> {
    const _key = args.parsed.positional?.[1] as string;
    const _scope = this.getConfigScope(args);
    const _config = await this.loadConfiguration(_scope);

    if (!(_key in _config)) {
      const _suggestions = this.findSimilarKeys(_key);
      return this.error(
        `Configuration _key "${_key}" not found`,
        "KEY_NOT_FOUND",
        { _suggestions },
      );
    }

    const _value = _config[_key];
    const _definition = this.configDefinitions[_key];
    const _displayValue = _definition?.sensitive
      ? "********"
      : this.formatValue(_value);

    let _message = `# 📋 Configuration: ${_key}\n\n`;
    _message += `**Value**: \`${_displayValue}\`\n`;
    _message += `**Type**: ${_definition?.type || "unknown"}\n`;
    _message += `**Category**: ${_definition?.category || "Other"}\n`;
    _message += `**Description**: ${_definition?.description || "No _description"}\n`;
    _message += `**Scope**: ${_scope}\n`;

    if (_definition?.default !== undefined) {
      const _defaultDisplay = _definition.sensitive
        ? "********"
        : this.formatValue(_definition.default);
      _message += `**Default**: \`${_defaultDisplay}\`\n`;
    }

    return this.success(_message, { _key, _value, _scope });
  }

  private async setConfiguration(args: CommandArgs): Promise<CommandResult> {
    const _key = args.parsed.positional?.[1] as string;
    const _rawValue = args.parsed.positional?.[2];
    const _scope = this.getConfigScope(args);

    const _definition = this.configDefinitions[_key];

    // Parse _value according to type
    let _value: unknown = _rawValue;
    if (_definition) {
      try {
        _value = this.parseValue(_rawValue, _definition.type);

        // Validate the _value
        if (_definition.validate && !_definition.validate(_value)) {
          return this.error(
            `Invalid _value for ${_key}: ${_rawValue}`,
            "VALIDATION_ERROR",
          );
        }
      } catch (innerError) {
        return this.error(
          `Failed to parse _value for ${_key}: ${error instanceof Error ? error._message : "Parse error"}`,
          "PARSE_ERROR",
        );
      }
    }

    // Load current _config
    const _config = await this.loadConfiguration(_scope);
    _config[_key] = _value;

    // Save _config
    await this.saveConfiguration(_config, _scope);

    const _displayValue = _definition?.sensitive
      ? "********"
      : this.formatValue(_value);

    let _message = `✅ **Configuration Updated**\n\n`;
    _message += `**Key**: ${_key}\n`;
    _message += `**Value**: \`${_displayValue}\`\n`;
    _message += `**Scope**: ${_scope}\n`;

    if (_definition?.description) {
      _message += `**Description**: ${_definition.description}\n`;
    }

    // Cache the new _value
    this.setCache(`_config:${_scope}:${_key}`, _value, 300);

    return this.success(_message, { _key, _value, _scope });
  }

  private async resetConfigurations(args: CommandArgs): Promise<CommandResult> {
    const _scope = this.getConfigScope(args);
    const _specificKey = args.parsed.positional?.[1] as string;

    if (_specificKey) {
      // Reset specific _key
      const _definition = this.configDefinitions[_specificKey];
      if (!_definition) {
        return this.error(
          `Unknown configuration _key: ${_specificKey}`,
          "UNKNOWN_KEY",
        );
      }

      const _config = await this.loadConfiguration(_scope);
      _config[_specificKey] = _definition.default;
      await this.saveConfiguration(_config, _scope);

      return this.success(
        `✅ Configuration _key "${_specificKey}" reset to default _value`,
        {
          _key: _specificKey,
          _value: _definition.default,
          _scope,
        },
      );
    } else {
      // Reset all configurations
      const defaultConfig: ConfigurationData = {};
      for (const [_key, _definition] of Object.entries(
        this.configDefinitions,
      )) {
        defaultConfig[_key] = _definition.default;
      }

      await this.saveConfiguration(defaultConfig, _scope);

      return this.success(
        `✅ All configurations reset to default values (${_scope})`,
        {
          resetCount: Object.keys(defaultConfig).length,
          _scope,
        },
      );
    }
  }

  private async editConfigurationFile(
    args: CommandArgs,
  ): Promise<CommandResult> {
    const _scope = this.getConfigScope(args);
    const _configPath =
      _scope === "global" ? this.globalConfigPath : this.localConfigPath;

    // Ensure _config file exists
    await this.ensureConfigFile(_scope);

    const _message =
      `# 📝 Edit Configuration File\n\n` +
      `**Path**: \`${_configPath}\`\n` +
      `**Scope**: ${_scope}\n\n` +
      `*Configuration file is ready for editing.*\n` +
      `*Use your preferred text editor to modify the JSON file.*\n` +
      `*Run \`/_config validate\` after editing to check for errors.*`;

    return this.success(_message, { _path: _configPath, _scope });
  }

  private async exportConfiguration(args: CommandArgs): Promise<CommandResult> {
    const _scope = this.getConfigScope(args);
    const _exportPath =
      (args.parsed.positional?.[1] as string) ||
      `maria-_config-${_scope}-${Date.now()}.json`;
    const _config = await this.loadConfiguration(_scope);

    // Remove sensitive data unless explicitly requested
    const _exportConfig = { ..._config };
    if (!args.flags.includeSensitive) {
      for (const [_key, _definition] of Object.entries(
        this.configDefinitions,
      )) {
        if (definition.sensitive) {
          delete _exportConfig[_key];
        }
      }
    }

    const _exportData = {
      version: this.metadata.version,
      _scope,
      timestamp: new Date().toISOString(),
      configuration: _exportConfig,
    };

    await fs.writeFile(
      _exportPath,
      JSON.stringify(_exportData, null, 2),
      "utf-8",
    );

    return this.success(`✅ Configuration exported to: ${_exportPath}`, {
      _path: _exportPath,
      _scope,
      itemCount: Object.keys(_exportConfig).length,
    });
  }

  private async importConfiguration(args: CommandArgs): Promise<CommandResult> {
    const _importPath = args.parsed.positional?.[1] as string;
    if (!_importPath) {
      return this.error("Import file path required", "MISSING_PATH");
    }

    try {
      const _content = await fs.readFile(_importPath, "utf-8");
      const _importData = JSON.parse(_content);

      const _config = _importData.configuration || _importData;
      const _scope = this.getConfigScope(args);

      // Validate imported configuration
      const _validationResult = await this.validateConfigurationData(_config);
      if (!_validationResult.valid) {
        return this.error(
          `Invalid configuration data: ${_validationResult.errors.join(", ")}`,
          "VALIDATION_ERROR",
        );
      }

      await this.saveConfiguration(_config, _scope);

      return this.success(`✅ Configuration imported from: ${_importPath}`, {
        _path: _importPath,
        _scope,
        itemCount: Object.keys(_config).length,
      });
    } catch (error) {
      return this.error(
        `Failed to import configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
        "IMPORT_ERROR",
      );
    }
  }

  private async validateConfiguration(
    args: CommandArgs,
  ): Promise<CommandResult> {
    const _scope = this.getConfigScope(args);
    const _config = await this.loadConfiguration(_scope);

    const _validationResult = await this.validateConfigurationData(_config);

    let _message = `# 🔍 Configuration Validation (${_scope})\n\n`;

    if (_validationResult.valid) {
      _message += `✅ **All configurations are valid**\n\n`;
      _message += `**Validated Items**: ${_validationResult.validCount}\n`;
      _message += `**Scope**: ${_scope}\n`;
    } else {
      _message += `❌ **Configuration validation failed**\n\n`;
      _message += `**Errors**:\n`;
      validationResult.errors.forEach((error) => {
        _message += `• ${error}\n`;
      });
      _message += `\n**Valid Items**: ${_validationResult.validCount}\n`;
      _message += `**Invalid Items**: ${_validationResult.invalidCount}\n`;
    }

    return this.success(_message, _validationResult);
  }

  // Helper methods

  private getConfigScope(args: CommandArgs): "global" | "local" {
    if (args.flags.global) {
      return "global";
    }
    if (args.flags.local) {
      return "local";
    }
    return "global"; // Default to global
  }

  private async loadConfiguration(
    _scope: "global" | "local",
  ): Promise<ConfigurationData> {
    const _cacheKey = `_config:${_scope}`;
    const _cached = this.getCache<ConfigurationData>(_cacheKey);
    if (_cached) {
      return _cached;
    }

    const _configPath =
      _scope === "global" ? this.globalConfigPath : this.localConfigPath;

    try {
      const _content = await fs.readFile(_configPath, "utf-8");
      const _config = JSON.parse(_content);
      this.setCache(_cacheKey, _config, 300); // Cache for 5 minutes
      return _config;
    } catch (innerError) {
      // Return default configuration if file doesn't exist
      const defaultConfig: ConfigurationData = {};
      for (const [_key, _definition] of Object.entries(
        this.configDefinitions,
      )) {
        defaultConfig[_key] = definition.default;
      }
      return defaultConfig;
    }
  }

  private async saveConfiguration(
    _config: ConfigurationData,
    _scope: "global" | "local",
  ): Promise<void> {
    const _configPath =
      _scope === "global" ? this.globalConfigPath : this.localConfigPath;

    // Ensure directory exists
    await fs.mkdir(path.dirname(_configPath), { recursive: true });

    // Save configuration
    await fs.writeFile(_configPath, JSON.stringify(_config, null, 2), "utf-8");

    // Update cache
    this.setCache(`_config:${_scope}`, _config, 300);
  }

  private async ensureConfigFile(_scope: "global" | "local"): Promise<void> {
    const _configPath =
      _scope === "global" ? this.globalConfigPath : this.localConfigPath;

    try {
      await fs.access(_configPath);
    } catch {
      // File doesn't exist, create it
      await this.saveConfiguration({}, _scope);
    }
  }

  private parseValue(_value: unknown, type: string): unknown {
    switch (type) {
      case "boolean":
        if (typeof _value === "boolean") {
          return _value;
        }
        if (typeof _value === "string") {
          return _value.toLowerCase() === "true";
        }
        return Boolean(_value);

      case "number":
        if (typeof _value === "number") {
          return _value;
        }
        if (typeof _value === "string") {
          const _parsed = parseFloat(_value);
          if (isNaN(_parsed)) {
            throw new Error(`Cannot parse "${_value}" as number`);
          }
          return _parsed;
        }
        throw new Error(`Cannot convert ${typeof _value} to number`);

      case "string":
        return String(_value);

      case "array":
        if (Array.isArray(_value)) {
          return _value;
        }
        if (typeof _value === "string") {
          try {
            return JSON.parse(_value);
          } catch {
            return _value.split(",").map((s) => s.trim());
          }
        }
        return [_value];

      case "object":
        if (typeof _value === "object" && _value !== null) {
          return _value;
        }
        if (typeof _value === "string") {
          return JSON.parse(_value);
        }
        throw new Error(`Cannot convert ${typeof _value} to object`);

      default:
        return _value;
    }
  }

  private formatValue(_value: unknown): string {
    if (_value === null || _value === undefined) {
      return "null";
    }
    if (typeof _value === "string") {
      return _value;
    }
    return JSON.stringify(_value);
  }

  private groupByCategory(
    _config: ConfigurationData,
  ): Record<string, ConfigurationData> {
    const _categories: Record<string, ConfigurationData> = {};

    for (const [_key, _value] of Object.entries(_config)) {
      const _definition = this.configDefinitions[_key];
      const _category = _definition?._category || "Other";

      if (!_categories[_category]) {
        _categories[_category] = {};
      }
      _categories[_category][_key] = _value;
    }

    return _categories;
  }

  private getCategoryEmoji(_category: string): string {
    const emojis: Record<string, string> = {
      AI: "🤖",
      UI: "🎨",
      Developer: "👨💻",
      Project: "📁",
      "API Keys": "🔑",
      Other: "📋",
    };
    return emojis[_category] || "📋";
  }

  private findSimilarKeys(input: string): string[] {
    const _keys = Object._keys(this.configDefinitions);
    return _keys
      .filter(
        (_key) =>
          key.toLowerCase().includes(input.toLowerCase()) ||
          input.toLowerCase().includes(_key.toLowerCase()),
      )
      .slice(0, 3);
  }

  private async validateConfigurationData(_config: ConfigurationData): Promise<{
    valid: boolean;
    validCount: number;
    invalidCount: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let validCount = 0;
    let invalidCount = 0;

    for (const [_key, _value] of Object.entries(_config)) {
      const _definition = this.configDefinitions[_key];

      if (!_definition) {
        errors.push(`Unknown configuration _key: ${_key}`);
        invalidCount++;
        continue;
      }

      if (_definition.validate && !_definition.validate(_value)) {
        errors.push(`Invalid _value for ${_key}: ${this.formatValue(_value)}`);
        invalidCount++;
        continue;
      }

      validCount++;
    }

    return {
      valid: errors.length === 0,
      validCount,
      invalidCount,
      errors,
    };
  }
}

export const meta = {
  name: 'config',
  category: 'configuration',
  description: 'Manages MARIA configuration settings',
  aliases: ['cfg', 'settings', 'configure'],
  usage: '/config [get|set|list|validate] [key] [value]',
  examples: [
    '/config list',
    '/config get api.key',
    '/config set api.key sk-...',
    '/config validate'
  ],
  deps: []
};
