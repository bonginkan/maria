/**
 * InputStatusBar - Visual Status and Information Display
 * Phase 3 visual enhancement component for showing input status, attachments, and suggestions
 *
 * Features:
 * - Real-time status display (mode, language, encoding)
 * - Attachment management visualization
 * - Command suggestions with confidence indicators
 * - Performance metrics display
 * - Interactive feature toggles
 * - Accessibility support
 *
 * @since v3.4.2 Phase 3
 */

import { EventEmitter } from "node:events";
import type {
  InputStatusBar as InputStatusBarType,
  InputState,
  InputIndicators,
  InputPerformance,
} from "./InputContext";
import type { InputAttachment } from "./InputBoxAdapter";

export interface StatusBarConfig {
  // Display preferences
  showPerformanceMetrics: boolean;
  showDetailedPosition: boolean;
  showAttachmentPreviews: boolean;
  showSuggestionConfidence: boolean;

  // Animation settings
  enableAnimations: boolean;
  transitionDuration: number;
  pulseOnUpdate: boolean;

  // Interaction settings
  enableFeatureToggles: boolean;
  enableSuggestionClick: boolean;
  enableAttachmentClick: boolean;

  // Theming
  theme: "dark" | "light" | "auto";
  compactMode: boolean;
  showIcons: boolean;
}

export interface StatusBarTheme {
  colors: {
    background: string;
    foreground: string;
    accent: string;
    success: string;
    warning: string;
    error: string;
    muted: string;
  };

  fonts: {
    family: string;
    size: string;
    weight: string;
  };

  spacing: {
    padding: string;
    margin: string;
    itemGap: string;
  };
}

export interface StatusSection {
  id: string;
  content: string;
  type: "text" | "indicator" | "button" | "progress";
  tooltip?: string;
  icon?: string;
  color?: string;
  clickable?: boolean;
  shortcut?: string;
  metadata?: Record<string, any>;
}

export interface StatusUpdate {
  timestamp: number;
  source: "input" | "analysis" | "performance" | "user";
  sections: StatusSection[];
  priority: "low" | "medium" | "high";
}

export class InputStatusBar extends EventEmitter {
  private container: HTMLElement | null = null;
  private config: StatusBarConfig;
  private theme: StatusBarTheme;
  private currentStatus: StatusUpdate | null = null;
  private updateQueue: StatusUpdate[] = [];
  private isRendering: boolean = false;

  // Animation timers
  private animationTimers: Map<string, NodeJS.Timeout> = new Map();

  // Section elements cache
  private sectionElements: Map<string, HTMLElement> = new Map();

  constructor(config?: Partial<StatusBarConfig>) {
    super();

    this.config = {
      showPerformanceMetrics: config?.showPerformanceMetrics ?? true,
      showDetailedPosition: config?.showDetailedPosition ?? true,
      showAttachmentPreviews: config?.showAttachmentPreviews ?? true,
      showSuggestionConfidence: config?.showSuggestionConfidence ?? true,
      enableAnimations: config?.enableAnimations ?? true,
      transitionDuration: config?.transitionDuration ?? 200,
      pulseOnUpdate: config?.pulseOnUpdate ?? true,
      enableFeatureToggles: config?.enableFeatureToggles ?? true,
      enableSuggestionClick: config?.enableSuggestionClick ?? true,
      enableAttachmentClick: config?.enableAttachmentClick ?? true,
      theme: config?.theme ?? "auto",
      compactMode: config?.compactMode ?? false,
      showIcons: config?.showIcons ?? true,
    };

    this.theme = this.createTheme(this.config.theme);
    this.setupContainer();
  }

  /**
   * Update status bar with new data
   */
  update(
    statusBar: InputStatusBarType,
    state?: InputState,
    indicators?: InputIndicators,
    performance?: InputPerformance,
  ): void {
    const sections = this.generateSections(
      statusBar,
      state,
      indicators,
      performance,
    );

    const update: StatusUpdate = {
      timestamp: Date.now(),
      source: "input",
      sections,
      priority: this.determineUpdatePriority(sections),
    };

    this.queueUpdate(update);
  }

