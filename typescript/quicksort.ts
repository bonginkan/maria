/**
 * TypeScript Implementation of Quicksort with Full Type Safety
 * Generic implementation with advanced features
 */

/**
 * Comparison function type
 */
export type CompareFn<T> = (a: T, b: T) => number;

/**
 * Sort statistics interface
 */
export interface SortStatistics {
  comparisons: number;
  swaps: number;
  recursionDepth: number;
  maxRecursionDepth: number;
  timeElapsed?: number;
  memoryUsed?: number;
}

/**
 * Partition strategy types
 */
export type PartitionStrategy = 'lomuto' | 'hoare' | '3-way';

/**
 * Pivot selection strategy
 */
export type PivotStrategy = 'first' | 'last' | 'random' | 'median-of-three';

/**
 * Advanced quicksort options
 */
export interface QuickSortOptions<T> {
  compareFn?: CompareFn<T>;
  insertionSortThreshold?: number;
  partitionStrategy?: PartitionStrategy;
  pivotStrategy?: PivotStrategy;
  use3WayPartition?: boolean;
  collectStatistics?: boolean;
}

/**
 * Generic QuickSort implementation
 */
export class QuickSort<T> {
  private compareFn: CompareFn<T>;
  private insertionSortThreshold: number;
  private partitionStrategy: PartitionStrategy;
  private pivotStrategy: PivotStrategy;
  private use3WayPartition: boolean;
  private stats: SortStatistics;

  constructor(options: QuickSortOptions<T> = {}) {
    this.compareFn = options.compareFn || this.defaultCompare;
    this.insertionSortThreshold = options.insertionSortThreshold || 10;
    this.partitionStrategy = options.partitionStrategy || 'lomuto';
    this.pivotStrategy = options.pivotStrategy || 'last';
    this.use3WayPartition = options.use3WayPartition !== false;
    this.resetStats();
  }

  /**
   * Default comparison function
   */
  private defaultCompare(a: T, b: T): number {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  }

  /**
   * Main sort method
   */
  public sort(arr: T[]): T[] {
    this.resetStats();
    const startTime = performance.now();
    
    this.quickSortOptimized(arr, 0, arr.length - 1, 0);
    
    this.stats.timeElapsed = performance.now() - startTime;
    return arr;
  }

  /**
   * Optimized quicksort with small array optimization
   */
  private quickSortOptimized(
    arr: T[],
    left: number,
    right: number,
    depth: number
  ): void {
    this.stats.recursionDepth = depth;
    this.stats.maxRecursionDepth = Math.max(
      this.stats.maxRecursionDepth,
      depth
    );

    while (left < right) {
      // Use insertion sort for small subarrays
      if (right - left + 1 <= this.insertionSortThreshold) {
        this.insertionSort(arr, left, right);
        return;
      }

      // Check for duplicates and use 3-way partition if beneficial
      if (this.use3WayPartition && this.shouldUse3WayPartition(arr, left, right)) {
        const [lt, gt] = this.partition3Way(arr, left, right);
        
        // Recurse on smaller partition first
        if (lt - left < right - gt) {
          this.quickSortOptimized(arr, left, lt - 1, depth + 1);
          left = gt + 1;
        } else {
          this.quickSortOptimized(arr, gt + 1, right, depth + 1);
          right = lt - 1;
        }
      } else {
        // Standard partition
        const pivotIndex = this.partition(arr, left, right);
        
        // Recurse on smaller partition first
        if (pivotIndex - left < right - pivotIndex) {
          this.quickSortOptimized(arr, left, pivotIndex - 1, depth + 1);
          left = pivotIndex + 1;
        } else {
          this.quickSortOptimized(arr, pivotIndex + 1, right, depth + 1);
          right = pivotIndex - 1;
        }
      }
    }
  }

  /**
   * Partition based on selected strategy
   */
  private partition(arr: T[], left: number, right: number): number {
    switch (this.partitionStrategy) {
      case 'hoare':
        return this.partitionHoare(arr, left, right);
      case 'lomuto':
      default:
        return this.partitionLomuto(arr, left, right);
    }
  }

