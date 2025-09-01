/**
 * Minimal Icon Registry
 * MARIA CODEブランドに最適化された最小限のアイコンシステム
 * 画面のずれを防ぐ厳格な文字幅管理
 */

export interface IconDefinition {
  readonly symbol: string;
  readonly width: number;
  readonly description: string;
  readonly usage: string[];
}

// 厳選された6個の核心アイコン(画面ずれ防止)
export const CORE_ICONS = {
  // システム状態アイコン
  SUCCESS: {
    symbol: "✓",
    width: 1,
    description: "成功・完了状態",
    usage: ["タスク完了", "ビルド成功", "テスト合格"],
  },

  ERROR: {
    symbol: "✗",
    width: 1,
    description: "エラー・失敗状態",
    usage: ["エラー発生", "ビルド失敗", "テスト失敗"],
  },

  WARNING: {
    symbol: "!",
    width: 1,
    description: "警告・注意喚起",
    usage: ["警告メッセージ", "デプリケーション", "要注意"],
  },

  INFO: {
    symbol: "i",
    width: 1,
    description: "情報・説明",
    usage: ["情報表示", "ヘルプ", "説明文"],
  },

  // プロセス状態アイコン
  LOADING: {
    symbol: "◯",
    width: 1,
    description: "ローディング・処理中",
    usage: ["API呼び出し", "ファイル処理", "AI応答待ち"],
  },

  ARROW: {
    symbol: "→",
    width: 1,
    description: "方向・進行",
    usage: ["フロー表示", "ナビゲーション", "次のステップ"],
  },
} as const satisfies Record<string, IconDefinition>;

// スピナーアニメーション(ローディング用)
export const _SPINNER_FRAMES = [
  "⠋",
  "⠙",
  "⠹",
  "⠸",
  "⠼",
  "⠴",
  "⠦",
  "⠧",
  "⠇",
  "⠏",
] as const;

// 禁止アイコン(表示問題・視覚的ノイズの原因)
export const _FORBIDDEN_ICONS = [
  // 絵文字系(レンダリング不安定)
  "🚀",
  "🎉",
  "🎨",
  "📊",
  "🔧",
  "⚡",
  "🎯",
  "🔥",
  "🌟",
  "💫",
  "⭐",
  "🎪",
  "🎭",
  "🔮",
  "🎲",
  "🏆",
  "🎖️",
  "🏅",
  "🥇",
  "🎊",
  "🎈",
  "🎁",
  "🎀",

  // 複雑な記号(幅不定)
  "✨",
  "💎",
  "🔹",
  "🔸",
  "◆",
  "◇",
  "♦",
  "♢",
  "●",
  "○",
  "◉",
  "◎",
  "⚫",
  "⚪",
  "🔴",
  "🟡",

  // フォント依存記号
  "★",
  "☆",
  "♪",
  "♫",
  "♬",
  "♩",
  "⚿",
  "⚾",
] as const;

/**
 * アイコン取得ユーティリティ
 */
export class IconRegistry {
  /**
   * 安全なアイコン取得(フォールバック付き)
   */
  static get(iconName: keyof typeof CORE_ICONS): string {
    const _icon = CORE_ICONS[iconName];
    if (!_icon) {
      console.warn(`Unknown _icon: ${iconName}, falling back to INFO`);
      return CORE_ICONS.INFO.symbol;
    }
    return _icon.symbol;
  }

  /**
   * アイコンの文字幅取得
   */
  static getWidth(iconName: keyof typeof CORE_ICONS): number {
    const _icon = CORE_ICONS[iconName];
    return _icon?.width || 1;
  }

  /**
   * 文字幅を考慮したアイコン配置
   */
  static _alignIcon(
    _iconName: keyof typeof CORE_ICONS,
    totalWidth: number,
  ): string {
    const _icon = this.get(_iconName);
    const _iconWidth = this.getWidth(_iconName);
    const _padding = Math.max(0, totalWidth - _iconWidth);
    return _icon.padEnd(totalWidth - _padding + _iconWidth);
  }

  /**
   * スピナーフレーム取得
   */
  static getSpinnerFrame(index: number): string {
    const _frame = _SPINNER_FRAMES[index % _SPINNER_FRAMES.length];
    return _frame || "◯";
  }

  /**
   * 利用可能なアイコン一覧
   */
  static listAvailable(): Array<{ name: string; _icon: IconDefinition }> {
    return Object.entries(CORE_ICONS).map(([name, _icon]) => ({
      name,
      _icon,
    }));
  }

  /**
   * アイコンの使用例表示
   */
  static showUsageExample(iconName: keyof typeof CORE_ICONS): void {
    const _icon = CORE_ICONS[iconName];
    if (!_icon) {
      return;
    }

    console.log(`${_icon.symbol} ${iconName} - ${_icon.description}`);
    icon.usage.forEach((usage) => {
      console.log(`  例: ${_icon.symbol} ${usage}`);
    });
  }

  /**
   * 禁止アイコンチェック
   */
  static isForbidden(symbol: string): boolean {
    return _FORBIDDEN_ICONS.includes(symbol as any);
  }

  /**
   * 安全性検証
   */
  static validateIcon(symbol: string): {
    isValid: boolean;
    width: number;
    warnings: string[];
  } {
    const warnings: string[] = [];

    // 禁止アイコンチェック
    if (this.isForbidden(symbol)) {
      warnings.push("禁止されたアイコンです");
    }

    // 文字幅チェック(推定)
    let estimatedWidth = 1;
    if (symbol.length > 1) {
      estimatedWidth = symbol.length;
      warnings.push("複数文字のアイコンは表示ずれの原因となります");
    }

    // Unicode絵文字チェック
    if (/[\u{1F300}-\u{1F9FF}]/u.test(symbol)) {
      warnings.push("絵文字は端末によって表示が異なります");
    }

    return {
      isValid: warnings.length === 0,
      width: estimatedWidth,
      warnings,
    };
  }
}

// 型安全なアイコン名
export type CoreIconName = keyof typeof CORE_ICONS;

// エクスポート用の便利関数
export const _getIcon = IconRegistry.get;
export const _getIconWidth = IconRegistry.getWidth;
export const _alignIcon = IconRegistry._alignIcon;

export default IconRegistry;
