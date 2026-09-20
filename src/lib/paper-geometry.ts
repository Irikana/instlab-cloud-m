// 解析服务器返回的 h2pargs —— 电脑版把作业纸 HTML 写成文件后，
// 原样把这些参数交给 h2p.exe（wkhtmltopdf 0.12.6）出图。
// 也就是说：版心尺寸、页边距、页眉页脚全由这组参数决定，不是手机端该猜的数。
// 手机端的分页要和电脑版对得上，就得先读同一组参数，读不到时才退回默认值。
//
// 单位规则与 wkhtmltopdf 一致：不带后缀的数字按毫米解释，另支持 cm / in / px / pt。

/** 一毫米等于多少 CSS 像素（96dpi，与 Chromium/wkhtmltopdf 的 CSS 单位一致） */
export const PX_PER_MM = 96 / 25.4;

export function mmToPx(value: number): number {
  return value * PX_PER_MM;
}

/** CSS 长度写法：保留三位小数足以表达毫米下的排版精度，也避免浮点长尾进样式串 */
const mm = (v: number) => `${Math.round(v * 1000) / 1000}mm`;

const PAGE_SIZES_MM: Record<string, [number, number]> = {
  a2: [420, 594],
  a3: [297, 420],
  a4: [210, 297],
  a5: [148, 210],
  b4: [250, 353],
  b5: [176, 250],
  letter: [215.9, 279.4],
  legal: [215.9, 355.6],
  tabloid: [279.4, 431.8],
};

/** wkhtmltopdf 的默认页边距是 10mm（h2p.exe 内置值即为此） */
const DEFAULT_MARGIN_MM = 10;
const DEFAULT_PAGE_MM: [number, number] = PAGE_SIZES_MM.a4;

export interface PaperEdge {
  /** 文本内容，支持 wkhtmltopdf 的 [page] / [topage] / [date] 等占位符 */
  left: string;
  center: string;
  right: string;
  /** 整段 HTML 替代文本（--header-html / --footer-html），有值时优先 */
  html: string;
  fontName: string;
  /** 磅值；wkhtmltopdf 默认 12pt */
  fontSizePt: number;
  /** 与纸边之间额外留出的距离，毫米；wkhtmltopdf 默认 0.25mm */
  spacingMm: number;
}

export interface PaperGeometry {
  pageWidthMm: number;
  pageHeightMm: number;
  marginTopMm: number;
  marginRightMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  header: PaperEdge;
  footer: PaperEdge;
  /** 真正参与分页的内容尺寸 */
  contentWidthMm: number;
  contentHeightMm: number;
  contentWidthPx: number;
  contentHeightPx: number;
  /** 整页宽度（CSS px），手机端把 A4 文档缩放到屏幕宽时按这个值算比例 */
  pageWidthPx: number;
  /** 参数里是否出现过任何页边距/页面尺寸项；为 false 说明用的是回退默认值 */
  explicit: boolean;
}

function emptyEdge(): PaperEdge {
  return { left: '', center: '', right: '', html: '', fontName: 'Helvetica Neue, Helvetica, Arial', fontSizePt: 12, spacingMm: 0.25 };
}

