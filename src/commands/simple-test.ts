import { Command } from 'commander';
import React from 'react';
import { render, Text, Box } from 'ink';

interface TestComponentProps {}

const TestComponent: React.FC<TestComponentProps> = () => {
  return React.createElement(Box, { flexDirection: 'column' },
    React.createElement(Text, { color: 'cyan', bold: true }, '🎉 MARIA CODE CLI Test'),
    React.createElement(Text, { color: 'green' }, '✅ CLI is working correctly!'),
    React.createElement(Text, { color: 'gray' }, 'Version: 1.0.0'),
    React.createElement(Text, { color: 'yellow' }, 'Press Ctrl+C to exit')
  );
};

export default function simpleTestCommand(program: Command) {
  program
    .command('simple-test')
    .description('Simple CLI test without complex dependencies')
    .action(async () => {
      console.log('Starting MARIA CODE CLI test...');
      
      const { waitUntilExit } = render(React.createElement(TestComponent));
      
      setTimeout(() => {
        console.log('Test completed successfully!');
        process.exit(0);
      }, 3000);
      
      await waitUntilExit();
    });
}