/**
 * StreamingRenderer - Real-time streaming output for code generation
 * Provides smooth, throttled rendering with syntax highlighting
 */

import chalk from "chalk";

export interface UIPort {
  writeChunk(chunk: string): void;
  startCodeBlock?(language?: string): void;
  endCodeBlock?(): void;
  clear?(): void;
}

export interface CompletionChunk {
  choices: Array<{
    delta?: {
      content?: string;
    };
    finish_reason?: string;
  }>;
}

export interface StreamingMetrics {
  firstTokenMs: number;
  totalTokens: number;
  chunksReceived: number;
  throughputTokensPerSec: number;
}

/**
 * Handles real-time streaming output with throttling and syntax highlighting
 */
export class StreamingRenderer {
  private buffer = "";
  private lastRenderTime = 0;
  private readonly THROTTLE_MS = 8; // 120 FPS for ultra-fast streaming
  private codeBlockStarted = false;
  private language = "";
  private metrics: StreamingMetrics = {
    firstTokenMs: 0,
    totalTokens: 0,
    chunksReceived: 0,
    throughputTokensPerSec: 0,
  };
  private startTime = 0;
  private firstTokenTime = 0;

  constructor(private ui: UIPort) {}

  /**
   * Render a stream of completion chunks with throttling
   */
  async renderStream(
    stream: AsyncIterable<CompletionChunk>,
    signal?: AbortSignal,
  ): Promise<{ content: string; metrics: StreamingMetrics }> {
    this.startTime = Date.now();
    let fullContent = "";

    try {
      for await (const chunk of stream) {
        if (signal?.aborted) break;

        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          // Record first token time
          if (!this.firstTokenTime && content.length > 0) {
            this.firstTokenTime = Date.now();
            this.metrics.firstTokenMs = this.firstTokenTime - this.startTime;
          }

          fullContent += content;
          this.buffer += content;
          this.metrics.chunksReceived++;
          this.metrics.totalTokens += content.split(/\s+/).length;

          // Ultra-fast rendering with minimal throttling
          if (Date.now() - this.lastRenderTime > this.THROTTLE_MS || this.buffer.length > 10) {
            await this.flush();
          }
        }

        // Check if stream is complete
        if (chunk.choices[0]?.finish_reason) {
          break;
        }
      }

      // Final flush
      await this.flush();

      // Calculate throughput
      const elapsedSec = (Date.now() - this.startTime) / 1000;
      this.metrics.throughputTokensPerSec =
        this.metrics.totalTokens / elapsedSec;
    } catch (error) {
      // Ensure we flush any remaining buffer on error
      await this.flush();
      throw error;
    }

