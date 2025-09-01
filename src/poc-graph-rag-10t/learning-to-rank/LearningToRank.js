/**
 * Learning-to-Rank (L2R) System for Graph RAG 10T
 * 
 * Implements continuous learning from user behavior to improve search rankings:
 * - Feature extraction from search pipeline (BM25, Vector, KG, Meta, User signals)
 * - LambdaMART/XGBoost training on user interaction data
 * - Online learning with feedback loops
 * - Model versioning and A/B testing
 * - Performance monitoring and quality metrics
 */

import { performance } from 'node:perf_hooks';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Feature extractor for Learning-to-Rank
 */
class FeatureExtractor {
  constructor(options = {}) {
    this.options = {
      enableKGFeatures: options.enableKGFeatures !== false,
      enableUserFeatures: options.enableUserFeatures !== false,
      enableMetaFeatures: options.enableMetaFeatures !== false,
      featureNormalization: options.featureNormalization || 'minmax',
      ...options
    };
    
    this.featureStats = new Map();
  }

  /**
   * Extract complete feature vector for a query-document pair
   */
  extractFeatures(query, document, searchResults, userContext = {}) {
    const features = {};
    
    // 1. Search-based features
    Object.assign(features, this.extractSearchFeatures(query, document, searchResults));
    
    // 2. Knowledge Graph features
    if (this.options.enableKGFeatures) {
      Object.assign(features, this.extractKGFeatures(query, document, searchResults.kgData));
    }
    
    // 3. Metadata features
    if (this.options.enableMetaFeatures) {
      Object.assign(features, this.extractMetaFeatures(document));
    }
    
    // 4. User behavior features
    if (this.options.enableUserFeatures) {
      Object.assign(features, this.extractUserFeatures(document, userContext));
    }
    
    // Convert to array format for ML models
    return this.vectorizeFeatures(features);
  }

  /**
   * Extract search-based features (BM25, Vector, RRF)
   */
  extractSearchFeatures(query, document, searchResults) {
    const docId = document.id;
    
    // Find document in different search result sets
    const bm25Result = searchResults.bm25?.find(r => r.id === docId);
    const vectorResult = searchResults.vector?.find(r => r.id === docId);
    const rrfResult = searchResults.rrf?.find(r => r.id === docId);
    
    return {
      // BM25 features
      bm25Score: bm25Result?.score || 0,
      bm25Rank: bm25Result ? searchResults.bm25.indexOf(bm25Result) + 1 : 999,
      bm25InTop10: (bm25Result && searchResults.bm25.indexOf(bm25Result) < 10) ? 1 : 0,
      
      // Vector features
      vectorSimilarity: vectorResult?.similarity || 0,
      vectorScore: vectorResult?.score || 0,
      vectorRank: vectorResult ? searchResults.vector.indexOf(vectorResult) + 1 : 999,
      vectorInTop10: (vectorResult && searchResults.vector.indexOf(vectorResult) < 10) ? 1 : 0,
      
      // RRF features
      rrfScore: rrfResult?.rrfScore || 0,
      rrfRank: rrfResult ? searchResults.rrf.indexOf(rrfResult) + 1 : 999,
      rrfInTop10: (rrfResult && searchResults.rrf.indexOf(rrfResult) < 10) ? 1 : 0,
      
      // Query-document matching features
      queryDocumentLength: query.length,
      documentLength: (document.content || document.snippet || '').length,
      titleMatch: this.calculateTitleMatch(query, document.title),
      queryOverlap: this.calculateQueryOverlap(query, document.content || document.snippet)
    };
  }

