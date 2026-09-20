// 更新日志页：离线展示内置的历史版本变更（数据来自 src/lib/changelog-data.ts，
// 由 scripts/gen-changelog.js 从 changelog/CHANGELOG-*.md 生成）。
// 不联网——检查最新版本在「更新与版本」页。
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { CHANGELOG_DATA } from '../src/lib/changelog-data';
import { SPACING, useTheme, type Palette } from '../src/theme';

const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';

export default function ChangelogScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  // 默认展开本机这一版；对不上（比如装的是测试构建）时展开列表第一条
  const [openKeys, setOpenKeys] = useState<Set<string>>(() =>
    new Set([CHANGELOG_DATA.find((e) => e.key === APP_VERSION)?.key ?? CHANGELOG_DATA[0]?.key]),
  );

  const toggle = (key: string) =>
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}>
      <Text style={s.intro}>
        本机版本 v{APP_VERSION}。以下变更随应用一起打包，离线也能查看。
      </Text>

      {CHANGELOG_DATA.map((entry) => {
        const open = openKeys.has(entry.key);
        const isCurrent = entry.key === APP_VERSION;
        const bullets = entry.blocks.filter((b) => b.kind === 'bullet').length;
        return (
          <View key={entry.key} style={s.card}>
            <Pressable style={s.head} onPress={() => toggle(entry.key)}>
              <View style={s.headLeft}>
                <Text style={s.version}>v{entry.key}</Text>
                {isCurrent && <Text style={s.currentTag}>当前</Text>}
              </View>
              <Text style={s.headMeta}>
                {entry.date ? entry.date + ' · ' : ''}
                {bullets} 项
              </Text>
            </Pressable>
            <Text style={s.title}>{entry.title}</Text>
            {open && (
              <View style={s.body}>
                {entry.blocks.map((block, i) =>
                  block.kind === 'section' ? (
                    <Text key={i} style={s.section}>
                      {block.text}
                    </Text>
                  ) : (
                    <View key={i} style={s.bulletRow}>
                      <Text style={s.bulletMark}>-</Text>
                      <Text style={s.bullet}>{block.text}</Text>
                    </View>
                  ),
                )}
              </View>
            )}
            <Pressable style={s.toggle} onPress={() => toggle(entry.key)}>
              <Text style={s.toggleText}>{open ? '收起' : '展开'}</Text>
            </Pressable>
          </View>
        );
      })}

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
    intro: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19, marginBottom: SPACING.md },
    card: {
      backgroundColor: COLORS.bg,
      borderWidth: 1,
      borderColor: COLORS.border,
      marginBottom: SPACING.md,
      padding: SPACING.md,
    },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    version: { fontSize: 16, fontWeight: '700', color: COLORS.text },
    currentTag: {
      fontSize: 11,
      color: COLORS.accent,
      borderWidth: 1,
      borderColor: COLORS.accent,
      paddingHorizontal: 4,
      paddingVertical: 1,
    },
    headMeta: { fontSize: 12, color: COLORS.textLight },
    title: { fontSize: 13, color: COLORS.textSecondary, marginTop: SPACING.xs, lineHeight: 19 },
    body: { marginTop: SPACING.sm },
    section: {
      fontSize: 13,
      fontWeight: '700',
      color: COLORS.accent,
      marginTop: SPACING.md,
      marginBottom: SPACING.xs,
    },
    bulletRow: { flexDirection: 'row', marginBottom: SPACING.xs },
    bulletMark: { width: 14, fontSize: 13, color: COLORS.textLight, lineHeight: 20 },
    bullet: { flex: 1, fontSize: 13, color: COLORS.text, lineHeight: 20 },
    toggle: { marginTop: SPACING.sm },
    toggleText: { fontSize: 13, color: COLORS.accent },
    backBtn: {
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: SPACING.sm + 2,
      alignItems: 'center',
      backgroundColor: COLORS.bg,
    },
    backText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '500' },
  });
