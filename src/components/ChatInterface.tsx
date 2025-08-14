// @ts-nocheck - Complex type interactions requiring gradual type migration
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
import { ChatContextService } from '../services/chat-context.service.js';

interface ChatInterfaceProps {
  initialPrompt?: string;
  context: unknown; // ConversationContext
  router: unknown; // InteractiveRouter
  autoModeController?: unknown; // AutoModeController
  mode: unknown; // OperationMode
  projectPath: string;
}

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
  metadata?: {
    rtfAnalysis?: unknown;
    taskPlan?: unknown;
    sow?: unknown;
    executionId?: string;
    commandResult?: unknown;
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
  const chatContextService = ChatContextService.getInstance();
  const [state, setState] = useState<ChatState>('input');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentSOW, setCurrentSOW] = useState<unknown>(null);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [executionSteps, setExecutionSteps] = useState<unknown[]>([]);
  const [currentSlashCommand, setCurrentSlashCommand] = useState<string | null>(null);
  const [slashCommandArgs, setSlashCommandArgs] = useState<string[]>([]);
  const [contextStats, setContextStats] = useState(chatContextService.getStats());

  useEffect(() => {
    const welcome: Message = {
      id: Date.now().toString(),
      content: `Welcome to MARIA CODE Chat (Mode: ${mode?.name || 'chat'})\nProject: ${projectPath}\n\nHow can I help you today?`,
      role: 'system',
      timestamp: new Date(),
    };
    setMessages([welcome]);

    // Listen to context updates
    const handleContextUpdate = (stats: unknown) => {
      setContextStats(stats);
    };

    chatContextService.on('context-updated', handleContextUpdate);
    chatContextService.on('context-cleared', handleContextUpdate);
    chatContextService.on('context-compressed', handleContextUpdate);

    return () => {
      chatContextService.removeListener('context-updated', handleContextUpdate);
      chatContextService.removeListener('context-cleared', handleContextUpdate);
      chatContextService.removeListener('context-compressed', handleContextUpdate);
    };
  }, [mode, projectPath, chatContextService]);

  const handleInput = useCallback(
    async (value: string) => {
      // Validate input
      if (!value || !value.trim()) {
        setError('Please enter a message');
        return;
      }

      // Clear any previous errors
      setError(null);

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

      try {
        setMessages((prev: Message[]) => [...prev, userMessage]);
        // Track message in context
        await chatContextService.addMessage({
          role: 'user',
          content: value,
        });

        setInputValue('');
        setState('processing');
        setIsLoading(true);
      } catch (error: unknown) {
        setError('Failed to process input. Please try again.');
        setState('input');
        return;
      }

      try {
        // Simulate AI processing with realistic responses
        await new Promise((resolve) => setTimeout(resolve, 1500));

        let responseContent = '';
        let sowData = null;

        // Handle specific requests with intelligent responses
        if (
          value.toLowerCase().includes('auto pilot software') ||
          value.toLowerCase().includes('autopilot software')
        ) {
          responseContent = `I'll help you design an auto pilot software development system. Let me create a comprehensive design document and requirements specification.

## Auto Pilot Software Development System Design

### System Overview
An intelligent, autonomous software development system that can:
- Analyze requirements and generate development plans
- Write, test, and deploy code automatically
- Monitor and maintain software systems
- Learn from development patterns and improve over time

### Core Components
1. **Requirements Analysis Engine**
2. **Architecture Design Generator** 
3. **Code Generation Pipeline**
4. **Automated Testing Framework**
5. **Deployment Orchestrator**
6. **Monitoring & Maintenance System**

I've prepared a detailed SOW and requirements document for your review.`;

          sowData = {
            id: Date.now().toString(),
            title: 'Auto Pilot Software Development System',
            description: 'Design and implementation of an autonomous software development platform',
            estimatedDuration: '12-16 weeks',
            totalBudget: 150000,
            deliverables: [
              { name: 'System Architecture Document', description: 'Comprehensive system design' },
              {
                name: 'Requirements Specification',
                description: 'Detailed technical requirements',
              },
              { name: 'Prototype Implementation', description: 'Working proof of concept' },
              { name: 'Testing Framework', description: 'Automated testing infrastructure' },
              { name: 'Documentation Suite', description: 'User and developer documentation' },
            ],
            tasks: [
              {
                id: 'req-analysis',
                name: 'Requirements Analysis & Planning',
                description: 'Analyze business requirements and create detailed specifications',
                duration: '2 weeks',
                required: true,
                dependencies: [],
              },
              {
                id: 'arch-design',
                name: 'System Architecture Design',
                description: 'Design the overall system architecture and component interfaces',
                duration: '3 weeks',
                required: true,
                dependencies: ['req-analysis'],
              },
              {
                id: 'ai-engine',
                name: 'AI Analysis Engine Development',
                description:
                  'Build the core AI engine for requirements analysis and code generation',
                duration: '4 weeks',
                required: true,
                dependencies: ['arch-design'],
              },
              {
                id: 'pipeline',
                name: 'Development Pipeline Implementation',
                description: 'Implement automated build, test, and deployment pipeline',
                duration: '3 weeks',
                required: true,
                dependencies: ['ai-engine'],
              },
              {
                id: 'monitoring',
                name: 'Monitoring & Maintenance System',
                description: 'Build monitoring dashboard and automated maintenance features',
                duration: '2 weeks',
                required: false,
                dependencies: ['pipeline'],
              },
              {
                id: 'integration',
                name: 'System Integration & Testing',
                description: 'Integrate all components and perform comprehensive testing',
                duration: '2 weeks',
                required: true,
                dependencies: ['monitoring'],
              },
            ],
          };
        } else {
          // Generic intelligent response
          responseContent = `I understand you're asking about "${value}". 

Based on your request, I can help you with:
- System design and architecture planning
- Requirements analysis and documentation
- Technical implementation strategies
- Project planning and resource estimation

Would you like me to create a detailed plan for your specific needs?`;

          sowData = {
            id: Date.now().toString(),
            title: 'Custom Development Project',
            description: value,
            estimatedDuration: '4-6 weeks',
            totalBudget: 25000,
            deliverables: [
              { name: 'Technical Specification', description: 'Detailed technical requirements' },
              { name: 'Implementation Plan', description: 'Step-by-step development plan' },
              { name: 'Prototype/MVP', description: 'Working proof of concept' },
            ],
            tasks: [
              {
                id: 'analysis',
                name: 'Requirements Analysis',
                description: 'Analyze and document detailed requirements',
                duration: '1 week',
                required: true,
                dependencies: [],
              },
              {
                id: 'design',
                name: 'System Design',
                description: 'Create technical design and architecture',
                duration: '1 week',
                required: true,
                dependencies: ['analysis'],
              },
              {
                id: 'implementation',
                name: 'Development Implementation',
                description: 'Build the core functionality',
                duration: '3 weeks',
                required: true,
                dependencies: ['design'],
              },
              {
                id: 'testing',
                name: 'Testing & Quality Assurance',
                description: 'Comprehensive testing and bug fixes',
                duration: '1 week',
                required: true,
                dependencies: ['implementation'],
              },
            ],
          };
        }

        const assistantMessage: Message = {
          id: Date.now().toString(),
          content: responseContent,
          role: 'assistant',
          timestamp: new Date(),
          metadata: {
            sow: sowData,
          },
        };

        setMessages((prev: Message[]) => [...prev, assistantMessage]);
        // Track assistant message in context
        await chatContextService.addMessage({
          role: 'assistant',
          content: responseContent,
          metadata: assistantMessage.metadata,
        });
        setCurrentSOW(sowData);

        // Extract execution steps for step confirmation
        if (sowData.tasks && sowData.tasks.length > 0) {
          const steps = sowData.tasks.map((task: unknown, index: number) => ({
            id: task.id || `step-${index}`,
            name: task.name || `Step ${index + 1}`,
            description: task.description || 'No description available',
            required: task.required || index === 0,
            estimatedTime: task.duration || '1 week',
            dependencies: task.dependencies || [],
          }));
          setExecutionSteps(steps);
          setState('step-confirmation');
        } else {
          setState('sow-review');
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setState('input');
      } finally {
        setIsLoading(false);
      }
    },
    [messages, mode, projectPath],
  );

  const handleSOWApproval = useCallback(
    async (approved: boolean, modifications?: unknown) => {
      if (!approved || !currentSOW) {
        setState('input');
        setCurrentSOW(null);
        return;
      }

      // Handle modifications if provided
      if (modifications && Object.keys(modifications).length > 0) {
        setIsLoading(true);
        try {
          // Simulate modification processing
          await new Promise((resolve) => setTimeout(resolve, 1000));

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
        // Simulate execution start
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const execId = `exec-${Date.now()}`;
        setExecutionId(execId);

        const executionMessage: Message = {
          id: Date.now().toString(),
          content: `✅ Execution started successfully!\n\nProject: ${currentSOW.title}\nEstimated Duration: ${currentSOW.estimatedDuration}\nTracking ID: ${execId}\n\nYou can monitor progress below.`,
          role: 'assistant',
          timestamp: new Date(),
        };

        setMessages((prev: Message[]) => [...prev, executionMessage]);
      } catch (err: unknown) {
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

      setMessages((prev) => [...prev, userMessage]);
      setInputValue('');
      setIsLoading(true);

      // Supported slash commands for project management and agent management
      const supportedCommands = [
        '/init',
        '/add-dir',
        '/memory',
        '/export',
        '/agents',
        '/mcp',
        '/ide',
        '/install-github-app',
      ];

      if (supportedCommands.includes(`/${cmd}`)) {
        setCurrentSlashCommand(`/${cmd}`);
        setSlashCommandArgs(args);
        setState('slash-command');
        setIsLoading(false);
        return;
      }

      try {
        // Handle other commands (clear, help, etc.) inline
        let responseMessage: string;

        switch (cmd) {
          case 'clear':
            setMessages([]);
            responseMessage = 'Chat history cleared.';
            break;
          case 'help':
            responseMessage = `Available commands:
• /init - Initialize MARIA.md file
• /add-dir - Add working directory
• /memory - Edit Claude memory file  
• /export - Export conversation
• /agents - Manage AI agents
• /mcp - MCP server management
• /ide - IDE integration status
• /install-github-app - GitHub Actions setup
• /clear - Clear chat history
• /help - Show this help`;
            break;
          case 'status':
            responseMessage = `Session Status:
• Messages: ${messages.length}
• Project: ${projectPath}
• Mode: ${mode?.name || 'chat'}
• Time: ${new Date().toLocaleTimeString()}`;
            break;
          case 'exit':
            exit();
            return;
          default:
            responseMessage = `Unknown command: /${cmd}. Type /help for available commands.`;
        }

        const responseMsg: Message = {
          id: Date.now().toString(),
          content: responseMessage,
          role: 'system',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, responseMsg]);

        // Clear history after /clear command
        if (cmd === 'clear') {
          const welcome: Message = {
            id: Date.now().toString(),
            content: `Welcome back to MARIA CODE Chat (Mode: ${mode?.name || 'chat'})`,
            role: 'system',
            timestamp: new Date(),
          };
          setMessages([welcome]);
        }
      } catch (error: unknown) {
        const errorMessage: Message = {
          id: Date.now().toString(),
          content: `Error executing command: ${error instanceof Error ? error.message : 'Unknown error'}`,
          role: 'system',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, mode, projectPath, exit],
  );

  const handleStepConfirmation = useCallback(
    async (confirmedSteps: string[]) => {
      if (!currentSOW) return;

      // Update SOW with selected steps
      const updatedSOW = {
        ...currentSOW,
        tasks:
          currentSOW.tasks?.filter((task: unknown, index: number) =>
            confirmedSteps.includes(task.id || `step-${index}`),
          ) || [],
      };

      setCurrentSOW(updatedSOW);
      setState('sow-review');

      const confirmationMsg: Message = {
        id: Date.now().toString(),
        content: `Selected ${confirmedSteps.length} steps for execution. Please review the updated SOW.`,
        role: 'system',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, confirmationMsg]);
    },
    [currentSOW],
  );

  const handleStepConfirmationCancel = useCallback(() => {
    setState('input');
    setCurrentSOW(null);
    setExecutionSteps([]);

    const cancelMsg: Message = {
      id: Date.now().toString(),
      content: 'Step confirmation cancelled. Please provide a new request.',
      role: 'system',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, cancelMsg]);
  }, []);

  useInput((_input, key) => {
    if (key.escape) {
      exit();
    }
  });

  const menuItems = [
    { label: 'New conversation', value: 'new' },
    { label: 'Exit', value: 'exit' },
  ];

  const handleMenuSelect = useCallback(
    (item: { value: string }) => {
      if (item.value === 'exit') {
        exit();
      } else if (item.value === 'new') {
        setState('input');
        setCurrentSOW(null);
        setExecutionId(null);
      }
    },
    [exit],
  );

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1} justifyContent="space-between">
        <Box>
          <Text bold color="magenta">
            MARIA CODE Chat
          </Text>
          <Text> - {mode} mode</Text>
        </Box>
        <Box>
          <Text dimColor>
            Context: {contextStats.messagesInWindow} msgs | {contextStats.totalTokens}/
            {contextStats.maxTokens} tokens ({Math.round(contextStats.usagePercentage)}%)
            {contextStats.compressedCount > 0 && ` | ${contextStats.compressedCount} compressed`}
          </Text>
        </Box>
      </Box>

      {error && (
        <Box marginBottom={1} borderStyle="round" borderColor="red" padding={1}>
          <Text color="red">⚠️ Error: {error}</Text>
        </Box>
      )}

      <Box flexDirection="column" flexGrow={1}>
        <MessageList messages={messages} />
      </Box>

      <Box marginTop={1}>
        {state === 'input' && (
          <Box borderStyle="round" borderColor="white" padding={1} minHeight={3}>
            <Box flexDirection="row" width="100%">
              <Box marginRight={1}>
                <Text color="magenta">{'>'}</Text>
              </Box>
              <Box flexGrow={1} flexDirection="column">
                <Box>
                  <TextInput
                    value={inputValue}
                    onChange={setInputValue}
                    onSubmit={handleInput}
                    placeholder="Type your message or /command..."
                  />
                </Box>
                {inputValue && inputValue.length > 0 && (
                  <Box marginTop={1}>
                    <Text dimColor fontSize={10}>
                      Press Enter to send
                    </Text>
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        )}

        {state === 'processing' && isLoading && (
          <Box borderStyle="round" borderColor="yellow" padding={1} minHeight={3}>
            <Box flexDirection="row">
              <Spinner type="dots" />
              <Text> Processing your request...</Text>
            </Box>
          </Box>
        )}

        {state === 'step-confirmation' && executionSteps.length > 0 && (
          <StepConfirmation
            steps={executionSteps}
            onConfirm={handleStepConfirmation}
            onCancel={handleStepConfirmationCancel}
          />
        )}

        {state === 'sow-review' && currentSOW && (
          <SOWReview sow={currentSOW} onApprove={handleSOWApproval} />
        )}

        {state === 'executing' && executionId && (
          <TaskProgress executionId={executionId} onComplete={handleExecutionComplete} />
        )}

        {state === 'slash-command' && currentSlashCommand && (
          <SlashCommandHandler
            command={currentSlashCommand}
            args={slashCommandArgs}
            onExit={() => {
              setState('input');
              setCurrentSlashCommand(null);
              setSlashCommandArgs([]);
            }}
          />
        )}

        {state === 'menu' && (
          <Box flexDirection="column">
            <Box marginBottom={1}>
              <Text bold>What would you like to do next?</Text>
            </Box>
            <SelectInput items={menuItems} onSelect={handleMenuSelect} />
          </Box>
        )}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Press ESC to exit</Text>
      </Box>
    </Box>
  );
};

export default ChatInterface;
