// 统一 API 调用工具 — 封装 fetch + cookie + 配置
import { saveCookiesFromResponse, cookieHeader } from './cookies';

export const API_BASE = 'https://cloud.instlab.cn';

/** 带 HTTP 状态码的 API 错误：界面据此区分「登录失效」和普通失败 */
export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** 会话失效（需要重新登录） */
export function isUnauthorized(e: unknown): boolean {
  return e instanceof ApiError && (e.status === 401 || e.status === 403);
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  /** 请求时是否携带 cookie（默认 true） */
  withCredentials?: boolean;
}

/** 通用 API 请求 */
export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, withCredentials = true } = opts;

  const headers: Record<string, string> = {
    Origin: 'http://localhost:9000',
  };

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  if (withCredentials) {
    const cookie = cookieHeader();
    if (cookie) headers['Cookie'] = cookie;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // 保存响应中的 cookie
  if (withCredentials) {
    saveCookiesFromResponse(res.headers);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ApiError(
      `API ${method} ${path} 失败 (${res.status}): ${text.slice(0, 200)}`,
      res.status,
    );
  }

  // 尝试 JSON，否则返回文本
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return res.json() as Promise<T>;
  }
  return res.text() as unknown as Promise<T>;
}

/** GET 请求 */
export function get<T = unknown>(path: string) {
  return api<T>(path, { method: 'GET' });
}

/** POST 请求 */
export function post<T = unknown>(path: string, body?: unknown) {
  return api<T>(path, { method: 'POST', body });
}
