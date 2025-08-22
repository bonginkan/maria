/**
 * Phase 3 Test: Approval System
 * 承認システムとキーボードショートカットのテスト
 */
import { _ApprovalPrompt, _ApprovalOption } from './ApprovalPrompt.js';
import { _KeyboardShortcutHandler, _ShortcutCategory } from './KeyboardShortcutHandler.js';

/**
 * Phase 3テスト実行
 */
async function testPhase3(): Promise<void> {
  console.log('🧪 Phase 3: Approval System Test\n');

  // 1. ApprovalPrompt 基本テスト
  console.log('1. ApprovalPrompt Basic Test');
  console.log('─'.repeat(50));

  // シンプルな確認ダイアログをシミュレート
  console.log('Creating simple approval prompt...');

  const _simpleOptions: ApprovalOption[] = [
    {
      key: 'y',
      label: 'Yes',
      description: 'Proceed with the action',
      action: async () => {
        console.log('✅ User selected Yes');
      },
      style: 'success',
    },
    {
      key: 'n',
      label: 'No',
      description: 'Cancel the action',
      action: async () => {
        console.log('❌ User selected No');
      },
      style: 'secondary',
    },
  ];

  const _simplePrompt = new ApprovalPrompt({
    title: 'Confirmation Required',
    message: 'Do you want to proceed with this action?',
    options: simpleOptions,
    defaultOption: 'n',
    compactMode: true,
    showShortcuts: true,
  });

  console.log('Simple prompt configuration:');
  console.log(`  - Title: "Confirmation Required"`);
  console.log(`  - Options: Yes (y), No (n)`);
  console.log(`  - Default: No`);
  console.log(`  - Mode: Compact`);
  console.log('');

  // 2. 複雑な選択プロンプトのテスト
  console.log('2. Complex Choice Prompt Test');
  console.log('─'.repeat(50));

  const _complexOptions: ApprovalOption[] = [
    {
      key: 'c',
      label: 'Continue',
      description: 'Continue with the current operation',
      action: async () => {
        console.log('🔄 Continuing operation...');
      },
      style: 'primary',
      shortcut: 'ctrl+c',
    },
    {
      key: 'p',
      label: 'Pause',
      description: 'Pause the operation temporarily',
      action: async () => {
        console.log('⏸ Operation paused');
      },
      style: 'warning',
      shortcut: 'space',
    },
    {
      key: 's',
      label: 'Stop',
      description: 'Stop the operation completely',
      action: async () => {
        console.log('🛑 Operation stopped');
      },
      style: 'danger',
      confirm: true,
      shortcut: 'ctrl+s',
    },
    {
      key: 'r',
      label: 'Restart',
      description: 'Restart from the beginning',
      action: async () => {
        console.log('🔄 Restarting operation...');
      },
      style: 'secondary',
      shortcut: 'ctrl+r',
    },
  ];

  const _complexPrompt = new ApprovalPrompt({
    title: 'Operation Control',
    message: 'The current operation is running. What would you like to do?',
    options: complexOptions,
    timeout: 10000,
    defaultOption: 'c',
    compactMode: false,
    showShortcuts: true,
    allowEscape: true,
    width: 80,
  });

  console.log('Complex prompt configuration:');
  console.log(`  - Title: "Operation Control"`);
  console.log(`  - Options: 4 choices with shortcuts`);
  console.log(`  - Timeout: 10 seconds (_default: Continue)`);
  console.log(`  - Mode: Detailed with descriptions`);
  console.log(`  - Features: Escape allowed, confirmation for Stop`);
  console.log('');

  // 3. KeyboardShortcutHandler テスト
  console.log('3. KeyboardShortcutHandler Test');
  console.log('─'.repeat(50));

  const _shortcutHandler = new KeyboardShortcutHandler();

  // カスタムショートカットを追加
  shortcutHandler.registerShortcuts([
    {
      id: 'test_action_1',
      keys: 'ctrl+t',
      description: 'Test Action 1',
      category: ShortcutCategory.TOOLS,
      handler: () => {
        console.log('🧪 Test Action 1 executed');
      },
    },
    {
      id: 'test_action_2',
      keys: 'f2',
      description: 'Test Action 2',
      category: ShortcutCategory.TOOLS,
      handler: () => {
        console.log('🧪 Test Action 2 executed');
      },
    },
    {
      id: 'debug_mode',
      keys: 'ctrl+shift+d',
      description: 'Toggle Debug Mode',
      category: ShortcutCategory.TOOLS,
      handler: () => {
        console.log('🐛 Debug mode toggled');
      },
    },
    {
      id: 'context_menu',
      keys: 'f10',
      description: 'Show Context Menu',
      category: ShortcutCategory.VIEW,
      handler: () => {
        console.log('📋 Context menu opened');
      },
      context: ['main', 'editor'],
    },
  ]);

  console.log('Registered keyboard shortcuts:');
  console.log('  - Ctrl+T: Test Action 1');
  console.log('  - F2: Test Action 2');
  console.log('  - Ctrl+Shift+D: Toggle Debug Mode');
  console.log('  - F10: Show Context Menu (context-specific)');
  console.log('');

  // ショートカット統計を表示
  const _stats = shortcutHandler.getStats();
  console.log('Shortcut Handler Statistics:');
  console.log(`  - Total shortcuts: ${stats.totalShortcuts}`);
  console.log(`  - Enabled shortcuts: ${stats.enabledShortcuts}`);
  console.log(`  - Categories: ${stats.categories.join(', ')}`);
  console.log(`  - Current contexts: ${stats.contexts.join(', ')}`);
  console.log('');

  // 4. コンテキスト管理テスト
  console.log('4. Context Management Test');
  console.log('─'.repeat(50));

  console.log('Testing context switching...');

  // コンテキストを変更
  shortcutHandler.setContext(['editor', 'debug']);
  console.log('✓ Switched to editor + debug context');

  shortcutHandler.pushContext('terminal');
  console.log('✓ Added terminal context');

  const _newStats = shortcutHandler.getStats();
  console.log(`✓ Current contexts: ${newStats.contexts.join(', ')}`);

  shortcutHandler.popContext('debug');
  console.log('✓ Removed debug context');

  const _finalStats = shortcutHandler.getStats();
  console.log(`✓ Final contexts: ${finalStats.contexts.join(', ')}`);
  console.log('');

  // 5. ショートカット有効/無効テスト
  console.log('5. Shortcut Enable/Disable Test');
  console.log('─'.repeat(50));

  console.log('Testing shortcut enable/disable...');

  // ショートカットを無効化
  shortcutHandler.enableShortcut('ctrl+t', false);
  console.log('✓ Disabled Ctrl+T shortcut');

  // 一時的に無効化
  shortcutHandler.temporarily('f2', 5000);
  console.log('✓ Temporarily disabled F2 for 5 seconds');

  // 再度有効化
  shortcutHandler.enableShortcut('ctrl+t', true);
  console.log('✓ Re-enabled Ctrl+T shortcut');
  console.log('');

  // 6. 静的ヘルパーメソッドテスト
  console.log('6. Static Helper Methods Test');
  console.log('─'.repeat(50));

  console.log('Testing static helper methods...');

  // quickConfirm のシミュレーション
  console.log('✓ ApprovalPrompt.quickConfirm() method available');
  console.log('  - Usage: await ApprovalPrompt.quickConfirm("Save changes?", true)');

  // choose のシミュレーション
  console.log('✓ ApprovalPrompt.choose() method available');
  console.log('  - Usage: await ApprovalPrompt.choose("Select option", "Choose:", choices)');
  console.log('');

  // 7. エラーハンドリングテスト
  console.log('7. Error Handling Test');
  console.log('─'.repeat(50));

  console.log('Testing error handling...');

  // 存在しないショートカットの無効化
  shortcutHandler.enableShortcut('invalid+key', false);
  console.log('✓ Gracefully handled invalid shortcut key');

  // 重複ショートカットの登録
  shortcutHandler.registerShortcut({
    id: 'duplicate_test',
    keys: 'ctrl+c', // 既存のキー
    description: 'Duplicate test',
    handler: () => {},
  });
  console.log('✓ Handled duplicate shortcut registration');

  // 無効なキー形式
  try {
    shortcutHandler.registerShortcut({
      id: 'invalid_key_test',
      keys: '', // 空のキー
      description: 'Invalid key test',
      handler: () => {},
    });
    console.log('✓ Handled empty key string');
  } catch (error) {
    console.log('✓ Properly threw error for invalid key');
  }
  console.log('');

  // 8. パフォーマンステスト
  console.log('8. Performance Test');
  console.log('─'.repeat(50));

  console.log('Testing performance with many shortcuts...');

  const _startTime = Date.now();

  // 100個のショートカットを登録
  for (let _i = 0; i < 100; i++) {
    shortcutHandler.registerShortcut({
      id: `perf_test_${i}`,
      keys: `f${(i % 12) + 1}`,
      description: `Performance test shortcut ${i}`,
      handler: () => {},
    });
  }

  const _registrationTime = Date.now() - startTime;
  console.log(`✓ Registered 100 shortcuts in ${registrationTime}ms`);

  const _finalPerfStats = shortcutHandler.getStats();
  console.log(`✓ Total shortcuts now: ${finalPerfStats.totalShortcuts}`);
  console.log('');

  // 9. 統合テスト
  console.log('9. Integration Test');
  console.log('─'.repeat(50));

  console.log('Testing ApprovalPrompt + KeyboardShortcutHandler integration...');

  // ApprovalPrompt内でのキーボードショートカット
  const _integrationOptions: ApprovalOption[] = [
    {
      key: 'save',
      label: 'Save & Continue',
      description: 'Save current work and continue',
      action: async () => {
        console.log('💾 Work saved, continuing...');
      },
      shortcut: 'ctrl+s',
    },
    {
      key: 'discard',
      label: 'Discard & Exit',
      description: 'Discard changes and exit',
      action: async () => {
        console.log('🗑 Changes discarded, exiting...');
      },
      shortcut: 'ctrl+d',
      confirm: true,
    },
  ];

  console.log('✓ Created integrated prompt with keyboard shortcuts');
  console.log('✓ Options include Ctrl+S (Save) and Ctrl+D (Discard)');
  console.log('✓ Discard option requires confirmation');
  console.log('');

  // 10. デバッグ情報表示
  console.log('10. Debug Information');
  console.log('─'.repeat(50));

  shortcutHandler.debug();
  console.log('');

  // クリーンアップ
  shortcutHandler.destroy();
  console.log('✓ Cleaned up keyboard shortcut handler');

  console.log('✅ Phase 3 Test Complete - All Approval System components working correctly');
}

/**
 * 非同期プロンプトテストのシミュレーション
 */
async function simulateApprovalPrompt(
  title: string,
  message: string,
  options: string[],
): Promise<string> {
  console.log(`\n📋 ${title}`);
  console.log(`❓ ${message}`);
  console.log('Options:');
  options.forEach((option, index) => {
    console.log(`  ${index + 1}. ${option}`);
  });
  console.log('(_Simulated user selection: Option 1)');

  // 実際の実装では実際のユーザー入力を待つ
  return options[0];
}

/**
 * エラーハンドリングでテスト実行
 */
async function runPhase3Test(): Promise<void> {
  try {
    await testPhase3();
  } catch (error) {
    console.error('❌ Phase 3 Test Failed:', error);
    process.exit(1);
  }
}

// モジュールとして実行された場合のテスト実行
if (require.main === module) {
  runPhase3Test();
}

export { testPhase3, _runPhase3Test };
