/**
 * EnhancedModeIndicator Component
 * Enhanced visual indicators for internal modes with animations and context
 */

import chalk from "chalk";
import { EventEmitter } from "node:events";
// Custom enhanced mode type for this component
export type EnhancedInternalMode =
  | "✽ thinking"
  | "✽ ultra-thinking"
  | "✽ Deep Thinking..."
  | "✽ Researching..."
  | "✽ Analyzing..."
  | "✽ Evaluating..."
  | "✽ Reasoning..."
  | "✽ Contemplating..."
  | "✽ Reflecting..."
  | "✽ Processing..."
  | "✽ Creating..."
  | "✽ Brainstorming..."
  | "✽ Inventing..."
  | "✽ Designing..."
  | "✽ Drafting..."
  | "✽ Imagining..."
  | "✽ Conceptualizing..."
  | "✽ Innovating..."
  | "✽ Ideating..."
  | "✽ Synthesizing..."
  | "✽ Coding..."
  | "✽ Building..."
  | "✽ Implementing..."
  | "✽ Developing..."
  | "✽ Programming..."
  | "✽ Constructing..."
  | "✽ Architecting..."
  | "✽ Engineering..."
  | "✽ Assembling..."
  | "✽ Integrating..."
  | "✽ Testing..."
  | "✽ Debugging..."
  | "✽ Validating..."
  | "✽ Reviewing..."
  | "✽ Checking..."
  | "✽ Verifying..."
  | "✽ Inspecting..."
  | "✽ Auditing..."
  | "✽ Examining..."
  | "✽ Troubleshooting..."
  | "✽ Optimizing..."
  | "✽ Refactoring..."
  | "✽ Improving..."
  | "✽ Enhancing..."
  | "✽ Streamlining..."
  | "✽ Polishing..."
  | "✽ Tuning..."
  | "✽ Perfecting..."
  | "✽ Documenting..."
  | "✽ Planning..."
  | "🔬 DeepResearch..."
  | "🎯 PrecisionCoding..."
  | "🌊 FlowState..."
  | "🔮 Predictive..."
  | "🎨 CreativeFlow..."
  | "🏗️ Architectural..."
  | "🔍 Forensic..."
  | "⚡ RapidPrototype...";

/**
 * Mode display configuration
 */
export interface ModeDisplayConfig {
  showAnimations?: boolean;
  showDescription?: boolean;
  showIntensity?: boolean;
  compactMode?: boolean;
  autoHide?: boolean;
  hideDelay?: number; // ms
}

/**
 * Mode transition event
 */
export interface ModeTransition {
  from: EnhancedInternalMode | null;
  to: EnhancedInternalMode;
  reason?: string;
  confidence?: number;
  timestamp: Date;
}

/**
 * Enhanced mode indicator class
 */
export class EnhancedModeIndicator extends EventEmitter {
  private currentMode: EnhancedInternalMode | null = null;
  private previousModes: EnhancedInternalMode[] = [];
  private config: Required<ModeDisplayConfig>;
  private hideTimer: NodeJS.Timeout | null = null;
  private animationFrame: number = 0;
  private animationInterval: NodeJS.Timeout | null = null;

