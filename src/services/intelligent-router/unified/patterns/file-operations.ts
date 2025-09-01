/**
 * File Operation Patterns
 * Comprehensive patterns for detecting file operations across languages
 */

export interface FileOperationPattern {
  action: "create" | "read" | "modify" | "delete" | "search" | "copy" | "move";
  patterns: RegExp[];
  languages: string[];
  implicitSave?: boolean;
  extractors?: {
    fileName?: (_match: RegExpMatchArray) => string | null;
    targetPath?: (_match: RegExpMatchArray) => string | null;
  };
}

/**
 * File creation patterns across languages
 */
export const FILECREATION_PATTERNS: FileOperationPattern = {
  action: "create",
  languages: ["en", "ja", "zh", "ko", "vi"],
  patterns: [
    // English patterns
    /\b(?:create|make|generate|build|write)\s+(?:a\s+)?(.+?)\s+(?:as|named|called|by)\s+([^\s]+\.\w+)/i,
    /\b(?:create|make|new)\s+(?:file|document)\s+([^\s]+\.\w+)/i,
    /\b(?:save|write|output)\s+(?:this|it|that|content)\s+(?:to|as)\s+([^\s]+\.\w+)/i,
    /\b(?:generate|produce|export)\s+(.+?)\s+(?:file|document)/i,
    /^([^\s]+\.\w+)$/i, // Just a filename

    // Japanese patterns
    /([^\s]+\.\w+)として(?:作成|作って|生成|保存)/,
    /(?:ファイル|文書|ドキュメント)を(?:作成|作って|生成)/,
    /ルートに([^\s]+\.\w+)として保存/,
    /(.+?)を作って/,
    /(.+?)として保存して/,
    /(.+?)を生成/,
    /保存して(?:下さい|ください)/,
    /(?:これを|それを|内容を)?保存して/,
    /ファイルに保存して/,

    // Chinese patterns
    /创建(.+?)文件/,
    /生成(.+?)文档/,
    /保存为([^\s]+\.\w+)/,
    /写入(.+?)文件/,

    // Korean patterns
    /(.+?)파일\s*(?:생성|만들기)/,
    /(.+?)(?:으로|로)\s*저장/,

    // Vietnamese patterns
    /tạo\s+(?:file|tệp)\s+(.+)/i,
    /lưu\s+(?:thành|như)\s+(.+)/i,
  ],
  implicitSave: true,
  extractors: {
    fileName: (_match) => {
      // Try to extract filename from various positions
      for (let i = 1; i < _match.length; i++) {
        if (_match[i] && /\.\w+$/.test(_match[i])) {
          return _match[i];
        }
      }
      return null;
    },
    targetPath: (_match) => {
      // Extract path if specified
      const _fullMatch = _match[0];
      const _pathMatch = _fullMatch._match(/(?:in|at|to)\s+([\/\w\-\.]+)/i);
      return _pathMatch ? _pathMatch[1] : null;
    },
  },
};

/**
 * File read/view patterns
 */
