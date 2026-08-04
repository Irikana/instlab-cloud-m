// 作业纸 PDF 下载 — 与 PC 端 `PaperPDF_Work` 消息对应的手机端实现
// 1. POST /api/paper/work     {type:8}    → {html, data, h2pargs, titlelogo}
// 2. POST /api/paper/workcorr {type:82}   → 同上（批改后作业纸）
// 3. 本地渲染 HTML → expo-print 生成 PDF → expo-sharing 分享/保存
//    也可直接下载原始 HTML 文件（排错用）
import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
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
 * 同时针对服务器模板的已知结构做二次填充：
 *   - 日期：服务器模板里是「下载当天」，PC 端会替换为实验安排日（sch_date）
 *   - 班级/学号/姓名：服务器模板里是空 <td>，PC 端用当前用户信息填充
 */
const WEEK_CN = ['日', '一', '二', '三', '四', '五', '六'];

export function buildFullHtml(html: string, data: Record<string, unknown>): string {
  let out = html;
  for (const [k, v] of Object.entries(data ?? {})) {
    const val = typeof v === 'string' ? v : v == null ? '' : JSON.stringify(v);
    out = out.split('{{' + k + '}}').join(val).split('{' + k + '}').join(val);
  }

  // ---- 字体兼容：模板用 Noto Serif SC，Android WebView 可能没有 → 注入 fallback 字体栈 ----
  out = out.replace(
    /(<\/head>)/i,
    `<style>
      body, table, td, th, div, span, p {
        font-family: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'SimSun', 'Noto Serif CJK SC', serif;
      }
    </style>$1`,
  );

  // ---- 二次填充：日期 ----
  const schDate = data.sch_date ?? data.date ?? data.coursedatetime;
  if (typeof schDate === 'string' && schDate) {
    const d = parseDate(schDate);
    if (d) {
      const fmt = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 (星期${WEEK_CN[d.getDay()]})`;
      // 替换模板里的「下载当天日期」格式（如 2026年8月4日 (星期二)）
      out = out.replace(/\d{4}年\d{1,2}月\d{1,2}日 \(星期[一二三四五六日]\)/g, fmt);
    }
  }

  // ---- 二次填充：班级 / 学号 / 姓名（空 <td> 填入当前用户信息）----
  const stdid = String(data.stdid ?? data.userid ?? data.studentid ?? '');
  const name = String(data.name ?? data.studentname ?? '');
  const klass = String(data.classname ?? data.class_name ?? '');
  if (stdid || name || klass) {
    // 按标签定位：学号：/ 姓名：/ 班级： 后面的空 td
    out = fillAfterLabel(out, '学号', stdid);
    out = fillAfterLabel(out, '姓名', name);
    out = fillAfterLabel(out, '班级', klass);
  }

  return out;
}

/** 解析常见日期格式为 Date（YYYY/MM/DD、YYYY-MM-DD、时间戳） */
function parseDate(input: string): Date | null {
  const m = input.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

/** 找到标签（如「学号：」）后的空 <td>...</td>，填入值 */
function fillAfterLabel(html: string, label: string, value: string): string {
  if (!value) return html;
  // 模板结构：<td class="text-bold" ...>学&nbsp;&nbsp;号：</td>\n<td>\n...\n</td>
  // 先对每个标签字符做正则转义，再在字符间插入「允许 &nbsp; 或空白」的间隔
  const escChar = (c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const spaced = label.split('').map(escChar).join('(?:&nbsp;|\\s)*');
  const re = new RegExp(`(${spaced}(?:&nbsp;|\\s)*[：:])<\\/td>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>`);
  return html.replace(re, (_all, labelPart: string, _space: string) =>
    `${labelPart}</td><td>${value}</td>`,
  );
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

/** 生成原始 HTML 文件并分享（排错用：查看服务器返回的未渲染 HTML） */
export async function generatePaperHtml(
  html: string,
  fileName: string,
): Promise<{ uri: string; shared: boolean }> {
  if (Platform.OS === 'web') {
    throw new Error('HTML 文件生成仅支持 Android/iOS');
  }
  const safeName = fileName.replace(/[\\/:*?"<>|]/g, '_');
  const file = new File(Paths.cache, safeName);
  file.write(html);

  let shared = false;
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'text/html',
      dialogTitle: fileName,
    });
    shared = true;
  }
  return { uri: file.uri, shared };
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

/** 便捷入口：调 API → 下载原始 HTML 文件（排错用） */
export async function downloadPaperHtml(
  kind: PaperKind,
  schData: Record<string, unknown>,
  fileName: string,
): Promise<{ uri: string; shared: boolean }> {
  const payload = await fetchPaper(kind, schData);
  const html = payload.html ?? '';
  if (!html) {
    throw new Error('服务器未返回 HTML 模板');
  }
  return generatePaperHtml(html, fileName);
}
