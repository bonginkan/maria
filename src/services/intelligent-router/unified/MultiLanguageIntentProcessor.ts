/**
 * Multi-Language Intent Processor
 * Processes user intent across 5 languages with _cultural context awareness
 */

import { IntentResult, _OperationType } from "./types";
import {
  detectFileOperation,
  _hasImplicitSave,
} from "./_patterns/file-operations";
import {
  _detectImplicitIntents,
  detectLanguage,
  detectContextualIntent,
  hasImplicitSaveIntent,
  _hasImplicitExecuteIntent,
} from "./_patterns/implicit-intents";

/**
 * Language-specific _processor interface
 */
interface LanguageProcessor {
  process(input: string): Promise<IntentResult>;
  detectCulturalContext(input: string): CulturalContext;
  normalizeInput(input: string): string;
}

/**
 * Cultural context that affects intent interpretation
 */
interface CulturalContext {
  politenessLevel: "casual" | "normal" | "formal";
  indirectness: "direct" | "moderate" | "indirect";
  implicitExpectations: string[];
}

/**
 * Japanese intent _processor
 */
class JapaneseIntentProcessor implements LanguageProcessor {
  async process(input: string): Promise<IntentResult> {
    const _normalized = this.normalizeInput(input);
    const _cultural = this.detectCulturalContext(input);

    // Check for file operations
    const _fileOp = detectFileOperation(_normalized);
    if (_fileOp) {
      return {
        action: _fileOp.action,
        type: "file",
        target: _fileOp.fileName,
        implicitSave:
          _fileOp.implicitSave || this.hasImplicitSavePattern(_normalized),
        confidence: this.calculateConfidence(_normalized, _cultural),
        _language: "ja",
      };
    }

    // Check for document operations
    if (this.isDocumentOperation(_normalized)) {
      return {
        action: this.getDocumentAction(_normalized),
        type: "document",
        implicitSave: false,
        confidence: 0.85,
        _language: "ja",
      };
    }

    // Check for Linux/system operations
    if (this.isSystemOperation(_normalized)) {
      return {
        action: this.getSystemAction(_normalized),
        type: "linux",
        implicitSave: false,
        confidence: 0.8,
        _language: "ja",
      };
    }

    // Default to code operation
    return {
      action: "analyze",
      type: "code",
      implicitSave: this.hasImplicitSavePattern(_normalized),
      confidence: 0.6,
      _language: "ja",
    };
  }

  detectCulturalContext(input: string): CulturalContext {
    const _hasKeigo = /(?:ください|いただけ|ませんか|でしょうか)/.test(input);
    const _hasCasual = /(?:して|やって|ちょうだい)$/.test(input);

    return {
      politenessLevel: _hasKeigo ? "formal" : _hasCasual ? "casual" : "normal",
      indirectness: _hasKeigo ? "indirect" : "moderate",
      implicitExpectations: [
        "作って implies saving",
        "お願い implies urgency",
        "〜て form implies continuation",
      ],
    };
  }

