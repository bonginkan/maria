/**
 * Service Startup Display
 * Shows progress and status of AI service initialization
 */

import chalk from 'chalk';

export interface ServiceStatus {
  name: string;
  status: 'checking' | 'starting' | 'running' | 'failed' | 'not-installed' | 'skipped';
  progress?: number;
  message?: string;
  model?: string;
}

export class ServiceStartupDisplay {
  private services: Map<string, ServiceStatus> = new Map();
  private displayStarted = false;

  constructor() {
    // Initialize with default services
    this.services.set('lmstudio', {
      name: 'LM Studio',
      status: 'checking',
      progress: 0,
    });
    this.services.set('ollama', {
      name: 'Ollama',
      status: 'checking',
      progress: 0,
    });
    this.services.set('vllm', {
      name: 'vLLM',
      status: 'checking',
      progress: 0,
    });
  }

  startDisplay(): void {
    if (this.displayStarted) {return;}
    this.displayStarted = true;

    console.log('');
    console.log(chalk.cyan.bold('🚀 Initializing AI Services...'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log('');
  }

  updateService(serviceId: string, status: Partial<ServiceStatus>): void {
    const current = this.services.get(serviceId);
    if (current) {
      this.services.set(serviceId, { ...current, ...status });
      this.render();
    }
  }

  private render(): void {
    // Move cursor up to overwrite previous output
    if (this.displayStarted) {
      process.stdout.write('\x1b[3A'); // Move up 3 lines
    }

    // Local Services
    console.log(chalk.yellow.bold('Local AI Services:'));

    this.services.forEach((service) => {
      const statusIcon = this.getStatusIcon(service.status);
      const statusText = this.getStatusText(service);
      const progressBar =
        service.progress !== undefined ? this.renderProgressBar(service.progress) : '';

      console.log(
        `  ${statusIcon} ${chalk.white(service.name.padEnd(12))} ${progressBar} ${statusText}`,
      );

      if (service.model) {
        console.log(chalk.gray(`     └─ Model: ${service.model}`));
      }
    });

    console.log('');
  }

  private getStatusIcon(status: ServiceStatus['status']): string {
    switch (status) {
      case 'running':
        return chalk.green('✅');
      case 'checking':
      case 'starting':
        return chalk.yellow('⏳');
      case 'failed':
        return chalk.red('❌');
      case 'not-installed':
      case 'skipped':
        return chalk.gray('⚠️');
      default:
        return chalk.gray('•');
    }
  }

  private getStatusText(service: ServiceStatus): string {
    switch (service.status) {
      case 'running':
        return chalk.green('Running');
      case 'checking':
        return chalk.yellow('Checking...');
      case 'starting':
        return chalk.yellow('Starting...');
      case 'failed':
        return chalk.red('Failed to start');
      case 'not-installed':
        return chalk.gray('Not installed');
      case 'skipped':
        return chalk.gray('Skipped');
      default:
        return chalk.gray(service.status);
    }
  }

  private renderProgressBar(progress: number): string {
    const width = 20;
    const filled = Math.round(width * (progress / 100));
    const empty = width - filled;

    const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));

    return `[${bar}] ${chalk.cyan(`${progress.toString().padStart(3)  }%`)}`;
  }

  complete(primaryProvider?: string): void {
    console.log(chalk.gray('─'.repeat(60)));

    if (primaryProvider) {
      console.log(
        chalk.green.bold('🎉 Ready!') +
          chalk.white(` Using ${primaryProvider} as primary provider`),
      );
    } else {
      console.log(chalk.green.bold('🎉 Ready!') + chalk.white(' Using cloud AI providers'));
    }

    console.log('');
  }

  showCloudServices(services: { name: string; available: boolean }[]): void {
    console.log(chalk.yellow.bold('Cloud AI Services:'));

    services.forEach((service) => {
      const icon = service.available ? chalk.green('✅') : chalk.red('❌');
      const status = service.available ? chalk.green('Available') : chalk.red('Not configured');
      console.log(`  ${icon} ${chalk.white(service.name.padEnd(12))} ${status}`);
    });

    console.log('');
  }
}

// Singleton instance
let displayInstance: ServiceStartupDisplay | null = null;

export function getServiceDisplay(): ServiceStartupDisplay {
  if (!displayInstance) {
    displayInstance = new ServiceStartupDisplay();
  }
  return displayInstance;
}

export function resetServiceDisplay(): void {
  displayInstance = null;
}
