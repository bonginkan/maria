/**
 * Exec Helper Utility
 *
 * Provides promise-based command execution utilities
 */

import { exec } from 'child_process';
import { promisify } from 'util';

export const execPromise = promisify(exec);

export interface ExecResult {
  stdout: string;
  stderr: string;
}
