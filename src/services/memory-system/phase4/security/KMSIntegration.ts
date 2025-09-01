/**
 * KMS (Key Management Service) Integration
 * Phase 4.0 Security: Multi-cloud KMS integration for encryption key management
 * Supports AWS KMS, Azure Key Vault, GCP KMS, and HashiCorp Vault
 */

import { EventEmitter } from "node:events";
import * as crypto from "crypto";

export interface KMSConfig {
  provider: "aws" | "azure" | "gcp" | "vault" | "local";
  region?: string;
  credentials?: {
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    clientId?: string;
    clientSecret?: string;
    tenantId?: string;
    vaultUrl?: string;
    vaultToken?: string;
  };
  keyRotationEnabled: boolean;
  keyRotationIntervalDays: number;
  cacheEnabled: boolean;
  cacheTTLSeconds: number;
  auditEnabled: boolean;
  complianceMode?: "FIPS" | "HIPAA" | "PCI-DSS" | "SOC2";
}

export interface EncryptionKey {
  id: string;
  version: number;
  algorithm: "AES-256-GCM" | "AES-256-CBC" | "RSA-OAEP" | "ChaCha20-Poly1305";
  purpose: "encryption" | "signing" | "mac";
  createdAt: Date;
  rotatedAt?: Date;
  expiresAt?: Date;
  status: "active" | "pending" | "disabled" | "destroyed";
  metadata?: Record<string, any>;
}

export interface EncryptionContext {
  keyId: string;
  algorithm: string;
  purpose?: string;
  userId?: string;
  resourceId?: string;
  timestamp?: Date;
  additionalAuthenticatedData?: Buffer;
}

export interface EncryptedData {
  ciphertext: Buffer;
  iv: Buffer;
  authTag?: Buffer;
  keyId: string;
  keyVersion: number;
  algorithm: string;
  encryptedAt: Date;
  context?: EncryptionContext;
}

export interface KeyRotationPolicy {
  automaticRotation: boolean;
  rotationInterval: number; // days
  retainPreviousKeys: number; // number of old keys to retain
  notifyBeforeExpiry: number; // days before expiry
}

export interface AuditLog {
  id: string;
  timestamp: Date;
  operation:
    | "encrypt"
    | "decrypt"
    | "rotate"
    | "create"
    | "delete"
    | "grant"
    | "revoke";
  keyId: string;
  userId?: string;
  resourceId?: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * KMS Integration Service
 * Provides unified interface for multi-cloud key management
 */
export class KMSIntegration extends EventEmitter {
  private config: KMSConfig;
  private keys: Map<string, EncryptionKey> = new Map();
  private keyCache: Map<string, { key: Buffer; expires: Date }> = new Map();
  private auditLogs: AuditLog[] = [];
  private rotationSchedule: Map<string, NodeJS.Timeout> = new Map();

  // Provider-specific clients (would be actual SDK clients in production)
  private awsKMSClient: any = null;
  private azureKeyVaultClient: any = null;
  private gcpKMSClient: any = null;
  private vaultClient: any = null;

  private metrics = {
    encryptionOperations: 0,
    decryptionOperations: 0,
    keyRotations: 0,
    cacheHits: 0,
    cacheMisses: 0,
    errors: 0,
  };

  constructor(config: KMSConfig) {
    super();
    this.config = this.validateConfig(config);
    this.initializeProvider();
  }

  /**
   * Initialize KMS provider
   */
  private async initializeProvider(): Promise<void> {
    try {
      switch (this.config.provider) {
        case "aws":
          await this.initializeAWSKMS();
          break;
        case "azure":
          await this.initializeAzureKeyVault();
          break;
        case "gcp":
          await this.initializeGCPKMS();
          break;
        case "vault":
          await this.initializeHashiCorpVault();
          break;
        case "local":
          await this.initializeLocalKMS();
          break;
      }

      this.emit("provider_initialized", { provider: this.config.provider });

      // Set up key rotation if enabled
      if (this.config.keyRotationEnabled) {
        await this.setupKeyRotation();
      }
    } catch (error) {
      this.emit("initialization_error", error);
      throw error;
    }
  }