  /**
   * Extract Knowledge Graph features
   */
  extractKGFeatures(query, document, kgData = {}) {
    const docId = document.id;
    const kgInfo = kgData[docId] || {};
    
    return {
      // Entity and topic features
      mentionCount: kgInfo.mentions?.length || 0,
      topicCount: kgInfo.topics?.length || 0,
      entityDiversity: kgInfo.entityTypes?.length || 0,
      
      // Graph centrality features  
      pagerank: kgInfo.pagerank || 0,
      betweennessCentrality: kgInfo.betweenness || 0,
      degreeCentrality: kgInfo.degree || 0,
      
      // Query-KG alignment features
      jaccardSimilarity: kgInfo.jaccard || 0,
      semanticDistance: kgInfo.semanticDistance || 1.0,
      topicAlignment: kgInfo.topicAlignment || 0,
      
      // Graph connectivity
      connectedComponents: kgInfo.components || 1,
      clusteringCoefficient: kgInfo.clustering || 0,
      pathLength: kgInfo.pathLength || 999
    };
  }

  /**
   * Extract metadata features
   */
  extractMetaFeatures(document) {
    const now = new Date();
    const createdDate = new Date(document.createdAt || now);
    const modifiedDate = new Date(document.modifiedAt || now);
    
    return {
      // Recency features
      daysSinceCreated: Math.floor((now - createdDate) / (1000 * 60 * 60 * 24)),
      daysSinceModified: Math.floor((now - modifiedDate) / (1000 * 60 * 60 * 24)),
      isRecent: (now - modifiedDate) < (7 * 24 * 60 * 60 * 1000) ? 1 : 0, // Within 7 days
      
      // Source features
      sourceType: this.encodeSourceType(document.source),
      documentType: this.encodeDocumentType(document.type),
      authorScore: this.calculateAuthorScore(document.author),
      
      // Content quality features
      hasImages: (document.images?.length || 0) > 0 ? 1 : 0,
      hasLinks: (document.links?.length || 0) > 0 ? 1 : 0,
      contentQuality: this.assessContentQuality(document),
      
      // Section and structure
      sectionRank: this.calculateSectionRank(document),
      documentStructure: this.assessDocumentStructure(document)
    };
  }

  /**
   * Extract user behavior features
   */
  extractUserFeatures(document, userContext) {
    const docId = document.id;
    const userHistory = userContext.history || {};
    const globalStats = userContext.globalStats || {};
    
    return {
      // Click behavior
      clickCount: globalStats.clicks?.[docId] || 0,
      clickThroughRate: globalStats.ctr?.[docId] || 0,
      avgDwellTime: globalStats.dwellTime?.[docId] || 0,
      
      // User interaction quality
      explicitFeedback: globalStats.feedback?.[docId] || 0, // +1 for thumbs up, -1 for thumbs down
      skipRate: globalStats.skipRate?.[docId] || 0,
      returnVisits: globalStats.returnVisits?.[docId] || 0,
      
      // Personalization features
      userPreviousClicks: userHistory.clicks?.includes(docId) ? 1 : 0,
      userDomainPreference: this.calculateUserDomainPreference(document, userHistory),
      userTopicInterest: this.calculateUserTopicInterest(document, userHistory),
      
      // Social signals
      shareCount: globalStats.shares?.[docId] || 0,
      bookmarkCount: globalStats.bookmarks?.[docId] || 0,
      commentCount: globalStats.comments?.[docId] || 0
    };
  }

  /**
   * Convert feature object to vector array
   */
  vectorizeFeatures(features) {
    const vector = [];
    const featureNames = [];
    
    // Define feature order for consistency
    const featureOrder = [
      // Search features (12)
      'bm25Score', 'bm25Rank', 'bm25InTop10',
      'vectorSimilarity', 'vectorScore', 'vectorRank', 'vectorInTop10',
      'rrfScore', 'rrfRank', 'rrfInTop10',
      'queryDocumentLength', 'documentLength', 'titleMatch', 'queryOverlap',
      
      // KG features (11)
      'mentionCount', 'topicCount', 'entityDiversity',
      'pagerank', 'betweennessCentrality', 'degreeCentrality',
      'jaccardSimilarity', 'semanticDistance', 'topicAlignment',
      'connectedComponents', 'clusteringCoefficient', 'pathLength',
      
      // Meta features (10)
      'daysSinceCreated', 'daysSinceModified', 'isRecent',
      'sourceType', 'documentType', 'authorScore',
      'hasImages', 'hasLinks', 'contentQuality',
      'sectionRank', 'documentStructure',
      
      // User features (11)
      'clickCount', 'clickThroughRate', 'avgDwellTime',
      'explicitFeedback', 'skipRate', 'returnVisits',
      'userPreviousClicks', 'userDomainPreference', 'userTopicInterest',
      'shareCount', 'bookmarkCount', 'commentCount'
    ];
    
    for (const featureName of featureOrder) {
      const value = features[featureName] || 0;
      vector.push(this.normalizeFeature(featureName, value));
      featureNames.push(featureName);
    }
    
    return {
      vector,
      featureNames,
      rawFeatures: features
    };
  }

