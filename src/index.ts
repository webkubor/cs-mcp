#!/usr/bin/env node
/**
 * cs-mcp —— CS 系统（CortexOS）的 MCP：owner 个人工具链的串联层。
 *
 * ## 它是什么
 *
 * 把 owner 名下各开源项目的 **CLI 能力**，串成一张任意支持 MCP 的客户端
 * （Claude Code / Cursor / Codex / Gemini / OpenCode / DSH 桌面…）都能直接调用的网。
 * 注意 DSH / WorkBuddy 是 **GUI 工具、不是 Agent** —— 见 `cs rule agent_governance`
 * 的 gui-not-agent 红线（owner 2026-10-13 定）。
 *
 * 分层是硬的：**能力在 CLI 里，MCP 只做串联** —— 探测、发现、调用、错误说人话。
 * 这个仓自己零实现：每个工具都是对某个项目 CLI 的一次薄封装。
 * 要加能力，先加到那个项目的 CLI，再在这儿加一个分组（见 src/registry.ts）。
 *
 * ## 与 `cs mcp serve` 的分工（别搞混，两个都叫「cs 的 MCP」）
 *
 * | | `cs mcp serve`（CortexOS 内置，server 名 cortexos） | 本仓 cs-mcp |
 * |---|---|---|
 * | 形态 | Go，`cs` 子命令 | TypeScript，独立 npm 包 |
 * | 管什么 | **系统上下文**：规则 / 技能 / 知识搜索 / CLI 台账 / Agent 上下文 | **工具链串联**：各开源项目的 CLI 能力 |
 * | 真源 | `cli-registry.json` + `docs/rules` + `skills` | 各项目自己的 CLI |
 *
 * 本仓不管系统上下文，`cs mcp serve` 不管工具链 —— 两者互补，不重合。
 *
 * ## 分组
 *
 * | id | 项目 | 层次 | 干什么 |
 * |----|------|------|--------|
 * | museav   | museav-cli      | **云能力**（在线、需登录） | 出图/出视频、本地后期、模板技能、素材、SkillHub |
 * | vlm      | mlx-vlm-kit     | 本地 | 离线看图（Apple Silicon） |
 * | contrast | contrast-guard  | 本地 | 对比度门禁：静态检查 + 渲染后计量 |
 * | facet    | @webkubor/facet | 本地 | Markdown 排版成 PDF / 长图 / 讲稿页 |
 * | reel     | @kubor/reel-kit | 本地 | 素材 + 逐句文案 → 竖版成片（需要 ffmpeg） |
 * | browser  | ego-browser     | 本地 | ego lite 的 Chromium 操控 + 人类交接协议 |
 *
 * owner 口径：**cs 是核心，museav 是云能力**。museav 组要登录、要网络、有余额配额，
 * 其余五组是离线确定性计算 —— 性质不同，工具名也用 `museav_` 前缀标出来。
 *
 * 默认**装了哪个 CLI 就启用哪个分组**（工具 schema 会随每次请求发出去，
 * 不该让用户为没装的东西付 token）。用 CS_MCP_GROUPS 强开或裁剪；
 * 没启用的分组通过 `groups_list` 工具仍然可见 —— 那是这张版图的地图。
 *
 * 传输：stdio。图片与文档一律以**绝对路径**传递，处理结果写回磁盘并返回路径 ——
 * 不走 base64，大图不炸上下文。
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFileSync } from "node:fs";
import {
  GROUPS,
  GROUPS_ENV,
  GROUPS_ENV_LEGACY,
  resolveGroupsSpec,
  selectGroups,
  registerGroupsMeta,
} from "./registry.js";

// 版本从 package.json 读 —— 原先写死在代码里，包已发到 2.x 时 server 还自称 1.1.0
const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };

// 只读一次：selection / groups_list / 启动告警三处共用同一个判定，
// 各自 resolve 会出现「报的字和实际用的值不是一回事」。
const groupsSpec = resolveGroupsSpec();
const selection = selectGroups(groupsSpec.spec);

const server = new McpServer(
  { name: "cs-mcp", version: pkg.version },
  {
    instructions:
      "这是 CS 系统（CortexOS）的 MCP —— owner 个人工具链的串联层，按「能力分组」组织，" +
      "每个分组对应一个开源项目及其 CLI。museav 组是在线云能力（需登录），其余是本地能力。\n" +
      "工具列表里只会有当前机器上装了 CLI 的分组；想用别的能力，先调 groups_list 看有哪些分组、" +
      "各自对应哪个项目、装什么命令，再让用户装好并重启本 server。\n" +
      "文件一律用绝对路径传入，结果写回磁盘并返回路径。\n" +
      "注意：本 server 只管工具链串联；系统上下文（规则/技能/知识搜索/CLI 台账）走 `cs mcp serve`。",
  },
);

const toolCounts = new Map<string, number>();
for (const group of selection.enabled) {
  toolCounts.set(group.id, group.register(server));
}
registerGroupsMeta(server, selection, toolCounts, groupsSpec);

function startupLine(): string {
  const on = selection.enabled.map((g) => `${g.id}(${toolCounts.get(g.id)})`).join(" ");
  const off = selection.skipped.map((g) => g.group.id).join(" ");
  const total = [...toolCounts.values()].reduce((a, b) => a + b, 0) + 1; // +1 = groups_list
  return (
    `[cs-mcp] ${GROUPS.length} 组中启用 ${selection.enabled.length} 组，${total} 个工具` +
    (on ? ` · 已启用: ${on}` : "") +
    (off ? ` · 未启用: ${off}` : "")
  );
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(startupLine() + "\n");
  // 旧变量名还在用 → 说一句，让它有机会迁到新名（不说就永远不会有人改）
  if (groupsSpec.source === "legacy") {
    process.stderr.write(
      `[cs-mcp] 正在用旧变量名 ${GROUPS_ENV_LEGACY} 读分组开关；请改成 ${GROUPS_ENV}（旧名仍兼容）\n`,
    );
  }
  if (groupsSpec.conflict) {
    process.stderr.write(
      `[cs-mcp] ${GROUPS_ENV} 与 ${GROUPS_ENV_LEGACY} 都设了且值不同 —— 以 ${GROUPS_ENV} 为准\n`,
    );
  }
  if (selection.unknown.length > 0) {
    process.stderr.write(
      `[cs-mcp] ${GROUPS_ENV} 里有不认识的 id：${selection.unknown.join(", ")}；` +
        `可用的：${GROUPS.map((g) => g.id).join(", ")}\n`,
    );
  }
}

main().catch((err) => {
  process.stderr.write("[cs-mcp] fatal: " + (err?.message || err) + "\n");
  process.exit(1);
});
