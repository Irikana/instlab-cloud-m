import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { post } from './api';
import { KATEX_CSS } from './katex-styles';
import { shareJson, shareText } from './share';
import {
  contentPaddingCss,
  parseH2pArgs,
  pageCss,
  renderEdgeHtml,
  type PaperGeometry,
} from './paper-geometry';

export interface PaperPayload {
  filetypeid?: string;
  filetype?: string;
  data?: Record<string, unknown>;
  html?: string;
  /** 电脑版直接交给 h2p.exe（wkhtmltopdf）的参数向量：版心与页边距的权威来源 */
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

/** 作业纸渲染参数：版心来自 h2pargs，条码前缀来自 filetypeid */
export interface PaperRenderOptions {
  geometry: PaperGeometry;
  /** 条码前缀 = 服务器给的 filetypeid（电脑版的缓存文件名 paper_0801000007717.jpg 即此规则） */
  barcodePrefix: string;
  /** 作业记录 ID（服务器 data.id），为空时不生成身份条码 */
  paperId: string;
  titlelogo?: string;
}

const WEEK_CN = ['日', '一', '二', '三', '四', '五', '六'];

export function geometryForPayload(payload: PaperPayload): PaperGeometry {
  return parseH2pArgs(payload.h2pargs);
}

/** filetypeid 为两位数前缀；服务器没给时按作业纸类型回退（与电脑版缓存名一致） */
export function barcodePrefixFor(payload: PaperPayload, kind: PaperKind): string {
  const raw = String(payload.filetypeid ?? '').replace(/\D/g, '');
  if (raw) return raw.padStart(2, '0').slice(-2);
  return kind === 'work' ? '08' : '82';
}

/**
 * 身份条码里的作业 ID。
 * 实测电脑版条码为 0801000011740 → 作业 ID 是 11740（补零到 9 位），与 schid/planid/expid 无关。
 * 服务器把这个值放在哪个字段并没有文档可查，因此按几个常见写法找第一个纯数字字段，
 * 并把命中的字段名回传给界面显示——对不上时能一眼看出是没这个字段还是取错了键。
 */
const PAPER_ID_KEYS = ['id', 'paperid', 'paper_id', 'workpaperid', 'wpid', 'pid'];

export function paperIdOf(payload: PaperPayload, fallback: Record<string, unknown> = {}): { id: string; from: string } {
  const sources: Array<[string, Record<string, unknown>]> = [
    ['data', (payload.data ?? {}) as Record<string, unknown>],
    ['request', fallback],
  ];
  for (const [where, src] of sources) {
    for (const key of PAPER_ID_KEYS) {
      const v = src[key];
      if (v === undefined || v === null) continue;
      const digits = String(v).replace(/\D/g, '');
      if (digits && digits === String(v).trim()) return { id: digits, from: `${where}.${key}` };
    }
  }
  return { id: '', from: '' };
}

/**
 * 作业纸导出文件名，与电脑版保持一致：
 * 课程作业纸_量子力学_20010000001_李四_2026年9月8日_(星期二).pdf
 * 日期用「YYYY年M月D日_(星期X)」而不是压缩成 8 位数字（此前手机端与电脑版不一致）。
 */
export function paperFileName(
  kind: PaperKind,
  courseName: string,
  login: string,
  userName: string,
  dateString: string,
  ext: string,
): string {
  const label = kind === 'work' ? '课程作业纸' : '批改作业纸';
  const clean = (s: string) => String(s ?? '').replace(/[\\/:*?"<>|]/g, '_').trim();
  const d = String(dateString ?? '').match(/(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  let datePart = clean(dateString);
  if (d) {
    const dt = new Date(Number(d[1]), Number(d[2]) - 1, Number(d[3]));
    datePart = isNaN(dt.getTime())
      ? `${d[1]}年${Number(d[2])}月${Number(d[3])}日`
      : `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日_(星期${WEEK_CN[dt.getDay()]})`;
  }
  return `${label}_${clean(courseName)}_${clean(login)}_${clean(userName)}_${datePart}.${ext}`;
}

/** 页面顶部身份条码的内容：前缀 + 两位页码 + 补零到 9 位的作业 ID */
export function paperBarcodeValue(prefix: string, paperId: string | number, page: number): string {
  const id = String(paperId ?? '').replace(/\D/g, '');
  if (!id) return '';
  return `${prefix}${String(page).padStart(2, '0')}${id.padStart(9, '0')}`;
}

const CJK_SERIF_STACK =
  "'Noto Serif SC','Noto Serif CJK SC','Source Han Serif SC','Songti SC','SimSun',serif";

/** 追加到服务器模板之后的样式：版心、KaTeX、中文宋体兜底 */
function injectedStyles(g: PaperGeometry): string {
  return `<style>\n${KATEX_CSS}\n${pageCss(g)}\nbody, table, td, th, div, span, p { font-family: ${CJK_SERIF_STACK}; }\n</style>`;
}

/** 服务器模板里以相对路径引用的资源在打印 WebView 中无法解析（baseURL 为空），去掉 */
function stripScripts(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '');
}

/** 取出文档 <head> 内容（不含标签本身），并剥掉脚本 */
export function headOf(fullDoc: string): string {
  const m = fullDoc.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  return m ? stripScripts(m[1]) : '';
}

/**
 * 组装用于测量与展示的完整文档：底版（服务器 HTML + 注入样式 + 抬头图 + 日期）。
 * 分页前它是一篇连续文档；分页后由 assemblePaginatedDoc 重排成一页一页。
 */
export function buildBaseDocument(
  html: string,
  data: Record<string, unknown>,
  opts: PaperRenderOptions,
): string {
  let out = html;

  out = out.replace(/<\/head>/i, `${injectedStyles(opts.geometry)}</head>`);

  // 日期一律以服务器给的字符串为准（电脑版也是直接取服务器字段，不自行换算）
  const dateText = String(
    data.paper_datestring ?? data.assignment_datestring ?? data.sch_datestring ?? '',
  );
  const rawDate = typeof data.paper_date === 'string' ? data.paper_date
    : typeof data.assignment_date === 'string' ? data.assignment_date
      : typeof data.sch_date === 'string' ? data.sch_date : '';
  const replacement = dateText || formatDateText(rawDate);
  if (replacement) {
    // 模板里的日期可能带 (节) 之类的尾缀，整段一起替换，避免留下半个括号
    out = out.replace(
      /\d{4}年\d{1,2}月\d{1,2}日\s*\(\s*星期[一二三四五六日]\s*\)(?:\s*\([^)]{1,4}\))?/g,
      replacement,
    );
  }
  return out;
}

function formatDateText(input: string): string {
  if (!input) return '';
  const m = String(input).match(/(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 (星期${WEEK_CN[d.getDay()]})`;
}

// ========== Code128（与电脑版 iText Barcode128 同一套条空表） ==========
// 1=黑条 0=白空，每个符号 11 模块（Stop 为 13 模块）。ISO/IEC 15417。
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

/**
 * 条码在纸面上的物理尺寸——直接量自电脑版生成的 PDF：
 * iText 生成的 Form XObject BBox 98.4x32.6pt，放到页面上时矩阵缩放 1.87，
 * 于是渲染成 65.0x21.5mm；其中竖条在表单内占 y 6.6..32.6（26pt 高 ×1.87 = 17.15mm），
 * 说明文字在竖条下方，字号 5pt ×1.87 = 9.35pt。
 */
const BARCODE_WIDTH_MM = 65;
const BARCODE_HEIGHT_MM = 21.5;
const BARCODE_BARS_MM = 17.15;
const BARCODE_CAPTION_PT = 9.35;

/** 页眉带：抬头图与条码都落在页边距带里（实测距页顶 15mm，而正文从 30mm 起排） */
function bandTopMm(g: PaperGeometry): number {
  return g.marginTopMm / 2;
}

/** 码值序列 → 模块总数（供注入脚本与 TS 侧共用同一份宽度算法） */
function code128Modules(codes: number[]): number {
  let x = 0;
  for (const c of codes) x += String(CODE128_BITS[c] ?? '').length;
  return x;
}

function code128Rects(codes: number[]): string {
  const parts: string[] = [];
  let x = 0;
  for (const code of codes) {
    const bits = String(CODE128_BITS[code] ?? '');
    for (let i = 0; i < bits.length; i++) {
      if (bits[i] === '1') parts.push(`<rect x="${x}" width="1"/>`);
      x += 1;
    }
  }
  return parts.join('');
}

/**
 * 身份条码 SVG。
 * 条宽用 viewBox 里的 1 模块表示，再由 width/height 一次性缩放到纸面尺寸，
 * 这样每条模块严格等宽；若按像素画会因 65mm 除不尽 123 模块而出现粗细不均。
 */
function barcodeSvg(value: string): string {
  const codes = code128cCodes(value);
  if (!codes.length) return '';
  const modules = code128Modules(codes);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${modules} 34" ` +
    `width="${BARCODE_WIDTH_MM}mm" height="${BARCODE_BARS_MM}mm" preserveAspectRatio="none">` +
    `<g fill="#000" height="34">${code128Rects(codes)}</g></svg>`
  );
}

function code128cCodes(value: string): number[] {
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

/** 一页右上角的身份条码（条码 + 下方可读文本） */
/**
 * 未分页文档（拿不到作业 ID 或分页脚本失败）的抬头处理：
 * 用 position:fixed 让抬头图压在每页同位置，不参与正文排版。
 * 已分页的文档走 assemblePaginatedDoc 的逐页盖章，不使用本函数。
 */
export function withFlatHeader(doc: string, opts: PaperRenderOptions): string {
  const logo = logoHtml(opts);
  if (!logo) return doc;
  return doc.replace(/<\/body>/i, `<div style="position:fixed;top:0;left:0;width:${opts.geometry.pageWidthMm}mm;height:${opts.geometry.pageHeightMm}mm;pointer-events:none;">${logo}</div></body>`);
}

/**
 * 每页左上角的抬头图。
 * 实测电脑版：图片 60.8x18.5mm，左边 15mm、距页顶 15mm——落在上边距带里，
 * 不参与正文排版（正文仍从 30mm 起）。手机端必须同样绝对定位，
 * 否则会把整页正文往下顶 18.5mm，和电脑版错开一整条。
 */
function logoHtml(opts: PaperRenderOptions): string {
  if (!opts.titlelogo) return '';
  const image = opts.titlelogo.startsWith('data:')
    ? opts.titlelogo
    : `data:image/png;base64,${opts.titlelogo}`;
  const g = opts.geometry;
  return (
    `<div class="icm-logo" style="position:absolute;top:${bandTopMm(g)}mm;left:${g.marginLeftMm}mm;` +
    `width:60.8mm;height:18.5mm;z-index:5;">` +
    `<img src="${image}" style="width:60.8mm;height:18.5mm;display:block" /></div>`
  );
}

/** 一页右上角的身份条码：竖条在上、可读数字在下，与电脑版 iText 的排布一致 */
function barcodeHtml(value: string, g: PaperGeometry): string {
  if (!value) return '';
  return (
    `<div class="paper-barcode" style="position:absolute;top:${bandTopMm(g)}mm;right:${g.marginRightMm}mm;` +
    `width:${BARCODE_WIDTH_MM}mm;height:${BARCODE_HEIGHT_MM}mm;text-align:right;z-index:5;overflow:hidden;">` +
    barcodeSvg(value) +
    `<div style="font-size:${BARCODE_CAPTION_PT}pt;line-height:1;text-align:right;font-family:sans-serif;">${value}</div>` +
    `</div>`
  );
}

// ========== 分页 ==========

/**
 * 可分页单元（DOM 侧喂进来的形状）。
 * h       = 高度（CSS px）
 * html    = 该单元的完整 HTML
 * kids    = 可再拆的子单元
 * wrap    = 用同样的外层标签把一段内部 HTML 包回来
 * shellId = 外层标签的身份，用于认出"来自同一个父元素"的片段
 */
export interface PackUnit {
  h: number;
  html: string;
  kids?: PackUnit[];
  wrap?: (inner: string) => string;
  shellId?: number;
}

/** 一层外壳：id 用来认出同一个父元素，wrap 用来把内部 HTML 包回来 */
interface Shell {
  id: number;
  wrap: (inner: string) => string;
}

/** 装页用的最小片段：只存最里面的 HTML 和从外到内的外壳链 */
export interface PackAtom {
  h: number;
  inner: string;
  chain: Shell[];
}

/**
 * 按 h2pargs 给出的版心把版面单元切成一页一页，返回每页的 innerHTML。
 *
 * 为什么整个算法写在同一个函数里：它要原样注入到测量 WebView 中执行
 * （buildPaginateScript 用 fn.toString() 搬过去），而 toString() 搬不走模块级
 * 的兄弟函数——上次就是这么把 chainKey 落在外面，measure() 在定时器里抛
 * ReferenceError、既不进 catch 也不回传，结果预览永远停在测量页，
 * 抬头图、条码、码下数字、页数一并消失。自包含就没有"忘了带上谁"这类错。
 *
 * 分页规则与电脑版的差异此前出在两处：
 * 一是引擎按行连续断页而手机端只在顶层块之间断，装不下的整块被挪页、
 * 超过一页高度的块更会被 .paper-page 的 overflow:hidden 裁掉，内容凭空消失；
 * 二是拆开的片段若各自套一层外壳，同一张表格的两行会变成两张表。
 * 所以这里一路向下拆到装得下为止（真实作业纸是 table>tbody>tr>td>… 每层
 * 常常只有一个孩子，单子块也要下钻），再把相邻同链的片段并回同一个外壳。
 */
export function paginateUnits(units: PackUnit[], pageH: number): string[] {
  const flatten = (item: PackUnit, chain: Shell[]): PackAtom[] => {
    if (item.h <= pageH) return [{ h: item.h, inner: item.html, chain }];
    const kids = item.kids ?? [];
    if (!kids.length || !item.wrap) return [{ h: item.h, inner: item.html, chain }];
    const next = chain.concat({ id: item.shellId ?? 0, wrap: item.wrap });
    const frags = kids.reduce<PackAtom[]>((acc, k) => acc.concat(flatten(k, next)), []);
    // 拆完还是同样高、同样一段：这条链上没有可断点，整块原样交出去
    if (frags.length === 1 && Math.abs(frags[0].h - item.h) < 1 && frags[0].chain.length === next.length) {
      return [{ h: item.h, inner: item.html, chain }];
    }
    return frags;
  };
  const atoms = units.reduce<PackAtom[]>((acc, u) => acc.concat(flatten(u, [])), []);

  const pages: PackAtom[][] = [];
  let cur: PackAtom[] = [];
  let used = 0;
  for (const item of atoms) {
    if (cur.length > 0 && used + item.h > pageH) {
      pages.push(cur);
      cur = [];
      used = 0;
    }
    cur.push(item);
    used += item.h;
  }
  if (cur.length > 0 || pages.length === 0) pages.push(cur);

  return pages.map((page) => {
    let out = '';
    let i = 0;
    while (i < page.length) {
      const key = page[i].chain.map((c) => c.id).join('>');
      let buf = page[i].inner;
      let j = i + 1;
      while (j < page.length && page[j].chain.map((c) => c.id).join('>') === key) {
        buf += page[j].inner;
        j += 1;
      }
      const chain = page[i].chain;
      for (let k = chain.length - 1; k >= 0; k--) buf = chain[k].wrap(buf);
      out += buf;
      i = j;
    }
    return out;
  });
}

/**
 * 测量 WebView 里执行的脚本：按 h2pargs 给出的版心把正文切成一页一页，
 * 只把每页的内部 HTML 回传（head 由 RN 侧复用，避免把整份 KaTeX 字体搬过桥）。
 */
export function buildPaginateScript(opts: PaperRenderOptions): string {
  const g = opts.geometry;
  return `
(function () {
  try {
    var CONTENT_PX = ${g.contentHeightPx};
    var PADDING = ${JSON.stringify(contentPaddingCss(g))};
    // 分页算法与手机端共用同一份实现：paginateUnits 是自包含的，整个函数搬过来即可，
    // 不再有需要按名注入的兄弟函数（历史教训见 paginateUnits 的注释）
    var paginateUnits = ${paginateUnits.toString()};

    function measure() {
      var body = document.body;
      if (!body) throw new Error('文档没有 body');
      // 测量时必须带着页边距一起排版：正文实际可用宽是版心宽（电脑版实测 679 CSS px ≈ 180mm），
      // 按整页宽（210mm）量出来的行数会比打印出来少一截。
      // PADDING 里带 width:100%，所以整页宽度要在它之后再压一次。
      body.style.cssText = 'margin:0;box-sizing:border-box;transform:none;' + PADDING + 'width:${g.pageWidthMm}mm;';

      var units = [];
      var SKIP = { script: 1, style: 1, link: 1, meta: 1 };
      var shellSeq = 0;
      function toUnit(el) {
        var r = el.getBoundingClientRect();
        var kids = [];
        for (var i = 0; i < el.children.length; i++) {
          var c = el.children[i];
          var t = c.tagName.toLowerCase();
          if (SKIP[t]) continue;
          var k = toUnit(c);
          if (k.h > 0.5) kids.push(k);
        }
        // 每个元素都要有独立编号：拆页时靠它认出哪些片段同属一个父元素，相邻的才能并回同一层外壳
        var shellId = ++shellSeq;
        return {
          h: r ? r.height : 0,
          html: el.outerHTML,
          kids: kids,
          shellId: shellId,
          wrap: function (inner) {
            var shell = el.cloneNode(false);
            shell.innerHTML = inner;
            return shell.outerHTML;
          }
        };
      }
      for (var ci = 0; ci < body.children.length; ci++) {
        var el = body.children[ci];
        if (SKIP[el.tagName.toLowerCase()]) continue;
        var u = toUnit(el);
        if (u.h > 0.5) units.push(u);
      }
      var out = paginateUnits(units, CONTENT_PX);
      var wrapped = [];
      for (var pi = 0; pi < out.length; pi++) wrapped.push('<div style="' + PADDING + '">' + out[pi] + '</div>');
      report(JSON.stringify({ icm: 'pages', pages: wrapped }));
    }

    // 回传与报错都要在定时器回调里也生效：injectedJavaScript 可能在 document.body
    // 就绪前就执行，抛在 setTimeout 里的错进不了外层 try/catch，就变成"既不报错也不回传"，
    // 界面安静地卡在测量页——真机上看到的就是"和以前一样"。
    function report(msg) {
      try {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) window.ReactNativeWebView.postMessage(msg);
        else if (window.parent && window.parent.postMessage) window.parent.postMessage(msg, '*');
      } catch (e) { /* 传不出去也没别的地方可报 */ }
    }
    function fail(e) { report('__PAGINATE_ERROR__' + String((e && e.message) || e)); }
    function guard(fn) { return function () { try { fn(); } catch (e) { fail(e); } }; }

    var started = false;
    function start() {
      if (started) return;
      started = true;
      // 等 body 及其正文真的出现再量，最多重试 20 次（每次 150ms）
      var tries = 0;
      function attempt() {
        try {
          var b = document.body;
          if (!b || b.children.length === 0) {
            if (++tries < 20) { setTimeout(attempt, 150); return; }
            report('__PAGINATE_ERROR__文档一直没有正文内容');
            return;
          }
          measure();
        } catch (e) { fail(e); }
      }
      setTimeout(attempt, 80);
    }
    // 等注入的 KaTeX / 中文字体真正生效后量高度，否则按兜底字体的行高分页，
    // 打印时字体一到、内容下沉，页码和条码就跟版面对不上了
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
      document.fonts.ready.then(guard(start));
      setTimeout(guard(start), 1500);
    } else {
      setTimeout(guard(start), 400);
    }
  } catch (e) {
    var err = '__PAGINATE_ERROR__' + String(e && e.message || e);
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) window.ReactNativeWebView.postMessage(err);
  }
})();
true;
`;
}

/** 把测量回来的分页内容拼成最终打印文档：每页一个 .paper-page，带条码与页眉页脚 */
export function assemblePaginatedDoc(
  baseDoc: string,
  pages: string[],
  opts: PaperRenderOptions,
): string {
  const g = opts.geometry;
  const head = headOf(baseDoc);
  const total = pages.length || 1;
  let body = '';
  for (let i = 0; i < pages.length; i++) {
    const code = paperBarcodeValue(opts.barcodePrefix, opts.paperId, i + 1);
    body +=
      `<div class="paper-page" style="width:${g.pageWidthMm}mm;height:${g.pageHeightMm}mm;position:relative;margin:0;padding:0;box-sizing:border-box;overflow:hidden;` +
      (i === pages.length - 1 ? '' : 'page-break-after:always;') + `">` +
      renderEdgeHtml(g, 'header', i + 1, total) +
      logoHtml(opts) +
      pages[i] +
      renderEdgeHtml(g, 'footer', i + 1, total) +
      barcodeHtml(code, g) +
      `</div>`;
  }
  return `<!DOCTYPE html><html><head>${head}</head><body>${body}</body></html>`;
}

/** 解析测量脚本回传的消息 */
export function readPaginateMessage(data: string):
  | { kind: 'pages'; pages: string[] }
  | { kind: 'error'; message: string }
  | { kind: 'ignore' } {
  if (data.startsWith('__PAGINATE_ERROR__')) {
    return { kind: 'error', message: data.replace('__PAGINATE_ERROR__', '') };
  }
  if (!data.startsWith('{')) return { kind: 'ignore' };
  try {
    const parsed = JSON.parse(data);
    if (parsed.icm === 'pages' && Array.isArray(parsed.pages)) {
      return { kind: 'pages', pages: parsed.pages.map(String) };
    }
  } catch {
    // 服务器 HTML 里的脚本也可能 postMessage，忽略即可
  }
  return { kind: 'ignore' };
}

/** 打印/导出 PDF 的页面尺寸（单位 pt；A4 即 595x842，版心不是 A4 时按实际毫米换算） */
export function printPageSize(g: PaperGeometry): { width: number; height: number } {
  const mmToPt = (v: number) => Math.round((v * 72) / 25.4);
  return { width: mmToPt(g.pageWidthMm), height: mmToPt(g.pageHeightMm) };
}

// ========== 导出 ==========

/** 服务器原样返回的作业纸 HTML（未套手机端样式），用于与电脑版对照排查 */
export async function downloadRawHtml(payload: PaperPayload, fileName: string) {
  return shareText(payload.html ?? '', fileName, 'text/html');
}

/** 服务器完整响应（含 h2pargs / data），用于分析字段 */
export async function downloadRawJson(payload: PaperPayload, fileName: string) {
  return shareJson(payload, fileName);
}

/**
 * 把排好版的文档导出为 PDF 并交给系统分享。
 * doc 必须是 assemblePaginatedDoc 的产物——手机端只承认这一条出图路径，
 * 避免出现「预览一套分页、另一个按钮另一套」的两份结果。
 */
export async function exportDocPdf(doc: string, g: PaperGeometry, fileName: string) {
  const { uri } = await Print.printToFileAsync({
    html: doc,
    ...printPageSize(g),
    // 固定 100%：Android 的 WebView 会按系统「字体大小」放大正文，
    // 用户调过系统字体的话，打印出来的分行就会和测量分页时量到的高度错位。
    textZoom: 100,
  });
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
