/**
 * Explain/Provenance API for Graph RAG 10T
 * 
 * Provides transparency into the search pipeline by exposing:
 * - Step-by-step search process breakdown
 * - Score contributions from each component (BM25, Vector, KG)
 * - Evidence and citation tracking
 * - Attribution for ranking decisions
 */

import { performance } from 'node:perf_hooks';

// Mock services - replace with actual implementations
class MockHybridRetriever {
  async search(query, options = {}) {
    // Simulate search with attribution
    return {
      bm25Results: [
        { id: 'doc1', score: 2.45, title: 'Project A Requirements' },
        { id: 'doc2', score: 1.89, title: 'Design Guidelines' }
      ],
      vectorResults: [
        { id: 'doc1', score: 0.87, similarity: 0.87 },
        { id: 'doc3', score: 0.76, similarity: 0.76 }
      ],
      kgResults: [
        { id: 'doc1', score: 0.34, features: { mentions: 3, jaccard: 0.45, pagerank: 0.12 } },
        { id: 'doc2', score: 0.28, features: { mentions: 2, jaccard: 0.38, pagerank: 0.08 } }
      ]
    };
  }
}

class MockCrossEncoderReranker {
  async rerank(query, candidates, options = {}) {
    // Simulate reranking with attribution
    return candidates.map((candidate, index) => ({
      ...candidate,
      rerankScore: Math.max(0.1, candidate.score * (1 - index * 0.1)),
      rerankReason: index === 0 ? 'High semantic relevance' : 'Lower semantic match'
    }));
  }
}

/**
 * Result Attribution Service
 * Tracks how each result got its final ranking
 */
class ResultAttribution {
  constructor() {
    this.steps = [];
  }

  /**
   * Record a pipeline step with its contributions
   */
  recordStep(name, data) {
    const step = {
      name,
      timestamp: performance.now(),
      data,
      contributions: this.calculateContributions(name, data)
    };
    
    this.steps.push(step);
    return step;
  }

  /**
   * Calculate score contributions for a step
   */
  calculateContributions(stepName, data) {
    switch (stepName) {
      case 'BM25':
        return data.map(item => ({
          id: item.id,
          component: 'bm25',
          score: item.score,
          rank: data.indexOf(item) + 1,
          explanation: `Full-text match score: ${item.score.toFixed(2)}`
        }));

      case 'Vector':
        return data.map(item => ({
          id: item.id,
          component: 'vector',
          score: item.score,
          similarity: item.similarity,
          rank: data.indexOf(item) + 1,
          explanation: `Semantic similarity: ${(item.similarity * 100).toFixed(1)}%`
        }));

      case 'KGBoost':
        return data.map(item => ({
          id: item.id,
          component: 'kg',
          score: item.score,
          features: item.features,
          rank: data.indexOf(item) + 1,
          explanation: this.formatKGExplanation(item.features)
        }));

      case 'RRF':
        return data.map(item => ({
          id: item.id,
          component: 'fusion',
          score: item.rrfScore,
          ranks: item.sourceRanks,
          rank: data.indexOf(item) + 1,
          explanation: `Combined from ranks: ${Object.values(item.sourceRanks || {}).join(', ')}`
        }));

      case 'Rerank':
        return data.map(item => ({
          id: item.id,
          component: 'rerank',
          score: item.rerankScore,
          originalScore: item.originalScore,
          boost: item.rerankScore - (item.originalScore || 0),
          rank: data.indexOf(item) + 1,
          explanation: item.rerankReason || 'Cross-encoder reranking applied'
        }));

      default:
        return [];
    }
  }

  /**
   * Format KG features into human-readable explanation
   */
  formatKGExplanation(features) {
    if (!features) return 'Knowledge graph boost applied';
    
    const parts = [];
    if (features.mentions) parts.push(`${features.mentions} entity mentions`);
    if (features.jaccard) parts.push(`${(features.jaccard * 100).toFixed(1)}% topic overlap`);
    if (features.pagerank) parts.push(`PageRank: ${features.pagerank.toFixed(3)}`);
    
    return parts.length > 0 ? parts.join(', ') : 'Knowledge graph features applied';
  }

  /**
   * Get complete attribution trace
   */
  getAttribution() {
    return {
      steps: this.steps,
      timeline: this.steps.map(s => ({
        name: s.name,
        timestamp: s.timestamp,
        duration: 0 // TODO: Calculate from next step
      })),
      summary: this.generateSummary()
    };
  }

