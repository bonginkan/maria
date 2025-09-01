/**
 * Document Generator - PDF/レポート生成サービス
 * バトルカード、営業レポート、エグゼクティブサマリーの生成
 */

import * as fs from "fs/promises";
import * as path from "path";
import {
  PDFGenerationOptions,
  BattlecardData,
  IntegrationResult,
} from "./types";
import { SalesMetrics } from "./types";
import { Logger } from "../../utils/logger";

export interface DocumentTemplate {
  id: string;
  name: string;
  type:
    | "battlecard"
    | "sales_report"
    | "executive_summary"
    | "customer_analysis";
  format: "pdf" | "html" | "markdown";
  template: string;
  styles?: string;
  variables: string[];
}

export interface GeneratedDocument {
  id: string;
  fileName: string;
  filePath: string;
  type: string;
  generatedAt: Date;
  generatedBy?: string;
  metadata: {
    templateId: string;
    dataSource: string;
    fileSize: number;
    pageCount?: number;
  };
}

export class DocumentGenerator {
  private static instance: DocumentGenerator;
  private outputDirectory: string;
  private templatesDirectory: string;
  private templates: Map<string, DocumentTemplate> = new Map();

  private constructor() {
    this.outputDirectory = path.join(
      process.cwd(),
      ".maria",
      "generated-documents",
    );
    this.templatesDirectory = path.join(
      process.cwd(),
      ".maria",
      "document-templates",
    );
    this.initializeService();
  }

  public static getInstance(): DocumentGenerator {
    if (!DocumentGenerator.instance) {
      DocumentGenerator.instance = new DocumentGenerator();
    }
    return DocumentGenerator.instance;
  }

  private async initializeService(): Promise<void> {
    try {
      await fs.mkdir(this.outputDirectory, { recursive: true });
      await fs.mkdir(this.templatesDirectory, { recursive: true });
      await this.loadTemplates();
      await this.initializeDefaultTemplates();

      Logger.info("Document generator initialized", {
        outputDirectory: this.outputDirectory,
        templateCount: this.templates.size,
      });
    } catch (error) {
      Logger.error("Failed to initialize document generator", error);
    }
  }

  /**
   * バトルカード生成
   */
  public async generateBattlecard(
    competitorName: string,
    customerInfo?: {
      name: string;
      industry: string;
      size: string;
      painPoints: string[];
    },
    options?: Partial<PDFGenerationOptions>,
  ): Promise<IntegrationResult<GeneratedDocument>> {
    const startTime = Date.now();

    try {
      // バトルカードデータの構築
      const battlecardData = await this.buildBattlecardData(
        competitorName,
        customerInfo,
      );

      // テンプレートの取得
      const template = this.templates.get("battlecard_default");
      if (!template) {
        return this.createErrorResult(
          "TEMPLATE_NOT_FOUND",
          "Battlecard template not found",
        );
      }

      // ドキュメント生成
      const fileName = this.generateFileName(
        "battlecard",
        competitorName,
        customerInfo?.name,
      );
      const filePath = path.join(this.outputDirectory, fileName);

      const htmlContent = this.processTemplate(
        template.template,
        battlecardData,
      );

      // PDF生成(実際の実装ではPuppeteerやwkhtmltopdf等を使用)
      await this.generatePDFFromHTML(htmlContent, filePath, options);

      const fileStats = await fs.stat(filePath);
      const generatedDoc: GeneratedDocument = {
        id: this.generateDocumentId(),
        fileName,
        filePath,
        type: "battlecard",
        generatedAt: new Date(),
        metadata: {
          templateId: template.id,
          dataSource: "competitor_analysis",
          fileSize: fileStats.size,
          pageCount: 2, // バトルカードは通常2ページ
        },
      };

      // 生成履歴を保存
      await this.saveDocumentRecord(generatedDoc);

      Logger.info("Battlecard generated successfully", {
        fileName,
        competitor: competitorName,
        customer: customerInfo?.name,
        executionTimeMs: Date.now() - startTime,
      });

      return {
        success: true,
        data: generatedDoc,
        metadata: {
          executionTimeMs: Date.now() - startTime,
          fromCache: false,
        },
      };
    } catch (error) {
      Logger.error("Failed to generate battlecard", error, {
        competitor: competitorName,
        customer: customerInfo?.name,
      });

      return this.createErrorResult(
        "GENERATION_FAILED",
        `Battlecard generation failed: ${error.message}`,
      );
    }
  }

