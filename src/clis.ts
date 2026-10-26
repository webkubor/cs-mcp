/**
 * 外部 CLI 台账 —— 每个分组依赖哪个命令、怎么装、什么版本起步，全在这里。
 *
 * **真源说明**：能力属于 CLI，不属于 MCP。这个文件只描述「去哪儿找那个 CLI」，
 * 不描述能力本身 —— 所以加一个分组 = 加一份 CliSpec + 一个 groups/*.ts，
 * 而不是在 MCP 里重写一遍逻辑。
 *
 * 安装命令写的是**陌生人真能装上**的那一条。项目没发布到包管理器、或包名被
 * 无关包占用时，宁可先不进分组（见 README 的「还没进来的项目」一节），
 * 也不要给一条装完没有命令的提示。
 */
import type { CliSpec } from "./cli.js";

/**
 * ⚠️ `minVersion` 只在**确认这个 CLI 的 `--version` 能正常返回版本号**时才填。
 * 目前六个分组里只有 MUSEAV_CLI 填了 —— 这不是漏了，是另外五个不该填。
 *
 * 2026-10-13 实测（`<cmd> --version`，看退出码 + stdout）：
 *
 * | CLI | 退出码 | stdout | 能不能填 minVersion |
 * |---|---|---|---|
 * | museav       | 0 | `3.12.0`            | ✅ 唯一有真实版本下限的（3.9.0 起命令才齐） |
 * | vlm          | 0 | `vlm 0.1.0`         | ❌ 能报版本，但没有确立的下限，填了纯属自找 |
 * | ego-browser | 0 | `ego-browser 0.5.1.13`| ❌ 同上 |
 * | contrast-guard | **2** | 空（话在 stderr：「未找到 contrast.config」） | ❌ 见下 |
 * | facet        | **1** | 空（node 内部异常栈） | ❌ 见下 |
 * | reel         | **1** | 打印帮助文本，**全文没有版本号** | ❌ 见下 |
 *
 * **后三个填了不是「版本误报」，是整组永久不可用。** 链路：`createRunner`
 * 的 `ensure()` 用 `execFile` 跑 `--version`，而它**只吞 ENOENT**（cli.ts:150）；
 * 这三个 CLI 非零退出 → 直接 throw → 而这个 throw 逃出 `run()` 的 try 块，
 * 根本没机会被转成「请升级」。
 * 后果是该分组**每一个工具**调用都失败；且失败不被缓存（cli.ts:165 有意为之，
 * 为了让用户装好之后不必重启），于是**每次调用都重新探测、每次都以同样的方式失败**。
 *
 * 顺带一个反直觉点：这三个的 stdout 都是空的，所以 cli.ts:153 那句
 * `raw.match(/\d+\.\d+\.\d+/)` 不会从垃圾里抠出个假版本号 —— 也就是说
 * 「错误退出码」比「错误输出」更致命，别指望正则兜底。
 *
 * 真要给它们加版本守卫，得先让各自的 CLI 支持 `--version`（或加 `versionArgs`
 * 指向别的子命令），**不是**在这儿填个号就完事。
 */

/** MUSE AV 出图中台：出图/视频、本地后期、模板技能、SkillHub */
export const MUSEAV_CLI: CliSpec = {
  name: "museav-cli",
  envVar: "MUSEAV_BIN",
  command: "museav",
  install: "npm i -g museav-cli@latest",
  minVersion: "3.9.0",
};

/** 本地看图理解（Apple MLX）。能报版本（`vlm --version` → 0.1.0），但没确立下限，故不设守卫。 */
export const VLM_CLI: CliSpec = {
  name: "mlx-vlm-kit",
  envVar: "MLX_VLM_BIN",
  command: "vlm",
  purpose: "本地看图靠它",
  install: "pipx install git+https://github.com/webkubor/mlx-vlm-kit.git",
  maxChars: 3000,
};

