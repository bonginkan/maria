/**
 * VisualFeedback - Enhanced Visual Feedback System
 * Phase 3 visual enhancement component providing real-time visual feedback for user interactions
 *
 * Features:
 * - Typing indicators with realistic cursor simulation
 * - Processing animations with progress tracking
 * - Drag and drop visual feedback
 * - Loading states with contextual animations
 * - Error and success visual notifications
 * - Accessibility-compliant animations
 * - Performance-optimized rendering
 *
 * @since v3.4.2 Phase 3
 */

import { EventEmitter } from "node:events";

export interface VisualFeedbackConfig {
  // Animation preferences
  enableAnimations: boolean;
  respectMotionPreference: boolean;
  animationSpeed: "slow" | "normal" | "fast";

  // Feedback types
  enableTypingIndicator: boolean;
  enableProcessingAnimation: boolean;
  enableDragFeedback: boolean;
  enableLoadingStates: boolean;

  // Accessibility
  enableScreenReaderFeedback: boolean;
  enableHighContrast: boolean;
  enableReducedMotion: boolean;

  // Performance
  maxConcurrentAnimations: number;
  throttleUpdates: boolean;
  updateInterval: number;
}

export interface FeedbackState {
  // Current activities
  isTyping: boolean;
  isProcessing: boolean;
  isDragging: boolean;
  isLoading: boolean;

  // Processing details
  processingStage?: string;
  processingProgress?: number;
  processingETA?: number;

  // Typing details
  typingSpeed?: number;
  lastKeystroke?: number;

  // Drag details
  dragType?: string;
  dragPosition?: { x: number; y: number };
  dropTargets?: Array<{ id: string; bounds: DOMRect; valid: boolean }>;

  // Status
  lastError?: string;
  lastSuccess?: string;
  notifications: Array<{
    id: string;
    type: "info" | "success" | "warning" | "error";
    message: string;
    timestamp: number;
    duration?: number;
  }>;
}

export interface AnimationContext {
  element: HTMLElement;
  type: "typing" | "processing" | "dragging" | "loading" | "notification";
  startTime: number;
  duration: number;
  progress: number;
  easing: "linear" | "ease" | "ease-in" | "ease-out" | "ease-in-out";
  properties: Record<string, any>;
  onComplete?: () => void;
}

export class VisualFeedback extends EventEmitter {
  private container: HTMLElement | null = null;
  private config: VisualFeedbackConfig;
  private state: FeedbackState;

  // Animation management
  private activeAnimations: Map<string, AnimationContext> = new Map();
  private animationFrame: number | null = null;
  private updateTimer: NodeJS.Timeout | null = null;

  // Elements
  private elements: {
    typingIndicator?: HTMLElement;
    processingOverlay?: HTMLElement;
    dragIndicator?: HTMLElement;
    loadingSpinner?: HTMLElement;
    notificationContainer?: HTMLElement;
  } = {};

  // Performance tracking
  private performanceMetrics = {
    frameDrops: 0,
    averageFrameTime: 0,
    totalAnimations: 0,
    activeAnimationCount: 0,
  };

  constructor(config?: Partial<VisualFeedbackConfig>) {
    super();

    this.config = {
      enableAnimations: config?.enableAnimations ?? true,
      respectMotionPreference: config?.respectMotionPreference ?? true,
      animationSpeed: config?.animationSpeed ?? "normal",
      enableTypingIndicator: config?.enableTypingIndicator ?? true,
      enableProcessingAnimation: config?.enableProcessingAnimation ?? true,
      enableDragFeedback: config?.enableDragFeedback ?? true,
      enableLoadingStates: config?.enableLoadingStates ?? true,
      enableScreenReaderFeedback: config?.enableScreenReaderFeedback ?? true,
      enableHighContrast: config?.enableHighContrast ?? false,
      enableReducedMotion: config?.enableReducedMotion ?? false,
      maxConcurrentAnimations: config?.maxConcurrentAnimations ?? 10,
      throttleUpdates: config?.throttleUpdates ?? true,
      updateInterval: config?.updateInterval ?? 16, // 60 FPS
    };

    this.state = this.createInitialState();

    // Detect motion preferences
    if (this.config.respectMotionPreference && this.prefersReducedMotion()) {
      this.config.enableAnimations = false;
      this.config.enableReducedMotion = true;
    }

    this.setupUpdateLoop();
    this.injectStyles();
  }

