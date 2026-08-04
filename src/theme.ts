// 主题系统：浅色 / 深色 / Quasar / Cloud Lite / Cloud Lite 深色
// 所有组件通过 useTheme() 获取当前色板
import { useColorScheme } from 'react-native';
import { useSettingsStore } from './store/settings-store';

export type ThemeMode = 'light' | 'dark' | 'quasar' | 'cloud' | 'cloud-dark' | 'system';

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

// ========== Quasar 风格 (Material Design 蓝) — 原 cloud 主题 ==========
export const QUASAR_PALETTE: Palette = {
  accent: '#1976D2',
  accentLight: '#42A5F5',
  bg: '#ffffff',
  bgSubtle: '#f5f5f5',
  bgMuted: '#e0e0e0',
  border: '#c8c8c8',
  borderDark: '#aaaaaa',
  text: '#1a1a1a',
  textSecondary: '#555555',
  textLight: '#8b8b8b',
  danger: '#c62828',
  success: '#2e7d32',
  warning: '#ef6c00',
  infoBg: '#e3f2fd',
  dangerBg: '#ffebee',
  successBg: '#e8f5e9',
};

// ========== INSTLAB CLOUD Lite 真实配色 (浅色 — #00695C 深青绿) ==========
export const CLOUD_LIGHT_PALETTE: Palette = {
  accent: '#00695C',      // 主色：顶部/图标/按钮/边框/标题栏
  accentLight: '#4DB6AC', // 浅青绿
  bg: '#ffffff',
  bgSubtle: '#f5f5f5',
  bgMuted: '#e0e0e0',
  border: '#c8c8c8',
  borderDark: '#aaaaaa',
  text: '#1a1a1a',
  textSecondary: '#555555',
  textLight: '#8b8b8b',
  danger: '#c62828',
  success: '#2e7d32',
  warning: '#ef6c00',
  infoBg: '#e8f5e9',
  dangerBg: '#ffebee',
  successBg: '#e0f2f1',
};

// ========== INSTLAB CLOUD Lite 风格 (深色 — 深青绿) ==========
export const CLOUD_DARK_PALETTE: Palette = {
  accent: '#4DB6AC',
  accentLight: '#80CBC4',
  bg: '#121212',
  bgSubtle: '#1e1e1e',
  bgMuted: '#2c2c2c',
  border: '#383838',
  borderDark: '#484848',
  text: '#e0e0e0',
  textSecondary: '#a0a0a0',
  textLight: '#707070',
  danger: '#ef5350',
  success: '#66bb6a',
  warning: '#ffa726',
  infoBg: '#1b3a2e',
  dangerBg: '#2e1b1b',
  successBg: '#1b2e22',
};

const THEME_MAP: Record<string, Palette> = {
  light: LIGHT_PALETTE,
  dark: DARK_PALETTE,
  quasar: QUASAR_PALETTE,
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

// ========== 日历事件色（PC 端 Cloud Lite 规则，经用户取色确认）==========
export const CALENDAR_COLORS = {
  experiment: '#F6AB6D', // 标注实验/值日（用户采样色，略深）
  homework: '#2196F3',   // 标注课程作业（蓝色）
  theory: '#2196F3',     // 理论课
  all: '#9C27B0',        // 都有
  duty: '#F6AB6D',       // 值日
} as const;

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
  { key: 'quasar', label: 'Quasar', desc: 'Material Design 蓝色风格' },
  { key: 'cloud', label: 'Cloud Lite', desc: 'INSTLAB CLOUD 风格 (#00695C)' },
  { key: 'cloud-dark', label: 'Cloud Lite 深色', desc: 'INSTLAB CLOUD 深色风格' },
];
