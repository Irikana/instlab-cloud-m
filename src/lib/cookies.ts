// Cookie 管理：RN fetch 不自动保存 cookie，需手动解析 Set-Cookie 并回传
// 服务器通过 Set-Cookie 种 token / captcha / session cookie，后续请求必须带上

export interface Cookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
}

const cookieStore: Map<string, string> = new Map();

/** 从 Response headers 中解析 Set-Cookie 并保存 */
export function saveCookiesFromResponse(headers: Headers): void {
  const setCookies = headers.get('set-cookie')?.split(/,(?=\s*[a-zA-Z_][a-zA-Z0-9_]*=)/) ?? [];
  for (const sc of setCookies) {
    const parts = sc.split(';');
    const nv = parts[0].trim();
    const eq = nv.indexOf('=');
    if (eq > 0) {
      const name = nv.slice(0, eq).trim();
      const value = nv.slice(eq + 1).trim();
      if (name && value) cookieStore.set(name, value);
    }
  }
}

/** 获取当前所有 cookie 的 Header 值（用于请求） */
export function cookieHeader(): string {
  const parts: string[] = [];
  cookieStore.forEach((value, name) => {
    parts.push(`${name}=${value}`);
  });
  return parts.join('; ');
}

/** 获取指定 cookie（供调试/读取） */
export function getCookie(name: string): string | null {
  return cookieStore.get(name) ?? null;
}

/** 清空（登出时调用） */
export function clearCookies(): void {
  cookieStore.clear();
}
