// API 配置
export const API_CONFIG = {
  baseURL: 'https://cloud.instlab.cn',
  // 登录流程：GET /api/userinfo → POST {server}/login
} as const;

// Token 在 SecureStore 中的键名
export const TOKEN_KEY = 'instab-cloud-token';

// SecureStore key for server address
export const SERVER_KEY = 'instab-cloud-server';

// GitHub 仓库配置（更新检查用）
export const APP_REPO_CONFIG = {
  owner: 'Irikana',
  repo: 'instlab-cloud-m',
} as const;

export const GITHUB_API = 'https://api.github.com';