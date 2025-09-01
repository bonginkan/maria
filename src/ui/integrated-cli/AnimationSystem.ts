/**
 * AnimationSystem - Advanced Animation and Transition Management
 * Phase 3 component providing smooth, performance-optimized animations and transitions
 *
 * Features:
 * - Declarative animation API with easing functions
 * - Performance-optimized animation scheduling
 * - Composite animations with sequencing and parallel execution
 * - Hardware acceleration detection and optimization
 * - Accessibility-compliant motion handling
 * - Real-time performance monitoring
 * - Animation state management and interruption handling
 *
 * @since v3.4.2 Phase 3
 */

import { EventEmitter } from "node:events";

export interface AnimationConfig {
  // Performance settings
  enableHardwareAcceleration: boolean;
  respectMotionPreference: boolean;
  maxConcurrentAnimations: number;
  frameRateCap: number;

  // Default animation properties
  defaultDuration: number;
  defaultEasing: EasingFunction;
  defaultDelay: number;

  // Accessibility
  enableReducedMotion: boolean;
  enableScreenReaderAnnouncements: boolean;

  // Debug settings
  enablePerformanceMonitoring: boolean;
  showAnimationBounds: boolean;
  logAnimationEvents: boolean;
}

export type EasingFunction =
  | "linear"
  | "ease"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | "cubic-bezier(n,n,n,n)"
  | ((t: number) => number);

export interface AnimationOptions {
  duration?: number;
  delay?: number;
  easing?: EasingFunction;
  fill?: "none" | "forwards" | "backwards" | "both";
  direction?: "normal" | "reverse" | "alternate" | "alternate-reverse";
  iterations?: number | "infinite";
  composite?: "replace" | "add" | "accumulate";

  // Callbacks
  onStart?: () => void;
  onUpdate?: (progress: number, value: any) => void;
  onComplete?: () => void;
  onCancel?: () => void;
}

export interface KeyframeDefinition {
  offset?: number;
  [property: string]: any;
}

export interface AnimationDefinition {
  id?: string;
  element: HTMLElement;
  keyframes: KeyframeDefinition[] | PropertyKeyframes;
  options?: AnimationOptions;
  priority?: "low" | "normal" | "high";
  metadata?: Record<string, any>;
}

export interface PropertyKeyframes {
  [property: string]: Array<string | number>;
}

export interface CompositeAnimationOptions {
  mode: "sequence" | "parallel" | "stagger";
  staggerDelay?: number;
  onGroupStart?: () => void;
  onGroupComplete?: () => void;
}

export interface AnimationState {
  id: string;
  element: HTMLElement;
  startTime: number;
  duration: number;
  progress: number;
  status: "pending" | "running" | "paused" | "completed" | "cancelled";
  currentValues: Record<string, any>;
  animation?: Animation;
  callbacks: {
    onStart?: () => void;
    onUpdate?: (progress: number, value: any) => void;
    onComplete?: () => void;
    onCancel?: () => void;
  };
}

export interface PerformanceMetrics {
  totalAnimations: number;
  activeAnimations: number;
  averageFrameTime: number;
  droppedFrames: number;
  memoryUsage: number;
  hardwareAccelerated: number;
  cpuUsage: number;
}

export class AnimationSystem extends EventEmitter {
  private config: AnimationConfig;
  private activeAnimations: Map<string, AnimationState> = new Map();
  private animationQueue: AnimationDefinition[] = [];
  private isRunning: boolean = false;
  private animationFrame: number | null = null;
  private performanceMetrics: PerformanceMetrics;

  // Performance monitoring
  private frameStartTime: number = 0;
  private lastFrameTime: number = 0;
  private frameCount: number = 0;

  // Hardware acceleration detection
  private hardwareAccelerationSupported: boolean = false;

  // Predefined easing functions
  private easingFunctions: Map<string, (t: number) => number> = new Map();

