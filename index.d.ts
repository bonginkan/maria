export { createCLI } from './cli.js';
import chalk from 'chalk';
import { EventEmitter } from 'events';
import 'commander';

/**
 * FileDropHandler Component
 * Handles file drag & drop detection and processing
 */

/**
 * File drop event data
 */
interface FileDropEvent {
    type: 'file' | 'directory' | 'url' | 'image';
    path: string;
    name: string;
    size?: number;
    mimeType?: string;
    content?: string;
    isImage?: boolean;
}
/**
 * File drop handler configuration
 */
interface FileDropHandlerConfig {
    maxFileSize?: number;
    allowedExtensions?: string[];
    autoReadContent?: boolean;
    enableUrlDetection?: boolean;
}
/**
 * File drop handler class
 */
declare class FileDropHandler extends EventEmitter {
    private config;
    private droppedFiles;
    constructor(config?: FileDropHandlerConfig);
    /**
     * Process dropped or pasted input
     */
    processInput(input: string): Promise<FileDropEvent[]>;
    /**
     * Process a file path
     */
    private processFilePath;
    /**
     * Check if string is a URL
     */
    private isUrl;
    /**
     * Create URL event
     */
    private createUrlEvent;
    /**
     * Extract file paths from input text
     */
    private extractFilePaths;
    /**
     * Check if file is an image
     */
    private isImageFile;
    /**
     * Get MIME type from file extension
     */
    private getMimeType;
    /**
     * Format file size for display
     */
    private formatFileSize;
    /**
     * Get all dropped files
     */
    getDroppedFiles(): FileDropEvent[];
    /**
     * Clear dropped files history
     */
    clearDroppedFiles(): void;
    /**
     * Display dropped files summary
     */
    displaySummary(): void;
}

/**
 * ReferenceManager Component
 * Manages file references, URLs, and images in conversation context
 */

/**
 * Reference types
 */
type ReferenceType = 'file' | 'directory' | 'url' | 'image' | 'code';
/**
 * Reference item
 */
interface ReferenceItem {
    id: string;
    type: ReferenceType;
    path: string;
    name: string;
    content?: string;
    metadata?: {
        size?: number;
        mimeType?: string;
        timestamp?: Date;
        extracted?: boolean;
        summary?: string;
    };
}
/**
 * Reference manager configuration
 */
interface ReferenceManagerConfig {
    maxReferences?: number;
    autoExtractContent?: boolean;
    persistReferences?: boolean;
    referenceCachePath?: string;
}
/**
 * Reference manager class
 */
declare class ReferenceManager {
    private references;
    private config;
    private referenceOrder;
    constructor(config?: ReferenceManagerConfig);
    /**
     * Add a reference from FileDropEvent
     */
    addReference(event: FileDropEvent): Promise<ReferenceItem>;
    /**
     * Add a code snippet reference
     */
    addCodeReference(code: string, language?: string): ReferenceItem;
    /**
     * Get reference by ID
     */
    getReference(id: string): ReferenceItem | undefined;
    /**
     * Get all references
     */
    getAllReferences(): ReferenceItem[];
    /**
     * Get references by type
     */
    getReferencesByType(type: ReferenceType): ReferenceItem[];
    /**
     * Remove reference
     */
    removeReference(id: string): boolean;
    /**
     * Clear all references
     */
    clearReferences(): void;
    /**
     * Extract content from file
     */
    private extractContent;
    /**
     * Generate unique ID for reference
     */
    private generateId;
    /**
     * Map FileDropEvent type to ReferenceType
     */
    private mapEventType;
    /**
     * Build context string from references
     */
    buildContext(): string;
    /**
     * Display references summary
     */
    displaySummary(): void;
    /**
     * Get icon for reference type
     */
    private getTypeIcon;
    /**
     * Format file size
     */
    private formatFileSize;
    /**
     * Persist references to disk
     */
    private persistReferences;
    /**
     * Load persisted references from disk
     */
    private loadPersistedReferences;
}

/**
 * ContentAnalyzer Component
 * Analyzes file contents and triggers appropriate actions
 */

/**
 * Content analysis result
 */
interface AnalysisResult {
    type: 'text' | 'code' | 'data' | 'image' | 'document' | 'url';
    summary: string;
    language?: string;
    keywords?: string[];
    shouldResearch?: boolean;
    researchQuery?: string;
    extractedText?: string;
    metadata?: Record<string, any>;
}
/**
 * Content analyzer configuration
 */
interface ContentAnalyzerConfig {
    enableVision?: boolean;
    enableAutoResearch?: boolean;
    maxFileSize?: number;
    codeLanguages?: string[];
    preferredVisionProvider?: 'gemini' | 'openai' | 'auto';
}
/**
 * Content analyzer class
 */
declare class ContentAnalyzer extends EventEmitter {
    private config;
    private visionAnalyzer;
    constructor(config?: ContentAnalyzerConfig);
    /**
     * Analyze content from file drop event
     */
    analyzeFileDropEvent(event: FileDropEvent): Promise<AnalysisResult>;
    /**
     * Analyze reference item
     */
    analyzeReference(reference: ReferenceItem): Promise<AnalysisResult>;
    /**
     * Analyze URL and determine if research is needed
     */
    private analyzeURL;
    /**
     * Analyze image file with Vision AI
     */
    private analyzeImage;
    /**
     * Analyze regular file
     */
    private analyzeFile;
    /**
     * Analyze code content
     */
    private analyzeCode;
    /**
     * Analyze data file
     */
    private analyzeDataFile;
    /**
     * Analyze document file
     */
    private analyzeDocument;
    /**
     * Analyze directory
     */
    private analyzeDirectory;
    /**
     * Analyze text content
     */
    private analyzeTextContent;
    /**
     * Detect programming language
     */
    private detectLanguage;
    /**
     * Check if file is code
     */
    private isCodeFile;
    /**
     * Check if file is data
     */
    private isDataFile;
    /**
     * Check if file is document
     */
    private isDocumentFile;
    /**
     * Extract keywords from text
     */
    private extractKeywords;
    /**
     * Determine if text should trigger research
     */
    private shouldResearchText;
    /**
     * Format file size
     */
    private formatFileSize;
    /**
     * Display analysis summary
     */
    displaySummary(result: AnalysisResult): void;
}

/**
 * EnhancedProgressReporter Component
 * Provides advanced progress reporting with animations and status indicators
 */

/**
 * Progress step status
 */
type ProgressStatus = 'pending' | 'running' | 'completed' | 'error' | 'skipped';
/**
 * Progress step definition
 */
interface ProgressStep {
    id: string;
    name: string;
    description?: string;
    status: ProgressStatus;
    progress?: number;
    startTime?: Date;
    endTime?: Date;
    error?: string;
    metadata?: Record<string, any>;
}
/**
 * Progress session configuration
 */
interface ProgressSessionConfig {
    title: string;
    showTimestamps?: boolean;
    showElapsedTime?: boolean;
    animateSpinner?: boolean;
    compactMode?: boolean;
    autoComplete?: boolean;
}
/**
 * Enhanced progress reporter class
 */
declare class EnhancedProgressReporter extends EventEmitter {
    private steps;
    private stepOrder;
    private config;
    private sessionStartTime;
    private currentSpinnerFrame;
    private spinnerInterval;
    private isActive;
    private readonly spinnerFrames;
    private readonly statusIcons;
    constructor(config: ProgressSessionConfig);
    /**
     * Start the progress session
     */
    start(): void;
    /**
     * Add a progress step
     */
    addStep(step: Omit<ProgressStep, 'status'>): void;
    /**
     * Update step status
     */
    updateStep(stepId: string, updates: Partial<ProgressStep>): void;
    /**
     * Start a specific step
     */
    startStep(stepId: string, progress?: number): void;
    /**
     * Complete a specific step
     */
    completeStep(stepId: string, metadata?: Record<string, any>): void;
    /**
     * Fail a specific step
     */
    failStep(stepId: string, error: string): void;
    /**
     * Skip a specific step
     */
    skipStep(stepId: string, reason?: string): void;
    /**
     * Update progress for a running step
     */
    updateProgress(stepId: string, progress: number, description?: string): void;
    /**
     * Complete the entire session
     */
    complete(): void;
    /**
     * Render current status
     */
    private renderCurrentStatus;
    /**
     * Render detailed status
     */
    private renderDetailedStatus;
    /**
     * Render compact status
     */
    private renderCompactStatus;
    /**
     * Get step icon with animation
     */
    private getStepIcon;
    /**
     * Render progress bar
     */
    private renderProgressBar;
    /**
     * Render timing information
     */
    private renderTiming;
    /**
     * Render session summary
     */
    private renderSummary;
    /**
     * Start spinner animation
     */
    private startSpinner;
    /**
     * Stop spinner animation
     */
    private stopSpinner;
    /**
     * Check if all steps are complete
     */
    private areAllStepsComplete;
    /**
     * Format duration in human readable format
     */
    private formatDuration;
    /**
     * Get all steps
     */
    getSteps(): ProgressStep[];
    /**
     * Get step by ID
     */
    getStep(stepId: string): ProgressStep | undefined;
    /**
     * Clean up resources
     */
    destroy(): void;
}

