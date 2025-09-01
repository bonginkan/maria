import { BaseService } from "../../internal-mode/core/BaseService";
import fs from "node:fs/promises";
import path from "node:path";

export class BriefService extends BaseService {
  id = "brief-service";
  version = "1.0.0";

  async create(prompt: string): Promise<{ path: string; content: string }> {
    const briefTemplate = `# Creative Brief

## 背景
- **プロジェクト内容**: ${prompt}
- **生成日時**: ${new Date().toLocaleString("ja-JP")}

## 要件分析
${this.parseRequirements(prompt)}

## ブランドガイド (推奨)
- キーワード: ${this.extractKeywords(prompt)}
- トーン&マナー: プロフェッショナル・簡潔・信頼感

## 成果物 (推奨スコープ)
- Web: LP/Feature/Pricing/Contact
- Banner: 各種SNS/広告サイズ対応
- Video: ショート動画・ティザー

## 制約/ガバナンス
- 外部素材の利用禁止(自社生成/社内素材のみ)
- アクセシビリティ対応必須
- パフォーマンス最適化
- 承認フロー: PM/Brand の2者承認

## 次のステップ
1. /design analyze --competitor [競合URL] でブランド分析
2. /design web --profile=landing --a11y --perf でWeb SOW生成
3. /design wireframe --pages Home,Pricing,Contact でワイヤーフレーム作成
`;

    const outputPath = "docs/brief.md";
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, briefTemplate);

    return {
      path: outputPath,
      content: briefTemplate,
    };
  }

  private parseRequirements(prompt: string): string {
    const lines: string[] = [];

    if (prompt.includes("CVR") || prompt.includes("コンバージョン")) {
      const cvrMatch = prompt.match(/CVR?\s*[=::]\s*(\d+%?)/i);
      if (cvrMatch) lines.push(`- **目標CVR**: ${cvrMatch[1]}`);
    }

    if (prompt.includes("B2B") || prompt.includes("SaaS")) {
      lines.push("- **ターゲット**: B2Bビジネス向け");
    }

    if (prompt.includes("ランディング") || prompt.includes("LP")) {
      lines.push("- **ページタイプ**: ランディングページ");
    }

    if (prompt.includes("ミニマル") || prompt.includes("シンプル")) {
      lines.push("- **デザインスタイル**: ミニマル・シンプル");
    }

    return lines.length > 0
      ? lines.join("\n")
      : "- プロンプトから自動分析された要件";
  }

  private extractKeywords(prompt: string): string {
    const keywords: string[] = [];

    if (prompt.includes("信頼")) keywords.push("信頼感");
    if (prompt.includes("ミニマル")) keywords.push("ミニマル");
    if (prompt.includes("スピード")) keywords.push("スピード感");
    if (prompt.includes("プロフェッショナル"))
      keywords.push("プロフェッショナル");
    if (prompt.includes("革新") || prompt.includes("イノベーション"))
      keywords.push("革新性");

    return keywords.length > 0
      ? keywords.join(" / ")
      : "プロフェッショナル / 信頼感 / 効率性";
  }
}
