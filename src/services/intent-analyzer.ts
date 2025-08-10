/**
 * Intent Analyzer Service
 * 自然言語入力から意図を解析する
 */

import { ConversationContext } from '../types/conversation';
import { logger } from '../utils/logger';

export interface IntentAnalysis {
  taskType: 'paper' | 'slides' | 'chat' | 'devops' | 'general' | 'unknown';
  confidence: number;
  action: 'create' | 'edit' | 'delete' | 'analyze' | 'discuss' | 'execute' | 'unknown';
  parameters: {
    title?: string;
    template?: string;
    format?: string;
    count?: number;
    additionalContext?: string[];
  };
  suggestedCommands: string[];
  originalInput: string;
}

export class IntentAnalyzer {
  private readonly taskPatterns = {
    paper: {
      keywords: ['論文', 'paper', '研究', 'research', 'LaTeX', '参考文献', '学術', 'academic'],
      patterns: [
        /論文.*(?:作成|書|執筆)/i,
        /(?:create|write).*paper/i,
        /research.*(?:document|article)/i,
        /学術.*(?:文書|論文)/i
      ],
      actions: {
        create: ['作成', '書く', '執筆', 'create', 'write', '新規'],
        edit: ['編集', '修正', '更新', 'edit', 'modify', 'update'],
        analyze: ['分析', '解析', 'analyze', 'review']
      }
    },
    slides: {
      keywords: ['スライド', 'slide', 'プレゼン', 'presentation', 'デッキ', 'deck', 'PowerPoint'],
      patterns: [
        /(?:スライド|プレゼン).*(?:作成|作る)/i,
        /(?:create|make).*(?:slide|presentation)/i,
        /プレゼンテーション.*準備/i
      ],
      actions: {
        create: ['作成', '作る', '準備', 'create', 'make', 'prepare'],
        edit: ['編集', '修正', 'edit', 'modify'],
        execute: ['発表', 'present', '実行']
      }
    },
    chat: {
      keywords: ['話', 'チャット', 'chat', '対話', '会話', 'conversation', '相談'],
      patterns: [
        /(?:話|チャット).*(?:したい|しよう)/i,
        /(?:chat|talk).*(?:with|about)/i,
        /相談.*(?:したい|乗って)/i
      ],
      actions: {
        discuss: ['話す', 'チャット', 'chat', '相談', '対話']
      }
    },
    devops: {
      keywords: ['デプロイ', 'deploy', 'ビルド', 'build', 'テスト', 'test', 'CI/CD', 'パイプライン'],
      patterns: [
        /(?:デプロイ|ビルド).*(?:する|実行)/i,
        /(?:deploy|build|test).*(?:code|application)/i,
        /パイプライン.*(?:実行|構築)/i
      ],
      actions: {
        execute: ['実行', 'デプロイ', 'deploy', 'build', 'run'],
        create: ['構築', '作成', 'create', 'setup']
      }
    }
  };

  /**
   * 意図を解析
   */
  async analyze(input: string, context?: ConversationContext): Promise<IntentAnalysis> {
    logger.debug('Analyzing intent for:', input);

    // 1. タスクタイプを判定
    const taskAnalysis = this.analyzeTaskType(input);
    
    // 2. アクションを判定
    const action = this.analyzeAction(input, taskAnalysis.taskType);
    
    // 3. パラメータを抽出
    const parameters = this.extractParameters(input, taskAnalysis.taskType);
    
    // 4. コンテキストを考慮して調整
    const adjustedAnalysis = this.adjustWithContext(
      { ...taskAnalysis, action, parameters },
      context
    );
    
    // 5. サジェストコマンドを生成
    const suggestedCommands = this.generateSuggestedCommands(adjustedAnalysis);

    return {
      taskType: adjustedAnalysis.taskType || 'unknown',
      confidence: adjustedAnalysis.confidence || 0,
      action: adjustedAnalysis.action || 'unknown',
      parameters: adjustedAnalysis.parameters || {},
      suggestedCommands,
      originalInput: input
    };
  }

  /**
   * タスクタイプを解析
   */
  private analyzeTaskType(input: string): { taskType: IntentAnalysis['taskType']; confidence: number } {
    const scores: Record<string, number> = {};
    
    // 各タスクタイプのスコアを計算
    for (const [taskType, config] of Object.entries(this.taskPatterns)) {
      let score = 0;
      
      // キーワードマッチング
      for (const keyword of config.keywords) {
        if (input.toLowerCase().includes(keyword.toLowerCase())) {
          score += 0.3;
        }
      }
      
      // パターンマッチング
      for (const pattern of config.patterns) {
        if (pattern.test(input)) {
          score += 0.7;
        }
      }
      
      scores[taskType] = Math.min(score, 1.0);
    }
    
    // 最高スコアのタスクタイプを選択
    const entries = Object.entries(scores);
    if (entries.length === 0) {
      return { taskType: 'unknown', confidence: 0 };
    }
    
    const [bestType, bestScore] = entries.reduce((a, b) => a[1] > b[1] ? a : b);
    
    return {
      taskType: bestScore > 0.3 ? bestType as IntentAnalysis['taskType'] : 'general',
      confidence: bestScore
    };
  }

