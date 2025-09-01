/**
 * Secure Data Porter - AES-256-GCM Implementation
 * Replaces insecure crypto.createCipher with industry-standard AES-256-GCM
 *
 * Security Features:
 * - AES-256-GCM authenticated encryption
 * - KMS integration for key management
 * - GDPR/HIPAA compliant data handling
 * - Comprehensive audit logging
 */

import { createCipherGCM, createDecipherGCM, randomBytes } from "crypto";
import { IKeyProvider, KeyContext } from "../ports/IKeyProvider.js";
import { AuditTrailManager } from "./AuditTrailManager.js";

export interface EncryptionResult {
  readonly ciphertext: Buffer;
  readonly iv: Buffer;
  readonly authTag: Buffer;
  readonly keyId: string;
  readonly algorithm: "aes-256-gcm";
  readonly timestamp: Date;
  readonly correlationId: string;
}

export interface DecryptionContext extends KeyContext {
  readonly iv: Buffer;
  readonly authTag: Buffer;
  readonly keyId: string;
  readonly algorithm: "aes-256-gcm";
}

export interface SecureDataPorterOptions {
  readonly keyProvider: IKeyProvider;
  readonly auditTrail: AuditTrailManager;
  readonly defaultKeyId: string;
  readonly compressionThreshold?: number; // bytes
  readonly maxDataSize?: number; // bytes
}

export class SecureDataPorter {
  private static readonly ALGORITHM = "aes-256-gcm";
  private static readonly IV_LENGTH = 12; // 96 bits for GCM
  private static readonly TAG_LENGTH = 16; // 128 bits authentication tag
  private static readonly KEY_LENGTH = 32; // 256 bits

  constructor(private readonly options: SecureDataPorterOptions) {
    this.validateOptions();
  }

