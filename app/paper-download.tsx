// 作业纸下载（核心功能）
// 两种模式：
//   1. 日历查看：选择日期 → 显示该日实验/理论/值日安排 → 下载作业纸 PDF
//   2. 实验ID：直接输入 schid 下载（测试用，PC 端隐藏入口）
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuthStore } from '../src/store/auth-store';
import { SPACING, useTheme, type Palette, CALENDAR_COLORS } from '../src/theme';
import {
  fetchScheduleEntries,
  fetchTermList,
  formatDate,
  kindLabel,
  todayStr,
  WEEK_LABELS,
  type ScheduleEntry,
} from '../src/lib/schedule';
import { downloadPaperPdf, downloadPaperHtml, type PaperKind } from '../src/lib/paper';

type Mode = 'calendar' | 'schid';

const pad2 = (n: number) => String(n).padStart(2, '0');

export default function PaperDownloadScreen() {
  const { colors } = useTheme();
  const s = createStyles(colors);
  const login = useAuthStore((st) => st.login);
  const userName = useAuthStore((st) => st.userName);
  const userRole = useAuthStore((st) => st.userRole);
  const univer = useAuthStore((st) => st.univer);

  // 模式
  const [mode, setMode] = useState<Mode>('calendar');

  // 日历状态
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState(todayStr());

  // 数据
  const [entriesByDate, setEntriesByDate] = useState<Map<string, ScheduleEntry[]>>(new Map());
  const [termName, setTermName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  // schid 测试模式
  const [scheduleId, setScheduleId] = useState('');

  /** 加载学期 + 全部日程 */
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const terms = await fetchTermList();
      if (!terms.length) throw new Error('未获取到学期列表，请检查登录状态');
      const term = terms[0];
      setTermName(term.name ?? '');
      const entries = await fetchScheduleEntries(term.id, login ?? '');
      const map = new Map<string, ScheduleEntry[]>();
      for (const e of entries) {
        const arr = map.get(e.date) ?? [];
        arr.push(e);
        map.set(e.date, arr);
      }
      setEntriesByDate(map);
      // 若今天无安排，跳到第一个有安排的日期
      if (!map.has(selectedDate) && map.size > 0) {
        const first = [...map.keys()].sort()[0];
        setSelectedDate(first);
        const d = new Date(first + 'T00:00:00');
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [login, selectedDate]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 有安排的日期 → 事件颜色类型（PC 端规则：实验=orange、理论=blue、都有=purple） */
  const dateColors = useMemo(() => {
    const map = new Map<string, 'orange' | 'blue' | 'purple'>();
    entriesByDate.forEach((entries, date) => {
      const hasExp = entries.some((e) => e.kind === 'experiment');
      const hasTheory = entries.some((e) => e.kind === 'theory' || e.kind === 'duty');
      if (hasExp && hasTheory) map.set(date, 'purple');
      else if (hasExp) map.set(date, 'orange');
      else if (hasTheory) map.set(date, 'blue');
    });
    return map;
  }, [entriesByDate]);

  /** 当前查看月的日历格子（null 表示空白） */
  const cells = useMemo(() => {
    const startWeekday = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const arr: (number | null)[] = [];
    for (let i = 0; i < startWeekday; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [viewYear, viewMonth]);

  /** 选中日期的安排 */
  const selectedEntries = entriesByDate.get(selectedDate) ?? [];

  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };
  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const selectDate = (day: number) => {
    setSelectedDate(`${viewYear}-${pad2(viewMonth + 1)}-${pad2(day)}`);
  };

  /** 日历格子上的日期 key */
  const dateKeyOf = (day: number) => `${viewYear}-${pad2(viewMonth + 1)}-${pad2(day)}`;

  /** 下载作业纸（从日程条目） */
  const handleEntryDownload = async (entry: ScheduleEntry, kind: PaperKind, fmt: 'pdf' | 'html' = 'pdf') => {
    const key = `${entry.schid}-${kind}-${fmt}`;
    setDownloadingKey(key);
    try {
      // PC 端 Download_Paper_Work(r) 传的是整个日程条目对象 r（含 schid/planid/planexpid/expid/
      // coursename/sch_date 等全部字段），不是只传 schid —— 服务器需要完整条目来生成作业纸内容
      const schData: Record<string, unknown> = {
        ...entry.raw,
        schid: entry.schid,
        planid: entry.planid ?? '',
        planexpid: entry.planexpid ?? '',
        // 日期用 PC 端格式 YYYY/MM/DD（作业布置/实验安排日期，而非下载当天）
        sch_date: entry.date.replace(/-/g, '/'),
        // 当前登录学生信息（服务器模板里的班级/学号/姓名需要这些）
        userid: login ?? '',
        stdid: login ?? '',
        studentid: login ?? '',
        studentname: userName ?? '',
        name: userName ?? '',
        univer: univer ?? '',
      };
      const label = kind === 'work' ? '空白作业纸' : '批改后作业纸';
      const fileName = `${label}_${entry.title}_${entry.date}.${fmt}`;
      if (fmt === 'html') {
        const res = await downloadPaperHtml(kind, schData, fileName);
        Alert.alert(
          'HTML 已生成',
          res.shared
            ? '请在系统分享面板中选择保存位置。\n\n' + res.uri
            : '文件已生成：\n' + res.uri,
        );
      } else {
        const res = await downloadPaperPdf(kind, schData, fileName);
        Alert.alert(
          'PDF 已生成',
          res.shared
            ? '请在系统分享面板中选择保存位置。\n\n' + res.uri
            : '文件已生成：\n' + res.uri,
        );
      }
    } catch (e) {
      Alert.alert('下载失败', (e as Error).message);
    } finally {
      setDownloadingKey(null);
    }
  };

  /** 下载作业纸（schid 测试模式） */
  const handleSchidDownload = async (kind: PaperKind, fmt: 'pdf' | 'html' = 'pdf') => {
    const id = scheduleId.trim();
    if (!id) {
      Alert.alert('提示', '请输入实验安排ID（schid）');
      return;
    }
    setDownloadingKey('schid-' + kind + '-' + fmt);
    try {
      const label = kind === 'work' ? '空白作业纸' : '批改后作业纸';
      const fileName = `${label}_${id}.${fmt}`;
      if (fmt === 'html') {
        const res = await downloadPaperHtml(kind, { schid: id }, fileName);
        Alert.alert(
          'HTML 已生成',
          res.shared
            ? '请在系统分享面板中选择保存位置。\n\n' + res.uri
            : '文件已生成：\n' + res.uri,
        );
      } else {
        const res = await downloadPaperPdf(kind, { schid: id }, fileName);
        Alert.alert(
          'PDF 已生成',
          res.shared
            ? '请在系统分享面板中选择保存位置。\n\n' + res.uri
            : '文件已生成：\n' + res.uri,
        );
      }
    } catch (e) {
      Alert.alert('下载失败', (e as Error).message);
    } finally {
      setDownloadingKey(null);
    }
  };

  const selectedDateLabel = (() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    return `${y}年${m}月${d}日`;
  })();

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* 模式切换 */}
      <View style={s.tabs}>
        <Pressable
          style={[s.tab, mode === 'calendar' && s.tabActive]}
          onPress={() => setMode('calendar')}
        >
          <Text style={[s.tabText, mode === 'calendar' && s.tabTextActive]}>日历查看</Text>
        </Pressable>
        <Pressable
          style={[s.tab, mode === 'schid' && s.tabActive]}
          onPress={() => setMode('schid')}
        >
          <Text style={[s.tabText, mode === 'schid' && s.tabTextActive]}>实验ID</Text>
        </Pressable>
      </View>

      {mode === 'calendar' ? (
        <>
          {/* 学期 + 刷新 */}
          <View style={s.termBar}>
            <Text style={s.termText} numberOfLines={1}>
              {termName ? '学期：' + termName : '加载学期中…'}
            </Text>
            <Pressable style={s.refreshBtn} onPress={load} disabled={loading}>
              <Text style={s.refreshText}>刷新</Text>
            </Pressable>
          </View>

          {/* 日历 */}
          <View style={s.calendar}>
            <View style={s.calHeader}>
              <Pressable style={s.calNav} onPress={goPrevMonth}>
                <Text style={s.calNavText}>‹</Text>
              </Pressable>
              <Text style={s.calTitle}>
                {viewYear}年{viewMonth + 1}月
              </Text>
              <Pressable style={s.calNav} onPress={goNextMonth}>
                <Text style={s.calNavText}>›</Text>
              </Pressable>
              <Pressable
                style={s.todayBtn}
                onPress={() => {
                  const t = todayStr();
                  setSelectedDate(t);
                  const d = new Date();
                  setViewYear(d.getFullYear());
                  setViewMonth(d.getMonth());
                }}
              >
                <Text style={s.todayText}>今天</Text>
              </Pressable>
            </View>

            <View style={s.weekRow}>
              {WEEK_LABELS.map((w, i) => (
                <Text key={w + i} style={[s.weekLabel, (i === 0 || i === 6) && s.weekendLabel]}>
                  {w}
                </Text>
              ))}
            </View>

            <View style={s.grid}>
              {cells.map((day, idx) => {
                if (day === null) return <View key={'e' + idx} style={s.dayCell} />;
                const dk = dateKeyOf(day);
                const isSelected = dk === selectedDate;
                const isToday = dk === todayStr();
                const evColor = dateColors.get(dk);
                return (
                  <Pressable key={dk} style={s.dayCell} onPress={() => selectDate(day)}>
                    <View
                      style={[
                        s.dayCircle,
                        evColor === 'orange' && s.dayCircleOrange,
                        evColor === 'blue' && s.dayCircleBlue,
                        evColor === 'purple' && s.dayCirclePurple,
                        isToday && !isSelected && s.dayCircleToday,
                        isSelected && s.dayCircleSelected,
                      ]}
                    >
                      <Text style={[s.dayNum, (evColor || isSelected) && s.dayNumOnColor]}>{day}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 选中日期安排列表 */}
          <View style={s.listHeader}>
            <Text style={s.listTitle}>
              {selectedDateLabel} · {selectedEntries.length > 0 ? selectedEntries.length + ' 项安排' : '无安排'}
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={colors.accent} style={{ marginVertical: SPACING.xl }} />
          ) : error ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyTitle}>加载失败</Text>
              <Text style={s.emptyText}>{error}</Text>
              <Pressable style={s.retryBtn} onPress={load}>
                <Text style={s.retryText}>重试</Text>
              </Pressable>
            </View>
          ) : selectedEntries.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyTitle}>当天没有安排</Text>
              <Text style={s.emptyText}>日历上带圆点的日期有实验、理论课或值日安排。</Text>
            </View>
          ) : (
            selectedEntries.map((entry) => {
              const busy = downloadingKey !== null;
              return (
                <View key={entry.schid} style={s.entryCard}>
                  <View style={s.entryTop}>
                    <View style={[s.kindBadge, entry.kind === 'duty' && s.kindBadgeDuty, entry.kind === 'theory' && s.kindBadgeTheory]}>
                      <Text style={s.kindBadgeText}>{kindLabel(entry.kind)}</Text>
                    </View>
                    {entry.expno ? <Text style={s.expno}>{entry.expno}</Text> : null}
                  </View>
                  <Text style={s.entryTitle}>{entry.title}</Text>
                  {entry.coursename && (
                    <Text style={s.entryMeta}>
                      {[entry.coursenumber, entry.coursename].filter(Boolean).join(' ')}
                    </Text>
                  )}
                  {(entry.time || entry.place) && (
                    <Text style={s.entryMeta}>
                      {[entry.time, entry.place].filter(Boolean).join(' · ')}
                    </Text>
                  )}
                  {entry.teacher ? <Text style={s.entryMeta}>教师：{entry.teacher}</Text> : null}
                  {(entry.issigned || entry.isdata || entry.isreport || entry.dutystatus || entry.mark !== undefined) && (
                    <View style={s.statusRow}>
                      {entry.dutystatus && <Text style={[s.statusBadge, s.statusDuty]}>值日</Text>}
                      {entry.issigned && <Text style={[s.statusBadge, s.statusOk]}>已签到</Text>}
                      {entry.isdata && <Text style={[s.statusBadge, s.statusOk]}>已交数据</Text>}
                      {entry.isreport && <Text style={[s.statusBadge, s.statusOk]}>已交报告</Text>}
                      {entry.mark !== undefined && entry.mark !== null && entry.mark !== '' && (
                        <Text style={[s.statusBadge, s.statusMark]}>成绩：{entry.mark}</Text>
                      )}
                    </View>
                  )}

                  <View style={s.entryActions}>
                    <Pressable
                      style={[s.dlBtn, (busy || downloadingKey === `${entry.schid}-work-pdf`) && s.btnDisabled]}
                      disabled={busy}
                      onPress={() => handleEntryDownload(entry, 'work', 'pdf')}
                    >
                      {downloadingKey === `${entry.schid}-work-pdf` ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={s.dlBtnText}>空白PDF</Text>
                      )}
                    </Pressable>
                    <Pressable
                      style={[s.dlBtnSecondary, (busy || downloadingKey === `${entry.schid}-workcorr-pdf`) && s.btnDisabled]}
                      disabled={busy}
                      onPress={() => handleEntryDownload(entry, 'workcorr', 'pdf')}
                    >
                      {downloadingKey === `${entry.schid}-workcorr-pdf` ? (
                        <ActivityIndicator size="small" color={colors.accent} />
                      ) : (
                        <Text style={s.dlBtnSecondaryText}>批改PDF</Text>
                      )}
                    </Pressable>
                    <Pressable
                      style={[s.dlBtnOutline, (busy || downloadingKey === `${entry.schid}-work-html`) && s.btnDisabled]}
                      disabled={busy}
                      onPress={() => handleEntryDownload(entry, 'work', 'html')}
                    >
                      {downloadingKey === `${entry.schid}-work-html` ? (
                        <ActivityIndicator size="small" color={colors.textSecondary} />
                      ) : (
                        <Text style={s.dlBtnOutlineText}>原始HTML</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </>
      ) : (
        /* ===== schid 测试模式 ===== */
        <>
          <View style={s.infoBox}>
            <Text style={s.infoTitle}>实验ID 模式（测试用）</Text>
            <Text style={s.infoText}>
              直接输入实验安排ID（schid）下载对应作业纸。PC 端隐藏入口，仅用于验证猜想。
            </Text>
          </View>

          <Text style={s.label}>实验安排 ID</Text>
          <TextInput
            style={s.input}
            value={scheduleId}
            onChangeText={setScheduleId}
            placeholder="请输入 schid..."
            placeholderTextColor={colors.textLight}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="number-pad"
          />

          <View style={s.schidRow}>
            <Pressable
              style={[s.actionBtn, { flex: 1 }, downloadingKey !== null && s.btnDisabled]}
              disabled={downloadingKey !== null}
              onPress={() => handleSchidDownload('work', 'pdf')}
            >
              {downloadingKey === 'schid-work-pdf' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.actionBtnText}>空白PDF</Text>
              )}
            </Pressable>
            <Pressable
              style={[s.actionBtnSecondary, { flex: 1 }, downloadingKey !== null && s.btnDisabled]}
              disabled={downloadingKey !== null}
              onPress={() => handleSchidDownload('workcorr', 'pdf')}
            >
              {downloadingKey === 'schid-workcorr-pdf' ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Text style={s.actionBtnSecondaryText}>批改PDF</Text>
              )}
            </Pressable>
          </View>

          <View style={s.schidRow}>
            <Pressable
              style={[s.actionBtnOutline, { flex: 1 }, downloadingKey !== null && s.btnDisabled]}
              disabled={downloadingKey !== null}
              onPress={() => handleSchidDownload('work', 'html')}
            >
              {downloadingKey === 'schid-work-html' ? (
                <ActivityIndicator size="small" color={colors.textSecondary} />
              ) : (
                <Text style={s.actionBtnOutlineText}>空白HTML</Text>
              )}
            </Pressable>
            <Pressable
              style={[s.actionBtnOutline, { flex: 1 }, downloadingKey !== null && s.btnDisabled]}
              disabled={downloadingKey !== null}
              onPress={() => handleSchidDownload('workcorr', 'html')}
            >
              {downloadingKey === 'schid-workcorr-html' ? (
                <ActivityIndicator size="small" color={colors.textSecondary} />
              ) : (
                <Text style={s.actionBtnOutlineText}>批改HTML</Text>
              )}
            </Pressable>
          </View>

          <View style={s.tipBox}>
            <Text style={s.tipTitle}>调试信息</Text>
            <Text style={s.tipText}>用户：{userName || '?'} ｜ 学号：{login ?? '?'} ｜ role：{userRole ?? '?'}</Text>
          </View>

          <View style={[s.tipBox, { marginTop: SPACING.sm }]}>
            <Text style={s.tipTitle}>API 说明</Text>
            <Text style={s.tipText}>• POST /api/paper/work {`{ type: 8, data: { schid } }`}</Text>
            <Text style={s.tipText}>• POST /api/paper/workcorr {`{ type: 82, data: { schid } }`}</Text>
            <Text style={s.tipText}>• 返回 JSON：{`{ html, data, h2pargs, titlelogo }`}</Text>
            <Text style={s.tipText}>• 手机端：渲染 HTML → expo-print 生成 PDF → 系统分享保存</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bgSubtle },
    content: { padding: SPACING.md, paddingBottom: SPACING.xl },

    // 模式切换
    tabs: { flexDirection: 'row', marginBottom: SPACING.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg },
    tab: { flex: 1, paddingVertical: SPACING.sm + 2, alignItems: 'center' },
    tabActive: { backgroundColor: COLORS.accent },
    tabText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },
    tabTextActive: { color: '#fff' },

    // 学期栏
    termBar: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.sm },
    termText: { flex: 1, fontSize: 13, color: COLORS.textSecondary },
    refreshBtn: { borderWidth: 1, borderColor: COLORS.accent, paddingHorizontal: SPACING.md, paddingVertical: 4 },
    refreshText: { fontSize: 13, color: COLORS.accent, fontWeight: '600' },

    // 日历
    calendar: {
      backgroundColor: COLORS.bg,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: SPACING.sm,
      marginBottom: SPACING.md,
    },
    calHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACING.sm,
    },
    calNav: {
      width: 36,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bgMuted,
    },
    calNavText: { fontSize: 20, color: COLORS.accent, lineHeight: 22 },
    calTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: COLORS.text },
    todayBtn: {
      marginLeft: SPACING.xs,
      borderWidth: 1,
      borderColor: COLORS.accent,
      paddingHorizontal: SPACING.sm,
      paddingVertical: 4,
    },
    todayText: { fontSize: 12, color: COLORS.accent, fontWeight: '600' },
    weekRow: { flexDirection: 'row', marginBottom: 2 },
    weekLabel: { width: '14.28%', textAlign: 'center', fontSize: 12, color: COLORS.textLight, paddingVertical: 4 },
    weekendLabel: { color: COLORS.danger },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    dayCell: { width: '14.28%', alignItems: 'center', paddingVertical: 2 },
    dayCircle: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // PC 端日历事件色：实验=orange、理论=blue、都有=purple
    dayCircleOrange: { backgroundColor: CALENDAR_COLORS.experiment },
    dayCircleBlue: { backgroundColor: CALENDAR_COLORS.homework },
    dayCirclePurple: { backgroundColor: CALENDAR_COLORS.all },
    dayCircleSelected: { borderWidth: 2, borderColor: COLORS.accent, backgroundColor: COLORS.accent },
    dayCircleToday: { borderWidth: 1.5, borderColor: COLORS.accent },
    dayNum: { fontSize: 14, color: COLORS.text },
    dayNumOnColor: { color: '#fff', fontWeight: '700' },

    // 列表
    listHeader: { marginBottom: SPACING.sm },
    listTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },

    entryCard: {
      backgroundColor: COLORS.bg,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: SPACING.md,
      marginBottom: SPACING.sm,
    },
    entryTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    kindBadge: {
      backgroundColor: COLORS.successBg,
      borderWidth: 1,
      borderColor: COLORS.success,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 3,
    },
    kindBadgeDuty: { backgroundColor: COLORS.infoBg, borderColor: COLORS.accentLight },
    kindBadgeTheory: { backgroundColor: COLORS.warning + '18', borderColor: COLORS.warning },
    kindBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.success },
    expno: { marginLeft: 'auto', fontSize: 12, color: COLORS.textLight },
    entryTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text, marginBottom: 4 },
    entryMeta: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 18 },
    statusRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, gap: 6 },
    statusBadge: {
      fontSize: 11,
      fontWeight: '600',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 3,
      overflow: 'hidden',
    },
    statusOk: { color: COLORS.success, backgroundColor: COLORS.successBg, borderWidth: 1, borderColor: COLORS.success },
    statusDuty: { color: '#b45309', backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#f97316' },
    statusMark: { color: COLORS.accent, backgroundColor: COLORS.infoBg, borderWidth: 1, borderColor: COLORS.accentLight },
    entryActions: { flexDirection: 'row', marginTop: SPACING.sm },
    dlBtn: {
      flex: 1,
      backgroundColor: COLORS.accent,
      paddingVertical: SPACING.sm,
      alignItems: 'center',
      marginRight: SPACING.sm,
    },
    dlBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
    dlBtnSecondary: {
      flex: 1,
      borderWidth: 1,
      borderColor: COLORS.accent,
      paddingVertical: SPACING.sm - 1,
      alignItems: 'center',
    },
    dlBtnSecondaryText: { color: COLORS.accent, fontSize: 13, fontWeight: '600' },
    dlBtnOutline: {
      flex: 1,
      borderWidth: 1,
      borderColor: COLORS.borderDark,
      paddingVertical: SPACING.sm - 1,
      alignItems: 'center',
      marginLeft: SPACING.sm,
    },
    dlBtnOutlineText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
    btnDisabled: { opacity: 0.5 },

    // 空态 / 错误
    emptyBox: { alignItems: 'center', padding: SPACING.xl, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
    emptyTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text, marginBottom: SPACING.xs },
    emptyText: { fontSize: 12, color: COLORS.textLight, textAlign: 'center', lineHeight: 18 },
    retryBtn: { marginTop: SPACING.md, borderWidth: 1, borderColor: COLORS.accent, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.xs },
    retryText: { color: COLORS.accent, fontWeight: '600' },

    // schid 模式
    infoBox: {
      backgroundColor: COLORS.infoBg,
      borderLeftWidth: 4,
      borderLeftColor: COLORS.accentLight,
      padding: SPACING.md,
      marginBottom: SPACING.lg,
    },
    infoTitle: { fontSize: 15, fontWeight: '700', color: COLORS.accent, marginBottom: 4 },
    infoText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },
    label: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, marginBottom: SPACING.xs },
    input: {
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: SPACING.sm + 2,
      fontSize: 15,
      color: COLORS.text,
      backgroundColor: COLORS.bg,
      marginBottom: SPACING.md,
    },
    actionBtn: {
      backgroundColor: COLORS.accent,
      padding: SPACING.md,
      alignItems: 'center',
      marginBottom: SPACING.sm,
    },
    actionBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    actionBtnSecondary: {
      borderWidth: 1,
      borderColor: COLORS.accent,
      padding: SPACING.md,
      alignItems: 'center',
      marginBottom: SPACING.md,
    },
    actionBtnSecondaryText: { color: COLORS.accent, fontSize: 16, fontWeight: '600' },
    schidRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
    actionBtnOutline: {
      borderWidth: 1,
      borderColor: COLORS.borderDark,
      padding: SPACING.md,
      alignItems: 'center',
    },
    actionBtnOutlineText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
    tipBox: {
      marginTop: SPACING.md,
      padding: SPACING.md,
      backgroundColor: COLORS.bg,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    tipTitle: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: SPACING.xs },
    tipText: { fontSize: 11, color: COLORS.textLight, lineHeight: 18, fontFamily: 'monospace' },
  });
