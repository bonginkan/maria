/**
 * MARIA CLI — Clean, streaming-friendly, generic Q&A & code generation
 * - Pipe/TTY 自動対応
 * - /help /clear /code の最小 Slash コマンド内蔵
 * - 依存が無い場合でも安全にフォールバック
 */
import { Command } from "commander";
import chalk from "chalk";
import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { loadEnvironmentVariables } from "./utils/env-loader";
import { getVersion } from "./utils/version";
import { ThinkingAnimation, ProcessAnimation } from "./utils/animations";
import { authManager, AUTH_EXEMPT_COMMANDS } from "./services/cli-auth";

// Core services - with safe dynamic imports
let AIResponseService: any;
let ChatContextService: any;
let ConversationPersistence: any;
let InteractiveCLI: any;

// Service instances
let ai: any;
let ctx: any;
let store: any;
const session: any[] = [];
let commandManager: any = null; // Command system for /model etc.
let startupDisplayed = false; // Prevent duplicate startup display

/**
 * Safely load services with fallbacks
 */
async function loadServices(): Promise<void> {
  try {
    // Try loading AI Response Service
    const aiModule = await import("./services/ai-response.service.js").catch(() => null);
    AIResponseService = aiModule?.AIResponseService;
    
    // Try loading Chat Context
    const ctxModule = await import("./services/chat-context.service.js").catch(() => null);
    ChatContextService = ctxModule?.ChatContextService;
    
    // Try loading Conversation Persistence
    const storeModule = await import("./services/conversation-persistence.js").catch(() => null);
    ConversationPersistence = storeModule?.ConversationPersistence;
    
    // Try loading Interactive CLI
    const cliModule = await import("./services/interactive-cli.js").catch(() => null);
    InteractiveCLI = cliModule?.InteractiveCLI;
    
    // Try loading SlashCommandManager for /model and other commands
    const cmdModule = await import("./slash-commands/SlashCommandManager.js").catch(() => null);
    if (cmdModule?.SlashCommandManager) {
      commandManager = new cmdModule.SlashCommandManager();
      
      // Set up legacy handler that directly executes commands
      const legacyHandlerAdapter = {
        handleCommand: async (command: string, args: string[], context: any) => {
          try {
            // Remove leading slash if present
            const commandName = command.startsWith('/') ? command.slice(1) : command;
            
            // Check if battlecard command on Free plan
            if (commandName === 'battlecard') {
              console.log(chalk.yellow('🔒 /battlecard is not available on Free plan'));
              console.log(chalk.gray('  Join the waitlist for business features: https://maria-code.ai/waitlist'));
              return {
                success: false,
                message: 'Command not available on Free plan'
              };
            }
            
            // Map of legacy commands to their implementations
            const legacyCommands: Record<string, string> = {
              // 'battlecard': './slash-commands/categories/business/battlecard.command.js', // Disabled for Free plan
              'sales-dashboard': './slash-commands/categories/business/sales-dashboard.command.js',
              'tune': './slash-commands/categories/business/tune.command.js',
              'pilot-setup': './slash-commands/categories/business/pilot-setup.command.js',
            };
            
            const commandPath = legacyCommands[commandName];
            if (!commandPath) {
              return {
                success: false,
                message: `Command /${commandName} not found in legacy handler`,
                data: {},
              };
            }
            
            // Dynamically import and execute the command
            const module = await import(commandPath);
            const cmd = module.battlecardCommand || module.salesDashboardCommand || 
                       module.tuneCommand || module.pilotSetupCommand || 
                       module.default || module[commandName + 'Command'];
            
            if (!cmd || !cmd.execute) {
              return {
                success: false,
                message: `Command implementation not found for /${commandName}`,
                data: {},
              };
            }
            
            // Execute the command
            const result = await cmd.execute(args, context);
            
            // Handle different return types
            if (typeof result === 'string') {
              return {
                success: true,
                message: result,
                data: {},
              };
            } else if (result && typeof result === 'object') {
              return {
                success: result.success !== false,
                message: result.message || '',
                data: result.data || {},
              };
            } else {
              return {
                success: true,
                message: '',
                data: {},
              };
            }
          } catch (error) {
            return {
              success: false,
              message: error instanceof Error ? error.message : 'Unknown error',
              data: {},
            };
          }
        }
      };
      
      commandManager.setLegacyHandler(legacyHandlerAdapter);
    }
  } catch (e) {
    console.warn(chalk.yellow("⚠ Some services unavailable, using fallbacks"));
  }
}

/**
 * Initialize services with safe fallbacks
 */
async function init(): Promise<void> {
  loadEnvironmentVariables();
  await loadServices();
  
  // Initialize with fallbacks
  if (AIResponseService) {
    try {
      ai = new AIResponseService();
    } catch {
      ai = createFallbackAI();
    }
  } else {
    ai = createFallbackAI();
  }
  
  if (ChatContextService) {
    try {
      ctx = ChatContextService.getInstance();
    } catch {
      ctx = createFallbackContext();
    }
  } else {
    ctx = createFallbackContext();
  }
  
  if (ConversationPersistence) {
    try {
      store = new ConversationPersistence();
      const hist = await store.loadHistory();
      for (const m of hist) {
        if (ctx.addMessage) await ctx.addMessage({ role: m.role, content: m.content });
        session.push(m);
      }
    } catch {
      store = createFallbackStore();
    }
  } else {
    store = createFallbackStore();
  }
}

