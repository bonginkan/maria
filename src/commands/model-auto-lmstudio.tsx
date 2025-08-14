/**
 * MARIA CODE Enhanced Model Command with Auto LM Studio
 * Automatic detection, startup, and seamless model switching
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import Spinner from 'ink-spinner';
import { exec } from 'child_process';
import { promisify } from 'util';
import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';
import { isObject, hasStringProperty, getBooleanProperty } from '../utils/type-guards.js';

const execAsync = promisify(exec);

interface LMStudioModel {
  id: string;
  name: string;
  size: string;
  vram: string;
  context: string;
  loaded: boolean;
  available: boolean;
}

interface CloudModel {
  id: string;
  provider: string;
  name: string;
  available: boolean;
  apiKeySet: boolean;
}

// Type guard functions
const isLMStudioModel = (model: LMStudioModel | CloudModel): model is LMStudioModel => {
  return 'context' in model;
};

const LM_STUDIO_MODELS: LMStudioModel[] = [
  {
    id: 'gpt-oss-120b',
    name: 'GPT-OSS 120B',
    size: '120B',
    vram: '~64GB',
    context: '128K',
    loaded: false,
    available: false,
  },
  {
    id: 'gpt-oss-20b',
    name: 'GPT-OSS 20B',
    size: '20B',
    vram: '~12GB',
    context: '32K',
    loaded: false,
    available: false,
  },
  {
    id: 'qwen3-30b',
    name: 'Qwen3 30B',
    size: '30B',
    vram: '~16GB',
    context: '32K',
    loaded: false,
    available: false,
  },
];

const CLOUD_MODELS: CloudModel[] = [
  { id: 'gpt-4o', provider: 'OpenAI', name: 'GPT-4o', available: false, apiKeySet: false },
  {
    id: 'claude-3-opus',
    provider: 'Anthropic',
    name: 'Claude 3 Opus',
    available: false,
    apiKeySet: false,
  },
  {
    id: 'gemini-2.5-pro',
    provider: 'Google',
    name: 'Gemini 2.5 Pro',
    available: false,
    apiKeySet: false,
  },
  {
    id: 'groq-mixtral',
    provider: 'Groq',
    name: 'Mixtral 8x7B',
    available: false,
    apiKeySet: false,
  },
];

export const EnhancedModelCommand: React.FC = () => {
  const { exit } = useApp();
  const [step, setStep] = useState<'checking' | 'selecting' | 'loading' | 'ready'>('checking');
  const [lmStudioStatus, setLmStudioStatus] = useState<
    'checking' | 'not-installed' | 'not-running' | 'running'
  >('checking');
  const [models, setModels] = useState<(LMStudioModel | CloudModel)[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  // Check LM Studio installation and status
  const checkLMStudio = useCallback(async () => {
    try {
      // Check if LM Studio is installed
      const lmsPath = '/Users/bongin_max/.lmstudio/bin/lms';
      if (!fs.existsSync(lmsPath)) {
        setLmStudioStatus('not-installed');
        return false;
      }

      // Check if server is running
      try {
        const response = await fetch('http://localhost:1234/v1/models', {
          headers: { Authorization: 'Bearer lm-studio' },
          signal: AbortSignal.timeout(2000),
        });

        if (response.ok) {
          setLmStudioStatus('running');
          const data = (await response.json()) as {
            data?: Array<{ id: string; loaded?: boolean }>;
          };

          // Update model availability
          const availableModels = data.data || [];
          const updatedModels = LM_STUDIO_MODELS.map((model) => ({
            ...model,
            available: availableModels.some((m: unknown) => 
              isObject(m) && hasStringProperty(m, 'id') && m.id.includes(model.id)
            ),
            loaded: availableModels.some((m: unknown) => 
              isObject(m) && hasStringProperty(m, 'id') && m.id === model.id && 
              getBooleanProperty(m, 'loaded', false)
            ),
          }));

          return updatedModels;
        }

        // Server running but no models response
        setLmStudioStatus('running');
        return false;
      } catch {
        // Server not running
        setLmStudioStatus('not-running');
        return false;
      }
    } catch (error: unknown) {
      setError(
        `Error checking LM Studio: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }, []);

  // Start LM Studio server automatically
  const startLMStudioServer = useCallback(async () => {
    try {
      setStatusMessage('Starting LM Studio server...');

      // Stop any existing server
      await execAsync('/Users/bongin_max/.lmstudio/bin/lms server stop 2>/dev/null || true');
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Start server
      await execAsync('/Users/bongin_max/.lmstudio/bin/lms server start');
      await new Promise((resolve) => setTimeout(resolve, 3000));

      setLmStudioStatus('running');
      setStatusMessage('LM Studio server started successfully');
      return true;
    } catch (error: unknown) {
      setError(
        `Failed to start LM Studio: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }, []);

  // Load a specific model
  const loadModel = useCallback(async (modelId: string) => {
    try {
      setStep('loading');
      setLoadingProgress(0);

      // Simulate loading progress
      const progressInterval = setInterval(() => {
        setLoadingProgress((prev) => Math.min(prev + 10, 90));
      }, 500);

      // Load the model
      await execAsync(`/Users/bongin_max/.lmstudio/bin/lms load ${modelId}`);

      clearInterval(progressInterval);
      setLoadingProgress(100);

      // Update environment variables
      const envPath = path.join(process.cwd(), '.env.local');
      let envContent = '';

      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf-8');
      }

      // Update or add model configuration
      const updatedEnv = envContent
        .replace(/LMSTUDIO_DEFAULT_MODEL=.*/, `LMSTUDIO_DEFAULT_MODEL=${modelId}`)
        .replace(/AI_PROVIDER=.*/, 'AI_PROVIDER=lmstudio')
        .replace(/OFFLINE_MODE=.*/, 'OFFLINE_MODE=true');

      fs.writeFileSync(envPath, updatedEnv);

      // Set environment variables for current session
      process.env['LMSTUDIO_DEFAULT_MODEL'] = modelId;
      process.env['AI_PROVIDER'] = 'lmstudio';
      process.env['OFFLINE_MODE'] = 'true';

      setStep('ready');
      return true;
    } catch (error: unknown) {
      setError(`Failed to load model: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }, []);

  // Check cloud providers
  const checkCloudProviders = useCallback(async () => {
    const updatedCloudModels = CLOUD_MODELS.map((model) => {
      let apiKeySet = false;

      switch (model.provider) {
        case 'OpenAI':
          apiKeySet = !!process.env['OPENAI_API_KEY'];
          break;
        case 'Anthropic':
          apiKeySet = !!process.env['ANTHROPIC_API_KEY'];
          break;
        case 'Google':
          apiKeySet = !!process.env['GEMINI_API_KEY'];
          break;
        case 'Groq':
          apiKeySet = !!process.env['GROQ_API_KEY'];
          break;
      }

      return {
        ...model,
        apiKeySet,
        available: apiKeySet,
      };
    });

    return updatedCloudModels;
  }, []);

  // Initialize on mount
  useEffect(() => {
    const initialize = async () => {
      setStep('checking');

      // Check LM Studio
      const lmModels = await checkLMStudio();

      // If not running, start it
      if (lmStudioStatus === 'not-running') {
        const started = await startLMStudioServer();
        if (started) {
          const updatedModels = await checkLMStudio();
          if (Array.isArray(updatedModels)) {
            setModels(updatedModels);
          }
        }
      } else if (Array.isArray(lmModels)) {
        setModels(lmModels);
      }

      // Check cloud providers
      const cloudModels = await checkCloudProviders();

      // Combine all models
      setModels([...(Array.isArray(lmModels) ? lmModels : LM_STUDIO_MODELS), ...cloudModels]);

      setStep('selecting');
    };

    initialize();
  }, []);

  // Handle arrow key navigation
  useInput((_input, key) => {
    if (step === 'selecting') {
      if (key.upArrow) {
        setSelectedIndex((prev) => Math.max(0, prev - 1));
      }
      if (key.downArrow) {
        setSelectedIndex((prev) => Math.min(models.length - 1, prev + 1));
      }
      if (key.return) {
        const selected = models[selectedIndex];
        if (selected) {
          setSelectedModel(selected.id);
          if ('vram' in selected) {
            // Local model - load it
            loadModel(selected.id);
          } else {
            // Cloud model - just set it
            process.env['AI_PROVIDER'] = selected.provider.toLowerCase();
            process.env['CURRENT_MODEL'] = selected.id;
            setStep('ready');
          }
        }
      }
    }

    if (key.escape) {
      exit();
    }
  });

  // Render based on current step
  if (step === 'checking') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box>
          <Spinner type="dots" />
          <Text color="yellow"> Checking AI models and LM Studio status...</Text>
        </Box>
        {statusMessage && <Text color="gray">{statusMessage}</Text>}
      </Box>
    );
  }

  if (step === 'selecting') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold color="cyan">
            🤖 Select AI Model
          </Text>
          <Text color="gray"> (Use ↑↓ arrows, Enter to select, ESC to exit)</Text>
        </Box>

        <Box flexDirection="column">
          {models.map((model, index) => {
            const isSelected = index === selectedIndex;
            const isLocal = 'vram' in model;
            const isAvailable = model.available || (isLocal && lmStudioStatus === 'running');

            return (
              <Box key={model.id} paddingLeft={1}>
                <Text color={isSelected ? 'cyan' : 'white'}>{isSelected ? '▶ ' : '  '}</Text>
                <Box width={25}>
                  <Text bold={isSelected} color={isLocal ? 'green' : 'blue'}>
                    {isLocal ? '💻' : '☁️'} {model.name}
                  </Text>
                </Box>
                <Box width={15}>
                  <Text color="gray">
                    {isLocal
                      ? `VRAM: ${(model as LMStudioModel).vram}`
                      : `${(model as CloudModel).provider}`}
                  </Text>
                </Box>
                <Box width={10}>
                  <Text color={isAvailable ? 'green' : 'red'}>
                    {isAvailable ? '✅ Ready' : '❌ Not available'}
                  </Text>
                </Box>
                {isLocal && <Text color="yellow">{(model as LMStudioModel).context} context</Text>}
              </Box>
            );
          })}
        </Box>

        <Box marginTop={1}>
          <Text color="cyan">💡 Active Model: </Text>
          <Text bold color="yellow">
            {process.env['LMSTUDIO_DEFAULT_MODEL'] || process.env['CURRENT_MODEL'] || 'None'}
          </Text>
        </Box>

        {lmStudioStatus === 'running' && (
          <Box marginTop={1}>
            <Text color="green">✅ LM Studio server running at http://localhost:1234</Text>
          </Box>
        )}
      </Box>
    );
  }

  if (step === 'loading') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box>
          <Spinner type="dots" />
          <Text color="yellow"> Loading model: {selectedModel}</Text>
        </Box>
        <Box marginTop={1}>
          <Text color="cyan">Progress: </Text>
          <Box width={30}>
            <Text>{'█'.repeat(Math.floor(loadingProgress / 5))}</Text>
            <Text color="gray">{'░'.repeat(20 - Math.floor(loadingProgress / 5))}</Text>
          </Box>
          <Text color="yellow"> {loadingProgress}%</Text>
        </Box>
      </Box>
    );
  }

  if (step === 'ready') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box>
          <Text color="green">✅ </Text>
          <Text bold color="cyan">
            AI Model Updated
          </Text>
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Box>
            <Text color="gray">Active Model: </Text>
            <Text bold color="yellow">
              {selectedModel}
            </Text>
          </Box>

          {'vram' in models.find((m) => m.id === selectedModel)! && (
            <>
              <Box>
                <Text color="gray">Type: </Text>
                <Text color="green">💻 Local (LM Studio)</Text>
              </Box>
              <Box>
                <Text color="gray">Context: </Text>
                <Text color="yellow">
                  {(() => {
                    const model = models.find((m) => m.id === selectedModel);
                    return model && isLMStudioModel(model) ? model.context : '128K';
                  })()}
                </Text>
              </Box>
              <Box>
                <Text color="gray">Optimized for: </Text>
                <Text color="cyan">Complex reasoning, large documents</Text>
              </Box>
            </>
          )}
        </Box>

        <Box marginTop={1}>
          <Text color="gray">
            💡 Your next messages will use this model. Type something to test it!
          </Text>
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">❌ Error: {error}</Text>
        <Text color="gray">Please check your LM Studio installation and try again.</Text>
      </Box>
    );
  }

  return null;
};

export default EnhancedModelCommand;