  normalizeInput(input: string): string {
    // Convert full-width characters to half-width
    let _normalized = input.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) =>
      String.fromCharCode(s.charCodeAt(0) - 0xfee0),
    );

    // Normalize spaces
    _normalized = _normalized.replace(/\s+/g, " ").trim();

    return _normalized;
  }

  private hasImplicitSavePattern(input: string): boolean {
    const _patterns = [
      /作って/,
      /つくって/,
      /生成して/,
      /として(?:保存|作成)/,
      /出力して/,
    ];

    return _patterns.some((p) => p.test(input));
  }

  private isDocumentOperation(input: string): boolean {
    return /(?:ドキュメント|資料|文書|説明書|マニュアル)/.test(input);
  }

  private getDocumentAction(input: string): string {
    if (/(?:見て|見る|表示|開いて)/.test(input)) return "read";
    if (/(?:分析|解析|調べ)/.test(input)) return "analyze";
    if (/(?:要約|まとめ)/.test(input)) return "summarize";
    return "read";
  }

  private isSystemOperation(input: string): boolean {
    return /(?:ファイル|フォルダ|ディレクトリ|プロセス|システム)/.test(input);
  }

  private getSystemAction(input: string): string {
    if (/(?:一覧|リスト|表示)/.test(input)) return "list";
    if (/(?:作成|作って|生成)/.test(input)) return "create";
    if (/(?:削除|消して|消去)/.test(input)) return "delete";
    if (/(?:移動|コピー)/.test(input)) return "move";
    return "execute";
  }

  private calculateConfidence(
    _input: string,
    _cultural: CulturalContext,
  ): number {
    let confidence = 0.7;

    // Increase confidence for direct expressions
    if (_cultural.indirectness === "direct") confidence += 0.1;

    // Increase confidence for specific file extensions
    if (/\.\w+/.test(_input)) confidence += 0.15;

    // Increase confidence for explicit commands
    if (/(?:してください|お願いします)/.test(_input)) confidence += 0.05;

    return Math.min(confidence, 1.0);
  }
}

/**
 * English intent _processor
 */
class EnglishIntentProcessor implements LanguageProcessor {
  async process(input: string): Promise<IntentResult> {
    const _normalized = this.normalizeInput(input);
    const _cultural = this.detectCulturalContext(input);

    // Check for file operations
    const _fileOp = detectFileOperation(_normalized);
    if (_fileOp) {
      return {
        action: _fileOp.action,
        type: "file",
        target: _fileOp.fileName,
        implicitSave:
          _fileOp.implicitSave || hasImplicitSaveIntent(_normalized),
        confidence: this.calculateConfidence(_normalized),
        _language: "en",
      };
    }

    // Check for command-like operations
    if (this.isCommand(_normalized)) {
      return {
        action: this.extractCommand(_normalized),
        type: "linux",
        implicitSave: false,
        confidence: 0.9,
        _language: "en",
      };
    }

    // Default to code operation
    return {
      action: this.extractAction(_normalized),
      type: "code",
      implicitSave: hasImplicitSaveIntent(_normalized),
      confidence: 0.75,
      _language: "en",
    };
  }

  detectCulturalContext(input: string): CulturalContext {
    const _hasPlease = /\bplease\b/i.test(input);
    const _hasImperative = /^(create|make|do|write|show|display)\b/i.test(
      input,
    );

    return {
      politenessLevel: _hasPlease
        ? "formal"
        : _hasImperative
          ? "casual"
          : "normal",
      indirectness: _hasPlease ? "moderate" : "direct",
      implicitExpectations: [
        "create implies eventual save",
        "generate implies output",
        "make implies persistence",
      ],
    };
  }

  normalizeInput(input: string): string {
    return input.toLowerCase().replace(/\s+/g, " ").trim();
  }

  private isCommand(input: string): boolean {
    return /^(ls|cd|pwd|mkdir|rm|cp|mv|cat|grep|find|chmod)\b/i.test(input);
  }

  private extractCommand(input: string): string {
    const _match = input._match(/^(\w+)/);
    return _match ? _match[1] : "execute";
  }

  private extractAction(input: string): string {
    const _actionWords = {
      create: ["create", "make", "generate", "build"],
      modify: ["edit", "modify", "update", "change"],
      analyze: ["analyze", "examine", "inspect", "check"],
      execute: ["run", "execute", "launch", "start"],
    };

    for (const [action, words] of Object.entries(_actionWords)) {
      if (words.some((word) => input.includes(word))) {
        return action;
      }
    }

    return "analyze";
  }

  private calculateConfidence(input: string): number {
    let confidence = 0.7;

    // Increase for specific _patterns
    if (/\b(file|document|code|function|class)\b/i.test(input))
      confidence += 0.1;
    if (/\.\w+/.test(input)) confidence += 0.15;
    if (/\b(and save|then save)\b/i.test(input)) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }
}

