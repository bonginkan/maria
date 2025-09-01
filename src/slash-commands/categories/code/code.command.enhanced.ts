/**
 * Enhanced Code Command with Intelligent Filename Inference
 * Integrates Phase 1-3 implementations: Security, Inference, and UX
 */

import { BaseCommand } from "../../base-command.js";
import {
  CommandArgs,
  CommandContext,
  CommandResult,
  CommandExample,
} from "../../types";
import { 
  FilenameUXOrchestrator,
  UXOptions,
  FilenameInferenceService,
  ProjectContext,
  filenameInferenceTelemetry
} from "../../../services/code-intent/index.js";
import * as path from "path";
import * as fs from "fs";

interface CodeCommandOptions {
  dryRun?: boolean;
  preview?: boolean;
  force?: boolean;
  acceptFirst?: boolean;
  interactive?: boolean;
  verbose?: boolean;
  skipBackup?: boolean;
  customName?: string;
  directory?: string;
}

export class EnhancedCodeCommand extends BaseCommand {
  name = "code";
  category = "code" as const;
  description = "Generate code with intelligent filename inference and safe saving";
  usage = "/code [options] <intent or code request>";
  
  private orchestrator: FilenameUXOrchestrator;
  
  examples: CommandExample[] = [
    {
      input: "/code create a REST API",
      description: "Generate REST API with smart filename inference",
    },
    {
      input: "/code --dry-run React component for user profile",
      description: "Preview filename suggestions without creating files",
    },
    {
      input: "/code --force utility function to validate email",
      description: "Generate and save immediately regardless of confidence",
    },
    {
      input: "/code --interactive create a login form",
      description: "Generate code and choose from filename candidates",
    },
    {
      input: "/code --name=auth.js create authentication module",
      description: "Generate code with explicit filename",
    }
  ];

  constructor() {
    super();
    this.orchestrator = new FilenameUXOrchestrator(process.cwd());
  }