/**
 * ModeIndicator Component
 * 50種類の内部モード管理と表示
 */
/**
 * 内部モード型定義
 */
type InternalMode = '✽ Thinking...' | '✽ Ultra Thinking...' | '✽ Deep Thinking...' | '✽ Researching...' | '✽ Analyzing...' | '✽ Evaluating...' | '✽ Reasoning...' | '✽ Contemplating...' | '✽ Reflecting...' | '✽ Processing...' | '✽ Creating...' | '✽ Brainstorming...' | '✽ Inventing...' | '✽ Designing...' | '✽ Drafting...' | '✽ Imagining...' | '✽ Conceptualizing...' | '✽ Innovating...' | '✽ Ideating...' | '✽ Synthesizing...' | '✽ Coding...' | '✽ Building...' | '✽ Implementing...' | '✽ Developing...' | '✽ Programming...' | '✽ Constructing...' | '✽ Architecting...' | '✽ Engineering...' | '✽ Assembling...' | '✽ Integrating...' | '✽ Testing...' | '✽ Debugging...' | '✽ Validating...' | '✽ Reviewing...' | '✽ Checking...' | '✽ Verifying...' | '✽ Inspecting...' | '✽ Auditing...' | '✽ Examining...' | '✽ Troubleshooting...' | '✽ Optimizing...' | '✽ Refactoring...' | '✽ Improving...' | '✽ Enhancing...' | '✽ Streamlining...' | '✽ Polishing...' | '✽ Tuning...' | '✽ Perfecting...' | '✽ Documenting...' | '✽ Planning...' | '🔬 DeepResearch...' | '🎯 PrecisionCoding...' | '🌊 FlowState...' | '🔮 Predictive...' | '🎨 CreativeFlow...' | '🏗️ Architectural...' | '🔍 Forensic...' | '⚡ RapidPrototype...';

/**
 * EnhancedModeIndicator Component
 * Enhanced visual indicators for internal modes with animations and context
 */

/**
 * Mode display configuration
 */
interface ModeDisplayConfig {
    showAnimations?: boolean;
    showDescription?: boolean;
    showIntensity?: boolean;
    compactMode?: boolean;
    autoHide?: boolean;
    hideDelay?: number;
}
/**
 * Enhanced mode indicator class
 */
declare class EnhancedModeIndicator extends EventEmitter {
    private currentMode;
    private previousModes;
    private config;
    private hideTimer;
    private animationFrame;
    private animationInterval;
    private readonly modeInfo;
    constructor(config?: ModeDisplayConfig);
    /**
     * Switch to a new mode
     */
    switchMode(mode: InternalMode, reason?: string, confidence?: number): void;
    /**
     * Display mode switch with enhanced visuals
     */
    private displayModeSwitch;
    /**
     * Display compact mode indicator
     */
    private displayCompactMode;
    /**
     * Display detailed mode information
     */
    private displayDetailedMode;
    /**
     * Get intensity bar visualization
     */
    private getIntensityBar;
    /**
     * Start mode animation
     */
    private startAnimation;
    /**
     * Stop mode animation
     */
    private stopAnimation;
    /**
     * Schedule auto-hide
     */
    private scheduleAutoHide;
    /**
     * Clear auto-hide timer
     */
    private clearAutoHide;
    /**
     * Show mode history
     */
    showModeHistory(): void;
    /**
     * Show available modes by category
     */
    showAvailableModes(): void;
    /**
     * Get current mode
     */
    getCurrentMode(): InternalMode | null;
    /**
     * Get mode information
     */
    getModeInfo(mode: InternalMode): {
        category: string;
        intensity: "low" | "medium" | "high" | "maximum";
        color: any;
        description: string;
        animation: string[];
        triggers: string[];
    };
    /**
     * Clean up resources
     */
    destroy(): void;
}

/**
 * RealTimeFeedbackManager Component
 * Manages real-time feedback, notifications, and status updates
 */

/**
 * Feedback types
 */
type FeedbackType = 'info' | 'success' | 'warning' | 'error' | 'progress' | 'mode';
/**
 * Feedback message
 */
interface FeedbackMessage {
    id: string;
    type: FeedbackType;
    message: string;
    details?: string;
    timestamp: Date;
    duration?: number;
    persistent?: boolean;
    metadata?: Record<string, any>;
}
/**
 * Real-time feedback configuration
 */
interface RealTimeFeedbackConfig {
    showTimestamps?: boolean;
    enableSounds?: boolean;
    maxMessages?: number;
    defaultDuration?: number;
    enableNotifications?: boolean;
    compactMode?: boolean;
}
/**
 * Real-time feedback manager class
 */
declare class RealTimeFeedbackManager extends EventEmitter {
    private config;
    private messages;
    private messageOrder;
    private progressReporter;
    private modeIndicator;
    private activeTimers;
    private readonly feedbackStyles;
    constructor(config?: RealTimeFeedbackConfig);
    /**
     * Initialize mode indicator
     */
    private initializeModeIndicator;
    /**
     * Show feedback message
     */
    showMessage(type: FeedbackType, message: string, options?: {
        details?: string;
        duration?: number;
        persistent?: boolean;
        metadata?: Record<string, any>;
    }): string;
    /**
     * Show info message
     */
    info(message: string, details?: string, duration?: number): string;
    /**
     * Show success message
     */
    success(message: string, details?: string, duration?: number): string;
    /**
     * Show warning message
     */
    warning(message: string, details?: string, duration?: number): string;
    /**
     * Show error message
     */
    error(message: string, details?: string, persistent?: boolean): string;
    /**
     * Show progress update
     */
    progress(message: string, percentage?: number): string;
    /**
     * Start progress session
     */
    startProgressSession(config: ProgressSessionConfig): EnhancedProgressReporter;
    /**
     * Switch mode
     */
    switchMode(mode: any, reason?: string, confidence?: number): void;
    /**
     * Show typing indicator
     */
    showTypingIndicator(message?: string): string;
    /**
     * Hide typing indicator
     */
    hideTypingIndicator(id: string): void;
    /**
     * Show network status
     */
    showNetworkStatus(online: boolean, provider?: string): void;
    /**
     * Show processing status
     */
    showProcessingStatus(status: 'start' | 'progress' | 'complete' | 'error', operation: string, details?: string): void;
    /**
     * Display message
     */
    private displayMessage;
    /**
     * Add message to collection
     */
    private addMessage;
    /**
     * Schedule auto-dismiss
     */
    private scheduleAutoDismiss;
    /**
     * Dismiss message
     */
    dismissMessage(messageId: string): void;
    /**
     * Clear all messages
     */
    clearAll(): void;
    /**
     * Show message history
     */
    showHistory(limit?: number): void;
    /**
     * Generate unique ID
     */
    private generateId;
    /**
     * Get progress reporter
     */
    getProgressReporter(): EnhancedProgressReporter | null;
    /**
     * Get mode indicator
     */
    getModeIndicator(): EnhancedModeIndicator | null;
    /**
     * Get all messages
     */
    getMessages(): FeedbackMessage[];
    /**
     * Clean up resources
     */
    destroy(): void;
}

/**
 * InputBox Component
 * ユーザー入力用の白枠チョークボックス
 */

/**
 * 入力ボックス設定
 */
