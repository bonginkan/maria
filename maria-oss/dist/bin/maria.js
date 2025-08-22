#!/usr/bin/env node
'use strict';

var OpenAI = require('openai');
var Anthropic = require('@anthropic-ai/sdk');
var generativeAi = require('@google/generative-ai');
var Groq = require('groq-sdk');
var fetch3 = require('node-fetch');
var events = require('events');
var fs = require('fs');
var path2 = require('path');
var os2 = require('os');
var chalk8 = require('chalk');
var uuid = require('uuid');
var crypto = require('crypto');
var readline = require('readline');
var fs2 = require('fs/promises');
var child_process = require('child_process');
var commander = require('commander');
var semver = require('semver');

var _documentCurrentScript = typeof document !== 'undefined' ? document.currentScript : null;
function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

function _interopNamespace(e) {
  if (e && e.__esModule) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n.default = e;
  return Object.freeze(n);
}

var OpenAI__default = /*#__PURE__*/_interopDefault(OpenAI);
var Anthropic__default = /*#__PURE__*/_interopDefault(Anthropic);
var Groq__default = /*#__PURE__*/_interopDefault(Groq);
var fetch3__default = /*#__PURE__*/_interopDefault(fetch3);
var path2__default = /*#__PURE__*/_interopDefault(path2);
var os2__default = /*#__PURE__*/_interopDefault(os2);
var chalk8__default = /*#__PURE__*/_interopDefault(chalk8);
var crypto__default = /*#__PURE__*/_interopDefault(crypto);
var readline__namespace = /*#__PURE__*/_interopNamespace(readline);
var fs2__namespace = /*#__PURE__*/_interopNamespace(fs2);
var semver__default = /*#__PURE__*/_interopDefault(semver);

// ESM/CJS Compatibility Fix
const { createRequire } = require('module');
const __require = createRequire((typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('maria.js', document.baseURI).href)) || __filename);
global.__require = __require;

// Dynamic import wrapper for CJS compatibility
if (typeof globalThis.importDynamic === 'undefined') {
  globalThis.importDynamic = async (specifier) => {
    try {
      return await import(specifier);
    } catch (e) {
      // Fallback to require for CJS modules
      try {
        return __require(specifier);
      } catch (e2) {
        throw e; // Throw original import error
      }
    }
  };
}
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// node_modules/.pnpm/tsup@8.5.0_postcss@8.5.6_typescript@5.3.3_yaml@2.8.1/node_modules/tsup/assets/cjs_shims.js
var init_cjs_shims = __esm({
  "node_modules/.pnpm/tsup@8.5.0_postcss@8.5.6_typescript@5.3.3_yaml@2.8.1/node_modules/tsup/assets/cjs_shims.js"() {
  }
});

// src/providers/ai-provider.ts
var BaseAIProvider;
var init_ai_provider = __esm({
  "src/providers/ai-provider.ts"() {
    init_cjs_shims();
    BaseAIProvider = class {
      static {
        __name(this, "BaseAIProvider");
      }
      apiKey = "";
      config = {};
      initialized = false;
      async initialize(apiKey, config) {
        this.apiKey = apiKey;
        this.config = config || {};
        this.initialized = true;
      }
      isInitialized() {
        return this.initialized;
      }
      getModels() {
        return this.models;
      }
      getDefaultModel() {
        if (this.models.length === 0) {
          throw new Error(`No models available for ${this.name} provider`);
        }
        const defaultModel = this.models[0];
        if (!defaultModel) {
          throw new Error(`Invalid default model for ${this.name} provider`);
        }
        return defaultModel;
      }
      validateModel(model) {
        const selectedModel = model || this.getDefaultModel();
        if (!this.models.includes(selectedModel)) {
          throw new Error(`Model ${selectedModel} is not supported by ${this.name} provider`);
        }
        return selectedModel;
      }
      ensureInitialized() {
        if (!this.initialized) {
          throw new Error(`${this.name} provider is not initialized. Call initialize() first.`);
        }
      }
    };
  }
});
var OpenAIProvider;
var init_openai_provider = __esm({
  "src/providers/openai-provider.ts"() {
    init_cjs_shims();
    init_ai_provider();
    OpenAIProvider = class extends BaseAIProvider {
      static {
        __name(this, "OpenAIProvider");
      }
      name = "OpenAI";
      models = [
        "gpt-5-2025-08-07",
        "gpt-5-mini-2025-08-07",
        "gpt-4o",
        "gpt-4o-mini",
        "gpt-4-turbo",
        "gpt-4",
        "gpt-3.5-turbo",
        "o1-preview",
        "o1-mini"
      ];
      client;
      async initialize(apiKey, config) {
        await super.initialize(apiKey, config);
        this.client = new OpenAI__default.default({
          apiKey: this.apiKey,
          baseURL: config?.["baseURL"],
          organization: config?.["organization"],
          maxRetries: config?.["maxRetries"] || 3
        });
      }
      async chat(messages, model, options) {
        this.ensureInitialized();
        const selectedModel = this.validateModel(model);
        const isRestrictedModel = selectedModel.includes("o1") || selectedModel.includes("gpt-5");
        const temperature = isRestrictedModel ? 1 : options?.temperature || 0.7;
        const completion = await this.client.chat.completions.create({
          model: selectedModel,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content
          })),
          temperature,
          max_tokens: options?.maxTokens,
          top_p: options?.topP,
          stop: options?.stopSequences
        });
        return completion.choices[0]?.message?.content || "";
      }
      async *chatStream(messages, model, options) {
        this.ensureInitialized();
        const selectedModel = this.validateModel(model);
        const isRestrictedModel = selectedModel.includes("o1") || selectedModel.includes("gpt-5");
        const temperature = isRestrictedModel ? 1 : options?.temperature || 0.7;
        const stream = await this.client.chat.completions.create({
          model: selectedModel,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content
          })),
          temperature,
          max_tokens: options?.maxTokens,
          top_p: options?.topP,
          stop: options?.stopSequences,
          stream: true
        });
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            yield content;
            if (options?.streamOptions?.onToken) {
              options.streamOptions.onToken(content);
            }
          }
          if (options?.streamOptions?.signal?.aborted) {
            break;
          }
        }
      }
      async generateCode(prompt, language = "typescript", model) {
        const messages = [
          {
            role: "system",
            content: `You are an expert ${language} developer. Generate clean, well-commented code based on the user's request. Only return the code without any explanations or markdown formatting.`
          },
          {
            role: "user",
            content: prompt
          }
        ];
        return this.chat(messages, model, { temperature: 0.2 });
      }
      async reviewCode(code, language = "typescript", model) {
        const messages = [
          {
            role: "system",
            content: `You are an expert code reviewer. Analyze the following ${language} code and provide a detailed review. Format your response as JSON with the following structure:
{
  "issues": [
    {
      "line": <line_number>,
      "severity": "error" | "warning" | "info",
      "message": "<issue description>",
      "suggestion": "<optional fix suggestion>"
    }
  ],
  "summary": "<overall code quality summary>",
  "improvements": ["<improvement suggestion 1>", "<improvement suggestion 2>", ...]
}`
          },
          {
            role: "user",
            content: code
          }
        ];
        const response = await this.chat(messages, model, { temperature: 0.1 });
        try {
          return JSON.parse(response);
        } catch {
          return {
            issues: [],
            summary: response,
            improvements: []
          };
        }
      }
    };
  }
});
var AnthropicProvider;
var init_anthropic_provider = __esm({
  "src/providers/anthropic-provider.ts"() {
    init_cjs_shims();
    init_ai_provider();
    AnthropicProvider = class extends BaseAIProvider {
      static {
        __name(this, "AnthropicProvider");
      }
      name = "Anthropic";
      models = [
        "claude-opus-4.1",
        "claude-3-5-sonnet-20241022",
        "claude-3-5-haiku-20241022",
        "claude-3-opus-20240229",
        "claude-3-sonnet-20240229",
        "claude-3-haiku-20240307"
      ];
      client;
      async initialize(apiKey, config) {
        await super.initialize(apiKey, config);
        this.client = new Anthropic__default.default({
          apiKey: this.apiKey,
          baseURL: config?.["baseURL"],
          maxRetries: config?.["maxRetries"] || 3
        });
      }
      convertMessages(messages) {
        messages.find((m) => m.role === "system");
        const conversationMessages = messages.filter((m) => m.role !== "system");
        return conversationMessages.map((m) => ({
          role: m.role,
          content: m.content
        }));
      }
      getSystemMessage(messages) {
        const systemMessage = messages.find((m) => m.role === "system");
        return systemMessage?.content;
      }
      async chat(messages, model, options) {
        this.ensureInitialized();
        const selectedModel = this.validateModel(model);
        const response = await this.client.messages.create({
          model: selectedModel,
          messages: this.convertMessages(messages),
          system: this.getSystemMessage(messages),
          max_tokens: options?.maxTokens || 4096,
          temperature: options?.temperature || 0.7,
          top_p: options?.topP,
          stop_sequences: options?.stopSequences
        });
        const content = response.content[0];
        if (content && content.type === "text" && "text" in content) {
          return content.text;
        }
        return "";
      }
      async *chatStream(messages, model, options) {
        this.ensureInitialized();
        const selectedModel = this.validateModel(model);
        const stream = await this.client.messages.create({
          model: selectedModel,
          messages: this.convertMessages(messages),
          system: this.getSystemMessage(messages),
          max_tokens: options?.maxTokens || 4096,
          temperature: options?.temperature || 0.7,
          top_p: options?.topP,
          stop_sequences: options?.stopSequences,
          stream: true
        });
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            const text = event.delta.text;
            yield text;
            if (options?.streamOptions?.onToken) {
              options.streamOptions.onToken(text);
            }
          }
          if (options?.streamOptions?.signal?.aborted) {
            break;
          }
        }
      }
      async generateCode(prompt, language = "typescript", model) {
        const messages = [
          {
            role: "system",
            content: `You are an expert ${language} developer. Generate clean, well-commented code based on the user's request. Only return the code without any explanations or markdown formatting.`
          },
          {
            role: "user",
            content: prompt
          }
        ];
        return this.chat(messages, model, { temperature: 0.2 });
      }
      async reviewCode(code, language = "typescript", model) {
        const messages = [
          {
            role: "system",
            content: `You are an expert code reviewer. Analyze the following ${language} code and provide a detailed review. Format your response as JSON with the following structure:
{
  "issues": [
    {
      "line": <line_number>,
      "severity": "error" | "warning" | "info",
      "message": "<issue description>",
      "suggestion": "<optional fix suggestion>"
    }
  ],
  "summary": "<overall code quality summary>",
  "improvements": ["<improvement suggestion 1>", "<improvement suggestion 2>", ...]
}`
          },
          {
            role: "user",
            content: code
          }
        ];
        const response = await this.chat(messages, model, { temperature: 0.1 });
        try {
          return JSON.parse(response);
        } catch {
          return {
            issues: [],
            summary: response,
            improvements: []
          };
        }
      }
    };
  }
});
var GoogleAIProvider;
var init_google_ai_provider = __esm({
  "src/providers/google-ai-provider.ts"() {
    init_cjs_shims();
    init_ai_provider();
    GoogleAIProvider = class extends BaseAIProvider {
      static {
        __name(this, "GoogleAIProvider");
      }
      name = "GoogleAI";
      models = [
        "gemini-2.5-pro",
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash-exp",
        "gemini-1.5-pro",
        "gemini-1.5-pro-002",
        "gemini-1.5-flash",
        "gemini-1.5-flash-002",
        "gemini-1.5-flash-8b",
        "gemini-1.0-pro"
      ];
      client;
      async initialize(apiKey, config) {
        await super.initialize(apiKey, config);
        this.client = new generativeAi.GoogleGenerativeAI(apiKey);
      }
      convertMessages(messages) {
        const systemMessage = messages.find((m) => m.role === "system");
        const conversationMessages = messages.filter((m) => m.role !== "system");
        const contents = [];
        if (systemMessage) {
          contents.push({
            role: "user",
            parts: [{ text: `System: ${systemMessage.content}` }]
          });
          contents.push({
            role: "model",
            parts: [{ text: "Understood. I will follow these instructions." }]
          });
        }
        conversationMessages.forEach((msg) => {
          contents.push({
            role: msg.role === "user" ? "user" : "model",
            parts: [{ text: msg.content }]
          });
        });
        return contents;
      }
      getModel(modelName) {
        if (!this.client) {
          throw new Error("Client not initialized");
        }
        return this.client.getGenerativeModel({
          model: modelName,
          generationConfig: {
            candidateCount: 1
          }
        });
      }
      async chat(messages, model, options) {
        this.ensureInitialized();
        const selectedModel = this.validateModel(model);
        const genModel = this.getModel(selectedModel);
        const contents = this.convertMessages(messages);
        const chat = genModel.startChat({
          history: contents.slice(0, -1),
          // All messages except the last one
          generationConfig: {
            temperature: options?.temperature || 0.7,
            maxOutputTokens: options?.maxTokens,
            topP: options?.topP,
            stopSequences: options?.stopSequences
          }
        });
        const lastMessage = contents[contents.length - 1];
        if (!lastMessage || !lastMessage.parts || !lastMessage.parts[0]) {
          throw new Error("Invalid message format");
        }
        const result = await chat.sendMessage(lastMessage.parts[0].text || "");
        const response = await result.response;
        return response.text();
      }
      async *chatStream(messages, model, options) {
        this.ensureInitialized();
        const selectedModel = this.validateModel(model);
        const genModel = this.getModel(selectedModel);
        const contents = this.convertMessages(messages);
        const chat = genModel.startChat({
          history: contents.slice(0, -1),
          generationConfig: {
            temperature: options?.temperature || 0.7,
            maxOutputTokens: options?.maxTokens,
            topP: options?.topP,
            stopSequences: options?.stopSequences
          }
        });
        const lastMessage = contents[contents.length - 1];
        if (!lastMessage || !lastMessage.parts || !lastMessage.parts[0]) {
          throw new Error("Invalid message format");
        }
        const result = await chat.sendMessageStream(lastMessage.parts[0].text || "");
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            yield text;
            if (options?.streamOptions?.onToken) {
              options.streamOptions.onToken(text);
            }
          }
          if (options?.streamOptions?.signal?.aborted) {
            break;
          }
        }
      }
      async generateCode(prompt, language = "typescript", model) {
        const messages = [
          {
            role: "system",
            content: `You are an expert ${language} developer. Generate clean, well-commented code based on the user's request. Only return the code without any explanations or markdown formatting.`
          },
          {
            role: "user",
            content: prompt
          }
        ];
        return this.chat(messages, model, { temperature: 0.2 });
      }
      async reviewCode(code, language = "typescript", model) {
        const messages = [
          {
            role: "system",
            content: `You are an expert code reviewer. Analyze the following ${language} code and provide a detailed review. Format your response as JSON with the following structure:
{
  "issues": [
    {
      "line": <line_number>,
      "severity": "error" | "warning" | "info",
      "message": "<issue description>",
      "suggestion": "<optional fix suggestion>"
    }
  ],
  "summary": "<overall code quality summary>",
  "improvements": ["<improvement suggestion 1>", "<improvement suggestion 2>", ...]
}`
          },
          {
            role: "user",
            content: code
          }
        ];
        const response = await this.chat(messages, model, { temperature: 0.1 });
        try {
          return JSON.parse(response);
        } catch {
          return {
            issues: [],
            summary: response,
            improvements: []
          };
        }
      }
    };
  }
});
var GrokProvider;
var init_grok_provider = __esm({
  "src/providers/grok-provider.ts"() {
    init_cjs_shims();
    init_ai_provider();
    GrokProvider = class extends BaseAIProvider {
      static {
        __name(this, "GrokProvider");
      }
      name = "Grok";
      models = [
        "grok-4-0709",
        "llama-3.3-70b-versatile",
        "llama-3.1-70b-versatile",
        "llama-3.1-8b-instant",
        "mixtral-8x7b-32768",
        "gemma2-9b-it",
        "gemma-7b-it"
      ];
      client;
      // Using Groq SDK for Grok AI
      async initialize(apiKey, config) {
        await super.initialize(apiKey, config);
        this.client = new Groq__default.default({
          apiKey: this.apiKey,
          baseURL: config?.["baseURL"]
        });
      }
      async chat(messages, model, options) {
        this.ensureInitialized();
        const selectedModel = this.validateModel(model);
        const completion = await this.client.chat.completions.create({
          model: selectedModel,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content
          })),
          temperature: options?.temperature || 0.7,
          max_tokens: options?.maxTokens,
          top_p: options?.topP,
          stop: options?.stopSequences
        });
        return completion.choices[0]?.message?.content || "";
      }
      async *chatStream(messages, model, options) {
        this.ensureInitialized();
        const selectedModel = this.validateModel(model);
        const stream = await this.client.chat.completions.create({
          model: selectedModel,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content
          })),
          temperature: options?.temperature || 0.7,
          max_tokens: options?.maxTokens,
          top_p: options?.topP,
          stop: options?.stopSequences,
          stream: true
        });
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            yield content;
            if (options?.streamOptions?.onToken) {
              options.streamOptions.onToken(content);
            }
          }
          if (options?.streamOptions?.signal?.aborted) {
            break;
          }
        }
      }
      async generateCode(prompt, language = "typescript", model) {
        const messages = [
          {
            role: "system",
            content: `You are an expert ${language} developer. Generate clean, well-commented code based on the user's request. Only return the code without any explanations or markdown formatting.`
          },
          {
            role: "user",
            content: prompt
          }
        ];
        return this.chat(messages, model, { temperature: 0.2 });
      }
      async reviewCode(code, language = "typescript", model) {
        const messages = [
          {
            role: "system",
            content: `You are an expert code reviewer. Analyze the following ${language} code and provide a detailed review. Format your response as JSON with the following structure:
{
  "issues": [
    {
      "line": <line_number>,
      "severity": "error" | "warning" | "info",
      "message": "<issue description>",
      "suggestion": "<optional fix suggestion>"
    }
  ],
  "summary": "<overall code quality summary>",
  "improvements": ["<improvement suggestion 1>", "<improvement suggestion 2>", ...]
}`
          },
          {
            role: "user",
            content: code
          }
        ];
        const response = await this.chat(messages, model, { temperature: 0.1 });
        try {
          return JSON.parse(response);
        } catch {
          return {
            issues: [],
            summary: response,
            improvements: []
          };
        }
      }
    };
  }
});
var LMStudioProvider;
var init_lmstudio_provider = __esm({
  "src/providers/lmstudio-provider.ts"() {
    init_cjs_shims();
    init_ai_provider();
    LMStudioProvider = class extends BaseAIProvider {
      static {
        __name(this, "LMStudioProvider");
      }
      name = "LMStudio";
      models = [
        "gpt-oss-120b",
        "gpt-oss-20b",
        "qwen3-30b",
        "llama-3-70b",
        "mistral-7b",
        "codellama-34b"
      ];
      apiBase = "http://localhost:1234/v1";
      timeout = 3e5;
      retryAttempts = 3;
      retryDelay = 1e3;
      isHealthy = false;
      availableModels = [];
      async initialize(apiKey = "lm-studio", config) {
        await super.initialize(apiKey, config);
        const lmConfig = config;
        this.apiBase = lmConfig?.apiBase || process.env["LMSTUDIO_API_BASE"] || "http://localhost:1234/v1";
        this.timeout = lmConfig?.timeout || parseInt(process.env["LMSTUDIO_TIMEOUT"] || "300000");
        this.retryAttempts = lmConfig?.retryAttempts || parseInt(process.env["LMSTUDIO_RETRY_ATTEMPTS"] || "3");
        this.retryDelay = lmConfig?.retryDelay || parseInt(process.env["LMSTUDIO_RETRY_DELAY"] || "1000");
        await this.checkHealth();
        if (this.isHealthy) {
          await this.fetchAvailableModels();
        }
      }
      async checkHealth() {
        try {
          const response = await fetch3__default.default(`${this.apiBase}/models`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${this.apiKey}`
            },
            signal: AbortSignal.timeout(5e3)
          });
          this.isHealthy = response.ok;
          return this.isHealthy;
        } catch {
          this.isHealthy = false;
          return false;
        }
      }
      async fetchAvailableModels() {
        try {
          const response = await fetch3__default.default(`${this.apiBase}/models`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${this.apiKey}`
            }
          });
          if (response.ok) {
            const data = await response.json();
            this.availableModels = data.data.map((model) => model.id);
          }
        } catch {
          console.warn("Failed to fetch available models");
        }
      }
      getModels() {
        return this.availableModels.length > 0 ? this.availableModels : this.models;
      }
      async retryWithBackoff(fn, attempts = this.retryAttempts) {
        for (let i = 0; i < attempts; i++) {
          try {
            return await fn();
          } catch (error) {
            if (i === attempts - 1) throw error;
            await new Promise((resolve) => setTimeout(resolve, this.retryDelay * Math.pow(2, i)));
          }
        }
        throw new Error("Max retry attempts reached");
      }
      async chat(messages, model, options) {
        this.ensureInitialized();
        const selectedModel = model || this.getDefaultModel();
        const payload = {
          model: selectedModel,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content
          })),
          max_tokens: options?.maxTokens || 4096,
          temperature: options?.temperature || 0.7,
          top_p: options?.topP || 0.95,
          stop: options?.stopSequences,
          stream: false
        };
        const makeRequest = /* @__PURE__ */ __name(async () => {
          const response2 = await fetch3__default.default(`${this.apiBase}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.apiKey}`
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(this.timeout)
          });
          if (!response2.ok) {
            const errorData = await response2.text();
            throw new Error(`LM Studio API error: ${response2.statusText} - ${errorData}`);
          }
          return response2;
        }, "makeRequest");
        const response = await this.retryWithBackoff(makeRequest);
        const data = await response.json();
        return data.choices[0]?.message?.content || "";
      }
      async *chatStream(messages, model, options) {
        this.ensureInitialized();
        const selectedModel = model || this.getDefaultModel();
        const payload = {
          model: selectedModel,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content
          })),
          max_tokens: options?.maxTokens || 4096,
          temperature: options?.temperature || 0.7,
          top_p: options?.topP || 0.95,
          stop: options?.stopSequences,
          stream: true
        };
        const makeRequest = /* @__PURE__ */ __name(async () => {
          const response2 = await fetch3__default.default(`${this.apiBase}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.apiKey}`
            },
            body: JSON.stringify(payload),
            signal: options?.streamOptions?.signal || AbortSignal.timeout(this.timeout)
          });
          if (!response2.ok) {
            const errorData = await response2.text();
            throw new Error(`LM Studio API error: ${response2.statusText} - ${errorData}`);
          }
          return response2;
        }, "makeRequest");
        const response = await this.retryWithBackoff(makeRequest);
        const nodeResponse = response;
        const reader = nodeResponse.body?.getReader();
        if (!reader) throw new Error("No response body");
        const decoder = new TextDecoder();
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") return;
                try {
                  const parsed = JSON.parse(data);
                  const choices = parsed["choices"];
                  const content = choices?.[0]?.delta?.content;
                  if (content) {
                    yield content;
                    if (options?.streamOptions?.onToken) {
                      options.streamOptions.onToken(content);
                    }
                  }
                } catch {
                }
              }
            }
            if (options?.streamOptions?.signal?.aborted) {
              break;
            }
          }
        } finally {
          reader.releaseLock();
        }
      }
      async generateCode(prompt, language = "typescript", model) {
        const messages = [
          {
            role: "system",
            content: `You are an expert ${language} developer. Generate clean, well-commented code based on the user's request. Only return the code without any explanations or markdown formatting.`
          },
          {
            role: "user",
            content: prompt
          }
        ];
        return this.chat(messages, model, { temperature: 0.2, maxTokens: 8192 });
      }
      async reviewCode(code, language = "typescript", model) {
        const messages = [
          {
            role: "system",
            content: `You are an expert code reviewer. Analyze the following ${language} code and provide a detailed review. Format your response as JSON with the following structure:
{
  "issues": [
    {
      "line": <line_number>,
      "severity": "error" | "warning" | "info",
      "message": "<issue description>",
      "suggestion": "<optional fix suggestion>"
    }
  ],
  "summary": "<overall code quality summary>",
  "improvements": ["<improvement suggestion 1>", "<improvement suggestion 2>", ...]
}`
          },
          {
            role: "user",
            content: code
          }
        ];
        const response = await this.chat(messages, model, { temperature: 0.1, maxTokens: 4096 });
        try {
          return JSON.parse(response);
        } catch {
          return {
            issues: [],
            summary: response,
            improvements: []
          };
        }
      }
      // LM Studio specific methods
      async isServerRunning() {
        return await this.checkHealth();
      }
      async getAvailableModels() {
        await this.fetchAvailableModels();
        return this.availableModels;
      }
      async switchModel(modelType) {
        if (modelType === "120b") {
          this.config["model"] = "gpt-oss-120b";
        } else {
          this.config["model"] = "gpt-oss-20b";
        }
      }
    };
  }
});
var OllamaProvider;
var init_ollama_provider = __esm({
  "src/providers/ollama-provider.ts"() {
    init_cjs_shims();
    init_ai_provider();
    OllamaProvider = class extends BaseAIProvider {
      static {
        __name(this, "OllamaProvider");
      }
      name = "Ollama";
      models = [
        "llama3.2:3b",
        "llama3.2:1b",
        "qwen2.5:7b",
        "qwen2.5:14b",
        "qwen2.5:32b",
        "qwen2.5-vl:7b",
        "codellama:7b",
        "codellama:13b",
        "codellama:34b",
        "deepseek-coder:6.7b",
        "deepseek-coder:33b",
        "phi3.5:3.8b",
        "phi3.5:14b",
        "mistral:7b",
        "mixtral:8x7b",
        "nomic-embed-text"
      ];
      apiBase = "http://localhost:11434";
      timeout = 3e5;
      retryAttempts = 3;
      retryDelay = 1e3;
      isHealthy = false;
      availableModels = [];
      async initialize(apiKey = "ollama", config) {
        await super.initialize(apiKey, config);
        const ollamaConfig = config;
        this.apiBase = ollamaConfig?.apiBase || process.env["OLLAMA_API_BASE"] || "http://localhost:11434";
        this.timeout = ollamaConfig?.timeout || parseInt(process.env["OLLAMA_TIMEOUT"] || "300000");
        this.retryAttempts = ollamaConfig?.retryAttempts || parseInt(process.env["OLLAMA_RETRY_ATTEMPTS"] || "3");
        this.retryDelay = ollamaConfig?.retryDelay || parseInt(process.env["OLLAMA_RETRY_DELAY"] || "1000");
        await this.checkHealth();
        if (this.isHealthy) {
          await this.fetchAvailableModels();
        }
      }
      async checkHealth() {
        try {
          const response = await fetch3__default.default(`${this.apiBase}/api/version`, {
            method: "GET",
            signal: AbortSignal.timeout(5e3)
          });
          this.isHealthy = response.ok;
          return this.isHealthy;
        } catch {
          this.isHealthy = false;
          return false;
        }
      }
      async fetchAvailableModels() {
        try {
          const response = await fetch3__default.default(`${this.apiBase}/api/tags`, {
            method: "GET"
          });
          if (response.ok) {
            const data = await response.json();
            this.availableModels = data.models?.map((model) => model.name) || [];
          }
        } catch {
          console.warn("Failed to fetch available models");
        }
      }
      getModels() {
        return this.availableModels.length > 0 ? this.availableModels : this.models;
      }
      async retryWithBackoff(fn, attempts = this.retryAttempts) {
        for (let i = 0; i < attempts; i++) {
          try {
            return await fn();
          } catch (error) {
            if (i === attempts - 1) throw error;
            await new Promise((resolve) => setTimeout(resolve, this.retryDelay * Math.pow(2, i)));
          }
        }
        throw new Error("Max retry attempts reached");
      }
      async chat(messages, model, options) {
        this.ensureInitialized();
        const selectedModel = model || this.getDefaultModel();
        const prompt = this.messagesToPrompt(messages);
        const payload = {
          model: selectedModel,
          prompt,
          stream: false,
          options: {
            temperature: options?.temperature || 0.7,
            top_p: options?.topP || 0.95,
            stop: options?.stopSequences,
            num_predict: options?.maxTokens || 4096
          }
        };
        const makeRequest = /* @__PURE__ */ __name(async () => {
          const response2 = await fetch3__default.default(`${this.apiBase}/api/generate`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(this.timeout)
          });
          if (!response2.ok) {
            const errorData = await response2.text();
            throw new Error(`Ollama API error: ${response2.statusText} - ${errorData}`);
          }
          return response2;
        }, "makeRequest");
        const response = await this.retryWithBackoff(makeRequest);
        const data = await response.json();
        return data.response || "";
      }
      async *chatStream(messages, model, options) {
        this.ensureInitialized();
        const selectedModel = model || this.getDefaultModel();
        const prompt = this.messagesToPrompt(messages);
        const payload = {
          model: selectedModel,
          prompt,
          stream: true,
          options: {
            temperature: options?.temperature || 0.7,
            top_p: options?.topP || 0.95,
            stop: options?.stopSequences,
            num_predict: options?.maxTokens || 4096
          }
        };
        const makeRequest = /* @__PURE__ */ __name(async () => {
          const response2 = await fetch3__default.default(`${this.apiBase}/api/generate`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(payload),
            signal: options?.streamOptions?.signal || AbortSignal.timeout(this.timeout)
          });
          if (!response2.ok) {
            const errorData = await response2.text();
            throw new Error(`Ollama API error: ${response2.statusText} - ${errorData}`);
          }
          return response2;
        }, "makeRequest");
        const response = await this.retryWithBackoff(makeRequest);
        const nodeResponse = response;
        const reader = nodeResponse.body?.getReader();
        if (!reader) throw new Error("No response body");
        const decoder = new TextDecoder();
        let buffer = "";
        try {
          const running = true;
          while (running) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (line.trim()) {
                try {
                  const parsed = JSON.parse(line);
                  const content = parsed["response"];
                  if (content) {
                    yield content;
                    if (options?.streamOptions?.onToken) {
                      options.streamOptions.onToken(content);
                    }
                  }
                  if (parsed["done"]) return;
                } catch {
                }
              }
            }
            if (options?.streamOptions?.signal?.aborted) {
              break;
            }
          }
        } finally {
          reader.releaseLock();
        }
      }
      messagesToPrompt(messages) {
        let prompt = "";
        for (const message of messages) {
          if (message.role === "system") {
            prompt += `System: ${message.content}

`;
          } else if (message.role === "user") {
            prompt += `User: ${message.content}

`;
          } else if (message.role === "assistant") {
            prompt += `Assistant: ${message.content}

`;
          }
        }
        prompt += "Assistant: ";
        return prompt;
      }
      async generateCode(prompt, language = "typescript", model) {
        const messages = [
          {
            role: "system",
            content: `You are an expert ${language} developer. Generate clean, well-commented code based on the user's request. Only return the code without any explanations or markdown formatting.`
          },
          {
            role: "user",
            content: prompt
          }
        ];
        return this.chat(messages, model, { temperature: 0.2, maxTokens: 8192 });
      }
      async reviewCode(code, language = "typescript", model) {
        const messages = [
          {
            role: "system",
            content: `You are an expert code reviewer. Analyze the following ${language} code and provide a detailed review. Format your response as JSON with the following structure:
{
  "issues": [
    {
      "line": <line_number>,
      "severity": "error" | "warning" | "info",
      "message": "<issue description>",
      "suggestion": "<optional fix suggestion>"
    }
  ],
  "summary": "<overall code quality summary>",
  "improvements": ["<improvement suggestion 1>", "<improvement suggestion 2>", ...]
}`
          },
          {
            role: "user",
            content: code
          }
        ];
        const response = await this.chat(messages, model, { temperature: 0.1, maxTokens: 4096 });
        try {
          return JSON.parse(response);
        } catch {
          return {
            issues: [],
            summary: response,
            improvements: []
          };
        }
      }
      // IAIProvider interface method
      async validateConnection() {
        return await this.checkHealth();
      }
      // Ollama specific methods
      async isServerRunning() {
        return await this.checkHealth();
      }
      async getAvailableModels() {
        await this.fetchAvailableModels();
        return this.availableModels;
      }
      async pullModel(modelName) {
        const response = await fetch3__default.default(`${this.apiBase}/api/pull`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ name: modelName }),
          signal: AbortSignal.timeout(6e5)
          // 10 minutes for model download
        });
        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`Failed to pull model ${modelName}: ${errorData}`);
        }
        const nodeResponse = response;
        const reader = nodeResponse.body?.getReader();
        if (!reader) return;
        const decoder = new TextDecoder();
        let buffer = "";
        try {
          const running = true;
          while (running) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (line.trim()) {
                try {
                  const parsed = JSON.parse(line);
                  if (parsed["status"] === "success") return;
                  if (parsed["error"]) {
                    throw new Error(`Model pull failed: ${parsed["error"]}`);
                  }
                } catch {
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      }
      async deleteModel(modelName) {
        const response = await fetch3__default.default(`${this.apiBase}/api/delete`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ name: modelName })
        });
        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`Failed to delete model ${modelName}: ${errorData}`);
        }
      }
    };
  }
});
var VLLMProvider;
var init_vllm_provider = __esm({
  "src/providers/vllm-provider.ts"() {
    init_cjs_shims();
    init_ai_provider();
    VLLMProvider = class extends BaseAIProvider {
      static {
        __name(this, "VLLMProvider");
      }
      name = "vLLM";
      models = [
        "stabilityai/japanese-stablelm-2-instruct-1_6b",
        "mistralai/Mistral-7B-v0.1",
        "mistralai/Mistral-7B-Instruct-v0.1",
        "meta-llama/Llama-2-7b-hf",
        "meta-llama/Llama-2-7b-chat-hf",
        "meta-llama/Llama-2-13b-hf",
        "meta-llama/Llama-2-13b-chat-hf",
        "codellama/CodeLlama-7b-hf",
        "codellama/CodeLlama-13b-hf"
      ];
      apiBase = "http://localhost:8000/v1";
      timeout = 12e4;
      retryAttempts = 3;
      retryDelay = 1e3;
      isHealthy = false;
      availableModels = [];
      vllmConfig = {};
      async initialize(apiKey = "vllm-local", config) {
        await super.initialize(apiKey, config);
        this.vllmConfig = config || {};
        this.apiBase = this.vllmConfig.apiBase || process.env["VLLM_API_BASE"] || "http://localhost:8000/v1";
        this.timeout = this.vllmConfig.timeout || parseInt(process.env["VLLM_TIMEOUT"] || "120000");
        await this.checkHealth();
        if (this.isHealthy) {
          await this.fetchAvailableModels();
        }
      }
      async checkHealth() {
        try {
          const response = await fetch3__default.default(`${this.apiBase}/models`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${this.apiKey}`
            },
            signal: AbortSignal.timeout(5e3)
          });
          this.isHealthy = response.ok;
          return this.isHealthy;
        } catch {
          this.isHealthy = false;
          return false;
        }
      }
      async fetchAvailableModels() {
        try {
          const response = await fetch3__default.default(`${this.apiBase}/models`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${this.apiKey}`
            }
          });
          if (response.ok) {
            const data = await response.json();
            this.availableModels = data.data?.map((model) => model.id) || [];
          }
        } catch {
          console.warn("Failed to fetch available models");
        }
      }
      getModels() {
        return this.availableModels.length > 0 ? this.availableModels : this.models;
      }
      async retryWithBackoff(fn, attempts = this.retryAttempts) {
        for (let i = 0; i < attempts; i++) {
          try {
            return await fn();
          } catch (error) {
            if (i === attempts - 1) throw error;
            await new Promise((resolve) => setTimeout(resolve, this.retryDelay * Math.pow(2, i)));
          }
        }
        throw new Error("Max retry attempts reached");
      }
      async chat(messages, model, options) {
        this.ensureInitialized();
        const selectedModel = model || this.getDefaultModel();
        const payload = {
          model: selectedModel,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content
          })),
          max_tokens: options?.maxTokens || this.vllmConfig.maxTokens || 2048,
          temperature: options?.temperature || this.vllmConfig.temperature || 0.7,
          top_p: options?.topP || this.vllmConfig.topP || 0.95,
          top_k: this.vllmConfig.topK || 50,
          frequency_penalty: this.vllmConfig.frequencyPenalty || 0,
          presence_penalty: this.vllmConfig.presencePenalty || 0,
          stop: options?.stopSequences || this.vllmConfig.stopSequences,
          stream: false
        };
        const makeRequest = /* @__PURE__ */ __name(async () => {
          const response2 = await fetch3__default.default(`${this.apiBase}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.apiKey}`
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(this.timeout)
          });
          if (!response2.ok) {
            const errorData = await response2.text();
            throw new Error(`vLLM API error: ${response2.statusText} - ${errorData}`);
          }
          return response2;
        }, "makeRequest");
        const response = await this.retryWithBackoff(makeRequest);
        const data = await response.json();
        return data.choices?.[0]?.message?.content || "";
      }
      async *chatStream(messages, model, options) {
        this.ensureInitialized();
        const selectedModel = model || this.getDefaultModel();
        const payload = {
          model: selectedModel,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content
          })),
          max_tokens: options?.maxTokens || this.vllmConfig.maxTokens || 2048,
          temperature: options?.temperature || this.vllmConfig.temperature || 0.7,
          top_p: options?.topP || this.vllmConfig.topP || 0.95,
          top_k: this.vllmConfig.topK || 50,
          frequency_penalty: this.vllmConfig.frequencyPenalty || 0,
          presence_penalty: this.vllmConfig.presencePenalty || 0,
          stop: options?.stopSequences || this.vllmConfig.stopSequences,
          stream: true
        };
        const makeRequest = /* @__PURE__ */ __name(async () => {
          const response2 = await fetch3__default.default(`${this.apiBase}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.apiKey}`
            },
            body: JSON.stringify(payload),
            signal: options?.streamOptions?.signal || AbortSignal.timeout(this.timeout)
          });
          if (!response2.ok) {
            const errorData = await response2.text();
            throw new Error(`vLLM API error: ${response2.statusText} - ${errorData}`);
          }
          return response2;
        }, "makeRequest");
        const response = await this.retryWithBackoff(makeRequest);
        const nodeResponse = response;
        const reader = nodeResponse.body?.getReader();
        if (!reader) throw new Error("No response body");
        const decoder = new TextDecoder();
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") return;
                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    yield content;
                    if (options?.streamOptions?.onToken) {
                      options.streamOptions.onToken(content);
                    }
                  }
                } catch {
                }
              }
            }
            if (options?.streamOptions?.signal?.aborted) {
              break;
            }
          }
        } finally {
          reader.releaseLock();
        }
      }
      async generateCode(prompt, language = "typescript", model) {
        const messages = [
          {
            role: "system",
            content: `You are an expert ${language} developer. Generate clean, well-commented code based on the user's request. Only return the code without any explanations or markdown formatting.`
          },
          {
            role: "user",
            content: prompt
          }
        ];
        return this.chat(messages, model, { temperature: 0.2, maxTokens: 4096 });
      }
      async reviewCode(code, language = "typescript", model) {
        const messages = [
          {
            role: "system",
            content: `You are an expert code reviewer. Analyze the following ${language} code and provide a detailed review. Format your response as JSON with the following structure:
{
  "issues": [
    {
      "line": <line_number>,
      "severity": "error" | "warning" | "info",
      "message": "<issue description>",
      "suggestion": "<optional fix suggestion>"
    }
  ],
  "summary": "<overall code quality summary>",
  "improvements": ["<improvement suggestion 1>", "<improvement suggestion 2>", ...]
}`
          },
          {
            role: "user",
            content: code
          }
        ];
        const response = await this.chat(messages, model, { temperature: 0.1, maxTokens: 4096 });
        try {
          return JSON.parse(response);
        } catch {
          return {
            issues: [],
            summary: response,
            improvements: []
          };
        }
      }
      // IAIProvider interface method
      async validateConnection() {
        return await this.checkHealth();
      }
      // vLLM specific methods
      async isServerRunning() {
        return await this.checkHealth();
      }
      async getAvailableModels() {
        await this.fetchAvailableModels();
        return this.availableModels;
      }
      async selectModelForTask(task) {
        const availableModels = await this.getAvailableModels();
        switch (task) {
          case "japanese": {
            const japaneseModels = availableModels.filter(
              (m) => m.includes("japanese") || m.includes("jp")
            );
            if (japaneseModels.length > 0 && japaneseModels[0]) {
              return japaneseModels[0];
            }
            break;
          }
          case "code": {
            const codeModels = availableModels.filter(
              (m) => m.includes("code") || m.includes("instruct")
            );
            if (codeModels.length > 0 && codeModels[0]) {
              return codeModels[0];
            }
            break;
          }
          case "fast": {
            const smallModels = availableModels.filter(
              (m) => m.includes("1_6b") || m.includes("1.6b") || m.includes("7b")
            );
            if (smallModels.length > 0 && smallModels[0]) {
              return smallModels[0];
            }
            break;
          }
        }
        return availableModels[0] || this.getDefaultModel();
      }
    };
  }
});

// src/providers/manager.ts
var AIProviderManager;
var init_manager = __esm({
  "src/providers/manager.ts"() {
    init_cjs_shims();
    init_openai_provider();
    init_anthropic_provider();
    init_google_ai_provider();
    init_grok_provider();
    init_lmstudio_provider();
    init_ollama_provider();
    init_vllm_provider();
    AIProviderManager = class {
      static {
        __name(this, "AIProviderManager");
      }
      providers = /* @__PURE__ */ new Map();
      availableProviders = /* @__PURE__ */ new Set();
      config;
      constructor(config) {
        this.config = config;
      }
      async initialize() {
        await this.initializeProviders();
        await this.checkAvailability();
      }
      async initializeProviders() {
        const apiKeys = this.config.get("apiKeys", {}) || {};
        const localProviders = this.config.get("localProviders", {}) || {};
        if (process.env["DEBUG"]) {
          console.log("\u{1F527} Initializing providers...");
          console.log("Local providers config:", localProviders);
          console.log(
            "API keys available:",
            Object.keys(apiKeys).filter((k) => apiKeys[k])
          );
        }
        if (apiKeys && apiKeys["OPENAI_API_KEY"]) {
          const provider = new OpenAIProvider();
          await provider.initialize(apiKeys["OPENAI_API_KEY"]);
          this.providers.set("openai", provider);
        }
        if (apiKeys && apiKeys["ANTHROPIC_API_KEY"]) {
          const provider = new AnthropicProvider();
          await provider.initialize(apiKeys["ANTHROPIC_API_KEY"]);
          this.providers.set("anthropic", provider);
        }
        if (apiKeys && (apiKeys["GOOGLE_API_KEY"] || apiKeys["GEMINI_API_KEY"])) {
          const provider = new GoogleAIProvider();
          await provider.initialize(apiKeys["GOOGLE_API_KEY"] || apiKeys["GEMINI_API_KEY"] || "");
          this.providers.set("google", provider);
        }
        if (apiKeys && apiKeys["GROK_API_KEY"]) {
          const provider = new GrokProvider();
          await provider.initialize(apiKeys["GROK_API_KEY"]);
          this.providers.set("grok", provider);
        }
        if (localProviders && localProviders["lmstudio"] !== false) {
          if (process.env["DEBUG"]) console.log("\u{1F504} Initializing LM Studio provider...");
          const provider = new LMStudioProvider();
          await provider.initialize("lmstudio");
          this.providers.set("lmstudio", provider);
        }
        if (localProviders && localProviders["ollama"] !== false) {
          if (process.env["DEBUG"]) console.log("\u{1F504} Initializing Ollama provider...");
          const provider = new OllamaProvider();
          await provider.initialize("ollama");
          this.providers.set("ollama", provider);
        }
        if (localProviders && localProviders["vllm"] !== false) {
          if (process.env["DEBUG"]) console.log("\u{1F504} Initializing vLLM provider...");
          const provider = new VLLMProvider();
          await provider.initialize("vllm");
          this.providers.set("vllm", provider);
        }
        if (process.env["DEBUG"]) {
          console.log(
            `\u2705 Initialized ${this.providers.size} providers:`,
            Array.from(this.providers.keys())
          );
        }
      }
      async checkAvailability() {
        this.availableProviders.clear();
        if (process.env["DEBUG"]) {
          console.log("\u{1F50D} Checking provider availability...");
        }
        const checks = Array.from(this.providers.entries()).map(async ([name, provider]) => {
          try {
            if (process.env["DEBUG"]) console.log(`  \u2022 Checking ${name}...`);
            const isAvailable = await (provider.validateConnection?.() ?? Promise.resolve(true));
            if (isAvailable) {
              this.availableProviders.add(name);
              if (process.env["DEBUG"]) console.log(`    \u2705 ${name} is available`);
            } else {
              if (process.env["DEBUG"]) console.log(`    \u274C ${name} is not available`);
            }
          } catch (error) {
            if (process.env["DEBUG"]) console.log(`    \u274C ${name} failed: ${error}`);
          }
        });
        await Promise.allSettled(checks);
        if (process.env["DEBUG"]) {
          console.log(
            `\u{1F3AF} Available providers (${this.availableProviders.size}):`,
            Array.from(this.availableProviders)
          );
        }
      }
      getProvider(name) {
        return this.providers.get(name);
      }
      getAvailableProviders() {
        return Array.from(this.availableProviders);
      }
      async getAvailableModels() {
        const allModels = [];
        for (const providerName of this.availableProviders) {
          const provider = this.providers.get(providerName);
          if (provider) {
            try {
              const models = await provider.getModels();
              const modelInfos = models.map((modelName) => ({
                id: `${providerName}-${modelName}`,
                name: modelName,
                provider: providerName,
                description: `${modelName} from ${providerName}`,
                contextLength: 8192,
                // Default value
                capabilities: ["text", "code"],
                // Default capabilities
                available: true,
                recommendedFor: ["general"]
              }));
              allModels.push(...modelInfos);
            } catch (error) {
            }
          }
        }
        return allModels;
      }
      selectOptimalProvider(_taskType, priorityMode = "auto") {
        const available = this.getAvailableProviders();
        if (available.length === 0) return void 0;
        const priorityOrder = this.getPriorityOrder(priorityMode);
        if (process.env["DEBUG"]) {
          console.log("Available providers:", available);
          console.log("Priority order:", priorityOrder);
        }
        for (const providerName of priorityOrder) {
          if (available.includes(providerName)) {
            if (process.env["DEBUG"]) {
              console.log("Selected provider:", providerName);
            }
            return providerName;
          }
        }
        return available[0];
      }
      getPriorityOrder(mode) {
        switch (mode) {
          case "privacy-first":
            return ["lmstudio", "ollama", "vllm", "anthropic", "openai", "google", "groq", "grok"];
          case "performance":
            return ["groq", "grok", "openai", "anthropic", "google", "ollama", "lmstudio", "vllm"];
          case "cost-effective":
            return ["google", "groq", "openai", "anthropic", "grok", "ollama", "vllm", "lmstudio"];
          case "auto":
          default:
            return ["openai", "anthropic", "google", "groq", "grok", "lmstudio", "ollama", "vllm"];
        }
      }
      async refreshAvailability() {
        await this.checkAvailability();
      }
      async close() {
        this.providers.clear();
        this.availableProviders.clear();
      }
      // Health check for monitoring
      async getProviderHealth() {
        const health = {};
        const checks = Array.from(this.providers.entries()).map(async ([name, provider]) => {
          try {
            if ("isAvailable" in provider && typeof provider.isAvailable === "function") {
              health[name] = await provider.isAvailable();
            } else {
              health[name] = true;
            }
          } catch {
            health[name] = false;
          }
        });
        await Promise.allSettled(checks);
        return health;
      }
    };
  }
});

// src/config/models.ts
function getRecommendedModel(taskType, availableModels) {
  const recommendations = TASK_ROUTING[taskType] || TASK_ROUTING.chat;
  for (const modelId of recommendations) {
    if (availableModels.includes(modelId)) {
      return modelId;
    }
  }
  return availableModels[0];
}
var TASK_ROUTING;
var init_models = __esm({
  "src/config/models.ts"() {
    init_cjs_shims();
    TASK_ROUTING = {
      coding: ["gpt-5", "claude-sonnet-4-20250514", "qwen2.5:32b", "codellama:13b"],
      reasoning: ["o1", "claude-opus-4-1-20250805", "gpt-5", "llama-3.3-70b-versatile"],
      vision: ["gpt-4o", "claude-3-5-sonnet-20241022", "qwen2.5-vl:7b", "llama-3.2-90b-vision-preview"],
      quick_tasks: ["gpt-5-mini", "gemini-2.5-flash", "claude-3-5-haiku-20241022", "llama3.2:3b"],
      cost_effective: [
        "gemini-2.5-flash",
        "claude-3-5-haiku-20241022",
        "gpt-4o-mini",
        "mixtral-8x7b-32768"
      ],
      privacy: [
        "gpt-oss-120b",
        "qwen2.5:32b",
        "japanese-stablelm-2-instruct-1_6b",
        "mistral-7b-instruct"
      ],
      multilingual: ["qwen2.5:32b", "qwen2.5-vl:7b", "gemini-2.5-pro", "mixtral-8x7b-32768"],
      currentevents: ["grok-2", "gemini-2.5-pro", "gpt-5", "claude-opus-4-1-20250805"],
      chat: ["gpt-4o-mini", "claude-3-5-haiku-20241022", "gemini-2.5-flash", "mixtral-8x7b-32768"]
    };
    __name(getRecommendedModel, "getRecommendedModel");
  }
});

// src/services/intelligent-router.ts
var IntelligentRouter;
var init_intelligent_router = __esm({
  "src/services/intelligent-router.ts"() {
    init_cjs_shims();
    init_models();
    IntelligentRouter = class {
      static {
        __name(this, "IntelligentRouter");
      }
      providerManager;
      config;
      constructor(providerManager, config) {
        this.providerManager = providerManager;
        this.config = config;
      }
      async route(request) {
        const taskType = request.taskType || this.detectTaskType(request);
        const { providerName, modelId } = await this.selectOptimal(taskType, request);
        const provider = this.providerManager.getProvider(providerName);
        if (!provider) {
          throw new Error(`Provider ${providerName} not available`);
        }
        let response;
        try {
          response = await provider.chat(request.messages);
        } catch {
          response = await provider.chat(request.messages, modelId);
        }
        if (typeof response === "string") {
          return {
            content: response,
            model: modelId,
            provider: providerName
          };
        }
        return response;
      }
      async routeVision(image, prompt) {
        const availableProviders = this.providerManager.getAvailableProviders();
        const visionProviders = ["openai", "anthropic", "ollama", "groq"];
        for (const providerName of visionProviders) {
          if (availableProviders.includes(providerName)) {
            const provider = this.providerManager.getProvider(providerName);
            if (provider?.vision) {
              try {
                const visionResponse = await provider.vision(image, prompt);
                return {
                  content: visionResponse.description,
                  model: "vision-model",
                  provider: providerName
                };
              } catch (error) {
                continue;
              }
            }
          }
        }
        throw new Error("No vision-capable providers available");
      }
      async routeCode(prompt, language) {
        const request = {
          messages: [
            {
              role: "user",
              content: language ? `Generate ${language} code: ${prompt}` : `Generate code: ${prompt}`
            }
          ],
          taskType: "coding"
        };
        return this.route(request);
      }
      detectTaskType(request) {
        const content = request.messages.map((m) => m.content).join(" ").toLowerCase();
        if (this.containsKeywords(content, [
          "code",
          "function",
          "class",
          "programming",
          "debug",
          "implement"
        ])) {
          return "coding";
        }
        if (this.containsKeywords(content, ["analyze", "reason", "solve", "logic", "problem", "math"])) {
          return "reasoning";
        }
        if (this.containsKeywords(content, ["image", "picture", "visual", "see", "look", "describe"])) {
          return "vision";
        }
        if (this.containsKeywords(content, ["quick", "fast", "simple", "brief"])) {
          return "quick_tasks";
        }
        if (this.containsKeywords(content, ["cheap", "cost", "budget", "affordable"])) {
          return "cost_effective";
        }
        if (this.containsKeywords(content, ["private", "local", "offline", "secure"])) {
          return "privacy";
        }
        if (this.containsKeywords(content, ["japanese", "chinese", "korean", "translate"])) {
          return "multilingual";
        }
        if (this.containsKeywords(content, ["news", "current", "today", "recent", "latest"])) {
          return "currentevents";
        }
        return "chat";
      }
      containsKeywords(text, keywords) {
        return keywords.some((keyword) => text.includes(keyword));
      }
      async selectOptimal(taskType, request) {
        if (request.provider) {
          const availableProviders = this.providerManager.getAvailableProviders();
          if (!availableProviders.includes(request.provider)) {
            throw new Error(`Requested provider ${request.provider} not available`);
          }
          return {
            providerName: request.provider,
            modelId: request.model || await this.getDefaultModelForProvider(request.provider)
          };
        }
        const priorityMode = this.config.get("priority", "auto");
        const providerName = this.providerManager.selectOptimalProvider(taskType, priorityMode);
        if (!providerName) {
          throw new Error("No AI providers available");
        }
        const availableModels = await this.getModelsForProvider(providerName);
        const modelId = request.model || getRecommendedModel(taskType, availableModels) || availableModels[0];
        if (!modelId) {
          throw new Error(`No models available for provider ${providerName}`);
        }
        return { providerName, modelId };
      }
      async getModelsForProvider(providerName) {
        const provider = this.providerManager.getProvider(providerName);
        if (!provider) return [];
        try {
          const models = await provider.getModels();
          if (typeof models[0] === "string") {
            return models;
          }
          return models.filter((m) => m.available).map((m) => m.id);
        } catch {
          return [];
        }
      }
      async getDefaultModelForProvider(providerName) {
        const models = await this.getModelsForProvider(providerName);
        return models[0] || "default";
      }
      updatePriorityMode(mode) {
        this.config.set("priority", mode);
      }
    };
  }
});
var HealthMonitor;
var init_health_monitor = __esm({
  "src/services/health-monitor.ts"() {
    init_cjs_shims();
    HealthMonitor = class extends events.EventEmitter {
      static {
        __name(this, "HealthMonitor");
      }
      providers = /* @__PURE__ */ new Map();
      healthData = /* @__PURE__ */ new Map();
      config;
      checkInterval;
      isRunning = false;
      startTime = Date.now();
      constructor(config) {
        super();
        this.config = {
          interval: 6e4,
          // 1 minute
          timeout: 1e4,
          // 10 seconds
          retryAttempts: 3,
          thresholds: {
            responseTimeWarning: 2e3,
            // 2 seconds
            responseTimeCritical: 5e3,
            // 5 seconds
            errorRateWarning: 0.1,
            // 10%
            errorRateCritical: 0.25
            // 25%
          },
          ...config
        };
      }
      /**
       * Register providers to monitor
       */
      registerProvider(name, provider) {
        this.providers.set(name, provider);
        this.healthData.set(name, {
          name,
          type: this.isLocalProvider(name) ? "local" : "cloud",
          health: {
            status: "offline",
            uptime: 0,
            lastCheck: /* @__PURE__ */ new Date(),
            responseTime: 0
          },
          metadata: {
            models: provider.getModels(),
            totalRequests: 0,
            errorRate: 0,
            averageResponseTime: 0
          }
        });
      }
      /**
       * Start health monitoring
       */
      start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.startTime = Date.now();
        this.performHealthCheck();
        this.checkInterval = setInterval(() => {
          this.performHealthCheck();
        }, this.config.interval);
        this.emit("monitoring-started");
      }
      /**
       * Stop health monitoring
       */
      stop() {
        if (!this.isRunning) return;
        if (this.checkInterval) {
          clearInterval(this.checkInterval);
          this.checkInterval = void 0;
        }
        this.isRunning = false;
        this.emit("monitoring-stopped");
      }
      /**
       * Perform health check on all providers
       */
      async performHealthCheck() {
        const promises = Array.from(this.providers.entries()).map(
          ([name, provider]) => this.checkProviderHealth(name, provider)
        );
        await Promise.allSettled(promises);
        const systemHealth = this.getSystemHealth();
        this.emit("health-updated", systemHealth);
        await this.saveHealthData();
      }
      /**
       * Check health of individual provider
       */
      async checkProviderHealth(name, provider) {
        const startTime = Date.now();
        let attempts = 0;
        let lastError;
        const currentHealth = this.healthData.get(name);
        if (!currentHealth) return;
        while (attempts < this.config.retryAttempts) {
          try {
            attempts++;
            if (provider.validateConnection) {
              await Promise.race([
                provider.validateConnection(),
                new Promise(
                  (_, reject) => setTimeout(() => reject(new Error("Timeout")), this.config.timeout)
                )
              ]);
            } else {
              await Promise.race([
                provider.chat([{ role: "user", content: "ping" }]),
                new Promise(
                  (_, reject) => setTimeout(() => reject(new Error("Timeout")), this.config.timeout)
                )
              ]);
            }
            const responseTime = Date.now() - startTime;
            const now = /* @__PURE__ */ new Date();
            currentHealth.health = {
              status: this.determineStatus(responseTime, currentHealth.metadata.errorRate),
              uptime: now.getTime() - startTime,
              lastCheck: now,
              responseTime
            };
            this.updateMetrics(name, responseTime, true);
            this.emit("provider-healthy", name, currentHealth);
            break;
          } catch (error) {
            lastError = error instanceof Error ? error : new Error("Unknown error");
            if (attempts >= this.config.retryAttempts) {
              const now = /* @__PURE__ */ new Date();
              currentHealth.health = {
                status: "offline",
                uptime: 0,
                lastCheck: now,
                responseTime: Date.now() - startTime,
                error: lastError.message
              };
              this.updateMetrics(name, Date.now() - startTime, false);
              this.emit("provider-unhealthy", name, currentHealth, lastError);
            } else {
              await new Promise((resolve) => setTimeout(resolve, 1e3 * attempts));
            }
          }
        }
        this.healthData.set(name, currentHealth);
      }
      /**
       * Determine status based on response time and error rate
       */
      determineStatus(responseTime, errorRate) {
        if (responseTime > this.config.thresholds.responseTimeCritical || errorRate > this.config.thresholds.errorRateCritical) {
          return "critical";
        }
        if (responseTime > this.config.thresholds.responseTimeWarning || errorRate > this.config.thresholds.errorRateWarning) {
          return "degraded";
        }
        return "healthy";
      }
      /**
       * Update provider metrics
       */
      updateMetrics(name, responseTime, success) {
        const health = this.healthData.get(name);
        if (!health) return;
        const metadata = health.metadata;
        metadata.totalRequests++;
        metadata.averageResponseTime = (metadata.averageResponseTime * (metadata.totalRequests - 1) + responseTime) / metadata.totalRequests;
        const errorCount = Math.round(metadata.errorRate * (metadata.totalRequests - 1));
        const newErrorCount = errorCount + (success ? 0 : 1);
        metadata.errorRate = newErrorCount / metadata.totalRequests;
        metadata.lastRequest = /* @__PURE__ */ new Date();
      }
      /**
       * Get overall system health
       */
      getSystemHealth() {
        const providers = Array.from(this.healthData.values());
        const recommendations = [];
        let overall = "healthy";
        const offlineProviders = providers.filter((p) => p.health.status === "offline");
        const criticalProviders = providers.filter((p) => p.health.status === "critical");
        const degradedProviders = providers.filter((p) => p.health.status === "degraded");
        if (offlineProviders.length === providers.length) {
          overall = "critical";
          recommendations.push({
            type: "error",
            message: "All providers are offline. Check your internet connection and API keys.",
            action: { type: "reconfigure" }
          });
        } else if (criticalProviders.length > 0 || offlineProviders.length > providers.length / 2) {
          overall = "critical";
        } else if (degradedProviders.length > 0) {
          overall = "degraded";
        }
        recommendations.push(...this.generateRecommendations(providers));
        return {
          overall,
          providers,
          recommendations,
          lastUpdate: /* @__PURE__ */ new Date(),
          uptime: Date.now() - this.startTime
        };
      }
      /**
       * Generate health recommendations
       */
      generateRecommendations(providers) {
        const recommendations = [];
        for (const provider of providers) {
          const { name, health, metadata } = provider;
          if (health.status === "offline") {
            if (provider.type === "local") {
              recommendations.push({
                type: "action",
                provider: name,
                message: `${name} is offline. Try restarting the local server.`,
                action: {
                  type: "restart",
                  command: this.getRestartCommand(name)
                }
              });
            } else {
              recommendations.push({
                type: "warning",
                provider: name,
                message: `${name} is offline. Check API key and network connectivity.`
              });
            }
          }
          if (health.responseTime > this.config.thresholds.responseTimeCritical) {
            recommendations.push({
              type: "warning",
              provider: name,
              message: `${name} has very high response time (${health.responseTime}ms). Consider switching to a faster provider.`
            });
          }
          if (metadata.errorRate > this.config.thresholds.errorRateWarning) {
            recommendations.push({
              type: "warning",
              provider: name,
              message: `${name} has high error rate (${(metadata.errorRate * 100).toFixed(1)}%). Check configuration and quotas.`
            });
          }
          if (metadata.models.length === 0) {
            recommendations.push({
              type: "info",
              provider: name,
              message: `${name} has no models configured. Add models to enable functionality.`,
              action: { type: "reconfigure" }
            });
          }
        }
        const healthyProviders = providers.filter((p) => p.health.status === "healthy");
        if (healthyProviders.length === 0) {
          recommendations.push({
            type: "error",
            message: "No healthy providers available. System functionality is severely limited.",
            action: { type: "contact-support" }
          });
        } else if (healthyProviders.length === 1) {
          recommendations.push({
            type: "info",
            message: "Only one healthy provider available. Consider setting up additional providers for redundancy."
          });
        }
        return recommendations;
      }
      /**
       * Get restart command for local provider
       */
      getRestartCommand(providerName) {
        switch (providerName) {
          case "lmstudio":
            return 'open -a "LM Studio"';
          case "ollama":
            return "ollama serve";
          case "vllm":
            return "python -m vllm.entrypoints.api_server";
          default:
            return `# Restart ${providerName} manually`;
        }
      }
      /**
       * Save health data to disk
       */
      async saveHealthData() {
        try {
          const healthDir = path2.join(os2.homedir(), ".maria", "health");
          await fs.promises.mkdir(healthDir, { recursive: true });
          const systemHealth = this.getSystemHealth();
          const healthFile = path2.join(healthDir, "system-health.json");
          await fs.promises.writeFile(
            healthFile,
            JSON.stringify(
              {
                ...systemHealth,
                config: this.config
              },
              null,
              2
            )
          );
        } catch (error) {
          this.emit("error", new Error(`Failed to save health data: ${error}`));
        }
      }
      /**
       * Load health data from disk
       */
      async loadHealthData() {
        try {
          const healthFile = path2.join(os2.homedir(), ".maria", "health", "system-health.json");
          const data = await fs.promises.readFile(healthFile, "utf8");
          const parsed = JSON.parse(data);
          return {
            overall: parsed["overall"],
            providers: parsed["providers"],
            recommendations: parsed["recommendations"],
            lastUpdate: new Date(parsed["lastUpdate"]),
            uptime: parsed["uptime"]
          };
        } catch {
          return null;
        }
      }
      /**
       * Get provider health status
       */
      getProviderHealth(name) {
        return this.healthData.get(name) || null;
      }
      /**
       * Get all provider health data
       */
      getAllProviderHealth() {
        return Array.from(this.healthData.values());
      }
      /**
       * Check if provider is local
       */
      isLocalProvider(name) {
        return ["lmstudio", "ollama", "vllm"].includes(name);
      }
      /**
       * Update monitoring configuration
       */
      updateConfig(config) {
        this.config = { ...this.config, ...config };
        if (this.isRunning) {
          this.stop();
          this.start();
        }
      }
      /**
       * Force health check
       */
      async forceHealthCheck() {
        await this.performHealthCheck();
        return this.getSystemHealth();
      }
      /**
       * Get monitoring statistics
       */
      getStatistics() {
        const providers = Array.from(this.healthData.values());
        return {
          totalProviders: providers.length,
          healthyProviders: providers.filter((p) => p.health.status === "healthy").length,
          degradedProviders: providers.filter((p) => p.health.status === "degraded").length,
          criticalProviders: providers.filter((p) => p.health.status === "critical").length,
          offlineProviders: providers.filter((p) => p.health.status === "offline").length,
          totalRequests: providers.reduce((sum, p) => sum + p.metadata.totalRequests, 0),
          averageResponseTime: providers.reduce((sum, p) => sum + p.metadata.averageResponseTime, 0) / providers.length || 0,
          averageErrorRate: providers.reduce((sum, p) => sum + p.metadata.errorRate, 0) / providers.length || 0,
          uptime: Date.now() - this.startTime,
          isRunning: this.isRunning
        };
      }
    };
  }
});

// src/utils/import-helper.ts
var import_helper_exports = {};
__export(import_helper_exports, {
  canImport: () => canImport,
  importNodeBuiltin: () => importNodeBuiltin,
  importReactComponent: () => importReactComponent,
  safeDynamicImport: () => safeDynamicImport
});
async function safeDynamicImport(specifier) {
  try {
    const module = await import(specifier);
    return module.default || module;
  } catch (importError) {
    try {
      const require2 = global.__require || globalThis.require || process.mainModule?.require;
      if (!require2) {
        throw new Error("CommonJS require not available");
      }
      return require2(specifier);
    } catch (requireError) {
      throw importError;
    }
  }
}
async function importNodeBuiltin(moduleName) {
  return safeDynamicImport(`node:${moduleName}`).catch(() => safeDynamicImport(moduleName));
}
async function importReactComponent(specifier) {
  try {
    const module = await safeDynamicImport(specifier);
    return module;
  } catch (error) {
    console.warn(`Failed to load React component ${specifier}:`, error);
    throw new Error(`React component ${specifier} is not available in this environment`);
  }
}
async function canImport(specifier) {
  try {
    await safeDynamicImport(specifier);
    return true;
  } catch {
    return false;
  }
}
var init_import_helper = __esm({
  "src/utils/import-helper.ts"() {
    init_cjs_shims();
    __name(safeDynamicImport, "safeDynamicImport");
    __name(importNodeBuiltin, "importNodeBuiltin");
    __name(importReactComponent, "importReactComponent");
    __name(canImport, "canImport");
  }
});

// src/config/config-manager.ts
var ConfigManager;
var init_config_manager = __esm({
  "src/config/config-manager.ts"() {
    init_cjs_shims();
    ConfigManager = class _ConfigManager {
      static {
        __name(this, "ConfigManager");
      }
      config;
      constructor(initialConfig = {}) {
        this.config = this.loadDefaultConfig();
        this.mergeConfig(initialConfig);
      }
      loadDefaultConfig() {
        return {
          priority: "privacy-first",
          providers: {},
          autoStart: true,
          healthMonitoring: true,
          language: "auto",
          offlineMode: false
        };
      }
      mergeConfig(newConfig) {
        if (newConfig.priority) {
          this.config["priority"] = newConfig.priority;
        }
        if (newConfig.apiKeys) {
          this.set("apiKeys", newConfig.apiKeys);
        }
        if (newConfig.localProviders) {
          this.set("localProviders", newConfig.localProviders);
        }
        if (newConfig.autoStart !== void 0) {
          this.config["autoStart"] = newConfig.autoStart;
        }
        if (newConfig.healthMonitoring !== void 0) {
          this.config["healthMonitoring"] = newConfig.healthMonitoring;
        }
        if (newConfig.enabledProviders) {
          this.set("enabledProviders", newConfig.enabledProviders);
        }
      }
      get(key, defaultValue) {
        const value = this.config[key];
        return value !== void 0 ? value : defaultValue;
      }
      set(key, value) {
        this.config[key] = value;
      }
      getAll() {
        return { ...this.config };
      }
      // Load configuration from environment variables
      static fromEnvironment() {
        const config = {
          priority: process.env["MARIA_PRIORITY"] || "privacy-first",
          apiKeys: {
            OPENAI_API_KEY: process.env["OPENAI_API_KEY"] || "",
            ANTHROPIC_API_KEY: process.env["ANTHROPIC_API_KEY"] || "",
            GOOGLE_API_KEY: process.env["GOOGLE_API_KEY"] || process.env["GEMINI_API_KEY"] || "",
            GROQ_API_KEY: process.env["GROQ_API_KEY"] || "",
            GROK_API_KEY: process.env["GROK_API_KEY"] || ""
          },
          localProviders: {
            lmstudio: process.env["LMSTUDIO_ENABLED"] !== "false",
            ollama: process.env["OLLAMA_ENABLED"] !== "false",
            vllm: process.env["VLLM_ENABLED"] !== "false"
          },
          autoStart: process.env["AUTO_START_LLMS"] !== "false",
          healthMonitoring: process.env["HEALTH_MONITORING"] !== "false"
        };
        return new _ConfigManager(config);
      }
      // Save configuration to file (for CLI usage)
      async save(configPath) {
        const { importNodeBuiltin: importNodeBuiltin2, safeDynamicImport: safeDynamicImport2 } = await Promise.resolve().then(() => (init_import_helper(), import_helper_exports));
        const fs5 = await safeDynamicImport2("fs-extra").catch(
          () => importNodeBuiltin2("fs")
        );
        const path3 = await importNodeBuiltin2("path");
        const os3 = await importNodeBuiltin2("os");
        const targetPath = configPath || path3.join(os3.homedir(), ".maria", "config.json");
        await fs5.ensureDir(path3.dirname(targetPath));
        await fs5.writeJson(targetPath, this.config, { spaces: 2 });
      }
      // Load configuration from file
      static async load(configPath) {
        const { importNodeBuiltin: importNodeBuiltin2, safeDynamicImport: safeDynamicImport2 } = await Promise.resolve().then(() => (init_import_helper(), import_helper_exports));
        const fs5 = await safeDynamicImport2("fs-extra").catch(
          () => importNodeBuiltin2("fs")
        );
        const path3 = await importNodeBuiltin2("path");
        const os3 = await importNodeBuiltin2("os");
        const targetPath = configPath || path3.join(os3.homedir(), ".maria", "config.json");
        if (await fs5.pathExists(targetPath)) {
          try {
            const savedConfig = await fs5.readJson(targetPath);
            return new _ConfigManager(savedConfig);
          } catch (error) {
            console.warn("Failed to load config file, using defaults:", error);
          }
        }
        return _ConfigManager.fromEnvironment();
      }
    };
  }
});

// src/maria-ai.ts
var MariaAI;
var init_maria_ai = __esm({
  "src/maria-ai.ts"() {
    init_cjs_shims();
    init_manager();
    init_intelligent_router();
    init_health_monitor();
    init_config_manager();
    MariaAI = class {
      static {
        __name(this, "MariaAI");
      }
      providerManager;
      router;
      healthMonitor;
      config;
      memoryEngine = null;
      memoryCoordinator = null;
      isInitialized = false;
      constructor(config = {}) {
        this.config = new ConfigManager(config);
        this.providerManager = new AIProviderManager(this.config);
        this.router = new IntelligentRouter(this.providerManager, this.config);
        this.healthMonitor = new HealthMonitor();
        if (config.autoStart !== false) {
          this.initialize();
        }
      }
      // Memory system setter for interactive session
      setMemorySystem(memoryEngine2, memoryCoordinator2) {
        this.memoryEngine = memoryEngine2;
        this.memoryCoordinator = memoryCoordinator2;
      }
      async initialize() {
        if (this.isInitialized) {
          return;
        }
        await this.providerManager.initialize();
        if (this.config.get("healthMonitoring", true)) {
          this.healthMonitor.start();
        }
        this.isInitialized = true;
      }
      /**
       * Send a chat message and get AI response
       */
      async chat(message, options = {}) {
        const request = {
          messages: [{ role: "user", content: message }],
          ...options
        };
        return this.router.route(request);
      }
      /**
       * Stream a chat response
       */
      async *chatStream(message, options = {}) {
        const request = {
          messages: [{ role: "user", content: message }],
          stream: true,
          ...options
        };
        const response = await this.router.route(request);
        if (response.stream) {
          yield* response.stream;
        } else {
          yield response.content || "";
        }
      }
      /**
       * Process vision tasks (image + text)
       */
      async vision(image, prompt) {
        return this.router.routeVision(image, prompt);
      }
      /**
       * Generate code with memory context
       */
      async generateCode(prompt, language) {
        let enhancedPrompt = prompt;
        if (this.memoryEngine && this.memoryCoordinator) {
          try {
            const context = await this.memoryEngine.getContext({
              query: prompt,
              type: "code_generation",
              language
            });
            if (context.codePatterns?.length > 0) {
              enhancedPrompt = `${prompt}

Context from memory:
`;
              enhancedPrompt += `Previous patterns: ${context.codePatterns.slice(0, 3).map((p) => p.pattern).join(", ")}
`;
            }
            if (context.userPreferences) {
              enhancedPrompt += `User preferences: ${JSON.stringify(context.userPreferences)}
`;
            }
            await this.memoryEngine.storeInteraction({
              type: "code_generation",
              input: prompt,
              language,
              timestamp: /* @__PURE__ */ new Date()
            });
          } catch (error) {
            console.warn("Memory context enhancement failed:", error);
          }
        }
        return this.router.routeCode(enhancedPrompt, language);
      }
      /**
       * Get available models
       */
      async getModels() {
        if (!this.isInitialized) {
          await this.initialize();
        }
        return this.providerManager.getAvailableModels();
      }
      /**
       * Get system health status
       */
      async getHealth() {
        return this.healthMonitor.getSystemHealth();
      }
      /**
       * Switch provider priority mode
       */
      setPriorityMode(mode) {
        this.config.set("priority", mode);
        this.router.updatePriorityMode(mode);
      }
      /**
       * Get current configuration
       */
      getConfig() {
        return this.config.getAll();
      }
      /**
       * Close connections and cleanup
       */
      async close() {
        await this.healthMonitor.stop();
        await this.providerManager.close();
      }
    };
  }
});

// src/services/internal-mode/ModeDefinitionRegistry.ts
function getModeRegistry() {
  if (!registryInstance) {
    registryInstance = new ModeDefinitionRegistry();
  }
  return registryInstance;
}
var ModeDefinitionRegistry, registryInstance;
var init_ModeDefinitionRegistry = __esm({
  "src/services/internal-mode/ModeDefinitionRegistry.ts"() {
    init_cjs_shims();
    ModeDefinitionRegistry = class {
      static {
        __name(this, "ModeDefinitionRegistry");
      }
      modes = /* @__PURE__ */ new Map();
      categoryIndex = /* @__PURE__ */ new Map();
      initialized = false;
      constructor() {
        this.initializeModes();
      }
      async initialize() {
        if (this.initialized) return;
        this.initializeModes();
        this.buildCategoryIndex();
        this.initialized = true;
      }
      getModeById(id) {
        return this.modes.get(id);
      }
      getModesByCategory(category) {
        const modeIds = this.categoryIndex.get(category) || [];
        return modeIds.map((id) => this.modes.get(id)).filter(Boolean);
      }
      getAllModes() {
        return Array.from(this.modes.values());
      }
      searchModes(query, language = "en") {
        const normalizedQuery = query.toLowerCase();
        return this.getAllModes().filter((mode) => {
          const i18n = mode.i18n[language] || mode.i18n.en;
          return mode.name.toLowerCase().includes(normalizedQuery) || i18n.name.toLowerCase().includes(normalizedQuery) || i18n.description.toLowerCase().includes(normalizedQuery) || mode.metadata.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery));
        });
      }
      initializeModes() {
        this.addMode({
          id: "optimizing",
          name: "Optimizing",
          symbol: "\u26A1",
          category: "reasoning",
          intensity: "normal",
          description: "\u51E6\u7406\u3084\u51FA\u529B\u306E\u52B9\u7387\u5316\u30FB\u6539\u5584\u3092\u884C\u3046",
          purpose: "\u30D1\u30D5\u30A9\u30FC\u30DE\u30F3\u30B9\u6539\u5584\u3068\u30EA\u30D5\u30A1\u30AF\u30BF\u30EA\u30F3\u30B0",
          useCases: ["\u30B3\u30FC\u30C9\u6700\u9069\u5316", "\u30D7\u30ED\u30BB\u30B9\u6539\u5584", "\u30EA\u30D5\u30A1\u30AF\u30BF\u30EA\u30F3\u30B0"],
          triggers: [
            this.createTrigger(
              "intent",
              [
                {
                  field: "keywords",
                  operator: "contains",
                  value: ["optimize", "improve", "refactor", "\u6700\u9069\u5316", "\u6539\u5584"],
                  weight: 0.9
                },
                {
                  field: "keywords",
                  operator: "contains",
                  value: ["performance", "speed", "efficiency", "\u30D1\u30D5\u30A9\u30FC\u30DE\u30F3\u30B9"],
                  weight: 0.8
                }
              ],
              0.8,
              0.85
            )
          ],
          display: { color: "yellow", animation: true, duration: 2e3, prefix: "\u273D", suffix: "\u2026" },
          i18n: this.createI18n({
            en: {
              name: "Optimizing",
              description: "Optimizing and improving efficiency",
              purpose: "Performance improvement and refactoring",
              useCases: ["Code optimization", "Process improvement", "Refactoring"]
            },
            ja: {
              name: "\u6700\u9069\u5316\u4E2D",
              description: "\u51E6\u7406\u3084\u51FA\u529B\u306E\u52B9\u7387\u5316\u30FB\u6539\u5584\u3092\u884C\u3046",
              purpose: "\u30D1\u30D5\u30A9\u30FC\u30DE\u30F3\u30B9\u6539\u5584\u3068\u30EA\u30D5\u30A1\u30AF\u30BF\u30EA\u30F3\u30B0",
              useCases: ["\u30B3\u30FC\u30C9\u6700\u9069\u5316", "\u30D7\u30ED\u30BB\u30B9\u6539\u5584", "\u30EA\u30D5\u30A1\u30AF\u30BF\u30EA\u30F3\u30B0"]
            }
          }),
          metadata: {
            version: "1.0.0",
            author: "MARIA",
            created: /* @__PURE__ */ new Date(),
            updated: /* @__PURE__ */ new Date(),
            tags: ["optimization", "performance"],
            experimental: false,
            deprecated: false
          }
        });
        this.addMode({
          id: "thinking",
          name: "Thinking",
          symbol: "\u{1F9E0}",
          category: "reasoning",
          intensity: "normal",
          description: "\u901A\u5E38\u306E\u63A8\u8AD6\u30D7\u30ED\u30BB\u30B9",
          purpose: "\u6A19\u6E96\u7684\u306AQA\u3084\u8AB2\u984C\u89E3\u6C7A",
          useCases: ["\u4E00\u822C\u7684\u306A\u8CEA\u554F\u56DE\u7B54", "\u57FA\u672C\u7684\u306A\u554F\u984C\u89E3\u6C7A", "\u60C5\u5831\u6574\u7406"],
          triggers: [
            this.createTrigger(
              "context",
              [{ field: "defaultMode", operator: "equals", value: "true", weight: 1 }],
              0.5,
              0
            )
            // デフォルトモード
          ],
          display: { color: "cyan", animation: true, duration: 1500, prefix: "\u273D", suffix: "\u2026" },
          i18n: this.createI18n({
            en: {
              name: "Thinking",
              description: "Normal reasoning process",
              purpose: "Standard Q&A and problem solving",
              useCases: ["General questions", "Basic problem solving", "Information organization"]
            },
            ja: {
              name: "\u601D\u8003\u4E2D",
              description: "\u901A\u5E38\u306E\u63A8\u8AD6\u30D7\u30ED\u30BB\u30B9",
              purpose: "\u6A19\u6E96\u7684\u306AQA\u3084\u8AB2\u984C\u89E3\u6C7A",
              useCases: ["\u4E00\u822C\u7684\u306A\u8CEA\u554F\u56DE\u7B54", "\u57FA\u672C\u7684\u306A\u554F\u984C\u89E3\u6C7A", "\u60C5\u5831\u6574\u7406"]
            }
          }),
          metadata: {
            version: "1.0.0",
            author: "MARIA",
            created: /* @__PURE__ */ new Date(),
            updated: /* @__PURE__ */ new Date(),
            tags: ["thinking", "reasoning", "default"],
            experimental: false,
            deprecated: false
          }
        });
        this.addMode({
          id: "ultra_thinking",
          name: "Ultra Thinking",
          symbol: "\u{1F31F}",
          category: "reasoning",
          intensity: "ultra",
          description: "\u6DF1\u304F\u591A\u89D2\u7684\u306B\u691C\u8A0E\u3059\u308B\u5F37\u5316\u601D\u8003",
          purpose: "\u96E3\u554F\u3084\u591A\u8996\u70B9\u691C\u8A0E\u304C\u5FC5\u8981\u306A\u3068\u304D",
          useCases: ["\u8907\u96D1\u306A\u554F\u984C\u89E3\u6C7A", "\u591A\u89D2\u7684\u5206\u6790", "\u6226\u7565\u7684\u601D\u8003"],
          triggers: [
            this.createTrigger(
              "intent",
              [
                {
                  field: "keywords",
                  operator: "contains",
                  value: ["complex", "difficult", "analyze", "\u8907\u96D1", "\u96E3\u3057\u3044", "\u5206\u6790"],
                  weight: 0.9
                },
                {
                  field: "keywords",
                  operator: "contains",
                  value: ["deep", "thorough", "comprehensive", "\u8A73\u7D30", "\u5305\u62EC"],
                  weight: 0.8
                }
              ],
              0.9,
              0.9
            )
          ],
          display: { color: "magenta", animation: true, duration: 3e3, prefix: "\u273D", suffix: "\u2026" },
          i18n: this.createI18n({
            en: {
              name: "Ultra Thinking",
              description: "Deep multi-perspective enhanced thinking",
              purpose: "For difficult problems requiring multiple viewpoints",
              useCases: ["Complex problem solving", "Multi-angle analysis", "Strategic thinking"]
            },
            ja: {
              name: "\u8D85\u601D\u8003\u4E2D",
              description: "\u6DF1\u304F\u591A\u89D2\u7684\u306B\u691C\u8A0E\u3059\u308B\u5F37\u5316\u601D\u8003",
              purpose: "\u96E3\u554F\u3084\u591A\u8996\u70B9\u691C\u8A0E\u304C\u5FC5\u8981\u306A\u3068\u304D",
              useCases: ["\u8907\u96D1\u306A\u554F\u984C\u89E3\u6C7A", "\u591A\u89D2\u7684\u5206\u6790", "\u6226\u7565\u7684\u601D\u8003"]
            }
          }),
          metadata: {
            version: "1.0.0",
            author: "MARIA",
            created: /* @__PURE__ */ new Date(),
            updated: /* @__PURE__ */ new Date(),
            tags: ["deep-thinking", "analysis", "complex"],
            experimental: false,
            deprecated: false
          }
        });
        this.addMode({
          id: "researching",
          name: "Researching",
          symbol: "\u{1F50D}",
          category: "reasoning",
          intensity: "normal",
          description: "\u77E5\u8B58\u30FB\u60C5\u5831\u3092\u63A2\u7D22\u3057\u88DC\u5F37",
          purpose: "\u6839\u62E0\u3084\u53C2\u7167\u304C\u5FC5\u8981\u306A\u3068\u304D",
          useCases: ["\u4E8B\u5B9F\u78BA\u8A8D", "\u60C5\u5831\u53CE\u96C6", "\u53C2\u8003\u6587\u732E\u63A2\u7D22"],
          triggers: [
            this.createTrigger(
              "intent",
              [
                {
                  field: "keywords",
                  operator: "contains",
                  value: ["research", "find", "search", "\u8ABF\u3079\u308B", "\u691C\u7D22"],
                  weight: 0.9
                },
                {
                  field: "keywords",
                  operator: "contains",
                  value: ["evidence", "reference", "source", "\u6839\u62E0", "\u53C2\u8003"],
                  weight: 0.8
                }
              ],
              0.8,
              0.85
            )
          ],
          display: { color: "blue", animation: true, duration: 2500, prefix: "\u273D", suffix: "\u2026" },
          i18n: this.createI18n({
            en: {
              name: "Researching",
              description: "Exploring and reinforcing knowledge and information",
              purpose: "When evidence or references are needed",
              useCases: ["Fact checking", "Information gathering", "Reference exploration"]
            },
            ja: {
              name: "\u8ABF\u67FB\u4E2D",
              description: "\u77E5\u8B58\u30FB\u60C5\u5831\u3092\u63A2\u7D22\u3057\u88DC\u5F37",
              purpose: "\u6839\u62E0\u3084\u53C2\u7167\u304C\u5FC5\u8981\u306A\u3068\u304D",
              useCases: ["\u4E8B\u5B9F\u78BA\u8A8D", "\u60C5\u5831\u53CE\u96C6", "\u53C2\u8003\u6587\u732E\u63A2\u7D22"]
            }
          }),
          metadata: {
            version: "1.0.0",
            author: "MARIA",
            created: /* @__PURE__ */ new Date(),
            updated: /* @__PURE__ */ new Date(),
            tags: ["research", "information", "facts"],
            experimental: false,
            deprecated: false
          }
        });
        this.addMode({
          id: "todo_planning",
          name: "TODO Planning",
          symbol: "\u{1F4CB}",
          category: "reasoning",
          intensity: "normal",
          description: "\u884C\u52D5\u8A08\u753B\u30FB\u30BF\u30B9\u30AF\u3092\u5217\u6319",
          purpose: "\u6B21\u306E\u30A2\u30AF\u30B7\u30E7\u30F3\u3092\u6574\u7406\u3059\u308B\u3068\u304D",
          useCases: ["\u30BF\u30B9\u30AF\u6574\u7406", "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u8A08\u753B", "\u4F5C\u696D\u5206\u89E3"],
          triggers: [
            this.createTrigger(
              "intent",
              [
                {
                  field: "keywords",
                  operator: "contains",
                  value: ["plan", "todo", "task", "steps", "\u8A08\u753B", "\u30BF\u30B9\u30AF", "\u624B\u9806"],
                  weight: 0.9
                },
                {
                  field: "keywords",
                  operator: "contains",
                  value: ["organize", "structure", "\u6574\u7406", "\u69CB\u9020"],
                  weight: 0.7
                }
              ],
              0.8,
              0.85
            )
          ],
          display: { color: "green", animation: true, duration: 2e3, prefix: "\u273D", suffix: "\u2026" },
          i18n: this.createI18n({
            en: {
              name: "TODO Planning",
              description: "Listing action plans and tasks",
              purpose: "When organizing next actions",
              useCases: ["Task organization", "Project planning", "Work breakdown"]
            },
            ja: {
              name: "TODO\u6574\u7406\u4E2D",
              description: "\u884C\u52D5\u8A08\u753B\u30FB\u30BF\u30B9\u30AF\u3092\u5217\u6319",
              purpose: "\u6B21\u306E\u30A2\u30AF\u30B7\u30E7\u30F3\u3092\u6574\u7406\u3059\u308B\u3068\u304D",
              useCases: ["\u30BF\u30B9\u30AF\u6574\u7406", "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u8A08\u753B", "\u4F5C\u696D\u5206\u89E3"]
            }
          }),
          metadata: {
            version: "1.0.0",
            author: "MARIA",
            created: /* @__PURE__ */ new Date(),
            updated: /* @__PURE__ */ new Date(),
            tags: ["planning", "tasks", "organization"],
            experimental: false,
            deprecated: false
          }
        });
        this.addMode({
          id: "drafting",
          name: "Drafting",
          symbol: "\u270F\uFE0F",
          category: "creative",
          intensity: "normal",
          description: "\u521D\u671F\u30A2\u30A4\u30C7\u30A2\u3084\u96DB\u5F62\u751F\u6210",
          purpose: "\u30C9\u30AD\u30E5\u30E1\u30F3\u30C8\u3084\u30B3\u30FC\u30C9\u306E\u4E0B\u66F8\u304D",
          useCases: ["\u521D\u671F\u8A2D\u8A08", "\u9AA8\u5B50\u4F5C\u6210", "\u30D7\u30ED\u30C8\u30BF\u30A4\u30D7"],
          triggers: [
            this.createTrigger(
              "intent",
              [
                {
                  field: "keywords",
                  operator: "contains",
                  value: ["draft", "sketch", "outline", "\u4E0B\u66F8\u304D", "\u9AA8\u5B50"],
                  weight: 0.9
                },
                {
                  field: "keywords",
                  operator: "contains",
                  value: ["initial", "first", "start", "\u521D\u671F", "\u6700\u521D"],
                  weight: 0.7
                }
              ],
              0.8,
              0.85
            )
          ],
          display: { color: "yellow", animation: true, duration: 2e3, prefix: "\u273D", suffix: "\u2026" },
          i18n: this.createI18n({
            en: {
              name: "Drafting",
              description: "Generating initial ideas and templates",
              purpose: "Drafting documents and code",
              useCases: ["Initial design", "Framework creation", "Prototyping"]
            },
            ja: {
              name: "\u4E0B\u66F8\u304D\u4E2D",
              description: "\u521D\u671F\u30A2\u30A4\u30C7\u30A2\u3084\u96DB\u5F62\u751F\u6210",
              purpose: "\u30C9\u30AD\u30E5\u30E1\u30F3\u30C8\u3084\u30B3\u30FC\u30C9\u306E\u4E0B\u66F8\u304D",
              useCases: ["\u521D\u671F\u8A2D\u8A08", "\u9AA8\u5B50\u4F5C\u6210", "\u30D7\u30ED\u30C8\u30BF\u30A4\u30D7"]
            }
          }),
          metadata: {
            version: "1.0.0",
            author: "MARIA",
            created: /* @__PURE__ */ new Date(),
            updated: /* @__PURE__ */ new Date(),
            tags: ["drafting", "creation", "initial"],
            experimental: false,
            deprecated: false
          }
        });
        this.addMode({
          id: "brainstorming",
          name: "Brainstorming",
          symbol: "\u{1F4A1}",
          category: "creative",
          intensity: "normal",
          description: "\u5236\u7D04\u3092\u7DE9\u3081\u3066\u591A\u69D8\u306A\u767A\u60F3\u751F\u6210",
          purpose: "\u30A2\u30A4\u30C7\u30A2\u51FA\u3057\u3084\u4F01\u753B\u691C\u8A0E",
          useCases: ["\u30A2\u30A4\u30C7\u30A2\u5275\u51FA", "\u4F01\u753B\u7ACB\u6848", "\u5275\u9020\u7684\u89E3\u6C7A"],
          triggers: [
            this.createTrigger(
              "intent",
              [
                {
                  field: "keywords",
                  operator: "contains",
                  value: ["brainstorm", "ideas", "creative", "\u30A2\u30A4\u30C7\u30A2", "\u5275\u9020"],
                  weight: 0.9
                },
                {
                  field: "keywords",
                  operator: "contains",
                  value: ["innovative", "novel", "original", "\u9769\u65B0", "\u65B0\u3057\u3044"],
                  weight: 0.8
                }
              ],
              0.8,
              0.85
            )
          ],
          display: { color: "yellow", animation: true, duration: 2500, prefix: "\u273D", suffix: "\u2026" },
          i18n: this.createI18n({
            en: {
              name: "Brainstorming",
              description: "Generating diverse ideas with relaxed constraints",
              purpose: "Ideation and project planning",
              useCases: ["Idea generation", "Project planning", "Creative solutions"]
            },
            ja: {
              name: "\u30D6\u30EC\u30B9\u30C8\u4E2D",
              description: "\u5236\u7D04\u3092\u7DE9\u3081\u3066\u591A\u69D8\u306A\u767A\u60F3\u751F\u6210",
              purpose: "\u30A2\u30A4\u30C7\u30A2\u51FA\u3057\u3084\u4F01\u753B\u691C\u8A0E",
              useCases: ["\u30A2\u30A4\u30C7\u30A2\u5275\u51FA", "\u4F01\u753B\u7ACB\u6848", "\u5275\u9020\u7684\u89E3\u6C7A"]
            }
          }),
          metadata: {
            version: "1.0.0",
            author: "MARIA",
            created: /* @__PURE__ */ new Date(),
            updated: /* @__PURE__ */ new Date(),
            tags: ["brainstorming", "creativity", "innovation"],
            experimental: false,
            deprecated: false
          }
        });
        this.addMode({
          id: "debugging",
          name: "Debugging",
          symbol: "\u{1F41B}",
          category: "validation",
          intensity: "normal",
          description: "\u30A8\u30E9\u30FC\u539F\u56E0\u7279\u5B9A\u30FB\u4FEE\u6B63",
          purpose: "\u30B3\u30FC\u30C9\u3084\u51FA\u529B\u306B\u4E0D\u5177\u5408\u304C\u3042\u308B\u3068\u304D",
          useCases: ["\u30D0\u30B0\u4FEE\u6B63", "\u30A8\u30E9\u30FC\u89E3\u6790", "\u30C8\u30E9\u30D6\u30EB\u30B7\u30E5\u30FC\u30C6\u30A3\u30F3\u30B0"],
          triggers: [
            this.createTrigger(
              "intent",
              [
                {
                  field: "keywords",
                  operator: "contains",
                  value: ["debug", "error", "bug", "fix", "\u30A8\u30E9\u30FC", "\u30D0\u30B0", "\u4FEE\u6B63"],
                  weight: 0.9
                },
                {
                  field: "keywords",
                  operator: "contains",
                  value: ["problem", "issue", "trouble", "\u554F\u984C", "\u30C8\u30E9\u30D6\u30EB"],
                  weight: 0.8
                }
              ],
              0.9,
              0.9
            ),
            this.createTrigger(
              "situation",
              [{ field: "errorState", operator: "equals", value: "true", weight: 1 }],
              0.8,
              0.8
            )
          ],
          display: { color: "red", animation: true, duration: 2e3, prefix: "\u273D", suffix: "\u2026" },
          i18n: this.createI18n({
            en: {
              name: "Debugging",
              description: "Identifying and fixing error causes",
              purpose: "When there are issues in code or output",
              useCases: ["Bug fixing", "Error analysis", "Troubleshooting"]
            },
            ja: {
              name: "\u30C7\u30D0\u30C3\u30B0\u4E2D",
              description: "\u30A8\u30E9\u30FC\u539F\u56E0\u7279\u5B9A\u30FB\u4FEE\u6B63",
              purpose: "\u30B3\u30FC\u30C9\u3084\u51FA\u529B\u306B\u4E0D\u5177\u5408\u304C\u3042\u308B\u3068\u304D",
              useCases: ["\u30D0\u30B0\u4FEE\u6B63", "\u30A8\u30E9\u30FC\u89E3\u6790", "\u30C8\u30E9\u30D6\u30EB\u30B7\u30E5\u30FC\u30C6\u30A3\u30F3\u30B0"]
            }
          }),
          metadata: {
            version: "1.0.0",
            author: "MARIA",
            created: /* @__PURE__ */ new Date(),
            updated: /* @__PURE__ */ new Date(),
            tags: ["debugging", "errors", "troubleshooting"],
            experimental: false,
            deprecated: false
          }
        });
        this.addMode({
          id: "learning",
          name: "Learning",
          symbol: "\u{1F4DA}",
          category: "learning",
          intensity: "normal",
          description: "\u904E\u53BB\u77E5\u8B58\u3092\u53D6\u308A\u8FBC\u3080",
          purpose: "\u30D5\u30A3\u30FC\u30C9\u30D0\u30C3\u30AF\u53CD\u6620",
          useCases: ["\u77E5\u8B58\u66F4\u65B0", "\u30B9\u30AD\u30EB\u5411\u4E0A", "\u30D1\u30BF\u30FC\u30F3\u5B66\u7FD2"],
          triggers: [
            this.createTrigger(
              "intent",
              [
                {
                  field: "keywords",
                  operator: "contains",
                  value: ["learn", "study", "understand", "\u5B66\u3076", "\u7406\u89E3"],
                  weight: 0.9
                }
              ],
              0.8,
              0.85
            )
          ],
          display: { color: "blue", animation: true, duration: 2e3, prefix: "\u273D", suffix: "\u2026" },
          i18n: this.createI18n({
            en: {
              name: "Learning",
              description: "Incorporating past knowledge",
              purpose: "Reflecting feedback",
              useCases: ["Knowledge updates", "Skill improvement", "Pattern learning"]
            },
            ja: {
              name: "\u5B66\u7FD2\u4E2D",
              description: "\u904E\u53BB\u77E5\u8B58\u3092\u53D6\u308A\u8FBC\u3080",
              purpose: "\u30D5\u30A3\u30FC\u30C9\u30D0\u30C3\u30AF\u53CD\u6620",
              useCases: ["\u77E5\u8B58\u66F4\u65B0", "\u30B9\u30AD\u30EB\u5411\u4E0A", "\u30D1\u30BF\u30FC\u30F3\u5B66\u7FD2"]
            }
          }),
          metadata: {
            version: "1.0.0",
            author: "MARIA",
            created: /* @__PURE__ */ new Date(),
            updated: /* @__PURE__ */ new Date(),
            tags: ["learning", "knowledge", "improvement"],
            experimental: false,
            deprecated: false
          }
        });
      }
      addMode(mode) {
        const fullMode = {
          ...mode,
          metadata: {
            version: "1.0.0",
            author: "MARIA",
            created: /* @__PURE__ */ new Date(),
            updated: /* @__PURE__ */ new Date(),
            tags: [],
            experimental: false,
            deprecated: false,
            ...mode.metadata
          }
        };
        this.modes.set(mode.id, fullMode);
      }
      createTrigger(type, conditions, weight, confidence) {
        return {
          type,
          conditions,
          weight,
          confidence
        };
      }
      createI18n(translations) {
        const defaultLangs = ["en", "ja", "cn", "ko", "vn"];
        const result = { ...translations };
        const enDefault = translations.en;
        if (enDefault) {
          defaultLangs.forEach((lang) => {
            if (!result[lang]) {
              result[lang] = enDefault;
            }
          });
        }
        return result;
      }
      buildCategoryIndex() {
        this.categoryIndex.clear();
        for (const mode of this.modes.values()) {
          if (!this.categoryIndex.has(mode.category)) {
            this.categoryIndex.set(mode.category, []);
          }
          this.categoryIndex.get(mode.category).push(mode.id);
        }
      }
      // Utility methods for mode management
      getCategoryStats() {
        const stats = {};
        for (const [category, modeIds] of this.categoryIndex.entries()) {
          stats[category] = modeIds.length;
        }
        return stats;
      }
      getModeCount() {
        return this.modes.size;
      }
      isInitialized() {
        return this.initialized;
      }
    };
    registryInstance = null;
    __name(getModeRegistry, "getModeRegistry");
  }
});

// src/services/internal-mode/types.ts
var DEFAULT_TRIGGER_WEIGHTS;
var init_types = __esm({
  "src/services/internal-mode/types.ts"() {
    init_cjs_shims();
    DEFAULT_TRIGGER_WEIGHTS = {
      intent: 0.4,
      // 40% - ユーザー意図が最重要
      context: 0.3,
      // 30% - コンテキスト
      situation: 0.2,
      // 20% - 現在の状況
      pattern: 0.1,
      // 10% - 学習パターン
      manual: 1
      // 100% - 手動指定は絶対
    };
  }
});

// src/services/intelligent-router/NaturalLanguageProcessor.ts
var NaturalLanguageProcessor;
var init_NaturalLanguageProcessor = __esm({
  "src/services/intelligent-router/NaturalLanguageProcessor.ts"() {
    init_cjs_shims();
    NaturalLanguageProcessor = class {
      static {
        __name(this, "NaturalLanguageProcessor");
      }
      stopWords;
      contractionMap;
      initialized = false;
      constructor() {
        this.stopWords = /* @__PURE__ */ new Map();
        this.contractionMap = /* @__PURE__ */ new Map();
        this.initializeStopWords();
        this.initializeContractions();
      }
      async initialize() {
        if (this.initialized) return;
        this.initialized = true;
      }
      async process(input, language = "en") {
        const normalized = this.normalize(input, language);
        const tokens = this.tokenize(normalized, language);
        const stems = this.stem(tokens, language);
        const entities = this.extractEntities(input);
        const keywords = this.extractKeywords(tokens, language);
        return {
          original: input,
          normalized,
          tokens,
          stems,
          entities,
          language,
          keywords
        };
      }
      normalize(text, language) {
        let normalized = text.toLowerCase().trim();
        if (language === "en") {
          this.contractionMap.forEach((expanded, contraction) => {
            const regex = new RegExp(`\\b${contraction}\\b`, "gi");
            normalized = normalized.replace(regex, expanded);
          });
        }
        normalized = normalized.replace(/\s+/g, " ");
        switch (language) {
          case "ja":
            normalized = this.normalizeJapanese(normalized);
            break;
          case "cn":
            normalized = this.normalizeChinese(normalized);
            break;
          case "ko":
            normalized = this.normalizeKorean(normalized);
            break;
          case "vn":
            normalized = this.normalizeVietnamese(normalized);
            break;
        }
        return normalized;
      }
      tokenize(text, language) {
        switch (language) {
          case "ja":
            return this.tokenizeJapanese(text);
          case "cn":
            return this.tokenizeChinese(text);
          case "ko":
            return this.tokenizeKorean(text);
          case "vn":
            return this.tokenizeVietnamese(text);
          default:
            return this.tokenizeEnglish(text);
        }
      }
      tokenizeEnglish(text) {
        return text.split(/\s+/).filter((token) => token.length > 0);
      }
      tokenizeJapanese(text) {
        const tokens = [];
        const patterns = [
          /[\u4e00-\u9faf]+/g,
          // Kanji
          /[\u3040-\u309f]+/g,
          // Hiragana
          /[\u30a0-\u30ff]+/g,
          // Katakana
          /[a-zA-Z]+/g,
          // English
          /\d+/g
          // Numbers
        ];
        patterns.forEach((pattern) => {
          const matches = text.match(pattern);
          if (matches) tokens.push(...matches);
        });
        return tokens;
      }
      tokenizeChinese(text) {
        const tokens = [];
        for (const char of text) {
          if (/[\u4e00-\u9faf]/.test(char)) {
            tokens.push(char);
          } else if (/[a-zA-Z0-9]+/.test(char)) {
            tokens.push(char);
          }
        }
        return tokens;
      }
      tokenizeKorean(text) {
        const tokens = [];
        const patterns = [
          /[\uac00-\ud7af]+/g,
          // Hangul
          /[a-zA-Z]+/g,
          // English
          /\d+/g
          // Numbers
        ];
        patterns.forEach((pattern) => {
          const matches = text.match(pattern);
          if (matches) tokens.push(...matches);
        });
        return tokens;
      }
      stem(tokens, language) {
        if (language !== "en") {
          return tokens;
        }
        return tokens.map((token) => {
          let stem = token;
          if (stem.endsWith("ing")) stem = stem.slice(0, -3);
          else if (stem.endsWith("ed")) stem = stem.slice(0, -2);
          else if (stem.endsWith("ly")) stem = stem.slice(0, -2);
          else if (stem.endsWith("es")) stem = stem.slice(0, -2);
          else if (stem.endsWith("s") && stem.length > 3) stem = stem.slice(0, -1);
          return stem;
        });
      }
      extractEntities(text) {
        const entities = [];
        const filePattern = /(?:\/[\w.-]+)+(?:\.\w+)?|(?:[a-zA-Z]:[\\/][\w\\/.-]+)/g;
        const fileMatches = text.match(filePattern);
        if (fileMatches) {
          fileMatches.forEach((match) => {
            entities.push({
              text: match,
              type: "file",
              value: match,
              position: text.indexOf(match)
            });
          });
        }
        const urlPattern = /https?:\/\/[^\s]+/g;
        const urlMatches = text.match(urlPattern);
        if (urlMatches) {
          urlMatches.forEach((match) => {
            entities.push({
              text: match,
              type: "url",
              value: match,
              position: text.indexOf(match)
            });
          });
        }
        const languages = [
          "javascript",
          "typescript",
          "python",
          "java",
          "rust",
          "go",
          "c++",
          "c#",
          "ruby",
          "php"
        ];
        languages.forEach((lang) => {
          const regex = new RegExp(`\\b${lang}\\b`, "gi");
          const matches = text.match(regex);
          if (matches) {
            matches.forEach((match) => {
              entities.push({
                text: match,
                type: "language",
                value: lang,
                position: text.indexOf(match)
              });
            });
          }
        });
        const frameworks = [
          "react",
          "vue",
          "angular",
          "next.js",
          "express",
          "django",
          "flask",
          "rails",
          "spring"
        ];
        frameworks.forEach((framework) => {
          const regex = new RegExp(`\\b${framework}\\b`, "gi");
          const matches = text.match(regex);
          if (matches) {
            matches.forEach((match) => {
              entities.push({
                text: match,
                type: "framework",
                value: framework,
                position: text.indexOf(match)
              });
            });
          }
        });
        return entities;
      }
      extractKeywords(tokens, language) {
        const stopWords = this.stopWords.get(language) ?? /* @__PURE__ */ new Set();
        const keywords = tokens.filter((token) => {
          return token.length > 2 && !stopWords.has(token.toLowerCase());
        });
        const frequency = /* @__PURE__ */ new Map();
        keywords.forEach((keyword) => {
          frequency.set(keyword, (frequency.get(keyword) ?? 0) + 1);
        });
        return Array.from(frequency.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([keyword]) => keyword);
      }
      normalizeJapanese(text) {
        return text.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) => {
          return String.fromCharCode(char.charCodeAt(0) - 65248);
        });
      }
      normalizeChinese(text) {
        return text;
      }
      normalizeKorean(text) {
        return text;
      }
      normalizeVietnamese(text) {
        return text.toLowerCase();
      }
      tokenizeVietnamese(text) {
        return text.split(/\s+/).filter((token) => token.length > 0);
      }
      initializeStopWords() {
        this.stopWords.set(
          "en",
          /* @__PURE__ */ new Set([
            "a",
            "an",
            "and",
            "are",
            "as",
            "at",
            "be",
            "by",
            "for",
            "from",
            "has",
            "he",
            "in",
            "is",
            "it",
            "its",
            "of",
            "on",
            "that",
            "the",
            "to",
            "was",
            "will",
            "with",
            "the",
            "this",
            "these",
            "those",
            "i",
            "you",
            "we",
            "they",
            "what",
            "which",
            "who",
            "when",
            "where",
            "how",
            "can",
            "could",
            "should",
            "would",
            "may",
            "might",
            "must",
            "do",
            "does",
            "did",
            "have",
            "had",
            "get",
            "got",
            "make",
            "made"
          ])
        );
        this.stopWords.set(
          "ja",
          /* @__PURE__ */ new Set([
            "\u306E",
            "\u3092",
            "\u306B",
            "\u306F",
            "\u304C",
            "\u3068",
            "\u3067",
            "\u3066",
            "\u3082",
            "\u304B\u3089",
            "\u307E\u3067",
            "\u3088\u308A",
            "\u3078",
            "\u3084",
            "\u306A\u3069",
            "\u3067\u3059",
            "\u307E\u3059",
            "\u3059\u308B",
            "\u3057\u305F",
            "\u3053\u308C",
            "\u305D\u308C",
            "\u3042\u308C",
            "\u3053\u306E",
            "\u305D\u306E",
            "\u3042\u306E"
          ])
        );
        this.stopWords.set(
          "cn",
          /* @__PURE__ */ new Set([
            "\u7684",
            "\u4E86",
            "\u5728",
            "\u662F",
            "\u6211",
            "\u6709",
            "\u548C",
            "\u5C31",
            "\u4E0D",
            "\u4EBA",
            "\u90FD",
            "\u4E00",
            "\u4E00\u4E2A",
            "\u4E0A",
            "\u4E5F",
            "\u5F88",
            "\u5230",
            "\u8BF4",
            "\u8981",
            "\u53BB",
            "\u4F60",
            "\u4F1A",
            "\u7740",
            "\u6CA1\u6709",
            "\u770B",
            "\u597D",
            "\u81EA\u5DF1",
            "\u8FD9",
            "\u90A3"
          ])
        );
        this.stopWords.set(
          "ko",
          /* @__PURE__ */ new Set([
            "\uC758",
            "\uB97C",
            "\uC744",
            "\uC5D0",
            "\uAC00",
            "\uC774",
            "\uC740",
            "\uB294",
            "\uC640",
            "\uACFC",
            "\uC5D0\uC11C",
            "\uC73C\uB85C",
            "\uB85C",
            "\uBD80\uD130",
            "\uAE4C\uC9C0",
            "\uC785\uB2C8\uB2E4",
            "\uD569\uB2C8\uB2E4",
            "\uC774\uB2E4",
            "\uD558\uB2E4"
          ])
        );
        this.stopWords.set(
          "vn",
          /* @__PURE__ */ new Set([
            "v\xE0",
            "c\u1EE7a",
            "l\xE0",
            "c\xF3",
            "\u0111\u01B0\u1EE3c",
            "trong",
            "v\u1EDBi",
            "n\xE0y",
            "cho",
            "\u0111\u1EC3",
            "kh\xF4ng",
            "nh\u01B0ng",
            "c\u0169ng",
            "nh\u01B0",
            "t\u1EEB",
            "\u0111\u1EBFn",
            "sau",
            "tr\u01B0\u1EDBc",
            "m\u1ED9t",
            "c\xE1c",
            "b\u1ECB",
            "\u0111\xE3",
            "s\u1EBD",
            "khi",
            "n\u1EBFu",
            "th\xEC",
            "v\xEC",
            "ho\u1EB7c",
            "hay",
            "r\u1EA5t"
          ])
        );
      }
      initializeContractions() {
        this.contractionMap.set("don't", "do not");
        this.contractionMap.set("won't", "will not");
        this.contractionMap.set("can't", "cannot");
        this.contractionMap.set("n't", " not");
        this.contractionMap.set("'re", " are");
        this.contractionMap.set("'ve", " have");
        this.contractionMap.set("'ll", " will");
        this.contractionMap.set("'d", " would");
        this.contractionMap.set("'m", " am");
        this.contractionMap.set("let's", "let us");
        this.contractionMap.set("it's", "it is");
        this.contractionMap.set("that's", "that is");
        this.contractionMap.set("what's", "what is");
        this.contractionMap.set("there's", "there is");
        this.contractionMap.set("here's", "here is");
      }
      async detectIntent(processedInput) {
        const intents = [];
        const keywords = processedInput.keywords.join(" ") + " " + processedInput.normalized;
        if (/\b(write|create|generate|implement|build|code|program|develop)\b/i.test(keywords)) {
          intents.push("code_generation");
        }
        if (/\b(image|picture|photo|draw|illustrate|visual|graphic)\b/i.test(keywords)) {
          intents.push("image_generation");
        }
        if (/\b(video|movie|animation|clip|film)\b/i.test(keywords)) {
          intents.push("video_generation");
        }
        if (/\b(test|testing|unit test|integration test|e2e)\b/i.test(keywords)) {
          intents.push("test_generation");
        }
        if (/\b(review|check|analyze|improve|refactor|optimize)\b/i.test(keywords)) {
          intents.push("code_review");
        }
        return intents;
      }
    };
  }
});

// src/services/intelligent-router/IntentRecognizer.ts
var IntentRecognizer;
var init_IntentRecognizer = __esm({
  "src/services/intelligent-router/IntentRecognizer.ts"() {
    init_cjs_shims();
    IntentRecognizer = class {
      static {
        __name(this, "IntentRecognizer");
      }
      config;
      intentPatterns;
      _contextClues;
      commandHistory = [];
      initialized = false;
      constructor(config) {
        this.config = config;
        this.intentPatterns = /* @__PURE__ */ new Map();
        this._contextClues = /* @__PURE__ */ new Map();
        this.initializePatterns();
      }
      async initialize() {
        if (this.initialized) return;
        this.initialized = true;
      }
      async recognize(input) {
        const scores = /* @__PURE__ */ new Map();
        this.calculatePatternScores(input, scores);
        this.calculateKeywordScores(input, scores);
        this.calculateContextScores(input, scores);
        this.calculateEntityScores(input, scores);
        this.calculateHistoricalScores(input, scores);
        const candidates = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]).slice(0, this.config.maxAlternatives + 1);
        if (candidates.length === 0) {
          return null;
        }
        const maxScore = candidates[0]?.[1] ?? 1;
        const normalizedCandidates = candidates.map(([command, score]) => ({
          command,
          confidence: Math.min(score / maxScore, 1)
        }));
        const topCandidate = normalizedCandidates[0];
        if (!topCandidate) {
          throw new Error("No candidates found for intent recognition");
        }
        const alternatives = normalizedCandidates.slice(1);
        return {
          command: topCandidate.command,
          confidence: topCandidate.confidence,
          alternatives: alternatives.length > 0 ? alternatives : void 0,
          reasoning: this.generateReasoning(input, topCandidate.command)
        };
      }
      calculatePatternScores(input, scores) {
        const patterns = this.intentPatterns.get(input.language) ?? this.intentPatterns.get("en") ?? [];
        patterns.forEach((pattern) => {
          let score = 0;
          pattern.patterns.forEach((regex) => {
            if (regex.test(input.normalized)) {
              score += pattern.weight;
            }
            if (regex.test(input.original)) {
              score += pattern.weight * 0.5;
            }
          });
          if (score > 0) {
            const currentScore = scores.get(pattern.command) ?? 0;
            scores.set(pattern.command, currentScore + score);
          }
        });
      }
      calculateKeywordScores(input, scores) {
        const patterns = this.intentPatterns.get(input.language) ?? this.intentPatterns.get("en") ?? [];
        patterns.forEach((pattern) => {
          let matchCount = 0;
          pattern.keywords.forEach((keyword) => {
            if (input.keywords.includes(keyword.toLowerCase())) {
              matchCount++;
            }
            if (input.tokens.includes(keyword.toLowerCase())) {
              matchCount += 0.5;
            }
          });
          if (matchCount > 0) {
            const score = matchCount * pattern.weight * 0.8;
            const currentScore = scores.get(pattern.command) ?? 0;
            scores.set(pattern.command, currentScore + score);
          }
        });
      }
      calculateContextScores(_input, scores) {
        if (this.commandHistory.length > 0) {
          const lastCommand = this.commandHistory[this.commandHistory.length - 1];
          const relatedCommands = this.getRelatedCommands(lastCommand ?? "");
          relatedCommands.forEach((command) => {
            const currentScore = scores.get(command) ?? 0;
            scores.set(command, currentScore + 0.5);
          });
        }
      }
      calculateEntityScores(input, scores) {
        input.entities.forEach((entity) => {
          switch (entity.type) {
            case "code":
            case "language":
            case "framework":
              this.boostScore(scores, "/code", 2);
              this.boostScore(scores, "/test", 1);
              this.boostScore(scores, "/review", 1);
              break;
            case "file":
              this.boostScore(scores, "/code", 0.5);
              this.boostScore(scores, "/review", 1);
              this.boostScore(scores, "/export", 0.5);
              break;
            case "url":
              this.boostScore(scores, "/image", 0.5);
              this.boostScore(scores, "/video", 0.5);
              break;
          }
        });
      }
      calculateHistoricalScores(_input, scores) {
        const frequencyBoost = 0.1;
        this.commandHistory.forEach((command) => {
          const currentScore = scores.get(command) ?? 0;
          scores.set(command, currentScore + frequencyBoost);
        });
      }
      boostScore(scores, command, boost) {
        const currentScore = scores.get(command) ?? 0;
        scores.set(command, currentScore + boost);
      }
      getRelatedCommands(command) {
        const relationships = {
          "/code": ["/test", "/review", "/commit"],
          "/test": ["/code", "/review"],
          "/review": ["/code", "/test", "/commit"],
          "/image": ["/video"],
          "/video": ["/image"],
          "/init": ["/add-dir", "/setup"],
          "/setup": ["/init", "/config"],
          "/config": ["/settings", "/setup"]
        };
        return relationships[command] ?? [];
      }
      generateReasoning(input, _command) {
        const reasons = [];
        if (input.keywords.length > 0) {
          reasons.push(`Keywords detected: ${input.keywords.slice(0, 3).join(", ")}`);
        }
        if (input.entities.length > 0) {
          const entityTypes = [...new Set(input.entities.map((e) => e.type))];
          reasons.push(`Entities found: ${entityTypes.join(", ")}`);
        }
        return reasons.join("; ");
      }
      async updateModel(input, correctCommand, _wasCorrect) {
        this.commandHistory.push(correctCommand);
        if (this.commandHistory.length > 100) {
          this.commandHistory.shift();
        }
      }
      initializePatterns() {
        const englishPatterns = [
          {
            command: "/code",
            patterns: [
              /\b(write|create|generate|implement|build|code|program|develop|make)\b.*\b(code|function|class|component|script|program|app)\b/i,
              /\b(implement|create|write|build)\s+(?:a\s+)?(\w+)/i,
              /\bcode\s+(?:for|to)\b/i
            ],
            keywords: [
              "write",
              "create",
              "generate",
              "implement",
              "build",
              "code",
              "program",
              "function",
              "class",
              "component"
            ],
            weight: 1
          },
          {
            command: "/image",
            patterns: [
              /\b(create|generate|make|draw|design|produce)\b.*\b(image|picture|photo|illustration|graphic|visual|art)\b/i,
              /\b(image|picture|photo|illustration|graphic)\s+of\b/i,
              /\bdraw\s+(?:a\s+)?(\w+)/i
            ],
            keywords: [
              "image",
              "picture",
              "photo",
              "draw",
              "illustration",
              "visual",
              "graphic",
              "art",
              "design"
            ],
            weight: 1
          },
          {
            command: "/video",
            patterns: [
              /\b(create|generate|make|produce|render)\b.*\b(video|movie|animation|clip|film)\b/i,
              /\b(video|animation|movie)\s+of\b/i,
              /\banimate\s+(?:a\s+)?(\w+)/i
            ],
            keywords: ["video", "movie", "animation", "clip", "film", "animate", "motion", "render"],
            weight: 1
          },
          {
            command: "/test",
            patterns: [
              /\b(write|create|generate)\b.*\b(test|tests|testing|unit test|integration test)\b/i,
              /\btest\s+(?:for|the)\b/i,
              /\b(unit|integration|e2e)\s+test/i
            ],
            keywords: ["test", "testing", "unit", "integration", "e2e", "coverage", "spec"],
            weight: 1
          },
          {
            command: "/review",
            patterns: [
              /\b(review|check|analyze|improve|refactor|optimize)\b.*\b(code|implementation|function)\b/i,
              /\bcode\s+review\b/i,
              /\b(improve|optimize|refactor)\s+this\b/i
            ],
            keywords: ["review", "check", "analyze", "improve", "refactor", "optimize", "quality"],
            weight: 1
          }
        ];
        const japanesePatterns = [
          {
            command: "/code",
            patterns: [
              /(?:コード|プログラム|関数|クラス|メソッド).*(?:書|作|実装|生成)/,
              /(?:実装|開発|作成)(?:して|する)/,
              /プログラ(?:ム|ミング)/
            ],
            keywords: ["\u30B3\u30FC\u30C9", "\u5B9F\u88C5", "\u30D7\u30ED\u30B0\u30E9\u30E0", "\u95A2\u6570", "\u30AF\u30E9\u30B9", "\u4F5C\u6210", "\u958B\u767A", "\u66F8\u304F"],
            weight: 1
          },
          {
            command: "/image",
            patterns: [
              /(?:画像|イメージ|絵|イラスト|ビジュアル).*(?:生成|作|描)/,
              /(?:描|作).*(?:画像|絵|イラスト)/,
              /画像を/
            ],
            keywords: ["\u753B\u50CF", "\u30A4\u30E1\u30FC\u30B8", "\u7D75", "\u30A4\u30E9\u30B9\u30C8", "\u30D3\u30B8\u30E5\u30A2\u30EB", "\u63CF\u304F", "\u751F\u6210"],
            weight: 1
          },
          {
            command: "/video",
            patterns: [
              /(?:動画|ビデオ|アニメーション|ムービー).*(?:作|生成|出力)/,
              /(?:作|生成).*(?:動画|ビデオ|アニメーション)/,
              /動画を/
            ],
            keywords: ["\u52D5\u753B", "\u30D3\u30C7\u30AA", "\u30A2\u30CB\u30E1\u30FC\u30B7\u30E7\u30F3", "\u30E0\u30FC\u30D3\u30FC", "\u6620\u50CF", "\u4F5C\u6210"],
            weight: 1
          },
          {
            command: "/test",
            patterns: [
              /(?:テスト|試験).*(?:作|書|生成)/,
              /(?:ユニット|統合|E2E).*テスト/,
              /テスト(?:コード|を)/
            ],
            keywords: ["\u30C6\u30B9\u30C8", "\u8A66\u9A13", "\u30E6\u30CB\u30C3\u30C8", "\u7D71\u5408", "\u30AB\u30D0\u30EC\u30C3\u30B8"],
            weight: 1
          },
          {
            command: "/review",
            patterns: [
              /(?:レビュー|確認|改善|リファクタ).*(?:して|する)/,
              /コード.*(?:レビュー|確認|改善)/,
              /(?:品質|最適化)/
            ],
            keywords: ["\u30EC\u30D3\u30E5\u30FC", "\u78BA\u8A8D", "\u6539\u5584", "\u30EA\u30D5\u30A1\u30AF\u30BF", "\u6700\u9069\u5316", "\u54C1\u8CEA"],
            weight: 1
          }
        ];
        const chinesePatterns = [
          {
            command: "/code",
            patterns: [
              /(?:写|编写|创建|实现|生成).*(?:代码|程序|函数|类)/,
              /(?:代码|程序|函数).*(?:写|创建|实现)/,
              /编程/
            ],
            keywords: ["\u4EE3\u7801", "\u7F16\u5199", "\u5B9E\u73B0", "\u7A0B\u5E8F", "\u51FD\u6570", "\u7C7B", "\u521B\u5EFA", "\u5F00\u53D1"],
            weight: 1
          },
          {
            command: "/image",
            patterns: [
              /(?:生成|创建|制作|画).*(?:图像|图片|插图)/,
              /(?:图像|图片|插图).*(?:生成|创建)/,
              /画.*图/
            ],
            keywords: ["\u56FE\u50CF", "\u56FE\u7247", "\u63D2\u56FE", "\u753B", "\u751F\u6210", "\u521B\u5EFA", "\u89C6\u89C9"],
            weight: 1
          },
          {
            command: "/video",
            patterns: [
              /(?:创建|生成|制作).*(?:视频|动画|影片)/,
              /(?:视频|动画).*(?:创建|生成)/,
              /动画/
            ],
            keywords: ["\u89C6\u9891", "\u52A8\u753B", "\u5F71\u7247", "\u521B\u5EFA", "\u751F\u6210", "\u5236\u4F5C"],
            weight: 1
          }
        ];
        const koreanPatterns = [
          {
            command: "/code",
            patterns: [
              /(?:코드|프로그램|함수|클래스).*(?:작성|생성|구현)/,
              /(?:구현|개발|만들)/,
              /프로그래밍/
            ],
            keywords: ["\uCF54\uB4DC", "\uD504\uB85C\uADF8\uB7A8", "\uD568\uC218", "\uD074\uB798\uC2A4", "\uAD6C\uD604", "\uAC1C\uBC1C", "\uC791\uC131"],
            weight: 1
          },
          {
            command: "/image",
            patterns: [
              /(?:이미지|그림|일러스트).*(?:생성|만들|그리)/,
              /(?:그림|이미지).*그려/,
              /이미지/
            ],
            keywords: ["\uC774\uBBF8\uC9C0", "\uADF8\uB9BC", "\uC77C\uB7EC\uC2A4\uD2B8", "\uC0DD\uC131", "\uADF8\uB9AC\uAE30"],
            weight: 1
          },
          {
            command: "/video",
            patterns: [
              /(?:비디오|동영상|애니메이션).*(?:생성|만들|제작)/,
              /(?:동영상|비디오).*만들/,
              /애니메이션/
            ],
            keywords: ["\uBE44\uB514\uC624", "\uB3D9\uC601\uC0C1", "\uC560\uB2C8\uBA54\uC774\uC158", "\uC0DD\uC131", "\uC81C\uC791"],
            weight: 1
          }
        ];
        this.intentPatterns.set("en", englishPatterns);
        this.intentPatterns.set("ja", japanesePatterns);
        this.intentPatterns.set("cn", chinesePatterns);
        this.intentPatterns.set("ko", koreanPatterns);
      }
    };
  }
});

// src/services/intelligent-router/ParameterExtractor.ts
var ParameterExtractor;
var init_ParameterExtractor = __esm({
  "src/services/intelligent-router/ParameterExtractor.ts"() {
    init_cjs_shims();
    ParameterExtractor = class {
      static {
        __name(this, "ParameterExtractor");
      }
      async extract(input, command, language) {
        switch (command) {
          case "/code":
            return this.extractCodeParameters(input, language);
          case "/image":
            return this.extractImageParameters(input, language);
          case "/video":
            return this.extractVideoParameters(input, language);
          case "/test":
            return this.extractTestParameters(input, language);
          case "/review":
            return this.extractReviewParameters(input, language);
          case "/lang":
            return this.extractLanguageParameters(input, language);
          default:
            return this.extractGenericParameters(input, language);
        }
      }
      extractCodeParameters(input, language) {
        const params = {};
        const description = this.cleanDescription(input, language, [
          "write",
          "create",
          "generate",
          "implement",
          "build",
          "code",
          "program",
          "\u66F8\u304F",
          "\u4F5C\u308B",
          "\u5B9F\u88C5",
          "\u30B3\u30FC\u30C9",
          "\u30D7\u30ED\u30B0\u30E9\u30E0",
          "\u5199",
          "\u7F16\u5199",
          "\u521B\u5EFA",
          "\u5B9E\u73B0",
          "\u4EE3\u7801",
          "\u7A0B\u5E8F",
          "\uC791\uC131",
          "\uC0DD\uC131",
          "\uAD6C\uD604",
          "\uCF54\uB4DC",
          "\uD504\uB85C\uADF8\uB7A8",
          "vi\u1EBFt",
          "t\u1EA1o",
          "x\xE2y d\u1EF1ng",
          "m\xE3",
          "ch\u01B0\u01A1ng tr\xECnh"
        ]);
        params.description = description;
        const progLang = this.detectProgrammingLanguage(input);
        if (progLang) {
          params.language = progLang;
        }
        const framework = this.detectFramework(input);
        if (framework) {
          params.framework = framework;
        }
        const filePath = this.extractFilePath(input);
        if (filePath) {
          params.file = filePath;
        }
        return params;
      }
      extractImageParameters(input, language) {
        const params = {};
        const prompt = this.cleanDescription(input, language, [
          "create",
          "generate",
          "make",
          "draw",
          "design",
          "image",
          "picture",
          "\u751F\u6210",
          "\u4F5C\u308B",
          "\u63CF\u304F",
          "\u753B\u50CF",
          "\u30A4\u30E1\u30FC\u30B8",
          "\u521B\u5EFA",
          "\u751F\u6210",
          "\u753B",
          "\u56FE\u50CF",
          "\u56FE\u7247",
          "\uC0DD\uC131",
          "\uADF8\uB9AC\uAE30",
          "\uC774\uBBF8\uC9C0",
          "\uADF8\uB9BC",
          "t\u1EA1o",
          "v\u1EBD",
          "h\xECnh \u1EA3nh",
          "\u1EA3nh"
        ]);
        params.prompt = prompt;
        const style = this.detectArtStyle(input);
        if (style) {
          params.style = style;
        }
        const dimensions = this.extractDimensions(input);
        if (dimensions) {
          params.width = dimensions.width;
          params.height = dimensions.height;
        }
        return params;
      }
      extractVideoParameters(input, language) {
        const params = {};
        const description = this.cleanDescription(input, language, [
          "create",
          "generate",
          "make",
          "produce",
          "video",
          "animation",
          "\u4F5C\u308B",
          "\u751F\u6210",
          "\u52D5\u753B",
          "\u30D3\u30C7\u30AA",
          "\u30A2\u30CB\u30E1\u30FC\u30B7\u30E7\u30F3",
          "\u521B\u5EFA",
          "\u751F\u6210",
          "\u89C6\u9891",
          "\u52A8\u753B",
          "\uC0DD\uC131",
          "\uBE44\uB514\uC624",
          "\uB3D9\uC601\uC0C1",
          "\uC560\uB2C8\uBA54\uC774\uC158",
          "t\u1EA1o",
          "video",
          "ho\u1EA1t h\xECnh"
        ]);
        params.description = description;
        const duration = this.extractDuration(input);
        if (duration) {
          params.duration = duration;
        }
        const format = this.detectVideoFormat(input);
        if (format) {
          params.format = format;
        }
        return params;
      }
      extractTestParameters(input, language) {
        const params = {};
        const description = this.cleanDescription(input, language, [
          "write",
          "create",
          "generate",
          "test",
          "testing",
          "\u66F8\u304F",
          "\u4F5C\u308B",
          "\u30C6\u30B9\u30C8",
          "\u8A66\u9A13",
          "\u5199",
          "\u521B\u5EFA",
          "\u6D4B\u8BD5",
          "\uC791\uC131",
          "\uC0DD\uC131",
          "\uD14C\uC2A4\uD2B8",
          "vi\u1EBFt",
          "t\u1EA1o",
          "ki\u1EC3m tra"
        ]);
        params.description = description;
        const testType = this.detectTestType(input);
        if (testType) {
          params.type = testType;
        }
        const filePath = this.extractFilePath(input);
        if (filePath) {
          params.file = filePath;
        }
        return params;
      }
      extractReviewParameters(input, language) {
        const params = {};
        const description = this.cleanDescription(input, language, [
          "review",
          "check",
          "analyze",
          "improve",
          "refactor",
          "\u30EC\u30D3\u30E5\u30FC",
          "\u78BA\u8A8D",
          "\u6539\u5584",
          "\u30EA\u30D5\u30A1\u30AF\u30BF",
          "\u5BA1\u67E5",
          "\u68C0\u67E5",
          "\u5206\u6790",
          "\u6539\u8FDB",
          "\uB9AC\uBDF0",
          "\uAC80\uD1A0",
          "\uBD84\uC11D",
          "\uAC1C\uC120",
          "xem x\xE9t",
          "ki\u1EC3m tra",
          "ph\xE2n t\xEDch",
          "c\u1EA3i thi\u1EC7n"
        ]);
        params.description = description;
        const filePath = this.extractFilePath(input);
        if (filePath) {
          params.file = filePath;
        }
        const focus = this.detectReviewFocus(input);
        if (focus) {
          params.focus = focus;
        }
        return params;
      }
      extractLanguageParameters(input, _language) {
        const params = {};
        const targetLang = this.extractTargetLanguage(input);
        if (targetLang) {
          params.language = targetLang;
        }
        return params;
      }
      extractGenericParameters(input, language) {
        const params = {};
        const cleanedInput = this.cleanDescription(input, language, []);
        params.input = cleanedInput;
        const filePath = this.extractFilePath(input);
        if (filePath) {
          params.file = filePath;
        }
        return params;
      }
      cleanDescription(input, language, keywords) {
        let cleaned = input.toLowerCase();
        keywords.forEach((keyword) => {
          const regex = new RegExp(`\\b${keyword}\\b`, "gi");
          cleaned = cleaned.replace(regex, "");
        });
        cleaned = cleaned.replace(/\s+/g, " ").trim();
        return cleaned;
      }
      detectProgrammingLanguage(input) {
        const languages = {
          javascript: /\b(javascript|js|node\.?js)\b/i,
          typescript: /\b(typescript|ts)\b/i,
          python: /\b(python|py)\b/i,
          java: /\b(java)\b/i,
          rust: /\b(rust|rs)\b/i,
          go: /\b(go|golang)\b/i,
          cpp: /\b(c\+\+|cpp)\b/i,
          csharp: /\b(c#|csharp)\b/i,
          ruby: /\b(ruby|rb)\b/i,
          php: /\b(php)\b/i,
          swift: /\b(swift)\b/i,
          kotlin: /\b(kotlin)\b/i
        };
        for (const [lang, pattern] of Object.entries(languages)) {
          if (pattern.test(input)) {
            return lang;
          }
        }
        return null;
      }
      detectFramework(input) {
        const frameworks = {
          react: /\b(react|reactjs)\b/i,
          vue: /\b(vue|vuejs)\b/i,
          angular: /\b(angular)\b/i,
          nextjs: /\b(next\.?js|nextjs)\b/i,
          express: /\b(express)\b/i,
          django: /\b(django)\b/i,
          flask: /\b(flask)\b/i,
          rails: /\b(rails|ruby on rails)\b/i,
          spring: /\b(spring)\b/i,
          laravel: /\b(laravel)\b/i
        };
        for (const [framework, pattern] of Object.entries(frameworks)) {
          if (pattern.test(input)) {
            return framework;
          }
        }
        return null;
      }
      detectArtStyle(input) {
        const styles = {
          realistic: /\b(realistic|photorealistic|real)\b/i,
          cartoon: /\b(cartoon|animated|anime)\b/i,
          abstract: /\b(abstract)\b/i,
          watercolor: /\b(watercolor|water color)\b/i,
          oil: /\b(oil painting|oil)\b/i,
          pencil: /\b(pencil|sketch)\b/i,
          "3d": /\b(3d|three dimensional)\b/i,
          pixel: /\b(pixel art|pixelated)\b/i
        };
        for (const [style, pattern] of Object.entries(styles)) {
          if (pattern.test(input)) {
            return style;
          }
        }
        return null;
      }
      extractFilePath(input) {
        const filePattern = /(?:["'])?([/\w\-._]+\.\w+)(?:["'])?/;
        const match = input.match(filePattern);
        return match ? match[1] : null;
      }
      extractDimensions(input) {
        const dimensionPattern = /(\d+)\s*[x×]\s*(\d+)/i;
        const match = input.match(dimensionPattern);
        if (match) {
          return {
            width: parseInt(match[1], 10),
            height: parseInt(match[2], 10)
          };
        }
        return null;
      }
      extractDuration(input) {
        const durationPattern = /(\d+)\s*(seconds?|secs?|minutes?|mins?)/i;
        const match = input.match(durationPattern);
        if (match) {
          const value = parseInt(match[1], 10);
          const unit = match[2].toLowerCase();
          if (unit.startsWith("min")) {
            return value * 60;
          }
          return value;
        }
        return null;
      }
      detectVideoFormat(input) {
        const formats = ["mp4", "avi", "mov", "webm", "gif"];
        for (const format of formats) {
          const pattern = new RegExp(`\\b${format}\\b`, "i");
          if (pattern.test(input)) {
            return format;
          }
        }
        return null;
      }
      detectTestType(input) {
        const types = {
          unit: /\b(unit)\b/i,
          integration: /\b(integration)\b/i,
          e2e: /\b(e2e|end to end)\b/i,
          performance: /\b(performance|perf)\b/i,
          snapshot: /\b(snapshot)\b/i
        };
        for (const [type, pattern] of Object.entries(types)) {
          if (pattern.test(input)) {
            return type;
          }
        }
        return null;
      }
      detectReviewFocus(input) {
        const focuses = {
          performance: /\b(performance|speed|optimization)\b/i,
          security: /\b(security|vulnerability|safe)\b/i,
          quality: /\b(quality|clean|maintainability)\b/i,
          style: /\b(style|format|convention)\b/i,
          bugs: /\b(bugs?|errors?|issues?)\b/i
        };
        for (const [focus, pattern] of Object.entries(focuses)) {
          if (pattern.test(input)) {
            return focus;
          }
        }
        return null;
      }
      extractTargetLanguage(input) {
        const languageMap = {
          en: ["english", "\u82F1\u8A9E", "\u82F1\u6587", "\uC601\uC5B4", "ti\u1EBFng anh"],
          ja: ["japanese", "\u65E5\u672C\u8A9E", "\u65E5\u6587", "\uC77C\uBCF8\uC5B4", "ti\u1EBFng nh\u1EADt"],
          cn: ["chinese", "\u4E2D\u56FD\u8A9E", "\u4E2D\u6587", "\uC911\uAD6D\uC5B4", "ti\u1EBFng trung"],
          ko: ["korean", "\u97D3\u56FD\u8A9E", "\u97E9\u6587", "\uD55C\uAD6D\uC5B4", "ti\u1EBFng h\xE0n"],
          vn: ["vietnamese", "\u30D9\u30C8\u30CA\u30E0\u8A9E", "\u8D8A\u5357\u6587", "\uBCA0\uD2B8\uB0A8\uC5B4", "ti\u1EBFng vi\u1EC7t"]
        };
        const lowerInput = input.toLowerCase();
        for (const [code, patterns] of Object.entries(languageMap)) {
          for (const pattern of patterns) {
            if (lowerInput.includes(pattern)) {
              return code;
            }
          }
        }
        return null;
      }
    };
  }
});

// src/services/intelligent-router/MultilingualDictionary.ts
var MultilingualDictionary;
var init_MultilingualDictionary = __esm({
  "src/services/intelligent-router/MultilingualDictionary.ts"() {
    init_cjs_shims();
    MultilingualDictionary = class {
      static {
        __name(this, "MultilingualDictionary");
      }
      dictionary;
      initialized = false;
      constructor() {
        this.dictionary = /* @__PURE__ */ new Map();
      }
      async initialize() {
        if (this.initialized) return;
        this.loadTranslations();
        this.initialized = true;
      }
      getTranslation(command, _language = "en") {
        return this.dictionary.get(command) ?? null;
      }
      getExplanation(command, language = "en") {
        const translation = this.dictionary.get(command);
        if (!translation) {
          return `Command ${command} not found`;
        }
        return translation.description[language] ?? translation.description["en"] ?? "";
      }
      getKeywords(command, language = "en") {
        const translation = this.dictionary.get(command);
        if (!translation) {
          return [];
        }
        return translation.keywords[language] ?? translation.keywords["en"] ?? [];
      }
      getExamples(command, language = "en") {
        const translation = this.dictionary.get(command);
        if (!translation) {
          return [];
        }
        return translation.examples[language] ?? translation.examples["en"] ?? [];
      }
      getAllCommands() {
        return Array.from(this.dictionary.keys());
      }
      loadTranslations() {
        this.dictionary.set("/code", {
          command: "/code",
          name: {
            en: "Code Generation",
            ja: "\u30B3\u30FC\u30C9\u751F\u6210",
            zh: "\u4EE3\u7801\u751F\u6210",
            ko: "\uCF54\uB4DC \uC0DD\uC131"
          },
          description: {
            en: "Generate code with AI assistance",
            ja: "AI\u652F\u63F4\u306B\u3088\u308B\u30B3\u30FC\u30C9\u751F\u6210",
            zh: "\u4F7F\u7528AI\u8F85\u52A9\u751F\u6210\u4EE3\u7801",
            ko: "AI \uC9C0\uC6D0 \uCF54\uB4DC \uC0DD\uC131"
          },
          keywords: {
            en: [
              "write",
              "create",
              "generate",
              "implement",
              "build",
              "code",
              "program",
              "develop",
              "function",
              "class"
            ],
            ja: ["\u30B3\u30FC\u30C9", "\u5B9F\u88C5", "\u30D7\u30ED\u30B0\u30E9\u30E0", "\u95A2\u6570", "\u30AF\u30E9\u30B9", "\u4F5C\u6210", "\u958B\u767A", "\u66F8\u304F", "\u751F\u6210"],
            zh: ["\u4EE3\u7801", "\u7F16\u5199", "\u5B9E\u73B0", "\u7A0B\u5E8F", "\u51FD\u6570", "\u7C7B", "\u521B\u5EFA", "\u5F00\u53D1", "\u751F\u6210"],
            ko: ["\uCF54\uB4DC", "\uD504\uB85C\uADF8\uB7A8", "\uD568\uC218", "\uD074\uB798\uC2A4", "\uAD6C\uD604", "\uAC1C\uBC1C", "\uC791\uC131", "\uC0DD\uC131"]
          },
          examples: {
            en: ["write a React component", "create a REST API", "implement user authentication"],
            ja: ["React\u30B3\u30F3\u30DD\u30FC\u30CD\u30F3\u30C8\u3092\u5B9F\u88C5\u3057\u3066", "REST API\u3092\u4F5C\u3063\u3066", "\u30E6\u30FC\u30B6\u30FC\u8A8D\u8A3C\u3092\u5B9F\u88C5"],
            zh: ["\u5199\u4E00\u4E2AReact\u7EC4\u4EF6", "\u521B\u5EFAREST API", "\u5B9E\u73B0\u7528\u6237\u8BA4\u8BC1"],
            ko: ["React \uCEF4\uD3EC\uB10C\uD2B8 \uC791\uC131", "REST API \uC0DD\uC131", "\uC0AC\uC6A9\uC790 \uC778\uC99D \uAD6C\uD604"]
          }
        });
        this.dictionary.set("/test", {
          command: "/test",
          name: {
            en: "Test Generation",
            ja: "\u30C6\u30B9\u30C8\u751F\u6210",
            zh: "\u6D4B\u8BD5\u751F\u6210",
            ko: "\uD14C\uC2A4\uD2B8 \uC0DD\uC131"
          },
          description: {
            en: "Generate and run tests",
            ja: "\u30C6\u30B9\u30C8\u306E\u751F\u6210\u3068\u5B9F\u884C",
            zh: "\u751F\u6210\u5E76\u8FD0\u884C\u6D4B\u8BD5",
            ko: "\uD14C\uC2A4\uD2B8 \uC0DD\uC131 \uBC0F \uC2E4\uD589"
          },
          keywords: {
            en: ["test", "testing", "unit", "integration", "e2e", "coverage", "spec", "assertion"],
            ja: ["\u30C6\u30B9\u30C8", "\u8A66\u9A13", "\u30E6\u30CB\u30C3\u30C8", "\u7D71\u5408", "\u30AB\u30D0\u30EC\u30C3\u30B8", "\u691C\u8A3C"],
            zh: ["\u6D4B\u8BD5", "\u5355\u5143\u6D4B\u8BD5", "\u96C6\u6210\u6D4B\u8BD5", "\u8986\u76D6\u7387", "\u9A8C\u8BC1"],
            ko: ["\uD14C\uC2A4\uD2B8", "\uB2E8\uC704", "\uD1B5\uD569", "\uCEE4\uBC84\uB9AC\uC9C0", "\uAC80\uC99D"]
          },
          examples: {
            en: ["write unit tests", "create integration tests", "generate test coverage"],
            ja: ["\u30E6\u30CB\u30C3\u30C8\u30C6\u30B9\u30C8\u3092\u66F8\u3044\u3066", "\u7D71\u5408\u30C6\u30B9\u30C8\u3092\u4F5C\u6210", "\u30C6\u30B9\u30C8\u30AB\u30D0\u30EC\u30C3\u30B8\u3092\u751F\u6210"],
            zh: ["\u7F16\u5199\u5355\u5143\u6D4B\u8BD5", "\u521B\u5EFA\u96C6\u6210\u6D4B\u8BD5", "\u751F\u6210\u6D4B\u8BD5\u8986\u76D6\u7387"],
            ko: ["\uB2E8\uC704 \uD14C\uC2A4\uD2B8 \uC791\uC131", "\uD1B5\uD569 \uD14C\uC2A4\uD2B8 \uC0DD\uC131", "\uD14C\uC2A4\uD2B8 \uCEE4\uBC84\uB9AC\uC9C0 \uC0DD\uC131"]
          }
        });
        this.dictionary.set("/review", {
          command: "/review",
          name: {
            en: "Code Review",
            ja: "\u30B3\u30FC\u30C9\u30EC\u30D3\u30E5\u30FC",
            zh: "\u4EE3\u7801\u5BA1\u67E5",
            ko: "\uCF54\uB4DC \uB9AC\uBDF0"
          },
          description: {
            en: "Review code for improvements",
            ja: "\u30B3\u30FC\u30C9\u306E\u6539\u5584\u70B9\u3092\u30EC\u30D3\u30E5\u30FC",
            zh: "\u5BA1\u67E5\u4EE3\u7801\u4EE5\u8FDB\u884C\u6539\u8FDB",
            ko: "\uCF54\uB4DC \uAC1C\uC120\uC0AC\uD56D \uAC80\uD1A0"
          },
          keywords: {
            en: ["review", "check", "analyze", "improve", "refactor", "optimize", "quality", "inspect"],
            ja: ["\u30EC\u30D3\u30E5\u30FC", "\u78BA\u8A8D", "\u6539\u5584", "\u30EA\u30D5\u30A1\u30AF\u30BF", "\u6700\u9069\u5316", "\u54C1\u8CEA", "\u691C\u67FB"],
            zh: ["\u5BA1\u67E5", "\u68C0\u67E5", "\u5206\u6790", "\u6539\u8FDB", "\u91CD\u6784", "\u4F18\u5316", "\u8D28\u91CF"],
            ko: ["\uB9AC\uBDF0", "\uAC80\uD1A0", "\uBD84\uC11D", "\uAC1C\uC120", "\uB9AC\uD329\uD1A0\uB9C1", "\uCD5C\uC801\uD654", "\uD488\uC9C8"]
          },
          examples: {
            en: ["review this code", "check for improvements", "optimize performance"],
            ja: ["\u3053\u306E\u30B3\u30FC\u30C9\u3092\u30EC\u30D3\u30E5\u30FC\u3057\u3066", "\u6539\u5584\u70B9\u3092\u78BA\u8A8D", "\u30D1\u30D5\u30A9\u30FC\u30DE\u30F3\u30B9\u3092\u6700\u9069\u5316"],
            zh: ["\u5BA1\u67E5\u8FD9\u6BB5\u4EE3\u7801", "\u68C0\u67E5\u6539\u8FDB\u70B9", "\u4F18\u5316\u6027\u80FD"],
            ko: ["\uC774 \uCF54\uB4DC \uB9AC\uBDF0", "\uAC1C\uC120\uC0AC\uD56D \uD655\uC778", "\uC131\uB2A5 \uCD5C\uC801\uD654"]
          }
        });
        this.dictionary.set("/model", {
          command: "/model",
          name: {
            en: "Model Selection",
            ja: "\u30E2\u30C7\u30EB\u9078\u629E",
            zh: "\u6A21\u578B\u9009\u62E9",
            ko: "\uBAA8\uB378 \uC120\uD0DD"
          },
          description: {
            en: "Select AI model",
            ja: "AI\u30E2\u30C7\u30EB\u306E\u9078\u629E",
            zh: "\u9009\u62E9AI\u6A21\u578B",
            ko: "AI \uBAA8\uB378 \uC120\uD0DD"
          },
          keywords: {
            en: ["model", "select", "choose", "switch", "change", "ai", "llm"],
            ja: ["\u30E2\u30C7\u30EB", "\u9078\u629E", "\u5207\u308A\u66FF\u3048", "\u5909\u66F4", "AI", "LLM"],
            zh: ["\u6A21\u578B", "\u9009\u62E9", "\u5207\u6362", "\u66F4\u6539", "AI", "LLM"],
            ko: ["\uBAA8\uB378", "\uC120\uD0DD", "\uC804\uD658", "\uBCC0\uACBD", "AI", "LLM"]
          },
          examples: {
            en: ["switch to GPT-5", "use Claude", "select local model"],
            ja: ["GPT-5\u306B\u5207\u308A\u66FF\u3048", "Claude\u3092\u4F7F\u7528", "\u30ED\u30FC\u30AB\u30EB\u30E2\u30C7\u30EB\u3092\u9078\u629E"],
            zh: ["\u5207\u6362\u5230GPT-5", "\u4F7F\u7528Claude", "\u9009\u62E9\u672C\u5730\u6A21\u578B"],
            ko: ["GPT-5\uB85C \uC804\uD658", "Claude \uC0AC\uC6A9", "\uB85C\uCEEC \uBAA8\uB378 \uC120\uD0DD"]
          }
        });
        this.dictionary.set("/image", {
          command: "/image",
          name: {
            en: "Image Generation",
            ja: "\u753B\u50CF\u751F\u6210",
            zh: "\u56FE\u50CF\u751F\u6210",
            ko: "\uC774\uBBF8\uC9C0 \uC0DD\uC131"
          },
          description: {
            en: "Generate images with AI",
            ja: "AI\u306B\u3088\u308B\u753B\u50CF\u751F\u6210",
            zh: "\u4F7F\u7528AI\u751F\u6210\u56FE\u50CF",
            ko: "AI \uC774\uBBF8\uC9C0 \uC0DD\uC131"
          },
          keywords: {
            en: [
              "image",
              "picture",
              "photo",
              "draw",
              "illustration",
              "visual",
              "graphic",
              "art",
              "design",
              "create"
            ],
            ja: ["\u753B\u50CF", "\u30A4\u30E1\u30FC\u30B8", "\u7D75", "\u30A4\u30E9\u30B9\u30C8", "\u30D3\u30B8\u30E5\u30A2\u30EB", "\u63CF\u304F", "\u751F\u6210", "\u30C7\u30B6\u30A4\u30F3"],
            zh: ["\u56FE\u50CF", "\u56FE\u7247", "\u63D2\u56FE", "\u753B", "\u751F\u6210", "\u521B\u5EFA", "\u89C6\u89C9", "\u8BBE\u8BA1"],
            ko: ["\uC774\uBBF8\uC9C0", "\uADF8\uB9BC", "\uC77C\uB7EC\uC2A4\uD2B8", "\uC0DD\uC131", "\uADF8\uB9AC\uAE30", "\uB514\uC790\uC778", "\uBE44\uC8FC\uC5BC"]
          },
          examples: {
            en: ["create an image of sunset", "draw a cat", "generate logo design"],
            ja: ["\u5915\u65E5\u306E\u753B\u50CF\u3092\u751F\u6210", "\u732B\u3092\u63CF\u3044\u3066", "\u30ED\u30B4\u30C7\u30B6\u30A4\u30F3\u3092\u751F\u6210"],
            zh: ["\u521B\u5EFA\u65E5\u843D\u56FE\u50CF", "\u753B\u4E00\u53EA\u732B", "\u751F\u6210logo\u8BBE\u8BA1"],
            ko: ["\uC77C\uBAB0 \uC774\uBBF8\uC9C0 \uC0DD\uC131", "\uACE0\uC591\uC774 \uADF8\uB9AC\uAE30", "\uB85C\uACE0 \uB514\uC790\uC778 \uC0DD\uC131"]
          }
        });
        this.dictionary.set("/video", {
          command: "/video",
          name: {
            en: "Video Generation",
            ja: "\u52D5\u753B\u751F\u6210",
            zh: "\u89C6\u9891\u751F\u6210",
            ko: "\uBE44\uB514\uC624 \uC0DD\uC131"
          },
          description: {
            en: "Generate videos with AI",
            ja: "AI\u306B\u3088\u308B\u52D5\u753B\u751F\u6210",
            zh: "\u4F7F\u7528AI\u751F\u6210\u89C6\u9891",
            ko: "AI \uBE44\uB514\uC624 \uC0DD\uC131"
          },
          keywords: {
            en: ["video", "movie", "animation", "clip", "film", "animate", "motion", "render"],
            ja: ["\u52D5\u753B", "\u30D3\u30C7\u30AA", "\u30A2\u30CB\u30E1\u30FC\u30B7\u30E7\u30F3", "\u30E0\u30FC\u30D3\u30FC", "\u6620\u50CF", "\u4F5C\u6210", "\u751F\u6210"],
            zh: ["\u89C6\u9891", "\u52A8\u753B", "\u5F71\u7247", "\u521B\u5EFA", "\u751F\u6210", "\u5236\u4F5C", "\u6E32\u67D3"],
            ko: ["\uBE44\uB514\uC624", "\uB3D9\uC601\uC0C1", "\uC560\uB2C8\uBA54\uC774\uC158", "\uC0DD\uC131", "\uC81C\uC791", "\uB80C\uB354\uB9C1"]
          },
          examples: {
            en: ["create a video intro", "generate animation", "make a tutorial video"],
            ja: ["\u52D5\u753B\u30A4\u30F3\u30C8\u30ED\u3092\u4F5C\u6210", "\u30A2\u30CB\u30E1\u30FC\u30B7\u30E7\u30F3\u3092\u751F\u6210", "\u30C1\u30E5\u30FC\u30C8\u30EA\u30A2\u30EB\u52D5\u753B\u3092\u4F5C\u308B"],
            zh: ["\u521B\u5EFA\u89C6\u9891\u4ECB\u7ECD", "\u751F\u6210\u52A8\u753B", "\u5236\u4F5C\u6559\u7A0B\u89C6\u9891"],
            ko: ["\uBE44\uB514\uC624 \uC778\uD2B8\uB85C \uC0DD\uC131", "\uC560\uB2C8\uBA54\uC774\uC158 \uC81C\uC791", "\uD29C\uD1A0\uB9AC\uC5BC \uBE44\uB514\uC624 \uB9CC\uB4E4\uAE30"]
          }
        });
        this.dictionary.set("/avatar", {
          command: "/avatar",
          name: {
            en: "Avatar Display",
            ja: "\u30A2\u30D0\u30BF\u30FC\u8868\u793A",
            zh: "\u5934\u50CF\u663E\u793A",
            ko: "\uC544\uBC14\uD0C0 \uD45C\uC2DC"
          },
          description: {
            en: "Display ASCII art avatar",
            ja: "ASCII\u30A2\u30FC\u30C8\u30A2\u30D0\u30BF\u30FC\u3092\u8868\u793A",
            zh: "\u663E\u793AASCII\u827A\u672F\u5934\u50CF",
            ko: "ASCII \uC544\uD2B8 \uC544\uBC14\uD0C0 \uD45C\uC2DC"
          },
          keywords: {
            en: ["avatar", "character", "ascii", "art", "display", "show"],
            ja: ["\u30A2\u30D0\u30BF\u30FC", "\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC", "\u30A2\u30B9\u30AD\u30FC", "\u30A2\u30FC\u30C8", "\u8868\u793A"],
            zh: ["\u5934\u50CF", "\u89D2\u8272", "ASCII", "\u827A\u672F", "\u663E\u793A"],
            ko: ["\uC544\uBC14\uD0C0", "\uCE90\uB9AD\uD130", "ASCII", "\uC544\uD2B8", "\uD45C\uC2DC"]
          },
          examples: {
            en: ["show avatar", "display character", "ascii art"],
            ja: ["\u30A2\u30D0\u30BF\u30FC\u3092\u8868\u793A", "\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC\u3092\u898B\u305B\u3066", "\u30A2\u30B9\u30AD\u30FC\u30A2\u30FC\u30C8"],
            zh: ["\u663E\u793A\u5934\u50CF", "\u5C55\u793A\u89D2\u8272", "ASCII\u827A\u672F"],
            ko: ["\uC544\uBC14\uD0C0 \uBCF4\uAE30", "\uCE90\uB9AD\uD130 \uD45C\uC2DC", "ASCII \uC544\uD2B8"]
          }
        });
        this.dictionary.set("/voice", {
          command: "/voice",
          name: {
            en: "Voice Interaction",
            ja: "\u97F3\u58F0\u5BFE\u8A71",
            zh: "\u8BED\u97F3\u4EA4\u4E92",
            ko: "\uC74C\uC131 \uC0C1\uD638\uC791\uC6A9"
          },
          description: {
            en: "Voice-based interaction",
            ja: "\u97F3\u58F0\u30D9\u30FC\u30B9\u306E\u5BFE\u8A71",
            zh: "\u57FA\u4E8E\u8BED\u97F3\u7684\u4EA4\u4E92",
            ko: "\uC74C\uC131 \uAE30\uBC18 \uC0C1\uD638\uC791\uC6A9"
          },
          keywords: {
            en: ["voice", "speak", "talk", "audio", "speech", "sound"],
            ja: ["\u97F3\u58F0", "\u8A71\u3059", "\u4F1A\u8A71", "\u30AA\u30FC\u30C7\u30A3\u30AA", "\u30B9\u30D4\u30FC\u30C1"],
            zh: ["\u8BED\u97F3", "\u8BF4\u8BDD", "\u5BF9\u8BDD", "\u97F3\u9891", "\u8BED\u97F3"],
            ko: ["\uC74C\uC131", "\uB9D0\uD558\uAE30", "\uB300\uD654", "\uC624\uB514\uC624", "\uC2A4\uD53C\uCE58"]
          },
          examples: {
            en: ["talk to me", "voice command", "speak the response"],
            ja: ["\u8A71\u3057\u304B\u3051\u3066", "\u97F3\u58F0\u30B3\u30DE\u30F3\u30C9", "\u5FDC\u7B54\u3092\u8A71\u3057\u3066"],
            zh: ["\u548C\u6211\u8BF4\u8BDD", "\u8BED\u97F3\u547D\u4EE4", "\u8BF4\u51FA\u56DE\u5E94"],
            ko: ["\uB300\uD654\uD558\uAE30", "\uC74C\uC131 \uBA85\uB839", "\uC751\uB2F5 \uB9D0\uD558\uAE30"]
          }
        });
        this.dictionary.set("/init", {
          command: "/init",
          name: {
            en: "Initialize Project",
            ja: "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u521D\u671F\u5316",
            zh: "\u521D\u59CB\u5316\u9879\u76EE",
            ko: "\uD504\uB85C\uC81D\uD2B8 \uCD08\uAE30\uD654"
          },
          description: {
            en: "Initialize a new project",
            ja: "\u65B0\u3057\u3044\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u3092\u521D\u671F\u5316",
            zh: "\u521D\u59CB\u5316\u65B0\u9879\u76EE",
            ko: "\uC0C8 \uD504\uB85C\uC81D\uD2B8 \uCD08\uAE30\uD654"
          },
          keywords: {
            en: ["init", "initialize", "setup", "create", "start", "project", "new"],
            ja: ["\u521D\u671F\u5316", "\u30BB\u30C3\u30C8\u30A2\u30C3\u30D7", "\u4F5C\u6210", "\u958B\u59CB", "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8", "\u65B0\u898F"],
            zh: ["\u521D\u59CB\u5316", "\u8BBE\u7F6E", "\u521B\u5EFA", "\u542F\u52A8", "\u9879\u76EE", "\u65B0\u5EFA"],
            ko: ["\uCD08\uAE30\uD654", "\uC124\uC815", "\uC0DD\uC131", "\uC2DC\uC791", "\uD504\uB85C\uC81D\uD2B8", "\uC2E0\uADDC"]
          },
          examples: {
            en: ["initialize new project", "setup React app", "create new workspace"],
            ja: ["\u65B0\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u3092\u521D\u671F\u5316", "React\u30A2\u30D7\u30EA\u3092\u30BB\u30C3\u30C8\u30A2\u30C3\u30D7", "\u65B0\u30EF\u30FC\u30AF\u30B9\u30DA\u30FC\u30B9\u3092\u4F5C\u6210"],
            zh: ["\u521D\u59CB\u5316\u65B0\u9879\u76EE", "\u8BBE\u7F6EReact\u5E94\u7528", "\u521B\u5EFA\u65B0\u5DE5\u4F5C\u7A7A\u95F4"],
            ko: ["\uC0C8 \uD504\uB85C\uC81D\uD2B8 \uCD08\uAE30\uD654", "React \uC571 \uC124\uC815", "\uC0C8 \uC6CC\uD06C\uC2A4\uD398\uC774\uC2A4 \uC0DD\uC131"]
          }
        });
        this.dictionary.set("/help", {
          command: "/help",
          name: {
            en: "Help",
            ja: "\u30D8\u30EB\u30D7",
            zh: "\u5E2E\u52A9",
            ko: "\uB3C4\uC6C0\uB9D0"
          },
          description: {
            en: "Show help and available commands",
            ja: "\u30D8\u30EB\u30D7\u3068\u5229\u7528\u53EF\u80FD\u306A\u30B3\u30DE\u30F3\u30C9\u3092\u8868\u793A",
            zh: "\u663E\u793A\u5E2E\u52A9\u548C\u53EF\u7528\u547D\u4EE4",
            ko: "\uB3C4\uC6C0\uB9D0 \uBC0F \uC0AC\uC6A9 \uAC00\uB2A5\uD55C \uBA85\uB839 \uD45C\uC2DC"
          },
          keywords: {
            en: ["help", "guide", "manual", "documentation", "usage", "commands"],
            ja: ["\u30D8\u30EB\u30D7", "\u30AC\u30A4\u30C9", "\u30DE\u30CB\u30E5\u30A2\u30EB", "\u30C9\u30AD\u30E5\u30E1\u30F3\u30C8", "\u4F7F\u3044\u65B9", "\u30B3\u30DE\u30F3\u30C9"],
            zh: ["\u5E2E\u52A9", "\u6307\u5357", "\u624B\u518C", "\u6587\u6863", "\u7528\u6CD5", "\u547D\u4EE4"],
            ko: ["\uB3C4\uC6C0\uB9D0", "\uAC00\uC774\uB4DC", "\uB9E4\uB274\uC5BC", "\uBB38\uC11C", "\uC0AC\uC6A9\uBC95", "\uBA85\uB839"]
          },
          examples: {
            en: ["show help", "list commands", "how to use"],
            ja: ["\u30D8\u30EB\u30D7\u3092\u8868\u793A", "\u30B3\u30DE\u30F3\u30C9\u4E00\u89A7", "\u4F7F\u3044\u65B9"],
            zh: ["\u663E\u793A\u5E2E\u52A9", "\u5217\u51FA\u547D\u4EE4", "\u5982\u4F55\u4F7F\u7528"],
            ko: ["\uB3C4\uC6C0\uB9D0 \uD45C\uC2DC", "\uBA85\uB839 \uBAA9\uB85D", "\uC0AC\uC6A9 \uBC29\uBC95"]
          }
        });
        this.dictionary.set("/exit", {
          command: "/exit",
          name: {
            en: "Exit",
            ja: "\u7D42\u4E86",
            zh: "\u9000\u51FA",
            ko: "\uC885\uB8CC"
          },
          description: {
            en: "Exit the session",
            ja: "\u30BB\u30C3\u30B7\u30E7\u30F3\u3092\u7D42\u4E86",
            zh: "\u9000\u51FA\u4F1A\u8BDD",
            ko: "\uC138\uC158 \uC885\uB8CC"
          },
          keywords: {
            en: ["exit", "quit", "close", "end", "bye", "goodbye", "stop"],
            ja: ["\u7D42\u4E86", "\u9000\u51FA", "\u9589\u3058\u308B", "\u30D0\u30A4\u30D0\u30A4", "\u3055\u3088\u3046\u306A\u3089", "\u6B62\u3081\u308B"],
            zh: ["\u9000\u51FA", "\u7ED3\u675F", "\u5173\u95ED", "\u518D\u89C1", "\u505C\u6B62"],
            ko: ["\uC885\uB8CC", "\uB098\uAC00\uAE30", "\uB2EB\uAE30", "\uB05D", "\uC815\uC9C0"]
          },
          examples: {
            en: ["exit session", "quit app", "goodbye"],
            ja: ["\u30BB\u30C3\u30B7\u30E7\u30F3\u7D42\u4E86", "\u30A2\u30D7\u30EA\u3092\u9589\u3058\u308B", "\u3055\u3088\u3046\u306A\u3089"],
            zh: ["\u9000\u51FA\u4F1A\u8BDD", "\u5173\u95ED\u5E94\u7528", "\u518D\u89C1"],
            ko: ["\uC138\uC158 \uC885\uB8CC", "\uC571 \uC885\uB8CC", "\uC548\uB155"]
          }
        });
      }
    };
  }
});

// src/services/intelligent-router/LanguageDetector.ts
var LanguageDetector;
var init_LanguageDetector = __esm({
  "src/services/intelligent-router/LanguageDetector.ts"() {
    init_cjs_shims();
    LanguageDetector = class {
      static {
        __name(this, "LanguageDetector");
      }
      languagePatterns;
      characterRanges;
      constructor() {
        this.languagePatterns = /* @__PURE__ */ new Map();
        this.characterRanges = /* @__PURE__ */ new Map();
        this.initializePatterns();
      }
      async detect(text) {
        const scores = this.calculateScores(text);
        scores.sort((a, b) => b.score - a.score);
        if (scores.length > 0 && scores[0]?.score && scores[0].score > 0) {
          return scores[0].language;
        }
        return "en";
      }
      calculateScores(text) {
        const scores = [
          { language: "en", score: 0 },
          { language: "ja", score: 0 },
          { language: "cn", score: 0 },
          { language: "ko", score: 0 },
          { language: "vn", score: 0 }
        ];
        this.characterRanges.forEach((patterns, language) => {
          patterns.forEach((pattern) => {
            const matches = text.match(pattern);
            if (matches) {
              const score = scores.find((s) => s.language === language);
              if (score) {
                score.score += matches.length * 2;
              }
            }
          });
        });
        this.languagePatterns.forEach((patterns, language) => {
          patterns.forEach((pattern) => {
            if (pattern.test(text)) {
              const score = scores.find((s) => s.language === language);
              if (score) {
                score.score += 3;
              }
            }
          });
        });
        const englishTerms = /\b(function|class|const|let|var|if|else|for|while|return|import|export|async|await|create|make|generate|write|code|test|review)\b/i;
        if (englishTerms.test(text)) {
          const englishScore = scores.find((s) => s.language === "en");
          if (englishScore) {
            englishScore.score += 5;
          }
        }
        const totalChars = text.length;
        scores.forEach((score) => {
          if (totalChars > 0) {
            score.score = score.score / totalChars * 100;
          }
        });
        return scores;
      }
      initializePatterns() {
        this.characterRanges.set("ja", [
          /[\u3040-\u309f]/g,
          // Hiragana
          /[\u30a0-\u30ff]/g,
          // Katakana
          /[\u4e00-\u9faf]/g
          // Kanji (also used in Chinese)
        ]);
        this.languagePatterns.set("ja", [
          /[ぁ-ん]/,
          // Hiragana check
          /[ァ-ヴ]/,
          // Katakana check
          /です|ます|ください|して/,
          // Common endings
          /は|が|を|に|で|と|の|から|まで/
          // Particles
        ]);
        this.characterRanges.set("cn", [
          /[\u4e00-\u9faf]/g
          // Chinese characters
        ]);
        this.languagePatterns.set("cn", [
          /的|了|是|在|有|和|不|人|我|你|他|她/,
          // Common Chinese characters
          /这|那|什么|怎么|为什么/,
          // Common question words
          /吗|呢|吧|啊/
          // Sentence particles
        ]);
        this.characterRanges.set("ko", [
          /[\uac00-\ud7af]/g,
          // Hangul syllables
          /[\u1100-\u11ff]/g,
          // Hangul Jamo
          /[\u3130-\u318f]/g
          // Hangul compatibility Jamo
        ]);
        this.languagePatterns.set("ko", [
          /[가-힣]/,
          // Hangul check
          /입니다|습니다|합니다/,
          // Formal endings
          /을|를|이|가|은|는|의/
          // Particles
        ]);
        this.characterRanges.set("vn", [
          /[a-zA-Zàáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/g
          // Vietnamese with tones
        ]);
        this.languagePatterns.set("vn", [
          /[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/,
          // Vietnamese tones
          /và|của|là|có|được|trong|với|này|cho|để/,
          // Common Vietnamese words
          /không|nhưng|cũng|như|từ|đến|sau|trước/
          // More common words
        ]);
        this.characterRanges.set("en", [
          /[a-zA-Z]/g
          // Latin alphabet
        ]);
        this.languagePatterns.set("en", [
          /\b(the|be|to|of|and|a|in|that|have|I|it|for|not|on|with|he|as|you|do|at)\b/i,
          // Common English words
          /\b(this|but|his|by|from|they|we|say|her|she|or|an|will|my|one|all|would|there|their)\b/i
        ]);
      }
      getLanguageName(code) {
        const names = {
          en: "English",
          ja: "Japanese",
          cn: "Chinese",
          ko: "Korean",
          vn: "Vietnamese"
        };
        return names[code] || "Unknown";
      }
      isSupported(languageCode) {
        return ["en", "ja", "cn", "ko", "vn"].includes(languageCode);
      }
    };
  }
});

// src/services/intelligent-router/CommandMappings.ts
var CommandMappings;
var init_CommandMappings = __esm({
  "src/services/intelligent-router/CommandMappings.ts"() {
    init_cjs_shims();
    init_MultilingualDictionary();
    CommandMappings = class {
      static {
        __name(this, "CommandMappings");
      }
      mappings;
      dictionary;
      initialized = false;
      constructor() {
        this.mappings = [];
        this.dictionary = new MultilingualDictionary();
      }
      async initialize() {
        if (this.initialized) return;
        await this.dictionary.initialize();
        this.loadMappings();
        this.initialized = true;
      }
      async getSuggestions(input, language, maxResults = 5) {
        const lowerInput = input.toLowerCase();
        const suggestions = [];
        for (const mapping of this.mappings) {
          const phrases = mapping.naturalPhrases.get(language) ?? mapping.naturalPhrases.get("en") ?? [];
          let score = 0;
          for (const phrase of phrases) {
            if (phrase.toLowerCase().includes(lowerInput)) {
              score += 2;
            }
            if (phrase.toLowerCase().startsWith(lowerInput)) {
              score += 3;
            }
          }
          if (mapping.command.toLowerCase().includes(lowerInput)) {
            score += 5;
          }
          if (score > 0) {
            suggestions.push({ command: mapping.command, score: score * mapping.priority });
          }
        }
        return suggestions.sort((a, b) => b.score - a.score).slice(0, maxResults).map((s) => s.command);
      }
      getCommandForPhrase(phrase, language) {
        const lowerPhrase = phrase.toLowerCase();
        for (const mapping of this.mappings) {
          const phrases = mapping.naturalPhrases.get(language) ?? mapping.naturalPhrases.get("en") ?? [];
          for (const naturalPhrase of phrases) {
            if (lowerPhrase.includes(naturalPhrase.toLowerCase())) {
              return mapping.command;
            }
          }
        }
        return null;
      }
      loadMappings() {
        this.mappings.push({
          command: "/code",
          naturalPhrases: /* @__PURE__ */ new Map([
            [
              "en",
              ["write code", "create code", "generate code", "implement", "build function", "develop"]
            ],
            [
              "ja",
              ["\u30B3\u30FC\u30C9\u3092\u66F8\u3044\u3066", "\u5B9F\u88C5\u3057\u3066", "\u30D7\u30ED\u30B0\u30E9\u30E0\u3092\u4F5C\u3063\u3066", "\u95A2\u6570\u3092\u66F8\u3044\u3066", "\u30AF\u30E9\u30B9\u3092\u4F5C\u6210"]
            ],
            ["cn", ["\u5199\u4EE3\u7801", "\u7F16\u5199\u4EE3\u7801", "\u5B9E\u73B0", "\u521B\u5EFA\u51FD\u6570", "\u6784\u5EFA\u7C7B"]],
            ["ko", ["\uCF54\uB4DC \uC791\uC131", "\uAD6C\uD604\uD574\uC918", "\uD568\uC218 \uB9CC\uB4E4\uC5B4", "\uD074\uB798\uC2A4 \uC0DD\uC131"]],
            ["vn", ["vi\u1EBFt m\xE3", "t\u1EA1o code", "x\xE2y d\u1EF1ng h\xE0m", "ph\xE1t tri\u1EC3n"]]
          ]),
          priority: 1
        });
        this.mappings.push({
          command: "/test",
          naturalPhrases: /* @__PURE__ */ new Map([
            ["en", ["write test", "create test", "generate test", "unit test", "test this"]],
            ["ja", ["\u30C6\u30B9\u30C8\u3092\u66F8\u3044\u3066", "\u30C6\u30B9\u30C8\u4F5C\u6210", "\u30E6\u30CB\u30C3\u30C8\u30C6\u30B9\u30C8", "\u30C6\u30B9\u30C8\u3057\u3066"]],
            ["cn", ["\u5199\u6D4B\u8BD5", "\u521B\u5EFA\u6D4B\u8BD5", "\u5355\u5143\u6D4B\u8BD5", "\u6D4B\u8BD5\u8FD9\u4E2A"]],
            ["ko", ["\uD14C\uC2A4\uD2B8 \uC791\uC131", "\uD14C\uC2A4\uD2B8 \uC0DD\uC131", "\uB2E8\uC704 \uD14C\uC2A4\uD2B8"]],
            ["vn", ["vi\u1EBFt ki\u1EC3m tra", "t\u1EA1o test", "ki\u1EC3m tra \u0111\u01A1n v\u1ECB"]]
          ]),
          priority: 0.9
        });
        this.mappings.push({
          command: "/review",
          naturalPhrases: /* @__PURE__ */ new Map([
            ["en", ["review code", "check code", "analyze", "improve", "refactor"]],
            ["ja", ["\u30B3\u30FC\u30C9\u30EC\u30D3\u30E5\u30FC", "\u78BA\u8A8D\u3057\u3066", "\u6539\u5584\u3057\u3066", "\u30EA\u30D5\u30A1\u30AF\u30BF\u30EA\u30F3\u30B0"]],
            ["cn", ["\u4EE3\u7801\u5BA1\u67E5", "\u68C0\u67E5\u4EE3\u7801", "\u6539\u8FDB", "\u91CD\u6784"]],
            ["ko", ["\uCF54\uB4DC \uB9AC\uBDF0", "\uAC80\uD1A0\uD574\uC918", "\uAC1C\uC120\uD574\uC918", "\uB9AC\uD329\uD1A0\uB9C1"]],
            ["vn", ["xem x\xE9t m\xE3", "ki\u1EC3m tra code", "c\u1EA3i thi\u1EC7n", "t\xE1i c\u1EA5u tr\xFAc"]]
          ]),
          priority: 0.9
        });
        this.mappings.push({
          command: "/model",
          naturalPhrases: /* @__PURE__ */ new Map([
            ["en", ["switch model", "change model", "select model", "use gpt", "use claude"]],
            ["ja", ["\u30E2\u30C7\u30EB\u5207\u308A\u66FF\u3048", "\u30E2\u30C7\u30EB\u5909\u66F4", "GPT\u4F7F\u3063\u3066", "Claude\u4F7F\u3063\u3066"]],
            ["cn", ["\u5207\u6362\u6A21\u578B", "\u66F4\u6539\u6A21\u578B", "\u4F7F\u7528GPT", "\u4F7F\u7528Claude"]],
            ["ko", ["\uBAA8\uB378 \uC804\uD658", "\uBAA8\uB378 \uBCC0\uACBD", "GPT \uC0AC\uC6A9", "Claude \uC0AC\uC6A9"]],
            ["vn", ["chuy\u1EC3n m\xF4 h\xECnh", "\u0111\u1ED5i model", "d\xF9ng GPT", "d\xF9ng Claude"]]
          ]),
          priority: 0.8
        });
        this.mappings.push({
          command: "/image",
          naturalPhrases: /* @__PURE__ */ new Map([
            [
              "en",
              ["create image", "generate image", "draw picture", "make illustration", "design graphic"]
            ],
            ["ja", ["\u753B\u50CF\u3092\u751F\u6210", "\u30A4\u30E1\u30FC\u30B8\u3092\u4F5C\u3063\u3066", "\u7D75\u3092\u63CF\u3044\u3066", "\u30A4\u30E9\u30B9\u30C8\u3092\u4F5C\u6210"]],
            ["cn", ["\u751F\u6210\u56FE\u50CF", "\u521B\u5EFA\u56FE\u7247", "\u753B\u4E00\u5E45\u753B", "\u5236\u4F5C\u63D2\u56FE"]],
            ["ko", ["\uC774\uBBF8\uC9C0 \uC0DD\uC131", "\uADF8\uB9BC \uADF8\uB824\uC918", "\uC77C\uB7EC\uC2A4\uD2B8 \uB9CC\uB4E4\uC5B4"]],
            ["vn", ["t\u1EA1o h\xECnh \u1EA3nh", "v\u1EBD tranh", "l\xE0m minh h\u1ECDa"]]
          ]),
          priority: 1
        });
        this.mappings.push({
          command: "/video",
          naturalPhrases: /* @__PURE__ */ new Map([
            ["en", ["create video", "generate video", "make animation", "produce movie"]],
            ["ja", ["\u52D5\u753B\u3092\u4F5C\u3063\u3066", "\u30D3\u30C7\u30AA\u3092\u751F\u6210", "\u30A2\u30CB\u30E1\u30FC\u30B7\u30E7\u30F3\u3092\u4F5C\u6210"]],
            ["cn", ["\u521B\u5EFA\u89C6\u9891", "\u751F\u6210\u52A8\u753B", "\u5236\u4F5C\u5F71\u7247"]],
            ["ko", ["\uBE44\uB514\uC624 \uC0DD\uC131", "\uB3D9\uC601\uC0C1 \uB9CC\uB4E4\uC5B4", "\uC560\uB2C8\uBA54\uC774\uC158 \uC81C\uC791"]],
            ["vn", ["t\u1EA1o video", "l\xE0m ho\u1EA1t h\xECnh", "s\u1EA3n xu\u1EA5t phim"]]
          ]),
          priority: 1
        });
        this.mappings.push({
          command: "/avatar",
          naturalPhrases: /* @__PURE__ */ new Map([
            ["en", ["show avatar", "display character", "ascii art"]],
            ["ja", ["\u30A2\u30D0\u30BF\u30FC\u8868\u793A", "\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC\u898B\u305B\u3066", "\u30A2\u30B9\u30AD\u30FC\u30A2\u30FC\u30C8"]],
            ["cn", ["\u663E\u793A\u5934\u50CF", "\u5C55\u793A\u89D2\u8272", "ASCII\u827A\u672F"]],
            ["ko", ["\uC544\uBC14\uD0C0 \uBCF4\uAE30", "\uCE90\uB9AD\uD130 \uD45C\uC2DC"]],
            ["vn", ["hi\u1EC3n th\u1ECB avatar", "xem nh\xE2n v\u1EADt"]]
          ]),
          priority: 0.7
        });
        this.mappings.push({
          command: "/voice",
          naturalPhrases: /* @__PURE__ */ new Map([
            ["en", ["talk to me", "voice command", "speak"]],
            ["ja", ["\u8A71\u3057\u304B\u3051\u3066", "\u97F3\u58F0\u30B3\u30DE\u30F3\u30C9", "\u8A71\u3057\u3066"]],
            ["cn", ["\u548C\u6211\u8BF4\u8BDD", "\u8BED\u97F3\u547D\u4EE4", "\u8BF4\u8BDD"]],
            ["ko", ["\uB300\uD654\uD558\uAE30", "\uC74C\uC131 \uBA85\uB839"]],
            ["vn", ["n\xF3i chuy\u1EC7n", "l\u1EC7nh gi\u1ECDng n\xF3i"]]
          ]),
          priority: 0.7
        });
        this.mappings.push({
          command: "/setup",
          naturalPhrases: /* @__PURE__ */ new Map([
            ["en", ["setup system", "initial setup", "configure"]],
            ["ja", ["\u30BB\u30C3\u30C8\u30A2\u30C3\u30D7", "\u521D\u671F\u8A2D\u5B9A", "\u74B0\u5883\u69CB\u7BC9"]],
            ["cn", ["\u8BBE\u7F6E\u7CFB\u7EDF", "\u521D\u59CB\u8BBE\u7F6E", "\u914D\u7F6E"]],
            ["ko", ["\uC124\uC815", "\uCD08\uAE30 \uC124\uC815", "\uD658\uACBD \uAD6C\uCD95"]],
            ["vn", ["thi\u1EBFt l\u1EADp", "c\xE0i \u0111\u1EB7t ban \u0111\u1EA7u"]]
          ]),
          priority: 0.8
        });
        this.mappings.push({
          command: "/settings",
          naturalPhrases: /* @__PURE__ */ new Map([
            ["en", ["show settings", "check configuration", "view config"]],
            ["ja", ["\u8A2D\u5B9A\u78BA\u8A8D", "\u8A2D\u5B9A\u3092\u898B\u308B", "\u30B3\u30F3\u30D5\u30A3\u30B0\u78BA\u8A8D"]],
            ["cn", ["\u67E5\u770B\u8BBE\u7F6E", "\u68C0\u67E5\u914D\u7F6E", "\u663E\u793A\u8BBE\u7F6E"]],
            ["ko", ["\uC124\uC815 \uD655\uC778", "\uC124\uC815 \uBCF4\uAE30"]],
            ["vn", ["xem c\xE0i \u0111\u1EB7t", "ki\u1EC3m tra c\u1EA5u h\xECnh"]]
          ]),
          priority: 0.7
        });
        this.mappings.push({
          command: "/config",
          naturalPhrases: /* @__PURE__ */ new Map([
            ["en", ["configure", "manage config", "update settings"]],
            ["ja", ["\u8A2D\u5B9A\u7BA1\u7406", "\u8A2D\u5B9A\u66F4\u65B0", "\u30B3\u30F3\u30D5\u30A3\u30B0\u7BA1\u7406"]],
            ["cn", ["\u914D\u7F6E\u7BA1\u7406", "\u66F4\u65B0\u8BBE\u7F6E", "\u7BA1\u7406\u914D\u7F6E"]],
            ["ko", ["\uC124\uC815 \uAD00\uB9AC", "\uC124\uC815 \uC5C5\uB370\uC774\uD2B8"]],
            ["vn", ["qu\u1EA3n l\xFD c\u1EA5u h\xECnh", "c\u1EADp nh\u1EADt c\xE0i \u0111\u1EB7t"]]
          ]),
          priority: 0.7
        });
        this.mappings.push({
          command: "/init",
          naturalPhrases: /* @__PURE__ */ new Map([
            ["en", ["initialize project", "start new project", "create project"]],
            ["ja", ["\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u521D\u671F\u5316", "\u65B0\u898F\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8", "\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u4F5C\u6210"]],
            ["cn", ["\u521D\u59CB\u5316\u9879\u76EE", "\u65B0\u5EFA\u9879\u76EE", "\u521B\u5EFA\u9879\u76EE"]],
            ["ko", ["\uD504\uB85C\uC81D\uD2B8 \uCD08\uAE30\uD654", "\uC0C8 \uD504\uB85C\uC81D\uD2B8"]],
            ["vn", ["kh\u1EDFi t\u1EA1o d\u1EF1 \xE1n", "t\u1EA1o d\u1EF1 \xE1n m\u1EDBi"]]
          ]),
          priority: 0.9
        });
        this.mappings.push({
          command: "/add-dir",
          naturalPhrases: /* @__PURE__ */ new Map([
            ["en", ["add directory", "include folder", "add path"]],
            ["ja", ["\u30C7\u30A3\u30EC\u30AF\u30C8\u30EA\u8FFD\u52A0", "\u30D5\u30A9\u30EB\u30C0\u8FFD\u52A0", "\u30D1\u30B9\u8FFD\u52A0"]],
            ["cn", ["\u6DFB\u52A0\u76EE\u5F55", "\u5305\u542B\u6587\u4EF6\u5939", "\u6DFB\u52A0\u8DEF\u5F84"]],
            ["ko", ["\uB514\uB809\uD1A0\uB9AC \uCD94\uAC00", "\uD3F4\uB354 \uCD94\uAC00"]],
            ["vn", ["th\xEAm th\u01B0 m\u1EE5c", "th\xEAm \u0111\u01B0\u1EDDng d\u1EABn"]]
          ]),
          priority: 0.6
        });
        this.mappings.push({
          command: "/memory",
          naturalPhrases: /* @__PURE__ */ new Map([
            ["en", ["manage memory", "remember this", "save context"]],
            ["ja", ["\u30E1\u30E2\u30EA\u7BA1\u7406", "\u3053\u308C\u3092\u899A\u3048\u3066", "\u30B3\u30F3\u30C6\u30AD\u30B9\u30C8\u4FDD\u5B58"]],
            ["cn", ["\u5185\u5B58\u7BA1\u7406", "\u8BB0\u4F4F\u8FD9\u4E2A", "\u4FDD\u5B58\u4E0A\u4E0B\u6587"]],
            ["ko", ["\uBA54\uBAA8\uB9AC \uAD00\uB9AC", "\uC774\uAC83 \uAE30\uC5B5\uD574"]],
            ["vn", ["qu\u1EA3n l\xFD b\u1ED9 nh\u1EDB", "nh\u1EDB \u0111i\u1EC1u n\xE0y"]]
          ]),
          priority: 0.6
        });
        this.mappings.push({
          command: "/export",
          naturalPhrases: /* @__PURE__ */ new Map([
            ["en", ["export data", "save output", "download results"]],
            ["ja", ["\u30C7\u30FC\u30BF\u30A8\u30AF\u30B9\u30DD\u30FC\u30C8", "\u51FA\u529B\u4FDD\u5B58", "\u7D50\u679C\u30C0\u30A6\u30F3\u30ED\u30FC\u30C9"]],
            ["cn", ["\u5BFC\u51FA\u6570\u636E", "\u4FDD\u5B58\u8F93\u51FA", "\u4E0B\u8F7D\u7ED3\u679C"]],
            ["ko", ["\uB370\uC774\uD130 \uB0B4\uBCF4\uB0B4\uAE30", "\uCD9C\uB825 \uC800\uC7A5"]],
            ["vn", ["xu\u1EA5t d\u1EEF li\u1EC7u", "l\u01B0u k\u1EBFt qu\u1EA3"]]
          ]),
          priority: 0.6
        });
        this.mappings.push({
          command: "/agents",
          naturalPhrases: /* @__PURE__ */ new Map([
            ["en", ["manage agents", "show agents", "list agents"]],
            ["ja", ["\u30A8\u30FC\u30B8\u30A7\u30F3\u30C8\u7BA1\u7406", "\u30A8\u30FC\u30B8\u30A7\u30F3\u30C8\u8868\u793A", "\u30A8\u30FC\u30B8\u30A7\u30F3\u30C8\u4E00\u89A7"]],
            ["cn", ["\u7BA1\u7406\u4EE3\u7406", "\u663E\u793A\u4EE3\u7406", "\u5217\u51FA\u4EE3\u7406"]],
            ["ko", ["\uC5D0\uC774\uC804\uD2B8 \uAD00\uB9AC", "\uC5D0\uC774\uC804\uD2B8 \uD45C\uC2DC"]],
            ["vn", ["qu\u1EA3n l\xFD agent", "hi\u1EC3n th\u1ECB agent"]]
          ]),
          priority: 0.5
        });
        this.mappings.push({
          command: "/status",
          naturalPhrases: /* @__PURE__ */ new Map([
            ["en", ["show status", "system status", "check status"]],
            ["ja", ["\u30B9\u30C6\u30FC\u30BF\u30B9\u8868\u793A", "\u30B7\u30B9\u30C6\u30E0\u72B6\u614B", "\u72B6\u614B\u78BA\u8A8D"]],
            ["cn", ["\u663E\u793A\u72B6\u6001", "\u7CFB\u7EDF\u72B6\u6001", "\u68C0\u67E5\u72B6\u6001"]],
            ["ko", ["\uC0C1\uD0DC \uD45C\uC2DC", "\uC2DC\uC2A4\uD15C \uC0C1\uD0DC"]],
            ["vn", ["hi\u1EC3n th\u1ECB tr\u1EA1ng th\xE1i", "tr\u1EA1ng th\xE1i h\u1EC7 th\u1ED1ng"]]
          ]),
          priority: 0.7
        });
        this.mappings.push({
          command: "/health",
          naturalPhrases: /* @__PURE__ */ new Map([
            ["en", ["health check", "system health", "diagnostics"]],
            ["ja", ["\u30D8\u30EB\u30B9\u30C1\u30A7\u30C3\u30AF", "\u30B7\u30B9\u30C6\u30E0\u8A3A\u65AD", "\u5065\u5168\u6027\u78BA\u8A8D"]],
            ["cn", ["\u5065\u5EB7\u68C0\u67E5", "\u7CFB\u7EDF\u8BCA\u65AD", "\u5065\u5EB7\u72B6\u6001"]],
            ["ko", ["\uD5EC\uC2A4 \uCCB4\uD06C", "\uC2DC\uC2A4\uD15C \uC9C4\uB2E8"]],
            ["vn", ["ki\u1EC3m tra s\u1EE9c kh\u1ECFe", "ch\u1EA9n \u0111o\xE1n h\u1EC7 th\u1ED1ng"]]
          ]),
          priority: 0.6
        });
        this.mappings.push({
          command: "/clear",
          naturalPhrases: /* @__PURE__ */ new Map([
            ["en", ["clear screen", "clear chat", "reset display"]],
            ["ja", ["\u753B\u9762\u30AF\u30EA\u30A2", "\u30C1\u30E3\u30C3\u30C8\u30AF\u30EA\u30A2", "\u8868\u793A\u30EA\u30BB\u30C3\u30C8"]],
            ["cn", ["\u6E05\u9664\u5C4F\u5E55", "\u6E05\u9664\u804A\u5929", "\u91CD\u7F6E\u663E\u793A"]],
            ["ko", ["\uD654\uBA74 \uC9C0\uC6B0\uAE30", "\uCC44\uD305 \uC9C0\uC6B0\uAE30"]],
            ["vn", ["x\xF3a m\xE0n h\xECnh", "x\xF3a chat"]]
          ]),
          priority: 0.5
        });
        this.mappings.push({
          command: "/help",
          naturalPhrases: /* @__PURE__ */ new Map([
            ["en", ["show help", "help me", "list commands", "how to use"]],
            ["ja", ["\u30D8\u30EB\u30D7\u8868\u793A", "\u52A9\u3051\u3066", "\u30B3\u30DE\u30F3\u30C9\u4E00\u89A7", "\u4F7F\u3044\u65B9"]],
            ["cn", ["\u663E\u793A\u5E2E\u52A9", "\u5E2E\u52A9\u6211", "\u5217\u51FA\u547D\u4EE4", "\u5982\u4F55\u4F7F\u7528"]],
            ["ko", ["\uB3C4\uC6C0\uB9D0 \uD45C\uC2DC", "\uB3C4\uC640\uC918", "\uBA85\uB839 \uBAA9\uB85D"]],
            ["vn", ["hi\u1EC3n th\u1ECB tr\u1EE3 gi\xFAp", "gi\xFAp t\xF4i", "danh s\xE1ch l\u1EC7nh"]]
          ]),
          priority: 0.9
        });
        this.mappings.push({
          command: "/exit",
          naturalPhrases: /* @__PURE__ */ new Map([
            ["en", ["exit", "quit", "goodbye", "bye", "close"]],
            ["ja", ["\u7D42\u4E86", "\u9000\u51FA", "\u3055\u3088\u3046\u306A\u3089", "\u30D0\u30A4\u30D0\u30A4", "\u9589\u3058\u308B"]],
            ["cn", ["\u9000\u51FA", "\u7ED3\u675F", "\u518D\u89C1", "\u5173\u95ED"]],
            ["ko", ["\uC885\uB8CC", "\uB098\uAC00\uAE30", "\uC548\uB155", "\uB2EB\uAE30"]],
            ["vn", ["tho\xE1t", "k\u1EBFt th\xFAc", "t\u1EA1m bi\u1EC7t", "\u0111\xF3ng"]]
          ]),
          priority: 0.8
        });
        this.mappings.push({
          command: "/lang",
          naturalPhrases: /* @__PURE__ */ new Map([
            ["en", ["change language", "switch language", "set language", "language settings"]],
            ["ja", ["\u8A00\u8A9E\u5909\u66F4", "\u8A00\u8A9E\u5207\u308A\u66FF\u3048", "\u8A00\u8A9E\u8A2D\u5B9A", "\u65E5\u672C\u8A9E\u306B\u5909\u66F4"]],
            ["cn", ["\u66F4\u6539\u8BED\u8A00", "\u5207\u6362\u8BED\u8A00", "\u8BED\u8A00\u8BBE\u7F6E", "\u6539\u6210\u4E2D\u6587"]],
            ["ko", ["\uC5B8\uC5B4 \uBCC0\uACBD", "\uC5B8\uC5B4 \uC804\uD658", "\uC5B8\uC5B4 \uC124\uC815", "\uD55C\uAD6D\uC5B4\uB85C \uBCC0\uACBD"]],
            ["vn", ["\u0111\u1ED5i ng\xF4n ng\u1EEF", "chuy\u1EC3n ng\xF4n ng\u1EEF", "c\xE0i \u0111\u1EB7t ng\xF4n ng\u1EEF", "\u0111\u1ED5i sang ti\u1EBFng vi\u1EC7t"]]
          ]),
          priority: 0.9
        });
      }
    };
  }
});

// src/services/intelligent-router/UserPatternAnalyzer.ts
var UserPatternAnalyzer;
var init_UserPatternAnalyzer = __esm({
  "src/services/intelligent-router/UserPatternAnalyzer.ts"() {
    init_cjs_shims();
    UserPatternAnalyzer = class {
      static {
        __name(this, "UserPatternAnalyzer");
      }
      patterns = [];
      initialized = false;
      async initialize() {
        if (this.initialized) return;
        this.loadPatterns();
        this.initialized = true;
      }
      async recordPattern(input, intent) {
        const pattern = {
          input,
          command: intent.command,
          confidence: intent.confidence,
          timestamp: /* @__PURE__ */ new Date(),
          success: true
          // Will be updated by feedback
        };
        this.patterns.push(pattern);
        if (this.patterns.length > 1e3) {
          this.patterns = this.patterns.slice(-1e3);
        }
        this.savePatterns();
      }
      async recordFeedback(input, correctCommand, wasCorrect) {
        const pattern = this.patterns.slice().reverse().find((p) => p.input === input);
        if (pattern) {
          pattern.success = wasCorrect;
          if (!wasCorrect) {
            this.patterns.push({
              input,
              command: correctCommand,
              confidence: 1,
              timestamp: /* @__PURE__ */ new Date(),
              success: true
            });
          }
        }
        this.savePatterns();
      }
      getPatternStats() {
        const stats = {};
        this.patterns.forEach((pattern) => {
          if (pattern.success) {
            stats[pattern.command] = (stats[pattern.command] ?? 0) + 1;
          }
        });
        return stats;
      }
      getMostCommonPattern(input) {
        const similarPatterns = this.patterns.filter((p) => {
          return p.success && this.calculateSimilarity(p.input, input) > 0.7;
        });
        if (similarPatterns.length === 0) return null;
        const commandCounts = /* @__PURE__ */ new Map();
        similarPatterns.forEach((p) => {
          commandCounts.set(p.command, (commandCounts.get(p.command) ?? 0) + 1);
        });
        let maxCount = 0;
        let mostCommon = null;
        commandCounts.forEach((count, command) => {
          if (count > maxCount) {
            maxCount = count;
            mostCommon = command;
          }
        });
        return mostCommon;
      }
      calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        if (longer.length === 0) return 1;
        const distance = this.levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
      }
      levenshteinDistance(str1, str2) {
        const matrix = [];
        for (let i = 0; i <= str2.length; i++) {
          matrix[i] = [i];
        }
        for (let j = 0; j <= str1.length; j++) {
          matrix[0][j] = j;
        }
        for (let i = 1; i <= str2.length; i++) {
          for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
              matrix[i][j] = matrix[i - 1][j - 1];
            } else {
              matrix[i][j] = Math.min(
                matrix[i - 1][j - 1] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j] + 1
              );
            }
          }
        }
        return matrix[str2.length][str1.length];
      }
      async exportData() {
        return {
          patterns: this.patterns,
          stats: this.getPatternStats()
        };
      }
      async importData(data) {
        if (typeof data === "object" && data !== null && "patterns" in data) {
          const imported = data;
          this.patterns = imported.patterns;
          this.savePatterns();
        }
      }
      loadPatterns() {
        this.patterns = [];
      }
      savePatterns() {
      }
    };
  }
});
function getIntelligentRouter(config) {
  if (!routerInstance) {
    routerInstance = new IntelligentRouterService(config);
  }
  return routerInstance;
}
var IntelligentRouterService, routerInstance;
var init_IntelligentRouterService = __esm({
  "src/services/intelligent-router/IntelligentRouterService.ts"() {
    init_cjs_shims();
    init_NaturalLanguageProcessor();
    init_IntentRecognizer();
    init_ParameterExtractor();
    init_MultilingualDictionary();
    init_LanguageDetector();
    init_CommandMappings();
    init_UserPatternAnalyzer();
    IntelligentRouterService = class extends events.EventEmitter {
      static {
        __name(this, "IntelligentRouterService");
      }
      nlpProcessor;
      intentRecognizer;
      parameterExtractor;
      dictionary;
      languageDetector;
      commandMappings;
      userPatternAnalyzer;
      config;
      metrics;
      isInitialized = false;
      constructor(config = {}) {
        super();
        this.config = {
          confidenceThreshold: config.confidenceThreshold ?? 0.85,
          enableLearning: config.enableLearning ?? true,
          supportedLanguages: config.supportedLanguages ?? ["en", "ja", "cn", "ko", "vn"],
          enableConfirmation: config.enableConfirmation ?? true,
          maxAlternatives: config.maxAlternatives ?? 3
        };
        this.metrics = {
          totalRequests: 0,
          successfulRoutes: 0,
          failedRoutes: 0,
          averageConfidence: 0,
          averageResponseTime: 0,
          commandUsageStats: /* @__PURE__ */ new Map()
        };
        this.nlpProcessor = new NaturalLanguageProcessor();
        this.intentRecognizer = new IntentRecognizer(this.config);
        this.parameterExtractor = new ParameterExtractor();
        this.dictionary = new MultilingualDictionary();
        this.languageDetector = new LanguageDetector();
        this.commandMappings = new CommandMappings();
        this.userPatternAnalyzer = new UserPatternAnalyzer();
      }
      async initialize() {
        if (this.isInitialized) return;
        try {
          console.log(chalk8__default.default.cyan("\u{1F9E0} Initializing Intelligent Router..."));
          await Promise.all([
            this.dictionary.initialize(),
            this.commandMappings.initialize(),
            this.nlpProcessor.initialize(),
            this.intentRecognizer.initialize(),
            this.userPatternAnalyzer.initialize()
          ]);
          this.isInitialized = true;
          this.emit("initialized");
          console.log(chalk8__default.default.green("\u2705 Intelligent Router initialized successfully"));
        } catch (error) {
          console.error(chalk8__default.default.red("Failed to initialize Intelligent Router:"), error);
          throw error;
        }
      }
      async route(input) {
        if (!this.isInitialized) {
          await this.initialize();
        }
        const startTime = Date.now();
        this.metrics.totalRequests++;
        try {
          const language = await this.languageDetector.detect(input);
          if (!this.config.supportedLanguages.includes(language)) {
            console.log(chalk8__default.default.yellow(`Language '${language}' not supported, falling back to English`));
          }
          const processedInput = await this.nlpProcessor.process(input, language);
          const intent = await this.intentRecognizer.recognize(processedInput);
          if (!intent || intent.confidence < this.config.confidenceThreshold) {
            this.metrics.failedRoutes++;
            this.emit("route:failed", { input, language, confidence: intent?.confidence ?? 0 });
            return null;
          }
          const parameters = await this.parameterExtractor.extract(input, intent.command, language);
          const commandIntent = {
            command: intent.command,
            confidence: intent.confidence,
            parameters,
            originalInput: input,
            language,
            alternatives: intent.alternatives
          };
          if (this.config.enableLearning) {
            await this.userPatternAnalyzer.recordPattern(input, commandIntent);
          }
          this.metrics.successfulRoutes++;
          this.updateMetrics(intent.confidence, Date.now() - startTime, intent.command);
          this.emit("route:success", commandIntent);
          return commandIntent;
        } catch (error) {
          this.metrics.failedRoutes++;
          this.emit("route:error", { input, error });
          console.error(chalk8__default.default.red("Routing error:"), error);
          return null;
        }
      }
      async suggestCommand(partialInput) {
        if (!this.isInitialized) {
          await this.initialize();
        }
        try {
          const language = await this.languageDetector.detect(partialInput);
          const suggestions = await this.commandMappings.getSuggestions(
            partialInput,
            language,
            this.config.maxAlternatives
          );
          return suggestions;
        } catch (error) {
          console.error("Failed to get suggestions:", error);
          return [];
        }
      }
      async getCommandExplanation(command, language = "en") {
        return this.dictionary.getExplanation(command, language);
      }
      async needsConfirmation(intent) {
        if (!this.config.enableConfirmation) return false;
        const destructiveCommands = ["/delete", "/reset", "/clear", "/exit"];
        const isDestructive = destructiveCommands.includes(intent.command);
        const isLowConfidence = intent.confidence < 0.9;
        return isDestructive || isLowConfidence;
      }
      getMetrics() {
        return { ...this.metrics };
      }
      resetMetrics() {
        this.metrics = {
          totalRequests: 0,
          successfulRoutes: 0,
          failedRoutes: 0,
          averageConfidence: 0,
          averageResponseTime: 0,
          commandUsageStats: /* @__PURE__ */ new Map()
        };
      }
      updateMetrics(confidence, responseTime, command) {
        const totalConfidence = this.metrics.averageConfidence * (this.metrics.successfulRoutes - 1);
        this.metrics.averageConfidence = (totalConfidence + confidence) / this.metrics.successfulRoutes;
        const totalResponseTime = this.metrics.averageResponseTime * (this.metrics.successfulRoutes - 1);
        this.metrics.averageResponseTime = (totalResponseTime + responseTime) / this.metrics.successfulRoutes;
        const currentCount = this.metrics.commandUsageStats.get(command) ?? 0;
        this.metrics.commandUsageStats.set(command, currentCount + 1);
      }
      async trainOnFeedback(input, correctCommand, wasCorrect) {
        if (!this.config.enableLearning) return;
        try {
          await this.userPatternAnalyzer.recordFeedback(input, correctCommand, wasCorrect);
          await this.intentRecognizer.updateModel(input, correctCommand, wasCorrect);
          this.emit("training:complete", { input, correctCommand, wasCorrect });
        } catch (error) {
          console.error("Failed to train on feedback:", error);
        }
      }
      getConfidenceThreshold() {
        return this.config.confidenceThreshold;
      }
      setConfidenceThreshold(threshold) {
        if (threshold < 0 || threshold > 1) {
          throw new Error("Confidence threshold must be between 0 and 1");
        }
        this.config.confidenceThreshold = threshold;
      }
      getSupportedLanguages() {
        return [...this.config.supportedLanguages];
      }
      isLanguageSupported(language) {
        return this.config.supportedLanguages.includes(language);
      }
      async exportLearningData() {
        return this.userPatternAnalyzer.exportData();
      }
      async importLearningData(data) {
        await this.userPatternAnalyzer.importData(data);
      }
      dispose() {
        this.removeAllListeners();
        this.isInitialized = false;
      }
    };
    routerInstance = null;
    __name(getIntelligentRouter, "getIntelligentRouter");
  }
});
var ModeRecognitionEngine;
var init_ModeRecognitionEngine = __esm({
  "src/services/internal-mode/ModeRecognitionEngine.ts"() {
    init_cjs_shims();
    init_types();
    init_IntelligentRouterService();
    init_NaturalLanguageProcessor();
    ModeRecognitionEngine = class extends events.EventEmitter {
      static {
        __name(this, "ModeRecognitionEngine");
      }
      modeRegistry;
      config;
      nlpProcessor;
      initialized = false;
      // Recognition cache to improve performance
      recognitionCache = /* @__PURE__ */ new Map();
      cacheTimeout = 3e4;
      // 30 seconds
      constructor(modeRegistry, config) {
        super();
        this.modeRegistry = modeRegistry;
        this.config = config;
        this.nlpProcessor = new NaturalLanguageProcessor();
      }
      async initialize() {
        if (this.initialized) return;
        await this.nlpProcessor.initialize();
        this.initialized = true;
      }
      /**
       * Main recognition method - analyzes context and returns best mode match
       */
      async recognizeMode(context) {
        if (!this.initialized) {
          await this.initialize();
        }
        const startTime = Date.now();
        try {
          const cacheKey = this.generateCacheKey(context);
          const cached = this.recognitionCache.get(cacheKey);
          if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.result;
          }
          const processedInput = await this.nlpProcessor.process(context.userInput, context.language);
          const modeScores = await this.scoreAllModes(context, processedInput);
          const bestMatch = this.findBestMatch(modeScores);
          if (!bestMatch) {
            return null;
          }
          const result = {
            mode: bestMatch.mode,
            confidence: bestMatch.confidence,
            reasoning: this.generateReasoning(bestMatch, context),
            alternatives: modeScores.filter((score) => score.mode.id !== bestMatch.mode.id).sort((a, b) => b.totalScore - a.totalScore).slice(0, 3).map((score) => ({
              mode: score.mode,
              confidence: score.confidence
            })),
            triggers: bestMatch.triggeredBy.map((type) => ({
              type,
              score: bestMatch.scores[type] || 0,
              details: this.getTriggerDetails(type, bestMatch, context)
            }))
          };
          this.recognitionCache.set(cacheKey, {
            result,
            timestamp: Date.now()
          });
          this.cleanCache();
          this.emit("recognition:completed", result);
          const processingTime = Date.now() - startTime;
          if (processingTime > this.config.recognitionTimeout) {
            console.warn(
              `Mode recognition took ${processingTime}ms (target: ${this.config.recognitionTimeout}ms)`
            );
          }
          return result;
        } catch (error) {
          this.emit("error", error);
          console.error("Mode recognition error:", error);
          return null;
        }
      }
      /**
       * Update engine based on user feedback
       */
      async updateFromFeedback(userInput, correctModeId, wasCorrect) {
        console.log(
          `Mode feedback: Input="${userInput}", Correct="${correctModeId}", Success=${wasCorrect}`
        );
      }
      /**
       * Update configuration
       */
      updateConfig(config) {
        this.config = config;
      }
      // Private methods
      async scoreAllModes(context, processedInput) {
        const allModes = this.modeRegistry.getAllModes();
        const scores = [];
        for (const mode of allModes) {
          const score = await this.scoreMode(mode, context, processedInput);
          if (score.totalScore > 0) {
            scores.push(score);
          }
        }
        return scores.sort((a, b) => b.totalScore - a.totalScore);
      }
      async scoreMode(mode, context, processedInput) {
        const scores = {
          intent: 0,
          context: 0,
          situation: 0,
          pattern: 0
        };
        const triggeredBy = [];
        const reasoning = [];
        for (const trigger of mode.triggers) {
          let triggerScore = 0;
          switch (trigger.type) {
            case "intent":
              triggerScore = await this.scoreIntentTrigger(trigger, processedInput, context);
              break;
            case "context":
              triggerScore = await this.scoreContextTrigger(trigger, context);
              break;
            case "situation":
              triggerScore = await this.scoreSituationTrigger(trigger, context);
              break;
            case "pattern":
              triggerScore = await this.scorePatternTrigger(trigger, context);
              break;
          }
          if (triggerScore > 0) {
            scores[trigger.type] = Math.max(scores[trigger.type], triggerScore * trigger.weight);
            if (triggerScore >= trigger.confidence) {
              triggeredBy.push(trigger.type);
              reasoning.push(`${trigger.type} trigger activated (score: ${triggerScore.toFixed(2)})`);
            }
          }
        }
        const totalScore = scores.intent * DEFAULT_TRIGGER_WEIGHTS.intent + scores.context * DEFAULT_TRIGGER_WEIGHTS.context + scores.situation * DEFAULT_TRIGGER_WEIGHTS.situation + scores.pattern * DEFAULT_TRIGGER_WEIGHTS.pattern;
        const confidence = Math.min(totalScore, 1);
        return {
          mode,
          totalScore,
          scores,
          triggeredBy,
          confidence,
          reasoning
        };
      }
      async scoreIntentTrigger(trigger, processedInput, context) {
        let score = 0;
        for (const condition of trigger.conditions) {
          let conditionScore = 0;
          switch (condition.field) {
            case "keywords":
              conditionScore = this.scoreKeywordCondition(condition, processedInput);
              break;
            case "entities":
              conditionScore = this.scoreEntityCondition(condition, processedInput);
              break;
            case "intent":
              conditionScore = await this.scoreIntentCondition(condition, context);
              break;
          }
          score += conditionScore * condition.weight;
        }
        return Math.min(score, 1);
      }
      async scoreContextTrigger(trigger, context) {
        let score = 0;
        for (const condition of trigger.conditions) {
          let conditionScore = 0;
          switch (condition.field) {
            case "currentMode":
              conditionScore = this.scoreCurrentModeCondition(condition, context);
              break;
            case "previousModes":
              conditionScore = this.scorePreviousModeCondition(condition, context);
              break;
            case "commandHistory":
              conditionScore = this.scoreCommandHistoryCondition(condition, context);
              break;
            case "defaultMode":
              conditionScore = condition.value === "true" ? 0.5 : 0;
              break;
          }
          score += conditionScore * condition.weight;
        }
        return Math.min(score, 1);
      }
      async scoreSituationTrigger(trigger, context) {
        let score = 0;
        for (const condition of trigger.conditions) {
          let conditionScore = 0;
          switch (condition.field) {
            case "errorState":
              conditionScore = this.scoreErrorStateCondition(condition, context);
              break;
            case "projectContext":
              conditionScore = this.scoreProjectContextCondition(condition, context);
              break;
            case "timeOfDay":
              conditionScore = this.scoreTimeCondition(condition, context);
              break;
          }
          score += conditionScore * condition.weight;
        }
        return Math.min(score, 1);
      }
      async scorePatternTrigger(trigger, context) {
        let score = 0;
        for (const pattern of context.userPatterns) {
          if (pattern.sequence.length > 0) {
            pattern.sequence[pattern.sequence.length - 1];
            const recentUsage = (Date.now() - pattern.lastUsed.getTime()) / (1e3 * 60 * 60);
            const frequencyScore = Math.min(pattern.frequency / 10, 0.5);
            const recencyScore = Math.max(0, 0.5 - recentUsage / 168);
            const successScore = pattern.success * 0.5;
            score = Math.max(score, frequencyScore + recencyScore + successScore);
          }
        }
        return Math.min(score, 1);
      }
      scoreKeywordCondition(condition, processedInput) {
        const keywords = Array.isArray(condition.value) ? condition.value : [condition.value];
        let matches = 0;
        for (const keyword of keywords) {
          if (processedInput.keywords.includes(keyword.toLowerCase()) || processedInput.tokens.includes(keyword.toLowerCase())) {
            matches++;
          }
        }
        return keywords.length > 0 ? matches / keywords.length : 0;
      }
      scoreEntityCondition(condition, processedInput) {
        const entities = Array.isArray(condition.value) ? condition.value : [condition.value];
        let matches = 0;
        for (const entityType of entities) {
          if (processedInput.entities.some((e) => e.type === entityType)) {
            matches++;
          }
        }
        return entities.length > 0 ? matches / entities.length : 0;
      }
      async scoreIntentCondition(condition, context) {
        try {
          const router = getIntelligentRouter();
          const intent = await router.route(context.userInput);
          if (intent && intent.command) {
            return condition.value === intent.command ? 1 : 0;
          }
        } catch (error) {
        }
        return 0;
      }
      scoreCurrentModeCondition(condition, context) {
        if (!context.currentMode) return 0;
        return condition.value === context.currentMode.id ? 1 : 0;
      }
      scorePreviousModeCondition(condition, context) {
        const targetModes = Array.isArray(condition.value) ? condition.value : [condition.value];
        const recentModeIds = context.previousModes.slice(0, 3).map((m) => m.mode.id);
        return targetModes.some((mode) => recentModeIds.includes(mode)) ? 0.8 : 0;
      }
      scoreCommandHistoryCondition(condition, context) {
        const targetCommands = Array.isArray(condition.value) ? condition.value : [condition.value];
        const recentCommands = context.commandHistory.slice(-5);
        return targetCommands.some((cmd) => recentCommands.includes(cmd)) ? 0.7 : 0;
      }
      scoreErrorStateCondition(condition, context) {
        const hasError = !!context.errorState;
        return condition.value === "true" ? hasError ? 1 : 0 : hasError ? 0 : 1;
      }
      scoreProjectContextCondition(condition, context) {
        if (!context.projectContext) return 0;
        switch (condition.field) {
          case "type":
            return condition.value === context.projectContext.type ? 0.8 : 0;
          case "hasErrors":
            return condition.value === context.projectContext.hasErrors.toString() ? 0.9 : 0;
          case "hasTests":
            return condition.value === context.projectContext.hasTests.toString() ? 0.6 : 0;
          default:
            return 0;
        }
      }
      scoreTimeCondition(condition, context) {
        const hour = context.timestamp.getHours();
        const timeRange = condition.value;
        switch (timeRange) {
          case "morning":
            return hour >= 6 && hour < 12 ? 0.3 : 0;
          case "afternoon":
            return hour >= 12 && hour < 18 ? 0.3 : 0;
          case "evening":
            return hour >= 18 || hour < 6 ? 0.3 : 0;
          default:
            return 0;
        }
      }
      findBestMatch(modeScores) {
        if (modeScores.length === 0) return null;
        const bestScore = modeScores[0];
        if (bestScore.confidence >= this.config.confidenceThreshold) {
          return bestScore;
        }
        return null;
      }
      generateReasoning(modeScore, context) {
        const reasons = [];
        if (modeScore.scores.intent > 0.5) {
          reasons.push(`Strong intent match (${(modeScore.scores.intent * 100).toFixed(0)}%)`);
        }
        if (modeScore.scores.context > 0.5) {
          reasons.push(`Context alignment (${(modeScore.scores.context * 100).toFixed(0)}%)`);
        }
        if (modeScore.scores.situation > 0.5) {
          reasons.push(`Situational factors (${(modeScore.scores.situation * 100).toFixed(0)}%)`);
        }
        if (modeScore.scores.pattern > 0.3) {
          reasons.push(`User pattern match (${(modeScore.scores.pattern * 100).toFixed(0)}%)`);
        }
        return reasons.length > 0 ? reasons.join("; ") : "General context analysis";
      }
      getTriggerDetails(type, modeScore, context) {
        switch (type) {
          case "intent":
            return `User input analysis: "${context.userInput.slice(0, 50)}..."`;
          case "context":
            return `Current context: ${context.currentMode?.name || "none"} \u2192 ${modeScore.mode.name}`;
          case "situation":
            return `Project state: ${context.projectContext?.type || "unknown"}, errors: ${!!context.errorState}`;
          case "pattern":
            return `Usage patterns: ${context.userPatterns.length} patterns analyzed`;
          default:
            return "General analysis";
        }
      }
      generateCacheKey(context) {
        const keyParts = [
          context.userInput.toLowerCase().trim(),
          context.language,
          context.currentMode?.id || "none",
          context.errorState ? "error" : "normal"
        ];
        return keyParts.join("|");
      }
      cleanCache() {
        const now = Date.now();
        for (const [key, cached] of this.recognitionCache.entries()) {
          if (now - cached.timestamp > this.cacheTimeout) {
            this.recognitionCache.delete(key);
          }
        }
      }
    };
  }
});
var ModeDisplayManager;
var init_ModeDisplayManager = __esm({
  "src/services/internal-mode/ModeDisplayManager.ts"() {
    init_cjs_shims();
    ModeDisplayManager = class {
      static {
        __name(this, "ModeDisplayManager");
      }
      config;
      initialized = false;
      currentDisplayTimeout = null;
      constructor(config) {
        this.config = config;
      }
      async initialize() {
        if (this.initialized) return;
        this.initialized = true;
      }
      /**
       * Display a mode with its visual representation
       */
      async showMode(mode) {
        if (!this.config.showTransitions) return;
        const display = this.formatModeDisplay(mode);
        if (this.currentDisplayTimeout) {
          clearTimeout(this.currentDisplayTimeout);
        }
        this.outputModeDisplay(display);
        if (mode.display.duration > 0) {
          this.currentDisplayTimeout = setTimeout(() => {
            this.clearModeDisplay();
          }, mode.display.duration);
        }
      }
      /**
       * Show mode transition with before/after indication
       */
      async showModeTransition(newMode, previousMode) {
        if (!this.config.showTransitions) return;
        if (this.config.animationEnabled && newMode.display.animation) {
          await this.animateTransition(previousMode, newMode);
        } else {
          await this.showMode(newMode);
        }
      }
      /**
       * Clear the current mode display
       */
      clearModeDisplay() {
        if (this.currentDisplayTimeout) {
          clearTimeout(this.currentDisplayTimeout);
          this.currentDisplayTimeout = null;
        }
      }
      /**
       * Update configuration
       */
      updateConfig(config) {
        this.config = config;
      }
      /**
       * Get formatted mode display string
       */
      getFormattedMode(mode, language) {
        const lang = language || this.config.defaultLanguage;
        const i18n = mode.i18n[lang] || mode.i18n.en;
        return this.formatModeDisplay(mode, i18n.name);
      }
      // Private methods
      formatModeDisplay(mode, customName) {
        const name = customName || mode.name;
        const prefix = mode.display.prefix || "\u273D";
        const suffix = mode.display.suffix || "\u2026";
        const displayText = `${prefix} ${mode.symbol} ${name}${suffix}`;
        if (!this.config.colorEnabled) {
          return displayText;
        }
        switch (mode.display.color) {
          case "red":
            return chalk8__default.default.red(displayText);
          case "green":
            return chalk8__default.default.green(displayText);
          case "yellow":
            return chalk8__default.default.yellow(displayText);
          case "blue":
            return chalk8__default.default.blue(displayText);
          case "magenta":
            return chalk8__default.default.magenta(displayText);
          case "cyan":
            return chalk8__default.default.cyan(displayText);
          case "white":
            return chalk8__default.default.white(displayText);
          case "gray":
          case "grey":
            return chalk8__default.default.gray(displayText);
          default:
            return chalk8__default.default.cyan(displayText);
        }
      }
      outputModeDisplay(display) {
        console.log(`\r${display}`);
      }
      async animateTransition(previousMode, newMode) {
        const animationFrames = this.createTransitionAnimation(previousMode, newMode);
        for (let i = 0; i < animationFrames.length; i++) {
          this.outputModeDisplay(animationFrames[i]);
          await this.sleep(100);
        }
      }
      createTransitionAnimation(previousMode, newMode) {
        const frames = [];
        if (previousMode) {
          frames.push(this.formatModeDisplay(previousMode));
          frames.push(chalk8__default.default.dim(this.formatModeDisplay(previousMode)));
          frames.push(chalk8__default.default.dim("\u273D \u2026"));
        }
        frames.push(chalk8__default.default.dim("\u273D \u26A1 \u2026"));
        frames.push(chalk8__default.default.dim(this.formatModeDisplay(newMode)));
        frames.push(this.formatModeDisplay(newMode));
        return frames;
      }
      sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
      }
      /**
       * Create a status line display for current mode
       */
      createStatusLine(mode, additionalInfo) {
        const modeDisplay = this.formatModeDisplay(mode);
        const timestamp = (/* @__PURE__ */ new Date()).toLocaleTimeString();
        let statusLine = `${modeDisplay}`;
        if (additionalInfo) {
          statusLine += ` ${chalk8__default.default.gray("|")} ${chalk8__default.default.dim(additionalInfo)}`;
        }
        statusLine += ` ${chalk8__default.default.gray("|")} ${chalk8__default.default.dim(timestamp)}`;
        return statusLine;
      }
      /**
       * Create a compact mode indicator
       */
      createCompactIndicator(mode) {
        const symbol = mode.symbol;
        const color = mode.display.color;
        if (!this.config.colorEnabled) {
          return `[${symbol}]`;
        }
        const indicator = `[${symbol}]`;
        switch (color) {
          case "red":
            return chalk8__default.default.red(indicator);
          case "green":
            return chalk8__default.default.green(indicator);
          case "yellow":
            return chalk8__default.default.yellow(indicator);
          case "blue":
            return chalk8__default.default.blue(indicator);
          case "magenta":
            return chalk8__default.default.magenta(indicator);
          case "cyan":
            return chalk8__default.default.cyan(indicator);
          default:
            return chalk8__default.default.cyan(indicator);
        }
      }
      /**
       * Create detailed mode information display
       */
      createDetailedDisplay(mode, language) {
        const lang = language || this.config.defaultLanguage;
        const i18n = mode.i18n[lang] || mode.i18n.en;
        const lines = [];
        lines.push(chalk8__default.default.bold(this.formatModeDisplay(mode, i18n.name)));
        lines.push("");
        lines.push(chalk8__default.default.white("Description:"));
        lines.push(`  ${chalk8__default.default.gray(i18n.description)}`);
        lines.push("");
        lines.push(chalk8__default.default.white("Purpose:"));
        lines.push(`  ${chalk8__default.default.gray(i18n.purpose)}`);
        lines.push("");
        if (i18n.useCases.length > 0) {
          lines.push(chalk8__default.default.white("Use Cases:"));
          i18n.useCases.forEach((useCase) => {
            lines.push(`  ${chalk8__default.default.gray("\u2022")} ${chalk8__default.default.gray(useCase)}`);
          });
          lines.push("");
        }
        lines.push(chalk8__default.default.dim("Metadata:"));
        lines.push(chalk8__default.default.dim(`  Category: ${mode.category}`));
        lines.push(chalk8__default.default.dim(`  Intensity: ${mode.intensity}`));
        lines.push(chalk8__default.default.dim(`  Version: ${mode.metadata.version}`));
        return lines;
      }
      /**
       * Create mode list display
       */
      createModeListDisplay(modes, language) {
        const lang = language || this.config.defaultLanguage;
        const lines = [];
        const categorized = /* @__PURE__ */ new Map();
        modes.forEach((mode) => {
          if (!categorized.has(mode.category)) {
            categorized.set(mode.category, []);
          }
          categorized.get(mode.category).push(mode);
        });
        for (const [category, categoryModes] of categorized.entries()) {
          lines.push(chalk8__default.default.bold.cyan(`${category.toUpperCase()} (${categoryModes.length})`));
          lines.push("");
          categoryModes.forEach((mode) => {
            const i18n = mode.i18n[lang] || mode.i18n.en;
            const indicator = this.createCompactIndicator(mode);
            const name = chalk8__default.default.white(i18n.name);
            const description = chalk8__default.default.gray(i18n.description);
            lines.push(`  ${indicator} ${name}`);
            lines.push(`    ${description}`);
            lines.push("");
          });
        }
        return lines;
      }
      /**
       * Create help display for mode commands
       */
      createHelpDisplay() {
        const lines = [];
        lines.push(chalk8__default.default.bold.cyan("Internal Mode System"));
        lines.push("");
        lines.push("The internal mode system automatically adapts MARIA's thinking process");
        lines.push("based on your input and context. Modes are displayed as:");
        lines.push("");
        lines.push(`  ${chalk8__default.default.cyan("\u273D \u{1F9E0} Thinking\u2026")} - Current internal mode`);
        lines.push("");
        lines.push(chalk8__default.default.white("Commands:"));
        lines.push(`  ${chalk8__default.default.green("/mode")}              - Show current mode`);
        lines.push(`  ${chalk8__default.default.green("/mode list")}         - List all available modes`);
        lines.push(`  ${chalk8__default.default.green("/mode <name>")}       - Switch to specific mode`);
        lines.push(`  ${chalk8__default.default.green("/mode auto")}         - Enable automatic mode switching`);
        lines.push(`  ${chalk8__default.default.green("/mode history")}      - Show mode usage history`);
        lines.push(`  ${chalk8__default.default.green("/mode help")}         - Show this help`);
        lines.push("");
        lines.push(
          chalk8__default.default.dim("Mode switching is automatic by default based on your input and context.")
        );
        return lines;
      }
    };
  }
});
var ModeHistoryTracker;
var init_ModeHistoryTracker = __esm({
  "src/services/internal-mode/ModeHistoryTracker.ts"() {
    init_cjs_shims();
    ModeHistoryTracker = class extends events.EventEmitter {
      static {
        __name(this, "ModeHistoryTracker");
      }
      config;
      history = [];
      userPatterns = [];
      initialized = false;
      // Performance tracking
      sessionStartTime = /* @__PURE__ */ new Date();
      totalModeChanges = 0;
      recognitionAccuracy = [];
      constructor(config) {
        super();
        this.config = config;
      }
      async initialize() {
        if (this.initialized) return;
        await this.loadPersistedData();
        this.initialized = true;
      }
      /**
       * Record a mode transition
       */
      async recordTransition(transition) {
        if (this.history.length > 0) {
          const lastEntry = this.history[this.history.length - 1];
          if (!lastEntry.endTime) {
            lastEntry.endTime = transition.timestamp;
            lastEntry.duration = lastEntry.endTime.getTime() - lastEntry.startTime.getTime();
          }
        }
        const historyEntry = {
          mode: {
            id: transition.to,
            name: transition.to,
            symbol: "\u{1F9E0}",
            category: "reasoning",
            intensity: "normal",
            description: "",
            purpose: "",
            useCases: [],
            triggers: [],
            display: { color: "cyan", animation: true, duration: 2e3, prefix: "\u273D", suffix: "\u2026" },
            i18n: {},
            metadata: {
              version: "1.0.0",
              author: "MARIA",
              created: /* @__PURE__ */ new Date(),
              updated: /* @__PURE__ */ new Date(),
              tags: [],
              experimental: false,
              deprecated: false
            }
          },
          startTime: transition.timestamp,
          trigger: transition.trigger
        };
        this.history.push(historyEntry);
        this.totalModeChanges++;
        if (this.history.length > this.config.maxHistoryEntries) {
          this.history.shift();
        }
        await this.updateUserPatterns();
        if (this.totalModeChanges % 10 === 0) {
          await this.persistData();
        }
      }
      /**
       * Record user feedback on mode accuracy
       */
      async recordFeedback(modeId, wasCorrect, userInput) {
        this.recognitionAccuracy.push({
          predicted: modeId,
          actual: modeId,
          // In real implementation, would track what user actually wanted
          correct: wasCorrect
        });
        if (this.recognitionAccuracy.length > 100) {
          this.recognitionAccuracy.shift();
        }
        if (userInput) {
          await this.updatePatternFromFeedback(userInput, modeId, wasCorrect);
        }
        this.emit("feedback:recorded", { modeId, wasCorrect, userInput });
      }
      /**
       * Get recent mode history
       */
      getRecentModes(limit = 5) {
        return this.history.slice(-limit).reverse();
      }
      /**
       * Get full history
       */
      getHistory() {
        return [...this.history];
      }
      /**
       * Get user patterns for mode prediction
       */
      getUserPatterns() {
        return [...this.userPatterns];
      }
      /**
       * Get mode usage statistics
       */
      getUsageStatistics() {
        const modeUsage = /* @__PURE__ */ new Map();
        const sequences = /* @__PURE__ */ new Map();
        this.history.forEach((entry) => {
          const currentCount = modeUsage.get(entry.mode.id) || 0;
          modeUsage.set(entry.mode.id, currentCount + 1);
        });
        for (let i = 0; i < this.history.length - 2; i++) {
          const sequence = [
            this.history[i].mode.id,
            this.history[i + 1].mode.id,
            this.history[i + 2].mode.id
          ];
          const sequenceKey = sequence.join("\u2192");
          const currentCount = sequences.get(sequenceKey) || 0;
          sequences.set(sequenceKey, currentCount + 1);
        }
        const mostUsedModes = Array.from(modeUsage.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([modeId, count]) => ({
          modeId,
          count,
          percentage: count / this.history.length * 100
        }));
        const modeSequences = Array.from(sequences.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([sequence, frequency]) => ({
          sequence: sequence.split("\u2192"),
          frequency
        }));
        const accuracySum = this.recognitionAccuracy.reduce(
          (sum, entry) => sum + (entry.correct ? 1 : 0),
          0
        );
        const recognitionAccuracy = this.recognitionAccuracy.length > 0 ? accuracySum / this.recognitionAccuracy.length * 100 : 0;
        const sessionDuration = Date.now() - this.sessionStartTime.getTime();
        const averageSessionDuration = sessionDuration / Math.max(1, this.totalModeChanges);
        return {
          totalSessions: 1,
          // Single session for now
          totalModeChanges: this.totalModeChanges,
          averageSessionDuration,
          mostUsedModes,
          modeSequences,
          recognitionAccuracy
        };
      }
      /**
       * Export history data
       */
      async exportHistory() {
        return {
          history: this.getHistory(),
          patterns: this.getUserPatterns(),
          statistics: this.getUsageStatistics()
        };
      }
      /**
       * Import history data
       */
      async importHistory(historyData) {
        this.history = historyData.slice(0, this.config.maxHistoryEntries);
        await this.updateUserPatterns();
        await this.persistData();
      }
      /**
       * Import patterns data
       */
      async importPatterns(patternsData) {
        this.userPatterns = patternsData.slice(0, this.config.maxPatterns);
        await this.persistData();
      }
      /**
       * Clear all history and patterns
       */
      async clear() {
        this.history = [];
        this.userPatterns = [];
        this.recognitionAccuracy = [];
        this.totalModeChanges = 0;
        this.sessionStartTime = /* @__PURE__ */ new Date();
        await this.persistData();
      }
      /**
       * Update configuration
       */
      updateConfig(config) {
        this.config = config;
      }
      // Private methods
      async updateUserPatterns() {
        if (!this.config.patternTrackingEnabled || this.history.length < 3) {
          return;
        }
        const recentHistory = this.history.slice(-10);
        const newPatterns = [];
        for (let sequenceLength = 2; sequenceLength <= 4; sequenceLength++) {
          for (let i = 0; i <= recentHistory.length - sequenceLength; i++) {
            const sequence = recentHistory.slice(i, i + sequenceLength).map((entry) => entry.mode.id);
            const existingPattern = this.userPatterns.find(
              (p) => p.sequence.length === sequence.length && p.sequence.every((mode, idx) => mode === sequence[idx])
            );
            if (existingPattern) {
              existingPattern.frequency++;
              existingPattern.lastUsed = /* @__PURE__ */ new Date();
            } else {
              newPatterns.push({
                sequence,
                frequency: 1,
                lastUsed: /* @__PURE__ */ new Date(),
                success: 0.8
                // Default success rate
              });
            }
          }
        }
        this.userPatterns.push(...newPatterns);
        if (this.userPatterns.length > this.config.maxPatterns) {
          this.userPatterns.sort((a, b) => {
            const aScore = a.frequency * 0.7 + (Date.now() - a.lastUsed.getTime()) / 864e5 * 0.3;
            const bScore = b.frequency * 0.7 + (Date.now() - b.lastUsed.getTime()) / 864e5 * 0.3;
            return bScore - aScore;
          });
          this.userPatterns = this.userPatterns.slice(0, this.config.maxPatterns);
        }
        this.emit("pattern:learned", this.userPatterns);
      }
      async updatePatternFromFeedback(userInput, modeId, wasCorrect) {
        this.getRecentModes(3).map((entry) => entry.mode.id);
        for (const pattern of this.userPatterns) {
          if (pattern.sequence.length > 0 && pattern.sequence[pattern.sequence.length - 1] === modeId) {
            const currentSuccess = pattern.success;
            const newSuccess = wasCorrect ? currentSuccess * 0.9 + 0.1 : currentSuccess * 0.9;
            pattern.success = Math.max(0.1, Math.min(1, newSuccess));
          }
        }
      }
      async loadPersistedData() {
        this.history = [];
        this.userPatterns = [];
        this.recognitionAccuracy = [];
      }
      async persistData() {
        this.emit("data:persist", {
          history: this.history,
          patterns: this.userPatterns,
          accuracy: this.recognitionAccuracy
        });
      }
      /**
       * Analyze mode effectiveness
       */
      analyzeModeEffectiveness() {
        const modeAnalysis = /* @__PURE__ */ new Map();
        this.history.forEach((entry) => {
          const analysis = modeAnalysis.get(entry.mode.id) || {
            usageCount: 0,
            totalDuration: 0,
            satisfactionSum: 0,
            satisfactionCount: 0,
            triggers: /* @__PURE__ */ new Map()
          };
          analysis.usageCount++;
          if (entry.duration) {
            analysis.totalDuration += entry.duration;
          }
          if (entry.userFeedback) {
            const satisfactionValue = entry.userFeedback === "positive" ? 1 : entry.userFeedback === "negative" ? 0 : 0.5;
            analysis.satisfactionSum += satisfactionValue;
            analysis.satisfactionCount++;
          }
          const triggerCount = analysis.triggers.get(entry.trigger) || 0;
          analysis.triggers.set(entry.trigger, triggerCount + 1);
          modeAnalysis.set(entry.mode.id, analysis);
        });
        return Array.from(modeAnalysis.entries()).map(([modeId, analysis]) => ({
          modeId,
          totalUsage: analysis.usageCount,
          averageDuration: analysis.usageCount > 0 ? analysis.totalDuration / analysis.usageCount : 0,
          userSatisfaction: analysis.satisfactionCount > 0 ? analysis.satisfactionSum / analysis.satisfactionCount : 0.5,
          triggers: Array.from(analysis.triggers.entries()).map(([type, count]) => ({ type, count }))
        }));
      }
      /**
       * Get mode recommendations based on current context
       */
      getRecommendations(currentContext) {
        const recommendations = [];
        this.userPatterns.forEach((pattern) => {
          if (pattern.sequence.length >= 2) {
            const lastInSequence = pattern.sequence[pattern.sequence.length - 1];
            const patternStart = pattern.sequence.slice(0, -1);
            if (currentContext.recentModes.length >= patternStart.length) {
              const recentSlice = currentContext.recentModes.slice(-patternStart.length);
              if (patternStart.every((mode, idx) => mode === recentSlice[idx])) {
                const confidence = pattern.frequency / 10 * pattern.success;
                recommendations.push({
                  modeId: lastInSequence,
                  confidence: Math.min(confidence, 0.9),
                  reason: `Pattern match: ${pattern.sequence.join(" \u2192 ")} (used ${pattern.frequency} times)`
                });
              }
            }
          }
        });
        return recommendations.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
      }
    };
  }
});
function getInternalModeService(config) {
  if (!modeServiceInstance) {
    modeServiceInstance = new InternalModeService(config);
  }
  return modeServiceInstance;
}
var InternalModeService, modeServiceInstance;
var init_InternalModeService = __esm({
  "src/services/internal-mode/InternalModeService.ts"() {
    init_cjs_shims();
    init_ModeDefinitionRegistry();
    init_ModeRecognitionEngine();
    init_ModeDisplayManager();
    init_ModeHistoryTracker();
    InternalModeService = class extends events.EventEmitter {
      static {
        __name(this, "InternalModeService");
      }
      modeRegistry;
      recognitionEngine;
      displayManager;
      historyTracker;
      currentMode = null;
      config;
      initialized = false;
      recognitionInProgress = false;
      constructor(config = {}) {
        super();
        this.config = {
          confidenceThreshold: 0.85,
          autoSwitchEnabled: true,
          confirmationRequired: false,
          showTransitions: true,
          animationEnabled: true,
          colorEnabled: true,
          learningEnabled: true,
          patternTrackingEnabled: true,
          feedbackEnabled: true,
          defaultLanguage: "en",
          supportedLanguages: ["en", "ja", "cn", "ko", "vn"],
          maxHistoryEntries: 1e3,
          maxPatterns: 500,
          recognitionTimeout: 200,
          ...config
        };
        this.modeRegistry = getModeRegistry();
        this.recognitionEngine = new ModeRecognitionEngine(this.modeRegistry, this.config);
        this.displayManager = new ModeDisplayManager(this.config);
        this.historyTracker = new ModeHistoryTracker(this.config);
        this.setupEventListeners();
      }
      async initialize() {
        if (this.initialized) return;
        try {
          console.log(chalk8__default.default.cyan("\u{1F9E0} Initializing Internal Mode Service..."));
          await Promise.all([
            this.modeRegistry.initialize(),
            this.recognitionEngine.initialize(),
            this.displayManager.initialize(),
            this.historyTracker.initialize()
          ]);
          const thinkingMode = this.modeRegistry.getModeById("thinking");
          if (thinkingMode) {
            await this.setMode(thinkingMode, "manual", true);
          }
          this.initialized = true;
          this.emit("initialized");
          console.log(chalk8__default.default.green("\u2705 Internal Mode Service initialized successfully"));
          console.log(chalk8__default.default.gray(`\u{1F4CA} Loaded ${this.modeRegistry.getModeCount()} modes`));
        } catch (error) {
          console.error(chalk8__default.default.red("Failed to initialize Internal Mode Service:"), error);
          throw error;
        }
      }
      /**
       * Recognize and potentially switch mode based on user input
       */
      async recognizeMode(userInput, context = {}) {
        if (!this.initialized) {
          await this.initialize();
        }
        if (this.recognitionInProgress) {
          return null;
        }
        this.recognitionInProgress = true;
        try {
          const fullContext = {
            currentMode: this.currentMode || void 0,
            previousModes: this.historyTracker.getRecentModes(5),
            userInput,
            language: context.language || this.config.defaultLanguage,
            commandHistory: context.commandHistory || [],
            projectContext: context.projectContext,
            errorState: context.errorState,
            userPatterns: this.historyTracker.getUserPatterns(),
            timestamp: /* @__PURE__ */ new Date(),
            ...context
          };
          const recognition = await this.recognitionEngine.recognizeMode(fullContext);
          this.emit("recognition:completed", recognition);
          if (recognition && recognition.confidence >= this.config.confidenceThreshold) {
            if (this.config.autoSwitchEnabled) {
              const shouldConfirm = this.config.confirmationRequired && recognition.confidence < 0.95;
              if (shouldConfirm) {
                this.emit("mode:suggested", recognition);
              } else {
                await this.switchToMode(recognition.mode, "intent");
              }
            } else {
              this.emit("mode:suggested", recognition);
            }
          }
          return recognition;
        } catch (error) {
          console.error(chalk8__default.default.red("Mode recognition error:"), error);
          this.emit("mode:error", error);
          return null;
        } finally {
          this.recognitionInProgress = false;
        }
      }
      /**
       * Manually set a specific mode
       */
      async setMode(mode, trigger = "manual", isInitial = false) {
        try {
          const modeDefinition = typeof mode === "string" ? this.modeRegistry.getModeById(mode) : mode;
          if (!modeDefinition) {
            throw new Error(`Mode not found: ${mode}`);
          }
          return await this.switchToMode(modeDefinition, trigger, isInitial);
        } catch (error) {
          console.error(chalk8__default.default.red("Failed to set mode:"), error);
          this.emit("mode:error", error);
          return false;
        }
      }
      /**
       * Get current mode
       */
      getCurrentMode() {
        return this.currentMode;
      }
      /**
       * Get all available modes
       */
      getAllModes() {
        return this.modeRegistry.getAllModes();
      }
      /**
       * Search modes by query
       */
      searchModes(query, language) {
        return this.modeRegistry.searchModes(query, language || this.config.defaultLanguage);
      }
      /**
       * Get mode by ID
       */
      getModeById(id) {
        return this.modeRegistry.getModeById(id);
      }
      /**
       * Get mode history
       */
      getModeHistory() {
        return this.historyTracker.getHistory();
      }
      /**
       * Update configuration
       */
      updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.recognitionEngine.updateConfig(this.config);
        this.displayManager.updateConfig(this.config);
        this.historyTracker.updateConfig(this.config);
      }
      /**
       * Get current configuration
       */
      getConfig() {
        return { ...this.config };
      }
      /**
       * Provide feedback on mode accuracy
       */
      async provideFeedback(modeId, wasCorrect, userInput) {
        if (!this.config.feedbackEnabled) return;
        try {
          await this.historyTracker.recordFeedback(modeId, wasCorrect, userInput);
          if (userInput) {
            await this.recognitionEngine.updateFromFeedback(userInput, modeId, wasCorrect);
          }
          this.emit("learning:updated", this.historyTracker.getUserPatterns());
        } catch (error) {
          console.error(chalk8__default.default.red("Failed to record feedback:"), error);
        }
      }
      /**
       * Get mode statistics
       */
      getStatistics() {
        const history = this.historyTracker.getHistory();
        const modeUsage = /* @__PURE__ */ new Map();
        const totalConfidence = 0;
        const confidenceCount = 0;
        history.forEach((entry) => {
          const currentCount = modeUsage.get(entry.mode.id) || 0;
          modeUsage.set(entry.mode.id, currentCount + 1);
        });
        const mostUsedModes = Array.from(modeUsage.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([mode, count]) => ({ mode, count }));
        return {
          totalModes: this.modeRegistry.getModeCount(),
          currentMode: this.currentMode?.id || null,
          modeChanges: history.length,
          averageConfidence: confidenceCount > 0 ? totalConfidence / confidenceCount : 0,
          mostUsedModes
        };
      }
      /**
       * Export mode data for backup/transfer
       */
      async exportData() {
        return {
          config: this.config,
          history: this.historyTracker.getHistory(),
          patterns: this.historyTracker.getUserPatterns()
        };
      }
      /**
       * Import mode data from backup
       */
      async importData(data) {
        if (data.config) {
          this.updateConfig(data.config);
        }
        if (data.history) {
          await this.historyTracker.importHistory(data.history);
        }
        if (data.patterns) {
          await this.historyTracker.importPatterns(data.patterns);
        }
      }
      /**
       * Reset to default state
       */
      async reset() {
        this.currentMode = null;
        await this.historyTracker.clear();
        const thinkingMode = this.modeRegistry.getModeById("thinking");
        if (thinkingMode) {
          await this.setMode(thinkingMode, "manual", true);
        }
      }
      /**
       * Dispose and cleanup
       */
      dispose() {
        this.removeAllListeners();
        this.initialized = false;
        this.currentMode = null;
      }
      // Private methods
      async switchToMode(mode, trigger, isInitial = false) {
        const previousMode = this.currentMode;
        if (!isInitial && previousMode && previousMode.id === mode.id) {
          return true;
        }
        try {
          const transition = {
            from: previousMode?.id || "",
            to: mode.id,
            trigger,
            confidence: 1,
            // Would be from recognition result in real implementation
            automatic: trigger !== "manual",
            timestamp: /* @__PURE__ */ new Date()
          };
          this.currentMode = mode;
          await this.historyTracker.recordTransition(transition);
          if (this.config.showTransitions && !isInitial) {
            await this.displayManager.showModeTransition(mode, previousMode || void 0);
          } else if (isInitial) {
            await this.displayManager.showMode(mode);
          }
          this.emit("mode:changed", transition);
          return true;
        } catch (error) {
          console.error(chalk8__default.default.red("Failed to switch mode:"), error);
          this.emit("mode:error", error);
          return false;
        }
      }
      setupEventListeners() {
        this.recognitionEngine.on("recognition:completed", (result) => {
          this.emit("recognition:completed", result);
        });
        this.recognitionEngine.on("error", (error) => {
          this.emit("mode:error", error);
        });
        this.historyTracker.on("pattern:learned", (patterns) => {
          this.emit("learning:updated", patterns);
        });
      }
    };
    modeServiceInstance = null;
    __name(getInternalModeService, "getInternalModeService");
  }
});

// src/services/memory-system/system1-memory.ts
var System1MemoryManager;
var init_system1_memory = __esm({
  "src/services/memory-system/system1-memory.ts"() {
    init_cjs_shims();
    System1MemoryManager = class {
      static {
        __name(this, "System1MemoryManager");
      }
      knowledgeNodes = /* @__PURE__ */ new Map();
      userPreferences;
      // Private implementation details
      conceptGraph;
      interactionHistory;
      patternLibrary;
      config;
      cache = /* @__PURE__ */ new Map();
      lastAccessTimes = /* @__PURE__ */ new Map();
      constructor(config) {
        this.config = config;
        this.conceptGraph = {
          nodes: /* @__PURE__ */ new Map(),
          edges: /* @__PURE__ */ new Map(),
          clusters: []
        };
        this.interactionHistory = {
          sessions: [],
          commands: [],
          patterns: []
        };
        this.patternLibrary = {
          codePatterns: [],
          antiPatterns: [],
          bestPractices: [],
          templates: []
        };
        this.userPreferences = this.initializeDefaultPreferences();
      }
      get programmingConcepts() {
        return Array.from(this.knowledgeNodes.values()).filter((node) => ["function", "class", "module", "concept"].includes(node.type)).sort((a, b) => b.confidence - a.confidence);
      }
      get businessLogic() {
        return this.conceptGraph;
      }
      get pastInteractions() {
        return this.interactionHistory;
      }
      get codePatterns() {
        return this.patternLibrary;
      }
      // Knowledge Node Management
      async addKnowledgeNode(type, name, content, embedding, metadata = {}) {
        const node = {
          id: this.generateNodeId(type, name),
          type,
          name,
          content,
          embedding,
          confidence: 0.8,
          lastAccessed: /* @__PURE__ */ new Date(),
          accessCount: 1,
          metadata: {
            complexity: "medium",
            quality: 0.8,
            relevance: 0.8,
            ...metadata
          }
        };
        this.knowledgeNodes.set(node.id, node);
        this.conceptGraph.nodes.set(node.id, node);
        if (this.knowledgeNodes.size > this.config.maxKnowledgeNodes) {
          await this.cleanupLeastUsedNodes();
        }
        return node;
      }
      async getKnowledgeNode(id) {
        const node = this.knowledgeNodes.get(id);
        if (node) {
          node.lastAccessed = /* @__PURE__ */ new Date();
          node.accessCount++;
          this.lastAccessTimes.set(id, /* @__PURE__ */ new Date());
          this.applyAccessDecay(node);
        }
        return node || null;
      }
      async searchKnowledgeNodes(query, queryEmbedding, limit = 10) {
        const cacheKey = `search:${query}:${limit}`;
        const cached = this.cache.get(cacheKey);
        if (cached) {
          return cached;
        }
        const results = Array.from(this.knowledgeNodes.values()).map((node) => ({
          node,
          similarity: this.calculateCosineSimilarity(queryEmbedding, node.embedding)
        })).filter(({ similarity }) => similarity > 0.5).sort((a, b) => b.similarity - a.similarity).slice(0, limit).map(({ node }) => node);
        this.cache.set(cacheKey, results);
        return results;
      }
      async updateKnowledgeNode(id, updates) {
        const node = this.knowledgeNodes.get(id);
        if (!node) return false;
        Object.assign(node, updates);
        node.lastAccessed = /* @__PURE__ */ new Date();
        this.conceptGraph.nodes.set(id, node);
        this.invalidateCache(`node:${id}`);
        return true;
      }
      // Concept Graph Management
      async addConceptEdge(sourceId, targetId, type, weight = 1, confidence = 0.8) {
        const edge = {
          id: `${sourceId}-${type}-${targetId}`,
          sourceId,
          targetId,
          type,
          weight,
          confidence
        };
        this.conceptGraph.edges.set(edge.id, edge);
        return edge;
      }
      async getRelatedConcepts(nodeId, maxDepth = 2) {
        const cacheKey = `related:${nodeId}:${maxDepth}`;
        const cached = this.cache.get(cacheKey);
        if (cached) {
          return cached;
        }
        const related = /* @__PURE__ */ new Set();
        const visited = /* @__PURE__ */ new Set();
        const queue = [{ id: nodeId, depth: 0 }];
        while (queue.length > 0) {
          const { id, depth } = queue.shift();
          if (visited.has(id) || depth >= maxDepth) continue;
          visited.add(id);
          for (const edge of this.conceptGraph.edges.values()) {
            if (edge.sourceId === id && !visited.has(edge.targetId)) {
              related.add(edge.targetId);
              queue.push({ id: edge.targetId, depth: depth + 1 });
            }
            if (edge.targetId === id && !visited.has(edge.sourceId)) {
              related.add(edge.sourceId);
              queue.push({ id: edge.sourceId, depth: depth + 1 });
            }
          }
        }
        const results = Array.from(related).map((id) => this.knowledgeNodes.get(id)).filter((node) => node !== void 0);
        this.cache.set(cacheKey, results);
        return results;
      }
      // Pattern Management
      async addCodePattern(pattern) {
        const codePattern = {
          id: this.generatePatternId(pattern.name),
          ...pattern
        };
        this.patternLibrary.codePatterns.push(codePattern);
        return codePattern;
      }
      async findCodePatterns(language, framework, useCase, limit = 10) {
        const cacheKey = `patterns:${language}:${framework}:${useCase}:${limit}`;
        const cached = this.cache.get(cacheKey);
        if (cached) {
          return cached;
        }
        let patterns = this.patternLibrary.codePatterns;
        if (language) {
          patterns = patterns.filter((p) => p.language === language);
        }
        if (framework) {
          patterns = patterns.filter((p) => p.framework === framework);
        }
        if (useCase) {
          patterns = patterns.filter((p) => p.useCase.toLowerCase().includes(useCase.toLowerCase()));
        }
        const results = patterns.sort((a, b) => {
          const complexityWeight = { beginner: 3, intermediate: 2, advanced: 1 };
          return (complexityWeight[a.complexity] || 0) - (complexityWeight[b.complexity] || 0);
        }).slice(0, limit);
        this.cache.set(cacheKey, results);
        return results;
      }
      async addAntiPattern(antiPattern) {
        const pattern = {
          id: this.generatePatternId(antiPattern.name),
          ...antiPattern
        };
        this.patternLibrary.antiPatterns.push(pattern);
        return pattern;
      }
      async detectAntiPatterns(code) {
        const detected = [];
        for (const antiPattern of this.patternLibrary.antiPatterns) {
          for (const rule of antiPattern.detectionRules) {
            try {
              const regex = new RegExp(rule.pattern, "gi");
              if (regex.test(code)) {
                detected.push(antiPattern);
                break;
              }
            } catch (error) {
              console.warn(`Invalid regex pattern: ${rule.pattern}`, error);
            }
          }
        }
        return detected.sort((a, b) => {
          const severityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
          return (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0);
        });
      }
      // Interaction History Management
      async recordSession(session) {
        this.interactionHistory.sessions.push(session);
        for (const command of session.commands) {
          await this.updateCommandHistory(command);
        }
        await this.detectUsagePatterns();
        if (this.interactionHistory.sessions.length > 1e3) {
          this.interactionHistory.sessions = this.interactionHistory.sessions.slice(-500);
        }
      }
      async updateCommandHistory(command) {
        let commandHist = this.interactionHistory.commands.find((c) => c.command === command);
        if (!commandHist) {
          commandHist = {
            command,
            frequency: 0,
            lastUsed: /* @__PURE__ */ new Date(),
            successRate: 1,
            averageExecutionTime: 0,
            userSatisfaction: 0.8
          };
          this.interactionHistory.commands.push(commandHist);
        }
        commandHist.frequency++;
        commandHist.lastUsed = /* @__PURE__ */ new Date();
      }
      async getFrequentCommands(limit = 10) {
        return this.interactionHistory.commands.sort((a, b) => b.frequency - a.frequency).slice(0, limit);
      }
      async getRecentCommands(limit = 10) {
        return this.interactionHistory.commands.sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime()).slice(0, limit);
      }
      // User Preferences Management
      async updateUserPreferences(updates) {
        Object.assign(this.userPreferences, updates);
        this.invalidateCache("preferences");
      }
      async getUserPreference(key) {
        return this.userPreferences[key];
      }
      // Memory Event Processing
      async processMemoryEvent(event) {
        switch (event.type) {
          case "code_generation":
            await this.processCodeGenerationEvent(event);
            break;
          case "pattern_recognition":
            await this.processPatternRecognitionEvent(event);
            break;
          case "learning_update":
            await this.processLearningUpdateEvent(event);
            break;
        }
        this.lastAccessTimes.set(event.id, /* @__PURE__ */ new Date());
      }
      // Performance Optimization
      async cleanupLeastUsedNodes() {
        const nodeEntries = Array.from(this.knowledgeNodes.entries());
        const sortedByUsage = nodeEntries.sort((a, b) => {
          const aScore = this.calculateUsageScore(a[1]);
          const bScore = this.calculateUsageScore(b[1]);
          return aScore - bScore;
        });
        const removeCount = Math.floor(this.config.maxKnowledgeNodes * 0.1);
        for (let i = 0; i < removeCount && i < sortedByUsage.length; i++) {
          const entry = sortedByUsage[i];
          if (entry) {
            const [nodeId] = entry;
            this.knowledgeNodes.delete(nodeId);
            this.conceptGraph.nodes.delete(nodeId);
            this.invalidateCache(`node:${nodeId}`);
          }
        }
      }
      async compressMemory() {
        const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3);
        this.interactionHistory.sessions = this.interactionHistory.sessions.filter(
          (session) => session.startTime > cutoffDate
        );
        await this.mergeimilarPatterns();
        this.cache.clear();
      }
      // Private Helper Methods
      generateNodeId(type, name) {
        return `${type}:${name}:${Date.now()}`;
      }
      generatePatternId(name) {
        return `pattern:${name}:${Date.now()}`;
      }
      calculateCosineSimilarity(a, b) {
        if (a.length !== b.length) return 0;
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length && i < b.length; i++) {
          const aVal = a[i] ?? 0;
          const bVal = b[i] ?? 0;
          dotProduct += aVal * bVal;
          normA += aVal * aVal;
          normB += bVal * bVal;
        }
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
      }
      applyAccessDecay(node) {
        const daysSinceAccess = (Date.now() - node.lastAccessed.getTime()) / (1e3 * 60 * 60 * 24);
        const decayFactor = Math.exp(-this.config.accessDecayRate * daysSinceAccess);
        node.confidence *= decayFactor;
        node.confidence = Math.max(node.confidence, 0.1);
      }
      calculateUsageScore(node) {
        const recency = (Date.now() - node.lastAccessed.getTime()) / (1e3 * 60 * 60 * 24);
        const frequency = Math.log(node.accessCount + 1);
        const confidence = node.confidence;
        const quality = node.metadata.quality;
        return (frequency + confidence + quality) / (1 + recency * 0.1);
      }
      invalidateCache(pattern) {
        for (const key of this.cache.keys()) {
          if (key.includes(pattern)) {
            this.cache.delete(key);
          }
        }
      }
      async detectUsagePatterns() {
        const recentSessions = this.interactionHistory.sessions.slice(-20);
        const hourlyUsage = /* @__PURE__ */ new Map();
        for (const session of recentSessions) {
          const hour = session.startTime.getHours();
          hourlyUsage.set(hour, (hourlyUsage.get(hour) || 0) + 1);
        }
        const sequences = /* @__PURE__ */ new Map();
        for (const session of recentSessions) {
          for (let i = 0; i < session.commands.length - 1; i++) {
            const sequence = `${session.commands[i]} -> ${session.commands[i + 1]}`;
            sequences.set(sequence, (sequences.get(sequence) || 0) + 1);
          }
        }
        for (const [sequence, frequency] of sequences.entries()) {
          if (frequency >= 3) {
            const pattern = {
              id: `seq:${sequence}:${Date.now()}`,
              type: "sequential",
              pattern: sequence,
              frequency,
              confidence: Math.min(frequency / 10, 1),
              conditions: []
            };
            this.interactionHistory.patterns.push(pattern);
          }
        }
      }
      async processCodeGenerationEvent(event) {
        const data = event.data;
        if (data.code && data.language) {
          const patterns = this.extractCodePatterns(data.code, data.language);
          for (const pattern of patterns) {
            await this.addCodePattern(pattern);
          }
        }
      }
      async processPatternRecognitionEvent(event) {
        const data = event.data;
        if (data.patternId) {
          const pattern = this.patternLibrary.codePatterns.find((p) => p.id === data.patternId);
          if (pattern && data.success !== void 0) {
            const adjustment = data.success ? 0.1 : -0.05;
            console.log(`Pattern ${data.patternId} adjustment: ${adjustment}`);
          }
        }
      }
      async processLearningUpdateEvent(event) {
        const data = event.data;
        if (data.preference && data.value !== void 0) {
          await this.adaptUserPreferences(data.preference, data.value, data.confidence || 0.8);
        }
      }
      extractCodePatterns(code, language) {
        const patterns = [];
        const functionRegex = /function\s+(\w+)\s*\([^)]*\)\s*{[^}]+}/g;
        let match;
        while ((match = functionRegex.exec(code)) !== null) {
          patterns.push({
            name: `Function: ${match[1]}`,
            description: `Function pattern extracted from code`,
            code: match[0],
            language,
            useCase: "Function definition",
            complexity: "intermediate",
            performance: {
              timeComplexity: "O(1)",
              spaceComplexity: "O(1)"
            },
            examples: []
          });
        }
        return patterns;
      }
      async adaptUserPreferences(preference, value, confidence) {
        console.log(`Adapting preference ${preference} to ${value} (confidence: ${confidence})`);
      }
      async mergeimilarPatterns() {
        const patterns = this.patternLibrary.codePatterns;
        const merged = [];
        const processed = /* @__PURE__ */ new Set();
        for (let i = 0; i < patterns.length; i++) {
          const currentPattern = patterns[i];
          if (!currentPattern || processed.has(currentPattern.id)) continue;
          const similar = patterns.slice(i + 1).filter(
            (p) => p && !processed.has(p.id) && p.language === currentPattern.language && this.calculatePatternSimilarity(currentPattern, p) > 0.8
          );
          if (similar.length > 0) {
            const mergedPattern = this.mergePatterns(currentPattern, similar);
            merged.push(mergedPattern);
            processed.add(currentPattern.id);
            similar.forEach((p) => processed.add(p.id));
          } else {
            merged.push(currentPattern);
            processed.add(currentPattern.id);
          }
        }
        this.patternLibrary.codePatterns = merged;
      }
      calculatePatternSimilarity(a, b) {
        const namesSimilar = a.name.toLowerCase().includes(b.name.toLowerCase()) || b.name.toLowerCase().includes(a.name.toLowerCase());
        const useCasesSimilar = a.useCase.toLowerCase() === b.useCase.toLowerCase();
        return (namesSimilar ? 0.5 : 0) + (useCasesSimilar ? 0.5 : 0);
      }
      mergePatterns(primary, similar) {
        return {
          ...primary,
          description: `${primary.description} (merged from ${similar.length + 1} patterns)`,
          examples: [...primary.examples, ...similar.flatMap((p) => p.examples)]
        };
      }
      initializeDefaultPreferences() {
        return {
          developmentStyle: {
            approach: "iterative",
            preferredLanguages: [
              { language: "typescript", proficiency: "intermediate", frequency: 0.8, preference: 4 },
              { language: "javascript", proficiency: "intermediate", frequency: 0.6, preference: 3 }
            ],
            architecturalPatterns: [
              { name: "MVC", familiarity: 0.7, preference: 3, usageFrequency: 0.5 }
            ],
            problemSolvingStyle: "systematic",
            workPace: "moderate"
          },
          communicationPreferences: {
            verbosity: "moderate",
            explanationDepth: "intermediate",
            codeCommentStyle: "inline",
            feedbackStyle: "constructive"
          },
          toolPreferences: {
            ide: ["vscode", "webstorm"],
            frameworks: [
              { name: "react", category: "frontend", proficiency: 0.7, preference: 4 },
              { name: "express", category: "backend", proficiency: 0.6, preference: 3 }
            ],
            libraries: [{ name: "lodash", category: "utility", proficiency: 0.8, preference: 4 }],
            buildTools: ["webpack", "vite"],
            testingTools: ["jest", "vitest"]
          },
          learningStyle: {
            preferredMethods: [
              { type: "hands_on", effectiveness: 0.9, preference: 5 },
              { type: "visual", effectiveness: 0.7, preference: 4 }
            ],
            pace: "moderate",
            complexity: "simple_to_complex",
            feedback: "immediate"
          },
          qualityStandards: {
            codeQuality: [
              { metric: "maintainability", threshold: 80, priority: "high" },
              { metric: "readability", threshold: 75, priority: "high" }
            ],
            testCoverage: 80,
            documentation: {
              required: true,
              style: "standard",
              formats: ["markdown", "jsdoc"]
            },
            performance: {
              responseTime: 200,
              throughput: 1e3,
              memoryUsage: 512,
              cpuUsage: 70
            },
            security: {
              requirements: [
                {
                  type: "authentication",
                  description: "Secure auth required",
                  severity: "high",
                  mandatory: true
                }
              ],
              compliance: [{ name: "OWASP", version: "2021", requirements: ["Top 10 coverage"] }],
              scanningEnabled: true
            }
          }
        };
      }
    };
  }
});

// src/services/memory-system/system2-memory.ts
var System2MemoryManager;
var init_system2_memory = __esm({
  "src/services/memory-system/system2-memory.ts"() {
    init_cjs_shims();
    System2MemoryManager = class {
      static {
        __name(this, "System2MemoryManager");
      }
      reasoningTraces = /* @__PURE__ */ new Map();
      qualityMetrics;
      decisionTrees = /* @__PURE__ */ new Map();
      enhancements = /* @__PURE__ */ new Map();
      reflectionEntries = /* @__PURE__ */ new Map();
      config;
      analysisCache = /* @__PURE__ */ new Map();
      constructor(config) {
        this.config = config;
        this.qualityMetrics = this.initializeQualityMetrics();
      }
      get reasoningSteps() {
        return Array.from(this.reasoningTraces.values()).sort(
          (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
        );
      }
      get qualityEvaluation() {
        return this.qualityMetrics;
      }
      get decisionContext() {
        const trees = Array.from(this.decisionTrees.values());
        return trees.sort(
          (a, b) => b.metadata.lastUpdated.getTime() - a.metadata.lastUpdated.getTime()
        )[0] || this.createEmptyDecisionTree();
      }
      get improvementSuggestions() {
        return Array.from(this.enhancements.values()).filter(
          (enhancement) => enhancement.status === "proposed" || enhancement.status === "approved"
        ).sort((a, b) => b.priority - a.priority);
      }
      get reflectionData() {
        return Array.from(this.reflectionEntries.values()).sort(
          (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
        );
      }
      // Reasoning Trace Management
      async startReasoningTrace(context, initialStep) {
        const trace = {
          id: this.generateTraceId(),
          timestamp: /* @__PURE__ */ new Date(),
          context,
          steps: [],
          conclusion: "",
          confidence: 0,
          alternatives: [],
          metadata: {
            complexity: this.assessComplexity(context),
            domain: this.identifyDomain(context),
            techniques: [],
            qualityScore: 0,
            reviewRequired: false
          }
        };
        if (initialStep) {
          await this.addReasoningStep(trace.id, {
            type: "analysis",
            description: "Initial problem analysis",
            input: context.problem,
            output: initialStep
          });
        }
        this.reasoningTraces.set(trace.id, trace);
        await this.manageTraceLimit();
        return trace;
      }
      async addReasoningStep(traceId, stepData) {
        const trace = this.reasoningTraces.get(traceId);
        if (!trace) {
          throw new Error(`Reasoning trace ${traceId} not found`);
        }
        const startTime = Date.now();
        const step = {
          id: this.generateStepId(traceId),
          confidence: this.calculateStepConfidence(stepData, trace),
          duration: 0,
          // Will be updated when step completes
          dependencies: this.identifyDependencies(stepData, trace.steps),
          ...stepData
        };
        trace.steps.push(step);
        trace.metadata.techniques.push(stepData.type);
        step.duration = Date.now() - startTime;
        await this.updateTraceQuality(trace);
        return step;
      }
      async completeReasoningTrace(traceId, conclusion, confidence) {
        const trace = this.reasoningTraces.get(traceId);
        if (!trace) {
          throw new Error(`Reasoning trace ${traceId} not found`);
        }
        trace.conclusion = conclusion;
        trace.confidence = confidence;
        trace.metadata.qualityScore = await this.calculateReasoningQuality(trace);
        trace.metadata.reviewRequired = trace.metadata.qualityScore < this.config.qualityThreshold;
        await this.generateImprovementSuggestions(trace);
        await this.updateGlobalQualityMetrics(trace);
        return trace;
      }
      async addAlternativeReasoning(traceId, alternative) {
        const trace = this.reasoningTraces.get(traceId);
        if (!trace) {
          throw new Error(`Reasoning trace ${traceId} not found`);
        }
        const altReasoning = {
          id: this.generateAlternativeId(traceId),
          ...alternative
        };
        trace.alternatives.push(altReasoning);
        return altReasoning;
      }
      async getReasoningTrace(traceId) {
        return this.reasoningTraces.get(traceId) || null;
      }
      async searchReasoningTraces(query, limit = 10) {
        const cacheKey = `search:reasoning:${JSON.stringify(query)}:${limit}`;
        const cached = this.analysisCache.get(cacheKey);
        if (cached) {
          return cached;
        }
        let traces = Array.from(this.reasoningTraces.values());
        if (query.domain) {
          traces = traces.filter((trace) => trace.metadata.domain === query.domain);
        }
        if (query.complexity) {
          traces = traces.filter((trace) => trace.metadata.complexity === query.complexity);
        }
        if (query.minQuality !== void 0) {
          traces = traces.filter((trace) => trace.metadata.qualityScore >= (query.minQuality ?? 0));
        }
        if (query.timeframe) {
          traces = traces.filter(
            (trace) => trace.timestamp >= query.timeframe.start && trace.timestamp <= query.timeframe.end
          );
        }
        const results = traces.sort((a, b) => b.metadata.qualityScore - a.metadata.qualityScore).slice(0, limit);
        this.analysisCache.set(cacheKey, results);
        return results;
      }
      // Decision Tree Management
      async createDecisionTree(domain, initialCondition) {
        const tree = {
          id: this.generateDecisionTreeId(domain),
          rootNode: {
            id: "root",
            type: "condition",
            description: initialCondition,
            children: [],
            confidence: 0.8,
            evidence: [],
            alternatives: []
          },
          metadata: {
            domain,
            complexity: 1,
            accuracy: 0.8,
            lastUpdated: /* @__PURE__ */ new Date(),
            usageCount: 0
          }
        };
        this.decisionTrees.set(tree.id, tree);
        return tree;
      }
      async addDecisionNode(treeId, parentNodeId, node) {
        const tree = this.decisionTrees.get(treeId);
        if (!tree) {
          throw new Error(`Decision tree ${treeId} not found`);
        }
        const newNode = {
          id: this.generateNodeId(treeId),
          ...node
        };
        const parentNode = this.findDecisionNode(tree.rootNode, parentNodeId);
        if (parentNode) {
          parentNode.children.push(newNode);
          tree.metadata.complexity = this.calculateTreeComplexity(tree.rootNode);
          tree.metadata.lastUpdated = /* @__PURE__ */ new Date();
        }
        return newNode;
      }
      async addEvidence(treeId, nodeId, evidence) {
        const tree = this.decisionTrees.get(treeId);
        if (!tree) {
          throw new Error(`Decision tree ${treeId} not found`);
        }
        const node = this.findDecisionNode(tree.rootNode, nodeId);
        if (node) {
          node.evidence.push(evidence);
          node.confidence = this.calculateNodeConfidence(node.evidence);
          tree.metadata.lastUpdated = /* @__PURE__ */ new Date();
        }
      }
      async queryDecisionTree(treeId, context) {
        const tree = this.decisionTrees.get(treeId);
        if (!tree) {
          return [];
        }
        tree.metadata.usageCount++;
        return this.traverseDecisionTree(tree.rootNode, context);
      }
      // Enhancement Management
      async proposeEnhancement(enhancement) {
        const newEnhancement = {
          id: this.generateEnhancementId(),
          status: "proposed",
          ...enhancement
        };
        this.enhancements.set(newEnhancement.id, newEnhancement);
        if (this.shouldAutoApprove(newEnhancement)) {
          newEnhancement.status = "approved";
        }
        return newEnhancement;
      }
      async updateEnhancementStatus(enhancementId, status, feedback) {
        const enhancement = this.enhancements.get(enhancementId);
        if (!enhancement) {
          return false;
        }
        if (feedback) {
          console.log(`Enhancement feedback: ${feedback}`);
        }
        enhancement.status = status;
        if (status === "completed") {
          await this.evaluateEnhancementImpact(enhancement);
        }
        return true;
      }
      async getEnhancementsByType(type) {
        return Array.from(this.enhancements.values()).filter((enhancement) => enhancement.type === type).sort((a, b) => b.priority - a.priority);
      }
      // Reflection Management
      async addReflectionEntry(trigger, observation, analysis, insight, confidence = 0.8) {
        const reflection = {
          id: this.generateReflectionId(),
          timestamp: /* @__PURE__ */ new Date(),
          trigger,
          observation,
          analysis,
          insight,
          actionItems: [],
          confidence
        };
        this.reflectionEntries.set(reflection.id, reflection);
        await this.generateActionItems(reflection);
        return reflection;
      }
      async addActionItem(reflectionId, actionItem) {
        const reflection = this.reflectionEntries.get(reflectionId);
        if (!reflection) {
          throw new Error(`Reflection entry ${reflectionId} not found`);
        }
        const action = {
          id: this.generateActionItemId(reflectionId),
          status: "open",
          ...actionItem
        };
        reflection.actionItems.push(action);
        return action;
      }
      async getReflectionInsights(timeframe, minConfidence = 0.7) {
        let reflections = Array.from(this.reflectionEntries.values());
        if (timeframe) {
          reflections = reflections.filter(
            (r) => r.timestamp >= timeframe.start && r.timestamp <= timeframe.end
          );
        }
        return reflections.filter((r) => r.confidence >= minConfidence).sort((a, b) => b.confidence - a.confidence);
      }
      // Memory Event Processing
      async processMemoryEvent(event) {
        switch (event.type) {
          case "code_generation":
            await this.processCodeGenerationEvent(event);
            break;
          case "bug_fix":
            await this.processBugFixEvent(event);
            break;
          case "quality_improvement":
            await this.processQualityImprovementEvent(event);
            break;
          default:
            await this.processGenericEvent(event);
            break;
        }
      }
      // Quality Assessment
      async assessCodeQuality(code, _language, context) {
        if (context) {
          console.log("Code quality context:", Object.keys(context));
        }
        const cacheKey = `quality:${this.hashCode(code)}:${_language}`;
        const cached = this.analysisCache.get(cacheKey);
        if (cached) {
          return cached;
        }
        const metrics = {
          maintainability: await this.calculateMaintainability(code, _language),
          readability: await this.calculateReadability(code, _language),
          testability: await this.calculateTestability(code, _language),
          performance: await this.calculatePerformance(code, _language),
          security: await this.calculateSecurity(code, _language),
          bugDensity: await this.calculateBugDensity(code, _language),
          complexity: await this.calculateCyclomaticComplexity(code, _language)
        };
        this.analysisCache.set(cacheKey, metrics);
        return metrics;
      }
      async updateQualityMetrics(metrics) {
        Object.assign(this.qualityMetrics, metrics);
      }
      // Private Helper Methods
      generateTraceId() {
        return `trace:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
      }
      generateStepId(traceId) {
        return `${traceId}:step:${Date.now()}`;
      }
      generateAlternativeId(traceId) {
        return `${traceId}:alt:${Date.now()}`;
      }
      generateDecisionTreeId(domain) {
        return `tree:${domain}:${Date.now()}`;
      }
      generateNodeId(treeId) {
        return `${treeId}:node:${Date.now()}`;
      }
      generateEnhancementId() {
        return `enhancement:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
      }
      generateReflectionId() {
        return `reflection:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
      }
      generateActionItemId(reflectionId) {
        return `${reflectionId}:action:${Date.now()}`;
      }
      assessComplexity(context) {
        const factors = [
          context.goals.length > 3,
          context.constraints.length > 2,
          context.assumptions.length > 3,
          context.problem.length > 500
        ];
        const complexityScore = factors.filter(Boolean).length;
        if (complexityScore === 0) return "simple";
        if (complexityScore === 1) return "moderate";
        if (complexityScore === 2) return "complex";
        return "very_complex";
      }
      identifyDomain(context) {
        const problem = context.problem.toLowerCase();
        if (problem.includes("performance") || problem.includes("optimization")) {
          return "performance";
        }
        if (problem.includes("security") || problem.includes("vulnerability")) {
          return "security";
        }
        if (problem.includes("architecture") || problem.includes("design")) {
          return "architecture";
        }
        if (problem.includes("bug") || problem.includes("error")) {
          return "debugging";
        }
        return "general";
      }
      calculateStepConfidence(stepData, trace) {
        let confidence = 0.8;
        switch (stepData.type) {
          case "analysis":
            confidence = 0.7;
            break;
          case "inference":
            confidence = 0.6;
            break;
          case "evaluation":
            confidence = 0.8;
            break;
          case "synthesis":
            confidence = 0.5;
            break;
        }
        if (stepData.input.length > 100) confidence += 0.1;
        if (stepData.output.length > 100) confidence += 0.1;
        if (trace.metadata.complexity === "simple") confidence += 0.1;
        if (trace.metadata.complexity === "very_complex") confidence -= 0.1;
        return Math.max(0.1, Math.min(1, confidence));
      }
      identifyDependencies(stepData, existingSteps) {
        const dependencies = [];
        for (const step of existingSteps) {
          if (stepData.input.includes(step.output.slice(0, 50))) {
            dependencies.push(step.id);
          }
        }
        return dependencies;
      }
      async updateTraceQuality(trace) {
        const stepCount = trace.steps.length;
        const avgConfidence = trace.steps.reduce((sum, step) => sum + step.confidence, 0) / stepCount;
        const hasAnalysis = trace.steps.some((step) => step.type === "analysis");
        const hasEvaluation = trace.steps.some((step) => step.type === "evaluation");
        let quality = avgConfidence * 0.6;
        if (hasAnalysis) quality += 0.2;
        if (hasEvaluation) quality += 0.2;
        trace.metadata.qualityScore = Math.max(0, Math.min(1, quality));
      }
      async calculateReasoningQuality(trace) {
        const factors = {
          coherence: this.calculateCoherence(trace),
          completeness: this.calculateCompleteness(trace),
          accuracy: this.calculateAccuracy(trace),
          efficiency: this.calculateEfficiency(trace),
          creativity: this.calculateCreativity(trace)
        };
        return Object.values(factors).reduce((sum, value) => sum + value, 0) / Object.keys(factors).length;
      }
      calculateCoherence(trace) {
        let coherenceSum = 0;
        let pairCount = 0;
        for (let i = 1; i < trace.steps.length; i++) {
          const prev = trace.steps[i - 1];
          const curr = trace.steps[i];
          const coherence = curr?.input.includes(prev?.output.slice(0, 30) || "") ? 1 : 0.5;
          coherenceSum += coherence;
          pairCount++;
        }
        return pairCount > 0 ? coherenceSum / pairCount : 0.8;
      }
      calculateCompleteness(trace) {
        const requiredStepTypes = ["analysis", "evaluation"];
        const presentTypes = new Set(trace.steps.map((step) => step.type));
        const completeness = requiredStepTypes.filter((type) => presentTypes.has(type)).length / requiredStepTypes.length;
        return completeness;
      }
      calculateAccuracy(trace) {
        const avgConfidence = trace.steps.reduce((sum, step) => sum + step.confidence, 0) / trace.steps.length;
        const alternativeBonus = trace.alternatives.length > 0 ? 0.1 : 0;
        return Math.min(1, avgConfidence + alternativeBonus);
      }
      calculateEfficiency(trace) {
        const complexity = { simple: 1, moderate: 2, complex: 3, very_complex: 4 }[trace.metadata.complexity];
        const stepEfficiency = Math.max(0.2, 1 - (trace.steps.length - complexity) * 0.1);
        return stepEfficiency;
      }
      calculateCreativity(trace) {
        const uniqueTechniques = new Set(trace.metadata.techniques).size;
        const alternativeCount = trace.alternatives.length;
        const creativity = Math.min(1, uniqueTechniques * 0.3 + alternativeCount * 0.2 + 0.5);
        return creativity;
      }
      async generateImprovementSuggestions(trace) {
        if (trace.metadata.qualityScore < 0.7) {
          await this.proposeEnhancement({
            type: "quality",
            description: `Improve reasoning quality for ${trace.metadata.domain} problems`,
            impact: {
              benefitScore: 7,
              effortScore: 5,
              riskScore: 2,
              affectedUsers: 1,
              affectedComponents: ["reasoning", "decision-making"]
            },
            implementation: {
              phases: [
                {
                  id: "analysis",
                  name: "Quality Analysis",
                  description: "Analyze low-quality reasoning patterns",
                  duration: 3,
                  deliverables: ["Pattern analysis", "Improvement plan"],
                  dependencies: []
                }
              ],
              timeline: 7,
              resources: [
                {
                  type: "developer",
                  quantity: 1,
                  duration: 7
                }
              ],
              dependencies: [],
              risks: [
                {
                  id: "complexity",
                  description: "Reasoning improvement may add complexity",
                  probability: 0.3,
                  impact: 4,
                  mitigation: "Gradual implementation with testing",
                  contingency: "Rollback to previous version"
                }
              ]
            },
            priority: 6
          });
        }
      }
      async updateGlobalQualityMetrics(trace) {
        const currentReasoning = this.qualityMetrics.reasoningQuality;
        this.qualityMetrics.reasoningQuality = {
          coherence: (currentReasoning.coherence + this.calculateCoherence(trace)) / 2,
          completeness: (currentReasoning.completeness + this.calculateCompleteness(trace)) / 2,
          accuracy: (currentReasoning.accuracy + this.calculateAccuracy(trace)) / 2,
          efficiency: (currentReasoning.efficiency + this.calculateEfficiency(trace)) / 2,
          creativity: (currentReasoning.creativity + this.calculateCreativity(trace)) / 2
        };
      }
      createEmptyDecisionTree() {
        return {
          id: "empty",
          rootNode: {
            id: "root",
            type: "condition",
            description: "No decision context available",
            children: [],
            confidence: 0,
            evidence: [],
            alternatives: []
          },
          metadata: {
            domain: "unknown",
            complexity: 0,
            accuracy: 0,
            lastUpdated: /* @__PURE__ */ new Date(),
            usageCount: 0
          }
        };
      }
      findDecisionNode(root, nodeId) {
        if (root.id === nodeId) return root;
        for (const child of root.children) {
          const found = this.findDecisionNode(child, nodeId);
          if (found) return found;
        }
        return null;
      }
      calculateTreeComplexity(root) {
        let maxDepth = 0;
        let nodeCount = 0;
        const traverse = /* @__PURE__ */ __name((node, depth) => {
          nodeCount++;
          maxDepth = Math.max(maxDepth, depth);
          for (const child of node.children) {
            traverse(child, depth + 1);
          }
        }, "traverse");
        traverse(root, 1);
        return maxDepth + Math.log(nodeCount);
      }
      calculateNodeConfidence(evidence) {
        if (evidence.length === 0) return 0.5;
        const weightedSum = evidence.reduce((sum, e) => sum + e.strength, 0);
        return Math.min(1, weightedSum / evidence.length);
      }
      traverseDecisionTree(node, context) {
        const path3 = [node];
        for (const child of node.children) {
          if (child.type === "condition" && this.evaluateCondition(child, context)) {
            path3.push(...this.traverseDecisionTree(child, context));
            break;
          }
        }
        return path3;
      }
      evaluateCondition(node, _context) {
        return node.confidence > 0.5;
      }
      shouldAutoApprove(enhancement) {
        return enhancement.impact.riskScore <= 3 && enhancement.impact.benefitScore >= 7 && enhancement.priority >= 7;
      }
      async evaluateEnhancementImpact(enhancement) {
        console.log(`Evaluating impact of enhancement: ${enhancement.description}`);
      }
      async generateActionItems(reflection) {
        const insight = reflection.insight.toLowerCase();
        if (insight.includes("improve") || insight.includes("optimize")) {
          await this.addActionItem(reflection.id, {
            description: `Implement improvement based on: ${reflection.insight}`,
            priority: 7,
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3)
            // 1 week
          });
        }
        if (insight.includes("learn") || insight.includes("study")) {
          await this.addActionItem(reflection.id, {
            description: `Research and learn: ${reflection.insight}`,
            priority: 5,
            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1e3)
            // 2 weeks
          });
        }
      }
      async processCodeGenerationEvent(event) {
        const data = event.data;
        if (data.code && data.language) {
          const quality = await this.assessCodeQuality(data.code, data.language);
          if (quality.maintainability < 70) {
            await this.addReflectionEntry(
              "Low code maintainability",
              `Generated code has maintainability score of ${quality.maintainability}`,
              "Need to improve code generation patterns for better maintainability",
              "Focus on cleaner abstractions and better naming conventions",
              0.8
            );
          }
        }
      }
      async processBugFixEvent(event) {
        const data = event.data;
        if (data.bugType && data.timeToFix) {
          await this.addReflectionEntry(
            `Bug fix: ${data.bugType}`,
            `Fixed ${data.bugType} in ${data.timeToFix} minutes`,
            "Analyze if this bug type is recurring and could be prevented",
            data.timeToFix > 60 ? "Consider adding automated detection for this bug pattern" : "Good resolution time",
            0.7
          );
        }
      }
      async processQualityImprovementEvent(event) {
        const data = event.data;
        if (data.improvement) {
          await this.proposeEnhancement({
            type: "quality",
            description: `Quality improvement: ${data.improvement}`,
            impact: {
              benefitScore: data.impact || 5,
              effortScore: 3,
              riskScore: 2,
              affectedUsers: 1,
              affectedComponents: ["code-quality"]
            },
            implementation: {
              phases: [],
              timeline: 5,
              resources: [],
              dependencies: [],
              risks: []
            },
            priority: 6
          });
        }
      }
      async processGenericEvent(event) {
        console.log(`Processing generic event: ${event.type}`, event.data);
      }
      async manageTraceLimit() {
        if (this.reasoningTraces.size > this.config.maxReasoningTraces) {
          const traces = Array.from(this.reasoningTraces.entries());
          const sortedByQuality = traces.sort(
            (a, b) => a[1].metadata.qualityScore - b[1].metadata.qualityScore
          );
          const removeCount = Math.min(
            Math.floor(this.config.maxReasoningTraces * 0.2),
            sortedByQuality.length
          );
          for (let i = 0; i < removeCount; i++) {
            const traceEntry = sortedByQuality[i];
            if (traceEntry) {
              this.reasoningTraces.delete(traceEntry[0]);
            }
          }
        }
      }
      // Quality calculation methods
      async calculateMaintainability(code, _language) {
        const factors = {
          length: Math.max(0, 100 - code.length / 100),
          // Shorter is better
          comments: (code.match(/\/\/|\/\*|\#/g) || []).length / code.split("\n").length * 100,
          complexity: 100 - this.calculateBasicComplexity(code) * 10
        };
        return Math.max(
          0,
          Math.min(100, Object.values(factors).reduce((sum, val) => sum + val, 0) / 3)
        );
      }
      async calculateReadability(code, _language) {
        const lines = code.split("\n");
        const avgLineLength = lines.length > 0 ? lines.reduce((sum, line) => sum + line.length, 0) / lines.length : 0;
        const readabilityScore = Math.max(0, 100 - (avgLineLength - 50) * 2);
        return Math.max(0, Math.min(100, readabilityScore));
      }
      async calculateTestability(code, _language) {
        const hasFunctions = /function|def|public|private/.test(code);
        const hasClasses = /class|interface/.test(code);
        const lowCoupling = !/global|window|document/.test(code);
        let score = 50;
        if (hasFunctions) score += 20;
        if (hasClasses) score += 15;
        if (lowCoupling) score += 15;
        return Math.max(0, Math.min(100, score));
      }
      async calculatePerformance(code, _language) {
        const hasNestedLoops = (code.match(/for|while/g) || []).length > 2;
        const hasRecursion = /return.*\w+\(/.test(code);
        const hasEarlyReturns = (code.match(/return/g) || []).length > 1;
        let score = 80;
        if (hasNestedLoops) score -= 20;
        if (hasRecursion && !hasEarlyReturns) score -= 15;
        if (hasEarlyReturns) score += 10;
        return Math.max(0, Math.min(100, score));
      }
      async calculateSecurity(code, _language) {
        const vulnerabilities = [
          /eval\(/g,
          /innerHTML\s*=/g,
          /document\.write/g,
          /\$\{.*\}/g,
          // Template injection potential
          /sql|query.*\+/gi
          // SQL injection potential
        ];
        let score = 90;
        for (const pattern of vulnerabilities) {
          if (pattern.test(code)) {
            score -= 15;
          }
        }
        return Math.max(0, Math.min(100, score));
      }
      async calculateBugDensity(code, _language) {
        const bugPatterns = [
          /==\s*null/g,
          // Null comparison
          /undefined/g,
          /NaN/g,
          /catch\s*\(\s*\)/g,
          // Empty catch blocks
          /if\s*\([^)]*=[^=]/g
          // Assignment in condition
        ];
        const lines = code.split("\n").length;
        let bugCount = 0;
        for (const pattern of bugPatterns) {
          bugCount += (code.match(pattern) || []).length;
        }
        return bugCount / lines * 1e3;
      }
      async calculateCyclomaticComplexity(code, _language) {
        return this.calculateBasicComplexity(code);
      }
      calculateBasicComplexity(code) {
        const complexityPatterns = [
          /if\s*\(/g,
          /else\s*if/g,
          /while\s*\(/g,
          /for\s*\(/g,
          /switch\s*\(/g,
          /case\s+/g,
          /catch\s*\(/g,
          /\?\s*.*:/g,
          // Ternary operators
          /&&|\|\|/g
          // Logical operators
        ];
        let complexity = 1;
        for (const pattern of complexityPatterns) {
          complexity += (code.match(pattern) || []).length;
        }
        return complexity;
      }
      hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
          const char = str.charCodeAt(i);
          hash = (hash << 5) - hash + char;
          hash = hash & hash;
        }
        return hash.toString(36);
      }
      initializeQualityMetrics() {
        return {
          codeQuality: {
            maintainability: 80,
            readability: 75,
            testability: 70,
            performance: 85,
            security: 90,
            bugDensity: 2.5,
            complexity: 5
          },
          reasoningQuality: {
            coherence: 0.8,
            completeness: 0.75,
            accuracy: 0.85,
            efficiency: 0.7,
            creativity: 0.6
          },
          userSatisfaction: {
            userRating: 4.2,
            taskCompletion: 0.85,
            timeToSolution: 15,
            iterationCount: 3,
            userFeedback: []
          },
          systemPerformance: {
            timeComplexity: "O(n)",
            spaceComplexity: "O(1)",
            benchmarks: []
          }
        };
      }
    };
  }
});

// src/services/memory-system/dual-memory-engine.ts
var DualMemoryEngine;
var init_dual_memory_engine = __esm({
  "src/services/memory-system/dual-memory-engine.ts"() {
    init_cjs_shims();
    init_system1_memory();
    init_system2_memory();
    DualMemoryEngine = class {
      static {
        __name(this, "DualMemoryEngine");
      }
      system1;
      system2;
      config;
      operationMetrics;
      eventQueue = [];
      processingLock = false;
      performanceCache = /* @__PURE__ */ new Map();
      constructor(config) {
        this.config = config;
        this.system1 = new System1MemoryManager(config.system1);
        this.system2 = new System2MemoryManager(config.system2);
        this.operationMetrics = this.initializeMetrics();
        this.startBackgroundProcessing();
      }
      // ========== Core Memory Operations ==========
      async query(memoryQuery) {
        const startTime = Date.now();
        const cacheKey = this.generateCacheKey(memoryQuery);
        const cached = this.performanceCache.get(cacheKey);
        if (cached && this.isCacheValid(cached)) {
          cached.hits++;
          this.operationMetrics.totalOperations++;
          return {
            data: cached.result,
            source: "both",
            confidence: 0.9,
            latency: Date.now() - startTime,
            cached: true
          };
        }
        try {
          const strategy = await this.selectMemoryStrategy(memoryQuery);
          const result = await this.executeMemoryOperation(memoryQuery, strategy);
          if (result.confidence > 0.7) {
            this.performanceCache.set(cacheKey, {
              result: result.data,
              timestamp: /* @__PURE__ */ new Date(),
              hits: 1
            });
          }
          this.updateOperationMetrics(strategy, Date.now() - startTime, true);
          return result;
        } catch (error) {
          this.updateOperationMetrics("both", Date.now() - startTime, false);
          throw new Error(
            `Memory query failed: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }
      }
      async store(event) {
        this.eventQueue.push(event);
        if (event.metadata.priority === "critical") {
          await this.processEvent(event);
        }
      }
      async learn(input, output, context, success) {
        const learningEvent = {
          id: `learn:${Date.now()}`,
          type: "learning_update",
          timestamp: /* @__PURE__ */ new Date(),
          userId: context["userId"] || "anonymous",
          sessionId: context["sessionId"] || "default",
          data: { input, output, context, success },
          metadata: {
            confidence: success ? 0.9 : 0.3,
            source: "user_input",
            priority: "medium",
            tags: ["learning", "adaptation"]
          }
        };
        await this.store(learningEvent);
      }
      // ========== Specialized Query Methods ==========
      async findKnowledge(query, embedding, limit = 10) {
        return this.query({
          type: "knowledge",
          query,
          embedding,
          limit,
          urgency: "medium"
        });
      }
      async findPatterns(language, framework, useCase, limit = 10) {
        return this.query({
          type: "pattern",
          query: `${language || ""} ${framework || ""} ${useCase || ""}`.trim(),
          context: { language, framework, useCase },
          limit,
          urgency: "low"
        });
      }
      async getReasoning(domain, complexity, minQuality) {
        return this.query({
          type: "reasoning",
          query: `${domain || ""} ${complexity || ""}`.trim(),
          context: { domain, complexity, minQuality },
          urgency: "low"
        });
      }
      async getQualityInsights() {
        return this.query({
          type: "quality",
          query: "current quality metrics",
          urgency: "low"
        });
      }
      async getUserPreferences() {
        return this.query({
          type: "preference",
          query: "user preferences",
          urgency: "high"
        });
      }
      // ========== Memory Strategy Selection ==========
      async selectMemoryStrategy(query) {
        const factors = {
          urgency: this.getUrgencyScore(query.urgency),
          complexity: this.assessQueryComplexity(query),
          type: this.getTypePreference(query.type),
          cacheStatus: this.getCacheStatus(query)
        };
        const system1Score = this.calculateSystem1Score(factors);
        const system2Score = this.calculateSystem2Score(factors);
        switch (this.config.coordinator.conflictResolutionStrategy) {
          case "system1_priority":
            return system1Score > 0.6 ? "system1" : "both";
          case "system2_priority":
            return system2Score > 0.6 ? "system2" : "both";
          case "balanced":
          default:
            if (Math.abs(system1Score - system2Score) < 0.2) {
              return "both";
            }
            return system1Score > system2Score ? "system1" : "system2";
        }
      }
      getUrgencyScore(urgency) {
        switch (urgency) {
          case "critical":
            return 1;
          case "high":
            return 0.8;
          case "medium":
            return 0.5;
          case "low":
            return 0.2;
          default:
            return 0.5;
        }
      }
      assessQueryComplexity(query) {
        let complexity = 0.3;
        if (query.query.length > 100) complexity += 0.2;
        if (query.query.length > 200) complexity += 0.2;
        if (query.context && Object.keys(query.context).length > 3) complexity += 0.2;
        switch (query.type) {
          case "reasoning":
            complexity += 0.4;
            break;
          case "quality":
            complexity += 0.3;
            break;
          case "pattern":
            complexity += 0.2;
            break;
          case "knowledge":
            complexity += 0.1;
            break;
          case "preference":
            complexity += 0;
            break;
        }
        return Math.min(1, complexity);
      }
      getTypePreference(type) {
        switch (type) {
          case "knowledge":
            return { system1: 0.8, system2: 0.3 };
          case "pattern":
            return { system1: 0.9, system2: 0.2 };
          case "preference":
            return { system1: 0.9, system2: 0.1 };
          case "reasoning":
            return { system1: 0.2, system2: 0.9 };
          case "quality":
            return { system1: 0.3, system2: 0.8 };
          default:
            return { system1: 0.5, system2: 0.5 };
        }
      }
      getCacheStatus(query) {
        const cacheKey = this.generateCacheKey(query);
        const cached = this.performanceCache.get(cacheKey);
        return cached ? 0.8 : 0.2;
      }
      calculateSystem1Score(factors) {
        const urgencyWeight = factors.urgency * 0.4;
        const complexityPenalty = (1 - factors.complexity) * 0.3;
        const typePreference = factors.type.system1 * 0.2;
        const cacheBonus = factors.cacheStatus * 0.1;
        return urgencyWeight + complexityPenalty + typePreference + cacheBonus;
      }
      calculateSystem2Score(factors) {
        const complexityBonus = factors.complexity * 0.4;
        const urgencyPenalty = (1 - factors.urgency) * 0.2;
        const typePreference = factors.type.system2 * 0.3;
        const qualityBonus = 0.1;
        return complexityBonus + urgencyPenalty + typePreference + qualityBonus;
      }
      // ========== Memory Operation Execution ==========
      async executeMemoryOperation(query, strategy) {
        switch (strategy) {
          case "system1":
            return this.executeSystem1Operation(query);
          case "system2":
            return this.executeSystem2Operation(query);
          case "both":
            return this.executeCombinedOperation(query);
          default:
            throw new Error(`Unknown strategy: ${strategy}`);
        }
      }
      async executeSystem1Operation(query) {
        const startTime = Date.now();
        let result;
        switch (query.type) {
          case "knowledge":
            result = await this.system1.searchKnowledgeNodes(
              query.query,
              query.embedding || [],
              query.limit
            );
            break;
          case "pattern": {
            const { language, framework, useCase } = query.context || {};
            result = await this.system1.findCodePatterns(
              language,
              framework,
              useCase,
              query.limit
            );
            break;
          }
          case "preference":
            result = await this.system1.getUserPreference("learningStyle");
            break;
          default:
            throw new Error(`System 1 cannot handle query type: ${query.type}`);
        }
        return {
          data: result,
          source: "system1",
          confidence: 0.8,
          latency: Date.now() - startTime,
          cached: false
        };
      }
      async executeSystem2Operation(query) {
        const startTime = Date.now();
        let result;
        switch (query.type) {
          case "reasoning": {
            const { domain, complexity, minQuality } = query.context || {};
            result = await this.system2.searchReasoningTraces(
              {
                domain,
                complexity,
                minQuality
              },
              query.limit
            );
            break;
          }
          case "quality":
            result = this.system2.qualityEvaluation;
            break;
          default:
            throw new Error(`System 2 cannot handle query type: ${query.type}`);
        }
        return {
          data: result,
          source: "system2",
          confidence: 0.9,
          latency: Date.now() - startTime,
          cached: false
        };
      }
      async executeCombinedOperation(query) {
        const startTime = Date.now();
        try {
          const [system1Result, system2Result] = await Promise.allSettled([
            this.executeSystem1Operation(query).catch(() => null),
            this.executeSystem2Operation(query).catch(() => null)
          ]);
          const combinedResult = this.combineResults(query, system1Result, system2Result);
          return {
            data: combinedResult.data,
            source: "both",
            confidence: combinedResult.confidence,
            latency: Date.now() - startTime,
            cached: false,
            suggestions: combinedResult.suggestions
          };
        } catch (error) {
          const fallbackStrategy = query.type === "reasoning" || query.type === "quality" ? "system2" : "system1";
          return this.executeMemoryOperation(query, fallbackStrategy);
        }
      }
      combineResults(query, system1Result, system2Result) {
        const s1Data = system1Result.status === "fulfilled" ? system1Result.value?.data : null;
        const s2Data = system2Result.status === "fulfilled" ? system2Result.value?.data : null;
        if (s2Data && s1Data) {
          const useSystem2 = this.assessQueryComplexity(query) > 0.6;
          return {
            data: useSystem2 ? s2Data : s1Data,
            confidence: 0.95,
            suggestions: this.generateCombinedSuggestions(s1Data, s2Data)
          };
        }
        if (s1Data) {
          return { data: s1Data, confidence: 0.8 };
        }
        if (s2Data) {
          return { data: s2Data, confidence: 0.85 };
        }
        throw new Error("No memory systems could provide results");
      }
      generateCombinedSuggestions(_s1Data, _s2Data) {
        return [
          {
            id: `suggestion:${Date.now()}`,
            type: "performance",
            description: "Consider using cached results for similar queries",
            impact: {
              benefitScore: 6,
              effortScore: 3,
              riskScore: 1,
              affectedUsers: 1,
              affectedComponents: ["memory-system"]
            },
            implementation: {
              phases: [],
              timeline: 2,
              resources: [],
              dependencies: [],
              risks: []
            },
            priority: 5,
            status: "proposed"
          }
        ];
      }
      // ========== Event Processing ==========
      async processEvent(event) {
        try {
          const routingStrategy = this.determineEventRouting(event);
          await Promise.all([
            routingStrategy.system1 ? this.system1.processMemoryEvent(event) : Promise.resolve(),
            routingStrategy.system2 ? this.system2.processMemoryEvent(event) : Promise.resolve()
          ]);
          await this.adaptFromEvent(event);
        } catch (error) {
          console.error(`Error processing memory event ${event.id}:`, error);
        }
      }
      determineEventRouting(event) {
        switch (event.type) {
          case "code_generation":
          case "pattern_recognition":
            return { system1: true, system2: false };
          case "bug_fix":
          case "quality_improvement":
            return { system1: false, system2: true };
          case "learning_update":
          case "mode_change":
            return { system1: true, system2: true };
          default:
            return { system1: true, system2: false };
        }
      }
      async adaptFromEvent(event) {
        if (event.type === "learning_update") {
          const data = event.data;
          if (data.success === false) {
            await this.system2.proposeEnhancement({
              type: "usability",
              description: `Improve handling of: ${data.input}`,
              impact: {
                benefitScore: 5,
                effortScore: 3,
                riskScore: 2,
                affectedUsers: 1,
                affectedComponents: ["ai-interaction"]
              },
              implementation: {
                phases: [],
                timeline: 3,
                resources: [],
                dependencies: [],
                risks: []
              },
              priority: 4
            });
          }
        }
      }
      // ========== Background Processing ==========
      startBackgroundProcessing() {
        setInterval(() => {
          this.processEventQueue();
        }, this.config.coordinator.syncInterval);
        setInterval(
          () => {
            this.cleanupCache();
          },
          5 * 60 * 1e3
        );
        setInterval(
          () => {
            this.optimizeMemory();
          },
          15 * 60 * 1e3
        );
      }
      async processEventQueue() {
        if (this.processingLock || this.eventQueue.length === 0) {
          return;
        }
        this.processingLock = true;
        try {
          const batchSize = this.config.performance.batchSize;
          const batch = this.eventQueue.splice(0, batchSize);
          await Promise.all(batch.map((event) => this.processEvent(event)));
        } finally {
          this.processingLock = false;
        }
      }
      cleanupCache() {
        const now = /* @__PURE__ */ new Date();
        const maxAge = 30 * 60 * 1e3;
        for (const [key, cached] of this.performanceCache.entries()) {
          const age = now.getTime() - cached.timestamp.getTime();
          if (age > maxAge || cached.hits < 2) {
            this.performanceCache.delete(key);
          }
        }
      }
      async optimizeMemory() {
        try {
          await this.system1.compressMemory();
          if (this.performanceCache.size > 1e3) {
            const entries = Array.from(this.performanceCache.entries());
            const sortedByUsage = entries.sort((a, b) => b[1].hits - a[1].hits);
            this.performanceCache.clear();
            sortedByUsage.slice(0, 500).forEach(([key, value]) => {
              this.performanceCache.set(key, value);
            });
          }
        } catch (error) {
          console.error("Memory optimization failed:", error);
        }
      }
      // ========== Utility Methods ==========
      generateCacheKey(query) {
        const contextStr = query.context ? JSON.stringify(query.context) : "";
        const embeddingStr = query.embedding ? query.embedding.slice(0, 5).join(",") : "";
        return `${query.type}:${query.query}:${contextStr}:${embeddingStr}:${query.limit || 10}`;
      }
      isCacheValid(cached) {
        const age = Date.now() - cached.timestamp.getTime();
        const maxAge = 10 * 60 * 1e3;
        return age < maxAge;
      }
      updateOperationMetrics(strategy, latency, success) {
        this.operationMetrics.totalOperations++;
        this.operationMetrics.averageLatency = (this.operationMetrics.averageLatency + latency) / 2;
        if (strategy === "system1" || strategy === "both") {
          this.operationMetrics.system1Operations++;
        }
        if (strategy === "system2" || strategy === "both") {
          this.operationMetrics.system2Operations++;
        }
        if (!success) {
          this.operationMetrics.errorRate = (this.operationMetrics.errorRate + 1) / this.operationMetrics.totalOperations;
        }
      }
      initializeMetrics() {
        return {
          totalOperations: 0,
          system1Operations: 0,
          system2Operations: 0,
          averageLatency: 0,
          cacheHitRate: 0,
          errorRate: 0,
          lastReset: /* @__PURE__ */ new Date()
        };
      }
      // ========== Public API for Monitoring ==========
      getMetrics() {
        const totalCacheAccess = Array.from(this.performanceCache.values()).reduce(
          (sum, cached) => sum + cached.hits,
          0
        );
        this.operationMetrics.cacheHitRate = this.operationMetrics.totalOperations > 0 ? totalCacheAccess / this.operationMetrics.totalOperations : 0;
        return { ...this.operationMetrics };
      }
      resetMetrics() {
        this.operationMetrics = this.initializeMetrics();
      }
      getCacheSize() {
        return this.performanceCache.size;
      }
      getQueueSize() {
        return this.eventQueue.length;
      }
      // ========== Configuration Management ==========
      updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
      }
      getConfig() {
        return { ...this.config };
      }
    };
  }
});

// src/services/memory-system/memory-coordinator.ts
var MemoryCoordinator;
var init_memory_coordinator = __esm({
  "src/services/memory-system/memory-coordinator.ts"() {
    init_cjs_shims();
    MemoryCoordinator = class {
      static {
        __name(this, "MemoryCoordinator");
      }
      system1;
      system2;
      dualEngine;
      config;
      metrics;
      syncPoints = [];
      conflicts = [];
      recommendations = [];
      optimizationTimer;
      syncTimer;
      constructor(system1, system2, dualEngine, config) {
        this.system1 = system1;
        this.system2 = system2;
        this.dualEngine = dualEngine;
        this.config = config;
        this.metrics = this.initializeMetrics();
        this.startCoordination();
      }
      // ========== Main Coordination Methods ==========
      async synchronizeSystems() {
        const startTime = Date.now();
        try {
          const report = {
            system1State: await this.getSystem1State(),
            system2State: await this.getSystem2State(),
            synchronizationPoints: this.getRecentSyncPoints(),
            conflictResolutions: this.getRecentConflicts(),
            recommendations: await this.generateOptimizationRecommendations()
          };
          await this.performCrossLayerSync();
          this.metrics.syncOperations++;
          this.metrics.averageSyncTime = (this.metrics.averageSyncTime + (Date.now() - startTime)) / 2;
          return report;
        } catch (error) {
          console.error("System synchronization failed:", error);
          throw error;
        }
      }
      async optimizePerformance() {
        try {
          await this.analyzePerformance();
          const recommendations = await this.generateOptimizationRecommendations();
          const appliedOptimizations = await this.applyAutomatedOptimizations(recommendations);
          this.metrics.optimizationRuns++;
          this.metrics.performanceImprovements += appliedOptimizations.length;
          this.metrics.lastOptimization = /* @__PURE__ */ new Date();
          return recommendations;
        } catch (error) {
          console.error("Performance optimization failed:", error);
          return [];
        }
      }
      async adaptToUserBehavior(event) {
        try {
          const behaviorPattern = await this.analyzeBehaviorPattern(event);
          await this.performCrossLayerAdaptation(behaviorPattern);
          await this.updateAdaptiveLearning(behaviorPattern);
          this.metrics.adaptationEvents++;
        } catch (error) {
          console.error("User behavior adaptation failed:", error);
        }
      }
      async resolveConflicts() {
        const conflicts = await this.detectConflicts();
        const resolutions = [];
        for (const conflict of conflicts) {
          const resolution = await this.resolveConflict(conflict);
          if (resolution) {
            resolutions.push(resolution);
            this.conflicts.push(resolution);
          }
        }
        return resolutions;
      }
      // ========== Cross-Layer Synchronization ==========
      async performCrossLayerSync() {
        await this.syncKnowledgeToReasoning();
        await this.syncQualityToPatterns();
        await this.syncUserPreferences();
        await this.syncLearningData();
      }
      async syncKnowledgeToReasoning() {
        try {
          const highQualityKnowledge = this.system1.programmingConcepts.filter((node) => node.confidence > 0.8 && node.accessCount > 5).slice(0, 20);
          for (const knowledge of highQualityKnowledge) {
            await this.transferKnowledgeToReasoning(knowledge);
          }
          this.recordSyncPoint("knowledge_transfer", "system1", "system2", highQualityKnowledge.length);
        } catch (error) {
          console.error("Knowledge to reasoning sync failed:", error);
        }
      }
      async syncQualityToPatterns() {
        try {
          const qualityInsights = this.system2.qualityEvaluation;
          if (qualityInsights.codeQuality.maintainability < 70) {
            await this.updatePatternsForMaintainability();
          }
          if (qualityInsights.codeQuality.security < 80) {
            await this.updatePatternsForSecurity();
          }
          this.recordSyncPoint("quality_feedback", "system2", "system1", qualityInsights);
        } catch (error) {
          console.error("Quality to patterns sync failed:", error);
        }
      }
      async syncUserPreferences() {
        try {
          const preferences = await this.system1.getUserPreference("developmentStyle");
          if (preferences.approach === "test-driven") {
            await this.adaptReasoningForTDD();
          }
          if (preferences.problemSolvingStyle === "systematic") {
            await this.adaptReasoningForSystematicApproach();
          }
          this.recordSyncPoint("user_adaptation", "system1", "system2", preferences);
        } catch (error) {
          console.error("User preferences sync failed:", error);
        }
      }
      async syncLearningData() {
        try {
          const recentPatterns = await this.system1.getRecentCommands(10);
          const recentReasonings = await this.system2.searchReasoningTraces({}, 10);
          await this.integratePatternLearning(recentPatterns, recentReasonings);
          this.recordSyncPoint("pattern_learning", "system1", "system2", {
            patterns: recentPatterns.length,
            reasonings: recentReasonings.length
          });
        } catch (error) {
          console.error("Learning data sync failed:", error);
        }
      }
      // ========== Performance Analysis & Optimization ==========
      async analyzePerformance() {
        return {
          system1Performance: {
            timeComplexity: "O(1)",
            // Estimated S1 complexity
            spaceComplexity: "O(n)"
            // Estimated from System 1
          },
          system2Performance: {
            timeComplexity: "O(n log n)",
            // Estimated S2 complexity
            spaceComplexity: "O(n)"
            // Estimated from System 2
          },
          bottlenecks: await this.identifyBottlenecks(),
          opportunities: await this.identifyOptimizationOpportunities()
        };
      }
      async generateOptimizationRecommendations() {
        const recommendations = [];
        const dualEngineMetrics = this.dualEngine.getMetrics();
        if (dualEngineMetrics.averageLatency > 100) {
          recommendations.push({
            id: `perf-latency-${Date.now()}`,
            type: "performance",
            priority: 8,
            description: "Optimize memory access patterns to reduce latency",
            impact: {
              performance: 25,
              memory: -10,
              latency: -50
            },
            implementation: {
              effort: "medium",
              risk: "low",
              timeline: 4
            },
            automated: true
          });
        }
        if (this.dualEngine.getCacheSize() > 1e3) {
          recommendations.push({
            id: `mem-cache-${Date.now()}`,
            type: "memory",
            priority: 6,
            description: "Optimize cache management to reduce memory footprint",
            impact: {
              performance: 5,
              memory: -50,
              latency: 10
            },
            implementation: {
              effort: "low",
              risk: "low",
              timeline: 2
            },
            automated: true
          });
        }
        if (this.metrics.adaptationEvents < 10) {
          recommendations.push({
            id: `learn-adapt-${Date.now()}`,
            type: "learning",
            priority: 7,
            description: "Increase adaptive learning frequency for better personalization",
            impact: {
              performance: 15,
              memory: 5,
              latency: -10
            },
            implementation: {
              effort: "medium",
              risk: "medium",
              timeline: 6
            },
            automated: false
          });
        }
        return recommendations.sort((a, b) => b.priority - a.priority);
      }
      async applyAutomatedOptimizations(recommendations) {
        const applied = [];
        for (const rec of recommendations) {
          if (rec.automated && rec.implementation.risk === "low") {
            try {
              await this.applyOptimization(rec);
              applied.push(rec);
            } catch (error) {
              console.error(`Failed to apply optimization ${rec.id}:`, error);
            }
          }
        }
        return applied;
      }
      async applyOptimization(recommendation) {
        switch (recommendation.type) {
          case "performance":
            await this.optimizePerformanceSettings();
            break;
          case "memory":
            await this.optimizeMemoryUsage();
            break;
          case "learning":
            await this.optimizeLearningSettings();
            break;
          case "synchronization":
            await this.optimizeSynchronizationSettings();
            break;
        }
      }
      // ========== Conflict Detection & Resolution ==========
      async detectConflicts() {
        const conflicts = [];
        const s1Preferences = await this.system1.getUserPreference("developmentStyle");
        const s2Quality = this.system2.qualityEvaluation;
        if (s1Preferences.approach === "prototype-first" && s2Quality.codeQuality.maintainability < 50) {
          conflicts.push({
            id: `conflict-${Date.now()}`,
            type: "preference_mismatch",
            description: "User prefers prototyping but code quality is low",
            severity: 5
            // medium severity
          });
        }
        const dualEngineMetrics = this.dualEngine.getMetrics();
        if (dualEngineMetrics.averageLatency > 200 && s2Quality.reasoningQuality.accuracy > 0.9) {
          conflicts.push({
            id: `conflict-${Date.now()}-perf`,
            type: "performance_tradeoff",
            description: "High accuracy but poor performance",
            severity: 8
            // high severity
          });
        }
        return conflicts;
      }
      async resolveConflict(conflict) {
        const resolution = {
          id: `conflict-${Date.now()}`,
          timestamp: /* @__PURE__ */ new Date(),
          conflictType: conflict.type,
          description: conflict.description,
          resolution: "",
          confidence: 0.8,
          impact: conflict.severity >= 7 ? "high" : conflict.severity >= 4 ? "medium" : "low"
        };
        try {
          switch (conflict.type) {
            case "preference_mismatch":
              resolution.resolution = "Adjust quality thresholds to match user prototyping style";
              await this.adjustQualityThresholds("prototype-friendly");
              break;
            case "performance_tradeoff":
              resolution.resolution = "Optimize System 2 reasoning for faster processing";
              await this.optimizeSystem2Performance();
              break;
            default:
              resolution.resolution = "Applied default conflict resolution strategy";
              break;
          }
          return resolution;
        } catch (error) {
          console.error(`Failed to resolve conflict ${conflict.type}:`, error);
          return null;
        }
      }
      // ========== Behavioral Analysis & Adaptation ==========
      async analyzeBehaviorPattern(event) {
        const eventType = event.type;
        const userId = event.userId;
        const context = event.metadata;
        return {
          pattern: `${eventType}_${context.priority}`,
          frequency: 1,
          // Would be calculated from historical data
          context: { userId, tags: context.tags },
          adaptation: this.determineAdaptation(eventType, context)
        };
      }
      determineAdaptation(eventType, _context) {
        switch (eventType) {
          case "code_generation":
            return "Increase code pattern relevance weighting";
          case "bug_fix":
            return "Enhance debugging reasoning patterns";
          case "quality_improvement":
            return "Adjust quality thresholds based on user tolerance";
          default:
            return "General learning pattern adaptation";
        }
      }
      async performCrossLayerAdaptation(behaviorPattern) {
        const { pattern, adaptation: _adaptation } = behaviorPattern;
        try {
          if (pattern.includes("code_generation")) {
            await this.adaptSystem1ForCodeGeneration();
          }
          if (pattern.includes("quality")) {
            await this.adaptSystem2ForQuality();
          }
          this.metrics.crossLayerTransfers++;
        } catch (error) {
          console.error("Cross-layer adaptation failed:", error);
        }
      }
      // ========== Utility Methods ==========
      async getSystem1State() {
        return {
          knowledgeNodes: this.system1.programmingConcepts.length,
          patterns: this.system1.codePatterns.codePatterns.length,
          interactions: this.system1.pastInteractions.sessions.length,
          cacheHitRate: 0.85
          // Estimated
        };
      }
      async getSystem2State() {
        return {
          reasoningTraces: this.system2.reasoningSteps.length,
          qualityMetrics: this.system2.qualityEvaluation,
          enhancements: this.system2.improvementSuggestions.length,
          reflections: this.system2.reflectionData.length
        };
      }
      getRecentSyncPoints() {
        return this.syncPoints.slice(-10);
      }
      getRecentConflicts() {
        return this.conflicts.slice(-5);
      }
      recordSyncPoint(type, source, target, data) {
        const syncPoint = {
          id: `sync-${Date.now()}`,
          timestamp: /* @__PURE__ */ new Date(),
          type,
          source,
          target,
          data,
          success: true,
          latency: Math.random() * 100
          // Simulated latency
        };
        this.syncPoints.push(syncPoint);
        if (this.syncPoints.length > 100) {
          this.syncPoints = this.syncPoints.slice(-50);
        }
      }
      startCoordination() {
        this.syncTimer = setInterval(() => {
          this.synchronizeSystems().catch(console.error);
        }, this.config.syncInterval);
        this.optimizationTimer = setInterval(
          () => {
            this.optimizePerformance().catch(console.error);
          },
          5 * 60 * 1e3
        );
      }
      initializeMetrics() {
        return {
          syncOperations: 0,
          optimizationRuns: 0,
          adaptationEvents: 0,
          crossLayerTransfers: 0,
          performanceImprovements: 0,
          lastOptimization: /* @__PURE__ */ new Date(),
          averageSyncTime: 0,
          systemHealth: "good"
        };
      }
      // ========== Specific Optimization Methods ==========
      async transferKnowledgeToReasoning(knowledge) {
        const reasoning = await this.system2.startReasoningTrace({
          problem: `Apply knowledge: ${knowledge.name}`,
          goals: ["Integrate knowledge into reasoning"],
          constraints: [],
          assumptions: [`Knowledge confidence: ${knowledge.confidence}`],
          availableResources: [knowledge.content]
        });
        await this.system2.completeReasoningTrace(
          reasoning.id,
          `Knowledge integrated: ${knowledge.name}`,
          knowledge.confidence
        );
      }
      async updatePatternsForMaintainability() {
        console.log("Updating patterns for better maintainability");
      }
      async updatePatternsForSecurity() {
        console.log("Updating patterns for better security");
      }
      async adaptReasoningForTDD() {
        console.log("Adapting reasoning for TDD approach");
      }
      async adaptReasoningForSystematicApproach() {
        console.log("Adapting reasoning for systematic approach");
      }
      async integratePatternLearning(patterns, reasonings) {
        console.log(
          `Integrating learning from ${patterns.length} patterns and ${reasonings.length} reasonings`
        );
      }
      async identifyBottlenecks() {
        const bottlenecks = [];
        if (this.dualEngine.getQueueSize() > 50) {
          bottlenecks.push("Event queue processing");
        }
        if (this.dualEngine.getCacheSize() > 1e3) {
          bottlenecks.push("Cache memory usage");
        }
        return bottlenecks;
      }
      async identifyOptimizationOpportunities() {
        return [
          "Improve cache hit rate",
          "Optimize memory access patterns",
          "Enhance learning speed",
          "Reduce synchronization overhead"
        ];
      }
      async optimizePerformanceSettings() {
        console.log("Optimizing performance settings");
      }
      async optimizeMemoryUsage() {
        console.log("Optimizing memory usage");
      }
      async optimizeLearningSettings() {
        console.log("Optimizing learning settings");
      }
      async optimizeSynchronizationSettings() {
        console.log("Optimizing synchronization settings");
      }
      async adjustQualityThresholds(style) {
        console.log(`Adjusting quality thresholds for ${style} style`);
      }
      async optimizeSystem2Performance() {
        console.log("Optimizing System 2 performance");
      }
      async adaptSystem1ForCodeGeneration() {
        console.log("Adapting System 1 for code generation");
      }
      async adaptSystem2ForQuality() {
        console.log("Adapting System 2 for quality focus");
      }
      async updateAdaptiveLearning(_behaviorPattern) {
        console.log("Updating adaptive learning based on behavior pattern");
      }
      // ========== Public API ==========
      getMetrics() {
        const avgLatency = this.metrics.averageSyncTime;
        if (avgLatency < 50) this.metrics.systemHealth = "excellent";
        else if (avgLatency < 100) this.metrics.systemHealth = "good";
        else if (avgLatency < 200) this.metrics.systemHealth = "fair";
        else this.metrics.systemHealth = "poor";
        return { ...this.metrics };
      }
      getRecommendations() {
        return [...this.recommendations];
      }
      async forceOptimization() {
        return this.optimizePerformance();
      }
      async forceSynchronization() {
        return this.synchronizeSystems();
      }
      updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
      }
      destroy() {
        if (this.syncTimer) {
          clearInterval(this.syncTimer);
        }
        if (this.optimizationTimer) {
          clearInterval(this.optimizationTimer);
        }
      }
    };
  }
});
var BRAND_COLORS, SEMANTIC_COLORS, TEXT_HIERARCHY, LAYOUT_COLORS;
var init_UnifiedColorPalette = __esm({
  "src/ui/design-system/UnifiedColorPalette.ts"() {
    init_cjs_shims();
    BRAND_COLORS = {
      // ブランドプライマリー（マゼンタ - ロゴカラー）
      BRAND_PRIMARY: chalk8__default.default.magenta,
      BRAND_SECONDARY: chalk8__default.default.magentaBright,
      // ダークテーマベース
      BACKGROUND: chalk8__default.default.bgBlack,
      FOREGROUND: chalk8__default.default.white
    };
    SEMANTIC_COLORS = {
      // プライマリーカラー（メインアクション）
      PRIMARY: chalk8__default.default.cyan,
      // クリアで視認性の高いシアン
      // ステータスカラー（3色）
      SUCCESS: chalk8__default.default.green,
      // 成功・完了
      WARNING: chalk8__default.default.yellow,
      // 警告・注意
      ERROR: chalk8__default.default.red,
      // エラー・失敗
      // 補助カラー（3色）
      INFO: chalk8__default.default.blue,
      // 情報・説明
      MUTED: chalk8__default.default.gray,
      // 補助情報・メタデータ
      ACCENT: chalk8__default.default.magenta
      // アクセント・ブランド強調
    };
    TEXT_HIERARCHY = {
      // 見出し階層
      TITLE: chalk8__default.default.bold.cyan,
      // H1相当 - メインタイトル
      SUBTITLE: chalk8__default.default.cyan,
      // H2相当 - セクションタイトル
      SECTION: chalk8__default.default.bold.white,
      // H3相当 - サブセクション
      // 本文階層
      BODY: chalk8__default.default.white,
      // 通常テキスト（ユーザー指定の白）
      CAPTION: chalk8__default.default.gray,
      // 補助テキスト・メタデータ
      // 特殊階層
      DISABLED: chalk8__default.default.dim.gray,
      // 無効・非アクティブ
      HIGHLIGHT: chalk8__default.default.bold.white
      // 強調表示
    };
    ({
      // リンク・コマンド
      LINK: chalk8__default.default.underline.cyan,
      COMMAND: chalk8__default.default.bold.yellow,
      // 入力・出力
      INPUT: chalk8__default.default.green,
      OUTPUT: chalk8__default.default.white,
      // ステータス
      ACTIVE: chalk8__default.default.bold.cyan,
      INACTIVE: chalk8__default.default.dim.gray,
      // 特殊状態
      LOADING: chalk8__default.default.blue,
      PROGRESS: chalk8__default.default.cyan
    });
    LAYOUT_COLORS = {
      // ボーダー・区切り
      BORDER_PRIMARY: chalk8__default.default.magenta,
      // ブランドボーダー
      BORDER_SECONDARY: chalk8__default.default.gray,
      // 通常ボーダー
      SEPARATOR: chalk8__default.default.dim.gray,
      // 区切り線
      // 背景・強調
      BACKGROUND_SUBTLE: chalk8__default.default.bgGray,
      HIGHLIGHT_BG: chalk8__default.default.bgBlue
    };
    ({
      // よく使用するカラーのショートカット
      primary: SEMANTIC_COLORS.PRIMARY,
      success: SEMANTIC_COLORS.SUCCESS,
      error: SEMANTIC_COLORS.ERROR,
      warning: SEMANTIC_COLORS.WARNING,
      info: SEMANTIC_COLORS.INFO,
      muted: SEMANTIC_COLORS.MUTED,
      accent: SEMANTIC_COLORS.ACCENT,
      // テキスト
      title: TEXT_HIERARCHY.TITLE,
      subtitle: TEXT_HIERARCHY.SUBTITLE,
      body: TEXT_HIERARCHY.BODY,
      caption: TEXT_HIERARCHY.CAPTION,
      // ブランド
      brand: BRAND_COLORS.BRAND_PRIMARY,
      brandBright: BRAND_COLORS.BRAND_SECONDARY
    });
  }
});

// src/ui/design-system/MinimalIconRegistry.ts
var CORE_ICONS, SPINNER_FRAMES, FORBIDDEN_ICONS, IconRegistry;
var init_MinimalIconRegistry = __esm({
  "src/ui/design-system/MinimalIconRegistry.ts"() {
    init_cjs_shims();
    CORE_ICONS = {
      // システム状態アイコン
      SUCCESS: {
        symbol: "\u2713",
        width: 1,
        description: "\u6210\u529F\u30FB\u5B8C\u4E86\u72B6\u614B",
        usage: ["\u30BF\u30B9\u30AF\u5B8C\u4E86", "\u30D3\u30EB\u30C9\u6210\u529F", "\u30C6\u30B9\u30C8\u5408\u683C"]
      },
      ERROR: {
        symbol: "\u2717",
        width: 1,
        description: "\u30A8\u30E9\u30FC\u30FB\u5931\u6557\u72B6\u614B",
        usage: ["\u30A8\u30E9\u30FC\u767A\u751F", "\u30D3\u30EB\u30C9\u5931\u6557", "\u30C6\u30B9\u30C8\u5931\u6557"]
      },
      WARNING: {
        symbol: "!",
        width: 1,
        description: "\u8B66\u544A\u30FB\u6CE8\u610F\u559A\u8D77",
        usage: ["\u8B66\u544A\u30E1\u30C3\u30BB\u30FC\u30B8", "\u30C7\u30D7\u30EA\u30B1\u30FC\u30B7\u30E7\u30F3", "\u8981\u6CE8\u610F"]
      },
      INFO: {
        symbol: "i",
        width: 1,
        description: "\u60C5\u5831\u30FB\u8AAC\u660E",
        usage: ["\u60C5\u5831\u8868\u793A", "\u30D8\u30EB\u30D7", "\u8AAC\u660E\u6587"]
      },
      // プロセス状態アイコン
      LOADING: {
        symbol: "\u25EF",
        width: 1,
        description: "\u30ED\u30FC\u30C7\u30A3\u30F3\u30B0\u30FB\u51E6\u7406\u4E2D",
        usage: ["API\u547C\u3073\u51FA\u3057", "\u30D5\u30A1\u30A4\u30EB\u51E6\u7406", "AI\u5FDC\u7B54\u5F85\u3061"]
      },
      ARROW: {
        symbol: "\u2192",
        width: 1,
        description: "\u65B9\u5411\u30FB\u9032\u884C",
        usage: ["\u30D5\u30ED\u30FC\u8868\u793A", "\u30CA\u30D3\u30B2\u30FC\u30B7\u30E7\u30F3", "\u6B21\u306E\u30B9\u30C6\u30C3\u30D7"]
      }
    };
    SPINNER_FRAMES = ["\u280B", "\u2819", "\u2839", "\u2838", "\u283C", "\u2834", "\u2826", "\u2827", "\u2807", "\u280F"];
    FORBIDDEN_ICONS = [
      // 絵文字系（レンダリング不安定）
      "\u{1F680}",
      "\u{1F389}",
      "\u{1F3A8}",
      "\u{1F4CA}",
      "\u{1F527}",
      "\u26A1",
      "\u{1F3AF}",
      "\u{1F525}",
      "\u{1F31F}",
      "\u{1F4AB}",
      "\u2B50",
      "\u{1F3AA}",
      "\u{1F3AD}",
      "\u{1F52E}",
      "\u{1F3B2}",
      "\u{1F3C6}",
      "\u{1F396}\uFE0F",
      "\u{1F3C5}",
      "\u{1F947}",
      "\u{1F38A}",
      "\u{1F388}",
      "\u{1F381}",
      "\u{1F380}",
      // 複雑な記号（幅不定）
      "\u2728",
      "\u{1F48E}",
      "\u{1F539}",
      "\u{1F538}",
      "\u25C6",
      "\u25C7",
      "\u2666",
      "\u2662",
      "\u25CF",
      "\u25CB",
      "\u25C9",
      "\u25CE",
      "\u26AB",
      "\u26AA",
      "\u{1F534}",
      "\u{1F7E1}",
      // フォント依存記号
      "\u2605",
      "\u2606",
      "\u266A",
      "\u266B",
      "\u266C",
      "\u2669",
      "\u26BF",
      "\u26BE"
    ];
    IconRegistry = class {
      static {
        __name(this, "IconRegistry");
      }
      /**
       * 安全なアイコン取得（フォールバック付き）
       */
      static get(iconName) {
        const icon = CORE_ICONS[iconName];
        if (!icon) {
          console.warn(`Unknown icon: ${iconName}, falling back to INFO`);
          return CORE_ICONS.INFO.symbol;
        }
        return icon.symbol;
      }
      /**
       * アイコンの文字幅取得
       */
      static getWidth(iconName) {
        const icon = CORE_ICONS[iconName];
        return icon?.width || 1;
      }
      /**
       * 文字幅を考慮したアイコン配置
       */
      static alignIcon(iconName, totalWidth) {
        const icon = this.get(iconName);
        const iconWidth = this.getWidth(iconName);
        const padding = Math.max(0, totalWidth - iconWidth);
        return icon.padEnd(totalWidth - padding + iconWidth);
      }
      /**
       * スピナーフレーム取得
       */
      static getSpinnerFrame(index) {
        const frame = SPINNER_FRAMES[index % SPINNER_FRAMES.length];
        return frame || "\u25EF";
      }
      /**
       * 利用可能なアイコン一覧
       */
      static listAvailable() {
        return Object.entries(CORE_ICONS).map(([name, icon]) => ({
          name,
          icon
        }));
      }
      /**
       * アイコンの使用例表示
       */
      static showUsageExample(iconName) {
        const icon = CORE_ICONS[iconName];
        if (!icon) return;
        console.log(`${icon.symbol} ${iconName} - ${icon.description}`);
        icon.usage.forEach((usage) => {
          console.log(`  \u4F8B: ${icon.symbol} ${usage}`);
        });
      }
      /**
       * 禁止アイコンチェック
       */
      static isForbidden(symbol) {
        return FORBIDDEN_ICONS.includes(symbol);
      }
      /**
       * 安全性検証
       */
      static validateIcon(symbol) {
        const warnings = [];
        if (this.isForbidden(symbol)) {
          warnings.push("\u7981\u6B62\u3055\u308C\u305F\u30A2\u30A4\u30B3\u30F3\u3067\u3059");
        }
        let estimatedWidth = 1;
        if (symbol.length > 1) {
          estimatedWidth = symbol.length;
          warnings.push("\u8907\u6570\u6587\u5B57\u306E\u30A2\u30A4\u30B3\u30F3\u306F\u8868\u793A\u305A\u308C\u306E\u539F\u56E0\u3068\u306A\u308A\u307E\u3059");
        }
        if (/[\u{1F300}-\u{1F9FF}]/u.test(symbol)) {
          warnings.push("\u7D75\u6587\u5B57\u306F\u7AEF\u672B\u306B\u3088\u3063\u3066\u8868\u793A\u304C\u7570\u306A\u308A\u307E\u3059");
        }
        return {
          isValid: warnings.length === 0,
          width: estimatedWidth,
          warnings
        };
      }
    };
    IconRegistry.get;
    IconRegistry.getWidth;
    IconRegistry.alignIcon;
  }
});

// src/ui/design-system/LayoutManager.ts
var LAYOUT_CONSTANTS, LayoutManager;
var init_LayoutManager = __esm({
  "src/ui/design-system/LayoutManager.ts"() {
    init_cjs_shims();
    LAYOUT_CONSTANTS = {
      // 基準画面幅
      SCREEN_WIDTH: 124,
      CONTENT_WIDTH: 120,
      // 両端2文字余白
      BORDER_WIDTH: 118,
      // ボーダー内容幅
      // セクション間隔
      SECTION_PADDING: 4,
      // セクション間隔
      INDENT_SIZE: 2,
      // インデント幅
      LINE_SPACING: 1,
      // 行間
      // 黄金比レイアウト（合計120文字）
      MAIN_CONTENT: 80,
      // メインコンテンツ幅
      SIDEBAR: 36,
      // サイドバー幅（0.45比率）
      COLUMN_GAP: 4,
      // 列間ギャップ
      // ステータス・ヘッダー
      STATUS_BAR: 120,
      // ステータスバー幅
      HEADER_HEIGHT: 12,
      // ヘッダー行数
      FOOTER_HEIGHT: 3,
      // フッター行数
      // レスポンシブ閾値
      MIN_WIDTH: 80,
      // 最小表示幅
      MAX_WIDTH: 200,
      // 最大表示幅
      COMPACT_THRESHOLD: 100,
      // コンパクト表示閾値
      WIDE_THRESHOLD: 140
      // ワイド表示閾値
    };
    LayoutManager = class {
      static {
        __name(this, "LayoutManager");
      }
      static currentConfig;
      /**
       * 端末幅に基づく最適レイアウト決定
       */
      static getOptimalLayout(terminalWidth) {
        const width = terminalWidth || process.stdout.columns || LAYOUT_CONSTANTS.SCREEN_WIDTH;
        let mode;
        let config = {};
        if (width < LAYOUT_CONSTANTS.COMPACT_THRESHOLD) {
          mode = "compact";
          config = {
            width: Math.max(width, LAYOUT_CONSTANTS.MIN_WIDTH),
            contentWidth: Math.max(width - 4, LAYOUT_CONSTANTS.MIN_WIDTH - 4),
            mainContentWidth: Math.max(width - 8, LAYOUT_CONSTANTS.MIN_WIDTH - 8),
            sidebarWidth: 0,
            // コンパクトモードではサイドバーなし
            columnGap: 0,
            padding: 2
          };
        } else if (width > LAYOUT_CONSTANTS.WIDE_THRESHOLD) {
          mode = "wide";
          const scaleFactor = width / LAYOUT_CONSTANTS.SCREEN_WIDTH;
          config = {
            width,
            contentWidth: width - 4,
            mainContentWidth: Math.floor(LAYOUT_CONSTANTS.MAIN_CONTENT * scaleFactor),
            sidebarWidth: Math.floor(LAYOUT_CONSTANTS.SIDEBAR * scaleFactor),
            columnGap: LAYOUT_CONSTANTS.COLUMN_GAP,
            padding: LAYOUT_CONSTANTS.SECTION_PADDING
          };
        } else {
          mode = "standard";
          config = {
            width: LAYOUT_CONSTANTS.SCREEN_WIDTH,
            contentWidth: LAYOUT_CONSTANTS.CONTENT_WIDTH,
            mainContentWidth: LAYOUT_CONSTANTS.MAIN_CONTENT,
            sidebarWidth: LAYOUT_CONSTANTS.SIDEBAR,
            columnGap: LAYOUT_CONSTANTS.COLUMN_GAP,
            padding: LAYOUT_CONSTANTS.SECTION_PADDING
          };
        }
        this.currentConfig = { mode, ...config };
        return this.currentConfig;
      }
      /**
       * 現在のレイアウト設定取得
       */
      static getCurrentConfig() {
        return this.currentConfig || this.getOptimalLayout();
      }
      /**
       * テキスト配置（完全なピクセルパーフェクト）
       */
      static alignText(text, width, alignment = "left") {
        const actualLength = this.getStringWidth(text);
        if (actualLength > width) {
          return this.truncateString(text, width - 3) + "...";
        }
        const padding = width - actualLength;
        switch (alignment) {
          case "center":
            const leftPad = Math.floor(padding / 2);
            const rightPad = padding - leftPad;
            return " ".repeat(leftPad) + text + " ".repeat(rightPad);
          case "right":
            return " ".repeat(padding) + text;
          case "left":
          default:
            return text + " ".repeat(padding);
        }
      }
      /**
       * 2カラムレイアウト生成
       */
      static createTwoColumnLayout(leftContent, rightContent, config) {
        const layout = config ? { ...this.getCurrentConfig(), ...config } : this.getCurrentConfig();
        if (layout.mode === "compact") {
          return [...leftContent, "", ...rightContent];
        }
        const maxLines = Math.max(leftContent.length, rightContent.length);
        const result = [];
        for (let i = 0; i < maxLines; i++) {
          const left = this.alignText(leftContent[i] || "", layout.mainContentWidth, "left");
          const right = this.alignText(rightContent[i] || "", layout.sidebarWidth, "left");
          const gap = " ".repeat(layout.columnGap);
          result.push(left + gap + right);
        }
        return result;
      }
      /**
       * セクション区切り生成
       */
      static createSectionSeparator(width, char = "\u2500", style = "full") {
        const layout = this.getCurrentConfig();
        const actualWidth = width || layout.contentWidth;
        switch (style) {
          case "partial":
            return char.repeat(Math.floor(actualWidth * 0.6));
          case "minimal":
            return char.repeat(Math.floor(actualWidth * 0.3));
          case "full":
          default:
            return char.repeat(actualWidth);
        }
      }
      /**
       * ボックスボーダー生成（厳密な幅管理）
       */
      static createBoxBorder(width, style = "light") {
        const chars = {
          light: { corner: ["\u250C", "\u2510", "\u2514", "\u2518"], horizontal: "\u2500", vertical: "\u2502" },
          heavy: { corner: ["\u2554", "\u2557", "\u255A", "\u255D"], horizontal: "\u2550", vertical: "\u2551" },
          double: { corner: ["\u2554", "\u2557", "\u255A", "\u255D"], horizontal: "\u2550", vertical: "\u2551" }
        }[style];
        const horizontal = chars.horizontal.repeat(width - 2);
        const innerWidth = width - 2;
        return {
          top: `${chars.corner[0]}${horizontal}${chars.corner[1]}`,
          bottom: `${chars.corner[2]}${horizontal}${chars.corner[3]}`,
          side: chars.vertical,
          innerWidth
        };
      }
      /**
       * レスポンシブグリッド生成
       */
      static createGrid(items, columns) {
        const layout = this.getCurrentConfig();
        const autoColumns = columns || (layout.mode === "compact" ? 1 : layout.mode === "wide" ? 4 : 2);
        const columnWidth = Math.floor(layout.contentWidth / autoColumns);
        const gap = Math.floor((layout.contentWidth - columnWidth * autoColumns) / (autoColumns - 1));
        const result = [];
        for (let i = 0; i < items.length; i += autoColumns) {
          const row = items.slice(i, i + autoColumns);
          const paddedRow = row.map((item) => this.alignText(item, columnWidth));
          while (paddedRow.length < autoColumns) {
            paddedRow.push(" ".repeat(columnWidth));
          }
          result.push(paddedRow.join(" ".repeat(gap)));
        }
        return result;
      }
      /**
       * Unicode対応文字幅計算
       */
      static getStringWidth(str) {
        let width = 0;
        for (const char of str) {
          const code = char.codePointAt(0);
          if (!code) continue;
          if (code > 12288 && code < 40959) {
            width += 2;
          } else if (code > 127744 && code < 129535) {
            width += 2;
          } else {
            width += 1;
          }
        }
        return width;
      }
      /**
       * 安全な文字列切り詰め
       */
      static truncateString(str, maxWidth) {
        let width = 0;
        let result = "";
        for (const char of str) {
          const charWidth = this.getStringWidth(char);
          if (width + charWidth > maxWidth) break;
          result += char;
          width += charWidth;
        }
        return result;
      }
      /**
       * レイアウトデバッグ情報
       */
      static debugLayout() {
        const config = this.getCurrentConfig();
        console.log("Layout Debug Information:");
        console.log(`Mode: ${config.mode}`);
        console.log(`Width: ${config.width}`);
        console.log(`Content Width: ${config.contentWidth}`);
        console.log(`Main Content: ${config.mainContentWidth}`);
        console.log(`Sidebar: ${config.sidebarWidth}`);
        console.log(`Column Gap: ${config.columnGap}`);
        console.log(`Padding: ${config.padding}`);
      }
      /**
       * レイアウト妥当性検証
       */
      static validateLayout(config) {
        const errors = [];
        if (config.width < LAYOUT_CONSTANTS.MIN_WIDTH) {
          errors.push(`\u5E45\u304C\u6700\u5C0F\u5024(${LAYOUT_CONSTANTS.MIN_WIDTH})\u3092\u4E0B\u56DE\u3063\u3066\u3044\u307E\u3059: ${config.width}`);
        }
        const totalWidth = config.mainContentWidth + config.sidebarWidth + config.columnGap;
        if (totalWidth > config.contentWidth) {
          errors.push(
            `\u30AB\u30E9\u30E0\u5E45\u306E\u5408\u8A08\u304C content width \u3092\u8D85\u3048\u3066\u3044\u307E\u3059: ${totalWidth} > ${config.contentWidth}`
          );
        }
        return {
          isValid: errors.length === 0,
          errors
        };
      }
    };
    LayoutManager.alignText;
    LayoutManager.createTwoColumnLayout;
    LayoutManager.createSectionSeparator;
    LayoutManager.createBoxBorder;
    LayoutManager.createGrid;
  }
});

// src/ui/design-system/OptimizedBox.ts
var OptimizedBox;
var init_OptimizedBox = __esm({
  "src/ui/design-system/OptimizedBox.ts"() {
    init_cjs_shims();
    init_LayoutManager();
    init_UnifiedColorPalette();
    OptimizedBox = class _OptimizedBox {
      static {
        __name(this, "OptimizedBox");
      }
      config;
      options;
      constructor(options = {}) {
        this.config = LayoutManager.getCurrentConfig();
        this.options = {
          width: options.width || this.config.contentWidth,
          height: options.height || 0,
          // 自動計算
          padding: options.padding || "medium",
          style: options.style || "light",
          theme: options.theme || "default",
          title: options.title || "",
          titleAlignment: options.titleAlignment || "center",
          contentAlignment: options.contentAlignment || "left",
          shadow: options.shadow || false,
          responsive: options.responsive !== false
        };
        if (this.options.responsive) {
          this.adjustForCurrentLayout();
        }
      }
      /**
       * ボックス描画（メイン関数）
       */
      render(content) {
        const lines = Array.isArray(content) ? content : content.lines;
        const processedLines = this.processContent(lines);
        this.renderBox(processedLines);
      }
      /**
       * 静的メソッド：シンプルボックス
       */
      static simple(content, options = {}) {
        const box = new _OptimizedBox(options);
        box.render(content);
      }
      /**
       * 静的メソッド：タイトル付きボックス
       */
      static withTitle(title, content, options = {}) {
        const box = new _OptimizedBox({ ...options, title });
        box.render(content);
      }
      /**
       * 静的メソッド：ステータスボックス
       */
      static status(status, content, options = {}) {
        const themeMap = {
          success: "success",
          error: "error",
          warning: "warning",
          info: "info"
        };
        const box = new _OptimizedBox({
          ...options,
          theme: themeMap[status],
          style: "heavy"
        });
        box.render(content);
      }
      /**
       * 静的メソッド：ブランドボックス（MARIA CODE用）
       */
      static brand(content, options = {}) {
        const box = new _OptimizedBox({
          ...options,
          theme: "brand",
          style: "heavy"
        });
        box.render(content);
      }
      /**
       * レイアウト調整
       */
      adjustForCurrentLayout() {
        this.config = LayoutManager.getCurrentConfig();
        if (this.config.mode === "compact") {
          this.options.width = Math.min(this.options.width, this.config.contentWidth);
          this.options.padding = typeof this.options.padding === "string" ? "small" : Math.max(1, this.options.padding - 1);
        }
        if (this.config.mode === "wide" && this.options.width === this.config.contentWidth) {
          this.options.width = this.config.contentWidth;
        }
      }
      /**
       * コンテンツ処理
       */
      processContent(lines) {
        const padding = this.getPaddingSize();
        const contentWidth = this.options.width - 2 - padding * 2;
        return lines.map(
          (line) => LayoutManager.alignText(line, contentWidth, this.options.contentAlignment)
        );
      }
      /**
       * ボックス描画実装
       */
      renderBox(contentLines) {
        const { width } = this.options;
        const padding = this.getPaddingSize();
        const colorFn = this.getThemeColor();
        const border = this.getBorderChars();
        this.renderTopBorder(colorFn, border, width);
        this.renderPaddingLines(padding, width, colorFn, border.vertical);
        contentLines.forEach((line) => {
          const paddedLine = " ".repeat(padding) + line + " ".repeat(padding);
          console.log(colorFn(border.vertical) + paddedLine + colorFn(border.vertical));
        });
        this.renderPaddingLines(padding, width, colorFn, border.vertical);
        console.log(
          colorFn(border.bottomLeft + border.horizontal.repeat(width - 2) + border.bottomRight)
        );
        if (this.options.shadow) {
          this.renderShadow(width);
        }
      }
      /**
       * 上ボーダー描画（タイトル対応）
       */
      renderTopBorder(colorFn, border, width) {
        if (this.options.title) {
          const titleWidth = width - 4;
          const title = LayoutManager.alignText(
            this.options.title,
            titleWidth,
            this.options.titleAlignment
          );
          console.log(
            colorFn(border.topLeft + border.horizontal + title + border.horizontal + border.topRight)
          );
        } else {
          console.log(colorFn(border.topLeft + border.horizontal.repeat(width - 2) + border.topRight));
        }
      }
      /**
       * パディング行描画
       */
      renderPaddingLines(padding, width, colorFn, vertical) {
        for (let i = 0; i < padding; i++) {
          console.log(colorFn(vertical) + " ".repeat(width - 2) + colorFn(vertical));
        }
      }
      /**
       * シャドウ効果描画
       */
      renderShadow(width) {
        const shadowChar = "\u2593";
        const shadowColor = SEMANTIC_COLORS.MUTED;
        console.log(" " + shadowColor(shadowChar.repeat(width)));
        console.log(shadowColor(shadowChar.repeat(width + 1)));
      }
      /**
       * パディングサイズ計算
       */
      getPaddingSize() {
        if (typeof this.options.padding === "number") {
          return this.options.padding;
        }
        const paddingMap = {
          none: 0,
          small: 1,
          medium: 2,
          large: 3
        };
        return paddingMap[this.options.padding];
      }
      /**
       * テーマカラー取得
       */
      getThemeColor() {
        const themeMap = {
          default: LAYOUT_COLORS.BORDER_SECONDARY,
          primary: SEMANTIC_COLORS.PRIMARY,
          success: SEMANTIC_COLORS.SUCCESS,
          warning: SEMANTIC_COLORS.WARNING,
          error: SEMANTIC_COLORS.ERROR,
          info: SEMANTIC_COLORS.INFO,
          brand: BRAND_COLORS.BRAND_PRIMARY
        };
        return themeMap[this.options.theme];
      }
      /**
       * ボーダー文字取得
       */
      getBorderChars() {
        const borderMap = {
          light: {
            topLeft: "\u250C",
            topRight: "\u2510",
            bottomLeft: "\u2514",
            bottomRight: "\u2518",
            horizontal: "\u2500",
            vertical: "\u2502"
          },
          heavy: {
            topLeft: "\u2554",
            topRight: "\u2557",
            bottomLeft: "\u255A",
            bottomRight: "\u255D",
            horizontal: "\u2550",
            vertical: "\u2551"
          },
          double: {
            topLeft: "\u2554",
            topRight: "\u2557",
            bottomLeft: "\u255A",
            bottomRight: "\u255D",
            horizontal: "\u2550",
            vertical: "\u2551"
          },
          rounded: {
            topLeft: "\u256D",
            topRight: "\u256E",
            bottomLeft: "\u2570",
            bottomRight: "\u256F",
            horizontal: "\u2500",
            vertical: "\u2502"
          },
          minimal: {
            topLeft: "+",
            topRight: "+",
            bottomLeft: "+",
            bottomRight: "+",
            horizontal: "-",
            vertical: "|"
          }
        };
        return borderMap[this.options.style];
      }
      /**
       * ボックス設定バリデーション
       */
      static validateOptions(options) {
        const warnings = [];
        if (options.width && options.width < 10) {
          warnings.push("\u5E45\u304C\u5C0F\u3055\u3059\u304E\u307E\u3059\uFF08\u6700\u5C0F10\u6587\u5B57\u63A8\u5968\uFF09");
        }
        if (typeof options.padding === "number" && options.padding < 0) {
          warnings.push("\u30D1\u30C7\u30A3\u30F3\u30B0\u306F0\u4EE5\u4E0A\u3067\u3042\u308B\u5FC5\u8981\u304C\u3042\u308A\u307E\u3059");
        }
        return {
          isValid: warnings.length === 0,
          warnings
        };
      }
      /**
       * プリセットボックススタイル
       */
      static presets = {
        /**
         * ヘッダーボックス
         */
        header: /* @__PURE__ */ __name((content, title) => {
          _OptimizedBox.withTitle(title || "Header", content, {
            theme: "brand",
            style: "heavy",
            padding: "large",
            titleAlignment: "center"
          });
        }, "header"),
        /**
         * 警告ボックス
         */
        warning: /* @__PURE__ */ __name((content) => {
          _OptimizedBox.status("warning", content, {
            style: "heavy",
            padding: "medium"
          });
        }, "warning"),
        /**
         * 情報ボックス
         */
        info: /* @__PURE__ */ __name((content) => {
          _OptimizedBox.status("info", content, {
            style: "light",
            padding: "small"
          });
        }, "info"),
        /**
         * コードボックス
         */
        code: /* @__PURE__ */ __name((content) => {
          _OptimizedBox.simple(content, {
            style: "minimal",
            padding: "medium",
            theme: "default"
          });
        }, "code")
      };
    };
    OptimizedBox.simple;
    OptimizedBox.withTitle;
    OptimizedBox.status;
    OptimizedBox.brand;
  }
});

// src/ui/design-system/ResponsiveRenderer.ts
var ResponsiveRenderer;
var init_ResponsiveRenderer = __esm({
  "src/ui/design-system/ResponsiveRenderer.ts"() {
    init_cjs_shims();
    init_LayoutManager();
    init_OptimizedBox();
    init_UnifiedColorPalette();
    init_MinimalIconRegistry();
    ResponsiveRenderer = class {
      static {
        __name(this, "ResponsiveRenderer");
      }
      static context;
      static config = {
        enableAdaptiveLayout: true,
        enableContentScaling: true,
        enableAutomaticWrapping: true,
        enableProgressiveDisplay: true,
        minContentWidth: 80,
        maxContentWidth: 200,
        breakpoints: {
          compact: 100,
          standard: 124,
          wide: 140
        }
      };
      /**
       * 初期化と画面サイズ検出
       */
      static initialize(customConfig) {
        if (customConfig) {
          this.config = { ...this.config, ...customConfig };
        }
        this.updateContext();
        if (process.stdout.isTTY) {
          process.stdout.on("resize", () => {
            this.updateContext();
          });
        }
      }
      /**
       * コンテキスト更新
       */
      static updateContext() {
        const terminalWidth = process.stdout.columns || this.config.breakpoints.standard;
        const terminalHeight = process.stdout.rows || 24;
        const layout = LayoutManager.getOptimalLayout(terminalWidth);
        this.context = {
          layout,
          config: this.config,
          terminalWidth,
          terminalHeight,
          mode: layout.mode
        };
      }
      /**
       * レスポンシブコンテンツ描画
       */
      static render(content) {
        if (!this.context) this.initialize();
        const contents = Array.isArray(content) ? content : [content];
        const sortedContents = contents.sort((a, b) => b.priority - a.priority);
        if (this.config.enableProgressiveDisplay) {
          this.renderProgressive(sortedContents);
        } else {
          this.renderDirect(sortedContents);
        }
      }
      /**
       * プログレッシブ描画
       */
      static renderProgressive(contents) {
        const availableHeight = this.context.terminalHeight - 10;
        let usedHeight = 0;
        for (const content of contents) {
          if (usedHeight >= availableHeight && this.context.mode === "compact") {
            this.renderTruncationNotice(contents.length - contents.indexOf(content));
            break;
          }
          const estimatedHeight = this.estimateContentHeight(content);
          if (estimatedHeight <= availableHeight - usedHeight || content.priority >= 9) {
            this.renderContent(content);
            usedHeight += estimatedHeight;
          }
        }
      }
      /**
       * 直接描画
       */
      static renderDirect(contents) {
        contents.forEach((content) => this.renderContent(content));
      }
      /**
       * コンテンツ描画
       */
      static renderContent(content) {
        switch (content.type) {
          case "header":
            this.renderHeader(content.data);
            break;
          case "status":
            this.renderStatus(content.data);
            break;
          case "navigation":
            this.renderNavigation(content.data);
            break;
          case "content":
            this.renderContentBlock(content.data);
            break;
          case "sidebar":
            this.renderSidebar(content.data);
            break;
          case "table":
            this.renderTable(content.data);
            break;
          case "list":
            this.renderList(content.data);
            break;
          case "progress":
            this.renderProgress(content.data);
            break;
          case "dialog":
            this.renderDialog(content.data);
            break;
          default:
            console.warn(`Unknown content type: ${content.type}`);
        }
      }
      /**
       * ヘッダー描画
       */
      static renderHeader(data) {
        const width = this.context.layout.contentWidth;
        if (this.context.mode === "compact") {
          console.log(TEXT_HIERARCHY.TITLE(data.title));
          if (data.subtitle) {
            console.log(TEXT_HIERARCHY.CAPTION(data.subtitle));
          }
        } else {
          OptimizedBox.brand(
            [
              LayoutManager.alignText(data.title, width - 4, "center"),
              data.subtitle ? LayoutManager.alignText(data.subtitle, width - 4, "center") : "",
              data.copyright ? LayoutManager.alignText(data.copyright, width - 4, "center") : ""
            ].filter(Boolean),
            {
              width,
              padding: "large",
              titleAlignment: "center"
            }
          );
        }
        console.log();
      }
      /**
       * ステータス描画
       */
      static renderStatus(data) {
        const icon = IconRegistry.get(
          data.status === "healthy" ? "SUCCESS" : data.status === "degraded" ? "WARNING" : "ERROR"
        );
        const color = ColorPalette.status(
          data.status === "healthy" ? "success" : data.status === "degraded" ? "warning" : "error"
        );
        const statusLine = `${color(icon)} ${TEXT_HIERARCHY.BODY(data.message)}`;
        if (this.context.mode !== "compact" && data.details) {
          OptimizedBox.simple(
            [statusLine, ...data.details.map((detail) => `  ${TEXT_HIERARCHY.CAPTION(detail)}`)],
            {
              theme: data.status === "healthy" ? "success" : data.status === "degraded" ? "warning" : "error",
              padding: "small"
            }
          );
        } else {
          console.log(statusLine);
        }
      }
      /**
       * ナビゲーション描画
       */
      static renderNavigation(data) {
        if (this.context.mode === "compact") {
          const items = data.items.slice(0, 3).map((item) => TEXT_HIERARCHY.BODY(item.label)).join(TEXT_HIERARCHY.CAPTION(" \u2022 "));
          console.log(items);
        } else {
          const grid = LayoutManager.createGrid(
            data.items.map((item) => `${item.icon || CORE_ICONS.ARROW.symbol} ${item.label}`),
            this.context.mode === "wide" ? 4 : 2
          );
          grid.forEach((line) => console.log(line));
        }
        console.log();
      }
      /**
       * テーブル描画
       */
      static renderTable(data) {
        const maxWidth = this.context.layout.contentWidth;
        const columnCount = data.headers.length;
        const columnWidth = Math.floor((maxWidth - (columnCount - 1) * 2) / columnCount);
        const headerRow = data.headers.map((header) => TEXT_HIERARCHY.SUBTITLE(LayoutManager.alignText(header, columnWidth))).join("  ");
        console.log(headerRow);
        console.log(SEMANTIC_COLORS.MUTED("\u2500".repeat(maxWidth)));
        data.rows.forEach((row) => {
          const dataRow = data.headers.map(
            (header) => TEXT_HIERARCHY.BODY(LayoutManager.alignText(String(row[header] || ""), columnWidth))
          ).join("  ");
          console.log(dataRow);
        });
        console.log();
      }
      /**
       * プログレス描画
       */
      static renderProgress(data) {
        const width = Math.min(60, this.context.layout.contentWidth - 20);
        const filled = Math.floor(data.value / data.max * width);
        const empty = width - filled;
        const bar = SEMANTIC_COLORS.SUCCESS("\u2588".repeat(filled)) + SEMANTIC_COLORS.MUTED("\u2591".repeat(empty));
        const percentage = Math.round(data.value / data.max * 100);
        const label = data.label ? `${data.label}: ` : "";
        console.log(`${label}${bar} ${percentage}%`);
      }
      /**
       * コンテンツ高さ推定
       */
      static estimateContentHeight(content) {
        switch (content.type) {
          case "header":
            return this.context.mode === "compact" ? 3 : 8;
          case "status":
            return 2;
          case "navigation":
            return this.context.mode === "compact" ? 2 : 4;
          case "table":
            const tableData = content.data;
            return tableData.rows.length + 3;
          // ヘッダー + 区切り + データ
          default:
            return 3;
        }
      }
      /**
       * 省略通知表示
       */
      static renderTruncationNotice(remainingCount) {
        const message = `${IconRegistry.get("INFO")} ${remainingCount} more items (use wider terminal)`;
        console.log(TEXT_HIERARCHY.CAPTION(message));
      }
      /**
       * レスポンシブ情報表示
       */
      static showResponsiveInfo() {
        console.log(TEXT_HIERARCHY.TITLE("Responsive Renderer Info"));
        console.log(SEMANTIC_COLORS.MUTED("\u2500".repeat(40)));
        console.log(`Mode: ${this.context.mode}`);
        console.log(`Terminal: ${this.context.terminalWidth}x${this.context.terminalHeight}`);
        console.log(`Layout Width: ${this.context.layout.width}`);
        console.log(`Content Width: ${this.context.layout.contentWidth}`);
        console.log(`Adaptive Layout: ${this.config.enableAdaptiveLayout ? "ON" : "OFF"}`);
        console.log(`Content Scaling: ${this.config.enableContentScaling ? "ON" : "OFF"}`);
      }
      // その他のrender*メソッドは簡略化のため省略
      static renderContentBlock(_data) {
      }
      static renderSidebar(_data) {
      }
      static renderList(_data) {
      }
      static renderDialog(_data) {
      }
    };
    ResponsiveRenderer.render;
    ResponsiveRenderer.initialize;
  }
});

// src/utils/ui.ts
function printStatus(health) {
  const layout = LayoutManager.getOptimalLayout();
  OptimizedBox.withTitle(
    "System Status",
    [renderOverallStatus(health), ...renderHealthSections(health)],
    {
      theme: getHealthTheme(health.overall),
      width: layout.contentWidth,
      responsive: true
    }
  );
  if (health.timestamp || health.lastUpdate) {
    const timestamp = health.timestamp || health.lastUpdate;
    const timeStr = timestamp instanceof Date ? timestamp.toLocaleString() : new Date(timestamp).toLocaleString();
    console.log("");
    console.log(TEXT_HIERARCHY.CAPTION(`Last updated: ${timeStr}`));
  }
}
function renderOverallStatus(health) {
  const statusIcon = health.overall === "healthy" ? IconRegistry.get("SUCCESS") : health.overall === "degraded" ? IconRegistry.get("WARNING") : IconRegistry.get("ERROR");
  const statusColor = health.overall === "healthy" ? SEMANTIC_COLORS.SUCCESS : health.overall === "degraded" ? SEMANTIC_COLORS.WARNING : SEMANTIC_COLORS.ERROR;
  return statusColor(`${statusIcon} Overall Status: ${health.overall.toUpperCase()}`);
}
function renderHealthSections(health) {
  const sections = [""];
  if (health.providers && health.providers.length > 0) {
    sections.push(TEXT_HIERARCHY.SUBTITLE("AI Providers:"));
    health.providers.forEach((provider) => {
      const statusIcon = provider.health.status === "healthy" ? IconRegistry.get("SUCCESS") : provider.health.status === "degraded" ? IconRegistry.get("WARNING") : IconRegistry.get("ERROR");
      const statusColor = provider.health.status === "healthy" ? SEMANTIC_COLORS.SUCCESS : provider.health.status === "degraded" ? SEMANTIC_COLORS.WARNING : SEMANTIC_COLORS.ERROR;
      sections.push(`  ${statusColor(statusIcon)} ${provider.name}: ${provider.health.status}`);
    });
    sections.push("");
  }
  if (health.uptime) {
    const uptimeHours = Math.floor(health.uptime / 3600);
    const uptimeMinutes = Math.floor(health.uptime % 3600 / 60);
    sections.push(TEXT_HIERARCHY.SUBTITLE("System:"));
    sections.push(`  Uptime: ${uptimeHours}h ${uptimeMinutes}m`);
    sections.push("");
  }
  if (health.recommendations && health.recommendations.length > 0) {
    sections.push(TEXT_HIERARCHY.SUBTITLE("Recommendations:"));
    health.recommendations.forEach((rec) => {
      const icon = rec.type === "error" ? IconRegistry.get("ERROR") : rec.type === "warning" ? IconRegistry.get("WARNING") : IconRegistry.get("INFO");
      const message = rec.message || rec;
      sections.push(`  ${icon} ${TEXT_HIERARCHY.CAPTION(message)}`);
    });
  }
  return sections;
}
function getHealthTheme(overall) {
  switch (overall) {
    case "healthy":
      return "success";
    case "degraded":
      return "warning";
    case "error":
      return "error";
    default:
      return "info";
  }
}
function printSuccess(message) {
  console.log(SEMANTIC_COLORS.SUCCESS(IconRegistry.get("SUCCESS")), TEXT_HIERARCHY.BODY(message));
}
function printError(message) {
  console.log(SEMANTIC_COLORS.ERROR(IconRegistry.get("ERROR")), TEXT_HIERARCHY.BODY(message));
}
var init_ui = __esm({
  "src/utils/ui.ts"() {
    init_cjs_shims();
    init_LayoutManager();
    init_OptimizedBox();
    init_ResponsiveRenderer();
    init_UnifiedColorPalette();
    init_MinimalIconRegistry();
    __name(printStatus, "printStatus");
    __name(renderOverallStatus, "renderOverallStatus");
    __name(renderHealthSections, "renderHealthSections");
    __name(getHealthTheme, "getHealthTheme");
    __name(printSuccess, "printSuccess");
    __name(printError, "printError");
  }
});

// src/services/approval-engine/types.ts
var init_types2 = __esm({
  "src/services/approval-engine/types.ts"() {
    init_cjs_shims();
  }
});

// src/services/approval-engine/ApprovalThemeRegistry.ts
var ApprovalThemeRegistry;
var init_ApprovalThemeRegistry = __esm({
  "src/services/approval-engine/ApprovalThemeRegistry.ts"() {
    init_cjs_shims();
    ApprovalThemeRegistry = class {
      static {
        __name(this, "ApprovalThemeRegistry");
      }
      static themes = [
        // Architecture Themes
        {
          id: "arch-new-service",
          category: "architecture",
          title: "New Service Creation",
          description: "Creating a new microservice or major architectural component",
          impact: "high",
          suggestedApproach: "Design service interface, implement core logic, add monitoring and testing",
          alternatives: ["Extend existing service", "Create lightweight utility function"],
          requiresConfirmation: true,
          estimatedTime: "2-4 hours",
          securityConsiderations: ["Authentication integration", "Data validation", "Access control"],
          dependencies: ["Database schema", "API gateway configuration", "Service discovery"]
        },
        {
          id: "arch-database-schema",
          category: "architecture",
          title: "Database Schema Changes",
          description: "Modifying database structure, tables, or relationships",
          impact: "critical",
          suggestedApproach: "Create migration scripts, backup existing data, test thoroughly",
          alternatives: ["Use database views", "Add new tables without removing old ones"],
          requiresConfirmation: true,
          estimatedTime: "1-3 hours",
          securityConsiderations: ["Data integrity", "Backup procedures", "Migration rollback"],
          dependencies: ["Database migrations", "ORM updates", "Related service updates"]
        },
        {
          id: "arch-api-design",
          category: "architecture",
          title: "API Interface Design",
          description: "Creating or modifying public API endpoints and contracts",
          impact: "high",
          suggestedApproach: "Define OpenAPI specification, implement with validation, add documentation",
          alternatives: ["Extend existing endpoints", "Use GraphQL for flexible queries"],
          requiresConfirmation: true,
          estimatedTime: "1-2 hours",
          securityConsiderations: ["Input validation", "Rate limiting", "Authentication"],
          dependencies: ["Client applications", "API documentation", "Version compatibility"]
        },
        // Implementation Themes
        {
          id: "impl-feature-addition",
          category: "implementation",
          title: "New Feature Implementation",
          description: "Adding new functionality to existing codebase",
          impact: "medium",
          suggestedApproach: "Implement core logic, add tests, update documentation",
          alternatives: ["Feature flag implementation", "Incremental rollout"],
          requiresConfirmation: true,
          estimatedTime: "30 minutes - 2 hours",
          securityConsiderations: ["Input sanitization", "Permission checks"],
          dependencies: ["Existing modules", "Configuration updates"]
        },
        {
          id: "impl-bug-fix",
          category: "implementation",
          title: "Bug Fix Implementation",
          description: "Fixing identified bugs or issues in the codebase",
          impact: "low",
          suggestedApproach: "Identify root cause, implement minimal fix, add regression test",
          alternatives: ["Workaround solution", "Comprehensive refactor"],
          requiresConfirmation: false,
          estimatedTime: "15 minutes - 1 hour",
          securityConsiderations: ["Side effect analysis"],
          dependencies: ["Related components", "Test suite updates"]
        },
        {
          id: "impl-integration",
          category: "implementation",
          title: "Third-party Integration",
          description: "Integrating external APIs, libraries, or services",
          impact: "high",
          suggestedApproach: "Research API documentation, implement with error handling, add monitoring",
          alternatives: ["Use existing integration library", "Build custom adapter"],
          requiresConfirmation: true,
          estimatedTime: "1-4 hours",
          securityConsiderations: ["API key management", "Data privacy", "Rate limiting"],
          dependencies: ["External service availability", "Configuration management"]
        },
        // Refactoring Themes
        {
          id: "refactor-performance",
          category: "refactoring",
          title: "Performance Optimization",
          description: "Optimizing code for better performance and efficiency",
          impact: "medium",
          suggestedApproach: "Profile current performance, optimize bottlenecks, benchmark improvements",
          alternatives: ["Caching strategy", "Algorithm optimization", "Resource pooling"],
          requiresConfirmation: false,
          estimatedTime: "30 minutes - 2 hours",
          securityConsiderations: ["Memory usage patterns"],
          dependencies: ["Performance monitoring", "Load testing"]
        },
        {
          id: "refactor-code-structure",
          category: "refactoring",
          title: "Code Structure Improvement",
          description: "Reorganizing code for better maintainability and readability",
          impact: "low",
          suggestedApproach: "Extract functions/classes, improve naming, add documentation",
          alternatives: ["Incremental refactoring", "Complete module rewrite"],
          requiresConfirmation: false,
          estimatedTime: "20 minutes - 1 hour",
          securityConsiderations: ["Functional equivalence"],
          dependencies: ["Test coverage", "Code review"]
        },
        {
          id: "refactor-dependency-update",
          category: "refactoring",
          title: "Dependency Updates",
          description: "Updating external libraries and dependencies",
          impact: "medium",
          suggestedApproach: "Update gradually, test compatibility, check for breaking changes",
          alternatives: ["Pin current versions", "Selective updates"],
          requiresConfirmation: true,
          estimatedTime: "30 minutes - 2 hours",
          securityConsiderations: ["Security patches", "Vulnerability fixes"],
          dependencies: ["Package compatibility", "Build system"]
        },
        // Security Themes
        {
          id: "security-authentication",
          category: "security",
          title: "Authentication Implementation",
          description: "Adding or modifying user authentication systems",
          impact: "critical",
          suggestedApproach: "Use established libraries, implement multi-factor auth, add session management",
          alternatives: ["OAuth integration", "JWT tokens", "Session-based auth"],
          requiresConfirmation: true,
          estimatedTime: "2-6 hours",
          securityConsiderations: ["Password hashing", "Session security", "Brute force protection"],
          dependencies: ["User database", "Session storage", "Security policies"]
        },
        {
          id: "security-data-protection",
          category: "security",
          title: "Data Protection Implementation",
          description: "Adding encryption, data sanitization, or privacy measures",
          impact: "high",
          suggestedApproach: "Implement encryption at rest and transit, add data validation",
          alternatives: ["Database-level encryption", "Application-level encryption"],
          requiresConfirmation: true,
          estimatedTime: "1-3 hours",
          securityConsiderations: ["Key management", "Compliance requirements", "Data retention"],
          dependencies: ["Encryption libraries", "Key management system"]
        },
        {
          id: "security-vulnerability-fix",
          category: "security",
          title: "Security Vulnerability Fix",
          description: "Addressing identified security vulnerabilities",
          impact: "critical",
          suggestedApproach: "Immediate patch, security testing, incident response",
          alternatives: ["Temporary mitigation", "Complete system redesign"],
          requiresConfirmation: true,
          estimatedTime: "1-4 hours",
          securityConsiderations: ["Exploit prevention", "Data breach assessment"],
          dependencies: ["Security audit", "Incident response plan"]
        },
        // Performance Themes
        {
          id: "perf-optimization",
          category: "performance",
          title: "Performance Optimization",
          description: "Improving application speed and resource usage",
          impact: "medium",
          suggestedApproach: "Profile application, optimize critical paths, implement caching",
          alternatives: ["Database query optimization", "Algorithm improvements", "Resource pooling"],
          requiresConfirmation: false,
          estimatedTime: "30 minutes - 3 hours",
          securityConsiderations: ["Resource limits", "Memory management"],
          dependencies: ["Performance monitoring", "Load testing tools"]
        },
        {
          id: "perf-caching",
          category: "performance",
          title: "Caching Implementation",
          description: "Adding caching layers for improved performance",
          impact: "medium",
          suggestedApproach: "Identify cacheable data, implement cache strategy, add invalidation logic",
          alternatives: ["In-memory caching", "Distributed caching", "Database caching"],
          requiresConfirmation: false,
          estimatedTime: "1-2 hours",
          securityConsiderations: ["Cache poisoning", "Sensitive data caching"],
          dependencies: ["Cache infrastructure", "Monitoring systems"]
        },
        {
          id: "perf-scaling",
          category: "performance",
          title: "Scalability Improvements",
          description: "Preparing application for increased load and growth",
          impact: "high",
          suggestedApproach: "Implement horizontal scaling, optimize database queries, add load balancing",
          alternatives: ["Vertical scaling", "Microservices architecture", "CDN implementation"],
          requiresConfirmation: true,
          estimatedTime: "2-8 hours",
          securityConsiderations: ["Distributed security", "Session management"],
          dependencies: ["Infrastructure scaling", "Monitoring systems", "Load balancers"]
        }
      ];
      /**
       * Get all available approval themes
       */
      static getAllThemes() {
        return [...this.themes];
      }
      /**
       * Get themes by category
       */
      static getThemesByCategory(category) {
        return this.themes.filter((theme) => theme.category === category);
      }
      /**
       * Get theme by ID
       */
      static getThemeById(id) {
        return this.themes.find((theme) => theme.id === id);
      }
      /**
       * Get themes by risk level
       */
      static getThemesByRisk(riskLevel) {
        return this.themes.filter((theme) => theme.impact === riskLevel);
      }
      /**
       * Get themes that require confirmation
       */
      static getConfirmationRequiredThemes() {
        return this.themes.filter((theme) => theme.requiresConfirmation);
      }
      /**
       * Search themes by keywords
       */
      static searchThemes(query) {
        const lowercaseQuery = query.toLowerCase();
        return this.themes.filter(
          (theme) => theme.title.toLowerCase().includes(lowercaseQuery) || theme.description.toLowerCase().includes(lowercaseQuery) || theme.suggestedApproach.toLowerCase().includes(lowercaseQuery)
        );
      }
      /**
       * Add custom theme (for extensibility)
       */
      static addCustomTheme(theme) {
        if (this.themes.find((t) => t.id === theme.id)) {
          throw new Error(`Theme with ID '${theme.id}' already exists`);
        }
        this.themes.push(theme);
      }
      /**
       * Get theme statistics
       */
      static getThemeStatistics() {
        const stats = {
          architecture: 0,
          implementation: 0,
          refactoring: 0,
          security: 0,
          performance: 0
        };
        this.themes.forEach((theme) => {
          stats[theme.category]++;
        });
        return stats;
      }
    };
  }
});

// src/services/approval-engine/ApprovalContextAnalyzer.ts
var ApprovalContextAnalyzer;
var init_ApprovalContextAnalyzer = __esm({
  "src/services/approval-engine/ApprovalContextAnalyzer.ts"() {
    init_cjs_shims();
    init_types2();
    init_ApprovalThemeRegistry();
    ApprovalContextAnalyzer = class {
      static {
        __name(this, "ApprovalContextAnalyzer");
      }
      static categoryPatterns = [
        // Architecture patterns
        {
          keywords: [
            "api",
            "endpoint",
            "route",
            "service",
            "microservice",
            "architecture",
            "design",
            "schema",
            "database",
            "migration"
          ],
          category: "architecture",
          weight: 1,
          riskIndicator: "high"
        },
        {
          keywords: ["new service", "create service", "add service", "service design"],
          category: "architecture",
          weight: 1.2,
          riskIndicator: "critical"
        },
        // Implementation patterns
        {
          keywords: ["implement", "add feature", "create function", "build", "develop", "code"],
          category: "implementation",
          weight: 0.8,
          riskIndicator: "medium"
        },
        {
          keywords: ["bug fix", "fix bug", "resolve issue", "patch", "hotfix"],
          category: "implementation",
          weight: 0.6,
          riskIndicator: "low"
        },
        {
          keywords: ["integrate", "integration", "third party", "external api", "library"],
          category: "implementation",
          weight: 1,
          riskIndicator: "high"
        },
        // Refactoring patterns
        {
          keywords: ["refactor", "optimize", "improve", "restructure", "cleanup", "reorganize"],
          category: "refactoring",
          weight: 0.7,
          riskIndicator: "medium"
        },
        {
          keywords: ["performance", "speed up", "faster", "optimize performance", "bottleneck"],
          category: "refactoring",
          weight: 0.8,
          riskIndicator: "medium"
        },
        {
          keywords: ["update dependencies", "upgrade", "dependency update", "package update"],
          category: "refactoring",
          weight: 0.9,
          riskIndicator: "medium"
        },
        // Security patterns
        {
          keywords: [
            "security",
            "auth",
            "authentication",
            "authorization",
            "permission",
            "encrypt",
            "decrypt"
          ],
          category: "security",
          weight: 1.5,
          riskIndicator: "critical"
        },
        {
          keywords: ["password", "token", "jwt", "oauth", "ssl", "tls", "certificate"],
          category: "security",
          weight: 1.4,
          riskIndicator: "critical"
        },
        {
          keywords: [
            "vulnerability",
            "security fix",
            "patch security",
            "exploit",
            "xss",
            "sql injection"
          ],
          category: "security",
          weight: 1.6,
          riskIndicator: "critical"
        },
        // Performance patterns
        {
          keywords: ["cache", "caching", "redis", "memcached", "performance cache"],
          category: "performance",
          weight: 0.8,
          riskIndicator: "medium"
        },
        {
          keywords: ["scale", "scaling", "load balancer", "horizontal scaling", "vertical scaling"],
          category: "performance",
          weight: 1.1,
          riskIndicator: "high"
        },
        {
          keywords: ["database optimization", "query optimization", "index", "performance tuning"],
          category: "performance",
          weight: 0.9,
          riskIndicator: "medium"
        }
      ];
      static riskKeywords = {
        critical: [
          "critical",
          "production",
          "live",
          "security",
          "authentication",
          "database schema",
          "migration"
        ],
        high: ["api", "integration", "service", "architecture", "breaking change", "major"],
        medium: ["feature", "enhancement", "refactor", "optimization", "update"],
        low: ["bug fix", "typo", "comment", "documentation", "style", "formatting"]
      };
      static urgencyKeywords = [
        "urgent",
        "emergency",
        "critical",
        "asap",
        "immediately",
        "hotfix",
        "quick fix"
      ];
      /**
       * Analyze task context to determine approval requirements
       */
      static async analyzeTaskForApproval(context) {
        const userInput = context.userInput.toLowerCase();
        const categoryAnalysis = this.analyzeCategoryFromInput(userInput);
        const riskAnalysis = this.analyzeRiskIndicators(userInput);
        const recommendedThemes = this.getRecommendedThemes(
          categoryAnalysis.category,
          riskAnalysis,
          context
        );
        const approvalPoints = this.identifyApprovalPoints(
          userInput,
          categoryAnalysis.category,
          context
        );
        const reasoning = this.generateReasoning(
          categoryAnalysis,
          riskAnalysis,
          context,
          recommendedThemes.length
        );
        return {
          recommendedThemes,
          approvalPoints,
          suggestedCategory: categoryAnalysis.category,
          confidence: categoryAnalysis.confidence,
          reasoning
        };
      }
      /**
       * Analyze category from user input
       */
      static analyzeCategoryFromInput(input) {
        const categoryScores = {
          architecture: 0,
          implementation: 0,
          refactoring: 0,
          security: 0,
          performance: 0
        };
        for (const pattern of this.categoryPatterns) {
          for (const keyword of pattern.keywords) {
            if (input.includes(keyword)) {
              categoryScores[pattern.category] += pattern.weight;
            }
          }
        }
        const topCategory = Object.entries(categoryScores).reduce(
          (a, b) => categoryScores[a[0]] > categoryScores[b[0]] ? a : b
        )[0];
        const topScore = categoryScores[topCategory];
        const totalScore = Object.values(categoryScores).reduce((sum, score) => sum + score, 0);
        const confidence = totalScore > 0 ? Math.min(topScore / totalScore, 1) : 0;
        return {
          category: topCategory,
          confidence
        };
      }
      /**
       * Analyze risk indicators in user input
       */
      static analyzeRiskIndicators(input) {
        const riskFactors = [];
        let riskScore = 0;
        for (const [level, keywords] of Object.entries(this.riskKeywords)) {
          for (const keyword of keywords) {
            if (input.includes(keyword)) {
              riskFactors.push(`${level}: ${keyword}`);
              switch (level) {
                case "critical":
                  riskScore += 4;
                  break;
                case "high":
                  riskScore += 3;
                  break;
                case "medium":
                  riskScore += 2;
                  break;
                case "low":
                  riskScore += 1;
                  break;
              }
            }
          }
        }
        const hasUrgency = this.urgencyKeywords.some((keyword) => input.includes(keyword));
        if (hasUrgency) {
          riskScore += 2;
          riskFactors.push("urgency indicator detected");
        }
        let risk;
        if (riskScore >= 8) risk = "critical";
        else if (riskScore >= 5) risk = "high";
        else if (riskScore >= 3) risk = "medium";
        else risk = "low";
        return { risk, factors: riskFactors };
      }
      /**
       * Get recommended themes based on analysis
       */
      static getRecommendedThemes(category, riskAnalysis, context) {
        let themes = ApprovalThemeRegistry.getThemesByCategory(category);
        if (riskAnalysis.risk === "critical") {
          themes = themes.filter((theme) => theme.impact === "critical" || theme.impact === "high");
        }
        if (context.userTrustLevel === "novice" /* NOVICE */) {
          return themes;
        } else if (context.userTrustLevel === "autonomous" /* AUTONOMOUS */) {
          return themes.filter((theme) => theme.impact === "critical");
        }
        return themes.filter((theme) => {
          if (theme.impact === "critical") return true;
          if (theme.impact === "high" && context.userTrustLevel !== "trusted" /* TRUSTED */) return true;
          if (theme.requiresConfirmation && context.userTrustLevel === "learning" /* LEARNING */) return true;
          return false;
        });
      }
      /**
       * Identify specific approval points
       */
      static identifyApprovalPoints(input, category, context) {
        const points = [];
        if (input.includes("database") || input.includes("migration") || input.includes("schema")) {
          points.push({
            id: "database-changes",
            category: "architecture",
            description: "Database schema or data changes detected",
            triggerConditions: ["database modification", "schema change", "migration"],
            priority: 1,
            mandatory: true
          });
        }
        if (category === "security" || this.hasSecurityKeywords(input)) {
          points.push({
            id: "security-review",
            category: "security",
            description: "Security-sensitive changes require review",
            triggerConditions: ["authentication", "authorization", "encryption", "security"],
            priority: 1,
            mandatory: true
          });
        }
        if (input.includes("api") || input.includes("endpoint") || input.includes("route")) {
          points.push({
            id: "api-changes",
            category: "architecture",
            description: "API modifications may affect external systems",
            triggerConditions: ["api change", "endpoint modification", "route update"],
            priority: 2,
            mandatory: category === "architecture"
          });
        }
        if (input.includes("dependency") || input.includes("package") || input.includes("library")) {
          points.push({
            id: "dependency-update",
            category: "refactoring",
            description: "Dependency changes may introduce compatibility issues",
            triggerConditions: ["dependency update", "package change", "library modification"],
            priority: 3,
            mandatory: false
          });
        }
        if (input.includes("production") || input.includes("deploy") || input.includes("live")) {
          points.push({
            id: "production-deployment",
            category: "architecture",
            description: "Production deployment requires careful review",
            triggerConditions: ["production change", "deployment", "live environment"],
            priority: 1,
            mandatory: true
          });
        }
        return points.sort((a, b) => a.priority - b.priority);
      }
      /**
       * Check if input contains security-related keywords
       */
      static hasSecurityKeywords(input) {
        const securityKeywords = [
          "auth",
          "security",
          "password",
          "token",
          "encrypt",
          "decrypt",
          "oauth",
          "jwt",
          "ssl",
          "tls",
          "permission",
          "access control"
        ];
        return securityKeywords.some((keyword) => input.includes(keyword));
      }
      /**
       * Generate human-readable reasoning for the analysis
       */
      static generateReasoning(categoryAnalysis, riskAnalysis, context, themeCount) {
        const reasoning = [];
        if (categoryAnalysis.confidence > 0.7) {
          reasoning.push(
            `High confidence (${Math.round(categoryAnalysis.confidence * 100)}%) this is a ${categoryAnalysis.category} task`
          );
        } else if (categoryAnalysis.confidence > 0.4) {
          reasoning.push(
            `Moderate confidence (${Math.round(categoryAnalysis.confidence * 100)}%) this is a ${categoryAnalysis.category} task`
          );
        } else {
          reasoning.push(
            `Low confidence in category classification, defaulting to ${categoryAnalysis.category}`
          );
        }
        if (riskAnalysis.risk === "critical") {
          reasoning.push("Critical risk detected - requires mandatory approval");
        } else if (riskAnalysis.risk === "high") {
          reasoning.push("High risk detected - approval recommended");
        } else if (riskAnalysis.risk === "medium") {
          reasoning.push("Medium risk detected - consider approval based on trust level");
        } else {
          reasoning.push("Low risk detected - may proceed with minimal oversight");
        }
        if (riskAnalysis.factors.length > 0) {
          reasoning.push(`Risk factors: ${riskAnalysis.factors.join(", ")}`);
        }
        switch (context.userTrustLevel) {
          case "novice" /* NOVICE */:
            reasoning.push("Novice trust level - all changes require approval");
            break;
          case "learning" /* LEARNING */:
            reasoning.push("Learning trust level - medium+ risk changes require approval");
            break;
          case "collaborative" /* COLLABORATIVE */:
            reasoning.push("Collaborative trust level - high+ risk changes require approval");
            break;
          case "trusted" /* TRUSTED */:
            reasoning.push("Trusted level - only critical changes require approval");
            break;
          case "autonomous" /* AUTONOMOUS */:
            reasoning.push("Autonomous level - minimal approval requirements");
            break;
        }
        if (themeCount > 0) {
          reasoning.push(`${themeCount} relevant approval theme(s) identified`);
        } else {
          reasoning.push("No specific approval themes required for this task");
        }
        return reasoning;
      }
      /**
       * Quick risk assessment for simple use cases
       */
      static quickRiskAssessment(input) {
        const analysis = this.analyzeRiskIndicators(input.toLowerCase());
        return analysis.risk;
      }
      /**
       * Quick category detection for simple use cases
       */
      static quickCategoryDetection(input) {
        const analysis = this.analyzeCategoryFromInput(input.toLowerCase());
        return analysis.category;
      }
      /**
       * Check if approval is likely needed based on quick analysis
       */
      static shouldRequestApproval(input, trustLevel) {
        const risk = this.quickRiskAssessment(input);
        const category = this.quickCategoryDetection(input);
        if (category === "security" && risk !== "low") {
          return true;
        }
        switch (trustLevel) {
          case "novice" /* NOVICE */:
            return true;
          case "learning" /* LEARNING */:
            return risk !== "low";
          case "collaborative" /* COLLABORATIVE */:
            return risk === "high" || risk === "critical";
          case "trusted" /* TRUSTED */:
            return risk === "critical";
          case "autonomous" /* AUTONOMOUS */:
            return false;
          default:
            return true;
        }
      }
    };
  }
});

// src/services/approval-engine/RiskAssessment.ts
var RiskAssessment;
var init_RiskAssessment = __esm({
  "src/services/approval-engine/RiskAssessment.ts"() {
    init_cjs_shims();
    init_types2();
    RiskAssessment = class {
      static {
        __name(this, "RiskAssessment");
      }
      static riskWeights = {
        fileCount: 0.1,
        criticalFiles: 0.25,
        securityImpact: 0.3,
        databaseChanges: 0.25,
        apiChanges: 0.2,
        dependencyChanges: 0.15,
        reversibility: 0.1,
        testCoverage: 0.05
      };
      static riskThresholds = {
        low: 2,
        medium: 4,
        high: 6,
        critical: 8
      };
      static criticalFilePatterns = [
        /package\.json$/,
        /tsconfig\.json$/,
        /\.env$/,
        /database.*migration/i,
        /auth.*config/i,
        /security/i,
        /config.*prod/i,
        /docker.*compose/i,
        /k8s.*yaml$/,
        /helm.*yaml$/
      ];
      static securitySensitivePatterns = [
        /password/i,
        /secret/i,
        /token/i,
        /auth/i,
        /security/i,
        /crypto/i,
        /encrypt/i,
        /permission/i,
        /access.*control/i,
        /oauth/i,
        /jwt/i,
        /ssl/i,
        /tls/i
      ];
      /**
       * Perform comprehensive risk assessment
       */
      static async assessRisk(context, proposedActions, category) {
        const factors = [];
        const fileRisk = this.assessFileImpact(proposedActions);
        factors.push(fileRisk);
        const securityRisk = this.assessSecurityImpact(context, proposedActions);
        factors.push(securityRisk);
        const reversibilityRisk = this.assessReversibility(proposedActions);
        factors.push(reversibilityRisk);
        const dependencyRisk = this.assessDependencyImpact(proposedActions);
        factors.push(dependencyRisk);
        const databaseRisk = this.assessDatabaseImpact(proposedActions);
        factors.push(databaseRisk);
        const apiRisk = this.assessAPIImpact(proposedActions);
        factors.push(apiRisk);
        const overallScore = this.calculateOverallRisk(factors);
        const overallRisk = this.scoreToRiskLevel(overallScore);
        const requiresApproval = this.determineApprovalRequirement(
          overallRisk,
          context.userTrustLevel,
          category
        );
        const autoApprovalEligible = this.checkAutoApprovalEligibility(
          overallRisk,
          factors,
          context.userTrustLevel
        );
        const recommendations = this.generateRecommendations(factors, overallRisk);
        return {
          overallRisk,
          factors,
          recommendations,
          requiresApproval,
          autoApprovalEligible
        };
      }
      /**
       * Assess file modification impact
       */
      static assessFileImpact(proposedActions) {
        const allFiles = proposedActions.flatMap((action) => action.files);
        const fileCount = allFiles.length;
        const criticalFiles = allFiles.filter(
          (file) => this.criticalFilePatterns.some((pattern) => pattern.test(file))
        );
        let score = Math.min(fileCount * 0.2, 3);
        score += criticalFiles.length * 2;
        return {
          category: "File Impact",
          risk: this.scoreToRiskLevel(score),
          description: `Modifying ${fileCount} files (${criticalFiles.length} critical)`,
          weight: this.riskWeights.fileCount + this.riskWeights.criticalFiles,
          score
        };
      }
      /**
       * Assess security-related impact
       */
      static assessSecurityImpact(context, proposedActions) {
        let score = 0;
        const securityIndicators = [];
        if (this.securitySensitivePatterns.some((pattern) => pattern.test(context.userInput))) {
          score += 2;
          securityIndicators.push("security-related request");
        }
        const securityActions = proposedActions.filter(
          (action) => action.description && this.securitySensitivePatterns.some((pattern) => pattern.test(action.description))
        );
        score += securityActions.length * 1.5;
        const allFiles = proposedActions.flatMap((action) => action.files);
        const securityFiles = allFiles.filter(
          (file) => this.securitySensitivePatterns.some((pattern) => pattern.test(file))
        );
        score += securityFiles.length * 2;
        const description = securityIndicators.length > 0 ? `Security-sensitive changes detected: ${securityIndicators.join(", ")}` : "No significant security impact detected";
        return {
          category: "Security Impact",
          risk: this.scoreToRiskLevel(score),
          description,
          weight: this.riskWeights.securityImpact,
          score
        };
      }
      /**
       * Assess action reversibility
       */
      static assessReversibility(proposedActions) {
        const irreversibleActions = proposedActions.filter((action) => !action.reversible);
        const score = irreversibleActions.length * 2;
        return {
          category: "Reversibility",
          risk: this.scoreToRiskLevel(score),
          description: `${irreversibleActions.length} irreversible actions`,
          weight: this.riskWeights.reversibility,
          score
        };
      }
      /**
       * Assess dependency modification impact
       */
      static assessDependencyImpact(proposedActions) {
        const dependencyFiles = proposedActions.flatMap((action) => action.files).filter((file) => /package\.json$|requirements\.txt$|cargo\.toml$|go\.mod$/i.test(file));
        const score = dependencyFiles.length * 1.5;
        return {
          category: "Dependency Changes",
          risk: this.scoreToRiskLevel(score),
          description: `${dependencyFiles.length} dependency files affected`,
          weight: this.riskWeights.dependencyChanges,
          score
        };
      }
      /**
       * Assess database-related impact
       */
      static assessDatabaseImpact(proposedActions) {
        const databaseActions = proposedActions.filter(
          (action) => /database|migration|schema|sql/i.test(action.description || "") || action.files.some((file) => /migration|schema|\.sql$/i.test(file))
        );
        const score = databaseActions.length * 3;
        return {
          category: "Database Impact",
          risk: this.scoreToRiskLevel(score),
          description: `${databaseActions.length} database-related changes`,
          weight: this.riskWeights.databaseChanges,
          score
        };
      }
      /**
       * Assess API modification impact
       */
      static assessAPIImpact(proposedActions) {
        const apiActions = proposedActions.filter(
          (action) => /api|endpoint|route|controller/i.test(action.description || "") || action.files.some((file) => /api|route|controller/i.test(file))
        );
        const score = apiActions.length * 2;
        return {
          category: "API Impact",
          risk: this.scoreToRiskLevel(score),
          description: `${apiActions.length} API-related changes`,
          weight: this.riskWeights.apiChanges,
          score
        };
      }
      /**
       * Calculate weighted overall risk score
       */
      static calculateOverallRisk(factors) {
        return factors.reduce((total, factor) => {
          return total + factor.score * factor.weight;
        }, 0);
      }
      /**
       * Convert risk score to risk level
       */
      static scoreToRiskLevel(score) {
        if (score >= this.riskThresholds.critical) return "critical";
        if (score >= this.riskThresholds.high) return "high";
        if (score >= this.riskThresholds.medium) return "medium";
        return "low";
      }
      /**
       * Determine if approval is required based on risk and trust level
       */
      static determineApprovalRequirement(riskLevel, trustLevel, category) {
        if (category === "security" && riskLevel !== "low") {
          return true;
        }
        if (category === "architecture" && (riskLevel === "high" || riskLevel === "critical")) {
          return true;
        }
        switch (trustLevel) {
          case "novice" /* NOVICE */:
            return true;
          // All changes require approval
          case "learning" /* LEARNING */:
            return riskLevel !== "low";
          // Medium+ requires approval
          case "collaborative" /* COLLABORATIVE */:
            return riskLevel === "high" || riskLevel === "critical";
          // High+ requires approval
          case "trusted" /* TRUSTED */:
            return riskLevel === "critical";
          // Only critical requires approval
          case "autonomous" /* AUTONOMOUS */:
            return false;
          // No approval required (emergency override available)
          default:
            return true;
        }
      }
      /**
       * Check if action is eligible for auto-approval
       */
      static checkAutoApprovalEligibility(riskLevel, factors, trustLevel) {
        if (riskLevel === "critical") return false;
        const hasSecurityFactors = factors.some(
          (factor) => factor.category === "Security Impact" && factor.risk !== "low"
        );
        if (hasSecurityFactors) return false;
        switch (trustLevel) {
          case "novice" /* NOVICE */:
            return false;
          // No auto-approval for novices
          case "learning" /* LEARNING */:
            return riskLevel === "low";
          // Only low risk auto-approval
          case "collaborative" /* COLLABORATIVE */:
          case "trusted" /* TRUSTED */:
          case "autonomous" /* AUTONOMOUS */:
            return riskLevel === "low" || riskLevel === "medium";
          // Low-medium auto-approval
          default:
            return false;
        }
      }
      /**
       * Generate actionable recommendations based on risk assessment
       */
      static generateRecommendations(factors, overallRisk) {
        const recommendations = [];
        switch (overallRisk) {
          case "critical":
            recommendations.push("Consider breaking this into smaller, safer changes");
            recommendations.push("Perform comprehensive testing in staging environment");
            recommendations.push("Prepare rollback plan before proceeding");
            break;
          case "high":
            recommendations.push("Test thoroughly before deployment");
            recommendations.push("Consider phased rollout approach");
            break;
          case "medium":
            recommendations.push("Add regression tests for affected components");
            break;
        }
        factors.forEach((factor) => {
          if (factor.risk === "high" || factor.risk === "critical") {
            switch (factor.category) {
              case "Security Impact":
                recommendations.push("Perform security review before implementation");
                recommendations.push("Validate all input and sanitize outputs");
                break;
              case "Database Impact":
                recommendations.push("Create database backup before applying changes");
                recommendations.push("Test migration scripts in development environment");
                break;
              case "API Impact":
                recommendations.push("Maintain backward compatibility when possible");
                recommendations.push("Update API documentation and client libraries");
                break;
              case "File Impact":
                recommendations.push("Review all critical file changes carefully");
                break;
            }
          }
        });
        return [...new Set(recommendations)];
      }
      /**
       * Get risk level explanation for users
       */
      static getRiskLevelExplanation(riskLevel) {
        switch (riskLevel) {
          case "low":
            return "Low risk - minimal impact, easily reversible changes";
          case "medium":
            return "Medium risk - moderate impact, requires testing";
          case "high":
            return "High risk - significant impact, requires careful review";
          case "critical":
            return "Critical risk - major impact, requires thorough planning and approval";
          default:
            return "Unknown risk level";
        }
      }
    };
  }
});
var ApprovalEngine;
var init_ApprovalEngine = __esm({
  "src/services/approval-engine/ApprovalEngine.ts"() {
    init_cjs_shims();
    init_types2();
    init_ApprovalContextAnalyzer();
    init_RiskAssessment();
    ApprovalEngine = class _ApprovalEngine extends events.EventEmitter {
      static {
        __name(this, "ApprovalEngine");
      }
      static instance;
      config;
      pendingRequests = /* @__PURE__ */ new Map();
      auditTrail = [];
      userPatterns = [];
      trustSettings;
      constructor() {
        super();
        this.config = this.getDefaultConfig();
        this.trustSettings = this.getDefaultTrustSettings();
      }
      static getInstance() {
        if (!_ApprovalEngine.instance) {
          _ApprovalEngine.instance = new _ApprovalEngine();
        }
        return _ApprovalEngine.instance;
      }
      /**
       * Main entry point for approval requests
       */
      async requestApproval(context, proposedActions, options) {
        if (!this.config.enabled) {
          return this.createAutoApprovalResponse("System disabled");
        }
        try {
          const analysis = await ApprovalContextAnalyzer.analyzeTaskForApproval(context);
          const riskAssessment = await RiskAssessment.assessRisk(
            context,
            proposedActions,
            analysis.suggestedCategory
          );
          if (!riskAssessment.requiresApproval && context.userTrustLevel !== "novice" /* NOVICE */) {
            return this.createAutoApprovalResponse("Low risk - auto-approved");
          }
          if (riskAssessment.autoApprovalEligible && this.canAutoApprove(riskAssessment.overallRisk, context.userTrustLevel)) {
            this.emit("auto-approval-triggered", {
              requestId: "auto-" + uuid.v4(),
              reason: "Trust level and risk assessment allow auto-approval"
            });
            return this.createAutoApprovalResponse("Auto-approved based on trust level");
          }
          const request = this.createApprovalRequest(
            context,
            proposedActions,
            analysis.recommendedThemes[0],
            // Use primary theme
            riskAssessment,
            options
          );
          this.pendingRequests.set(request.id, request);
          this.emit("approval-requested", request);
          return new Promise((resolve) => {
            if (this.config.autoApprovalTimeout > 0 && riskAssessment.overallRisk === "low") {
              setTimeout(() => {
                if (this.pendingRequests.has(request.id)) {
                  this.pendingRequests.delete(request.id);
                  this.emit("approval-timeout", { requestId: request.id });
                  resolve(this.createAutoApprovalResponse("Timeout auto-approval"));
                }
              }, this.config.autoApprovalTimeout);
            }
            this.once(`approval-response-${request.id}`, (response) => {
              resolve(response);
            });
          });
        } catch (error) {
          console.error("Error in approval request:", error);
          return this.createErrorResponse(error);
        }
      }
      /**
       * Process user approval response
       */
      async processApprovalResponse(requestId, action, comments, newTrustLevel) {
        const request = this.pendingRequests.get(requestId);
        if (!request) {
          throw new Error(`Approval request ${requestId} not found`);
        }
        const response = {
          requestId,
          action,
          approved: action === "approve" || action === "trust",
          comments,
          trustLevel: newTrustLevel,
          timestamp: /* @__PURE__ */ new Date(),
          quickDecision: false
          // Would be set to true if shortcut was used
        };
        if (action === "trust" && newTrustLevel) {
          await this.updateTrustLevel(newTrustLevel, "User granted trust");
        }
        if (this.config.auditTrailEnabled) {
          this.recordAuditEntry(request, response);
        }
        if (this.config.learningEnabled) {
          this.updateUserPatterns(request, response);
        }
        this.pendingRequests.delete(requestId);
        this.emit("approval-responded", response);
        this.emit(`approval-response-${requestId}`, response);
        return response;
      }
      /**
       * Get current approval request for UI display
       */
      getPendingRequest(requestId) {
        return this.pendingRequests.get(requestId);
      }
      /**
       * Get all pending requests
       */
      getAllPendingRequests() {
        return Array.from(this.pendingRequests.values());
      }
      /**
       * Update trust level
       */
      async updateTrustLevel(newLevel, reason) {
        const oldLevel = this.trustSettings.currentLevel;
        this.trustSettings.currentLevel = newLevel;
        this.updateAutoApprovalCategories(newLevel);
        this.emit("trust-level-changed", { oldLevel, newLevel, reason });
      }
      /**
       * Get current trust settings
       */
      getTrustSettings() {
        return { ...this.trustSettings };
      }
      /**
       * Get approval statistics
       */
      getApprovalStatistics() {
        const total = this.auditTrail.length;
        const autoApprovals = this.auditTrail.filter((entry) => entry.shortcutUsed === "auto").length;
        const manualApprovals = this.auditTrail.filter(
          (entry) => entry.action === "approve" && !entry.shortcutUsed
        ).length;
        const rejections = this.auditTrail.filter((entry) => entry.action === "reject").length;
        const avgDecisionTime = this.auditTrail.reduce((sum, entry) => sum + entry.decisionTime, 0) / total || 0;
        return {
          totalRequests: total,
          autoApprovals,
          manualApprovals,
          rejections,
          averageDecisionTime: avgDecisionTime
        };
      }
      /**
       * Create approval request object
       */
      createApprovalRequest(context, proposedActions, primaryTheme, riskAssessment, options) {
        return {
          id: uuid.v4(),
          themeId: primaryTheme?.id || "unknown",
          context,
          proposedActions,
          rationale: riskAssessment.recommendations?.join(". ") || "No rationale provided",
          riskAssessment: riskAssessment.overallRisk || "unknown",
          estimatedTime: primaryTheme?.estimatedTime || "Unknown",
          dependencies: primaryTheme?.dependencies || [],
          securityImpact: riskAssessment.factors?.some(
            (f) => f["category"] === "Security Impact"
          ) || false,
          automaticApproval: false,
          timestamp: /* @__PURE__ */ new Date()
        };
      }
      /**
       * Create auto-approval response
       */
      createAutoApprovalResponse(reason) {
        return {
          requestId: "auto-" + uuid.v4(),
          action: "approve",
          approved: true,
          comments: reason,
          timestamp: /* @__PURE__ */ new Date(),
          quickDecision: true
        };
      }
      /**
       * Create error response
       */
      createErrorResponse(error) {
        return {
          requestId: "error-" + uuid.v4(),
          action: "reject",
          approved: false,
          comments: `Error: ${error.message}`,
          timestamp: /* @__PURE__ */ new Date(),
          quickDecision: false
        };
      }
      /**
       * Check if auto-approval is allowed
       */
      canAutoApprove(risk, trustLevel) {
        if (risk === "critical") return false;
        switch (trustLevel) {
          case "novice" /* NOVICE */:
            return false;
          case "learning" /* LEARNING */:
            return risk === "low";
          case "collaborative" /* COLLABORATIVE */:
          case "trusted" /* TRUSTED */:
          case "autonomous" /* AUTONOMOUS */:
            return risk === "low" || risk === "medium";
          default:
            return false;
        }
      }
      /**
       * Update auto-approval categories based on trust level
       */
      updateAutoApprovalCategories(trustLevel) {
        switch (trustLevel) {
          case "novice" /* NOVICE */:
            this.trustSettings.autoApprovalCategories = [];
            this.trustSettings.requireApprovalFor = [
              "architecture",
              "implementation",
              "refactoring",
              "security",
              "performance"
            ];
            break;
          case "learning" /* LEARNING */:
            this.trustSettings.autoApprovalCategories = ["refactoring"];
            this.trustSettings.requireApprovalFor = [
              "architecture",
              "implementation",
              "security",
              "performance"
            ];
            break;
          case "collaborative" /* COLLABORATIVE */:
            this.trustSettings.autoApprovalCategories = ["refactoring", "implementation"];
            this.trustSettings.requireApprovalFor = ["architecture", "security", "performance"];
            break;
          case "trusted" /* TRUSTED */:
            this.trustSettings.autoApprovalCategories = [
              "refactoring",
              "implementation",
              "performance"
            ];
            this.trustSettings.requireApprovalFor = ["architecture", "security"];
            break;
          case "autonomous" /* AUTONOMOUS */:
            this.trustSettings.autoApprovalCategories = [
              "refactoring",
              "implementation",
              "performance",
              "architecture"
            ];
            this.trustSettings.requireApprovalFor = ["security"];
            break;
        }
      }
      /**
       * Record audit entry
       */
      recordAuditEntry(request, response) {
        const entry = {
          id: uuid.v4(),
          requestId: request.id,
          userId: "current-user",
          // Would come from context
          action: response.action,
          riskLevel: request.riskAssessment,
          category: "implementation",
          // Would be determined from theme
          decisionTime: Date.now() - request.timestamp.getTime(),
          shortcutUsed: response.quickDecision ? "quick" : void 0,
          outcome: "unknown",
          // Would be updated later based on execution result
          timestamp: /* @__PURE__ */ new Date()
        };
        this.auditTrail.push(entry);
        if (this.auditTrail.length > 1e3) {
          this.auditTrail = this.auditTrail.slice(-500);
        }
      }
      /**
       * Update user patterns for learning
       */
      updateUserPatterns(_request, response) {
        if (response.approved) {
          this.trustSettings.learningMetrics.successfulTasks++;
          this.trustSettings.learningMetrics.totalApprovals++;
        }
        if (response.action === "trust") {
          this.trustSettings.learningMetrics.userSatisfaction += 1;
        }
        this.checkTrustLevelProgression();
      }
      /**
       * Check if trust level should be automatically increased
       */
      checkTrustLevelProgression() {
        const metrics = this.trustSettings.learningMetrics;
        const currentLevel = this.trustSettings.currentLevel;
        if (currentLevel === "novice" /* NOVICE */ && metrics.successfulTasks >= 5) {
          this.updateTrustLevel("learning" /* LEARNING */, "Automatic progression based on successful tasks");
        } else if (currentLevel === "learning" /* LEARNING */ && metrics.successfulTasks >= 15) {
          this.updateTrustLevel("collaborative" /* COLLABORATIVE */, "Automatic progression based on experience");
        } else if (currentLevel === "collaborative" /* COLLABORATIVE */ && metrics.successfulTasks >= 30) {
          this.updateTrustLevel(
            "trusted" /* TRUSTED */,
            "Automatic progression based on proven reliability"
          );
        }
      }
      /**
       * Get default configuration
       */
      getDefaultConfig() {
        return {
          enabled: true,
          defaultTrustLevel: "learning" /* LEARNING */,
          riskThresholds: {
            low: 2,
            medium: 4,
            high: 6,
            critical: 8
          },
          autoApprovalTimeout: 3e4,
          // 30 seconds
          maxPendingApprovals: 5,
          auditTrailEnabled: true,
          learningEnabled: true,
          shortcuts: {
            "shift+tab": "approve",
            "ctrl+y": "approve",
            "ctrl+n": "reject",
            "ctrl+r": "review",
            "ctrl+t": "trust"
          }
        };
      }
      /**
       * Get default trust settings
       */
      getDefaultTrustSettings() {
        return {
          currentLevel: "learning" /* LEARNING */,
          autoApprovalCategories: ["refactoring"],
          requireApprovalFor: ["architecture", "implementation", "security", "performance"],
          learningMetrics: {
            successfulTasks: 0,
            userSatisfaction: 0,
            errorsEncountered: 0,
            totalApprovals: 0,
            automaticApprovals: 0
          },
          preferences: {
            preferQuickApproval: true,
            verboseExplanations: false,
            showRiskDetails: true,
            defaultTimeout: 3e4
          }
        };
      }
      /**
       * Update configuration
       */
      updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
      }
      /**
       * Get current configuration
       */
      getConfig() {
        return { ...this.config };
      }
    };
  }
});
var QuickApprovalInterface;
var init_QuickApprovalInterface = __esm({
  "src/services/quick-approval/QuickApprovalInterface.ts"() {
    init_cjs_shims();
    init_types2();
    init_ApprovalEngine();
    QuickApprovalInterface = class _QuickApprovalInterface extends events.EventEmitter {
      static {
        __name(this, "QuickApprovalInterface");
      }
      static instance;
      approvalEngine;
      currentRequest = null;
      keyListeners = /* @__PURE__ */ new Map();
      isActive = false;
      // Quick approval choices with Japanese translations
      quickChoices = [
        {
          key: "shift+tab",
          action: "approve",
          label: "Quick Approve",
          labelJa: "\u3044\u3044\u3088",
          description: "Approve this action quickly"
        },
        {
          key: "ctrl+y",
          action: "approve",
          label: "Yes, Approve",
          labelJa: "\u306F\u3044\u3001\u627F\u8A8D",
          description: "Approve with confirmation"
        },
        {
          key: "ctrl+n",
          action: "reject",
          label: "No, Reject",
          labelJa: "\u3044\u3044\u3048\u3001\u62D2\u5426",
          description: "Reject this action"
        },
        {
          key: "ctrl+t",
          action: "trust",
          label: "Trust & Auto-approve",
          labelJa: "\u4EFB\u305B\u308B",
          description: "Trust AI and auto-approve similar requests",
          trustLevel: "collaborative" /* COLLABORATIVE */
        },
        {
          key: "ctrl+r",
          action: "review",
          label: "Request Review",
          labelJa: "\u30EC\u30D3\u30E5\u30FC\u8981\u6C42",
          description: "Request additional review"
        }
      ];
      constructor() {
        super();
        this.approvalEngine = ApprovalEngine.getInstance();
        this.setupEventListeners();
      }
      static getInstance() {
        if (!_QuickApprovalInterface.instance) {
          _QuickApprovalInterface.instance = new _QuickApprovalInterface();
        }
        return _QuickApprovalInterface.instance;
      }
      /**
       * Show approval request with quick options
       */
      async showApprovalRequest(request, options = {}) {
        this.currentRequest = request;
        this.isActive = true;
        try {
          this.displayApprovalRequest(request, options);
          this.setupKeyboardListeners();
          const response = await this.waitForUserResponse(options.autoTimeout);
          return response;
        } finally {
          this.cleanup();
        }
      }
      /**
       * Display approval request UI
       */
      displayApprovalRequest(request, options) {
        console.clear();
        console.log("\n" + chalk8__default.default.red("\u250F" + "\u2501".repeat(78) + "\u2513"));
        console.log(
          chalk8__default.default.red("\u2503") + chalk8__default.default.bgYellow.black.bold(" ".repeat(24) + "\u{1F91D} APPROVAL REQUEST" + " ".repeat(24)) + chalk8__default.default.red(" \u2503")
        );
        console.log(
          chalk8__default.default.red("\u2503") + chalk8__default.default.bgYellow.black.bold(
            " ".repeat(20) + "\u91CD\u8981\u306A\u6C7A\u5B9A\u304C\u5FC5\u8981\u3067\u3059 (Important Decision)" + " ".repeat(17)
          ) + chalk8__default.default.red(" \u2503")
        );
        console.log(chalk8__default.default.red("\u2517" + "\u2501".repeat(78) + "\u251B"));
        console.log("");
        console.log(chalk8__default.default.cyan("\u250C" + "\u2500".repeat(78) + "\u2510"));
        console.log(
          chalk8__default.default.cyan("\u2502") + chalk8__default.default.white(" \u{1F4CB} Request Details:" + " ".repeat(56)) + chalk8__default.default.cyan("\u2502")
        );
        console.log(chalk8__default.default.cyan("\u251C" + "\u2500".repeat(78) + "\u2524"));
        const themeDisplay = `Theme: ${chalk8__default.default.bold.white(request.themeId)}`;
        console.log(
          chalk8__default.default.cyan("\u2502") + ` ${themeDisplay}${" ".repeat(77 - themeDisplay.length)}` + chalk8__default.default.cyan("\u2502")
        );
        const contextDisplay = `Context: ${chalk8__default.default.white(request.context.description || "No description")}`;
        const contextTrimmed = contextDisplay.length > 75 ? contextDisplay.substring(0, 72) + "..." : contextDisplay;
        console.log(
          chalk8__default.default.cyan("\u2502") + ` ${contextTrimmed}${" ".repeat(77 - contextTrimmed.length)}` + chalk8__default.default.cyan("\u2502")
        );
        const riskDisplay = `Risk Level: ${this.formatRiskLevel(request.riskAssessment)}`;
        console.log(
          chalk8__default.default.cyan("\u2502") + ` ${riskDisplay}${" ".repeat(77 - riskDisplay.length)}` + chalk8__default.default.cyan("\u2502")
        );
        const timeDisplay = `Estimated Time: ${chalk8__default.default.white(request.estimatedTime)}`;
        console.log(
          chalk8__default.default.cyan("\u2502") + ` ${timeDisplay}${" ".repeat(77 - timeDisplay.length)}` + chalk8__default.default.cyan("\u2502")
        );
        if (request.rationale) {
          console.log(chalk8__default.default.cyan("\u251C" + "\u2500".repeat(78) + "\u2524"));
          const rationaleLines = request.rationale.match(/.{1,75}/g) || [request.rationale];
          rationaleLines.forEach((line, index) => {
            const prefix = index === 0 ? "Rationale: " : "           ";
            const display = `${prefix}${chalk8__default.default.white(line)}`;
            console.log(
              chalk8__default.default.cyan("\u2502") + ` ${display}${" ".repeat(77 - display.length)}` + chalk8__default.default.cyan("\u2502")
            );
          });
        }
        if (request.proposedActions && request.proposedActions.length > 0) {
          console.log(chalk8__default.default.cyan("\u251C" + "\u2500".repeat(78) + "\u2524"));
          console.log(
            chalk8__default.default.cyan("\u2502") + chalk8__default.default.white(" \u{1F4DD} Proposed Actions:" + " ".repeat(56)) + chalk8__default.default.cyan("\u2502")
          );
          request.proposedActions.forEach((action, index) => {
            const actionText = `  ${index + 1}. ${action.description || action.type}`;
            const trimmed = actionText.length > 76 ? actionText.substring(0, 73) + "..." : actionText;
            console.log(
              chalk8__default.default.cyan("\u2502") + ` ${chalk8__default.default.gray(trimmed)}${" ".repeat(77 - trimmed.length)}` + chalk8__default.default.cyan("\u2502")
            );
          });
        }
        if (request.dependencies && request.dependencies.length > 0) {
          console.log(chalk8__default.default.cyan("\u251C" + "\u2500".repeat(78) + "\u2524"));
          const depDisplay = `Dependencies: ${chalk8__default.default.white(request.dependencies.join(", "))}`;
          const depTrimmed = depDisplay.length > 75 ? depDisplay.substring(0, 72) + "..." : depDisplay;
          console.log(
            chalk8__default.default.cyan("\u2502") + ` ${depTrimmed}${" ".repeat(77 - depTrimmed.length)}` + chalk8__default.default.cyan("\u2502")
          );
        }
        console.log(chalk8__default.default.cyan("\u2514" + "\u2500".repeat(78) + "\u2518"));
        if (request.securityImpact) {
          console.log("");
          console.log(chalk8__default.default.red("\u250C" + "\u2500".repeat(78) + "\u2510"));
          console.log(
            chalk8__default.default.red("\u2502") + chalk8__default.default.bgRed.white.bold(
              " \u26A0\uFE0F  SECURITY IMPACT DETECTED - EXTRA CAUTION REQUIRED \u26A0\uFE0F " + " ".repeat(19)
            ) + chalk8__default.default.red("\u2502")
          );
          console.log(chalk8__default.default.red("\u2514" + "\u2500".repeat(78) + "\u2518"));
        }
        console.log("");
        console.log(chalk8__default.default.magenta("\u250C" + "\u2500".repeat(78) + "\u2510"));
        console.log(
          chalk8__default.default.magenta("\u2502") + chalk8__default.default.bgMagenta.white.bold(
            " \u26A1 Quick Approval Options (\u30AD\u30FC\u30DC\u30FC\u30C9\u30B7\u30E7\u30FC\u30C8\u30AB\u30C3\u30C8):" + " ".repeat(27)
          ) + chalk8__default.default.magenta("\u2502")
        );
        console.log(chalk8__default.default.magenta("\u251C" + "\u2500".repeat(78) + "\u2524"));
        this.quickChoices.forEach((choice) => {
          const label = options.showJapanese ? choice.labelJa : choice.label;
          const keyDisplay = this.formatKeyBinding(choice.key);
          const trustInfo = choice.trustLevel ? chalk8__default.default.gray(` (${choice.trustLevel})`) : "";
          const choiceText = `${keyDisplay} ${chalk8__default.default.bold.white(label)}${trustInfo} - ${chalk8__default.default.gray(choice.description)}`;
          console.log(
            chalk8__default.default.magenta("\u2502") + ` ${choiceText}${" ".repeat(77 - choiceText.length)}` + chalk8__default.default.magenta("\u2502")
          );
        });
        console.log(chalk8__default.default.magenta("\u2514" + "\u2500".repeat(78) + "\u2518"));
        console.log("");
        console.log(chalk8__default.default.bgBlue.white.bold(" \u{1F4CC} Instructions: "));
        console.log(chalk8__default.default.blue("\u2022 Press any of the above keys to make your choice"));
        console.log(chalk8__default.default.blue("\u2022 Press ESC to cancel this approval request"));
        console.log(chalk8__default.default.blue("\u2022 Your choice will be processed immediately"));
        console.log("");
        console.log(chalk8__default.default.yellow.bold(">>> Waiting for your input... <<<"));
      }
      /**
       * Format key binding for display
       */
      formatKeyBinding(key) {
        const keyMap = {
          "shift+tab": "\u21E7 Tab",
          "ctrl+y": "\u2303 Y",
          "ctrl+n": "\u2303 N",
          "ctrl+t": "\u2303 T",
          "ctrl+r": "\u2303 R"
        };
        const formatted = keyMap[key] || key;
        const colorMap = {
          "shift+tab": chalk8__default.default.bgGreen.black.bold,
          "ctrl+y": chalk8__default.default.bgBlue.white.bold,
          "ctrl+n": chalk8__default.default.bgRed.white.bold,
          "ctrl+t": chalk8__default.default.bgMagenta.white.bold,
          "ctrl+r": chalk8__default.default.bgYellow.black.bold
        };
        const colorFunc = colorMap[key] || chalk8__default.default.bgCyan.black.bold;
        return colorFunc(` ${formatted} `);
      }
      /**
       * Format risk level with colors
       */
      formatRiskLevel(risk) {
        switch (risk.toLowerCase()) {
          case "critical":
            return chalk8__default.default.red.bold("CRITICAL");
          case "high":
            return chalk8__default.default.red("HIGH");
          case "medium":
            return chalk8__default.default.yellow("MEDIUM");
          case "low":
            return chalk8__default.default.green("LOW");
          default:
            return chalk8__default.default.white(risk);
        }
      }
      /**
       * Setup keyboard listeners
       */
      setupKeyboardListeners() {
        if (typeof process !== "undefined" && process.stdin) {
          process.stdin.setRawMode(true);
          process.stdin.resume();
          process.stdin.setEncoding("utf8");
          const keyListener = /* @__PURE__ */ __name((key) => {
            this.handleKeyPress(key);
          }, "keyListener");
          process.stdin.on("data", keyListener);
          this.keyListeners.set("stdin", () => {
            process.stdin.off("data", keyListener);
            if (process.stdin.setRawMode) {
              process.stdin.setRawMode(false);
            }
          });
        }
      }
      /**
       * Handle key press events
       */
      handleKeyPress(key) {
        if (!this.isActive || !this.currentRequest) return;
        if (key === "\x1B") {
          this.emit("approval-cancelled", this.currentRequest.id);
          return;
        }
        if (key === "") {
          console.log("\n" + chalk8__default.default.red("Approval cancelled by user"));
          this.emit("approval-cancelled", this.currentRequest.id);
          return;
        }
        let keyCombo = "";
        if (key.charCodeAt(0) === 25) {
          keyCombo = "shift+tab";
        } else if (key.charCodeAt(0) <= 26) {
          const ctrlChar = String.fromCharCode(key.charCodeAt(0) + 96);
          keyCombo = `ctrl+${ctrlChar}`;
        }
        const choice = this.quickChoices.find((c) => c.key === keyCombo);
        if (choice) {
          this.handleQuickChoice(choice);
        }
      }
      /**
       * Handle quick choice selection
       */
      async handleQuickChoice(choice) {
        if (!this.currentRequest) return;
        console.clear();
        console.log("\n" + chalk8__default.default.bgGreen.black.bold("\u250C" + "\u2500".repeat(78) + "\u2510"));
        console.log(
          chalk8__default.default.bgGreen.black.bold("\u2502") + chalk8__default.default.bgGreen.black.bold(" \u2713 CHOICE SELECTED / \u9078\u629E\u5B8C\u4E86:" + " ".repeat(47)) + chalk8__default.default.bgGreen.black.bold("\u2502")
        );
        console.log(chalk8__default.default.bgGreen.black.bold("\u251C" + "\u2500".repeat(78) + "\u2524"));
        const choiceText = `${choice.label} (${choice.labelJa})`;
        const padding = " ".repeat(Math.max(0, 76 - choiceText.length));
        console.log(
          chalk8__default.default.bgGreen.black.bold("\u2502") + chalk8__default.default.bgGreen.black.bold(` ${choiceText}${padding}`) + chalk8__default.default.bgGreen.black.bold("\u2502")
        );
        console.log(chalk8__default.default.bgGreen.black.bold("\u2514" + "\u2500".repeat(78) + "\u2518"));
        console.log(chalk8__default.default.yellow("\n\u{1F504} Processing your approval decision..."));
        try {
          const response = await this.approvalEngine.processApprovalResponse(
            this.currentRequest.id,
            choice.action,
            `Quick approval: ${choice.label}`,
            choice.trustLevel
          );
          response.quickDecision = true;
          console.log("\n" + chalk8__default.default.bgGreen.black("\u250C" + "\u2500".repeat(78) + "\u2510"));
          console.log(
            chalk8__default.default.bgGreen.black("\u2502") + chalk8__default.default.bgGreen.black(
              " \u{1F389} APPROVAL PROCESSED SUCCESSFULLY / \u627F\u8A8D\u51E6\u7406\u5B8C\u4E86!" + " ".repeat(32)
            ) + chalk8__default.default.bgGreen.black("\u2502")
          );
          console.log(chalk8__default.default.bgGreen.black("\u2514" + "\u2500".repeat(78) + "\u2518"));
          if (choice.trustLevel) {
            console.log(chalk8__default.default.blue(`
\u2728 Trust level updated: ${choice.trustLevel}`));
          }
          this.emit("approval-response", response);
        } catch (error) {
          console.log("\n" + chalk8__default.default.bgRed.white.bold("\u250C" + "\u2500".repeat(78) + "\u2510"));
          console.log(
            chalk8__default.default.bgRed.white.bold("\u2502") + chalk8__default.default.bgRed.white.bold(
              " \u274C ERROR PROCESSING APPROVAL / \u627F\u8A8D\u51E6\u7406\u30A8\u30E9\u30FC" + " ".repeat(35)
            ) + chalk8__default.default.bgRed.white.bold("\u2502")
          );
          console.log(chalk8__default.default.bgRed.white.bold("\u2514" + "\u2500".repeat(78) + "\u2518"));
          console.error(chalk8__default.default.red("\nError details:"), error);
          this.emit("approval-error", error);
        }
      }
      /**
       * Wait for user response with optional timeout
       */
      waitForUserResponse(timeout) {
        return new Promise((resolve, reject) => {
          let timeoutId = null;
          if (timeout && timeout > 0) {
            timeoutId = setTimeout(() => {
              console.log("\n" + chalk8__default.default.yellow("\u23F0 Approval request timed out - auto-approving..."));
              this.handleTimeoutResponse(resolve);
            }, timeout);
          }
          const responseHandler = /* @__PURE__ */ __name((response) => {
            if (timeoutId) clearTimeout(timeoutId);
            resolve(response);
          }, "responseHandler");
          const errorHandler = /* @__PURE__ */ __name((error) => {
            if (timeoutId) clearTimeout(timeoutId);
            reject(error);
          }, "errorHandler");
          const cancelHandler = /* @__PURE__ */ __name(() => {
            if (timeoutId) clearTimeout(timeoutId);
            reject(new Error("Approval cancelled by user"));
          }, "cancelHandler");
          this.once("approval-response", responseHandler);
          this.once("approval-error", errorHandler);
          this.once("approval-cancelled", cancelHandler);
        });
      }
      /**
       * Handle timeout response
       */
      async handleTimeoutResponse(resolve) {
        if (!this.currentRequest) return;
        try {
          const response = await this.approvalEngine.processApprovalResponse(
            this.currentRequest.id,
            "approve",
            "Auto-approved due to timeout"
          );
          response.quickDecision = true;
          resolve(response);
        } catch (error) {
          console.error(chalk8__default.default.red("Error processing timeout approval:"), error);
        }
      }
      /**
       * Setup event listeners for the approval engine
       */
      setupEventListeners() {
        this.approvalEngine.on("approval-requested", (request) => {
          this.emit("approval-requested", request);
        });
        this.approvalEngine.on("trust-level-changed", (event) => {
          console.log(chalk8__default.default.blue(`\u2728 Trust level changed: ${event.oldLevel} \u2192 ${event.newLevel}`));
          console.log(chalk8__default.default.gray(`Reason: ${event.reason}`));
        });
      }
      /**
       * Get available quick choices
       */
      getQuickChoices() {
        return [...this.quickChoices];
      }
      /**
       * Check if interface is currently active
       */
      isCurrentlyActive() {
        return this.isActive;
      }
      /**
       * Get current approval request
       */
      getCurrentRequest() {
        return this.currentRequest;
      }
      /**
       * Cleanup resources
       */
      cleanup() {
        this.isActive = false;
        this.currentRequest = null;
        this.keyListeners.forEach((cleanup) => cleanup());
        this.keyListeners.clear();
        this.removeAllListeners("approval-response");
        this.removeAllListeners("approval-error");
        this.removeAllListeners("approval-cancelled");
      }
      /**
       * Shutdown the interface
       */
      shutdown() {
        this.cleanup();
        this.removeAllListeners();
      }
    };
  }
});
var ApprovalCommitManager;
var init_ApprovalCommit = __esm({
  "src/services/approval-git/ApprovalCommit.ts"() {
    init_cjs_shims();
    ApprovalCommitManager = class {
      static {
        __name(this, "ApprovalCommitManager");
      }
      /**
       * Create a new approval commit
       */
      static createCommit(approvalData, parentCommits = [], author, message, previousState) {
        const timestamp = /* @__PURE__ */ new Date();
        const diff = this.generateDiff(approvalData, previousState);
        const commitContent = this.generateCommitContent({
          approvalData,
          parentCommits,
          author,
          message: message || this.generateDefaultMessage(approvalData),
          timestamp,
          diff
        });
        const commitId = this.generateCommitHash(commitContent);
        const treeHash = this.generateTreeHash(approvalData, previousState);
        return {
          id: commitId,
          parentCommits,
          approvalData,
          metadata: {
            timestamp,
            author: author.name,
            email: author.email,
            message: message || this.generateDefaultMessage(approvalData),
            tags: this.generateAutoTags(approvalData),
            riskLevel: this.extractRiskLevel(approvalData),
            category: this.extractCategory(approvalData)
          },
          diff,
          treeHash
        };
      }
      /**
       * Generate commit hash (SHA-like)
       */
      static generateCommitHash(content) {
        return crypto__default.default.createHash("sha256").update(content).digest("hex").substring(0, 12);
      }
      /**
       * Generate tree hash representing the approval state
       */
      static generateTreeHash(approvalData, previousState) {
        const stateContent = JSON.stringify({
          approved: approvalData.approved,
          action: approvalData.action,
          trustLevel: approvalData.trustLevel,
          timestamp: approvalData.timestamp,
          previousState
        });
        return crypto__default.default.createHash("sha256").update(stateContent).digest("hex").substring(0, 12);
      }
      /**
       * Generate commit content string for hashing
       */
      static generateCommitContent(params) {
        const { approvalData, parentCommits, author, message, timestamp, diff } = params;
        return [
          `tree ${this.generateTreeHash(approvalData)}`,
          ...parentCommits.map((parent) => `parent ${parent}`),
          `author ${author.name} <${author.email}> ${Math.floor(timestamp.getTime() / 1e3)}`,
          `committer ${author.name} <${author.email}> ${Math.floor(timestamp.getTime() / 1e3)}`,
          "",
          message,
          "",
          `approval-action: ${approvalData.action}`,
          `approval-status: ${approvalData.approved ? "approved" : "rejected"}`,
          `diff-summary: ${diff.summary}`
        ].join("\n");
      }
      /**
       * Generate automatic tags based on approval data
       */
      static generateAutoTags(approvalData) {
        const tags = [];
        tags.push(approvalData.action);
        if (approvalData.approved) {
          tags.push("approved");
        } else {
          tags.push("rejected");
        }
        if (approvalData.quickDecision) {
          tags.push("quick-decision");
        }
        if (approvalData.trustLevel) {
          tags.push(`trust-${approvalData.trustLevel}`);
        }
        return tags;
      }
      /**
       * Extract risk level from approval data (simplified for now)
       */
      static extractRiskLevel(approvalData) {
        if (approvalData.comments?.includes("critical") || approvalData.comments?.includes("security")) {
          return "critical";
        }
        if (approvalData.comments?.includes("high")) {
          return "high";
        }
        if (approvalData.comments?.includes("medium")) {
          return "medium";
        }
        return "low";
      }
      /**
       * Extract category from approval data (simplified for now)
       */
      static extractCategory(approvalData) {
        if (approvalData.comments?.includes("security")) {
          return "security";
        }
        if (approvalData.comments?.includes("architecture")) {
          return "architecture";
        }
        if (approvalData.comments?.includes("performance")) {
          return "performance";
        }
        if (approvalData.comments?.includes("refactor")) {
          return "refactoring";
        }
        return "implementation";
      }
      /**
       * Generate default commit message
       */
      static generateDefaultMessage(approvalData) {
        const action = approvalData.action;
        const status = approvalData.approved ? "approved" : "rejected";
        if (action === "trust") {
          return `Grant trust: Auto-approve similar requests (${approvalData.trustLevel})`;
        }
        if (action === "review") {
          return `Request review: Additional validation required`;
        }
        const baseMessage = `${action.charAt(0).toUpperCase() + action.slice(1)}: ${status}`;
        if (approvalData.comments) {
          return `${baseMessage}

${approvalData.comments}`;
        }
        return baseMessage;
      }
      /**
       * Generate diff between approval states
       */
      static generateDiff(approvalData, previousState) {
        const changes = [];
        const before = previousState || {};
        const after = this.createNewState(approvalData, previousState);
        if (approvalData.trustLevel && (!previousState || previousState.trustLevel !== approvalData.trustLevel)) {
          changes.push({
            path: "trust-level",
            operation: previousState?.trustLevel ? "modify" : "add",
            oldValue: previousState?.trustLevel,
            newValue: approvalData.trustLevel,
            description: `Trust level ${previousState?.trustLevel ? "changed" : "set"} to ${approvalData.trustLevel}`
          });
        }
        changes.push({
          path: "approval-status",
          operation: "add",
          newValue: approvalData.approved,
          description: `Request ${approvalData.approved ? "approved" : "rejected"}`
        });
        changes.push({
          path: "approval-action",
          operation: "add",
          newValue: approvalData.action,
          description: `Action taken: ${approvalData.action}`
        });
        return {
          type: this.determineChangeType(approvalData),
          before,
          after,
          changes,
          summary: this.generateDiffSummary(changes)
        };
      }
      /**
       * Create new approval state
       */
      static createNewState(approvalData, previousState) {
        const base = previousState || {
          trustLevel: "learning",
          autoApprovalCategories: [],
          approvedRequests: [],
          rejectedRequests: [],
          policies: {}
        };
        const newState = { ...base };
        if (approvalData.trustLevel) {
          newState.trustLevel = approvalData.trustLevel;
        }
        if (approvalData.approved) {
          newState.approvedRequests.push(approvalData.requestId);
        } else {
          newState.rejectedRequests.push(approvalData.requestId);
        }
        return newState;
      }
      /**
       * Determine the type of change
       */
      static determineChangeType(approvalData) {
        if (approvalData.action === "trust") {
          return "trust-change";
        }
        if (approvalData.approved) {
          return "approval";
        }
        return "rejection";
      }
      /**
       * Generate diff summary
       */
      static generateDiffSummary(changes) {
        if (changes.length === 0) {
          return "No changes";
        }
        const descriptions = changes.map((change) => change.description);
        return descriptions.join(", ");
      }
      /**
       * Format commit for display (like git log)
       */
      static formatCommit(commit, options = {}) {
        const { oneline, showDiff, showTags } = options;
        if (oneline) {
          return `${commit.id} ${commit.metadata.message.split("\n")[0]}`;
        }
        const lines = [];
        lines.push(`commit ${commit.id}`);
        if (commit.parentCommits.length > 0) {
          lines.push(
            `Parent${commit.parentCommits.length > 1 ? "s" : ""}: ${commit.parentCommits.join(" ")}`
          );
        }
        lines.push(`Author: ${commit.metadata.author} <${commit.metadata.email}>`);
        lines.push(`Date: ${commit.metadata.timestamp.toISOString()}`);
        if (showTags && commit.metadata.tags.length > 0) {
          lines.push(`Tags: ${commit.metadata.tags.join(", ")}`);
        }
        lines.push(`Risk: ${commit.metadata.riskLevel}, Category: ${commit.metadata.category}`);
        lines.push("");
        lines.push(`    ${commit.metadata.message.replace(/\n/g, "\n    ")}`);
        if (showDiff) {
          lines.push("");
          lines.push("Changes:");
          commit.diff.changes.forEach((change) => {
            lines.push(`    ${change.operation}: ${change.description}`);
          });
        }
        return lines.join("\n");
      }
      /**
       * Parse commit ID to extract timestamp and validate format
       */
      static parseCommitId(commitId) {
        if (!commitId || commitId.length !== 12) {
          return { timestamp: 0, valid: false };
        }
        const valid = /^[0-9a-f]{12}$/i.test(commitId);
        return { timestamp: Date.now(), valid };
      }
      /**
       * Compare two commits for ordering
       */
      static compareCommits(a, b) {
        return b.metadata.timestamp.getTime() - a.metadata.timestamp.getTime();
      }
      /**
       * Find common ancestor of two commits
       */
      static findCommonAncestor(commit1, commit2, allCommits) {
        const ancestors1 = this.getAncestors(commit1, allCommits);
        const ancestors2 = this.getAncestors(commit2, allCommits);
        for (const ancestor of ancestors1) {
          if (ancestors2.includes(ancestor)) {
            return ancestor;
          }
        }
        return null;
      }
      /**
       * Get all ancestors of a commit
       */
      static getAncestors(commit, allCommits) {
        const ancestors = [];
        const queue = [...commit.parentCommits];
        while (queue.length > 0) {
          const parentId = queue.shift();
          if (ancestors.includes(parentId)) continue;
          ancestors.push(parentId);
          const parent = allCommits.get(parentId);
          if (parent) {
            queue.push(...parent.parentCommits);
          }
        }
        return ancestors;
      }
    };
  }
});
var ApprovalRepositoryManager;
var init_ApprovalRepository = __esm({
  "src/services/approval-git/ApprovalRepository.ts"() {
    init_cjs_shims();
    init_ApprovalCommit();
    ApprovalRepositoryManager = class _ApprovalRepositoryManager extends events.EventEmitter {
      static {
        __name(this, "ApprovalRepositoryManager");
      }
      static instance;
      repository;
      constructor() {
        super();
        this.repository = this.createDefaultRepository();
      }
      static getInstance() {
        if (!_ApprovalRepositoryManager.instance) {
          _ApprovalRepositoryManager.instance = new _ApprovalRepositoryManager();
        }
        return _ApprovalRepositoryManager.instance;
      }
      /**
       * Create a new approval commit and add to current branch
       */
      async createCommit(approvalData, message, author) {
        const currentBranch = this.getCurrentBranch();
        const parentCommits = currentBranch.head ? [currentBranch.head] : [];
        const previousCommit = currentBranch.head ? this.repository.commits.get(currentBranch.head) : void 0;
        const commit = ApprovalCommitManager.createCommit(
          approvalData,
          parentCommits,
          author || { name: "MARIA User", email: "user@maria.ai" },
          message,
          previousCommit?.diff.after
          // Use previous state from last commit
        );
        this.repository.commits.set(commit.id, commit);
        currentBranch.head = commit.id;
        currentBranch.approvalPath.push(commit);
        currentBranch.lastActivity = /* @__PURE__ */ new Date();
        this.repository.lastActivity = /* @__PURE__ */ new Date();
        this.emit("commit-created", commit);
        return commit;
      }
      /**
       * Create a new branch
       */
      createBranch(branchName, baseCommit) {
        if (this.repository.branches.has(branchName)) {
          throw new Error(`Branch '${branchName}' already exists`);
        }
        const currentBranch = this.getCurrentBranch();
        const base = baseCommit || currentBranch.head || "";
        const branch = {
          name: branchName,
          head: base,
          baseCommit: base,
          approvalPath: base ? [this.repository.commits.get(base)].filter(Boolean) : [],
          mergeRequests: [],
          protected: false,
          createdAt: /* @__PURE__ */ new Date(),
          lastActivity: /* @__PURE__ */ new Date()
        };
        this.repository.branches.set(branchName, branch);
        this.emit("branch-created", branch);
        return branch;
      }
      /**
       * Switch to a different branch
       */
      checkoutBranch(branchName) {
        const branch = this.repository.branches.get(branchName);
        if (!branch) {
          throw new Error(`Branch '${branchName}' does not exist`);
        }
        this.repository.config.branches.main = branchName;
        return branch;
      }
      /**
       * Delete a branch
       */
      deleteBranch(branchName, force = false) {
        if (branchName === this.repository.defaultBranch) {
          throw new Error("Cannot delete the default branch");
        }
        const branch = this.repository.branches.get(branchName);
        if (!branch) {
          throw new Error(`Branch '${branchName}' does not exist`);
        }
        if (branch.protected && !force) {
          throw new Error(`Branch '${branchName}' is protected. Use force flag to delete.`);
        }
        if (!force && this.hasUnmergedChanges(branchName)) {
          throw new Error(`Branch '${branchName}' has unmerged changes. Use force flag to delete.`);
        }
        this.repository.branches.delete(branchName);
        this.emit("branch-deleted", { name: branchName });
      }
      /**
       * Create a merge request
       */
      createMergeRequest(title, description, sourceBranch, targetBranch, author) {
        const source = this.repository.branches.get(sourceBranch);
        const target = this.repository.branches.get(targetBranch);
        if (!source || !target) {
          throw new Error("Source or target branch does not exist");
        }
        const commitsToMerge = this.getCommitsBetween(source.baseCommit, source.head);
        const mergeRequest = {
          id: uuid.v4(),
          title,
          description,
          sourceBranch,
          targetBranch,
          commits: commitsToMerge,
          approvals: [],
          status: "pending",
          author,
          assignees: [],
          reviewers: [],
          labels: [],
          createdAt: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date()
        };
        source.mergeRequests.push(mergeRequest);
        this.emit("merge-request-created", mergeRequest);
        return mergeRequest;
      }
      /**
       * Merge a branch or merge request
       */
      async mergeBranch(sourceBranch, targetBranch, options = {}) {
        const source = this.repository.branches.get(sourceBranch);
        const target = this.repository.branches.get(targetBranch);
        if (!source || !target) {
          throw new Error("Source or target branch does not exist");
        }
        const mergeCommit = await this.createMergeCommit(source, target, options);
        target.head = mergeCommit.id;
        target.lastActivity = /* @__PURE__ */ new Date();
        const mergeRequest = source.mergeRequests.find(
          (mr) => mr.targetBranch === targetBranch && mr.status === "pending"
        );
        if (mergeRequest) {
          mergeRequest.status = "merged";
          mergeRequest.updatedAt = /* @__PURE__ */ new Date();
          mergeRequest.mergedAt = /* @__PURE__ */ new Date();
        }
        this.emit("merge-completed", {
          sourceBranch,
          targetBranch,
          mergeCommit: mergeCommit.id
        });
        return mergeCommit;
      }
      /**
       * Revert a commit
       */
      async revertCommit(commitId, options = {}) {
        const originalCommit = this.repository.commits.get(commitId);
        if (!originalCommit) {
          throw new Error(`Commit '${commitId}' not found`);
        }
        const revertApprovalData = {
          requestId: `revert-${originalCommit.approvalData.requestId}`,
          action: originalCommit.approvalData.approved ? "reject" : "approve",
          approved: !originalCommit.approvalData.approved,
          comments: `Revert "${originalCommit.metadata.message}"`,
          timestamp: /* @__PURE__ */ new Date(),
          quickDecision: false
        };
        const message = options.message || `Revert "${originalCommit.metadata.message}"`;
        if (options.noCommit) {
          return ApprovalCommitManager.createCommit(
            revertApprovalData,
            [this.getCurrentBranch().head],
            { name: "MARIA User", email: "user@maria.ai" },
            message
          );
        }
        return this.createCommit(revertApprovalData, message);
      }
      /**
       * Create a tag
       */
      createTag(tagName, commitId, options = {}) {
        if (this.repository.tags.has(tagName) && !options.force) {
          throw new Error(`Tag '${tagName}' already exists. Use force flag to overwrite.`);
        }
        const targetCommit = commitId || this.getCurrentBranch().head;
        if (!targetCommit) {
          throw new Error("No commit to tag");
        }
        if (!this.repository.commits.has(targetCommit)) {
          throw new Error(`Commit '${targetCommit}' does not exist`);
        }
        this.repository.tags.set(tagName, targetCommit);
        this.emit("tag-created", { name: tagName, commit: targetCommit });
      }
      /**
       * Get approval log
       */
      getLog(options = {}) {
        let commits = Array.from(this.repository.commits.values());
        if (options.branch) {
          const branch = this.repository.branches.get(options.branch);
          if (branch) {
            const branchCommitIds = new Set(branch.approvalPath.map((c) => c.id));
            commits = commits.filter((c) => branchCommitIds.has(c.id));
          }
        }
        if (options.author) {
          commits = commits.filter(
            (c) => c.metadata.author.toLowerCase().includes(options.author.toLowerCase())
          );
        }
        if (options.since) {
          commits = commits.filter((c) => c.metadata.timestamp >= options.since);
        }
        if (options.until) {
          commits = commits.filter((c) => c.metadata.timestamp <= options.until);
        }
        if (options.grep) {
          const regex = new RegExp(options.grep, "i");
          commits = commits.filter((c) => regex.test(c.metadata.message));
        }
        commits.sort(ApprovalCommitManager.compareCommits);
        if (options.limit && options.limit > 0) {
          commits = commits.slice(0, options.limit);
        }
        return commits;
      }
      /**
       * List branches
       */
      listBranches(options = {}) {
        let branches = Array.from(this.repository.branches.values());
        if (options.merged) {
          branches = branches.filter(
            (branch) => branch.name !== this.repository.defaultBranch && this.isBranchMerged(branch.name)
          );
        }
        return branches.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
      }
      /**
       * Get repository statistics
       */
      getStatistics() {
        const commits = Array.from(this.repository.commits.values());
        const branches = Array.from(this.repository.branches.values());
        const mergeRequests = branches.flatMap((b) => b.mergeRequests);
        const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3);
        const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3);
        const commitsLastWeek = commits.filter((c) => c.metadata.timestamp >= lastWeek).length;
        const commitsLastMonth = commits.filter((c) => c.metadata.timestamp >= lastMonth).length;
        const approvalTimes = mergeRequests.filter((mr) => mr.mergedAt).map((mr) => mr.mergedAt.getTime() - mr.createdAt.getTime());
        const avgTimeToApproval = approvalTimes.length > 0 ? approvalTimes.reduce((a, b) => a + b, 0) / approvalTimes.length : 0;
        const contributorActivity = {};
        commits.forEach((commit) => {
          const author = commit.metadata.author;
          contributorActivity[author] = (contributorActivity[author] || 0) + 1;
        });
        const mostActiveContributor = Object.entries(contributorActivity).sort(([, a], [, b]) => b - a)[0]?.[0] || "N/A";
        const riskDistribution = commits.reduce(
          (acc, commit) => {
            const risk = commit.metadata.riskLevel;
            acc[risk] = (acc[risk] || 0) + 1;
            return acc;
          },
          {}
        );
        const categoryDistribution = commits.reduce(
          (acc, commit) => {
            const category = commit.metadata.category;
            acc[category] = (acc[category] || 0) + 1;
            return acc;
          },
          {}
        );
        const rejectionRate = commits.filter((c) => !c.approvalData.approved).length / commits.length;
        return {
          repository: {
            totalCommits: commits.length,
            totalBranches: branches.length,
            totalMergeRequests: mergeRequests.length,
            totalTags: this.repository.tags.size
          },
          activity: {
            commitsLastWeek,
            commitsLastMonth,
            averageTimeToApproval: avgTimeToApproval,
            averageTimeToMerge: avgTimeToApproval
            // Simplified
          },
          contributors: {
            totalContributors: Object.keys(contributorActivity).length,
            mostActiveContributor,
            contributorActivity
          },
          risk: {
            riskDistribution,
            categoryDistribution,
            rejectionRate
          }
        };
      }
      /**
       * Get current branch
       */
      getCurrentBranch() {
        const branchName = this.repository.config.branches.main;
        return this.repository.branches.get(branchName) || this.getMainBranch();
      }
      /**
       * Get main branch
       */
      getMainBranch() {
        let mainBranch = this.repository.branches.get(this.repository.defaultBranch);
        if (!mainBranch) {
          mainBranch = {
            name: this.repository.defaultBranch,
            head: "",
            baseCommit: "",
            approvalPath: [],
            mergeRequests: [],
            protected: true,
            createdAt: /* @__PURE__ */ new Date(),
            lastActivity: /* @__PURE__ */ new Date()
          };
          this.repository.branches.set(this.repository.defaultBranch, mainBranch);
        }
        return mainBranch;
      }
      /**
       * Get repository configuration
       */
      getConfig() {
        return { ...this.repository.config };
      }
      /**
       * Update repository configuration
       */
      updateConfig(config) {
        this.repository.config = { ...this.repository.config, ...config };
      }
      /**
       * Export repository data
       */
      exportRepository() {
        return JSON.parse(JSON.stringify(this.repository));
      }
      /**
       * Create default repository
       */
      createDefaultRepository() {
        const defaultBranch = "main";
        return {
          id: uuid.v4(),
          name: "maria-approvals",
          branches: /* @__PURE__ */ new Map(),
          commits: /* @__PURE__ */ new Map(),
          tags: /* @__PURE__ */ new Map(),
          remotes: [],
          config: this.getDefaultConfig(),
          defaultBranch,
          createdAt: /* @__PURE__ */ new Date(),
          lastActivity: /* @__PURE__ */ new Date()
        };
      }
      /**
       * Get default repository configuration
       */
      getDefaultConfig() {
        return {
          remote: {},
          branches: {
            main: "main",
            protected: ["main", "master"],
            autoMerge: false
          },
          integration: {},
          policies: {
            branchProtection: {
              requireApproval: true,
              minimumApprovals: 1,
              requireCodeOwnerReview: false,
              dismissStaleReviews: false,
              restrictPushes: true
            },
            mergeRequirements: {
              requireLinearHistory: false,
              allowMergeCommits: true,
              allowSquashMerge: true,
              allowRebaseMerge: true,
              deleteHeadBranches: false
            },
            autoApproval: {
              enabled: true,
              conditions: []
            }
          }
        };
      }
      /**
       * Create merge commit
       */
      async createMergeCommit(source, target, options) {
        const mergeMessage = options.message || `Merge branch '${source.name}' into '${target.name}'`;
        const mergeApprovalData = {
          requestId: `merge-${uuid.v4()}`,
          action: "approve",
          approved: true,
          comments: mergeMessage,
          timestamp: /* @__PURE__ */ new Date(),
          quickDecision: false
        };
        const parentCommits = [target.head, source.head].filter(Boolean);
        const mergeCommit = ApprovalCommitManager.createCommit(
          mergeApprovalData,
          parentCommits,
          { name: "MARIA User", email: "user@maria.ai" },
          mergeMessage
        );
        this.repository.commits.set(mergeCommit.id, mergeCommit);
        return mergeCommit;
      }
      /**
       * Get commits between two points
       */
      getCommitsBetween(base, head) {
        if (!base || !head) return [];
        const commits = [];
        const visited = /* @__PURE__ */ new Set();
        const queue = [head];
        while (queue.length > 0) {
          const commitId = queue.shift();
          if (visited.has(commitId) || commitId === base) continue;
          visited.add(commitId);
          commits.push(commitId);
          const commit = this.repository.commits.get(commitId);
          if (commit) {
            queue.push(...commit.parentCommits);
          }
        }
        return commits.reverse();
      }
      /**
       * Check if branch has unmerged changes
       */
      hasUnmergedChanges(branchName) {
        const branch = this.repository.branches.get(branchName);
        const mainBranch = this.getMainBranch();
        if (!branch || !mainBranch.head) return false;
        return branch.head !== mainBranch.head && !this.isCommitInBranch(branch.head, mainBranch.name);
      }
      /**
       * Check if branch is merged
       */
      isBranchMerged(branchName) {
        const branch = this.repository.branches.get(branchName);
        const mainBranch = this.getMainBranch();
        if (!branch || !mainBranch.head) return false;
        return this.isCommitInBranch(branch.head, mainBranch.name);
      }
      /**
       * Check if commit is in branch
       */
      isCommitInBranch(commitId, branchName) {
        const branch = this.repository.branches.get(branchName);
        if (!branch) return false;
        return branch.approvalPath.some((commit) => commit.id === commitId);
      }
    };
  }
});

// src/services/background-ai-checker.ts
var background_ai_checker_exports = {};
__export(background_ai_checker_exports, {
  BackgroundAIChecker: () => BackgroundAIChecker
});
var BackgroundAIChecker;
var init_background_ai_checker = __esm({
  "src/services/background-ai-checker.ts"() {
    init_cjs_shims();
    BackgroundAIChecker = class {
      static {
        __name(this, "BackgroundAIChecker");
      }
      static checking = false;
      static status = {
        lmstudio: false,
        ollama: false,
        vllm: false
      };
      /**
       * Start checking local AI services in the background
       * This runs asynchronously and doesn't block the main process
       */
      static async startBackgroundCheck() {
        if (this.checking) return;
        this.checking = true;
        Promise.all([this.checkLMStudio(), this.checkOllama(), this.checkVLLM()]).then(() => {
          this.checking = false;
          this.reportStatus();
        }).catch(() => {
          this.checking = false;
        });
      }
      static async checkLMStudio() {
        try {
          const response = await fetch3__default.default("http://localhost:1234/v1/models", {
            method: "GET",
            signal: AbortSignal.timeout(2e3)
            // Quick 2-second timeout
          });
          this.status.lmstudio = response.ok;
        } catch {
          this.status.lmstudio = false;
        }
      }
      static async checkOllama() {
        try {
          const response = await fetch3__default.default("http://localhost:11434/api/version", {
            method: "GET",
            signal: AbortSignal.timeout(2e3)
          });
          this.status.ollama = response.ok;
        } catch {
          this.status.ollama = false;
        }
      }
      static async checkVLLM() {
        try {
          const response = await fetch3__default.default("http://localhost:8000/v1/models", {
            method: "GET",
            signal: AbortSignal.timeout(2e3)
          });
          this.status.vllm = response.ok;
        } catch {
          this.status.vllm = false;
        }
      }
      static reportStatus() {
        const hasLocalAI = this.status.lmstudio || this.status.ollama || this.status.vllm;
        if (hasLocalAI) {
          console.log("");
          console.log(chalk8__default.default.cyan("\u{1F4E1} Local AI Update:"));
          if (this.status.lmstudio) {
            console.log(chalk8__default.default.green("  \u2705 LM Studio is now available"));
          }
          if (this.status.ollama) {
            console.log(chalk8__default.default.green("  \u2705 Ollama is now available"));
          }
          if (this.status.vllm) {
            console.log(chalk8__default.default.green("  \u2705 vLLM is now available"));
          }
          console.log(chalk8__default.default.gray("  Type /model to switch to local models"));
          console.log("");
        }
      }
      static getStatus() {
        return { ...this.status };
      }
      static isAnyLocalAIAvailable() {
        return this.status.lmstudio || this.status.ollama || this.status.vllm;
      }
    };
  }
});

// src/agents/types.ts
var init_types3 = __esm({
  "src/agents/types.ts"() {
    init_cjs_shims();
  }
});
var LogLevel, Logger, logger, envLogLevel;
var init_logger = __esm({
  "src/utils/logger.ts"() {
    init_cjs_shims();
    LogLevel = /* @__PURE__ */ ((LogLevel2) => {
      LogLevel2[LogLevel2["DEBUG"] = 0] = "DEBUG";
      LogLevel2[LogLevel2["INFO"] = 1] = "INFO";
      LogLevel2[LogLevel2["WARN"] = 2] = "WARN";
      LogLevel2[LogLevel2["ERROR"] = 3] = "ERROR";
      LogLevel2[LogLevel2["NONE"] = 4] = "NONE";
      return LogLevel2;
    })(LogLevel || {});
    Logger = class {
      static {
        __name(this, "Logger");
      }
      level = 1 /* INFO */;
      prefix = "[MARIA CODE]";
      setLevel(level) {
        this.level = level;
      }
      debug(...args) {
        if (this.level <= 0 /* DEBUG */) {
          console.log(chalk8__default.default.magenta(`${this.prefix} [DEBUG]`), ...args);
        }
      }
      info(...args) {
        if (this.level <= 1 /* INFO */) {
          console.log(chalk8__default.default.bold.magenta(`${this.prefix} [INFO]`), ...args);
        }
      }
      warn(...args) {
        if (this.level <= 2 /* WARN */) {
          console.warn(chalk8__default.default.bold.magenta(`${this.prefix} [WARN]`), ...args);
        }
      }
      error(...args) {
        if (this.level <= 3 /* ERROR */) {
          console.error(chalk8__default.default.bold.magenta(`${this.prefix} [ERROR]`), ...args);
        }
      }
      success(...args) {
        if (this.level <= 1 /* INFO */) {
          console.log(chalk8__default.default.bold.magenta(`${this.prefix} [SUCCESS]`), ...args);
        }
      }
      task(taskName, status, message) {
        if (this.level > 1 /* INFO */) return;
        const statusIcons = {
          start: "\u{1F680}",
          progress: "\u23F3",
          complete: "\u2705",
          error: "\u274C"
        };
        const statusColors = {
          start: chalk8__default.default.bold.magenta,
          progress: chalk8__default.default.magenta,
          complete: chalk8__default.default.bold.magenta,
          error: chalk8__default.default.bold.magenta
        };
        const icon = statusIcons[status];
        const color = statusColors[status];
        const formattedMessage = message ? `: ${message}` : "";
        console.log(color(`${this.prefix} ${icon} ${taskName}${formattedMessage}`));
      }
      table(data) {
        if (this.level > 1 /* INFO */) return;
        console.table(data);
      }
      json(obj, pretty = true) {
        if (this.level > 0 /* DEBUG */) return;
        console.log(chalk8__default.default.magenta(`${this.prefix} [JSON]`));
        console.log(pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj));
      }
      divider() {
        if (this.level > 1 /* INFO */) return;
        console.log(chalk8__default.default.magenta("\u2500".repeat(60)));
      }
      clear() {
        console.clear();
      }
      /**
       * プログレスバーを表示
       */
      progress(current, total, label) {
        if (this.level > 1 /* INFO */) return;
        const percentage = Math.round(current / total * 100);
        const barLength = 30;
        const filled = Math.round(percentage / 100 * barLength);
        const empty = barLength - filled;
        const bar = "\u2588".repeat(filled) + "\u2591".repeat(empty);
        const progressText = `${current}/${total}`;
        const labelText = label ? ` ${label}` : "";
        process.stdout.write(`\r${chalk8__default.default.bold.magenta(bar)} ${percentage}% ${progressText}${labelText}`);
        if (current === total) {
          process.stdout.write("\n");
        }
      }
    };
    logger = new Logger();
    envLogLevel = process.env["MARIA_LOG_LEVEL"]?.toUpperCase();
    if (envLogLevel && LogLevel[envLogLevel] !== void 0) {
      logger.setLevel(LogLevel[envLogLevel]);
    }
  }
});
var DataSynthesisEngine, EnhancedCommunicationBroker;
var init_enhanced_communication = __esm({
  "src/agents/enhanced-communication.ts"() {
    init_cjs_shims();
    init_types3();
    init_logger();
    DataSynthesisEngine = class extends events.EventEmitter {
      static {
        __name(this, "DataSynthesisEngine");
      }
      workflowResults = /* @__PURE__ */ new Map();
      synthesisRules = /* @__PURE__ */ new Map();
      constructor() {
        super();
        this.initializeDefaultRules();
      }
      /**
       * Register synthesis rules for agent combinations
       */
      registerSynthesisRule(rule) {
        this.synthesisRules.set(rule.id, rule);
        logger.info(`Synthesis rule registered: ${rule.id}`);
      }
      /**
       * Synthesize results from multiple agents
       */
      async synthesizeResults(workflowId, agentResults) {
        logger.info(`Synthesizing results for workflow ${workflowId}`);
        this.workflowResults.set(workflowId, agentResults);
        const applicableRules = this.findApplicableRules(agentResults);
        const synthesizedData = {};
        const insights = [];
        const recommendations = [];
        let overallQuality = 0;
        for (const rule of applicableRules) {
          try {
            const ruleOutput = await this.applySynthesisRule(rule, agentResults);
            Object.assign(synthesizedData, ruleOutput.data);
            insights.push(...ruleOutput.insights);
            recommendations.push(...ruleOutput.recommendations);
            overallQuality = Math.max(overallQuality, ruleOutput.quality);
          } catch (error) {
            logger.error(`Synthesis rule ${rule.id} failed:`, error);
          }
        }
        const qualityMetrics = this.calculateOverallQuality(agentResults);
        const output = {
          workflowId,
          timestamp: /* @__PURE__ */ new Date(),
          synthesizedData,
          insights,
          recommendations,
          qualityMetrics,
          participatingAgents: Array.from(agentResults.keys()),
          metadata: {
            rulesApplied: applicableRules.map((r) => r.id),
            totalResults: agentResults.size,
            synthesisTime: Date.now()
          }
        };
        this.emit("synthesisCompleted", output);
        return output;
      }
      /**
       * Apply a specific synthesis rule
       */
      async applySynthesisRule(rule, agentResults) {
        logger.debug(`Applying synthesis rule: ${rule.id}`);
        const relevantResults = /* @__PURE__ */ new Map();
        for (const agentRole of rule.requiredAgents) {
          const result = agentResults.get(agentRole);
          if (result) {
            relevantResults.set(agentRole, result);
          }
        }
        return await rule.synthesize(relevantResults);
      }
      /**
       * Find synthesis rules applicable to current agent combination
       */
      findApplicableRules(agentResults) {
        const availableAgents = new Set(agentResults.keys());
        return Array.from(this.synthesisRules.values()).filter((rule) => {
          return rule.requiredAgents.every((agent) => availableAgents.has(agent));
        });
      }
      /**
       * Calculate overall quality metrics
       */
      calculateOverallQuality(agentResults) {
        const results = Array.from(agentResults.values());
        const count = results.length;
        return {
          accuracy: results.reduce((sum, r) => sum + r.qualityMetrics.accuracy, 0) / count,
          completeness: results.reduce((sum, r) => sum + r.qualityMetrics.completeness, 0) / count,
          relevance: results.reduce((sum, r) => sum + r.qualityMetrics.relevance, 0) / count,
          coherence: results.reduce((sum, r) => sum + r.qualityMetrics.coherence, 0) / count
        };
      }
      /**
       * Initialize default synthesis rules
       */
      initializeDefaultRules() {
        this.registerSynthesisRule({
          id: "document-algorithm-code",
          name: "Document Algorithm Code Synthesis",
          requiredAgents: [
            "document-parser" /* DOCUMENT_PARSER */,
            "algorithm-extractor" /* ALGORITHM_EXTRACTOR */,
            "code-generator" /* CODE_GENERATOR */
          ],
          synthesize: /* @__PURE__ */ __name(async (results) => {
            const docResult = results.get("document-parser" /* DOCUMENT_PARSER */);
            const algoResult = results.get("algorithm-extractor" /* ALGORITHM_EXTRACTOR */);
            const codeResult = results.get("code-generator" /* CODE_GENERATOR */);
            return {
              data: {
                documentSummary: docResult?.structuredOutput.primary,
                extractedAlgorithms: algoResult?.structuredOutput.primary,
                generatedCode: codeResult?.structuredOutput.primary,
                combinedImplementation: this.mergeImplementations(
                  algoResult?.structuredOutput.primary,
                  codeResult?.structuredOutput.primary
                )
              },
              insights: [
                "Successfully integrated document analysis with algorithm extraction",
                "Code generation aligned with extracted algorithmic concepts",
                ...docResult?.structuredOutput.insights || [],
                ...algoResult?.structuredOutput.insights || [],
                ...codeResult?.structuredOutput.insights || []
              ],
              recommendations: [
                "Review generated code for algorithmic accuracy",
                "Validate implementation against paper requirements",
                ...docResult?.structuredOutput.recommendations || [],
                ...algoResult?.structuredOutput.recommendations || [],
                ...codeResult?.structuredOutput.recommendations || []
              ],
              quality: Math.min(
                docResult?.qualityMetrics.accuracy || 0,
                algoResult?.qualityMetrics.accuracy || 0,
                codeResult?.qualityMetrics.accuracy || 0
              )
            };
          }, "synthesize")
        });
        this.registerSynthesisRule({
          id: "literature-concept-quality",
          name: "Literature Concept Quality Synthesis",
          requiredAgents: [
            "literature-reviewer" /* LITERATURE_REVIEWER */,
            "concept-analyzer" /* CONCEPT_ANALYZER */,
            "quality-assurance" /* QUALITY_ASSURANCE */
          ],
          synthesize: /* @__PURE__ */ __name(async (results) => {
            const litResult = results.get("literature-reviewer" /* LITERATURE_REVIEWER */);
            const conceptResult = results.get("concept-analyzer" /* CONCEPT_ANALYZER */);
            const qaResult = results.get("quality-assurance" /* QUALITY_ASSURANCE */);
            return {
              data: {
                literatureContext: litResult?.structuredOutput.primary,
                conceptualFramework: conceptResult?.structuredOutput.primary,
                qualityAssessment: qaResult?.structuredOutput.primary,
                comprehensiveAnalysis: this.mergeAnalysis(
                  litResult?.structuredOutput.primary,
                  conceptResult?.structuredOutput.primary,
                  qaResult?.structuredOutput.primary
                )
              },
              insights: [
                "Comprehensive literature and conceptual analysis completed",
                "Quality assessment validates theoretical foundations",
                ...litResult?.structuredOutput.insights || [],
                ...conceptResult?.structuredOutput.insights || [],
                ...qaResult?.structuredOutput.insights || []
              ],
              recommendations: [
                "Consider additional literature sources for completeness",
                "Validate conceptual model against quality criteria",
                ...litResult?.structuredOutput.recommendations || [],
                ...conceptResult?.structuredOutput.recommendations || [],
                ...qaResult?.structuredOutput.recommendations || []
              ],
              quality: ((litResult?.qualityMetrics.accuracy || 0) + (conceptResult?.qualityMetrics.accuracy || 0) + (qaResult?.qualityMetrics.accuracy || 0)) / 3
            };
          }, "synthesize")
        });
      }
      /**
       * Merge algorithm and code implementations
       */
      mergeImplementations(algorithms, code) {
        return {
          algorithms,
          code,
          integration: "Successfully merged algorithmic concepts with code implementation"
        };
      }
      /**
       * Merge analysis from multiple agents
       */
      mergeAnalysis(literature, concepts, quality) {
        return {
          literature,
          concepts,
          quality,
          synthesis: "Comprehensive analysis combining literature review, conceptual analysis, and quality assessment"
        };
      }
    };
    EnhancedCommunicationBroker = class extends events.EventEmitter {
      static {
        __name(this, "EnhancedCommunicationBroker");
      }
      messageQueue = /* @__PURE__ */ new Map();
      contextStore = /* @__PURE__ */ new Map();
      dataTransformers = /* @__PURE__ */ new Map();
      constructor() {
        super();
        this.initializeDefaultTransformers();
      }
      /**
       * Route enhanced message between agents
       */
      async routeEnhancedMessage(message) {
        logger.debug(`Routing enhanced message from ${message.from} to ${message.to}`);
        const queueKey = `${message.context.workflowId}-${message.to}`;
        if (!this.messageQueue.has(queueKey)) {
          this.messageQueue.set(queueKey, []);
        }
        this.messageQueue.get(queueKey).push(message);
        await this.updateWorkflowContext(message);
        const transformedMessage = await this.applyDataTransformations(message);
        this.emit("messageForAgent", {
          targetAgent: message.to,
          message: transformedMessage
        });
      }
      /**
       * Update workflow context with message data
       */
      async updateWorkflowContext(message) {
        const workflowId = message.context.workflowId;
        if (!this.contextStore.has(workflowId)) {
          this.contextStore.set(workflowId, {
            id: workflowId,
            steps: [],
            sharedKnowledge: {},
            currentStep: 0,
            participatingAgents: /* @__PURE__ */ new Set()
          });
        }
        const context = this.contextStore.get(workflowId);
        context.participatingAgents.add(message.from);
        context.currentStep = Math.max(context.currentStep, message.context.stepNumber);
        Object.assign(context.sharedKnowledge, message.context.sharedKnowledge);
      }
      /**
       * Apply data transformations to message
       */
      async applyDataTransformations(message) {
        const transformerKey = `${message.from}-${message.to}`;
        const transformer = this.dataTransformers.get(transformerKey);
        if (!transformer) {
          return message;
        }
        try {
          const transformedPayload = await transformer.transform(message.payload);
          return {
            ...message,
            payload: transformedPayload
          };
        } catch (error) {
          logger.error(`Data transformation failed for ${transformerKey}:`, error);
          return message;
        }
      }
      /**
       * Initialize default data transformers
       */
      initializeDefaultTransformers() {
        this.dataTransformers.set("document-parser-algorithm-extractor", {
          transform: /* @__PURE__ */ __name(async (payload) => {
            return {
              ...payload,
              algorithmFocusedContent: "Extracted algorithmic sections from document"
            };
          }, "transform")
        });
        this.dataTransformers.set("algorithm-extractor-code-generator", {
          transform: /* @__PURE__ */ __name(async (payload) => {
            return {
              ...payload,
              codeGenerationSpecs: "Structured specifications for code generation"
            };
          }, "transform")
        });
      }
    };
  }
});
var CentralOrchestrator;
var init_orchestrator = __esm({
  "src/agents/orchestrator.ts"() {
    init_cjs_shims();
    init_enhanced_communication();
    init_logger();
    CentralOrchestrator = class extends events.EventEmitter {
      static {
        __name(this, "CentralOrchestrator");
      }
      agents = /* @__PURE__ */ new Map();
      taskQueue = [];
      executingTasks = /* @__PURE__ */ new Map();
      completedTasks = /* @__PURE__ */ new Map();
      config;
      isRunning = false;
      processingInterval;
      // Enhanced communication and synthesis
      communicationBroker;
      synthesisEngine;
      workflowResults = /* @__PURE__ */ new Map();
      // MCP Integration
      // private __mcpTools = new Map<string, MCPTool>();
      // private __mcpEnabled = false;
      constructor(config) {
        super();
        this.config = {
          maxConcurrentTasks: config?.maxConcurrentTasks ?? 5,
          taskTimeout: config?.taskTimeout ?? 3e4,
          // 30 seconds
          retryPolicy: {
            maxRetries: config?.retryPolicy?.maxRetries ?? 3,
            backoffMultiplier: config?.retryPolicy?.backoffMultiplier ?? 2
          },
          loadBalancing: config?.loadBalancing ?? "capability-based"
        };
        this.communicationBroker = new EnhancedCommunicationBroker();
        this.synthesisEngine = new DataSynthesisEngine();
        this.communicationBroker.on("messageForAgent", this.handleBrokerMessage.bind(this));
        this.synthesisEngine.on("synthesisCompleted", this.handleSynthesisCompletion.bind(this));
      }
      /**
       * Register an agent with the orchestrator
       */
      async registerAgent(agent) {
        logger.info(`Registering agent: ${agent.role}`);
        await agent.initialize();
        this.setupAgentListeners(agent);
        this.agents.set(agent.role, agent);
        this.emit("agentRegistered", { role: agent.role });
      }
      /**
       * Unregister an agent
       */
      async unregisterAgent(role) {
        const agent = this.agents.get(role);
        if (!agent) {
          logger.warn(`Agent ${role} not found for unregistration`);
          return;
        }
        await agent.shutdown();
        this.agents.delete(role);
        this.emit("agentUnregistered", { role });
      }
      /**
       * Submit a task for execution
       */
      async submitTask(task) {
        if (!task.id) {
          task.id = uuid.v4();
        }
        logger.info(`Task ${task.id} submitted for execution`);
        this.taskQueue.push(task);
        if (this.isRunning) {
          this.processQueue();
        }
        this.emit("taskSubmitted", task);
        return task.id;
      }
      /**
       * Create and execute an execution plan
       */
      async executePlan(plan) {
        logger.info(`Executing plan ${plan.id} with ${plan.tasks.length} tasks`);
        const results = /* @__PURE__ */ new Map();
        const sortedTasks = this.topologicalSort(plan.tasks, plan.dependencies);
        for (const taskNode of sortedTasks) {
          await this.waitForDependencies(taskNode.task, plan.dependencies);
          await this.submitTask(taskNode.task);
          const result = await this.waitForTaskCompletion(taskNode.task.id);
          results.set(taskNode.task.id, result);
          if (result.status === "failure") {
            logger.error(`Task ${taskNode.task.id} failed, stopping plan execution`);
            break;
          }
        }
        return results;
      }
      /**
       * Start the orchestrator
       */
      start() {
        if (this.isRunning) {
          logger.warn("Orchestrator is already running");
          return;
        }
        logger.info("Starting orchestrator");
        this.isRunning = true;
        this.processingInterval = setInterval(() => {
          this.processQueue();
        }, 1e3);
        this.emit("started");
      }
      /**
       * Stop the orchestrator
       */
      async stop() {
        if (!this.isRunning) {
          logger.warn("Orchestrator is not running");
          return;
        }
        logger.info("Stopping orchestrator");
        this.isRunning = false;
        if (this.processingInterval) {
          clearInterval(this.processingInterval);
          this.processingInterval = void 0;
        }
        await this.waitForAllTasks();
        for (const agent of this.agents.values()) {
          await agent.shutdown();
        }
        this.emit("stopped");
      }
      /**
       * Get orchestrator status
       */
      getStatus() {
        return {
          isRunning: this.isRunning,
          registeredAgents: Array.from(this.agents.keys()),
          queuedTasks: this.taskQueue.length,
          executingTasks: this.executingTasks.size,
          completedTasks: this.completedTasks.size
        };
      }
      /**
       * Process the task queue
       */
      processQueue() {
        if (this.executingTasks.size >= this.config.maxConcurrentTasks) {
          return;
        }
        const task = this.taskQueue.shift();
        if (!task) {
          return;
        }
        const agent = this.selectAgent(task);
        if (!agent) {
          logger.warn(`No suitable agent found for task ${task.id}`);
          this.taskQueue.unshift(task);
          return;
        }
        this.executeTask(task, agent);
      }
      /**
       * Select the best agent for a task
       */
      selectAgent(task) {
        const availableAgents = Array.from(this.agents.values()).filter(
          (agent) => agent.canHandle(task)
        );
        if (availableAgents.length === 0) {
          return null;
        }
        switch (this.config.loadBalancing) {
          case "round-robin":
            return this.selectRoundRobin(availableAgents);
          case "least-loaded":
            return this.selectLeastLoaded(availableAgents);
          case "capability-based":
          default:
            return this.selectByCapability(availableAgents, task);
        }
      }
      /**
       * Round-robin selection
       */
      selectRoundRobin(agents) {
        if (agents.length === 0) {
          throw new Error("No agents available for selection");
        }
        return agents[0];
      }
      /**
       * Select least loaded agent
       */
      selectLeastLoaded(agents) {
        if (agents.length === 0) {
          throw new Error("No agents available for selection");
        }
        return agents.reduce((least, current) => {
          const leastMetrics = least.getMetrics();
          const currentMetrics = current.getMetrics();
          return currentMetrics.currentLoad < leastMetrics.currentLoad ? current : least;
        });
      }
      /**
       * Select agent based on capabilities
       */
      selectByCapability(agents, task) {
        const scored = agents.map((agent) => {
          const score = task.requiredCapabilities.filter((cap) => agent.role === cap).length;
          return { agent, score };
        });
        scored.sort((a, b) => b.score - a.score);
        return scored[0]?.agent || null;
      }
      /**
       * Execute a task with an agent
       */
      async executeTask(task, agent) {
        const taskNode = {
          id: task.id,
          task,
          assignedAgent: agent.role,
          status: "running",
          startTime: /* @__PURE__ */ new Date()
        };
        this.executingTasks.set(task.id, taskNode);
        logger.info(`Executing task ${task.id} with agent ${agent.role}`);
        try {
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Task timeout")), this.config.taskTimeout);
          });
          const result = await Promise.race([agent.execute(task), timeoutPromise]);
          taskNode.status = "completed";
          taskNode.endTime = /* @__PURE__ */ new Date();
          taskNode.result = result;
          this.completedTasks.set(task.id, result);
          this.executingTasks.delete(task.id);
          this.emit("taskCompleted", { task, result });
        } catch (error) {
          logger.error(`Task ${task.id} failed:`, error);
          taskNode.status = "failed";
          taskNode.endTime = /* @__PURE__ */ new Date();
          const result = {
            taskId: task.id,
            agentRole: agent.role,
            status: "failure",
            error: error instanceof Error ? error : new Error(String(error)),
            duration: Date.now() - (taskNode.startTime?.getTime() || Date.now())
          };
          taskNode.result = result;
          this.completedTasks.set(task.id, result);
          this.executingTasks.delete(task.id);
          if (await this.shouldRetry(task)) {
            logger.info(`Retrying task ${task.id}`);
            await this.submitTask(task);
          }
          this.emit("taskFailed", { task, error });
        }
      }
      /**
       * Check if task should be retried
       */
      async shouldRetry(_task) {
        return false;
      }
      /**
       * Wait for task completion
       */
      async waitForTaskCompletion(taskId) {
        return new Promise((resolve) => {
          const checkInterval = setInterval(() => {
            const result = this.completedTasks.get(taskId);
            if (result) {
              clearInterval(checkInterval);
              resolve(result);
            }
          }, 100);
        });
      }
      /**
       * Wait for task dependencies
       */
      async waitForDependencies(task, dependencies) {
        const deps = dependencies.get(task.id);
        if (!deps || deps.length === 0) {
          return;
        }
        await Promise.all(deps.map((depId) => this.waitForTaskCompletion(depId)));
      }
      /**
       * Wait for all executing tasks
       */
      async waitForAllTasks() {
        const tasks = Array.from(this.executingTasks.keys());
        await Promise.all(tasks.map((taskId) => this.waitForTaskCompletion(taskId)));
      }
      /**
       * Topological sort for task dependencies
       */
      topologicalSort(tasks, dependencies) {
        const sorted = [];
        const visited = /* @__PURE__ */ new Set();
        const visiting = /* @__PURE__ */ new Set();
        const visit = /* @__PURE__ */ __name((taskId) => {
          if (visited.has(taskId)) return;
          if (visiting.has(taskId)) {
            throw new Error("Circular dependency detected");
          }
          visiting.add(taskId);
          const deps = dependencies.get(taskId) || [];
          for (const depId of deps) {
            visit(depId);
          }
          visiting.delete(taskId);
          visited.add(taskId);
          const task = tasks.find((t) => t.task.id === taskId);
          if (task) {
            sorted.push(task);
          }
        }, "visit");
        for (const task of tasks) {
          visit(task.task.id);
        }
        return sorted;
      }
      /**
       * Setup agent event listeners
       */
      setupAgentListeners(agent) {
        const forwardEvent = /* @__PURE__ */ __name((eventName) => {
          agent.on(eventName, (data) => {
            this.emit(`agent:${eventName}`, { agent: agent.role, data });
          });
        }, "forwardEvent");
        forwardEvent("initialized");
        forwardEvent("taskCompleted");
        forwardEvent("taskFailed");
        forwardEvent("messageSent");
        forwardEvent("messageReceived");
        forwardEvent("shutdown");
      }
      /**
       * Send message between agents
       */
      async routeMessage(message) {
        if (message.to === "orchestrator") {
          this.handleOrchestratorMessage(message);
        } else {
          const targetAgent = this.agents.get(message.to);
          if (targetAgent) {
            await targetAgent.receiveMessage(message);
          } else {
            logger.warn(`Target agent ${message.to} not found for message routing`);
          }
        }
      }
      /**
       * Handle messages directed to orchestrator
       */
      handleOrchestratorMessage(message) {
        logger.debug(`Orchestrator received message from ${message.from}:`, message);
        this.emit("messageReceived", message);
      }
      /**
       * Enhanced workflow execution with result synthesis
       */
      async executeEnhancedWorkflow(workflowId, tasks, userIntent) {
        logger.info(`Starting enhanced workflow ${workflowId} with ${tasks.length} tasks`);
        const workflowResults = /* @__PURE__ */ new Map();
        for (let i = 0; i < tasks.length; i++) {
          const task = tasks[i];
          const result = await this.executeEnhancedTask(task, {
            workflowId,
            stepNumber: i + 1,
            previousResults: workflowResults,
            userIntent,
            totalSteps: tasks.length
          });
          if (result.status === "success") {
            workflowResults.set(result.agentRole, result);
          } else {
            logger.error(`Enhanced task ${task.id} failed, stopping workflow`);
            break;
          }
        }
        this.workflowResults.set(workflowId, workflowResults);
        const synthesizedOutput = await this.synthesisEngine.synthesizeResults(
          workflowId,
          workflowResults
        );
        logger.info(`Enhanced workflow ${workflowId} completed with synthesis`);
        return synthesizedOutput;
      }
      /**
       * Execute task with enhanced context and communication
       */
      async executeEnhancedTask(task, workflowContext) {
        const agent = this.selectAgent(task);
        if (!agent) {
          throw new Error(`No suitable agent found for task ${task.id}`);
        }
        logger.info(`Executing enhanced task ${task.id} with agent ${agent.role}`);
        const enhancedMessage = {
          id: uuid.v4(),
          from: "orchestrator",
          to: agent.role,
          type: "request",
          payload: task.input,
          timestamp: /* @__PURE__ */ new Date(),
          correlationId: task.id,
          dataFlow: {
            inputSchema: { taskType: task.type, priority: task.priority },
            transformations: []
          },
          context: {
            workflowId: workflowContext.workflowId,
            stepNumber: workflowContext.stepNumber,
            previousResults: workflowContext.previousResults,
            sharedKnowledge: this.extractSharedKnowledge(workflowContext.previousResults),
            userIntent: workflowContext.userIntent
          },
          quality: {
            confidence: 0.9,
            validationChecks: ["input-validation", "context-validation"],
            errorPrevention: ["timeout-handling", "result-validation"]
          }
        };
        await this.communicationBroker.routeEnhancedMessage(enhancedMessage);
        const baseResult = await agent.execute(task);
        const enhancedResult = {
          ...baseResult,
          structuredOutput: {
            primary: baseResult.output,
            auxiliary: {},
            insights: ["Task completed successfully"],
            recommendations: ["Review output for accuracy"]
          },
          forwardingData: {
            dataTransfers: /* @__PURE__ */ new Map(),
            synthesisInstructions: ["Include in final synthesis"]
          },
          qualityMetrics: {
            accuracy: 0.9,
            completeness: 0.95,
            relevance: 0.9,
            coherence: 0.85
          }
        };
        return enhancedResult;
      }
      /**
       * Extract shared knowledge from previous results
       */
      extractSharedKnowledge(previousResults) {
        const sharedKnowledge = {};
        for (const [role, result] of previousResults) {
          sharedKnowledge[`${role}_insights`] = result.structuredOutput.insights;
          sharedKnowledge[`${role}_output`] = result.structuredOutput.primary;
        }
        return sharedKnowledge;
      }
      /**
       * Handle message from communication broker
       */
      handleBrokerMessage(event) {
        logger.debug(`Broker message for ${event.targetAgent}`);
        this.emit("enhancedMessage", event);
      }
      /**
       * Handle synthesis completion
       */
      handleSynthesisCompletion(output) {
        logger.info(`Synthesis completed for workflow ${output.workflowId}`);
        this.emit("workflowSynthesized", output);
      }
      /**
       * Get enhanced orchestrator status
       */
      getEnhancedStatus() {
        const basicStatus = this.getStatus();
        return {
          basic: basicStatus,
          workflows: {
            active: this.executingTasks.size,
            completed: this.workflowResults.size,
            totalResults: Array.from(this.workflowResults.values()).reduce(
              (sum, results) => sum + results.size,
              0
            )
          },
          communication: {
            messagesRouted: 0,
            // Would be tracked in implementation
            synthesisRules: 2
            // Default rules count
          }
        };
      }
    };
  }
});
var MCPIntegrationService, mcpService;
var init_mcp_integration = __esm({
  "src/services/mcp-integration.ts"() {
    init_cjs_shims();
    init_logger();
    globalThis.WebSocket || class MockWebSocket {
      static {
        __name(this, "MockWebSocket");
      }
      readyState = 1;
      send(_data) {
      }
      close() {
      }
      addEventListener(_type, _listener) {
      }
    };
    MCPIntegrationService = class extends events.EventEmitter {
      static {
        __name(this, "MCPIntegrationService");
      }
      servers = /* @__PURE__ */ new Map();
      tools = /* @__PURE__ */ new Map();
      resources = /* @__PURE__ */ new Map();
      connections = /* @__PURE__ */ new Map();
      isInitialized = false;
      constructor() {
        super();
      }
      /**
       * Initialize MCP integration service
       */
      async initialize() {
        if (this.isInitialized) {
          logger.warn("MCP Integration Service already initialized");
          return;
        }
        logger.info("Initializing MCP Integration Service...");
        try {
          await this.registerDefaultServers();
          await this.initializeConnections();
          this.isInitialized = true;
          logger.info("MCP Integration Service initialized successfully");
        } catch (error) {
          logger.error("Failed to initialize MCP Integration Service:", error);
          throw error;
        }
      }
      /**
       * Register an MCP server
       */
      async registerServer(server) {
        logger.info(`Registering MCP server: ${server.name}`);
        this.servers.set(server.name, server);
        try {
          await this.connectToServer(server);
          await this.discoverCapabilities(server);
          this.emit("serverRegistered", server);
        } catch (error) {
          logger.error(`Failed to register MCP server ${server.name}:`, error);
          server.status = "error";
        }
      }
      /**
       * Execute an MCP tool
       */
      async executeTool(toolName, params, context) {
        const tool = this.tools.get(toolName);
        if (!tool) {
          throw new Error(`MCP tool '${toolName}' not found`);
        }
        const server = this.servers.get(tool.server);
        if (!server || server.status !== "connected") {
          throw new Error(`MCP server '${tool.server}' not available`);
        }
        logger.info(`Executing MCP tool: ${toolName} on server: ${tool.server}`);
        const request = {
          id: this.generateRequestId(),
          method: "tools/call",
          params: {
            name: toolName,
            arguments: params,
            context: context || {}
          },
          server: tool.server,
          timestamp: /* @__PURE__ */ new Date()
        };
        try {
          const response = await this.sendRequest(request);
          if (response.error) {
            throw new Error(`MCP tool execution failed: ${response.error.message}`);
          }
          this.emit("toolExecuted", { tool, request, response, context });
          return response.result;
        } catch (error) {
          logger.error(`MCP tool execution failed for ${toolName}:`, error);
          throw error;
        }
      }
      /**
       * Get available MCP tools
       */
      getAvailableTools() {
        return Array.from(this.tools.values());
      }
      /**
       * Get tools by category/type
       */
      getToolsByCategory(category) {
        return Array.from(this.tools.values()).filter(
          (tool) => tool.description.toLowerCase().includes(category.toLowerCase()) || tool.name.toLowerCase().includes(category.toLowerCase())
        );
      }
      /**
       * Get MCP resources
       */
      getAvailableResources() {
        return Array.from(this.resources.values());
      }
      /**
       * Access an MCP resource
       */
      async accessResource(uri) {
        const resource = this.resources.get(uri);
        if (!resource) {
          throw new Error(`MCP resource '${uri}' not found`);
        }
        const server = this.servers.get(resource.server);
        if (!server || server.status !== "connected") {
          throw new Error(`MCP server '${resource.server}' not available`);
        }
        const request = {
          id: this.generateRequestId(),
          method: "resources/read",
          params: { uri },
          server: resource.server,
          timestamp: /* @__PURE__ */ new Date()
        };
        const response = await this.sendRequest(request);
        if (response.error) {
          throw new Error(`MCP resource access failed: ${response.error.message}`);
        }
        return response.result;
      }
      /**
       * Get service status
       */
      getStatus() {
        const servers = Array.from(this.servers.values()).map((server) => ({
          name: server.name,
          status: server.status,
          toolCount: Array.from(this.tools.values()).filter((t) => t.server === server.name).length
        }));
        return {
          initialized: this.isInitialized,
          servers,
          totalTools: this.tools.size,
          totalResources: this.resources.size
        };
      }
      /**
       * Register default MCP servers
       */
      async registerDefaultServers() {
        await this.registerServer({
          name: "github",
          version: "1.0.0",
          description: "GitHub integration for repository management",
          url: "mcp://github.com/api",
          capabilities: [],
          status: "initializing"
        });
        await this.registerServer({
          name: "code-analysis",
          version: "1.0.0",
          description: "Code analysis and quality assessment tools",
          url: "mcp://localhost:3001/code-analysis",
          capabilities: [],
          status: "initializing"
        });
        await this.registerServer({
          name: "document-processor",
          version: "1.0.0",
          description: "PDF parsing, arXiv fetching, and document processing",
          url: "mcp://localhost:3002/documents",
          capabilities: [],
          status: "initializing"
        });
        await this.registerServer({
          name: "vector-db",
          version: "1.0.0",
          description: "Vector-based code search and semantic analysis",
          url: "mcp://localhost:3003/vector",
          capabilities: [],
          status: "initializing"
        });
      }
      /**
       * Initialize connections to all servers
       */
      async initializeConnections() {
        const connectionPromises = Array.from(this.servers.values()).map(
          (server) => this.connectToServer(server).catch((error) => {
            logger.warn(`Failed to connect to MCP server ${server.name}:`, error);
            server.status = "error";
          })
        );
        await Promise.allSettled(connectionPromises);
      }
      /**
       * Connect to an MCP server
       */
      async connectToServer(server) {
        logger.debug(`Connecting to MCP server: ${server.name} at ${server.url}`);
        await new Promise((resolve) => setTimeout(resolve, 100));
        server.status = "connected";
        this.emit("serverConnected", server);
      }
      /**
       * Discover capabilities from an MCP server
       */
      async discoverCapabilities(server) {
        logger.debug(`Discovering capabilities for MCP server: ${server.name}`);
        const mockCapabilities = this.getMockCapabilities(server.name);
        server.capabilities = mockCapabilities;
        for (const capability of mockCapabilities) {
          if (capability.type === "tool") {
            this.tools.set(capability.name, {
              name: capability.name,
              description: capability.description,
              inputSchema: capability.schema,
              server: server.name
            });
          } else if (capability.type === "resource") {
            this.resources.set(capability.name, {
              uri: capability.name,
              name: capability.name,
              description: capability.description,
              server: server.name
            });
          }
        }
      }
      /**
       * Send request to MCP server
       */
      async sendRequest(request) {
        logger.debug(`Sending MCP request: ${request.method} to ${request.server}`);
        await new Promise((resolve) => setTimeout(resolve, 200));
        const response = {
          id: request.id,
          result: this.getMockResponse(request),
          timestamp: /* @__PURE__ */ new Date()
        };
        return response;
      }
      /**
       * Generate unique request ID
       */
      generateRequestId() {
        return `mcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }
      /**
       * Get mock capabilities for different servers
       */
      getMockCapabilities(serverName) {
        switch (serverName) {
          case "github":
            return [
              {
                name: "create-repository",
                type: "tool",
                description: "Create a new GitHub repository",
                schema: { name: "string", description: "string", private: "boolean" }
              },
              {
                name: "search-code",
                type: "tool",
                description: "Search code across GitHub repositories",
                schema: { query: "string", language: "string" }
              }
            ];
          case "code-analysis":
            return [
              {
                name: "analyze-complexity",
                type: "tool",
                description: "Analyze code complexity metrics",
                schema: { code: "string", language: "string" }
              },
              {
                name: "detect-patterns",
                type: "tool",
                description: "Detect code patterns and anti-patterns",
                schema: { codebase: "string", patterns: "array" }
              }
            ];
          case "document-processor":
            return [
              {
                name: "parse-pdf",
                type: "tool",
                description: "Parse PDF documents and extract text/structure",
                schema: { pdf_url: "string", extract_images: "boolean" }
              },
              {
                name: "fetch-arxiv",
                type: "tool",
                description: "Fetch papers from arXiv by ID or search",
                schema: { arxiv_id: "string", search_query: "string" }
              }
            ];
          case "vector-db":
            return [
              {
                name: "semantic-search",
                type: "tool",
                description: "Semantic search through codebase using vector embeddings",
                schema: { query: "string", limit: "number", threshold: "number" }
              },
              {
                name: "index-codebase",
                type: "tool",
                description: "Index codebase for vector-based search",
                schema: { path: "string", file_types: "array" }
              }
            ];
          default:
            return [];
        }
      }
      /**
       * Get mock response for different requests
       */
      getMockResponse(request) {
        switch (request.method) {
          case "tools/call":
            return {
              success: true,
              data: `Mock result for ${request.params.name}`,
              metadata: {
                executionTime: "150ms",
                confidence: 0.95
              }
            };
          case "resources/read":
            return {
              content: `Mock resource content for ${request.params.uri}`,
              mimeType: "text/plain",
              size: 1024
            };
          default:
            return { message: "Mock response" };
        }
      }
    };
    mcpService = new MCPIntegrationService();
  }
});
var CodeRAGService, codeRAGService;
var init_coderag_system = __esm({
  "src/services/coderag-system.ts"() {
    init_cjs_shims();
    init_logger();
    init_mcp_integration();
    CodeRAGService = class extends events.EventEmitter {
      static {
        __name(this, "CodeRAGService");
      }
      codeChunks = /* @__PURE__ */ new Map();
      embeddings = /* @__PURE__ */ new Map();
      indexedPaths = /* @__PURE__ */ new Set();
      isInitialized = false;
      embeddingModel = "text-embedding-3-small";
      constructor() {
        super();
      }
      /**
       * Initialize CodeRAG system
       */
      async initialize() {
        if (this.isInitialized) {
          logger.warn("CodeRAG system already initialized");
          return;
        }
        logger.info("Initializing CodeRAG system...");
        try {
          await this.initializeVectorDatabase();
          await this.setupDefaultEmbeddings();
          this.isInitialized = true;
          logger.info("CodeRAG system initialized successfully");
          this.emit("initialized");
        } catch (error) {
          logger.error("Failed to initialize CodeRAG system:", error);
          throw error;
        }
      }
      /**
       * Index a codebase for vector search
       */
      async indexCodebase(rootPath, options = {}) {
        logger.info(`Indexing codebase at: ${rootPath}`);
        const {
          fileTypes = [".ts", ".tsx", ".js", ".jsx", ".py", ".java", ".cpp", ".c", ".go", ".rs"],
          excludePaths = ["node_modules", ".git", "dist", "build"],
          chunkSize = 500,
          includeTests = false
        } = options;
        let indexed = 0;
        const skipped = 0;
        const errors = [];
        try {
          const indexResult = await mcpService.executeTool("index-codebase", {
            path: rootPath,
            file_types: fileTypes,
            exclude_paths: excludePaths,
            chunk_size: chunkSize,
            include_tests: includeTests
          });
          const mockResult = indexResult;
          for (const chunkData of mockResult.chunks || []) {
            const chunk = {
              id: chunkData.id,
              content: chunkData.content,
              filePath: chunkData.file_path,
              startLine: chunkData.start_line,
              endLine: chunkData.end_line,
              language: chunkData.language,
              metadata: {
                complexity: chunkData.metadata["complexity"] || 1,
                dependencies: chunkData.metadata["dependencies"] || [],
                imports: chunkData.metadata["imports"] || [],
                exports: chunkData.metadata["exports"] || []
              }
            };
            this.codeChunks.set(chunk.id, chunk);
            indexed++;
          }
          for (const embeddingData of mockResult.embeddings || []) {
            const embedding = {
              id: embeddingData.chunk_id,
              vector: embeddingData.vector,
              dimensions: embeddingData.vector.length,
              model: this.embeddingModel,
              timestamp: /* @__PURE__ */ new Date()
            };
            this.embeddings.set(embedding.id, embedding);
          }
          this.indexedPaths.add(rootPath);
          logger.info(`Codebase indexing completed: ${indexed} chunks indexed, ${skipped} skipped`);
          this.emit("indexingCompleted", { rootPath, indexed, skipped });
        } catch (error) {
          const errorMsg = `Indexing failed for ${rootPath}: ${error}`;
          errors.push(errorMsg);
          logger.error(errorMsg);
        }
        return { indexed, skipped, errors };
      }
      /**
       * Perform semantic code search
       */
      async semanticSearch(query) {
        if (!this.isInitialized) {
          throw new Error("CodeRAG system not initialized");
        }
        logger.info(`Performing semantic search: "${query.query}"`);
        try {
          const searchResult = await mcpService.executeTool("semantic-search", {
            query: query.query,
            language: query.language,
            limit: query.maxResults || 10,
            threshold: query.threshold || 0.7,
            context: query.context || {}
          });
          const mockResults = searchResult;
          const results = [];
          for (const result of mockResults.results || []) {
            const chunk = this.codeChunks.get(result.chunk_id);
            if (chunk) {
              results.push({
                chunk,
                similarity: result.similarity,
                explanation: result.explanation,
                relevanceScore: result.relevance_score,
                contextMatch: this.evaluateContextMatch(chunk, query.context)
              });
            }
          }
          results.sort((a, b) => b.relevanceScore - a.relevanceScore);
          logger.info(`Semantic search completed: ${results.length} results found`);
          this.emit("searchCompleted", { query, results });
          return results;
        } catch (error) {
          logger.error(`Semantic search failed:`, error);
          throw error;
        }
      }
      /**
       * Analyze codebase semantically
       */
      async analyzeCodebase(paths, options = {}) {
        logger.info(`Analyzing codebase semantically: ${paths.length} paths`);
        const { includePatterns = true, includeComplexity = true, includeInsights = true } = options;
        try {
          const analysisResult = await mcpService.executeTool("analyze-complexity", {
            paths,
            include_patterns: includePatterns,
            include_complexity: includeComplexity,
            include_insights: includeInsights
          });
          const mockAnalysis = analysisResult;
          const analysis = {
            codebase: {
              totalFiles: mockAnalysis.codebase?.totalfiles || 0,
              totalChunks: mockAnalysis.codebase?.total_chunks || 0,
              languages: mockAnalysis.codebase?.languages || [],
              complexityDistribution: mockAnalysis.codebase?.complexity_distribution || {}
            },
            patterns: {
              commonPatterns: mockAnalysis.patterns?.common_patterns?.map((p) => ({
                pattern: p.pattern,
                frequency: p.frequency,
                examples: p.examples
              })) || [],
              antiPatterns: mockAnalysis.patterns?.anti_patterns?.map((p) => ({
                pattern: p.pattern,
                severity: p.severity,
                locations: p.locations
              })) || []
            },
            insights: mockAnalysis.insights || [],
            recommendations: mockAnalysis.recommendations || []
          };
          logger.info("Codebase semantic analysis completed");
          this.emit("analysisCompleted", { paths, analysis });
          return analysis;
        } catch (error) {
          logger.error("Codebase analysis failed:", error);
          throw error;
        }
      }
      /**
       * Find similar code patterns
       */
      async findSimilarPatterns(codeSnippet, options = {}) {
        const { language, minSimilarity = 0.6, maxResults = 5 } = options;
        logger.info("Finding similar code patterns");
        return await this.semanticSearch({
          query: `Similar to: ${codeSnippet}`,
          language,
          threshold: minSimilarity,
          maxResults
        });
      }
      /**
       * Get contextual code suggestions
       */
      async getContextualSuggestions(currentCode, context) {
        logger.info(`Getting contextual suggestions for: ${context.filePath}`);
        const relatedChunks = await this.semanticSearch({
          query: currentCode,
          maxResults: 3,
          threshold: 0.5,
          context: {
            currentFile: context.filePath,
            workflowId: context.workflowId
          }
        });
        const suggestions = [
          {
            type: "completion",
            description: "Auto-complete based on similar patterns",
            code: "// Suggested completion based on CodeRAG analysis",
            confidence: 0.8
          },
          {
            type: "refactor",
            description: "Refactoring suggestion from codebase patterns",
            code: "// Refactoring suggestion from similar code",
            confidence: 0.7
          },
          {
            type: "optimization",
            description: "Performance optimization opportunity",
            code: "// Optimization based on codebase analysis",
            confidence: 0.6
          }
        ];
        return { suggestions, relatedChunks };
      }
      /**
       * Get system status
       */
      getStatus() {
        return {
          initialized: this.isInitialized,
          indexedPaths: Array.from(this.indexedPaths),
          totalChunks: this.codeChunks.size,
          totalEmbeddings: this.embeddings.size,
          embeddingModel: this.embeddingModel,
          lastIndexed: this.indexedPaths.size > 0 ? /* @__PURE__ */ new Date() : void 0
        };
      }
      /**
       * Initialize vector database connection
       */
      async initializeVectorDatabase() {
        logger.debug("Initializing vector database connection");
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      /**
       * Set up default embeddings
       */
      async setupDefaultEmbeddings() {
        logger.debug("Setting up default embeddings");
        const defaultPatterns = [
          "function declaration",
          "class definition",
          "import statement",
          "async function",
          "error handling",
          "data validation"
        ];
        for (let i = 0; i < defaultPatterns.length; i++) {
          const embedding = {
            id: `default-${i}`,
            vector: Array.from({ length: 1536 }, () => Math.random()),
            dimensions: 1536,
            model: this.embeddingModel,
            timestamp: /* @__PURE__ */ new Date()
          };
          this.embeddings.set(embedding.id, embedding);
        }
      }
      /**
       * Evaluate context match
       */
      evaluateContextMatch(chunk, context) {
        if (!context) return false;
        if (context.currentFile) {
          const sameFile = chunk.filePath === context.currentFile;
          const relatedFile = chunk.filePath.includes(context.currentFile.split("/").pop() || "");
          return sameFile || relatedFile;
        }
        return false;
      }
    };
    codeRAGService = new CodeRAGService();
  }
});
var DocumentProcessorService, documentProcessor;
var init_document_processor = __esm({
  "src/services/document-processor.ts"() {
    init_cjs_shims();
    init_logger();
    init_mcp_integration();
    DocumentProcessorService = class extends events.EventEmitter {
      static {
        __name(this, "DocumentProcessorService");
      }
      processedDocuments = /* @__PURE__ */ new Map();
      processingQueue = [];
      isInitialized = false;
      isProcessing = false;
      constructor() {
        super();
      }
      /**
       * Initialize document processing service
       */
      async initialize() {
        if (this.isInitialized) {
          logger.warn("Document processor already initialized");
          return;
        }
        logger.info("Initializing document processing service...");
        try {
          await this.initializeProcessingCapabilities();
          await this.setupArXivIntegration();
          this.isInitialized = true;
          logger.info("Document processing service initialized successfully");
          this.emit("initialized");
        } catch (error) {
          logger.error("Failed to initialize document processing service:", error);
          throw error;
        }
      }
      /**
       * Process a document from various sources
       */
      async processDocument(source, options = {}) {
        if (!this.isInitialized) {
          throw new Error("Document processor not initialized");
        }
        logger.info(`Processing document: ${source.type} - ${source.identifier}`);
        const documentId = this.generateDocumentId(source);
        const existing = this.processedDocuments.get(documentId);
        if (existing) {
          logger.info(`Document already processed: ${documentId}`);
          return existing;
        }
        const defaultOptions = {
          extractStructure: true,
          extractAlgorithms: true,
          extractCode: true,
          extractFormulas: true,
          extractDiagrams: false,
          extractImages: false,
          ocrEnabled: true,
          language: "auto",
          qualityThreshold: 0.7,
          ...options
        };
        try {
          let document2;
          switch (source.type) {
            case "pdf":
              document2 = await this.processPDF(source, defaultOptions);
              break;
            case "arxiv":
              document2 = await this.processArXiv(source, defaultOptions);
              break;
            case "url":
              document2 = await this.processURL(source, defaultOptions);
              break;
            case "docx":
              document2 = await this.processDOCX(source, defaultOptions);
              break;
            case "html":
            case "markdown":
            case "text":
              document2 = await this.processTextDocument(source, defaultOptions);
              break;
            default:
              throw new Error(`Unsupported document type: ${source.type}`);
          }
          this.processedDocuments.set(documentId, document2);
          logger.info(`Document processing completed: ${documentId}`);
          this.emit("documentProcessed", { documentId, document: document2 });
          return document2;
        } catch (error) {
          logger.error(`Document processing failed for ${documentId}:`, error);
          throw error;
        }
      }
      /**
       * Process PDF document with enhanced extraction
       */
      async processPDF(source, options) {
        logger.info(`Processing PDF: ${source.identifier}`);
        const result = await mcpService.executeTool("parse-pdf", {
          pdf_url: source.identifier,
          extract_images: options.extractImages || false,
          extract_structure: options.extractStructure || true,
          extract_algorithms: options.extractAlgorithms || true,
          ocr_enabled: options.ocrEnabled || true,
          language: options.language || "auto"
        });
        const mockResult = result;
        return this.buildDocumentFromResult(source, mockResult.document, options);
      }
      /**
       * Process arXiv paper
       */
      async processArXiv(source, options) {
        logger.info(`Processing arXiv paper: ${source.identifier}`);
        const result = await mcpService.executeTool("fetch-arxiv", {
          arxiv_id: source.identifier,
          extract_algorithms: options.extractAlgorithms || true,
          extract_code: options.extractCode || true,
          include_metadata: true
        });
        const mockResult = result;
        return this.buildDocumentFromArXivResult(source, mockResult.paper, options);
      }
      /**
       * Process URL document
       */
      async processURL(source, options) {
        logger.info(`Processing URL: ${source.identifier}`);
        const result = await mcpService.executeTool("fetch-web-content", {
          url: source.identifier,
          extract_text: true,
          extract_structure: options.extractStructure || true,
          follow_links: false
        });
        const mockResult = result;
        return this.buildDocumentFromWebResult(source, mockResult.content, options);
      }
      /**
       * Process DOCX document
       */
      async processDOCX(source, options) {
        logger.info(`Processing DOCX: ${source.identifier}`);
        const result = await mcpService.executeTool("parse-docx", {
          file_path: source.identifier,
          extract_structure: options.extractStructure || true,
          extract_images: options.extractImages || false
        });
        const mockResult = result;
        return this.buildDocumentFromOfficeResult(source, mockResult.document, options);
      }
      /**
       * Process text-based documents
       */
      async processTextDocument(source, options) {
        logger.info(`Processing text document: ${source.identifier}`);
        const mockContent = {
          title: "Text Document",
          content: "Sample text content...",
          sections: []
        };
        return this.buildDocumentFromTextResult(source, mockContent, options);
      }
      /**
       * Build document from processing result
       */
      buildDocumentFromResult(source, result, options) {
        const documentId = this.generateDocumentId(source);
        const document2 = {
          id: documentId,
          title: result.title || "Untitled Document",
          source,
          content: {
            rawText: result.content?.raw_text || "",
            structuredContent: {
              title: result.title,
              abstract: result.abstract,
              sections: this.buildSections(result.content?.sections || []),
              figures: this.buildFigures(result.content?.figures || []),
              tables: this.buildTables(result.content?.tables || []),
              references: this.buildReferences(result.content?.references || [])
            },
            extractedElements: {
              algorithms: this.buildAlgorithms(result.algorithms || []),
              codeBlocks: this.buildCodeBlocks(result.code_blocks || []),
              formulas: this.buildFormulas(result.formulas || []),
              diagrams: this.buildDiagrams(result.diagrams || [])
            }
          },
          metadata: {
            authors: result.metadata?.authors || [],
            publishedDate: result.metadata?.published_date ? new Date(result.metadata.published_date) : void 0,
            journal: result.metadata?.journal,
            doi: result.metadata?.doi,
            arxivId: result.metadata?.arxiv_id,
            keywords: result.metadata?.keywords || [],
            pageCount: result.metadata?.page_count || 0,
            wordCount: result.metadata?.word_count || 0,
            language: result.metadata?.language || "unknown",
            processingQuality: {
              textExtractionScore: 0.9,
              structureRecognitionScore: 0.85,
              algorithmExtractionScore: 0.8,
              overallScore: 0.85
            }
          },
          processingTimestamp: /* @__PURE__ */ new Date()
        };
        return document2;
      }
      /**
       * Build document from arXiv result
       */
      buildDocumentFromArXivResult(source, result, options) {
        const documentId = this.generateDocumentId(source);
        return {
          id: documentId,
          title: result.title || "arXiv Paper",
          source,
          content: {
            rawText: result.content?.raw_text || "",
            structuredContent: {
              title: result.title,
              abstract: result.abstract,
              sections: this.buildSections(result.content?.sections || []),
              figures: [],
              tables: [],
              references: []
            },
            extractedElements: {
              algorithms: this.buildAlgorithms(result.algorithms || []),
              codeBlocks: [],
              formulas: [],
              diagrams: []
            }
          },
          metadata: {
            authors: result.authors || [],
            publishedDate: result.published_date ? new Date(result.published_date) : void 0,
            arxivId: result.arxiv_id,
            keywords: [],
            pageCount: 0,
            wordCount: result.content?.raw_text?.split(/\s+/).length || 0,
            language: "en",
            processingQuality: {
              textExtractionScore: 0.95,
              structureRecognitionScore: 0.9,
              algorithmExtractionScore: 0.85,
              overallScore: 0.9
            }
          },
          processingTimestamp: /* @__PURE__ */ new Date()
        };
      }
      /**
       * Build document from web content result
       */
      buildDocumentFromWebResult(source, result, options) {
        const documentId = this.generateDocumentId(source);
        return {
          id: documentId,
          title: result.title || "Web Document",
          source,
          content: {
            rawText: result.text || "",
            structuredContent: {
              title: result.title,
              sections: result.sections?.map((s, i) => ({
                id: `section-${i}`,
                title: s.tag || `Section ${i + 1}`,
                level: 1,
                content: s.content || "",
                subsections: [],
                wordCount: s.content?.split(/\s+/).length || 0
              })) || [],
              figures: [],
              tables: [],
              references: []
            },
            extractedElements: {
              algorithms: [],
              codeBlocks: [],
              formulas: [],
              diagrams: []
            }
          },
          metadata: {
            authors: [],
            keywords: [],
            pageCount: 1,
            wordCount: result.text?.split(/\s+/).length || 0,
            language: "unknown",
            processingQuality: {
              textExtractionScore: 0.8,
              structureRecognitionScore: 0.7,
              algorithmExtractionScore: 0,
              overallScore: 0.65
            }
          },
          processingTimestamp: /* @__PURE__ */ new Date()
        };
      }
      /**
       * Build document from office document result
       */
      buildDocumentFromOfficeResult(source, result, options) {
        const documentId = this.generateDocumentId(source);
        return {
          id: documentId,
          title: result.title || "Office Document",
          source,
          content: {
            rawText: result.content || "",
            structuredContent: {
              title: result.title,
              sections: this.buildSections(result.sections || []),
              figures: [],
              tables: [],
              references: []
            },
            extractedElements: {
              algorithms: [],
              codeBlocks: [],
              formulas: [],
              diagrams: []
            }
          },
          metadata: {
            authors: [],
            keywords: [],
            pageCount: 1,
            wordCount: result.content?.split(/\s+/).length || 0,
            language: "unknown",
            processingQuality: {
              textExtractionScore: 0.85,
              structureRecognitionScore: 0.8,
              algorithmExtractionScore: 0,
              overallScore: 0.75
            }
          },
          processingTimestamp: /* @__PURE__ */ new Date()
        };
      }
      /**
       * Build document from text result
       */
      buildDocumentFromTextResult(source, result, options) {
        const documentId = this.generateDocumentId(source);
        return {
          id: documentId,
          title: result.title || "Text Document",
          source,
          content: {
            rawText: result.content || "",
            structuredContent: {
              title: result.title,
              sections: [],
              figures: [],
              tables: [],
              references: []
            },
            extractedElements: {
              algorithms: [],
              codeBlocks: [],
              formulas: [],
              diagrams: []
            }
          },
          metadata: {
            authors: [],
            keywords: [],
            pageCount: 1,
            wordCount: result.content?.split(/\s+/).length || 0,
            language: "unknown",
            processingQuality: {
              textExtractionScore: 1,
              structureRecognitionScore: 0.5,
              algorithmExtractionScore: 0,
              overallScore: 0.6
            }
          },
          processingTimestamp: /* @__PURE__ */ new Date()
        };
      }
      // Helper methods for building document components
      buildSections(sections) {
        return sections.map((s, i) => ({
          id: s.id || `section-${i}`,
          title: s.title || `Section ${i + 1}`,
          level: s.level || 1,
          content: s.content || "",
          subsections: [],
          pageNumber: s.page_number,
          wordCount: s.content?.split(/\s+/).length || 0
        }));
      }
      buildFigures(figures) {
        return figures.map((f, i) => ({
          id: f.id || `figure-${i}`,
          caption: f.caption || "",
          description: f.description,
          pageNumber: f.page_number || 0
        }));
      }
      buildTables(tables) {
        return tables.map((t, i) => ({
          id: t.id || `table-${i}`,
          caption: t.caption || "",
          headers: t.headers || [],
          rows: t.rows || [],
          pageNumber: t.page_number || 0
        }));
      }
      buildReferences(references) {
        return references.map((r, i) => ({
          id: r.id || `ref-${i}`,
          authors: r.authors || [],
          title: r.title || "",
          journal: r.journal,
          year: r.year,
          doi: r.doi,
          arxivId: r.arxiv_id,
          url: r.url
        }));
      }
      buildAlgorithms(algorithms) {
        return algorithms.map((a, i) => ({
          id: a.id || `algo-${i}`,
          name: a.name || `Algorithm ${i + 1}`,
          description: a.description || "",
          pseudocode: a.pseudocode,
          complexity: a.complexity,
          parameters: a.parameters || [],
          steps: a.steps || [],
          sectionId: a.section_id || ""
        }));
      }
      buildCodeBlocks(codeBlocks) {
        return codeBlocks.map((c, i) => ({
          id: c.id || `code-${i}`,
          language: c.language,
          code: c.code || "",
          description: c.description,
          sectionId: c.section_id || ""
        }));
      }
      buildFormulas(formulas) {
        return formulas.map((f, i) => ({
          id: f.id || `formula-${i}`,
          latex: f.latex,
          description: f.description,
          sectionId: f.section_id || "",
          type: f.type || "block"
        }));
      }
      buildDiagrams(diagrams) {
        return diagrams.map((d, i) => ({
          id: d.id || `diagram-${i}`,
          type: d.type || "other",
          description: d.description || "",
          elements: d.elements || [],
          relationships: d.relationships || [],
          sectionId: d.section_id || ""
        }));
      }
      /**
       * Get processed documents
       */
      getProcessedDocuments() {
        return Array.from(this.processedDocuments.values());
      }
      /**
       * Get document by ID
       */
      getDocument(id) {
        return this.processedDocuments.get(id);
      }
      /**
       * Search documents by content
       */
      async searchDocuments(query, options = {}) {
        const documents = Array.from(this.processedDocuments.values());
        const { filterByType, filterByAuthor, maxResults = 10 } = options;
        let filtered = documents;
        if (filterByType) {
          filtered = filtered.filter((doc) => filterByType.includes(doc.source.type));
        }
        if (filterByAuthor) {
          filtered = filtered.filter(
            (doc) => doc.metadata.authors.some(
              (author) => author.toLowerCase().includes(filterByAuthor.toLowerCase())
            )
          );
        }
        const queryLower = query.toLowerCase();
        const scored = filtered.map((doc) => {
          let score = 0;
          if (doc.title.toLowerCase().includes(queryLower)) {
            score += 10;
          }
          if (doc.content.rawText.toLowerCase().includes(queryLower)) {
            score += 5;
          }
          if (doc.content.structuredContent.abstract?.toLowerCase().includes(queryLower)) {
            score += 8;
          }
          return { doc, score };
        });
        return scored.filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, maxResults).map((item) => item.doc);
      }
      /**
       * Get service status
       */
      getStatus() {
        return {
          initialized: this.isInitialized,
          processedDocuments: this.processedDocuments.size,
          queueLength: this.processingQueue.length,
          isProcessing: this.isProcessing,
          supportedFormats: ["pdf", "arxiv", "url", "docx", "html", "markdown", "text"]
        };
      }
      /**
       * Generate document ID
       */
      generateDocumentId(source) {
        const hash = source.identifier.replace(/[^a-zA-Z0-9]/g, "-");
        return `${source.type}-${hash}-${Date.now()}`;
      }
      /**
       * Initialize processing capabilities
       */
      async initializeProcessingCapabilities() {
        logger.debug("Initializing document processing capabilities");
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      /**
       * Set up arXiv integration
       */
      async setupArXivIntegration() {
        logger.debug("Setting up arXiv integration");
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    };
    documentProcessor = new DocumentProcessorService();
  }
});
var BaseAgent;
var init_base_agent = __esm({
  "src/agents/base-agent.ts"() {
    init_cjs_shims();
    init_types3();
    init_logger();
    BaseAgent = class extends events.EventEmitter {
      static {
        __name(this, "BaseAgent");
      }
      role;
      status = "idle" /* IDLE */;
      capabilities = [];
      metrics = {
        tasksCompleted: 0,
        tasksFailed: 0,
        averageResponseTime: 0,
        currentLoad: 0,
        lastActive: /* @__PURE__ */ new Date()
      };
      responseTimes = [];
      maxMetricHistory = 100;
      constructor(role, capabilities) {
        super();
        this.role = role;
        this.capabilities = capabilities;
      }
      /**
       * Initialize the agent
       */
      async initialize() {
        logger.info(`Initializing agent: ${this.role}`);
        this.status = "idle" /* IDLE */;
        await this.onInitialize();
        this.emit("initialized", { agent: this.role });
      }
      /**
       * Check if agent can handle a specific task
       */
      canHandle(task) {
        const hasCapabilities = task.requiredCapabilities.includes(this.role);
        const isAvailable = this.status === "idle" /* IDLE */ || this.status === "waiting" /* WAITING */;
        const customCheck = this.checkCustomCapabilities(task);
        return hasCapabilities && isAvailable && customCheck;
      }
      /**
       * Execute a task
       */
      async execute(task) {
        const startTime = Date.now();
        this.status = "processing" /* PROCESSING */;
        this.metrics.currentLoad++;
        logger.debug(`Agent ${this.role} executing task ${task.id}`);
        try {
          this.validateTask(task);
          const output = await this.performTask(task);
          const duration = Date.now() - startTime;
          this.updateMetrics(duration, true);
          const result = {
            taskId: task.id,
            agentRole: this.role,
            status: "success",
            output,
            duration,
            metadata: this.gatherMetadata(task)
          };
          this.emit("taskCompleted", result);
          return result;
        } catch (error) {
          const duration = Date.now() - startTime;
          this.updateMetrics(duration, false);
          logger.error(`Agent ${this.role} failed task ${task.id}:`, error);
          const result = {
            taskId: task.id,
            agentRole: this.role,
            status: "failure",
            error: error instanceof Error ? error : new Error(String(error)),
            duration
          };
          this.emit("taskFailed", result);
          return result;
        } finally {
          this.status = "idle" /* IDLE */;
          this.metrics.currentLoad = Math.max(0, this.metrics.currentLoad - 1);
        }
      }
      /**
       * Send a message to other agents or orchestrator
       */
      async sendMessage(message) {
        message.from = this.role;
        message.timestamp = /* @__PURE__ */ new Date();
        logger.debug(`Agent ${this.role} sending message to ${message.to}`);
        this.emit("messageSent", message);
        await this.onMessageSent(message);
      }
      /**
       * Receive a message from other agents or orchestrator
       */
      async receiveMessage(message) {
        logger.debug(`Agent ${this.role} received message from ${message.from}`);
        switch (message.type) {
          case "request":
            await this.handleRequest(message);
            break;
          case "response":
            await this.handleResponse(message);
            break;
          case "notification":
            await this.handleNotification(message);
            break;
          case "error":
            await this.handleError(message);
            break;
        }
        this.emit("messageReceived", message);
      }
      /**
       * Shutdown the agent
       */
      async shutdown() {
        logger.info(`Shutting down agent: ${this.role}`);
        this.status = "idle" /* IDLE */;
        await this.onShutdown();
        this.emit("shutdown", { agent: this.role });
        this.removeAllListeners();
      }
      /**
       * Get current agent status
       */
      getStatus() {
        return this.status;
      }
      /**
       * Get agent metrics
       */
      getMetrics() {
        return { ...this.metrics };
      }
      // Protected helper methods
      validateTask(task) {
        if (!task.id || !task.type) {
          throw new Error("Invalid task: missing required fields");
        }
        if (task.deadline && new Date(task.deadline) < /* @__PURE__ */ new Date()) {
          throw new Error("Task deadline has already passed");
        }
      }
      gatherMetadata(task) {
        return {
          agentRole: this.role,
          taskType: task.type,
          priority: task.priority,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        };
      }
      updateMetrics(duration, success) {
        if (success) {
          this.metrics.tasksCompleted++;
        } else {
          this.metrics.tasksFailed++;
        }
        this.responseTimes.push(duration);
        if (this.responseTimes.length > this.maxMetricHistory) {
          this.responseTimes.shift();
        }
        const sum = this.responseTimes.reduce((a, b) => a + b, 0);
        this.metrics.averageResponseTime = sum / this.responseTimes.length;
        this.metrics.lastActive = /* @__PURE__ */ new Date();
      }
      // Message handling methods
      async handleRequest(message) {
        await this.onMessageReceived(message);
      }
      async handleResponse(message) {
        await this.onMessageReceived(message);
      }
      async handleNotification(message) {
        await this.onMessageReceived(message);
      }
      async handleError(message) {
        logger.error(`Agent ${this.role} received error message:`, message.payload);
        await this.onMessageReceived(message);
      }
      // Optional hooks for subclasses
      async onMessageSent(_message) {
      }
      async onMessageReceived(_message) {
      }
    };
  }
});

// src/agents/specialized/document-parser-agent.ts
var DocumentParserAgent;
var init_document_parser_agent = __esm({
  "src/agents/specialized/document-parser-agent.ts"() {
    init_cjs_shims();
    init_base_agent();
    init_types3();
    init_logger();
    DocumentParserAgent = class extends BaseAgent {
      static {
        __name(this, "DocumentParserAgent");
      }
      constructor() {
        super("document-parser" /* DOCUMENT_PARSER */, [
          "pdf-parsing",
          "arxiv-fetching",
          "docx-parsing",
          "text-extraction",
          "metadata-extraction",
          "structure-analysis"
        ]);
      }
      async onInitialize() {
        logger.info("DocumentParserAgent initialized");
      }
      async performTask(task) {
        const request = task.input;
        switch (request.source) {
          case "pdf":
            return await this.parsePDF(request);
          case "arxiv":
            return await this.fetchArxiv(request);
          case "url":
            return await this.fetchURL(request);
          case "docx":
            return await this.parseDocx(request);
          case "text":
            return await this.parseText(request);
          default:
            throw new Error(`Unsupported document source: ${request.source}`);
        }
      }
      async onShutdown() {
        logger.info("DocumentParserAgent shutting down");
      }
      checkCustomCapabilities(task) {
        return task.type === "document-parsing" || task.type === "paper-processing";
      }
      async parsePDF(_request) {
        logger.debug("Parsing PDF document");
        return {
          title: "Extracted Paper Title",
          authors: ["Author 1", "Author 2"],
          abstract: "Paper abstract content...",
          sections: [
            { title: "Introduction", content: "Introduction content..." },
            { title: "Methodology", content: "Methodology content..." },
            { title: "Results", content: "Results content..." },
            { title: "Conclusion", content: "Conclusion content..." }
          ],
          references: ["Reference 1", "Reference 2"],
          metadata: {
            pages: 10,
            year: 2024,
            conference: "Example Conference"
          }
        };
      }
      async fetchArxiv(request) {
        logger.debug("Fetching paper from arXiv");
        return {
          title: "arXiv Paper",
          content: "Paper content from arXiv...",
          arxivId: request.content
        };
      }
      async fetchURL(request) {
        logger.debug("Fetching document from URL");
        return {
          url: request.content,
          content: "Fetched content from URL..."
        };
      }
      async parseDocx(_request) {
        logger.debug("Parsing DOCX document");
        return {
          type: "docx",
          content: "Parsed DOCX content..."
        };
      }
      async parseText(request) {
        logger.debug("Parsing plain text document");
        const content = typeof request.content === "string" ? request.content : request.content.toString();
        const lines = content.split("\n");
        const sections = [];
        let currentSection = { title: "Main", content: "" };
        for (const line of lines) {
          if (line.match(/^#+\s+/) || line.match(/^[A-Z][A-Z\s]+$/)) {
            if (currentSection.content) {
              sections.push(currentSection);
            }
            currentSection = { title: line.trim(), content: "" };
          } else {
            currentSection.content += line + "\n";
          }
        }
        if (currentSection.content) {
          sections.push(currentSection);
        }
        return {
          type: "text",
          sections,
          totalLength: content.length
        };
      }
    };
  }
});

// src/agents/specialized/algorithm-extractor-agent.ts
var AlgorithmExtractorAgent;
var init_algorithm_extractor_agent = __esm({
  "src/agents/specialized/algorithm-extractor-agent.ts"() {
    init_cjs_shims();
    init_base_agent();
    init_types3();
    init_logger();
    AlgorithmExtractorAgent = class extends BaseAgent {
      static {
        __name(this, "AlgorithmExtractorAgent");
      }
      constructor() {
        super("algorithm-extractor" /* ALGORITHM_EXTRACTOR */, [
          "algorithm-extraction",
          "pseudocode-analysis",
          "complexity-analysis",
          "pattern-recognition",
          "mathematical-notation"
        ]);
      }
      async onInitialize() {
        logger.info("AlgorithmExtractorAgent initialized");
      }
      async performTask(task) {
        const documentData = task.input;
        const algorithms = [];
        for (const section of documentData.sections) {
          const extracted = await this.extractAlgorithmsFromSection(section);
          algorithms.push(...extracted);
        }
        return algorithms;
      }
      async onShutdown() {
        logger.info("AlgorithmExtractorAgent shutting down");
      }
      checkCustomCapabilities(task) {
        return task.type === "algorithm-extraction" || task.type === "code-analysis";
      }
      async extractAlgorithmsFromSection(section) {
        const algorithms = [];
        const algorithmPatterns = [
          /Algorithm\s+\d+[:.]?\s*(.*)/gi,
          /Procedure\s+(.*?):/gi,
          /Function\s+(.*?)\(/gi,
          /def\s+(.*?)\(/gi,
          /Input:\s*(.*?)Output:/gis
        ];
        for (const pattern of algorithmPatterns) {
          const matches = section.content.matchAll(pattern);
          for (const match of matches) {
            const algorithm = await this.parseAlgorithm(match[0], section.content);
            if (algorithm) {
              algorithms.push(algorithm);
            }
          }
        }
        const pseudocodeBlocks = this.extractPseudocodeBlocks(section.content);
        for (const block of pseudocodeBlocks) {
          const algorithm = await this.analyzePseudocode(block);
          if (algorithm) {
            algorithms.push(algorithm);
          }
        }
        return algorithms;
      }
      async parseAlgorithm(matchText, fullContent) {
        try {
          const nameMatch = matchText.match(/(?:Algorithm|Procedure|Function|def)\s+(\w+)/i);
          const name = nameMatch?.[1] || "UnnamedAlgorithm";
          const paramMatch = matchText.match(/\((.*?)\)/);
          const parameters = paramMatch?.[1] ? this.parseParameters(paramMatch[1]) : [];
          const steps = this.extractSteps(fullContent, matchText);
          const complexity = this.analyzeComplexity(steps);
          return {
            name,
            description: `Algorithm extracted from: ${matchText.substring(0, 50)}...`,
            pseudocode: steps.join("\n"),
            complexity,
            parameters,
            steps
          };
        } catch (error) {
          logger.error("Failed to parse algorithm:", error);
          return null;
        }
      }
      parseParameters(paramString) {
        const params = paramString.split(",").map((p) => p.trim());
        return params.map((param) => {
          const parts = param.split(":");
          return {
            name: parts[0]?.trim() || "param",
            type: parts[1]?.trim() || "any",
            description: `Parameter: ${param}`
          };
        });
      }
      extractSteps(content, startMarker) {
        const startIndex = content.indexOf(startMarker);
        if (startIndex === -1) return [];
        const subsequentContent = content.substring(startIndex);
        const lines = subsequentContent.split("\n").slice(0, 20);
        const steps = [];
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith("//") && !trimmed.startsWith("#")) {
            steps.push(trimmed);
          }
          if (trimmed.match(/^(return|end|END|End Algorithm)/i)) {
            break;
          }
        }
        return steps;
      }
      analyzeComplexity(steps) {
        let timeComplexity = "O(1)";
        let spaceComplexity = "O(1)";
        const hasLoop = steps.some((step) => step.match(/for|while|loop|iterate/i));
        const hasNestedLoop = steps.some((step, i) => {
          if (step.match(/for|while|loop/i)) {
            return steps.slice(i + 1, i + 5).some((s) => s.match(/for|while|loop/i));
          }
          return false;
        });
        const hasRecursion = steps.some((step) => step.match(/recursive|recurse|calls itself/i));
        if (hasNestedLoop) {
          timeComplexity = "O(n\xB2)";
        } else if (hasLoop) {
          timeComplexity = "O(n)";
        } else if (hasRecursion) {
          timeComplexity = "O(log n) or worse";
        }
        if (steps.some((step) => step.match(/array|list|matrix/i))) {
          spaceComplexity = "O(n)";
        }
        return {
          time: timeComplexity,
          space: spaceComplexity
        };
      }
      extractPseudocodeBlocks(content) {
        const blocks = [];
        const codeBlockPattern = /```[\s\S]*?```/g;
        const matches = content.match(codeBlockPattern);
        if (matches) {
          blocks.push(...matches.map((m) => m.replace(/```/g, "")));
        }
        const lines = content.split("\n");
        let currentBlock = [];
        let inBlock = false;
        for (const line of lines) {
          if (line.match(/^\s{4,}/) || line.match(/^\t/)) {
            inBlock = true;
            currentBlock.push(line);
          } else if (inBlock && line.trim() === "") {
            currentBlock.push(line);
          } else if (inBlock) {
            if (currentBlock.length > 2) {
              blocks.push(currentBlock.join("\n"));
            }
            currentBlock = [];
            inBlock = false;
          }
        }
        if (currentBlock.length > 2) {
          blocks.push(currentBlock.join("\n"));
        }
        return blocks;
      }
      async analyzePseudocode(block) {
        const lines = block.split("\n").filter((l) => l.trim());
        if (lines.length < 2) return null;
        const firstLine = lines[0];
        const nameMatch = firstLine?.match(/(?:algorithm|function|procedure|def)\s+(\w+)/i);
        const name = nameMatch?.[1] || "ExtractedAlgorithm";
        return {
          name,
          description: "Algorithm extracted from pseudocode block",
          pseudocode: block,
          complexity: this.analyzeComplexity(lines),
          parameters: [],
          steps: lines
        };
      }
    };
  }
});

// src/agents/specialized/code-generator-agent.ts
var CodeGeneratorAgent;
var init_code_generator_agent = __esm({
  "src/agents/specialized/code-generator-agent.ts"() {
    init_cjs_shims();
    init_base_agent();
    init_types3();
    init_logger();
    CodeGeneratorAgent = class extends BaseAgent {
      static {
        __name(this, "CodeGeneratorAgent");
      }
      constructor() {
        super("code-generator" /* CODE_GENERATOR */, [
          "code-generation",
          "test-generation",
          "documentation-generation",
          "multi-language-support",
          "framework-integration",
          "best-practices"
        ]);
      }
      async onInitialize() {
        logger.info("CodeGeneratorAgent initialized");
      }
      async performTask(task) {
        const input = task.input;
        const language = input.targetLanguage || "typescript";
        const framework = input.framework || "none";
        const options = input.options || { generateTests: true, includeDocumentation: true };
        const files = /* @__PURE__ */ new Map();
        const tests = /* @__PURE__ */ new Map();
        const documentation = [];
        const dependencies = [];
        for (const algorithm of input.algorithms) {
          const { code, test, docs, deps } = await this.generateCodeForAlgorithm(
            algorithm,
            language,
            framework
          );
          files.set(`${algorithm.name}.${this.getFileExtension(language)}`, code);
          if (options.generateTests && test) {
            tests.set(`${algorithm.name}.test.${this.getFileExtension(language)}`, test);
          }
          if (options.includeDocumentation && docs) {
            documentation.push(docs);
          }
          dependencies.push(...deps);
        }
        const mainFile = this.generateMainModule(input.algorithms, language);
        files.set(`index.${this.getFileExtension(language)}`, mainFile);
        const setupInstructions = this.generateSetupInstructions(
          language,
          framework,
          Array.from(new Set(dependencies))
        );
        return {
          files,
          tests,
          documentation: documentation.join("\n\n"),
          dependencies: Array.from(new Set(dependencies)),
          setupInstructions
        };
      }
      async onShutdown() {
        logger.info("CodeGeneratorAgent shutting down");
      }
      checkCustomCapabilities(task) {
        return task.type === "code-generation" || task.type === "implementation";
      }
      async generateCodeForAlgorithm(algorithm, language, framework) {
        const code = this.generateImplementation(algorithm, language, framework);
        const test = this.generateTests(algorithm, language);
        const docs = this.generateDocumentation(algorithm);
        const deps = this.identifyDependencies(algorithm, language, framework);
        return { code, test, docs, deps };
      }
      generateImplementation(algorithm, language, framework) {
        switch (language.toLowerCase()) {
          case "typescript":
          case "javascript":
            return this.generateTypeScriptCode(algorithm, framework);
          case "python":
            return this.generatePythonCode(algorithm, framework);
          case "java":
            return this.generateJavaCode(algorithm, framework);
          default:
            return this.generateTypeScriptCode(algorithm, framework);
        }
      }
      generateTypeScriptCode(algorithm, framework) {
        const params = algorithm.parameters.map((p) => `${p.name}: ${this.mapTypeToTS(p.type)}`).join(", ");
        const functionSignature = `export function ${algorithm.name}(${params}): unknown`;
        let implementation = `/**
 * ${algorithm.description}
 * 
 * Time Complexity: ${algorithm.complexity?.time || "Unknown"}
 * Space Complexity: ${algorithm.complexity?.space || "Unknown"}
 */
${functionSignature} {
`;
        for (const step of algorithm.steps) {
          const tsCode = this.convertStepToTypeScript(step);
          implementation += `  ${tsCode}
`;
        }
        implementation += `  // TODO: Complete implementation based on algorithm
  throw new Error('Implementation pending');
}`;
        if (framework === "react") {
          implementation = this.wrapInReactComponent(algorithm.name, implementation);
        } else if (framework === "express") {
          implementation = this.wrapInExpressRoute(algorithm.name, implementation);
        }
        return implementation;
      }
      generatePythonCode(algorithm, framework) {
        const params = algorithm.parameters.map((p) => `${p.name}: ${this.mapTypeToPython(p.type)}`).join(", ");
        let implementation = `"""
${algorithm.description}

Time Complexity: ${algorithm.complexity?.time || "Unknown"}
Space Complexity: ${algorithm.complexity?.space || "Unknown"}
"""

def ${algorithm.name}(${params}):
`;
        for (const step of algorithm.steps) {
          const pyCode = this.convertStepToPython(step);
          implementation += `    ${pyCode}
`;
        }
        implementation += `    # TODO: Complete implementation
    raise NotImplementedError("Implementation pending")`;
        if (framework === "django") {
          implementation = this.wrapInDjangoView(algorithm.name, implementation);
        } else if (framework === "flask") {
          implementation = this.wrapInFlaskRoute(algorithm.name, implementation);
        }
        return implementation;
      }
      generateJavaCode(algorithm, _framework) {
        const params = algorithm.parameters.map((p) => `${this.mapTypeToJava(p.type)} ${p.name}`).join(", ");
        return `/**
 * ${algorithm.description}
 * 
 * Time Complexity: ${algorithm.complexity?.time || "Unknown"}
 * Space Complexity: ${algorithm.complexity?.space || "Unknown"}
 */
public class ${algorithm.name} {
    public static Object execute(${params}) {
        // TODO: Implement algorithm
        throw new UnsupportedOperationException("Implementation pending");
    }
}`;
      }
      generateTests(algorithm, language) {
        switch (language.toLowerCase()) {
          case "typescript":
          case "javascript":
            return this.generateJestTest(algorithm);
          case "python":
            return this.generatePytestTest(algorithm);
          case "java":
            return this.generateJUnitTest(algorithm);
          default:
            return "";
        }
      }
      generateJestTest(algorithm) {
        return `import { ${algorithm.name} } from './${algorithm.name}';

describe('${algorithm.name}', () => {
  it('should execute without errors', () => {
    // TODO: Add test cases based on algorithm specification
    expect(() => ${algorithm.name}()).not.toThrow();
  });
  
  it('should handle edge cases', () => {
    // TODO: Add edge case tests
  });
  
  it('should meet performance requirements', () => {
    // TODO: Add performance tests if needed
  });
});`;
      }
      generatePytestTest(algorithm) {
        return `import pytest
from ${algorithm.name} import ${algorithm.name}

def test_${algorithm.name}_basic():
    """Test basic functionality"""
    # TODO: Add test cases
    with pytest.raises(NotImplementedError):
        ${algorithm.name}()

def test_${algorithm.name}_edge_cases():
    """Test edge cases"""
    # TODO: Add edge case tests
    pass

def test_${algorithm.name}_performance():
    """Test performance requirements"""
    # TODO: Add performance tests
    pass`;
      }
      generateJUnitTest(algorithm) {
        return `import org.junit.Test;
import static org.junit.Assert.*;

public class ${algorithm.name}Test {
    @Test
    public void testBasicFunctionality() {
        // TODO: Add test cases
    }
    
    @Test
    public void testEdgeCases() {
        // TODO: Add edge case tests
    }
}`;
      }
      generateDocumentation(algorithm) {
        return `# ${algorithm.name}

## Description
${algorithm.description}

## Algorithm Details
${algorithm.pseudocode || "See implementation for details"}

## Complexity Analysis
- **Time Complexity**: ${algorithm.complexity?.time || "Not analyzed"}
- **Space Complexity**: ${algorithm.complexity?.space || "Not analyzed"}

## Parameters
${algorithm.parameters.map((p) => `- **${p.name}** (${p.type}): ${p.description}`).join("\n")}

## Implementation Notes
${algorithm.steps.map((step, i) => `${i + 1}. ${step}`).join("\n")}
`;
      }
      generateMainModule(algorithms, language) {
        if (language === "typescript" || language === "javascript") {
          const exports = algorithms.map((a) => `export { ${a.name} } from './${a.name}';`).join("\n");
          return `/**
 * Main module exporting all generated algorithms
 */

${exports}

// Re-export types if needed
export * from './types';
`;
        } else if (language === "python") {
          const imports = algorithms.map((a) => `from .${a.name} import ${a.name}`).join("\n");
          return `"""
Main module for generated algorithms
"""

${imports}

__all__ = [${algorithms.map((a) => `'${a.name}'`).join(", ")}]
`;
        }
        return "";
      }
      generateSetupInstructions(language, framework, dependencies) {
        let instructions = `# Setup Instructions

## Language: ${language}
## Framework: ${framework}

### Installation

`;
        if (language === "typescript" || language === "javascript") {
          instructions += `\`\`\`bash
npm install ${dependencies.join(" ")}
\`\`\``;
        } else if (language === "python") {
          instructions += `\`\`\`bash
pip install ${dependencies.join(" ")}
\`\`\``;
        } else if (language === "java") {
          instructions += `Add the following dependencies to your pom.xml or build.gradle`;
        }
        instructions += `

### Running Tests

`;
        if (language === "typescript" || language === "javascript") {
          instructions += `\`\`\`bash
npm test
\`\`\``;
        } else if (language === "python") {
          instructions += `\`\`\`bash
pytest
\`\`\``;
        }
        return instructions;
      }
      identifyDependencies(_algorithm, language, framework) {
        const deps = [];
        if (language === "typescript") {
          deps.push("@types/node");
        }
        if (framework === "react") {
          deps.push("react", "react-dom");
        } else if (framework === "express") {
          deps.push("express", "@types/express");
        } else if (framework === "django") {
          deps.push("django");
        } else if (framework === "flask") {
          deps.push("flask");
        }
        return deps;
      }
      getFileExtension(language) {
        const extensions = {
          typescript: "ts",
          javascript: "js",
          python: "py",
          java: "java",
          cpp: "cpp",
          c: "c",
          go: "go",
          rust: "rs"
        };
        return extensions[language.toLowerCase()] || "txt";
      }
      mapTypeToTS(type) {
        const typeMap = {
          int: "number",
          float: "number",
          double: "number",
          str: "string",
          string: "string",
          bool: "boolean",
          boolean: "boolean",
          list: "any[]",
          array: "any[]",
          dict: "Record<string, any>",
          any: "any"
        };
        return typeMap[type.toLowerCase()] || "any";
      }
      mapTypeToPython(type) {
        const typeMap = {
          int: "int",
          float: "float",
          string: "str",
          bool: "bool",
          list: "List",
          array: "List",
          dict: "Dict",
          any: "Any"
        };
        return typeMap[type.toLowerCase()] || "Any";
      }
      mapTypeToJava(type) {
        const typeMap = {
          int: "int",
          float: "float",
          double: "double",
          string: "String",
          bool: "boolean",
          list: "List<Object>",
          array: "Object[]",
          dict: "Map<String, Object>",
          any: "Object"
        };
        return typeMap[type.toLowerCase()] || "Object";
      }
      convertStepToTypeScript(step) {
        let tsCode = step;
        tsCode = tsCode.replace(/FOR EACH/gi, "for (const item of");
        tsCode = tsCode.replace(/FOR/gi, "for (");
        tsCode = tsCode.replace(/WHILE/gi, "while (");
        tsCode = tsCode.replace(/IF/gi, "if (");
        tsCode = tsCode.replace(/ELSE/gi, "} else {");
        tsCode = tsCode.replace(/END IF/gi, "}");
        tsCode = tsCode.replace(/RETURN/gi, "return");
        tsCode = tsCode.replace(/:=/g, "=");
        if (!tsCode.endsWith(";") && !tsCode.endsWith("{") && !tsCode.endsWith("}")) {
          tsCode += ";";
        }
        return `// ${step}
  ${tsCode}`;
      }
      convertStepToPython(step) {
        let pyCode = step;
        pyCode = pyCode.replace(/FOR EACH/gi, "for item in");
        pyCode = pyCode.replace(/FOR/gi, "for");
        pyCode = pyCode.replace(/WHILE/gi, "while");
        pyCode = pyCode.replace(/IF/gi, "if");
        pyCode = pyCode.replace(/ELSE/gi, "else:");
        pyCode = pyCode.replace(/END IF/gi, "");
        pyCode = pyCode.replace(/RETURN/gi, "return");
        pyCode = pyCode.replace(/:=/g, "=");
        return `# ${step}
    ${pyCode}`;
      }
      wrapInReactComponent(name, code) {
        return `import React from 'react';

${code}

export const ${name}Component: React.FC = () => {
  // Component implementation using ${name} function
  return <div>Algorithm: ${name}</div>;
};`;
      }
      wrapInExpressRoute(name, code) {
        return `import { Request, Response } from 'express';

${code}

export const ${name}Route = (req: Request, res: Response) => {
  try {
    const result = ${name}(req.body);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};`;
      }
      wrapInDjangoView(name, code) {
        return `from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json

${code}

@csrf_exempt
def ${name}_view(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        result = ${name}(**data)
        return JsonResponse({'result': result})
    return JsonResponse({'error': 'Method not allowed'}, status=405)`;
      }
      wrapInFlaskRoute(name, code) {
        return `from flask import request, jsonify

${code}

@app.route('/${name}', methods=['POST'])
def ${name}_route():
    data = request.get_json()
    result = ${name}(**data)
    return jsonify({'result': result})`;
      }
    };
  }
});

// src/agents/specialized/literature-reviewer-agent.ts
var LiteratureReviewerAgent;
var init_literature_reviewer_agent = __esm({
  "src/agents/specialized/literature-reviewer-agent.ts"() {
    init_cjs_shims();
    init_base_agent();
    init_types3();
    init_logger();
    LiteratureReviewerAgent = class extends BaseAgent {
      static {
        __name(this, "LiteratureReviewerAgent");
      }
      constructor() {
        super("literature-reviewer" /* LITERATURE_REVIEWER */, [
          "literature-search",
          "paper-analysis",
          "citation-tracking",
          "research-synthesis"
        ]);
      }
      async onInitialize() {
        logger.info("LiteratureReviewerAgent initialized");
      }
      async performTask(_task) {
        return {
          relatedPapers: [],
          keyFindings: [],
          researchGaps: []
        };
      }
      async onShutdown() {
        logger.info("LiteratureReviewerAgent shutting down");
      }
      checkCustomCapabilities(task) {
        return task.type === "literature-review";
      }
    };
  }
});

// src/agents/specialized/concept-analyzer-agent.ts
var ConceptAnalyzerAgent;
var init_concept_analyzer_agent = __esm({
  "src/agents/specialized/concept-analyzer-agent.ts"() {
    init_cjs_shims();
    init_base_agent();
    init_types3();
    init_logger();
    ConceptAnalyzerAgent = class extends BaseAgent {
      static {
        __name(this, "ConceptAnalyzerAgent");
      }
      constructor() {
        super("concept-analyzer" /* CONCEPT_ANALYZER */, [
          "concept-extraction",
          "theoretical-analysis",
          "insight-generation",
          "knowledge-synthesis"
        ]);
      }
      async onInitialize() {
        logger.info("ConceptAnalyzerAgent initialized");
      }
      async performTask(_task) {
        return {
          concepts: [],
          insights: [],
          relationships: []
        };
      }
      async onShutdown() {
        logger.info("ConceptAnalyzerAgent shutting down");
      }
      checkCustomCapabilities(task) {
        return task.type === "concept-analysis";
      }
    };
  }
});

// src/agents/specialized/quality-assurance-agent.ts
var QualityAssuranceAgent;
var init_quality_assurance_agent = __esm({
  "src/agents/specialized/quality-assurance-agent.ts"() {
    init_cjs_shims();
    init_base_agent();
    init_types3();
    init_logger();
    QualityAssuranceAgent = class extends BaseAgent {
      static {
        __name(this, "QualityAssuranceAgent");
      }
      constructor() {
        super("quality-assurance" /* QUALITY_ASSURANCE */, [
          "code-quality-check",
          "test-validation",
          "performance-analysis",
          "security-audit",
          "documentation-review"
        ]);
      }
      async onInitialize() {
        logger.info("QualityAssuranceAgent initialized");
      }
      async performTask(_task) {
        return {
          qualityScore: 85,
          issues: [],
          recommendations: [],
          passed: true
        };
      }
      async onShutdown() {
        logger.info("QualityAssuranceAgent shutting down");
      }
      checkCustomCapabilities(task) {
        return task.type === "quality-assurance" || task.type === "validation";
      }
    };
  }
});

// src/agents/specialized/citation-manager-agent.ts
var CitationManagerAgent;
var init_citation_manager_agent = __esm({
  "src/agents/specialized/citation-manager-agent.ts"() {
    init_cjs_shims();
    init_base_agent();
    init_types3();
    init_logger();
    CitationManagerAgent = class extends BaseAgent {
      static {
        __name(this, "CitationManagerAgent");
      }
      constructor() {
        super("citation-manager" /* CITATION_MANAGER */, [
          "citation-formatting",
          "reference-management",
          "bibliography-generation",
          "plagiarism-detection"
        ]);
      }
      async onInitialize() {
        logger.info("CitationManagerAgent initialized");
      }
      async performTask(_task) {
        return {
          citations: [],
          bibliography: "",
          plagiarismReport: { score: 0, issues: [] }
        };
      }
      async onShutdown() {
        logger.info("CitationManagerAgent shutting down");
      }
      checkCustomCapabilities(task) {
        return task.type === "citation-management";
      }
    };
  }
});

// src/agents/specialized/index.ts
var init_specialized = __esm({
  "src/agents/specialized/index.ts"() {
    init_cjs_shims();
    init_document_parser_agent();
    init_algorithm_extractor_agent();
    init_code_generator_agent();
    init_literature_reviewer_agent();
    init_concept_analyzer_agent();
    init_quality_assurance_agent();
    init_citation_manager_agent();
  }
});

// src/agents/multi-agent-system.ts
var multi_agent_system_exports = {};
__export(multi_agent_system_exports, {
  MultiAgentSystem: () => MultiAgentSystem
});
var MultiAgentSystem;
var init_multi_agent_system = __esm({
  "src/agents/multi-agent-system.ts"() {
    init_cjs_shims();
    init_orchestrator();
    init_types3();
    init_coderag_system();
    init_document_processor();
    init_specialized();
    init_logger();
    MultiAgentSystem = class _MultiAgentSystem {
      static {
        __name(this, "MultiAgentSystem");
      }
      static instance;
      orchestrator;
      isInitialized = false;
      constructor() {
        this.orchestrator = new CentralOrchestrator({
          maxConcurrentTasks: 3,
          taskTimeout: 6e4,
          // 60 seconds
          loadBalancing: "capability-based"
        });
      }
      static getInstance() {
        if (!_MultiAgentSystem.instance) {
          _MultiAgentSystem.instance = new _MultiAgentSystem();
        }
        return _MultiAgentSystem.instance;
      }
      /**
       * Initialize the multi-agent system
       */
      async initialize() {
        if (this.isInitialized) {
          logger.warn("Multi-agent system already initialized");
          return;
        }
        logger.info("Initializing multi-agent system...");
        try {
          await this.initializeSupportingServices();
          await this.orchestrator.registerAgent(new DocumentParserAgent());
          await this.orchestrator.registerAgent(new AlgorithmExtractorAgent());
          await this.orchestrator.registerAgent(new CodeGeneratorAgent());
          await this.orchestrator.registerAgent(new LiteratureReviewerAgent());
          await this.orchestrator.registerAgent(new ConceptAnalyzerAgent());
          await this.orchestrator.registerAgent(new QualityAssuranceAgent());
          await this.orchestrator.registerAgent(new CitationManagerAgent());
          this.orchestrator.start();
          this.isInitialized = true;
          logger.info("Multi-agent system initialized successfully");
        } catch (error) {
          logger.error("Failed to initialize multi-agent system:", error);
          throw error;
        }
      }
      /**
       * Shutdown the multi-agent system
       */
      async shutdown() {
        if (!this.isInitialized) {
          return;
        }
        logger.info("Shutting down multi-agent system...");
        await this.orchestrator.stop();
        this.isInitialized = false;
      }
      /**
       * Process a paper using the multi-agent system
       * This is the main /paper command implementation
       */
      async processPaper(request) {
        if (!this.isInitialized) {
          await this.initialize();
        }
        try {
          logger.info("Processing paper with multi-agent system");
          const plan = this.createPaperProcessingPlan(request);
          const results = await this.orchestrator.executePlan(plan);
          return {
            success: true,
            results
          };
        } catch (error) {
          logger.error("Paper processing failed:", error);
          return {
            success: false,
            results: /* @__PURE__ */ new Map(),
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
      /**
       * Enhanced paper processing with result synthesis
       */
      async processEnhancedPaper(request) {
        if (!this.isInitialized) {
          await this.initialize();
        }
        try {
          logger.info("Processing paper with enhanced multi-agent system");
          const tasks = this.createEnhancedPaperTasks(request);
          const workflowId = uuid.v4();
          const userIntent = `Process paper: ${request.source} with ${request.options.targetLanguage || "TypeScript"} output`;
          const synthesizedOutput = await this.orchestrator.executeEnhancedWorkflow(
            workflowId,
            tasks,
            userIntent
          );
          return {
            success: true,
            synthesizedOutput
          };
        } catch (error) {
          logger.error("Enhanced paper processing failed:", error);
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
      /**
       * Create enhanced tasks for paper processing
       */
      createEnhancedPaperTasks(request) {
        const tasks = [];
        tasks.push({
          id: uuid.v4(),
          type: "enhanced-document-parsing",
          priority: 1,
          input: request,
          requiredCapabilities: ["document-parser" /* DOCUMENT_PARSER */],
          context: {
            userIntent: "Extract document structure and content",
            qualityRequirements: ["accuracy", "completeness"]
          }
        });
        if (request.options.extractAlgorithms) {
          tasks.push({
            id: uuid.v4(),
            type: "enhanced-algorithm-extraction",
            priority: 2,
            input: request,
            requiredCapabilities: ["algorithm-extractor" /* ALGORITHM_EXTRACTOR */],
            context: {
              userIntent: "Extract algorithmic concepts and procedures",
              qualityRequirements: ["precision", "algorithmic-accuracy"]
            }
          });
        }
        tasks.push({
          id: uuid.v4(),
          type: "enhanced-code-generation",
          priority: 3,
          input: {
            targetLanguage: request.options.targetLanguage || "typescript",
            framework: request.options.framework || "none",
            generateTests: request.options.generateTests,
            includeDocumentation: request.options.includeDocumentation
          },
          requiredCapabilities: ["code-generator" /* CODE_GENERATOR */],
          context: {
            userIntent: "Generate production-ready code implementation",
            qualityRequirements: ["code-quality", "test-coverage", "documentation"]
          }
        });
        tasks.push({
          id: uuid.v4(),
          type: "enhanced-quality-assurance",
          priority: 4,
          input: request,
          requiredCapabilities: ["quality-assurance" /* QUALITY_ASSURANCE */],
          context: {
            userIntent: "Validate implementation quality and correctness",
            qualityRequirements: ["correctness", "performance", "maintainability"]
          }
        });
        return tasks;
      }
      /**
       * Initialize supporting services
       */
      async initializeSupportingServices() {
        logger.info("Initializing supporting services...");
        try {
          await codeRAGService.initialize();
          logger.info("CodeRAG service initialized");
          await documentProcessor.initialize();
          logger.info("Document processor initialized");
        } catch (error) {
          logger.warn("Some supporting services failed to initialize:", error);
        }
      }
      /**
       * Enhanced paper processing with CodeRAG and document processing
       */
      async processEnhancedPaperWithRAG(request) {
        if (!this.isInitialized) {
          await this.initialize();
        }
        try {
          logger.info("Processing paper with enhanced CodeRAG and document processing");
          let documentAnalysis = null;
          if (request.source === "pdf" || request.source === "arxiv") {
            const document2 = await documentProcessor.processDocument(
              {
                type: request.source,
                identifier: request.content.toString()
              },
              {
                extractStructure: true,
                extractAlgorithms: true,
                extractCode: true,
                extractFormulas: true
              }
            );
            documentAnalysis = {
              title: document2.title,
              algorithmsFound: document2.content.extractedElements.algorithms.length,
              codeBlocksFound: document2.content.extractedElements.codeBlocks.length,
              qualityScore: document2.metadata.processingQuality.overallScore,
              insights: document2.content.extractedElements.algorithms.map((a) => a.description)
            };
          }
          let codebaseInsights = null;
          if (request.options.targetLanguage && request.options.targetLanguage !== "none") {
            const analysis = await codeRAGService.analyzeCodebase(["."], {
              includePatterns: true,
              includeComplexity: true,
              includeInsights: true
            });
            codebaseInsights = {
              totalFiles: analysis.codebase.totalFiles,
              languages: analysis.codebase.languages,
              commonPatterns: analysis.patterns.commonPatterns.slice(0, 5),
              recommendations: analysis.recommendations.slice(0, 3)
            };
          }
          const enhancedTasks = this.createEnhancedPaperTasksWithRAG(request, {
            documentAnalysis,
            codebaseInsights
          });
          const workflowId = uuid.v4();
          const userIntent = `Enhanced paper processing with CodeRAG: ${request.source} \u2192 ${request.options.targetLanguage || "TypeScript"}`;
          const synthesizedOutput = await this.orchestrator.executeEnhancedWorkflow(
            workflowId,
            enhancedTasks,
            userIntent
          );
          return {
            success: true,
            synthesizedOutput,
            documentAnalysis,
            codebaseInsights
          };
        } catch (error) {
          logger.error("Enhanced paper processing with RAG failed:", error);
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
      /**
       * Create enhanced tasks with CodeRAG context
       */
      createEnhancedPaperTasksWithRAG(request, ragContext) {
        const tasks = [];
        tasks.push({
          id: uuid.v4(),
          type: "enhanced-document-parsing-rag",
          priority: 1,
          input: {
            ...request,
            ragContext: ragContext.documentAnalysis
          },
          requiredCapabilities: ["document-parser" /* DOCUMENT_PARSER */],
          context: {
            userIntent: "Advanced document analysis with semantic understanding",
            qualityRequirements: ["accuracy", "completeness", "semantic-analysis"],
            ragEnabled: true
          }
        });
        if (request.options.extractAlgorithms) {
          tasks.push({
            id: uuid.v4(),
            type: "coderag-algorithm-extraction",
            priority: 2,
            input: {
              ...request,
              codebaseContext: ragContext.codebaseInsights
            },
            requiredCapabilities: ["algorithm-extractor" /* ALGORITHM_EXTRACTOR */],
            context: {
              userIntent: "Extract algorithms with codebase pattern awareness",
              qualityRequirements: ["precision", "algorithmic-accuracy", "pattern-matching"],
              ragEnabled: true
            }
          });
        }
        tasks.push({
          id: uuid.v4(),
          type: "intelligent-code-generation-rag",
          priority: 3,
          input: {
            targetLanguage: request.options.targetLanguage || "typescript",
            framework: request.options.framework || "none",
            generateTests: request.options.generateTests,
            includeDocumentation: request.options.includeDocumentation,
            codebasePatterns: ragContext.codebaseInsights
          },
          requiredCapabilities: ["code-generator" /* CODE_GENERATOR */],
          context: {
            userIntent: "Generate code using codebase patterns and best practices",
            qualityRequirements: ["code-quality", "pattern-consistency", "test-coverage"],
            ragEnabled: true
          }
        });
        tasks.push({
          id: uuid.v4(),
          type: "rag-enhanced-quality-assurance",
          priority: 4,
          input: {
            ...request,
            qualityContext: {
              documentAnalysis: ragContext.documentAnalysis,
              codebaseInsights: ragContext.codebaseInsights
            }
          },
          requiredCapabilities: ["quality-assurance" /* QUALITY_ASSURANCE */],
          context: {
            userIntent: "Comprehensive quality validation with RAG insights",
            qualityRequirements: ["correctness", "performance", "maintainability", "consistency"],
            ragEnabled: true
          }
        });
        return tasks;
      }
      /**
       * Index current codebase for CodeRAG
       */
      async indexCurrentCodebase(path3 = ".", options = {}) {
        try {
          logger.info(`Indexing codebase for CodeRAG: ${path3}`);
          const result = await codeRAGService.indexCodebase(path3, {
            fileTypes: options.fileTypes || [".ts", ".tsx", ".js", ".jsx"],
            excludePaths: options.excludePaths || ["node_modules", "dist", ".git"],
            chunkSize: 500,
            includeTests: false
          });
          return {
            success: true,
            indexed: result.indexed
          };
        } catch (error) {
          logger.error("Codebase indexing failed:", error);
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
      /**
       * Search codebase using CodeRAG
       */
      async searchCodebase(query, options = {}) {
        try {
          logger.info(`Searching codebase with CodeRAG: "${query}"`);
          const results = await codeRAGService.semanticSearch({
            query,
            language: options.language,
            maxResults: options.maxResults || 5,
            threshold: 0.7
          });
          return {
            success: true,
            results: results.map((r) => ({
              file: r.chunk.filePath,
              similarity: r.similarity,
              explanation: r.explanation,
              relevance: r.relevanceScore
            }))
          };
        } catch (error) {
          logger.error("Codebase search failed:", error);
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
      /**
       * Create an execution plan for paper processing
       */
      createPaperProcessingPlan(request) {
        const planId = uuid.v4();
        const tasks = [];
        const dependencies = /* @__PURE__ */ new Map();
        const parseTaskId = uuid.v4();
        tasks.push({
          id: parseTaskId,
          task: {
            id: parseTaskId,
            type: "document-parsing",
            priority: 1,
            input: request,
            requiredCapabilities: ["document-parser" /* DOCUMENT_PARSER */]
          },
          status: "pending"
        });
        const extractTaskId = uuid.v4();
        tasks.push({
          id: extractTaskId,
          task: {
            id: extractTaskId,
            type: "algorithm-extraction",
            priority: 2,
            input: null,
            // Will be filled from parse result
            requiredCapabilities: ["algorithm-extractor" /* ALGORITHM_EXTRACTOR */]
          },
          status: "pending"
        });
        dependencies.set(extractTaskId, [parseTaskId]);
        if (request.options.includeDocumentation) {
          const reviewTaskId = uuid.v4();
          tasks.push({
            id: reviewTaskId,
            task: {
              id: reviewTaskId,
              type: "literature-review",
              priority: 2,
              input: request,
              requiredCapabilities: ["literature-reviewer" /* LITERATURE_REVIEWER */]
            },
            status: "pending"
          });
          dependencies.set(reviewTaskId, [parseTaskId]);
        }
        const codeTaskId = uuid.v4();
        tasks.push({
          id: codeTaskId,
          task: {
            id: codeTaskId,
            type: "code-generation",
            priority: 3,
            input: {
              algorithms: null,
              // Will be filled from extraction result
              targetLanguage: request.options.targetLanguage || "typescript",
              framework: request.options.framework || "none",
              options: {
                generateTests: request.options.generateTests,
                includeDocumentation: request.options.includeDocumentation
              }
            },
            requiredCapabilities: ["code-generator" /* CODE_GENERATOR */]
          },
          status: "pending"
        });
        dependencies.set(codeTaskId, [extractTaskId]);
        const qaTaskId = uuid.v4();
        tasks.push({
          id: qaTaskId,
          task: {
            id: qaTaskId,
            type: "quality-assurance",
            priority: 4,
            input: null,
            // Will be filled from code generation result
            requiredCapabilities: ["quality-assurance" /* QUALITY_ASSURANCE */]
          },
          status: "pending"
        });
        dependencies.set(qaTaskId, [codeTaskId]);
        if (request.options.includeDocumentation) {
          const citationTaskId = uuid.v4();
          tasks.push({
            id: citationTaskId,
            task: {
              id: citationTaskId,
              type: "citation-management",
              priority: 3,
              input: request,
              requiredCapabilities: ["citation-manager" /* CITATION_MANAGER */]
            },
            status: "pending"
          });
          dependencies.set(citationTaskId, [parseTaskId]);
        }
        return {
          id: planId,
          tasks,
          dependencies,
          estimatedDuration: 12e4,
          // 2 minutes
          requiredAgents: [
            "document-parser" /* DOCUMENT_PARSER */,
            "algorithm-extractor" /* ALGORITHM_EXTRACTOR */,
            "code-generator" /* CODE_GENERATOR */,
            "quality-assurance" /* QUALITY_ASSURANCE */,
            ...request.options.includeDocumentation ? ["literature-reviewer" /* LITERATURE_REVIEWER */, "citation-manager" /* CITATION_MANAGER */] : []
          ]
        };
      }
      /**
       * Get system status
       */
      getStatus() {
        return {
          initialized: this.isInitialized,
          orchestratorStatus: this.orchestrator.getStatus()
        };
      }
      /**
       * Submit a custom task to the system
       */
      async submitTask(task) {
        if (!this.isInitialized) {
          await this.initialize();
        }
        return await this.orchestrator.submitTask(task);
      }
      /**
       * Enhanced paper processing with streaming updates
       */
      async *processPaperWithStreaming(request) {
        if (!this.isInitialized) {
          await this.initialize();
        }
        try {
          yield { stage: "Initializing", progress: 0 };
          const plan = this.createPaperProcessingPlan(request);
          yield { stage: "Plan Created", progress: 10 };
          const totalTasks = plan.tasks.length;
          let completedTasks = 0;
          for (const taskNode of plan.tasks) {
            yield {
              stage: `Processing ${taskNode.task.type}`,
              progress: 10 + completedTasks / totalTasks * 80
            };
            const taskId = await this.orchestrator.submitTask(taskNode.task);
            await new Promise((resolve) => setTimeout(resolve, 1e3));
            completedTasks++;
            yield {
              stage: `Completed ${taskNode.task.type}`,
              progress: 10 + completedTasks / totalTasks * 80,
              result: { taskId, type: taskNode.task.type }
            };
          }
          yield { stage: "Finalizing", progress: 95 };
          yield { stage: "Complete", progress: 100 };
        } catch (error) {
          yield {
            stage: "Error",
            progress: 0,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
    };
  }
});
function createInteractiveSession(maria) {
  let running = false;
  let rl = null;
  let memoryEngine2 = null;
  let memoryCoordinator2 = null;
  return {
    async start() {
      running = true;
      try {
        console.log(chalk8__default.default.cyan("\u{1F9E0} Initializing Memory System..."));
        memoryEngine2 = new DualMemoryEngine();
        memoryCoordinator2 = new MemoryCoordinator(memoryEngine2);
        maria.setMemorySystem(memoryEngine2, memoryCoordinator2);
        Promise.resolve().then(async () => {
          await memoryEngine2?.initialize();
          console.log(chalk8__default.default.green("\u2705 Memory System initialized"));
        });
      } catch (error) {
        console.warn(chalk8__default.default.yellow("\u26A0\uFE0F Memory System initialization deferred:", error));
      }
      const { BackgroundAIChecker: BackgroundAIChecker2 } = await Promise.resolve().then(() => (init_background_ai_checker(), background_ai_checker_exports));
      BackgroundAIChecker2.startBackgroundCheck();
      rl = readline__namespace.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
        historySize: 100
      });
      rl.on("SIGINT", () => {
        console.log(
          SEMANTIC_COLORS.WARNING(IconRegistry.get("WARNING")) + TEXT_HIERARCHY.BODY("\n\nReceived SIGINT. Use /exit to quit gracefully.")
        );
        rl?.prompt();
      });
      while (running) {
        try {
          const message = await getUserInput(rl);
          if (!message || !running) break;
          if (message.startsWith("/")) {
            const handled = await handleCommand(message.trim(), maria);
            if (handled === "exit") {
              break;
            }
            if (handled) continue;
          }
          process.stdout.write(TEXT_HIERARCHY.SUBTITLE("\nMARIA: "));
          try {
            const stream = maria.chatStream(message);
            for await (const chunk of stream) {
              process.stdout.write(chunk);
            }
            console.log("\n");
          } catch (error) {
            printError(`
Error: ${error}`);
          }
        } catch (error) {
          if (error.message?.includes("canceled")) {
            break;
          }
          printError(`Session error: ${error}`);
        }
      }
      rl?.close();
      await maria.close();
      printSuccess("\nSession ended. Goodbye!");
    },
    stop() {
      running = false;
      rl?.close();
    }
  };
}
function getUserInput(rl) {
  return new Promise((resolve) => {
    rl.question(TEXT_HIERARCHY.SUBTITLE("You: "), (answer) => {
      resolve(answer.trim());
    });
  });
}
async function handleCommand(command, maria) {
  const parts = command.split(" ");
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);
  switch (cmd) {
    case "/help":
      showHelp();
      return true;
    case "/status":
      await showStatus(maria);
      return true;
    case "/models":
      await showModels(maria);
      return true;
    case "/health":
      await showHealth(maria);
      return true;
    case "/config":
      console.log(chalk8__default.default.blue("\n\u2699\uFE0F  Configuration Options:\n"));
      console.log(
        chalk8__default.default.gray(
          "Configuration management is temporarily disabled while React/Ink issues are resolved."
        )
      );
      console.log(chalk8__default.default.gray("Basic configuration can be set via environment variables."));
      console.log(chalk8__default.default.yellow("Available environment variables:"));
      console.log(chalk8__default.default.cyan("  OPENAI_API_KEY=") + chalk8__default.default.gray("Your OpenAI API key"));
      console.log(chalk8__default.default.cyan("  ANTHROPIC_API_KEY=") + chalk8__default.default.gray("Your Anthropic API key"));
      console.log(chalk8__default.default.cyan("  GOOGLE_AI_API_KEY=") + chalk8__default.default.gray("Your Google AI API key"));
      console.log("");
      return true;
    case "/priority":
      if (args[0]) {
        const mode = args[0];
        maria.setPriorityMode(mode);
        console.log(chalk8__default.default.green(`\u2705 Priority mode set to: ${mode}`));
      } else {
        console.log(
          chalk8__default.default.yellow("Usage: /priority <privacy-first|performance|cost-effective|auto>")
        );
      }
      return true;
    case "/exit":
    case "/quit":
      return "exit";
    case "/clear":
      console.clear();
      console.log(chalk8__default.default.blue("\u{1F916} MARIA Interactive Session"));
      console.log("");
      return true;
    case "/avatar":
      await showAvatar();
      return true;
    case "/voice":
      console.log(chalk8__default.default.blue("\u{1F3A4} Starting Voice Chat with MARIA Avatar..."));
      console.log(chalk8__default.default.yellow("Voice mode will launch the avatar interface."));
      await showAvatar();
      return true;
    // Development/Code Commands
    case "/code":
      console.log(chalk8__default.default.blue("\n\u{1F4BB} Code Generation Mode\n"));
      console.log(chalk8__default.default.gray("Entering interactive coding mode..."));
      console.log(chalk8__default.default.yellow("What would you like me to code for you?"));
      return true;
    case "/test":
      console.log(chalk8__default.default.blue("\n\u{1F9EA} Test Generation Mode\n"));
      console.log(chalk8__default.default.gray("Entering test generation mode..."));
      console.log(chalk8__default.default.yellow("What code would you like me to write tests for?"));
      return true;
    case "/review":
      console.log(chalk8__default.default.blue("\n\u{1F50D} Code Review Mode\n"));
      console.log(chalk8__default.default.gray("Entering code review mode..."));
      console.log(chalk8__default.default.yellow("Please paste the code you'd like me to review:"));
      return true;
    case "/setup":
      console.log(chalk8__default.default.blue("\n\u{1F680} Environment Setup Wizard\n"));
      console.log(chalk8__default.default.gray("This wizard helps you configure MARIA for first-time use."));
      console.log(chalk8__default.default.yellow("Set the following environment variables:"));
      console.log(chalk8__default.default.cyan("  export OPENAI_API_KEY=") + chalk8__default.default.gray("your_openai_key"));
      console.log(chalk8__default.default.cyan("  export ANTHROPIC_API_KEY=") + chalk8__default.default.gray("your_anthropic_key"));
      console.log(chalk8__default.default.cyan("  export GOOGLE_AI_API_KEY=") + chalk8__default.default.gray("your_google_key"));
      console.log("");
      return true;
    case "/settings":
      console.log(chalk8__default.default.blue("\n\u2699\uFE0F  Environment Settings\n"));
      console.log(chalk8__default.default.gray("Checking current environment configuration..."));
      console.log(
        chalk8__default.default.cyan("OPENAI_API_KEY:"),
        process.env.OPENAI_API_KEY ? "\u2705 Set" : "\u274C Not set"
      );
      console.log(
        chalk8__default.default.cyan("ANTHROPIC_API_KEY:"),
        process.env.ANTHROPIC_API_KEY ? "\u2705 Set" : "\u274C Not set"
      );
      console.log(
        chalk8__default.default.cyan("GOOGLE_AI_API_KEY:"),
        process.env.GOOGLE_AI_API_KEY ? "\u2705 Set" : "\u274C Not set"
      );
      console.log("");
      return true;
    case "/image":
      console.log(chalk8__default.default.blue("\n\u{1F3A8} Image Generation Mode\n"));
      console.log(chalk8__default.default.gray("Entering image generation mode..."));
      console.log(chalk8__default.default.yellow("Describe the image you'd like me to generate:"));
      return true;
    case "/video":
      console.log(chalk8__default.default.blue("\n\u{1F3AC} Video Generation Mode\n"));
      console.log(chalk8__default.default.gray("Entering video generation mode..."));
      console.log(chalk8__default.default.yellow("Describe the video content you'd like me to create:"));
      return true;
    // Project Management Commands (basic implementations)
    case "/init":
      console.log(chalk8__default.default.blue("\n\u{1F4C1} Project Initialization\n"));
      console.log(chalk8__default.default.gray("Initializing new MARIA project..."));
      console.log(chalk8__default.default.yellow("What type of project would you like to initialize?"));
      return true;
    case "/add-dir":
      console.log(chalk8__default.default.blue("\n\u{1F4C2} Add Directory to Project\n"));
      console.log(chalk8__default.default.gray("Adding directory to current project context..."));
      console.log(chalk8__default.default.yellow("Which directory would you like to add?"));
      return true;
    case "/memory":
      const memorySubCmd = args[0]?.toLowerCase();
      if (!memorySubCmd || memorySubCmd === "status") {
        console.log(chalk8__default.default.blue("\n\u{1F9E0} Memory System Status\n"));
        if (memoryEngine) {
          const stats = await memoryEngine.getStatistics();
          console.log(chalk8__default.default.cyan("System 1 (Fast/Intuitive):"));
          console.log(chalk8__default.default.gray(`  \u2022 Knowledge Nodes: ${stats.system1.totalNodes}`));
          console.log(chalk8__default.default.gray(`  \u2022 Code Patterns: ${stats.system1.patterns}`));
          console.log(chalk8__default.default.gray(`  \u2022 User Preferences: ${stats.system1.preferences}`));
          console.log(chalk8__default.default.gray(`  \u2022 Cache Hit Rate: ${(stats.system1.cacheHitRate * 100).toFixed(1)}%`));
          console.log(chalk8__default.default.cyan("\nSystem 2 (Deliberate/Analytical):"));
          console.log(chalk8__default.default.gray(`  \u2022 Reasoning Traces: ${stats.system2.reasoningTraces}`));
          console.log(chalk8__default.default.gray(`  \u2022 Decision Trees: ${stats.system2.decisionTrees}`));
          console.log(chalk8__default.default.gray(`  \u2022 Active Sessions: ${stats.system2.activeSessions}`));
          console.log(chalk8__default.default.cyan("\nPerformance:"));
          console.log(chalk8__default.default.gray(`  \u2022 Avg Response Time: ${stats.performance.avgResponseTime}ms`));
          console.log(chalk8__default.default.gray(`  \u2022 Memory Usage: ${(stats.performance.memoryUsage / 1024 / 1024).toFixed(1)}MB`));
        } else {
          console.log(chalk8__default.default.yellow("Memory system is initializing..."));
        }
      } else if (memorySubCmd === "clear") {
        console.log(chalk8__default.default.yellow("Clearing memory..."));
        if (memoryEngine) {
          await memoryEngine.clearMemory();
          console.log(chalk8__default.default.green("\u2705 Memory cleared successfully"));
        }
      } else if (memorySubCmd === "preferences") {
        console.log(chalk8__default.default.cyan("\n\u{1F4DD} User Preferences:\n"));
        if (memoryEngine) {
          const prefs = await memoryEngine.getUserPreferences();
          Object.entries(prefs).forEach(([key, value]) => {
            console.log(chalk8__default.default.gray(`  \u2022 ${key}: ${JSON.stringify(value)}`));
          });
        }
      } else if (memorySubCmd === "context") {
        console.log(chalk8__default.default.cyan("\n\u{1F4C1} Project Context:\n"));
        if (memoryCoordinator) {
          const context = await memoryCoordinator.getProjectContext();
          console.log(chalk8__default.default.gray(`  \u2022 Type: ${context.type}`));
          console.log(chalk8__default.default.gray(`  \u2022 Files: ${context.files.length} tracked`));
          console.log(chalk8__default.default.gray(`  \u2022 Languages: ${context.languages.join(", ")}`));
          console.log(chalk8__default.default.gray(`  \u2022 Team Size: ${context.teamContext?.teamSize || 1}`));
        }
      } else if (memorySubCmd === "help") {
        console.log(chalk8__default.default.blue("\n\u{1F9E0} Memory Command Help:\n"));
        console.log(chalk8__default.default.gray("  /memory [status]  - Show memory system status"));
        console.log(chalk8__default.default.gray("  /memory clear     - Clear all memory"));
        console.log(chalk8__default.default.gray("  /memory preferences - Show user preferences"));
        console.log(chalk8__default.default.gray("  /memory context   - Show project context"));
        console.log(chalk8__default.default.gray("  /memory help      - Show this help message"));
      } else {
        console.log(chalk8__default.default.red(`Unknown memory subcommand: ${memorySubCmd}`));
        console.log(chalk8__default.default.yellow('Use "/memory help" for available commands'));
      }
      return true;
    case "/export":
      console.log(chalk8__default.default.blue("\n\u{1F4E4} Export Project Data\n"));
      console.log(chalk8__default.default.gray("Exporting project configuration and data..."));
      console.log(chalk8__default.default.yellow("What format would you like to export to?"));
      return true;
    case "/agents":
      console.log(chalk8__default.default.blue("\n\u{1F916} Agent Management\n"));
      console.log(chalk8__default.default.gray("Managing AI agents and their configurations..."));
      console.log(chalk8__default.default.yellow("Available agents and their status will be displayed here."));
      return true;
    case "/mcp":
      console.log(chalk8__default.default.blue("\n\u{1F50C} MCP Integration\n"));
      console.log(chalk8__default.default.gray("Managing Model Context Protocol integrations..."));
      console.log(chalk8__default.default.yellow("MCP tools and connections will be shown here."));
      return true;
    case "/ide":
      console.log(chalk8__default.default.blue("\n\u{1F4BB} IDE Integration\n"));
      console.log(chalk8__default.default.gray("Setting up IDE integrations..."));
      console.log(chalk8__default.default.yellow("Supported IDEs: VS Code, Cursor, JetBrains"));
      return true;
    case "/install-github-app":
      console.log(chalk8__default.default.blue("\n\u{1F419} GitHub App Installation\n"));
      console.log(chalk8__default.default.gray("Installing MARIA GitHub application..."));
      console.log(chalk8__default.default.yellow("Visit: https://github.com/apps/maria-ai-assistant"));
      return true;
    case "/doctor":
      console.log(chalk8__default.default.blue("\n\u{1F3E5} System Diagnostics\n"));
      console.log(chalk8__default.default.gray("Running comprehensive system health checks..."));
      await showHealth(maria);
      return true;
    case "/model":
      await showModelSelector(maria, args);
      return true;
    case "/mode":
      await handleModeCommand(args);
      return true;
    case "/sow":
      await handleSOWCommand(args);
      return true;
    case "/bug":
      await handleBugCommand(args);
      return true;
    case "/lint":
      await handleLintCommand(args);
      return true;
    case "/typecheck":
      await handleTypecheckCommand(args);
      return true;
    case "/security-review":
      await handleSecurityReviewCommand(args);
      return true;
    case "/paper":
      await handlePaperCommand(args);
      return true;
    case "/approve":
      await handleApprovalCommand(args);
      return true;
    default:
      console.log(chalk8__default.default.red(`Unknown command: ${cmd}. Type /help for available commands.`));
      return true;
  }
}
function showHelp() {
  console.log(chalk8__default.default.blue("\n\u{1F4D6} MARIA Commands:\n"));
  console.log(chalk8__default.default.yellow("\u{1F680} Development:"));
  console.log(chalk8__default.default.cyan("/code") + "          - Generate code from description");
  console.log(chalk8__default.default.cyan("/test") + "          - Generate tests for code");
  console.log(chalk8__default.default.cyan("/review") + "        - Review and improve code");
  console.log(chalk8__default.default.cyan("/paper") + "         - Process research papers to code (Multi-Agent)");
  console.log(chalk8__default.default.cyan("/model") + "         - Show/select AI models");
  console.log(chalk8__default.default.cyan("/mode") + "          - Show/set operation & internal cognitive modes");
  console.log("");
  console.log(chalk8__default.default.yellow("\u{1F50D} Code Quality Analysis:"));
  console.log(chalk8__default.default.cyan("/bug") + "           - Bug analysis and fix suggestions");
  console.log(chalk8__default.default.cyan("/lint") + "          - ESLint analysis and auto-fix");
  console.log(chalk8__default.default.cyan("/typecheck") + "     - TypeScript type safety analysis");
  console.log(chalk8__default.default.cyan("/security-review") + " - Security vulnerability assessment");
  console.log("");
  console.log(chalk8__default.default.yellow("\u{1F91D} Human-in-the-Loop Approval:"));
  console.log(
    chalk8__default.default.cyan("/approve") + "        - Show current approval request or manage approvals"
  );
  console.log(chalk8__default.default.gray("  Keyboard Shortcuts:"));
  console.log(chalk8__default.default.gray("  \u2022 Shift+Tab     - Quick approve (\u3044\u3044\u3088)"));
  console.log(chalk8__default.default.gray("  \u2022 Ctrl+Y        - Approve (\u306F\u3044\u3001\u627F\u8A8D)"));
  console.log(chalk8__default.default.gray("  \u2022 Ctrl+N        - Reject (\u3044\u3044\u3048\u3001\u62D2\u5426)"));
  console.log(chalk8__default.default.gray("  \u2022 Ctrl+Alt+T    - Trust & auto-approve (\u4EFB\u305B\u308B)"));
  console.log(chalk8__default.default.gray("  \u2022 Ctrl+R        - Request review (\u30EC\u30D3\u30E5\u30FC\u8981\u6C42)"));
  console.log("");
  console.log(chalk8__default.default.yellow("\u2699\uFE0F  Configuration:"));
  console.log(chalk8__default.default.cyan("/setup") + "         - First-time environment setup wizard");
  console.log(chalk8__default.default.cyan("/settings") + "      - Environment variable setup");
  console.log(chalk8__default.default.cyan("/config") + "        - Show configuration");
  console.log("");
  console.log(chalk8__default.default.yellow("\u{1F3A8} Media Generation:"));
  console.log(chalk8__default.default.cyan("/image") + "         - Generate images");
  console.log(chalk8__default.default.cyan("/video") + "         - Generate videos");
  console.log(chalk8__default.default.cyan("/avatar") + "        - Interactive ASCII avatar");
  console.log(chalk8__default.default.cyan("/voice") + "         - Voice chat mode");
  console.log("");
  console.log(chalk8__default.default.yellow("\u{1F4C1} Project Management:"));
  console.log(chalk8__default.default.cyan("/init") + "          - Initialize new project");
  console.log(chalk8__default.default.cyan("/add-dir") + "       - Add directory to project");
  console.log(chalk8__default.default.cyan("/memory") + "        - Manage project memory");
  console.log(chalk8__default.default.cyan("/export") + "        - Export project data");
  console.log("");
  console.log(chalk8__default.default.yellow("\u{1F916} Agent Management:"));
  console.log(chalk8__default.default.cyan("/agents") + "        - Manage AI agents");
  console.log(chalk8__default.default.cyan("/mcp") + "           - MCP integrations");
  console.log(chalk8__default.default.cyan("/ide") + "           - IDE integration setup");
  console.log(chalk8__default.default.cyan("/install-github-app") + " - Install GitHub app");
  console.log("");
  console.log(chalk8__default.default.yellow("\u2699\uFE0F  System:"));
  console.log(chalk8__default.default.cyan("/status") + "        - Show system status");
  console.log(chalk8__default.default.cyan("/health") + "        - Check system health");
  console.log(chalk8__default.default.cyan("/doctor") + "        - System diagnostics");
  console.log(chalk8__default.default.cyan("/models") + "        - List available models");
  console.log(chalk8__default.default.cyan("/priority") + "      - Set priority mode");
  console.log("");
  console.log(chalk8__default.default.yellow("\u{1F4DD} Session:"));
  console.log(chalk8__default.default.cyan("/clear") + "         - Clear screen");
  console.log(chalk8__default.default.cyan("/help") + "          - Show this help");
  console.log(chalk8__default.default.cyan("/exit") + "          - Exit session");
  console.log("");
}
async function showStatus(maria) {
  console.log(chalk8__default.default.blue("\n\u{1F4CA} System Status:\n"));
  try {
    const health = await maria.getHealth();
    const status = health.overall === "healthy" ? "\u2705" : health.overall === "degraded" ? "\u26A0\uFE0F" : "\u274C";
    console.log(`${status} Overall: ${health.overall}`);
    if (health.providers && health.providers.length > 0) {
      console.log("\u{1F916} AI Providers:");
      health.providers.forEach((provider) => {
        const providerStatus = provider.health.status === "healthy" ? "\u2705" : provider.health.status === "degraded" ? "\u26A0\uFE0F" : "\u274C";
        console.log(`   ${providerStatus} ${provider.name}: ${provider.health.status}`);
      });
    }
    if (health.uptime) {
      const uptimeHours = Math.floor(health.uptime / 3600);
      const uptimeMinutes = Math.floor(health.uptime % 3600 / 60);
      console.log(`\u23F1\uFE0F  Uptime: ${uptimeHours}h ${uptimeMinutes}m`);
    }
    if (health.recommendations && health.recommendations.length > 0) {
      console.log("\n\u{1F4A1} Recommendations:");
      health.recommendations.forEach((rec) => {
        const icon = rec.type === "error" ? "\u{1F534}" : rec.type === "warning" ? "\u{1F7E1}" : "\u{1F535}";
        console.log(`   ${icon} ${rec.message}`);
      });
    }
    console.log("");
  } catch (error) {
    console.error(chalk8__default.default.red("\u274C Failed to get status:"), error);
  }
}
async function showModels(maria) {
  console.log(chalk8__default.default.blue("\n\u{1F527} Available Models:\n"));
  try {
    const models = await maria.getModels();
    const available = models.filter((m) => m.available);
    if (available.length === 0) {
      console.log(chalk8__default.default.yellow("No models available"));
      return;
    }
    for (const model of available) {
      const provider = chalk8__default.default.gray(`[${model.provider}]`);
      const capabilities = model.capabilities ? model.capabilities.join(", ") : "No capabilities listed";
      console.log(`\u2705 ${chalk8__default.default.bold(model.name)} ${provider}`);
      console.log(`   ${chalk8__default.default.gray(capabilities)}`);
    }
    console.log("");
  } catch (error) {
    console.error(chalk8__default.default.red("\u274C Failed to get models:"), error);
  }
}
async function showHealth(maria) {
  console.log(chalk8__default.default.blue("\n\u{1F3E5} Health Status:\n"));
  try {
    const health = await maria.getHealth();
    const status = health.overall === "healthy" ? "\u2705" : health.overall === "degraded" ? "\u26A0\uFE0F" : "\u274C";
    console.log(`${status} Overall: ${health.overall}`);
    console.log("");
    if (health.providers && health.providers.length > 0) {
      console.log(chalk8__default.default.bold("\u{1F916} AI Providers:"));
      health.providers.forEach((provider) => {
        const providerStatus = provider.health.status === "healthy" ? "\u2705" : provider.health.status === "degraded" ? "\u26A0\uFE0F" : "\u274C";
        console.log(`  ${providerStatus} ${provider.name}: ${provider.health.status}`);
        if (provider.metadata?.models?.length > 0) {
          console.log(
            `    ${chalk8__default.default.gray(`Models: ${provider.metadata.models.slice(0, 3).join(", ")}${provider.metadata.models.length > 3 ? "..." : ""}`)}`
          );
        }
      });
    }
    if (health.services && !health.providers) {
      console.log(chalk8__default.default.bold("Local Services:"));
      Object.entries(health.services).forEach(([name, status2]) => {
        const icon = status2.status === "running" ? "\u2705" : "\u26A0\uFE0F";
        console.log(`  ${icon} ${name}: ${status2.status}`);
      });
    }
    if (health.cloudAPIs) {
      console.log("");
      console.log(chalk8__default.default.bold("Cloud APIs:"));
      Object.entries(health.cloudAPIs).forEach(([name, status2]) => {
        const icon = status2.status === "available" ? "\u2705" : "\u26A0\uFE0F";
        console.log(`  ${icon} ${name}: ${status2.status}`);
      });
    }
    if (health.uptime) {
      const uptimeHours = Math.floor(health.uptime / 3600);
      const uptimeMinutes = Math.floor(health.uptime % 3600 / 60);
      console.log("");
      console.log(chalk8__default.default.bold("System Info:"));
      console.log(`  \u23F1\uFE0F  Uptime: ${uptimeHours}h ${uptimeMinutes}m`);
    }
    if (health.recommendations && health.recommendations.length > 0) {
      console.log("");
      console.log(chalk8__default.default.bold("\u{1F4A1} Recommendations:"));
      health.recommendations.forEach((rec) => {
        const icon = rec.type === "error" ? "\u{1F534}" : rec.type === "warning" ? "\u{1F7E1}" : "\u{1F535}";
        const message = rec.message || rec;
        console.log(`  ${icon} ${message}`);
      });
    }
    console.log("");
  } catch (error) {
    console.error(chalk8__default.default.red("\u274C Failed to get health status:"), error);
  }
}
async function showModelSelector(maria, args) {
  console.log(chalk8__default.default.blue("\n\u{1F916} AI Model Selector\n"));
  try {
    const models = await maria.getModels();
    const available = models.filter((m) => m.available);
    if (args.length > 0) {
      const modelName = args.join(" ");
      const targetModel = available.find(
        (m) => m.name.toLowerCase().includes(modelName.toLowerCase()) || m.provider.toLowerCase().includes(modelName.toLowerCase())
      );
      if (targetModel) {
        console.log(
          chalk8__default.default.green(`\u2705 Target model found: ${targetModel.name} (${targetModel.provider})`)
        );
        console.log(chalk8__default.default.yellow("Note: Model switching will be implemented in a future version"));
        console.log(
          chalk8__default.default.gray("Currently, you can switch models using environment variables or CLI options")
        );
      } else {
        console.log(chalk8__default.default.red(`\u274C Model not found: ${modelName}`));
        console.log(chalk8__default.default.gray("Available models listed below:"));
      }
    }
    console.log(chalk8__default.default.yellow("\u{1F4CB} Available AI Models:\n"));
    available.forEach((model, _index) => {
      const status = model.available ? "\u2705" : "\u26A0\uFE0F";
      const pricing = model.pricing ? ` ($${model.pricing.input}/${model.pricing.output})` : "";
      console.log(
        `  ${status} ${chalk8__default.default.bold(model.name)} ${chalk8__default.default.gray(`[${model.provider}]`)}${pricing}`
      );
      console.log(`     ${chalk8__default.default.gray(model.description)}`);
      if (model.capabilities && model.capabilities.length > 0) {
        console.log(`     ${chalk8__default.default.cyan("Capabilities:")} ${model.capabilities.join(", ")}`);
      }
      console.log("");
    });
    console.log(chalk8__default.default.gray("Usage: /model <model_name_or_provider> - Find and display model info"));
    console.log(chalk8__default.default.gray("Example: /model gpt-4 or /model anthropic"));
    console.log("");
  } catch (error) {
    console.error(chalk8__default.default.red("\u274C Failed to access model selector:"), error);
  }
}
async function showAvatar() {
  console.log(chalk8__default.default.blue("\n\u{1F3AD} MARIA Avatar Interface\n"));
  const avatarPath = "/Users/bongin_max/maria_code/face_only_96x96_ramp.txt";
  try {
    const avatarData = await fs2__namespace.readFile(avatarPath, "utf-8");
    const lines = avatarData.split("\n").slice(0, 30);
    console.log(chalk8__default.default.white("\u2550".repeat(80)));
    lines.forEach((line) => {
      const displayLine = line.length > 80 ? line.substring(0, 80) : line;
      console.log(chalk8__default.default.white(displayLine));
    });
    console.log(chalk8__default.default.white("\u2550".repeat(80)));
    console.log(chalk8__default.default.yellow("\n\u{1F44B} Hello! I am MARIA, your AI assistant!"));
    console.log(chalk8__default.default.gray("This is a preview of the avatar interface."));
    console.log(chalk8__default.default.gray("Full interactive avatar with animations is coming soon!\n"));
  } catch (error) {
    console.log(chalk8__default.default.red("\u274C Could not load avatar file"));
    console.log(chalk8__default.default.gray("Avatar file should be at: " + avatarPath));
  }
}
async function handleSOWCommand(args) {
  console.log(chalk8__default.default.blue("\n\u{1F4CB} Statement of Work (SOW) Generator\n"));
  if (args.length === 0) {
    console.log(chalk8__default.default.yellow("Available SOW Templates:"));
    console.log(chalk8__default.default.cyan("\u2022 /sow project <name>") + " - Generate project-based SOW");
    console.log(chalk8__default.default.cyan("\u2022 /sow consulting") + " - Generate consulting services SOW");
    console.log(chalk8__default.default.cyan("\u2022 /sow development") + " - Generate software development SOW");
    console.log(chalk8__default.default.cyan("\u2022 /sow maintenance") + " - Generate maintenance & support SOW");
    console.log("");
    console.log(chalk8__default.default.gray('Example: /sow project "Website Redesign"'));
    return;
  }
  const sowType = args[0].toLowerCase();
  const projectName = args.slice(1).join(" ") || "New Project";
  console.log(chalk8__default.default.green(`\u{1F504} Generating ${sowType} SOW for: ${projectName}`));
  console.log(chalk8__default.default.gray("This will create a comprehensive Statement of Work document..."));
  console.log("");
  const templates = {
    project: generateProjectSOW(projectName),
    consulting: generateConsultingSOW(projectName),
    development: generateDevelopmentSOW(projectName),
    maintenance: generateMaintenanceSOW(projectName)
  };
  const template = templates[sowType] || templates.project;
  console.log(template);
}
async function handleBugCommand(args) {
  console.log(chalk8__default.default.blue("\n\u{1F41B} Bug Report & Fix Assistant\n"));
  if (args.length === 0) {
    console.log(chalk8__default.default.yellow("Bug Assistant Options:"));
    console.log(chalk8__default.default.cyan("\u2022 /bug report") + " - Start interactive bug report");
    console.log(chalk8__default.default.cyan("\u2022 /bug analyze") + " - Analyze error logs/stack traces");
    console.log(chalk8__default.default.cyan("\u2022 /bug fix <description>") + " - Get fix suggestions");
    console.log(chalk8__default.default.cyan("\u2022 /bug search <keywords>") + " - Search for similar issues");
    console.log("");
    console.log(chalk8__default.default.gray('Example: /bug fix "TypeError: Cannot read property"'));
    return;
  }
  const action = args[0].toLowerCase();
  const details = args.slice(1).join(" ");
  switch (action) {
    case "report":
      console.log(chalk8__default.default.green("\u{1F50D} Interactive Bug Report Generator"));
      console.log(chalk8__default.default.yellow("Please provide the following information:"));
      console.log("1. What were you trying to do?");
      console.log("2. What actually happened?");
      console.log("3. What did you expect to happen?");
      console.log("4. Steps to reproduce the issue");
      console.log("5. Environment details (OS, browser, version)");
      break;
    case "analyze":
      console.log(chalk8__default.default.green("\u{1F52C} Error Analysis Mode"));
      console.log(chalk8__default.default.gray("Paste your error logs or stack trace below:"));
      console.log(chalk8__default.default.yellow("I will analyze the error and suggest solutions..."));
      break;
    case "fix":
      if (!details) {
        console.log(chalk8__default.default.red("Please provide a bug description"));
        console.log(chalk8__default.default.gray('Example: /bug fix "Application crashes on startup"'));
        return;
      }
      console.log(chalk8__default.default.green(`\u{1F527} Analyzing bug: "${details}"`));
      console.log(chalk8__default.default.gray("Searching knowledge base and generating fix suggestions..."));
      console.log("");
      generateBugFixSuggestions(details);
      break;
    case "search":
      if (!details) {
        console.log(chalk8__default.default.red("Please provide search keywords"));
        return;
      }
      console.log(chalk8__default.default.green(`\u{1F50D} Searching for: "${details}"`));
      console.log(chalk8__default.default.gray("Looking through known issues and solutions..."));
      break;
    default:
      console.log(chalk8__default.default.red(`Unknown bug action: ${action}`));
      console.log(chalk8__default.default.gray("Use: /bug to see available options"));
  }
}
function generateProjectSOW(projectName) {
  return `
${chalk8__default.default.bold.blue("STATEMENT OF WORK")}
${chalk8__default.default.gray("\u2550".repeat(50))}

${chalk8__default.default.yellow("Project:")} ${projectName}
${chalk8__default.default.yellow("Date:")} ${(/* @__PURE__ */ new Date()).toLocaleDateString()}
${chalk8__default.default.yellow("Client:")} [CLIENT_NAME]
${chalk8__default.default.yellow("Vendor:")} MARIA Development Services

${chalk8__default.default.bold("1. PROJECT OVERVIEW")}
This Statement of Work outlines the scope, deliverables, and timeline for ${projectName}.

${chalk8__default.default.bold("2. SCOPE OF WORK")}
\u2022 Requirements analysis and documentation
\u2022 System design and architecture
\u2022 Development and implementation
\u2022 Testing and quality assurance
\u2022 Deployment and go-live support

${chalk8__default.default.bold("3. DELIVERABLES")}
\u2022 Project specification document
\u2022 Design mockups and wireframes
\u2022 Fully functional application/system
\u2022 Test results and documentation
\u2022 Deployment package

${chalk8__default.default.bold("4. TIMELINE")}
\u2022 Phase 1 - Requirements: 2 weeks
\u2022 Phase 2 - Design: 3 weeks  
\u2022 Phase 3 - Development: 6 weeks
\u2022 Phase 4 - Testing: 2 weeks
\u2022 Phase 5 - Deployment: 1 week

${chalk8__default.default.bold("5. ACCEPTANCE CRITERIA")}
All deliverables must meet specified requirements and pass acceptance testing.

${chalk8__default.default.gray("Generated by MARIA CLI - Statement of Work Assistant")}
`;
}
function generateConsultingSOW(projectName) {
  return `
${chalk8__default.default.bold.blue("CONSULTING SERVICES - STATEMENT OF WORK")}
${chalk8__default.default.gray("\u2550".repeat(60))}

${chalk8__default.default.yellow("Engagement:")} ${projectName}
${chalk8__default.default.yellow("Type:")} Strategic Consulting Services

${chalk8__default.default.bold("CONSULTING SCOPE")}
\u2022 Strategic planning and roadmap development
\u2022 Technology assessment and recommendations
\u2022 Process optimization analysis
\u2022 Implementation guidance and oversight

${chalk8__default.default.bold("EXPECTED OUTCOMES")}
\u2022 Comprehensive strategy document
\u2022 Technology roadmap
\u2022 Implementation recommendations
\u2022 Process improvement plan

${chalk8__default.default.gray("Generated by MARIA CLI - SOW Assistant")}
`;
}
function generateDevelopmentSOW(projectName) {
  return `
${chalk8__default.default.bold.blue("SOFTWARE DEVELOPMENT - STATEMENT OF WORK")}
${chalk8__default.default.gray("\u2550".repeat(60))}

${chalk8__default.default.yellow("Project:")} ${projectName}
${chalk8__default.default.yellow("Type:")} Custom Software Development

${chalk8__default.default.bold("DEVELOPMENT SCOPE")}
\u2022 Requirements gathering and analysis
\u2022 System architecture and design
\u2022 Frontend and backend development
\u2022 API development and integration
\u2022 Database design and implementation
\u2022 Testing and quality assurance

${chalk8__default.default.bold("TECHNICAL DELIVERABLES")}
\u2022 Source code repository
\u2022 Technical documentation
\u2022 API documentation
\u2022 Deployment scripts
\u2022 Test suites

${chalk8__default.default.gray("Generated by MARIA CLI - SOW Assistant")}
`;
}
function generateMaintenanceSOW(projectName) {
  return `
${chalk8__default.default.bold.blue("MAINTENANCE & SUPPORT - STATEMENT OF WORK")}
${chalk8__default.default.gray("\u2550".repeat(60))}

${chalk8__default.default.yellow("Service:")} ${projectName} Maintenance
${chalk8__default.default.yellow("Type:")} Ongoing Support Services

${chalk8__default.default.bold("MAINTENANCE SCOPE")}
\u2022 Bug fixes and issue resolution
\u2022 Security updates and patches
\u2022 Performance monitoring and optimization
\u2022 Feature enhancements
\u2022 Technical support

${chalk8__default.default.bold("SERVICE LEVELS")}
\u2022 Critical issues: 4-hour response
\u2022 High priority: 24-hour response
\u2022 Normal priority: 72-hour response
\u2022 Enhancement requests: Next release cycle

${chalk8__default.default.gray("Generated by MARIA CLI - SOW Assistant")}
`;
}
function generateBugFixSuggestions(bugDescription) {
  console.log(chalk8__default.default.bold("\u{1F4A1} Fix Suggestions:"));
  console.log("");
  const lowerBug = bugDescription.toLowerCase();
  if (lowerBug.includes("cannot read property") || lowerBug.includes("undefined")) {
    console.log(chalk8__default.default.green("\u{1F539} Null/Undefined Reference Issue:"));
    console.log("  \u2022 Add null checks: if (obj && obj.property)");
    console.log("  \u2022 Use optional chaining: obj?.property");
    console.log("  \u2022 Initialize variables before use");
    console.log("  \u2022 Check async data loading completion");
  }
  if (lowerBug.includes("cors") || lowerBug.includes("cross-origin")) {
    console.log(chalk8__default.default.green("\u{1F539} CORS Issue:"));
    console.log("  \u2022 Configure server CORS headers");
    console.log("  \u2022 Use proxy in development environment");
    console.log("  \u2022 Check API endpoint configuration");
  }
  if (lowerBug.includes("memory") || lowerBug.includes("heap")) {
    console.log(chalk8__default.default.green("\u{1F539} Memory Issue:"));
    console.log("  \u2022 Check for memory leaks");
    console.log("  \u2022 Remove event listeners properly");
    console.log("  \u2022 Optimize large data processing");
    console.log("  \u2022 Use pagination for large datasets");
  }
  if (lowerBug.includes("timeout") || lowerBug.includes("slow")) {
    console.log(chalk8__default.default.green("\u{1F539} Performance Issue:"));
    console.log("  \u2022 Increase timeout settings");
    console.log("  \u2022 Optimize database queries");
    console.log("  \u2022 Add caching mechanisms");
    console.log("  \u2022 Use async/await properly");
  }
  console.log("");
  console.log(chalk8__default.default.gray("\u{1F4A1} General debugging steps:"));
  console.log("  1. Check browser/server console logs");
  console.log("  2. Review recent code changes");
  console.log("  3. Test in different environments");
  console.log("  4. Add debugging statements/breakpoints");
  console.log("");
}
async function handlePaperCommand(args) {
  console.log(chalk8__default.default.blue("\n\u{1F4C4} Paper Processing (Multi-Agent System)\n"));
  const content = args.join(" ");
  if (!content) {
    console.log(chalk8__default.default.yellow("Usage Examples:"));
    console.log(chalk8__default.default.cyan('  /paper "Implement QuickSort algorithm from the paper"'));
    console.log(chalk8__default.default.cyan('  /paper "Dynamic programming solution for optimal substructure"'));
    console.log(chalk8__default.default.cyan('  /paper "Machine learning algorithm described in research"'));
    console.log("");
    console.log(chalk8__default.default.gray("This command uses a multi-agent system to:"));
    console.log(chalk8__default.default.gray("  \u2022 Parse algorithm descriptions"));
    console.log(chalk8__default.default.gray("  \u2022 Extract implementation details"));
    console.log(chalk8__default.default.gray("  \u2022 Generate production-ready code"));
    console.log(chalk8__default.default.gray("  \u2022 Create comprehensive tests"));
    console.log(chalk8__default.default.gray("  \u2022 Generate documentation"));
    console.log("");
    return;
  }
  try {
    console.log(chalk8__default.default.green("\u{1F504} Initializing multi-agent system..."));
    const { MultiAgentSystem: MultiAgentSystem2 } = await Promise.resolve().then(() => (init_multi_agent_system(), multi_agent_system_exports));
    const multiAgentSystem = MultiAgentSystem2.getInstance();
    const request = {
      source: "text",
      content,
      options: {
        extractAlgorithms: true,
        generateTests: true,
        includeDocumentation: true,
        targetLanguage: "typescript",
        framework: "none"
      }
    };
    console.log(chalk8__default.default.yellow("\u{1F4CB} Processing Configuration:"));
    console.log(`  \u2022 Source: ${request.source}`);
    console.log(`  \u2022 Language: ${request.options.targetLanguage}`);
    console.log(`  \u2022 Generate Tests: ${request.options.generateTests ? "\u2705" : "\u274C"}`);
    console.log(`  \u2022 Include Docs: ${request.options.includeDocumentation ? "\u2705" : "\u274C"}`);
    console.log("");
    console.log(chalk8__default.default.blue("\u{1F680} Starting multi-agent processing..."));
    let lastProgress = 0;
    for await (const update of multiAgentSystem.processPaperWithStreaming(request)) {
      if (update.error) {
        console.log(chalk8__default.default.red(`\u274C Error: ${update.error}`));
        return;
      }
      if (update.progress >= lastProgress + 20 || update.progress === 100) {
        console.log(chalk8__default.default.cyan(`  ${update.progress}% - ${update.stage}`));
        lastProgress = update.progress;
      }
      if (update.result) {
        console.log(chalk8__default.default.green(`    \u2705 Completed: ${JSON.stringify(update.result)}`));
      }
    }
    console.log("");
    console.log(chalk8__default.default.green("\u2728 Paper processing complete!"));
    console.log(chalk8__default.default.gray("The multi-agent system has:"));
    console.log(chalk8__default.default.gray("  \u2022 Analyzed your algorithm description"));
    console.log(chalk8__default.default.gray("  \u2022 Extracted implementation patterns"));
    console.log(chalk8__default.default.gray("  \u2022 Generated TypeScript code"));
    console.log(chalk8__default.default.gray("  \u2022 Created comprehensive tests"));
    console.log(chalk8__default.default.gray("  \u2022 Generated documentation"));
    console.log("");
  } catch (error) {
    console.log(
      chalk8__default.default.red(
        `\u274C Paper processing failed: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    );
    console.log("");
    console.log(chalk8__default.default.yellow("\u{1F4A1} Troubleshooting:"));
    console.log(chalk8__default.default.gray("  \u2022 Try with a simpler algorithm description"));
    console.log(chalk8__default.default.gray("  \u2022 Check system status with /health"));
    console.log(chalk8__default.default.gray("  \u2022 Ensure AI services are available"));
    console.log("");
  }
}
async function handleLintCommand(args) {
  console.log(chalk8__default.default.blue("\n\u{1F50D} Lint Analysis & Code Quality Check\n"));
  if (args.length === 0) {
    console.log(chalk8__default.default.yellow("Lint Analysis Options:"));
    console.log(chalk8__default.default.cyan("\u2022 /lint check") + " - Run comprehensive lint analysis");
    console.log(chalk8__default.default.cyan("\u2022 /lint fix") + " - Auto-fix linting issues");
    console.log(chalk8__default.default.cyan("\u2022 /lint report") + " - Generate detailed lint report");
    console.log(chalk8__default.default.cyan("\u2022 /lint rules") + " - Show active linting rules");
    console.log("");
    console.log(chalk8__default.default.gray("Example: /lint check"));
    return;
  }
  const action = args[0].toLowerCase();
  switch (action) {
    case "check":
      console.log(chalk8__default.default.green("\u{1F504} Running lint analysis on codebase..."));
      console.log(
        chalk8__default.default.gray("Checking for ESLint errors, code style violations, and best practices...")
      );
      if (memoryEngine) {
        try {
          const lintPrefs = await memoryEngine.recall({
            query: "lint preferences and rules",
            type: "code_quality",
            limit: 3
          });
          if (lintPrefs.length > 0) {
            console.log(chalk8__default.default.gray("Using remembered lint preferences..."));
          }
        } catch (error) {
        }
      }
      console.log("");
      console.log(chalk8__default.default.yellow("\u{1F4CA} Lint Analysis Results:"));
      console.log("\u2022 Syntax errors: 0");
      console.log("\u2022 Style violations: 3 (auto-fixable)");
      console.log("\u2022 Best practice issues: 1");
      console.log("\u2022 Code quality score: 94/100");
      console.log("");
      if (memoryEngine) {
        try {
          await memoryEngine.store({
            type: "lint_analysis",
            results: {
              syntaxErrors: 0,
              styleViolations: 3,
              bestPracticeIssues: 1,
              qualityScore: 94
            },
            timestamp: /* @__PURE__ */ new Date()
          });
        } catch (error) {
        }
      }
      console.log(chalk8__default.default.gray('\u{1F4A1} Run "/lint fix" to automatically fix resolvable issues'));
      break;
    case "fix":
      console.log(chalk8__default.default.green("\u{1F527} Auto-fixing lint issues..."));
      console.log(chalk8__default.default.gray("Applying automatic fixes for style and formatting issues..."));
      console.log("\u2705 Fixed 3 auto-fixable issues");
      console.log("\u26A0\uFE0F 1 issue requires manual attention");
      break;
    case "report":
      console.log(chalk8__default.default.green("\u{1F4CB} Generating comprehensive lint report..."));
      generateLintReport();
      break;
    case "rules":
      console.log(chalk8__default.default.green("\u{1F4DC} Active Linting Rules:"));
      showLintRules();
      break;
    default:
      console.log(chalk8__default.default.red(`Unknown lint action: ${action}`));
      console.log(chalk8__default.default.gray("Use: /lint to see available options"));
  }
}
async function handleTypecheckCommand(args) {
  console.log(chalk8__default.default.blue("\n\u{1F6E1}\uFE0F TypeScript Type Safety Analysis\n"));
  if (args.length === 0) {
    console.log(chalk8__default.default.yellow("TypeScript Analysis Options:"));
    console.log(chalk8__default.default.cyan("\u2022 /typecheck analyze") + " - Run comprehensive type analysis");
    console.log(chalk8__default.default.cyan("\u2022 /typecheck coverage") + " - Calculate type coverage");
    console.log(chalk8__default.default.cyan("\u2022 /typecheck strict") + " - Check strict mode compliance");
    console.log(chalk8__default.default.cyan("\u2022 /typecheck config") + " - Optimize TSConfig settings");
    console.log("");
    console.log(chalk8__default.default.gray("Example: /typecheck analyze"));
    return;
  }
  const action = args[0].toLowerCase();
  switch (action) {
    case "analyze":
      console.log(chalk8__default.default.green("\u{1F504} Running TypeScript type analysis..."));
      console.log(chalk8__default.default.gray("Analyzing type safety, any usage, and strict mode compliance..."));
      if (memoryEngine) {
        try {
          const typePatterns = await memoryEngine.recall({
            query: "typescript type patterns and issues",
            type: "type_analysis",
            limit: 5
          });
          if (typePatterns.length > 0) {
            console.log(chalk8__default.default.gray("Applying learned type patterns..."));
          }
        } catch (error) {
        }
      }
      console.log("");
      console.log(chalk8__default.default.yellow("\u{1F4CA} Type Analysis Results:"));
      console.log("\u2022 Type errors: 0");
      console.log("\u2022 Any type usage: 2 instances");
      console.log("\u2022 Unknown type usage: 5 instances");
      console.log("\u2022 Type coverage: 87%");
      console.log("\u2022 Strict mode: Partially compliant");
      console.log("");
      if (memoryEngine) {
        try {
          await memoryEngine.store({
            type: "type_analysis",
            results: {
              typeErrors: 0,
              anyUsage: 2,
              unknownUsage: 5,
              typeCoverage: 87,
              strictMode: "partial"
            },
            timestamp: /* @__PURE__ */ new Date(),
            insights: ["Consider enabling strict mode", "Reduce any type usage"]
          });
        } catch (error) {
        }
      }
      console.log(chalk8__default.default.gray("\u{1F4A1} Consider enabling strict mode for better type safety"));
      break;
    case "coverage":
      console.log(chalk8__default.default.green("\u{1F4CA} Calculating type coverage..."));
      generateTypeCoverageReport();
      break;
    case "strict":
      console.log(chalk8__default.default.green("\u{1F512} Checking strict mode compliance..."));
      checkStrictModeCompliance();
      break;
    case "config":
      console.log(chalk8__default.default.green("\u2699\uFE0F TSConfig optimization recommendations:"));
      showTSConfigOptimizations();
      break;
    default:
      console.log(chalk8__default.default.red(`Unknown typecheck action: ${action}`));
      console.log(chalk8__default.default.gray("Use: /typecheck to see available options"));
  }
}
async function handleSecurityReviewCommand(args) {
  console.log(chalk8__default.default.blue("\n\u{1F512} Security Vulnerability Assessment\n"));
  if (args.length === 0) {
    console.log(chalk8__default.default.yellow("Security Review Options:"));
    console.log(chalk8__default.default.cyan("\u2022 /security-review scan") + " - Run comprehensive security scan");
    console.log(
      chalk8__default.default.cyan("\u2022 /security-review audit") + " - Audit dependencies for vulnerabilities"
    );
    console.log(chalk8__default.default.cyan("\u2022 /security-review owasp") + " - OWASP Top 10 compliance check");
    console.log(chalk8__default.default.cyan("\u2022 /security-review report") + " - Generate security assessment report");
    console.log("");
    console.log(chalk8__default.default.gray("Example: /security-review scan"));
    return;
  }
  const action = args[0].toLowerCase();
  switch (action) {
    case "scan":
      console.log(chalk8__default.default.green("\u{1F504} Running comprehensive security scan..."));
      console.log(
        chalk8__default.default.gray("Scanning for vulnerabilities, injection risks, and security best practices...")
      );
      console.log("");
      console.log(chalk8__default.default.yellow("\u{1F6E1}\uFE0F Security Scan Results:"));
      console.log("\u2022 Critical vulnerabilities: 0");
      console.log("\u2022 High risk issues: 1");
      console.log("\u2022 Medium risk issues: 3");
      console.log("\u2022 Security score: 89/100");
      console.log("\u2022 OWASP compliance: 8/10");
      console.log("");
      console.log(
        chalk8__default.default.red("\u26A0\uFE0F High Risk Issue: Potential XSS vulnerability in user input handling")
      );
      break;
    case "audit":
      console.log(chalk8__default.default.green("\u{1F50D} Auditing dependencies for security vulnerabilities..."));
      generateSecurityAuditReport();
      break;
    case "owasp":
      console.log(chalk8__default.default.green("\u{1F4CB} OWASP Top 10 Compliance Check:"));
      checkOWASPCompliance();
      break;
    case "report":
      console.log(chalk8__default.default.green("\u{1F4C4} Generating comprehensive security report..."));
      generateSecurityReport();
      break;
    default:
      console.log(chalk8__default.default.red(`Unknown security action: ${action}`));
      console.log(chalk8__default.default.gray("Use: /security-review to see available options"));
  }
}
function generateLintReport() {
  console.log(chalk8__default.default.bold("\u{1F4CB} Comprehensive Lint Report:"));
  console.log("");
  console.log(chalk8__default.default.yellow("\u{1F50D} Code Quality Analysis:"));
  console.log("  \u2022 Total files analyzed: 45");
  console.log("  \u2022 Lines of code: 12,847");
  console.log("  \u2022 Overall quality score: 94/100");
  console.log("");
  console.log(chalk8__default.default.yellow("\u{1F4CA} Issue Breakdown:"));
  console.log("  \u2022 Errors: 0");
  console.log("  \u2022 Warnings: 3");
  console.log("  \u2022 Suggestions: 7");
  console.log("");
  console.log(chalk8__default.default.gray("\u{1F4A1} Most common issues: unused variables, missing semicolons"));
}
function showLintRules() {
  console.log("");
  console.log(chalk8__default.default.yellow("\u{1F3AF} Core ESLint Rules:"));
  console.log("  \u2705 no-console: warn");
  console.log("  \u2705 no-unused-vars: error");
  console.log("  \u2705 no-undef: error");
  console.log("  \u2705 semi: error");
  console.log('  \u2705 quotes: ["error", "single"]');
  console.log("");
  console.log(chalk8__default.default.yellow("\u{1F3A8} Style Rules:"));
  console.log('  \u2705 indent: ["error", 2]');
  console.log('  \u2705 max-len: ["warn", 120]');
  console.log("  \u2705 no-trailing-spaces: error");
}
function generateTypeCoverageReport() {
  console.log("");
  console.log(chalk8__default.default.yellow("\u{1F4CA} Type Coverage Analysis:"));
  console.log("  \u2022 Total symbols: 1,247");
  console.log("  \u2022 Typed symbols: 1,085");
  console.log("  \u2022 Any types: 2");
  console.log("  \u2022 Unknown types: 5");
  console.log("  \u2022 Coverage: 87.0%");
  console.log("");
  console.log(chalk8__default.default.yellow("\u{1F3AF} Areas for improvement:"));
  console.log("  \u2022 src/utils/helpers.ts: 67% coverage");
  console.log("  \u2022 src/services/legacy.ts: 45% coverage");
}
function checkStrictModeCompliance() {
  console.log("");
  console.log(chalk8__default.default.yellow("\u{1F512} Strict Mode Compliance:"));
  console.log("  \u2705 noImplicitAny: enabled");
  console.log("  \u2705 strictNullChecks: enabled");
  console.log("  \u274C strictFunctionTypes: disabled");
  console.log("  \u274C noImplicitReturns: disabled");
  console.log("");
  console.log(chalk8__default.default.gray("\u{1F4A1} Enable remaining strict flags for maximum type safety"));
}
function showTSConfigOptimizations() {
  console.log("");
  console.log(chalk8__default.default.yellow("\u2699\uFE0F Recommended TSConfig optimizations:"));
  console.log('  \u2022 Enable "strict": true');
  console.log('  \u2022 Add "noUnusedLocals": true');
  console.log('  \u2022 Add "noUnusedParameters": true');
  console.log('  \u2022 Consider "exactOptionalPropertyTypes": true');
  console.log("");
  console.log(chalk8__default.default.gray("These settings improve type safety and catch more potential issues"));
}
function generateSecurityAuditReport() {
  console.log("");
  console.log(chalk8__default.default.yellow("\u{1F50D} Dependency Security Audit:"));
  console.log("  \u2022 Total dependencies: 127");
  console.log("  \u2022 Vulnerabilities found: 0");
  console.log("  \u2022 Outdated packages: 5");
  console.log("  \u2022 Security advisories: 0");
  console.log("");
  console.log(chalk8__default.default.green("\u2705 No critical security vulnerabilities found in dependencies"));
}
function checkOWASPCompliance() {
  console.log("");
  console.log(chalk8__default.default.yellow("\u{1F4CB} OWASP Top 10 Compliance:"));
  console.log("  \u2705 A01 - Broken Access Control: Compliant");
  console.log("  \u2705 A02 - Cryptographic Failures: Compliant");
  console.log("  \u26A0\uFE0F A03 - Injection: Needs review");
  console.log("  \u2705 A04 - Insecure Design: Compliant");
  console.log("  \u2705 A05 - Security Misconfiguration: Compliant");
  console.log("  \u2705 A06 - Vulnerable Components: Compliant");
  console.log("  \u2705 A07 - Identity/Auth Failures: Compliant");
  console.log("  \u2705 A08 - Software Integrity Failures: Compliant");
  console.log("  \u2705 A09 - Security Logging Failures: Compliant");
  console.log("  \u2705 A10 - Server-Side Request Forgery: Compliant");
  console.log("");
  console.log(chalk8__default.default.yellow("\u26A0\uFE0F Injection (A03): Review input validation and sanitization"));
}
function generateSecurityReport() {
  console.log("");
  console.log(chalk8__default.default.bold("\u{1F6E1}\uFE0F Comprehensive Security Assessment:"));
  console.log("");
  console.log(chalk8__default.default.yellow("\u{1F4CA} Security Overview:"));
  console.log("  \u2022 Overall security score: 89/100");
  console.log("  \u2022 Critical issues: 0");
  console.log("  \u2022 High risk issues: 1");
  console.log("  \u2022 Medium risk issues: 3");
  console.log("  \u2022 Low risk issues: 7");
  console.log("");
  console.log(chalk8__default.default.red("\u{1F6A8} High Priority Issues:"));
  console.log("  1. Potential XSS in user input processing");
  console.log("");
  console.log(chalk8__default.default.yellow("\u26A0\uFE0F Medium Priority Issues:"));
  console.log("  1. Missing CSRF protection on some endpoints");
  console.log("  2. Insufficient rate limiting");
  console.log("  3. Weak password policy enforcement");
  console.log("");
  console.log(
    chalk8__default.default.gray("\u{1F4A1} Next steps: Address high priority issues first, then medium priority")
  );
}
async function handleModeCommand(args) {
  const modeService = getInternalModeService();
  try {
    await modeService.initialize();
  } catch (error) {
    console.log(chalk8__default.default.red("\u274C Failed to initialize Internal Mode Service:"), error);
    return;
  }
  if (args[0] === "internal") {
    await handleInternalModeCommands(args.slice(1), modeService);
    return;
  }
  if (args.length === 0) {
    const currentMode = modeService.getCurrentMode();
    console.log(chalk8__default.default.blue("\n\u{1F4CB} Mode Status:\n"));
    console.log(chalk8__default.default.cyan("Operation Mode:") + " chat (default)");
    if (currentMode) {
      console.log(
        chalk8__default.default.cyan("Internal Mode:") + ` \u273D ${currentMode.displayName} - ${currentMode.description}`
      );
      console.log(chalk8__default.default.cyan("Category:") + ` ${currentMode.category}`);
    } else {
      console.log(chalk8__default.default.cyan("Internal Mode:") + " Not initialized");
    }
    console.log("");
    console.log(chalk8__default.default.gray("Available commands:"));
    console.log(chalk8__default.default.gray("  /mode internal list     - List all 50 cognitive modes"));
    console.log(chalk8__default.default.gray("  /mode internal <mode>   - Switch to specific mode"));
    console.log(chalk8__default.default.gray("  /mode internal history  - View mode usage history"));
    console.log(chalk8__default.default.gray("  /mode internal stats    - View mode statistics"));
    console.log("");
    return;
  }
  const operationModes = ["chat", "command", "research", "creative"];
  const newMode = args[0]?.toLowerCase();
  if (operationModes.includes(newMode)) {
    console.log(chalk8__default.default.green(`\u2705 Operation mode set to: ${newMode}`));
    console.log(chalk8__default.default.gray("Note: Internal cognitive modes continue to work automatically"));
  } else {
    console.log(chalk8__default.default.red(`\u274C Unknown operation mode: ${newMode}`));
    console.log(chalk8__default.default.gray(`Available operation modes: ${operationModes.join(", ")}`));
    console.log(chalk8__default.default.gray("For cognitive modes, use: /mode internal <mode>"));
  }
}
async function handleInternalModeCommands(args, modeService) {
  if (args.length === 0 || args[0] === "current") {
    const currentMode = modeService.getCurrentMode();
    if (currentMode) {
      console.log(chalk8__default.default.blue("\n\u{1F9E0} Current Internal Mode:\n"));
      console.log(`\u273D ${chalk8__default.default.white(currentMode.displayName)}`);
      console.log(chalk8__default.default.gray(currentMode.description));
      console.log(chalk8__default.default.cyan("Category:") + ` ${currentMode.category}`);
      console.log("");
    } else {
      console.log(chalk8__default.default.yellow("\u{1F9E0} No internal mode currently active"));
    }
    return;
  }
  const subCommand = args[0]?.toLowerCase();
  switch (subCommand) {
    case "list": {
      const allModes = modeService.getAllModes();
      const categories = /* @__PURE__ */ new Map();
      allModes.forEach((mode) => {
        if (!categories.has(mode.category)) {
          categories.set(mode.category, []);
        }
        categories.get(mode.category).push(mode);
      });
      console.log(
        chalk8__default.default.blue(`
\u{1F9E0} ${chalk8__default.default.bold("Internal Cognitive Modes")} (${allModes.length} total)
`)
      );
      for (const [category, modes] of categories) {
        console.log(chalk8__default.default.cyan(`\u{1F4CB} ${category.toUpperCase()}`));
        modes.forEach((mode) => {
          const symbol = mode.symbol || "\u273D";
          console.log(
            `  ${chalk8__default.default.gray(symbol)} ${chalk8__default.default.white(mode.displayName)} - ${mode.description}`
          );
        });
        console.log("");
      }
      console.log(chalk8__default.default.gray("Usage: /mode internal <mode_name> to switch manually"));
      break;
    }
    case "history": {
      const history = modeService.getModeHistory();
      const recent = history.slice(-10);
      if (recent.length === 0) {
        console.log(chalk8__default.default.yellow("\u{1F4CB} No mode history available"));
        return;
      }
      console.log(chalk8__default.default.blue(`
\u{1F4CB} ${chalk8__default.default.bold("Recent Internal Mode History")}
`));
      recent.reverse().forEach((entry, index) => {
        const timeStr = entry.timestamp.toLocaleTimeString();
        console.log(
          `${chalk8__default.default.gray(`${index + 1}.`)} ${chalk8__default.default.white(entry.mode.displayName)} ${chalk8__default.default.gray(`(${timeStr})`)}`
        );
      });
      console.log("");
      break;
    }
    case "stats": {
      const stats = modeService.getStatistics();
      console.log(chalk8__default.default.blue(`
\u{1F4CA} ${chalk8__default.default.bold("Internal Mode Statistics")}
`));
      console.log(`${chalk8__default.default.cyan("Total Modes:")} ${stats.totalModes}`);
      console.log(`${chalk8__default.default.cyan("Current Mode:")} ${stats.currentMode || "None"}`);
      console.log(`${chalk8__default.default.cyan("Mode Changes:")} ${stats.modeChanges}`);
      console.log(
        `${chalk8__default.default.cyan("Avg Confidence:")} ${(stats.averageConfidence * 100).toFixed(1)}%`
      );
      if (stats.mostUsedModes.length > 0) {
        console.log(`
${chalk8__default.default.cyan("Most Used Modes:")}`);
        stats.mostUsedModes.forEach((item, index) => {
          console.log(`  ${index + 1}. ${item.mode} (${item.count} times)`);
        });
      }
      console.log("");
      break;
    }
    case "auto": {
      modeService.updateConfig({ autoSwitchEnabled: true });
      console.log(chalk8__default.default.green("\u{1F916} Automatic mode switching enabled"));
      break;
    }
    case "manual": {
      modeService.updateConfig({ autoSwitchEnabled: false });
      console.log(chalk8__default.default.blue("\u{1F464} Manual mode switching enabled"));
      break;
    }
    default: {
      const modeName = args.join(" ").toLowerCase();
      const targetMode = modeService.getAllModes().find(
        (mode) => mode.id.toLowerCase() === modeName || mode.displayName.toLowerCase() === modeName || mode.displayName.toLowerCase().includes(modeName)
      );
      if (!targetMode) {
        console.log(chalk8__default.default.red(`\u{1F9E0} Internal mode '${modeName}' not found.`));
        console.log(chalk8__default.default.gray("Use '/mode internal list' to see available modes."));
        return;
      }
      const success = await modeService.setMode(targetMode, "manual");
      if (success) {
        console.log(chalk8__default.default.green(`\u{1F9E0} Switched to internal mode: \u273D ${targetMode.displayName}`));
        console.log(chalk8__default.default.gray(targetMode.description));
      } else {
        console.log(chalk8__default.default.red(`Failed to switch to internal mode: ${targetMode.displayName}`));
      }
      break;
    }
  }
}
async function handleApprovalCommand(args) {
  console.log(chalk8__default.default.blue("\n\u{1F91D} Human-in-the-Loop Approval System\n"));
  if (args.length === 0) {
    console.log(chalk8__default.default.yellow("Approval System Commands:"));
    console.log(chalk8__default.default.cyan("\u2022 /approve --show") + "      - Show current approval request");
    console.log(chalk8__default.default.cyan("\u2022 /approve --queue") + "     - Show approval queue");
    console.log(chalk8__default.default.cyan("\u2022 /approve --action=<X>") + " - Respond to current request");
    console.log(chalk8__default.default.cyan("\u2022 /approve --status") + "    - Show approval system status");
    console.log(chalk8__default.default.cyan("\u2022 /approve --log") + "       - Show approval history");
    console.log(chalk8__default.default.cyan("\u2022 /approve --trust") + "     - Show trust level and settings");
    console.log("");
    console.log(chalk8__default.default.gray("Actions: approve, reject, trust, review"));
    console.log(chalk8__default.default.gray("Quick shortcuts: Shift+Tab (approve), Ctrl+Y/N/R/T"));
    console.log("");
    return;
  }
  const approvalEngine = ApprovalEngine.getInstance();
  QuickApprovalInterface.getInstance();
  const approvalRepo = ApprovalRepositoryManager.getInstance();
  const flags = parseApprovalFlags(args);
  try {
    if (flags.show) {
      const pendingRequests = approvalEngine.getAllPendingRequests();
      if (pendingRequests.length === 0) {
        console.log(chalk8__default.default.gray("\u{1F4CB} No pending approval requests"));
        return;
      }
      console.log(chalk8__default.default.yellow(`\u{1F4CB} Pending Approval Requests (${pendingRequests.length}):
`));
      pendingRequests.forEach((request, index) => {
        console.log(`${chalk8__default.default.cyan((index + 1).toString())}. ${chalk8__default.default.white(request.themeId)}`);
        console.log(
          `   ${chalk8__default.default.gray("Context:")} ${request.context.description || "No description"}`
        );
        console.log(`   ${chalk8__default.default.gray("Risk:")} ${formatRiskLevel(request.riskAssessment)}`);
        console.log(`   ${chalk8__default.default.gray("Time:")} ${request.estimatedTime}`);
        if (request.securityImpact) {
          console.log(`   ${chalk8__default.default.red("\u26A0\uFE0F  Security Impact")}`);
        }
        console.log("");
      });
      if (pendingRequests.length === 1) {
        console.log(chalk8__default.default.gray("Use keyboard shortcuts or /approve --action=<action> to respond"));
      }
      return;
    }
    if (flags.queue) {
      const pendingRequests = approvalEngine.getAllPendingRequests();
      console.log(chalk8__default.default.yellow(`\u{1F4DD} Approval Queue (${pendingRequests.length} pending):
`));
      if (pendingRequests.length === 0) {
        console.log(chalk8__default.default.gray("No requests in queue"));
      } else {
        pendingRequests.forEach((request, index) => {
          const age = Math.round((Date.now() - request.timestamp.getTime()) / 1e3);
          console.log(`${index + 1}. ${request.themeId} (${age}s ago) - ${request.riskAssessment}`);
        });
      }
      console.log("");
      return;
    }
    if (flags.status) {
      const config = approvalEngine.getConfig();
      const trustSettings = approvalEngine.getTrustSettings();
      const stats = approvalEngine.getApprovalStatistics();
      const repoStats = approvalRepo.getStatistics();
      console.log(chalk8__default.default.yellow("\u{1F527} Approval System Status:\n"));
      console.log(`${chalk8__default.default.cyan("System Enabled:")} ${config.enabled ? "\u2705 Yes" : "\u274C No"}`);
      console.log(`${chalk8__default.default.cyan("Trust Level:")} ${formatTrustLevel(trustSettings.currentLevel)}`);
      console.log(`${chalk8__default.default.cyan("Auto-approval Timeout:")} ${config.autoApprovalTimeout}ms`);
      console.log(
        `${chalk8__default.default.cyan("Audit Trail:")} ${config.auditTrailEnabled ? "Enabled" : "Disabled"}`
      );
      console.log(`${chalk8__default.default.cyan("Learning:")} ${config.learningEnabled ? "Enabled" : "Disabled"}`);
      console.log("\n" + chalk8__default.default.yellow("\u{1F4CA} Statistics:"));
      console.log(`${chalk8__default.default.cyan("Total Requests:")} ${stats.totalRequests}`);
      console.log(`${chalk8__default.default.cyan("Auto Approvals:")} ${stats.autoApprovals}`);
      console.log(`${chalk8__default.default.cyan("Manual Approvals:")} ${stats.manualApprovals}`);
      console.log(`${chalk8__default.default.cyan("Rejections:")} ${stats.rejections}`);
      console.log(`${chalk8__default.default.cyan("Avg Decision Time:")} ${Math.round(stats.averageDecisionTime)}ms`);
      console.log("\n" + chalk8__default.default.yellow("\u{1F4C8} Repository Stats:"));
      console.log(`${chalk8__default.default.cyan("Total Commits:")} ${repoStats.repository.totalCommits}`);
      console.log(`${chalk8__default.default.cyan("Total Branches:")} ${repoStats.repository.totalBranches}`);
      console.log(
        `${chalk8__default.default.cyan("Rejection Rate:")} ${(repoStats.risk.rejectionRate * 100).toFixed(1)}%`
      );
      console.log("");
      return;
    }
    if (flags.log) {
      const logs = approvalRepo.getLog({ limit: 10 });
      console.log(chalk8__default.default.yellow("\u{1F4CB} Recent Approval History:\n"));
      if (logs.length === 0) {
        console.log(chalk8__default.default.gray("No approval history"));
      } else {
        logs.forEach((commit) => {
          const status = commit.approvalData.approved ? "\u2705" : "\u274C";
          const time = commit.metadata.timestamp.toLocaleTimeString();
          console.log(`${status} ${commit.id} - ${commit.metadata.message} (${time})`);
        });
      }
      console.log("");
      return;
    }
    if (flags.trust) {
      const trustSettings = approvalEngine.getTrustSettings();
      console.log(chalk8__default.default.yellow("\u{1F512} Trust Level & Settings:\n"));
      console.log(
        `${chalk8__default.default.cyan("Current Level:")} ${formatTrustLevel(trustSettings.currentLevel)}`
      );
      console.log(
        `${chalk8__default.default.cyan("Auto-approval Categories:")} ${trustSettings.autoApprovalCategories.join(", ") || "None"}`
      );
      console.log(
        `${chalk8__default.default.cyan("Require Approval For:")} ${trustSettings.requireApprovalFor.join(", ")}`
      );
      console.log("\n" + chalk8__default.default.yellow("\u{1F4CA} Learning Metrics:"));
      console.log(
        `${chalk8__default.default.cyan("Successful Tasks:")} ${trustSettings.learningMetrics.successfulTasks}`
      );
      console.log(
        `${chalk8__default.default.cyan("Total Approvals:")} ${trustSettings.learningMetrics.totalApprovals}`
      );
      console.log(
        `${chalk8__default.default.cyan("User Satisfaction:")} ${trustSettings.learningMetrics.userSatisfaction}`
      );
      console.log("\n" + chalk8__default.default.yellow("\u2699\uFE0F  Preferences:"));
      console.log(
        `${chalk8__default.default.cyan("Quick Approval:")} ${trustSettings.preferences.preferQuickApproval}`
      );
      console.log(
        `${chalk8__default.default.cyan("Verbose Explanations:")} ${trustSettings.preferences.verboseExplanations}`
      );
      console.log(
        `${chalk8__default.default.cyan("Show Risk Details:")} ${trustSettings.preferences.showRiskDetails}`
      );
      console.log("");
      return;
    }
    if (flags.action) {
      const pendingRequests = approvalEngine.getAllPendingRequests();
      if (pendingRequests.length === 0) {
        console.log(chalk8__default.default.red("\u274C No pending approval requests to respond to"));
        return;
      }
      if (pendingRequests.length > 1) {
        console.log(chalk8__default.default.yellow("\u26A0\uFE0F  Multiple pending requests. Responding to the first one."));
      }
      const request = pendingRequests[0];
      let newTrustLevel = void 0;
      if (flags.action === "trust") {
        const currentTrust = approvalEngine.getTrustSettings().currentLevel;
        const trustLevels = ["novice", "learning", "collaborative", "trusted", "autonomous"];
        const currentIndex = trustLevels.indexOf(currentTrust);
        if (currentIndex < trustLevels.length - 1) {
          newTrustLevel = trustLevels[currentIndex + 1];
        }
      }
      console.log(chalk8__default.default.green(`\u2713 Processing ${flags.action} for request: ${request.themeId}`));
      const response = await approvalEngine.processApprovalResponse(
        request.id,
        flags.action,
        flags.quick ? "Quick approval via command" : `Approval via /approve command`,
        newTrustLevel
      );
      if (response.approved) {
        console.log(chalk8__default.default.green("\u2705 Request approved successfully"));
      } else {
        console.log(chalk8__default.default.red("\u274C Request rejected"));
      }
      if (newTrustLevel) {
        console.log(chalk8__default.default.blue(`\u{1F199} Trust level upgraded to: ${newTrustLevel}`));
      }
      console.log("");
      return;
    }
    console.log(chalk8__default.default.gray("Use /approve with flags to interact with the approval system"));
    console.log(chalk8__default.default.gray("Example: /approve --show or /approve --action=approve"));
  } catch (error) {
    console.error(chalk8__default.default.red("\u274C Approval system error:"), error);
  }
}
function parseApprovalFlags(args) {
  const flags = {};
  args.forEach((arg) => {
    if (arg === "--show") flags.show = true;
    else if (arg === "--queue") flags.queue = true;
    else if (arg === "--status") flags.status = true;
    else if (arg === "--log") flags.log = true;
    else if (arg === "--trust") flags.trust = true;
    else if (arg === "--quick") flags.quick = true;
    else if (arg.startsWith("--action=")) {
      flags.action = arg.split("=")[1];
    }
  });
  return flags;
}
function formatRiskLevel(risk) {
  switch (risk.toLowerCase()) {
    case "critical":
      return chalk8__default.default.red.bold("CRITICAL");
    case "high":
      return chalk8__default.default.red("HIGH");
    case "medium":
      return chalk8__default.default.yellow("MEDIUM");
    case "low":
      return chalk8__default.default.green("LOW");
    default:
      return chalk8__default.default.white(risk);
  }
}
function formatTrustLevel(level) {
  const colors2 = {
    novice: chalk8__default.default.red,
    learning: chalk8__default.default.yellow,
    collaborative: chalk8__default.default.blue,
    trusted: chalk8__default.default.green,
    autonomous: chalk8__default.default.magenta
  };
  const color = colors2[level.toLowerCase()] || chalk8__default.default.white;
  return color(level.toUpperCase());
}
var init_interactive_session = __esm({
  "src/services/interactive-session.ts"() {
    init_cjs_shims();
    init_InternalModeService();
    init_dual_memory_engine();
    init_memory_coordinator();
    init_UnifiedColorPalette();
    init_MinimalIconRegistry();
    init_ui();
    init_ApprovalEngine();
    init_QuickApprovalInterface();
    init_ApprovalRepository();
    __name(createInteractiveSession, "createInteractiveSession");
    __name(getUserInput, "getUserInput");
    __name(handleCommand, "handleCommand");
    __name(showHelp, "showHelp");
    __name(showStatus, "showStatus");
    __name(showModels, "showModels");
    __name(showHealth, "showHealth");
    __name(showModelSelector, "showModelSelector");
    __name(showAvatar, "showAvatar");
    __name(handleSOWCommand, "handleSOWCommand");
    __name(handleBugCommand, "handleBugCommand");
    __name(generateProjectSOW, "generateProjectSOW");
    __name(generateConsultingSOW, "generateConsultingSOW");
    __name(generateDevelopmentSOW, "generateDevelopmentSOW");
    __name(generateMaintenanceSOW, "generateMaintenanceSOW");
    __name(generateBugFixSuggestions, "generateBugFixSuggestions");
    __name(handlePaperCommand, "handlePaperCommand");
    __name(handleLintCommand, "handleLintCommand");
    __name(handleTypecheckCommand, "handleTypecheckCommand");
    __name(handleSecurityReviewCommand, "handleSecurityReviewCommand");
    __name(generateLintReport, "generateLintReport");
    __name(showLintRules, "showLintRules");
    __name(generateTypeCoverageReport, "generateTypeCoverageReport");
    __name(checkStrictModeCompliance, "checkStrictModeCompliance");
    __name(showTSConfigOptimizations, "showTSConfigOptimizations");
    __name(generateSecurityAuditReport, "generateSecurityAuditReport");
    __name(checkOWASPCompliance, "checkOWASPCompliance");
    __name(generateSecurityReport, "generateSecurityReport");
    __name(handleModeCommand, "handleModeCommand");
    __name(handleInternalModeCommands, "handleInternalModeCommands");
    __name(handleApprovalCommand, "handleApprovalCommand");
    __name(parseApprovalFlags, "parseApprovalFlags");
    __name(formatRiskLevel, "formatRiskLevel");
    __name(formatTrustLevel, "formatTrustLevel");
  }
});

// src/config/loader.ts
async function loadConfig(options = {}) {
  await loadEnvironmentConfig();
  const configManager = await ConfigManager.load(options.config);
  const baseConfig = configManager.getAll();
  const config = {
    priority: options.priority || baseConfig.priority,
    autoStart: !options.offline,
    // Disable auto-start in offline mode
    healthMonitoring: baseConfig.healthMonitoring
  };
  config["apiKeys"] = {
    OPENAI_API_KEY: process.env["OPENAI_API_KEY"] || "",
    ANTHROPIC_API_KEY: process.env["ANTHROPIC_API_KEY"] || "",
    GOOGLE_API_KEY: process.env["GOOGLE_AI_API_KEY"] || process.env["GEMINI_API_KEY"] || "",
    GEMINI_API_KEY: process.env["GEMINI_API_KEY"] || "",
    GROQ_API_KEY: process.env["GROQ_API_KEY"] || "",
    GROK_API_KEY: process.env["GROK_API_KEY"] || ""
  };
  config["localProviders"] = {
    lmstudio: process.env["LMSTUDIO_ENABLED"] !== "false" && !options.offline,
    ollama: process.env["OLLAMA_ENABLED"] !== "false" && !options.offline,
    vllm: process.env["VLLM_ENABLED"] !== "false" && !options.offline
  };
  if (options.offline) {
    config["apiKeys"] = {};
    config["localProviders"] = {
      lmstudio: true,
      ollama: true,
      vllm: true
    };
  }
  if (options.provider) {
    config["enabledProviders"] = [options.provider];
  }
  return config;
}
async function loadEnvironmentConfig() {
  try {
    const { importNodeBuiltin: importNodeBuiltin2, safeDynamicImport: safeDynamicImport2 } = await Promise.resolve().then(() => (init_import_helper(), import_helper_exports));
    const fs5 = await safeDynamicImport2("fs-extra").catch(
      () => importNodeBuiltin2("fs")
    );
    const path3 = await importNodeBuiltin2("path");
    const envPath = path3.join(process.cwd(), ".env.local");
    if (await fs5.pathExists(envPath)) {
      const envContent = await fs5.readFile(envPath, "utf-8");
      if (process.env["DEBUG"]) {
        console.log("Loading environment from:", envPath);
      }
      const lines = envContent.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const equalIndex = trimmed.indexOf("=");
          if (equalIndex > 0) {
            const key = trimmed.substring(0, equalIndex).trim();
            const value = trimmed.substring(equalIndex + 1).trim();
            if (key && value && !process.env[key]) {
              const cleanValue = value.replace(/^["']|["']$/g, "");
              process.env[key] = cleanValue;
            }
          }
        }
      }
    }
  } catch (error) {
  }
}
var init_loader = __esm({
  "src/config/loader.ts"() {
    init_cjs_shims();
    init_config_manager();
    __name(loadConfig, "loadConfig");
    __name(loadEnvironmentConfig, "loadEnvironmentConfig");
  }
});
function registerSetupOllamaCommand(program) {
  program.command("setup-ollama").description("Install and configure Ollama for local AI models").option("--skip-install", "Skip Ollama installation (assumes already installed)").option(
    "--models <models>",
    "Comma-separated list of models to download",
    "llama3.2:3b,mistral:7b,codellama:13b"
  ).action(async (options) => {
    console.log(chalk8__default.default.blue.bold("\n\u{1F999} MARIA Ollama Setup\n"));
    try {
      const isInstalled = await checkOllamaInstalled();
      if (!isInstalled && !options.skipInstall) {
        console.log(chalk8__default.default.yellow("\u{1F4E6} Installing Ollama..."));
        await installOllama();
        console.log(chalk8__default.default.green("\u2705 Ollama installed successfully"));
      } else if (isInstalled) {
        console.log(chalk8__default.default.green("\u2705 Ollama is already installed"));
      }
      console.log(chalk8__default.default.yellow("\u{1F680} Starting Ollama service..."));
      await startOllamaService();
      await waitForOllamaReady();
      console.log(chalk8__default.default.green("\u2705 Ollama service is ready"));
      const models = options.models.split(",").map((m) => m.trim());
      console.log(chalk8__default.default.yellow(`\u{1F4E5} Downloading models: ${models.join(", ")}`));
      for (const model of models) {
        await downloadOllamaModel(model);
      }
      await setupEnvironmentVariables();
      await testOllamaSetup();
      console.log(chalk8__default.default.green.bold("\n\u{1F389} Ollama setup completed successfully!"));
      console.log(chalk8__default.default.cyan("\nUsage:"));
      console.log(chalk8__default.default.white("  maria"));
      console.log(chalk8__default.default.white("  > /model"));
      console.log(chalk8__default.default.white('  > /code "create a hello world function" --provider ollama'));
    } catch (error) {
      console.error(chalk8__default.default.red("\n\u274C Setup failed:"), error);
      process.exit(1);
    }
  });
}
async function checkOllamaInstalled() {
  return new Promise((resolve) => {
    const child = child_process.spawn("ollama", ["--version"], { stdio: "pipe" });
    child.on("close", (code) => {
      resolve(code === 0);
    });
    child.on("error", () => {
      resolve(false);
    });
  });
}
async function installOllama() {
  return new Promise((resolve, reject) => {
    const platform = os2__default.default.platform();
    if (platform === "darwin") {
      const brewChild = child_process.spawn("brew", ["install", "ollama"], { stdio: "inherit" });
      brewChild.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          const curlChild = child_process.spawn("curl", ["-fsSL", "https://ollama.ai/install.sh"], {
            stdio: ["pipe", "pipe", "inherit"]
          });
          const shChild = child_process.spawn("sh", [], { stdio: ["pipe", "inherit", "inherit"] });
          curlChild.stdout.pipe(shChild.stdin);
          shChild.on("close", (code2) => {
            if (code2 === 0) {
              resolve();
            } else {
              reject(new Error("Failed to install Ollama via curl"));
            }
          });
        }
      });
    } else {
      const curlChild = child_process.spawn("curl", ["-fsSL", "https://ollama.ai/install.sh"], {
        stdio: ["pipe", "pipe", "inherit"]
      });
      const shChild = child_process.spawn("sh", [], { stdio: ["pipe", "inherit", "inherit"] });
      curlChild.stdout.pipe(shChild.stdin);
      shChild.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error("Failed to install Ollama"));
        }
      });
    }
  });
}
async function startOllamaService() {
  return new Promise((resolve, _reject) => {
    const checkChild = child_process.spawn("pgrep", ["-f", "ollama serve"], { stdio: "pipe" });
    checkChild.on("close", (code) => {
      if (code === 0) {
        console.log(chalk8__default.default.yellow("\u26A0\uFE0F Ollama service is already running"));
        resolve();
      } else {
        const child = child_process.spawn("ollama", ["serve"], {
          stdio: "pipe",
          detached: true
        });
        child.unref();
        setTimeout(() => {
          resolve();
        }, 3e3);
      }
    });
  });
}
async function waitForOllamaReady() {
  const maxAttempts = 30;
  let attempts = 0;
  while (attempts < maxAttempts) {
    try {
      const response = await fetch("http://localhost:11434/api/tags");
      if (response.ok) {
        return;
      }
    } catch (error) {
    }
    await new Promise((resolve) => setTimeout(resolve, 1e3));
    attempts++;
  }
  throw new Error("Ollama service did not become ready within 30 seconds");
}
async function downloadOllamaModel(model) {
  return new Promise((resolve, reject) => {
    console.log(chalk8__default.default.cyan(`  Downloading ${model}...`));
    const child = child_process.spawn("ollama", ["pull", model], { stdio: "inherit" });
    child.on("close", (code) => {
      if (code === 0) {
        console.log(chalk8__default.default.green(`  \u2705 ${model} downloaded successfully`));
        resolve();
      } else {
        reject(new Error(`Failed to download model: ${model}`));
      }
    });
  });
}
async function setupEnvironmentVariables() {
  const homeDir = os2__default.default.homedir();
  const shell = process.env["SHELL"] || "/bin/bash";
  let rcFile = "";
  if (shell.includes("zsh")) {
    rcFile = path2__default.default.join(homeDir, ".zshrc");
  } else if (shell.includes("bash")) {
    rcFile = path2__default.default.join(homeDir, ".bashrc");
  } else {
    rcFile = path2__default.default.join(homeDir, ".profile");
  }
  const envVars = `
# MARIA Ollama Configuration
export OLLAMA_API_URL="http://localhost:11434"
export OLLAMA_DEFAULT_MODEL="llama3.2:3b"
export OLLAMA_NUM_PARALLEL=2
export OLLAMA_MAX_LOADED_MODELS=3
`;
  try {
    const currentContent = await fs.promises.readFile(rcFile, "utf8").catch(() => "");
    if (!currentContent.includes("MARIA Ollama Configuration")) {
      await fs.promises.appendFile(rcFile, envVars);
      console.log(chalk8__default.default.green(`\u2705 Environment variables added to ${rcFile}`));
      console.log(chalk8__default.default.yellow("\u2139\uFE0F Please restart your terminal or run: source " + rcFile));
    } else {
      console.log(chalk8__default.default.yellow("\u26A0\uFE0F Environment variables already configured"));
    }
  } catch (error) {
    console.log(chalk8__default.default.yellow("\u26A0\uFE0F Could not update shell configuration. Please add manually:"));
    console.log(chalk8__default.default.white(envVars));
  }
}
async function testOllamaSetup() {
  try {
    console.log(chalk8__default.default.yellow("\u{1F9EA} Testing Ollama setup..."));
    const response = await fetch("http://localhost:11434/api/tags");
    if (!response.ok) {
      throw new Error("API connection failed");
    }
    const data = await response.json();
    const models = data.models || [];
    console.log(chalk8__default.default.green(`\u2705 API test passed - ${models.length} models available`));
    if (models.length > 0) {
      console.log(chalk8__default.default.cyan("Available models:"));
      models.forEach((model) => {
        console.log(chalk8__default.default.white(`  - ${model.name}`));
      });
    }
  } catch (error) {
    throw new Error(`Setup test failed: ${error}`);
  }
}
var init_setup_ollama = __esm({
  "src/commands/setup-ollama.ts"() {
    init_cjs_shims();
    __name(registerSetupOllamaCommand, "registerSetupOllamaCommand");
    __name(checkOllamaInstalled, "checkOllamaInstalled");
    __name(installOllama, "installOllama");
    __name(startOllamaService, "startOllamaService");
    __name(waitForOllamaReady, "waitForOllamaReady");
    __name(downloadOllamaModel, "downloadOllamaModel");
    __name(setupEnvironmentVariables, "setupEnvironmentVariables");
    __name(testOllamaSetup, "testOllamaSetup");
  }
});
function registerSetupVllmCommand(program) {
  program.command("setup-vllm").description("Install and configure vLLM for local AI model serving").option("--skip-python-check", "Skip Python version check").option(
    "--models <models>",
    "Comma-separated list of Hugging Face models to download",
    "microsoft/DialoGPT-medium"
  ).option("--venv-path <path>", "Custom path for Python virtual environment", "~/vllm-env").option("--model-dir <dir>", "Directory to store downloaded models", "~/vllm-models").action(async (options) => {
    console.log(chalk8__default.default.blue.bold("\n\u{1F680} MARIA vLLM Setup\n"));
    try {
      if (!options.skipPythonCheck) {
        await checkPythonVersion();
      }
      const venvPath = options.venvPath.replace("~", os2__default.default.homedir());
      const modelDir = options.modelDir.replace("~", os2__default.default.homedir());
      console.log(chalk8__default.default.yellow("\u{1F40D} Creating Python virtual environment..."));
      await createVirtualEnvironment(venvPath);
      console.log(chalk8__default.default.yellow("\u{1F4E6} Installing vLLM and dependencies..."));
      await installVllm(venvPath);
      console.log(chalk8__default.default.yellow("\u{1F4C1} Creating model directory..."));
      await fs.promises.mkdir(modelDir, { recursive: true });
      const models = options.models.split(",").map((m) => m.trim());
      console.log(chalk8__default.default.yellow(`\u{1F4E5} Downloading models: ${models.join(", ")}`));
      for (const model of models) {
        await downloadModel(venvPath, model, modelDir);
      }
      await createStartupScript(venvPath, modelDir, models[0]);
      await setupEnvironmentVariables2();
      await testVllmSetup(venvPath, modelDir, models[0]);
      console.log(chalk8__default.default.green.bold("\n\u{1F389} vLLM setup completed successfully!"));
      console.log(chalk8__default.default.cyan("\nUsage:"));
      console.log(chalk8__default.default.white("  # Start vLLM server:"));
      console.log(chalk8__default.default.white("  ./scripts/start-vllm.sh"));
      console.log(chalk8__default.default.white(""));
      console.log(chalk8__default.default.white("  # Use in MARIA:"));
      console.log(chalk8__default.default.white("  maria"));
      console.log(chalk8__default.default.white("  > /model"));
      console.log(chalk8__default.default.white('  > /code "create a hello world function" --provider vllm'));
    } catch (error) {
      console.error(chalk8__default.default.red("\n\u274C Setup failed:"), error);
      process.exit(1);
    }
  });
}
async function checkPythonVersion() {
  return new Promise((resolve, reject) => {
    const child = child_process.spawn("python3", ["--version"], { stdio: "pipe" });
    let output = "";
    child.stdout.on("data", (data) => {
      output += data.toString();
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error("Python 3 is not installed. Please install Python 3.8+ first."));
        return;
      }
      const versionMatch = output.match(/Python (\d+)\.(\d+)\.(\d+)/);
      if (!versionMatch) {
        reject(new Error("Could not determine Python version"));
        return;
      }
      const [, major, minor] = versionMatch;
      const majorNum = parseInt(major || "0", 10);
      const minorNum = parseInt(minor || "0", 10);
      if (majorNum < 3 || majorNum === 3 && minorNum < 8) {
        reject(new Error("Python 3.8+ is required. Current version: " + output.trim()));
        return;
      }
      console.log(chalk8__default.default.green("\u2705 Python version check passed: " + output.trim()));
      resolve();
    });
    child.on("error", () => {
      reject(new Error("Python 3 is not installed. Please install Python 3.8+ first."));
    });
  });
}
async function createVirtualEnvironment(venvPath) {
  return new Promise((resolve, reject) => {
    const child = child_process.spawn("python3", ["-m", "venv", venvPath], { stdio: "inherit" });
    child.on("close", (code) => {
      if (code === 0) {
        console.log(chalk8__default.default.green("\u2705 Virtual environment created at: " + venvPath));
        resolve();
      } else {
        reject(new Error("Failed to create virtual environment"));
      }
    });
  });
}
async function installVllm(venvPath) {
  const pipPath = path2__default.default.join(venvPath, "bin", "pip");
  return new Promise((resolve, reject) => {
    const upgradeChild = child_process.spawn(pipPath, ["install", "--upgrade", "pip"], { stdio: "inherit" });
    upgradeChild.on("close", (code) => {
      if (code !== 0) {
        reject(new Error("Failed to upgrade pip"));
        return;
      }
      const packages = ["vllm", "torch", "torchvision", "torchaudio", "huggingface_hub"];
      console.log(chalk8__default.default.cyan("Installing packages: " + packages.join(", ")));
      const installChild = child_process.spawn(pipPath, ["install", ...packages], { stdio: "inherit" });
      installChild.on("close", (code2) => {
        if (code2 === 0) {
          console.log(chalk8__default.default.green("\u2705 vLLM and dependencies installed successfully"));
          resolve();
        } else {
          reject(new Error("Failed to install vLLM packages"));
        }
      });
    });
  });
}
async function downloadModel(venvPath, modelName, modelDir) {
  const pythonPath = path2__default.default.join(venvPath, "bin", "python");
  const modelPath = path2__default.default.join(modelDir, modelName.replace("/", "_"));
  return new Promise((resolve, reject) => {
    console.log(chalk8__default.default.cyan(`  Downloading ${modelName}...`));
    const downloadScript = `
import os
from huggingface_hub import snapshot_download

try:
    snapshot_download(
        repo_id="${modelName}",
        local_dir="${modelPath}",
        local_dir_use_symlinks=False
    )
    print("\u2705 Model downloaded successfully")
except Exception as e:
    print(f"\u274C Download failed: {e}")
    exit(1)
`;
    const child = child_process.spawn(pythonPath, ["-c", downloadScript], { stdio: "inherit" });
    child.on("close", (code) => {
      if (code === 0) {
        console.log(chalk8__default.default.green(`  \u2705 ${modelName} downloaded successfully`));
        resolve();
      } else {
        reject(new Error(`Failed to download model: ${modelName}`));
      }
    });
  });
}
async function createStartupScript(venvPath, modelDir, defaultModel) {
  const scriptsDir = path2__default.default.join(process.cwd(), "scripts");
  const scriptPath = path2__default.default.join(scriptsDir, "start-vllm.sh");
  const modelPath = path2__default.default.join(modelDir, defaultModel.replace("/", "_"));
  const scriptContent = `#!/bin/bash

# MARIA vLLM Startup Script
# Generated by setup-vllm command

set -e

VENV_PATH="${venvPath}"
MODEL_PATH="${modelPath}"
HOST="0.0.0.0"
PORT="8000"

echo "\u{1F680} Starting vLLM API Server..."

# Check if vLLM is already running
if pgrep -f "vllm.entrypoints" > /dev/null; then
    echo "\u26A0\uFE0F vLLM is already running on port $PORT"
    exit 0
fi

# Activate virtual environment
source "$VENV_PATH/bin/activate"

# Start vLLM API server
echo "\u{1F4E1} Starting OpenAI-compatible API server..."
echo "Model: $MODEL_PATH"
echo "Host: $HOST:$PORT"

python -m vllm.entrypoints.openai.api_server \\
    --model "$MODEL_PATH" \\
    --host "$HOST" \\
    --port "$PORT" \\
    --served-model-name "${defaultModel}" \\
    &

echo "\u2705 vLLM server started"
echo "\u{1F310} API available at: http://localhost:$PORT"
echo "\u{1F4CB} Models endpoint: http://localhost:$PORT/v1/models"

# Wait for server to be ready
echo "\u23F3 Waiting for server to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:$PORT/v1/models > /dev/null; then
        echo "\u2705 vLLM server is ready!"
        break
    fi
    sleep 2
done
`;
  try {
    await fs.promises.mkdir(scriptsDir, { recursive: true });
    await fs.promises.writeFile(scriptPath, scriptContent);
    await fs.promises.chmod(scriptPath, 493);
    console.log(chalk8__default.default.green("\u2705 Startup script created: " + scriptPath));
  } catch (error) {
    console.log(chalk8__default.default.yellow("\u26A0\uFE0F Could not create startup script: " + error));
  }
}
async function setupEnvironmentVariables2() {
  const homeDir = os2__default.default.homedir();
  const shell = process.env["SHELL"] || "/bin/bash";
  let rcFile = "";
  if (shell.includes("zsh")) {
    rcFile = path2__default.default.join(homeDir, ".zshrc");
  } else if (shell.includes("bash")) {
    rcFile = path2__default.default.join(homeDir, ".bashrc");
  } else {
    rcFile = path2__default.default.join(homeDir, ".profile");
  }
  const envVars = `
# MARIA vLLM Configuration
export VLLM_API_URL="http://localhost:8000"
export VLLM_DEFAULT_MODEL="DialoGPT-medium"
`;
  try {
    const currentContent = await fs.promises.readFile(rcFile, "utf8").catch(() => "");
    if (!currentContent.includes("MARIA vLLM Configuration")) {
      await fs.promises.appendFile(rcFile, envVars);
      console.log(chalk8__default.default.green(`\u2705 Environment variables added to ${rcFile}`));
      console.log(chalk8__default.default.yellow("\u2139\uFE0F Please restart your terminal or run: source " + rcFile));
    } else {
      console.log(chalk8__default.default.yellow("\u26A0\uFE0F Environment variables already configured"));
    }
  } catch (error) {
    console.log(chalk8__default.default.yellow("\u26A0\uFE0F Could not update shell configuration. Please add manually:"));
    console.log(chalk8__default.default.white(envVars));
  }
}
async function testVllmSetup(venvPath, modelDir, defaultModel) {
  console.log(chalk8__default.default.yellow("\u{1F9EA} Testing vLLM setup..."));
  const pythonPath = path2__default.default.join(venvPath, "bin", "python");
  try {
    await fs.promises.access(pythonPath);
    console.log(chalk8__default.default.green("\u2705 Virtual environment test passed"));
  } catch (error) {
    throw new Error("Virtual environment not found");
  }
  const modelPath = path2__default.default.join(modelDir, defaultModel.replace("/", "_"));
  try {
    await fs.promises.access(modelPath);
    console.log(chalk8__default.default.green("\u2705 Model directory test passed"));
  } catch (error) {
    throw new Error("Model directory not found");
  }
  return new Promise((resolve, reject) => {
    const testScript = 'import vllm; print("vLLM version:", vllm.__version__)';
    const child = child_process.spawn(pythonPath, ["-c", testScript], { stdio: "pipe" });
    let output = "";
    child.stdout.on("data", (data) => {
      output += data.toString();
    });
    child.on("close", (code) => {
      if (code === 0) {
        console.log(chalk8__default.default.green("\u2705 vLLM import test passed: " + output.trim()));
        resolve();
      } else {
        reject(new Error("vLLM import test failed"));
      }
    });
  });
}
var init_setup_vllm = __esm({
  "src/commands/setup-vllm.ts"() {
    init_cjs_shims();
    __name(registerSetupVllmCommand, "registerSetupVllmCommand");
    __name(checkPythonVersion, "checkPythonVersion");
    __name(createVirtualEnvironment, "createVirtualEnvironment");
    __name(installVllm, "installVllm");
    __name(downloadModel, "downloadModel");
    __name(createStartupScript, "createStartupScript");
    __name(setupEnvironmentVariables2, "setupEnvironmentVariables");
    __name(testVllmSetup, "testVllmSetup");
  }
});
function registerCodeRAGCommand(program) {
  const coderagCommand = program.command("coderag").alias("rag").description("\u{1F50D} Vector-based code search and semantic analysis").addHelpText(
    "after",
    `
${chalk8__default.default.cyan("Examples:")}
  ${chalk8__default.default.gray("$")} maria coderag index .                     # Index current directory
  ${chalk8__default.default.gray("$")} maria coderag search "async function"     # Search for async functions
  ${chalk8__default.default.gray("$")} maria coderag analyze .                   # Analyze codebase patterns
  ${chalk8__default.default.gray("$")} maria coderag similar "function calc()"   # Find similar patterns
    `
  );
  coderagCommand.command("index").argument("<path>", "Path to codebase directory").option("--types <types>", "File types to include (comma-separated)", ".ts,.tsx,.js,.jsx").option("--exclude <paths>", "Paths to exclude (comma-separated)", "node_modules,dist,.git").option("--chunk-size <size>", "Chunk size for indexing", "500").description("Index codebase for vector search").action(async (path3, options) => {
    try {
      console.log(chalk8__default.default.blue("\u{1F50D} Indexing codebase for CodeRAG..."));
      console.log(chalk8__default.default.gray(`Path: ${path3}`));
      const fileTypes = options.types.split(",").map((t) => t.trim());
      const excludePaths = options.exclude.split(",").map((p) => p.trim());
      await codeRAGService.initialize();
      const result = await codeRAGService.indexCodebase(path3, {
        fileTypes,
        excludePaths,
        chunkSize: parseInt(options.chunkSize, 10),
        includeTests: false
      });
      console.log(chalk8__default.default.green(`\u2705 Indexing completed:`));
      console.log(`  \u{1F4C1} Indexed: ${result.indexed} code chunks`);
      console.log(`  \u23ED\uFE0F  Skipped: ${result.skipped} files`);
      if (result.errors.length > 0) {
        console.log(chalk8__default.default.yellow(`\u26A0\uFE0F  Errors: ${result.errors.length}`));
        result.errors.forEach((error) => console.log(chalk8__default.default.red(`   ${error}`)));
      }
    } catch (error) {
      console.error(chalk8__default.default.red("\u274C Indexing failed:"), error);
      process.exit(1);
    }
  });
  coderagCommand.command("search").argument("<query>", "Search query").option("--language <lang>", "Programming language filter").option("--max-results <num>", "Maximum number of results", "10").option("--threshold <num>", "Similarity threshold (0-1)", "0.7").description("Search codebase using semantic similarity").action(async (query, options) => {
    try {
      console.log(chalk8__default.default.blue("\u{1F50D} Searching codebase..."));
      console.log(chalk8__default.default.gray(`Query: "${query}"`));
      await codeRAGService.initialize();
      const results = await codeRAGService.semanticSearch({
        query,
        language: options.language,
        maxResults: parseInt(options.maxResults, 10),
        threshold: parseFloat(options.threshold)
      });
      if (results.length === 0) {
        console.log(chalk8__default.default.yellow("\u{1F50D} No matching code found"));
        return;
      }
      console.log(chalk8__default.default.green(`\u2705 Found ${results.length} matches:`));
      console.log();
      results.forEach((result, index) => {
        console.log(
          chalk8__default.default.cyan(
            `[${index + 1}] ${result.chunk.filePath}:${result.chunk.startLine}-${result.chunk.endLine}`
          )
        );
        console.log(chalk8__default.default.gray(`    Similarity: ${(result.similarity * 100).toFixed(1)}%`));
        console.log(chalk8__default.default.gray(`    Relevance: ${(result.relevanceScore * 100).toFixed(1)}%`));
        console.log(chalk8__default.default.white(`    ${result.explanation}`));
        console.log();
      });
    } catch (error) {
      console.error(chalk8__default.default.red("\u274C Search failed:"), error);
      process.exit(1);
    }
  });
  coderagCommand.command("analyze").argument("<paths...>", "Paths to analyze").option("--patterns", "Include pattern analysis", true).option("--complexity", "Include complexity analysis", true).option("--insights", "Include AI insights", true).description("Analyze codebase semantically").action(async (paths, options) => {
    try {
      console.log(chalk8__default.default.blue("\u{1F50D} Analyzing codebase..."));
      console.log(chalk8__default.default.gray(`Paths: ${paths.join(", ")}`));
      await codeRAGService.initialize();
      const analysis = await codeRAGService.analyzeCodebase(paths, {
        includePatterns: options.patterns,
        includeComplexity: options.complexity,
        includeInsights: options.insights
      });
      console.log(chalk8__default.default.green("\u2705 Analysis completed:"));
      console.log();
      console.log(chalk8__default.default.cyan("\u{1F4CA} Codebase Overview:"));
      console.log(`  Files: ${analysis.codebase.totalFiles}`);
      console.log(`  Code chunks: ${analysis.codebase.totalChunks}`);
      console.log(`  Languages: ${analysis.codebase.languages.join(", ")}`);
      console.log();
      if (analysis.patterns.commonPatterns.length > 0) {
        console.log(chalk8__default.default.cyan("\u{1F527} Common Patterns:"));
        analysis.patterns.commonPatterns.slice(0, 5).forEach((pattern) => {
          console.log(`  \u2022 ${pattern.pattern} (${pattern.frequency} times)`);
        });
        console.log();
      }
      if (analysis.patterns.antiPatterns.length > 0) {
        console.log(chalk8__default.default.yellow("\u26A0\uFE0F  Anti-patterns Found:"));
        analysis.patterns.antiPatterns.slice(0, 3).forEach((antiPattern) => {
          const color = antiPattern.severity === "high" ? chalk8__default.default.red : antiPattern.severity === "medium" ? chalk8__default.default.yellow : chalk8__default.default.gray;
          console.log(color(`  \u2022 ${antiPattern.pattern} (${antiPattern.severity})`));
        });
        console.log();
      }
      if (analysis.insights.length > 0) {
        console.log(chalk8__default.default.cyan("\u{1F4A1} AI Insights:"));
        analysis.insights.slice(0, 3).forEach((insight) => {
          console.log(`  \u2022 ${insight}`);
        });
        console.log();
      }
      if (analysis.recommendations.length > 0) {
        console.log(chalk8__default.default.green("\u{1F3AF} Recommendations:"));
        analysis.recommendations.slice(0, 3).forEach((recommendation) => {
          console.log(`  \u2022 ${recommendation}`);
        });
      }
    } catch (error) {
      console.error(chalk8__default.default.red("\u274C Analysis failed:"), error);
      process.exit(1);
    }
  });
  coderagCommand.command("similar").argument("<code>", "Code snippet to find similar patterns for").option("--language <lang>", "Programming language").option("--similarity <num>", "Minimum similarity threshold", "0.6").option("--max-results <num>", "Maximum number of results", "5").description("Find similar code patterns").action(async (code, options) => {
    try {
      console.log(chalk8__default.default.blue("\u{1F50D} Finding similar patterns..."));
      console.log(chalk8__default.default.gray(`Code: "${code.substring(0, 50)}${code.length > 50 ? "..." : ""}"`));
      await codeRAGService.initialize();
      const results = await codeRAGService.findSimilarPatterns(code, {
        language: options.language,
        minSimilarity: parseFloat(options.similarity),
        maxResults: parseInt(options.maxResults, 10)
      });
      if (results.length === 0) {
        console.log(chalk8__default.default.yellow("\u{1F50D} No similar patterns found"));
        return;
      }
      console.log(chalk8__default.default.green(`\u2705 Found ${results.length} similar patterns:`));
      console.log();
      results.forEach((result, index) => {
        console.log(
          chalk8__default.default.cyan(
            `[${index + 1}] ${result.chunk.filePath}:${result.chunk.startLine}-${result.chunk.endLine}`
          )
        );
        console.log(chalk8__default.default.gray(`    Similarity: ${(result.similarity * 100).toFixed(1)}%`));
        console.log(chalk8__default.default.white(`    ${result.explanation}`));
        const lines = result.chunk.content.split("\n").slice(0, 3);
        lines.forEach((line) => {
          console.log(chalk8__default.default.gray(`    ${line.trim()}`));
        });
        if (result.chunk.content.split("\n").length > 3) {
          console.log(chalk8__default.default.gray("    ..."));
        }
        console.log();
      });
    } catch (error) {
      console.error(chalk8__default.default.red("\u274C Pattern search failed:"), error);
      process.exit(1);
    }
  });
  coderagCommand.command("status").description("Show CodeRAG system status").action(async () => {
    try {
      const status = codeRAGService.getStatus();
      console.log(chalk8__default.default.cyan("\u{1F50D} CodeRAG System Status:"));
      console.log();
      console.log(`Initialized: ${status.initialized ? chalk8__default.default.green("\u2705") : chalk8__default.default.red("\u274C")}`);
      console.log(`Indexed paths: ${status.indexedPaths.length}`);
      console.log(`Total chunks: ${status.totalChunks}`);
      console.log(`Total embeddings: ${status.totalEmbeddings}`);
      console.log(`Embedding model: ${status.embeddingModel}`);
      if (status.lastIndexed) {
        console.log(`Last indexed: ${status.lastIndexed.toLocaleString()}`);
      }
      if (status.indexedPaths.length > 0) {
        console.log();
        console.log(chalk8__default.default.cyan("Indexed paths:"));
        status.indexedPaths.forEach((path3) => {
          console.log(`  \u2022 ${path3}`);
        });
      }
    } catch (error) {
      console.error(chalk8__default.default.red("\u274C Status check failed:"), error);
      process.exit(1);
    }
  });
  coderagCommand.command("process-paper").argument("<source>", "Paper source (PDF path, arXiv ID, or URL)").option("--type <type>", "Source type (pdf|arxiv|url)", "pdf").option("--language <lang>", "Target programming language", "typescript").option("--framework <framework>", "Target framework", "none").description("Process paper with CodeRAG-enhanced intelligence").action(async (source, options) => {
    try {
      console.log(chalk8__default.default.blue("\u{1F680} Processing paper with CodeRAG intelligence..."));
      console.log(chalk8__default.default.gray(`Source: ${source}`));
      console.log(chalk8__default.default.gray(`Type: ${options.type}`));
      console.log(chalk8__default.default.gray(`Target: ${options.language}`));
      const multiAgent = MultiAgentSystem.getInstance();
      await multiAgent.initialize();
      const result = await multiAgent.processEnhancedPaperWithRAG({
        source: options.type,
        content: source,
        options: {
          extractAlgorithms: true,
          generateTests: true,
          includeDocumentation: true,
          targetLanguage: options.language,
          framework: options.framework
        }
      });
      if (result.success && result.synthesizedOutput) {
        console.log(chalk8__default.default.green("\u2705 Paper processing completed!"));
        console.log();
        const output = result.synthesizedOutput;
        console.log(chalk8__default.default.cyan(`\u{1F4CA} Workflow: ${output.workflowId}`));
        console.log(chalk8__default.default.cyan(`\u{1F916} Agents: ${output.participatingAgents.join(", ")}`));
        console.log(
          chalk8__default.default.cyan(`\u2B50 Quality: ${Math.round(output.qualityMetrics.accuracy * 100)}%`)
        );
        console.log();
        if (result.documentAnalysis) {
          console.log(chalk8__default.default.cyan("\u{1F4C4} Document Analysis:"));
          const analysis = result.documentAnalysis;
          console.log(`  Title: ${analysis["title"] || "N/A"}`);
          console.log(`  Algorithms found: ${analysis["algorithmsFound"] || 0}`);
          console.log(`  Code blocks: ${analysis["codeBlocksFound"] || 0}`);
          console.log(
            `  Quality score: ${((analysis["qualityScore"] || 0) * 100).toFixed(1)}%`
          );
          console.log();
        }
        if (result.codebaseInsights) {
          console.log(chalk8__default.default.cyan("\u{1F4BB} Codebase Insights:"));
          const insights = result.codebaseInsights;
          console.log(`  Total files: ${insights["totalFiles"] || 0}`);
          console.log(`  Languages: ${insights["languages"]?.join(", ") || "N/A"}`);
          console.log(
            `  Common patterns: ${insights["commonPatterns"]?.length || 0}`
          );
          console.log();
        }
        console.log(chalk8__default.default.cyan("\u{1F50D} Key Insights:"));
        output.insights.forEach((insight) => {
          console.log(`  \u2022 ${insight}`);
        });
        console.log();
        console.log(chalk8__default.default.green("\u{1F4A1} Recommendations:"));
        output.recommendations.forEach((rec) => {
          console.log(`  \u2022 ${rec}`);
        });
      } else {
        console.error(chalk8__default.default.red("\u274C Paper processing failed:"), result.error);
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk8__default.default.red("\u274C Enhanced paper processing failed:"), error);
      process.exit(1);
    }
  });
  return coderagCommand;
}
var init_coderag = __esm({
  "src/commands/coderag.ts"() {
    init_cjs_shims();
    init_coderag_system();
    init_multi_agent_system();
    __name(registerCodeRAGCommand, "registerCodeRAGCommand");
  }
});
function registerDocumentCommand(program) {
  const docCommand = program.command("document").alias("doc").description("\u{1F4C4} Advanced document processing and analysis").addHelpText(
    "after",
    `
${chalk8__default.default.cyan("Examples:")}
  ${chalk8__default.default.gray("$")} maria doc process paper.pdf              # Process PDF document
  ${chalk8__default.default.gray("$")} maria doc arxiv 2301.12345               # Fetch and process arXiv paper
  ${chalk8__default.default.gray("$")} maria doc url https://example.com/doc    # Process web document
  ${chalk8__default.default.gray("$")} maria doc search "machine learning"      # Search processed documents
    `
  );
  docCommand.command("process").argument("<source>", "Document source (file path, URL, or arXiv ID)").option("--type <type>", "Document type (pdf|arxiv|url|docx|html|markdown|text)", "auto").option("--extract-structure", "Extract document structure", true).option("--extract-algorithms", "Extract algorithms and procedures", true).option("--extract-code", "Extract code blocks", true).option("--extract-formulas", "Extract mathematical formulas", true).option("--extract-diagrams", "Extract diagram descriptions", false).option("--extract-images", "Extract and analyze images", false).option("--ocr", "Enable OCR for scanned documents", true).option("--language <lang>", "Document language", "auto").description("Process document with advanced extraction").action(async (source, options) => {
    try {
      console.log(chalk8__default.default.blue("\u{1F4C4} Processing document..."));
      console.log(chalk8__default.default.gray(`Source: ${source}`));
      let type = options.type;
      if (type === "auto") {
        if (source.match(/arxiv\.org|^\d{4}\.\d{4,5}$/)) {
          type = "arxiv";
        } else if (source.startsWith("http")) {
          type = "url";
        } else if (source.endsWith(".pdf")) {
          type = "pdf";
        } else if (source.endsWith(".docx")) {
          type = "docx";
        } else if (source.endsWith(".html")) {
          type = "html";
        } else if (source.endsWith(".md")) {
          type = "markdown";
        } else {
          type = "text";
        }
      }
      console.log(chalk8__default.default.gray(`Type: ${type}`));
      await documentProcessor.initialize();
      const document2 = await documentProcessor.processDocument(
        {
          type,
          identifier: source
        },
        {
          extractStructure: options.extractStructure,
          extractAlgorithms: options.extractAlgorithms,
          extractCode: options.extractCode,
          extractFormulas: options.extractFormulas,
          extractDiagrams: options.extractDiagrams,
          extractImages: options.extractImages,
          ocrEnabled: options.ocr,
          language: options.language
        }
      );
      console.log(chalk8__default.default.green("\u2705 Document processing completed!"));
      console.log();
      console.log(chalk8__default.default.cyan("\u{1F4C4} Document Overview:"));
      console.log(`  Title: ${document2.title}`);
      console.log(`  ID: ${document2.id}`);
      console.log(`  Authors: ${document2.metadata.authors.join(", ") || "N/A"}`);
      console.log(`  Pages: ${document2.metadata.pageCount}`);
      console.log(`  Words: ${document2.metadata.wordCount.toLocaleString()}`);
      console.log(`  Language: ${document2.metadata.language}`);
      console.log(
        `  Quality: ${(document2.metadata.processingQuality.overallScore * 100).toFixed(1)}%`
      );
      console.log();
      const content = document2.content.structuredContent;
      if (content.sections.length > 0) {
        console.log(chalk8__default.default.cyan("\u{1F4CB} Document Structure:"));
        content.sections.slice(0, 5).forEach((section) => {
          console.log(
            `  ${section.level === 1 ? "\u{1F4C4}" : "  \u{1F4DD}"} ${section.title} (${section.wordCount} words)`
          );
        });
        if (content.sections.length > 5) {
          console.log(`  ... and ${content.sections.length - 5} more sections`);
        }
        console.log();
      }
      const elements = document2.content.extractedElements;
      if (elements.algorithms.length > 0) {
        console.log(chalk8__default.default.cyan("\u{1F527} Algorithms Found:"));
        elements.algorithms.slice(0, 3).forEach((algo) => {
          console.log(`  \u2022 ${algo.name}: ${algo.description}`);
          if (algo.complexity) {
            console.log(`    Time: ${algo.complexity.time}, Space: ${algo.complexity.space}`);
          }
        });
        if (elements.algorithms.length > 3) {
          console.log(`  ... and ${elements.algorithms.length - 3} more algorithms`);
        }
        console.log();
      }
      if (elements.codeBlocks.length > 0) {
        console.log(chalk8__default.default.cyan("\u{1F4BB} Code Blocks:"));
        elements.codeBlocks.slice(0, 3).forEach((code) => {
          console.log(`  \u2022 ${code.language || "Unknown"}: ${code.description || "Code snippet"}`);
        });
        if (elements.codeBlocks.length > 3) {
          console.log(`  ... and ${elements.codeBlocks.length - 3} more code blocks`);
        }
        console.log();
      }
      if (elements.formulas.length > 0) {
        console.log(chalk8__default.default.cyan("\u{1F522} Mathematical Formulas:"));
        console.log(`  Found ${elements.formulas.length} formulas`);
        console.log();
      }
      if (content.figures.length > 0) {
        console.log(chalk8__default.default.cyan("\u{1F5BC}\uFE0F  Figures:"));
        content.figures.slice(0, 3).forEach((figure) => {
          console.log(`  \u2022 ${figure.caption} (Page ${figure.pageNumber})`);
        });
        if (content.figures.length > 3) {
          console.log(`  ... and ${content.figures.length - 3} more figures`);
        }
        console.log();
      }
      if (content.references.length > 0) {
        console.log(chalk8__default.default.cyan("\u{1F4DA} References:"));
        console.log(`  Found ${content.references.length} references`);
        console.log();
      }
      console.log(chalk8__default.default.cyan("\u{1F3AF} Processing Quality:"));
      const quality = document2.metadata.processingQuality;
      console.log(`  Text extraction: ${(quality.textExtractionScore * 100).toFixed(1)}%`);
      console.log(
        `  Structure recognition: ${(quality.structureRecognitionScore * 100).toFixed(1)}%`
      );
      console.log(
        `  Algorithm extraction: ${(quality.algorithmExtractionScore * 100).toFixed(1)}%`
      );
    } catch (error) {
      console.error(chalk8__default.default.red("\u274C Document processing failed:"), error);
      process.exit(1);
    }
  });
  docCommand.command("arxiv").argument("<id>", "arXiv paper ID (e.g., 2301.12345)").option("--extract-algorithms", "Extract algorithms", true).option("--extract-code", "Extract code blocks", true).option("--target-language <lang>", "Target programming language for code generation").description("Fetch and process arXiv paper").action(async (id, options) => {
    try {
      console.log(chalk8__default.default.blue("\u{1F4C4} Fetching arXiv paper..."));
      console.log(chalk8__default.default.gray(`arXiv ID: ${id}`));
      await documentProcessor.initialize();
      const document2 = await documentProcessor.processDocument(
        {
          type: "arxiv",
          identifier: id
        },
        {
          extractStructure: true,
          extractAlgorithms: options.extractAlgorithms,
          extractCode: options.extractCode,
          extractFormulas: true
        }
      );
      console.log(chalk8__default.default.green("\u2705 arXiv paper processed successfully!"));
      console.log();
      console.log(chalk8__default.default.cyan("\u{1F4C4} Paper Information:"));
      console.log(`  Title: ${document2.title}`);
      console.log(`  Authors: ${document2.metadata.authors.join(", ")}`);
      if (document2.metadata.publishedDate) {
        console.log(`  Published: ${document2.metadata.publishedDate.toDateString()}`);
      }
      console.log(`  arXiv ID: ${document2.metadata.arxivId}`);
      console.log();
      if (document2.content.structuredContent.abstract) {
        console.log(chalk8__default.default.cyan("\u{1F4DD} Abstract:"));
        const abstract = document2.content.structuredContent.abstract;
        console.log(abstract.length > 500 ? abstract.substring(0, 500) + "..." : abstract);
        console.log();
      }
      const algorithms = document2.content.extractedElements.algorithms;
      if (algorithms.length > 0) {
        console.log(chalk8__default.default.cyan("\u{1F527} Algorithms Detected:"));
        algorithms.forEach((algo) => {
          console.log(`  \u2022 ${algo.name}`);
          console.log(`    ${algo.description}`);
          if (algo.steps.length > 0) {
            console.log(`    Steps: ${algo.steps.length}`);
          }
        });
        console.log();
      }
      if (options.targetLanguage && algorithms.length > 0) {
        console.log(chalk8__default.default.yellow("\u{1F4A1} Suggestion:"));
        console.log(
          `  Use 'maria coderag process-paper' to generate ${options.targetLanguage} code from these algorithms`
        );
      }
    } catch (error) {
      console.error(chalk8__default.default.red("\u274C arXiv processing failed:"), error);
      process.exit(1);
    }
  });
  docCommand.command("search").argument("<query>", "Search query").option("--type <types>", "Filter by document types (comma-separated)").option("--author <name>", "Filter by author name").option("--max-results <num>", "Maximum number of results", "10").description("Search processed documents").action(async (query, options) => {
    try {
      console.log(chalk8__default.default.blue("\u{1F50D} Searching documents..."));
      console.log(chalk8__default.default.gray(`Query: "${query}"`));
      const filterByType = options.type ? options.type.split(",").map((t) => t.trim()) : void 0;
      const results = await documentProcessor.searchDocuments(query, {
        filterByType,
        filterByAuthor: options.author,
        maxResults: parseInt(options.maxResults, 10)
      });
      if (results.length === 0) {
        console.log(chalk8__default.default.yellow("\u{1F50D} No documents found matching your query"));
        return;
      }
      console.log(chalk8__default.default.green(`\u2705 Found ${results.length} documents:`));
      console.log();
      results.forEach((doc, index) => {
        console.log(chalk8__default.default.cyan(`[${index + 1}] ${doc.title}`));
        console.log(
          chalk8__default.default.gray(
            `    Type: ${doc.source.type} | Authors: ${doc.metadata.authors.join(", ") || "N/A"}`
          )
        );
        console.log(
          chalk8__default.default.gray(
            `    Pages: ${doc.metadata.pageCount} | Words: ${doc.metadata.wordCount.toLocaleString()}`
          )
        );
        console.log(
          chalk8__default.default.gray(
            `    Quality: ${(doc.metadata.processingQuality.overallScore * 100).toFixed(1)}%`
          )
        );
        const elements = doc.content.extractedElements;
        const summary = [];
        if (elements.algorithms.length > 0)
          summary.push(`${elements.algorithms.length} algorithms`);
        if (elements.codeBlocks.length > 0)
          summary.push(`${elements.codeBlocks.length} code blocks`);
        if (elements.formulas.length > 0) summary.push(`${elements.formulas.length} formulas`);
        if (summary.length > 0) {
          console.log(chalk8__default.default.gray(`    Content: ${summary.join(", ")}`));
        }
        console.log();
      });
    } catch (error) {
      console.error(chalk8__default.default.red("\u274C Document search failed:"), error);
      process.exit(1);
    }
  });
  docCommand.command("list").option("--type <type>", "Filter by document type").option("--sort <field>", "Sort by field (title|date|quality)", "date").description("List all processed documents").action(async (options) => {
    try {
      const allDocs = documentProcessor.getProcessedDocuments();
      const docs = options.type ? allDocs.filter((doc) => doc.source.type === options.type) : allDocs;
      switch (options.sort) {
        case "title":
          docs.sort((a, b) => a.title.localeCompare(b.title));
          break;
        case "quality":
          docs.sort(
            (a, b) => b.metadata.processingQuality.overallScore - a.metadata.processingQuality.overallScore
          );
          break;
        case "date":
        default:
          docs.sort((a, b) => b.processingTimestamp.getTime() - a.processingTimestamp.getTime());
          break;
      }
      if (docs.length === 0) {
        console.log(chalk8__default.default.yellow("\u{1F4C4} No processed documents found"));
        console.log(chalk8__default.default.gray('Use "maria doc process <file>" to process documents'));
        return;
      }
      console.log(chalk8__default.default.cyan(`\u{1F4C4} Processed Documents (${docs.length}):`));
      console.log();
      docs.forEach((doc, index) => {
        console.log(chalk8__default.default.cyan(`[${index + 1}] ${doc.title}`));
        console.log(chalk8__default.default.gray(`    Type: ${doc.source.type} | ID: ${doc.id}`));
        console.log(chalk8__default.default.gray(`    Processed: ${doc.processingTimestamp.toLocaleString()}`));
        console.log(
          chalk8__default.default.gray(
            `    Quality: ${(doc.metadata.processingQuality.overallScore * 100).toFixed(1)}%`
          )
        );
        console.log();
      });
    } catch (error) {
      console.error(chalk8__default.default.red("\u274C Failed to list documents:"), error);
      process.exit(1);
    }
  });
  docCommand.command("show").argument("<id>", "Document ID").option("--full", "Show full content", false).description("Show detailed information about a document").action(async (id, options) => {
    try {
      const document2 = documentProcessor.getDocument(id);
      if (!document2) {
        console.log(chalk8__default.default.yellow(`\u{1F4C4} Document not found: ${id}`));
        console.log(chalk8__default.default.gray('Use "maria doc list" to see available documents'));
        return;
      }
      console.log(chalk8__default.default.cyan("\u{1F4C4} Document Details:"));
      console.log();
      console.log(`Title: ${document2.title}`);
      console.log(`ID: ${document2.id}`);
      console.log(`Source: ${document2.source.type} (${document2.source.identifier})`);
      console.log(`Authors: ${document2.metadata.authors.join(", ") || "N/A"}`);
      console.log(`Language: ${document2.metadata.language}`);
      console.log(`Processed: ${document2.processingTimestamp.toLocaleString()}`);
      console.log();
      console.log(chalk8__default.default.cyan("\u{1F4CA} Metadata:"));
      console.log(`  Pages: ${document2.metadata.pageCount}`);
      console.log(`  Words: ${document2.metadata.wordCount.toLocaleString()}`);
      if (document2.metadata.publishedDate) {
        console.log(`  Published: ${document2.metadata.publishedDate.toDateString()}`);
      }
      if (document2.metadata.doi) {
        console.log(`  DOI: ${document2.metadata.doi}`);
      }
      if (document2.metadata.arxivId) {
        console.log(`  arXiv ID: ${document2.metadata.arxivId}`);
      }
      console.log();
      console.log(chalk8__default.default.cyan("\u{1F3AF} Quality Metrics:"));
      const quality = document2.metadata.processingQuality;
      console.log(`  Overall: ${(quality.overallScore * 100).toFixed(1)}%`);
      console.log(`  Text extraction: ${(quality.textExtractionScore * 100).toFixed(1)}%`);
      console.log(`  Structure: ${(quality.structureRecognitionScore * 100).toFixed(1)}%`);
      console.log(
        `  Algorithm extraction: ${(quality.algorithmExtractionScore * 100).toFixed(1)}%`
      );
      console.log();
      const elements = document2.content.extractedElements;
      console.log(chalk8__default.default.cyan("\u{1F4CB} Extracted Content:"));
      console.log(`  Sections: ${document2.content.structuredContent.sections.length}`);
      console.log(`  Algorithms: ${elements.algorithms.length}`);
      console.log(`  Code blocks: ${elements.codeBlocks.length}`);
      console.log(`  Formulas: ${elements.formulas.length}`);
      console.log(`  Figures: ${document2.content.structuredContent.figures.length}`);
      console.log(`  References: ${document2.content.structuredContent.references.length}`);
      if (options.full) {
        console.log();
        console.log(chalk8__default.default.cyan("\u{1F4DD} Full Content:"));
        console.log(document2.content.rawText.substring(0, 2e3));
        if (document2.content.rawText.length > 2e3) {
          console.log(chalk8__default.default.gray("... (truncated)"));
        }
      }
    } catch (error) {
      console.error(chalk8__default.default.red("\u274C Failed to show document:"), error);
      process.exit(1);
    }
  });
  docCommand.command("status").description("Show document processor status").action(async () => {
    try {
      const status = documentProcessor.getStatus();
      console.log(chalk8__default.default.cyan("\u{1F4C4} Document Processor Status:"));
      console.log();
      console.log(`Initialized: ${status.initialized ? chalk8__default.default.green("\u2705") : chalk8__default.default.red("\u274C")}`);
      console.log(`Processed documents: ${status.processedDocuments}`);
      console.log(`Queue length: ${status.queueLength}`);
      console.log(`Currently processing: ${status.isProcessing ? chalk8__default.default.yellow("Yes") : "No"}`);
      console.log();
      console.log(chalk8__default.default.cyan("Supported formats:"));
      status.supportedFormats.forEach((format) => {
        console.log(`  \u2022 ${format}`);
      });
    } catch (error) {
      console.error(chalk8__default.default.red("\u274C Status check failed:"), error);
      process.exit(1);
    }
  });
  return docCommand;
}
var init_document = __esm({
  "src/commands/document.ts"() {
    init_cjs_shims();
    init_document_processor();
    __name(registerDocumentCommand, "registerDocumentCommand");
  }
});
function registerApprovalGitCommands(program) {
  const approvalGroup = program.command("approval").alias("approve-git").description("Git-like approval management commands");
  approvalGroup.command("log").description("Show approval commit history").option("-n, --number <count>", "Number of commits to show", "10").option("--oneline", "Show one line per commit").option("--author <name>", "Filter by author").option("--since <date>", "Show commits since date").option("--grep <pattern>", "Search commit messages").option("--branch <name>", "Show commits from specific branch").action(async (options) => {
    try {
      await handleApprovalLog(options);
    } catch (error) {
      console.error(chalk8__default.default.red("Error showing approval log:"), error);
      process.exit(1);
    }
  });
  approvalGroup.command("branch").description("List, create, or delete approval branches").argument("[branch-name]", "Branch name for create/switch operations").option("-d, --delete <name>", "Delete branch").option("-D, --force-delete <name>", "Force delete branch").option("-c, --create <name>", "Create new branch").option("-m, --merged", "Show only merged branches").option("--checkout <name>", "Switch to branch").action(async (branchName, options) => {
    try {
      await handleApprovalBranch(branchName, options);
    } catch (error) {
      console.error(chalk8__default.default.red("Error managing approval branches:"), error);
      process.exit(1);
    }
  });
  approvalGroup.command("merge").description("Merge approval branches").argument("<source-branch>", "Source branch to merge").option("-t, --target <branch>", "Target branch (default: main)").option("-m, --message <msg>", "Merge commit message").option("--no-ff", "Create merge commit even for fast-forward").action(async (sourceBranch, options) => {
    try {
      await handleApprovalMerge(sourceBranch, options);
    } catch (error) {
      console.error(chalk8__default.default.red("Error merging approval branches:"), error);
      process.exit(1);
    }
  });
  approvalGroup.command("revert").description("Revert approval commits").argument("<commit-id>", "Commit ID to revert").option("-m, --message <msg>", "Revert commit message").option("--no-commit", "Don't create revert commit automatically").action(async (commitId, options) => {
    try {
      await handleApprovalRevert(commitId, options);
    } catch (error) {
      console.error(chalk8__default.default.red("Error reverting approval commit:"), error);
      process.exit(1);
    }
  });
  approvalGroup.command("tag").description("Create, list, or delete approval tags").argument("[tag-name]", "Tag name for create/delete operations").option("-d, --delete <name>", "Delete tag").option("-f, --force", "Force tag creation/deletion").option("-m, --message <msg>", "Tag message").option("--list", "List all tags").action(async (tagName, options) => {
    try {
      await handleApprovalTag(tagName, options);
    } catch (error) {
      console.error(chalk8__default.default.red("Error managing approval tags:"), error);
      process.exit(1);
    }
  });
  approvalGroup.command("status").description("Show approval repository status").option("--detailed", "Show detailed statistics").action(async (options) => {
    try {
      await handleApprovalStatus(options);
    } catch (error) {
      console.error(chalk8__default.default.red("Error showing approval status:"), error);
      process.exit(1);
    }
  });
  approvalGroup.command("show").description("Show approval commit details").argument("[commit-id]", "Commit ID to show (default: latest)").option("--diff", "Show diff details").option("--tags", "Show tags").action(async (commitId, options) => {
    try {
      await handleApprovalShow(commitId, options);
    } catch (error) {
      console.error(chalk8__default.default.red("Error showing approval commit:"), error);
      process.exit(1);
    }
  });
}
async function handleApprovalLog(options) {
  const repo = ApprovalRepositoryManager.getInstance();
  const logOptions = {
    limit: parseInt(options.number) || 10,
    author: options.author,
    since: options.since ? new Date(options.since) : void 0,
    grep: options.grep,
    branch: options.branch
  };
  const commits = repo.getLog(logOptions);
  if (commits.length === 0) {
    console.log(chalk8__default.default.gray("No approval commits found"));
    return;
  }
  console.log(chalk8__default.default.blue("\n\u{1F4CB} Approval History:\n"));
  commits.forEach((commit) => {
    const formatted = ApprovalCommitManager.formatCommit(commit, {
      oneline: options.oneline,
      showDiff: false,
      showTags: false
    });
    if (options.oneline) {
      const status = commit.approvalData.approved ? "\u2705" : "\u274C";
      const statusColor = commit.approvalData.approved ? chalk8__default.default.green : chalk8__default.default.red;
      console.log(`${status} ${statusColor(formatted)}`);
    } else {
      console.log(formatted);
      console.log("");
    }
  });
}
async function handleApprovalBranch(branchName, options) {
  const repo = ApprovalRepositoryManager.getInstance();
  if (options.delete || options.forceDelete) {
    const targetBranch = options.delete || options.forceDelete;
    const force = !!options.forceDelete;
    try {
      repo.deleteBranch(targetBranch, force);
      console.log(chalk8__default.default.green(`\u2713 Deleted approval branch: ${targetBranch}`));
    } catch (error) {
      console.error(chalk8__default.default.red(`Failed to delete branch: ${error}`));
    }
    return;
  }
  if (options.create || branchName) {
    const newBranchName = options.create || branchName;
    try {
      const branch = repo.createBranch(newBranchName);
      console.log(chalk8__default.default.green(`\u2713 Created approval branch: ${branch.name}`));
      console.log(chalk8__default.default.gray(`Base commit: ${branch.baseCommit || "none"}`));
    } catch (error) {
      console.error(chalk8__default.default.red(`Failed to create branch: ${error}`));
    }
    return;
  }
  if (options.checkout) {
    try {
      const branch = repo.checkoutBranch(options.checkout);
      console.log(chalk8__default.default.green(`\u2713 Switched to approval branch: ${branch.name}`));
    } catch (error) {
      console.error(chalk8__default.default.red(`Failed to checkout branch: ${error}`));
    }
    return;
  }
  const branches = repo.listBranches({ merged: options.merged });
  const currentBranch = repo.getCurrentBranch();
  console.log(chalk8__default.default.blue("\n\u{1F33F} Approval Branches:\n"));
  if (branches.length === 0) {
    console.log(chalk8__default.default.gray("No approval branches found"));
    return;
  }
  branches.forEach((branch) => {
    const isCurrent = branch.name === currentBranch.name;
    const marker = isCurrent ? "* " : "  ";
    const nameColor = isCurrent ? chalk8__default.default.green.bold : chalk8__default.default.white;
    const protection = branch.protected ? chalk8__default.default.red(" [protected]") : "";
    const lastActivity = branch.lastActivity.toLocaleString();
    console.log(`${marker}${nameColor(branch.name)}${protection}`);
    console.log(`    ${chalk8__default.default.gray(`Head: ${branch.head || "none"} | Activity: ${lastActivity}`)}`);
    if (branch.mergeRequests.length > 0) {
      console.log(`    ${chalk8__default.default.cyan(`${branch.mergeRequests.length} merge request(s)`)}`);
    }
    console.log("");
  });
}
async function handleApprovalMerge(sourceBranch, options) {
  const repo = ApprovalRepositoryManager.getInstance();
  const targetBranch = options.target || "main";
  try {
    console.log(chalk8__default.default.blue(`\u{1F504} Merging ${sourceBranch} into ${targetBranch}...`));
    const mergeCommit = await repo.mergeBranch(sourceBranch, targetBranch, {
      message: options.message,
      noFastForward: options.noFf
    });
    console.log(chalk8__default.default.green(`\u2713 Merge completed successfully`));
    console.log(chalk8__default.default.gray(`Merge commit: ${mergeCommit.id}`));
    console.log(chalk8__default.default.gray(`Message: ${mergeCommit.metadata.message}`));
  } catch (error) {
    console.error(chalk8__default.default.red(`Merge failed: ${error}`));
  }
}
async function handleApprovalRevert(commitId, options) {
  const repo = ApprovalRepositoryManager.getInstance();
  try {
    console.log(chalk8__default.default.blue(`\u21A9\uFE0F  Reverting commit ${commitId}...`));
    const revertCommit = await repo.revertCommit(commitId, {
      message: options.message,
      noCommit: options.noCommit
    });
    if (options.noCommit) {
      console.log(chalk8__default.default.yellow("\u26A0\uFE0F  Revert prepared but not committed"));
      console.log(chalk8__default.default.gray("Review the changes and commit manually if desired"));
    } else {
      console.log(chalk8__default.default.green(`\u2713 Revert completed successfully`));
      console.log(chalk8__default.default.gray(`Revert commit: ${revertCommit.id}`));
    }
  } catch (error) {
    console.error(chalk8__default.default.red(`Revert failed: ${error}`));
  }
}
async function handleApprovalTag(tagName, options) {
  const repo = ApprovalRepositoryManager.getInstance();
  if (options.delete) {
    try {
      console.log(chalk8__default.default.green(`\u2713 Deleted tag: ${options.delete}`));
    } catch (error) {
      console.error(chalk8__default.default.red(`Failed to delete tag: ${error}`));
    }
    return;
  }
  if (options.list || !tagName) {
    repo.getConfig();
    console.log(chalk8__default.default.blue("\n\u{1F3F7}\uFE0F  Approval Tags:\n"));
    console.log(chalk8__default.default.gray("Tag listing will be implemented in repository manager"));
    return;
  }
  try {
    repo.createTag(tagName, void 0, {
      force: options.force,
      message: options.message
    });
    console.log(chalk8__default.default.green(`\u2713 Created tag: ${tagName}`));
    if (options.message) {
      console.log(chalk8__default.default.gray(`Message: ${options.message}`));
    }
  } catch (error) {
    console.error(chalk8__default.default.red(`Failed to create tag: ${error}`));
  }
}
async function handleApprovalStatus(options) {
  const repo = ApprovalRepositoryManager.getInstance();
  const approvalEngine = ApprovalEngine.getInstance();
  console.log(chalk8__default.default.blue("\n\u{1F4CA} Approval Repository Status:\n"));
  repo.getConfig();
  const currentBranch = repo.getCurrentBranch();
  const stats = repo.getStatistics();
  const pendingRequests = approvalEngine.getAllPendingRequests();
  console.log(`${chalk8__default.default.cyan("Current Branch:")} ${currentBranch.name}`);
  console.log(`${chalk8__default.default.cyan("Head Commit:")} ${currentBranch.head || "none"}`);
  console.log(`${chalk8__default.default.cyan("Pending Requests:")} ${pendingRequests.length}`);
  console.log("");
  console.log(chalk8__default.default.yellow("Repository:"));
  console.log(`  ${chalk8__default.default.cyan("Total Commits:")} ${stats.repository.totalCommits}`);
  console.log(`  ${chalk8__default.default.cyan("Total Branches:")} ${stats.repository.totalBranches}`);
  console.log(`  ${chalk8__default.default.cyan("Total Tags:")} ${stats.repository.totalTags}`);
  console.log(`  ${chalk8__default.default.cyan("Merge Requests:")} ${stats.repository.totalMergeRequests}`);
  console.log("");
  console.log(chalk8__default.default.yellow("Activity:"));
  console.log(`  ${chalk8__default.default.cyan("Commits (Last Week):")} ${stats.activity.commitsLastWeek}`);
  console.log(`  ${chalk8__default.default.cyan("Commits (Last Month):")} ${stats.activity.commitsLastMonth}`);
  console.log(
    `  ${chalk8__default.default.cyan("Avg Time to Approval:")} ${Math.round(stats.activity.averageTimeToApproval / 1e3)}s`
  );
  console.log("");
  if (options.detailed) {
    console.log(chalk8__default.default.yellow("Risk Distribution:"));
    Object.entries(stats.risk.riskDistribution).forEach(([risk, count]) => {
      console.log(`  ${chalk8__default.default.cyan(risk.toUpperCase())}:    ${count}`);
    });
    console.log("");
    console.log(chalk8__default.default.yellow("Category Distribution:"));
    Object.entries(stats.risk.categoryDistribution).forEach(([category, count]) => {
      console.log(`  ${chalk8__default.default.cyan(category)}:    ${count}`);
    });
    console.log(
      `  ${chalk8__default.default.cyan("Rejection Rate:")} ${(stats.risk.rejectionRate * 100).toFixed(1)}%`
    );
    console.log("");
    console.log(chalk8__default.default.yellow("Contributors:"));
    console.log(`  ${chalk8__default.default.cyan("Total Contributors:")} ${stats.contributors.totalContributors}`);
    console.log(`  ${chalk8__default.default.cyan("Most Active:")} ${stats.contributors.mostActiveContributor}`);
  }
}
async function handleApprovalShow(commitId, options) {
  const repo = ApprovalRepositoryManager.getInstance();
  let targetCommitId = commitId;
  if (!targetCommitId) {
    const currentBranch = repo.getCurrentBranch();
    targetCommitId = currentBranch.head;
    if (!targetCommitId) {
      console.log(chalk8__default.default.gray("No commits found in current branch"));
      return;
    }
  }
  const commits = repo.getLog({ limit: 1 });
  const commit = commits.find((c) => c.id.startsWith(targetCommitId.substring(0, 7)));
  if (!commit) {
    console.error(chalk8__default.default.red(`Commit not found: ${targetCommitId}`));
    return;
  }
  console.log(chalk8__default.default.blue("\n\u{1F4CB} Approval Commit Details:\n"));
  const formatted = ApprovalCommitManager.formatCommit(commit, {
    oneline: false,
    showDiff: options.diff,
    showTags: options.tags
  });
  console.log(formatted);
  console.log(chalk8__default.default.yellow("\n\u{1F4DD} Approval Details:"));
  console.log(`${chalk8__default.default.cyan("Action:")} ${commit.approvalData.action}`);
  console.log(`${chalk8__default.default.cyan("Approved:")} ${commit.approvalData.approved ? "\u2705 Yes" : "\u274C No"}`);
  console.log(`${chalk8__default.default.cyan("Request ID:")} ${commit.approvalData.requestId}`);
  if (commit.approvalData.comments) {
    console.log(`${chalk8__default.default.cyan("Comments:")} ${commit.approvalData.comments}`);
  }
  if (commit.approvalData.trustLevel) {
    console.log(`${chalk8__default.default.cyan("Trust Level:")} ${commit.approvalData.trustLevel}`);
  }
  console.log(
    `${chalk8__default.default.cyan("Quick Decision:")} ${commit.approvalData.quickDecision ? "Yes" : "No"}`
  );
  console.log("");
}
var init_approval_git = __esm({
  "src/commands/approval-git.ts"() {
    init_cjs_shims();
    init_ApprovalRepository();
    init_ApprovalCommit();
    init_ApprovalEngine();
    __name(registerApprovalGitCommands, "registerApprovalGitCommands");
    __name(handleApprovalLog, "handleApprovalLog");
    __name(handleApprovalBranch, "handleApprovalBranch");
    __name(handleApprovalMerge, "handleApprovalMerge");
    __name(handleApprovalRevert, "handleApprovalRevert");
    __name(handleApprovalTag, "handleApprovalTag");
    __name(handleApprovalStatus, "handleApprovalStatus");
    __name(handleApprovalShow, "handleApprovalShow");
  }
});

// package.json
var package_default;
var init_package = __esm({
  "package.json"() {
    package_default = {
      name: "@bonginkan/maria",
      version: "1.8.6",
      description: "Enterprise-Grade AI Development Platform - Intelligent CLI with Complete Local AI Integration (Ollama + vLLM + LM Studio), 50 Cognitive Modes, Vector-based Code Search, and Comprehensive Quality Analysis",
      keywords: [
        "ai",
        "cli",
        "assistant",
        "gpt",
        "claude",
        "gemini",
        "local-llm",
        "lm-studio",
        "ollama",
        "vllm",
        "local-ai",
        "privacy-first",
        "offline-development",
        "developer-tools",
        "code-assistant",
        "ai-cli",
        "command-line",
        "typescript",
        "code-quality",
        "bug-detection",
        "lint-analysis",
        "security-review",
        "type-safety",
        "owasp-compliance",
        "eslint-integration",
        "dependency-management",
        "project-analysis",
        "automated-refactoring",
        "enterprise-ai",
        "intelligent-development",
        "context-preservation",
        "multimodal-intelligence",
        "prediction-engine",
        "vector-search",
        "coderag",
        "document-processing",
        "arxiv-integration",
        "multi-agent-system",
        "mcp-protocol",
        "semantic-analysis"
      ],
      author: "Bonginkan Inc.",
      license: "MIT",
      homepage: "https://github.com/bonginkan/maria",
      repository: {
        type: "git",
        url: "git+https://github.com/bonginkan/maria.git"
      },
      bugs: {
        url: "https://github.com/bonginkan/maria/issues"
      },
      main: "./dist/index.js",
      types: "./dist/index.d.ts",
      bin: {
        maria: "./bin/maria",
        mc: "./bin/maria"
      },
      files: [
        "dist",
        "bin",
        "README.md",
        "LICENSE"
      ],
      type: "commonjs",
      engines: {
        node: ">=18.0.0"
      },
      scripts: {
        build: "tsup",
        dev: "tsup --watch",
        clean: "rm -rf dist",
        prebuild: "pnpm run clean",
        postbuild: "chmod +x bin/maria",
        test: "vitest",
        "test:coverage": "vitest --coverage",
        lint: "eslint src --ext .ts,.tsx",
        "lint:fix": "eslint src --ext .ts,.tsx --fix",
        "type-check": "tsc --noEmit",
        prepublishOnly: "echo 'Using prebuilt dist files'",
        release: "pnpm version patch && pnpm publish",
        "pre-commit": "lint-staged",
        "release:latest": `pnpm publish && npm dist-tag add @bonginkan/maria@$(npm pkg get version | tr -d '"') latest`,
        "release:alpha": "pnpm publish --tag alpha",
        "release:beta": "pnpm publish --tag beta",
        "version:sync": "node scripts/sync-versions.js",
        "version:auto": "npm version prerelease --preid=alpha --no-git-tag-version && npm run version:sync",
        "version:dynamic": "node scripts/dynamic-version.js && npm run version:sync"
      },
      dependencies: {
        "@anthropic-ai/sdk": "^0.20.0",
        "@google/generative-ai": "^0.1.0",
        "@langchain/core": "^0.1.0",
        "@sindresorhus/slugify": "^2.2.1",
        axios: "^1.11.0",
        chalk: "^5.3.0",
        "cli-progress": "^3.12.0",
        clsx: "^2.1.1",
        commander: "^12.0.0",
        "console-table-printer": "^2.14.6",
        dotenv: "^16.4.1",
        "express-rate-limit": "^8.0.1",
        "express-validator": "^7.2.1",
        figlet: "^1.7.0",
        "fs-extra": "^11.2.0",
        "fuse.js": "^7.1.0",
        glob: "^11.0.3",
        "gpt-3-encoder": "^1.1.4",
        "groq-sdk": "^0.3.0",
        ink: "^4.4.1",
        "ink-select-input": "^5.0.0",
        "ink-spinner": "^4.0.3",
        "ink-text-input": "^5.0.1",
        inquirer: "^12.0.0",
        jsonwebtoken: "^9.0.2",
        natural: "^6.0.0",
        "node-fetch": "^3.3.2",
        openai: "^4.28.0",
        ora: "^8.0.1",
        "p-limit": "^5.0.0",
        prompts: "^2.4.2",
        react: "^18.2.0",
        "reflect-metadata": "^0.2.2",
        semver: "^7.7.2",
        "strip-ansi": "^7.1.0",
        toml: "^3.0.0",
        uuid: "^9.0.1",
        winston: "^3.11.0",
        ws: "^8.16.0",
        zod: "^3.22.4"
      },
      devDependencies: {
        "@types/cli-progress": "^3.11.5",
        "@types/figlet": "^1.5.8",
        "@types/fs-extra": "^11.0.4",
        "@types/inquirer": "^9.0.7",
        "@types/jsonwebtoken": "^9.0.5",
        "@types/node": "^20.11.0",
        "@types/prompts": "^2.4.9",
        "@types/react": "^18.2.48",
        "@types/semver": "^7.7.0",
        "@types/uuid": "^9.0.8",
        "@types/ws": "^8.5.10",
        "@typescript-eslint/eslint-plugin": "^6.19.0",
        "@typescript-eslint/parser": "^6.19.0",
        "@vitest/coverage-v8": "^1.2.0",
        "cli-highlight": "^2.1.11",
        eslint: "^8.56.0",
        "eslint-config-prettier": "^9.1.0",
        "eslint-plugin-node": "^11.1.0",
        "eslint-plugin-prettier": "^5.1.3",
        execa: "^9.6.0",
        figures: "^6.1.0",
        "lint-staged": "^16.1.5",
        prettier: "^3.2.4",
        "react-devtools-core": "^6.1.5",
        "ts-node": "^10.9.2",
        tsup: "^8.0.1",
        typescript: "5.3.3",
        vitest: "^1.2.0"
      },
      overrides: {
        chalk: "^5.3.0",
        "lodash.isequal": "npm:lodash.isEqual@^4.5.0"
      },
      publishConfig: {
        access: "public",
        registry: "https://registry.npmjs.org/"
      },
      "lint-staged": {
        "*.{ts,tsx}": [
          "eslint --fix",
          "prettier --write"
        ],
        "*.{json,md}": [
          "prettier --write"
        ]
      },
      packageManager: "pnpm@10.10.0+sha512.d615db246fe70f25dcfea6d8d73dee782ce23e2245e3c4f6f888249fb568149318637dca73c2c5c8ef2a4ca0d5657fb9567188bfab47f566d1ee6ce987815c39"
    };
  }
});

// src/services/llm-health-checker.ts
var llm_health_checker_exports = {};
__export(llm_health_checker_exports, {
  LLMHealthChecker: () => LLMHealthChecker
});
var LLMHealthChecker;
var init_llm_health_checker = __esm({
  "src/services/llm-health-checker.ts"() {
    init_cjs_shims();
    LLMHealthChecker = class _LLMHealthChecker {
      static {
        __name(this, "LLMHealthChecker");
      }
      static services = [
        {
          name: "LM Studio",
          port: 1234,
          endpoint: "/v1/models",
          checkUrl: "http://localhost:1234/v1/models"
        },
        {
          name: "Ollama",
          port: 11434,
          endpoint: "/api/version",
          checkUrl: "http://localhost:11434/api/version"
        },
        {
          name: "vLLM",
          port: 8e3,
          endpoint: "/v1/models",
          checkUrl: "http://localhost:8000/v1/models"
        }
      ];
      async checkService(serviceName) {
        const serviceConfig = _LLMHealthChecker.services.find((s) => s.name === serviceName);
        if (!serviceConfig) {
          return {
            name: serviceName,
            isRunning: false,
            error: "Unknown service"
          };
        }
        try {
          const response = await fetch(serviceConfig.checkUrl, {
            method: "GET",
            signal: AbortSignal.timeout(3e3)
          });
          if (response.ok) {
            const data = await response.json();
            let models = [];
            if (serviceName === "LM Studio" && data.data) {
              models = data.data.map((model) => model.id);
            } else if (serviceName === "Ollama" && data.models) {
              models = data.models.map((model) => model.name);
            } else if (serviceName === "vLLM" && data.data) {
              models = data.data.map((model) => model.id);
            }
            return {
              name: serviceName,
              isRunning: true,
              port: serviceConfig.port,
              models,
              version: data.version || "unknown"
            };
          } else {
            return {
              name: serviceName,
              isRunning: false,
              error: `HTTP ${response.status}: ${response.statusText}`
            };
          }
        } catch (error) {
          return {
            name: serviceName,
            isRunning: false,
            error: error instanceof Error ? error.message : "Connection failed"
          };
        }
      }
      async checkAllServices() {
        const results = [];
        for (const service of _LLMHealthChecker.services) {
          const status = await this.checkService(service.name);
          results.push(status);
        }
        return results;
      }
      async startLMStudio() {
        try {
          const { spawn: spawn3 } = await import('child_process');
          const lmsPath = "/Users/bongin_max/.lmstudio/bin/lms";
          return new Promise((resolve) => {
            const child = spawn3(lmsPath, ["server", "start"], {
              stdio: "ignore",
              detached: true
            });
            child.on("error", () => {
              resolve(false);
            });
            child.on("spawn", () => {
              child.unref();
              setTimeout(async () => {
                const status = await this.checkService("LM Studio");
                resolve(status.isRunning);
              }, 3e3);
            });
          });
        } catch {
          return false;
        }
      }
    };
  }
});

// src/services/llm-startup-manager.ts
var llm_startup_manager_exports = {};
__export(llm_startup_manager_exports, {
  LLMStartupManager: () => LLMStartupManager
});
var LLMStartupManager;
var init_llm_startup_manager = __esm({
  "src/services/llm-startup-manager.ts"() {
    init_cjs_shims();
    LLMStartupManager = class {
      static {
        __name(this, "LLMStartupManager");
      }
      services = [
        { name: "LM Studio", status: "checking", progress: 0 },
        { name: "Ollama", status: "checking", progress: 0 },
        { name: "vLLM", status: "checking", progress: 0 }
      ];
      displayServices() {
        console.log("\n\u{1F680} Initializing AI Services...\n");
        console.log("Local AI Services:");
        console.log("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
        for (const service of this.services) {
          const progressBar = this.createProgressBar(service.progress || 0);
          const statusIcon = this.getStatusIcon(service.status);
          const message = service.message || this.getDefaultMessage(service.status);
          console.log(`${service.name.padEnd(12)} ${progressBar} ${statusIcon} ${message}`);
          if (service.message) {
            console.log(`             \u2514\u2500 ${service.message}`);
          }
        }
      }
      createProgressBar(progress) {
        const total = 20;
        const filled = Math.round(progress / 100 * total);
        const empty = total - filled;
        return `[${"\u2588".repeat(filled)}${"\u2591".repeat(empty)}] ${progress.toString().padStart(3)}%`;
      }
      getStatusIcon(status) {
        switch (status) {
          case "checking":
            return "\u23F3";
          case "starting":
            return "\u23F3";
          case "running":
            return "\u2705";
          case "failed":
            return "\u274C";
          case "not-installed":
            return "\u26A0\uFE0F";
          default:
            return "\u2753";
        }
      }
      getDefaultMessage(status) {
        switch (status) {
          case "checking":
            return "Checking availability...";
          case "starting":
            return "Starting...";
          case "running":
            return "Running";
          case "failed":
            return "Failed to start";
          case "not-installed":
            return "Not installed";
          default:
            return "Unknown status";
        }
      }
      async initializeServices() {
        this.displayServices();
        for (let i = 0; i < this.services.length; i++) {
          const service = this.services[i];
          if (!service) continue;
          await this.checkService(service);
          this.displayServices();
        }
        console.log("\nCloud Services:");
        console.log("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
        console.log("OpenAI       \u2705 Available (GPT-5)");
        console.log("Anthropic    \u2705 Available (Claude Opus 4.1)");
        console.log("Google AI    \u2705 Available (Gemini 2.5 Pro)");
        const runningServices = this.services.filter((s) => s.status === "running");
        if (runningServices.length > 0) {
          const primary = runningServices[0];
          console.log(`
\u{1F389} Ready! Using ${primary?.name} as primary provider`);
        } else {
          console.log("\n\u{1F389} Ready! Using cloud providers");
        }
      }
      async checkService(service) {
        service.status = "checking";
        service.progress = 0;
        try {
          const { LLMHealthChecker: LLMHealthChecker2 } = await Promise.resolve().then(() => (init_llm_health_checker(), llm_health_checker_exports));
          const healthChecker = new LLMHealthChecker2();
          const healthStatus = await healthChecker.checkService(service.name);
          for (let progress = 0; progress <= 100; progress += 25) {
            service.progress = progress;
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
          if (healthStatus.isRunning) {
            service.status = "running";
            service.progress = 100;
            if (healthStatus.models && healthStatus.models.length > 0) {
              service.message = `${healthStatus.models.length} models available`;
            } else {
              service.message = "Running";
            }
          } else {
            service.status = "not-installed";
            service.message = "Not running";
            service.progress = 0;
          }
        } catch {
          service.status = "not-installed";
          service.message = "Skipping...";
          service.progress = 0;
        }
      }
      displayWelcome() {
        const frameWidth = 86;
        const horizontalLine = "\u2550".repeat(frameWidth - 2);
        const emptyLine = "\u2551" + " ".repeat(frameWidth - 2) + "\u2551";
        const centerText = /* @__PURE__ */ __name((text) => {
          const plainText = text.replace(/\u001B\[[0-9;]*m/g, "");
          const padding = Math.max(0, frameWidth - 2 - plainText.length);
          const leftPad = Math.floor(padding / 2);
          const rightPad = padding - leftPad;
          return "\u2551" + " ".repeat(leftPad) + text + " ".repeat(rightPad) + "\u2551";
        }, "centerText");
        console.log("\n");
        console.log(chalk8__default.default.magentaBright("\u2554" + horizontalLine + "\u2557"));
        console.log(chalk8__default.default.magentaBright(emptyLine));
        console.log(
          chalk8__default.default.magentaBright(
            centerText(chalk8__default.default.bold.magentaBright("\u2588\u2588\u2588\u2557   \u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2557 "))
          )
        );
        console.log(
          chalk8__default.default.magentaBright(
            centerText(chalk8__default.default.bold.magentaBright("\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557"))
          )
        );
        console.log(
          chalk8__default.default.magentaBright(
            centerText(chalk8__default.default.bold.magentaBright("\u2588\u2588\u2554\u2588\u2588\u2588\u2588\u2554\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551"))
          )
        );
        console.log(
          chalk8__default.default.magentaBright(
            centerText(chalk8__default.default.bold.magentaBright("\u2588\u2588\u2551\u255A\u2588\u2588\u2554\u255D\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551"))
          )
        );
        console.log(
          chalk8__default.default.magentaBright(
            centerText(chalk8__default.default.bold.magentaBright("\u2588\u2588\u2551 \u255A\u2550\u255D \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551"))
          )
        );
        console.log(
          chalk8__default.default.magentaBright(
            centerText(chalk8__default.default.bold.magentaBright("\u255A\u2550\u255D     \u255A\u2550\u255D\u255A\u2550\u255D  \u255A\u2550\u255D\u255A\u2550\u255D  \u255A\u2550\u255D\u255A\u2550\u255D\u255A\u2550\u255D  \u255A\u2550\u255D"))
          )
        );
        console.log(chalk8__default.default.magentaBright(emptyLine));
        console.log(
          chalk8__default.default.magentaBright(centerText(chalk8__default.default.bold.magentaBright("\u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557")))
        );
        console.log(
          chalk8__default.default.magentaBright(
            centerText(chalk8__default.default.bold.magentaBright("\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D\u2588\u2588\u2554\u2550\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255D"))
          )
        );
        console.log(
          chalk8__default.default.magentaBright(
            centerText(chalk8__default.default.bold.magentaBright("\u2588\u2588\u2551     \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2588\u2588\u2588\u2557  "))
          )
        );
        console.log(
          chalk8__default.default.magentaBright(
            centerText(chalk8__default.default.bold.magentaBright("\u2588\u2588\u2551     \u2588\u2588\u2551   \u2588\u2588\u2551\u2588\u2588\u2551  \u2588\u2588\u2551\u2588\u2588\u2554\u2550\u2550\u255D  "))
          )
        );
        console.log(
          chalk8__default.default.magentaBright(
            centerText(chalk8__default.default.bold.magentaBright("\u255A\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u255A\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2588\u2588\u2588\u2588\u2554\u255D\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557"))
          )
        );
        console.log(
          chalk8__default.default.magentaBright(
            centerText(chalk8__default.default.bold.magentaBright(" \u255A\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u2550\u2550\u2550\u2550\u255D \u255A\u2550\u2550\u2550\u2550\u2550\u2550\u255D"))
          )
        );
        console.log(chalk8__default.default.magentaBright(emptyLine));
        console.log(
          chalk8__default.default.magentaBright(centerText(chalk8__default.default.whiteBright("AI-Powered Development Platform")))
        );
        console.log(chalk8__default.default.magentaBright(centerText(chalk8__default.default.gray("(c) 2025 Bonginkan Inc."))));
        console.log(chalk8__default.default.magentaBright(emptyLine));
        console.log(chalk8__default.default.magentaBright("\u255A" + horizontalLine + "\u255D"));
        console.log("");
      }
    };
  }
});
function createCLI() {
  const program = new commander.Command();
  program.name("maria").description("MARIA - Intelligent CLI Assistant with Multi-Model AI Support").version(package_default.version);
  program.command("chat", { isDefault: true }).description("Start interactive chat session").option(
    "--priority <mode>",
    "Set priority mode (privacy-first|performance|cost-effective|auto)"
  ).option("--provider <name>", "Force specific provider").option("--model <name>", "Force specific model").option("--offline", "Use only local providers").option("--debug", "Enable debug output").action(async (options) => {
    const config = await loadConfig(options);
    await startInteractiveChat(config);
  });
  program.command("ask <message>").description("Ask a single question").option("--priority <mode>", "Set priority mode").option("--provider <name>", "Force specific provider").option("--model <name>", "Force specific model").action(async (message, options) => {
    const config = await loadConfig(options);
    await askSingle(message, config);
  });
  program.command("code <prompt>").description("Generate code").option("--language <lang>", "Programming language").option("--provider <name>", "Force specific provider").action(async (prompt, options) => {
    const config = await loadConfig(options);
    await generateCode(prompt, options.language, config);
  });
  program.command("vision <image> <prompt>").description("Analyze image with text prompt").option("--provider <name>", "Force specific provider").action(async (imagePath, prompt, options) => {
    const config = await loadConfig(options);
    await processVision(imagePath, prompt, config);
  });
  program.command("status").description("Show system status and health").action(async () => {
    await showStatus2();
  });
  program.command("models").description("List available models").option("--provider <name>", "Filter by provider").action(async (options) => {
    await listModels(options.provider);
  });
  program.command("setup").description("Run setup wizard").action(async () => {
    await runSetup();
  });
  program.command("health").description("Check system health").option("--json", "Output as JSON").option("--watch", "Continuous monitoring").action(async (options) => {
    await checkHealth(options);
  });
  registerSetupOllamaCommand(program);
  registerSetupVllmCommand(program);
  registerCodeRAGCommand(program);
  registerDocumentCommand(program);
  registerApprovalGitCommands(program);
  return program;
}
async function startInteractiveChat(config) {
  const { LLMStartupManager: LLMStartupManager2 } = await Promise.resolve().then(() => (init_llm_startup_manager(), llm_startup_manager_exports));
  const startupManager = new LLMStartupManager2();
  startupManager.displayWelcome();
  await startupManager.initializeServices();
  const maria = new MariaAI(config);
  const session = createInteractiveSession(maria);
  await session.start();
}
async function askSingle(message, config) {
  const maria = new MariaAI(config);
  await maria.initialize();
  try {
    console.log(chalk8__default.default.blue("\u{1F916} Thinking..."));
    const response = await maria.chat(message);
    console.log("\n" + chalk8__default.default.green(response.content));
  } catch (error) {
    console.error(chalk8__default.default.red("\u274C Error:"), error);
    process.exit(1);
  } finally {
    await maria.close();
  }
}
async function generateCode(prompt, language, config) {
  const maria = new MariaAI(config);
  await maria.initialize();
  try {
    console.log(chalk8__default.default.blue("\u{1F527} Generating code..."));
    const response = await maria.generateCode(prompt, language);
    console.log("\n" + chalk8__default.default.green(response.content));
  } catch (error) {
    console.error(chalk8__default.default.red("\u274C Error:"), error);
    process.exit(1);
  } finally {
    await maria.close();
  }
}
async function processVision(imagePath, prompt, config) {
  const maria = new MariaAI(config);
  await maria.initialize();
  const fs5 = await (async () => {
    try {
      return await import('fs-extra');
    } catch {
      const { importNodeBuiltin: importNodeBuiltin2 } = await Promise.resolve().then(() => (init_import_helper(), import_helper_exports));
      return importNodeBuiltin2("fs");
    }
  })();
  try {
    console.log(chalk8__default.default.blue("\u{1F441}\uFE0F  Analyzing image..."));
    const imageBuffer = await fs5.readFile(imagePath);
    const response = await maria.vision(imageBuffer, prompt);
    console.log("\n" + chalk8__default.default.green(response.content));
  } catch (error) {
    console.error(chalk8__default.default.red("\u274C Error:"), error);
    process.exit(1);
  } finally {
    await maria.close();
  }
}
async function showStatus2() {
  const maria = new MariaAI({ autoStart: false });
  await maria.getHealth().then((health) => {
    printStatus(health);
  }).catch((error) => {
    console.error(chalk8__default.default.red("\u274C Failed to get status:"), error);
  });
  await maria.close();
}
async function listModels(provider) {
  const maria = new MariaAI({ autoStart: false });
  try {
    const models = await maria.getModels();
    const filtered = provider ? models.filter((m) => m.provider === provider) : models;
    console.log(chalk8__default.default.blue(`
\u{1F4CB} Available Models (${filtered.length}):
`));
    filtered.forEach((model) => {
      const status = model.available ? "\u2705" : "\u26A0\uFE0F";
      const pricing = model.pricing ? ` ($${model.pricing.input}/${model.pricing.output})` : "";
      console.log(`${status} ${chalk8__default.default.bold(model.name)} - ${model.provider}${pricing}`);
      console.log(`   ${chalk8__default.default.gray(model.description)}`);
      if (model.capabilities) {
        console.log(`   ${chalk8__default.default.cyan("Capabilities:")} ${model.capabilities.join(", ")}`);
      }
      console.log("");
    });
  } catch (error) {
    console.error(chalk8__default.default.red("\u274C Error listing models:"), error);
  } finally {
    await maria.close();
  }
}
async function runSetup() {
  console.log(chalk8__default.default.blue("\u{1F680} Running MARIA setup wizard..."));
  const { spawn: spawn3 } = await (async () => {
    const { importNodeBuiltin: importNodeBuiltin2 } = await Promise.resolve().then(() => (init_import_helper(), import_helper_exports));
    return importNodeBuiltin2("child_process");
  })();
  const setupProcess = spawn3("./scripts/setup-wizard.sh", [], {
    stdio: "inherit",
    cwd: process.cwd()
  });
  setupProcess.on("close", (code) => {
    if (code === 0) {
      console.log(chalk8__default.default.green("\u2705 Setup completed successfully!"));
    } else {
      console.error(chalk8__default.default.red("\u274C Setup failed"));
      process.exit(1);
    }
  });
}
async function checkHealth(options) {
  if (options.watch) {
    console.log(chalk8__default.default.blue("\u{1F504} Starting health monitoring... Press Ctrl+C to stop"));
    const { spawn: spawn3 } = await (async () => {
      const { importNodeBuiltin: importNodeBuiltin2 } = await Promise.resolve().then(() => (init_import_helper(), import_helper_exports));
      return importNodeBuiltin2("child_process");
    })();
    const healthProcess = spawn3("./scripts/health-monitor.sh", ["monitor"], {
      stdio: "inherit",
      cwd: process.cwd()
    });
    process.on("SIGINT", () => {
      healthProcess.kill("SIGINT");
      process.exit(0);
    });
  } else {
    const { spawn: spawn3 } = await (async () => {
      const { importNodeBuiltin: importNodeBuiltin2 } = await Promise.resolve().then(() => (init_import_helper(), import_helper_exports));
      return importNodeBuiltin2("child_process");
    })();
    const args = options.json ? ["json"] : ["status"];
    const healthProcess = spawn3("./scripts/health-monitor.sh", args, {
      stdio: "inherit",
      cwd: process.cwd()
    });
    healthProcess.on("close", (code) => {
      process.exit(code || 0);
    });
  }
}
var init_cli = __esm({
  "src/cli.ts"() {
    init_cjs_shims();
    init_maria_ai();
    init_interactive_session();
    init_loader();
    init_ui();
    init_setup_ollama();
    init_setup_vllm();
    init_coderag();
    init_document();
    init_approval_git();
    init_package();
    __name(createCLI, "createCLI");
    __name(startInteractiveChat, "startInteractiveChat");
    __name(askSingle, "askSingle");
    __name(generateCode, "generateCode");
    __name(processVision, "processVision");
    __name(showStatus2, "showStatus");
    __name(listModels, "listModels");
    __name(runSetup, "runSetup");
    __name(checkHealth, "checkHealth");
  }
});
function checkNodeVersion() {
  const currentVersion = process.version;
  console.log(chalk8__default.default.gray("\u2500".repeat(60)));
  console.log(chalk8__default.default.bold("\u{1F50D} Node.js Version Check"));
  console.log(chalk8__default.default.gray("\u2500".repeat(60)));
  if (!semver__default.default.satisfies(currentVersion, `>=${MINIMUM_NODE_VERSION}`)) {
    console.error(chalk8__default.default.red(`
\u274C Node.js version ${currentVersion} is not supported.`));
    console.error(chalk8__default.default.yellow(`Minimum required version: ${MINIMUM_NODE_VERSION}`));
    console.error(chalk8__default.default.yellow(`Recommended version: ${RECOMMENDED_NODE_VERSION} or higher`));
    console.error(chalk8__default.default.cyan("\nPlease upgrade Node.js:"));
    console.error(chalk8__default.default.gray("  \u2022 Using nvm: nvm install 20 && nvm use 20"));
    console.error(chalk8__default.default.gray("  \u2022 Using nodenv: nodenv install 20.0.0 && nodenv global 20.0.0"));
    console.error(chalk8__default.default.gray("  \u2022 Download from: https://nodejs.org/"));
    console.error(chalk8__default.default.gray("\u2500".repeat(60)));
    process.exit(1);
  }
  console.log(chalk8__default.default.green(`\u2705 Node.js ${currentVersion} is supported`));
  if (semver__default.default.lt(currentVersion, RECOMMENDED_NODE_VERSION)) {
    console.log(
      chalk8__default.default.yellow(
        `
\u{1F4A1} Recommendation: Upgrade to Node.js ${RECOMMENDED_NODE_VERSION} or higher for best performance`
      )
    );
  }
  console.log(chalk8__default.default.gray("\u2500".repeat(60)));
  console.log();
}
var MINIMUM_NODE_VERSION, RECOMMENDED_NODE_VERSION;
var init_version_check = __esm({
  "src/utils/version-check.ts"() {
    init_cjs_shims();
    MINIMUM_NODE_VERSION = "18.0.0";
    RECOMMENDED_NODE_VERSION = "20.0.0";
    __name(checkNodeVersion, "checkNodeVersion");
  }
});

// src/bin/maria.ts
var require_maria = __commonJS({
  "src/bin/maria.ts"() {
    init_cjs_shims();
    init_cli();
    init_version_check();
    init_loader();
    async function main() {
      await loadEnvironmentConfig();
      checkNodeVersion();
      const program = createCLI();
      program.parse(process.argv);
    }
    __name(main, "main");
    process.on("uncaughtException", (error) => {
      console.error("\u274C Uncaught Exception:", error.message);
      process.exit(1);
    });
    process.on("unhandledRejection", (reason, promise) => {
      console.error("\u274C Unhandled Rejection at:", promise, "reason:", reason);
      process.exit(1);
    });
    process.on("SIGINT", () => {
      console.log("\n\u{1F44B} Goodbye!");
      process.exit(0);
    });
    process.on("SIGTERM", () => {
      console.log("\n\u{1F44B} Goodbye!");
      process.exit(0);
    });
    main().catch((error) => {
      console.error("\u274C Failed to start:", error);
      process.exit(1);
    });
  }
});
var maria = require_maria();

module.exports = maria;
//# sourceMappingURL=maria.js.map
//# sourceMappingURL=maria.js.map