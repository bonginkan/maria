/**
 * ASCII Visualization Tool for Quicksort Algorithm
 * Interactive terminal-based visualization with step-by-step display
 */

const chalk = require('chalk');
const readline = require('readline');

class QuickSortVisualizer {
  constructor(options = {}) {
    this.speed = options.speed || 'medium'; // slow, medium, fast
    this.colors = options.colors !== false;
    this.maxValue = options.maxValue || 99;
    this.barChar = options.barChar || '█';
    this.emptyChar = options.emptyChar || ' ';
    this.interactive = options.interactive !== false;
    
    // Speed settings (milliseconds)
    this.speeds = {
      slow: 1000,
      medium: 500,
      fast: 100,
      instant: 0
    };

    // State tracking
    this.steps = [];
    this.currentStep = 0;
    this.paused = false;
    
    // Setup readline for interactive control
    if (this.interactive) {
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      // Enable raw mode for keypress detection
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      readline.emitKeypressEvents(process.stdin);
    }
  }

  /**
   * Visualize quicksort algorithm
   */
  async visualize(arr) {
    console.clear();
    console.log(chalk.cyan('═'.repeat(60)));
    console.log(chalk.cyan.bold('    QUICKSORT VISUALIZATION'));
    console.log(chalk.cyan('═'.repeat(60)));
    console.log();
    
    // Display controls
    if (this.interactive) {
      this.displayControls();
    }

    // Record initial state
    this.recordStep({
      array: [...arr],
      left: 0,
      right: arr.length - 1,
      pivot: -1,
      comparing: [],
      swapping: [],
      partitioned: [],
      message: 'Initial array'
    });

    // Sort and record steps
    await this.quickSortWithVisualization(arr, 0, arr.length - 1);

    // Final state
    this.recordStep({
      array: [...arr],
      left: -1,
      right: -1,
      pivot: -1,
      comparing: [],
      swapping: [],
      partitioned: Array.from({length: arr.length}, (_, i) => i),
      message: '✓ Sorting complete!'
    });

    // Play visualization
    await this.playVisualization();

    // Cleanup
    if (this.rl) {
      this.rl.close();
    }
  }

  /**
   * Quicksort with visualization steps
   */
  async quickSortWithVisualization(arr, left, right, depth = 0) {
    if (left >= right) return;

    // Record partition start
    this.recordStep({
      array: [...arr],
      left: left,
      right: right,
      pivot: right,
      comparing: [],
      swapping: [],
      partitioned: [],
      message: `Partitioning [${left}:${right}], pivot = arr[${right}] = ${arr[right]}`
    });

    // Partition with visualization
    const pivotIndex = await this.partitionWithVisualization(arr, left, right);

    // Record partition complete
    this.recordStep({
      array: [...arr],
      left: left,
      right: right,
      pivot: pivotIndex,
      comparing: [],
      swapping: [],
      partitioned: [pivotIndex],
      message: `Pivot ${arr[pivotIndex]} is now at position ${pivotIndex}`
    });

    // Recursively sort left and right
    await this.quickSortWithVisualization(arr, left, pivotIndex - 1, depth + 1);
    await this.quickSortWithVisualization(arr, pivotIndex + 1, right, depth + 1);
  }

  /**
   * Partition with visualization steps
   */
  async partitionWithVisualization(arr, left, right) {
    const pivot = arr[right];
    let i = left - 1;

    for (let j = left; j < right; j++) {
      // Record comparison
      this.recordStep({
        array: [...arr],
        left: left,
        right: right,
        pivot: right,
        comparing: [j, right],
        swapping: [],
        partitioned: [],
        message: `Comparing arr[${j}]=${arr[j]} with pivot=${pivot}`
      });

      if (arr[j] <= pivot) {
        i++;
        
        if (i !== j) {
          // Record swap
          this.recordStep({
            array: [...arr],
            left: left,
            right: right,
            pivot: right,
            comparing: [],
            swapping: [i, j],
            partitioned: [],
            message: `Swapping arr[${i}]=${arr[i]} ↔ arr[${j}]=${arr[j]}`
          });
          
          [arr[i], arr[j]] = [arr[j], arr[i]];
          
          // Record after swap
          this.recordStep({
            array: [...arr],
            left: left,
            right: right,
            pivot: right,
            comparing: [],
            swapping: [],
            partitioned: [],
            message: `After swap`
          });
        }
      }
    }

    // Final swap with pivot
    if (i + 1 !== right) {
      this.recordStep({
        array: [...arr],
        left: left,
        right: right,
        pivot: right,
        comparing: [],
        swapping: [i + 1, right],
        partitioned: [],
        message: `Moving pivot: arr[${i + 1}]=${arr[i + 1]} ↔ arr[${right}]=${arr[right]}`
      });

      [arr[i + 1], arr[right]] = [arr[right], arr[i + 1]];
    }

    return i + 1;
  }

  /**
   * Record a visualization step
   */
  recordStep(step) {
    this.steps.push(step);
  }

  /**
   * Play the visualization
   */
  async playVisualization() {
    if (this.interactive) {
      this.setupKeyboardControls();
    }

    for (this.currentStep = 0; this.currentStep < this.steps.length; this.currentStep++) {
      if (this.paused && this.interactive) {
        await this.waitForUnpause();
      }

      this.displayStep(this.steps[this.currentStep]);
      
      if (this.currentStep < this.steps.length - 1) {
        await this.sleep(this.speeds[this.speed]);
      }
    }

    console.log('\n' + chalk.green('Visualization complete!'));
  }

