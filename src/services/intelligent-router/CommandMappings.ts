import { MultilingualDictionary } from './MultilingualDictionary';

export interface CommandMapping {
  command: string;
  naturalPhrases: Map<string, string[]>;
  priority: number;
}

export class CommandMappings {
  private mappings: CommandMapping[];
  private dictionary: MultilingualDictionary;
  private initialized: boolean = false;

  constructor() {
    this.mappings = [];
    this.dictionary = new MultilingualDictionary();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.dictionary.initialize();
    this.loadMappings();
    this.initialized = true;
  }

  async getSuggestions(input: string, language: string, maxResults: number = 5): Promise<string[]> {
    const lowerInput = input.toLowerCase();
    const suggestions: Array<{ command: string; score: number }> = [];

    for (const mapping of this.mappings) {
      const phrases =
        mapping.naturalPhrases.get(language) ?? mapping.naturalPhrases.get('en') ?? [];
      let score = 0;

      for (const phrase of phrases) {
        if (phrase.toLowerCase().includes(lowerInput)) {
          score += 2;
        }
        if (phrase.toLowerCase().startsWith(lowerInput)) {
          score += 3;
        }
      }

      // Check command name match
      if (mapping.command.toLowerCase().includes(lowerInput)) {
        score += 5;
      }

      if (score > 0) {
        suggestions.push({ command: mapping.command, score: score * mapping.priority });
      }
    }

    // Sort by score and return top results
    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map((s) => s.command);
  }

  getCommandForPhrase(phrase: string, language: string): string | null {
    const lowerPhrase = phrase.toLowerCase();

    for (const mapping of this.mappings) {
      const phrases =
        mapping.naturalPhrases.get(language) ?? mapping.naturalPhrases.get('en') ?? [];

      for (const naturalPhrase of phrases) {
        if (lowerPhrase.includes(naturalPhrase.toLowerCase())) {
          return mapping.command;
        }
      }
    }

    return null;
  }

