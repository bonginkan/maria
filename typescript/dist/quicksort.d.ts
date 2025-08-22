export type CompareFn<T> = (a: T, b: T) => number;
export interface SortStatistics {
    comparisons: number;
    swaps: number;
    recursionDepth: number;
    maxRecursionDepth: number;
    timeElapsed?: number;
    memoryUsed?: number;
}
export type PartitionStrategy = 'lomuto' | 'hoare' | '3-way';
export type PivotStrategy = 'first' | 'last' | 'random' | 'median-of-three';
export interface QuickSortOptions<T> {
    compareFn?: CompareFn<T>;
    insertionSortThreshold?: number;
    partitionStrategy?: PartitionStrategy;
    pivotStrategy?: PivotStrategy;
    use3WayPartition?: boolean;
    collectStatistics?: boolean;
}
export declare class QuickSort<T> {
    private compareFn;
    private insertionSortThreshold;
    private partitionStrategy;
    private pivotStrategy;
    private use3WayPartition;
    private stats;
    constructor(options?: QuickSortOptions<T>);
    private defaultCompare;
    sort(arr: T[]): T[];
    private quickSortOptimized;
    private partition;
    private partitionLomuto;
    private partitionHoare;
    private partition3Way;
    private selectPivot;
    private medianOfThree;
    private shouldUse3WayPartition;
    private insertionSort;
    private swap;
    quickSelect(arr: T[], k: number): T;
    private quickSelectRecursive;
    partialSort(arr: T[], k: number): T[];
    private partialQuickSort;
    getStats(): SortStatistics;
    private resetStats;
}
export declare class SortHelpers {
    static compareBy<T, K extends keyof T>(key: K, direction?: 'asc' | 'desc'): CompareFn<T>;
    static compareMultiple<T>(comparisons: Array<{
        key?: keyof T;
        fn?: CompareFn<T>;
        direction?: 'asc' | 'desc';
    }>): CompareFn<T>;
    static isSorted<T>(arr: T[], compareFn?: CompareFn<T>): boolean;
    static shuffle<T>(arr: T[]): T[];
    static generateRandomArray(size: number, min?: number, max?: number): number[];
}
export declare function quicksort<T>(arr: T[], compareFn?: CompareFn<T>): T[];
export declare function quicksortInPlace<T>(arr: T[], compareFn?: CompareFn<T>): T[];
export declare function quickSelect<T>(arr: T[], k: number, compareFn?: CompareFn<T>): T;
declare const _default: {
    QuickSort: typeof QuickSort;
    SortHelpers: typeof SortHelpers;
    quicksort: typeof quicksort;
    quicksortInPlace: typeof quicksortInPlace;
    quickSelect: typeof quickSelect;
};
export default _default;
//# sourceMappingURL=quicksort.d.ts.map