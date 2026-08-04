// 认证状态管理 — 实现 INSTLAB CLOUD 完整登录流程：
// 1. GET /api/token?id=instlab_cloud_wechat&secret=...&seed={rand}  → 种 app token cookie
// 2. GET /api/captcha  → 返回 SVG 验证码，种 captcha cookie
// 3. POST /api/login {userid, password, captcha, univer} → 返回 userinfo
import { create } from 'zustand';
import { deleteToken, getToken, setToken } from '../lib/auth';
import { saveCookiesFromResponse, cookieHeader, clearCookies } from '../lib/cookies';

const API_BASE = 'https://cloud.instlab.cn';
const APP_ID = 'instlab_cloud_wechat';
const APP_SECRET = 'c98068bd35694260ba49f11fee86c0b7';

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
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
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
    const token = await getToken();
    if (!token) {
      set({ isAuthenticated: false });
      return;
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

      // 保存 token（用 userinfo 或 cookie 中的 token 字段）
      const token = cookieHeader() || String(userinfo.id || '');
      await setToken(token);
      set({
        isAuthenticated: true,
        login: studentId,
        userName: realName || studentId,
        userRole: realRole,
        isTeacher,
        univer,
        loading: false,
        error: null,
      });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
      throw err;
    }
  },

  logout: async () => {
    await deleteToken();
    clearCookies();
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

  clearError: () => set({ error: null }),
}));
