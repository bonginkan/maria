import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
// import { SlashCommandHandler } from '../services/slash-command-handler.js';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
}

const FULL_COMMAND_LIST = [
  { cmd: '/help', desc: 'Show all 40 available commands' },
  { cmd: '/code', desc: 'AI code generation' },
  { cmd: '/test', desc: 'AI-powered test generation' },
  { cmd: '/review', desc: 'Code review' },
  { cmd: '/init', desc: 'Generate MARIA.md design document' },
  { cmd: '/status', desc: 'Display system status' },
  { cmd: '/model', desc: 'Select AI model' },
  { cmd: '/config', desc: 'Configuration panel' },
  { cmd: '/video', desc: 'AI video generation' },
  { cmd: '/image', desc: 'AI image generation' },
  { cmd: '/build', desc: 'Build project' },
  { cmd: '/deploy', desc: 'Deploy application' },
  { cmd: '/clear', desc: 'Clear conversation context' },
  { cmd: '/exit', desc: 'Exit MARIA CLI' },
  // Additional 26 commands
  { cmd: '/login', desc: 'Sign in to account' },
  { cmd: '/logout', desc: 'Sign out from account' },
  { cmd: '/mode', desc: 'Switch operation mode' },
  { cmd: '/upgrade', desc: 'Upgrade plan' },
  { cmd: '/permissions', desc: 'Manage permissions' },
  { cmd: '/hooks', desc: 'Hook configuration' },
  { cmd: '/doctor', desc: 'System diagnostics' },
  { cmd: '/terminal-setup', desc: 'Terminal setup' },
  { cmd: '/add-dir', desc: 'Add working directory' },
  { cmd: '/memory', desc: 'Edit memory settings' },
  { cmd: '/export', desc: 'Export conversation' },
  { cmd: '/agents', desc: 'Manage AI agents' },
  { cmd: '/mcp', desc: 'MCP server management' },
  { cmd: '/compact', desc: 'Compact conversation' },
  { cmd: '/resume', desc: 'Resume previous session' },
  { cmd: '/cost', desc: 'Show usage costs' },
  { cmd: '/pr-comments', desc: 'Get PR comments' },
  { cmd: '/bug', desc: 'Report a bug' },
  { cmd: '/release-notes', desc: 'Generate release notes' },
  { cmd: '/vim', desc: 'Toggle Vim mode' },
  { cmd: '/migrate-installer', desc: 'Migrate installation' },
  { cmd: '/version', desc: 'Show version info' },
  { cmd: '/hotkey', desc: 'Manage hotkeys' },
  { cmd: '/alias', desc: 'Configure aliases' },
  { cmd: '/template', desc: 'Template management' },
  { cmd: '/workflow', desc: 'Execute workflow' },
  { cmd: '/batch', desc: 'Batch processing' },
  { cmd: '/debug', desc: 'Debug mode' },
];