  /**
   * Create or import an encryption key
   */
  async createKey(
    options: {
      algorithm?: EncryptionKey["algorithm"];
      purpose?: EncryptionKey["purpose"];
      expiresInDays?: number;
      metadata?: Record<string, any>;
    } = {},
  ): Promise<EncryptionKey> {
    const keyId = crypto.randomUUID();
    const key: EncryptionKey = {
      id: keyId,
      version: 1,
      algorithm: options.algorithm || "AES-256-GCM",
      purpose: options.purpose || "encryption",
      createdAt: new Date(),
      status: "active",
      metadata: options.metadata,
    };

    if (options.expiresInDays) {
      key.expiresAt = new Date(
        Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000,
      );
    }

    try {
      // Create key in provider
      await this.createKeyInProvider(key);

      // Store key metadata
      this.keys.set(keyId, key);

      // Audit log
      this.auditOperation({
        operation: "create",
        keyId,
        success: true,
        metadata: options.metadata,
      });

      this.emit("key_created", { keyId });

      return key;
    } catch (error) {
      this.auditOperation({
        operation: "create",
        keyId,
        success: false,
        error: error instanceof Error ? error.message : "Key creation failed",
      });
      throw error;
    }
  }

  /**
   * Encrypt data using specified key
   */
  async encrypt(
    data: Buffer | string,
    keyId: string,
    context?: Partial<EncryptionContext>,
  ): Promise<EncryptedData> {
    const startTime = Date.now();

    try {
      const key = await this.getKey(keyId);
      if (!key || key.status !== "active") {
        throw new Error(`Key ${keyId} is not available for encryption`);
      }

      const plaintext = Buffer.isBuffer(data) ? data : Buffer.from(data);

      // Get encryption key material
      const keyMaterial = await this.getKeyMaterial(keyId);

      // Perform encryption based on algorithm
      let encrypted: EncryptedData;

      switch (key.algorithm) {
        case "AES-256-GCM":
          encrypted = await this.encryptAESGCM(
            plaintext,
            keyMaterial,
            key,
            context,
          );
          break;
        case "AES-256-CBC":
          encrypted = await this.encryptAESCBC(
            plaintext,
            keyMaterial,
            key,
            context,
          );
          break;
        case "ChaCha20-Poly1305":
          encrypted = await this.encryptChaCha20(
            plaintext,
            keyMaterial,
            key,
            context,
          );
          break;
        case "RSA-OAEP":
          encrypted = await this.encryptRSA(
            plaintext,
            keyMaterial,
            key,
            context,
          );
          break;
        default:
          throw new Error(`Unsupported algorithm: ${key.algorithm}`);
      }

      this.metrics.encryptionOperations++;

      // Audit log
      this.auditOperation({
        operation: "encrypt",
        keyId,
        success: true,
        metadata: {
          dataSize: plaintext.length,
          algorithm: key.algorithm,
          duration: Date.now() - startTime,
        },
      });

      this.emit("data_encrypted", {
        keyId,
        algorithm: key.algorithm,
        size: plaintext.length,
      });

      return encrypted;
    } catch (error) {
      this.metrics.errors++;
      this.auditOperation({
        operation: "encrypt",
        keyId,
        success: false,
        error: error instanceof Error ? error.message : "Encryption failed",
      });
      throw error;
    }
  }

