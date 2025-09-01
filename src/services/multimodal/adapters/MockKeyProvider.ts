/**
 * Mock Key Provider Implementation
 * For testing and development environments
 * Implements IKeyProvider with in-memory key management
 */

import { randomBytes, createCipher, createDecipher } from "crypto";
import {
  IKeyProvider,
  KeyContext,
  DataKey,
  KeyUsageAudit,
  KeyNotFoundError,
  AccessDeniedError,
  KeyRotationError,
} from "../ports/IKeyProvider.js";

interface MockKey {
  keyId: string;
  description: string;
  algorithm: string;
  status: "active" | "pending_deletion" | "disabled";
  createdAt: Date;
  rotatedAt?: Date;
  masterKey: Buffer;
}

export class MockKeyProvider implements IKeyProvider {
  private keys: Map<string, MockKey> = new Map();
  private auditLogs: KeyUsageAudit[] = [];
  private errorRate: number = 0;
  private simulateLatency: boolean = true;

  constructor(options?: {
    errorRate?: number;
    simulateLatency?: boolean;
    initialKeys?: string[];
  }) {
    this.errorRate = options?.errorRate ?? 0;
    this.simulateLatency = options?.simulateLatency ?? true;

    // Create initial keys
    const initialKeys = options?.initialKeys ?? ["test-key-1", "test-key-2"];
    for (const keyId of initialKeys) {
      this.keys.set(keyId, {
        keyId,
        description: `Mock key for testing: ${keyId}`,
        algorithm: "AES_256",
        status: "active",
        createdAt: new Date(),
        masterKey: randomBytes(32), // 256-bit key
      });
    }
  }

  async getEncryptionKey(keyId: string, context: KeyContext): Promise<Buffer> {
    await this.simulateDelay();
    this.maybeThrowError();

    const key = this.keys.get(keyId);
    if (!key) {
      await this.recordAudit({
        keyId,
        correlationId: context.correlationId,
        operation: "encrypt",
        timestamp: new Date(),
        userId: context.userId,
        dataClassification: context.dataClassification,
        success: false,
        errorMessage: "Key not found",
        metadata: { provider: "mock" },
      });
      throw new KeyNotFoundError(keyId);
    }

    if (key.status !== "active") {
      await this.recordAudit({
        keyId,
        correlationId: context.correlationId,
        operation: "encrypt",
        timestamp: new Date(),
        userId: context.userId,
        dataClassification: context.dataClassification,
        success: false,
        errorMessage: "Key not active",
        metadata: { provider: "mock", keyStatus: key.status },
      });
      throw new AccessDeniedError(keyId, context.userId);
    }

    // Generate a data key
    const dataKey = randomBytes(32);

    await this.recordAudit({
      keyId,
      correlationId: context.correlationId,
      operation: "encrypt",
      timestamp: new Date(),
      userId: context.userId,
      dataClassification: context.dataClassification,
      success: true,
      metadata: { provider: "mock", purpose: context.purpose },
    });

    return dataKey;
  }

  async generateDataKey(
    keyId: string,
    keySpec: "AES_256",
    context: KeyContext,
  ): Promise<DataKey> {
    await this.simulateDelay();
    this.maybeThrowError();

    const key = this.keys.get(keyId);
    if (!key) {
      throw new KeyNotFoundError(keyId);
    }

    if (key.status !== "active") {
      throw new AccessDeniedError(keyId, context.userId);
    }

    // Generate plaintext data key
    const plaintext = randomBytes(32); // 256-bit key

    // "Encrypt" the data key with master key (simplified for mock)
    const cipher = createCipher("aes-256-cbc", key.masterKey);
    let ciphertext = cipher.update(plaintext);
    ciphertext = Buffer.concat([ciphertext, cipher.final()]);

    const dataKey: DataKey = {
      plaintext,
      ciphertext,
      keyId,
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
      metadata: { provider: "mock", keySpec, purpose: context.purpose },
    });

