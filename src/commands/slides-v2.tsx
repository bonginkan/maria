import { Command } from 'commander';
import { render } from 'ink';
import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import { AIChatServiceV2, ChatContext } from '../services/ai-chat-service-v2.js';
import { isString } from '../utils/type-guards.js';

interface SlidesCommand {
  action: 'structure' | 'content' | 'visuals' | 'sync';
  topic?: string;
  file?: string;
  slidesId?: string;
}

const SlidesAgent: React.FC<{ command: SlidesCommand; onExit: () => void }> = ({
  command,
  onExit,
}) => {
  const [status, setStatus] = React.useState<'processing' | 'done'>('processing');
  const [result, setResult] = React.useState<string>('');
  const [streamingContent, setStreamingContent] = React.useState<string>('');
  const [aiService] = React.useState(() => new AIChatServiceV2());

  React.useEffect(() => {
    const executeAgent = async () => {
      try {
        // Initialize AI service
        await aiService.initialize();

        // Create chat context
        const context: ChatContext = {
          sessionId: `slides-${Date.now()}`,
          projectRoot: process.cwd(),
          mode: 'creative',
          history: [],
        };

        let prompt = '';
        switch (command.action) {
          case 'structure':
            prompt = `Create a comprehensive slide structure for a presentation about "${command.topic || 'Modern Software Development'}".

Please provide:
1. A title slide with a compelling title and subtitle
2. An agenda/overview slide
3. 5-7 main content sections with 2-3 slides each
4. Key takeaways slide
5. Conclusion/Call to Action slide
6. Q&A slide

For each slide, include:
- Slide title
- Key points (3-5 bullet points)
- Visual suggestions (charts, images, diagrams)
- Speaker notes hints

Format the response as a clear, structured outline.`;
            break;

          case 'content':
            prompt = `Create detailed content for presentation slides in file: ${command.file || 'presentation.pptx'}

Generate:
1. Compelling headlines for each slide
2. Concise bullet points (max 7 words each)
3. Supporting data, statistics, and examples
4. Visual element descriptions
5. Detailed speaker notes for each slide

Make the content engaging, informative, and visually oriented. Use storytelling techniques where appropriate.`;
            break;

          case 'visuals':
            prompt = `Suggest visual optimizations for presentation: ${command.file || 'presentation.pptx'}

Provide recommendations for:
1. Color scheme (primary, secondary, accent colors with hex codes)
2. Typography (font families, sizes, hierarchy)
3. Layout templates for different slide types
4. Image and graphic suggestions with descriptions
5. Data visualization best practices
6. Animation and transition recommendations

Include specific design principles and accessibility considerations.`;
            break;

          case 'sync':
            prompt = `Create a plan for syncing presentation content with Google Slides ID: ${command.slidesId || 'presentation-id'}

Include:
1. Content migration strategy
2. Formatting preservation techniques
3. Collaboration features to enable
4. Permission and sharing settings
5. Version control best practices
6. Integration with other Google Workspace tools

Provide step-by-step instructions and best practices.`;
            break;

          default:
            prompt = 'Help me create an effective presentation.';
        }

        // Process with AI service (streaming enabled)
        const response = await aiService.processMessage(prompt, context, true);

        if (response.stream) {
          let fullContent = '';
          for await (const chunk of response.stream) {
            fullContent += chunk;
            setStreamingContent(fullContent);
          }
          setResult(fullContent);
        } else {
          setResult(
            typeof response === 'object' && response && 'content' in response
              ? String(response.content)
              : String(response),
          );
        }

        setStatus('done');
        setStreamingContent('');
      } catch (error: unknown) {
        setResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setStatus('done');
      }
    };

    executeAgent();
  }, [command, aiService]);

  React.useEffect(() => {
    if (status === 'done') {
      setTimeout(onExit, 3000); // Give user time to see the result
    }
  }, [status, onExit]);

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="magenta">
          Presentation Agent (AI-Powered)
        </Text>
        <Text> - {command.action} action</Text>
      </Box>

      {status === 'processing' ? (
        <Box flexDirection="column">
          <Box>
            <Spinner type="dots" />
            <Text> Creating your presentation with AI...</Text>
          </Box>
          {streamingContent && (
            <Box marginTop={1} width="100%">
              <Text>{streamingContent}</Text>
            </Box>
          )}
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
        <Text bold color="magenta">
          Presentation Agent - AI-Powered Slide Creation
        </Text>
      </Box>
      <SelectInput items={actions} onSelect={handleSelect} />
    </Box>
  );
};

export const slidesCommand = new Command('slides')
  .alias('s')
  .description('AI Presentation Agent - Create and manage presentations')
  .option('--structure <topic>', 'Generate slide structure for a topic')
  .option('--content <file>', 'Create content for slides')
  .option('--visuals <file>', 'Optimize visual design')
  .option('--sync <id>', 'Sync with Google Slides')
  .option('-i, --interactive', 'Interactive mode')
  .action(async (options) => {
    const command: SlidesCommand = {
      action: 'structure',
      topic: options.structure,
      file: options.content || options.visuals,
      slidesId: options.sync,
    };

    if (options.content) command.action = 'content';
    else if (options.visuals) command.action = 'visuals';
    else if (options.sync) command.action = 'sync';

    if (
      options.interactive ||
      (!options.structure && !options.content && !options.visuals && !options.sync)
    ) {
      // Interactive mode
      const { waitUntilExit } = render(
        <InteractiveSlidesMenu
          onSelect={(action) => {
            if (action === 'exit') {
              process.exit(0);
            }
            // For interactive mode, we'll use default values
            const interactiveCommand: SlidesCommand = {
              action:
                isString(action) && ['structure', 'content', 'visuals', 'sync'].includes(action)
                  ? (action as 'structure' | 'content' | 'visuals' | 'sync')
                  : 'structure',
              topic: 'AI and the Future of Work',
              file: 'presentation.pptx',
              slidesId: 'demo-presentation-id',
            };
            render(<SlidesAgent command={interactiveCommand} onExit={() => process.exit(0)} />);
          }}
        />,
      );

      await waitUntilExit();
    } else {
      // Direct command mode
      const { waitUntilExit } = render(
        <SlidesAgent command={command} onExit={() => process.exit(0)} />,
      );

      await waitUntilExit();
    }
  });
