// 登录页 — 学号 + 密码
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuthStore } from '../src/store/auth-store';
import { SPACING, useTheme, type Palette } from '../src/theme';

export default function LoginScreen() {
  const { loginWithCredentials, loading, error, clearError } = useAuthStore();
  const { isDark, colors } = useTheme();
  const s = createStyles(colors);

  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showServerInput, setShowServerInput] = useState(false);
  const [serverAddress, setServerAddress] = useState('');

  const handleLogin = async () => {
    if (!studentId.trim()) {
      Alert.alert('提示', '请输入学号');
      return;
    }
    if (!password) {
      Alert.alert('提示', '请输入密码');
      return;
    }
    try {
      await loginWithCredentials(studentId.trim(), password, showServerInput ? serverAddress.trim() : undefined);
    } catch {
      // error displayed below
    }
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.header}>
        <View style={s.logoPlaceholder}>
          <Text style={s.logoText}>IC</Text>
        </View>
        <Text style={s.title}>INSTLAB CLOUD M</Text>
        <Text style={s.subtitle}>移动端教学管理</Text>
      </View>

      {/* 学号输入 */}
      <Text style={s.label}>学号</Text>
      <TextInput
        style={s.input}
        value={studentId}
        onChangeText={(v) => { setStudentId(v); if (error) clearError(); }}
        placeholder="请输入学号"
        placeholderTextColor={colors.textLight}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="default"
      />

      {/* 密码输入 */}
      <Text style={s.label}>密码</Text>
      <View style={s.inputRow}>
        <TextInput
          style={[s.input, { flex: 1, borderRightWidth: 0 }]}
          value={password}
          onChangeText={(v) => { setPassword(v); if (error) clearError(); }}
          placeholder="请输入密码"
          placeholderTextColor={colors.textLight}
          secureTextEntry={!showPwd}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable style={s.eyeBtn} onPress={() => setShowPwd((v) => !v)}>
          <Text style={s.eyeText}>{showPwd ? '隐藏' : '显示'}</Text>
        </Pressable>
      </View>

      {error && (
        <View style={s.errorBox}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}

      {/* 服务器地址（可折叠） */}
      <Pressable style={s.serverToggle} onPress={() => setShowServerInput((v) => !v)}>
        <Text style={s.serverToggleText}>
          {showServerInput ? '▼' : '▶'} 服务器地址（可选，暑假在家请询问管理员）
        </Text>
      </Pressable>
      {showServerInput && (
        <TextInput
          style={s.input}
          value={serverAddress}
          onChangeText={setServerAddress}
          placeholder="例如 192.168.1.100 或 vpn.xxx.edu.cn"
          placeholderTextColor={colors.textLight}
          autoCapitalize="none"
          autoCorrect={false}
        />
      )}

      <Pressable
        style={[s.loginBtn, loading && s.btnDisabled]}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={s.loginBtnText}>
          {loading ? '登录中…' : '登录'}
        </Text>
      </Pressable>

      <View style={s.tipBox}>
        <Text style={s.tipTitle}>安全说明</Text>
        <Text style={s.tipText}>• 使用你在实验室 PC 端相同的学号和密码</Text>
        <Text style={s.tipText}>• 密码加密传输，不在设备本地保存明文</Text>
        <Text style={s.tipText}>• Token 加密存储于设备安全区</Text>
        <Text style={s.tipText}>• 需连接校园内网或配置 VPN</Text>
      </View>
    </ScrollView>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bgSubtle },
    content: { padding: SPACING.lg, paddingBottom: SPACING.xl },
    header: { alignItems: 'center', marginBottom: SPACING.xl, marginTop: SPACING.xl },
    logoPlaceholder: {
      width: 80,
      height: 80,
      borderRadius: 20,
      backgroundColor: COLORS.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.sm,
    },
    logoText: { fontSize: 32, fontWeight: '800', color: '#fff' },
    title: { fontSize: 26, fontWeight: '700', color: COLORS.accent },
    subtitle: { fontSize: 14, color: COLORS.textLight, marginTop: 4 },
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
    inputRow: { flexDirection: 'row', alignItems: 'stretch', marginBottom: SPACING.md },
    eyeBtn: {
      borderWidth: 1,
      borderLeftWidth: 0,
      borderColor: COLORS.border,
      paddingHorizontal: SPACING.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.bgMuted,
    },
    eyeText: { fontSize: 13, color: COLORS.textSecondary },
    errorBox: {
      backgroundColor: COLORS.dangerBg,
      borderLeftWidth: 4,
      borderLeftColor: COLORS.danger,
      padding: SPACING.sm + 2,
      marginBottom: SPACING.md,
    },
    errorText: { fontSize: 13, color: COLORS.danger, lineHeight: 18 },
    loginBtn: {
      backgroundColor: COLORS.accent,
      padding: SPACING.md,
      alignItems: 'center',
      marginTop: SPACING.sm,
    },
    btnDisabled: { opacity: 0.5 },
    loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    serverToggle: {
      paddingVertical: SPACING.sm,
      marginBottom: SPACING.xs,
    },
    serverToggleText: { fontSize: 13, color: COLORS.accent, fontWeight: '500' },
    tipBox: {
      marginTop: SPACING.xl,
      padding: SPACING.md,
      backgroundColor: COLORS.bg,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    tipTitle: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: SPACING.xs },
    tipText: { fontSize: 12, color: COLORS.textLight, lineHeight: 18 },
  });