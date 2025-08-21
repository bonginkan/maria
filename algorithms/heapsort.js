/**
 * Heap Sort Implementation
 * Time Complexity: O(n log n) - always
 * Space Complexity: O(1) - in-place sorting
 * Stable: No - may change relative order of equal elements
 */

class HeapSort {
  constructor(options = {}) {
    this.compareFn = options.compareFn || ((a, b) => a - b);
    this.heapType = options.heapType || 'max'; // 'max' or 'min'
    this.stats = {
      comparisons: 0,
      swaps: 0,
      heapifyOperations: 0,
      maxHeapDepth: 0
    };
  }

  /**
   * Main sort method using max heap
   */
  sort(arr) {
    this.resetStats();
    const n = arr.length;

    if (n <= 1) return arr;

    // Build heap (rearrange array)
    this.buildHeap(arr, n);

    // Extract elements from heap one by one
    for (let i = n - 1; i > 0; i--) {
      // Move current root to end
      this.swap(arr, 0, i);

      // Call heapify on reduced heap
      this.heapify(arr, i, 0);
    }

    return arr;
  }

  /**
   * Build a max heap from array
   */
  buildHeap(arr, n) {
    // Start from last non-leaf node and heapify each node
    const startIdx = Math.floor(n / 2) - 1;
    
    for (let i = startIdx; i >= 0; i--) {
      this.heapify(arr, n, i);
    }
  }

  /**
   * Heapify a subtree rooted at index i
   * n is size of heap
   */
  heapify(arr, n, i) {
    this.stats.heapifyOperations++;
    
    let largest = i; // Initialize largest as root
    const left = 2 * i + 1;
    const right = 2 * i + 2;

    // Calculate depth for statistics
    const depth = Math.floor(Math.log2(i + 1));
    this.stats.maxHeapDepth = Math.max(this.stats.maxHeapDepth, depth);

    // If left child is larger than root
    if (left < n) {
      this.stats.comparisons++;
      if (this.compare(arr[left], arr[largest]) > 0) {
        largest = left;
      }
    }

    // If right child is larger than largest so far
    if (right < n) {
      this.stats.comparisons++;
      if (this.compare(arr[right], arr[largest]) > 0) {
        largest = right;
      }
    }

    // If largest is not root
    if (largest !== i) {
      this.swap(arr, i, largest);

      // Recursively heapify the affected sub-tree
      this.heapify(arr, n, largest);
    }
  }

  /**
   * Min heap sort variant
   */
  sortMinHeap(arr) {
    this.resetStats();
    const n = arr.length;

    if (n <= 1) return arr;

    // Build min heap
    this.buildMinHeap(arr, n);

    // Extract elements and place at end (results in descending order)
    for (let i = n - 1; i > 0; i--) {
      this.swap(arr, 0, i);
      this.minHeapify(arr, i, 0);
    }

    // Reverse array to get ascending order
    this.reverseArray(arr);

    return arr;
  }

  /**
   * Build a min heap from array
   */
  buildMinHeap(arr, n) {
    const startIdx = Math.floor(n / 2) - 1;
    
    for (let i = startIdx; i >= 0; i--) {
      this.minHeapify(arr, n, i);
    }
  }

  /**
   * Min heapify a subtree
   */
  minHeapify(arr, n, i) {
    this.stats.heapifyOperations++;
    
    let smallest = i;
    const left = 2 * i + 1;
    const right = 2 * i + 2;

    const depth = Math.floor(Math.log2(i + 1));
    this.stats.maxHeapDepth = Math.max(this.stats.maxHeapDepth, depth);

    if (left < n) {
      this.stats.comparisons++;
      if (this.compare(arr[left], arr[smallest]) < 0) {
        smallest = left;
      }
    }

    if (right < n) {
      this.stats.comparisons++;
      if (this.compare(arr[right], arr[smallest]) < 0) {
        smallest = right;
      }
    }

    if (smallest !== i) {
      this.swap(arr, i, smallest);
      this.minHeapify(arr, n, smallest);
    }
  }

  /**
   * Iterative heapify (reduces stack overhead)
   */
  heapifyIterative(arr, n, i) {
    this.stats.heapifyOperations++;
    
    while (true) {
      let largest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;

      const depth = Math.floor(Math.log2(i + 1));
      this.stats.maxHeapDepth = Math.max(this.stats.maxHeapDepth, depth);

      if (left < n) {
        this.stats.comparisons++;
        if (this.compare(arr[left], arr[largest]) > 0) {
          largest = left;
        }
      }

      if (right < n) {
        this.stats.comparisons++;
        if (this.compare(arr[right], arr[largest]) > 0) {
          largest = right;
        }
      }

      if (largest === i) break;

      this.swap(arr, i, largest);
      i = largest;
    }
  }

