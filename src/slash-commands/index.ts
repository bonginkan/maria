/**
 * Slash Commands Module
 * Export all command system components
 */

// Core exports
export * from "./types";
export * from "./base-command";
export * from "./registry";
// export * from './decorators';

// Middleware exports
export * from "./middleware/auth";
export * from "./middleware/validation";
export * from "./middleware/rate-limit";
export * from "./middleware/logging";

// Command exports (will be added as _commands are migrated)
export * from "./categories/conversation/clear.command";
export * from "./categories/core/handlers/HelpCommand";
export * from "./categories/core/handlers/VersionCommand";
export * from "./categories/core/handlers/ExitCommand";
export * from "./categories/core/CoreCommandService";
export * from "./categories/system/handlers/StatusCommand";
export * from "./categories/system/handlers/DoctorCommand";
export * from "./categories/system/handlers/TerminalSetupCommand";
export * from "./categories/system/SystemCommandService";
export * from "./categories/memory/remember.command";
export * from "./categories/memory/recall.command";
export * from "./categories/memory/forget.command";
export * from "./categories/memory/memory-status.command";
export * from "./categories/auth/LoginCommand";
export * from "./categories/auth/LogoutCommand";
export * from "./categories/auth/UsageCommand";
export * from "./categories/auth/PlanCommand";

// Re-export registry singleton
import { commandRegistry } from "./registry";
import { ISlashCommand } from "./types";
export { commandRegistry };

// Initialize and auto-register _commands

/**
 * Initialize the slash command system
 */
export async function initializeSlashCommands(): Promise<void> {
  // Register built-in middlewares
  const { authMiddleware } = await import("./middleware/auth");
  const { validationMiddleware } = await import("./middleware/validation");
  const { rateLimitMiddleware } = await import("./middleware/rate-limit");
  const { loggingMiddleware } = await import("./middleware/logging");

  commandRegistry.registerMiddleware(loggingMiddleware);
  commandRegistry.registerMiddleware(authMiddleware);
  commandRegistry.registerMiddleware(rateLimitMiddleware);
  commandRegistry.registerMiddleware(validationMiddleware);

  // Manually register known _commands (for bundled environment)
  await registerBuiltInCommands();

  console.log(
    `✅ Initialized ${commandRegistry.getAll().length} slash _commands`,
  );
}

/**
 * Register built-in _commands manually (for bundled environment)
 */