interface InputBoxConfig {
    width?: number;
    promptSymbol?: string;
    promptColor?: typeof chalk;
    borderColor?: typeof chalk;
    textColor?: typeof chalk;
    multiline?: boolean;
    placeholder?: string;
}
/**
 * 入力ボックスクラス
 */
declare class InputBox {
    private config;
    private rl;
    private currentInput;
    private isActive;
    private fileDropHandler;
    private referenceManager;
    private contentAnalyzer;
    private feedbackManager;
    private triggerResearch;
    constructor(config?: InputBoxConfig);
    /**
     * 入力ボックスを描画
     */
    render(value?: string): void;
    /**
     * 入力ボックスをアクティブ化
     */
    activate(): Promise<string>;
    /**
     * 入力ボックスを非アクティブ化
     */
    deactivate(): void;
    /**
     * マルチライン入力モード
     */
    activateMultiline(): Promise<string[]>;
    /**
     * ボックスをクリア
     */
    private clearBox;
    /**
     * ANSIコードを削除
     */
    private stripAnsi;
    /**
     * 入力値を取得
     */
    getValue(): string;
    /**
     * 入力値をクリア
     */
    clear(): void;
    /**
     * プレースホルダーを設定
     */
    setPlaceholder(placeholder: string): void;
    /**
     * 入力値を設定
     */
    setValue(value: string): void;
    /**
     * スタティックレンダリング（インタラクティブでない表示）
     */
    static renderStatic(content: string, config?: InputBoxConfig): void;
    /**
     * コンパクト入力ボックス
     */
    static renderCompact(prompt?: string): void;
    /**
     * Process input for file references and URLs
     */
    private processInputForReferences;
    /**
     * Handle file drop event
     */
    private handleFileDrop;
    /**
     * Handle URL drop event
     */
    private handleUrlDrop;
    /**
     * Get reference manager
     */
    getReferenceManager(): ReferenceManager;
    /**
     * Get file drop handler
     */
    getFileDropHandler(): FileDropHandler;
    /**
     * Display current references
     */
    displayReferences(): void;
    /**
     * Get context with references
     */
    getContextWithReferences(): string;
    /**
     * Get content analyzer
     */
    getContentAnalyzer(): ContentAnalyzer;
    /**
     * Get feedback manager
     */
    getFeedbackManager(): RealTimeFeedbackManager;
    /**
     * Set research trigger callback
     */
    setResearchTrigger(callback: (query: string) => Promise<void>): void;
    /**
     * Process all references for analysis
     */
    analyzeAllReferences(): Promise<void>;
}

/**
 * Slash Command Type Definitions
 * Core types for the microservice-based command architecture
 */
type CommandCategory = 'core' | 'auth' | 'config' | 'configuration' | 'project' | 'development' | 'generation' | 'analysis' | 'media' | 'conversation' | 'utilities' | 'integration' | 'advanced' | 'system' | 'evolution';
interface CommandArgs {
    raw: string[];
    parsed: Record<string, unknown>;
    flags: Record<string, boolean>;
    options: Record<string, string>;
}
interface CommandContext {
    user?: {
        id: string;
        email?: string;
        role?: string;
    } | null;
    session: {
        id: string;
        commandHistory: string[];
    };
    conversation?: {
        history: any[];
    };
    environment: {
        cwd: string;
    };
}
interface CommandResult {
    success: boolean;
    message: string;
    data?: unknown;
    component?: ComponentType;
    requiresInput?: boolean;
    metadata?: {
        executionTime: number;
        memoryUsed?: number;
        commandVersion?: string;
    };
}
type ComponentType = 'config-panel' | 'auth-flow' | 'help-dialog' | 'status-display' | 'system-diagnostics' | 'cost-display' | 'agents-display' | 'mcp-display' | 'model-selector' | 'image-generator' | 'video-generator' | 'avatar-generator' | 'voice-assistant';
interface ValidationResult {
    success: boolean;
    error?: string;
    suggestions?: string[];
}
interface CommandMetadata {
    version: string;
    author: string;
    deprecated?: boolean;
    experimental?: boolean;
    since?: string;
    replacedBy?: string;
}
interface CommandPermission {
    role?: string;
    scope?: string[];
    requiresAuth?: boolean;
    requiresPremium?: boolean;
}
interface CommandExample {
    input: string;
    description: string;
    output?: string;
}
interface ISlashCommand {
    name: string;
    aliases?: string[];
    category: CommandCategory;
    description: string;
    usage: string;
    examples: CommandExample[];
    permissions?: CommandPermission;
    middleware?: string[];
    rateLimit?: {
        requests: number;
        window: string;
    };
    initialize?(): Promise<void>;
    validate?(args: CommandArgs): Promise<ValidationResult>;
    execute(args: CommandArgs, context: CommandContext): Promise<CommandResult>;
    cleanup?(): Promise<void>;
    rollback?(context: CommandContext, error: Error): Promise<void>;
    metadata: CommandMetadata;
}
type MiddlewareNext = () => Promise<CommandResult>;
interface IMiddleware {
    name: string;
    priority?: number;
    execute(command: ISlashCommand, args: CommandArgs, context: CommandContext, next: MiddlewareNext): Promise<CommandResult>;
}

/**
 * Base Command Class
 * Abstract base class for all slash commands
 */

declare abstract class BaseCommand implements ISlashCommand {
    abstract name: string;
    abstract category: CommandCategory;
    abstract description: string;
    aliases?: string[];
    usage: string;
    examples: CommandExample[];
    permissions?: CommandPermission;
    middleware?: string[];
    rateLimit?: {
        requests: number;
        window: string;
    };
    metadata: CommandMetadata;
    private cache;
    /**
     * Initialize the command (called once when registered)
     */
    initialize(): Promise<void>;
    /**
     * Validate command arguments
     */
    validate(_args: CommandArgs): Promise<ValidationResult>;
    /**
     * Execute the command - must be implemented by subclasses
     */
    abstract execute(args: CommandArgs, context: CommandContext): Promise<CommandResult>;
    /**
     * Cleanup resources (called when command is unregistered)
     */
    cleanup(): Promise<void>;
    /**
     * Rollback on error - override for custom rollback logic
     */
    rollback(_context: CommandContext, error: Error): Promise<void>;
    /**
     * Parse command arguments into structured format
     */
    protected parseArgs(raw: string[]): CommandArgs;
    /**
     * Create a success response
     */
    protected success(message: string, data?: unknown, metadata?: Partial<CommandResult['metadata']>): CommandResult;
    /**
     * Create an error response
     */
    protected error(message: string, code?: string, details?: unknown): CommandResult;
    /**
     * Cache data with TTL
     */
    protected setCache(key: string, data: unknown, ttlSeconds?: number): void;
    /**
     * Get cached data
     */
    protected getCache<T = unknown>(key: string): T | null;
    /**
     * Check if user has required permissions
     */
    protected checkPermissions(context: CommandContext): Promise<ValidationResult>;
    /**
     * Format help text for this command
     */
    formatHelp(): string;
    /**
     * Log command execution
     */
    protected logExecution(args: CommandArgs, context: CommandContext, result: CommandResult): void;
}

/**
 * Command Registry System
 * Central registry for all slash commands with auto-discovery
 */

declare class CommandRegistry {
    private commands;
    private aliases;
    private middlewares;
    private rateLimits;
    private _initialized;
    private get initialized();
    private set initialized(value);
    constructor();
    /**
     * Register a command
     */
    register(command: ISlashCommand): void;
    /**
     * Unregister a command
     */
    unregister(name: string): boolean;
    /**
     * Get a command by name or alias
     */
    get(nameOrAlias: string): ISlashCommand | undefined;
    /**
     * Check if a command exists
     */
    has(nameOrAlias: string): boolean;
    /**
     * Get all registered commands
     */
    getAll(): ISlashCommand[];
    /**
     * Get commands by category
     */
    getByCategory(category: string): ISlashCommand[];
    /**
     * Execute a command
     */
    execute(commandName: string, args: string[], context: CommandContext): Promise<CommandResult>;
    /**
     * Auto-register commands from directory
     */
    autoRegister(directory: string): Promise<void>;
    /**
     * Register a middleware
     */
    registerMiddleware(middleware: IMiddleware): void;
    private setupDefaultMiddlewares;
    private parseArguments;
    private checkPermissions;
    private checkRateLimit;
    private parseWindow;
    private runMiddlewareChain;
    private getSuggestions;
    private isValidCommand;
    private logExecution;
}
declare const commandRegistry: CommandRegistry;