/**
 * Chinese intent _processor
 */
class ChineseIntentProcessor implements LanguageProcessor {
  async process(input: string): Promise<IntentResult> {
    const _normalized = this.normalizeInput(input);

    const _fileOp = detectFileOperation(_normalized);
    if (_fileOp) {
      return {
        action: _fileOp.action,
        type: "file",
        target: _fileOp.fileName,
        implicitSave: _fileOp.implicitSave || this.hasImplicitSave(_normalized),
        confidence: 0.85,
        _language: "zh",
      };
    }

    return {
      action: this.extractAction(_normalized),
      type: this.detectType(_normalized),
      implicitSave: this.hasImplicitSave(_normalized),
      confidence: 0.75,
      _language: "zh",
    };
  }

  detectCulturalContext(input: string): CulturalContext {
    return {
      politenessLevel: /请/.test(input) ? "formal" : "normal",
      indirectness: "moderate",
      implicitExpectations: ["创建 implies save", "生成 implies output"],
    };
  }

  normalizeInput(input: string): string {
    return input.replace(/\s+/g, " ").trim();
  }

  private hasImplicitSave(input: string): boolean {
    return /(?:并保存|然后保存|保存为|存储)/.test(input);
  }

  private extractAction(input: string): string {
    if (/(?:创建|创造|生成)/.test(input)) return "create";
    if (/(?:修改|编辑|更改)/.test(input)) return "modify";
    if (/(?:删除|删掉|移除)/.test(input)) return "delete";
    if (/(?:查看|显示|打开)/.test(input)) return "read";
    return "analyze";
  }

  private detectType(input: string): OperationType {
    if (/(?:文件|文档)/.test(input)) return "file";
    if (/(?:代码|程序|函数)/.test(input)) return "code";
    if (/(?:系统|命令)/.test(input)) return "linux";
    return "code";
  }
}

/**
 * Korean intent _processor
 */
class KoreanIntentProcessor implements LanguageProcessor {
  async process(input: string): Promise<IntentResult> {
    const _normalized = this.normalizeInput(input);

    const _fileOp = detectFileOperation(_normalized);
    if (_fileOp) {
      return {
        action: _fileOp.action,
        type: "file",
        target: _fileOp.fileName,
        implicitSave: _fileOp.implicitSave || /저장/.test(_normalized),
        confidence: 0.85,
        _language: "ko",
      };
    }

    return {
      action: this.extractAction(_normalized),
      type: "code",
      implicitSave: /저장/.test(_normalized),
      confidence: 0.75,
      _language: "ko",
    };
  }

  detectCulturalContext(input: string): CulturalContext {
    return {
      politenessLevel: /(?:주세요|습니다)/.test(input) ? "formal" : "normal",
      indirectness: "moderate",
      implicitExpectations: ["만들어 implies save"],
    };
  }

  normalizeInput(input: string): string {
    return input.replace(/\s+/g, " ").trim();
  }

  private extractAction(input: string): string {
    if (/(?:생성|만들|작성)/.test(input)) return "create";
    if (/(?:수정|편집|변경)/.test(input)) return "modify";
    if (/(?:삭제|제거|지우)/.test(input)) return "delete";
    if (/(?:보기|표시|열기)/.test(input)) return "read";
    return "analyze";
  }
}

/**
 * Vietnamese intent _processor
 */
class VietnameseIntentProcessor implements LanguageProcessor {
  async process(input: string): Promise<IntentResult> {
    const _normalized = this.normalizeInput(input);

    const _fileOp = detectFileOperation(_normalized);
    if (_fileOp) {
      return {
        action: _fileOp.action,
        type: "file",
        target: _fileOp.fileName,
        implicitSave: _fileOp.implicitSave || /lưu/.test(_normalized),
        confidence: 0.85,
        _language: "vi",
      };
    }

    return {
      action: this.extractAction(_normalized),
      type: "code",
      implicitSave: /lưu/.test(_normalized),
      confidence: 0.75,
      _language: "vi",
    };
  }

