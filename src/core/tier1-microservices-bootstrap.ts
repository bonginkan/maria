/**
 * Tier 1 Microservices Bootstrap
 * Registers the Phase 3.2 Tier 1 microservices with the command registry
 */

import { CommandRegistry } from './command-registry';
import { DIContainer } from './di-container';
import { EventBus } from './event-bus';
import { Logger } from '../utils/logger';

interface Tier1CommandInfo {
  name: string;
  registered: boolean;
  enabled: boolean;
  lastUsed?: Date;
  usageCount: number;
  _metadata: any;
}

// Import Tier 1 microservices
import { codeCommand } from '../shared/handlers/SlashCommandHandler';
// DISABLED: Old microservices paths that don't exist
// import { TestCommand } from '../commands/microservices/test.command';
// import { BugCommand } from '../commands/microservices/bug.command';
// import { ReviewCommand } from '../commands/microservices/review.command';

export interface Tier1BootstrapOptions {
  enableAll?: boolean;
  enabledCommands?: string[];
  skipValidation?: boolean;
}

export interface Tier1BootstrapResult {
  registeredCommands: string[];
  skippedCommands: string[];
  errors: Array<{
    command: string;
    error: string;
  }>;
  totalTime: number;
}

export class Tier1MicroservicesBootstrap {
  private logger: Logger;

  constructor(
    private commandRegistry: CommandRegistry,
    private container: DIContainer,
    private eventBus: EventBus
  ) {
    this.logger = new Logger('Tier1Bootstrap');
  }

  /**
   * Bootstrap all Tier 1 microservices
   */
  async _bootstrap(options: Tier1BootstrapOptions = {}): Promise<Tier1BootstrapResult> {
    const _startTime = performance.now();
    this.logger.info('Starting Tier 1 microservices bootstrap...', { options });

    const result: Tier1BootstrapResult = {
      registeredCommands: [],
      skippedCommands: [],
      errors: [],
      totalTime: 0
    };

    const defaultOptions: Tier1BootstrapOptions = {
      enableAll: true,
      enabledCommands: ['/code', '/test', '/bug', '/review'],
      skipValidation: false
    };

    const _finalOptions = { ...defaultOptions, ...options };

    // Define Tier 1 commands with their initialization functions
    const _tier1Commands = [
      {
        name: '/code',
        displayName: 'Code Generation Command',
        factory: () => codeCommand, // Use the linear flow command
        description: 'Fast code generation (template/cache/LLM)',
        category: 'development' as const,
        tier: 1,
        priority: 'critical' as const
      }
      /* DISABLED: TestCommand not found
      {
        name: '/test',
        displayName: 'Test Management Command',
        factory: () => new TestCommand(),
        description: 'Advanced test running, generation, and analysis',
        category: 'development' as const,
        tier: 1,
        priority: 'critical' as const
      },
      */
      /* DISABLED: BugCommand not found
      {
        name: '/bug',
        displayName: 'Bug Detection and Analysis Command',
        factory: () => new BugCommand(),
        description: 'Comprehensive bug detection, analysis, and fixing',
        category: 'development' as const,
        tier: 1,
        priority: 'critical' as const
      },
      */
      /* DISABLED: ReviewCommand not found
      {
        name: '/review',
        displayName: 'Code Review Command',
        factory: () => new ReviewCommand(),
        description: 'AI-powered code review with comprehensive analysis',
        category: 'development' as const,
        tier: 1,
        priority: 'critical' as const
      }
      */
    ];

    // Register each command
    for (const commandDef of _tier1Commands) {
      try {
        // Check if command should be registered
        if (!this.shouldRegisterCommand(commandDef.name, _finalOptions)) {
          result.skippedCommands.push(commandDef.name);
          this.logger.debug(`Skipping ${commandDef.name} - not in enabled list`);
          continue;
        }

        // Validate command before _registration
        if (!_finalOptions.skipValidation) {
          await this.validateCommand(commandDef);
        }

        // Create command _instance
        const _commandInstance = commandDef.factory();
        
        // Ensure DI container has necessary _dependencies
        await this.ensureDependencies(_commandInstance);

        // Register the command
        this.commandRegistry.register(_commandInstance);

        result.registeredCommands.push(commandDef.name);
        this.logger.info(`Successfully registered ${commandDef.displayName}`, {
          name: commandDef.name,
          category: commandDef.category,
          tier: commandDef.tier
        });

        // Emit _bootstrap event
        await this.eventBus.publish({
          eventId: this.generateEventId(),
          eventType: 'tier1:command-registered',
          timestamp: new Date(),
          userId: 'system',
          payload: {
            commandName: commandDef.name,
            displayName: commandDef.displayName,
            category: commandDef.category,
            tier: commandDef.tier,
            priority: commandDef.priority
          }
        });

      } catch (error) {
        const _errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push({
          command: commandDef.name,
          error: _errorMessage
        });

        this.logger.error(`Failed to register ${commandDef.displayName}`, {
          name: commandDef.name,
          error: _errorMessage
        });
      }
    }

    result.totalTime = performance.now() - _startTime;

    // Log _bootstrap summary
    this.logger.info('Tier 1 microservices _bootstrap completed', {
      registered: result.registeredCommands.length,
      skipped: result.skippedCommands.length,
      errors: result.errors.length,
      duration: `${Math.round(result.totalTime)}ms`
    });

    // Emit completion event
    await this.eventBus.publish({
      eventId: this.generateEventId(),
      eventType: 'tier1:_bootstrap-completed',
      timestamp: new Date(),
      userId: 'system',
      payload: {
        totalCommands: _tier1Commands.length,
        registeredCount: result.registeredCommands.length,
        skippedCount: result.skippedCommands.length,
        errorCount: result.errors.length,
        duration: result.totalTime,
        commands: result.registeredCommands,
      }
    });

    // Validate _bootstrap result
    await this.validateBootstrapResult(result, _finalOptions);

    return result;
  }

