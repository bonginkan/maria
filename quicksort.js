/**
 * Quicksort implementation in JavaScript
 * Time Complexity: O(n log n) average case, O(n²) worst case
 * Space Complexity: O(log n) due to recursion
 */
function quicksort(arr, left = 0, right = arr.length - 1) {
  // Base case: arrays with 0 or 1 element are already sorted
  if (left >= right) {
    return arr;
  }
  
  // Partition the array and get the pivot index
  const pivotIndex = partition(arr, left, right);
  
  // Recursively sort elements before and after partition
  quicksort(arr, left, pivotIndex - 1);
  quicksort(arr, pivotIndex + 1, right);
  
  return arr;
}

/**
 * Partition helper function using Lomuto partition scheme
 * Places pivot element at its correct position and returns its index
 */
function partition(arr, left, right) {
  // Choose the rightmost element as pivot
  const pivot = arr[right];
  
  // Index of smaller element - indicates the right position
  // of pivot found so far
  let i = left - 1;
  
  // Traverse through the array
  for (let j = left; j < right; j++) {
    // If current element is smaller than or equal to pivot
    if (arr[j] <= pivot) {
      i++; // Increment index of smaller element
      // Swap elements at i and j
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  
  // Swap the pivot element with the element at i + 1
  [arr[i + 1], arr[right]] = [arr[right], arr[i + 1]];
  
  // Return the position where pivot is now located
  return i + 1;
}

// Alternative implementation: Quicksort with random pivot
function quicksortRandom(arr, left = 0, right = arr.length - 1) {
  if (left >= right) {
    return arr;
  }
  
  // Choose random pivot and swap it with the last element
  const randomIndex = Math.floor(Math.random() * (right - left + 1)) + left;
  [arr[randomIndex], arr[right]] = [arr[right], arr[randomIndex]];
  
  const pivotIndex = partition(arr, left, right);
  
  quicksortRandom(arr, left, pivotIndex - 1);
  quicksortRandom(arr, pivotIndex + 1, right);
  
  return arr;
}

// Example usage:
const testArray = [64, 34, 25, 12, 22, 11, 90];
console.log("Original array:", testArray);
console.log("Sorted array:", quicksort([...testArray]));

// Test with random pivot version
const testArray2 = [3, 7, 1, 4, 6, 2, 5];
console.log("Original array:", testArray2);
console.log("Sorted with random pivot:", quicksortRandom([...testArray2]));

// Export for use in other modules
module.exports = { quicksort, quicksortRandom };