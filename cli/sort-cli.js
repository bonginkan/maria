#!/usr/bin/env node

/**
 * Command-Line Sorting Tool
 * Sorts data from files, stdin, or command arguments
 */

const fs = require('fs');
const path = require('path');
const { QuickSortAdvanced } = require('../quicksort-advanced');
const MergeSort = require('../algorithms/mergesort');
const HeapSort = require('../algorithms/heapsort');

// Parse command-line arguments
const args = process.argv.slice(2);
const options = parseArguments(args);

/**
 * Parse command-line arguments
 */
function parseArguments(args) {
  const options = {
    algorithm: 'quicksort',
    input: null,
    output: null,
    format: 'text',
    separator: ',',
    numeric: false,
    reverse: false,
    unique: false,
    stats: false,
    help: false,
    version: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '-h':
      case '--help':
        options.help = true;
        break;
      
      case '-v':
      case '--version':
        options.version = true;
        break;
      
      case '-a':
      case '--algorithm':
        options.algorithm = args[++i] || 'quicksort';
        break;
      
      case '-i':
      case '--input':
        options.input = args[++i];
        break;
      
      case '-o':
      case '--output':
        options.output = args[++i];
        break;
      
      case '-f':
      case '--format':
        options.format = args[++i] || 'text';
        break;
      
      case '-s':
      case '--separator':
        options.separator = args[++i] || ',';
        break;
      
      case '-n':
      case '--numeric':
        options.numeric = true;
        break;
      
      case '-r':
      case '--reverse':
        options.reverse = true;
        break;
      
      case '-u':
      case '--unique':
        options.unique = true;
        break;
      
      case '--stats':
        options.stats = true;
        break;
      
      case '--stdin':
        options.input = 'stdin';
        break;
      
      default:
        if (!arg.startsWith('-') && !options.input) {
          options.input = arg;
        }
    }
  }

  return options;
}

/**
 * Display help message
 */
function showHelp() {
  console.log(`
Sort CLI - Advanced Sorting Tool
================================

Usage: sort-cli [OPTIONS] [INPUT]

Options:
  -h, --help              Show this help message
  -v, --version           Show version information
  -a, --algorithm <name>  Sorting algorithm (quicksort, mergesort, heapsort)
  -i, --input <file>      Input file path (or use --stdin)
  -o, --output <file>     Output file path (default: stdout)
  -f, --format <type>     Output format (text, json, csv)
  -s, --separator <char>  Field separator (default: comma)
  -n, --numeric           Sort numerically
  -r, --reverse           Sort in reverse order
  -u, --unique            Remove duplicates
  --stats                 Show sorting statistics
  --stdin                 Read from standard input

Examples:
  sort-cli numbers.txt
  sort-cli --input data.csv --output sorted.csv --algorithm mergesort
  cat numbers.txt | sort-cli --stdin --numeric
  sort-cli -a heapsort -n -r numbers.txt
  sort-cli --format json --stats data.txt

Supported Algorithms:
  - quicksort: Fast, in-place, O(n log n) average
  - mergesort: Stable, O(n log n) guaranteed
  - heapsort: In-place, O(n log n) guaranteed
  `);
}

/**
 * Show version information
 */
function showVersion() {
  console.log('Sort CLI v1.0.0');
}

/**
 * Read input data
 */
async function readInput(options) {
  if (options.input === 'stdin') {
    return readFromStdin();
  } else if (options.input) {
    return readFromFile(options.input);
  } else {
    return readFromStdin();
  }
}

/**
 * Read from stdin
 */
function readFromStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      data += chunk;
    });
    
    process.stdin.on('end', () => {
      resolve(data.trim());
    });
    
    process.stdin.on('error', reject);
    
    // Start reading
    process.stdin.resume();
  });
}

/**
 * Read from file
 */
function readFromFile(filepath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filepath, 'utf8', (err, data) => {
      if (err) {
        reject(new Error(`Failed to read file: ${err.message}`));
      } else {
        resolve(data.trim());
      }
    });
  });
}

/**
 * Parse input data
 */
