// 统一 API 调用工具 — 封装 fetch + cookie + 配置
import { saveCookiesFromResponse, cookieHeader } from './cookies';

const API_BASE = 'https://cloud.instlab.cn';

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
    throw new Error(`API ${method} ${path} 失败 (${res.status}): ${text.slice(0, 200)}`);
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

// ========== API 响应类型定义 ==========

/** 学期 */
export interface Term {
  id: string;
  name: string;
  // 可能还有其他字段
}

/** 实验/日程安排（来自 /api/schedule） */
export interface ScheduleItem {
  id?: string;       // schid（部分 API 用 id）
  schid?: string;    // schid
  planid?: string;
  planexpid?: string;
  sch_date?: string; // "2025/04/15"
  expno?: string;    // 实验序号
  expname?: string;  // 实验名称
  coursename?: string; // 课程名称
  teachername?: string; // 教师
  coursehour?: string; // 课时
  labroom?: string;  // 实验室房间
  labname?: string;  // 实验室名称
  time_signin?: string | null;  // 签到时间
  time_datapaper?: string | null;
  time_report?: string | null;
  groupname?: string;
  /** 值日/其他标识：来自 /api/schedule 的可能字段 */
  sch_type?: string; // "theory" | "experiment" | "duty" 等
  sch_title?: string;
}

/** 作业纸下载响应 */
export interface PaperWorkResponse {
  filetypeid: string;
  filetype: string;
  data: Record<string, unknown>;
  html: string;         // HTML 模板
  h2pargs: string[];    // wkhtmltopdf 参数
  titlelogo: string;
}

/** 学期列表响应 */
export interface TermsResponse {
  list_data: Term[];
}