  /**
   * Lomuto partition scheme
   */
  private partitionLomuto(arr: T[], left: number, right: number): number {
    const pivotIndex = this.selectPivot(arr, left, right);
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
   * Hoare partition scheme
   */
  private partitionHoare(arr: T[], left: number, right: number): number {
    const pivotIndex = this.selectPivot(arr, left, right);
    const pivot = arr[pivotIndex];
    
    let i = left - 1;
    let j = right + 1;

    while (true) {
      do {
        i++;
        this.stats.comparisons++;
      } while (this.compareFn(arr[i], pivot) < 0);

      do {
        j--;
        this.stats.comparisons++;
      } while (this.compareFn(arr[j], pivot) > 0);

      if (i >= j) return j;
      
      this.swap(arr, i, j);
    }
  }

  /**
   * 3-way partition for arrays with duplicates
   */
  private partition3Way(
    arr: T[],
    left: number,
    right: number
  ): [number, number] {
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
   * Select pivot based on strategy
   */
  private selectPivot(arr: T[], left: number, right: number): number {
    switch (this.pivotStrategy) {
      case 'first':
        return left;
      case 'random':
        return left + Math.floor(Math.random() * (right - left + 1));
      case 'median-of-three':
        return this.medianOfThree(arr, left, right);
      case 'last':
      default:
        return right;
    }
  }

  /**
   * Median of three pivot selection
   */
  private medianOfThree(arr: T[], left: number, right: number): number {
    const mid = Math.floor((left + right) / 2);
    
    this.stats.comparisons += 3;
    
    if (this.compareFn(arr[left], arr[mid]) > 0) {
      if (this.compareFn(arr[mid], arr[right]) > 0) return mid;
      else if (this.compareFn(arr[left], arr[right]) > 0) return right;
      else return left;
    } else {
      if (this.compareFn(arr[left], arr[right]) > 0) return left;
      else if (this.compareFn(arr[mid], arr[right]) > 0) return right;
      else return mid;
    }
  }

  /**
   * Check if 3-way partition would be beneficial
   */
  private shouldUse3WayPartition(
    arr: T[],
    left: number,
    right: number
  ): boolean {
    if (right - left < 20) return false;
    
    // Sample elements to check for duplicates
    const sampleSize = Math.min(5, right - left + 1);
    const samples = new Set<T>();
    
    for (let i = 0; i < sampleSize; i++) {
      const idx = left + Math.floor(Math.random() * (right - left + 1));
      samples.add(arr[idx]);
    }
    
    return samples.size < sampleSize * 0.7;
  }

  /**
   * Insertion sort for small subarrays
   */
  private insertionSort(arr: T[], left: number, right: number): void {
    for (let i = left + 1; i <= right; i++) {
      const key = arr[i];
      let j = i - 1;
      
      while (j >= left) {
        this.stats.comparisons++;
        if (this.compareFn(arr[j], key) <= 0) break;
        arr[j + 1] = arr[j];
        j--;
      }
      
      arr[j + 1] = key;
    }
  }

  /**
   * Swap two elements
   */
  private swap(arr: T[], i: number, j: number): void {
    if (i !== j) {
      [arr[i], arr[j]] = [arr[j], arr[i]];
      this.stats.swaps++;
    }
  }

  /**
   * Quick select - find kth smallest element
   */
  public quickSelect(arr: T[], k: number): T {
    if (k < 1 || k > arr.length) {
      throw new Error('k must be between 1 and array length');
    }
    
    return this.quickSelectRecursive(arr, 0, arr.length - 1, k - 1);
  }

  /**
   * Recursive quick select
   */
  private quickSelectRecursive(
    arr: T[],
    left: number,
    right: number,
    k: number
  ): T {
    if (left === right) return arr[left];
    
    const pivotIndex = this.partition(arr, left, right);
    
    if (k === pivotIndex) {
      return arr[k];
    } else if (k < pivotIndex) {
      return this.quickSelectRecursive(arr, left, pivotIndex - 1, k);
    } else {
      return this.quickSelectRecursive(arr, pivotIndex + 1, right, k);
    }
  }

  /**
   * Partial sort - sort only first k elements
   */
  public partialSort(arr: T[], k: number): T[] {
    if (k >= arr.length) {
      return this.sort(arr);
    }
    
    this.partialQuickSort(arr, 0, arr.length - 1, k);
    return arr;
  }

  /**
   * Partial quicksort implementation
   */
  private partialQuickSort(
    arr: T[],
    left: number,
    right: number,
    k: number
  ): void {
    if (left >= right || left >= k) return;
    
    const pivotIndex = this.partition(arr, left, right);
    
    this.partialQuickSort(arr, left, pivotIndex - 1, k);
    if (pivotIndex < k - 1) {
      this.partialQuickSort(arr, pivotIndex + 1, right, k);
    }
  }

  /**
   * Get sorting statistics
   */
  public getStats(): SortStatistics {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  private resetStats(): void {
    this.stats = {
      comparisons: 0,
      swaps: 0,
      recursionDepth: 0,
      maxRecursionDepth: 0
    };
  }
}

/**
 * Helper functions
 */
export class SortHelpers {
  /**
   * Create comparison function for object property
   */
  static compareBy<T, K extends keyof T>(
    key: K,
    direction: 'asc' | 'desc' = 'asc'
  ): CompareFn<T> {
    const modifier = direction === 'asc' ? 1 : -1;
    return (a: T, b: T): number => {
      if (a[key] < b[key]) return -1 * modifier;
      if (a[key] > b[key]) return 1 * modifier;
      return 0;
    };
  }

  /**
   * Create multi-key comparison
   */
  static compareMultiple<T>(
    comparisons: Array<{
      key?: keyof T;
      fn?: CompareFn<T>;
      direction?: 'asc' | 'desc';
    }>
  ): CompareFn<T> {
    return (a: T, b: T): number => {
      for (const comp of comparisons) {
        let result = 0;
        
        if (comp.fn) {
          result = comp.fn(a, b);
        } else if (comp.key) {
          const modifier = comp.direction === 'desc' ? -1 : 1;
          if (a[comp.key] < b[comp.key]) result = -1 * modifier;
          else if (a[comp.key] > b[comp.key]) result = 1 * modifier;
        }
        
        if (result !== 0) return result;
      }
      return 0;
    };
  }

  /**
   * Check if array is sorted
   */
  static isSorted<T>(arr: T[], compareFn?: CompareFn<T>): boolean {
    const compare = compareFn || ((a: T, b: T) => a < b ? -1 : a > b ? 1 : 0);
    
    for (let i = 1; i < arr.length; i++) {
      if (compare(arr[i - 1], arr[i]) > 0) {
        return false;
      }
    }
    return true;
  }

  /**
   * Shuffle array using Fisher-Yates
   */
  static shuffle<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Generate random array
   */
  static generateRandomArray(
    size: number,
    min: number = 0,
    max: number = 100
  ): number[] {
    return Array.from(
      { length: size },
      () => Math.floor(Math.random() * (max - min + 1)) + min
    );
  }
}

/**
 * Convenience functions
 */
export function quicksort<T>(
  arr: T[],
  compareFn?: CompareFn<T>
): T[] {
  const sorter = new QuickSort<T>({ compareFn });
  return sorter.sort([...arr]);
}

export function quicksortInPlace<T>(
  arr: T[],
  compareFn?: CompareFn<T>
): T[] {
  const sorter = new QuickSort<T>({ compareFn });
  return sorter.sort(arr);
}

export function quickSelect<T>(
  arr: T[],
  k: number,
  compareFn?: CompareFn<T>
): T {
  const sorter = new QuickSort<T>({ compareFn });
  return sorter.quickSelect([...arr], k);
}

// Default export
export default {
  QuickSort,
  SortHelpers,
  quicksort,
  quicksortInPlace,
  quickSelect
};