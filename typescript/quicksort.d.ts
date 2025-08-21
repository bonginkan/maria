/**
 * TypeScript Type Definitions for Quicksort Implementation
 * Complete type safety with generics and advanced types
 */

declare module 'quicksort' {
  /**
   * Comparison function type
   */
  export type CompareFn<T> = (a: T, b: T) => number;

  /**
   * Sort options configuration
   */
  export interface SortOptions<T> {
    compareFn?: CompareFn<T>;
    inPlace?: boolean;
    stable?: boolean;
  }

  /**
   * Statistics collected during sorting
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
  export interface QuickSortOptions<T> extends SortOptions<T> {
    insertionSortThreshold?: number;
    partitionStrategy?: PartitionStrategy;
    pivotStrategy?: PivotStrategy;
    use3WayPartition?: boolean;
    collectStatistics?: boolean;
  }

  /**
   * Basic quicksort function
   */
  export function quicksort<T>(
    arr: T[],
    compareFn?: CompareFn<T>
  ): T[];

  /**
   * Quicksort with custom range
   */
  export function quicksortRange<T>(
    arr: T[],
    left: number,
    right: number,
    compareFn?: CompareFn<T>
  ): T[];

  /**
   * Random pivot quicksort
   */
  export function quicksortRandom<T>(
    arr: T[],
    compareFn?: CompareFn<T>
  ): T[];

  /**
   * Advanced QuickSort class
   */
  export class QuickSortAdvanced<T = any> {
    constructor(options?: QuickSortOptions<T>);

    /**
     * Sort an array
     */
    sort(arr: T[]): T[];

    /**
     * Sort with custom comparison
     */
    sortWith(arr: T[], compareFn: CompareFn<T>): T[];

    /**
     * Partial sort - sort only first k elements
     */
    partialSort(arr: T[], k: number): T[];

    /**
     * Find kth smallest element
     */
    quickSelect(arr: T[], k: number): T;

    /**
     * Get sorting statistics
     */
    getStats(): SortStatistics;

    /**
     * Reset statistics
     */
    resetStats(): void;

    /**
     * Set pivot strategy
     */
    setPivotStrategy(strategy: PivotStrategy): void;

    /**
     * Set partition strategy
     */
    setPartitionStrategy(strategy: PartitionStrategy): void;
  }

  /**
   * Parallel quicksort implementation
   */
  export class ParallelQuickSort<T = any> {
    constructor(numWorkers?: number);

    /**
     * Sort array in parallel
     */
    sortAsync(arr: T[]): Promise<T[]>;

    /**
     * Get worker pool status
     */
    getWorkerStatus(): {
      active: number;
      idle: number;
      total: number;
    };

    /**
     * Terminate worker pool
     */
    terminate(): Promise<void>;
  }

  /**
   * Sorting analyzer for performance testing
   */
  export class QuickSortAnalyzer {
    /**
     * Analyze performance with different patterns
     */
    static analyzePerformance(size: number): AnalysisResult[];

    /**
     * Compare with other algorithms
     */
    static compareAlgorithms(
      algorithms: string[],
      testData: any[]
    ): ComparisonResult;

    /**
     * Generate test data patterns
     */
    static generateTestData(
      pattern: DataPattern,
      size: number
    ): number[];
  }

  /**
   * Data pattern types for testing
   */
  export type DataPattern = 
    | 'random'
    | 'sorted'
    | 'reverse'
    | 'nearly-sorted'
    | 'few-unique'
    | 'many-duplicates';

  /**
   * Analysis result type
   */
  export interface AnalysisResult {
    pattern: DataPattern;
    size: number;
    time: number;
    stats: SortStatistics;
  }

  /**
   * Comparison result type
   */
  export interface ComparisonResult {
    [algorithm: string]: {
      time: number;
      memory: number;
      stats: SortStatistics;
    };
  }

  /**
   * Utility types for type-safe sorting
   */
  export namespace Types {
    /**
     * Sortable types
     */
    export type Sortable = string | number | Date | boolean;

    /**
     * Deep sortable object
     */
    export type DeepSortable<T> = T extends Sortable
      ? T
      : T extends object
      ? { [K in keyof T]: DeepSortable<T[K]> }
      : T;

    /**
     * Sort key extractor
     */
    export type KeyExtractor<T, K> = (item: T) => K;

    /**
     * Sort direction
     */
    export type SortDirection = 'asc' | 'desc';

    /**
     * Multi-key sort configuration
     */
    export interface MultiSortConfig<T> {
      key: keyof T | KeyExtractor<T, any>;
      direction?: SortDirection;
      compareFn?: CompareFn<any>;
    }
  }

  /**
   * Helper functions
   */
  export namespace Helpers {
    /**
     * Create comparison function for objects
     */
    export function compareBy<T, K extends keyof T>(
      key: K,
      direction?: Types.SortDirection
    ): CompareFn<T>;

    /**
     * Create multi-key comparison
     */
    export function compareMultiple<T>(
      configs: Types.MultiSortConfig<T>[]
    ): CompareFn<T>;

    /**
     * Check if array is sorted
     */
    export function isSorted<T>(
      arr: T[],
      compareFn?: CompareFn<T>
    ): boolean;

    /**
     * Shuffle array (Fisher-Yates)
     */
    export function shuffle<T>(arr: T[]): T[];

    /**
     * Generate random array
     */
    export function generateRandomArray(
      size: number,
      min?: number,
      max?: number
    ): number[];
  }

  /**
   * Visualization types
   */
  export namespace Visualization {
    /**
     * Visualization step
     */
    export interface Step<T> {
      array: T[];
      left: number;
      right: number;
      pivot: number;
      comparing: number[];
      swapping: number[];
      partitioned: number[];
      message: string;
    }

    /**
     * Visualizer options
     */
    export interface VisualizerOptions {
      speed: 'slow' | 'medium' | 'fast' | 'instant';
      colors: boolean;
      interactive: boolean;
      barChart: boolean;
    }

    /**
     * Visualizer class
     */
    export class QuickSortVisualizer<T = number> {
      constructor(options?: VisualizerOptions);

      /**
       * Visualize sorting process
       */
      visualize(arr: T[]): Promise<void>;

      /**
       * Get recorded steps
       */
      getSteps(): Step<T>[];

      /**
       * Export to animation format
       */
      exportAnimation(format: 'gif' | 'mp4' | 'json'): Promise<Buffer>;
    }
  }

  /**
   * Default export
   */
  const quicksort: {
    sort: typeof quicksort;
    sortRandom: typeof quicksortRandom;
    QuickSortAdvanced: typeof QuickSortAdvanced;
    ParallelQuickSort: typeof ParallelQuickSort;
    QuickSortAnalyzer: typeof QuickSortAnalyzer;
    Helpers: typeof Helpers;
    Visualization: typeof Visualization;
  };

  export default quicksort;
}