  async execute(
    commandArgs: CommandArgs,
    context: CommandContext,
  ): Promise<CommandResult> {
    const startTime = Date.now();
    
    try {
      // Parse command options and arguments
      const { options, prompt } = this.parseArguments(commandArgs.raw);
      
      if (!prompt.trim()) {
        return this.success("Usage: /code [options] <your request>\n" +
          "Options: --dry-run, --preview, --force, --interactive, --verbose\n" +
          "Example: /code create a React login component");
      }

      // Generate code content
      const code = this.generateCodeContent(prompt);
      
      // Create project context
      const projectContext: ProjectContext = {
        root: process.cwd(),
        planId: this.getUserPlan(context), // Get from context
        config: undefined // Will be loaded by orchestrator
      };

      // Configure UX options
      const uxOptions: UXOptions = this.createUXOptions(options, context);

      if (options.verbose) {
        console.log(`🚀 Generating code for: "${prompt}"`);
        console.log(`📁 Working directory: ${projectContext.root}`);
        console.log(`📋 Plan: ${projectContext.planId}`);
      }

      // Use orchestrator for complete filename inference and saving
      const result = await this.orchestrator.orchestrate(
        prompt,
        code,
        projectContext,
        undefined, // Plan config will be loaded automatically
        uxOptions
      );

      // Record command usage telemetry
      await filenameInferenceTelemetry.recordIntegrationTelemetry({
        command: 'code',
        operation: 'orchestrate',
        mode: result.mode,
        success: result.success,
        processingTime: Date.now() - startTime,
        promptLength: prompt.length,
        codeLength: code.length,
        options: Object.keys(options)
      });

      // Handle results based on save mode
      if (result.dryRun) {
        return this.handleDryRunResult(result, options);
      }

      if (!result.success) {
        return this.handleError(result, options);
      }

      return this.handleSuccessResult(result, code, startTime, options);

    } catch (error) {
      // Record error telemetry
      await filenameInferenceTelemetry.recordIntegrationTelemetry({
        command: 'code',
        operation: 'execute',
        success: false,
        error: (error as Error).message,
        processingTime: Date.now() - startTime
      });

      console.error("Code command error:", error);
      return this.error(`Code generation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Parses command arguments and options
   */
  private parseArguments(rawArgs: string[]): { options: CodeCommandOptions; prompt: string } {
    const options: CodeCommandOptions = {};
    const promptParts: string[] = [];

    for (let i = 0; i < rawArgs.length; i++) {
      const arg = rawArgs[i];

      if (arg.startsWith('--')) {
        const [key, value] = arg.slice(2).split('=');
        
        switch (key) {
          case 'dry-run':
            options.dryRun = true;
            break;
          case 'preview':
            options.preview = true;
            break;
          case 'force':
            options.force = true;
            break;
          case 'accept-first':
            options.acceptFirst = true;
            break;
          case 'interactive':
            options.interactive = true;
            break;
          case 'verbose':
          case 'v':
            options.verbose = true;
            break;
          case 'skip-backup':
            options.skipBackup = true;
            break;
          case 'name':
            options.customName = value || rawArgs[++i];
            break;
          case 'dir':
          case 'directory':
            options.directory = value || rawArgs[++i];
            break;
          default:
            promptParts.push(arg); // Unknown option treated as prompt
        }
      } else {
        promptParts.push(arg);
      }
    }

    return {
      options,
      prompt: promptParts.join(' ').trim()
    };
  }

  /**
   * Generates code content based on the prompt
   */
  private generateCodeContent(prompt: string): string {
    const cleanPrompt = prompt.trim().toLowerCase();
    
    // Enhanced code generation with better templates
    if (cleanPrompt.includes('rest api') || cleanPrompt.includes('api server')) {
      return this.generateRestAPICode(prompt);
    }
    
    if (cleanPrompt.includes('react') || cleanPrompt.includes('component')) {
      return this.generateReactComponentCode(prompt);
    }
    
    if (cleanPrompt.includes('login') || cleanPrompt.includes('auth')) {
      return this.generateAuthCode(prompt);
    }
    
    if (cleanPrompt.includes('function') || cleanPrompt.includes('utility')) {
      return this.generateUtilityCode(prompt);
    }

    if (cleanPrompt.includes('test') || cleanPrompt.includes('spec')) {
      return this.generateTestCode(prompt);
    }

    if (cleanPrompt.includes('html') || cleanPrompt.includes('webpage')) {
      return this.generateHTMLCode(prompt);
    }

    // Default to JavaScript function
    return this.generateGenericCode(prompt);
  }

  private generateRestAPICode(prompt: string): string {
    return `// REST API Server
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.get('/api/v1/users', async (req, res) => {
  try {
    // TODO: Implement user retrieval logic
    const users = []; // Replace with actual data source
    res.json({ 
      success: true, 
      data: users,
      count: users.length 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to retrieve users' 
    });
  }
});

app.post('/api/v1/users', async (req, res) => {
  try {
    const { name, email } = req.body;
    
    // Basic validation
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        error: 'Name and email are required'
      });
    }

    // TODO: Implement user creation logic
    const newUser = { id: Date.now(), name, email };
    
    res.status(201).json({ 
      success: true, 
      data: newUser 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create user' 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    error: 'Something went wrong!' 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Route not found' 
  });
});

app.listen(PORT, () => {
  console.log(\`🚀 Server running on http://localhost:\${PORT}\`);
});

export default app;`;
  }

  private generateReactComponentCode(prompt: string): string {
    const componentName = this.extractComponentName(prompt) || 'MyComponent';
    
    return `import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

interface ${componentName}Props {
  title?: string;
  className?: string;
  onAction?: (data: any) => void;
}

const ${componentName}: React.FC<${componentName}Props> = ({ 
  title = 'Component Title', 
  className = '',
  onAction 
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // TODO: Add initialization logic here
    console.log('${componentName} mounted');
    
    return () => {
      console.log('${componentName} unmounted');
    };
  }, []);

  const handleClick = () => {
    setLoading(true);
    setError(null);
    
    try {
      // TODO: Implement action logic
      const result = { message: 'Action completed' };
      onAction?.(result);
    } catch (err) {
      setError('Action failed');
      console.error('${componentName} error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className={\`error-container \${className}\`}>
        <p className="error-message">Error: {error}</p>
        <button onClick={() => setError(null)}>Try Again</button>
      </div>
    );
  }

  return (
    <div className={\`${componentName.toLowerCase()}-container \${className}\`}>
      <h2>{title}</h2>
      
      <div className="content">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <>
            <p>Component is ready</p>
            <button 
              onClick={handleClick}
              disabled={loading}
              className="action-button"
            >
              {loading ? 'Processing...' : 'Take Action'}
            </button>
          </>
        )}
      </div>
      
      {data && (
        <div className="data-display">
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

${componentName}.propTypes = {
  title: PropTypes.string,
  className: PropTypes.string,
  onAction: PropTypes.func
};

export default ${componentName};`;
  }

  private generateHTMLCode(prompt: string): string {
    const title = this.extractTitle(prompt) || 'My Page';
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(45deg, #4a90e2, #7b68ee);
            color: white;
            padding: 2rem;
            text-align: center;
        }
        
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
        }
        
        .content {
            padding: 2rem;
        }
        
        .card {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 1.5rem;
            margin: 1rem 0;
            border-left: 4px solid #4a90e2;
        }
        
        .button {
            background: #4a90e2;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 1rem;
            transition: all 0.3s ease;
        }
        
        .button:hover {
            background: #357abd;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <h1>${title}</h1>
            <p>Generated with intelligent filename inference</p>
        </header>
        
        <main class="content">
            <div class="card">
                <h2>Welcome</h2>
                <p>This page was generated using the enhanced /code command with intelligent filename inference.</p>
            </div>
            
            <div class="card">
                <h2>Features</h2>
                <ul>
                    <li>Responsive design</li>
                    <li>Modern CSS with gradients</li>
                    <li>Interactive elements</li>
                    <li>Clean, semantic HTML</li>
                </ul>
            </div>
            
            <div class="card">
                <button class="button" onclick="handleClick()">Click Me</button>
            </div>
        </main>
    </div>

    <script>
        function handleClick() {
            alert('Hello from ${title}!');
            console.log('Button clicked at:', new Date().toISOString());
        }
        
        // Add some interactivity
        document.addEventListener('DOMContentLoaded', () => {
            console.log('${title} loaded successfully');
            
            // Animate cards on scroll
            const cards = document.querySelectorAll('.card');
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0)';
                    }
                });
            });
            
