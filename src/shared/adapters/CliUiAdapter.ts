/**
 * CliUiAdapter
 * Wraps the existing UI utilities to conform to UiPort interface
 */

import type {
  UiPort,
  UiMessage,
  UiPrompt,
  UiProgress,
  UiTable,
  UiChart,
} from "../types/context";

export class CliUiAdapter implements UiPort {
  private progressBars: Map<string, any> = new Map();
  private abortHandlers: Map<string, () => void> = new Map();

  constructor(private ui: any) {}

  /**
   * Display a message to the user
   */
  async display(
    message: UiMessage,
    opts?: { signal?: AbortSignal },
  ): Promise<void> {
    // Check for abort signal
    if (opts?.signal?.aborted) {
      throw new Error("AbortError");
    }

    try {
      // Map type to appropriate UI method
      switch (message.type) {
        case "info":
          if (this.ui?.info) {
            await this.ui.info(message.text);
          } else {
            console.log(`ℹ️  ${message.text}`);
          }
          break;

        case "success":
          if (this.ui?.success) {
            await this.ui.success(message.text);
          } else {
            console.log(`✅ ${message.text}`);
          }
          break;

        case "warning":
          if (this.ui?.warn || this.ui?.warning) {
            await (this.ui.warn || this.ui.warning)(message.text);
          } else {
            console.log(`⚠️  ${message.text}`);
          }
          break;

        case "error":
          if (this.ui?.error) {
            await this.ui.error(message.text);
          } else {
            console.error(`❌ ${message.text}`);
          }
          break;

        default:
          console.log(message.text);
      }

      // Check again after async operation
      if (opts?.signal?.aborted) {
        throw new Error("AbortError");
      }
    } catch (error: any) {
      if (error.message === "AbortError") throw error;
      // Fallback to console
      console.log(message.text);
    }
  }

  /**
   * Prompt the user for input
   */
  async prompt(
    prompt: UiPrompt,
    opts?: { signal?: AbortSignal },
  ): Promise<string> {
    // Check for abort signal
    if (opts?.signal?.aborted) {
      throw new Error("AbortError");
    }

    try {
      // Set up abort handler if signal provided
      if (opts?.signal) {
        const handler = () => {
          if (this.ui?.cancelPrompt) {
            this.ui.cancelPrompt();
          }
        };
        opts.signal.addEventListener("abort", handler);
        this.abortHandlers.set(prompt.message, handler);
      }

      let result: string;

      // Use appropriate prompt method based on type
      switch (prompt.type) {
        case "text":
          if (this.ui?.prompt) {
            result = await this.ui.prompt(prompt.message, prompt.defaultValue);
          } else {
            // Fallback implementation
            result = prompt.defaultValue || "";
          }
          break;

        case "password":
          if (this.ui?.promptPassword) {
            result = await this.ui.promptPassword(prompt.message);
          } else {
            // Security: don't echo password
            result = "";
          }
          break;

        case "confirm":
          if (this.ui?.confirm) {
            const confirmed = await this.ui.confirm(prompt.message);
            result = confirmed ? "yes" : "no";
          } else {
            result = prompt.defaultValue || "no";
          }
          break;

        case "select":
          if (this.ui?.select && prompt.choices) {
            result = await this.ui.select(prompt.message, prompt.choices);
          } else {
            result = prompt.defaultValue || prompt.choices?.[0] || "";
          }
          break;

        default:
          result = prompt.defaultValue || "";
      }

      // Clean up abort handler
      if (opts?.signal) {
        const handler = this.abortHandlers.get(prompt.message);
        if (handler) {
          opts.signal.removeEventListener("abort", handler);
          this.abortHandlers.delete(prompt.message);
        }
      }

      // Check for abort after completion
      if (opts?.signal?.aborted) {
        throw new Error("AbortError");
      }

      return result;
    } catch (error: any) {
      // Clean up on error
      this.abortHandlers.delete(prompt.message);

      if (error.message === "AbortError") throw error;
      throw new Error(`Prompt failed: ${error.message || "Unknown error"}`);
    }
  }

