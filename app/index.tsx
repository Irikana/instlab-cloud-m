// 首页：功能入口卡片
import React from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useAuthStore } from '../src/store/auth-store';
import { SPACING, useTheme, type Palette } from '../src/theme';

const APP_VERSION = Constants.expoConfig?.version ?? '0.1.0';

interface FeatureItem {
  title: string;
  desc: string;
  icon?: string;
  href?: string;
  enabled: boolean;
}

function confirmDialog(
  title: string,
  message: string,
  onConfirm: () => void,
): void {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
  } else {
    Alert.alert(title, message, [
      { text: '取消', style: 'cancel' },
      { text: '确定', style: 'destructive', onPress: onConfirm },
    ]);
  }
}

export default function HomeScreen() {
  const router = useRouter();
  const { login, userName, isTeacher, logout } = useAuthStore();
  const { isDark, colors } = useTheme();
  const s = createStyles(colors);

  const FEATURES: FeatureItem[] = [
    {
      title: '下载作业纸',
      desc: '日历选日期，下载空白/批改后作业纸 PDF',
      href: '/paper-download',
      enabled: true,
    },
    {
      title: '课程表',
      desc: '查看实验课程安排与教学计划',
      href: '/schedule',
      enabled: false,
    },
    {
      title: '实验报告',
      desc: '提交、查看实验报告（Markdown 编辑）',
      href: '/report',
      enabled: false,
    },
    {
      title: '实验数据',
      desc: '提交实验原始数据与结果',
      href: '/data-report',
      enabled: false,
    },
    {
      title: '文件管理',
      desc: '管理作业附件、实验结果文件',
      href: '/files',
      enabled: false,
    },
    {
      title: '检查更新',
      desc: '查看最新版本、下载 APK、访问官网',
      href: '/updates',
      enabled: true,
    },
    {
      title: '设置',
      desc: '主题切换、账户信息、关于',
      href: '/settings',
      enabled: true,
    },
  ];

  const handleLogout = () => {
    confirmDialog('退出登录', '确定要退出吗？Token 将从本机清除。', () => logout());
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Brand header */}
      <View style={s.brand}>
        <View style={s.logoSmall}>
          <Text style={s.logoSmallText}>IC</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.brandName}>INSTLAB CLOUD M</Text>
          <Text style={s.brandSub}>移动端教学管理 v{APP_VERSION}</Text>
        </View>
      </View>

      {/* 用户问候 */}
      <View style={s.greeting}>
        {userName && userName !== login && (
          <View style={s.avatar}>
            <Text style={s.avatarText}>{userName.slice(0, 1)}</Text>
          </View>
        )}
        <View style={{ flex: 1, marginLeft: SPACING.sm }}>
          <Text style={s.greetingLine}>
            你好，<Text style={s.greetingName}>{userName || login || '同学'}</Text>
            {isTeacher ? '老师' : '同学'}
          </Text>
          <Text style={s.greetingId}>{login ?? ''}</Text>
        </View>
        <Pressable style={s.logoutBtn} onPress={handleLogout}>
          <Text style={s.logoutText}>退出</Text>
        </Pressable>
      </View>

      {/* Feature Grid */}
      <Text style={s.sectionTitle}>功能</Text>
      <View style={s.grid}>
        {FEATURES.map((f) => (
          <Pressable
            key={f.title}
            style={[s.card, !f.enabled && s.cardDisabled]}
            onPress={() => f.enabled && f.href && router.push(f.href)}
          >
            <Text style={s.cardIcon}>{f.icon ?? 'IC'}</Text>
            <Text style={[s.cardTitle, !f.enabled && s.textDisabled]}>{f.title}</Text>
            <Text style={s.cardDesc}>{f.desc}</Text>
            {!f.enabled && <Text style={s.comingBadge}>即将推出</Text>}
          </Pressable>
        ))}
      </View>

      {/* Footer */}
      <Text style={s.footer}>INSTLAB CLOUD M · 智慧教学助手</Text>
    </ScrollView>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bgSubtle },
    content: { padding: SPACING.md, paddingBottom: SPACING.xl },
    brand: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.bg,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: SPACING.md,
      marginBottom: SPACING.md,
    },
    logoSmall: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: COLORS.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: SPACING.sm,
    },
    logoSmallText: { fontSize: 18, fontWeight: '800', color: '#fff' },
    brandName: { fontSize: 18, fontWeight: '700', color: COLORS.accent },
    brandSub: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
    greeting: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.bg,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: SPACING.md,
      marginBottom: SPACING.md,
    },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: COLORS.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontSize: 18, fontWeight: '800', color: '#fff' },
    greetingLine: { fontSize: 16, color: COLORS.text },
    greetingName: { fontWeight: '700', color: COLORS.accent },
    greetingId: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
    logoutBtn: {
      borderWidth: 1,
      borderColor: COLORS.danger,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.xs + 2,
      marginLeft: SPACING.sm,
    },
    logoutText: { fontSize: 13, color: COLORS.danger, fontWeight: '600' },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: COLORS.textSecondary,
      marginBottom: SPACING.sm,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.sm,
    },
    card: {
      width: '48%',
      backgroundColor: COLORS.bg,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: SPACING.md,
      minHeight: 130,
      position: 'relative',
    },
    cardDisabled: { opacity: 0.5 },
    cardIcon: { fontSize: 28, marginBottom: SPACING.xs },
    cardTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text, marginBottom: 4 },
    textDisabled: { color: COLORS.textLight },
    cardDesc: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 17 },
    comingBadge: {
      position: 'absolute',
      top: 8,
      right: 8,
      fontSize: 10,
      fontWeight: '600',
      color: COLORS.textLight,
      backgroundColor: COLORS.bgMuted,
      borderWidth: 1,
      borderColor: COLORS.border,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    footer: {
      textAlign: 'center',
      fontSize: 12,
      color: COLORS.textLight,
      marginTop: SPACING.lg,
    },
  });