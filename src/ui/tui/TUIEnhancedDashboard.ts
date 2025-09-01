/**
 * TUI Enhanced Dashboard - blessed.js統合
 * インタラクティブなターミナルダッシュボード
 */

import blessed from "blessed";
import { SalesMetrics } from "../../services/data-integration/types";
import { AuthenticationService } from "../../services/rbac/AuthenticationService";
import { CRMConnector } from "../../services/data-integration/CRMConnector";
import { Logger } from "../../utils/logger";

export interface DashboardOptions {
  refreshInterval?: number; // seconds
  theme?: "default" | "dark" | "light" | "business";
  sections?: DashboardSection[];
  autoRefresh?: boolean;
  showHelp?: boolean;
}

export interface DashboardSection {
  id: string;
  title: string;
  type: "metrics" | "chart" | "table" | "text" | "gauge";
  position: {
    x: number;
    y: number;
    width: string | number;
    height: string | number;
  };
  enabled: boolean;
}

export class TUIEnhancedDashboard {
  private screen: blessed.Widgets.Screen;
  private containers: Map<string, blessed.Widgets.BoxElement> = new Map();
  private refreshTimer?: NodeJS.Timer;
  private options: DashboardOptions;
  private currentProfile: string = "sales";
  private salesData?: SalesMetrics;
  private isRunning: boolean = false;

  constructor(options: DashboardOptions = {}) {
    this.options = {
      refreshInterval: options.refreshInterval || 30,
      theme: options.theme || "business",
      autoRefresh: options.autoRefresh !== false,
      showHelp: options.showHelp !== false,
      sections: options.sections || this.getDefaultSections(),
    };

    this.screen = blessed.screen({
      smartCSR: true,
      title: "MARIA Business Dashboard",
    });

    this.setupScreen();
    this.setupKeyBindings();
  }

  private getDefaultSections(): DashboardSection[] {
    return [
      {
        id: "header",
        title: "ダッシュボード ヘッダー",
        type: "text",
        position: { x: 0, y: 0, width: "100%", height: 3 },
        enabled: true,
      },
      {
        id: "kpi_metrics",
        title: "KPI メトリクス",
        type: "metrics",
        position: { x: 0, y: 3, width: "100%", height: 8 },
        enabled: true,
      },
      {
        id: "trends_chart",
        title: "トレンド チャート",
        type: "chart",
        position: { x: 0, y: 11, width: "50%", height: 12 },
        enabled: true,
      },
      {
        id: "opportunities_table",
        title: "商談一覧",
        type: "table",
        position: { x: "50%", y: 11, width: "50%", height: 12 },
        enabled: true,
      },
      {
        id: "alerts",
        title: "アラート",
        type: "text",
        position: { x: 0, y: 23, width: "100%", height: 5 },
        enabled: true,
      },
      {
        id: "help",
        title: "ヘルプ",
        type: "text",
        position: { x: 0, y: 28, width: "100%", height: 3 },
        enabled: true,
      },
    ];
  }

  private setupScreen(): void {
    // 画面のスタイル設定
    this.screen.style = this.getThemeStyles();

    // 各セクションのコンテナ作成
    for (const section of this.options.sections!) {
      if (!section.enabled) continue;

      const container = this.createSectionContainer(section);
      this.containers.set(section.id, container);
      this.screen.append(container);
    }
  }

  private getThemeStyles(): any {
    const themes = {
      business: {
        bg: "#001122",
        fg: "#ffffff",
        border: "#0066cc",
        accent: "#00aa44",
      },
      dark: {
        bg: "#1a1a1a",
        fg: "#ffffff",
        border: "#444444",
        accent: "#ffaa00",
      },
      light: {
        bg: "#ffffff",
        fg: "#000000",
        border: "#cccccc",
        accent: "#0066cc",
      },
      default: {
        bg: "default",
        fg: "default",
        border: "white",
        accent: "cyan",
      },
    };

    return themes[this.options.theme!] || themes.default;
  }

  private createSectionContainer(
    section: DashboardSection,
  ): blessed.Widgets.BoxElement {
    const theme = this.getThemeStyles();

    const container = blessed.box({
      label: ` ${section.title} `,
      left: section.position.x,
      top: section.position.y,
      width: section.position.width,
      height: section.position.height,
      border: { type: "line" },
      style: {
        fg: theme.fg,
        bg: theme.bg,
        border: { fg: theme.border },
        label: { fg: theme.accent },
      },
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
    });

    return container;
  }

