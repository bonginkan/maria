/**
 * Sorting Algorithm Comparison Framework
 * Comprehensive benchmarking and analysis tool
 */

const { QuickSortAdvanced } = require('../quicksort-advanced');
const MergeSort = require('./mergesort');
const HeapSort = require('./heapsort');

class SortingComparison {
  constructor(options = {}) {
    this.verbose = options.verbose || false;
    this.iterations = options.iterations || 1;
    this.algorithms = {
      quicksort: new QuickSortAdvanced(),
      mergesort: new MergeSort(),
      heapsort: new HeapSort(),
      // Native JavaScript sort for comparison
      native: {
        sort: (arr) => arr.sort((a, b) => a - b),
        getStats: () => ({ comparisons: 0, swaps: 0 })
      }
    };
    this.results = [];
  }

  /**
   * Run comprehensive comparison
   */
  runComparison(sizes = [100, 500, 1000, 5000, 10000]) {
    console.log('='.repeat(80));
    console.log('SORTING ALGORITHM COMPARISON');
    console.log('='.repeat(80));

    const patterns = [
      { name: 'Random', generator: this.generateRandom },
      { name: 'Nearly Sorted', generator: this.generateNearlySorted },
      { name: 'Reverse Sorted', generator: this.generateReverse },
      { name: 'Many Duplicates', generator: this.generateDuplicates },
      { name: 'Few Unique', generator: this.generateFewUnique }
    ];

    const results = {};

    sizes.forEach(size => {
      results[size] = {};
      
      console.log(`\n${'='.repeat(60)}`);
      console.log(`SIZE: ${size} elements`);
      console.log('='.repeat(60));

      patterns.forEach(pattern => {
        console.log(`\n${pattern.name} Data:`);
        console.log('-'.repeat(40));
        
        const testData = pattern.generator.call(this, size);
        results[size][pattern.name] = this.compareAlgorithms(testData);
        
        this.printResults(results[size][pattern.name]);
      });
    });

    return results;
  }

  /**
   * Compare all algorithms on the same dataset
   */
  compareAlgorithms(originalData) {
    const results = {};

    Object.keys(this.algorithms).forEach(name => {
      const algorithm = this.algorithms[name];
      const data = [...originalData]; // Copy array
      
      // Warm up (optional)
      if (this.iterations > 1) {
        algorithm.sort([...data]);
      }

      // Measure performance
      const measurements = [];
      
      for (let i = 0; i < this.iterations; i++) {
        const testData = [...data];
        const startTime = process.hrtime.bigint();
        const startMemory = process.memoryUsage().heapUsed;
        
        algorithm.sort(testData);
        
        const endTime = process.hrtime.bigint();
        const endMemory = process.memoryUsage().heapUsed;
        
        measurements.push({
          time: Number(endTime - startTime) / 1000000, // Convert to milliseconds
          memory: (endMemory - startMemory) / 1024 // Convert to KB
        });
      }

      // Calculate averages
      const avgTime = measurements.reduce((sum, m) => sum + m.time, 0) / measurements.length;
      const avgMemory = measurements.reduce((sum, m) => sum + m.memory, 0) / measurements.length;

      results[name] = {
        time: avgTime,
        memory: avgMemory,
        stats: algorithm.getStats ? algorithm.getStats() : {}
      };
    });

    return results;
  }

  /**
   * Print comparison results
   */
  printResults(results) {
    // Find fastest algorithm
    let fastest = null;
    let fastestTime = Infinity;
    
    Object.keys(results).forEach(name => {
      if (results[name].time < fastestTime) {
        fastest = name;
        fastestTime = results[name].time;
      }
    });

    // Print table
    console.log('\nAlgorithm    | Time (ms) | Memory (KB) | Comparisons | Swaps');
    console.log('-------------|-----------|-------------|-------------|-------');
    
    Object.keys(results).forEach(name => {
      const r = results[name];
      const timeStr = r.time.toFixed(3).padEnd(9);
      const memStr = r.memory.toFixed(1).padEnd(11);
      const compStr = (r.stats.comparisons || '-').toString().padEnd(11);
      const swapStr = (r.stats.swaps || '-').toString();
      const marker = name === fastest ? ' ✓' : '';
      
      console.log(`${name.padEnd(12)} | ${timeStr} | ${memStr} | ${compStr} | ${swapStr}${marker}`);
    });
  }

