<h1 align="center">🧭 cs-mcp</h1>

<p align="center">
  <strong>CS 系统（CortexOS）的 MCP —— 一条命令，把个人工具链接进任意 AI Agent。</strong><br>
  把各开源项目的 CLI 能力串成一张网：出图 / 看图 / 对比度门禁 / Markdown 排版……<br>
  按「能力分组」组织，装了哪个 CLI 就自动长出哪组工具，没装的不会白占你的上下文。
</p>

<p align="center">
  <a href="https://github.com/webkubor/cs-mcp/releases/latest"><img src="https://img.shields.io/github/v/release/webkubor/cs-mcp?style=for-the-badge&color=3fb950&label=release" alt="release" /></a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux-4d6bfe?style=for-the-badge" alt="platform" />
  <img src="https://img.shields.io/badge/tools-49-4d6bfe?style=for-the-badge" alt="tools" />
  <img src="https://img.shields.io/badge/runtime_deps-0-5A9E6F?style=for-the-badge" alt="deps" />
  <img src="https://img.shields.io/badge/license-MIT-777?style=for-the-badge" alt="MIT" />
  <img src="https://img.shields.io/badge/transport-stdio-8957e5?style=for-the-badge" alt="stdio" />
</p>

<p align="center">
  <a href="README.en.md">English</a> · <a href="CHANGELOG.md">更新日志</a>
</p>

---

## ⚠️ 别和 `cs mcp serve` 搞混

系统里有**两个**都叫「cs 的 MCP」的东西。它们互补，不重合 —— 接错的那个会得到一堆你不需要的工具：

| | `cs mcp serve`（CortexOS 内置） | **本仓 cs-mcp** |
|---|---|---|
| 形态 | Go，`cs` 的一个子命令 | TypeScript，单文件二进制（也可从源码跑） |
| server 名 | `cortexos` | `cs` |
| 管什么 | **系统上下文**：规则 / 技能 / 知识搜索 / CLI 台账 / Agent 上下文 | **工具链串联**：各开源项目的 CLI 能力 |
| 真源 | `cli-registry.json` + `docs/rules` + `skills` | 各项目自己的 CLI |
| 数量 | 11 个只读发现工具 | 49 个工具，8 个能力分组 |

一句话分界：**想知道「cs 系统里有什么规矩、有什么技能」用 `cs mcp serve`；
想「出一张图、把 Markdown 排成 PDF、开个真浏览器、做开源质检、给文案去 AI 味」用 cs-mcp。**

> 顺带一句：**Agent 侧其实不需要 MCP。** 能跑 Bash 的 Agent 直接调 `cs` CLI 就够，
> 而且那是主干道（MCP 的通路管不到远端机器）。MCP 的价值只在**跑不了 Bash 的客户端**上。
> 见 `cs rule` 里 `cmd/mcp.go` 的定位说明。

## 🎯 为什么用它，而不是别的

| 需求 | 逐个手搓命令 | 每个工具各接一遍 SDK | cs-mcp |
|---|:---:|:---:|:---:|
| 一个 Agent 里同时用出图 / 看图 / 门禁 / 排版 | ❌ 四套用法 | ❌ 接四遍协议 | ✅ 一个 server 全给 |
| 换 Agent 就失效 | ❌ 命令绑定 | ⚠️ 各家 SDK 不同 | ✅ 换谁都认 MCP |
| 没装的工具白占上下文 | — | ❌ 全量注册 | ✅ **探测式**：装了才注册 |
| 大图 / 长文进上下文 | ❌ 手动处理 | ❌ 自己写 base64 | ✅ 一律走绝对路径 |
| 加新能力 | 各自记命令 | ❌ 得改 MCP 代码 | ✅ 升级 CLI 就生效（MCP 只做串联） |

**分层是硬的：能力在 CLI 里，MCP 只做串联。** 这个仓自己零实现 —— 每个工具都是对某个项目
CLI 的一次薄封装。所以 CLI 一升级，MCP 这边立刻就有新能力；MCP 不重写任何逻辑，也就不存在
「两边行为不一致」。

