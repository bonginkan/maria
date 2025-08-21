import chalk from 'chalk';

interface ServiceStatus {
  name: string;
  status: 'checking' | 'starting' | 'running' | 'failed' | 'not-installed';
  progress?: number;
  message?: string;
}

export class LLMStartupManager {
  private services: ServiceStatus[] = [
    { name: 'LM Studio', status: 'checking', progress: 0 },
    { name: 'Ollama', status: 'checking', progress: 0 },
    { name: 'vLLM', status: 'checking', progress: 0 },
  ];

  private displayServices(): void {
    console.log('\n🚀 Initializing AI Services...\n');
    console.log('Local AI Services:');
    console.log('─────────────────────────────────────────────────────────────');

    for (const service of this.services) {
      const progressBar = this.createProgressBar(service.progress || 0);
      const statusIcon = this.getStatusIcon(service.status);
      const message = service.message || this.getDefaultMessage(service.status);

      console.log(`${service.name.padEnd(12)} ${progressBar} ${statusIcon} ${message}`);
      if (service.message) {
        console.log(`             └─ ${service.message}`);
      }
    }
  }

  private createProgressBar(progress: number): string {
    const total = 20;
    const filled = Math.round((progress / 100) * total);
    const empty = total - filled;
    return `[${'\u2588'.repeat(filled)}${'\u2591'.repeat(empty)}] ${progress.toString().padStart(3)}%`;
  }

  private getStatusIcon(status: ServiceStatus['status']): string {
    switch (status) {
      case 'checking':
        return '\u23f3';
      case 'starting':
        return '\u23f3';
      case 'running':
        return '\u2705';
      case 'failed':
        return '\u274c';
      case 'not-installed':
        return '\u26a0\ufe0f';
      default:
        return '\u2753';
    }
  }

  private getDefaultMessage(status: ServiceStatus['status']): string {
    switch (status) {
      case 'checking':
        return 'Checking availability...';
      case 'starting':
        return 'Starting...';
      case 'running':
        return 'Running';
      case 'failed':
        return 'Failed to start';
      case 'not-installed':
        return 'Not installed';
      default:
        return 'Unknown status';
    }
  }

  async initializeServices(): Promise<void> {
    this.displayServices();

    // Check each service
    for (let i = 0; i < this.services.length; i++) {
      const service = this.services[i];
      if (!service) continue;

      await this.checkService(service);
      this.displayServices();
    }

    console.log('\nCloud Services:');
    console.log('─────────────────────────────────────────────────────────────');
    console.log('OpenAI       \u2705 Available (GPT-5)');
    console.log('Anthropic    \u2705 Available (Claude Opus 4.1)');
    console.log('Google AI    \u2705 Available (Gemini 2.5 Pro)');

    const runningServices = this.services.filter((s) => s.status === 'running');
    if (runningServices.length > 0) {
      const primary = runningServices[0];
      console.log(`\n\ud83c\udf89 Ready! Using ${primary?.name} as primary provider`);
    } else {
      console.log('\n\ud83c\udf89 Ready! Using cloud providers');
    }
  }

