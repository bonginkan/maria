#!/usr/bin/env node
/**
 * HybridRetriever.js
 * Advanced hybrid search with Reciprocal Rank Fusion (RRF)
 * Combines BM25, Vector, and Knowledge Graph signals
 */

import fetch from 'node-fetch';
import neo4j from 'neo4j-driver';
import { performance } from 'perf_hooks';

class HybridRetriever {
  constructor(config) {
    // Service endpoints
    this.opensearchUrl = config.opensearchUrl || process.env.POC_OPENSEARCH_URL || 'http://localhost:9200';
    this.qdrantUrl = config.qdrantUrl || process.env.POC_QDRANT_URL || 'http://localhost:6333';
    this.neo4jUri = config.neo4jUri || process.env.POC_NEO4J_URI || 'bolt://localhost:7687';
    
    // Authentication
    this.opensearchAuth = config.opensearchAuth || {
      username: process.env.POC_OPENSEARCH_USER || 'admin',
      password: process.env.POC_OPENSEARCH_PASSWORD || 'admin'
    };
    
    this.neo4jAuth = {
      user: config.neo4jUser || process.env.POC_NEO4J_USER || 'neo4j',
      password: config.neo4jPassword || process.env.POC_NEO4J_PASSWORD || 'testpass'
    };
    
    // Neo4j driver
    this.neo4jDriver = neo4j.driver(
      this.neo4jUri,
      neo4j.auth.basic(this.neo4jAuth.user, this.neo4jAuth.password),
      {
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: 60000
      }
    );
    
    // Configuration
    this.config = {
      // RRF parameters
      k: config.rrfK || 60,
      
      // Weight distribution
      weights: {
        bm25: config.bm25Weight || 0.4,
        vector: config.vectorWeight || 0.35,
        kg: config.kgWeight || 0.25
      },
      
      // KG boost weights
      kgBoost: {
        alpha: config.kgAlpha || 0.2,  // mention count weight
        beta: config.kgBeta || 0.4,    // Jaccard similarity weight
        gamma: config.kgGamma || 0.1   // PageRank weight
      },
      
      // Search parameters
      topK: config.topK || 20,
      maxCandidates: config.maxCandidates || 100,
      minScore: config.minScore || 0.1,
      
      // Performance
      parallel: config.parallel !== false,
      timeout: config.timeout || 5000,
      cache: config.cache !== false
    };
    
    // Metrics collection
    this.metrics = {
      searches: 0,
      totalLatency: 0,
      bm25Latency: 0,
      vectorLatency: 0,
      kgLatency: 0,
      fusionLatency: 0
    };
    
    // Cache
    this.cache = new Map();
  }

  /**
   * Main search interface
   */
  async search(query, options = {}) {
    const startTime = performance.now();
    this.metrics.searches++;
    
    try {
      // Check cache
      const cacheKey = this.getCacheKey(query, options);
      if (this.config.cache && this.cache.has(cacheKey)) {
        console.log('Cache hit for query:', query);
        return this.cache.get(cacheKey);
      }
      
      // Extract query features
      const queryFeatures = await this.extractQueryFeatures(query, options);
      
      // Run searches in parallel or sequential based on config
      let bm25Results, vectorResults, kgResults;
      
      if (this.config.parallel) {
        [bm25Results, vectorResults, kgResults] = await Promise.all([
          this.searchBM25(query, queryFeatures, options),
          this.searchVector(query, queryFeatures, options),
          this.searchKG(query, queryFeatures, options)
        ]);
      } else {
        bm25Results = await this.searchBM25(query, queryFeatures, options);
        vectorResults = await this.searchVector(query, queryFeatures, options);
        kgResults = await this.searchKG(query, queryFeatures, options);
      }
      
      // Combine results using RRF
      const fusionStart = performance.now();
      const fusedResults = await this.reciprocalRankFusion(
        bm25Results,
        vectorResults,
        kgResults,
        queryFeatures
      );
      this.metrics.fusionLatency += performance.now() - fusionStart;
      
      // Apply KG boost
      const boostedResults = await this.applyKGBoost(fusedResults, queryFeatures);
      
      // Get top K results
      const finalResults = boostedResults
        .filter(r => r.score >= this.config.minScore)
        .slice(0, options.topK || this.config.topK);
      
      // Enrich with metadata
      const enrichedResults = await this.enrichResults(finalResults, options);
      
      // Cache results
      if (this.config.cache) {
        this.cache.set(cacheKey, enrichedResults);
        
        // Expire cache after 5 minutes
        setTimeout(() => this.cache.delete(cacheKey), 5 * 60 * 1000);
      }
      
      // Record metrics
      this.metrics.totalLatency += performance.now() - startTime;
      
      return {
        query,
        results: enrichedResults,
        metadata: {
          totalResults: enrichedResults.length,
          searchTime: performance.now() - startTime,
          sources: {
            bm25: bm25Results.length,
            vector: vectorResults.length,
            kg: kgResults.length
          },
          weights: this.config.weights,
          kgBoost: this.config.kgBoost
        }
      };
      
    } catch (error) {
      console.error('Search failed:', error);
      throw error;
    }
  }

