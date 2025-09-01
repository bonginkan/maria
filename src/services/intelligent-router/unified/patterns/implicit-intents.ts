/**
 * Implicit Intent Detection
 * Detects implied actions from user input across languages
 */

export interface ImplicitIntent {
  _type: "save" | "execute" | "test" | "deploy" | "review" | "document";
  confidence: number;
  triggers: string[];
  _language: string;
}

/**
 * Implicit save patterns by _language
 */
export const _IMPLICIT_SAVE_PATTERNS = {
  japanese: [
    { pattern: /作って/, weight: 0.9, meaning: "make/create (implies save)" },
    { pattern: /つくって/, weight: 0.9, meaning: "make/create (hiragana)" },
    { pattern: /として保存/, weight: 1.0, meaning: "save as" },
    { pattern: /保存して/, weight: 1.0, meaning: "save it" },
    { pattern: /生成して/, weight: 0.8, meaning: "generate (implies save)" },
    { pattern: /出力して/, weight: 0.85, meaning: "output (implies save)" },
    { pattern: /書いて/, weight: 0.7, meaning: "write (may imply save)" },
    { pattern: /記録して/, weight: 0.9, meaning: "record" },
  ],

  english: [
    { pattern: /\band\s+save\b/i, weight: 1.0, meaning: "explicit save" },
    { pattern: /\bthen\s+save\b/i, weight: 1.0, meaning: "sequential save" },
    { pattern: /\bsave\s+it\b/i, weight: 1.0, meaning: "save reference" },
    {
      pattern: /\bcreate\s+and\s+save\b/i,
      weight: 1.0,
      meaning: "create with save",
    },
    {
      pattern: /\bmake\s+and\s+save\b/i,
      weight: 1.0,
      meaning: "make with save",
    },
    {
      pattern: /\bgenerate\s+.*\s+file\b/i,
      weight: 0.8,
      meaning: "generate file",
    },
    {
      pattern: /\bexport\s+to\b/i,
      weight: 0.9,
      meaning: "export implies save",
    },
    {
      pattern: /\bwrite\s+to\s+(?:disk|file)\b/i,
      weight: 1.0,
      meaning: "write to storage",
    },
    { pattern: /\bpersist\b/i, weight: 0.9, meaning: "persist data" },
    { pattern: /\bstore\b/i, weight: 0.85, meaning: "store data" },
  ],

  chinese: [
    { pattern: /并保存/, weight: 1.0, meaning: "and save" },
    { pattern: /然后保存/, weight: 1.0, meaning: "then save" },
    { pattern: /创建并保存/, weight: 1.0, meaning: "create and save" },
    { pattern: /生成文件/, weight: 0.85, meaning: "generate file" },
    { pattern: /输出到/, weight: 0.9, meaning: "output to" },
    { pattern: /写入/, weight: 0.8, meaning: "write to" },
    { pattern: /存储/, weight: 0.9, meaning: "store" },
  ],

  korean: [
    { pattern: /저장(?:해|하)/, weight: 1.0, meaning: "save" },
    { pattern: /만들고\s*저장/, weight: 1.0, meaning: "make and save" },
    { pattern: /생성하고\s*저장/, weight: 1.0, meaning: "generate and save" },
    { pattern: /파일로/, weight: 0.8, meaning: "as file" },
    { pattern: /기록/, weight: 0.85, meaning: "record" },
  ],

  vietnamese: [
    { pattern: /và\s+lưu/i, weight: 1.0, meaning: "and save" },
    { pattern: /sau\s+đó\s+lưu/i, weight: 1.0, meaning: "then save" },
    { pattern: /tạo\s+và\s+lưu/i, weight: 1.0, meaning: "create and save" },
    { pattern: /xuất\s+ra/i, weight: 0.85, meaning: "export" },
    { pattern: /ghi\s+vào/i, weight: 0.9, meaning: "write to" },
  ],
};

/**
 * Implicit execution patterns
 */
