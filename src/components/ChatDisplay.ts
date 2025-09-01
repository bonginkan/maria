import chalk from "chalk";
import { highlight } from "cli-highlight";
import ora from "ora";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

interface StepInfo {
  number: number;
  title: string;
  content: string;
  status: "pending" | "in-progress" | "completed" | "error";
}

interface Spinner {
  stop(): void;
}

export class ChatDisplay {
  private messages: Message[] = [];
  private currentSpinner: Spinner | null = null;

  constructor() {
    // Constructor implementation
  }

  // Display user input in a bordered box with enhanced detection
  displayUserInput(_input: string) {
    const _lines = _input.split("\n");
    const _maxLength = Math.max(..._lines.map((l) => l.length), 40);
    const _boxWidth = Math.min(_maxLength + 4, process.stdout.columns - 2);

    // Detect special content types
    const _hasImages = /\.(jpg|jpeg|png|gif|bmp|webp|svg)/i.test(_input);
    const _hasUrls = /https?:\/\/[^\s]+/i.test(_input);
    const _hasPastedContent =
      /\[Pasted\s+(?:text|image|content)\s*#?\d*\s*\+?\d*\s*_lines?\]/i.test(
        input,
      );

    // Enhanced border with content indicators
    let borderChar = "-";
    let borderColor = chalk.gray;

    if (_hasImages) {
      borderColor = chalk.cyan;
      borderChar = "=";
    } else if (_hasUrls) {
      borderColor = chalk.blue;
      borderChar = "~";
    } else if (_hasPastedContent) {
      borderColor = chalk.yellow;
      borderChar = "*";
    }

    console.log(`\n${borderColor(`+${borderChar.repeat(_boxWidth - 2)}+`)}`);

    // Add content type indicator
    if (_hasImages || _hasUrls || _hasPastedContent) {
      let indicator = "";
      if (_hasImages) {
        indicator += "🖼️  IMAGE ";
      }
      if (_hasUrls) {
        indicator += "🔗 URL ";
      }
      if (_hasPastedContent) {
        indicator += "📋 PASTE ";
      }

      const _indicatorPadding = _boxWidth - indicator.length - 4;
      console.log(
        borderColor("| ") +
          chalk.white.bold(indicator) +
          " ".repeat(Math.max(0, _indicatorPadding)) +
          borderColor(" |"),
      );
      console.log(borderColor(`|${borderChar.repeat(_boxWidth - 2)}|`));
    }

    lines.forEach((line) => {
      const _padding = _boxWidth - line.length - 4;
      console.log(
        borderColor("| ") +
          chalk.white(line) +
          " ".repeat(Math.max(0, _padding)) +
          borderColor(" |"),
      );
    });
    console.log(borderColor(`+${borderChar.repeat(_boxWidth - 2)}+`));

    this.messages.push({
      role: "user",
      content: _input,
      timestamp: new Date(),
    });
  }

  // Display AI response without border with enhanced formatting
  displayAssistantResponse(_content: string) {
    console.log(`\n${chalk.blue("[AI] MARIA Response:")}`);
    console.log(chalk.blue("=".repeat(30)));

    // Check if content contains structured data
    if (
      _content.includes("[LINT ERRORS") ||
      _content.includes("[TYPESCRIPT ERRORS")
    ) {
      console.log(chalk.red.bold("🔍 Error Analysis Mode"));
    } else if (_content.includes("[ATTACHED IMAGES")) {
      console.log(chalk.cyan.bold("🖼️  Image Analysis Mode"));
    } else if (_content.includes("[URL RESEARCH")) {
      console.log(chalk.blue.bold("🔬 Research Mode"));
    }

    console.log();

    this.messages.push({
      role: "assistant",
      content: "",
      timestamp: new Date(),
    });
  }

  // Display a processing step with spinner
  async displayStep(step: StepInfo): Promise<void> {
    const _statusIcons = {
      pending: "[WAIT]",
      "in-progress": "[PROC]",
      completed: "[DONE]",
      error: "[FAIL]",
    };

    const _prefix = `${chalk.bold(`Step ${step.number}:`)} ${step.title}`;

    if (step.status === "in-progress") {
      this.currentSpinner = ora({
        text: _prefix,
        spinner: "dots",
      }).start();
    } else {
      if (
        this.currentSpinner &&
        typeof this.currentSpinner === "object" &&
        "stop" in this.currentSpinner &&
        typeof (this.currentSpinner as Spinner).stop === "function"
      ) {
        (this.currentSpinner as Spinner).stop();
        this.currentSpinner = null;
      }
      console.log(`${_statusIcons[step.status]} ${_prefix}`);
      if (step.content) {
        console.log(chalk.gray(`   ${step.content}`));
      }
    }
  }

