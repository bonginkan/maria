/**
 * AWS KMS Provider Implementation
 * Implements IKeyProvider for AWS Key Management Service
 */

import {
  IKeyProvider,
  KeyContext,
  DataKey,
  KeyUsageAudit,
  KeyNotFoundError,
  AccessDeniedError,
  KeyRotationError,
} from "../ports/IKeyProvider.js";

// Mock AWS KMS SDK types (would be from @aws-sdk/client-kms in real implementation)
interface KMSClientConfig {
  region: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };
}

interface GenerateDataKeyCommand {
  KeyId: string;
  KeySpec: string;
  EncryptionContext?: Record<string, string>;
}

interface DecryptCommand {
  CiphertextBlob: Uint8Array;
  EncryptionContext?: Record<string, string>;
}

interface DescribeKeyCommand {
  KeyId: string;
}

interface ScheduleKeyDeletionCommand {
  KeyId: string;
  PendingWindowInDays: number;
}

// Mock KMS Client (would be KMSClient from AWS SDK)
class MockKMSClient {
  constructor(private config: KMSClientConfig) {}

  async send(command: any): Promise<any> {
    // Mock implementation for development/testing
    if (command.constructor.name === "GenerateDataKeyCommand") {
      return {
        Plaintext: new Uint8Array(32), // 256-bit key
        CiphertextBlob: new Uint8Array(64), // Encrypted key
        KeyId: command.KeyId,
      };
    }
    // Add other command implementations as needed
    throw new Error("Mock implementation");
  }
}

export class AWSKMSProvider implements IKeyProvider {
  private client: MockKMSClient;
  private auditCallback?: (audit: KeyUsageAudit) => Promise<void>;

  constructor(
    config: KMSClientConfig,
    auditCallback?: (audit: KeyUsageAudit) => Promise<void>,
  ) {
    this.client = new MockKMSClient(config);
    this.auditCallback = auditCallback;
  }

  async getEncryptionKey(keyId: string, context: KeyContext): Promise<Buffer> {
    const startTime = Date.now();

    try {
      // Generate a data key for encryption
      const dataKey = await this.generateDataKey(keyId, "AES_256", context);

      await this.recordAudit({
        keyId,
        correlationId: context.correlationId,
        operation: "encrypt",
        timestamp: new Date(),
        userId: context.userId,
        dataClassification: context.dataClassification,
        success: true,
        metadata: {
          purpose: context.purpose,
          latency: Date.now() - startTime,
        },
      });

      return dataKey.plaintext;
    } catch (error) {
      await this.recordAudit({
        keyId,
        correlationId: context.correlationId,
        operation: "encrypt",
        timestamp: new Date(),
        userId: context.userId,
        dataClassification: context.dataClassification,
        success: false,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        metadata: {
          purpose: context.purpose,
          latency: Date.now() - startTime,
        },
      });

      if (error instanceof Error && error.message.includes("not found")) {
        throw new KeyNotFoundError(keyId);
      }
      if (error instanceof Error && error.message.includes("access denied")) {
        throw new AccessDeniedError(keyId, context.userId);
      }
      throw error;
    }
  }

  async generateDataKey(
    keyId: string,
    keySpec: "AES_256",
    context: KeyContext,
  ): Promise<DataKey> {
    const startTime = Date.now();

    try {
      const command = {
        KeyId: keyId,
        KeySpec: keySpec,
        EncryptionContext: this.buildEncryptionContext(context),
      } as GenerateDataKeyCommand;

      const result = await this.client.send(command);

      const dataKey: DataKey = {
        plaintext: Buffer.from(result.Plaintext),
        ciphertext: Buffer.from(result.CiphertextBlob),
        keyId: result.KeyId,
        algorithm: "AES_256",
        createdAt: new Date(),
      };

      await this.recordAudit({
        keyId,
        correlationId: context.correlationId,
        operation: "generate",
        timestamp: new Date(),
        userId: context.userId,
        dataClassification: context.dataClassification,
        success: true,
        metadata: {
          purpose: context.purpose,
          keySpec,
          latency: Date.now() - startTime,
        },
      });

      return dataKey;
    } catch (error) {
      await this.recordAudit({
        keyId,
        correlationId: context.correlationId,
        operation: "generate",
        timestamp: new Date(),
        userId: context.userId,
        dataClassification: context.dataClassification,
        success: false,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        metadata: {
          purpose: context.purpose,
          keySpec,
          latency: Date.now() - startTime,
        },
      });
      throw error;
    }
  }

