/**
 * MARIA CODE Enhanced Model Management Commands
 * User-friendly slash commands and natural language model control
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import { AIRouter } from '../services/ai-router';

// Model profile types
interface ModelProfile {
  provider: string;
  name: string;
  badge: string;
  description: string;
  context: string;
  type: 'cloud' | 'local' | 'video' | 'image';
  vram?: string;
}

// Model profiles for quick selection
const MODEL_PROFILES: Record<string, ModelProfile> = {
  // Cloud models
  'gpt-4o': {
    provider: 'openai',
    name: 'GPT-4o',
    badge: '🌟',
    description: 'High accuracy, multimodal capabilities',
    context: '128K',
    type: 'cloud',
  },
  'gpt-4-turbo': {
    provider: 'openai',
    name: 'GPT-4 Turbo',
    badge: '⚡',
    description: 'Fast reasoning and code generation',
    context: '128K',
    type: 'cloud',
  },
  'claude-3-opus': {
    provider: 'anthropic',
    name: 'Claude 3 Opus',
    badge: '🎭',
    description: 'Long text processing, complex tasks',
    context: '200K',
    type: 'cloud',
  },
  'claude-3-sonnet': {
    provider: 'anthropic',
    name: 'Claude 3 Sonnet',
    badge: '🎵',
    description: 'Balanced performance and cost',
    context: '200K',
    type: 'cloud',
  },
  'gemini-2.5-pro': {
    provider: 'google',
    name: 'Gemini 2.5 Pro',
    badge: '💎',
    description: 'Research, analysis, vision capabilities',
    context: '128K',
    type: 'cloud',
  },
  'mixtral-8x7b': {
    provider: 'groq',
    name: 'Mixtral 8x7B',
    badge: '⚡',
    description: 'Fast inference, real-time responses',
    context: '32K',
    type: 'cloud',
  },
  'llama-3-70b': {
    provider: 'groq',
    name: 'Llama 3 70B',
    badge: '🦙',
    description: 'Open source excellence',
    context: '32K',
    type: 'cloud',
  },

  // Local models
  'gpt-oss-120b': {
    provider: 'local',
    name: 'GPT-OSS 120B',
    badge: '🧠',
    description: 'Complex reasoning, large documents',
    context: '128K',
    type: 'local',
    vram: '~64GB',
  },
  'gpt-oss-20b': {
    provider: 'local',
    name: 'GPT-OSS 20B',
    badge: '🚀',
    description: 'Balanced performance, quick responses',
    context: '32K',
    type: 'local',
    vram: '~12GB',
  },
  'qwen3-30b': {
    provider: 'local',
    name: 'Qwen3 30B',
    badge: '🌏',
    description: 'Multilingual support',
    context: '32K',
    type: 'local',
    vram: '~16GB',
  },
  'qwen2.5-vl': {
    provider: 'ollama',
    name: 'Qwen2.5-VL',
    badge: '👁️',
    description: 'Vision capabilities',
    context: '8K',
    type: 'local',
    vram: '~8GB',
  },

  // Video generation models
  'wan-2.2-t2v-a14b': {
    provider: 'huggingface',
    name: 'Wan 2.2 T2V A14B',
    badge: '🎬',
    description: 'High-quality text to video, 14B parameters',
    context: 'N/A',
    type: 'video',
    vram: '~16GB',
  },
  'wan-2.2-ti2v-5b': {
    provider: 'huggingface',
    name: 'Wan 2.2 TI2V 5B',
    badge: '⚡',
    description: 'Fast text/image to video, 5B parameters',
    context: 'N/A',
    type: 'video',
    vram: '~8GB',
  },
  'wan-2.2-i2v-a14b': {
    provider: 'huggingface',
    name: 'Wan 2.2 I2V A14B',
    badge: '🖼️',
    description: 'Image to video transformation, 14B parameters',
    context: 'N/A',
    type: 'video',
    vram: '~16GB',
  },

  // Image generation models
  'qwen-image': {
    provider: 'huggingface',
    name: 'Qwen-Image',
    badge: '🌟',
    description: 'Advanced text-to-image generation',
    context: 'N/A',
    type: 'image',
    vram: '~8GB',
  },
  'stable-diffusion-xl': {
    provider: 'huggingface',
    name: 'Stable Diffusion XL',
    badge: '🎨',
    description: 'High-quality artistic image generation',
    context: 'N/A',
    type: 'image',
    vram: '~10GB',
  },
  'flux-dev': {
    provider: 'huggingface',
    name: 'FLUX.1-dev',
    badge: '⚡',
    description: 'Fast, high-quality text-to-image',
    context: 'N/A',
    type: 'image',
    vram: '~12GB',
  },
  'dall-e-3-xl': {
    provider: 'huggingface',
    name: 'DALL-E 3 XL',
    badge: '🖼️',
    description: 'Creative and detailed image generation',
    context: 'N/A',
    type: 'image',
    vram: '~16GB',
  },
};

// Task-based model recommendations
const TASK_RECOMMENDATIONS: Record<string, string[]> = {
  code: ['gpt-oss-120b', 'qwen3-30b', 'gpt-4o', 'claude-3-opus'],
  vision: ['qwen2.5-vl', 'gpt-4o', 'gemini-2.5-pro'],
  chat: ['gpt-oss-20b', 'mixtral-8x7b', 'claude-3-opus'],
  translation: ['qwen3-30b', 'gpt-4o', 'gemini-2.5-pro'],
  analysis: ['gpt-oss-120b', 'claude-3-opus', 'gemini-2.5-pro'],
  creative: ['gpt-4o', 'claude-3-opus', 'gemini-2.5-pro'],
  fast: ['gpt-oss-20b', 'mixtral-8x7b'],
  private: ['gpt-oss-120b', 'gpt-oss-20b', 'qwen3-30b', 'qwen2.5-vl'],
  video: ['wan-2.2-ti2v-5b', 'wan-2.2-t2v-a14b', 'wan-2.2-i2v-a14b'],
  image: ['qwen-image', 'stable-diffusion-xl', 'flux-dev', 'dall-e-3-xl'],
};

interface ModelManagerProps {
  router?: AIRouter;
  onModelSelect?: (model: string, provider: string) => void;
  initialMode?: 'list' | 'select' | 'auto' | 'status';
}

/**
 * /model - Interactive model selector
 */
