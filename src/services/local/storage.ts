/**
 * LocalStorageService - File-based storage replacing Firebase/GCP
 */
import * as fs from 'fs-extra';
import * as path from 'path';
import * as crypto from 'crypto';
import { promisify } from 'util';

interface StorageOptions {
  basePath?: string;
  maxVersions?: number;
  enableBackup?: boolean;
}

interface FileMetadata {
  id: string;
  name: string;
  path: string;
  size: number;
  mimeType: string;
  created: Date;
  modified: Date;
  version: number;
  checksum: string;
}

export class LocalStorageService {
  private basePath: string;
  private maxVersions: number;
  private enableBackup: boolean;

  constructor(options: StorageOptions = {}) {
    this.basePath = options.basePath || path.join(process.env.HOME || '', '.maria', 'storage');
    this.maxVersions = options.maxVersions || 10;
    this.enableBackup = options.enableBackup \!== false;
    
    // Ensure base directory exists
    fs.ensureDirSync(this.basePath);
    fs.ensureDirSync(path.join(this.basePath, 'versions'));
    fs.ensureDirSync(path.join(this.basePath, 'metadata'));
  }

  async upload(filePath: string, content: Buffer | string): Promise<FileMetadata> {
    const id = crypto.randomBytes(16).toString('hex');
    const fullPath = path.join(this.basePath, filePath);
    
    // Create version if file exists
    if (await fs.pathExists(fullPath)) {
      await this.createVersion(filePath);
    }

    // Write file
    await fs.ensureDir(path.dirname(fullPath));
    await fs.writeFile(fullPath, content);

    // Calculate checksum
    const checksum = crypto
      .createHash('sha256')
      .update(typeof content === 'string' ? content : content)
      .digest('hex');

    // Create metadata
    const stats = await fs.stat(fullPath);
    const metadata: FileMetadata = {
      id,
      name: path.basename(filePath),
      path: filePath,
      size: stats.size,
      mimeType: this.getMimeType(filePath),
      created: stats.birthtime,
      modified: stats.mtime,
      version: 1,
      checksum
    };

    // Save metadata
    await this.saveMetadata(filePath, metadata);

    return metadata;
  }

  async download(filePath: string): Promise<Buffer> {
    const fullPath = path.join(this.basePath, filePath);
    
    if (\!await fs.pathExists(fullPath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    return fs.readFile(fullPath);
  }

  async delete(filePath: string): Promise<void> {
    const fullPath = path.join(this.basePath, filePath);
    
    if (this.enableBackup) {
      await this.createVersion(filePath);
    }

    await fs.remove(fullPath);
    await this.deleteMetadata(filePath);
  }

  async list(directory: string = ''): Promise<FileMetadata[]> {
    const fullPath = path.join(this.basePath, directory);
    
    if (\!await fs.pathExists(fullPath)) {
      return [];
    }

    const files = await fs.readdir(fullPath);
    const metadata: FileMetadata[] = [];

    for (const file of files) {
      const filePath = path.join(directory, file);
      const meta = await this.getMetadata(filePath);
      if (meta) {
        metadata.push(meta);
      }
    }

    return metadata;
  }

  private async createVersion(filePath: string): Promise<void> {
    const fullPath = path.join(this.basePath, filePath);
    
    if (\!await fs.pathExists(fullPath)) {
      return;
    }

    const versionDir = path.join(this.basePath, 'versions', filePath);
    await fs.ensureDir(versionDir);

    const versions = await fs.readdir(versionDir);
    const versionNumber = versions.length + 1;
    const versionPath = path.join(versionDir, `v${versionNumber}`);

    await fs.copy(fullPath, versionPath);

    // Clean old versions
    if (versions.length >= this.maxVersions) {
      const oldestVersion = path.join(versionDir, versions[0]);
      await fs.remove(oldestVersion);
    }
  }

  private async saveMetadata(filePath: string, metadata: FileMetadata): Promise<void> {
    const metaPath = path.join(this.basePath, 'metadata', `${filePath}.json`);
    await fs.ensureDir(path.dirname(metaPath));
    await fs.writeJson(metaPath, metadata);
  }

  private async getMetadata(filePath: string): Promise<FileMetadata | null> {
    const metaPath = path.join(this.basePath, 'metadata', `${filePath}.json`);
    
    if (\!await fs.pathExists(metaPath)) {
      return null;
    }

    return fs.readJson(metaPath);
  }

  private async deleteMetadata(filePath: string): Promise<void> {
    const metaPath = path.join(this.basePath, 'metadata', `${filePath}.json`);
    await fs.remove(metaPath);
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.ts': 'text/typescript',
      '.js': 'text/javascript',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.pdf': 'application/pdf'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
}
EOF < /dev/null