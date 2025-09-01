/**
 * Authentication Service - 認証管理サービス
 * ユーザー認証、セッション管理、トークン管理を提供
 */

import * as crypto from "crypto";
import * as fs from "fs/promises";
import * as path from "path";
import { User, UserRole, AuthContext } from "./types";
import { RoleManager } from "./RoleManager";
import { AuditLogger } from "./AuditLogger";
import { Logger } from "../../utils/logger";

export interface SessionData {
  id: string;
  userId: string;
  startedAt: Date;
  lastActivityAt: Date;
  ipAddress?: string;
  userAgent?: string;
  isActive: boolean;
  expiresAt: Date;
}

export interface AuthenticationResult {
  success: boolean;
  user?: User;
  session?: SessionData;
  authContext?: AuthContext;
  errorMessage?: string;
  requiresAdditionalAuth?: boolean;
}

export class AuthenticationService {
  private static instance: AuthenticationService;
  private users: Map<string, User> = new Map();
  private sessions: Map<string, SessionData> = new Map();
  private roleManager: RoleManager;
  private auditLogger: AuditLogger;
  private sessionTimeout = 8 * 60 * 60 * 1000; // 8時間
  private dataDirectory: string;

  private constructor() {
    this.roleManager = RoleManager.getInstance();
    this.auditLogger = AuditLogger.getInstance();
    this.dataDirectory = path.join(process.cwd(), ".maria", "auth");
    this.initializeAuthSystem();
  }

  public static getInstance(): AuthenticationService {
    if (!AuthenticationService.instance) {
      AuthenticationService.instance = new AuthenticationService();
    }
    return AuthenticationService.instance;
  }

  private async initializeAuthSystem(): Promise<void> {
    try {
      await fs.mkdir(this.dataDirectory, { recursive: true });
      await this.loadUsers();
      await this.initializeDemoUsers();

      // セッション清理の定期実行
      setInterval(() => this.cleanupExpiredSessions(), 60 * 60 * 1000); // 1時間毎

      Logger.info("Authentication system initialized", {
        userCount: this.users.size,
        sessionCount: this.sessions.size,
      });
    } catch (error) {
      Logger.error("Failed to initialize authentication system", error);
    }
  }

