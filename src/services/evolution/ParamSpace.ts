/**
 * Parameter Space Explorer - Generates experiment candidates
 */

import { EvolutionPolicy } from "./Policy";

export interface EvolutionParams {
  rrf: {
    bm25: number;
    vector: number;
    kg: number;
  };
  topK: number;
  kgBoost: {
    alpha: number;
    beta: number;
    gamma: number;
  };
  crossEncoder?: {
    enabled: boolean;
    batchSize?: number;
    topN?: number;
  };
  cache?: {
    ttl: number;
    maxSize: number;
  };
  language?: string;
  analyzerChange?: boolean;
  indexSchemaChange?: boolean;
  modelUpdate?: boolean;
}

export interface GPUInfo {
  available: boolean;
  type?: "metal" | "cuda" | "rocm";
  vram?: number;
  compute?: number;
}

export class ParamSpace {
  /**
   * Generate experiment candidates based on policy and GPU availability
   */
  static suggestCandidates(
    baseParams: EvolutionParams,
    policy: EvolutionPolicy,
    gpu: GPUInfo,
    profile: string,
  ): EvolutionParams[] {
    const candidates: EvolutionParams[] = [];
    const profileConfig =
      policy.profiles[profile as keyof typeof policy.profiles];
    const explorationRate = profileConfig?.explorationRate || 0.1;

    // Generate RRF weight variations
    const rrfCandidates = this.generateRRFCandidates(
      baseParams,
      explorationRate,
    );

    // Generate TopK variations
    const topKValues = this.generateTopKValues(baseParams, gpu, policy);

    // Generate KG boost variations
    const kgBoostVariations = this.generateKGBoostVariations(
      baseParams,
      explorationRate,
    );

    // Combine variations
    for (const rrf of rrfCandidates) {
      for (const topK of topKValues) {
        for (const kgBoost of kgBoostVariations) {
          const candidate: EvolutionParams = {
            ...baseParams,
            rrf,
            topK,
            kgBoost,
          };

          // Add GPU-specific parameters
          if (gpu.available && policy.gpu?.optimization?.enableWhenAvailable) {
            candidate.crossEncoder = {
              enabled: true,
              batchSize: this.selectBatchSize(gpu, policy),
              topN: Math.min(topK * 2, 200),
            };
          } else if (!gpu.available && policy.gpu?.fallback) {
            // Apply fallback strategy
            if (policy.gpu.fallback.disableReranker) {
              candidate.crossEncoder = { enabled: false };
            }
            if (policy.gpu.fallback.reduceTopK) {
              candidate.topK = Math.floor(
                topK * policy.gpu.fallback.reduceTopK,
              );
            }
            if (policy.gpu.fallback.increaseCacheTTL && candidate.cache) {
              candidate.cache.ttl *= policy.gpu.fallback.increaseCacheTTL;
            }
          }

          candidates.push(candidate);
        }
      }
    }

    // Limit candidates based on profile
    const maxExperiments = profileConfig?.maxExperiments || 5;
    return this.selectBestCandidates(candidates, maxExperiments, policy);
  }

  private static generateRRFCandidates(
    base: EvolutionParams,
    explorationRate: number,
  ): Array<{ bm25: number; vector: number; kg: number }> {
    const candidates = [];
    const delta = explorationRate;

    // Keep sum of weights = 1.0
    candidates.push(base.rrf); // Include current

    // Adjust BM25 weight
    candidates.push({
      bm25: Math.min(0.6, base.rrf.bm25 + delta),
      vector: Math.max(0.2, base.rrf.vector - delta / 2),
      kg: Math.max(0.1, base.rrf.kg - delta / 2),
    });

    // Adjust Vector weight
    candidates.push({
      bm25: Math.max(0.2, base.rrf.bm25 - delta / 2),
      vector: Math.min(0.6, base.rrf.vector + delta),
      kg: Math.max(0.1, base.rrf.kg - delta / 2),
    });

    // Adjust KG weight
    candidates.push({
      bm25: Math.max(0.2, base.rrf.bm25 - delta / 2),
      vector: Math.max(0.2, base.rrf.vector - delta / 2),
      kg: Math.min(0.3, base.rrf.kg + delta),
    });

    // Normalize weights to sum to 1.0
    return candidates.map((weights) => {
      const sum = weights.bm25 + weights.vector + weights.kg;
      return {
        bm25: Number((weights.bm25 / sum).toFixed(3)),
        vector: Number((weights.vector / sum).toFixed(3)),
        kg: Number((weights.kg / sum).toFixed(3)),
      };
    });
  }

