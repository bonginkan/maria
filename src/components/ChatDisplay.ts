import chalk from 'chalk';
import { highlight } from 'cli-highlight';
import ora from 'ora';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface StepInfo {
  number: number;
  title: string;
  content: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
}

export class ChatDisplay {
  private messages: Message[] = [];
  private currentSpinner: any = null;

  constructor() {}

  // Display user input in a bordered box with enhanced detection
  displayUserInput(input: string) {
    const lines = input.split('\n');
    const maxLength = Math.max(...lines.map((l) => l.length), 40);
    const boxWidth = Math.min(maxLength + 4, process.stdout.columns - 2);

    // Detect special content types
    const hasImages = /\.(jpg|jpeg|png|gif|bmp|webp|svg)/i.test(input);
    const hasUrls = /https?:\/\/[^\s]+/i.test(input);
    const hasPastedContent = /\[Pasted\s+(?:text|image|content)\s*#?\d*\s*\+?\d*\s*lines?\]/i.test(
      input,
    );

    // Enhanced border with content indicators
    let borderChar = '-';
    let borderColor = chalk.gray;

    if (hasImages) {
      borderColor = chalk.cyan;
      borderChar = '=';
    } else if (hasUrls) {
      borderColor = chalk.blue;
      borderChar = '~';
    } else if (hasPastedContent) {
      borderColor = chalk.yellow;
      borderChar = '*';
    }

    console.log('\n' + borderColor('+' + borderChar.repeat(boxWidth - 2) + '+'));

    // Add content type indicator
    if (hasImages || hasUrls || hasPastedContent) {
      let indicator = '';
      if (hasImages) indicator += '🖼️  IMAGE ';
      if (hasUrls) indicator += '🔗 URL ';
      if (hasPastedContent) indicator += '📋 PASTE ';

      const indicatorPadding = boxWidth - indicator.length - 4;
      console.log(
        borderColor('| ') +
          chalk.white.bold(indicator) +
          ' '.repeat(Math.max(0, indicatorPadding)) +
          borderColor(' |'),
      );
      console.log(borderColor('|' + borderChar.repeat(boxWidth - 2) + '|'));
    }

    lines.forEach((line) => {
      const padding = boxWidth - line.length - 4;
      console.log(
        borderColor('| ') +
          chalk.white(line) +
          ' '.repeat(Math.max(0, padding)) +
          borderColor(' |'),
      );
    });
    console.log(borderColor('+' + borderChar.repeat(boxWidth - 2) + '+'));

    this.messages.push({
      role: 'user',
      content: input,
      timestamp: new Date(),
    });
  }

  // Display AI response without border with enhanced formatting
  displayAssistantResponse(content: string) {
    console.log('\n' + chalk.blue('[AI] MARIA Response:'));
    console.log(chalk.blue('='.repeat(30)));

    // Check if content contains structured data
    if (content.includes('[LINT ERRORS') || content.includes('[TYPESCRIPT ERRORS')) {
      console.log(chalk.red.bold('🔍 Error Analysis Mode'));
    } else if (content.includes('[ATTACHED IMAGES')) {
      console.log(chalk.cyan.bold('🖼️  Image Analysis Mode'));
    } else if (content.includes('[URL RESEARCH')) {
      console.log(chalk.blue.bold('🔬 Research Mode'));
    }

    console.log();

    this.messages.push({
      role: 'assistant',
      content,
      timestamp: new Date(),
    });
  }

  // Display a processing step with spinner
  async displayStep(step: StepInfo): Promise<void> {
    const statusIcons = {
      pending: '[WAIT]',
      'in-progress': '[PROC]',
      completed: '[DONE]',
      error: '[FAIL]',
    };

    const prefix = `${chalk.bold(`Step ${step.number}:`)} ${step.title}`;

    if (step.status === 'in-progress') {
      this.currentSpinner = ora({
        text: prefix,
        spinner: 'dots',
      }).start();
    } else {
      if (this.currentSpinner) {
        this.currentSpinner.stop();
        this.currentSpinner = null;
      }
      console.log(`${statusIcons[step.status]} ${prefix}`);
      if (step.content) {
        console.log(chalk.gray('   ' + step.content));
      }
    }
  }

