/**
 * Error Handler - Unified error display and handling
 * Ensures consistent error presentation across the application
 */

import chalk from "chalk";

export class ErrorHandler {
  /**
   * Display error _message with consistent formatting
   */
  static displayError(_message: string, error?: unknown): void {
    process.stdout.write("\r\u001b[K"); // Clear current line
    console.log(chalk.red(`✗ ${_message}`));

    if (error && process.env.NODE_ENV === "development") {
      const _errorStr = error instanceof Error ? error.stack : String(error);
      console.log(chalk.gray(_errorStr));
    }

    console.log(); // Empty line for spacing
  }

  /**
   * Display warning _message
   */
  static displayWarning(_message: string, details?: string): void {
    process.stdout.write("\r\u001b[K");
    console.log(chalk.yellow(`⚠️ ${_message}`));

    if (details) {
      console.log(chalk.gray(`   ${details}`));
    }

    console.log();
  }

  /**
   * Display success _message
   */
  static displaySuccess(_message: string): void {
    process.stdout.write("\r\u001b[K");
    console.log(chalk.green(`✅ ${_message}`));
    console.log();
  }

  /**
   * Display info _message
   */
  static displayInfo(_message: string): void {
    process.stdout.write("\r\u001b[K");
    console.log(chalk.blue(`ℹ️ ${_message}`));
    console.log();
  }

  /**
   * Handle failed initialization with _fallback guidance
   */
  static handleInitializationFailure(
    componentName: string,
    error: unknown,
    fallbackMessage?: string,
  ): void {
    const _fallback =
      fallbackMessage || `${componentName} will run in limited mode`;

    this.displayWarning(`${componentName} initialization failed`, _fallback);

    if (process.env.NODE_ENV === "development") {
      console.log(chalk.gray("Error details:"), error);
    }
  }

  /**
   * Handle command execution errors
   */
  static handleCommandError(
    command: string,
    error: unknown,
    userFriendlyMessage?: string,
  ): void {
    const _message = userFriendlyMessage || `Command '${command}' failed`;
    this.displayError(_message, error);
  }

  /**
   * Handle async operation failures with retry suggestion
   */
  static handleAsyncFailure(
    operation: string,
    error: unknown,
    retryable = false,
  ): void {
    let _message = `${operation} failed`;
    if (retryable) {
      _message += " (you can try again)";
    }

    this.displayError(_message, error);
  }

  /**
   * Clear any error artifacts from terminal
   */
  static clearDisplay(): void {
    process.stdout.write("\r\u001b[K");
  }

  /**
   * Format error for logging (without terminal colors)
   */
  static formatErrorForLog(_message: string, error?: unknown): string {
    let result = `ERROR: ${_message}`;

    if (error) {
      if (error instanceof Error) {
        result += `\n  ${error.message}`;
        if (error.stack) {
          result += `\n  Stack: ${error.stack}`;
        }
      } else {
        result += `\n  ${String(error)}`;
      }
    }

    return result;
  }
}
