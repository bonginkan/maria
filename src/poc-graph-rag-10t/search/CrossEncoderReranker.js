#!/usr/bin/env node
/**
 * CrossEncoderReranker.js
 * Advanced reranking using Cross-Encoder models for fine-tuned relevance
 * Supports multiple model backends and batch processing
 */

import fetch from 'node-fetch';
import { pipeline } from '@xenova/transformers';
import { performance } from 'perf_hooks';

class CrossEncoderReranker {
  constructor(config = {}) {
    this.config = {
      // Model configuration
      modelName: config.modelName || 'cross-encoder/ms-marco-MiniLM-L-6-v2',
      modelBackend: config.modelBackend || 'transformers', // 'transformers', 'openai', 'cohere'
      
      // API endpoints for external services
      openaiUrl: config.openaiUrl || 'https://api.openai.com/v1/embeddings',
      openaiKey: config.openaiKey || process.env.OPENAI_API_KEY,
      cohereUrl: config.cohereUrl || 'https://api.cohere.ai/v1/rerank',
      cohereKey: config.cohereKey || process.env.COHERE_API_KEY,
      
      // Reranking parameters
      topK: config.topK || 10,
      batchSize: config.batchSize || 32,
      maxSequenceLength: config.maxSequenceLength || 512,
      
      // Score thresholds
      minScore: config.minScore || 0.1,
      boostFactor: config.boostFactor || 1.5,
      
      // Performance
      useCache: config.useCache !== false,
      parallel: config.parallel !== false,
      timeout: config.timeout || 10000
    };
    
    // Model instance (lazy loaded)
    this.model = null;
    this.tokenizer = null;
    
    // Cache for reranking scores
    this.cache = new Map();
    
    // Metrics
    this.metrics = {
      totalReranks: 0,
      totalDocuments: 0,
      avgLatency: 0,
      cacheHits: 0
    };
  }

  /**
   * Initialize the model
   */
  async initialize() {
    if (this.model) return;
    
    console.log(`Initializing Cross-Encoder: ${this.config.modelName}`);
    
    switch (this.config.modelBackend) {
      case 'transformers':
        await this.initializeTransformers();
        break;
      case 'openai':
        await this.initializeOpenAI();
        break;
      case 'cohere':
        await this.initializeCohere();
        break;
      default:
        throw new Error(`Unknown model backend: ${this.config.modelBackend}`);
    }
    
    console.log('Cross-Encoder initialized');
  }

  /**
   * Initialize Transformers.js model
   */
  async initializeTransformers() {
    try {
      // Load cross-encoder pipeline
      this.model = await pipeline(
        'feature-extraction',
        this.config.modelName
      );
      
      // For cross-encoder, we need a different approach
      // This is a simplified version, production would use proper cross-encoder
      this.scoreFunction = async (query, documents) => {
        const scores = [];
        
        for (const doc of documents) {
          const input = `${query} [SEP] ${doc}`;
          const embeddings = await this.model(input);
          
          // Simple scoring based on embedding magnitude
          const score = embeddings.data.reduce((sum, val) => sum + Math.abs(val), 0) / embeddings.data.length;
          scores.push(score);
        }
        
        return scores;
      };
      
    } catch (error) {
      console.error('Failed to initialize Transformers model:', error);
      throw error;
    }
  }

