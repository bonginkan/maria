#!/usr/bin/env node

import { spawn } from 'child_process';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

async function testMariaStartup() {
  console.log('🧪 Testing MARIA CLI with new startup system...\n');
  
  return new Promise((resolve) => {
    console.log('Starting: ./bin/maria (will timeout after 15 seconds)');
    console.log('Expected: Should show new startup screen with progress bars\n');
    
    const startTime = Date.now();
    const child = spawn('./bin/maria', [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    let output = '';
    let timeoutReached = false;

    // Capture stdout
    child.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stdout.write(text);
    });

    // Capture stderr
    child.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      process.stderr.write(text);
    });

    // Timeout after 15 seconds
    const timeout = setTimeout(() => {
      timeoutReached = true;
      console.log('\n⏰ Timeout reached - stopping process...');
      child.kill('SIGTERM');
      
      setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGKILL');
        }
      }, 2000);
    }, 15000);

    child.on('close', (code) => {
      clearTimeout(timeout);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`\n📊 Process completed in ${duration}ms`);
      
      // Check if the new startup system was used
      const hasWelcomeBanner = output.includes('MARIA CODE') || output.includes('AI-Powered Development Platform');
      const hasProgressBars = output.includes('Initializing AI Services') || output.includes('[');
      const hasServiceStatus = output.includes('LM Studio') || output.includes('Ollama') || output.includes('vLLM');
      
      console.log('\n📋 Startup System Analysis:');
      console.log('─'.repeat(40));
      console.log(`${hasWelcomeBanner ? '✅' : '❌'} Welcome banner displayed`);
      console.log(`${hasProgressBars ? '✅' : '❌'} Progress indicators shown`);
      console.log(`${hasServiceStatus ? '✅' : '❌'} Service status displayed`);
      console.log(`${timeoutReached ? '⏰' : '✅'} Process behavior: ${timeoutReached ? 'Timeout (expected for interactive)' : 'Clean exit'}`);
      
      if (hasWelcomeBanner && hasServiceStatus) {
        console.log('\n🎉 SUCCESS: New startup system is working!');
      } else {
        console.log('\n❌ ISSUE: New startup system not fully functional');
      }
      
      resolve({
        duration,
        hasWelcomeBanner,
        hasProgressBars,
        hasServiceStatus,
        timeoutReached,
        output
      });
    });

    child.on('error', (error) => {
      clearTimeout(timeout);
      console.error('❌ Error running maria:', error.message);
      resolve({
        error: error.message,
        duration: Date.now() - startTime
      });
    });
  });
}

// Run the test
testMariaStartup().catch(console.error);