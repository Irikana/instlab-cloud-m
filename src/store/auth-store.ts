// 认证状态管理
import { create } from 'zustand';
import { deleteToken, getToken, setToken } from '../lib/auth';
import { API_CONFIG } from '../lib/config';

interface AuthState {
  isAuthenticated: boolean | null; // null = 初始化中
  login: string | null;           // 学号/用户名
  userName: string | null;        // 真实姓名
  userRole: string | null;        // 角色
  serverAddr: string | null;      // 内网服务器地址
  loading: boolean;
  error: string | null;

  init: () => Promise<void>;
  /** 学号+密码登录 */
  loginWithCredentials: (studentId: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: null,
  login: null,
  userName: null,
  userRole: null,
  serverAddr: null,
  loading: false,
  error: null,

  init: async () => {
    const token = await getToken();
    if (!token) {
      set({ isAuthenticated: false });
      return;
    }
    // 有 token 就视为已认证（后续可做 token 有效性校验）
    set({ isAuthenticated: true, loading: false });
  },

  loginWithCredentials: async (studentId: string, password: string) => {
    set({ loading: true, error: null });
    try {
      // Step 1: 从 cloud.instlab.cn 获取内网服务器地址
      const userResp = await fetch(`${API_CONFIG.baseURL}/api/userinfo`);
      if (!userResp.ok) throw new Error('无法连接服务器，请检查网络');
      const userData = await userResp.json();
      const server = userData.server;
      if (!server) throw new Error('未获取到服务器地址');

      // Step 2: 用学号和密码登录内网服务器
      const loginResp = await fetch(`http://${server}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userid: studentId, password }),
      });
      if (!loginResp.ok) {
        if (loginResp.status === 401 || loginResp.status === 403) {
          throw new Error('学号或密码错误');
        }
        throw new Error('登录失败，请检查网络连接');
      }
      const loginData = await loginResp.json();
      const token = loginData.token;

      if (!token) throw new Error('登录响应异常，未获取到令牌');

      await setToken(token);
      set({
        isAuthenticated: true,
        login: studentId,
        userName: loginData.name || studentId,
        userRole: userData.role || '',
        serverAddr: server,
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
    set({
      isAuthenticated: false,
      login: null,
      userName: null,
      userRole: null,
      serverAddr: null,
      error: null,
    });
  },

  clearError: () => set({ error: null }),
}));