/**
 * Fallback AI service when real service unavailable
 */
function createFallbackAI() {
  return {
    generateResponse: async (opts: any) => {
      const input = opts?.userInput || "";
      return `I understand you're asking about: "${input}". 

Unfortunately, the AI service is unavailable. Please check your API keys and try again.`;
    },
    streamResponse: async (resp: string, cb: (line: string) => void) => {
      const lines = resp.split("\n");
      for (const line of lines) {
        cb(line);
        await new Promise(r => setTimeout(r, 50)); // Simulate streaming
      }
    }
  };
}

/**
 * Fallback context service
 */
function createFallbackContext() {
  return {
    messages: [],
    addMessage: async (msg: any) => { /* noop */ },
    clearContext: () => { /* noop */ }
  };
}

/**
 * Fallback persistence store
 */
function createFallbackStore() {
  return {
    loadHistory: async () => [],
    addMessage: async (msg: any) => { /* noop */ },
    close: async () => { /* noop */ }
  };
}

/**
 * Parse slash command input
 */
function parseSlash(input: string): { cmd: string; args: string[] } {
  const normalized = input.replace(/[\s\u3000]+/g, " ").trim();
  const parts = normalized.slice(1).split(" ");
  return { cmd: parts[0].toLowerCase(), args: parts.slice(1) };
}

/**
 * Check if command requires authentication
 */
function requiresAuth(cmd: string): boolean {
  const normalizedCommand = `/${cmd}`;
  return !AUTH_EXEMPT_COMMANDS.some(exempt =>
    normalizedCommand === exempt ||
    normalizedCommand.startsWith(exempt + ' ')
  );
}

/**
 * Enforce authentication for protected commands
 */
async function enforceAuth(cmd: string): Promise<boolean> {
  if (!requiresAuth(cmd)) {
    return true; // Command is exempt from authentication
  }

  try {
    const tokens = await authManager.getValidTokens();
    if (!tokens) {
      console.log(chalk.red('🔐 Authentication required · Run: maria /login'));
      process.exit(2);
      return false; // Never reached but satisfies linter
    }
    return true;
  } catch (error: any) {
    if (error.code === 'AUTH_REQUIRED') {
      console.log(chalk.red('🔐 Authentication required · Run: maria /login'));
      process.exit(2);
    } else if (error.code === 'REAUTH_REQUIRED') {
      console.log(chalk.yellow('🔄 Please re-authenticate · Run: maria /login'));
      process.exit(2);
    } else {
      console.log(chalk.red('🌐 Network error, check connection'));
      process.exit(1);
    }
    return false; // Never reached but satisfies linter
  }
}

/**
 * Handle slash commands with built-in implementations
 */
