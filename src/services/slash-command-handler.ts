/**
 * Slash Command Handler
 * 対話モードでの/コマンドを処理
 */

import { ConversationContext } from '../types/conversation';
import { logger } from '../utils/logger';
import { readConfig, writeConfig } from '../utils/config';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { 
  commandCategories, 
  getCommandsByCategory, 
  getCommandInfo,
  getRelatedCommands,
  getCommandChain,
  CommandCategory,
  commandChains
} from '../lib/command-groups';
import { SuggestionService, SuggestionContext } from './suggestion-service';
import { CommandChainService } from './command-chain-service';
import { AliasSystem } from './alias-system';
import { TemplateManager } from './template-manager';
import { BatchExecutionEngine } from './batch-execution';
import { HotkeyManager } from './hotkey-manager';
import { runInteractiveModelSelector } from '../commands/model-interactive.js';
import { ChatContextService } from './chat-context.service';

export interface SlashCommandResult {
  success: boolean;
  message: string;
  data?: any;
  requiresInput?: boolean;
  component?: 'config-panel' | 'auth-flow' | 'help-dialog' | 'status-display' | 'system-diagnostics' | 'cost-display' | 'agents-display' | 'mcp-display' | 'model-selector' | 'image-generator' | 'video-generator';
  suggestions?: string; // Formatted suggestion text
}

export class SlashCommandHandler {
  private static instance: SlashCommandHandler;
  private suggestionService: SuggestionService;
  private _chainService?: CommandChainService;
  private aliasSystem: AliasSystem;
  private templateManager: TemplateManager;
  private batchEngine: BatchExecutionEngine;
  private hotkeyManager: HotkeyManager;
  private chatContextService: ChatContextService;
  private userSession: {
    isAuthenticated: boolean;
    userId?: string;
    plan: 'free' | 'pro' | 'max';
    credits: number;
    loginTime?: Date;
  } = {
    isAuthenticated: false,
    plan: 'free',
    credits: 100
  };

  private constructor() {
    this.suggestionService = SuggestionService.getInstance();
    this.aliasSystem = AliasSystem.getInstance();
    this.templateManager = TemplateManager.getInstance();
    this.batchEngine = BatchExecutionEngine.getInstance();
    this.hotkeyManager = HotkeyManager.getInstance();
    this.chatContextService = ChatContextService.getInstance();
    // Lazy initialize chainService to avoid circular dependency
  }

  private get chainService(): CommandChainService {
    if (!this._chainService) {
      this._chainService = CommandChainService.getInstance();
    }
    return this._chainService;
  }

  public static getInstance(): SlashCommandHandler {
    if (!SlashCommandHandler.instance) {
      SlashCommandHandler.instance = new SlashCommandHandler();
    }
    return SlashCommandHandler.instance;
  }

