/**
 * Base Widget class for blessed-based TUI components
 * Provides React-like patterns with blessed performance
 */

import blessed from 'blessed';
import { EventEmitter } from "node:events";

export interface WidgetOptions {
  x?: number | string;
  y?: number | string; 
  width?: number | string;
  height?: number | string;
  title?: string;
  border?: boolean;
  scrollable?: boolean;
  mouse?: boolean;
  style?: {
    fg?: string;
    bg?: string;
    border?: { fg?: string };
  };
}

export interface WidgetState {
  [key: string]: any;
}

export abstract class BaseWidget<TState extends WidgetState = WidgetState> extends EventEmitter {
  protected element: blessed.Widgets.BoxElement;
  protected _state: TState;
  protected _mounted = false;

  constructor(
    protected screen: blessed.Widgets.Screen,
    protected options: WidgetOptions,
    initialState: TState = {} as TState
  ) {
    super();
    this._state = { ...initialState };
    this.createElement();
    this.setupEventHandlers();
  }

  private createElement(): void {
    this.element = blessed.box({
      parent: this.screen,
      top: this.options.y || 0,
      left: this.options.x || 0, 
      width: this.options.width || '50%',
      height: this.options.height || '50%',
      label: this.options.title ? ` ${this.options.title} ` : undefined,
      border: this.options.border ? { type: 'line' } : undefined,
      scrollable: this.options.scrollable || false,
      mouse: this.options.mouse || false,
      tags: true,
      style: {
        fg: 'white',
        border: { fg: 'cyan' },
        ...this.options.style
      }
    });
  }

  private setupEventHandlers(): void {
    // Focus handling
    this.element.on('focus', () => this.onFocus());
    this.element.on('blur', () => this.onBlur());
    
    // Mouse handling
    if (this.options.mouse) {
      this.element.on('click', (data) => this.onClick(data));
      this.element.on('mouseover', () => this.onMouseOver());
      this.element.on('mouseout', () => this.onMouseOut());
    }

    // Keyboard handling
    this.element.key(['enter', 'space'], () => this.onActivate());
  }

  // React-like state management
  protected setState(newState: Partial<TState>, callback?: () => void): void {
    const prevState = { ...this._state };
    this._state = { ...this._state, ...newState };
    
    // Trigger render if state changed
    if (JSON.stringify(prevState) !== JSON.stringify(this._state)) {
      this.render();
      this.emit('stateChange', { prevState, newState: this._state });
    }
    
    if (callback) callback();
  }

  protected getState(): TState {
    return { ...this._state };
  }

  // Lifecycle methods (React-like)
  mount(): void {
    if (this._mounted) return;
    
    this._mounted = true;
    this.onMount();
    this.render();
    this.emit('mount');
  }

  unmount(): void {
    if (!this._mounted) return;
    
    this._mounted = false;
    this.onUnmount();
    this.element.destroy();
    this.emit('unmount');
  }

  // Force re-render
  forceUpdate(): void {
    if (this._mounted) {
      this.render();
    }
  }

  // Event handlers (can be overridden)
  protected onMount(): void {}
  protected onUnmount(): void {}
  protected onFocus(): void {}
  protected onBlur(): void {}
  protected onActivate(): void {}
  protected onClick(data: any): void {}
  protected onMouseOver(): void {}
  protected onMouseOut(): void {}

  // Abstract methods
  abstract render(): void;

  // Utility methods
  protected setContent(content: string): void {
    this.element.setContent(content);
    this.screen.render();
  }

  protected appendLine(line: string): void {
    if (this.options.scrollable) {
      this.element.insertLine(this.element.getLines().length, line);
      this.element.setScrollPerc(100);
      this.screen.render();
    }
  }

  focus(): void {
    this.element.focus();
  }

  hide(): void {
    this.element.hide();
    this.screen.render();
  }

  show(): void {
    this.element.show();
    this.screen.render();
  }

  // Getters
  get width(): number {
    return this.element.width as number;
  }

  get height(): number {
    return this.element.height as number;
  }

  get isMounted(): boolean {
    return this._mounted;
  }

  get isVisible(): boolean {
    return this.element.visible;
  }

  get isFocused(): boolean {
    return this.screen.focused === this.element;
  }
}