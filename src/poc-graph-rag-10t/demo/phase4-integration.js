#!/usr/bin/env node

/**
 * Phase 4 Integration Demo Script
 * 
 * Demonstrates the complete Phase 4 implementation:
 * - Golden Dataset evaluation with A/B testing
 * - Explain/Provenance API functionality
 * - Enhanced metrics and tracing
 * - Data masking and security features
 * 
 * Usage:
 *   node demo/phase4-integration.js
 *   node demo/phase4-integration.js --full-demo
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

// Phase 4 implementations
import { explainableSearch, ResultAttribution } from '../api/explain.js';
import metrics from '../observability/metrics.js';
import tracing, { SearchTracer } from '../observability/tracing.js';
import masking from '../security/masking.js';

// Mock data for demo
const DEMO_QUERIES = [
  {
    id: 'demo001',
    text: 'API authentication security implementation with JWT tokens',
    language: 'en',
    domain: 'technical'
  },
  {
    id: 'demo002', 
    text: 'プロジェクトAの要件定義とセキュリティガイドライン',
    language: 'ja',
    domain: 'project-management'
  },
  {
    id: 'demo003',
    text: 'Database performance optimization for user data processing',
    language: 'en',
    domain: 'technical',
    containsPII: true
  }
];

const DEMO_RESULTS = [
  {
    id: 'doc1',
    title: 'API Security Implementation Guide',
    snippet: 'JWT authentication provides secure token-based access control. Contact admin@company.com for API keys.',
    score: 0.89,
    highlights: ['JWT authentication', 'secure token-based', 'API keys']
  },
  {
    id: 'doc2', 
    title: 'Project Requirements Document',
    snippet: 'システム要件: ユーザー認証機能の実装が必要。連絡先: 田中太郎 (tanaka@example.jp, 03-1234-5678)',
    score: 0.76,
    highlights: ['ユーザー認証', '実装']
  },
  {
    id: 'doc3',
    title: 'Database Optimization Strategies',
    snippet: 'User table optimization for customer records. SSN: 123-45-6789, Account: 9876543210',
    score: 0.82,
    highlights: ['User table', 'optimization', 'customer records']
  }
];

/**
 * Initialize demo environment
 */
async function initializeDemo() {
  console.log('🚀 Initializing Phase 4 Demo Environment\n');
  
  // Start tracing
  tracing.startTracing();
  
  // Initialize metrics
  console.log('📊 Metrics system initialized');
  
  console.log('🔒 Security masking configured');
  console.log('🔍 Explain/Provenance API ready');
  console.log('📡 Distributed tracing active\n');
}

/**
 * Demo 1: Golden Dataset A/B Testing
 */
async function demoEvaluation() {
  console.log('=== Demo 1: Golden Dataset A/B Testing ===\n');
  
  try {
    // Load demo dataset
    const dataset = {
      version: '1.0',
      queries: DEMO_QUERIES.slice(0, 2) // Use first 2 queries
    };
    
    console.log(`📝 Loaded ${dataset.queries.length} demo queries`);
    
    // Simulate A/B test variants
    const variants = [
      { name: 'baseline', kgBoost: false, rerank: true },
      { name: 'kg_enhanced', kgBoost: true, rerank: true }
    ];
    
    const results = {};
    
    for (const variant of variants) {
      console.log(`\n🧪 Testing variant: ${variant.name}`);
      const variantResults = [];
      
      for (const query of dataset.queries) {
        // Simulate search with timing
        const timer = metrics.createTimer();
        
        // Mock search results with different scores based on variant
        const searchResults = DEMO_RESULTS.map(result => ({
          ...result,
          score: variant.kgBoost ? result.score * 1.1 : result.score,
          variant: variant.name
        }));
        
        const latency = timer.end();
        
        // Record metrics
        metrics.recordSearch(latency, query.language, variant.name, 'success');
        
        // Calculate mock quality metrics
        const mockMetrics = {
          ndcg10: variant.kgBoost ? 0.78 : 0.72,
          mrr: variant.kgBoost ? 0.85 : 0.80,
          precision5: variant.kgBoost ? 0.90 : 0.85
        };
        
        variantResults.push({
          query: query.id,
          metrics: mockMetrics,
          latency,
          results: searchResults
        });
        
        console.log(`  📈 ${query.id}: nDCG@10=${mockMetrics.ndcg10.toFixed(3)}, latency=${latency.toFixed(0)}ms`);
      }
      
      // Calculate averages
      const avgNdcg = variantResults.reduce((sum, r) => sum + r.metrics.ndcg10, 0) / variantResults.length;
      const avgMrr = variantResults.reduce((sum, r) => sum + r.metrics.mrr, 0) / variantResults.length;
      const avgLatency = variantResults.reduce((sum, r) => sum + r.latency, 0) / variantResults.length;
      
      results[variant.name] = {
        avgNdcg,
        avgMrr, 
        avgLatency,
        results: variantResults
      };
      
      console.log(`  ✅ ${variant.name}: nDCG@10=${avgNdcg.toFixed(3)}, MRR=${avgMrr.toFixed(3)}, p95=${avgLatency.toFixed(0)}ms`);
    }
    
    // Compare results
    const improvement = ((results.kg_enhanced.avgNdcg - results.baseline.avgNdcg) / results.baseline.avgNdcg * 100);
    
    console.log(`\n📊 A/B Test Results:`);
    console.log(`   KG Enhancement improved nDCG@10 by ${improvement.toFixed(1)}%`);
    console.log(`   ${improvement > 5 ? '🎯 Significant improvement!' : '📈 Moderate improvement'}`);
    
  } catch (error) {
    console.error('❌ Evaluation demo failed:', error.message);
  }
}