  /**
   * Mount visual feedback to container element
   */
  mount(container: HTMLElement): void {
    this.container = container;
    this.setupContainer();
    this.createElements();
  }

  /**
   * Unmount and cleanup
   */
  unmount(): void {
    this.cleanup();
    this.container = null;
  }

  /**
   * Start typing indicator
   */
  startTyping(options?: {
    speed?: number;
    text?: string;
    cursor?: "block" | "line" | "underscore";
  }): void {
    if (!this.config.enableTypingIndicator || !this.config.enableAnimations) {
      return;
    }

    this.state.isTyping = true;
    this.state.typingSpeed = options?.speed || 200;
    this.state.lastKeystroke = Date.now();

    this.startTypingAnimation(options);
    this.announceToScreenReader("Typing");

    this.emit("typing-started", { options, state: this.state });
  }

  /**
   * Stop typing indicator
   */
  stopTyping(): void {
    this.state.isTyping = false;
    this.state.lastKeystroke = undefined;

    this.stopTypingAnimation();
    this.announceToScreenReader("");

    this.emit("typing-stopped");
  }

  /**
   * Start processing animation
   */
  startProcessing(options?: {
    stage?: string;
    estimatedDuration?: number;
    showProgress?: boolean;
    message?: string;
  }): void {
    if (
      !this.config.enableProcessingAnimation ||
      !this.config.enableAnimations
    ) {
      return;
    }

    this.state.isProcessing = true;
    this.state.processingStage = options?.stage;
    this.state.processingProgress = 0;

    if (options?.estimatedDuration) {
      this.state.processingETA = Date.now() + options.estimatedDuration;
    }

    this.startProcessingAnimation(options);
    this.announceToScreenReader(options?.message || "Processing");

    this.emit("processing-started", { options, state: this.state });
  }

  /**
   * Update processing progress
   */
  updateProcessingProgress(progress: number, stage?: string): void {
    this.state.processingProgress = Math.max(0, Math.min(100, progress));

    if (stage) {
      this.state.processingStage = stage;
    }

    this.updateProcessingAnimation();

    this.emit("processing-progress", {
      progress: this.state.processingProgress,
      stage: this.state.processingStage,
    });
  }

  /**
   * Stop processing animation
   */
  stopProcessing(success: boolean = true): void {
    this.state.isProcessing = false;
    this.state.processingStage = undefined;
    this.state.processingProgress = undefined;
    this.state.processingETA = undefined;

    this.stopProcessingAnimation();
    this.announceToScreenReader("");

    if (success) {
      this.showNotification("Processing complete", "success", 2000);
    }

    this.emit("processing-stopped", { success });
  }

  /**
   * Start drag operation feedback
   */
  startDragging(options: {
    type: string;
    element: HTMLElement;
    data?: any;
    allowedDropTargets?: string[];
  }): void {
    if (!this.config.enableDragFeedback || !this.config.enableAnimations) {
      return;
    }

    this.state.isDragging = true;
    this.state.dragType = options.type;

    this.startDragAnimation(options);
    this.announceToScreenReader(`Dragging ${options.type}`);

    this.emit("dragging-started", { options, state: this.state });
  }

  /**
   * Update drag position and targets
   */
  updateDragPosition(
    position: { x: number; y: number },
    dropTargets?: Array<{
      id: string;
      bounds: DOMRect;
      valid: boolean;
    }>,
  ): void {
    this.state.dragPosition = position;
    this.state.dropTargets = dropTargets;

    this.updateDragAnimation();

    this.emit("drag-position-updated", { position, dropTargets });
  }

