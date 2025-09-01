/**
 * Authorization Service - 認可・権限制御サービス
 * コマンド実行前の権限チェックとデータアクセス制御を行う
 */

import {
  User,
  UserRole,
  Permission,
  DataScope,
  AuthContext,
  AccessRequest,
  AccessDecision,
} from "./types";
import { RoleManager } from "./RoleManager";
import { Logger } from "../../utils/logger";

export class AuthorizationService {
  private static instance: AuthorizationService;
  private roleManager: RoleManager;

  private constructor() {
    this.roleManager = RoleManager.getInstance();
  }

  public static getInstance(): AuthorizationService {
    if (!AuthorizationService.instance) {
      AuthorizationService.instance = new AuthorizationService();
    }
    return AuthorizationService.instance;
  }

  /**
   * コマンド実行権限の検証
   */
  public async authorizeCommand(
    authContext: AuthContext,
    accessRequest: AccessRequest,
  ): Promise<AccessDecision> {
    const startTime = Date.now();

    try {
      // 1. コマンドに必要な権限を取得
      const requiredPermissions =
        this.roleManager.getCommandRequiredPermissions(accessRequest.command);

      // 2. 基本権限チェック
      const permissionCheck = this.checkPermissions(
        authContext.role,
        requiredPermissions.concat(accessRequest.requestedPermissions),
      );

      if (!permissionCheck.granted) {
        return {
          granted: false,
          reason: `Insufficient permissions: ${permissionCheck.missingPermissions.join(", ")}`,
          allowedDataSources: [],
          deniedDataSources: accessRequest.requestedDataSources,
          allowedPermissions: permissionCheck.grantedPermissions,
          deniedPermissions: permissionCheck.missingPermissions,
          dataFilters: {},
          piiMasking: true,
        };
      }

      // 3. データソースアクセス制御
      const dataAccessDecision = this.checkDataSourceAccess(
        authContext.dataScope,
        accessRequest.requestedDataSources,
        authContext.user.department,
      );

      // 4. データフィルター生成
      const dataFilters = this.generateDataFilters(
        authContext.dataScope,
        authContext.user,
      );

      // 5. リスク評価
      const riskAssessment = this.assessRisk(accessRequest, authContext);

      const decision: AccessDecision = {
        granted: true,
        allowedDataSources: dataAccessDecision.allowed,
        deniedDataSources: dataAccessDecision.denied,
        allowedPermissions: permissionCheck.grantedPermissions,
        deniedPermissions: [],
        dataFilters,
        piiMasking: authContext.dataScope.piiMasking,
      };

      // 高リスク操作の場合は追加確認
      if (riskAssessment.level === "high") {
        decision.reason = `High-risk operation detected: ${riskAssessment.reasons.join(", ")}. Additional confirmation may be required.`;
      }

      Logger.info("Authorization decision completed", {
        userId: authContext.user.id,
        command: accessRequest.command,
        granted: decision.granted,
        executionTimeMs: Date.now() - startTime,
        riskLevel: riskAssessment.level,
      });

      return decision;
    } catch (error) {
      Logger.error("Authorization failed", error, {
        userId: authContext.user.id,
        command: accessRequest.command,
      });

      return {
        granted: false,
        reason: "Authorization system error",
        allowedDataSources: [],
        deniedDataSources: accessRequest.requestedDataSources,
        allowedPermissions: [],
        deniedPermissions: accessRequest.requestedPermissions,
        dataFilters: {},
        piiMasking: true,
      };
    }
  }

  /**
   * 権限チェック
   */
  private checkPermissions(
    role: any,
    requiredPermissions: Permission[],
  ): {
    granted: boolean;
    grantedPermissions: Permission[];
    missingPermissions: Permission[];
  } {
    const grantedPermissions: Permission[] = [];
    const missingPermissions: Permission[] = [];

    for (const permission of requiredPermissions) {
      if (role.permissions.includes(permission)) {
        grantedPermissions.push(permission);
      } else {
        missingPermissions.push(permission);
      }
    }

    return {
      granted: missingPermissions.length === 0,
      grantedPermissions,
      missingPermissions,
    };
  }

