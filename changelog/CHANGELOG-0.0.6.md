# v0.0.6 — 作业纸填充修复 + 更新检查修复 + IC 图标

**构建日期：** 2026-08-04

## 修复

- **检查更新 401**：根因是误用 INSTLAB 登录 token 当作 GitHub Bearer（GitHub 返回 401）。改为纯匿名请求 + User-Agent，公开仓库限流足够
- **作业纸内容空白**：根因是只传了 schid，服务器无法填充内容。改为传完整日程条目 + 当前登录学生信息（学号/姓名/学校）
- **作业纸日期错误（显示下载当天）**：服务器模板用 `new Date()` 生成日期。`buildFullHtml` 现在会把日期替换为作业布置/实验安排日（sch_date），格式 `YYYY年M月D日 (星期X)`
- **作业纸班级/学号/姓名空白**：`buildFullHtml` 新增 `fillAfterLabel`，识别模板中「班级/学号/姓名」标签后的空 `<td>` 并填入当前用户信息
- **课程表**：首页改为灰色不可用（与其他未开发功能一致）

## 改进

- **PDF 字体**：注入中文字体 fallback 栈（Noto Serif SC → Source Han Serif SC / Songti SC / SimSun），缓解 Android 上字体变化
- **软件图标**：改用「IC」文字图标（#00695C 底 + 白色 IC），替换原外部素材图；adaptive icon 同步更新

## 备注

- 作业纸模板里的 DataMatrix 二维码由页面内 JS 动态生成（DATAMatrix 函数），expo-print 渲染时会执行