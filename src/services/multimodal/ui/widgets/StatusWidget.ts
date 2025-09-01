/**
 * Status Widget for displaying system health and provider status
 */

import { BaseWidget, WidgetOptions } from './BaseWidget.js';

export interface StatusItem {
  id: string;
  name: string;
  status: 'active' | 'idle' | 'error' | 'warning' | 'offline';
  value?: string | number;
  details?: string;
  lastUpdated?: Date;
}

export interface StatusWidgetState {
  items: StatusItem[];
  autoRefresh: boolean;
  refreshInterval: number;
  sortBy: 'name' | 'status' | 'lastUpdated';
  filter: 'all' | 'active' | 'error' | 'warning';
  showTimestamps: boolean;
}

export interface StatusWidgetOptions extends WidgetOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  sortBy?: 'name' | 'status' | 'lastUpdated';
  filter?: 'all' | 'active' | 'error' | 'warning';
  showTimestamps?: boolean;
}

export class StatusWidget extends BaseWidget<StatusWidgetState> {
  private refreshTimer?: NodeJS.Timeout;

  constructor(
    screen: any,
    options: StatusWidgetOptions
  ) {
    const initialState: StatusWidgetState = {
      items: [],
      autoRefresh: options.autoRefresh !== false,
      refreshInterval: options.refreshInterval || 2000,
      sortBy: options.sortBy || 'name',
      filter: options.filter || 'all',
      showTimestamps: options.showTimestamps !== false
    };

    super(screen, options, initialState);
  }

  protected onMount(): void {
    if (this.getState().autoRefresh) {
      this.startAutoRefresh();
    }
  }

  protected onUnmount(): void {
    this.stopAutoRefresh();
  }

  // Public API
  updateStatus(item: StatusItem): void {
    const state = this.getState();
    const items = [...state.items];
    const existingIndex = items.findIndex(i => i.id === item.id);

    item.lastUpdated = new Date();

    if (existingIndex >= 0) {
      items[existingIndex] = item;
    } else {
      items.push(item);
    }

    this.setState({ items });
  }

  removeStatus(id: string): void {
    const state = this.getState();
    const items = state.items.filter(item => item.id !== id);
    this.setState({ items });
  }

  clearAll(): void {
    this.setState({ items: [] });
  }

  setFilter(filter: StatusWidgetState['filter']): void {
    this.setState({ filter });
  }

  setSortBy(sortBy: StatusWidgetState['sortBy']): void {
    this.setState({ sortBy });
  }

  startAutoRefresh(): void {
    this.stopAutoRefresh();
    
    this.refreshTimer = setInterval(() => {
      this.render();
      this.emit('refresh');
    }, this.getState().refreshInterval);
  }

  stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  render(): void {
    const state = this.getState();
    
    if (state.items.length === 0) {
      this.setContent('No status items');
      return;
    }

    let content = '';

    // Header
    content += `{bold}${this.options.title || 'System Status'}{/bold}\n`;
    content += '━'.repeat(this.width - 4) + '\n';

    // Summary stats
    const statusCounts = this.getStatusCounts();
    content += `Total: {bold}${state.items.length}{/bold} | `;
    content += `Active: {green-fg}${statusCounts.active}{/green-fg} | `;
    content += `Errors: {red-fg}${statusCounts.error}{/red-fg} | `;
    content += `Warnings: {yellow-fg}${statusCounts.warning}{/yellow-fg}\n\n`;

    // Filter and sort items
    const filteredItems = this.getFilteredItems();
    const sortedItems = this.getSortedItems(filteredItems);

    // Render items
    if (sortedItems.length === 0) {
      content += `{dim}No items matching filter: ${state.filter}{/dim}`;
    } else {
      for (const item of sortedItems) {
        content += this.renderStatusItem(item) + '\n';
      }
    }

    // Footer with controls
    content += '\n{dim}Filter: [a]ll | [e]rrors | [w]arnings | Sort: [n]ame | [s]tatus{/dim}';

    this.setContent(content);
  }

