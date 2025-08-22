/**
 * UI Utilities - MARIA CODE 124文字幅最適化版
 * Ultra Think設計による完璧な画面表示システム
 */

// 新しいデザインシステムのインポート
import { LayoutManager } from '../ui/design-system/LayoutManager.js';
import { OptimizedBox } from '../ui/design-system/OptimizedBox.js';
import { ResponsiveRenderer } from '../ui/design-system/ResponsiveRenderer.js';
import { SEMANTIC_COLORS, TEXT_HIERARCHY } from '../ui/design-system/UnifiedColorPalette.js';
import { IconRegistry } from '../ui/design-system/MinimalIconRegistry.js';

export function printWelcome(): void {
  // Initialize responsive system
  ResponsiveRenderer.initialize();

  // Clear console for clean display
  console.clear();

  // Get optimal layout for current terminal
  const layout = LayoutManager.getOptimalLayout();

  // Render MARIA CODE header with brand colors
  renderMARIAHeader(layout);

  // Show interactive session info
  renderSessionInfo(layout);

  // Display AI services status
  renderAIServicesStatus(layout);
}

export function printStatus(health: unknown): void {
  const layout = LayoutManager.getOptimalLayout();

  // Render status with optimized layout
  OptimizedBox.withTitle(
    'System Status',
    [renderOverallStatus(health), ...renderHealthSections(health)],
    {
      theme: getHealthTheme(health.overall),
      width: layout.contentWidth,
      responsive: true,
    },
  );

  // Show timestamp
  if (health.timestamp || health.lastUpdate) {
    const timestamp = health.timestamp || health.lastUpdate;
    const timeStr =
      timestamp instanceof Date ? timestamp.toLocaleString() : new Date(timestamp).toLocaleString();
    console.log('');
    console.log(TEXT_HIERARCHY.CAPTION(`Last updated: ${timeStr}`));
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
 * MARIA CODEヘッダー描画（ブランドロゴ対応）
 */
function renderMARIAHeader(layout: unknown): void {
  const headerContent = [
    'MARIA CODE',
    'AI-Powered Development Platform',
    '(c) 2025 Bonginkan Inc.',
  ];

  OptimizedBox.brand(headerContent, {
    width: layout.contentWidth,
    title: '',
    padding: 'large',
    responsive: true,
  });

  console.log('');
}

/**
 * セッション情報表示
 */
function renderSessionInfo(layout: unknown): void {
  const info = [
    LayoutManager.alignText(
      'Welcome to MARIA CODE Interactive Chat',
      layout.contentWidth,
      'center',
    ),
    '',
    `${SEMANTIC_COLORS.SUCCESS('40+ Slash Commands Available')} ${TEXT_HIERARCHY.CAPTION('- Type')} ${SEMANTIC_COLORS.WARNING('/help')} ${TEXT_HIERARCHY.CAPTION('to see all')}`,
    TEXT_HIERARCHY.CAPTION('Type anytime to interrupt current processing'),
    '',
    TEXT_HIERARCHY.BODY('You can:'),
    `${TEXT_HIERARCHY.CAPTION('• ')}Type naturally for AI assistance`,
    `${TEXT_HIERARCHY.CAPTION('• ')}Use slash commands for specific actions`,
    `${TEXT_HIERARCHY.CAPTION('• ')}Interrupt anytime with new instructions`,
    '',
    `${TEXT_HIERARCHY.CAPTION('Examples: ')}${SEMANTIC_COLORS.WARNING('/code')}, ${SEMANTIC_COLORS.WARNING('/test')}, ${SEMANTIC_COLORS.WARNING('/review')}, ${SEMANTIC_COLORS.WARNING('/video')}, ${SEMANTIC_COLORS.WARNING('/image')}`,
  ];

  info.forEach((line) => console.log(line));
  console.log('');
}

/**
 * AI サービス状況表示（最適化版）
 */
function renderAIServicesStatus(layout: unknown): void {
  console.log(TEXT_HIERARCHY.SUBTITLE('Available AI Services:'));
  console.log(SEMANTIC_COLORS.MUTED(LayoutManager.createSectionSeparator(layout.contentWidth)));

  // Cloud AI services
  renderCloudAIStatus();

  console.log('');

  // Local AI services
  renderLocalAIStatus();

  console.log(SEMANTIC_COLORS.MUTED(LayoutManager.createSectionSeparator(layout.contentWidth)));
  console.log('');
}

/**
 * Cloud AI サービス状況
 */
function renderCloudAIStatus(): void {
  console.log(TEXT_HIERARCHY.SECTION('Cloud AI (Ready Now):'));

  const services = [
    { key: 'OPENAI_API_KEY', name: 'OpenAI', models: 'GPT-5, GPT-4' },
    { key: 'ANTHROPIC_API_KEY', name: 'Anthropic', models: 'Claude Opus 4.1' },
    { key: 'GOOGLE_AI_API_KEY', name: 'Google AI', models: 'Gemini 2.5 Pro' },
  ];

  let hasAnyAPI = false;

  services.forEach((service) => {
    if (process.env[service.key]) {
      const status = SEMANTIC_COLORS.SUCCESS(IconRegistry.get('SUCCESS'));
      const name = TEXT_HIERARCHY.BODY(service.name.padEnd(12));
      const models = TEXT_HIERARCHY.CAPTION(`(${service.models})`);
      console.log(`  ${status} ${name} ${models}`);
      hasAnyAPI = true;
    }
  });

  if (!hasAnyAPI) {
    const status = SEMANTIC_COLORS.WARNING(IconRegistry.get('WARNING'));
    console.log(`  ${status} ${TEXT_HIERARCHY.CAPTION('No cloud APIs configured')}`);
  }
}

/**
 * Local AI サービス状況
 */
function renderLocalAIStatus(): void {
  console.log(TEXT_HIERARCHY.SECTION('Local AI (Checking):'));

  const localServices = [
    { name: 'LM Studio', status: 'Auto-detecting...' },
    { name: 'Ollama', status: 'Auto-detecting...' },
    { name: 'vLLM', status: 'Auto-detecting...' },
  ];

  localServices.forEach((service) => {
    const status = SEMANTIC_COLORS.MUTED(IconRegistry.get('LOADING'));
    const name = TEXT_HIERARCHY.BODY(service.name.padEnd(12));
    const statusText = TEXT_HIERARCHY.CAPTION(`(${service.status})`);
    console.log(`  ${status} ${name} ${statusText}`);
  });
}

/**
 * ヘルス状況の全体ステータス描画
 */
function renderOverallStatus(health: unknown): string {
  const statusIcon =
    health.overall === 'healthy'
      ? IconRegistry.get('SUCCESS')
      : health.overall === 'degraded'
        ? IconRegistry.get('WARNING')
        : IconRegistry.get('ERROR');

  const statusColor =
    health.overall === 'healthy'
      ? SEMANTIC_COLORS.SUCCESS
      : health.overall === 'degraded'
        ? SEMANTIC_COLORS.WARNING
        : SEMANTIC_COLORS.ERROR;

  return statusColor(`${statusIcon} Overall Status: ${health.overall.toUpperCase()}`);
}

/**
 * ヘルス状況のセクション描画
 */
function renderHealthSections(health: unknown): string[] {
  const sections: string[] = [''];

  // AI Providers
  if (health.providers && health.providers.length > 0) {
    sections.push(TEXT_HIERARCHY.SUBTITLE('AI Providers:'));
    health.providers.forEach((provider: unknown) => {
      const statusIcon =
        provider.health.status === 'healthy'
          ? IconRegistry.get('SUCCESS')
          : provider.health.status === 'degraded'
            ? IconRegistry.get('WARNING')
            : IconRegistry.get('ERROR');
      const statusColor =
        provider.health.status === 'healthy'
          ? SEMANTIC_COLORS.SUCCESS
          : provider.health.status === 'degraded'
            ? SEMANTIC_COLORS.WARNING
            : SEMANTIC_COLORS.ERROR;
      sections.push(`  ${statusColor(statusIcon)} ${provider.name}: ${provider.health.status}`);
    });
    sections.push('');
  }

  // System uptime
  if (health.uptime) {
    const uptimeHours = Math.floor(health.uptime / 3600);
    const uptimeMinutes = Math.floor((health.uptime % 3600) / 60);
    sections.push(TEXT_HIERARCHY.SUBTITLE('System:'));
    sections.push(`  Uptime: ${uptimeHours}h ${uptimeMinutes}m`);
    sections.push('');
  }

  // Recommendations
  if (health.recommendations && health.recommendations.length > 0) {
    sections.push(TEXT_HIERARCHY.SUBTITLE('Recommendations:'));
    health.recommendations.forEach((rec: unknown) => {
      const icon =
        rec.type === 'error'
          ? IconRegistry.get('ERROR')
          : rec.type === 'warning'
            ? IconRegistry.get('WARNING')
            : IconRegistry.get('INFO');
      const message = rec.message || rec;
      sections.push(`  ${icon} ${TEXT_HIERARCHY.CAPTION(message)}`);
    });
  }

  return sections;
}

/**
 * ヘルス状況に応じたテーマ取得
 */
function getHealthTheme(overall: string): unknown {
  switch (overall) {
    case 'healthy':
      return 'success';
    case 'degraded':
      return 'warning';
    case 'error':
      return 'error';
    default:
      return 'info';
  }
}

/**
 * 最適化テーブル描画
 */
function renderOptimizedTable(data: unknown[], headers: string[], maxWidth: number): void {
  const ensureRowStructure = (row: unknown): Record<string, unknown> => {
    if (typeof row === 'object' && row !== null) {
      return row as Record<string, unknown>;
    }
    return {};
  };

  const columnWidths = calculateOptimalColumnWidths(data, headers, maxWidth);

  // Header
  const headerRow = headers
    .map((header, i) =>
      TEXT_HIERARCHY.SUBTITLE(LayoutManager.alignText(header, columnWidths[i] || 20)),
    )
    .join('  ');
  console.log(headerRow);

  // Separator
  console.log(SEMANTIC_COLORS.MUTED(LayoutManager.createSectionSeparator(maxWidth)));

  // Data rows
  data.forEach((row) => {
    const rowData = ensureRowStructure(row);
    const dataRow = headers
      .map((header, i) =>
        TEXT_HIERARCHY.BODY(
          LayoutManager.alignText(String(rowData[header] || ''), columnWidths[i] || 20),
        ),
      )
      .join('  ');
    console.log(dataRow);
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
  const totalCols = headers.length;
  const separatorWidth = (totalCols - 1) * 2; // '  ' separators
  const availableWidth = maxWidth - separatorWidth;

  // Equal width distribution
  return headers.map(() => Math.floor(availableWidth / totalCols));
}

export function printProgress(message: string): void {
  console.log(SEMANTIC_COLORS.INFO(IconRegistry.get('LOADING')), TEXT_HIERARCHY.BODY(message));
}

export function printSuccess(message: string): void {
  console.log(SEMANTIC_COLORS.SUCCESS(IconRegistry.get('SUCCESS')), TEXT_HIERARCHY.BODY(message));
}

export function printWarning(message: string): void {
  console.log(SEMANTIC_COLORS.WARNING(IconRegistry.get('WARNING')), TEXT_HIERARCHY.BODY(message));
}

export function printError(message: string): void {
  console.log(SEMANTIC_COLORS.ERROR(IconRegistry.get('ERROR')), TEXT_HIERARCHY.BODY(message));
}

export function printInfo(message: string): void {
  console.log(SEMANTIC_COLORS.INFO(IconRegistry.get('INFO')), TEXT_HIERARCHY.BODY(message));
}

export function formatTable(data: unknown[], headers: string[]): void {
  const layout = LayoutManager.getOptimalLayout();
  renderOptimizedTable(data, headers, layout.contentWidth);
}
