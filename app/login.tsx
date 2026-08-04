// 登录页 — 学号 + 密码 + 验证码（SVG）+ 学校代码
import React, { useState, useEffect } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useAuthStore } from '../src/store/auth-store';
import { SPACING, useTheme, type Palette } from '../src/theme';

/** 解析 SVG 字符串中的 path 元素（简化解析：提取所有 d 属性） */
function extractPaths(svg: string): { d: string; fill?: string; transform?: string }[] {
  const paths: { d: string; fill?: string }[] = [];
  const re = /<path\b([^>]*)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(svg)) !== null) {
    const attrs = m[1];
    const d = /d="([^"]*)"/.exec(attrs);
    const fill = /fill="([^"]*)"/.exec(attrs);
    if (d) {
      paths.push({ d: d[1], fill: fill ? fill[1] : undefined });
    }
  }
  return paths;
}

export default function LoginScreen() {
  const { loginWithCredentials, fetchCaptcha, loading, error, clearError, captchaSvg } = useAuthStore();
  const { isDark, colors } = useTheme();
  const s = createStyles(colors);

  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [univer, setUniver] = useState('jssnu');
  const [showPwd, setShowPwd] = useState(false);

  // 页面加载时获取验证码
  useEffect(() => {
    fetchCaptcha().catch(() => {});
  }, [fetchCaptcha]);

  const handleRefreshCaptcha = () => {
    setCaptcha('');
    fetchCaptcha().catch(() => {});
  };

  const handleLogin = async () => {
    if (!studentId.trim()) { Alert.alert('提示', '请输入学号或工号'); return; }
    if (!password) { Alert.alert('提示', '请输入密码'); return; }
    if (!captcha.trim()) { Alert.alert('提示', '请输入验证码'); return; }
    if (!univer.trim()) { Alert.alert('提示', '请输入学校代码'); return; }
    try {
      await loginWithCredentials(studentId.trim(), password, captcha.trim(), univer.trim());
    } catch {
      // 失败后自动刷新验证码
      handleRefreshCaptcha();
    }
  };

  const svgPaths = captchaSvg ? extractPaths(captchaSvg) : [];

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.header}>
        <View style={s.logoPlaceholder}>
          <Text style={s.logoText}>IC</Text>
        </View>
        <Text style={s.title}>INSTLAB CLOUD M</Text>
        <Text style={s.subtitle}>移动端教学管理</Text>
      </View>

      {/* 学号 */}
      <Text style={s.label}>学号 / 工号</Text>
      <TextInput
        style={s.input}
        value={studentId}
        onChangeText={(v) => { setStudentId(v); if (error) clearError(); }}
        placeholder="请输入学号或工号"
        placeholderTextColor={colors.textLight}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {/* 密码 */}
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

      {/* 学校代码 */}
      <Text style={s.label}>学校代码</Text>
      <TextInput
        style={s.input}
        value={univer}
        onChangeText={setUniver}
        placeholder="例如 jssnu（江苏师范大学）"
        placeholderTextColor={colors.textLight}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {/* 验证码 */}
      <Text style={s.label}>验证码</Text>
      <View style={s.captchaRow}>
        <TextInput
          style={[s.input, { flex: 1, borderRightWidth: 0 }]}
          value={captcha}
          onChangeText={(v) => { setCaptcha(v); if (error) clearError(); }}
          placeholder="输入右侧验证码"
          placeholderTextColor={colors.textLight}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable style={s.captchaBox} onPress={handleRefreshCaptcha}>
          {svgPaths.length > 0 ? (
            <Svg width={128} height={40} viewBox="0 0 128 40">
              {svgPaths.map((p, i) => (
                <Path key={i} d={p.d} fill={p.fill ?? '#1a1a1a'} />
              ))}
            </Svg>
          ) : (
            <Text style={s.captchaLoading}>{loading ? '加载中…' : '点击刷新'}</Text>
          )}
        </Pressable>
      </View>

      {error && (
        <View style={s.errorBox}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}

      <Pressable
        style={[s.loginBtn, loading && s.btnDisabled]}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={s.loginBtnText}>{loading ? '登录中…' : '登录'}</Text>
      </Pressable>

      <Pressable style={s.linkBtn} onPress={handleRefreshCaptcha} disabled={loading}>
        <Text style={s.linkText}>看不清？刷新验证码</Text>
      </Pressable>

      <View style={s.tipBox}>
        <Text style={s.tipTitle}>安全说明</Text>
        <Text style={s.tipText}>• 使用与 PC 端相同的学号和密码</Text>
        <Text style={s.tipText}>• 学校代码为你的学校在 INSTLAB 中的代码（默认 jssnu）</Text>
        <Text style={s.tipText}>• 登录凭证加密存储于设备安全区</Text>
        <Text style={s.tipText}>• 连接 cloud.instlab.cn 公网服务，无需校园内网</Text>
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
      height: 52,
      paddingVertical: 0,
      paddingHorizontal: SPACING.sm + 2,
      fontSize: 16,
      color: COLORS.text,
      backgroundColor: COLORS.bg,
      marginBottom: SPACING.md,
      textAlignVertical: 'center',
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
      height: 52,
      minWidth: 64,
    },
    eyeText: { fontSize: 14, color: COLORS.textSecondary },
    captchaRow: { flexDirection: 'row', alignItems: 'stretch', marginBottom: SPACING.md },
    captchaBox: {
      borderWidth: 1,
      borderLeftWidth: 0,
      borderColor: COLORS.border,
      backgroundColor: COLORS.bgMuted,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: SPACING.xs,
      height: 52,
      minWidth: 150,
    },
    captchaLoading: { fontSize: 12, color: COLORS.textLight },
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
    linkBtn: { alignItems: 'center', marginTop: SPACING.sm },
    linkText: { color: COLORS.accent, fontSize: 13 },
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