/**
 * Config Command
 * Configuration management for MARIA CODE
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import prompts from 'prompts';
// import { logger } from '../utils/logger.js';
import { assertIsObject, isObject } from '../utils/type-guards.js';

interface MariaConfig {
  defaultProvider?: string;
  defaultModel?: string;
  apiKeys?: {
    openai?: string;
    anthropic?: string;
    google?: string;
    groq?: string;
  };
  preferences?: {
    theme?: 'dark' | 'light' | 'auto';
    language?: string;
    autoSave?: boolean;
    telemetry?: boolean;
    experimental?: boolean;
  };
  editor?: {
    tabSize?: number;
    useTabs?: boolean;
    wordWrap?: boolean;
    formatOnSave?: boolean;
  };
  git?: {
    autoCommit?: boolean;
    signCommits?: boolean;
    pushAfterCommit?: boolean;
    commitTemplate?: string;
  };
  paths?: {
    projectsDir?: string;
    templatesDir?: string;
    logsDir?: string;
  };
}

export const configCommand = new Command('config')
  .description('Manage MARIA CODE configuration')
  .option('-g, --get <key>', 'Get configuration value')
  .option('-s, --set <key=value>', 'Set configuration value')
  .option('-l, --list', 'List all configuration')
  .option('-e, --edit', 'Open configuration in editor')
  .option('-r, --reset', 'Reset to default configuration')
  .option('--init', 'Initialize configuration interactively')
  .option('--export <path>', 'Export configuration to file')
  .option('--import <path>', 'Import configuration from file')
  .action(async (options) => {
    try {
      // const configPath = getConfigPath();

      if (options.init) {
        // Interactive configuration setup
        await initializeConfig();
      } else if (options.get) {
        // Get specific config value
        const value = await getConfigValue(options.get);
        if (value !== undefined) {
          console.log(value);
        } else {
          console.log(chalk.yellow(`Configuration key '${options.get}' not found`));
        }
      } else if (options.set) {
        // Set config value
        const [key, ...valueParts] = options.set.split('=');
        const value = valueParts.join('=');

        if (!value) {
          console.error(chalk.red('Invalid format. Use: --set key=value'));
          process.exit(1);
        }

        await setConfigValue(key, value);
        console.log(chalk.green(`✅ Set ${key} = ${value}`));
      } else if (options.list) {
        // List all configuration
        await listConfig();
      } else if (options.edit) {
        // Open config in editor
        await editConfig();
      } else if (options.reset) {
        // Reset configuration
        const { confirm } = await prompts({
          type: 'confirm',
          name: 'confirm',
          message: 'Are you sure you want to reset all configuration?',
          initial: false,
        });

        if (confirm) {
          await resetConfig();
          console.log(chalk.green('✅ Configuration reset to defaults'));
        }
      } else if (options.export) {
        // Export configuration
        await exportConfig(options.export);
      } else if (options.import) {
        // Import configuration
        await importConfig(options.import);
      } else {
        // Show config menu
        await showConfigMenu();
      }
    } catch (error: unknown) {
      console.error(chalk.red('Configuration error:'), error);
      process.exit(1);
    }
  });

function getConfigPath(): string {
  return path.join(os.homedir(), '.maria', 'config.json');
}

async function loadConfig(): Promise<MariaConfig> {
  const configPath = getConfigPath();

  try {
    const content = await fs.readFile(configPath, 'utf8');
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    // Return default config if file doesn't exist
    return getDefaultConfig();
  }
}

async function saveConfig(config: MariaConfig): Promise<void> {
  const configPath = getConfigPath();
  const configDir = path.dirname(configPath);

  // Ensure config directory exists
  await fs.mkdir(configDir, { recursive: true });

  // Save config
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}

function getDefaultConfig(): MariaConfig {
  return {
    defaultProvider: 'openai',
    defaultModel: 'gpt-4',
    preferences: {
      theme: 'dark',
      language: 'en',
      autoSave: true,
      telemetry: false,
      experimental: false,
    },
    editor: {
      tabSize: 2,
      useTabs: false,
      wordWrap: true,
      formatOnSave: true,
    },
    git: {
      autoCommit: false,
      signCommits: false,
      pushAfterCommit: false,
    },
    paths: {
      projectsDir: path.join(os.homedir(), 'Projects'),
      templatesDir: path.join(os.homedir(), '.maria', 'templates'),
      logsDir: path.join(os.homedir(), '.maria', 'logs'),
    },
  };
}

async function initializeConfig(): Promise<void> {
  console.log(chalk.blue('🎯 MARIA CODE Configuration Setup\n'));

  const config: MariaConfig = getDefaultConfig();

  // AI Provider setup
  const { provider } = await prompts({
    type: 'select',
    name: 'provider',
    message: 'Select your default AI provider',
    choices: [
      { title: 'OpenAI (GPT-4/GPT-5)', value: 'openai' },
      { title: 'Anthropic (Claude)', value: 'anthropic' },
      { title: 'Google (Gemini)', value: 'google' },
      { title: 'Groq (Fast inference)', value: 'groq' },
      { title: 'Local (LM Studio)', value: 'lmstudio' },
    ],
  });

  config['defaultProvider'] = provider;

  // API Keys (if not local)
  if (provider !== 'lmstudio') {
    const { apiKey } = await prompts({
      type: 'password',
      name: 'apiKey',
      message: `Enter your ${provider.toUpperCase()} API key (or press Enter to skip)`,
    });

    if (apiKey) {
      if (!config.apiKeys) {config['apiKeys'] = {};}
      config.apiKeys[provider as keyof typeof config.apiKeys] = apiKey;
    }
  }

  // Preferences
  const { theme, telemetry, experimental } = await prompts([
    {
      type: 'select',
      name: 'theme',
      message: 'Select theme',
      choices: [
        { title: 'Dark', value: 'dark' },
        { title: 'Light', value: 'light' },
        { title: 'Auto', value: 'auto' },
      ],
    },
    {
      type: 'confirm',
      name: 'telemetry',
      message: 'Enable anonymous usage telemetry?',
      initial: false,
    },
    {
      type: 'confirm',
      name: 'experimental',
      message: 'Enable experimental features?',
      initial: false,
    },
  ]);

  if (config.preferences) {
    config.preferences.theme = theme;
    config.preferences.telemetry = telemetry;
    config.preferences.experimental = experimental;
  }

  // Editor preferences
  const { tabSize, formatOnSave } = await prompts([
    {
      type: 'number',
      name: 'tabSize',
      message: 'Tab size',
      initial: 2,
      min: 1,
      max: 8,
    },
    {
      type: 'confirm',
      name: 'formatOnSave',
      message: 'Format code on save?',
      initial: true,
    },
  ]);

  if (config.editor) {
    config.editor.tabSize = tabSize;
    config.editor.formatOnSave = formatOnSave;
  }

  // Save configuration
  await saveConfig(config);

  console.log(chalk.green('\n✅ Configuration saved successfully!'));
  console.log(chalk.gray(`Config file: ${getConfigPath()}`));
}

async function getConfigValue(key: string): Promise<unknown> {
  const config = await loadConfig();

  // Navigate nested keys
  const keys = key.split('.');
  let value: unknown = config;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k];
    } else {
      return undefined;
    }
  }

  return value;
}

async function setConfigValue(key: string, value: string): Promise<void> {
  const config = await loadConfig();

  // Navigate nested keys
  const keys = key.split('.');
  let target: Record<string, unknown> = config as Record<string, unknown>;

  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (!k) {continue;}
    if (!(k in target) || !isObject(target[k])) {
      target[k] = {};
    }
    assertIsObject(target[k]);
    target = target[k] as Record<string, unknown>;
  }

  const lastKey = keys[keys.length - 1];
  if (!lastKey) {return;}

  // Parse value
  let parsedValue: unknown = value;
  if (value === 'true') {parsedValue = true;}
  else if (value === 'false') {parsedValue = false;}
  else if (!isNaN(Number(value))) {parsedValue = Number(value);}

  target[lastKey] = parsedValue;

  await saveConfig(config);
}

async function listConfig(): Promise<void> {
  const config = await loadConfig();

  console.log(chalk.bold('\n📋 MARIA CODE Configuration\n'));
  console.log(chalk.gray('─'.repeat(50)));

  // Display configuration in readable format
  function displayObject(obj: unknown, indent: string = ''): void {
    if (!isObject(obj)) {return;}
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        console.log(chalk.cyan(`${indent}${key}:`));
        displayObject(value, `${indent  }  `);
      } else {
        const displayValue =
          key.toLowerCase().includes('key') ||
          key.toLowerCase().includes('password') ||
          key.toLowerCase().includes('secret')
            ? chalk.gray('***hidden***')
            : chalk.white(value);
        console.log(`${indent}${chalk.gray(key)}: ${displayValue}`);
      }
    }
  }

  displayObject(config);

  console.log(chalk.gray('\n─'.repeat(50)));
  console.log(chalk.gray(`Config file: ${getConfigPath()}`));
}

async function editConfig(): Promise<void> {
  const configPath = getConfigPath();
  const editor = process.env['EDITOR'] || 'nano';

  try {
    const { spawn } = await import('child_process');
    const child = spawn(editor, [configPath], {
      stdio: 'inherit',
    });

    child.on('exit', (code) => {
      if (code === 0) {
        console.log(chalk.green('✅ Configuration updated'));
      } else {
        console.error(chalk.red('Editor exited with error'));
      }
    });
  } catch (error: unknown) {
    console.error(chalk.red(`Failed to open editor: ${error}`));
    console.log(chalk.gray(`You can manually edit: ${configPath}`));
  }
}

async function resetConfig(): Promise<void> {
  const defaultConfig = getDefaultConfig();
  await saveConfig(defaultConfig);
}

async function exportConfig(exportPath: string): Promise<void> {
  const config = await loadConfig();
  const absolutePath = path.resolve(exportPath);

  // Remove sensitive data
  const exportConfig = { ...config };
  if (exportConfig.apiKeys) {
    exportConfig.apiKeys = Object.fromEntries(
      Object.entries(exportConfig.apiKeys).map(([key, value]) => [
        key,
        value ? '***hidden***' : undefined,
      ]),
    );
  }

  await fs.writeFile(absolutePath, JSON.stringify(exportConfig, null, 2));
  console.log(chalk.green(`✅ Configuration exported to ${absolutePath}`));
}

async function importConfig(importPath: string): Promise<void> {
  const absolutePath = path.resolve(importPath);

  try {
    const content = await fs.readFile(absolutePath, 'utf8');
    const importedConfig = JSON.parse(content) as Record<string, unknown>;

    // Merge with existing config (preserve API keys)
    const currentConfig = await loadConfig();
    const mergedConfig = {
      ...importedConfig,
      apiKeys: currentConfig.apiKeys, // Preserve existing API keys
    };

    await saveConfig(mergedConfig);
    console.log(chalk.green(`✅ Configuration imported from ${absolutePath}`));
  } catch (error: unknown) {
    console.error(chalk.red(`Failed to import configuration: ${error}`));
    process.exit(1);
  }
}

async function showConfigMenu(): Promise<void> {
  console.log(chalk.blue.bold('\n⚙️  MARIA CODE Configuration\n'));

  const { action } = await prompts({
    type: 'select',
    name: 'action',
    message: 'What would you like to configure?',
    choices: [
      { title: '🤖 AI Providers', value: 'providers' },
      { title: '🎨 Preferences', value: 'preferences' },
      { title: '✏️  Editor Settings', value: 'editor' },
      { title: '🔀 Git Settings', value: 'git' },
      { title: '📁 Paths', value: 'paths' },
      { title: '📋 View All', value: 'list' },
      { title: '🔄 Reset to Defaults', value: 'reset' },
      { title: '❌ Exit', value: 'exit' },
    ],
  });

  switch (action) {
    case 'providers':
      await configureProviders();
      break;
    case 'preferences':
      await configurePreferences();
      break;
    case 'editor':
      await configureEditor();
      break;
    case 'git':
      await configureGit();
      break;
    case 'paths':
      await configurePaths();
      break;
    case 'list':
      await listConfig();
      break;
    case 'reset': {
      const { confirm } = await prompts({
        type: 'confirm',
        name: 'confirm',
        message: 'Reset all settings to defaults?',
        initial: false,
      });
      if (confirm) {
        await resetConfig();
        console.log(chalk.green('✅ Configuration reset'));
      }
      break;
    }
    case 'exit':
      break;
  }
}

async function configureProviders(): Promise<void> {
  const config = await loadConfig();

  const { provider, model } = await prompts([
    {
      type: 'select',
      name: 'provider',
      message: 'Default AI provider',
      choices: [
        { title: 'OpenAI', value: 'openai' },
        { title: 'Anthropic', value: 'anthropic' },
        { title: 'Google', value: 'google' },
        { title: 'Groq', value: 'groq' },
        { title: 'LM Studio (Local)', value: 'lmstudio' },
      ],
      initial: config.defaultProvider,
    },
    {
      type: 'text',
      name: 'model',
      message: 'Default model',
      initial: config.defaultModel,
    },
  ]);

  config['defaultProvider'] = provider;
  config['defaultModel'] = model;

  await saveConfig(config);
  console.log(chalk.green('✅ Provider settings updated'));
}

async function configurePreferences(): Promise<void> {
  const config = await loadConfig();

  const preferences = await prompts([
    {
      type: 'select',
      name: 'theme',
      message: 'Theme',
      choices: [
        { title: 'Dark', value: 'dark' },
        { title: 'Light', value: 'light' },
        { title: 'Auto', value: 'auto' },
      ],
      initial: config.preferences?.theme,
    },
    {
      type: 'select',
      name: 'language',
      message: 'Language',
      choices: [
        { title: 'English', value: 'en' },
        { title: '日本語', value: 'ja' },
        { title: '中文', value: 'zh' },
      ],
      initial: config.preferences?.language || 'en',
    },
    {
      type: 'confirm',
      name: 'autoSave',
      message: 'Auto-save enabled?',
      initial: config.preferences?.autoSave !== false,
    },
    {
      type: 'confirm',
      name: 'experimental',
      message: 'Enable experimental features?',
      initial: config.preferences?.experimental || false,
    },
  ]);

  config['preferences'] = { ...config.preferences, ...preferences };

  await saveConfig(config);
  console.log(chalk.green('✅ Preferences updated'));
}

async function configureEditor(): Promise<void> {
  const config = await loadConfig();

  const editor = await prompts([
    {
      type: 'number',
      name: 'tabSize',
      message: 'Tab size',
      initial: config.editor?.tabSize || 2,
      min: 1,
      max: 8,
    },
    {
      type: 'confirm',
      name: 'useTabs',
      message: 'Use tabs instead of spaces?',
      initial: config.editor?.useTabs || false,
    },
    {
      type: 'confirm',
      name: 'wordWrap',
      message: 'Word wrap enabled?',
      initial: config.editor?.wordWrap !== false,
    },
    {
      type: 'confirm',
      name: 'formatOnSave',
      message: 'Format on save?',
      initial: config.editor?.formatOnSave !== false,
    },
  ]);

  config['editor'] = { ...config.editor, ...editor };

  await saveConfig(config);
  console.log(chalk.green('✅ Editor settings updated'));
}

async function configureGit(): Promise<void> {
  const config = await loadConfig();

  const git = await prompts([
    {
      type: 'confirm',
      name: 'autoCommit',
      message: 'Auto-commit changes?',
      initial: config.git?.autoCommit || false,
    },
    {
      type: 'confirm',
      name: 'signCommits',
      message: 'Sign commits?',
      initial: config.git?.signCommits || false,
    },
    {
      type: 'confirm',
      name: 'pushAfterCommit',
      message: 'Push after commit?',
      initial: config.git?.pushAfterCommit || false,
    },
  ]);

  config['git'] = { ...config.git, ...git };

  await saveConfig(config);
  console.log(chalk.green('✅ Git settings updated'));
}

async function configurePaths(): Promise<void> {
  const config = await loadConfig();

  const paths = await prompts([
    {
      type: 'text',
      name: 'projectsDir',
      message: 'Projects directory',
      initial: config.paths?.projectsDir || path.join(os.homedir(), 'Projects'),
    },
    {
      type: 'text',
      name: 'templatesDir',
      message: 'Templates directory',
      initial: config.paths?.templatesDir || path.join(os.homedir(), '.maria', 'templates'),
    },
    {
      type: 'text',
      name: 'logsDir',
      message: 'Logs directory',
      initial: config.paths?.logsDir || path.join(os.homedir(), '.maria', 'logs'),
    },
  ]);

  config['paths'] = { ...config.paths, ...paths };

  await saveConfig(config);
  console.log(chalk.green('✅ Path settings updated'));
}

export default configCommand;