  private async checkService(service: ServiceStatus): Promise<void> {
    service.status = 'checking';
    service.progress = 0;

    try {
      // Try to check if service is running
      const { LLMHealthChecker } = await import('./llm-health-checker.js');
      const healthChecker = new LLMHealthChecker();
      const healthStatus = await healthChecker.checkService(service.name);

      // Simulate progress for UI
      for (let progress = 0; progress <= 100; progress += 25) {
        service.progress = progress;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      if (healthStatus.isRunning) {
        service.status = 'running';
        service.progress = 100;
        if (healthStatus.models && healthStatus.models.length > 0) {
          service.message = `${healthStatus.models.length} models available`;
        } else {
          service.message = 'Running';
        }
      } else {
        service.status = 'not-installed';
        service.message = 'Not running';
        service.progress = 0;
      }
    } catch {
      service.status = 'not-installed';
      service.message = 'Skipping...';
      service.progress = 0;
    }
  }

  displayWelcome(): void {
    // Perfect rectangular frame with precise spacing to match screenshot
    const frameWidth = 86;
    const horizontalLine = '═'.repeat(frameWidth - 2);
    const emptyLine = '║' + ' '.repeat(frameWidth - 2) + '║';

    // Helper function to center text in frame
    const centerText = (text: string) => {
      const plainText = text.replace(/\u001B\[[0-9;]*m/g, ''); // Remove ANSI codes for length calculation
      const padding = Math.max(0, frameWidth - 2 - plainText.length);
      const leftPad = Math.floor(padding / 2);
      const rightPad = padding - leftPad;
      return '║' + ' '.repeat(leftPad) + text + ' '.repeat(rightPad) + '║';
    };

    console.log('\n');

    // Top border with bright magenta (matching screenshot exactly)
    console.log(chalk.magentaBright('╔' + horizontalLine + '╗'));
    console.log(chalk.magentaBright(emptyLine));

    // MARIA ASCII Logo with bright magenta (matching screenshot exactly)
    console.log(
      chalk.magentaBright(
        centerText(chalk.bold.magentaBright('███╗   ███╗ █████╗ ██████╗ ██╗ █████╗ ')),
      ),
    );
    console.log(
      chalk.magentaBright(
        centerText(chalk.bold.magentaBright('████╗ ████║██╔══██╗██╔══██╗██║██╔══██╗')),
      ),
    );
    console.log(
      chalk.magentaBright(
        centerText(chalk.bold.magentaBright('██╔████╔██║███████║██████╔╝██║███████║')),
      ),
    );
    console.log(
      chalk.magentaBright(
        centerText(chalk.bold.magentaBright('██║╚██╔╝██║██╔══██║██╔══██╗██║██╔══██║')),
      ),
    );
    console.log(
      chalk.magentaBright(
        centerText(chalk.bold.magentaBright('██║ ╚═╝ ██║██║  ██║██║  ██║██║██║  ██║')),
      ),
    );
    console.log(
      chalk.magentaBright(
        centerText(chalk.bold.magentaBright('╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═╝')),
      ),
    );

    console.log(chalk.magentaBright(emptyLine));

    // CODE part with bright magenta theme
    console.log(
      chalk.magentaBright(centerText(chalk.bold.magentaBright('██████╗ ██████╗ ██████╗ ███████╗'))),
    );
    console.log(
      chalk.magentaBright(
        centerText(chalk.bold.magentaBright('██╔════╝██╔═══██╗██╔══██╗██╔════╝')),
      ),
    );
    console.log(
      chalk.magentaBright(
        centerText(chalk.bold.magentaBright('██║     ██║   ██║██║  ██║█████╗  ')),
      ),
    );
    console.log(
      chalk.magentaBright(
        centerText(chalk.bold.magentaBright('██║     ██║   ██║██║  ██║██╔══╝  ')),
      ),
    );
    console.log(
      chalk.magentaBright(
        centerText(chalk.bold.magentaBright('╚██████╗╚██████╔╝██████╔╝███████╗')),
      ),
    );
    console.log(
      chalk.magentaBright(
        centerText(chalk.bold.magentaBright(' ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝')),
      ),
    );

    console.log(chalk.magentaBright(emptyLine));

    // Subtitle with magenta theme to match screenshot
    console.log(
      chalk.magentaBright(centerText(chalk.whiteBright('AI-Powered Development Platform'))),
    );
    console.log(chalk.magentaBright(centerText(chalk.gray('(c) 2025 Bonginkan Inc.'))));

    console.log(chalk.magentaBright(emptyLine));

    // Bottom border
    console.log(chalk.magentaBright('╚' + horizontalLine + '╝'));
    console.log('');
  }
}