  /**
   * Display a single step
   */
  displayStep(step) {
    // Clear previous display
    console.clear();
    
    // Header
    console.log(chalk.cyan('═'.repeat(60)));
    console.log(chalk.cyan.bold('    QUICKSORT VISUALIZATION'));
    console.log(chalk.cyan('═'.repeat(60)));
    console.log();

    // Display controls
    if (this.interactive) {
      this.displayControls();
    }

    // Step info
    console.log(chalk.yellow(`Step ${this.currentStep + 1}/${this.steps.length}: ${step.message}`));
    console.log();

    // Array visualization
    this.displayArray(step);
    console.log();

    // Bar chart visualization
    this.displayBarChart(step);
    console.log();

    // Legend
    this.displayLegend(step);
  }

  /**
   * Display array with highlighting
   */
  displayArray(step) {
    const { array, left, right, pivot, comparing, swapping, partitioned } = step;
    
    // Top border
    process.stdout.write('  ');
    for (let i = 0; i < array.length; i++) {
      process.stdout.write('┌────┐ ');
    }
    console.log();

    // Values
    process.stdout.write('  ');
    for (let i = 0; i < array.length; i++) {
      let value = array[i].toString().padStart(2);
      
      // Apply colors based on state
      if (partitioned.includes(i)) {
        value = chalk.green.bold(value);
      } else if (i === pivot) {
        value = chalk.magenta.bold(value);
      } else if (swapping.includes(i)) {
        value = chalk.red.bold(value);
      } else if (comparing.includes(i)) {
        value = chalk.yellow.bold(value);
      } else if (i >= left && i <= right) {
        value = chalk.cyan(value);
      } else {
        value = chalk.gray(value);
      }

      process.stdout.write(`│ ${value} │ `);
    }
    console.log();

    // Bottom border
    process.stdout.write('  ');
    for (let i = 0; i < array.length; i++) {
      process.stdout.write('└────┘ ');
    }
    console.log();

    // Indices
    process.stdout.write('  ');
    for (let i = 0; i < array.length; i++) {
      const index = i.toString().padStart(2);
      if (i === pivot) {
        process.stdout.write(chalk.magenta(`  ${index}   `));
      } else if (i >= left && i <= right) {
        process.stdout.write(chalk.cyan(`  ${index}   `));
      } else {
        process.stdout.write(chalk.gray(`  ${index}   `));
      }
    }
    console.log();
  }

  /**
   * Display bar chart visualization
   */
  displayBarChart(step) {
    const { array, pivot, comparing, swapping, partitioned } = step;
    const maxVal = Math.max(...array);
    const height = 10;

    console.log(chalk.dim('Bar Chart:'));
    
    for (let h = height; h > 0; h--) {
      process.stdout.write('  ');
      for (let i = 0; i < array.length; i++) {
        const barHeight = Math.round((array[i] / maxVal) * height);
        
        if (barHeight >= h) {
          let bar = this.barChar;
          
          // Apply colors
          if (partitioned.includes(i)) {
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

    // Base line
    process.stdout.write('  ');
    console.log(chalk.gray('─'.repeat(array.length * 2)));
  }

  /**
   * Display legend
   */
  displayLegend(step) {
    console.log(chalk.dim('Legend:'));
    console.log('  ' + chalk.cyan('█') + ' Active partition range');
    console.log('  ' + chalk.yellow('█') + ' Comparing');
    console.log('  ' + chalk.red('█') + ' Swapping');
    console.log('  ' + chalk.magenta('█') + ' Pivot element');
    console.log('  ' + chalk.green('█') + ' Sorted position');
    console.log('  ' + chalk.gray('█') + ' Inactive');

    if (step.left >= 0 && step.right >= 0) {
      console.log();
      console.log(chalk.dim(`Partition range: [${step.left}:${step.right}]`));
    }
  }

  /**
   * Display controls
   */
  displayControls() {
    console.log(chalk.dim('Controls: [Space] Pause/Resume | [←/→] Step | [1-4] Speed | [Q] Quit'));
    console.log();
  }

  /**
   * Setup keyboard controls
   */
  setupKeyboardControls() {
    if (!this.interactive) return;

    process.stdin.on('keypress', (str, key) => {
      if (key.name === 'space') {
        this.paused = !this.paused;
      } else if (key.name === 'left' && this.paused) {
        this.currentStep = Math.max(0, this.currentStep - 2);
      } else if (key.name === 'right' && this.paused) {
        // Step forward handled by main loop
      } else if (key.name === '1') {
        this.speed = 'slow';
      } else if (key.name === '2') {
        this.speed = 'medium';
      } else if (key.name === '3') {
        this.speed = 'fast';
      } else if (key.name === '4') {
        this.speed = 'instant';
      } else if (key.name === 'q') {
        process.exit(0);
      }
    });
  }

  /**
   * Wait for unpause
   */
  waitForUnpause() {
    return new Promise(resolve => {
      const checkPause = setInterval(() => {
        if (!this.paused) {
          clearInterval(checkPause);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Demo runner
async function runDemo() {
  const visualizer = new QuickSortVisualizer({
    speed: 'medium',
    colors: true,
    interactive: true
  });

  // Test arrays
  const arrays = {
    small: [64, 34, 25, 12, 22, 11, 90],
    medium: [5, 2, 8, 3, 9, 1, 7, 4, 6],
    random: Array.from({length: 10}, () => Math.floor(Math.random() * 99) + 1)
  };

  // Run visualization
  await visualizer.visualize(arrays.small);
}

// Export and run if main
module.exports = QuickSortVisualizer;

if (require.main === module) {
  runDemo().catch(console.error);
}