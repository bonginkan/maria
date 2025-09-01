/**
 * ApprovalService - 承認フロー管理サービス
 *
 * ユーザー承認の管理、QuickApprovalとの統合
 * 承認履歴とポリシー管理
 */

import { QuickApprovalInterface as QuickApprovalEngine } from "../../quick-approval/QuickApprovalInterface.js";
import type { IMaria } from "@/types/maria.types";

export interface ApprovalRequest {
  id: string;
  type: "command" | "action" | "file_operation" | "system_change" | "custom";
  action: string;
  description: string;
  details?: Record<string, any>;
  risk: "low" | "medium" | "high" | "critical";
  timeout?: number;
  options?: ApprovalOption[];
}

export interface ApprovalOption {
  label: string;
  value: string;
  description?: string;
  isDefault?: boolean;
}

export interface ApprovalResponse {
  approved: boolean;
  option?: string;
  reason?: string;
  timestamp: Date;
  autoApproved?: boolean;
  userOverride?: boolean;
}

export interface ApprovalPolicy {
  name: string;
  condition: (request: ApprovalRequest) => boolean;
  action: "auto_approve" | "auto_deny" | "require_approval";
  message?: string;
}

export interface ApprovalHistory {
  request: ApprovalRequest;
  response: ApprovalResponse;
  duration: number;
}

export interface ApprovalConfig {
  defaultTimeout: number;
  autoApproveThreshold: "none" | "low" | "medium" | "high";
  requireConfirmation: boolean;
  rememberChoices: boolean;
  historySize: number;
  enablePolicies: boolean;
}

export class ApprovalService {
  private _quickApproval: QuickApprovalEngine | null = null;
  private _config: ApprovalConfig;
  private _policies: ApprovalPolicy[] = [];
  private _history: ApprovalHistory[] = [];
  private _rememberedChoices: Map<string, ApprovalResponse> = new Map();
  private _pendingApprovals: Map<string, ApprovalRequest> = new Map();

  constructor(config?: Partial<ApprovalConfig>) {
    this._config = {
      defaultTimeout: 30000, // 30秒
      autoApproveThreshold: "low",
      requireConfirmation: true,
      rememberChoices: true,
      historySize: 100,
      enablePolicies: true,
      ...config,
    };

    this.initializeDefaultPolicies();
  }

  /**
   * サービスの初期化
   */
  async initialize(maria: IMaria): Promise<void> {
    // QuickApprovalEngineの初期化
    this._quickApproval = new QuickApprovalEngine({
      maria,
      timeout: this._config.defaultTimeout,
    });

    await this._quickApproval.initialize();
  }

  /**
   * 承認リクエスト
   */
  async requestApproval(request: ApprovalRequest): Promise<ApprovalResponse> {
    const startTime = Date.now();

    // リクエストIDの重複チェック
    if (this._pendingApprovals.has(request.id)) {
      throw new Error(`Approval request ${request.id} is already pending`);
    }

    // 記憶された選択のチェック
    if (this._config.rememberChoices) {
      const remembered = this.checkRememberedChoice(request);
      if (remembered) {
        this.addToHistory(request, remembered, Date.now() - startTime);
        return remembered;
      }
    }

    // ポリシーの適用
    if (this._config.enablePolicies) {
      const policyResult = this.applyPolicies(request);
      if (policyResult) {
        this.addToHistory(request, policyResult, Date.now() - startTime);
        return policyResult;
      }
    }

    // 自動承認の判定
    if (this.shouldAutoApprove(request)) {
      const response: ApprovalResponse = {
        approved: true,
        reason: "Auto-approved due to low risk",
        timestamp: new Date(),
        autoApproved: true,
      };
      this.addToHistory(request, response, Date.now() - startTime);
      return response;
    }

    // ユーザー承認の要求
    try {
      this._pendingApprovals.set(request.id, request);
      const response = await this.promptUserApproval(request);

      // 選択の記憶
      if (this._config.rememberChoices && response.approved) {
        this.rememberChoice(request, response);
      }

      this.addToHistory(request, response, Date.now() - startTime);
      return response;
    } finally {
      this._pendingApprovals.delete(request.id);
    }
  }

