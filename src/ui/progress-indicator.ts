export interface ProgressOptions {
  type?: 'spinner' | 'bar' | 'dots' | 'line';
  message?: string;
  total?: number;
  color?: string;
}

export class ProgressIndicator {
  private type: string;
  private message: string;
  private total: number;
  private current: number;
  private interval: NodeJS.Timeout | null = null;
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private frameIndex = 0;

  constructor(options: ProgressOptions = {}) {
    this.type = options.type || 'spinner';
    this.message = options.message || 'Processing...';
    this.total = options.total || 100;
    this.current = 0;
  }

  start(): void {
    if (this.type === 'spinner') {
      this.startSpinner();
    } else if (this.type === 'bar') {
      this.updateBar();
    }
  }

  update(current: number, message?: string): void {
    this.current = current;
    if (message) {
      this.message = message;
    }
    if (this.type === 'bar') {
      this.updateBar();
    }
  }

  stop(message?: string): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    if (message) {
      process.stdout.write(`\r${message}\n`);
    } else {
      process.stdout.write('\r\x1b[K');
    }
  }

  private startSpinner(): void {
    this.interval = setInterval(() => {
      const frame = this.frames[this.frameIndex];
      process.stdout.write(`\r${frame} ${this.message}`);
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
    }, 80);
  }

  private updateBar(): void {
    const percentage = Math.floor((this.current / this.total) * 100);
    const filled = Math.floor((this.current / this.total) * 30);
    const bar = '█'.repeat(filled) + '░'.repeat(30 - filled);
    process.stdout.write(`\r[${bar}] ${percentage}% ${this.message}`);
  }

  static spinner(message: string): ProgressIndicator {
    const indicator = new ProgressIndicator({ type: 'spinner', message });
    indicator.start();
    return indicator;
  }

  static bar(total: number, message: string): ProgressIndicator {
    const indicator = new ProgressIndicator({ type: 'bar', total, message });
    indicator.start();
    return indicator;
  }
}