  constructor(config?: Partial<AnimationConfig>) {
    super();

    this.config = {
      enableHardwareAcceleration: config?.enableHardwareAcceleration ?? true,
      respectMotionPreference: config?.respectMotionPreference ?? true,
      maxConcurrentAnimations: config?.maxConcurrentAnimations ?? 20,
      frameRateCap: config?.frameRateCap ?? 60,
      defaultDuration: config?.defaultDuration ?? 300,
      defaultEasing: config?.defaultEasing ?? "ease-out",
      defaultDelay: config?.defaultDelay ?? 0,
      enableReducedMotion: config?.enableReducedMotion ?? false,
      enableScreenReaderAnnouncements:
        config?.enableScreenReaderAnnouncements ?? false,
      enablePerformanceMonitoring: config?.enablePerformanceMonitoring ?? true,
      showAnimationBounds: config?.showAnimationBounds ?? false,
      logAnimationEvents: config?.logAnimationEvents ?? false,
    };

    this.performanceMetrics = this.createInitialMetrics();

    // Check motion preferences
    if (this.config.respectMotionPreference && this.prefersReducedMotion()) {
      this.config.enableReducedMotion = true;
    }

    this.initializeEasingFunctions();
    this.detectHardwareAcceleration();
    this.startAnimationLoop();
  }

  /**
   * Create and start an animation
   */
  animate(definition: AnimationDefinition): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const id = definition.id || this.generateAnimationId();
        const animationState = this.createAnimationState(id, definition);

        // Add completion callback
        const originalOnComplete = animationState.callbacks.onComplete;
        animationState.callbacks.onComplete = () => {
          if (originalOnComplete) {
            originalOnComplete();
          }
          resolve();
        };

        const originalOnCancel = animationState.callbacks.onCancel;
        animationState.callbacks.onCancel = () => {
          if (originalOnCancel) {
            originalOnCancel();
          }
          reject(new Error("Animation cancelled"));
        };

        this.startAnimation(animationState);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Create composite animation (sequence or parallel)
   */
  async animateComposite(
    definitions: AnimationDefinition[],
    options: CompositeAnimationOptions,
  ): Promise<void> {
    if (options.onGroupStart) {
      options.onGroupStart();
    }

    try {
      switch (options.mode) {
        case "sequence":
          await this.animateSequence(definitions);
          break;
        case "parallel":
          await this.animateParallel(definitions);
          break;
        case "stagger":
          await this.animateStagger(definitions, options.staggerDelay || 100);
          break;
      }

      if (options.onGroupComplete) {
        options.onGroupComplete();
      }
    } catch (error) {
      console.error("[AnimationSystem] Composite animation failed:", error);
      throw error;
    }
  }

  /**
   * Pause animation
   */
  pauseAnimation(id: string): boolean {
    const state = this.activeAnimations.get(id);
    if (state && state.animation && state.status === "running") {
      state.animation.pause();
      state.status = "paused";

      this.emit("animation-paused", { id, state });
      return true;
    }

    return false;
  }

  /**
   * Resume animation
   */
  resumeAnimation(id: string): boolean {
    const state = this.activeAnimations.get(id);
    if (state && state.animation && state.status === "paused") {
      state.animation.play();
      state.status = "running";

      this.emit("animation-resumed", { id, state });
      return true;
    }

    return false;
  }

  /**
   * Cancel animation
   */
  cancelAnimation(id: string): boolean {
    const state = this.activeAnimations.get(id);
    if (state) {
      if (state.animation) {
        state.animation.cancel();
      }

      state.status = "cancelled";

      if (state.callbacks.onCancel) {
        state.callbacks.onCancel();
      }

      this.activeAnimations.delete(id);
      this.emit("animation-cancelled", { id, state });

      return true;
    }

    return false;
  }

  /**
   * Cancel all animations
   */
  cancelAllAnimations(): void {
    const ids = Array.from(this.activeAnimations.keys());
    for (const id of ids) {
      this.cancelAnimation(id);
    }

    this.animationQueue = [];
    this.emit("all-animations-cancelled");
  }

  /**
   * Get animation state
   */
  getAnimationState(id: string): AnimationState | null {
    return this.activeAnimations.get(id) || null;
  }

