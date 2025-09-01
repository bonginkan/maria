/**
 * Detailed Help Renderers
 * - renderCategoryHelp: /help <category>
 *   - primary を先頭、secondary(parent付き)をインデントして展開
 *   - hidden は advanced オプションで表示
 * - renderSearchHelp: /help --search <kw>
 *   - name/title/category を対象に簡易ファジー検索
 */

import type { CommandMeta, Level, Tag } from "../metadata-validator";
import { getResponsiveWidth } from "../../../ui/integrated-cli/responsive-width.js";

export interface DetailOptions {
  advanced?: boolean; // hidden/advanced を表示
  heading?: string; // 見出しの置換
  showAliases?: boolean; // エイリアス表示
  width?: number; // 端末幅(自動取得が望ましいが任意)
  matchMode?: "any" | "all"; // 検索モード(トークンの AND/OR)
}

function sorter(a: CommandMeta, b: CommandMeta) {
  if ((a.rank ?? 999999) !== (b.rank ?? 999999))
    return (a.rank ?? 999999) - (b.rank ?? 999999);
  return a.name.localeCompare(b.name);
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

function padCmd(cmd: string, len: number) {
  return cmd.padEnd(len, " ");
}

function truncate(s: string, max: number) {
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)) + "…";
}

function formatTags(m: CommandMeta): string {
  if (!m.tags || m.tags.length === 0) return "";
  return "  [" + m.tags.join(",") + "]";
}

/** /help <category> の詳細表示(2階層展開) */
export function renderCategoryHelp(
  metas: CommandMeta[],
  category: string,
  opts: DetailOptions = {},
): string {
  const width = opts.width ?? getResponsiveWidth({ marginLeft: 2, marginRight: 2 });
  const colCmd = Math.min(24, Math.max(16, Math.floor(width * 0.28)));
  const advanced = !!opts.advanced;

  // カテゴリに属するコマンドを抽出
  let target = metas.filter((m) => m.category === category);
  if (!advanced) target = target.filter((m) => m.level !== "hidden");

  // parent グループ化
  const primary = target
    .filter((m) => !m.parent && m.level !== "hidden" && m.level !== "secondary")
    .sort(sorter);
  const secondaries = target
    .filter((m) => m.parent || m.level === "secondary")
    .sort(sorter);

  const byParent = new Map<string, CommandMeta[]>();
  for (const s of secondaries) {
    const p = s.parent ?? "(misc)";
    const arr = byParent.get(p) || [];
    arr.push(s);
    byParent.set(p, arr);
  }

  const lines: string[] = [];
  lines.push(
    opts.heading ?? `📖 ${beautifyCategory(category)} — All Commands`,
    "",
  );

  // primary を先頭に
  if (primary.length) {
    lines.push("Primary:");
    for (const p of primary) {
      const alias =
        opts.showAliases && p.aliases?.length
          ? ` (aka: ${p.aliases.join(", ")})`
          : "";
      const tags = formatTags(p);
      lines.push(
        `  ${padCmd(p.name, colCmd)} ${truncate((p.title ?? "") + alias + tags, width - colCmd - 4)}`,
      );
    }
    lines.push("");
  }

  // secondary を parent ごとに展開
  const parentsSorted = Array.from(byParent.keys()).sort();
  for (const parent of parentsSorted) {
    const children = byParent.get(parent)!.sort(sorter);
    const parentHead = parent !== "(misc)" ? parent : "Subcommands";
    lines.push(`${parentHead}:`);
    for (const c of children) {
      const alias =
        opts.showAliases && c.aliases?.length
          ? ` (aka: ${c.aliases.join(", ")})`
          : "";
      const tags = formatTags(c);
      lines.push(
        `  ${padCmd(c.name, colCmd)} ${truncate((c.title ?? "") + alias + tags, width - colCmd - 4)}`,
      );
    }
    lines.push("");
  }

  if (!primary.length && byParent.size === 0) {
    lines.push("(No commands found in this category)");
    lines.push("");
  }

  // フッタ
  lines.push(
    `Tip: /help --search <kw>, /help --all${advanced ? "" : ", /help --advanced"}`,
  );

  return lines.join("\n");
}

