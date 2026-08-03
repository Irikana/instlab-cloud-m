# 更新日志

## v0.1.0 — 初始版本

### 灵感来源
基于 **INSTLAB CLOUD Lite v3.0**（PC 端）的功能分析，以及 **SlyWrite**（牧羊人图书馆写作管理 App）的 UI/UX 设计模式。

### 从 PC 端搬运的功能
- **作业纸下载**（核心）：调用 `POST /api/paper/work` 下载空白回答纸，`POST /api/paper/workcorr` 下载批改后作业纸
- **学号+密码登录**：和 PC 客户端一致的认证流程（`GET /api/userinfo` → `POST {server}/login`）
- **预计后续支持**：实验报告提交、实验数据管理、课程表、文件管理

### 新增功能
- 学号+密码手动输入登录页
- 首页 2 列功能卡片网格
- 5 套主题配色（浅色/深色/Cloud Lite 浅色/Cloud Lite 深色/跟随系统）
- 设置页主题切换
- GitHub Actions 自动构建 APK

### 技术栈
- Expo (React Native) + expo-router + TypeScript
- Zustand 状态管理
- AsyncStorage 持久化 + SecureStore 令牌加密存储

### 构建说明
- GitHub Actions 自动构建：推送至 main/master 分支自动触发
- 本地构建：`npx expo prebuild --platform android --clean` → `cd android && ./gradlew assembleRelease`