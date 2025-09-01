/**
 * Input Manager - Unified I/O handling for interactive session
 * Replaces raw keypress handling with readline-based approach
 */

import * as readline from "readline";
import chalk from "chalk";

export interface InputOptions {
  allowEmpty?: boolean;
  cancelable?: boolean;
  placeholder?: string;
}

export class InputManager {
  private rl: readline.Interface;
  private isActive = false;

  constructor(_rl: readline.Interface) {
    this._rl = _rl;
  }

  /**
   * Unified input _prompt using readline
   * Replaces the previous raw keypress approach
   */
  async promptForInput(
    label: string,
    options: InputOptions = {},
  ): Promise<string | null> {
    if (!this.isActive) return null;

    return new Promise((resolve) => {
      const _prompt = chalk.cyan(label);
      let resolved = false;

      // Ctrl+C handling
      const _onSigint = () => {
        if (!resolved && options.cancelable) {
          resolved = true;
          this.cleanupPrompt();
          resolve(null);
        }
      };

      // Setup SIGINT listener
      this.rl.once("SIGINT", _onSigint);

      // Setup question
      this.rl.question(_prompt, (answer) => {
        if (resolved) return; // Already resolved via SIGINT

        resolved = true;
        this.rl.removeListener("SIGINT", _onSigint);

        const _result = answer.trim();

        if (!_result && !options.allowEmpty) {
          resolve(null);
        } else {
          resolve(_result || "");
        }
      });
    });
  }

  /**
   * Simple question _prompt for interactive commands
   */
  async question(_prompt: string): Promise<string> {
    if (!this.isActive) return "";

    return new Promise((resolve) => {
      this.rl.question(_prompt, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  /**
   * Clean up current _prompt display
   */
  private cleanupPrompt(): void {
    process.stdout.write("\r\u001b[K"); // Clear current line
  }

  /**
   * Activate input manager
   */
  activate(): void {
    this.isActive = true;
  }

  /**
   * Deactivate input manager
   */
  deactivate(): void {
    this.isActive = false;
  }

  /**
   * Check if input manager is active
   */
  get active(): boolean {
    return this.isActive;
  }

  /**
   * Get the underlying readline interface
   */
  getReadlineInterface(): readline.Interface {
    return this.rl;
  }
}
