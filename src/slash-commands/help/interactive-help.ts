/**
 * Interactive Help (↑/↓/←/→/Enterで展開/折りたたみ)
 * - CommandMeta をカテゴリごとに表示
 * - Alt Screen + raw mode のみで軽量に動作
 * - A: advanced 切替 / D: 詳細表示 / F: Full 表示 / Q|Esc: 終了
 */

import * as fs from "fs/promises";
import * as path from "path";
import { renderCategoryHelp } from "./renderers/detail-renderer";
import { renderFullHelp } from "./renderers/full-renderer";
import type { CommandMeta, Level, Tag } from "./metadata-validator";
import { getResponsiveWidth } from "../../ui/integrated-cli/responsive-width.js";

export interface InteractiveOpts {
  metaPath?: string; // 省略時: src/slash-commands/help/command-meta.json
  heading?: string; // 先頭タイトル
  showAdvancedDefault?: boolean;
}

export async function runInteractiveHelp(
  opts: InteractiveOpts = {},
): Promise<void> {
  const metaPath =
    opts.metaPath ?? path.resolve("src/slash-commands/help/command-meta.json");

  let container;
  try {
    const text = await fs.readFile(metaPath, "utf8");
    container = JSON.parse(text);
  } catch (error) {
    throw new Error(`Failed to load metadata: ${error}`);
  }

  const metas = Array.isArray(container) ? container : container.commands;
  if (!Array.isArray(metas) || metas.length === 0) {
    throw new Error("help meta not found or empty");
  }

  const state = buildState(
    metas,
    !!opts.showAdvancedDefault,
    opts.heading ?? "📖 MARIA Commands — Interactive",
  );
  const term = new Terminal();

  try {
    // Check if terminal supports alt screen
    if (!process.stdout.isTTY || process.env.NO_ALT_SCREEN) {
      throw new Error("Interactive mode requires TTY with alt screen support");
    }

    term.enterAlt();
    term.hideCursor();
    term.enableRaw();

    // 初回レンダ
    render(term, state);

    // 入力ループ
    await loop(term, state);
  } finally {
    term.disableRaw();
    term.showCursor();
    term.leaveAlt();
  }
}

/* ---------------------------------- State ---------------------------------- */

interface CategoryBlock {
  key: string; // category key
  label: string; // beautified label
  total: number;
  primaries: CommandMeta[];
  secondaries: CommandMeta[];
}

interface UIState {
  heading: string;
  width: number;
  height: number;
  categories: CategoryBlock[];
  order: string[]; // 並び順
  selected: number; // 選択中 index(order 基準)
  expanded: Set<string>; // 展開中カテゴリ key
  scrollTop: number; // 先頭表示行(仮想)
  showAdvanced: boolean;
}

function buildState(
  metas: CommandMeta[],
  showAdvanced: boolean,
  heading: string,
): UIState {
  const width = getResponsiveWidth({ marginLeft: 2, marginRight: 2 });
  const height = process.stdout.rows || 24;

  const visible = showAdvanced
    ? metas
    : metas.filter((m) => m.level !== "hidden");

  const byCat = new Map<string, CommandMeta[]>();
  for (const m of visible) {
    const arr = byCat.get(m.category) || [];
    arr.push(m);
    byCat.set(m.category, arr);
  }

  const blocks: CategoryBlock[] = [];
  for (const [cat, arr] of byCat) {
    const sorted = arr.slice().sort(sorter);
    const primaries = sorted.filter((m) => m.level === "primary" && !m.parent);
    const secondaries = sorted.filter((m) => m.level !== "primary" || m.parent);
    blocks.push({
      key: cat,
      label: beautifyCategory(cat),
      total: sorted.length,
      primaries,
      secondaries,
    });
  }

  const order = blocks.map((b) => b.key).sort((a, b) => a.localeCompare(b));
  return {
    heading,
    width,
    height,
    categories: blocks,
    order,
    selected: 0,
    expanded: new Set<string>(),
    scrollTop: 0,
    showAdvanced,
  };

  function sorter(a: CommandMeta, b: CommandMeta) {
    if ((a.rank ?? 999999) !== (b.rank ?? 999999))
      return (a.rank ?? 999999) - (b.rank ?? 999999);
    return a.name.localeCompare(b.name);
  }
}

