#!/usr/bin/env node
/**
 * SearchAPI.js
 * Comprehensive REST and GraphQL API for Graph RAG search
 * Integrates all search components into a unified interface
 */

import express from 'express';
import cors from 'cors';
import { graphqlHTTP } from 'express-graphql';
import { buildSchema } from 'graphql';
import WebSocket from 'ws';
import { HybridRetriever } from '../search/HybridRetriever.js';
import { CrossEncoderReranker } from '../search/CrossEncoderReranker.js';
import { ACLFilter } from '../search/ACLFilter.js';
import { performance } from 'perf_hooks';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import helmet from 'helmet';

class SearchAPI {
  constructor(config = {}) {
    this.config = {
      port: config.port || process.env.PORT || 3000,
      host: config.host || '0.0.0.0',
      
      // Security
      jwtSecret: config.jwtSecret || process.env.JWT_SECRET || 'your-secret-key',
      apiKeys: config.apiKeys || process.env.API_KEYS?.split(',') || [],
      corsOrigins: config.corsOrigins || process.env.CORS_ORIGINS?.split(',') || ['*'],
      
      // Rate limiting
      rateLimitWindowMs: config.rateLimitWindowMs || 15 * 60 * 1000, // 15 minutes
      rateLimitMaxRequests: config.rateLimitMaxRequests || 100,
      
      // WebSocket
      enableWebSocket: config.enableWebSocket !== false,
      wsPort: config.wsPort || 3001,
      
      // GraphQL
      enableGraphQL: config.enableGraphQL !== false,
      graphQLPath: config.graphQLPath || '/graphql',
      
      // Monitoring
      enableMetrics: config.enableMetrics !== false,
      metricsPath: config.metricsPath || '/metrics',
      
      // Search configuration
      searchConfig: config.searchConfig || {},
      rerankerConfig: config.rerankerConfig || {},
      aclConfig: config.aclConfig || {}
    };
    
    // Initialize Express app
    this.app = express();
    
    // Initialize search components
    this.hybridRetriever = new HybridRetriever(this.config.searchConfig);
    this.crossEncoderReranker = new CrossEncoderReranker(this.config.rerankerConfig);
    this.aclFilter = new ACLFilter(this.config.aclConfig);
    
    // Metrics
    this.metrics = {
      requests: 0,
      searches: 0,
      errors: 0,
      avgLatency: 0,
      activeConnections: 0
    };
    
    // Setup middleware and routes
    this.setupMiddleware();
    this.setupRoutes();
    this.setupGraphQL();
    
    // Setup WebSocket if enabled
    if (this.config.enableWebSocket) {
      this.setupWebSocket();
    }
  }

  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    // Security headers
    this.app.use(helmet());
    
    // CORS
    this.app.use(cors({
      origin: this.config.corsOrigins,
      credentials: true
    }));
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Compression
    this.app.use(compression());
    
    // Rate limiting
    const limiter = rateLimit({
      windowMs: this.config.rateLimitWindowMs,
      max: this.config.rateLimitMaxRequests,
      message: 'Too many requests, please try again later.'
    });
    
    this.app.use('/api/', limiter);
    
    // Request logging
    this.app.use((req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
        
        // Update metrics
        this.metrics.requests++;
        this.metrics.avgLatency = (this.metrics.avgLatency * (this.metrics.requests - 1) + duration) / this.metrics.requests;
      });
      
