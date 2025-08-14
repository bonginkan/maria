/**
 * Command Groups and Categories
 * Organize commands into logical groups for better UX
 */

export interface CommandInfo {
  name: string;
  description: string;
  category: CommandCategory;
  aliases?: string[];
  usage?: string;
  examples?: string[];
}

export type CommandCategory =
  | 'core'
  | 'generation'
  | 'analysis'
  | 'configuration'
  | 'development'
  | 'media'
  | 'system';

export const commandCategories: Record<CommandCategory, string> = {
  core: 'Core Commands',
  generation: 'Content Generation',
  analysis: 'Analysis & Review',
  configuration: 'Configuration',
  development: 'Development Tools',
  media: 'Media Generation',
  system: 'System & Diagnostics',
};

export const commandInfo: Record<string, CommandInfo> = {
  // Core commands
  chat: {
    name: 'chat',
    description: 'Start interactive chat session',
    category: 'core',
    usage: '/chat [message]',
    examples: ['/chat', '/chat Hello, how can you help?'],
  },
  clear: {
    name: 'clear',
    description: 'Clear conversation context',
    category: 'core',
    usage: '/clear',
    examples: ['/clear'],
  },
  help: {
    name: 'help',
    description: 'Show help information',
    category: 'core',
    usage: '/help [command]',
    examples: ['/help', '/help code'],
  },
  exit: {
    name: 'exit',
    description: 'Exit the application',
    category: 'core',
    usage: '/exit',
    examples: ['/exit'],
  },

  // Generation commands
  code: {
    name: 'code',
    description: 'Generate code with AI assistance',
    category: 'generation',
    usage: '/code [prompt]',
    examples: ['/code Create a React component', '/code Write a Python function to sort arrays'],
  },
  image: {
    name: 'image',
    description: 'Generate images with AI',
    category: 'media',
    usage: '/image [prompt]',
    examples: ['/image A sunset over mountains', '/image Logo design for tech company'],
  },
  video: {
    name: 'video',
    description: 'Generate videos with AI',
    category: 'media',
    usage: '/video [prompt]',
    examples: ['/video A car driving through city', '/video Product demo animation'],
  },

  // Analysis commands
  review: {
    name: 'review',
    description: 'Review code or pull requests',
    category: 'analysis',
    usage: '/review [file|url]',
    examples: ['/review src/app.ts', '/review https://github.com/user/repo/pull/123'],
  },
  test: {
    name: 'test',
    description: 'Generate tests for code',
    category: 'development',
    usage: '/test [file|function]',
    examples: ['/test src/utils.ts', '/test calculateTotal function'],
  },
  bug: {
    name: 'bug',
    description: 'Detect and fix bugs',
    category: 'development',
    usage: '/bug [description]',
    examples: ['/bug Function returns undefined', '/bug Memory leak in component'],
  },

  // Configuration commands
  config: {
    name: 'config',
    description: 'Manage configuration settings',
    category: 'configuration',
    usage: '/config [key] [value]',
    examples: ['/config', '/config model gpt-4', '/config temperature 0.7'],
  },
  model: {
    name: 'model',
    description: 'Select AI model',
    category: 'configuration',
    usage: '/model [model-name]',
    examples: ['/model', '/model gpt-4', '/model claude-3'],
  },
  init: {
    name: 'init',
    description: 'Initialize project configuration',
    category: 'configuration',
    usage: '/init',
    examples: ['/init'],
  },

  // System commands
  status: {
    name: 'status',
    description: 'Show system status',
    category: 'system',
    usage: '/status',
    examples: ['/status'],
  },
  doctor: {
    name: 'doctor',
    description: 'Run system diagnostics',
    category: 'system',
    usage: '/doctor',
    examples: ['/doctor'],
  },
  cost: {
    name: 'cost',
    description: 'Show usage costs',
    category: 'system',
    usage: '/cost',
    examples: ['/cost'],
  },
};

export function getCommandsByCategory(category: CommandCategory): CommandInfo[] {
  return Object.values(commandInfo).filter((cmd) => cmd.category === category);
}

export function getCommandInfo(commandName: string): CommandInfo | undefined {
  return commandInfo[commandName];
}

export function getRelatedCommands(commandName: string): CommandInfo[] {
  const command = commandInfo[commandName];
  if (!command) return [];

  return Object.values(commandInfo)
    .filter((cmd) => cmd.category === command.category && cmd.name !== commandName)
    .slice(0, 3);
}

export interface CommandChain {
  id: string;
  name: string;
  description: string;
  commands: string[];
}

export const commandChains: CommandChain[] = [
  {
    id: 'code-review-flow',
    name: 'Code Review Flow',
    description: 'Complete code review process',
    commands: ['review', 'test', 'bug'],
  },
  {
    id: 'project-setup',
    name: 'Project Setup',
    description: 'Initialize new project',
    commands: ['init', 'config', 'model'],
  },
  {
    id: 'media-generation',
    name: 'Media Generation',
    description: 'Create visual content',
    commands: ['image', 'video'],
  },
];

export function getCommandChain(chainId: string): CommandChain | undefined {
  return commandChains.find((chain) => chain.id === chainId);
}
