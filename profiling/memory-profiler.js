/**
 * Memory Profiler for Sorting Algorithms
 * Tracks heap usage, allocations, and garbage collection impact
 */

const v8 = require('v8');
const { performance } = require('perf_hooks');
const { QuickSortAdvanced } = require('../quicksort-advanced');
const MergeSort = require('../algorithms/mergesort');
const HeapSort = require('../algorithms/heapsort');

class MemoryProfiler {
  constructor() {
    this.measurements = [];
    this.gcEvents = [];
    this.startMemory = null;
    this.peakMemory = 0;
    
    // Enable GC tracking if available
    if (global.gc) {
      performance.addEventListener('gc', this.onGC.bind(this));
    }
  }

  /**
   * Start memory profiling
   */
  startProfiling() {
    // Force garbage collection before starting
    if (global.gc) {
      global.gc();
    }
    
    this.measurements = [];
    this.gcEvents = [];
    this.startMemory = this.getMemoryUsage();
    this.peakMemory = this.startMemory.heapUsed;
    
    // Start periodic memory sampling
    this.samplingInterval = setInterval(() => {
      this.sampleMemory();
    }, 10); // Sample every 10ms
  }

  /**
   * Stop profiling and return results
   */
  stopProfiling() {
    clearInterval(this.samplingInterval);
    
    const endMemory = this.getMemoryUsage();
    
    return {
      startMemory: this.startMemory,
      endMemory: endMemory,
      peakMemory: this.peakMemory,
      memoryDelta: {
        heapUsed: endMemory.heapUsed - this.startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - this.startMemory.heapTotal,
        external: endMemory.external - this.startMemory.external,
        arrayBuffers: endMemory.arrayBuffers - this.startMemory.arrayBuffers
      },
      measurements: this.measurements,
      gcEvents: this.gcEvents,
      heapStatistics: v8.getHeapStatistics(),
      heapSpaceStatistics: v8.getHeapSpaceStatistics()
    };
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: usage.rss,
      heapTotal: usage.heapTotal,
      heapUsed: usage.heapUsed,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers,
      timestamp: Date.now()
    };
  }

  /**
   * Sample memory usage
   */
  sampleMemory() {
    const usage = this.getMemoryUsage();
    this.measurements.push(usage);
    
    if (usage.heapUsed > this.peakMemory) {
      this.peakMemory = usage.heapUsed;
    }
  }

  /**
   * Handle garbage collection events
   */
  onGC(event) {
    this.gcEvents.push({
      type: event.detail.kind,
      duration: event.detail.duration,
      timestamp: Date.now()
    });
  }

  /**
   * Profile a sorting algorithm
   */
  async profileAlgorithm(algorithmName, array, options = {}) {
    const algorithm = this.getAlgorithm(algorithmName);
    const arrayCopy = [...array];
    
    console.log(`\nProfiling ${algorithmName}...`);
    
    this.startProfiling();
    const startTime = performance.now();
    
    // Run the sort
    algorithm.sort(arrayCopy);
    
    const endTime = performance.now();
    const profile = this.stopProfiling();
    
    // Add timing and algorithm info
    profile.algorithmName = algorithmName;
    profile.arraySize = array.length;
    profile.executionTime = endTime - startTime;
    profile.stats = algorithm.getStats ? algorithm.getStats() : {};
    
    return profile;
  }

  /**
   * Get algorithm instance
   */
  getAlgorithm(name) {
    switch (name.toLowerCase()) {
      case 'quicksort':
        return new QuickSortAdvanced();
      case 'mergesort':
        return new MergeSort();
      case 'heapsort':
        return new HeapSort();
      default:
        throw new Error(`Unknown algorithm: ${name}`);
    }
  }

  /**
   * Generate memory report
   */
  generateReport(profiles) {
    console.log('\n' + '='.repeat(80));
    console.log('MEMORY PROFILING REPORT');
    console.log('='.repeat(80));
    
    profiles.forEach(profile => {
      console.log(`\n${profile.algorithmName.toUpperCase()}`);
      console.log('-'.repeat(40));
      
      console.log('Memory Usage:');
      console.log(`  Initial Heap: ${this.formatBytes(profile.startMemory.heapUsed)}`);
      console.log(`  Final Heap: ${this.formatBytes(profile.endMemory.heapUsed)}`);
      console.log(`  Peak Heap: ${this.formatBytes(profile.peakMemory)}`);
      console.log(`  Heap Delta: ${this.formatBytes(profile.memoryDelta.heapUsed)}`);
      
      console.log('\nPerformance:');
      console.log(`  Array Size: ${profile.arraySize}`);
      console.log(`  Execution Time: ${profile.executionTime.toFixed(2)}ms`);
      console.log(`  Memory/Element: ${(profile.memoryDelta.heapUsed / profile.arraySize).toFixed(2)} bytes`);
      
      if (profile.gcEvents.length > 0) {
        console.log('\nGarbage Collection:');
        console.log(`  GC Events: ${profile.gcEvents.length}`);
        const totalGCTime = profile.gcEvents.reduce((sum, e) => sum + e.duration, 0);
        console.log(`  Total GC Time: ${totalGCTime.toFixed(2)}ms`);
      }
      
      if (profile.stats.comparisons) {
        console.log('\nAlgorithm Statistics:');
        console.log(`  Comparisons: ${profile.stats.comparisons}`);
        console.log(`  Swaps: ${profile.stats.swaps || 0}`);
        console.log(`  Max Recursion: ${profile.stats.maxRecursionDepth || 0}`);
      }
    });
    
    this.printComparison(profiles);
  }

  /**
   * Print comparison table
   */
  printComparison(profiles) {
    console.log('\n' + '='.repeat(80));
    console.log('COMPARISON TABLE');
    console.log('='.repeat(80));
    
    console.log('\nAlgorithm    | Heap Delta  | Peak Memory | Time (ms) | Memory/Item');
    console.log('-------------|-------------|-------------|-----------|------------');
    
    profiles.forEach(p => {
      const name = p.algorithmName.padEnd(12);
      const delta = this.formatBytes(p.memoryDelta.heapUsed).padEnd(11);
      const peak = this.formatBytes(p.peakMemory).padEnd(11);
      const time = p.executionTime.toFixed(2).padEnd(9);
      const perItem = (p.memoryDelta.heapUsed / p.arraySize).toFixed(1);
      
      console.log(`${name} | ${delta} | ${peak} | ${time} | ${perItem} bytes`);
    });
    
    // Find most memory efficient
    const mostEfficient = profiles.reduce((min, p) => 
      p.memoryDelta.heapUsed < min.memoryDelta.heapUsed ? p : min
    );
    
    console.log(`\n✓ Most Memory Efficient: ${mostEfficient.algorithmName}`);
  }

  /**
   * Format bytes to human readable
   */
  formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  /**
   * Analyze memory allocation patterns
   */
  analyzeAllocationPatterns(profile) {
    const measurements = profile.measurements;
    if (measurements.length < 2) return null;
    
    const allocations = [];
    for (let i = 1; i < measurements.length; i++) {
      const delta = measurements[i].heapUsed - measurements[i - 1].heapUsed;
      if (delta > 0) {
        allocations.push({
          size: delta,
          timestamp: measurements[i].timestamp
        });
      }
    }
    
    return {
      totalAllocations: allocations.length,
      totalAllocatedBytes: allocations.reduce((sum, a) => sum + a.size, 0),
      averageAllocationSize: allocations.length > 0 
        ? allocations.reduce((sum, a) => sum + a.size, 0) / allocations.length 
        : 0,
      largestAllocation: allocations.length > 0 
        ? Math.max(...allocations.map(a => a.size))
        : 0
    };
  }

  /**
   * Profile with different array sizes
   */
  async profileScalability(algorithmName, sizes = [100, 500, 1000, 5000, 10000]) {
    console.log(`\nScalability Analysis: ${algorithmName}`);
    console.log('='.repeat(60));
    
    const results = [];
    
    for (const size of sizes) {
      const array = Array.from({ length: size }, () => 
        Math.floor(Math.random() * size)
      );
      
      const profile = await this.profileAlgorithm(algorithmName, array);
      const patterns = this.analyzeAllocationPatterns(profile);
      
      results.push({
        size: size,
        heapDelta: profile.memoryDelta.heapUsed,
        peakMemory: profile.peakMemory,
        executionTime: profile.executionTime,
        memoryPerElement: profile.memoryDelta.heapUsed / size,
        allocationPatterns: patterns
      });
      
      // Allow GC between tests
      if (global.gc) {
        global.gc();
      }
      
      // Small delay to let system settle
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.printScalabilityReport(algorithmName, results);
    return results;
  }

  /**
   * Print scalability report
   */
  printScalabilityReport(algorithmName, results) {
    console.log(`\n${algorithmName.toUpperCase()} - Memory Scalability`);
    console.log('-'.repeat(60));
    
    console.log('\nSize   | Heap Delta  | Peak Memory | Time (ms) | Bytes/Item');
    console.log('-------|-------------|-------------|-----------|------------');
    
    results.forEach(r => {
      const size = r.size.toString().padEnd(6);
      const delta = this.formatBytes(r.heapDelta).padEnd(11);
      const peak = this.formatBytes(r.peakMemory).padEnd(11);
      const time = r.executionTime.toFixed(2).padEnd(9);
      const perItem = r.memoryPerElement.toFixed(2);
      
      console.log(`${size} | ${delta} | ${peak} | ${time} | ${perItem}`);
    });
    
    // Calculate growth factor
    if (results.length >= 2) {
      const last = results[results.length - 1];
      const first = results[0];
      
      const sizeGrowth = last.size / first.size;
      const memoryGrowth = last.heapDelta / first.heapDelta;
      const timeGrowth = last.executionTime / first.executionTime;
      
      console.log('\nGrowth Analysis:');
      console.log(`  Size Growth: ${sizeGrowth.toFixed(1)}x`);
      console.log(`  Memory Growth: ${memoryGrowth.toFixed(1)}x`);
      console.log(`  Time Growth: ${timeGrowth.toFixed(1)}x`);
      
      const expectedGrowth = sizeGrowth * Math.log2(last.size) / Math.log2(first.size);
      console.log(`  Expected O(n log n): ${expectedGrowth.toFixed(1)}x`);
      
      if (memoryGrowth <= sizeGrowth * 1.5) {
        console.log('  ✓ Memory complexity appears to be O(n) or better');
      } else {
        console.log('  ⚠ Memory complexity may be worse than O(n)');
      }
    }
  }
}

