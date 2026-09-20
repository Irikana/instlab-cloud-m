// 课程表：把所选学期的全部安排按星期排开。
// 数据层与作业纸共用同一份（/api/term + /api/schedule + /api/scheduleth），
// 学期选择也与作业纸共享同一个持久化状态，两边切换互相一致。
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/store/auth-store';
import { useTermStore } from '../src/store/term-store';
import { fetchScheduleEntries, kindLabel, WEEK_LABELS, type ScheduleEntry } from '../src/lib/schedule';
import { isUnauthorized } from '../src/lib/api';
import { CALENDAR_COLORS, SPACING, useTheme, type Palette } from '../src/theme';

/** 一条课程表行：同一星期里同课程同节次同地点的合并成一条 */
interface Slot {
  key: string;
  title: string;
  course?: string;
  time: string;
  place: string;
  teacher: string;
  kind: string;
}

function weekdayOf(date: string): number {
  const d = new Date(date + 'T00:00:00');
  return isNaN(d.getTime()) ? -1 : d.getDay();
}

export default function ScheduleScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = createStyles(colors);
  const forceLogout = useAuthStore((st) => st.forceLogout);
  const terms = useTermStore((st) => st.terms);
  const termId = useTermStore((st) => st.currentId);
  const setTerm = useTermStore((st) => st.setTerm);
  const loadTerms = useTermStore((st) => st.loadTerms);

  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTerms().catch(() => {});
  }, [loadTerms]);

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
        if (isUnauthorized(e)) {
          void forceLogout('登录已失效，请重新登录后再查看课程表');
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
  }, [termId, forceLogout]);

  const termName = terms.find((t) => t.id === termId)?.name ?? '';

  // 同一门课每周重复出现，按「星期几 + 课程 + 节次 + 地点」去重后只列一条
  const byWeekday = useMemo(() => {
    const map = new Map<number, Map<string, Slot>>();
    for (const e of entries) {
      const wd = weekdayOf(e.date);
      if (wd < 0) continue;
      const key = `${e.coursename ?? ''}|${e.time}|${e.place}|${e.title}|${e.kind}`;
      let row = map.get(wd);
      if (!row) {
        row = new Map();
        map.set(wd, row);
      }
      if (!row.has(key)) {
        row.set(key, {
          key,
          title: e.title,
          course: e.coursename,
          time: e.time ?? '',
          place: e.place ?? '',
          teacher: e.teacher ?? '',
          kind: e.kind,
        });
      }
    }
    return map;
  }, [entries]);

  const dayOrder = [1, 2, 3, 4, 5, 6, 0]; // 周一排最前，符合课表阅读习惯
  const hasAny = dayOrder.some((d) => (byWeekday.get(d)?.size ?? 0) > 0);

  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}>
      <View style={s.termBar}>
        <Text style={s.termText} numberOfLines={1}>
          {termName ? '学期：' + termName : '加载学期中…'}
        </Text>
        {terms.length > 1 && (
          <View style={s.termSwitch}>
            {terms.map((t) => (
              <Pressable
                key={t.id}
                style={[s.termChip, t.id === termId && s.termChipActive]}
                onPress={() => setTerm(t.id)}
              >
                <Text style={[s.termChipText, t.id === termId && s.termChipTextActive]} numberOfLines={1}>
                  {t.name || t.id}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {loading ? (
        <View style={s.centerBox}>
          <ActivityIndicator color={colors.accent} />
          <Text style={s.hint}>加载课程表…</Text>
        </View>
      ) : error ? (
        <View style={s.centerBox}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : !hasAny ? (
        <View style={s.centerBox}>
          <Text style={s.hint}>这个学期还没有课程安排。</Text>
        </View>
      ) : (
        dayOrder.map((wd) => {
          const row = byWeekday.get(wd);
          if (!row || row.size === 0) return null;
          const slots = [...row.values()].sort((a, b) => a.time.localeCompare(b.time));
          return (
            <View key={wd} style={s.dayBlock}>
              <Text style={s.dayTitle}>星期{WEEK_LABELS[wd]}</Text>
              {slots.map((slot) => (
                <View key={slot.key} style={s.slotRow}>
                  <View
                    style={[
                      s.kindBadge,
                      slot.kind === 'theory' && s.kindTheory,
                      slot.kind === 'duty' && s.kindDuty,
                    ]}
                  >
                    <Text style={s.kindBadgeText}>{kindLabel(slot.kind)}</Text>
                  </View>
                  <View style={s.slotMain}>
                    <Text style={s.slotTitle}>{slot.title}</Text>
                    {!!slot.course && slot.course !== slot.title && (
                      <Text style={s.slotMeta}>{slot.course}</Text>
                    )}
                    {!!(slot.time || slot.place) && (
                      <Text style={s.slotMeta}>{[slot.time, slot.place].filter(Boolean).join(' · ')}</Text>
                    )}
                    {!!slot.teacher && <Text style={s.slotMeta}>{slot.teacher}</Text>}
                  </View>
                </View>
              ))}
            </View>
          );
        })
      )}

      <Pressable style={s.backBtn} onPress={() => router.back()}>
        <Text style={s.backText}>返回</Text>
      </Pressable>
    </ScrollView>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: COLORS.bgSubtle },
    content: { padding: SPACING.md, paddingBottom: SPACING.xl },
    termBar: { marginBottom: SPACING.md },
    termText: { fontSize: 13, color: COLORS.textSecondary, marginBottom: SPACING.sm },
    termSwitch: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    termChip: {
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bg,
      paddingHorizontal: SPACING.md,
      paddingVertical: 4,
    },
    termChipActive: { borderColor: COLORS.accent, backgroundColor: COLORS.infoBg },
    termChipText: { fontSize: 12, color: COLORS.textSecondary, maxWidth: 220 },
    termChipTextActive: { color: COLORS.accent, fontWeight: '700' },
    centerBox: { alignItems: 'center', paddingVertical: SPACING.xl },
    hint: { fontSize: 13, color: COLORS.textLight },
    errorText: { fontSize: 13, color: COLORS.danger, textAlign: 'center', lineHeight: 19 },
    dayBlock: {
      backgroundColor: COLORS.bg,
      borderWidth: 1,
      borderColor: COLORS.border,
      marginBottom: SPACING.md,
    },
    dayTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: COLORS.accent,
      padding: SPACING.sm,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
      backgroundColor: COLORS.bgMuted,
    },
    slotRow: {
      flexDirection: 'row',
      padding: SPACING.sm,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
      gap: SPACING.sm,
    },
    kindBadge: {
      backgroundColor: CALENDAR_COLORS.experiment,
      paddingHorizontal: 6,
      paddingVertical: 2,
      alignSelf: 'flex-start',
    },
    kindTheory: { backgroundColor: CALENDAR_COLORS.theory },
    kindDuty: { backgroundColor: CALENDAR_COLORS.duty },
    kindBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
    slotMain: { flex: 1 },
    slotTitle: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
    slotMeta: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
    backBtn: {
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: SPACING.sm + 2,
      alignItems: 'center',
      backgroundColor: COLORS.bg,
    },
    backText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '500' },
  });