  /**
   * Encrypts data using AES-256-GCM with KMS-managed keys
   * @param data - Data to encrypt
   * @param context - Encryption context for audit and access control
   * @param keyId - Optional key ID (uses default if not provided)
   * @returns Promise resolving to encryption result
   */
  async encryptData(
    data: Buffer,
    context: KeyContext,
    keyId?: string,
  ): Promise<EncryptionResult> {
    const startTime = Date.now();
    const actualKeyId = keyId ?? this.options.defaultKeyId;

    try {
      // Validate input
      this.validateEncryptionInput(data, context);

      // Get encryption key from KMS
      const encryptionKey = await this.options.keyProvider.getEncryptionKey(
        actualKeyId,
        {
          ...context,
          operation: "encrypt",
        },
      );

      // Generate IV (nonce) for GCM mode
      const iv = randomBytes(SecureDataPorter.IV_LENGTH);

      // Create cipher
      const cipher = createCipherGCM(
        SecureDataPorter.ALGORITHM,
        encryptionKey,
        iv,
      );

      // Encrypt data
      const ciphertext = cipher.update(data);
      cipher.final();

      // Get authentication tag
      const authTag = cipher.getAuthTag();

      const result: EncryptionResult = {
        ciphertext,
        iv,
        authTag,
        keyId: actualKeyId,
        algorithm: "aes-256-gcm",
        timestamp: new Date(),
        correlationId: context.correlationId,
      };

      // Audit successful encryption
      await this.options.auditTrail.recordDataOperation({
        correlationId: context.correlationId,
        operation: "encrypt",
        dataSize: data.length,
        dataClassification: context.dataClassification,
        userId: context.userId,
        keyId: actualKeyId,
        success: true,
        duration: Date.now() - startTime,
        metadata: {
          algorithm: SecureDataPorter.ALGORITHM,
          ivLength: iv.length,
          tagLength: authTag.length,
          purpose: context.purpose,
        },
      });

      // Clear encryption key from memory
      encryptionKey.fill(0);

      return result;
    } catch (error) {
      // Audit failed encryption
      await this.options.auditTrail.recordDataOperation({
        correlationId: context.correlationId,
        operation: "encrypt",
        dataSize: data.length,
        dataClassification: context.dataClassification,
        userId: context.userId,
        keyId: actualKeyId,
        success: false,
        duration: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        metadata: {
          purpose: context.purpose,
        },
      });

      throw new EncryptionError(
        `Failed to encrypt data: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Decrypts data encrypted with AES-256-GCM
   * @param encryptionResult - Result from encryptData operation
   * @param context - Decryption context
   * @returns Promise resolving to decrypted data
   */
  async decryptData(
    encryptionResult: EncryptionResult,
    context: DecryptionContext,
  ): Promise<Buffer> {
    const startTime = Date.now();

    try {
      // Validate input
      this.validateDecryptionInput(encryptionResult, context);

      // Get decryption key from KMS
      const decryptionKey = await this.options.keyProvider.getEncryptionKey(
        encryptionResult.keyId,
        {
          ...context,
          operation: "decrypt",
        },
      );

      // Create decipher
      const decipher = createDecipherGCM(
        SecureDataPorter.ALGORITHM,
        decryptionKey,
        encryptionResult.iv,
      );

      // Set authentication tag
      decipher.setAuthTag(encryptionResult.authTag);

      // Decrypt data
      const plaintext = decipher.update(encryptionResult.ciphertext);
      decipher.final(); // Verifies authentication tag

      // Audit successful decryption
      await this.options.auditTrail.recordDataOperation({
        correlationId: context.correlationId,
        operation: "decrypt",
        dataSize: plaintext.length,
        dataClassification: context.dataClassification,
        userId: context.userId,
        keyId: encryptionResult.keyId,
        success: true,
        duration: Date.now() - startTime,
        metadata: {
          algorithm: encryptionResult.algorithm,
          originalCorrelationId: encryptionResult.correlationId,
          purpose: context.purpose,
        },
      });

      // Clear decryption key from memory
      decryptionKey.fill(0);

      return plaintext;
    } catch (error) {
      // Audit failed decryption
      await this.options.auditTrail.recordDataOperation({
        correlationId: context.correlationId,
        operation: "decrypt",
        dataSize: 0,
        dataClassification: context.dataClassification,
        userId: context.userId,
        keyId: encryptionResult.keyId,
        success: false,
        duration: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        metadata: {
          originalCorrelationId: encryptionResult.correlationId,
          purpose: context.purpose,
        },
      });

      throw new DecryptionError(
        `Failed to decrypt data: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Securely wipes encryption result from memory
   * @param result - Encryption result to wipe
   */
  static wipeEncryptionResult(result: EncryptionResult): void {
    result.ciphertext.fill(0);
    result.iv.fill(0);
    result.authTag.fill(0);
  }

  /**
   * Validates encryption input parameters
   */
  private validateEncryptionInput(data: Buffer, context: KeyContext): void {
    if (!Buffer.isBuffer(data)) {
      throw new ValidationError("Data must be a Buffer");
    }

    if (data.length === 0) {
      throw new ValidationError("Data cannot be empty");
    }

    if (this.options.maxDataSize && data.length > this.options.maxDataSize) {
      throw new ValidationError(
        `Data size ${data.length} exceeds maximum ${this.options.maxDataSize} bytes`,
      );
    }

    if (!context.correlationId) {
      throw new ValidationError("Correlation ID is required");
    }

    if (!context.purpose) {
      throw new ValidationError("Purpose is required for audit compliance");
    }

    if (!context.dataClassification) {
      throw new ValidationError("Data classification is required");
    }
  }

  /**
   * Validates decryption input parameters
   */
  private validateDecryptionInput(
    encryptionResult: EncryptionResult,
    context: DecryptionContext,
  ): void {
    if (
      !encryptionResult.ciphertext ||
      !Buffer.isBuffer(encryptionResult.ciphertext)
    ) {
      throw new ValidationError("Invalid ciphertext");
    }

    if (
      !encryptionResult.iv ||
      encryptionResult.iv.length !== SecureDataPorter.IV_LENGTH
    ) {
      throw new ValidationError("Invalid IV");
    }

    if (
      !encryptionResult.authTag ||
      encryptionResult.authTag.length !== SecureDataPorter.TAG_LENGTH
    ) {
      throw new ValidationError("Invalid authentication tag");
    }

    if (encryptionResult.algorithm !== "aes-256-gcm") {
      throw new ValidationError("Unsupported algorithm");
    }

    if (!context.correlationId) {
      throw new ValidationError("Correlation ID is required");
    }
  }

  /**
   * Validates constructor options
   */
  private validateOptions(): void {
    if (!this.options.keyProvider) {
      throw new ValidationError("Key provider is required");
    }

    if (!this.options.auditTrail) {
      throw new ValidationError("Audit trail manager is required");
    }

    if (!this.options.defaultKeyId) {
      throw new ValidationError("Default key ID is required");
    }
  }
}

export class EncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EncryptionError";
  }
}

export class DecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecryptionError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
