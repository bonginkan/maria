/**
 * Tests for Responsive Width Management System
 * @module responsive-width.test
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getSafeTerminalWidth,
  getResponsiveWidth,
  visibleWidth,
  truncateToWidth,
  padToWidth,
  drawBoxLines,
  wrapText,
  ResponsiveLayoutManager,
  getSharedLayoutManager,
  disposeSharedLayoutManager,
  isCI,
  autoConfigureForEnvironment,
  getCompatibleWidth,
} from '../ui/integrated-cli/responsive-width';
import chalk from 'chalk';

describe('Responsive Width Utilities', () => {
  let originalColumns: number | undefined;
  let originalIsTTY: boolean | undefined;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original values
    originalColumns = process.stdout.columns;
    originalIsTTY = process.stdout.isTTY;
    originalEnv = { ...process.env };
    
    // Clear environment variables
    delete process.env.MARIA_FIXED_WIDTH;
    delete process.env.MARIA_DISABLE_RESPONSIVE;
    delete process.env.COLUMNS;
    delete process.env.CI;
  });

  afterEach(() => {
    // Restore original values
    process.stdout.columns = originalColumns;
    process.stdout.isTTY = originalIsTTY;
    process.env = originalEnv;
    
    // Clean up shared manager
    disposeSharedLayoutManager();
  });

  describe('getSafeTerminalWidth', () => {
    test('should return TTY width when available', () => {
      process.stdout.columns = 120;
      process.stdout.isTTY = true;
      expect(getSafeTerminalWidth()).toBe(120);
    });

    test('should use MARIA_FIXED_WIDTH when set', () => {
      process.env.MARIA_FIXED_WIDTH = '100';
      process.stdout.columns = 120;
      expect(getSafeTerminalWidth()).toBe(100);
    });

    test('should fallback to COLUMNS env var when not TTY', () => {
      process.stdout.isTTY = false;
      process.env.COLUMNS = '90';
      expect(getSafeTerminalWidth()).toBe(90);
    });

    test('should return default 80 when no width available', () => {
      process.stdout.isTTY = false;
      process.stdout.columns = undefined;
      expect(getSafeTerminalWidth()).toBe(80);
    });

    test('should handle invalid MARIA_FIXED_WIDTH', () => {
      process.env.MARIA_FIXED_WIDTH = 'invalid';
      process.stdout.columns = 100;
      process.stdout.isTTY = true;
      expect(getSafeTerminalWidth()).toBe(100);
    });
  });

  describe('getResponsiveWidth', () => {
    test('should calculate width with margins', () => {
      process.stdout.columns = 100;
      process.stdout.isTTY = true;
      const width = getResponsiveWidth({
        marginLeft: 5,
        marginRight: 5,
      });
      expect(width).toBe(90); // 100 - 10
    });

    test('should respect minimum width', () => {
      process.stdout.columns = 30;
      process.stdout.isTTY = true;
      const width = getResponsiveWidth({
        minWidth: 40,
        marginLeft: 5,
        marginRight: 5,
      });
      expect(width).toBe(40); // Min width enforced
    });

    test('should respect maximum width', () => {
      process.stdout.columns = 250;
      process.stdout.isTTY = true;
      const width = getResponsiveWidth({
        maxWidth: 200,
        marginLeft: 5,
        marginRight: 5,
      });
      expect(width).toBe(200); // Max width enforced
    });

    test('should return fixed width when responsive disabled', () => {
      process.env.MARIA_DISABLE_RESPONSIVE = '1';
      process.stdout.columns = 100;
      const width = getResponsiveWidth({
        maxWidth: 120,
      });
      expect(width).toBe(120);
    });

    test('should use default margins when not specified', () => {
      process.stdout.columns = 100;
      process.stdout.isTTY = true;
      const width = getResponsiveWidth();
      expect(width).toBe(90); // 100 - 10 (default margins)
    });
  });

  describe('visibleWidth', () => {
    test('should handle plain text', () => {
      expect(visibleWidth('Hello')).toBe(5);
    });

    test('should strip ANSI codes', () => {
      const colored = chalk.red('Hello');
      expect(visibleWidth(colored)).toBe(5);
    });

    test('should handle emoji correctly', () => {
      expect(visibleWidth('👍')).toBe(2);
      expect(visibleWidth('Hello 👍')).toBe(8);
    });

    test('should handle fullwidth characters', () => {
      expect(visibleWidth('こんにちは')).toBe(10); // 5 chars * 2 width
      expect(visibleWidth('你好')).toBe(4); // 2 chars * 2 width
    });

    test('should handle mixed width text', () => {
      expect(visibleWidth('Hello 世界')).toBe(10); // 6 + 4
    });

    test('should handle empty string', () => {
      expect(visibleWidth('')).toBe(0);
    });
  });

  describe('truncateToWidth', () => {
    test('should not truncate short text', () => {
      expect(truncateToWidth('Hello', 10)).toBe('Hello');
    });

    test('should truncate long text with ellipsis', () => {
      expect(truncateToWidth('Hello World', 8)).toBe('Hello W…');
    });

    test('should handle fullwidth characters', () => {
      // Each Japanese character is 2 width, ellipsis is 1 width
      // So with width 10, we can fit 4 chars (8 width) + ellipsis (1 width) = 9 width
      expect(truncateToWidth('こんにちは世界', 10)).toBe('こんにち…');
    });

    test('should handle emoji', () => {
      expect(truncateToWidth('Hello 👍 World', 8)).toBe('Hello …');
    });

    test('should handle custom ellipsis', () => {
      expect(truncateToWidth('Hello World', 8, '...')).toBe('Hello...');
    });

    test('should handle zero width', () => {
      expect(truncateToWidth('Hello', 0)).toBe('');
    });

    test('should handle width smaller than ellipsis', () => {
      expect(truncateToWidth('Hello', 1, '...')).toBe('.');
    });
  });

  describe('padToWidth', () => {
    test('should pad short text', () => {
      const padded = padToWidth('Hello', 10);
      expect(visibleWidth(padded)).toBe(10);
      expect(padded).toBe('Hello     ');
    });

    test('should truncate long text', () => {
      const padded = padToWidth('Hello World', 5);
      expect(visibleWidth(padded)).toBe(5);
      expect(padded).toBe('Hell…');
    });

    test('should handle fullwidth characters', () => {
      const padded = padToWidth('こんにちは', 15);
      expect(visibleWidth(padded)).toBe(15);
      expect(padded).toBe('こんにちは     ');
    });

    test('should handle custom pad character', () => {
      const padded = padToWidth('Hello', 10, '-');
      expect(padded).toBe('Hello-----');
    });
  });

  describe('drawBoxLines', () => {
    test('should draw a simple box', () => {
      const lines = ['Hello', 'World'];
      const box = drawBoxLines(12, lines);
      const expectedLines = [
        '┌──────────┐',
        '│Hello     │',
        '│World     │',
        '└──────────┘',
      ];
      expect(box).toBe(expectedLines.join('\n'));
    });

    test('should handle narrow box', () => {
      const box = drawBoxLines(3, ['Hi']);
      expect(box).toContain('┌─┐');
      expect(box).toContain('└─┘');
    });

    test('should handle too narrow box', () => {
      const box = drawBoxLines(2, ['Hi']);
      expect(box).toBe('');
    });

    test('should truncate long lines', () => {
      const lines = ['This is a very long line'];
      const box = drawBoxLines(10, lines);
      expect(box).toContain('This is…');
    });

    test('should handle fullwidth characters', () => {
      const lines = ['こんにちは'];
      const box = drawBoxLines(14, lines);
      expect(box).toContain('│こんにちは  │');
    });
  });

  describe('wrapText', () => {
    test('should wrap long text', () => {
      const text = 'This is a long sentence that needs to be wrapped';
      const wrapped = wrapText(text, 20);
      expect(wrapped).toHaveLength(3);
      expect(wrapped[0]).toBe('This is a long');
      expect(wrapped[1]).toBe('sentence that needs');
      expect(wrapped[2]).toBe('to be wrapped');
    });

    test('should handle single long word', () => {
      const text = 'Supercalifragilisticexpialidocious';
      const wrapped = wrapText(text, 10);
      expect(wrapped).toHaveLength(1);
      expect(wrapped[0]).toBe('Supercali…');
    });

    test('should handle empty text', () => {
      expect(wrapText('', 10)).toEqual([]);
    });

    test('should handle zero width', () => {
      expect(wrapText('Hello', 0)).toEqual([]);
    });

    test('should preserve single spaces', () => {
      const wrapped = wrapText('Hello  World', 20);
      expect(wrapped).toEqual(['Hello World']);
    });
  });

  describe('ResponsiveLayoutManager', () => {
    test('should initialize with current width', () => {
      process.stdout.columns = 100;
      process.stdout.isTTY = true;
      const manager = new ResponsiveLayoutManager({
        marginLeft: 5,
        marginRight: 5,
      });
      expect(manager.getWidth()).toBe(90);
    });

    test('should notify subscribers on width change', async () => {
      process.stdout.columns = 100;
      process.stdout.isTTY = true;
      
      const manager = new ResponsiveLayoutManager();
      let notifiedWidth = 0;
      
      manager.subscribe((width) => {
        notifiedWidth = width;
      });
      
      // Initial notification
      expect(notifiedWidth).toBe(90);
      
      // Manual update
      manager.updateWidth(120);
      expect(notifiedWidth).toBe(120);
    });

    test('should return unsubscribe function', () => {
      const manager = new ResponsiveLayoutManager();
      let callCount = 0;
      
      const unsubscribe = manager.subscribe(() => {
        callCount++;
      });
      
      expect(callCount).toBe(1); // Initial call
      
      manager.updateWidth(100);
      expect(callCount).toBe(2);
      
      unsubscribe();
      manager.updateWidth(120);
      expect(callCount).toBe(2); // No change after unsubscribe
    });

    test('should check if responsive is enabled', () => {
      const manager = new ResponsiveLayoutManager();
      expect(manager.isResponsive()).toBe(true);
      
      process.env.MARIA_DISABLE_RESPONSIVE = '1';
      expect(manager.isResponsive()).toBe(false);
    });

    test('should handle dispose correctly', () => {
      const manager = new ResponsiveLayoutManager();
      manager.dispose();
      
      // Should throw when trying to subscribe after dispose
      expect(() => {
        manager.subscribe(() => {});
      }).toThrow('ResponsiveLayoutManager has been disposed');
    });

    test('should not notify for same width', () => {
      const manager = new ResponsiveLayoutManager();
      let callCount = 0;
      
      manager.subscribe(() => {
        callCount++;
      });
      
      expect(callCount).toBe(1);
      
      const currentWidth = manager.getWidth();
      manager.updateWidth(currentWidth);
      expect(callCount).toBe(1); // No change
    });
  });

  describe('Shared Layout Manager', () => {
    test('should return same instance', () => {
      const manager1 = getSharedLayoutManager();
      const manager2 = getSharedLayoutManager();
      expect(manager1).toBe(manager2);
    });

    test('should dispose shared manager', () => {
      const manager1 = getSharedLayoutManager();
      disposeSharedLayoutManager();
      const manager2 = getSharedLayoutManager();
      expect(manager1).not.toBe(manager2);
    });
  });

  describe('CI Detection', () => {
    test('should detect CI environment', () => {
      expect(isCI()).toBe(false);
      
      process.env.CI = 'true';
      expect(isCI()).toBe(true);
      
      delete process.env.CI;
      process.env.GITHUB_ACTIONS = 'true';
      expect(isCI()).toBe(true);
    });
  });

  describe('Auto Configuration', () => {
    test('should set fixed width in CI', () => {
      process.env.CI = 'true';
      delete process.env.MARIA_FIXED_WIDTH;
      
      autoConfigureForEnvironment();
      expect(process.env.MARIA_FIXED_WIDTH).toBe('80');
    });

    test('should not override existing fixed width', () => {
      process.env.CI = 'true';
      process.env.MARIA_FIXED_WIDTH = '120';
      
      autoConfigureForEnvironment();
      expect(process.env.MARIA_FIXED_WIDTH).toBe('120');
    });
  });

  describe('Compatible Width', () => {
    test('should use fixed width when provided', () => {
      process.stdout.columns = 100;
      expect(getCompatibleWidth(120)).toBe(120);
    });

    test('should use responsive width when no fixed width', () => {
      process.stdout.columns = 100;
      process.stdout.isTTY = true;
      expect(getCompatibleWidth()).toBe(90);
    });

    test('should ignore invalid fixed width', () => {
      process.stdout.columns = 100;
      process.stdout.isTTY = true;
      expect(getCompatibleWidth(0)).toBe(90);
      expect(getCompatibleWidth(-1)).toBe(90);
    });
  });

  describe('Edge Cases', () => {
    test('should handle missing columns property', () => {
      const originalColumns = process.stdout.columns;
      process.stdout.columns = undefined;
      process.stdout.isTTY = false;
      
      expect(getSafeTerminalWidth()).toBe(80);
      
      process.stdout.columns = originalColumns;
    });

    test('should handle resize event simulation', async () => {
      if (!process.stdout.isTTY) {
        return;
      }
      
      process.stdout.columns = 100;
      const manager = new ResponsiveLayoutManager();
      
      let widths: number[] = [];
      manager.subscribe((width) => {
        widths.push(width);
      });
      
      // Simulate resize
      process.stdout.columns = 120;
      process.stdout.emit('resize');
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(widths.length).toBeGreaterThanOrEqual(1);
      manager.dispose();
    });
  });
});