async function handleSlash(input: string): Promise<boolean> {
  if (!input.startsWith("/")) return false;
  const { cmd, args } = parseSlash(input);

  // 1) /help - delegate to dynamic HelpCommand
  if (cmd === "help" || cmd === "h" || cmd === "?") {
    try {
      const { HelpCommand } = await import("./slash-commands/categories/core/handlers/HelpCommand.js").catch(() => ({}));
      
      if (HelpCommand) {
        const helpCmd = new HelpCommand();
        const result = await helpCmd.execute(
          {
            raw: args,
            parsed: { _positional: args },
            options: {},
            flags: {}
          },
          { 
            session: { id: 'cli', commandHistory: [] },
            user: { id: 'cli-user' },
            environment: { cwd: process.cwd() }
          }
        );
        
        if (result.success) {
          console.log(result.message);
          if (result.data && process.env.MARIA_DEBUG === "1") {
            console.log(JSON.stringify(result.data, null, 2));
          }
        } else {
          console.log(chalk.red(`Help Error: ${result.message}`));
        }
        return true;
      }
    } catch (helpError) {
      if (process.env.MARIA_DEBUG === "1") {
        console.error("HelpCommand error:", helpError);
      }
      // Fall back to static help if dynamic help fails
      console.log(chalk.yellow("⚠ Dynamic help unavailable, using fallback"));
    }
    
    // Fallback static help (only if dynamic help fails)
    const help = `
📖 MARIA CLI Help

Core:
  /help        Show this help
  /clear       Clear conversation context
  /exit        Exit MARIA

Generation:
  /code <req>  Generate code (AI with template fallback)

Chat:
  Any other text is answered by the assistant (streaming)

💡 For READY commands list, ensure dynamic help is working
`;
    console.log(help.trim());
    return true;
  }

  // 2) /clear
  if (cmd === "clear") {
    session.length = 0;
    if (ctx?.clearContext) ctx.clearContext();
    console.clear();
    console.log(chalk.cyan("✨ Session cleared"));
    return true;
  }

  // 3) /code - requires authentication
  if (cmd === "code") {
    await enforceAuth(cmd);
    
    const prompt = args.join(" ").trim();
    if (!prompt) {
      console.log(
        chalk.red("Usage: /code <request>    e.g. /code build a REST API"),
      );
      return true;
    }
    await handleCodeCommand(prompt);
    return true;
  }

  // 4) /image - Image generation (requires authentication)
  if (cmd === "image") {
    await enforceAuth(cmd);
    
    const prompt = args.join(" ").trim();
    if (!prompt) {
      console.log(
        chalk.cyan("🎨 **Image Generation**\n") +
        chalk.white("Usage: /image <prompt>\n") +
        chalk.gray("Example: /image 富士山の日の出")
      );
      return true;
    }
    
    try {
      const { imageCommand } = await import("./slash-commands/categories/multimodal/ImageCommand.js").catch(() => ({}));
      if (imageCommand) {
        const context = {
          args: args,
          options: {},
          logger: {
            info: (msg: string) => console.log(msg),
            error: (msg: string) => console.error(chalk.red(msg)),
            warn: (msg: string) => console.warn(chalk.yellow(msg)),
          },
        };
        await imageCommand.execute(context);
      }
    } catch (error: any) {
      console.error(chalk.red("Image generation failed:"), error.message);
    }
    return true;
  }

  // 5) /video - Video generation (requires authentication)
  if (cmd === "video") {
    await enforceAuth(cmd);
    
    const prompt = args.join(" ").trim();
    if (!prompt) {
      console.log(
        chalk.cyan("🎬 **Video Generation**\n") +
        chalk.white("Usage: /video <prompt>\n") +
        chalk.gray("Example: /video 海の波が打ち寄せる様子")
      );
      return true;
    }
    
    try {
      const { videoCommand } = await import("./slash-commands/categories/multimodal/VideoCommand.js").catch(() => ({}));
      if (videoCommand) {
        const context = {
          args: args,
          options: {},
          logger: {
            info: (msg: string) => console.log(msg),
            error: (msg: string) => console.error(chalk.red(msg)),
            warn: (msg: string) => console.warn(chalk.yellow(msg)),
          },
        };
        await videoCommand.execute(context);
      }
    } catch (error: any) {
      console.error(chalk.red("Video generation failed:"), error.message);
    }
    return true;
  }

  // 6) /voice - Voice synthesis (requires authentication)
  if (cmd === "voice") {
    await enforceAuth(cmd);
    
    const prompt = args.join(" ").trim();
    if (!prompt) {
      console.log(
        chalk.cyan("🎙️ **Voice Synthesis**\n") +
        chalk.white("Usage: /voice <text>\n") +
        chalk.gray("Example: /voice こんにちは、元気ですか？")
      );
      return true;
    }
    
    try {
      const { voiceCommand } = await import("./slash-commands/categories/multimodal/VoiceCommand.js").catch(() => ({}));
      if (voiceCommand) {
        const context = {
          args: args,
          options: {},
          logger: {
            info: (msg: string) => console.log(msg),
            error: (msg: string) => console.error(chalk.red(msg)),
            warn: (msg: string) => console.warn(chalk.yellow(msg)),
          },
        };
        await voiceCommand.execute(context);
      }
    } catch (error: any) {
      console.error(chalk.red("Voice synthesis failed:"), error.message);
    }
    return true;
  }

  // 7) /login - Authentication (exempt from auth check)
  if (cmd === "login" || cmd === "signin" || cmd === "auth") {
    try {
      const { LoginCommand } = await import("./slash-commands/categories/auth/LoginCommand.js").catch(() => ({}));
      if (LoginCommand) {
        const loginCmd = new LoginCommand();
        const result = await loginCmd.execute();
        return true;
      } else {
        // Fallback to direct auth manager
        const options = {
          device: args.includes('--device'),
          force: args.includes('--force')
        };
        
        if (args.includes('status')) {
          // Show status
          if (await authManager.isAuthenticated()) {
            const user = await authManager.getCurrentUser();
            console.log(chalk.green('✅ Authenticated'));
            console.log(chalk.white(`👤 User: ${chalk.cyan(user.email)}`));
            console.log(chalk.white(`📊 Plan: ${chalk.cyan(user.plan)}`));
          } else {
            console.log(chalk.yellow('⚠️ Not authenticated'));
            console.log(chalk.gray('Use /login to sign in'));
          }
        } else {
          // Perform login
          const result = await authManager.login(options);
          if (result.success && result.user) {
            console.log(chalk.green('✅ Successfully logged in!'));
            console.log(chalk.white(`👤 User: ${chalk.cyan(result.user.email)}`));
            console.log(chalk.white(`📊 Plan: ${chalk.cyan(result.user.plan)}`));
          } else {
            console.log(chalk.red('❌ Login failed'));
            if (result.error) console.log(chalk.gray(result.error));
          }
        }
      }
    } catch (error: any) {
      console.error(chalk.red("Login error:"), error.message);
    }
    return true;
  }
  
  // 8) /logout - Sign out (exempt from auth check)
  if (cmd === "logout" || cmd === "signout") {
    try {
      await authManager.logout();
      console.log(chalk.green('👋 Signed out. Local credentials removed.'));
    } catch (error: any) {
      console.error(chalk.red("Logout error:"), error.message);
    }
    return true;
  }

  // 9) /exit
  if (cmd === "exit" || cmd === "quit") {
    process.emit("SIGINT", "SIGINT");
    return true;
  }

  // Try to load and execute ModelCommand directly (requires authentication)
  if (cmd === "model" || cmd === "m") {
    await enforceAuth(cmd);
    
    try {
      // Dynamic import of ModelCommand
      const { ModelCommand } = await import("./slash-commands/categories/configuration/handlers/ModelCommand.js").catch(() => ({}));
      
      if (ModelCommand) {
        const modelCmd = new ModelCommand();
        const result = await modelCmd.execute(
          {
            raw: args.join(' '),
            parsed: {
              positional: args,
              named: {},
              flags: {}
            },
            options: {},
            flags: {}
          },
          { sessionId: 'cli', timestamp: new Date() }
        );
        
        if (result.message) {
          console.log(result.message);
        }
        if (result.data) {
          console.log(result.data);
        }
        return true;
      }
    } catch (modelError) {
      if (process.env.MARIA_DEBUG === "1") {
        console.error("ModelCommand error:", modelError);
      }
    }
  }

  // Try to load and execute ConfigCommand directly
  if (cmd === "config" || cmd === "cfg" || cmd === "settings" || cmd === "conf") {
    try {
      // Dynamic import of ConfigCommand
      const { ConfigCommand } = await import("./slash-commands/categories/configuration/handlers/ConfigCommand.js").catch(() => ({}));
      
      if (ConfigCommand) {
        const configCmd = new ConfigCommand();
        const result = await configCmd.execute(
          {
            raw: args.join(' '),
            parsed: {
              positional: args,
              named: {},
              flags: {}
            },
            options: {},
            flags: {}
          },
          { sessionId: 'cli', timestamp: new Date() }
        );
        
        if (result.message) {
          console.log(result.message);
        }
        if (result.data) {
          console.log(result.data);
        }
        return true;
      }
    } catch (configError) {
      if (process.env.MARIA_DEBUG === "1") {
        console.error("ConfigCommand error:", configError);
      }
    }
  }
  
  // Try SlashCommandManager if available
  if (commandManager) {
    try {
      const context = {
        sessionId: 'cli',
        timestamp: new Date(),
        user: null,
        history: session
      };
      
      const result = await commandManager.handleCommand(`/${cmd}`, args, context);
      
      if (result.success) {
        console.log(result.message);
        if (result.data) {
          console.log(JSON.stringify(result.data, null, 2));
        }
        return true;
      } else if (result.message && result.message.includes('not available on Free plan')) {
        // Already displayed the message, don't show "Unknown command"
        return true;
      }
    } catch (commandError) {
      if (process.env.MARIA_DEBUG === "1") {
        console.error("SlashCommandManager error:", commandError);
      }
      // Don't show "Unknown command" for known errors
      if (commandError && commandError.message && commandError.message.includes('battlecard')) {
        return true;
      }
    }
  }

  // Unknown command (only show if not a handled business command)
  if (!['battlecard', 'sales-dashboard', 'tune', 'pilot-setup'].includes(cmd)) {
    console.log(chalk.red(`Unknown command: /${cmd}. Try /help`));
  }
  return true;
}