    return { content: fullContent, metrics: this.metrics };
  }

  /**
   * Flush buffered content to UI with formatting
   */
  private async flush(): Promise<void> {
    if (!this.buffer) return;

    // Process buffer for code blocks
    let currentBuffer = this.buffer;

    // Check for code block start
    if (!this.codeBlockStarted && currentBuffer.includes("```")) {
      this.codeBlockStarted = true;

      // Extract language identifier
      const langMatch = currentBuffer.match(/```(\w*)/);
      if (langMatch) {
        this.language = langMatch[1] || "";
      }

      // Notify UI about code block start
      if (this.ui.startCodeBlock) {
        this.ui.startCodeBlock(this.language);
      }

      // Remove the opening ``` from buffer
      const startIndex = currentBuffer.indexOf("```");
      const endOfLine = currentBuffer.indexOf("\n", startIndex);
      if (endOfLine !== -1) {
        currentBuffer =
          currentBuffer.substring(0, startIndex) +
          currentBuffer.substring(endOfLine + 1);
      } else {
        currentBuffer = currentBuffer.substring(0, startIndex);
      }
    }

    // Check for code block end
    if (this.codeBlockStarted) {
      const endIndex = currentBuffer.indexOf("```");
      if (endIndex !== -1) {
        // Extract content before the closing ```
        const beforeEnd = currentBuffer.substring(0, endIndex);
        const afterEnd = currentBuffer.substring(endIndex + 3);

        // Apply syntax highlighting to code content
        if (beforeEnd && this.language) {
          const highlighted = this.applySyntaxHighlight(
            beforeEnd,
            this.language,
          );
          this.ui.writeChunk(highlighted);
        } else if (beforeEnd) {
          this.ui.writeChunk(beforeEnd);
        }

        // End code block
        this.codeBlockStarted = false;
        if (this.ui.endCodeBlock) {
          this.ui.endCodeBlock();
        }

        // Process any remaining content after ```
        if (afterEnd) {
          this.ui.writeChunk(afterEnd);
        }

        this.buffer = "";
        this.lastRenderTime = Date.now();
        return;
      }
    }

    // Apply formatting based on context
    let formatted = currentBuffer;
    if (this.codeBlockStarted && this.language) {
      formatted = this.applySyntaxHighlight(currentBuffer, this.language);
    }

    // Write to UI
    if (formatted) {
      this.ui.writeChunk(formatted);
    }

    this.buffer = "";
    this.lastRenderTime = Date.now();
  }

  /**
   * Apply basic syntax highlighting for supported languages
   */
  private applySyntaxHighlight(code: string, language: string): string {
    // Skip if chalk is not available or not in TTY
    if (!process.stdout.isTTY) {
      return code;
    }

    try {
      switch (language.toLowerCase()) {
        case "javascript":
        case "typescript":
        case "jsx":
        case "tsx":
          return this.highlightJavaScript(code);

        case "python":
          return this.highlightPython(code);

        case "html":
        case "xml":
          return this.highlightHTML(code);

        case "css":
        case "scss":
        case "sass":
          return this.highlightCSS(code);

        case "json":
          return this.highlightJSON(code);

        default:
          return code;
      }
    } catch (error) {
      // If highlighting fails, return unhighlighted code
      return code;
    }
  }

  private highlightJavaScript(code: string): string {
    return (
      code
        // Keywords
        .replace(
          /\b(const|let|var|function|class|interface|type|enum|namespace)\b/g,
          chalk.blue("$1"),
        )
        .replace(
          /\b(async|await|return|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw)\b/g,
          chalk.magenta("$1"),
        )
        .replace(/\b(import|export|from|as|default)\b/g, chalk.cyan("$1"))
        .replace(
          /\b(new|this|super|extends|implements|static|public|private|protected)\b/g,
          chalk.keyword("$1"),
        )
        // Primitives
        .replace(
          /\b(true|false|null|undefined|NaN|Infinity)\b/g,
          chalk.yellow("$1"),
        )
        // Numbers
        .replace(/\b(\d+\.?\d*)\b/g, chalk.yellow("$1"))
        // Strings (basic, doesn't handle escapes perfectly)
        .replace(/(['"`])([^'"`]*)\1/g, chalk.green("$1$2$1"))
        // Comments
        .replace(/\/\/.*$/gm, chalk.gray("$&"))
        .replace(/\/\*[\s\S]*?\*\//g, chalk.gray("$&"))
    );
  }

  private highlightPython(code: string): string {
    return (
      code
        // Keywords
        .replace(
          /\b(def|class|if|elif|else|for|while|try|except|finally|with|as|return|yield|lambda)\b/g,
          chalk.blue("$1"),
        )
        .replace(/\b(import|from|as)\b/g, chalk.cyan("$1"))
        .replace(/\b(and|or|not|in|is)\b/g, chalk.magenta("$1"))
        // Built-ins
        .replace(/\b(True|False|None)\b/g, chalk.yellow("$1"))
        // Numbers
        .replace(/\b(\d+\.?\d*)\b/g, chalk.yellow("$1"))
        // Strings
        .replace(/(['"])([^'"]*)\1/g, chalk.green("$1$2$1"))
        // Comments
        .replace(/#.*$/gm, chalk.gray("$&"))
    );
  }

  private highlightHTML(code: string): string {
    return (
      code
        // Tags
        .replace(/<(\/?)([\w-]+)([^>]*)>/g, (match, slash, tag, attrs) => {
          const coloredTag = chalk.blue(`<${slash}${tag}`);
          const coloredAttrs = attrs.replace(/(\w+)=/g, chalk.cyan("$1="));
          return `${coloredTag}${coloredAttrs}${chalk.blue(">")}`;
        })
        // Strings in attributes
        .replace(/=["']([^"']*?)["']/g, `=${chalk.green('"$1"')}`)
        // Comments
        .replace(/<!--[\s\S]*?-->/g, chalk.gray("$&"))
    );
  }

  private highlightCSS(code: string): string {
    return (
      code
        // Selectors
        .replace(/^([^{]+){/gm, chalk.cyan("$1") + "{")
        // Properties
        .replace(/(\w+-?\w*)\s*:/g, chalk.blue("$1:"))
        // Values
        .replace(/:\s*([^;]+);/g, ": " + chalk.green("$1") + ";")
        // Comments
        .replace(/\/\*[\s\S]*?\*\//g, chalk.gray("$&"))
    );
  }

  private highlightJSON(code: string): string {
    return (
      code
        // Keys
        .replace(/"([^"]+)":/g, chalk.blue('"$1":'))
        // String values
        .replace(/:\s*"([^"]*)"/g, ": " + chalk.green('"$1"'))
        // Numbers
        .replace(/:\s*(\d+\.?\d*)/g, ": " + chalk.yellow("$1"))
        // Booleans and null
        .replace(/:\s*(true|false|null)/g, ": " + chalk.yellow("$1"))
    );
  }

  /**
   * Get streaming metrics
   */
  getMetrics(): StreamingMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset renderer state
   */
  reset(): void {
    this.buffer = "";
    this.codeBlockStarted = false;
    this.language = "";
    this.metrics = {
      firstTokenMs: 0,
      totalTokens: 0,
      chunksReceived: 0,
      throughputTokensPerSec: 0,
    };
    this.startTime = 0;
    this.firstTokenTime = 0;
    this.lastRenderTime = 0;
  }
}