  /**
   * アクションを解析
   */
  private analyzeAction(
    input: string,
    taskType: IntentAnalysis['taskType']
  ): IntentAnalysis['action'] {
    if (taskType === 'unknown' || taskType === 'general') {
      return 'unknown';
    }
    
    const taskConfig = this.taskPatterns[taskType as keyof typeof this.taskPatterns];
    if (!taskConfig || !taskConfig.actions) {
      return 'unknown';
    }
    
    // 各アクションのキーワードをチェック
    for (const [action, keywords] of Object.entries(taskConfig.actions)) {
      for (const keyword of keywords) {
        if (input.toLowerCase().includes(keyword.toLowerCase())) {
          return action as IntentAnalysis['action'];
        }
      }
    }
    
    // デフォルトアクション
    return taskType === 'chat' ? 'discuss' : 'create';
  }

  /**
   * パラメータを抽出
   */
  private extractParameters(
    input: string,
    taskType: IntentAnalysis['taskType']
  ): IntentAnalysis['parameters'] {
    const parameters: IntentAnalysis['parameters'] = {};
    
    // タイトル抽出
    const titlePatterns = [
      /「(.+?)」/,
      /"(.+?)"/,
      /'(.+?)'/,
      /タイトル[：:]\s*(.+?)(?:\s|$)/,
      /title[：:]\s*(.+?)(?:\s|$)/i
    ];
    
    for (const pattern of titlePatterns) {
      const match = input.match(pattern);
      if (match && match[1]) {
        parameters.title = match[1].trim();
        break;
      }
    }
    
    // テンプレート抽出
    if (taskType === 'paper') {
      if (/IEEE/i.test(input)) parameters.template = 'IEEE';
      else if (/ACM/i.test(input)) parameters.template = 'ACM';
      else if (/空白|blank/i.test(input)) parameters.template = 'blank';
    }
    
    // 数量抽出（スライドの枚数など）
    const countMatch = input.match(/(\d+)\s*(?:枚|個|ページ|slides?|pages?)/i);
    if (countMatch && countMatch[1]) {
      parameters.count = parseInt(countMatch[1], 10);
    }
    
    return parameters;
  }

  /**
   * コンテキストを考慮して調整
   */
  private adjustWithContext(
    analysis: Partial<IntentAnalysis>,
    context?: ConversationContext
  ): Partial<IntentAnalysis> {
    if (!context || !context.currentTask) {
      return analysis;
    }
    
    // 現在のタスクと関連する場合は信頼度を上げる
    if (context.currentTask.type === analysis.taskType) {
      analysis.confidence = Math.min((analysis.confidence || 0) + 0.2, 1.0);
    }
    
    // 前の会話から追加のコンテキストを取得
    if (context.history.length > 0) {
      const recentMessages = context.history.slice(-3);
      analysis.parameters = {
        ...analysis.parameters,
        additionalContext: recentMessages.map(m => m.content)
      };
    }
    
    return analysis;
  }

  /**
   * サジェストコマンドを生成
   */
  private generateSuggestedCommands(analysis: Partial<IntentAnalysis>): string[] {
    const commands: string[] = [];
    
    switch (analysis.taskType) {
      case 'paper':
        if (analysis.action === 'create') {
          commands.push('mc paper create');
          if (analysis.parameters?.title) {
            commands.push(`mc paper create --title "${analysis.parameters.title}"`);
          }
        } else if (analysis.action === 'edit') {
          commands.push('mc paper edit');
        }
        break;
        
      case 'slides':
        if (analysis.action === 'create') {
          commands.push('mc slides create');
          if (analysis.parameters?.count) {
            commands.push(`mc slides create --count ${analysis.parameters.count}`);
          }
        }
        break;
        
      case 'chat':
        commands.push('mc chat');
        commands.push('mc chat --mode research');
        break;
        
      case 'devops':
        if (analysis.action === 'execute') {
          commands.push('mc deploy');
          commands.push('mc test');
        }
        break;
        
      default:
        commands.push('mc chat');
        commands.push('mc help');
    }
    
    return commands;
  }
}