  /**
   * Set container element for rendering
   */
  mount(container: HTMLElement): void {
    this.container = container;
    this.setupContainer();

    if (this.currentStatus) {
      this.render();
    }
  }

  /**
   * Remove from DOM
   */
  unmount(): void {
    if (this.container) {
      this.container.innerHTML = "";
      this.container = null;
    }

    this.clearAnimationTimers();
    this.sectionElements.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<StatusBarConfig>): void {
    Object.assign(this.config, updates);

    // Update theme if changed
    if (updates.theme) {
      this.theme = this.createTheme(updates.theme);
    }

    // Trigger re-render if mounted
    if (this.container && this.currentStatus) {
      this.render();
    }

    this.emit("config-updated", this.config);
  }

  /**
   * Show specific message temporarily
   */
  showMessage(
    message: string,
    type: "info" | "success" | "warning" | "error" = "info",
    duration: number = 3000,
  ): void {
    const section: StatusSection = {
      id: "temp-message",
      content: message,
      type: "indicator",
      color: this.getColorForType(type),
      metadata: { temporary: true, duration },
    };

    const update: StatusUpdate = {
      timestamp: Date.now(),
      source: "user",
      sections: [section],
      priority: "high",
    };

    this.queueUpdate(update);

    // Auto-remove after duration
    setTimeout(() => {
      this.removeSection("temp-message");
    }, duration);
  }

  /**
   * Add attachment indicator
   */
  showAttachment(attachment: InputAttachment): void {
    const section: StatusSection = {
      id: `attachment-${Date.now()}`,
      content: this.formatAttachmentName(attachment),
      type: "button",
      tooltip: `${attachment.kind}: ${attachment.path}`,
      icon: this.getAttachmentIcon(attachment.kind),
      clickable: this.config.enableAttachmentClick,
      metadata: { attachment },
    };

    const update: StatusUpdate = {
      timestamp: Date.now(),
      source: "input",
      sections: [section],
      priority: "medium",
    };

    this.queueUpdate(update);
  }

  /**
   * Show command suggestions
   */
  showSuggestions(
    suggestions: Array<{
      text: string;
      type: "command" | "completion" | "action";
      confidence?: number;
    }>,
  ): void {
    const sections = suggestions.slice(0, 3).map((suggestion, index) => ({
      id: `suggestion-${index}`,
      content: this.formatSuggestion(suggestion),
      type: "button" as const,
      tooltip: `Confidence: ${Math.round((suggestion.confidence || 0) * 100)}%`,
      icon: this.getSuggestionIcon(suggestion.type),
      clickable: this.config.enableSuggestionClick,
      color: this.getSuggestionColor(suggestion.confidence || 0),
      metadata: { suggestion },
    }));

    const update: StatusUpdate = {
      timestamp: Date.now(),
      source: "analysis",
      sections,
      priority: "high",
    };

    this.queueUpdate(update);
  }

  /**
   * Update performance indicators
   */
  updatePerformance(performance: InputPerformance): void {
    if (!this.config.showPerformanceMetrics) {
      return;
    }

    const sections: StatusSection[] = [];

    // Input latency
    if (performance.inputLatency > 50) {
      sections.push({
        id: "perf-latency",
        content: `${Math.round(performance.inputLatency)}ms`,
        type: "indicator",
        tooltip: "Input latency",
        icon: "⏱️",
        color:
          performance.inputLatency > 100
            ? this.theme.colors.warning
            : this.theme.colors.muted,
        metadata: { metric: "latency", value: performance.inputLatency },
      });
    }

    // Memory usage
    if (performance.memoryUsage > 1000000) {
      // > 1MB
      sections.push({
        id: "perf-memory",
        content: this.formatMemoryUsage(performance.memoryUsage),
        type: "indicator",
        tooltip: "Memory usage",
        icon: "💾",
        color: this.theme.colors.muted,
        metadata: { metric: "memory", value: performance.memoryUsage },
      });
    }

    if (sections.length > 0) {
      const update: StatusUpdate = {
        timestamp: Date.now(),
        source: "performance",
        sections,
        priority: "low",
      };

      this.queueUpdate(update);
    }
  }

