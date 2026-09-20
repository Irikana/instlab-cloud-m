// 从电脑版 INSTLAB CLOUD 自带的 katex.pkg 生成 App 内置的 KaTeX 样式表。
//
// 为什么要这一步：服务器返回的作业纸 HTML 里已经带着渲染好的 KaTeX 标记，
// 电脑版本身不跑 KaTeX 脚本，只提供样式与字体（安装目录的 katex.pkg）。
// 手机端若不带上同一份 CSS，公式的字距、上下标和根号就会整体跑偏。
//
// 用法：node scripts/gen-katex-assets.js [katex.pkg 路径]
// 产物：src/lib/katex-styles.ts（生成文件，勿手改）
//
// 字体一律转成 data URI：expo-print 在 Android 上以空 baseURL 调用
// loadDataWithBaseURL，相对路径无法解析，且 targetSdk 30 之后 WebView 默认
// 不允许读 file:// —— 只有 data: 能稳定加载。
const { execFileSync } = require('node:child_process');
const { mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'src', 'lib', 'katex-styles.ts');
const SOURCE_PKG = process.argv[2] || 'C:/Program Files/INSTLAB/INSTLAB CLOUD/katex.pkg';

const MIME = { woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf' };

const work = join(tmpdir(), `katex-pkg-${process.pid}`);
mkdirSync(work, { recursive: true });
try {
  execFileSync('unzip', ['-qo', SOURCE_PKG, '-d', work], { stdio: 'pipe' });
} catch (e) {
  rmSync(work, { recursive: true, force: true });
  console.error(`无法解压 ${SOURCE_PKG}（需要系统里有 unzip，可把包路径作为参数传入）`);
  process.exit(1);
}

let css = readFileSync(join(work, 'katex', 'katex.min.css'), 'utf8');

// 只保留 woff2：Chromium 原生支持且体积最小，带 woff/ttf 回退项会把体积推高一倍
// 而永远不会被 Android WebView 取用。
css = css.replace(/,\s*url\(fonts\/[^)]+\.(?:woff|ttf)\)\s*format\("[^"]*"\)/g, '');

const used = new Set();
css = css.replace(/url\(fonts\/([^)]+)\)/g, (m, file) => {
  const b64 = readFileSync(join(work, 'katex', 'fonts', file)).toString('base64');
  used.add(file);
  return `url(data:${MIME[file.split('.').pop()] || 'application/octet-stream'};base64,${b64}) format("woff2")`;
});
rmSync(work, { recursive: true, force: true });

if (used.size === 0) {
  console.error('没有匹配到任何 woff2 字体，katex.pkg 的结构可能变了；未生成文件。');
  process.exit(1);
}

writeFileSync(
  OUT,
  `// 生成文件，勿手改 —— 由 scripts/gen-katex-assets.js 从电脑版安装目录的 katex.pkg 生成。\n` +
    `// 内含 KaTeX 样式表与 ${used.size} 个 base64 字体，供作业纸渲染时整段注入。\n` +
    `export const KATEX_CSS = ${JSON.stringify(css)};\n`,
  'utf8',
);
console.log(`已生成 ${OUT}`);
console.log(`  内联字体 ${used.size} 个，CSS ${(css.length / 1024).toFixed(0)} KB`);
