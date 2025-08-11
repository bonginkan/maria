import React from 'react';
import { Box, Text } from 'ink';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
}

interface MessageListProps {
  messages: Message[];
}

const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  return (
    <Box flexDirection="column">
      {messages.map((message: Message) => (
        <Box key={message.id} marginBottom={1}>
          {message.role === 'user' && (
            <Box>
              <Text color="yellow" bold>
                You:{' '}
              </Text>
              <Text>{message.content}</Text>
            </Box>
          )}
          {message.role === 'assistant' && (
            <Box>
              <Text color="cyan" bold>
                MARIA:{' '}
              </Text>
              <Text>{message.content}</Text>
            </Box>
          )}
          {message.role === 'system' && (
            <Box>
              <Text color="gray" italic>
                {message.content}
              </Text>
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
};

export default MessageList;