  // Display code with syntax highlighting
  displayCode(_code: string, language: string = "typescript") {
    console.log();
    console.log(chalk.gray(`\`\`\`${language}`));

    try {
      const _highlighted = highlight(_code, { language });
      console.log(_highlighted);
    } catch {
      // Fallback to plain code if highlighting fails
      console.log(_code);
    }

    console.log(chalk.gray("```"));
    console.log();
  }

  // Display markdown-like content with enhanced formatting
  displayMarkdown(_content: string) {
    const _lines = _content.split("\n");

    lines.forEach((line) => {
      // Headers
      if (line.startsWith("### ")) {
        console.log(chalk.bold.yellow(line));
      } else if (line.startsWith("## ")) {
        console.log(chalk.bold.cyan(line));
      } else if (line.startsWith("# ")) {
        console.log(chalk.bold.magenta(line));
      }
      // Enhanced patterns
      else if (line.includes("❌") || line.includes("ERROR")) {
        console.log(chalk.red(line));
      } else if (line.includes("⚠️") || line.includes("WARNING")) {
        console.log(chalk.yellow(line));
      } else if (line.includes("✅") || line.includes("SUCCESS")) {
        console.log(chalk.green(line));
      } else if (line.includes("ℹ️") || line.includes("INFO")) {
        console.log(chalk.cyan(line));
      }
      // Bold text
      else if (line.includes("**")) {
        const _formatted = line.replace(/\*\*(.*?)\*\*/g, (_, text) =>
          chalk.bold(text),
        );
        console.log(_formatted);
      }
      // Code inline
      else if (line.includes("`")) {
        const _formatted = line.replace(/`(.*?)`/g, (_, code) =>
          chalk.green(code),
        );
        console.log(_formatted);
      }
      // URLs
      else if (line.includes("http")) {
        const _formatted = line.replace(/(https?:\/\/[^\s]+)/g, (url) =>
          chalk.blue.underline(url),
        );
        console.log(_formatted);
      }
      // File paths
      else if (line.match(/\.(js|ts|jsx|tsx|py|go|rs|java|c|cpp|h):/)) {
        const _formatted = line.replace(
          /([^\s]+\.[a-z]+):(\d+):(\d+)/g,
          (_, file, lineInner, col) =>
            `${chalk.cyan(file)}:${chalk.yellow(line)}:${chalk.yellow(col)}`,
        );
        console.log(_formatted);
      }
      // Lists
      else if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
        console.log(chalk.gray("  •") + line.substring(line.indexOf("-") + 1));
      }
      // Regular text
      else {
        console.log(line);
      }
    });
  }

  // Show typing animation effect
  async typewriterEffect(_text: string, delay: number = 30) {
    for (const char of _text) {
      process.stdout.write(char);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    console.log();
  }

  // Clear the display
  clear() {
    console.clear();
    this.messages = [];
    if (
      this.currentSpinner &&
      typeof this.currentSpinner === "object" &&
      "stop" in this.currentSpinner &&
      typeof (this.currentSpinner as Spinner).stop === "function"
    ) {
      (this.currentSpinner as Spinner).stop();
      this.currentSpinner = null;
    }
  }

  // Display enhanced progress with context
  displayEnhancedProgress(_message: string, context?: string) {
    console.log(chalk.cyan(`🔄 ${_message}`));
    if (context) {
      console.log(chalk.gray(`   Context: ${context}`));
    }
  }

  // Display attachment summary
  displayAttachmentSummary(_type: "image" | "url" | "paste", count: number) {
    const _icons = {
      image: "🖼️",
      url: "🔗",
      paste: "📋",
    };

    const _colors = {
      image: chalk.cyan,
      url: chalk.blue,
      paste: chalk.yellow,
    };

    console.log(
      _colors[_type](
        `${_icons[_type]} Processed ${count} ${_type}${count > 1 ? "s" : ""}`,
      ),
    );
  }

  // Display quick actions
  displayQuickActions(_actions: string[]) {
    if (_actions.length === 0) {
      return;
    }

    console.log(`\n${chalk.bold.yellow("💡 Quick Actions:")}`);
    actions.forEach((action, index) => {
      console.log(chalk.yellow(`   ${index + 1}. ${action}`));
    });
  }

  // Get conversation history
  getHistory(): Message[] {
    return [...this.messages];
  }
}
