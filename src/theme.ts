// 主题系统：浅色 / 深色 / "cloud" (Cloud Lite 风格浅主题) / "cloud-dark"
// 所有组件通过 useTheme() 获取当前色板
import { useColorScheme } from 'react-native';
import { useSettingsStore } from './store/settings-store';

export type ThemeMode = 'light' | 'dark' | 'cloud' | 'cloud-dark' | 'system';

export interface Palette {
  accent: string;
  accentLight: string;
  bg: string;
  bgSubtle: string;
  bgMuted: string;
  border: string;
  borderDark: string;
  text: string;
  textSecondary: string;
  textLight: string;
  danger: string;
  success: string;
  warning: string;
  infoBg: string;
  dangerBg: string;
  successBg: string;
}

// ========== SlyWrite 风格 (浅色) ==========
export const LIGHT_PALETTE: Palette = {
  accent: '#2c3e50',
  accentLight: '#5d9ccc',
  bg: '#ffffff',
  bgSubtle: '#fafafa',
  bgMuted: '#f5f5f5',
  border: '#e0e0e0',
  borderDark: '#cccccc',
  text: '#1a1a1a',
  textSecondary: '#555555',
  textLight: '#888888',
  danger: '#c0392b',
  success: '#27ae60',
  warning: '#b8860b',
  infoBg: '#f0f7fd',
  dangerBg: '#fdf2f2',
  successBg: '#f0faf3',
};

// ========== SlyWrite 风格 (深色) ==========
export const DARK_PALETTE: Palette = {
  accent: '#5d9ccc',
  accentLight: '#7fb3e0',
  bg: '#1c1f24',
  bgSubtle: '#16181c',
  bgMuted: '#21252b',
  border: '#2e333a',
  borderDark: '#3a4048',
  text: '#e8eaed',
  textSecondary: '#b0b6bf',
  textLight: '#7d8590',
  danger: '#e57373',
  success: '#58c98c',
  warning: '#d4a94f',
  infoBg: '#1d2a38',
  dangerBg: '#33211f',
  successBg: '#1c2f22',
};

// ========== INSTLAB CLOUD Lite 风格 (浅色 — 从天蓝/白为主) ==========
export const CLOUD_LIGHT_PALETTE: Palette = {
  accent: '#1976D2',      // Quasar primary blue (Material Design)
  accentLight: '#42A5F5',
  bg: '#ffffff',
  bgSubtle: '#f5f8fc',
  bgMuted: '#eef2f7',
  border: '#d0d7de',
  borderDark: '#b0b8c1',
  text: '#1a2332',
  textSecondary: '#57606a',
  textLight: '#8b949e',
  danger: '#d73a49',
  success: '#2da44e',
  warning: '#d4920b',
  infoBg: '#ddf4ff',
  dangerBg: '#ffebe9',
  successBg: '#dafbe1',
};

// ========== INSTLAB CLOUD Lite 风格 (深色) ==========
export const CLOUD_DARK_PALETTE: Palette = {
  accent: '#58a6ff',
  accentLight: '#79c0ff',
  bg: '#0d1117',
  bgSubtle: '#161b22',
  bgMuted: '#21262d',
  border: '#30363d',
  borderDark: '#484f58',
  text: '#e6edf3',
  textSecondary: '#8b949e',
  textLight: '#6e7681',
  danger: '#f85149',
  success: '#3fb950',
  warning: '#d29922',
  infoBg: '#0c2d6b',
  dangerBg: '#290a0a',
  successBg: '#0b2e1a',
};

const THEME_MAP: Record<string, Palette> = {
  light: LIGHT_PALETTE,
  dark: DARK_PALETTE,
  cloud: CLOUD_LIGHT_PALETTE,
  'cloud-dark': CLOUD_DARK_PALETTE,
};

export function useTheme(): { isDark: boolean; colors: Palette } {
  const mode = useSettingsStore((s) => s.themeMode);
  const system = useColorScheme();

  let effective: ThemeMode;
  if (mode === 'system') {
    effective = system === 'dark' ? 'dark' : 'light';
  } else {
    effective = mode;
  }

  const isDark = effective === 'dark' || effective === 'cloud-dark';
  const palette = THEME_MAP[effective] || LIGHT_PALETTE;
  return { isDark, colors: palette };
}

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const FONT = {
  size: 15,
  lineHeight: 22,
  mono: 'monospace',
} as const;

export const THEME_OPTIONS: { key: ThemeMode; label: string; desc: string }[] = [
  { key: 'system', label: '跟随系统', desc: '随系统外观自动切换' },
  { key: 'light', label: '浅色', desc: 'SlyWrite 风格浅色主题' },
  { key: 'dark', label: '深色', desc: 'SlyWrite 风格深色主题' },
  { key: 'cloud', label: 'Cloud Lite', desc: 'INSTLAB CLOUD 风格浅色主题' },
  { key: 'cloud-dark', label: 'Cloud Lite 深色', desc: 'INSTLAB CLOUD 风格深色主题' },
];