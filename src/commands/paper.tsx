import { Command } from 'commander';
import { render } from 'ink';
import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';

interface PaperCommand {
  action: 'outline' | 'write' | 'references' | 'review';
  topic?: string;
  section?: string;
  file?: string;
}

const PaperAgent: React.FC<{ command: PaperCommand; onExit: () => void }> = ({ command, onExit }) => {
  const [status, setStatus] = React.useState<'processing' | 'done'>('processing');
  const [result, setResult] = React.useState<string>('');

  React.useEffect(() => {
    const executeAgent = async () => {
      try {
        // Simulate academic agent execution for now
        // TODO: Implement proper API integration
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        let mockResult = '';
        switch (command.action) {
          case 'outline':
            mockResult = `Generated paper outline for topic: ${command.topic || 'General topic'}\n\n1. Introduction\n2. Literature Review\n3. Methodology\n4. Results\n5. Discussion\n6. Conclusion\n7. References`;
            break;
          case 'write':
            mockResult = `Section written: ${command.section || 'Introduction'}\n\nThis section has been drafted with proper academic structure and citations.`;
            break;
          case 'references':
            mockResult = `References managed for file: ${command.file || 'paper.tex'}\n\nBibTeX entries have been organized and formatted.`;
            break;
          case 'review':
            mockResult = `Paper reviewed: ${command.file || 'paper.tex'}\n\nSuggestions for improvement:\n- Strengthen introduction\n- Add more recent citations\n- Improve data visualization`;
            break;
          default:
            mockResult = 'Academic task completed successfully.';
        }
        
        setResult(mockResult);

        setStatus('done');
      } catch (error) {
        setResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setStatus('done');
      }
    };

    executeAgent();
  }, [command]);

  React.useEffect(() => {
    if (status === 'done') {
      setTimeout(onExit, 2000);
    }
  }, [status, onExit]);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">Academic Agent</Text>
        <Text> - {command.action} action</Text>
      </Box>
      
      {status === 'processing' ? (
        <Box>
          <Spinner type="dots" />
          <Text> Processing your request...</Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          <Text color="green">✓ Completed</Text>
          <Box marginTop={1}>
            <Text>{result}</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};

const InteractivePaperMenu: React.FC<{ onSelect: (action: string) => void }> = ({ onSelect }) => {
  const actions = [
    { label: 'Generate paper outline', value: 'outline' },
    { label: 'Write paper section', value: 'write' },
    { label: 'Manage references', value: 'references' },
    { label: 'Review and improve', value: 'review' },
    { label: 'Exit', value: 'exit' },
  ];

  const handleSelect = (item: { value: string }) => {
    onSelect(item.value);
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">Academic Agent - Paper Development</Text>
      </Box>
      <Box marginBottom={1}>
        <Text>Select an action:</Text>
      </Box>
      <SelectInput items={actions} onSelect={handleSelect} />
    </Box>
  );
};

const PaperApp: React.FC = () => {
  const [currentView, setCurrentView] = React.useState<'menu' | 'agent'>('menu');
  const [selectedCommand, setSelectedCommand] = React.useState<PaperCommand | null>(null);

  const handleMenuSelect = (action: string) => {
    if (action === 'exit') {
      process.exit(0);
    } else {
      setSelectedCommand({ action: action as PaperCommand['action'] });
      setCurrentView('agent');
    }
  };

  const handleAgentExit = () => {
    setCurrentView('menu');
    setSelectedCommand(null);
  };

  if (currentView === 'agent' && selectedCommand) {
    return <PaperAgent command={selectedCommand} onExit={handleAgentExit} />;
  }

  return <InteractivePaperMenu onSelect={handleMenuSelect} />;
};

export default function paperCommand(program: Command) {
  program
    .command('paper')
    .description('Academic Agent for paper development')
    .option('-o, --outline <topic>', 'Generate paper outline for a topic')
    .option('-w, --write <section>', 'Write a specific section')
    .option('-r, --references <file>', 'Manage references for a paper')
    .option('--review <file>', 'Review and improve paper')
    .action(async (options) => {
      if (options.outline) {
        const command: PaperCommand = { action: 'outline', topic: options.outline };
        const { waitUntilExit } = render(
          <PaperAgent command={command} onExit={() => process.exit(0)} />
        );
        await waitUntilExit();
      } else if (options.write) {
        const command: PaperCommand = { action: 'write', section: options.write };
        const { waitUntilExit } = render(
          <PaperAgent command={command} onExit={() => process.exit(0)} />
        );
        await waitUntilExit();
      } else if (options.references) {
        const command: PaperCommand = { action: 'references', file: options.references };
        const { waitUntilExit } = render(
          <PaperAgent command={command} onExit={() => process.exit(0)} />
        );
        await waitUntilExit();
      } else if (options.review) {
        const command: PaperCommand = { action: 'review', file: options.review };
        const { waitUntilExit } = render(
          <PaperAgent command={command} onExit={() => process.exit(0)} />
        );
        await waitUntilExit();
      } else {
        // Interactive mode
        const { waitUntilExit } = render(<PaperApp />);
        await waitUntilExit();
      }
    });
}