function parseInput(data, options) {
  let items;
  
  // Split by lines or separator
  if (data.includes('\n')) {
    items = data.split('\n').filter(line => line.trim());
  } else {
    items = data.split(options.separator).map(item => item.trim());
  }
  
  // Convert to numbers if numeric
  if (options.numeric) {
    items = items.map(item => {
      const num = parseFloat(item);
      return isNaN(num) ? 0 : num;
    });
  }
  
  // Remove duplicates if requested
  if (options.unique) {
    items = [...new Set(items)];
  }
  
  return items;
}

/**
 * Get sorting algorithm
 */
function getSortingAlgorithm(name) {
  switch (name.toLowerCase()) {
    case 'mergesort':
    case 'merge':
      return new MergeSort();
    
    case 'heapsort':
    case 'heap':
      return new HeapSort();
    
    case 'quicksort':
    case 'quick':
    default:
      return new QuickSortAdvanced();
  }
}

/**
 * Sort data
 */
function sortData(items, options) {
  const algorithm = getSortingAlgorithm(options.algorithm);
  
  // Create comparison function
  let compareFn;
  if (options.numeric) {
    compareFn = (a, b) => a - b;
  } else {
    compareFn = (a, b) => {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    };
  }
  
  // Reverse if needed
  if (options.reverse) {
    const originalCompareFn = compareFn;
    compareFn = (a, b) => -originalCompareFn(a, b);
  }
  
  // Set comparison function for algorithms that support it
  if (algorithm.constructor.name === 'MergeSort' || 
      algorithm.constructor.name === 'HeapSort') {
    algorithm.compareFn = compareFn;
  }
  
  // Sort
  const startTime = Date.now();
  const sorted = algorithm.sort ? 
    algorithm.sort([...items], compareFn) :
    algorithm.sort([...items]);
  const endTime = Date.now();
  
  // Get statistics
  const stats = algorithm.getStats ? algorithm.getStats() : {};
  stats.timeElapsed = endTime - startTime;
  stats.itemCount = items.length;
  stats.algorithm = options.algorithm;
  
  return { sorted, stats };
}

/**
 * Format output
 */
function formatOutput(items, options) {
  switch (options.format.toLowerCase()) {
    case 'json':
      return JSON.stringify(items, null, 2);
    
    case 'csv':
      return items.join(',');
    
    case 'text':
    default:
      return items.join('\n');
  }
}

/**
 * Write output
 */
async function writeOutput(data, options) {
  if (options.output) {
    return writeToFile(data, options.output);
  } else {
    console.log(data);
  }
}

/**
 * Write to file
 */
function writeToFile(data, filepath) {
  return new Promise((resolve, reject) => {
    fs.writeFile(filepath, data, 'utf8', err => {
      if (err) {
        reject(new Error(`Failed to write file: ${err.message}`));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Display statistics
 */
function displayStats(stats) {
  console.error('\n--- Sorting Statistics ---');
  console.error(`Algorithm: ${stats.algorithm}`);
  console.error(`Items: ${stats.itemCount}`);
  console.error(`Time: ${stats.timeElapsed}ms`);
  if (stats.comparisons) {
    console.error(`Comparisons: ${stats.comparisons}`);
  }
  if (stats.swaps) {
    console.error(`Swaps: ${stats.swaps}`);
  }
  if (stats.maxRecursionDepth) {
    console.error(`Max Recursion Depth: ${stats.maxRecursionDepth}`);
  }
  console.error('------------------------\n');
}

/**
 * Main function
 */
async function main() {
  try {
    // Handle help and version
    if (options.help) {
      showHelp();
      process.exit(0);
    }
    
    if (options.version) {
      showVersion();
      process.exit(0);
    }
    
    // Read input
    const inputData = await readInput(options);
    
    if (!inputData) {
      console.error('Error: No input data provided');
      process.exit(1);
    }
    
    // Parse input
    const items = parseInput(inputData, options);
    
    if (items.length === 0) {
      console.error('Error: No items to sort');
      process.exit(1);
    }
    
    // Sort data
    const { sorted, stats } = sortData(items, options);
    
    // Format output
    const output = formatOutput(sorted, options);
    
    // Write output
    await writeOutput(output, options);
    
    // Display statistics if requested
    if (options.stats) {
      displayStats(stats);
    }
    
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Run main function
main();