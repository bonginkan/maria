/**
 * Enhanced CLI Interface - Main orchestrator for the visual CLI system
 */
import chalk from "chalk";
import * as readline from "readline";
import { InputRenderer, InputBoxConfig } from "./InputRenderer";
import { FileDropHandler, _DroppedFile } from "./FileDropHandler";
import { OCRProcessor, OCRResult } from "./OCRProcessor";
import { ReferenceManager } from "./ReferenceManager";
import { ResponseRenderer } from "./ResponseRenderer";
import { MariaAI } from "../../maria-ai";

export interface EnhancedCLIConfig {
  inputBox: Partial<InputBoxConfig>;
  enableFileDrops: boolean;
  enableOCR: boolean;
  enableImageAnalysis: boolean;
  autoResize: boolean;
  showProgressReports: boolean;
}

export interface CLISession {
  start(): Promise<void>;
  stop(): void;
  processInput(_input: string): Promise<void>;
  addFile(_filePath: string): Promise<boolean>;
  addURL(url: string): Promise<boolean>;
}

export class EnhancedCLIInterface implements CLISession {
  private inputRenderer: InputRenderer;
  private fileDropHandler: FileDropHandler;
  private ocrProcessor: OCRProcessor;
  private referenceManager: ReferenceManager;
  private responseRenderer: ResponseRenderer;
  private maria: MariaAI;
  private rl: readline.Interface | null = null;
  private running: boolean = false;
  private config: EnhancedCLIConfig;

  constructor(_maria: MariaAI, config: Partial<EnhancedCLIConfig> = {}) {
    this._maria = _maria;
    this.config = {
      inputBox: {
        width: 120,
        height: 6,
        title: "MARIA - Enhanced CLI Interface",
        borderStyle: "single",
        borderColor: "white",
        textColor: "white",
      },
      enableFileDrops: true,
      enableOCR: true,
      enableImageAnalysis: true,
      autoResize: true,
      showProgressReports: true,
      ...config,
    };

    // Initialize components
    this.inputRenderer = new InputRenderer(this.config.inputBox);
    this.fileDropHandler = new FileDropHandler({
      enableOCR: this.config.enableOCR,
      enableImageAnalysis: this.config.enableImageAnalysis,
    });
    this.ocrProcessor = new OCRProcessor();
    this.referenceManager = new ReferenceManager();
    this.responseRenderer = new ResponseRenderer({
      maxWidth: this.config.inputBox.width || 120,
      showProgress: this.config.showProgressReports,
    });
  }