  /**
   * Show a progress indicator
   */
  async progress(
    progress: UiProgress,
    opts?: { signal?: AbortSignal },
  ): Promise<void> {
    // Check for abort signal
    if (opts?.signal?.aborted) {
      throw new Error("AbortError");
    }

    try {
      // Create or update progress bar
      if (progress.current === 0 || !this.progressBars.has(progress.id)) {
        // Start new progress
        if (this.ui?.startProgress) {
          const bar = await this.ui.startProgress(
            progress.label,
            progress.total,
          );
          this.progressBars.set(progress.id, bar);
        } else {
          // Fallback to console
          console.log(
            `${progress.label}: ${progress.current}/${progress.total}`,
          );
        }
      } else if (progress.current >= progress.total) {
        // Complete progress
        const bar = this.progressBars.get(progress.id);
        if (bar?.complete) {
          await bar.complete();
        }
        this.progressBars.delete(progress.id);
      } else {
        // Update progress
        const bar = this.progressBars.get(progress.id);
        if (bar?.update) {
          await bar.update(progress.current);
        } else {
          // Fallback to console
          const percent = Math.round((progress.current / progress.total) * 100);
          console.log(`${progress.label}: ${percent}%`);
        }
      }

      // Check again after async operation
      if (opts?.signal?.aborted) {
        // Clean up progress bar
        const bar = this.progressBars.get(progress.id);
        if (bar?.cancel) {
          bar.cancel();
        }
        this.progressBars.delete(progress.id);
        throw new Error("AbortError");
      }
    } catch (error: any) {
      if (error.message === "AbortError") throw error;
      // Continue silently on progress errors
    }
  }

  /**
   * Clear the display
   */
  async clear(opts?: { signal?: AbortSignal }): Promise<void> {
    // Check for abort signal
    if (opts?.signal?.aborted) {
      throw new Error("AbortError");
    }

    try {
      if (this.ui?.clear) {
        await this.ui.clear();
      } else {
        // ANSI clear screen
        process.stdout.write("\x1b[2J\x1b[H");
      }

      // Check again after async operation
      if (opts?.signal?.aborted) {
        throw new Error("AbortError");
      }
    } catch (error: any) {
      if (error.message === "AbortError") throw error;
      // Continue silently on clear errors
    }
  }

  /**
   * Display a table (extension)
   */
  async table(table: UiTable, opts?: { signal?: AbortSignal }): Promise<void> {
    // Check for abort signal
    if (opts?.signal?.aborted) {
      throw new Error("AbortError");
    }

    try {
      if (this.ui?.table) {
        await this.ui.table(table.headers, table.rows);
      } else {
        // Simple console table
        console.table(
          table.rows.map((row) => {
            const obj: any = {};
            table.headers.forEach((header, i) => {
              obj[header] = row[i];
            });
            return obj;
          }),
        );
      }

      // Check again after async operation
      if (opts?.signal?.aborted) {
        throw new Error("AbortError");
      }
    } catch (error: any) {
      if (error.message === "AbortError") throw error;
      // Fallback to simple display
      console.log(table.headers.join(" | "));
      console.log("-".repeat(40));
      table.rows.forEach((row) => console.log(row.join(" | ")));
    }
  }

  /**
   * Display a chart (extension)
   */
  async chart(chart: UiChart, opts?: { signal?: AbortSignal }): Promise<void> {
    // Check for abort signal
    if (opts?.signal?.aborted) {
      throw new Error("AbortError");
    }

    try {
      if (this.ui?.chart) {
        await this.ui.chart(chart);
      } else {
        // Simple ASCII bar chart
        console.log(`\n${chart.title || "Chart"}\n${"=".repeat(40)}`);

        const maxValue = Math.max(...chart.data.map((d) => d.value));
        const scale = 30 / maxValue;

        chart.data.forEach((item) => {
          const barLength = Math.round(item.value * scale);
          const bar = "█".repeat(barLength);
          const padding = " ".repeat(15 - item.label.length);
          console.log(`${item.label}${padding} | ${bar} ${item.value}`);
        });
      }

      // Check again after async operation
      if (opts?.signal?.aborted) {
        throw new Error("AbortError");
      }
    } catch (error: any) {
      if (error.message === "AbortError") throw error;
      // Fallback to simple list
      console.log(chart.title || "Data:");
      chart.data.forEach((item) =>
        console.log(`- ${item.label}: ${item.value}`),
      );
    }
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    // Clear all progress bars
    for (const [id, bar] of this.progressBars) {
      if (bar?.cancel) {
        bar.cancel();
      }
    }
    this.progressBars.clear();

    // Clear all abort handlers
    this.abortHandlers.clear();
  }
}
