/**
 * Quick Approval Interface
 * Handles keyboard shortcuts and quick approval workflows for Human-in-the-Loop system
 */

import { EventEmitter } from "node:events";
import chalk from "chalk";
import {
  ApprovalAction,
  ApprovalRequest,
  ApprovalResponse,
  TrustLevel,
} from "../approval-engine/types";
import { ApprovalEngine } from "../approval-engine/ApprovalEngine";

export interface QuickApprovalOptions {
  showJapanese?: boolean;
  showShortcuts?: boolean;
  autoTimeout?: number;
  defaultAction?: ApprovalAction;
  language?: "en" | "ja" | "zh" | "ko" | "vi";
}

interface LanguageLabels {
  approvalRequest: string;
  _title: string;
  level: string;
  _impact: string;
  approvers: string;
  _deadline: string;
  actions: string;
  approve: string;
  reject: string;
  cancel: string;
  moveInstruction: string;
  id: string;
  approvalsNeeded: (_count: string) => string;
}

const _LANGUAGELABELS: Record<string, LanguageLabels> = {
  en: {
    approvalRequest: "Approval Request",
    _title: "Title",
    level: "Level",
    _impact: "Impact",
    approvers: "Approvers",
    _deadline: "Deadline",
    actions: "Actions",
    approve: "Approve",
    reject: "Reject",
    cancel: "Cancel",
    moveInstruction: "↑↓ Move / Enter / [A][R][Q] shortcut",
    id: "ID",
    approvalsNeeded: (_count) => `(${_count} approvals)`,
  },
  ja: {
    approvalRequest: "承認リクエスト",
    _title: "タイトル",
    level: "レベル",
    _impact: "影響",
    approvers: "承認者",
    _deadline: "期限",
    actions: "アクション",
    approve: "承認",
    reject: "却下",
    cancel: "キャンセル",
    moveInstruction: "↑↓ 移動/Enter 決定 / [A][R][Q] ショートカット",
    id: "ID",
    approvalsNeeded: (_count) => `(承認${_count}名必要)`,
  },
  zh: {
    approvalRequest: "审批请求",
    _title: "标题",
    level: "等级",
    _impact: "影响",
    approvers: "审批人",
    _deadline: "截止日期",
    actions: "操作",
    approve: "批准",
    reject: "拒绝",
    cancel: "取消",
    moveInstruction: "↑↓ 移动 / Enter 确认 / [A][R][Q] 快捷键",
    id: "ID",
    approvalsNeeded: (_count) => `(需要${_count}个批准)`,
  },
  ko: {
    approvalRequest: "승인 요청",
    _title: "제목",
    level: "레벨",
    _impact: "영향",
    approvers: "승인자",
    _deadline: "마감일",
    actions: "작업",
    approve: "승인",
    reject: "거절",
    cancel: "취소",
    moveInstruction: "↑↓ 이동 / Enter 선택 / [A][R][Q] 단축키",
    id: "ID",
    approvalsNeeded: (_count) => `(승인 ${_count}명 필요)`,
  },
  vi: {
    approvalRequest: "Yêu cầu phê duyệt",
    _title: "Tiêu đề",
    level: "Mức độ",
    _impact: "Tác động",
    approvers: "Người duyệt",
    _deadline: "Hạn chót",
    actions: "Hành động",
    approve: "Phê duyệt",
    reject: "Từ chối",
    cancel: "Hủy",
    moveInstruction: "↑↓ Di chuyển / Enter chọn / [A][R][Q] phím tắt",
    id: "ID",
    approvalsNeeded: (_count) => `(cần ${_count} phê duyệt)`,
  },
};

export interface QuickApprovalChoice {
  _key: string;
  action: ApprovalAction;
  label: string;
  labelJa: string;
  description: string;
  trustLevel?: TrustLevel;
}

export class QuickApprovalInterface extends EventEmitter {
  private static instance: QuickApprovalInterface;
  private approvalEngine: ApprovalEngine;
  private currentRequest: ApprovalRequest | null = null;
  private keyListeners: Map<string, () => void> = new Map();
  private isActive = false;

