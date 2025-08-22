#!/usr/bin/env node

/**
 * Static Quicksort Visualization
 * Shows all steps at once without clearing screen
 */

async function visualizeQuickSort() {
  // Load chalk
  const chalkModule = await import('chalk');
  const chalk = chalkModule.default;

  class StaticQuickSortVisualizer {
    constructor() {
      this.stepCount = 0;
    }

    /**
     * Main visualization method
     */
    visualize(arr) {
      console.log(chalk.cyan.bold('\n════════════════════════════════════════════════'));
      console.log(chalk.cyan.bold('        QUICKSORT STATIC VISUALIZATION'));
      console.log(chalk.cyan.bold('════════════════════════════════════════════════\n'));

      console.log(chalk.yellow('Initial Array:'));
      this.displayArray(arr, -1, [], [], []);
      console.log();

      this.quickSort([...arr], 0, arr.length - 1);
      
      console.log(chalk.green.bold('\n✅ Sorting Complete!\n'));
      console.log(chalk.yellow('Final Sorted Array:'));
      this.displayArray(arr.sort((a, b) => a - b), -1, [], [], Array.from({length: arr.length}, (_, i) => i));
    }

    /**
     * Quicksort implementation with visualization
     */
    quickSort(arr, left, right, depth = 0) {
      if (left >= right) return;

      const indent = '  '.repeat(depth);
      console.log(chalk.blue(`\n${indent}➤ Partitioning range [${left}:${right}]`));
      
      const pivotIndex = this.partition(arr, left, right, depth);
      
      console.log(chalk.magenta(`${indent}  Pivot ${arr[pivotIndex]} placed at index ${pivotIndex}`));
      this.displayArray(arr, pivotIndex, [], [], [], indent + '  ');
      
      this.quickSort(arr, left, pivotIndex - 1, depth + 1);
      this.quickSort(arr, pivotIndex + 1, right, depth + 1);
    }

    /**
     * Partition with visualization
     */
    partition(arr, left, right, depth) {
      const indent = '  '.repeat(depth);
      const pivot = arr[right];
      console.log(chalk.yellow(`${indent}  Using pivot: ${pivot} (at index ${right})`));
      
      let i = left - 1;
      
      for (let j = left; j < right; j++) {
        if (arr[j] <= pivot) {
          i++;
          if (i !== j) {
            console.log(chalk.red(`${indent}    Swap: arr[${i}]=${arr[i]} ↔ arr[${j}]=${arr[j]}`));
            [arr[i], arr[j]] = [arr[j], arr[i]];
          }
        }
      }
      
      if (i + 1 !== right) {
        console.log(chalk.red(`${indent}    Final swap: arr[${i + 1}]=${arr[i + 1]} ↔ pivot=${arr[right]}`));
        [arr[i + 1], arr[right]] = [arr[right], arr[i + 1]];
      }
      
      return i + 1;
    }

    /**
     * Display array with colors
     */
    displayArray(arr, pivotIndex, comparing, swapping, sorted, indent = '') {
      process.stdout.write(indent);
      
      for (let i = 0; i < arr.length; i++) {
        const value = arr[i].toString().padStart(2);
        let display = `[${value}]`;
        
        if (sorted.includes(i)) {
          display = chalk.green(display);
        } else if (i === pivotIndex) {
          display = chalk.magenta.bold(display);
        } else if (swapping.includes(i)) {
          display = chalk.red(display);
        } else if (comparing.includes(i)) {
          display = chalk.yellow(display);
        } else {
          display = chalk.cyan(display);
        }
        
        process.stdout.write(display + ' ');
      }
      console.log();
    }
  }

  // Run demonstration
  const visualizer = new StaticQuickSortVisualizer();
  
  // Test arrays
  const arrays = [
    { name: 'Small Array', data: [64, 34, 25, 12, 22, 11, 90] },
    { name: 'Simple Array', data: [5, 2, 8, 3, 9, 1, 7] },
    { name: 'Random Array', data: [38, 27, 43, 3, 9, 82, 10] }
  ];
  
  // Visualize first array
  console.log(chalk.white.bold(`\nVisualizing: ${arrays[0].name}`));
  console.log(chalk.gray(`Input: [${arrays[0].data.join(', ')}]`));
  visualizer.visualize([...arrays[0].data]);
  
  // Show algorithm complexity
  console.log(chalk.cyan('════════════════════════════════════════════════'));
  console.log(chalk.yellow.bold('\n📊 Algorithm Complexity:'));
  console.log(chalk.white('  • Best Case:    O(n log n)'));
  console.log(chalk.white('  • Average Case: O(n log n)'));
  console.log(chalk.white('  • Worst Case:   O(n²)'));
  console.log(chalk.white('  • Space:        O(log n)'));
  console.log();
}

// Run the visualization
visualizeQuickSort().catch(console.error);