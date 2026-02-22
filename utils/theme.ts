/**
 * Theme Utilities Module
 * CSS custom properties and theming helpers for consistent styling
 * 
 * Features:
 * - CSS custom property definitions
 * - Theme value accessors
 * - Color system utilities
 * - Spacing and sizing helpers
 * - Dark mode support
 * 
 * @module utils/theme
 */

// =============================================================================
// DESIGN TOKENS
// =============================================================================

/**
 * Brand color tokens
 * Primary green color palette for QuantForge
 */
export const BRAND_COLORS = {
  50: '#f0fdf4',
  100: '#dcfce7',
  200: '#bbf7d0',
  300: '#86efac',
  400: '#4ade80',
  500: '#22c55e',
  600: '#16a34a',
  700: '#15803d',
  800: '#166534',
  900: '#14532d',
} as const;

/**
 * Dark theme color tokens
 * Slate-based dark theme colors
 */
export const DARK_COLORS = {
  bg: '#0f172a',
  surface: '#1e293b',
  border: '#334155',
  elevated: '#475569',
} as const;

/**
 * Semantic color tokens
 * Colors for specific UI purposes
 */
export const SEMANTIC_COLORS = {
  success: BRAND_COLORS[500],
  warning: '#fbbf24',
  error: '#ef4444',
  info: '#3b82f6',
  neutral: '#6b7280',
} as const;

/**
 * Text color tokens
 */
export const TEXT_COLORS = {
  primary: '#f8fafc',
  secondary: '#94a3b8',
  muted: '#64748b',
  disabled: '#475569',
} as const;

// =============================================================================
// SPACING SYSTEM
// =============================================================================

/**
 * Spacing scale based on 4px base unit
 */
export const SPACING = {
  0: '0',
  px: '1px',
  0.5: '0.125rem', // 2px
  1: '0.25rem',    // 4px
  1.5: '0.375rem', // 6px
  2: '0.5rem',     // 8px
  2.5: '0.625rem', // 10px
  3: '0.75rem',    // 12px
  3.5: '0.875rem', // 14px
  4: '1rem',       // 16px
  5: '1.25rem',    // 20px
  6: '1.5rem',     // 24px
  7: '1.75rem',    // 28px
  8: '2rem',       // 32px
  9: '2.25rem',    // 36px
  10: '2.5rem',    // 40px
  11: '2.75rem',   // 44px
  12: '3rem',      // 48px
  14: '3.5rem',    // 56px
  16: '4rem',      // 64px
  20: '5rem',      // 80px
  24: '6rem',      // 96px
  28: '7rem',      // 112px
  32: '8rem',      // 128px
  36: '9rem',      // 144px
  40: '10rem',     // 160px
  44: '11rem',     // 176px
  48: '12rem',     // 192px
  52: '13rem',     // 208px
  56: '14rem',     // 224px
  60: '15rem',     // 240px
  64: '16rem',     // 256px
  72: '18rem',     // 288px
  80: '20rem',     // 320px
  96: '24rem',     // 384px
} as const;

// =============================================================================
// TYPOGRAPHY SYSTEM
// =============================================================================

/**
 * Font family tokens
 */
export const FONT_FAMILIES = {
  sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
  mono: ['JetBrains Mono', 'Consolas', 'monospace'],
} as const;

/**
 * Font size scale
 */
export const FONT_SIZES = {
  xs: '0.75rem',    // 12px
  sm: '0.875rem',   // 14px
  base: '1rem',     // 16px
  lg: '1.125rem',   // 18px
  xl: '1.25rem',    // 20px
  '2xl': '1.5rem',  // 24px
  '3xl': '1.875rem', // 30px
  '4xl': '2.25rem', // 36px
  '5xl': '3rem',    // 48px
  '6xl': '3.75rem', // 60px
  '7xl': '4.5rem',  // 72px
  '8xl': '6rem',    // 96px
  '9xl': '8rem',    // 128px
} as const;

/**
 * Font weight tokens
 */
