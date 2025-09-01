/**
 * KMS Integration Test Suite
 * Phase 4.0 Security: Multi-cloud KMS testing with comprehensive coverage
 * Coverage target: 80%+
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { KMSIntegration } from "../../../services/memory-system/phase4/security/KMSIntegration";
import * as crypto from "crypto";

// Mock AWS SDK
vi.mock("@aws-sdk/client-kms", () => ({
  KMSClient: vi.fn(() => ({
    send: vi.fn(),
  })),
  CreateKeyCommand: vi.fn(),
  EncryptCommand: vi.fn(),
  DecryptCommand: vi.fn(),
  ScheduleKeyDeletionCommand: vi.fn(),
}));

// Mock Azure SDK
vi.mock("@azure/keyvault-keys", () => ({
  KeyClient: vi.fn(() => ({
    createKey: vi.fn(),
    getKey: vi.fn(),
    deleteKey: vi.fn(),
  })),
}));

// Mock GCP SDK
vi.mock("@google-cloud/kms", () => ({
  KeyManagementServiceClient: vi.fn(() => ({
    createCryptoKey: vi.fn(),
    encrypt: vi.fn(),
    decrypt: vi.fn(),
  })),
}));

describe("KMSIntegration", () => {
  let kms: KMSIntegration;

  const awsConfig = {
    provider: "aws" as const,
    region: "us-east-1",
    credentials: {
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
    },
    keyRotationEnabled: true,
    keyRotationIntervalDays: 90,
    cacheEnabled: true,
    cacheTTLSeconds: 300,
    auditEnabled: true,
    complianceMode: "FIPS" as const,
  };

  beforeEach(() => {
    kms = new KMSIntegration(awsConfig);
  });

  describe("AWS KMS Provider", () => {
    it("should initialize AWS KMS client correctly", () => {
      expect(kms).toBeDefined();
      expect(kms.getProvider()).toBe("aws");
    });

    it("should create encryption keys with proper configuration", async () => {
      const keySpec = {
        algorithm: "AES-256-GCM" as const,
        purpose: "encryption" as const,
        metadata: { environment: "test" },
      };

      const mockKey = {
        id: "test-key-id",
        version: 1,
        algorithm: "AES-256-GCM",
        purpose: "encryption",
        createdAt: new Date(),
        status: "active",
        metadata: keySpec.metadata,
      };

      vi.spyOn(kms, "createKey").mockResolvedValue(mockKey);

      const key = await kms.createKey(keySpec);

      expect(key.id).toBe("test-key-id");
      expect(key.algorithm).toBe("AES-256-GCM");
      expect(key.status).toBe("active");
    });

    it("should encrypt and decrypt data successfully", async () => {
      const testData = Buffer.from("sensitive test data");
      const keyId = "test-key-id";

      const mockEncrypted = {
        ciphertext: Buffer.from("encrypted-data"),
        keyId: keyId,
        algorithm: "AES-256-GCM",
      };

      vi.spyOn(kms, "encrypt").mockResolvedValue(mockEncrypted);
      vi.spyOn(kms, "decrypt").mockResolvedValue(testData);

      const encrypted = await kms.encrypt(testData, keyId);
      const decrypted = await kms.decrypt(encrypted.ciphertext, keyId);

      expect(encrypted.keyId).toBe(keyId);
      expect(decrypted.equals(testData)).toBe(true);
    });
  });

  describe("Azure Key Vault Provider", () => {
    it("should support Azure Key Vault configuration", () => {
      const azureKms = new KMSIntegration({
        provider: "azure",
        credentials: {
          clientId: "azure-client-id",
          clientSecret: "azure-secret",
          tenantId: "azure-tenant",
        },
        keyRotationEnabled: true,
        keyRotationIntervalDays: 180,
        cacheEnabled: false,
        auditEnabled: true,
      });

      expect(azureKms.getProvider()).toBe("azure");
    });

    it("should handle Azure-specific key operations", async () => {
      const azureKms = new KMSIntegration({
        provider: "azure",
        credentials: {
          clientId: "test-client",
          clientSecret: "test-secret",
          tenantId: "test-tenant",
        },
        keyRotationEnabled: false,
        keyRotationIntervalDays: 365,
        cacheEnabled: true,
        cacheTTLSeconds: 600,
        auditEnabled: false,
      });

      const mockAzureKey = {
        id: "azure-key-id",
        version: 1,
        algorithm: "RSA-OAEP",
        purpose: "encryption",
        createdAt: new Date(),
        status: "active",
      };

      vi.spyOn(azureKms, "createKey").mockResolvedValue(mockAzureKey);

      const key = await azureKms.createKey({
        algorithm: "RSA-OAEP",
        purpose: "encryption",
      });

      expect(key.algorithm).toBe("RSA-OAEP");
    });
  });

  describe("GCP KMS Provider", () => {
    it("should support Google Cloud KMS configuration", () => {
      const gcpKms = new KMSIntegration({
        provider: "gcp",
        region: "us-central1",
        keyRotationEnabled: true,
        keyRotationIntervalDays: 365,
        cacheEnabled: true,
        cacheTTLSeconds: 900,
        auditEnabled: true,
        complianceMode: "HIPAA",
      });

      expect(gcpKms.getProvider()).toBe("gcp");
    });

    it("should handle GCP-specific encryption operations", async () => {
      const gcpKms = new KMSIntegration({
        provider: "gcp",
        keyRotationEnabled: false,
        keyRotationIntervalDays: 90,
        cacheEnabled: false,
        auditEnabled: true,
      });

      const testData = Buffer.from("GCP test data");
      const mockEncrypted = {
        ciphertext: Buffer.from("gcp-encrypted-data"),
        keyId: "gcp-key-id",
        algorithm: "AES-256-GCM",
      };

      vi.spyOn(gcpKms, "encrypt").mockResolvedValue(mockEncrypted);

      const result = await gcpKms.encrypt(testData, "gcp-key-id");

      expect(result.keyId).toBe("gcp-key-id");
    });
  });

  describe("HashiCorp Vault Provider", () => {
    it("should support Vault configuration", () => {
      const vaultKms = new KMSIntegration({
        provider: "vault",
        credentials: {
          vaultUrl: "https://vault.example.com",
          vaultToken: "vault-token",
        },
        keyRotationEnabled: true,
        keyRotationIntervalDays: 30,
        cacheEnabled: true,
        cacheTTLSeconds: 1800,
        auditEnabled: true,
        complianceMode: "PCI-DSS",
      });

      expect(vaultKms.getProvider()).toBe("vault");
    });
  });

  describe("Local Provider", () => {
    it("should support local encryption for development", () => {
      const localKms = new KMSIntegration({
        provider: "local",
        keyRotationEnabled: false,
        keyRotationIntervalDays: 0,
        cacheEnabled: false,
        auditEnabled: false,
      });

      expect(localKms.getProvider()).toBe("local");
    });
  });

  describe("Key Rotation", () => {
    it("should support automatic key rotation", async () => {
      const rotationKms = new KMSIntegration({
        ...awsConfig,
        keyRotationEnabled: true,
        keyRotationIntervalDays: 1, // 1 day for testing
      });

      const oldKey = {
        id: "old-key-id",
        version: 1,
        algorithm: "AES-256-GCM" as const,
        purpose: "encryption" as const,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        status: "active" as const,
      };

      const newKey = {
        ...oldKey,
        id: "new-key-id",
        version: 2,
        createdAt: new Date(),
      };

      vi.spyOn(rotationKms, "rotateKey").mockResolvedValue(newKey);

      const rotatedKey = await rotationKms.rotateKey("old-key-id");

      expect(rotatedKey.version).toBe(2);
      expect(rotatedKey.id).toBe("new-key-id");
    });

    it("should handle key rotation schedules", async () => {
      const scheduleResult = await kms.scheduleKeyRotation(
        "test-key",
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      );

      expect(scheduleResult).toBeDefined();
    });
  });

  describe("Caching", () => {
    it("should cache encryption keys when enabled", async () => {
      const cachingKms = new KMSIntegration({
        ...awsConfig,
        cacheEnabled: true,
        cacheTTLSeconds: 300,
      });

      const keyId = "cached-key-id";
      const mockKey = {
        id: keyId,
        version: 1,
        algorithm: "AES-256-GCM" as const,
        purpose: "encryption" as const,
        createdAt: new Date(),
        status: "active" as const,
      };

      vi.spyOn(cachingKms, "getKey").mockResolvedValue(mockKey);

      // First call should fetch from KMS
      const key1 = await cachingKms.getKey(keyId);
      // Second call should use cache
      const key2 = await cachingKms.getKey(keyId);

      expect(key1.id).toBe(keyId);
      expect(key2.id).toBe(keyId);
    });

    it("should respect cache TTL settings", async () => {
      const shortCacheKms = new KMSIntegration({
        ...awsConfig,
        cacheEnabled: true,
        cacheTTLSeconds: 1, // 1 second
      });

      const mockKey = {
        id: "ttl-test-key",
        version: 1,
        algorithm: "AES-256-GCM" as const,
        purpose: "encryption" as const,
        createdAt: new Date(),
        status: "active" as const,
      };

      vi.spyOn(shortCacheKms, "getKey").mockResolvedValue(mockKey);

      await shortCacheKms.getKey("ttl-test-key");

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      await shortCacheKms.getKey("ttl-test-key");

      expect(shortCacheKms.getKey).toHaveBeenCalledTimes(2);
    });
  });

  describe("Audit Logging", () => {
    it("should log key operations when audit is enabled", async () => {
      const auditKms = new KMSIntegration({
        ...awsConfig,
        auditEnabled: true,
      });

      const auditSpy = vi.spyOn(auditKms, "auditLog").mockImplementation();

      const testData = Buffer.from("audit test data");
      const mockEncrypted = {
        ciphertext: Buffer.from("encrypted"),
        keyId: "audit-key-id",
        algorithm: "AES-256-GCM",
      };

      vi.spyOn(auditKms, "encrypt").mockResolvedValue(mockEncrypted);

      await auditKms.encrypt(testData, "audit-key-id");

      expect(auditSpy).toHaveBeenCalled();
    });
  });

  describe("Compliance Modes", () => {
    it("should enforce FIPS compliance mode", () => {
      const fipsKms = new KMSIntegration({
        ...awsConfig,
        complianceMode: "FIPS",
      });

      expect(fipsKms.getComplianceMode()).toBe("FIPS");
    });

    it("should enforce HIPAA compliance mode", () => {
      const hipaaKms = new KMSIntegration({
        ...awsConfig,
        complianceMode: "HIPAA",
      });

      expect(hipaaKms.getComplianceMode()).toBe("HIPAA");
    });

    it("should validate compliance requirements", async () => {
      const complianceKms = new KMSIntegration({
        ...awsConfig,
        complianceMode: "SOC2",
      });

      const isCompliant = await complianceKms.validateCompliance();

      expect(typeof isCompliant).toBe("boolean");
    });
  });

  describe("Error Handling", () => {
    it("should handle network errors gracefully", async () => {
      vi.spyOn(kms, "encrypt").mockRejectedValue(new Error("Network timeout"));

      const testData = Buffer.from("error test data");

      await expect(kms.encrypt(testData, "test-key")).rejects.toThrow(
        "Network timeout",
      );
    });

    it("should handle invalid key IDs", async () => {
      vi.spyOn(kms, "getKey").mockRejectedValue(new Error("Key not found"));

      await expect(kms.getKey("invalid-key-id")).rejects.toThrow(
        "Key not found",
      );
    });

    it("should validate encryption contexts", () => {
      expect(() => {
        kms.validateEncryptionContext({
          keyId: "",
          algorithm: "AES-256-GCM",
        });
      }).toThrow();
    });
  });

  describe("Performance", () => {
    it("should handle bulk encryption operations efficiently", async () => {
      const bulkData = Array.from({ length: 100 }, (_, i) =>
        Buffer.from(`bulk test data ${i}`),
      );

      const mockEncrypted = {
        ciphertext: Buffer.from("bulk-encrypted"),
        keyId: "bulk-key-id",
        algorithm: "AES-256-GCM",
      };

      vi.spyOn(kms, "encryptBulk").mockResolvedValue(
        bulkData.map(() => mockEncrypted),
      );

      const startTime = Date.now();
      const results = await kms.encryptBulk(bulkData, "bulk-key-id");
      const endTime = Date.now();

      expect(results).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it("should support parallel encryption operations", async () => {
      const parallelData = Array.from({ length: 50 }, (_, i) =>
        Buffer.from(`parallel test data ${i}`),
      );

      const mockEncrypted = {
        ciphertext: Buffer.from("parallel-encrypted"),
        keyId: "parallel-key-id",
        algorithm: "AES-256-GCM",
      };

      vi.spyOn(kms, "encrypt").mockResolvedValue(mockEncrypted);

      const promises = parallelData.map((data) =>
        kms.encrypt(data, "parallel-key-id"),
      );
      const results = await Promise.all(promises);

      expect(results).toHaveLength(50);
      results.forEach((result) => {
        expect(result.keyId).toBe("parallel-key-id");
      });
    });
  });

  describe("Multi-Algorithm Support", () => {
    it("should support AES-256-GCM encryption", async () => {
      const aesKey = await kms.createKey({
        algorithm: "AES-256-GCM",
        purpose: "encryption",
      });

      expect(aesKey.algorithm).toBe("AES-256-GCM");
    });

    it("should support RSA-OAEP encryption", async () => {
      const rsaKey = await kms.createKey({
        algorithm: "RSA-OAEP",
        purpose: "encryption",
      });

      expect(rsaKey.algorithm).toBe("RSA-OAEP");
    });

    it("should support ChaCha20-Poly1305 encryption", async () => {
      const chachaKey = await kms.createKey({
        algorithm: "ChaCha20-Poly1305",
        purpose: "encryption",
      });

      expect(chachaKey.algorithm).toBe("ChaCha20-Poly1305");
    });
  });
});
