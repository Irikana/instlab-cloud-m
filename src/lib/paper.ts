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

export function buildPaperRequestData(
  entry: { schid: string; planid?: string; planexpid?: string; expid?: string; date: string; raw: Record<string, unknown> },
  identity: { login?: string | null; userName?: string | null; univer?: string | null } = {},
): Record<string, unknown> {
  const login = identity.login ?? '';
  const name = identity.userName ?? '';
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
    studentname: name,
    name,
    univer: identity.univer ?? '',
  };
}

export async function fetchPaper(kind: PaperKind, schData: Record<string, unknown>): Promise<PaperPayload> {
  const type = kind === 'work' ? 8 : 82;
  const path = kind === 'work' ? '/api/paper/work' : '/api/paper/workcorr';
  return post<PaperPayload>(path, { type, data: schData });
}

const WEEK_CN = ['日', '一', '二', '三', '四', '五', '六'];

export function buildFullHtml(html: string, data: Record<string, unknown>, titlelogo?: string): string {
  let out = html;
  if (titlelogo) {
    const image = titlelogo.startsWith('data:') ? titlelogo : `data:image/png;base64,${titlelogo}`;
    const banner = `<div style="width:100%;margin:0;padding:0;text-align:left"><img src="${image}" style="width:60.8mm;height:18.5mm;display:block" /></div><div style="height:5mm"></div>`;
    out = out.replace('<body>', `<body>\n${banner}`);
  }
  out = out.replace('</head>', `<style>
    @page { size: A4; margin: 0; }
    html, body { width: 210mm; min-height: 297mm; margin: 0; padding: 0; }
    body, table, td, th, div, span, p { font-family: 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'SimSun', serif; }
  </style></head>`);

  const dateText = String(data.paper_datestring ?? data.assignment_datestring ?? data.sch_datestring ?? '');
  const rawDate = typeof data.paper_date === 'string' ? data.paper_date
    : typeof data.assignment_date === 'string' ? data.assignment_date
      : typeof data.sch_date === 'string' ? data.sch_date : '';
  if (dateText) {
    out = out.replace(/\d{4}年\d{1,2}月\d{1,2}日 \(星期[一二三四五六日]\)/g, dateText);
    out = out.replace(/\d{4}年\d{1,2}月\d{1,2}日 \(星期[一二三四五六日]\)/g, dateText);
  } else if (rawDate) {
    const d = parseDate(rawDate);
    if (d) {
      const formatted = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 (星期${WEEK_CN[d.getDay()]})`;
      out = out.replace(/\d{4}年\d{1,2}月\d{1,2}日 \(星期[一二三四五六日]\)/g, formatted);
    }
  }
  return out;
}

function parseDate(input: string): Date | null {
  const match = input.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (match) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(input);
  return isNaN(date.getTime()) ? null : date;
}

// ========== 作业纸身份条码（与 PC 端 iText Code128 内容一致） ==========
// PC 端 PDF 每页顶部条码已实际解码验证，内容 = 08 + 两位页码 + 作业ID补零到9位：
//   作业 data.id=7717 → 第1页 0801000007717，第2页 0802000007717
// 08 是 filetypeid（课程作业纸）；作业ID是服务器返回的 data.id（不是 schid/planid）。
export function paperBarcodeValue(paperId: string | number, page: number): string {
  const id = String(paperId ?? '').replace(/\D/g, '');
  if (!id) return '';
  return `08${String(page).padStart(2, '0')}${id.padStart(9, '0')}`;
}

// Code128 标准二进制条空表（ISO/IEC 15417，共 107 项：0-99 数据值，
// 100=CodeB 切换、101=CodeA、102=FNC1、103-105=Start A/B/C、106=Stop）。
// 1=黑条 0=白空，每个符号 11 模块（Stop 为 13 模块）。与 jsbarcode 一致。
const CODE128_BITS = [
  11011001100, 11001101100, 11001100110, 10010011000, 10010001100, 10001001100, 10011001000, 10011000100, 10001100100, 11001001000,
  11001000100, 11000100100, 10110011100, 10011011100, 10011001110, 10111001100, 10011101100, 10011100110, 11001110010, 11001011100,
  11001001110, 11011100100, 11001110100, 11101101110, 11101001100, 11100101100, 11100100110, 11101100100, 11100110100, 11100110010,
  11011011000, 11011000110, 11000110110, 10100011000, 10001011000, 10001000110, 10110001000, 10001101000, 10001100010, 11010001000,
  11000101000, 11000100010, 10110111000, 10110001110, 10001101110, 10111011000, 10111000110, 10001110110, 11101110110, 11010001110,
  11000101110, 11011101000, 11011100010, 11011101110, 11101011000, 11101000110, 11100010110, 11101101000, 11101100010, 11100011010,
  11101111010, 11001000010, 11110001010, 10100110000, 10100001100, 10010110000, 10010000110, 10000101100, 10000100110, 10110010000,
  10110000100, 10011010000, 10011000010, 10000110100, 10000110010, 11000010010, 11001010000, 11110111010, 11000010100, 10001111010,
  10100111100, 10010111100, 10010011110, 10111100100, 10011110100, 10011110010, 11110100100, 11110010100, 11110010010, 11011011110,
  11011110110, 11110110110, 10101111000, 10100011110, 10001011110, 10111101000, 10111100010, 11110101000, 11110100010, 10111011110,
  10111101110, 11101011110, 11110101110, 11010000100, 11010010000, 11010011100, 1100011101011,
];

/** Code128-C 编码为码值序列（两位数字一组，末位奇数时切 CodeB，含校验码与 Stop） */
export function code128cCodes(value: string): number[] {
  const text = String(value ?? '').replace(/[^\x20-\x7e]/g, '');
  if (!text) return [];
  const codes: number[] = [105]; // Start C
  let i = 0;
  while (i < text.length) {
    if (text.length - i >= 2) {
      codes.push(parseInt(text.substr(i, 2), 10));
      i += 2;
    } else {
      codes.push(100); // 切 CodeB
      codes.push(text.charCodeAt(i) - 32);
      i += 1;
    }
  }
  let sum = codes[0];
  for (let j = 1; j < codes.length; j++) sum += codes[j] * j;
  codes.push(sum % 103);
  codes.push(106); // Stop
  return codes;
}

/** 把码值序列渲染为 SVG 竖条（条宽单位 = 1px 模块，可随容器缩放） */
export function code128cSvg(value: string, barHeight = 34): string {
  const codes = code128cCodes(value);
  if (!codes.length) return '';
  let x = 0;
  const rects: string[] = [];
  for (const code of codes) {
    const bits = String(CODE128_BITS[code] ?? '');
    for (const ch of bits) {
      if (ch === '1') rects.push(`<rect x="${x}" y="0" width="1" height="${barHeight}"/>`);
      x += 1;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x} ${barHeight}" preserveAspectRatio="none">${rects.join('')}</svg>`;
}

/** 页面顶部身份条码 HTML（条码 + 下方数字文本） */
export function paperBarcodeHtml(paperId: string | number, page: number): string {
  const value = paperBarcodeValue(paperId, page);
  if (!value) return '';
  return (
    `<div class="paper-barcode" style="position:absolute;top:15mm;right:15mm;width:65mm;text-align:center;z-index:5;">` +
    code128cSvg(value, 34) +
    `<div style="font-size:7pt;letter-spacing:0.4mm;margin-top:1mm;font-family:monospace;">${value}</div>` +
    `</div>`
  );
}

/**
 * 生成预览 WebView 的“测量分页 + 逐页条码”脚本。
 * 在 A4 宽度布局下测量服务器 HTML 顶层块高度，按 PC 版心（上 30mm / 下 20mm /
 * 左右 15mm，内容高 247mm）贪婪分页；每页包进 .paper-page 容器，并在每页右上角
 * 插入与 PC 端内容一致的 Code128 身份条码（08 + 页码 + 作业ID）。
 * 完成后通过 postMessage 把最终 HTML 发回 React Native 侧。
 */
export function buildPaginateScript(paperId: string | number): string {
  const id = String(paperId ?? '').replace(/\D/g, '');
  return `
(function () {
  try {
    var paperId = '${id}';
    var BITS = [11011001100,11001101100,11001100110,10010011000,10010001100,10001001100,10011001000,10011000100,10001100100,11001001000,11001000100,11000100100,10110011100,10011011100,10011001110,10111001100,10011101100,10011100110,11001110010,11001011100,11001001110,11011100100,11001110100,11101101110,11101001100,11100101100,11100100110,11101100100,11100110100,11100110010,11011011000,11011000110,11000110110,10100011000,10001011000,10001000110,10110001000,10001101000,10001100010,11010001000,11000101000,11000100010,10110111000,10110001110,10001101110,10111011000,10111000110,10001110110,11101110110,11010001110,11000101110,11011101000,11011100010,11011101110,11101011000,11101000110,11100010110,11101101000,11101100010,11100011010,11101111010,11001000010,11110001010,10100110000,10100001100,10010110000,10010000110,10000101100,10000100110,10110010000,10110000100,10011010000,10011000010,10000110100,10000110010,11000010010,11001010000,11110111010,11000010100,10001111010,10100111100,10010111100,10010011110,10111100100,10011110100,10011110010,11110100100,11110010100,11110010010,11011011110,11011110110,11110110110,10101111000,10100011110,10001011110,10111101000,10111100010,11110101000,11110100010,10111011110,10111101110,11101011110,11110101110,11010000100,11010010000,11010011100,1100011101011];

    function pad2(n) { return n < 10 ? '0' + n : '' + n; }
    function pad9(s) { s = String(s); while (s.length < 9) s = '0' + s; return s; }
    function code128c(value) {
      var codes = [105];
      for (var i = 0; i < value.length;) {
        if (value.length - i >= 2) { codes.push(parseInt(value.substr(i, 2), 10)); i += 2; }
        else { codes.push(100); codes.push(value.charCodeAt(i) - 32); i += 1; }
      }
      var sum = codes[0];
      for (var j = 1; j < codes.length; j++) sum += codes[j] * j;
      codes.push(sum % 103);
      codes.push(106);
      var x = 0, rects = [];
      for (var m = 0; m < codes.length; m++) {
        var bits = String(BITS[codes[m]] || '');
        for (var q = 0; q < bits.length; q++) {
          if (bits.charAt(q) === '1') rects.push('<rect x="' + x + '" y="0" width="1" height="34"/>');
          x += 1;
        }
      }
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + x + ' 34" preserveAspectRatio="none">' + rects.join('') + '</svg>';
    }

    setTimeout(function () {
      var body = document.body;
      body.style.cssText = 'width:210mm;margin:0;padding:30mm 15mm 20mm;box-sizing:border-box;';
      body.style.transform = 'none';

      var blocks = [];
      for (var ci = 0; ci < body.children.length; ci++) {
        var el = body.children[ci];
        var tag = el.tagName.toLowerCase();
        if (tag === 'script' || tag === 'style' || tag === 'link') continue;
        var r = el.getBoundingClientRect();
        if (!r || r.height < 0.5) continue;
        blocks.push({ el: el, h: r.height });
      }

      var pageH = 933.5; // 247mm @96dpi ≈ 933.5px（PC 端 -T30 -B20 版心高）
      var pages = [[]], cur = 0;
      for (var bi = 0; bi < blocks.length; bi++) {
        var h = blocks[bi].h;
        var used = 0;
        for (var si = 0; si < pages[cur].length; si++) used += pages[cur][si].h;
        if (pages[cur].length > 0 && used + h > pageH) { pages.push([]); cur++; }
        pages[cur].push(blocks[bi]);
      }

      var headHtml = document.head ? document.head.outerHTML : '';
      var out = '<!DOCTYPE html><html><head>' + headHtml + '</head><body>';
      for (var pi = 0; pi < pages.length; pi++) {
        var bv = '08' + pad2(pi + 1) + pad9(paperId);
        var bc = code128c(bv);
        var isLast = pi === pages.length - 1;
        out += '<div class="paper-page" style="width:210mm;height:297mm;position:relative;margin:0;padding:0;box-sizing:border-box;' + (isLast ? '' : 'page-break-after:always;') + '">';
        out += '<div style="padding:30mm 15mm 20mm;box-sizing:border-box;width:100%;">';
        for (var pj = 0; pj < pages[pi].length; pj++) out += pages[pi][pj].el.outerHTML;
        out += '</div>';
        out += '<div class="paper-barcode" style="position:absolute;top:15mm;right:15mm;width:65mm;text-align:center;z-index:5;">' + bc + '<div style="font-size:7pt;letter-spacing:0.4mm;margin-top:1mm;font-family:monospace;">' + bv + '</div></div>';
        out += '</div>';
      }
      out += '</body></html>';

      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) window.ReactNativeWebView.postMessage(out);
      else if (window.parent && window.parent.postMessage) window.parent.postMessage(out, '*');
    }, 250);
  } catch (e) {
    var err = '__PAGINATE_ERROR__' + String(e && e.message || e);
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) window.ReactNativeWebView.postMessage(err);
  }
})();
true;
`;
}

export async function generatePaperPdf(html: string, fileName: string): Promise<{ uri: string; shared: boolean }> {
  if (Platform.OS === 'web') throw new Error('PDF generation requires Android/iOS');
  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
  let shared = false;
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: fileName, UTI: 'com.adobe.pdf' });
    shared = true;
  }
  return { uri, shared };
}

