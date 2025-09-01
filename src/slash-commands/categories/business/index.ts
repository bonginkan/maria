/**
 * Business Commands Module
 * ビジネス向けスラッシュコマンド統合エクスポート
 */

export * from "./types";
export { SalesDashboardCommand } from "./SalesDashboardCommand";
export { BusinessCommandService } from "./BusinessCommandService";

// Note: v2 commands temporarily disabled due to import restrictions

// 便利なヘルパー関数
import { BusinessCommandService } from "./BusinessCommandService";

/**
 * ビジネスコマンドサービスのインスタンス取得
 */
export function getBusinessCommandService(): BusinessCommandService {
  return BusinessCommandService.getInstance();
}

/**
 * 役職に応じた利用可能コマンド一覧
 */
export function getAvailableCommandsForRole(role: string): string[] {
  const service = BusinessCommandService.getInstance();
  return service.getAvailableCommands(role);
}

/**
 * ビジネスコマンドのメタデータ
 */
export const BUSINESS_COMMANDS_METADATA = {
  version: "1.0.0",
  category: "business",
  description:
    "Business-oriented CLI commands for sales, marketing, and executive teams",

  commands: {
    "sales-dashboard": {
      description: "営業ダッシュボード表示",
      implemented: true,
      requiredPermissions: ["view_sales_data", "execute_sales_commands"],
      supportedRoles: ["sales", "sales_manager", "executive", "admin"],
    },
    battlecard: {
      description: "競合対策資料生成",
      implemented: false,
      requiredPermissions: ["view_sales_data", "execute_sales_commands"],
      supportedRoles: ["sales", "sales_manager", "executive", "admin"],
    },
    tune: {
      description: "自然言語による報酬モデル調整",
      implemented: false,
      requiredPermissions: [
        "tune_sales_rewards",
        "tune_marketing_rewards",
        "tune_global_rewards",
      ],
      supportedRoles: ["sales_manager", "marketing", "executive", "admin"],
    },
  },

  features: {
    rbacIntegration: true,
    auditLogging: true,
    slackNotifications: true,
    multiFormatOutput: true,
    realTimeDashboards: true,
  },

  dependencies: {
    "services/rbac": "Role-based access control",
    "services/data-integration": "CRM and notification services",
    blessed: "TUI framework for dashboards",
  },
} as const;
