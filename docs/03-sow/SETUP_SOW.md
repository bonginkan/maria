# `/setup` Command - Complete Environment Setup Wizard SOW

## Overview

The `/setup` command is a comprehensive first-time environment setup wizard that guides new users through the complete MARIA CODE configuration process. This command is designed to be the **essential first command** that new users must run to properly configure their environment for optimal MARIA CODE experience.

## Implementation Status: =Ë PLANNED

**Target Implementation**: 2025-08-20  
**File Location**: `src/slash-commands/categories/config/setup.command.ts`  
**Estimated Lines**: 600+  
**Category**: Config Management  
**Priority**: =% **CRITICAL** - Required for first-time users

## Strategic Importance

### <¯ Primary Objectives

1. **Zero-Friction Onboarding**: Reduce new user setup time from 30+ minutes to under 5 minutes
2. **Environment Validation**: Ensure all required dependencies and configurations are properly set
3. **Intelligent Setup**: Auto-detect existing configurations and avoid conflicts  
4. **Educational Experience**: Guide users through MARIA CODE's capabilities during setup
5. **Recovery & Rollback**: Provide safe setup with rollback capabilities on failure

### =Ê Success Metrics

- **Setup Completion Rate**: >95% of users complete setup successfully
- **Time to First Success**: <5 minutes from installation to first successful AI interaction
- **Support Ticket Reduction**: -80% environment-related support tickets
- **User Retention**: +40% 7-day user retention improvement
- **Error Recovery**: <1% setup failures that require manual intervention

## Complete Feature Specification

### =€ Phase 1: Pre-Setup Analysis

#### System Environment Detection
```typescript
interface SystemAnalysis {
  platform: 'darwin' | 'linux' | 'win32';
  architecture: string;
  nodeVersion: string;
  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun';
  terminalCapabilities: {
    colorSupport: boolean;
    unicodeSupport: boolean;
    interactiveSupport: boolean;
  };
  networkConnectivity: boolean;
  diskSpace: number; // in GB
  memoryAvailable: number; // in GB
}
```

#### Dependency Analysis
- **Node.js**: Version 18+ required, 20+ recommended
- **Package Manager**: Auto-detect preferred (pnpm > yarn > npm)
- **Git**: Required for project management
- **Terminal**: Color and Unicode support detection
- **Network**: Internet connectivity for AI provider APIs
- **Storage**: Minimum 2GB free space for models and cache

#### Existing Configuration Detection
```typescript
interface ConfigurationStatus {
  existingEnvFile: boolean;
  existingMARIAConfig: boolean;
  installedCLI: boolean;
  configuredProviders: string[];
  workingDirectory: string;
  gitRepository: boolean;
}
```

### =à Phase 2: Interactive Setup Wizard

#### Welcome & Overview Screen
```bash
=€ Welcome to MARIA CODE Setup Wizard!

This wizard will configure your environment in 4 simple steps:
1. = AI Provider Setup (Required)
2. <× Project Configuration (Recommended)  
3. <› Personal Preferences (Optional)
4.  Validation & Testing (Automatic)

Estimated time: 3-5 minutes
Press ENTER to continue or 'q' to quit...
```

#### Step 1: AI Provider Setup (Critical Path)
```typescript
interface ProviderSetup {
  required: {
    openai?: {
      apiKey: string;
      model: 'gpt-4' | 'gpt-4-turbo' | 'gpt-3.5-turbo';
      rateLimit?: number;
    };
    anthropic?: {
      apiKey: string;
      model: 'claude-3-sonnet' | 'claude-3-haiku';
    };
    google?: {
      apiKey: string;
      model: 'gemini-pro' | 'gemini-pro-vision';
    };
  };
  local?: {
    lmstudio: {
      url: string;
      autoStart: boolean;
      models: string[];
    };
    ollama: {
      url: string;
      models: string[];
    };
  };
}
```