  /**
   * Decrypt data
   */
  async decrypt(
    encryptedData: EncryptedData,
    context?: Partial<EncryptionContext>,
  ): Promise<Buffer> {
    const startTime = Date.now();

    try {
      const key = await this.getKey(encryptedData.keyId);
      if (!key) {
        throw new Error(`Key ${encryptedData.keyId} not found`);
      }

      // Get key material for the specific version
      const keyMaterial = await this.getKeyMaterial(
        encryptedData.keyId,
        encryptedData.keyVersion,
      );

      // Perform decryption based on algorithm
      let decrypted: Buffer;

      switch (encryptedData.algorithm) {
        case "AES-256-GCM":
          decrypted = await this.decryptAESGCM(
            encryptedData,
            keyMaterial,
            context,
          );
          break;
        case "AES-256-CBC":
          decrypted = await this.decryptAESCBC(
            encryptedData,
            keyMaterial,
            context,
          );
          break;
        case "ChaCha20-Poly1305":
          decrypted = await this.decryptChaCha20(
            encryptedData,
            keyMaterial,
            context,
          );
          break;
        case "RSA-OAEP":
          decrypted = await this.decryptRSA(
            encryptedData,
            keyMaterial,
            context,
          );
          break;
        default:
          throw new Error(`Unsupported algorithm: ${encryptedData.algorithm}`);
      }

      this.metrics.decryptionOperations++;

      // Audit log
      this.auditOperation({
        operation: "decrypt",
        keyId: encryptedData.keyId,
        success: true,
        metadata: {
          algorithm: encryptedData.algorithm,
          duration: Date.now() - startTime,
        },
      });

      this.emit("data_decrypted", {
        keyId: encryptedData.keyId,
        algorithm: encryptedData.algorithm,
      });

      return decrypted;
    } catch (error) {
      this.metrics.errors++;
      this.auditOperation({
        operation: "decrypt",
        keyId: encryptedData.keyId,
        success: false,
        error: error instanceof Error ? error.message : "Decryption failed",
      });
      throw error;
    }
  }

  /**
   * Rotate encryption key
   */
  async rotateKey(keyId: string): Promise<EncryptionKey> {
    const existingKey = this.keys.get(keyId);
    if (!existingKey) {
      throw new Error(`Key ${keyId} not found`);
    }

    try {
      // Create new version
      const newVersion = existingKey.version + 1;

      // Rotate key in provider
      await this.rotateKeyInProvider(keyId);

      // Update key metadata
      existingKey.version = newVersion;
      existingKey.rotatedAt = new Date();

      // Invalidate cache
      this.keyCache.delete(keyId);

      this.metrics.keyRotations++;

      // Audit log
      this.auditOperation({
        operation: "rotate",
        keyId,
        success: true,
        metadata: {
          oldVersion: newVersion - 1,
          newVersion,
        },
      });

      this.emit("key_rotated", {
        keyId,
        newVersion,
        rotatedAt: existingKey.rotatedAt,
      });

      return existingKey;
    } catch (error) {
      this.auditOperation({
        operation: "rotate",
        keyId,
        success: false,
        error: error instanceof Error ? error.message : "Key rotation failed",
      });
      throw error;
    }
  }

  /**
   * Get audit logs
   */
  getAuditLogs(filters?: {
    keyId?: string;
    operation?: AuditLog["operation"];
    startDate?: Date;
    endDate?: Date;
    success?: boolean;
  }): AuditLog[] {
    let logs = [...this.auditLogs];

    if (filters) {
      if (filters.keyId) {
        logs = logs.filter((log) => log.keyId === filters.keyId);
      }
      if (filters.operation) {
        logs = logs.filter((log) => log.operation === filters.operation);
      }
      if (filters.startDate) {
        logs = logs.filter((log) => log.timestamp >= filters.startDate!);
      }
      if (filters.endDate) {
        logs = logs.filter((log) => log.timestamp <= filters.endDate!);
      }
      if (filters.success !== undefined) {
        logs = logs.filter((log) => log.success === filters.success);
      }
    }

    return logs;
  }

  /**
   * Get metrics
   */
  getMetrics(): typeof this.metrics & {
    cacheHitRate: number;
    errorRate: number;
  } {
    const totalCacheAccess = this.metrics.cacheHits + this.metrics.cacheMisses;
    const totalOperations =
      this.metrics.encryptionOperations + this.metrics.decryptionOperations;

    return {
      ...this.metrics,
      cacheHitRate:
        totalCacheAccess > 0 ? this.metrics.cacheHits / totalCacheAccess : 0,
      errorRate:
        totalOperations > 0 ? this.metrics.errors / totalOperations : 0,
    };
  }

  /**
   * Private helper methods
   */
  private validateConfig(config: KMSConfig): KMSConfig {
    if (!config.provider) {
      throw new Error("KMS provider is required");
    }

    return {
      ...config,
      keyRotationIntervalDays: config.keyRotationIntervalDays || 90,
      cacheTTLSeconds: config.cacheTTLSeconds || 3600,
      auditEnabled: config.auditEnabled !== false,
    };
  }