/**
 * Demo 2: Explain/Provenance API
 */
async function demoExplain() {
  console.log('\n=== Demo 2: Explain/Provenance API ===\n');
  
  try {
    const query = DEMO_QUERIES[0];
    console.log(`🔍 Explaining search for: "${query.text}"`);
    
    // Create search tracer
    const searchTracer = new SearchTracer(query.text, {
      kgBoost: true,
      rerank: true,
      language: query.language
    });
    
    // Simulate search pipeline with tracing
    const bm25Results = await searchTracer.runStage('bm25', async () => {
      await new Promise(resolve => setTimeout(resolve, 50)); // Simulate latency
      return DEMO_RESULTS.map((r, i) => ({ ...r, bm25Score: r.score - (i * 0.1) }));
    });
    
    const vectorResults = await searchTracer.runStage('vector', async () => {
      await new Promise(resolve => setTimeout(resolve, 80));
      return DEMO_RESULTS.map((r, i) => ({ ...r, vectorScore: r.score - (i * 0.05) }));
    });
    
    const kgResults = await searchTracer.runStage('kg', async () => {
      await new Promise(resolve => setTimeout(resolve, 30));
      return DEMO_RESULTS.map((r, i) => ({ 
        ...r, 
        kgScore: r.score * 0.3,
        features: { mentions: 3 - i, jaccard: 0.5 - (i * 0.1), pagerank: 0.15 - (i * 0.02) }
      }));
    });
    
    const finalResults = await searchTracer.runStage('rerank', async () => {
      await new Promise(resolve => setTimeout(resolve, 120));
      return DEMO_RESULTS.map((r, i) => ({
        ...r,
        finalScore: r.score * (1.05 - i * 0.02),
        rerankBoost: 0.05 - (i * 0.01)
      }));
    });
    
    // End tracing
    searchTracer.end(finalResults);
    
    // Generate explanation
    const explanation = {
      pipeline: 'BM25 → Vector → KG Boost → Cross-Encoder Rerank',
      stages: [
        { name: 'BM25', duration: '50ms', results: bm25Results.length },
        { name: 'Vector', duration: '80ms', results: vectorResults.length },
        { name: 'KG Boost', duration: '30ms', features: ['mentions', 'jaccard', 'pagerank'] },
        { name: 'Rerank', duration: '120ms', model: 'cross-encoder' }
      ],
      finalRanking: finalResults.slice(0, 3).map((r, i) => ({
        rank: i + 1,
        title: r.title,
        finalScore: r.finalScore?.toFixed(3),
        contributions: {
          bm25: (r.bm25Score || r.score).toFixed(3),
          vector: (r.vectorScore || r.score).toFixed(3),
          kg: (r.kgScore || 0).toFixed(3),
          rerank: `+${(r.rerankBoost || 0).toFixed(3)}`
        }
      }))
    };
    
    console.log('📋 Pipeline Explanation:');
    console.log(`   ${explanation.pipeline}`);
    console.log('\n⏱️  Stage Performance:');
    explanation.stages.forEach(stage => {
      console.log(`   ${stage.name}: ${stage.duration} (${stage.results || 'processed'} items)`);
    });
    
    console.log('\n🏆 Final Ranking with Attribution:');
    explanation.finalRanking.forEach(item => {
      console.log(`   ${item.rank}. ${item.title} (${item.finalScore})`);
      console.log(`      BM25: ${item.contributions.bm25}, Vector: ${item.contributions.vector}, KG: ${item.contributions.kg}, Rerank: ${item.contributions.rerank}`);
    });
    
  } catch (error) {
    console.error('❌ Explain demo failed:', error.message);
  }
}

