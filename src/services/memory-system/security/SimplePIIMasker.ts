/**
 * Simple PII Masker
 * Detects and masks personally identifiable information
 */

export interface PIIMaskOptions {
  maskEmails?: boolean;
  maskPhones?: boolean;
  maskCreditCards?: boolean;
  maskSecrets?: boolean;
  maskIPs?: boolean;
  maskSSN?: boolean;
  customPatterns?: Array<{ pattern: RegExp; replacement: string }>;
}

export class SimplePIIMasker {
  private options: Required<PIIMaskOptions>;

  constructor(options: PIIMaskOptions = {}) {
    this.options = {
      maskEmails: true,
      maskPhones: true,
      maskCreditCards: true,
      maskSecrets: true,
      maskIPs: true,
      maskSSN: true,
      customPatterns: [],
      ...options,
    };
  }

  mask(input: string): string {
    let result = input;

    // Email addresses
    if (this.options.maskEmails) {
      result = result.replace(
        /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
        "[EMAIL]",
      );
    }

    // API keys and secrets
    if (this.options.maskSecrets) {
      // Common API key patterns
      result = result
        .replace(
          /\b(sk|pk|api[_-]?key|token|secret|password|pwd)[_\-:\s]*[A-Za-z0-9+/=]{12,}\b/gi,
          "[SECRET]",
        )
        .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, "Bearer [TOKEN]")
        .replace(/\b[A-Z0-9]{32,}\b/g, "[API_KEY]"); // Generic long hex strings
    }

    // Phone numbers (various formats)
    if (this.options.maskPhones) {
      result = result
        .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[PHONE]") // US format
        .replace(/\b\(\d{3}\)\s?\d{3}[-.\s]?\d{4}\b/g, "[PHONE]") // US with parens
        .replace(
          /\b\+?[1-9]\d{0,2}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b/g,
          "[PHONE]",
        ); // International
    }

    // Credit card numbers
    if (this.options.maskCreditCards) {
      result = result
        .replace(/\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g, "[CARD]") // 16 digits
        .replace(/\b\d{4}[\s\-]?\d{6}[\s\-]?\d{5}\b/g, "[CARD]") // Amex
        .replace(/\b\d{13,19}\b/g, (match) => {
          // Luhn algorithm check for potential credit cards
          if (this.isValidLuhn(match)) {
            return "[CARD]";
          }
          return match;
        });
    }

    // IP addresses
    if (this.options.maskIPs) {
      // IPv4
      result = result.replace(
        /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
        "[IP]",
      );
      // IPv6 (simplified pattern)
      result = result.replace(
        /\b(?:[A-F0-9]{1,4}:){7}[A-F0-9]{1,4}\b/gi,
        "[IPv6]",
      );
    }

    // Social Security Numbers
    if (this.options.maskSSN) {
      result = result.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]");
    }

    // Apply custom patterns
    for (const { pattern, replacement } of this.options.customPatterns || []) {
      result = result.replace(pattern, replacement);
    }

    return result;
  }

  /**
   * Detect if content contains PII
   */
  containsPII(input: string): boolean {
    const patterns = [
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, // Email
      /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/, // Phone
      /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/, // Credit card
      /\b(sk|api[_-]?key|token|secret|password)[_\-:\s]*[A-Za-z0-9+/=]{12,}\b/i, // Secrets
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
    ];

    return patterns.some((pattern) => pattern.test(input));
  }

  /**
   * Get statistics about PII in content
   */
  analyze(input: string): {
    hasPII: boolean;
    counts: Record<string, number>;
  } {
    const counts: Record<string, number> = {
      emails: (input.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])
        .length,
      phones: (input.match(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g) || []).length,
      cards: (
        input.match(/\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g) || []
      ).length,
      secrets: (
        input.match(
          /\b(sk|api[_-]?key|token|secret)[_\-:\s]*[A-Za-z0-9+/=]{12,}\b/gi,
        ) || []
      ).length,
      ssns: (input.match(/\b\d{3}-\d{2}-\d{4}\b/g) || []).length,
    };

    const hasPII = Object.values(counts).some((count) => count > 0);

    return { hasPII, counts };
  }

  /**
   * Luhn algorithm to validate credit card numbers
   */
  private isValidLuhn(num: string): boolean {
    const digits = num.replace(/\D/g, "");
    if (digits.length < 13 || digits.length > 19) return false;

    let sum = 0;
    let isEven = false;

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i], 10);

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }
}

// Export convenience function
export function maskPII(input: string, options?: PIIMaskOptions): string {
  const masker = new SimplePIIMasker(options);
  return masker.mask(input);
}
