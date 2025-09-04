import chroma from 'chroma-js';

export interface ColorPalette {
  cpu: string;
  memory: string;
  grid: string;
  background: string;
  text: string;
  warning: string;
  critical: string;
}

export interface ColorGradients {
  cpu: string[];
  memory: string[];
}

/**
 * WCAG-compliant color palette optimized for data visualization
 * Colors chosen for:
 * - High contrast ratios (WCAG AA compliance)
 * - Colorblind accessibility (especially red-green deficiency)
 * - Distinct visual separation for time-series data
 */
export const DATA_VISUALIZATION_PALETTE: ColorPalette = {
  cpu: '#2563eb',      // Blue - good contrast, accessible
  memory: '#dc2626',   // Red - but darker for better contrast
  grid: '#d1d5db',     // Gray - neutral, accessible
  background: '#ffffff', // White background
  text: '#1f2937',     // Dark gray text for high contrast
  warning: '#d97706',  // Orange/amber - accessible alternative to yellow
  critical: '#dc2626', // Dark red - meets contrast requirements
};

export const DATA_VISUALIZATION_GRADIENTS: ColorGradients = {
  cpu: ['#2563eb', '#60a5fa'],     // Blue gradient
  memory: ['#dc2626', '#f87171'], // Red gradient (dark to light)
};

/**
 * Check if a color combination meets WCAG contrast requirements
 */
export function checkContrastRatio(
  foreground: string,
  background: string,
  level: 'AA' | 'AAA' = 'AA'
): boolean {
  const ratio = chroma.contrast(foreground, background);
  const minRatio = level === 'AAA' ? 7 : 4.5;
  return ratio >= minRatio;
}

/**
 * Get accessible color variations for different contrast needs
 */
export function getAccessibleVariations(baseColor: string): {
  light: string;
  dark: string;
  accessible: string;
} {
  const color = chroma(baseColor);

  return {
    light: color.brighten(1.5).hex(),
    dark: color.darken(1.5).hex(),
    accessible: color.luminance() > 0.5 ? color.darken(1).hex() : color.brighten(1).hex(),
  };
}

/**
 * Generate colorblind-safe color palette
 */
export function generateColorblindSafePalette(): ColorPalette {
  return {
    cpu: '#2563eb',      // Blue - universally accessible
    memory: '#7c3aed',   // Purple - distinct from blue
    grid: '#9ca3af',     // Medium gray
    background: '#ffffff',
    text: '#1f2937',
    warning: '#ea580c',  // Orange
    critical: '#dc2626', // Red
  };
}

/**
 * Validate entire color palette for accessibility
 */
export function validateColorPalette(palette: ColorPalette): {
  isValid: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  // Check text contrast
  if (!checkContrastRatio(palette.text, palette.background)) {
    violations.push('Text does not meet contrast requirements');
  }

  // Check data colors against background
  if (!checkContrastRatio(palette.cpu, palette.background)) {
    violations.push('CPU color does not meet contrast requirements');
  }

  if (!checkContrastRatio(palette.memory, palette.background)) {
    violations.push('Memory color does not meet contrast requirements');
  }

  // Check warning/critical colors
  if (!checkContrastRatio(palette.warning, palette.background)) {
    violations.push('Warning color does not meet contrast requirements');
  }

  if (!checkContrastRatio(palette.critical, palette.background)) {
    violations.push('Critical color does not meet contrast requirements');
  }

  return {
    isValid: violations.length === 0,
    violations,
  };
}

/**
 * Get optimal colors for different data series
 */
export function getOptimalDataColors(count: number): string[] {
  const baseColors = [
    '#2563eb', // Blue
    '#dc2626', // Red
    '#16a34a', // Green
    '#ca8a04', // Yellow
    '#7c3aed', // Purple
    '#0891b2', // Cyan
    '#be123c', // Rose
    '#c2410c', // Orange
  ];

  if (count <= baseColors.length) {
    return baseColors.slice(0, count);
  }

  // Generate additional colors if needed
  return baseColors.concat(
    chroma.scale(['#2563eb', '#dc2626']).colors(count - baseColors.length)
  );
}
