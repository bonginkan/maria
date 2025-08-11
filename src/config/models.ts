/**
 * Model Configurations
 * Static model definitions and routing rules
 */

import { TaskType } from '../types';

export const TASK_ROUTING: Record<TaskType, string[]> = {
  coding: ['gpt-5', 'claude-sonnet-4-20250514', 'qwen2.5:32b', 'codellama:13b'],
  reasoning: ['o1', 'claude-opus-4-1-20250805', 'gpt-5', 'llama-3.3-70b-versatile'],
  vision: ['gpt-4o', 'claude-3-5-sonnet-20241022', 'qwen2.5-vl:7b', 'llama-3.2-90b-vision-preview'],
  quick_tasks: ['gpt-5-mini', 'gemini-2.5-flash', 'claude-3-5-haiku-20241022', 'llama3.2:3b'],
  cost_effective: [
    'gemini-2.5-flash',
    'claude-3-5-haiku-20241022',
    'gpt-4o-mini',
    'mixtral-8x7b-32768',
  ],
  privacy: [
    'gpt-oss-120b',
    'qwen2.5:32b',
    'japanese-stablelm-2-instruct-1_6b',
    'mistral-7b-instruct',
  ],
  multilingual: ['qwen2.5:32b', 'qwen2.5-vl:7b', 'gemini-2.5-pro', 'mixtral-8x7b-32768'],
  current_events: ['grok-2', 'gemini-2.5-pro', 'gpt-5', 'claude-opus-4-1-20250805'],
  chat: ['gpt-4o-mini', 'claude-3-5-haiku-20241022', 'gemini-2.5-flash', 'mixtral-8x7b-32768'],
};

export const PROVIDER_PRIORITY_MODES = {
  'privacy-first': ['lmstudio', 'ollama', 'vllm', 'anthropic', 'openai', 'google', 'groq', 'grok'],
  performance: ['groq', 'grok', 'ollama', 'lmstudio', 'google', 'openai', 'anthropic', 'vllm'],
  'cost-effective': ['ollama', 'vllm', 'google', 'groq', 'openai', 'anthropic', 'grok', 'lmstudio'],
  balanced: ['lmstudio', 'ollama', 'google', 'groq', 'openai', 'anthropic', 'grok', 'vllm'],
};

export function getRecommendedModel(
  taskType: TaskType,
  availableModels: string[],
): string | undefined {
  const recommendations = TASK_ROUTING[taskType] || TASK_ROUTING.chat;

  for (const modelId of recommendations) {
    if (availableModels.includes(modelId)) {
      return modelId;
    }
  }

  // Fallback to first available model
  return availableModels[0];
}

export function isLocalProvider(providerName: string): boolean {
  return ['lmstudio', 'ollama', 'vllm'].includes(providerName);
}

export function isCloudProvider(providerName: string): boolean {
  return ['openai', 'anthropic', 'google', 'groq', 'grok'].includes(providerName);
}
