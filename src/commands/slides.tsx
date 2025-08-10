import { Command } from 'commander';
import { render } from 'ink';
import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';

interface SlidesCommand {
  action: 'structure' | 'content' | 'visuals' | 'sync';
  topic?: string;
  file?: string;
  slidesId?: string;
}

const SlidesAgent: React.FC<{ command: SlidesCommand; onExit: () => void }> = ({ command, onExit }) => {
  const [status, setStatus] = React.useState<'processing' | 'done'>('processing');
  const [result, setResult] = React.useState<string>('');

  React.useEffect(() => {
    const executeAgent = async () => {
      try {
        // Simulate presentation agent execution
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        let mockResult = '';
        switch (command.action) {
          case 'structure':
            mockResult = `Generated slide structure for: ${command.topic || 'Presentation'}\n\n1. Title Slide\n2. Agenda/Overview\n3. Introduction\n4. Main Content (3-5 slides)\n5. Key Insights\n6. Conclusion\n7. Q&A\n\nSlide structure optimized for visual flow and audience engagement.`;
            break;
          case 'content':
            mockResult = `Content created for slides: ${command.file || 'presentation.pptx'}\n\nSlide content includes:\n- Compelling headlines\n- Key bullet points\n- Supporting data and examples\n- Visual content suggestions\n- Speaker notes`;
            break;
          case 'visuals':
            mockResult = `Visual optimization completed for: ${command.file || 'presentation.pptx'}\n\nOptimizations applied:\n- Color scheme alignment\n- Font consistency\n- Image placement optimization\n- Chart and graph enhancements\n- Layout improvements`;
            break;
          case 'sync':
            mockResult = `Google Slides sync completed: ${command.slidesId || 'presentation-id'}\n\nSync results:\n- Content synchronized successfully\n- Formatting preserved\n- Comments and suggestions imported\n- Share permissions updated`;
            break;
          default:
            mockResult = 'Presentation task completed successfully.';
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
        <Text bold color="magenta">Presentation Agent</Text>
        <Text> - {command.action} action</Text>
      </Box>
      
      {status === 'processing' ? (
        <Box>
          <Spinner type="dots" />
          <Text> Creating your presentation...</Text>
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

const InteractiveSlidesMenu: React.FC<{ onSelect: (action: string) => void }> = ({ onSelect }) => {
  const actions = [
    { label: 'Generate slide structure', value: 'structure' },
    { label: 'Create slide content', value: 'content' },
    { label: 'Optimize visuals', value: 'visuals' },
    { label: 'Sync with Google Slides', value: 'sync' },
    { label: 'Exit', value: 'exit' },
  ];

  const handleSelect = (item: { value: string }) => {
    onSelect(item.value);
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="magenta">Presentation Agent - Slide Creation</Text>
      </Box>
      <Box marginBottom={1}>
        <Text>Select an action:</Text>
      </Box>
      <SelectInput items={actions} onSelect={handleSelect} />
    </Box>
  );
};

const SlidesApp: React.FC = () => {
  const [currentView, setCurrentView] = React.useState<'menu' | 'agent'>('menu');
  const [selectedCommand, setSelectedCommand] = React.useState<SlidesCommand | null>(null);

  const handleMenuSelect = (action: string) => {
    if (action === 'exit') {
      process.exit(0);
    } else {
      setSelectedCommand({ action: action as SlidesCommand['action'] });
      setCurrentView('agent');
    }
  };

  const handleAgentExit = () => {
    setCurrentView('menu');
    setSelectedCommand(null);
  };

  if (currentView === 'agent' && selectedCommand) {
    return <SlidesAgent command={selectedCommand} onExit={handleAgentExit} />;
  }

  return <InteractiveSlidesMenu onSelect={handleMenuSelect} />;
};

export default function slidesCommand(program: Command) {
  program
    .command('slides')
    .description('Presentation Agent for slide creation')
    .option('-s, --structure <topic>', 'Generate slide structure for a topic')
    .option('-c, --content <file>', 'Create content for slides')
    .option('-v, --visuals <file>', 'Optimize slide visuals')
    .option('--sync <slidesId>', 'Sync with Google Slides')
    .action(async (options) => {
      if (options.structure) {
        const command: SlidesCommand = { action: 'structure', topic: options.structure };
        const { waitUntilExit } = render(
          <SlidesAgent command={command} onExit={() => process.exit(0)} />
        );
        await waitUntilExit();
      } else if (options.content) {
        const command: SlidesCommand = { action: 'content', file: options.content };
        const { waitUntilExit } = render(
          <SlidesAgent command={command} onExit={() => process.exit(0)} />
        );
        await waitUntilExit();
      } else if (options.visuals) {
        const command: SlidesCommand = { action: 'visuals', file: options.visuals };
        const { waitUntilExit } = render(
          <SlidesAgent command={command} onExit={() => process.exit(0)} />
        );
        await waitUntilExit();
      } else if (options.sync) {
        const command: SlidesCommand = { action: 'sync', slidesId: options.sync };
        const { waitUntilExit } = render(
          <SlidesAgent command={command} onExit={() => process.exit(0)} />
        );
        await waitUntilExit();
      } else {
        // Interactive mode
        const { waitUntilExit } = render(<SlidesApp />);
        await waitUntilExit();
      }
    });
}