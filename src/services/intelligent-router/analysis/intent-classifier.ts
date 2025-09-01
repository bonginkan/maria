/**
 * Intent Classifier Engine
 * 自然言語入力から意図を分類し、適切なコマンドを推論
 */

import Fuse from "fuse.js";

export interface CommandPattern {
  command: string;
  patterns: RegExp[];
  keywords: string[];
  priority: number;
  extractParams?: (_input: string) => Record<string, unknown>;
}

export interface InferredCommand {
  command: string;
  _params: Record<string, unknown>;
  _confidence: number;
  originalInput: string;
}

export class IntentClassifier {
  private commandMappings: CommandPattern[] = [
    // Priority 10: メディア生成(最優先)
    {
      command: "/video",
      priority: 10,
      patterns: [
        /動画を?(作|生成|create)/i,
        /video\s*(を|の)?\s*(作|生成)/i,
        /(作って|生成して).*動画/i,
        /アニメーション/i,
        /ビデオ/i,
      ],
      keywords: ["動画", "video", "ビデオ", "アニメーション", "movie"],
      extractParams: (_input: string) => this.extractVideoParams(_input),
    },
    {
      command: "/image",
      priority: 10,
      patterns: [
        /画像を?(作|生成|create)/i,
        /image\s*(を|の)?\s*(作|生成)/i,
        /(作って|生成して).*画像/i,
        /イラスト|illustration/i,
        /絵を?(描|書)/i,
        /写真/i,
        /ロゴ/i,
      ],
      keywords: [
        "画像",
        "image",
        "イラスト",
        "絵",
        "写真",
        "photo",
        "picture",
        "ロゴ",
        "logo",
      ],
      extractParams: (_input: string) => this.extractImageParams(_input),
    },

    // Priority 9: コード生成
    {
      command: "/code",
      priority: 9,
      patterns: [
        /コード(を|の)?(書|作|生成|実装)/i,
        /(実装|開発|作成)して/i,
        /API.*作/i,
        /機能.*追加/i,
        /バグ.*修正/i,
        /エラー.*修正/i,
        /リファクタリング/i,
        /fix\s+(the\s+)?(bug|error|issue)/i,
        /implement/i,
        /create.*function/i,
      ],
      keywords: [
        "コード",
        "code",
        "実装",
        "implement",
        "バグ",
        "bug",
        "エラー",
        "error",
        "API",
        "機能",
        "function",
        "リファクタリング",
        "refactor",
      ],
      extractParams: (_input: string) => this.extractCodeParams(_input),
    },

    // Priority 7: 開発支援
    {
      command: "/test",
      priority: 7,
      patterns: [
        /テスト.*書/i,
        /test.*generate/i,
        /単体テスト/i,
        /ユニットテスト/i,
        /unit\s+test/i,
      ],
      keywords: ["テスト", "test", "単体テスト", "unit test"],
      extractParams: (_input: string) => this.extractTestParams(_input),
    },
    {
      command: "/review",
      priority: 7,
      patterns: [
        /レビュー/i,
        /review/i,
        /コード.*確認/i,
        /PR.*チェック/i,
        /チェック.*コード/i,
      ],
      keywords: ["レビュー", "review", "確認", "check", "PR"],
      extractParams: (_input: string) => this.extractReviewParams(_input),
    },

    // Priority 5: プロジェクト管理
    {
      command: "/commit",
      priority: 5,
      patterns: [/コミット/i, /commit/i, /変更.*保存/i, /save.*changes/i],
      keywords: ["コミット", "commit", "保存", "save"],
      extractParams: (_input: string) => this.extractCommitParams(_input),
    },
    {
      command: "/deploy",
      priority: 5,
      patterns: [
        /デプロイ/i,
        /deploy/i,
        /本番.*反映/i,
        /リリース/i,
        /release/i,
      ],
      keywords: [
        "デプロイ",
        "deploy",
        "本番",
        "production",
        "リリース",
        "release",
      ],
      extractParams: (_input: string) => this.extractDeployParams(_input),
    },
    {
      command: "/init",
      priority: 5,
      patterns: [/初期化/i, /プロジェクト.*設定/i, /MARIA\.md/i, /init/i],
      keywords: ["初期化", "init", "プロジェクト", "project", "MARIA.md"],
      extractParams: () => ({}),
    },
  ];

  private fuzzySearcher: Fuse<CommandPattern>;

  constructor() {
    // Fuse.jsを使用したファジーマッチング設定
    this.fuzzySearcher = new Fuse(this.commandMappings, {
      keys: ["keywords"],
      threshold: 0.3,
      includeScore: true,
    });
  }

  /**
   * 自然言語入力から意図を分類
   */
  classify(userInput: string): InferredCommand | null {
    // 1. 正規表現によるパターンマッチング(高精度)
    const _patternMatch = this.matchByPattern(userInput);
    if (_patternMatch && _patternMatch.confidence > 0.8) {
      return _patternMatch;
    }

    // 2. キーワードベースのファジーマッチング(中精度)
    const _fuzzyMatch = this.matchByKeywords(userInput);
    if (_fuzzyMatch && _fuzzyMatch.confidence > 0.6) {
      return _fuzzyMatch;
    }

    // 3. パターンマッチングの閾値を下げて再試行(低精度)
    if (_patternMatch && _patternMatch.confidence > 0.5) {
      return _patternMatch;
    }

    return null;
  }