  /**
   * ユーザー認証(パスワード認証)
   */
  public async authenticateUser(
    username: string,
    password: string,
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<AuthenticationResult> {
    const startTime = Date.now();

    try {
      // ユーザー検索
      const user = this.findUserByUsername(username);
      if (!user) {
        await this.auditLogger.logAuthenticationEvent(
          {
            id: "unknown",
            username,
            email: "",
            role: "sales",
            department: "unknown",
            createdAt: new Date(),
            isActive: false,
          },
          "failed_login",
          { ...metadata, errorMessage: "User not found" },
        );

        return {
          success: false,
          errorMessage: "Invalid credentials",
        };
      }

      // アクティブユーザーチェック
      if (!user.isActive) {
        await this.auditLogger.logAuthenticationEvent(user, "failed_login", {
          ...metadata,
          errorMessage: "Account inactive",
        });

        return {
          success: false,
          errorMessage: "Account is inactive",
        };
      }

      // パスワード検証(実際の実装では暗号化されたパスワードと比較)
      const isValidPassword = await this.verifyPassword(username, password);
      if (!isValidPassword) {
        await this.auditLogger.logAuthenticationEvent(user, "failed_login", {
          ...metadata,
          errorMessage: "Invalid password",
        });

        return {
          success: false,
          errorMessage: "Invalid credentials",
        };
      }

      // セッション作成
      const session = await this.createSession(user, metadata);

      // 認証コンテキスト作成
      const authContext = await this.createAuthContext(user, session);

      // ユーザーの最終ログイン時間更新
      user.lastLoginAt = new Date();
      await this.saveUser(user);

      // 成功ログ記録
      await this.auditLogger.logAuthenticationEvent(user, "login", {
        ...metadata,
        sessionId: session.id,
      });

      Logger.info("User authentication successful", {
        userId: user.id,
        role: user.role,
        department: user.department,
        sessionId: session.id,
        executionTimeMs: Date.now() - startTime,
      });

      return {
        success: true,
        user,
        session,
        authContext,
      };
    } catch (error) {
      Logger.error("Authentication failed", error, { username });

      return {
        success: false,
        errorMessage: "Authentication system error",
      };
    }
  }

  /**
   * セッション認証(既存セッションの検証)
   */
  public async authenticateSession(
    sessionId: string,
  ): Promise<AuthenticationResult> {
    try {
      const session = this.sessions.get(sessionId);

      if (!session || !session.isActive) {
        return {
          success: false,
          errorMessage: "Invalid session",
        };
      }

      // セッション有効期限チェック
      if (Date.now() > session.expiresAt.getTime()) {
        await this.invalidateSession(sessionId);
        return {
          success: false,
          errorMessage: "Session expired",
        };
      }

      // ユーザー情報取得
      const user = this.users.get(session.userId);
      if (!user || !user.isActive) {
        await this.invalidateSession(sessionId);
        return {
          success: false,
          errorMessage: "User account invalid",
        };
      }

      // セッション活動時間更新
      session.lastActivityAt = new Date();
      this.sessions.set(sessionId, session);

      // 認証コンテキスト作成
      const authContext = await this.createAuthContext(user, session);

      return {
        success: true,
        user,
        session,
        authContext,
      };
    } catch (error) {
      Logger.error("Session authentication failed", error, { sessionId });
      return {
        success: false,
        errorMessage: "Session authentication error",
      };
    }
  }

  /**
   * ユーザーログアウト
   */
  public async logout(sessionId: string): Promise<boolean> {
    try {
      const session = this.sessions.get(sessionId);
      if (session) {
        const user = this.users.get(session.userId);
        if (user) {
          await this.auditLogger.logAuthenticationEvent(user, "logout", {
            sessionId: session.id,
          });
        }
      }

      return await this.invalidateSession(sessionId);
    } catch (error) {
      Logger.error("Logout failed", error, { sessionId });
      return false;
    }
  }

  /**
   * 認証コンテキスト作成
   */
  private async createAuthContext(
    user: User,
    session: SessionData,
  ): Promise<AuthContext> {
    const role = this.roleManager.getRole(user.role);
    if (!role) {
      throw new Error(`Role ${user.role} not found`);
    }

    return {
      user,
      role,
      session: {
        id: session.id,
        startedAt: session.startedAt,
        lastActivityAt: session.lastActivityAt,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
      },
      permissions: role.permissions,
      dataScope: role.dataScope,
    };
  }

  /**
   * セッション作成
   */
  private async createSession(
    user: User,
    metadata?: { ipAddress?: string; userAgent?: string },
  ): Promise<SessionData> {
    const sessionId = this.generateSessionId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.sessionTimeout);

    const session: SessionData = {
      id: sessionId,
      userId: user.id,
      startedAt: now,
      lastActivityAt: now,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      isActive: true,
      expiresAt,
    };

    this.sessions.set(sessionId, session);

    // セッション情報をファイルに保存(永続化)
    await this.saveSession(session);

    return session;
  }