    return dataKey;
  }

  async decryptDataKey(
    ciphertext: Buffer,
    context: KeyContext,
  ): Promise<Buffer> {
    await this.simulateDelay();
    this.maybeThrowError();

    // In a real implementation, we'd need to identify which key was used
    // For mock purposes, try each active key
    for (const [keyId, key] of this.keys) {
      if (key.status !== "active") continue;

      try {
        const decipher = createDecipher("aes-256-cbc", key.masterKey);
        let plaintext = decipher.update(ciphertext);
        plaintext = Buffer.concat([plaintext, decipher.final()]);

        await this.recordAudit({
          keyId,
          correlationId: context.correlationId,
          operation: "decrypt",
          timestamp: new Date(),
          userId: context.userId,
          dataClassification: context.dataClassification,
          success: true,
          metadata: { provider: "mock", purpose: context.purpose },
        });

        return plaintext;
      } catch {
        // Try next key
        continue;
      }
    }

    await this.recordAudit({
      keyId: "unknown",
      correlationId: context.correlationId,
      operation: "decrypt",
      timestamp: new Date(),
      userId: context.userId,
      dataClassification: context.dataClassification,
      success: false,
      errorMessage: "Unable to decrypt data key",
      metadata: { provider: "mock" },
    });

    throw new Error("Unable to decrypt data key");
  }

  async rotateKey(keyId: string, context: KeyContext): Promise<string> {
    await this.simulateDelay();
    this.maybeThrowError();

    const key = this.keys.get(keyId);
    if (!key) {
      throw new KeyNotFoundError(keyId);
    }

    // Generate new master key
    const newMasterKey = randomBytes(32);
    const newKeyId = `${keyId}-rotated-${Date.now()}`;

    // Create new key version
    const newKey: MockKey = {
      ...key,
      keyId: newKeyId,
      masterKey: newMasterKey,
      rotatedAt: new Date(),
    };

    this.keys.set(newKeyId, newKey);

    // Mark old key for deletion
    key.status = "pending_deletion";

    await this.recordAudit({
      keyId,
      correlationId: context.correlationId,
      operation: "rotate",
      timestamp: new Date(),
      userId: context.userId,
      dataClassification: context.dataClassification,
      success: true,
      metadata: { provider: "mock", newKeyId, purpose: context.purpose },
    });

    return newKeyId;
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
    await this.simulateDelay();

    const healthy = Math.random() > this.errorRate;
    const latency = Date.now() - startTime;

    return {
      healthy,
      latency,
      errorRate: this.errorRate,
      lastError: healthy ? undefined : "Mock error for testing",
    };
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
    await this.simulateDelay();

    return Array.from(this.keys.values()).map((key) => ({
      keyId: key.keyId,
      description: key.description,
      algorithm: key.algorithm,
      status: key.status,
      createdAt: key.createdAt,
      rotatedAt: key.rotatedAt,
    }));
  }

  // Test utilities
  getAuditLogs(): KeyUsageAudit[] {
    return [...this.auditLogs];
  }

  clearAuditLogs(): void {
    this.auditLogs = [];
  }

  createKey(keyId: string, description?: string): void {
    this.keys.set(keyId, {
      keyId,
      description: description ?? `Test key: ${keyId}`,
      algorithm: "AES_256",
      status: "active",
      createdAt: new Date(),
      masterKey: randomBytes(32),
    });
  }

  setKeyStatus(
    keyId: string,
    status: "active" | "pending_deletion" | "disabled",
  ): void {
    const key = this.keys.get(keyId);
    if (key) {
      key.status = status;
    }
  }

  private async simulateDelay(): Promise<void> {
    if (this.simulateLatency) {
      const delay = Math.random() * 50 + 10; // 10-60ms
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  private maybeThrowError(): void {
    if (Math.random() < this.errorRate) {
      throw new Error("Simulated error for testing");
    }
  }

  private async recordAudit(audit: KeyUsageAudit): Promise<void> {
    this.auditLogs.push({ ...audit });
  }
}
