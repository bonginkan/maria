import fs from 'fs/promises';
import readline from 'readline';
import chalk from 'chalk';
import { AvatarAnimator } from '../services/avatar-animator';

// Avatar data file path
const AVATAR_FILE_PATH = '/Users/bongin_max/maria_code/face_only_96x96_ramp.txt';

interface AvatarSession {
  lines: string[];
  animator: AvatarAnimator | null;
  conversationHistory: Array<{ role: string; content: string }>;
  isActive: boolean;
  rl: readline.Interface | null;
}

class AvatarInterface {
  private session: AvatarSession = {
    lines: [],
    animator: null,
    conversationHistory: [],
    isActive: false,
    rl: null,
  };

  private currentAnimation: NodeJS.Timeout | null = null;
  private blinkTimer: NodeJS.Timeout | null = null;
  private breathingTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.setupInput();
  }

  private setupInput(): void {
    this.session.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Handle Ctrl+C gracefully
    this.session.rl.on('SIGINT', () => {
      this.exit();
    });
  }

  async start(): Promise<void> {
    try {
      this.session.isActive = true;

      // Clear screen and show header
      console.clear();
      this.showHeader();

      // Load avatar
      await this.loadAvatar();

      // Show initial avatar
      this.displayAvatar();

      // Show initial message
      this.showMessage('Hello! I am MARIA Assistant. How can I help you today?');

      // Start animations
      this.startAnimations();

      // Start interactive loop
      this.startInteractive();
    } catch (error) {
      console.error(chalk.red('Error starting avatar interface:'), error);
      this.exit();
    }
  }

  private showHeader(): void {
    console.log(chalk.white.bold('═'.repeat(50)));
    console.log(chalk.white.bold('         MARIA AVATAR INTERFACE'));
    console.log(chalk.white.bold('═'.repeat(50)));
    console.log();
  }

  private async loadAvatar(): Promise<void> {
    try {
      const data = await fs.readFile(AVATAR_FILE_PATH, 'utf-8');
      this.session.lines = data.split('\n');
      this.session.animator = new AvatarAnimator(this.session.lines);
    } catch (error) {
      console.error(chalk.red('Error loading avatar:'), error);
      this.session.lines = ['[Avatar loading error]'];
      this.session.animator = null;
    }
  }

  private displayAvatar(): void {
    // Move cursor up to redraw avatar area
    if (this.session.lines.length > 0) {
      console.log();
      this.session.lines.forEach((line) => {
        console.log(chalk.white('  ' + line));
      });
      console.log();
    }
  }

  private showMessage(message: string): void {
    const boxWidth = 80;
    const border = '─'.repeat(boxWidth - 4);

    console.log(chalk.white('┌─' + border + '─┐'));

    // Word wrap for long messages
    const words = message.split(' ');
    let currentLine = '';
    const lines: string[] = [];

    words.forEach((word) => {
      if ((currentLine + word).length <= boxWidth - 6) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    });
    if (currentLine) lines.push(currentLine);

    lines.forEach((line) => {
      const padding = ' '.repeat(Math.max(0, boxWidth - 6 - line.length));
      console.log(chalk.white('│ ') + chalk.white(line) + padding + chalk.white(' │'));
    });

    console.log(chalk.white('└─' + border + '─┘'));
    console.log();
  }

  private startAnimations(): void {
    if (!this.session.animator) return;

    // Blinking animation
    this.blinkTimer = setInterval(
      () => {
        if (this.session.animator && this.session.isActive) {
          const blinkLines = this.session.animator.applyEyeBlink();
          this.updateAvatarDisplay(blinkLines);

          // Restore normal after blink
          setTimeout(() => {
            if (this.session.animator && this.session.isActive) {
              this.updateAvatarDisplay(this.session.lines);
            }
          }, 150);
        }
      },
      4000 + Math.random() * 2000,
    );

    // Breathing effect
    let breathingPhase = 0;
    this.breathingTimer = setInterval(() => {
      if (this.session.animator && this.session.isActive) {
        breathingPhase += 0.1;
        const breathingLines = this.session.animator.applyBreathingEffect(breathingPhase);
        this.updateAvatarDisplay(breathingLines);
      }
    }, 1000);
  }

  private updateAvatarDisplay(lines: string[]): void {
    // Move cursor up and redraw avatar
    process.stdout.moveCursor(0, -(lines.length + 2));
    process.stdout.clearScreenDown();

    console.log();
    lines.forEach((line) => {
      console.log(chalk.white('  ' + line));
    });
    console.log();
  }

  private async simulateTalking(message: string): Promise<void> {
    if (!this.session.animator) return;

    const talkingSequence = this.session.animator.getTalkingSequence();
    let frameIndex = 0;

    return new Promise((resolve) => {
      this.currentAnimation = setInterval(() => {
        if (frameIndex >= talkingSequence.length) {
          frameIndex = 0;
        }
        const frame = talkingSequence[frameIndex];
        if (frame) {
          this.updateAvatarDisplay(frame.lines);
        }
        frameIndex++;
      }, 200);

      // Stop talking animation after message duration
      setTimeout(
        () => {
          if (this.currentAnimation) {
            clearInterval(this.currentAnimation);
            this.currentAnimation = null;
          }
          // Restore normal expression
          if (this.session.animator) {
            const normalLines = this.session.animator.applyExpression('neutral');
            this.updateAvatarDisplay(normalLines);
          }
          resolve();
        },
        Math.max(3000, message.length * 50),
      );
    });
  }

  private startInteractive(): void {
    this.promptUser();
  }

  private promptUser(): void {
    if (!this.session.isActive || !this.session.rl) return;

    this.session.rl.question(chalk.green('> '), async (input) => {
      if (!this.session.isActive) return;

      const userInput = input.trim();
      if (!userInput) {
        this.promptUser();
        return;
      }

      // Handle exit commands
      if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
        this.exit();
        return;
      }

      // Add to conversation history
      this.session.conversationHistory.push({ role: 'user', content: userInput });

      // Show thinking message
      this.showMessage('Let me think about that...');

      // Apply thinking expression
      if (this.session.animator) {
        const thinkingLines = this.session.animator.applyExpression('thinking');
        this.updateAvatarDisplay(thinkingLines);
      }

      // Generate response
      await this.generateResponse(userInput);

      // Continue conversation
      this.promptUser();
    });
  }

  private async generateResponse(userInput: string): Promise<void> {
    let response: string;
    let expression: string;

    // Simple response logic (can be enhanced with AI integration)
    if (userInput.toLowerCase().includes('happy') || userInput.toLowerCase().includes('good')) {
      response = "That's wonderful to hear! I'm so glad things are going well!";
      expression = 'happy';
    } else if (
      userInput.toLowerCase().includes('help') ||
      userInput.toLowerCase().includes('problem')
    ) {
      response = "I'm here to help you! Let me see what I can do about that.";
      expression = 'neutral';
    } else if (
      userInput.toLowerCase().includes('surprise') ||
      userInput.toLowerCase().includes('wow')
    ) {
      response = "Oh my! That's quite surprising indeed!";
      expression = 'surprised';
    } else if (
      userInput.toLowerCase().includes('funny') ||
      userInput.toLowerCase().includes('joke')
    ) {
      response = "Haha! That's hilarious! You really made me laugh!";
      expression = 'laughing';
    } else {
      const responses = [
        "That's an interesting question! Let me help you with that.",
        "I understand what you're asking. Here's what I think...",
        'Great point! From my perspective...',
        "I'm here to assist you. Let me process that...",
        "Thanks for sharing that with me. Here's my take...",
      ];
      response = responses[Math.floor(Math.random() * responses.length)] || "I'm here to help you!";
      expression = 'talking';
    }

    // Add to conversation history
    this.session.conversationHistory.push({ role: 'assistant', content: response });

    // Apply expression and show talking animation
    if (this.session.animator) {
      const expressionLines = this.session.animator.applyExpression(expression);
      this.updateAvatarDisplay(expressionLines);
    }

    // Show response with talking animation
    this.showMessage(response);
    await this.simulateTalking(response);
  }

  private exit(): void {
    this.session.isActive = false;

    // Clear timers
    if (this.currentAnimation) {
      clearInterval(this.currentAnimation);
    }
    if (this.blinkTimer) {
      clearInterval(this.blinkTimer);
    }
    if (this.breathingTimer) {
      clearInterval(this.breathingTimer);
    }

    // Close readline
    if (this.session.rl) {
      this.session.rl.close();
    }

    console.log();
    console.log(chalk.yellow('Thank you for chatting with MARIA! Goodbye!'));
    console.log(chalk.white.bold('═'.repeat(50)));
    process.exit(0);
  }
}

// Command function for use in CLI
export async function showAvatar(): Promise<void> {
  const avatarInterface = new AvatarInterface();
  await avatarInterface.start();
}

// Export for slash command handler
export const avatarCommand = {
  name: 'avatar',
  description: 'Interactive ASCII avatar chat interface',
  execute: showAvatar,
};

export default showAvatar;
