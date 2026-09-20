// 自动生成：node scripts/gen-changelog.js —— 请勿手改
// 内置的全部更新日志（与 changelog/CHANGELOG-*.md 同步），App 内离线展示，新版本在前。
// 开发者节（验证 / 依赖变更 / 构建与发布等）不收录，界面只讲用户能看到的变化。
export type ChangelogBlockKind = 'section' | 'bullet';

export interface ChangelogBlock {
  kind: ChangelogBlockKind;
  text: string;
}

export interface ChangelogEntry {
  /** 版本号，如 0.0.9.2 */
  key: string;
  /** 构建日期 YYYY-MM-DD，缺失为空串 */
  date: string;
  /** 文件头破折号后的标题 */
  title: string;
  blocks: ChangelogBlock[];
}

export const CHANGELOG_DATA: ChangelogEntry[] = [
  {
    "key": "0.0.11",
    "date": "2026-09-20",
    "title": "作业纸按电脑版实测值对齐，课程表上线",
    "blocks": [
      {
        "kind": "section",
        "text": "修复"
      },
      {
        "kind": "bullet",
        "text": "作业纸身份条码尺寸与位置：按电脑版真实生成的 PDF 量出准确数值后重做。条码在纸面上是 65.0x21.5mm，其中竖条 17.15mm、下方可读数字 9.35pt；位置是右边缘距页面右边 15mm、顶边距页顶 15mm，也就是落在上边距带里，而不是此前估计的 65x10.6mm、距顶 10mm。"
      },
      {
        "kind": "bullet",
        "text": "抬头图把整页正文顶偏：电脑版的学习通标识同样是压在页眉带里的（60.8x18.5mm，左 15mm、距顶 15mm），正文从距顶 30mm 起排。手机端此前把标识插进正文流里，于是整页内容比电脑版低了一整条标识的高度。现在标识与条码都按页盖章，正文起点与电脑版一致。"
      },
      {
        "kind": "bullet",
        "text": "分页规则与电脑版不一致：电脑版的出图引擎按行连续断页，手机端此前只在顶层大块之间断页，一道大题塞不进当页剩余空间时整块挪到下一页，页底留出一大段空白、断点也对不上。现在允许向下拆一层，并按同一页内相邻同源片段合并回同一个外层标签（表格不会被拆成两张，边框与行距才不会走样）。"
      },
      {
        "kind": "bullet",
        "text": "条码缺失的成因与兜底：作业 ID 取不到时整份文档不再有条码。现在按几个常见字段名依次查找，并在预览页底部标注这次是从哪个字段取到的；确实取不到时不画条码，宁缺勿错——错号的作业纸会被机器判到别人名下。"
      },
      {
        "kind": "bullet",
        "text": "导出文件名与电脑版统一：日期部分改为「2026年9月8日_(星期二)」写法，与电脑版生成的文件名一致（此前手机端压成 20260908）。"
      },
      {
        "kind": "section",
        "text": "新增"
      },
      {
        "kind": "bullet",
        "text": "课程表：首页「课程表」入口正式可用。按星期排列所选学期的实验、理论课与值日安排，同一门课每周重复出现的合并成一条；学期切换与作业纸页共用同一个选择，两边保持一致。"
      },
      {
        "kind": "section",
        "text": "说明"
      },
      {
        "kind": "bullet",
        "text": "中文宋体仍与电脑版不同（电脑版把字体装进系统供出图程序取用，Android 没有等价条件），公式部分已内置同款样式与字体。"
      },
      {
        "kind": "bullet",
        "text": "实验报告的提交与批改后答题纸图片的下载，需要服务器文件接口的实际参数才能接通；电脑版这两个动作与作业纸同为日程条目上的不同按钮，手机端也放在同一个条目里，不会拆成两处。"
      }
    ]
  },
  {
    "key": "0.0.10",
    "date": "2026-09-20",
    "title": "学期切换、作业纸版心对齐电脑端、应用内更新",
    "blocks": [
      {
        "kind": "section",
        "text": "新增"
      },
      {
        "kind": "bullet",
        "text": "学期切换：作业纸页顶部可以直接点选学期，列出服务器返回的全部学期，选中的学期会被记住，下次进入 App 仍停在上次看的学期；不再固定只显示最新学期。切换后日历与日程自动重新加载。"
      },
      {
        "kind": "bullet",
        "text": "应用内下载并安装更新：「检查更新」页改为在应用内下载安装包并唤起系统安装，带下载进度；未授予「安装未知应用」权限时给出「去开启 / 浏览器下载」的引导。此前只能跳转到浏览器手动下载。"
      },
      {
        "kind": "bullet",
        "text": "内置更新日志：新增「更新日志」页，历代版本的变更说明随应用打包，离线可查。入口在设置页与检查更新页。"
      },
      {
        "kind": "bullet",
        "text": "开发者模式：设置页新增开关。实验ID 入口、服务器原始 HTML/JSON 导出、调试信息集中到该模式下，默认关闭，普通界面不再显示这些排查用内容。"
      },
      {
        "kind": "section",
        "text": "修复"
      },
      {
        "kind": "bullet",
        "text": "冷启动后请求全部匿名：登录会话（服务器种下的 Cookie）此前只存在内存里，App 被系统回收后就没了对应的凭据，但登录状态却被判定为「已登录」，于是学期、日程、作业纸接口全部以匿名身份发出，表现为「加载失败」却看不出是没登录。现在会话会持久化并在启动时灌回，接口返回 401/403 时直接清掉登录态并带回登录页，同时给出「登录已失效，请重新登录」的说明。"
      },
      {
        "kind": "bullet",
        "text": "会话超长的情况：安全存储单项有 2KB 上限，带 JWT 的 Cookie 头容易超，写失败会让登录报错或恢复不出会话。现在超长时自动改用普通存储并记住落在哪一侧。"
      },
      {
        "kind": "bullet",
        "text": "作业纸版心与电脑端不一致：服务器响应里的 h2pargs 就是电脑版交给出图程序（wkhtmltopdf）的参数，此前手机端把它取回来却完全没用，页边距、页面尺寸全靠写死的猜测值。现在按这组参数解析出纸张尺寸、上下左右页边距与页眉页脚，用它驱动 @page、正文留白和分页高度；参数缺失时才退回 A4 / 10mm 边距，并在界面上注明用的是回退值。"
      },
      {
        "kind": "bullet",
        "text": "分页测量宽度错误：测量每块内容高度时按整页 210mm 宽排版，而正文实际可用宽是版心宽（例如 180mm），量出来的行数比打印结果少，页面内容会被挤到错误的分页位置。现在测量阶段就带着页边距排版。"
      },
      {
        "kind": "bullet",
        "text": "同一份作业纸出两种结果：列表页的下载按钮走的是不分页、无条码的直出路径，预览页走的才是分页带条码的路径。现在手机端只保留预览页这一条出图路径。"
      },
      {
        "kind": "bullet",
        "text": "身份条码前缀：条码开头两位改用服务器给的 filetypeid，批改后作业纸因此不再被标成课程作业纸的前缀；无该字段时仍按类型回退。"
      },
      {
        "kind": "bullet",
        "text": "日期替换：去掉一条重复执行的替换语句；模板里日期带 (节) 尾缀的情况现在会整段替换，不再留下半个括号。"
      },
      {
        "kind": "bullet",
        "text": "公式与中文样式：把电脑版自带的 KaTeX 样式表与字体内置进 App，作业纸里的公式不再按默认字体错位；中文正文的字体栈补回缺失的宋体候选名。"
      },
      {
        "kind": "bullet",
        "text": "打印字号随系统字体缩放：出图时固定文字缩放为 100%，避免用户调过系统「字体大小」后打印分行与测量分页对不上。"
      },
      {
        "kind": "bullet",
        "text": "日程加载失败不再被吞掉：实验与理论课两个接口此前各自忽略错误，都失败时只显示一张空白日历。现在两个都失败会把原因抛给界面，只剩一个可用仍正常显示。"
      },
      {
        "kind": "bullet",
        "text": "版本比较漏第四位：版本比较只比前三段，而本机版本号形如 0.0.9.2，导致已经装了 0.0.9.2 的设备永远收不到 0.0.9.3 的更新提示。现在按点分段逐位比较、缺位补零。"
      },
      {
        "kind": "bullet",
        "text": "更新源细节：过滤掉预发布版本，一次取更多条目，限流与断网分别给出可读的中文提示；下载链接改为跟随当前列出的那个版本，不再和界面上显示的版本各说各话。"
      },
      {
        "kind": "bullet",
        "text": "权限声明：应用清单声明安装未知应用所需权限，批改后作业纸入口改为只对教师/管理员账号显示。"
      },
      {
        "kind": "section",
        "text": "说明"
      },
      {
        "kind": "bullet",
        "text": "手机版的中文宋体仍与电脑版不同：电脑版是把宋体装进系统后由出图程序取用，Android 没有对应的宋体系列，而应用内打印通道既不读本地字体文件、也没有可靠的替换入口。要把这一层也补齐，需要把字体子集以约 3.4 MB 的内嵌数据塞进每一份打印文档，代价较大，本次未做，公式部分已单独内置。"
      },
      {
        "kind": "bullet",
        "text": "页眉页脚按电脑端的参数渲染；服务器没下发这些参数时不会出现页码。"
      },
      {
        "kind": "bullet",
        "text": "「实验ID」入口是电脑版的隐藏功能，只对排查问题有用，因此收进开发者模式，默认不显示。"
      }
    ]
  },
  {
    "key": "0.0.9.2",
    "date": "2026-08-31",
    "title": "作业纸身份条码与分页对齐 PC 端",
    "blocks": [
      {
        "kind": "section",
        "text": "修复"
      },
      {
        "kind": "bullet",
        "text": "作业纸身份条码与 PC 端一致：从真实电脑版 PDF 解码验证条码内容规则为 08 + 两位页码 + 作业ID补零到9位（如作业 id=7717 第 1 页为 0801000007717，第 2 页为 0802000007717）。手机端改用同一 Code128-C 编码生成，条码内容与电脑版完全相同；不再使用之前未经验证的 080100000{id} 编码。"
      },
      {
        "kind": "bullet",
        "text": "条码数据来源修正：确认条码使用服务器返回的 data.id（作业记录 ID），与 schid、planid、expid 无关；08 前缀对应 filetypeid（课程作业纸）。"
      },
      {
        "kind": "bullet",
        "text": "分页对齐：预览时先在 WebView 中按 A4 版心（上 30mm/下 20mm/左右 15mm，内容高 247mm，与 PC 端 wkhtmltopdf 参数一致）测量并分页，每页独立容器承载题目和对应页码的条码；分页结果与电脑版 PDF 结构一致（原子物理样例同样为 2 页）。"
      },
      {
        "kind": "bullet",
        "text": "日期继续使用服务器返回的权威日期，不被日历安排日期覆盖。"
      },
      {
        "kind": "section",
        "text": "说明"
      },
      {
        "kind": "bullet",
        "text": "条码位置仍为页面右上角近似（电脑版为页首右侧，机器识别以条码内容为准）。"
      },
      {
        "kind": "bullet",
        "text": "每题 DataMatrix 二维码由服务器 HTML 脚本生成，手机端原样保留，用于定位做题区。"
      },
      {
        "kind": "bullet",
        "text": "手机端生成的 PDF 仍使用 Android WebView 打印引擎，分页与字体可能与电脑版存在细微差异；正式提交扫描作业时建议优先使用电脑版生成的作业纸。"
      }
    ]
  },
  {
    "key": "0.0.9.1",
    "date": "2026-08-08",
    "title": "作业纸日期与标识修复",
    "blocks": [
      {
        "kind": "section",
        "text": "修复"
      },
      {
        "kind": "bullet",
        "text": "作业纸预览和 PDF 不再使用日历安排日期覆盖纸张接口返回的作业日期；保留服务器返回的权威日期，修复课程安排日与作业布置日不一致的问题。"
      },
      {
        "kind": "bullet",
        "text": "改进日期解析，日期-only 字符串按年月日处理，减少时区导致的跨日偏移。"
      },
      {
        "kind": "bullet",
        "text": "预览和导出作业纸补充右上角作业标识区域，并使用作业记录 ID 生成稳定的数字标识。"
      },
      {
        "kind": "bullet",
        "text": "保持普通作业和批改作业使用完整日程数据请求及相同的 HTML 渲染链路。"
      },
      {
        "kind": "section",
        "text": "限制"
      },
      {
        "kind": "bullet",
        "text": "PC 端 Code128 的完整编码映射仍需更多样例确认；当前标识使用已确认的作业记录 ID 生成，后续可据真实编码规则继续校准。"
      },
      {
        "kind": "bullet",
        "text": "批改纸是否包含扫描批改内容取决于 /api/paper/workcorr 返回的数据；手机端不伪造服务器未返回的批改图像或评分。"
      }
    ]
  },
  {
    "key": "0.0.9",
    "date": "2026-08-04",
    "title": "作业纸 titlelogo 顶部横幅修复",
    "blocks": [
      {
        "kind": "section",
        "text": "修复"
      },
      {
        "kind": "bullet",
        "text": "titlelogo 显示错误：v0.0.8 把 titlelogo（2937x893 的作业纸顶部横幅图，含学校 logo +「课程作业」标题）误当作全页背景拉伸，导致 logo 占满整个页面。v0.0.9 改为顶部横幅——精确复刻 PC 端：宽 60.8mm × 高 18.5mm，位于页面顶部左侧，body 开头插入"
      },
      {
        "kind": "bullet",
        "text": "移除 content-overlay 包裹（不再需要，titlelogo 不是背景）"
      },
      {
        "kind": "section",
        "text": "关于作业纸与 PC 端一致性的分析进展"
      },
      {
        "kind": "bullet",
        "text": "titlelogo：已确认是顶部横幅（非全页背景），尺寸/位置已按 PC 端 PDF 的 cm 矩阵精确复刻"
      },
      {
        "kind": "bullet",
        "text": "Code128 条形码：已从 PC 端 PDF 解码，内容为 010000116010025 形式数字串。C# 用 iText Barcode128 生成，目前内容来源仍在分析（可能关联 filetypeid/课程/学号编码）"
      },
      {
        "kind": "bullet",
        "text": "DataMatrix 二维码：服务器 html 自带生成脚本，每道题 svgdiv 自动生成，无需额外处理"
      },
      {
        "kind": "bullet",
        "text": "机器扫描依赖顶部条形码 + 每题二维码定位归档，这些正在逐步对齐 PC 端"
      }
    ]
  },
  {
    "key": "0.0.8",
    "date": "2026-08-04",
    "title": "作业纸底版背景 + 文件名规范 + 二维码",
    "blocks": [
      {
        "kind": "section",
        "text": "作业纸生成重构"
      },
      {
        "kind": "bullet",
        "text": "底版背景嵌入：buildFullHtml 将服务器返回的 titlelogo（base64 PNG，2937x893 像素的完整作业纸底版图，含预印刷表格/定位标记/学校标识）作为 HTML body 的 CSS 背景，与 PC 端 C# 做法一致"
      },
      {
        "kind": "bullet",
        "text": "日期填充：用服务器返回的 sch_datestring（PC 端格式，如 2026年3月4日 (星期三) (节)）替换 HTML 模板中的硬编码下载当天日期"
      },
      {
        "kind": "bullet",
        "text": "班级/学号/姓名：服务器通过登录 cookie 已在 HTML 中填入（不再需要 App 侧二次填充）"
      },
      {
        "kind": "bullet",
        "text": "二维码：HTML 模板中的 DataMatrix 脚本 + .svgdiv 元素会自动在每道题肩头生成 SVG 二维码（编码题目 ID），与 PC 端 wkhtmltopdf 渲染一致"
      },
      {
        "kind": "section",
        "text": "文件名规范"
      },
      {
        "kind": "bullet",
        "text": "PDF/HTML 文件名改为 PC 端标准格式：课程作业纸_{课程名称}_{学号}_{姓名}_{日期}.pdf"
      },
      {
        "kind": "bullet",
        "text": "批改版：批改作业纸_{课程名称}_{学号}_{姓名}_{日期}.pdf"
      },
      {
        "kind": "section",
        "text": "关于「作业纸与 PC 端一致性」的结论"
      }
    ]
  },
  {
    "key": "0.0.7",
    "date": "2026-08-04",
    "title": "检查更新修复 + IC 图标修正 + JSON 调试",
    "blocks": [
      {
        "kind": "section",
        "text": "修复"
      },
      {
        "kind": "bullet",
        "text": "检查更新/官网显示 0.1.0 而非最新版：根因是按「版本号大小」取最新，v0.1.0（纪念版）版本号最大但发布时间早。改为按发布时间（published_at）取最新，官网 JS 同步修改"
      },
      {
        "kind": "bullet",
        "text": "软件图标无 IC 字样：adaptive-icon 前景误用深青色 IC（与 #00695C 背景同色被吞没）。改为透明底 + 白色 IC，icon.png 同步为深青绿底 + 白色 IC，放大字体保证小尺寸清晰"
      },
      {
        "kind": "section",
        "text": "新增"
      },
      {
        "kind": "bullet",
        "text": "下载完整 JSON 调试：作业纸条目新增「JSON」按钮，下载服务器返回的完整响应（含 html + data + h2pargs + titlelogo），用于分析做题区/条形码/二维码的数据来源（PC 端由 C# 生成，需从 data 字段还原）"
      },
      {
        "kind": "section",
        "text": "备注"
      },
      {
        "kind": "bullet",
        "text": "作业纸真实性：服务器返回的 html 仅为骨架（课程/班级/学号/姓名/日期），做题区/条形码/二维码由 PC 端 C# 混淆代码生成。正在通过 PC 端成品样本 + 完整 JSON 分析还原方案"
      }
    ]
  },
  {
    "key": "0.0.6",
    "date": "2026-08-04",
    "title": "作业纸填充修复 + 更新检查修复 + IC 图标",
    "blocks": [
      {
        "kind": "section",
        "text": "修复"
      },
      {
        "kind": "bullet",
        "text": "检查更新 401：根因是误用 INSTLAB 登录 token 当作 GitHub Bearer（GitHub 返回 401）。改为纯匿名请求 + User-Agent，公开仓库限流足够"
      },
      {
        "kind": "bullet",
        "text": "作业纸内容空白：根因是只传了 schid，服务器无法填充内容。改为传完整日程条目 + 当前登录学生信息（学号/姓名/学校）"
      },
      {
        "kind": "bullet",
        "text": "作业纸日期错误（显示下载当天）：服务器模板用 new Date() 生成日期。buildFullHtml 现在会把日期替换为作业布置/实验安排日（sch_date），格式 YYYY年M月D日 (星期X)"
      },
      {
        "kind": "bullet",
        "text": "作业纸班级/学号/姓名空白：buildFullHtml 新增 fillAfterLabel，识别模板中「班级/学号/姓名」标签后的空 <td> 并填入当前用户信息"
      },
      {
        "kind": "bullet",
        "text": "课程表：首页改为灰色不可用（与其他未开发功能一致）"
      },
      {
        "kind": "section",
        "text": "改进"
      },
      {
        "kind": "bullet",
        "text": "PDF 字体：注入中文字体 fallback 栈（Noto Serif SC → Source Han Serif SC / Songti SC / SimSun），缓解 Android 上字体变化"
      },
      {
        "kind": "bullet",
        "text": "软件图标：改用「IC」文字图标（#00695C 底 + 白色 IC），替换原外部素材图；adaptive icon 同步更新"
      },
      {
        "kind": "section",
        "text": "备注"
      },
      {
        "kind": "bullet",
        "text": "作业纸模板里的 DataMatrix 二维码由页面内 JS 动态生成（DATAMatrix 函数），expo-print 渲染时会执行"
      }
    ]
  },
  {
    "key": "0.0.5",
    "date": "2026-08-04",
    "title": "Cloud 主题修正 + 更新检查 + 官网 + 排错功能",
    "blocks": [
      {
        "kind": "section",
        "text": "主题"
      },
      {
        "kind": "bullet",
        "text": "Cloud 主题配色修正：主色改为 PC 端真实采样色 #00695C（顶部/图标/按钮/边框/标题栏）；标注色 #F6AB6D（实验/值日）+ #2196F3（作业/理论课）"
      },
      {
        "kind": "bullet",
        "text": "新增 Quasar 主题：原「Cloud」主题更名保存为「Quasar」（Material Design 蓝），可在设置中切换"
      },
      {
        "kind": "bullet",
        "text": "日历日期标注用新配色（实验橙 #F6AB6D / 作业蓝 #2196F3 / 都有紫）"
      },
      {
        "kind": "section",
        "text": "修复"
      },
      {
        "kind": "bullet",
        "text": "登录输入框：输入框/显示按钮/验证码区统一固定 52px 高度，完全等高，文字不再截断"
      },
      {
        "kind": "bullet",
        "text": "已登录重进丢失姓名/头像：userinfo（姓名/角色/学号/学校）缓存到 AsyncStorage，重新进入 App 自动恢复，无需重新登录"
      },
      {
        "kind": "section",
        "text": "新增"
      },
      {
        "kind": "bullet",
        "text": "下载原始 HTML：作业纸下载增加「原始HTML」按钮（与 PDF 并列），用于排查 PDF 内容空白是服务器数据问题还是格式转换问题"
      },
      {
        "kind": "bullet",
        "text": "检查更新：App 内检查最新版本（GitHub Releases），一键下载 APK、访问官网"
      },
      {
        "kind": "bullet",
        "text": "官网：创建 site/ 目录（图书馆扁平风格 + #00695C 主色），通过 GitHub Pages 部署，展示版本与下载链接"
      }
    ]
  },
  {
    "key": "0.0.4",
    "date": "2026-08-04",
    "title": "作业纸下载修复 + PC 端信息对齐 + UI 修正",
    "blocks": [
      {
        "kind": "section",
        "text": "修复"
      },
      {
        "kind": "bullet",
        "text": "学期加载失败（404）：修正学期 API —— /api/terms（内网专用，公网 404）改为公网 /api/term。日程改用 /api/schedule（实验）+ /api/scheduleth（理论课），与 PC 端前端一致"
      },
      {
        "kind": "bullet",
        "text": "姓名显示为学号：登录响应姓名字段由 name 改为 username（PC 端 CloudLayout 实际使用的字段）"
      },
      {
        "kind": "bullet",
        "text": "日历无标注：日历日期改为 PC 端配色规则 —— 实验=橙色、理论课=蓝色、两者都有=紫色（原为无意义小圆点）"
      },
      {
        "kind": "bullet",
        "text": "登录输入框：加高至 46px，文字不再被截断；「显示/隐藏」按钮与验证码区域与输入框等高"
      },
      {
        "kind": "bullet",
        "text": "验证码大写锁定：验证码输入框 autoCapitalize=\"none\"，不再自动开大写"
      },
      {
        "kind": "section",
        "text": "新增 / 完善"
      },
      {
        "kind": "bullet",
        "text": "日程卡片完整信息：与 PC 端一致展示课程编号/名称、教师、实验室、课时、值日（橙色徽章）、已签到/已交数据/已交报告状态、成绩徽章"
      },
      {
        "kind": "bullet",
        "text": "首页问候：显示真实姓名 + 学生/老师称呼（基于 PC 端 IsTeacher/IsSchoolAdmin 等角色字段）"
      },
      {
        "kind": "bullet",
        "text": "头像：仅在获得真实姓名（非学号）时显示首字头像"
      },
      {
        "kind": "section",
        "text": "UI 对齐 PC 端"
      },
      {
        "kind": "bullet",
        "text": "Cloud 主题配色对齐 Quasar 风格：主色 #1976D2、背景 #f5f5f5、卡片边框 #aaaaaa"
      },
      {
        "kind": "bullet",
        "text": "默认主题由「跟随系统」改为「Cloud」风格"
      }
    ]
  },
  {
    "key": "0.0.3",
    "date": "2026-08-04",
    "title": "作业纸 PDF 下载 + 日历日程视图 + 首页问候",
    "blocks": [
      {
        "kind": "section",
        "text": "新增功能"
      },
      {
        "kind": "bullet",
        "text": "日历日程视图：在「下载作业纸」页面加入月份日历组件，日历上自动标记有实验/理论课/值日的日期"
      },
      {
        "kind": "bullet",
        "text": "按日期查看安排：选中日期后显示该日完整日程（实验序号、名称、时间、地点、教师）"
      },
      {
        "kind": "bullet",
        "text": "作业纸 PDF 下载：点击日程条目上的「下载空白作业纸」或「批改后」按钮，自动调用 /api/paper/work API 并生成 PDF 文件（expo-print），通过系统分享面板保存"
      },
      {
        "kind": "bullet",
        "text": "实验 ID 测试模式：保留通过 schid 直接下载作业纸的入口（tab 切换），供验证 API 猜想"
      },
      {
        "kind": "bullet",
        "text": "首页问候：登录后首页显示「你好，XXX同学」个性化问候（含头像首字缩写）"
      },
      {
        "kind": "bullet",
        "text": "API 工具模块：创建 src/lib/api.ts（统一 fetch + cookie 封装）、src/lib/schedule.ts（学期+日程 API）、src/lib/paper.ts（作业纸下载+PDF 生成管线）"
      },
      {
        "kind": "section",
        "text": "变更"
      },
      {
        "kind": "bullet",
        "text": "版本号 0.0.2 → 0.0.3"
      },
      {
        "kind": "bullet",
        "text": "移除所有 UI 页面中的 emoji 图标，改用纯文字标识"
      },
      {
        "kind": "bullet",
        "text": "首页状态栏改为问候卡片样式（头像缩写 + 姓名 + 学号）"
      }
    ]
  },
  {
    "key": "0.1.0",
    "date": "",
    "title": "初始版本",
    "blocks": [
      {
        "kind": "section",
        "text": "更新日志"
      },
      {
        "kind": "bullet",
        "text": "作业纸下载（核心）：调用 POST /api/paper/work 下载空白回答纸，POST /api/paper/workcorr 下载批改后作业纸"
      },
      {
        "kind": "bullet",
        "text": "学号+密码登录：和 PC 客户端一致的认证流程（GET /api/userinfo → POST {server}/login）"
      },
      {
        "kind": "bullet",
        "text": "预计后续支持：实验报告提交、实验数据管理、课程表、文件管理"
      },
      {
        "kind": "bullet",
        "text": "学号+密码手动输入登录页"
      },
      {
        "kind": "bullet",
        "text": "首页 2 列功能卡片网格"
      },
      {
        "kind": "bullet",
        "text": "5 套主题配色（浅色/深色/Cloud Lite 浅色/Cloud Lite 深色/跟随系统）"
      },
      {
        "kind": "bullet",
        "text": "设置页主题切换"
      },
      {
        "kind": "bullet",
        "text": "GitHub Actions 自动构建 APK"
      },
      {
        "kind": "bullet",
        "text": "Expo (React Native) + expo-router + TypeScript"
      },
      {
        "kind": "bullet",
        "text": "Zustand 状态管理"
      },
      {
        "kind": "bullet",
        "text": "AsyncStorage 持久化 + SecureStore 令牌加密存储"
      },
      {
        "kind": "bullet",
        "text": "GitHub Actions 自动构建：推送至 main/master 分支自动触发"
      },
      {
        "kind": "bullet",
        "text": "本地构建：npx expo prebuild --platform android --clean → cd android && ./gradlew assembleRelease"
      }
    ]
  },
  {
    "key": "0.0.2",
    "date": "",
    "title": "登录重构（真实流程）",
    "blocks": [
      {
        "kind": "section",
        "text": "更新日志"
      },
      {
        "kind": "bullet",
        "text": "新增 cookie 管理模块（src/lib/cookies.ts）：手动解析 Set-Cookie 并回传"
      },
      {
        "kind": "bullet",
        "text": "重写 auth-store.ts：实现 token → captcha → login 完整流程"
      },
      {
        "kind": "bullet",
        "text": "重写登录页：SVG 验证码显示（react-native-svg）、学校代码输入框（默认 jssnu = 江苏师范大学）、验证码刷新、登录失败自动刷新验证码"
      },
      {
        "kind": "bullet",
        "text": "确认 API 全部位于公网 cloud.instlab.cn，无需校园内网（与 PC 端一致）"
      },
      {
        "kind": "bullet",
        "text": "修复假成功 bug：./gradlew assembleRelease ... | tee build.log 管道会吞掉 Gradle 的失败退出码（tee 返回 0），导致步骤显示成功但实际无 APK 产出。 已加 set -o pipefail 并新增 Verify APK exists 步骤，确保构建失败会真实报错。"
      },
      {
        "kind": "bullet",
        "text": "构建失败时自动上传 gradle-build-log / gradle-problems-report artifact 供排查。"
      },
      {
        "kind": "bullet",
        "text": "首页/登录页 Logo 为纯代码绘制，无版权问题"
      },
      {
        "kind": "bullet",
        "text": "设置页「关于」含学习用途声明"
      },
      {
        "kind": "bullet",
        "text": "版本号约定：0.1.0 永久保留给纪念版，未来 0.0.x → 0.1.1 起跳"
      }
    ]
  },
  {
    "key": "0.0.1",
    "date": "",
    "title": "版本重编号 + 登录可用性修复",
    "blocks": [
      {
        "kind": "section",
        "text": "更新日志"
      },
      {
        "kind": "bullet",
        "text": "0.1.0 永久保留给纪念版，未来不再使用该版本号"
      },
      {
        "kind": "bullet",
        "text": "版本演进：0.0.1 → 0.0.2 → … → 0.0.x → 0.1.1 → 0.1.2 → …（从 0.0.x 升到 0.1.x 时从 0.1.1 开始）"
      },
      {
        "kind": "bullet",
        "text": "新增 cookie 管理模块（src/lib/cookies.ts），手动管理 token/captcha/session cookie"
      },
      {
        "kind": "bullet",
        "text": "重写 auth-store.ts：实现 token → captcha → login 完整流程"
      },
      {
        "kind": "bullet",
        "text": "重写登录页：新增验证码输入框 + SVG 验证码显示（react-native-svg 渲染）、学校代码输入框（默认 jssnu = 江苏师范大学）"
      },
      {
        "kind": "bullet",
        "text": "登录失败自动刷新验证码"
      },
      {
        "kind": "bullet",
        "text": "确认 API 全部位于公网 cloud.instlab.cn，无需校园内网（PC 在家能登录正是因为如此）"
      },
      {
        "kind": "bullet",
        "text": "Android 明文 HTTP 访问：开启 usesCleartextTraffic（兼容内网 HTTP 场景）"
      },
      {
        "kind": "bullet",
        "text": "设置页版本号改为从 app.json 动态读取"
      },
      {
        "kind": "bullet",
        "text": "首页/登录页 Logo 为纯代码绘制，无版权问题"
      },
      {
        "kind": "bullet",
        "text": "设置页「关于」含学习用途声明"
      }
    ]
  }
];
