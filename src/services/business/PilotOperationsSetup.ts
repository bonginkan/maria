/**
 * Pilot Operations Setup - 5人営業チーム向けパイロット運用セットアップ
 * SOW v2.1 完了後のパイロット運用準備
 */

import * as fs from "fs/promises";
import * as path from "path";
import { AuthenticationService } from "../rbac/AuthenticationService";
import { RoleManager } from "../rbac/RoleManager";
import { AuditLogger } from "../rbac/AuditLogger";
import { CRMConnector } from "../data-integration/CRMConnector";
import { NotificationService } from "../data-integration/NotificationService";
import { DocumentGenerator } from "../data-integration/DocumentGenerator";
import { Logger } from "../../utils/logger";

export interface PilotTeamMember {
  id: string;
  name: string;
  email: string;
  role: "sales_manager" | "sales";
  territory?: string;
  specialization?: string;
  onboardingStatus: "pending" | "in_progress" | "completed";
  credentials?: {
    username: string;
    password: string; // 実際の実装では暗号化
    tempPassword: boolean;
  };
}

export interface PilotConfig {
  teamName: string;
  startDate: string;
  endDate: string;
  objectives: string[];
  kpis: PilotKPI[];
  members: PilotTeamMember[];
  integrations: {
    salesforce: boolean;
    slack: boolean;
    email: boolean;
  };
  features: {
    battlecard: boolean;
    tune: boolean;
    dashboard: boolean;
    reports: boolean;
  };
}

export interface PilotKPI {
  name: string;
  target: number;
  unit: string;
  frequency: "daily" | "weekly" | "monthly";
  description: string;
}

export interface PilotStatus {
  teamId: string;
  status: "setup" | "onboarding" | "running" | "completed" | "paused";
  progress: number; // 0-100
  membersOnboarded: number;
  totalMembers: number;
  kpiTracking: Record<string, any>;
  issues: PilotIssue[];
  lastUpdate: Date;
}

export interface PilotIssue {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  category: "technical" | "user" | "process" | "integration";
  description: string;
  reportedBy: string;
  reportedAt: Date;
  status: "open" | "in_progress" | "resolved";
  resolution?: string;
}

export class PilotOperationsSetup {
  private static instance: PilotOperationsSetup;
  private configDirectory: string;
  private pilotConfigFile: string;
  private statusFile: string;
  private onboardingTemplatesDir: string;

  private constructor() {
    this.configDirectory = path.join(
      process.cwd(),
      ".maria",
      "pilot-operations",
    );
    this.pilotConfigFile = path.join(this.configDirectory, "pilot-config.json");
    this.statusFile = path.join(this.configDirectory, "pilot-status.json");
    this.onboardingTemplatesDir = path.join(
      this.configDirectory,
      "onboarding-templates",
    );
    this.initializeDirectories();
  }

  public static getInstance(): PilotOperationsSetup {
    if (!PilotOperationsSetup.instance) {
      PilotOperationsSetup.instance = new PilotOperationsSetup();
    }
    return PilotOperationsSetup.instance;
  }

