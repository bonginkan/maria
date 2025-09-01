// src/services/interactive-session/adapters/ReadlineAdapter.ts
// Readline implementation of IInputPort with InputController safety

import * as readline from "node:readline";
import { stdin as input, stdout as output } from "node:process";
import { IInputPort } from "../ports/IInputPort";
import { InputController } from "../input/InputController";

export class ReadlineAdapter implements IInputPort {
  private rl: readline.Interface;
  private inputController: InputController;

  constructor() {
    this.rl = readline.createInterface({
      input,
      output,
      terminal: true,
    });

    this.inputController = new InputController(this.rl, {
      debounceMs: 250,
      escCancels: true,
    });
  }

  async readline(signal?: AbortSignal): Promise<string | null> {
    if (signal?.aborted) return null;

    return new Promise<string | null>((resolve) => {
      // Handle abort signal
      const abortHandler = () => resolve(null);
      signal?.addEventListener("abort", abortHandler, { once: true });

      // Use InputController for safe input handling
      this.inputController
        .readline()
        .then(resolve)
        .catch(() => resolve(null))
        .finally(() => {
          signal?.removeEventListener("abort", abortHandler);
        });
    });
  }

  async prompt(message: string, signal?: AbortSignal): Promise<string | null> {
    if (signal?.aborted) return null;

    // Display prompt message
    output.write(message);

    // Get input
    return this.readline(signal);
  }

  async confirm(
    message: string,
    signal?: AbortSignal,
  ): Promise<boolean | null> {
    if (signal?.aborted) return null;

    const response = await this.prompt(`${message} (y/n): `, signal);
    if (response === null) return null;

    const normalized = response.toLowerCase().trim();
    return normalized === "y" || normalized === "yes";
  }

  /**
   * Clean up resources
   */
  close(): void {
    this.rl.close();
  }
}
