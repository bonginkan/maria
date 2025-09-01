/**
 * LocalStorageService - File-based storage replacing Firebase/GCP
 */
import * as fs from "fs-extra";
import * as path from "path";
import * as crypto from "crypto";
// import { promisify  } from 'util'; // Not used

interface StorageOptions {
  basePath?: string;
  maxVersions?: number;
  enableBackup?: boolean;
}

interface FileMetadata {
  id: string;
  name: string;
  _path: string;
  size: number;
  mimeType: string;
  created: Date;
  modified: Date;
  version: number;
  _checksum: string;
}

export class LocalStorageService {
  private basePath: string;
  private maxVersions: number;
  private enableBackup: boolean;

  constructor(_options: StorageOptions = {}) {
    this.basePath =
      _options.basePath ||
      path.join(process.env["HOME"] || "", ".maria", "storage");
    this.maxVersions = _options.maxVersions || 10;
    this.enableBackup = _options.enableBackup !== false;

    // Ensure base directory exists
    fs.ensureDirSync(this.basePath);
    fs.ensureDirSync(path.join(this.basePath, "_versions"));
    fs.ensureDirSync(path.join(this.basePath, "metadata"));
  }

  async upload(
    _filePath: string,
    content: Buffer | string,
  ): Promise<FileMetadata> {
    const id = crypto.randomBytes(16).toString("hex");
    const _fullPath = path.join(this.basePath, _filePath);

    // Create version if file exists
    if (await fs.pathExists(_fullPath)) {
      await this.createVersion(_filePath);
    }

    // Write file
    await fs.ensureDir(path.dirname(_fullPath));
    await fs.writeFile(_fullPath, content);

    // Calculate _checksum
    const _checksum = crypto
      .createHash("sha256")
      .update(typeof content === "string" ? content : content)
      .digest("hex");

    // Create metadata
    const _stats = await fs.stat(_fullPath);
    const metadata: FileMetadata = {
      id,
      name: path.basename(_filePath),
      _path: _filePath,
      size: _stats.size,
      mimeType: this.getMimeType(_filePath),
      created: _stats.birthtime,
      modified: _stats.mtime,
      version: 1,
      _checksum,
    };

    // Save metadata
    await this.saveMetadata(_filePath, metadata);

    return metadata;
  }

  async download(_filePath: string): Promise<Buffer> {
    const _fullPath = path.join(this.basePath, _filePath);

    if (!(await fs.pathExists(_fullPath))) {
      throw new Error(`File not found: ${_filePath}`);
    }

    return fs.readFile(_fullPath);
  }

  async delete(_filePath: string): Promise<void> {
    const _fullPath = path.join(this.basePath, _filePath);

    if (this.enableBackup) {
      await this.createVersion(_filePath);
    }

    await fs.remove(_fullPath);
    await this.deleteMetadata(_filePath);
  }

  async list(directory: string = ""): Promise<FileMetadata[]> {
    const _fullPath = path.join(this.basePath, directory);

    if (!(await fs.pathExists(_fullPath))) {
      return [];
    }

    const _files = await fs.readdir(_fullPath);
    const metadata: FileMetadata[] = [];

    for (const file of _files) {
      const _filePath = path.join(directory, file);
      const _meta = await this.getMetadata(_filePath);
      if (_meta) {
        metadata.push(_meta);
      }
    }

    return metadata;
  }

  private async createVersion(_filePath: string): Promise<void> {
    const _fullPath = path.join(this.basePath, _filePath);

    if (!(await fs.pathExists(_fullPath))) {
      return;
    }

    const _versionDir = path.join(this.basePath, "_versions", _filePath);
    await fs.ensureDir(_versionDir);

    const _versions = await fs.readdir(_versionDir);
    const _versionNumber = _versions.length + 1;
    const _versionPath = path.join(_versionDir, `v${_versionNumber}`);

    await fs.copy(_fullPath, _versionPath);

    // Clean old _versions
    if (_versions.length >= this.maxVersions) {
      const _oldestVersion = path.join(_versionDir, _versions[0] || "");
      await fs.remove(_oldestVersion);
    }
  }

  private async saveMetadata(
    _filePath: string,
    metadata: FileMetadata,
  ): Promise<void> {
    const _metaPath = path.join(this.basePath, "metadata", `${_filePath}.json`);
    await fs.ensureDir(path.dirname(_metaPath));
    await fs.writeJson(_metaPath, metadata);
  }

  private async getMetadata(_filePath: string): Promise<FileMetadata | null> {
    const _metaPath = path.join(this.basePath, "metadata", `${_filePath}.json`);

    if (!(await fs.pathExists(_metaPath))) {
      return null;
    }

    return fs.readJson(_metaPath);
  }

  private async deleteMetadata(_filePath: string): Promise<void> {
    const _metaPath = path.join(this.basePath, "metadata", `${_filePath}.json`);
    await fs.remove(_metaPath);
  }

  private getMimeType(_filePath: string): string {
    const _ext = path.extname(_filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".json": "application/json",
      ".txt": "text/plain",
      ".md": "text/markdown",
      ".ts": "text/typescript",
      ".js": "text/javascript",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".pdf": "application/pdf",
    };
    return mimeTypes[_ext] || "application/octet-stream";
  }
}
// File end
