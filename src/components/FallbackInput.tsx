import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { createInterface } from 'readline';

interface FallbackInputProps {
  onSubmit: (command: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const FallbackInput: React.FC<FallbackInputProps> = ({ 
  onSubmit, 
  disabled = false,
  placeholder = "Enter command..."
}) => {
  const [currentInput, setCurrentInput] = useState('');
  const [isWaiting, setIsWaiting] = useState(false);

  useEffect(() => {
    if (disabled) return;

    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '➤ '
    });

    const handleLine = (input: string) => {
      if (input.trim()) {
        setCurrentInput(input.trim());
        onSubmit(input.trim());
        setIsWaiting(true);
        
        // Clear input after submission
        setTimeout(() => {
          setCurrentInput('');
          setIsWaiting(false);
          rl.prompt();
        }, 100);
      } else {
        rl.prompt();
      }
    };

    rl.on('line', handleLine);
    rl.prompt();

    return () => {
      rl.close();
    };
  }, [onSubmit, disabled]);

  return (
    <Box borderStyle="round" borderColor="cyan" padding={1}>
      <Box flexDirection="column" width="100%">
        <Box marginBottom={1}>
          <Text bold color="cyan">
            💻 MARIA Shell (Fallback Mode)
          </Text>
        </Box>
        
        <Box>
          <Text color="cyan">➤ </Text>
          {isWaiting ? (
            <Text color="yellow">[Processing...] {currentInput}</Text>
          ) : (
            <Text color="gray">{placeholder}</Text>
          )}
        </Box>
        
        <Box marginTop={1}>
          <Text color="gray" dimColor>
            {disabled 
              ? '⏳ Processing command...' 
              : '💡 Type commands and press Enter (fallback mode - Ink raw mode not supported)'
            }
          </Text>
        </Box>
      </Box>
    </Box>
  );
};