/**
 * Slash Commands Module
 * Export all command system components
 */

/**
 * Initialize the slash command system
 */
declare function initializeSlashCommands(): Promise<void>;
/**
 * Get command suggestions for auto-complete
 */
declare function getCommandSuggestions(input: string): string[];
/**
 * Get all commands grouped by category
 */
declare function getCommandsByCategory(): Record<string, ISlashCommand[]>;

/**
 * MARIA Memory System - Core Type Definitions
 *
 * Comprehensive memory interfaces based on Cipher's dual-layer architecture
 * System 1: Fast, intuitive memory patterns
 * System 2: Deliberate reasoning and quality traces
 */
interface MemoryEvent {
    id: string;
    type: MemoryEventType;
    timestamp: Date;
    userId: string;
    sessionId: string;
    data: unknown;
    reasoning?: ReasoningTrace;
    metadata: EventMetadata;
}
type MemoryEventType = 'code_generation' | 'bug_fix' | 'quality_improvement' | 'team_interaction' | 'learning_update' | 'pattern_recognition' | 'mode_change';
interface EventMetadata {
    confidence: number;
    source: 'user_input' | 'ai_generated' | 'system_inferred';
    priority: 'low' | 'medium' | 'high' | 'critical';
    tags: string[];
    projectId?: string;
    teamId?: string;
}
interface System1Memory {
    programmingConcepts: KnowledgeNode[];
    businessLogic: ConceptGraph;
    pastInteractions: InteractionHistory;
    codePatterns: PatternLibrary;
    userPreferences: UserPreferenceSet;
}
interface KnowledgeNode {
    id: string;
    type: 'function' | 'class' | 'module' | 'concept' | 'pattern';
    name: string;
    content: string;
    embedding: number[];
    confidence: number;
    lastAccessed: Date;
    accessCount: number;
    metadata: NodeMetadata;
}
interface NodeMetadata {
    language?: string;
    framework?: string;
    domain?: string;
    complexity: 'low' | 'medium' | 'high';
    quality: number;
    relevance: number;
}
interface ConceptGraph {
    nodes: Map<string, KnowledgeNode>;
    edges: Map<string, ConceptEdge>;
    clusters: ConceptCluster[];
}
interface ConceptEdge {
    id: string;
    sourceId: string;
    targetId: string;
    type: 'depends_on' | 'implements' | 'uses' | 'similar_to' | 'extends';
    weight: number;
    confidence: number;
}
interface ConceptCluster {
    id: string;
    name: string;
    nodeIds: string[];
    centroid: number[];
    coherence: number;
}
interface InteractionHistory {
    sessions: SessionRecord[];
    commands: CommandHistory[];
    patterns: UsagePattern[];
}
interface SessionRecord {
    id: string;
    startTime: Date;
    endTime?: Date;
    userId: string;
    commands: string[];
    outcomes: SessionOutcome[];
    satisfaction?: number;
}
interface CommandHistory {
    command: string;
    frequency: number;
    lastUsed: Date;
    successRate: number;
    averageExecutionTime: number;
    userSatisfaction: number;
}
interface UsagePattern {
    id: string;
    type: 'temporal' | 'sequential' | 'contextual';
    pattern: string;
    frequency: number;
    confidence: number;
    conditions: PatternCondition[];
}
interface PatternCondition {
    type: 'time_of_day' | 'project_type' | 'team_size' | 'complexity';
    value: string | number;
    operator: 'equals' | 'greater_than' | 'less_than' | 'contains';
}
interface PatternLibrary {
    codePatterns: CodePattern[];
    antiPatterns: AntiPattern[];
    bestPractices: BestPractice[];
    templates: CodeTemplate[];
}
interface CodePattern {
    id: string;
    name: string;
    description: string;
    code: string;
    language: string;
    framework?: string;
    useCase: string;
    complexity: 'beginner' | 'intermediate' | 'advanced';
    performance: PerformanceMetrics;
    examples: CodeExample[];
}
interface AntiPattern {
    id: string;
    name: string;
    description: string;
    problem: string;
    solution: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    detectionRules: DetectionRule[];
}
interface DetectionRule {
    type: 'syntax' | 'semantic' | 'performance' | 'security';
    pattern: string;
    confidence: number;
}
interface BestPractice {
    id: string;
    name: string;
    description: string;
    category: string;
    applicability: ApplicabilityRule[];
    benefits: string[];
    implementation: ImplementationGuide;
}
interface ApplicabilityRule {
    condition: string;
    context: string[];
    priority: number;
}
interface ImplementationGuide {
    steps: string[];
    examples: CodeExample[];
    tools: string[];
    estimatedTime: number;
}
interface CodeTemplate {
    id: string;
    name: string;
    description: string;
    template: string;
    variables: TemplateVariable[];
    language: string;
    framework?: string;
    category: string;
}
interface TemplateVariable {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object';
    default?: unknown;
    description: string;
    required: boolean;
}
interface CodeExample {
    id: string;
    title: string;
    code: string;
    language: string;
    explanation: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
}
interface PerformanceMetrics {
    timeComplexity: string;
    spaceComplexity: string;
    benchmarks?: BenchmarkResult[];
}
interface BenchmarkResult {
    environment: string;
    executionTime: number;
    memoryUsage: number;
    throughput?: number;
}
interface System2Memory {
    reasoningSteps: ReasoningTrace[];
    qualityEvaluation: QualityMetrics;
    decisionContext: DecisionTree;
    improvementSuggestions: Enhancement[];
    reflectionData: ReflectionEntry[];
}
interface ReasoningTrace {
    id: string;
    timestamp: Date;
    context: ReasoningContext;
    steps: ReasoningStep[];
    conclusion: string;
    confidence: number;
    alternatives: AlternativeReasoning[];
    metadata: ReasoningMetadata;
}
interface ReasoningContext {
    problem: string;
    goals: string[];
    constraints: string[];
    assumptions: string[];
    availableResources: string[];
}
interface ReasoningStep {
    id: string;
    type: 'analysis' | 'synthesis' | 'evaluation' | 'inference';
    description: string;
    input: string;
    output: string;
    confidence: number;
    duration: number;
    dependencies: string[];
}
interface AlternativeReasoning {
    id: string;
    description: string;
    steps: ReasoningStep[];
    pros: string[];
    cons: string[];
    confidence: number;
    rejected: boolean;
    rejectionReason?: string;
}
interface ReasoningMetadata {
    complexity: 'simple' | 'moderate' | 'complex' | 'very_complex';
    domain: string;
    techniques: string[];
    qualityScore: number;
    reviewRequired: boolean;
}
interface QualityMetrics {
    codeQuality: CodeQualityMetrics;
    reasoningQuality: ReasoningQualityMetrics;
    userSatisfaction: SatisfactionMetrics;
    systemPerformance: PerformanceMetrics;
}
interface CodeQualityMetrics {
    maintainability: number;
    readability: number;
    testability: number;
    performance: number;
    security: number;
    bugDensity: number;
    complexity: number;
}
interface ReasoningQualityMetrics {
    coherence: number;
    completeness: number;
    accuracy: number;
    efficiency: number;
    creativity: number;
}
interface SatisfactionMetrics {
    userRating: number;
    taskCompletion: number;
    timeToSolution: number;
    iterationCount: number;
    userFeedback: string[];
}
interface DecisionTree {
    id: string;
    rootNode: DecisionNode;
    metadata: DecisionTreeMetadata;
}
interface DecisionNode {
    id: string;
    type: 'condition' | 'action' | 'outcome';
    description: string;
    children: DecisionNode[];
    confidence: number;
    evidence: Evidence[];
    alternatives: DecisionNode[];
}
interface Evidence {
    type: 'empirical' | 'theoretical' | 'heuristic' | 'user_feedback';
    description: string;
    strength: number;
    source: string;
    timestamp: Date;
}
interface DecisionTreeMetadata {
    domain: string;
    complexity: number;
    accuracy: number;
    lastUpdated: Date;
    usageCount: number;
}
interface Enhancement {
    id: string;
    type: 'performance' | 'quality' | 'usability' | 'feature';
    description: string;
    impact: ImpactAssessment;
    implementation: ImplementationPlan;
    priority: number;
    status: 'proposed' | 'approved' | 'in_progress' | 'completed' | 'rejected';
}
interface ImpactAssessment {
    benefitScore: number;
    effortScore: number;
    riskScore: number;
    affectedUsers: number;
    affectedComponents: string[];
}
interface ImplementationPlan {
    phases: ImplementationPhase[];
    timeline: number;
    resources: RequiredResource[];
    dependencies: string[];
    risks: Risk[];
}
interface ImplementationPhase {
    id: string;
    name: string;
    description: string;
    duration: number;
    deliverables: string[];
    dependencies: string[];
}
interface RequiredResource {
    type: 'developer' | 'designer' | 'infrastructure' | 'tool';
    quantity: number;
    duration: number;
    cost?: number;
}
interface Risk {
    id: string;
    description: string;
    probability: number;
    impact: number;
    mitigation: string;
    contingency: string;
}
interface ReflectionEntry {
    id: string;
    timestamp: Date;
    trigger: string;
    observation: string;
    analysis: string;
    insight: string;
    actionItems: ActionItem[];
    confidence: number;
}
interface ActionItem {
    id: string;
    description: string;
    priority: number;
    dueDate?: Date;
    assignee?: string;
    status: 'open' | 'in_progress' | 'completed' | 'cancelled';
}
interface UserPreferenceSet {
    developmentStyle: DevelopmentStyle;
    communicationPreferences: CommunicationPreferences;
    toolPreferences: ToolPreferences;
    learningStyle: LearningStyle;
    qualityStandards: QualityStandards;
}
interface DevelopmentStyle {
    approach: 'test-driven' | 'prototype-first' | 'documentation-heavy' | 'iterative';
    preferredLanguages: LanguagePreference[];
    architecturalPatterns: ArchitecturalPattern[];
    problemSolvingStyle: 'systematic' | 'intuitive' | 'collaborative' | 'experimental';
    workPace: 'fast' | 'moderate' | 'thorough';
}
interface LanguagePreference {
    language: string;
    proficiency: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    frequency: number;
    preference: number;
}
interface ArchitecturalPattern {
    name: string;
    familiarity: number;
    preference: number;
    usageFrequency: number;
}
interface CommunicationPreferences {
    verbosity: 'minimal' | 'moderate' | 'detailed' | 'comprehensive';
    explanationDepth: 'surface' | 'intermediate' | 'deep';
    codeCommentStyle: 'none' | 'inline' | 'docstring' | 'comprehensive';
    feedbackStyle: 'direct' | 'constructive' | 'encouraging' | 'detailed';
}
interface ToolPreferences {
    ide: string[];
    frameworks: FrameworkPreference[];
    libraries: LibraryPreference[];
    buildTools: string[];
    testingTools: string[];
}
interface FrameworkPreference {
    name: string;
    category: string;
    proficiency: number;
    preference: number;
}
interface LibraryPreference {
    name: string;
    category: string;
    proficiency: number;
    preference: number;
}
interface LearningStyle {
    preferredMethods: LearningMethod[];
    pace: 'slow' | 'moderate' | 'fast';
    complexity: 'simple_to_complex' | 'complex_first' | 'example_driven';
    feedback: 'immediate' | 'milestone' | 'completion';
}
interface LearningMethod {
    type: 'visual' | 'auditory' | 'kinesthetic' | 'reading' | 'hands_on';
    effectiveness: number;
    preference: number;
}
interface QualityStandards {
    codeQuality: QualityThreshold[];
    testCoverage: number;
    documentation: DocumentationStandard;
    performance: PerformanceStandard;
    security: SecurityStandard;
}
interface QualityThreshold {
    metric: string;
    threshold: number;
    priority: 'low' | 'medium' | 'high' | 'critical';
}
interface DocumentationStandard {
    required: boolean;
    style: 'minimal' | 'standard' | 'comprehensive';
    formats: string[];
}
interface PerformanceStandard {
    responseTime: number;
    throughput: number;
    memoryUsage: number;
    cpuUsage: number;
}
interface SecurityStandard {
    requirements: SecurityRequirement[];
    compliance: ComplianceStandard[];
    scanningEnabled: boolean;
}
interface SecurityRequirement {
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    mandatory: boolean;
}
interface ComplianceStandard {
    name: string;
    version: string;
    requirements: string[];
}
interface SessionOutcome {
    type: 'success' | 'partial_success' | 'failure' | 'cancelled';
    description: string;
    metrics: SessionMetrics;
    feedback: UserFeedback[];
}
interface SessionMetrics {
    duration: number;
    commandsExecuted: number;
    errorsEncountered: number;
    linesOfCodeGenerated: number;
    bugsFixed: number;
    qualityImprovements: number;
}
interface UserFeedback {
    type: 'rating' | 'comment' | 'suggestion' | 'complaint';
    content: string;
    timestamp: Date;
    sentiment: 'positive' | 'neutral' | 'negative';
    actionable: boolean;
}
interface System1Config {
    maxKnowledgeNodes: number;
    embeddingDimension: number;
    cacheSize: number;
    compressionThreshold: number;
    accessDecayRate: number;
}
interface System2Config {
    maxReasoningTraces: number;
    qualityThreshold: number;
    reflectionFrequency: number;
    enhancementEvaluationInterval: number;
}
interface CoordinatorConfig {
    syncInterval: number;
    conflictResolutionStrategy: 'system1_priority' | 'system2_priority' | 'balanced';
    learningRate: number;
    adaptationThreshold: number;
}
interface PerformanceConfig {
    lazyLoadingEnabled: boolean;
    cacheStrategy: 'lru' | 'lfu' | 'adaptive';
    batchSize: number;
    timeout: number;
    memoryLimit: number;
    targetLatency?: number;
}

