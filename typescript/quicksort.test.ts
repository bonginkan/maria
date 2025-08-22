/**
 * TypeScript Type Tests for Quicksort Implementation
 * Validates type inference and generic usage
 */

import {
  QuickSort,
  SortHelpers,
  quicksort,
  quicksortInPlace,
  quickSelect,
  CompareFn,
  SortStatistics
} from './quicksort';

// Test type inference with primitives
function testPrimitives(): void {
  // Number arrays
  const numbers: number[] = [3, 1, 4, 1, 5, 9, 2, 6];
  const sortedNumbers = quicksort(numbers);
  const inPlaceSorted = quicksortInPlace(numbers);
  const kthSmallest = quickSelect(numbers, 3);
  
  // Type assertion tests
  const _n1: number[] = sortedNumbers;
  const _n2: number[] = inPlaceSorted;
  const _n3: number = kthSmallest;
  
  // String arrays
  const strings: string[] = ['banana', 'apple', 'cherry'];
  const sortedStrings = quicksort(strings);
  const _s1: string[] = sortedStrings;
  
  // Boolean arrays
  const booleans: boolean[] = [true, false, true, false];
  const sortedBools = quicksort(booleans);
  const _b1: boolean[] = sortedBools;
}

// Test with custom types
interface Person {
  name: string;
  age: number;
  score: number;
}

function testCustomTypes(): void {
  const people: Person[] = [
    { name: 'Alice', age: 30, score: 95 },
    { name: 'Bob', age: 25, score: 85 },
    { name: 'Charlie', age: 35, score: 90 }
  ];
  
  // Sort by age
  const byAge = SortHelpers.compareBy<Person, 'age'>('age');
  const sortedByAge = quicksort(people, byAge);
  const _p1: Person[] = sortedByAge;
  
  // Sort by name (descending)
  const byNameDesc = SortHelpers.compareBy<Person, 'name'>('name', 'desc');
  const sortedByName = quicksort(people, byNameDesc);
  const _p2: Person[] = sortedByName;
  
  // Multi-key sort
  const multiSort = SortHelpers.compareMultiple<Person>([
    { key: 'score', direction: 'desc' },
    { key: 'age', direction: 'asc' }
  ]);
  const multiSorted = quicksort(people, multiSort);
  const _p3: Person[] = multiSorted;
}

// Test QuickSort class
function testQuickSortClass(): void {
  // Generic instantiation
  const numberSorter = new QuickSort<number>();
  const stringSorter = new QuickSort<string>({
    insertionSortThreshold: 5,
    pivotStrategy: 'median-of-three'
  });
  
  // Custom object sorter
  interface Product {
    id: number;
    name: string;
    price: number;
  }
  
  const productSorter = new QuickSort<Product>({
    compareFn: (a, b) => a.price - b.price,
    use3WayPartition: true,
    partitionStrategy: 'hoare'
  });
  
  const products: Product[] = [
    { id: 1, name: 'Laptop', price: 999 },
    { id: 2, name: 'Mouse', price: 25 },
    { id: 3, name: 'Keyboard', price: 75 }
  ];
  
  const sortedProducts = productSorter.sort(products);
  const stats = productSorter.getStats();
  
  // Type assertions
  const _pr1: Product[] = sortedProducts;
  const _st1: SortStatistics = stats;
  const _comp: number = stats.comparisons;
  const _swaps: number = stats.swaps;
  
  // Partial sort
  const partialSorted = productSorter.partialSort(products, 2);
  const _pr2: Product[] = partialSorted;
  
  // Quick select
  const median = productSorter.quickSelect(products, 2);
  const _pr3: Product = median;
}

// Test with union types
type MixedType = string | number;

function testUnionTypes(): void {
  const mixed: MixedType[] = [1, 'apple', 3, 'banana', 2];
  
  const compareFn: CompareFn<MixedType> = (a, b) => {
    const aStr = String(a);
    const bStr = String(b);
    return aStr.localeCompare(bStr);
  };
  
  const sorted = quicksort(mixed, compareFn);
  const _m1: MixedType[] = sorted;
}

