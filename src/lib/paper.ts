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

/**
 * 组装与 PC 端 Download_Paper_Work(r) 相同的日程数据。
 * 预览和直接导出必须使用同一份数据，否则服务器无法生成完整题目内容。
 */
export function buildPaperRequestData(
  entry: {
    schid: string;
    planid?: string;
    planexpid?: string;
    expid?: string;
    date: string;
    raw: Record<string, unknown>;
  },
  identity: {
    login?: string | null;
    userName?: string | null;
    univer?: string | null;
  } = {},
): Record<string, unknown> {
  const login = identity.login ?? '';
  const userName = identity.userName ?? '';
  return {
    ...entry.raw,
    schid: entry.schid,
    planid: entry.planid ?? '',
    planexpid: entry.planexpid ?? '',
    expid: entry.expid ?? '',
    sch_date: entry.date.replace(/-/g, '/'),
    userid: login,
    stdid: login,
    studentid: login,
    studentname: userName,
    name: userName,
    univer: identity.univer ?? '',
  };
}

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

const CODE128_B_PATTERNS = [
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
  '221312','231212','112232','122132','122231','113222','123122','123221','223211','222311',
  '132131','113123','113321','133121','313121','211331','231131','213113','213311','213131',
  '311123','311321','331121','312113','312311','332111','314111','221411','431111','111224',
  '111422','121124','121421','141122','141221','112214','112412','122114','122411','142112',
  '142211','241211','221114','413111','241112','134111','111242','121142','121241','114212',
  '124112','124211','411212','421112','421211','212141','214121','412121','111143','111341',
  '131141','114113','114311','411113','411311','113141','114131','311141','411131','211412',
  '211214','211232','233111','211133','211313','211331','221131','221311','231111','231311',
  '112231','122131','122311','112213','112312','132112','132311','211123','211321','231121',
  '312131','311231','331211','312112','312211','322111','322211','221412','431112','431211',
  '212412','212214','212232','212133','212313','212331','222131','222311','232111','232311',
  '112232','122132','122312','112214','112412','122114','122411','142112','142211','241211',
  '221114','413111','241112','134111','111242','121142','121241','114212','124112','124211',
  '411212','421112','421211','212141','214121','412121','111143','111341','131141','114113',
  '114311','411113','411311','113141','114131','311141','411131','211412','211214','211232',
  '233111','211133','211313','211331','221131','221311','231111','231311','112231','122131',
  '122311','112213','112312','132112','132311','211123','211321','231121','312131','311231',
  '331211','312112','312211','322111','322211','221411','431111','111224','111422','121124',
  '121421','141122','141221','112214','112412','122114','122411','142112','142211','241211',
  '221114','413111','241112','134111','111242','121142','121241','114212','124112','124211',
  '411212','421112','421211','212141','214121','412121','111143','111341','131141','114113',
  '114311','411113','411311','113141','114131','311141','411131','211412','211214','211232',
  '233111','211133','211313','211331','221131','221311','231111','231311','112231','122131',
  '122311','112213','112312','132112','132311','211123','211321','231121','312131','311231',
  '331211','312112','312211','322111','322211','2331112',
];

function code128Svg(value: string): string {
  const text = value.replace(/[^\x20-\x7e]/g, '');
  if (!text) return '';
  const codes = [104, ...Array.from(text, (c) => c.charCodeAt(0) - 32)];
  const checksum = codes.reduce((sum, code, index) => sum + code * (index || 1), 0) % 103;
  codes.push(checksum, 106);
  let x = 0;
  const rects: string[] = [];
  for (const code of codes) {
    const pattern = CODE128_B_PATTERNS[code];
    let black = true;
    for (const width of pattern.split('').map(Number)) {
      if (black) rects.push(`<rect x="${x}" y="0" width="${width}" height="34"/>`);
      x += width;
      black = !black;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x} 34" preserveAspectRatio="none">${rects.join('')}</svg>`;
}

function makePaperIdentifier(data: Record<string, unknown>): string {
  const id = String(data.id ?? data.paperid ?? data.workid ?? data.schid ?? '').replace(/\D/g, '');
  return id ? `080100000${id}` : '';
}

function buildIdentifierBars(value: string): string {
  return code128Svg(value);
}

export function buildFullHtml(
  html: string,
  data: Record<string, unknown>,
  titlelogo?: string,
): string {
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

  // ---- 日期填充：优先使用纸张 API 返回的作业日期 ----
  // sch_date 是日历中的课程安排日；它不能覆盖纸张接口返回的权威日期。
  // JSON 中的 sch_datestring 仍是服务器实际生成的纸张日期；客户端不再用日历日期覆盖它。
  const serverDate = String(data.paper_datestring ?? data.assignment_datestring ?? data.sch_datestring ?? '');
  const serverDateRaw = typeof data.paper_date === 'string'
    ? data.paper_date
    : typeof data.assignment_date === 'string'
      ? data.assignment_date
      : typeof data.sch_date === 'string'
        ? data.sch_date
        : '';
  const dateStr = serverDate || '';
  if (dateStr) {
    out = out.replace(/\d{4}年\d{1,2}月\d{1,2}日 \(星期[一二三四五六日]\)[\s\S]{0,6}?\(节\)/g, dateStr);
    out = out.replace(/\d{4}年\d{1,2}月\d{1,2}日 \(星期[一二三四五六日]\)/g, dateStr);
  } else if (serverDateRaw) {
    const d = parseDate(serverDateRaw);
    if (d) {
      const fmt = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 (星期${WEEK_CN[d.getDay()]})`;
      out = out.replace(/\d{4}年\d{1,2}月\d{1,2}日 \(星期[一二三四五六日]\)/g, fmt);
    }
  }

  // ---- 右上角作业标识：PC PDF 使用作业 id 生成页首 Code128 标识 ----
  const identifier = makePaperIdentifier(data);
  if (identifier && out.includes('<body>')) {
    const bars = buildIdentifierBars(identifier);
    const barcode = `<div class="paper-identifier" aria-label="${identifier}">
      ${bars}
      <div class="paper-identifier-text">${identifier}</div>
    </div>`;
    out = out.replace('</head>', `<style>
      .paper-identifier { position: absolute; top: 2mm; right: 15mm; width: 38mm; text-align: center; font-size: 7pt; line-height: 1; z-index: 5; }
      .paper-identifier svg { display: block; width: 38mm; height: 7mm; }
      .paper-identifier-bars { height: 7mm; white-space: nowrap; overflow: hidden; }
      .paper-identifier-text { margin-top: 1mm; letter-spacing: .2mm; }
    </style></head>`);
    out = out.replace('<body>', `<body>\n${barcode}`);
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
  const renderData = { ...schData, ...(payload.data ?? {}) };
  const fullHtml = buildFullHtml(html, renderData, payload.titlelogo);
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