  private static generateTopKValues(
    base: EvolutionParams,
    gpu: GPUInfo,
    policy: EvolutionPolicy,
  ): number[] {
    const values = [];
    const baseTopK = base.topK || 50;

    if (gpu.available) {
      // GPU available - can handle larger TopK
      values.push(baseTopK);
      values.push(Math.min(120, baseTopK + 20));
      values.push(Math.min(100, baseTopK + 10));
    } else {
      // CPU only - keep TopK moderate
      values.push(baseTopK);
      values.push(Math.max(30, baseTopK - 10));
      values.push(Math.min(60, baseTopK + 10));
    }

    return [...new Set(values)]; // Remove duplicates
  }

  private static generateKGBoostVariations(
    base: EvolutionParams,
    explorationRate: number,
  ): Array<{ alpha: number; beta: number; gamma: number }> {
    const variations = [];
    const delta = explorationRate * 0.5; // Smaller changes for KG boost

    variations.push(base.kgBoost); // Include current

    // Vary alpha (entity weight)
    variations.push({
      alpha: Math.min(0.3, base.kgBoost.alpha + delta),
      beta: base.kgBoost.beta,
      gamma: base.kgBoost.gamma,
    });

    // Vary beta (relation weight)
    variations.push({
      alpha: base.kgBoost.alpha,
      beta: Math.min(0.5, base.kgBoost.beta + delta),
      gamma: base.kgBoost.gamma,
    });

    // Vary gamma (path weight)
    variations.push({
      alpha: base.kgBoost.alpha,
      beta: base.kgBoost.beta,
      gamma: Math.min(0.15, base.kgBoost.gamma + delta),
    });

    return variations;
  }

  private static selectBatchSize(
    gpu: GPUInfo,
    policy: EvolutionPolicy,
  ): number {
    const vram = gpu.vram || 8;

    if (gpu.type === "metal") {
      // Apple Silicon unified memory
      if (vram >= 32) return 128;
      if (vram >= 16) return 64;
      return 32;
    } else {
      // CUDA/ROCm dedicated VRAM
      if (vram >= 24) return 128;
      if (vram >= 16) return 64;
      if (vram >= 8) return 32;
      return 16;
    }
  }

  private static selectBestCandidates(
    candidates: EvolutionParams[],
    maxCount: number,
    policy: EvolutionPolicy,
  ): EvolutionParams[] {
    // Score candidates based on expected improvement
    const scored = candidates.map((candidate) => {
      let score = 0;

      // Prefer balanced weights
      const rrfBalance =
        1 - Math.abs(candidate.rrf.bm25 - candidate.rrf.vector);
      score += rrfBalance * 0.3;

      // Prefer moderate TopK
      const topKScore = 1 - Math.abs(candidate.topK - 60) / 60;
      score += topKScore * 0.2;

      // Prefer KG boost in moderate range
      const kgScore = candidate.kgBoost.beta * 0.5;
      score += kgScore * 0.2;

      // Bonus for GPU optimization
      if (candidate.crossEncoder?.enabled) {
        score += 0.3;
      }

      return { candidate, score };
    });

    // Sort by score and take top candidates
    scored.sort((a, b) => b.score - a.score);

    // Include some random exploration
    const explorationCount = Math.ceil(maxCount * 0.2);
    const exploitCount = maxCount - explorationCount;

    const selected: EvolutionParams[] = [];

    // Take best candidates (exploitation)
    for (let i = 0; i < exploitCount && i < scored.length; i++) {
      selected.push(scored[i].candidate);
    }

    // Add random candidates (exploration)
    const remaining = scored.slice(exploitCount);
    for (let i = 0; i < explorationCount && remaining.length > 0; i++) {
      const idx = Math.floor(Math.random() * remaining.length);
      selected.push(remaining[idx].candidate);
      remaining.splice(idx, 1);
    }

    return selected;
  }
}
