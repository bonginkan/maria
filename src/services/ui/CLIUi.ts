/**
 * Enhanced CLI UI service with guaranteed spinner cleanup
 */

export class CLIUi {
  private spin?: NodeJS.Timeout;
  private spinnerChars = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  private spinIndex = 0;
  private currentMessage = "";

  progress(msg: string): void {
    this.stopSpinner();
    this.currentMessage = msg;

    // Non-TTY environment: output JSON logs
    if (!process.stdout.isTTY) {
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "info",
          message: msg,
        }),
      );
      return;
    }

    // TTY environment: show animated spinner
    let dots = 0;
    this.spin = setInterval(() => {
      const spinner =
        this.spinnerChars[this.spinIndex++ % this.spinnerChars.length];
      const dotStr = ".".repeat(dots % 4) + "   ";
      process.stdout.write(`\r${spinner} ${msg}${dotStr}`);
      dots++;
    }, 100);
  }

  progressEnd(): void {
    this.stopSpinner();
  }

  displayInfo(msg: string): void {
    this.stopSpinner();
    if (process.stdout.isTTY) {
      console.log(`ℹ️  ${msg}`);
    } else {
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "info",
          message: msg,
        }),
      );
    }
  }

  displaySuccess(msg: string): void {
    this.stopSpinner();
    if (process.stdout.isTTY) {
      console.log(`✅ ${msg}`);
    } else {
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "success",
          message: msg,
        }),
      );
    }
  }

  displayWarning(msg: string): void {
    this.stopSpinner();
    if (process.stdout.isTTY) {
      console.log(`⚠️  ${msg}`);
    } else {
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "warning",
          message: msg,
        }),
      );
    }
  }

  displayError(msg: string): void {
    this.stopSpinner();
    if (process.stdout.isTTY) {
      console.error(`\x1b[31m❌ ${msg}\x1b[0m`);
    } else {
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "error",
          message: msg,
        }),
      );
    }
  }

  error(msg: string, hint?: string): void {
    this.stopSpinner();
    if (process.stdout.isTTY) {
      console.error(`\x1b[31m${msg}\x1b[0m`);
      if (hint) {
        console.error(`\x1b[90m💡 ${hint}\x1b[0m`);
      }
    } else {
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "error",
          message: msg,
          hint,
        }),
      );
    }
  }

  done(msg: string): void {
    this.stopSpinner();
    console.log(msg);
  }

  private stopSpinner(): void {
    if (this.spin) {
      clearInterval(this.spin);
      this.spin = undefined;

      // Clear the spinner line in TTY
      if (process.stdout.isTTY && this.currentMessage) {
        process.stdout.write(
          "\r" + " ".repeat(this.currentMessage.length + 10) + "\r",
        );
      }

      this.currentMessage = "";
    }
  }
}