/**
 * Demo 3: Enhanced Metrics and Monitoring
 */
async function demoMetrics() {
  console.log('\n=== Demo 3: Enhanced Metrics and Monitoring ===\n');
  
  try {
    console.log('📊 Generating sample metrics...');
    
    // Simulate various search operations
    const operations = [
      { stage: 'bm25', duration: 45, language: 'en' },
      { stage: 'vector', duration: 78, language: 'en' }, 
      { stage: 'kg', duration: 32, language: 'ja' },
      { stage: 'rerank', duration: 125, language: 'en' }
    ];
    
    // Record stage metrics
    operations.forEach(op => {
      metrics.recordStage(op.stage, op.duration, op.language);
    });
    
    // Record quality metrics
    metrics.recordQuality('ndcg10', 0.78, 'kg_enhanced', 'en');
    metrics.recordQuality('mrr', 0.85, 'kg_enhanced', 'en');
    metrics.recordQuality('ndcg10', 0.72, 'baseline', 'en');
    
    // Record cache operations
    metrics.recordCache('redis', 'get', true, 2.5);
    metrics.recordCache('redis', 'set', false, 8.3);
    
    // Record user feedback
    metrics.recordFeedback('thumbs_up', 1, 'technical');
    metrics.recordFeedback('rating', 4, 'general');
    
    console.log('✅ Metrics recorded successfully');
    
    // Demonstrate metrics export (would normally be scraped by Prometheus)
    console.log('\n📈 Sample Metrics Export:');
    console.log('```');
    console.log('# HELP graphrag_search_latency_seconds End-to-end search request latency');
    console.log('graphrag_search_latency_seconds{stage="total",language="en",variant="kg_enhanced"} 0.280');
    console.log('');
    console.log('# HELP graphrag_search_quality_score Search quality metrics');
    console.log('graphrag_search_quality_score{metric="ndcg10",variant="kg_enhanced",language="en"} 0.78');
    console.log('graphrag_search_quality_score{metric="ndcg10",variant="baseline",language="en"} 0.72');
    console.log('```');
    
  } catch (error) {
    console.error('❌ Metrics demo failed:', error.message);
  }
}

/**
 * Demo 4: Data Masking and Security
 */
async function demoSecurity() {
  console.log('\n=== Demo 4: Data Masking and Security ===\n');
  
  try {
    console.log('🔒 Demonstrating PII detection and masking...\n');
    
    // Test different types of sensitive content
    const testData = [
      {
        name: 'Search Result with PII',
        content: DEMO_RESULTS[2].snippet, // Contains SSN and account number
        context: 'snippets'
      },
      {
        name: 'Japanese Contact Info',
        content: DEMO_RESULTS[1].snippet, // Contains email and phone
        context: 'snippets'
      },
      {
        name: 'Log Entry',
        content: 'User john.doe@company.com failed authentication from IP 192.168.1.100',
        context: 'logs'
      }
    ];
    
    testData.forEach((test, index) => {
      console.log(`${index + 1}. ${test.name}:`);
      console.log(`   Original: "${test.content}"`);
      
      // Analyze PII
      const analysis = masking.analyzePII(test.content);
      console.log(`   PII Analysis: ${analysis.hasPII ? `${analysis.types.length} types detected (${analysis.riskLevel} risk)` : 'No PII detected'}`);
      
      if (analysis.hasPII) {
        analysis.types.forEach(type => {
          console.log(`     - ${type.description}: ${type.count} occurrence(s)`);
        });
      }
      
      // Apply masking
      const masked = masking.maskForContext(test.content, test.context);
      console.log(`   Masked:   "${masked.masked}"`);
      console.log(`   Changed:  ${masked.changed ? 'Yes' : 'No'}\n`);
    });
    
    // Demonstrate search result masking
    console.log('🔍 Search Results Masking:');
    const maskedResults = masking.maskSnippets(DEMO_RESULTS);
    
    maskedResults.forEach((result, index) => {
      if (result._masking) {
        console.log(`   Result ${index + 1}: ${result.title}`);
        console.log(`   Snippet: "${result.snippet}"`);
        if (result._masking.snippet) {
          console.log(`   PII Types: ${result._masking.snippet.piiDetected.join(', ')}`);
        }
        console.log();
      }
    });
    
  } catch (error) {
    console.error('❌ Security demo failed:', error.message);
  }
}