/** /help --search <kw> の詳細表示(カテゴリ横断・スコア順) */
export function renderSearchHelp(
  metas: CommandMeta[],
  query: string,
  opts: DetailOptions = {},
): string {
  const width = opts.width ?? getResponsiveWidth({ marginLeft: 2, marginRight: 2 });
  const colCmd = Math.min(24, Math.max(16, Math.floor(width * 0.28)));
  const advanced = !!opts.advanced;
  const matchMode = opts.matchMode ?? "any";
  const q = query.trim().toLowerCase();

  if (!q) return "Please provide a search keyword.\n";

  // hidden フィルタ
  const pool = advanced ? metas : metas.filter((m) => m.level !== "hidden");

  // Enhanced fuzzy search with AND/OR support
  const matches = pool
    .map((m) => ({ meta: m, score: fuzzyScore(m, q, matchMode) }))
    .filter((x) => x.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || (a.meta.rank ?? 999999) - (b.meta.rank ?? 999999),
    )
    .slice(0, 50); // 上位 50 件に制限

  const lines: string[] = [];
  lines.push(`🔎 Search: "${query}" (${matches.length} results)`, "");

  if (matches.length === 0) {
    lines.push(
      "No matches. Try another keyword or use --match all for stricter matching.",
    );
    return lines.join("\n");
  }

  // カテゴリごとに固めて描画
  const byCat = new Map<string, { meta: CommandMeta; score: number }[]>();
  for (const m of matches) {
    const arr = byCat.get(m.meta.category) || [];
    arr.push(m);
    byCat.set(m.meta.category, arr);
  }

  const cats = Array.from(byCat.keys()).sort();
  for (const cat of cats) {
    lines.push(`${beautifyCategory(cat)}:`);
    const arr = byCat
      .get(cat)!
      .sort((a, b) => b.score - a.score || sorter(a.meta, b.meta));
    for (const { meta } of arr) {
      const alias =
        opts.showAliases && meta.aliases?.length
          ? ` (aka: ${meta.aliases.join(", ")})`
          : "";
      const tags = formatTags(meta);
      const badge = meta.level === "secondary" ? "· " : ""; // 二階層は軽い印
      lines.push(
        `  ${badge}${padCmd(meta.name, colCmd)} ${truncate((meta.title ?? "") + alias + tags, width - colCmd - 6)}`,
      );
    }
    lines.push("");
  }

  lines.push(
    `Tip: /help <category> で該当カテゴリを展開, /help --all${advanced ? "" : ", /help --advanced"}`,
  );
  return lines.join("\n");

  function fuzzyScore(m: CommandMeta, q: string, mode: "any" | "all"): number {
    const tokens = q.split(/\s+/).filter(Boolean);
    const hay = [
      m.name.toLowerCase(),
      (m.title ?? "").toLowerCase(),
      m.category.toLowerCase(),
      ...(m.aliases ?? []).map((a) => a.toLowerCase()),
    ].join(" | ");

    let totalScore = 0;
    let matchedTokens = 0;

    for (const token of tokens) {
      let tokenScore = 0;

      // Exact match: 10000 points
      if (
        m.name.toLowerCase() === token ||
        m.name.toLowerCase() === "/" + token
      ) {
        tokenScore = 10000;
      }
      // Exact match in aliases
      else if (
        m.aliases?.some(
          (a) => a.toLowerCase() === token || a.toLowerCase() === "/" + token,
        )
      ) {
        tokenScore = 8000;
      }
      // Prefix match: 5000 points
      else if (m.name.toLowerCase().startsWith("/" + token)) {
        tokenScore = 5000;
      }
      // Contains in name: 3000 points
      else if (m.name.toLowerCase().includes(token)) {
        tokenScore = 3000;
      }
      // Word boundary match
      else if (
        m.name.split(/[\s\/]+/).some((w) => w.toLowerCase().startsWith(token))
      ) {
        tokenScore = 2000;
      }
      // Title match: 1000 points
      else if (m.title?.toLowerCase().includes(token)) {
        tokenScore = 1000;
      }
      // Category match: 500 points
      else if (m.category.toLowerCase().includes(token)) {
        tokenScore = 500;
      }

      if (tokenScore > 0) {
        matchedTokens++;
        totalScore += tokenScore;
      }
    }

    // AND mode: require all tokens to match
    if (mode === "all" && matchedTokens < tokens.length) {
      return 0;
    }

    // OR mode: at least one token must match
    if (mode === "any" && matchedTokens === 0) {
      return 0;
    }

    // Boost by usage frequency if available
    if (m.usage?.frequency) {
      totalScore *= 1 + Math.min(m.usage.frequency / 100, 2);
    }

    // Penalize deprecated/experimental
    if (m.tags?.includes("deprecated")) totalScore *= 0.5;
    if (m.tags?.includes("experimental")) totalScore *= 0.8;

    return totalScore;
  }
}
