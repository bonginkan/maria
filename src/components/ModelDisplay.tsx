/**
 * MARIA CODE Model Display Component
 * Clean and organized model listing
 */

import React from 'react';
import { Box, Text } from 'ink';

export interface ModelDisplayProps {
  showUsageExamples?: boolean;
}

export const ModelDisplay: React.FC<ModelDisplayProps> = ({ showUsageExamples = true }) => {
  return (
    <Box flexDirection="column" gap={1}>
      {/* Cloud Models Section */}
      <Box flexDirection="column">
        <Text bold color="cyan">
          ☁️ Cloud Models:
        </Text>

        <Box flexDirection="column" marginLeft={2} marginTop={1}>
          <ModelItem
            provider="OpenAI"
            model="GPT-4o"
            command="/model gpt-4o"
            context="128K"
            description="High accuracy, multimodal capabilities"
          />

          <ModelItem
            provider="OpenAI"
            model="GPT-4 Turbo"
            command="/model gpt-4-turbo"
            context="128K"
            description="Fast reasoning and code generation"
          />

          <ModelItem
            provider="Anthropic"
            model="Claude 3 Opus"
            command="/model claude-3-opus"
            context="200K"
            description="Long text processing, complex tasks"
          />

          <ModelItem
            provider="Anthropic"
            model="Claude 3 Sonnet"
            command="/model claude-3-sonnet"
            context="200K"
            description="Balanced performance and cost"
          />

          <ModelItem
            provider="Google"
            model="Gemini 2.5 Pro"
            command="/model gemini-2.5-pro"
            context="128K"
            description="Research, analysis, vision capabilities"
            isActive={true}
          />

          <ModelItem
            provider="Groq"
            model="Mixtral 8x7B"
            command="/model mixtral-8x7b"
            context="32K"
            description="Fast inference, real-time responses"
          />

          <ModelItem
            provider="Groq"
            model="Llama 3 70B"
            command="/model llama-3-70b"
            context="32K"
            description="Open source excellence"
          />
        </Box>
      </Box>

      {/* Local Models Section */}
      <Box flexDirection="column" marginTop={1}>
        <Text bold color="cyan">
          💻 Local Models:
        </Text>

        <Box flexDirection="column" marginLeft={2} marginTop={1}>
          <LocalModelItem
            model="GPT-OSS 120B"
            command="/model gpt-oss-120b"
            context="128K"
            vram="~64GB"
            description="Complex reasoning, large documents"
          />

          <LocalModelItem
            model="GPT-OSS 20B"
            command="/model gpt-oss-20b"
            context="32K"
            vram="~12GB"
            description="Balanced performance, quick responses"
          />

          <LocalModelItem
            model="Qwen3 30B"
            command="/model qwen3-30b"
            context="32K"
            vram="~16GB"
            description="Multilingual support"
          />

          <LocalModelItem
            model="Qwen2.5-VL"
            command="/model qwen2.5-vl"
            context="8K"
            vram="~8GB"
            description="Vision capabilities"
          />
        </Box>
      </Box>

      {/* Usage Examples */}
      {showUsageExamples && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="cyan">
            Usage Examples:
          </Text>
          <Box flexDirection="column" marginLeft={2} marginTop={1}>
            <Text color="gray">• /model gpt-4o - Switch to OpenAI GPT-4o</Text>
            <Text color="gray">• /model claude-3-opus - Switch to Claude 3 Opus</Text>
            <Text color="gray">• /model gpt-oss-20b - Switch to local GPT-OSS 20B</Text>
            <Text color="gray">• /switch vision - Auto-select best vision model</Text>
            <Text color="gray">• /recommend code - Get recommendations for coding</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};

// Individual model item component for cloud models
interface ModelItemProps {
  provider: string;
  model: string;
  command: string;
  context: string;
  description: string;
  isActive?: boolean;
}

const ModelItem: React.FC<ModelItemProps> = ({
  provider,
  model,
  command,
  context,
  description,
  isActive = false,
}) => {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box gap={1}>
        <Text bold color={isActive ? 'green' : 'white'}>
          • {provider}
        </Text>
        <Text> - </Text>
        <Text color="yellow">{model}</Text>
        {isActive && <Text color="green"> ✅</Text>}
      </Box>
      <Box marginLeft={2}>
        <Text color="blue">{command}</Text>
        <Text color="gray"> | Context: {context}</Text>
      </Box>
      <Box marginLeft={2}>
        <Text color="gray">{description}</Text>
      </Box>
    </Box>
  );
};

// Individual model item component for local models
interface LocalModelItemProps {
  model: string;
  command: string;
  context: string;
  vram: string;
  description: string;
}

const LocalModelItem: React.FC<LocalModelItemProps> = ({
  model,
  command,
  context,
  vram,
  description,
}) => {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold>• {model}</Text>
      <Box marginLeft={2}>
        <Text color="blue">{command}</Text>
        <Text color="gray">
          {' '}
          | Context: {context} | VRAM: {vram}
        </Text>
      </Box>
      <Box marginLeft={2}>
        <Text color="gray">{description}</Text>
      </Box>
    </Box>
  );
};

// Compact model list for quick reference
export const CompactModelList: React.FC = () => {
  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color="cyan">
        Available Models:
      </Text>

      <Box flexDirection="row" gap={2}>
        <Box flexDirection="column">
          <Text bold color="blue">
            Cloud:
          </Text>
          <Text color="gray">• gpt-4o</Text>
          <Text color="gray">• gpt-4-turbo</Text>
          <Text color="gray">• claude-3-opus</Text>
          <Text color="gray">• claude-3-sonnet</Text>
          <Text color="gray">• gemini-2.5-pro</Text>
          <Text color="gray">• mixtral-8x7b</Text>
          <Text color="gray">• llama-3-70b</Text>
        </Box>

        <Box flexDirection="column">
          <Text bold color="green">
            Local:
          </Text>
          <Text color="gray">• gpt-oss-120b</Text>
          <Text color="gray">• gpt-oss-20b</Text>
          <Text color="gray">• qwen3-30b</Text>
          <Text color="gray">• qwen2.5-vl</Text>
        </Box>
      </Box>
    </Box>
  );
};

export default ModelDisplay;
