import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import SlashCommandHandler from './SlashCommandHandler.js';
import MessageList from './MessageList.js';
import SOWReview from './SOWReview.js';
import TaskProgress from './TaskProgress.js';
import StepConfirmation from './StepConfirmation.js';
import { AIChatServiceV2, ChatContext } from '../services/ai-chat-service-v2.js';

interface ChatInterfaceProps {
  initialPrompt?: string;
  context: any; // ConversationContext
  router: any; // InteractiveRouter
  autoModeController?: any; // AutoModeController
  mode: any; // OperationMode
  projectPath: string;
}

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
  metadata?: {
    rtfAnalysis?: any;
    taskPlan?: any;
    sow?: any;
    executionId?: string;
    commandResult?: any;
    provider?: string;
    model?: string;
    streaming?: boolean;
  };
}

type ChatState =
  | 'input'
  | 'processing'
  | 'sow-review'
  | 'step-confirmation'
  | 'executing'
  | 'menu'
  | 'slash-command';

const ChatInterface: React.FC<ChatInterfaceProps> = ({ mode, projectPath }) => {
  const { exit } = useApp();
  const [state, setState] = useState<ChatState>('input');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentSOW, setCurrentSOW] = useState<any>(null);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [executionSteps] = useState<any[]>([]);
  const [currentSlashCommand, setCurrentSlashCommand] = useState<string | null>(null);
  const [slashCommandArgs, setSlashCommandArgs] = useState<string[]>([]);
  const [aiService] = useState(() => new AIChatServiceV2());
  const [streamingContent, setStreamingContent] = useState<string>('');

  useEffect(() => {
    // Initialize AI service
    aiService.initialize().catch((err) => {
      setError(`Failed to initialize AI service: ${err.message}`);
    });

    const welcome: Message = {
      id: Date.now().toString(),
      content: `Welcome to MARIA CODE Chat (Mode: ${mode?.name || 'chat'})\nProject: ${projectPath}\n\nHow can I help you today?`,
      role: 'system',
      timestamp: new Date(),
    };
    setMessages([welcome]);
  }, [mode, projectPath, aiService]);

  const handleInput = useCallback(
    async (value: string) => {
      if (!value.trim()) return;

      // Handle special commands
      if (value.startsWith('/')) {
        return handleSpecialCommand(value);
      }

      const userMessage: Message = {
        id: Date.now().toString(),
        content: value,
        role: 'user',
        timestamp: new Date(),
      };

      setMessages((prev: Message[]) => [...prev, userMessage]);
      setInputValue('');
      setState('processing');
      setIsLoading(true);
      setError(null);
      setStreamingContent('');

      try {
        // Create chat context
        const chatContext: ChatContext = {
          sessionId: `session-${Date.now()}`,
          projectRoot: projectPath,
          mode: mode?.name || 'chat',
          history: messages.map((m) => ({
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
            metadata: m.metadata,
          })),
        };

        // Process message with AI service
        const response = await aiService.processMessage(value, chatContext, true); // Enable streaming

        const assistantMessage: Message = {
          id: Date.now().toString(),
          content: '',
          role: 'assistant',
          timestamp: new Date(),
          metadata: response.message.metadata,
        };

        // Add empty message that will be filled by stream
        setMessages((prev: Message[]) => [...prev, assistantMessage]);

        // Handle streaming response
        if (response.stream) {
          let fullContent = '';
          for await (const chunk of response.stream) {
            fullContent += chunk;
            setStreamingContent(fullContent);

            // Update the last message with streaming content
            setMessages((prev: Message[]) => {
              const newMessages = [...prev];
              newMessages[newMessages.length - 1] = {
                ...assistantMessage,
                content: fullContent,
              };
              return newMessages;
            });
          }
          setStreamingContent('');
        } else {
          // Non-streaming response
          setMessages((prev: Message[]) => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = {
              ...assistantMessage,
              content: response.message.content,
            };
            return newMessages;
          });
        }

        // Check if response contains SOW data
        if (response.message.metadata?.type === 'sow') {
          // Parse SOW from response content
          const sowData = parseSowFromContent(response.message.content);
          if (sowData) {
            setCurrentSOW(sowData);
            setState('sow-review');
          } else {
            setState('input');
          }
        } else {
          setState('input');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setState('input');
      } finally {
        setIsLoading(false);
      }
    },
    [messages, mode, projectPath, aiService],
  );

  const parseSowFromContent = (content: string): any => {
    // Basic SOW parsing from markdown content
    // This is a simplified version - you might want to enhance this
    const lines = content.split('\n');
    const sow: any = {
      id: Date.now().toString(),
      title: '',
      description: '',
      tasks: [],
      estimatedDuration: '4 weeks',
    };

    let currentSection = '';
    for (const line of lines) {
      if (line.startsWith('# ')) {
        sow.title = line.substring(2).trim();
      } else if (line.startsWith('## Overview') || line.startsWith('## Description')) {
        currentSection = 'description';
      } else if (line.startsWith('## Deliverables') || line.startsWith('## Tasks')) {
        currentSection = 'tasks';
      } else if (currentSection === 'description' && line.trim()) {
        sow.description += line + '\n';
      } else if (currentSection === 'tasks' && line.startsWith('- ')) {
        sow.tasks.push({
          id: `task-${sow.tasks.length + 1}`,
          name: line.substring(2).trim(),
          description: line.substring(2).trim(),
          required: true,
          duration: '1 week',
        });
      }
    }

    return sow.title ? sow : null;
  };

  const handleSOWApproval = useCallback(
    async (approved: boolean, modifications?: any) => {
      if (!approved || !currentSOW) {
        setState('input');
        setCurrentSOW(null);
        return;
      }

      // Handle modifications if provided
      if (modifications && Object.keys(modifications).length > 0) {
        setIsLoading(true);
        try {
          // Process modifications
          const modifiedSOW = {
            ...currentSOW,
            ...modifications,
            id: Date.now().toString(), // New ID for modified version
          };

          setCurrentSOW(modifiedSOW);
          setState('sow-review');
          setIsLoading(false);

          const modificationMessage: Message = {
            id: Date.now().toString(),
            content:
              '✅ SOW has been updated with your modifications. Please review the changes below.',
            role: 'assistant',
            timestamp: new Date(),
          };

          setMessages((prev: Message[]) => [...prev, modificationMessage]);
          return;
        } catch {
          setError('Failed to apply modifications');
          setIsLoading(false);
          return;
        }
      }

      setState('executing');
      setIsLoading(true);

      try {
        const execId = `exec-${Date.now()}`;
        setExecutionId(execId);

        const executionMessage: Message = {
          id: Date.now().toString(),
          content: `✅ Execution started successfully!\n\nProject: ${currentSOW.title}\nEstimated Duration: ${currentSOW.estimatedDuration}\nTracking ID: ${execId}\n\nYou can monitor progress below.`,
          role: 'assistant',
          timestamp: new Date(),
        };

        setMessages((prev: Message[]) => [...prev, executionMessage]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start execution');
        setState('input');
      } finally {
        setIsLoading(false);
      }
    },
    [currentSOW, projectPath],
  );

  const handleExecutionComplete = useCallback(() => {
    setExecutionId(null);
    setState('menu');
  }, []);

  const handleSpecialCommand = useCallback(
    async (command: string) => {
      const [cmd, ...args] = command.slice(1).split(' ');

      const userMessage: Message = {
        id: Date.now().toString(),
        content: command,
        role: 'user',
        timestamp: new Date(),
      };

      setMessages((prev: Message[]) => [...prev, userMessage]);
      setInputValue('');

      // Handle model switching commands
      if (cmd === 'model') {
        const modelName = args.join(' ');
        if (modelName) {
          try {
            await aiService.switchModel(modelName);
            const info = aiService.getProviderInfo();
            const responseMessage: Message = {
              id: Date.now().toString(),
              content: `✅ Switched to model: ${info?.model} (Provider: ${info?.provider})`,
              role: 'system',
              timestamp: new Date(),
            };
            setMessages((prev: Message[]) => [...prev, responseMessage]);
          } catch (err) {
            const errorMessage: Message = {
              id: Date.now().toString(),
              content: `❌ Failed to switch model: ${err instanceof Error ? err.message : 'Unknown error'}`,
              role: 'system',
              timestamp: new Date(),
            };
            setMessages((prev: Message[]) => [...prev, errorMessage]);
          }
        } else {
          // Show current model info
          const info = aiService.getProviderInfo();
          const infoMessage: Message = {
            id: Date.now().toString(),
            content: `Current Model: ${info?.model || 'Not initialized'}\nProvider: ${info?.provider || 'Not initialized'}\n\nAvailable providers: ${info?.available ? JSON.stringify(info.available, null, 2) : 'None'}`,
            role: 'system',
            timestamp: new Date(),
          };
          setMessages((prev: Message[]) => [...prev, infoMessage]);
        }
        return;
      }

      // Handle other slash commands
      if (cmd && ['exit', 'quit', 'q'].includes(cmd)) {
        exit();
        return;
      }

      if (cmd === 'clear') {
        setMessages([]);
        setState('input');
        return;
      }

      if (cmd === 'help') {
        const helpMessage: Message = {
          id: Date.now().toString(),
          content: `Available commands:
/model [name] - Switch AI model or show current model
/clear - Clear chat history
/help - Show this help message
/exit, /quit, /q - Exit the application

Available AI Models:
- GPT-5 (OpenAI)
- Claude Opus 4.1 (Anthropic)
- Gemini 2.5 Pro (Google)
- Grok-4 (Groq)
...and more!`,
          role: 'system',
          timestamp: new Date(),
        };
        setMessages((prev: Message[]) => [...prev, helpMessage]);
        return;
      }

      // Pass to slash command handler for other commands
      if (cmd) {
        setCurrentSlashCommand(cmd);
        setSlashCommandArgs(args);
        setState('slash-command');
      }
    },
    [aiService, exit],
  );

  const handleSlashCommandComplete = useCallback(() => {
    setCurrentSlashCommand(null);
    setSlashCommandArgs([]);
    setState('input');
  }, []);

  const handleKeyPress = useCallback(
    (key: string) => {
      if (state !== 'menu') return;

      if (key === 'q') {
        exit();
      } else if (key === 'n') {
        setState('input');
        setCurrentSOW(null);
        setExecutionId(null);
      } else if (key === 'h') {
        const historyMessage: Message = {
          id: Date.now().toString(),
          content: 'Chat history displayed above.',
          role: 'system',
          timestamp: new Date(),
        };
        setMessages((prev: Message[]) => [...prev, historyMessage]);
      }
    },
    [state, exit],
  );

  useInput((input, key) => {
    if (key.escape) {
      setState('input');
      setCurrentSOW(null);
    } else {
      handleKeyPress(input);
    }
  });

  // Render based on state
  if (state === 'slash-command' && currentSlashCommand) {
    return (
      <SlashCommandHandler
        command={currentSlashCommand}
        args={slashCommandArgs}
        onExit={handleSlashCommandComplete}
      />
    );
  }

  if (state === 'sow-review' && currentSOW) {
    return <SOWReview sow={currentSOW} onApprove={handleSOWApproval} />;
  }

  if (state === 'step-confirmation' && executionSteps.length > 0) {
    return (
      <StepConfirmation
        steps={executionSteps}
        onConfirm={() => {
          // Handle step confirmation
          setState('executing');
        }}
        onCancel={() => setState('input')}
      />
    );
  }

  if (state === 'executing' && executionId) {
    return <TaskProgress executionId={executionId} onComplete={handleExecutionComplete} />;
  }

  if (state === 'menu') {
    const menuItems = [
      { label: '📝 New Conversation (n)', value: 'new' },
      { label: '📚 View History (h)', value: 'history' },
      { label: '🚪 Exit (q)', value: 'exit' },
    ];

    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text color="green">✅ Task completed successfully!</Text>
        </Box>
        <SelectInput
          items={menuItems}
          onSelect={(item) => {
            if (item.value === 'exit') {
              exit();
            } else if (item.value === 'new') {
              setState('input');
              setCurrentSOW(null);
              setExecutionId(null);
            } else if (item.value === 'history') {
              handleKeyPress('h');
            }
          }}
        />
      </Box>
    );
  }

  // Default input state
  return (
    <Box flexDirection="column" height="100%">
      <MessageList messages={messages} />

      {error && (
        <Box marginY={1}>
          <Text color="red">❌ Error: {error}</Text>
        </Box>
      )}

      <Box marginTop={1}>
        {isLoading ? (
          <Box>
            <Text color="cyan">
              <Spinner type="dots" /> {streamingContent ? 'Streaming response...' : 'Processing...'}
            </Text>
          </Box>
        ) : (
          <Box>
            <Text color="cyan">{'> '}</Text>
            <TextInput
              value={inputValue}
              onChange={setInputValue}
              onSubmit={handleInput}
              placeholder="Type your message or /help for commands..."
            />
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ChatInterface;
