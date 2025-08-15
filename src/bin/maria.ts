/**
 * MARIA CLI Binary Entry Point
 */

import { createCLI } from '../cli';
import { checkNodeVersion } from '../utils/version-check';

// Check Node.js version before starting
checkNodeVersion();

const program = createCLI();

// Parse command line arguments
program.parse(process.argv);

// Handle uncaught errors gracefully
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Goodbye!');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Goodbye!');
  process.exit(0);
});
