// 设置页：主题切换（含 Cloud Lite 风格）+ 关于
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useSettingsStore } from '../src/store/settings-store';
import { SPACING, useTheme, type Palette, THEME_OPTIONS, type ThemeMode } from '../src/theme';

const APP_VERSION = Constants.expoConfig?.version ?? '0.0.1';

export default function SettingsScreen() {
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const { colors } = useTheme();
  const s = createStyles(colors);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Text style={s.sectionTitle}>主题风格</Text>
      <View style={s.optionGroup}>
        {THEME_OPTIONS.map((o) => {
          const active = themeMode === o.key;
          return (
            <Pressable
              key={o.key}
              style={[s.option, active && s.optionActive]}
              onPress={() => setThemeMode(o.key as ThemeMode)}
            >
              <View style={{ flex: 1 }}>
                <Text style={[s.optionLabel, active && s.optionLabelActive]}>{o.label}</Text>
                <Text style={s.optionDesc}>{o.desc}</Text>
              </View>
              {active && <Text style={s.optionMark}>✓</Text>}
            </Pressable>
          );
        })}
      </View>

      <Text style={[s.sectionTitle, { marginTop: SPACING.lg }]}>关于</Text>
      <View style={s.aboutBox}>
        <Text style={s.aboutName}>INSTLAB CLOUD M</Text>
        <Text style={s.aboutDesc}>移动端教学管理 v{APP_VERSION}</Text>
        <Text style={s.aboutLine}>
          基于 INSTLAB CLOUD Lite PC 客户端分析开发，兼容 cloud.instlab.cn API。
        </Text>
        <Text style={s.aboutLine}>
          「Cloud Lite」主题仿自 PC 客户端的前端配色方案。
        </Text>
        <View style={s.disclaimerBox}>
          <Text style={s.disclaimerTitle}>声明</Text>
          <Text style={s.disclaimerText}>
            本软件由在校学生基于学习目的自行开发，与 INSTLAB 官方无关。仅供个人学习参考，请勿用于商业用途。使用本软件所产生的任何问题与责任均由使用者自行承担。
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bgSubtle },
    content: { padding: SPACING.md, paddingBottom: SPACING.xl },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: COLORS.textSecondary,
      marginBottom: SPACING.sm,
    },
    optionGroup: {
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bg,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
    },
    optionActive: { backgroundColor: COLORS.infoBg },
    optionLabel: { fontSize: 15, fontWeight: '600', color: COLORS.text },
    optionLabelActive: { color: COLORS.accent },
    optionDesc: { fontSize: 12, color: COLORS.textLight, marginTop: 3 },
    optionMark: { fontSize: 14, color: COLORS.accent, fontWeight: '700' },
    aboutBox: {
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bg,
      padding: SPACING.md,
    },
    aboutName: { fontSize: 16, fontWeight: '700', color: COLORS.accent },
    aboutDesc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
    aboutLine: { fontSize: 12, color: COLORS.textLight, marginTop: SPACING.sm, lineHeight: 18 },
    disclaimerBox: {
      marginTop: SPACING.md,
      padding: SPACING.sm + 2,
      backgroundColor: COLORS.warning + '15',
      borderLeftWidth: 4,
      borderLeftColor: COLORS.warning,
    },
    disclaimerTitle: { fontSize: 12, fontWeight: '600', color: COLORS.warning, marginBottom: 4 },
    disclaimerText: { fontSize: 11, color: COLORS.textSecondary, lineHeight: 17 },
  });