  /**
   * Sort using iterative heapify
   */
  sortIterative(arr) {
    this.resetStats();
    const n = arr.length;

    if (n <= 1) return arr;

    // Build heap using iterative heapify
    const startIdx = Math.floor(n / 2) - 1;
    for (let i = startIdx; i >= 0; i--) {
      this.heapifyIterative(arr, n, i);
    }

    // Extract elements
    for (let i = n - 1; i > 0; i--) {
      this.swap(arr, 0, i);
      this.heapifyIterative(arr, i, 0);
    }

    return arr;
  }

  /**
   * K-way heap sort (for better cache performance)
   */
  sortKWay(arr, k = 4) {
    this.resetStats();
    const n = arr.length;

    if (n <= 1) return arr;

    // Build k-way heap
    this.buildKWayHeap(arr, n, k);

    // Extract elements
    for (let i = n - 1; i > 0; i--) {
      this.swap(arr, 0, i);
      this.kWayHeapify(arr, i, 0, k);
    }

    return arr;
  }

  /**
   * Build k-way heap
   */
  buildKWayHeap(arr, n, k) {
    const startIdx = Math.floor((n - 2) / k);
    
    for (let i = startIdx; i >= 0; i--) {
      this.kWayHeapify(arr, n, i, k);
    }
  }

  /**
   * K-way heapify
   */
  kWayHeapify(arr, n, i, k) {
    this.stats.heapifyOperations++;
    
    let largest = i;
    const firstChild = k * i + 1;
    const lastChild = Math.min(firstChild + k - 1, n - 1);

    // Find largest among node and its k children
    for (let child = firstChild; child <= lastChild; child++) {
      this.stats.comparisons++;
      if (this.compare(arr[child], arr[largest]) > 0) {
        largest = child;
      }
    }

    if (largest !== i) {
      this.swap(arr, i, largest);
      this.kWayHeapify(arr, n, largest, k);
    }
  }

  /**
   * Partial heap sort - sort only top k elements
   */
  partialSort(arr, k) {
    this.resetStats();
    const n = arr.length;
    
    if (k >= n) {
      return this.sort(arr);
    }

    // Build heap
    this.buildHeap(arr, n);

    // Extract k largest elements
    for (let i = 0; i < k; i++) {
      if (n - i - 1 > 0) {
        this.swap(arr, 0, n - i - 1);
        this.heapify(arr, n - i - 1, 0);
      }
    }

    // The last k elements are now sorted
    return arr;
  }

  /**
   * Find kth largest element using heap
   */
  findKthLargest(arr, k) {
    this.resetStats();
    const n = arr.length;
    
    if (k < 1 || k > n) {
      throw new Error('k must be between 1 and array length');
    }

    // Build heap
    this.buildHeap(arr, n);

    // Extract k-1 elements
    for (let i = 0; i < k - 1; i++) {
      this.swap(arr, 0, n - i - 1);
      this.heapify(arr, n - i - 1, 0);
    }

    return arr[0];
  }

  /**
   * Heap sort with custom heap property
   */
  sortWithProperty(arr, propertyFn) {
    // Store original compare function
    const originalCompare = this.compareFn;
    
    // Use property function for comparison
    this.compareFn = (a, b) => {
      const propA = propertyFn(a);
      const propB = propertyFn(b);
      return propA - propB;
    };

    const result = this.sort(arr);

    // Restore original compare function
    this.compareFn = originalCompare;

    return result;
  }

  /**
   * Compare helper
   */
  compare(a, b) {
    if (this.heapType === 'min') {
      return -this.compareFn(a, b);
    }
    return this.compareFn(a, b);
  }

  /**
   * Swap two elements
   */
  swap(arr, i, j) {
    if (i !== j) {
      [arr[i], arr[j]] = [arr[j], arr[i]];
      this.stats.swaps++;
    }
  }

  /**
   * Reverse array in place
   */
  reverseArray(arr) {
    let left = 0;
    let right = arr.length - 1;
    
    while (left < right) {
      this.swap(arr, left, right);
      left++;
      right--;
    }
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      comparisons: 0,
      swaps: 0,
      heapifyOperations: 0,
      maxHeapDepth: 0
    };
  }

  /**
   * Get statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Validate heap property (for testing)
   */
  isValidHeap(arr, n = arr.length, i = 0) {
    // If node is a leaf node
    if (i >= Math.floor(n / 2)) {
      return true;
    }

    const left = 2 * i + 1;
    const right = 2 * i + 2;

    // Check heap property
    let valid = true;
    
    if (left < n) {
      valid = valid && this.compare(arr[i], arr[left]) >= 0;
    }
    
    if (right < n) {
      valid = valid && this.compare(arr[i], arr[right]) >= 0;
    }

    // Recursively check children
    return valid && 
           this.isValidHeap(arr, n, left) && 
           this.isValidHeap(arr, n, right);
  }
}

// Export for use
module.exports = HeapSort;