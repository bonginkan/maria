#!/usr/bin/env node

/**
 * Simple Demo of Quicksort Visualization
 * Non-interactive version for testing
 */

// Use dynamic import for chalk v5
let chalk;
async function loadChalk() {
  const chalkModule = await import('chalk');
  chalk = chalkModule.default;
}

class SimpleQuickSortVisualizer {
  constructor() {
    this.steps = [];
    this.delay = 500; // milliseconds between steps
  }

  /**
   * Visualize quicksort algorithm
   */
  async visualize(arr) {
    console.clear();
    console.log(chalk.cyan.bold('\n  QUICKSORT STEP-BY-STEP VISUALIZATION\n'));
    console.log(chalk.cyan('═'.repeat(50)));
    
    // Show initial array
    this.recordStep({
      array: [...arr],
      pivot: -1,
      comparing: [],
      swapping: [],
      sorted: [],
      message: 'Initial array'
    });

    // Perform quicksort with visualization
    await this.quickSort(arr, 0, arr.length - 1);

    // Show final sorted array
    this.recordStep({
      array: [...arr],
      pivot: -1,
      comparing: [],
      swapping: [],
      sorted: Array.from({length: arr.length}, (_, i) => i),
      message: '✓ Array is now sorted!'
    });

    // Display all steps
    await this.playSteps();
  }

  /**
   * Quicksort with step recording
   */
  async quickSort(arr, left, right) {
    if (left >= right) return;

    const pivotIndex = await this.partition(arr, left, right);
    
    this.recordStep({
      array: [...arr],
      pivot: pivotIndex,
      comparing: [],
      swapping: [],
      sorted: [pivotIndex],
      message: `Pivot ${arr[pivotIndex]} is in final position ${pivotIndex}`
    });

    await this.quickSort(arr, left, pivotIndex - 1);
    await this.quickSort(arr, pivotIndex + 1, right);
  }

