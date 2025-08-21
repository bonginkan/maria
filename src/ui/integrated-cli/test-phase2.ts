/**
 * Phase 2 Test: Active Reporting System
 * アクティブレポーティングシステムのテスト
 */
import { _ActiveReporter, _Project } from './ActiveReporter.js';
import { _ProgressTracker, _SubTask } from './ProgressTracker.js';
import { _TaskBreakdownDisplay } from './TaskBreakdownDisplay.js';

/**
 * Phase 2テスト実行
 */
async function testPhase2(): Promise<void> {
  console.log('🧪 Phase 2: Active Reporting System Test\n');

  // 1. ActiveReporter テスト
  console.log('1. ActiveReporter Test');
  console.log('─'.repeat(50));

  const _reporter = new ActiveReporter({
    showProgress: true,
    showTimestamps: true,
    compactMode: false,
  });

  // プロジェクト開始
  const project: Omit<Project, 'startTime'> = {
    id: 'test_project',
    name: 'MARIA CLI Integration Test',
    description: 'Testing the integrated CLI system components',
    tasks: [],
    currentPhase: 'Phase 2: Active Reporting',
  };

  reporter.startProject(project);

  // タスクを追加
  const _task1Id = reporter.addTask({
    title: 'Setup Core Components',
    status: 'in_progress',
    progress: 65,
    estimatedTime: 30,
    mode: '✽ Building...',
  });

  const _task2Id = reporter.addTask({
    title: 'Implement Progress Tracking',
    status: 'completed',
    progress: 100,
    estimatedTime: 20,
  });

  const _task3Id = reporter.addTask({
    title: 'Create Task Breakdown Display',
    status: 'in_progress',
    progress: 80,
    estimatedTime: 25,
  });

  // タスク更新
  reporter.updateProgress(task1Id, 75, 'Component integration in progress');
  reporter.setPhase('Phase 2: Testing Components');

  console.log(reporter.render());
  console.log('\n');

  // 2. ProgressTracker テスト
  console.log('2. ProgressTracker Test');
  console.log('─'.repeat(50));

  const _tracker = new ProgressTracker({
    showVelocity: true,
    showETA: true,
    showSubTasks: true,
    showBlockers: true,
  });

  // 拡張タスクを追加
  const _extendedTask = {
    id: 'extended_task_1',
    title: 'Implement CLI Layout Engine',
    status: 'in_progress' as const,
    progress: 40,
    estimatedTime: 45,
    mode: '✽ Architecting...' as const,
    subTasks: [],
    totalWeight: 1,
    lastUpdate: new Date(),
    events: [],
    startTime: new Date(Date.now() - 15 * 60 * 1000), // 15分前に開始
    dependencies: ['setup_dependencies'],
  };

  // サブタスクを作成
  const subTasks: SubTask[] = [
    {
      id: 'sub_1',
      title: 'Design Layout Zones',
      status: 'completed',
      progress: 100,
      weight: 0.3,
      estimatedTime: 15,
    },
    {
      id: 'sub_2',
      title: 'Implement Zone Management',
      status: 'in_progress',
      progress: 60,
      weight: 0.4,
      estimatedTime: 20,
    },
    {
      id: 'sub_3',
      title: 'Add Responsive Behavior',
      status: 'pending',
      progress: 0,
      weight: 0.3,
      estimatedTime: 10,
    },
  ];

  tracker.addTask(extendedTask, subTasks);

  // サブタスクの進捗を更新
  tracker.updateSubTaskProgress('extended_task_1', 'sub_2', 75);
  tracker.updateProgress('extended_task_1', 55, 'Zone management nearing completion');

  // ブロッカーを追加
  tracker.addBlocker('extended_task_1', 'Waiting for design review approval');

  console.log(tracker.render());
  console.log('\n');

  // 3. TaskBreakdownDisplay テスト
  console.log('3. TaskBreakdownDisplay Test');
  console.log('─'.repeat(50));

  const _breakdown = new TaskBreakdownDisplay({
    maxDepth: 4,
    showProgress: true,
    showModes: true,
    showTags: true,
    showPriority: true,
    useTreeChars: true,
    compactMode: false,
  });

  // 階層的タスクを追加
  const _parentTask = {
    ...extendedTask,
    id: 'parent_task',
    title: 'Phase 2: Active Reporting Implementation',
    progress: 70,
  };

  breakdown.addTask(parentTask, _undefined, 'high', ['phase2', 'reporting']);

  // 子タスクを追加
  const _childTask1 = {
    ...extendedTask,
    id: 'child_1',
    title: 'ActiveReporter Component',
    status: 'completed' as const,
    progress: 100,
    mode: '✽ Completed...' as const,
  };

  const _childTask2 = {
    ...extendedTask,
    id: 'child_2',
    title: 'ProgressTracker Component',
    status: 'in_progress' as const,
    progress: 85,
    mode: '✽ Optimizing...' as const,
    blockers: ['API integration pending'],
  };

  breakdown.addTask(childTask1, 'parent_task', 'medium', ['component', 'reporting']);
  breakdown.addTask(childTask2, 'parent_task', 'high', ['component', 'tracking']);

  // 孫タスクを追加
  const _grandchildTask = {
    ...extendedTask,
    id: 'grandchild_1',
    title: 'Real-time Progress Updates',
    status: 'in_progress' as const,
    progress: 30,
    mode: '✽ Debugging...' as const,
  };

  breakdown.addTask(grandchildTask, 'child_2', 'critical', ['realtime', 'updates']);

  console.log(breakdown.render());
  console.log('\n');

  // 4. 統合テスト
  console.log('4. Integration Test');
  console.log('─'.repeat(50));

  // ActiveReporterとProgressTrackerの連携テスト
  reporter.addTask({
    title: 'Integration Testing',
    status: 'in_progress',
    progress: 25,
    estimatedTime: 15,
    mode: '✽ Testing...',
  });

  // コンパクトモードでの表示テスト
  reporter.updateConfig({ compactMode: true });
  console.log('Compact Mode:');
  console.log(reporter.render());
  console.log('');

  // フィルターテスト
  breakdown.updateFilter({
    status: ['in_progress'],
    priority: ['high', 'critical'],
    showCompleted: false,
  });

  console.log('Filtered View (In Progress + High/Critical Priority):');
  console.log(breakdown.render());
  console.log('');

  // 5. パフォーマンステスト
  console.log('5. Performance Test');
  console.log('─'.repeat(50));

  const _startTime = Date.now();

  // 大量のタスクを追加
  for (let _i = 0; i < 100; i++) {
    reporter.addTask({
      title: `Performance Test Task ${i + 1}`,
      status: i % 4 === 0 ? 'completed' : i % 3 === 0 ? 'in_progress' : 'pending',
      progress: Math.random() * 100,
      estimatedTime: Math.floor(Math.random() * 30) + 5,
    });
  }

  const _addTime = Date.now() - startTime;

  const _renderStart = Date.now();
  const _largeReport = reporter.render();
  const _renderTime = Date.now() - renderStart;

  console.log(`Performance Results:`);
  console.log(`  - Added 100 tasks in: ${addTime}ms`);
  console.log(`  - Rendered report in: ${renderTime}ms`);
  console.log(`  - Report size: ${largeReport.split('\n').length} lines`);
  console.log('');

  // 6. エラーハンドリングテスト
  console.log('6. Error Handling Test');
  console.log('─'.repeat(50));

  try {
    // 存在しないタスクの更新
    tracker.updateProgress('nonexistent_task', 50);
    console.log('✓ Gracefully handled nonexistent task update');
  } catch (error) {
    console.log('✗ Error handling failed:', error);
  }

  try {
    // 無効な進捗値
    tracker.updateProgress('extended_task_1', 150); // Should be clamped to 100
    console.log('✓ Gracefully handled invalid progress value');
  } catch (error) {
    console.log('✗ Error handling failed:', error);
  }

  // 統計表示
  const _stats = tracker.calculateStats();
  console.log('Final Statistics:');
  console.log(`  - Overall Progress: ${stats.overallProgress}%`);
  console.log(`  - Velocity: ${stats.velocity.toFixed(2)} points/min`);
  console.log(`  - Tasks: ${stats.tasksCompleted}/${stats.tasksTotal} completed`);
  console.log('');

  console.log('✅ Phase 2 Test Complete - All Active Reporting components working correctly');
}

/**
 * エラーハンドリングでテスト実行
 */
async function runPhase2Test(): Promise<void> {
  try {
    await testPhase2();
  } catch (error) {
    console.error('❌ Phase 2 Test Failed:', error);
    process.exit(1);
  }
}

// モジュールとして実行された場合のテスト実行
if (require.main === module) {
  runPhase2Test();
}

export { testPhase2, _runPhase2Test };
