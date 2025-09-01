// src/services/interactive-session/ports/IInputPort.ts
// Input handling port interface with AbortSignal support

export interface IInputPort {
  /**
   * Read a line of input from the user
   * @param signal - AbortSignal for cancellation/timeout
   * @returns User input or null if canceled/aborted
   */
  readline(signal?: AbortSignal): Promise<string | null>;

  /**
   * Prompt the user with a message and wait for input
   * @param message - The prompt message to display
   * @param signal - AbortSignal for cancellation/timeout
   * @returns User input or null if canceled/aborted
   */
  prompt(message: string, signal?: AbortSignal): Promise<string | null>;

  /**
   * Ask for user confirmation (yes/no)
   * @param message - The confirmation message
   * @param signal - AbortSignal for cancellation/timeout
   * @returns true for yes, false for no, null if canceled
   */
  confirm(message: string, signal?: AbortSignal): Promise<boolean | null>;
}
