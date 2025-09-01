/**
 * Extension Guard
 * Enforces file extension restrictions based on user plan
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import { PlanViolationError, PlanFileSaveConfig } from '../types/filename-inference.types';

export class ExtensionGuard {
  private readonly plansConfigPath: string;
  private plansCache: Map<string, PlanFileSaveConfig> = new Map();
  private lastCacheUpdate: number = 0;
  private readonly cacheTimeout = 60000; // 1 minute cache
  
  constructor(configPath?: string) {
    this.plansConfigPath = configPath || path.join(process.cwd(), 'FIRESTORE_PLANS_CONFIG.json');
  }
  
  /**
   * Checks if an extension is allowed for a given plan
   */
  async checkPermission(planId: string, extension: string): Promise<void> {
    const plan = await this.getPlanConfig(planId);
    
    if (!plan?.fileSave?.allowExtensions) {
      throw new PlanViolationError(`Plan ${planId} configuration not found`);
    }
    
    // Normalize extension (remove leading dot, lowercase)
    const ext = extension.toLowerCase().replace(/^\./, '');
    
    // Check if extension is allowed
    if (!plan.fileSave.allowExtensions.includes(ext)) {
      const allowed = plan.fileSave.allowExtensions
        .slice(0, 10)
        .join(', ');
      const more = plan.fileSave.allowExtensions.length > 10 
        ? ` and ${plan.fileSave.allowExtensions.length - 10} more`
        : '';
        
      throw new PlanViolationError(
        `Extension '.${ext}' not allowed in ${planId} plan. ` +
        `Allowed extensions: ${allowed}${more}`
      );
    }
  }
  
  /**
   * Checks file size against plan limits
   */
  async checkFileSize(planId: string, contentLength: number): Promise<void> {
    const plan = await this.getPlanConfig(planId);
    
    if (!plan?.fileSave?.maxFileSizeMB) {
      return; // No size limit configured
    }
    
    const sizeMB = contentLength / (1024 * 1024);
    if (sizeMB > plan.fileSave.maxFileSizeMB) {
      throw new PlanViolationError(
        `File size ${sizeMB.toFixed(2)}MB exceeds ${planId} plan limit of ${plan.fileSave.maxFileSizeMB}MB`
      );
    }
  }
  
  /**
   * Gets the default directory for a plan
   */
  async getDefaultDirectory(planId: string): Promise<string> {
    const plan = await this.getPlanConfig(planId);
    return plan?.fileSave?.defaultDir || '.';
  }
  
  /**
   * Gets the naming convention for a plan
   */
  async getNamingConvention(planId: string): Promise<string> {
    const plan = await this.getPlanConfig(planId);
    return plan?.naming?.convention || 'kebab-case';
  }
  
  /**
   * Gets directory mapping for a file type
   */
  async getDirectoryForType(planId: string, fileType: string): Promise<string | undefined> {
    const plan = await this.getPlanConfig(planId);
    return plan?.dirs?.[fileType];
  }
  
  /**
   * Loads plan configuration from file or cache
   */
  private async getPlanConfig(planId: string): Promise<PlanFileSaveConfig | undefined> {
    // Check cache
    if (this.plansCache.has(planId) && Date.now() - this.lastCacheUpdate < this.cacheTimeout) {
      return this.plansCache.get(planId);
    }
    
    // Load from file
    try {
      if (!fs.existsSync(this.plansConfigPath)) {
        // Use default configuration if file doesn't exist
        return this.getDefaultPlanConfig(planId);
      }
      
      const configContent = fs.readFileSync(this.plansConfigPath, 'utf-8');
      const allPlans = JSON.parse(configContent);
      
      // Update cache
      for (const [id, config] of Object.entries(allPlans)) {
        this.plansCache.set(id, config as PlanFileSaveConfig);
      }
      this.lastCacheUpdate = Date.now();
      
      return this.plansCache.get(planId);
    } catch (error) {
      console.error(`Failed to load plan config: ${error}`);
      return this.getDefaultPlanConfig(planId);
    }
  }
  
  /**
   * Returns default plan configuration
   */
  private getDefaultPlanConfig(planId: string): PlanFileSaveConfig {
    const defaults: Record<string, PlanFileSaveConfig> = {
      FREE: {
        fileSave: {
          allowExtensions: [
            'txt', 'md', 'json', 'html', 'css', 'js', 'ts', 'tsx', 'jsx'
          ],
          maxFileSizeMB: 5,
          defaultDir: '.'
        },
        naming: {
          convention: 'kebab-case'
        },
        dirs: {
          components: 'src/components',
          pages: 'src/pages',
          utils: 'src/utils',
          styles: 'src/styles',
          api: 'src/api'
        }
      },
      STARTER: {
        fileSave: {
          allowExtensions: [
            'txt', 'md', 'json', 'html', 'css', 'js', 'ts', 'tsx', 'jsx',
            'py', 'yml', 'yaml', 'sql', 'sh', 'dockerfile'
          ],
          maxFileSizeMB: 20,
          defaultDir: '.'
        },
        naming: {
          convention: 'kebab-case'
        },
        dirs: {
          components: 'src/components',
          pages: 'src/pages',
          utils: 'src/utils',
          styles: 'src/styles',
          api: 'src/api'
        }
      },
      PRO: {
        fileSave: {
          allowExtensions: [
            'txt', 'md', 'json', 'html', 'css', 'js', 'ts', 'tsx', 'jsx',
            'py', 'yml', 'yaml', 'sql', 'sh', 'dockerfile', 'rs', 'go',
            'java', 'kt', 'swift', 'cpp', 'c', 'h', 'rb', 'php'
          ],
          maxFileSizeMB: 50,
          defaultDir: '.'
        },
        naming: {
          convention: 'kebab-case'
        },
        dirs: {
          components: 'src/components',
          pages: 'src/pages',
          utils: 'src/utils',
          styles: 'src/styles',
          api: 'src/api'
        }
      },
      ULTRA: {
        fileSave: {
          allowExtensions: [
            'txt', 'md', 'json', 'html', 'css', 'js', 'ts', 'tsx', 'jsx',
            'py', 'yml', 'yaml', 'sql', 'sh', 'dockerfile', 'rs', 'go',
            'java', 'kt', 'swift', 'cpp', 'c', 'h', 'rb', 'php',
            'wasm', 'wat', 'graphql', 'proto', 'ipynb', 'parquet'
          ],
          maxFileSizeMB: 100,
          defaultDir: '.'
        },
        naming: {
          convention: 'kebab-case'
        },
        dirs: {
          components: 'src/components',
          pages: 'src/pages',
          utils: 'src/utils',
          styles: 'src/styles',
          api: 'src/api'
        }
      }
    };
    
    return defaults[planId] || defaults.FREE;
  }
  
  /**
   * Gets a list of dangerous extensions that should never be allowed
   */
  getDangerousExtensions(): string[] {
    return [
      'exe', 'dll', 'so', 'dylib', 'sys', 'drv',
      'scr', 'vbs', 'vbe', 'jse', 'ws', 'wsf',
      'msi', 'msp', 'com', 'pif', 'gadget',
      'app', 'dmg', 'pkg', 'deb', 'rpm',
      'iso', 'img', 'vhd', 'vmdk',
      'key', 'pem', 'p12', 'pfx', 'cer', 'crt',
      'gpg', 'asc', 'ssh', 'pub'
    ];
  }
  
  /**
   * Checks if an extension is dangerous
   */
  isDangerousExtension(extension: string): boolean {
    const ext = extension.toLowerCase().replace(/^\./, '');
    // Add common script extensions to dangerous list
    const additionalDangerous = ['sh', 'bat', 'cmd', 'ps1'];
    return this.getDangerousExtensions().includes(ext) || additionalDangerous.includes(ext);
  }
}