/**
 * Full Help Renderer (/help --all)
 * - CommandMeta[] をカテゴリごとに"全展開"
 * - 表示順: category → primary → secondary(= parent グループ)
 * - hidden は advanced 指定で表示
 * - 端末幅で折り返しを最適化
 */

import type { CommandMeta, Level, Tag } from "../metadata-validator";
import { getResponsiveWidth } from "../../../ui/integrated-cli/responsive-width.js";

export interface FullHelpOptions {
  advanced?: boolean; // hidden/advanced も表示
  showAliases?: boolean; // エイリアス表示
  categoryOrder?: string[]; // カテゴリの固定順
  heading?: string; // 見出しテキスト
  width?: number; // 出力幅(未指定は process.stdout.columns)
}

export function renderFullHelp(
  metas: CommandMeta[],
  opts: FullHelpOptions = {},
): string {
  const {
    advanced = false,
    showAliases = false,
    categoryOrder,
    heading = "📖 MARIA Commands — Full Listing",
  } = opts;
  const width = opts.width ?? getResponsiveWidth({ marginLeft: 2, marginRight: 2 });
  const colCmd = Math.min(28, Math.max(16, Math.floor(width * 0.3)));

  // hidden を除外(advanced なら許可)
  const visible = advanced ? metas : metas.filter((m) => m.level !== "hidden");

  // カテゴリ別にまとめる
  const byCat = new Map<string, CommandMeta[]>();
  for (const m of visible) {
    const arr = byCat.get(m.category) || [];
    arr.push(m);
    byCat.set(m.category, arr);
  }

  // カテゴリ順(明示順→名前)
  const cats = Array.from(byCat.keys()).sort(
    (a, b) => categoryIndex(a) - categoryIndex(b) || a.localeCompare(b),
  );

  const out: string[] = [];
  out.push(heading, "");

  for (const cat of cats) {
    const list = (byCat.get(cat) || []).slice().sort(sorter);

    // primary と secondary に分ける
    const primaries = list.filter((m) => m.level === "primary" && !m.parent);
    const secondaries = list.filter((m) => m.level !== "primary" || m.parent);

    out.push(`${beautifyCategory(cat)} (${list.length})`, "");

    // 1) primary セクション
    if (primaries.length) {
      out.push("Primary:");
      for (const p of primaries) {
        out.push(`  ${padCmd(p.name, colCmd)} ${fmtDesc(p)}`);
      }
      out.push("");
    }

    // 2) secondary を親別に展開
    if (secondaries.length) {
      // parent が無い secondary は misc に寄せる
      const byParent = new Map<string, CommandMeta[]>();
      for (const s of secondaries) {
        const k = s.parent ?? "(misc)";
        const arr = byParent.get(k) || [];
        arr.push(s);
        byParent.set(k, arr);
      }
      const parents = Array.from(byParent.keys()).sort();

      for (const parent of parents) {
        const label = parent !== "(misc)" ? parent : "Subcommands";
        out.push(`${label}:`);
        const children = (byParent.get(parent) || []).slice().sort(sorter);
        for (const c of children) {
          out.push(`  ${padCmd(c.name, colCmd)} ${fmtDesc(c)}`);
        }
        out.push("");
      }
    }

    // カテゴリ毎の区切り
    out.push("");
  }

  // フッタ(Tips と総数)
  out.push(
    `Tip: /help <category> でカテゴリ別、/help --search <kw> で絞り込み、/help でコンパクト表示`,
    `Total: ${metas.length} commands across ${cats.length} categories${advanced ? " (advanced shown)" : ""}`,
  );

  return out.join("\n");

  // ---- helpers ----
  function sorter(a: CommandMeta, b: CommandMeta) {
    if ((a.rank ?? 999999) !== (b.rank ?? 999999))
      return (a.rank ?? 999999) - (b.rank ?? 999999);
    return a.name.localeCompare(b.name);
  }

  function categoryIndex(cat: string): number {
    if (!categoryOrder) return 0;
    const i = categoryOrder.indexOf(cat);
    return i === -1 ? 9999 : i;
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

  function fmtDesc(m: CommandMeta): string {
    const alias =
      showAliases && m.aliases?.length ? ` (aka: ${m.aliases.join(", ")})` : "";
    const tags = m.tags && m.tags.length ? `  [${m.tags.join(",")}]` : "";
    const text = ((m.title ?? "") + alias + tags).trim();
    return truncate(text, Math.max(8, width - colCmd - 4));
  }
}