/**
 * MARIA Memory System - System 1 Memory Implementation
 *
 * Fast, intuitive memory patterns for immediate responses
 * Handles programming concepts, code patterns, and user preferences
 */

declare class System1MemoryManager implements System1Memory {
    private knowledgeNodes;
    userPreferences: UserPreferenceSet;
    private conceptGraph;
    private interactionHistory;
    private patternLibrary;
    private config;
    private cache;
    private lastAccessTimes;
    constructor(config: System1Config);
    get programmingConcepts(): KnowledgeNode[];
    get businessLogic(): ConceptGraph;
    get pastInteractions(): InteractionHistory;
    get codePatterns(): PatternLibrary;
    addKnowledgeNode(type: KnowledgeNode['type'], name: string, content: string, embedding: number[], metadata?: Partial<NodeMetadata>): Promise<KnowledgeNode>;
    getKnowledgeNode(id: string): Promise<KnowledgeNode | null>;
    searchKnowledgeNodes(query: string, queryEmbedding: number[], limit?: number): Promise<KnowledgeNode[]>;
    updateKnowledgeNode(id: string, updates: Partial<KnowledgeNode>): Promise<boolean>;
    addConceptEdge(sourceId: string, targetId: string, type: ConceptEdge['type'], weight?: number, confidence?: number): Promise<ConceptEdge>;
    getRelatedConcepts(nodeId: string, maxDepth?: number): Promise<KnowledgeNode[]>;
    addCodePattern(pattern: Omit<CodePattern, 'id'>): Promise<CodePattern>;
    findCodePatterns(language?: string, framework?: string, useCase?: string, limit?: number): Promise<CodePattern[]>;
    addAntiPattern(antiPattern: Omit<AntiPattern, 'id'>): Promise<AntiPattern>;
    detectAntiPatterns(code: string): Promise<AntiPattern[]>;
    recordSession(session: SessionRecord): Promise<void>;
    updateCommandHistory(command: string): Promise<void>;
    getFrequentCommands(limit?: number): Promise<CommandHistory[]>;
    getRecentCommands(limit?: number): Promise<CommandHistory[]>;
    updateUserPreferences(updates: Partial<UserPreferenceSet>): Promise<void>;
    getUserPreference<K extends keyof UserPreferenceSet>(key: K): Promise<UserPreferenceSet[K]>;
    processMemoryEvent(event: MemoryEvent): Promise<void>;
    cleanupLeastUsedNodes(): Promise<void>;
    compressMemory(): Promise<void>;
    private generateNodeId;
    private generatePatternId;
    private calculateCosineSimilarity;
    private applyAccessDecay;
    private calculateUsageScore;
    private invalidateCache;
    private detectUsagePatterns;
    private processCodeGenerationEvent;
    private processPatternRecognitionEvent;
    private processLearningUpdateEvent;
    private extractCodePatterns;
    private adaptUserPreferences;
    private mergeimilarPatterns;
    private calculatePatternSimilarity;
    private mergePatterns;
    private initializeDefaultPreferences;
}

