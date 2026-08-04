// 全局设置（主题模式等）持久化
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ThemeMode } from '../theme';

const THEME_KEY = 'instab-cloud-theme';

interface SettingsState {
  themeMode: ThemeMode;
  init: () => Promise<void>;
  setThemeMode: (m: ThemeMode) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  themeMode: 'cloud',
  init: async () => {
    try {
      const v = await AsyncStorage.getItem(THEME_KEY);
      if (v === 'light' || v === 'dark' || v === 'cloud' || v === 'cloud-dark' || v === 'system') {
        set({ themeMode: v });
      }
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
}));