/**
 * UI Showcase - MARIA CODE 124文字幅デザインシステム
 * すべての最適化されたUIコンポーネントのデモンストレーション
 */

import { OptimizedAnimations, TransitionEffects } from '../animations/OptimizedAnimations.js';
import { StatusBarRenderer, SystemStatus } from '../components/StatusBarRenderer.js';
import { OptimizedProgress } from '../components/OptimizedProgress.js';
import { OptimizedTable } from '../components/OptimizedTable.js';
import { OptimizedComponents, UNIFIED_COLORS, TEXT_HIERARCHY } from '../optimized-design-system.js';

/**
 * UIショーケースを実行
 */
async function runShowcase() {
  console.clear();

  // 1. Welcome with typewriter effect
  await showWelcome();
  await delay(1000);

  // 2. Status bar demonstrations
  await showStatusBars();
  await delay(1000);

  // 3. Progress displays
  await showProgressBars();
  await delay(1000);

  // 4. Table displays
  await showTables();
  await delay(1000);

  // 5. Animation effects
  await showAnimations();
  await delay(1000);

  // 6. Complete
  showComplete();
}

/**
 * ウェルカムセクション
 */
async function showWelcome() {
  console.log('\n');

  // MARIA CODE header with brand styling
  OptimizedComponents.renderBox(
    [
      'MARIA CODE v1.3.0',
      '124-Character Optimized Design System',
      'Ultra-responsive CLI Experience',
    ],
    {
      width: 124,
      padding: 3,
      style: 'heavy',
      color: UNIFIED_COLORS.PRIMARY,
    },
  );

  console.log('\n');

  // Typewriter introduction
  await OptimizedAnimations.typewriter(
    'Welcome to the MARIA CODE UI Showcase - Experience the future of CLI design',
    { speed: 30, color: TEXT_HIERARCHY.SUBTITLE },
  );

  console.log('\n');
}

/**
 * ステータスバーデモ
 */
async function showStatusBars() {
  OptimizedComponents.renderSectionHeader('Status Bar Components');
  console.log('\n');

  const status: SystemStatus = {
    mode: 'interactive',
    aiProvider: 'OpenAI',
    modelName: 'GPT-5',
    activeConnections: 3,
    memoryUsage: 45,
    cpuUsage: 23,
    responseTime: 142,
    timestamp: new Date(),
  };

  // Standard status bar
  console.log(TEXT_HIERARCHY.CAPTION('Standard Status Bar:'));
  StatusBarRenderer.render(status, {
    showTime: true,
    showMemory: true,
  });
  console.log('\n');

  // Compact status bar
  console.log(TEXT_HIERARCHY.CAPTION('Compact Status Bar:'));
  StatusBarRenderer.renderCompact(status);
  console.log('\n');

  // Mini status bar
  console.log(TEXT_HIERARCHY.CAPTION('Mini Status Bar:'));
  StatusBarRenderer.renderMini(status);
  console.log('\n');

  // With progress
  console.log(TEXT_HIERARCHY.CAPTION('Status Bar with Progress:'));
  StatusBarRenderer.renderWithProgress(status, 67, 'Processing');
  console.log('\n');
}

/**
 * プログレスバーデモ
 */
async function showProgressBars() {
  OptimizedComponents.renderSectionHeader('Progress Components');
  console.log('\n');

  // Standard progress bar
  console.log(TEXT_HIERARCHY.CAPTION('Standard Progress Bar:'));
  for (let i = 0; i <= 100; i += 10) {
    OptimizedProgress.renderBar(i, 100, {
      label: 'Downloading',
      showTime: true,
    });
    await delay(100);
  }
  console.log('\n\n');

  // Dots progress
  console.log(TEXT_HIERARCHY.CAPTION('Dots Progress:'));
  for (let i = 0; i <= 10; i++) {
    OptimizedProgress.renderDots(i, 10, {
      label: 'Loading modules',
    });
    await delay(200);
  }
  console.log('\n\n');

  // Steps progress
  console.log(TEXT_HIERARCHY.CAPTION('Step Progress:'));
  const steps = ['Initialize', 'Configure', 'Build', 'Deploy', 'Complete'];
  for (let i = 1; i <= steps.length; i++) {
    console.clear();
    OptimizedProgress.renderSteps(i, steps.length, steps, { compact: false });
    await delay(500);
  }
  console.log('\n');

  // Multi-task progress
  console.log(TEXT_HIERARCHY.CAPTION('Multi-task Progress:'));
  const tasks = [
    { name: 'Core Module', current: 85, total: 100, status: 'running' as const },
    { name: 'Dependencies', current: 100, total: 100, status: 'completed' as const },
    { name: 'Assets', current: 45, total: 100, status: 'running' as const },
    { name: 'Documentation', current: 0, total: 100, status: 'pending' as const },
  ];
  OptimizedProgress.renderMultiTask(tasks);
  console.log('\n');
}