/**
 * Demo 5: Integration Test
 */
async function demoIntegration() {
  console.log('=== Demo 5: End-to-End Integration ===\n');
  
  try {
    const query = DEMO_QUERIES[2]; // Query with PII content
    console.log(`🔗 End-to-end search with all Phase 4 features`);
    console.log(`   Query: "${query.text}"`);
    
    // Start comprehensive tracing
    const searchTracer = new SearchTracer(query.text, {
      kgBoost: true,
      rerank: true,
      language: query.language
    });
    
    const timer = metrics.createTimer();
    
    // Simulate full search pipeline
    console.log('\n🔄 Processing stages...');
    
    const results = await searchTracer.runStage('full-pipeline', async () => {
      // Simulate realistic processing times
      await new Promise(resolve => setTimeout(resolve, 250));
      
      // Return results that will need masking
      return DEMO_RESULTS;
    });
    
    const totalTime = timer.end();
    searchTracer.end(results);
    
    // Apply security masking
    const maskedResults = masking.maskSnippets(results, {
      domain: query.domain
    });
    
    // Record comprehensive metrics
    metrics.recordSearch(totalTime, query.language, 'integrated', 'success', 'total');
    metrics.recordQuality('ndcg10', 0.82, 'integrated', query.language);
    
    // Generate comprehensive response
    console.log('✅ Processing complete!\n');
    console.log('📊 Performance Metrics:');
    console.log(`   Total Time: ${totalTime.toFixed(0)}ms`);
    console.log(`   Results: ${results.length} documents`);
    console.log(`   PII Protection: ${maskedResults.filter(r => r._masking).length} results masked`);
    
    console.log('\n🔍 Masked Results:');
    maskedResults.slice(0, 2).forEach((result, index) => {
      console.log(`   ${index + 1}. ${result.title} (score: ${result.score})`);
      console.log(`      Snippet: "${result.snippet}"`);
      if (result._masking?.snippet?.piiDetected?.length > 0) {
        console.log(`      🔒 Masked PII: ${result._masking.snippet.piiDetected.join(', ')}`);
      }
    });
    
    console.log('\n📡 Tracing Information:');
    console.log(`   Trace ID: ${tracing.getCurrentTraceId() || 'demo-trace-123'}`);
    console.log(`   Spans Created: 1 root + 1 stage span`);
    console.log(`   Exported to: Jaeger (${process.env.JAEGER_ENDPOINT || 'http://localhost:14268'})`);
    
  } catch (error) {
    console.error('❌ Integration demo failed:', error.message);
  }
}

/**
 * Main demo execution
 */
async function runDemo() {
  const args = process.argv.slice(2);
  const fullDemo = args.includes('--full-demo');
  
  console.log('🎯 Graph RAG 10T - Phase 4 Demo\n');
  
  await initializeDemo();
  
  try {
    // Run evaluation demo
    await demoEvaluation();
    
    if (fullDemo) {
      // Run all demos
      await demoExplain();
      await demoMetrics();
      await demoSecurity();
      await demoIntegration();
    } else {
      console.log('\n💡 Run with --full-demo to see all Phase 4 features');
      await demoSecurity(); // Always show security demo
      await demoIntegration(); // Always show integration
    }
    
    console.log('\n🎉 Phase 4 Demo Complete!');
    console.log('\nPhase 4 delivers:');
    console.log('✅ Golden Dataset evaluation with A/B testing');
    console.log('✅ Explainable AI with step-by-step attribution');  
    console.log('✅ Comprehensive metrics and distributed tracing');
    console.log('✅ Enterprise-grade PII protection and masking');
    console.log('✅ Production-ready observability and monitoring');
    
    console.log('\n🚀 Ready for Phase 5: GPU optimization, multi-language, and Learning-to-Rank!');
    
  } catch (error) {
    console.error('\n❌ Demo execution failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    await tracing.shutdownTracing();
  }
}

// Run demo if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo();
}