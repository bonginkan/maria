/**
 * UI Utilities - MARIA CODE 124文字幅最適化版
 * Ultra Think設計による完璧な画面表示システム
 */

// 新しいデザインシステムのインポート
import { LayoutManager } from "../ui/design-system/LayoutManager.js";
import { OptimizedBox } from "../ui/design-system/OptimizedBox.js";
import { ResponsiveRenderer } from "../ui/design-system/ResponsiveRenderer.js";
import {
  SEMANTIC_COLORS,
  TEXT_HIERARCHY,
} from "../ui/design-system/UnifiedColorPalette.js";
import { IconRegistry } from "../ui/design-system/MinimalIconRegistry.js";

export function printWelcome(): void {
  // Initialize responsive system
  ResponsiveRenderer.initialize();

  // Clear console for clean display
  console.clear();

  // Get optimal _layout for current terminal
  const _layout = LayoutManager.getOptimalLayout();

  // Render MARIA CODE header with brand colors
  renderMARIAHeader(_layout);

  // Show interactive session _info
  renderSessionInfo(_layout);

  // Display AI _services _status
  renderAIServicesStatus(_layout);
}

export function printStatus(health: unknown): void {
  const _layout = LayoutManager.getOptimalLayout();

  // Render _status with optimized _layout
  OptimizedBox.withTitle(
    "System Status",
    [renderOverallStatus(health), ...renderHealthSections(health)],
    {
      theme: getHealthTheme(health.overall),
      width: _layout.contentWidth,
      responsive: true,
    },
  );

  // Show _timestamp
  if (health._timestamp || health.lastUpdate) {
    const _timestamp = health._timestamp || health.lastUpdate;
    const _timeStr =
      _timestamp instanceof Date
        ? _timestamp.toLocaleString()
        : new Date(_timestamp).toLocaleString();
    console.log("");
    console.log(TEXT_HIERARCHY.CAPTION(`Last updated: ${_timeStr}`));
  }
}

export function formatResourceUsage(percentage: number): string {
  if (percentage < 70) {
    return SEMANTIC_COLORS.SUCCESS(percentage.toString());
  } else if (percentage < 90) {
    return SEMANTIC_COLORS.WARNING(percentage.toString());
  } else {
    return SEMANTIC_COLORS.ERROR(percentage.toString());
  }
}

// === 新しい124文字幅対応ヘルパー関数 ===

/**
 * MARIA CODEヘッダー描画(ブランドロゴ対応)
 */
function renderMARIAHeader(_layout: unknown): void {
  const _headerContent = [
    "MARIA CODE",
    "AI-Powered Development Platform",
    "(c) 2025 Bonginkan Inc.",
  ];

  OptimizedBox.brand(_headerContent, {
    width: _layout.contentWidth,
    title: "",
    padding: "large",
    responsive: true,
  });

  console.log("");
}

/**
 * セッション情報表示
 */
function renderSessionInfo(_layout: unknown): void {
  const _info = [
    LayoutManager.alignText(
      "Welcome to MARIA CODE Interactive Chat",
      layout.contentWidth,
      "center",
    ),
    "",
    `${SEMANTIC_COLORS.SUCCESS("40+ Slash Commands Available")} ${TEXT_HIERARCHY.CAPTION("- Type")} ${SEMANTIC_COLORS.WARNING("/help")} ${TEXT_HIERARCHY.CAPTION("to see all")}`,
    TEXT_HIERARCHY.CAPTION("Type anytime to interrupt current processing"),
    "",
    TEXT_HIERARCHY.BODY("You can:"),
    `${TEXT_HIERARCHY.CAPTION("• ")}Type naturally for AI assistance`,
    `${TEXT_HIERARCHY.CAPTION("• ")}Use slash commands for specific actions`,
    `${TEXT_HIERARCHY.CAPTION("• ")}Interrupt anytime with new instructions`,
    "",
    `${TEXT_HIERARCHY.CAPTION("Examples: ")}${SEMANTIC_COLORS.WARNING("/code")}, ${SEMANTIC_COLORS.WARNING("/test")}, ${SEMANTIC_COLORS.WARNING("/review")}, ${SEMANTIC_COLORS.WARNING("/video")}, ${SEMANTIC_COLORS.WARNING("/image")}`,
  ];

  info.forEach((line) => console.log(line));
  console.log("");
}

/**
 * AI サービス状況表示(最適化版)
 */