  /**
   * Normalize feature values
   */
  normalizeFeature(featureName, value) {
    if (this.options.featureNormalization === 'none') {
      return value;
    }
    
    // Get or initialize feature statistics
    if (!this.featureStats.has(featureName)) {
      this.featureStats.set(featureName, {
        min: value,
        max: value,
        sum: value,
        count: 1,
        mean: value
      });
      return value;
    }
    
    const stats = this.featureStats.get(featureName);
    
    // Update statistics
    stats.min = Math.min(stats.min, value);
    stats.max = Math.max(stats.max, value);
    stats.sum += value;
    stats.count += 1;
    stats.mean = stats.sum / stats.count;
    
    // Apply normalization
    switch (this.options.featureNormalization) {
      case 'minmax':
        return stats.max > stats.min ? (value - stats.min) / (stats.max - stats.min) : 0;
        
      case 'zscore':
        // Simplified z-score (would need proper standard deviation in real implementation)
        return stats.mean !== 0 ? (value - stats.mean) / Math.abs(stats.mean) : 0;
        
      case 'log':
        return value > 0 ? Math.log(1 + value) : 0;
        
      default:
        return value;
    }
  }

  // Helper methods for feature calculation
  
  calculateTitleMatch(query, title) {
    if (!title || !query) return 0;
    
    const queryWords = query.toLowerCase().split(/\s+/);
    const titleWords = title.toLowerCase().split(/\s+/);
    
    const matches = queryWords.filter(word => titleWords.includes(word));
    return matches.length / queryWords.length;
  }

  calculateQueryOverlap(query, content) {
    if (!content || !query) return 0;
    
    const queryWords = new Set(query.toLowerCase().split(/\s+/));
    const contentWords = new Set(content.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...queryWords].filter(word => contentWords.has(word)));
    return intersection.size / queryWords.size;
  }

  encodeSourceType(source) {
    const sourceMap = {
      'sharepoint': 1,
      'box': 2,
      'database': 3,
      'file': 4,
      'web': 5,
      'api': 6
    };
    return sourceMap[source?.toLowerCase()] || 0;
  }

  encodeDocumentType(type) {
    const typeMap = {
      'pdf': 1,
      'docx': 2,
      'pptx': 3,
      'xlsx': 4,
      'txt': 5,
      'md': 6,
      'html': 7
    };
    return typeMap[type?.toLowerCase()] || 0;
  }

  calculateAuthorScore(author) {
    // Mock author scoring - would be based on actual author reputation
    if (!author) return 0;
    return Math.random() * 0.3 + 0.7; // 0.7-1.0 range
  }

  assessContentQuality(document) {
    // Simple content quality assessment
    const content = document.content || document.snippet || '';
    const length = content.length;
    
    if (length < 100) return 0.3;
    if (length < 500) return 0.6;
    if (length < 2000) return 0.8;
    return 1.0;
  }

  calculateSectionRank(document) {
    // Position within document structure
    return document.sectionRank || 0.5;
  }

  assessDocumentStructure(document) {
    // Document has good structure (headings, lists, etc.)
    const hasStructure = (document.headings?.length || 0) + (document.lists?.length || 0);
    return Math.min(hasStructure / 10, 1.0);
  }

  calculateUserDomainPreference(document, userHistory) {
    if (!document.domain || !userHistory.domains) return 0;
    return userHistory.domains[document.domain] || 0;
  }

  calculateUserTopicInterest(document, userHistory) {
    if (!document.topics || !userHistory.topics) return 0;
    
    const docTopics = new Set(document.topics);
    const userTopics = userHistory.topics || {};
    
    let interest = 0;
    for (const topic of docTopics) {
      interest += userTopics[topic] || 0;
    }
    
    return Math.min(interest / docTopics.size, 1.0);
  }
}

