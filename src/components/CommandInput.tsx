import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface CommandInputProps {
  onSubmit: (command: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const CommandInput: React.FC<CommandInputProps> = ({ 
  onSubmit, 
  disabled = false,
  placeholder = "Enter command..."
}) => {
  const [value, setValue] = useState('');

  const handleSubmit = (input: string) => {
    if (input.trim() && !disabled) {
      onSubmit(input.trim());
      setValue('');
    }
  };

  return (
    <Box borderStyle="round" borderColor="cyan" padding={1}>
      <Box flexDirection="column" width="100%">
        <Box marginBottom={1}>
          <Text bold color="cyan">
            💻 MARIA Shell
          </Text>
        </Box>
        
        <Box>
          <Text color="cyan">➤ </Text>
          {disabled ? (
            <Box>
              <Text color="gray">{value}</Text>
              <Text color="yellow"> [Processing...]</Text>
            </Box>
          ) : (
            <TextInput
              value={value}
              onChange={setValue}
              onSubmit={handleSubmit}
              placeholder={placeholder}
            />
          )}
        </Box>
        
        <Box marginTop={1}>
          <Text color="gray" dimColor>
            {disabled 
              ? '⏳ Processing command...' 
              : '💡 Type /help for commands, mc <command> for tools, or chat naturally'
            }
          </Text>
        </Box>
      </Box>
    </Box>
  );
};