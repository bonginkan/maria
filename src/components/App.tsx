import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text } from 'ink';
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
        return `📚 Available Commands:
        
🔹 Chat Commands:
  /help            - Show this help message
  /clear           - Clear command history
  /status          - Show system status
  
🔹 MC Commands:
  mc chat          - Interactive AI chat mode
  mc paper         - Academic paper development
  mc slides        - Presentation creation
  mc graph         - Neo4j knowledge graph
  mc init          - Initialize project configuration
  
💡 You can also type any natural language and I'll help you!`;

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
      {/* Header */}
      <Box borderStyle="double" borderColor="magenta" padding={1} marginBottom={1}>
        <Box flexDirection="column" alignItems="center" width="100%">
          <Text bold color="magenta">
            ███ MARIA CODE ███
          </Text>
          <Text color="magenta">AI-Powered Development Platform v1.0.0</Text>
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
          💡 Press Tab for autocomplete • Ctrl+C to exit • /help for commands
        </Text>
      </Box>
    </Box>
  );
};
