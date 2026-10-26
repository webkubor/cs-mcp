# Changelog

## 3.1.0 (2026-10-25)

### 🚀 对外生态大扩容：接入 writing（表达门禁）与 scorecard（开源质检）

定调双轨生态边界（CortexOS 为对内私有决策与调度中枢，cs-mcp 为对外开源超级工具链网关）：
- **新增 `writing` 能力分组（3 个工具）**：
  - `writing_lint`：Markdown 静态去 AI 味门禁（机械拦截假人过渡词、机械排比、高中作文腔与空洞正能量结尾，逐行给出整改建议）。零外部依赖、内置开箱即用。
  - `writing_rubric`：查询小红书、Twitter/X、Reddit、掘金的「说说/短动态」扣分清单与致命反模式（Anti-patterns）。
  - `writing_compose`：基于 5D 原子表达组合矩阵（谁×在哪×场景×口吻）合成高信噪比人设提示词与开场骨架。
- **新增 `scorecard` 能力分组（3 个工具）**：
  - `scorecard_audit`：GitHub 仓库 / npm 包 / 网页可用性的 9 维度工程成熟度审计（对齐 NIST SSDF、OpenSSF）。
  - `scorecard_compare`：双目标基准与对比审计（A/B 测试或测试 vs 线上环境比对）。
  - `scorecard_geo`：品牌在 ChatGPT、Claude、Perplexity 等主流 AI 问答中的提及率、推荐位次与市场心智份额审计。
- **全量工具数从 43 扩展至 49**，全量能力组从 6 组扩容至 8 组。
- **修复**：`cliAvailable` 短路求值逻辑，确保无外部 CLI 依赖的纯内置分组（如 `writing`）在探测式模式下默认无缝启用。

## 3.0.0 (2026-10-13)

### 正名：museav-mcp → cs-mcp。它是 cs 的，不是 museav 的

owner 口径一句话：**cs 是核心，museav 是云能力。**

旧名一直和它自己的定位拧着 —— 头注释早就写着「CS 系统（CortexOS）的 MCP，owner 个人工具链的
串联层」，6 个分组里 5 个与 museav 无关；而它的 remote 本来就挂在**个人账号**下，反倒
`museav-manager` / `web-ui` / `museav-docs` 都在 `gitlab.com/museav/*` 组织里。
**这次改名不是把它搬出 museav，是让仓库名追认它本来就在的地方。**

仓库、npm 包名、`bin` 命令、server 名、README 全部统一成 `cs-mcp`；本地目录从
`~/dev/muse/museav-mcp` 归位到 `~/dev/agent-infra/cs-mcp`（与 contrast-guard / facet /
lite-browser / kyvault 这些个人工具链仓住一起）。

#### ⚠️ 老工具名契约作废（破坏性）

3.0.0 起，`museav` 那 17 个工具**统一加 `museav_` 前缀**：

```
gen_background → museav_gen_background      list_jobs → museav_list_jobs
remove_bg      → museav_remove_bg           …（共 17 个，动作词一个字没改）
```

**为什么现在才敢改**：2.2.0 的条目说「21 个工具名一个字没动，老用户的 agent 正靠它们干活」——
那个前提**不成立**。这个包 2026-10-05 已从 npm 撤下（此前误发到公司账号），从未面向外部发布，
**没有下游契约要保护**。所以「只增不减」这条自我约束在这里是多余的，撤掉它反而是对的：
现在改的成本是 0，等到真有人用了再改，成本就不是 0 了。

顺带把全仓唯一的命名例外补平了 —— 现有约定是 `<分组id>_<动作>`，6 组里 5 组早就遵守
（`vlm_*` / `contrast_*` / `facet_*` / `reel_*` / `browser_*`），只有 `museav` 那 17 个
因为是「从旧单文件原样搬过来的，一个字都没改」而没前缀。**`test-mcp.mjs` 现在把这条规范
写成断言**：每个工具名必须以所属分组 id 开头（`groups_list` 除外），以后再想接一组，
名字不一致会在 CI 就被拦住，而不是靠人记得。前缀集合从 `registry.ts` 的 `GROUPS` 推导，
新增分组不用改测试。

这也让「**museav = 云能力**」在工具面上直接可读：带 `museav_` 的 17 个是在线服务（要登录、
要网络、有余额、会花钱），其余全是离线确定性计算。

#### ⚠️ 环境变量改名（带旧名兼容，别漏）

