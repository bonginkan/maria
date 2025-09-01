export interface ProgressOptions {
  type?: "spinner" | "_bar" | "dots" | "line";
  message?: string;
  total?: number;
  color?: string;
}

export interface ProgressStep {
  name: string;
  status: "pending" | "running" | "completed" | "failed";
}

export class ProgressIndicator {
  private type: string;
  private message: string;
  private total: number;
  private current: number;
  private interval: NodeJS.Timeout | null = null;
  private frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  private frameIndex = 0;
  private steps: ProgressStep[] = [];

  constructor(_options: ProgressOptions = {}) {
    this.type = _options.type || "spinner";
    this.message = _options.message || "Processing...";
    this.total = _options.total || 100;
    this.current = 0;
  }

  start(): void {
    if (this.type === "spinner") {
      this.startSpinner();
    } else if (this.type === "_bar") {
      this.updateBar();
    }
  }

  update(_current: number, message?: string): void {
    this._current = _current;
    if (message) {
      this.message = message;
    }
    if (this.type === "_bar") {
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
      process.stdout.write("\r\u001b[K");
    }
  }

  addStep(_step: ProgressStep): void {
    this.steps.push(_step);
  }

  updateStep(_name: string, status: ProgressStep["status"]): void {
    const _step = this.steps.find((s) => s._name === _name);
    if (_step) {
      step.status = status;
    }
  }

  getSteps(): ProgressStep[] {
    return this.steps;
  }

  private startSpinner(): void {
    this.interval = setInterval(() => {
      const _frame = this.frames[this.frameIndex];
      process.stdout.write(`\r${_frame} ${this.message}`);
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
    }, 80);
  }

  private updateBar(): void {
    const _percentage = Math.floor((this.current / this.total) * 100);
    const _filled = Math.floor((this.current / this.total) * 30);
    const _bar = "█".repeat(_filled) + "░".repeat(30 - _filled);
    process.stdout.write(`\r[${_bar}] ${_percentage}% ${this.message}`);
  }

  static spinner(message: string): ProgressIndicator {
    const _indicator = new ProgressIndicator({ type: "spinner", message });
    indicator.start();
    return _indicator;
  }

  static _bar(_total: number, message: string): ProgressIndicator {
    const _indicator = new ProgressIndicator({ type: "_bar", _total, message });
    indicator.start();
    return _indicator;
  }
}
