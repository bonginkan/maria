#!/usr/bin/env node

/**
 * A/B Testing Runner for Graph RAG 10T Evaluation
 * 
 * Usage:
 *   node tests/golden/runner-ab.js --file tests/golden/dataset.json --config tests/golden/config.json
 *   node tests/golden/runner-ab.js --help
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

// === Quality Metrics Implementation ===

/**
 * Normalized Discounted Cumulative Gain at K
 * @param {number[]} relevances - Relevance scores for results
 * @param {number} k - Cut-off rank
 * @returns {number} nDCG@K score
 */
function ndcgAtK(relevances, k = 10) {
  const gain = (x) => Math.pow(2, x) - 1;
  const discount = (i) => Math.log2(i + 2);
  
  const dcg = relevances
    .slice(0, k)
    .reduce((sum, rel, i) => sum + gain(rel) / discount(i), 0);
  
  const idealRel = [...relevances].sort((a, b) => b - a);
  const idcg = idealRel
    .slice(0, k)
    .reduce((sum, rel, i) => sum + gain(rel) / discount(i), 0);
  
  return idcg > 0 ? dcg / idcg : 0;
}

/**
 * Mean Reciprocal Rank
 * @param {number[]} relevances - Relevance scores for results
 * @returns {number} MRR score
 */