**Interactive Flow**:
```bash
= AI Provider Setup (Step 1/4)

MARIA needs at least one AI provider to function.
Choose your preferred setup:

[1] < Quick Start (OpenAI GPT-4) - Recommended
[2] <¯ Custom Setup (Choose providers)
[3] <à Local Only (LM Studio/Ollama)
[4] =Ö Learn about providers first

Your choice [1]: _
```

#### Step 2: Project Configuration  
Uses the existing `/setting` command internally for environment variable setup.

### =' Integration with Existing Commands

The `/setup` command orchestrates other commands:

```typescript
class SetupCommand extends BaseCommand {
  private async configureEnvironment(): Promise<void> {
    // Use the existing /setting command
    const settingCommand = new SettingCommand();
    await settingCommand.execute(
      { raw: ['ai'], parsed: { positional: ['ai'] }, flags: {}, options: {} },
      this.context
    );
  }
  
  private async initializeProject(): Promise<void> {
    // Use the existing /init command  
    const initCommand = new InitCommand();
    await initCommand.execute(
      { raw: [], parsed: {}, flags: {}, options: {} },
      this.context
    );
  }
}
```

### =¨ First-Time User Detection

The system must detect when a user needs to run setup:

```typescript
class FirstTimeUserDetector {
  async isFirstTimeUser(): Promise<boolean> {
    const checks = [
      this.hasEnvFile(),           // Check for .env.local
      this.hasMariaConfig(),       // Check for .maria-code.toml
      this.hasAnyProviderConfigured(), // Check for API keys
      this.hasSuccessfulCommandHistory() // Check command history
    ];
    
    const results = await Promise.all(checks);
    return results.every(result => !result); // All false = first time
  }

  async requiresSetup(): Promise<'required' | 'recommended' | 'none'> {
    if (await this.isFirstTimeUser()) return 'required';
    if (await this.hasIncompleteSetup()) return 'recommended';
    return 'none';
  }
}
```

### <› CLI Integration

In the main CLI entry point, show setup requirement:

```typescript
// In src/cli.ts or main entry point
async function checkSetupRequirement() {
  const detector = new FirstTimeUserDetector();
  const requirement = await detector.requiresSetup();
  
  if (requirement === 'required') {
    console.log(`
=¨ First-time setup required!

MARIA CODE needs to be configured before use.
This will only take 2-3 minutes.

Run: /setup

Or for quick setup: /setup --quick
    `);
    return false; // Block other commands
  }
  
  if (requirement === 'recommended') {
    console.log(`
  Setup incomplete or outdated

Run: /setup --fix to resolve configuration issues.
    `);
  }
  
  return true; // Allow other commands
}
```

### =Á File Generation

The setup command will generate/update these files:

1. **`.env.local`** - Environment variables (via `/setting` command)
2. **`.env.local.sample`** - Sample file (via `/setting` command)
3. **`.maria-code.toml`** - MARIA configuration (via `/init` command)
4. **`MARIA.md`** - Development guidelines (via `/init` command)
5. **`.gitignore`** - Updated with environment files (via `/setting` command)
6. **`.maria/setup.json`** - Setup completion record

## Command Implementation Structure