  /**
   * データソースアクセス制御
   */
  private checkDataSourceAccess(
    dataScope: DataScope,
    requestedSources: string[],
    userDepartment: string,
  ): { allowed: string[]; denied: string[] } {
    const allowed: string[] = [];
    const denied: string[] = [];

    for (const source of requestedSources) {
      if (this.isDataSourceAllowed(source, dataScope, userDepartment)) {
        allowed.push(source);
      } else {
        denied.push(source);
      }
    }

    return { allowed, denied };
  }

  /**
   * データソースアクセス可能性チェック
   */
  private isDataSourceAllowed(
    source: string,
    dataScope: DataScope,
    userDepartment: string,
  ): boolean {
    // 部門制限チェック
    if (dataScope.departments !== "all") {
      const sourcePattern = this.getDataSourceDepartment(source);
      if (sourcePattern && !dataScope.departments.includes(sourcePattern)) {
        return false;
      }
    }

    // 地域制限チェック(ユーザーの地域情報と照合)
    if (dataScope.regions !== "all" && dataScope.regions.length > 0) {
      const sourceRegion = this.getDataSourceRegion(source);
      if (sourceRegion && !dataScope.regions.includes(sourceRegion)) {
        return false;
      }
    }

    // 顧客ティア制限チェック
    if (dataScope.customerTiers !== "all" && source.includes("customer")) {
      const customerTier = this.getCustomerTierFromSource(source);
      if (customerTier && !dataScope.customerTiers.includes(customerTier)) {
        return false;
      }
    }

    return true;
  }

