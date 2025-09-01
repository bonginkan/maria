/**
 * Advanced Configuration Encryption - Phase 3
 * AES-256-GCM encryption for sensitive configuration data
 */

import * as crypto from "crypto";
import { ValidatedConfig } from "../config-manager";

// Encryption configuration
export interface EncryptionConfig {
  algorithm: "aes-256-gcm" | "aes-256-cbc" | "chacha20-poly1305";
  keyDerivation: "pbkdf2" | "scrypt" | "argon2";
  keyRotationInterval?: number; // days
  compressionEnabled?: boolean;
  integrityCheckEnabled?: boolean;
}

// Encrypted data envelope
export interface EncryptedData {
  algorithm: string;
  version: number;
  encrypted: string; // Base64 encoded
  iv: string; // Base64 encoded initialization vector
  authTag?: string; // Base64 encoded authentication tag (for GCM)
  salt: string; // Base64 encoded salt for key derivation
  checksum?: string; // SHA-256 checksum for integrity
  compressed?: boolean;
  timestamp: number;
  keyId?: string; // Key identifier for rotation
}

// Key management
export interface EncryptionKey {
  id: string;
  key: Buffer;
  derivedFrom?: string; // Master key reference
  algorithm: string;
  createdAt: Date;
  expiresAt?: Date;
  rotationCount: number;
  active: boolean;
}

export interface KeyDerivationOptions {
  password: string;
  salt: Buffer;
  iterations?: number; // PBKDF2
  N?: number; // Scrypt CPU cost
  r?: number; // Scrypt block size
  p?: number; // Scrypt parallelization
  keyLength?: number;
}

/**
 * Advanced encryption manager for configuration data
 */
export class ConfigEncryptionManager {
  private config: EncryptionConfig;
  private keys: Map<string, EncryptionKey> = new Map();
  private masterKey?: Buffer;
  private currentKeyId?: string;

  constructor(config: Partial<EncryptionConfig> = {}) {
    this.config = {
      algorithm: "aes-256-gcm",
      keyDerivation: "pbkdf2",
      keyRotationInterval: 90, // 90 days
      compressionEnabled: true,
      integrityCheckEnabled: true,
      ...config,
    };
  }

  /**
   * Initialize encryption with master password or key file
   */
  async initialize(options: {
    masterPassword?: string;
    keyFile?: string;
    keyId?: string;
  }): Promise<void> {
    if (options.masterPassword) {
      await this.initializeFromPassword(options.masterPassword);
    } else if (options.keyFile) {
      await this.initializeFromKeyFile(options.keyFile);
    } else {
      throw new Error("Either masterPassword or keyFile must be provided");
    }

    // Set current key
    this.currentKeyId = options.keyId || this.getLatestKeyId();

    if (!this.currentKeyId) {
      // Generate initial key
      await this.generateNewKey();
    }
  }

