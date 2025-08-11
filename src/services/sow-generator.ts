/**
 * SOW Generator Service
 * Statement of Work (作業計画書) を自動生成する
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { SOWDocument, Task, MissionPhase } from './auto-mode-controller';

export interface SOWRequest {
  type: 'paper' | 'slides' | 'development' | 'composite';
  description: string;
  parameters?: Record<string, any>;
  constraints?: {
    maxCost?: number;
    maxTime?: number;
    qualityThreshold?: number;
  };
}

interface TaskTemplate {
  name: string;
  description: string;
  estimatedDuration: number; // minutes
  dependencies?: string[];
  required?: boolean;
}

export class SOWGenerator {
  private readonly taskTemplates: Record<string, TaskTemplate[]> = {
    paper: [
      {
        name: 'research',
        description: '関連研究の調査と文献収集',
        estimatedDuration: 120,
        required: true,
      },
      {
        name: 'outline',
        description: '論文構成の作成',
        estimatedDuration: 60,
        required: true,
      },
      {
        name: 'introduction',
        description: 'イントロダクションの執筆',
        estimatedDuration: 90,
        dependencies: ['outline'],
        required: true,
      },
      {
        name: 'methodology',
        description: '手法・方法論の執筆',
        estimatedDuration: 120,
        dependencies: ['outline'],
        required: true,
      },
      {
        name: 'results',
        description: '実験結果・分析の執筆',
        estimatedDuration: 120,
        dependencies: ['methodology'],
        required: true,
      },
      {
        name: 'conclusion',
        description: '結論の執筆',
        estimatedDuration: 60,
        dependencies: ['results'],
        required: true,
      },
      {
        name: 'references',
        description: '参考文献の整理',
        estimatedDuration: 45,
        required: true,
      },
      {
        name: 'review',
        description: '全体のレビューと推敲',
        estimatedDuration: 90,
        dependencies: ['introduction', 'methodology', 'results', 'conclusion'],
        required: true,
      },
    ],
    slides: [
      {
        name: 'structure',
        description: 'スライド構成の設計',
        estimatedDuration: 30,
        required: true,
      },
      {
        name: 'title_slide',
        description: 'タイトルスライドの作成',
        estimatedDuration: 15,
        dependencies: ['structure'],
        required: true,
      },
      {
        name: 'content_slides',
        description: 'コンテンツスライドの作成',
        estimatedDuration: 90,
        dependencies: ['structure'],
        required: true,
      },
      {
        name: 'visuals',
        description: 'ビジュアル要素の追加',
        estimatedDuration: 60,
        dependencies: ['content_slides'],
        required: false,
      },
      {
        name: 'transitions',
        description: 'トランジションとアニメーションの設定',
        estimatedDuration: 30,
        dependencies: ['content_slides'],
        required: false,
      },
      {
        name: 'review',
        description: '全体のレビューと調整',
        estimatedDuration: 30,
        dependencies: ['content_slides', 'visuals'],
        required: true,
      },
    ],
    development: [
      {
        name: 'requirements',
        description: '要件定義と分析',
        estimatedDuration: 60,
        required: true,
      },
      {
        name: 'design',
        description: 'アーキテクチャ設計',
        estimatedDuration: 90,
        dependencies: ['requirements'],
        required: true,
      },
      {
        name: 'implementation',
        description: 'コード実装',
        estimatedDuration: 240,
        dependencies: ['design'],
        required: true,
      },
      {
        name: 'testing',
        description: 'テスト実装と実行',
        estimatedDuration: 120,
        dependencies: ['implementation'],
        required: true,
      },
      {
        name: 'documentation',
        description: 'ドキュメント作成',
        estimatedDuration: 60,
        dependencies: ['implementation'],
        required: false,
      },
      {
        name: 'deployment',
        description: 'デプロイメント',
        estimatedDuration: 30,
        dependencies: ['testing'],
        required: true,
      },
    ],
  };

  /**
   * SOWを生成
   */
  async generate(request: SOWRequest): Promise<SOWDocument> {
    logger.info('Generating SOW for:', request.type);

    const sowId = uuidv4();
    const templates = this.getTemplatesForType(request.type);
    const tasks = this.createTasksFromTemplates(templates, request);
    const { duration, cost } = this.estimateTotals(tasks, request.constraints);

    const sow: SOWDocument = {
      id: sowId,
      title: this.generateTitle(request),
      objectives: this.generateObjectives(request),
      phases: this.createPhases(tasks),
      estimatedDuration: duration,
      estimatedCost: cost,
      requiredResources: this.defineRequiredResources(request),
    };

    // 制約チェック
    this.validateConstraints(sow, request.constraints);

    return sow;
  }

  /**
   * タイプに応じたテンプレートを取得
   */
  private getTemplatesForType(type: string): TaskTemplate[] {
    if (type === 'composite') {
      // 複合タスクの場合は全てのテンプレートから選択
      return [
        ...(this.taskTemplates.paper?.slice(0, 3) || []),
        ...(this.taskTemplates.slides?.slice(0, 3) || []),
        ...(this.taskTemplates.development?.slice(0, 3) || []),
      ];
    }

    return this.taskTemplates[type] || [];
  }

  /**
   * テンプレートからタスクを作成
   */
  private createTasksFromTemplates(templates: TaskTemplate[], request: SOWRequest): Task[] {
    const tasks: Task[] = [];

    for (const template of templates) {
      // パラメータに基づいてスキップ判定
      if (!template.required && !this.shouldIncludeTask(template, request)) {
        continue;
      }

      const task: Task = {
        id: `task-${tasks.length + 1}`,
        name: this.localizeTaskName(template.name),
        description: template.description,
        status: 'pending',
        estimatedDuration: this.adjustDuration(template.estimatedDuration, request),
      };

      tasks.push(task);
    }

    return tasks;
  }

  /**
   * 合計見積もりを計算
   */
  private estimateTotals(
    tasks: Task[],
    constraints?: SOWRequest['constraints'],
  ): { duration: number; cost: number } {
    const totalMinutes = tasks.reduce((sum, task) => sum + task.estimatedDuration, 0);

    // コスト計算（仮: 1時間あたり$50）
    const hourlyRate = 50;
    const cost = (totalMinutes / 60) * hourlyRate;

    return {
      duration: totalMinutes,
      cost: constraints?.maxCost ? Math.min(cost, constraints.maxCost) : cost,
    };
  }

  /**
   * タイトルを生成
   */
  private generateTitle(request: SOWRequest): string {
    const typeNames = {
      paper: '論文作成',
      slides: 'スライド作成',
      development: '開発',
      composite: '統合プロジェクト',
    };

    const typeName = typeNames[request.type] || 'プロジェクト';
    const shortDesc = request.description.substring(0, 30);

    return `${typeName} - ${shortDesc}${request.description.length > 30 ? '...' : ''}`;
  }

  /**
   * タスクを含めるべきか判定
   */
  private shouldIncludeTask(template: TaskTemplate, request: SOWRequest): boolean {
    // パラメータに基づいた判定ロジック
    if (template.name === 'visuals' && request.parameters?.noVisuals) {
      return false;
    }

    if (template.name === 'documentation' && request.parameters?.skipDocs) {
      return false;
    }

    return true;
  }

  /**
   * タスク名をローカライズ
   */
  private localizeTaskName(name: string): string {
    const nameMap: Record<string, string> = {
      research: '調査・研究',
      outline: 'アウトライン作成',
      introduction: 'イントロダクション',
      methodology: '手法・方法論',
      results: '結果・分析',
      conclusion: '結論',
      references: '参考文献',
      structure: '構成設計',
      title_slide: 'タイトルスライド',
      content_slides: 'コンテンツスライド',
      visuals: 'ビジュアル要素',
      transitions: 'トランジション',
      requirements: '要件定義',
      design: '設計',
      implementation: '実装',
      testing: 'テスト',
      documentation: 'ドキュメント',
      deployment: 'デプロイ',
      review: 'レビュー',
    };

    return nameMap[name] || name;
  }

  /**
   * 期間を調整
   */
  private adjustDuration(baseDuration: number, request: SOWRequest): number {
    let duration = baseDuration;

    // 制約に基づいて調整
    if (request.constraints?.maxTime) {
      const maxMinutes = request.constraints.maxTime * 60;
      if (duration > maxMinutes) {
        duration = maxMinutes;
      }
    }

    // パラメータに基づいて調整
    if (request.parameters?.rush) {
      duration *= 0.7; // 30%短縮
    } else if (request.parameters?.thorough) {
      duration *= 1.5; // 50%延長
    }

    return Math.round(duration);
  }

  /**
   * 制約を検証
   */
  private validateConstraints(sow: SOWDocument, constraints?: SOWRequest['constraints']): void {
    if (!constraints) return;

    if (constraints.maxCost && sow.estimatedCost > constraints.maxCost) {
      logger.warn(`Cost exceeds constraint: ${sow.estimatedCost} > ${constraints.maxCost}`);
    }

    if (constraints.maxTime && sow.estimatedDuration > constraints.maxTime * 60) {
      logger.warn(
        `Duration exceeds constraint: ${sow.estimatedDuration} > ${constraints.maxTime * 60}`,
      );
    }
  }

  /**
   * 目的を生成
   */
  private generateObjectives(request: SOWRequest): string[] {
    const objectives: string[] = [];

    switch (request.type) {
      case 'paper':
        objectives.push('研究論文の作成と公開');
        objectives.push('査読プロセスの完了');
        objectives.push('学術的品質の確保');
        break;
      case 'slides':
        objectives.push('プレゼンテーション資料の作成');
        objectives.push('視覚的訴求力の確保');
        objectives.push('聴衆への効果的な情報伝達');
        break;
      case 'development':
        objectives.push('ソフトウェアの設計と実装');
        objectives.push('品質保証とテストの実施');
        objectives.push('本番環境へのデプロイ');
        break;
      case 'composite':
        objectives.push('複合的なタスクの完了');
        objectives.push('各コンポーネントの統合');
        objectives.push('全体的な品質の確保');
        break;
    }

    return objectives;
  }

  /**
   * フェーズを作成
   */
  private createPhases(tasks: Task[]): MissionPhase[] {
    const phases: MissionPhase[] = [];
    const tasksPerPhase = Math.ceil(tasks.length / 3);

    for (let i = 0; i < tasks.length; i += tasksPerPhase) {
      const phaseTasks = tasks.slice(i, i + tasksPerPhase);
      const phaseNumber = Math.floor(i / tasksPerPhase) + 1;

      phases.push({
        id: `phase-${phaseNumber}`,
        name: `Phase ${phaseNumber}: ${this.getPhaseTitle(phaseNumber)}`,
        tasks: phaseTasks,
        dependencies: phaseNumber > 1 ? [`phase-${phaseNumber - 1}`] : [],
        estimatedDuration: phaseTasks.reduce((sum, task) => sum + task.estimatedDuration, 0),
      });
    }

    return phases;
  }

  /**
   * フェーズタイトルを取得
   */
  private getPhaseTitle(phaseNumber: number): string {
    const titles = ['準備・調査', '実装・作成', '仕上げ・デプロイ'];
    return titles[phaseNumber - 1] || `作業フェーズ ${phaseNumber}`;
  }

  /**
   * 必要なリソースを定義
   */
  private defineRequiredResources(request: SOWRequest): string[] {
    const resources: string[] = [];

    switch (request.type) {
      case 'paper':
        resources.push('LaTeX環境');
        resources.push('参考文献データベースアクセス');
        resources.push('校正ツール');
        break;
      case 'slides':
        resources.push('Google Slides API');
        resources.push('画像生成AI');
        resources.push('デザインテンプレート');
        break;
      case 'development':
        resources.push('開発環境');
        resources.push('テスト環境');
        resources.push('デプロイメントパイプライン');
        break;
      case 'composite':
        resources.push('統合開発環境');
        resources.push('プロジェクト管理ツール');
        resources.push('コラボレーションツール');
        break;
    }

    resources.push('AI計算リソース');
    resources.push('ストレージ容量');

    return resources;
  }
}
