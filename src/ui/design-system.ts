export const _colors = {
  primary: "#3b82f6",
  secondary: "#8b5cf6",
  success: "#10b981",
  warning: "#f59e0b",
  error: "#ef4444",
  info: "#06b6d4",
  text: "#e5e7eb",
  background: "#111827",
};

export const _spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const _typography = {
  h1: { size: 32, weight: "bold" },
  h2: { size: 24, weight: "bold" },
  h3: { size: 20, weight: "semibold" },
  body: { size: 14, weight: "normal" },
  small: { size: 12, weight: "normal" },
};

export const _components = {
  button: {
    primary: {
      background: _colors.primary,
      color: "#ffffff",
      padding: `${_spacing.sm}px ${_spacing.md}px`,
    },
    secondary: {
      background: _colors.secondary,
      color: "#ffffff",
      padding: `${_spacing.sm}px ${_spacing.md}px`,
    },
  },
  card: {
    background: _colors.background,
    border: `1px solid ${_colors.text}`,
    padding: _spacing.md,
    borderRadius: 8,
  },
};