  /**
   * バッチ承認リクエスト
   */
  async requestBatchApproval(
    requests: ApprovalRequest[],
  ): Promise<Map<string, ApprovalResponse>> {
    const results = new Map<string, ApprovalResponse>();

    // リスクレベルでグループ化
    const grouped = this.groupByRisk(requests);

    // 低リスクは自動承認
    for (const request of grouped.low) {
      if (this.shouldAutoApprove(request)) {
        results.set(request.id, {
          approved: true,
          reason: "Batch auto-approved (low risk)",
          timestamp: new Date(),
          autoApproved: true,
        });
      }
    }

    // 中〜高リスクは個別に処理
    const needsApproval = [
      ...grouped.medium,
      ...grouped.high,
      ...grouped.critical,
    ];

    if (needsApproval.length > 0) {
      const batchResponse = await this.promptBatchApproval(needsApproval);
      batchResponse.forEach((response, id) => {
        results.set(id, response);
      });
    }

    return results;
  }

  /**
   * ユーザー承認のプロンプト
   */
  private async promptUserApproval(
    request: ApprovalRequest,
  ): Promise<ApprovalResponse> {
    if (!this._quickApproval) {
      throw new Error("ApprovalService not initialized");
    }

    // プロンプトメッセージの構築
    const message = this.buildApprovalMessage(request);

    // QuickApprovalを使用した承認
    const result = await this._quickApproval.requestApproval({
      action: request.action,
      message,
      options: request.options?.map((opt) => ({
        label: opt.label,
        value: opt.value,
      })),
      timeout: request.timeout || this._config.defaultTimeout,
    });

    return {
      approved: result.approved,
      option: result.selectedOption,
      reason: result.reason,
      timestamp: new Date(),
      userOverride: true,
    };
  }

  /**
   * バッチ承認のプロンプト
   */
  private async promptBatchApproval(
    requests: ApprovalRequest[],
  ): Promise<Map<string, ApprovalResponse>> {
    const results = new Map<string, ApprovalResponse>();

    // 承認メッセージの構築
    const message = this.buildBatchApprovalMessage(requests);

    // 一括承認の確認
    const batchApproval = await this.promptUserApproval({
      id: "batch-approval",
      type: "custom",
      action: "Batch Approval",
      description: message,
      risk: this.getHighestRisk(requests),
      options: [
        { label: "Approve All", value: "all", isDefault: false },
        { label: "Deny All", value: "none", isDefault: true },
        { label: "Review Individually", value: "individual", isDefault: false },
      ],
    });

    if (batchApproval.option === "all") {
      // すべて承認
      requests.forEach((req) => {
        results.set(req.id, {
          approved: true,
          reason: "Batch approved",
          timestamp: new Date(),
        });
      });
    } else if (batchApproval.option === "none") {
      // すべて拒否
      requests.forEach((req) => {
        results.set(req.id, {
          approved: false,
          reason: "Batch denied",
          timestamp: new Date(),
        });
      });
    } else {
      // 個別レビュー
      for (const request of requests) {
        const response = await this.promptUserApproval(request);
        results.set(request.id, response);
      }
    }

    return results;
  }

  /**
   * デフォルトポリシーの初期化
   */
  private initializeDefaultPolicies(): void {
    // 読み取り専用操作の自動承認
    this._policies.push({
      name: "auto-approve-read-only",
      condition: (req) =>
        req.type === "command" &&
        ["status", "help", "list", "show", "get"].some((cmd) =>
          req.action.toLowerCase().includes(cmd),
        ),
      action: "auto_approve",
      message: "Read-only operation auto-approved",
    });

    // システム変更の承認要求
    this._policies.push({
      name: "require-system-changes",
      condition: (req) => req.type === "system_change",
      action: "require_approval",
      message: "System changes require approval",
    });

    // クリティカルリスクの承認要求
    this._policies.push({
      name: "require-critical-risk",
      condition: (req) => req.risk === "critical",
      action: "require_approval",
      message: "Critical risk operations require approval",
    });
  }

  /**
   * ポリシーの適用
   */
  private applyPolicies(request: ApprovalRequest): ApprovalResponse | null {
    for (const policy of this._policies) {
      if (policy.condition(request)) {
        if (policy.action === "auto_approve") {
          return {
            approved: true,
            reason: policy.message || "Policy auto-approved",
            timestamp: new Date(),
            autoApproved: true,
          };
        } else if (policy.action === "auto_deny") {
          return {
            approved: false,
            reason: policy.message || "Policy auto-denied",
            timestamp: new Date(),
            autoApproved: true,
          };
        }
        // require_approval の場合はnullを返して通常フローへ
      }
    }

    return null;
  }