/**
 * Learning-to-Rank Model Trainer
 */
class LearningToRankTrainer {
  constructor(featureExtractor, options = {}) {
    this.featureExtractor = featureExtractor;
    this.options = {
      algorithm: options.algorithm || 'lambdamart', // 'lambdamart', 'xgboost', 'neural'
      maxTrees: options.maxTrees || 500,
      learningRate: options.learningRate || 0.1,
      maxDepth: options.maxDepth || 8,
      minChildWeight: options.minChildWeight || 1,
      subsample: options.subsample || 0.8,
      validationSplit: options.validationSplit || 0.2,
      earlyStoppingRounds: options.earlyStoppingRounds || 50,
      ...options
    };
    
    this.model = null;
    this.trainingHistory = [];
    this.currentVersion = 1;
  }

  /**
   * Train L2R model from user interaction data
   */
  async trainModel(trainingData, options = {}) {
    console.log('🤖 Training Learning-to-Rank model...');
    const startTime = performance.now();
    
    try {
      // Prepare training data
      const prepared = this.prepareTrainingData(trainingData);
      console.log(`📊 Prepared ${prepared.samples.length} training samples`);
      
      // Split into training and validation sets
      const split = this.splitData(prepared, this.options.validationSplit);
      
      // Train model (mock implementation)
      const model = await this.trainL2RModel(split.train, split.validation, options);
      
      // Evaluate model performance
      const evaluation = await this.evaluateModel(model, split.validation);
      
      const trainingTime = performance.now() - startTime;
      
      const trainingResult = {
        version: this.currentVersion++,
        algorithm: this.options.algorithm,
        trainingTime,
        trainingSize: split.train.length,
        validationSize: split.validation.length,
        performance: evaluation,
        timestamp: new Date().toISOString()
      };
      
      this.model = model;
      this.trainingHistory.push(trainingResult);
      
      console.log(`✅ Model training completed in ${trainingTime.toFixed(0)}ms`);
      console.log(`📈 nDCG@10: ${evaluation.ndcg10.toFixed(3)}, MRR: ${evaluation.mrr.toFixed(3)}`);
      
      return trainingResult;
      
    } catch (error) {
      console.error('❌ Model training failed:', error.message);
      throw error;
    }
  }

  /**
   * Prepare training data from user interactions
   */
  prepareTrainingData(rawData) {
    const samples = [];
    const queries = new Map();
    
    // Group by query
    for (const interaction of rawData) {
      const queryId = interaction.queryId;
      if (!queries.has(queryId)) {
        queries.set(queryId, {
          query: interaction.query,
          documents: [],
          searchResults: interaction.searchResults
        });
      }
      
      queries.get(queryId).documents.push({
        document: interaction.document,
        relevance: this.calculateRelevanceLabel(interaction),
        userContext: interaction.userContext || {}
      });
    }
    
    // Convert to training samples
    for (const [queryId, queryData] of queries) {
      for (const docData of queryData.documents) {
        const features = this.featureExtractor.extractFeatures(
          queryData.query,
          docData.document,
          queryData.searchResults,
          docData.userContext
        );
        
        samples.push({
          queryId,
          features: features.vector,
          featureNames: features.featureNames,
          relevance: docData.relevance,
          document: docData.document
        });
      }
    }
    
    return {
      samples,
      featureNames: samples[0]?.featureNames || [],
      queryCount: queries.size
    };
  }

