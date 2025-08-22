/**
 * Command Mapping Service
 * Manages natural language mappings to slash commands for all 30 MARIA commands
 */

import { BaseService, Service } from '../core';

export interface CommandMapping {
  command: string;
  description: string;
  phrases: Record<string, string[]>; // language -> phrases
  category: string;
  aliases: string[];
}

@Service({
  id: 'command-mapping',
  name: 'CommandMappingService',
  version: '1.0.0',
  description: 'Command mapping service for all 30 MARIA slash commands',
})
export class CommandMappingService extends BaseService {
  id = 'command-mapping';
  version = '1.0.0';

  private commandMappings: Map<string, CommandMapping> = new Map();

  async onInitialize(): Promise<void> {
    this.logger.info('Initializing Command Mapping Service...');
    this.initializeCommandMappings();
  }

  async onStart(): Promise<void> {
    this.logger.info('Starting Command Mapping Service...');
    this.emitServiceEvent('command-mapping:started', {
      totalCommands: this.commandMappings.size,
    });
  }

  /**
   * Get command mappings for a specific language
   */
  async getMappingsForLanguage(options: { language: string }): Promise<Record<string, string[]>> {
    const { language } = options;
    const mappings: Record<string, string[]> = {};

    for (const [command, mapping] of this.commandMappings.entries()) {
      const phrases = mapping.phrases[language] || mapping.phrases['english'] || [];
      if (phrases.length > 0) {
        mappings[command] = phrases;
      }
    }

    return mappings;
  }

  /**
   * Get all available commands
   */
  async getAllCommands(): Promise<string[]> {
    return Array.from(this.commandMappings.keys());
  }

  /**
   * Get command details
   */
  async getCommandDetails(options: { command: string }): Promise<CommandMapping | null> {
    return this.commandMappings.get(options.command) || null;
  }