// Test with nullable types
function testNullableTypes(): void {
  const nullableNumbers: (number | null)[] = [3, null, 1, 4, null, 2];
  
  const nullSafeCompare: CompareFn<number | null> = (a, b) => {
    if (a === null && b === null) return 0;
    if (a === null) return 1; // nulls at end
    if (b === null) return -1;
    return a - b;
  };
  
  const sorted = quicksort(nullableNumbers, nullSafeCompare);
  const _nn1: (number | null)[] = sorted;
}

// Test helper functions
function testHelpers(): void {
  // isSorted
  const arr1 = [1, 2, 3, 4, 5];
  const sorted1: boolean = SortHelpers.isSorted(arr1);
  
  const arr2 = ['a', 'b', 'c'];
  const sorted2: boolean = SortHelpers.isSorted(arr2);
  
  // shuffle
  const shuffled: number[] = SortHelpers.shuffle([1, 2, 3, 4, 5]);
  
  // generateRandomArray
  const random: number[] = SortHelpers.generateRandomArray(10, 0, 100);
}

// Test with tuples
function testTuples(): void {
  type DataPoint = [number, string, boolean];
  
  const data: DataPoint[] = [
    [3, 'three', true],
    [1, 'one', false],
    [2, 'two', true]
  ];
  
  const compareFn: CompareFn<DataPoint> = (a, b) => a[0] - b[0];
  const sorted = quicksort(data, compareFn);
  const _t1: DataPoint[] = sorted;
}

// Test with readonly arrays
function testReadonlyArrays(): void {
  const readonlyArr: readonly number[] = [3, 1, 4, 1, 5];
  const mutableCopy = [...readonlyArr];
  const sorted = quicksort(mutableCopy);
  const _r1: number[] = sorted;
}

// Test with generics constraints
function sortWithConstraint<T extends { id: number }>(
  items: T[]
): T[] {
  return quicksort(items, (a, b) => a.id - b.id);
}

function testConstraints(): void {
  interface User { id: number; name: string; }
  interface Post { id: number; title: string; content: string; }
  
  const users: User[] = [
    { id: 3, name: 'Alice' },
    { id: 1, name: 'Bob' }
  ];
  
  const posts: Post[] = [
    { id: 2, title: 'Hello', content: 'World' },
    { id: 1, title: 'First', content: 'Post' }
  ];
  
  const sortedUsers = sortWithConstraint(users);
  const sortedPosts = sortWithConstraint(posts);
  
  const _u1: User[] = sortedUsers;
  const _p1: Post[] = sortedPosts;
}

// Test mapped types
type Sortable<T> = {
  [K in keyof T]: T[K] extends number | string | boolean | Date
    ? T[K]
    : never;
};

function testMappedTypes(): void {
  interface Data {
    id: number;
    name: string;
    active: boolean;
    data: object; // This won't be sortable
  }
  
  type SortableData = Sortable<Data>;
  // SortableData will have id, name, active but not data
  
  const item: SortableData = {
    id: 1,
    name: 'test',
    active: true,
    data: never
  };
}

// Test conditional types
type SortResult<T> = T extends any[] ? T : never;

function conditionalSort<T>(
  input: T
): SortResult<T> {
  if (Array.isArray(input)) {
    return quicksort(input) as SortResult<T>;
  }
  return undefined as never;
}

function testConditionalTypes(): void {
  const arr = [3, 1, 2];
  const sorted = conditionalSort(arr);
  const _c1: number[] = sorted;
  
  // This would cause a compile error:
  // const notArr = 123;
  // const invalid = conditionalSort(notArr); // never
}

// Run all tests
function runAllTests(): void {
  console.log('Running TypeScript type tests...');
  
  testPrimitives();
  testCustomTypes();
  testQuickSortClass();
  testUnionTypes();
  testNullableTypes();
  testHelpers();
  testTuples();
  testReadonlyArrays();
  testConstraints();
  testMappedTypes();
  testConditionalTypes();
  
  console.log('✅ All type tests passed!');
}

// Execute tests if main module
if (require.main === module) {
  runAllTests();
}

export {
  testPrimitives,
  testCustomTypes,
  testQuickSortClass,
  testUnionTypes,
  testNullableTypes,
  testHelpers
};