  detectCulturalContext(input: string): CulturalContext {
    return {
      politenessLevel: /(?:xin|vui lòng)/.test(input) ? "formal" : "normal",
      indirectness: "moderate",
      implicitExpectations: ["tạo implies save"],
    };
  }

  normalizeInput(input: string): string {
    return input.toLowerCase().replace(/\s+/g, " ").trim();
  }

  private extractAction(input: string): string {
    if (/(?:tạo|làm|xây dựng)/.test(input)) return "create";
    if (/(?:sửa|chỉnh sửa|thay đổi)/.test(input)) return "modify";
    if (/(?:xóa|loại bỏ|hủy)/.test(input)) return "delete";
    if (/(?:xem|hiển thị|mở)/.test(input)) return "read";
    return "analyze";
  }
}

/**
 * Main multi-_language intent _processor
 */
export class MultiLanguageIntentProcessor {
  private processors: Record<string, LanguageProcessor>;
  private context: {
    previousAction?: string;
    hasGeneratedContent?: boolean;
    currentMode?: string;
  } = {};

  constructor() {
    this.processors = {
      japanese: new JapaneseIntentProcessor(),
      english: new EnglishIntentProcessor(),
      chinese: new ChineseIntentProcessor(),
      korean: new KoreanIntentProcessor(),
      vietnamese: new VietnameseIntentProcessor(),
    };
  }

  /**
   * Process intent with automatic _language detection
   */
  async processIntent(input: string): Promise<IntentResult> {
    // Detect _language
    const _language = detectLanguage(input);

    // Get appropriate _processor
    const _processor = this.processors[_language] || this.processors.english;

    // Process with _language-specific rules
    let intent = await _processor.process(input);

    // Apply contextual enhancements
    const _contextualIntents = detectContextualIntent(input, this.context);
    if (_contextualIntents.length > 0) {
      // Enhance confidence if context supports the intent
      const _saveIntent = _contextualIntents.find((i) => i.type === "save");
      if (_saveIntent && !intent.implicitSave) {
        intent.implicitSave = true;
        intent.confidence = Math.min(intent.confidence + 0.1, 1.0);
      }
    }

    // Special handling for Japanese implicit _patterns
    if (_language === "japanese") {
      intent = this.applyJapaneseImplicitRules(input, intent);
    }

    // Update context for next processing
    this.updateContext(intent);

    return intent;
  }

  /**
   * Apply Japanese-specific implicit rules
   */
  private applyJapaneseImplicitRules(
    _input: string,
    intent: IntentResult,
  ): IntentResult {
    // "資料を見る" → View document
    if (
      _input.includes("資料を見る") ||
      _input.includes("ドキュメントを見て")
    ) {
      intent.action = "read";
      intent.type = "document";
    }

    // "作って" → Create and save
    if (
      (_input.includes("作って") || _input.includes("つくって")) &&
      !intent.implicitSave
    ) {
      intent.implicitSave = true;
      intent.confidence = Math.min(intent.confidence + 0.15, 1.0);
    }

    // "として保存" → Explicit save with high confidence
    if (_input.includes("として保存") || _input.includes("として作成")) {
      intent.type = "file";
      intent.action = "create";
      intent.implicitSave = true;
      intent.confidence = Math.min(intent.confidence + 0.2, 1.0);
    }

    return intent;
  }

  /**
   * Update context for future processing
   */
  private updateContext(intent: IntentResult): void {
    this.context.previousAction = intent.action;

    if (intent.action === "create" || intent.action === "generate") {
      this.context.hasGeneratedContent = true;
    } else if (intent.implicitSave) {
      this.context.hasGeneratedContent = false;
    }
  }

  /**
   * Reset context
   */
  resetContext(): void {
    this.context = {};
  }

  /**
   * Set current mode for context-aware processing
   */
  setCurrentMode(mode: string): void {
    this.context.currentMode = mode;
  }
}