  /**
   * BM25 full-text search using OpenSearch
   */
  async searchBM25(query, queryFeatures, options = {}) {
    const startTime = performance.now();
    
    try {
      const searchBody = {
        size: this.config.maxCandidates,
        query: {
          multi_match: {
            query: query,
            fields: ['content^2', 'title^3', 'labels'],
            type: 'best_fields',
            operator: 'or',
            fuzziness: 'AUTO'
          }
        },
        highlight: {
          fields: {
            content: {
              fragment_size: 150,
              number_of_fragments: 3
            }
          }
        },
        _source: ['chunk_id', 'doc_id', 'title', 'content', 'path', 'labels', 'metadata']
      };
      
      // Add filters if provided
      if (options.filters) {
        searchBody.query = {
          bool: {
            must: searchBody.query,
            filter: this.buildFilters(options.filters)
          }
        };
      }
      
      const response = await fetch(
        `${this.opensearchUrl}/maria_chunks/_search`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + Buffer.from(
              `${this.opensearchAuth.username}:${this.opensearchAuth.password}`
            ).toString('base64')
          },
          body: JSON.stringify(searchBody)
        }
      );
      
      if (!response.ok) {
        throw new Error(`OpenSearch error: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      this.metrics.bm25Latency += performance.now() - startTime;
      
      return data.hits.hits.map(hit => ({
        id: hit._source.chunk_id,
        score: hit._score / (data.hits.max_score || 1), // Normalize
        source: 'bm25',
        data: hit._source,
        highlights: hit.highlight?.content || []
      }));
      
    } catch (error) {
      console.error('BM25 search failed:', error);
      return [];
    }
  }

  /**
   * Vector similarity search using Qdrant
   */
  async searchVector(query, queryFeatures, options = {}) {
    const startTime = performance.now();
    
    try {
      // Get query embedding
      const queryVector = await this.getQueryEmbedding(query);
      
      const searchParams = {
        vector: queryVector,
        limit: this.config.maxCandidates,
        with_payload: true,
        with_vectors: false,
        score_threshold: 0.5
      };
      
      // Add payload filters
      if (options.filters) {
        searchParams.filter = this.buildQdrantFilters(options.filters);
      }
      
      const response = await fetch(
        `${this.qdrantUrl}/collections/maria_vectors/points/search`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(searchParams)
        }
      );
      
      if (!response.ok) {
        throw new Error(`Qdrant error: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      this.metrics.vectorLatency += performance.now() - startTime;
      
      return data.result.map(point => ({
        id: point.payload.chunk_id,
        score: point.score,
        source: 'vector',
        data: point.payload
      }));
      
    } catch (error) {
      console.error('Vector search failed:', error);
      return [];
    }
  }

  /**
   * Knowledge Graph search using Neo4j
   */
  async searchKG(query, queryFeatures, options = {}) {
    const startTime = performance.now();
    const session = this.neo4jDriver.session();
    
    try {
      // Extract topics from query
      const topics = queryFeatures.topics || this.extractTopics(query);
      
      // Build Cypher query
      const cypher = `
        // Find paragraphs that mention query topics
        UNWIND $topics AS topic
        MATCH (t:Topic {name: topic})
        OPTIONAL MATCH (p:Paragraph)-[:MENTIONS]->(t)
        
        WITH p, t, count(t) AS topicMatches
        WHERE p IS NOT NULL
        
        // Get document and additional features
        MATCH (p)-[:DERIVED_FROM]->(d:Document)
        
        // Calculate features
        WITH p, d, topicMatches,
             p.topic_pagerank AS pagerank,
             p.jaccard_doc AS jaccard,
             p.degree_2hop AS degree
        
        // Score based on graph features
        WITH p, d,
             topicMatches * 0.4 + 
             coalesce(pagerank, 0) * 0.3 + 
             coalesce(jaccard, 0) * 0.2 +
             log10(1 + coalesce(degree, 0)) * 0.1 AS kgScore
        
        RETURN p.chunk_id AS chunk_id,
               d.id AS doc_id,
               d.title AS title,
               p.content AS content,
               d.path AS path,
               kgScore,
               topicMatches,
               pagerank,
               jaccard,
               degree
        ORDER BY kgScore DESC
        LIMIT $limit
      `;
      
      const result = await session.run(cypher, {
        topics: topics,
        limit: this.config.maxCandidates
      });
      
      this.metrics.kgLatency += performance.now() - startTime;
      
      const maxScore = Math.max(...result.records.map(r => r.get('kgScore')), 1);
      
      return result.records.map(record => ({
        id: record.get('chunk_id'),
        score: record.get('kgScore') / maxScore, // Normalize
        source: 'kg',
        data: {
          chunk_id: record.get('chunk_id'),
          doc_id: record.get('doc_id'),
          title: record.get('title'),
          content: record.get('content'),
          path: record.get('path')
        },
        kgFeatures: {
          topicMatches: record.get('topicMatches'),
          pagerank: record.get('pagerank'),
          jaccard: record.get('jaccard'),
          degree: record.get('degree')
        }
      }));
      
    } catch (error) {
      console.error('KG search failed:', error);
      return [];
    } finally {
      await session.close();
    }
  }

