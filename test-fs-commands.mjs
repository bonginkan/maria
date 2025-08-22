import { fileSystemCommands } from './dist/cli.js';

async function testFileSystemCommands() {
  console.log('Testing MARIA File System Commands...\n');

  try {
    // Test ls command
    console.log('Testing ls command:');
    const lsResult = await fileSystemCommands.executeCommand('ls', ['.']);
    console.log(lsResult.success ? 'SUCCESS' : 'FAILED');
    if (lsResult.success && lsResult.message) {
      console.log(lsResult.message.substring(0, 200) + '...\n');
    }

    // Test pwd command
    console.log('Testing pwd command:');
    const pwdResult = await fileSystemCommands.executeCommand('pwd', []);
    console.log(pwdResult.success ? 'SUCCESS' : 'FAILED');
    console.log(pwdResult.message + '\n');

    // Test find command
    console.log('Testing find command:');
    const findResult = await fileSystemCommands.executeCommand('find', ['.', '-name', '*.md']);
    console.log(findResult.success ? 'SUCCESS' : 'FAILED');
    if (findResult.success && findResult.message && findResult.message !== 'No files found') {
      console.log('Found files:', findResult.message.split('\n').length - 1 + ' files\n');
    }

    console.log('✅ File system commands integration test completed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testFileSystemCommands();