  /**
   * Get information about Tier 1 commands
   */
  public getTier1CommandInfo(): Tier1CommandInfo[] {
    const _info: Tier1CommandInfo[] = [];
    const _tier1Names = ['/code', '/test', '/bug', '/review'];

    for (const name of _tier1Names) {
      const _registration = this.commandRegistry.get(name);
      
      _info.push({
        name,
        registered: !!_registration,
        enabled: _registration?.enabled ?? false,
        lastUsed: _registration?.lastUsed,
        usageCount: _registration?.usageCount ?? 0,
        _metadata: _registration?.metadata ?? null,
      });
    }

    return _info;
  }

  /**
   * Check health of Tier 1 commands
   */
  async checkTier1Health(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    commands: Array<{
      name: string;
      status: 'healthy' | 'degraded' | 'unhealthy';
      message: string;
      details?: any;
    }>;
  }> {
    const _tier1Names = ['/code', '/test', '/bug', '/review'];
    const _commandHealth = [];
    
    for (const name of _tier1Names) {
      const _registration = this.commandRegistry.get(name);
      
      if (!_registration) {
        commandHealth.push({
          name,
          status: 'unhealthy' as const,
          message: 'Command not registered'
        });
        continue;
      }

      if (!_registration.enabled) {
        commandHealth.push({
          name,
          status: 'degraded' as const,
          message: 'Command disabled'
        });
        continue;
      }

      // Check if command has required _dependencies
      try {
        const _dependencies = _registration.metadata._dependencies;
        const _missingDeps = [];
        
        for (const dep of _dependencies) {
          try {
            this.container.resolve(dep);
          } catch (innerError) {
            _missingDeps.push(dep);
          }
        }
      } catch (error) {
        commandHealth.push({
          name,
          status: 'unhealthy' as const,
          message: 'Health check failed',
          details: { error: error instanceof Error ? error.message : 'Unknown error' }
        });
      }
    }

    // Determine overall health
    const _unhealthyCount = _commandHealth.filter(c => c.status === 'unhealthy').length;
    const _degradedCount = _commandHealth.filter(c => c.status === 'degraded').length;
    
    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (_unhealthyCount > 0) {
      overall = 'unhealthy';
    } else if (_degradedCount > 0) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    return {
      overall,
      commands: _commandHealth
    };
  }

  // Private helper methods

  private shouldRegisterCommand(_commandName: string, options: Tier1BootstrapOptions): boolean {
    if (options.enableAll) {
      return true;
    }

    return options.enabledCommands?.includes(_commandName) ?? false;
  }