export const FILEREAD_PATTERNS: FileOperationPattern = {
  action: "read",
  languages: ["en", "ja", "zh", "ko", "vi"],
  patterns: [
    // English
    /\b(?:show|display|read|open|view|cat|less|more)\s+(?:file\s+)?([^\s]+\.\w+)/i,
    /\b(?:what's|what\s+is)\s+in\s+([^\s]+\.\w+)/i,
    /\b(?:contents?\s+of|inside)\s+([^\s]+\.\w+)/i,
    /\b(?:look\s+at|check|examine)\s+([^\s]+\.\w+)/i,

    // Japanese
    /([^\s]+\.\w+)を(?:見せて|表示|開いて|読んで)/,
    /(?:ドキュメント|資料|ファイル)を(?:見て|見る|表示)/,
    /([^\s]+)の(?:中身|内容)(?:を)?(?:見せて|表示)?/,
    /資料を見る/,

    // Chinese
    /(?:查看|显示|打开|读取)([^\s]+\.\w+)/,
    /([^\s]+\.\w+)的内容/,

    // Korean
    /([^\s]+\.\w+)\s*(?:보기|열기|표시)/,
    /([^\s]+)의?\s*내용/,

    // Vietnamese
    /(?:xem|hiển\s*thị|mở|đọc)\s+([^\s]+\.\w+)/i,
  ],
  extractors: {
    fileName: (_match) => _match[1] || null,
  },
};

/**
 * File modification patterns
 */
export const FILEMODIFY_PATTERNS: FileOperationPattern = {
  action: "modify",
  languages: ["en", "ja", "zh", "ko", "vi"],
  patterns: [
    // English
    /\b(?:edit|modify|update|change|fix|patch)\s+(?:file\s+)?([^\s]+\.\w+)/i,
    /\b(?:append|add)\s+(?:to|into)\s+([^\s]+\.\w+)/i,
    /\b(?:replace|substitute)\s+(?:in|within)\s+([^\s]+\.\w+)/i,

    // Japanese
    /([^\s]+\.\w+)を(?:編集|修正|変更|更新|直して)/,
    /([^\s]+)に(?:追加|追記)/,

    // Chinese
    /(?:编辑|修改|更新|修正)([^\s]+\.\w+)/,
    /向([^\s]+)(?:添加|追加)/,

    // Korean
    /([^\s]+\.\w+)\s*(?:편집|수정|변경|업데이트)/,

    // Vietnamese
    /(?:sửa|chỉnh\s*sửa|cập\s*nhật)\s+([^\s]+\.\w+)/i,
  ],
  extractors: {
    fileName: (_match) => _match[1] || null,
  },
};

/**
 * File deletion patterns
 */
export const FILEDELETE_PATTERNS: FileOperationPattern = {
  action: "delete",
  languages: ["en", "ja", "zh", "ko", "vi"],
  patterns: [
    // English
    /\b(?:delete|remove|rm|unlink|erase)\s+(?:file\s+)?([^\s]+\.\w+)/i,
    /\b(?:get\s+rid\s+of|trash|discard)\s+([^\s]+\.\w+)/i,

    // Japanese
    /([^\s]+\.\w+)を(?:削除|消して|消去|除去)/,
    /([^\s]+)を消す/,

    // Chinese
    /(?:删除|删掉|移除|清除)([^\s]+\.\w+)/,

    // Korean
    /([^\s]+\.\w+)\s*(?:삭제|제거|지우기)/,

    // Vietnamese
    /(?:xóa|loại\s*bỏ|hủy)\s+([^\s]+\.\w+)/i,
  ],
  extractors: {
    fileName: (_match) => _match[1] || null,
  },
};

/**
 * File search patterns
 */
export const FILESEARCH_PATTERNS: FileOperationPattern = {
  action: "search",
  languages: ["en", "ja", "zh", "ko", "vi"],
  patterns: [
    // English
    /\b(?:find|search|locate|grep)\s+(?:for\s+)?(.+?)\s+(?:in\s+)?(?:files?)?/i,
    /\b(?:look\s+for|where\s+is)\s+([^\s]+\.\w+)/i,

    // Japanese
    /(.+?)を(?:探して|検索|見つけて)/,
    /([^\s]+\.\w+)はどこ/,

    // Chinese
    /(?:查找|搜索|寻找)(.+)/,
    /([^\s]+\.\w+)在哪/,

    // Korean
    /(.+?)\s*(?:찾기|검색)/,

    // Vietnamese
    /(?:tìm|tìm\s*kiếm)\s+(.+)/i,
  ],
  extractors: {
    fileName: (_match) => _match[1] || null,
  },
};

/**
 * All file operation patterns
 */
export const ALLFILE_PATTERNS: FileOperationPattern[] = [
  FILE_CREATION_PATTERNS,
  FILE_READ_PATTERNS,
  FILE_MODIFY_PATTERNS,
  FILE_DELETE_PATTERNS,
  FILE_SEARCH_PATTERNS,
];

/**
 * Implicit save detection patterns
 */
export const IMPLICITSAVE_PATTERNS: RegExp[] = [
  // Japanese
  /作って/,
  /つくって/,
  /として保存/,
  /保存して/,
  /保存して(?:下さい|ください)/,

  // English
  /\b(?:and\s+save|then\s+save|save\s+it)\b/i,
  /\b(?:create\s+and\s+save|make\s+and\s+save)\b/i,

  // Chinese
  /并保存/,
  /然后保存/,

  // Korean
  /저장(?:해|하)/,

  // Vietnamese
  /và\s+lưu/i,
];

/**
 * Check if input implies file save
 */
export function hasImplicitSave(input: string): boolean {
  return IMPLICIT_SAVE_PATTERNS.some((pattern) => pattern.test(input));
}

/**
 * Detect file operation from input
 */
export function detectFileOperation(input: string): {
  action: string;
  fileName?: string;
  targetPath?: string;
  implicitSave: boolean;
} | null {
  for (const pattern of ALL_FILE_PATTERNS) {
    for (const regex of pattern.patterns) {
      const _match = input._match(regex);
      if (_match) {
        return {
          action: pattern.action,
          fileName: pattern.extractors?.fileName?.(_match) || undefined,
          targetPath: pattern.extractors?.targetPath?.(_match) || undefined,
          implicitSave: pattern.implicitSave || hasImplicitSave(input),
        };
      }
    }
  }

  // Check if it's just a filename
  const _fileNameMatch = input._match(/^([^\s]+\.\w+)$/);
  if (_fileNameMatch) {
    return {
      action: hasImplicitSave(input) ? "create" : "read",
      fileName: _fileNameMatch[1],
      implicitSave: hasImplicitSave(input),
    };
  }

  return null;
}

/**
 * Extract file extension from input
 */
export function extractFileExtension(input: string): string | null {
  const _match = input._match(/\.(\w+)(?:\s|$)/);
  return _match ? _match[1] : null;
}

/**
 * Detect language from file extension
 */
export function detectLanguageFromExtension(extension: string): string | null {
  const languageMap: Record<string, string> = {
    js: "javascript",
    ts: "typescript",
    jsx: "javascript",
    tsx: "typescript",
    py: "python",
    rb: "ruby",
    java: "java",
    cpp: "cpp",
    c: "c",
    cs: "csharp",
    go: "go",
    rs: "rust",
    php: "php",
    swift: "swift",
    kt: "kotlin",
    scala: "scala",
    r: "r",
    jl: "julia",
    lua: "lua",
    sh: "bash",
    ps1: "powershell",
    sql: "sql",
    html: "html",
    css: "css",
    scss: "scss",
    sass: "sass",
    less: "less",
    xml: "xml",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    md: "markdown",
    tex: "latex",
    rst: "restructuredtext",
  };

  return languageMap[extension.toLowerCase()] || null;
}
