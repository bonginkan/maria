/**
 * Multimodal Code Command - Voice, Image, and Collaborative Code Generation
 * Phase 3-4: Advanced AI Integration
 */

import { BaseCommand } from "../../base-command.js";
import {
  CommandArgs,
  CommandContext,
  CommandResult,
  CommandExample,
} from "../../types";
import { VoiceToCodeSystem } from "../../../services/code-intelligence/multimodal/VoiceToCodeSystem.js";
import { ImageToCodeSystem } from "../../../services/code-intelligence/multimodal/ImageToCodeSystem.js";
import { RealtimeCollaborationEngine } from "../../../services/code-intelligence/collaboration/RealtimeCollaborationEngine.js";
import { Phase2IntegratedSystem } from "../../../services/code-intelligence/Phase2IntegratedSystem.js";
import { EnterpriseTypeScriptEngine } from "../../../services/code-intelligence/EnterpriseTypeScriptEngine.js";
import { withQuotaFooter, compactPath, formatError } from "../../shared/telemetry-helper";
import * as fs from 'fs/promises';
import * as path from 'path';

interface MultimodalOptions {
  mode?: 'voice' | 'image' | 'collaborate';
  input?: string;
  framework?: 'react' | 'vue' | 'angular' | 'html';
  session?: string;
  participant?: string;
}

export class MultimodalCommand extends BaseCommand {
  name = "mm";
  category = "code" as const;
  description = "Multimodal code generation: voice, image, and collaborative editing";
  usage = "[mode] [options]";
  aliases = ["multimodal", "voice", "image", "collab"];
  
  private voiceSystem?: VoiceToCodeSystem;
  private imageSystem?: ImageToCodeSystem;
  private collabEngine?: RealtimeCollaborationEngine;
  private phase2System?: Phase2IntegratedSystem;
  private tsEngine?: EnterpriseTypeScriptEngine;
  
  examples: CommandExample[] = [
    {
      input: "/mm voice create a React component for user profile",
      description: "Generate code from voice command",
      output: "🎤 Created UserProfile component from voice input",
    },
    {
      input: "/mm image screenshot.png --framework=react",
      description: "Convert UI screenshot to React component",
      output: "🖼️ Generated 3 components from screenshot",
    },
    {
      input: "/mm collaborate --session=abc123",
      description: "Join collaborative coding session",
      output: "🤝 Joined session with 3 other developers",
    }
  ];

  async execute(
    commandArgs: CommandArgs,
    context: CommandContext,
  ): Promise<CommandResult> {
    const args = commandArgs.positional;
    const mode = args[0] as MultimodalOptions['mode'];
    
    if (!mode) {
      return this.showHelp(context);
    }

    try {
      await this.initialize();

      switch (mode) {
        case 'voice':
          return await this.handleVoiceMode(args.slice(1), context);
        
        case 'image':
          return await this.handleImageMode(args.slice(1), context);
        
        case 'collaborate':
        case 'collab':
          return await this.handleCollaborateMode(args.slice(1), context);
        
        default:
          // Try to interpret as voice command if no explicit mode
          return await this.handleVoiceMode(args, context);
      }

    } catch (error: any) {
      return this.error(`Multimodal command failed: ${formatError(error)}`);
    }
  }

  private async initialize(): Promise<void> {
    if (!this.phase2System) {
      this.phase2System = new Phase2IntegratedSystem();
      await this.phase2System.initializePhase2System(process.cwd());
    }

    if (!this.tsEngine) {
      this.tsEngine = new EnterpriseTypeScriptEngine();
      await this.tsEngine.initialize(process.cwd());
    }

    if (!this.voiceSystem) {
      this.voiceSystem = new VoiceToCodeSystem(this.phase2System, this.tsEngine);
    }

    if (!this.imageSystem) {
      this.imageSystem = new ImageToCodeSystem(this.phase2System);
    }

    if (!this.collabEngine) {
      this.collabEngine = new RealtimeCollaborationEngine();
    }
  }

  private async handleVoiceMode(
    args: string[],
    context: CommandContext
  ): Promise<CommandResult> {
    const command = args.join(' ');
    
    if (!command) {
      return this.error('Please provide a voice command · Example: /mm voice create a login form');
    }

    console.log('🎤 Processing voice command...');
    
    // Process voice command (text simulation for now)
    const result = await this.voiceSystem!.processVoiceCommand(command);
    
    if (!result.success) {
      return this.error(`Voice processing failed: ${result.feedback}`);
    }

    // Save generated code if any
    if (result.generatedCode) {
      const fileName = this.generateFileName(result.intent.action, result.intent.target);
      const filePath = path.join(process.cwd(), fileName);
      await fs.writeFile(filePath, result.generatedCode, 'utf-8');
      
      const quotaLeft = context.user?.quotaLeft || 99;
      const message = `🎤 Voice command executed: ${result.intent.action}\n` +
                     `   Generated: ${compactPath(filePath)}\n` +
                     `   Confidence: ${(result.intent.confidence * 100).toFixed(0)}%\n` +
                     `   ${result.feedback}`;
      
      return this.success(withQuotaFooter(message, quotaLeft));
    }

    // Return feedback for non-code generating commands
    const quotaLeft = context.user?.quotaLeft || 99;
    return this.success(withQuotaFooter(`🎤 ${result.feedback}`, quotaLeft));
  }