  /**
   * Clear all sections
   */
  clear(): void {
    this.updateQueue = [];
    this.sectionElements.clear();
    this.clearAnimationTimers();

    if (this.container) {
      this.container.innerHTML = "";
    }

    this.emit("cleared");
  }

  /**
   * Get current status bar data
   */
  getCurrentStatus(): InputStatusBarType | null {
    return this.currentStatus ? { ...this.currentStatus } : null;
  }

  // Private methods

  private generateSections(
    statusBar: InputStatusBarType,
    state?: InputState,
    indicators?: InputIndicators,
    performance?: InputPerformance,
  ): StatusSection[] {
    const sections: StatusSection[] = [];

    // Left side: Mode and language
    sections.push({
      id: "mode",
      content: this.formatMode(statusBar.mode),
      type: "text",
      tooltip: `Input mode: ${statusBar.mode}`,
      icon: this.getModeIcon(statusBar.mode),
    });

    if (statusBar.language) {
      sections.push({
        id: "language",
        content: statusBar.language.toUpperCase(),
        type: "text",
        tooltip: `Detected language: ${statusBar.language}`,
        icon: "🌐",
      });
    }

    // Center: Position and selection
    if (this.config.showDetailedPosition) {
      let positionText = `${statusBar.position.line}:${statusBar.position.column}`;
      if (statusBar.position.selection) {
        positionText += ` (${statusBar.position.selection})`;
      }

      sections.push({
        id: "position",
        content: positionText,
        type: "text",
        tooltip: "Line:Column (Selection)",
        icon: "📍",
      });
    }

    // Right side: Counts and features
    if (statusBar.attachmentCount > 0) {
      sections.push({
        id: "attachments",
        content: statusBar.attachmentCount.toString(),
        type: "button",
        tooltip: `${statusBar.attachmentCount} attachment(s)`,
        icon: "📎",
        clickable: this.config.enableAttachmentClick,
        metadata: { count: statusBar.attachmentCount },
      });
    }

    if (statusBar.wordCount > 0 || statusBar.characterCount > 0) {
      sections.push({
        id: "word-count",
        content: `${statusBar.wordCount}w ${statusBar.characterCount}c`,
        type: "text",
        tooltip: `${statusBar.wordCount} words, ${statusBar.characterCount} characters`,
      });
    }

    // Features
    if (this.config.enableFeatureToggles) {
      statusBar.features.forEach((feature) => {
        sections.push({
          id: `feature-${feature.name.toLowerCase().replace(/\s+/g, "-")}`,
          content: this.config.showIcons ? "" : feature.name,
          type: "button",
          tooltip: `${feature.name}${feature.shortcut ? ` (${feature.shortcut})` : ""}`,
          icon: this.getFeatureIcon(feature.name),
          color: feature.active
            ? this.theme.colors.success
            : this.theme.colors.muted,
          clickable: true,
          shortcut: feature.shortcut,
          metadata: { feature },
        });
      });
    }

    // Indicators
    if (indicators) {
      if (indicators.isProcessing) {
        sections.push({
          id: "processing",
          content: "",
          type: "progress",
          tooltip: "Processing...",
          icon: "⏳",
          metadata: { progress: indicators.analysisProgress },
        });
      }

      if (indicators.hasErrors) {
        sections.push({
          id: "errors",
          content: "",
          type: "indicator",
          tooltip: "Errors detected",
          icon: "⚠️",
          color: this.theme.colors.error,
        });
      }

      if (indicators.hasSecrets) {
        sections.push({
          id: "secrets",
          content: "",
          type: "indicator",
          tooltip: "Sensitive content detected",
          icon: "🔒",
          color: this.theme.colors.warning,
        });
      }
    }

    return sections;
  }

  private queueUpdate(update: StatusUpdate): void {
    this.updateQueue.push(update);

    if (!this.isRendering) {
      this.processUpdateQueue();
    }
  }