  // Mode information with enhanced metadata
  private readonly modeInfo: Record<
    EnhancedInternalMode,
    {
      category: string;
      intensity: "low" | "medium" | "high" | "maximum";
      _color: typeof chalk.Color;
      description: string;
      _animation: string[];
      triggers: string[];
    }
  > = {
    // Basic Reasoning Modes (10)
    "✽ thinking": {
      category: "Reasoning",
      intensity: "medium",
      _color: "yellow",
      description: "Basic thinking and cognitive processing",
      _animation: ["🤔", "💭", "🧠", "⚡"],
      triggers: ["general questions", "basic reasoning"],
    },
    "✽ ultra-thinking": {
      category: "Reasoning",
      intensity: "high",
      _color: "yellow",
      description: "Intensified thinking and deep analysis",
      _animation: ["🧠", "⚡", "💥", "🌟"],
      triggers: ["complex problems", "deep analysis"],
    },
    "✽ Deep Thinking...": {
      category: "Reasoning",
      intensity: "high",
      _color: "blue",
      description: "Deep analytical reasoning and problem decomposition",
      _animation: ["🤔", "💭", "🧠", "⚡"],
      triggers: ["complex problems", "multi-step analysis"],
    },
    "✽ Researching...": {
      category: "Reasoning",
      intensity: "medium",
      _color: "blue",
      description: "Information gathering and research activities",
      _animation: ["🔍", "📚", "📊", "🔬"],
      triggers: ["research requests", "information needs"],
    },
    "✽ Analyzing...": {
      category: "Reasoning",
      intensity: "medium",
      _color: "cyan",
      description: "Systematic analysis and examination",
      _animation: ["🔍", "📊", "⚖️", "📈"],
      triggers: ["analysis tasks", "data examination"],
    },
    "✽ Evaluating...": {
      category: "Reasoning",
      intensity: "medium",
      _color: "cyan",
      description: "Critical evaluation and assessment",
      _animation: ["⚖️", "📊", "🎯", "✅"],
      triggers: ["evaluation requests", "assessment tasks"],
    },
    "✽ Reasoning...": {
      category: "Reasoning",
      intensity: "medium",
      _color: "yellow",
      description: "Logical reasoning and deduction",
      _animation: ["🧠", "⚡", "🎯", "💡"],
      triggers: ["logical problems", "deductive reasoning"],
    },
    "✽ Contemplating...": {
      category: "Reasoning",
      intensity: "low",
      _color: "gray",
      description: "Thoughtful contemplation and reflection",
      _animation: ["🤔", "💭", "🌙", "✨"],
      triggers: ["philosophical questions", "reflection"],
    },
    "✽ Reflecting...": {
      category: "Reasoning",
      intensity: "low",
      _color: "gray",
      description: "Self-reflection and introspection",
      _animation: ["💭", "🪞", "🌊", "🔄"],
      triggers: ["self-analysis", "retrospection"],
    },
    "✽ Processing...": {
      category: "Reasoning",
      intensity: "medium",
      _color: "white",
      description: "Information processing and synthesis",
      _animation: ["⚙️", "🔄", "💻", "📊"],
      triggers: ["data processing", "information synthesis"],
    },

    // Creative Modes (10)
    "✽ Creating...": {
      category: "Creative",
      intensity: "high",
      _color: "magenta",
      description: "Creative generation and innovation",
      _animation: ["🎨", "✨", "💡", "🌟"],
      triggers: ["creative tasks", "innovation requests"],
    },
    "✽ Brainstorming...": {
      category: "Creative",
      intensity: "high",
      _color: "magenta",
      description: "Idea generation and brainstorming",
      _animation: ["💡", "🌟", "⚡", "🎆"],
      triggers: ["brainstorming", "idea generation"],
    },
    "✽ Inventing...": {
      category: "Creative",
      intensity: "high",
      _color: "magenta",
      description: "Invention and novel solution creation",
      _animation: ["🔧", "⚙️", "💡", "🚀"],
      triggers: ["invention tasks", "novel solutions"],
    },
    "✽ Designing...": {
      category: "Creative",
      intensity: "medium",
      _color: "magenta",
      description: "Design and creative planning",
      _animation: ["🎨", "📐", "✏️", "🎯"],
      triggers: ["design tasks", "creative planning"],
    },
    "✽ Drafting...": {
      category: "Creative",
      intensity: "low",
      _color: "magenta",
      description: "Initial drafting and sketching",
      _animation: ["✏️", "📝", "📋", "📄"],
      triggers: ["drafting", "initial writing"],
    },
    "✽ Imagining...": {
      category: "Creative",
      intensity: "medium",
      _color: "magenta",
      description: "Creative imagination and visualization",
      _animation: ["🌈", "✨", "🔮", "💫"],
      triggers: ["imagination tasks", "visualization"],
    },
    "✽ Conceptualizing...": {
      category: "Creative",
      intensity: "high",
      _color: "magenta",
      description: "Concept development and abstraction",
      _animation: ["🧠", "💡", "🌟", "⚡"],
      triggers: ["concept development", "abstraction"],
    },
    "✽ Innovating...": {
      category: "Creative",
      intensity: "high",
      _color: "magenta",
      description: "Innovation and breakthrough thinking",
      _animation: ["🚀", "⚡", "💥", "🌟"],
      triggers: ["innovation requests", "breakthrough solutions"],
    },
    "✽ Ideating...": {
      category: "Creative",
      intensity: "medium",
      _color: "magenta",
      description: "Idea development and exploration",
      _animation: ["💡", "🌟", "✨", "🎯"],
      triggers: ["idea exploration", "creative thinking"],
    },
    "✽ Synthesizing...": {
      category: "Creative",
      intensity: "high",
      _color: "magenta",
      description: "Information synthesis and integration",
      _animation: ["🔄", "⚙️", "🌊", "🎯"],
      triggers: ["synthesis tasks", "integration work"],
    },

    // Implementation Modes (10)
    "✽ Coding...": {
      category: "Implementation",
      intensity: "high",
      _color: "cyan",
      description: "Code writing and programming",
      _animation: ["💻", "⌨️", "🔧", "⚡"],
      triggers: ["coding tasks", "programming work"],
    },
    "✽ Building...": {
      category: "Implementation",
      intensity: "high",
      _color: "cyan",
      description: "System building and construction",
      _animation: ["🏗️", "🔨", "⚙️", "🛠️"],
      triggers: ["building tasks", "construction work"],
    },
    "✽ Implementing...": {
      category: "Implementation",
      intensity: "high",
      _color: "cyan",
      description: "Solution implementation and execution",
      _animation: ["⚙️", "🔧", "💻", "✅"],
      triggers: ["implementation tasks", "execution work"],
    },
    "✽ Developing...": {
      category: "Implementation",
      intensity: "medium",
      _color: "cyan",
      description: "Development and creation work",
      _animation: ["💻", "🔧", "📊", "📈"],
      triggers: ["development tasks", "creation work"],
    },
    "✽ Programming...": {
      category: "Implementation",
      intensity: "high",
      _color: "cyan",
      description: "Programming and software development",
      _animation: ["💻", "⌨️", "🖥️", "📱"],
      triggers: ["programming tasks", "software development"],
    },
    "✽ Constructing...": {
      category: "Implementation",
      intensity: "medium",
      _color: "cyan",
      description: "Construction and assembly work",
      _animation: ["🔨", "🏗️", "⚙️", "🔧"],
      triggers: ["construction tasks", "assembly work"],
    },
    "✽ Architecting...": {
      category: "Implementation",
      intensity: "high",
      _color: "cyan",
      description: "Architecture design and system planning",
      _animation: ["📐", "🏗️", "🎯", "📊"],
      triggers: ["architecture tasks", "system design"],
    },
    "✽ Engineering...": {
      category: "Implementation",
      intensity: "high",
      _color: "cyan",
      description: "Engineering solutions and technical work",
      _animation: ["⚙️", "🔧", "🏗️", "⚡"],
      triggers: ["engineering tasks", "technical solutions"],
    },
    "✽ Assembling...": {
      category: "Implementation",
      intensity: "medium",
      _color: "cyan",
      description: "Component assembly and integration",
      _animation: ["🔧", "⚙️", "🔄", "📦"],
      triggers: ["assembly tasks", "component integration"],
    },
    "✽ Integrating...": {
      category: "Implementation",
      intensity: "medium",
      _color: "cyan",
      description: "System integration and connection",
      _animation: ["🔄", "🔗", "⚙️", "🌐"],
      triggers: ["integration tasks", "system connection"],
    },

    // Validation Modes (10)
    "✽ Testing...": {
      category: "Validation",
      intensity: "medium",
      _color: "green",
      description: "Testing and quality assurance",
      _animation: ["🧪", "🔍", "✅", "📊"],
      triggers: ["testing tasks", "quality assurance"],
    },
    "✽ Debugging...": {
      category: "Validation",
      intensity: "high",
      _color: "red",
      description: "Bug identification and fixing",
      _animation: ["🐛", "🔍", "🔧", "✅"],
      triggers: ["debugging", "error fixing"],
    },
    "✽ Validating...": {
      category: "Validation",
      intensity: "medium",
      _color: "green",
      description: "Validation and verification work",
      _animation: ["✅", "🔍", "⚖️", "📊"],
      triggers: ["validation tasks", "verification work"],
    },
    "✽ Reviewing...": {
      category: "Validation",
      intensity: "medium",
      _color: "green",
      description: "Code and content review",
      _animation: ["👁️", "📋", "✅", "📊"],
      triggers: ["review tasks", "content evaluation"],
    },
    "✽ Checking...": {
      category: "Validation",
      intensity: "low",
      _color: "green",
      description: "Basic checks and verification",
      _animation: ["✅", "🔍", "📋", "👁️"],
      triggers: ["checking tasks", "basic verification"],
    },
    "✽ Verifying...": {
      category: "Validation",
      intensity: "medium",
      _color: "green",
      description: "Verification and confirmation",
      _animation: ["✅", "🔍", "⚖️", "🎯"],
      triggers: ["verification tasks", "confirmation work"],
    },
    "✽ Inspecting...": {
      category: "Validation",
      intensity: "medium",
      _color: "green",
      description: "Detailed inspection and examination",
      _animation: ["🔍", "👁️", "📊", "🧐"],
      triggers: ["inspection tasks", "detailed examination"],
    },
    "✽ Auditing...": {
      category: "Validation",
      intensity: "high",
      _color: "green",
      description: "Comprehensive auditing and assessment",
      _animation: ["📋", "🔍", "⚖️", "📊"],
      triggers: ["auditing tasks", "comprehensive assessment"],
    },
    "✽ Examining...": {
      category: "Validation",
      intensity: "medium",
      _color: "green",
      description: "Careful examination and analysis",
      _animation: ["🔍", "🧐", "📊", "👁️"],
      triggers: ["examination tasks", "careful analysis"],
    },
    "✽ Troubleshooting...": {
      category: "Validation",
      intensity: "high",
      _color: "red",
      description: "Problem diagnosis and resolution",
      _animation: ["🔧", "🔍", "⚠️", "✅"],
      triggers: ["troubleshooting", "problem diagnosis"],
    },

    // Optimization Modes (10)
    "✽ Optimizing...": {
      category: "Optimization",
      intensity: "high",
      _color: "green",
      description: "Performance and efficiency optimization",
      _animation: ["⚡", "📈", "🎯", "🚀"],
      triggers: ["optimization requests", "performance improvement"],
    },
    "✽ Refactoring...": {
      category: "Optimization",
      intensity: "high",
      _color: "green",
      description: "Code refactoring and restructuring",
      _animation: ["🔄", "⚙️", "🔧", "✨"],
      triggers: ["refactoring", "code restructuring"],
    },
    "✽ Improving...": {
      category: "Optimization",
      intensity: "medium",
      _color: "green",
      description: "General improvement and enhancement",
      _animation: ["📈", "✨", "🎯", "⚡"],
      triggers: ["improvement tasks", "enhancement work"],
    },
    "✽ Enhancing...": {
      category: "Optimization",
      intensity: "medium",
      _color: "green",
      description: "Feature enhancement and augmentation",
      _animation: ["✨", "🌟", "📈", "🎯"],
      triggers: ["enhancement requests", "feature augmentation"],
    },
    "✽ Streamlining...": {
      category: "Optimization",
      intensity: "high",
      _color: "green",
      description: "Process streamlining and simplification",
      _animation: ["🌊", "⚡", "🎯", "🔄"],
      triggers: ["streamlining", "process simplification"],
    },
    "✽ Polishing...": {
      category: "Optimization",
      intensity: "low",
      _color: "green",
      description: "Final polishing and refinement",
      _animation: ["✨", "💎", "🪞", "🎯"],
      triggers: ["polishing", "final refinement"],
    },
    "✽ Tuning...": {
      category: "Optimization",
      intensity: "medium",
      _color: "green",
      description: "Performance tuning and adjustment",
      _animation: ["🎛️", "⚙️", "🔧", "📈"],
      triggers: ["tuning tasks", "performance adjustment"],
    },
    "✽ Perfecting...": {
      category: "Optimization",
      intensity: "high",
      _color: "green",
      description: "Achieving perfection and excellence",
      _animation: ["💎", "✨", "🏆", "🌟"],
      triggers: ["perfecting", "excellence achievement"],
    },
    "✽ Documenting...": {
      category: "Optimization",
      intensity: "low",
      _color: "gray",
      description: "Documentation creation and maintenance",
      _animation: ["📝", "📚", "📋", "📄"],
      triggers: ["documentation", "writing tasks"],
    },
    "✽ Planning...": {
      category: "Optimization",
      intensity: "medium",
      _color: "magenta",
      description: "Strategic planning and organization",
      _animation: ["🗓️", "🎯", "📋", "🗺️"],
      triggers: ["planning tasks", "strategic organization"],
    },

    // New Advanced Modes (8) - v2.0.0+
    "🔬 DeepResearch...": {
      category: "Reasoning",
      intensity: "maximum",
      _color: "cyan",
      description: "Advanced deep research and investigation",
      _animation: ["🔬", "🔍", "📊", "🧪"],
      triggers: ["deep research", "investigation work"],
    },
    "🎯 PrecisionCoding...": {
      category: "Implementation",
      intensity: "high",
      _color: "green",
      description: "High-precision coding and development",
      _animation: ["🎯", "💻", "⚡", "✅"],
      triggers: ["precision coding", "exact implementation"],
    },
    "🌊 FlowState...": {
      category: "Creative",
      intensity: "high",
      _color: "blue",
      description: "Creative flow state and peak performance",
      _animation: ["🌊", "✨", "🎨", "⚡"],
      triggers: ["flow state", "peak creativity"],
    },
    "🔮 Predictive...": {
      category: "Reasoning",
      intensity: "high",
      _color: "magenta",
      description: "Predictive analysis and forecasting",
      _animation: ["🔮", "📈", "🎯", "⚡"],
      triggers: ["prediction tasks", "forecasting work"],
    },
    "🎨 CreativeFlow...": {
      category: "Creative",
      intensity: "maximum",
      _color: "yellow",
      description: "Maximum creative flow and inspiration",
      _animation: ["🎨", "🌟", "💫", "🌈"],
      triggers: ["creative flow", "maximum inspiration"],
    },
    "🏗️ Architectural...": {
      category: "Implementation",
      intensity: "maximum",
      _color: "cyan",
      description: "Advanced architectural design and planning",
      _animation: ["🏗️", "📐", "🎯", "⚡"],
      triggers: ["architectural design", "system planning"],
    },
    "🔍 Forensic...": {
      category: "Validation",
      intensity: "maximum",
      _color: "red",
      description: "Forensic analysis and deep investigation",
      _animation: ["🔍", "🔬", "🕵️", "📊"],
      triggers: ["forensic analysis", "deep investigation"],
    },
    "⚡ RapidPrototype...": {
      category: "Implementation",
      intensity: "maximum",
      _color: "yellow",
      description: "Rapid prototyping and quick development",
      _animation: ["⚡", "🚀", "🔧", "💡"],
      triggers: ["rapid prototyping", "quick development"],
    },
  };

