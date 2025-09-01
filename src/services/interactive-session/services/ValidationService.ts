/**
 * ValidationService - 入力検証サービス
 *
 * ユーザー入力の検証、サニタイズ、正規化
 * セキュリティと安全性の確保
 */

import { z } from "zod";

export interface ValidationResult {
  valid: boolean;
  value?: any;
  errors?: ValidationError[];
  warnings?: string[];
  sanitized?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: "error" | "warning" | "info";
}

export interface ValidationRule {
  name: string;
  test: (value: any) => boolean | Promise<boolean>;
  message: string;
  severity?: "error" | "warning";
}

export interface ValidationConfig {
  maxInputLength: number;
  allowedCharsets: string[];
  blockPatterns: RegExp[];
  sanitizeHtml: boolean;
  stripAnsi: boolean;
  normalizeWhitespace: boolean;
  maxCommandArgs: number;
  maxFilePathLength: number;
}

export class ValidationService {
  private _config: ValidationConfig;
  private _customRules: Map<string, ValidationRule[]> = new Map();
  private _schemas: Map<string, z.ZodSchema> = new Map();

  constructor(config?: Partial<ValidationConfig>) {
    this._config = {
      maxInputLength: 10000,
      allowedCharsets: ["utf-8", "ascii"],
      blockPatterns: [
        // SQLインジェクション対策
        /(\b(DROP|DELETE|INSERT|UPDATE|ALTER|CREATE)\s+\b)/gi,
        // スクリプトインジェクション対策
        /<script[^>]*>.*?<\/script>/gi,
        // パストラバーサル対策
        /\.\.[/\\]/g,
      ],
      sanitizeHtml: true,
      stripAnsi: false,
      normalizeWhitespace: true,
      maxCommandArgs: 50,
      maxFilePathLength: 260,
      ...config,
    };

    this.initializeSchemas();
  }

  /**
   * スキーマの初期化
   */
  private initializeSchemas(): void {
    // コマンド入力スキーマ
    this._schemas.set(
      "command",
      z.object({
        name: z.string().min(1).max(50),
        args: z.array(z.string()).max(this._config.maxCommandArgs),
        flags: z.record(z.string()).optional(),
      }),
    );

    // ファイルパススキーマ
    this._schemas.set(
      "filePath",
      z
        .string()
        .min(1)
        .max(this._config.maxFilePathLength)
        .refine((path) => !this.containsPathTraversal(path), {
          message: "Path traversal detected",
        }),
    );

    // URLスキーマ
    this._schemas.set("url", z.string().url());

    // メールスキーマ
    this._schemas.set("email", z.string().email());

    // 設定値スキーマ
    this._schemas.set(
      "configValue",
      z.union([z.string(), z.number(), z.boolean(), z.record(z.any())]),
    );
  }

  /**
   * 汎用入力検証
   */
  async validateInput(input: string, type?: string): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    // 空チェック
    if (!input || input.trim().length === 0) {
      return {
        valid: false,
        errors: [
          {
            field: "input",
            message: "Input cannot be empty",
            code: "EMPTY_INPUT",
            severity: "error",
          },
        ],
      };
    }

    // 長さチェック
    if (input.length > this._config.maxInputLength) {
      errors.push({
        field: "input",
        message: `Input exceeds maximum length of ${this._config.maxInputLength}`,
        code: "INPUT_TOO_LONG",
        severity: "error",
      });
    }

    // 危険なパターンのチェック
    for (const pattern of this._config.blockPatterns) {
      if (pattern.test(input)) {
        errors.push({
          field: "input",
          message: "Input contains potentially dangerous pattern",
          code: "DANGEROUS_PATTERN",
          severity: "error",
        });
      }
    }

    // サニタイズ
    let sanitized = input;
    if (this._config.sanitizeHtml) {
      sanitized = this.sanitizeHtml(sanitized);
    }
    if (this._config.stripAnsi) {
      sanitized = this.stripAnsi(sanitized);
    }
    if (this._config.normalizeWhitespace) {
      sanitized = this.normalizeWhitespace(sanitized);
    }

    // カスタムルールの適用
    if (type && this._customRules.has(type)) {
      const rules = this._customRules.get(type)!;
      for (const rule of rules) {
        const result = await rule.test(sanitized);
        if (!result) {
          if (rule.severity === "warning") {
            warnings.push(rule.message);
          } else {
            errors.push({
              field: "input",
              message: rule.message,
              code: rule.name,
              severity: "error",
            });
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      value: sanitized,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      sanitized,
    };
  }

  /**
   * コマンド検証
   */
  validateCommand(command: string, args: string[]): ValidationResult {
    try {
      const schema = this._schemas.get("command")!;
      const result = schema.parse({
        name: command,
        args,
      });

      // 追加の検証
      if (this.isDangerousCommand(command)) {
        return {
          valid: false,
          errors: [
            {
              field: "command",
              message: "This command is potentially dangerous",
              code: "DANGEROUS_COMMAND",
              severity: "error",
            },
          ],
        };
      }

      return {
        valid: true,
        value: result,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
            code: e.code,
            severity: "error" as const,
          })),
        };
      }

