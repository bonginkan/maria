/**
 * Role Manager - ビジネス向けCLI用の役割管理システム
 * 各役職の権限定義と管理を行う
 */

import { Role, UserRole, Permission, DataScope } from "./types";
import { Logger } from "../../utils/logger";

export class RoleManager {
  private static instance: RoleManager;
  private roles: Map<UserRole, Role> = new Map();

  private constructor() {
    this.initializeRoles();
  }

  public static getInstance(): RoleManager {
    if (!RoleManager.instance) {
      RoleManager.instance = new RoleManager();
    }
    return RoleManager.instance;
  }

  private initializeRoles(): void {
    // 経営層(Executive)- 全社データアクセス + 戦略調整権限
    this.roles.set("executive", {
      name: "executive",
      description: "経営層 - 全社KPI、戦略調整、ROI分析",
      permissions: [
        "view_sales_data",
        "view_marketing_data",
        "view_executive_data",
        "view_customer_data",
        "view_financial_data",
        "view_technical_data",
        "execute_executive_commands",
        "tune_global_rewards",
        "export_json",
        "export_pdf",
        "export_to_slack",
        "export_to_external",
        "view_audit_logs",
      ],
      dataScope: {
        departments: "all",
        customerTiers: "all",
        regions: "all",
        timeRangeDays: 365, // 1年分のデータアクセス
        piiMasking: true, // 経営層でもPII保護
      },
    });

    // 営業マネージャー(Sales Manager)- 営業部門 + チーム管理
    this.roles.set("sales_manager", {
      name: "sales_manager",
      description: "営業マネージャー - 営業部門データ + チーム管理権限",
      permissions: [
        "view_sales_data",
        "view_customer_data",
        "execute_sales_commands",
        "tune_sales_rewards",
        "export_json",
        "export_pdf",
        "export_to_slack",
      ],
      dataScope: {
        departments: ["sales"],
        customerTiers: "all",
        regions: "all", // マネージャーは全地域管理
        timeRangeDays: 180, // 6ヶ月分
        piiMasking: true,
      },
    });

    // 営業担当(Sales)- 営業データ + 顧客情報(制限付き)
    this.roles.set("sales", {
      name: "sales",
      description: "営業担当 - 営業データ、顧客情報、競合分析",
      permissions: [
        "view_sales_data",
        "view_customer_data",
        "execute_sales_commands",
        "export_pdf", // バトルカード等の資料作成用
        "export_to_slack",
      ],
      dataScope: {
        departments: ["sales"],
        customerTiers: "all",
        regions: [], // 地域制限は個人設定で決定
        timeRangeDays: 90, // 3ヶ月分
        piiMasking: true,
        excludeFields: ["customer_financial_details", "internal_notes"],
      },
    });

    // マーケティング(Marketing)- マーケデータ + コンテンツ管理
    this.roles.set("marketing", {
      name: "marketing",
      description: "マーケティング - マーケKPI、コンテンツ最適化、A/Bテスト",
      permissions: [
        "view_marketing_data",
        "view_customer_data", // 顧客セグメント分析用
        "execute_marketing_commands",
        "tune_marketing_rewards",
        "export_json",
        "export_pdf",
        "export_to_slack",
        "export_to_external", // GA等外部ツール連携用
      ],
      dataScope: {
        departments: ["marketing"],
        customerTiers: "all",
        regions: "all",
        timeRangeDays: 120, // 4ヶ月分(キャンペーン周期考慮)
        piiMasking: true,
        excludeFields: ["customer_personal_info", "sales_pipeline_details"],
      },
    });

    // プロダクトマネージャー(PM)- 開発データ + 要件管理
    this.roles.set("pm", {
      name: "pm",
      description: "プロダクトマネージャー - 開発KPI、要件管理、技術調整",
      permissions: [
        "view_technical_data",
        "view_customer_data", // ユーザー要求分析用
        "execute_pm_commands",
        "export_json",
        "export_pdf",
        "export_to_slack",
      ],
      dataScope: {
        departments: ["engineering", "product"],
        customerTiers: "all",
        regions: "all",
        timeRangeDays: 60, // 2ヶ月分(スプリント周期考慮)
        piiMasking: true,
        excludeFields: ["customer_financial_info", "sales_forecasts"],
      },
    });

    // システム管理者(Admin)- 全権限
    this.roles.set("admin", {
      name: "admin",
      description: "システム管理者 - 全権限、ユーザー管理、監査",
      permissions: [
        "view_sales_data",
        "view_marketing_data",
        "view_executive_data",
        "view_customer_data",
        "view_financial_data",
        "view_technical_data",
        "execute_sales_commands",
        "execute_marketing_commands",
        "execute_executive_commands",
        "execute_pm_commands",
        "manage_users",
        "manage_roles",
        "view_audit_logs",
        "modify_system_config",
        "tune_global_rewards",
        "export_json",
        "export_pdf",
        "export_to_slack",
        "export_to_external",
      ],
      dataScope: {
        departments: "all",
        customerTiers: "all",
        regions: "all",
        timeRangeDays: 730, // 2年分
        piiMasking: false, // 管理者はマスクなしでデバッグ可能
      },
    });

    Logger.info("Role definitions initialized", {
      roleCount: this.roles.size,
      roles: Array.from(this.roles.keys()),
    });
  }