            cards.forEach(card => {
                card.style.opacity = '0';
                card.style.transform = 'translateY(20px)';
                card.style.transition = 'all 0.5s ease';
                observer.observe(card);
            });
        });
    </script>
</body>
</html>`;
  }

  private generateAuthCode(prompt: string): string {
    return `// Authentication Module
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

interface User {
  id: string;
  email: string;
  password: string;
  createdAt: Date;
}

interface AuthPayload {
  userId: string;
  email: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const SALT_ROUNDS = 12;

export class AuthService {
  /**
   * Hash password with bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  /**
   * Compare password with hash
   */
  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate JWT token
   */
  static generateToken(payload: AuthPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  }

  /**
   * Verify JWT token
   */
  static verifyToken(token: string): AuthPayload | null {
    try {
      return jwt.verify(token, JWT_SECRET) as AuthPayload;
    } catch {
      return null;
    }
  }

  /**
   * Register new user
   */
  static async register(email: string, password: string): Promise<{ user: User; token: string }> {
    // TODO: Add email validation
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // TODO: Check if user already exists
    const hashedPassword = await this.hashPassword(password);
    
    const user: User = {
      id: Date.now().toString(),
      email,
      password: hashedPassword,
      createdAt: new Date()
    };

    // TODO: Save user to database

    const token = this.generateToken({ userId: user.id, email: user.email });
    
    return { user: { ...user, password: undefined }, token };
  }

  /**
   * Login user
   */
  static async login(email: string, password: string): Promise<{ user: User; token: string }> {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    // TODO: Get user from database
    const user = null; // Replace with actual user lookup

    if (!user || !await this.comparePassword(password, user.password)) {
      throw new Error('Invalid credentials');
    }

    const token = this.generateToken({ userId: user.id, email: user.email });
    
    return { user: { ...user, password: undefined }, token };
  }
}

/**
 * Authentication middleware
 */
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const payload = AuthService.verifyToken(token);
  if (!payload) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  (req as any).user = payload;
  next();
};

// Express routes
export const authRoutes = (app: any) => {
  app.post('/auth/register', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      const result = await AuthService.register(email, password);
      
      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  app.post('/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      const result = await AuthService.login(email, password);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  app.post('/auth/logout', authenticateToken, (req: Request, res: Response) => {
    // TODO: Implement token blacklisting if needed
    res.json({ success: true, message: 'Logged out successfully' });
  });
};`;
  }

  private generateUtilityCode(prompt: string): string {
    return `// Utility Functions Collection

/**
 * Email validation utility
 */
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Password strength checker
 */