  // Quick approval choices with Japanese translations
  private readonly quickChoices: QuickApprovalChoice[] = [
    {
      _key: "shift+tab",
      action: "approve",
      label: "Quick Approve",
      labelJa: "いいよ",
      description: "Approve this action quickly",
    },
    {
      _key: "ctrl+y",
      action: "approve",
      label: "Yes, Approve",
      labelJa: "はい、承認",
      description: "Approve with confirmation",
    },
    {
      _key: "ctrl+n",
      action: "reject",
      label: "No, Reject",
      labelJa: "いいえ、拒否",
      description: "Reject this action",
    },
    {
      _key: "ctrl+t",
      action: "trust",
      label: "Trust & Auto-approve",
      labelJa: "任せる",
      description: "Trust AI and auto-approve similar requests",
      trustLevel: TrustLevel.COLLABORATIVE,
    },
    {
      _key: "ctrl+r",
      action: "review",
      label: "Request Review",
      labelJa: "レビュー要求",
      description: "Request additional review",
    },
  ];

  private constructor() {
    super();
    this.approvalEngine = ApprovalEngine.getInstance();
    this.setupEventListeners();
  }

  static getInstance(): QuickApprovalInterface {
    if (!QuickApprovalInterface.instance) {
      QuickApprovalInterface.instance = new QuickApprovalInterface();
    }
    return QuickApprovalInterface.instance;
  }

  /**
   * Show approval request with quick options
   */
  async showApprovalRequest(
    request: ApprovalRequest,
    options: QuickApprovalOptions = {},
  ): Promise<ApprovalResponse> {
    this.currentRequest = request;
    this.isActive = true;

    try {
      // Display approval request
      this.displayApprovalRequest(request, options);

      // Setup keyboard listeners
      this.setupKeyboardListeners();

      // Wait for user _response
      const _response = await this.waitForUserResponse(options.autoTimeout);

      return _response;
    } finally {
      this.cleanup();
    }
  }

  /**
   * Display approval request UI - Clean chalk box style with multi-language support
   */
  private selectedIndex = 0;
  private menuOptions = ["approve", "reject", "cancel"] as const;