传输方式 stdio。文件以**绝对路径**传入，处理结果写回磁盘并返回路径 —— 不走 base64。

## 🧩 能力分组（这张就是版图）

| 分组 | 层次 | 开源项目 | 工具 | 干什么 | 前置 |
|---|---|:---:|---:|---|---|
| `museav` | **云能力** | [museav-cli](https://github.com/webkubor/museav-cli) | 17 | 出图 / 出视频、本地后期（抠图·超分·去水印·压缩）、模板与技能清单、素材上传、图生模板、SCULPT 反推、小红书 SkillHub 发布 | `museav-cli` ≥ 3.9.0 |
| `vlm` | 本地 | [mlx-vlm-kit](https://github.com/webkubor/mlx-vlm-kit) | 4 | 本地离线看图：描述、任意提问、封面质检、反推出图 prompt | `vlm`（Apple Silicon） |
| `contrast` | 本地 | [contrast-guard](https://github.com/webkubor/contrast-guard) | 3 | 对比度门禁：静态查色值达不达标、渲染后量实际字号灰阶、存基线与基线对比 | `contrast-guard` |
| `facet` | 本地 | [@webkubor/facet](https://github.com/webkubor/facet) | 2 | Markdown 排版成 PDF / 长图 / 讲稿页（自带多套模板） | `facet` |
| `reel` | 本地 | [@kubor/reel-kit](https://github.com/webkubor/reel-kit) | 3 | 素材 + 逐句文案 → 竖版成片（模板 / 转场 / 配乐 / 可选配音） | `reel` + **ffmpeg** |
| `browser` | 本地 | [ego-browser](https://lite.ego.app) | 13 | 真实 Chrome：打开/快照/点击/输入/截图/执行 JS + **人类交接协议** + 多 agent 会话隔离 | `ego-browser` |
| `scorecard` | 本地/云 | [scorecard](https://github.com/webkubor/scorecard) | 3 | 开源项目成熟度与品牌质检：GitHub / npm / 网页 9 维度审计 + GEO 品牌可见度份额 | `scorecard` |
| `writing` | 本地 | [writing-standard-skills](https://github.com/webkubor/writing-standard-skills) | 3 | 去 AI 假人味静态门禁扫描、小红书/X/Reddit/掘金说说扣分清单、5D 原子矩阵人设合成 | 零依赖（内置） |
| — | 自带 | 本 MCP | 1 | `groups_list`：列出全部分组、各自装什么、为什么没启用 | 无 |

八组里**只有 `museav` 是在线服务**：要登录、要网络、有余额配额、会花钱；其余七组是离线确定性计算。
这个差别在工具面上直接可读 —— **云能力那 17 个统一带 `museav_` 前缀**。owner 的口径就一句：
**cs 是核心，museav 是云能力。**

**默认策略是探测式**：某个分组的 CLI 在 `PATH` 上，它的工具才会注册。理由是工具 schema
会随**每一次**模型请求发出去 —— 聚合 MCP 越串越多，不该让用户为「他机器上根本没装的工具」
付 token。没启用的分组不会消失：`groups_list` 始终可用，它会告诉你这个 MCP 还能干什么、
该装什么。

想强开或裁剪，用环境变量 `CS_MCP_GROUPS`：

```bash
CS_MCP_GROUPS=all              # 全开（缺 CLI 的分组也注册，调用时才报装什么）
CS_MCP_GROUPS=facet,contrast   # 只开这几个
CS_MCP_GROUPS=-museav          # 默认集里去掉这几个
```

> 3.0.0 之前的旧名 `MUSEAV_MCP_GROUPS` **仍兼容**（新名优先，同时设置且不同时以新名为准并在
> stderr 提示）。之所以必须留旧名：变量被忽略**不会报错** —— 它会静默回落成探测式，
> 原来写 `all` 的人那些强开的分组会悄悄消失，连告警都没有。

## ⚡ 30 秒上手

**装（一条命令，不需要 Node，也不需要 npm）：**

```bash
curl -fsSL https://raw.githubusercontent.com/webkubor/cs-mcp/main/install.sh | bash
```

装完会自报版本（`cs-mcp --version`），并把接法一并打出来：

```bash
claude mcp add cs -- ~/.local/bin/cs-mcp
```

> **为什么不是 `npx -y cs-mcp`**：这个网关底下包着 museav-cli、mlx-vlm-kit、
> contrast-guard、facet、reel-kit、lite-browser 一堆东西 —— 用户为了用上全套能力，
> 已经要付 6 种安装方式的代价（npm / pipx / brew / curl）。如果网关自己还得
> `npm i -g` 或 `npx -y`，等于在最前面再加一道 Node + npm + registry 网络的门槛，
> 而它本该是**把门槛降到一条命令**的那一层。多数用户会卡在起手第一步。
> （npm 上那个 `cs-mcp` 包已标记为不维护，不再更新。）

**想要哪组能力就装哪个 CLI** —— 装了哪个 CLI 就自动长出哪组工具，没装的不会白占上下文：

```bash
npm i -g museav-cli                    # 这一行是出图那组
```

**从源码起**（改这个仓、或不想下二进制）：

```bash
git clone https://github.com/webkubor/cs-mcp && cd cs-mcp
pnpm install && pnpm build
claude mcp add cs -- node "$PWD/dist/index.js"
```

> Windows 暂时没有一键脚本，用 WSL 或走「从源码起」那条。

然后在 Agent 里说「用 museav 出一张图」，或者先问一句「这个 MCP 有哪些能力分组」。

## 工具（43 个）

### `museav` 组 —— MUSE AV 出图中台（17）

| 工具 | 干什么 | 是否需要登录 |
|---|---|---|
| `museav_gen_background` | 出背景图 / 一般出图 / 出视频（走中台） | ✅ 需要 |
| `museav_remove_bg` | 抠图去背景（BiRefNet / ISNet / U2Net），输出带 alpha 的 PNG | 免登录，本地跑 |
| `museav_upscale_image` | 超分放大（Real-ESRGAN + Vulkan GPU），默认 4x | 免登录，本地跑 |
| `museav_remove_watermark` | 去水印（LaMa 修复），自动定位，可传手工掩码 | 免登录，本地跑 |
| `museav_compress_image` | 压缩（sharp），可指定最长边 / 质量 / 格式 | 免登录，本地跑 |
| `museav_list_templates` | 查可用图片 / 文字模板（挑 `template` 用，别硬编码） | ✅ 需要 |
| `museav_list_skills` | 查可用技能（挑 `skill` slug 用，别硬编码） | ✅ 需要 |
| `museav_list_video_templates` | 查可用视频模板（与 `museav_list_templates` 平级，配合 `museav_gen_background` 的 `video=true` + `template`） | ✅ 需要 |
| `museav_list_models` | 查可用模型；`video=true` 查视频档次（可直接喂 `museav_gen_background` 的 model） | ✅ 需要 |
| `museav_balance` | 查上游余额 | ✅ 需要 |
| `museav_list_jobs` | 查自己的出图工作流（结果 URL、失败原因） | ✅ 需要 |
| `museav_upload_asset` | 上传素材拿公网直链（垫图要 URL 时用） | ✅ 需要 |
| `museav_image_to_template` | 图生模板：读图 + 文字层逆向 + 变量化 | ✅ 需要 |
| `museav_reverse` | 读图反推 SCULPT prompt（中台 API）。**与 `vlm_reverse_prompt` 互补**：图像识别默认优先本地 `vlm_*`，要走 SCULPT 格式再调这个 | ✅ 需要 |
| `museav_skillhub_tags` | 查小红书 SkillHub 内容标签（发布必带，别硬编码） | ✅ 需要 |
| `museav_skillhub_whoami` | 查 SkillHub 登录态（脱敏） | ✅ 需要 |
| `museav_skillhub_publish` | 把本地 Agent Skill 发到小红书 SkillHub。**默认 dry-run**，`submit=true` 才真提交 | ✅ 需要 |

本地后期那四个不联网、不消耗中台额度。

### `vlm` 组 —— 本地看图理解（4）

| 工具 | 干什么 |
|---|---|
| `vlm_describe` | 描述图片主体与色调 |
| `vlm_ask` | 对图片任意提问 |
| `vlm_cover_check` | 音乐封面语义质检（`batch=true` 递归目录） |
| `vlm_reverse_prompt` | 反推出图 prompt，喂回 `museav_gen_background` |

四个都免登录、零成本、不联网（本地 Qwen3-VL）；**需要 Apple Silicon**。

### `contrast` 组 —— 对比度门禁（3）

| 工具 | 干什么 |
|---|---|
| `contrast_check` | 静态查色值达不达标（读项目的 `contrast.config.*`），`dir` 指定项目目录 |
| `contrast_init` | 在项目里生成一份配置模板（第一次用要先跑这个） |
| `contrast_measure` | 渲染后量实际字号 / 灰阶 / 动效，可存基线与基线对比（需要浏览器） |

`check` 查「对不对」，`measure` 查「多少」——**丑的每一处单看往往都『对』**，所以两个都要跑。
不达标时工具会照常把完整报告交回来（CLI 用退出码当判据，不是调用失败）。

### `facet` 组 —— Markdown 排版成成品（2）

| 工具 | 干什么 |
|---|---|
| `facet_templates` | 列可用排版模板名（`facet_build` 的 `template` 从这里取） |
| `facet_build` | 把 Markdown 排成 PDF / 长图 / 讲稿页 |

### `reel` 组 —— 竖版短视频合成（3）

| 工具 | 干什么 |
|---|---|
| `reel_templates` | 列可用版式模板名（`reel_make` 的 `template` 从这里取） |
| `reel_bgm` | 列配乐库：别名、时长、风格、授权 |
| `reel_make` | 素材图 + 逐句文案 → mp4（模板 / 转场 / 配乐 / 标题 / 可选配音） |

素材与文案**按顺序一一对应**，数量不等时取较少的一方并明确报出来，不会静默丢弃。
不给 `voice` 时镜头时长由 `perShot` 决定（不需要任何模型）；给了才走本地 Qwen3-TTS。
**硬依赖系统里的 ffmpeg**（不在 npm 包里）。

`museav` 出的是原料（图、无声片），`reel` 出的是能发的成品 —— 这两段是一条业务线的前后半截。

### `browser` 组 —— 浏览器操控（13）

| 工具 | 干什么 |
|---|---|
| `browser_open` / `browser_close` | 打开网页建立会话 / 用完关闭（`reuse=true` 免扫码复用已确认的登录态） |
| `browser_snapshot` | 提取可交互元素并编号（`@1`、`@2`…）—— click / type 传编号比 CSS 选择器稳 |
| `browser_click` / `browser_type` / `browser_press` / `browser_scroll` | 点击 / 输入 / 按键 / 滚动 |
| `browser_screenshot` | 截图当前视口，返回路径 |
| `browser_eval` | 在页面里执行 JS —— **读正文/结构化数据只能靠它**（snapshot 只给可交互元素） |
| `browser_status` | **唯一状态真源**：相位、在等谁、下一步做什么 |
| `browser_await_human` / `browser_resume` | 人类交接协议：阻塞等人登录 → 人完成后恢复 |
| `browser_sessions` | 列出所有 agent 的会话（排查「浏览器被谁占着」） |

**人类交接协议**是这个组的核心价值：撞到登录墙不是死路，而是一条有契约的路径 ——
`status` 看它在等什么 → `await_human` 阻塞等人（退出码 3/4 是**状态**不是故障，
工具会原样把「需要人类介入 / 等待超时」交回来）→ `resume` 继续。

**身份隔离**：lite-browser 的会话按 agent 隔离，而默认身份是 `default`。本 MCP 每次都
显式传自己的身份（默认 `mcp`，可用 `CS_MCP_BROWSER_AGENT` 改；旧名 `MUSEAV_MCP_BROWSER_AGENT`
仍兼容），**不会跟别的 agent
抢会话**——这是实测踩出来的（第一次没传，直接开在别人正在用的 default 会话上）。

**刻意不暴露**（是判断，不是遗漏）：`exec -- <命令>`（把输入变成任意 shell 命令）、
`cdp`（裸协议通道）、`cookie export` / `cookie pull-system`（导出/解密 Cookie = 直接交出凭据，
与 kyvault 不进公开 MCP 同一条理由）。

### 发 Skill 之前必读

`museav_skillhub_publish` **默认只预演**（本地打包校验，不上传不提交），把待提交内容返回给你核对。
只有用户明确说「提交 / 确认 / submit」才带 `submit=true` —— 提交不可逆，Skill ID 是
平台主键、跨版本不可改名。

真提交前会先查登录态。**未登录时 MCP 不会挂在那儿等你**：二维码要等进程结束才能
返回给用户，硬等就是死锁，所以会直接报错，让你引导用户去终端跑一次
`museav skillhub login` 扫码。

CLI 自带**平台资产护栏**：Skill 正文里抄了 MUSE AV 平台公共模板的提示词会被拒绝发布，
只引用模板 slug（`museav gen --template xxx`）则放行——搬运是重新分发资产，引用是正常集成。
被拒时按提示把正文换成调用方式。

### 两个「先查再调」

`museav_gen_background` 的 `template` / `skill` 是必填二选一，但 id 和 slug **只能从中台实时拉**：
先用 `museav_list_templates` / `museav_list_skills` 查真实清单，再传进去。凭印象编一个，中台只会报
「模板不存在」，Agent 分不清是自己拼错了还是真没有。

模板自带哪些占位符看清单里「字段:」那一列，取值用 `museav_gen_background` 的 `fields` 传
（JSON 对象字符串）。

`facet_build` 的 `template` 同理 —— 先用 `facet_templates` 拿清单。

## 前置条件

```bash
npm i -g museav-cli        # museav 组：出图 / 后期 / 素材 / SkillHub（需要 >= 3.9.0）
pipx install git+https://github.com/webkubor/mlx-vlm-kit.git   # vlm 组
npm i -g contrast-guard    # contrast 组
npm i -g @webkubor/facet   # facet 组
npm i -g @kubor/reel-kit   # reel 组（另外要 brew install ffmpeg）
curl -fsSL https://raw.githubusercontent.com/webkubor/lite-browser/main/install.sh | bash   # browser 组
```

装哪几个由你决定 —— 没装的组就是不会注册，不会报错。

`museav_gen_background` 还需要中台 apiKey（按 museav-cli 的说明配置）。
本地工具首次运行会下载对应模型（抠图 ~214MB、超分 ~65MB、去水印 ~200MB、
vlm 的 Qwen3-VL-4B 约 2.9GB）。

可执行文件不在全局 PATH 时，用环境变量指定绝对路径：
`MUSEAV_BIN`、`MLX_VLM_BIN`、`CONTRAST_GUARD_BIN`、`FACET_BIN`。

## 接到 Agent 上

> 下面三段的 `command` 都是装好的那个二进制（`cs-mcp`）。如果它不在 PATH 里，
> 就写绝对路径 —— 装完 `cs-mcp --version` 会告诉你装在哪。

Claude Code 一行：

```bash
claude mcp add cs -- cs-mcp
```

DSH 在 profile 的 `cordis.patch.yml` 里加一行：

```yaml
- id: mcp-cs
  name: '@deepseek-ai/dsh-mcp-client'
  config:
    serverName: cs
    transport: stdio
    command: cs-mcp
    args: []
```

> `serverName` 决定客户端里的**工具命名空间**：`cs` 让工具叫 `mcp__cs__museav_gen_background`。
> 3.0.0 之前是 `museav`，于是加了 `museav_` 前缀后会变成 `mcp__museav__museav_gen_background`
> 这种双重前缀 —— 所以这次一并改成了 `cs`。
> DSH 与 WorkBuddy 是 **GUI 工具、不是 Agent**（见 `cs rule agent_governance` 的 gui-not-agent 红线），
> 这份配置是修工具本身，不是给它派活。

或手写配置（任意支持 MCP 的客户端）：

```json
{
  "mcpServers": {
    "cs": {
      "command": "cs-mcp",
      "args": []
    }
  }
}
```

想让某个没装 CLI 的分组也出现在工具列表里（调用时才报装什么），加上 `env`：

```json
{
  "mcpServers": {
    "cs": {
      "command": "cs-mcp",
      "args": [],
      "env": { "CS_MCP_GROUPS": "all" }
    }
  }
}
```

### 本地开发（改这个仓库时）

```bash
pnpm install && pnpm build     # 产物在 dist/，package.json 的 bin 指向它
```

配置里把 `command` 换成 `node`、`args` 指向 `/绝对路径/cs-mcp/dist/index.js` 即可。

## 还没进来的项目（以及为什么）

这张版图是**逐步**长出来的，不是一次列全。没进来分三种情况，都不是「忘了」：

| 项目 | 为什么还没进 |
|---|---|
| [kyvault](https://github.com/webkubor/kyvault) | **密钥库**，`get` 会打印明文。这类能力不进公开 MCP，是红线 |
| [voxflow](https://github.com/webkubor/voxflow) | 工具面很清晰，但环境门槛高（本地 TTS 模型约 2.9GB），适合作为可选重型组后续加入 |
| [trend-radar](https://github.com/webkubor/trend-radar) / [path-guard](https://github.com/webkubor/path-guard) / [deadcode-reaper-skill](https://github.com/webkubor/deadcode-reaper-skill) | 能力好，目前以仓内脚本 / Agent Skill 为主，待发布独立 CLI 包后接入 |
| `im-notify-kit` / `ai-sse-kit` 等 | 纯库，没有独立的命令行工具面 —— 要进得先给它们写一个 CLI |

**想加一组？** 三步：给那个项目确认 CLI 能装、在 `src/clis.ts` 加一份 `CliSpec`、
在 `src/groups/` 加一个分组文件并挂到 `src/registry.ts` 的 `GROUPS`。
MCP 侧不写任何业务逻辑。

## 验证

```bash
node test-mcp.mjs      # 起 server 跑 initialize + tools/list
                       # 断言：49 个工具；每个名字以所属分组 id 开头；旧变量名仍生效
```

`CS_MCP_GROUPS=all` 是测试用的启动方式 —— CI 机器上什么 CLI 都没装，
走默认的探测策略会一组都不启用，那就测不到工具集本身了。旧名 `MUSEAV_MCP_GROUPS`
会被**再起一次 server** 验证，确认与新名等价（改名的静默降级只在这条路上暴露）。

## 说明

`museav_gen_background` 的 `prompt` / `skill` / `template` **三者必须且只能提供一个**：`prompt` 是直接给提示词，`skill` 和 `template` 是让中台在服务端展开提示词（配合 `input` 传一句业务描述）。

四个本地后期工具的 `out` 已存在时，CLI 会拒绝覆盖 —— 这是防手滑的语义，MCP 保留它：
要覆盖就显式传 `overwrite: true`，否则报错原文会回到 Agent 手里。

`museav_list_templates` / `museav_list_skills` 取的是 CLI 的**人类可读表格**（stderr），因为 stdout 只有裸 id；
`museav_list_jobs` 取 stdout 的完整 JSON（含 `cdn_url` / `status` / `error`）。清单超过 8000 字会截断，
并附一句「输出已截断」——不附的话 Agent 会把截断处当成清单结尾。

本地工具的超时上限是 10 分钟 —— 超分和 LaMa 修复在大图上确实会慢。

## License

MIT
