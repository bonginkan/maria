/**
 * Interactive Model Selector Component
 * Enhanced UI with arrow key navigation and immediate model switching
 */

import React, { useState } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import { readConfig, writeConfig } from '../utils/config';

// Model profiles for quick selection - August 2025
const MODEL_PROFILES = {
  // OpenAI Models - August 2025
  'gpt-5': {
    provider: 'openai',
    name: 'GPT-5',
    badge: '🔥',
    description: 'Latest flagship, AGI-level capabilities',
    context: '256K',
    type: 'cloud',
  },
  'gpt-5-mini': {
    provider: 'openai',
    name: 'GPT-5 mini',
    badge: '⚡',
    description: 'Smaller GPT-5, still very powerful',
    context: '128K',
    type: 'cloud',
  },
  o3: {
    provider: 'openai',
    name: 'o3',
    badge: '🧠',
    description: 'Latest reasoning model, solves complex problems',
    context: '512K',
    type: 'cloud',
  },
  'o3-mini': {
    provider: 'openai',
    name: 'o3-mini',
    badge: '💡',
    description: 'Fast reasoning, coding specialist',
    context: '256K',
    type: 'cloud',
  },
  'gpt-4o': {
    provider: 'openai',
    name: 'GPT-4o',
    badge: '🌟',
    description: 'Previous gen, still excellent',
    context: '128K',
    type: 'cloud',
  },
  // Anthropic Models - August 2025
  'claude-opus-4.1': {
    provider: 'anthropic',
    name: 'Claude Opus 4.1',
    badge: '🎯',
    description: 'Latest Claude, exceptional reasoning',
    context: '500K',
    type: 'cloud',
  },
  'claude-4-sonnet': {
    provider: 'anthropic',
    name: 'Claude 4 Sonnet',
    badge: '⚡',
    description: 'Best for coding, ultra-fast',
    context: '300K',
    type: 'cloud',
  },
  'claude-4-haiku': {
    provider: 'anthropic',
    name: 'Claude 4 Haiku',
    badge: '🚀',
    description: 'Lightning fast, cost-effective',
    context: '300K',
    type: 'cloud',
  },
  'claude-3.5-sonnet': {
    provider: 'anthropic',
    name: 'Claude 3.5 Sonnet',
    badge: '🎵',
    description: 'Previous gen, still great',
    context: '200K',
    type: 'cloud',
  },
  // Google Models - Official Current Models
  'gemini-2.5-pro': {
    provider: 'google',
    name: 'Gemini 2.5 Pro',
    badge: '🧠',
    description: 'Enhanced reasoning, multimodal understanding',
    context: '2M',
    type: 'cloud',
  },
  'gemini-2.5-flash': {
    provider: 'google',
    name: 'Gemini 2.5 Flash',
    badge: '⚡',
    description: 'Adaptive thinking, cost-effective',
    context: '1M',
    type: 'cloud',
  },
  'gemini-2.5-flash-lite': {
    provider: 'google',
    name: 'Gemini 2.5 Flash-Lite',
    badge: '🚀',
    description: 'Most cost-effective, high throughput',
    context: '1M',
    type: 'cloud',
  },
  // xAI Models - August 2025
  'grok-4': {
    provider: 'xai',
    name: 'Grok 4',
    badge: '🤖',
    description: 'Latest Grok, real-time web access',
    context: '1M',
    type: 'cloud',
  },
  'grok-3-turbo': {
    provider: 'xai',
    name: 'Grok 3 Turbo',
    badge: '🔗',
    description: 'Fast, with X.com integration',
    context: '256K',
    type: 'cloud',
  },
  // Meta Models - August 2025
  'llama-4-405b': {
    provider: 'meta',
    name: 'Llama 4 405B',
    badge: '🦙',
    description: 'Latest Llama, GPT-5 competitor',
    context: '256K',
    type: 'cloud',
  },
  'llama-4-70b': {
    provider: 'groq',
    name: 'Llama 4 70B (Groq)',
    badge: '⚡',
    description: 'Groq-powered, ultra-fast inference',
    context: '128K',
    type: 'cloud',
  },
  // Mistral Models - August 2025
  'mistral-large-3': {
    provider: 'mistral',
    name: 'Mistral Large 3',
    badge: '🇫🇷',
    description: 'European AI, excellent multilingual',
    context: '256K',
    type: 'cloud',
  },

  // Local Models (LM Studio) - Actual Available Models
  'qwen3moe-30b': {
    provider: 'lmstudio',
    name: 'Qwen 3 MoE 30B',
    badge: '🏆',
    description: 'Q4_K_M quantized, excellent performance',
    context: '32K',
    type: 'local',
    vram: '18.56GB',
  },
  'gpt-oss-120b': {
    provider: 'lmstudio',
    name: 'GPT-OSS 120B',
    badge: '🧠',
    description: 'MXFP4, complex reasoning',
    context: '128K',
    type: 'local',
    vram: '63.39GB',
  },
  'gpt-oss-20b': {
    provider: 'lmstudio',
    name: 'GPT-OSS 20B',
    badge: '🚀',
    description: 'MXFP4, balanced performance',
    context: '32K',
    type: 'local',
    vram: '12.11GB',
  },
  'mistral-7b-v0.3': {
    provider: 'lmstudio',
    name: 'Mistral 7B v0.3',
    badge: '⚡',
    description: 'Q4_K_M, fast inference',
    context: '32K',
    type: 'local',
    vram: '4.37GB',
  },
};

interface ModelSelectorProps {
  currentModel?: string;
  onComplete?: (model: string) => void;
  onCancel?: () => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  currentModel = 'gemini-2.5-pro',
  onComplete,
  onCancel,
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
      config['defaultModel'] = item.value as unknown;
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
    } catch (err: unknown) {
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
          <Text bold color="cyan">
            {profile.name}
          </Text>
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
    value: id,
  }));

  // Find initial index for current model
  const initialIndex = items.findIndex((item) => item.value === currentModel);

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🤖 Select AI Model
        </Text>
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
            <Box marginRight={1}>{isSelected ? <Text color="cyan">▶</Text> : <Text> </Text>}</Box>
          )}
          itemComponent={({ isSelected, label }) => (
            <Text color={isSelected ? 'cyan' : 'white'}>{label}</Text>
          )}
        />
      </Box>

      {error && (
        <Box marginTop={1}>
          <Text color="red">❌ {error}</Text>
        </Box>
      )}

      <Box marginTop={1}>
        <Text color="gray">↑↓ Navigate • Enter Select • A/C/L Filter • ESC Cancel</Text>
      </Box>
    </Box>
  );
};

export default ModelSelector;
