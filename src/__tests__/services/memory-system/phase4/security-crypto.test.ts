import { describe, it, expect } from "vitest";
import {
  EnterpriseSecurityManager,
  SecurityConfig,
} from "../../../enterprise-security-manager";

const baseConfig: SecurityConfig = {
  encryption: {
    _algorithm: "AES-256-GCM",
    keySize: 256,
    ivSize: 12,
    tagSize: 16,
    defaultClassification: "internal",
    classificationRules: [],
  },
  keyManagement: {
    provider: "local",
    masterKey: { derivationMethod: "password" },
    keyBackup: {
      enabled: false,
      schedule: "* * * * *",
      encryption: false,
      storage: [],
      retention: 7,
    },
  },
  threatProtection: {
    intrusion: {
      enabled: true,
      rules: [],
      alertThreshold: 1,
      blockThreshold: 2,
      quarantineEnabled: true,
    },
    anomaly: {
      enabled: false,
      models: [],
      sensitivity: 0.5,
      learningPeriod: 7,
      alertThreshold: 0.9,
    },
    malware: {
      enabled: false,
      scanners: [],
      quarantineEnabled: true,
      autoClean: false,
    },
    dataExfiltration: {
      enabled: false,
      monitors: [],
      preventionRules: [],
      alertThreshold: 1,
    },
  },
  dataLossPrevention: {
    enabled: false,
    policies: [],
    contentInspection: {
      enabled: false,
      maxFileSize: 10_000_000,
      supportedTypes: [],
      deepInspection: false,
      ocrEnabled: false,
    },
    actionTemplates: [],
  },
  monitoring: {
    realtime: {
      enabled: true,
      dashboards: [],
      alerts: [],
      correlationRules: [],
    },
    logging: {
      level: "warn",
      destinations: [],
      format: "json",
      retention: 7,
      encryption: false,
    },
    alerting: {
      enabled: true,
      severityThresholds: new Map(),
      escalationPolicies: [],
      suppressionRules: [],
    },
    metrics: {
      collection: { interval: 60, metrics: [], tags: [] },
      storage: {
        provider: "prometheus",
        retention: 7,
        compression: false,
        config: Record<string, any>,
      },
      dashboards: [],
    },
  },
};

describe("Security Crypto Minimal Patch", () => {
  it("roundtrip: encrypt -> decrypt returns original object", async () => {
    const sec = new EnterpriseSecurityManager(
      JSON.parse(JSON.stringify(baseConfig)),
    );
    const payload = { msg: "hello", n: 42, arr: [1, 2, 3] };
    const enc = await sec.encryptData(payload, "internal");
    const dec = await sec.decryptData(enc, {
      userPermissions: ["decrypt:internal"],
    });
    expect(dec).toEqual(payload);
  });

  it("tamper: auth tag change causes decryption failure", async () => {
    const sec = new EnterpriseSecurityManager(
      JSON.parse(JSON.stringify(baseConfig)),
    );
    const enc = await sec.encryptData({ x: 1 }, "internal");

    // Tamper with tag
    const tagBuffer = Buffer.from(enc._tag, "base64");
    tagBuffer[0] = tagBuffer[0] ^ 0x01; // Flip first bit
    const mutated = { ...enc, _tag: tagBuffer.toString("base64") };

    await expect(sec.decryptData(mutated as any)).rejects.toThrow();
  });

  it("signature: verify fails with altered data", async () => {
    const sec = new EnterpriseSecurityManager(
      JSON.parse(JSON.stringify(baseConfig)),
    );
    const enc = await sec.encryptData({ data: "sign me" }, "internal");

    // Access private KeyManager for test
    // @ts-expect-error accessing private for test via any
    const km = (sec as any).keyManager;
    const sig = await km.sign(Buffer.from(enc.ciphertext, "base64"));

    // Tamper with data
    const altered = Buffer.from(enc.ciphertext, "base64");
    altered[0] = altered[0] ^ 0x01;

    const ok = await km.verifySignature(altered, sig);
    expect(ok).toBe(false);
  });

  it("secure transfer: creates valid signature and transfer ID", async () => {
    const sec = new EnterpriseSecurityManager(
      JSON.parse(JSON.stringify(baseConfig)),
    );
    const data = { secret: "classified info" };

    const transfer = await sec.secureTransfer(
      data,
      "secure-endpoint",
      "confidential",
    );

    expect(transfer._encrypted).toBeDefined();
    expect(transfer._signature).toBeDefined();
    expect(transfer._transferId).toBeDefined();
    expect(typeof transfer._signature).toBe("string");
    expect(typeof transfer._transferId).toBe("string");
  });

  it("transfer verification: validates signature and integrity", async () => {
    const sec = new EnterpriseSecurityManager(
      JSON.parse(JSON.stringify(baseConfig)),
    );
    const data = { secret: "classified info" };

    const transfer = await sec.secureTransfer(
      data,
      "secure-endpoint",
      "confidential",
    );
    const isValid = await sec.verifyTransfer(
      transfer._encrypted,
      transfer._signature,
      transfer._transferId,
    );

    expect(isValid).toBe(true);
  });

  it("key rotation: successfully rotates encryption keys", async () => {
    const sec = new EnterpriseSecurityManager(
      JSON.parse(JSON.stringify(baseConfig)),
    );

    const result = await sec.rotateKeys();

    expect(result.rotated).toBeDefined();
    expect(result.failed).toBeDefined();
    expect(Array.isArray(result.rotated)).toBe(true);
    expect(Array.isArray(result.failed)).toBe(true);
  });

  it("security status: returns comprehensive security metrics", async () => {
    const sec = new EnterpriseSecurityManager(
      JSON.parse(JSON.stringify(baseConfig)),
    );

    const status = await sec.getSecurityStatus();

    expect(status.overall).toBeDefined();
    expect(status.threats).toBeDefined();
    expect(status.encryption).toBeDefined();
    expect(status.dlp).toBeDefined();
    expect(status.monitoring).toBeDefined();
  });
});
