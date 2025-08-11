#!/usr/bin/env node
/**
 * Interactive Model Selection Command
 * Standalone executable for model selection with arrow key navigation
 */

import React from 'react';
import { render } from 'ink';
import { ModelSelector } from '../components/ModelSelector.js';

// Check if running directly
const isDirectRun =
  process.argv[1]?.endsWith('model-interactive.tsx') ||
  process.argv[1]?.endsWith('model-interactive.js');

async function runInteractiveModelSelector(): Promise<string | null> {
  return new Promise((resolve) => {
    const { waitUntilExit } = render(
      <ModelSelector
        onComplete={(model) => {
          resolve(model);
        }}
        onCancel={() => {
          resolve(null);
        }}
      />,
    );

    waitUntilExit().catch((error) => {
      console.error('Error in model selector:', error);
      resolve(null);
    });
  });
}

// Export for use in other modules
export { runInteractiveModelSelector };

// Run if executed directly
if (isDirectRun) {
  runInteractiveModelSelector()
    .then((model) => {
      if (model) {
        console.log(`\n✅ Model switched to: ${model}`);
        process.exit(0);
      } else {
        console.log('\n❌ Model selection cancelled');
        process.exit(1);
      }
    })
    .catch(console.error);
}

export default runInteractiveModelSelector;
