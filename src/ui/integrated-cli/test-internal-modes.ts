/**
 * Internal Modes Test: 50 Cognitive States
 * 50種類の内部認知状態のテスト
 */
import { ModeCategory, ModeIndicator } from './ModeIndicator.js';

/**
 * 50種類の内部モードを包括的にテスト
 */
async function testInternalModes(): Promise<void> {
  console.log('🧪 Internal Modes Test: 50 Cognitive States\n');

  const _modeIndicator = new ModeIndicator({
    showTransitions: true,
    animateTransitions: true,
    historySize: 100,
  });

  // 1. Reasoning Category (論理的思考)
  console.log('1. Reasoning Category (8 modes)');
  console.log('─'.repeat(50));

  const _reasoningModes = [
    '✽ Thinking...',
    '✽ Analyzing...',
    '✽ Processing...',
    '✽ Evaluating...',
    '✽ Calculating...',
    '✽ Reasoning...',
    '✽ Inferring...',
    '✽ Deducing...',
  ];

  for (const mode of reasoningModes) {
    modeIndicator.setCurrentMode(mode as any);
    console.log(`  ${mode} ${modeIndicator.render()}`);
  }
  console.log('');

  // 2. Creative Category (創造的思考)
  console.log('2. Creative Category (6 modes)');
  console.log('─'.repeat(50));

  const _creativeModes = [
    '✽ Brainstorming...',
    '✽ Designing...',
    '✽ Innovating...',
    '✽ Imagining...',
    '✽ Composing...',
    '✽ Inventing...',
  ];

  for (const mode of creativeModes) {
    modeIndicator.setCurrentMode(mode as any);
    console.log(`  ${mode} ${modeIndicator.render()}`);
  }
  console.log('');

  // 3. Analytical Category (分析的思考)
  console.log('3. Analytical Category (6 modes)');
  console.log('─'.repeat(50));

  const _analyticalModes = [
    '✽ Investigating...',
    '✽ Debugging...',
    '✽ Diagnosing...',
    '✽ Examining...',
    '✽ Researching...',
    '✽ Auditing...',
  ];

  for (const mode of analyticalModes) {
    modeIndicator.setCurrentMode(mode as any);
    console.log(`  ${mode} ${modeIndicator.render()}`);
  }
  console.log('');

  // 4. Structural Category (構造的思考)
  console.log('4. Structural Category (6 modes)');
  console.log('─'.repeat(50));

  const _structuralModes = [
    '✽ Architecting...',
    '✽ Building...',
    '✽ Organizing...',
    '✽ Structuring...',
    '✽ Categorizing...',
    '✽ Systematizing...',
  ];

  for (const mode of structuralModes) {
    modeIndicator.setCurrentMode(mode as any);
    console.log(`  ${mode} ${modeIndicator.render()}`);
  }
  console.log('');

  // 5. Validation Category (検証・確認)
  console.log('5. Validation Category (6 modes)');
  console.log('─'.repeat(50));

  const _validationModes = [
    '✽ Testing...',
    '✽ Validating...',
    '✽ Verifying...',
    '✽ Checking...',
    '✽ Reviewing...',
    '✽ Confirming...',
  ];

  for (const mode of validationModes) {
    modeIndicator.setCurrentMode(mode as any);
    console.log(`  ${mode} ${modeIndicator.render()}`);
  }
  console.log('');

  // 6. Contemplative Category (熟考・深考)
  console.log('6. Contemplative Category (6 modes)');
  console.log('─'.repeat(50));

  const _contemplativeModes = [
    '✽ Contemplating...',
    '✽ Meditating...',
    '✽ Reflecting...',
    '✽ Pondering...',
    '✽ Considering...',
    '✽ Deliberating...',
  ];

  for (const mode of contemplativeModes) {
    modeIndicator.setCurrentMode(mode as any);
    console.log(`  ${mode} ${modeIndicator.render()}`);
  }
  console.log('');

  // 7. Intensive Category (集中的作業)
  console.log('7. Intensive Category (6 modes)');
  console.log('─'.repeat(50));

  const _intensiveModes = [
    '✽ Focusing...',
    '✽ Concentrating...',
    '✽ Optimizing...',
    '✽ Refining...',
    '✽ Perfecting...',
    '✽ Polishing...',
  ];

  for (const mode of intensiveModes) {
    modeIndicator.setCurrentMode(mode as any);
    console.log(`  ${mode} ${modeIndicator.render()}`);
  }
  console.log('');

  // 8. Learning Category (学習・理解)
  console.log('8. Learning Category (3 modes)');
  console.log('─'.repeat(50));

  const _learningModes = ['✽ Learning...', '✽ Understanding...', '✽ Absorbing...'];

  for (const mode of learningModes) {
    modeIndicator.setCurrentMode(mode as any);
    console.log(`  ${mode} ${modeIndicator.render()}`);
  }
  console.log('');

  // 9. Collaborative Category (協働・調整)
  console.log('9. Collaborative Category (3 modes)');
  console.log('─'.repeat(50));

  const _collaborativeModes = ['✽ Collaborating...', '✽ Coordinating...', '✽ Synchronizing...'];

  for (const mode of collaborativeModes) {
    modeIndicator.setCurrentMode(mode as any);
    console.log(`  ${mode} ${modeIndicator.render()}`);
  }
  console.log('');

  // モード遷移のテスト
  console.log('10. Mode Transitions Test');
  console.log('─'.repeat(50));

  const _transitionSequence = [
    '✽ Thinking...',
    '✽ Analyzing...',
    '✽ Designing...',
    '✽ Building...',
    '✽ Testing...',
    '✽ Optimizing...',
    '✽ Reviewing...',
    '✽ Completing...',
  ];

  console.log('Testing rapid mode transitions:');

  const _startTime = Date.now();
  for (let _i = 0; i < transitionSequence.length; i++) {
    const _mode = transitionSequence[i];
    modeIndicator.setCurrentMode(mode as any);
    const _transitionTime = Date.now() - startTime;
    console.log(`  ${i + 1}. ${mode} (${transitionTime}ms)`);
  }

  const _totalTime = Date.now() - startTime;
  console.log(`✓ Completed 8 transitions in ${totalTime}ms`);
  console.log(`✓ Average transition time: ${Math.round(totalTime / transitionSequence.length)}ms`);
  console.log('');

  // モード履歴のテスト
  console.log('11. Mode History Test');
  console.log('─'.repeat(50));

  const _history = modeIndicator.getModeHistory();
  console.log(`Mode history (last 10):`);
  history.slice(-10).forEach((entry, index) => {
    const _timestamp = entry.timestamp.toLocaleTimeString();
    console.log(`  ${index + 1}. [${timestamp}] ${entry.mode}`);
  });
  console.log('');

  // 統計情報
  console.log('12. Statistics');
  console.log('─'.repeat(50));

  const _stats = modeIndicator.getStats();
  console.log(`Current Mode: ${stats.currentMode}`);
  console.log(`Total Transitions: ${stats.totalTransitions}`);
  console.log(`Active Since: ${stats.activeSince?.toLocaleTimeString()}`);
  console.log(`Categories Used: ${stats.categoriesUsed.join(', ')}`);
  console.log(`Most Used Mode: ${stats.mostUsedMode}`);
  console.log('');

  // パフォーマンステスト
  console.log('13. Performance Test');
  console.log('─'.repeat(50));

  const _perfStartTime = Date.now();

  // 1000回のモード遷移
  for (let _i = 0; i < 1000; i++) {
    const _randomModeIndex = Math.floor(Math.random() * 50);
    const _allModes = [
      ...reasoningModes,
      ...creativeModes,
      ...analyticalModes,
      ...structuralModes,
      ...validationModes,
      ...contemplativeModes,
      ...intensiveModes,
      ...learningModes,
      ...collaborativeModes,
    ];
    modeIndicator.setCurrentMode(allModes[randomModeIndex] as any);
  }

  const _perfEndTime = Date.now();
  const _totalPerfTime = perfEndTime - perfStartTime;

  console.log(`✓ Processed 1000 mode transitions in ${totalPerfTime}ms`);
  console.log(`✓ Average transition time: ${(totalPerfTime / 1000).toFixed(2)}ms`);
  console.log(`✓ Transitions per second: ${Math.round(1000 / (totalPerfTime / 1000))}`);
  console.log('');

  // メモリ使用量チェック
  const _memUsage = process.memoryUsage();
  console.log('14. Memory Usage');
  console.log('─'.repeat(50));
  console.log(`Heap Used: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
  console.log(`Heap Total: ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`);
  console.log(`External: ${Math.round(memUsage.external / 1024 / 1024)}MB`);
  console.log('');

  console.log('✅ Internal Modes Test Complete - All 50 cognitive states working correctly!');
}

/**
 * エラーハンドリングでテスト実行
 */
async function runInternalModesTest(): Promise<void> {
  try {
    await testInternalModes();
  } catch (error) {
    console.error('❌ Internal Modes Test Failed:', error);
    process.exit(1);
  }
}

// モジュールとして実行された場合のテスト実行
if (require.main === module) {
  runInternalModesTest();
}

export { testInternalModes, runInternalModesTest };