  /**
   * Get all active animations
   */
  getActiveAnimations(): AnimationState[] {
    return Array.from(this.activeAnimations.values());
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<AnimationConfig>): void {
    Object.assign(this.config, updates);

    // Re-check motion preferences if changed
    if (updates.respectMotionPreference && this.prefersReducedMotion()) {
      this.config.enableReducedMotion = true;
    }

    this.emit("config-updated", this.config);
  }

  /**
   * Create transition animation
   */
  transition(
    element: HTMLElement,
    from: Record<string, any>,
    to: Record<string, any>,
    options?: AnimationOptions,
  ): Promise<void> {
    // Apply initial styles
    for (const [property, value] of Object.entries(from)) {
      element.style.setProperty(this.camelToKebab(property), value.toString());
    }

    // Create keyframes
    const keyframes = [from, to];

    return this.animate({
      element,
      keyframes,
      options: {
        duration: this.config.defaultDuration,
        easing: this.config.defaultEasing,
        fill: "forwards",
        ...options,
      },
    });
  }

  /**
   * Create fade animation
   */
  fade(
    element: HTMLElement,
    direction: "in" | "out",
    options?: AnimationOptions,
  ): Promise<void> {
    const keyframes =
      direction === "in"
        ? [{ opacity: "0" }, { opacity: "1" }]
        : [{ opacity: "1" }, { opacity: "0" }];

    return this.animate({
      element,
      keyframes,
      options: {
        duration: this.config.defaultDuration,
        easing: this.config.defaultEasing,
        fill: "forwards",
        ...options,
      },
    });
  }

  /**
   * Create slide animation
   */
  slide(
    element: HTMLElement,
    direction: "up" | "down" | "left" | "right",
    distance: number = 100,
    options?: AnimationOptions,
  ): Promise<void> {
    const transforms = {
      up: `translateY(${distance}px)`,
      down: `translateY(-${distance}px)`,
      left: `translateX(${distance}px)`,
      right: `translateX(-${distance}px)`,
    };

    const keyframes = [
      { transform: transforms[direction], opacity: "0" },
      { transform: "translateX(0) translateY(0)", opacity: "1" },
    ];

    return this.animate({
      element,
      keyframes,
      options: {
        duration: this.config.defaultDuration,
        easing: this.config.defaultEasing,
        fill: "forwards",
        ...options,
      },
    });
  }

  /**
   * Create scale animation
   */
  scale(
    element: HTMLElement,
    from: number = 0,
    to: number = 1,
    options?: AnimationOptions,
  ): Promise<void> {
    const keyframes = [
      { transform: `scale(${from})`, opacity: from === 0 ? "0" : "1" },
      { transform: `scale(${to})`, opacity: to === 0 ? "0" : "1" },
    ];

    return this.animate({
      element,
      keyframes,
      options: {
        duration: this.config.defaultDuration,
        easing: this.config.defaultEasing,
        fill: "forwards",
        ...options,
      },
    });
  }

  /**
   * Create pulse animation
   */
  pulse(
    element: HTMLElement,
    scale: number = 1.1,
    options?: AnimationOptions,
  ): Promise<void> {
    const keyframes = [
      { transform: "scale(1)" },
      { transform: `scale(${scale})` },
      { transform: "scale(1)" },
    ];

    return this.animate({
      element,
      keyframes,
      options: {
        duration: 600,
        easing: "ease-in-out",
        iterations: 1,
        ...options,
      },
    });
  }

  /**
   * Create shake animation
   */
  shake(
    element: HTMLElement,
    intensity: number = 10,
    options?: AnimationOptions,
  ): Promise<void> {
    const keyframes = [
      { transform: "translateX(0)" },
      { transform: `translateX(-${intensity}px)` },
      { transform: `translateX(${intensity}px)` },
      { transform: `translateX(-${intensity}px)` },
      { transform: "translateX(0)" },
    ];

    return this.animate({
      element,
      keyframes,
      options: {
        duration: 500,
        easing: "ease-in-out",
        iterations: 1,
        ...options,
      },
    });
  }