  // Display code with syntax highlighting
  displayCode(code: string, language: string = 'typescript') {
    console.log();
    console.log(chalk.gray('```' + language));

    try {
      const highlighted = highlight(code, { language });
      console.log(highlighted);
    } catch {
      // Fallback to plain code if highlighting fails
      console.log(code);
    }

    console.log(chalk.gray('```'));
    console.log();
  }

  // Display markdown-like content with enhanced formatting
  displayMarkdown(content: string) {
    const lines = content.split('\n');

    lines.forEach((line) => {
      // Headers
      if (line.startsWith('### ')) {
        console.log(chalk.bold.yellow(line));
      } else if (line.startsWith('## ')) {
        console.log(chalk.bold.cyan(line));
      } else if (line.startsWith('# ')) {
        console.log(chalk.bold.magenta(line));
      }
      // Enhanced patterns
      else if (line.includes('❌') || line.includes('ERROR')) {
        console.log(chalk.red(line));
      } else if (line.includes('⚠️') || line.includes('WARNING')) {
        console.log(chalk.yellow(line));
      } else if (line.includes('✅') || line.includes('SUCCESS')) {
        console.log(chalk.green(line));
      } else if (line.includes('ℹ️') || line.includes('INFO')) {
        console.log(chalk.cyan(line));
      }
      // Bold text
      else if (line.includes('**')) {
        const formatted = line.replace(/\*\*(.*?)\*\*/g, (_, text) => chalk.bold(text));
        console.log(formatted);
      }
      // Code inline
      else if (line.includes('`')) {
        const formatted = line.replace(/`(.*?)`/g, (_, code) => chalk.green(code));
        console.log(formatted);
      }
      // URLs
      else if (line.includes('http')) {
        const formatted = line.replace(/(https?:\/\/[^\s]+)/g, (url) => chalk.blue.underline(url));
        console.log(formatted);
      }
      // File paths
      else if (line.match(/\.(js|ts|jsx|tsx|py|go|rs|java|c|cpp|h):/)) {
        const formatted = line.replace(
          /([^\s]+\.[a-z]+):(\d+):(\d+)/g,
          (_, file, line, col) =>
            chalk.cyan(file) + ':' + chalk.yellow(line) + ':' + chalk.yellow(col),
        );
        console.log(formatted);
      }
      // Lists
      else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        console.log(chalk.gray('  •') + line.substring(line.indexOf('-') + 1));
      }
      // Regular text
      else {
        console.log(line);
      }
    });
  }

  // Show typing animation effect
  async typewriterEffect(text: string, delay: number = 30) {
    for (const char of text) {
      process.stdout.write(char);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    console.log();
  }

  // Clear the display
  clear() {
    console.clear();
    this.messages = [];
    if (this.currentSpinner) {
      this.currentSpinner.stop();
      this.currentSpinner = null;
    }
  }

  // Display enhanced progress with context
  displayEnhancedProgress(message: string, context?: string) {
    console.log(chalk.cyan(`🔄 ${message}`));
    if (context) {
      console.log(chalk.gray(`   Context: ${context}`));
    }
  }

  // Display attachment summary
  displayAttachmentSummary(type: 'image' | 'url' | 'paste', count: number) {
    const icons = {
      image: '🖼️',
      url: '🔗',
      paste: '📋',
    };

    const colors = {
      image: chalk.cyan,
      url: chalk.blue,
      paste: chalk.yellow,
    };

    console.log(colors[type](`${icons[type]} Processed ${count} ${type}${count > 1 ? 's' : ''}`));
  }

  // Display quick actions
  displayQuickActions(actions: string[]) {
    if (actions.length === 0) return;

    console.log('\n' + chalk.bold.yellow('💡 Quick Actions:'));
    actions.forEach((action, index) => {
      console.log(chalk.yellow(`   ${index + 1}. ${action}`));
    });
  }

  // Get conversation history
  getHistory(): Message[] {
    return [...this.messages];
  }
}
