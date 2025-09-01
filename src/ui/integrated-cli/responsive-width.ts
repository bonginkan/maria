/**
 * Responsive Width Management System
 * Production-grade responsive CLI width calculation and management
 * 
 * @since v3.8.0
 * @module responsive-width
 */

// Use require-style imports for CJS compatibility
import * as stripAnsiModule from 'strip-ansi';
import * as stringWidthModule from 'string-width';

// Extract the actual functions
const stripAnsi = (stripAnsiModule as any).default || stripAnsiModule;
const stringWidth = (stringWidthModule as any).default || stringWidthModule;

/**
 * Responsive width configuration
 */
export interface ResponsiveWidthConfig {
  marginLeft: number;   // Default: 5
  marginRight: number;  // Default: 5
  minWidth: number;     // Default: 40
  maxWidth: number;     // Default: 200
}

/**
 * Get safe terminal width across all environments
 * Priority: ENV override > TTY width > COLUMNS env > default 80
 */
export function getSafeTerminalWidth(): number {
  // 1. Fixed width override (for debugging/CI)
  if (process.env.MARIA_FIXED_WIDTH) {
    const fixed = Number(process.env.MARIA_FIXED_WIDTH);
    if (Number.isFinite(fixed) && fixed > 0) {
      return fixed;
    }
  }
  
  // 2. TTY environment dynamic detection
  const isTTY = process.stdout && process.stdout.isTTY;
  if (isTTY && typeof process.stdout.columns === 'number' && process.stdout.columns > 0) {
    return process.stdout.columns;
  }
  
  // 3. Environment variable fallback (SSH/Docker/CI)
  const envColumns = Number(process.env.COLUMNS);
  if (Number.isFinite(envColumns) && envColumns > 0) {
    return envColumns;
  }
  
  // 4. Windows PowerShell specific handling
  if (process.platform === 'win32') {
    try {
      const { execSync } = require('child_process');
      const result = execSync('powershell -command "$host.UI.RawUI.WindowSize.Width"', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'] // Suppress stderr
      });
      const width = parseInt(result.trim());
      if (Number.isFinite(width) && width > 0) {
        return width;
      }
    } catch {
      // Fallback to default if PowerShell command fails
    }
  }
  
  // 5. Default fallback
  return 80;
}

/**
 * Calculate responsive width with margins
 */
export function getResponsiveWidth(config?: Partial<ResponsiveWidthConfig>): number {
  // Check if responsive is disabled
  if (process.env.MARIA_DISABLE_RESPONSIVE === '1') {
    return config?.maxWidth || 120;
  }
  
  const terminalWidth = getSafeTerminalWidth();
  const marginLeft = config?.marginLeft ?? 5;
  const marginRight = config?.marginRight ?? 5;
  const minWidth = config?.minWidth ?? 40;
  const maxWidth = config?.maxWidth ?? 200;
  
  const availableWidth = terminalWidth - marginLeft - marginRight;
  return Math.max(minWidth, Math.min(availableWidth, maxWidth));
}

/**
 * Calculate visible width (handles ANSI, emoji, fullwidth chars)
 */
export function visibleWidth(text: string): number {
  try {
    return stringWidth(stripAnsi(text));
  } catch {
    // Fallback for edge cases
    return stripAnsi(text).length;
  }
}

/**
 * Truncate text to specified width (fullwidth-aware)
 */
export function truncateToWidth(text: string, maxWidth: number, ellipsis: string = '…'): string {
  if (maxWidth <= 0) return '';
  
  const stripped = stripAnsi(text);
  const currentWidth = stringWidth(stripped);
  
  if (currentWidth <= maxWidth) {
    return text;
  }
  
  const ellipsisWidth = stringWidth(ellipsis);
  if (ellipsisWidth >= maxWidth) {
    return ellipsis.substring(0, 1); // Ensure we return something
  }
  
  const targetWidth = maxWidth - ellipsisWidth;
  let result = '';
  let width = 0;
  
  for (const char of stripped) {
    const charWidth = stringWidth(char);
    if (width + charWidth > targetWidth) {
      break;
    }
    result += char;
    width += charWidth;
  }
  
  return result + ellipsis;
}

/**
 * Pad text to target width (for box drawing)
 */
export function padToWidth(text: string, targetWidth: number, padChar: string = ' '): string {
  const currentWidth = visibleWidth(text);
  const paddingWidth = targetWidth - currentWidth;
  
  if (paddingWidth <= 0) {
    return truncateToWidth(text, targetWidth);
  }
  
  return text + padChar.repeat(paddingWidth);
}

/**
 * Draw box lines with proper width handling
 */
export function drawBoxLines(width: number, lines: string[]): string {
  if (width < 3) return ''; // Too narrow for a box
  
  const innerWidth = Math.max(1, width - 2);
  const top = `┌${'─'.repeat(innerWidth)}┐`;
  const bottom = `└${'─'.repeat(innerWidth)}┘`;
  
  const bodyLines = lines.map(line => {
    const truncated = truncateToWidth(line, innerWidth);
    const padded = padToWidth(truncated, innerWidth);
    return `│${padded}│`;
  });
  
  return [top, ...bodyLines, bottom].join('\n');
}

/**
 * Wrap text to multiple lines at specified width
 */
