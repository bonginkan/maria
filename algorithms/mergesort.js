/**
 * Merge Sort Implementation
 * Time Complexity: O(n log n) - always
 * Space Complexity: O(n) - requires additional space
 * Stable: Yes - maintains relative order of equal elements
 */

class MergeSort {
  constructor(options = {}) {
    this.compareFn = options.compareFn || ((a, b) => a - b);
    this.stats = {
      comparisons: 0,
      merges: 0,
      recursionDepth: 0,
      maxRecursionDepth: 0,
      memoryAllocations: 0
    };
  }

  /**
   * Main sort method - Top-down recursive merge sort
   */
  sort(arr) {
    this.resetStats();
    if (arr.length <= 1) return arr;
    
    const result = this.mergeSort(arr, 0);
    // Copy result back to original array for in-place behavior
    for (let i = 0; i < result.length; i++) {
      arr[i] = result[i];
    }
    return arr;
  }

  /**
   * Recursive merge sort implementation
   */
  mergeSort(arr, depth = 0) {
    this.stats.recursionDepth = depth;
    this.stats.maxRecursionDepth = Math.max(this.stats.maxRecursionDepth, depth);

    if (arr.length <= 1) {
      return arr;
    }

    const mid = Math.floor(arr.length / 2);
    const left = arr.slice(0, mid);
    const right = arr.slice(mid);
    this.stats.memoryAllocations += 2;

    return this.merge(
      this.mergeSort(left, depth + 1),
      this.mergeSort(right, depth + 1)
    );
  }

  /**
   * Merge two sorted arrays
   */
  merge(left, right) {
    this.stats.merges++;
    const result = [];
    let leftIndex = 0;
    let rightIndex = 0;

    while (leftIndex < left.length && rightIndex < right.length) {
      this.stats.comparisons++;
      if (this.compareFn(left[leftIndex], right[rightIndex]) <= 0) {
        result.push(left[leftIndex]);
        leftIndex++;
      } else {
        result.push(right[rightIndex]);
        rightIndex++;
      }
    }

    // Add remaining elements
    while (leftIndex < left.length) {
      result.push(left[leftIndex]);
      leftIndex++;
    }

    while (rightIndex < right.length) {
      result.push(right[rightIndex]);
      rightIndex++;
    }

    this.stats.memoryAllocations++;
    return result;
  }

  /**
   * Bottom-up iterative merge sort (space-optimized)
   */
  sortBottomUp(arr) {
    this.resetStats();
    const n = arr.length;
    
    if (n <= 1) return arr;

    // Start with merge subarrays of size 1, then 2, 4, 8, ...
    for (let size = 1; size < n; size *= 2) {
      // Pick starting point of left sub array
      for (let leftStart = 0; leftStart < n - 1; leftStart += 2 * size) {
        // Find ending point of left subarray
        const leftEnd = Math.min(leftStart + size - 1, n - 1);
        
        // Find ending point of right subarray
        const rightEnd = Math.min(leftStart + 2 * size - 1, n - 1);
        
        // Merge subarrays if right subarray exists
        if (leftEnd < rightEnd) {
          this.mergeInPlace(arr, leftStart, leftEnd, rightEnd);
        }
      }
    }

    return arr;
  }

  /**
   * In-place merge for bottom-up approach
   */
  mergeInPlace(arr, left, mid, right) {
    this.stats.merges++;
    
    // Create temp arrays
    const leftArr = arr.slice(left, mid + 1);
    const rightArr = arr.slice(mid + 1, right + 1);
    this.stats.memoryAllocations += 2;

    let leftIndex = 0;
    let rightIndex = 0;
    let k = left;

    // Merge back into original array
    while (leftIndex < leftArr.length && rightIndex < rightArr.length) {
      this.stats.comparisons++;
      if (this.compareFn(leftArr[leftIndex], rightArr[rightIndex]) <= 0) {
        arr[k] = leftArr[leftIndex];
        leftIndex++;
      } else {
        arr[k] = rightArr[rightIndex];
        rightIndex++;
      }
      k++;
    }

    // Copy remaining elements
    while (leftIndex < leftArr.length) {
      arr[k] = leftArr[leftIndex];
      leftIndex++;
      k++;
    }

    while (rightIndex < rightArr.length) {
      arr[k] = rightArr[rightIndex];
      rightIndex++;
      k++;
    }
  }

