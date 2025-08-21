#!/usr/bin/env node

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Import the CommonJS module using require
const { LLMStartupManager } = require('./dist/cli.js');

async function testStartupManager() {
  console.log('🧪 Testing LLM Startup Manager...\n');
  
  const startupManager = new LLMStartupManager();
  
  console.time('Total startup time');
  
  // Test welcome display
  console.log('1. Testing welcome display...');
  startupManager.displayWelcome();
  
  // Test service initialization
  console.log('\n2. Testing service initialization...');
  const startTime = Date.now();
  
  await startupManager.initializeServices();
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  console.timeEnd('Total startup time');
  console.log(`\n📊 Service check completed in ${duration}ms`);
  
  // Test if it meets the 3-second requirement
  if (duration <= 3000) {
    console.log('✅ PASS: Service check completed within 3 seconds');
  } else {
    console.log('❌ FAIL: Service check took longer than 3 seconds');
  }
}

// Run the test
testStartupManager().catch(console.error);