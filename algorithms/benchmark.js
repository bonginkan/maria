#!/usr/bin/env node

/**
 * Sorting Algorithm Benchmark Runner
 * Comprehensive performance testing and analysis
 */

const SortingComparison = require('./comparison');

console.log('🚀 Starting Sorting Algorithm Benchmark Suite');
console.log('=' .repeat(80));

// Create comparison instance
const comparison = new SortingComparison({ 
  verbose: true,
  iterations: 3 
});

// Run quick comparison
console.log('\n📊 Quick Performance Comparison');
const quickResults = comparison.runComparison([100, 1000, 5000]);

// Run detailed analysis
console.log('\n📈 Detailed Statistical Analysis');
const detailedResults = comparison.detailedAnalysis(1000, 5);

// Validate complexity for each algorithm
console.log('\n🔬 Complexity Validation');
['quicksort', 'mergesort', 'heapsort'].forEach(algo => {
  comparison.validateComplexity(algo, 5000);
});

// Export results
// comparison.exportToCSV(quickResults, 'benchmark-results.csv');

console.log('\n' + '='.repeat(80));
console.log('✅ Benchmark Complete!');
console.log('=' .repeat(80));