// 学期 + 日程 API — 获取学期列表与实验安排（PC 端 SchedulePage/MainPage 逻辑的手机端实现）
// 主 API：GET /api/term  → 学期列表（注意是单数 term，不是 terms！）
//        GET /api/schedule?termid=X&collegeid=0&type=schedule → 实验日程（返回数组，含 sch_date）
//        GET /api/scheduleth?termid=X&collegeid=0&type=schedule → 理论课日程
import { get } from './api';

export interface Term {
  id: string;
  name: string;
  /** 服务器原样给的学期对象，起止日期等附加字段从这里头找 */
  raw?: Record<string, unknown>;
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
  /** 是否已被批过（mark1..mark5 任一非空；各项含义无依据，不猜具体分数） */
  marked?: boolean;
  /** 起始周 / 结束周；服务器没给、也推不出来时保持 undefined */
  weekFrom?: number;
  weekTo?: number;
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

/**
 * 从原始条目提取通用字段。
 * @param srcKind 来源接口给出的类型：日程条目里没有任何类型字段（实测 raw 只有
 * sch_date/sch_time 这些），实验与理论课的区分只存在于它是哪个接口返回的，
 * 所以必须由调用方告知，不能靠猜——之前全部落到 experiment，
 * 结果课程表里理论课也被标成橙色，蓝色标注永远出不来。
 */
export function extractEntry(raw: Record<string, unknown>, srcKind?: string): ScheduleEntry | null {
  const schid = String(raw.schid ?? raw.id ?? raw.sch_id ?? '');
  const date = normalizeDate(raw.sch_date ?? raw.coursedatetime ?? raw.schdatetime ?? raw.date ?? raw.dates);
  if (!schid || !date) return null;

  const kindRaw = String(raw.sch_type ?? raw.type ?? raw.kind ?? raw.plan_type ?? '').toLowerCase();
  let kind = srcKind ?? 'unknown';
  if (/duty|值日|clean/.test(kindRaw) || raw.dutystatus === 1) kind = 'duty';
  else if (/theory|th|理论/.test(kindRaw)) kind = 'theory';
  else if (/exp|lab|实验/.test(kindRaw)) kind = 'experiment';

  return {
    schid,
    planid: raw.planid ? String(raw.planid) : undefined,
    planexpid: raw.planexpid ? String(raw.planexpid) : undefined,
    expid: raw.expid ? String(raw.expid) : undefined,
    date,
    dateRaw: String(raw.sch_date ?? raw.coursedatetime ?? ''),
    title: String(raw.expname ?? raw.sch_title ?? raw.title ?? raw.coursename ?? raw.expno ?? '实验安排'),
    expno: raw.expno ? String(raw.expno) : (raw.expnumber ? String(raw.expnumber) : undefined),
    coursename: raw.coursename ? String(raw.coursename) : undefined,
    coursenumber: raw.coursenumber ? String(raw.coursenumber) : undefined,
    time: String(raw.coursehour ?? raw.time ?? raw.course_time ?? raw.sch_time ?? ''),
    place: String(raw.labroom ?? raw.labname ?? raw.roomname ?? raw.room ?? raw.place ?? raw.site ?? raw.address ?? ''),
    teacher: String(raw.teachername ?? raw.teacher ?? raw.teacherName ?? ''),
    issigned: raw.time_signin != null || raw.signin_time != null || raw.issigned === true || raw.signed === true || raw.signined === true,
    isdata: raw.time_datapaper != null || raw.isdata === true,
    isreport: raw.time_report != null || raw.isreport === true,
    dutystatus: raw.dutystatus === 1 || raw.dutystatus === true || raw.dutystatus === '1',
    // 真实响应里没有单一的 mark 字段，是 mark1..mark5 + premark/reportmark；
    // 各个 mark 的语义没有依据，界面只报"有成绩"而不猜它是哪一项
    mark: raw.mark !== undefined ? (raw.mark as string | number) : undefined,
    marked: raw.mark1 != null || raw.mark2 != null || raw.mark3 != null || raw.mark4 != null || raw.mark5 != null,
    weekFrom: pickWeek(raw, WEEK_FROM_KEYS) ?? pickWeek(raw, WEEK_ONE_KEYS),
    weekTo: pickWeek(raw, WEEK_TO_KEYS) ?? pickWeek(raw, WEEK_ONE_KEYS),
    kind,
    raw,
  };
}

// 周次字段名没有文档可查，按几种常见写法试；全都没有时改用学期起始日推算
const WEEK_FROM_KEYS = ['startweek', 'start_week', 'weekfrom', 'week_from', 'beginweek', 'begin_week', 'sweek', 'startno', 'zhoustart'];
const WEEK_TO_KEYS = ['endweek', 'end_week', 'weekto', 'week_to', 'finweek', 'endno', 'zhouend'];
const WEEK_ONE_KEYS = ['week', 'schweek', 'sch_week', 'weekno', 'weeknum', 'weekindex', 'zweek', 'zhou'];

function toWeek(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 && n < 60 ? n : undefined;
}

function pickWeek(raw: Record<string, unknown>, keys: string[]): number | undefined {
  for (const k of keys) {
    const n = toWeek(raw[k]);
    if (n !== undefined) return n;
  }
  return undefined;
}

/** 学期起始日：真实字段是 date_start / date_end（ISO UTC 串），候选名一并容错 */
const TERM_START_KEYS = ['date_start', 'start_date', 'startdate', 'start_time', 'starttime', 'begin_date', 'begindate', 'begin_time', 'sdate', 'start'];
const TERM_END_KEYS = ['date_end', 'end_date', 'enddate', 'end_time', 'endtime', 'finish_date', 'finishdate', 'edate', 'end'];

/** 学期对象的附加字段来源：既看 fetchTermList 挂上的 raw，也看学期对象本身 */
function termExtras(t: Term): Record<string, unknown> {
  return { ...(t as unknown as Record<string, unknown>), ...(t.raw ?? {}) };
}

function pickTermDate(t: Term, keys: string[]): number | null {
  const src = termExtras(t);
  for (const k of keys) {
    const v = src[k];
    if (v === undefined || v === null || v === '') continue;
    const ms = Date.parse(String(v));
    if (!isNaN(ms)) return ms;
  }
  return null;
}

export function termStartDate(t: Term): number | null {
  return pickTermDate(t, TERM_START_KEYS);
}

export function termEndDate(t: Term): number | null {
  return pickTermDate(t, TERM_END_KEYS);
}

/** 第a-b周 / 第a周；一个周次都没有时返回空串（由界面决定不显示，而不是编一个） */
export function weeksLabel(weeks: number[]): string {
  const uniq = [...new Set(weeks.filter((w) => Number.isFinite(w) && w > 0))].sort((a, b) => a - b);
  if (uniq.length === 0) return '';
  if (uniq.length === 1) return `第${uniq[0]}周`;
  const contig = uniq[uniq.length - 1] - uniq[0] === uniq.length - 1;
  if (contig) return `第${uniq[0]}-${uniq[uniq.length - 1]}周`;
  return `第${uniq.join('、')}周`;
}

/** 由学期起始日推算某个上课日期是第几周（第 1 周 = 起始日所在周） */
export function weekOfTerm(date: string, termStartMs: number): number | undefined {
  const ms = Date.parse(date + 'T00:00:00');
  if (isNaN(ms)) return undefined;
  const start = new Date(termStartMs);
  start.setHours(0, 0, 0, 0);
  // 按"日历周"对齐到周一，避免学期中间开课就少算一周
  const monday = new Date(start);
  monday.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const w = Math.floor((ms - monday.getTime()) / (7 * 24 * 3600 * 1000)) + 1;
  return w >= 1 && w < 60 ? w : undefined;
}

/** 获取学期列表：GET /api/term（PC 端 SchedulePage 用 $api.get('/api/term')，返回数组） */
export async function fetchTermList(): Promise<Term[]> {
  const r = await get<Term[] | { list_data?: Term[] }>('/api/term');
  const list = Array.isArray(r) ? r : (r.list_data ?? []);
  // 留一份原样对象：起止日期等附加字段只在 raw 里找得到
  return list.map((t) => ({ ...t, raw: t as unknown as Record<string, unknown> }));
}

/**
 * 获取日程条目：/api/schedule + /api/scheduleth（PC 端返回数组 e.data）
 * @param termStartMs 学期起始日毫秒值；服务器没直接给周次时用它按日历周推算
 */
export async function fetchScheduleEntries(termId: string, termStartMs?: number | null): Promise<ScheduleEntry[]> {
  const entries: ScheduleEntry[] = [];
  const params = `termid=${encodeURIComponent(termId)}&collegeid=0&type=schedule`;

  const collect = async (path: string, srcKind: string) => {
    const r = await get<unknown[] | { list_data?: unknown[] }>(path);
    const list = Array.isArray(r) ? (r as unknown[]) : (r as { list_data?: unknown[] }).list_data ?? [];
    entries.push(...list
      .map((it) => extractEntry(it as Record<string, unknown>, srcKind))
      .filter((e): e is ScheduleEntry => e !== null));
  };

  // 两个日程接口分别对应实验与理论课；只有一个可用是正常情况（例如学生账号没有理论课），
  // 但两个都失败时必须把错误抛出去——否则界面只会显示一张空白日历，看不出是没登录。
  const results = await Promise.allSettled([
    collect(`/api/schedule?${params}`, 'experiment'),
    collect(`/api/scheduleth?${params}`, 'theory'),
  ]);
  if (results.every((r) => r.status === 'rejected')) {
    const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    throw failed.reason instanceof Error ? failed.reason : new Error('日程加载失败');
  }

  // 服务器没直接给周次时，用学期起始日按日历周推算；推不出就不显示周次，不编一个数
  if (termStartMs) {
    for (const e of entries) {
      if (e.weekFrom === undefined) e.weekFrom = weekOfTerm(e.date, termStartMs);
      if (e.weekTo === undefined) e.weekTo = e.weekFrom;
    }
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
