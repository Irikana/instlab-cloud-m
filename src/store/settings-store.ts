// 全局设置（主题模式、开发者模式）持久化
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ThemeMode } from '../theme';

const THEME_KEY = 'instab-cloud-theme';
const DEV_KEY = 'instab-cloud-devmode';

interface SettingsState {
  themeMode: ThemeMode;
  /** 开发者模式：显示实验ID 入口、服务器 HTML/JSON 导出与调试信息 */
  devMode: boolean;
  init: () => Promise<void>;
  setThemeMode: (m: ThemeMode) => Promise<void>;
  setDevMode: (v: boolean) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  themeMode: 'cloud',
  devMode: false,
  init: async () => {
    try {
      const v = await AsyncStorage.getItem(THEME_KEY);
      if (v === 'light' || v === 'dark' || v === 'quasar' || v === 'cloud' || v === 'cloud-dark' || v === 'system') {
        set({ themeMode: v });
      }
      const d = await AsyncStorage.getItem(DEV_KEY);
      if (d === '1') set({ devMode: true });
    } catch {
      // 读取失败保持默认
    }
  },
  setThemeMode: async (m: ThemeMode) => {
    set({ themeMode: m });
    try {
      await AsyncStorage.setItem(THEME_KEY, m);
    } catch {
      // 持久化失败不阻塞
    }
  },
  setDevMode: async (v: boolean) => {
    set({ devMode: v });
    try {
      await AsyncStorage.setItem(DEV_KEY, v ? '1' : '0');
    } catch {
      // 持久化失败不阻塞
    }
  },
}));