  /**
   * Detailed analysis with statistical metrics
   */
  detailedAnalysis(size = 1000, iterations = 10) {
    console.log('\n' + '='.repeat(80));
    console.log('DETAILED STATISTICAL ANALYSIS');
    console.log(`Size: ${size}, Iterations: ${iterations}`);
    console.log('='.repeat(80));

    const patterns = ['Random', 'Nearly Sorted', 'Reverse Sorted'];
    const results = {};

    patterns.forEach(patternName => {
      console.log(`\n${patternName} Data Analysis:`);
      console.log('-'.repeat(60));
      
      results[patternName] = {};

      Object.keys(this.algorithms).forEach(algoName => {
        const times = [];
        const comparisons = [];
        const swaps = [];

        for (let i = 0; i < iterations; i++) {
          const data = this.generatePattern(patternName, size);
          const algorithm = this.algorithms[algoName];
          
          const startTime = process.hrtime.bigint();
          algorithm.sort([...data]);
          const endTime = process.hrtime.bigint();
          
          times.push(Number(endTime - startTime) / 1000000);
          
          if (algorithm.getStats) {
            const stats = algorithm.getStats();
            comparisons.push(stats.comparisons || 0);
            swaps.push(stats.swaps || 0);
          }
        }

        const analysis = {
          time: this.calculateStatistics(times),
          comparisons: this.calculateStatistics(comparisons),
          swaps: this.calculateStatistics(swaps)
        };

        results[patternName][algoName] = analysis;
        this.printStatistics(algoName, analysis);
      });
    });

    return results;
  }

  /**
   * Calculate statistical metrics
   */
  calculateStatistics(values) {
    if (values.length === 0) return null;

    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    
    const mean = values.reduce((sum, v) => sum + v, 0) / n;
    const median = n % 2 === 0 
      ? (sorted[n/2 - 1] + sorted[n/2]) / 2 
      : sorted[Math.floor(n/2)];
    
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    
    return {
      mean: mean,
      median: median,
      min: sorted[0],
      max: sorted[n - 1],
      stdDev: stdDev,
      p95: sorted[Math.floor(n * 0.95)],
      p99: sorted[Math.floor(n * 0.99)]
    };
  }

  /**
   * Print statistical analysis
   */
  printStatistics(name, analysis) {
    console.log(`\n${name}:`);
    
    if (analysis.time) {
      console.log(`  Time (ms):`);
      console.log(`    Mean: ${analysis.time.mean.toFixed(3)}`);
      console.log(`    Median: ${analysis.time.median.toFixed(3)}`);
      console.log(`    Std Dev: ${analysis.time.stdDev.toFixed(3)}`);
      console.log(`    Range: [${analysis.time.min.toFixed(3)}, ${analysis.time.max.toFixed(3)}]`);
    }
    
    if (analysis.comparisons && analysis.comparisons.mean > 0) {
      console.log(`  Comparisons: ${Math.round(analysis.comparisons.mean)}`);
    }
    
    if (analysis.swaps && analysis.swaps.mean > 0) {
      console.log(`  Swaps: ${Math.round(analysis.swaps.mean)}`);
    }
  }