export async function generatePaperHtml(html: string, fileName: string): Promise<{ uri: string; shared: boolean }> {
  if (Platform.OS === 'web') throw new Error('HTML export requires Android/iOS');
  const file = new File(Paths.cache, fileName.replace(/[\\/:*?"<>|]/g, '_'));
  file.write(html);
  let shared = false;
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'text/html', dialogTitle: fileName });
    shared = true;
  }
  return { uri: file.uri, shared };
}

export async function downloadPaperPdf(kind: PaperKind, schData: Record<string, unknown>, fileName: string) {
  const payload = await fetchPaper(kind, schData);
  const html = payload.html ?? '';
  if (!html) throw new Error('Server returned no HTML template');
  return generatePaperPdf(buildFullHtml(html, { ...schData, ...(payload.data ?? {}) }, payload.titlelogo), fileName);
}

export async function downloadPaperHtml(kind: PaperKind, schData: Record<string, unknown>, fileName: string) {
  const payload = await fetchPaper(kind, schData);
  if (!payload.html) throw new Error('Server returned no HTML template');
  return generatePaperHtml(payload.html, fileName);
}

export async function generatePaperJson(payload: PaperPayload, fileName: string): Promise<{ uri: string; shared: boolean }> {
  if (Platform.OS === 'web') throw new Error('JSON export requires Android/iOS');
  const file = new File(Paths.cache, fileName.replace(/[\\/:*?"<>|]/g, '_'));
  file.write(JSON.stringify(payload, null, 2));
  let shared = false;
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: fileName });
    shared = true;
  }
  return { uri: file.uri, shared };
}

export async function downloadPaperJson(kind: PaperKind, schData: Record<string, unknown>, fileName: string) {
  return generatePaperJson(await fetchPaper(kind, schData), fileName);
}