function renderAIServicesStatus(_layout: unknown): void {
  console.log(TEXT_HIERARCHY.SUBTITLE("Available AI Services:"));
  console.log(
    SEMANTIC_COLORS.MUTED(
      LayoutManager.createSectionSeparator(_layout.contentWidth),
    ),
  );

  // Cloud AI _services
  renderCloudAIStatus();

  console.log("");

  // Local AI _services
  renderLocalAIStatus();

  console.log(
    SEMANTIC_COLORS.MUTED(
      LayoutManager.createSectionSeparator(_layout.contentWidth),
    ),
  );
  console.log("");
}

/**
 * Cloud AI サービス状況
 */
function renderCloudAIStatus(): void {
  console.log(TEXT_HIERARCHY.SECTION("Cloud AI (Ready Now):"));

  const _services = [
    { key: "OPENAI_API_KEY", _name: "OpenAI", _models: "GPT-5, GPT-4" },
    {
      key: "ANTHROPIC_API_KEY",
      _name: "Anthropic",
      _models: "Claude Opus 4.1",
    },
    { key: "GOOGLE_AI_API_KEY", _name: "Google AI", _models: "Gemini 2.5 Pro" },
  ];

  let hasAnyAPI = false;

  services.forEach((service) => {
    if (process.env[service.key]) {
      const _status = SEMANTIC_COLORS.SUCCESS(IconRegistry.get("SUCCESS"));
      const _name = TEXT_HIERARCHY.BODY(service._name.padEnd(12));
      const _models = TEXT_HIERARCHY.CAPTION(`(${service._models})`);
      console.log(`  ${_status} ${_name} ${_models}`);
      hasAnyAPI = true;
    }
  });

  if (!hasAnyAPI) {
    const _status = SEMANTIC_COLORS.WARNING(IconRegistry.get("WARNING"));
    console.log(
      `  ${_status} ${TEXT_HIERARCHY.CAPTION("No cloud APIs configured")}`,
    );
  }
}

/**
 * Local AI サービス状況
 */
function renderLocalAIStatus(): void {
  console.log(TEXT_HIERARCHY.SECTION("Local AI (Checking):"));

  const _localServices = [
    { _name: "LM Studio", _status: "Auto-detecting..." },
    { _name: "Ollama", _status: "Auto-detecting..." },
    { _name: "vLLM", _status: "Auto-detecting..." },
  ];

  localServices.forEach((service) => {
    const _status = SEMANTIC_COLORS.MUTED(IconRegistry.get("LOADING"));
    const _name = TEXT_HIERARCHY.BODY(service._name.padEnd(12));
    const _statusText = TEXT_HIERARCHY.CAPTION(`(${service._status})`);
    console.log(`  ${_status} ${_name} ${_statusText}`);
  });
}

/**
 * ヘルス状況の全体ステータス描画
 */
function renderOverallStatus(health: unknown): string {
  const _statusIcon =
    health.overall === "healthy"
      ? IconRegistry.get("SUCCESS")
      : health.overall === "degraded"
        ? IconRegistry.get("WARNING")
        : IconRegistry.get("ERROR");

  const _statusColor =
    health.overall === "healthy"
      ? SEMANTIC_COLORS.SUCCESS
      : health.overall === "degraded"
        ? SEMANTIC_COLORS.WARNING
        : SEMANTIC_COLORS.ERROR;

  return _statusColor(
    `${_statusIcon} Overall Status: ${health.overall.toUpperCase()}`,
  );
}

/**
 * ヘルス状況のセクション描画
 */