export const _IMPLICIT_EXECUTE_PATTERNS = {
  japanese: [
    { pattern: /実行して/, weight: 1.0, meaning: "execute" },
    { pattern: /動かして/, weight: 0.9, meaning: "run it" },
    { pattern: /起動して/, weight: 0.9, meaning: "start/launch" },
    { pattern: /テストして/, weight: 0.95, meaning: "test it" },
  ],

  english: [
    { pattern: /\band\s+run\b/i, weight: 1.0, meaning: "and execute" },
    { pattern: /\bthen\s+execute\b/i, weight: 1.0, meaning: "then execute" },
    { pattern: /\brun\s+it\b/i, weight: 1.0, meaning: "run reference" },
    { pattern: /\btest\s+it\b/i, weight: 0.95, meaning: "test reference" },
    { pattern: /\btry\s+it\b/i, weight: 0.85, meaning: "try execution" },
    { pattern: /\blaunch\b/i, weight: 0.9, meaning: "launch" },
  ],

  chinese: [
    { pattern: /并运行/, weight: 1.0, meaning: "and run" },
    { pattern: /执行/, weight: 1.0, meaning: "execute" },
    { pattern: /运行/, weight: 0.95, meaning: "run" },
    { pattern: /测试/, weight: 0.9, meaning: "test" },
  ],

  korean: [
    { pattern: /실행/, weight: 1.0, meaning: "execute" },
    { pattern: /테스트/, weight: 0.9, meaning: "test" },
    { pattern: /돌려/, weight: 0.85, meaning: "run" },
  ],

  vietnamese: [
    { pattern: /và\s+chạy/i, weight: 1.0, meaning: "and run" },
    { pattern: /thực\s+thi/i, weight: 1.0, meaning: "execute" },
    { pattern: /kiểm\s+tra/i, weight: 0.9, meaning: "test" },
  ],
};

/**
 * Implicit workflow patterns (composite actions)
 */
export const _IMPLICIT_WORKFLOW_PATTERNS = {
  japanese: [
    {
      pattern: /作って保存してテスト/,
      actions: ["create", "save", "test"],
      weight: 1.0,
    },
    {
      pattern: /実装してテスト/,
      actions: ["implement", "test"],
      weight: 0.95,
    },
    {
      pattern: /ビルドしてデプロイ/,
      actions: ["build", "deploy"],
      weight: 0.95,
    },
  ],

  english: [
    {
      pattern: /\bcreate.*test.*save\b/i,
      actions: ["create", "test", "save"],
      weight: 0.9,
    },
    {
      pattern: /\bimplement\s+and\s+test\b/i,
      actions: ["implement", "test"],
      weight: 0.95,
    },
    {
      pattern: /\bbuild\s+and\s+deploy\b/i,
      actions: ["build", "deploy"],
      weight: 0.95,
    },
    {
      pattern: /\bcode.*review.*merge\b/i,
      actions: ["code", "review", "merge"],
      weight: 0.9,
    },
  ],

  chinese: [
    {
      pattern: /创建.*测试.*保存/,
      actions: ["create", "test", "save"],
      weight: 0.9,
    },
    {
      pattern: /实现并测试/,
      actions: ["implement", "test"],
      weight: 0.95,
    },
    {
      pattern: /构建并部署/,
      actions: ["build", "deploy"],
      weight: 0.95,
    },
  ],
};

/**
 * Detect _language from input text
 */
export function detectLanguage(input: string): string {
  // Japanese detection
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(input)) {
    return "japanese";
  }

  // Chinese detection (excluding Japanese Kanji overlap)
  if (
    /[\u4E00-\u9FFF]/.test(input) &&
    !/[\u3040-\u309F\u30A0-\u30FF]/.test(input)
  ) {
    return "chinese";
  }

  // Korean detection
  if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(input)) {
    return "korean";
  }

  // Vietnamese detection (with diacritics)
  if (
    /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(
      input,
    )
  ) {
    return "vietnamese";
  }

  // Default to English
  return "english";
}

/**
 * Detect all implicit _intents from input
 */