export function wrapText(text: string, maxWidth: number): string[] {
  if (maxWidth <= 0) return [];
  
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';
  let currentWidth = 0;
  
  for (const word of words) {
    const wordWidth = stringWidth(word);
    const spaceWidth = currentLine ? 1 : 0;
    
    if (currentWidth + spaceWidth + wordWidth <= maxWidth) {
      if (currentLine) {
        currentLine += ' ';
        currentWidth += 1;
      }
      currentLine += word;
      currentWidth += wordWidth;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      
      // Handle words longer than maxWidth
      if (wordWidth > maxWidth) {
        const truncated = truncateToWidth(word, maxWidth);
        lines.push(truncated);
        currentLine = '';
        currentWidth = 0;
      } else {
        currentLine = word;
        currentWidth = wordWidth;
      }
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines;
}

/**
 * Debounce function for resize events
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function debounced(...args: Parameters<T>) {
    if (timeout) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(() => {
      func(...args);
      timeout = null;
    }, wait);
  };
}

/**
 * Responsive Layout Manager
 * Centralized width management for all components
 */
export class ResponsiveLayoutManager {
  private currentWidth: number;
  private listeners = new Set<(width: number) => void>();
  private resizeHandler?: () => void;
  private lastWidth: number;
  private disposed = false;
  
  constructor(private config?: Partial<ResponsiveWidthConfig>) {
    this.currentWidth = getResponsiveWidth(config);
    this.lastWidth = this.currentWidth;
    this.setupResizeHandling();
  }
  
  private setupResizeHandling(): void {
    // Create debounced resize handler
    this.resizeHandler = debounce(() => {
      if (this.disposed) return;
      
      const newWidth = getResponsiveWidth(this.config);
      
      // Only notify if width actually changed
      if (newWidth !== this.lastWidth) {
        this.currentWidth = newWidth;
        this.lastWidth = newWidth;
        this.notifyListeners();
      }
    }, 100);
    
    // Register resize event (TTY only)
    if (process.stdout && process.stdout.isTTY) {
      process.stdout.on('resize', this.resizeHandler);
    }
    
    // Also listen for SIGWINCH signal (terminal resize)
    if (process.platform !== 'win32') {
      process.on('SIGWINCH', this.resizeHandler);
    }
  }
  
  /**
   * Subscribe to width changes
   * Returns unsubscribe function
   */
  subscribe(listener: (width: number) => void): () => void {
    if (this.disposed) {
      throw new Error('ResponsiveLayoutManager has been disposed');
    }
    
    this.listeners.add(listener);
    listener(this.currentWidth); // Initial call
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }
  
  /**
   * Manually update width (for testing)
   */
  updateWidth(width: number): void {
    if (this.disposed) return;
    
    if (width !== this.currentWidth && width > 0) {
      this.currentWidth = width;
      this.lastWidth = width;
      this.notifyListeners();
    }
  }
  
  /**
   * Force refresh width from terminal
   */
  refresh(): void {
    if (this.disposed) return;
    
    const newWidth = getResponsiveWidth(this.config);
    if (newWidth !== this.currentWidth) {
      this.currentWidth = newWidth;
      this.lastWidth = newWidth;
      this.notifyListeners();
    }
  }
  
  private notifyListeners(): void {
    if (this.disposed) return;
    
    for (const listener of this.listeners) {
      try {
        listener(this.currentWidth);
      } catch (error) {
        console.error('Error in width change listener:', error);
      }
    }
  }
  
  /**
   * Get current width
   */
  getWidth(): number {
    return this.currentWidth;
  }
  
  /**
   * Get configuration
   */
  getConfig(): Partial<ResponsiveWidthConfig> | undefined {
    return this.config;
  }
  
  /**
   * Check if responsive is enabled
   */
  isResponsive(): boolean {
    return process.env.MARIA_DISABLE_RESPONSIVE !== '1';
  }
  
  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.disposed) return;
    
    this.disposed = true;
    
    if (this.resizeHandler) {
      if (process.stdout && process.stdout.isTTY) {
        process.stdout.removeListener('resize', this.resizeHandler);
      }
      
      if (process.platform !== 'win32') {
        process.removeListener('SIGWINCH', this.resizeHandler);
      }
    }
    
    this.listeners.clear();
  }
}

// Singleton instance management
let sharedManager: ResponsiveLayoutManager | null = null;

/**
 * Get or create shared layout manager
 */
export function getSharedLayoutManager(config?: Partial<ResponsiveWidthConfig>): ResponsiveLayoutManager {
  if (!sharedManager) {
    sharedManager = new ResponsiveLayoutManager(config);
  }
  return sharedManager;
}

/**
 * Dispose shared layout manager
 */
export function disposeSharedLayoutManager(): void {
  if (sharedManager) {
    sharedManager.dispose();
    sharedManager = null;
  }
}

/**
 * Check if running in CI environment
 */
export function isCI(): boolean {
  return !!(
    process.env.CI ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.JENKINS_HOME ||
    process.env.TRAVIS ||
    process.env.CIRCLECI ||
    process.env.BUILDKITE ||
    process.env.DRONE
  );
}

/**
 * Auto-configure for CI environments
 */
export function autoConfigureForEnvironment(): void {
  if (isCI() || !process.stdout.isTTY) {
    // Use fixed width in CI or non-TTY environments
    if (!process.env.MARIA_FIXED_WIDTH) {
      process.env.MARIA_FIXED_WIDTH = '80';
    }
  }
}

// Auto-configure on module load
autoConfigureForEnvironment();

/**
 * Get compatibility width (for migration period)
 */
export function getCompatibleWidth(fixedWidth?: number): number {
  if (fixedWidth !== undefined && fixedWidth > 0) {
    // Explicit fixed width takes precedence
    return fixedWidth;
  }
  return getResponsiveWidth();
}

// Export types
export type WidthChangeListener = (width: number) => void;

// Memory leak prevention
if (process.env.NODE_ENV !== 'production') {
  process.on('exit', () => {
    disposeSharedLayoutManager();
  });
}