// 作业纸 PDF 下载 — 与 PC 端 `PaperPDF_Work` 消息对应的手机端实现
// 1. POST /api/paper/work     {type:8}    → {html, data, h2pargs, titlelogo}
// 2. POST /api/paper/workcorr {type:82}   → 同上（批改后作业纸）
// 3. 本地渲染 HTML → expo-print 生成 PDF → expo-sharing 分享/保存
import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { post } from './api';

export interface PaperPayload {
  filetypeid?: string;
  filetype?: string;
  data?: Record<string, unknown>;
  html?: string;
  h2pargs?: unknown;
  titlelogo?: string;
}

export type PaperKind = 'work' | 'workcorr';

/** 调用作业纸 API */
export async function fetchPaper(kind: PaperKind, schData: Record<string, unknown>): Promise<PaperPayload> {
  const type = kind === 'work' ? 8 : 82;
  const path = kind === 'work' ? '/api/paper/work' : '/api/paper/workcorr';
  return post<PaperPayload>(path, { type, data: schData });
}

/**
 * 把 data 字段填进 html 模板。
 * PC 端 C# 收到后会把 html + data 拼成完整 HTML；这里做通用占位符替换：
 *   {{key}} / {key} → 值。若 html 本身已是完整 HTML（无占位符），原样返回。
 */
export function buildFullHtml(html: string, data: Record<string, unknown>): string {
  let out = html;
  for (const [k, v] of Object.entries(data ?? {})) {
    const val = typeof v === 'string' ? v : v == null ? '' : JSON.stringify(v);
    out = out.split('{{' + k + '}}').join(val).split('{' + k + '}').join(val);
  }
  return out;
}

/** 生成 PDF 并分享；返回 PDF 文件 uri（web 平台不可用） */
export async function generatePaperPdf(
  html: string,
  fileName: string,
): Promise<{ uri: string; shared: boolean }> {
  if (Platform.OS === 'web') {
    throw new Error('PDF 生成仅支持 Android/iOS，Web 端请使用 PC 客户端');
  }

  const { uri } = await Print.printToFileAsync({ html });

  let shared = false;
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: fileName,
      UTI: 'com.adobe.pdf',
    });
    shared = true;
  }
  return { uri, shared };
}

/** 便捷入口：调 API → 渲染 → 生成 PDF → 分享 */
export async function downloadPaperPdf(
  kind: PaperKind,
  schData: Record<string, unknown>,
  fileName: string,
): Promise<{ uri: string; shared: boolean }> {
  const payload = await fetchPaper(kind, schData);
  const html = payload.html ?? '';
  if (!html) {
    throw new Error('服务器未返回 HTML 模板，无法生成 PDF');
  }
  const fullHtml = buildFullHtml(html, payload.data ?? {});
  return generatePaperPdf(fullHtml, fileName);
}
