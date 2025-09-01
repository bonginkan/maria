/**
 * Exec Helper Utility
 *
 * Provides promise-based command execution utilities
 */

import { exec } from "child_process";
import { spawn } from "node:child_process";
import { promisify } from "util";

export const _execPromise = promisify(exec);

export interface ExecResult {
  stdout: string;
  stderr: string;
}

/**
 * Run a command with arguments safely using spawn
 * @param cmd Command to run
 * @param args Arguments array
 * @param timeoutMs Timeout in milliseconds (default 8000)
 * @returns Promise resolving to stdout output
 */
export function runCommand(
  _cmd: string,
  args: string[],
  _timeoutMs = 8000,
): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const ps = spawn(_cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "",
      err = "";

    const _timer = setTimeout(() => {
      ps.kill("SIGKILL");
      reject(new Error(`${_cmd} timeout after ${_timeoutMs}ms`));
    }, _timeoutMs);

    ps.stdout.on("data", (buffer) => {
      out += buffer.toString();
    });

    ps.stderr.on("data", (buffer) => {
      err += buffer.toString();
    });

    ps.on("close", (code) => {
      clearTimeout(_timer);
      if (code === 0) {
        resolve(out);
      } else {
        reject(new Error(err || `${_cmd} exited with code ${code}`));
      }
    });
  });
}

/**
 * GitHub CLI wrapper with basic validation
 * @param args Arguments for gh command
 * @param timeoutMs Timeout in milliseconds (default 8000)
 * @returns Promise resolving to stdout output
 */
export async function runGh(
  _args: string[],
  _timeoutMs = 8000,
): Promise<string> {
  return runCommand("gh", _args, _timeoutMs);
}
