// 学期 + 日程 API — 获取学期列表与实验安排（PC 端 SchedulePage/MainPage 逻辑的手机端实现）
// 主 API：GET /api/terms?t=a  → 学期列表
//        GET /api/schedule?termid=X&collegeid=0&type=schedule → 实验/理论课日程（含 sch_date）
// 备用：  GET /api/sschedule?type=0&t=X&s={学号} → 学生实验安排（含 coursedatetime）
import { get } from './api';

export interface Term {
  id: string;
  name: string;
}

/** 规范化后的日程条目（与具体 API 返回解耦） */
export interface ScheduleEntry {
  schid: string;
  planid?: string;
  planexpid?: string;
  /** 规范化日期 YYYY-MM-DD */
  date: string;
  dateRaw?: string;
  title: string;
  /** 实验序号/编号 */
  expno?: string;
  time?: string;
  place?: string;
  teacher?: string;
  /** 类型标签：experiment | theory | duty | 未知 */
  kind: string;
  raw: Record<string, unknown>;
}

/** 星期标签 */
export const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

/** 把各种日期格式规范化为 YYYY-MM-DD（支持 2025/04/15、2025-04-15、时间戳、Date） */
export function normalizeDate(input: unknown): string {
  if (!input) return '';
  const s = String(input);
  // 时间戳
  if (/^\d{10,13}$/.test(s)) {
    const d = new Date(Number(s.length === 10 ? s + '000' : s));
    if (!isNaN(d.getTime())) return formatDate(d);
  }
  // 2025/04/15 或 2025-04-15 或带时间 "2025/04/15 14:00"
  const m = s.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return formatDate(d);
  return '';
}

export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 今天 YYYY-MM-DD */
export function todayStr(): string {
  return formatDate(new Date());
}

/** 从原始条目提取通用字段 */
function extractEntry(raw: Record<string, unknown>): ScheduleEntry | null {
  const schid = String(raw.schid ?? raw.id ?? raw.sch_id ?? '');
  const date = normalizeDate(raw.sch_date ?? raw.coursedatetime ?? raw.schdatetime ?? raw.date ?? raw.dates);
  if (!schid || !date) return null;

  const kindRaw = String(raw.sch_type ?? raw.type ?? raw.kind ?? raw.plan_type ?? '').toLowerCase();
  let kind = 'unknown';
  if (/duty|值日|clean/.test(kindRaw)) kind = 'duty';
  else if (/theory|th|理论/.test(kindRaw)) kind = 'theory';
  else if (/exp|lab|实验/.test(kindRaw) || !kindRaw) kind = 'experiment';

  return {
    schid,
    planid: raw.planid ? String(raw.planid) : undefined,
    planexpid: raw.planexpid ? String(raw.planexpid) : undefined,
    date,
    dateRaw: String(raw.sch_date ?? raw.coursedatetime ?? ''),
    title: String(raw.expname ?? raw.sch_title ?? raw.title ?? raw.coursename ?? raw.expno ?? '实验安排'),
    expno: raw.expno ? String(raw.expno) : undefined,
    time: String(raw.coursehour ?? raw.time ?? raw.course_time ?? ''),
    place: String(raw.labroom ?? raw.labname ?? raw.room ?? raw.place ?? ''),
    teacher: String(raw.teachername ?? raw.teacher ?? raw.teacherName ?? ''),
    kind,
    raw,
  };
}

/** 获取学期列表 */
export async function fetchTermList(): Promise<Term[]> {
  const r = await get<{ list_data?: Term[] }>('/api/terms?t=a');
  return r.list_data ?? [];
}

/** 获取日程条目：主 API /api/schedule，失败回退 /api/sschedule */
export async function fetchScheduleEntries(termId: string, userId: string): Promise<ScheduleEntry[]> {
  // 主 API（带 sch_date，最贴合日历）
  try {
    const r = await get<{ list_data?: unknown[] }>(
      `/api/schedule?termid=${encodeURIComponent(termId)}&collegeid=0&type=schedule`,
    );
    const list = r.list_data ?? [];
    if (list.length > 0) {
      const entries = list
        .map((it) => extractEntry(it as Record<string, unknown>))
        .filter((e): e is ScheduleEntry => e !== null);
      if (entries.length > 0) return entries;
    }
  } catch {
    // 继续尝试备用 API
  }

  // 备用 API（学生实验安排）
  try {
    const r = await get<{ list_data?: unknown[] }>(
      `/api/sschedule?type=0&t=${encodeURIComponent(termId)}&s=${encodeURIComponent(userId)}`,
    );
    const list = r.list_data ?? [];
    return list
      .map((it) => extractEntry(it as Record<string, unknown>))
      .filter((e): e is ScheduleEntry => e !== null);
  } catch {
    return [];
  }
}

/** 类型 → 中文标签 */
export function kindLabel(kind: string): string {
  switch (kind) {
    case 'experiment':
      return '实验';
    case 'theory':
      return '理论课';
    case 'duty':
      return '值日';
    default:
      return '安排';
  }
}
