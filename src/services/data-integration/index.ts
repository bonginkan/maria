/**
 * Data Integration Services
 * ビジネス向けCLI用のデータ統合サービス
 */

export * from "./types";
export { CRMConnector } from "./CRMConnector";
export { NotificationService } from "./NotificationService";
export { DocumentGenerator } from "./DocumentGenerator";

// 統合データ管理クラス
export class DataIntegrationManager {
  private static instance: DataIntegrationManager;

  public readonly crmConnector: CRMConnector;
  public readonly notificationService: NotificationService;
  public readonly documentGenerator: DocumentGenerator;

  private constructor() {
    // デフォルトCRM設定(CSV)で初期化
    this.crmConnector = new CRMConnector({
      provider: "csv",
      rateLimitPerMinute: 60,
    });

    this.notificationService = NotificationService.getInstance();
    this.documentGenerator = DocumentGenerator.getInstance();
  }

  public static getInstance(): DataIntegrationManager {
    if (!DataIntegrationManager.instance) {
      DataIntegrationManager.instance = new DataIntegrationManager();
    }
    return DataIntegrationManager.instance;
  }

  /**
   * Salesforce CRM設定
   */
  public configureSalesforce(config: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    apiEndpoint?: string;
  }): void {
    // 新しいSalesforce接続でCRMコネクターを再作成
    (this as any).crmConnector = new CRMConnector({
      provider: "salesforce",
      ...config,
      rateLimitPerMinute: 100,
    });
  }

  /**
   * HubSpot CRM設定
   */
  public configureHubSpot(config: {
    apiKey: string;
    apiEndpoint?: string;
  }): void {
    (this as any).crmConnector = new CRMConnector({
      provider: "hubspot",
      clientId: config.apiKey,
      apiEndpoint: config.apiEndpoint,
      rateLimitPerMinute: 100,
    });
  }

  /**
   * CSV CRM設定(フォールバック)
   */
  public configureCSV(csvFilePath: string): void {
    (this as any).crmConnector = new CRMConnector({
      provider: "csv",
      csvFilePath,
      rateLimitPerMinute: 1000, // CSV読み取りは高頻度OK
    });
  }

  /**
   * 全サービスの接続テスト
   */
  public async testAllConnections(): Promise<{
    crm: boolean;
    slack: boolean;
    documentGeneration: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    // CRM接続テスト
    const crmTest = await this.crmConnector.testConnection();
    if (!crmTest.success) {
      errors.push(`CRM: ${crmTest.error?.message}`);
    }

    // Slack接続テスト
    const slackTest = await this.notificationService.testNotification();
    if (!slackTest.success) {
      errors.push(`Slack: ${slackTest.error?.message}`);
    }

    // ドキュメント生成テスト(テンプレート確認)
    const templates = this.documentGenerator.getAvailableTemplates();
    const docGenerationOk = templates.length > 0;
    if (!docGenerationOk) {
      errors.push("Document Generation: No templates available");
    }

    return {
      crm: crmTest.success,
      slack: slackTest.success,
      documentGeneration: docGenerationOk,
      errors,
    };
  }

  /**
   * システム統計の取得
   */
  public async getSystemStats(): Promise<{
    crm: { provider: string; lastSync?: Date };
    notifications: { enabled: boolean; configured: boolean };
    documents: { templateCount: number; totalGenerated: number };
  }> {
    const notificationStatus = this.notificationService.getStatus();
    const documentStatus = this.documentGenerator.getStatus();

    return {
      crm: {
        provider: (this.crmConnector as any).config.provider,
        lastSync: (this.crmConnector as any).lastSyncTime,
      },
      notifications: {
        enabled: notificationStatus.enabled,
        configured: notificationStatus.configured,
      },
      documents: {
        templateCount: documentStatus.templateCount,
        totalGenerated: documentStatus.totalDocumentsGenerated,
      },
    };
  }

  /**
   * 営業ダッシュボード用の統合データ取得
   */
  public async getSalesDashboardData(filters?: {
    ownerId?: string;
    days?: number;
    includeMetrics?: boolean;
  }): Promise<{
    opportunities: any[];
    accounts: any[];
    metrics?: any;
    lastUpdated: Date;
  }> {
    const dateRange = filters?.days
      ? {
          from: new Date(
            Date.now() - filters.days * 24 * 60 * 60 * 1000,
          ).toISOString(),
          to: new Date().toISOString(),
        }
      : undefined;

    // 並列でデータ取得
    const [oppsResult, accountsResult, metricsResult] = await Promise.all([
      this.crmConnector.getOpportunities({
        ownerId: filters?.ownerId,
        dateRange,
      }),
      this.crmConnector.getAccounts({
        ownerId: filters?.ownerId,
      }),
      filters?.includeMetrics
        ? this.crmConnector.getSalesMetrics(dateRange)
        : Promise.resolve(null),
    ]);

    return {
      opportunities: oppsResult.data || [],
      accounts: accountsResult.data || [],
      metrics: metricsResult?.data,
      lastUpdated: new Date(),
    };
  }

  /**
   * バトルカード生成ワークフロー
   */
  public async generateBattlecardWorkflow(
    competitorName: string,
    customerInfo?: any,
    notifySlack: boolean = true,
  ): Promise<{
    success: boolean;
    documentPath?: string;
    notificationSent?: boolean;
    errors?: string[];
  }> {
    const errors: string[] = [];

    try {
      // 1. バトルカード生成
      const docResult = await this.documentGenerator.generateBattlecard(
        competitorName,
        customerInfo,
      );

      if (!docResult.success) {
        errors.push(`Document generation failed: ${docResult.error?.message}`);
        return { success: false, errors };
      }

      // 2. Slack通知(オプション)
      let notificationSent = false;
      if (notifySlack && docResult.data) {
        const notifyResult =
          await this.notificationService.notifyBattlecardGenerated(
            {
              competitor: competitorName,
              customerName: customerInfo?.name,
              pdfPath: docResult.data.filePath,
              generatedBy: "MARIA CLI",
            },
            {
              recipientType: "sales",
              urgency: "medium",
              data: { competitorName, customerInfo },
            },
          );

        notificationSent = notifyResult.success;
        if (!notificationSent) {
          errors.push(`Notification failed: ${notifyResult.error?.message}`);
        }
      }

      return {
        success: true,
        documentPath: docResult.data!.filePath,
        notificationSent,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      errors.push(`Workflow error: ${error.message}`);
      return { success: false, errors };
    }
  }
}
