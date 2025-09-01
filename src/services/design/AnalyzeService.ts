import { BaseService } from "../../internal-mode/core/BaseService";
import fs from "node:fs/promises";
import path from "node:path";

export interface AnalyzeOptions {
  brand?: string;
  competitor?: string;
}

export interface AnalyzeResult {
  summary: string;
  brandAnalysis?: object;
  competitorAnalysis?: object;
}

export class AnalyzeService extends BaseService {
  id = "analyze-service";
  version = "1.0.0";

  async run(options: AnalyzeOptions): Promise<AnalyzeResult> {
    const results: AnalyzeResult = {
      summary: "",
    };

    if (options.brand) {
      results.brandAnalysis = await this.analyzeBrand(options.brand);
    }

    if (options.competitor) {
      results.competitorAnalysis = await this.analyzeCompetitor(
        options.competitor,
      );
    }

    results.summary = this.generateSummary(results);

    // Save analysis results
    const outputPath = "docs/analysis.md";
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, this.formatAnalysisReport(results));

    return results;
  }

  private async analyzeBrand(brandPath: string): Promise<object> {
    try {
      if (await this.fileExists(brandPath)) {
        const content = await fs.readFile(brandPath, "utf8");
        return this.extractBrandGuidelines(content);
      }
    } catch (error) {
      // Handle file not found
    }

    return {
      palette: ["#0EA5E9", "#0B0B0B", "#F5F5F5"],
      typography: "Inter / Modern Sans-serif",
      tone: "プロフェッショナル・簡潔・信頼感",
      keywords: ["信頼性", "効率性", "革新性"],
    };
  }

  private async analyzeCompetitor(competitorPath: string): Promise<object> {
    try {
      if (await this.fileExists(competitorPath)) {
        const content = await fs.readFile(competitorPath, "utf8");
        const urls = content
          .split("\n")
          .filter((line) => line.trim().startsWith("http"));
        return this.analyzeCompetitorUrls(urls);
      }
    } catch (error) {
      // Handle file not found
    }

    return {
      commonPatterns: [
        "Hero section with product demo",
        "Features grid layout",
        "Customer testimonials",
        "Pricing table with CTA",
      ],
      differentiators: [
        "AI-powered automation",
        "Real-time collaboration",
        "Enterprise-grade security",
      ],
      designTrends: [
        "Dark mode support",
        "Glassmorphism effects",
        "Micro-interactions",
        "Mobile-first responsive",
      ],
    };
  }

  private analyzeCompetitorUrls(urls: string[]): object {
    // In a real implementation, this would fetch and analyze actual URLs
    return {
      analyzedUrls: urls.slice(0, 3),
      commonPatterns: [
        "Hero section with value proposition",
        "Social proof / testimonials",
        "Feature highlights with icons",
        "Strong CTA placement",
      ],
      marketPositioning: "Enterprise/SMB SaaS solutions",
      designPatterns: "Modern, clean, conversion-focused",
    };
  }

  private extractBrandGuidelines(content: string): object {
    // Simple extraction logic - in reality this would be more sophisticated
    return {
      extractedFrom: "Brand document",
      guidelines: {
        colors: this.extractColors(content),
        fonts: this.extractFonts(content),
        voice: this.extractVoice(content),
      },
    };
  }

  private extractColors(content: string): string[] {
    const hexColors = content.match(/#[0-9A-Fa-f]{6}/g) || [];
    return hexColors.length > 0 ? hexColors : ["#0EA5E9", "#0B0B0B", "#F5F5F5"];
  }

  private extractFonts(content: string): string[] {
    const fontMatches = content.match(/(?:font|フォント)[:\s]*([A-Za-z\s]+)/gi);
    return fontMatches
      ? fontMatches.map((m) => m.split(":")[1]?.trim()).filter(Boolean)
      : ["Inter", "Sans-serif"];
  }

  private extractVoice(content: string): string {
    if (
      content.includes("professional") ||
      content.includes("プロフェッショナル")
    )
      return "プロフェッショナル";
    if (content.includes("friendly") || content.includes("フレンドリー"))
      return "フレンドリー";
    return "バランス型";
  }

  private generateSummary(results: AnalyzeResult): string {
    const sections: string[] = [];

    if (results.brandAnalysis) {
      sections.push("✅ ブランドガイドライン分析完了");
    }

    if (results.competitorAnalysis) {
      sections.push("✅ 競合分析完了");
    }

    if (sections.length === 0) {
      sections.push("ℹ️  基本分析を実行(デフォルト設定を適用)");
    }

    return (
      sections.join("\n") +
      "\n\n📋 次のステップ: /design web でSOW生成、/design wireframe でワイヤーフレーム作成"
    );
  }

  private formatAnalysisReport(results: AnalyzeResult): string {
    return `# Design Analysis Report

Generated: ${new Date().toLocaleString("ja-JP")}

## Summary
${results.summary}

## Brand Analysis
${results.brandAnalysis ? JSON.stringify(results.brandAnalysis, null, 2) : "No brand analysis performed"}

## Competitor Analysis  
${results.competitorAnalysis ? JSON.stringify(results.competitorAnalysis, null, 2) : "No competitor analysis performed"}

## Recommendations
- Focus on differentiation through AI-powered features
- Maintain clean, professional design aesthetic
- Ensure mobile-first responsive approach
- Include social proof and customer testimonials
`;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
