/**
 * Phase 1 Test: Core CLI Structure
 * コアCLI構造のテスト
 */
import { InputBox } from './InputBox.js';
import { ResponseRenderer } from './ResponseRenderer.js';
import { ModeIndicator, InternalMode } from './ModeIndicator.js';
import { LayoutEngine, LayoutZone } from './LayoutEngine.js';
import { IntegratedCLIManager } from './IntegratedCLIManager.js';

/**
 * Phase 1テスト実行
 */
async function testPhase1(): Promise<void> {
  console.log('🧪 Phase 1: Core CLI Structure Test\n');

  // 1. InputBox テスト
  console.log('1. InputBox Component Test');
  console.log('─'.repeat(50));

  const inputBox = new InputBox();
  inputBox.setPlaceholder('Enter your command...');
  inputBox.setValue('test input');
  console.log(inputBox.render());
  console.log();

  // 2. ModeIndicator テスト
  console.log('2. ModeIndicator Component Test');
  console.log('─'.repeat(50));

  const modeIndicator = new ModeIndicator();
  const testModes: InternalMode[] = [
    '✽ Thinking...',
    '✽ Coding...',
    '✽ Analyzing...',
    '✽ Brainstorming...',
    '✽ Building...',
  ];

  testModes.forEach((mode) => {
    modeIndicator.setCurrentMode(mode);
    console.log(`Mode: ${mode}`);
    console.log(modeIndicator.render());
    console.log();
  });

  // 3. ResponseRenderer テスト
  console.log('3. ResponseRenderer Component Test');
  console.log('─'.repeat(50));

  const responseRenderer = new ResponseRenderer();
  responseRenderer.addContent('System initialized successfully');
  responseRenderer.addContent('Processing your request...');
  responseRenderer.setMode('processing');
  console.log(responseRenderer.render());
  console.log();

  // 4. LayoutEngine テスト
  console.log('4. LayoutEngine Component Test');
  console.log('─'.repeat(50));

  const layoutEngine = new LayoutEngine();

  // ゾーン作成
  const headerZone: LayoutZone = {
    id: 'header',
    x: 0,
    y: 0,
    width: 124,
    height: 3,
    content: 'MARIA Platform - Integrated CLI',
    style: { border: true, padding: 1 },
  };

  const mainZone: LayoutZone = {
    id: 'main',
    x: 0,
    y: 4,
    width: 80,
    height: 20,
    content: 'Main content area for responses',
    style: { border: true, padding: 1 },
  };

  const sidebarZone: LayoutZone = {
    id: 'sidebar',
    x: 84,
    y: 4,
    width: 36,
    height: 20,
    content: 'Sidebar for modes and status',
    style: { border: true, padding: 1 },
  };

  layoutEngine.addZone(headerZone);
  layoutEngine.addZone(mainZone);
  layoutEngine.addZone(sidebarZone);

  console.log(layoutEngine.render());
  console.log();

  // 5. IntegratedCLIManager 統合テスト
  console.log('5. IntegratedCLIManager Integration Test');
  console.log('─'.repeat(50));

  const cliManager = new IntegratedCLIManager();

  // 初期化
  await cliManager.initialize();

  // モード変更テスト
  cliManager.setMode('thinking');
  console.log('Set mode to thinking:');
  console.log(cliManager.render());
  console.log();

  // レスポンス追加テスト
  cliManager.addResponse('Welcome to MARIA Platform');
  cliManager.addResponse('Type your command to begin...');
  console.log('Added responses:');
  console.log(cliManager.render());
  console.log();

  // 入力プロンプト表示テスト
  cliManager.setInputPrompt('maria> ');
  console.log('With input prompt:');
  console.log(cliManager.render());
  console.log();

  console.log('✅ Phase 1 Test Complete - All components working correctly');
}

/**
 * エラーハンドリングでテスト実行
 */
async function runPhase1Test(): Promise<void> {
  try {
    await testPhase1();
  } catch (error) {
    console.error('❌ Phase 1 Test Failed:', error);
    process.exit(1);
  }
}

// モジュールとして実行された場合のテスト実行
if (require.main === module) {
  runPhase1Test();
}

export { testPhase1, runPhase1Test };
