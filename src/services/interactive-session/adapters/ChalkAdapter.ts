// src/services/interactive-session/adapters/ChalkAdapter.ts
// Chalk implementation of IDisplayPort with spinner management

import chalk from "chalk";
import ora, { Ora } from "ora";
import { IDisplayPort } from "../ports/IDisplayPort";

export class ChalkAdapter implements IDisplayPort {
  private spinners: Map<string, Ora> = new Map();
  private spinnerId = 0;

  async showWelcome(): Promise<void> {
    console.log(
      chalk.cyan.bold("\n🤖 Welcome to MARIA Interactive Session v3.5.0"),
    );
    console.log(chalk.gray("Type /help for available commands\n"));
  }

  showGoodbye(): void {
    // Stop all spinners before exiting
    this.stopAllSpinners();
    console.log(chalk.yellow("\n👋 Goodbye! Thank you for using MARIA.\n"));
  }

  async print(message: string): Promise<void> {
    console.log(message);
  }

  error(message: string): void {
    console.error(chalk.red(`❌ ${message}`));
  }

  success(message: string): void {
    console.log(chalk.green(`✅ ${message}`));
  }

  warning(message: string): void {
    console.warn(chalk.yellow(`⚠️  ${message}`));
  }

  info(message: string): void {
    console.info(chalk.blue(`ℹ️  ${message}`));
  }

  startSpinner(message?: string): string {
    const id = `spinner-${++this.spinnerId}`;
    const spinner = ora({
      text: message || "Processing...",
      spinner: "dots",
    }).start();

    this.spinners.set(id, spinner);

    // Safety: Auto-stop after 30 seconds
    setTimeout(() => {
      if (this.spinners.has(id)) {
        this.stopSpinner(id);
      }
    }, 30000);

    return id;
  }

  stopSpinner(spinnerId: string): void {
    const spinner = this.spinners.get(spinnerId);
    if (spinner) {
      spinner.stop();
      this.spinners.delete(spinnerId);
    }
  }

  stopAllSpinners(): void {
    for (const [id, spinner] of this.spinners.entries()) {
      spinner.stop();
    }
    this.spinners.clear();
  }

  clear(): void {
    // Clear terminal
    console.clear();
  }

  async stream(
    content: AsyncIterable<string>,
    signal?: AbortSignal,
  ): Promise<void> {
    try {
      for await (const chunk of content) {
        if (signal?.aborted) break;
        process.stdout.write(chunk);
      }
    } catch (error) {
      if (!signal?.aborted) {
        throw error;
      }
    } finally {
      // Ensure newline at end
      process.stdout.write("\n");
    }
  }

  /**
   * Format helpers for consistent styling
   */
  static format = {
    command: (text: string) => chalk.cyan(text),
    keyword: (text: string) => chalk.magenta(text),
    value: (text: string) => chalk.green(text),
    dim: (text: string) => chalk.gray(text),
    bold: (text: string) => chalk.bold(text),
    code: (text: string) => chalk.bgGray.white(` ${text} `),
  };
}