  private async processUpdateQueue(): Promise<void> {
    if (this.updateQueue.length === 0 || this.isRendering) {
      return;
    }

    this.isRendering = true;

    try {
      // Sort by priority and timestamp
      this.updateQueue.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[a.priority];
        const bPriority = priorityOrder[b.priority];

        if (aPriority !== bPriority) {
          return bPriority - aPriority; // Higher priority first
        }

        return b.timestamp - a.timestamp; // Newer first
      });

      // Process updates
      for (const update of this.updateQueue) {
        await this.applyUpdate(update);
      }

      this.updateQueue = [];

      // Final render
      this.render();
    } catch (error) {
      console.error("[InputStatusBar] Update processing failed:", error);
    } finally {
      this.isRendering = false;
    }
  }

  private async applyUpdate(update: StatusUpdate): Promise<void> {
    for (const section of update.sections) {
      await this.updateSection(section, update.source);
    }
  }

  private async updateSection(
    section: StatusSection,
    source: string,
  ): Promise<void> {
    const existingElement = this.sectionElements.get(section.id);

    if (existingElement) {
      // Update existing section
      await this.animateUpdate(existingElement, section);
    } else {
      // Add new section
      const element = this.createElement(section);
      this.sectionElements.set(section.id, element);

      if (this.config.enableAnimations) {
        await this.animateEntry(element);
      }
    }
  }

  private createElement(section: StatusSection): HTMLElement {
    const element = document.createElement("div");
    element.className = this.getSectionClassName(section);
    element.setAttribute("data-section-id", section.id);
    element.setAttribute("data-section-type", section.type);

    // Content
    const contentSpan = document.createElement("span");
    contentSpan.className = "status-section-content";

    if (section.icon && this.config.showIcons) {
      const iconSpan = document.createElement("span");
      iconSpan.className = "status-section-icon";
      iconSpan.textContent = section.icon;
      contentSpan.appendChild(iconSpan);
    }

    if (section.content) {
      const textSpan = document.createElement("span");
      textSpan.className = "status-section-text";
      textSpan.textContent = section.content;
      contentSpan.appendChild(textSpan);
    }

    element.appendChild(contentSpan);

    // Special handling for progress type
    if (section.type === "progress") {
      const progressBar = document.createElement("div");
      progressBar.className = "status-section-progress";
      const progress = section.metadata?.progress || 0;
      progressBar.style.setProperty("--progress", `${progress}%`);
      element.appendChild(progressBar);
    }

    // Tooltip
    if (section.tooltip) {
      element.title = section.tooltip;
    }

    // Click handler
    if (
      section.clickable &&
      (this.config.enableFeatureToggles ||
        this.config.enableSuggestionClick ||
        this.config.enableAttachmentClick)
    ) {
      element.addEventListener("click", (event) => {
        this.handleSectionClick(section, event);
      });

      element.style.cursor = "pointer";
    }

    // Styling
    if (section.color) {
      element.style.color = section.color;
    }

    // Keyboard shortcut
    if (section.shortcut) {
      element.setAttribute("data-shortcut", section.shortcut);
    }

    return element;
  }

  private getSectionClassName(section: StatusSection): string {
    const baseClass = "status-section";
    const typeClass = `status-section-${section.type}`;
    const compactClass = this.config.compactMode
      ? "status-section-compact"
      : "";

    return [baseClass, typeClass, compactClass].filter(Boolean).join(" ");
  }

  private async animateEntry(element: HTMLElement): Promise<void> {
    if (!this.config.enableAnimations) {
      return Promise.resolve();
    }

    element.style.opacity = "0";
    element.style.transform = "translateY(-10px)";
    element.style.transition = `opacity ${this.config.transitionDuration}ms ease, transform ${this.config.transitionDuration}ms ease`;

    // Force reflow
    element.offsetHeight;

    element.style.opacity = "1";
    element.style.transform = "translateY(0)";

    return new Promise((resolve) => {
      setTimeout(resolve, this.config.transitionDuration);
    });
  }

  private async animateUpdate(
    element: HTMLElement,
    section: StatusSection,
  ): Promise<void> {
    if (!this.config.enableAnimations || !this.config.pulseOnUpdate) {
      this.updateElementContent(element, section);
      return;
    }

    // Pulse animation
    element.style.transform = "scale(1.1)";
    element.style.transition = `transform ${this.config.transitionDuration / 2}ms ease`;

    setTimeout(() => {
      element.style.transform = "scale(1)";
      this.updateElementContent(element, section);
    }, this.config.transitionDuration / 2);
  }

  private updateElementContent(
    element: HTMLElement,
    section: StatusSection,
  ): void {
    const contentSpan = element.querySelector(".status-section-content");
    const textSpan = element.querySelector(".status-section-text");

    if (textSpan) {
      textSpan.textContent = section.content;
    }

    if (section.tooltip) {
      element.title = section.tooltip;
    }

    if (section.color) {
      element.style.color = section.color;
    }

    // Update progress bar if it's a progress section
    if (section.type === "progress") {
      const progressBar = element.querySelector(
        ".status-section-progress",
      ) as HTMLElement;
      if (progressBar) {
        const progress = section.metadata?.progress || 0;
        progressBar.style.setProperty("--progress", `${progress}%`);
      }
    }
  }

  private handleSectionClick(section: StatusSection, event: MouseEvent): void {
    event.preventDefault();

    this.emit("section-clicked", {
      section,
      event,
      metadata: section.metadata,
    });

    // Specific handlers
    switch (section.type) {
      case "button":
        if (section.metadata?.feature) {
          this.emit("feature-toggled", section.metadata.feature);
        } else if (section.metadata?.suggestion) {
          this.emit("suggestion-selected", section.metadata.suggestion);
        } else if (section.metadata?.attachment) {
          this.emit("attachment-clicked", section.metadata.attachment);
        }
        break;
    }
  }

  private render(): void {
    if (!this.container) {
      return;
    }

    // Clear container
    this.container.innerHTML = "";

    // Add sections in order
    const sortedSections = Array.from(this.sectionElements.values()).sort(
      (a, b) => {
        const orderA = this.getSectionOrder(
          a.getAttribute("data-section-id") || "",
        );
        const orderB = this.getSectionOrder(
          b.getAttribute("data-section-id") || "",
        );
        return orderA - orderB;
      },
    );

    for (const element of sortedSections) {
      this.container.appendChild(element);
    }

    // Apply theme styles
    this.applyThemeStyles();
  }

  private getSectionOrder(sectionId: string): number {
    const orderMap: Record<string, number> = {
      mode: 10,
      language: 20,
      position: 100,
      attachments: 200,
      "word-count": 210,
      processing: 300,
      errors: 310,
      secrets: 320,
      "temp-message": 400,
    };

    // Feature sections
    if (sectionId.startsWith("feature-")) {
      return 500;
    }

    // Suggestion sections
    if (sectionId.startsWith("suggestion-")) {
      return 600 + parseInt(sectionId.split("-")[1] || "0");
    }

    // Performance sections
    if (sectionId.startsWith("perf-")) {
      return 700;
    }

    return orderMap[sectionId] || 999;
  }

  private removeSection(sectionId: string): void {
    const element = this.sectionElements.get(sectionId);
    if (element && this.container?.contains(element)) {
      this.container.removeChild(element);
      this.sectionElements.delete(sectionId);
    }
  }

  private setupContainer(): void {
    if (!this.container) {
      return;
    }

    this.container.className = "input-status-bar";
    this.container.setAttribute("role", "status");
    this.container.setAttribute("aria-live", "polite");

    this.applyThemeStyles();
  }

  private applyThemeStyles(): void {
    if (!this.container) {
      return;
    }

    // CSS custom properties for theming
    this.container.style.setProperty(
      "--status-bar-bg",
      this.theme.colors.background,
    );
    this.container.style.setProperty(
      "--status-bar-fg",
      this.theme.colors.foreground,
    );
    this.container.style.setProperty(
      "--status-bar-accent",
      this.theme.colors.accent,
    );
    this.container.style.setProperty(
      "--status-bar-success",
      this.theme.colors.success,
    );
    this.container.style.setProperty(
      "--status-bar-warning",
      this.theme.colors.warning,
    );
    this.container.style.setProperty(
      "--status-bar-error",
      this.theme.colors.error,
    );
    this.container.style.setProperty(
      "--status-bar-muted",
      this.theme.colors.muted,
    );

    this.container.style.setProperty(
      "--status-bar-font-family",
      this.theme.fonts.family,
    );
    this.container.style.setProperty(
      "--status-bar-font-size",
      this.theme.fonts.size,
    );
    this.container.style.setProperty(
      "--status-bar-font-weight",
      this.theme.fonts.weight,
    );

    this.container.style.setProperty(
      "--status-bar-padding",
      this.theme.spacing.padding,
    );
    this.container.style.setProperty(
      "--status-bar-margin",
      this.theme.spacing.margin,
    );
    this.container.style.setProperty(
      "--status-bar-item-gap",
      this.theme.spacing.itemGap,
    );

    // Add CSS if not already added
    this.injectStyles();
  }

  private injectStyles(): void {
    if (document.getElementById("input-status-bar-styles")) {
      return;
    }

    const styles = document.createElement("style");
    styles.id = "input-status-bar-styles";
    styles.textContent = `
      .input-status-bar {
        display: flex;
        align-items: center;
        gap: var(--status-bar-item-gap, 8px);
        padding: var(--status-bar-padding, 4px 8px);
        margin: var(--status-bar-margin, 0);
        background: var(--status-bar-bg, #1e1e1e);
        color: var(--status-bar-fg, #cccccc);
        font-family: var(--status-bar-font-family, monospace);
        font-size: var(--status-bar-font-size, 12px);
        font-weight: var(--status-bar-font-weight, normal);
        border-top: 1px solid var(--status-bar-muted, #3c3c3c);
        user-select: none;
        min-height: 22px;
      }
      
      .status-section {
        display: flex;
        align-items: center;
        gap: 4px;
        white-space: nowrap;
      }
      
      .status-section-compact {
        gap: 2px;
      }
      
      .status-section-button {
        padding: 2px 6px;
        border-radius: 3px;
        transition: background-color 0.2s ease;
      }
      
      .status-section-button:hover {
        background-color: var(--status-bar-accent, #0e639c);
      }
      
      .status-section-indicator {
        display: flex;
        align-items: center;
      }
      
      .status-section-progress {
        position: relative;
        width: 40px;
        height: 3px;
        background-color: var(--status-bar-muted, #3c3c3c);
        border-radius: 2px;
        overflow: hidden;
      }
      
      .status-section-progress::after {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        height: 100%;
        width: var(--progress, 0%);
        background-color: var(--status-bar-accent, #0e639c);
        transition: width 0.3s ease;
      }
      
      .status-section-content {
        display: flex;
        align-items: center;
        gap: 2px;
      }
      
      .status-section-icon {
        display: inline-block;
        width: 14px;
        text-align: center;
      }
      
      .status-section-text {
        font-family: inherit;
      }
      
      @media (prefers-reduced-motion: reduce) {
        .input-status-bar *,
        .input-status-bar *::before,
        .input-status-bar *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }
    `;

    document.head.appendChild(styles);
  }

  private createTheme(theme: "dark" | "light" | "auto"): StatusBarTheme {
    const isDark =
      theme === "dark" || (theme === "auto" && this.prefersDarkMode());

    if (isDark) {
      return {
        colors: {
          background: "#1e1e1e",
          foreground: "#cccccc",
          accent: "#0e639c",
          success: "#4ec9b0",
          warning: "#dcdcaa",
          error: "#f44747",
          muted: "#6a6a6a",
        },
        fonts: {
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", monospace',
          size: "12px",
          weight: "normal",
        },
        spacing: {
          padding: "4px 8px",
          margin: "0",
          itemGap: "8px",
        },
      };
    } else {
      return {
        colors: {
          background: "#f8f8f8",
          foreground: "#333333",
          accent: "#0078d4",
          success: "#107c10",
          warning: "#ca5010",
          error: "#d13438",
          muted: "#767676",
        },
        fonts: {
          family: '-apple-system, BlinkMacSystemFont, "Segoe UI", monospace',
          size: "12px",
          weight: "normal",
        },
        spacing: {
          padding: "4px 8px",
          margin: "0",
          itemGap: "8px",
        },
      };
    }
  }

  private prefersDarkMode(): boolean {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  private determineUpdatePriority(
    sections: StatusSection[],
  ): "low" | "medium" | "high" {
    const hasErrors = sections.some(
      (s) => s.id === "errors" || s.id === "secrets",
    );
    const hasSuggestions = sections.some((s) => s.id.startsWith("suggestion-"));
    const isTemporary = sections.some((s) => s.metadata?.temporary);

    if (hasErrors || isTemporary) {
      return "high";
    } else if (hasSuggestions) {
      return "medium";
    } else {
      return "low";
    }
  }

  private formatMode(mode: string): string {
    const modeMap: Record<string, string> = {
      command: "CMD",
      text: "TXT",
      code: "CODE",
      error: "ERR",
      natural: "NL",
    };

    return modeMap[mode] || mode.toUpperCase();
  }

  private formatAttachmentName(attachment: InputAttachment): string {
    const maxLength = this.config.compactMode ? 15 : 25;
    const name = attachment.path.split("/").pop() || attachment.path;

    if (name.length <= maxLength) {
      return name;
    }

    return name.substring(0, maxLength - 3) + "...";
  }

  private formatSuggestion(suggestion: {
    text: string;
    type: string;
    confidence?: number;
  }): string {
    const maxLength = this.config.compactMode ? 20 : 30;
    let text = suggestion.text;

    if (text.length > maxLength) {
      text = text.substring(0, maxLength - 3) + "...";
    }

    if (
      this.config.showSuggestionConfidence &&
      suggestion.confidence !== undefined
    ) {
      const confidence = Math.round(suggestion.confidence * 100);
      text += ` (${confidence}%)`;
    }

    return text;
  }

  private formatMemoryUsage(bytes: number): string {
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${Math.round(size * 10) / 10}${units[unitIndex]}`;
  }

  private getModeIcon(mode: string): string {
    const iconMap: Record<string, string> = {
      command: "⌘",
      text: "📝",
      code: "💻",
      error: "⚠️",
      natural: "🗣️",
    };

    return iconMap[mode] || "📄";
  }

  private getAttachmentIcon(kind: string): string {
    const iconMap: Record<string, string> = {
      file: "📄",
      image: "🖼️",
      url: "🔗",
      text: "📝",
      code: "💻",
    };

    return iconMap[kind] || "📎";
  }

  private getSuggestionIcon(type: string): string {
    const iconMap: Record<string, string> = {
      command: "⚡",
      completion: "💡",
      action: "🎯",
    };

    return iconMap[type] || "💭";
  }

  private getFeatureIcon(featureName: string): string {
    const iconMap: Record<string, string> = {
      "Syntax Highlighting": "🎨",
      "Auto Complete": "💡",
      "Error Detection": "🔍",
      "Spell Check": "✓",
      "Word Wrap": "↩️",
    };

    return iconMap[featureName] || "⚙️";
  }

  private getSuggestionColor(confidence: number): string {
    if (confidence >= 0.8) {
      return this.theme.colors.success;
    } else if (confidence >= 0.6) {
      return this.theme.colors.accent;
    } else if (confidence >= 0.4) {
      return this.theme.colors.warning;
    } else {
      return this.theme.colors.muted;
    }
  }

  private getColorForType(
    type: "info" | "success" | "warning" | "error",
  ): string {
    const colorMap: Record<string, string> = {
      info: this.theme.colors.accent,
      success: this.theme.colors.success,
      warning: this.theme.colors.warning,
      error: this.theme.colors.error,
    };

    return colorMap[type];
  }

  private clearAnimationTimers(): void {
    for (const timer of this.animationTimers.values()) {
      clearTimeout(timer);
    }
    this.animationTimers.clear();
  }
}

export default InputStatusBar;
