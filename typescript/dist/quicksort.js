"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.quickSelect = exports.quicksortInPlace = exports.quicksort = exports.SortHelpers = exports.QuickSort = void 0;
class QuickSort {
    compareFn;
    insertionSortThreshold;
    partitionStrategy;
    pivotStrategy;
    use3WayPartition;
    stats;
    constructor(options = {}) {
        this.compareFn = options.compareFn || this.defaultCompare;
        this.insertionSortThreshold = options.insertionSortThreshold || 10;
        this.partitionStrategy = options.partitionStrategy || 'lomuto';
        this.pivotStrategy = options.pivotStrategy || 'last';
        this.use3WayPartition = options.use3WayPartition !== false;
        this.resetStats();
    }
    defaultCompare(a, b) {
        if (a < b)
            return -1;
        if (a > b)
            return 1;
        return 0;
    }
    sort(arr) {
        this.resetStats();
        const startTime = performance.now();
        this.quickSortOptimized(arr, 0, arr.length - 1, 0);
        this.stats.timeElapsed = performance.now() - startTime;
        return arr;
    }
    quickSortOptimized(arr, left, right, depth) {
        this.stats.recursionDepth = depth;
        this.stats.maxRecursionDepth = Math.max(this.stats.maxRecursionDepth, depth);
        while (left < right) {
            if (right - left + 1 <= this.insertionSortThreshold) {
                this.insertionSort(arr, left, right);
                return;
            }
            if (this.use3WayPartition && this.shouldUse3WayPartition(arr, left, right)) {
                const [lt, gt] = this.partition3Way(arr, left, right);
                if (lt - left < right - gt) {
                    this.quickSortOptimized(arr, left, lt - 1, depth + 1);
                    left = gt + 1;
                }
                else {
                    this.quickSortOptimized(arr, gt + 1, right, depth + 1);
                    right = lt - 1;
                }
            }
            else {
                const pivotIndex = this.partition(arr, left, right);
                if (pivotIndex - left < right - pivotIndex) {
                    this.quickSortOptimized(arr, left, pivotIndex - 1, depth + 1);
                    left = pivotIndex + 1;
                }
                else {
                    this.quickSortOptimized(arr, pivotIndex + 1, right, depth + 1);
                    right = pivotIndex - 1;
                }
            }
        }
    }
    partition(arr, left, right) {
        switch (this.partitionStrategy) {
            case 'hoare':
                return this.partitionHoare(arr, left, right);
            case 'lomuto':
            default:
                return this.partitionLomuto(arr, left, right);
        }
    }
    partitionLomuto(arr, left, right) {
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
    partitionHoare(arr, left, right) {
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
            if (i >= j)
                return j;
            this.swap(arr, i, j);
        }
    }
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
            }
            else if (cmp > 0) {
                this.swap(arr, i, gt);
                gt--;
            }
            else {
                i++;
            }
        }
        return [lt, gt];
    }
    selectPivot(arr, left, right) {
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
    medianOfThree(arr, left, right) {
        const mid = Math.floor((left + right) / 2);
        this.stats.comparisons += 3;
        if (this.compareFn(arr[left], arr[mid]) > 0) {
            if (this.compareFn(arr[mid], arr[right]) > 0)
                return mid;
            else if (this.compareFn(arr[left], arr[right]) > 0)
                return right;
            else
                return left;
        }
        else {
            if (this.compareFn(arr[left], arr[right]) > 0)
                return left;
            else if (this.compareFn(arr[mid], arr[right]) > 0)
                return right;
            else
                return mid;
        }
    }
    shouldUse3WayPartition(arr, left, right) {
        if (right - left < 20)
            return false;
        const sampleSize = Math.min(5, right - left + 1);
        const samples = new Set();
        for (let i = 0; i < sampleSize; i++) {
            const idx = left + Math.floor(Math.random() * (right - left + 1));
            samples.add(arr[idx]);
        }
        return samples.size < sampleSize * 0.7;
    }
    insertionSort(arr, left, right) {
        for (let i = left + 1; i <= right; i++) {
            const key = arr[i];
            let j = i - 1;
            while (j >= left) {
                this.stats.comparisons++;
                if (this.compareFn(arr[j], key) <= 0)
                    break;
                arr[j + 1] = arr[j];
                j--;
            }
            arr[j + 1] = key;
        }
    }
    swap(arr, i, j) {
        if (i !== j) {
            [arr[i], arr[j]] = [arr[j], arr[i]];
            this.stats.swaps++;
        }
    }
    quickSelect(arr, k) {
        if (k < 1 || k > arr.length) {
            throw new Error('k must be between 1 and array length');
        }
        return this.quickSelectRecursive(arr, 0, arr.length - 1, k - 1);
    }
    quickSelectRecursive(arr, left, right, k) {
        if (left === right)
            return arr[left];
        const pivotIndex = this.partition(arr, left, right);
        if (k === pivotIndex) {
            return arr[k];
        }
        else if (k < pivotIndex) {
            return this.quickSelectRecursive(arr, left, pivotIndex - 1, k);
        }
        else {
            return this.quickSelectRecursive(arr, pivotIndex + 1, right, k);
        }
    }
    partialSort(arr, k) {
        if (k >= arr.length) {
            return this.sort(arr);
        }
        this.partialQuickSort(arr, 0, arr.length - 1, k);
        return arr;
    }
    partialQuickSort(arr, left, right, k) {
        if (left >= right || left >= k)
            return;
        const pivotIndex = this.partition(arr, left, right);
        this.partialQuickSort(arr, left, pivotIndex - 1, k);
        if (pivotIndex < k - 1) {
            this.partialQuickSort(arr, pivotIndex + 1, right, k);
        }
    }
    getStats() {
        return { ...this.stats };
    }
    resetStats() {
        this.stats = {
            comparisons: 0,
            swaps: 0,
            recursionDepth: 0,
            maxRecursionDepth: 0
        };
    }
}
exports.QuickSort = QuickSort;
class SortHelpers {
    static compareBy(key, direction = 'asc') {
        const modifier = direction === 'asc' ? 1 : -1;
        return (a, b) => {
            if (a[key] < b[key])
                return -1 * modifier;
            if (a[key] > b[key])
                return 1 * modifier;
            return 0;
        };
    }
    static compareMultiple(comparisons) {
        return (a, b) => {
            for (const comp of comparisons) {
                let result = 0;
                if (comp.fn) {
                    result = comp.fn(a, b);
                }
                else if (comp.key) {
                    const modifier = comp.direction === 'desc' ? -1 : 1;
                    if (a[comp.key] < b[comp.key])
                        result = -1 * modifier;
                    else if (a[comp.key] > b[comp.key])
                        result = 1 * modifier;
                }
                if (result !== 0)
                    return result;
            }
            return 0;
        };
    }
    static isSorted(arr, compareFn) {
        const compare = compareFn || ((a, b) => a < b ? -1 : a > b ? 1 : 0);
        for (let i = 1; i < arr.length; i++) {
            if (compare(arr[i - 1], arr[i]) > 0) {
                return false;
            }
        }
        return true;
    }
    static shuffle(arr) {
        const result = [...arr];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }
    static generateRandomArray(size, min = 0, max = 100) {
        return Array.from({ length: size }, () => Math.floor(Math.random() * (max - min + 1)) + min);
    }
}
exports.SortHelpers = SortHelpers;
function quicksort(arr, compareFn) {
    const sorter = new QuickSort({ compareFn });
    return sorter.sort([...arr]);
}
exports.quicksort = quicksort;
function quicksortInPlace(arr, compareFn) {
    const sorter = new QuickSort({ compareFn });
    return sorter.sort(arr);
}
exports.quicksortInPlace = quicksortInPlace;
function quickSelect(arr, k, compareFn) {
    const sorter = new QuickSort({ compareFn });
    return sorter.quickSelect([...arr], k);
}
exports.quickSelect = quickSelect;
exports.default = {
    QuickSort,
    SortHelpers,
    quicksort,
    quicksortInPlace,
    quickSelect
};
//# sourceMappingURL=quicksort.js.map