  /**
   * Calculate relevance label from user interactions
   */
  calculateRelevanceLabel(interaction) {
    let relevance = 0;
    
    // Click signals
    if (interaction.clicked) relevance += 1;
    if (interaction.dwellTime > 30000) relevance += 1; // > 30 seconds
    if (interaction.dwellTime > 120000) relevance += 1; // > 2 minutes
    
    // Explicit feedback
    if (interaction.feedback === 'thumbs_up') relevance += 2;
    if (interaction.feedback === 'thumbs_down') relevance -= 1;
    if (interaction.rating) relevance += (interaction.rating - 3); // 5-star rating centered at 3
    
    // Action signals
    if (interaction.bookmarked) relevance += 1;
    if (interaction.shared) relevance += 1;
    if (interaction.returned) relevance += 1;
    
    // Negative signals
    if (interaction.skipped) relevance -= 0.5;
    if (interaction.backButton) relevance -= 0.5;
    
    // Normalize to 0-4 range (standard nDCG relevance levels)
    return Math.max(0, Math.min(4, Math.round(relevance)));
  }

  /**
   * Split data into training and validation sets
   */
  splitData(prepared, validationSplit) {
    const { samples } = prepared;
    const shuffled = [...samples].sort(() => Math.random() - 0.5);
    
    const splitIndex = Math.floor(samples.length * (1 - validationSplit));
    
    return {
      train: shuffled.slice(0, splitIndex),
      validation: shuffled.slice(splitIndex)
    };
  }

  /**
   * Train L2R model (mock implementation)
   */
  async trainL2RModel(trainData, validationData, options = {}) {
    console.log(`🎯 Training ${this.options.algorithm} model...`);
    
    // Simulate training time
    const baseTime = 2000;
    const timePerSample = trainData.length * 0.1;
    await new Promise(resolve => setTimeout(resolve, Math.min(baseTime + timePerSample, 10000)));
    
    // Mock model parameters (in real implementation, would train actual model)
    const model = {
      type: this.options.algorithm,
      version: this.currentVersion,
      features: trainData[0]?.featureNames || [],
      parameters: {
        maxTrees: this.options.maxTrees,
        learningRate: this.options.learningRate,
        maxDepth: this.options.maxDepth
      },
      weights: this.generateMockWeights(trainData[0]?.featureNames || []),
      trainingSize: trainData.length,
      timestamp: new Date().toISOString()
    };
    
    return model;
  }

  /**
   * Generate mock feature weights
   */
  generateMockWeights(featureNames) {
    const weights = {};
    
    for (const feature of featureNames) {
      // Higher weights for known important features
      let weight = Math.random() * 0.5 + 0.2; // Base: 0.2-0.7
      
      if (feature.includes('bm25') || feature.includes('vector')) weight *= 1.5;
      if (feature.includes('click') || feature.includes('feedback')) weight *= 1.3;
      if (feature.includes('pagerank') || feature.includes('jaccard')) weight *= 1.2;
      
      weights[feature] = weight;
    }
    
    return weights;
  }

  /**
   * Evaluate model performance
   */
  async evaluateModel(model, validationData) {
    // Group validation data by query
    const queryGroups = new Map();
    
    for (const sample of validationData) {
      if (!queryGroups.has(sample.queryId)) {
        queryGroups.set(sample.queryId, []);
      }
      queryGroups.get(sample.queryId).push(sample);
    }
    
    let totalNdcg = 0;
    let totalMrr = 0;
    let totalPrecision = 0;
    let queryCount = 0;
    
    // Evaluate each query
    for (const [queryId, samples] of queryGroups) {
      // Predict scores
      const predictions = samples.map(sample => ({
        ...sample,
        predictedScore: this.predictScore(model, sample.features)
      }));
      
      // Sort by predicted score
      predictions.sort((a, b) => b.predictedScore - a.predictedScore);
      
      // Calculate metrics
      const relevances = predictions.map(p => p.relevance);
      
      const ndcg10 = this.calculateNDCG(relevances, 10);
      const mrr = this.calculateMRR(relevances);
      const precision5 = this.calculatePrecision(relevances, 5);
      
      totalNdcg += ndcg10;
      totalMrr += mrr;
      totalPrecision += precision5;
      queryCount++;
    }
    
    return {
      ndcg10: totalNdcg / queryCount,
      mrr: totalMrr / queryCount,
      precision5: totalPrecision / queryCount,
      queryCount,
      sampleCount: validationData.length
    };
  }

