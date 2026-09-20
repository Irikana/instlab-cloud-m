// 学期状态 — 电脑版可以在多个学期之间切换查看工作，手机端此前写死取列表第一项。
// 这里把学期列表与"当前学期"提成全局状态并持久化：换学期只需改一次，
// 下次进入 App 仍停在上次看的学期，而不是每次都跳回最新学期。
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchTermList, type Term } from '../lib/schedule';

/** 当前学期在 AsyncStorage 中的键 */
const TERM_KEY = 'instab-cloud-term';

interface TermState {
  terms: Term[];
  /** 当前学期 id；null = 尚未确定 */
  currentId: string | null;
  loading: boolean;
  error: string | null;
  /** 拉取学期列表（已拉过则直接复用），并决定当前学期 */
  loadTerms: (force?: boolean) => Promise<Term[]>;
  /** 切换学期并记住它 */
  setTerm: (id: string) => Promise<void>;
  /** 登出时清空，避免换个账号还留着上一个用户的学期 */
  reset: () => void;
}

export const useTermStore = create<TermState>((set, get) => ({
  terms: [],
  currentId: null,
  loading: false,
  error: null,

  loadTerms: async (force = false) => {
    const { terms, currentId, loading } = get();
    if (!force && terms.length > 0 && (currentId || loading)) return terms;
    set({ loading: true, error: null });
    try {
      const list = await fetchTermList();
      if (list.length === 0) {
        set({ terms: [], currentId: null, loading: false, error: '未获取到学期列表，请检查登录状态' });
        return [];
      }
      // 列表顺序由服务器决定（电脑版也是原样展示），第一项即最新学期
      let saved: string | null = null;
      try {
        saved = await AsyncStorage.getItem(TERM_KEY);
      } catch {
        saved = null;
      }
      const keep = saved && list.some((t) => t.id === saved) ? saved : list[0].id;
      set({ terms: list, currentId: keep, loading: false });
      return list;
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
      throw e;
    }
  },

  setTerm: async (id: string) => {
    set({ currentId: id });
    try {
      await AsyncStorage.setItem(TERM_KEY, id);
    } catch {
      // 记不住不影响本次查看，下次进入回到默认学期
    }
  },

  reset: () => set({ terms: [], currentId: null, loading: false, error: null }),
}));