function beautifyCategory(cat: string): string {
  const map: Record<string, string> = {
    core: "📝 Core",
    generation: "🚀 Content Generation",
    analysis: "🔍 Analysis & Review",
    quality: "🛡️ Code Quality",
    development: "⚙️ Development Tools",
    workflow: "🔄 Workflow Automation",
    configuration: "📋 Configuration",
    auth: "🔐 Authentication",
    media: "🎨 Media Generation",
    integration: "🔗 Integration",
    system: "🏥 System & Diagnostics",
    optimization: "⚡ Performance Optimization",
    creative: "🎨 Creative Tools",
    implementation: "🔧 Implementation Utilities",
    evolution: "🧠 RL Evolution",
    ai: "🤖 AI & GPU Operations",
    monitoring: "📊 Real-time Monitoring",
    file: "💾 File Operations",
    "coding-agent": "🤖 AI Coding Agent",
    business: "💼 Business Operations",
  };
  return (
    map[cat] ?? cat.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/* ------------------------------ Input Handling ----------------------------- */

const KEY = {
  UP: "\x1b[A",
  DOWN: "\x1b[B",
  RIGHT: "\x1b[C",
  LEFT: "\x1b[D",
  ENTER: "\r",
  ESC: "\x1b",
  Q: "q",
  A: "a",
  D: "d",
  F: "f",
};

async function loop(term: Terminal, s: UIState): Promise<void> {
  let last = 0;
  const onKey = async (buf: Buffer) => {
    const now = Date.now();
    if (now - last < 25) return; // 軽いデバウンス
    last = now;

    const str = buf.toString();

    if (str === KEY.UP) {
      s.selected = Math.max(0, s.selected - 1);
      ensureVisible(s);
      render(term, s);
      return;
    }
    if (str === KEY.DOWN) {
      s.selected = Math.min(s.order.length - 1, s.selected + 1);
      ensureVisible(s);
      render(term, s);
      return;
    }
    if (str === KEY.RIGHT || str === KEY.ENTER) {
      toggleExpand(s, true);
      ensureVisible(s);
      render(term, s);
      return;
    }
    if (str === KEY.LEFT) {
      toggleExpand(s, false);
      ensureVisible(s);
      render(term, s);
      return;
    }
    // Advanced 切替
    if (str.toLowerCase() === KEY.A) {
      s.showAdvanced = !s.showAdvanced;
      // 再構築(メタ再ロードが筋だが、ここは表示だけ更新)
      render(term, s);
      return;
    }

    // 詳細表示(カテゴリ全展開のテキストビュー)
    if (str.toLowerCase() === KEY.D) {
      await showCategoryDetail(term, s);
      render(term, s);
      return;
    }

    // Full 一時表示
    if (str.toLowerCase() === KEY.F) {
      await showFullDetail(term, s);
      render(term, s);
      return;
    }

    // 終了
    if (str === KEY.ESC || str.toLowerCase() === KEY.Q) {
      term.writeAt(1, 1, ""); // no-op
      throw new ExitSignal();
    }
  };

  try {
    await term.onKey(onKey); // ここでループ(例外で抜ける)
  } catch (e) {
    if (!(e instanceof ExitSignal)) throw e;
  }
}

class ExitSignal extends Error {}

/** 選択カテゴリを展開/折りたたみ */
function toggleExpand(s: UIState, open: boolean) {
  const cat = s.order[s.selected];
  if (!cat) return;
  const isOpen = s.expanded.has(cat);
  if (open && !isOpen) s.expanded.add(cat);
  if (!open && isOpen) s.expanded.delete(cat);
}

/** 選択項目が画面内に入るようスクロールを調整 */
function ensureVisible(s: UIState) {
  const lines = materializeLines(s);
  const indexLine = findCategoryTopLine(s, s.order[s.selected], lines);
  const top = s.scrollTop;
  const bottom = s.scrollTop + (s.height - 4); // ヘッダ/フッタ分
  if (indexLine < top) s.scrollTop = indexLine;
  else if (indexLine > bottom - 3) s.scrollTop = indexLine - (s.height - 4) + 3;
  if (s.scrollTop < 0) s.scrollTop = 0;
}

/* -------------------------------- Rendering -------------------------------- */

function render(term: Terminal, s: UIState) {
  const lines = materializeLines(s);
  const maxLines = s.height - 2;

  // クリア
  term.clearAll();
  // Heading
  term.moveTo(1, 1);
  term.write(`${s.heading}  ${s.showAdvanced ? "[ADVANCED: ON]" : ""}`);
  term.write("\n");

  // 可視範囲を描画
  const start = s.scrollTop;
  const end = Math.min(lines.length, start + maxLines - 2);
  for (let i = start; i < end; i++) {
    term.write(lines[i] + "\n");
  }

  // フッタ
  const footer =
    "↑/↓ Move  →/Enter Expand  ← Collapse  [A]dvanced  [D]etail  [F]ull  [Q/Esc] Quit";
  term.write(truncateWidth(footer, s.width));
}

/** 仮想行(カテゴリヘッダ+内容)を生成 */
function materializeLines(s: UIState): string[] {
  const lines: string[] = [];
  const selCat = s.order[s.selected];

  for (const key of s.order) {
    const block = s.categories.find((b) => b.key === key)!;
    const isOpen = s.expanded.has(key);
    const isSel = key === selCat;

    const head = `${isOpen ? "▼" : "▶"} ${block.label} (${block.primaries.length + block.secondaries.length})`;
    lines.push(colorize(isSel, head));

    if (isOpen) {
      // Primaries
      for (const p of block.primaries) {
        lines.push(
          "   " + padCmd(p.name, 24) + " " + truncate(p.title ?? "", 80),
        );
      }
      // Secondaries(parentごとに)
      const byParent = new Map<string, CommandMeta[]>();
      for (const sc of block.secondaries) {
        const parent = sc.parent ?? "(misc)";
        const arr = byParent.get(parent) || [];
        arr.push(sc);
        byParent.set(parent, arr);
      }
      const parents = Array.from(byParent.keys()).sort();
      for (const parent of parents) {
        lines.push(`   ${parent !== "(misc)" ? parent : "Subcommands"}:`);
        const children = (byParent.get(parent) || [])
          .slice()
          .sort(
            (a, b) =>
              (a.rank ?? 999999) - (b.rank ?? 999999) ||
              a.name.localeCompare(b.name),
          );
        for (const c of children) {
          lines.push(
            "     " + padCmd(c.name, 24) + " " + truncate(c.title ?? "", 76),
          );
        }
      }
      lines.push(""); // 区切り
    }
  }
  return lines;
}

function findCategoryTopLine(s: UIState, cat: string, lines: string[]): number {
  let cursor = 0;
  for (const key of s.order) {
    if (key === cat) return cursor;
    cursor++; // ヘッダ行
    const isOpen = s.expanded.has(key);
    if (isOpen) {
      // primaries + secondaries + 1(空行)
      const b = s.categories.find((x) => x.key === key)!;
      cursor += b.primaries.length;
      // secondaries: 親ヘッダ + 子数 合計
      const byParent = new Map<string, CommandMeta[]>();
      for (const sc of b.secondaries) {
        const parent = sc.parent ?? "(misc)";
        const arr = byParent.get(parent) || [];
        arr.push(sc);
        byParent.set(parent, arr);
      }
      cursor += byParent.size; // 親ラベル行数
      for (const arr of byParent.values()) {
        cursor += arr.length;
      }
      cursor += 1; // 空行
    }
  }
  return 0;
}

/* --------------------------------- Helpers --------------------------------- */

function padCmd(cmd: string, len: number) {
  return cmd.padEnd(len, " ");
}
function truncate(s: string, max: number) {
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)) + "…";
}
function truncateWidth(s: string, width: number) {
  return s.length <= width ? s : s.slice(0, width - 1) + "…";
}
function colorize(selected: boolean, text: string) {
  // 色が要らない場合はそのまま返す(NO_COLOR対応)
  if (process.env.NO_COLOR) return selected ? `> ${text}` : `  ${text}`;
  const B = "\x1b[1m",
    R = "\x1b[0m",
    C = selected ? "\x1b[36m" : "";
  return selected ? `${B}${C}> ${text}${R}` : `  ${text}`;
}