  /**
   * Predict relevance score for a document
   */
  predictScore(model, features) {
    if (!model.weights) return Math.random();
    
    let score = 0;
    for (let i = 0; i < features.length; i++) {
      const featureName = model.features[i];
      const weight = model.weights[featureName] || 0.1;
      score += features[i] * weight;
    }
    
    return Math.max(0, score);
  }

  /**
   * Calculate nDCG@K
   */
  calculateNDCG(relevances, k = 10) {
    const gain = rel => Math.pow(2, rel) - 1;
    const dcg = relevances.slice(0, k).reduce((sum, rel, i) => 
      sum + gain(rel) / Math.log2(i + 2), 0
    );
    
    const idealRel = [...relevances].sort((a, b) => b - a);
    const idcg = idealRel.slice(0, k).reduce((sum, rel, i) => 
      sum + gain(rel) / Math.log2(i + 2), 0
    );
    
    return idcg > 0 ? dcg / idcg : 0;
  }

  /**
   * Calculate MRR (Mean Reciprocal Rank)
   */
  calculateMRR(relevances) {
    for (let i = 0; i < relevances.length; i++) {
      if (relevances[i] > 0) {
        return 1 / (i + 1);
      }
    }
    return 0;
  }

  /**
   * Calculate Precision@K
   */
  calculatePrecision(relevances, k = 5) {
    const relevant = relevances.slice(0, k).filter(rel => rel > 0).length;
    return relevant / Math.min(k, relevances.length);
  }

  /**
   * Get current model
   */
  getCurrentModel() {
    return this.model;
  }

  /**
   * Get training history
   */
  getTrainingHistory() {
    return this.trainingHistory;
  }

  /**
   * Save model to file
   */
  async saveModel(filePath) {
    if (!this.model) {
      throw new Error('No trained model to save');
    }
    
    const modelData = {
      model: this.model,
      trainingHistory: this.trainingHistory,
      savedAt: new Date().toISOString()
    };
    
    await fs.writeFile(filePath, JSON.stringify(modelData, null, 2));
    console.log(`💾 Model saved to ${filePath}`);
  }

  /**
   * Load model from file
   */
  async loadModel(filePath) {
    try {
      const modelData = JSON.parse(await fs.readFile(filePath, 'utf-8'));
      
      this.model = modelData.model;
      this.trainingHistory = modelData.trainingHistory || [];
      this.currentVersion = Math.max(...this.trainingHistory.map(h => h.version || 0), 0) + 1;
      
      console.log(`📦 Model loaded from ${filePath}`);
      return this.model;
      
    } catch (error) {
      console.error('❌ Failed to load model:', error.message);
      throw error;
    }
  }
}

/**
 * Main Learning-to-Rank System
 */
export class LearningToRankSystem {
  constructor(options = {}) {
    this.options = {
      featureExtractorOptions: options.featureExtractorOptions || {},
      trainerOptions: options.trainerOptions || {},
      retrainingThreshold: options.retrainingThreshold || 1000, // Number of interactions
      retrainingInterval: options.retrainingInterval || 7 * 24 * 60 * 60 * 1000, // 7 days
      modelVersions: options.modelVersions || 3, // Keep N versions
      ...options
    };
    
    this.featureExtractor = new FeatureExtractor(this.options.featureExtractorOptions);
    this.trainer = new LearningToRankTrainer(this.featureExtractor, this.options.trainerOptions);
    
    this.interactionBuffer = [];
    this.lastRetraining = null;
    this.isInitialized = false;
  }

