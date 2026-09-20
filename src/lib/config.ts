// 应用配置
// 后端地址只有公网这一个来源；SERVER_KEY 那套「可切换服务器」从未实现过，已移除。

// 会话（Cookie 头文本）的存储键，以及记录它实际落在哪种存储里
export const SESSION_KEY = 'instab-cloud-session';
export const SESSION_STORE_KEY = 'instab-cloud-session-store';

// GitHub 仓库配置（更新检查用）
export const APP_REPO_CONFIG = {
  owner: 'Irikana',
  repo: 'instlab-cloud-m',
} as const;

export const GITHUB_API = 'https://api.github.com';