  private setupKeyBindings(): void {
    // ESC または Ctrl+C で終了
    this.screen.key(["escape", "C-c"], () => {
      this.stop();
    });

    // R で手動リフレッシュ
    this.screen.key(["r"], () => {
      this.refresh();
    });

    // H でヘルプ表示切り替え
    this.screen.key(["h"], () => {
      this.toggleHelp();
    });

    // 1-5 で表示プロファイル切り替え
    this.screen.key(["1"], () => this.switchProfile("executive"));
    this.screen.key(["2"], () => this.switchProfile("sales_manager"));
    this.screen.key(["3"], () => this.switchProfile("sales"));
    this.screen.key(["4"], () => this.switchProfile("marketing"));
    this.screen.key(["5"], () => this.switchProfile("pm"));

    // F1-F5 でセクション表示切り替え
    this.screen.key(["f1"], () => this.toggleSection("kpi_metrics"));
    this.screen.key(["f2"], () => this.toggleSection("trends_chart"));
    this.screen.key(["f3"], () => this.toggleSection("opportunities_table"));
    this.screen.key(["f4"], () => this.toggleSection("alerts"));
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;

    try {
      this.isRunning = true;

      // 初期データロード
      await this.loadInitialData();

      // 初期描画
      await this.refresh();

      // 自動リフレッシュ開始
      if (this.options.autoRefresh) {
        this.startAutoRefresh();
      }

      // 画面レンダリング開始
      this.screen.render();

      Logger.info("TUI Enhanced Dashboard started", {
        theme: this.options.theme,
        refreshInterval: this.options.refreshInterval,
        profile: this.currentProfile,
      });
    } catch (error) {
      Logger.error("Failed to start TUI dashboard", error);
      throw error;
    }
  }

