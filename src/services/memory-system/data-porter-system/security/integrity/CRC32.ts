/**
 * IEEE 802.3 CRC32 Implementation
 *
 * Provides standard CRC32 checksum calculation for data integrity
 * verification according to IEEE 802.3 standard
 */

export class CRC32 {
  private static readonly IEEE_POLYNOMIAL = 0xedb88320;
  private static readonly INITIAL_VALUE = 0xffffffff;
  private static readonly FINAL_XOR = 0xffffffff;

  // Pre-computed lookup table for performance
  private static lookupTable: Uint32Array | null = null;

  /**
   * Initialize the CRC32 lookup table
   */
  private static initializeLookupTable(): void {
    if (this.lookupTable) return;

    this.lookupTable = new Uint32Array(256);

    for (let i = 0; i < 256; i++) {
      let crc = i;
      for (let j = 0; j < 8; j++) {
        if (crc & 1) {
          crc = (crc >>> 1) ^ this.IEEE_POLYNOMIAL;
        } else {
          crc = crc >>> 1;
        }
      }
      this.lookupTable[i] = crc >>> 0; // Ensure unsigned 32-bit
    }
  }

  /**
   * Calculate CRC32 checksum for string input
   */
  static checksum(input: string): string {
    return this.checksumBuffer(Buffer.from(input, "utf8"));
  }

  /**
   * Calculate CRC32 checksum for buffer input
   */
  static checksumBuffer(buffer: Buffer): string {
    this.initializeLookupTable();

    let crc = this.INITIAL_VALUE;

    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i];
      const tableIndex = (crc ^ byte) & 0xff;
      crc = (crc >>> 8) ^ this.lookupTable![tableIndex];
    }

    crc = (crc ^ this.FINAL_XOR) >>> 0; // Final XOR and ensure unsigned

    // Convert to hex string with padding
    return crc.toString(16).padStart(8, "0");
  }

  /**
   * Calculate CRC32 checksum for Uint8Array input
   */
  static checksumUint8Array(array: Uint8Array): string {
    this.initializeLookupTable();

    let crc = this.INITIAL_VALUE;

    for (let i = 0; i < array.length; i++) {
      const byte = array[i];
      const tableIndex = (crc ^ byte) & 0xff;
      crc = (crc >>> 8) ^ this.lookupTable![tableIndex];
    }

    crc = (crc ^ this.FINAL_XOR) >>> 0; // Final XOR and ensure unsigned

    // Convert to hex string with padding
    return crc.toString(16).padStart(8, "0");
  }

  /**
   * Verify data integrity using CRC32
   */
  static verify(
    data: string | Buffer | Uint8Array,
    expectedChecksum: string,
  ): boolean {
    let actualChecksum: string;

    if (typeof data === "string") {
      actualChecksum = this.checksum(data);
    } else if (Buffer.isBuffer(data)) {
      actualChecksum = this.checksumBuffer(data);
    } else {
      actualChecksum = this.checksumUint8Array(data);
    }

    return actualChecksum.toLowerCase() === expectedChecksum.toLowerCase();
  }

  /**
   * Calculate streaming CRC32 for large data
   */
  static createStreamingCalculator(): StreamingCRC32Calculator {
    return new StreamingCRC32Calculator();
  }

  /**
   * Get the lookup table (for testing purposes)
   */
  static getLookupTable(): Uint32Array {
    this.initializeLookupTable();
    return this.lookupTable!.slice(); // Return a copy
  }

  /**
   * Test against known vectors
   */
  static runTestVectors(): {
    passed: number;
    total: number;
    details: Array<{
      input: any;
      expected: string;
      actual: string;
      passed: boolean;
    }>;
  } {
    const testVectors = [
      // IEEE 802.3 standard test vectors
      { input: "123456789", expected: "cbf43926" },
      { input: Buffer.from([0x00, 0x00, 0x00, 0x00]), expected: "2144df1c" },
      { input: "hello world", expected: "0d4a1185" },
      { input: "", expected: "00000000" },
      {
        input: Buffer.from(
          "The quick brown fox jumps over the lazy dog",
          "utf8",
        ),
        expected: "414fa339",
      },
      { input: Buffer.alloc(100, 0xff), expected: "ff6cab0b" },
      { input: "A", expected: "d3d99e8b" },
      { input: Buffer.from([0xff]), expected: "ff000000" },
    ];

    const results = [];
    let passed = 0;

    for (const vector of testVectors) {
      let actual: string;

      if (typeof vector.input === "string") {
        actual = this.checksum(vector.input);
      } else {
        actual = this.checksumBuffer(vector.input);
      }

      const testPassed = actual === vector.expected;
      if (testPassed) passed++;

      results.push({
        input: vector.input,
        expected: vector.expected,
        actual,
        passed: testPassed,
      });
    }

    return {
      passed,
      total: testVectors.length,
      details: results,
    };
  }
}

