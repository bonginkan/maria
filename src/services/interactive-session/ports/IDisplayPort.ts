// src/services/interactive-session/ports/IDisplayPort.ts
// Display and output handling port interface

export interface IDisplayPort {
  /**
   * Show welcome message at session start
   */
  showWelcome(): Promise<void>;

  /**
   * Show goodbye message at session end
   */
  showGoodbye(): void;

  /**
   * Print a message to the display
   * @param message - The message to display
   */
  print(message: string): Promise<void>;

  /**
   * Display an error message
   * @param message - The error message
   */
  error(message: string): void;

  /**
   * Display a success message
   * @param message - The success message
   */
  success(message: string): void;

  /**
   * Display a warning message
   * @param message - The warning message
   */
  warning(message: string): void;

  /**
   * Display an info message
   * @param message - The info message
   */
  info(message: string): void;

  /**
   * Start a spinner/loading indicator
   * @param message - Optional message to display with spinner
   * @returns Spinner ID for later stopping
   */
  startSpinner(message?: string): string;

  /**
   * Stop a specific spinner
   * @param spinnerId - The ID of the spinner to stop
   */
  stopSpinner(spinnerId: string): void;

  /**
   * Stop all active spinners (safety mechanism)
   */
  stopAllSpinners(): void;

  /**
   * Clear the display/terminal
   */
  clear(): void;

  /**
   * Stream output with abort support
   * @param content - Content to stream
   * @param signal - AbortSignal for cancellation
   */
  stream(content: AsyncIterable<string>, signal?: AbortSignal): Promise<void>;
}
