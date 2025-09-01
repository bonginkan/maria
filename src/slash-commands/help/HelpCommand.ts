/**
 * Help Command v2.1 - Progressive Disclosure System
 * Implements compact/category/search/full/interactive modes with metadata-driven rendering
 */

import { BaseCommand } from "../base-command";
import { CommandArgs, CommandContext, CommandResult } from "../types";
import { MetadataManager } from "./metadata-manager";
import { renderCompactHelp } from "./renderers/compact-renderer";
import {
  renderCategoryHelp,
  renderSearchHelp,
} from "./renderers/detail-renderer";
import { renderFullHelp } from "./renderers/full-renderer";
import { runInteractiveHelp } from "./interactive-help";

interface HelpFlags {
  category?: string; // /help <category>
  search?: string; // --search <kw>
  all?: boolean; // --all
  advanced?: boolean; // --advanced
  aliases?: boolean; // --aliases
  interactive?: boolean; // --interactive
  json?: boolean; // --json
  matchMode?: "any" | "all"; // --match all|any
}

export class HelpCommandV2 extends BaseCommand {
  name = "help";
  category = "core" as const;
  description =
    "Show help information and command list with progressive disclosure";
  aliases = ["h", "?"];
  usage =
    "[<category>] [--search <kw>] [--all] [--advanced] [--interactive] [--json]";

  examples = [
    { input: "/help", description: "Compact view (Top 3 per category)" },
    { input: "/help business", description: "Category expansion" },
    { input: "/help --search sow", description: "Search across categories" },
    { input: "/help --all", description: "Full listing" },
    {
      input: "/help --interactive",
      description: "TUI mode with arrow navigation",
    },
    { input: "/help --json", description: "JSON output for automation" },
  ];

  private metadataManager = new MetadataManager();

  async execute(
    args: CommandArgs,
    _context: CommandContext,
  ): Promise<CommandResult> {
    const flags = this.parseFlags(args);

    try {
      // Load and validate metadata
      const container = await this.metadataManager.load();
      const metas = container.commands;

      // ─────────────────────────────────────────────────────────────
      // 非TTY(パイプ/リダイレクト等)の場合は JSON を返す
      //   例:  maria /help | jq .
      // ─────────────────────────────────────────────────────────────
      const isTTY = !!(process.stdout.isTTY && process.stdin.isTTY);
      if ((!isTTY || flags.json) && !flags.interactive) {
        const payload = this.metadataManager.buildCompactJson(metas);
        return this.success(JSON.stringify(payload, null, 2));
      }

      // Interactive mode (highest priority)
      if (flags.interactive) {
        try {
          await runInteractiveHelp({
            showAdvancedDefault: flags.advanced,
          });
          return this.success(""); // Interactive mode handles its own output
        } catch (error: any) {
          if (error.message?.includes("TTY")) {
            return this.error(
              "Interactive mode requires a TTY terminal",
              "HELP_NO_TTY",
            );
          }
          return this.error(
            "Interactive help failed",
            "HELP_INTERACTIVE_ERROR",
            error?.message,
          );
        }
      }

      // Render based on flags (priority order)
      let output = "";

      if (flags.search) {
        // Search mode
        output = renderSearchHelp(metas, flags.search, {
          advanced: flags.advanced,
          showAliases: flags.aliases,
          matchMode: flags.matchMode || "any",
        });
      } else if (flags.category) {
        // Category mode
        output = renderCategoryHelp(metas, flags.category, {
          advanced: flags.advanced,
          showAliases: flags.aliases,
        });
      } else if (flags.all) {
        // Full listing mode
        output = renderFullHelp(metas, {
          advanced: flags.advanced,
          showAliases: flags.aliases,
          heading: "📖 MARIA Commands — Full Listing",
        });
      } else {
        // Default: Compact mode
        output = renderCompactHelp(metas, {
          maxPrimaryPerCategory: 3,
          showAdvanced: flags.advanced,
          twoColumnThreshold: 100,
          heading: "📖 MARIA Commands (compact • primary only)",
        });
      }

      return this.success(output);
    } catch (error: any) {
      return this.handleError(error);
    }
  }

  private parseFlags(args: CommandArgs): HelpFlags {
    const { parsed, options, flags } = args;
    const positional = (parsed?.positional as string[]) || [];

    // First positional argument might be a category
    const category =
      positional[0] && !positional[0].startsWith("-")
        ? positional[0]
        : undefined;

    return {
      category,
      search: this.getStringOption(options, "search"),
      all: this.getBoolFlag(options, flags, "all"),
      advanced: this.getBoolFlag(options, flags, "advanced"),
      aliases: this.getBoolFlag(options, flags, "aliases"),
      interactive: this.getBoolFlag(options, flags, "interactive"),
      json: this.getBoolFlag(options, flags, "json"),
      matchMode:
        (this.getStringOption(options, "match") as "any" | "all") || "any",
    };
  }

  private getBoolFlag(options: any, flags: any, key: string): boolean {
    // Check both options and flags
    const optValue = options?.[key];
    const flagValue = flags?.[key];

    if (typeof optValue === "boolean") return optValue;
    if (typeof flagValue === "boolean") return flagValue;
    if (typeof optValue === "string")
      return optValue === "true" || optValue === "";
    if (typeof flagValue === "string")
      return flagValue === "true" || flagValue === "";

    return !!optValue || !!flagValue;
  }

  private getStringOption(options: any, key: string): string | undefined {
    const value = options?.[key];
    return typeof value === "string" ? value : undefined;
  }

  private handleError(error: any): CommandResult {
    console.error("[help] Command failed:", error);

    // Try stale cache fallback
    if (this.metadataManager.hasStaleCache()) {
      console.warn("[help] Using stale cache as fallback");
      try {
        const staleContainer = this.metadataManager.getStaleCache();
        if (staleContainer) {
          const output = renderCompactHelp(staleContainer.commands, {
            heading: "📖 MARIA Commands (using cached data - may be outdated)",
          });
          return this.success(
            output +
              "\n\n⚠️  Using stale cache. Run: npx tsx scripts/generate-help-meta.ts",
          );
        }
      } catch (fallbackError) {
        console.error("[help] Stale cache fallback failed:", fallbackError);
      }
    }

    // Final fallback - minimal help
    const fallbackHelp = [
      "📖 MARIA Commands",
      "",
      "Help metadata unavailable.",
      `Reason: ${error?.message || error}`,
      "",
      "Try:",
      "  • npx tsx scripts/generate-help-meta.ts",
      "  • Check that command-meta.json exists and is valid",
      "",
      "For immediate help, use individual command --help flags.",
      "",
    ].join("\n");

    return this.success(fallbackHelp);
  }

  override async validate(
    args: CommandArgs,
  ): Promise<{ success: boolean; error?: string }> {
    const flags = this.parseFlags(args);

    // Validate search term
    if (
      flags.search !== undefined &&
      (flags.search === "" || flags.search.length < 2)
    ) {
      return {
        success: false,
        error: "Search term must be at least 2 characters long",
      };
    }

    // Validate match mode
    if (flags.matchMode && !["any", "all"].includes(flags.matchMode)) {
      return {
        success: false,
        error: 'Match mode must be either "any" or "all"',
      };
    }

    // Interactive mode validation
    if (flags.interactive && !process.stdout.isTTY) {
      return {
        success: false,
        error: "Interactive mode requires a TTY terminal",
      };
    }

    return { success: true };
  }
}