  /**
   * Partition with step recording
   */
  async partition(arr, left, right) {
    const pivot = arr[right];
    
    this.recordStep({
      array: [...arr],
      pivot: right,
      comparing: [],
      swapping: [],
      sorted: [],
      message: `Partitioning with pivot ${pivot} at index ${right}`
    });

    let i = left - 1;

    for (let j = left; j < right; j++) {
      // Show comparison
      this.recordStep({
        array: [...arr],
        pivot: right,
        comparing: [j],
        swapping: [],
        sorted: [],
        message: `Comparing ${arr[j]} with pivot ${pivot}`
      });

      if (arr[j] <= pivot) {
        i++;
        if (i !== j) {
          // Show swap
          this.recordStep({
            array: [...arr],
            pivot: right,
            comparing: [],
            swapping: [i, j],
            sorted: [],
            message: `Swapping ${arr[i]} ↔ ${arr[j]}`
          });

          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
      }
    }

    // Final pivot swap
    if (i + 1 !== right) {
      this.recordStep({
        array: [...arr],
        pivot: right,
        comparing: [],
        swapping: [i + 1, right],
        sorted: [],
        message: `Moving pivot to position ${i + 1}`
      });

      [arr[i + 1], arr[right]] = [arr[right], arr[i + 1]];
    }

    return i + 1;
  }

  /**
   * Record a step
   */
  recordStep(step) {
    this.steps.push(step);
  }

  /**
   * Play all recorded steps
   */
  async playSteps() {
    for (let i = 0; i < this.steps.length; i++) {
      console.clear();
      console.log(chalk.cyan.bold('\n  QUICKSORT STEP-BY-STEP VISUALIZATION\n'));
      console.log(chalk.cyan('═'.repeat(50)));
      console.log(chalk.yellow(`\nStep ${i + 1} of ${this.steps.length}`));
      
      this.displayStep(this.steps[i]);
      
      if (i < this.steps.length - 1) {
        await this.sleep(this.delay);
      }
    }
    
    console.log(chalk.green.bold('\n✅ Visualization Complete!\n'));
  }

  /**
   * Display a single step
   */
  displayStep(step) {
    const { array, pivot, comparing, swapping, sorted, message } = step;
    
    console.log(chalk.white(`\n${message}\n`));
    
    // Display array with boxes
    process.stdout.write('  ');
    for (let i = 0; i < array.length; i++) {
      const value = array[i].toString().padStart(2);
      let display = `[${value}]`;
      
      // Apply colors
      if (sorted.includes(i)) {
        display = chalk.green.bold(display);
      } else if (i === pivot) {
        display = chalk.magenta.bold(display);
      } else if (swapping.includes(i)) {
        display = chalk.red.bold(display);
      } else if (comparing.includes(i)) {
        display = chalk.yellow.bold(display);
      } else {
        display = chalk.cyan(display);
      }
      
      process.stdout.write(display + ' ');
    }
    console.log('\n');
    
    // Display indices
    process.stdout.write('  ');
    for (let i = 0; i < array.length; i++) {
      const index = i.toString().padStart(3);
      if (i === pivot) {
        process.stdout.write(chalk.magenta(index) + '  ');
      } else if (sorted.includes(i)) {
        process.stdout.write(chalk.green(index) + '  ');
      } else {
        process.stdout.write(chalk.gray(index) + '  ');
      }
    }
    console.log('\n');
    
    // Display bar chart
    this.displayBarChart(array, pivot, comparing, swapping, sorted);
    
    // Display legend
    console.log(chalk.dim('\nLegend:'));
    console.log('  ' + chalk.yellow('[##]') + ' Comparing');
    console.log('  ' + chalk.red('[##]') + ' Swapping');
    console.log('  ' + chalk.magenta('[##]') + ' Pivot');
    console.log('  ' + chalk.green('[##]') + ' Sorted');
  }

  /**
   * Display bar chart
   */
  displayBarChart(array, pivot, comparing, swapping, sorted) {
    const maxVal = Math.max(...array);
    const height = 8;
    
    console.log(chalk.dim('Bar Chart:'));
    
    for (let h = height; h > 0; h--) {
      process.stdout.write('  ');
      for (let i = 0; i < array.length; i++) {
        const barHeight = Math.ceil((array[i] / maxVal) * height);
        
        if (barHeight >= h) {
          let bar = '█';
          
          if (sorted.includes(i)) {
            bar = chalk.green(bar);
          } else if (i === pivot) {
            bar = chalk.magenta(bar);
          } else if (swapping.includes(i)) {
            bar = chalk.red(bar);
          } else if (comparing.includes(i)) {
            bar = chalk.yellow(bar);
          } else {
            bar = chalk.cyan(bar);
          }
          
          process.stdout.write(bar + ' ');
        } else {
          process.stdout.write('  ');
        }
      }
      console.log();
    }
    
    process.stdout.write('  ');
    console.log(chalk.gray('─'.repeat(array.length * 2)));
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run demo
async function main() {
  // Load chalk first
  await loadChalk();
  
  const visualizer = new SimpleQuickSortVisualizer();
  
  // Test arrays
  const testArrays = [
    [64, 34, 25, 12, 22, 11, 90],
    [5, 2, 8, 3, 9, 1, 7, 4, 6],
    [38, 27, 43, 3, 9, 82, 10]
  ];
  
  console.log(chalk.cyan.bold('Select an array to visualize:'));
  console.log('1. [64, 34, 25, 12, 22, 11, 90]');
  console.log('2. [5, 2, 8, 3, 9, 1, 7, 4, 6]');
  console.log('3. [38, 27, 43, 3, 9, 82, 10]');
  
  // For demo, use the first array
  const selectedArray = testArrays[0];
  console.log(chalk.yellow('\nVisualizing array #1...\n'));
  
  await visualizer.visualize(selectedArray);
}

// Run if main module
if (require.main === module) {
  main().catch(console.error);
}

module.exports = SimpleQuickSortVisualizer;