  /**
   * 営業レポート生成
   */
  public async generateSalesReport(
    salesMetrics: SalesMetrics,
    reportType: "daily" | "weekly" | "monthly" | "quarterly",
    filters?: {
      ownerId?: string;
      region?: string;
      industry?: string;
    },
  ): Promise<IntegrationResult<GeneratedDocument>> {
    const startTime = Date.now();

    try {
      const template = this.templates.get(`sales_report_${reportType}`);
      if (!template) {
        return this.createErrorResult(
          "TEMPLATE_NOT_FOUND",
          `Sales report template (${reportType}) not found`,
        );
      }

      const reportData = {
        ...salesMetrics,
        reportType,
        filters,
        generatedAt: new Date(),
        reportPeriod: this.getReportPeriod(reportType),
      };

      const fileName = this.generateFileName("sales_report", reportType);
      const filePath = path.join(this.outputDirectory, fileName);

      const htmlContent = this.processTemplate(template.template, reportData);
      await this.generatePDFFromHTML(htmlContent, filePath);

      const fileStats = await fs.stat(filePath);
      const generatedDoc: GeneratedDocument = {
        id: this.generateDocumentId(),
        fileName,
        filePath,
        type: "sales_report",
        generatedAt: new Date(),
        metadata: {
          templateId: template.id,
          dataSource: "sales_metrics",
          fileSize: fileStats.size,
          pageCount: this.estimatePageCount("sales_report", reportData),
        },
      };

      await this.saveDocumentRecord(generatedDoc);

      return {
        success: true,
        data: generatedDoc,
        metadata: {
          executionTimeMs: Date.now() - startTime,
          fromCache: false,
        },
      };
    } catch (error) {
      Logger.error("Failed to generate sales report", error, { reportType });
      return this.createErrorResult(
        "GENERATION_FAILED",
        `Sales report generation failed: ${error.message}`,
      );
    }
  }

  /**
   * エグゼクティブサマリー生成
   */
  public async generateExecutiveSummary(
    businessData: {
      salesMetrics: SalesMetrics;
      marketingMetrics?: any;
      keyInsights: string[];
      recommendations: string[];
      risks?: string[];
    },
    timeRange: { from: string; to: string },
  ): Promise<IntegrationResult<GeneratedDocument>> {
    const startTime = Date.now();

    try {
      const template = this.templates.get("executive_summary_default");
      if (!template) {
        return this.createErrorResult(
          "TEMPLATE_NOT_FOUND",
          "Executive summary template not found",
        );
      }

      const summaryData = {
        ...businessData,
        timeRange,
        generatedAt: new Date(),
        executiveSummary: this.generateExecutiveSummaryText(businessData),
        charts: this.generateChartData(businessData.salesMetrics),
      };

      const fileName = this.generateFileName(
        "executive_summary",
        timeRange.from,
        timeRange.to,
      );
      const filePath = path.join(this.outputDirectory, fileName);

      const htmlContent = this.processTemplate(template.template, summaryData);
      await this.generatePDFFromHTML(htmlContent, filePath, {
        template: "executive_summary",
        data: summaryData,
        format: "A4",
        orientation: "portrait",
      });

      const fileStats = await fs.stat(filePath);
      const generatedDoc: GeneratedDocument = {
        id: this.generateDocumentId(),
        fileName,
        filePath,
        type: "executive_summary",
        generatedAt: new Date(),
        metadata: {
          templateId: template.id,
          dataSource: "business_metrics",
          fileSize: fileStats.size,
          pageCount: Math.max(
            3,
            Math.ceil(businessData.keyInsights.length / 5),
          ),
        },
      };

      await this.saveDocumentRecord(generatedDoc);

      return {
        success: true,
        data: generatedDoc,
        metadata: {
          executionTimeMs: Date.now() - startTime,
          fromCache: false,
        },
      };
    } catch (error) {
      Logger.error("Failed to generate executive summary", error);
      return this.createErrorResult(
        "GENERATION_FAILED",
        `Executive summary generation failed: ${error.message}`,
      );
    }
  }