/** 把命令行切成 token：按空白分隔，但保留双引号内的空白 */
function tokenize(input: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

/**
 * 把服务器可能给出的各种形状统一成 token 数组。
 * 电脑版是把这个数组拼成一行交给 ProcessStartInfo.Arguments 的，所以数组里的每一项
 * 都是一个完整的 argv token——带空格的页脚文本（"[page] / [topage]"）整体占一项。
 * 因此对数组不能再按空格切，否则带空格的值会被拆散、只剩第一个词。
 */
export function normalizeArgs(raw: unknown): string[] {
  if (typeof raw === 'string') return tokenize(raw);
  if (Array.isArray(raw)) {
    const items = raw.filter((x): x is string => typeof x === 'string');
    // 整条命令行塞在唯一一项里的情况
    if (items.length === 1 && /\s/.test(items[0])) return tokenize(items[0]);
    return items;
  }
  if (raw && typeof raw === 'object') {
    const vals = Object.values(raw as Record<string, unknown>);
    if (vals.every((v) => typeof v === 'string')) {
      return vals.flatMap((v) => tokenize(v as string));
    }
  }
  return [];
}

/** 长度 → 毫米；无后缀按毫米，与 wkhtmltopdf 行为一致 */
export function toMm(value: string, fallback: number): number {
  const m = String(value).trim().match(/^(-?\d+(?:\.\d+)?)\s*(mm|cm|in|pt|px)?$/i);
  if (!m) return fallback;
  const n = parseFloat(m[1]);
  if (!isFinite(n)) return fallback;
  switch ((m[2] || 'mm').toLowerCase()) {
    case 'cm':
      return n * 10;
    case 'in':
      return n * 25.4;
    case 'pt':
      return (n * 25.4) / 72;
    case 'px':
      return (n * 25.4) / 96;
    default:
      return n;
  }
}

/** 页眉页脚里的占位符替换（[page] 当前页、[topage] 总页数、[date]/[time]/[isodate] 等） */
export function fillEdgePlaceholders(
  text: string,
  ctx: { page: number; pages: number; date?: Date },
): string {
  const d = ctx.date ?? new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return String(text)
    .replace(/\[page\]/g, String(ctx.page))
    .replace(/\[topage\]/g, String(ctx.pages))
    .replace(/\[copies\]/g, '1')
    .replace(/\[isodate\]/g, `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`)
    .replace(/\[date\]/g, `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`)
    .replace(/\[time\]/g, `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`)
    .replace(/\[year\]/g, String(d.getFullYear()))
    .replace(/\[title\]/g, '');
}

/** 解析 wkhtmltopdf 参数向量；解析不出任何页面项时返回 A4 + 10mm 默认版心 */
export function parseH2pArgs(raw: unknown): PaperGeometry {
  const args = normalizeArgs(raw);
  // 长选项与短选项指向同一份存储
  const LONG: Record<string, string> = {
    'margin-top': 'top', 'margin-bottom': 'bottom', 'margin-left': 'left', 'margin-right': 'right',
    'page-width': 'pageWidth', 'page-height': 'pageHeight', 'page-size': 'pageSize',
    'header-left': 'headerLeft', 'header-center': 'headerCenter', 'header-right': 'headerRight',
    'header-html': 'headerHtml', 'header-font-name': 'headerFontName',
    'header-font-size': 'headerFontSize', 'header-spacing': 'headerSpacing',
    'footer-left': 'footerLeft', 'footer-center': 'footerCenter', 'footer-right': 'footerRight',
    'footer-html': 'footerHtml', 'footer-font-name': 'footerFontName',
    'footer-font-size': 'footerFontSize', 'footer-spacing': 'footerSpacing',
  };
  const SHORT: Record<string, string> = {
    T: 'top', B: 'bottom', L: 'left', R: 'right',
    W: 'pageWidth', H: 'pageHeight', s: 'pageSize',
  };
  const FLAGS = new Set(['no-header', 'no-footer']);

  const found = new Map<string, string>();
  const flags = new Set<string>();
  let explicit = false;

  for (let i = 0; i < args.length; i++) {
    const tok = String(args[i]);
    const eq = tok.indexOf('=');
    // --margin-top=30 / -T30 这种写在一行的形式
    let name = tok;
    let inlineValue: string | null = null;
    if (tok.startsWith('--') && eq > 0) {
      name = tok.slice(2, eq);
      inlineValue = tok.slice(eq + 1);
    } else if (tok.startsWith('--')) {
      name = tok.slice(2);
    } else if (tok.startsWith('-') && tok.length > 1) {
      name = tok.slice(1);
      if (name.length > 1) {
        inlineValue = name.slice(1);
        name = name[0];
      }
    } else {
      continue;
    }

    const key = LONG[name] ?? SHORT[name];
    if (key) {
      let v = inlineValue;
      if (v === null) {
        const next = args[i + 1];
        // 下一个 token 若又是选项则说明该选项缺值，避免把页码当成参数吞掉
        if (typeof next === 'string' && !next.startsWith('-')) {
          v = next;
          i += 1;
        }
      }
      if (v !== null && v !== undefined) found.set(key, v);
      continue;
    }
    if (FLAGS.has(name)) flags.add(name);
  }

  if (found.size > 0) explicit = true;

  const num = (key: string, fb: number) => {
    const v = found.get(key);
    if (v === undefined) return fb;
    const n = parseFloat(v);
    return isFinite(n) ? n : fb;
  };

  let [pageWidthMm, pageHeightMm] = DEFAULT_PAGE_MM;
  const pageSize = found.get('pageSize');
  if (pageSize) {
    const preset = PAGE_SIZES_MM[pageSize.trim().toLowerCase()];
    if (preset) [pageWidthMm, pageHeightMm] = preset;
  }
  if (found.has('pageWidth')) pageWidthMm = toMm(found.get('pageWidth')!, pageWidthMm);
  if (found.has('pageHeight')) pageHeightMm = toMm(found.get('pageHeight')!, pageHeightMm);

  const marginTopMm = toMm(found.get('top') ?? '', DEFAULT_MARGIN_MM);
  const marginBottomMm = toMm(found.get('bottom') ?? '', DEFAULT_MARGIN_MM);
  const marginLeftMm = toMm(found.get('left') ?? '', DEFAULT_MARGIN_MM);
  const marginRightMm = toMm(found.get('right') ?? '', DEFAULT_MARGIN_MM);

  const edge = (prefix: string, off: boolean): PaperEdge => {
    const e = emptyEdge();
    if (off) return e;
    e.left = found.get(`${prefix}Left`) ?? '';
    e.center = found.get(`${prefix}Center`) ?? '';
    e.right = found.get(`${prefix}Right`) ?? '';
    e.html = found.get(`${prefix}Html`) ?? '';
    e.fontName = found.get(`${prefix}FontName`) ?? e.fontName;
    e.fontSizePt = num(`${prefix}FontSize`, e.fontSizePt);
    const sp = found.get(`${prefix}Spacing`);
    // --*-spacing 的单位在 wkhtmltopdf 里是毫米
    e.spacingMm = sp === undefined ? e.spacingMm : toMm(sp, e.spacingMm);
    return e;
  };
  const header = edge('header', flags.has('no-header'));
  const footer = edge('footer', flags.has('no-footer'));

  const contentWidthMm = Math.max(1, pageWidthMm - marginLeftMm - marginRightMm);
  const contentHeightMm = Math.max(1, pageHeightMm - marginTopMm - marginBottomMm);

  return {
    pageWidthMm,
    pageHeightMm,
    marginTopMm,
    marginRightMm,
    marginBottomMm,
    marginLeftMm,
    header,
    footer,
    contentWidthMm,
    contentHeightMm,
    contentWidthPx: mmToPx(contentWidthMm),
    contentHeightPx: mmToPx(contentHeightMm),
    pageWidthPx: mmToPx(pageWidthMm),
    explicit,
  };
}

/** 打印用的 @page 与页面容器样式（与电脑版同一套版心） */
export function pageCss(g: PaperGeometry): string {
  return (
    `@page { size: ${mm(g.pageWidthMm)} ${mm(g.pageHeightMm)}; margin: 0; }\n` +
    `html, body { margin: 0; padding: 0; width: ${mm(g.pageWidthMm)}; min-height: ${mm(g.pageHeightMm)}; }\n`
  );
}

/** 一页内容区的内边距 —— 页边距由 body 自己撑出来，等价于 h2p 的 -T/-B/-L/-R */
export function contentPaddingCss(g: PaperGeometry): string {
  return (
    `padding:${mm(g.marginTopMm)} ${mm(g.marginRightMm)} ${mm(g.marginBottomMm)} ${mm(g.marginLeftMm)};` +
    `box-sizing:border-box;width:100%;`
  );
}

/**
 * 页眉 / 页脚所在横条的定位样式。
 * 电脑版的页眉页脚画在对应的页边距带里（h2p 把它们排在正文之外），
 * 所以这里同样落在边距带内，而不是挤进正文。
 */
export function edgeCss(g: PaperGeometry, side: 'header' | 'footer'): string {
  const e = side === 'header' ? g.header : g.footer;
  // --header-spacing / --footer-spacing 是文字与纸边的距离，默认 0.25mm
  const vertical = `${side === 'header' ? 'top' : 'bottom'}:${mm(e.spacingMm)};`;
  return (
    `position:absolute;${vertical}box-sizing:border-box;overflow:hidden;` +
    `left:${mm(g.marginLeftMm)};` +
    `width:${mm(g.contentWidthMm)};` +
    `font-family:${e.fontName};font-size:${e.fontSizePt}pt;line-height:normal;`
  );
}

/** 页眉 / 页脚整条 HTML；三段内容与电脑版的 left/center/right 一致，全无内容时返回空串 */
export function renderEdgeHtml(
  g: PaperGeometry,
  side: 'header' | 'footer',
  page: number,
  pages: number,
): string {
  const e = side === 'header' ? g.header : g.footer;
  if (e.html) return `<div style="${edgeCss(g, side)}">${e.html}</div>`;
  const ctx = { page, pages };
  const l = fillEdgePlaceholders(e.left, ctx);
  const c = fillEdgePlaceholders(e.center, ctx);
  const r = fillEdgePlaceholders(e.right, ctx);
  if (!l && !c && !r) return '';
  const cell = (text: string, align: string) =>
    `<td style="text-align:${align};vertical-align:bottom;padding:0;">${text}</td>`;
  return (
    `<div style="${edgeCss(g, side)}">` +
    `<table style="width:100%;border-collapse:collapse;table-layout:fixed;"><tr>` +
    cell(l, 'left') + cell(c, 'center') + cell(r, 'right') +
    `</tr></table></div>`
  );
}