  /**
   * Generate summary of the search process
   */
  generateSummary() {
    const stepNames = this.steps.map(s => s.name);
    const totalSteps = stepNames.length;
    const pipeline = stepNames.join(' → ');
    
    return {
      totalSteps,
      pipeline,
      componentsUsed: [...new Set(stepNames)],
      finalRanking: this.getFinalRanking()
    };
  }

  /**
   * Get final ranking with full attribution
   */
  getFinalRanking() {
    const lastStep = this.steps[this.steps.length - 1];
    if (!lastStep) return [];

    return lastStep.data.map((item, index) => ({
      rank: index + 1,
      id: item.id,
      title: item.title || item.id,
      finalScore: item.rerankScore || item.rrfScore || item.score,
      attribution: this.getItemAttribution(item.id)
    }));
  }

  /**
   * Get complete attribution for a specific item
   */
  getItemAttribution(itemId) {
    const itemSteps = [];
    
    for (const step of this.steps) {
      const contribution = step.contributions.find(c => c.id === itemId);
      if (contribution) {
        itemSteps.push({
          step: step.name,
          contribution
        });
      }
    }
    
    return itemSteps;
  }
}

/**
 * Evidence Collector
 * Tracks document snippets and citations that support results
 */
class EvidenceCollector {
  constructor() {
    this.evidence = new Map();
  }

  /**
   * Add evidence for a document
   */
  addEvidence(docId, snippet, source, highlights = []) {
    if (!this.evidence.has(docId)) {
      this.evidence.set(docId, {
        id: docId,
        snippets: [],
        sources: new Set(),
        highlights: []
      });
    }

    const doc = this.evidence.get(docId);
    doc.snippets.push(snippet);
    doc.sources.add(source);
    doc.highlights.push(...highlights);
  }

  /**
   * Get all evidence
   */
  getEvidence() {
    const result = [];
    
    for (const [docId, evidence] of this.evidence) {
      result.push({
        ...evidence,
        sources: Array.from(evidence.sources),
        confidence: this.calculateConfidence(evidence)
      });
    }
    
    return result;
  }

  /**
   * Calculate confidence score for evidence
   */
  calculateConfidence(evidence) {
    // Simple heuristic based on number of sources and snippets
    const sourceScore = Math.min(evidence.sources.size / 3, 1) * 0.6;
    const snippetScore = Math.min(evidence.snippets.length / 2, 1) * 0.4;
    
    return sourceScore + snippetScore;
  }
}

/**
 * Main explainable search function
 */
async function explainableSearch(query, options = {}) {
  const attribution = new ResultAttribution();
  const evidence = new EvidenceCollector();
  const startTime = performance.now();
  
  try {
    // Initialize services
    const retriever = new MockHybridRetriever();
    const reranker = new MockCrossEncoderReranker();
    
    console.log(`🔍 Starting explainable search for: "${query}"`);
    
    // Step 1: Hybrid retrieval
    const retrievalResults = await retriever.search(query, options);
    
    // Record BM25 step
    attribution.recordStep('BM25', retrievalResults.bm25Results);
    
    // Record Vector step
    attribution.recordStep('Vector', retrievalResults.vectorResults);
    
    // Record KG step (if enabled)
    if (options.kgBoost) {
      attribution.recordStep('KGBoost', retrievalResults.kgResults);
    }
    
    // Step 2: Reciprocal Rank Fusion
    const fusedResults = await performRRF(retrievalResults, options);
    attribution.recordStep('RRF', fusedResults);
    
    // Step 3: Cross-encoder reranking (if enabled)
    let finalResults = fusedResults;
    if (options.rerank) {
      finalResults = await reranker.rerank(query, fusedResults, options);
      attribution.recordStep('Rerank', finalResults);
    }
    
    // Collect evidence for top results
    for (const result of finalResults.slice(0, 5)) {
      evidence.addEvidence(
        result.id,
        `Sample snippet for ${result.title}`,
        'mock_source',
        ['highlighted', 'terms']
      );
    }
    
    const totalTime = performance.now() - startTime;
    
    return {
      query,
      results: finalResults,
      attribution: attribution.getAttribution(),
      evidence: evidence.getEvidence(),
      metadata: {
        totalTime: totalTime.toFixed(2),
        timestamp: new Date().toISOString(),
        options: options
      }
    };
    
  } catch (error) {
    console.error('Explainable search failed:', error);
    throw error;
  }
}

