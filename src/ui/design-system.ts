export const colors = {
  primary: '#3b82f6',
  secondary: '#8b5cf6',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#06b6d4',
  text: '#e5e7eb',
  background: '#111827',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const typography = {
  h1: { size: 32, weight: 'bold' },
  h2: { size: 24, weight: 'bold' },
  h3: { size: 20, weight: 'semibold' },
  body: { size: 14, weight: 'normal' },
  small: { size: 12, weight: 'normal' },
};

export const components = {
  button: {
    primary: {
      background: colors.primary,
      color: '#ffffff',
      padding: `${spacing.sm}px ${spacing.md}px`,
    },
    secondary: {
      background: colors.secondary,
      color: '#ffffff',
      padding: `${spacing.sm}px ${spacing.md}px`,
    },
  },
  card: {
    background: colors.background,
    border: `1px solid ${colors.text}`,
    padding: spacing.md,
    borderRadius: 8,
  },
};