  public stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }

    this.screen.destroy();

    Logger.info("TUI Enhanced Dashboard stopped");
    process.exit(0);
  }

  private async loadInitialData(): Promise<void> {
    try {
      const authService = AuthenticationService.getInstance();
      const currentUser = await authService.getCurrentUser();

      if (currentUser) {
        this.currentProfile = currentUser.role.toLowerCase();
      }

      const crmConnector = CRMConnector.getInstance();
      const salesResult = await crmConnector.getSalesMetrics({
        ownerId: currentUser?.id,
        days: 30,
      });

      if (salesResult.success) {
        this.salesData = salesResult.data;
      }
    } catch (error) {
      Logger.error("Failed to load initial data", error);
    }
  }

  private startAutoRefresh(): void {
    this.refreshTimer = setInterval(() => {
      this.refresh().catch((error) => {
        Logger.error("Auto refresh failed", error);
      });
    }, this.options.refreshInterval! * 1000);
  }

  private async refresh(): Promise<void> {
    try {
      await this.loadInitialData();

      // 各セクションの更新
      this.updateHeader();
      this.updateKPIMetrics();
      this.updateTrendsChart();
      this.updateOpportunitiesTable();
      this.updateAlerts();
      this.updateHelp();

      this.screen.render();
    } catch (error) {
      Logger.error("Dashboard refresh failed", error);
    }
  }

  private updateHeader(): void {
    const container = this.containers.get("header");
    if (!container) return;

    const now = new Date();
    const timeString = now.toLocaleString("ja-JP");

    container.setContent(`
{center}🚀 MARIA Business Dashboard - ${this.currentProfile.toUpperCase()} Profile{/center}
{center}最終更新: ${timeString} | 自動更新: ${this.options.autoRefresh ? "ON" : "OFF"}{/center}
`);
  }

  private updateKPIMetrics(): void {
    const container = this.containers.get("kpi_metrics");
    if (!container || !this.salesData) return;

    const metrics = this.salesData;
    const winRate = (metrics.winRate * 100).toFixed(1);
    const forecastAccuracy = (metrics.forecastAccuracy * 100).toFixed(1);

    container.setContent(`
┌─ 📊 主要KPI ─────────────────────────────────────────────────────────────┐
│                                                                         │
│  💰 総商談数: ${String(metrics.totalOpportunities).padStart(8)}   💵 総金額: ¥${metrics.totalValue.toLocaleString().padStart(12)}  │
│                                                                         │
│  📈 勝率: ${winRate.padStart(6)}%           🎯 予測精度: ${forecastAccuracy.padStart(6)}%            │
│                                                                         │
│  💎 平均案件金額: ¥${metrics.averageDealSize.toLocaleString().padStart(10)}   ⏱️  平均サイクル: ${Math.round(metrics.averageSalesVelocity || 0)}日     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
`);
  }

  private updateTrendsChart(): void {
    const container = this.containers.get("trends_chart");
    if (!container || !this.salesData?.trends) return;

    const trends = this.salesData.trends.slice(-7); // 直近7日
    const maxValue = Math.max(
      ...trends.map((t) => t.newOpportunities + t.wonDeals + t.lostDeals),
    );

    let chartContent = "📈 7日間トレンド\n\n";

    for (const trend of trends) {
      const date = new Date(trend.date).toLocaleDateString("ja-JP", {
        month: "2-digit",
        day: "2-digit",
      });
      const newBar = this.generateBar(trend.newOpportunities, maxValue, "🟢");
      const wonBar = this.generateBar(trend.wonDeals, maxValue, "🟡");
      const lostBar = this.generateBar(trend.lostDeals, maxValue, "🔴");

      chartContent += `${date} 新規${newBar} ${trend.newOpportunities}\n`;
      chartContent += `     成約${wonBar} ${trend.wonDeals}\n`;
      chartContent += `     失注${lostBar} ${trend.lostDeals}\n\n`;
    }

    container.setContent(chartContent);
  }

  private generateBar(value: number, maxValue: number, symbol: string): string {
    const barLength = 20;
    const filledLength = Math.round((value / maxValue) * barLength);
    return symbol.repeat(filledLength) + "░".repeat(barLength - filledLength);
  }

  private updateOpportunitiesTable(): void {
    const container = this.containers.get("opportunities_table");
    if (!container || !this.salesData?.topOpportunities) return;

    let tableContent = "🎯 トップ商談 (金額順)\n\n";
    tableContent += "顧客名              | 金額      | ステージ    | 担当者\n";
    tableContent += "─────────────────────────────────────────────\n";

    for (const opp of this.salesData.topOpportunities.slice(0, 8)) {
      const customerName = (opp.customerName || "N/A")
        .substring(0, 18)
        .padEnd(18);
      const amount = `¥${(opp.amount || 0).toLocaleString()}`.padStart(9);
      const stage = (opp.stage || "N/A").substring(0, 10).padEnd(10);
      const owner = (opp.ownerName || "N/A").substring(0, 8);

      tableContent += `${customerName} | ${amount} | ${stage} | ${owner}\n`;
    }

    container.setContent(tableContent);
  }

  private updateAlerts(): void {
    const container = this.containers.get("alerts");
    if (!container) return;

    const alerts: string[] = [];

    if (this.salesData) {
      // 勝率低下アラート
      if (this.salesData.winRate < 0.3) {
        alerts.push("🚨 勝率が30%を下回っています");
      }

      // 予測精度アラート
      if (this.salesData.forecastAccuracy < 0.7) {
        alerts.push("⚠️  予測精度が70%を下回っています");
      }

      // 商談数減少アラート
      if (this.salesData.totalOpportunities < 10) {
        alerts.push("📉 商談数が少なくなっています");
      }
    }

    if (alerts.length === 0) {
      alerts.push("✅ 現在、アラートはありません");
    }

    const alertContent = "🔔 アラート\n\n" + alerts.join("\n");
    container.setContent(alertContent);
  }

  private updateHelp(): void {
    const container = this.containers.get("help");
    if (!container) return;

    container.setContent(`
キー操作: [R]更新 [H]ヘルプ [1-5]プロファイル切替 [F1-F4]セクション表示切替 [ESC]終了
`);
  }

  private switchProfile(profile: string): void {
    this.currentProfile = profile;
    this.refresh();
  }

  private toggleSection(sectionId: string): void {
    const section = this.options.sections!.find((s) => s.id === sectionId);
    if (section) {
      section.enabled = !section.enabled;

      const container = this.containers.get(sectionId);
      if (container) {
        container.hidden = !section.enabled;
        this.screen.render();
      }
    }
  }

  private toggleHelp(): void {
    const section = this.options.sections!.find((s) => s.id === "help");
    if (section) {
      this.toggleSection("help");
    }
  }

  public setTheme(theme: "default" | "dark" | "light" | "business"): void {
    this.options.theme = theme;
    this.setupScreen();
    this.refresh();
  }

  public setRefreshInterval(seconds: number): void {
    this.options.refreshInterval = seconds;

    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }

    if (this.options.autoRefresh) {
      this.startAutoRefresh();
    }
  }

  public getStatus(): {
    isRunning: boolean;
    currentProfile: string;
    theme: string;
    autoRefresh: boolean;
    refreshInterval: number;
    sectionsCount: number;
  } {
    return {
      isRunning: this.isRunning,
      currentProfile: this.currentProfile,
      theme: this.options.theme!,
      autoRefresh: this.options.autoRefresh!,
      refreshInterval: this.options.refreshInterval!,
      sectionsCount: this.options.sections?.length || 0,
    };
  }
}

// エクスポート用のファクトリ関数
export function createEnhancedTUIDashboard(
  options?: DashboardOptions,
): TUIEnhancedDashboard {
  return new TUIEnhancedDashboard(options);
}

// プリセットテーマ
export const DASHBOARD_THEMES = {
  BUSINESS: {
    theme: "business" as const,
    refreshInterval: 30,
    autoRefresh: true,
    showHelp: true,
  },
  EXECUTIVE: {
    theme: "light" as const,
    refreshInterval: 60,
    autoRefresh: true,
    showHelp: false,
  },
  DEVELOPER: {
    theme: "dark" as const,
    refreshInterval: 15,
    autoRefresh: true,
    showHelp: true,
  },
} as const;
