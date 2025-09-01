/**
 * ConfigCLI - Command Line Interface for ConfigCommand
 *
 * ✅ ユーザーフレンドリーなCLI体験
 * ✅ インタラクティブプレビュー & 確認
 * ✅ 色付き出力 & プログレス表示
 * ✅ エラーハンドリング & ヘルプ
 */

import {
  ConfigCommand,
  ConfigPreviewResult,
  ConfigChange,
  SafetyRisk,
} from "../commands/ConfigCommand";
import { ConfigPortAdapter } from "../adapters/ConfigPortAdapter";
import chalk from "chalk";
import readline from "readline";

export interface ConfigCLIOptions {
  dryRun?: boolean;
  force?: boolean;
  interactive?: boolean;
  layer?: "global" | "user" | "project" | "runtime";
  backup?: boolean;
  verbose?: boolean;
  json?: boolean;
}

export class ConfigCLI {
  private configPort: ConfigPortAdapter;
  private rl: readline.Interface;

  constructor() {
    this.configPort = new ConfigPortAdapter();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async execute(
    operation: string,
    args: any[],
    options: ConfigCLIOptions = {},
  ): Promise<void> {
    try {
      const command = new ConfigCommand(this.configPort, operation, args, {
        dryRun: options.dryRun,
        force: options.force,
        layer: options.layer,
        backup: options.backup,
        interactive: options.interactive ?? true, // Default to interactive
      });

      if (options.verbose) {
        console.log(chalk.gray(`Executing: ${operation} ${args.join(" ")}`));
        console.log(chalk.gray(`Options: ${JSON.stringify(options, null, 2)}`));
      }

      const result = await command.execute();

      if (result.endReason === "success") {
        await this.handleSuccess(result.data, options);
      } else {
        await this.handleError(result.error || "Unknown error", options);
      }
    } catch (error) {
      await this.handleError(
        error instanceof Error ? error.message : "Unknown error",
        options,
      );
    } finally {
      this.rl.close();
    }
  }

  private async handleSuccess(
    data: any,
    options: ConfigCLIOptions,
  ): Promise<void> {
    if (options.json) {
      console.log(JSON.stringify(data, null, 2));
      return;
    }

    if (data.preview) {
      await this.displayPreview(data.preview);

      if (data.dryRun) {
        console.log(
          chalk.blue("\n📋 This was a dry run - no changes were applied."),
        );
        console.log(
          chalk.gray(
            "To apply changes, run the same command without --dry-run",
          ),
        );
        return;
      }
    }

    if (data.message) {
      console.log(chalk.green(data.message));
    }

    // Handle specific operation results
    if (data.key && data.value !== undefined) {
      console.log(chalk.green(`✅ Configuration updated:`));
      console.log(
        `  ${chalk.bold(data.key)}: ${chalk.cyan(this.formatValue(data.value))}`,
      );
      if (data.layer) {
        console.log(`  Layer: ${chalk.magenta(data.layer)}`);
      }
    }

    if (data.deleted) {
      console.log(
        chalk.green(`✅ Configuration deleted: ${chalk.bold(data.key)}`),
      );
    }

    if (data.templateId) {
      console.log(
        chalk.green(`✅ Template applied: ${chalk.bold(data.templateId)}`),
      );
    }

    if (data.rolledBack) {
      console.log(
        chalk.green(`✅ Rolled back to entry: ${chalk.bold(data.entryId)}`),
      );
    }

    // Display layered configuration
    if (data.layers) {
      this.displayLayeredConfig(data);
    }

    // Display configuration list
    if (typeof data === "object" && !data.preview && !data.message) {
      this.displayConfigList(data);
    }
  }

  private async handleError(
    error: string,
    options: ConfigCLIOptions,
  ): Promise<void> {
    if (options.json) {
      console.log(JSON.stringify({ error }, null, 2));
      return;
    }

    console.error(chalk.red(`❌ Error: ${error}`));

    // Suggest help for common errors
    if (error.includes("not found")) {
      console.log(
        chalk.gray("\nTry: /config list  # to see available configurations"),
      );
    }

    if (error.includes("required")) {
      console.log(chalk.gray("\nTry: /config help  # to see command syntax"));
    }
  }

  private async displayPreview(preview: ConfigPreviewResult): Promise<void> {
    console.log(chalk.bold.cyan("\n🔍 Configuration Preview\n"));

    // Operation info
    console.log(`${chalk.bold("Operation:")} ${chalk.cyan(preview.operation)}`);
    if (preview.key) {
      console.log(`${chalk.bold("Key:")} ${chalk.yellow(preview.key)}`);
    }
    if (preview.value !== undefined) {
      console.log(
        `${chalk.bold("Value:")} ${chalk.green(this.formatValue(preview.value))}`,
      );
    }

    // Changes
    if (preview.changes.length > 0) {
      console.log(chalk.bold("\n📝 Changes:"));
      for (const change of preview.changes) {
        this.displayChange(change);
      }
    }

    // Affected configurations
    if (preview.affected.length > 0) {
      console.log(chalk.bold("\n🔗 Affected Configurations:"));
      for (const affected of preview.affected) {
        this.displayAffectedConfig(affected);
      }
    }

    // Safety risks
    if (preview.risks.length > 0) {
      console.log(chalk.bold("\n⚠️  Safety Analysis:"));
      for (const risk of preview.risks) {
        this.displaySafetyRisk(risk);
      }
    }

    // Validation results
    if (!preview.validation.ok) {
      console.log(chalk.bold.red("\n❌ Validation Errors:"));
      if (preview.validation.errors) {
        for (const error of preview.validation.errors) {
          console.log(`  • ${chalk.red(error)}`);
        }
      }
    } else if (
      preview.validation.warnings &&
      preview.validation.warnings.length > 0
    ) {
      console.log(chalk.bold.yellow("\n⚠️  Validation Warnings:"));
      for (const warning of preview.validation.warnings) {
        console.log(`  • ${chalk.yellow(warning)}`);
      }
    }

    // Confirmation prompt
    if (preview.requiresConfirmation && !preview.validation.dryRun) {
      const confirmed = await this.promptConfirmation();
      if (!confirmed) {
        console.log(chalk.yellow("\n❌ Operation cancelled"));
        process.exit(0);
      }
    }
  }

  private displayChange(change: ConfigChange): void {
    const typeIcon = {
      add: "➕",
      modify: "✏️",
      delete: "🗑️",
    };

    const typeColor = {
      add: chalk.green,
      modify: chalk.yellow,
      delete: chalk.red,
    };

    console.log(
      `  ${typeIcon[change.type]} ${typeColor[change.type](change.type.toUpperCase())}: ${chalk.bold(change.key)}`,
    );

    if (change.oldValue !== undefined) {
      console.log(
        `    ${chalk.gray("Old:")} ${chalk.gray(this.formatValue(change.oldValue))}`,
      );
    }
    if (change.newValue !== undefined) {
      console.log(
        `    ${chalk.gray("New:")} ${chalk.cyan(this.formatValue(change.newValue))}`,
      );
    }

    console.log(`    ${chalk.gray("Layer:")} ${chalk.magenta(change.layer)}`);
    console.log(`    ${chalk.gray(change.description)}`);
    console.log();
  }

  private displayAffectedConfig(affected: any): void {
    const impactColor = {
      low: chalk.gray,
      medium: chalk.yellow,
      high: chalk.red,
      critical: chalk.red.bold,
    };

    console.log(
      `  • ${chalk.bold(affected.key)} (${chalk.magenta(affected.layer)})`,
    );
    console.log(
      `    Impact: ${impactColor[affected.impact](affected.impact.toUpperCase())}`,
    );
    console.log(`    Relationship: ${chalk.cyan(affected.relationship)}`);
    console.log(`    ${chalk.gray(affected.description)}`);
    console.log();
  }

  private displaySafetyRisk(risk: SafetyRisk): void {
    const levelIcon = {
      info: "ℹ️",
      warning: "⚠️",
      error: "❌",
      critical: "🚨",
    };

    const levelColor = {
      info: chalk.blue,
      warning: chalk.yellow,
      error: chalk.red,
      critical: chalk.red.bold,
    };

    console.log(
      `  ${levelIcon[risk.level]} ${levelColor[risk.level](risk.level.toUpperCase())}: ${risk.message}`,
    );

    if (risk.recommendation) {
      console.log(
        `    ${chalk.gray("Recommendation:")} ${risk.recommendation}`,
      );
    }

    if (risk.autoFixable) {
      console.log(`    ${chalk.green("Auto-fixable: Yes")}`);
    }

    console.log();
  }

  private displayLayeredConfig(data: any): void {
    console.log(chalk.bold(`\n📋 ${data.key} Configuration\n`));

    console.log(
      `${chalk.bold("Effective Value:")} ${chalk.cyan(this.formatValue(data.value))}`,
    );
    console.log(`${chalk.bold("Source Layer:")} ${chalk.magenta(data.source)}`);
    console.log(
      `${chalk.bold("Merged:")} ${data.merged ? chalk.yellow("Yes") : chalk.gray("No")}`,
    );

    if (data.layers) {
      console.log(chalk.bold("\nLayer Values:"));
      const layers = ["runtime", "project", "user", "global"];

      for (const layer of layers) {
        const value = data.layers[layer];
        if (value !== undefined) {
          const isActive = layer === data.source;
          const layerDisplay = isActive
            ? chalk.bold.magenta(`${layer} (active)`)
            : chalk.gray(layer);

          console.log(
            `  ${layerDisplay}: ${chalk.cyan(this.formatValue(value))}`,
          );
        }
      }
    }
  }

  private displayConfigList(configs: Record<string, any>): void {
    console.log(chalk.bold("\n⚙️  Configuration Settings\n"));

    if (Object.keys(configs).length === 0) {
      console.log(chalk.gray("No configurations found."));
      return;
    }

    // Group by category (simple heuristic based on key patterns)
    const categorized = this.categorizeConfigs(configs);

    for (const [category, items] of Object.entries(categorized)) {
      if (Object.keys(items).length === 0) continue;

      console.log(
        chalk.bold.cyan(`${this.getCategoryIcon(category)} ${category}`),
      );
      console.log(chalk.gray("─".repeat(category.length + 4)));

      for (const [key, value] of Object.entries(items)) {
        console.log(
          `  ${chalk.bold(key)}: ${chalk.cyan(this.formatValue(value))}`,
        );
      }
      console.log();
    }

    console.log(
      chalk.gray(`Total: ${Object.keys(configs).length} configuration(s)`),
    );
  }

  private async promptConfirmation(): Promise<boolean> {
    return new Promise((resolve) => {
      this.rl.question(
        chalk.bold("\nDo you want to proceed? [y/N]: "),
        (answer) => {
          resolve(["y", "yes", "Y", "YES"].includes(answer.trim()));
        },
      );
    });
  }

  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return chalk.gray("null");
    }

