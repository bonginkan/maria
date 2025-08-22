export class ParameterExtractor {
  async extract(
    input: string,
    command: string,
    language: string,
  ): Promise<Record<string, unknown>> {
    const __parameters: Record<string, unknown> = {};

    switch (command) {
      case '/code':
        return this.extractCodeParameters(input, language);
      case '/image':
        return this.extractImageParameters(input, language);
      case '/video':
        return this.extractVideoParameters(input, language);
      case '/test':
        return this.extractTestParameters(input, language);
      case '/review':
        return this.extractReviewParameters(input, language);
      case '/lang':
        return this.extractLanguageParameters(input, language);
      default:
        return this.extractGenericParameters(input, language);
    }
  }

  private extractCodeParameters(input: string, language: string): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    // Extract description (remove command keywords)
    const description = this.cleanDescription(input, language, [
      'write',
      'create',
      'generate',
      'implement',
      'build',
      'code',
      'program',
      '書く',
      '作る',
      '実装',
      'コード',
      'プログラム',
      '写',
      '编写',
      '创建',
      '实现',
      '代码',
      '程序',
      '작성',
      '생성',
      '구현',
      '코드',
      '프로그램',
      'viết',
      'tạo',
      'xây dựng',
      'mã',
      'chương trình',
    ]);

    params.description = description;

    // Detect programming language
    const progLang = this.detectProgrammingLanguage(input);
    if (progLang) {
      params.language = progLang;
    }

    // Detect framework
    const framework = this.detectFramework(input);
    if (framework) {
      params.framework = framework;
    }

    // Extract file path if mentioned
    const filePath = this.extractFilePath(input);
    if (filePath) {
      params.file = filePath;
    }

    return params;
  }

  private extractImageParameters(input: string, language: string): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    // Extract prompt (remove command keywords)
    const prompt = this.cleanDescription(input, language, [
      'create',
      'generate',
      'make',
      'draw',
      'design',
      'image',
      'picture',
      '生成',
      '作る',
      '描く',
      '画像',
      'イメージ',
      '创建',
      '生成',
      '画',
      '图像',
      '图片',
      '생성',
      '그리기',
      '이미지',
      '그림',
      'tạo',
      'vẽ',
      'hình ảnh',
      'ảnh',
    ]);

    params.prompt = prompt;

    // Detect style
    const style = this.detectArtStyle(input);
    if (style) {
      params.style = style;
    }

    // Extract dimensions
    const dimensions = this.extractDimensions(input);
    if (dimensions) {
      params.width = dimensions.width;
      params.height = dimensions.height;
    }

    return params;
  }

  private extractVideoParameters(input: string, language: string): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    // Extract description
    const description = this.cleanDescription(input, language, [
      'create',
      'generate',
      'make',
      'produce',
      'video',
      'animation',
      '作る',
      '生成',
      '動画',
      'ビデオ',
      'アニメーション',
      '创建',
      '生成',
      '视频',
      '动画',
      '생성',
      '비디오',
      '동영상',
      '애니메이션',
      'tạo',
      'video',
      'hoạt hình',
    ]);

    params.description = description;

    // Extract duration
    const duration = this.extractDuration(input);
    if (duration) {
      params.duration = duration;
    }

    // Detect format
    const format = this.detectVideoFormat(input);
    if (format) {
      params.format = format;
    }

    return params;
  }

  private extractTestParameters(input: string, language: string): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    // Extract description
    const description = this.cleanDescription(input, language, [
      'write',
      'create',
      'generate',
      'test',
      'testing',
      '書く',
      '作る',
      'テスト',
      '試験',
      '写',
      '创建',
      '测试',
      '작성',
      '생성',
      '테스트',
      'viết',
      'tạo',
      'kiểm tra',
    ]);

    params.description = description;

    // Detect test type
    const testType = this.detectTestType(input);
    if (testType) {
      params.type = testType;
    }

    // Extract file if mentioned
    const filePath = this.extractFilePath(input);
    if (filePath) {
      params.file = filePath;
    }

    return params;
  }

  private extractReviewParameters(input: string, language: string): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    // Extract description
    const description = this.cleanDescription(input, language, [
      'review',
      'check',
      'analyze',
      'improve',
      'refactor',
      'レビュー',
      '確認',
      '改善',
      'リファクタ',
      '审查',
      '检查',
      '分析',
      '改进',
      '리뷰',
      '검토',
      '분석',
      '개선',
      'xem xét',
      'kiểm tra',
      'phân tích',
      'cải thiện',
    ]);

    params.description = description;

    // Extract file if mentioned
    const filePath = this.extractFilePath(input);
    if (filePath) {
      params.file = filePath;
    }

    // Detect review focus
    const focus = this.detectReviewFocus(input);
    if (focus) {
      params.focus = focus;
    }

    return params;
  }

  private extractLanguageParameters(input: string, _language: string): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    // Extract target language
    const targetLang = this.extractTargetLanguage(input);
    if (targetLang) {
      params.language = targetLang;
    }

    return params;
  }

  private extractGenericParameters(input: string, language: string): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    // Clean input from common words
    const cleanedInput = this.cleanDescription(input, language, []);
    params.input = cleanedInput;

    // Extract any file paths
    const filePath = this.extractFilePath(input);
    if (filePath) {
      params.file = filePath;
    }

    return params;
  }

  private cleanDescription(input: string, language: string, keywords: string[]): string {
    let cleaned = input.toLowerCase();

    // Remove keywords
    keywords.forEach((keyword) => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      cleaned = cleaned.replace(regex, '');
    });

    // Clean up whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

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

    for (const [lang, pattern] of Object.entries(languages)) {
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

    for (const [framework, pattern] of Object.entries(frameworks)) {
      if (pattern.test(input)) {
        return framework;
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
      '3d': /\b(3d|three dimensional)\b/i,
      pixel: /\b(pixel art|pixelated)\b/i,
    };

    for (const [style, pattern] of Object.entries(styles)) {
      if (pattern.test(input)) {
        return style;
      }
    }

    return null;
  }

  private extractFilePath(input: string): string | null {
    const filePattern = /(?:["'])?([/\w\-._]+\.\w+)(?:["'])?/;
    const match = input.match(filePattern);
    return match ? match[1] : null;
  }

  private extractDimensions(input: string): { width: number; height: number } | null {
    const dimensionPattern = /(\d+)\s*[x×]\s*(\d+)/i;
    const match = input.match(dimensionPattern);

    if (match) {
      return {
        width: parseInt(match[1], 10),
        height: parseInt(match[2], 10),
      };
    }

    return null;
  }

  private extractDuration(input: string): number | null {
    const durationPattern = /(\d+)\s*(seconds?|secs?|minutes?|mins?)/i;
    const match = input.match(durationPattern);

    if (match) {
      const value = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();

      if (unit.startsWith('min')) {
        return value * 60;
      }
      return value;
    }

    return null;
  }

  private detectVideoFormat(input: string): string | null {
    const formats = ['mp4', 'avi', 'mov', 'webm', 'gif'];

    for (const format of formats) {
      const pattern = new RegExp(`\\b${format}\\b`, 'i');
      if (pattern.test(input)) {
        return format;
      }
    }

    return null;
  }

  private detectTestType(input: string): string | null {
    const types: Record<string, RegExp> = {
      unit: /\b(unit)\b/i,
      integration: /\b(integration)\b/i,
      e2e: /\b(e2e|end to end)\b/i,
      performance: /\b(performance|perf)\b/i,
      snapshot: /\b(snapshot)\b/i,
    };

    for (const [type, pattern] of Object.entries(types)) {
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
      style: /\b(style|format|convention)\b/i,
      bugs: /\b(bugs?|errors?|issues?)\b/i,
    };

    for (const [focus, pattern] of Object.entries(focuses)) {
      if (pattern.test(input)) {
        return focus;
      }
    }

    return null;
  }

  private extractTargetLanguage(input: string): string | null {
    const languageMap: Record<string, string[]> = {
      en: ['english', '英語', '英文', '영어', 'tiếng anh'],
      ja: ['japanese', '日本語', '日文', '일본어', 'tiếng nhật'],
      cn: ['chinese', '中国語', '中文', '중국어', 'tiếng trung'],
      ko: ['korean', '韓国語', '韩文', '한국어', 'tiếng hàn'],
      vn: ['vietnamese', 'ベトナム語', '越南文', '베트남어', 'tiếng việt'],
    };

    const lowerInput = input.toLowerCase();

    for (const [code, patterns] of Object.entries(languageMap)) {
      for (const pattern of patterns) {
        if (lowerInput.includes(pattern)) {
          return code;
        }
      }
    }

    return null;
  }
}