  /**
   * Complexity validation
   */
  validateComplexity(algorithm, maxSize = 10000) {
    console.log('\n' + '='.repeat(80));
    console.log(`COMPLEXITY VALIDATION: ${algorithm}`);
    console.log('='.repeat(80));

    const sizes = [100, 500, 1000, 2500, 5000, 10000];
    const results = [];

    sizes.forEach(size => {
      const data = this.generateRandom(size);
      const algo = this.algorithms[algorithm];
      
      const startTime = process.hrtime.bigint();
      algo.sort([...data]);
      const endTime = process.hrtime.bigint();
      
      const time = Number(endTime - startTime) / 1000000;
      const stats = algo.getStats ? algo.getStats() : {};
      
      results.push({
        n: size,
        time: time,
        comparisons: stats.comparisons || 0,
        theoretical: size * Math.log2(size) // O(n log n)
      });
    });

    // Print results
    console.log('\nn     | Time (ms) | Comparisons | Theoretical | Ratio');
    console.log('------|-----------|-------------|-------------|-------');
    
    results.forEach(r => {
      const ratio = r.comparisons / r.theoretical;
      console.log(`${r.n.toString().padEnd(5)} | ${r.time.toFixed(3).padEnd(9)} | ${r.comparisons.toString().padEnd(11)} | ${Math.round(r.theoretical).toString().padEnd(11)} | ${ratio.toFixed(2)}`);
    });

    // Calculate complexity coefficient
    const lastTwo = results.slice(-2);
    if (lastTwo.length === 2) {
      const timeRatio = lastTwo[1].time / lastTwo[0].time;
      const sizeRatio = lastTwo[1].n / lastTwo[0].n;
      const theoreticalRatio = (lastTwo[1].n * Math.log2(lastTwo[1].n)) / 
                              (lastTwo[0].n * Math.log2(lastTwo[0].n));
      
      console.log(`\nComplexity Analysis:`);
      console.log(`  Time growth factor: ${timeRatio.toFixed(2)}x`);
      console.log(`  Size growth factor: ${sizeRatio.toFixed(2)}x`);
      console.log(`  Theoretical O(n log n) factor: ${theoreticalRatio.toFixed(2)}x`);
      
      if (Math.abs(timeRatio - theoreticalRatio) < 1) {
        console.log(`  ✓ Complexity appears to be O(n log n)`);
      } else if (timeRatio > theoreticalRatio * 1.5) {
        console.log(`  ⚠ Complexity may be worse than O(n log n)`);
      } else {
        console.log(`  ✓ Complexity is better than or equal to O(n log n)`);
      }
    }
  }

  /**
   * Generate test data patterns
   */
  generatePattern(name, size) {
    switch(name) {
      case 'Random': return this.generateRandom(size);
      case 'Nearly Sorted': return this.generateNearlySorted(size);
      case 'Reverse Sorted': return this.generateReverse(size);
      case 'Many Duplicates': return this.generateDuplicates(size);
      case 'Few Unique': return this.generateFewUnique(size);
      default: return this.generateRandom(size);
    }
  }

  generateRandom(size) {
    return Array.from({ length: size }, () => Math.floor(Math.random() * size));
  }

  generateNearlySorted(size) {
    const arr = Array.from({ length: size }, (_, i) => i);
    // Swap 5% of elements
    const swaps = Math.floor(size * 0.05);
    for (let i = 0; i < swaps; i++) {
      const a = Math.floor(Math.random() * size);
      const b = Math.floor(Math.random() * size);
      [arr[a], arr[b]] = [arr[b], arr[a]];
    }
    return arr;
  }

  generateReverse(size) {
    return Array.from({ length: size }, (_, i) => size - i);
  }

  generateDuplicates(size) {
    return Array.from({ length: size }, () => Math.floor(Math.random() * (size / 10)));
  }

  generateFewUnique(size) {
    const values = [1, 2, 3, 4, 5];
    return Array.from({ length: size }, () => values[Math.floor(Math.random() * values.length)]);
  }

  /**
   * Export results to CSV
   */
  exportToCSV(results, filename = 'sorting-comparison.csv') {
    const fs = require('fs');
    let csv = 'Size,Pattern,Algorithm,Time(ms),Memory(KB),Comparisons,Swaps\n';

    Object.keys(results).forEach(size => {
      Object.keys(results[size]).forEach(pattern => {
        Object.keys(results[size][pattern]).forEach(algo => {
          const r = results[size][pattern][algo];
          csv += `${size},${pattern},${algo},${r.time.toFixed(3)},${r.memory.toFixed(1)},${r.stats.comparisons || 0},${r.stats.swaps || 0}\n`;
        });
      });
    });

    fs.writeFileSync(filename, csv);
    console.log(`\nResults exported to ${filename}`);
  }
}

// Export for use
module.exports = SortingComparison;