async function registerBuiltInCommands(): Promise<void> {
  try {
    // Register clear command (conversation category)
    const { ClearCommand } = await import(
      "./categories/conversation/clear.command"
    );
    const clearCommand = new ClearCommand();
    if (clearCommand.initialize) {
      await clearCommand.initialize();
    }
    commandRegistry.register(clearCommand);

    // Register setup command (config category)
    const setupCommandModule = await import(
      "./categories/config/setup.command"
    );
    const setupCommand = setupCommandModule.default;
    if (setupCommand) {
      if (setupCommand.initialize) {
        await setupCommand.initialize();
      }
      commandRegistry.register(setupCommand);
    }

    // Register core _commands (Phase 2 implementation)
    const { HelpCommand } = await import(
      "./categories/core/handlers/HelpCommand"
    );
    const { VersionCommand } = await import(
      "./categories/core/handlers/VersionCommand"
    );
    const { ExitCommand } = await import(
      "./categories/core/handlers/ExitCommand"
    );

    const helpCommand = new HelpCommand();
    const versionCommand = new VersionCommand();
    const exitCommand = new ExitCommand();

    // Initialize and register core _commands
    if (helpCommand.initialize) await helpCommand.initialize();
    if (versionCommand.initialize) await versionCommand.initialize();
    if (exitCommand.initialize) await exitCommand.initialize();

    commandRegistry.register(helpCommand);
    commandRegistry.register(versionCommand);
    commandRegistry.register(exitCommand);

    // Register system _commands (Phase 3 implementation)
    const { StatusCommand } = await import(
      "./categories/system/handlers/StatusCommand"
    );
    const { DoctorCommand } = await import(
      "./categories/system/handlers/DoctorCommand"
    );
    const { TerminalSetupCommand } = await import(
      "./categories/system/handlers/TerminalSetupCommand"
    );

    const statusCommand = new StatusCommand();
    const doctorCommand = new DoctorCommand();
    const terminalSetupCommand = new TerminalSetupCommand();

    // Initialize and register system _commands
    if (statusCommand.initialize) await statusCommand.initialize();
    if (doctorCommand.initialize) await doctorCommand.initialize();
    if (terminalSetupCommand.initialize)
      await terminalSetupCommand.initialize();

    commandRegistry.register(statusCommand);
    commandRegistry.register(doctorCommand);
    commandRegistry.register(terminalSetupCommand);

    // Register memory _commands (Phase 0 - Quick Wins)
    try {
      const { RememberCommand } = await import(
        "./categories/memory/remember.command"
      );
      const { RecallCommand } = await import(
        "./categories/memory/recall.command"
      );
      const { ForgetCommand } = await import(
        "./categories/memory/forget.command"
      );
      const { MemoryStatusCommand } = await import(
        "./categories/memory/memory-status.command"
      );

      const rememberCommand = new RememberCommand();
      const recallCommand = new RecallCommand();
      const forgetCommand = new ForgetCommand();
      const memoryStatusCommand = new MemoryStatusCommand();

      if (rememberCommand.initialize) await rememberCommand.initialize();
      if (recallCommand.initialize) await recallCommand.initialize();
      if (forgetCommand.initialize) await forgetCommand.initialize();
      if (memoryStatusCommand.initialize)
        await memoryStatusCommand.initialize();

      commandRegistry.register(rememberCommand);
      commandRegistry.register(recallCommand);
      commandRegistry.register(forgetCommand);
      commandRegistry.register(memoryStatusCommand);
    } catch (error) {
      console.error("Failed to register memory _commands:", error);
    }

    // Register code command
    try {
      const { codeCommand } = await import("./categories/code/code.command");
      commandRegistry.register(codeCommand);
      console.log("✅ Registered /code command");
    } catch (error) {
      console.error("Failed to register code command:", error);
    }

    // Register research _commands (Phase 5 implementation)
    try {
      const { ResearchCommand } = await import(
        "./categories/research/handlers/ResearchCommand"
      );
      const researchCommand = new ResearchCommand();

      if (researchCommand.initialize) await researchCommand.initialize();
      commandRegistry.register(researchCommand);
    } catch (error) {
      console.error("Failed to register research command:", error);
    }

    // Register multimodal commands
    try {
      const { imageCommand } = await import(
        "./categories/multimodal/ImageCommand"
      );
      const { voiceCommand } = await import(
        "./categories/multimodal/VoiceCommand"
      );
      const { videoCommand } = await import(
        "./categories/multimodal/VideoCommand"
      );

      commandRegistry.register(imageCommand);
      commandRegistry.register(voiceCommand);
      commandRegistry.register(videoCommand);

      console.log("✅ Registered /image, /voice and /video commands");
    } catch (error) {
      console.error("Failed to register multimodal commands:", error);
    }

    // Register auth commands (Phase 4 implementation)
    try {
      const { LoginCommand } = await import(
        "./categories/auth/LoginCommand"
      );
      const { LogoutCommand } = await import(
        "./categories/auth/LogoutCommand"
      );
      const { UsageCommand } = await import(
        "./categories/auth/UsageCommand"
      );
      const { PlanCommand } = await import(
        "./categories/auth/PlanCommand"
      );

      const loginCommand = new LoginCommand();
      const logoutCommand = new LogoutCommand();
      const usageCommand = new UsageCommand();
      const planCommand = new PlanCommand();

      commandRegistry.register(loginCommand);
      commandRegistry.register(logoutCommand);
      commandRegistry.register(usageCommand);
      commandRegistry.register(planCommand);

      console.log("✅ Registered /login, /logout, /usage and /plan commands");
    } catch (error) {
      console.error("Failed to register auth commands:", error);
    }

    // Register learning commands
    try {
      const L2RCommandModule = await import("./categories/learning/l2r.command");
      const L2RCommand = L2RCommandModule.default || L2RCommandModule.L2RCommand;
      const l2rCommand = new L2RCommand();
      if (l2rCommand.initialize) await l2rCommand.initialize();
      commandRegistry.register(l2rCommand);
      console.log("✅ Registered /l2r command");
    } catch (error) {
      console.error("Failed to register learning commands:", error);
    }

    // Register graphrag commands
    try {
      const SearchCommandModule = await import("./categories/graphrag/search.command");
      const GraphRAGSearchCommand = SearchCommandModule.default || SearchCommandModule.GraphRAGSearchCommand;
      const searchCommand = new GraphRAGSearchCommand();
      if (searchCommand.initialize) await searchCommand.initialize();
      commandRegistry.register(searchCommand);
      console.log("✅ Registered /search command");
    } catch (error) {
      console.error("Failed to register graphrag commands:", error);
    }

    // Register multilingual commands
    try {
      const LanguageCommandModule = await import("./categories/multilingual/language.command");
      const LanguageCommand = LanguageCommandModule.default || LanguageCommandModule.LanguageCommand;
      const languageCommand = new LanguageCommand();
      if (languageCommand.initialize) await languageCommand.initialize();
      commandRegistry.register(languageCommand);
      console.log("✅ Registered /language command");
    } catch (error) {
      console.error("Failed to register multilingual commands:", error);
    }

    // Register business commands (with shield handlers for now)
    try {
      const { shield } = await import("./shared/shield-handler");
      
      // Register battlecard with shield
      commandRegistry.register({
        name: "battlecard",
        category: "business",
        description: "Generate competitive analysis",
        aliases: [],
        execute: async () => shield({ message: "🔒 Coming soon", showWaitlist: true }),
        initialize: async () => {}
      });
      
      // Register sales-dashboard with shield
      commandRegistry.register({
        name: "sales-dashboard",
        category: "business",
        description: "Sales dashboard",
        aliases: ["sales"],
        execute: async () => shield({ message: "🔒 Coming soon", showWaitlist: true }),
        initialize: async () => {}
      });
      
      // Register pilot-setup with shield
      commandRegistry.register({
        name: "pilot-setup",
        category: "business",
        description: "Pilot team setup",
        aliases: [],
        execute: async () => shield({ message: "🔒 Not available in this build" }),
        initialize: async () => {}
      });
      
      // Register tune with shield
      commandRegistry.register({
        name: "tune",
        category: "business",
        description: "Performance tuning",
        aliases: [],
        execute: async () => shield({ message: "🔒 Coming soon", showWaitlist: true }),
        initialize: async () => {}
      });
      
      console.log("✅ Registered business commands with shields");
    } catch (error) {
      console.error("Failed to register business commands:", error);
    }

    // Register AI commands (with shield handlers)
    try {
      const { shield } = await import("./shared/shield-handler");
      
      // Register evolve with shield
      commandRegistry.register({
        name: "evolve",
        category: "ai",
        description: "AI evolution features",
        aliases: [],
        execute: async () => shield({ message: "🔒 Not available in this build" }),
        initialize: async () => {}
      });
      
      // Register gpu with shield
      commandRegistry.register({
        name: "gpu",
        category: "ai",
        description: "GPU management",
        aliases: [],
        execute: async () => shield({ message: "🔒 Not available in this build" }),
        initialize: async () => {}
      });
      
      // Register llm with shield
      commandRegistry.register({
        name: "llm",
        category: "ai",
        description: "LLM model management",
        aliases: ["model"],
        execute: async () => shield({ message: "🔒 Coming soon", showWaitlist: true }),
        initialize: async () => {}
      });
      
      console.log("✅ Registered AI commands with shields");
    } catch (error) {
      console.error("Failed to register AI commands:", error);
    }

    // Register system commands (with shield handlers)
    try {
      const { shield } = await import("./shared/shield-handler");
      
      // Register shell with shield
      commandRegistry.register({
        name: "shell",
        category: "system",
        description: "Shell command execution",
        aliases: ["sh"],
        execute: async () => shield({ message: "🔒 Coming soon", showWaitlist: true }),
        initialize: async () => {}
      });
      
      // Register dashboard with shield
      commandRegistry.register({
        name: "dashboard",
        category: "system",
        description: "System dashboard",
        aliases: ["dash"],
        execute: async () => shield({ message: "🔒 Coming soon", showWaitlist: true }),
        initialize: async () => {}
      });
      
      // Register upgrade with shield
      commandRegistry.register({
        name: "upgrade",
        category: "system",
        description: "Upgrade MARIA",
        aliases: [],
        execute: async () => shield({ message: "🔒 Coming soon", showWaitlist: true }),
        initialize: async () => {}
      });
      
      console.log("✅ Registered system commands with shields");
    } catch (error) {
      console.error("Failed to register system commands:", error);
    }

    // Register configuration commands (with shield handlers)
    try {
      const { shield } = await import("./shared/shield-handler");
      
      // Register config with shield
      commandRegistry.register({
        name: "config",
        category: "configuration",
        description: "Configuration management",
        aliases: ["cfg"],
        execute: async () => shield({ message: "🔒 Coming soon", showWaitlist: true }),
        initialize: async () => {}
      });
      
      // Register hooks with shield
      commandRegistry.register({
        name: "hooks",
        category: "configuration",
        description: "Hook configuration",
        aliases: [],
        execute: async () => shield({ message: "🔒 Coming soon", showWaitlist: true }),
        initialize: async () => {}
      });
      
      // Register model with shield
      commandRegistry.register({
        name: "model",
        category: "configuration",
        description: "Model selection",
        aliases: [],
        execute: async () => shield({ message: "🔒 Coming soon", showWaitlist: true }),
        initialize: async () => {}
      });
      
      // Register permissions with shield
      commandRegistry.register({
        name: "permissions",
        category: "configuration",
        description: "Permission management",
        aliases: ["perms"],
        execute: async () => shield({ message: "🔒 Not available in this build" }),
        initialize: async () => {}
      });
      
      console.log("✅ Registered configuration commands with shields");
    } catch (error) {
      console.error("Failed to register configuration commands:", error);
    }

    // Register other commands (with shield handlers)
    try {
      const { shield } = await import("./shared/shield-handler");
      
      // Register pm with shield
      commandRegistry.register({
        name: "pm",
        category: "product",
        description: "Product management",
        aliases: [],
        execute: async () => shield({ message: "🔒 Not available in this build" }),
        initialize: async () => {}
      });
      
      // Register evaluate with shield
      commandRegistry.register({
        name: "evaluate",
        category: "evaluation",
        description: "Evaluation system",
        aliases: [],
        execute: async () => shield({ message: "🔒 Not available in this build" }),
        initialize: async () => {}
      });
      
      // Register multimodal with shield
      commandRegistry.register({
        name: "multimodal",
        category: "multimodal",
        description: "Multimodal features",
        aliases: ["mm"],
        execute: async () => shield({ message: "🔒 Coming soon", showWaitlist: true }),
        initialize: async () => {}
      });
      
      console.log("✅ Registered other commands with shields");
    } catch (error) {
      console.error("Failed to register other commands:", error);
    }
  } catch (innerError) {
    console.error("Failed to register built-in _commands:", innerError);
  }
}

/**
 * Get command suggestions for auto-complete
 */
export function getCommandSuggestions(input: string): string[] {
  const _commands = commandRegistry.getAll();
  const suggestions: string[] = [];

  const _cleanInput = input.replace("/", "").toLowerCase();

  for (const command of _commands) {
    if (command.name.toLowerCase().startsWith(_cleanInput)) {
      suggestions.push(`/${command.name}`);
    }

    // Check aliases
    if (command.aliases) {
      for (const alias of command.aliases) {
        if (alias.toLowerCase().startsWith(_cleanInput)) {
          suggestions.push(`/${alias}`);
        }
      }
    }
  }

  return suggestions.slice(0, 10); // Limit to 10 suggestions
}

/**
 * Get all _commands grouped by category
 */
export function getCommandsByCategory(): Record<string, ISlashCommand[]> {
  const _commands = commandRegistry.getAll();
  const grouped: Record<string, ISlashCommand[]> = {};

  for (const command of _commands) {
    if (!grouped[command.category]) {
      grouped[command.category] = [];
    }
    grouped[command.category]!.push(command);
  }

  return grouped;
}
