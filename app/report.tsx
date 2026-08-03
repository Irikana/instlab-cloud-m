// 实验报告 — 占位（灰色不可交互）
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SPACING, useTheme, type Palette } from '../src/theme';

export default function ReportScreen() {
  const { colors } = useTheme();
  const s = createStyles(colors);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.placeholder}>
        <Text style={s.icon}>📝</Text>
        <Text style={s.title}>实验报告</Text>
        <Text style={s.desc}>
          此功能即将推出{'\n\n'}
          支持 Markdown 编辑实验报告{'\n'}
          提交 / 查看 / 相似度检测
        </Text>
        <View style={s.badge}>
          <Text style={s.badgeText}>即将推出</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bgSubtle },
    content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
    placeholder: { alignItems: 'center', opacity: 0.4 },
    icon: { fontSize: 56, marginBottom: SPACING.md },
    title: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: SPACING.sm },
    desc: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 24 },
    badge: {
      marginTop: SPACING.lg,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs,
    },
    badgeText: { fontSize: 13, color: COLORS.textLight, fontWeight: '600' },
  });