export const InteractiveChatApp: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingTimeout, setProcessingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [showFullCommands, setShowFullCommands] = useState(false);

  useEffect(() => {
    const welcome: Message = {
      id: Date.now().toString(),
      content:
        'Welcome to MARIA CODE CLI!\n\n40 Slash Commands Available - Type /help to see all\nType anytime to interrupt current processing\n\nYou can:\n• Type naturally for AI assistance\n• Use slash commands for specific actions\n• Interrupt anytime with new instructions\n• Examples: /code, /test, /review, /video, /image',
      role: 'system',
      timestamp: new Date(),
    };
    setMessages([welcome]);
  }, []);

  // Handle Ctrl+R for toggling command list
  useInput((input, key) => {
    if (key.ctrl && input === 'r') {
      setShowFullCommands(!showFullCommands);
    }
    if (key.escape) {
      process.exit(0);
    }
  });

  const interruptProcessing = useCallback(() => {
    if (processingTimeout) {
      clearTimeout(processingTimeout);
      setProcessingTimeout(null);
    }
    setIsProcessing(false);
  }, [processingTimeout]);

  const isAdditionalInfo = (input: string): boolean => {
    const additionalKeywords = [
      'also',
      'additionally',
      'and',
      'plus',
      'with',
      'また',
      'さらに',
      'そして',
      '追加で',
    ];
    const lowerInput = input.toLowerCase();
    return additionalKeywords.some((keyword) => lowerInput.includes(keyword));
  };

  const handleSubmit = useCallback(
    async (value: string) => {
      if (!value.trim()) return;

      // Handle interrupt if processing
      if (isProcessing) {
        interruptProcessing();

        const interruptMsg: Message = {
          id: Date.now().toString(),
          content: '[Interrupted - Processing new request]',
          role: 'system',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, interruptMsg]);

        // Determine if it's additional info or override
        const isAdditional = isAdditionalInfo(value);
        const strategyMsg: Message = {
          id: (Date.now() + 1).toString(),
          content: isAdditional
            ? '[Treating as additional information]'
            : '[Overriding previous request]',
          role: 'system',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, strategyMsg]);
      }

      const userMessage: Message = {
        id: Date.now().toString(),
        content: value,
        role: 'user',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setInputValue('');

      // Handle special commands
      if (value.startsWith('/')) {
        const [cmd] = value.slice(1).split(' ');

        if (cmd === 'clear') {
          setMessages([]);
          return;
        }

        if (cmd === 'exit') {
          process.exit(0);
        }

        if (cmd === 'help') {
          const helpMessage: Message = {
            id: Date.now().toString(),
            content: `MARIA CODE - Available Commands
────────────────────────────────────────
${FULL_COMMAND_LIST.slice(0, 14)
  .map((c) => `${c.cmd.padEnd(20)} ${c.desc}`)
  .join('\n')}

+ 26 more slash commands available

You can also type natural language requests

Interrupt Feature:
• Type anytime during processing to interrupt
• New requests override previous ones
• Additional info is automatically detected`,
            role: 'assistant',
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, helpMessage]);
          return;
        }
      }

      // Simulate AI processing
      setIsProcessing(true);
      const timeout = setTimeout(() => {
        const response: Message = {
          id: Date.now().toString(),
          content: `Processing: ${value}\n\n[AI response would appear here]`,
          role: 'assistant',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, response]);
        setIsProcessing(false);
      }, 2000);
      setProcessingTimeout(timeout);
    },
    [isProcessing, interruptProcessing],
  );

  return (
    <Box flexDirection="column" minHeight={24}>
      {/* ASCII Art Logo in Pink */}
      <Box borderStyle="double" borderColor="magenta" padding={1} marginBottom={1}>
        <Box flexDirection="column">
          <Text color="magenta" bold>
            {'███╗   ███╗ █████╗ ██████╗ ██╗ █████╗ '}
          </Text>
          <Text color="magenta" bold>
            {'████╗ ████║██╔══██╗██╔══██╗██║██╔══██╗'}
          </Text>
          <Text color="magenta" bold>
            {'██╔████╔██║███████║██████╔╝██║███████║'}
          </Text>
          <Text color="magenta" bold>
            {'██║╚██╔╝██║██╔══██║██╔══██╗██║██╔══██║'}
          </Text>
          <Text color="magenta" bold>
            {'██║ ╚═╝ ██║██║  ██║██║  ██║██║██║  ██║'}
          </Text>
          <Text color="magenta" bold>
            {'╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═╝'}
          </Text>
          <Box marginTop={1}>
            <Text color="magenta" bold>
              {'█████╗ █████╗ ██████╗ ███████╗'}
            </Text>
          </Box>
          <Text color="magenta" bold>
            {'██╔══██╗██╔══██╗██╔══██╗██╔════╝'}
          </Text>
          <Text color="magenta" bold>
            {'██║  ╚═╝██║  ██║██║  ██║█████╗  '}
          </Text>
          <Text color="magenta" bold>
            {'██║  ██╗██║  ██║██║  ██║██╔══╝  '}
          </Text>
          <Text color="magenta" bold>
            {'╚█████╔╝╚█████╔╝██████╔╝███████╗'}
          </Text>
          <Text color="magenta" bold>
            {' ╚════╝  ╚════╝ ╚═════╝ ╚══════╝'}
          </Text>
          <Box marginTop={1} justifyContent="center">
            <Text color="magenta" dimColor>
              AI-Powered Development Platform
            </Text>
          </Box>
          <Box justifyContent="center">
            <Text color="magenta" dimColor>
              v1.0.0 | TypeScript Monorepo
            </Text>
          </Box>
          <Box marginTop={1} justifyContent="center">
            <Text color="magenta" dimColor>
              (c) 2025 Bonginkan Inc.
            </Text>
          </Box>
        </Box>
      </Box>

      {/* Welcome Message */}
      <Box marginBottom={1}>
        <Text color="magenta" bold>
          Welcome to MARIA CODE CLI!
        </Text>
      </Box>
      <Box marginBottom={1}>
        <Text color="yellow">How can I help you today?</Text>
      </Box>
      <Box marginBottom={1} flexDirection="column">
        <Text dimColor>Just type naturally:</Text>
        <Text color="green">• "Create a REST API for user management"</Text>
        <Text color="green">• "Help me design an auto-pilot software system"</Text>
        <Text color="green">• "Debug this TypeScript error"</Text>
      </Box>

      {/* Messages */}
      <Box flexDirection="column" flexGrow={1} marginY={1}>
        {messages.slice(-5).map((msg) => (
          <Box key={msg.id} marginBottom={1}>
            {msg.role === 'user' && (
              <Text color="green">
                {'> '}
                {msg.content}
              </Text>
            )}
            {msg.role === 'assistant' && <Text color="cyan">{msg.content}</Text>}
            {msg.role === 'system' &&
              (msg.content.startsWith('Welcome to MARIA CODE CLI!') ? (
                <Box flexDirection="column">
                  <Text color="magenta" bold>
                    Welcome to MARIA CODE CLI!
                  </Text>
                  <Text color="yellow">{msg.content.split('\n').slice(1).join('\n')}</Text>
                </Box>
              ) : (
                <Text color="yellow">{msg.content}</Text>
              ))}
          </Box>
        ))}
        {isProcessing && (
          <Box>
            <Text color="cyan">
              <Spinner type="dots" /> Thinking...
            </Text>
          </Box>
        )}
      </Box>

      {/* Command List Toggle */}
      {showFullCommands && (
        <Box borderStyle="single" borderColor="magenta" padding={1} marginBottom={1}>
          <Box flexDirection="column">
            <Text color="magenta" bold>
              {'🤖 MARIA CODE - Available Commands'}
            </Text>
            <Text color="gray">{'─'.repeat(40)}</Text>
            {FULL_COMMAND_LIST.map((cmd, idx) => (
              <Text key={idx} color={idx % 2 === 0 ? 'cyan' : 'white'}>
                <Text color="magenta">{cmd.cmd.padEnd(20)}</Text>
                <Text>{cmd.desc}</Text>
              </Text>
            ))}
            <Box marginTop={1}>
              <Text color="yellow" bold>
                {'💡 You can also type natural language requests!'}
              </Text>
            </Box>
            <Text color="green"> Example: "Create a React component for user profile"</Text>
          </Box>
        </Box>
      )}

      {/* Input */}
      <Box marginTop={1}>
        <Box marginRight={1}>
          <Text color="magenta">{'─ Input ─' + '─'.repeat(65)}</Text>
        </Box>
      </Box>
      <Box>
        <Box marginRight={1}>
          <Text color="magenta">{'> '}</Text>
        </Box>
        <TextInput
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSubmit}
          placeholder={isProcessing ? 'Type to interrupt...' : '/model'}
        />
      </Box>

      {/* Footer */}
      <Box marginTop={1} justifyContent="center">
        <Text dimColor>
          Press Ctrl+R to {showFullCommands ? 'hide' : 'show'} all commands • Esc to exit
        </Text>
      </Box>
    </Box>
  );
};