  private async validateCommand(commandDef: unknown): Promise<void> {
    // Basic validation
    if (!commandDef.name || !commandDef.factory) {
      throw new Error(`Invalid command definition: ${commandDef.name}`);
    }

    // Try to instantiate to check for errors
    try {
      const _instance = commandDef.factory();
      
      // Validate command implements required interface
      if (!_instance.execute || !_instance.validate || !_instance.getHelp) {
        throw new Error(`Command ${commandDef.name} does not implement required interface`);
      }

      // Test validation method
      const _validationResult = _instance.validate({});
      if (typeof _validationResult !== 'object' || typeof _validationResult.isValid !== 'boolean') {
        throw new Error(`Command ${commandDef.name} validation method returns invalid result`);
      }

    } catch (error) {
      throw new Error(`Command ${commandDef.name} failed validation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async ensureDependencies(command: unknown): Promise<void> {
    const _metadata = command.getMetadata();
    const _dependencies = _metadata._dependencies || [];

    for (const dep of _dependencies) {
      try {
        // Try to resolve dependency
        this.container.resolve(dep);
      } catch {
        // Register a mock dependency if not found
        this.logger.warn(`Dependency ${dep} not found, registering mock implementation`);
        this.container.registerSingleton(dep, () => this.createMockDependency(dep));
      }
    }
  }

  private createMockDependency(dependencyName: string): unknown {
    // Create basic mock implementations for common services
    const mocks: Record<string, () => any> = {
      'AIRouterService': () => ({
        generate: async () => 'Mock AI response',
        selectModel: async () => 'gpt-4',
        getModels: async () => ['gpt-4', 'claude-3']
      }),
      'FileSystemService': () => ({
        readFile: async () => 'Mock file content',
        writeFile: async () => true,
        exists: async () => true,
        glob: async () => []
      }),
      'TestRunnerService': () => ({
        runTests: async () => ({ passed: 0, failed: 0, total: 0 }),
        generateTests: async () => 'Mock test code'
      }),
      'StaticAnalysisService': () => ({
        analyze: async () => ({ issues: [], metrics: Record<string, any> }),
        lint: async () => ({ errors: [], warnings: [] })
      }),
      'GitService': () => ({
        getDiff: async () => 'Mock diff',
        getStatus: async () => ({ staged: [], modified: [] }),
        commit: async () => true
      })
    };

    const _mockFactory = mocks[dependencyName];
    if (_mockFactory) {
      return _mockFactory();
    }

    // Generic mock for unknown _dependencies
    return new Proxy({}, {
      get() {
        return async () => 'Mock implementation';
      }
    });
  }

  private async validateBootstrapResult(_result: Tier1BootstrapResult, options: Tier1BootstrapOptions): Promise<void> {
    // Ensure critical commands are registered
    const _criticalCommands = ['/code', '/test', '/bug', '/review'];
    const _missingCritical = _criticalCommands.filter(cmd => 
      options.enabledCommands?.includes(cmd) && !_result.registeredCommands.includes(cmd)
    );

    if (_missingCritical.length > 0) {
      throw new Error(`Critical Tier 1 commands failed to register: ${_missingCritical.join(', ')}`);
    }

    // Check for excessive errors
    if (_result.errors.length > 0 && _result.registeredCommands.length === 0) {
      throw new Error('No Tier 1 commands were successfully registered');
    }
  }

  private generateEventId(): string {
    return `tier1-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Factory function to create and _bootstrap Tier 1 microservices
 */
export async function bootstrapTier1Microservices(_commandRegistry: CommandRegistry, container: DIContainer, eventBus: EventBus, _options?: Tier1BootstrapOptions): Promise<Tier1BootstrapResult> {
  const _bootstrap = new Tier1MicroservicesBootstrap(_commandRegistry, container, eventBus);
  return _bootstrap._bootstrap(_options);
}

/**
 * Health check function for Tier 1 microservices
 */
export async function checkTier1Health(_commandRegistry: CommandRegistry, container: DIContainer, eventBus: EventBus): Promise<any> {
  const _bootstrap = new Tier1MicroservicesBootstrap(_commandRegistry, container, eventBus);
  return _bootstrap.checkTier1Health();
}