/* --------------------------------- Detail ---------------------------------- */

async function showCategoryDetail(term: Terminal, s: UIState) {
  const cat = s.order[s.selected];
  if (!cat) return;
  const metas = s.showAdvanced
    ? collectAll(s, cat)
    : collectAll(s, cat).filter((m) => m.level !== "hidden");

  const txt = renderCategoryHelp(metas, cat, {
    advanced: s.showAdvanced,
    showAliases: false,
    width: s.width,
  });

  // 一時ビュー
  term.clearAll();
  term.moveTo(1, 1);
  term.write(txt + "\n\n");
  term.write("Press any key to return...");
  await term.waitKey();
}

async function showFullDetail(term: Terminal, s: UIState) {
  const metas = s.showAdvanced
    ? collectAll(s)
    : collectAll(s).filter((m) => m.level !== "hidden");
  const txt = renderFullHelp(metas, {
    advanced: s.showAdvanced,
    showAliases: false,
    heading: "📖 Full Listing",
    width: s.width,
  });

  term.clearAll();
  term.moveTo(1, 1);
  term.write(txt + "\n\n");
  term.write("Press any key to return...");
  await term.waitKey();
}

function collectAll(s: UIState, onlyCat?: string): CommandMeta[] {
  const arr: CommandMeta[] = [];
  for (const key of s.order) {
    if (onlyCat && key !== onlyCat) continue;
    const b = s.categories.find((x) => x.key === key)!;
    arr.push(...b.primaries, ...b.secondaries);
  }
  return arr;
}