  private async initializeAWSKMS(): Promise<void> {
    // In production, initialize AWS KMS client
    this.emit("provider_specific_init", { provider: "aws" });
  }

  private async initializeAzureKeyVault(): Promise<void> {
    // In production, initialize Azure Key Vault client
    this.emit("provider_specific_init", { provider: "azure" });
  }

  private async initializeGCPKMS(): Promise<void> {
    // In production, initialize GCP KMS client
    this.emit("provider_specific_init", { provider: "gcp" });
  }

  private async initializeHashiCorpVault(): Promise<void> {
    // In production, initialize HashiCorp Vault client
    this.emit("provider_specific_init", { provider: "vault" });
  }

  private async initializeLocalKMS(): Promise<void> {
    // Local key management for development/testing
    this.emit("provider_specific_init", { provider: "local" });
  }

  private async setupKeyRotation(): Promise<void> {
    for (const [keyId, key] of this.keys) {
      if (key.status === "active") {
        const interval =
          this.config.keyRotationIntervalDays * 24 * 60 * 60 * 1000;
        const timeout = setTimeout(() => {
          this.rotateKey(keyId).catch((err) =>
            this.emit("rotation_error", { keyId, error: err }),
          );
        }, interval);

        this.rotationSchedule.set(keyId, timeout);
      }
    }
  }

  private async getKey(keyId: string): Promise<EncryptionKey | undefined> {
    return this.keys.get(keyId);
  }

  private async getKeyMaterial(
    keyId: string,
    version?: number,
  ): Promise<Buffer> {
    // Check cache
    const cacheKey = `${keyId}:${version || "latest"}`;
    const cached = this.keyCache.get(cacheKey);

    if (cached && cached.expires > new Date()) {
      this.metrics.cacheHits++;
      return cached.key;
    }

    this.metrics.cacheMisses++;

    // Fetch from provider
    const keyMaterial = await this.fetchKeyMaterialFromProvider(keyId, version);

    // Cache if enabled
    if (this.config.cacheEnabled) {
      this.keyCache.set(cacheKey, {
        key: keyMaterial,
        expires: new Date(Date.now() + this.config.cacheTTLSeconds * 1000),
      });
    }

    return keyMaterial;
  }

  private async fetchKeyMaterialFromProvider(
    keyId: string,
    version?: number,
  ): Promise<Buffer> {
    // In production, fetch from actual KMS provider
    // For now, generate a deterministic key for testing
    const seed = `${keyId}:${version || 1}:${this.config.provider}`;
    return crypto.createHash("sha256").update(seed).digest();
  }

  private async createKeyInProvider(key: EncryptionKey): Promise<void> {
    // In production, create key in actual KMS provider
    this.emit("key_created_in_provider", { keyId: key.id });
  }

  private async rotateKeyInProvider(keyId: string): Promise<void> {
    // In production, rotate key in actual KMS provider
    this.emit("key_rotated_in_provider", { keyId });
  }

  private async encryptAESGCM(
    plaintext: Buffer,
    key: Buffer,
    keyMetadata: EncryptionKey,
    context?: Partial<EncryptionContext>,
  ): Promise<EncryptedData> {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

    if (context?.additionalAuthenticatedData) {
      cipher.setAAD(context.additionalAuthenticatedData);
    }

    const ciphertext = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return {
      ciphertext,
      iv,
      authTag,
      keyId: keyMetadata.id,
      keyVersion: keyMetadata.version,
      algorithm: "AES-256-GCM",
      encryptedAt: new Date(),
      context: context as EncryptionContext,
    };
  }

  private async decryptAESGCM(
    encryptedData: EncryptedData,
    key: Buffer,
    context?: Partial<EncryptionContext>,
  ): Promise<Buffer> {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      encryptedData.iv,
    );

    if (encryptedData.authTag) {
      decipher.setAuthTag(encryptedData.authTag);
    }

    if (context?.additionalAuthenticatedData) {
      decipher.setAAD(context.additionalAuthenticatedData);
    }

