#!/usr/bin/env node

/**
 * Test script for avatar command
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Testing Avatar Command Implementation\n');
console.log('=' .repeat(50));

// Test 1: Check if avatar.tsx exists and can be imported
console.log('\n📁 Test 1: Checking avatar.tsx file...');
try {
  const avatarPath = path.join(__dirname, 'dist', 'commands', 'avatar.js');
  console.log(`Looking for: ${avatarPath}`);
  const avatarModule = require(avatarPath);
  console.log('✅ Avatar module found:', Object.keys(avatarModule));
} catch (error) {
  console.log('❌ Avatar module not found in dist:', error.message);
  console.log('\n🔍 Checking source file...');
  const fs = require('fs');
  const srcPath = path.join(__dirname, 'src', 'commands', 'avatar.tsx');
  if (fs.existsSync(srcPath)) {
    console.log('✅ Source file exists at:', srcPath);
  } else {
    console.log('❌ Source file not found at:', srcPath);
  }
}

// Test 2: Check if avatar-animator.ts exists
console.log('\n📁 Test 2: Checking avatar-animator.ts service...');
try {
  const animatorPath = path.join(__dirname, 'dist', 'services', 'avatar-animator.js');
  console.log(`Looking for: ${animatorPath}`);
  const animatorModule = require(animatorPath);
  console.log('✅ Animator module found:', Object.keys(animatorModule));
} catch (error) {
  console.log('❌ Animator module not found:', error.message);
}

// Test 3: Check if avatar-dialogue.ts exists
console.log('\n📁 Test 3: Checking avatar-dialogue.ts service...');
try {
  const dialoguePath = path.join(__dirname, 'dist', 'services', 'avatar-dialogue.js');
  console.log(`Looking for: ${dialoguePath}`);
  const dialogueModule = require(dialoguePath);
  console.log('✅ Dialogue module found:', Object.keys(dialogueModule));
} catch (error) {
  console.log('❌ Dialogue module not found:', error.message);
}

// Test 4: Check slash-command-handler.ts for avatar command
console.log('\n📁 Test 4: Checking slash-command-handler for /avatar...');
try {
  const handlerPath = path.join(__dirname, 'dist', 'services', 'slash-command-handler.js');
  const fs = require('fs');
  if (fs.existsSync(handlerPath)) {
    const content = fs.readFileSync(handlerPath, 'utf8');
    if (content.includes('handleAvatar')) {
      console.log('✅ handleAvatar method found in slash-command-handler');
    } else {
      console.log('❌ handleAvatar method NOT found in slash-command-handler');
    }
    if (content.includes('avatar-interface')) {
      console.log('✅ avatar-interface component type found');
    } else {
      console.log('❌ avatar-interface component type NOT found');
    }
  }
} catch (error) {
  console.log('❌ Error checking handler:', error.message);
}

// Test 5: Check ChatInterface.tsx for avatar in supportedCommands
console.log('\n📁 Test 5: Checking ChatInterface for /avatar support...');
try {
  const chatInterfacePath = path.join(__dirname, 'dist', 'components', 'ChatInterface.js');
  const fs = require('fs');
  if (fs.existsSync(chatInterfacePath)) {
    const content = fs.readFileSync(chatInterfacePath, 'utf8');
    if (content.includes("'/avatar'")) {
      console.log('✅ /avatar found in supportedCommands');
    } else {
      console.log('❌ /avatar NOT found in supportedCommands');
    }
  }
} catch (error) {
  console.log('❌ Error checking ChatInterface:', error.message);
}

// Test 6: Check SlashCommandHandler.tsx component
console.log('\n📁 Test 6: Checking SlashCommandHandler component...');
try {
  const slashHandlerPath = path.join(__dirname, 'dist', 'components', 'SlashCommandHandler.js');
  const fs = require('fs');
  if (fs.existsSync(slashHandlerPath)) {
    const content = fs.readFileSync(slashHandlerPath, 'utf8');
    if (content.includes('AvatarInterface')) {
      console.log('✅ AvatarInterface import found');
    } else {
      console.log('❌ AvatarInterface import NOT found');
    }
    if (content.includes("command === '/avatar'")) {
      console.log('✅ /avatar command case found');
    } else {
      console.log('❌ /avatar command case NOT found');
    }
  }
} catch (error) {
  console.log('❌ Error checking SlashCommandHandler:', error.message);
}

// Test 7: Run the actual maria command
console.log('\n🚀 Test 7: Testing actual /avatar command execution...');
console.log('Starting MARIA CLI and sending /avatar command...\n');

const maria = spawn('node', [path.join(__dirname, 'bin', 'maria')], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';
let errorOutput = '';

maria.stdout.on('data', (data) => {
  output += data.toString();
  process.stdout.write(data);
});

maria.stderr.on('data', (data) => {
  errorOutput += data.toString();
  process.stderr.write(data);
});

// Send /avatar command after a delay
setTimeout(() => {
  console.log('\n📤 Sending: /avatar');
  maria.stdin.write('/avatar\n');
  
  // Check response after another delay
  setTimeout(() => {
    if (output.includes('Unknown command')) {
      console.log('\n❌ FAILED: /avatar shows as unknown command');
    } else if (output.includes('MARIA AVATAR INTERFACE') || output.includes('avatar')) {
      console.log('\n✅ SUCCESS: Avatar interface appears to be working');
    } else {
      console.log('\n⚠️  UNCLEAR: Could not determine if avatar command worked');
    }
    
    // Exit
    maria.stdin.write('\x03'); // Ctrl+C
    setTimeout(() => {
      maria.kill();
      process.exit(0);
    }, 500);
  }, 2000);
}, 2000);

// Summary after initial checks
setTimeout(() => {
  console.log('\n' + '=' .repeat(50));
  console.log('📊 Test Summary:');
  console.log('- Check the results above to identify issues');
  console.log('- The /avatar command should be properly registered');
  console.log('- All required files should be in the dist folder');
  console.log('=' .repeat(50));
}, 100);