/* -------------------------------- Terminal --------------------------------- */

class Terminal {
  private keyHandler?: (b: Buffer) => void;

  enterAlt() {
    this.write("\x1b[?1049h");
  }
  leaveAlt() {
    this.write("\x1b[?1049l");
  }
  hideCursor() {
    this.write("\x1b[?25l");
  }
  showCursor() {
    this.write("\x1b[?25h");
  }
  enableRaw() {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
    }
  }
  disableRaw() {
    try {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
        process.stdin.pause();
      }
    } catch {}
  }
  clearAll() {
    this.write("\x1b[2J\x1b[H");
  }
  moveTo(row: number, col: number) {
    this.write(`\x1b[${row};${col}H`);
  }
  write(s: string) {
    process.stdout.write(s);
  }
  writeAt(row: number, col: number, s: string) {
    this.moveTo(row, col);
    this.write(s);
  }

  async onKey(handler: (b: Buffer) => void): Promise<void> {
    this.keyHandler = handler;
    return new Promise<void>((resolve, reject) => {
      const onData = (b: Buffer) => handler(b);
      const onErr = (e: any) => reject(e);
      process.stdin.on("data", onData);
      process.stdin.on("error", onErr);

      // resolve は外から ExitSignal で投げるのでここでは保持のみ
      const cleanup = () => {
        process.stdin.off("data", onData);
        process.stdin.off("error", onErr);
      };
      // ループ終了時 cleanup されるように上位で try/finally
      (this as any)._cleanup = cleanup;
    });
  }

  async waitKey(): Promise<void> {
    return new Promise<void>((res) => {
      const handler = (b: Buffer) => {
        process.stdin.off("data", handler);
        res();
      };
      process.stdin.on("data", handler);
    });
  }
}