  /**
   * データフィルター生成
   */
  private generateDataFilters(
    dataScope: DataScope,
    user: User,
  ): Record<string, any> {
    const filters: Record<string, any> = {};

    // 時期制限フィルター
    if (dataScope.timeRangeDays) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - dataScope.timeRangeDays);
      filters.dateRange = {
        from: cutoffDate.toISOString(),
        to: new Date().toISOString(),
      };
    }

    // 部門フィルター
    if (dataScope.departments !== "all") {
      filters.departments = dataScope.departments;
    }

    // 地域フィルター
    if (dataScope.regions !== "all" && dataScope.regions.length > 0) {
      filters.regions = dataScope.regions;
    }

    // 顧客ティアフィルター
    if (dataScope.customerTiers !== "all") {
      filters.customerTiers = dataScope.customerTiers;
    }

    // 除外フィールド
    if (dataScope.excludeFields && dataScope.excludeFields.length > 0) {
      filters.excludeFields = dataScope.excludeFields;
    }

    // PII マスクフィルター
    if (dataScope.piiMasking) {
      filters.piiMasking = true;
      filters.maskFields = [
        "customer_email",
        "customer_phone",
        "personal_notes",
        "credit_card_info",
        "social_security_number",
      ];
    }

    // ユーザー固有制限(営業担当の場合、自分の顧客のみ等)
    if (user.role === "sales" && !user.role.includes("manager")) {
      filters.assignedOnly = true;
      filters.assignedUserId = user.id;
    }

    return filters;
  }

  /**
   * リスク評価
   */
  private assessRisk(
    accessRequest: AccessRequest,
    authContext: AuthContext,
  ): { level: "low" | "medium" | "high"; reasons: string[] } {
    const reasons: string[] = [];
    let riskLevel: "low" | "medium" | "high" = "low";

    // 大量データアクセスの検出
    if (accessRequest.requestedDataSources.length > 5) {
      reasons.push("Multiple data sources requested");
      riskLevel = "medium";
    }

    // 機密データアクセスの検出
    const sensitiveDataSources = accessRequest.requestedDataSources.filter(
      (source) =>
        source.includes("financial") ||
        source.includes("executive") ||
        source.includes("audit"),
    );
    if (sensitiveDataSources.length > 0) {
      reasons.push("Sensitive data access requested");
      riskLevel = "high";
    }

    // エクスポート権限の検出
    const exportPermissions = accessRequest.requestedPermissions.filter(
      (perm) => perm.includes("export"),
    );
    if (exportPermissions.length > 0) {
      reasons.push("Data export requested");
      if (riskLevel === "low") riskLevel = "medium";
    }

    // 外部連携の検出
    if (accessRequest.requestedPermissions.includes("export_to_external")) {
      reasons.push("External system access requested");
      riskLevel = "high";
    }

    // グローバル調整権限の検出
    if (accessRequest.requestedPermissions.includes("tune_global_rewards")) {
      reasons.push("Global system tuning requested");
      riskLevel = "high";
    }

    // 時間帯による異常検出(営業時間外)
    const currentHour = new Date().getHours();
    if (currentHour < 7 || currentHour > 20) {
      reasons.push("After-hours access");
      if (riskLevel === "low") riskLevel = "medium";
    }

    // ユーザーの最終ログインからの経過時間
    const lastLogin = authContext.user.lastLoginAt;
    if (
      lastLogin &&
      Date.now() - lastLogin.getTime() > 30 * 24 * 60 * 60 * 1000
    ) {
      reasons.push("Long-term inactive user");
      riskLevel = "high";
    }

    return { level: riskLevel, reasons };
  }

  // ヘルパーメソッド群

  private getDataSourceDepartment(source: string): string | null {
    if (source.includes("sales") || source.includes("crm")) return "sales";
    if (source.includes("marketing") || source.includes("campaign"))
      return "marketing";
    if (source.includes("finance") || source.includes("accounting"))
      return "finance";
    if (source.includes("engineering") || source.includes("github"))
      return "engineering";
    return null;
  }

  private getDataSourceRegion(source: string): string | null {
    // データソース名から地域情報を抽出(実装は要カスタマイズ)
    if (source.includes("tokyo") || source.includes("jp")) return "tokyo";
    if (source.includes("osaka")) return "osaka";
    if (source.includes("us") || source.includes("america")) return "us";
    return null;
  }

  private getCustomerTierFromSource(
    source: string,
  ): "enterprise" | "mid_market" | "smb" | null {
    if (source.includes("enterprise")) return "enterprise";
    if (source.includes("mid_market")) return "mid_market";
    if (source.includes("smb") || source.includes("small")) return "smb";
    return null;
  }

  /**
   * 権限昇格の検出
   */
  public detectPrivilegeEscalation(
    authContext: AuthContext,
    requestedCommand: string,
  ): boolean {
    const userRole = authContext.user.role;
    const commandPermissions =
      this.roleManager.getCommandRequiredPermissions(requestedCommand);

    // ユーザーの現在の権限を超えた操作の検出
    const hasAllPermissions = this.roleManager.hasAllPermissions(
      userRole,
      commandPermissions,
    );

    if (!hasAllPermissions) {
      Logger.warn("Potential privilege escalation attempt detected", {
        userId: authContext.user.id,
        userRole,
        command: requestedCommand,
        requiredPermissions: commandPermissions,
      });
      return true;
    }

    return false;
  }

  /**
   * データアクセスパターンの異常検出
   */
  public detectAnomalousDataAccess(
    authContext: AuthContext,
    requestedDataSources: string[],
  ): { isAnomalous: boolean; reasons: string[] } {
    const reasons: string[] = [];

    // 通常アクセスパターンと異なる大量データ要求
    if (requestedDataSources.length > 10) {
      reasons.push("Unusually high number of data sources requested");
    }

    // 部門を超えたデータアクセス
    const userDept = authContext.user.department;
    const crossDeptSources = requestedDataSources.filter((source) => {
      const sourceDept = this.getDataSourceDepartment(source);
      return sourceDept && sourceDept !== userDept;
    });

    if (
      crossDeptSources.length > 0 &&
      authContext.user.role !== "executive" &&
      authContext.user.role !== "admin"
    ) {
      reasons.push(
        `Cross-department data access: ${crossDeptSources.join(", ")}`,
      );
    }

    return {
      isAnomalous: reasons.length > 0,
      reasons,
    };
  }
}
