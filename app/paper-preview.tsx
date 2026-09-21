// 作业纸 WebView 预览 + 打印/下载（模拟 PC 端 WebView2 行为）
// 流程：调 API → 读 h2pargs 定版心 → buildBaseDocument → WebView 测量分页 → 打印或下载 PDF
// 分页与打印共用同一份文档，不再存在第二条出图路径。
import React, { createRef, useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
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
import { SPACING, useTheme, type Palette } from '../src/theme';
import { mmToPx } from '../src/lib/paper-geometry';
import { isUnauthorized } from '../src/lib/api';
import { useAuthStore } from '../src/store/auth-store';
import {
  assemblePaginatedDoc,
  barcodePrefixFor,
  buildBaseDocument,
  buildPaginateScript,
  exportDocPdf,
  fetchPaper,
  geometryForPayload,
  paperFileName,
  paperIdOf,
  printPageSize,
  readPaginateMessage,
  withFlatHeader,
  type PaperKind,
  type PaperRenderOptions,
} from '../src/lib/paper';

export default function PaperPreviewScreen() {
  const { colors } = useTheme();
  const s = createStyles(colors);
  const router = useRouter();
  const forceLogout = useAuthStore((st) => st.forceLogout);
  const params = useLocalSearchParams<{
    schid: string;
    kind: 'work' | 'workcorr';
    title?: string;
    data?: string;
  }>();

  const schid = params.schid ?? '';
  const kind = (params.kind ?? 'work') as PaperKind;
  const displayTitle = params.title ?? '作业纸';
  const requestData = (() => {
    if (!params.data) return { schid };
    try {
      const parsed = JSON.parse(params.data);
      return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : { schid };
    } catch {
      return { schid };
    }
  })();

  const [opts, setOpts] = useState<PaperRenderOptions | null>(null);
  const [baseDoc, setBaseDoc] = useState<string | null>(null);
  const [printDoc, setPrintDoc] = useState<string | null>(null);
  const [measured, setMeasured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  /** 降级说明：分页没做成时告诉用户当前是连续文档，不挡在加载页前面 */
  const [notice, setNotice] = useState<string | null>(null);
  /** 作业 ID 取自哪个字段，显示出来便于和电脑版核对 */
  const [idSource, setIdSource] = useState('');
  /** 测量 WebView 与"只注入一次"的标记 */
  const measureRef = createRef<ComponentRef<typeof WebView>>();
  const injectedRef = useRef(false);

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
    setBaseDoc(null);
    setPrintDoc(null);
    setMeasured(false);
    setOpts(null);
    setPageCount(0);
    setNotice(null);
    setIdSource('');
    injectedRef.current = false;
    try {
      const payload = await fetchPaper(kind, requestData);
      const html = payload.html ?? '';
      if (!html) throw new Error('服务器未返回 HTML 模板');
      const renderData = { ...requestData, ...(payload.data ?? {}) };
      // PC 条码内容使用服务器返回的作业记录 ID，前缀使用 filetypeid
      const { id: paperId, from: idFrom } = paperIdOf(payload, requestData);
      setIdSource(paperId ? idFrom : '');
      const built: PaperRenderOptions = {
        geometry: geometryForPayload(payload),
        barcodePrefix: barcodePrefixFor(payload, kind),
        paperId,
        titlelogo: payload.titlelogo,
      };
      const doc = buildBaseDocument(html, renderData, built);
      setOpts(built);
      setBaseDoc(doc);
      // 拿不到作业 ID 就没有身份条码，按未分页文档直接展示/打印
      if (!paperId) {
        setPrintDoc(withFlatHeader(doc, built));
        setMeasured(true);
        setNotice('服务器未返回作业 ID，本机不生成逐页身份条码；正式提交扫描作业请使用电脑端。');
      }
    } catch (e) {
      if (isUnauthorized(e)) {
        void forceLogout('登录已失效，请重新登录后再打开作业纸');
        return;
      }
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  /** 测量 WebView 回传：把每页内容拼成最终打印文档 */
  const onMeasureMessage = (event: { nativeEvent: { data?: string } }) => {
    const msg = readPaginateMessage(event.nativeEvent.data ?? '');
    if (msg.kind === 'ignore') return;
    if (msg.kind === 'error') {
      if (baseDoc && opts) setPrintDoc(withFlatHeader(baseDoc, opts));
      setMeasured(true);
      setNotice('自动分页未完成（' + msg.message + '），当前为连续文档，页数由打印机自行决定。');
      return;
    }
    if (!baseDoc || !opts) return;
    const assembled = assemblePaginatedDoc(baseDoc, msg.pages, opts);
    setPrintDoc(assembled);
    setPageCount(msg.pages.length);
    setMeasured(true);
  };

  /**
   * 看门狗：测量脚本万一没回传（WebView 被系统回收、脚本被更早地打断等），
   * 不能永远停在测量页上什么都不说。超时就用连续文档兜底并写明原因。
   */
  useEffect(() => {
    if (loading || measured || !baseDoc || !opts) return;
    const t = setTimeout(() => {
      setPrintDoc(withFlatHeader(baseDoc, opts));
      setNotice('测量分页没有回应，已退回连续文档；打印时由分页器自行断页。');
      setMeasured(true);
    }, 12000);
    return () => clearTimeout(t);
  }, [loading, measured, baseDoc, opts]);

  /** 手机屏上把一版宽度的文档缩到屏幕宽（仅展示阶段，不影响打印产物） */
  const pageWidthPx = opts ? Math.round(opts.geometry.pageWidthPx) : Math.round(mmToPx(210));
  const injectedJs = `
    (function() {
      var meta = document.querySelector('meta[name="viewport"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'viewport';
        document.head.appendChild(meta);
      }
      meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=3.0';
      var pageW = ${pageWidthPx};
      var screenW = window.innerWidth;
      var scale = Math.min(1, screenW / pageW);
      if (scale < 1) {
        var wrap = document.createElement('div');
        wrap.style.cssText = 'width:' + (100 / scale) + '%;transform:scale(' + scale + ');transform-origin:top left;';
        while (document.body.firstChild) wrap.appendChild(document.body.firstChild);
        document.body.appendChild(wrap);
        document.body.style.margin = '0';
      }
    })();
    true;
  `;

  // 打印 — 同 PC 端"打印"行为
  const handlePrint = async () => {
    if (!printDoc || !opts) return;
    setProcessing(true);
    try {
      await Print.printAsync({ html: printDoc, ...printPageSize(opts.geometry) });
    } catch (e) {
      Alert.alert('打印失败', (e as Error).message);
    } finally {
      setProcessing(false);
    }
  };

  // 下载 PDF — 与预览完全同一份已排版文档
  const handleDownloadPdf = async () => {
    if (!printDoc || !opts) return;
    setProcessing(true);
    try {
      const datePart = String(requestData.sch_date ?? requestData.paper_datestring ?? '');
      const fileName = paperFileName(kind, displayTitle, String(requestData.userid ?? ''), String(requestData.studentname ?? ''), datePart, 'pdf');
      const res = await exportDocPdf(printDoc, opts.geometry, fileName);
      if (!res.shared) Alert.alert('PDF 已生成', res.uri);
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
      ) : opts && baseDoc && !measured ? (
        // 第一遍：按 h2pargs 给出的版心测量分页，生成逐页条码
        // 用 onLoadEnd 之后再注入，而不是 injectedJavaScript：后者在 Android 上可能
        // 早于文档解析完成，量到空 body 就再也不回传，界面会安静地卡在这一页
        <WebView
          ref={measureRef}
          style={s.webview}
          source={{ html: baseDoc }}
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
          onLoadEnd={() => {
            if (injectedRef.current) return;
            injectedRef.current = true;
            measureRef.current?.injectJavaScript(buildPaginateScript(opts) + ';true;');
          }}
          onMessage={onMeasureMessage}
          onError={() => setError('WebView 加载失败')}
        />
      ) : printDoc ? (
        <WebView
          style={s.webview}
          source={{ html: printDoc }}
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
      {printDoc && opts && (
        <View style={s.toolbar}>
          {!!notice && <Text style={s.notice}>{notice}</Text>}
          <View style={s.toolbarRow}>
            <Pressable
              style={[s.toolBtn, s.toolBtnPrimary, processing && s.btnDisabled]}
              disabled={processing}
              onPress={handlePrint}
            >
              {processing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.toolBtnPrimaryText}>打印</Text>
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
                <Text style={s.toolBtnSecondaryText}>下载 PDF</Text>
              )}
            </Pressable>
          </View>
          <Text style={s.toolbarMeta}>
            {pageCount > 0 ? pageCount + ' 页' : '未分页'}
            {idSource ? ' · 作业ID 取自 ' + idSource : ''}
            {opts.geometry.explicit
              ? ` · 版心 ${Math.round(opts.geometry.contentWidthMm)}×${Math.round(opts.geometry.contentHeightMm)}mm（取自服务器参数）`
              : ' · 服务器未给页面参数，版心按 A4 / 10mm 边距'}
          </Text>
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
      backgroundColor: COLORS.bg,
      borderTopWidth: 1,
      borderTopColor: COLORS.border,
      padding: SPACING.sm,
      gap: SPACING.sm,
    },
    toolbarRow: {
      flexDirection: 'row',
      gap: SPACING.sm,
    },
    notice: {
      fontSize: 12,
      color: COLORS.textSecondary,
      lineHeight: 17,
    },
    toolbarMeta: {
      fontSize: 11,
      color: COLORS.textLight,
    },
    toolBtn: {
      flex: 1,
      paddingVertical: SPACING.md,
      alignItems: 'center',
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