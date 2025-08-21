#!/usr/bin/env node

const { getInternalModeService } = require('./dist/index.js');

async function debugModes() {
  console.log('🔍 Debugging Internal Mode System');
  console.log('═══════════════════════════════════\n');

  try {
    const internalModeService = getInternalModeService();
    await internalModeService.initialize();

    // Get all available modes
    const allModes = internalModeService.getAllModes();
    console.log(`📊 Total modes available: ${allModes.length}\n`);

    // List all modes
    console.log('📋 Available modes:');
    allModes.forEach((mode, index) => {
      console.log(`${index + 1}. ${mode.id} - ${mode.name} (${mode.category})`);
      console.log(`   Keywords: ${mode.keywords ? mode.keywords.join(', ') : 'none'}`);
      console.log(`   Triggers: ${mode.triggers ? mode.triggers.join(', ') : 'none'}`);
      console.log('');
    });

    // Test simple mode recognition
    console.log('🧪 Testing mode recognition logic:\n');
    
    const testInputs = [
      'think about this problem',
      'analyze the code',
      'debug the error',
      'brainstorm ideas',
      'design a solution'
    ];

    for (const input of testInputs) {
      console.log(`Testing: "${input}"`);
      try {
        const recognition = await internalModeService.recognizeMode(input);
        if (recognition) {
          console.log(`  → Mode: ${recognition.mode.id}, Confidence: ${(recognition.confidence * 100).toFixed(1)}%`);
        } else {
          console.log(`  → No recognition result`);
        }
      } catch (error) {
        console.log(`  → Error: ${error.message}`);
      }
      console.log('');
    }

    // Test mode by specific ID
    console.log('🎯 Testing specific mode access:\n');
    const thinkingMode = internalModeService.getModeById('thinking');
    console.log(`Thinking mode: ${thinkingMode ? 'Found' : 'Not found'}`);
    if (thinkingMode) {
      console.log(`  - Name: ${thinkingMode.name}`);
      console.log(`  - Category: ${thinkingMode.category}`);
      console.log(`  - Keywords: ${thinkingMode.keywords ? thinkingMode.keywords.join(', ') : 'none'}`);
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
    console.error(error.stack);
  }
}

debugModes();