      return {
        valid: false,
        errors: [
          {
            field: "command",
            message: "Invalid command format",
            code: "INVALID_FORMAT",
            severity: "error",
          },
        ],
      };
    }
  }

  /**
   * ファイルパス検証
   */
  validateFilePath(path: string): ValidationResult {
    try {
      const schema = this._schemas.get("filePath")!;
      const result = schema.parse(path);

      // 追加の検証
      if (this.isSystemPath(path)) {
        return {
          valid: false,
          errors: [
            {
              field: "path",
              message: "Access to system paths is restricted",
              code: "SYSTEM_PATH",
              severity: "error",
            },
          ],
        };
      }

      return {
        valid: true,
        value: result,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map((e) => ({
            field: "path",
            message: e.message,
            code: e.code,
            severity: "error" as const,
          })),
        };
      }

      return {
        valid: false,
        errors: [
          {
            field: "path",
            message: "Invalid file path",
            code: "INVALID_PATH",
            severity: "error",
          },
        ],
      };
    }
  }

  /**
   * URL検証
   */
  validateUrl(url: string): ValidationResult {
    try {
      const schema = this._schemas.get("url")!;
      const result = schema.parse(url);

      // 追加の検証
      const parsed = new URL(url);

      // ローカルアドレスのチェック
      if (this.isLocalUrl(parsed)) {
        return {
          valid: true,
          value: result,
          warnings: ["This URL points to a local resource"],
        };
      }

      // HTTPSチェック
      if (parsed.protocol !== "https:") {
        return {
          valid: true,
          value: result,
          warnings: ["Consider using HTTPS for security"],
        };
      }

      return {
        valid: true,
        value: result,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [
          {
            field: "url",
            message: "Invalid URL format",
            code: "INVALID_URL",
            severity: "error",
          },
        ],
      };
    }
  }

  /**
   * メール検証
   */
  validateEmail(email: string): ValidationResult {
    try {
      const schema = this._schemas.get("email")!;
      const result = schema.parse(email);

      return {
        valid: true,
        value: result,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [
          {
            field: "email",
            message: "Invalid email format",
            code: "INVALID_EMAIL",
            severity: "error",
          },
        ],
      };
    }
  }

  /**
   * カスタムルールの追加
   */
  addRule(type: string, rule: ValidationRule): void {
    if (!this._customRules.has(type)) {
      this._customRules.set(type, []);
    }

    this._customRules.get(type)!.push(rule);
  }

  /**
   * カスタムスキーマの追加
   */
  addSchema(name: string, schema: z.ZodSchema): void {
    this._schemas.set(name, schema);
  }

  /**
   * HTMLサニタイズ
   */
  private sanitizeHtml(input: string): string {
    // 基本的なHTMLエスケープ
    return input
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;")
      .replace(/\//g, "&#x2F;");
  }

  /**
   * ANSIコードの除去
   */
  private stripAnsi(input: string): string {
    // ANSIエスケープシーケンスの除去
    // eslint-disable-next-line no-control-regex
    return input.replace(
      /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
      "",
    );
  }

  /**
   * 空白の正規化
   */
  private normalizeWhitespace(input: string): string {
    return input
      .replace(/\s+/g, " ") // 連続する空白を単一スペースに
      .replace(/^\s+|\s+$/g, ""); // 前後の空白を削除
  }

  /**
   * パストラバーサルの検出
   */
  private containsPathTraversal(path: string): boolean {
    return (
      /\.\.[/\\]/.test(path) || path.includes("..\\") || path.includes("../")
    );
  }

  /**
   * 危険なコマンドの判定
   */
  private isDangerousCommand(command: string): boolean {
    const dangerousCommands = [
      "rm",
      "del",
      "format",
      "shutdown",
      "reboot",
      "kill",
      "killall",
      "sudo",
      "su",
      "chmod",
      "chown",
      "mkfs",
      "dd",
      "eval",
    ];

    return dangerousCommands.includes(command.toLowerCase());
  }

  /**
   * システムパスの判定
   */
  private isSystemPath(path: string): boolean {
    const systemPaths = [
      "/etc",
      "/sys",
      "/proc",
      "/dev",
      "C:\\Windows",
      "C:\\System32",
      "/usr/bin",
      "/usr/sbin",
      "/bin",
      "/sbin",
    ];

    return systemPaths.some((sysPath) =>
      path.toLowerCase().startsWith(sysPath.toLowerCase()),
    );
  }

  /**
   * ローカルURLの判定
   */
  private isLocalUrl(url: URL): boolean {
    const localHosts = ["localhost", "127.0.0.1", "0.0.0.0", "::1"];

    return (
      localHosts.includes(url.hostname) ||
      url.hostname.endsWith(".local") ||
      url.hostname.startsWith("192.168.") ||
      url.hostname.startsWith("10.") ||
      url.hostname.startsWith("172.")
    );
  }

  /**
   * バッチ検証
   */
  async validateBatch(
    items: Array<{ value: any; type: string }>,
  ): Promise<ValidationResult[]> {
    return Promise.all(
      items.map((item) => this.validateInput(item.value, item.type)),
    );
  }

  /**
   * 検証ルールのリセット
   */
  resetRules(type?: string): void {
    if (type) {
      this._customRules.delete(type);
    } else {
      this._customRules.clear();
    }
  }
}