/**
 * テーブルデモ
 */
async function showTables() {
  OptimizedComponents.renderSectionHeader('Table Components');
  console.log('\n');

  const data = [
    { name: 'GPT-5', provider: 'OpenAI', status: 'Active', latency: '142ms' },
    { name: 'Claude Opus', provider: 'Anthropic', status: 'Active', latency: '189ms' },
    { name: 'Gemini Pro', provider: 'Google', status: 'Ready', latency: '231ms' },
    { name: 'LM Studio', provider: 'Local', status: 'Offline', latency: 'N/A' },
  ];

  // Light border table
  console.log(TEXT_HIERARCHY.CAPTION('Light Border Table:'));
  OptimizedTable.render(data, undefined, {
    border: 'light',
    highlightHeader: true,
    responsive: true,
  });
  console.log('\n');

  // Heavy border table
  console.log(TEXT_HIERARCHY.CAPTION('Heavy Border Table:'));
  OptimizedTable.render(data.slice(0, 2), undefined, {
    border: 'heavy',
    alignment: 'center',
  });
  console.log('\n');

  // Rounded border table
  console.log(TEXT_HIERARCHY.CAPTION('Rounded Border Table:'));
  OptimizedTable.render(data.slice(0, 2), undefined, {
    border: 'rounded',
    zebra: true,
  });
  console.log('\n');

  // Vertical table
  console.log(TEXT_HIERARCHY.CAPTION('Vertical Table:'));
  OptimizedTable.renderVertical(data[0]);
  console.log('\n');

  // Grid layout
  console.log(TEXT_HIERARCHY.CAPTION('Grid Layout:'));
  const items = ['React', 'Vue', 'Angular', 'Svelte', 'Next.js', 'Nuxt'];
  OptimizedTable.renderGrid(items, 3);
  console.log('\n');
}

/**
 * アニメーションデモ
 */
async function showAnimations() {
  OptimizedComponents.renderSectionHeader('Animation Effects');
  console.log('\n');

  // Spinner
  console.log(TEXT_HIERARCHY.CAPTION('Spinner Animation:'));
  const spinner = OptimizedAnimations.spinner('Processing request');
  await delay(2000);
  spinner.update('Almost done');
  await delay(1000);
  spinner.stop(true);
  console.log('\n');

  // Loading dots
  console.log(TEXT_HIERARCHY.CAPTION('Loading Dots:'));
  const dots = OptimizedAnimations.loadingDots('Connecting to server');
  await delay(2000);
  dots.stop(true);
  console.log('\n');

  // Wave animation
  console.log(TEXT_HIERARCHY.CAPTION('Wave Animation:'));
  const wave = OptimizedAnimations.waveAnimation('Analyzing code');
  await delay(2000);
  wave.stop(true);
  console.log('\n');

  // Pulse effect
  console.log(TEXT_HIERARCHY.CAPTION('Pulse Effect:'));
  await OptimizedAnimations.pulse('MARIA CODE', 3, {
    color: UNIFIED_COLORS.ACCENT,
  });
  console.log('\n');

  // Slide in
  console.log(TEXT_HIERARCHY.CAPTION('Slide In Effect:'));
  await OptimizedAnimations.slideIn('Revolutionary CLI Experience');
  console.log('\n');

  // Fade in
  console.log(TEXT_HIERARCHY.CAPTION('Fade In Effect:'));
  await OptimizedAnimations.fadeIn([
    'Line 1: Initializing system',
    'Line 2: Loading configurations',
    'Line 3: Ready to start',
  ]);
  console.log('\n');

  // Countdown
  console.log(TEXT_HIERARCHY.CAPTION('Countdown:'));
  await OptimizedAnimations.countdown(3, 'Demo completes in');
  console.log('\n');
}

/**
 * 完了メッセージ
 */
function showComplete() {
  console.log('\n');

  OptimizedComponents.renderBox(
    [
      'UI Showcase Complete!',
      '',
      'The MARIA CODE 124-character optimized design system',
      'provides a revolutionary CLI experience with:',
      '',
      '• Responsive layouts (80-200 character support)',
      '• Unified color system (7 semantic colors)',
      '• Minimal icon set (6 core symbols)',
      '• Smooth animations and transitions',
      '• Optimized performance (<50ms rendering)',
      '',
      'Experience the future of command-line interfaces.',
    ],
    {
      width: 124,
      padding: 3,
      style: 'heavy',
      color: UNIFIED_COLORS.SUCCESS,
    },
  );

  console.log('\n');
  OptimizedComponents.renderStatus('success', 'Thank you for exploring MARIA CODE!');
  console.log('\n');
}

/**
 * 遅延ユーティリティ
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Run showcase if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runShowcase().catch(console.error);
}

export { runShowcase };