  /**
   * パターンマッチングによる意図分類
   */
  private matchByPattern(input: string): InferredCommand | null {
    // 優先度順にソート
    const _sortedMappings = [...this.commandMappings].sort(
      (a, b) => b.priority - a.priority,
    );

    for (const _mapping of _sortedMappings) {
      for (const pattern of _mapping.patterns) {
        if (pattern.test(_input)) {
          const _params = _mapping.extractParams
            ? _mapping.extractParams(_input)
            : Record<string, any>;
          return {
            command: _mapping.command,
            _params,
            _confidence: this.calculatePatternConfidence(
              _input,
              pattern,
              _mapping.priority,
            ),
            originalInput: _input,
          };
        }
      }
    }

    return null;
  }

  /**
   * キーワードベースのファジーマッチング
   */
  private matchByKeywords(input: string): InferredCommand | null {
    const _results = this.fuzzySearcher.search(_input);

    if (_results.length > 0 && _results[0]?.score !== undefined) {
      const _bestMatch = _results[0]!;
      const _confidence = 1 - _bestMatch.score!; // Fuseのスコアは0が完全一致

      if (_confidence > 0.6) {
        const _mapping = _bestMatch._item;
        const _params = _mapping.extractParams
          ? _mapping.extractParams(_input)
          : Record<string, any>;

        return {
          command: _mapping.command,
          _params,
          _confidence,
          originalInput: _input,
        };
      }
    }

    return null;
  }

  /**
   * パターンマッチの信頼度計算
   */
  private calculatePatternConfidence(
    _input: string,
    _pattern: RegExp,
    priority: number,
  ): number {
    const _baseConfidence = 0.7;
    const _priorityBonus = priority * 0.02; // 優先度によるボーナス
    const _lengthPenalty = Math.max(0, (50 - _input.length) * 0.001); // 長い入力はペナルティ

    return Math.min(1, _baseConfidence + _priorityBonus + _lengthPenalty);
  }

  /**
   * 動画生成パラメータ抽出
   */
  private extractVideoParams(input: string): Record<string, unknown> {
    const _params: Record<string, unknown> = {};

    // プロンプト抽出
    const _promptMatch = _input.match(/「(.+?)」|"(.+?)"|'(.+?)'|の(.+?)を/);
    if (_promptMatch) {
      _params["prompt"] =
        _promptMatch[1] ||
        _promptMatch[2] ||
        _promptMatch[3] ||
        _promptMatch[4];
    } else {
      // キーワード除去してプロンプト化
      _params["prompt"] = _input
        .replace(/動画|ビデオ|video|作って|生成|create|して/gi, "")
        .trim();
    }

    // スタイル検出
    if (/アニメ|anime|cartoon/i.test(_input)) {
      _params["style"] = "anime";
    }
    if (/リアル|realistic|実写/i.test(_input)) {
      _params["style"] = "realistic";
    }
    if (/3D/i.test(_input)) {
      _params["style"] = "3d";
    }

    // 時間検出
    const _durationMatch = _input.match(/(\d+)\s*(秒|seconds?)/);
    if (_durationMatch && _durationMatch[1]) {
      _params["duration"] = parseInt(_durationMatch[1]);
    }

    return _params;
  }

  /**
   * 画像生成パラメータ抽出
   */
  private extractImageParams(input: string): Record<string, unknown> {
    const _params: Record<string, unknown> = {};

    // プロンプト抽出
    const _promptMatch = _input.match(/「(.+?)」|"(.+?)"|'(.+?)'|の(.+?)を/);
    if (_promptMatch) {
      _params["prompt"] =
        _promptMatch[1] ||
        _promptMatch[2] ||
        _promptMatch[3] ||
        _promptMatch[4];
    } else {
      _params["prompt"] = _input
        .replace(
          /画像|イラスト|image|picture|作って|生成|create|して|絵|写真/gi,
          "",
        )
        .trim();
    }

    // スタイル検出
    if (/イラスト|illustration/i.test(_input)) {
      _params["style"] = "illustration";
    }
    if (/写真|photo|realistic/i.test(_input)) {
      _params["style"] = "photorealistic";
    }
    if (/ロゴ|logo/i.test(_input)) {
      _params["style"] = "logo";
    }
    if (/アニメ|anime/i.test(_input)) {
      _params["style"] = "anime";
    }

    // バッチサイズ検出
    const _batchMatch = _input.match(/(\d+)\s*(枚|個|つ|images?)/);
    if (_batchMatch && _batchMatch[1]) {
      _params["batch"] = parseInt(_batchMatch[1]);
    }

    return _params;
  }