function renderHealthSections(health: unknown): string[] {
  const sections: string[] = [""];

  // AI Providers
  if (health.providers && health.providers.length > 0) {
    sections.push(TEXT_HIERARCHY.SUBTITLE("AI Providers:"));
    health.providers.forEach((_provider: unknown) => {
      const _statusIcon =
        provider.health.status === "healthy"
          ? IconRegistry.get("SUCCESS")
          : _provider.health.status === "degraded"
            ? IconRegistry.get("WARNING")
            : IconRegistry.get("ERROR");
      const _statusColor =
        provider.health.status === "healthy"
          ? SEMANTIC_COLORS.SUCCESS
          : _provider.health.status === "degraded"
            ? SEMANTIC_COLORS.WARNING
            : SEMANTIC_COLORS.ERROR;
      sections.push(
        `  ${_statusColor(_statusIcon)} ${_provider.name}: ${_provider.health.status}`,
      );
    });
    sections.push("");
  }

  // System uptime
  if (health.uptime) {
    const _uptimeHours = Math.floor(health.uptime / 3600);
    const _uptimeMinutes = Math.floor((health.uptime % 3600) / 60);
    sections.push(TEXT_HIERARCHY.SUBTITLE("System:"));
    sections.push(`  Uptime: ${_uptimeHours}h ${_uptimeMinutes}m`);
    sections.push("");
  }

  // Recommendations
  if (health.recommendations && health.recommendations.length > 0) {
    sections.push(TEXT_HIERARCHY.SUBTITLE("Recommendations:"));
    health.recommendations.forEach((_rec: unknown) => {
      const _icon =
        rec.type === "error"
          ? IconRegistry.get("ERROR")
          : _rec.type === "warning"
            ? IconRegistry.get("WARNING")
            : IconRegistry.get("INFO");
      const _message = _rec._message || _rec;
      sections.push(`  ${_icon} ${TEXT_HIERARCHY.CAPTION(_message)}`);
    });
  }

  return sections;
}

/**
 * ヘルス状況に応じたテーマ取得
 */
function getHealthTheme(overall: string): unknown {
  switch (overall) {
    case "healthy":
      return "success";
    case "degraded":
      return "warning";
    case "error":
      return "error";
    default:
      return "_info";
  }
}

/**
 * 最適化テーブル描画
 */
function renderOptimizedTable(
  _data: unknown[],
  headers: string[],
  maxWidth: number,
): void {
  const _ensureRowStructure = (row: unknown): Record<string, unknown> => {
    if (typeof row === "object" && row !== null) {
      return row as Record<string, unknown>;
    }
    return {};
  };

  const _columnWidths = calculateOptimalColumnWidths(_data, headers, maxWidth);

  // Header
  const _headerRow = headers
    .map((header, i) =>
      TEXT_HIERARCHY.SUBTITLE(
        LayoutManager.alignText(header, _columnWidths[i] || 20),
      ),
    )
    .join("  ");
  console.log(_headerRow);

  // Separator
  console.log(
    SEMANTIC_COLORS.MUTED(LayoutManager.createSectionSeparator(maxWidth)),
  );

  // Data rows
  data.forEach((row) => {
    const _rowData = _ensureRowStructure(row);
    const _dataRow = headers
      .map((header, i) =>
        TEXT_HIERARCHY.BODY(
          LayoutManager.alignText(
            String(_rowData[header] || ""),
            _columnWidths[i] || 20,
          ),
        ),
      )
      .join("  ");
    console.log(_dataRow);
  });
}

/**
 * テーブル列幅の最適計算
 */
function calculateOptimalColumnWidths(
  _data: unknown[],
  headers: string[],
  maxWidth: number,
): number[] {
  const _totalCols = headers.length;
  const _separatorWidth = (_totalCols - 1) * 2; // '  ' separators
  const _availableWidth = maxWidth - _separatorWidth;

  // Equal width distribution
  return headers.map(() => Math.floor(_availableWidth / _totalCols));
}

export function printProgress(_message: string): void {
  console.log(
    SEMANTIC_COLORS.INFO(IconRegistry.get("LOADING")),
    TEXT_HIERARCHY.BODY(_message),
  );
}

export function printSuccess(_message: string): void {
  console.log(
    SEMANTIC_COLORS.SUCCESS(IconRegistry.get("SUCCESS")),
    TEXT_HIERARCHY.BODY(_message),
  );
}

export function printWarning(_message: string): void {
  console.log(
    SEMANTIC_COLORS.WARNING(IconRegistry.get("WARNING")),
    TEXT_HIERARCHY.BODY(_message),
  );
}

export function printError(_message: string): void {
  console.log(
    SEMANTIC_COLORS.ERROR(IconRegistry.get("ERROR")),
    TEXT_HIERARCHY.BODY(_message),
  );
}

export function printInfo(_message: string): void {
  console.log(
    SEMANTIC_COLORS.INFO(IconRegistry.get("INFO")),
    TEXT_HIERARCHY.BODY(_message),
  );
}

export function formatTable(_data: unknown[], headers: string[]): void {
  const _layout = LayoutManager.getOptimalLayout();
  renderOptimizedTable(_data, headers, _layout.contentWidth);
}