  /**
   * Stop drag operation
   */
  stopDragging(dropped: boolean = false, target?: string): void {
    this.state.isDragging = false;
    this.state.dragType = undefined;
    this.state.dragPosition = undefined;
    this.state.dropTargets = undefined;

    this.stopDragAnimation();
    this.announceToScreenReader("");

    if (dropped && target) {
      this.showNotification(`Dropped on ${target}`, "success", 1500);
    }

    this.emit("dragging-stopped", { dropped, target });
  }

  /**
   * Show loading state
   */
  startLoading(options?: {
    message?: string;
    type?: "spinner" | "dots" | "pulse";
    overlay?: boolean;
  }): void {
    if (!this.config.enableLoadingStates || !this.config.enableAnimations) {
      return;
    }

    this.state.isLoading = true;

    this.startLoadingAnimation(options);
    this.announceToScreenReader(options?.message || "Loading");

    this.emit("loading-started", { options, state: this.state });
  }

  /**
   * Stop loading state
   */
  stopLoading(): void {
    this.state.isLoading = false;

    this.stopLoadingAnimation();
    this.announceToScreenReader("");

    this.emit("loading-stopped");
  }

  /**
   * Show notification
   */
  showNotification(
    message: string,
    type: "info" | "success" | "warning" | "error" = "info",
    duration: number = 3000,
  ): void {
    const notification = {
      id: `notification-${Date.now()}`,
      type,
      message,
      timestamp: Date.now(),
      duration,
    };

    this.state.notifications.push(notification);

    // Limit notifications
    if (this.state.notifications.length > 5) {
      this.state.notifications.shift();
    }

    this.showNotificationAnimation(notification);
    this.announceToScreenReader(message);

    // Auto-remove
    setTimeout(() => {
      this.removeNotification(notification.id);
    }, duration);

    this.emit("notification-shown", notification);
  }

  /**
   * Remove notification
   */
  removeNotification(id: string): void {
    const index = this.state.notifications.findIndex((n) => n.id === id);
    if (index >= 0) {
      const notification = this.state.notifications.splice(index, 1)[0];
      this.hideNotificationAnimation(notification);

      this.emit("notification-removed", notification);
    }
  }

  /**
   * Clear all notifications
   */
  clearNotifications(): void {
    for (const notification of this.state.notifications) {
      this.hideNotificationAnimation(notification);
    }

    this.state.notifications = [];
    this.emit("notifications-cleared");
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<VisualFeedbackConfig>): void {
    Object.assign(this.config, updates);

    // Re-check motion preferences if changed
    if (updates.respectMotionPreference && this.prefersReducedMotion()) {
      this.config.enableAnimations = false;
      this.config.enableReducedMotion = true;
    }

    this.emit("config-updated", this.config);
  }

  /**
   * Get current state
   */
  getState(): FeedbackState {
    return { ...this.state };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): typeof this.performanceMetrics {
    return { ...this.performanceMetrics };
  }

  // Private methods

  private createInitialState(): FeedbackState {
    return {
      isTyping: false,
      isProcessing: false,
      isDragging: false,
      isLoading: false,
      notifications: [],
    };
  }

  private setupContainer(): void {
    if (!this.container) {
      return;
    }

    this.container.classList.add("visual-feedback-container");
    this.container.setAttribute("role", "region");
    this.container.setAttribute("aria-label", "Visual feedback");

    // Add ARIA live region for screen readers
    const liveRegion = document.createElement("div");
    liveRegion.setAttribute("aria-live", "polite");
    liveRegion.setAttribute("aria-atomic", "true");
    liveRegion.className = "visual-feedback-sr-only";
    liveRegion.id = "visual-feedback-live";
    this.container.appendChild(liveRegion);
  }

