// 会话存储 —— 保存的是服务器种的 Cookie 头文本（含 session token）。
//
// 首选 SecureStore（Android 上为 EncryptedSharedPreferences）。但 SecureStore 在 Android
// 上单个值上限 2048 字节，而带 JWT 的 Cookie 头很容易超过它：写失败会让登录直接报错，
// 或者更糟——登录看着成功、下次冷启动却恢复不出会话。所以超长时退回 AsyncStorage。
// 两种存放都不写入任何 GitHub / 仓库凭据，只是本站的登录会话。
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SESSION_KEY, SESSION_STORE_KEY } from './config';

/** SecureStore 单项上限留一点余量 */
const SECURE_LIMIT = 2000;

export async function getSession(): Promise<string | null> {
  try {
    const where = await AsyncStorage.getItem(SESSION_STORE_KEY);
    if (where === 'file') return await AsyncStorage.getItem(SESSION_KEY);
    return await SecureStore.getItemAsync(SESSION_KEY);
  } catch {
    return null;
  }
}

export async function setSession(value: string): Promise<void> {
  if (value.length <= SECURE_LIMIT) {
    try {
      await SecureStore.setItemAsync(SESSION_KEY, value);
      await AsyncStorage.setItem(SESSION_STORE_KEY, 'secure');
      return;
    } catch {
      // 写安全存储失败，下面退回普通存储
    }
  }
  await AsyncStorage.setItem(SESSION_KEY, value);
  await AsyncStorage.setItem(SESSION_STORE_KEY, 'file');
}

export async function clearSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch {
    // 忽略
  }
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
    await AsyncStorage.removeItem(SESSION_STORE_KEY);
  } catch {
    // 忽略
  }
}
