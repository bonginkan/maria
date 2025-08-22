export interface CommandTranslation {
  command: string;
  name: Record<string, string>;
  description: Record<string, string>;
  keywords: Record<string, string[]>;
  examples: Record<string, string[]>;
}

export class MultilingualDictionary {
  private dictionary: Map<string, CommandTranslation>;
  private initialized: boolean = false;

  constructor() {
    this.dictionary = new Map();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {return;}

    this.loadTranslations();
    this.initialized = true;
  }

  getTranslation(command: string, _language: string = 'en'): CommandTranslation | null {
    return this.dictionary.get(command) ?? null;
  }

  getExplanation(command: string, language: string = 'en'): string {
    const translation = this.dictionary.get(command);
    if (!translation) {
      return `Command ${command} not found`;
    }

    return translation.description[language] ?? translation.description['en'] ?? '';
  }

  getKeywords(command: string, language: string = 'en'): string[] {
    const translation = this.dictionary.get(command);
    if (!translation) {
      return [];
    }

    return translation.keywords[language] ?? translation.keywords['en'] ?? [];
  }

  getExamples(command: string, language: string = 'en'): string[] {
    const translation = this.dictionary.get(command);
    if (!translation) {
      return [];
    }

    return translation.examples[language] ?? translation.examples['en'] ?? [];
  }

  getAllCommands(): string[] {
    return Array.from(this.dictionary.keys());
  }