  private createElements(): void {
    if (!this.container) {
      return;
    }

    // Typing indicator
    if (this.config.enableTypingIndicator) {
      this.elements.typingIndicator = this.createTypingIndicator();
    }

    // Processing overlay
    if (this.config.enableProcessingAnimation) {
      this.elements.processingOverlay = this.createProcessingOverlay();
    }

    // Drag indicator
    if (this.config.enableDragFeedback) {
      this.elements.dragIndicator = this.createDragIndicator();
    }

    // Loading spinner
    if (this.config.enableLoadingStates) {
      this.elements.loadingSpinner = this.createLoadingSpinner();
    }

    // Notification container
    this.elements.notificationContainer = this.createNotificationContainer();
  }

  private createTypingIndicator(): HTMLElement {
    const indicator = document.createElement("div");
    indicator.className = "typing-indicator";
    indicator.setAttribute("aria-hidden", "true");

    // Create cursor
    const cursor = document.createElement("span");
    cursor.className = "typing-cursor";
    cursor.textContent = "|";
    indicator.appendChild(cursor);

    this.container?.appendChild(indicator);
    return indicator;
  }

  private createProcessingOverlay(): HTMLElement {
    const overlay = document.createElement("div");
    overlay.className = "processing-overlay";
    overlay.setAttribute("aria-hidden", "true");

    // Progress bar
    const progressBar = document.createElement("div");
    progressBar.className = "processing-progress";

    const progressFill = document.createElement("div");
    progressFill.className = "processing-progress-fill";
    progressBar.appendChild(progressFill);

    // Message
    const message = document.createElement("div");
    message.className = "processing-message";
    message.textContent = "Processing...";

    overlay.appendChild(progressBar);
    overlay.appendChild(message);

    this.container?.appendChild(overlay);
    return overlay;
  }

  private createDragIndicator(): HTMLElement {
    const indicator = document.createElement("div");
    indicator.className = "drag-indicator";
    indicator.setAttribute("aria-hidden", "true");

    this.container?.appendChild(indicator);
    return indicator;
  }

  private createLoadingSpinner(): HTMLElement {
    const spinner = document.createElement("div");
    spinner.className = "loading-spinner";
    spinner.setAttribute("aria-hidden", "true");

    // Create spinner dots
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement("span");
      dot.className = "loading-dot";
      spinner.appendChild(dot);
    }

