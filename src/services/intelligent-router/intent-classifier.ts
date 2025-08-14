/**
 * Intent Classifier Engine
 * 自然言語入力から意図を分類し、適切なコマンドを推論
 */

import Fuse from 'fuse.js';

export interface CommandPattern {
  command: string;
  patterns: RegExp[];
  keywords: string[];
  priority: number;
  extractParams?: (input: string) => Record<string, unknown>;
}

export interface InferredCommand {
  command: string;
  params: Record<string, unknown>;
  confidence: number;
  originalInput: string;
}

export class IntentClassifier {
  private commandMappings: CommandPattern[] = [
    // Priority 10: メディア生成（最優先）
    {
      command: '/video',
      priority: 10,
      patterns: [
        /動画を?(作|生成|create)/i,
        /video\s*(を|の)?\s*(作|生成)/i,
        /(作って|生成して).*動画/i,
        /アニメーション/i,
        /ビデオ/i,
      ],
      keywords: ['動画', 'video', 'ビデオ', 'アニメーション', 'movie'],
      extractParams: (input: string) => this.extractVideoParams(input),
    },
    {
      command: '/image',
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
      keywords: ['画像', 'image', 'イラスト', '絵', '写真', 'photo', 'picture', 'ロゴ', 'logo'],
      extractParams: (input: string) => this.extractImageParams(input),
    },

    // Priority 9: コード生成
    {
      command: '/code',
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
        'コード',
        'code',
        '実装',
        'implement',
        'バグ',
        'bug',
        'エラー',
        'error',
        'API',
        '機能',
        'function',
        'リファクタリング',
        'refactor',
      ],
      extractParams: (input: string) => this.extractCodeParams(input),
    },

    // Priority 7: 開発支援
    {
      command: '/test',
      priority: 7,
      patterns: [
        /テスト.*書/i,
        /test.*generate/i,
        /単体テスト/i,
        /ユニットテスト/i,
        /unit\s+test/i,
      ],
      keywords: ['テスト', 'test', '単体テスト', 'unit test'],
      extractParams: (input: string) => this.extractTestParams(input),
    },
    {
      command: '/review',
      priority: 7,
      patterns: [/レビュー/i, /review/i, /コード.*確認/i, /PR.*チェック/i, /チェック.*コード/i],
      keywords: ['レビュー', 'review', '確認', 'check', 'PR'],
      extractParams: (input: string) => this.extractReviewParams(input),
    },

