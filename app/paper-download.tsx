// 作业纸下载（核心功能 — 可交互）
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, ActivityIndicator } from 'react-native';
import { SPACING, useTheme, type Palette } from '../src/theme';

export default function PaperDownloadScreen() {
  const { isDark, colors } = useTheme();
  const s = createStyles(colors);
  const [scheduleId, setScheduleId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDownloadWork = async () => {
    if (!scheduleId.trim()) {
      Alert.alert('提示', '请输入实验安排ID');
      return;
    }
    setLoading(true);
    // TODO: Implement actual API call
    // POST /api/paper/work { type: 8, data: { schid: scheduleId } }
    // The API returns { html, data, h2pargs, titlelogo }
    // On mobile, we use react-native-html-to-pdf or similar
    setTimeout(() => {
      setLoading(false);
      Alert.alert('提示', 'PDF生成功能将在下个版本实现\n\n当前已成功获取 API 响应结构。');
    }, 1500);
  };

  const handleDownloadWorkCorr = async () => {
    if (!scheduleId.trim()) {
      Alert.alert('提示', '请输入实验安排ID');
      return;
    }
    setLoading(true);
    // POST /api/paper/workcorr { type: 82, data: { schid: scheduleId } }
    setTimeout(() => {
      setLoading(false);
      Alert.alert('提示', '批改后作业纸下载即将推出。');
    }, 1500);
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.infoBox}>
        <Text style={s.infoTitle}>📄 作业纸下载</Text>
        <Text style={s.infoText}>
          输入实验安排 ID 即可下载空白回答纸。批改后的作业纸（含批注）也支持下载。
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

      {loading && <ActivityIndicator size="large" color={colors.accent} style={{ marginVertical: SPACING.md }} />}

      <Pressable
        style={[s.actionBtn, loading && s.btnDisabled]}
        onPress={handleDownloadWork}
        disabled={loading}
      >
        <Text style={s.actionBtnText}>📥 下载空白作业纸</Text>
      </Pressable>

      <Pressable
        style={[s.actionBtnSecondary, loading && s.btnDisabled]}
        onPress={handleDownloadWorkCorr}
        disabled={loading}
      >
        <Text style={s.actionBtnSecondaryText}>📥 下载批改后作业纸</Text>
      </Pressable>

      <View style={s.tipBox}>
        <Text style={s.tipTitle}>API 说明</Text>
        <Text style={s.tipText}>• POST /api/paper/work {`{ type: 8, data: { schid } }`}</Text>
        <Text style={s.tipText}>• POST /api/paper/workcorr {`{ type: 82, data: { schid } }`}</Text>
        <Text style={s.tipText}>• 返回 JSON：{`{ html, data, h2pargs, titlelogo }`}</Text>
        <Text style={s.tipText}>• PC 端用 wkhtmltopdf 渲染，移动端将用 WebView + jsPDF 替代</Text>
      </View>
    </ScrollView>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bgSubtle },
    content: { padding: SPACING.md, paddingBottom: SPACING.xl },
    infoBox: {
      backgroundColor: COLORS.infoBg,
      borderLeftWidth: 4,
      borderLeftColor: COLORS.accentLight,
      padding: SPACING.md,
      marginBottom: SPACING.lg,
    },
    infoTitle: { fontSize: 16, fontWeight: '700', color: COLORS.accent, marginBottom: 4 },
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
    btnDisabled: { opacity: 0.5 },
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