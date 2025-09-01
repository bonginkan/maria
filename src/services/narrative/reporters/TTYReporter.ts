/**
 * TTY Reporter - Beautiful terminal output
 */

import chalk from "chalk";
import ora from "ora";
import type { NarrativeReporter, Phase, LogLevel } from "../types.js";
import { Masker } from "../security/Masker.js";
import { AdaptiveCompact } from "../utils/AdaptiveCompact.js";

export class TTYReporter implements NarrativeReporter {
  private readonly masker: Masker;
  private readonly compactManager: AdaptiveCompact;
  private readonly isTTY: boolean;
  private readonly verbose: boolean;
  private currentSpinner?: ReturnType<typeof ora>;
  private lastCompactReason?: string;

  constructor(
    isTTY: boolean = process.stdout.isTTY && !process.env.CI,
    redact: boolean = true,
    verbose: boolean = false,
    compactThreshold?: number,
  ) {
    this.isTTY = isTTY;
    this.masker = new Masker(redact);
    this.compactManager = new AdaptiveCompact(compactThreshold);
    this.verbose = verbose;
  }

  private stopSpinner(): void {
    if (this.currentSpinner) {
      this.currentSpinner.stop();
      this.currentSpinner = undefined;
    }
  }

  private formatIndent(text: string, level: number = 2): string {
    const indent = " ".repeat(level);
    return text
      .split("\n")
      .map((line) => indent + line)
      .join("\n");
  }

  thinking(text: string): void {
    this.stopSpinner();

    if (this.isTTY) {
      console.log(chalk.cyan("✻ Thinking…\n"));
      console.log(this.formatIndent(this.masker.mask(text)));
      console.log();
    } else {
      console.log("Thinking...");
      console.log(this.formatIndent(this.masker.mask(text)));
    }
  }

  step(title: string, details?: string, _phase?: Phase): void {
    this.stopSpinner();

    // Check if we should compact
    if (!this.verbose && this.compactManager.shouldCompact()) {
      const stats = this.compactManager.getStats();
      this.compactManager.recordOmitted(stats.eventCount);
      this.lastCompactReason = "too many events";
      return;
    }

    if (this.isTTY) {
      console.log("\n" + chalk.white("⏺ ") + chalk.bold(title));

      if (details) {
        // Start a spinner for ongoing work
        this.currentSpinner = ora({
          text: chalk.gray(details),
          prefixText: "  ",
          spinner: "dots",
        }).start();
      }
    } else {
      console.log("\n> " + title);
      if (details) {
        console.log("  " + details);
      }
    }
  }

  write(target: string, bytes?: number): void {
    this.stopSpinner();

    if (!this.verbose && this.compactManager.shouldCompact()) {
      return;
    }

    const bytesStr = bytes ? ` ${bytes.toLocaleString()} bytes` : "";

    if (this.isTTY) {
      console.log(`  ⎿ ${chalk.green("Write")}(${target})${bytesStr}`);
    } else {
      console.log(`  - Write(${target})${bytesStr}`);
    }
  }

  bash(cmd: string, exitCode?: number): void {
    this.stopSpinner();

    if (!this.verbose && this.compactManager.shouldCompact()) {
      return;
    }

    const maskedCmd = this.masker.maskCommand(cmd);
    const statusIcon = exitCode === 0 ? " ✓" : exitCode ? " ✗" : "";

    if (this.isTTY) {
      console.log(
        `  ⎿ ${chalk.yellow("Bash")}(${maskedCmd})${chalk.green(statusIcon)}`,
      );
    } else {
      console.log(`  - Bash(${maskedCmd})${statusIcon}`);
    }
  }

  search(pattern: string, where?: string, hits?: number): void {
    this.stopSpinner();

    if (!this.verbose && this.compactManager.shouldCompact()) {
      return;
    }

    const whereStr = where ? `, path: "${where}"` : "";
    const hitsStr = hits !== undefined ? `, hits: ${hits}` : "";

    if (this.isTTY) {
      console.log(
        `  ⎿ ${chalk.magenta("Search")}(pattern: "${pattern}"${whereStr}${hitsStr})`,
      );
    } else {
      console.log(`  - Search(pattern: "${pattern}"${whereStr}${hitsStr})`);
    }
  }

  read(file: string, lines?: number, truncated?: boolean): void {
    this.stopSpinner();

    if (!this.verbose && this.compactManager.shouldCompact()) {
      return;
    }

    // Check if file should be redacted
    if (this.masker.isFileRedacted(file)) {
      if (this.isTTY) {
        console.log(
          `  ⎿ ${chalk.blue("Read")}(${chalk.red("[REDACTED - sensitive file]")})`,
        );
      } else {
        console.log(`  - Read([REDACTED - sensitive file: ${file}])`);
      }
      return;
    }

    const linesStr = lines ? ` ${lines} lines` : "";
    const truncatedStr = truncated ? " (truncated)" : "";

    if (this.isTTY) {
      console.log(
        `  ⎿ ${chalk.blue("Read")}(${file})${linesStr}${truncatedStr}`,
      );
    } else {
      console.log(`  - Read(${file})${linesStr}${truncatedStr}`);
    }
  }

  update(message: string, level: LogLevel = "info"): void {
    this.stopSpinner();

    const maskedMessage = this.masker.mask(message);

    if (this.isTTY) {
      let coloredMessage = maskedMessage;

      switch (level) {
        case "warn":
          coloredMessage = chalk.yellow(maskedMessage);
          break;
        case "error":
          coloredMessage = chalk.red(maskedMessage);
          break;
        case "debug":
          if (!this.verbose) return; // Skip debug in non-verbose mode
          coloredMessage = chalk.gray(maskedMessage);
          break;
      }

      console.log(`  ⎿ ${coloredMessage}`);
    } else {
      const prefix =
        level === "error" ? "[ERROR] " : level === "warn" ? "[WARN] " : "";
      console.log(`  - ${prefix}${maskedMessage}`);
    }
  }

  compact(reason?: string, omitted?: number): void {
    this.stopSpinner();

    // Show compact message if we've been compacting
    if (this.lastCompactReason || reason) {
      const compactReason =
        reason || this.lastCompactReason || "too many events";
      const omittedCount =
        omitted || this.compactManager.getState().totalOmitted;

      if (this.isTTY) {
        console.log(
          chalk.gray(
            `\n✢ Compacting conversation... (${omittedCount}+ events omitted: ${compactReason})`,
          ),
        );
        console.log(chalk.gray("  Press ctrl+r to expand"));
      } else {
        console.log(
          `\n... ${omittedCount}+ events omitted (${compactReason}) ...`,
        );
      }

      // Reset compact state after showing message
      this.compactManager.reset();
      this.lastCompactReason = undefined;
    }
  }

  summary(stats: Record<string, unknown>): void {
    this.stopSpinner();

    if (this.isTTY) {
      console.log("\n" + chalk.green("✅ Summary"));

      Object.entries(stats).forEach(([key, value]) => {
        const formattedKey = key.replace(/([A-Z])/g, " $1").trim();
        const formattedValue =
          typeof value === "number" ? value.toLocaleString() : String(value);

        console.log(`  • ${formattedKey}: ${chalk.bold(formattedValue)}`);
      });
    } else {
      console.log("\n=== Summary ===");

      Object.entries(stats).forEach(([key, value]) => {
        const formattedKey = key.replace(/([A-Z])/g, " $1").trim();
        console.log(`  * ${formattedKey}: ${value}`);
      });
    }

    console.log();
  }
}