  // プライベートメソッド群

  private async buildBattlecardData(
    competitorName: string,
    customerInfo?: any,
  ): Promise<BattlecardData> {
    // 競合情報データベースから情報を取得(実際の実装では外部データソースから)
    const competitorData = await this.getCompetitorData(competitorName);

    const battlecardData: BattlecardData = {
      competitor: {
        name: competitorName,
        marketShare: competitorData.marketShare || 15,
        strengths: competitorData.strengths || [
          "知名度が高い",
          "導入実績が豊富",
          "価格競争力がある",
        ],
        weaknesses: competitorData.weaknesses || [
          "カスタマイズが困難",
          "サポート体制が弱い",
          "新機能の追加が遅い",
        ],
        pricing: {
          model: competitorData.pricingModel || "サブスクリプション",
          range: competitorData.priceRange || "¥50万-200万/年",
          comparison: "higher",
        },
      },
      ourSolution: {
        name: "MARIA Enterprise",
        strengths: [
          "AI機能の豊富さ",
          "カスタマイズ性の高さ",
          "24/7サポート",
          "ローカル実行可能",
        ],
        uniqueValue: [
          "完全オンプレミス対応",
          "AIによる自動最適化",
          "日本語ネイティブサポート",
        ],
        pricing: {
          model: "ライセンス + サポート",
          range: "¥30万-150万/年",
          roi: "18ヶ月での投資回収",
        },
      },
      customerInfo,
      talkingPoints: {
        openingMessages: [
          `${competitorName}との比較でお悩みでしょうか？`,
          "コスト削減と機能強化を両立できる解決策があります。",
          "多くの企業が当社に切り替える理由をご説明します。",
        ],
        objectionHandlers: [
          {
            objection: "価格が心配です",
            response:
              "ROI18ヶ月での投資回収が可能です。長期的にはコスト削減効果が期待できます。",
          },
          {
            objection: "導入の手間が心配",
            response:
              "専門チームが3ヶ月での確実な導入をサポートします。移行期間中のリスクも最小化します。",
          },
        ],
        closingMessages: [
          "まずはPoC(概念実証)から始めませんか？",
          "御社に最適なプランを作成いたします。",
          "導入効果を実際に体験していただけます。",
        ],
      },
      caseStudies: [
        {
          customerName: "XYZ製造株式会社",
          industry: "製造業",
          challenge: "複雑な生産スケジュール管理",
          solution: "AIによる生産計画最適化",
          results: ["生産効率20%向上", "コスト15%削減", "納期遵守率95%達成"],
        },
      ],
      metadata: {
        generatedAt: new Date(),
        version: "1.0",
        lastUpdated: new Date(),
      },
    };

    return battlecardData;
  }

  private async getCompetitorData(competitorName: string): Promise<any> {
    // 実際の実装では競合データベースから取得
    // ここではデモデータを返す
    const competitorDatabase: Record<string, any> = {
      CompetitorX: {
        marketShare: 25,
        strengths: ["市場シェア1位", "豊富な導入実績", "グローバル対応"],
        weaknesses: ["価格が高い", "カスタマイズ困難", "日本語サポート不足"],
        pricingModel: "エンタープライズライセンス",
        priceRange: "¥100万-500万/年",
      },
      CompetitorY: {
        marketShare: 18,
        strengths: ["使いやすいUI", "クラウド対応", "導入が簡単"],
        weaknesses: ["セキュリティが不安", "オフライン不可", "機能が限定的"],
        pricingModel: "SaaS月額",
        priceRange: "¥5万-20万/月",
      },
    };

    return (
      competitorDatabase[competitorName] || {
        marketShare: 10,
        strengths: ["一般的な機能"],
        weaknesses: ["特筆すべき弱点"],
        pricingModel: "要問い合わせ",
        priceRange: "要問い合わせ",
      }
    );
  }

