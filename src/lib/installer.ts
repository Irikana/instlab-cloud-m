// 应用更新包的安装 —— 原生端实现（Android）：应用内下载 APK 并唤起系统安装界面。
// Web 端见 installer.web.ts（同名同签名，Metro 按 .web 后缀选择）：
//   浏览器里没有 APK 安装语义，那一份只暴露 CAN_IN_APP_INSTALL=false，
//   更新页据此把按钮换成「打开发布页下载」。
// 本模块是 expo-file-system / expo-intent-launcher 在界面层的唯一入口，
// 目的是让 Web 产物完全不打包这两个 Android 专属模块。
import { Alert, Linking, Platform } from 'react-native';
import { Directory, File, Paths, getContentUriAsync } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import { APK_ASSET, LATEST_APK_URL } from './releases';

/** 与 app.json 的 android.package 一致，用于跳转「安装未知应用」授权设置页 */
const ANDROID_PACKAGE = 'io.github.instlab.cloudm';

export const CAN_IN_APP_INSTALL = Platform.OS === 'android';

export interface InstallRequest {
  /** 发布页地址（失败兜底：交给浏览器） */
  htmlUrl: string;
  /** 指定版本的附件下载地址；为空则走 LATEST_APK_URL */
  assetUrl?: string;
  /** 版本号（去掉 v 前缀），用于缓存文件名 */
  tag: string;
  /** 进度回调：0-100；101 表示已下载但拿不到总大小（不确定态） */
  onProgress: (percent: number) => void;
}

/** 唤起系统安装界面；未获授权时给出可操作的兜底入口 */
async function launchInstaller(contentUri: string, htmlUrl: string): Promise<boolean> {
  try {
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      type: 'application/vnd.android.package-archive',
      flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
    });
    return true;
  } catch {
    Alert.alert('需要安装权限', '系统尚未允许本应用安装应用。请开启「安装未知应用」权限后重试。', [
      { text: '取消', style: 'cancel' },
      {
        text: '去开启',
        onPress: () => {
          IntentLauncher.startActivityAsync('android.settings.MANAGE_UNKNOWN_APP_SOURCES', {
            data: `package:${ANDROID_PACKAGE}`,
          }).catch(() => {
            Linking.openURL(htmlUrl).catch(() => {});
          });
        },
      },
      {
        text: '浏览器下载',
        onPress: () => {
          Linking.openURL(htmlUrl).catch(() => {});
        },
      },
    ]);
    return false;
  }
}

function apkName(tag: string): string {
  return APK_ASSET.replace('.apk', '') + '-' + tag + '.apk';
}

/** 清掉其他版本留在缓存里的安装包 */
function pruneOldApks(keep: string): void {
  try {
    const dir = new Directory(Paths.cache);
    for (const item of dir.list()) {
      if (item instanceof File && item.name.startsWith('app-release-') && item.name.endsWith('.apk') && item.name !== keep) {
        try {
          item.delete();
        } catch {
          // 单个删不掉不影响下载
        }
      }
    }
  } catch {
    // 缓存目录读不到就不清理
  }
}

/**
 * 下载 APK 并唤起安装。失败时抛出中文 Error，由更新页决定兜底提示。
 * 同版本文件已在缓存中则跳过下载直接进安装。
 */
export async function downloadAndInstall(req: InstallRequest): Promise<void> {
  if (!CAN_IN_APP_INSTALL) throw new Error('当前平台不支持应用内安装');

  const name = apkName(req.tag);
  const target = new File(Paths.cache, name);
  if (target.exists && target.size !== null && target.size > 1024 * 1024) {
    const launched = await launchInstaller(await getContentUriAsync(target.uri), req.htmlUrl);
    if (!launched) throw new Error('安装界面未能唤起');
    return;
  }
  // 上次中断留下的半截文件会让下载直接落到旧内容上，先删掉
  if (target.exists) {
    try {
      target.delete();
    } catch {
      // 忽略
    }
  }
  pruneOldApks(name);

  const officialUrl = req.assetUrl || LATEST_APK_URL;
  // 国内网络下走加速镜像，失败再回退官方地址
  const mirrorUrl = officialUrl.startsWith('https://github.com/') ? `https://gh-proxy.com/${officialUrl}` : null;

  const downloadFrom = (url: string) =>
    new Promise<File | null>((resolve, reject) => {
      const task = File.createDownloadTask(url, target, {
        onProgress: (p) => {
          if (p.totalBytes > 0) req.onProgress(Math.round((p.bytesWritten / p.totalBytes) * 100));
          else if (p.bytesWritten > 0) req.onProgress(101);
        },
      });
      task.downloadAsync().then((f) => resolve(f ?? target)).catch(reject);
    });

  let result: File | null = null;
  if (mirrorUrl) {
    try {
      result = await downloadFrom(mirrorUrl);
    } catch {
      result = null;
    }
  }
  if (!result) result = await downloadFrom(officialUrl);
  if (!result || !result.exists) throw new Error('下载失败，请检查网络后重试');

  const launched = await launchInstaller(await getContentUriAsync(result.uri), req.htmlUrl);
  if (!launched) throw new Error('安装界面未能唤起');
}

/** 用系统默认方式打开外部链接（浏览器） */
export async function openExternal(url: string): Promise<void> {
  await Linking.openURL(url);
}
