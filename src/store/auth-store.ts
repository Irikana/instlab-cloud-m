// 认证状态管理 — 实现 INSTLAB CLOUD 完整登录流程：
// 1. GET /api/token?id=instlab_cloud_wechat&secret=...&seed={rand}  → 种 app token cookie
// 2. GET /api/captcha  → 返回 SVG 验证码，种 captcha cookie
// 3. POST /api/login {userid, password, captcha, univer} → 返回 userinfo
// 会话即服务器种下的 cookie，恢复登录态靠把它持久化并在启动时灌回 cookie 表。
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearSession, getSession, setSession } from '../lib/auth';
import {
  saveCookiesFromResponse,
  cookieHeader,
  clearCookies,
  restoreCookies,
  serializeCookies,
  setCookieListener,
} from '../lib/cookies';
import { API_BASE } from '../lib/api';
import { useTermStore } from './term-store';

const APP_ID = 'instlab_cloud_wechat';
const APP_SECRET = 'c98068bd35694260ba49f11fee86c0b7';

/** 用户信息缓存 key（重新进入 App 时恢复姓名/角色，无需重新登录） */
const USERINFO_KEY = 'instab-cloud-userinfo';

interface AuthState {
  isAuthenticated: boolean | null; // null = 初始化中
  login: string | null;           // 学号/工号
  userName: string | null;        // 姓名
  userRole: string | null;        // 角色
  isTeacher: boolean;            // 是否教师/管理员（PC 端 IsTeacher/IsSchoolAdmin/IsUniversityAdmin）
  univer: string | null;          // 学校代码
  loading: boolean;
  error: string | null;
  /** 验证码 SVG 内容 */
  captchaSvg: string | null;

  init: () => Promise<void>;
  /** 获取 app token + 验证码（登录前调用） */
  fetchCaptcha: () => Promise<string>;
  /** 学号+密码+验证码 登录 */
  loginWithCredentials: (studentId: string, password: string, captcha: string, univer: string) => Promise<void>;
  logout: () => Promise<void>;
  /** 会话被服务器拒绝时清掉本地登录态并带上说明 */
  forceLogout: (reason?: string) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: null,
  login: null,
  userName: null,
  userRole: null,
  isTeacher: false,
  univer: null,
  loading: false,
  error: null,
  captchaSvg: null,

  init: async () => {
    const session = await getSession();
    if (!session) {
      set({ isAuthenticated: false });
      return;
    }
    // 把上次的会话 cookie 灌回内存表，否则所有请求都会以匿名身份发出
    restoreCookies(session);
    if (!cookieHeader()) {
      set({ isAuthenticated: false });
      return;
    }
    // 服务器刷新过的 cookie 也一并存回去
    setCookieListener((serialized) => {
      void setSession(serialized);
    });
    // 从缓存恢复用户信息（姓名/角色/学号/学校），避免重进丢失
    try {
      const raw = await AsyncStorage.getItem(USERINFO_KEY);
      if (raw) {
        const u = JSON.parse(raw);
        set({
          isAuthenticated: true,
          loading: false,
          login: u.login ?? null,
          userName: u.userName ?? null,
          userRole: u.userRole ?? null,
          isTeacher: !!u.isTeacher,
          univer: u.univer ?? null,
        });
        return;
      }
    } catch {
      // 缓存损坏则忽略
    }
    set({ isAuthenticated: true, loading: false });
  },

  fetchCaptcha: async () => {
    set({ loading: true, error: null });
    try {
      // Step 1: 获取 app token cookie
      const seed = Math.floor(Math.random() * 100000);
      const tokenResp = await fetch(
        `${API_BASE}/api/token?id=${APP_ID}&secret=${APP_SECRET}&seed=${seed}`,
        { headers: { Origin: 'http://localhost:9000' } },
      );
      if (!tokenResp.ok) throw new Error('无法连接服务器（获取令牌失败）');
      saveCookiesFromResponse(tokenResp.headers);

      // Step 2: 获取验证码
      const captchaResp = await fetch(`${API_BASE}/api/captcha`, {
        headers: {
          Origin: 'http://localhost:9000',
          Cookie: cookieHeader(),
        },
      });
      if (!captchaResp.ok) throw new Error('无法获取验证码');
      saveCookiesFromResponse(captchaResp.headers);
      const svg = await captchaResp.text();
      set({ captchaSvg: svg, loading: false });
      return svg;
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
      throw err;
    }
  },

  loginWithCredentials: async (studentId: string, password: string, captcha: string, univer: string) => {
    set({ loading: true, error: null });
    try {
      const loginResp = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:9000',
          Cookie: cookieHeader(),
        },
        body: JSON.stringify({
          userid: studentId,
          password,
          captcha,
          univer,
        }),
      });
      if (loginResp.status === 400) throw new Error('验证码错误或已过期，请刷新验证码重试');
      if (!loginResp.ok) throw new Error('登录失败，请核对学生号、密码及验证码');

      const userinfo = await loginResp.json();
      // 登录成功后服务器会更新 session cookie
      saveCookiesFromResponse(loginResp.headers);

      // 真实姓名字段是 username（PC 端 CloudLayout 用 e.userinfo.username）
      // 角色字段：role（数字）+ IsStudent/IsTeacher/IsSchoolAdmin/IsUniversityAdmin 等布尔
      const realName = userinfo.username || userinfo.name || userinfo.realname || '';
      const realRole = userinfo.role !== undefined ? String(userinfo.role) : '';
      const isTeacher = !!(userinfo.IsTeacher || userinfo.IsSchoolAdmin || userinfo.IsUniversityAdmin || userinfo.IsCourseAdmin);

      // 会话就是服务器种下的 cookie；存下来并在冷启动时灌回
      const session = cookieHeader();
      if (!session) throw new Error('登录异常：服务器没有返回会话 cookie');
      await setSession(session);
      setCookieListener((serialized) => {
        void setSession(serialized);
      });
      const profile = {
        login: studentId,
        userName: realName || studentId,
        userRole: realRole,
        isTeacher,
        univer,
      };
      // 缓存用户信息，重新进入 App 时恢复
      try {
        await AsyncStorage.setItem(USERINFO_KEY, JSON.stringify(profile));
      } catch {
        // 缓存失败不阻塞登录
      }
      set({
        isAuthenticated: true,
        ...profile,
        loading: false,
        error: null,
      });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
      throw err;
    }
  },

  logout: async () => {
    setCookieListener(null);
    await clearSession();
    clearCookies();
    useTermStore.getState().reset();
    try {
      await AsyncStorage.removeItem(USERINFO_KEY);
    } catch {
      // 忽略
    }
    set({
      isAuthenticated: false,
      login: null,
      userName: null,
      userRole: null,
      isTeacher: false,
      univer: null,
      error: null,
      captchaSvg: null,
    });
  },

  /** 请求带回 401/403：本地会话已失效，清干净并回到登录页，别让用户对着空列表猜 */
  forceLogout: async (reason?: string) => {
    const message = reason ?? '登录已失效，请重新登录';
    await get().logout();
    set({ error: message });
  },

  clearError: () => set({ error: null }),
}));