      next();
    });
    
    // Authentication middleware
    this.app.use('/api/protected', this.authMiddleware.bind(this));
  }

  /**
   * Authentication middleware
   */
  authMiddleware(req, res, next) {
    // Check API key
    const apiKey = req.headers['x-api-key'];
    if (apiKey && this.config.apiKeys.includes(apiKey)) {
      req.auth = { type: 'apikey', key: apiKey };
      return next();
    }
    
    // Check JWT token
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      try {
        const decoded = jwt.verify(token, this.config.jwtSecret);
        req.auth = { type: 'jwt', user: decoded };
        return next();
      } catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
      }
    }
    
    res.status(401).json({ error: 'Authentication required' });
  }

  /**
   * Setup REST API routes
   */
  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        metrics: this.metrics
      });
    });
    
    // Main search endpoint
    this.app.post('/api/search', this.handleSearch.bind(this));
    
    // Protected search with ACL
    this.app.post('/api/protected/search', this.handleProtectedSearch.bind(this));
    
    // Streaming search endpoint
    this.app.post('/api/search/stream', this.handleStreamingSearch.bind(this));
    
    // Autocomplete/suggestions
    this.app.get('/api/suggest', this.handleSuggest.bind(this));
    
    // Document retrieval
    this.app.get('/api/document/:id', this.handleGetDocument.bind(this));
    
    // Feedback endpoint
    this.app.post('/api/feedback', this.handleFeedback.bind(this));
    
    // Metrics endpoint
    if (this.config.enableMetrics) {
      this.app.get(this.config.metricsPath, this.handleMetrics.bind(this));
    }
    
    // Admin endpoints
    this.app.post('/api/admin/reindex', this.authMiddleware.bind(this), this.handleReindex.bind(this));
    this.app.post('/api/admin/clear-cache', this.authMiddleware.bind(this), this.handleClearCache.bind(this));
    
    // Error handling
    this.app.use((err, req, res, next) => {
      console.error('API Error:', err);
      this.metrics.errors++;
      
      res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Handle search request
   */
  async handleSearch(req, res) {
    const startTime = performance.now();
    this.metrics.searches++;
    
    try {
      const {
        query,
        filters = {},
        topK = 20,
        includeGraph = false,
        includeHighlights = true,
        rerank = true,
        weights = {},
        kgBoost = {}
      } = req.body;
      
      // Validate input
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Query is required' });
      }
      
      // Perform hybrid search
      const searchResults = await this.hybridRetriever.search(query, {
        filters,
        topK: rerank ? topK * 2 : topK, // Get more candidates if reranking
        weights,
        kgBoost
      });
      
      // Apply cross-encoder reranking if enabled
      let finalResults = searchResults.results;
      
      if (rerank) {
        finalResults = await this.crossEncoderReranker.rerank(
          query,
          searchResults.results,
          {
            topK,
            includeMetadata: true,
            diversityPenalty: 0.1
          }
        );
      }
      
      // Build graph data if requested
      let graphData = null;
      if (includeGraph) {
        graphData = await this.buildGraphData(query, finalResults);
      }
      
      // Format response
      const response = {
        query,
        results: finalResults.map(r => this.formatResult(r, includeHighlights)),
        metadata: {
          totalResults: finalResults.length,
          searchTime: performance.now() - startTime,
          sources: searchResults.metadata.sources,
          weights: searchResults.metadata.weights,
          reranked: rerank
        }
      };
      
      if (graphData) {
        response.graph = graphData;
      }
      
      res.json(response);
      
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({
        error: 'Search failed',
        message: error.message
      });
    }
  }

  /**
   * Handle protected search with ACL filtering
   */
  async handleProtectedSearch(req, res) {
    const startTime = performance.now();
    
    try {
      // Get user context from auth
      const userContext = this.getUserContext(req);
      
      // Perform search
      const searchParams = req.body;
      const searchResults = await this.hybridRetriever.search(
        searchParams.query,
        searchParams
      );
      
      // Apply ACL filtering
      const filtered = await this.aclFilter.filter(
        searchResults.results,
        userContext,
        { verbose: false }
      );
      
      // Apply reranking on filtered results
      let finalResults = filtered.results;
      
      if (searchParams.rerank) {
        finalResults = await this.crossEncoderReranker.rerank(
          searchParams.query,
          filtered.results,
          { topK: searchParams.topK || 20 }
        );
      }
      
      res.json({
        query: searchParams.query,
        results: finalResults.map(r => this.formatResult(r)),
        metadata: {
          totalResults: finalResults.length,
          filteredOut: filtered.metadata.blockedResults,
          searchTime: performance.now() - startTime,
          userGroups: filtered.metadata.userGroups
        }
      });
      
    } catch (error) {
      console.error('Protected search error:', error);
      res.status(500).json({
        error: 'Protected search failed',
        message: error.message
      });
    }
  }

  /**
   * Handle streaming search results
   */
  async handleStreamingSearch(req, res) {
    // Set up SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    
    try {
      const { query, batchSize = 5 } = req.body;
      
      // Start search
      const searchPromise = this.hybridRetriever.search(query, {
        topK: 50
      });
      
      // Send initial response
      res.write(`data: ${JSON.stringify({ type: 'start', query })}\n\n`);
      
      // Get results
      const searchResults = await searchPromise;
      const results = searchResults.results;
      
      // Stream results in batches
      for (let i = 0; i < results.length; i += batchSize) {
        const batch = results.slice(i, i + batchSize);
        
        res.write(`data: ${JSON.stringify({
          type: 'results',
          batch: batch.map(r => this.formatResult(r)),
          progress: (i + batch.length) / results.length
        })}\n\n`);
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Send completion
      res.write(`data: ${JSON.stringify({
        type: 'complete',
        totalResults: results.length,
        metadata: searchResults.metadata
      })}\n\n`);
      
      res.end();
      
    } catch (error) {
      console.error('Streaming search error:', error);
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: error.message
      })}\n\n`);
      res.end();
    }
  }

  /**
   * Handle autocomplete suggestions
   */
  async handleSuggest(req, res) {
    try {
      const { prefix, limit = 10 } = req.query;
      
      if (!prefix) {
        return res.status(400).json({ error: 'Prefix is required' });
      }
      
      // Mock implementation - replace with actual suggestion logic
      const suggestions = [
        'Project A design',
        'Project A requirements',
        'Project A timeline',
        'Security requirements',
        'Security compliance',
        'Budget planning',
        'Technical architecture'
      ].filter(s => s.toLowerCase().startsWith(prefix.toLowerCase()))
        .slice(0, limit);
      
      res.json({ suggestions });
      
    } catch (error) {
      console.error('Suggest error:', error);
      res.status(500).json({ error: 'Suggestion failed' });
    }
  }

  /**
   * Handle document retrieval
   */
  async handleGetDocument(req, res) {
    try {
      const { id } = req.params;
      
      // Mock implementation - replace with actual document retrieval
      const document = {
        id,
        title: 'Sample Document',
        content: 'Document content here...',
        metadata: {
          created: new Date(),
          source: 'sharepoint'
        }
      };
      
      res.json(document);
      
    } catch (error) {
      console.error('Document retrieval error:', error);
      res.status(404).json({ error: 'Document not found' });
    }
  }

  /**
   * Handle user feedback
   */
  async handleFeedback(req, res) {
    try {
      const { queryId, documentId, relevant, feedback } = req.body;
      
      // Store feedback for learning
      console.log('Feedback received:', {
        queryId,
        documentId,
        relevant,
        feedback
      });
      
      res.json({ status: 'success', message: 'Feedback recorded' });
      
    } catch (error) {
      console.error('Feedback error:', error);
      res.status(500).json({ error: 'Failed to record feedback' });
    }
  }

  /**
   * Handle metrics request
   */
  async handleMetrics(req, res) {
    const metrics = {
      api: this.metrics,
      search: this.hybridRetriever.getMetrics(),
      reranker: this.crossEncoderReranker.getMetrics(),
      acl: this.aclFilter.getMetrics()
    };
    
    // Prometheus format
    const prometheus = this.formatPrometheus(metrics);
    
    res.type('text/plain');
    res.send(prometheus);
  }

  /**
   * Handle reindex request
   */
  async handleReindex(req, res) {
    try {
      // Trigger reindexing process
      console.log('Reindexing triggered by:', req.auth);
      
      res.json({
        status: 'success',
        message: 'Reindexing started',
        jobId: `reindex_${Date.now()}`
      });
      
    } catch (error) {
      console.error('Reindex error:', error);
      res.status(500).json({ error: 'Reindex failed' });
    }
  }

  /**
   * Handle cache clearing
   */
  async handleClearCache(req, res) {
    try {
      this.hybridRetriever.clearCache();
      this.crossEncoderReranker.clearCache();
      this.aclFilter.clearCaches();
      
      res.json({
        status: 'success',
        message: 'All caches cleared'
      });
      
    } catch (error) {
      console.error('Clear cache error:', error);
      res.status(500).json({ error: 'Failed to clear caches' });
    }
  }

  /**
   * Setup GraphQL endpoint
   */
  setupGraphQL() {
    if (!this.config.enableGraphQL) return;
    
    // GraphQL schema
    const schema = buildSchema(`
      type Query {
        search(input: SearchInput!): SearchResponse!
        document(id: ID!): Document
        suggest(prefix: String!, limit: Int): [String!]!
      }
      
      input SearchInput {
        query: String!
        topK: Int
        filters: FilterInput
        rerank: Boolean
        includeGraph: Boolean
      }
      
      input FilterInput {
        source: String
        dateRange: DateRangeInput
        labels: [String!]
      }
      
      input DateRangeInput {
        start: String!
        end: String!
      }
      
      type SearchResponse {
        query: String!
        results: [SearchResult!]!
        metadata: SearchMetadata!
        graph: GraphData
      }
      
      type SearchResult {
        id: ID!
        title: String!
        content: String!
        score: Float!
        path: String!
        highlights: [String!]
        metadata: ResultMetadata
      }
      
      type ResultMetadata {
        source: String
        created: String
        labels: [String!]
      }
      
      type SearchMetadata {
        totalResults: Int!
        searchTime: Float!
        reranked: Boolean!
      }
      
      type GraphData {
        nodes: [GraphNode!]!
        edges: [GraphEdge!]!
      }
      
      type GraphNode {
        id: ID!
        label: String!
        type: String!
        score: Float
      }
      
      type GraphEdge {
        source: ID!
        target: ID!
        weight: Float
      }
      
      type Document {
        id: ID!
        title: String!
        content: String!
        metadata: ResultMetadata
      }
    `);
    
    // GraphQL resolvers
    const root = {
      search: async ({ input }) => {
        const results = await this.hybridRetriever.search(input.query, {
          topK: input.topK || 20,
          filters: input.filters,
          rerank: input.rerank
        });
        
        let finalResults = results.results;
        
        if (input.rerank) {
          finalResults = await this.crossEncoderReranker.rerank(
            input.query,
            results.results,
            { topK: input.topK || 20 }
          );
        }
        
        const response = {
          query: input.query,
          results: finalResults.map(r => this.formatResult(r)),
          metadata: {
            totalResults: finalResults.length,
            searchTime: results.metadata.searchTime,
            reranked: input.rerank || false
          }
        };
        
        if (input.includeGraph) {
          response.graph = await this.buildGraphData(input.query, finalResults);
        }
        
        return response;
      },
      
      document: async ({ id }) => {
        // Mock implementation
        return {
          id,
          title: 'Sample Document',
          content: 'Document content...',
          metadata: {
            source: 'sharepoint',
            created: new Date().toISOString()
          }
        };
      },
      
      suggest: async ({ prefix, limit = 10 }) => {
        // Mock implementation
        const suggestions = [
          'Project A design',
          'Security requirements',
          'Budget planning'
        ].filter(s => s.toLowerCase().startsWith(prefix.toLowerCase()));
        
        return suggestions.slice(0, limit);
      }
    };
    
    // Setup GraphQL endpoint
    this.app.use(this.config.graphQLPath, graphqlHTTP({
      schema,
      rootValue: root,
      graphiql: true // Enable GraphiQL interface
    }));
    
    console.log(`GraphQL endpoint available at ${this.config.graphQLPath}`);
  }

  /**
   * Setup WebSocket for real-time updates
   */
  setupWebSocket() {
    this.wss = new WebSocket.Server({ port: this.config.wsPort });
    
    this.wss.on('connection', (ws) => {
      this.metrics.activeConnections++;
      console.log('WebSocket client connected');
      
      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message);
          
          switch (data.type) {
            case 'search':
              await this.handleWSSearch(ws, data);
              break;
              
            case 'subscribe':
              this.handleWSSubscribe(ws, data);
              break;
              
            case 'ping':
              ws.send(JSON.stringify({ type: 'pong' }));
              break;
              
            default:
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Unknown message type'
              }));
          }
          
        } catch (error) {
          console.error('WebSocket error:', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: error.message
          }));
        }
      });
      
      ws.on('close', () => {
        this.metrics.activeConnections--;
        console.log('WebSocket client disconnected');
      });
    });
    
    console.log(`WebSocket server listening on port ${this.config.wsPort}`);
  }

  /**
   * Handle WebSocket search
   */
  async handleWSSearch(ws, data) {
    const { query, options = {} } = data;
    
    // Send search started
    ws.send(JSON.stringify({
      type: 'search_started',
      query
    }));
    
    // Perform search
    const results = await this.hybridRetriever.search(query, options);
    
    // Stream results
    for (const result of results.results) {
      ws.send(JSON.stringify({
        type: 'result',
        data: this.formatResult(result)
      }));
      
      // Small delay for streaming effect
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Send completion
    ws.send(JSON.stringify({
      type: 'search_complete',
      metadata: results.metadata
    }));
  }

  /**
   * Handle WebSocket subscription
   */
  handleWSSubscribe(ws, data) {
    // Mock implementation for real-time updates
    const { topics } = data;
    
    console.log('Client subscribed to topics:', topics);
    
    // Send mock updates periodically
    const interval = setInterval(() => {
      ws.send(JSON.stringify({
        type: 'update',
        topic: topics[Math.floor(Math.random() * topics.length)],
        data: {
          timestamp: new Date().toISOString(),
          message: 'New document added'
        }
      }));
    }, 30000);
    
    ws.on('close', () => clearInterval(interval));
  }

  /**
   * Format search result for API response
   */
  formatResult(result, includeHighlights = true) {
    const formatted = {
      id: result.id,
      title: result.title || 'Untitled',
      content: result.content || result.snippet || '',
      score: result.rerankScore || result.score,
      path: result.path || '',
      metadata: {
        source: result.metadata?.source || result.source,
        created: result.metadata?.created,
        labels: result.metadata?.labels || []
      }
    };
    
    if (includeHighlights && result.highlights) {
      formatted.highlights = result.highlights;
    }
    
    if (result.scores) {
      formatted.scoreBreakdown = result.scores;
    }
    
    return formatted;
  }

  /**
   * Build graph data for visualization
   */
  async buildGraphData(query, results) {
    const nodes = [];
    const edges = [];
    
    // Add query node
    nodes.push({
      id: 'query',
      label: query,
      type: 'Query',
      score: 1.0
    });
    
    // Add result nodes and edges
    results.forEach((result, index) => {
      nodes.push({
        id: result.id,
        label: result.title,
        type: 'Document',
        score: result.score
      });
      
      edges.push({
        source: 'query',
        target: result.id,
        weight: result.score
      });
    });
    
    return { nodes, edges };
  }

  /**
   * Get user context from request
   */
  getUserContext(req) {
    if (req.auth?.type === 'jwt') {
      return {
        userId: req.auth.user.id,
        email: req.auth.user.email,
        name: req.auth.user.name
      };
    }
    
    // Default context for API key auth
    return {
      userId: 'api_user',
      email: 'api@example.com'
    };
  }

  /**
   * Format metrics for Prometheus
   */
  formatPrometheus(metrics) {
    const lines = [];
    
    // API metrics
    lines.push(`# HELP api_requests_total Total API requests`);
    lines.push(`# TYPE api_requests_total counter`);
    lines.push(`api_requests_total ${metrics.api.requests}`);
    
    lines.push(`# HELP api_searches_total Total searches performed`);
    lines.push(`# TYPE api_searches_total counter`);
    lines.push(`api_searches_total ${metrics.api.searches}`);
    
    lines.push(`# HELP api_errors_total Total API errors`);
    lines.push(`# TYPE api_errors_total counter`);
    lines.push(`api_errors_total ${metrics.api.errors}`);
    
    lines.push(`# HELP api_latency_ms Average API latency`);
    lines.push(`# TYPE api_latency_ms gauge`);
    lines.push(`api_latency_ms ${metrics.api.avgLatency}`);
    
    lines.push(`# HELP api_active_connections Active WebSocket connections`);
    lines.push(`# TYPE api_active_connections gauge`);
    lines.push(`api_active_connections ${metrics.api.activeConnections}`);
    
    // Search metrics
    lines.push(`# HELP search_total_searches Total searches`);
    lines.push(`# TYPE search_total_searches counter`);
    lines.push(`search_total_searches ${metrics.search.totalSearches}`);
    
    lines.push(`# HELP search_avg_latency Average search latency`);
    lines.push(`# TYPE search_avg_latency gauge`);
    lines.push(`search_avg_latency ${metrics.search.averageLatency}`);
    
    return lines.join('\n');
  }

  /**
   * Start the API server
   */
  async start() {
    // Start Express server
    this.server = this.app.listen(this.config.port, this.config.host, () => {
      console.log(`Search API listening on http://${this.config.host}:${this.config.port}`);
      console.log(`GraphQL available at http://${this.config.host}:${this.config.port}${this.config.graphQLPath}`);
      
      if (this.config.enableWebSocket) {
        console.log(`WebSocket available at ws://${this.config.host}:${this.config.wsPort}`);
      }
    });
    
    // Initialize search components
    await this.crossEncoderReranker.initialize();
    
    console.log('Search API ready');
  }

  /**
   * Stop the API server
   */
  async stop() {
    console.log('Shutting down Search API...');
    
    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
    }
    
    // Close Express server
    if (this.server) {
      this.server.close();
    }
    
    // Cleanup search components
    await this.hybridRetriever.close();
    await this.crossEncoderReranker.destroy();
    
    console.log('Search API stopped');
  }
}

// Export for use in other modules
export { SearchAPI };

// Run as standalone server if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const api = new SearchAPI({
    port: process.env.PORT || 3000,
    enableWebSocket: true,
    enableGraphQL: true,
    enableMetrics: true
  });
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    await api.stop();
    process.exit(0);
  });
  
  // Start server
  api.start().catch(console.error);
}

export default SearchAPI;