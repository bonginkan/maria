/**
 * Command Mapper Service
 * 意図解析結果を具体的なコマンドにマッピングする
 */

import { IntentAnalysis } from './intent-analyzer';
import { CommandSuggestion } from './interactive-router';
import { logger } from '../utils/logger';

interface CommandMapping {
  pattern: RegExp | string;
  command: string;
  parameters?: (intent: IntentAnalysis) => Record<string, any>;
  confidence?: number;
  description?: string;
}

export class CommandMapper {
  private readonly commandMappings: Record<string, CommandMapping[]> = {
    paper: [
      {
        pattern: 'create',
        command: 'mc paper',
        parameters: (intent) => ({
          action: 'create',
          title: intent.parameters.title,
          template: intent.parameters.template || 'blank'
        }),
        description: '新しい論文を作成'
      },
      {
        pattern: 'edit',
        command: 'mc paper',
        parameters: (intent) => ({
          action: 'edit',
          title: intent.parameters.title
        }),
        description: '既存の論文を編集'
      },
      {
        pattern: 'analyze',
        command: '/review',
        parameters: () => ({
          type: 'paper',
          depth: 'thorough'
        }),
        description: '論文をレビュー・分析'
      }
    ],
    slides: [
      {
        pattern: 'create',
        command: 'mc slides',
        parameters: (intent) => ({
          action: 'create',
          title: intent.parameters.title,
          count: intent.parameters.count || 10,
          template: intent.parameters.template || 'business'
        }),
        description: '新しいスライドを作成'
      },
      {
        pattern: 'edit',
        command: 'mc slides',
        parameters: (intent) => ({
          action: 'edit',
          title: intent.parameters.title
        }),
        description: '既存のスライドを編集'
      }
    ],
    chat: [
      {
        pattern: 'discuss',
        command: 'mc chat',
        parameters: (intent) => ({
          mode: 'chat',
          context: intent.parameters.additionalContext
        }),
        description: '対話モードを開始'
      },
      {
        pattern: /research|調査|分析/,
        command: 'mc chat',
        parameters: () => ({
          mode: 'research'
        }),
        description: 'リサーチモードで対話'
      }
    ],
    devops: [
      {
        pattern: 'execute',
        command: 'mc deploy',
        parameters: () => ({
          environment: 'staging'
        }),
        description: 'デプロイを実行'
      },
      {
        pattern: /test|テスト/,
        command: 'mc test',
        parameters: () => ({}),
        description: 'テストを実行'
      },
      {
        pattern: /build|ビルド/,
        command: 'mc build',
        parameters: () => ({}),
        description: 'ビルドを実行'
      }
    ],
    general: [
      {
        pattern: /.*/,
        command: 'mc chat',
        parameters: () => ({
          mode: 'chat'
        }),
        confidence: 0.5,
        description: '一般的な対話を開始'
      }
    ]
  };

  /**
   * 意図をコマンドにマッピング
   */
  mapToCommands(intent: IntentAnalysis): CommandSuggestion[] {
    logger.debug('Mapping intent to commands:', intent);
    
    const suggestions: CommandSuggestion[] = [];
    const mappings = this.commandMappings[intent.taskType] || this.commandMappings.general || [];
    
    for (const mapping of mappings) {
      if (this.matchesPattern(intent, mapping)) {
        const suggestion = this.createSuggestion(intent, mapping);
        suggestions.push(suggestion);
      }
    }
    
    // Auto Mode のサジェストを追加
    if (this.shouldSuggestAutoMode(intent)) {
      suggestions.push(this.createAutoModeSuggestion(intent));
    }
    
    // 信頼度でソート
    suggestions.sort((a, b) => b.confidence - a.confidence);
    
    return suggestions;
  }

  /**
   * パターンマッチング
   */
  private matchesPattern(intent: IntentAnalysis, mapping: CommandMapping): boolean {
    if (typeof mapping.pattern === 'string') {
      return intent.action === mapping.pattern;
    } else if (mapping.pattern instanceof RegExp) {
      return mapping.pattern.test(intent.originalInput) || 
             mapping.pattern.test(intent.action);
    }
    return false;
  }

  /**
   * コマンドサジェストを作成
   */
  private createSuggestion(
    intent: IntentAnalysis,
    mapping: CommandMapping
  ): CommandSuggestion {
    const baseConfidence = mapping.confidence || 0.8;
    const adjustedConfidence = this.adjustConfidence(baseConfidence, intent);
    
    return {
      command: mapping.command,
      confidence: adjustedConfidence,
      parameters: mapping.parameters ? mapping.parameters(intent) : {},
      description: mapping.description
    };
  }

  /**
   * Auto Mode をサジェストすべきか判定
   */
  private shouldSuggestAutoMode(intent: IntentAnalysis): boolean {
    // 複雑なタスクや曖昧な要求の場合
    const complexKeywords = [
      '全部', 'すべて', '完成', '最後まで', 
      'complete', 'entire', 'full', 'automate'
    ];
    
    return complexKeywords.some(keyword => 
      intent.originalInput.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  /**
   * Auto Mode のサジェストを作成
   */
  private createAutoModeSuggestion(intent: IntentAnalysis): CommandSuggestion {
    return {
      command: 'mc chat --auto',
      confidence: 0.7,
      parameters: {
        mode: 'auto',
        taskType: intent.taskType,
        initialRequest: intent.originalInput
      },
      description: 'Auto Modeで自動実行'
    };
  }

  /**
   * 信頼度を調整
   */
  private adjustConfidence(baseConfidence: number, intent: IntentAnalysis): number {
    // 意図の信頼度を考慮
    const adjusted = baseConfidence * intent.confidence;
    
    // パラメータが多いほど信頼度を上げる
    const paramCount = Object.keys(intent.parameters).filter(k => 
      intent.parameters[k as keyof typeof intent.parameters] !== undefined
    ).length;
    
    return Math.min(adjusted + (paramCount * 0.05), 1.0);
  }

  /**
   * 利用可能なコマンドのリストを取得
   */
  getAvailableCommands(): string[] {
    const commands = new Set<string>();
    
    for (const mappings of Object.values(this.commandMappings)) {
      for (const mapping of mappings) {
        commands.add(mapping.command);
      }
    }
    
    return Array.from(commands);
  }

  /**
   * コマンドの詳細情報を取得
   */
  getCommandInfo(command: string): CommandMapping | undefined {
    for (const mappings of Object.values(this.commandMappings)) {
      const mapping = mappings.find(m => m.command === command);
      if (mapping) {
        return mapping;
      }
    }
    return undefined;
  }
}