  /**
   * Reciprocal Rank Fusion (RRF) algorithm
   */
  async reciprocalRankFusion(bm25Results, vectorResults, kgResults, queryFeatures) {
    const k = this.config.k;
    const weights = this.config.weights;
    
    // Create maps for efficient lookup
    const resultMap = new Map();
    
    // Process BM25 results
    bm25Results.forEach((result, rank) => {
      const rrfScore = weights.bm25 / (k + rank + 1);
      
      if (resultMap.has(result.id)) {
        const existing = resultMap.get(result.id);
        existing.score += rrfScore;
        existing.sources.bm25 = result.score;
        existing.bm25Rank = rank + 1;
      } else {
        resultMap.set(result.id, {
          ...result,
          score: rrfScore,
          sources: {
            bm25: result.score,
            vector: 0,
            kg: 0
          },
          ranks: {
            bm25: rank + 1,
            vector: null,
            kg: null
          }
        });
      }
    });
    
    // Process Vector results
    vectorResults.forEach((result, rank) => {
      const rrfScore = weights.vector / (k + rank + 1);
      
      if (resultMap.has(result.id)) {
        const existing = resultMap.get(result.id);
        existing.score += rrfScore;
        existing.sources.vector = result.score;
        existing.ranks.vector = rank + 1;
      } else {
        resultMap.set(result.id, {
          ...result,
          score: rrfScore,
          sources: {
            bm25: 0,
            vector: result.score,
            kg: 0
          },
          ranks: {
            bm25: null,
            vector: rank + 1,
            kg: null
          }
        });
      }
    });
    
    // Process KG results
    kgResults.forEach((result, rank) => {
      const rrfScore = weights.kg / (k + rank + 1);
      
      if (resultMap.has(result.id)) {
        const existing = resultMap.get(result.id);
        existing.score += rrfScore;
        existing.sources.kg = result.score;
        existing.ranks.kg = rank + 1;
        existing.kgFeatures = result.kgFeatures;
      } else {
        resultMap.set(result.id, {
          ...result,
          score: rrfScore,
          sources: {
            bm25: 0,
            vector: 0,
            kg: result.score
          },
          ranks: {
            bm25: null,
            vector: null,
            kg: rank + 1
          },
          kgFeatures: result.kgFeatures
        });
      }
    });
    
    // Convert to array and sort by RRF score
    const fusedResults = Array.from(resultMap.values())
      .sort((a, b) => b.score - a.score);
    
    return fusedResults;
  }

  /**
   * Apply Knowledge Graph boost to results
   */
  async applyKGBoost(results, queryFeatures) {
    const { alpha, beta, gamma } = this.config.kgBoost;
    
    // Get KG features for all results if not already present
    const chunkIds = results.map(r => r.id);
    const kgFeatures = await this.getKGFeatures(chunkIds, queryFeatures.topics || []);
    
    // Apply boost
    results.forEach(result => {
      const features = kgFeatures.get(result.id) || result.kgFeatures || {};
      
      let boost = 0;
      
      // Mention count boost (logarithmic)
      if (features.mentionCount) {
        boost += alpha * Math.log2(1 + features.mentionCount);
      }
      
      // Jaccard similarity boost
      if (features.jaccard) {
        boost += beta * features.jaccard;
      }
      
      // PageRank boost (z-score normalized)
      if (features.pagerank) {
        // Simple normalization, should use z-score in production
        boost += gamma * Math.min(1, features.pagerank * 100);
      }
      
      // Apply boost to score
      result.score = Math.min(1, result.score + boost);
      result.kgBoost = boost;
      result.kgFeatures = features;
    });
    
    // Re-sort after boosting
    results.sort((a, b) => b.score - a.score);
    
    return results;
  }

