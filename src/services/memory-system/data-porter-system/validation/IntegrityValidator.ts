/**
 * Integrity Validator
 *
 * Validates data integrity using checksums and signatures
 */

import { EventEmitter } from "node:events";
import * as crypto from "crypto";
import {
  IntegrityValidation,
  ChecksumAlgorithm,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from "../types/porter-types";
import { CRC32 } from "../security/integrity/CRC32";

export interface ValidationContext {
  requestId: string;
  userId: string;
  correlationId: string;
  timestamp: number;
  metadata: Record<string, any>;
}

export interface IntegrityCheck {
  algorithm: ChecksumAlgorithm;
  expected: string;
  actual: string;
  valid: boolean;
  executionTime: number;
}

export interface SignatureCheck {
  algorithm: string;
  publicKey: string;
  signature: string;
  valid: boolean;
  executionTime: number;
}

export class IntegrityValidator extends EventEmitter {
  private config: IntegrityValidation;

  constructor(config: IntegrityValidation) {
    super();
    this.config = config;
  }

  /**
   * Validate data integrity
   */
  async validate(
    data: any,
    context: ValidationContext,
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      if (!this.config.enabled) {
        return { valid: true, errors, warnings };
      }

      // Convert data to buffer for checksum calculation
      const dataBuffer = this.prepareDataForValidation(data);

      // Perform checksum validation
      const checksumResults = await this.validateChecksums(dataBuffer, context);

      // Process checksum results
      for (const result of checksumResults) {
        if (!result.valid) {
          errors.push({
            path: "integrity.checksum",
            message: `${result.algorithm.toUpperCase()} checksum mismatch. Expected: ${result.expected}, got: ${result.actual}`,
            value: result.actual,
            constraint: `${result.algorithm}: ${result.expected}`,
          });
        }

        this.emit("checksum_verified", {
          context,
          algorithm: result.algorithm,
          valid: result.valid,
          executionTime: result.executionTime,
        });
      }

      // Perform signature validation if enabled
      if (this.config.signatureValidation) {
        try {
          const signatureResults = await this.validateSignatures(
            dataBuffer,
            context,
          );

          for (const result of signatureResults) {
            if (!result.valid) {
              errors.push({
                path: "integrity.signature",
                message: `Digital signature validation failed using ${result.algorithm}`,
                value: result.signature,
                constraint: `signature: ${result.algorithm}`,
              });
            }

            this.emit("signature_verified", {
              context,
              algorithm: result.algorithm,
              valid: result.valid,
              executionTime: result.executionTime,
            });
          }
        } catch (error) {
          warnings.push({
            path: "integrity.signature",
            message: `Signature validation encountered issues: ${error.message}`,
            suggestion: "Check signature configuration and keys",
          });
        }
      }

      // Additional integrity checks
      const additionalChecks = await this.performAdditionalChecks(
        data,
        context,
      );
      warnings.push(...additionalChecks);

      const result: ValidationResult = {
        valid: errors.length === 0,
        errors,
        warnings,
      };

      this.emit("validation_complete", {
        context,
        result,
        checksumCount: checksumResults.length,
        signatureValidation: this.config.signatureValidation,
      });

      return result;
    } catch (error) {
      this.emit("validation_error", {
        context,
        error: error.message,
      });

      throw new Error(`Integrity validation failed: ${error.message}`);
    }
  }

  /**
   * Validate checksums using configured algorithms
   */
  private async validateChecksums(
    data: Buffer,
    context: ValidationContext,
  ): Promise<IntegrityCheck[]> {
    const results: IntegrityCheck[] = [];

    for (const algorithm of this.config.algorithms) {
      const startTime = Date.now();

      try {
        const checksum = await this.calculateChecksum(data, algorithm);
        const expected =
          context.metadata[`${algorithm}Checksum`] || context.metadata.checksum;

        const check: IntegrityCheck = {
          algorithm,
          expected: expected || "",
          actual: checksum,
          valid: expected ? checksum === expected : true, // If no expected value, consider valid
          executionTime: Date.now() - startTime,
        };

        results.push(check);

        this.emit("checksum_calculated", {
          context,
          algorithm,
          checksum,
          executionTime: check.executionTime,
        });
      } catch (error) {
        results.push({
          algorithm,
          expected: "",
          actual: "",
          valid: false,
          executionTime: Date.now() - startTime,
        });

        this.emit("checksum_error", {
          context,
          algorithm,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Calculate checksum using specified algorithm
   */
  private async calculateChecksum(
    data: Buffer,
    algorithm: ChecksumAlgorithm,
  ): Promise<string> {
    switch (algorithm) {
      case "md5":
        return crypto.createHash("md5").update(data).digest("hex");

      case "sha256":
        return crypto.createHash("sha256").update(data).digest("hex");

      case "sha512":
        return crypto.createHash("sha512").update(data).digest("hex");

      case "crc32":
        return CRC32.checksumBuffer(data);

      default:
        throw new Error(`Unsupported checksum algorithm: ${algorithm}`);
    }
  }

  /**
   * Validate digital signatures
   */
  private async validateSignatures(
    data: Buffer,
    context: ValidationContext,
  ): Promise<SignatureCheck[]> {
    const results: SignatureCheck[] = [];

    // Extract signature information from metadata
    const signatures = context.metadata.signatures || [];

    if (!Array.isArray(signatures)) {
      throw new Error("Signatures metadata must be an array");
    }

    for (const sigInfo of signatures) {
      const startTime = Date.now();

      try {
        const isValid = await this.verifySignature(data, sigInfo);

        const check: SignatureCheck = {
          algorithm: sigInfo.algorithm || "RSA-SHA256",
          publicKey: sigInfo.publicKey || "",
          signature: sigInfo.signature || "",
          valid: isValid,
          executionTime: Date.now() - startTime,
        };

        results.push(check);
      } catch (error) {
        results.push({
          algorithm: sigInfo.algorithm || "unknown",
          publicKey: sigInfo.publicKey || "",
          signature: sigInfo.signature || "",
          valid: false,
          executionTime: Date.now() - startTime,
        });

        this.emit("signature_error", {
          context,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Verify digital signature
   */
  private async verifySignature(data: Buffer, sigInfo: any): Promise<boolean> {
    try {
      const { algorithm = "RSA-SHA256", publicKey, signature } = sigInfo;

      if (!publicKey || !signature) {
        throw new Error("Missing public key or signature");
      }

      // Create verifier
      const verifier = crypto.createVerify(algorithm);
      verifier.update(data);

      // Verify signature
      const isValid = verifier.verify(publicKey, signature, "base64");

      return isValid;
    } catch (error) {
      throw new Error(`Signature verification failed: ${error.message}`);
    }
  }

  /**
   * Perform additional integrity checks
   */
  private async performAdditionalChecks(
    data: any,
    context: ValidationContext,
  ): Promise<ValidationWarning[]> {
    const warnings: ValidationWarning[] = [];

    try {
      // Check data size consistency
      if (context.metadata.expectedSize) {
        const actualSize = this.calculateDataSize(data);
        const expectedSize = context.metadata.expectedSize;

        if (actualSize !== expectedSize) {
          warnings.push({
            path: "integrity.size",
            message: `Data size mismatch. Expected: ${expectedSize} bytes, got: ${actualSize} bytes`,
            value: actualSize,
            suggestion: "Verify data transmission was complete",
          });
        }
      }

      // Check record count for arrays
      if (Array.isArray(data) && context.metadata.expectedRecords) {
        const actualRecords = data.length;
        const expectedRecords = context.metadata.expectedRecords;

        if (actualRecords !== expectedRecords) {
          warnings.push({
            path: "integrity.records",
            message: `Record count mismatch. Expected: ${expectedRecords} records, got: ${actualRecords} records`,
            value: actualRecords,
            suggestion: "Check for missing or extra records",
          });
        }
      }

      // Check timestamp freshness
      if (context.metadata.timestamp) {
        const dataTimestamp = context.metadata.timestamp;
        const currentTime = Date.now();
        const ageLimitMs = 24 * 60 * 60 * 1000; // 24 hours

        if (currentTime - dataTimestamp > ageLimitMs) {
          warnings.push({
            path: "integrity.freshness",
            message: `Data is older than 24 hours`,
            value: new Date(dataTimestamp).toISOString(),
            suggestion: "Verify data is current and relevant",
          });
        }
      }

      // Check for null/undefined values in critical fields
      if (typeof data === "object" && data !== null) {
        const criticalFields = context.metadata.criticalFields || [];

        for (const field of criticalFields) {
          if (data[field] === null || data[field] === undefined) {
            warnings.push({
              path: `integrity.critical.${field}`,
              message: `Critical field '${field}' is null or undefined`,
              value: data[field],
              suggestion: "Ensure critical fields have valid values",
            });
          }
        }
      }
    } catch (error) {
      warnings.push({
        path: "integrity.additional",
        message: `Additional integrity checks failed: ${error.message}`,
        suggestion: "Review integrity validation configuration",
      });
    }

    return warnings;
  }

  /**
   * Prepare data for validation (convert to Buffer)
   */
  private prepareDataForValidation(data: any): Buffer {
    if (Buffer.isBuffer(data)) {
      return data;
    }

    if (typeof data === "string") {
      return Buffer.from(data, "utf8");
    }

    if (typeof data === "object") {
      return Buffer.from(JSON.stringify(data), "utf8");
    }

    return Buffer.from(String(data), "utf8");
  }

  /**
   * Calculate data size in bytes
   */
  private calculateDataSize(data: any): number {
    if (Buffer.isBuffer(data)) {
      return data.length;
    }

    if (typeof data === "string") {
      return Buffer.byteLength(data, "utf8");
    }

    if (typeof data === "object") {
      return Buffer.byteLength(JSON.stringify(data), "utf8");
    }

    return Buffer.byteLength(String(data), "utf8");
  }

  /**
   * Generate checksums for data
   */
  async generateChecksums(
    data: any,
  ): Promise<Record<ChecksumAlgorithm, string>> {
    const dataBuffer = this.prepareDataForValidation(data);
    const checksums: Record<string, string> = {};

    for (const algorithm of this.config.algorithms) {
      try {
        checksums[algorithm] = await this.calculateChecksum(
          dataBuffer,
          algorithm,
        );
      } catch (error) {
        // Skip algorithms that fail
      }
    }

    return checksums as Record<ChecksumAlgorithm, string>;
  }

  /**
   * Verify data against provided checksums
   */
  async verifyChecksums(
    data: any,
    expectedChecksums: Partial<Record<ChecksumAlgorithm, string>>,
  ): Promise<
    {
      algorithm: ChecksumAlgorithm;
      expected: string;
      actual: string;
      valid: boolean;
    }[]
  > {
    const dataBuffer = this.prepareDataForValidation(data);
    const results: {
      algorithm: ChecksumAlgorithm;
      expected: string;
      actual: string;
      valid: boolean;
    }[] = [];

    for (const [algorithm, expected] of Object.entries(expectedChecksums)) {
      if (expected) {
        try {
          const actual = await this.calculateChecksum(
            dataBuffer,
            algorithm as ChecksumAlgorithm,
          );
          results.push({
            algorithm: algorithm as ChecksumAlgorithm,
            expected,
            actual,
            valid: actual === expected,
          });
        } catch (error) {
          results.push({
            algorithm: algorithm as ChecksumAlgorithm,
            expected,
            actual: "",
            valid: false,
          });
        }
      }
    }

    return results;
  }

  /**
   * Update integrity validator configuration
   */
  updateConfig(newConfig: Partial<IntegrityValidation>): void {
    Object.assign(this.config, newConfig);

    this.emit("config_updated", {
      timestamp: Date.now(),
      config: this.config,
    });
  }

  /**
   * Get integrity validator health status
   */
  getHealthStatus(): {
    status: "healthy" | "degraded" | "unhealthy";
    details: any;
  } {
    let status: "healthy" | "degraded" | "unhealthy" = "healthy";

    // Check if critical algorithms are available
    const criticalAlgorithms: ChecksumAlgorithm[] = ["sha256", "crc32"];
    const missingCritical = criticalAlgorithms.filter(
      (alg) => !this.config.algorithms.includes(alg),
    );

    if (missingCritical.length > 0) {
      status = "degraded";
    }

    if (!this.config.enabled) {
      status = "degraded";
    }

    if (this.config.algorithms.length === 0) {
      status = "unhealthy";
    }

    return {
      status,
      details: {
        enabled: this.config.enabled,
        algorithms: this.config.algorithms,
        signatureValidation: this.config.signatureValidation,
        missingCriticalAlgorithms: missingCritical,
      },
    };
  }

  /**
   * Test integrity validator
   */
  async test(testData?: any): Promise<{
    success: boolean;
    error?: string;
    checksums?: Record<string, string>;
  }> {
    try {
      const data = testData || "test data for integrity validation";
      const checksums = await this.generateChecksums(data);

      return {
        success: true,
        checksums,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
