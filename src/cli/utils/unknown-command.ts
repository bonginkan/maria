import { commandInfo } from "../../lib/command-groups";

const _withSlash = (s: string) => (s.startsWith("/") ? s : `/${s}`);
const _noSlash = (s: string) => (s.startsWith("/") ? s.slice(1) : s);
const _norm = (s: string) => s.normalize("NFKC").trim().toLowerCase();

/** dist<=1 を高速判定(insert/delete/substitute いずれか1回を許可) */

export const metadata = {
  name: 'unknown',
  description: 'Handle unknown commands with suggestions',
  category: 'unknown',
  planRequired: 'free' as const,
  type: 'functional' as const,
  isPreview: false,
  version: '1.0.0'
};

export interface UnknownMetadata {
  name: 'unknown';
  description: 'Handle unknown commands with suggestions';
  category: 'unknown';
  planRequired: 'free';
  type: 'functional';
  isPreview: false;
  version: '1.0.0';
}

export function isEditDistanceLE1(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length,
    lb = b.length;
  if (Math.abs(la - lb) > 1) return false;

  // a を短い方にする
  let s = a,
    t = b;
  if (la > lb) {
    s = b;
    t = a;
  }
  let i = 0,
    j = 0,
    edits = 0;
  while (i < s.length && j < t.length) {
    if (s[i] === t[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (s.length === t.length) {
      // 置換
      i++;
      j++;
    } else {
      // 挿入/削除(長い方を進める)
      j++;
    }
  }
  // 末尾1文字の差分を吸収
  if (j < t.length || i < s.length) edits++;
  return edits <= 1;
}

export interface UnknownOptions {
  docUrl?: string; // ドキュメントURL
  maxSuggestions?: number; // 候補数
  color?: boolean; // trueなら少し色付け
  fuzzy?: boolean; // true で距離1も候補
}

function colorize(s: string, color?: boolean, code = 31) {
  // 31:red, 33:yellow, 36:cyan
  return color ? `\u001b[${code}m${s}\u001b[0m` : s;
}

/** 軽量サジェスト:前方一致→部分一致→(fuzzy≤1) の順でスコアリング */
export function suggestCommands(
  input: string,
  max = 5,
  fuzzy = true,
): string[] {
  const q = _norm(_noSlash(input));
  if (!q) return [];

  const names = Object.values(commandInfo).flatMap((info) => {
    const arr = [_withSlash(info.name)];
    if (info.aliases?.length) arr.push(...info.aliases.map(_withSlash));
    return arr;
  });

  const scored = names
    .map((n) => {
      const base = _norm(_noSlash(n));
      let score = -Infinity;
      if (base === q) score = 100;
      else if (base.startsWith(q)) score = 90;
      else if (base.includes(q)) score = 60;
      else if (fuzzy && isEditDistanceLE1(base, q)) score = 50; // ← ここで距離1を許可
      return { n, score };
    })
    .filter((x) => x.score > -Infinity)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.n);

  // 重複排除しつつ上位 max
  const uniq: string[] = [];
  for (const n of scored) {
    if (!uniq.includes(n)) uniq.push(n);
    if (uniq.length === max) break;
  }
  return uniq;
}

export function formatUnknownCommandMessage(
  input: string,
  opts: UnknownOptions = {},
): string {
  const isTTY = process.stderr.isTTY;
  const enableColor = (opts.color ?? true) && isTTY && !process.env.NO_COLOR;

  const { docUrl, maxSuggestions = 5, fuzzy = true } = opts;
  const unknownLine = `${colorize("Unknown command", enableColor, 31)}: ${colorize(_withSlash(input), enableColor, 36)}`;

  const suggestions = suggestCommands(input, maxSuggestions, fuzzy);
  const sugLine = suggestions.length
    ? `Did you mean: ${suggestions.map((s) => colorize(s, enableColor, 33)).join(", ")} ?`
    : `Try ${colorize("/help", enableColor, 33)} to see the command list.`;

  const docLine = docUrl ? `See: ${docUrl}` : "";

  return [unknownLine, sugLine, docLine].filter(Boolean).join("\n");
}

/** Execute function for command registry */
export async function execute(context: any): Promise<any> {
  const input = context?.input ?? 'unknown';
  const message = formatUnknownCommandMessage(input, {
    fuzzy: true,
    maxSuggestions: 5,
    color: true
  });
  
  return {
    endReason: 'partial',
    message: message,
    data: {
      suggestions: suggestCommands(input, 5, true),
      type: 'unknown_command'
    }
  };
}

/** 便利関数:メッセージ出力＋終了コード設定 */
export function handleUnknownCommand(
  _input: string,
  opts: UnknownOptions = {},
): never {
  // eslint-disable-next-line no-console
  console.error(formatUnknownCommandMessage(_input, opts));
  process.exitCode = 1;
  // ここで終了しない場合は呼び出し側で制御
  // eslint-disable-next-line no-unsafe-finally
  throw new Error("UNKNOWN_COMMAND");
}
