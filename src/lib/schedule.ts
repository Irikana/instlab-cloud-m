// 学期 + 日程 API — 获取学期列表与实验安排（PC 端 SchedulePage/MainPage 逻辑的手机端实现）
// 主 API：GET /api/term  → 学期列表（注意是单数 term，不是 terms！）
//        GET /api/schedule?termid=X&collegeid=0&type=schedule → 实验日程（返回数组，含 sch_date）
//        GET /api/scheduleth?termid=X&collegeid=0&type=schedule → 理论课日程
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
  expid?: string;
  /** 规范化日期 YYYY-MM-DD */
  date: string;
  dateRaw?: string;
  title: string;
  /** 实验序号/编号 */
  expno?: string;
  /** 课程名称 */
  coursename?: string;
  /** 课程编号 */
  coursenumber?: string;
  time?: string;
  place?: string;
  teacher?: string;
  /** 状态：签到/交数据/交报告（PC 端 issigned/isdata/isreport） */
  issigned?: boolean;
  isdata?: boolean;
  isreport?: boolean;
  /** 值日（PC 端 dutystatus==1 显示橙色「值日」badge） */
  dutystatus?: boolean;
  /** 成绩（教师评分） */
  mark?: string | number;
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
  // 带时间/时区的日期必须先按本地时间解析，避免 UTC 时间被截断为前一天。
  if (/[T ]\d{1,2}:\d{2}/.test(s) || /Z$|[+-]\d{2}:?\d{2}$/.test(s)) {
    const timed = new Date(s);
    if (!isNaN(timed.getTime())) return formatDate(timed);
  }
  // 2025/04/15 或 2025-04-15：日期-only 字符串按字面年月日处理，不经过时区转换。
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
    expid: raw.expid ? String(raw.expid) : undefined,
    date,
    dateRaw: String(raw.sch_date ?? raw.coursedatetime ?? ''),
    title: String(raw.expname ?? raw.sch_title ?? raw.title ?? raw.coursename ?? raw.expno ?? '实验安排'),
    expno: raw.expno ? String(raw.expno) : undefined,
    coursename: raw.coursename ? String(raw.coursename) : undefined,
    coursenumber: raw.coursenumber ? String(raw.coursenumber) : undefined,
    time: String(raw.coursehour ?? raw.time ?? raw.course_time ?? raw.sch_time ?? ''),
    place: String(raw.labroom ?? raw.labname ?? raw.room ?? raw.place ?? ''),
    teacher: String(raw.teachername ?? raw.teacher ?? raw.teacherName ?? ''),
    issigned: raw.time_signin != null || raw.issigned === true || raw.signed === true || raw.signined === true,
    isdata: raw.time_datapaper != null || raw.isdata === true,
    isreport: raw.time_report != null || raw.isreport === true,
    dutystatus: raw.dutystatus === 1 || raw.dutystatus === true || raw.dutystatus === '1',
    mark: raw.mark !== undefined ? (raw.mark as string | number) : undefined,
    kind,
    raw,
  };
}

/** 获取学期列表：GET /api/term（PC 端 SchedulePage 用 $api.get('/api/term')，返回数组） */
export async function fetchTermList(): Promise<Term[]> {
  const r = await get<Term[] | { list_data?: Term[] }>('/api/term');
  if (Array.isArray(r)) return r as Term[];
  return (r as { list_data?: Term[] }).list_data ?? [];
}

/** 获取日程条目：/api/schedule + /api/scheduleth（PC 端返回数组 e.data），失败返回空 */
export async function fetchScheduleEntries(termId: string, userId: string): Promise<ScheduleEntry[]> {
  const entries: ScheduleEntry[] = [];
  const params = `termid=${encodeURIComponent(termId)}&collegeid=0&type=schedule`;

  // 实验日程 /api/schedule
  try {
    const r = await get<unknown[] | { list_data?: unknown[] }>(
      `/api/schedule?${params}`,
    );
    const list = Array.isArray(r) ? (r as unknown[]) : (r as { list_data?: unknown[] }).list_data ?? [];
    entries.push(...list
      .map((it) => extractEntry(it as Record<string, unknown>))
      .filter((e): e is ScheduleEntry => e !== null));
  } catch {
    // 忽略，继续理论课
  }

  // 理论课日程 /api/scheduleth
  try {
    const r = await get<unknown[] | { list_data?: unknown[] }>(
      `/api/scheduleth?${params}`,
    );
    const list = Array.isArray(r) ? (r as unknown[]) : (r as { list_data?: unknown[] }).list_data ?? [];
    entries.push(...list
      .map((it) => extractEntry(it as Record<string, unknown>))
      .filter((e): e is ScheduleEntry => e !== null));
  } catch {
    // 忽略
  }

  return entries;
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
