// src/config/vertex-ai.ts
import { GoogleAuth } from "google-auth-library";
import { VertexAI, HarmCategory, HarmBlockThreshold } from "@google-cloud/vertexai";
var VertexAIClient = class {
  constructor(config) {
    this.config = config;
    this.auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"]
    });
    this.vertexAI = new VertexAI({
      project: config.projectId,
      location: config.location,
      apiEndpoint: config.apiEndpoint
    });
  }
  vertexAI;
  auth;
  async getGeminiModel(modelName = "gemini-2.5-pro") {
    return this.vertexAI.preview.getGenerativeModel({
      model: modelName,
      generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.7,
        topP: 0.95,
        topK: 40
      },
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
        },
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
        }
      ]
    });
  }
  async generateEmbedding(text) {
    const model = "text-embedding-004";
    const request = {
      instances: [{ content: text }]
    };
    const endpoint = `projects/${this.config.projectId}/locations/${this.config.location}/publishers/google/models/${model}:predict`;
    const accessToken = await this.auth.getAccessToken();
    const response = await fetch(
      `https://${this.config.location}-aiplatform.googleapis.com/v1/${endpoint}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(request)
      }
    );
    if (!response.ok) {
      throw new Error(`Embedding generation failed: ${response.statusText}`);
    }
    const data = await response.json();
    return data.predictions[0].embeddings.values;
  }
};
function createVertexAIClient() {
  const projectId = process.env.GCP_PROJECT_ID || "maria-code";
  const location = process.env.GCP_REGION || "asia-northeast1";
  return new VertexAIClient({
    projectId,
    location
  });
}

// src/config/neo4j.ts
import neo4j from "neo4j-driver";
var Neo4jClient = class {
  constructor(config) {
    this.config = config;
    this.driver = neo4j.driver(
      config.uri,
      neo4j.auth.basic(config.username, config.password),
      {
        maxConnectionLifetime: 3 * 60 * 60 * 1e3,
        // 3 hours
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: 2 * 60 * 1e3
        // 120 seconds
      }
    );
  }
  driver;
  async verifyConnectivity() {
    const session = this.driver.session();
    try {
      await session.run("RETURN 1");
    } finally {
      await session.close();
    }
  }
  getSession(database) {
    return this.driver.session({
      database: database || this.config.database || "neo4j"
    });
  }
  async executeQuery(query, parameters = {}, database) {
    const session = this.getSession(database);
    try {
      const result = await session.run(query, parameters);
      return result.records.map((record) => record.toObject());
    } finally {
      await session.close();
    }
  }
  async executeWrite(query, parameters = {}, database) {
    const session = this.getSession(database);
    try {
      const result = await session.writeTransaction(
        async (tx) => tx.run(query, parameters)
      );
      return result.records.map((record) => record.toObject());
    } finally {
      await session.close();
    }
  }
  async close() {
    await this.driver.close();
  }
};
async function createNeo4jClient() {
  const uri = process.env.NEO4J_URI || "";
  const username = process.env.NEO4J_USERNAME || "neo4j";
  const password = process.env.NEO4J_PASSWORD || "";
  if (!uri || !password) {
    throw new Error("Neo4j connection details not configured");
  }
  const client = new Neo4jClient({
    uri,
    username,
    password,
    database: process.env.NEO4J_DATABASE
  });
  await client.verifyConnectivity();
  return client;
}

// src/services/llm-service.ts
import { VertexAI as VertexAI2 } from "@google-cloud/vertexai";
var LLMService = class {
  geminiClient = null;
  grokApiKey = null;
  constructor() {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (geminiApiKey) {
      this.geminiClient = new VertexAI2({
        project: process.env.MARIA_PROJECT_ID || "maria-code",
        location: "us-central1"
      });
    }
    this.grokApiKey = process.env.GROK_API_KEY || null;
  }
  /**
   * Generate completion using specified LLM provider
   */
  async generateCompletion(messages, config = { provider: "gemini" }) {
    const { provider, temperature = 0.7, maxTokens = 2048, stream = false } = config;
    switch (provider) {
      case "gemini":
        return this.generateGeminiCompletion(messages, {
          model: config.model || "gemini-2.5-pro-preview-06-05",
          temperature,
          maxTokens,
          stream
        });
      case "grok":
        return this.generateGrokCompletion(messages, {
          model: config.model || "grok-4-latest",
          temperature,
          maxTokens,
          stream
        });
      default:
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }
  }
  /**
   * Generate completion using Gemini 2.5 Pro with multimodal support
   */
  async generateGeminiCompletion(messages, config) {
    if (!this.geminiClient) {
      throw new Error("Gemini client not initialized. Check GEMINI_API_KEY environment variable.");
    }
    const { model, temperature } = config;
    const contents = messages.filter((msg) => msg.role !== "system").map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: this.convertContentToParts(msg.content)
    }));
    const systemMessage = messages.find((msg) => msg.role === "system");
    if (systemMessage && contents.length > 0 && contents[0]) {
      const systemParts = this.convertContentToParts(systemMessage.content);
      if (contents[0].role === "user" && contents[0].parts) {
        contents[0].parts = [...systemParts, ...contents[0].parts];
      }
    }
    const generationConfig = {
      temperature,
      maxOutputTokens: config.maxTokens,
      responseMimeType: "text/plain"
    };
    try {
      if (config.stream) {
        const genModel = this.geminiClient.getGenerativeModel({ model });
        const result = await genModel.generateContentStream({
          contents,
          generationConfig
        });
        let fullContent = "";
        for await (const chunk of result.stream) {
          const chunkText = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
          if (chunkText) {
            fullContent += chunkText;
          }
        }
        return {
          content: fullContent,
          provider: "gemini",
          model,
          finishReason: "stop"
        };
      } else {
        const genModel = this.geminiClient.getGenerativeModel({ model });
        const result = await genModel.generateContent({
          contents,
          generationConfig
        });
        const response = await result.response;
        const content = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
        return {
          content,
          provider: "gemini",
          model,
          usage: {
            promptTokens: 0,
            // Gemini doesn't provide token counts in this format
            completionTokens: 0,
            totalTokens: 0
          },
          finishReason: "stop"
        };
      }
    } catch (error) {
      console.error("Gemini API error:", error);
      throw new Error(`Gemini API error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  /**
   * Generate completion using Grok-4 with multimodal support
   */
  async generateGrokCompletion(messages, config) {
    if (!this.grokApiKey) {
      throw new Error("Grok API key not found. Check GROK_API_KEY environment variable.");
    }
    const { model, temperature, maxTokens, stream } = config;
    const formattedMessages = messages.map((msg) => ({
      role: msg.role,
      content: this.convertContentToOpenAIFormat(msg.content)
    }));
    const requestBody = {
      model,
      messages: formattedMessages,
      temperature,
      max_tokens: maxTokens,
      stream,
      top_p: 1
    };
    try {
      const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.grokApiKey}`
        },
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Grok API error (${response.status}): ${errorText}`);
      }
      if (stream) {
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("Failed to get response reader");
        }
        let fullContent = "";
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split("\n").filter((line) => line.trim() !== "");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  fullContent += content;
                }
              } catch (e) {
                console.warn("Failed to parse streaming chunk:", e);
              }
            }
          }
        }
        return {
          content: fullContent,
          provider: "grok",
          model,
          finishReason: "stop"
        };
      } else {
        const data = await response.json();
        const choice = data.choices?.[0];
        if (!choice) {
          throw new Error("No choices returned from Grok API");
        }
        return {
          content: choice.message?.content || "",
          provider: "grok",
          model,
          usage: data.usage ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens
          } : void 0,
          finishReason: choice.finish_reason
        };
      }
    } catch (error) {
      console.error("Grok API error:", error);
      throw new Error(`Grok API error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
  /**
   * Convert content to Gemini parts format
   */
  convertContentToParts(content) {
    if (typeof content === "string") {
      return [{ text: content }];
    }
    return content.map((item) => {
      switch (item.type) {
        case "text":
          return { text: item.text || "" };
        case "image":
          if (item.imageUrl) {
            return {
              inlineData: {
                mimeType: item.mimeType || "image/jpeg",
                data: item.imageUrl.includes("base64,") ? item.imageUrl.split("base64,")[1] || "" : item.imageUrl
              }
            };
          }
          return { text: "[Image]" };
        default:
          return { text: "[Unsupported content type]" };
      }
    });
  }
  /**
   * Convert content to OpenAI format for Grok
   */
  convertContentToOpenAIFormat(content) {
    if (typeof content === "string") {
      return content;
    }
    return content.map((item) => {
      switch (item.type) {
        case "text":
          return {
            type: "text",
            text: item.text || ""
          };
        case "image":
          return {
            type: "image_url",
            image_url: {
              url: item.imageUrl || "",
              detail: "high"
            }
          };
        default:
          return {
            type: "text",
            text: "[Unsupported content type]"
          };
      }
    });
  }
  /**
   * Check if a provider is available (has required API keys)
   */
  isProviderAvailable(provider) {
    switch (provider) {
      case "gemini":
        return !!this.geminiClient;
      case "grok":
        return !!this.grokApiKey;
      default:
        return false;
    }
  }
  /**
   * Get available providers
   */
  getAvailableProviders() {
    const providers = [];
    if (this.isProviderAvailable("gemini")) {
      providers.push("gemini");
    }
    if (this.isProviderAvailable("grok")) {
      providers.push("grok");
    }
    return providers;
  }
  /**
   * Get supported models for a provider
   */
  getSupportedModels(provider) {
    switch (provider) {
      case "gemini":
        return [
          "gemini-2.5-pro-preview-06-05",
          "gemini-1.5-pro",
          "gemini-1.5-flash"
        ];
      case "grok":
        return [
          "grok-4-latest",
          "grok-4",
          "grok-beta"
        ];
      default:
        return [];
    }
  }
};
var llmService = new LLMService();

// src/agents/conversation-manager.ts
var ConversationManager = class {
  vertexAI;
  activeContexts;
  config;
  constructor(vertexAI, config) {
    this.vertexAI = vertexAI;
    this.activeContexts = /* @__PURE__ */ new Map();
    this.config = {
      maxHistoryLength: 50,
      contextRetentionTime: 24 * 60 * 60 * 1e3,
      // 24 hours
      autoSaveInterval: 5 * 60 * 1e3,
      // 5 minutes
      ...config
    };
  }
  /**
   * Initialize a new conversation session
   */
  async initializeConversation(sessionId, type, initialMessage, contextId) {
    const context = {
      type,
      id: contextId,
      history: [],
      state: {
        phase: "initiation",
        pendingActions: [],
        completedActions: [],
        workingMemory: {}
      }
    };
    if (initialMessage) {
      context.history.push({
        role: "user",
        content: initialMessage,
        timestamp: /* @__PURE__ */ new Date()
      });
      const systemResponse = await this.generateSystemResponse(context);
      context.history.push(systemResponse);
    }
    this.activeContexts.set(sessionId, context);
    return context;
  }
  /**
   * Process a new message in an existing conversation
   */
  async processMessage(sessionId, message, metadata) {
    const context = this.activeContexts.get(sessionId);
    if (!context) {
      throw new Error(`No active conversation found for session: ${sessionId}`);
    }
    const userMessage = {
      role: "user",
      content: message,
      timestamp: /* @__PURE__ */ new Date(),
      metadata
    };
    context.history.push(userMessage);
    await this.updateConversationState(context, message);
    const assistantResponse = await this.generateAssistantResponse(context);
    context.history.push(assistantResponse);
    this.trimHistoryIfNeeded(context);
    return assistantResponse;
  }
  /**
   * Get conversation context for a session
   */
  getConversationContext(sessionId) {
    return this.activeContexts.get(sessionId);
  }
  /**
   * Update conversation state based on user input
   */
  async updateConversationState(context, message) {
    const model = await this.vertexAI.getGeminiModel();
    const stateAnalysisPrompt = `
Analyze this user message and current conversation state to determine the next phase and actions.

Current State:
- Phase: ${context.state.phase}
- Current Task: ${context.state.currentTask || "None"}
- Pending Actions: ${context.state.pendingActions.join(", ")}

User Message: "${message}"
Context Type: ${context.type}

Based on this information, determine:
1. Next conversation phase (initiation/analysis/planning/execution/review/completion)
2. Current task description
3. New pending actions to add
4. Actions to mark as completed

Respond in JSON format:
{
  "phase": "...",
  "currentTask": "...",
  "newPendingActions": ["..."],
  "completedActions": ["..."],
  "workingMemoryUpdates": {}
}
`;
    try {
      const result = await model.generateContent(stateAnalysisPrompt);
      const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const stateUpdate = JSON.parse(responseText);
      context.state.phase = stateUpdate.phase || context.state.phase;
      context.state.currentTask = stateUpdate.currentTask || context.state.currentTask;
      if (stateUpdate.newPendingActions) {
        context.state.pendingActions.push(...stateUpdate.newPendingActions);
      }
      if (stateUpdate.completedActions) {
        stateUpdate.completedActions.forEach((action) => {
          const index = context.state.pendingActions.indexOf(action);
          if (index > -1) {
            context.state.pendingActions.splice(index, 1);
            context.state.completedActions.push(action);
          }
        });
      }
      if (stateUpdate.workingMemoryUpdates) {
        Object.assign(context.state.workingMemory, stateUpdate.workingMemoryUpdates);
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Failed to update conversation state:", error);
      }
    }
  }
  /**
   * Generate system response for conversation initiation
   */
  async generateSystemResponse(context) {
    const model = await this.vertexAI.getGeminiModel();
    const systemPrompt = `
You are an AI assistant specialized in helping with ${context.type} tasks in the MARIA platform.

Context Type: ${context.type}
User's First Message: ${context.history[0]?.content || "Starting conversation"}

Generate a helpful initial response that:
1. Acknowledges the user's request
2. Asks clarifying questions if needed
3. Outlines how you can help
4. Sets expectations for the conversation

Keep the response friendly, professional, and focused on the specific context type.
`;
    const result = await model.generateContent(systemPrompt);
    return {
      role: "assistant",
      content: result.response.candidates?.[0]?.content?.parts?.[0]?.text || "I apologize, but I encountered an issue generating a response.",
      timestamp: /* @__PURE__ */ new Date(),
      metadata: {
        contextType: context.type,
        phase: context.state.phase
      }
    };
  }
  /**
   * Generate assistant response based on current context
   */
  async generateAssistantResponse(context) {
    const model = await this.vertexAI.getGeminiModel();
    const recentHistory = context.history.slice(-10).map((msg) => `${msg.role}: ${msg.content}`).join("\n");
    const responsePrompt = `
You are an AI assistant helping with ${context.type} tasks in the MARIA platform.

Current Conversation State:
- Phase: ${context.state.phase}
- Current Task: ${context.state.currentTask || "None"}
- Pending Actions: ${context.state.pendingActions.join(", ")}
- Completed Actions: ${context.state.completedActions.join(", ")}

Recent Conversation:
${recentHistory}

Generate a helpful response that:
1. Addresses the user's latest message
2. Provides actionable guidance
3. Moves the conversation forward toward task completion
4. Maintains context awareness of the ongoing work

For ${context.type} context, focus on relevant domain expertise and practical assistance.
`;
    const result = await model.generateContent(responsePrompt);
    return {
      role: "assistant",
      content: result.response.candidates?.[0]?.content?.parts?.[0]?.text || "I apologize, but I encountered an issue generating a response.",
      timestamp: /* @__PURE__ */ new Date(),
      metadata: {
        contextType: context.type,
        phase: context.state.phase,
        currentTask: context.state.currentTask
      }
    };
  }
  /**
   * Trim conversation history if it exceeds maximum length
   */
  trimHistoryIfNeeded(context) {
    if (context.history.length > this.config.maxHistoryLength) {
      const firstMessage = context.history[0];
      const recentMessages = context.history.slice(-this.config.maxHistoryLength + 1);
      if (firstMessage) {
        context.history = [firstMessage, ...recentMessages];
      } else {
        context.history = recentMessages;
      }
    }
  }
  /**
   * Clean up expired conversations
   */
  cleanupExpiredConversations() {
    const now = Date.now();
    const expiredSessions = [];
    for (const [sessionId, context] of this.activeContexts.entries()) {
      const lastMessage = context.history[context.history.length - 1];
      const lastActivity = lastMessage ? lastMessage.timestamp : /* @__PURE__ */ new Date(0);
      if (now - lastActivity.getTime() > this.config.contextRetentionTime) {
        expiredSessions.push(sessionId);
      }
    }
    expiredSessions.forEach((sessionId) => {
      this.activeContexts.delete(sessionId);
    });
  }
  /**
   * Get conversation statistics
   */
  getStats() {
    const stats = {
      activeConversations: this.activeContexts.size,
      conversationsByType: {},
      conversationsByPhase: {}
    };
    for (const context of this.activeContexts.values()) {
      stats.conversationsByType[context.type] = (stats.conversationsByType[context.type] || 0) + 1;
      stats.conversationsByPhase[context.state.phase] = (stats.conversationsByPhase[context.state.phase] || 0) + 1;
    }
    return stats;
  }
};

// src/agents/rtf-parser.ts
var RTFParser = class {
  vertexAI;
  intentCache;
  rtfCache;
  constructor(vertexAI) {
    this.vertexAI = vertexAI;
    this.intentCache = /* @__PURE__ */ new Map();
    this.rtfCache = /* @__PURE__ */ new Map();
  }
  /**
   * Parse natural language input into RTF structure
   */
  async parseRTF(input, context) {
    const cacheKey = this.generateCacheKey(input, context);
    const cached = this.rtfCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const model = await this.vertexAI.getGeminiModel();
    const parsePrompt = `
Analyze this natural language input and extract the Role, Task, and Format (RTF) structure.

Input: "${input}"
${context ? `Context: ${JSON.stringify(context, null, 2)}` : ""}

Extract and structure the following information in JSON format:

{
  "role": "The role or persona the user wants the AI to assume (e.g., 'academic advisor', 'technical writer', 'project manager')",
  "task": {
    "type": "paper|presentation|project|code|analysis|general",
    "intent": "Primary goal or objective",
    "description": "Detailed description of what needs to be done",
    "scope": "single-action|multi-step|iterative|collaborative",
    "priority": "low|medium|high|urgent",
    "requirements": ["List of specific requirements"],
    "constraints": ["Any limitations or constraints"],
    "dependencies": ["Prerequisites or dependencies"],
    "expectedOutcome": "What the user expects as a result"
  },
  "format": {
    "outputType": "document|presentation|code|analysis|conversation|mixed",
    "structure": "linear|hierarchical|iterative|collaborative",
    "style": "formal|casual|technical|academic|creative",
    "deliverables": [
      {
        "name": "Deliverable name",
        "type": "Type of deliverable",
        "description": "What this deliverable contains",
        "format": "Specific format requirements",
        "priority": "must-have|should-have|could-have"
      }
    ],
    "timeline": {
      "estimatedDuration": "Rough time estimate",
      "milestones": [
        {
          "name": "Milestone name",
          "description": "What needs to be achieved",
          "estimatedTime": "Time estimate for this milestone",
          "dependencies": ["Dependencies for this milestone"]
        }
      ],
      "urgency": "immediate|hours|days|weeks|months"
    }
  },
  "confidence": 0.0-1.0,
  "metadata": {
    "language": "detected language",
    "complexity": "simple|moderate|complex|very-complex",
    "domain": "detected domain or field",
    "keywords": ["key terms extracted"]
  }
}

Be thorough but realistic in your analysis. If information is not explicitly provided, make reasonable inferences based on context and common patterns.
`;
    try {
      const result = await model.generateContent(parsePrompt);
      const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const rtfStructure = JSON.parse(responseText);
      const validatedRTF = this.validateAndEnhanceRTF(rtfStructure, input);
      this.rtfCache.set(cacheKey, validatedRTF);
      return validatedRTF;
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Failed to parse RTF structure:", error);
      }
      return this.createFallbackRTF(input);
    }
  }
  /**
   * Extract intent and entities from natural language
   */
  async parseIntent(input, context) {
    const cacheKey = `intent:${input}`;
    const cached = this.intentCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const model = await this.vertexAI.getGeminiModel();
    const intentPrompt = `
Analyze this natural language input and extract intent, entities, and other relevant information.

Input: "${input}"
${context ? `Context: ${JSON.stringify(context, null, 2)}` : ""}

Extract the following information in JSON format:

{
  "primaryIntent": "Main goal or action the user wants (e.g., 'create_document', 'get_help', 'edit_content')",
  "secondaryIntents": ["Additional or supporting intents"],
  "entities": [
    {
      "type": "person|project|document|deadline|technology|concept|location",
      "value": "Extracted entity value",
      "confidence": 0.0-1.0,
      "context": "Surrounding context for this entity"
    }
  ],
  "sentiment": "positive|neutral|negative|frustrated|excited",
  "urgency": "low|medium|high|urgent",
  "complexity": "simple|moderate|complex|very-complex"
}

Be precise and extract all relevant entities and intents.
`;
    try {
      const result = await model.generateContent(intentPrompt);
      const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const parsedIntent = JSON.parse(responseText);
      this.intentCache.set(cacheKey, parsedIntent);
      return parsedIntent;
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Failed to parse intent:", error);
      }
      return {
        primaryIntent: "general_assistance",
        secondaryIntents: [],
        entities: [],
        sentiment: "neutral",
        urgency: "medium",
        complexity: "moderate"
      };
    }
  }
  /**
   * Convert RTF structure to actionable steps
   */
  async rtfToActionPlan(rtf) {
    const model = await this.vertexAI.getGeminiModel();
    const planPrompt = `
Convert this RTF structure into a detailed action plan with steps, resources, and risk assessment.

RTF Structure:
${JSON.stringify(rtf, null, 2)}

Generate a comprehensive action plan in JSON format:

{
  "steps": [
    {
      "id": "unique_step_id",
      "name": "Step name",
      "description": "Detailed description of what to do",
      "type": "research|analysis|creation|review|communication|technical",
      "estimatedTime": "Time estimate",
      "prerequisites": ["Previous steps required"],
      "deliverable": "What this step produces",
      "tools": ["Tools or resources needed"],
      "validationCriteria": ["How to verify completion"]
    }
  ],
  "resources": [
    {
      "type": "human|tool|data|infrastructure|external",
      "name": "Resource name",
      "description": "What this resource provides",
      "availability": "available|limited|unavailable|unknown",
      "criticality": "essential|important|helpful|optional"
    }
  ],
  "riskAssessment": [
    {
      "type": "technical|timeline|resource|quality|external",
      "description": "Description of the risk",
      "probability": "low|medium|high",
      "impact": "low|medium|high|critical",
      "mitigation": "How to reduce or handle this risk"
    }
  ]
}

Make the action plan practical and executable.
`;
    try {
      const result = await model.generateContent(planPrompt);
      const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return JSON.parse(responseText);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Failed to generate action plan:", error);
      }
      return {
        steps: [{
          id: "step_1",
          name: "Initial Analysis",
          description: "Analyze the requirements and plan next steps",
          type: "analysis",
          estimatedTime: "1 hour",
          prerequisites: [],
          deliverable: "Analysis report",
          tools: ["AI Assistant"],
          validationCriteria: ["Requirements understood"]
        }],
        resources: [{
          type: "tool",
          name: "AI Assistant",
          description: "Provides guidance and assistance",
          availability: "available",
          criticality: "essential"
        }],
        riskAssessment: [{
          type: "timeline",
          description: "Task may take longer than estimated",
          probability: "medium",
          impact: "medium",
          mitigation: "Break down into smaller steps and reassess regularly"
        }]
      };
    }
  }
  /**
   * Validate and enhance RTF structure
   */
  validateAndEnhanceRTF(rtf, originalInput) {
    if (!rtf.role) {
      rtf.role = "AI Assistant";
    }
    if (!rtf.task) {
      rtf.task = {
        type: "general",
        intent: "assist_user",
        description: originalInput,
        scope: "single-action",
        priority: "medium",
        requirements: [],
        constraints: [],
        dependencies: [],
        expectedOutcome: "User assistance provided"
      };
    }
    if (!rtf.format) {
      rtf.format = {
        outputType: "conversation",
        structure: "linear",
        style: "casual",
        deliverables: [{
          name: "Response",
          type: "text",
          description: "AI generated response",
          format: "natural language",
          priority: "must-have"
        }],
        timeline: {
          estimatedDuration: "minutes",
          milestones: [],
          urgency: "hours"
        }
      };
    }
    if (rtf.confidence < 0 || rtf.confidence > 1) {
      rtf.confidence = 0.7;
    }
    return rtf;
  }
  /**
   * Create fallback RTF structure when parsing fails
   */
  createFallbackRTF(input) {
    return {
      role: "AI Assistant",
      task: {
        type: "general",
        intent: "general_assistance",
        description: input,
        scope: "single-action",
        priority: "medium",
        requirements: ["Understand user request"],
        constraints: [],
        dependencies: [],
        expectedOutcome: "Helpful response provided"
      },
      format: {
        outputType: "conversation",
        structure: "linear",
        style: "casual",
        deliverables: [{
          name: "AI Response",
          type: "text",
          description: "Natural language response to user query",
          format: "conversational",
          priority: "must-have"
        }],
        timeline: {
          estimatedDuration: "immediate",
          milestones: [{
            name: "Generate Response",
            description: "Create helpful response to user input",
            estimatedTime: "seconds",
            dependencies: []
          }],
          urgency: "immediate"
        }
      },
      confidence: 0.5,
      metadata: {
        language: "english",
        complexity: "moderate",
        domain: "general",
        keywords: input.split(" ").slice(0, 5),
        fallback: true
      }
    };
  }
  /**
   * Generate cache key for RTF parsing
   */
  generateCacheKey(input, context) {
    const contextStr = context ? JSON.stringify(context) : "";
    return `rtf:${input}:${contextStr}`;
  }
  /**
   * Clear parser caches
   */
  clearCache() {
    this.intentCache.clear();
    this.rtfCache.clear();
  }
  /**
   * Get parser statistics
   */
  getStats() {
    return {
      intentCacheSize: this.intentCache.size,
      rtfCacheSize: this.rtfCache.size,
      cacheHitRate: 0
      // TODO: Implement cache hit tracking
    };
  }
};

// src/agents/sow-generator.ts
var SOWGenerator = class {
  vertexAI;
  templates;
  constructor(vertexAI) {
    this.vertexAI = vertexAI;
    this.templates = /* @__PURE__ */ new Map();
    this.initializeTemplates();
  }
  /**
   * Generate SOW from RTF structure
   */
  async generateSOW(rtf, options = {}) {
    const model = await this.vertexAI.getGeminiModel();
    const sowPrompt = `
Generate a comprehensive Statement of Work (SOW) document based on this RTF structure and options.

RTF Structure:
${JSON.stringify(rtf, null, 2)}

Options:
${JSON.stringify(options, null, 2)}

Create a detailed SOW in JSON format with the following structure:

{
  "id": "unique_sow_id",
  "title": "Descriptive project title",
  "description": "Comprehensive project description",
  "scope": {
    "overview": "High-level project overview",
    "objectives": ["Primary project objectives"],
    "inclusions": ["What is included in scope"],
    "exclusions": ["What is explicitly excluded"],
    "boundaries": ["Project boundaries and limitations"]
  },
  "deliverables": [
    {
      "id": "deliverable_id",
      "name": "Deliverable name",
      "description": "Detailed description",
      "type": "document|presentation|software|analysis|model|other",
      "priority": "critical|high|medium|low",
      "acceptanceCriteria": ["Criteria for acceptance"],
      "dependencies": ["Dependencies for this deliverable"],
      "estimatedEffort": {
        "optimistic": 10,
        "mostLikely": 15,
        "pessimistic": 25,
        "expected": 16,
        "confidence": "medium"
      },
      "milestones": [
        {
          "id": "milestone_id",
          "name": "Milestone name",
          "description": "What needs to be achieved",
          "date": "2024-01-15T00:00:00.000Z",
          "criteria": ["Completion criteria"],
          "dependencies": ["Prerequisites"]
        }
      ]
    }
  ]
}

Be thorough and realistic in your estimates. Consider the complexity indicated in the RTF structure.
`;
    try {
      const result = await model.generateContent(sowPrompt);
      const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const basicSOW = JSON.parse(responseText);
      const enhancedSOW = await this.enhanceSOW(basicSOW, rtf, options);
      return enhancedSOW;
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Failed to generate SOW:", error);
      }
      return this.generateFallbackSOW(rtf, options);
    }
  }
  /**
   * Generate effort estimation using PERT analysis
   */
  async generateEffortEstimate(task, complexity, context) {
    const model = await this.vertexAI.getGeminiModel();
    const estimatePrompt = `
Generate effort estimates for this task using PERT (Program Evaluation and Review Technique) analysis.

Task: ${task}
Complexity: ${complexity}
Context: ${JSON.stringify(context, null, 2)}

Consider factors like:
- Task complexity and scope
- Technical requirements
- Quality standards
- Review and iteration cycles
- Documentation needs
- Testing requirements

Provide estimates in JSON format:

{
  "optimistic": 5,
  "mostLikely": 10,
  "pessimistic": 18,
  "expected": 10.5,
  "confidence": "high|medium|low",
  "assumptions": ["Key assumptions made"],
  "riskFactors": ["Factors that could increase effort"]
}

Expected = (Optimistic + 4 * MostLikely + Pessimistic) / 6
Be realistic and account for iteration, review, and refinement time.
`;
    try {
      const result = await model.generateContent(estimatePrompt);
      const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const estimate = JSON.parse(responseText);
      estimate.expected = (estimate.optimistic + 4 * estimate.mostLikely + estimate.pessimistic) / 6;
      return estimate;
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Failed to generate effort estimate:", error);
      }
      const baseHours = this.getBaseHoursForComplexity(complexity);
      return {
        optimistic: Math.round(baseHours * 0.7),
        mostLikely: baseHours,
        pessimistic: Math.round(baseHours * 1.5),
        expected: Math.round(baseHours * 1.05),
        confidence: "low"
      };
    }
  }
  /**
   * Perform comprehensive risk analysis
   */
  async analyzeRisks(rtf, _timeline, resources) {
    const model = await this.vertexAI.getGeminiModel();
    const riskPrompt = `
Perform a comprehensive risk analysis for this project.

RTF Structure:
${JSON.stringify(rtf, null, 2)}

Timeline:
${JSON.stringify(_timeline, null, 2)}

Resources:
${JSON.stringify(resources, null, 2)}

Identify and assess risks in JSON format:

{
  "risks": [
    {
      "id": "risk_id",
      "category": "technical|schedule|resource|external|quality|business",
      "description": "Risk description",
      "probability": 0.3,
      "impact": 0.7,
      "riskScore": 0.21,
      "triggers": ["What could trigger this risk"],
      "indicators": ["Early warning signs"]
    }
  ],
  "mitigationStrategies": [
    {
      "riskId": "risk_id",
      "strategy": "How to reduce probability or impact",
      "actions": ["Specific actions to take"],
      "responsibleParty": "Who is responsible",
      "timeline": "When to implement",
      "cost": 1000
    }
  ],
  "contingencyPlans": [
    {
      "trigger": "What triggers this plan",
      "description": "What to do if risk occurs",
      "actions": ["Specific response actions"],
      "resources": ["Additional resources needed"],
      "impact": "Expected impact on project"
    }
  ],
  "overallRiskLevel": "low|medium|high|critical"
}

Risk Score = Probability \xD7 Impact (both 0-1 scale)
Consider technical, schedule, resource, quality, and external risks.
`;
    try {
      const result = await model.generateContent(riskPrompt);
      const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const assessment = JSON.parse(responseText);
      assessment.overallRiskLevel = this.calculateOverallRiskLevel(assessment.risks);
      return assessment;
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Failed to analyze risks:", error);
      }
      return {
        risks: [{
          id: "generic_risk",
          category: "schedule",
          description: "Project may take longer than estimated",
          probability: 0.4,
          impact: 0.6,
          riskScore: 0.24,
          triggers: ["Unclear requirements", "Resource constraints"],
          indicators: ["Missed early milestones", "Scope creep"]
        }],
        mitigationStrategies: [{
          riskId: "generic_risk",
          strategy: "Regular progress reviews and scope management",
          actions: ["Weekly progress check-ins", "Clear scope documentation"],
          responsibleParty: "Project Manager",
          timeline: "Throughout project",
          cost: 0
        }],
        contingencyPlans: [{
          trigger: "Schedule delay > 20%",
          description: "Escalate and reassess scope",
          actions: ["Stakeholder meeting", "Scope prioritization", "Resource reallocation"],
          resources: ["Additional team members", "Management attention"],
          impact: "Potential scope reduction or timeline extension"
        }],
        overallRiskLevel: "medium"
      };
    }
  }
  /**
   * Generate budget estimate with breakdown
   */
  async generateBudgetEstimate(deliverables, resources, _timeline, options = {}) {
    const hourlyRate = options.hourlyRate || 150;
    const currency = options.currency || "USD";
    const totalHours = deliverables.reduce((sum, deliverable) => sum + deliverable.estimatedEffort.expected, 0);
    const laborCost = totalHours * hourlyRate;
    const toolCost = resources.technicalResources.reduce((sum, resource) => sum + resource.cost, 0);
    const externalCost = resources.externalResources.reduce((sum, resource) => sum + resource.cost, 0);
    const totalCost = laborCost + toolCost + externalCost;
    const riskBuffer = totalCost * 0.15;
    return {
      totalCost: totalCost + riskBuffer,
      breakdown: [
        { name: "Labor", cost: laborCost, description: `${totalHours} hours at $${hourlyRate}/hour`, confidence: "medium" },
        { name: "Tools & Software", cost: toolCost, description: "Technical resources and tools", confidence: "high" },
        { name: "External Services", cost: externalCost, description: "Third-party services and consultants", confidence: "medium" },
        { name: "Risk Buffer", cost: riskBuffer, description: "15% contingency for unforeseen costs", confidence: "high" }
      ],
      assumptions: [
        `Hourly rate: $${hourlyRate}`,
        "15% risk buffer applied",
        "No major scope changes assumed"
      ],
      riskBuffer,
      currency
    };
  }
  /**
   * Enhance basic SOW with additional analysis
   */
  async enhanceSOW(basicSOW, rtf, options) {
    const timeline = await this.generateTimeline(basicSOW.deliverables || [], rtf);
    const resources = await this.generateResourcePlan(basicSOW.deliverables || [], rtf);
    const riskAssessment = await this.analyzeRisks(rtf, timeline, resources);
    const budget = await this.generateBudgetEstimate(
      basicSOW.deliverables || [],
      resources,
      timeline
    );
    const enhancedSOW = {
      id: basicSOW.id || `sow_${Date.now()}`,
      title: basicSOW.title || rtf.task.description,
      description: basicSOW.description || rtf.task.description,
      scope: basicSOW.scope || {
        overview: rtf.task.description,
        objectives: [rtf.task.expectedOutcome],
        inclusions: rtf.task.requirements,
        exclusions: [],
        boundaries: rtf.task.constraints
      },
      deliverables: basicSOW.deliverables || [],
      timeline,
      resources,
      riskAssessment,
      assumptions: [
        "Requirements are well-defined and stable",
        "Resources are available as planned",
        "No major external dependencies"
      ],
      constraints: rtf.task.constraints,
      successCriteria: [
        {
          category: "scope",
          description: "All deliverables completed as specified",
          metrics: ["Deliverable completion rate"],
          target: "100%",
          measurement: "Binary completion check"
        },
        {
          category: "quality",
          description: "Quality standards met",
          metrics: ["Review approval rate"],
          target: "95%",
          measurement: "Stakeholder approval"
        }
      ],
      budget,
      metadata: {
        version: "1.0",
        createdDate: /* @__PURE__ */ new Date(),
        createdBy: "AI SOW Generator",
        lastModified: /* @__PURE__ */ new Date(),
        status: "draft",
        reviewers: [],
        approvers: [],
        template: options.template || "standard"
      }
    };
    return enhancedSOW;
  }
  /**
   * Generate project timeline
   */
  async generateTimeline(deliverables, _rtf) {
    const totalEffort = deliverables.reduce((sum, d) => sum + d.estimatedEffort.expected, 0);
    const workingHoursPerDay = 6;
    const durationDays = Math.ceil(totalEffort / workingHoursPerDay);
    const startDate = /* @__PURE__ */ new Date();
    const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1e3);
    return {
      startDate,
      endDate,
      totalDuration: `${durationDays} days`,
      phases: [
        {
          id: "analysis",
          name: "Analysis & Planning",
          description: "Understand requirements and plan approach",
          startDate,
          endDate: new Date(startDate.getTime() + Math.ceil(durationDays * 0.2) * 24 * 60 * 60 * 1e3),
          deliverables: ["analysis_document"],
          dependencies: [],
          resources: ["analyst"]
        },
        {
          id: "execution",
          name: "Execution",
          description: "Create deliverables according to plan",
          startDate: new Date(startDate.getTime() + Math.ceil(durationDays * 0.2) * 24 * 60 * 60 * 1e3),
          endDate: new Date(startDate.getTime() + Math.ceil(durationDays * 0.8) * 24 * 60 * 60 * 1e3),
          deliverables: deliverables.map((d) => d.id),
          dependencies: ["analysis"],
          resources: ["developer", "designer"]
        },
        {
          id: "review",
          name: "Review & Finalization",
          description: "Review deliverables and finalize",
          startDate: new Date(startDate.getTime() + Math.ceil(durationDays * 0.8) * 24 * 60 * 60 * 1e3),
          endDate,
          deliverables: ["final_review"],
          dependencies: ["execution"],
          resources: ["reviewer"]
        }
      ],
      criticalPath: ["analysis", "execution", "review"],
      bufferTime: `${Math.ceil(durationDays * 0.1)} days`
    };
  }
  /**
   * Generate resource plan
   */
  async generateResourcePlan(deliverables, _rtf) {
    const totalHours = deliverables.reduce((sum, d) => sum + d.estimatedEffort.expected, 0);
    const humanResources = [
      {
        role: "Project Lead",
        skillsRequired: ["project management", "communication"],
        effortRequired: {
          optimistic: Math.round(totalHours * 0.1),
          mostLikely: Math.round(totalHours * 0.15),
          pessimistic: Math.round(totalHours * 0.2),
          expected: Math.round(totalHours * 0.15),
          confidence: "high"
        },
        availability: "part-time"
      }
    ];
    const technicalResources = [
      {
        name: "AI Platform Access",
        type: "service",
        description: "Access to AI models and processing",
        cost: 100,
        duration: "project duration"
      }
    ];
    return {
      humanResources,
      technicalResources,
      externalResources: [],
      totalEstimate: {
        totalHours,
        totalCost: totalHours * 150 + 100,
        // Assuming $150/hour + tools
        breakdown: {
          labor: totalHours * 150,
          tools: 100,
          external: 0
        }
      }
    };
  }
  /**
   * Calculate overall risk level from individual risks
   */
  calculateOverallRiskLevel(risks) {
    const averageRiskScore = risks.reduce((sum, risk) => sum + risk.riskScore, 0) / risks.length;
    const maxRiskScore = Math.max(...risks.map((risk) => risk.riskScore));
    if (maxRiskScore > 0.7 || averageRiskScore > 0.5) return "critical";
    if (maxRiskScore > 0.5 || averageRiskScore > 0.3) return "high";
    if (maxRiskScore > 0.3 || averageRiskScore > 0.15) return "medium";
    return "low";
  }
  /**
   * Get base hours for complexity level
   */
  getBaseHoursForComplexity(complexity) {
    switch (complexity) {
      case "simple":
        return 8;
      case "moderate":
        return 20;
      case "complex":
        return 50;
      case "very-complex":
        return 120;
      default:
        return 20;
    }
  }
  /**
   * Generate fallback SOW when AI generation fails
   */
  generateFallbackSOW(rtf, _options) {
    return {
      id: `sow_${Date.now()}`,
      title: rtf.task.description,
      description: rtf.task.description,
      scope: {
        overview: rtf.task.description,
        objectives: [rtf.task.expectedOutcome],
        inclusions: rtf.task.requirements,
        exclusions: ["Items not explicitly mentioned"],
        boundaries: rtf.task.constraints
      },
      deliverables: [{
        id: "main_deliverable",
        name: "Primary Deliverable",
        description: rtf.task.expectedOutcome,
        type: "other",
        priority: "high",
        acceptanceCriteria: ["Meets stated requirements"],
        dependencies: [],
        estimatedEffort: {
          optimistic: 10,
          mostLikely: 20,
          pessimistic: 35,
          expected: 21,
          confidence: "low"
        },
        milestones: [{
          id: "completion",
          name: "Completion",
          description: "Deliverable completed",
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3),
          // 1 week from now
          criteria: ["Work completed"],
          dependencies: []
        }]
      }],
      timeline: {
        startDate: /* @__PURE__ */ new Date(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3),
        totalDuration: "1 week",
        phases: [],
        criticalPath: [],
        bufferTime: "1 day"
      },
      resources: {
        humanResources: [],
        technicalResources: [],
        externalResources: [],
        totalEstimate: {
          totalHours: 21,
          totalCost: 3150,
          breakdown: { labor: 3150 }
        }
      },
      riskAssessment: {
        risks: [],
        mitigationStrategies: [],
        contingencyPlans: [],
        overallRiskLevel: "medium"
      },
      assumptions: ["Basic assumptions apply"],
      constraints: rtf.task.constraints,
      successCriteria: [{
        category: "scope",
        description: "Task completed",
        metrics: ["Completion"],
        target: "100%",
        measurement: "Binary"
      }],
      budget: {
        totalCost: 3150,
        breakdown: [{
          name: "Labor",
          cost: 3150,
          description: "21 hours at $150/hour",
          confidence: "low"
        }],
        assumptions: ["Standard rates applied"],
        riskBuffer: 0,
        currency: "USD"
      },
      metadata: {
        version: "1.0",
        createdDate: /* @__PURE__ */ new Date(),
        createdBy: "AI SOW Generator",
        lastModified: /* @__PURE__ */ new Date(),
        status: "draft",
        reviewers: [],
        approvers: [],
        template: "fallback"
      }
    };
  }
  /**
   * Initialize SOW templates
   */
  initializeTemplates() {
    this.templates.set("standard", {
      name: "Standard SOW Template",
      sections: ["scope", "deliverables", "timeline", "resources", "risks", "budget"],
      defaultSettings: {}
    });
  }
};

// src/agents/planner.ts
var PlannerAgent = class {
  conversationManager;
  rtfParser;
  sowGenerator;
  config;
  activePlans;
  constructor(vertexAI, config = {}) {
    this.conversationManager = new ConversationManager(vertexAI);
    this.rtfParser = new RTFParser(vertexAI);
    this.sowGenerator = new SOWGenerator(vertexAI);
    this.config = {
      enableConversationMode: true,
      autoGenerateSOW: true,
      defaultTemplate: "standard",
      maxPlanningIterations: 5,
      ...config
    };
    this.activePlans = /* @__PURE__ */ new Map();
  }
  /**
   * Create a task plan from natural language input
   */
  async createTaskPlan(input, context) {
    const rtfStructure = await this.rtfParser.parseRTF(input, {
      type: context?.type,
      userProfile: {}
    });
    const actionPlan = await this.rtfParser.rtfToActionPlan(rtfStructure);
    const executionPlan = actionPlan.steps.map((step, index) => ({
      id: `step_${index + 1}`,
      name: step.name,
      description: step.description,
      type: step.type,
      estimatedTime: this.parseTimeEstimate(step.estimatedTime),
      prerequisites: step.prerequisites,
      deliverables: [step.deliverable],
      status: "pending"
    }));
    const taskPlan = {
      id: `plan_${Date.now()}`,
      title: this.generatePlanTitle(rtfStructure),
      description: rtfStructure.task.description,
      rtfStructure,
      executionPlan,
      status: "draft",
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
    if (this.config.autoGenerateSOW) {
      taskPlan.sowDocument = await this.sowGenerator.generateSOW(rtfStructure, {
        projectName: taskPlan.title,
        stakeholders: context?.stakeholders,
        budget: context?.budget,
        timeline: context?.timeline,
        template: this.config.defaultTemplate
      });
    }
    this.activePlans.set(taskPlan.id, taskPlan);
    if (this.config.enableConversationMode && context?.sessionId) {
      await this.conversationManager.initializeConversation(
        context.sessionId,
        context.type || "general",
        input
      );
    }
    return taskPlan;
  }
  /**
   * Refine an existing task plan through conversation
   */
  async refinePlan(planId, feedback, sessionId) {
    const plan = this.activePlans.get(planId);
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }
    if (sessionId && this.config.enableConversationMode) {
      await this.conversationManager.processMessage(sessionId, feedback);
    }
    const refinementRTF = await this.rtfParser.parseRTF(feedback, {
      type: "general",
      previousMessages: [plan.description]
    });
    const updatedPlan = await this.applyPlanRefinements(plan, refinementRTF);
    this.activePlans.set(planId, updatedPlan);
    return updatedPlan;
  }
  /**
   * Execute a task plan step by step
   */
  async executePlan(planId, options = {}) {
    const plan = this.activePlans.get(planId);
    if (!plan) {
      throw new Error(`Plan not found: ${planId}`);
    }
    plan.status = "in-progress";
    plan.updatedAt = /* @__PURE__ */ new Date();
    const completedSteps = [];
    const errors = [];
    for (const step of plan.executionPlan) {
      if (step.status === "completed") {
        completedSteps.push(step);
        continue;
      }
      const prerequisitesMet = step.prerequisites.every(
        (prereq) => plan.executionPlan.find((s) => s.id === prereq)?.status === "completed"
      );
      if (!prerequisitesMet) {
        step.status = "blocked";
        errors.push(`Step ${step.name} blocked by unmet prerequisites`);
        continue;
      }
      try {
        step.status = "in-progress";
        options.notificationCallback?.(step, "started");
        const success = await this.executeStep(step, plan, options.sessionId);
        if (success) {
          step.status = "completed";
          completedSteps.push(step);
          options.notificationCallback?.(step, "completed");
        } else {
          step.status = "blocked";
          errors.push(`Failed to execute step: ${step.name}`);
          options.notificationCallback?.(step, "failed");
        }
      } catch (error) {
        step.status = "blocked";
        errors.push(`Error executing step ${step.name}: ${error instanceof Error ? error.message : "Unknown error"}`);
        options.notificationCallback?.(step, "error");
      }
      if (!options.autoExecute) {
        break;
      }
    }
    const allCompleted = plan.executionPlan.every((step) => step.status === "completed");
    plan.status = allCompleted ? "completed" : "in-progress";
    plan.updatedAt = /* @__PURE__ */ new Date();
    return {
      success: errors.length === 0,
      completedSteps,
      errors
    };
  }
  /**
   * Get plan status and progress
   */
  getPlanStatus(planId) {
    const plan = this.activePlans.get(planId);
    if (!plan) {
      return {
        plan: void 0,
        progress: 0,
        nextStep: void 0,
        blockedSteps: []
      };
    }
    const completedSteps = plan.executionPlan.filter((step) => step.status === "completed");
    const progress = completedSteps.length / plan.executionPlan.length;
    const nextStep = plan.executionPlan.find(
      (step) => step.status === "pending" && step.prerequisites.every(
        (prereq) => plan.executionPlan.find((s) => s.id === prereq)?.status === "completed"
      )
    );
    const blockedSteps = plan.executionPlan.filter((step) => step.status === "blocked");
    return {
      plan,
      progress,
      nextStep,
      blockedSteps
    };
  }
  /**
   * List all active plans
   */
  getActivePlans() {
    return Array.from(this.activePlans.values());
  }
  /**
   * Get conversation context for a session
   */
  getConversationContext(sessionId) {
    return this.conversationManager.getConversationContext(sessionId);
  }
  /**
   * Execute a single step
   */
  async executeStep(step, plan, sessionId) {
    switch (step.type) {
      case "research":
        return this.executeResearchStep(step, plan, sessionId);
      case "analysis":
        return this.executeAnalysisStep(step, plan, sessionId);
      case "creation":
        return this.executeCreationStep(step, plan, sessionId);
      case "review":
        return this.executeReviewStep(step, plan, sessionId);
      case "communication":
        return this.executeCommunicationStep(step, plan, sessionId);
      default:
        return false;
    }
  }
  async executeResearchStep(_step, _plan, _sessionId) {
    return true;
  }
  async executeAnalysisStep(_step, _plan, _sessionId) {
    return true;
  }
  async executeCreationStep(_step, _plan, _sessionId) {
    return true;
  }
  async executeReviewStep(_step, _plan, _sessionId) {
    return true;
  }
  async executeCommunicationStep(_step, _plan, _sessionId) {
    return true;
  }
  /**
   * Apply refinements to an existing plan
   */
  async applyPlanRefinements(plan, _refinementRTF) {
    plan.updatedAt = /* @__PURE__ */ new Date();
    return plan;
  }
  /**
   * Generate a plan title from RTF structure
   */
  generatePlanTitle(rtf) {
    const taskType = rtf.task.type.charAt(0).toUpperCase() + rtf.task.type.slice(1);
    const intent = rtf.task.intent.replace("_", " ");
    return `${taskType}: ${intent}`;
  }
  /**
   * Parse time estimate string to hours
   */
  parseTimeEstimate(timeStr) {
    const lowerStr = timeStr.toLowerCase();
    if (lowerStr.includes("hour")) {
      const match = lowerStr.match(/(\d+)\s*hour/);
      return match && match[1] ? parseInt(match[1], 10) : 1;
    }
    if (lowerStr.includes("day")) {
      const match = lowerStr.match(/(\d+)\s*day/);
      return match && match[1] ? parseInt(match[1], 10) * 8 : 8;
    }
    if (lowerStr.includes("week")) {
      const match = lowerStr.match(/(\d+)\s*week/);
      return match && match[1] ? parseInt(match[1], 10) * 40 : 40;
    }
    return 1;
  }
};

// src/agents/retriever.ts
var retrieverPlaceholder = "retriever-agent";

// src/agents/generator.ts
var generatorPlaceholder = "generator-agent";

// src/agents/critic.ts
var criticPlaceholder = "critic-agent";

// src/agents/reviewer.ts
var reviewerPlaceholder = "reviewer-agent";
export {
  ConversationManager,
  LLMService,
  Neo4jClient,
  PlannerAgent,
  RTFParser,
  SOWGenerator,
  VertexAIClient,
  createNeo4jClient,
  createVertexAIClient,
  criticPlaceholder,
  generatorPlaceholder,
  llmService,
  retrieverPlaceholder,
  reviewerPlaceholder
};
//# sourceMappingURL=index.js.map