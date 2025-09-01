/**
 * Security Masker for sensitive information
 */

export class Masker {
  private static readonly SENSITIVE_PATTERNS: Array<{
    pattern: RegExp;
    name: string;
  }> = [
    // API Keys
    { pattern: /sk-[A-Za-z0-9]{32,}/g, name: "OpenAI" },
    { pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/g, name: "Slack" },
    { pattern: /ghp_[A-Za-z0-9]{36,}/g, name: "GitHub" },
    { pattern: /gho_[A-Za-z0-9]{36,}/g, name: "GitHub OAuth" },
    { pattern: /AKIA[0-9A-Z]{16}/g, name: "AWS Access Key" },
    {
      pattern: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      name: "JWT",
    },

    // General patterns
    {
      pattern: /api[_-]?key[\s]*[=:]\s*["']?([A-Za-z0-9_-]{20,})["']?/gi,
      name: "API Key",
    },
    {
      pattern: /token[\s]*[=:]\s*["']?([A-Za-z0-9_-]{20,})["']?/gi,
      name: "Token",
    },
    { pattern: /password[\s]*[=:]\s*["']?([^"'\s]+)["']?/gi, name: "Password" },
    {
      pattern: /secret[\s]*[=:]\s*["']?([A-Za-z0-9_-]{20,})["']?/gi,
      name: "Secret",
    },

    // Database URLs
    { pattern: /mongodb(\+srv)?:\/\/[^@]+@[^\s]+/g, name: "MongoDB URL" },
    { pattern: /postgres(ql)?:\/\/[^@]+@[^\s]+/g, name: "PostgreSQL URL" },
    { pattern: /mysql:\/\/[^@]+@[^\s]+/g, name: "MySQL URL" },
    { pattern: /redis:\/\/[^@]+@[^\s]+/g, name: "Redis URL" },
  ];

  private static readonly SENSITIVE_FILES = [
    /\.env(\..+)?$/,
    /\.pem$/,
    /\.key$/,
    /\.cert$/,
    /id_rsa/,
    /id_dsa/,
    /id_ecdsa/,
    /id_ed25519/,
    /credentials/i,
    /secrets/i,
  ];

  private readonly enabled: boolean;

  constructor(enabled: boolean = true) {
    this.enabled = enabled || process.env.INIT_REDACT === "1";
  }

  /**
   * Check if a file should be redacted entirely
   */
  isFileRedacted(filepath: string): boolean {
    if (!this.enabled) return false;

    return Masker.SENSITIVE_FILES.some((pattern) => pattern.test(filepath));
  }

  /**
   * Mask sensitive content in a string
   */
  mask(content: string): string {
    if (!this.enabled) return content;

    let masked = content;

    for (const { pattern, name } of Masker.SENSITIVE_PATTERNS) {
      masked = masked.replace(pattern, (match) => {
        // Keep some context for debugging
        const prefix = match.substring(0, 4);
        const suffix = match.length > 8 ? "..." : "";
        return `${prefix}[REDACTED-${name}]${suffix}`;
      });
    }

    return masked;
  }

  /**
   * Mask command line arguments
   */
  maskCommand(cmd: string): string {
    if (!this.enabled) return cmd;

    // Mask common CLI patterns
    let masked = cmd;

    // --token=VALUE or -t VALUE patterns
    masked = masked.replace(
      /(-t|--token|--api-key|--secret|--password)\s+\S+/g,
      "$1 [REDACTED]",
    );
    masked = masked.replace(
      /(-t|--token|--api-key|--secret|--password)=\S+/g,
      "$1=[REDACTED]",
    );

    // Environment variables in commands
    masked = masked.replace(
      /(API_KEY|TOKEN|SECRET|PASSWORD)=\S+/g,
      "$1=[REDACTED]",
    );

    // Apply general patterns
    return this.mask(masked);
  }

  /**
   * Create a safe summary for sensitive files
   */
  getRedactedFileSummary(filepath: string): string {
    return `[REDACTED - sensitive file: ${filepath}]`;
  }
}
