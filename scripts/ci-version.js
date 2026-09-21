// 构建号注入 —— 与 SlyWrite Lite 的 scripts/ci-version.js 同源，本仓库自持一份。
//
// 为什么必须有：expo prebuild 生成的 android/app/build.gradle 里 versionCode 恒为 1，
// 于是所有 APK 在 Android 看来是同一个版本——装新的会被拒或被视为覆盖，
// 用户根本分不清自己装到的到底是哪一次构建（v0.0.12 的包里显示 0.0.11 就是这个坑引出来的）。
//
// 规则（见工作区 AGENTS.md「版本号规则（全软件统一）」）：
//   仓库里只维护三位正式版本 A.B.C；第四位是测试构建号，由 CI 注入、不提交。
//   测试构建（推分支 / 手动触发）：版本写成 A.B.C-<run_number>，产物与「关于」页都能看到构建号。
//   正式构建（推 vA.B.C tag）：版本字符串保持三段，但 versionCode 仍用构建号填，
//     否则装过测试包的设备会被更低的 versionCode 挡住装不上正式包。
//
// 用法：node scripts/ci-version.js <run_number> [--official]
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APP_JSON = path.join(ROOT, 'app.json');
const PKG_JSON = path.join(ROOT, 'package.json');

const args = process.argv.slice(2);
const official = args.includes('--official');
const buildNo = Number(args.find((a) => /^\d+$/.test(a)));

if (!Number.isFinite(buildNo) || buildNo <= 0) {
  console.error('用法: node scripts/ci-version.js <run_number> [--official]  —— run_number 必须是正整数');
  process.exit(1);
}

const pkgRaw = fs.readFileSync(PKG_JSON, 'utf8');
const appRaw = fs.readFileSync(APP_JSON, 'utf8');
const base = JSON.parse(pkgRaw).version;
if (!/^\d+\.\d+\.\d+$/.test(base)) {
  console.error(`仓库里的版本号应为三段正式版本，现在是 ${base}；请把第四位留给本脚本注入。`);
  process.exit(1);
}

const display = official ? base : `${base}-${buildNo}`;

// 用字符串替换而不是 JSON.parse→stringify，避免整份文件被重新格式化、
// 也把 BOM 与行尾差异的可能性排除掉（本仓库曾因 BOM 让 expo prebuild 直接失败）
function replaceVersion(raw, value) {
  const next = raw.replace(/("version":\s*")([^"]+)(")/, `$1${value}$3`);
  if (next === raw && !raw.includes(`"${value}"`)) throw new Error('没找到 version 字段，app.json/package.json 结构变了');
  return next;
}

function withVersionCode(raw, value) {
  if (/"versionCode"\s*:\s*\d+/.test(raw)) return raw.replace(/("versionCode"\s*:\s*)\d+/, `$1${value}`);
  // 插到 android.package 之后，保持 android 段内字段聚在一起
  const next = raw.replace(/("android"\s*:\s*\{)/, `$1\n      "versionCode": ${value},`);
  if (next === raw) throw new Error('app.json 里没有 android 段，无法写入 versionCode');
  return next;
}

try {
  fs.writeFileSync(PKG_JSON, replaceVersion(pkgRaw, display));
  let app = replaceVersion(appRaw, display);
  app = withVersionCode(app, buildNo);
  fs.writeFileSync(APP_JSON, app);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

const written = JSON.parse(fs.readFileSync(APP_JSON, 'utf8')).expo;
console.log(`版本号注入完成：${display}（versionCode=${written.android.versionCode}，${official ? '正式构建' : '测试构建'}）`);
