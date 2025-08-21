/**
 * Advanced Quicksort Implementation with Optimizations
 * Includes: 3-way partitioning, insertion sort for small arrays, tail recursion optimization
 */

class QuickSortAdvanced {
  constructor(options = {}) {
    // Threshold for switching to insertion sort
    this.insertionSortThreshold = options.insertionSortThreshold || 10;
    // Whether to use 3-way partitioning for arrays with many duplicates
    this.use3WayPartition = options.use3WayPartition !== false;
    // Statistics tracking
    this.stats = {
      comparisons: 0,
      swaps: 0,
      recursionDepth: 0,
      maxRecursionDepth: 0
    };
  }

  /**
   * Main sort method with optimizations
   */
  sort(arr, compareFn = (a, b) => a - b) {
    this.resetStats();
    this.compareFn = compareFn;
    this.quickSortOptimized(arr, 0, arr.length - 1, 0);
    return arr;
  }

  /**
   * Optimized quicksort with small array optimization
   */
  quickSortOptimized(arr, left, right, depth) {
    this.stats.recursionDepth = depth;
    this.stats.maxRecursionDepth = Math.max(this.stats.maxRecursionDepth, depth);

    while (left < right) {
      // Use insertion sort for small subarrays
      if (right - left + 1 <= this.insertionSortThreshold) {
        this.insertionSort(arr, left, right);
        return;
      }

      // Check for high duplicate ratio and use 3-way partition if beneficial
      if (this.use3WayPartition && this.shouldUse3WayPartition(arr, left, right)) {
        const [lt, gt] = this.partition3Way(arr, left, right);
        
        // Recurse on smaller partition first (tail recursion optimization)
        if (lt - left < right - gt) {
          this.quickSortOptimized(arr, left, lt - 1, depth + 1);
          left = gt + 1; // Tail recursion optimization
        } else {
          this.quickSortOptimized(arr, gt + 1, right, depth + 1);
          right = lt - 1; // Tail recursion optimization
        }
      } else {
        // Standard 2-way partition
        const pivotIndex = this.partition(arr, left, right);
        
        // Recurse on smaller partition first
        if (pivotIndex - left < right - pivotIndex) {
          this.quickSortOptimized(arr, left, pivotIndex - 1, depth + 1);
          left = pivotIndex + 1; // Tail recursion optimization
        } else {
          this.quickSortOptimized(arr, pivotIndex + 1, right, depth + 1);
          right = pivotIndex - 1; // Tail recursion optimization
        }
      }
    }
  }

  /**
   * Standard partition with median-of-three pivot selection
   */
  partition(arr, left, right) {
    // Median-of-three pivot selection
    const mid = Math.floor((left + right) / 2);
    const pivotIndex = this.medianOfThree(arr, left, mid, right);
    this.swap(arr, pivotIndex, right);
    
    const pivot = arr[right];
    let i = left - 1;

    for (let j = left; j < right; j++) {
      this.stats.comparisons++;
      if (this.compareFn(arr[j], pivot) <= 0) {
        i++;
        this.swap(arr, i, j);
      }
    }

    this.swap(arr, i + 1, right);
    return i + 1;
  }

  /**
   * 3-way partition for arrays with many duplicates
   * Returns [lt, gt] where:
   * - arr[left..lt-1] < pivot
   * - arr[lt..gt] == pivot
   * - arr[gt+1..right] > pivot
   */
  partition3Way(arr, left, right) {
    const pivot = arr[left];
    let lt = left;
    let gt = right;
    let i = left + 1;

    while (i <= gt) {
      this.stats.comparisons++;
      const cmp = this.compareFn(arr[i], pivot);
      
      if (cmp < 0) {
        this.swap(arr, lt, i);
        lt++;
        i++;
      } else if (cmp > 0) {
        this.swap(arr, i, gt);
        gt--;
      } else {
        i++;
      }
    }

    return [lt, gt];
  }

  /**
   * Insertion sort for small subarrays
   */
  insertionSort(arr, left, right) {
    for (let i = left + 1; i <= right; i++) {
      const key = arr[i];
      let j = i - 1;
      
      while (j >= left) {
        this.stats.comparisons++;
        if (this.compareFn(arr[j], key) <= 0) break;
        arr[j + 1] = arr[j];
        this.stats.swaps++;
        j--;
      }
      
      arr[j + 1] = key;
    }
  }