/**
 * Detect if prompt is complex based on keywords and length
 */
function isComplexPrompt(prompt: string): boolean {
  const complexKeywords = [
    // Completeness indicators (English & Japanese)
    'full', 'complete', 'entire', 'whole', 'comprehensive', 'detailed',
    '完全', '全体', '包括', '詳細', '全て', 'すべて', 'フル', 'コンプリート',
    
    // Project types (English & Japanese)
    'application', 'app', 'system', 'platform', 'service', 'website',
    'game', 'dashboard', 'portal', 'tool', 'utility', 'plugin',
    'アプリ', 'アプリケーション', 'システム', 'プラットフォーム', 'サービス', 'ウェブサイト',
    'ゲーム', 'ダッシュボード', 'ポータル', 'ツール', 'プラグイン', 'ユーティリティ',
    
    // Feature indicators
    'with', 'including', 'features', 'multiple', 'complex', 'advanced',
    'integrate', 'integration', 'implement', 'implementation',
    '機能', '複数', '複雑', '高度', '統合', '連携', '実装',
    
    // Action words suggesting complexity (English & Japanese)
    'build', 'create', 'develop', 'construct', 'design', 'architect',
    'setup', 'configure', 'establish', 'deploy', 'scaffold',
    '作って', '作成', '構築', '開発', '実装', '設計', 'デザイン',
    'セットアップ', '設定', '配置', 'デプロイ', '展開', 'ビルド',
    
    // Stack/Tech keywords (English & Japanese)
    'api', 'rest', 'graphql', 'server', 'database', 'frontend', 'backend',
    'fullstack', 'full-stack', 'microservice', 'architecture',
    'react', 'nextjs', 'next.js', 'vue', 'angular', 'svelte',
    'express', 'django', 'flask', 'fastapi', 'rails', 'laravel',
    'mongodb', 'postgresql', 'mysql', 'redis', 'sqlite',
    'サーバー', 'データベース', 'フロントエンド', 'バックエンド',
    'フルスタック', 'マイクロサービス', 'アーキテクチャ',
    'リアクト', 'ネクスト', 'ビュー', 'アンギュラー',
    
    // Additional complexity indicators (English & Japanese)
    'authentication', 'authorization', 'security', 'payment',
    'realtime', 'real-time', 'websocket', 'streaming',
    'responsive', 'mobile', 'desktop', 'cross-platform',
    'testing', 'tests', 'documentation', 'deployment',
    'docker', 'kubernetes', 'ci/cd', 'pipeline',
    '認証', '認可', 'セキュリティ', '決済', '支払い',
    'リアルタイム', 'ウェブソケット', 'ストリーミング',
    'レスポンシブ', 'モバイル', 'デスクトップ', 'クロスプラットフォーム',
    'テスト', '試験', 'ドキュメント', '文書', 'デプロイメント',
    'ドッカー', '管理', 'パイプライン',
    
    // Game-specific Japanese terms
    'テトリス', 'インベーダー', 'ブロック崩し', 'パックマン', 'スネーク',
    'パズル', 'アクション', 'RPG', 'シューティング'
  ];
  
  const lower = prompt.toLowerCase();
  const hasComplexKeyword = complexKeywords.some(keyword => lower.includes(keyword));
  const isLongPrompt = prompt.length > 50;
  
  return hasComplexKeyword || isLongPrompt;
}

