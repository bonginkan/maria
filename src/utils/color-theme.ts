/**
 * MARIA CODE Color Theme System
 * Based on Tailwind CSS color palette for consistency
 */

export const _ColorTheme = {
  // Primary colors - Based on Tailwind CSS
  success: {
    default: "#10B981", // emerald-500
    light: "#34D399", // emerald-400
    dark: "#059669", // emerald-600
    text: "#10B981",
    icon: "🟢",
  },

  info: {
    default: "#3B82F6", // blue-500
    light: "#60A5FA", // blue-400
    dark: "#2563EB", // blue-600
    text: "#3B82F6",
    icon: "🔵",
  },

  warning: {
    default: "#F59E0B", // amber-500
    light: "#FBBF24", // amber-400
    dark: "#D97706", // amber-600
    text: "#F59E0B",
    icon: "🟡",
  },

  error: {
    default: "#EF4444", // red-500
    light: "#F87171", // red-400
    dark: "#DC2626", // red-600
    text: "#EF4444",
    icon: "🔴",
  },

  ai: {
    default: "#8B5CF6", // violet-500
    light: "#A78BFA", // violet-400
    dark: "#7C3AED", // violet-600
    text: "#8B5CF6",
    icon: "🟣",
  },

  // Neutral colors
  neutral: {
    text: "#F3F4F6", // gray-100 - main text
    textDim: "#9CA3AF", // gray-400 - secondary text
    textMuted: "#6B7280", // gray-500 - muted text
    border: "#404040", // custom border
    background: "#0A0A0A", // deep dark background
    inputBg: "#1A1A1A", // input field background
    icon: "⚪",
  },
};

// Status colors for different states
export const _StatusColors = {
  idle: _ColorTheme.neutral.textMuted,
  processing: _ColorTheme.ai.default,
  success: _ColorTheme.success.default,
  error: _ColorTheme.error.default,
  warning: _ColorTheme.warning.default,
  info: _ColorTheme.info.default,
};

// Command category colors
export const _CommandCategoryColors = {
  code: _ColorTheme.ai.default,
  test: _ColorTheme.success.default,
  media: _ColorTheme.info.default,
  config: _ColorTheme.warning.default,
  user: _ColorTheme.neutral.text,
  dev: _ColorTheme.error.default,
};

// Terminal color mapping for Ink components
export const _InkColorMap = {
  // Success variants
  success: "green",
  "success-bright": "greenBright",

  // Info variants
  info: "blue",
  "info-bright": "blueBright",

  // Warning variants
  warning: "yellow",
  "warning-bright": "yellowBright",

  // Error variants
  error: "red",
  "error-bright": "redBright",

  // AI/Processing variants
  ai: "magenta",
  "ai-bright": "magentaBright",

  // Neutral variants
  neutral: "white",
  "neutral-dim": "gray",
  "neutral-muted": "gray",
};

// Get appropriate color for different message types
export function getMessageColor(
  _type: "success" | "error" | "warning" | "info" | "ai" | "neutral",
): string {
  const _colorMap = {
    success: "green",
    error: "red",
    warning: "yellow",
    info: "blue",
    ai: "magenta",
    neutral: "white",
  };
  return _colorMap[_type] || "white";
}

// Get status icon based on state
export function getStatusIcon(status: string): string {
  const iconMap: Record<string, string> = {
    // Processing states
    idle: "⭕",
    processing: "🔄",
    thinking: "🤔",
    loading: "⏳",

    // Result states
    success: "✅",
    complete: "✓",
    error: "❌",
    failed: "✗",
    warning: "⚠️",
    info: "ℹ️",

    // Command types
    code: "💻",
    test: "🧪",
    review: "👁️",
    video: "🎬",
    image: "🎨",
    config: "⚙️",
    init: "🚀",
    help: "❓",

    // System states
    ai: "🧠",
    memory: "💾",
    cpu: "🔋",
    network: "📡",
    user: "👤",
    credits: "💰",
  };

  return iconMap[status.toLowerCase()] || "○";
}

// Format text with color and style
export interface TextStyle {
  color?: keyof typeof _InkColorMap;
  bold?: boolean;
  dim?: boolean;
  underline?: boolean;
  icon?: string;
}

export function formatText(_text: string, style: TextStyle): string {
  let formatted = text;

  if (style.icon) {
    formatted = `${style.icon} ${formatted}`;
  }

  // Note: In actual Ink components, these would be props
  // This is for demonstration of the theming system
  return formatted;
}

// Progress bar color based on value
export function getProgressColor(value: number): string {
  if (value < 30) {
    return "red";
  }
  if (value < 70) {
    return "yellow";
  }
  return "green";
}

// Get border style based on state
export function getBorderStyle(
  state: "default" | "active" | "_error" | "success" | "processing",
): {
  borderStyle: string;
  borderColor: string;
} {
  const _styles = {
    default: { borderStyle: "single", borderColor: "gray" },
    active: { borderStyle: "round", borderColor: "cyan" },
    error: { borderStyle: "round", borderColor: "red" },
    success: { borderStyle: "round", borderColor: "green" },
    processing: { borderStyle: "round", borderColor: "yellow" },
  };

  return _styles[state] || _styles.default;
}
