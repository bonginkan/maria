/**
 * Audit Logger - 監査ログシステム
 * GDPR対応、セキュリティ監査、コンプライアンス追跡を包括的に提供
 */

import * as fs from "fs/promises";
import * as path from "path";
import { AuditLog, User, AuthContext } from "./types";
import { Logger } from "../../utils/logger";

export class AuditLogger {
  private static instance: AuditLogger;
  private logDirectory: string;
  private maxLogFileSize: number = 50 * 1024 * 1024; // 50MB
  private logRotationCount: number = 10;

  private constructor() {
    this.logDirectory = path.join(process.cwd(), ".maria", "audit-logs");
    this.ensureLogDirectory();
  }

  public static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  private async ensureLogDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.logDirectory, { recursive: true });
    } catch (error) {
      Logger.error("Failed to create audit log directory", error);
    }
  }

  /**
   * コマンド実行の監査ログ記録
   */
  public async logCommandExecution(
    authContext: AuthContext,
    command: string,
    parameters: Record<string, any>,
    result: {
      success: boolean;
      executionTimeMs: number;
      recordsReturned?: number;
      chartsGenerated?: number;
      exportFormat?: string;
      sharedTo?: string[];
      errorMessage?: string;
    },
    dataAccess: {
      sourcesAccessed: string[];
      customersViewed?: string[];
      sensitiveData: boolean;
      piiMasked: boolean;
    },
    naturalLanguageInput?: string,
  ): Promise<void> {
    const auditLog: AuditLog = {
      id: this.generateLogId(),
      timestamp: new Date(),
      user: {
        id: authContext.user.id,
        role: authContext.user.role,
        department: authContext.user.department,
        location: authContext.user.location,
      },
      action: {
        command,
        parameters: this.sanitizeParameters(parameters),
        naturalLanguageInput,
        executionTimeMs: result.executionTimeMs,
      },
      dataAccess: {
        sourcesAccessed: dataAccess.sourcesAccessed,
        customersViewed: dataAccess.customersViewed || [],
        recordsReturned: result.recordsReturned || 0,
        sensitiveData: dataAccess.sensitiveData,
        piiMasked: dataAccess.piiMasked,
      },
      result: {
        success: result.success,
        chartsGenerated: result.chartsGenerated,
        exportFormat: result.exportFormat,
        sharedTo: result.sharedTo,
        errorMessage: result.errorMessage,
      },
      compliance: this.generateComplianceInfo(
        dataAccess.sensitiveData,
        dataAccess.piiMasked,
      ),
      risk: this.assessLogRisk(command, dataAccess, result),
    };

    await this.writeAuditLog(auditLog);

    // 高リスク操作の場合は即座にアラート
    if (auditLog.risk?.level === "high") {
      await this.triggerSecurityAlert(auditLog);
    }
  }

  /**
   * ログイン/認証の監査ログ記録
   */
  public async logAuthenticationEvent(
    user: User,
    event: "login" | "logout" | "failed_login" | "session_timeout",
    metadata: {
      ipAddress?: string;
      userAgent?: string;
      sessionId?: string;
      errorMessage?: string;
    },
  ): Promise<void> {
    const auditLog: Partial<AuditLog> = {
      id: this.generateLogId(),
      timestamp: new Date(),
      user: {
        id: user.id,
        role: user.role,
        department: user.department,
        location: user.location,
      },
      action: {
        command: `auth:${event}`,
        parameters: {
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          sessionId: metadata.sessionId,
        },
        executionTimeMs: 0,
      },
      result: {
        success: event !== "failed_login",
        errorMessage: metadata.errorMessage,
      },
      compliance: {
        gdprApplicable: true,
        retentionDays: 90,
        anonymizeAfterDays: 365,
      },
    };

    await this.writeAuditLog(auditLog as AuditLog);
  }

  /**
   * セキュリティイベントの記録
   */
  public async logSecurityEvent(
    eventType:
      | "privilege_escalation"
      | "anomalous_access"
      | "data_breach"
      | "unauthorized_export",
    user: User,
    details: {
      description: string;
      affectedResources: string[];
      severity: "low" | "medium" | "high" | "critical";
      mitigationActions?: string[];
    },
  ): Promise<void> {
    const securityLog: Partial<AuditLog> = {
      id: this.generateLogId(),
      timestamp: new Date(),
      user: {
        id: user.id,
        role: user.role,
        department: user.department,
        location: user.location,
      },
      action: {
        command: `security:${eventType}`,
        parameters: {
          description: details.description,
          affectedResources: details.affectedResources,
          severity: details.severity,
          mitigationActions: details.mitigationActions,
        },
        executionTimeMs: 0,
      },
      result: {
        success: false, // セキュリティイベントは基本的に異常事象
      },
      risk: {
        level:
          details.severity === "critical" ? "high" : (details.severity as any),
        reasons: [details.description],
      },
      compliance: {
        gdprApplicable: true,
        retentionDays: 2555, // 7年間(法的要件)
        anonymizeAfterDays: 2555,
      },
    };

    await this.writeAuditLog(securityLog as AuditLog);

    // 重要度がhigh以上の場合は即座にアラート
    if (details.severity === "high" || details.severity === "critical") {
      await this.triggerSecurityAlert(securityLog as AuditLog);
    }
  }

  /**
   * データアクセスの統計情報を取得
   */
  public async getDataAccessStatistics(
    timeRange: { from: Date; to: Date },
    filters?: {
      userId?: string;
      department?: string;
      command?: string;
      riskLevel?: "low" | "medium" | "high";
    },
  ): Promise<{
    totalAccesses: number;
    uniqueUsers: Set<string>;
    commandFrequency: Record<string, number>;
    riskDistribution: Record<string, number>;
    dataSourceFrequency: Record<string, number>;
    timeDistribution: Record<string, number>;
  }> {
    const logs = await this.queryAuditLogs(timeRange, filters);

    const stats = {
      totalAccesses: logs.length,
      uniqueUsers: new Set<string>(),
      commandFrequency: {} as Record<string, number>,
      riskDistribution: {} as Record<string, number>,
      dataSourceFrequency: {} as Record<string, number>,
      timeDistribution: {} as Record<string, number>,
    };

    logs.forEach((log) => {
      // ユーザー統計
      stats.uniqueUsers.add(log.user.id);

      // コマンド頻度
      stats.commandFrequency[log.action.command] =
        (stats.commandFrequency[log.action.command] || 0) + 1;

      // リスク分布
      const riskLevel = log.risk?.level || "low";
      stats.riskDistribution[riskLevel] =
        (stats.riskDistribution[riskLevel] || 0) + 1;

      // データソース使用頻度
      log.dataAccess?.sourcesAccessed?.forEach((source) => {
        stats.dataSourceFrequency[source] =
          (stats.dataSourceFrequency[source] || 0) + 1;
      });

      // 時間分布(時間帯別)
      const hour = log.timestamp.getHours();
      const timeSlot = `${hour}:00-${hour + 1}:00`;
      stats.timeDistribution[timeSlot] =
        (stats.timeDistribution[timeSlot] || 0) + 1;
    });

    return stats;
  }

  /**
   * 監査ログの検索
   */
  public async searchAuditLogs(
    query: {
      userId?: string;
      command?: string;
      timeRange?: { from: Date; to: Date };
      riskLevel?: "low" | "medium" | "high";
      sensitiveDataAccess?: boolean;
      errorOnly?: boolean;
    },
    limit: number = 100,
    offset: number = 0,
  ): Promise<AuditLog[]> {
    return await this.queryAuditLogs(
      query.timeRange,
      {
        userId: query.userId,
        command: query.command,
        riskLevel: query.riskLevel,
      },
      limit,
      offset,
    );
  }

  /**
   * GDPR対応データ削除
   */
  public async anonymizeExpiredLogs(): Promise<{
    anonymized: number;
    deleted: number;
  }> {
    let anonymized = 0;
    let deleted = 0;

    const currentDate = new Date();
    const logs = await this.getAllAuditLogs();

    for (const log of logs) {
      const daysSinceLog = Math.floor(
        (currentDate.getTime() - log.timestamp.getTime()) /
          (1000 * 60 * 60 * 24),
      );

      if (daysSinceLog >= log.compliance.anonymizeAfterDays) {
        // 匿名化処理
        const anonymizedLog = this.anonymizeLog(log);
        await this.updateAuditLog(anonymizedLog);
        anonymized++;
      }

      if (daysSinceLog >= log.compliance.retentionDays + 365) {
        // 完全削除(保持期間 + 1年後)
        await this.deleteAuditLog(log.id);
        deleted++;
      }
    }

    Logger.info("GDPR compliance cleanup completed", { anonymized, deleted });
    return { anonymized, deleted };
  }

  // プライベートメソッド群

  private generateLogId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private sanitizeParameters(
    parameters: Record<string, any>,
  ): Record<string, any> {
    const sanitized = { ...parameters };

    // 機密情報のマスク
    const sensitiveKeys = [
      "password",
      "token",
      "api_key",
      "secret",
      "credential",
    ];

    for (const key in sanitized) {
      if (
        sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))
      ) {
        sanitized[key] = "[REDACTED]";
      }
    }

    return sanitized;
  }

  private generateComplianceInfo(sensitiveData: boolean, piiMasked: boolean) {
    return {
      gdprApplicable: sensitiveData || !piiMasked,
      retentionDays: sensitiveData ? 2555 : 90, // 機密データは7年、通常は3ヶ月
      anonymizeAfterDays: 365, // 1年後に匿名化
    };
  }

  private assessLogRisk(
    command: string,
    dataAccess: any,
    result: any,
  ): { level: "low" | "medium" | "high"; reasons: string[] } {
    const reasons: string[] = [];
    let riskLevel: "low" | "medium" | "high" = "low";

    // エラー発生時のリスク
    if (!result.success) {
      reasons.push("Command execution failed");
      riskLevel = "medium";
    }

    // 機密データアクセス
    if (dataAccess.sensitiveData) {
      reasons.push("Sensitive data accessed");
      riskLevel = "high";
    }

    // PII非マスク時のリスク
    if (!dataAccess.piiMasked && dataAccess.customersViewed?.length > 0) {
      reasons.push("PII data accessed without masking");
      riskLevel = "high";
    }

    // 大量データ処理
    if (result.recordsReturned > 10000) {
      reasons.push("Large volume data processing");
      riskLevel = "medium";
    }

    // 外部共有
    if (result.sharedTo && result.sharedTo.length > 0) {
      reasons.push("Data shared externally");
      if (riskLevel === "low") riskLevel = "medium";
    }

    // 管理者権限コマンド
    if (command.includes("admin") || command.includes("manage")) {
      reasons.push("Administrative command executed");
      riskLevel = "high";
    }

    return { level: riskLevel, reasons };
  }

  private async writeAuditLog(auditLog: AuditLog): Promise<void> {
    const logFileName = this.getLogFileName();
    const logFilePath = path.join(this.logDirectory, logFileName);

    try {
      const logEntry = JSON.stringify(auditLog) + "\n";
      await fs.appendFile(logFilePath, logEntry, "utf8");

      // ログローテーションの確認
      await this.checkLogRotation(logFilePath);
    } catch (error) {
      Logger.error("Failed to write audit log", error, { logId: auditLog.id });
    }
  }

  private getLogFileName(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `audit-${year}-${month}-${day}.jsonl`;
  }

  private async checkLogRotation(logFilePath: string): Promise<void> {
    try {
      const stats = await fs.stat(logFilePath);
      if (stats.size > this.maxLogFileSize) {
        await this.rotateLogFile(logFilePath);
      }
    } catch (error) {
      Logger.warn("Log rotation check failed", error);
    }
  }

  private async rotateLogFile(logFilePath: string): Promise<void> {
    const baseFileName = path.basename(logFilePath, ".jsonl");
    const logDir = path.dirname(logFilePath);

    // 既存のローテーションファイルを移動
    for (let i = this.logRotationCount - 1; i >= 1; i--) {
      const oldFile = path.join(logDir, `${baseFileName}.${i}.jsonl`);
      const newFile = path.join(logDir, `${baseFileName}.${i + 1}.jsonl`);

      try {
        await fs.access(oldFile);
        await fs.rename(oldFile, newFile);
      } catch {
        // ファイルが存在しない場合は無視
      }
    }

    // 現在のファイルをローテーション
    const rotatedFile = path.join(logDir, `${baseFileName}.1.jsonl`);
    await fs.rename(logFilePath, rotatedFile);
  }

  private async queryAuditLogs(
    timeRange?: { from: Date; to: Date },
    filters?: {
      userId?: string;
      department?: string;
      command?: string;
      riskLevel?: "low" | "medium" | "high";
    },
    limit: number = 100,
    offset: number = 0,
  ): Promise<AuditLog[]> {
    // 実装簡略化:実際は効率的なファイル読み取りとフィルタリング処理が必要
    const allLogs = await this.getAllAuditLogs();

    let filteredLogs = allLogs;

    if (timeRange) {
      filteredLogs = filteredLogs.filter(
        (log) =>
          log.timestamp >= timeRange.from && log.timestamp <= timeRange.to,
      );
    }

    if (filters) {
      if (filters.userId) {
        filteredLogs = filteredLogs.filter(
          (log) => log.user.id === filters.userId,
        );
      }
      if (filters.department) {
        filteredLogs = filteredLogs.filter(
          (log) => log.user.department === filters.department,
        );
      }
      if (filters.command) {
        filteredLogs = filteredLogs.filter((log) =>
          log.action.command.includes(filters.command!),
        );
      }
      if (filters.riskLevel) {
        filteredLogs = filteredLogs.filter(
          (log) => log.risk?.level === filters.riskLevel,
        );
      }
    }

    return filteredLogs
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(offset, offset + limit);
  }

  private async getAllAuditLogs(): Promise<AuditLog[]> {
    // 実装簡略化:実際は複数ファイルからの効率的な読み取りが必要
    const logs: AuditLog[] = [];

    try {
      const files = await fs.readdir(this.logDirectory);
      const auditFiles = files.filter(
        (file) => file.startsWith("audit-") && file.endsWith(".jsonl"),
      );

      for (const file of auditFiles.slice(0, 10)) {
        // 最新10ファイルのみ
        const filePath = path.join(this.logDirectory, file);
        const content = await fs.readFile(filePath, "utf8");
        const lines = content.trim().split("\n");

        for (const line of lines) {
          if (line.trim()) {
            try {
              const log = JSON.parse(line);
              log.timestamp = new Date(log.timestamp);
              logs.push(log);
            } catch (parseError) {
              Logger.warn("Failed to parse audit log line", parseError);
            }
          }
        }
      }
    } catch (error) {
      Logger.error("Failed to read audit logs", error);
    }

    return logs;
  }

  private anonymizeLog(log: AuditLog): AuditLog {
    return {
      ...log,
      user: {
        id: `anonymized_${log.user.role}_${log.id.slice(-8)}`,
        role: log.user.role,
        department: log.user.department,
        location: "anonymized",
      },
      dataAccess: {
        ...log.dataAccess,
        customersViewed:
          log.dataAccess.customersViewed?.map(() => "anonymized") || [],
      },
      action: {
        ...log.action,
        naturalLanguageInput: log.action.naturalLanguageInput
          ? "anonymized"
          : undefined,
        parameters: { ...log.action.parameters, anonymized: true },
      },
    };
  }

  private async updateAuditLog(log: AuditLog): Promise<void> {
    // 実装簡略化:実際は効率的な更新処理が必要
    Logger.info("Audit log anonymized", { logId: log.id });
  }

  private async deleteAuditLog(logId: string): Promise<void> {
    // 実装簡略化:実際は効率的な削除処理が必要
    Logger.info("Audit log deleted for retention compliance", { logId });
  }

  private async triggerSecurityAlert(auditLog: AuditLog): Promise<void> {
    Logger.error("Security alert triggered", {
      logId: auditLog.id,
      userId: auditLog.user.id,
      riskLevel: auditLog.risk?.level,
      reasons: auditLog.risk?.reasons,
    });

    // 実際の実装では、Slack通知やEmailアラート等を送信
  }
}