  /**
   * Natural merge sort - takes advantage of existing order
   */
  sortNatural(arr) {
    this.resetStats();
    if (arr.length <= 1) return arr;

    let runs = this.findRuns(arr);
    
    while (runs.length > 1) {
      const newRuns = [];
      
      for (let i = 0; i < runs.length; i += 2) {
        if (i + 1 < runs.length) {
          newRuns.push(this.merge(runs[i], runs[i + 1]));
        } else {
          newRuns.push(runs[i]);
        }
      }
      
      runs = newRuns;
    }

    // Copy result back to original array
    const result = runs[0];
    for (let i = 0; i < result.length; i++) {
      arr[i] = result[i];
    }
    
    return arr;
  }

  /**
   * Find natural runs in the array
   */
  findRuns(arr) {
    const runs = [];
    let currentRun = [arr[0]];

    for (let i = 1; i < arr.length; i++) {
      this.stats.comparisons++;
      if (this.compareFn(arr[i], arr[i - 1]) >= 0) {
        currentRun.push(arr[i]);
      } else {
        runs.push(currentRun);
        currentRun = [arr[i]];
      }
    }
    
    runs.push(currentRun);
    return runs;
  }

  /**
   * Three-way merge sort for better cache performance
   */
  sort3Way(arr) {
    this.resetStats();
    if (arr.length <= 1) return arr;
    
    const result = this.mergeSort3Way(arr, 0);
    for (let i = 0; i < result.length; i++) {
      arr[i] = result[i];
    }
    return arr;
  }

  mergeSort3Way(arr, depth = 0) {
    this.stats.recursionDepth = depth;
    this.stats.maxRecursionDepth = Math.max(this.stats.maxRecursionDepth, depth);

    if (arr.length <= 1) return arr;
    if (arr.length === 2) {
      this.stats.comparisons++;
      if (this.compareFn(arr[0], arr[1]) > 0) {
        return [arr[1], arr[0]];
      }
      return arr;
    }

    const third = Math.floor(arr.length / 3);
    const left = arr.slice(0, third);
    const middle = arr.slice(third, 2 * third);
    const right = arr.slice(2 * third);
    this.stats.memoryAllocations += 3;

    return this.merge3(
      this.mergeSort3Way(left, depth + 1),
      this.mergeSort3Way(middle, depth + 1),
      this.mergeSort3Way(right, depth + 1)
    );
  }

  /**
   * Merge three sorted arrays
   */
  merge3(left, middle, right) {
    this.stats.merges++;
    const result = [];
    let i = 0, j = 0, k = 0;

    while (i < left.length || j < middle.length || k < right.length) {
      const leftVal = i < left.length ? left[i] : Infinity;
      const midVal = j < middle.length ? middle[j] : Infinity;
      const rightVal = k < right.length ? right[k] : Infinity;

      this.stats.comparisons += 2;
      if (leftVal <= midVal && leftVal <= rightVal) {
        result.push(leftVal);
        i++;
      } else if (midVal <= rightVal) {
        result.push(midVal);
        j++;
      } else {
        result.push(rightVal);
        k++;
      }
    }

    this.stats.memoryAllocations++;
    return result;
  }

  resetStats() {
    this.stats = {
      comparisons: 0,
      merges: 0,
      recursionDepth: 0,
      maxRecursionDepth: 0,
      memoryAllocations: 0
    };
  }

  getStats() {
    return { ...this.stats };
  }
}

// Export for use
module.exports = MergeSort;