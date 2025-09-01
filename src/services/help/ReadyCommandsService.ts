/**
 * READY Commands Service
 * Phase 3: Dynamic help system that only shows contract-validated READY commands
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ReadyManifest, ReadyCommand, CommandStatus } from '../../types/CommandReadiness';

export interface CommandSearchResult {
  command: ReadyCommand;
  matchScore: number;
  matchReasons: string[];
}

export interface CategoryInfo {
  name: string;
  emoji: string;
  commands: ReadyCommand[];
  count: number;
}

export class ReadyCommandsService {
  private readyCommands: ReadyCommand[] = [];
  private commandsByName = new Map<string, ReadyCommand>();
  private commandsByCategory = new Map<string, ReadyCommand[]>();
  private lastLoaded: Date | null = null;
  private manifestPath: string;

  constructor(manifestPath?: string) {
    if (manifestPath) {
      this.manifestPath = manifestPath;
    } else {
      // Try multiple possible locations for the manifest file
      const possiblePaths = [
        path.join(__dirname, '../../../src/slash-commands/READY.manifest.json'),
        path.join(__dirname, '../../slash-commands/READY.manifest.json'),
        path.join(process.cwd(), 'src/slash-commands/READY.manifest.json'),
        path.join(process.cwd(), 'READY.manifest.json'),
      ];
      
      // Use the first path that exists, or default to the first one
      this.manifestPath = possiblePaths[0];
    }
  }

  /**
   * Find the correct path for the manifest file
   */
  private async findManifestPath(): Promise<void> {
    const possiblePaths = [
      path.join(__dirname, '../../../src/slash-commands/READY.manifest.json'),
      path.join(__dirname, '../../slash-commands/READY.manifest.json'),
      path.join(process.cwd(), 'src/slash-commands/READY.manifest.json'),
      path.join(process.cwd(), 'READY.manifest.json'),
      // Additional paths for different build scenarios
      path.resolve(__dirname, '../../../src/slash-commands/READY.manifest.json'),
      path.resolve(process.cwd(), 'src/slash-commands/READY.manifest.json'),
    ];
    
    for (const testPath of possiblePaths) {
      try {
        await fs.access(testPath);
        this.manifestPath = testPath;
        return;
      } catch {
        // File doesn't exist, try next path
        continue;
      }
    }
    
    // If none found, keep the original path (will fail with proper error message)
  }

  /**
   * Load READY commands from manifest
   */
  async loadReadyCommands(): Promise<void> {
    try {
      // Find the correct manifest file path
      await this.findManifestPath();
      
      // Try to load from existing manifest first
      const content = await fs.readFile(this.manifestPath, 'utf-8');
      const manifest = JSON.parse(content);
      
      // Handle current READY.manifest.json format (commands as object)
      if (manifest.commands && typeof manifest.commands === 'object' && !Array.isArray(manifest.commands)) {
        // Convert object format to ReadyCommand array with hardcoded descriptions
        this.readyCommands = this.convertObjectToReadyCommands(manifest.commands);
      } else if (manifest.commands && Array.isArray(manifest.commands)) {
        // Handle array format
        this.readyCommands = manifest.commands.filter((cmd: any) => 
          cmd.status === CommandStatus.READY
        );
      } else {
        // Fallback: use hardcoded commands
        this.readyCommands = this.getFallbackCommands();
      }
      
      // Build lookup maps
      this.buildLookupMaps();
      this.lastLoaded = new Date();
      
      console.log(`📋 Loaded ${this.readyCommands.length} READY commands from manifest`);
      
    } catch (error) {
      console.error('Failed to load READY commands manifest, using fallback:', error);
      // Use fallback commands
      this.readyCommands = this.getFallbackCommands();
      this.buildLookupMaps();
      this.lastLoaded = new Date();
    }
  }

  /**
   * Convert object-format commands to ReadyCommand array
   */
  private convertObjectToReadyCommands(commandsObj: Record<string, any>): ReadyCommand[] {
    const commands: ReadyCommand[] = [];
    const descriptions = this.getCommandDescriptions();
    
    for (const [key, cmd] of Object.entries(commandsObj)) {
      if (cmd.status === 'READY') {
        const commandName = key.includes('/') ? key.split('/').pop() || key : key;
        const category = key.includes('/') ? key.split('/')[0] : 'other';
        
        commands.push({
          name: commandName,
          category: category,
          aliases: [],
          description: descriptions[commandName] || 'No description',
          usage: `/${commandName} [options]`,
          examples: [`/${commandName}`],
          status: CommandStatus.READY,
          contract: {
            tty: true,
            nonTty: true,
            pipe: true,
            maxResponseTime: 1000
          }
        });
      }
    }
    
    return commands;
  }

  /**
   * Get command descriptions with GPU labels
   */
  private getCommandDescriptions(): Record<string, string> {
    return {
      'help': 'Show this help',
      'version': 'Show version info',
      'clear': 'Clear conversation',
      'exit': 'Exit MARIA',
      'login': 'Sign in to MARIA',
      'logout': 'Sign out',
      'usage': 'Check usage quota',
      'plan': 'View subscription',
      'code': 'Generate code with AI',
      'remember': 'Store memories',
      'recall': 'Retrieve memories',
      'forget': 'Delete memories',
      'memory-status': 'Show memory usage statistics and health',
      'config': 'Configuration',
      'model': 'Model selection',
      'setup': 'First-time environment setup wizard',
      'permissions': 'Manage permissions and access control',
      'update': 'Update project dependencies and configurations',
      'upgrade': 'Upgrade MARIA to latest version',
      'language': 'Multilingual operations and translation',
      'evaluate': 'Evaluate and test AI model performance',
      'terminal-setup': 'Setup terminal integration',
      // GPU-requiring commands with Pro+ labels
      'gpu': 'GPU management and monitoring *GPU needed - Local LLM only (Pro+ members only)',
      'l2r': 'Learning-to-Rank machine learning system *GPU needed - Local LLM only (Pro+ members only)',
      'search': 'GraphRAG hybrid search engine *GPU needed - Local LLM only (Pro+ members only)',
      'llm': 'Advanced LLM management and operations *GPU needed - Local LLM only (Pro+ members only)',
      'evolve': 'Autonomous system evolution controls *GPU needed - Local LLM only (Pro+ members only)',
    };
  }

  /**
   * Get fallback commands if manifest loading fails
   */
  private getFallbackCommands(): ReadyCommand[] {
    const descriptions = this.getCommandDescriptions();
    const readyCommandNames = [
      'help', 'clear', 'version', 'exit', 'login', 'logout', 'usage', 'plan', 
      'code', 'remember', 'recall', 'forget', 'memory-status', 'config', 'model', 
      'setup', 'permissions', 'update', 'upgrade', 'language', 'evaluate', 
      'terminal-setup', 'gpu', 'l2r', 'search'
    ];
    
    return readyCommandNames.map(name => ({
      name,
      category: this.getCategoryForCommand(name),
      aliases: [],
      description: descriptions[name] || 'No description',
      usage: `/${name} [options]`,
      examples: [`/${name}`],
      status: CommandStatus.READY,
      contract: {
        tty: true,
        nonTty: true,
        pipe: true,
        maxResponseTime: 1000
      }
    }));
  }

  /**
   * Get category for a command
   */
  private getCategoryForCommand(name: string): string {
    const categoryMap: Record<string, string> = {
      'help': 'core',
      'clear': 'core',
      'version': 'core',
      'exit': 'core',
      'update': 'core',
      'login': 'auth',
      'logout': 'auth',
      'usage': 'auth',
      'plan': 'auth',
      'code': 'generation',
      'remember': 'memory',
      'recall': 'memory',
      'forget': 'memory',
      'memory-status': 'memory',
      'config': 'configuration',
      'model': 'configuration',
      'setup': 'configuration',
      'permissions': 'configuration',
      'upgrade': 'system',
      'terminal-setup': 'system',
      'language': 'multilingual',
      'evaluate': 'evaluation',
      'gpu': 'ai',
      'l2r': 'learning',
      'search': 'graphrag',
      'llm': 'ai',
      'evolve': 'evolution',
    };
    return categoryMap[name] || 'other';
  }

  /**
   * Build internal lookup maps for fast access
   */
  private buildLookupMaps(): void {
    this.commandsByName.clear();
    this.commandsByCategory.clear();

    for (const command of this.readyCommands) {
      // By name (including aliases)
      this.commandsByName.set(command.name, command);
      
      // Include aliases
      for (const alias of command.aliases || []) {
        this.commandsByName.set(alias, command);
      }

      // By category
      if (!this.commandsByCategory.has(command.category)) {
        this.commandsByCategory.set(command.category, []);
      }
      this.commandsByCategory.get(command.category)!.push(command);
    }

    // Sort commands within each category
    for (const [, commands] of this.commandsByCategory) {
      commands.sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  /**
   * Get all READY commands
   */
  async getAllReadyCommands(): Promise<ReadyCommand[]> {
    if (this.readyCommands.length === 0) {
      await this.loadReadyCommands();
    }
    return [...this.readyCommands];
  }

  /**
   * Get command by name or alias
   */
  async getCommand(nameOrAlias: string): Promise<ReadyCommand | null> {
    if (this.readyCommands.length === 0) {
      await this.loadReadyCommands();
    }

    // Remove leading slash if present
    const cleanName = nameOrAlias.startsWith('/') ? nameOrAlias.slice(1) : nameOrAlias;
    return this.commandsByName.get(cleanName) || null;
  }

  /**
   * Get commands by category
   */
  async getCommandsByCategory(category: string): Promise<ReadyCommand[]> {
    if (this.readyCommands.length === 0) {
      await this.loadReadyCommands();
    }
    return this.commandsByCategory.get(category) || [];
  }

  /**
   * Get all available categories with metadata
   */
  async getCategories(): Promise<CategoryInfo[]> {
    if (this.readyCommands.length === 0) {
      await this.loadReadyCommands();
    }

    const categories: CategoryInfo[] = [];
    
    for (const [categoryName, commands] of this.commandsByCategory) {
      categories.push({
        name: categoryName,
        emoji: "", // Remove emojis for simplicity
        commands,
        count: commands.length
      });
    }

    // Sort by priority, then by name
    categories.sort((a, b) => {
      const aPriority = this.getCategoryPriority(a.name);
      const bPriority = this.getCategoryPriority(b.name);
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      return a.name.localeCompare(b.name);
    });

    return categories;
  }

  /**
   * Search commands with fuzzy matching
   */
  async searchCommands(searchTerm: string, maxResults: number = 10): Promise<CommandSearchResult[]> {
    if (this.readyCommands.length === 0) {
      await this.loadReadyCommands();
    }

    const term = searchTerm.toLowerCase();
    const results: CommandSearchResult[] = [];

    for (const command of this.readyCommands) {
      const matchResult = this.calculateMatchScore(command, term);
      
      if (matchResult.score > 0) {
        results.push({
          command,
          matchScore: matchResult.score,
          matchReasons: matchResult.reasons
        });
      }
    }

    // Sort by match score (highest first)
    results.sort((a, b) => b.matchScore - a.matchScore);

    return results.slice(0, maxResults);
  }

  /**
   * Calculate match score for search
   */
  private calculateMatchScore(command: ReadyCommand, searchTerm: string): { score: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;

    // Exact name match (highest priority)
    if (command.name.toLowerCase() === searchTerm) {
      score += 100;
      reasons.push('exact name match');
    }
    // Name starts with term
    else if (command.name.toLowerCase().startsWith(searchTerm)) {
      score += 80;
      reasons.push('name starts with search term');
    }
    // Name contains term
    else if (command.name.toLowerCase().includes(searchTerm)) {
      score += 60;
      reasons.push('name contains search term');
    }

    // Alias matches
    for (const alias of command.aliases || []) {
      if (alias.toLowerCase() === searchTerm) {
        score += 90;
        reasons.push('exact alias match');
        break;
      } else if (alias.toLowerCase().startsWith(searchTerm)) {
        score += 70;
        reasons.push('alias starts with search term');
        break;
      } else if (alias.toLowerCase().includes(searchTerm)) {
        score += 50;
        reasons.push('alias contains search term');
        break;
      }
    }

    // Description matches
    const desc = command.description.toLowerCase();
    if (desc.includes(searchTerm)) {
      // More points for matches early in description
      const index = desc.indexOf(searchTerm);
      const descriptionScore = Math.max(20, 40 - index);
      score += descriptionScore;
      reasons.push('description contains search term');
    }

    // Category match
    if (command.category.toLowerCase().includes(searchTerm)) {
      score += 30;
      reasons.push('category matches');
    }

    // Fuzzy matching for typos (Levenshtein distance)
    if (score === 0 && searchTerm.length > 2) {
      const distance = this.levenshteinDistance(command.name.toLowerCase(), searchTerm);
      if (distance <= 2) { // Allow up to 2 typos
        score += Math.max(10, 25 - distance * 5);
        reasons.push('fuzzy match (typo tolerance)');
      }
    }

    return { score, reasons };
  }

  /**
   * Calculate Levenshtein distance for fuzzy matching
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Get category emoji
   */
  private getCategoryEmoji(category: string): string {
    const emojiMap: Record<string, string> = {
      core: "⚡",
      system: "🛠️", 
      configuration: "⚙️",
      ai: "🤖",
      code: "💻",
      memory: "🧠",
      business: "💼",
      research: "📚",
      monitoring: "📊",
      optimization: "⚡",
      creative: "🎨",
      graphrag: "🔍",
      evolution: "🚀",
      evaluation: "🧪",
      multilingual: "🌍",
      learning: "📖",
      multimodal: "🎬",
      product: "📦",
      implementation: "💻"
    };

    return emojiMap[category] || "📋";
  }

  /**
   * Get category priority for sorting (lower = higher priority)
   */
  private getCategoryPriority(category: string): number {
    const priorities: Record<string, number> = {
      core: 1,        // Most important
      code: 2,        // Core functionality  
      configuration: 3, // Setup & config
      ai: 4,          // AI operations
      memory: 5,      // Memory management
      system: 6,      // System tools
      business: 7,    // Business features
      research: 8,    // Research tools
      monitoring: 9,  // Monitoring
      optimization: 10, // Performance
      creative: 11,   // Creative features
    };

    return priorities[category] || 99; // Unknown categories go to end
  }

  /**
   * Get quick start commands (most essential)
   */
  async getQuickStartCommands(): Promise<ReadyCommand[]> {
    const essential = ['help', 'code', 'model', 'status', 'config'];
    const commands: ReadyCommand[] = [];
    
    for (const name of essential) {
      const cmd = await this.getCommand(name);
      if (cmd) {
        commands.push(cmd);
      }
    }
    
    return commands;
  }

  /**
   * Get statistics about READY commands
   */
  async getStatistics(): Promise<{
    totalReady: number;
    categoriesCount: number;
    avgResponseTime: number;
    fastestCommand: string;
    slowestCommand: string;
    lastUpdated: Date | null;
  }> {
    if (this.readyCommands.length === 0) {
      await this.loadReadyCommands();
    }

    const responseTimes = this.readyCommands.map(cmd => cmd.contract.maxResponseTime);
    const avgResponseTime = Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length);
    
    const fastest = this.readyCommands.reduce((prev, curr) => 
      curr.contract.maxResponseTime < prev.contract.maxResponseTime ? curr : prev
    );
    
    const slowest = this.readyCommands.reduce((prev, curr) => 
      curr.contract.maxResponseTime > prev.contract.maxResponseTime ? curr : prev
    );

    return {
      totalReady: this.readyCommands.length,
      categoriesCount: this.commandsByCategory.size,
      avgResponseTime,
      fastestCommand: fastest.name,
      slowestCommand: slowest.name,
      lastUpdated: this.lastLoaded
    };
  }

  /**
   * Refresh commands from manifest (for runtime updates)
   */
  async refresh(): Promise<void> {
    await this.loadReadyCommands();
  }

  /**
   * Check if service is initialized
   */
  isLoaded(): boolean {
    return this.readyCommands.length > 0 && this.lastLoaded !== null;
  }
}

export default ReadyCommandsService;