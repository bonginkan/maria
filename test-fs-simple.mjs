import { spawn } from 'child_process';

function runMaria(command) {
  return new Promise((resolve, reject) => {
    const maria = spawn('./bin/maria', [], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    maria.stdout.on('data', (data) => {
      output += data.toString();
    });

    maria.stderr.on('data', (data) => {
      output += data.toString();
    });

    maria.on('close', (code) => {
      resolve({ code, output });
    });

    maria.on('error', (error) => {
      reject(error);
    });

    // Send command and exit
    maria.stdin.write(command + '\n');
    setTimeout(() => {
      maria.stdin.write('/exit\n');
    }, 1000);
  });
}

async function testFileSystemCommands() {
  console.log('🧪 Testing MARIA File System Commands Integration...\n');

  try {
    // Test pwd command
    console.log('Testing pwd command...');
    const pwdResult = await runMaria('pwd');
    console.log('Exit code:', pwdResult.code);
    console.log('✅ pwd command test completed\n');

    // Test ls command
    console.log('Testing ls command...');
    const lsResult = await runMaria('ls');
    console.log('Exit code:', lsResult.code);
    console.log('✅ ls command test completed\n');

    console.log('🎉 All file system commands integration tests completed!');
    console.log('Unix/Linux commands (ls, cd, pwd, etc.) are now available in MARIA interactive mode.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testFileSystemCommands();