/**
 * Extract code language and content from markdown code block
 */
function extractCodeInfo(codeBlock: string): { language: string; code: string; extension: string } {
  const match = codeBlock.match(/```(\w+)?\n?([\s\S]*?)```/);
  if (!match) {
    return { language: 'text', code: codeBlock, extension: 'txt' };
  }
  
  const language = match[1] || 'text';
  const code = match[2] || '';
  
  // Map languages to file extensions
  const extensionMap: Record<string, string> = {
    javascript: 'js',
    typescript: 'ts',
    jsx: 'jsx',
    tsx: 'tsx',
    python: 'py',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    csharp: 'cs',
    php: 'php',
    ruby: 'rb',
    go: 'go',
    rust: 'rs',
    swift: 'swift',
    kotlin: 'kt',
    html: 'html',
    css: 'css',
    scss: 'scss',
    json: 'json',
    yaml: 'yaml',
    yml: 'yml',
    xml: 'xml',
    sql: 'sql',
    bash: 'sh',
    shell: 'sh',
    sh: 'sh',
    dockerfile: 'dockerfile',
    makefile: 'makefile',
    markdown: 'md',
    md: 'md',
    text: 'txt',
  };
  
  const extension = extensionMap[language.toLowerCase()] || 'txt';
  
  return { language, code, extension };
}

/**
 * Generate appropriate filename based on code content
 */
function generateCodeFilename(prompt: string, language: string, extension: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  
  // Try to extract a meaningful name from the prompt
  const promptLower = prompt.toLowerCase();
  let baseName = 'code';
  
  if (promptLower.includes('api')) baseName = 'api';
  else if (promptLower.includes('server')) baseName = 'server';
  else if (promptLower.includes('client')) baseName = 'client';
  else if (promptLower.includes('component')) baseName = 'component';
  else if (promptLower.includes('function')) baseName = 'function';
  else if (promptLower.includes('class')) baseName = 'class';
  else if (promptLower.includes('test')) baseName = 'test';
  else if (promptLower.includes('script')) baseName = 'script';
  else if (promptLower.includes('app')) baseName = 'app';
  else if (promptLower.includes('main')) baseName = 'main';
  else if (promptLower.includes('index')) baseName = 'index';
  else if (promptLower.includes('util')) baseName = 'utils';
  else if (promptLower.includes('helper')) baseName = 'helper';
  else if (promptLower.includes('service')) baseName = 'service';
  else if (promptLower.includes('model')) baseName = 'model';
  else if (promptLower.includes('controller')) baseName = 'controller';
  else if (promptLower.includes('route')) baseName = 'routes';
  else if (promptLower.includes('config')) baseName = 'config';
  
  return `${baseName}_${timestamp}.${extension}`;
}

/**
 * Handle /code command with strict mode and fallback
 */
