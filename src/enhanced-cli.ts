// Enhanced CLI utilities and helpers
export interface CliOptions {
  verbose?: boolean;
  quiet?: boolean;
  debug?: boolean;
  color?: boolean;
}

export class EnhancedCli {
  private options: CliOptions;

  constructor(options: CliOptions = {}) {
    this.options = {
      verbose: false,
      quiet: false,
      debug: false,
      color: true,
      ...options,
    };
  }

  log(message: string): void {
    if (!this.options.quiet) {
      console.log(message);
    }
  }

  error(message: string): void {
    console.error(this.options.color ? `\x1b[31m${message}\x1b[0m` : message);
  }

  warn(message: string): void {
    if (!this.options.quiet) {
      console.warn(this.options.color ? `\x1b[33m${message}\x1b[0m` : message);
    }
  }

  success(message: string): void {
    if (!this.options.quiet) {
      console.log(this.options.color ? `\x1b[32m${message}\x1b[0m` : message);
    }
  }

  info(message: string): void {
    if (this.options.verbose && !this.options.quiet) {
      console.log(this.options.color ? `\x1b[36m${message}\x1b[0m` : message);
    }
  }

  debug(message: string): void {
    if (this.options.debug) {
      console.log(this.options.color ? `\x1b[90m[DEBUG] ${message}\x1b[0m` : `[DEBUG] ${message}`);
    }
  }

  table(data: Record<string, unknown>[]): void {
    if (this.options.quiet) {return;}
    console.table(data);
  }

  json(data: unknown, pretty = true): void {
    if (this.options.quiet) {return;}
    console.log(pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data));
  }
}

export const createCli = (options?: CliOptions): EnhancedCli => {
  return new EnhancedCli(options);
};