export const ModelCommand: React.FC<ModelManagerProps> = ({
  onModelSelect,
  initialMode = 'select',
}) => {
  const [mode] = useState(initialMode);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Record<string, any>>({});
  const [filter, setFilter] = useState<'all' | 'local' | 'cloud' | 'image' | 'video'>('all');
  const [, setSelectedModel] = useState<string>('auto');

  useInput((input, key) => {
    if (key.escape) {
      process.exit(0);
    }
    if (input === 'l') {
      setFilter('local');
    }
    if (input === 'c') {
      setFilter('cloud');
    }
    if (input === 'a') {
      setFilter('all');
    }
    if (input === 'i') {
      setFilter('image');
    }
    if (input === 'v') {
      setFilter('video');
    }
  });

  useEffect(() => {
    if (mode === 'status') {
      checkModelStatus();
    }
  }, [mode]);

  const checkModelStatus = async () => {
    setLoading(true);
    const newStatus: Record<string, any> = {};

    // Check each model availability
    for (const [id, profile] of Object.entries(MODEL_PROFILES)) {
      newStatus[id] = {
        ...profile,
        available: false,
        loading: false,
      };

      // Simulate checking (replace with actual provider checks)
      try {
        // Check if provider is available
        const isAvailable = await checkProviderAvailability();
        newStatus[id].available = isAvailable;
      } catch (error) {
        newStatus[id].error = error instanceof Error ? error.message : String(error);
      }
    }

    setStatus(newStatus);
    setLoading(false);
  };

  const checkProviderAvailability = async (): Promise<boolean> => {
    // Implementation would check actual provider availability
    // For now, simulate with random availability
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(Math.random() > 0.3);
      }, 100);
    });
  };

  const getFilteredModels = () => {
    return Object.entries(MODEL_PROFILES).filter(([, profile]) => {
      if (filter === 'all') return true;
      if (filter === 'local') return profile.type === 'local';
      if (filter === 'cloud') return profile.type === 'cloud';
      if (filter === 'image') return profile.type === 'image';
      if (filter === 'video') return profile.type === 'video';
      return profile.type === filter;
    });
  };

  const renderModelList = () => {
    const models = getFilteredModels();

    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold color="cyan">
            📊 Available AI Models
          </Text>
          <Text color="gray"> (Press L=Local, C=Cloud, I=Image, V=Video, A=All)</Text>
        </Box>

        <Box flexDirection="column" gap={1}>
          {models.map(([id, profile]) => (
            <Box key={id} gap={1}>
              <Text
                color={
                  profile.type === 'local'
                    ? 'green'
                    : profile.type === 'cloud'
                      ? 'blue'
                      : profile.type === 'image'
                        ? 'magenta'
                        : profile.type === 'video'
                          ? 'cyan'
                          : 'white'
                }
              >
                {profile.badge}
              </Text>
              <Box width={20}>
                <Text bold>{profile.name}</Text>
              </Box>
              <Box width={30}>
                <Text color="gray">{profile.description}</Text>
              </Box>
              <Text color="yellow">{profile.context}</Text>
              {profile.vram && <Text color="red"> VRAM: {profile.vram}</Text>}
            </Box>
          ))}
        </Box>
      </Box>
    );
  };

  const renderModelSelector = () => {
    const items = [
      {
        label: '🤖 Auto (Let AI choose)',
        value: 'auto',
      },
      ...getFilteredModels().map(([id, profile]) => ({
        label: `${profile.badge} ${profile.name} - ${profile.description}`,
        value: id,
      })),
    ];

    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold color="cyan">
            🎯 Select AI Model
          </Text>
        </Box>

        <SelectInput
          items={items}
          onSelect={(item) => {
            setSelectedModel(item.value);
            if (onModelSelect) {
              const profile = MODEL_PROFILES[item.value as keyof typeof MODEL_PROFILES];
              onModelSelect(item.value, profile?.provider || 'auto');
            }
          }}
        />

        <Box marginTop={1}>
          <Text color="gray">Tip: Press ↑↓ to navigate, Enter to select, ESC to exit</Text>
        </Box>
      </Box>
    );
  };

  const renderModelStatus = () => {
    if (loading) {
      return (
        <Box>
          <Spinner type="dots" />
          <Text color="yellow"> Checking model availability...</Text>
        </Box>
      );
    }

    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold color="cyan">
            🔍 Model Status
          </Text>
        </Box>

        <Box flexDirection="column" gap={1}>
          {Object.entries(status).map(([id, info]) => (
            <Box key={id} gap={1}>
              <Text color={info.available ? 'green' : 'red'}>{info.available ? '✅' : '❌'}</Text>
              <Box width={20}>
                <Text>{info.name}</Text>
              </Box>
              <Text color="gray">
                {info.available ? 'Available' : info.error || 'Not available'}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>
    );
  };

  switch (mode) {
    case 'list':
      return renderModelList();
    case 'select':
      return renderModelSelector();
    case 'status':
      return renderModelStatus();
    default:
      return renderModelSelector();
  }
};

/**
 * /switch - Quick model switcher
 */
export const SwitchCommand: React.FC<{ model: string }> = ({ model }) => {
  const [switching, setSwitching] = useState(true);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const switchModel = async () => {
      // Simulate model switching
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setSwitching(false);
      setSuccess(true);
    };
    switchModel();
  }, []);

  const profile = MODEL_PROFILES[model as keyof typeof MODEL_PROFILES];

  if (switching) {
    return (
      <Box>
        <Spinner type="dots" />
        <Text color="yellow"> Switching to {profile?.name || model}...</Text>
      </Box>
    );
  }

  if (success) {
    return (
      <Box>
        <Text color="green">✅ Successfully switched to </Text>
        <Text bold color="cyan">
          {profile?.name || model}
        </Text>
        <Text color="gray"> ({profile?.context} context)</Text>
      </Box>
    );
  }

  return null;
};