  /**
   * コード生成パラメータ抽出
   */
  private extractCodeParams(input: string): Record<string, unknown> {
    const _params: Record<string, unknown> = {};

    // タスクタイプ検出
    if (/バグ|bug|エラー|error|修正|fix/i.test(_input)) {
      _params["task"] = "fix";
    } else if (/リファクタリング|refactor/i.test(_input)) {
      _params["task"] = "refactor";
    } else if (/API/i.test(_input)) {
      _params["task"] = "api";
    } else {
      _params["task"] = "implement";
    }

    // 要件抽出
    _params["requirement"] = _input
      .replace(/コード|code|書いて|実装|implement|して|バグ|修正|fix/gi, "")
      .trim();

    // 言語検出
    if (/typescript|ts/i.test(_input)) {
      _params["language"] = "typescript";
    }
    if (/javascript|js/i.test(_input)) {
      _params["language"] = "javascript";
    }
    if (/python|py/i.test(_input)) {
      _params["language"] = "python";
    }
    if (/java(?!script)/i.test(_input)) {
      _params["language"] = "java";
    }
    if (/go|golang/i.test(_input)) {
      _params["language"] = "go";
    }
    if (/rust/i.test(_input)) {
      _params["language"] = "rust";
    }

    // フレームワーク検出
    if (/react/i.test(_input)) {
      _params["framework"] = "react";
    }
    if (/next/i.test(_input)) {
      _params["framework"] = "nextjs";
    }
    if (/express/i.test(_input)) {
      _params["framework"] = "express";
    }
    if (/django/i.test(_input)) {
      _params["framework"] = "django";
    }
    if (/spring/i.test(_input)) {
      _params["framework"] = "spring";
    }

    return _params;
  }

  /**
   * テストパラメータ抽出
   */
  private extractTestParams(input: string): Record<string, unknown> {
    const _params: Record<string, unknown> = {};

    // テストタイプ検出
    if (/単体|unit/i.test(_input)) {
      _params["type"] = "unit";
    }
    if (/統合|integration/i.test(_input)) {
      _params["type"] = "integration";
    }
    if (/e2e|end.to.end/i.test(_input)) {
      _params["type"] = "e2e";
    }

    // カバレッジ目標
    const _coverageMatch = _input.match(/(\d+)\s*%/);
    if (_coverageMatch && _coverageMatch[1]) {
      _params["coverage"] = parseInt(_coverageMatch[1]);
    }

    return _params;
  }

  /**
   * レビューパラメータ抽出
   */
  private extractReviewParams(input: string): Record<string, unknown> {
    const _params: Record<string, unknown> = {};

    // レビュー深度
    if (/詳細|detailed|深く/i.test(_input)) {
      _params["depth"] = "detailed";
    }
    if (/簡単|quick|さっと/i.test(_input)) {
      _params["depth"] = "quick";
    }

    // フォーカスエリア
    if (/セキュリティ|security/i.test(_input)) {
      _params["focus"] = "security";
    }
    if (/パフォーマンス|performance/i.test(_input)) {
      _params["focus"] = "performance";
    }
    if (/可読性|readability/i.test(_input)) {
      _params["focus"] = "readability";
    }

    return _params;
  }

  /**
   * コミットパラメータ抽出
   */
  private extractCommitParams(input: string): Record<string, unknown> {
    const _params: Record<string, unknown> = {};

    // コミットメッセージ抽出
    const _messageMatch = _input.match(/「(.+?)」|"(.+?)"|'(.+?)'/);
    if (_messageMatch) {
      _params["message"] =
        _messageMatch[1] || _messageMatch[2] || _messageMatch[3];
    }

    // コミットタイプ検出
    if (/feat|機能/i.test(_input)) {
      _params["type"] = "feat";
    }
    if (/fix|修正/i.test(_input)) {
      _params["type"] = "fix";
    }
    if (/docs|ドキュメント/i.test(_input)) {
      _params["type"] = "docs";
    }
    if (/style|スタイル/i.test(_input)) {
      _params["type"] = "style";
    }
    if (/refactor|リファクタリング/i.test(_input)) {
      _params["type"] = "refactor";
    }
    if (/test|テスト/i.test(_input)) {
      _params["type"] = "test";
    }
    if (/chore|雑務/i.test(_input)) {
      _params["type"] = "chore";
    }

    return _params;
  }

  /**
   * デプロイパラメータ抽出
   */
  private extractDeployParams(input: string): Record<string, unknown> {
    const _params: Record<string, unknown> = {};

    // ターゲット環境検出
    if (/本番|production|prod/i.test(_input)) {
      _params["target"] = "production";
    }
    if (/ステージング|staging|stage/i.test(_input)) {
      _params["target"] = "staging";
    }
    if (/開発|development|dev/i.test(_input)) {
      _params["target"] = "development";
    }

    // プラットフォーム検出
    if (/vercel/i.test(_input)) {
      _params["platform"] = "vercel";
    }
    if (/aws/i.test(_input)) {
      _params["platform"] = "aws";
    }
    if (/gcp|google cloud/i.test(_input)) {
      _params["platform"] = "gcp";
    }
    if (/azure/i.test(_input)) {
      _params["platform"] = "azure";
    }

    return _params;
  }
}