| 旧 | 新 |
|---|---|
| `MUSEAV_MCP_GROUPS` | `CS_MCP_GROUPS` |
| `MUSEAV_MCP_BROWSER_AGENT` | `CS_MCP_BROWSER_AGENT` |

**两个都保留旧名兜底**，新名优先；两个都设且值不同时以新名走并往 stderr 报一句。

为什么必须留、为什么值得单独写一段：**变量名被忽略时不会报错，会静默降级**。
旧变量没读到 → 开关值变空 → `selectGroups` 判定 `byDefault = true` → 悄悄退回「装了 CLI 才启用」。
原先写 `MUSEAV_MCP_GROUPS=all` 的人，那些本机没装 CLI 而被强开的分组会**无声消失**；
写 `-museav` 的人，排除会**无声失效**。更糟的是此时 include/exclude 都空，
连「不认识的 id」告警都不会触发 —— **全程零可见信号**。

现在这条路径有三级可见性：stderr 一行「正在用旧变量名」，`groups_list` 输出头的提示，
以及 `test-mcp.mjs` 里**真起第二次 server** 断言新旧名起出同一份 43 个工具。

`MUSEAV_MCP_BROWSER_AGENT` 是更容易漏的那个（第二个变量）：漏了不报错，只是浏览器身份
静默退回 `mcp` —— 而 `mcp` 可能正跟另一个实例共用会话，正是当初加这个变量要防的事。

#### 客户端命名空间：DSH 的 `serverName` 从 `museav` 改成 `cs`

`serverName` 决定客户端里的工具命名空间。不改的话，加了前缀会变成
`mcp__museav__museav_gen_background` 这种双重前缀，所以一并改成 `cs`
（`mcp__cs__museav_gen_background`），并同步 `dsh-museav-assets` 里的 9 处引用。

DSH / WorkBuddy 是 **GUI 工具、不是 Agent**（见 gui-not-agent 红线）—— 改的是工具自身的
配置文件，不是给它派活。

#### 修掉的坑

- **`resolveGroupsSpec` 单独抽成叶子模块 `src/env.ts`**：`groups/browser.ts` 也要读环境
  变量，而 `registry.ts` 已经 import 了 `browser.ts`，运行时值放 `registry.ts` 会构成循环依赖。
- **`src/clis.ts` 补了一份 `minVersion` 能不能填的实测表**。六个 CLI 里只有 `museav` 能填，
  另外五个不是「漏了」：
  `museav` ✓（3.12.0）、`vlm` ✓（0.1.0）、`lite-browser` ✓（1.5.0）但都没确立下限；
  **`contrast-guard` 退出码 2、`facet` 退出码 1、`reel` 不认识这个选项（退出码 1）** ——
  这三个填了不是「版本误报」，是**整组永久不可用**：`ensure()` 只吞 ENOENT，非零退出
  直接 throw 且不被 `run()` 捕获，而失败不缓存，于是每次调用都重探、每次都同样失败。
- **`package.json` 去掉 `notify` 脚本**：目录搬家后 `../notify.mjs` 相对路径已断；更根本的是
  那个脚本的头注释写明「严禁走外部 CS 系统」，本包不该用它（发版通报走
  `publish.yml` → `manager.museav.top/api/cli-release`）。
- 描述里「27 个工具」漂移成 43，一并修。

#### 与 `cs mcp serve` 的关系（没变，但值得说清）

系统里有**两个**「cs 的 MCP」，互补不重合：`cs mcp serve`（Go，server 名 `cortexos`）
管**系统上下文**（规则/技能/知识搜索/CLI 台账），本仓管**工具链串联**。
长期看，按收敛定律（能力的默认归属是范围最大的那个载体）加上本仓「能力在 CLI 里，
MCP 只做串联」这条硬原则 —— 而 `cs` 本身就是个 CLI —— cs 核心能力应当作为 cs-mcp 的
一个 `cs` 分组薄封装，两个 MCP 收敛成一个。**本轮不做**（跨语言，会动 `cmd/mcp.go`），
已在 README 写明区别。

> 发布说明：`cs-mcp` 这个名字在 npm 上 2025-04-25 也被撤过，当前是空位。本包走 Trusted
> Publishing(OIDC) + provenance，绑定是 npmjs.com 上「仓库 + workflow」维度的 ——
> GitHub 仓改名后**必须在 npmjs.com 重新绑定**，否则发布必失败。

## 2.2.0 (2026-10-02)

