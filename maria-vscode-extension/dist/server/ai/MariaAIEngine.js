"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MariaAIEngine = void 0;
const path = __importStar(require("path"));
class MariaAIEngine {
    constructor(connection) {
        this.providers = new Map();
        this.activeProvider = 'openai';
        this.configuration = {};
        this.connection = connection;
        this.initializeProviders();
    }
    initializeProviders() {
        // Initialize AI providers based on existing MARIA CLI implementation
        // This will be adapted from src/services/providers/*.ts
        // For now, we'll create a mock implementation
        const mockProvider = {
            async generateCode(prompt) {
                // Simulate AI code generation
                return `// Generated code for: ${prompt}\nfunction generatedFunction() {\n  // Implementation here\n}`;
            },
            async analyzeCode(code, analysisType) {
                // Simulate code analysis
                return {
                    issues: [],
                    suggestions: []
                };
            },
            async chat(message) {
                // Simulate chat response
                return `MARIA response to: ${message}`;
            },
            async getCompletions(context, language) {
                // Simulate completion suggestions
                return [
                    {
                        label: 'suggestion1',
                        insertText: 'console.log("hello");',
                        description: 'Log hello to console'
                    }
                ];
            },
            async suggestFix(code, issue) {
                // Simulate fix suggestion
                return {
                    title: 'Fix issue',
                    replacement: code.replace(/var/g, 'const')
                };
            },
            async getDocumentation(symbol) {
                // Simulate documentation lookup
                return `Documentation for ${symbol}`;
            }
        };
        this.providers.set('mock', mockProvider);
        this.activeProvider = 'mock';
    }
    updateConfiguration(config) {
        this.configuration = config;
        // Update provider based on configuration
        if (config.provider && this.providers.has(config.provider)) {
            this.activeProvider = config.provider;
        }
        // Update API keys and other settings
        if (config.apiKey) {
            // Configure provider with API key
            this.configureProvider(this.activeProvider, { apiKey: config.apiKey });
        }
    }
    configureProvider(providerName, config) {
        const provider = this.providers.get(providerName);
        if (provider) {
            // Configure the provider with settings
            // This will be implemented based on actual provider requirements
        }
    }
    getActiveProvider() {
        const provider = this.providers.get(this.activeProvider);
        if (!provider) {
            throw new Error(`Provider ${this.activeProvider} not found`);
        }
        return provider;
    }
    async generateCode(prompt, language) {
        try {
            const provider = this.getActiveProvider();
            const context = {
                language,
                workspace: this.configuration.workspacePath
            };
            const code = await provider.generateCode(prompt, context);
            this.connection.console.log(`Generated code for prompt: ${prompt}`);
            return code;
        }
        catch (error) {
            this.connection.console.error(`Error generating code: ${error}`);
            throw error;
        }
    }
    async analyzeCode(code, analysisType, language) {
        try {
            const provider = this.getActiveProvider();
            const result = await provider.analyzeCode(code, analysisType);
            this.connection.console.log(`Analyzed code for ${analysisType}`);
            return result;
        }
        catch (error) {
            this.connection.console.error(`Error analyzing code: ${error}`);
            throw error;
        }
    }
    async chat(message, history) {
        try {
            const provider = this.getActiveProvider();
            const response = await provider.chat(message, history);
            this.connection.console.log(`Chat response generated for: ${message}`);
            return response;
        }
        catch (error) {
            this.connection.console.error(`Error in chat: ${error}`);
            throw error;
        }
    }
    async getCompletions(context, language) {
        try {
            const provider = this.getActiveProvider();
            const completions = await provider.getCompletions(context, language);
            return completions.map((c) => ({
                label: c.label,
                insertText: c.insertText,
                description: c.description
            }));
        }
        catch (error) {
            this.connection.console.error(`Error getting completions: ${error}`);
            return [];
        }
    }
    async suggestFix(code, issue, language) {
        try {
            const provider = this.getActiveProvider();
            const fix = await provider.suggestFix(code, issue, language);
            if (fix) {
                return {
                    title: fix.title,
                    replacement: fix.replacement
                };
            }
            return null;
        }
        catch (error) {
            this.connection.console.error(`Error suggesting fix: ${error}`);
            return null;
        }
    }
    async getDocumentation(symbol, language) {
        try {
            const provider = this.getActiveProvider();
            const doc = await provider.getDocumentation(symbol, language);
            return doc;
        }
        catch (error) {
            this.connection.console.error(`Error getting documentation: ${error}`);
            return null;
        }
    }
    // Integration with existing MARIA CLI services
    async integrateWithCLI() {
        var _a, _b;
        try {
            // Path to MARIA CLI installation
            const mariaCliPath = path.resolve(__dirname, '../../../../');
            // Dynamically import MARIA CLI services
            // This will be implemented to reuse existing AI providers
            const { MariaAI } = await (_a = path.join(mariaCliPath, 'dist', 'services', 'maria-ai'), Promise.resolve().then(() => __importStar(require(_a))));
            const { ProviderManager } = await (_b = path.join(mariaCliPath, 'dist', 'services', 'provider-manager'), Promise.resolve().then(() => __importStar(require(_b))));
            // Initialize providers from CLI
            const providerManager = new ProviderManager();
            const providers = await providerManager.getAvailableProviders();
            // Register each provider
            for (const [name, provider] of providers) {
                this.providers.set(name, provider);
            }
            this.connection.console.log('Successfully integrated with MARIA CLI services');
        }
        catch (error) {
            this.connection.console.error(`Failed to integrate with CLI: ${error}`);
            // Fall back to mock provider
        }
    }
}
exports.MariaAIEngine = MariaAIEngine;
//# sourceMappingURL=MariaAIEngine.js.map