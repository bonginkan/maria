/**
 * MARIA CLI Binary Entry Point
 *
 * This is the ONLY official CLI entry point for Maria.
 * Provides the full MARIA CODE experience with startup screen
 *
 * @since v3.0.0
 */

import { createCLI } from "../maria-ai";
import { checkNodeVersion } from "../utils/version-check";
import { loadEnvironmentConfig } from "../config/loader";

// Main async function to handle initialization
async function main() {
  // Load environment variables from .env.local file
  await loadEnvironmentConfig();

  // Check Node.js version before starting
  checkNodeVersion();

  const program = createCLI();

  // Parse command line arguments
  program.parse(process.argv);
}

// Handle uncaught errors gracefully
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error.message);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n👋 Goodbye!");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n👋 Goodbye!");
  process.exit(0);
});

// Start the main function
main().catch((error) => {
  console.error("❌ Failed to start:", error);
  process.exit(1);
});
