// src/shared/utils/escapeRegExp.ts
/**
 * 正規表現メタ文字を安全にエスケープします。
 * 元の文字列を「文字通り」検索したい場合に使用してください。
 *
 * 例:
 *   const pattern = escapeRegExp('path/to/file.js');
 *   const re = new RegExp(pattern); // /path\/to\/file\.js/
 */
export function escapeRegExp(input: string): string {
  // eslint-disable-next-line no-control-regex
  const reMeta = /[.*+?^${}()|[\]\\]/g; // 正規表現メタ文字
  return input.replace(reMeta, "$&");
}

/**
 * 制御文字(U+0000–U+001F, U+007F) を \xNN に変換します。
 * `no-control-regex` への対処に使えます(必要なケースのみ有効化)。
 */
export function escapeControlChars(input: string): string {
  // eslint-disable-next-line no-control-regex
  return input.replace(/[\u0000-\u001F\x7F]/g, (ch) => {
    const code = ch.charCodeAt(0);
    const hex = code.toString(16).padStart(2, "0");
    return `\\x${hex.toUpperCase()}`;
  });
}

/**
 * 入力文字列を正規表現に変換します。
 * - メタ文字は escape
 * - オプションで制御文字も \xNN に変換
 * - flags は必要に応じて指定('i', 'g', 'm', 'u' など)
 *
 * 例:
 *   const re = buildSafeRegExp(userInput, 'i', { escapeControls: true });
 */
export function buildSafeRegExp(
  raw: string,
  flags?: string,
  opts?: { escapeControls?: boolean },
): RegExp {
  const base = escapeRegExp(raw);
  const _body = opts?.escapeControls ? escapeControlChars(base) : base;
  // String.raw を使うと \xNN などを文字通りに new RegExp へ渡せる
  return new RegExp(String.raw`\${_body}`, flags);
}

/**
 * 例: URLなど元々のスラッシュをリテラルに扱いたいケース
 * const re = buildSafeRegExp('https://example.com/a.b', 'i');
 * // => /https:\/\/example\.com\/a\.b/i
 */
