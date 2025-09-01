/**
 * AI Model Definitions
 *
 * This file contains the official model IDs for each AI provider.
 * Update these values when new model versions are released.
 *
 * 正式モデル名の管理ファイル
 * 新しいモデルバージョンがリリースされた場合は、ここを更新してください。
 */

export const MODEL_DEFINITIONS = {
  // OpenAI Models - 正式モデル名
  OPENAI: {
    GPT_5: "gpt-5-2025-08-07",
    GPT_5_MINI: "gpt-5-mini-2025-08-07",
  },

  // Anthropic Models - 正式モデル名
  ANTHROPIC: {
    CLAUDE_OPUS_4_1: "claude-opus-4-1-20250805",
    CLAUDE_SONNET_4: "claude-sonnet-4-20250514",
  },

  // Google Models - 正式モデル名
  GOOGLE: {
    GEMINI_2_5_PRO: "gemini-2.5-pro",
    GEMINI_2_5_FLASH: "gemini-2.5-flash",
    GEMINI_2_5_FLASH_LITE: "gemini-2.5-flash-lite",
    GEMINI_2_5_FLASH_IMAGE_PREVIEW: "gemini-2.5-flash-image-preview",
  },

  // Groq Models - 正式モデル名(Groq API用)
  GROQ: {
    GPT_OSS_20B: "openai/gpt-oss-20b",
    GPT_OSS_120B: "openai/gpt-oss-120b",
    QWEN3_32B: "qwen/qwen3-32b",
  },

  // xAI Models - 正式モデル名
  XAI: {
    GROK_4: "grok-4-0709",
  },

  // LM Studio Models - ローカルモデル
  LMSTUDIO: {
    LOCAL_LLAMA_70B: "llama-70b-local",
    LOCAL_MIXTRAL: "mixtral-8x7b-local",
    LOCAL_QWEN: "qwen-32b-local",
    LOCAL_GPT_OSS_20B: "gpt-oss-20b-local",
    LOCAL_GPT_OSS_120B: "gpt-oss-120b-local",
  },

  // Ollama Models
  OLLAMA: {
    QWEN2_5_VL: "qwen2.5-vl",
    LLAMA3_8B: "llama3:8b",
    MISTRAL_7B: "mistral:7b",
  },

  // vLLM Models - 高速推論サーバー
  VLLM: {
    VLLM_LLAMA_70B: "meta-llama/Llama-2-70b-hf",
    VLLM_MISTRAL_7B: "mistralai/Mistral-7B-v0.1",
    VLLM_QWEN_14B: "Qwen/Qwen-14B",
  },
} as const;

/**
 * Model display names and descriptions
 * These are shown in the UI
 */
export const MODEL_DISPLAY_INFO = {
  // OpenAI
  [MODEL_DEFINITIONS.OPENAI.GPT_5]: {
    name: "GPT-5",
    description: "Most advanced reasoning",
    context: "128k",
  },
  [MODEL_DEFINITIONS.OPENAI.GPT_5_MINI]: {
    name: "GPT-5 Mini",
    description: "Fast & efficient",
    context: "128k",
  },

  // Anthropic
  [MODEL_DEFINITIONS.ANTHROPIC.CLAUDE_OPUS_4_1]: {
    name: "Claude Opus 4.1",
    description: "Powerful reasoning",
    context: "200k",
  },
  [MODEL_DEFINITIONS.ANTHROPIC.CLAUDE_SONNET_4]: {
    name: "Claude Sonnet 4",
    description: "Balanced performance",
    context: "200k",
  },

  // Google
  [MODEL_DEFINITIONS.GOOGLE.GEMINI_2_5_PRO]: {
    name: "Gemini 2.5 Pro",
    description: "Advanced reasoning",
    context: "1M",
  },
  [MODEL_DEFINITIONS.GOOGLE.GEMINI_2_5_FLASH]: {
    name: "Gemini 2.5 Flash",
    description: "Fast & cost-effective",
    context: "1M",
  },
  [MODEL_DEFINITIONS.GOOGLE.GEMINI_2_5_FLASH_LITE]: {
    name: "Gemini 2.5 Flash Lite",
    description: "Ultra-light model",
    context: "1M",
  },
  [MODEL_DEFINITIONS.GOOGLE.GEMINI_2_5_FLASH_IMAGE_PREVIEW]: {
    name: "Gemini 2.5 Flash Image",
    description: "Vision capabilities",
    context: "1M",
  },

  // Groq
  [MODEL_DEFINITIONS.GROQ.GPT_OSS_20B]: {
    name: "GPT-OSS 20B",
    description: "Fast inference",
    context: "128k",
  },
  [MODEL_DEFINITIONS.GROQ.GPT_OSS_120B]: {
    name: "GPT-OSS 120B",
    description: "Powerful model",
    context: "128k",
  },
  [MODEL_DEFINITIONS.GROQ.QWEN3_32B]: {
    name: "Qwen3 32B",
    description: "Balanced performance",
    context: "32k",
  },

  // xAI
  [MODEL_DEFINITIONS.XAI.GROK_4]: {
    name: "Grok-4",
    description: "Advanced reasoning",
    context: "128k",
  },

  // LM Studio - Local Models
  [MODEL_DEFINITIONS.LMSTUDIO.LOCAL_LLAMA_70B]: {
    name: "Llama 70B Local",
    description: "Large local model",
    context: "32k",
  },
  [MODEL_DEFINITIONS.LMSTUDIO.LOCAL_MIXTRAL]: {
    name: "Mixtral 8x7B Local",
    description: "MoE local model",
    context: "32k",
  },
  [MODEL_DEFINITIONS.LMSTUDIO.LOCAL_QWEN]: {
    name: "Qwen 32B Local",
    description: "Efficient local",
    context: "32k",
  },
  [MODEL_DEFINITIONS.LMSTUDIO.LOCAL_GPT_OSS_20B]: {
    name: "GPT-OSS 20B Local",
    description: "Medium local model",
    context: "128k",
  },
  [MODEL_DEFINITIONS.LMSTUDIO.LOCAL_GPT_OSS_120B]: {
    name: "GPT-OSS 120B Local",
    description: "Large local model",
    context: "128k",
  },

  // Ollama
  [MODEL_DEFINITIONS.OLLAMA.QWEN2_5_VL]: {
    name: "Qwen2.5 VL",
    description: "Vision & language",
    context: "32k",
  },
  [MODEL_DEFINITIONS.OLLAMA.LLAMA3_8B]: {
    name: "Llama3 8B",
    description: "Fast local model",
    context: "8k",
  },
  [MODEL_DEFINITIONS.OLLAMA.MISTRAL_7B]: {
    name: "Mistral 7B",
    description: "Efficient model",
    context: "8k",
  },

  // vLLM - High Performance Inference
  [MODEL_DEFINITIONS.VLLM.VLLM_LLAMA_70B]: {
    name: "Llama 2 70B",
    description: "Large scale inference",
    context: "4k",
  },
  [MODEL_DEFINITIONS.VLLM.VLLM_MISTRAL_7B]: {
    name: "Mistral 7B",
    description: "Fast inference",
    context: "8k",
  },
  [MODEL_DEFINITIONS.VLLM.VLLM_QWEN_14B]: {
    name: "Qwen 14B",
    description: "Balanced inference",
    context: "8k",
  },
} as const;
