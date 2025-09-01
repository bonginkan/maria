/**
 * RBAC (Role-Based Access Control) Types
 * ビジネス向けCLI用の権限管理システムの型定義
 */

export type UserRole =
  | "executive" // 経営層:全社データ + 戦略調整
  | "sales_manager" // 営業マネージャー:営業部門 + チーム管理
  | "sales" // 営業:営業データ + 顧客情報
  | "marketing" // マーケ:マーケデータ + コンテンツ
  | "pm" // PM:開発データ + 要件管理
  | "admin"; // システム管理者:全権限

export type Permission =
  // データアクセス権限
  | "view_sales_data"
  | "view_marketing_data"
  | "view_executive_data"
  | "view_customer_data"
  | "view_financial_data"
  | "view_technical_data"

  // コマンド実行権限
  | "execute_sales_commands"
  | "execute_marketing_commands"
  | "execute_executive_commands"
  | "execute_pm_commands"

  // システム管理権限
  | "manage_users"
  | "manage_roles"
  | "view_audit_logs"
  | "modify_system_config"

  // 報酬調整権限
  | "tune_sales_rewards"
  | "tune_marketing_rewards"
  | "tune_global_rewards"

  // データエクスポート権限
  | "export_json"
  | "export_pdf"
  | "export_to_slack"
  | "export_to_external";

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  department: string;
  location?: string;
  createdAt: Date;
  lastLoginAt?: Date;
  isActive: boolean;
  metadata?: Record<string, any>;
}

export interface Role {
  name: UserRole;
  description: string;
  permissions: Permission[];
  dataScope: DataScope;
  inheritsFrom?: UserRole[];
}

export interface DataScope {
  // 部門データアクセス制御
  departments: string[] | "all";

  // 顧客データアクセス制御
  customerTiers: ("enterprise" | "mid_market" | "smb")[] | "all";

  // 地域データアクセス制御
  regions: string[] | "all";

  // 時期制限(過去何日まで)
  timeRangeDays?: number;

  // データフィールド制限
  excludeFields?: string[];

  // PII マスク設定
  piiMasking: boolean;
}

export interface AuditLog {
  id: string;
  timestamp: Date;
  user: {
    id: string;
    role: UserRole;
    department: string;
    location?: string;
  };
  action: {
    command: string;
    parameters: Record<string, any>;
    naturalLanguageInput?: string;
    executionTimeMs: number;
  };
  dataAccess: {
    sourcesAccessed: string[];
    customersViewed?: string[];
    recordsReturned: number;
    sensitiveData: boolean;
    piiMasked: boolean;
  };
  result: {
    success: boolean;
    chartsGenerated?: number;
    exportFormat?: string;
    sharedTo?: string[];
    errorMessage?: string;
  };
  compliance: {
    gdprApplicable: boolean;
    retentionDays: number;
    anonymizeAfterDays: number;
  };
  risk?: {
    level: "low" | "medium" | "high";
    reasons: string[];
  };
}

export interface AuthContext {
  user: User;
  role: Role;
  session: {
    id: string;
    startedAt: Date;
    lastActivityAt: Date;
    ipAddress?: string;
    userAgent?: string;
  };
  permissions: Permission[];
  dataScope: DataScope;
}

export interface AccessRequest {
  command: string;
  parameters: Record<string, any>;
  requestedDataSources: string[];
  requestedPermissions: Permission[];
}

export interface AccessDecision {
  granted: boolean;
  reason?: string;
  allowedDataSources: string[];
  deniedDataSources: string[];
  allowedPermissions: Permission[];
  deniedPermissions: Permission[];
  dataFilters: Record<string, any>;
  piiMasking: boolean;
}
