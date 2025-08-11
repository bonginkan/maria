import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { CommandInput } from './CommandInput.js';
import { CommandHistory } from './CommandHistory.js';
import { FallbackInput } from './FallbackInput.js';

interface Command {
  id: string;
  input: string;
  output: string;
  timestamp: Date;
  status: 'success' | 'error' | 'pending';
}

export const App: React.FC = () => {
  const [commands, setCommands] = useState<Command[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rawModeSupported, setRawModeSupported] = useState(true);
  const [showFullCommands, setShowFullCommands] = useState(false);

  useEffect(() => {
    // Check if raw mode is supported
    const checkRawModeSupport = () => {
      try {
        // Check if stdin supports raw mode
        return process.stdin.isTTY && typeof process.stdin.setRawMode === 'function';
      } catch {
        return false;
      }
    };

    setRawModeSupported(checkRawModeSupport());
  }, []);

  // Handle Ctrl+R for toggling command list
  useInput((input, key) => {
    if (key.ctrl && input === 'r') {
      setShowFullCommands(!showFullCommands);
    }
  });

  const handleCommand = useCallback(async (input: string) => {
    const commandId = Date.now().toString();
    const newCommand: Command = {
      id: commandId,
      input,
      output: '',
      timestamp: new Date(),
      status: 'pending',
    };

    setCommands((prev) => [...prev, newCommand]);
    setIsProcessing(true);

    try {
      // Process the command
      let output = '';

      if (input.startsWith('/')) {
        // Handle slash commands
        output = await handleSlashCommand(input);
      } else if (input.toLowerCase().startsWith('mc ')) {
        // Handle mc commands
        output = await handleMcCommand(input);
      } else {
        // Handle general chat
        output = `💬 Chat: "${input}"\n\n🔄 Processing your request...`;
      }

      setCommands((prev) =>
        prev.map((cmd) =>
          cmd.id === commandId ? { ...cmd, output, status: 'success' as const } : cmd,
        ),
      );
    } catch (error) {
      setCommands((prev) =>
        prev.map((cmd) =>
          cmd.id === commandId
            ? { ...cmd, output: `❌ Error: ${error}`, status: 'error' as const }
            : cmd,
        ),
      );
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleSlashCommand = async (input: string): Promise<string> => {
    const command = input.slice(1); // Remove the '/'

    switch (command.toLowerCase()) {
      case 'help':
        if (!showFullCommands) {
          return `MARIA CODE - Available Commands
────────────────────────────────────────
/help           Show all 40 available commands
/code           AI code generation
/test           AI-powered test generation
/review         Code review
/init           Generate MARIA.md design document
/status         Display system status
/model          Select AI model
/config         Configuration panel
/video          AI video generation
/image          AI image generation
/build          Build project
/deploy         Deploy application
/clear          Clear conversation context
/exit           Exit MARIA CLI

+ 26 more slash commands available

You can also type natural language requests

Interrupt Feature:
• Type anytime during processing to interrupt
• New requests override previous ones
• Additional info is automatically detected`;
        } else {
          return `🤖 MARIA CODE - All 40 Commands
────────────────────────────────────────
/help           Show all available commands
/code           AI code generation
/test           AI-powered test generation
/review         Code review
/init           Generate MARIA.md design document
/status         Display system status
/model          Select AI model
/config         Configuration panel
/video          AI video generation
/image          AI image generation
/build          Build project
/deploy         Deploy application
/clear          Clear conversation context
/exit           Exit MARIA CLI
/login          Sign in to account
/logout         Sign out from account
/mode           Switch operation mode
/upgrade        Upgrade plan
/permissions    Manage permissions
/hooks          Hook configuration
/doctor         System diagnostics
/terminal-setup Terminal setup
/add-dir        Add working directory
/memory         Edit memory settings
/export         Export conversation
/agents         Manage AI agents
/mcp            MCP server management
/compact        Compact conversation
/resume         Resume previous session
/cost           Show usage costs
/pr-comments    Get PR comments
/bug            Report a bug
/release-notes  Generate release notes
/vim            Toggle Vim mode
/migrate-installer Migrate installation
/version        Show version info
/hotkey         Manage hotkeys
/alias          Configure aliases
/template       Template management
/workflow       Execute workflow
/batch          Batch processing
/debug          Debug mode

💡 You can also type natural language requests!
  Example: "Create a React component for user profile"`;
        }

      case 'clear':
        setCommands([]);
        return '🧹 Command history cleared!';

      case 'status':
        return `📊 MARIA CODE CLI Status:
        
🟢 System: Online
🟢 AI Agents: Ready
🟢 Neo4j: Connected
📦 Version: v1.0.0
⚡ Mode: Development
        
📈 Session Stats:
  Commands: ${commands.length}
  Uptime: ${Math.floor(process.uptime())}s`;

      default:
        return `❓ Unknown slash command: /${command}
        
Type /help to see available commands.`;
    }
  };

  const handleMcCommand = async (input: string): Promise<string> => {
    const args = input.split(' ').slice(1); // Remove 'mc'
    const command = args[0];

    switch (command) {
      case 'chat':
        return `💬 Starting AI Chat Mode...
        
🤖 Hi! I'm MARIA, your AI development assistant.
📝 How can I help you today?

💡 Try asking me to:
  • "Create a REST API for user management"
  • "Help me debug this React component"
  • "Generate tests for my functions"`;

      case 'paper':
        return `📄 Academic Paper Development Mode
        
📚 Features:
  • LaTeX document generation
  • BibTeX reference management
  • Real-time collaboration
  • Version control integration
  
📝 Example: mc paper --outline "AI in Healthcare"`;

      case 'slides':
        return `📊 Presentation Creation Mode
        
🎨 Features:
  • AI-powered slide generation
  • Google Slides integration
  • Multiple templates
  • Export to PDF/PPTX
  
📝 Example: mc slides --topic "Machine Learning Basics"`;

      case 'graph':
        return `🔗 Knowledge Graph (optional)
        
🗃️ Graph database available (if configured)
🌐 Bloom visualization ready
📊 Graph analytics enabled
        
📝 Example: mc graph --query "MATCH (n) RETURN n LIMIT 10"`;

      case 'init':
        return `🚀 Initializing MARIA project...
        
📁 Creating .maria-code.toml
📋 Setting up project configuration
🔧 Configuring development environment
        
✅ Project initialized successfully!`;

      default:
        return `❓ Unknown mc command: ${command}
        
📚 Available commands:
  • mc chat    - AI chat mode
  • mc paper   - Paper development
  • mc slides  - Presentation creation
  • mc graph   - Knowledge graph
  • mc init    - Project initialization`;
    }
  };

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

      {/* Command History */}
      <Box flexGrow={1} flexDirection="column" marginBottom={1}>
        <CommandHistory commands={commands} />
      </Box>

      {/* Input Area */}
      {rawModeSupported ? (
        <CommandInput
          onSubmit={handleCommand}
          disabled={isProcessing}
          placeholder="Type a command or chat message... (e.g., 'mc chat', '/help', or any question)"
        />
      ) : (
        <FallbackInput
          onSubmit={handleCommand}
          disabled={isProcessing}
          placeholder="Type a command or chat message... (e.g., 'mc chat', '/help', or any question)"
        />
      )}

      {/* Footer */}
      <Box justifyContent="center" marginTop={1}>
        <Text color="gray">
          💡 Press Ctrl+R to {showFullCommands ? 'hide' : 'show'} all commands • Ctrl+C to exit • /help for commands
        </Text>
      </Box>
    </Box>
  );
};
