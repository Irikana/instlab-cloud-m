// 根布局 + Auth Gate
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack, useSegments, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../src/store/auth-store';
import { useSettingsStore } from '../src/store/settings-store';
import { useTheme, type Palette } from '../src/theme';

export default function RootLayout() {
  const { isAuthenticated, init } = useAuthStore();
  const settingsInit = useSettingsStore((s) => s.init);
  const segments = useSegments();
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const s = createStyles(colors);

  useEffect(() => {
    init();
    settingsInit();
  }, [init, settingsInit]);

  useEffect(() => {
    if (isAuthenticated === null) return;

    const onLoginRoute = segments[0] === 'login';

    if (!isAuthenticated && !onLoginRoute) {
      router.replace('/login');
    } else if (isAuthenticated && onLoginRoute) {
      router.replace('/');
    }
  }, [isAuthenticated, segments, router]);

  const showSplash = isAuthenticated === null;

  return (
    <View style={s.container}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.accent,
          headerTitleStyle: { fontWeight: '600' },
          headerTitleAlign: 'center',
          contentStyle: { backgroundColor: colors.bgSubtle },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'INSTLAB CLOUD M' }} />
        <Stack.Screen name="login" options={{ title: '登录', headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: '设置' }} />
        <Stack.Screen name="paper-download" options={{ title: '下载作业纸' }} />
        <Stack.Screen name="report" options={{ title: '实验报告' }} />
        <Stack.Screen name="data-report" options={{ title: '实验数据' }} />
        <Stack.Screen name="schedule" options={{ title: '课程表' }} />
        <Stack.Screen name="files" options={{ title: '文件管理' }} />
      </Stack>
      {showSplash && (
        <View style={s.splashOverlay}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      )}
    </View>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    splashOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.bg,
    },
  });