async function handleCodeCommand(prompt: string): Promise<void> {
  // Import animation at the top of the function
  const { CodeGenerationAnimation } = await import("./utils/animations");
  
  // Detect complexity and use appropriate animation
  const isComplex = isComplexPrompt(prompt);
  
  // Start spinner animation
  const spinner = new CodeGenerationAnimation(isComplex);
  spinner.start();
  
  try {
    // Use strict code generation to bypass guided flow
    const response = await generateStrictCode(prompt);
    
    // Stop spinner before output
    spinner.stop();
    
    if (response) {
      // Display the code
      console.log(response);
      
      // Extract code info and save to file
      const { language, code, extension } = extractCodeInfo(response);
      const filename = generateCodeFilename(prompt, language, extension);
      const filepath = path.resolve(process.cwd(), filename);
      
      // Save the code to file
      await fs.writeFile(filepath, code, 'utf-8');
      
      // Display saved file info with clickable path
      console.log(
        chalk.green('\n✅ **Code Saved**\n') +
        chalk.white(`📁 **File (Click to open):**\n`) +
        chalk.cyan(`• [${filename}](file://${filepath})\n`) +
        chalk.gray(`  📍 Path: \`${filepath}\`\n`) +
        chalk.white(`  📝 Language: ${language}\n`) +
        chalk.dim(`\n💡 Tip: Command+Click (Mac) or Ctrl+Click (Windows/Linux) to open file`)
      );
    } else {
      throw new Error("Code generation failed");
    }
  } catch (e: any) {
    // Stop spinner on error
    spinner.stop();
    
    if (process.env.MARIA_DEBUG === "1") {
      console.error(chalk.red("Code generation error:"), e.message || e);
    }
    
    // Use template fallback
    const fallbackCode = templateFallback(prompt);
    console.log(
      chalk.yellow("⚠ AI unavailable, using template fallback:\n"),
    );
    console.log(fallbackCode);
    
    // Save fallback code too
    try {
      const { language, code, extension } = extractCodeInfo(fallbackCode);
      const filename = generateCodeFilename(prompt, language, extension);
      const filepath = path.resolve(process.cwd(), filename);
      
      await fs.writeFile(filepath, code, 'utf-8');
      
      console.log(
        chalk.green('\n✅ **Template Code Saved**\n') +
        chalk.white(`📁 **File (Click to open):**\n`) +
        chalk.cyan(`• [${filename}](file://${filepath})\n`) +
        chalk.gray(`  📍 Path: \`${filepath}\`\n`) +
        chalk.dim(`\n💡 Tip: Command+Click (Mac) or Ctrl+Click (Windows/Linux) to open file`)
      );
    } catch (saveError) {
      console.error(chalk.red("Failed to save code:"), saveError);
    }
  }
}

/**
 * Strict code generation mode - bypasses guided flow injection
 */
async function generateStrictCode(request: string): Promise<string | null> {
  // System prompt enforcing code-only output
  const systemPrompt = [
    "You are a senior software engineer.",
    "Respond with CODE ONLY inside a single fenced code block.",
    "Do NOT ask questions, do NOT show menus, do NOT list choices.",
    "Do NOT include any text before or after the code block.",
    "Start your response with ``` immediately."
  ].join("\n");
  
  const userPrompt = `Generate complete, working code for: ${request}\n\nRemember: CODE ONLY in a fenced block. No explanations.`;
  
  // STOP sequences to prevent guided flow
  const stopSequences = [
    "Choose your next step",
    "Reply with a number",
    "I see you want to continue",
    "Recent context:",
    "Next steps:",
    "---\n",
    "💡 Tip:",
    "💡 推奨:"
  ];
  
  try {
    // Try to use raw completion if available, otherwise use generateResponse with strict settings
    let response: string = "";
    
    if (ai?.generateResponse) {
      // Use minimal configuration to avoid middleware
      // Combine system prompt with user prompt for proper formatting
      const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
      
      response = await ai.generateResponse(
        {
          userInput: fullPrompt,
          sessionMemory: [], // Never pass history for code generation
          provider: process.env.MARIA_PROVIDER || "openai",
          model: process.env.MARIA_MODEL || "gpt-5-mini-2025-08-07",
        },
        { 
          streaming: false, // Disable streaming to validate output first
          temperature: 0.1, // Low temperature for consistent output
          contextLength: 2000,
        },
      );
    } else {
      return null;
    }
    
    // Validate response starts with code fence
    const trimmed = response.trim();
    if (!trimmed.startsWith("```")) {
      // Check for guided flow contamination
      const guidedFlowDetected = stopSequences.some(seq => 
        response.includes(seq)
      );
      
      if (guidedFlowDetected) {
        console.log(chalk.yellow("⚠ Guided flow detected, switching to fallback"));
        return null;
      }
      
      // Try to extract code if present
      const codeMatch = response.match(/```[\s\S]*?```/);
      if (codeMatch) {
        return codeMatch[0];
      }
      
      return null;
    }
    
    // Extract only the code block, remove any trailing content
    const codeBlockEnd = trimmed.indexOf("```", 3);
    if (codeBlockEnd > 0) {
      return trimmed.substring(0, codeBlockEnd + 3);
    }
    
    return trimmed;
  } catch (error: any) {
    if (process.env.MARIA_DEBUG === "1") {
      console.error("Strict code generation error:", error);
    }
    return null;
  }
}