    // Priority 5: プロジェクト管理
    {
      command: '/commit',
      priority: 5,
      patterns: [/コミット/i, /commit/i, /変更.*保存/i, /save.*changes/i],
      keywords: ['コミット', 'commit', '保存', 'save'],
      extractParams: (input: string) => this.extractCommitParams(input),
    },
    {
      command: '/deploy',
      priority: 5,
      patterns: [/デプロイ/i, /deploy/i, /本番.*反映/i, /リリース/i, /release/i],
      keywords: ['デプロイ', 'deploy', '本番', 'production', 'リリース', 'release'],
      extractParams: (input: string) => this.extractDeployParams(input),
    },
    {
      command: '/init',
      priority: 5,
      patterns: [/初期化/i, /プロジェクト.*設定/i, /MARIA\.md/i, /init/i],
      keywords: ['初期化', 'init', 'プロジェクト', 'project', 'MARIA.md'],
      extractParams: () => ({}),
    },
  ];

  private fuzzySearcher: Fuse<CommandPattern>;

  constructor() {
    // Fuse.jsを使用したファジーマッチング設定
    this.fuzzySearcher = new Fuse(this.commandMappings, {
      keys: ['keywords'],
      threshold: 0.3,
      includeScore: true,
    });
  }

  /**
   * 自然言語入力から意図を分類
   */
  classify(userInput: string): InferredCommand | null {
    // 1. 正規表現によるパターンマッチング（高精度）
    const patternMatch = this.matchByPattern(userInput);
    if (patternMatch && patternMatch.confidence > 0.8) {
      return patternMatch;
    }

    // 2. キーワードベースのファジーマッチング（中精度）
    const fuzzyMatch = this.matchByKeywords(userInput);
    if (fuzzyMatch && fuzzyMatch.confidence > 0.6) {
      return fuzzyMatch;
    }

    // 3. パターンマッチングの閾値を下げて再試行（低精度）
    if (patternMatch && patternMatch.confidence > 0.5) {
      return patternMatch;
    }

    return null;
  }

  /**
   * パターンマッチングによる意図分類
   */
  private matchByPattern(input: string): InferredCommand | null {
    // 優先度順にソート
    const sortedMappings = [...this.commandMappings].sort((a, b) => b.priority - a.priority);

    for (const mapping of sortedMappings) {
      for (const pattern of mapping.patterns) {
        if (pattern.test(input)) {
          const params = mapping.extractParams ? mapping.extractParams(input) : {};
          return {
            command: mapping.command,
            params,
            confidence: this.calculatePatternConfidence(input, pattern, mapping.priority),
            originalInput: input,
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
    const results = this.fuzzySearcher.search(input);

    if (results.length > 0 && results[0].score !== undefined) {
      const bestMatch = results[0];
      const confidence = 1 - bestMatch.score; // Fuseのスコアは0が完全一致

      if (confidence > 0.6) {
        const mapping = bestMatch.item;
        const params = mapping.extractParams ? mapping.extractParams(input) : {};

        return {
          command: mapping.command,
          params,
          confidence,
          originalInput: input,
        };
      }
    }

    return null;
  }

  /**
   * パターンマッチの信頼度計算
   */
  private calculatePatternConfidence(input: string, pattern: RegExp, priority: number): number {
    const baseConfidence = 0.7;
    const priorityBonus = priority * 0.02; // 優先度によるボーナス
    const lengthPenalty = Math.max(0, (50 - input.length) * 0.001); // 長い入力はペナルティ

    return Math.min(1, baseConfidence + priorityBonus + lengthPenalty);
  }

  /**
   * 動画生成パラメータ抽出
   */
  private extractVideoParams(input: string): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    // プロンプト抽出
    const promptMatch = input.match(/「(.+?)」|"(.+?)"|'(.+?)'|の(.+?)を/);
    if (promptMatch) {
      params['prompt'] = promptMatch[1] || promptMatch[2] || promptMatch[3] || promptMatch[4];
    } else {
      // キーワード除去してプロンプト化
      params['prompt'] = input.replace(/動画|ビデオ|video|作って|生成|create|して/gi, '').trim();
    }

    // スタイル検出
    if (/アニメ|anime|cartoon/i.test(input)) params['style'] = 'anime';
    if (/リアル|realistic|実写/i.test(input)) params['style'] = 'realistic';
    if (/3D/i.test(input)) params['style'] = '3d';

    // 時間検出
    const durationMatch = input.match(/(\d+)\s*(秒|seconds?)/);
    if (durationMatch) {
      params['duration'] = parseInt(durationMatch[1]);
    }

    return params;
  }

  /**
   * 画像生成パラメータ抽出
   */
  private extractImageParams(input: string): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    // プロンプト抽出
    const promptMatch = input.match(/「(.+?)」|"(.+?)"|'(.+?)'|の(.+?)を/);
    if (promptMatch) {
      params['prompt'] = promptMatch[1] || promptMatch[2] || promptMatch[3] || promptMatch[4];
    } else {
      params['prompt'] = input
        .replace(/画像|イラスト|image|picture|作って|生成|create|して|絵|写真/gi, '')
        .trim();
    }

    // スタイル検出
    if (/イラスト|illustration/i.test(input)) params['style'] = 'illustration';
    if (/写真|photo|realistic/i.test(input)) params['style'] = 'photorealistic';
    if (/ロゴ|logo/i.test(input)) params['style'] = 'logo';
    if (/アニメ|anime/i.test(input)) params['style'] = 'anime';

    // バッチサイズ検出
    const batchMatch = input.match(/(\d+)\s*(枚|個|つ|images?)/);
    if (batchMatch) {
      params['batch'] = parseInt(batchMatch[1]);
    }

    return params;
  }

  /**
   * コード生成パラメータ抽出
   */
  private extractCodeParams(input: string): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    // タスクタイプ検出
    if (/バグ|bug|エラー|error|修正|fix/i.test(input)) {
      params['task'] = 'fix';
    } else if (/リファクタリング|refactor/i.test(input)) {
      params['task'] = 'refactor';
    } else if (/API/i.test(input)) {
      params['task'] = 'api';
    } else {
      params['task'] = 'implement';
    }

    // 要件抽出
    params['requirement'] = input
      .replace(/コード|code|書いて|実装|implement|して|バグ|修正|fix/gi, '')
      .trim();

    // 言語検出
    if (/typescript|ts/i.test(input)) params['language'] = 'typescript';
    if (/javascript|js/i.test(input)) params['language'] = 'javascript';
    if (/python|py/i.test(input)) params['language'] = 'python';
    if (/java(?!script)/i.test(input)) params['language'] = 'java';
    if (/go|golang/i.test(input)) params['language'] = 'go';
    if (/rust/i.test(input)) params['language'] = 'rust';

    // フレームワーク検出
    if (/react/i.test(input)) params['framework'] = 'react';
    if (/next/i.test(input)) params['framework'] = 'nextjs';
    if (/express/i.test(input)) params['framework'] = 'express';
    if (/django/i.test(input)) params['framework'] = 'django';
    if (/spring/i.test(input)) params['framework'] = 'spring';

    return params;
  }

  /**
   * テストパラメータ抽出
   */
  private extractTestParams(input: string): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    // テストタイプ検出
    if (/単体|unit/i.test(input)) params['type'] = 'unit';
    if (/統合|integration/i.test(input)) params['type'] = 'integration';
    if (/e2e|end.to.end/i.test(input)) params['type'] = 'e2e';

    // カバレッジ目標
    const coverageMatch = input.match(/(\d+)\s*%/);
    if (coverageMatch) {
      params['coverage'] = parseInt(coverageMatch[1]);
    }

    return params;
  }

  /**
   * レビューパラメータ抽出
   */
  private extractReviewParams(input: string): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    // レビュー深度
    if (/詳細|detailed|深く/i.test(input)) params['depth'] = 'detailed';
    if (/簡単|quick|さっと/i.test(input)) params['depth'] = 'quick';

    // フォーカスエリア
    if (/セキュリティ|security/i.test(input)) params['focus'] = 'security';
    if (/パフォーマンス|performance/i.test(input)) params['focus'] = 'performance';
    if (/可読性|readability/i.test(input)) params['focus'] = 'readability';

    return params;
  }

  /**
   * コミットパラメータ抽出
   */
  private extractCommitParams(input: string): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    // コミットメッセージ抽出
    const messageMatch = input.match(/「(.+?)」|"(.+?)"|'(.+?)'/);
    if (messageMatch) {
      params['message'] = messageMatch[1] || messageMatch[2] || messageMatch[3];
    }

    // コミットタイプ検出
    if (/feat|機能/i.test(input)) params['type'] = 'feat';
    if (/fix|修正/i.test(input)) params['type'] = 'fix';
    if (/docs|ドキュメント/i.test(input)) params['type'] = 'docs';
    if (/style|スタイル/i.test(input)) params['type'] = 'style';
    if (/refactor|リファクタリング/i.test(input)) params['type'] = 'refactor';
    if (/test|テスト/i.test(input)) params['type'] = 'test';
    if (/chore|雑務/i.test(input)) params['type'] = 'chore';

    return params;
  }

  /**
   * デプロイパラメータ抽出
   */
  private extractDeployParams(input: string): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    // ターゲット環境検出
    if (/本番|production|prod/i.test(input)) params['target'] = 'production';
    if (/ステージング|staging|stage/i.test(input)) params['target'] = 'staging';
    if (/開発|development|dev/i.test(input)) params['target'] = 'development';

    // プラットフォーム検出
    if (/vercel/i.test(input)) params['platform'] = 'vercel';
    if (/aws/i.test(input)) params['platform'] = 'aws';
    if (/gcp|google cloud/i.test(input)) params['platform'] = 'gcp';
    if (/azure/i.test(input)) params['platform'] = 'azure';

    return params;
  }
}
