/**
 * Actuators - Applies parameter changes to the system
 */

import * as fs from "fs/promises";
import * as path from "path";
import { EvolutionParams } from "./ParamSpace";

export interface ActuatorOptions {
  dryRun?: boolean;
}

export class Actuators {
  private configPath = path.join(process.cwd(), "config", "search-config.json");
  private currentOverlay: any = {};

  /**
   * Apply parameters to the system (temporary or permanent)
   */
  async applyParameters(
    params: EvolutionParams,
    options: ActuatorOptions = {},
  ): Promise<void> {
    // Build configuration overlay
    this.currentOverlay = {
      search: {
        rrf: {
          weights: {
            bm25: params.rrf.bm25,
            vector: params.rrf.vector,
            kg: params.rrf.kg,
          },
        },
        topK: params.topK,
        kgBoost: {
          alpha: params.kgBoost.alpha,
          beta: params.kgBoost.beta,
          gamma: params.kgBoost.gamma,
        },
      },
      cache: params.cache
        ? {
            ttl: params.cache.ttl,
            maxSize: params.cache.maxSize,
          }
        : undefined,
    };

    // Add cross-encoder configuration if enabled
    if (params.crossEncoder?.enabled) {
      this.currentOverlay.search.crossEncoder = {
        enabled: true,
        batchSize: params.crossEncoder.batchSize || 32,
        topN: params.crossEncoder.topN || 100,
      };
    } else {
      this.currentOverlay.search.crossEncoder = {
        enabled: false,
      };
    }

    // Apply changes if not dry run
    if (!options.dryRun) {
      await this.commitParameters(params);
    }
  }

  /**
   * Commit parameters permanently
   */
  async commitParameters(params: EvolutionParams): Promise<void> {
    // Read existing configuration
    let config = {};
    try {
      const content = await fs.readFile(this.configPath, "utf-8");
      config = JSON.parse(content);
    } catch (error) {
      // Start with empty config if file doesn't exist
    }

    // Deep merge overlay with existing config
    const merged = this.deepMerge(config, this.currentOverlay);

    // Write updated configuration
    const dir = path.dirname(this.configPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(merged, null, 2));

    // Also update language-specific configurations if needed
    if (params.language) {
      await this.updateLanguageConfig(params);
    }

    // Update model configurations if needed
    if (params.modelUpdate) {
      await this.updateModelConfig(params);
    }

    // Update analyzer configurations if needed
    if (params.analyzerChange) {
      await this.updateAnalyzerConfig(params);
    }
  }

  /**
   * Get current overlay (for testing/debugging)
   */
  getCurrentOverlay(): any {
    return this.currentOverlay;
  }

  /**
   * Reset overlay
   */
  resetOverlay(): void {
    this.currentOverlay = {};
  }

  private async updateLanguageConfig(params: EvolutionParams): Promise<void> {
    const langConfigPath = path.join(
      process.cwd(),
      "config",
      "language-config.json",
    );

    const languageConfig = {
      [params.language!]: {
        rrf: {
          bm25: params.rrf.bm25,
          vector: params.rrf.vector,
          kg: params.rrf.kg,
        },
        analyzer: this.getAnalyzerForLanguage(params.language!),
      },
    };

    let existing = {};
    try {
      const content = await fs.readFile(langConfigPath, "utf-8");
      existing = JSON.parse(content);
    } catch (error) {
      // Start fresh if doesn't exist
    }

    const merged = this.deepMerge(existing, languageConfig);
    await fs.writeFile(langConfigPath, JSON.stringify(merged, null, 2));
  }

  private async updateModelConfig(params: EvolutionParams): Promise<void> {
    const _modelConfigPath = path.join(
      process.cwd(),
      "config",
      "model-config.json",
    );

    // This would update model configurations
    // For now, just log the intent
    console.log("Model update requested but not implemented:", params);
  }

  private async updateAnalyzerConfig(params: EvolutionParams): Promise<void> {
    const _analyzerConfigPath = path.join(
      process.cwd(),
      "config",
      "analyzer-config.json",
    );

    // This would update analyzer configurations
    // For now, just log the intent
    console.log("Analyzer change requested but not implemented:", params);
  }

  private getAnalyzerForLanguage(language: string): string {
    const analyzers: Record<string, string> = {
      ja: "kuromoji",
      en: "standard",
      zh: "smartcn",
      ko: "nori",
      es: "spanish",
      fr: "french",
      de: "german",
    };
    return analyzers[language] || "standard";
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (
        source[key] &&
        typeof source[key] === "object" &&
        !Array.isArray(source[key])
      ) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }
}
