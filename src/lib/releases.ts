// 更新检查：从 GitHub Releases 获取最新版本与 APK 下载链接
// 公开仓库无需 Token，但已登录时带上 Token 可显著提升速率限制（未认证 60 次/时，易触发 403）
// 取版本方式：拉取 releases 列表，按版本号比较取最大（而非依赖 /releases/latest 的返回顺序，
// 避免历史归档 release 因发布时间较晚而抢占"最新"）
import { APP_REPO_CONFIG, GITHUB_API } from './config';
import { getToken } from './auth';

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

export interface ReleaseInfo {
  tagName: string;
  name: string;
  publishedAt: string;
  htmlUrl: string;
  body: string;
  assets: ReleaseAsset[];
}

/** 直接下载 App 最新 APK 的固定链接 */
export const LATEST_APK_URL = `https://github.com/${APP_REPO_CONFIG.owner}/${APP_REPO_CONFIG.repo}/releases/latest/download/app-release.apk`;

/** INSTLAB CLOUD M 官网（GitHub Pages） */
export const APP_SITE_URL = 'https://irikana.github.io/instlab-cloud-m/';

interface RawRelease {
  tag_name: string;
  name: string;
  published_at: string;
  html_url: string;
  body: string | null;
  draft: boolean;
  assets: { name: string; browser_download_url: string }[];
}

function mapRelease(data: RawRelease): ReleaseInfo {
  return {
    tagName: data.tag_name,
    name: data.name,
    publishedAt: data.published_at,
    htmlUrl: data.html_url,
    body: data.body ?? '',
    assets: (data.assets ?? []).map((a) => ({
      name: a.name,
      browser_download_url: a.browser_download_url,
    })),
  };
}

/** 获取指定仓库的最新 release；仓库无 release 时返回 null */
async function fetchRepoRelease(owner: string, repo: string): Promise<ReleaseInfo | null> {
  const token = await getToken();
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // 方式一：列表接口 → 过滤 draft → 按版本号取最大（最稳妥）
  const listRes = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/releases?per_page=10`,
    { headers },
  );
  if (listRes.ok) {
    const list: RawRelease[] = await listRes.json();
    const releases = (list ?? []).filter((r) => !r.draft).map(mapRelease);
    if (releases.length === 0) return null;
    return releases.reduce((best, r) =>
      compareVersions(r.tagName, best.tagName) > 0 ? r : best,
    );
  }
  if (listRes.status === 404) return null;

  // 方式二：latest 端点兜底（列表接口异常时）
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/releases/latest`,
    { headers },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`获取更新失败（HTTP ${res.status}）`);
  return mapRelease((await res.json()) as RawRelease);
}

/** 获取 App 仓库（instlab-cloud-m）的最新 Release — 用于 App 版本更新与 APK 下载 */
export async function fetchAppRelease(): Promise<ReleaseInfo | null> {
  return fetchRepoRelease(APP_REPO_CONFIG.owner, APP_REPO_CONFIG.repo);
}

/** 简单版本比较：v0.0.4 > v0.0.3 */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) =>
    (v.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0));
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
}