    if (typeof value === "string") {
      // Check if it looks like a sensitive value
      const isSensitive = this.isSensitiveValue(value);
      if (isSensitive) {
        return chalk.gray("********");
      }
      return `"${value}"`;
    }

    if (typeof value === "boolean") {
      return value ? chalk.green("true") : chalk.red("false");
    }

    if (typeof value === "number") {
      return chalk.blue(value.toString());
    }

    if (Array.isArray(value)) {
      return `[${value.map((v) => this.formatValue(v)).join(", ")}]`;
    }

    if (typeof value === "object") {
      return JSON.stringify(value, null, 2);
    }

    return String(value);
  }

  private isSensitiveValue(value: string): boolean {
    // Check for API keys, tokens, passwords, etc.
    const sensitivePatterns = [
      /^sk-[a-zA-Z0-9]{40,}$/, // OpenAI API key
      /^[a-zA-Z0-9]{32,}$/, // Generic token/key
      /password|secret|token|key/i,
    ];

    return sensitivePatterns.some((pattern) => pattern.test(value));
  }

  private categorizeConfigs(
    configs: Record<string, any>,
  ): Record<string, Record<string, any>> {
    const categories: Record<string, Record<string, any>> = {
      "AI & Models": {},
      "User Interface": {},
      Development: {},
      Security: {},
      Project: {},
      Other: {},
    };

    for (const [key, value] of Object.entries(configs)) {
      const lowerKey = key.toLowerCase();

      if (
        lowerKey.includes("model") ||
        lowerKey.includes("temperature") ||
        lowerKey.includes("token")
      ) {
        categories["AI & Models"][key] = value;
      } else if (
        lowerKey.includes("theme") ||
        lowerKey.includes("color") ||
        lowerKey.includes("animation") ||
        lowerKey.includes("language")
      ) {
        categories["User Interface"][key] = value;
      } else if (
        lowerKey.includes("debug") ||
        lowerKey.includes("verbose") ||
        lowerKey.includes("log")
      ) {
        categories["Development"][key] = value;
      } else if (
        lowerKey.includes("key") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("auth") ||
        lowerKey.includes("token")
      ) {
        categories["Security"][key] = value;
      } else if (
        lowerKey.includes("project") ||
        lowerKey.includes("path") ||
        lowerKey.includes("save") ||
        lowerKey.includes("format")
      ) {
        categories["Project"][key] = value;
      } else {
        categories["Other"][key] = value;
      }
    }

    return categories;
  }

  private getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      "AI & Models": "🤖",
      "User Interface": "🎨",
      Development: "👨💻",
      Security: "🔐",
      Project: "📁",
      Other: "📋",
    };

    return icons[category] || "📋";
  }

  // Static convenience methods for common operations
  static async list(
    prefix?: string,
    options: ConfigCLIOptions = {},
  ): Promise<void> {
    const cli = new ConfigCLI();
    await cli.execute("list", prefix ? [prefix] : [], options);
  }

  static async get(key: string, options: ConfigCLIOptions = {}): Promise<void> {
    const cli = new ConfigCLI();
    await cli.execute("get", [key], options);
  }

  static async set(
    key: string,
    value: any,
    options: ConfigCLIOptions = {},
  ): Promise<void> {
    const cli = new ConfigCLI();
    await cli.execute("set", [key, value], options);
  }

  static async delete(
    key: string,
    options: ConfigCLIOptions = {},
  ): Promise<void> {
    const cli = new ConfigCLI();
    await cli.execute("delete", [key], options);
  }

  static async reset(
    key?: string,
    options: ConfigCLIOptions = {},
  ): Promise<void> {
    const cli = new ConfigCLI();
    await cli.execute("reset", key ? [key] : [], options);
  }

  static async template(
    templateId: string,
    variables?: Record<string, any>,
    options: ConfigCLIOptions = {},
  ): Promise<void> {
    const cli = new ConfigCLI();
    await cli.execute("template", [templateId, variables], options);
  }

  static async history(
    key?: string,
    limit?: number,
    options: ConfigCLIOptions = {},
  ): Promise<void> {
    const cli = new ConfigCLI();
    await cli.execute(
      "history",
      key ? [key, limit] : [limit].filter(Boolean),
      options,
    );
  }

  static async rollback(
    entryId: string,
    options: ConfigCLIOptions = {},
  ): Promise<void> {
    const cli = new ConfigCLI();
    await cli.execute("rollback", [entryId], options);
  }

  static async validate(
    key?: string,
    options: ConfigCLIOptions = {},
  ): Promise<void> {
    const cli = new ConfigCLI();
    await cli.execute("validate", key ? [key] : [], options);
  }
}
