# 更新日志

## v0.0.1 — 版本重编号 + 登录可用性修复

> 注：此前有一个 **v0.1.0 初始版本**（GitHub Release 与 `CHANGELOG-0.1.0.md` 均保留，作为首个构建成功的版本留念）。
> 从本版本起，版本号重新从 **0.0.1** 开始编号。

### 版本号约定（重要）
- **0.1.0 永久保留给纪念版**，未来不再使用该版本号
- 版本演进：0.0.1 → 0.0.2 → … → 0.0.x → **0.1.1** → 0.1.2 → …（从 0.0.x 升到 0.1.x 时从 0.1.1 开始）

### 登录功能重构（关键修复）
通过逆向分析 cloud.instlab.cn 前端 JS（CloudLayout chunk），还原了**真实的 PC 端登录流程**：
1. `GET /api/token?id=instlab_cloud_wechat&secret=...&seed={随机}` → 获取 app token cookie
2. `GET /api/captcha` → 获取 **SVG 验证码**（128×40）
3. `POST /api/login` → `{userid, password, captcha, univer}` → 返回用户信息

**之前的错误**：旧版直接 `GET /api/userinfo`（该路径不存在，返回 404）且完全没有验证码步骤，导致登录必然失败。

**本次变更**：
- 新增 cookie 管理模块（`src/lib/cookies.ts`），手动管理 token/captcha/session cookie
- 重写 `auth-store.ts`：实现 token → captcha → login 完整流程
- 重写登录页：新增**验证码输入框 + SVG 验证码显示**（react-native-svg 渲染）、**学校代码输入框**（默认 jssnu = 江苏师范大学）
- 登录失败自动刷新验证码
- 确认 API 全部位于公网 `cloud.instlab.cn`，**无需校园内网**（PC 在家能登录正是因为如此）

### 其他
- **Android 明文 HTTP 访问**：开启 `usesCleartextTraffic`（兼容内网 HTTP 场景）
- 设置页版本号改为从 app.json 动态读取

### 说明
- 首页/登录页 Logo 为纯代码绘制，无版权问题
- 设置页「关于」含学习用途声明