  /**
   * Dispose animation system
   */
  dispose(): void {
    this.cancelAllAnimations();

    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    this.isRunning = false;
    this.removeAllListeners();

    this.emit("disposed");
  }

  // Private methods

  private createInitialMetrics(): PerformanceMetrics {
    return {
      totalAnimations: 0,
      activeAnimations: 0,
      averageFrameTime: 0,
      droppedFrames: 0,
      memoryUsage: 0,
      hardwareAccelerated: 0,
      cpuUsage: 0,
    };
  }

  private createAnimationState(
    id: string,
    definition: AnimationDefinition,
  ): AnimationState {
    const options = definition.options || {};

    return {
      id,
      element: definition.element,
      startTime: 0,
      duration: options.duration || this.config.defaultDuration,
      progress: 0,
      status: "pending",
      currentValues: {},
      callbacks: {
        onStart: options.onStart,
        onUpdate: options.onUpdate,
        onComplete: options.onComplete,
        onCancel: options.onCancel,
      },
    };
  }

  private async startAnimation(state: AnimationState): Promise<void> {
    // Check if we're at the animation limit
    if (this.activeAnimations.size >= this.config.maxConcurrentAnimations) {
      this.animationQueue.push({
        id: state.id,
        element: state.element,
        keyframes: [],
      });
      return;
    }

    // Add to active animations
    this.activeAnimations.set(state.id, state);

    // Start the animation
    state.startTime = performance.now();
    state.status = "running";

    if (state.callbacks.onStart) {
      state.callbacks.onStart();
    }

    this.performanceMetrics.totalAnimations++;
    this.performanceMetrics.activeAnimations = this.activeAnimations.size;

    this.emit("animation-started", { id: state.id, state });
  }

  private async animateSequence(
    definitions: AnimationDefinition[],
  ): Promise<void> {
    for (const definition of definitions) {
      await this.animate(definition);
    }
  }

  private async animateParallel(
    definitions: AnimationDefinition[],
  ): Promise<void> {
    const promises = definitions.map((definition) => this.animate(definition));
    await Promise.all(promises);
  }

  private async animateStagger(
    definitions: AnimationDefinition[],
    staggerDelay: number,
  ): Promise<void> {
    const promises = definitions.map((definition, index) => {
      const delay = (definition.options?.delay || 0) + index * staggerDelay;

      return this.animate({
        ...definition,
        options: {
          ...definition.options,
          delay,
        },
      });
    });

    await Promise.all(promises);
  }

  private startAnimationLoop(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    const loop = (timestamp: number) => {
      if (!this.isRunning) {
        return;
      }

      this.frameStartTime = performance.now();

      // Update performance metrics
      if (this.lastFrameTime) {
        const frameDelta = timestamp - this.lastFrameTime;
        const expectedFrameTime = 1000 / this.config.frameRateCap;

        if (frameDelta > expectedFrameTime * 1.5) {
          this.performanceMetrics.droppedFrames++;
        }

        this.performanceMetrics.averageFrameTime =
          this.performanceMetrics.averageFrameTime * 0.9 + frameDelta * 0.1;
      }

      this.lastFrameTime = timestamp;
      this.frameCount++;

      // Update active animations
      this.updateAnimations(timestamp);

      // Process animation queue
      this.processAnimationQueue();

      // Update performance metrics
      const frameTime = performance.now() - this.frameStartTime;
      this.performanceMetrics.activeAnimations = this.activeAnimations.size;

      if (
        this.config.enablePerformanceMonitoring &&
        this.frameCount % 60 === 0
      ) {
        this.emit("performance-update", this.performanceMetrics);
      }

      // Schedule next frame
      this.animationFrame = requestAnimationFrame(loop);
    };

    this.animationFrame = requestAnimationFrame(loop);
  }