/**
 * MARIA Memory System - System 2 Memory Implementation
 *
 * Deliberate reasoning and quality traces for complex decision making
 * Handles reasoning steps, quality evaluation, and improvement suggestions
 */

declare class System2MemoryManager implements System2Memory {
    private reasoningTraces;
    private qualityMetrics;
    private decisionTrees;
    private enhancements;
    private reflectionEntries;
    private config;
    private analysisCache;
    constructor(config: System2Config);
    get reasoningSteps(): ReasoningTrace[];
    get qualityEvaluation(): QualityMetrics;
    get decisionContext(): DecisionTree;
    get improvementSuggestions(): Enhancement[];
    get reflectionData(): ReflectionEntry[];
    startReasoningTrace(context: ReasoningContext, initialStep?: string): Promise<ReasoningTrace>;
    addReasoningStep(traceId: string, stepData: Omit<ReasoningStep, 'id' | 'confidence' | 'duration' | 'dependencies'>): Promise<ReasoningStep>;
    completeReasoningTrace(traceId: string, conclusion: string, confidence: number): Promise<ReasoningTrace>;
    addAlternativeReasoning(traceId: string, alternative: Omit<AlternativeReasoning, 'id'>): Promise<AlternativeReasoning>;
    getReasoningTrace(traceId: string): Promise<ReasoningTrace | null>;
    searchReasoningTraces(query: {
        domain?: string;
        complexity?: string;
        minQuality?: number;
        timeframe?: {
            start: Date;
            end: Date;
        };
    }, limit?: number): Promise<ReasoningTrace[]>;
    createDecisionTree(domain: string, initialCondition: string): Promise<DecisionTree>;
    addDecisionNode(treeId: string, parentNodeId: string, node: Omit<DecisionNode, 'id'>): Promise<DecisionNode>;
    addEvidence(treeId: string, nodeId: string, evidence: Evidence): Promise<void>;
    queryDecisionTree(treeId: string, context: Record<string, unknown>): Promise<DecisionNode[]>;
    proposeEnhancement(enhancement: Omit<Enhancement, 'id' | 'status'>): Promise<Enhancement>;
    updateEnhancementStatus(enhancementId: string, status: Enhancement['status'], feedback?: string): Promise<boolean>;
    getEnhancementsByType(type: Enhancement['type']): Promise<Enhancement[]>;
    addReflectionEntry(trigger: string, observation: string, analysis: string, insight: string, confidence?: number): Promise<ReflectionEntry>;
    addActionItem(reflectionId: string, actionItem: Omit<ActionItem, 'id' | 'status'>): Promise<ActionItem>;
    getReflectionInsights(timeframe?: {
        start: Date;
        end: Date;
    }, minConfidence?: number): Promise<ReflectionEntry[]>;
    processMemoryEvent(event: MemoryEvent): Promise<void>;
    assessCodeQuality(code: string, _language: string, context?: Record<string, unknown>): Promise<CodeQualityMetrics>;
    updateQualityMetrics(metrics: Partial<QualityMetrics>): Promise<void>;
    private generateTraceId;
    private generateStepId;
    private generateAlternativeId;
    private generateDecisionTreeId;
    private generateNodeId;
    private generateEnhancementId;
    private generateReflectionId;
    private generateActionItemId;
    private assessComplexity;
    private identifyDomain;
    private calculateStepConfidence;
    private identifyDependencies;
    private updateTraceQuality;
    private calculateReasoningQuality;
    private calculateCoherence;
    private calculateCompleteness;
    private calculateAccuracy;
    private calculateEfficiency;
    private calculateCreativity;
    private generateImprovementSuggestions;
    private updateGlobalQualityMetrics;
    private createEmptyDecisionTree;
    private findDecisionNode;
    private calculateTreeComplexity;
    private calculateNodeConfidence;
    private traverseDecisionTree;
    private evaluateCondition;
    private shouldAutoApprove;
    private evaluateEnhancementImpact;
    private generateActionItems;
    private processCodeGenerationEvent;
    private processBugFixEvent;
    private processQualityImprovementEvent;
    private processGenericEvent;
    private manageTraceLimit;
    private calculateMaintainability;
    private calculateReadability;
    private calculateTestability;
    private calculatePerformance;
    private calculateSecurity;
    private calculateBugDensity;
    private calculateCyclomaticComplexity;
    private calculateBasicComplexity;
    private hashCode;
    private initializeQualityMetrics;
}

/**
 * MARIA Memory System - Dual Memory Engine
 *
 * Core integration logic for System 1 (fast, intuitive) and System 2 (deliberate, analytical) memory
 * Orchestrates memory operations, layer selection, and cross-system optimization
 */

interface DualMemoryEngineConfig {
    system1: System1Config;
    system2: System2Config;
    coordinator: CoordinatorConfig;
    performance: PerformanceConfig;
}
interface MemoryQuery {
    type: 'knowledge' | 'pattern' | 'reasoning' | 'quality' | 'preference';
    query: string;
    context?: Record<string, unknown>;
    urgency?: 'low' | 'medium' | 'high' | 'critical';
    embedding?: number[];
    limit?: number;
}
interface MemoryResponse<T = unknown> {
    data: T;
    source: 'system1' | 'system2' | 'both';
    confidence: number;
    latency: number;
    cached: boolean;
    suggestions?: Enhancement[];
}
interface MemoryOperationMetrics {
    totalOperations: number;
    system1Operations: number;
    system2Operations: number;
    averageLatency: number;
    cacheHitRate: number;
    errorRate: number;
    lastReset: Date;
}
declare class DualMemoryEngine {
    private system1;
    private system2;
    private config;
    private operationMetrics;
    private eventQueue;
    private processingLock;
    private performanceCache;
    constructor(config: DualMemoryEngineConfig);
    query<T = unknown>(memoryQuery: MemoryQuery): Promise<MemoryResponse<T>>;
    store(event: MemoryEvent): Promise<void>;
    learn(input: string, output: string, context: Record<string, unknown>, success: boolean): Promise<void>;
    findKnowledge(query: string, embedding?: number[], limit?: number): Promise<MemoryResponse<KnowledgeNode[]>>;
    findPatterns(language?: string, framework?: string, useCase?: string, limit?: number): Promise<MemoryResponse<CodePattern[]>>;
    getReasoning(domain?: string, complexity?: string, minQuality?: number): Promise<MemoryResponse<ReasoningTrace[]>>;
    getQualityInsights(): Promise<MemoryResponse<QualityMetrics>>;
    getUserPreferences(): Promise<MemoryResponse<UserPreferenceSet>>;
    recall(options: {
        query: string;
        type: string;
        limit?: number;
    }): Promise<unknown[]>;
    clearMemory(): Promise<void>;
    private selectMemoryStrategy;
    private getUrgencyScore;
    private assessQueryComplexity;
    private getTypePreference;
    private getCacheStatus;
    private calculateSystem1Score;
    private calculateSystem2Score;
    private executeMemoryOperation;
    private executeSystem1Operation;
    private executeSystem2Operation;
    private executeCombinedOperation;
    private combineResults;
    private generateCombinedSuggestions;
    processEvent(event: MemoryEvent): Promise<void>;
    private determineEventRouting;
    private adaptFromEvent;
    private startBackgroundProcessing;
    private processEventQueue;
    private cleanupCache;
    private optimizeMemory;
    /**
     * Get System 1 memory manager instance
     * @returns System1MemoryManager instance
     */
    getSystem1(): System1MemoryManager;
    /**
     * Get System 2 memory manager instance
     * @returns System2MemoryManager instance
     */
    getSystem2(): System2MemoryManager;
    private generateCacheKey;
    private isCacheValid;
    private updateOperationMetrics;
    private initializeMetrics;
    getMetrics(): MemoryOperationMetrics;
    resetMetrics(): void;
    getCacheSize(): number;
    getQueueSize(): number;
    initialize(): Promise<void>;
    updateConfig(newConfig: Partial<DualMemoryEngineConfig>): void;
    getConfig(): DualMemoryEngineConfig;
    getStatistics(): Promise<{
        system1: {
            totalNodes: number;
            patterns: number;
            preferences: number;
            cacheHitRate: number;
        };
        system2: {
            reasoningTraces: number;
            decisionTrees: number;
            activeSessions: number;
            memoryUsage: number;
        };
        performance: {
            avgResponseTime: number;
            memoryUsage: number;
        };
    }>;
}

