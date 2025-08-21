/**
 * Test suite for quicksort implementations
 */
const { quicksort, quicksortRandom } = require('./quicksort');

// Test helper function to verify if array is sorted
function isSorted(arr) {
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] < arr[i - 1]) {
      return false;
    }
  }
  return true;
}

// Test helper to create a copy and sort
function testSort(arr, sortFunction, testName) {
  const original = [...arr];
  const sorted = sortFunction([...arr]);
  
  console.log(`\n${testName}:`);
  console.log(`  Original: [${original}]`);
  console.log(`  Sorted:   [${sorted}]`);
  console.log(`  ✓ Is sorted: ${isSorted(sorted)}`);
  
  return isSorted(sorted);
}

// Run comprehensive tests
function runTests() {
  console.log('='.repeat(50));
  console.log('QUICKSORT TEST SUITE');
  console.log('='.repeat(50));
  
  const testCases = [
    // Basic cases
    { name: 'Empty array', data: [] },
    { name: 'Single element', data: [42] },
    { name: 'Two elements', data: [2, 1] },
    { name: 'Already sorted', data: [1, 2, 3, 4, 5] },
    { name: 'Reverse sorted', data: [5, 4, 3, 2, 1] },
    
    // Edge cases
    { name: 'All same elements', data: [3, 3, 3, 3, 3] },
    { name: 'Negative numbers', data: [-5, -1, -3, -2, -4] },
    { name: 'Mixed positive/negative', data: [-2, 5, -8, 3, 0, -1, 7] },
    { name: 'Decimals', data: [3.14, 2.71, 1.41, 0.5, 2.0] },
    
    // Larger arrays
    { name: 'Random 10 elements', data: [64, 34, 25, 12, 22, 11, 90, 88, 45, 30] },
    { name: 'Random 20 elements', data: Array.from({length: 20}, () => Math.floor(Math.random() * 100)) },
    
    // Special patterns
    { name: 'Mountain pattern', data: [1, 3, 5, 7, 9, 8, 6, 4, 2] },
    { name: 'Valley pattern', data: [9, 7, 5, 3, 1, 2, 4, 6, 8] },
    { name: 'Alternating', data: [1, 10, 2, 9, 3, 8, 4, 7, 5, 6] }
  ];
  
  let standardPassed = 0;
  let randomPassed = 0;
  
  console.log('\n' + '='.repeat(50));
  console.log('TESTING STANDARD QUICKSORT');
  console.log('='.repeat(50));
  
  testCases.forEach(testCase => {
    if (testSort(testCase.data, quicksort, testCase.name)) {
      standardPassed++;
    }
  });
  
  console.log('\n' + '='.repeat(50));
  console.log('TESTING RANDOM PIVOT QUICKSORT');
  console.log('='.repeat(50));
  
  testCases.forEach(testCase => {
    if (testSort(testCase.data, quicksortRandom, testCase.name)) {
      randomPassed++;
    }
  });
  
  // Performance comparison
  console.log('\n' + '='.repeat(50));
  console.log('PERFORMANCE COMPARISON');
  console.log('='.repeat(50));
  
  const sizes = [100, 1000, 10000];
  
  sizes.forEach(size => {
    const randomArray = Array.from({length: size}, () => Math.floor(Math.random() * 1000));
    
    // Test standard quicksort
    const standardStart = Date.now();
    quicksort([...randomArray]);
    const standardTime = Date.now() - standardStart;
    
    // Test random pivot quicksort
    const randomStart = Date.now();
    quicksortRandom([...randomArray]);
    const randomTime = Date.now() - randomStart;
    
    console.log(`\nArray size: ${size}`);
    console.log(`  Standard quicksort: ${standardTime}ms`);
    console.log(`  Random pivot:       ${randomTime}ms`);
  });
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`Standard Quicksort: ${standardPassed}/${testCases.length} tests passed`);
  console.log(`Random Pivot:       ${randomPassed}/${testCases.length} tests passed`);
  
  if (standardPassed === testCases.length && randomPassed === testCases.length) {
    console.log('\n✅ ALL TESTS PASSED!');
  } else {
    console.log('\n❌ SOME TESTS FAILED');
  }
}

// Run the tests
runTests();