  private renderStatusItem(item: StatusItem): string {
    const state = this.getState();
    let line = '';

    // Status indicator
    const statusChar = this.getStatusChar(item.status);
    const statusColor = this.getStatusColor(item.status);
    line += `{${statusColor}}${statusChar}{/${statusColor}} `;

    // Name and value
    const nameWidth = Math.max(12, Math.floor(this.width * 0.3));
    line += item.name.padEnd(nameWidth).substring(0, nameWidth);
    
    if (item.value !== undefined) {
      const valueStr = typeof item.value === 'number' 
        ? item.value.toFixed(2) 
        : String(item.value);
      line += ` ${valueStr.padStart(8)}`;
    }

    // Status text
    const statusText = item.status.toUpperCase().padStart(8);
    line += ` {${statusColor}}${statusText}{/${statusColor}}`;

    // Details
    if (item.details) {
      const maxDetailsLength = this.width - line.replace(/{[^}]*}/g, '').length - 4;
      if (maxDetailsLength > 0) {
        const details = item.details.substring(0, maxDetailsLength);
        line += ` {dim}${details}{/dim}`;
      }
    }

    // Timestamp
    if (state.showTimestamps && item.lastUpdated) {
      line += '\n  {dim}' + item.lastUpdated.toLocaleTimeString() + '{/dim}';
    }

    return line;
  }

  private getStatusChar(status: StatusItem['status']): string {
    switch (status) {
      case 'active': return '●';
      case 'idle': return '◐';
      case 'error': return '✖';
      case 'warning': return '⚠';
      case 'offline': return '○';
      default: return '?';
    }
  }

  private getStatusColor(status: StatusItem['status']): string {
    switch (status) {
      case 'active': return 'green-fg';
      case 'idle': return 'yellow-fg';
      case 'error': return 'red-fg';
      case 'warning': return 'yellow-fg';
      case 'offline': return 'gray-fg';
      default: return 'white-fg';
    }
  }

  private getStatusCounts() {
    const state = this.getState();
    const counts = {
      active: 0,
      idle: 0,
      error: 0,
      warning: 0,
      offline: 0
    };

    for (const item of state.items) {
      counts[item.status]++;
    }

    return counts;
  }

  private getFilteredItems(): StatusItem[] {
    const state = this.getState();
    
    if (state.filter === 'all') {
      return state.items;
    }
    
    return state.items.filter(item => {
      switch (state.filter) {
        case 'active': return item.status === 'active';
        case 'error': return item.status === 'error';
        case 'warning': return item.status === 'warning';
        default: return true;
      }
    });
  }

  private getSortedItems(items: StatusItem[]): StatusItem[] {
    const state = this.getState();
    
    return [...items].sort((a, b) => {
      switch (state.sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'status':
          return this.getStatusPriority(a.status) - this.getStatusPriority(b.status);
        case 'lastUpdated':
          if (!a.lastUpdated && !b.lastUpdated) return 0;
          if (!a.lastUpdated) return 1;
          if (!b.lastUpdated) return -1;
          return b.lastUpdated.getTime() - a.lastUpdated.getTime();
        default:
          return 0;
      }
    });
  }

  private getStatusPriority(status: StatusItem['status']): number {
    switch (status) {
      case 'error': return 0;
      case 'warning': return 1;
      case 'offline': return 2;
      case 'idle': return 3;
      case 'active': return 4;
      default: return 5;
    }
  }

  // Keyboard navigation
  protected onActivate(): void {
    // Cycle through filters
    const state = this.getState();
    const filters: StatusWidgetState['filter'][] = ['all', 'active', 'error', 'warning'];
    const currentIndex = filters.indexOf(state.filter);
    const nextIndex = (currentIndex + 1) % filters.length;
    this.setState({ filter: filters[nextIndex] });
  }
}