// Export for use
module.exports = MemoryProfiler;

// Run profiling if main module
if (require.main === module) {
  async function runMemoryProfiling() {
    const profiler = new MemoryProfiler();
    
    // Test array
    const testArray = Array.from({ length: 10000 }, () => 
      Math.floor(Math.random() * 10000)
    );
    
    // Profile each algorithm
    const profiles = [];
    
    for (const algo of ['quicksort', 'mergesort', 'heapsort']) {
      const profile = await profiler.profileAlgorithm(algo, testArray);
      profiles.push(profile);
      
      // Allow GC between algorithms
      if (global.gc) {
        global.gc();
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Generate report
    profiler.generateReport(profiles);
    
    // Scalability analysis
    console.log('\n' + '='.repeat(80));
    console.log('SCALABILITY ANALYSIS');
    console.log('='.repeat(80));
    
    for (const algo of ['quicksort', 'mergesort', 'heapsort']) {
      await profiler.profileScalability(algo, [100, 500, 1000, 2500, 5000]);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Note: Run with --expose-gc flag for accurate GC tracking
  // node --expose-gc profiling/memory-profiler.js
  console.log('Starting Memory Profiling...');
  console.log('Note: Run with --expose-gc flag for accurate GC tracking');
  console.log('Example: node --expose-gc profiling/memory-profiler.js\n');
  
  runMemoryProfiling().catch(console.error);
}