  private loadTranslations(): void {
    // Core Development Commands
    this.dictionary.set('/code', {
      command: '/code',
      name: {
        en: 'Code Generation',
        ja: 'コード生成',
        zh: '代码生成',
        ko: '코드 생성',
      },
      description: {
        en: 'Generate code with AI assistance',
        ja: 'AI支援によるコード生成',
        zh: '使用AI辅助生成代码',
        ko: 'AI 지원 코드 생성',
      },
      keywords: {
        en: [
          'write',
          'create',
          'generate',
          'implement',
          'build',
          'code',
          'program',
          'develop',
          'function',
          'class',
        ],
        ja: ['コード', '実装', 'プログラム', '関数', 'クラス', '作成', '開発', '書く', '生成'],
        zh: ['代码', '编写', '实现', '程序', '函数', '类', '创建', '开发', '生成'],
        ko: ['코드', '프로그램', '함수', '클래스', '구현', '개발', '작성', '생성'],
      },
      examples: {
        en: ['write a React component', 'create a REST API', 'implement user authentication'],
        ja: ['Reactコンポーネントを実装して', 'REST APIを作って', 'ユーザー認証を実装'],
        zh: ['写一个React组件', '创建REST API', '实现用户认证'],
        ko: ['React 컴포넌트 작성', 'REST API 생성', '사용자 인증 구현'],
      },
    });

    this.dictionary.set('/test', {
      command: '/test',
      name: {
        en: 'Test Generation',
        ja: 'テスト生成',
        zh: '测试生成',
        ko: '테스트 생성',
      },
      description: {
        en: 'Generate and run tests',
        ja: 'テストの生成と実行',
        zh: '生成并运行测试',
        ko: '테스트 생성 및 실행',
      },
      keywords: {
        en: ['test', 'testing', 'unit', 'integration', 'e2e', 'coverage', 'spec', 'assertion'],
        ja: ['テスト', '試験', 'ユニット', '統合', 'カバレッジ', '検証'],
        zh: ['测试', '单元测试', '集成测试', '覆盖率', '验证'],
        ko: ['테스트', '단위', '통합', '커버리지', '검증'],
      },
      examples: {
        en: ['write unit tests', 'create integration tests', 'generate test coverage'],
        ja: ['ユニットテストを書いて', '統合テストを作成', 'テストカバレッジを生成'],
        zh: ['编写单元测试', '创建集成测试', '生成测试覆盖率'],
        ko: ['단위 테스트 작성', '통합 테스트 생성', '테스트 커버리지 생성'],
      },
    });

    this.dictionary.set('/review', {
      command: '/review',
      name: {
        en: 'Code Review',
        ja: 'コードレビュー',
        zh: '代码审查',
        ko: '코드 리뷰',
      },
      description: {
        en: 'Review code for improvements',
        ja: 'コードの改善点をレビュー',
        zh: '审查代码以进行改进',
        ko: '코드 개선사항 검토',
      },
      keywords: {
        en: ['review', 'check', 'analyze', 'improve', 'refactor', 'optimize', 'quality', 'inspect'],
        ja: ['レビュー', '確認', '改善', 'リファクタ', '最適化', '品質', '検査'],
        zh: ['审查', '检查', '分析', '改进', '重构', '优化', '质量'],
        ko: ['리뷰', '검토', '분석', '개선', '리팩토링', '최적화', '품질'],
      },
      examples: {
        en: ['review this code', 'check for improvements', 'optimize performance'],
        ja: ['このコードをレビューして', '改善点を確認', 'パフォーマンスを最適化'],
        zh: ['审查这段代码', '检查改进点', '优化性能'],
        ko: ['이 코드 리뷰', '개선사항 확인', '성능 최적화'],
      },
    });

    this.dictionary.set('/model', {
      command: '/model',
      name: {
        en: 'Model Selection',
        ja: 'モデル選択',
        zh: '模型选择',
        ko: '모델 선택',
      },
      description: {
        en: 'Select AI model',
        ja: 'AIモデルの選択',
        zh: '选择AI模型',
        ko: 'AI 모델 선택',
      },
      keywords: {
        en: ['model', 'select', 'choose', 'switch', 'change', 'ai', 'llm'],
        ja: ['モデル', '選択', '切り替え', '変更', 'AI', 'LLM'],
        zh: ['模型', '选择', '切换', '更改', 'AI', 'LLM'],
        ko: ['모델', '선택', '전환', '변경', 'AI', 'LLM'],
      },
      examples: {
        en: ['switch to GPT-5', 'use Claude', 'select local model'],
        ja: ['GPT-5に切り替え', 'Claudeを使用', 'ローカルモデルを選択'],
        zh: ['切换到GPT-5', '使用Claude', '选择本地模型'],
        ko: ['GPT-5로 전환', 'Claude 사용', '로컬 모델 선택'],
      },
    });

    // Media Generation Commands
    this.dictionary.set('/image', {
      command: '/image',
      name: {
        en: 'Image Generation',
        ja: '画像生成',
        zh: '图像生成',
        ko: '이미지 생성',
      },
      description: {
        en: 'Generate images with AI',
        ja: 'AIによる画像生成',
        zh: '使用AI生成图像',
        ko: 'AI 이미지 생성',
      },
      keywords: {
        en: [
          'image',
          'picture',
          'photo',
          'draw',
          'illustration',
          'visual',
          'graphic',
          'art',
          'design',
          'create',
        ],
        ja: ['画像', 'イメージ', '絵', 'イラスト', 'ビジュアル', '描く', '生成', 'デザイン'],
        zh: ['图像', '图片', '插图', '画', '生成', '创建', '视觉', '设计'],
        ko: ['이미지', '그림', '일러스트', '생성', '그리기', '디자인', '비주얼'],
      },
      examples: {
        en: ['create an image of sunset', 'draw a cat', 'generate logo design'],
        ja: ['夕日の画像を生成', '猫を描いて', 'ロゴデザインを生成'],
        zh: ['创建日落图像', '画一只猫', '生成logo设计'],
        ko: ['일몰 이미지 생성', '고양이 그리기', '로고 디자인 생성'],
      },
    });

    this.dictionary.set('/video', {
      command: '/video',
      name: {
        en: 'Video Generation',
        ja: '動画生成',
        zh: '视频生成',
        ko: '비디오 생성',
      },
      description: {
        en: 'Generate videos with AI',
        ja: 'AIによる動画生成',
        zh: '使用AI生成视频',
        ko: 'AI 비디오 생성',
      },
      keywords: {
        en: ['video', 'movie', 'animation', 'clip', 'film', 'animate', 'motion', 'render'],
        ja: ['動画', 'ビデオ', 'アニメーション', 'ムービー', '映像', '作成', '生成'],
        zh: ['视频', '动画', '影片', '创建', '生成', '制作', '渲染'],
        ko: ['비디오', '동영상', '애니메이션', '생성', '제작', '렌더링'],
      },
      examples: {
        en: ['create a video intro', 'generate animation', 'make a tutorial video'],
        ja: ['動画イントロを作成', 'アニメーションを生成', 'チュートリアル動画を作る'],
        zh: ['创建视频介绍', '生成动画', '制作教程视频'],
        ko: ['비디오 인트로 생성', '애니메이션 제작', '튜토리얼 비디오 만들기'],
      },
    });

    this.dictionary.set('/avatar', {
      command: '/avatar',
      name: {
        en: 'Avatar Display',
        ja: 'アバター表示',
        zh: '头像显示',
        ko: '아바타 표시',
      },
      description: {
        en: 'Display ASCII art avatar',
        ja: 'ASCIIアートアバターを表示',
        zh: '显示ASCII艺术头像',
        ko: 'ASCII 아트 아바타 표시',
      },
      keywords: {
        en: ['avatar', 'character', 'ascii', 'art', 'display', 'show'],
        ja: ['アバター', 'キャラクター', 'アスキー', 'アート', '表示'],
        zh: ['头像', '角色', 'ASCII', '艺术', '显示'],
        ko: ['아바타', '캐릭터', 'ASCII', '아트', '표시'],
      },
      examples: {
        en: ['show avatar', 'display character', 'ascii art'],
        ja: ['アバターを表示', 'キャラクターを見せて', 'アスキーアート'],
        zh: ['显示头像', '展示角色', 'ASCII艺术'],
        ko: ['아바타 보기', '캐릭터 표시', 'ASCII 아트'],
      },
    });

    this.dictionary.set('/voice', {
      command: '/voice',
      name: {
        en: 'Voice Interaction',
        ja: '音声対話',
        zh: '语音交互',
        ko: '음성 상호작용',
      },
      description: {
        en: 'Voice-based interaction',
        ja: '音声ベースの対話',
        zh: '基于语音的交互',
        ko: '음성 기반 상호작용',
      },
      keywords: {
        en: ['voice', 'speak', 'talk', 'audio', 'speech', 'sound'],
        ja: ['音声', '話す', '会話', 'オーディオ', 'スピーチ'],
        zh: ['语音', '说话', '对话', '音频', '语音'],
        ko: ['음성', '말하기', '대화', '오디오', '스피치'],
      },
      examples: {
        en: ['talk to me', 'voice command', 'speak the response'],
        ja: ['話しかけて', '音声コマンド', '応答を話して'],
        zh: ['和我说话', '语音命令', '说出回应'],
        ko: ['대화하기', '음성 명령', '응답 말하기'],
      },
    });

    // Add remaining commands...
    // Project Management Commands
    this.dictionary.set('/init', {
      command: '/init',
      name: {
        en: 'Initialize Project',
        ja: 'プロジェクト初期化',
        zh: '初始化项目',
        ko: '프로젝트 초기화',
      },
      description: {
        en: 'Initialize a new project',
        ja: '新しいプロジェクトを初期化',
        zh: '初始化新项目',
        ko: '새 프로젝트 초기화',
      },
      keywords: {
        en: ['init', 'initialize', 'setup', 'create', 'start', 'project', 'new'],
        ja: ['初期化', 'セットアップ', '作成', '開始', 'プロジェクト', '新規'],
        zh: ['初始化', '设置', '创建', '启动', '项目', '新建'],
        ko: ['초기화', '설정', '생성', '시작', '프로젝트', '신규'],
      },
      examples: {
        en: ['initialize new project', 'setup React app', 'create new workspace'],
        ja: ['新プロジェクトを初期化', 'Reactアプリをセットアップ', '新ワークスペースを作成'],
        zh: ['初始化新项目', '设置React应用', '创建新工作空间'],
        ko: ['새 프로젝트 초기화', 'React 앱 설정', '새 워크스페이스 생성'],
      },
    });

    // System Commands
    this.dictionary.set('/help', {
      command: '/help',
      name: {
        en: 'Help',
        ja: 'ヘルプ',
        zh: '帮助',
        ko: '도움말',
      },
      description: {
        en: 'Show help and available commands',
        ja: 'ヘルプと利用可能なコマンドを表示',
        zh: '显示帮助和可用命令',
        ko: '도움말 및 사용 가능한 명령 표시',
      },
      keywords: {
        en: ['help', 'guide', 'manual', 'documentation', 'usage', 'commands'],
        ja: ['ヘルプ', 'ガイド', 'マニュアル', 'ドキュメント', '使い方', 'コマンド'],
        zh: ['帮助', '指南', '手册', '文档', '用法', '命令'],
        ko: ['도움말', '가이드', '매뉴얼', '문서', '사용법', '명령'],
      },
      examples: {
        en: ['show help', 'list commands', 'how to use'],
        ja: ['ヘルプを表示', 'コマンド一覧', '使い方'],
        zh: ['显示帮助', '列出命令', '如何使用'],
        ko: ['도움말 표시', '명령 목록', '사용 방법'],
      },
    });

    this.dictionary.set('/exit', {
      command: '/exit',
      name: {
        en: 'Exit',
        ja: '終了',
        zh: '退出',
        ko: '종료',
      },
      description: {
        en: 'Exit the session',
        ja: 'セッションを終了',
        zh: '退出会话',
        ko: '세션 종료',
      },
      keywords: {
        en: ['exit', 'quit', 'close', 'end', 'bye', 'goodbye', 'stop'],
        ja: ['終了', '退出', '閉じる', 'バイバイ', 'さようなら', '止める'],
        zh: ['退出', '结束', '关闭', '再见', '停止'],
        ko: ['종료', '나가기', '닫기', '끝', '정지'],
      },
      examples: {
        en: ['exit session', 'quit app', 'goodbye'],
        ja: ['セッション終了', 'アプリを閉じる', 'さようなら'],
        zh: ['退出会话', '关闭应用', '再见'],
        ko: ['세션 종료', '앱 종료', '안녕'],
      },
    });

    // Add more commands as needed...
  }
}
