/**
 * コマンド設定
 * 各コマンドの特性(重い/軽い、対話的/非対話的、タイムアウト)を定義
 */

/**
 * 重いコマンド(排他制御対象)
 * これらのコマンドは同時実行を防ぐ
 */
export const HEAVY_COMMANDS = new Set([
  "/code",
  "/test",
  "/review",
  "/batch",
  "/chain",
  "/pr-comments",
  "/generate-docs",
  "/optimize-structure",
  "/evolve",
  "/learn",
  "/optimize",
  "/image",
  "/video",
  "/paper",
]);

/**
 * 対話的コマンド(requiresInput許可)
 * これらのコマンドはユーザー入力を待つことができる
 */
export const INTERACTIVE_COMMANDS = new Set([
  "/approve",
  "/model:interactive",
  "/confirm",
  "/shell",
  "/sh",
]);

/**
 * コマンドごとのタイムボックス(ms)
 * 各コマンドの最大実行時間を定義
 */
export const COMMAND_TIMEOUTS: Record<string, number> = {
  "*": 5000, // デフォルト5秒

  // 軽量コマンド(1秒以内)
  "/help": 1000,
  "/clear": 1000,
  "/status": 1000,
  "/version": 1000,
  "/doctor": 1000,
  "/cost": 1000,

  // 中量コマンド(5-10秒)
  "/model": 8000,
  "/config": 5000,
  "/permissions": 5000,
  "/hooks": 5000,
  "/alias": 5000,
  "/template": 5000,
  "/memory": 5000,
  "/suggest": 5000,
  "/hotkey": 5000,

  // 重量コマンド(15-30秒)
  "/code": 15000,
  "/test": 15000,
  "/review": 20000,
  "/pr-comments": 20000,
  "/chain": 20000,
  "/batch": 20000,
  "/evolve": 30000,
  "/learn": 30000,
  "/optimize": 30000,

  // 超重量コマンド(30秒以上)
  "/image": 30000,
  "/video": 60000,
  "/paper": 45000,
  "/generate-docs": 30000,
  "/optimize-structure": 30000,
  "/auto-organize": 30000,

  // Shell/対話系(長め)
  "/shell": 30000,
  "/sh": 30000,
  "/approve": 60000,
  "/confirm": 60000,
};

/**
 * コマンドが重いかどうかを判定
 */
export function isHeavyCommand(command: string): boolean {
  return HEAVY_COMMANDS.has(command.toLowerCase());
}

/**
 * コマンドが対話的かどうかを判定
 */
export function isInteractiveCommand(command: string): boolean {
  return INTERACTIVE_COMMANDS.has(command.toLowerCase());
}

/**
 * コマンドのタイムアウト値を取得
 * Test mode optimization: MARIA_TEST_SHORT_TIMEOUT=1 で全コマンド200ms
 */
export function getCommandTimeout(command: string): number {
  // Fast timeout for tests to speed up CI
  if (process.env.MARIA_TEST_SHORT_TIMEOUT === "1") {
    return 200; // 200ms for all commands in test mode
  }

  const cmd = command.toLowerCase();
  return COMMAND_TIMEOUTS[cmd] ?? COMMAND_TIMEOUTS["*"] ?? 5000;
}

/**
 * Alias for compatibility with v2.1 spec
 */
export const getTimeoutMs = getCommandTimeout;

/**
 * コマンドのInflightキーを生成
 * 重いコマンドは排他制御、軽いコマンドは#nolockサフィックス
 */
export function getInflightKey(command: string): string {
  const cmd = command.toLowerCase();
  return isHeavyCommand(cmd) ? cmd : `${cmd}#nolock`;
}