/**
 * Streaming CRC32 calculator for large data processing
 */
export class StreamingCRC32Calculator {
  private crc: number = CRC32["INITIAL_VALUE"];
  private readonly lookupTable: Uint32Array;

  constructor() {
    CRC32["initializeLookupTable"]();
    this.lookupTable = CRC32.getLookupTable();
  }

  /**
   * Update CRC with new data chunk
   */
  update(data: string | Buffer | Uint8Array): this {
    let buffer: Buffer | Uint8Array;

    if (typeof data === "string") {
      buffer = Buffer.from(data, "utf8");
    } else {
      buffer = data;
    }

    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i];
      const tableIndex = (this.crc ^ byte) & 0xff;
      this.crc = (this.crc >>> 8) ^ this.lookupTable[tableIndex];
    }

    return this;
  }

  /**
   * Get the final CRC32 checksum
   */
  digest(): string {
    const finalCrc = (this.crc ^ CRC32["FINAL_XOR"]) >>> 0;
    return finalCrc.toString(16).padStart(8, "0");
  }

  /**
   * Reset the calculator for reuse
   */
  reset(): this {
    this.crc = CRC32["INITIAL_VALUE"];
    return this;
  }

  /**
   * Clone the current state
   */
  clone(): StreamingCRC32Calculator {
    const clone = new StreamingCRC32Calculator();
    clone.crc = this.crc;
    return clone;
  }
}

/**
 * Utility functions for CRC32 operations
 */
export const CRC32Utils = {
  /**
   * Calculate CRC32 for a file (Node.js only)
   */
  async checksumFile(filePath: string): Promise<string> {
    const fs = await import("fs");
    const { createReadStream } = fs;

    return new Promise((resolve, reject) => {
      const calculator = CRC32.createStreamingCalculator();
      const stream = createReadStream(filePath);

      stream.on("data", (chunk: Buffer) => {
        calculator.update(chunk);
      });

      stream.on("end", () => {
        resolve(calculator.digest());
      });

      stream.on("error", reject);
    });
  },

  /**
   * Compare two CRC32 checksums safely
   */
  compareChecksums(crc1: string, crc2: string): boolean {
    return crc1.toLowerCase() === crc2.toLowerCase();
  },

  /**
   * Validate CRC32 format
   */
  isValidCRC32(checksum: string): boolean {
    return /^[0-9a-fA-F]{8}$/.test(checksum);
  },

  /**
   * Generate checksum with metadata
   */
  checksumWithMetadata(
    data: string | Buffer | Uint8Array,
    metadata: { timestamp?: number; version?: string; algorithm?: string } = {},
  ): { checksum: string; metadata: any } {
    const checksum =
      typeof data === "string"
        ? CRC32.checksum(data)
        : Buffer.isBuffer(data)
          ? CRC32.checksumBuffer(data)
          : CRC32.checksumUint8Array(data);

    return {
      checksum,
      metadata: {
        algorithm: "CRC32-IEEE802.3",
        timestamp: metadata.timestamp || Date.now(),
        version: metadata.version || "1.0",
        dataLength: typeof data === "string" ? data.length : data.length,
        ...metadata,
      },
    };
  },

  /**
   * Batch checksum calculation
   */
  batchChecksum(
    items: Array<{ id: string; data: string | Buffer | Uint8Array }>,
  ): Array<{ id: string; checksum: string; error?: string }> {
    return items.map((item) => {
      try {
        const checksum =
          typeof item.data === "string"
            ? CRC32.checksum(item.data)
            : Buffer.isBuffer(item.data)
              ? CRC32.checksumBuffer(item.data)
              : CRC32.checksumUint8Array(item.data);

        return { id: item.id, checksum };
      } catch (error) {
        return {
          id: item.id,
          checksum: "00000000",
          error: error.message,
        };
      }
    });
  },
};

// Convenience function for simple usage
export function crc32(input: string | Buffer | Uint8Array): string {
  if (typeof input === "string") {
    return CRC32.checksum(input);
  } else if (Buffer.isBuffer(input)) {
    return CRC32.checksumBuffer(input);
  } else {
    return CRC32.checksumUint8Array(input);
  }
}

// Export default as the main CRC32 class
export default CRC32;
