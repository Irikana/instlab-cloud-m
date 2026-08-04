// 更新与版本页：检查 App 最新 Release、下载 APK、访问 INSTLAB CLOUD M 网站
// 从 App 仓库（instlab-cloud-m）检查 App 更新与下载 APK
// 下载：直接用 Linking 跳转浏览器下载（GitHub Release asset 自动触发下载），
// 用户下载完成后按系统提示安装
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { fetchAppRelease, LATEST_APK_URL, APP_SITE_URL, compareVersions, type ReleaseInfo } from '../src/lib/releases';
import { SPACING, useTheme, type Palette } from '../src/theme';

const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  } catch {
    return iso;
  }
}

export default function UpdatesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const s = createStyles(colors);

  // App 版本检查
  const [appChecking, setAppChecking] = useState(true);
  const [appRelease, setAppRelease] = useState<ReleaseInfo | null>(null);
  const [appError, setAppError] = useState<string | null>(null);

  const checkApp = useCallback(async () => {
    setAppChecking(true);
    setAppError(null);
    try {
      const r = await fetchAppRelease();
      setAppRelease(r);
    } catch (err) {
      setAppError((err as Error).message);
    } finally {
      setAppChecking(false);
    }
  }, []);

  useEffect(() => {
    checkApp();
  }, [checkApp]);

  const openDownload = () => {
    Linking.openURL(LATEST_APK_URL).catch(() =>
      Alert.alert('无法下载', '请稍后重试或访问官网下载。'),
    );
  };

  const openSite = () => {
    Linking.openURL(APP_SITE_URL).catch(() => Alert.alert('无法打开网站链接'));
  };

  const hasNewer = appRelease ? compareVersions(appRelease.tagName, APP_VERSION) > 0 : false;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* 当前版本 */}
      <Text style={s.sectionTitle}>当前版本</Text>
      <View style={s.box}>
        <View style={s.row}>
          <Text style={s.rowLabel}>App 版本</Text>
          <Text style={s.rowValue}>v{APP_VERSION}</Text>
        </View>
      </View>

      {/* App 最新版本（来自 instlab-cloud-m 仓库） */}
      <Text style={s.sectionTitle}>最新版本</Text>
      {appChecking ? (
        <View style={[s.box, s.centerBox]}>
          <ActivityIndicator color={colors.accent} />
          <Text style={s.hint}>正在检查更新…</Text>
        </View>
      ) : appError ? (
        <View style={[s.box, s.centerBox]}>
          <Text style={s.errorText}>{appError}</Text>
          <Pressable style={[s.refreshBtn, s.retryBtn]} onPress={checkApp} disabled={appChecking}>
            <Text style={s.refreshText}>重试</Text>
          </Pressable>
        </View>
      ) : appRelease ? (
        <View style={s.box}>
          <View style={s.row}>
            <Text style={s.rowLabel}>最新版本</Text>
            <Text style={[s.rowValue, hasNewer ? s.newerText : s.latestText]}>
              {appRelease.tagName}
              {hasNewer ? '（有新版本）' : '（已是最新）'}
            </Text>
          </View>
          <Text style={s.rowLabelSmall}>发布时间</Text>
          <Text style={s.rowText}>{formatDate(appRelease.publishedAt)}</Text>
          {!!appRelease.body && (
            <>
              <Text style={s.rowLabelSmall}>更新内容</Text>
              <Text style={s.rowText}>{appRelease.body.slice(0, 500)}</Text>
            </>
          )}
          {/* 下载按钮 */}
          <Pressable
            style={[s.downloadBtn]}
            onPress={openDownload}
          >
            <Text style={s.downloadBtnText}>
              下载 APK（{appRelease.tagName}）
            </Text>
          </Pressable>
          <Text style={s.hint}>点击后在浏览器中下载，下载完成后按系统提示安装。</Text>
        </View>
      ) : (
        <View style={[s.box, s.centerBox]}>
          <Text style={s.hint}>暂无发布版本。构建完成后会自动发布，届时可在此检查更新。</Text>
        </View>
      )}

      {/* 重新检查 App 更新 */}
      <Pressable style={s.refreshBtn} onPress={checkApp} disabled={appChecking}>
        <Text style={s.refreshText}>{appChecking ? '检查中…' : '重新检查'}</Text>
      </Pressable>

      {/* 官网 */}
      <Text style={s.sectionTitle}>官网</Text>
      <View style={s.box}>
        <Text style={s.rowText}>查看 INSTLAB CLOUD M 介绍、版本说明与下载：</Text>
        <Pressable style={s.siteBtn} onPress={openSite}>
          <Text style={s.siteBtnText}>访问官网</Text>
        </Pressable>
      </View>

      <Pressable style={s.backBtn} onPress={() => router.back()}>
        <Text style={s.backText}>返回</Text>
      </Pressable>
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
      marginTop: SPACING.sm,
    },
    box: {
      backgroundColor: COLORS.bg,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: SPACING.md,
      marginBottom: SPACING.md,
    },
    centerBox: { alignItems: 'center', paddingVertical: SPACING.lg },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.xs },
    rowLabel: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
    rowValue: { fontSize: 15, color: COLORS.text, fontWeight: '700' },
    rowLabelSmall: { fontSize: 12, color: COLORS.textLight, marginTop: SPACING.sm },
    rowText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19, marginTop: 2 },
    newerText: { color: COLORS.accent },
    latestText: { color: COLORS.success },
    hint: { fontSize: 12, color: COLORS.textLight, marginTop: SPACING.sm, lineHeight: 17 },
    errorText: { fontSize: 13, color: COLORS.danger, lineHeight: 19 },
    downloadBtn: {
      backgroundColor: COLORS.accent,
      padding: SPACING.sm + 2,
      alignItems: 'center',
      marginTop: SPACING.md,
    },
    downloadBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    refreshBtn: {
      borderWidth: 1,
      borderColor: COLORS.accent,
      padding: SPACING.sm + 2,
      alignItems: 'center',
      marginBottom: SPACING.lg,
    },
    retryBtn: { marginTop: SPACING.md, alignSelf: 'center', paddingHorizontal: SPACING.lg, marginBottom: 0 },
    refreshText: { color: COLORS.accent, fontWeight: '600', fontSize: 14 },
    siteBtn: {
      borderWidth: 1,
      borderColor: COLORS.accent,
      padding: SPACING.sm + 2,
      alignItems: 'center',
      marginTop: SPACING.sm,
    },
    siteBtnText: { color: COLORS.accent, fontWeight: '600', fontSize: 14 },
    backBtn: {
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: SPACING.sm + 2,
      alignItems: 'center',
      backgroundColor: COLORS.bg,
    },
    backText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '500' },
  });