export const checkPasswordStrength = (password: string): {
  strength: 'weak' | 'medium' | 'strong';
  score: number;
  suggestions: string[];
} => {
  let score = 0;
  const suggestions: string[] = [];

  if (password.length >= 8) score += 1;
  else suggestions.push('Use at least 8 characters');

  if (/[a-z]/.test(password)) score += 1;
  else suggestions.push('Include lowercase letters');

  if (/[A-Z]/.test(password)) score += 1;
  else suggestions.push('Include uppercase letters');

  if (/\\d/.test(password)) score += 1;
  else suggestions.push('Include numbers');

  if (/[^\\w\\s]/.test(password)) score += 1;
  else suggestions.push('Include special characters');

  const strength = score < 3 ? 'weak' : score < 5 ? 'medium' : 'strong';
  
  return { strength, score, suggestions };
};

/**
 * Debounce function for performance optimization
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  waitMs: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), waitMs);
  };
};

/**
 * Deep clone utility
 */
export const deepClone = <T>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as unknown as T;
  if (typeof obj === 'object') {
    const copy: any = {};
    Object.keys(obj).forEach(key => {
      copy[key] = deepClone((obj as any)[key]);
    });
    return copy;
  }
  return obj;
};

/**
 * Format bytes to human readable string
 */
export const formatBytes = (bytes: number, decimals: number = 2): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
};

/**
 * Generate random string
 */
export const generateRandomString = (length: number = 10): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
};

/**
 * Async retry utility
 */
export const retry = async <T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000
): Promise<T> => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      
      await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
    }
  }
  throw new Error('Max attempts reached');
};

/**
 * URL validation
 */
export const isValidUrl = (urlString: string): boolean => {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};`;
  }

  private generateTestCode(prompt: string): string {
    return `// Test Suite
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// TODO: Import the module you want to test
// import { functionToTest } from './your-module';

describe('Test Suite', () => {
  beforeEach(() => {
    // Setup before each test
    console.log('Setting up test');
  });

  afterEach(() => {
    // Cleanup after each test
    console.log('Cleaning up test');
  });

  describe('Basic functionality', () => {
    it('should work correctly', () => {
      // TODO: Add your test logic here
      expect(true).toBe(true);
    });

    it('should handle edge cases', () => {
      // TODO: Test edge cases
      expect(() => {
        // Code that might throw
      }).not.toThrow();
    });
  });

  describe('Error handling', () => {
    it('should throw appropriate errors', () => {
      expect(() => {
        // Code that should throw
        throw new Error('Test error');
      }).toThrow('Test error');
    });

    it('should handle null/undefined inputs', () => {
      // TODO: Test null/undefined handling
      expect(null).toBeNull();
      expect(undefined).toBeUndefined();
    });
  });

  describe('Async operations', () => {
    it('should handle promises correctly', async () => {
      const result = await Promise.resolve('test');
      expect(result).toBe('test');
    });

    it('should handle async errors', async () => {
      await expect(Promise.reject(new Error('Async error')))
        .rejects.toThrow('Async error');
    });
  });
});`;
  }

  private generateGenericCode(prompt: string): string {
    return `// Generated Code Based on: ${prompt}

/**
 * Main function implementing the requested functionality
 */
export const main = (): void => {
  console.log('Implementing: ${prompt}');
  
  // TODO: Add specific implementation based on requirements
  // This is a template that should be customized
  
  try {
    // Implementation goes here
    console.log('✅ Implementation completed successfully');
  } catch (error) {
    console.error('❌ Implementation failed:', error);
    throw error;
  }
};

/**
 * Helper function
 */
const helper = (input: any): any => {
  // TODO: Implement helper logic
  return input;
};

/**
 * Configuration object
 */
const config = {
  version: '1.0.0',
  description: '${prompt}',
  timestamp: new Date().toISOString()
};

// Export for use
export default {
  main,
  helper,
  config
};