/** 对比度门禁：静态检查 + 渲染后计量。check 是 cwd 敏感的（读 contrast.config.*）。 */
export const CONTRAST_CLI: CliSpec = {
  name: "contrast-guard",
  envVar: "CONTRAST_GUARD_BIN",
  command: "contrast-guard",
  install: "npm i -g contrast-guard@latest",
  // 无 minVersion：它的 --version 退出码 2（见文件头表格），填了整组会挂
  timeoutMs: 300_000,
  maxChars: 6000,
  // 不达标时它把报告打到 stdout 然后 exit 1 —— 那是判据，不是调用失败
  verdictExit: true,
};

/** Markdown → PDF / 长图 / 讲稿页。模板与主题由包内资源解析，不依赖 cwd。 */
export const FACET_CLI: CliSpec = {
  name: "facet",
  envVar: "FACET_BIN",
  command: "facet",
  install: "npm i -g @webkubor/facet@latest",
  // 无 minVersion：--version 走到 node 内部异常、退出码 1（见文件头表格）
  timeoutMs: 300_000,
  maxChars: 4000,
};

/**
 * 竖版短视频合成（素材 + 逐句文案 → mp4）。
 *
 * 超时给到 15 分钟：它是真在渲染帧 + 调 ffmpeg 合成，1080×1920 几十秒的片子
 * 比出图慢得多；而「慢」和「卡死」在 agent 那边长得一模一样，所以宁可给宽。
 * 另外它**硬依赖 ffmpeg**（不在 npm 包里），装法见 install 提示的第二句。
 */
export const REEL_CLI: CliSpec = {
  name: "@kubor/reel-kit",
  envVar: "REEL_BIN",
  command: "reel",
  purpose: "竖版短视频合成靠它，且需要系统里有 ffmpeg",
  install: "npm i -g @kubor/reel-kit@latest（另外需要 ffmpeg：brew install ffmpeg）",
  // 无 minVersion：reel --version 不认识这个选项，退出码 1、只打帮助文本
  timeoutMs: 900_000,
  maxChars: 4000,
};

/**
 * 浏览器操控（真实 Chrome + 登录态复用 + 人类交接协议）。
 *
 * 两处跟别的 CLI 不一样，都体现在这个 spec 里：
 *  · **退出码是状态**：`3=需要人类介入`、`4=等待人类超时` —— 不是故障。
 *  · **超时给到 15 分钟**：`await-human` 会阻塞着等人登录（默认等 300s，
 *    可以传更长），比出图/出片都久。
 *
 * 它不在 npm 上（bun 编译出来的单文件二进制），装法只有 install.sh 一条。
 */
export const BROWSER_CLI: CliSpec = {
  name: "ego-browser",
  envVar: "EGO_BROWSER_BIN",
  command: "ego-browser",
  purpose: "浏览器操控靠它（ego lite 的 Chromium）",
  install: "安装 ego lite 到 /Applications 并完成首次引导（https://lite.ego.app）",
  timeoutMs: 900_000,
  maxChars: 6000,
};

/**
 * 开源项目成熟度与品牌质检（GitHub 仓库 / npm 包 / 网页 / 品牌 GEO AI 可见度）。
 * 输出支持 JSON 与 Markdown，对齐 NIST SSDF、OpenSSF 等工程质量基线。
 */
export const SCORECARD_CLI: CliSpec = {
  name: "scorecard",
  envVar: "SCORECARD_BIN",
  command: "scorecard",
  purpose: "开源项目成熟度与品牌质检靠它",
  install: "npm i -g @webkubor/scorecard@latest (或 git clone https://github.com/webkubor/scorecard.git && npm link)",
  // 无 minVersion：scorecard --version 不认识该选项，退出码 1 且只打印帮助文本
  timeoutMs: 300_000,
  maxChars: 8000,
  // 当指定 --min 时，低于基线分数会返回 exit 1，属判据退出而非调用崩溃
  verdictExit: true,
};