  /**
   * Initialize OpenAI backend
   */
  async initializeOpenAI() {
    if (!this.config.openaiKey) {
      throw new Error('OpenAI API key not provided');
    }
    
    // OpenAI doesn't have a dedicated cross-encoder
    // We'll use similarity scoring as a proxy
    this.scoreFunction = async (query, documents) => {
      const response = await fetch(this.config.openaiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.openaiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'text-embedding-ada-002',
          input: [query, ...documents]
        })
      });
      
      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      const queryEmbedding = data.data[0].embedding;
      
      // Calculate cosine similarity
      const scores = data.data.slice(1).map(item => {
        const docEmbedding = item.embedding;
        return this.cosineSimilarity(queryEmbedding, docEmbedding);
      });
      
      return scores;
    };
  }

  /**
   * Initialize Cohere backend
   */
  async initializeCohere() {
    if (!this.config.cohereKey) {
      throw new Error('Cohere API key not provided');
    }
    
    this.scoreFunction = async (query, documents) => {
      const response = await fetch(this.config.cohereUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.cohereKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: query,
          documents: documents.map((doc, idx) => ({
            id: idx.toString(),
            text: doc
          })),
          top_n: documents.length,
          model: 'rerank-english-v2.0'
        })
      });
      
      if (!response.ok) {
        throw new Error(`Cohere API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Cohere returns ordered results, extract scores
      const scores = new Array(documents.length).fill(0);
      data.results.forEach(result => {
        scores[parseInt(result.id)] = result.relevance_score;
      });
      
      return scores;
    };
  }

  /**
   * Main reranking interface
   */
  async rerank(query, results, options = {}) {
    const startTime = performance.now();
    
    try {
      // Initialize model if needed
      await this.initialize();
      
      // Filter out results below minimum score
      const candidates = results.filter(r => 
        !this.config.minScore || r.score >= this.config.minScore
      );
      
      if (candidates.length === 0) {
        return [];
      }
      
      // Check cache
      const cacheKey = this.getCacheKey(query, candidates);
      if (this.config.useCache && this.cache.has(cacheKey)) {
        this.metrics.cacheHits++;
        return this.cache.get(cacheKey);
      }
      
      // Prepare documents for reranking
      const documents = candidates.map(result => 
        this.prepareDocument(result, options)
      );
      
      // Batch processing for large result sets
      const rerankedResults = await this.processInBatches(
        query,
        candidates,
        documents,
        options
      );
      
      // Apply final scoring adjustments
      const finalResults = this.applyFinalScoring(rerankedResults, options);
      
      // Get top K results
      const topResults = finalResults
        .sort((a, b) => b.rerankScore - a.rerankScore)
        .slice(0, options.topK || this.config.topK);
      
      // Cache results
      if (this.config.useCache) {
        this.cache.set(cacheKey, topResults);
        
        // Expire cache after 10 minutes
        setTimeout(() => this.cache.delete(cacheKey), 10 * 60 * 1000);
      }
      
      // Update metrics
      this.metrics.totalReranks++;
      this.metrics.totalDocuments += candidates.length;
      const latency = performance.now() - startTime;
      this.metrics.avgLatency = (this.metrics.avgLatency * (this.metrics.totalReranks - 1) + latency) / this.metrics.totalReranks;
      
      return topResults;
      
    } catch (error) {
      console.error('Reranking failed:', error);
      // Fallback to original ranking
      return results.slice(0, options.topK || this.config.topK);
    }
  }

  /**
   * Process documents in batches
   */
  async processInBatches(query, candidates, documents, options) {
    const batchSize = this.config.batchSize;
    const batches = [];
    
    // Split into batches
    for (let i = 0; i < documents.length; i += batchSize) {
      batches.push({
        candidates: candidates.slice(i, i + batchSize),
        documents: documents.slice(i, i + batchSize)
      });
    }
    
    // Process batches
    let allResults = [];
    
    if (this.config.parallel) {
      // Parallel processing
      const batchPromises = batches.map(batch => 
        this.processBatch(query, batch.candidates, batch.documents, options)
      );
      
      const batchResults = await Promise.all(batchPromises);
      allResults = batchResults.flat();
      
    } else {
      // Sequential processing
      for (const batch of batches) {
        const batchResults = await this.processBatch(
          query,
          batch.candidates,
          batch.documents,
          options
        );
        allResults.push(...batchResults);
      }
    }
    
    return allResults;
  }

  /**
   * Process a single batch
   */
  async processBatch(query, candidates, documents, options) {
    // Get cross-encoder scores
    const scores = await this.scoreFunction(query, documents);
    
    // Combine with original scores
    const rerankedResults = candidates.map((candidate, idx) => {
      const crossEncoderScore = scores[idx] || 0;
      
      // Weighted combination of original and cross-encoder scores
      const combinedScore = this.combineScores(
        candidate.score,
        crossEncoderScore,
        options
      );
      
      return {
        ...candidate,
        crossEncoderScore,
        rerankScore: combinedScore,
        originalRank: candidate.rank || idx + 1
      };
    });
    
    return rerankedResults;
  }

  /**
   * Prepare document for cross-encoder
   */
  prepareDocument(result, options) {
    let text = '';
    
    // Add title if available
    if (result.title) {
      text += result.title + '. ';
    }
    
    // Add content
    if (result.content) {
      text += result.content;
    } else if (result.snippet) {
      text += result.snippet;
    }
    
    // Add metadata if requested
    if (options.includeMetadata && result.metadata) {
      const metadataStr = this.formatMetadata(result.metadata);
      if (metadataStr) {
        text += ' ' + metadataStr;
      }
    }
    
    // Truncate to max sequence length
    if (text.length > this.config.maxSequenceLength) {
      text = text.substring(0, this.config.maxSequenceLength);
    }
    
    return text;
  }

  /**
   * Combine original and cross-encoder scores
   */
  combineScores(originalScore, crossEncoderScore, options) {
    const alpha = options.alpha || 0.3; // Weight for original score
    const beta = options.beta || 0.7;  // Weight for cross-encoder score
    
    // Normalize scores to [0, 1] range
    const normalizedOriginal = Math.min(1, Math.max(0, originalScore));
    const normalizedCrossEncoder = Math.min(1, Math.max(0, crossEncoderScore));
    
    // Weighted combination
    let combined = alpha * normalizedOriginal + beta * normalizedCrossEncoder;
    
    // Apply boost for high cross-encoder scores
    if (normalizedCrossEncoder > 0.8) {
      combined *= this.config.boostFactor;
    }
    
    return Math.min(1, combined);
  }

  /**
   * Apply final scoring adjustments
   */
  applyFinalScoring(results, options) {
    // Apply diversity penalty if requested
    if (options.diversityPenalty) {
      results = this.applyDiversityPenalty(results, options.diversityPenalty);
    }
    
    // Apply source boost if requested
    if (options.sourceBoost) {
      results = this.applySourceBoost(results, options.sourceBoost);
    }
    
    // Apply recency boost if requested
    if (options.recencyBoost) {
      results = this.applyRecencyBoost(results, options.recencyBoost);
    }
    
    return results;
  }

  /**
   * Apply diversity penalty to reduce redundancy
   */
  applyDiversityPenalty(results, penalty) {
    const seen = new Set();
    
    return results.map(result => {
      // Create a simple hash of the content
      const contentHash = this.simpleHash(result.content || result.title || '');
      
      // Check for similar content
      let diversityPenalty = 0;
      for (const hash of seen) {
        if (this.hashSimilarity(contentHash, hash) > 0.8) {
          diversityPenalty = penalty;
          break;
        }
      }
      
      seen.add(contentHash);
      
      return {
        ...result,
        rerankScore: result.rerankScore * (1 - diversityPenalty)
      };
    });
  }

  /**
   * Apply source-based score boost
   */
  applySourceBoost(results, sourceBoosts) {
    return results.map(result => {
      const source = result.metadata?.source || result.source;
      const boost = sourceBoosts[source] || 1.0;
      
      return {
        ...result,
        rerankScore: result.rerankScore * boost
      };
    });
  }

  /**
   * Apply recency boost based on document age
   */
  applyRecencyBoost(results, boostConfig) {
    const now = Date.now();
    const maxAge = boostConfig.maxAge || 30 * 24 * 60 * 60 * 1000; // 30 days
    
    return results.map(result => {
      const created = result.metadata?.created || result.created;
      if (!created) return result;
      
      const age = now - new Date(created).getTime();
      const ageFactor = Math.max(0, 1 - age / maxAge);
      const boost = 1 + (boostConfig.factor || 0.1) * ageFactor;
      
      return {
        ...result,
        rerankScore: result.rerankScore * boost
      };
    });
  }

  /**
   * Format metadata for inclusion in document
   */
  formatMetadata(metadata) {
    const relevant = [];
    
    if (metadata.labels && metadata.labels.length > 0) {
      relevant.push(`Labels: ${metadata.labels.join(', ')}`);
    }
    
    if (metadata.category) {
      relevant.push(`Category: ${metadata.category}`);
    }
    
    if (metadata.tags && metadata.tags.length > 0) {
      relevant.push(`Tags: ${metadata.tags.join(', ')}`);
    }
    
    return relevant.join('. ');
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vec1, vec2) {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    
    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);
    
    if (norm1 === 0 || norm2 === 0) return 0;
    
    return dotProduct / (norm1 * norm2);
  }

  /**
   * Simple hash function for content
   */
  simpleHash(text) {
    // Extract key terms for hashing
    const terms = text.toLowerCase()
      .split(/\s+/)
      .filter(term => term.length > 3)
      .slice(0, 20);
    
    return terms.sort().join('|');
  }

  /**
   * Calculate similarity between hashes
   */
  hashSimilarity(hash1, hash2) {
    const terms1 = new Set(hash1.split('|'));
    const terms2 = new Set(hash2.split('|'));
    
    const intersection = new Set([...terms1].filter(x => terms2.has(x)));
    const union = new Set([...terms1, ...terms2]);
    
    if (union.size === 0) return 0;
    
    return intersection.size / union.size;
  }

  /**
   * Get cache key for results
   */
  getCacheKey(query, results) {
    const resultIds = results.map(r => r.id).join(',');
    return `${query}_${resultIds}`;
  }

  /**
   * Get reranker metrics
   */
  getMetrics() {
    return {
      totalReranks: this.metrics.totalReranks,
      totalDocuments: this.metrics.totalDocuments,
      averageDocumentsPerRerank: this.metrics.totalReranks > 0 
        ? this.metrics.totalDocuments / this.metrics.totalReranks 
        : 0,
      averageLatency: this.metrics.avgLatency,
      cacheHitRate: this.metrics.totalReranks > 0 
        ? this.metrics.cacheHits / this.metrics.totalReranks 
        : 0,
      cacheSize: this.cache.size
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    console.log('Reranker cache cleared');
  }

  /**
   * Destroy model and free resources
   */
  async destroy() {
    if (this.model && this.model.dispose) {
      await this.model.dispose();
    }
    
    this.model = null;
    this.tokenizer = null;
    this.cache.clear();
    
    console.log('Cross-encoder reranker destroyed');
  }
}

// Export for use in other modules
export { CrossEncoderReranker };

// Example usage and testing
if (import.meta.url === `file://${process.argv[1]}`) {
  const reranker = new CrossEncoderReranker({
    modelBackend: 'transformers',
    topK: 5
  });
  
  // Sample query and results
  const query = "What are the security requirements for the project?";
  
  const sampleResults = [
    {
      id: '1',
      title: 'Project Security Guidelines',
      content: 'The project must implement end-to-end encryption and regular security audits.',
      score: 0.8,
      metadata: { source: 'sharepoint', created: new Date() }
    },
    {
      id: '2',
      title: 'Budget Planning Document',
      content: 'Annual budget allocation for various departments including IT security.',
      score: 0.7,
      metadata: { source: 'box', created: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) }
    },
    {
      id: '3',
      title: 'Security Compliance Checklist',
      content: 'Comprehensive checklist for GDPR and SOC2 compliance requirements.',
      score: 0.75,
      metadata: { source: 'database', created: new Date() }
    },
    {
      id: '4',
      title: 'Project Timeline',
      content: 'Q1 focuses on security implementation, Q2 on testing and validation.',
      score: 0.65,
      metadata: { source: 'sharepoint', created: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) }
    },
    {
      id: '5',
      title: 'Technical Architecture',
      content: 'System architecture with security layers and access control mechanisms.',
      score: 0.72,
      metadata: { source: 'sharepoint', created: new Date() }
    }
  ];
  
  console.log(`Query: "${query}"\n`);
  console.log('Original ranking:');
  sampleResults.forEach((r, i) => {
    console.log(`${i + 1}. [${r.score.toFixed(3)}] ${r.title}`);
  });
  
  console.log('\nReranking...\n');
  
  reranker.rerank(query, sampleResults, {
    topK: 3,
    includeMetadata: true,
    diversityPenalty: 0.1,
    sourceBoost: { sharepoint: 1.1, box: 0.9, database: 1.0 },
    recencyBoost: { factor: 0.15, maxAge: 30 * 24 * 60 * 60 * 1000 }
  })
    .then(rerankedResults => {
      console.log('Reranked results:');
      rerankedResults.forEach((r, i) => {
        console.log(`${i + 1}. [${r.rerankScore.toFixed(3)}] ${r.title}`);
        console.log(`   Original: ${r.originalRank}, Score: ${r.score.toFixed(3)}, Cross-encoder: ${r.crossEncoderScore.toFixed(3)}`);
      });
      
      console.log('\nMetrics:', reranker.getMetrics());
    })
    .catch(console.error)
    .finally(() => reranker.destroy());
}

export default CrossEncoderReranker;