  /**
   * セッション無効化
   */
  private async invalidateSession(sessionId: string): Promise<boolean> {
    try {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.isActive = false;
        this.sessions.delete(sessionId);

        // ファイルからも削除
        await this.deleteSession(sessionId);

        Logger.info("Session invalidated", { sessionId });
        return true;
      }
      return false;
    } catch (error) {
      Logger.error("Failed to invalidate session", error, { sessionId });
      return false;
    }
  }

  /**
   * 期限切れセッションのクリーンアップ
   */
  private async cleanupExpiredSessions(): Promise<void> {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions) {
      if (now > session.expiresAt.getTime()) {
        const user = this.users.get(session.userId);
        if (user) {
          await this.auditLogger.logAuthenticationEvent(
            user,
            "session_timeout",
            {
              sessionId: session.id,
            },
          );
        }

        await this.invalidateSession(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      Logger.info("Expired sessions cleaned up", { cleanedCount });
    }
  }

  // ユーザー管理メソッド群

  /**
   * 新規ユーザー作成
   */
  public async createUser(userData: {
    username: string;
    email: string;
    role: UserRole;
    department: string;
    location?: string;
    password: string; // 実際の実装では暗号化必須
  }): Promise<User> {
    const userId = this.generateUserId();
    const user: User = {
      id: userId,
      username: userData.username,
      email: userData.email,
      role: userData.role,
      department: userData.department,
      location: userData.location,
      createdAt: new Date(),
      isActive: true,
      metadata: {
        passwordHash: await this.hashPassword(userData.password),
        createdBy: "system",
      },
    };

    this.users.set(userId, user);
    await this.saveUser(user);

    Logger.info("User created", {
      userId,
      username: userData.username,
      role: userData.role,
      department: userData.department,
    });

    return user;
  }

  /**
   * デモユーザーの初期化
   */
  private async initializeDemoUsers(): Promise<void> {
    const demoUsers = [
      {
        username: "exec_demo",
        email: "executive@maria-demo.com",
        role: "executive" as UserRole,
        department: "executive",
        password: "demo123",
      },
      {
        username: "sales_mgr_demo",
        email: "sales.manager@maria-demo.com",
        role: "sales_manager" as UserRole,
        department: "sales",
        password: "demo123",
      },
      {
        username: "sales_demo",
        email: "sales@maria-demo.com",
        role: "sales" as UserRole,
        department: "sales",
        password: "demo123",
      },
      {
        username: "marketing_demo",
        email: "marketing@maria-demo.com",
        role: "marketing" as UserRole,
        department: "marketing",
        password: "demo123",
      },
      {
        username: "pm_demo",
        email: "pm@maria-demo.com",
        role: "pm" as UserRole,
        department: "engineering",
        password: "demo123",
      },
    ];

    for (const userData of demoUsers) {
      if (!this.findUserByUsername(userData.username)) {
        await this.createUser(userData);
      }
    }
  }

  // ヘルパーメソッド群

  private findUserByUsername(username: string): User | undefined {
    for (const user of this.users.values()) {
      if (user.username === username) {
        return user;
      }
    }
    return undefined;
  }

  private async verifyPassword(
    username: string,
    password: string,
  ): Promise<boolean> {
    const user = this.findUserByUsername(username);
    if (!user || !user.metadata?.passwordHash) return false;

    // 実際の実装ではbcrypt等でハッシュ比較
    const providedHash = await this.hashPassword(password);
    return user.metadata.passwordHash === providedHash;
  }

  private async hashPassword(password: string): Promise<string> {
    // 実際の実装では bcrypt を使用すべき
    return crypto
      .createHash("sha256")
      .update(password + "maria_salt")
      .digest("hex");
  }

  private generateSessionId(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  private generateUserId(): string {
    return `user_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
  }

  // 永続化メソッド群

  private async loadUsers(): Promise<void> {
    try {
      const usersFile = path.join(this.dataDirectory, "users.json");
      const content = await fs.readFile(usersFile, "utf8");
      const usersData = JSON.parse(content);

      for (const userData of usersData) {
        const user: User = {
          ...userData,
          createdAt: new Date(userData.createdAt),
          lastLoginAt: userData.lastLoginAt
            ? new Date(userData.lastLoginAt)
            : undefined,
        };
        this.users.set(user.id, user);
      }

      Logger.info("Users loaded from storage", { userCount: this.users.size });
    } catch (error) {
      Logger.info("No existing users file found, starting fresh");
    }
  }

  private async saveUser(user: User): Promise<void> {
    try {
      const usersFile = path.join(this.dataDirectory, "users.json");
      const usersArray = Array.from(this.users.values());
      await fs.writeFile(
        usersFile,
        JSON.stringify(usersArray, null, 2),
        "utf8",
      );
    } catch (error) {
      Logger.error("Failed to save user", error, { userId: user.id });
    }
  }

  private async saveSession(session: SessionData): Promise<void> {
    try {
      const sessionFile = path.join(
        this.dataDirectory,
        `session_${session.id}.json`,
      );
      await fs.writeFile(sessionFile, JSON.stringify(session, null, 2), "utf8");
    } catch (error) {
      Logger.error("Failed to save session", error, { sessionId: session.id });
    }
  }

  private async deleteSession(sessionId: string): Promise<void> {
    try {
      const sessionFile = path.join(
        this.dataDirectory,
        `session_${sessionId}.json`,
      );
      await fs.unlink(sessionFile);
    } catch (error) {
      // ファイルが存在しない場合は無視
    }
  }

  /**
   * 現在のアクティブユーザー統計
   */
  public getActiveUserStats(): {
    totalUsers: number;
    activeUsers: number;
    activeSessions: number;
    usersByRole: Record<UserRole, number>;
    usersByDepartment: Record<string, number>;
  } {
    const stats = {
      totalUsers: this.users.size,
      activeUsers: 0,
      activeSessions: this.sessions.size,
      usersByRole: {} as Record<UserRole, number>,
      usersByDepartment: {} as Record<string, number>,
    };

    for (const user of this.users.values()) {
      if (user.isActive) {
        stats.activeUsers++;
      }

      stats.usersByRole[user.role] = (stats.usersByRole[user.role] || 0) + 1;
      stats.usersByDepartment[user.department] =
        (stats.usersByDepartment[user.department] || 0) + 1;
    }

    return stats;
  }
}