```typescript
export class SetupCommand extends BaseCommand {
  name = 'setup';
  category: CommandCategory = 'config';
  description = '=€ First-time environment setup wizard';
  usage = '[--quick] [--advanced] [--config <file>] [--silent] [--fix] [--rollback]';
  
  examples: CommandExample[] = [
    {
      input: '/setup',
      description: 'Start interactive setup wizard',
      output: 'Complete environment configuration',
    },
    {
      input: '/setup --quick',
      description: 'Quick setup with defaults',
      output: 'Rapid configuration in 2 minutes',
    },
    {
      input: '/setup --fix',
      description: 'Fix existing configuration issues',
      output: 'Configuration problems resolved',
    },
  ];

  async execute(args: CommandArgs, context: CommandContext): Promise<CommandResult> {
    const { flags } = args;
    
    try {
      // Handle different modes
      if (flags.rollback) {
        return await this.rollbackSetup();
      }
      
      if (flags.fix) {
        return await this.fixConfiguration();
      }
      
      if (flags.quick) {
        return await this.quickSetup();
      }
      
      if (flags.advanced) {
        return await this.advancedSetup();
      }
      
      // Default: interactive setup
      return await this.interactiveSetup();
      
    } catch (error) {
      logger.error('Setup failed:', error);
      return this.error(
        `Setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'SETUP_ERROR',
        error
      );
    }
  }

  private async interactiveSetup(): Promise<CommandResult> {
    // 1. System analysis
    const systemInfo = await this.analyzeSystem();
    
    // 2. Welcome screen
    await this.showWelcomeScreen();
    
    // 3. Provider setup (uses /setting internally)
    await this.configureProviders();
    
    // 4. Project initialization (uses /init internally)  
    await this.initializeProject();
    
    // 5. Validation
    const validation = await this.validateSetup();
    
    // 6. Success message
    await this.showSuccessMessage();
    
    return this.success('Setup completed successfully');
  }
  
  private async quickSetup(): Promise<CommandResult> {
    // Quick setup with sensible defaults
    // OpenAI GPT-4, TypeScript web project, all features enabled
    return this.success('Quick setup completed');
  }
  
  private async fixConfiguration(): Promise<CommandResult> {
    // Detect and fix configuration issues
    return this.success('Configuration issues resolved');
  }
}
```

## Implementation Priority

### <¯ Critical Path Features (Week 1)

1. **First-Time User Detection** - Essential for auto-suggesting setup
2. **System Analysis Engine** - Detect environment and requirements
3. **Basic Interactive Wizard** - Core setup flow
4. **Integration with /setting** - Reuse environment variable setup

### =Ë Implementation Tasks

```typescript
// Task 1: First-time user detection
class FirstTimeUserDetector {
  async isFirstTimeUser(): Promise<boolean>
  async requiresSetup(): Promise<'required' | 'recommended' | 'none'>
}

// Task 2: System analysis
class SystemAnalyzer {
  async analyzeEnvironment(): Promise<SystemAnalysis>
  async validateRequirements(): Promise<ValidationResult[]>
}

// Task 3: Setup wizard
class SetupWizard {
  async runInteractiveSetup(): Promise<SetupResult>
  async quickSetup(): Promise<SetupResult>
}

// Task 4: Integration layer
class SetupOrchestrator {
  async configureProviersViaSetting(): Promise<void>
  async initializeProjectViaInit(): Promise<void>
}
```

## Success Criteria

###  Must Have (MVP)

1. **First-time user detection** working correctly
2. **Interactive setup wizard** completes successfully  
3. **Integration with /setting** command functional
4. **System analysis** provides accurate environment info
5. **Basic error handling** for common failure scenarios

### =€ Should Have (v1.1)

1. **Quick setup mode** (2-minute setup)
2. **Advanced setup mode** (full customization)
3. **Rollback functionality** for failed setups
4. **Configuration repair** mode
5. **Tutorial mode** with explanations

### < Nice to Have (v1.2)

1. **Silent/headless setup** from config file
2. **Multi-language support** (EN/JP)
3. **Setup analytics** collection
4. **Cloud sync** of setup preferences

---

**Status**: =Ë **READY FOR IMPLEMENTATION**  
**Priority**: =% **CRITICAL** - Blocks first-time user experience  
**Dependencies**: `/setting` command ( Complete), `/init` command ( Exists)  
**Effort**: 1 week development + integration testing  
**Quality Target**: Production-grade with comprehensive error handling

**Implementation Order**:
1. First-time user detection system
2. Basic setup command structure  
3. System analysis engine
4. Interactive wizard with /setting integration
5. Error handling and validation
6. CLI integration for auto-suggestion