  /**
   * Get KG features for chunks
   */
  async getKGFeatures(chunkIds, queryTopics) {
    const session = this.neo4jDriver.session();
    const features = new Map();
    
    try {
      const cypher = `
        UNWIND $chunkIds AS chunkId
        MATCH (p:Paragraph {chunk_id: chunkId})
        
        OPTIONAL MATCH (p)-[:MENTIONS]->(t:Topic)
        WITH p, collect(t.name) AS paragraphTopics, $queryTopics AS qTopics
        
        WITH p,
             size([t IN paragraphTopics WHERE t IN qTopics]) AS topicOverlap,
             size(paragraphTopics) AS mentionCount,
             CASE 
               WHEN size(paragraphTopics + qTopics) = 0 THEN 0
               ELSE toFloat(size([t IN paragraphTopics WHERE t IN qTopics])) / 
                    toFloat(size(paragraphTopics + qTopics))
             END AS jaccard,
             p.topic_pagerank AS pagerank,
             p.degree_2hop AS degree
        
        RETURN p.chunk_id AS chunkId,
               mentionCount,
               topicOverlap,
               jaccard,
               pagerank,
               degree
      `;
      
      const result = await session.run(cypher, {
        chunkIds,
        queryTopics
      });
      
      result.records.forEach(record => {
        features.set(record.get('chunkId'), {
          mentionCount: record.get('mentionCount').toNumber(),
          topicOverlap: record.get('topicOverlap').toNumber(),
          jaccard: record.get('jaccard'),
          pagerank: record.get('pagerank'),
          degree: record.get('degree')?.toNumber()
        });
      });
      
    } catch (error) {
      console.error('Failed to get KG features:', error);
    } finally {
      await session.close();
    }
    
    return features;
  }

  /**
   * Enrich results with additional metadata
   */
  async enrichResults(results, options) {
    // Add snippets, highlights, and metadata
    const enriched = results.map(result => {
      const enrichedResult = {
        id: result.id,
        score: result.score,
        title: result.data?.title || '',
        path: result.data?.path || '',
        content: result.data?.content || '',
        highlights: result.highlights || [],
        metadata: {
          docId: result.data?.doc_id,
          labels: result.data?.labels || [],
          source: result.data?.metadata?.source || 'unknown',
          created: result.data?.metadata?.created_at,
          ...result.data?.metadata
        },
        scores: result.sources,
        ranks: result.ranks,
        kgFeatures: result.kgFeatures,
        kgBoost: result.kgBoost
      };
      
      // Generate snippet if content exists
      if (enrichedResult.content && !enrichedResult.highlights.length) {
        enrichedResult.snippet = this.generateSnippet(
          enrichedResult.content,
          options.query || '',
          150
        );
      }
      
      return enrichedResult;
    });
    
    return enriched;
  }

  /**
   * Extract features from query
   */
  async extractQueryFeatures(query, options) {
    const features = {
      query,
      language: this.detectLanguage(query),
      topics: this.extractTopics(query),
      entities: this.extractEntities(query),
      intent: this.classifyIntent(query),
      timestamp: new Date().toISOString()
    };
    
    // Add any user-provided features
    if (options.features) {
      Object.assign(features, options.features);
    }
    
    return features;
  }

  /**
   * Extract topics from text
   */
  extractTopics(text) {
    // Simple keyword extraction, should use NER in production
    const topics = [];
    
    const keywords = [
      'AI', 'Machine Learning', 'Security', 'Compliance', 
      'Revenue', 'Budget', 'Project', 'Design', 'Requirements',
      '売上', '設計', '要件', '可用性', 'セキュリティ'
    ];
    
    keywords.forEach(keyword => {
      if (text.toLowerCase().includes(keyword.toLowerCase())) {
        topics.push(keyword);
      }
    });
    
    return topics;
  }

  /**
   * Extract entities from text
   */
  extractEntities(text) {
    // Placeholder for entity extraction
    return [];
  }

  /**
   * Detect language
   */
  detectLanguage(text) {
    // Simple detection based on character presence
    const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
    return hasJapanese ? 'ja' : 'en';
  }

  /**
   * Classify query intent
   */
  classifyIntent(query) {
    // Simple intent classification
    if (query.includes('?') || query.startsWith('what') || query.startsWith('how')) {
      return 'question';
    }
    if (query.includes('find') || query.includes('search') || query.includes('show')) {
      return 'search';
    }
    return 'general';
  }