/**
 * Template fallback for code generation
 */
function templateFallback(request: string): string {
  const r = request.toLowerCase();
  
  // React template
  if (r.includes("react") || r.includes("component")) {
    return `\`\`\`jsx
import React, { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <h1>Generated Component</h1>
      <p>Request: ${request}</p>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}
\`\`\``;
  }
  
  // API template
  if (r.includes("api") || r.includes("rest") || r.includes("server")) {
    return `\`\`\`javascript
const express = require('express');
const app = express();

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

// Example CRUD endpoints
app.get('/api/items', (req, res) => {
  res.json({ items: [] });
});

app.post('/api/items', (req, res) => {
  const { name } = req.body;
  res.status(201).json({ id: 1, name });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(\`Server running on http://localhost:\${PORT}\`);
});
\`\`\``;
  }
  
  // Python template
  if (r.includes("python") || r.includes("script")) {
    return `\`\`\`python
#!/usr/bin/env python3
"""Generated script for: ${request}"""

def process_data(input_data):
    """Process the input data"""
    # Implementation for: ${request}
    result = f"Processed: {input_data}"
    return result

def main():
    """Main entry point"""
    data = "sample input"
    result = process_data(data)
    print(result)

if __name__ == "__main__":
    main()
\`\`\``;
  }
  
  // Function template
  if (r.includes("function") || r.includes("util") || r.includes("helper")) {
    return `\`\`\`typescript
/**
 * Utility function for: ${request}
 */
export function processData<T>(input: T): T {
  // Implementation for: ${request}
  console.log('Processing:', input);
  
  // Transform the data
  const result = { ...input } as T;
  
  return result;
}

// Helper function
export function validateInput(input: unknown): boolean {
  return input !== null && input !== undefined;
}

// Example usage
if (require.main === module) {
  const testData = { name: '${request}', value: 42 };
  console.log(processData(testData));
}
\`\`\``;
  }
  
  // Generic TypeScript
  return `\`\`\`typescript
// Implementation for: ${request}
class Solution {
  private config: Record<string, any>;
  
  constructor() {
    this.config = {
      request: '${request}',
      timestamp: new Date().toISOString()
    };
  }
  
  execute(input: string): string {
    console.log('Executing:', this.config.request);
    console.log('Input:', input);
    
    // TODO: Add implementation for ${request}
    const result = \`Processed: \${input}\`;
    
    return result;
  }
}

// Usage
const solution = new Solution();
console.log(solution.execute('test'));
\`\`\``;
}

/**
 * Stream AI answer for general chat
 */
async function streamAnswer(text: string): Promise<void> {
  // Use ProcessAnimation for longer operations, ThinkingAnimation for short ones
  const isComplexQuery = text.length > 50 || text.includes("explain") || text.includes("history") || text.includes("detail");
  const animation = isComplexQuery ? new ProcessAnimation() : new ThinkingAnimation("Thinking");
  
  try {
    if (ai?.generateResponse) {
      // Start animation
      animation.start();
      
      const resp = await ai.generateResponse({
        userInput: text,
        sessionMemory: session,
        provider: process.env.MARIA_PROVIDER || "openai",
        model: process.env.MARIA_MODEL || "gpt-4o-mini",
      });
      
      // Stop animation before showing response
      animation.stop();
      
      if (ai.streamResponse) {
        await ai.streamResponse(resp, (line: string) => console.log(line));
      } else {
        console.log(resp);
      }
      
      // Save to session
      const msg = { role: "assistant", content: resp, timestamp: new Date() };
      session.push(msg);
      if (store?.addMessage) await store.addMessage(msg);
    } else {
      animation.stop();
      console.log(chalk.yellow("AI service unavailable. Please check your configuration."));
    }
  } catch (e: any) {
    animation.stop();
    
    // Check for timeout error
    if (e.message?.includes('timeout') || e.message?.includes('⏱️')) {
      console.log(chalk.yellow(e.message));
    } else {
      console.log(chalk.red("Error generating response:"), e.message || e);
    }
  }
}

/**
 * Handle a single line of input
 */
async function handleLine(line: string): Promise<void> {
  const input = line.trim();
  if (!input) return;
  
  // Exit commands
  if (input === "exit" || input === "quit") {
    process.emit("SIGINT", "SIGINT");
    return;
  }
  
  // Try slash command first
  const consumed = await handleSlash(input);
  if (consumed) return;

  // Generic chat
  const user = { role: "user", content: input, timestamp: new Date() };
  session.push(user);
  if (store?.addMessage) await store.addMessage(user);
  
  await streamAnswer(input);
}

/**
 * Main interactive session
 */