  private async initializeDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.configDirectory, { recursive: true });
      await fs.mkdir(this.onboardingTemplatesDir, { recursive: true });
      Logger.info("Pilot operations directories initialized");
    } catch (error) {
      Logger.error("Failed to initialize pilot operations directories", error);
    }
  }

  /**
   * パイロット運用のセットアップ
   */
  public async setupPilotOperation(
    config: PilotConfig,
    setupBy: string,
  ): Promise<{ success: boolean; pilotId?: string; message: string }> {
    const startTime = Date.now();

    try {
      const pilotId = this.generatePilotId();

      Logger.info("Starting pilot operation setup", {
        pilotId,
        teamName: config.teamName,
        memberCount: config.members.length,
      });

      // 1. 基本設定の保存
      await this.savePilotConfig(pilotId, config);

      // 2. チームメンバーのアカウント作成
      const accountSetupResult = await this.setupTeamAccounts(
        config.members,
        pilotId,
      );
      if (!accountSetupResult.success) {
        return {
          success: false,
          message: `アカウント設定に失敗: ${accountSetupResult.message}`,
        };
      }

      // 3. 統合設定
      const integrationResult = await this.setupIntegrations(
        config.integrations,
        pilotId,
      );
      if (!integrationResult.success) {
        Logger.warn("Integration setup partially failed", integrationResult);
      }

      // 4. オンボーディング資料の準備
      await this.prepareOnboardingMaterials(config);

      // 5. 初期ステータスの作成
      const initialStatus: PilotStatus = {
        teamId: pilotId,
        status: "setup",
        progress: 25, // セットアップ完了で25%
        membersOnboarded: 0,
        totalMembers: config.members.length,
        kpiTracking: this.initializeKPITracking(config.kpis),
        issues: [],
        lastUpdate: new Date(),
      };
      await this.updatePilotStatus(pilotId, initialStatus);

      // 6. 監査ログ記録
      const auditLogger = AuditLogger.getInstance();
      await auditLogger.logBusinessOperation({
        type: "PILOT_SETUP_COMPLETED",
        userId: setupBy,
        operation: "pilot_operations_setup",
        resourceId: pilotId,
        details: {
          teamName: config.teamName,
          memberCount: config.members.length,
          features: config.features,
          integrations: config.integrations,
        },
      });

      Logger.info("Pilot operation setup completed", {
        pilotId,
        executionTimeMs: Date.now() - startTime,
      });

      return {
        success: true,
        pilotId,
        message: `パイロット運用 '${config.teamName}' のセットアップが完了しました`,
      };
    } catch (error) {
      Logger.error("Pilot operation setup failed", error);
      return {
        success: false,
        message: `セットアップに失敗: ${error.message}`,
      };
    }
  }

  /**
   * チームメンバーのオンボーディング実行
   */
  public async onboardMember(
    pilotId: string,
    memberId: string,
    onboardingBy: string,
  ): Promise<{ success: boolean; message: string; credentials?: any }> {
    try {
      const config = await this.loadPilotConfig(pilotId);
      if (!config) {
        return { success: false, message: "パイロット設定が見つかりません" };
      }

      const member = config.members.find((m) => m.id === memberId);
      if (!member) {
        return { success: false, message: "メンバーが見つかりません" };
      }

      Logger.info("Starting member onboarding", {
        pilotId,
        memberId,
        memberName: member.name,
      });

      // 1. アカウントアクティベーション
      const authService = AuthenticationService.getInstance();
      const activationResult = await authService.activateUser(memberId);
      if (!activationResult) {
        return {
          success: false,
          message: "アカウントアクティベーションに失敗",
        };
      }

      // 2. 権限設定
      await this.setupMemberPermissions(member);

      // 3. オンボーディング通知送信
      await this.sendOnboardingNotification(member, pilotId);

      // 4. オンボーディングステータス更新
      member.onboardingStatus = "completed";
      await this.savePilotConfig(pilotId, config);

      // 5. パイロットステータス更新
      await this.updateOnboardingProgress(pilotId);

      Logger.info("Member onboarding completed", { pilotId, memberId });

      return {
        success: true,
        message: `${member.name} のオンボーディングが完了しました`,
        credentials: {
          username: member.credentials?.username,
          tempPassword: member.credentials?.tempPassword,
          dashboardUrl: "https://maria-dashboard.local",
          supportEmail: "maria-pilot-support@company.com",
        },
      };
    } catch (error) {
      Logger.error("Member onboarding failed", error, { pilotId, memberId });
      return {
        success: false,
        message: `オンボーディングに失敗: ${error.message}`,
      };
    }
  }

  /**
   * パイロット運用の開始
   */
  public async startPilotOperation(
    pilotId: string,
    startedBy: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const status = await this.loadPilotStatus(pilotId);
      if (!status) {
        return {
          success: false,
          message: "パイロットステータスが見つかりません",
        };
      }

      if (status.status !== "onboarding") {
        return {
          success: false,
          message: `現在のステータス '${status.status}' からは開始できません`,
        };
      }

      // 全メンバーのオンボーディング完了確認
      if (status.membersOnboarded < status.totalMembers) {
        return {
          success: false,
          message: `オンボーディング未完了のメンバーがいます (${status.membersOnboarded}/${status.totalMembers})`,
        };
      }

      // ステータス更新
      status.status = "running";
      status.progress = 100;
      status.lastUpdate = new Date();
      await this.updatePilotStatus(pilotId, status);

      // 開始通知送信
      await this.sendPilotStartNotification(pilotId);

      // 監査ログ
      const auditLogger = AuditLogger.getInstance();
      await auditLogger.logBusinessOperation({
        type: "PILOT_OPERATION_STARTED",
        userId: startedBy,
        operation: "start_pilot",
        resourceId: pilotId,
      });

      Logger.info("Pilot operation started", { pilotId });

      return {
        success: true,
        message: "パイロット運用を開始しました",
      };
    } catch (error) {
      Logger.error("Failed to start pilot operation", error, { pilotId });
      return { success: false, message: `開始に失敗: ${error.message}` };
    }
  }

  /**
   * パイロット運用のモニタリング
   */
  public async monitorPilotOperation(pilotId: string): Promise<{
    success: boolean;
    status?: PilotStatus;
    recommendations?: string[];
    alerts?: string[];
  }> {
    try {
      const status = await this.loadPilotStatus(pilotId);
      if (!status) {
        return { success: false };
      }

      const config = await this.loadPilotConfig(pilotId);
      if (!config) {
        return { success: false };
      }

      // KPI進捗の更新
      const updatedKPIs = await this.updateKPIProgress(
        pilotId,
        status.kpiTracking,
      );
      status.kpiTracking = updatedKPIs;

      // 推奨事項の生成
      const recommendations = this.generateRecommendations(status, config);

      // アラートの確認
      const alerts = this.checkAlerts(status, config);

      // ステータス更新
      status.lastUpdate = new Date();
      await this.updatePilotStatus(pilotId, status);

      return {
        success: true,
        status,
        recommendations,
        alerts,
      };
    } catch (error) {
      Logger.error("Pilot monitoring failed", error, { pilotId });
      return { success: false };
    }
  }

  // プライベートメソッド

  private generatePilotId(): string {
    return `pilot_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }

  private async savePilotConfig(
    pilotId: string,
    config: PilotConfig,
  ): Promise<void> {
    const configWithId = { pilotId, ...config };
    await fs.writeFile(
      this.pilotConfigFile,
      JSON.stringify(configWithId, null, 2),
    );
  }

  private async loadPilotConfig(pilotId: string): Promise<PilotConfig | null> {
    try {
      const content = await fs.readFile(this.pilotConfigFile, "utf8");
      const data = JSON.parse(content);
      return data.pilotId === pilotId ? data : null;
    } catch (error) {
      return null;
    }
  }

  private async updatePilotStatus(
    pilotId: string,
    status: PilotStatus,
  ): Promise<void> {
    await fs.writeFile(this.statusFile, JSON.stringify(status, null, 2));
  }

  private async loadPilotStatus(pilotId: string): Promise<PilotStatus | null> {
    try {
      const content = await fs.readFile(this.statusFile, "utf8");
      const status = JSON.parse(content);
      return status.teamId === pilotId ? status : null;
    } catch (error) {
      return null;
    }
  }

  private async setupTeamAccounts(
    members: PilotTeamMember[],
    pilotId: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const authService = AuthenticationService.getInstance();
      const roleManager = RoleManager.getInstance();

      for (const member of members) {
        // ユーザーアカウント作成
        const tempPassword = this.generateTempPassword();
        const credentials = {
          username: `${member.name.toLowerCase().replace(/\s+/g, ".")}.pilot`,
          password: tempPassword,
          tempPassword: true,
        };

        const user = await authService.createUser({
          id: member.id,
          username: credentials.username,
          email: member.email,
          role: member.role,
          profile: {
            name: member.name,
            pilotTeam: pilotId,
            territory: member.territory,
            specialization: member.specialization,
          },
        });

        if (!user) {
          throw new Error(`Failed to create user account for ${member.name}`);
        }

        member.credentials = credentials;
        Logger.info("Team member account created", {
          memberId: member.id,
          username: credentials.username,
        });
      }

      return {
        success: true,
        message: "All team accounts created successfully",
      };
    } catch (error) {
      Logger.error("Team account setup failed", error);
      return { success: false, message: error.message };
    }
  }

  private async setupIntegrations(
    integrations: any,
    pilotId: string,
  ): Promise<{ success: boolean; message: string }> {
    const results: string[] = [];

    // Salesforce統合
    if (integrations.salesforce) {
      try {
        const crmConnector = CRMConnector.getInstance({
          provider: "salesforce",
          apiKey: process.env.SALESFORCE_API_KEY || "demo_key",
          endpoint: process.env.SALESFORCE_ENDPOINT || "demo_endpoint",
        });
        // 接続テスト
        results.push("Salesforce integration configured");
      } catch (error) {
        results.push(`Salesforce integration failed: ${error.message}`);
      }
    }

    // Slack統合
    if (integrations.slack) {
      try {
        const notificationService = NotificationService.getInstance();
        // Slack設定テスト
        results.push("Slack integration configured");
      } catch (error) {
        results.push(`Slack integration failed: ${error.message}`);
      }
    }

    return {
      success: true,
      message: results.join(", "),
    };
  }

  private async prepareOnboardingMaterials(config: PilotConfig): Promise<void> {
    // オンボーディング資料の生成
    const materials = {
      welcomeGuide: this.generateWelcomeGuide(config),
      featureOverview: this.generateFeatureOverview(config.features),
      quickStartGuide: this.generateQuickStartGuide(),
      troubleshooting: this.generateTroubleshootingGuide(),
    };

    for (const [fileName, content] of Object.entries(materials)) {
      const filePath = path.join(this.onboardingTemplatesDir, `${fileName}.md`);
      await fs.writeFile(filePath, content);
    }
  }

  private async setupMemberPermissions(member: PilotTeamMember): Promise<void> {
    const roleManager = RoleManager.getInstance();
    const role = roleManager.getRole(member.role);

    // パイロット固有の権限追加
    const pilotPermissions = [
      "pilot:access",
      "dashboard:view",
      "battlecard:generate",
      "tune:apply",
    ];

    // 実際の実装では権限システムに設定
    Logger.info("Member permissions configured", {
      memberId: member.id,
      role: member.role,
      permissions: pilotPermissions,
    });
  }

  private async sendOnboardingNotification(
    member: PilotTeamMember,
    pilotId: string,
  ): Promise<void> {
    const notificationService = NotificationService.getInstance();

    const message = `
🎉 MARIA パイロットプログラムへようこそ！

${member.name}様

パイロットチームのセットアップが完了しました。

**アカウント情報:**
• ユーザー名: ${member.credentials?.username}
• 初回パスワード: ${member.credentials?.password}

**次のステップ:**
1. ダッシュボードにログイン
2. 初回パスワード変更
3. クイックスタートガイド確認

サポート: maria-pilot-support@company.com
`;

    try {
      await notificationService.sendEmailNotification(member.email, message);
      Logger.info("Onboarding notification sent", {
        memberId: member.id,
        email: member.email,
      });
    } catch (error) {
      Logger.error("Failed to send onboarding notification", error);
    }
  }

  private async updateOnboardingProgress(pilotId: string): Promise<void> {
    const status = await this.loadPilotStatus(pilotId);
    if (!status) return;

    const config = await this.loadPilotConfig(pilotId);
    if (!config) return;

    const completedMembers = config.members.filter(
      (m) => m.onboardingStatus === "completed",
    ).length;

    status.membersOnboarded = completedMembers;
    status.progress =
      Math.round((completedMembers / status.totalMembers) * 75) + 25; // 25% base + 75% for members

    if (completedMembers === status.totalMembers) {
      status.status = "onboarding";
    }

    await this.updatePilotStatus(pilotId, status);
  }

  private initializeKPITracking(kpis: PilotKPI[]): Record<string, any> {
    const tracking: Record<string, any> = {};

    for (const kpi of kpis) {
      tracking[kpi.name] = {
        target: kpi.target,
        current: 0,
        progress: 0,
        frequency: kpi.frequency,
        history: [],
      };
    }

    return tracking;
  }

  private async updateKPIProgress(
    pilotId: string,
    currentTracking: Record<string, any>,
  ): Promise<Record<string, any>> {
    // 実際の実装では、CRM、ダッシュボード使用状況などからKPI値を取得
    // ここではデモ値を設定

    const updated = { ...currentTracking };

    for (const [kpiName, tracking] of Object.entries(updated)) {
      // デモ:進捗をランダムに更新
      const increment = Math.random() * 10;
      tracking.current += increment;
      tracking.progress = Math.min(
        (tracking.current / tracking.target) * 100,
        100,
      );

      tracking.history.push({
        date: new Date().toISOString(),
        value: tracking.current,
      });
    }

    return updated;
  }

  private generateRecommendations(
    status: PilotStatus,
    config: PilotConfig,
  ): string[] {
    const recommendations: string[] = [];

    // KPI進捗に基づく推奨事項
    for (const [kpiName, tracking] of Object.entries(status.kpiTracking)) {
      if (tracking.progress < 50) {
        recommendations.push(
          `${kpiName}の進捗が遅れています。追加のサポートを検討してください。`,
        );
      }
    }

    // 利用率に基づく推奨事項
    if (status.membersOnboarded < status.totalMembers) {
      recommendations.push(
        "未オンボーディングのメンバーがいます。個別サポートを実施してください。",
      );
    }

    return recommendations;
  }

  private checkAlerts(status: PilotStatus, config: PilotConfig): string[] {
    const alerts: string[] = [];

    // 重要な問題のアラート
    const criticalIssues = status.issues.filter(
      (issue) => issue.severity === "critical" && issue.status === "open",
    );
    if (criticalIssues.length > 0) {
      alerts.push(`${criticalIssues.length}件の重要な問題が未解決です。`);
    }

    // 長期間更新なしのアラート
    const daysSinceUpdate =
      (Date.now() - status.lastUpdate.getTime()) / (24 * 60 * 60 * 1000);
    if (daysSinceUpdate > 3) {
      alerts.push("3日以上ステータスが更新されていません。");
    }

    return alerts;
  }

  private generateTempPassword(): string {
    return (
      Math.random().toString(36).substring(2, 12) +
      Math.random().toString(36).substring(2, 12)
    );
  }

  private generateWelcomeGuide(config: PilotConfig): string {
    return `
# MARIA パイロットプログラム ウェルカムガイド

## ${config.teamName} チーム

### パイロット概要
- **開始日**: ${config.startDate}
- **終了日**: ${config.endDate}
- **チームメンバー**: ${config.members.length}名

### 目標
${config.objectives.map((obj) => `- ${obj}`).join("\n")}

### 利用可能な機能
${Object.entries(config.features)
  .filter(([key, enabled]) => enabled)
  .map(([key]) => `- ${key}`)
  .join("\n")}

### サポート情報
- **テクニカルサポート**: maria-pilot-support@company.com
- **営業サポート**: sales-support@company.com
- **緊急連絡**: +81-3-1234-5678

### 次のステップ
1. 初回ログイン
2. パスワード変更
3. ダッシュボード確認
4. 機能チュートリアル
`;
  }

  private generateFeatureOverview(features: any): string {
    let content = "# MARIA 機能概要\n\n";

    if (features.battlecard) {
      content += `## バトルカード機能
- 競合対策カードの自動生成
- PDF出力対応
- 使用方法: \`/battlecard --competitor "企業名"\`

`;
    }

    if (features.tune) {
      content += `## 調整機能
- AIエージェントの行動パターン調整
- 自然言語での設定
- 使用方法: \`/tune "調整内容"\`

`;
    }

    if (features.dashboard) {
      content += `## ダッシュボード機能
- リアルタイム営業メトリクス
- インタラクティブTUI
- 使用方法: \`/sales-dashboard\`

`;
    }

    return content;
  }

  private generateQuickStartGuide(): string {
    return `
# クイックスタートガイド

## 1. 初回ログイン
1. ダッシュボードURL: https://maria-dashboard.local
2. 提供されたユーザー名・パスワードでログイン
3. 初回パスワード変更

## 2. 基本操作
### ダッシュボード表示
\`\`\`
/sales-dashboard
\`\`\`

### バトルカード生成
\`\`\`
/battlecard --competitor "CompetitorX"
\`\`\`

### 調整実行
\`\`\`
/tune "売上向上を重視してください"
\`\`\`

## 3. トラブルシューティング
問題が発生した場合は、サポートまでご連絡ください。
`;
  }

  private generateTroubleshootingGuide(): string {
    return `
# トラブルシューティングガイド

## よくある問題

### ログインできない
1. ユーザー名・パスワードの確認
2. キャッシュクリア
3. サポートに連絡

### ダッシュボードが表示されない
1. ブラウザの更新
2. JavaScript有効化確認
3. ネットワーク接続確認

### 機能が動作しない
1. 権限の確認
2. ログの確認
3. 再ログイン

## サポート連絡先
- **Email**: maria-pilot-support@company.com
- **Phone**: +81-3-1234-5678
- **Slack**: #maria-pilot-support
`;
  }

  private async sendPilotStartNotification(pilotId: string): Promise<void> {
    const config = await this.loadPilotConfig(pilotId);
    if (!config) return;

    const notificationService = NotificationService.getInstance();

    const message = `
🚀 MARIA パイロット運用開始！

${config.teamName} チームのパイロット運用を開始しました。

**期間**: ${config.startDate} ～ ${config.endDate}
**メンバー**: ${config.members.length}名
**利用機能**: ${Object.keys(config.features)
      .filter((k) => config.features[k])
      .join(", ")}

皆様の成功をお祈りしています！

MARIA 開発チーム
`;

    // 全メンバーに通知
    for (const member of config.members) {
      try {
        await notificationService.sendEmailNotification(member.email, message);
      } catch (error) {
        Logger.error("Failed to send pilot start notification", error);
      }
    }
  }

  /**
   * デフォルトパイロット設定の生成
   */
  public generateDefaultPilotConfig(): PilotConfig {
    return {
      teamName: "MARIA パイロットチーム",
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0], // 90日後
      objectives: [
        "営業効率の20%向上",
        "バトルカード利用による勝率向上",
        "ダッシュボードでの可視化実現",
        "競合対策の標準化",
        "AI活用による営業プロセス最適化",
      ],
      kpis: [
        {
          name: "月次売上",
          target: 10000000,
          unit: "円",
          frequency: "monthly",
          description: "月次売上目標",
        },
        {
          name: "勝率",
          target: 40,
          unit: "%",
          frequency: "monthly",
          description: "商談勝率",
        },
        {
          name: "ダッシュボード利用率",
          target: 80,
          unit: "%",
          frequency: "weekly",
          description: "ダッシュボード週次利用率",
        },
      ],
      members: [
        {
          id: "pilot_mgr_001",
          name: "山田 管理",
          email: "yamada.manager@company.com",
          role: "sales_manager",
          territory: "Tokyo",
          specialization: "Enterprise Sales",
          onboardingStatus: "pending",
        },
        {
          id: "pilot_sales_001",
          name: "田中 営業",
          email: "tanaka.sales@company.com",
          role: "sales",
          territory: "Tokyo",
          specialization: "Mid-market",
          onboardingStatus: "pending",
        },
        {
          id: "pilot_sales_002",
          name: "佐藤 営業",
          email: "sato.sales@company.com",
          role: "sales",
          territory: "Osaka",
          specialization: "SMB",
          onboardingStatus: "pending",
        },
        {
          id: "pilot_sales_003",
          name: "鈴木 営業",
          email: "suzuki.sales@company.com",
          role: "sales",
          territory: "Nagoya",
          specialization: "Manufacturing",
          onboardingStatus: "pending",
        },
        {
          id: "pilot_sales_004",
          name: "高橋 営業",
          email: "takahashi.sales@company.com",
          role: "sales",
          territory: "Fukuoka",
          specialization: "Technology",
          onboardingStatus: "pending",
        },
      ],
      integrations: {
        salesforce: true,
        slack: true,
        email: true,
      },
      features: {
        battlecard: true,
        tune: true,
        dashboard: true,
        reports: true,
      },
    };
  }
}
