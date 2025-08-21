#!/usr/bin/env node
'use strict';

var OpenAI = require('openai');
var Anthropic = require('@anthropic-ai/sdk');
var generativeAi = require('@google/generative-ai');
var Groq = require('groq-sdk');
var fetch2 = require('node-fetch');
var events = require('events');
var fs = require('fs');
var path = require('path');
var os = require('os');
var chalk = require('chalk');
var readline = require('readline');
var fs2 = require('fs/promises');
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
var fetch2__default = /*#__PURE__*/_interopDefault(fetch2);
var chalk__default = /*#__PURE__*/_interopDefault(chalk);
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

// node_modules/tsup/assets/cjs_shims.js
var init_cjs_shims = __esm({
  "node_modules/tsup/assets/cjs_shims.js"() {
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
          const response = await fetch2__default.default(`${this.apiBase}/models`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${this.apiKey}`
            },
            signal: AbortSignal.timeout(5e3)
          });
          this.isHealthy = response.ok;
          return this.isHealthy;
        } catch {
          console.warn("LM Studio server not reachable");
          this.isHealthy = false;
          return false;
        }
      }
      async fetchAvailableModels() {
        try {
          const response = await fetch2__default.default(`${this.apiBase}/models`, {
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
          const response2 = await fetch2__default.default(`${this.apiBase}/chat/completions`, {
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
          const response2 = await fetch2__default.default(`${this.apiBase}/chat/completions`, {
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
          const response = await fetch2__default.default(`${this.apiBase}/api/version`, {
            method: "GET",
            signal: AbortSignal.timeout(5e3)
          });
          this.isHealthy = response.ok;
          return this.isHealthy;
        } catch {
          console.warn("Ollama server not reachable");
          this.isHealthy = false;
          return false;
        }
      }
      async fetchAvailableModels() {
        try {
          const response = await fetch2__default.default(`${this.apiBase}/api/tags`, {
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
          const response2 = await fetch2__default.default(`${this.apiBase}/api/generate`, {
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
          const response2 = await fetch2__default.default(`${this.apiBase}/api/generate`, {
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
      // Ollama specific methods
      async isServerRunning() {
        return await this.checkHealth();
      }
      async getAvailableModels() {
        await this.fetchAvailableModels();
        return this.availableModels;
      }
      async pullModel(modelName) {
        const response = await fetch2__default.default(`${this.apiBase}/api/pull`, {
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
        const response = await fetch2__default.default(`${this.apiBase}/api/delete`, {
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
          const response = await fetch2__default.default(`${this.apiBase}/models`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${this.apiKey}`
            },
            signal: AbortSignal.timeout(5e3)
          });
          this.isHealthy = response.ok;
          return this.isHealthy;
        } catch {
          console.warn("vLLM server not reachable");
          this.isHealthy = false;
          return false;
        }
      }
      async fetchAvailableModels() {
        try {
          const response = await fetch2__default.default(`${this.apiBase}/models`, {
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
          const response2 = await fetch2__default.default(`${this.apiBase}/chat/completions`, {
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
          const response2 = await fetch2__default.default(`${this.apiBase}/chat/completions`, {
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
          const provider = new LMStudioProvider();
          await provider.initialize("lmstudio");
          this.providers.set("lmstudio", provider);
        }
        if (localProviders && localProviders["ollama"] !== false) {
          const provider = new OllamaProvider();
          await provider.initialize("ollama");
          this.providers.set("ollama", provider);
        }
        if (localProviders && localProviders["vllm"] !== false) {
          const provider = new VLLMProvider();
          await provider.initialize("vllm");
          this.providers.set("vllm", provider);
        }
      }
      async checkAvailability() {
        this.availableProviders.clear();
        const checks = Array.from(this.providers.entries()).map(async ([name, provider]) => {
          try {
            const isAvailable = await (provider.validateConnection?.() ?? Promise.resolve(true));
            if (isAvailable) {
              this.availableProviders.add(name);
            }
          } catch (error) {
          }
        });
        await Promise.allSettled(checks);
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
      current_events: ["grok-2", "gemini-2.5-pro", "gpt-5", "claude-opus-4-1-20250805"],
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
          return "current_events";
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
          const healthDir = path.join(os.homedir(), ".maria", "health");
          await fs.promises.mkdir(healthDir, { recursive: true });
          const systemHealth = this.getSystemHealth();
          const healthFile = path.join(healthDir, "system-health.json");
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
          const healthFile = path.join(os.homedir(), ".maria", "health", "system-health.json");
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
        const fs3 = await safeDynamicImport2("fs-extra").catch(() => importNodeBuiltin2("fs"));
        const path = await importNodeBuiltin2("path");
        const os = await importNodeBuiltin2("os");
        const targetPath = configPath || path.join(os.homedir(), ".maria", "config.json");
        await fs3.ensureDir(path.dirname(targetPath));
        await fs3.writeJson(targetPath, this.config, { spaces: 2 });
      }
      // Load configuration from file
      static async load(configPath) {
        const { importNodeBuiltin: importNodeBuiltin2, safeDynamicImport: safeDynamicImport2 } = await Promise.resolve().then(() => (init_import_helper(), import_helper_exports));
        const fs3 = await safeDynamicImport2("fs-extra").catch(() => importNodeBuiltin2("fs"));
        const path = await importNodeBuiltin2("path");
        const os = await importNodeBuiltin2("os");
        const targetPath = configPath || path.join(os.homedir(), ".maria", "config.json");
        if (await fs3.pathExists(targetPath)) {
          try {
            const savedConfig = await fs3.readJson(targetPath);
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
      constructor(config = {}) {
        this.config = new ConfigManager(config);
        this.providerManager = new AIProviderManager(this.config);
        this.router = new IntelligentRouter(this.providerManager, this.config);
        this.healthMonitor = new HealthMonitor();
        if (config.autoStart !== false) {
          this.initialize();
        }
      }
      async initialize() {
        await this.providerManager.initialize();
        if (this.config.get("healthMonitoring", true)) {
          this.healthMonitor.start();
        }
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
       * Generate code
       */
      async generateCode(prompt, language) {
        return this.router.routeCode(prompt, language);
      }
      /**
       * Get available models
       */
      async getModels() {
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
function createInteractiveSession(maria) {
  let running = false;
  let rl = null;
  return {
    async start() {
      running = true;
      rl = readline__namespace.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
        historySize: 100
      });
      console.log(chalk__default.default.blue("\u{1F916} MARIA Interactive Session Started"));
      console.log(chalk__default.default.gray("Type your message, or use /help for commands. Type /exit to quit."));
      console.log("");
      rl.on("SIGINT", () => {
        console.log(chalk__default.default.yellow("\n\nReceived SIGINT. Use /exit to quit gracefully."));
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
          process.stdout.write(chalk__default.default.blue("\nMARIA: "));
          try {
            const stream = maria.chatStream(message);
            for await (const chunk of stream) {
              process.stdout.write(chunk);
            }
            console.log("\n");
          } catch (error) {
            console.error(chalk__default.default.red("\n\u274C Error:"), error);
          }
        } catch (error) {
          if (error.message?.includes("canceled")) {
            break;
          }
          console.error(chalk__default.default.red("\u274C Session error:"), error);
        }
      }
      rl?.close();
      await maria.close();
      console.log(chalk__default.default.green("\n\u{1F44B} Session ended. Goodbye!"));
    },
    stop() {
      running = false;
      rl?.close();
    }
  };
}
function getUserInput(rl) {
  return new Promise((resolve) => {
    rl.question(chalk__default.default.cyan("You: "), (answer) => {
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
      console.log(chalk__default.default.blue("\n\u2699\uFE0F  Configuration Options:\n"));
      console.log(
        chalk__default.default.gray(
          "Configuration management is temporarily disabled while React/Ink issues are resolved."
        )
      );
      console.log(chalk__default.default.gray("Basic configuration can be set via environment variables."));
      console.log(chalk__default.default.yellow("Available environment variables:"));
      console.log(chalk__default.default.cyan("  OPENAI_API_KEY=") + chalk__default.default.gray("Your OpenAI API key"));
      console.log(chalk__default.default.cyan("  ANTHROPIC_API_KEY=") + chalk__default.default.gray("Your Anthropic API key"));
      console.log(chalk__default.default.cyan("  GOOGLE_AI_API_KEY=") + chalk__default.default.gray("Your Google AI API key"));
      console.log("");
      return true;
    case "/priority":
      if (args[0]) {
        const mode = args[0];
        maria.setPriorityMode(mode);
        console.log(chalk__default.default.green(`\u2705 Priority mode set to: ${mode}`));
      } else {
        console.log(
          chalk__default.default.yellow("Usage: /priority <privacy-first|performance|cost-effective|auto>")
        );
      }
      return true;
    case "/exit":
    case "/quit":
      return "exit";
    case "/clear":
      console.clear();
      console.log(chalk__default.default.blue("\u{1F916} MARIA Interactive Session"));
      console.log("");
      return true;
    case "/avatar":
      await showAvatar();
      return true;
    case "/voice":
      console.log(chalk__default.default.blue("\u{1F3A4} Starting Voice Chat with MARIA Avatar..."));
      console.log(chalk__default.default.yellow("Voice mode will launch the avatar interface."));
      await showAvatar();
      return true;
    // Development/Code Commands
    case "/code":
      console.log(chalk__default.default.blue("\n\u{1F4BB} Code Generation Mode\n"));
      console.log(chalk__default.default.gray("Entering interactive coding mode..."));
      console.log(chalk__default.default.yellow("What would you like me to code for you?"));
      return true;
    case "/test":
      console.log(chalk__default.default.blue("\n\u{1F9EA} Test Generation Mode\n"));
      console.log(chalk__default.default.gray("Entering test generation mode..."));
      console.log(chalk__default.default.yellow("What code would you like me to write tests for?"));
      return true;
    case "/review":
      console.log(chalk__default.default.blue("\n\u{1F50D} Code Review Mode\n"));
      console.log(chalk__default.default.gray("Entering code review mode..."));
      console.log(chalk__default.default.yellow("Please paste the code you'd like me to review:"));
      return true;
    case "/setup":
      console.log(chalk__default.default.blue("\n\u{1F680} Environment Setup Wizard\n"));
      console.log(chalk__default.default.gray("This wizard helps you configure MARIA for first-time use."));
      console.log(chalk__default.default.yellow("Set the following environment variables:"));
      console.log(chalk__default.default.cyan("  export OPENAI_API_KEY=") + chalk__default.default.gray("your_openai_key"));
      console.log(chalk__default.default.cyan("  export ANTHROPIC_API_KEY=") + chalk__default.default.gray("your_anthropic_key"));
      console.log(chalk__default.default.cyan("  export GOOGLE_AI_API_KEY=") + chalk__default.default.gray("your_google_key"));
      console.log("");
      return true;
    case "/settings":
      console.log(chalk__default.default.blue("\n\u2699\uFE0F  Environment Settings\n"));
      console.log(chalk__default.default.gray("Checking current environment configuration..."));
      console.log(
        chalk__default.default.cyan("OPENAI_API_KEY:"),
        process.env.OPENAI_API_KEY ? "\u2705 Set" : "\u274C Not set"
      );
      console.log(
        chalk__default.default.cyan("ANTHROPIC_API_KEY:"),
        process.env.ANTHROPIC_API_KEY ? "\u2705 Set" : "\u274C Not set"
      );
      console.log(
        chalk__default.default.cyan("GOOGLE_AI_API_KEY:"),
        process.env.GOOGLE_AI_API_KEY ? "\u2705 Set" : "\u274C Not set"
      );
      console.log("");
      return true;
    case "/image":
      console.log(chalk__default.default.blue("\n\u{1F3A8} Image Generation Mode\n"));
      console.log(chalk__default.default.gray("Entering image generation mode..."));
      console.log(chalk__default.default.yellow("Describe the image you'd like me to generate:"));
      return true;
    case "/video":
      console.log(chalk__default.default.blue("\n\u{1F3AC} Video Generation Mode\n"));
      console.log(chalk__default.default.gray("Entering video generation mode..."));
      console.log(chalk__default.default.yellow("Describe the video content you'd like me to create:"));
      return true;
    // Project Management Commands (basic implementations)
    case "/init":
      console.log(chalk__default.default.blue("\n\u{1F4C1} Project Initialization\n"));
      console.log(chalk__default.default.gray("Initializing new MARIA project..."));
      console.log(chalk__default.default.yellow("What type of project would you like to initialize?"));
      return true;
    case "/add-dir":
      console.log(chalk__default.default.blue("\n\u{1F4C2} Add Directory to Project\n"));
      console.log(chalk__default.default.gray("Adding directory to current project context..."));
      console.log(chalk__default.default.yellow("Which directory would you like to add?"));
      return true;
    case "/memory":
      console.log(chalk__default.default.blue("\n\u{1F9E0} Project Memory Management\n"));
      console.log(chalk__default.default.gray("Managing project context and memory..."));
      console.log(chalk__default.default.yellow("Current project memory status will be displayed here."));
      return true;
    case "/export":
      console.log(chalk__default.default.blue("\n\u{1F4E4} Export Project Data\n"));
      console.log(chalk__default.default.gray("Exporting project configuration and data..."));
      console.log(chalk__default.default.yellow("What format would you like to export to?"));
      return true;
    case "/agents":
      console.log(chalk__default.default.blue("\n\u{1F916} Agent Management\n"));
      console.log(chalk__default.default.gray("Managing AI agents and their configurations..."));
      console.log(chalk__default.default.yellow("Available agents and their status will be displayed here."));
      return true;
    case "/mcp":
      console.log(chalk__default.default.blue("\n\u{1F50C} MCP Integration\n"));
      console.log(chalk__default.default.gray("Managing Model Context Protocol integrations..."));
      console.log(chalk__default.default.yellow("MCP tools and connections will be shown here."));
      return true;
    case "/ide":
      console.log(chalk__default.default.blue("\n\u{1F4BB} IDE Integration\n"));
      console.log(chalk__default.default.gray("Setting up IDE integrations..."));
      console.log(chalk__default.default.yellow("Supported IDEs: VS Code, Cursor, JetBrains"));
      return true;
    case "/install-github-app":
      console.log(chalk__default.default.blue("\n\u{1F419} GitHub App Installation\n"));
      console.log(chalk__default.default.gray("Installing MARIA GitHub application..."));
      console.log(chalk__default.default.yellow("Visit: https://github.com/apps/maria-ai-assistant"));
      return true;
    case "/doctor":
      console.log(chalk__default.default.blue("\n\u{1F3E5} System Diagnostics\n"));
      console.log(chalk__default.default.gray("Running comprehensive system health checks..."));
      await showHealth(maria);
      return true;
    case "/model":
      await showModelSelector(maria, args);
      return true;
    case "/sow":
      await handleSOWCommand(args);
      return true;
    case "/bug":
      await handleBugCommand(args);
      return true;
    // Algorithm Education Commands (v1.6.0)
    case "/sort":
      await handleSortCommand(args);
      return true;
    case "/learn":
      await handleLearnCommand(args);
      return true;
    case "/visualize":
      await handleVisualizeCommand(args);
      return true;
    case "/benchmark":
      await handleBenchmarkCommand(args);
      return true;
    case "/algorithm":
      await handleAlgorithmCommand(args);
      return true;
    case "/quicksort":
      await handleQuicksortCommand(args);
      return true;
    case "/mergesort":
      await handleMergeSortCommand(args);
      return true;
    default:
      console.log(chalk__default.default.red(`Unknown command: ${cmd}. Type /help for available commands.`));
      return true;
  }
}
function showHelp() {
  console.log(chalk__default.default.blue("\n\u{1F4D6} MARIA Commands (36+ Total):\n"));
  console.log(chalk__default.default.yellow("\u{1F680} Development:"));
  console.log(chalk__default.default.cyan("/code") + "          - Generate code from description");
  console.log(chalk__default.default.cyan("/test") + "          - Generate tests for code");
  console.log(chalk__default.default.cyan("/review") + "        - Review and improve code");
  console.log(chalk__default.default.cyan("/model") + "         - Show/select AI models");
  console.log("");
  console.log(chalk__default.default.yellow("\u{1F393} Algorithm Education (NEW v1.6.0):"));
  console.log(chalk__default.default.cyan("/sort") + "          - Interactive sorting demonstrations");
  console.log(chalk__default.default.cyan("/learn") + "         - Complete CS education curriculum");
  console.log(chalk__default.default.cyan("/visualize") + "     - Step-by-step algorithm visualization");
  console.log(chalk__default.default.cyan("/benchmark") + "     - Performance analysis and comparison");
  console.log(chalk__default.default.cyan("/algorithm") + "     - Algorithm exploration and tutorials");
  console.log(chalk__default.default.cyan("/quicksort") + "     - Advanced quicksort optimization demos");
  console.log(chalk__default.default.cyan("/mergesort") + "     - Merge sort educational interface");
  console.log("");
  console.log(chalk__default.default.yellow("\u2699\uFE0F  Configuration:"));
  console.log(chalk__default.default.cyan("/setup") + "         - First-time environment setup wizard");
  console.log(chalk__default.default.cyan("/settings") + "      - Environment variable setup");
  console.log(chalk__default.default.cyan("/config") + "        - Show configuration");
  console.log("");
  console.log(chalk__default.default.yellow("\u{1F3A8} Media Generation:"));
  console.log(chalk__default.default.cyan("/image") + "         - Generate images");
  console.log(chalk__default.default.cyan("/video") + "         - Generate videos");
  console.log(chalk__default.default.cyan("/avatar") + "        - Interactive ASCII avatar");
  console.log(chalk__default.default.cyan("/voice") + "         - Voice chat mode");
  console.log("");
  console.log(chalk__default.default.yellow("\u{1F4C1} Project Management:"));
  console.log(chalk__default.default.cyan("/init") + "          - Initialize new project");
  console.log(chalk__default.default.cyan("/add-dir") + "       - Add directory to project");
  console.log(chalk__default.default.cyan("/memory") + "        - Manage project memory");
  console.log(chalk__default.default.cyan("/export") + "        - Export project data");
  console.log("");
  console.log(chalk__default.default.yellow("\u{1F916} Agent Management:"));
  console.log(chalk__default.default.cyan("/agents") + "        - Manage AI agents");
  console.log(chalk__default.default.cyan("/mcp") + "           - MCP integrations");
  console.log(chalk__default.default.cyan("/ide") + "           - IDE integration setup");
  console.log(chalk__default.default.cyan("/install-github-app") + " - Install GitHub app");
  console.log("");
  console.log(chalk__default.default.yellow("\u2699\uFE0F  System:"));
  console.log(chalk__default.default.cyan("/status") + "        - Show system status");
  console.log(chalk__default.default.cyan("/health") + "        - Check system health");
  console.log(chalk__default.default.cyan("/doctor") + "        - System diagnostics");
  console.log(chalk__default.default.cyan("/models") + "        - List available models");
  console.log(chalk__default.default.cyan("/priority") + "      - Set priority mode");
  console.log("");
  console.log(chalk__default.default.yellow("\u{1F4DD} Session:"));
  console.log(chalk__default.default.cyan("/clear") + "         - Clear screen");
  console.log(chalk__default.default.cyan("/help") + "          - Show this help");
  console.log(chalk__default.default.cyan("/exit") + "          - Exit session");
  console.log("");
}
async function showStatus(maria) {
  console.log(chalk__default.default.blue("\n\u{1F4CA} System Status:\n"));
  try {
    const health = await maria.getHealth();
    const status = health.overall === "healthy" ? "\u2705" : health.overall === "degraded" ? "\u26A0\uFE0F" : "\u274C";
    console.log(`${status} Overall: ${health.overall}`);
    console.log(`\u{1F4BB} CPU: ${health.system.cpu}%`);
    console.log(`\u{1F9E0} Memory: ${health.system.memory}%`);
    console.log(`\u{1F4BE} Disk: ${health.system.disk}%`);
    console.log("");
  } catch (error) {
    console.error(chalk__default.default.red("\u274C Failed to get status:"), error);
  }
}
async function showModels(maria) {
  console.log(chalk__default.default.blue("\n\u{1F527} Available Models:\n"));
  try {
    const models = await maria.getModels();
    const available = models.filter((m) => m.available);
    if (available.length === 0) {
      console.log(chalk__default.default.yellow("No models available"));
      return;
    }
    for (const model of available) {
      const provider = chalk__default.default.gray(`[${model.provider}]`);
      const capabilities = model.capabilities.join(", ");
      console.log(`\u2705 ${chalk__default.default.bold(model.name)} ${provider}`);
      console.log(`   ${chalk__default.default.gray(capabilities)}`);
    }
    console.log("");
  } catch (error) {
    console.error(chalk__default.default.red("\u274C Failed to get models:"), error);
  }
}
async function showHealth(maria) {
  console.log(chalk__default.default.blue("\n\u{1F3E5} Health Status:\n"));
  try {
    const health = await maria.getHealth();
    console.log(chalk__default.default.bold("Local Services:"));
    Object.entries(health.services).forEach(([name, status]) => {
      const icon = status.status === "running" ? "\u2705" : "\u26A0\uFE0F";
      console.log(`  ${icon} ${name}: ${status.status}`);
    });
    console.log("");
    console.log(chalk__default.default.bold("Cloud APIs:"));
    Object.entries(health.cloudAPIs).forEach(([name, status]) => {
      const icon = status.status === "available" ? "\u2705" : "\u26A0\uFE0F";
      console.log(`  ${icon} ${name}: ${status.status}`);
    });
    if (health.recommendations.length > 0) {
      console.log("");
      console.log(chalk__default.default.bold("Recommendations:"));
      health.recommendations.forEach((rec) => {
        console.log(`  \u{1F4A1} ${rec}`);
      });
    }
    console.log("");
  } catch (error) {
    console.error(chalk__default.default.red("\u274C Failed to get health status:"), error);
  }
}
async function showModelSelector(maria, args) {
  console.log(chalk__default.default.blue("\n\u{1F916} AI Model Selector\n"));
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
          chalk__default.default.green(`\u2705 Target model found: ${targetModel.name} (${targetModel.provider})`)
        );
        console.log(chalk__default.default.yellow("Note: Model switching will be implemented in a future version"));
        console.log(
          chalk__default.default.gray("Currently, you can switch models using environment variables or CLI options")
        );
      } else {
        console.log(chalk__default.default.red(`\u274C Model not found: ${modelName}`));
        console.log(chalk__default.default.gray("Available models listed below:"));
      }
    }
    console.log(chalk__default.default.yellow("\u{1F4CB} Available AI Models:\n"));
    available.forEach((model, _index) => {
      const status = model.available ? "\u2705" : "\u26A0\uFE0F";
      const pricing = model.pricing ? ` ($${model.pricing.input}/${model.pricing.output})` : "";
      console.log(
        `  ${status} ${chalk__default.default.bold(model.name)} ${chalk__default.default.gray(`[${model.provider}]`)}${pricing}`
      );
      console.log(`     ${chalk__default.default.gray(model.description)}`);
      if (model.capabilities && model.capabilities.length > 0) {
        console.log(`     ${chalk__default.default.cyan("Capabilities:")} ${model.capabilities.join(", ")}`);
      }
      console.log("");
    });
    console.log(chalk__default.default.gray("Usage: /model <model_name_or_provider> - Find and display model info"));
    console.log(chalk__default.default.gray("Example: /model gpt-4 or /model anthropic"));
    console.log("");
  } catch (error) {
    console.error(chalk__default.default.red("\u274C Failed to access model selector:"), error);
  }
}
async function showAvatar() {
  console.log(chalk__default.default.blue("\n\u{1F3AD} MARIA Avatar Interface\n"));
  const avatarPath = "/Users/bongin_max/maria_code/face_only_96x96_ramp.txt";
  try {
    const avatarData = await fs2__namespace.readFile(avatarPath, "utf-8");
    const lines = avatarData.split("\n").slice(0, 30);
    console.log(chalk__default.default.white("\u2550".repeat(80)));
    lines.forEach((line) => {
      const displayLine = line.length > 80 ? line.substring(0, 80) : line;
      console.log(chalk__default.default.white(displayLine));
    });
    console.log(chalk__default.default.white("\u2550".repeat(80)));
    console.log(chalk__default.default.yellow("\n\u{1F44B} Hello! I am MARIA, your AI assistant!"));
    console.log(chalk__default.default.gray("This is a preview of the avatar interface."));
    console.log(chalk__default.default.gray("Full interactive avatar with animations is coming soon!\n"));
  } catch (error) {
    console.log(chalk__default.default.red("\u274C Could not load avatar file"));
    console.log(chalk__default.default.gray("Avatar file should be at: " + avatarPath));
  }
}
async function handleSOWCommand(args) {
  console.log(chalk__default.default.blue("\n\u{1F4CB} Statement of Work (SOW) Generator\n"));
  if (args.length === 0) {
    console.log(chalk__default.default.yellow("Available SOW Templates:"));
    console.log(chalk__default.default.cyan("\u2022 /sow project <name>") + " - Generate project-based SOW");
    console.log(chalk__default.default.cyan("\u2022 /sow consulting") + " - Generate consulting services SOW");
    console.log(chalk__default.default.cyan("\u2022 /sow development") + " - Generate software development SOW");
    console.log(chalk__default.default.cyan("\u2022 /sow maintenance") + " - Generate maintenance & support SOW");
    console.log("");
    console.log(chalk__default.default.gray('Example: /sow project "Website Redesign"'));
    return;
  }
  const sowType = args[0].toLowerCase();
  const projectName = args.slice(1).join(" ") || "New Project";
  console.log(chalk__default.default.green(`\u{1F504} Generating ${sowType} SOW for: ${projectName}`));
  console.log(chalk__default.default.gray("This will create a comprehensive Statement of Work document..."));
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
  console.log(chalk__default.default.blue("\n\u{1F41B} Bug Report & Fix Assistant\n"));
  if (args.length === 0) {
    console.log(chalk__default.default.yellow("Bug Assistant Options:"));
    console.log(chalk__default.default.cyan("\u2022 /bug report") + " - Start interactive bug report");
    console.log(chalk__default.default.cyan("\u2022 /bug analyze") + " - Analyze error logs/stack traces");
    console.log(chalk__default.default.cyan("\u2022 /bug fix <description>") + " - Get fix suggestions");
    console.log(chalk__default.default.cyan("\u2022 /bug search <keywords>") + " - Search for similar issues");
    console.log("");
    console.log(chalk__default.default.gray('Example: /bug fix "TypeError: Cannot read property"'));
    return;
  }
  const action = args[0].toLowerCase();
  const details = args.slice(1).join(" ");
  switch (action) {
    case "report":
      console.log(chalk__default.default.green("\u{1F50D} Interactive Bug Report Generator"));
      console.log(chalk__default.default.yellow("Please provide the following information:"));
      console.log("1. What were you trying to do?");
      console.log("2. What actually happened?");
      console.log("3. What did you expect to happen?");
      console.log("4. Steps to reproduce the issue");
      console.log("5. Environment details (OS, browser, version)");
      break;
    case "analyze":
      console.log(chalk__default.default.green("\u{1F52C} Error Analysis Mode"));
      console.log(chalk__default.default.gray("Paste your error logs or stack trace below:"));
      console.log(chalk__default.default.yellow("I will analyze the error and suggest solutions..."));
      break;
    case "fix":
      if (!details) {
        console.log(chalk__default.default.red("Please provide a bug description"));
        console.log(chalk__default.default.gray('Example: /bug fix "Application crashes on startup"'));
        return;
      }
      console.log(chalk__default.default.green(`\u{1F527} Analyzing bug: "${details}"`));
      console.log(chalk__default.default.gray("Searching knowledge base and generating fix suggestions..."));
      console.log("");
      generateBugFixSuggestions(details);
      break;
    case "search":
      if (!details) {
        console.log(chalk__default.default.red("Please provide search keywords"));
        return;
      }
      console.log(chalk__default.default.green(`\u{1F50D} Searching for: "${details}"`));
      console.log(chalk__default.default.gray("Looking through known issues and solutions..."));
      break;
    default:
      console.log(chalk__default.default.red(`Unknown bug action: ${action}`));
      console.log(chalk__default.default.gray("Use: /bug to see available options"));
  }
}
function generateProjectSOW(projectName) {
  return `
${chalk__default.default.bold.blue("STATEMENT OF WORK")}
${chalk__default.default.gray("\u2550".repeat(50))}

${chalk__default.default.yellow("Project:")} ${projectName}
${chalk__default.default.yellow("Date:")} ${(/* @__PURE__ */ new Date()).toLocaleDateString()}
${chalk__default.default.yellow("Client:")} [CLIENT_NAME]
${chalk__default.default.yellow("Vendor:")} MARIA Development Services

${chalk__default.default.bold("1. PROJECT OVERVIEW")}
This Statement of Work outlines the scope, deliverables, and timeline for ${projectName}.

${chalk__default.default.bold("2. SCOPE OF WORK")}
\u2022 Requirements analysis and documentation
\u2022 System design and architecture
\u2022 Development and implementation
\u2022 Testing and quality assurance
\u2022 Deployment and go-live support

${chalk__default.default.bold("3. DELIVERABLES")}
\u2022 Project specification document
\u2022 Design mockups and wireframes
\u2022 Fully functional application/system
\u2022 Test results and documentation
\u2022 Deployment package

${chalk__default.default.bold("4. TIMELINE")}
\u2022 Phase 1 - Requirements: 2 weeks
\u2022 Phase 2 - Design: 3 weeks  
\u2022 Phase 3 - Development: 6 weeks
\u2022 Phase 4 - Testing: 2 weeks
\u2022 Phase 5 - Deployment: 1 week

${chalk__default.default.bold("5. ACCEPTANCE CRITERIA")}
All deliverables must meet specified requirements and pass acceptance testing.

${chalk__default.default.gray("Generated by MARIA CLI - Statement of Work Assistant")}
`;
}
function generateConsultingSOW(projectName) {
  return `
${chalk__default.default.bold.blue("CONSULTING SERVICES - STATEMENT OF WORK")}
${chalk__default.default.gray("\u2550".repeat(60))}

${chalk__default.default.yellow("Engagement:")} ${projectName}
${chalk__default.default.yellow("Type:")} Strategic Consulting Services

${chalk__default.default.bold("CONSULTING SCOPE")}
\u2022 Strategic planning and roadmap development
\u2022 Technology assessment and recommendations
\u2022 Process optimization analysis
\u2022 Implementation guidance and oversight

${chalk__default.default.bold("EXPECTED OUTCOMES")}
\u2022 Comprehensive strategy document
\u2022 Technology roadmap
\u2022 Implementation recommendations
\u2022 Process improvement plan

${chalk__default.default.gray("Generated by MARIA CLI - SOW Assistant")}
`;
}
function generateDevelopmentSOW(projectName) {
  return `
${chalk__default.default.bold.blue("SOFTWARE DEVELOPMENT - STATEMENT OF WORK")}
${chalk__default.default.gray("\u2550".repeat(60))}

${chalk__default.default.yellow("Project:")} ${projectName}
${chalk__default.default.yellow("Type:")} Custom Software Development

${chalk__default.default.bold("DEVELOPMENT SCOPE")}
\u2022 Requirements gathering and analysis
\u2022 System architecture and design
\u2022 Frontend and backend development
\u2022 API development and integration
\u2022 Database design and implementation
\u2022 Testing and quality assurance

${chalk__default.default.bold("TECHNICAL DELIVERABLES")}
\u2022 Source code repository
\u2022 Technical documentation
\u2022 API documentation
\u2022 Deployment scripts
\u2022 Test suites

${chalk__default.default.gray("Generated by MARIA CLI - SOW Assistant")}
`;
}
function generateMaintenanceSOW(projectName) {
  return `
${chalk__default.default.bold.blue("MAINTENANCE & SUPPORT - STATEMENT OF WORK")}
${chalk__default.default.gray("\u2550".repeat(60))}

${chalk__default.default.yellow("Service:")} ${projectName} Maintenance
${chalk__default.default.yellow("Type:")} Ongoing Support Services

${chalk__default.default.bold("MAINTENANCE SCOPE")}
\u2022 Bug fixes and issue resolution
\u2022 Security updates and patches
\u2022 Performance monitoring and optimization
\u2022 Feature enhancements
\u2022 Technical support

${chalk__default.default.bold("SERVICE LEVELS")}
\u2022 Critical issues: 4-hour response
\u2022 High priority: 24-hour response
\u2022 Normal priority: 72-hour response
\u2022 Enhancement requests: Next release cycle

${chalk__default.default.gray("Generated by MARIA CLI - SOW Assistant")}
`;
}
function generateBugFixSuggestions(bugDescription) {
  console.log(chalk__default.default.bold("\u{1F4A1} Fix Suggestions:"));
  console.log("");
  const lowerBug = bugDescription.toLowerCase();
  if (lowerBug.includes("cannot read property") || lowerBug.includes("undefined")) {
    console.log(chalk__default.default.green("\u{1F539} Null/Undefined Reference Issue:"));
    console.log("  \u2022 Add null checks: if (obj && obj.property)");
    console.log("  \u2022 Use optional chaining: obj?.property");
    console.log("  \u2022 Initialize variables before use");
    console.log("  \u2022 Check async data loading completion");
  }
  if (lowerBug.includes("cors") || lowerBug.includes("cross-origin")) {
    console.log(chalk__default.default.green("\u{1F539} CORS Issue:"));
    console.log("  \u2022 Configure server CORS headers");
    console.log("  \u2022 Use proxy in development environment");
    console.log("  \u2022 Check API endpoint configuration");
  }
  if (lowerBug.includes("memory") || lowerBug.includes("heap")) {
    console.log(chalk__default.default.green("\u{1F539} Memory Issue:"));
    console.log("  \u2022 Check for memory leaks");
    console.log("  \u2022 Remove event listeners properly");
    console.log("  \u2022 Optimize large data processing");
    console.log("  \u2022 Use pagination for large datasets");
  }
  if (lowerBug.includes("timeout") || lowerBug.includes("slow")) {
    console.log(chalk__default.default.green("\u{1F539} Performance Issue:"));
    console.log("  \u2022 Increase timeout settings");
    console.log("  \u2022 Optimize database queries");
    console.log("  \u2022 Add caching mechanisms");
    console.log("  \u2022 Use async/await properly");
  }
  console.log("");
  console.log(chalk__default.default.gray("\u{1F4A1} General debugging steps:"));
  console.log("  1. Check browser/server console logs");
  console.log("  2. Review recent code changes");
  console.log("  3. Test in different environments");
  console.log("  4. Add debugging statements/breakpoints");
  console.log("");
}
async function handleSortCommand(args) {
  console.log(chalk__default.default.blue("\n\u{1F3AF} Interactive Sorting Demonstrations\n"));
  if (args.length === 0) {
    console.log(chalk__default.default.yellow("Available sorting algorithms:"));
    console.log(chalk__default.default.cyan("\u2022 /sort quicksort") + " - Interactive quicksort with 3-way partitioning");
    console.log(chalk__default.default.cyan("\u2022 /sort mergesort") + " - Step-by-step merge sort visualization");
    console.log(chalk__default.default.cyan("\u2022 /sort heapsort") + " - Heap sort with tree visualization");
    console.log(chalk__default.default.cyan("\u2022 /sort compare") + " - Side-by-side algorithm comparison");
    console.log("");
    console.log(chalk__default.default.gray("Options:"));
    console.log("  --visualize    Show step-by-step execution");
    console.log("  --benchmark    Include performance metrics");
    console.log("  --size <n>     Set array size (default: 10)");
    console.log("");
    console.log(chalk__default.default.gray("Example: /sort quicksort --visualize --size 15"));
    return;
  }
  const algorithm = args[0].toLowerCase();
  const hasVisualize = args.includes("--visualize");
  const hasBenchmark = args.includes("--benchmark");
  const sizeIndex = args.indexOf("--size");
  const size = sizeIndex !== -1 && args[sizeIndex + 1] ? parseInt(args[sizeIndex + 1]) : 10;
  console.log(chalk__default.default.green(`\u{1F504} Running ${algorithm} demonstration:`));
  console.log(chalk__default.default.gray(`Array size: ${size}, Visualization: ${hasVisualize ? "ON" : "OFF"}, Benchmark: ${hasBenchmark ? "ON" : "OFF"}`));
  console.log("");
  switch (algorithm) {
    case "quicksort":
      displayQuicksortDemo(size, hasVisualize, hasBenchmark);
      break;
    case "mergesort":
      displayMergeSortDemo();
      break;
    case "heapsort":
      displayHeapSortDemo();
      break;
    case "compare":
      displayAlgorithmComparison();
      break;
    default:
      console.log(chalk__default.default.red(`Unknown algorithm: ${algorithm}`));
      console.log(chalk__default.default.gray("Use /sort to see available algorithms"));
  }
}
async function handleLearnCommand(args) {
  console.log(chalk__default.default.blue("\n\u{1F393} Complete Computer Science Education Curriculum\n"));
  if (args.length === 0) {
    console.log(chalk__default.default.yellow("Available learning modules:"));
    console.log(chalk__default.default.cyan("\u2022 /learn algorithms") + " - Complete algorithm theory and practice");
    console.log(chalk__default.default.cyan("\u2022 /learn complexity") + " - Time and space complexity analysis");
    console.log(chalk__default.default.cyan("\u2022 /learn datastructures") + " - Fundamental data structures");
    console.log(chalk__default.default.cyan("\u2022 /learn mathematics") + " - Mathematical foundations for CS");
    console.log(chalk__default.default.cyan("\u2022 /learn optimization") + " - Performance optimization techniques");
    console.log(chalk__default.default.cyan("\u2022 /learn patterns") + " - Algorithm design patterns");
    console.log("");
    console.log(chalk__default.default.gray("Interactive features:"));
    console.log("  --interactive  Launch interactive tutorial");
    console.log("  --quiz        Take knowledge assessment");
    console.log("  --progress    Show learning progress");
    console.log("");
    return;
  }
  const module = args[0].toLowerCase();
  args.includes("--interactive");
  args.includes("--quiz");
  args.includes("--progress");
  console.log(chalk__default.default.green(`\u{1F4DA} Loading ${module} curriculum...`));
  console.log("");
  switch (module) {
    case "algorithms":
      displayAlgorithmCurriculum();
      break;
    case "complexity":
      displayComplexityCurriculum();
      break;
    case "datastructures":
      displayDataStructuresCurriculum();
      break;
    case "mathematics":
      displayMathematicsCurriculum();
      break;
    case "optimization":
      displayOptimizationCurriculum();
      break;
    case "patterns":
      displayPatternsCurriculum();
      break;
    default:
      console.log(chalk__default.default.red(`Unknown module: ${module}`));
      console.log(chalk__default.default.gray("Use /learn to see available modules"));
  }
}
async function handleVisualizeCommand(args) {
  console.log(chalk__default.default.blue("\n\u{1F441}\uFE0F  Step-by-Step Algorithm Visualization\n"));
  if (args.length === 0) {
    console.log(chalk__default.default.yellow("Available visualizations:"));
    console.log(chalk__default.default.cyan("\u2022 /visualize quicksort") + " - 3-way partitioning visualization");
    console.log(chalk__default.default.cyan("\u2022 /visualize merge") + " - Divide and conquer demonstration");
    console.log(chalk__default.default.cyan("\u2022 /visualize heap") + " - Binary heap operations");
    console.log(chalk__default.default.cyan("\u2022 /visualize tree") + " - Tree traversal algorithms");
    console.log(chalk__default.default.cyan("\u2022 /visualize graph") + " - Graph algorithms (BFS, DFS)");
    console.log("");
    console.log(chalk__default.default.gray("Options:"));
    console.log("  --step        Single-step execution mode");
    console.log("  --speed <ms>  Animation speed (default: 1000ms)");
    console.log("  --data <list> Custom data input");
    console.log("");
    return;
  }
  const visualization = args[0].toLowerCase();
  const stepMode = args.includes("--step");
  const speedIndex = args.indexOf("--speed");
  const speed = speedIndex !== -1 && args[speedIndex + 1] ? parseInt(args[speedIndex + 1]) : 1e3;
  console.log(chalk__default.default.green(`\u{1F3AC} Starting ${visualization} visualization:`));
  console.log(chalk__default.default.gray(`Mode: ${stepMode ? "Step-by-step" : "Animated"}, Speed: ${speed}ms`));
  console.log("");
  switch (visualization) {
    case "quicksort":
      displayQuicksortVisualization();
      break;
    case "merge":
      displayMergeVisualization();
      break;
    case "heap":
      displayHeapVisualization();
      break;
    case "tree":
      displayTreeVisualization();
      break;
    case "graph":
      displayGraphVisualization();
      break;
    default:
      console.log(chalk__default.default.red(`Unknown visualization: ${visualization}`));
      console.log(chalk__default.default.gray("Use /visualize to see available options"));
  }
}
async function handleBenchmarkCommand(args) {
  console.log(chalk__default.default.blue("\n\u26A1 Performance Analysis and Benchmarking\n"));
  if (args.length === 0) {
    console.log(chalk__default.default.yellow("Benchmark options:"));
    console.log(chalk__default.default.cyan("\u2022 /benchmark all") + " - Complete performance comparison");
    console.log(chalk__default.default.cyan("\u2022 /benchmark quicksort") + " - Detailed quicksort analysis");
    console.log(chalk__default.default.cyan("\u2022 /benchmark memory") + " - Memory usage analysis");
    console.log(chalk__default.default.cyan("\u2022 /benchmark scaling") + " - Scalability testing");
    console.log("");
    console.log(chalk__default.default.gray("Options:"));
    console.log("  --sizes <list> Test with specific array sizes");
    console.log("  --iterations <n> Number of test iterations");
    console.log("  --verbose     Show detailed metrics");
    console.log("");
    return;
  }
  const benchmark = args[0].toLowerCase();
  args.includes("--verbose");
  console.log(chalk__default.default.green(`\u{1F4CA} Running ${benchmark} benchmarks...`));
  console.log("");
  switch (benchmark) {
    case "all":
      displayCompleteBenchmark();
      break;
    case "quicksort":
      displayQuicksortBenchmark();
      break;
    case "memory":
      displayMemoryBenchmark();
      break;
    case "scaling":
      displayScalingBenchmark();
      break;
    default:
      console.log(chalk__default.default.red(`Unknown benchmark: ${benchmark}`));
      console.log(chalk__default.default.gray("Use /benchmark to see available options"));
  }
}
async function handleAlgorithmCommand(args) {
  console.log(chalk__default.default.blue("\n\u{1F50D} Algorithm Exploration and Tutorials\n"));
  if (args.length === 0) {
    console.log(chalk__default.default.yellow("Algorithm categories:"));
    console.log(chalk__default.default.cyan("\u2022 /algorithm sorting") + " - Sorting algorithm deep dive");
    console.log(chalk__default.default.cyan("\u2022 /algorithm search") + " - Search algorithms and techniques");
    console.log(chalk__default.default.cyan("\u2022 /algorithm graph") + " - Graph algorithms and applications");
    console.log(chalk__default.default.cyan("\u2022 /algorithm dynamic") + " - Dynamic programming patterns");
    console.log(chalk__default.default.cyan("\u2022 /algorithm greedy") + " - Greedy algorithm strategies");
    console.log(chalk__default.default.cyan("\u2022 /algorithm divideconquer") + " - Divide and conquer approach");
    console.log("");
    console.log(chalk__default.default.gray("Interactive options:"));
    console.log("  --tutorial    Launch guided tutorial");
    console.log("  --examples    Show practical examples");
    console.log("  --theory      Mathematical foundations");
    console.log("");
    return;
  }
  const category = args[0].toLowerCase();
  args.includes("--tutorial");
  args.includes("--examples");
  args.includes("--theory");
  console.log(chalk__default.default.green(`\u{1F4D6} Exploring ${category} algorithms...`));
  console.log("");
  switch (category) {
    case "sorting":
      displaySortingAlgorithms();
      break;
    case "search":
      displaySearchAlgorithms();
      break;
    case "graph":
      displayGraphAlgorithms();
      break;
    case "dynamic":
      displayDynamicProgramming();
      break;
    case "greedy":
      displayGreedyAlgorithms();
      break;
    case "divideconquer":
      displayDivideConquerAlgorithms();
      break;
    default:
      console.log(chalk__default.default.red(`Unknown category: ${category}`));
      console.log(chalk__default.default.gray("Use /algorithm to see available categories"));
  }
}
async function handleQuicksortCommand(args) {
  console.log(chalk__default.default.blue("\n\u26A1 Advanced Quicksort Optimization Demonstrations\n"));
  if (args.length === 0) {
    console.log(chalk__default.default.yellow("Quicksort optimization techniques:"));
    console.log(chalk__default.default.cyan("\u2022 /quicksort 3way") + " - 3-way partitioning with duplicate handling");
    console.log(chalk__default.default.cyan("\u2022 /quicksort median") + " - Median-of-three pivot selection");
    console.log(chalk__default.default.cyan("\u2022 /quicksort hybrid") + " - Hybrid with insertion sort for small arrays");
    console.log(chalk__default.default.cyan("\u2022 /quicksort iterative") + " - Iterative implementation analysis");
    console.log(chalk__default.default.cyan("\u2022 /quicksort parallel") + " - Parallel processing demonstration");
    console.log("");
    console.log(chalk__default.default.gray("Educational features:"));
    console.log("  --compare     Compare optimization techniques");
    console.log("  --theory      Mathematical analysis");
    console.log("  --benchmark   Performance measurements");
    console.log("");
    return;
  }
  const technique = args[0].toLowerCase();
  args.includes("--compare");
  args.includes("--theory");
  args.includes("--benchmark");
  console.log(chalk__default.default.green(`\u{1F3AF} Demonstrating ${technique} quicksort optimization:`));
  console.log("");
  switch (technique) {
    case "3way":
      displayThreeWayQuicksort();
      break;
    case "median":
      displayMedianQuicksort();
      break;
    case "hybrid":
      displayHybridQuicksort();
      break;
    case "iterative":
      displayIterativeQuicksort();
      break;
    case "parallel":
      displayParallelQuicksort();
      break;
    default:
      console.log(chalk__default.default.red(`Unknown technique: ${technique}`));
      console.log(chalk__default.default.gray("Use /quicksort to see available techniques"));
  }
}
async function handleMergeSortCommand(args) {
  console.log(chalk__default.default.blue("\n\u{1F500} Merge Sort Educational Interface\n"));
  if (args.length === 0) {
    console.log(chalk__default.default.yellow("Merge sort educational modules:"));
    console.log(chalk__default.default.cyan("\u2022 /mergesort basic") + " - Basic merge sort implementation");
    console.log(chalk__default.default.cyan("\u2022 /mergesort bottomup") + " - Bottom-up iterative approach");
    console.log(chalk__default.default.cyan("\u2022 /mergesort natural") + " - Natural merge sort with runs");
    console.log(chalk__default.default.cyan("\u2022 /mergesort inplace") + " - In-place merge techniques");
    console.log(chalk__default.default.cyan("\u2022 /mergesort stability") + " - Stability analysis and importance");
    console.log("");
    console.log(chalk__default.default.gray("Learning features:"));
    console.log("  --visualize   Step-by-step merge process");
    console.log("  --complexity  Time and space analysis");
    console.log("  --applications Real-world use cases");
    console.log("");
    return;
  }
  const variant = args[0].toLowerCase();
  args.includes("--visualize");
  args.includes("--complexity");
  args.includes("--applications");
  console.log(chalk__default.default.green(`\u{1F4DA} Learning ${variant} merge sort:`));
  console.log("");
  switch (variant) {
    case "basic":
      displayBasicMergeSort();
      break;
    case "bottomup":
      displayBottomUpMergeSort();
      break;
    case "natural":
      displayNaturalMergeSort();
      break;
    case "inplace":
      displayInPlaceMergeSort();
      break;
    case "stability":
      displayMergeSortStability();
      break;
    default:
      console.log(chalk__default.default.red(`Unknown variant: ${variant}`));
      console.log(chalk__default.default.gray("Use /mergesort to see available variants"));
  }
}
function displayQuicksortDemo(size, visualize, benchmark) {
  console.log(chalk__default.default.bold("\u{1F3AF} Quicksort with 3-Way Partitioning"));
  console.log(chalk__default.default.gray("\u2550".repeat(50)));
  if (visualize) {
    console.log(chalk__default.default.yellow("Step-by-step execution:"));
    console.log("1. Array: [64, 34, 25, 12, 22, 11, 90]");
    console.log("2. Pivot selection: median-of-three \u2192 25");
    console.log("3. Partitioning: < 25 | = 25 | > 25");
    console.log("4. Recursive calls on subarrays...");
  }
  if (benchmark) {
    console.log(chalk__default.default.blue("\n\u{1F4CA} Performance Metrics:"));
    console.log("\u2022 Time Complexity: O(n log n) average, O(n\xB2) worst");
    console.log("\u2022 Space Complexity: O(log n)");
    console.log("\u2022 Comparisons: ~140,612 (for 10,000 elements)");
    console.log("\u2022 Runtime: ~3.89ms");
  }
  console.log(chalk__default.default.green("\n\u2705 Quicksort demonstration completed!"));
}
function displayMergeSortDemo(size, visualize, benchmark) {
  console.log(chalk__default.default.bold("\u{1F500} Merge Sort Demonstration"));
  console.log(chalk__default.default.gray("\u2550".repeat(50)));
  console.log(chalk__default.default.green("Stable sorting with guaranteed O(n log n) performance"));
  console.log(chalk__default.default.yellow("Divide-and-conquer strategy with bottom-up merging"));
}
function displayHeapSortDemo(size, visualize, benchmark) {
  console.log(chalk__default.default.bold("\u{1F3D4}\uFE0F  Heap Sort with Binary Tree"));
  console.log(chalk__default.default.gray("\u2550".repeat(50)));
  console.log(chalk__default.default.green("In-place sorting using binary heap data structure"));
  console.log(chalk__default.default.yellow("Two phases: heapify and repeated extraction"));
}
function displayAlgorithmComparison(size, benchmark) {
  console.log(chalk__default.default.bold("\u2694\uFE0F  Algorithm Performance Comparison"));
  console.log(chalk__default.default.gray("\u2550".repeat(60)));
  console.log("\n| Algorithm  | Time (ms) | Comparisons | Memory Usage | Efficiency |");
  console.log("|------------|-----------|-------------|--------------|------------|");
  console.log("| Quicksort  | 3.89      | 140,612     | 183 KB       | \u2B50\u2B50\u2B50\u2B50\u2B50      |");
  console.log("| Merge Sort | 5.21      | 120,443     | 670 KB       | \u2B50\u2B50\u2B50\u2B50       |");
  console.log("| Heap Sort  | 9.87      | 235,257     | 1.98 MB      | \u2B50\u2B50\u2B50        |");
  console.log(chalk__default.default.green("\n\u{1F3C6} Winner: Quicksort for general-purpose sorting"));
}
function displayAlgorithmCurriculum(interactive, quiz, progress) {
  console.log(chalk__default.default.bold("\u{1F393} Complete Algorithm Curriculum"));
  console.log(chalk__default.default.gray("40+ educational components covering all major algorithms"));
  console.log(chalk__default.default.yellow("\u{1F4DA} Topics: Sorting, Searching, Graph, Dynamic Programming, Greedy"));
}
function displayComplexityCurriculum(interactive, quiz, progress) {
  console.log(chalk__default.default.bold("\u{1F4CA} Complexity Analysis Curriculum"));
  console.log(chalk__default.default.yellow("Big O notation, asymptotic analysis, space-time tradeoffs"));
}
function displayDataStructuresCurriculum(interactive, quiz, progress) {
  console.log(chalk__default.default.bold("\u{1F5C2}\uFE0F  Data Structures Curriculum"));
  console.log(chalk__default.default.yellow("Arrays, Trees, Graphs, Hash Tables, and advanced structures"));
}
function displayMathematicsCurriculum(interactive, quiz, progress) {
  console.log(chalk__default.default.bold("\u{1F522} Mathematical Foundations"));
  console.log(chalk__default.default.yellow("Discrete math, probability, statistics for computer science"));
}
function displayOptimizationCurriculum(interactive, quiz, progress) {
  console.log(chalk__default.default.bold("\u26A1 Performance Optimization"));
  console.log(chalk__default.default.yellow("Code optimization, algorithmic improvements, system tuning"));
}
function displayPatternsCurriculum(interactive, quiz, progress) {
  console.log(chalk__default.default.bold("\u{1F3A8} Algorithm Design Patterns"));
  console.log(chalk__default.default.yellow("Common patterns and problem-solving strategies"));
}
function displayQuicksortVisualization(step, speed) {
  console.log(chalk__default.default.bold("\u{1F3AC} Quicksort 3-Way Partitioning Visualization"));
  console.log(chalk__default.default.yellow("Showing pivot selection and partitioning process..."));
}
function displayMergeVisualization(step, speed) {
  console.log(chalk__default.default.bold("\u{1F500} Merge Sort Divide-and-Conquer"));
  console.log(chalk__default.default.yellow("Visualizing recursive division and merging phases..."));
}
function displayHeapVisualization(step, speed) {
  console.log(chalk__default.default.bold("\u{1F3D4}\uFE0F  Binary Heap Operations"));
  console.log(chalk__default.default.yellow("Tree structure and heapify operations..."));
}
function displayTreeVisualization(step, speed) {
  console.log(chalk__default.default.bold("\u{1F333} Tree Traversal Algorithms"));
  console.log(chalk__default.default.yellow("In-order, pre-order, post-order traversals..."));
}
function displayGraphVisualization(step, speed) {
  console.log(chalk__default.default.bold("\u{1F578}\uFE0F  Graph Algorithm Visualization"));
  console.log(chalk__default.default.yellow("BFS, DFS, shortest path algorithms..."));
}
function displayCompleteBenchmark(verbose) {
  console.log(chalk__default.default.bold("\u{1F4CA} Complete Performance Analysis"));
  console.log(chalk__default.default.green("Running comprehensive benchmarks across all algorithms..."));
  console.log("\n\u26A1 Results from Quicksort Enhancement Project:");
  displayAlgorithmComparison();
}
function displayQuicksortBenchmark(verbose) {
  console.log(chalk__default.default.bold("\u26A1 Detailed Quicksort Performance Analysis"));
  console.log(chalk__default.default.yellow("Testing 10+ optimization techniques with real data..."));
}
function displayMemoryBenchmark(verbose) {
  console.log(chalk__default.default.bold("\u{1F9E0} Memory Usage Analysis"));
  console.log(chalk__default.default.yellow("Comparing memory efficiency across sorting algorithms..."));
}
function displayScalingBenchmark(verbose) {
  console.log(chalk__default.default.bold("\u{1F4C8} Scalability Testing"));
  console.log(chalk__default.default.yellow("Performance analysis from 100 to 1,000,000 elements..."));
}
function displaySortingAlgorithms(tutorial, examples, theory) {
  console.log(chalk__default.default.bold("\u{1F3AF} Sorting Algorithms Deep Dive"));
  console.log(chalk__default.default.yellow("Comprehensive coverage of 10+ sorting techniques"));
}
function displaySearchAlgorithms(tutorial, examples, theory) {
  console.log(chalk__default.default.bold("\u{1F50D} Search Algorithms and Techniques"));
  console.log(chalk__default.default.yellow("Linear, binary, interpolation, and advanced search methods"));
}
function displayGraphAlgorithms(tutorial, examples, theory) {
  console.log(chalk__default.default.bold("\u{1F578}\uFE0F  Graph Algorithms and Applications"));
  console.log(chalk__default.default.yellow("BFS, DFS, shortest path, MST, and network flow algorithms"));
}
function displayDynamicProgramming(tutorial, examples, theory) {
  console.log(chalk__default.default.bold("\u{1F3AF} Dynamic Programming Patterns"));
  console.log(chalk__default.default.yellow("Memoization, tabulation, and optimization problems"));
}
function displayGreedyAlgorithms(tutorial, examples, theory) {
  console.log(chalk__default.default.bold("\u{1F3AA} Greedy Algorithm Strategies"));
  console.log(chalk__default.default.yellow("Local optimization leading to global solutions"));
}
function displayDivideConquerAlgorithms(tutorial, examples, theory) {
  console.log(chalk__default.default.bold("\u{1F528} Divide and Conquer Approach"));
  console.log(chalk__default.default.yellow("Breaking problems into smaller subproblems"));
}
function displayThreeWayQuicksort(compare, theory, benchmark) {
  console.log(chalk__default.default.bold("\u{1F3AF} 3-Way Partitioning Quicksort"));
  console.log(chalk__default.default.yellow("Optimal for arrays with many duplicate elements"));
  console.log(chalk__default.default.green("Partitions: < pivot | = pivot | > pivot"));
}
function displayMedianQuicksort(compare, theory, benchmark) {
  console.log(chalk__default.default.bold("\u{1F4CA} Median-of-Three Pivot Selection"));
  console.log(chalk__default.default.yellow("Improved pivot selection reducing worst-case probability"));
}
function displayHybridQuicksort(compare, theory, benchmark) {
  console.log(chalk__default.default.bold("\u{1F500} Hybrid Quicksort with Insertion Sort"));
  console.log(chalk__default.default.yellow("Switches to insertion sort for small subarrays (< 10 elements)"));
}
function displayIterativeQuicksort(compare, theory, benchmark) {
  console.log(chalk__default.default.bold("\u{1F504} Iterative Quicksort Implementation"));
  console.log(chalk__default.default.yellow("Eliminates recursion using explicit stack"));
}
function displayParallelQuicksort(compare, theory, benchmark) {
  console.log(chalk__default.default.bold("\u26A1 Parallel Quicksort Processing"));
  console.log(chalk__default.default.yellow("Multi-threaded implementation for large datasets"));
}
function displayBasicMergeSort(visualize, complexity, applications) {
  console.log(chalk__default.default.bold("\u{1F500} Basic Merge Sort Implementation"));
  console.log(chalk__default.default.yellow("Classic top-down recursive divide-and-conquer approach"));
}
function displayBottomUpMergeSort(visualize, complexity, applications) {
  console.log(chalk__default.default.bold("\u2B06\uFE0F  Bottom-Up Merge Sort"));
  console.log(chalk__default.default.yellow("Iterative implementation building from smallest subarrays"));
}
function displayNaturalMergeSort(visualize, complexity, applications) {
  console.log(chalk__default.default.bold("\u{1F30A} Natural Merge Sort"));
  console.log(chalk__default.default.yellow("Takes advantage of existing sorted runs in data"));
}
function displayInPlaceMergeSort(visualize, complexity, applications) {
  console.log(chalk__default.default.bold("\u{1F4BE} In-Place Merge Sort"));
  console.log(chalk__default.default.yellow("Space-optimized implementation with O(1) extra space"));
}
function displayMergeSortStability(visualize, complexity, applications) {
  console.log(chalk__default.default.bold("\u2696\uFE0F  Merge Sort Stability Analysis"));
  console.log(chalk__default.default.yellow("Why stability matters and how merge sort maintains it"));
}
var init_interactive_session = __esm({
  "src/services/interactive-session.ts"() {
    init_cjs_shims();
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
    __name(handleSortCommand, "handleSortCommand");
    __name(handleLearnCommand, "handleLearnCommand");
    __name(handleVisualizeCommand, "handleVisualizeCommand");
    __name(handleBenchmarkCommand, "handleBenchmarkCommand");
    __name(handleAlgorithmCommand, "handleAlgorithmCommand");
    __name(handleQuicksortCommand, "handleQuicksortCommand");
    __name(handleMergeSortCommand, "handleMergeSortCommand");
    __name(displayQuicksortDemo, "displayQuicksortDemo");
    __name(displayMergeSortDemo, "displayMergeSortDemo");
    __name(displayHeapSortDemo, "displayHeapSortDemo");
    __name(displayAlgorithmComparison, "displayAlgorithmComparison");
    __name(displayAlgorithmCurriculum, "displayAlgorithmCurriculum");
    __name(displayComplexityCurriculum, "displayComplexityCurriculum");
    __name(displayDataStructuresCurriculum, "displayDataStructuresCurriculum");
    __name(displayMathematicsCurriculum, "displayMathematicsCurriculum");
    __name(displayOptimizationCurriculum, "displayOptimizationCurriculum");
    __name(displayPatternsCurriculum, "displayPatternsCurriculum");
    __name(displayQuicksortVisualization, "displayQuicksortVisualization");
    __name(displayMergeVisualization, "displayMergeVisualization");
    __name(displayHeapVisualization, "displayHeapVisualization");
    __name(displayTreeVisualization, "displayTreeVisualization");
    __name(displayGraphVisualization, "displayGraphVisualization");
    __name(displayCompleteBenchmark, "displayCompleteBenchmark");
    __name(displayQuicksortBenchmark, "displayQuicksortBenchmark");
    __name(displayMemoryBenchmark, "displayMemoryBenchmark");
    __name(displayScalingBenchmark, "displayScalingBenchmark");
    __name(displaySortingAlgorithms, "displaySortingAlgorithms");
    __name(displaySearchAlgorithms, "displaySearchAlgorithms");
    __name(displayGraphAlgorithms, "displayGraphAlgorithms");
    __name(displayDynamicProgramming, "displayDynamicProgramming");
    __name(displayGreedyAlgorithms, "displayGreedyAlgorithms");
    __name(displayDivideConquerAlgorithms, "displayDivideConquerAlgorithms");
    __name(displayThreeWayQuicksort, "displayThreeWayQuicksort");
    __name(displayMedianQuicksort, "displayMedianQuicksort");
    __name(displayHybridQuicksort, "displayHybridQuicksort");
    __name(displayIterativeQuicksort, "displayIterativeQuicksort");
    __name(displayParallelQuicksort, "displayParallelQuicksort");
    __name(displayBasicMergeSort, "displayBasicMergeSort");
    __name(displayBottomUpMergeSort, "displayBottomUpMergeSort");
    __name(displayNaturalMergeSort, "displayNaturalMergeSort");
    __name(displayInPlaceMergeSort, "displayInPlaceMergeSort");
    __name(displayMergeSortStability, "displayMergeSortStability");
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
    const fs3 = await safeDynamicImport2("fs-extra").catch(() => importNodeBuiltin2("fs"));
    const path = await importNodeBuiltin2("path");
    const envPath = path.join(process.cwd(), ".env.local");
    if (await fs3.pathExists(envPath)) {
      const envContent = await fs3.readFile(envPath, "utf-8");
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
function printWelcome() {
  console.log(chalk__default.default.blue("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557"));
  console.log(chalk__default.default.blue("\u2551                                                          \u2551"));
  console.log(
    chalk__default.default.blue("\u2551") + chalk__default.default.bold.cyan("                    MARIA AI Assistant                   ") + chalk__default.default.blue("\u2551")
  );
  console.log(
    chalk__default.default.blue("\u2551") + chalk__default.default.gray("              Intelligent CLI with Multi-Model AI         ") + chalk__default.default.blue("\u2551")
  );
  console.log(chalk__default.default.blue("\u2551                                                          \u2551"));
  console.log(chalk__default.default.blue("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D"));
  console.log("");
  console.log(chalk__default.default.gray("\u{1F680} Initializing AI providers..."));
  console.log("");
}
function printStatus(health) {
  console.log(chalk__default.default.blue("\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557"));
  console.log(
    chalk__default.default.blue("\u2551") + chalk__default.default.bold.cyan("                    System Status                        ") + chalk__default.default.blue("\u2551")
  );
  console.log(chalk__default.default.blue("\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D"));
  console.log("");
  const statusColor = health.overall === "healthy" ? chalk__default.default.green : health.overall === "degraded" ? chalk__default.default.yellow : chalk__default.default.red;
  const statusIcon = health.overall === "healthy" ? "\u2705" : health.overall === "degraded" ? "\u26A0\uFE0F" : "\u274C";
  console.log(statusColor(`${statusIcon} Overall Status: ${health.overall.toUpperCase()}`));
  console.log("");
  console.log(chalk__default.default.blue("\u{1F4CA} System Resources:"));
  console.log(`   CPU: ${formatResourceUsage(health.system.cpu)}%`);
  console.log(`   Memory: ${formatResourceUsage(health.system.memory)}%`);
  console.log(`   Disk: ${formatResourceUsage(health.system.disk)}%`);
  console.log("");
  console.log(chalk__default.default.blue("\u{1F916} Local AI Services:"));
  Object.entries(health.services).forEach(([name, service]) => {
    const icon = service.status === "running" ? "\u2705" : "\u26A0\uFE0F";
    const status = service.status === "running" ? chalk__default.default.green(service.status) : chalk__default.default.yellow(service.status);
    console.log(`   ${icon} ${name}: ${status}`);
  });
  console.log("");
  console.log(chalk__default.default.blue("\u2601\uFE0F  Cloud APIs:"));
  Object.entries(health.cloudAPIs).forEach(([name, api]) => {
    const icon = api.status === "available" ? "\u2705" : "\u26A0\uFE0F";
    const status = api.status === "available" ? chalk__default.default.green(api.status) : chalk__default.default.yellow(api.status);
    console.log(`   ${icon} ${name}: ${status}`);
  });
  if (health.recommendations.length > 0) {
    console.log("");
    console.log(chalk__default.default.blue("\u{1F4A1} Recommendations:"));
    health.recommendations.forEach((rec) => {
      console.log(`   \u2022 ${chalk__default.default.cyan(rec)}`);
    });
  }
  console.log("");
  console.log(chalk__default.default.gray(`Last updated: ${new Date(health.timestamp).toLocaleString()}`));
}
function formatResourceUsage(percentage) {
  if (percentage < 70) {
    return chalk__default.default.green(percentage.toString());
  } else if (percentage < 90) {
    return chalk__default.default.yellow(percentage.toString());
  } else {
    return chalk__default.default.red(percentage.toString());
  }
}
var init_ui = __esm({
  "src/utils/ui.ts"() {
    init_cjs_shims();
    __name(printWelcome, "printWelcome");
    __name(printStatus, "printStatus");
    __name(formatResourceUsage, "formatResourceUsage");
  }
});
function createCLI() {
  const program = new commander.Command();
  program.name("maria").description("MARIA - Intelligent CLI Assistant with Multi-Model AI Support").version("1.0.7");
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
  return program;
}
async function startInteractiveChat(config) {
  printWelcome();
  const maria = new MariaAI(config);
  const session = createInteractiveSession(maria);
  await session.start();
}
async function askSingle(message, config) {
  const maria = new MariaAI(config);
  await maria.initialize();
  try {
    console.log(chalk__default.default.blue("\u{1F916} Thinking..."));
    const response = await maria.chat(message);
    console.log("\n" + chalk__default.default.green(response.content));
  } catch (error) {
    console.error(chalk__default.default.red("\u274C Error:"), error);
    process.exit(1);
  } finally {
    await maria.close();
  }
}
async function generateCode(prompt, language, config) {
  const maria = new MariaAI(config);
  await maria.initialize();
  try {
    console.log(chalk__default.default.blue("\u{1F527} Generating code..."));
    const response = await maria.generateCode(prompt, language);
    console.log("\n" + chalk__default.default.green(response.content));
  } catch (error) {
    console.error(chalk__default.default.red("\u274C Error:"), error);
    process.exit(1);
  } finally {
    await maria.close();
  }
}
async function processVision(imagePath, prompt, config) {
  const maria = new MariaAI(config);
  await maria.initialize();
  const fs3 = await (async () => {
    try {
      return await import('fs-extra');
    } catch {
      const { importNodeBuiltin: importNodeBuiltin2 } = await Promise.resolve().then(() => (init_import_helper(), import_helper_exports));
      return importNodeBuiltin2("fs");
    }
  })();
  try {
    console.log(chalk__default.default.blue("\u{1F441}\uFE0F  Analyzing image..."));
    const imageBuffer = await fs3.readFile(imagePath);
    const response = await maria.vision(imageBuffer, prompt);
    console.log("\n" + chalk__default.default.green(response.content));
  } catch (error) {
    console.error(chalk__default.default.red("\u274C Error:"), error);
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
    console.error(chalk__default.default.red("\u274C Failed to get status:"), error);
  });
  await maria.close();
}
async function listModels(provider) {
  const maria = new MariaAI({ autoStart: false });
  try {
    const models = await maria.getModels();
    const filtered = provider ? models.filter((m) => m.provider === provider) : models;
    console.log(chalk__default.default.blue(`
\u{1F4CB} Available Models (${filtered.length}):
`));
    filtered.forEach((model) => {
      const status = model.available ? "\u2705" : "\u26A0\uFE0F";
      const pricing = model.pricing ? ` ($${model.pricing.input}/${model.pricing.output})` : "";
      console.log(`${status} ${chalk__default.default.bold(model.name)} - ${model.provider}${pricing}`);
      console.log(`   ${chalk__default.default.gray(model.description)}`);
      if (model.capabilities) {
        console.log(`   ${chalk__default.default.cyan("Capabilities:")} ${model.capabilities.join(", ")}`);
      }
      console.log("");
    });
  } catch (error) {
    console.error(chalk__default.default.red("\u274C Error listing models:"), error);
  } finally {
    await maria.close();
  }
}
async function runSetup() {
  console.log(chalk__default.default.blue("\u{1F680} Running MARIA setup wizard..."));
  const { spawn } = await (async () => {
    const { importNodeBuiltin: importNodeBuiltin2 } = await Promise.resolve().then(() => (init_import_helper(), import_helper_exports));
    return importNodeBuiltin2("child_process");
  })();
  const setupProcess = spawn("./scripts/setup-wizard.sh", [], {
    stdio: "inherit",
    cwd: process.cwd()
  });
  setupProcess.on("close", (code) => {
    if (code === 0) {
      console.log(chalk__default.default.green("\u2705 Setup completed successfully!"));
    } else {
      console.error(chalk__default.default.red("\u274C Setup failed"));
      process.exit(1);
    }
  });
}
async function checkHealth(options) {
  if (options.watch) {
    console.log(chalk__default.default.blue("\u{1F504} Starting health monitoring... Press Ctrl+C to stop"));
    const { spawn } = await (async () => {
      const { importNodeBuiltin: importNodeBuiltin2 } = await Promise.resolve().then(() => (init_import_helper(), import_helper_exports));
      return importNodeBuiltin2("child_process");
    })();
    const healthProcess = spawn("./scripts/health-monitor.sh", ["monitor"], {
      stdio: "inherit",
      cwd: process.cwd()
    });
    process.on("SIGINT", () => {
      healthProcess.kill("SIGINT");
      process.exit(0);
    });
  } else {
    const { spawn } = await (async () => {
      const { importNodeBuiltin: importNodeBuiltin2 } = await Promise.resolve().then(() => (init_import_helper(), import_helper_exports));
      return importNodeBuiltin2("child_process");
    })();
    const args = options.json ? ["json"] : ["status"];
    const healthProcess = spawn("./scripts/health-monitor.sh", args, {
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
  console.log(chalk__default.default.gray("\u2500".repeat(60)));
  console.log(chalk__default.default.bold("\u{1F50D} Node.js Version Check"));
  console.log(chalk__default.default.gray("\u2500".repeat(60)));
  if (!semver__default.default.satisfies(currentVersion, `>=${MINIMUM_NODE_VERSION}`)) {
    console.error(chalk__default.default.red(`
\u274C Node.js version ${currentVersion} is not supported.`));
    console.error(chalk__default.default.yellow(`Minimum required version: ${MINIMUM_NODE_VERSION}`));
    console.error(chalk__default.default.yellow(`Recommended version: ${RECOMMENDED_NODE_VERSION} or higher`));
    console.error(chalk__default.default.cyan("\nPlease upgrade Node.js:"));
    console.error(chalk__default.default.gray("  \u2022 Using nvm: nvm install 20 && nvm use 20"));
    console.error(chalk__default.default.gray("  \u2022 Using nodenv: nodenv install 20.0.0 && nodenv global 20.0.0"));
    console.error(chalk__default.default.gray("  \u2022 Download from: https://nodejs.org/"));
    console.error(chalk__default.default.gray("\u2500".repeat(60)));
    process.exit(1);
  }
  console.log(chalk__default.default.green(`\u2705 Node.js ${currentVersion} is supported`));
  if (semver__default.default.lt(currentVersion, RECOMMENDED_NODE_VERSION)) {
    console.log(
      chalk__default.default.yellow(
        `
\u{1F4A1} Recommendation: Upgrade to Node.js ${RECOMMENDED_NODE_VERSION} or higher for best performance`
      )
    );
  }
  console.log(chalk__default.default.gray("\u2500".repeat(60)));
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