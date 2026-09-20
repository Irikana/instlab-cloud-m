// 更新包安装 —— Web / 桌面端实现（Metro 按 .web 后缀自动选择，与 installer.ts 同签名）。
// 浏览器里没有 APK 安装语义：本份只负责把用户送到发布页手动下载，
// 并且不打包任何 Android 专属模块。
import { Linking } from 'react-native';
import type { InstallRequest } from './installer';

export type { InstallRequest };

export const CAN_IN_APP_INSTALL = false;

export async function downloadAndInstall(_req: InstallRequest): Promise<void> {
  throw new Error('浏览器环境请前往发布页下载 APK');
}

export async function openExternal(url: string): Promise<void> {
  await Linking.openURL(url);
}
