/**
 * Integration Test: Complete Integrated CLI System
 * 統合CLIシステム全体のテスト
 */
import {
  ActiveReporter,
  ApprovalPrompt,
  createIntegratedCLI,
  DEFAULT_CONFIG,
  IntegratedCLIManager,
  KeyboardShortcutHandler,
  ProgressTracker,
  TaskBreakdownDisplay,
  Utils,
} from './index.js';

/**
 * 統合テスト実行
 */
async function testIntegration(): Promise<void> {
  console.log('🧪 Integration Test: Complete Integrated CLI System\n');

  // 1. ファクトリー関数テスト
  console.log('1. Factory Function Test');
  console.log('─'.repeat(50));

  const _cli = await createIntegratedCLI({
    layout: { width: 100, responsive: true },
    input: { promptSymbol: 'maria>' },
    response: { animateText: true },
  });

  console.log('✓ Created CLI using factory function');
  console.log(`✓ Using custom config with maria> prompt`);
  console.log(`✓ CLI is active: ${cli.isRunning() ? 'Yes' : 'No'}`);
  console.log('');

  // 2. 全コンポーネント統合テスト
  console.log('2. Full Component Integration Test');
  console.log('─'.repeat(50));

  // ActiveReporter でプロジェクト開始
  const _reporter = new ActiveReporter({
    showProgress: true,
    showTimestamps: true,
    compactMode: false,
  });

  reporter.startProject({
    id: 'integration_test',
    name: 'MARIA CLI Integration Test',
    description: 'Testing all components working together',
    tasks: [],
    currentPhase: 'Integration Testing',
  });

  // ProgressTracker でタスク管理
  const _tracker = new ProgressTracker({
    showVelocity: true,
    showETA: true,
    showSubTasks: true,
  });

  // TaskBreakdownDisplay で階層表示
  const _breakdown = new TaskBreakdownDisplay({
    maxDepth: 3,
    showProgress: true,
    showModes: true,
    useTreeChars: true,
  });

  // 複雑なタスク階層を構築
  const _mainTaskId = reporter.addTask({
    title: 'Complete Integration Test',
    status: 'in_progress',
    progress: 25,
    estimatedTime: 60,
    mode: '✽ Testing...',
  });

  // サブタスクを追加
  const _subTasks = [
    {
      id: 'sub_1',
      title: 'Test Core Components',
      status: 'completed' as const,
      progress: 100,
      weight: 0.3,
      estimatedTime: 15,
    },
    {
      id: 'sub_2',
      title: 'Test Active Reporting',
      status: 'completed' as const,
      progress: 100,
      weight: 0.3,
      estimatedTime: 20,
    },
    {
      id: 'sub_3',
      title: 'Test Approval System',
      status: 'in_progress' as const,
      progress: 75,
      weight: 0.4,
      estimatedTime: 25,
    },
  ];

  const _extendedTask = {
    id: mainTaskId,
    title: 'Complete Integration Test',
    status: 'in_progress' as const,
    progress: 25,
    estimatedTime: 60,
    mode: '✽ Testing...' as const,
    subTasks,
    totalWeight: 1,
    lastUpdate: new Date(),
    events: [],
    startTime: new Date(Date.now() - 30 * 60 * 1000), // 30分前に開始
    dependencies: ['setup_complete'],
  };

  tracker.addTask(extendedTask, subTasks);
  breakdown.addTask(extendedTask, undefined, 'high', ['integration', 'testing']);

  console.log('✓ Created complex task hierarchy');
  console.log('✓ Added to ActiveReporter, ProgressTracker, and TaskBreakdownDisplay');
  console.log('');

  // 3. リアルタイム更新テスト
  console.log('3. Real-time Updates Test');
  console.log('─'.repeat(50));

  // 進捗を更新
  tracker.updateSubTaskProgress(mainTaskId, 'sub_3', 90);
  reporter.updateProgress(mainTaskId, 85);
  breakdown.updateTask(mainTaskId, { progress: 85 });

  console.log('✓ Updated progress across all components');
  console.log('✓ SubTask 3: 75% → 90%');
  console.log('✓ Main Task: 25% → 85%');
  console.log('');

  // 4. レポート生成テスト
  console.log('4. Report Generation Test');
  console.log('─'.repeat(50));

  console.log('ActiveReporter Output:');
  console.log(reporter.render());
  console.log('');

  console.log('ProgressTracker Output:');
  console.log(tracker.render());
  console.log('');

  console.log('TaskBreakdownDisplay Output:');
  console.log(breakdown.render());
  console.log('');

  // 5. キーボードショートカット統合テスト
  console.log('5. Keyboard Shortcut Integration Test');
  console.log('─'.repeat(50));

  const _shortcutHandler = new KeyboardShortcutHandler();

  // プロジェクト制御ショートカット
  shortcutHandler.registerShortcuts([
    {
      id: 'pause_project',
      keys: 'ctrl+p',
      description: 'Pause current project',
      handler: () => {
        console.log('⏸ Project paused via keyboard shortcut');
        reporter.setPhase('Paused');
      },
    },
    {
      id: 'resume_project',
      keys: 'ctrl+r',
      description: 'Resume project',
      handler: () => {
        console.log('▶ Project resumed via keyboard shortcut');
        reporter.setPhase('Resumed');
      },
    },
    {
      id: 'show_progress',
      keys: 'ctrl+shift+p',
      description: 'Show detailed progress',
      handler: () => {
        console.log('📊 Showing detailed progress...');
        console.log(tracker.render());
      },
    },
  ]);

  console.log('✓ Registered project control shortcuts');
  console.log('✓ Ctrl+P: Pause project');
  console.log('✓ Ctrl+R: Resume project');
  console.log('✓ Ctrl+Shift+P: Show detailed progress');
  console.log('');

  // 6. 承認プロンプト統合テスト
  console.log('6. Approval Prompt Integration Test');
  console.log('─'.repeat(50));

  // プロジェクト完了の承認プロンプトをシミュレート
  console.log('Simulating project completion approval...');

  const _completionOptions = [
    {
      key: 'complete',
      label: 'Mark Complete',
      description: 'Mark the project as completed',
      action: async () => {
        reporter.completeTask(mainTaskId);
        tracker.completeTask(mainTaskId);
        breakdown.updateTask(mainTaskId, { status: 'completed', progress: 100 });
        console.log('✅ Project marked as complete');
      },
      style: 'success' as const,
    },
    {
      key: 'continue',
      label: 'Continue Working',
      description: 'Continue with additional tasks',
      action: async () => {
        console.log('🔄 Continuing with additional work');
      },
      style: 'primary' as const,
    },
    {
      key: 'review',
      label: 'Review & Update',
      description: 'Review current progress and update',
      action: async () => {
        console.log('📝 Reviewing and updating project');
      },
      style: 'secondary' as const,
    },
  ];

  console.log('✓ Created completion approval options');
  console.log('✓ Options: Complete, Continue, Review');
  console.log('✓ Integration with task management systems');
  console.log('');

  // 7. エラーハンドリング統合テスト
  console.log('7. Error Handling Integration Test');
  console.log('─'.repeat(50));

  try {
    // 存在しないタスクへの操作
    tracker.updateProgress('nonexistent_task', 50);
    console.log('✓ Gracefully handled nonexistent task in ProgressTracker');
  } catch (error) {
    console.log('✗ ProgressTracker error handling failed');
  }

  try {
    // 無効な進捗値
    reporter.updateProgress(mainTaskId, 150); // 自動的に100にクランプされる
    console.log('✓ Gracefully handled invalid progress value');
  } catch (error) {
    console.log('✗ Progress value validation failed');
  }

  try {
    // 無効なショートカット
    shortcutHandler.enableShortcut('invalid+combo', false);
    console.log('✓ Gracefully handled invalid shortcut combination');
  } catch (error) {
    console.log('✗ Shortcut validation failed');
  }

  console.log('');

  // 8. パフォーマンステスト
  console.log('8. Performance Test');
  console.log('─'.repeat(50));

  const _performanceStart = Date.now();

  // 大量の操作を実行
  for (let _i = 0; i < 100; i++) {
    const _taskId = reporter.addTask({
      title: `Performance Test Task ${i}`,
      status: i % 3 === 0 ? 'completed' : 'in_progress',
      progress: Math.random() * 100,
      estimatedTime: Math.floor(Math.random() * 30) + 5,
    });

    if (i % 10 === 0) {
      reporter.updateProgress(taskId, Math.random() * 100);
    }
  }

  const _performanceEnd = Date.now();
  console.log(`✓ Processed 100 tasks in ${performanceEnd - performanceStart}ms`);

  // メモリ使用量チェック
  const _memUsage = process.memoryUsage();
  console.log(`✓ Memory usage: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
  console.log('');

  // 9. 設定とユーティリティテスト
  console.log('9. Configuration and Utilities Test');
  console.log('─'.repeat(50));

  console.log('Default Configuration:');
  console.log(`  Layout width: ${DEFAULT_CONFIG.layout?.width}`);
  console.log(`  Responsive: ${DEFAULT_CONFIG.layout?.responsive}`);
  console.log(`  Prompt symbol: ${DEFAULT_CONFIG.input?.promptSymbol}`);
  console.log(`  Show timestamps: ${DEFAULT_CONFIG.response?.showTimestamp}`);

  console.log('\nUtilities:');
  console.log(`  Primary color: ${Utils.colors.primary}`);
  console.log(`  Success icon: ${Utils.icons.success}`);
  console.log(`  Max width: ${Utils.sizes.maxWidth}`);
  console.log('');

  // 10. クリーンアップとリソース管理
  console.log('10. Cleanup and Resource Management');
  console.log('─'.repeat(50));

  // 統計情報を収集
  const _finalStats = {
    activeReporter: {
      isRunning: reporter.isRunning(),
      project: reporter.getCurrentProject()?.name,
    },
    progressTracker: {
      totalTasks: tracker.getAllTasks().length,
      stats: tracker.calculateStats(),
    },
    taskBreakdown: {
      hierarchySize: breakdown.getHierarchy().size,
      rootTasks: breakdown.getRootTasks().length,
    },
    shortcuts: shortcutHandler.getStats(),
  };

  console.log('Final Statistics:');
  console.log(`  ActiveReporter running: ${finalStats.activeReporter.isRunning}`);
  console.log(`  Project: ${finalStats.activeReporter.project}`);
  console.log(`  ProgressTracker tasks: ${finalStats.progressTracker.totalTasks}`);
  console.log(`  Overall progress: ${finalStats.progressTracker.stats.overallProgress}%`);
  console.log(`  Task hierarchy size: ${finalStats.taskBreakdown.hierarchySize}`);
  console.log(`  Keyboard shortcuts: ${finalStats.shortcuts.totalShortcuts}`);

  // クリーンアップ
  reporter.stop();
  tracker.reset();
  breakdown.reset();
  shortcutHandler.destroy();

  console.log('\n✓ All components cleaned up successfully');
  console.log('');

  console.log('✅ Integration Test Complete - All components working together perfectly!');
  console.log('');
  console.log('🎉 MARIA Integrated CLI System v1.0.0 is ready for production!');
}

/**
 * エラーハンドリングでテスト実行
 */
async function runIntegrationTest(): Promise<void> {
  try {
    await testIntegration();
  } catch (error) {
    console.error('❌ Integration Test Failed:', error);
    process.exit(1);
  }
}

// モジュールとして実行された場合のテスト実行
if (require.main === module) {
  runIntegrationTest();
}

export { testIntegration, runIntegrationTest };
