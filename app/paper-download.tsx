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
import { SPACING, useTheme, type Palette } from '../src/theme';
import {
  fetchScheduleEntries,
  fetchTermList,
  formatDate,
  kindLabel,
  todayStr,
  WEEK_LABELS,
  type ScheduleEntry,
} from '../src/lib/schedule';
import { downloadPaperPdf, type PaperKind } from '../src/lib/paper';

type Mode = 'calendar' | 'schid';

const pad2 = (n: number) => String(n).padStart(2, '0');

export default function PaperDownloadScreen() {
  const { colors } = useTheme();
  const s = createStyles(colors);
  const login = useAuthStore((st) => st.login);

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

  /** 有安排的日期集合 */
  const markedDates = useMemo(() => new Set(entriesByDate.keys()), [entriesByDate]);

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
  const handleEntryDownload = async (entry: ScheduleEntry, kind: PaperKind) => {
    const key = `${entry.schid}-${kind}`;
    setDownloadingKey(key);
    try {
      const schData: Record<string, unknown> = {
        schid: entry.schid,
        planid: entry.planid ?? '',
        planexpid: entry.planexpid ?? '',
      };
      const fileName = `${kind === 'work' ? '空白作业纸' : '批改后作业纸'}_${entry.title}_${entry.date}.pdf`;
      const res = await downloadPaperPdf(kind, schData, fileName);
      Alert.alert(
        'PDF 已生成',
        res.shared
          ? '请在系统分享面板中选择保存位置。\n\n' + res.uri
          : '文件已生成：\n' + res.uri,
      );
    } catch (e) {
      Alert.alert('下载失败', (e as Error).message);
    } finally {
      setDownloadingKey(null);
    }
  };

  /** 下载作业纸（schid 测试模式） */
  const handleSchidDownload = async (kind: PaperKind) => {
    const id = scheduleId.trim();
    if (!id) {
      Alert.alert('提示', '请输入实验安排ID（schid）');
      return;
    }
    setDownloadingKey('schid-' + kind);
    try {
      const fileName = `${kind === 'work' ? '空白作业纸' : '批改后作业纸'}_${id}.pdf`;
      const res = await downloadPaperPdf(kind, { schid: id }, fileName);
      Alert.alert(
        'PDF 已生成',
        res.shared
          ? '请在系统分享面板中选择保存位置。\n\n' + res.uri
          : '文件已生成：\n' + res.uri,
      );
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
                const hasEntry = markedDates.has(dk);
                return (
                  <Pressable key={dk} style={s.dayCell} onPress={() => selectDate(day)}>
                    <View style={[s.dayCircle, isSelected && s.dayCircleSelected, isToday && !isSelected && s.dayCircleToday]}>
                      <Text style={[s.dayNum, isSelected && s.dayNumSelected]}>{day}</Text>
                    </View>
                    <View style={[s.dot, hasEntry && s.dotMarked, isSelected && s.dotOnSelected]} />
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
                  {(entry.time || entry.place) && (
                    <Text style={s.entryMeta}>
                      {[entry.time, entry.place].filter(Boolean).join(' · ')}
                    </Text>
                  )}
                  {entry.teacher ? <Text style={s.entryMeta}>教师：{entry.teacher}</Text> : null}

                  <View style={s.entryActions}>
                    <Pressable
                      style={[s.dlBtn, (busy || downloadingKey === `${entry.schid}-work`) && s.btnDisabled]}
                      disabled={busy}
                      onPress={() => handleEntryDownload(entry, 'work')}
                    >
                      {downloadingKey === `${entry.schid}-work` ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={s.dlBtnText}>下载空白作业纸</Text>
                      )}
                    </Pressable>
                    <Pressable
                      style={[s.dlBtnSecondary, (busy || downloadingKey === `${entry.schid}-workcorr`) && s.btnDisabled]}
                      disabled={busy}
                      onPress={() => handleEntryDownload(entry, 'workcorr')}
                    >
                      {downloadingKey === `${entry.schid}-workcorr` ? (
                        <ActivityIndicator size="small" color={colors.accent} />
                      ) : (
                        <Text style={s.dlBtnSecondaryText}>批改后</Text>
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

          <Pressable
            style={[s.actionBtn, downloadingKey !== null && s.btnDisabled]}
            disabled={downloadingKey !== null}
            onPress={() => handleSchidDownload('work')}
          >
            {downloadingKey === 'schid-work' ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.actionBtnText}>下载空白作业纸</Text>
            )}
          </Pressable>

          <Pressable
            style={[s.actionBtnSecondary, downloadingKey !== null && s.btnDisabled]}
            disabled={downloadingKey !== null}
            onPress={() => handleSchidDownload('workcorr')}
          >
            {downloadingKey === 'schid-workcorr' ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Text style={s.actionBtnSecondaryText}>下载批改后作业纸</Text>
            )}
          </Pressable>

          <View style={s.tipBox}>
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
    dayCircleSelected: { backgroundColor: COLORS.accent },
    dayCircleToday: { borderWidth: 1.5, borderColor: COLORS.accent },
    dayNum: { fontSize: 14, color: COLORS.text },
    dayNumSelected: { color: '#fff', fontWeight: '700' },
    dot: { width: 5, height: 5, borderRadius: 3, marginTop: 1 },
    dotMarked: { backgroundColor: COLORS.accentLight },
    dotOnSelected: { backgroundColor: '#fff' },

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