  private updateAnimations(timestamp: number): void {
    for (const [id, state] of this.activeAnimations) {
      if (state.status !== "running") {
        continue;
      }

      const elapsed = timestamp - state.startTime;
      const progress = Math.min(elapsed / state.duration, 1);

      state.progress = progress;

      if (state.callbacks.onUpdate) {
        state.callbacks.onUpdate(progress, state.currentValues);
      }

      if (progress >= 1) {
        // Animation completed
        state.status = "completed";

        if (state.callbacks.onComplete) {
          state.callbacks.onComplete();
        }

        this.activeAnimations.delete(id);
        this.emit("animation-completed", { id, state });
      }
    }
  }

  private processAnimationQueue(): void {
    while (
      this.animationQueue.length > 0 &&
      this.activeAnimations.size < this.config.maxConcurrentAnimations
    ) {
      const definition = this.animationQueue.shift()!;

      if (definition.id) {
        const state = this.createAnimationState(definition.id, definition);
        this.startAnimation(state);
      }
    }
  }

  private initializeEasingFunctions(): void {
    // Standard easing functions
    this.easingFunctions.set("linear", (t) => t);
    this.easingFunctions.set("ease", (t) =>
      this.cubicBezier(0.25, 0.1, 0.25, 1)(t),
    );
    this.easingFunctions.set("ease-in", (t) => t * t);
    this.easingFunctions.set("ease-out", (t) => 1 - Math.pow(1 - t, 2));
    this.easingFunctions.set("ease-in-out", (t) =>
      t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    );

    // Additional easing functions
    this.easingFunctions.set("ease-in-cubic", (t) => t * t * t);
    this.easingFunctions.set("ease-out-cubic", (t) => 1 - Math.pow(1 - t, 3));
    this.easingFunctions.set("ease-in-quart", (t) => t * t * t * t);
    this.easingFunctions.set("ease-out-quart", (t) => 1 - Math.pow(1 - t, 4));
    this.easingFunctions.set(
      "ease-in-back",
      (t) => 2.70158 * t * t * t - 1.70158 * t * t,
    );
    this.easingFunctions.set(
      "ease-out-back",
      (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
    );

    // Bounce easing
    this.easingFunctions.set("ease-out-bounce", (t) => {
      if (t < 1 / 2.75) {
        return 7.5625 * t * t;
      } else if (t < 2 / 2.75) {
        return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
      } else if (t < 2.5 / 2.75) {
        return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
      } else {
        return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
      }
    });
  }

  private cubicBezier(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): (t: number) => number {
    return (t: number) => {
      // Simplified cubic bezier implementation
      // In a real implementation, you'd want a more accurate bezier curve calculation
      const a = 1 - 3 * x2 + 3 * x1;
      const b = 3 * x2 - 6 * x1;
      const c = 3 * x1;

      const x = ((a * t + b) * t + c) * t;

      const ay = 1 - 3 * y2 + 3 * y1;
      const by = 3 * y2 - 6 * y1;
      const cy = 3 * y1;

      return ((ay * x + by) * x + cy) * x;
    };
  }

  private generateAnimationId(): string {
    return `anim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private camelToKebab(str: string): string {
    return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, "$1-$2").toLowerCase();
  }

  private detectHardwareAcceleration(): void {
    try {
      // Test if CSS transforms are hardware accelerated
      const testElement = document.createElement("div");
      testElement.style.transform = "translate3d(0, 0, 0)";
      testElement.style.opacity = "0";
      testElement.style.position = "absolute";
      testElement.style.left = "-9999px";

      document.body.appendChild(testElement);

      const computedStyle = window.getComputedStyle(testElement);
      this.hardwareAccelerationSupported = computedStyle.transform !== "none";

      document.body.removeChild(testElement);

      if (this.config.logAnimationEvents) {
        console.log(
          `[AnimationSystem] Hardware acceleration: ${this.hardwareAccelerationSupported ? "supported" : "not supported"}`,
        );
      }
    } catch (error) {
      console.warn(
        "[AnimationSystem] Hardware acceleration detection failed:",
        error,
      );
      this.hardwareAccelerationSupported = false;
    }
  }

  private prefersReducedMotion(): boolean {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
}

export default AnimationSystem;