// Auto-run if this file is executed directly
if (require.main === module) {
  main();
}`;
  }

  // Helper methods for extracting context from prompts
  private extractComponentName(prompt: string): string | null {
    const match = prompt.match(/(?:component|create)\s+(?:a\s+)?([A-Z][a-zA-Z]*)/i);
    if (match) {
      return match[1].charAt(0).toUpperCase() + match[1].slice(1);
    }
    
    const words = prompt.split(' ').filter(w => w.length > 2);
    for (const word of words) {
      if (word.charAt(0).toUpperCase() === word.charAt(0) && word.length > 2) {
        return word;
      }
    }
    
    return null;
  }

  private extractTitle(prompt: string): string | null {
    const match = prompt.match(/(?:page|html|website)(?:\s+for|\s+about|\s+titled)?\s+([a-zA-Z\s]+)/i);
    return match ? match[1].trim() : null;
  }

  /**
   * Creates UX options from command options and context
   */
  private createUXOptions(options: CodeCommandOptions, context: CommandContext): UXOptions {
    if (options.dryRun || options.preview) {
      return FilenameUXOrchestrator.createPreset('safe');
    }

    if (options.force) {
      return FilenameUXOrchestrator.createPreset('fast');
    }

    if (process.env.CI) {
      return FilenameUXOrchestrator.createPreset('ci');
    }

    if (options.interactive) {
      return FilenameUXOrchestrator.createPreset('interactive');
    }

    // Default configuration
    return {
      saveMode: {
        acceptFirst: options.acceptFirst,
        interactive: !options.acceptFirst
      },
      verbose: options.verbose || false,
      skipBackup: options.skipBackup || false
    };
  }

  /**
   * Gets user plan from context
   */
  private getUserPlan(context: CommandContext): string {
    // TODO: Extract plan from user context
    // For now, default to FREE
    return process.env.MARIA_USER_PLAN || 'FREE';
  }

  /**
   * Handles dry-run results
   */
  private handleDryRunResult(result: any, options: CodeCommandOptions): CommandResult {
    if (options.verbose) {
      console.log('\n🔍 Dry-run completed - no files created');
    }

    let output = '🔍 Dry-run mode - Files analyzed but not created:\n\n';
    
    if (result.suggested) {
      result.suggested.forEach((candidate: any, index: number) => {
        output += `${index + 1}. ${candidate.filename}\n`;
        output += `   Path: ${candidate.path}\n`;
        output += `   Reasoning: ${candidate.reasoning}\n\n`;
      });
    }

    output += '💡 Use --force to save files anyway\n';
    output += '💡 Use --interactive to choose from candidates';

    return this.success(output);
  }

  /**
   * Handles error results
   */
  private handleError(result: any, options: CodeCommandOptions): CommandResult {
    let output = `❌ Failed to save file: ${result.error}\n\n`;
    
    if (result.suggested) {
      output += 'Suggested filenames:\n';
      result.suggested.forEach((candidate: any, index: number) => {
        output += `${index + 1}. ${candidate.filename} (${candidate.reasoning})\n`;
      });
    }

    if (result.warnings && result.warnings.length > 0) {
      output += '\nWarnings:\n';
      result.warnings.forEach((warning: string) => {
        output += `⚠️  ${warning}\n`;
      });
    }

    return this.error(output);
  }

  /**
   * Handles successful save results
   */
  private handleSuccessResult(result: any, code: string, startTime: number, options: CodeCommandOptions): CommandResult {
    const duration = Date.now() - startTime;
    
    if (options.verbose) {
      console.log(`\n✅ File saved successfully in ${duration}ms`);
      if (result.undoId) {
        console.log(`💾 Undo ID: ${result.undoId}`);
        console.log('💡 Use /undo to revert this operation');
      }
    }

    // Display the generated code
    console.log('\n📝 Generated Code:');
    console.log('─'.repeat(50));
    console.log(code);
    console.log('─'.repeat(50));

    let output = `✅ Saved: ${path.basename(result.path)}\n`;
    output += `📁 Location: ${result.path}\n`;
    
    if (options.verbose) {
      output += `⏱️  Time: ${duration}ms\n`;
      output += `💾 Mode: ${result.mode}\n`;
    }

    if (result.undoId) {
      output += `🔄 Undo ID: ${result.undoId}\n`;
    }

    return this.success(output);
  }
}

// Command metadata for manifest generation
export const meta = {
  name: 'code',
  category: 'code',
  description: 'Generate code with intelligent filename inference and safe saving',
  aliases: ['c'],
  usage: '/code [options] <intent or code request>',
  examples: [
    '/code create a REST API',
    '/code --dry-run React component for user profile',
    '/code --force utility function to validate email',
    '/code --interactive create a login form'
  ],
  options: [
    '--dry-run: Preview filenames without creating files',
    '--preview: Same as --dry-run',
    '--force: Save immediately regardless of confidence',
    '--interactive: Show filename selection UI',
    '--verbose: Show detailed information',
    '--name=<filename>: Specify custom filename',
    '--dir=<directory>: Specify target directory'
  ],
  deps: [],
  status: 'stable' as const
};

export default EnhancedCodeCommand;