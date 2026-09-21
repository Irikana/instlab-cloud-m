// 把一段文本落成文件并交给系统分享面板 —— 开发者模式的导出入口共用。
// 手机端没有对外写文件的权限模型，一律先写应用缓存再由用户选择去向。
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const safeName = (n: string) => n.replace(/[\\/:*?"<>|]/g, '_');

export async function shareText(content: string, fileName: string, mimeType: string) {
  const file = new File(Paths.cache, safeName(fileName));
  file.write(content);
  let shared = false;
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: fileName });
    shared = true;
  }
  return { uri: file.uri, shared };
}

export function shareJson(data: unknown, fileName: string) {
  return shareText(JSON.stringify(data, null, 2), fileName, 'application/json');
}