export const FONT_WEIGHTS = {
  thin: '100',
  extralight: '200',
  light: '300',
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const;

/**
 * Line height tokens
 */
export const LINE_HEIGHTS = {
  none: '1',
  tight: '1.25',
  snug: '1.375',
  normal: '1.5',
  relaxed: '1.625',
  loose: '2',
} as const;

// =============================================================================
// BORDER & RADIUS
// =============================================================================

/**
 * Border radius tokens
 */
export const BORDER_RADIUS = {
  none: '0',
  sm: '0.125rem',  // 2px
  DEFAULT: '0.25rem', // 4px
  md: '0.375rem',  // 6px
  lg: '0.5rem',    // 8px
  xl: '0.75rem',   // 12px
  '2xl': '1rem',   // 16px
  '3xl': '1.5rem', // 24px
  full: '9999px',
} as const;

/**
 * Border width tokens
 */
export const BORDER_WIDTHS = {
  0: '0',
  DEFAULT: '1px',
  2: '2px',
  4: '4px',
  8: '8px',
} as const;

// =============================================================================
// SHADOWS
// =============================================================================

/**
 * Shadow tokens for depth and elevation
 */
export const SHADOWS = {
  none: 'none',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  // Dark theme specific shadows
  glow: '0 0 20px rgba(34, 197, 94, 0.3)',
  glowStrong: '0 0 30px rgba(34, 197, 94, 0.5)',
} as const;

// =============================================================================
// Z-INDEX SCALE
// =============================================================================

/**
 * Z-index scale for layering
 */
export const Z_INDEX = {
  hide: -1,
  base: 0,
  docked: 10,
  dropdown: 1000,
  sticky: 1100,
  banner: 1200,
  overlay: 1300,
  modal: 1400,
  popover: 1500,
  skipLink: 1600,
  toast: 1700,
  tooltip: 1800,
} as const;

// =============================================================================
// BREAKPOINTS
// =============================================================================

/**
 * Responsive breakpoints
 */
export const BREAKPOINTS = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// =============================================================================
// CSS CUSTOM PROPERTY HELPERS
// =============================================================================

/**
 * CSS custom property names
 */
export const CSS_VARS = {
  // Colors
  colorBrand: '--color-brand',
  colorBrandLight: '--color-brand-light',
  colorBrandDark: '--color-brand-dark',
  colorBg: '--color-bg',
  colorSurface: '--color-surface',
  colorBorder: '--color-border',
  colorText: '--color-text',
  colorTextMuted: '--color-text-muted',
  colorSuccess: '--color-success',
  colorWarning: '--color-warning',
  colorError: '--color-error',
  colorInfo: '--color-info',
  
  // Spacing
  spacingXs: '--spacing-xs',
  spacingSm: '--spacing-sm',
  spacingMd: '--spacing-md',
  spacingLg: '--spacing-lg',
  spacingXl: '--spacing-xl',
  
  // Typography
  fontFamilySans: '--font-family-sans',
  fontFamilyMono: '--font-family-mono',
  fontSizeBase: '--font-size-base',
  fontSizeSm: '--font-size-sm',
  fontSizeLg: '--font-size-lg',
  lineHeightBase: '--line-height-base',
  
  // Border
  borderRadiusSm: '--border-radius-sm',
  borderRadiusMd: '--border-radius-md',
  borderRadiusLg: '--border-radius-lg',
  
  // Shadow
  shadowSm: '--shadow-sm',
  shadowMd: '--shadow-md',
  shadowLg: '--shadow-lg',
  shadowGlow: '--shadow-glow',
  
  // Animation
  transitionFast: '--transition-fast',
  transitionNormal: '--transition-normal',
  transitionSlow: '--transition-slow',
  
  // Z-index
  zIndexDropdown: '--z-index-dropdown',
  zIndexModal: '--z-index-modal',
  zIndexToast: '--z-index-toast',
  zIndexTooltip: '--z-index-tooltip',
} as const;

/**
 * Get a CSS custom property value
 */
export function getCSSVar(name: string): string {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Set a CSS custom property value
 */
export function setCSSVar(name: string, value: string): void {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty(name, value);
}

/**
 * Get multiple CSS custom property values
 */
export function getCSSVars(names: string[]): Record<string, string> {
  return names.reduce((acc, name) => {
    acc[name] = getCSSVar(name);
    return acc;
  }, {} as Record<string, string>);
}

// =============================================================================
// THEME HELPERS
// =============================================================================

/**
 * Theme configuration interface
 */
export interface ThemeConfig {
  colors: {
    brand: typeof BRAND_COLORS;
    dark: typeof DARK_COLORS;
    semantic: typeof SEMANTIC_COLORS;
    text: typeof TEXT_COLORS;
  };
  spacing: typeof SPACING;
  typography: {
    fontFamilies: typeof FONT_FAMILIES;
    fontSizes: typeof FONT_SIZES;
    fontWeights: typeof FONT_WEIGHTS;
    lineHeights: typeof LINE_HEIGHTS;
  };
  borders: {
    radius: typeof BORDER_RADIUS;
    widths: typeof BORDER_WIDTHS;
  };
  shadows: typeof SHADOWS;
  zIndex: typeof Z_INDEX;
  breakpoints: typeof BREAKPOINTS;
}

/**
 * Default theme configuration
 */
export const defaultTheme: ThemeConfig = {
  colors: {
    brand: BRAND_COLORS,
    dark: DARK_COLORS,
    semantic: SEMANTIC_COLORS,
    text: TEXT_COLORS,
  },
  spacing: SPACING,
  typography: {
    fontFamilies: FONT_FAMILIES,
    fontSizes: FONT_SIZES,
    fontWeights: FONT_WEIGHTS,
    lineHeights: LINE_HEIGHTS,
  },
  borders: {
    radius: BORDER_RADIUS,
    widths: BORDER_WIDTHS,
  },
  shadows: SHADOWS,
  zIndex: Z_INDEX,
  breakpoints: BREAKPOINTS,
};

/**
 * Apply theme as CSS custom properties
 */
export function applyThemeAsCSSVars(theme: Partial<ThemeConfig> = {}): void {
  const mergedTheme = { ...defaultTheme, ...theme };
  
  // Apply colors
  setCSSVar(CSS_VARS.colorBrand, mergedTheme.colors.brand[500]);
  setCSSVar(CSS_VARS.colorBrandLight, mergedTheme.colors.brand[400]);
  setCSSVar(CSS_VARS.colorBrandDark, mergedTheme.colors.brand[600]);
  setCSSVar(CSS_VARS.colorBg, mergedTheme.colors.dark.bg);
  setCSSVar(CSS_VARS.colorSurface, mergedTheme.colors.dark.surface);
  setCSSVar(CSS_VARS.colorBorder, mergedTheme.colors.dark.border);
  setCSSVar(CSS_VARS.colorText, mergedTheme.colors.text.primary);
  setCSSVar(CSS_VARS.colorTextMuted, mergedTheme.colors.text.secondary);
  setCSSVar(CSS_VARS.colorSuccess, mergedTheme.colors.semantic.success);
  setCSSVar(CSS_VARS.colorWarning, mergedTheme.colors.semantic.warning);
  setCSSVar(CSS_VARS.colorError, mergedTheme.colors.semantic.error);
  setCSSVar(CSS_VARS.colorInfo, mergedTheme.colors.semantic.info);
  
  // Apply spacing
  setCSSVar(CSS_VARS.spacingXs, mergedTheme.spacing[1]);
  setCSSVar(CSS_VARS.spacingSm, mergedTheme.spacing[2]);
  setCSSVar(CSS_VARS.spacingMd, mergedTheme.spacing[4]);
  setCSSVar(CSS_VARS.spacingLg, mergedTheme.spacing[6]);
  setCSSVar(CSS_VARS.spacingXl, mergedTheme.spacing[8]);
  
  // Apply typography
  setCSSVar(CSS_VARS.fontFamilySans, mergedTheme.typography.fontFamilies.sans.join(', '));
  setCSSVar(CSS_VARS.fontFamilyMono, mergedTheme.typography.fontFamilies.mono.join(', '));
  setCSSVar(CSS_VARS.fontSizeBase, mergedTheme.typography.fontSizes.base);
  setCSSVar(CSS_VARS.fontSizeSm, mergedTheme.typography.fontSizes.sm);
  setCSSVar(CSS_VARS.fontSizeLg, mergedTheme.typography.fontSizes.lg);
  setCSSVar(CSS_VARS.lineHeightBase, mergedTheme.typography.lineHeights.normal);
  
  // Apply borders
  setCSSVar(CSS_VARS.borderRadiusSm, mergedTheme.borders.radius.sm);
  setCSSVar(CSS_VARS.borderRadiusMd, mergedTheme.borders.radius.DEFAULT);
  setCSSVar(CSS_VARS.borderRadiusLg, mergedTheme.borders.radius.lg);
  
  // Apply shadows
  setCSSVar(CSS_VARS.shadowSm, mergedTheme.shadows.sm);
  setCSSVar(CSS_VARS.shadowMd, mergedTheme.shadows.md);
  setCSSVar(CSS_VARS.shadowLg, mergedTheme.shadows.lg);
  setCSSVar(CSS_VARS.shadowGlow, mergedTheme.shadows.glow);
  
  // Apply z-index
  setCSSVar(CSS_VARS.zIndexDropdown, String(mergedTheme.zIndex.dropdown));
  setCSSVar(CSS_VARS.zIndexModal, String(mergedTheme.zIndex.modal));
  setCSSVar(CSS_VARS.zIndexToast, String(mergedTheme.zIndex.toast));
  setCSSVar(CSS_VARS.zIndexTooltip, String(mergedTheme.zIndex.tooltip));
}

// =============================================================================
// MEDIA QUERY HELPERS
// =============================================================================

/**
 * Create a media query string for a breakpoint
 */
export function mediaQuery(breakpoint: keyof typeof BREAKPOINTS): string {
  return `(min-width: ${BREAKPOINTS[breakpoint]})`;
}

/**
 * Check if a media query matches
 */
export function matchesMediaQuery(query: string): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(query).matches;
}

/**
 * Subscribe to media query changes
 */
export function onMediaQueryChange(
  query: string,
  callback: (matches: boolean) => void
): () => void {
  if (typeof window === 'undefined') return () => undefined;
  
  const mediaQueryList = window.matchMedia(query);
  const handler = (e: MediaQueryListEvent) => callback(e.matches);
  
  mediaQueryList.addEventListener('change', handler);
  return () => mediaQueryList.removeEventListener('change', handler);
}

// =============================================================================
// COLOR UTILITIES
// =============================================================================

/**
 * Convert hex color to RGB values
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result || !result[1] || !result[2] || !result[3]) {
    return null;
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Convert RGB to hex color
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Calculate relative luminance for contrast checking
 */
export function getLuminance(r: number, g: number, b: number): number {
  const values = [r, g, b].map((c) => {
    const normalized = c / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });
  const rs = values[0] ?? 0;
  const gs = values[1] ?? 0;
  const bs = values[2] ?? 0;
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  
  if (!rgb1 || !rgb2) return 1;
  
  const l1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
  
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast meets WCAG AA requirements
 */
export function meetsContrastAA(color1: string, color2: string, isLargeText = false): boolean {
  const ratio = getContrastRatio(color1, color2);
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
}

/**
 * Check if contrast meets WCAG AAA requirements
 */
export function meetsContrastAAA(color1: string, color2: string, isLargeText = false): boolean {
  const ratio = getContrastRatio(color1, color2);
  return isLargeText ? ratio >= 4.5 : ratio >= 7;
}

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type BrandColor = keyof typeof BRAND_COLORS;
export type Spacing = keyof typeof SPACING;
export type FontSize = keyof typeof FONT_SIZES;
export type FontWeight = keyof typeof FONT_WEIGHTS;
export type LineHeight = keyof typeof LINE_HEIGHTS;
export type BorderRadius = keyof typeof BORDER_RADIUS;
export type Shadow = keyof typeof SHADOWS;
export type ZIndex = keyof typeof Z_INDEX;
export type Breakpoint = keyof typeof BREAKPOINTS;
export type CSSVar = keyof typeof CSS_VARS;
