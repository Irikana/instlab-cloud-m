// 生成内置更新日志数据：读取 changelog/CHANGELOG-*.md，解析成结构化块，
// 输出 src/lib/changelog-data.ts（App 内「更新日志」页离线展示，不联网）。
// 正式发布链的一步：写完 CHANGELOG 就必须跑一次 `node scripts/gen-changelog.js`，
// 否则发出去的版本里看不到本次变更。
//
// 本仓库 changelog 的书写约定（决定哪些内容会进 App）：
//   # v0.0.9 — 一句话标题   文件头，取破折号后的部分作为版本标题
//   **构建日期：** 2026-08-31  该版本的日期，显示在版本卡片上
//   ## 修复 / 新增 / 说明 / 主题 …
//                          面向读者的节，其中每条 `- ` 逐项进入 App
//   ## 验证 / 依赖变更 / 构建与发布 …
//                          开发者节：命中 DEV_KEYWORDS 即整节不进 App
//   缩进续行                并入上一条（长条目常换行书写）
//   其余普通行 / 引用块      忽略
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CHANGELOG_DIR = path.join(ROOT, 'changelog');
const OUT_FILE = path.join(ROOT, 'src', 'lib', 'changelog-data.ts');

/** 从文件名提取版本号：CHANGELOG-0.0.9.2.md → 0.0.9.2 */
const verOf = (name) => name.replace(/^CHANGELOG-/, '').replace(/\.md$/, '');

/** 版本号比较，升序（按点分段取数，缺位补 0） */
function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da !== db) return da - db;
  }
  return 0;
}

/**
 * 版本先后：先看构建日期，再看版本号。
 * 光比版本号会把 v0.1.0（首次构建成功留下的纪念版）排到 0.0.10 之前——
 * 它其实是最早的一份，App 里也就不该顶在列表第一行。没有日期的按最早处理。
 */
function compareOrder(a, b) {
  if (a.date && b.date && a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (!a.date && b.date) return -1;
  if (a.date && !b.date) return 1;
  return compareVersions(a.key, b.key);
}

/** 节标题命中这些关键词即视为开发者内容，整节不进 App 界面 */
const DEV_KEYWORDS = ['构建', '发布', 'CI', '验证', '依赖', '规则', '硬约束'];
const isDevSection = (title) => DEV_KEYWORDS.some((k) => title.includes(k));

/** 去掉 Markdown 强调符号：界面是纯文本渲染，留着 ** 和 ` 会变成噪声 */
const plain = (text) => text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').trim();

function parseChangelog(md, key) {
  const blocks = [];
  let title = '';
  let date = '';
  let devOnly = false;
  let inBullet = false;

  for (const raw of md.split('\n')) {
    const line = raw.trim();
    if (!line) {
      inBullet = false;
      continue;
    }
    if (line.startsWith('## ') || line.startsWith('# ')) {
      const heading = line.replace(/^#+\s*/, '').trim();
      // 有的文件把「v0.0.2 — 标题」写成 H2：它是文档标题，不是「修复 / 新增」这类分节
      if (/^v?\d+\.\d+/.test(heading)) {
        const dash = heading.search(/\s[—-]\s/);
        title = plain(dash > 0 ? heading.slice(dash + 1).replace(/^[—-]\s*/, '') : '');
        inBullet = false;
        devOnly = false;
        continue;
      }
      inBullet = false;
      devOnly = isDevSection(heading);
      if (!devOnly) blocks.push({ kind: 'section', text: plain(heading) });
    } else if (line.startsWith('- ') && !devOnly) {
      inBullet = true;
      blocks.push({ kind: 'bullet', text: plain(line.slice(2)) });
    } else if (line.startsWith('>')) {
      inBullet = false;
    } else if (inBullet) {
      // 缩进续行并入上一条，避免长条目被截断
      blocks[blocks.length - 1].text += ' ' + plain(line);
    } else {
      const m = line.match(/\*\*构建日期：?\*\*\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/);
      if (m) date = m[1];
    }
  }

  return { key, date, title: title || `v${key}`, blocks };
}

const versions = fs
  .readdirSync(CHANGELOG_DIR)
  .filter((f) => f.startsWith('CHANGELOG-') && f.endsWith('.md'))
  .map(verOf);

const entries = versions
  .map((v) => parseChangelog(fs.readFileSync(path.join(CHANGELOG_DIR, `CHANGELOG-${v}.md`), 'utf8'), v))
  .sort((a, b) => compareOrder(b, a)); // 界面按新版本在前展示

const data = `// 自动生成：node scripts/gen-changelog.js —— 请勿手改
// 内置的全部更新日志（与 changelog/CHANGELOG-*.md 同步），App 内离线展示，新版本在前。
// 开发者节（验证 / 依赖变更 / 构建与发布等）不收录，界面只讲用户能看到的变化。
export type ChangelogBlockKind = 'section' | 'bullet';

export interface ChangelogBlock {
  kind: ChangelogBlockKind;
  text: string;
}

export interface ChangelogEntry {
  /** 版本号，如 0.0.9.2 */
  key: string;
  /** 构建日期 YYYY-MM-DD，缺失为空串 */
  date: string;
  /** 文件头破折号后的标题 */
  title: string;
  blocks: ChangelogBlock[];
}

export const CHANGELOG_DATA: ChangelogEntry[] = ${JSON.stringify(entries, null, 2)};
`;

fs.writeFileSync(OUT_FILE, data, 'utf8');
const bullets = entries.reduce((n, e) => n + e.blocks.filter((b) => b.kind === 'bullet').length, 0);
console.log(`生成 ${OUT_FILE}（共 ${entries.length} 个版本，${bullets} 条变更）`);
