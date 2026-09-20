// 更新检查：匿名读取本应用在 GitHub 上公开发布的最新版本与安装包地址。
// 全程只有只读 GET，不携带也不存储任何 GitHub 凭据——此前误用 INSTLAB 登录 token 当
// GitHub Bearer 会直接 404/401；公开仓库匿名访问限 60 次/时，检查更新是低频操作，够用。
//
// 取版本方式：按「发布时间最新」挑，而不是按版本号最大。
// 这是本仓库特有的约定：v0.1.0 是首个构建成功留下的纪念版，版本号最大但早就发出去了，
// 按号取大会永远把它当成最新版（见 changelog/CHANGELOG-0.1.0.md）。
import { APP_REPO_CONFIG, GITHUB_API } from './config';

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface ReleaseInfo {
  tagName: string;
  name: string;
  publishedAt: string;
  htmlUrl: string;
  body: string;
  assets: ReleaseAsset[];
}

interface RawAsset {
  name: string;
  browser_download_url: string;
  size?: number;
}

interface RawRelease {
  tag_name: string;
  name: string | null;
  published_at: string;
  html_url: string;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  assets: RawAsset[];
}

function mapRelease(data: RawRelease): ReleaseInfo {
  return {
    tagName: data.tag_name,
    name: data.name || data.tag_name,
    publishedAt: data.published_at,
    htmlUrl: data.html_url,
    body: data.body ?? '',
    assets: (data.assets ?? []).map((a) => ({
      name: a.name,
      browser_download_url: a.browser_download_url,
      size: a.size ?? 0,
    })),
  };
}

/** INSTLAB CLOUD M 官网（GitHub Pages） */
export const APP_SITE_URL = 'https://irikana.github.io/instlab-cloud-m/';

/** 安装包附件名（与 build-apk.yml 上传的资源一致） */
export const APK_ASSET = 'app-release.apk';

/** 拿不到指定版本附件时的兜底地址：跟随最新发布版的固定链接 */
export const LATEST_APK_URL = `https://github.com/${APP_REPO_CONFIG.owner}/${APP_REPO_CONFIG.repo}/releases/latest/download/${APK_ASSET}`;

function plainHeaders(): HeadersInit {
  return { Accept: 'application/vnd.github+json', 'User-Agent': 'instlab-cloud-m' };
}

/** 把 HTTP 状态码翻译成用户看得懂的中文原因 */
function httpError(status: number): Error {
  if (status === 403 || status === 429) return new Error('检查更新太频繁，请稍后再试');
  if (status === 404) return new Error('还没有可检查的发布版本');
  return new Error(`检查更新失败（HTTP ${status}）`);
}

/**
 * 取最新发布版：列表可用时按发布时间挑最新；列表异常时退回「最新」端点。
 * 草稿与预发布（测试通道）都不算正式版；尚无任何发布时返回 null。
 */
export async function fetchAppRelease(): Promise<ReleaseInfo | null> {
  let res: Response;
  try {
    res = await fetch(`${GITHUB_API}/repos/${APP_REPO_CONFIG.owner}/${APP_REPO_CONFIG.repo}/releases?per_page=30`, {
      headers: plainHeaders(),
      cache: 'no-store',
    });
  } catch {
    throw new Error('网络不可达，暂时无法检查更新');
  }

  if (res.ok) {
    const list = (await res.json()) as RawRelease[];
    const usable = (list ?? []).filter((r) => !r.draft && !r.prerelease).map(mapRelease);
    if (usable.length === 0) return null;
    return usable.reduce((best, r) =>
      new Date(r.publishedAt).getTime() > new Date(best.publishedAt).getTime() ? r : best,
    );
  }

  if (res.status !== 404) {
    // 列表接口不可用（限流等）时，用最新端点兜底一次
    let fallback: Response;
    try {
      fallback = await fetch(
        `${GITHUB_API}/repos/${APP_REPO_CONFIG.owner}/${APP_REPO_CONFIG.repo}/releases/latest`,
        { headers: plainHeaders(), cache: 'no-store' },
      );
    } catch {
      throw new Error('网络不可达，暂时无法检查更新');
    }
    if (fallback.ok) return mapRelease((await fallback.json()) as RawRelease);
    if (fallback.status === 404) return null;
    throw httpError(fallback.status);
  }

  throw httpError(res.status);
}

/** 从发布条目里取安装包下载地址；没有该附件时返回 undefined，由调用方走发布页 */
export function apkUrlOf(release: ReleaseInfo): string | undefined {
  return release.assets.find((a) => a.name === APK_ASSET)?.browser_download_url;
}

/**
 * 版本号比较：去掉 v 前缀后按点分段逐位比较，缺位补 0。
 * 本仓库存在 0.0.9 与 0.0.9.2 两种段数，第四位是测试构建号，必须参与比较——
 * 只比前三位会让 0.0.9.2 的设备永远收不到 0.0.9.3 的更新提示。
 * 非数字段按 0 处理，因此 1-48 这类带前发布的写法会先落到主版本段上。
 */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => v.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
