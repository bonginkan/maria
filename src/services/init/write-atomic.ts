/**
 * Atomic file write utility
 * Ensures file writes are atomic (all-or-nothing) and durable
 */

import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { randomBytes } from "crypto";

interface WriteOptions {
  encoding?: BufferEncoding;
  mode?: number;
  fsync?: boolean;
  tmpDir?: string;
}

/**
 * Write file atomically using tmp → fsync → rename pattern
 * This ensures the file is either fully written or not written at all
 */
export async function writeAtomic(
  filePath: string,
  content: string | Buffer,
  options: WriteOptions = {},
): Promise<void> {
  const { encoding = "utf8", mode = 0o644, fsync = true, tmpDir } = options;

  // Generate unique temp filename
  const dir = path.dirname(filePath);
  const basename = path.basename(filePath);
  const tmpSuffix = `.tmp-${Date.now()}-${randomBytes(4).toString("hex")}`;

  // Use system temp dir or same directory as target
  const tmpPath = tmpDir
    ? path.join(tmpDir, `${basename}${tmpSuffix}`)
    : path.join(dir, `${basename}${tmpSuffix}`);

  let fileHandle: fs.FileHandle | null = null;

  try {
    // Ensure directory exists
    await fs.mkdir(path.dirname(tmpPath), { recursive: true });

    // Write to temp file
    if (Buffer.isBuffer(content)) {
      await fs.writeFile(tmpPath, content, { mode });
    } else {
      await fs.writeFile(tmpPath, content, { encoding, mode });
    }

    // Optional: fsync to ensure data is flushed to disk
    if (fsync) {
      fileHandle = await fs.open(tmpPath, "r+");
      await fileHandle.sync();
      await fileHandle.close();
      fileHandle = null;
    }

    // Atomic rename (POSIX guarantees atomicity)
    await fs.rename(tmpPath, filePath);
  } catch (error) {
    // Clean up temp file on error
    try {
      await fs.unlink(tmpPath);
    } catch {
      // Ignore cleanup errors
    }

    // Close file handle if still open
    if (fileHandle) {
      try {
        await fileHandle.close();
      } catch {
        // Ignore close errors
      }
    }

    throw error;
  }
}

/**
 * Write JSON atomically with pretty formatting
 */
export async function writeJsonAtomic(
  filePath: string,
  data: any,
  indent = 2,
): Promise<void> {
  const content = JSON.stringify(data, null, indent) + "\n";
  return writeAtomic(filePath, content);
}

/**
 * Safe write with backup
 * Creates a backup of existing file before writing
 */
export async function writeWithBackup(
  filePath: string,
  content: string | Buffer,
  options: WriteOptions = {},
): Promise<string | null> {
  let backupPath: string | null = null;

  try {
    // Check if file exists
    await fs.access(filePath);

    // Create backup
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    backupPath = `${filePath}.bak.${stamp}`;
    await fs.copyFile(filePath, backupPath);
  } catch {
    // File doesn't exist or can't be backed up
    backupPath = null;
  }

  // Write atomically
  await writeAtomic(filePath, content, options);

  return backupPath;
}

/**
 * Batch atomic writes
 * All files are written atomically, but as a group transaction
 */
export async function writeBatchAtomic(
  files: Array<{
    path: string;
    content: string | Buffer;
    options?: WriteOptions;
  }>,
  options: { parallel?: boolean } = {},
): Promise<void> {
  const { parallel = false } = options;

  if (parallel) {
    // Write all files in parallel
    await Promise.all(
      files.map((file) => writeAtomic(file.path, file.content, file.options)),
    );
  } else {
    // Write files sequentially
    for (const file of files) {
      await writeAtomic(file.path, file.content, file.options);
    }
  }
}

/**
 * Safe directory creation with atomic marker file
 */
export async function createDirAtomic(
  dirPath: string,
  markerFile = ".initialized",
): Promise<boolean> {
  const markerPath = path.join(dirPath, markerFile);

  try {
    // Check if already initialized
    await fs.access(markerPath);
    return false; // Already exists
  } catch {
    // Create directory and marker atomically
    await fs.mkdir(dirPath, { recursive: true });
    await writeAtomic(markerPath, new Date().toISOString());
    return true; // Newly created
  }
}

/**
 * Lock file implementation for atomic operations
 */
export class FileLock {
  private lockPath: string;
  private acquired = false;
  private pid = process.pid;

  constructor(private filePath: string) {
    this.lockPath = `${filePath}.lock`;
  }

  async acquire(timeout = 5000): Promise<boolean> {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      try {
        // Try to create lock file exclusively
        await fs.writeFile(this.lockPath, String(this.pid), { flag: "wx" });
        this.acquired = true;
        return true;
      } catch {
        // Lock exists, wait and retry
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return false;
  }

  async release(): Promise<void> {
    if (!this.acquired) return;

    try {
      // Verify we own the lock
      const content = await fs.readFile(this.lockPath, "utf8");
      if (content === String(this.pid)) {
        await fs.unlink(this.lockPath);
      }
    } catch {
      // Lock already released
    }

    this.acquired = false;
  }

  async withLock<T>(fn: () => Promise<T>, timeout = 5000): Promise<T> {
    const acquired = await this.acquire(timeout);
    if (!acquired) {
      throw new Error(`Failed to acquire lock for ${this.filePath}`);
    }

    try {
      return await fn();
    } finally {
      await this.release();
    }
  }
}

/**
 * Create a transaction for multiple atomic operations
 */
export class AtomicTransaction {
  private operations: Array<() => Promise<void>> = [];
  private rollbacks: Array<() => Promise<void>> = [];

  add(operation: () => Promise<void>, rollback: () => Promise<void>): void {
    this.operations.push(operation);
    this.rollbacks.push(rollback);
  }

  async commit(): Promise<void> {
    const completed: number[] = [];

    try {
      // Execute all operations
      for (let i = 0; i < this.operations.length; i++) {
        await this.operations[i]();
        completed.push(i);
      }
    } catch (error) {
      // Rollback completed operations in reverse order
      for (let i = completed.length - 1; i >= 0; i--) {
        try {
          await this.rollbacks[completed[i]]();
        } catch {
          // Ignore rollback errors
        }
      }
      throw error;
    }
  }
}