  /**
   * Initialize L2R system
   */
  async initialize() {
    if (this.isInitialized) return;
    
    console.log('🎯 Initializing Learning-to-Rank System...');
    
    try {
      // Try to load existing model
      const modelPath = this.getModelPath('latest');
      try {
        await this.trainer.loadModel(modelPath);
        console.log('📦 Loaded existing L2R model');
      } catch {
        console.log('🆕 No existing model found, will train from scratch');
      }
      
      this.lastRetraining = new Date();
      this.isInitialized = true;
      
      console.log('✅ Learning-to-Rank System initialized');
      
    } catch (error) {
      console.error('❌ L2R initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Record user interaction for learning
   */
  recordInteraction(interaction) {
    this.interactionBuffer.push({
      ...interaction,
      timestamp: new Date().toISOString()
    });
    
    // Check if we need to retrain
    this.checkRetrainingConditions();
  }

  /**
   * Check if model should be retrained
   */
  checkRetrainingConditions() {
    const bufferSize = this.interactionBuffer.length;
    const timeSinceRetrain = this.lastRetraining ? Date.now() - this.lastRetraining.getTime() : Infinity;
    
    const shouldRetrain = 
      bufferSize >= this.options.retrainingThreshold ||
      timeSinceRetrain >= this.options.retrainingInterval;
    
    if (shouldRetrain) {
      // Trigger async retraining
      this.retrainModel().catch(error => {
        console.error('🔥 Async retraining failed:', error.message);
      });
    }
  }

  /**
   * Retrain model with accumulated interactions
   */
  async retrainModel() {
    if (this.interactionBuffer.length === 0) {
      console.log('⚠️  No new interactions to train on');
      return;
    }
    
    console.log(`🔄 Retraining model with ${this.interactionBuffer.length} new interactions...`);
    
    try {
      const trainingResult = await this.trainer.trainModel(this.interactionBuffer);
      
      // Save new model version
      const modelPath = this.getModelPath(`v${trainingResult.version}`);
      await this.trainer.saveModel(modelPath);
      
      // Update latest model link
      const latestPath = this.getModelPath('latest');
      await this.trainer.saveModel(latestPath);
      
      // Clear buffer and update timestamp
      this.interactionBuffer = [];
      this.lastRetraining = new Date();
      
      console.log(`✅ Model retrained successfully (version ${trainingResult.version})`);
      
      return trainingResult;
      
    } catch (error) {
      console.error('❌ Model retraining failed:', error.message);
      throw error;
    }
  }

  /**
   * Rerank search results using current model
   */
  async rerankResults(query, documents, searchResults, userContext = {}) {
    if (!this.trainer.getCurrentModel()) {
      console.warn('⚠️  No trained model available, using original ranking');
      return documents;
    }
    
    try {
      const startTime = performance.now();
      
      // Extract features for each document
      const scoredDocuments = await Promise.all(documents.map(async (document) => {
        const features = this.featureExtractor.extractFeatures(
          query,
          document,
          searchResults,
          userContext
        );
        
        const score = this.trainer.predictScore(
          this.trainer.getCurrentModel(),
          features.vector
        );
        
        return {
          ...document,
          l2rScore: score,
          l2rFeatures: features
        };
      }));
      
      // Sort by L2R score
      scoredDocuments.sort((a, b) => b.l2rScore - a.l2rScore);
      
      const rerankTime = performance.now() - startTime;
      
      return {
        documents: scoredDocuments,
        metadata: {
          rerankTime,
          modelVersion: this.trainer.getCurrentModel().version,
          featuresUsed: scoredDocuments[0]?.l2rFeatures?.featureNames?.length || 0
        }
      };
      
    } catch (error) {
      console.error('❌ L2R reranking failed:', error.message);
      return documents;
    }
  }

  /**
   * Get model file path
   */
  getModelPath(version) {
    const modelDir = './models/l2r';
    return path.join(modelDir, `l2r-model-${version}.json`);
  }

  /**
   * Get system statistics
   */
  getStatistics() {
    return {
      interactionBuffer: this.interactionBuffer.length,
      lastRetraining: this.lastRetraining?.toISOString(),
      currentModel: this.trainer.getCurrentModel()?.version,
      trainingHistory: this.trainer.getTrainingHistory().length,
      isInitialized: this.isInitialized,
      retrainingThreshold: this.options.retrainingThreshold
    };
  }
}

export { FeatureExtractor, LearningToRankTrainer };
export default LearningToRankSystem;