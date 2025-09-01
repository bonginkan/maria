/**
 * RBAC (Role-Based Access Control) Services
 * ビジネス向けCLI用の権限管理システム
 */

export * from "./types";
export { RoleManager } from "./RoleManager";
export { AuthenticationService } from "./AuthenticationService";
export { AuthorizationService } from "./AuthorizationService";
export { AuditLogger } from "./AuditLogger";

// 便利な初期化ヘルパー
export class RBACManager {
  private static instance: RBACManager;

  public readonly roleManager: RoleManager;
  public readonly authService: AuthenticationService;
  public readonly authzService: AuthorizationService;
  public readonly auditLogger: AuditLogger;

  private constructor() {
    this.roleManager = RoleManager.getInstance();
    this.authService = AuthenticationService.getInstance();
    this.authzService = AuthorizationService.getInstance();
    this.auditLogger = AuditLogger.getInstance();
  }

  public static getInstance(): RBACManager {
    if (!RBACManager.instance) {
      RBACManager.instance = new RBACManager();
    }
    return RBACManager.instance;
  }

  /**
   * RBAC システム全体の初期化
   */
  public async initialize(): Promise<void> {
    // 必要に応じて追加の初期化処理
    // 現在は各サービスが独立して初期化される
  }

  /**
   * システム統計情報の取得
   */
  public async getSystemStats() {
    const authStats = this.authService.getActiveUserStats();

    return {
      authentication: authStats,
      roles: {
        totalRoles: this.roleManager.getAllRoles().length,
        roleNames: this.roleManager.getAllRoles().map((r) => r.name),
      },
      audit: {
        // 監査ログ統計は必要に応じて追加
        enabled: true,
      },
    };
  }
}
