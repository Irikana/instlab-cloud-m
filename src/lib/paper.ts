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
 * 把 data 字段填进 html 模板 + 嵌入 titlelogo 底版图 + 填充班级/学号/姓名/日期。
 * PC 端 C# 收到 {html, data, titlelogo} 后：
 *   1. 用 titlelogo（base64 PNG）作为作业纸底版背景（2937x893，含预印刷表格/定位标记）
 *   2. 把 data 填入 html 的 infotable（班级/学号/姓名）
 *   3. 用 sch_date 替换日期为作业布置日
 *   4. 页面加载执行 DATAMatrix 脚本生成二维码
 * 我们复刻同样的流程。
 */
const WEEK_CN = ['日', '一', '二', '三', '四', '五', '六'];

export function buildFullHtml(html: string, data: Record<string, unknown>, titlelogo?: string): string {
  let out = html;

  // ---- 顶部横幅：titlelogo 是作业纸顶部横幅（学校 logo + 「课程作业」标题），
  //      非全页背景。PC 端显示为：宽约 60.8mm × 高约 18.5mm，位于页面顶部左侧。----
  if (titlelogo && titlelogo.startsWith('iVBOR')) {
    // 在 body 开头插入 titlelogo 横幅 + 条形码占位
    const banner = `<div style="width: 100%; margin: 0; padding: 0; text-align: left;">
      <img src="data:image/png;base64,${titlelogo}"
           style="width: 60.8mm; height: 18.5mm; display: block;" />
    </div>
    <div style="height: 5mm"></div>`;
    // 在 <body> 后插入横幅（在现有第一个 div 之前）
    out = out.replace('<body>', '<body>\n' + banner);
  }

  // ---- 字体兼容 ----
  out = out.replace(
    '</head>',
    `<style>
      body, table, td, th, div, span, p {
        font-family: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'SimSun', 'Noto Serif CJK SC', serif;
      }
    </style></head>`,
  );

  // ---- 日期填充：用 sch_datestring（服务器返回的已格式化日期）----
  const dateStr = String(data.sch_datestring ?? '');
  if (dateStr) {
    out = out.replace(/\d{4}年\d{1,2}月\d{1,2}日 \(星期[一二三四五六日]\)[\s\S]{0,6}?\(节\)/g, dateStr);
    out = out.replace(/\d{4}年\d{1,2}月\d{1,2}日 \(星期[一二三四五六日]\)/g, dateStr);
  } else {
    const schDate = data.sch_date ?? data.date ?? data.coursedatetime;
    if (typeof schDate === 'string' && schDate) {
      const d = parseDate(schDate);
      if (d) {
        const fmt = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 (星期${WEEK_CN[d.getDay()]})`;
        out = out.replace(/\d{4}年\d{1,2}月\d{1,2}日 \(星期[一二三四五六日]\)/g, fmt);
      }
    }
  }

  // ---- 班级 / 学号 / 姓名：服务器返回的 html 已自带这些数据（通过 cookie/登录态），无需二次填充 ----

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
  const fullHtml = buildFullHtml(html, payload.data ?? {}, payload.titlelogo);
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

/** 生成完整响应 JSON 文件并分享（调试用：查看服务器返回的完整 data 字段，含题目数据） */
export async function generatePaperJson(
  payload: PaperPayload,
  fileName: string,
): Promise<{ uri: string; shared: boolean }> {
  if (Platform.OS === 'web') {
    throw new Error('JSON 文件生成仅支持 Android/iOS');
  }
  const json = JSON.stringify(payload, null, 2);
  const safeName = fileName.replace(/[\\/:*?"<>|]/g, '_');
  const file = new File(Paths.cache, safeName);
  file.write(json);

  let shared = false;
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: fileName,
    });
    shared = true;
  }
  return { uri: file.uri, shared };
}

/** 便捷入口：调 API → 下载完整响应 JSON（调试用） */
export async function downloadPaperJson(
  kind: PaperKind,
  schData: Record<string, unknown>,
  fileName: string,
): Promise<{ uri: string; shared: boolean }> {
  const payload = await fetchPaper(kind, schData);
  return generatePaperJson(payload, fileName);
}