  async decryptDataKey(
    ciphertext: Buffer,
    context: KeyContext,
  ): Promise<Buffer> {
    const startTime = Date.now();

    try {
      const command = {
        CiphertextBlob: new Uint8Array(ciphertext),
        EncryptionContext: this.buildEncryptionContext(context),
      } as DecryptCommand;

      const result = await this.client.send(command);

      await this.recordAudit({
        keyId: "unknown", // AWS doesn't return key ID in decrypt
        correlationId: context.correlationId,
        operation: "decrypt",
        timestamp: new Date(),
        userId: context.userId,
        dataClassification: context.dataClassification,
        success: true,
        metadata: {
          purpose: context.purpose,
          latency: Date.now() - startTime,
        },
      });

      return Buffer.from(result.Plaintext);
    } catch (error) {
      await this.recordAudit({
        keyId: "unknown",
        correlationId: context.correlationId,
        operation: "decrypt",
        timestamp: new Date(),
        userId: context.userId,
        dataClassification: context.dataClassification,
        success: false,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        metadata: {
          purpose: context.purpose,
          latency: Date.now() - startTime,
        },
      });
      throw error;
    }
  }

  async rotateKey(keyId: string, context: KeyContext): Promise<string> {
    const startTime = Date.now();

    try {
      // AWS KMS automatic key rotation doesn't return new key ID
      // This is a conceptual implementation
      const newKeyId = `${keyId}-rotated-${Date.now()}`;

      await this.recordAudit({
        keyId,
        correlationId: context.correlationId,
        operation: "rotate",
        timestamp: new Date(),
        userId: context.userId,
        dataClassification: context.dataClassification,
        success: true,
        metadata: {
          purpose: context.purpose,
          newKeyId,
          latency: Date.now() - startTime,
        },
      });

      return newKeyId;
    } catch (error) {
      await this.recordAudit({
        keyId,
        correlationId: context.correlationId,
        operation: "rotate",
        timestamp: new Date(),
        userId: context.userId,
        dataClassification: context.dataClassification,
        success: false,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        metadata: {
          purpose: context.purpose,
          latency: Date.now() - startTime,
        },
      });

      throw new KeyRotationError(
        keyId,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  async auditKeyUsage(audit: KeyUsageAudit): Promise<void> {
    return this.recordAudit(audit);
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    latency: number;
    errorRate: number;
    lastError?: string;
  }> {
    const startTime = Date.now();

    try {
      // Simple health check by describing a known key
      const result = await this.client.send({
        KeyId: "alias/aws/s3",
      } as DescribeKeyCommand);

      return {
        healthy: true,
        latency: Date.now() - startTime,
        errorRate: 0,
      };
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - startTime,
        errorRate: 1,
        lastError: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async listKeys(context: KeyContext): Promise<
    {
      keyId: string;
      description: string;
      algorithm: string;
      status: "active" | "pending_deletion" | "disabled";
      createdAt: Date;
      rotatedAt?: Date;
    }[]
  > {
    // Mock implementation - would use AWS KMS ListKeys API
    return [
      {
        keyId:
          "arn:aws:kms:us-east-1:123456789012:key/12345678-1234-1234-1234-123456789012",
        description: "Maria multimodal data encryption key",
        algorithm: "SYMMETRIC_DEFAULT",
        status: "active",
        createdAt: new Date("2024-01-01"),
        rotatedAt: new Date("2024-06-01"),
      },
    ];
  }

  private buildEncryptionContext(context: KeyContext): Record<string, string> {
    return {
      correlationId: context.correlationId,
      purpose: context.purpose,
      dataClassification: context.dataClassification,
      ...(context.userId && { userId: context.userId }),
      ...(context.retentionPolicy && {
        retentionPolicy: context.retentionPolicy,
      }),
      ...context.additionalContext,
    };
  }

  private async recordAudit(audit: KeyUsageAudit): Promise<void> {
    if (this.auditCallback) {
      try {
        await this.auditCallback(audit);
      } catch (error) {
        // Log audit failure but don't fail the main operation
        console.error("Failed to record audit:", error);
      }
    }
  }
}