  private processTemplate(template: string, data: any): string {
    let processedTemplate = template;

    // シンプルな変数置換(実際の実装ではHandlebars等を使用)
    const variableRegex = /\{\{(\w+(?:\.\w+)*)\}\}/g;

    processedTemplate = processedTemplate.replace(
      variableRegex,
      (match, variablePath) => {
        const value = this.getNestedValue(data, variablePath);
        return value !== undefined ? String(value) : match;
      },
    );

    // 配列の処理
    const arrayRegex = /\{\{#each (\w+)\}\}(.*?)\{\{\/each\}\}/gs;

    processedTemplate = processedTemplate.replace(
      arrayRegex,
      (match, arrayName, itemTemplate) => {
        const array = data[arrayName];
        if (!Array.isArray(array)) return "";

        return array
          .map((item) => {
            return itemTemplate.replace(/\{\{(\w+)\}\}/g, (itemMatch, prop) => {
              return String(item[prop] || "");
            });
          })
          .join("");
      },
    );

    return processedTemplate;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split(".").reduce((current, prop) => current?.[prop], obj);
  }

  private async generatePDFFromHTML(
    htmlContent: string,
    outputPath: string,
    options?: Partial<PDFGenerationOptions>,
  ): Promise<void> {
    // 実際の実装ではPuppeteerやwkhtmltopdf等を使用
    // ここでは簡易的にHTMLファイルとして保存(デモ用)
    const htmlPath = outputPath.replace(".pdf", ".html");

    const fullHTML = `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Generated Document</title>
    <style>
        body { font-family: 'Helvetica', 'Arial', sans-serif; margin: 40px; line-height: 1.6; }
        .header { border-bottom: 3px solid #2196F3; padding-bottom: 20px; margin-bottom: 30px; }
        .competitor-section { background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px; }
        .our-solution { background: #e8f5e8; padding: 20px; margin: 20px 0; border-radius: 8px; }
        .talking-points { background: #fff3e0; padding: 20px; margin: 20px 0; border-radius: 8px; }
        .case-study { border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .strengths { color: #2e7d32; }
        .weaknesses { color: #d32f2f; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
        .metric-card { background: #f8f9fa; padding: 15px; border-radius: 8px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; color: #2196F3; }
        ul { padding-left: 20px; }
        @media print { body { margin: 20px; } }
    </style>
</head>
<body>
    ${htmlContent}
</body>
</html>`;

    await fs.writeFile(htmlPath, fullHTML, "utf8");

    // PDF生成の代替として、HTMLファイルをPDFとして扱う(デモ用)
    await fs.copyFile(htmlPath, outputPath);
  }

  private generateFileName(
    type: string,
    ...params: (string | undefined)[]
  ): string {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    const cleanParams = params
      .filter((p) => p)
      .map((p) => p!.replace(/[^\w\-]/g, "_"));

    return `${type}_${cleanParams.join("_")}_${timestamp}.pdf`;
  }

  private generateDocumentId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private estimatePageCount(documentType: string, data: any): number {
    switch (documentType) {
      case "battlecard":
        return 2;
      case "sales_report":
        return Math.max(3, Math.ceil((data.trends?.length || 0) / 10));
      case "executive_summary":
        return Math.max(2, Math.ceil((data.keyInsights?.length || 0) / 8));
      default:
        return 1;
    }
  }

  private getReportPeriod(reportType: string): string {
    const now = new Date();
    switch (reportType) {
      case "daily":
        return now.toISOString().split("T")[0];
      case "weekly":
        const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
        return `${weekStart.toISOString().split("T")[0]} to ${new Date().toISOString().split("T")[0]}`;
      case "monthly":
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      case "quarterly":
        const quarter = Math.ceil((now.getMonth() + 1) / 3);
        return `Q${quarter} ${now.getFullYear()}`;
      default:
        return "Custom period";
    }
  }

  private generateExecutiveSummaryText(businessData: any): string {
    const metrics = businessData.salesMetrics;
    const winRatePercent = (metrics.winRate * 100).toFixed(1);

    return `
    Executive Summary:
    
    Our sales performance shows ${winRatePercent}% win rate with ${metrics.totalOpportunities} total opportunities 
    valued at ¥${metrics.totalValue.toLocaleString()}. The average deal size is ¥${metrics.averageDealSize.toLocaleString()}.
    
    Key highlights include strong pipeline velocity and forecast accuracy of ${(metrics.forecastAccuracy * 100).toFixed(1)}%.
    `;
  }

  private generateChartData(salesMetrics: SalesMetrics): any {
    // 実際の実装ではChart.js等でチャート生成
    return {
      winRateChart: {
        type: "pie",
        data: {
          won: Math.round(salesMetrics.winRate * 100),
          lost: Math.round((1 - salesMetrics.winRate) * 100),
        },
      },
      trendChart: {
        type: "line",
        data: salesMetrics.trends,
      },
    };
  }

  // テンプレート管理

  private async loadTemplates(): Promise<void> {
    try {
      const templateFiles = await fs.readdir(this.templatesDirectory);

      for (const file of templateFiles) {
        if (file.endsWith(".json")) {
          const filePath = path.join(this.templatesDirectory, file);
          const content = await fs.readFile(filePath, "utf8");
          const template: DocumentTemplate = JSON.parse(content);
          this.templates.set(template.id, template);
        }
      }
    } catch (error) {
      Logger.info("No existing templates found, will initialize defaults");
    }
  }

  private async initializeDefaultTemplates(): Promise<void> {
    await this.createDefaultBattlecardTemplate();
    await this.createDefaultSalesReportTemplate();
    await this.createDefaultExecutiveSummaryTemplate();
  }

  private async createDefaultBattlecardTemplate(): Promise<void> {
    if (this.templates.has("battlecard_default")) return;

    const template: DocumentTemplate = {
      id: "battlecard_default",
      name: "Default Battlecard Template",
      type: "battlecard",
      format: "pdf",
      variables: [
        "competitor",
        "ourSolution",
        "customerInfo",
        "talkingPoints",
        "caseStudies",
      ],
      template: `
<div class="header">
    <h1>🎯 競合対策カード: {{competitor.name}}</h1>
    <p>生成日時: {{metadata.generatedAt}}</p>
    {{#if customerInfo}}
    <p>対象顧客: {{customerInfo.name}} ({{customerInfo.industry}})</p>
    {{/if}}
</div>

<div class="competitor-section">
    <h2>🏢 競合情報: {{competitor.name}}</h2>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div>
            <h3 class="strengths">✅ 競合の強み</h3>
            <ul>
            {{#each competitor.strengths}}
                <li>{{this}}</li>
            {{/each}}
            </ul>
        </div>
        <div>
            <h3 class="weaknesses">❌ 競合の弱み</h3>
            <ul>
            {{#each competitor.weaknesses}}
                <li>{{this}}</li>
            {{/each}}
            </ul>
        </div>
    </div>
    <h3>💰 価格情報</h3>
    <p>モデル: {{competitor.pricing.model}} | 価格帯: {{competitor.pricing.range}}</p>
</div>

<div class="our-solution">
    <h2>🚀 当社ソリューション: {{ourSolution.name}}</h2>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div>
            <h3>✨ 当社の強み</h3>
            <ul>
            {{#each ourSolution.strengths}}
                <li>{{this}}</li>
            {{/each}}
            </ul>
        </div>
        <div>
            <h3>🎯 独自価値</h3>
            <ul>
            {{#each ourSolution.uniqueValue}}
                <li>{{this}}</li>
            {{/each}}
            </ul>
        </div>
    </div>
    <h3>💡 ROI提案</h3>
    <p>{{ourSolution.pricing.roi}} ({{ourSolution.pricing.range}})</p>
</div>

<div class="talking-points">
    <h2>💬 商談トークポイント</h2>
    
    <h3>🎬 オープニング</h3>
    <ul>
    {{#each talkingPoints.openingMessages}}
        <li>{{this}}</li>
    {{/each}}
    </ul>
    
    <h3>🛡️ 反論処理</h3>
    {{#each talkingPoints.objectionHandlers}}
    <div style="margin: 10px 0; padding: 10px; background: #f0f0f0; border-radius: 5px;">
        <strong>反論:</strong> {{objection}}<br>
        <strong>回答:</strong> {{response}}
    </div>
    {{/each}}
    
    <h3>🎯 クロージング</h3>
    <ul>
    {{#each talkingPoints.closingMessages}}
        <li>{{this}}</li>
    {{/each}}
    </ul>
</div>

<h2>📊 導入事例</h2>
{{#each caseStudies}}
<div class="case-study">
    <h3>{{customerName}} ({{industry}})</h3>
    <p><strong>課題:</strong> {{challenge}}</p>
    <p><strong>解決:</strong> {{solution}}</p>
    <p><strong>成果:</strong></p>
    <ul>
    {{#each results}}
        <li>{{this}}</li>
    {{/each}}
    </ul>
</div>
{{/each}}
`,
    };

    this.templates.set(template.id, template);
    await this.saveTemplate(template);
  }

  private async createDefaultSalesReportTemplate(): Promise<void> {
    if (this.templates.has("sales_report_weekly")) return;

    const template: DocumentTemplate = {
      id: "sales_report_weekly",
      name: "Weekly Sales Report",
      type: "sales_report",
      format: "pdf",
      variables: [
        "totalOpportunities",
        "totalValue",
        "winRate",
        "byStage",
        "byOwner",
        "trends",
      ],
      template: `
<div class="header">
    <h1>📊 週次営業レポート</h1>
    <p>レポート期間: {{reportPeriod}}</p>
    <p>生成日時: {{generatedAt}}</p>
</div>

<div class="metrics">
    <div class="metric-card">
        <div class="metric-value">{{totalOpportunities}}</div>
        <div>総商談数</div>
    </div>
    <div class="metric-card">
        <div class="metric-value">¥{{totalValue}}</div>
        <div>総金額</div>
    </div>
    <div class="metric-card">
        <div class="metric-value">{{winRate}}%</div>
        <div>勝率</div>
    </div>
    <div class="metric-card">
        <div class="metric-value">¥{{averageDealSize}}</div>
        <div>平均案件金額</div>
    </div>
</div>

<h2>📈 ステージ別状況</h2>
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr style="background: #f5f5f5;">
        <th style="border: 1px solid #ddd; padding: 10px;">ステージ</th>
        <th style="border: 1px solid #ddd; padding: 10px;">件数</th>
        <th style="border: 1px solid #ddd; padding: 10px;">金額</th>
    </tr>
    {{#each byStage}}
    <tr>
        <td style="border: 1px solid #ddd; padding: 10px;">{{@key}}</td>
        <td style="border: 1px solid #ddd; padding: 10px;">{{count}}</td>
        <td style="border: 1px solid #ddd; padding: 10px;">¥{{value}}</td>
    </tr>
    {{/each}}
</table>

<h2>👥 担当者別実績</h2>
<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr style="background: #f5f5f5;">
        <th style="border: 1px solid #ddd; padding: 10px;">担当者</th>
        <th style="border: 1px solid #ddd; padding: 10px;">商談数</th>
        <th style="border: 1px solid #ddd; padding: 10px;">金額</th>
        <th style="border: 1px solid #ddd; padding: 10px;">勝率</th>
    </tr>
    {{#each byOwner}}
    <tr>
        <td style="border: 1px solid #ddd; padding: 10px;">{{@key}}</td>
        <td style="border: 1px solid #ddd; padding: 10px;">{{opportunities}}</td>
        <td style="border: 1px solid #ddd; padding: 10px;">¥{{value}}</td>
        <td style="border: 1px solid #ddd; padding: 10px;">{{winRate}}%</td>
    </tr>
    {{/each}}
</table>
`,
    };

    this.templates.set(template.id, template);
    await this.saveTemplate(template);
  }

  private async createDefaultExecutiveSummaryTemplate(): Promise<void> {
    if (this.templates.has("executive_summary_default")) return;

    const template: DocumentTemplate = {
      id: "executive_summary_default",
      name: "Executive Summary",
      type: "executive_summary",
      format: "pdf",
      variables: [
        "salesMetrics",
        "keyInsights",
        "recommendations",
        "executiveSummary",
      ],
      template: `
<div class="header">
    <h1>📈 エグゼクティブサマリー</h1>
    <p>期間: {{timeRange.from}} ～ {{timeRange.to}}</p>
    <p>生成日時: {{generatedAt}}</p>
</div>

<div style="background: #e3f2fd; padding: 20px; margin: 20px 0; border-radius: 8px;">
    <h2>📋 要約</h2>
    <p>{{executiveSummary}}</p>
</div>

<div class="metrics">
    <div class="metric-card">
        <div class="metric-value">{{salesMetrics.totalOpportunities}}</div>
        <div>総商談数</div>
    </div>
    <div class="metric-card">
        <div class="metric-value">¥{{salesMetrics.totalValue}}</div>
        <div>総金額</div>
    </div>
    <div class="metric-card">
        <div class="metric-value">{{salesMetrics.winRate}}%</div>
        <div>勝率</div>
    </div>
    <div class="metric-card">
        <div class="metric-value">{{salesMetrics.forecastAccuracy}}%</div>
        <div>予測精度</div>
    </div>
</div>

<h2>💡 主要インサイト</h2>
<ul>
{{#each keyInsights}}
    <li style="margin: 10px 0; padding: 8px; background: #f8f9fa; border-left: 4px solid #2196F3;">{{this}}</li>
{{/each}}
</ul>

<h2>🎯 推奨アクション</h2>
<ol>
{{#each recommendations}}
    <li style="margin: 10px 0; padding: 8px; background: #e8f5e8; border-left: 4px solid #4caf50;">{{this}}</li>
{{/each}}
</ol>

{{#if risks}}
<h2>⚠️ リスクと対策</h2>
<ul>
{{#each risks}}
    <li style="margin: 10px 0; padding: 8px; background: #fff3e0; border-left: 4px solid #ff9800;">{{this}}</li>
{{/each}}
</ul>
{{/if}}
`,
    };

    this.templates.set(template.id, template);
    await this.saveTemplate(template);
  }

  private async saveTemplate(template: DocumentTemplate): Promise<void> {
    const filePath = path.join(this.templatesDirectory, `${template.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(template, null, 2), "utf8");
  }

  private async saveDocumentRecord(document: GeneratedDocument): Promise<void> {
    const recordsFile = path.join(
      this.outputDirectory,
      "document-records.jsonl",
    );
    const record = JSON.stringify(document) + "\n";
    await fs.appendFile(recordsFile, record, "utf8");
  }

  private createErrorResult(
    code: string,
    message: string,
  ): IntegrationResult<GeneratedDocument> {
    return {
      success: false,
      error: {
        code,
        message,
        source: "DocumentGenerator",
        retryable: false,
        timestamp: new Date(),
      },
    };
  }

  /**
   * 生成履歴の取得
   */
  public async getGenerationHistory(
    filters?: {
      type?: string;
      generatedBy?: string;
      dateRange?: { from: Date; to: Date };
    },
    limit: number = 50,
  ): Promise<GeneratedDocument[]> {
    try {
      const recordsFile = path.join(
        this.outputDirectory,
        "document-records.jsonl",
      );
      const content = await fs.readFile(recordsFile, "utf8");
      const lines = content.trim().split("\n");

      const documents: GeneratedDocument[] = [];

      for (const line of lines) {
        if (line.trim()) {
          const doc = JSON.parse(line);
          doc.generatedAt = new Date(doc.generatedAt);
          documents.push(doc);
        }
      }

      // フィルタリング
      let filtered = documents;

      if (filters?.type) {
        filtered = filtered.filter((doc) => doc.type === filters.type);
      }

      if (filters?.generatedBy) {
        filtered = filtered.filter(
          (doc) => doc.generatedBy === filters.generatedBy,
        );
      }

      if (filters?.dateRange) {
        filtered = filtered.filter(
          (doc) =>
            doc.generatedAt >= filters.dateRange!.from &&
            doc.generatedAt <= filters.dateRange!.to,
        );
      }

      return filtered
        .sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime())
        .slice(0, limit);
    } catch (error) {
      Logger.error("Failed to load generation history", error);
      return [];
    }
  }

  /**
   * テンプレート一覧の取得
   */
  public getAvailableTemplates(): DocumentTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * サービスステータスの取得
   */
  public getStatus(): {
    outputDirectory: string;
    templateCount: number;
    totalDocumentsGenerated: number;
  } {
    return {
      outputDirectory: this.outputDirectory,
      templateCount: this.templates.size,
      totalDocumentsGenerated: 0, // 実際は履歴ファイルから算出
    };
  }
}