async function startInteractiveSession(): Promise<void> {
  await init();
  
  const isTTY = process.stdin.isTTY;
  
  let interactiveCLI: any = null;
  
  // Try to use enhanced CLI if available and TTY
  if (isTTY && InteractiveCLI) {
    try {
      interactiveCLI = new InteractiveCLI({
        maxSuggestions: 7,
        minQueryLength: 2,
      });
    } catch {
      // Fall back to regular readline
    }
  }
  
  // Graceful shutdown
  const stop = async () => {
    console.log(chalk.cyan("\n👋 Goodbye!"));
    if (store?.close) await store.close().catch(() => {});
    if (interactiveCLI?.cleanup) interactiveCLI.cleanup();
    process.stdout.write("\n");
    process.exit(0);
  };
  
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  
  // Pipe mode (non-TTY)
  if (!isTTY) {
    console.log(chalk.gray("[Pipe mode detected - streaming input/output]"));
    const rl = readline.createInterface({ 
      input: stdin, 
      output: stdout, 
      terminal: false 
    });
    
    for await (const line of rl) {
      await handleLine(line);
    }
    
    await stop();
    return;
  }
  
  // TTY mode - interactive with prompts
  console.log(chalk.gray("Type /help for commands, or just chat\n"));
  
  // Use enhanced CLI if available, otherwise basic readline
  if (interactiveCLI) {
    // Enhanced mode with autocomplete
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        // 90-character width input box
        console.log(chalk.white("╭─────────────────────────────────────────────────────────────────────────────────────────╮"));
        console.log(chalk.white("│                                                                                         │"));
        console.log(chalk.white("╰─────────────────────────────────────────────────────────────────────────────────────────╯"))
        
        const line = await interactiveCLI.question(chalk.cyan("> "));
        
        if (line.toLowerCase() === "exit" || line.toLowerCase() === "quit") {
          await stop();
          break;
        }
        
        await handleLine(line);
        console.log();
      } catch (error: any) {
        if (error?.code === "ABORT_ERR" || error?.name === "AbortError") {
          await stop();
          return;
        }
        console.error(chalk.red("Error:"), error?.message || error);
      }
    }
  } else {
    // Basic readline mode
    const rl = readline.createInterface({ input: stdin, output: stdout });
    
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        // 90-character width input box for basic mode
        console.log(chalk.white("╭─────────────────────────────────────────────────────────────────────────────────────────╮"));
        console.log(chalk.white("│                                                                                         │"));
        console.log(chalk.white("╰─────────────────────────────────────────────────────────────────────────────────────────╯"));
        
        const line = await rl.question(chalk.cyan("> "));
        
        if (line.toLowerCase() === "exit" || line.toLowerCase() === "quit") {
          await stop();
          break;
        }
        
        await handleLine(line);
        console.log();
      } catch (error: any) {
        if (error?.code === "ABORT_ERR") {
          await stop();
          return;
        }
        console.error(chalk.red("Error:"), error?.message || error);
      }
    }
  }
}

/**
 * MARIA CLI v3.0.0 - Clean public API
 */
export function createCLI(): Command {
  const program = new Command();

  program
    .name("maria")
    .description(`🚀 MARIA v${getVersion()} - Intelligent AI Assistant`)
    .version(getVersion())
    .option("--v3-session", "Use v3 session architecture")
    .option("--no-interactive", "Disable interactive mode for CI/CD")
    .option("--server", "Start HTTP server mode for Cloud Run")
    .action(async (options) => {
      // Load environment variables first
      loadEnvironmentVariables();
      
      // Handle server mode for Cloud Run
      if (options.server) {
        console.log(chalk.green("🚀 Starting MARIA server mode..."));
        try {
          // Import the server module
          const serverPath = path.join(process.cwd(), 'server.mjs');
          const { spawn } = await import('child_process');
          const serverProcess = spawn('node', [serverPath], {
            stdio: 'inherit',
            env: process.env
          });
          
          serverProcess.on('error', (error: any) => {
            console.error(chalk.red("❌ Server process error:"), error);
            process.exit(1);
          });
          
          return;
        } catch (error) {
          console.error(chalk.red("❌ Failed to start server mode:"), error);
          process.exit(1);
        }
      }
      
      // Try to display startup screen (optional)
      if (!startupDisplayed) {
        try {
          const { displayStartupLogo } = await import(
            "./services/startup-display.js"
          );
          displayStartupLogo();
          startupDisplayed = true;
        } catch {
          // Startup display is optional
          console.log(chalk.cyan(`\n🚀 MARIA v${getVersion()}\n`));
          startupDisplayed = true;
        }
      }

      // Feature flag evaluation
      const useV3 = options.v3Session || process.env.MARIA_USE_V3_SESSION === "1";
      
      if (useV3) {
        // Try V3 session
        try {
          console.log(chalk.cyan("🚀 Starting MARIA v3 session..."));
          const { MariaAI } = await import("./maria-ai.js");
          const maria = new MariaAI();
          await maria.initialize();
          return;
        } catch (e) {
          console.warn(chalk.yellow("⚠ V3 session unavailable, using standard mode"));
        }
      }

      // Start interactive session
      await startInteractiveSession();
    });

  return program;
}

// Auto-run CLI
const program = createCLI();
program.parse(process.argv);