  constructor(_config: ModeDisplayConfig = {}) {
    super();
    this._config = {
      showAnimations: _config.showAnimations ?? true,
      showDescription: _config.showDescription ?? false,
      showIntensity: _config.showIntensity ?? true,
      compactMode: _config.compactMode ?? false,
      autoHide: _config.autoHide ?? false,
      hideDelay: _config.hideDelay ?? 5000,
    };
  }

  /**
   * Switch to a new mode
   */
  switchMode(
    _mode: EnhancedInternalMode,
    reason?: string,
    confidence?: number,
  ): void {
    const transition: ModeTransition = {
      from: this.currentMode,
      to: _mode,
      reason,
      confidence,
      timestamp: new Date(),
    };

    // Update mode history
    if (this.currentMode) {
      this.previousModes.unshift(this.currentMode);
      this.previousModes = this.previousModes.slice(0, 5); // Keep last 5 modes
    }

    this.currentMode = _mode;

    // Display mode switch
    this.displayModeSwitch(transition);

    // Start _animation if enabled
    if (this.config.showAnimations) {
      this.startAnimation();
    }

    // Auto-hide timer
    if (this.config.autoHide) {
      this.scheduleAutoHide();
    }

    this.emit("mode-changed", transition);
  }

  /**
   * Display mode switch with enhanced visuals
   */
  private displayModeSwitch(transition: ModeTransition): void {
    const _modeData = this.modeInfo[transition.to];
    const _color = chalk[_modeData._color];

    if (this.config.compactMode) {
      this.displayCompactMode(transition.to, _modeData, _color);
    } else {
      this.displayDetailedMode(transition, _modeData, _color);
    }
  }