export function detectImplicitIntents(input: string): ImplicitIntent[] {
  const _language = detectLanguage(input);
  const _intents: ImplicitIntent[] = [];

  // Check save patterns
  const _savePatterns =
    _IMPLICIT_SAVE_PATTERNS[_language as keyof typeof _IMPLICIT_SAVE_PATTERNS];
  if (_savePatterns) {
    for (const pattern of _savePatterns) {
      if (pattern.pattern.test(input)) {
        intents.push({
          _type: "save",
          confidence: pattern.weight,
          triggers: [pattern.meaning],
          _language,
        });
        break; // Take first match for each _type
      }
    }
  }

  // Check execute patterns
  const _executePatterns =
    _IMPLICIT_EXECUTE_PATTERNS[
      _language as keyof typeof _IMPLICIT_EXECUTE_PATTERNS
    ];
  if (_executePatterns) {
    for (const pattern of _executePatterns) {
      if (pattern.pattern.test(input)) {
        intents.push({
          _type: "execute",
          confidence: pattern.weight,
          triggers: [pattern.meaning],
          _language,
        });
        break;
      }
    }
  }

  // Check workflow patterns
  const _workflowPatterns =
    _IMPLICIT_WORKFLOW_PATTERNS[
      _language as keyof typeof _IMPLICIT_WORKFLOW_PATTERNS
    ];
  if (_workflowPatterns) {
    for (const pattern of _workflowPatterns) {
      if (pattern.pattern.test(input)) {
        // Add _intents for each action in the workflow
        pattern.actions.forEach((action) => {
          const _type = mapActionToIntentType(action);
          if (_type) {
            intents.push({
              _type,
              confidence: pattern.weight,
              triggers: [`workflow: ${pattern.actions.join(" → ")}`],
              _language,
            });
          }
        });
        break;
      }
    }
  }

  return _intents;
}

/**
 * Map action to intent _type
 */
function mapActionToIntentType(action: string): ImplicitIntent["_type"] | null {
  const mapping: Record<string, ImplicitIntent["_type"]> = {
    save: "save",
    test: "test",
    execute: "execute",
    run: "execute",
    deploy: "deploy",
    review: "review",
    document: "document",
    merge: "deploy",
    build: "execute",
  };

  return mapping[action] || null;
}

/**
 * Check if input has implicit save intent
 */
export function hasImplicitSaveIntent(input: string): boolean {
  const _intents = detectImplicitIntents(input);
  return _intents.some(
    (intent) => intent.type === "save" && intent.confidence >= 0.7,
  );
}

/**
 * Check if input has implicit execution intent
 */
export function hasImplicitExecuteIntent(input: string): boolean {
  const _intents = detectImplicitIntents(input);
  return _intents.some(
    (intent) => intent.type === "execute" && intent.confidence >= 0.7,
  );
}

/**
 * Get highest confidence implicit intent
 */
export function getHighestConfidenceIntent(
  input: string,
): ImplicitIntent | null {
  const _intents = detectImplicitIntents(input);
  if (_intents.length === 0) return null;

  return _intents.reduce((highest, current) =>
    current.confidence > highest.confidence ? current : highest,
  );
}

/**
 * Context-aware implicit intent detection
 */
export function detectContextualIntent(
  _input: string,
  context: {
    previousAction?: string;
    hasGeneratedContent?: boolean;
    currentMode?: string;
  },
): ImplicitIntent[] {
  const _baseIntents = detectImplicitIntents(_input);

  // Enhance confidence based on context
  if (
    context.hasGeneratedContent &&
    !_baseIntents.some((i) => i.type === "save")
  ) {
    // If content was generated but no explicit save, add implicit save with lower confidence
    const _language = detectLanguage(_input);
    baseIntents.push({
      _type: "save",
      confidence: 0.6,
      triggers: ["context: generated content"],
      _language,
    });
  }

  if (
    context.previousAction === "create" &&
    !_baseIntents.some((i) => i.type === "save")
  ) {
    // After creation, save is likely
    const _language = detectLanguage(_input);
    baseIntents.push({
      _type: "save",
      confidence: 0.7,
      triggers: ["context: after creation"],
      _language,
    });
  }

  if (
    context.currentMode?.includes("Testing") &&
    !_baseIntents.some((i) => i.type === "test")
  ) {
    // In testing mode, test intent is likely
    const _language = detectLanguage(_input);
    baseIntents.push({
      _type: "test",
      confidence: 0.75,
      triggers: ["context: testing mode"],
      _language,
    });
  }

  return _baseIntents;
}