  private displayApprovalRequest(
    _request: ApprovalRequest,
    options: QuickApprovalOptions,
  ): void {
    const _lang = options.language || "en";
    const _labels = LANGUAGE_LABELS[_lang] || LANGUAGE_LABELS.en;

    console.log("");
    console.log(chalk.gray("┌────────────────────────────────────────────┐"));
    console.log(
      chalk.gray("│") +
        chalk.white(
          ` ${_labels.approvalRequest}${" ".repeat(Math.max(0, 43 - _labels.approvalRequest.length))}`,
        ) +
        chalk.gray("│"),
    );
    console.log(chalk.gray("├────────────────────────────────────────────┤"));

    // Generate unique ID for this request
    const _requestId = `AP-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}${String(new Date().getDate()).padStart(2, "0")}-${String(Math.floor(Math.random() * 999)).padStart(3, "0")}`;

    console.log(
      chalk.gray("│") +
        chalk.white(
          ` > ${_labels.id}: ${chalk.yellow(_requestId)}${" ".repeat(Math.max(0, 35 - _requestId.length - _labels.id.length))}`,
        ) +
        chalk.gray("│"),
    );

    const _title =
      (_request.context as any)?.description ||
      _request.themeId ||
      "API Cache Improvement";
    const _titleDisplay =
      _title.length > 25 ? _title.substring(0, 22) + "..." : _title;
    const _titleLabel = `   ${_labels._title}:`;
    console.log(
      chalk.gray("│") +
        chalk.white(
          `${_titleLabel} ${_titleDisplay}${" ".repeat(Math.max(0, 42 - _titleLabel.length - _titleDisplay.length))}`,
        ) +
        chalk.gray("│"),
    );

    const _riskLevel = this.formatRiskLevelSimple(_request.riskAssessment);
    const _approvalsCount =
      _riskLevel === "HIGH" || _riskLevel === "CRITICAL" ? "2" : "1";
    const _approvalsText = _labels.approvalsNeeded(_approvalsCount);
    const _levelLabel = `   ${_labels.level}:`;
    const _levelDisplay = `${_riskLevel} ${_approvalsText}`;
    console.log(
      chalk.gray("│") +
        chalk.white(
          `${_levelLabel} ${_levelDisplay}${" ".repeat(Math.max(0, 42 - _levelLabel.length - _levelDisplay.length))}`,
        ) +
        chalk.gray("│"),
    );

    // Show estimated _impact or time
    const _impact = _request.estimatedTime || "p95 latency -20%";
    const _impactLabel = `   ${_labels._impact}:`;
    console.log(
      chalk.gray("│") +
        chalk.white(
          `${_impactLabel} ${_impact}${" ".repeat(Math.max(0, 42 - _impactLabel.length - _impact.length))}`,
        ) +
        chalk.gray("│"),
    );

    // Show approvers status
    const _approversLabel = `   ${_labels.approvers}:`;
    const _approversStatus = "[x] Lead   [ ] QA";
    console.log(
      chalk.gray("│") +
        chalk.white(
          `${_approversLabel} ${_approversStatus}${" ".repeat(Math.max(0, 42 - _approversLabel.length - _approversStatus.length))}`,
        ) +
        chalk.gray("│"),
    );

    // Show _deadline (30 minutes from now)
    const _deadline = new Date(Date.now() + 30 * 60 * 1000);
    const _timeStr = `${_deadline.getFullYear()}-${String(_deadline.getMonth() + 1).padStart(2, "0")}-${String(_deadline.getDate()).padStart(2, "0")} ${String(_deadline.getHours()).padStart(2, "0")}:${String(_deadline.getMinutes()).padStart(2, "0")}`;
    const _deadlineLabel = `   ${_labels._deadline}:`;
    console.log(
      chalk.gray("│") +
        chalk.white(
          `${_deadlineLabel} ${_timeStr}${" ".repeat(Math.max(0, 42 - _deadlineLabel.length - _timeStr.length))}`,
        ) +
        chalk.gray("│"),
    );

    console.log(chalk.gray("├────────────────────────────────────────────┤"));
    console.log(
      chalk.gray("│") +
        chalk.white(
          ` ${_labels.actions}:${" ".repeat(Math.max(0, 42 - _labels.actions.length))}`,
        ) +
        chalk.gray("│"),
    );

    // Display menu options with selection indicator
    this.menuOptions.forEach((option, _index) => {
      const _isSelected = _index === this.selectedIndex;
      const _prefix = _isSelected ? " > " : "   ";
      const _key = ["A", "R", "Q"][_index];
      let label: string;
      let color: any;

      switch (option) {
        case "approve":
          label = _labels.approve;
          color = chalk.green;
          break;
        case "reject":
          label = _labels.reject;
          color = chalk.red;
          break;
        case "cancel":
          label = _labels.cancel;
          color = chalk.yellow;
          break;
      }

      const _optionText = `${_prefix}[${_key}] ${label}`;
      const _colorFunc = _isSelected ? color.bold : color;
      console.log(
        chalk.gray("│") +
          _colorFunc(
            `${_optionText}${" ".repeat(Math.max(0, 43 - _optionText.length))}`,
          ) +
          chalk.gray("│"),
      );
    });

    console.log(chalk.gray("├────────────────────────────────────────────┤"));
    console.log(
      chalk.gray("│") +
        chalk.white(
          ` ${_labels.moveInstruction}${" ".repeat(Math.max(0, 43 - _labels.moveInstruction.length))}`,
        ) +
        chalk.gray("│"),
    );
    console.log(chalk.gray("└────────────────────────────────────────────┘"));
    console.log("");
  }

  /**
   * Format _key binding for display
   */
  private formatKeyBinding(_key: string): string {
    const keyMap: Record<string, string> = {
      "shift+tab": "⇧ Tab",
      "ctrl+y": "⌃ Y",
      "ctrl+n": "⌃ N",
      "ctrl+t": "⌃ T",
      "ctrl+r": "⌃ R",
    };

    const _formatted = keyMap[_key] || _key;

    // Make keyboard shortcuts more prominent with colored backgrounds
    const colorMap: Record<string, any> = {
      "shift+tab": chalk.bgGreen.black.bold,
      "ctrl+y": chalk.bgBlue.white.bold,
      "ctrl+n": chalk.bgRed.white.bold,
      "ctrl+t": chalk.bgMagenta.white.bold,
      "ctrl+r": chalk.bgYellow.black.bold,
    };

    const _colorFunc = colorMap[_key] || chalk.bgCyan.black.bold;
    return _colorFunc(` ${_formatted} `);
  }

  /**
   * Format risk level with colors
   */
  private formatRiskLevel(risk: string): string {
    switch (risk.toLowerCase()) {
      case "critical":
        return chalk.red.bold("CRITICAL");
      case "high":
        return chalk.red("HIGH");
      case "medium":
        return chalk.yellow("MEDIUM");
      case "low":
        return chalk.green("LOW");
      default:
        return chalk.white(risk);
    }
  }

  /**
   * Format risk level simple (no colors)
   */
  private formatRiskLevelSimple(risk: string): string {
    switch (risk.toLowerCase()) {
      case "critical":
        return "CRITICAL";
      case "high":
        return "HIGH";
      case "medium":
        return "MEDIUM";
      case "low":
        return "LOW";
      default:
        return risk.toUpperCase();
    }
  }