  /**
   * Display compact mode indicator
   */
  private displayCompactMode(
    _mode: EnhancedInternalMode,
    _modeData: unknown,
    _color: unknown,
  ): void {
    const _intensityBar = this.getIntensityBar(_modeData.intensity);
    const _animation = _modeData._animation[0];

    console.log(`${_color(`[${_animation} ${_mode}]`)} ${_intensityBar}`);
  }

  /**
   * Display detailed mode information
   */
  private displayDetailedMode(
    _transition: ModeTransition,
    _modeData: unknown,
    _color: unknown,
  ): void {
    console.log(
      chalk.gray("\n┌─ Mode Transition ─────────────────────────────────────┐"),
    );

    // Mode name and category
    const _animation =
      _modeData._animation[this.animationFrame % _modeData._animation.length];
    console.log(
      `│ ${_color(`${_animation} ${_transition.to}`)} ${chalk.gray(`[${_modeData.category}]`)}`,
    );

    // Intensity indicator
    if (this.config.showIntensity) {
      const _intensityBar = this.getIntensityBar(_modeData.intensity);
      console.log(`│ Intensity: ${_intensityBar}`);
    }

    // Description
    if (this.config.showDescription) {
      console.log(`│ ${chalk.gray(_modeData.description)}`);
    }

    // Transition info
    if (_transition.from) {
      console.log(`│ ${chalk.dim(`${_transition.from} → ${_transition.to}`)}`);
    }

    if (_transition.reason) {
      console.log(`│ Reason: ${chalk.yellow(_transition.reason)}`);
    }

    if (_transition.confidence) {
      console.log(
        `│ Confidence: ${chalk.cyan(`${(_transition.confidence * 100).toFixed(0)}%`)}`,
      );
    }

    console.log(
      chalk.gray("└───────────────────────────────────────────────────────┘"),
    );
  }