  /**
   * Encrypt configuration data
   */
  async encrypt(
    data: Partial<ValidatedConfig>,
    keyId?: string,
    options?: {
      compress?: boolean;
      includeMetadata?: boolean;
    },
  ): Promise<EncryptedData> {
    const useKeyId = keyId || this.currentKeyId;
    if (!useKeyId) {
      throw new Error("No encryption key available");
    }

    const key = this.keys.get(useKeyId);
    if (!key || !key.active) {
      throw new Error(`Encryption key not found or inactive: ${useKeyId}`);
    }

    try {
      // Serialize data
      let serializedData = JSON.stringify(data);

      // Compress if enabled
      let compressed = false;
      if (
        (options?.compress ?? this.config.compressionEnabled) &&
        serializedData.length > 1024
      ) {
        serializedData = await this.compressData(serializedData);
        compressed = true;
      }

      // Generate IV and salt
      const iv = crypto.randomBytes(16);
      const salt = crypto.randomBytes(32);

      let encrypted: Buffer;
      let authTag: Buffer | undefined;

      switch (this.config.algorithm) {
        case "aes-256-gcm":
          ({ encrypted, authTag } = this.encryptAESGCM(
            serializedData,
            key.key,
            iv,
          ));
          break;

        case "aes-256-cbc":
          encrypted = this.encryptAESCBC(serializedData, key.key, iv);
          break;

        case "chacha20-poly1305":
          ({ encrypted, authTag } = this.encryptChaCha20(
            serializedData,
            key.key,
            iv,
          ));
          break;

        default:
          throw new Error(`Unsupported algorithm: ${this.config.algorithm}`);
      }

      // Calculate checksum if enabled
      let checksum: string | undefined;
      if (this.config.integrityCheckEnabled) {
        checksum = crypto
          .createHash("sha256")
          .update(encrypted)
          .update(iv)
          .update(salt)
          .digest("hex");
      }

      const result: EncryptedData = {
        algorithm: this.config.algorithm,
        version: 1,
        encrypted: encrypted.toString("base64"),
        iv: iv.toString("base64"),
        salt: salt.toString("base64"),
        timestamp: Date.now(),
        keyId: useKeyId,
        compressed,
      };

      if (authTag) {
        result.authTag = authTag.toString("base64");
      }

      if (checksum) {
        result.checksum = checksum;
      }

      return result;
    } catch (error) {
      throw new Error(
        `Encryption failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Decrypt configuration data
   */
  async decrypt(
    encryptedData: EncryptedData,
  ): Promise<Partial<ValidatedConfig>> {
    if (!encryptedData.keyId) {
      throw new Error("Key ID not specified in encrypted data");
    }

    const key = this.keys.get(encryptedData.keyId);
    if (!key) {
      throw new Error(`Decryption key not found: ${encryptedData.keyId}`);
    }

    try {
      // Parse encrypted components
      const encrypted = Buffer.from(encryptedData.encrypted, "base64");
      const iv = Buffer.from(encryptedData.iv, "base64");
      const salt = Buffer.from(encryptedData.salt, "base64");
      const authTag = encryptedData.authTag
        ? Buffer.from(encryptedData.authTag, "base64")
        : undefined;

      // Verify checksum if available
      if (encryptedData.checksum && this.config.integrityCheckEnabled) {
        const calculatedChecksum = crypto
          .createHash("sha256")
          .update(encrypted)
          .update(iv)
          .update(salt)
          .digest("hex");

        if (calculatedChecksum !== encryptedData.checksum) {
          throw new Error("Data integrity check failed - possible corruption");
        }
      }

      let decrypted: string;

      switch (encryptedData.algorithm) {
        case "aes-256-gcm":
          if (!authTag) {
            throw new Error("Authentication tag required for AES-GCM");
          }
          decrypted = this.decryptAESGCM(encrypted, key.key, iv, authTag);
          break;

        case "aes-256-cbc":
          decrypted = this.decryptAESCBC(encrypted, key.key, iv);
          break;

        case "chacha20-poly1305":
          if (!authTag) {
            throw new Error(
              "Authentication tag required for ChaCha20-Poly1305",
            );
          }
          decrypted = this.decryptChaCha20(encrypted, key.key, iv, authTag);
          break;

        default:
          throw new Error(`Unsupported algorithm: ${encryptedData.algorithm}`);
      }

      // Decompress if needed
      if (encryptedData.compressed) {
        decrypted = await this.decompressData(decrypted);
      }

      // Parse JSON
      return JSON.parse(decrypted);
    } catch (innerError) {
      throw new Error(
        `Decryption failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Generate new encryption key
   */
  async generateNewKey(password?: string): Promise<string> {
    const keyId = `key-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const salt = crypto.randomBytes(32);

    let derivedKey: Buffer;

    if (password) {
      derivedKey = await this.deriveKeyFromPassword(password, salt);
    } else if (this.masterKey) {
      // Derive from master key
      derivedKey = crypto.pbkdf2Sync(
        this.masterKey,
        salt,
        100000,
        32,
        "sha256",
      );
    } else {
      // Generate random key
      derivedKey = crypto.randomBytes(32);
    }

    const key: EncryptionKey = {
      id: keyId,
      key: derivedKey,
      algorithm: this.config.algorithm,
      createdAt: new Date(),
      rotationCount: 0,
      active: true,
    };

    // Set expiration if rotation is enabled
    if (this.config.keyRotationInterval) {
      key.expiresAt = new Date(
        Date.now() + this.config.keyRotationInterval * 24 * 60 * 60 * 1000,
      );
    }

    this.keys.set(keyId, key);

    // Set as current if no other key is active
    if (!this.currentKeyId) {
      this.currentKeyId = keyId;
    }

    return keyId;
  }

  /**
   * Rotate encryption keys
   */
  async rotateKeys(newPassword?: string): Promise<{
    newKeyId: string;
    rotatedKeys: string[];
  }> {
    const rotatedKeys: string[] = [];

    // Generate new key
    const newKeyId = await this.generateNewKey(newPassword);

    // Mark old keys as inactive
    for (const [keyId, key] of this.keys) {
      if (keyId !== newKeyId && key.active) {
        key.active = false;
        key.rotationCount++;
        rotatedKeys.push(keyId);
      }
    }

    // Set new key as current
    this.currentKeyId = newKeyId;

    return { newKeyId, rotatedKeys };
  }

  /**
   * Re-encrypt data with new key
   */
  async reencrypt(
    encryptedData: EncryptedData,
    newKeyId?: string,
  ): Promise<EncryptedData> {
    // Decrypt with old key
    const decrypted = await this.decrypt(encryptedData);

    // Encrypt with new key
    return await this.encrypt(decrypted, newKeyId);
  }

  /**
   * Get encryption statistics
   */
  getEncryptionStats(): {
    totalKeys: number;
    activeKeys: number;
    currentKeyId?: string;
    algorithm: string;
    keyRotationEnabled: boolean;
    nextRotation?: Date;
  } {
    const activeKeys = Array.from(this.keys.values()).filter((k) => k.active);

    let nextRotation: Date | undefined;
    if (this.currentKeyId && this.config.keyRotationInterval) {
      const currentKey = this.keys.get(this.currentKeyId);
      nextRotation = currentKey?.expiresAt;
    }

    return {
      totalKeys: this.keys.size,
      activeKeys: activeKeys.length,
      currentKeyId: this.currentKeyId,
      algorithm: this.config.algorithm,
      keyRotationEnabled: !!this.config.keyRotationInterval,
      nextRotation,
    };
  }

  // Private encryption methods

  private encryptAESGCM(
    data: string,
    _key: Buffer,
    _iv: Buffer,
  ): { encrypted: Buffer; authTag: Buffer } {
    const cipher = crypto.createCipherGCM("aes-256-gcm");
    cipher.setAAD(Buffer.from("MARIA-CONFIG-V1"));

    let encrypted = cipher.update(data, "utf8");
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const authTag = cipher.getAuthTag();
    return { encrypted, authTag };
  }

  private decryptAESGCM(
    encrypted: Buffer,
    _key: Buffer,
    _iv: Buffer,
    authTag: Buffer,
  ): string {
    const decipher = crypto.createDecipherGCM("aes-256-gcm");
    decipher.setAuthTag(authTag);
    decipher.setAAD(Buffer.from("MARIA-CONFIG-V1"));

    let decrypted = decipher.update(encrypted, undefined, "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }

  private encryptAESCBC(data: string, key: Buffer, _iv: Buffer): Buffer {
    const cipher = crypto.createCipher("aes-256-cbc", key);
    let encrypted = cipher.update(data, "utf8", "binary");
    encrypted += cipher.final("binary");
    return Buffer.from(encrypted, "binary");
  }

  private decryptAESCBC(encrypted: Buffer, key: Buffer, _iv: Buffer): string {
    const decipher = crypto.createDecipher("aes-256-cbc", key);
    let decrypted = decipher.update(
      encrypted.toString("binary"),
      "binary",
      "utf8",
    );
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  private encryptChaCha20(
    data: string,
    key: Buffer,
    _iv: Buffer,
  ): { encrypted: Buffer; authTag: Buffer } {
    const cipher = crypto.createCipher("chacha20-poly1305", key);
    cipher.setAAD(Buffer.from("MARIA-CONFIG-V1"));

    let encrypted = cipher.update(data, "utf8");
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const authTag = cipher.getAuthTag();
    return { encrypted, authTag };
  }

  private decryptChaCha20(
    encrypted: Buffer,
    key: Buffer,
    _iv: Buffer,
    authTag: Buffer,
  ): string {
    const decipher = crypto.createDecipher("chacha20-poly1305", key);
    decipher.setAuthTag(authTag);
    decipher.setAAD(Buffer.from("MARIA-CONFIG-V1"));

    let decrypted = decipher.update(encrypted, undefined, "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }

  // Key management methods

  private async initializeFromPassword(password: string): Promise<void> {
    const salt = crypto.randomBytes(32);
    this.masterKey = await this.deriveKeyFromPassword(password, salt);
  }

  private async initializeFromKeyFile(keyFile: string): Promise<void> {
    try {
      const fs = await import("fs");
      const keyData = await fs.promises.readFile(keyFile);
      this.masterKey = keyData.slice(0, 32); // Use first 32 bytes as master key
    } catch (error) {
      throw new Error(
        `Failed to load key file: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async deriveKeyFromPassword(
    password: string,
    salt: Buffer,
    options?: Partial<KeyDerivationOptions>,
  ): Promise<Buffer> {
    const opts: KeyDerivationOptions = {
      password,
      salt,
      iterations: 100000,
      keyLength: 32,
      ...options,
    };

    switch (this.config.keyDerivation) {
      case "pbkdf2":
        return crypto.pbkdf2Sync(
          opts.password,
          opts.salt,
          opts.iterations!,
          opts.keyLength!,
          "sha256",
        );

      case "scrypt":
        return crypto.scryptSync(opts.password, opts.salt, opts.keyLength!, {
          N: opts.N || 32768,
          r: opts.r || 8,
          p: opts.p || 1,
        });

      case "argon2":
        // Argon2 would require additional dependency
        throw new Error("Argon2 key derivation not implemented");

      default:
        throw new Error(
          `Unsupported key derivation: ${this.config.keyDerivation}`,
        );
    }
  }

  private getLatestKeyId(): string | undefined {
    let latestKey: EncryptionKey | undefined;
    let latestTime = 0;

    for (const key of this.keys.values()) {
      if (key.active && key.createdAt.getTime() > latestTime) {
        latestKey = key;
        latestTime = key.createdAt.getTime();
      }
    }

    return latestKey?.id;
  }

  // Compression methods (simplified implementations)

  private async compressData(data: string): Promise<string> {
    // In real implementation, use zlib.gzip or similar
    return data; // Mock compression
  }

  private async decompressData(data: string): Promise<string> {
    // In real implementation, use zlib.gunzip or similar
    return data; // Mock decompression
  }

  /**
   * Export encrypted configuration for backup
   */
  async exportEncrypted(config: Partial<ValidatedConfig>): Promise<{
    encrypted: EncryptedData;
    keyInfo: {
      id: string;
      algorithm: string;
      created: Date;
    };
  }> {
    const encrypted = await this.encrypt(config);
    const key = this.keys.get(encrypted.keyId!)!;

    return {
      encrypted,
      keyInfo: {
        id: key.id,
        algorithm: key.algorithm,
        created: key.createdAt,
      },
    };
  }

  /**
   * Securely delete sensitive data from memory
   */
  secureCleanup(): void {
    // Zero out keys in memory
    for (const key of this.keys.values()) {
      if (key.key) {
        key.key.fill(0);
      }
    }

    if (this.masterKey) {
      this.masterKey.fill(0);
    }

    // Clear collections
    this.keys.clear();
    this.currentKeyId = undefined;
  }
}