  /**
   * Find median of three elements
   */
  medianOfThree(arr, a, b, c) {
    this.stats.comparisons += 3;
    
    if (this.compareFn(arr[a], arr[b]) > 0) {
      if (this.compareFn(arr[b], arr[c]) > 0) return b;
      else if (this.compareFn(arr[a], arr[c]) > 0) return c;
      else return a;
    } else {
      if (this.compareFn(arr[a], arr[c]) > 0) return a;
      else if (this.compareFn(arr[b], arr[c]) > 0) return c;
      else return b;
    }
  }

  /**
   * Check if array has many duplicates (heuristic)
   */
  shouldUse3WayPartition(arr, left, right) {
    if (right - left < 20) return false;
    
    // Sample a few elements to check for duplicates
    const sampleSize = Math.min(5, right - left + 1);
    const samples = new Set();
    
    for (let i = 0; i < sampleSize; i++) {
      const idx = left + Math.floor(Math.random() * (right - left + 1));
      samples.add(arr[idx]);
    }
    
    // Use 3-way partition if we have few unique values
    return samples.size < sampleSize * 0.7;
  }

  /**
   * Swap two elements in array
   */
  swap(arr, i, j) {
    if (i !== j) {
      [arr[i], arr[j]] = [arr[j], arr[i]];
      this.stats.swaps++;
    }
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      comparisons: 0,
      swaps: 0,
      recursionDepth: 0,
      maxRecursionDepth: 0
    };
  }

  /**
   * Get sorting statistics
   */
  getStats() {
    return { ...this.stats };
  }
}

/**
 * Parallel quicksort using Web Workers (for Node.js with worker_threads)
 * Note: This is a conceptual implementation for demonstration
 */
class ParallelQuickSort {
  constructor(numWorkers = 4) {
    this.numWorkers = numWorkers;
  }

  async sort(arr) {
    // For arrays smaller than threshold, use sequential sort
    if (arr.length < 10000) {
      const sorter = new QuickSortAdvanced();
      return sorter.sort(arr);
    }

    // Parallel implementation would go here
    // This would require worker_threads in Node.js
    console.log(`Would use ${this.numWorkers} workers for parallel sorting`);
    
    // Fallback to sequential for this demo
    const sorter = new QuickSortAdvanced();
    return sorter.sort(arr);
  }
}

// Utility functions for analysis
class QuickSortAnalyzer {
  /**
   * Analyze performance across different input types
   */
  static analyzePerformance(size = 1000) {
    const sorter = new QuickSortAdvanced();
    const results = [];

    // Test different input patterns
    const patterns = [
      { name: 'Random', arr: this.generateRandom(size) },
      { name: 'Nearly Sorted', arr: this.generateNearlySorted(size) },
      { name: 'Reverse', arr: this.generateReverse(size) },
      { name: 'Many Duplicates', arr: this.generateWithDuplicates(size) },
      { name: 'Few Unique', arr: this.generateFewUnique(size) }
    ];

    patterns.forEach(({ name, arr }) => {
      const copy = [...arr];
      const start = Date.now();
      sorter.sort(copy);
      const time = Date.now() - start;
      
      results.push({
        pattern: name,
        size: size,
        time: time,
        stats: sorter.getStats()
      });
    });

    return results;
  }

  static generateRandom(size) {
    return Array.from({ length: size }, () => Math.floor(Math.random() * size));
  }

  static generateNearlySorted(size) {
    const arr = Array.from({ length: size }, (_, i) => i);
    // Swap ~5% of elements
    for (let i = 0; i < size * 0.05; i++) {
      const a = Math.floor(Math.random() * size);
      const b = Math.floor(Math.random() * size);
      [arr[a], arr[b]] = [arr[b], arr[a]];
    }
    return arr;
  }

  static generateReverse(size) {
    return Array.from({ length: size }, (_, i) => size - i);
  }

  static generateWithDuplicates(size) {
    return Array.from({ length: size }, () => Math.floor(Math.random() * (size / 10)));
  }

  static generateFewUnique(size) {
    const values = [1, 2, 3, 4, 5];
    return Array.from({ length: size }, () => values[Math.floor(Math.random() * values.length)]);
  }
}

// Export for use
module.exports = {
  QuickSortAdvanced,
  ParallelQuickSort,
  QuickSortAnalyzer
};