/**
 * Mock RRF implementation
 */
async function performRRF(retrievalResults, options = {}) {
  const { bm25Results, vectorResults, kgResults } = retrievalResults;
  const weights = options.weights || { bm25: 0.4, vector: 0.35, kg: 0.25 };
  
  // Create unified result set
  const allDocs = new Map();
  
  // Add BM25 results
  bm25Results.forEach((doc, index) => {
    allDocs.set(doc.id, {
      ...doc,
      bm25Rank: index + 1,
      bm25Score: doc.score,
      sourceRanks: { bm25: index + 1 }
    });
  });
  
  // Add vector results
  vectorResults.forEach((doc, index) => {
    if (allDocs.has(doc.id)) {
      const existing = allDocs.get(doc.id);
      existing.vectorRank = index + 1;
      existing.vectorScore = doc.score;
      existing.sourceRanks.vector = index + 1;
    } else {
      allDocs.set(doc.id, {
        ...doc,
        vectorRank: index + 1,
        vectorScore: doc.score,
        sourceRanks: { vector: index + 1 }
      });
    }
  });
  
  // Add KG results (if any)
  if (kgResults) {
    kgResults.forEach((doc, index) => {
      if (allDocs.has(doc.id)) {
        const existing = allDocs.get(doc.id);
        existing.kgRank = index + 1;
        existing.kgScore = doc.score;
        existing.sourceRanks.kg = index + 1;
      } else {
        allDocs.set(doc.id, {
          ...doc,
          kgRank: index + 1,
          kgScore: doc.score,
          sourceRanks: { kg: index + 1 }
        });
      }
    });
  }
  
  // Calculate RRF scores
  const k = 60; // RRF constant
  const results = Array.from(allDocs.values()).map(doc => {
    let rrfScore = 0;
    
    if (doc.bm25Rank) {
      rrfScore += weights.bm25 / (k + doc.bm25Rank);
    }
    if (doc.vectorRank) {
      rrfScore += weights.vector / (k + doc.vectorRank);
    }
    if (doc.kgRank) {
      rrfScore += weights.kg / (k + doc.kgRank);
    }
    
    return {
      ...doc,
      rrfScore,
      originalScore: doc.bm25Score || doc.vectorScore || doc.kgScore
    };
  });
  
  // Sort by RRF score
  return results.sort((a, b) => b.rrfScore - a.rrfScore);
}

/**
 * Express.js route handlers
 */

/**
 * POST /api/explain
 * Main explain endpoint
 */
export async function postExplain(req, res) {
  try {
    const { query, options = {} } = req.body;
    
    if (!query) {
      return res.status(400).json({
        error: 'Query is required',
        code: 'MISSING_QUERY'
      });
    }
    
    console.log(`📊 Explain request: "${query}" with options:`, options);
    
    const result = await explainableSearch(query, options);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('Explain API error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      code: 'EXPLAIN_FAILED'
    });
  }
}

/**
 * GET /api/explain/:query
 * Simple GET endpoint for basic explanations
 */
export async function getExplain(req, res) {
  try {
    const query = req.params.query;
    const options = {
      kgBoost: req.query.kgBoost === 'true',
      rerank: req.query.rerank === 'true',
      topK: parseInt(req.query.topK) || 10
    };
    
    const result = await explainableSearch(query, options);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('Explain API error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      code: 'EXPLAIN_FAILED'
    });
  }
}

/**
 * POST /api/explain/batch
 * Batch explain endpoint for multiple queries
 */
export async function postExplainBatch(req, res) {
  try {
    const { queries, options = {} } = req.body;
    
    if (!queries || !Array.isArray(queries)) {
      return res.status(400).json({
        error: 'Queries array is required',
        code: 'MISSING_QUERIES'
      });
    }
    
    const results = await Promise.all(
      queries.map(async (query) => {
        try {
          return await explainableSearch(query.text || query, {
            ...options,
            ...query.options
          });
        } catch (error) {
          return {
            query: query.text || query,
            error: error.message
          };
        }
      })
    );
    
    res.json({
      success: true,
      data: results
    });
    
  } catch (error) {
    console.error('Batch explain API error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      code: 'BATCH_EXPLAIN_FAILED'
    });
  }
}

// Export classes for testing
export {
  ResultAttribution,
  EvidenceCollector,
  explainableSearch
};