  private loadMappings(): void {
    // Core Development Commands
    this.mappings.push({
      command: '/code',
      naturalPhrases: new Map([
        [
          'en',
          ['write code', 'create code', 'generate code', 'implement', 'build function', 'develop'],
        ],
        [
          'ja',
          ['コードを書いて', '実装して', 'プログラムを作って', '関数を書いて', 'クラスを作成'],
        ],
        ['cn', ['写代码', '编写代码', '实现', '创建函数', '构建类']],
        ['ko', ['코드 작성', '구현해줘', '함수 만들어', '클래스 생성']],
        ['vn', ['viết mã', 'tạo code', 'xây dựng hàm', 'phát triển']],
      ]),
      priority: 1.0,
    });

    this.mappings.push({
      command: '/test',
      naturalPhrases: new Map([
        ['en', ['write test', 'create test', 'generate test', 'unit test', 'test this']],
        ['ja', ['テストを書いて', 'テスト作成', 'ユニットテスト', 'テストして']],
        ['cn', ['写测试', '创建测试', '单元测试', '测试这个']],
        ['ko', ['테스트 작성', '테스트 생성', '단위 테스트']],
        ['vn', ['viết kiểm tra', 'tạo test', 'kiểm tra đơn vị']],
      ]),
      priority: 0.9,
    });

    this.mappings.push({
      command: '/review',
      naturalPhrases: new Map([
        ['en', ['review code', 'check code', 'analyze', 'improve', 'refactor']],
        ['ja', ['コードレビュー', '確認して', '改善して', 'リファクタリング']],
        ['cn', ['代码审查', '检查代码', '改进', '重构']],
        ['ko', ['코드 리뷰', '검토해줘', '개선해줘', '리팩토링']],
        ['vn', ['xem xét mã', 'kiểm tra code', 'cải thiện', 'tái cấu trúc']],
      ]),
      priority: 0.9,
    });

    this.mappings.push({
      command: '/model',
      naturalPhrases: new Map([
        ['en', ['switch model', 'change model', 'select model', 'use gpt', 'use claude']],
        ['ja', ['モデル切り替え', 'モデル変更', 'GPT使って', 'Claude使って']],
        ['cn', ['切换模型', '更改模型', '使用GPT', '使用Claude']],
        ['ko', ['모델 전환', '모델 변경', 'GPT 사용', 'Claude 사용']],
        ['vn', ['chuyển mô hình', 'đổi model', 'dùng GPT', 'dùng Claude']],
      ]),
      priority: 0.8,
    });

    // Media Generation Commands
    this.mappings.push({
      command: '/image',
      naturalPhrases: new Map([
        [
          'en',
          ['create image', 'generate image', 'draw picture', 'make illustration', 'design graphic'],
        ],
        ['ja', ['画像を生成', 'イメージを作って', '絵を描いて', 'イラストを作成']],
        ['cn', ['生成图像', '创建图片', '画一幅画', '制作插图']],
        ['ko', ['이미지 생성', '그림 그려줘', '일러스트 만들어']],
        ['vn', ['tạo hình ảnh', 'vẽ tranh', 'làm minh họa']],
      ]),
      priority: 1.0,
    });

    this.mappings.push({
      command: '/video',
      naturalPhrases: new Map([
        ['en', ['create video', 'generate video', 'make animation', 'produce movie']],
        ['ja', ['動画を作って', 'ビデオを生成', 'アニメーションを作成']],
        ['cn', ['创建视频', '生成动画', '制作影片']],
        ['ko', ['비디오 생성', '동영상 만들어', '애니메이션 제작']],
        ['vn', ['tạo video', 'làm hoạt hình', 'sản xuất phim']],
      ]),
      priority: 1.0,
    });

    this.mappings.push({
      command: '/avatar',
      naturalPhrases: new Map([
        ['en', ['show avatar', 'display character', 'ascii art']],
        ['ja', ['アバター表示', 'キャラクター見せて', 'アスキーアート']],
        ['cn', ['显示头像', '展示角色', 'ASCII艺术']],
        ['ko', ['아바타 보기', '캐릭터 표시']],
        ['vn', ['hiển thị avatar', 'xem nhân vật']],
      ]),
      priority: 0.7,
    });

    this.mappings.push({
      command: '/voice',
      naturalPhrases: new Map([
        ['en', ['talk to me', 'voice command', 'speak']],
        ['ja', ['話しかけて', '音声コマンド', '話して']],
        ['cn', ['和我说话', '语音命令', '说话']],
        ['ko', ['대화하기', '음성 명령']],
        ['vn', ['nói chuyện', 'lệnh giọng nói']],
      ]),
      priority: 0.7,
    });

    // Configuration Commands
    this.mappings.push({
      command: '/setup',
      naturalPhrases: new Map([
        ['en', ['setup system', 'initial setup', 'configure']],
        ['ja', ['セットアップ', '初期設定', '環境構築']],
        ['cn', ['设置系统', '初始设置', '配置']],
        ['ko', ['설정', '초기 설정', '환경 구축']],
        ['vn', ['thiết lập', 'cài đặt ban đầu']],
      ]),
      priority: 0.8,
    });

    this.mappings.push({
      command: '/settings',
      naturalPhrases: new Map([
        ['en', ['show settings', 'check configuration', 'view config']],
        ['ja', ['設定確認', '設定を見る', 'コンフィグ確認']],
        ['cn', ['查看设置', '检查配置', '显示设置']],
        ['ko', ['설정 확인', '설정 보기']],
        ['vn', ['xem cài đặt', 'kiểm tra cấu hình']],
      ]),
      priority: 0.7,
    });

    this.mappings.push({
      command: '/config',
      naturalPhrases: new Map([
        ['en', ['configure', 'manage config', 'update settings']],
        ['ja', ['設定管理', '設定更新', 'コンフィグ管理']],
        ['cn', ['配置管理', '更新设置', '管理配置']],
        ['ko', ['설정 관리', '설정 업데이트']],
        ['vn', ['quản lý cấu hình', 'cập nhật cài đặt']],
      ]),
      priority: 0.7,
    });

    // Project Management Commands
    this.mappings.push({
      command: '/init',
      naturalPhrases: new Map([
        ['en', ['initialize project', 'start new project', 'create project']],
        ['ja', ['プロジェクト初期化', '新規プロジェクト', 'プロジェクト作成']],
        ['cn', ['初始化项目', '新建项目', '创建项目']],
        ['ko', ['프로젝트 초기화', '새 프로젝트']],
        ['vn', ['khởi tạo dự án', 'tạo dự án mới']],
      ]),
      priority: 0.9,
    });

    this.mappings.push({
      command: '/add-dir',
      naturalPhrases: new Map([
        ['en', ['add directory', 'include folder', 'add path']],
        ['ja', ['ディレクトリ追加', 'フォルダ追加', 'パス追加']],
        ['cn', ['添加目录', '包含文件夹', '添加路径']],
        ['ko', ['디렉토리 추가', '폴더 추가']],
        ['vn', ['thêm thư mục', 'thêm đường dẫn']],
      ]),
      priority: 0.6,
    });

    this.mappings.push({
      command: '/memory',
      naturalPhrases: new Map([
        ['en', ['manage memory', 'remember this', 'save context']],
        ['ja', ['メモリ管理', 'これを覚えて', 'コンテキスト保存']],
        ['cn', ['内存管理', '记住这个', '保存上下文']],
        ['ko', ['메모리 관리', '이것 기억해']],
        ['vn', ['quản lý bộ nhớ', 'nhớ điều này']],
      ]),
      priority: 0.6,
    });

    this.mappings.push({
      command: '/export',
      naturalPhrases: new Map([
        ['en', ['export data', 'save output', 'download results']],
        ['ja', ['データエクスポート', '出力保存', '結果ダウンロード']],
        ['cn', ['导出数据', '保存输出', '下载结果']],
        ['ko', ['데이터 내보내기', '출력 저장']],
        ['vn', ['xuất dữ liệu', 'lưu kết quả']],
      ]),
      priority: 0.6,
    });

    // Agent Management Commands
    this.mappings.push({
      command: '/agents',
      naturalPhrases: new Map([
        ['en', ['manage agents', 'show agents', 'list agents']],
        ['ja', ['エージェント管理', 'エージェント表示', 'エージェント一覧']],
        ['cn', ['管理代理', '显示代理', '列出代理']],
        ['ko', ['에이전트 관리', '에이전트 표시']],
        ['vn', ['quản lý agent', 'hiển thị agent']],
      ]),
      priority: 0.5,
    });

    // System Commands
    this.mappings.push({
      command: '/status',
      naturalPhrases: new Map([
        ['en', ['show status', 'system status', 'check status']],
        ['ja', ['ステータス表示', 'システム状態', '状態確認']],
        ['cn', ['显示状态', '系统状态', '检查状态']],
        ['ko', ['상태 표시', '시스템 상태']],
        ['vn', ['hiển thị trạng thái', 'trạng thái hệ thống']],
      ]),
      priority: 0.7,
    });

    this.mappings.push({
      command: '/health',
      naturalPhrases: new Map([
        ['en', ['health check', 'system health', 'diagnostics']],
        ['ja', ['ヘルスチェック', 'システム診断', '健全性確認']],
        ['cn', ['健康检查', '系统诊断', '健康状态']],
        ['ko', ['헬스 체크', '시스템 진단']],
        ['vn', ['kiểm tra sức khỏe', 'chẩn đoán hệ thống']],
      ]),
      priority: 0.6,
    });

    this.mappings.push({
      command: '/clear',
      naturalPhrases: new Map([
        ['en', ['clear screen', 'clear chat', 'reset display']],
        ['ja', ['画面クリア', 'チャットクリア', '表示リセット']],
        ['cn', ['清除屏幕', '清除聊天', '重置显示']],
        ['ko', ['화면 지우기', '채팅 지우기']],
        ['vn', ['xóa màn hình', 'xóa chat']],
      ]),
      priority: 0.5,
    });

    this.mappings.push({
      command: '/help',
      naturalPhrases: new Map([
        ['en', ['show help', 'help me', 'list commands', 'how to use']],
        ['ja', ['ヘルプ表示', '助けて', 'コマンド一覧', '使い方']],
        ['cn', ['显示帮助', '帮助我', '列出命令', '如何使用']],
        ['ko', ['도움말 표시', '도와줘', '명령 목록']],
        ['vn', ['hiển thị trợ giúp', 'giúp tôi', 'danh sách lệnh']],
      ]),
      priority: 0.9,
    });

    this.mappings.push({
      command: '/exit',
      naturalPhrases: new Map([
        ['en', ['exit', 'quit', 'goodbye', 'bye', 'close']],
        ['ja', ['終了', '退出', 'さようなら', 'バイバイ', '閉じる']],
        ['cn', ['退出', '结束', '再见', '关闭']],
        ['ko', ['종료', '나가기', '안녕', '닫기']],
        ['vn', ['thoát', 'kết thúc', 'tạm biệt', 'đóng']],
      ]),
      priority: 0.8,
    });

    // Language switching command
    this.mappings.push({
      command: '/lang',
      naturalPhrases: new Map([
        ['en', ['change language', 'switch language', 'set language', 'language settings']],
        ['ja', ['言語変更', '言語切り替え', '言語設定', '日本語に変更']],
        ['cn', ['更改语言', '切换语言', '语言设置', '改成中文']],
        ['ko', ['언어 변경', '언어 전환', '언어 설정', '한국어로 변경']],
        ['vn', ['đổi ngôn ngữ', 'chuyển ngôn ngữ', 'cài đặt ngôn ngữ', 'đổi sang tiếng việt']],
      ]),
      priority: 0.9,
    });
  }
}
