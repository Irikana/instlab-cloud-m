// 作业纸 WebView 预览 + 打印/下载（模拟 PC 端 WebView2 行为）
// 流程：调 API → buildFullHtml → WebView 展示 → 打印或下载 PDF
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { SPACING, useTheme, type Palette } from '../src/theme';
import { fetchPaper, buildFullHtml, type PaperKind } from '../src/lib/paper';

export default function PaperPreviewScreen() {
  const { colors } = useTheme();
  const s = createStyles(colors);
  const router = useRouter();
  const params = useLocalSearchParams<{
    schid: string;
    kind: 'work' | 'workcorr';
    title?: string;
    date?: string;
  }>();

  const schid = params.schid ?? '';
  const kind = (params.kind ?? 'work') as PaperKind;
  const displayTitle = params.title ?? '作业纸';

  const [fullHtml, setFullHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  // 加载作业纸
  useEffect(() => {
    if (!schid) {
      setError('缺少实验安排 ID（schid）');
      setLoading(false);
      return;
    }
    loadPaper();
  }, [schid, kind]);

  async function loadPaper() {
    setLoading(true);
    setError(null);
    setFullHtml(null);
    try {
      const payload = await fetchPaper(kind, { schid });
      const html = payload.html ?? '';
      if (!html) throw new Error('服务器未返回 HTML 模板');
      const built = buildFullHtml(html, payload.data ?? {}, payload.titlelogo);
      setFullHtml(built);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // 注入 JS：在手机屏上缩放 A4 内容
  const injectedJs = `
    (function() {
      var meta = document.querySelector('meta[name="viewport"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'viewport';
        document.head.appendChild(meta);
      }
      meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=3.0';

      // 缩放 A4 内容适配手机窄屏
      var screenW = window.innerWidth;
      var targetW = 816;
      var scale = Math.min(1, screenW / targetW);
      if (scale < 1) {
        document.body.style.transform = 'scale(' + scale + ')';
        document.body.style.transformOrigin = 'top left';
        document.body.style.width = (100 / scale) + '%';
        document.body.style.margin = '0';
        document.body.style.padding = '0';
      }
    })();
    true;
  `;

  // 打印 — 同 PC 端"打印"行为
  const handlePrint = async () => {
    if (!fullHtml) return;
    setProcessing(true);
    try {
      // Print.printAsync 调出系统打印对话框，用户可打印或保存为 PDF
      await Print.printAsync({ html: fullHtml });
    } catch (e) {
      Alert.alert('打印失败', (e as Error).message);
    } finally {
      setProcessing(false);
    }
  };

  // 下载 PDF — 同 PC 端"下载"行为
  const handleDownloadPdf = async () => {
    if (!fullHtml) return;
    setProcessing(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: fullHtml });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: displayTitle || '作业纸',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('PDF 已生成', uri);
      }
    } catch (e) {
      Alert.alert('下载失败', (e as Error).message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={s.container}>
      {/* 顶部导航 */}
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backText}>← 返回</Text>
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>
          {displayTitle || '作业纸'}
        </Text>
        <View style={s.headerRight} />
      </View>

      {/* 主体内容 */}
      {loading ? (
        <View style={s.centerBox}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={s.loadingText}>加载作业纸中…</Text>
        </View>
      ) : error ? (
        <View style={s.centerBox}>
          <Text style={s.errorTitle}>加载失败</Text>
          <Text style={s.errorText}>{error}</Text>
          <Pressable style={s.retryBtn} onPress={loadPaper}>
            <Text style={s.retryText}>重试</Text>
          </Pressable>
        </View>
      ) : fullHtml ? (
        <WebView
          style={s.webview}
          source={{ html: fullHtml }}
          originWhitelist={['*']}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          renderLoading={() => (
            <ActivityIndicator
              size="large"
              color={colors.accent}
              style={s.webviewLoading}
            />
          )}
          injectedJavaScript={injectedJs}
          onError={() => setError('WebView 加载失败')}
        />
      ) : null}

      {/* 底部工具栏 */}
      {fullHtml && (
        <View style={s.toolbar}>
          <Pressable
            style={[s.toolBtn, s.toolBtnPrimary, processing && s.btnDisabled]}
            disabled={processing}
            onPress={handlePrint}
          >
            {processing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.toolBtnPrimaryText}>🖨️ 打印</Text>
            )}
          </Pressable>
          <Pressable
            style={[s.toolBtn, s.toolBtnSecondary, processing && s.btnDisabled]}
            disabled={processing}
            onPress={handleDownloadPdf}
          >
            {processing ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Text style={s.toolBtnSecondaryText}>⬇ 下载 PDF</Text>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const createStyles = (COLORS: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.bgSubtle,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.bg,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.sm,
    },
    backBtn: {
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
    },
    backText: {
      fontSize: 15,
      color: COLORS.accent,
      fontWeight: '600',
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: 16,
      fontWeight: '700',
      color: COLORS.text,
      marginHorizontal: SPACING.sm,
    },
    headerRight: {
      width: 60,
    },

    // 居中状态
    centerBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: SPACING.xl,
    },
    loadingText: {
      marginTop: SPACING.md,
      fontSize: 14,
      color: COLORS.textSecondary,
    },
    errorTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: COLORS.danger,
      marginBottom: SPACING.sm,
    },
    errorText: {
      fontSize: 13,
      color: COLORS.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: SPACING.lg,
    },
    retryBtn: {
      borderWidth: 1,
      borderColor: COLORS.accent,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.sm,
    },
    retryText: {
      fontSize: 14,
      color: COLORS.accent,
      fontWeight: '600',
    },

    // WebView
    webview: {
      flex: 1,
      backgroundColor: COLORS.bg,
    },
    webviewLoading: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      marginLeft: -20,
      marginTop: -20,
    },

    // 底部工具栏
    toolbar: {
      flexDirection: 'row',
      backgroundColor: COLORS.bg,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
      padding: SPACING.sm,
      gap: SPACING.sm,
    },
    toolBtn: {
      flex: 1,
      paddingVertical: SPACING.md,
      alignItems: 'center',
      borderRadius: 4,
    },
    toolBtnPrimary: {
      backgroundColor: COLORS.accent,
    },
    toolBtnPrimaryText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '700',
    },
    toolBtnSecondary: {
      borderWidth: 1,
      borderColor: COLORS.accent,
    },
    toolBtnSecondaryText: {
      color: COLORS.accent,
      fontSize: 15,
      fontWeight: '700',
    },
    btnDisabled: {
      opacity: 0.5,
    },
  });