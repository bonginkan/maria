/**
 * Interactive Model Selector Component
 * Enhanced UI with arrow key navigation and immediate model switching
 */

import React, { useState } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import { readConfig, writeConfig } from '../utils/config';

// Model profiles for quick selection
const MODEL_PROFILES = {
  // Cloud models
  'gpt-4o': {
    provider: 'openai',
    name: 'GPT-4o',
    badge: '🌟',
    description: 'High accuracy, multimodal capabilities',
    context: '128K',
    type: 'cloud'
  },
  'gpt-4-turbo': {
    provider: 'openai',
    name: 'GPT-4 Turbo',
    badge: '⚡',
    description: 'Fast reasoning and code generation',
    context: '128K',
    type: 'cloud'
  },
  'claude-3-opus': {
    provider: 'anthropic',
    name: 'Claude 3 Opus',
    badge: '🎭',
    description: 'Long text processing, complex tasks',
    context: '200K',
    type: 'cloud'
  },
  'claude-3-sonnet': {
    provider: 'anthropic',
    name: 'Claude 3 Sonnet',
    badge: '🎵',
    description: 'Balanced performance and cost',
    context: '200K',
    type: 'cloud'
  },
  'gemini-2.5-pro': {
    provider: 'google',
    name: 'Gemini 2.5 Pro',
    badge: '💎',
    description: 'Research, analysis, vision capabilities',
    context: '128K',
    type: 'cloud'
  },
  'mixtral-8x7b': {
    provider: 'groq',
    name: 'Mixtral 8x7B',
    badge: '⚡',
    description: 'Fast inference, real-time responses',
    context: '32K',
    type: 'cloud'
  },
  'llama-3-70b': {
    provider: 'groq',
    name: 'Llama 3 70B',
    badge: '🦙',
    description: 'Open source excellence',
    context: '32K',
    type: 'cloud'
  },
  
  // Local models
  'gpt-oss-120b': {
    provider: 'lmstudio',
    name: 'GPT-OSS 120B',
    badge: '🧠',
    description: 'Complex reasoning, large documents',
    context: '128K',
    type: 'local',
    vram: '~64GB'
  },
  'gpt-oss-20b': {
    provider: 'lmstudio',
    name: 'GPT-OSS 20B',
    badge: '🚀',
    description: 'Balanced performance, quick responses',
    context: '32K',
    type: 'local',
    vram: '~12GB'
  },
  'qwen3-30b': {
    provider: 'lmstudio',
    name: 'Qwen3 30B',
    badge: '🌏',
    description: 'Multilingual support',
    context: '32K',
    type: 'local',
    vram: '~16GB'
  },
  'qwen2.5-vl': {
    provider: 'ollama',
    name: 'Qwen2.5-VL',
    badge: '👁️',
    description: 'Vision capabilities',
    context: '8K',
    type: 'local',
    vram: '~8GB'
  }
};

interface ModelSelectorProps {
  currentModel?: string;
  onComplete?: (model: string) => void;
  onCancel?: () => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ 
  currentModel = 'gemini-2.5-pro',
  onComplete,
  onCancel
}) => {
  const { exit } = useApp();
  const [selectedModel, setSelectedModel] = useState<string>(currentModel);
  const [filter, setFilter] = useState<'all' | 'cloud' | 'local'>('all');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only use input hooks if stdin supports raw mode
  if (process.stdin.isTTY) {
    useInput((input, key) => {
      // Filter shortcuts
      if (input === 'c' || input === 'C') {
        setFilter('cloud');
      } else if (input === 'l' || input === 'L') {
        setFilter('local');
      } else if (input === 'a' || input === 'A') {
        setFilter('all');
      } else if (key.escape) {
        if (onCancel) {
          onCancel();
        } else {
          exit();
        }
      }
    });
  }

  const getFilteredModels = () => {
    return Object.entries(MODEL_PROFILES).filter(([, profile]) => {
      if (filter === 'all') return true;
      return profile.type === filter;
    });
  };

  const handleSelect = async (item: { value: string }) => {
    setSelectedModel(item.value);
    setSaving(true);
    setError(null);

    try {
      // Save to config
      const config = await readConfig();
      config.defaultModel = item.value as any;
      await writeConfig(config);
      
      setSaved(true);
      
      // Notify parent component
      if (onComplete) {
        setTimeout(() => {
          onComplete(item.value);
        }, 1000);
      } else {
        setTimeout(() => {
          exit();
        }, 1000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save model');
      setSaving(false);
    }
  };

  if (saved) {
    const profile = MODEL_PROFILES[selectedModel as keyof typeof MODEL_PROFILES];
    return (
      <Box flexDirection="column" paddingTop={1}>
        <Box>
          <Text color="green">✅ </Text>
          <Text bold>Model successfully updated!</Text>
        </Box>
        <Box marginTop={1}>
          <Text>{profile.badge} </Text>
          <Text bold color="cyan">{profile.name}</Text>
          <Text color="gray"> - {profile.description}</Text>
        </Box>
        <Box marginTop={1}>
          <Text color="gray">Your next messages will use this model.</Text>
        </Box>
      </Box>
    );
  }

  if (saving) {
    return (
      <Box paddingTop={1}>
        <Spinner type="dots" />
        <Text color="yellow"> Updating model configuration...</Text>
      </Box>
    );
  }

  const models = getFilteredModels();
  const items = models.map(([id, profile]) => ({
    label: `${profile.badge} ${profile.name} (${profile.context}) - ${profile.description}`,
    value: id
  }));

  // Find initial index for current model
  const initialIndex = items.findIndex(item => item.value === currentModel);

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">🤖 Select AI Model</Text>
      </Box>

      <Box marginBottom={1}>
        <Text color="gray">Filter: </Text>
        <Text color={filter === 'all' ? 'cyan' : 'gray'}>[A]ll </Text>
        <Text color={filter === 'cloud' ? 'blue' : 'gray'}>[C]loud </Text>
        <Text color={filter === 'local' ? 'green' : 'gray'}>[L]ocal</Text>
      </Box>

      <Box flexDirection="column">
        <SelectInput
          items={items}
          initialIndex={initialIndex >= 0 ? initialIndex : 0}
          onSelect={handleSelect}
          indicatorComponent={({ isSelected }) => (
            <Box marginRight={1}>
              {isSelected ? <Text color="cyan">▶</Text> : <Text> </Text>}
            </Box>
          )}
          itemComponent={({ isSelected, label }) => (
            <Text color={isSelected ? 'cyan' : 'white'}>
              {label}
            </Text>
          )}
        />
      </Box>

      {error && (
        <Box marginTop={1}>
          <Text color="red">❌ {error}</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text color="gray">
          ↑↓ Navigate • Enter Select • A/C/L Filter • ESC Cancel
        </Text>
      </Box>
    </Box>
  );
};

export default ModelSelector;