function mrr(relevances) {
  for (let i = 0; i < relevances.length; i++) {
    if (relevances[i] > 0) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

/**
 * Precision at K
 * @param {number[]} relevances - Relevance scores for results
 * @param {number} k - Cut-off rank
 * @returns {number} Precision@K score
 */
function precisionAtK(relevances, k = 5) {
  const relevant = relevances.slice(0, k).filter(rel => rel > 0).length;
  return relevant / Math.min(k, relevances.length);
}

/**
 * Recall at K
 * @param {number[]} relevances - Relevance scores for results
 * @param {number[]} allRelevant - All relevant items for this query
 * @param {number} k - Cut-off rank
 * @returns {number} Recall@K score
 */
function recallAtK(relevances, allRelevant, k = 10) {
  if (allRelevant.length === 0) return 0;
  const retrieved = relevances.slice(0, k).filter(rel => rel > 0).length;
  return retrieved / allRelevant.length;
}

// === Search API Client ===

/**
 * Call search API with given parameters
 * @param {object} query - Query object from dataset
 * @param {object} params - Search parameters
 * @param {object} config - Test configuration
 * @returns {Promise<object>} Search results
 */
async function callSearch(query, params, config) {
  const startTime = performance.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs || 5000);
    
    const response = await fetch(`${config.baseUrl}/api/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        query: query.text,
        topK: config.topK || 10,
        language: query.language,
        ...params
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    const latency = performance.now() - startTime;
    
    return {
      ...result,
      _meta: {
        latency,
        status: 'success',
        timestamp: new Date().toISOString()
      }
    };
    
  } catch (error) {
    const latency = performance.now() - startTime;
    return {
      sources: [],
      error: error.message,
      _meta: {
        latency,
        status: 'error',
        timestamp: new Date().toISOString()
      }
    };
  }
}

/**
 * Grade search results based on relevance judgments
 * @param {array} sources - Search result sources
 * @param {array} qrels - Query relevance judgments
 * @returns {number[]} Relevance scores for each result
 */
function gradeResults(sources, qrels) {
  if (!sources || !Array.isArray(sources)) return [];
  
  return sources.map(source => {
    const sourceId = source.id || source.path || source.uri || source.title || '';
    
    // Find matching relevance judgment
    const judgment = (qrels || []).find(qrel => {
      return sourceId.includes(qrel.prefix) || qrel.prefix.includes(sourceId);
    });
    
    return judgment ? judgment.rel : 0;
  });
}

// === Statistical Analysis ===

/**
 * Calculate statistical significance using t-test
 * @param {number[]} a - Sample A
 * @param {number[]} b - Sample B
 * @returns {object} Statistical test results
 */
function tTest(a, b) {
  const meanA = a.reduce((sum, x) => sum + x, 0) / a.length;
  const meanB = b.reduce((sum, x) => sum + x, 0) / b.length;
  
  const varA = a.reduce((sum, x) => sum + Math.pow(x - meanA, 2), 0) / (a.length - 1);
  const varB = b.reduce((sum, x) => sum + Math.pow(x - meanB, 2), 0) / (b.length - 1);
  
  const se = Math.sqrt(varA / a.length + varB / b.length);
  const tStat = (meanA - meanB) / se;
  
  return {
    meanA,
    meanB,
    difference: meanA - meanB,
    tStatistic: tStat,
    significant: Math.abs(tStat) > 2.0 // Simple threshold
  };
}

/**
 * Calculate summary statistics
 * @param {number[]} values - Array of values
 * @returns {object} Summary statistics
 */
function calculateStats(values) {
  if (values.length === 0) return { mean: 0, std: 0, min: 0, max: 0, median: 0 };
  
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / values.length;
  const variance = values.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / values.length;
  
  return {
    mean,
    std: Math.sqrt(variance),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median: sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)]
  };
}

// === Main Execution ===

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].substring(2);
      const value = args[i + 1];
      parsed[key] = value;
      i++; // Skip next argument as it's the value
    }
  }
  
  return parsed;
}

/**
 * Show help information
 */
function showHelp() {
  console.log(`
Graph RAG A/B Testing Runner

Usage:
  node runner-ab.js --file <dataset.json> --config <config.json> [options]

Options:
  --file      Path to golden dataset file (required)
  --config    Path to configuration file (required)  
  --output    Output directory for results (default: ./results)
  --verbose   Enable verbose logging
  --help      Show this help message

Example:
  node runner-ab.js --file dataset.json --config config.json --output ./results
`);
}

/**
 * Run A/B evaluation
 */
async function runEvaluation() {
  const args = parseArgs();
  
  if (args.help) {
    showHelp();
    process.exit(0);
  }
  
  if (!args.file || !args.config) {
    console.error('Error: --file and --config are required');
    showHelp();
    process.exit(1);
  }
  
  try {
    // Load configuration and dataset
    const dataset = JSON.parse(await fs.readFile(args.file, 'utf-8'));
    const config = JSON.parse(await fs.readFile(args.config, 'utf-8'));
    const outputDir = args.output || './results';
    
    console.log(`🚀 Starting A/B Evaluation`);
    console.log(`📊 Dataset: ${dataset.queries.length} queries`);
    console.log(`⚙️  Variants: ${config.variants.map(v => v.name).join(', ')}`);\n    console.log(`🎯 Metrics: ${config.metrics.quality.join(', ')}`);
    
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });
    
    // Run evaluation for each variant
    const results = {};
    
    for (const variant of config.variants) {
      console.log(`\\n🧪 Testing variant: ${variant.name}`);\n      
      const variantResults = [];
      const latencies = [];
      let errors = 0;
      
      // Process queries (with optional parallelization)
      const queries = dataset.queries;
      const batchSize = config.testSettings?.maxConcurrency || 5;
      
      for (let i = 0; i < queries.length; i += batchSize) {
        const batch = queries.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (query) => {
          if (args.verbose) {
            console.log(`  📝 Query: ${query.id} - ${query.text.substring(0, 50)}...`);
          }
          
          const result = await callSearch(query, variant.params, config.testSettings);
          latencies.push(result._meta.latency);
          
          if (result._meta.status === 'error') {
            errors++;
            console.warn(`  ⚠️  Error for query ${query.id}: ${result.error}`);
            return { query, result: null, relevances: [] };
          }
          
          const relevances = gradeResults(result.sources, query.relevance);
          const allRelevant = query.relevance.filter(r => r.rel > 0);
          
          return {
            query,
            result,
            relevances,
            metrics: {
              ndcg10: ndcgAtK(relevances, 10),
              mrr: mrr(relevances),
              precision5: precisionAtK(relevances, 5),
              recall10: recallAtK(relevances, allRelevant, 10)
            }
          };
        });
        
        const batchResults = await Promise.all(batchPromises);
        variantResults.push(...batchResults);
        
        // Progress indicator
        const progress = Math.min(i + batchSize, queries.length);
        console.log(`  📈 Progress: ${progress}/${queries.length} queries`);
      }
      
      // Calculate aggregate metrics
      const validResults = variantResults.filter(r => r.result !== null);
      const metrics = {
        ndcg10: validResults.map(r => r.metrics.ndcg10),
        mrr: validResults.map(r => r.metrics.mrr),
        precision5: validResults.map(r => r.metrics.precision5),
        recall10: validResults.map(r => r.metrics.recall10)
      };
      
      const summary = {
        variant: variant.name,
        totalQueries: queries.length,
        validResults: validResults.length,
        errorRate: errors / queries.length,
        qualityMetrics: {
          ndcg10: calculateStats(metrics.ndcg10),
          mrr: calculateStats(metrics.mrr),
          precision5: calculateStats(metrics.precision5),
          recall10: calculateStats(metrics.recall10)
        },
        performanceMetrics: {
          latency: calculateStats(latencies)
        },
        details: args.verbose ? variantResults : null
      };
      
      results[variant.name] = summary;
      
      console.log(`  ✅ ${variant.name} Complete:`);
      console.log(`     nDCG@10: ${summary.qualityMetrics.ndcg10.mean.toFixed(3)} ± ${summary.qualityMetrics.ndcg10.std.toFixed(3)}`);
      console.log(`     MRR: ${summary.qualityMetrics.mrr.mean.toFixed(3)} ± ${summary.qualityMetrics.mrr.std.toFixed(3)}`);
      console.log(`     Latency p95: ${summary.performanceMetrics.latency.p95.toFixed(0)}ms`);
      console.log(`     Error Rate: ${(summary.errorRate * 100).toFixed(1)}%`);
    }
    
    // Statistical comparison
    console.log(`\\n📊 Statistical Comparison:`);\n    const variants = Object.keys(results);
    
    if (variants.length >= 2) {
      for (let i = 0; i < variants.length - 1; i++) {
        for (let j = i + 1; j < variants.length; j++) {
          const varA = variants[i];
          const varB = variants[j];
          
          const ndcgA = results[varA].qualityMetrics.ndcg10;
          const ndcgB = results[varB].qualityMetrics.ndcg10;
          
          const improvement = ((ndcgB.mean - ndcgA.mean) / ndcgA.mean * 100);
          
          console.log(`\\n  ${varB} vs ${varA}:`);
          console.log(`    nDCG@10 improvement: ${improvement.toFixed(1)}%`);
          
          if (Math.abs(improvement) > 5) {
            console.log(`    🎯 Significant improvement detected!`);
          }
        }
      }
    }
    
    // Generate output files
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = path.join(outputDir, `ab-results-${timestamp}.json`);
    
    await fs.writeFile(outputFile, JSON.stringify({
      metadata: {
        timestamp: new Date().toISOString(),
        dataset: args.file,
        config: args.config,
        variants: config.variants.map(v => ({ name: v.name, description: v.description }))
      },
      results
    }, null, 2));
    
    console.log(`\\n💾 Results saved to: ${outputFile}`);\n    
    // Determine winner and exit code
    const winner = variants.reduce((best, current) => {
      const bestScore = results[best].qualityMetrics.ndcg10.mean;
      const currentScore = results[current].qualityMetrics.ndcg10.mean;
      return currentScore > bestScore ? current : best;
    });
    
    console.log(`\\n🏆 Winner: ${winner}`);\n    console.log(`\\n✨ Evaluation Complete!`);\n    
    // Exit with success if winner shows significant improvement
    const baseline = variants[0];
    const baselineScore = results[baseline].qualityMetrics.ndcg10.mean;
    const winnerScore = results[winner].qualityMetrics.ndcg10.mean;
    const improvement = (winnerScore - baselineScore) / baselineScore;
    
    process.exit(improvement > 0.05 ? 0 : 1); // 5% improvement threshold
    
  } catch (error) {
    console.error(`❌ Evaluation failed: ${error.message}`);
    if (args.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runEvaluation();
}