/**
 * MARIA Memory System - Memory Coordinator
 *
 * Cross-layer coordination and optimization between System 1 and System 2 memory
 * Manages synchronization, performance optimization, and adaptive learning
 */

interface CoordinationMetrics {
    syncOperations: number;
    optimizationRuns: number;
    adaptationEvents: number;
    crossLayerTransfers: number;
    performanceImprovements: number;
    lastOptimization: Date;
    averageSyncTime: number;
    systemHealth: 'excellent' | 'good' | 'fair' | 'poor';
}
interface OptimizationRecommendation {
    id: string;
    type: 'performance' | 'memory' | 'learning' | 'synchronization';
    priority: number;
    description: string;
    impact: {
        performance: number;
        memory: number;
        latency: number;
    };
    implementation: {
        effort: 'low' | 'medium' | 'high';
        risk: 'low' | 'medium' | 'high';
        timeline: number;
    };
    automated: boolean;
}
interface SynchronizationReport {
    system1State: {
        knowledgeNodes: number;
        patterns: number;
        interactions: number;
        cacheHitRate: number;
    };
    system2State: {
        reasoningTraces: number;
        qualityMetrics: QualityMetrics;
        enhancements: number;
        reflections: number;
    };
    synchronizationPoints: SyncPoint[];
    conflictResolutions: ConflictResolution[];
    recommendations: OptimizationRecommendation[];
}
interface SyncPoint {
    id: string;
    timestamp: Date;
    type: 'knowledge_transfer' | 'pattern_learning' | 'quality_feedback' | 'user_adaptation';
    source: 'system1' | 'system2';
    target: 'system1' | 'system2';
    data: unknown;
    success: boolean;
    latency: number;
}
interface ConflictResolution {
    id: string;
    timestamp: Date;
    conflictType: 'data_inconsistency' | 'preference_mismatch' | 'quality_threshold' | 'performance_tradeoff';
    description: string;
    resolution: string;
    confidence: number;
    impact: 'low' | 'medium' | 'high';
}
declare class MemoryCoordinator {
    private system1;
    private system2;
    private dualEngine;
    private config;
    private metrics;
    private syncPoints;
    private conflicts;
    private recommendations;
    private optimizationTimer?;
    private syncTimer?;
    constructor(dualEngine: DualMemoryEngine, config?: CoordinatorConfig);
    synchronizeSystems(): Promise<SynchronizationReport>;
    optimizePerformance(): Promise<OptimizationRecommendation[]>;
    adaptToUserBehavior(event: MemoryEvent): Promise<void>;
    resolveConflicts(): Promise<ConflictResolution[]>;
    private performCrossLayerSync;
    private syncKnowledgeToReasoning;
    private syncQualityToPatterns;
    private syncUserPreferences;
    private syncLearningData;
    private analyzePerformance;
    private generateOptimizationRecommendations;
    private applyAutomatedOptimizations;
    private applyOptimization;
    private detectConflicts;
    private resolveConflict;
    private analyzeBehaviorPattern;
    private determineAdaptation;
    private performCrossLayerAdaptation;
    private getSystem1State;
    private getSystem2State;
    private getRecentSyncPoints;
    private getRecentConflicts;
    private recordSyncPoint;
    private getDefaultConfig;
    private startCoordination;
    private initializeMetrics;
    private transferKnowledgeToReasoning;
    private updatePatternsForMaintainability;
    private updatePatternsForSecurity;
    private adaptReasoningForTDD;
    private adaptReasoningForSystematicApproach;
    private integratePatternLearning;
    private identifyBottlenecks;
    private identifyOptimizationOpportunities;
    private optimizePerformanceSettings;
    private optimizeMemoryUsage;
    private optimizeLearningSettings;
    private optimizeSynchronizationSettings;
    private adjustQualityThresholds;
    private optimizeSystem2Performance;
    private adaptSystem1ForCodeGeneration;
    private adaptSystem2ForQuality;
    private updateAdaptiveLearning;
    getMetrics(): CoordinationMetrics;
    getRecommendations(): OptimizationRecommendation[];
    forceOptimization(): Promise<OptimizationRecommendation[]>;
    forceSynchronization(): Promise<SynchronizationReport>;
    getProjectContext(): Promise<any>;
    updateConfig(newConfig: Partial<CoordinatorConfig>): void;
    destroy(): void;
}

/**
 * Internal Mode System - Type Definitions
 *
 * Comprehensive type system for MARIA CODE's internal mode functionality.
 * Integrates with existing Intelligent Router Service for real-time mode switching.
 */
type ModeCategory = 'reasoning' | 'creative' | 'analytical' | 'structural' | 'validation' | 'contemplative' | 'intensive' | 'learning' | 'collaborative';
type ModeIntensity = 'light' | 'normal' | 'deep' | 'ultra';
type ModeTriggerType = 'intent' | 'context' | 'situation' | 'pattern' | 'manual';
interface ModeDefinition {
    id: string;
    name: string;
    symbol: string;
    category: ModeCategory;
    intensity: ModeIntensity;
    description: string;
    purpose: string;
    useCases: string[];
    triggers: ModeTrigger[];
    display: ModeDisplay;
    i18n: Record<string, ModeI18n>;
    metadata: ModeMetadata;
}
interface ModeTrigger {
    type: ModeTriggerType;
    conditions: TriggerCondition[];
    weight: number;
    confidence: number;
}
interface TriggerCondition {
    field: string;
    operator: 'contains' | 'equals' | 'matches' | 'startsWith' | 'endsWith';
    value: string | string[] | RegExp;
    weight: number;
}
interface ModeDisplay {
    color: string;
    animation: boolean;
    duration: number;
    prefix: string;
    suffix: string;
}
interface ModeI18n {
    name: string;
    description: string;
    purpose: string;
    useCases: string[];
}
interface ModeMetadata {
    version: string;
    author: string;
    created: Date;
    updated: Date;
    tags: string[];
    experimental: boolean;
    deprecated: boolean;
}
interface ModeRecognitionResult {
    mode: ModeDefinition;
    confidence: number;
    reasoning: string;
    alternatives: Array<{
        mode: ModeDefinition;
        confidence: number;
    }>;
    triggers: Array<{
        type: ModeTriggerType;
        score: number;
        details: string;
    }>;
}
interface ModeContext {
    currentMode?: ModeDefinition;
    previousModes: ModeHistoryEntry[];
    userInput: string;
    language: string;
    commandHistory: string[];
    projectContext?: ProjectContext;
    errorState?: ErrorContext;
    userPatterns: UserPattern[];
    timestamp: Date;
}
interface ModeHistoryEntry {
    mode: ModeDefinition;
    startTime: Date;
    endTime?: Date;
    duration?: number;
    trigger: ModeTriggerType;
    userFeedback?: 'positive' | 'negative' | 'neutral';
}
interface ProjectContext {
    type: 'code' | 'documentation' | 'configuration' | 'media' | 'other';
    files: string[];
    languages: string[];
    frameworks: string[];
    hasErrors: boolean;
    hasTests: boolean;
}
interface ErrorContext {
    type: 'syntax' | 'runtime' | 'build' | 'lint' | 'test' | 'network';
    message: string;
    location?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
}
interface UserPattern {
    sequence: string[];
    frequency: number;
    lastUsed: Date;
    success: number;
}
interface ModeConfig {
    confidenceThreshold: number;
    autoSwitchEnabled: boolean;
    confirmationRequired: boolean;
    showTransitions: boolean;
    animationEnabled: boolean;
    colorEnabled: boolean;
    learningEnabled: boolean;
    patternTrackingEnabled: boolean;
    feedbackEnabled: boolean;
    defaultLanguage: string;
    supportedLanguages: string[];
    maxHistoryEntries: number;
    maxPatterns: number;
    recognitionTimeout: number;
}