  private async handleImageMode(
    args: string[],
    context: CommandContext
  ): Promise<CommandResult> {
    const imagePath = args[0];
    
    if (!imagePath) {
      return this.error('Please provide an image path · Example: /mm image screenshot.png');
    }

    // Parse options
    const options = this.parseImageOptions(args.slice(1));
    
    console.log('🖼️ Processing image to code...');
    
    try {
      // Check if file exists
      await fs.access(imagePath);
      
      // Process screenshot
      const result = await this.imageSystem!.processScreenshot(imagePath);
      
      if (!result.success) {
        return this.error('Image processing failed');
      }

      // Save generated components
      const savedFiles: string[] = [];
      
      // Save component file
      const componentName = this.inferComponentNameFromPath(imagePath);
      const componentFile = `${componentName}.${result.framework === 'react' ? 'tsx' : 'js'}`;
      const componentPath = path.join(process.cwd(), componentFile);
      await fs.writeFile(componentPath, result.code.component, 'utf-8');
      savedFiles.push(componentPath);
      
      // Save styles
      if (result.code.styles) {
        const styleFile = `${componentName}.css`;
        const stylePath = path.join(process.cwd(), styleFile);
        await fs.writeFile(stylePath, result.code.styles, 'utf-8');
        savedFiles.push(stylePath);
      }
      
      // Save tests
      if (result.code.tests) {
        const testFile = `${componentName}.test.${result.framework === 'react' ? 'tsx' : 'js'}`;
        const testPath = path.join(process.cwd(), testFile);
        await fs.writeFile(testPath, result.code.tests, 'utf-8');
        savedFiles.push(testPath);
      }
      
      const quotaLeft = context.user?.quotaLeft || 99;
      const message = `🖼️ Image converted to ${result.framework} component\n` +
                     `   Detected: ${result.analysis.patterns[0]?.pattern || 'UI'} pattern\n` +
                     `   Elements: ${result.analysis.elements.length} UI elements\n` +
                     `   Generated: ${savedFiles.map(f => compactPath(f)).join(', ')}\n` +
                     `   Confidence: ${(result.analysis.confidence * 100).toFixed(0)}%`;
      
      return this.success(withQuotaFooter(message, quotaLeft));
      
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return this.error(`Image file not found: ${imagePath}`);
      }
      throw error;
    }
  }

  private async handleCollaborateMode(
    args: string[],
    context: CommandContext
  ): Promise<CommandResult> {
    const options = this.parseCollabOptions(args);
    
    console.log('🤝 Starting collaborative session...');
    
    if (options.session) {
      // Join existing session
      const session = await this.collabEngine!.joinSession(options.session, {
        id: options.participant || context.user?.id || 'user',
        name: context.user?.name || 'Developer',
        color: this.generateUserColor(),
        role: 'editor',
        joinedAt: new Date(),
        lastActiveAt: new Date(),
        isOnline: true
      });
      
      if (!session) {
        return this.error(`Session ${options.session} not found or inactive`);
      }
      
      const quotaLeft = context.user?.quotaLeft || 99;
      const message = `🤝 Joined collaborative session: ${session.name}\n` +
                     `   Session ID: ${session.id}\n` +
                     `   Participants: ${session.participants.length} online\n` +
                     `   Document: ${session.document.filePath || 'untitled'}\n` +
                     `   Version: ${session.document.version}`;
      
      // Set up real-time listeners
      this.setupCollaborationListeners(session.id);
      
      return this.success(withQuotaFooter(message, quotaLeft));
      
    } else {
      // Create new session
      const sessionName = args[0] || 'Code Review Session';
      const documentPath = args[1] || 'index.ts';
      
      let content = '';
      try {
        content = await fs.readFile(documentPath, 'utf-8');
      } catch {
        // File doesn't exist, start with empty content
      }
      
      const session = await this.collabEngine!.createSession(
        sessionName,
        {
          id: context.user?.id || 'owner',
          name: context.user?.name || 'Owner',
          email: context.user?.email,
          color: this.generateUserColor(),
          role: 'owner',
          joinedAt: new Date(),
          lastActiveAt: new Date(),
          isOnline: true
        },
        {
          content,
          language: this.detectLanguage(documentPath),
          filePath: documentPath
        }
      );
      
      const quotaLeft = context.user?.quotaLeft || 99;
      const message = `🤝 Created collaborative session: ${session.name}\n` +
                     `   Session ID: ${session.id}\n` +
                     `   Share ID: ${session.id.slice(0, 8)}\n` +
                     `   Document: ${documentPath}\n` +
                     `   \n` +
                     `   Others can join with: /mm collab --session=${session.id}`;
      
      // Set up real-time listeners
      this.setupCollaborationListeners(session.id);
      
      return this.success(withQuotaFooter(message, quotaLeft));
    }
  }

  private setupCollaborationListeners(sessionId: string): void {
    const unsubscribe = this.collabEngine!.onCollaborationEvent((event) => {
      if (event.sessionId !== sessionId) return;
      
      switch (event.type) {
        case 'join':
          console.log(`👤 ${event.data.name} joined the session`);
          break;
        
        case 'leave':
          console.log(`👋 Participant ${event.participantId} left`);
          break;
        
        case 'operation':
          console.log(`✏️ Edit by ${event.participantId}: ${event.data.type} at position ${event.data.position}`);
          break;
        
        case 'cursor':
          // Silent cursor updates
          break;
        
        case 'selection':
          // Silent selection updates
          break;
        
        case 'sync':
          console.log(`🔄 Session synchronized (v${event.data.document.version})`);
          break;
      }
    });

    // Store unsubscribe function for cleanup
    // In production, this would be managed properly
  }

  private showHelp(context: CommandContext): CommandResult {
    const quotaLeft = context.user?.quotaLeft || 99;
    
    const help = `
🎯 Multimodal Code Generation Commands

📢 Voice Mode:
   /mm voice <command>
   Examples:
   • /mm voice create a login form with email and password
   • /mm voice fix the TypeScript errors in UserProfile
   • /mm voice refactor this function to use async await

🖼️ Image Mode:
   /mm image <path> [--framework=react|vue|angular|html]
   Examples:
   • /mm image screenshot.png
   • /mm image mockup.jpg --framework=vue
   • /mm image sketch.png --framework=react

🤝 Collaboration Mode:
   /mm collaborate [session-name] [file]
   /mm collab --session=<id>
   Examples:
   • /mm collaborate "Code Review" index.ts
   • /mm collab --session=session_abc123

💡 Tips:
   • Voice commands support natural language
   • Images can be screenshots, mockups, or sketches
   • Collaboration sessions are real-time with multiple cursors`;
    
    return this.success(withQuotaFooter(help, quotaLeft));
  }

  private parseImageOptions(args: string[]): any {
    const options: any = {};
    
    for (const arg of args) {
      if (arg.startsWith('--framework=')) {
        options.framework = arg.split('=')[1];
      } else if (arg.startsWith('--typescript')) {
        options.typescript = true;
      } else if (arg.startsWith('--styling=')) {
        options.styling = arg.split('=')[1];
      }
    }
    
    return options;
  }

  private parseCollabOptions(args: string[]): any {
    const options: any = {};
    
    for (const arg of args) {
      if (arg.startsWith('--session=')) {
        options.session = arg.split('=')[1];
      } else if (arg.startsWith('--participant=')) {
        options.participant = arg.split('=')[1];
      }
    }
    
    return options;
  }

  private generateFileName(action: string, target?: string): string {
    const timestamp = Date.now().toString(36);
    const baseName = target || action.toLowerCase();
    return `${baseName}_${timestamp}.ts`;
  }

  private inferComponentNameFromPath(imagePath: string): string {
    const fileName = path.basename(imagePath, path.extname(imagePath));
    // Convert kebab-case or snake_case to PascalCase
    return fileName
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }

  private generateUserColor(): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#6C5CE7', '#A29BFE', '#FD79A8'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath);
    switch (ext) {
      case '.ts':
      case '.tsx':
        return 'typescript';
      case '.js':
      case '.jsx':
        return 'javascript';
      case '.py':
        return 'python';
      case '.go':
        return 'go';
      case '.rs':
        return 'rust';
      case '.java':
        return 'java';
      default:
        return 'plaintext';
    }
  }
}

// Export instance for registration
export const multimodalCommand = new MultimodalCommand();

// Export metadata and execute for command registry
export const metadata = {
  name: 'mm',
  description: 'Multimodal code generation: voice, image, and collaborative editing',
  category: 'code',
  version: '1.0.0',
  type: 'functional' as const,
  planRequired: 'free' as const,
  isPreview: false
};

export async function execute(context: any): Promise<any> {
  return await multimodalCommand.execute(context.args || [], context);
}