  /**
   * Get query embedding
   */
  async getQueryEmbedding(query) {
    // This should call OpenAI or other embedding service
    // For now, return random vector for testing
    const dim = 1536; // OpenAI ada-002 dimension
    return Array(dim).fill(0).map(() => Math.random());
  }

  /**
   * Generate snippet from content
   */
  generateSnippet(content, query, maxLength = 150) {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const sentences = content.split(/[.!?]+/);
    
    // Find most relevant sentence
    let bestSentence = sentences[0];
    let maxMatches = 0;
    
    sentences.forEach(sentence => {
      const matches = queryTerms.filter(term => 
        sentence.toLowerCase().includes(term)
      ).length;
      
      if (matches > maxMatches) {
        maxMatches = matches;
        bestSentence = sentence;
      }
    });
    
    // Truncate if needed
    if (bestSentence.length > maxLength) {
      return bestSentence.substring(0, maxLength) + '...';
    }
    
    return bestSentence;
  }

  /**
   * Build OpenSearch filters
   */
  buildFilters(filters) {
    const esFilters = [];
    
    if (filters.source) {
      esFilters.push({
        term: { 'metadata.source': filters.source }
      });
    }
    
    if (filters.dateRange) {
      esFilters.push({
        range: {
          'metadata.created_at': {
            gte: filters.dateRange.start,
            lte: filters.dateRange.end
          }
        }
      });
    }
    
    if (filters.labels) {
      esFilters.push({
        terms: { labels: filters.labels }
      });
    }
    
    return esFilters;
  }

  /**
   * Build Qdrant filters
   */
  buildQdrantFilters(filters) {
    const qdrantFilter = { must: [] };
    
    if (filters.source) {
      qdrantFilter.must.push({
        key: 'metadata.source',
        match: { value: filters.source }
      });
    }
    
    if (filters.labels) {
      qdrantFilter.must.push({
        key: 'labels',
        match: { any: filters.labels }
      });
    }
    
    return qdrantFilter;
  }

  /**
   * Get cache key
   */
  getCacheKey(query, options) {
    return `${query}_${JSON.stringify(options)}`;
  }

  /**
   * Get search metrics
   */
  getMetrics() {
    const avgLatency = this.metrics.searches > 0 
      ? this.metrics.totalLatency / this.metrics.searches 
      : 0;
    
    return {
      totalSearches: this.metrics.searches,
      averageLatency: avgLatency,
      bm25AvgLatency: this.metrics.searches > 0 
        ? this.metrics.bm25Latency / this.metrics.searches 
        : 0,
      vectorAvgLatency: this.metrics.searches > 0 
        ? this.metrics.vectorLatency / this.metrics.searches 
        : 0,
      kgAvgLatency: this.metrics.searches > 0 
        ? this.metrics.kgLatency / this.metrics.searches 
        : 0,
      fusionAvgLatency: this.metrics.searches > 0 
        ? this.metrics.fusionLatency / this.metrics.searches 
        : 0,
      cacheSize: this.cache.size
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    console.log('Search cache cleared');
  }

  /**
   * Close connections
   */
  async close() {
    await this.neo4jDriver.close();
    console.log('Hybrid retriever closed');
  }
}

// Export for use in other modules
export { HybridRetriever };

// Run as CLI if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const retriever = new HybridRetriever({
    opensearchUrl: process.env.POC_OPENSEARCH_URL,
    qdrantUrl: process.env.POC_QDRANT_URL,
    neo4jUri: process.env.POC_NEO4J_URI
  });
  
  const query = process.argv[2] || 'Project A design requirements';
  
  console.log(`Searching for: "${query}"`);
  
  retriever.search(query, { topK: 10 })
    .then(results => {
      console.log(`\nFound ${results.results.length} results:\n`);
      
      results.results.forEach((result, index) => {
        console.log(`${index + 1}. [${result.score.toFixed(3)}] ${result.title}`);
        console.log(`   Path: ${result.path}`);
        console.log(`   Sources: BM25=${result.scores.bm25.toFixed(3)}, Vector=${result.scores.vector.toFixed(3)}, KG=${result.scores.kg.toFixed(3)}`);
        if (result.kgBoost) {
          console.log(`   KG Boost: ${result.kgBoost.toFixed(3)}`);
        }
        console.log();
      });
      
      console.log('Metadata:', results.metadata);
      console.log('Metrics:', retriever.getMetrics());
    })
    .catch(console.error)
    .finally(() => retriever.close());
}

export default HybridRetriever;