export interface BaseCommandOptions {
  verbose?: boolean;
  quiet?: boolean;
  output?: string;
  format?: "json" | "text" | "table";
}

export class BaseCommand {
  protected options: BaseCommandOptions;

  constructor(_options: BaseCommandOptions = {}) {
    this._options = _options;
  }

  protected log(message: string): void {
    if (!this.options.quiet) {
      console.log(message);
    }
  }

  protected error(message: string): void {
    console.error(message);
  }

  protected debug(message: string): void {
    if (this.options.verbose) {
      console.log(`[DEBUG] ${message}`);
    }
  }
}