  /**
   * 指定された役職の役割定義を取得
   */
  public getRole(roleName: UserRole): Role | undefined {
    return this.roles.get(roleName);
  }

  /**
   * 全ての役職定義を取得
   */
  public getAllRoles(): Role[] {
    return Array.from(this.roles.values());
  }

  /**
   * 指定された権限を持つ役職一覧を取得
   */
  public getRolesWithPermission(permission: Permission): UserRole[] {
    const rolesWithPermission: UserRole[] = [];

    for (const [roleName, role] of this.roles) {
      if (role.permissions.includes(permission)) {
        rolesWithPermission.push(roleName);
      }
    }

    return rolesWithPermission;
  }

  /**
   * 役職の権限を検証
   */
  public hasPermission(roleName: UserRole, permission: Permission): boolean {
    const role = this.getRole(roleName);
    return role ? role.permissions.includes(permission) : false;
  }

  /**
   * 複数権限の一括検証
   */
  public hasAllPermissions(
    roleName: UserRole,
    permissions: Permission[],
  ): boolean {
    const role = this.getRole(roleName);
    if (!role) return false;

    return permissions.every((permission) =>
      role.permissions.includes(permission),
    );
  }

  /**
   * 役職のデータスコープを取得
   */
  public getDataScope(roleName: UserRole): DataScope | undefined {
    const role = this.getRole(roleName);
    return role?.dataScope;
  }

  /**
   * コマンドに必要な権限を定義
   */
  public getCommandRequiredPermissions(command: string): Permission[] {
    const commandPermissions: Record<string, Permission[]> = {
      // 営業系コマンド
      "/sales-dashboard": ["view_sales_data", "execute_sales_commands"],
      "/battlecard": [
        "view_sales_data",
        "view_customer_data",
        "execute_sales_commands",
      ],
      "/customer-analysis": ["view_customer_data", "execute_sales_commands"],
      "/sales-forecast": ["view_sales_data", "execute_sales_commands"],
      "/tune": ["tune_sales_rewards"], // デフォルトは営業向け、コマンド内でスコープ判定

      // マーケティング系コマンド
      "/content-impact": ["view_marketing_data", "execute_marketing_commands"],
      "/campaign-optimize": [
        "view_marketing_data",
        "execute_marketing_commands",
      ],
      "/ab-compare": ["view_marketing_data", "execute_marketing_commands"],

      // 経営系コマンド
      "/business-dashboard": [
        "view_executive_data",
        "execute_executive_commands",
      ],
      "/roi-analysis": ["view_executive_data", "view_financial_data"],

      // PM系コマンド
      "/requirement-extract": ["view_technical_data", "execute_pm_commands"],
      "/tech-debt-analysis": ["view_technical_data", "execute_pm_commands"],
      "/sprint-optimize": ["view_technical_data", "execute_pm_commands"],

      // 共通系コマンド
      "/ask": [], // 自然言語処理、実際の権限は変換後のコマンドで判定
      "/guide": [], // ヘルプ機能、全ユーザー利用可能
      "/export-report": ["export_json", "export_pdf"], // 基本エクスポート権限

      // システム管理系
      "/manage-users": ["manage_users"],
      "/audit-logs": ["view_audit_logs"],
      "/system-config": ["modify_system_config"],
    };

    return commandPermissions[command] || [];
  }

  /**
   * 役職別推奨コマンド一覧を取得
   */
  public getRecommendedCommands(roleName: UserRole): string[] {
    const roleCommands: Record<UserRole, string[]> = {
      executive: [
        "/business-dashboard --profile=executive",
        "/roi-analysis --period=quarterly",
        '/tune "全社戦略の調整"',
        "/export-report --format=pdf --scope=executive",
      ],
      sales_manager: [
        "/sales-dashboard --profile=sales_manager",
        "/battlecard --competitor=all",
        "/customer-analysis --team=all",
        '/tune "営業チーム戦略調整"',
      ],
      sales: [
        "/sales-dashboard --profile=sales",
        "/battlecard --competitor=main",
        "/customer-analysis --assigned-only",
        '/ask "今日の重点顧客は？"',
      ],
      marketing: [
        "/content-impact --days=30",
        "/campaign-optimize --current",
        "/ab-compare --active-tests",
        '/tune "コンテンツ戦略調整"',
      ],
      pm: [
        "/requirement-extract --recent",
        "/tech-debt-analysis --sprint=current",
        "/sprint-optimize --next",
        '/ask "開発進捗の課題は？"',
      ],
      admin: [
        "/audit-logs --recent=24h",
        "/manage-users --status=active",
        "/system-config --health-check",
        "/business-dashboard --profile=admin",
      ],
    };

    return roleCommands[roleName] || [];
  }

  /**
   * 役職定義の妥当性検証
   */
  public validateRole(role: Role): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 必須フィールドのチェック
    if (!role.name) errors.push("Role name is required");
    if (!role.description) errors.push("Role description is required");
    if (!Array.isArray(role.permissions))
      errors.push("Permissions must be an array");
    if (!role.dataScope) errors.push("DataScope is required");

    // データスコープの検証
    if (role.dataScope) {
      if (role.dataScope.timeRangeDays && role.dataScope.timeRangeDays < 1) {
        errors.push("TimeRangeDays must be positive");
      }
      if (typeof role.dataScope.piiMasking !== "boolean") {
        errors.push("PIIMasking must be boolean");
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
