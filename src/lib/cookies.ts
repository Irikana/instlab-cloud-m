// Cookie 管理：RN fetch 不自动保存 cookie，需手动解析 Set-Cookie 并回传
// 服务器通过 Set-Cookie 种 token / captcha / session cookie，后续请求必须带上

export interface Cookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
}

const cookieStore: Map<string, string> = new Map();

/**
 * cookie 变化时的回调（登录成功后由 auth-store 注册，用来把会话写进 SecureStore）。
 * 放在这里是为了让 api.ts 每次收到 Set-Cookie 都能顺带持久化，不必层层回传。
 */
let onCookiesChanged: ((serialized: string) => void) | null = null;
export function setCookieListener(fn: ((serialized: string) => void) | null): void {
  onCookiesChanged = fn;
}

/** 从 Response headers 中解析 Set-Cookie 并保存 */
export function saveCookiesFromResponse(headers: Headers): void {
  const setCookies = headers.get('set-cookie')?.split(/,(?=\s*[a-zA-Z_][a-zA-Z0-9_]*=)/) ?? [];
  let changed = false;
  for (const sc of setCookies) {
    const parts = sc.split(';');
    const nv = parts[0].trim();
    const eq = nv.indexOf('=');
    if (eq > 0) {
      const name = nv.slice(0, eq).trim();
      const value = nv.slice(eq + 1).trim();
      if (name && value) {
        cookieStore.set(name, value);
        changed = true;
      }
    }
  }
  if (changed && onCookiesChanged) onCookiesChanged(cookieHeader());
}

/** 获取当前所有 cookie 的 Header 值（用于请求） */
export function cookieHeader(): string {
  const parts: string[] = [];
  cookieStore.forEach((value, name) => {
    parts.push(`${name}=${value}`);
  });
  return parts.join('; ');
}

/** 清空（登出时调用） */
export function clearCookies(): void {
  cookieStore.clear();
}

/**
 * 导出成可直接存放的 Cookie 头文本。
 * 服务器种的 token / session cookie 只在内存里，App 被系统回收后就没了；
 * 登录态却存在安全存储里，于是冷启动会出现「界面显示已登录、请求全是匿名」的假登录。
 */
export function serializeCookies(): string {
  return cookieHeader();
}

/** 从 Cookie 头文本恢复内存中的 cookie 表 */
export function restoreCookies(serialized: string | null): void {
  cookieStore.clear();
  if (!serialized) return;
  for (const pair of serialized.split(';')) {
    const nv = pair.trim();
    const eq = nv.indexOf('=');
    if (eq > 0) {
      const name = nv.slice(0, eq).trim();
      const value = nv.slice(eq + 1).trim();
      if (name && value) cookieStore.set(name, value);
    }
  }
}