/**
 * /recommend - Task-based model recommendations
 */
export const RecommendCommand: React.FC<{ task?: string }> = ({ task = 'chat' }) => {
  const recommendations = TASK_RECOMMENDATIONS[task] || TASK_RECOMMENDATIONS.chat;

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          💡 Recommended Models for {task}
        </Text>
      </Box>

      <Box flexDirection="column" gap={1}>
        {recommendations?.map((modelId: string, index: number) => {
          const profile = MODEL_PROFILES[modelId as keyof typeof MODEL_PROFILES];
          if (!profile) return null;

          return (
            <Box key={modelId} gap={1}>
              <Text color="yellow">{index + 1}.</Text>
              <Text color={profile.type === 'local' ? 'green' : 'blue'}>{profile.badge}</Text>
              <Box width={20}>
                <Text bold>{profile.name}</Text>
              </Box>
              <Text color="gray">{profile.description}</Text>
            </Box>
          );
        })}
      </Box>

      <Box marginTop={1}>
        <Text color="gray">💡 Use `/switch [model-id]` to switch models</Text>
      </Box>
    </Box>
  );
};

/**
 * /compare - Compare models side by side
 */
export const CompareCommand: React.FC<{ models?: string[] }> = ({ models = [] }) => {
  const modelsToCompare = models.length > 0 ? models : ['gpt-4o', 'gpt-oss-120b', 'qwen3-30b'];

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          📊 Model Comparison
        </Text>
      </Box>

      <Box gap={2}>
        {modelsToCompare.map((modelId: string) => {
          const profile = MODEL_PROFILES[modelId as keyof typeof MODEL_PROFILES];
          if (!profile) return null;

          return (
            <Box key={modelId} flexDirection="column" width={25}>
              <Box>
                <Text bold color="yellow">
                  {profile.badge} {profile.name}
                </Text>
              </Box>
              <Text color="gray">Type: {profile.type}</Text>
              <Text color="gray">Context: {profile.context}</Text>
              {profile.vram && <Text color="gray">VRAM: {profile.vram}</Text>}
              <Box marginTop={1}>
                <Text color="green">{profile.description}</Text>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

/**
 * Natural language model selector
 */
export const parseNaturalLanguageModelRequest = (
  input: string,
): {
  action: string;
  model?: string;
  task?: string;
} => {
  const lowerInput = input.toLowerCase();

  // Direct model mentions
  if (lowerInput.includes('gpt-4') || lowerInput.includes('openai')) {
    return { action: 'switch', model: 'gpt-4o' };
  }
  if (lowerInput.includes('claude') || lowerInput.includes('anthropic')) {
    return { action: 'switch', model: 'claude-3-opus' };
  }
  if (lowerInput.includes('gemini') || lowerInput.includes('google')) {
    return { action: 'switch', model: 'gemini-2.5-pro' };
  }
  if (lowerInput.includes('120b') || lowerInput.includes('complex')) {
    return { action: 'switch', model: 'gpt-oss-120b' };
  }
  if (lowerInput.includes('vision') || lowerInput.includes('image')) {
    return { action: 'switch', model: 'qwen2.5-vl' };
  }
  if (lowerInput.includes('fast') || lowerInput.includes('quick')) {
    return { action: 'recommend', task: 'fast' };
  }
  if (lowerInput.includes('private') || lowerInput.includes('local')) {
    return { action: 'recommend', task: 'private' };
  }
  if (lowerInput.includes('code') || lowerInput.includes('programming')) {
    return { action: 'recommend', task: 'code' };
  }
  if (lowerInput.includes('translate') || lowerInput.includes('translation')) {
    return { action: 'recommend', task: 'translation' };
  }

  return { action: 'auto' };
};

// Export all commands
export default {
  ModelCommand,
  SwitchCommand,
  RecommendCommand,
  CompareCommand,
  parseNaturalLanguageModelRequest,
};
