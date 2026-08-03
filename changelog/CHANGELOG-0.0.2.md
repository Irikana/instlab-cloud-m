# 更新日志

## v0.0.2 — 登录重构（真实流程）

> 版本序列：v0.1.0（纪念版，保留）→ v0.0.1（首个可构建版本）→ **v0.0.2（本版）**
> 每个版本各有其意义，版本号不重叠：0.1.0 是纪念版；0.0.1 是旧登录流程的首个可运行版本；0.0.2 是登录重构版。

### 登录功能重构（本版核心）
通过逆向分析 cloud.instlab.cn 前端 JS（CloudLayout chunk），还原了真实的 PC 端登录流程：
1. `GET /api/token?id=instlab_cloud_wechat&secret=...&seed={随机}` → 获取 app token cookie
2. `GET /api/captcha` → 获取 **SVG 验证码**（128×40）
3. `POST /api/login` → `{userid, password, captcha, univer}` → 返回用户信息

**之前 v0.0.1 的错误**：直接调用不存在的 `GET /api/userinfo`（返回 404），且完全没有验证码步骤 → 登录必然失败。

**本版变更**：
- 新增 cookie 管理模块（`src/lib/cookies.ts`）：手动解析 Set-Cookie 并回传
- 重写 `auth-store.ts`：实现 token → captcha → login 完整流程
- 重写登录页：SVG 验证码显示（react-native-svg）、学校代码输入框（默认 jssnu = 江苏师范大学）、验证码刷新、登录失败自动刷新验证码
- 确认 API 全部位于公网 `cloud.instlab.cn`，**无需校园内网**（与 PC 端一致）

### 构建系统修复（重要）
- **修复假成功 bug**：`./gradlew assembleRelease ... | tee build.log` 管道会吞掉 Gradle 的失败退出码（tee 返回 0），导致步骤显示成功但实际无 APK 产出。
  已加 `set -o pipefail` 并新增 **Verify APK exists** 步骤，确保构建失败会真实报错。
- 构建失败时自动上传 `gradle-build-log` / `gradle-problems-report` artifact 供排查。

### 说明
- 首页/登录页 Logo 为纯代码绘制，无版权问题
- 设置页「关于」含学习用途声明
- 版本号约定：0.1.0 永久保留给纪念版，未来 0.0.x → 0.1.1 起跳