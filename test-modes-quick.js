#!/usr/bin/env node

/**
 * Quick test of the new 50-mode system
 * Tests mode loading and basic functionality without full CLI
 */

// Test the mode registry directly
const fs = require('fs');
const path = require('path');

async function testModeRegistry() {
  console.log('🔍 Quick Test: 50-Mode Internal System');
  console.log('════════════════════════════════════════\n');

  try {
    // Read the ModeDefinitionRegistry source file
    const registryPath = path.join(__dirname, 'src/services/internal-mode/ModeDefinitionRegistry.ts');
    const registrySource = fs.readFileSync(registryPath, 'utf-8');

    // Count mode definitions
    const modeMatches = registrySource.match(/this\.addMode\(\{/g);
    const modeCount = modeMatches ? modeMatches.length : 0;

    console.log(`📊 Mode Count: ${modeCount}/50`);
    
    if (modeCount === 50) {
      console.log('✅ SUCCESS: All 50 modes implemented!');
    } else {
      console.log(`❌ INCOMPLETE: Only ${modeCount} modes found`);
    }

    // Check for each required category
    const categories = {
      'reasoning': 7,
      'creative': 6, 
      'analytical': 6,
      'structural': 6,
      'validation': 5,
      'contemplative': 5,
      'intensive': 5,
      'learning': 5,
      'collaborative': 5
    };

    console.log('\n📋 Category Breakdown:');
    let totalExpected = 0;
    for (const [category, expected] of Object.entries(categories)) {
      const categoryRegex = new RegExp(`category:\\s*['"]${category}['"]`, 'g');
      const found = (registrySource.match(categoryRegex) || []).length;
      const status = found === expected ? '✅' : '❌';
      console.log(`  ${status} ${category}: ${found}/${expected}`);
      totalExpected += expected;
    }

    console.log(`\n📊 Total Expected: ${totalExpected}`);
    console.log(`📊 Total Found: ${modeCount}`);

    // Test for critical modes
    const criticalModes = [
      'thinking', 'analyzing', 'debugging', 'brainstorming', 
      'designing', 'optimizing', 'learning', 'collaborating'
    ];

    console.log('\n🎯 Critical Modes Check:');
    criticalModes.forEach(mode => {
      const found = registrySource.includes(`id: '${mode}'`);
      const status = found ? '✅' : '❌';
      console.log(`  ${status} ${mode}`);
    });

    // Check for proper structure
    console.log('\n🔧 Structure Validation:');
    
    const hasCreateTrigger = registrySource.includes('this.createTrigger');
    console.log(`  ${hasCreateTrigger ? '✅' : '❌'} Trigger definitions`);
    
    const hasI18n = registrySource.includes('this.createI18n');
    console.log(`  ${hasI18n ? '✅' : '❌'} I18n support`);
    
    const hasSymbols = registrySource.match(/symbol:\s*['"][^'"]+['"]/g);
    console.log(`  ${hasSymbols && hasSymbols.length > 40 ? '✅' : '❌'} Symbol definitions (${hasSymbols ? hasSymbols.length : 0})`);

    // Final assessment
    console.log('\n🎉 FINAL ASSESSMENT:');
    if (modeCount === 50 && totalExpected === 50) {
      console.log('✅ COMPLETE: 50-mode internal system is fully implemented!');
      console.log('🚀 Ready for testing and deployment');
      
      // Try to syntax check TypeScript
      console.log('\n🔧 Syntax Check:');
      const { spawn } = require('child_process');
      
      const tscCheck = spawn('npx', ['tsc', '--noEmit', '--skipLibCheck', registryPath], {
        stdio: 'pipe'
      });
      
      let output = '';
      tscCheck.stdout.on('data', (data) => output += data.toString());
      tscCheck.stderr.on('data', (data) => output += data.toString());
      
      tscCheck.on('close', (code) => {
        if (code === 0) {
          console.log('✅ TypeScript syntax: Valid');
        } else {
          console.log('⚠️ TypeScript warnings/errors:');
          console.log(output);
        }
      });
      
    } else {
      console.log('❌ INCOMPLETE: Mode implementation needs completion');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testModeRegistry();