  /**
   * Get intensity bar visualization
   */
  private getIntensityBar(
    intensity: "low" | "medium" | "high" | "maximum",
  ): string {
    const _bars = {
      low: chalk.green("▁▁▁") + chalk.gray("▁▁"),
      medium: chalk.yellow("▃▃▃▃") + chalk.gray("▁"),
      high: chalk.red("▅▅▅▅▅"),
      maximum: chalk.magenta("▇▇▇▇▇") + chalk.red("▇"),
    };
    return _bars[intensity];
  }

  /**
   * Start mode _animation
   */
  private startAnimation(): void {
    this.stopAnimation();

    this.animationInterval = setInterval(() => {
      this.animationFrame = (this.animationFrame + 1) % 4;

      if (this.currentMode && !this.config.compactMode) {
        // Update _animation frame in status line
        const _modeData = this.modeInfo[this.currentMode];
        const _animation = _modeData._animation[this.animationFrame];
        const _color = chalk[_modeData._color];

        // Only show if not auto-hiding
        if (!this.config.autoHide || !this.hideTimer) {
          process.stdout.write(
            `\r${_color(`${_animation} ${this.currentMode}`)} `,
          );
        }
      }
    }, 500);
  }

  /**
   * Stop mode _animation
   */
  private stopAnimation(): void {
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
    }
  }

  /**
   * Schedule auto-hide
   */
  private scheduleAutoHide(): void {
    this.clearAutoHide();

    this.hideTimer = setTimeout(() => {
      this.stopAnimation();
      process.stdout.write("\r" + " ".repeat(50) + "\r"); // Clear line
      this.hideTimer = null;
    }, this.config.hideDelay);
  }

  /**
   * Clear auto-hide timer
   */
  private clearAutoHide(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  /**
   * Show mode history
   */
  showModeHistory(): void {
    if (this.previousModes.length === 0) {
      console.log(chalk.gray("No mode history available"));
      return;
    }

    console.log(chalk.cyan("\n📊 Mode History:"));

    if (this.currentMode) {
      const _currentData = this.modeInfo[this.currentMode];
      const _color = chalk[_currentData._color];
      console.log(
        `  ${_color("●")} ${this.currentMode} ${chalk.gray("(current)")}`,
      );
    }

    this.previousModes.forEach((mode, _index) => {
      const _modeData = this.modeInfo[mode];
      const _color = chalk[_modeData._color];
      console.log(
        `  ${_color("○")} ${mode} ${chalk.gray(`(${_index + 1} ago)`)}`,
      );
    });
  }

  /**
   * Show available modes by category
   */
  showAvailableModes(): void {
    console.log(chalk.cyan("\n🎯 Available Internal Modes:\n"));

    const _categories = new Set(
      Object.values(this.modeInfo).map((m) => m.category),
    );

    for (const category of Array.from(_categories)) {
      console.log(chalk.yellow(`${category}:`));

      const _categoryModes = Object.entries(this.modeInfo).filter(
        ([_, data]) => data.category === category,
      );

      for (const [mode, data] of _categoryModes) {
        const _color = chalk[data._color];
        const _intensityBar = this.getIntensityBar(data.intensity);
        console.log(`  ${_color(data.animation[0])} ${mode} ${_intensityBar}`);
        console.log(`    ${chalk.gray(data.description)}`);
      }
      console.log("");
    }
  }

  /**
   * Get current mode
   */
  getCurrentMode(): EnhancedInternalMode | null {
    return this.currentMode;
  }

  /**
   * Get mode information
   */
  getModeInfo(_mode: EnhancedInternalMode) {
    return this.modeInfo[_mode];
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopAnimation();
    this.clearAutoHide();
    this.removeAllListeners();
  }
}

export default EnhancedModeIndicator;