    return Buffer.concat([
      decipher.update(encryptedData.ciphertext),
      decipher.final(),
    ]);
  }

  private async encryptAESCBC(
    plaintext: Buffer,
    key: Buffer,
    keyMetadata: EncryptionKey,
    context?: Partial<EncryptionContext>,
  ): Promise<EncryptedData> {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);

    const ciphertext = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
    ]);

    return {
      ciphertext,
      iv,
      keyId: keyMetadata.id,
      keyVersion: keyMetadata.version,
      algorithm: "AES-256-CBC",
      encryptedAt: new Date(),
      context: context as EncryptionContext,
    };
  }

  private async decryptAESCBC(
    encryptedData: EncryptedData,
    key: Buffer,
    context?: Partial<EncryptionContext>,
  ): Promise<Buffer> {
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      key,
      encryptedData.iv,
    );

    return Buffer.concat([
      decipher.update(encryptedData.ciphertext),
      decipher.final(),
    ]);
  }

  private async encryptChaCha20(
    plaintext: Buffer,
    key: Buffer,
    keyMetadata: EncryptionKey,
    context?: Partial<EncryptionContext>,
  ): Promise<EncryptedData> {
    // ChaCha20-Poly1305 implementation
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(
      "chacha20-poly1305",
      key.slice(0, 32),
      iv,
    );

    if (context?.additionalAuthenticatedData) {
      cipher.setAAD(context.additionalAuthenticatedData);
    }

    const ciphertext = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return {
      ciphertext,
      iv,
      authTag,
      keyId: keyMetadata.id,
      keyVersion: keyMetadata.version,
      algorithm: "ChaCha20-Poly1305",
      encryptedAt: new Date(),
      context: context as EncryptionContext,
    };
  }

  private async decryptChaCha20(
    encryptedData: EncryptedData,
    key: Buffer,
    context?: Partial<EncryptionContext>,
  ): Promise<Buffer> {
    const decipher = crypto.createDecipheriv(
      "chacha20-poly1305",
      key.slice(0, 32),
      encryptedData.iv,
    );

    if (encryptedData.authTag) {
      decipher.setAuthTag(encryptedData.authTag);
    }

    if (context?.additionalAuthenticatedData) {
      decipher.setAAD(context.additionalAuthenticatedData);
    }

    return Buffer.concat([
      decipher.update(encryptedData.ciphertext),
      decipher.final(),
    ]);
  }

  private async encryptRSA(
    plaintext: Buffer,
    key: Buffer,
    keyMetadata: EncryptionKey,
    context?: Partial<EncryptionContext>,
  ): Promise<EncryptedData> {
    // RSA encryption (simplified for demonstration)
    // In production, use proper RSA key pair
    const ciphertext = crypto.publicEncrypt(
      {
        key: key.toString(),
        oaepHash: "sha256",
      },
      plaintext,
    );

    return {
      ciphertext,
      iv: Buffer.alloc(0), // RSA doesn't use IV
      keyId: keyMetadata.id,
      keyVersion: keyMetadata.version,
      algorithm: "RSA-OAEP",
      encryptedAt: new Date(),
      context: context as EncryptionContext,
    };
  }

  private async decryptRSA(
    encryptedData: EncryptedData,
    key: Buffer,
    context?: Partial<EncryptionContext>,
  ): Promise<Buffer> {
    // RSA decryption (simplified for demonstration)
    return crypto.privateDecrypt(
      {
        key: key.toString(),
        oaepHash: "sha256",
      },
      encryptedData.ciphertext,
    );
  }

  private auditOperation(log: Omit<AuditLog, "id" | "timestamp">): void {
    if (!this.config.auditEnabled) return;

    const auditLog: AuditLog = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ...log,
    };

    this.auditLogs.push(auditLog);

    // Emit audit event
    this.emit("audit_log", auditLog);

    // In production, also send to external audit system
    if (log.success === false) {
      this.emit("security_alert", {
        type: "operation_failed",
        log: auditLog,
      });
    }
  }
}

/**
 * Factory function to create KMS integration
 */
export function createKMSIntegration(config: KMSConfig): KMSIntegration {
  return new KMSIntegration(config);
}