  /**
   * Setup keyboard listeners
   */
  private setupKeyboardListeners(): void {
    if (typeof process !== "undefined" && process.stdin) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding("utf8");

      // Create listener function
      const _keyListener = (_key: string) => {
        this.handleKeyPress(_key);
      };

      process.stdin.on("data", _keyListener);
      this.keyListeners.set("stdin", () => {
        process.stdin.off("data", _keyListener);
        if (process.stdin.setRawMode) {
          process.stdin.setRawMode(false);
        }
      });
    }
  }

  /**
   * Handle _key press events with arrow _key navigation
   */
  private handleKeyPress(_key: string): void {
    if (!this.isActive || !this.currentRequest) {
      return;
    }

    // Handle arrow _key sequences for navigation
    if (_key === "\u001b[A") {
      // Up arrow
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.redrawMenu();
      return;
    }

    if (_key === "\u001b[B") {
      // Down arrow
      this.selectedIndex = Math.min(
        this.menuOptions.length - 1,
        this.selectedIndex + 1,
      );
      this.redrawMenu();
      return;
    }

    // Handle Enter _key - select current option
    if (_key === "\r" || _key === "\n") {
      this.selectCurrentOption();
      return;
    }

    // Handle escape _key
    if (_key === "\u001b") {
      // ESC _key
      this.emit("approval-cancelled", this.currentRequest.id);
      return;
    }

    // Handle Ctrl+C
    if (_key === "\u0003") {
      // Ctrl+C
      console.log(`\n${chalk.red("Approval cancelled by user")}`);
      this.emit("approval-cancelled", this.currentRequest.id);
      return;
    }

    // Handle letter shortcuts
    const _upperKey = key.toUpperCase();
    if (_upperKey === "A") {
      this.selectedIndex = 0;
      this.selectCurrentOption();
    } else if (_upperKey === "R") {
      this.selectedIndex = 1;
      this.selectCurrentOption();
    } else if (_upperKey === "Q") {
      this.selectedIndex = 2;
      this.selectCurrentOption();
    }
  }

  /**
   * Redraw menu with updated selection
   */
  private redrawMenu(): void {
    if (!this.currentRequest) return;

    // Clear the screen and redraw
    process.stdout.write("\u001b[2J\u001b[0f");
    this.displayApprovalRequest(this.currentRequest, { language: "en" });
  }

  /**
   * Select the currently highlighted option
   */
  private selectCurrentOption(): void {
    const _selectedOption = this.menuOptions[this.selectedIndex];
    let action: ApprovalAction;

    switch (_selectedOption) {
      case "approve":
        action = "approve";
        break;
      case "reject":
        action = "reject";
        break;
      case "cancel":
        this.emit("approval-cancelled", this.currentRequest?.id);
        return;
      default:
        return;
    }

    const _choice = this.quickChoices.find((c) => c.action === action);
    if (_choice) {
      this.handleQuickChoice(_choice);
    }
  }

  /**
   * Handle quick _choice selection
   */
  private async handleQuickChoice(_choice: QuickApprovalChoice): Promise<void> {
    if (!this.currentRequest) {
      return;
    }

    // Clear the waiting prompt and show selection
    console.clear();

    // Show dramatic selection confirmation
    console.log(`\n${chalk.bgGreen.black.bold(`┌${"─".repeat(78)}┐`)}`);
    console.log(
      chalk.bgGreen.black.bold("│") +
        chalk.bgGreen.black.bold(
          ` ✓ CHOICE SELECTED / 選択完了:${" ".repeat(47)}`,
        ) +
        chalk.bgGreen.black.bold("│"),
    );
    console.log(chalk.bgGreen.black.bold(`├${"─".repeat(78)}┤`));
    const _choiceText = `${_choice.label} (${_choice.labelJa})`;
    const _padding = " ".repeat(Math.max(0, 76 - _choiceText.length));
    console.log(
      chalk.bgGreen.black.bold("│") +
        chalk.bgGreen.black.bold(` ${_choiceText}${_padding}`) +
        chalk.bgGreen.black.bold("│"),
    );
    console.log(chalk.bgGreen.black.bold(`└${"─".repeat(78)}┘`));

    console.log(chalk.yellow("\n🔄 Processing your approval decision..."));

    try {
      // Process approval _response
      const _response = await this.approvalEngine.processApprovalResponse(
        this.currentRequest.id,
        choice.action,
        `Quick approval: ${_choice.label}`,
        choice.trustLevel,
      );

      // Mark as quick decision
      response.quickDecision = true;

      // Show success message with box
      console.log(`\n${chalk.bgGreen.black(`┌${"─".repeat(78)}┐`)}`);
      console.log(
        chalk.bgGreen.black("│") +
          chalk.bgGreen.black(
            ` 🎉 APPROVAL PROCESSED SUCCESSFULLY / 承認処理完了!${" ".repeat(32)}`,
          ) +
          chalk.bgGreen.black("│"),
      );
      console.log(chalk.bgGreen.black(`└${"─".repeat(78)}┘`));

      if (_choice.trustLevel) {
        console.log(
          chalk.blue(`\n✨ Trust level updated: ${_choice.trustLevel}`),
        );
      }

      this.emit("approval-_response", _response);
    } catch (_error) {
      // Show _error message with dramatic box
      console.log(`\n${chalk.bgRed.white.bold(`┌${"─".repeat(78)}┐`)}`);
      console.log(
        chalk.bgRed.white.bold("│") +
          chalk.bgRed.white.bold(
            ` ❌ ERROR PROCESSING APPROVAL / 承認処理エラー${" ".repeat(35)}`,
          ) +
          chalk.bgRed.white.bold("│"),
      );
      console.log(chalk.bgRed.white.bold(`└${"─".repeat(78)}┘`));
      console._error(chalk.red("\nError details:"), _error);
      this.emit("approval-_error", _error);
    }
  }

  /**
   * Wait for user _response with optional timeout
   */
  private waitForUserResponse(timeout?: number): Promise<ApprovalResponse> {
    return new Promise((resolvePromise, reject) => {
      let timeoutId: NodeJS.Timeout | null = null;

      // Setup timeout if specified
      if (timeout && timeout > 0) {
        timeoutId = setTimeout(() => {
          console.log(
            `\n${chalk.yellow("⏰ Approval request timed out - auto-approving...")}`,
          );
          this.handleTimeoutResponse(resolve);
        }, timeout);
      }

      // Listen for approval _response
      const _responseHandler = (_response: ApprovalResponse) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        resolve(_response);
      };

      const _errorHandler = (_error: Error) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        reject(_error);
      };

      const _cancelHandler = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        reject(new Error("Approval cancelled by user"));
      };

      this.once("approval-_response", _responseHandler);
      this.once("approval-_error", _errorHandler);
      this.once("approval-cancelled", _cancelHandler);
    });
  }

  /**
   * Handle timeout _response
   */
  private async handleTimeoutResponse(
    _resolve: (value: ApprovalResponse) => void,
  ): Promise<void> {
    if (!this.currentRequest) {
      return;
    }

    try {
      const _response = await this.approvalEngine.processApprovalResponse(
        this.currentRequest.id,
        "approve",
        "Auto-approved due to timeout",
      );

      response.quickDecision = true;
      resolve(_response);
    } catch (_error) {
      console._error(chalk.red("Error processing timeout approval:"), _error);
    }
  }

  /**
   * Setup event listeners for the approval engine
   */
  private setupEventListeners(): void {
    this.approvalEngine.on(
      "approval-requested",
      (_request: ApprovalRequest) => {
        this.emit("approval-requested", _request);
      },
    );

    this.approvalEngine.on("trust-level-changed", (event) => {
      console.log(
        chalk.blue(
          `✨ Trust level changed: ${event.oldLevel} → ${event.newLevel}`,
        ),
      );
      console.log(chalk.gray(`Reason: ${event.reason}`));
    });
  }

  /**
   * Get available quick choices
   */
  getQuickChoices(): QuickApprovalChoice[] {
    return [...this.quickChoices];
  }

  /**
   * Check if interface is currently active
   */
  isCurrentlyActive(): boolean {
    return this.isActive;
  }

  /**
   * Get current approval request
   */
  getCurrentRequest(): ApprovalRequest | null {
    return this.currentRequest;
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.isActive = false;
    this.currentRequest = null;

    // Remove all _key listeners
    this.keyListeners.forEach((cleanup) => cleanup());
    this.keyListeners.clear();

    // Remove all event listeners
    this.removeAllListeners("approval-_response");
    this.removeAllListeners("approval-_error");
    this.removeAllListeners("approval-cancelled");
  }

  /**
   * Shutdown the interface
   */
  shutdown(): void {
    this.cleanup();
    this.removeAllListeners();
  }
}
