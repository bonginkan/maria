/**
 * UI Module - Unified Export
 * 124文字幅最適化デザインシステムの統合エクスポート
 */

// Core Design System
export * from './optimized-design-system.js';
export * from './design-system/UnifiedColorPalette.js';
export * from './design-system/MinimalIconRegistry.js';
export * from './design-system/LayoutManager.js';
export * from './design-system/ResponsiveRenderer.js';
export * from './design-system/OptimizedBox.js';

// Animation System
export * from './animations/OptimizedAnimations.js';

// Components
export * from './components/StatusBarRenderer.js';
export * from './components/OptimizedProgress.js';
export * from './components/OptimizedTable.js';

// Performance & Optimization
export * from './performance/RenderOptimizer.js';

// Accessibility
export * from './accessibility/AccessibilityManager.js';

// Error Handling
export * from './error-handling/ErrorRecovery.js';

// Legacy Support
export * from './base-command.js';
export * from './argument-validator.js';
export * from './response-formatter.js';
export * from './progress-indicator.js';

// Re-export main design system
import OptimizedDesignSystem from './optimized-design-system.js';
export default OptimizedDesignSystem;
