/**
 * Compact Help Renderer
 * - CommandMeta[] を受け取り、カテゴリごとに Top3 の primary を表示
 * - 残りは "+N more → /help <category>" で折りたたみ
 * - 端末幅に応じて 1/2 カラムを自動切替
 */

import type { CommandMeta, Level, Tag } from "../metadata-validator";
import { getResponsiveWidth } from "../../../ui/integrated-cli/responsive-width.js";

export interface CompactOptions {
  maxPrimaryPerCategory?: number; // 既定 3
  maxCategories?: number; // 既定 16 - limit categories shown
  showAdvanced?: boolean; // true なら hidden/advanced も表示
  twoColumnThreshold?: number; // 既定 100 (columns >= 100 で 2 カラム)
  categoryOrder?: string[]; // カテゴリ表示順を固定したい場合
  heading?: string; // 見出しの置換(例: '📖 MARIA Commands (compact)')
}

/** カテゴリごとに Top3 を取り出してコンパクト表示文字列を返す */
export function renderCompactHelp(
  metas: CommandMeta[],
  opts: CompactOptions = {},
): string {
  const {
    maxPrimaryPerCategory = 3,
    maxCategories = 16,
    showAdvanced = false,
    twoColumnThreshold = 100,
    categoryOrder,
    heading = "📖 MARIA Commands (compact • primary only)",
  } = opts;

  // hidden を隠す(advanced を見るときは hidden も許可)
  const visible = metas.filter((m) => showAdvanced || m.level !== "hidden");

  // カテゴリごとにグルーピング
  const byCat = new Map<string, CommandMeta[]>();
  for (const m of visible) {
    const arr = byCat.get(m.category) || [];
    arr.push(m);
    byCat.set(m.category, arr);
  }

  // 整理:primary のみ優先・rank→name ソート
  const compact = Array.from(byCat.entries()).map(([cat, arr]) => {
    const primary = arr.filter((m) => m.level === "primary").sort(sorter);
    const total = arr.length;
    const items = primary.slice(0, maxPrimaryPerCategory);
    const more = Math.max(0, total - items.length);
    return { category: cat, items, total, more };
  });

  // カテゴリ順(指定があればそれを優先、なければアルファベット順)
  compact.sort(
    (a, b) =>
      categoryIndex(a.category) - categoryIndex(b.category) ||
      a.category.localeCompare(b.category),
  );

  // Limit categories to keep compact
  const limitedCompact = compact.slice(0, maxCategories);
  const remainingCats = compact.length - limitedCompact.length;

  // カラム計算 - More aggressive 2-column for compactness
  const width = getResponsiveWidth({ marginLeft: 2, marginRight: 2 });
  const twoCol = width >= twoColumnThreshold && compact.length > 6; // Enable 2-col for many categories
  const colPad = twoCol ? Math.floor(width / 2) : width;

  // 描画
  const lines: string[] = [];
  lines.push(heading, "");
  let buffer: string[] = [];

  function flushRow() {
    if (!twoCol) {
      lines.push(...buffer);
      buffer = [];
      return;
    }
    // 2カラム整形:偶数行を左右に並べる
    for (let i = 0; i < buffer.length; i += 2) {
      const left = buffer[i] ?? "";
      const right = buffer[i + 1] ?? "";
      const paddedLeft = left.padEnd(colPad - 1, " ");
      lines.push(paddedLeft + right);
    }
    buffer = [];
  }

  for (const block of limitedCompact) {
    const head = formatCategoryHeader(
      block.category,
      block.items.length,
      block.total,
    );
    const body = [
      ...block.items.map(
        (it) =>
          `  ${padCmd(it.name, 20)} ${truncate(it.title ?? "", colPad - 24)}`,
      ),
      block.more > 0 ? `  +${block.more} more  →  /help ${block.category}` : "",
    ].filter(Boolean);

    const segment = [head, ...body, ""].join("\n");

    if (twoCol) {
      buffer.push(segment);
      if (buffer.length === 2) flushRow();
    } else {
      lines.push(segment);
    }
  }
  if (buffer.length) flushRow();

  // フッタ(Tips と総数)
  const totalCmds = metas.length;
  const totalCats = byCat.size;
  const footerLines = [
    `Tip: /help <category> で展開, /help --search <kw>, /help --all${showAdvanced ? "" : ", /help --advanced"}`,
    `Total: ${totalCmds} cmds / ${totalCats} cats (showing ${limitedCompact.length}/${totalCats} categories)`,
  ];

  if (remainingCats > 0) {
    footerLines.push(
      `${remainingCats} more categories available with /help --all`,
    );
  }

  lines.push(...footerLines);

  return lines.join("\n");

  // ---- helpers ----
  function sorter(a: CommandMeta, b: CommandMeta) {
    if ((a.rank ?? 999999) !== (b.rank ?? 999999))
      return (a.rank ?? 999999) - (b.rank ?? 999999);
    return a.name.localeCompare(b.name);
  }

  function categoryIndex(cat: string): number {
    if (!categoryOrder) return 0;
    const idx = categoryOrder.indexOf(cat);
    return idx === -1 ? 9999 : idx;
  }

  function formatCategoryHeader(
    cat: string,
    shown: number,
    total: number,
  ): string {
    const label = beautifyCategory(cat);
    return `${label} (${shown} of ${total})`;
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
      map[cat] ??
      cat.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    );
  }

  function padCmd(cmd: string, len: number) {
    return cmd.padEnd(len, " ");
  }

  function truncate(s: string, max: number) {
    if (s.length <= max) return s;
    return s.slice(0, Math.max(0, max - 1)) + "…";
  }
}
