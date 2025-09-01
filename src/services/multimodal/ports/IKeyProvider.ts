/**
 * KeyProvider Interface for KMS Abstraction
 * Provides multi-cloud KMS support (AWS, GCP, Vault) with unified interface
 *
 * Security Features:
 * - AES-256-GCM key management
 * - Audit trail integration
 * - Key rotation support
 * - Context-aware encryption
 */

export interface KeyContext {
  readonly correlationId: string;
  readonly userId?: string;
  readonly operation: "encrypt" | "decrypt" | "generate" | "rotate";
  readonly dataClassification:
    | "public"
    | "internal"
    | "confidential"
    | "restricted";
  readonly purpose: string;
  readonly retentionPolicy?: string;
  readonly additionalContext?: Record<string, string>;
}

export interface DataKey {
  readonly plaintext: Buffer;
  readonly ciphertext: Buffer;
  readonly keyId: string;
  readonly algorithm: "AES_256";
  readonly createdAt: Date;
}

export interface KeyUsageAudit {
  readonly keyId: string;
  readonly correlationId: string;
  readonly operation: "encrypt" | "decrypt" | "generate" | "rotate";
  readonly timestamp: Date;
  readonly userId?: string;
  readonly dataClassification: string;
  readonly success: boolean;
  readonly errorMessage?: string;
  readonly metadata: Record<string, unknown>;
}

export interface IKeyProvider {
  /**
   * Retrieves an encryption key by ID with context
   * @param keyId - Unique identifier for the key
   * @param context - Context for audit and access control
   * @returns Promise resolving to the encryption key
   * @throws {KeyNotFoundError} When key doesn't exist
   * @throws {AccessDeniedError} When access is denied
   */
  getEncryptionKey(keyId: string, context: KeyContext): Promise<Buffer>;

  /**
   * Generates a new data key for encryption
   * @param keyId - Master key identifier
   * @param keySpec - Key specification (only AES_256 supported)
   * @param context - Context for audit and access control
   * @returns Promise resolving to plaintext and ciphertext key pair
   */
  generateDataKey(
    keyId: string,
    keySpec: "AES_256",
    context: KeyContext,
  ): Promise<DataKey>;

  /**
   * Decrypts a data key ciphertext
   * @param ciphertext - Encrypted data key
   * @param context - Context for audit and access control
   * @returns Promise resolving to plaintext key
   */
  decryptDataKey(ciphertext: Buffer, context: KeyContext): Promise<Buffer>;

  /**
   * Rotates a master key and returns new key ID
   * @param keyId - Current key identifier
   * @param context - Context for audit and access control
   * @returns Promise resolving to new key identifier
   */
  rotateKey(keyId: string, context: KeyContext): Promise<string>;

  /**
   * Records key usage for audit trails
   * @param audit - Audit information to record
   * @returns Promise resolving when audit is recorded
   */
  auditKeyUsage(audit: KeyUsageAudit): Promise<void>;

  /**
   * Health check for the key provider
   * @returns Promise resolving to health status
   */
  healthCheck(): Promise<{
    healthy: boolean;
    latency: number;
    errorRate: number;
    lastError?: string;
  }>;

  /**
   * Lists available keys with metadata
   * @param context - Context for access control
   * @returns Promise resolving to key metadata list
   */
  listKeys(context: KeyContext): Promise<
    {
      keyId: string;
      description: string;
      algorithm: string;
      status: "active" | "pending_deletion" | "disabled";
      createdAt: Date;
      rotatedAt?: Date;
    }[]
  >;
}

export class KeyNotFoundError extends Error {
  constructor(keyId: string) {
    super(`Key not found: ${keyId}`);
    this.name = "KeyNotFoundError";
  }
}

export class AccessDeniedError extends Error {
  constructor(keyId: string, userId?: string) {
    super(
      `Access denied for key ${keyId}${userId ? ` by user ${userId}` : ""}`,
    );
    this.name = "AccessDeniedError";
  }
}

export class KeyRotationError extends Error {
  constructor(keyId: string, reason: string) {
    super(`Failed to rotate key ${keyId}: ${reason}`);
    this.name = "KeyRotationError";
  }
}