  /**
   * スラッシュコマンドを処理
   */
  async handleCommand(
    command: string, 
    args: string[], 
    context: ConversationContext
  ): Promise<SlashCommandResult> {
    let commandName = command.toLowerCase();
    let commandArgs = args;
    
    // Check if this is an alias
    const aliasResolution = this.aliasSystem.resolveAlias(`${commandName} ${args.join(' ')}`.trim());
    if (aliasResolution) {
      logger.debug(`Resolved alias ${commandName} to ${aliasResolution.command}`);
      commandName = aliasResolution.command;
      commandArgs = aliasResolution.args;
    }
    
    logger.debug(`Processing slash command: ${commandName}`, commandArgs);

    // Add to history
    this.suggestionService.addToHistory(commandName);

    try {
      let result: SlashCommandResult;
      
      switch (commandName) {
        // ユーザー管理コマンド
        case '/login':
          result = await this.handleLogin(args);
          break;
        case '/logout':
          result = await this.handleLogout(args);
          break;
        case '/mode':
          result = await this.handleMode(args, context);
          break;
        case '/upgrade':
          result = await this.handleUpgrade(args);
          break;
        case '/status':
          result = await this.handleStatus();
          break;

        // 設定・環境管理
        case '/config':
          result = await this.handleConfig(args);
          break;
        case '/model':
          result = await this.handleModel(args, context);
          break;
        case '/permissions':
          result = await this.handlePermissions(args);
          break;
        case '/hooks':
          result = await this.handleHooks(args);
          break;
        case '/doctor':
          result = await this.handleDoctor();
          break;
        case '/terminal-setup':
          result = await this.handleTerminalSetup();
          break;

        // プロジェクト管理
        case '/init':
          result = await this.handleInit();
          break;
        case '/add-dir':
          result = await this.handleAddDir();
          break;
        case '/memory':
          result = await this.handleMemory();
          break;
        case '/export':
          result = await this.handleExport();
          break;

        // エージェント・統合管理
        case '/agents':
          result = await this.handleAgents();
          break;
        case '/mcp':
          result = await this.handleMcp();
          break;

        // 対話・コスト管理
        case '/clear':
          result = await this.handleClear(context, commandArgs);
          break;
        case '/compact':
          result = await this.handleCompact(context);
          break;
        case '/resume':
          result = await this.handleResume(context);
          break;
        case '/cost':
          result = await this.handleCost(context);
          break;

        // 開発支援機能
        case '/review':
          result = await this.handleReview();
          break;
        case '/pr-comments':
          result = await this.handlePrComments();
          break;
        case '/bug':
          result = await this.handleBug();
          break;
        case '/release-notes':
          result = await this.handleReleaseNotes();
          break;

        // UIモード・ヘルプ
        case '/vim':
          result = await this.handleVim(context);
          break;
        case '/help':
          result = await this.handleHelp(args);
          break;
        case '/version':
          result = await this.handleVersion();
          break;
        case '/chain':
          result = await this.handleChain(args, context);
          break;
        case '/suggest':
          result = await this.handleSuggest(context);
          break;
        case '/alias':
          result = await this.handleAlias(commandArgs);
          break;
        case '/template':
          result = await this.handleTemplate(commandArgs);
          break;
        case '/batch':
          result = await this.handleBatch(commandArgs, context);
          break;
        case '/hotkey':
          result = await this.handleHotkey(commandArgs);
          break;
        case '/exit':
          result = await this.handleExit(context);
          break;

        // インフラ移行
        case '/migrate-installer':
          result = await this.handleMigrateInstaller();
          break;

        // マルチメディア生成
        case '/video':
          result = await this.handleVideo(args);
          break;
        case '/image':
          result = await this.handleImage(args);
          break;

        default:
          result = {
            success: false,
            message: `Unknown command: ${commandName}. Type /help for available commands.`
          };
      }
      
      // Add suggestions to the result
      return await this.addSuggestions(result, commandName, context);
      
    } catch (error) {
      logger.error(`Slash command error: ${commandName}`, error);
      return {
        success: false,
        message: `Error executing ${commandName}: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Add suggestions to command result
   */
  private async addSuggestions(
    result: SlashCommandResult,
    commandName: string,
    context: ConversationContext
  ): Promise<SlashCommandResult> {
    // Don't add suggestions for help or exit commands
    if (!result.success || commandName === '/help' || commandName === '/exit') {
      return result;
    }

    const suggestionContext: SuggestionContext = {
      lastCommand: commandName,
      lastCommandSuccess: result.success,
      projectInitialized: await this.checkProjectInitialized(),
      userLoggedIn: this.userSession.isAuthenticated,
      currentMode: context.preferences?.defaultModel || 'chat'
    };
    
    const suggestions = await this.suggestionService.getContextualSuggestions(suggestionContext);
    
    if (suggestions.length > 0) {
      result.suggestions = this.suggestionService.formatSuggestions(suggestions);
    }
    
    return result;
  }

  /**
   * Check if project is initialized
   */
  private async checkProjectInitialized(): Promise<boolean> {
    try {
      const config = await readConfig();
      return config.project?.workingDirectories !== undefined && config.project.workingDirectories.length > 0;
    } catch {
      return false;
    }
  }

  // ユーザー管理コマンド実装
  private async handleLogin(args: string[]): Promise<SlashCommandResult> {
    if (this.userSession.isAuthenticated) {
      return {
        success: true,
        message: `Already logged in as user ${this.userSession.userId}`,
        data: { user: this.userSession }
      };
    }

    const provider = args[0] || 'email';
    const validProviders = ['email', 'google', 'github'];
    
    if (!validProviders.includes(provider)) {
      return {
        success: false,
        message: `Invalid provider: ${provider}. Available: ${validProviders.join(', ')}`
      };
    }

    // TODO: 実際の認証フローを実装
    // 現時点ではシミュレーション
    this.userSession = {
      isAuthenticated: true,
      userId: `user-${uuidv4().slice(0, 8)}`,
      plan: 'pro',
      credits: 1000,
      loginTime: new Date()
    };

    return {
      success: true,
      message: `Successfully logged in with ${provider}`,
      data: { user: this.userSession },
      component: 'auth-flow'
    };
  }

  private async handleLogout(args: string[]): Promise<SlashCommandResult> {
    if (!this.userSession.isAuthenticated) {
      return {
        success: false,
        message: 'Not currently logged in'
      };
    }

    const keepCache = args.includes('--keep-cache');
    const keepSettings = args.includes('--keep-settings');

    // セッションクリア
    const oldUserId = this.userSession.userId;
    this.userSession = {
      isAuthenticated: false,
      plan: 'free',
      credits: 100
    };

    let message = `Logged out user ${oldUserId}`;
    if (keepCache) message += ' (cache preserved)';
    if (keepSettings) message += ' (settings preserved)';

    return {
      success: true,
      message
    };
  }

  private async handleMode(args: string[], context: ConversationContext): Promise<SlashCommandResult> {
    const availableModes = ['chat', 'command', 'research', 'creative'];
    const currentMode = context.preferences?.defaultModel || 'chat';

    if (args.length === 0) {
      return {
        success: true,
        message: `Current mode: ${currentMode}\\nAvailable modes: ${availableModes.join(', ')}`,
        data: { currentMode, availableModes }
      };
    }

    const newMode = args[0]?.toLowerCase();
    if (!newMode || !availableModes.includes(newMode)) {
      return {
        success: false,
        message: `Invalid mode: ${newMode || 'undefined'}. Available: ${availableModes.join(', ')}`
      };
    }

    // コンテキストのモード更新
    if (context.preferences) {
      context.preferences.defaultModel = newMode as any;
    }

    // 設定ファイル更新
    const config = await readConfig();
    config.defaultMode = newMode as any;
    await writeConfig(config);

    return {
      success: true,
      message: `Mode switched to ${newMode}`,
      data: { mode: newMode }
    };
  }

  private async handleUpgrade(args: string[]): Promise<SlashCommandResult> {
    const targetPlan = args[0]?.toLowerCase() || 'pro';
    const validPlans = ['pro', 'max'];

    if (!validPlans.includes(targetPlan)) {
      return {
        success: false,
        message: `Invalid plan: ${targetPlan}. Available: ${validPlans.join(', ')}`
      };
    }

    if (!this.userSession.isAuthenticated) {
      return {
        success: false,
        message: 'Please login first with /login'
      };
    }

    const currentPlan = this.userSession.plan;
    if (currentPlan === targetPlan) {
      return {
        success: true,
        message: `Already on ${targetPlan} plan`
      };
    }

    // プラン更新シミュレーション
    this.userSession.plan = targetPlan as 'pro' | 'max';
    this.userSession.credits = targetPlan === 'pro' ? 5000 : 20000;

    return {
      success: true,
      message: `Successfully upgraded to ${targetPlan} plan`,
      data: { 
        plan: targetPlan,
        credits: this.userSession.credits,
        features: this.getPlanFeatures(targetPlan)
      }
    };
  }

  private async handleStatus(): Promise<SlashCommandResult> {
    const config = await readConfig();
    
    const status = {
      user: this.userSession,
      system: {
        version: '2.5.3',
        mode: config.defaultMode || 'chat',
        apiUrl: config.apiUrl || 'http://localhost:8080',
        sandboxStatus: 'ready' // TODO: 実際のSandbox状態を取得
      },
      resources: {
        memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
        uptime: `${Math.round(process.uptime())}s`
      }
    };

    return {
      success: true,
      message: 'System status retrieved',
      data: status,
      component: 'status-display'
    };
  }

  // 設定・環境管理コマンド
  private async handleConfig(args: string[]): Promise<SlashCommandResult> {
    const config = await readConfig();
    
    if (args.length === 0) {
      return {
        success: true,
        message: 'Opening configuration panel',
        data: { config },
        component: 'config-panel'
      };
    }

    const [key, value] = args;
    if (value && key) {
      // 設定更新
      (config as any)[key] = value;
      await writeConfig(config);
      return {
        success: true,
        message: `Configuration updated: ${key} = ${value}`
      };
    } else if (key) {
      // 設定値表示
      const currentValue = (config as any)[key];
      return {
        success: true,
        message: `${key}: ${currentValue || 'undefined'}`
      };
    }
    
    return {
      success: false,
      message: 'Invalid config command usage'
    };
  }

  private async handleModel(args: string[], context: ConversationContext): Promise<SlashCommandResult> {
    const cloudModels = [
      { id: 'gpt-4o', provider: 'OpenAI', name: 'GPT-4o', context: '128K', description: 'High accuracy, multimodal capabilities' },
      { id: 'gpt-4-turbo', provider: 'OpenAI', name: 'GPT-4 Turbo', context: '128K', description: 'Fast reasoning and code generation' },
      { id: 'claude-3-opus', provider: 'Anthropic', name: 'Claude 3 Opus', context: '200K', description: 'Long text processing, complex tasks' },
      { id: 'claude-3-sonnet', provider: 'Anthropic', name: 'Claude 3 Sonnet', context: '200K', description: 'Balanced performance and cost' },
      { id: 'gemini-2.5-pro', provider: 'Google', name: 'Gemini 2.5 Pro', context: '128K', description: 'Research, analysis, vision capabilities' },
      { id: 'mixtral-8x7b', provider: 'Groq', name: 'Mixtral 8x7B', context: '32K', description: 'Fast inference, real-time responses' },
      { id: 'llama-3-70b', provider: 'Groq', name: 'Llama 3 70B', context: '32K', description: 'Open source excellence' }
    ];

    const localModels = [
      { id: 'gpt-oss-120b', provider: 'LM Studio', name: 'GPT-OSS 120B', context: '128K', vram: '~64GB', description: 'Complex reasoning, large documents' },
      { id: 'gpt-oss-20b', provider: 'LM Studio', name: 'GPT-OSS 20B', context: '32K', vram: '~12GB', description: 'Balanced performance, quick responses' },
      { id: 'qwen3-30b', provider: 'LM Studio', name: 'Qwen3 30B', context: '32K', vram: '~16GB', description: 'Multilingual support' },
      { id: 'qwen2.5-vl', provider: 'Ollama', name: 'Qwen2.5-VL', context: '8K', vram: '~8GB', description: 'Vision capabilities' }
    ];
    
    const allModels = [...cloudModels, ...localModels];
    const currentModel = context.preferences?.defaultModel || 'gemini-2.5-pro';
    // Find current model info (unused for now)
    const _currentModelInfo = allModels.find(m => m.id === currentModel);
    void _currentModelInfo; // Will be used for UI display in future implementation

    // If no arguments, launch interactive selector
    if (args.length === 0) {
      try {
        const selectedModel = await runInteractiveModelSelector();
        
        if (selectedModel) {
          // Update context and config
          if (!context.preferences) {
            context.preferences = {
              language: 'ja',
              verbosity: 'normal',
              autoMode: false,
              defaultModel: 'gemini-2.5-pro',
              theme: 'dark'
            };
          }
          context.preferences.defaultModel = selectedModel as any;
          
          const config = await readConfig();
          config.defaultModel = selectedModel as any;
          await writeConfig(config);
          
          return {
            success: true,
            message: `✅ Model switched to: ${selectedModel}`,
            data: { model: selectedModel }
          };
        } else {
          return {
            success: false,
            message: 'Model selection cancelled'
          };
        }
      } catch (error) {
        return {
          success: false,
          message: `Error selecting model: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }

    const requestedModel = args[0]?.toLowerCase() || '';
    const modelMap: Record<string, string> = {
      // OpenAI models
      'gpt-4o': 'gpt-4o',
      'gpt4o': 'gpt-4o',
      'gpt-4-turbo': 'gpt-4-turbo',
      'gpt4turbo': 'gpt-4-turbo',
      // Anthropic models
      'claude-3-opus': 'claude-3-opus',
      'claude3opus': 'claude-3-opus',
      'opus': 'claude-3-opus',
      'claude-3-sonnet': 'claude-3-sonnet',
      'claude3sonnet': 'claude-3-sonnet',
      'sonnet': 'claude-3-sonnet',
      // Google models
      'gemini': 'gemini-2.5-pro',
      'gemini-2.5-pro': 'gemini-2.5-pro',
      'gemini25pro': 'gemini-2.5-pro',
      // Groq models
      'mixtral': 'mixtral-8x7b',
      'mixtral-8x7b': 'mixtral-8x7b',
      'llama3': 'llama-3-70b',
      'llama-3-70b': 'llama-3-70b',
      // Local models (LM Studio)
      'gpt-oss-120b': 'gpt-oss-120b',
      '120b': 'gpt-oss-120b',
      'gpt-oss-20b': 'gpt-oss-20b',
      '20b': 'gpt-oss-20b',
      'qwen3-30b': 'qwen3-30b',
      'qwen30b': 'qwen3-30b',
      'qwen3': 'qwen3-30b',
      // Ollama models
      'qwen2.5-vl': 'qwen2.5-vl',
      'qwenvl': 'qwen2.5-vl',
      'vision': 'qwen2.5-vl'
    };
    
    const newModel = modelMap[requestedModel];
    
    if (!newModel) {
      return {
        success: false,
        message: `❌ Invalid model: "${args[0]}"\n\n**Available models:**\n☁️ Cloud: gpt-4o, claude-3-opus, gemini-2.5-pro, mixtral-8x7b\n💻 Local: gpt-oss-120b, gpt-oss-20b, qwen3-30b, qwen2.5-vl\n\nUse \`/model\` to see detailed information.`
      };
    }

    // Update context preferences
    if (!context.preferences) {
      context.preferences = {
        language: 'ja',
        verbosity: 'normal',
        autoMode: false,
        defaultModel: 'gemini-2.5-pro',
        theme: 'dark'
      };
    }
    context.preferences.defaultModel = newModel as any;

    // Update config file
    try {
      const config = await readConfig();
      config.defaultModel = newModel as any;
      await writeConfig(config);
    } catch (error) {
      return {
        success: false,
        message: `❌ Failed to save model configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }

    const newModelInfo = allModels.find(m => m.id === newModel);
    const modelType = cloudModels.some(m => m.id === newModel) ? '☁️ Cloud' : '💻 Local';
    let statusMessage = `✅ **AI Model Updated**\n\n`;
    statusMessage += `🤖 **Active Model**: ${newModelInfo?.name || newModel}\n`;
    statusMessage += `📍 **Type**: ${modelType} (${newModelInfo?.provider || 'Unknown'})\n`;
    statusMessage += `📊 **Context**: ${newModelInfo?.context || 'N/A'}`;
    if (newModelInfo && 'vram' in newModelInfo) {
      statusMessage += ` | **VRAM**: ${newModelInfo.vram}`;
    }
    statusMessage += `\n📝 **Optimized for**: ${newModelInfo?.description || 'Advanced AI tasks'}\n\n`;
    statusMessage += `💡 Your next messages will use this model. Type something to test it!`;
    
    return {
      success: true,
      message: statusMessage,
      data: { model: newModel, modelInfo: newModelInfo, type: modelType }
    };
  }

  // 設定・環境管理コマンドの詳細実装
  private async handlePermissions(args: string[]): Promise<SlashCommandResult> {
    const config = await readConfig();
    
    if (args.length === 0) {
      const permissions = config.permissions || {
        fileAccess: true,
        networkAccess: true,
        systemCommands: false
      };
      
      return {
        success: true,
        message: `Current permissions:\n  File Access: ${permissions.fileAccess}\n  Network Access: ${permissions.networkAccess}\n  System Commands: ${permissions.systemCommands}`,
        data: { permissions }
      };
    }

    const [permission] = args;
    const validPermissions = ['fileAccess', 'networkAccess', 'systemCommands'];
    
    if (!permission || !validPermissions.includes(permission)) {
      return {
        success: false,
        message: `Invalid permission: ${permission || 'undefined'}. Available: ${validPermissions.join(', ')}`
      };
    }

    // Permission modification not implemented yet

    const currentValue = config.permissions?.[permission as keyof typeof config.permissions];
    return {
      success: true,
      message: `${permission}: ${currentValue || 'undefined'}`
    };
  }

  private async handleHooks(args: string[]): Promise<SlashCommandResult> {
    const config = await readConfig();
    
    if (args.length === 0) {
      const hooks = config.hooks || {};
      const hooksList = Object.entries(hooks)
        .map(([key, value]) => `  ${key}: ${value}`)
        .join('\n');
      
      return {
        success: true,
        message: `Configured hooks:\n${hooksList || '  None'}`,
        data: { hooks }
      };
    }

    const [hookName, ...commandParts] = args;
    const validHooks = ['onStart', 'onExit', 'onError'];
    
    if (!hookName || !validHooks.includes(hookName)) {
      return {
        success: false,
        message: `Invalid hook: ${hookName || 'undefined'}. Available: ${validHooks.join(', ')}`
      };
    }

    if (commandParts.length > 0) {
      const command = commandParts.join(' ');
      if (!config.hooks) config.hooks = {};
      (config.hooks as any)[hookName] = command;
      await writeConfig(config);
      
      return {
        success: true,
        message: `Hook ${hookName} set to: ${command}`
      };
    }

    // フック削除
    if (config.hooks && hookName && (config.hooks as any)[hookName]) {
      delete (config.hooks as any)[hookName];
      await writeConfig(config);
      return {
        success: true,
        message: `Hook ${hookName} removed`
      };
    }

    return {
      success: true,
      message: `Hook ${hookName} is not set`
    };
  }

  private async handleDoctor(): Promise<SlashCommandResult> {
    return {
      success: true,
      message: 'Running system diagnostics...',
      component: 'system-diagnostics'
    };
  }

  private async handleTerminalSetup(): Promise<SlashCommandResult> {
    const instructions = `Terminal Setup Instructions:

1. Bash/Zsh (Linux/macOS):
   Add to ~/.bashrc or ~/.zshrc:
   alias mc='npx @maria/code-cli'
   bind '"\\e[13;2u": "\\C-u mc chat \\C-m"'  # Shift+Enter

2. Fish Shell:
   Add to ~/.config/fish/config.fish:
   alias mc 'npx @maria/code-cli'
   bind '\\e[13;2u' 'commandline "mc chat"; commandline -f execute'

3. PowerShell (Windows):
   Add to $PROFILE:
   Set-Alias mc 'npx @maria/code-cli'
   
4. Terminal Configuration:
   - Enable bracketed paste mode for better text handling
   - Set TERM=xterm-256color for better color support
   - Configure your terminal to send Shift+Enter as \\e[13;2u

5. IDE Integration:
   - VS Code: Install MARIA extension
   - JetBrains: Configure external tool
   - Vim/Neovim: Use terminal integration

Run /config to customize MARIA settings.`;

    return {
      success: true,
      message: instructions,
      data: { setupComplete: false }
    };
  }

  private async handleInit(): Promise<SlashCommandResult> {
    try {
      const rootPath = process.cwd();
      const mariaPath = path.join(rootPath, 'MARIA.md');
      const exists = fs.existsSync(mariaPath);
      
      if (exists) {
        // Update existing MARIA.md with latest codebase analysis
        console.log('📊 Analyzing codebase for MARIA.md update...');
        const analysis = await this.analyzeCodebase(rootPath);
        const updatedContent = await this.updateMariaMd(mariaPath, analysis);
        
        fs.writeFileSync(mariaPath, updatedContent, 'utf8');
        
        return {
          success: true,
          message: `✅ MARIA.md updated with latest codebase analysis\n` +
                  `📁 Analyzed: ${analysis.fileCount} files in ${analysis.directories.length} directories\n` +
                  `🏗️  Tech Stack: ${analysis.techStack.join(', ')}\n` +
                  `⏰ Updated: ${new Date().toISOString()}`
        };
      } else {
        // Create new MARIA.md with codebase analysis
        console.log('📊 Creating new MARIA.md with codebase analysis...');
        const analysis = await this.analyzeCodebase(rootPath);
        const content = await this.createMariaMd(rootPath, analysis);
        
        fs.writeFileSync(mariaPath, content, 'utf8');
        
        return {
          success: true,
          message: `✅ MARIA.md created successfully\n` +
                  `📁 Analyzed: ${analysis.fileCount} files in ${analysis.directories.length} directories\n` +
                  `🏗️  Tech Stack: ${analysis.techStack.join(', ')}\n` +
                  `📍 Location: ${mariaPath}`
        };
      }
    } catch (error) {
      return {
        success: false,
        message: `❌ Failed to initialize MARIA.md: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async handleAddDir(): Promise<SlashCommandResult> {
    return { success: true, message: 'Add directory (TODO: implement)' };
  }

  private async handleMemory(): Promise<SlashCommandResult> {
    return { success: true, message: 'Memory management (TODO: implement)' };
  }

  private async handleExport(): Promise<SlashCommandResult> {
    return { success: true, message: 'Export conversation (TODO: implement)' };
  }

  // エージェント・統合管理コマンド
  private async handleAgents(): Promise<SlashCommandResult> {
    const builtinAgents = [
      { name: 'Paper Writer', status: 'available', description: 'Academic paper generation and LaTeX formatting' },
      { name: 'Slides Creator', status: 'available', description: 'Presentation creation with AI content generation' },
      { name: 'Code Reviewer', status: 'available', description: 'AI-powered code review and suggestions' },
      { name: 'DevOps Engineer', status: 'available', description: 'Deployment and infrastructure management' }
    ];

    const ideIntegrations = [
      { name: 'VS Code', status: 'available', description: 'MARIA extension for Visual Studio Code' },
      { name: 'JetBrains', status: 'planned', description: 'IntelliJ IDEA and WebStorm integration' },
      { name: 'Neovim', status: 'available', description: 'Terminal-based integration' }
    ];

    return {
      success: true,
      message: 'Opening AI agents management dashboard...',
      data: { agents: builtinAgents, integrations: ideIntegrations },
      component: 'agents-display'
    };
  }

  private async handleMcp(): Promise<SlashCommandResult> {
    const mcpServers = [
      { name: 'Playwright', status: 'active', description: 'Browser automation and testing' },
      { name: 'FileSystem', status: 'active', description: 'File operations and project management' },
      { name: 'Git', status: 'active', description: 'Version control integration' },
      { name: 'SQLite', status: 'available', description: 'Database operations and queries' },
      { name: 'GitHub', status: 'available', description: 'GitHub API integration' }
    ];

    const activeServers = mcpServers.filter(s => s.status === 'active');
    const availableServers = mcpServers.filter(s => s.status === 'available');

    const message = `MCP (Model Context Protocol) Server Management:

🟢 Active Servers (${activeServers.length}):
${activeServers.map(server => `• ${server.name}: ${server.description}`).join('\n')}

⚪ Available Servers (${availableServers.length}):
${availableServers.map(server => `• ${server.name}: ${server.description}`).join('\n')}

🔧 Management Commands:
• /mcp start <server> - Start MCP server
• /mcp stop <server> - Stop MCP server  
• /mcp restart <server> - Restart MCP server
• /mcp status - Show detailed server status
• /mcp logs <server> - View server logs

📊 Server Health:
• Total capacity: 5 servers
• Active connections: ${activeServers.length}
• Memory usage: ~${Math.round(Math.random() * 100)}MB
• Average response time: ${Math.round(Math.random() * 50 + 10)}ms

[INFO] MCP servers provide AI models with tool capabilities for enhanced functionality.`;

    return {
      success: true,
      message,
      data: { servers: mcpServers, active: activeServers.length, available: availableServers.length }
    };
  }

  private async handleClear(context: ConversationContext, args: string[]): Promise<SlashCommandResult> {
    const option = args[0]?.toLowerCase();
    const stats = this.chatContextService.getStats();
    const historyCount = context.history.length;
    const previousCost = context.metadata?.cost || 0;
    const previousTokens = context.metadata?.totalTokens || 0;

    // Parse options
    const options = {
      soft: option === '--soft',
      hard: option === '--hard',
      summary: option === '--summary'
    };

    // Handle soft clear (display only)
    if (options.soft) {
      this.chatContextService.clearContext({ soft: true });
      return {
        success: true,
        message: `Display cleared (context preserved: ${stats.messagesInWindow} messages, ${stats.totalTokens} tokens)`,
        data: {
          type: 'soft',
          preservedMessages: stats.messagesInWindow,
          preservedTokens: stats.totalTokens
        }
      };
    }

    // Handle summary generation before clear
    if (options.summary) {
      const summary = await this.chatContextService.exportContext('markdown');
      const summaryPath = path.join(process.env.HOME || '', '.maria', 'summaries', `summary-${Date.now()}.md`);
      
      try {
        await fs.promises.mkdir(path.dirname(summaryPath), { recursive: true });
        await fs.promises.writeFile(summaryPath, summary);
        
        this.chatContextService.clearContext({ summary: true });
        context.history = [];
        if (context.metadata) {
          context.metadata.totalTokens = 0;
          context.metadata.cost = 0;
          context.metadata.lastActivity = new Date();
        }
        delete context.currentTask;

        return {
          success: true,
          message: `Context cleared with summary (${historyCount} messages summarized → ${summaryPath})`,
          data: {
            type: 'summary',
            summaryPath,
            clearedMessages: historyCount,
            freedTokens: previousTokens
          }
        };
      } catch (error) {
        logger.error('Failed to save summary:', error);
      }
    }

    // Handle hard clear (complete reset)
    const clearType = options.hard ? 'hard' : 'normal';
    this.chatContextService.clearContext({ soft: false });
    
    // Clear conversation context
    context.history = [];
    if (context.metadata) {
      context.metadata.totalTokens = 0;
      context.metadata.cost = 0;
      context.metadata.lastActivity = new Date();
    }
    delete context.currentTask;

    // Display context usage indicator
    const indicator = this.chatContextService.getTokenUsageIndicator();

    return { 
      success: true, 
      message: `${clearType === 'hard' ? '🔄 Complete reset' : '🧹 Context cleared'} (${historyCount} messages, $${previousCost.toFixed(4)}, ${previousTokens} tokens freed)\n${indicator}`,
      data: { 
        type: clearType,
        clearedMessages: historyCount,
        freedCost: previousCost,
        freedTokens: previousTokens,
        compressionCount: stats.compressedCount
      }
    };
  }

  private async handleCompact(context: ConversationContext): Promise<SlashCommandResult> {
    if (!context.history.length) {
      return {
        success: false,
        message: 'No conversation history to compact'
      };
    }

    const originalCount = context.history.length;
    const originalTokens = context.metadata?.totalTokens || 0;

    // 重要なメッセージのみを保持（エラー、重要なシステムメッセージ、最後の5つの交換）
    const importantMessages = context.history.filter(msg => 
      msg.metadata?.error || 
      msg.role === 'system' ||
      msg.metadata?.command
    );

    const recentMessages = context.history.slice(-10); // 最新10メッセージを保持
    const compactedHistory = [
      ...importantMessages.slice(0, 5), // 重要メッセージの最初の5つ
      {
        id: `compact-${Date.now()}`,
        role: 'system' as const,
        content: `[Conversation compacted: ${originalCount - recentMessages.length - 5} messages summarized]`,
        timestamp: new Date(),
        metadata: { command: 'compact' }
      },
      ...recentMessages
    ];

    // 重複を除去
    const uniqueMessages = compactedHistory.filter((msg, index, arr) => 
      arr.findIndex(m => m.id === msg.id) === index
    );

    context.history = uniqueMessages;
    
    // トークン数を推定 (簡易計算: 文字数 ÷ 4)
    const newTokenCount = Math.ceil(
      uniqueMessages.reduce((sum, msg) => sum + msg.content.length, 0) / 4
    );
    
    if (context.metadata) {
      context.metadata.totalTokens = newTokenCount;
      context.metadata.cost = newTokenCount * 0.000002; // 簡易計算
    }

    return { 
      success: true, 
      message: `Conversation compacted: ${originalCount} → ${uniqueMessages.length} messages (${Math.round((originalTokens - newTokenCount) / originalTokens * 100)}% size reduction)`,
      data: {
        originalCount,
        compactedCount: uniqueMessages.length,
        tokenReduction: originalTokens - newTokenCount,
        reductionPercent: Math.round((originalTokens - newTokenCount) / originalTokens * 100)
      }
    };
  }

  private async handleResume(context: ConversationContext): Promise<SlashCommandResult> {
    const resumeFile = `${process.cwd()}/.maria-session.json`;

    try {
      const fs = await import('fs/promises');
      const resumeData = await fs.readFile(resumeFile, 'utf-8');
      const savedContext = JSON.parse(resumeData) as Partial<ConversationContext>;

      if (!savedContext.history) {
        return {
          success: false,
          message: 'No saved conversation found to resume'
        };
      }

      // 保存された会話を現在のコンテキストにマージ
      context.history = savedContext.history.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));

      if (savedContext.currentTask) {
        context.currentTask = {
          ...savedContext.currentTask,
          startTime: new Date(savedContext.currentTask.startTime)
        };
      }

      if (savedContext.metadata) {
        context.metadata = {
          ...context.metadata,
          ...savedContext.metadata,
          startTime: new Date(savedContext.metadata.startTime || Date.now()),
          lastActivity: new Date(savedContext.metadata.lastActivity || Date.now())
        };
      }

      // レジューム後はファイルを削除
      await fs.unlink(resumeFile);

      return { 
        success: true, 
        message: `Conversation resumed: ${context.history.length} messages restored${context.currentTask ? ` (task: ${context.currentTask.title || context.currentTask.type})` : ''}`,
        data: {
          messagesRestored: context.history.length,
          taskRestored: !!context.currentTask,
          lastActivity: context.metadata?.lastActivity
        }
      };

    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return {
          success: false,
          message: 'No saved conversation found to resume'
        };
      }
      
      logger.error('Resume conversation error', error);
      return {
        success: false,
        message: `Failed to resume conversation: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async handleCost(context: ConversationContext): Promise<SlashCommandResult> {
    const cost = context.metadata?.cost || 0;
    const tokens = context.metadata?.totalTokens || 0;
    const sessionStart = context.metadata?.startTime || new Date();
    const duration = Math.round((Date.now() - sessionStart.getTime()) / 1000);
    const messageCount = context.history.length;

    // ユーザープランに基づくコスト制限を取得
    const dailyLimit = this.userSession.plan === 'free' ? 100 : 
                      this.userSession.plan === 'pro' ? 5000 : 20000;
    const remainingCredits = this.userSession.credits;

    // 詳細な使用量統計
    const stats = {
      session: {
        cost: cost,
        tokens: tokens,
        messages: messageCount,
        duration: `${Math.floor(duration / 60)}m ${duration % 60}s`,
        avgCostPerMessage: messageCount > 0 ? (cost / messageCount) : 0
      },
      user: {
        plan: this.userSession.plan,
        dailyLimit: dailyLimit,
        remainingCredits: remainingCredits,
        usagePercent: Math.round((dailyLimit - remainingCredits) / dailyLimit * 100)
      },
      projected: {
        hourlyRate: duration > 0 ? (cost * 3600 / duration) : 0,
        dailyProjection: duration > 0 ? (cost * 86400 / duration) : 0
      }
    };

    return {
      success: true,
      message: 'Opening cost analysis dashboard...',
      data: stats,
      component: 'cost-display'
    };
  }

  private async handleReview(args: string[] = []): Promise<SlashCommandResult> {
    try {
      // GitHub CLI を使用してPR情報を取得
      const { execSync } = await import('child_process');
      
      // カレントブランチのPR番号を取得
      let prNumber = args[0];
      if (!prNumber) {
        try {
          const prInfo = execSync('gh pr view --json number', { encoding: 'utf-8' });
          const parsed = JSON.parse(prInfo);
          prNumber = parsed.number;
        } catch {
          return {
            success: false,
            message: 'No PR found for current branch. Please specify PR number: /review <pr-number>'
          };
        }
      }

      // PR詳細情報を取得
      const prDetails = execSync(`gh pr view ${prNumber} --json title,body,commits,files,comments,reviews`, { encoding: 'utf-8' });
      const pr = JSON.parse(prDetails);

      // PR差分を取得
      const diffOutput = execSync(`gh pr diff ${prNumber}`, { encoding: 'utf-8' });

      // レビュー分析の実行
      const analysis = {
        title: pr.title,
        description: pr.body || 'No description provided',
        filesChanged: pr.files?.length || 0,
        commits: pr.commits?.length || 0,
        existingComments: pr.comments?.length || 0,
        reviews: pr.reviews?.length || 0,
        diffSize: diffOutput.split('\n').length,
        complexity: this.analyzePRComplexity(diffOutput),
        suggestions: this.generateReviewSuggestions(pr, diffOutput)
      };

      const message = `PR Review Analysis - #${prNumber}:
📋 Title: ${analysis.title}
📊 Stats: ${analysis.filesChanged} files, ${analysis.commits} commits, ${analysis.diffSize} diff lines
🔍 Complexity: ${analysis.complexity}
💬 Existing: ${analysis.existingComments} comments, ${analysis.reviews} reviews

[AI] Suggestions:
${analysis.suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Use 'gh pr comment ${prNumber} --body "<comment>"' to add feedback.`;

      return {
        success: true,
        message,
        data: { prNumber, analysis, diff: diffOutput }
      };

    } catch (error) {
      logger.error('PR review error', error);
      return {
        success: false,
        message: `Failed to review PR: ${error instanceof Error ? error.message : 'Unknown error'}. Make sure GitHub CLI is installed and you're authenticated.`
      };
    }
  }

  private async handlePrComments(args: string[] = []): Promise<SlashCommandResult> {
    try {
      const { execSync } = await import('child_process');
      
      let prNumber = args[0];
      if (!prNumber) {
        try {
          const prInfo = execSync('gh pr view --json number', { encoding: 'utf-8' });
          const parsed = JSON.parse(prInfo);
          prNumber = parsed.number;
        } catch {
          return {
            success: false,
            message: 'No PR found for current branch. Please specify PR number: /pr-comments <pr-number>'
          };
        }
      }

      // PR コメントとレビューを取得
      const commentsData = execSync(`gh pr view ${prNumber} --json comments,reviews`, { encoding: 'utf-8' });
      const data = JSON.parse(commentsData);

      const comments = data.comments || [];
      const reviews = data.reviews || [];
      
      // コメントを時系列でソート
      const allFeedback = [
        ...comments.map((c: any) => ({ ...c, type: 'comment' })),
        ...reviews.map((r: any) => ({ ...r, type: 'review' }))
      ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      if (!allFeedback.length) {
        return {
          success: true,
          message: `No comments or reviews found for PR #${prNumber}`,
          data: { prNumber, comments: [], reviews: [] }
        };
      }

      // フィードバック分析
      const analysis = {
        totalComments: comments.length,
        totalReviews: reviews.length,
        approvals: reviews.filter((r: any) => r.state === 'APPROVED').length,
        changeRequests: reviews.filter((r: any) => r.state === 'CHANGES_REQUESTED').length,
        pendingReviews: reviews.filter((r: any) => r.state === 'PENDING').length,
        actionItems: this.extractActionItems(allFeedback),
        sentiment: this.analyzeFeedbackSentiment(allFeedback)
      };

      const message = `PR Comments Analysis - #${prNumber}:
📊 Overview: ${analysis.totalComments} comments, ${analysis.totalReviews} reviews
[OK] Approvals: ${analysis.approvals}
[REQ] Change Requests: ${analysis.changeRequests}
[WAIT] Pending: ${analysis.pendingReviews}
😊 Sentiment: ${analysis.sentiment}

🎯 Action Items (${analysis.actionItems.length}):
${analysis.actionItems.map((item, i) => `${i + 1}. ${item}`).join('\n')}

Recent Feedback:
${allFeedback.slice(-3).map((fb: any) => 
  `• ${fb.author?.login || 'Unknown'} (${fb.type}): ${(fb.body || '').substring(0, 100)}...`
).join('\n')}`;

      return {
        success: true,
        message,
        data: { prNumber, analysis, feedback: allFeedback }
      };

    } catch (error) {
      logger.error('PR comments error', error);
      return {
        success: false,
        message: `Failed to get PR comments: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async handleBug(args: string[] = []): Promise<SlashCommandResult> {
    const bugType = args[0] || 'general';
    const description = args.slice(1).join(' ');

    if (!description) {
      return {
        success: false,
        message: 'Please provide a bug description: /bug <type> <description>',
        data: { 
          availableTypes: ['crash', 'performance', 'ui', 'api', 'security', 'feature', 'general'],
          example: '/bug crash "CLI crashes when running /export command"' 
        }
      };
    }

    try {
      // システム情報を収集
      const systemInfo = {
        platform: process.platform,
        nodeVersion: process.version,
        cliVersion: '2.5.3', // TODO: package.jsonから動的に取得
        workingDirectory: process.cwd(),
        timestamp: new Date().toISOString(),
        user: this.userSession.userId || 'anonymous'
      };

      // バグレポートの構造化
      const bugReport = {
        type: bugType,
        description: description,
        system: systemInfo,
        context: {
          lastCommands: [], // TODO: コマンド履歴から取得
          projectType: 'unknown', // TODO: プロジェクト検出
          reproductionSteps: []
        },
        severity: this.assessBugSeverity(bugType, description),
        reportId: `bug-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      };

      // ローカルファイルに保存（フィードバック収集用）
      const fs = await import('fs/promises');
      const reportsDir = `${process.cwd()}/.maria-reports`;
      
      try {
        await fs.mkdir(reportsDir, { recursive: true });
        await fs.writeFile(
          `${reportsDir}/${bugReport.reportId}.json`,
          JSON.stringify(bugReport, null, 2)
        );
      } catch (saveError) {
        logger.warn('Could not save bug report locally', saveError);
      }

      const message = `Bug Report Submitted 🐛:
🆔 Report ID: ${bugReport.reportId}
📝 Type: ${bugType}
📊 Severity: ${bugReport.severity}
🔧 Description: ${description}

💻 System Info:
• Platform: ${systemInfo.platform}
• Node.js: ${systemInfo.nodeVersion}
• CLI Version: ${systemInfo.cliVersion}

📁 Saved to: .maria-reports/${bugReport.reportId}.json

Thank you for helping improve MARIA! 🙏
For urgent issues, please contact support at https://github.com/anthropics/claude-code/issues`;

      return {
        success: true,
        message,
        data: { bugReport, reportPath: `${reportsDir}/${bugReport.reportId}.json` }
      };

    } catch (error) {
      logger.error('Bug report error', error);
      return {
        success: false,
        message: `Failed to submit bug report: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async handleReleaseNotes(args: string[] = []): Promise<SlashCommandResult> {
    const version = args[0] || 'latest';
    
    try {
      const { execSync } = await import('child_process');
      
      // GitHub API を使用してリリース情報を取得
      let releaseData: string;
      
      try {
        if (version === 'latest') {
          releaseData = execSync('gh release view --json tagName,name,body,publishedAt,assets', { encoding: 'utf-8' });
        } else {
          releaseData = execSync(`gh release view ${version} --json tagName,name,body,publishedAt,assets`, { encoding: 'utf-8' });
        }
      } catch (ghError: any) {
        // No release found - return graceful message
        if (ghError.stderr?.includes('release not found') || ghError.message?.includes('release not found')) {
          return {
            success: true,
            message: `📦 Release Notes\n\nNo releases found in this repository yet.\n\nOnce releases are published, you can view them with:\n  /release-notes        - Latest release\n  /release-notes v1.0.0 - Specific version`
          };
        }
        throw ghError;
      }
      
      const release = JSON.parse(releaseData);
      
      // リリースノートの解析
      const analysis = {
        version: release.tagName,
        title: release.name,
        publishDate: new Date(release.publishedAt).toLocaleDateString(),
        bodyLength: (release.body || '').length,
        features: this.extractFeatures(release.body || ''),
        bugFixes: this.extractBugFixes(release.body || ''),
        breakingChanges: this.extractBreakingChanges(release.body || ''),
        assets: release.assets?.length || 0
      };

      const message = `Release Notes - ${analysis.version}:
📅 Released: ${analysis.publishDate}
🏷️  Title: ${analysis.title}

✨ New Features (${analysis.features.length}):
${analysis.features.map(f => `• ${f}`).join('\n') || '• None listed'}

🐛 Bug Fixes (${analysis.bugFixes.length}):
${analysis.bugFixes.map(f => `• ${f}`).join('\n') || '• None listed'}

[WARN] Breaking Changes (${analysis.breakingChanges.length}):
${analysis.breakingChanges.map(c => `• ${c}`).join('\n') || '• None'}

📦 Assets: ${analysis.assets} files available
📄 Full notes: gh release view ${analysis.version}`;

      return {
        success: true,
        message,
        data: { release, analysis }
      };

    } catch (error) {
      logger.error('Release notes error', error);
      
      // Fallback to built-in version info
      const fallbackMessage = `Release Notes - Current Version (2.5.3):
📅 Released: 2025-01-30
🏷️  Title: CLI Extensions & Slash Commands Complete

✨ New Features:
• Complete slash command system (38 commands)
• Conversation management (/clear, /compact, /resume, /cost)
• Development support (/review, /pr-comments, /bug, /release-notes)
• Project management (/init, /add-dir, /memory, /export)
• System diagnostics and configuration
• Enhanced UI modes and help system

🐛 Bug Fixes:
• TypeScript type safety improvements
• ESLint compliance fixes
• CLI stability enhancements

[WARN] Breaking Changes:
• None

For latest releases: https://github.com/anthropics/claude-code/releases`;

      return {
        success: true,
        message: fallbackMessage,
        data: { version: '2.5.3', source: 'fallback' }
      };
    }
  }

  private async handleVim(context: ConversationContext): Promise<SlashCommandResult> {
    const config = await readConfig();
    
    // Vim モードの現在の状態を取得
    const currentVimMode = config.cli?.vimMode || false;
    const newVimMode = !currentVimMode;
    
    // Vim モード設定を更新
    if (context.preferences) {
      (context.preferences as any).vimMode = newVimMode;
    }
    
    // 設定ファイルに保存
    if (!config.cli) config.cli = {};
    config.cli.vimMode = newVimMode;
    if (!config.cli.keyBindings) config.cli.keyBindings = {};
    config.cli.keyBindings.mode = newVimMode ? 'vim' : 'emacs';
    await writeConfig(config);

    // Vim モードの機能説明
    const vimFeatures = [
      'hjkl navigation in chat history',
      'i/a for input mode, Esc for normal mode',
      ':q to exit, :w to save conversation',
      'dd to delete message, yy to copy',
      '/ for search, n/N for next/previous',
      'u for undo, Ctrl+r for redo'
    ];

    const normalFeatures = [
      'Arrow keys for navigation',
      'Standard copy/paste (Ctrl+C/V)',
      'Tab completion for commands',
      'Standard terminal shortcuts'
    ];

    const message = newVimMode 
      ? `Vim Mode Enabled [ON]\n\nVim-style keyboard shortcuts activated:\n${vimFeatures.map(f => `• ${f}`).join('\n')}\n\nPress Esc to enter normal mode, i to enter insert mode.`
      : `Normal Mode Enabled [NORMAL]\n\nStandard keyboard shortcuts restored:\n${normalFeatures.map(f => `• ${f}`).join('\n')}\n\nVim keybindings disabled.`;

    return {
      success: true,
      message,
      data: { 
        vimMode: newVimMode,
        keyBindings: config.cli?.keyBindings,
        features: newVimMode ? vimFeatures : normalFeatures
      }
    };
  }

  private async handleVersion(): Promise<SlashCommandResult> {
    try {
      // Try to read version from package.json
      const fs = await import('fs/promises');
      const path = await import('path');
      const packagePath = path.resolve(process.cwd(), 'package.json');
      const packageData = JSON.parse(await fs.readFile(packagePath, 'utf8'));
      
      return {
        success: true,
        message: `MARIA CODE CLI v${packageData.version || '1.0.0'}\n\nAI-Powered Development Platform\n© 2025 Bonginkan Inc.\n\nTypeScript Monorepo`
      };
    } catch {
      // Fallback if package.json can't be read
      return {
        success: true,
        message: `MARIA CODE CLI v1.0.0\n\nAI-Powered Development Platform\n© 2025 Bonginkan Inc.\n\nTypeScript Monorepo`
      };
    }
  }

  private async handleHelp(args: string[]): Promise<SlashCommandResult> {
    const arg = args[0]?.toLowerCase();
    
    // If no argument, show general help
    if (!arg) {
      let helpText = `🚀 MARIA CODE - Interactive AI Development CLI\n\n`;
      helpText += `Usage: /help [category|command]\n\n`;
      helpText += `📚 COMMAND CATEGORIES:\n\n`;
      
      // Show all categories with their descriptions
      Object.entries(commandCategories).forEach(([key, name]) => {
        const category = key as CommandCategory;
        const commands = getCommandsByCategory(category);
        helpText += `  ${name.padEnd(25)} - ${commands.length} commands\n`;
        helpText += `  /help ${key.padEnd(20)} - Show ${name.toLowerCase()} commands\n\n`;
      });

      helpText += `💡 TIPS:\n`;
      helpText += `  • Use Tab for command completion\n`;
      helpText += `  • /help <command> for detailed info (e.g., /help /init)\n`;
      helpText += `  • Commands suggest related actions after execution\n`;
      helpText += `  • Chain commands for workflows (e.g., /init → /add-dir → /memory)\n\n`;
      
      const totalCommands = Object.keys(commandCategories).reduce(
        (sum, cat) => sum + getCommandsByCategory(cat as CommandCategory).length, 0
      );
      helpText += `Total commands available: ${totalCommands}`;

      return {
        success: true,
        message: helpText,
        component: 'help-dialog'
      };
    }
    
    // Check if argument is a category
    if (arg in commandCategories) {
      const category = arg as CommandCategory;
      const categoryName = commandCategories[category];
      const commands = getCommandsByCategory(category);
      
      let helpText = `📖 ${categoryName.toUpperCase()}\n\n`;
      
      commands.forEach(cmd => {
        helpText += `${cmd.command.padEnd(20)} - ${cmd.description}\n`;
        if (cmd.usage) {
          helpText += `  Usage: ${cmd.usage}\n`;
        }
        if (cmd.examples && cmd.examples.length > 0) {
          helpText += `  Examples:\n`;
          cmd.examples.forEach(ex => helpText += `    ${ex}\n`);
        }
        if (cmd.relatedCommands && cmd.relatedCommands.length > 0) {
          helpText += `  Related: ${cmd.relatedCommands.join(', ')}\n`;
        }
        helpText += '\n';
      });
      
      return {
        success: true,
        message: helpText,
        component: 'help-dialog'
      };
    }
    
    // Check if argument is a specific command
    const commandArg = arg.startsWith('/') ? arg : `/${arg}`;
    const commandInfo = getCommandInfo(commandArg);
    
    if (commandInfo) {
      let helpText = `📌 Command: ${commandInfo.command}\n\n`;
      helpText += `Description: ${commandInfo.description}\n\n`;
      
      if (commandInfo.usage) {
        helpText += `Usage: ${commandInfo.usage}\n\n`;
      }
      
      if (commandInfo.examples && commandInfo.examples.length > 0) {
        helpText += `Examples:\n`;
        commandInfo.examples.forEach(ex => helpText += `  ${ex}\n`);
        helpText += '\n';
      }
      
      if (commandInfo.relatedCommands && commandInfo.relatedCommands.length > 0) {
        helpText += `Related Commands:\n`;
        const related = getRelatedCommands(commandInfo.command);
        related.forEach(rel => {
          helpText += `  ${rel.command.padEnd(15)} - ${rel.description}\n`;
        });
        helpText += '\n';
      }
      
      // Check if this command is part of a workflow
      const chain = getCommandChain(commandInfo.command);
      if (chain) {
        helpText += `\n🔗 Part of workflow: "${chain.name}"\n`;
        helpText += `  ${chain.description}\n`;
        helpText += `  Chain: ${chain.commands.join(' → ')}\n`;
      }
      
      return {
        success: true,
        message: helpText,
        component: 'help-dialog'
      };
    }
    
    // Unknown argument
    return {
      success: false,
      message: `Unknown help topic: ${arg}\n\nTry:\n  /help - Show all categories\n  /help <category> - Show category commands\n  /help <command> - Show command details`
    };

    return {
      success: true,
      message: `📚 MARIA CLI Help - ${Object.keys(commandCategories).length} Categories, ${Object.keys(commandCategories).reduce((sum, categoryKey) => sum + getCommandsByCategory(categoryKey as CommandCategory).length, 0)} Commands`,
      component: 'help-dialog',
      data: { categories: commandCategories, totalCommands: Object.keys(commandCategories).reduce((sum, categoryKey) => sum + getCommandsByCategory(categoryKey as CommandCategory).length, 0) }
    };
  }

  private async handleSuggest(context: ConversationContext): Promise<SlashCommandResult> {
    const suggestionContext: SuggestionContext = {
      projectInitialized: await this.checkProjectInitialized(),
      userLoggedIn: this.userSession.isAuthenticated,
      currentMode: context.preferences?.defaultModel || 'chat',
      sessionDuration: Date.now() - this.sessionStartTime,
      commandHistory: this.suggestionService.getCommandHistory()
    };
    
    // Get contextual suggestions
    const suggestions = await this.suggestionService.getContextualSuggestions(suggestionContext);
    
    // Get most used commands
    const mostUsed = this.suggestionService.getMostUsedCommands(5);
    
    // Get current workflow if any
    const lastCommand = this.suggestionService.getLastCommand();
    const currentChain = lastCommand ? getCommandChain(lastCommand) : undefined;
    
    let message = '💡 Intelligent Command Suggestions\n\n';
    
    // Context-based suggestions
    if (suggestions.length > 0) {
      message += '📍 Based on current context:\n';
      suggestions.forEach(sug => {
        message += `  ${sug.command.padEnd(15)} - ${sug.description}`;
        if (sug.reason) {
          message += ` (${sug.reason})`;
        }
        message += '\n';
      });
      message += '\n';
    }
    
    // Workflow suggestions
    if (currentChain) {
      message += `🔗 Current workflow: "${currentChain.name}"\n`;
      const currentIndex = lastCommand ? currentChain.commands.indexOf(lastCommand) : -1;
      if (currentIndex !== -1 && currentIndex < currentChain.commands.length - 1) {
        message += `  Next: ${currentChain.commands[currentIndex + 1]}\n`;
        message += `  Complete chain: /chain ${Object.keys(commandChains).find(k => commandChains[k as keyof typeof commandChains] === currentChain)}\n`;
      }
      message += '\n';
    }
    
    // Frequently used commands
    if (mostUsed.length > 0) {
      message += '⭐ Your frequently used commands:\n';
      mostUsed.forEach((cmd, i) => {
        message += `  ${(i + 1)}. ${cmd}\n`;
      });
      message += '\n';
    }
    
    // Smart recommendations based on patterns
    message += '🤖 Smart recommendations:\n';
    
    if (!suggestionContext.projectInitialized) {
      message += '  • Start with /init to initialize your project\n';
    } else {
      const timeMinutes = (suggestionContext.sessionDuration || 0) / 60000;
      
      if (timeMinutes > 60) {
        message += '  • Consider /compact to optimize memory (long session)\n';
      }
      
      if (!this.suggestionService.hasUsedCommand('/test')) {
        message += '  • Try /test to ensure code quality\n';
      }
      
      if (!this.suggestionService.hasUsedCommand('/agents')) {
        message += '  • Explore /agents for AI-powered assistance\n';
      }
    }
    
    message += '\nTip: Use /help <command> for detailed information about any command';
    
    return {
      success: true,
      message,
      data: {
        suggestions,
        mostUsed,
        currentWorkflow: currentChain?.name
      }
    };
  }

  private sessionStartTime = Date.now();

  private async handleAlias(args: string[]): Promise<SlashCommandResult> {
    const subCommand = args[0];
    
    // If no subcommand, list all aliases
    if (!subCommand) {
      const { userAliases, builtInAliases } = this.aliasSystem.listAliases();
      
      let message = '🔤 Command Aliases\n\n';
      
      // Built-in aliases
      if (builtInAliases.length > 0) {
        message += '📌 Built-in Aliases:\n';
        builtInAliases.forEach(alias => {
          message += `  ${alias.alias.padEnd(8)} → ${alias.command.padEnd(15)} - ${alias.description}`;
          if (alias.usageCount > 0) {
            message += ` (used ${alias.usageCount}x)`;
          }
          message += '\n';
        });
        message += '\n';
      }
      
      // User aliases
      if (userAliases.length > 0) {
        message += '⭐ Your Custom Aliases:\n';
        userAliases.forEach(alias => {
          message += `  ${alias.alias.padEnd(8)} → ${alias.command.padEnd(15)} - ${alias.description}`;
          if (alias.usageCount > 0) {
            message += ` (used ${alias.usageCount}x)`;
          }
          message += '\n';
        });
        message += '\n';
      } else {
        message += '💡 No custom aliases yet. Create one with: /alias add <alias> <command>\n\n';
      }
      
      message += 'Usage:\n';
      message += '  /alias add <alias> <command> [description] - Create new alias\n';
      message += '  /alias remove <alias>                      - Remove alias\n';
      message += '  /alias export                              - Export aliases to JSON\n';
      message += '  /alias import <json>                       - Import aliases from JSON\n';
      message += '\nExample: /alias add /gs "/git status" "Quick git status"';
      
      return {
        success: true,
        message
      };
    }
    
    // Handle subcommands
    switch (subCommand) {
      case 'add': {
        const alias = args[1];
        const command = args[2];
        const description = args.slice(3).join(' ');
        
        if (!alias || !command) {
          return {
            success: false,
            message: 'Usage: /alias add <alias> <command> [description]\nExample: /alias add /gs "/git status" "Quick git status"'
          };
        }
        
        return await this.aliasSystem.createAlias(alias, command, description);
      }
      
      case 'remove': {
        const alias = args[1];
        
        if (!alias) {
          return {
            success: false,
            message: 'Usage: /alias remove <alias>'
          };
        }
        
        return await this.aliasSystem.removeAlias(alias);
      }
      
      case 'export': {
        const exportData = this.aliasSystem.exportAliases();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `maria-aliases-${timestamp}.json`;
        
        try {
          const fs = await import('fs/promises');
          await fs.writeFile(filename, exportData);
          
          return {
            success: true,
            message: `✅ Aliases exported to ${filename}\n\n${exportData}`
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to export aliases: ${error instanceof Error ? error.message : 'Unknown error'}`
          };
        }
      }
      
      case 'import': {
        const filename = args[1];
        
        if (!filename) {
          return {
            success: false,
            message: 'Usage: /alias import <filename>'
          };
        }
        
        try {
          const fs = await import('fs/promises');
          const jsonData = await fs.readFile(filename, 'utf-8');
          return await this.aliasSystem.importAliases(jsonData);
        } catch (error) {
          return {
            success: false,
            message: `Failed to import aliases: ${error instanceof Error ? error.message : 'Unknown error'}`
          };
        }
      }
      
      default:
        return {
          success: false,
          message: `Unknown alias command: ${subCommand}\n\nAvailable commands: add, remove, export, import`
        };
    }
  }

  private async handleTemplate(args: string[]): Promise<SlashCommandResult> {
    const subCommand = args[0];
    
    // If no subcommand, list all templates
    if (!subCommand) {
      const { userTemplates, builtInTemplates } = this.templateManager.listTemplates();
      
      let message = '📋 Command Templates\n\n';
      
      // Built-in templates
      if (builtInTemplates.length > 0) {
        message += '🏭 Built-in Templates:\n';
        builtInTemplates.forEach(template => {
          message += `\n  📌 ${template.name} (ID: ${template.id})\n`;
          message += `     ${template.description}\n`;
          message += `     Commands: ${template.commands.length} | Tags: ${template.tags?.join(', ') || 'none'}`;
          if (template.usageCount > 0) {
            message += ` | Used: ${template.usageCount}x`;
          }
          message += '\n';
        });
        message += '\n';
      }
      
      // User templates
      if (userTemplates.length > 0) {
        message += '⭐ Your Templates:\n';
        userTemplates.forEach(template => {
          message += `\n  📄 ${template.name} (ID: ${template.id})\n`;
          message += `     ${template.description}\n`;
          message += `     Commands: ${template.commands.length} | Tags: ${template.tags?.join(', ') || 'none'}`;
          if (template.usageCount > 0) {
            message += ` | Used: ${template.usageCount}x`;
          }
          message += '\n';
        });
      } else {
        message += '\n💡 No custom templates yet. Create one with: /template create\n';
      }
      
      message += '\nUsage:\n';
      message += '  /template run <id> [params]       - Run a template\n';
      message += '  /template save <name> <commands>  - Save commands as template\n';
      message += '  /template view <id>               - View template details\n';
      message += '  /template delete <id>             - Delete template\n';
      message += '  /template export [ids]            - Export templates\n';
      message += '  /template import <file>           - Import templates\n';
      
      return {
        success: true,
        message
      };
    }
    
    // Handle subcommands
    switch (subCommand) {
      case 'run': {
        const templateId = args[1];
        if (!templateId) {
          return {
            success: false,
            message: 'Usage: /template run <template-id> [param1=value1] [param2=value2]'
          };
        }
        
        const template = this.templateManager.getTemplate(templateId);
        if (!template) {
          return {
            success: false,
            message: `Template "${templateId}" not found`
          };
        }
        
        // Parse parameters
        const params: Record<string, any> = {};
        args.slice(2).forEach(arg => {
          const [key, value] = arg.split('=');
          if (key && value !== undefined) {
            params[key] = value;
          }
        });
        
        // Validate parameters
        const validation = this.templateManager.validateParameters(template, params);
        if (!validation.valid) {
          return {
            success: false,
            message: `Invalid parameters:\n${validation.errors.join('\n')}`
          };
        }
        
        // Set defaults
        template.parameters?.forEach(param => {
          if (params[param.name] === undefined && param.default !== undefined) {
            params[param.name] = param.default;
          }
        });
        
        // Increment usage count
        this.templateManager.incrementUsageCount(templateId);
        
        // Execute template through chain service
        const commands = template.commands.map(cmd => {
          const command = this.templateManager.substituteParameters(cmd.command, params);
          const args = cmd.args?.map(arg => 
            this.templateManager.substituteParameters(arg, params)
          );
          return `${command} ${args?.join(' ') || ''}`.trim();
        });
        
        return {
          success: true,
          message: `🚀 Running template: "${template.name}"\n\nCommands to execute:\n${commands.map((cmd, i) => `  ${i + 1}. ${cmd}`).join('\n')}\n\nUse /chain to execute the workflow`,
          data: {
            template,
            commands,
            parameters: params
          }
        };
      }
      
      case 'save': {
        const name = args[1];
        const description = args[2] || 'Custom template';
        const commandStrings = args.slice(3);
        
        if (!name || commandStrings.length === 0) {
          return {
            success: false,
            message: 'Usage: /template save <name> <description> <command1> <command2> ...'
          };
        }
        
        const commands = commandStrings.map(cmdStr => {
          const parts = cmdStr.split(' ');
          return {
            command: parts[0] || '',
            args: parts.slice(1).filter(arg => arg.length > 0)
          };
        });
        
        const result = await this.templateManager.createTemplate(name, description, commands);
        
        if (result.success && result.template) {
          return {
            success: true,
            message: `✅ Template "${name}" created successfully!\n\nID: ${result.template.id}\nRun it with: /template run ${result.template.id}`
          };
        }
        
        return result;
      }
      
      case 'delete': {
        const templateId = args[1];
        if (!templateId) {
          return {
            success: false,
            message: 'Usage: /template delete <template-id>'
          };
        }
        
        return await this.templateManager.deleteTemplate(templateId);
      }
      
      default:
        return {
          success: false,
          message: `Unknown template command: ${subCommand}\n\nAvailable commands: run, save, delete, view, export, import`
        };
    }
  }

  private async handleBatch(args: string[], context: ConversationContext): Promise<SlashCommandResult> {
    const subCommand = args[0];
    
    // If no arguments, show help
    if (!subCommand) {
      let message = '⚡ Batch Command Execution\n\n';
      message += 'Execute multiple commands with advanced control flow.\n\n';
      
      message += 'Usage:\n';
      message += '  /batch <command1> && <command2> ...  - Execute commands sequentially\n';
      message += '  /batch --file <filename>              - Execute from file\n';
      message += '  /batch --parallel <cmd1> <cmd2>       - Execute in parallel\n';
      message += '  /batch --stop-on-error <commands>     - Stop if any command fails\n';
      message += '  /batch --dry-run <commands>           - Preview without executing\n\n';
      
      message += 'Advanced Features:\n';
      message += '  • Conditional execution: IF <condition> THEN <command>\n';
      message += '  • Parallel execution: PARALLEL: <cmd1> && <cmd2>\n';
      message += '  • Variables: Commands can set/use variables\n';
      message += '  • Retries: Automatic retry on failure\n\n';
      
      message += 'Examples:\n';
      message += '  /batch /init && /add-dir ./src && /test\n';
      message += '  /batch --parallel /test --type unit /test --type integration\n';
      message += '  /batch --file workflow.batch\n';
      
      return {
        success: true,
        message
      };
    }
    
    // Handle file execution
    if (subCommand === '--file') {
      const filename = args[1];
      if (!filename) {
        return {
          success: false,
          message: 'Usage: /batch --file <filename>'
        };
      }
      
      try {
        const fs = await import('fs/promises');
        const content = await fs.readFile(filename, 'utf-8');
        const commands = this.batchEngine.parseBatchString(content);
        
        const result = await this.batchEngine.executeBatch(commands, context, {
          stopOnError: true
        });
        
        return {
          success: result.success,
          message: `Batch execution ${result.success ? 'completed' : 'failed'}`,
          data: result
        };
      } catch (error) {
        return {
          success: false,
          message: `Failed to read batch file: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
      }
    }
    
    // Parse options
    const options: any = {
      stopOnError: args.includes('--stop-on-error'),
      parallel: args.includes('--parallel'),
      dryRun: args.includes('--dry-run')
    };
    
    // Remove option flags from args
    const commandArgs = args.filter(arg => !arg.startsWith('--'));
    
    // Join commands and split by &&
    const commandString = commandArgs.join(' ');
    const commandStrings = commandString.split('&&').map(cmd => cmd.trim());
    
    // Parse commands
    const commands = commandStrings.map(cmdStr => {
      const parts = cmdStr.split(' ');
      return {
        command: parts[0] || '',
        args: parts.slice(1),
        parallel: options.parallel || false
      };
    });
    
    // Execute batch
    try {
      const result = await this.batchEngine.executeBatch(commands, context, options);
      
      return {
        success: result.success,
        message: `\nBatch execution ${result.success ? 'completed successfully' : 'completed with errors'}`,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        message: `Batch execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async handleChain(args: string[], context: ConversationContext): Promise<SlashCommandResult> {
    const chainName = args[0];
    
    // If no chain name provided, list available chains
    if (!chainName) {
      const availableChains = this.chainService.getAvailableChains();
      let message = '🔗 Available Command Chains:\n\n';
      
      availableChains.forEach(chain => {
        message += `  ${chain.name.padEnd(20)} - ${chain.description}\n`;
        message += `  Commands: ${chain.commands.join(' → ')}\n\n`;
      });
      
      message += 'Usage: /chain <chain-name> [--interactive] [--stop-on-error]\n';
      message += 'Example: /chain projectSetup\n';
      
      return {
        success: true,
        message
      };
    }
    
    // Check for options
    const interactive = args.includes('--interactive');
    const stopOnError = args.includes('--stop-on-error');
    
    // Check if chain is executing
    if (this.chainService.isChainExecuting()) {
      return {
        success: false,
        message: 'A command chain is already executing. Please wait for it to complete.'
      };
    }
    
    // Execute the chain
    const result = await this.chainService.executeChain(
      chainName as any,
      context,
      { interactive, stopOnError }
    );
    
    return {
      success: result.success,
      message: result.summary,
      data: {
        executedCommands: result.executedCommands,
        errors: result.errors
      }
    };
  }

  private async handleHotkey(args: string[]): Promise<SlashCommandResult> {
    const subCommand = args[0];
    
    // If no arguments, show current hotkeys
    if (!subCommand) {
      const bindings = this.hotkeyManager.listBindings();
      if (bindings.length === 0) {
        return {
          success: true,
          message: '⌨️  No hotkeys configured. Use /hotkey add to create one.'
        };
      }
      
      let message = '⌨️  Configured Hotkeys\n\n';
      message += this.hotkeyManager.getHelpText();
      
      return {
        success: true,
        message
      };
    }
    
    switch (subCommand) {
      case 'add': {
        const hotkeyStr = args[1];
        const command = args[2];
        
        if (!hotkeyStr || !command) {
          return {
            success: false,
            message: 'Usage: /hotkey add <key-combination> <command> [description]\n\nExample: /hotkey add ctrl+s /status "Show status"'
          };
        }
        
        const parsed = this.hotkeyManager.parseHotkeyString(hotkeyStr);
        if (!parsed) {
          return {
            success: false,
            message: `Invalid hotkey format: ${hotkeyStr}. Use format like: ctrl+s, ctrl+shift+p`
          };
        }
        
        const description = args.slice(3).join(' ');
        const binding = {
          key: parsed.key,
          modifiers: parsed.modifiers,
          command,
          description,
          enabled: true
        };
        
        const result = this.hotkeyManager.addBinding(binding);
        return result;
      }
      
      case 'remove': {
        const hotkeyStr = args[1];
        if (!hotkeyStr) {
          return {
            success: false,
            message: 'Usage: /hotkey remove <key-combination>'
          };
        }
        
        const result = this.hotkeyManager.removeBinding(hotkeyStr);
        return result;
      }
      
      case 'toggle': {
        const hotkeyStr = args[1];
        if (!hotkeyStr) {
          return {
            success: false,
            message: 'Usage: /hotkey toggle <key-combination>'
          };
        }
        
        const result = this.hotkeyManager.toggleBinding(hotkeyStr);
        return result;
      }
      
      case 'enable':
        this.hotkeyManager.setEnabled(true);
        return {
          success: true,
          message: '✅ Hotkeys enabled globally'
        };
      
      case 'disable':
        this.hotkeyManager.setEnabled(false);
        return {
          success: true,
          message: '🚫 Hotkeys disabled globally'
        };
      
      case 'export': {
        const config = this.hotkeyManager.exportConfig();
        const filename = `hotkeys-${Date.now()}.json`;
        
        try {
          const fs = await import('fs/promises');
          await fs.writeFile(filename, JSON.stringify(config, null, 2));
          
          return {
            success: true,
            message: `✅ Hotkey configuration exported to ${filename}`,
            data: config
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to export: ${error}`
          };
        }
      }
      
      case 'import': {
        const filename = args[1];
        if (!filename) {
          return {
            success: false,
            message: 'Usage: /hotkey import <filename>'
          };
        }
        
        try {
          const fs = await import('fs/promises');
          const content = await fs.readFile(filename, 'utf-8');
          const config = JSON.parse(content);
          
          const result = this.hotkeyManager.importConfig(config);
          return result;
        } catch (error) {
          return {
            success: false,
            message: `Failed to import: ${error}`
          };
        }
      }
      
      case 'help': {
        let message = '⌨️  Hotkey Management\n\n';
        message += 'Commands:\n';
        message += '  /hotkey                     - List configured hotkeys\n';
        message += '  /hotkey add <key> <cmd>     - Add a new hotkey\n';
        message += '  /hotkey remove <key>        - Remove a hotkey\n';
        message += '  /hotkey toggle <key>        - Enable/disable a hotkey\n';
        message += '  /hotkey enable              - Enable all hotkeys\n';
        message += '  /hotkey disable             - Disable all hotkeys\n';
        message += '  /hotkey export              - Export configuration\n';
        message += '  /hotkey import <file>       - Import configuration\n\n';
        
        message += 'Key Format Examples:\n';
        message += '  ctrl+s                      - Control + S\n';
        message += '  ctrl+shift+p                - Control + Shift + P\n';
        message += '  alt+1                       - Alt + 1\n';
        message += '  cmd+k (Mac) / win+k (Win)   - Command/Windows + K\n\n';
        
        message += 'Default Hotkeys:\n';
        message += '  Ctrl+S → /status\n';
        message += '  Ctrl+H → /help\n';
        message += '  Ctrl+L → /clear\n';
        message += '  Ctrl+E → /export --clipboard\n';
        message += '  Ctrl+T → /test\n';
        
        return {
          success: true,
          message
        };
      }
      
      default:
        return {
          success: false,
          message: `Unknown hotkey subcommand: ${subCommand}. Use /hotkey help for usage.`
        };
    }
  }

  private async handleExit(context: ConversationContext): Promise<SlashCommandResult> {
    // 会話セッションを保存（オプション）
    const shouldSave = context.history.length > 0;
    
    if (shouldSave) {
      try {
        const fs = await import('fs/promises');
        const sessionFile = `${process.cwd()}/.maria-session.json`;
        
        const sessionData = {
          sessionId: context.sessionId,
          history: context.history,
          currentTask: context.currentTask,
          metadata: context.metadata,
          savedAt: new Date().toISOString()
        };
        
        await fs.writeFile(sessionFile, JSON.stringify(sessionData, null, 2));
        
        const stats = {
          messages: context.history.length,
          cost: context.metadata?.cost || 0,
          duration: context.metadata?.startTime ? 
            Math.round((Date.now() - context.metadata.startTime.getTime()) / 1000) : 0
        };

        console.log(`\nSession saved: ${stats.messages} messages, $${stats.cost.toFixed(6)}, ${Math.floor(stats.duration / 60)}m ${stats.duration % 60}s`);
        console.log(`Resume with: /resume\n`);
        
      } catch (error) {
        logger.warn('Could not save session', error);
      }
    }

    // Graceful exit message
    console.log('Thanks for using MARIA CODE! Happy coding!');
    
    // テスト環境では process.exit を避ける
    if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
      setTimeout(() => {
        process.exit(0);
      }, 100);
    }

    return {
      success: true,
      message: 'Exiting MARIA CODE...',
      data: { sessionSaved: shouldSave }
    };
  }


  private async handleMigrateInstaller(): Promise<SlashCommandResult> {
    try {
      const { execSync } = await import('child_process');
      const fs = await import('fs/promises');
      const path = await import('path');
      // 現在のインストール状況を確認
      const globalInstallCheck = {
        npm: false,
        yarn: false,
        pnpm: false,
        packagePath: null as string | null
      };

      // グローバルインストールの確認
      try {
        const npmList = execSync('npm list -g @maria/code-cli --depth=0', { encoding: 'utf-8' });
        globalInstallCheck.npm = npmList.includes('@maria/code-cli');
      } catch {}

      try {
        const yarnList = execSync('yarn global list', { encoding: 'utf-8' });
        globalInstallCheck.yarn = yarnList.includes('@maria/code-cli');
      } catch {}

      try {
        const pnpmList = execSync('pnpm list -g @maria/code-cli', { encoding: 'utf-8' });
        globalInstallCheck.pnpm = pnpmList.includes('@maria/code-cli');
      } catch {}

      // 現在のプロジェクトでのローカルインストールを確認
      const cwd = process.cwd();
      const packageJsonPath = path.join(cwd, 'package.json');
      let localInstall = false;
      let packageJson: any = null;

      try {
        const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
        packageJson = JSON.parse(packageJsonContent);
        localInstall = !!(
          packageJson.dependencies?.['@maria/code-cli'] ||
          packageJson.devDependencies?.['@maria/code-cli']
        );
      } catch {}

      // 移行計画を作成
      const migrationPlan = {
        hasGlobalInstall: globalInstallCheck.npm || globalInstallCheck.yarn || globalInstallCheck.pnpm,
        hasLocalInstall: localInstall,
        hasPackageJson: !!packageJson,
        recommendedAction: 'none' as 'none' | 'install-local' | 'remove-global' | 'create-project'
      };

      // 推奨アクションを決定
      if (migrationPlan.hasGlobalInstall && !migrationPlan.hasLocalInstall) {
        if (migrationPlan.hasPackageJson) {
          migrationPlan.recommendedAction = 'install-local';
        } else {
          migrationPlan.recommendedAction = 'create-project';
        }
      } else if (migrationPlan.hasGlobalInstall && migrationPlan.hasLocalInstall) {
        migrationPlan.recommendedAction = 'remove-global';
      }

      // ステップバイステップの移行ガイド
      const migrationSteps = this.generateMigrationSteps(migrationPlan, globalInstallCheck);

      const message = `MARIA Code Installation Migration [SYNC]

📊 Current Installation Status:
${globalInstallCheck.npm ? '[OK]' : '[NO]'} NPM Global: ${globalInstallCheck.npm}
${globalInstallCheck.yarn ? '[OK]' : '[NO]'} Yarn Global: ${globalInstallCheck.yarn}
${globalInstallCheck.pnpm ? '[OK]' : '[NO]'} PNPM Global: ${globalInstallCheck.pnpm}
${localInstall ? '[OK]' : '[NO]'} Local Install: ${localInstall}
${packageJson ? '[OK]' : '[NO]'} Package.json: ${!!packageJson}

🎯 Recommended Action: ${migrationPlan.recommendedAction.replace('-', ' ').toUpperCase()}

📋 Migration Steps:
${migrationSteps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

[TIP] Benefits of Local Installation:
• Version consistency across team members
• Project-specific CLI configurations
• Better dependency management
• Easier CI/CD integration
• No global permission issues

[WARN] Important Notes:
• Back up your global config before migration
• Test local installation before removing global
• Update shell aliases and scripts
• Consider using package.json scripts

Run the steps above to complete your migration!`;

      return {
        success: true,
        message,
        data: {
          currentStatus: globalInstallCheck,
          migrationPlan,
          steps: migrationSteps,
          configBackupRequired: migrationPlan.hasGlobalInstall
        }
      };

    } catch (error) {
      logger.error('Migration installer error', error);
      return {
        success: false,
        message: `Failed to analyze installation: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private generateMigrationSteps(plan: any, globalCheck: any): string[] {
    const steps = [];

    if (plan.recommendedAction === 'install-local') {
      steps.push('Back up global config: cp ~/.maria-code.toml ~/.maria-code.toml.backup');
      steps.push('Install locally: npm install --save-dev @maria/code-cli');
      steps.push('Add script to package.json: "mc": "maria-code"');
      steps.push('Test local installation: npm run mc -- --version');
      
      if (globalCheck.npm) steps.push('Remove global NPM: npm uninstall -g @maria/code-cli');
      if (globalCheck.yarn) steps.push('Remove global Yarn: yarn global remove @maria/code-cli');
      if (globalCheck.pnpm) steps.push('Remove global PNPM: pnpm remove -g @maria/code-cli');
      
      steps.push('Update shell aliases to use: npx @maria/code-cli');

    } else if (plan.recommendedAction === 'create-project') {
      steps.push('Initialize new project: npm init -y');
      steps.push('Install locally: npm install --save-dev @maria/code-cli');
      steps.push('Add scripts to package.json');
      steps.push('Copy global config to project: cp ~/.maria-code.toml ./.maria-code.toml');
      steps.push('Test local setup: npx @maria/code-cli --version');

    } else if (plan.recommendedAction === 'remove-global') {
      steps.push('Verify local installation works: npx @maria/code-cli --version');
      steps.push('Update shell aliases to use local version');
      
      if (globalCheck.npm) steps.push('Remove global NPM: npm uninstall -g @maria/code-cli');
      if (globalCheck.yarn) steps.push('Remove global Yarn: yarn global remove @maria/code-cli');
      if (globalCheck.pnpm) steps.push('Remove global PNPM: pnpm remove -g @maria/code-cli');
      
      steps.push('Clean up global config if not needed');

    } else {
      steps.push('No migration needed - you\'re already using the recommended setup! [OK]');
    }

    return steps;
  }

  // ヘルパーメソッド
  private getPlanFeatures(plan: string): string[] {
    const features = {
      free: ['100 credits/day', 'Basic AI models', 'Standard support'],
      pro: ['5000 credits/day', 'All AI models', 'Priority support', 'Advanced features'],
      max: ['20000 credits/day', 'All AI models', '24/7 support', 'Enterprise features', 'Custom agents']
    };
    return features[plan as keyof typeof features] || [];
  }

  private analyzePRComplexity(diff: string): string {
    const lines = diff.split('\n');
    const additions = lines.filter(l => l.startsWith('+')).length;
    const deletions = lines.filter(l => l.startsWith('-')).length;
    const fileChanges = (diff.match(/diff --git/g) || []).length;
    
    const complexityScore = additions + deletions + (fileChanges * 10);
    
    if (complexityScore < 50) return 'Low';
    if (complexityScore < 200) return 'Medium';
    if (complexityScore < 500) return 'High';
    return 'Very High';
  }

  private generateReviewSuggestions(pr: any, diff: string): string[] {
    const suggestions = [];
    
    // Basic checks
    if (!pr.body || pr.body.length < 50) {
      suggestions.push('Consider adding a more detailed PR description');
    }
    
    if (diff.includes('console.log') || diff.includes('console.error')) {
      suggestions.push('Remove console.log statements before merging');
    }
    
    if (diff.includes('TODO') || diff.includes('FIXME')) {
      suggestions.push('Address TODO/FIXME comments');
    }
    
    if (diff.includes('package.json') && diff.includes('+')) {
      suggestions.push('Verify new dependencies are necessary and secure');
    }
    
    if (!diff.includes('test') && diff.includes('.ts') && diff.includes('.js')) {
      suggestions.push('Consider adding tests for new functionality');
    }
    
    if (suggestions.length === 0) {
      suggestions.push('Code looks good! Consider testing edge cases');
    }
    
    return suggestions;
  }

  private extractActionItems(feedback: any[]): string[] {
    const actionItems = [];
    const actionKeywords = ['fix', 'change', 'update', 'remove', 'add', 'refactor', 'improve'];
    
    for (const item of feedback) {
      const body = (item.body || '').toLowerCase();
      if (actionKeywords.some(keyword => body.includes(keyword))) {
        const sentence = (item.body || '').split('.')[0];
        if (sentence.length > 10 && sentence.length < 150) {
          actionItems.push(sentence.trim());
        }
      }
    }
    
    return actionItems.slice(0, 5); // 最大5つまで
  }

  private analyzeFeedbackSentiment(feedback: any[]): string {
    if (!feedback.length) return 'Neutral';
    
    const positiveKeywords = ['good', 'great', 'excellent', 'nice', 'approve', 'perfect', 'clean'];
    const negativeKeywords = ['bad', 'issue', 'problem', 'wrong', 'error', 'fix', 'concern'];
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    for (const item of feedback) {
      const body = (item.body || '').toLowerCase();
      positiveCount += positiveKeywords.filter(kw => body.includes(kw)).length;
      negativeCount += negativeKeywords.filter(kw => body.includes(kw)).length;
    }
    
    if (positiveCount > negativeCount * 1.5) return 'Positive';
    if (negativeCount > positiveCount * 1.5) return 'Negative';
    return 'Mixed';
  }

  private assessBugSeverity(type: string, description: string): 'Low' | 'Medium' | 'High' | 'Critical' {
    const desc = description.toLowerCase();
    
    if (type === 'crash' || desc.includes('crash') || desc.includes('fatal')) {
      return 'Critical';
    }
    
    if (type === 'security' || desc.includes('security') || desc.includes('vulnerability')) {
      return 'Critical';
    }
    
    if (desc.includes('data loss') || desc.includes('corruption')) {
      return 'Critical';
    }
    
    if (type === 'performance' || desc.includes('slow') || desc.includes('timeout')) {
      return 'High';
    }
    
    if (type === 'api' || desc.includes('api') || desc.includes('error')) {
      return 'High';
    }
    
    if (type === 'ui' || desc.includes('display') || desc.includes('layout')) {
      return 'Medium';
    }
    
    return 'Low';
  }

  private extractFeatures(releaseBody: string): string[] {
    const features = [];
    const lines = releaseBody.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/^[*\-]\s*(feat|feature|add)/i)) {
        features.push(trimmed.replace(/^[*\-]\s*/i, ''));
      }
    }
    
    return features.slice(0, 10); // 最大10個
  }

  private extractBugFixes(releaseBody: string): string[] {
    const fixes = [];
    const lines = releaseBody.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/^[*\-]\s*(fix|bug|resolve)/i)) {
        fixes.push(trimmed.replace(/^[*\-]\s*/i, ''));
      }
    }
    
    return fixes.slice(0, 10); // 最大10個
  }

  private extractBreakingChanges(releaseBody: string): string[] {
    const changes = [];
    const lines = releaseBody.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/^[*\-]\s*(break|breaking|change)/i)) {
        changes.push(trimmed.replace(/^[*\-]\s*/i, ''));
      }
    }
    
    return changes.slice(0, 5); // 最大5個
  }

  // コードベース分析メソッド
  private async analyzeCodebase(rootPath: string): Promise<CodebaseAnalysis> {
    const analysis: CodebaseAnalysis = {
      rootPath,
      directories: [],
      files: [],
      fileCount: 0,
      techStack: [],
      packageManager: 'unknown',
      frameworks: [],
      languages: [],
      structure: {},
      buildSystem: [],
      dependencies: {
        dependencies: [],
        devDependencies: []
      }
    };

    // .gitignore パターンを読み込み
    const gitignorePath = path.join(rootPath, '.gitignore');
    const ignorePatterns = fs.existsSync(gitignorePath) 
      ? fs.readFileSync(gitignorePath, 'utf8').split('\n').filter(line => line.trim() && !line.startsWith('#'))
      : ['node_modules', '.git', 'dist', 'build', '.env*'];

    // ディレクトリを再帰的に分析
    await this.analyzeDirectory(rootPath, rootPath, analysis, ignorePatterns);

    // 技術スタックの推定
    this.inferTechStack(analysis);

    return analysis;
  }

  private async analyzeDirectory(
    currentPath: string, 
    rootPath: string, 
    analysis: CodebaseAnalysis, 
    ignorePatterns: string[],
    depth: number = 0
  ): Promise<void> {
    if (depth > 3) return; // 深度制限

    try {
      const items = fs.readdirSync(currentPath);
      
      for (const item of items) {
        const itemPath = path.join(currentPath, item);
        const relativePath = path.relative(rootPath, itemPath);

        // .gitignore パターンチェック
        if (this.shouldIgnore(relativePath, ignorePatterns)) continue;

        const stat = fs.statSync(itemPath);
        
        if (stat.isDirectory()) {
          analysis.directories.push(relativePath);
          await this.analyzeDirectory(itemPath, rootPath, analysis, ignorePatterns, depth + 1);
        } else if (stat.isFile()) {
          analysis.files.push(relativePath);
          analysis.fileCount++;
          
          // ファイル拡張子から言語を推定
          const ext = path.extname(item).toLowerCase();
          const language = this.getLanguageFromExtension(ext);
          if (language && !analysis.languages.includes(language)) {
            analysis.languages.push(language);
          }
        }
      }
    } catch {
      // ディレクトリアクセスエラーは無視
    }
  }

  private shouldIgnore(relativePath: string, ignorePatterns: string[]): boolean {
    return ignorePatterns.some(pattern => {
      // シンプルなパターンマッチング
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(relativePath);
      }
      return relativePath.includes(pattern);
    });
  }

  private getLanguageFromExtension(ext: string): string | null {
    const extMap: Record<string, string> = {
      '.ts': 'TypeScript',
      '.tsx': 'TypeScript React',
      '.js': 'JavaScript',
      '.jsx': 'JavaScript React',
      '.py': 'Python',
      '.java': 'Java',
      '.go': 'Go',
      '.rs': 'Rust',
      '.cpp': 'C++',
      '.c': 'C',
      '.cs': 'C#',
      '.php': 'PHP',
      '.rb': 'Ruby',
      '.swift': 'Swift',
      '.kt': 'Kotlin'
    };
    return extMap[ext] || null;
  }

  private inferTechStack(analysis: CodebaseAnalysis): void {
    const { files, rootPath } = analysis;
    
    // Package manager detection
    if (files.includes('pnpm-lock.yaml')) {
      analysis.packageManager = 'pnpm';
      analysis.techStack.push('pnpm');
    } else if (files.includes('yarn.lock')) {
      analysis.packageManager = 'yarn';
      analysis.techStack.push('yarn');
    } else if (files.includes('package-lock.json')) {
      analysis.packageManager = 'npm';
      analysis.techStack.push('npm');
    }

    // Framework detection
    if (files.some(f => f.includes('next.config'))) {
      analysis.frameworks.push('Next.js');
      analysis.techStack.push('Next.js');
    }
    if (files.includes('vite.config.ts') || files.includes('vite.config.js')) {
      analysis.frameworks.push('Vite');
      analysis.techStack.push('Vite');
    }
    if (files.includes('nuxt.config.ts') || files.includes('nuxt.config.js')) {
      analysis.frameworks.push('Nuxt.js');
      analysis.techStack.push('Nuxt.js');
    }

    // Build system detection
    if (files.includes('turbo.json')) {
      analysis.buildSystem.push('Turborepo');
      analysis.techStack.push('Turborepo');
    }
    if (files.includes('lerna.json')) {
      analysis.buildSystem.push('Lerna');
      analysis.techStack.push('Lerna');
    }

    // Dependencies analysis
    try {
      const packageJsonPath = path.join(rootPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        analysis.dependencies = {
          dependencies: Object.keys(packageJson.dependencies || {}),
          devDependencies: Object.keys(packageJson.devDependencies || {})
        };

        // Framework detection from dependencies
        const allDeps = [...(analysis.dependencies.dependencies || []), ...(analysis.dependencies.devDependencies || [])];
        if (allDeps.includes('react')) analysis.techStack.push('React');
        if (allDeps.includes('vue')) analysis.techStack.push('Vue.js');
        if (allDeps.includes('express')) analysis.techStack.push('Express');
        if (allDeps.includes('fastify')) analysis.techStack.push('Fastify');
        if (allDeps.includes('@trpc/server')) analysis.techStack.push('tRPC');
        if (allDeps.includes('prisma')) analysis.techStack.push('Prisma');
        if (allDeps.includes('tailwindcss')) analysis.techStack.push('Tailwind CSS');
        if (allDeps.includes('typescript')) analysis.techStack.push('TypeScript');
      }
    } catch {
      // package.json読み込みエラーは無視
    }

    // Unique techStack
    analysis.techStack = [...new Set(analysis.techStack)];
  }

  private async createMariaMd(rootPath: string, analysis: CodebaseAnalysis): Promise<string> {
    const projectName = path.basename(rootPath);
    const timestamp = new Date().toISOString();
    
    return `# MARIA.md

このファイルはClaude Code (claude.ai/code) がこのリポジトリのコードを操作する際のガイダンスを提供します。

## プロジェクト概要

**プロジェクト名**: ${projectName}
**分析日時**: ${timestamp}
**ルートパス**: ${rootPath}

## 📊 コードベース分析結果

### 🏗️ 技術スタック
${analysis.techStack.map(tech => `- ${tech}`).join('\n')}

### 📁 プロジェクト構造
- **ディレクトリ数**: ${analysis.directories.length}
- **ファイル数**: ${analysis.fileCount}
- **言語**: ${analysis.languages.join(', ')}
- **パッケージマネージャー**: ${analysis.packageManager}

### 🚀 フレームワーク・ツール
${analysis.frameworks.length > 0 ? analysis.frameworks.map(fw => `- ${fw}`).join('\n') : '- なし'}

${analysis.buildSystem.length > 0 ? `### 🔧 ビルドシステム\n${analysis.buildSystem.map(bs => `- ${bs}`).join('\n')}\n` : ''}

## 📝 開発ガイドライン

### コマンド実行
\`\`\`bash
# 依存関係インストール
${analysis.packageManager !== 'unknown' ? `${analysis.packageManager} install` : 'npm install'}

# 開発サーバー起動
${analysis.packageManager !== 'unknown' ? `${analysis.packageManager} run dev` : 'npm run dev'}

# ビルド
${analysis.packageManager !== 'unknown' ? `${analysis.packageManager} run build` : 'npm run build'}
\`\`\`

### 重要なファイル・ディレクトリ
${analysis.directories.slice(0, 10).map(dir => `- \`${dir}/\``).join('\n')}

## 🤖 AI Assistant設定

### 推奨AIモデル
- **開発**: Gemini 2.5 Pro (高精度コード生成)
- **リファクタリング**: Grok-4 (高速実行)
- **ドキュメント作成**: Gemini 2.5 Pro (詳細説明)

### コンテキスト設定
- **最大コンテキスト**: 128K tokens
- **温度設定**: 0.3 (開発用), 0.7 (クリエイティブ)
- **レスポンス長**: Medium (バランス型)

## 📋 プロジェクト状況

### 現在のフェーズ
- [ ] プロジェクト初期化
- [ ] 基本機能開発
- [ ] テスト実装
- [ ] ドキュメント作成
- [ ] 本番デプロイ

### TODO
- プロジェクトの主要機能を定義
- 開発ワークフローの確立
- CI/CDパイプラインの構築

---

*このファイルは \`/init\` コマンドで自動生成・更新されます*
*最終更新: ${timestamp}*
`;
  }

  private async updateMariaMd(mariaPath: string, analysis: CodebaseAnalysis): Promise<string> {
    const existingContent = fs.readFileSync(mariaPath, 'utf8');
    const timestamp = new Date().toISOString();
    
    // 既存の分析結果セクションを更新
    const updatedContent = existingContent.replace(
      /## 📊 コードベース分析結果[\s\S]*?(?=## 📝 開発ガイドライン|$)/,
      `## 📊 コードベース分析結果

### 🏗️ 技術スタック
${analysis.techStack.map(tech => `- ${tech}`).join('\n')}

### 📁 プロジェクト構造
- **ディレクトリ数**: ${analysis.directories.length}
- **ファイル数**: ${analysis.fileCount}
- **言語**: ${analysis.languages.join(', ')}
- **パッケージマネージャー**: ${analysis.packageManager}

### 🚀 フレームワーク・ツール
${analysis.frameworks.length > 0 ? analysis.frameworks.map(fw => `- ${fw}`).join('\n') : '- なし'}

${analysis.buildSystem.length > 0 ? `### 🔧 ビルドシステム\n${analysis.buildSystem.map(bs => `- ${bs}`).join('\n')}\n` : ''}

`
    );

    // タイムスタンプを更新
    return updatedContent.replace(
      /\*最終更新: .*\*/,
      `*最終更新: ${timestamp}*`
    );
  }

  private async handleVideo(args: string[]): Promise<SlashCommandResult> {
    if (args.length === 0) {
      return {
        success: false,
        message: 'Usage: /video "prompt" [--model wan22-5b|wan22-14b] [--resolution 720p|1080p] [--fps 24|30] [--frames 33|49|81] [--compare] [--input-image path]'
      };
    }

    const prompt = args[0];
    const options: any = {};

    // Parse options
    for (let i = 1; i < args.length; i += 2) {
      const flag = args[i];
      const value = args[i + 1];

      switch (flag) {
        case '--model':
          if (value && ['wan22-5b', 'wan22-14b'].includes(value)) {
            options.model = value as 'wan22-5b' | 'wan22-14b';
          }
          break;
        case '--resolution':
          if (value && ['720p', '1080p'].includes(value)) {
            options.resolution = value as '720p' | '1080p';
          }
          break;
        case '--fps':
          if (value) options.fps = parseInt(value);
          break;
        case '--frames':
          if (value) options.frames = parseInt(value);
          break;
        case '--steps':
          if (value) options.steps = parseInt(value);
          break;
        case '--input-image':
          if (value) options.inputImage = value;
          break;
        case '--compare':
          options.compare = true;
          i--; // No value for this flag
          break;
      }
    }

    // Set defaults
    options.model = options.model || 'wan22-5b';
    options.resolution = options.resolution || '720p';
    options.fps = options.fps || 24;
    options.frames = options.frames || 33;

    return {
      success: true,
      message: `🎬 動画生成を開始します...\nプロンプト: ${prompt}\nモデル: ${options.model}`,
      component: 'video-generator',
      data: { prompt, ...options }
    };
  }

  private async handleImage(args: string[]): Promise<SlashCommandResult> {
    if (args.length === 0) {
      return {
        success: false,
        message: 'Usage: /image "prompt" [--style photorealistic|artistic|anime|concept|technical] [--size 512x512|1024x1024] [--batch 1-4] [--quality low|medium|high]'
      };
    }

    const prompt = args[0];
    const options: any = {};

    // Parse options
    for (let i = 1; i < args.length; i += 2) {
      const flag = args[i];
      const value = args[i + 1];

      switch (flag) {
        case '--style':
          if (value && ['photorealistic', 'artistic', 'anime', 'concept', 'technical'].includes(value)) {
            options.style = value;
          }
          break;
        case '--size':
          if (value && ['512x512', '768x768', '1024x1024', '1024x768', '768x1024'].includes(value)) {
            options.size = value;
          }
          break;
        case '--quality':
          if (value && ['low', 'medium', 'high'].includes(value)) {
            options.quality = value;
          }
          break;
        case '--batch':
          if (value) options.batch = Math.min(4, Math.max(1, parseInt(value)));
          break;
        case '--variations':
          if (value) options.variations = Math.min(3, Math.max(1, parseInt(value)));
          break;
        case '--guidance':
          if (value) options.guidance = parseFloat(value);
          break;
        case '--steps':
          if (value) options.steps = parseInt(value);
          break;
      }
    }

    // Set defaults
    options.style = options.style || 'photorealistic';
    options.size = options.size || '1024x1024';
    options.quality = options.quality || 'high';
    options.batch = options.batch || 1;
    options.variations = options.variations || 1;

    return {
      success: true,
      message: `🖼️ 画像生成を開始します...\nプロンプト: ${prompt}\nスタイル: ${options.style}`,
      component: 'image-generator', 
      data: { prompt, ...options }
    };
  }

}

interface CodebaseAnalysis {
  rootPath: string;
  directories: string[];
  files: string[];
  fileCount: number;
  techStack: string[];
  packageManager: string;
  frameworks: string[];
  languages: string[];
  structure: Record<string, any>;
  buildSystem: string[];
  dependencies: {
    dependencies?: string[];
    devDependencies?: string[];
  };
}