  /**
   * Initialize and start the enhanced CLI interface
   */
  async start(): Promise<void> {
    this.running = true;

    try {
      // Display welcome message
      this.displayWelcome();

      // Initialize components
      await this.initializeComponents();

      // Set up readline interface
      this.setupReadlineInterface();

      // Handle terminal resize
      if (this.config.autoResize) {
        this.setupResizeHandler();
      }

      // Main interaction loop
      await this.startInteractionLoop();
    } catch (_error) {
      console.log(
        chalk.red(
          `❌ Failed to start enhanced CLI: ${_error instanceof Error ? _error.message : "Unknown _error"}`,
        ),
      );
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Stop the CLI interface
   */
  stop(): void {
    this.running = false;
    this.rl?.close();
  }

  /**
   * Display welcome message with visual design
   */
  private displayWelcome(): void {
    console.clear();
    console.log(
      chalk.blue.bold(
        "╔══════════════════════════════════════════════════════════╗",
      ),
    );
    console.log(
      chalk.blue.bold("║") +
        chalk.white.bold(
          "              MARIA Enhanced CLI Interface               ",
        ) +
        chalk.blue.bold("║"),
    );
    console.log(
      chalk.blue.bold("║") +
        chalk.gray("       Visual Input Box with File/Image Support        ") +
        chalk.blue.bold("║"),
    );
    console.log(
      chalk.blue.bold(
        "╚══════════════════════════════════════════════════════════╝",
      ),
    );
    console.log();
    console.log(chalk.cyan("Features:"));
    console.log(chalk.white("  📦 Visual Input Box (120 chars wide)"));
    console.log(chalk.white("  📎 Drag & Drop Files/Images"));
    console.log(chalk.white("  🔍 OCR Text Extraction"));
    console.log(chalk.white("  🧠 AI Response Outside Input Area"));
    console.log(chalk.white("  ⚡ Real-time Progress Reporting"));
    console.log();
    console.log(
      chalk.gray(
        "Instructions: Type in the _input box, drag _files, or use URLs",
      ),
    );
    console.log(chalk.gray("Commands: /help, /exit, /clear, /_files, /refs"));
    console.log();
  }

  /**
   * Initialize all components
   */
  private async initializeComponents(): Promise<void> {
    const _steps = [
      { id: "file_handler", description: "Initializing _file drop handler" },
      { id: "ocr_processor", description: "Loading OCR processor" },
      { id: "maria_ai", description: "Connecting to MARIA AI" },
    ];

    for (const step of _steps) {
      this.responseRenderer.displayProgressStep({
        ...step,
        status: "processing",
        timestamp: new Date(),
      });

      try {
        switch (step.id) {
          case "file_handler":
            await this.fileDropHandler.initialize();
            break;
          case "ocr_processor":
            if (this.config.enableOCR) {
              await this.ocrProcessor.initialize();
            }
            break;
          case "maria_ai":
            await this.maria.initialize();
            break;
        }

        this.responseRenderer.updateProgressStep(step.id, {
          status: "completed",
          details: "Ready",
        });
      } catch (_error) {
        this.responseRenderer.updateProgressStep(step.id, {
          status: "failed",
          details: _error instanceof Error ? _error.message : "Unknown _error",
        });
      }
    }

    console.log();
  }

  /**
   * Set up readline interface
   */
  private setupReadlineInterface(): void {
    this.rl = readline.createInterface({
      _input: process.stdin,
      output: process.stdout,
      terminal: true,
      historySize: 100,
    });

    // Handle Ctrl+C
    this.rl.on("SIGINT", () => {
      this.responseRenderer.displayWarning("Use /exit to quit gracefully");
      this.promptForInput();
    });
  }

  /**
   * Set up terminal resize handler
   */
  private setupResizeHandler(): void {
    process.stdout.on("resize", () => {
      this.inputRenderer.autoResize();
      this.redrawInterface();
    });
  }

  /**
   * Main interaction loop
   */
  private async startInteractionLoop(): Promise<void> {
    while (this.running) {
      try {
        // Draw the _input box
        this.inputRenderer.drawInputBox();

        // Initialize response area
        this.responseRenderer.initializeResponseArea(
          this.config.inputBox.height || 6,
        );

        // Show _file _summary if _files are attached
        this.showAttachedFilesSummary();

        // Get user _input
        const _input = await this.getUserInput();

        if (!_input || !this.running) break;

        // Process the _input
        await this.processInput(_input);
      } catch (_error) {
        this.responseRenderer.displayError(
          "Session _error",
          _error instanceof Error ? _error.message : "Unknown _error",
        );
      }
    }
  }

  /**
   * Get user _input with visual feedback
   */
  private getUserInput(): Promise<string> {
    return new Promise((resolve) => {
      if (!this.rl) {
        resolve("");
        return;
      }

      this.rl.question("", (answer) => {
        resolve(answer.trim());
      });
    });
  }

  /**
   * Process user _input and handle commands
   */
  async processInput(_input: string): Promise<void> {
    if (!_input) return;

    // Handle special commands
    if (_input.startsWith("/")) {
      await this.handleCommand(_input);
      return;
    }

    // Check if _input is a URL
    if (this.isURL(_input)) {
      await this.addURL(_input);
      return;
    }

    // Regular chat _input - process with AI
    await this.processChatInput(_input);
  }

  /**
   * Process chat _input with AI
   */
  private async processChatInput(_input: string): Promise<void> {
    try {
      // Start response display
      this.responseRenderer.startResponse();

      // Generate _context from references
      const _context = this.referenceManager.generateContext();
      const _fullInput = _input + _context;

      // Process any pending OCR tasks
      await this.processOCRTasks();

      // Stream AI response
      const _stream = this.maria.chatStream(_fullInput);
      let isFirstChunk = true;

      for await (const chunk of _stream) {
        this.responseRenderer.streamContent(chunk, isFirstChunk);
        if (isFirstChunk) isFirstChunk = false;
      }

      // Complete response
      this.responseRenderer.completeResponse();
    } catch (_error) {
      this.responseRenderer.displayError(
        "AI processing failed",
        _error instanceof Error ? _error.message : "Unknown _error",
      );
    }
  }

  /**
   * Handle special commands
   */
  private async handleCommand(command: string): Promise<void> {
    const _parts = command.split(" ");
    const _cmd = _parts[0].toLowerCase();
    const _args = _parts.slice(1);

    switch (_cmd) {
      case "/help":
        this.showHelp();
        break;

      case "/exit":
      case "/quit":
        this.running = false;
        break;

      case "/clear":
        console.clear();
        this.displayWelcome();
        break;

      case "/_files":
        this.showFiles();
        break;

      case "/refs":
        this.showReferences();
        break;

      case "/add":
        if (_args[0]) {
          await this.addFile(_args[0]);
        } else {
          this.responseRenderer.displayWarning("Usage: /add <file_path>");
        }
        break;

      case "/url":
        if (_args[0]) {
          await this.addURL(_args[0]);
        } else {
          this.responseRenderer.displayWarning("Usage: /url <url>");
        }
        break;

      case "/clearrefs":
        this.referenceManager.clearReferences();
        this.fileDropHandler.clearFiles();
        break;

      default:
        this.responseRenderer.displayWarning(
          `Unknown command: ${_cmd}. Type /help for available commands.`,
        );
    }
  }

  /**
   * Add _file to the system
   */
  async addFile(_filePath: string): Promise<boolean> {
    const _file = await this.fileDropHandler.addFile(_filePath);
    if (!_file) return false;

    // Process OCR if it's an image
    let _ocrResult: OCRResult | undefined;
    if (_file.isImage && this.config.enableOCR) {
      _ocrResult = await this.ocrProcessor.processImage(_file);
    }

    // Add to _reference manager
    this.referenceManager.addFileReference(_file, _ocrResult);

    return true;
  }

  /**
   * Add URL to the system
   */
  async addURL(url: string): Promise<boolean> {
    const _reference = await this.referenceManager.addUrlReference(url);
    return _reference !== null;
  }

  /**
   * Process pending OCR tasks
   */
  private async processOCRTasks(): Promise<void> {
    if (!this.config.enableOCR) return;

    const _images = this.fileDropHandler.getImagesForProcessing();
    if (_images.length === 0) return;

    for (const image of _images) {
      const _reference = this.referenceManager.getReference(`ref_${image.id}`);
      if (_reference && !_reference.metadata._ocrResult) {
        const _ocrResult = await this.ocrProcessor.processImage(image);
        if (_ocrResult) {
          reference.metadata._ocrResult = _ocrResult;
        }
      }
    }
  }

  /**
   * Show attached _files _summary
   */
  private showAttachedFilesSummary(): void {
    const _summary = this.referenceManager.getSummary();
    if (_summary !== "No references attached") {
      this.inputRenderer.showDropIndicator(
        this.referenceManager.getAllReferences().length,
      );
    }
  }

  /**
   * Show help information
   */
  private showHelp(): void {
    this.responseRenderer.displayInfo(
      "Enhanced CLI Commands",
      "/help - Show this help\n" +
        "/exit - Exit the interface\n" +
        "/clear - Clear screen\n" +
        "/_files - Show attached _files\n" +
        "/refs - Show references\n" +
        "/add <path> - Add _file\n" +
        "/url <url> - Add URL _reference\n" +
        "/clearrefs - Clear all references",
    );
  }

  /**
   * Show attached _files
   */
  private showFiles(): void {
    const _files = this.fileDropHandler.getDroppedFiles();
    if (_files.length === 0) {
      this.responseRenderer.displayInfo("No _files attached");
      return;
    }

    const _fileInfo = _files.map((_file) => ({
      name: _file.name,
      status: "completed",
      details: `${_file.type} - ${this.formatFileSize(_file.size)}`,
    }));

    this.responseRenderer.displayReferenceStatus(_fileInfo);
  }

  /**
   * Show references
   */
  private showReferences(): void {
    const _stats = this.referenceManager.getStatistics();
    this.responseRenderer.displaySuccess(
      `References: ${_stats.total} total`,
      Object.entries(_stats.byType)
        .map(([type, count]) => `${type}: ${count}`)
        .join(", "),
    );
  }

  /**
   * Check if _input is a URL
   */
  private isURL(_input: string): boolean {
    try {
      new URL(_input);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Format _file size
   */
  private formatFileSize(bytes: number): string {
    const _units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < _units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)}${_units[unitIndex]}`;
  }

  /**
   * Redraw interface after resize
   */
  private redrawInterface(): void {
    console.clear();
    this.displayWelcome();
  }

  /**
   * Prompt for _input (used after interruptions)
   */
  private promptForInput(): void {
    if (this.rl && this.running) {
      this.rl.prompt();
    }
  }

  /**
   * Clean up resources
   */
  private async cleanup(): Promise<void> {
    this.rl?.close();

    if (this.ocrProcessor.isReady()) {
      await this.ocrProcessor.cleanup();
    }

    await this.maria.close();

    this.responseRenderer.displaySuccess("Enhanced CLI interface closed");
  }
}
