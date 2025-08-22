/**
 * Demonstration of quicksort implementations
 */
const { quicksort, quicksortRandom } = require('./quicksort');
const { QuickSortAdvanced, QuickSortAnalyzer } = require('./quicksort-advanced');

console.log('=' .repeat(60));
console.log(' QUICKSORT IMPLEMENTATIONS DEMONSTRATION');
console.log('=' .repeat(60));

// 1. Basic quicksort comparison
console.log('\n1. BASIC IMPLEMENTATIONS COMPARISON');
console.log('-'.repeat(40));

const testArray = [64, 34, 25, 12, 22, 11, 90, 88, 45, 30];
console.log('Original array:', testArray);

const standard = quicksort([...testArray]);
console.log('Standard quicksort:', standard);

const random = quicksortRandom([...testArray]);
console.log('Random pivot:', random);

// 2. Advanced quicksort with statistics
console.log('\n2. ADVANCED QUICKSORT WITH STATISTICS');
console.log('-'.repeat(40));

const advancedSorter = new QuickSortAdvanced({
  insertionSortThreshold: 10,
  use3WayPartition: true
});

const testData = [3, 7, 1, 4, 6, 2, 5, 8, 9, 0];
console.log('Test array:', testData);

const sorted = advancedSorter.sort([...testData]);
console.log('Sorted:', sorted);
console.log('Statistics:', advancedSorter.getStats());

// 3. Custom comparison function
console.log('\n3. CUSTOM COMPARISON (DESCENDING ORDER)');
console.log('-'.repeat(40));

const descending = advancedSorter.sort(
  [...testData],
  (a, b) => b - a  // Reverse comparison for descending order
);
console.log('Descending:', descending);

// 4. Sorting objects
console.log('\n4. SORTING OBJECTS BY PROPERTY');
console.log('-'.repeat(40));

const people = [
  { name: 'Alice', age: 30 },
  { name: 'Bob', age: 25 },
  { name: 'Charlie', age: 35 },
  { name: 'David', age: 28 },
  { name: 'Eve', age: 32 }
];

console.log('Original people:');
people.forEach(p => console.log(`  ${p.name}: ${p.age}`));

const sortedPeople = advancedSorter.sort(
  [...people],
  (a, b) => a.age - b.age
);

console.log('\nSorted by age:');
sortedPeople.forEach(p => console.log(`  ${p.name}: ${p.age}`));

// 5. Performance analysis
console.log('\n5. PERFORMANCE ANALYSIS');
console.log('-'.repeat(40));

console.log('Analyzing different input patterns (size=1000):');
const analysis = QuickSortAnalyzer.analyzePerformance(1000);

analysis.forEach(result => {
  console.log(`\n${result.pattern}:`);
  console.log(`  Time: ${result.time}ms`);
  console.log(`  Comparisons: ${result.stats.comparisons}`);
  console.log(`  Swaps: ${result.stats.swaps}`);
  console.log(`  Max recursion depth: ${result.stats.maxRecursionDepth}`);
});

// 6. Handling edge cases
console.log('\n6. EDGE CASES');
console.log('-'.repeat(40));

const edgeCases = [
  { name: 'Empty array', data: [] },
  { name: 'Single element', data: [42] },
  { name: 'All duplicates', data: [5, 5, 5, 5, 5] },
  { name: 'Already sorted', data: [1, 2, 3, 4, 5] }
];

edgeCases.forEach(({ name, data }) => {
  const result = advancedSorter.sort([...data]);
  console.log(`${name}: [${data}] → [${result}]`);
});

// 7. Large array performance
console.log('\n7. LARGE ARRAY PERFORMANCE TEST');
console.log('-'.repeat(40));

const sizes = [1000, 5000, 10000, 50000];

sizes.forEach(size => {
  const bigArray = Array.from({ length: size }, () => 
    Math.floor(Math.random() * size)
  );
  
  const start = Date.now();
  advancedSorter.sort([...bigArray]);
  const time = Date.now() - start;
  
  console.log(`Size ${size}: ${time}ms (${advancedSorter.getStats().comparisons} comparisons)`);
});

// 8. 3-way partition demonstration
console.log('\n8. 3-WAY PARTITION (MANY DUPLICATES)');
console.log('-'.repeat(40));

const duplicateArray = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3, 2, 3, 8, 4];
console.log('Array with duplicates:', duplicateArray);

const sorterWith3Way = new QuickSortAdvanced({ use3WayPartition: true });
const sorterWithout3Way = new QuickSortAdvanced({ use3WayPartition: false });

sorterWith3Way.sort([...duplicateArray]);
const statsWith = sorterWith3Way.getStats();

sorterWithout3Way.sort([...duplicateArray]);
const statsWithout = sorterWithout3Way.getStats();

console.log('With 3-way partition:');
console.log(`  Comparisons: ${statsWith.comparisons}, Swaps: ${statsWith.swaps}`);
console.log('Without 3-way partition:');
console.log(`  Comparisons: ${statsWithout.comparisons}, Swaps: ${statsWithout.swaps}`);

console.log('\n' + '='.repeat(60));
console.log(' DEMONSTRATION COMPLETE');
console.log('=' .repeat(60));