// 作业纸下载（核心功能）
// 日历查看：选学期 → 选日期 → 显示该日实验/理论/值日安排 → 预览并打印作业纸
// 顶部的「实验ID」是电脑版的隐藏入口，只在设置里打开开发者模式后才出现。
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/store/auth-store';
import { useTermStore } from '../src/store/term-store';
import { useSettingsStore } from '../src/store/settings-store';
import { SPACING, useTheme, type Palette, CALENDAR_COLORS } from '../src/theme';
import {
  fetchScheduleEntries,
  formatDate,
  kindLabel,
  todayStr,
  WEEK_LABELS,
  type ScheduleEntry,
} from '../src/lib/schedule';
import {
  buildPaperRequestData,
  downloadRawHtml,
  downloadRawJson,
  fetchPaper,
  paperFileName,
  type PaperKind,
} from '../src/lib/paper';
import { isUnauthorized } from '../src/lib/api';
import { shareJson } from '../src/lib/share';

type Mode = 'calendar' | 'schid';

const pad2 = (n: number) => String(n).padStart(2, '0');

export default function PaperDownloadScreen() {
  const { colors } = useTheme();
  const s = createStyles(colors);
  const router = useRouter();
  const login = useAuthStore((st) => st.login);
  const userName = useAuthStore((st) => st.userName);
  const userRole = useAuthStore((st) => st.userRole);
  const univer = useAuthStore((st) => st.univer);
  const isTeacher = useAuthStore((st) => st.isTeacher);
  const forceLogout = useAuthStore((st) => st.forceLogout);
  const devMode = useSettingsStore((st) => st.devMode);

  // 模式
  const [mode, setMode] = useState<Mode>('calendar');

  // 学期（与电脑版一样可切换，选择会被记住）
  const terms = useTermStore((st) => st.terms);
  const termId = useTermStore((st) => st.currentId);
  const setTerm = useTermStore((st) => st.setTerm);
  const loadTerms = useTermStore((st) => st.loadTerms);
  const [termsOpen, setTermsOpen] = useState(false);

  // 日历状态
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState(todayStr());

  // 数据
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [reloadTick, setReloadTick] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  // schid 测试模式
  const [scheduleId, setScheduleId] = useState('');

  useEffect(() => {
    loadTerms().catch(() => {
      // 列表拉不到时界面已有错误提示，不再重复弹窗
    });
  }, [loadTerms, login]);

  /** 拉取所选学期的全部日程 */
  useEffect(() => {
    if (!termId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchScheduleEntries(termId)
      .then((list) => {
        if (!cancelled) setEntries(list);
      })
      .catch((e) => {
        if (cancelled) return;
        // 会话过期就直接带回登录页，不让人对着空白日历自己猜
        if (isUnauthorized(e)) {
          void forceLogout('登录已失效，请重新登录后再查看学期安排');
          return;
        }
        setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [termId, reloadTick, login]);

  /** 有安排的日期表 */
  const entriesByDate = useMemo(() => {
    const map = new Map<string, ScheduleEntry[]>();
    for (const e of entries) {
      const arr = map.get(e.date) ?? [];
      arr.push(e);
      map.set(e.date, arr);
    }
    return map;
  }, [entries]);

  // 换学期后若今天没安排，落到该学期第一个有安排的日期（每个学期只做一次，
  // 否则用户手动点空白日期会被弹走）
  const locatedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!termId || loading || locatedFor.current === termId) return;
    if (entriesByDate.size === 0) return;
    locatedFor.current = termId;
    if (entriesByDate.has(selectedDate)) return;
    const first = [...entriesByDate.keys()].sort()[0];
    setSelectedDate(first);
    const d = new Date(first + 'T00:00:00');
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }, [termId, loading, entriesByDate, selectedDate]);

  const termName = terms.find((t) => t.id === termId)?.name ?? '';

  const reload = useCallback(() => {
    loadTerms(true).catch(() => {});
    setReloadTick((n) => n + 1);
  }, [loadTerms]);

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

  /** 进入预览/打印（手机端唯一的出图路径，与下载 PDF 同一份文档） */
  const goPreview = (entry: { schid: string; date: string; coursename?: string; title: string; raw: Record<string, unknown> }, kind: PaperKind) => {
    const title = entry.coursename || entry.title || (kind === 'work' ? '作业' : '批改');
    router.push({
      pathname: '/paper-preview',
      params: {
        schid: entry.schid,
        kind,
        title,
        data: JSON.stringify(buildPaperRequestData(entry as ScheduleEntry, { login, userName, univer })),
      },
    });
  };

  const dumpFileName = (kind: PaperKind, courseName: string, date: string, fmt: string) =>
    paperFileName(kind, courseName, login || '', userName || '', date, fmt);

  /** 导出服务器原样返回的 HTML / JSON，用于与电脑版对照排查（开发者模式可见） */
  const handleDump = async (
    source: { key: string; courseName: string; date: string },
    schData: Record<string, unknown>,
    kind: PaperKind,
    fmt: 'html' | 'json',
  ) => {
    const key = `${source.key}-${kind}-${fmt}`;
    setDownloadingKey(key);
    try {
      const payload = await fetchPaper(kind, schData);
      const fileName = dumpFileName(kind, source.courseName, source.date, fmt);
      const res = fmt === 'html'
        ? await downloadRawHtml(payload, fileName)
        : await downloadRawJson(payload, fileName);
      Alert.alert(
        fmt === 'html' ? '服务器 HTML 已导出' : '服务器 JSON 已导出',
        res.shared
          ? '请在系统分享面板中选择保存位置。\n\n' + res.uri
          : '文件已生成：\n' + res.uri,
      );
    } catch (e) {
      Alert.alert('导出失败', (e as Error).message);
    } finally {
      setDownloadingKey(null);
    }
  };

  /** schid 测试模式：只导出服务器响应，出图仍走预览页 */
  const handleSchidDump = async (kind: PaperKind, fmt: 'html' | 'json') => {
    const id = scheduleId.trim();
    if (!id) {
      Alert.alert('提示', '请输入实验安排ID（schid）');
      return;
    }
    await handleDump({ key: id, courseName: '作业纸', date: todayStr() }, { schid: id }, kind, fmt);
  };

  const selectedDateLabel = (() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    return `${y}年${m}月${d}日`;
  })();

  const showSchid = mode === 'schid' && devMode;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* 模式切换：实验ID 只在开发者模式下出现（电脑版的隐藏入口） */}
      {devMode && (
        <View style={s.tabs}>
          <Pressable
            style={[s.tab, !showSchid && s.tabActive]}
            onPress={() => setMode('calendar')}
          >
            <Text style={[s.tabText, !showSchid && s.tabTextActive]}>日历查看</Text>
          </Pressable>
          <Pressable
            style={[s.tab, showSchid && s.tabActive]}
            onPress={() => setMode('schid')}
          >
            <Text style={[s.tabText, showSchid && s.tabTextActive]}>实验ID</Text>
          </Pressable>
        </View>
      )}

      {!showSchid ? (
        <>
          {/* 学期 + 刷新：点学期可在各学期之间切换，选择会被记住 */}
          <View style={s.termBar}>
            <Pressable
              style={s.termPicker}
              onPress={() => setTermsOpen(true)}
              disabled={terms.length === 0}
            >
              <Text style={s.termText} numberOfLines={1}>
                {termName ? '学期：' + termName : '加载学期中…'}
              </Text>
              {terms.length > 1 && <Text style={s.termChevron}>切换</Text>}
            </Pressable>
            <Pressable style={s.refreshBtn} onPress={reload} disabled={loading}>
              <Text style={s.refreshText}>刷新</Text>
            </Pressable>
            {/* 学期与日程的原始字段：教室、周次这些对不上号时靠它确认服务器到底给了什么 */}
            {devMode && (
              <Pressable
                style={s.refreshBtn}
                onPress={() => {
                  void shareJson(
                    { term: terms.find((t) => t.id === termId) ?? null, terms, entries },
                    `日程_${termName || termId || '未选学期'}.json`,
                  ).then((r) =>
                    Alert.alert('日程 JSON 已导出', r.shared ? '请在系统分享面板中选择保存位置。' : r.uri),
                  );
                }}
              >
                <Text style={s.refreshText}>日程JSON</Text>
              </Pressable>
            )}
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
              <Pressable style={s.retryBtn} onPress={reload}>
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
                    <Text style={s.scanWarning}>正式提交扫描作业请优先使用电脑端生成的作业纸</Text>
                    <Pressable
                      style={[s.dlBtn, busy && s.btnDisabled]}
                      disabled={busy}
                      onPress={() => goPreview(entry, 'work')}
                    >
                      <Text style={s.dlBtnText}>预览</Text>
                    </Pressable>
                    {/* 批改纸是教师侧功能，学生账号不显示入口 */}
                    {isTeacher && (
                      <Pressable
                        style={[s.dlBtnSecondary, busy && s.btnDisabled]}
                        disabled={busy}
                        onPress={() => goPreview(entry, 'workcorr')}
                      >
                        <Text style={s.dlBtnSecondaryText}>批改预览</Text>
                      </Pressable>
                    )}
                    {devMode && (
                      <>
                        <Pressable
                          style={[s.dlBtnOutline, (busy || downloadingKey === `${entry.schid}-work-html`) && s.btnDisabled]}
                          disabled={busy}
                          onPress={() =>
                            handleDump(
                              { key: entry.schid, courseName: entry.coursename || entry.title || '未知', date: entry.date },
                              buildPaperRequestData(entry, { login, userName, univer }),
                              'work',
                              'html',
                            )
                          }
                        >
                          {downloadingKey === `${entry.schid}-work-html` ? (
                            <ActivityIndicator size="small" color={colors.textSecondary} />
                          ) : (
                            <Text style={s.dlBtnOutlineText}>HTML</Text>
                          )}
                        </Pressable>
                        <Pressable
                          style={[s.dlBtnOutline2, (busy || downloadingKey === `${entry.schid}-work-json`) && s.btnDisabled]}
                          disabled={busy}
                          onPress={() =>
                            handleDump(
                              { key: entry.schid, courseName: entry.coursename || entry.title || '未知', date: entry.date },
                              buildPaperRequestData(entry, { login, userName, univer }),
                              'work',
                              'json',
                            )
                          }
                        >
                          {downloadingKey === `${entry.schid}-work-json` ? (
                            <ActivityIndicator size="small" color={colors.textSecondary} />
                          ) : (
                            <Text style={s.dlBtnOutlineText}>JSON</Text>
                          )}
                        </Pressable>
                      </>
                    )}
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

          <View style={s.infoBox}>
            <Text style={s.infoTitle}>扫描提交提示</Text>
            <Text style={s.infoText}>
              手机端预览和打印使用 Android WebView，分页、条形码位置和机器扫描标记可能与电脑端不同。正式提交扫描作业请优先使用电脑端生成的作业纸。
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
              onPress={() => {
                const id = scheduleId.trim();
                if (!id) return;
                router.push({
                  pathname: '/paper-preview',
                  params: { schid: id, kind: 'work', title: '作业纸' },
                });
              }}
            >
              <Text style={s.actionBtnText}>预览</Text>
            </Pressable>
            <Pressable
              style={[s.actionBtnSecondary, { flex: 1 }, downloadingKey !== null && s.btnDisabled]}
              disabled={downloadingKey !== null}
              onPress={() => {
                const id = scheduleId.trim();
                if (!id) return;
                router.push({
                  pathname: '/paper-preview',
                  params: { schid: id, kind: 'workcorr', title: '批改纸' },
                });
              }}
            >
              <Text style={s.actionBtnSecondaryText}>批改预览</Text>
            </Pressable>
          </View>

          <View style={s.schidRow}>
            <Pressable
              style={[s.actionBtnOutline, { flex: 1 }, downloadingKey !== null && s.btnDisabled]}
              disabled={downloadingKey !== null}
              onPress={() => handleSchidDump('work', 'html')}
            >
              {downloadingKey === `${scheduleId.trim()}-work-html` ? (
                <ActivityIndicator size="small" color={colors.textSecondary} />
              ) : (
                <Text style={s.actionBtnOutlineText}>HTML</Text>
              )}
            </Pressable>
            <Pressable
              style={[s.actionBtnOutline, { flex: 1 }, downloadingKey !== null && s.btnDisabled]}
              disabled={downloadingKey !== null}
              onPress={() => handleSchidDump('workcorr', 'json')}
            >
              {downloadingKey === `${scheduleId.trim()}-workcorr-json` ? (
                <ActivityIndicator size="small" color={colors.textSecondary} />
              ) : (
                <Text style={s.actionBtnOutlineText}>批改JSON</Text>
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
            <Text style={s.tipText}>• 批改后作业图片由电脑端扫描/文件流程提供，不能用普通作业纸 JSON 代替</Text>
            <Text style={s.tipText}>• 手机端：渲染 HTML → Android WebView 打印，仅用于预览/普通打印</Text>
          </View>
        </>
      )}

      {/* 学期选择：列出服务器返回的全部学期，点选后重新拉该学期日程 */}
      <Modal visible={termsOpen} transparent animationType="fade" onRequestClose={() => setTermsOpen(false)}>
        <Pressable style={s.modalScrim} onPress={() => setTermsOpen(false)}>
          <View style={s.modalPanel} onStartShouldSetResponder={() => true}>
            <Text style={s.modalTitle}>选择学期</Text>
            <FlatList
              data={terms}
              keyExtractor={(t) => String(t.id)}
              style={s.modalList}
              renderItem={({ item }) => (
                <Pressable
                  style={[s.termRow, item.id === termId && s.termRowActive]}
                  onPress={async () => {
                    setTermsOpen(false);
                    if (item.id !== termId) {
                      locatedFor.current = null;
                      await setTerm(item.id);
                    }
                  }}
                >
                  <Text style={[s.termRowText, item.id === termId && s.termRowTextActive]}>
                    {item.name || item.id}
                  </Text>
                  {item.id === termId && <Text style={s.termRowMark}>当前</Text>}
                </Pressable>
              )}
            />
            <Pressable style={s.modalClose} onPress={() => setTermsOpen(false)}>
              <Text style={s.modalCloseText}>关闭</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
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
    termPicker: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 4,
      padding: SPACING.xs,
    },
    termText: { flex: 1, fontSize: 13, color: COLORS.textSecondary },
    termChevron: { fontSize: 12, color: COLORS.accent, fontWeight: '600', marginLeft: SPACING.sm },
    refreshBtn: { borderWidth: 1, borderColor: COLORS.accent, paddingHorizontal: SPACING.md, paddingVertical: 4 },
    refreshText: { fontSize: 13, color: COLORS.accent, fontWeight: '600' },

    // 学期选择弹层
    modalScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: SPACING.xl },
    modalPanel: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md, maxHeight: '70%' },
    modalTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
    modalList: { marginBottom: SPACING.sm },
    termRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: SPACING.md,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
    },
    termRowActive: { backgroundColor: COLORS.bgMuted },
    termRowText: { flex: 1, fontSize: 14, color: COLORS.text },
    termRowTextActive: { color: COLORS.accent, fontWeight: '700' },
    termRowMark: { fontSize: 12, color: COLORS.accent },
    modalClose: { borderWidth: 1, borderColor: COLORS.border, paddingVertical: SPACING.sm, alignItems: 'center' },
    modalCloseText: { fontSize: 14, color: COLORS.textSecondary },

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
    scanWarning: { position: 'absolute', top: -18, left: 0, right: 0, fontSize: 10, color: COLORS.warning },
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
    dlBtnOutline2: {
      flex: 1,
      borderWidth: 1,
      borderColor: COLORS.borderDark,
      paddingVertical: SPACING.sm - 1,
      alignItems: 'center',
      marginLeft: SPACING.sm,
    },
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