/**
 * Internal Mode Service - Main Orchestrator
 *
 * Central service for managing MARIA CODE's internal mode system.
 * Integrates with Intelligent Router for real-time mode recognition and switching.
 */

declare class InternalModeService extends EventEmitter {
    private modeRegistry;
    private recognitionEngine;
    private displayManager;
    private historyTracker;
    private currentMode;
    private config;
    private initialized;
    private recognitionInProgress;
    constructor(config?: Partial<ModeConfig>);
    initialize(): Promise<void>;
    /**
     * Recognize and potentially switch mode based on user input
     */
    recognizeMode(userInput: string, context?: Partial<ModeContext>): Promise<ModeRecognitionResult | null>;
    /**
     * Manually set a specific mode
     */
    setMode(mode: ModeDefinition | string, trigger?: 'manual' | 'intent' | 'context', isInitial?: boolean): Promise<boolean>;
    /**
     * Get current mode
     */
    getCurrentMode(): ModeDefinition | null;
    /**
     * Get all available modes
     */
    getAllModes(): ModeDefinition[];
    /**
     * Search modes by query
     */
    searchModes(query: string, language?: string): ModeDefinition[];
    /**
     * Get mode by ID
     */
    getModeById(id: string): ModeDefinition | undefined;
    /**
     * Get mode history
     */
    getModeHistory(): ModeHistoryEntry[];
    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<ModeConfig>): void;
    /**
     * Get current configuration
     */
    getConfig(): ModeConfig;
    /**
     * Provide feedback on mode accuracy
     */
    provideFeedback(modeId: string, wasCorrect: boolean, userInput?: string): Promise<void>;
    /**
     * Get mode statistics
     */
    getStatistics(): {
        totalModes: number;
        currentMode: string | null;
        modeChanges: number;
        averageConfidence: number;
        mostUsedModes: Array<{
            mode: string;
            count: number;
        }>;
    };
    /**
     * Export mode data for backup/transfer
     */
    exportData(): Promise<{
        config: ModeConfig;
        history: ModeHistoryEntry[];
        patterns: unknown[];
    }>;
    /**
     * Import mode data from backup
     */
    importData(data: {
        config?: Partial<ModeConfig>;
        history?: ModeHistoryEntry[];
        patterns?: unknown[];
    }): Promise<void>;
    /**
     * Reset to default state
     */
    reset(): Promise<void>;
    /**
     * Dispose and cleanup
     */
    dispose(): void;
    private switchToMode;
    private setupEventListeners;
}
declare function getInternalModeService(config?: Partial<ModeConfig>): InternalModeService;

/**
 * Linux Intelligence Engine
 * Core intelligence functions for autonomous system administration
 */
interface SystemState {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    activeProcesses: number;
    systemLoad: number[];
    uptime: number;
}
interface CommandValidation {
    isValid: boolean;
    riskLevel: 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    warnings: string[];
    suggestions: string[];
}
interface UserIntent {
    action: string;
    target: string;
    confidence: number;
    category: string;
}
interface ExecutionResult {
    success: boolean;
    output: string;
    error?: string;
    metrics: {
        executionTime: number;
        resourceUsage: number;
    };
}
interface Workflow {
    id: string;
    name: string;
    steps: WorkflowStep[];
    created: Date;
}
interface WorkflowStep {
    command: string;
    description: string;
    validation: CommandValidation;
}
declare class LinuxIntelligenceEngine {
    private learningData;
    private workflows;
    /**
     * Analyze user intent from natural language input
     */
    analyzeUserIntent(input: string): Promise<UserIntent>;
    /**
     * Assess current system state
     */
    assessSystemState(): Promise<SystemState>;
    /**
     * Validate a command for safety and correctness
     */
    validateCommand(command: string): Promise<CommandValidation>;
    /**
     * Execute command with intelligence and monitoring
     */
    executeWithIntelligence(command: string): Promise<ExecutionResult>;
    /**
     * Create backup before risky operations
     */
    createBackup(target: string): Promise<boolean>;
    /**
     * Learn from command execution results
     */
    learnFromExecution(command: string, result: ExecutionResult): Promise<void>;
    /**
     * Create workflow from command sequence
     */
    createWorkflow(name: string, commands: string[]): Promise<Workflow>;
    /**
     * Analyze command for intelligence insights
     */
    analyzeCommand(command: string): Promise<any>;
    private extractAction;
    private extractTarget;
    private generateSuggestions;
    private generateDescription;
    private generateRecommendations;
    private generateAlternatives;
}
declare const linuxIntelligence: LinuxIntelligenceEngine;
declare const analyzeUserIntent: (input: string) => Promise<UserIntent>;
declare const assessSystemState: () => Promise<SystemState>;
declare const validateCommand: (command: string) => Promise<CommandValidation>;
declare const executeWithIntelligence: (command: string) => Promise<ExecutionResult>;
declare const createBackup: (target: string) => Promise<boolean>;
declare const learnFromExecution: (command: string, result: ExecutionResult) => Promise<void>;
declare const createWorkflow: (name: string, commands: string[]) => Promise<Workflow>;
declare const analyzeCommand: (command: string) => Promise<any>;

/**
 * Context Analyzer
 * Analyzes system context and user intent
 */
declare class ContextAnalyzer {
    private context;
    analyze(input: string): Promise<any>;
    getContext(): Map<string, any>;
    clearContext(): void;
}

/**
 * Command Knowledge Base
 * Stores and retrieves command patterns and knowledge
 */
declare class CommandKnowledgeBase {
    private commands;
    constructor();
    private initializeKnowledgeBase;
    getCommand(name: string): any;
    addCommand(name: string, info: any): void;
}

/**
 * Smart Executor
 * Intelligent command execution with monitoring
 */
declare class SmartExecutor {
    execute(command: string): Promise<any>;
    executeWithRetry(command: string, maxRetries?: number): Promise<any>;
}

/**
 * Safety Validator
 * Validates commands for safety and security
 */
declare class SafetyValidator {
    validate(command: string): Promise<any>;
    isCommandSafe(command: string): boolean;
}

/**
 * Learning Engine
 * Machine learning for command patterns
 */
declare class LearningEngine {
    private patterns;
    learn(command: string, result: any): Promise<void>;
    private extractPattern;
    getPatterns(): Map<string, any>;
}

/**
 * Workflow Automation
 * Automates complex command workflows
 */
declare class WorkflowAutomation {
    private workflows;
    create(name: string, commands: string[]): Promise<any>;
    execute(workflowId: string): Promise<any>;
}

/**
 * Anomaly Detector
 * Detects unusual system behavior and commands
 */
declare class AnomalyDetector {
    private baseline;
    private anomalies;
    detect(metric: string, value: number): Promise<boolean>;
    getAnomalies(): any[];
    clearAnomalies(): void;
}

/**
 * MARIA - Intelligent CLI Assistant
 * Entry point for the library
 */

declare const VERSION = "2.1.8";

export { AnomalyDetector, BaseCommand, type CommandArgs, type CommandContext, CommandKnowledgeBase, type CommandResult, ContextAnalyzer, DualMemoryEngine, type IMiddleware, type ISlashCommand, InputBox, type InputBoxConfig, InternalModeService, LearningEngine, LinuxIntelligenceEngine, MemoryCoordinator, type MemoryEvent, type MemoryResponse, type ModeConfig, type ModeContext, type ModeDefinition, type ModeRecognitionResult, type QualityMetrics, type ReasoningTrace, SafetyValidator, SmartExecutor, System1MemoryManager as System1Memory, System2MemoryManager as System2Memory, type UserPreferenceSet, VERSION, WorkflowAutomation, analyzeCommand, analyzeUserIntent, assessSystemState, commandRegistry, createBackup, createWorkflow, executeWithIntelligence, getCommandSuggestions, getCommandsByCategory, getInternalModeService, initializeSlashCommands, learnFromExecution, linuxIntelligence, validateCommand };
