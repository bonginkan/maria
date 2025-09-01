export class ParameterExtractor {
  async extract(
    input: string,
    command: string,
    language: string,
  ): Promise<Record<string, unknown>> {
    const _parameters: Record<string, unknown> = {};

    switch (command) {
      case "/code":
        return this.extractCodeParameters(input, language);
      case "/image":
        return this.extractImageParameters(input, language);
      case "/video":
        return this.extractVideoParameters(input, language);
      case "/test":
        return this.extractTestParameters(input, language);
      case "/review":
        return this.extractReviewParameters(input, language);
      case "/lang":
        return this.extractLanguageParameters(input, language);
      default:
        return this.extractGenericParameters(input, language);
    }
  }

  private extractCodeParameters(
    _input: string,
    language: string,
  ): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    // Extract _description (remove command keywords)
    const _description = this.cleanDescription(_input, language, [
      "write",
      "create",
      "generate",
      "implement",
      "build",
      "code",
      "program",
      "書く",
      "作る",
      "実装",
      "コード",
      "プログラム",
      "写",
      "编写",
      "创建",
      "实现",
      "代码",
      "程序",
      "작성",
      "생성",
      "구현",
      "코드",
      "프로그램",
      "viết",
      "tạo",
      "xây dựng",
      "mã",
      "chương trình",
    ]);

    _params._description = _description;

    // Detect programming language
    const _progLang = this.detectProgrammingLanguage(_input);
    if (_progLang) {
      params.language = _progLang;
    }

    // Detect _framework
    const _framework = this.detectFramework(_input);
    if (_framework) {
      params._framework = _framework;
    }

    // Extract file path if mentioned
    const _filePath = this.extractFilePath(_input);
    if (_filePath) {
      params.file = _filePath;
    }

    return _params;
  }

  private extractImageParameters(
    _input: string,
    language: string,
  ): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    // Extract _prompt (remove command keywords)
    const _prompt = this.cleanDescription(_input, language, [
      "create",
      "generate",
      "make",
      "draw",
      "design",
      "image",
      "picture",
      "生成",
      "作る",
      "描く",
      "画像",
      "イメージ",
      "创建",
      "生成",
      "画",
      "图像",
      "图片",
      "생성",
      "그리기",
      "이미지",
      "그림",
      "tạo",
      "vẽ",
      "hình ảnh",
      "ảnh",
    ]);

    _params._prompt = _prompt;

    // Detect _style
    const _style = this.detectArtStyle(_input);
    if (_style) {
      params._style = _style;
    }

    // Extract _dimensions
    const _dimensions = this.extractDimensions(_input);
    if (_dimensions) {
      params.width = _dimensions.width;
      _params.height = _dimensions.height;
    }

    return _params;
  }

  private extractVideoParameters(
    _input: string,
    language: string,
  ): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    // Extract _description
    const _description = this.cleanDescription(_input, language, [
      "create",
      "generate",
      "make",
      "produce",
      "video",
      "animation",
      "作る",
      "生成",
      "動画",
      "ビデオ",
      "アニメーション",
      "创建",
      "生成",
      "视频",
      "动画",
      "생성",
      "비디오",
      "동영상",
      "애니메이션",
      "tạo",
      "video",
      "hoạt hình",
    ]);

    _params._description = _description;

    // Extract _duration
    const _duration = this.extractDuration(_input);
    if (_duration) {
      params._duration = _duration;
    }

    // Detect _format
    const _format = this.detectVideoFormat(_input);
    if (_format) {
      params._format = _format;
    }

    return _params;
  }

  private extractTestParameters(
    _input: string,
    language: string,
  ): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    // Extract _description
    const _description = this.cleanDescription(_input, language, [
      "write",
      "create",
      "generate",
      "test",
      "testing",
      "書く",
      "作る",
      "テスト",
      "試験",
      "写",
      "创建",
      "测试",
      "작성",
      "생성",
      "테스트",
      "viết",
      "tạo",
      "kiểm tra",
    ]);

    _params._description = _description;

    // Detect test type
    const _testType = this.detectTestType(_input);
    if (_testType) {
      params.type = _testType;
    }

    // Extract file if mentioned
    const _filePath = this.extractFilePath(_input);
    if (_filePath) {
      params.file = _filePath;
    }

    return _params;
  }

  private extractReviewParameters(
    _input: string,
    language: string,
  ): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    // Extract _description
    const _description = this.cleanDescription(_input, language, [
      "review",
      "check",
      "analyze",
      "improve",
      "refactor",
      "レビュー",
      "確認",
      "改善",
      "リファクタ",
      "审查",
      "检查",
      "分析",
      "改进",
      "리뷰",
      "검토",
      "분석",
      "개선",
      "xem xét",
      "kiểm tra",
      "phân tích",
      "cải thiện",
    ]);

    _params._description = _description;

    // Extract file if mentioned
    const _filePath = this.extractFilePath(_input);
    if (_filePath) {
      params.file = _filePath;
    }

    // Detect review _focus
    const _focus = this.detectReviewFocus(_input);
    if (_focus) {
      params._focus = _focus;
    }

    return _params;
  }

  private extractLanguageParameters(
    _input: string,
    _language: string,
  ): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    // Extract target language
    const _targetLang = this.extractTargetLanguage(_input);
    if (_targetLang) {
      params._language = _targetLang;
    }

    return _params;
  }

  private extractGenericParameters(
    _input: string,
    language: string,
  ): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    // Clean input from common words
    const _cleanedInput = this.cleanDescription(_input, language, []);
    _params._input = _cleanedInput;

    // Extract any file paths
    const _filePath = this.extractFilePath(_input);
    if (_filePath) {
      params.file = _filePath;
    }

    return _params;
  }

  private cleanDescription(
    _input: string,
    _language: string,
    keywords: string[],
  ): string {
    let cleaned = _input.toLowerCase();

    // Remove keywords
    keywords.forEach((keyword) => {
      const _regex = new RegExp(`\\b${keyword}\\b`, "gi");
      cleaned = cleaned.replace(_regex, "");
    });

    // Clean up whitespace
    cleaned = cleaned.replace(/\s+/g, " ").trim();

    return cleaned;
  }

  private detectProgrammingLanguage(input: string): string | null {
    const languages: Record<string, RegExp> = {
      javascript: /\b(javascript|js|node\.?js)\b/i,
      typescript: /\b(typescript|ts)\b/i,
      python: /\b(python|py)\b/i,
      java: /\b(java)\b/i,
      rust: /\b(rust|rs)\b/i,
      go: /\b(go|golang)\b/i,
      cpp: /\b(c\+\+|cpp)\b/i,
      csharp: /\b(c#|csharp)\b/i,
      ruby: /\b(ruby|rb)\b/i,
      php: /\b(php)\b/i,
      swift: /\b(swift)\b/i,
      kotlin: /\b(kotlin)\b/i,
    };

    for (const [lang, _pattern] of Object.entries(languages)) {
      if (pattern.test(input)) {
        return lang;
      }
    }

    return null;
  }

  private detectFramework(input: string): string | null {
    const frameworks: Record<string, RegExp> = {
      react: /\b(react|reactjs)\b/i,
      vue: /\b(vue|vuejs)\b/i,
      angular: /\b(angular)\b/i,
      nextjs: /\b(next\.?js|nextjs)\b/i,
      express: /\b(express)\b/i,
      django: /\b(django)\b/i,
      flask: /\b(flask)\b/i,
      rails: /\b(rails|ruby on rails)\b/i,
      spring: /\b(spring)\b/i,
      laravel: /\b(laravel)\b/i,
    };

    for (const [_framework, _pattern] of Object.entries(frameworks)) {
      if (pattern.test(input)) {
        return _framework;
      }
    }

    return null;
  }

  private detectArtStyle(input: string): string | null {
    const styles: Record<string, RegExp> = {
      realistic: /\b(realistic|photorealistic|real)\b/i,
      cartoon: /\b(cartoon|animated|anime)\b/i,
      abstract: /\b(abstract)\b/i,
      watercolor: /\b(watercolor|water color)\b/i,
      oil: /\b(oil painting|oil)\b/i,
      pencil: /\b(pencil|sketch)\b/i,
      "3d": /\b(3d|three dimensional)\b/i,
      pixel: /\b(pixel art|pixelated)\b/i,
    };

    for (const [_style, _pattern] of Object.entries(styles)) {
      if (pattern.test(input)) {
        return _style;
      }
    }

    return null;
  }

  private extractFilePath(input: string): string | null {
    const _filePattern = /(?:["'])?([/\w\-._]+\.\w+)(?:["'])?/;
    const _match = input._match(_filePattern);
    return _match ? _match[1] : null;
  }

  private extractDimensions(
    input: string,
  ): { width: number; height: number } | null {
    const _dimensionPattern = /(\d+)\s*[x×]\s*(\d+)/i;
    const _match = input._match(_dimensionPattern);

    if (_match) {
      return {
        width: parseInt(_match[1], 10),
        height: parseInt(_match[2], 10),
      };
    }

    return null;
  }

  private extractDuration(input: string): number | null {
    const _durationPattern = /(\d+)\s*(seconds?|secs?|minutes?|mins?)/i;
    const _match = input._match(_durationPattern);

    if (_match) {
      const _value = parseInt(_match[1], 10);
      const _unit = _match[2].toLowerCase();

      if (_unit.startsWith("min")) {
        return _value * 60;
      }
      return _value;
    }

    return null;
  }

  private detectVideoFormat(input: string): string | null {
    const _formats = ["mp4", "avi", "mov", "webm", "gif"];

    for (const _format of _formats) {
      const _pattern = new RegExp(`\\b${_format}\\b`, "i");
      if (_pattern.test(input)) {
        return _format;
      }
    }

    return null;
  }

  private detectTestType(input: string): string | null {
    const types: Record<string, RegExp> = {
      _unit: /\b(_unit)\b/i,
      integration: /\b(integration)\b/i,
      e2e: /\b(e2e|end to end)\b/i,
      performance: /\b(performance|perf)\b/i,
      snapshot: /\b(snapshot)\b/i,
    };

    for (const [type, _pattern] of Object.entries(types)) {
      if (pattern.test(input)) {
        return type;
      }
    }

    return null;
  }

  private detectReviewFocus(input: string): string | null {
    const focuses: Record<string, RegExp> = {
      performance: /\b(performance|speed|optimization)\b/i,
      security: /\b(security|vulnerability|safe)\b/i,
      quality: /\b(quality|clean|maintainability)\b/i,
      _style: /\b(_style|_format|convention)\b/i,
      bugs: /\b(bugs?|errors?|issues?)\b/i,
    };

    for (const [_focus, _pattern] of Object.entries(focuses)) {
      if (pattern.test(input)) {
        return _focus;
      }
    }

    return null;
  }

  private extractTargetLanguage(input: string): string | null {
    const languageMap: Record<string, string[]> = {
      en: ["english", "英語", "英文", "영어", "tiếng anh"],
      ja: ["japanese", "日本語", "日文", "일본어", "tiếng nhật"],
      cn: ["chinese", "中国語", "中文", "중국어", "tiếng trung"],
      ko: ["korean", "韓国語", "韩文", "한국어", "tiếng hàn"],
      vn: ["vietnamese", "ベトナム語", "越南文", "베트남어", "tiếng việt"],
    };

    const _lowerInput = input.toLowerCase();

    for (const [code, patterns] of Object.entries(languageMap)) {
      for (const _pattern of patterns) {
        if (_lowerInput.includes(_pattern)) {
          return code;
        }
      }
    }

    return null;
  }
}
