import React from 'react';
import { Box, Text } from 'ink';

interface Command {
  id: string;
  input: string;
  output: string;
  timestamp: Date;
  status: 'success' | 'error' | 'pending';
}

interface CommandHistoryProps {
  commands: Command[];
}

export const CommandHistory: React.FC<CommandHistoryProps> = ({ commands }) => {
  if (commands.length === 0) {
    return (
      <Box
        justifyContent="center"
        alignItems="center"
        flexGrow={1}
        borderStyle="round"
        borderColor="gray"
        padding={2}
      >
        <Box flexDirection="column" alignItems="center">
          <Text bold color="magenta">
            🌟 Welcome to MARIA CODE CLI! 🌟
          </Text>
          <Text color="gray">Start by typing a command below, or try:</Text>
          <Box marginTop={1} flexDirection="column">
            <Text color="cyan">• /help - Show available commands</Text>
            <Text color="cyan">• mc chat - Start AI chat session</Text>
            <Text color="cyan">• mc init - Initialize new project</Text>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      {commands.slice(-10).map((command) => (
        <Box key={command.id} flexDirection="column" marginBottom={1}>
          {/* Command Input */}
          <Box>
            <Text color="cyan" bold>
              ➤
            </Text>
            <Text color="white">{command.input}</Text>
            <Text color="gray" dimColor>
              {' '}
              ({command.timestamp.toLocaleTimeString()})
            </Text>
          </Box>

          {/* Command Output */}
          <Box
            borderStyle="round"
            borderColor={
              command.status === 'success' ? 'green' : command.status === 'error' ? 'red' : 'yellow'
            }
            padding={1}
            marginLeft={2}
            marginTop={1}
          >
            {command.status === 'pending' ? (
              <Box>
                <Text color="yellow">⏳ Processing...</Text>
              </Box>
            ) : (
              <Box flexDirection="column">
                {command.output.split('\n').map((line, index) => (
                  <Text key={index} color={command.status === 'error' ? 'red' : 'white'}>
                    {line}
                  </Text>
                ))}
              </Box>
            )}
          </Box>
        </Box>
      ))}
    </Box>
  );
};