  /**
   * Search commands by phrase
   */
  async searchCommands(options: {
    phrase: string;
    language?: string;
  }): Promise<Array<{ command: string; score: number }>> {
    const { phrase, language = 'english' } = options;
    const normalizedPhrase = phrase.toLowerCase();
    const results: Array<{ command: string; score: number }> = [];

    for (const [command, mapping] of this.commandMappings.entries()) {
      const phrases = mapping.phrases[language] || mapping.phrases['english'] || [];
      let maxScore = 0;

      for (const mappingPhrase of phrases) {
        const score = this.calculateSimilarity(normalizedPhrase, mappingPhrase.toLowerCase());
        maxScore = Math.max(maxScore, score);
      }

      if (maxScore > 0.3) {
        results.push({ command, score: maxScore });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Initialize all 30 command mappings
   */
  private initializeCommandMappings(): void {
    // Core Development Commands
    this.addCommandMapping('/code', {
      command: '/code',
      description: 'Generate, write, or modify code',
      category: 'development',
      aliases: ['code', 'implement', 'program'],
      phrases: {
        japanese: [
          'コードを書いて',
          'プログラムを作って',
          '実装して',
          '関数を書いて',
          'クラスを作成',
          'メソッドを追加',
          'コードを生成',
          'プログラミング',
          'ソースコードを',
          '開発して',
        ],
        english: [
          'write code',
          'implement',
          'create function',
          'build class',
          'add method',
          'generate code',
          'program',
          'develop',
          'code this',
          'implement this',
          'write function',
          'create class',
        ],
        chinese: [
          '写代码',
          '编程',
          '实现',
          '创建函数',
          '构建类',
          '添加方法',
          '生成代码',
          '开发',
          '编写程序',
        ],
        korean: [
          '코드 작성',
          '프로그래밍',
          '구현해줘',
          '함수 만들어',
          '클래스 생성',
          '메소드 추가',
          '코드 생성',
          '개발해줘',
        ],
        vietnamese: [
          'viết code',
          'lập trình',
          'thực hiện',
          'tạo hàm',
          'xây dựng class',
          'thêm method',
          'tạo mã',
          'phát triển',
        ],
      },
    });

    this.addCommandMapping('/image', {
      command: '/image',
      description: 'Generate images, illustrations, or graphics',
      category: 'media',
      aliases: ['image', 'picture', 'visual'],
      phrases: {
        japanese: [
          '画像を生成',
          'イメージを作って',
          '絵を描いて',
          'ビジュアルを作成',
          '図を生成',
          'イラストを',
          '写真を作って',
          'グラフィックを',
        ],
        english: [
          'create image',
          'generate picture',
          'make visual',
          'draw illustration',
          'produce graphic',
          'create artwork',
          'generate image',
          'make picture',
        ],
        chinese: ['生成图像', '创建图片', '画一幅画', '制作插图', '生成图形', '创作图片'],
        korean: [
          '이미지 생성',
          '그림 그려줘',
          '일러스트 만들어',
          '그래픽 제작',
          '사진 만들어',
          '비주얼 생성',
        ],
        vietnamese: [
          'tạo hình ảnh',
          'vẽ tranh',
          'tạo ảnh',
          'làm hình minh họa',
          'tạo đồ họa',
          'sinh ảnh',
        ],
      },
    });

    this.addCommandMapping('/video', {
      command: '/video',
      description: 'Generate videos, animations, or motion graphics',
      category: 'media',
      aliases: ['video', 'animation', 'movie'],
      phrases: {
        japanese: [
          '動画を作って',
          'ビデオを生成',
          'アニメーションを',
          'ムービーを作成',
          '動画を出力',
          '映像を作成',
        ],
        english: [
          'create video',
          'generate animation',
          'make movie',
          'produce clip',
          'render video',
          'create motion graphics',
        ],
        chinese: ['创建视频', '生成动画', '制作影片', '创建动画', '生成视频'],
        korean: ['비디오 생성', '동영상 만들어', '애니메이션 제작', '영상 만들기'],
        vietnamese: ['tạo video', 'làm phim hoạt hình', 'tạo phim', 'sản xuất video'],
      },
    });

    // Document and Content Commands
    this.addCommandMapping('/document', {
      command: '/document',
      description: 'Create or process documents',
      category: 'content',
      aliases: ['document', 'docs', 'doc'],
      phrases: {
        japanese: [
          'ドキュメントを作成',
          '文書を書いて',
          '資料を作って',
          'マークダウンで',
          '説明書を',
          'ドキュメント化',
        ],
        english: [
          'create document',
          'write docs',
          'make documentation',
          'generate document',
          'create markdown',
          'write documentation',
        ],
        chinese: ['创建文档', '写文档', '制作文件', '生成文档', '文档化'],
        korean: ['문서 생성', '도큐먼트 만들어', '문서 작성', '자료 만들기'],
        vietnamese: ['tạo tài liệu', 'viết tài liệu', 'làm văn bản', 'tạo document'],
      },
    });

    this.addCommandMapping('/slides', {
      command: '/slides',
      description: 'Create presentation slides',
      category: 'content',
      aliases: ['slides', 'presentation', 'deck'],
      phrases: {
        japanese: [
          'スライドを作成',
          'プレゼンを作って',
          '発表資料を',
          'スライドショー',
          'プレゼンテーション',
        ],
        english: [
          'create slides',
          'make presentation',
          'generate slideshow',
          'create deck',
          'build presentation',
        ],
        chinese: ['创建幻灯片', '制作演示', '生成PPT', '创建演示文稿'],
        korean: ['슬라이드 생성', '프레젠테이션 만들어', '발표자료 만들기'],
        vietnamese: ['tạo slide', 'làm thuyết trình', 'tạo bài thuyết trình'],
      },
    });

    // Quality and Analysis Commands
    this.addCommandMapping('/bug', {
      command: '/bug',
      description: 'Find and fix bugs or issues',
      category: 'quality',
      aliases: ['bug', 'debug', 'fix'],
      phrases: {
        japanese: [
          'バグを修正',
          'エラーを直して',
          '不具合を',
          'デバッグして',
          '問題を解決',
          'バグ修正',
        ],
        english: [
          'fix bug',
          'debug issue',
          'find bug',
          'solve problem',
          'fix error',
          'debug code',
          'troubleshoot',
        ],
        chinese: ['修复错误', '调试', '解决问题', '修正bug', '查找错误'],
        korean: ['버그 수정', '오류 해결', '디버그해줘', '문제 해결'],
        vietnamese: ['sửa lỗi', 'debug', 'tìm bug', 'giải quyết vấn đề'],
      },
    });

    this.addCommandMapping('/lint', {
      command: '/lint',
      description: 'Check code quality and style',
      category: 'quality',
      aliases: ['lint', 'check', 'quality'],
      phrases: {
        japanese: [
          'コードをチェック',
          'リントして',
          '品質チェック',
          'コード検査',
          'スタイルチェック',
        ],
        english: [
          'lint code',
          'check quality',
          'analyze code',
          'code review',
          'check style',
          'validate code',
        ],
        chinese: ['检查代码', '代码质量', '代码检测', '代码分析'],
        korean: ['코드 검사', '린트 체크', '품질 확인', '코드 분석'],
        vietnamese: ['kiểm tra code', 'phân tích chất lượng', 'lint code'],
      },
    });

    this.addCommandMapping('/typecheck', {
      command: '/typecheck',
      description: 'Check TypeScript types and type safety',
      category: 'quality',
      aliases: ['typecheck', 'types', 'typescript'],
      phrases: {
        japanese: ['型チェック', 'TypeScriptチェック', '型検査', 'タイプチェック'],
        english: [
          'check types',
          'typecheck',
          'typescript check',
          'validate types',
          'type validation',
        ],
        chinese: ['类型检查', 'TypeScript检查', '类型验证'],
        korean: ['타입 체크', 'TypeScript 검사', '타입 검증'],
        vietnamese: ['kiểm tra kiểu', 'type check', 'kiểm tra TypeScript'],
      },
    });

    this.addCommandMapping('/security-review', {
      command: '/security-review',
      description: 'Security analysis and vulnerability check',
      category: 'security',
      aliases: ['security', 'security-review', 'vulnerability'],
      phrases: {
        japanese: [
          'セキュリティチェック',
          '脆弱性検査',
          'セキュリティレビュー',
          'セキュリティ分析',
        ],
        english: [
          'security review',
          'security check',
          'vulnerability scan',
          'security analysis',
          'check security',
          'security audit',
        ],
        chinese: ['安全检查', '安全审查', '漏洞扫描', '安全分析'],
        korean: ['보안 검사', '보안 리뷰', '취약점 분석', '보안 점검'],
        vietnamese: ['kiểm tra bảo mật', 'phân tích an ninh', 'rà soát bảo mật'],
      },
    });

    // AI and Advanced Commands
    this.addCommandMapping('/coderag', {
      command: '/coderag',
      description: 'AI-powered code search and retrieval',
      category: 'ai',
      aliases: ['coderag', 'search', 'find'],
      phrases: {
        japanese: ['コードを検索', 'コード検索', 'AIで検索', 'コードを探して', 'ソースコード検索'],
        english: [
          'search code',
          'find code',
          'code search',
          'search codebase',
          'find function',
          'search files',
        ],
        chinese: ['搜索代码', '查找代码', '代码搜索', '查找函数'],
        korean: ['코드 검색', '코드 찾기', '소스코드 검색'],
        vietnamese: ['tìm kiếm code', 'tìm code', 'search code'],
      },
    });

    // Add remaining commands with similar pattern...
    // Chat and Communication
    this.addCommandMapping('/chat', {
      command: '/chat',
      description: 'General chat conversation',
      category: 'communication',
      aliases: ['chat', 'talk', 'conversation'],
      phrases: {
        japanese: ['チャット', '会話', '話そう', '相談'],
        english: ['chat', 'talk', 'conversation', 'discuss'],
        chinese: ['聊天', '对话', '交谈'],
        korean: ['채팅', '대화', '이야기'],
        vietnamese: ['trò chuyện', 'nói chuyện', 'chat'],
      },
    });

    // Model and System Commands
    this.addCommandMapping('/model', {
      command: '/model',
      description: 'Switch or configure AI models',
      category: 'system',
      aliases: ['model', 'switch', 'configure'],
      phrases: {
        japanese: ['モデル切り替え', 'AIモデル', 'モデル設定'],
        english: ['switch model', 'change model', 'configure model', 'select model'],
        chinese: ['切换模型', '模型设置', '选择模型'],
        korean: ['모델 변경', '모델 설정', '모델 선택'],
        vietnamese: ['đổi model', 'chọn model', 'cấu hình model'],
      },
    });

    // Add more commands following the same pattern...
    this.addRemainingCommands();
  }

  /**
   * Add remaining commands (20+ more)
   */
  private addRemainingCommands(): void {
    // Add all other commands with basic mappings
    const additionalCommands = [
      '/email',
      '/calendar',
      '/task',
      '/note',
      '/search',
      '/file',
      '/git',
      '/deploy',
      '/test',
      '/benchmark',
      '/profile',
      '/optimize',
      '/translate',
      '/summarize',
      '/explain',
      '/help',
      '/status',
      '/config',
      '/export',
      '/import',
      '/backup',
      '/restore',
      '/monitor',
      '/log',
    ];

    for (const command of additionalCommands) {
      const commandName = command.substring(1); // Remove '/'
      this.addCommandMapping(command, {
        command,
        description: `Execute ${commandName} operation`,
        category: 'general',
        aliases: [commandName],
        phrases: {
          japanese: [commandName, `${commandName}して`, `${commandName}を実行`],
          english: [commandName, `${commandName} this`, `run ${commandName}`],
          chinese: [commandName, `执行${commandName}`, `运行${commandName}`],
          korean: [commandName, `${commandName} 실행`, `${commandName} 해줘`],
          vietnamese: [commandName, `chạy ${commandName}`, `thực hiện ${commandName}`],
        },
      });
    }
  }

  /**
   * Add a command mapping
   */
  private addCommandMapping(command: string, mapping: CommandMapping): void {
    this.commandMappings.set(command, mapping);
  }

  /**
   * Calculate similarity between two strings
   */
  private calculateSimilarity(str1: string, str2: string): number {
    // Simple similarity calculation
    if (str1 === str2) {return 1.0;}
    if (str1.includes(str2) || str2.includes(str1)) {return 0.8;}

    // Word overlap
    const words1 = str1.split(/\s+/);
    const words2 = str2.split(/\s+/);
    const overlap = words1.filter((word) => words2.includes(word)).length;

    return overlap / Math.max(words1.length, words2.length);
  }

  /**
   * Get service statistics
   */
  getStats() {
    const categoryCount: Record<string, number> = {};
    const languageCount: Record<string, number> = {};

    for (const mapping of this.commandMappings.values()) {
      categoryCount[mapping.category] = (categoryCount[mapping.category] || 0) + 1;

      for (const lang of Object.keys(mapping.phrases)) {
        languageCount[lang] = (languageCount[lang] || 0) + 1;
      }
    }

    return {
      totalCommands: this.commandMappings.size,
      categories: categoryCount,
      languages: languageCount,
      supportedLanguages: Object.keys(languageCount),
    };
  }
}
