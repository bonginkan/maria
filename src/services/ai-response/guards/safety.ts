/**
 * Safety Guards - Security and Content Control
 * Prevents harmful content, large outputs, and prompt injection
 */

export interface SafetyCheckResult {
  safe: boolean;
  reason?: string;
  suggestion?: string;
}

export interface SafetyConfig {
  maxOutputChars?: number;
  maxCodeBlocks?: number;
  enablePIICheck?: boolean;
  enablePromptInjectionCheck?: boolean;
}

// Sensitive information patterns
const PII_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/, // SSN
  /\b\d{16}\b/, // Credit card
  /\b[A-Z]{2}\d{6}\b/, // Passport
  /\b\d{3}-?\d{3}-?\d{4}\b/, // Phone
];

// Potentially harmful keywords (minimal list for demo)
const HARMFUL_KEYWORDS = [
  "password",
  "secret",
  "token",
  "api_key",
  "private_key",
  "パスワード",
  "シークレット",
  "トークン",
  "秘密鍵",
];

// Prompt injection patterns
const INJECTION_PATTERNS = [
  /ignore.*previous.*instructions?/i,
  /disregard.*above/i,
  /forget.*everything/i,
  /system.*prompt/i,
  /you.*are.*now/i,
  /前の.*指示.*無視/,
  /システム.*プロンプト/,
];

/**
 * Check input for safety issues
 * @param input - User input to check
 * @param config - Safety configuration
 * @returns Safety check result
 */
export function checkInputSafety(
  input: string,
  config: SafetyConfig = {},
): SafetyCheckResult {
  const { enablePIICheck = true, enablePromptInjectionCheck = true } = config;

  // Check for PII
  if (enablePIICheck && containsPII(input)) {
    return {
      safe: false,
      reason: "Input contains potential personal information",
      suggestion: "Please remove sensitive information before proceeding",
    };
  }

  // Check for prompt injection
  if (enablePromptInjectionCheck && containsInjection(input)) {
    return {
      safe: false,
      reason: "Input contains potential prompt injection",
      suggestion: "Please rephrase your request without system instructions",
    };
  }

  // Check for harmful keywords (warning only, not blocking)
  const harmful = detectHarmfulContent(input);
  if (harmful.length > 0) {
    return {
      safe: true, // Allow but warn
      reason: `Note: Input mentions sensitive topics: ${harmful.join(", ")}`,
      suggestion: "Ensure you're not exposing sensitive data",
    };
  }

  return { safe: true };
}

/**
 * Check output size and content
 * @param output - Generated output to check
 * @param config - Safety configuration
 * @returns Safety check result
 */
export function checkOutputSafety(
  output: string,
  config: SafetyConfig = {},
): SafetyCheckResult {
  const {
    maxOutputChars = 50000, // ~50KB
    maxCodeBlocks = 10,
  } = config;

  // Check size
  if (output.length > maxOutputChars) {
    return {
      safe: false,
      reason: `Output too large (${output.length} chars > ${maxOutputChars})`,
      suggestion: "Output has been truncated for safety",
    };
  }

  // Count code blocks
  const codeBlockCount = (output.match(/```/g) || []).length / 2;
  if (codeBlockCount > maxCodeBlocks) {
    return {
      safe: false,
      reason: `Too many code blocks (${codeBlockCount} > ${maxCodeBlocks})`,
      suggestion: "Consider splitting into multiple responses",
    };
  }

  return { safe: true };
}

/**
 * Detect if input contains PII
 * @param input - Text to check
 * @returns Whether PII was detected
 */
function containsPII(input: string): boolean {
  return PII_PATTERNS.some((pattern) => pattern.test(input));
}

/**
 * Detect prompt injection attempts
 * @param input - Text to check
 * @returns Whether injection was detected
 */
function containsInjection(input: string): boolean {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(input));
}

/**
 * Detect harmful content keywords
 * @param input - Text to check
 * @returns List of detected keywords
 */
function detectHarmfulContent(input: string): string[] {
  const lower = input.toLowerCase();
  return HARMFUL_KEYWORDS.filter((keyword) =>
    lower.includes(keyword.toLowerCase()),
  );
}

/**
 * Sanitize output for display
 * @param output - Output to sanitize
 * @param maxChars - Maximum characters
 * @returns Sanitized output
 */
export function sanitizeOutput(
  output: string,
  maxChars: number = 50000,
): string {
  // Truncate if too long
  if (output.length > maxChars) {
    return (
      output.substring(0, maxChars) + "\n\n... [Output truncated for safety]"
    );
  }

  // Remove any detected PII (basic replacement)
  let sanitized = output;
  PII_PATTERNS.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  });

  return sanitized;
}

/**
 * Check if explicit content is allowed
 * @param input - User input
 * @param explicitKeyword - Required keyword (e.g., 'tetris')
 * @returns Whether explicit content should be generated
 */
export function isExplicitContentAllowed(
  input: string,
  explicitKeyword: string,
): boolean {
  const lower = input.toLowerCase();
  return lower.includes(explicitKeyword.toLowerCase());
}

/**
 * Generate safety rejection message
 * @param reason - Rejection reason
 * @param isJapanese - Language preference
 * @returns Formatted rejection message
 */
export function generateRejectionMessage(
  reason: string,
  isJapanese: boolean,
): string {
  const baseMessage = isJapanese
    ? `申し訳ございません。安全上の理由により、このリクエストは処理できません。`
    : `I apologize, but I cannot process this request for safety reasons.`;

  const suggestions = isJapanese
    ? [
        "個人情報を除外してください",
        "リクエストを言い換えてください",
        "小さな部分に分割してください",
      ]
    : [
        "Remove personal information",
        "Rephrase your request",
        "Break into smaller parts",
      ];

  return `${baseMessage}

**${isJapanese ? "理由" : "Reason"}:** ${reason}

**${isJapanese ? "提案" : "Suggestions"}:**
${suggestions.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;
}

/**
 * Log safety event for monitoring
 * @param event - Safety event details
 */
export function logSafetyEvent(event: {
  type: "input_check" | "output_check" | "rejection";
  safe: boolean;
  reason?: string;
  timestamp?: number;
}) {
  // In production, send to telemetry service
  console.log("[Safety Guard]", {
    ...event,
    timestamp: event.timestamp || Date.now(),
  });
}