    this.container?.appendChild(spinner);
    return spinner;
  }

  private createNotificationContainer(): HTMLElement {
    const container = document.createElement("div");
    container.className = "notification-container";
    container.setAttribute("role", "log");
    container.setAttribute("aria-live", "polite");

    this.container?.appendChild(container);
    return container;
  }

  private startTypingAnimation(options?: any): void {
    const element = this.elements.typingIndicator;
    if (!element) return;

    element.style.display = "block";

    const animation: AnimationContext = {
      element,
      type: "typing",
      startTime: Date.now(),
      duration: Infinity, // Continuous
      progress: 0,
      easing: "linear",
      properties: {
        speed: this.state.typingSpeed || 200,
        cursor: options?.cursor || "line",
      },
      onComplete: () => {
        element.style.display = "none";
      },
    };

    this.activeAnimations.set("typing", animation);
  }

  private stopTypingAnimation(): void {
    const animation = this.activeAnimations.get("typing");
    if (animation?.onComplete) {
      animation.onComplete();
    }

    this.activeAnimations.delete("typing");
  }

  private startProcessingAnimation(options?: any): void {
    const element = this.elements.processingOverlay;
    if (!element) return;

    element.style.display = "block";

    // Update message
    const messageElement = element.querySelector(".processing-message");
    if (messageElement) {
      messageElement.textContent = options?.message || "Processing...";
    }

    const animation: AnimationContext = {
      element,
      type: "processing",
      startTime: Date.now(),
      duration: options?.estimatedDuration || 10000,
      progress: 0,
      easing: "ease-out",
      properties: {
        showProgress: options?.showProgress ?? true,
        stage: options?.stage,
      },
      onComplete: () => {
        element.style.display = "none";
      },
    };

    this.activeAnimations.set("processing", animation);
  }

  private updateProcessingAnimation(): void {
    const animation = this.activeAnimations.get("processing");
    const element = this.elements.processingOverlay;

    if (!animation || !element) return;

    const progressFill = element.querySelector(
      ".processing-progress-fill",
    ) as HTMLElement;
    if (progressFill && this.state.processingProgress !== undefined) {
      progressFill.style.width = `${this.state.processingProgress}%`;
    }

    const messageElement = element.querySelector(".processing-message");
    if (messageElement && this.state.processingStage) {
      messageElement.textContent = this.state.processingStage;
    }
  }

  private stopProcessingAnimation(): void {
    const animation = this.activeAnimations.get("processing");
    if (animation?.onComplete) {
      animation.onComplete();
    }

    this.activeAnimations.delete("processing");
  }

  private startDragAnimation(options: any): void {
    const element = this.elements.dragIndicator;
    if (!element) return;

    element.style.display = "block";
    element.textContent = `Dragging ${options.type}`;

    const animation: AnimationContext = {
      element,
      type: "dragging",
      startTime: Date.now(),
      duration: Infinity,
      progress: 0,
      easing: "ease-out",
      properties: {
        type: options.type,
        data: options.data,
      },
      onComplete: () => {
        element.style.display = "none";
      },
    };

    this.activeAnimations.set("dragging", animation);
  }

  private updateDragAnimation(): void {
    const element = this.elements.dragIndicator;
    if (!element || !this.state.dragPosition) return;

    element.style.left = `${this.state.dragPosition.x + 10}px`;
    element.style.top = `${this.state.dragPosition.y + 10}px`;

    // Update drop target indicators
    if (this.state.dropTargets) {
      // Add visual indicators for valid drop targets
      // This would typically update existing UI elements
    }
  }

  private stopDragAnimation(): void {
    const animation = this.activeAnimations.get("dragging");
    if (animation?.onComplete) {
      animation.onComplete();
    }

    this.activeAnimations.delete("dragging");
  }

  private startLoadingAnimation(options?: any): void {
    const element = this.elements.loadingSpinner;
    if (!element) return;

    element.style.display = "block";

    const animation: AnimationContext = {
      element,
      type: "loading",
      startTime: Date.now(),
      duration: Infinity,
      progress: 0,
      easing: "linear",
      properties: {
        type: options?.type || "dots",
        message: options?.message,
      },
      onComplete: () => {
        element.style.display = "none";
      },
    };

    this.activeAnimations.set("loading", animation);
  }

  private stopLoadingAnimation(): void {
    const animation = this.activeAnimations.get("loading");
    if (animation?.onComplete) {
      animation.onComplete();
    }

    this.activeAnimations.delete("loading");
  }

  private showNotificationAnimation(notification: any): void {
    const container = this.elements.notificationContainer;
    if (!container) return;

    const element = document.createElement("div");
    element.className = `notification notification-${notification.type}`;
    element.setAttribute("role", "alert");
    element.textContent = notification.message;
    element.dataset.notificationId = notification.id;

    container.appendChild(element);

    if (this.config.enableAnimations && !this.config.enableReducedMotion) {
      element.style.transform = "translateX(100%)";
      element.style.opacity = "0";

      requestAnimationFrame(() => {
        element.style.transition = "transform 0.3s ease, opacity 0.3s ease";
        element.style.transform = "translateX(0)";
        element.style.opacity = "1";
      });
    }

    const animation: AnimationContext = {
      element,
      type: "notification",
      startTime: Date.now(),
      duration: notification.duration || 3000,
      progress: 0,
      easing: "ease",
      properties: { notification },
    };

    this.activeAnimations.set(`notification-${notification.id}`, animation);
  }

  private hideNotificationAnimation(notification: any): void {
    const container = this.elements.notificationContainer;
    if (!container) return;

    const element = container.querySelector(
      `[data-notification-id="${notification.id}"]`,
    ) as HTMLElement;
    if (!element) return;

    if (this.config.enableAnimations && !this.config.enableReducedMotion) {
      element.style.transition = "transform 0.3s ease, opacity 0.3s ease";
      element.style.transform = "translateX(100%)";
      element.style.opacity = "0";

      setTimeout(() => {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      }, 300);
    } else {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    }

    this.activeAnimations.delete(`notification-${notification.id}`);
  }

  private setupUpdateLoop(): void {
    if (!this.config.enableAnimations) {
      return;
    }

    const update = (timestamp: number) => {
      const frameStart = performance.now();

      // Update all active animations
      for (const [key, animation] of this.activeAnimations) {
        this.updateAnimation(animation, timestamp);

        // Remove completed finite animations
        if (animation.duration !== Infinity) {
          const elapsed = timestamp - animation.startTime;
          if (elapsed >= animation.duration) {
            if (animation.onComplete) {
              animation.onComplete();
            }
            this.activeAnimations.delete(key);
          }
        }
      }

      // Update performance metrics
      const frameTime = performance.now() - frameStart;
      this.performanceMetrics.averageFrameTime =
        this.performanceMetrics.averageFrameTime * 0.9 + frameTime * 0.1;

      if (frameTime > 16) {
        // Dropped frame (60fps)
        this.performanceMetrics.frameDrops++;
      }

      this.performanceMetrics.activeAnimationCount = this.activeAnimations.size;

      // Emit performance update
      if (this.performanceMetrics.totalAnimations % 60 === 0) {
        this.emit("performance-update", this.performanceMetrics);
      }

      // Continue loop if animations are active or config allows
      if (this.activeAnimations.size > 0 || this.config.enableAnimations) {
        this.animationFrame = requestAnimationFrame(update);
      } else {
        this.animationFrame = null;
      }
    };

    this.animationFrame = requestAnimationFrame(update);
  }

  private updateAnimation(
    animation: AnimationContext,
    timestamp: number,
  ): void {
    if (animation.duration === Infinity) {
      // Continuous animations
      this.updateContinuousAnimation(animation, timestamp);
    } else {
      // Finite animations
      const elapsed = timestamp - animation.startTime;
      animation.progress = Math.min(elapsed / animation.duration, 1);

      this.updateFiniteAnimation(animation);
    }
  }

  private updateContinuousAnimation(
    animation: AnimationContext,
    timestamp: number,
  ): void {
    switch (animation.type) {
      case "typing":
        this.updateTypingCursor(animation, timestamp);
        break;
      case "loading":
        this.updateLoadingSpinner(animation, timestamp);
        break;
    }
  }

  private updateFiniteAnimation(animation: AnimationContext): void {
    // Apply easing function
    let easedProgress = animation.progress;

    switch (animation.easing) {
      case "ease-in":
        easedProgress = animation.progress * animation.progress;
        break;
      case "ease-out":
        easedProgress = 1 - Math.pow(1 - animation.progress, 2);
        break;
      case "ease-in-out":
        easedProgress =
          animation.progress < 0.5
            ? 2 * animation.progress * animation.progress
            : 1 - Math.pow(-2 * animation.progress + 2, 2) / 2;
        break;
    }

    // Apply animation-specific updates
    switch (animation.type) {
      case "notification":
        // Fade out at the end
        if (animation.progress > 0.8) {
          const fadeProgress = (animation.progress - 0.8) / 0.2;
          animation.element.style.opacity = (1 - fadeProgress).toString();
        }
        break;
    }
  }

  private updateTypingCursor(
    animation: AnimationContext,
    timestamp: number,
  ): void {
    const cursor = animation.element.querySelector(".typing-cursor");
    if (!cursor) return;

    // Blinking effect
    const blinkRate = animation.properties.speed || 500;
    const blinkPhase = (timestamp % blinkRate) / blinkRate;

    cursor.style.opacity = blinkPhase < 0.5 ? "1" : "0";
  }

  private updateLoadingSpinner(
    animation: AnimationContext,
    timestamp: number,
  ): void {
    const dots = animation.element.querySelectorAll(".loading-dot");

    dots.forEach((dot, index) => {
      const delay = index * 200;
      const phase = ((timestamp + delay) % 1000) / 1000;
      const opacity = Math.sin(phase * Math.PI * 2) * 0.5 + 0.5;

      (dot as HTMLElement).style.opacity = opacity.toString();
    });
  }

  private announceToScreenReader(message: string): void {
    if (!this.config.enableScreenReaderFeedback) {
      return;
    }

    const liveRegion = document.getElementById("visual-feedback-live");
    if (liveRegion) {
      liveRegion.textContent = message;
    }
  }

  private prefersReducedMotion(): boolean {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  private injectStyles(): void {
    if (document.getElementById("visual-feedback-styles")) {
      return;
    }

    const styles = document.createElement("style");
    styles.id = "visual-feedback-styles";
    styles.textContent = `
      .visual-feedback-container {
        position: relative;
        overflow: hidden;
      }
      
      .visual-feedback-sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        border: 0;
      }
      
      .typing-indicator {
        display: none;
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        z-index: 10;
      }
      
      .typing-cursor {
        color: #0078d4;
        font-weight: bold;
        animation: typing-blink 1s infinite;
      }
      
      @keyframes typing-blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0; }
      }
      
      .processing-overlay {
        display: none;
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.1);
        backdrop-filter: blur(2px);
        z-index: 100;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: 8px;
      }
      
      .processing-progress {
        width: 200px;
        height: 4px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 2px;
        overflow: hidden;
      }
      
      .processing-progress-fill {
        height: 100%;
        background: #0078d4;
        border-radius: 2px;
        transition: width 0.3s ease;
        width: 0%;
      }
      
      .processing-message {
        font-size: 14px;
        color: #333;
        text-align: center;
      }
      
      .drag-indicator {
        display: none;
        position: absolute;
        background: #0078d4;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 1000;
        pointer-events: none;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      }
      
      .loading-spinner {
        display: none;
        align-items: center;
        gap: 4px;
        padding: 8px;
      }
      
      .loading-dot {
        width: 8px;
        height: 8px;
        background: #0078d4;
        border-radius: 50%;
        animation: loading-pulse 1.5s infinite;
      }
      
      .loading-dot:nth-child(2) {
        animation-delay: 0.2s;
      }
      
      .loading-dot:nth-child(3) {
        animation-delay: 0.4s;
      }
      
      @keyframes loading-pulse {
        0%, 60%, 100% {
          transform: scale(1);
          opacity: 1;
        }
        30% {
          transform: scale(1.2);
          opacity: 0.7;
        }
      }
      
      .notification-container {
        position: absolute;
        top: 8px;
        right: 8px;
        z-index: 200;
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-width: 300px;
      }
      
      .notification {
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 14px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        border-left: 4px solid;
      }
      
      .notification-info {
        background: #e3f2fd;
        color: #1976d2;
        border-left-color: #1976d2;
      }
      
      .notification-success {
        background: #e8f5e8;
        color: #2e7d32;
        border-left-color: #4caf50;
      }
      
      .notification-warning {
        background: #fff3e0;
        color: #f57c00;
        border-left-color: #ff9800;
      }
      
      .notification-error {
        background: #ffebee;
        color: #c62828;
        border-left-color: #f44336;
      }
      
      @media (prefers-reduced-motion: reduce) {
        .visual-feedback-container *,
        .visual-feedback-container *::before,
        .visual-feedback-container *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }
      
      @media (prefers-contrast: high) {
        .notification {
          border: 2px solid;
        }
        
        .processing-overlay {
          background: rgba(0, 0, 0, 0.8);
        }
        
        .processing-message {
          color: white;
        }
      }
    `;

    document.head.appendChild(styles);
  }

  private cleanup(): void {
    // Stop animation loop
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    // Clear update timer
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }

    // Complete all animations
    for (const [key, animation] of this.activeAnimations) {
      if (animation.onComplete) {
        animation.onComplete();
      }
    }

    this.activeAnimations.clear();

    // Clear elements
    this.elements = {};

    // Remove event listeners
    this.removeAllListeners();
  }
}

export default VisualFeedback;