### 从「museav 的 MCP」变成 CS 系统的 MCP：能力分组化，开始串联整条工具链

owner 口径：**能力归 CLI，MCP 只做串联层。** 这个 MCP 从此是 CS 系统（CortexOS）的 MCP ——
把个人工具链上各开源项目的 CLI 能力，串成一张任意 agent 都能调用的网。要加能力，
先加到那个项目的 CLI，再在这儿加一个分组；MCP 侧不写业务逻辑。

**名字和 21 个工具名一个字没动** —— 老用户的 agent 正靠它们干活。`test-mcp.mjs` 现在把
这 21 个名字逐个钉死，掉了就 CI 变红。

新增四个分组（都是零账号、陌生人装完就能用）：

- `contrast`（[contrast-guard](https://github.com/webkubor/contrast-guard)）3 个工具：
  静态查色值、生成配置、渲染后计量与基线对比
- `facet`（[@webkubor/facet](https://github.com/webkubor/facet)）2 个工具：
  列排版模板、把 Markdown 排成 PDF / 长图 / 讲稿页
- `reel`（[@kubor/reel-kit](https://github.com/webkubor/reel-kit)）3 个工具：
  列版式模板、列配乐库、素材 + 逐句文案合成竖版成片（mp4）。
  **硬依赖系统里的 ffmpeg**（不在 npm 包里）。museav 出原料，它出能发的成品 ——
  这两段是一条业务线的前后半截，接上这条线在 MCP 里才闭环
- `browser`（[lite-browser](https://github.com/webkubor/lite-browser)）13 个工具：
  真实 Chrome 的打开/快照/点击/输入/按键/滚动/截图/执行 JS，加上
  **人类交接协议**（status → await-human → resume）与多 agent 会话隔离。
  没有官方 CLI 的服务（小红书 / 微信 / X）只能这么接。

  两条设计判断写进了代码注释：
  ① **包 CLI 而不是转发它自带的 MCP** —— 转发要给本 MCP 加一个
     JSON-Schema→Zod 的运行时依赖，还要管子进程生命周期，而它的 CLI 本来就
     覆盖同一批操作。按「能力归 CLI」的口径，包 CLI 才是对的那条路。
  ② **退出码 3/4 是状态不是故障**（需要人类介入 / 等待超时）—— 为此给 CliSpec
     加了 `stateExitCodes`：按码给不同的话，agent 才会去转告人类而不是重试。
  ③ **永远显式传 `--agent`** —— 它的默认身份是 `default`，实测第一次没传就开在
     别人正在用的会话上、把对方页面导航走了；MCP 现在用自己固定的身份（默认 `mcp`）。

  **刻意不暴露**：`exec --`（任意 shell 命令）、`cdp`（裸协议）、
  `cookie export` / `cookie pull-system`（导出/解密 Cookie = 交出凭据，
  与 kyvault 不进公开 MCP 同一条理由）。

工具数 21 → **43**（museav 17 + vlm 4 + contrast 3 + facet 2 + reel 3 + browser 13 + `groups_list`）。

#### 行为变化：默认策略改成「探测式」

某个分组的 CLI 在 `PATH` 上，它的工具才会注册。

工具 schema 会随**每一次**模型请求发出去（原先 21 个工具约 3~4k token）。聚合 MCP 天然越串
越多，不设开关，代价是每个用户每次请求都在为「他机器上根本没装的那些工具」付 token。

装全了的用户感知不到区别；只装了 museav-cli 的用户，工具列表里少了 4 个 `vlm_*` ——
那 4 个在没有 `vlm` 二进制的机器上本来也只会报错。没启用的分组不会消失：新增的
`groups_list` 工具始终可用，它会说清这个 MCP 还能干什么、该装什么命令。

想恢复「全列出来」，设 `MUSEAV_MCP_GROUPS=all`；裁剪用 `-museav` 这种写法。

#### 两个实测踩到的坑（都写进注释了）

1. **`contrast-guard` 用退出码当判据**：检查不达标时它把完整 JSON 报告打到 stdout，然后
   `exit 1`。按「非零 = 调用失败」处理，agent 拿到的是「contrast-guard --json 执行失败」，
   而哪一对颜色、比值多少、建议改成什么色值 —— 全丢。为此给 `CliSpec` 加了 `verdictExit`。
2. **`facet` 没有 list 命令**，模板清单只能从它自己的报错里取；而 Node 打栈时会先打出错
   那一行的**源码**，那行里也写着 `Available: ${templateNames.join(", ")}` —— 直接取第一个
   匹配，拿到的「清单」是两段模板字面量垃圾。已按「滤掉含 `${` 的候选行 + 只认 kebab-case」
   修掉，并保留「报错格式变了就把原话透出来，不编」。

#### 其他

- server 版本从 `package.json` 读（原先写死在代码里，包已发到 2.x 时 server 还自称 1.1.0）
- 加了 MCP `instructions`：告诉 agent 先查 `groups_list` 再让用户装 CLI
- 每个分组的 CLI 缺失/过旧报错都带**可照抄的安装命令**，并支持用环境变量指到绝对路径

#### 还没进来的（不是忘了）

`lite-browser` 自己就有 MCP，聚合层该**转发**而不是重包（转发机制还没做）；
`scorecard` 的 npm 名被一个无关旧包占着，`npm i -g scorecard` 装不到它；
`kyvault` 是密钥库、`get` 会打印明文，这类能力不进公开 MCP。
完整清单与理由见 README 的「还没进来的项目」一节。

## 2.1.0 (2026-09-28)

### 接回 skillhub_* 三个工具：CLI 回来了，MCP 不该留着缺口

1.3.0 移除这三个工具的理由是「CLI 自己都没这个命令了」——那时 museav-cli 3.6.0
刚好移除了 `skillhub`。**2026-09-28 CLI 以 3.9.0 恢复了这个命令**（它是 MUSE AV
唯一的出站通道：装一个 CLI 既能出图又能把做好的 Skill 发到小红书），MCP 却还停在
「没有这条能力」。

缺口留着是有代价的：文档写着、用户以为装个 MCP 就能发 Skill，实际不行。

- `skillhub_tags` / `skillhub_whoami` / `skillhub_publish` 接回，工具数 18 → 21
- `MIN_MUSEAV` 3.6.0 → **3.9.0**（`skillhub` 是 3.9.0 才有的，用 3.6.0 当门槛
  等于放行一个会报 unknown command 的旧版 CLI）
- `skillhub_publish` 的工具说明里写进**平台资产护栏**：Skill 正文抄了 MUSE AV
  平台公共模板的提示词会被 CLI 拒绝；只引用模板 slug 放行。不写这条，Agent 遇到
  拒绝时只会看到一句「预演失败」，不知道为什么

`requireSkillPath` 这个 helper 从 1.3.0 起就一直没人用（工具被删了它被留下了），
这次接回工具正好用上，不用再删。

## 2.0.0 (2026-09-16)

### 加版本守卫：底层二进制太旧时直接说「请升级」，不再让 agent 撞 unknown command

本包自己零实现，全靠外部两个二进制干活 —— 代价是对它们的版本完全不设防。
**2026-09-16 真咬过一次**：owner 机器上全局 museav 卡在 3.4.0，新发的 3.5.0
根本没生效，而 MCP 一声不吭照常跑，是排查别的事时才发现的。

- `runMuseav` 入口加 `ensureMuseav()`：首次真要用时探一次 `museav --version`，
  低于 `MIN_MUSEAV`（当前 3.6.0）直接报错并给出可照抄的升级命令。
- **失败不缓存**：用户装好/升好之后，下一次调用就能通过，不必重启整个 MCP server。
  （实测验证：旧版被拦 → 升级 → 同一进程内下一次调用直接成功。）
- `vlm` 缺失时从裸 ENOENT 改成给出 `pipx install …` 安装命令。
- semver 比较抽成 `src/semver.ts` 并加断言。**按数字逐段比，不是字符串** ——
  字符串比的话 `"3.10.0" < "3.6.0"`，真出到 3.10 时会把新版本判成过旧、锁死全部工具。

### 版本号更正

1.3.0 移除了 `skillhub_*` 三个工具。按本仓自己的约定（test-mcp.mjs 顶部注释：
「删工具是破坏性变更，得走大版本」）那次就该发 2.0.0，发成 minor 是错的。
本次一并更正到 2.0.0 —— 加版本硬门槛本身也是破坏性的。

### 顺带修掉的文档漂移

- `reverse` 工具的 `local` 参数还写着「强制走本地 Ollama qwen3-vl」，
  而 museav-cli 3.5.0 起本地引擎已换成 mlx-vlm-kit。
- `test-mcp.mjs` 的 `EXPECTED_TOOL_COUNT` 还是 21（实际 18）。
  **这个断言本来就该拦住 1.3.0 那次删除，是我没跑 npm test 就发了。**

## 1.3.0 (2026-09-16)

### 移除 skillhub_* 三个工具（跟随 museav-cli 3.6.0）

museav-cli 3.6.0 删掉了 `skillhub` 命令（发小红书 SkillHub，owner 一次没用过，
且是该 CLI 唯一的第三方工具依赖）。本包这三个工具是它的透传层，必须同步删，
否则 agent 调用会拿到 `unknown command`。

- 移除 `skillhub_tags` / `skillhub_whoami` / `skillhub_publish`，以及只为它们
  服务的 `skillhubLoggedIn()` 登录态探测。工具数 21 → 18。
- 前置条件写清最低版本：`museav-cli >= 3.6.0`。

## 1.2.0 (2026-09-15)

### 补上 CLI 3.4.0 的四个新工具，门槛提到 21 个

`npx -y museav-mcp` 终于把 `museav` 升级后的命令也包进来。`speak` / `transcribe` 不在
3.4.0（计划中），所以这一版只上这四个：

| 工具 | 背后 | 取流 |
| --- | --- | --- |
| `reverse` | `museav reverse`（中台 API 反推 SCULPT prompt） | stdout = 一行英文 prompt；stderr = 结构化中文报告（SCULPT 六要素） |
| `list_models` | `museav models [--video]` | stderr = 人类表格（label + 时长/分辨率），便于 agent 挑 |
| `balance` | `museav balance` | stdout = 完整 JSON（balance_cny / markup_pct / checked_at），agent 解析更稳 |
| `list_video_templates` | `museav video-templates [--category]` | stderr = 人类表格（id / 中文名 / 分类 / 比例 / 模型 / 字段 / 参考视频 / 归属） |

### reverse 与 vlm_reverse_prompt 的分工

按用户原则「图像识别优先走 mlx-vlm-kit」，新增 `reverse` 并不意味着以后默认用它。
两个工具是**互补**而不是替代：

- **`vlm_reverse_prompt`**（本地，Qwen3-VL-4B，mlx-vlm-kit）：通用 prompt 反推，免登录零成本，默认够用
- **`reverse`**（中台 API）：平台专用 SCULPT 六要素格式，喂给 `gen_background` 更顺手

`reverse` 的 description 里直接写了这个分工，agent 调它前应该先看 `vlm_reverse_prompt`
够不够。

### 兼容性

工具只增不减；1.1.0 的所有 schema 保持可用。新增的 `reverse` 与已有的 `vlm_reverse_prompt` 没有参数冲突（一个吃本地图片路径/URL，一个只吃本地路径）。

## 1.1.0 (2026-09-15)

### 把 1.0.1 之后压在本地的东西发出去，并补齐包装层缺的参数

1.0.1 之后仓库里已经有了 mlx-vlm-kit 那四个本地看图工具，但它们**从没发到 npm**：
`package.json` 还停在 1.0.1、最新 tag 是 `v1.0.1`、`publish.yml` 只在推 `v*` 时触发。
所以 `npx -y museav-mcp` 拿到的一直是八个工具的旧版。这版把它们发出去，共 **17 个工具**。

### 新增：本地看图理解（mlx-vlm-kit）

免登录、零调用成本（本地 Qwen3-VL-4B，Apple MLX）：

| 工具 | 干什么 |
| --- | --- |
| `vlm_describe` | 描述图片主体与色调 |
| `vlm_ask` | 对图片任意提问 |
| `vlm_cover_check` | 音乐封面语义质检（`batch=true` 递归目录） |
| `vlm_reverse_prompt` | 反推出图 prompt，喂回 `gen_background` 复刻同风格 |

前置：`pipx install git+https://github.com/webkubor/mlx-vlm-kit.git`（>= 0.1.0）。
`vlm` 不在 PATH 时用 `MLX_VLM_BIN` 指定。与 `museav reverse` 的分工：reverse 专做
SCULPT prompt 逆向，`vlm_*` 是通用看图问答，两者互补。

### 新增：素材与清单五个工具

出图前那两个必填项（模板 id、技能 slug）只能从中台实时拉。Agent 凭印象编一个，
中台报「模板不存在」，它分不清是自己拼错了还是真没这个模板——这五个工具补的就是这一步。

| 工具 | 背后 |
| --- | --- |
| `list_templates` | `museav templates`（可按 category / type / 归属过滤） |
| `list_skills` | `museav skills`（可按 genre 过滤） |
| `list_jobs` | `museav jobs`（出图结果 URL、失败原因） |
| `upload_asset` | `museav upload`（拿公网直链，喂垫图） |
| `image_to_template` | `museav image-to-template`（读图 + 文字层逆向 + 变量化，默认 `dryRun` 可只看草稿） |

### 修复

- **`templates` / `skills` 只回传裸 id，Agent 挑不了**。museav 的双路输出是有分工的：
  stdout 给机器（`templates`/`skills` 是换行分隔的 id/slug），stderr 给人（带中文名、
  分类、比例、字段、是否需垫图的表格）。默认取 stdout 等于把 104 个模板压成一串 UUID
  丢给 Agent。清单类改取 stderr；`jobs` 反过来，stdout 是完整 JSON（含 cdn_url /
  status / error），保持原样。
- **清单被截断在 2000 字且不留痕**。上限放宽到 8000，并且截断时追加
  「…（输出已截断，共 N 字，用过滤参数收窄）」——不说的话 Agent 会把截断处当成清单结尾。
- **四个本地后期工具都缺 `--overwrite`**。CLI 在输出文件已存在时会拒绝执行，而 MCP
  从不传这个标志，于是同一个 `out` 路径第二次调用必失败。现在四个工具都加了
  `overwrite` 参数（默认 false，保持 CLI 的防覆盖语义，报错原文照回给 Agent）。
- **`remove_bg` 的模型枚举漏了 `birefnet`**——它是 CLI 的默认模型（细节最好），
  枚举里只有 `isnet` / `u2net`，等于最该用的那个传不进去。
- **`gen_background` 缺 5 个 CLI 已有参数**：`fields`（模板占位符取值）、
  `duration` + `image`（视频时长 / 图生视频首帧）、`project`（归档工作区）、
  `batch`（批量出图清单）。

### 兼容性

工具只增不减；`gen_background`、四个本地后期、`skillhub_*` 的原有参数全部保持可用。
新增参数都是可选的。唯一的行为变化是 `list_*` 类的回传内容变长（上限 8000 字）。

## 1.0.1 (2026-09-08)

### 首次走 CI 发版

1.0.0 是本地 `npm publish` 发的——首发时包在 npm 上还不存在，Trusted Publishing
没法预先绑定仓库，所以那版没有 provenance。这版起走 GitHub Actions：
三重版本校验（tag / package.json / CHANGELOG 顶部）→ 真起一次 stdio server 冒烟
→ `npm publish --provenance`。

功能没有变化，工具仍是 1.0.0 那八个。

- chore: `repository.url` 用 `git+https` 形式，去掉 `npm publish` 的规范化警告

## 1.0.0 (2026-09-08)

### 首次发布到 npm：一行接入，不用再 clone

以前接这个 MCP 要 clone 仓库、`pnpm build`、再往配置里填绝对路径。现在：

```bash
claude mcp add museav -- npx -y museav-mcp
```

### 八个工具

| 工具 | 背后 |
| --- | --- |
| `gen_background` | `museav gen`（出图/出视频，走中台，需登录） |
| `remove_bg` / `upscale_image` / `remove_watermark` / `compress_image` | `museav` 本地后期（免登录、不耗额度） |
| `skillhub_tags` / `skillhub_whoami` / `skillhub_publish` | `museav skillhub`（发布 Skill 到小红书 SkillHub） |

### SkillHub 发布：默认 dry-run，不会替你提交

- `skillhub_publish` **默认只预演**（本地打包 + 校验，不上传不提交），把待提交内容返回给人核对；
  只有用户明确说「提交 / 确认 / submit」时才带 `submit=true` 真提交
- 提交不可逆：Skill ID 是平台主键，跨版本不可改名
- 内容标签用 `skillhub_tags` 实时拉，不硬编码
- **真提交前会先卡登录态**：未登录时 CLI 会打印二维码并阻塞等扫码，而 MCP 走 execFile
  要等进程结束才拿到输出——二维码根本传不到人眼前，就是死锁。所以这里直接报错，
  引导用户去终端跑一次 `museav skillhub login`，而不是挂在那儿

> 依赖全局的 `museav`（>= 3.1.0，skillhub 系工具要它）：`npm i -g museav-cli`。
> 不在 PATH 时用 `MUSEAV_BIN` 环境变量指定。