  /**
   * 自動承認の判定
   */
  private shouldAutoApprove(request: ApprovalRequest): boolean {
    const thresholdMap: Record<string, number> = {
      none: 0,
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    };

    const requestLevel = thresholdMap[request.risk];
    const threshold = thresholdMap[this._config.autoApproveThreshold];

    return requestLevel <= threshold;
  }

  /**
   * 記憶された選択のチェック
   */
  private checkRememberedChoice(
    request: ApprovalRequest,
  ): ApprovalResponse | null {
    const key = this.getChoiceKey(request);
    return this._rememberedChoices.get(key) || null;
  }

  /**
   * 選択の記憶
   */
  private rememberChoice(
    request: ApprovalRequest,
    response: ApprovalResponse,
  ): void {
    const key = this.getChoiceKey(request);
    this._rememberedChoices.set(key, response);

    // サイズ制限
    if (this._rememberedChoices.size > 100) {
      const firstKey = this._rememberedChoices.keys().next().value;
      this._rememberedChoices.delete(firstKey);
    }
  }

  /**
   * 選択キーの生成
   */
  private getChoiceKey(request: ApprovalRequest): string {
    return `${request.type}:${request.action}:${request.risk}`;
  }

  /**
   * 承認メッセージの構築
   */
  private buildApprovalMessage(request: ApprovalRequest): string {
    const lines = [
      `Action: ${request.action}`,
      `Type: ${request.type}`,
      `Risk: ${request.risk.toUpperCase()}`,
      `Description: ${request.description}`,
    ];

    if (request.details) {
      lines.push("Details:");
      Object.entries(request.details).forEach(([key, value]) => {
        lines.push(`  ${key}: ${value}`);
      });
    }

    return lines.join("\n");
  }

  /**
   * バッチ承認メッセージの構築
   */
  private buildBatchApprovalMessage(requests: ApprovalRequest[]): string {
    const lines = [`${requests.length} operations require approval:`, ""];

    requests.forEach((req, index) => {
      lines.push(`${index + 1}. ${req.action} (Risk: ${req.risk})`);
    });

    return lines.join("\n");
  }

  /**
   * リスクレベルでグループ化
   */
  private groupByRisk(requests: ApprovalRequest[]): {
    low: ApprovalRequest[];
    medium: ApprovalRequest[];
    high: ApprovalRequest[];
    critical: ApprovalRequest[];
  } {
    return {
      low: requests.filter((r) => r.risk === "low"),
      medium: requests.filter((r) => r.risk === "medium"),
      high: requests.filter((r) => r.risk === "high"),
      critical: requests.filter((r) => r.risk === "critical"),
    };
  }

  /**
   * 最高リスクレベルの取得
   */
  private getHighestRisk(
    requests: ApprovalRequest[],
  ): "low" | "medium" | "high" | "critical" {
    const riskLevels = ["low", "medium", "high", "critical"];
    let highest = 0;

    for (const request of requests) {
      const level = riskLevels.indexOf(request.risk);
      if (level > highest) {
        highest = level;
      }
    }

    return riskLevels[highest] as any;
  }

  /**
   * 履歴への追加
   */
  private addToHistory(
    request: ApprovalRequest,
    response: ApprovalResponse,
    duration: number,
  ): void {
    this._history.unshift({
      request,
      response,
      duration,
    });

    // サイズ制限
    if (this._history.length > this._config.historySize) {
      this._history.pop();
    }
  }

  /**
   * ポリシーの追加
   */
  addPolicy(policy: ApprovalPolicy): void {
    this._policies.push(policy);
  }

  /**
   * ポリシーの削除
   */
  removePolicy(name: string): void {
    this._policies = this._policies.filter((p) => p.name !== name);
  }

  /**
   * 履歴の取得
   */
  getHistory(limit?: number): ApprovalHistory[] {
    return limit ? this._history.slice(0, limit) : [...this._history];
  }

  /**
   * 記憶された選択のクリア
   */
  clearRememberedChoices(): void {
    this._rememberedChoices.clear();
  }

  /**
   * 保留中の承認の取得
   */
  getPendingApprovals(): ApprovalRequest[] {
    return Array.from(this._pendingApprovals.values());
  }

  /**
   * サービスのシャットダウン
   */
  async shutdown(): Promise<void> {
    if (this._quickApproval) {
      await this._quickApproval.shutdown();
      this._quickApproval = null;
    }

    this._pendingApprovals.clear();
    this._rememberedChoices.clear();
    this._history = [];
  }
}
