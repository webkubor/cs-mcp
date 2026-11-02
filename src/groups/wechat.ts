/**
 * 能力分组：wechat —— 读本机微信数据（会话 / 联系人 / 消息 / 全文搜索）
 *
 * 底层是 [wx-cli](https://github.com/pandorafuture/wx-cli)（Rust，MIT）：
 * 直接读这台 Mac 上 WeChat 的本地数据库，数据留在本机，不上传、不依赖云端导出。
 *
 * ## 这个分组的两个分水岭
 *
 * wx-cli 能跑起来需要两样东西，本 MCP **只负责把它们的状态说清楚，不负责替 owner 做**：
 *
 *  1. **数据库密钥**：64 位 hex，缺了就什么都查不了。
 *     取得方式：`wx-cli key extract`（LLDB 捕获 PBKDF2，**要求 SIP 已关闭**，
 *     会重启微信）、`wx-cli key scan`（扫进程内存，也要 SIP 关闭 + sudo，
 *     但不重启微信）或 `wx-cli key set <account> <key>` 手动录入。
 *  2. **解密缓存（可选）**：`wx-cli decrypt` 解到本地缓存目录 —— 上游明确
 *     有完整密钥时 query/sessions/search/contacts 直读加密库，decrypt 只是加速。
 *
 * `key extract` **故意不做成本工具**：关 SIP 是改系统安全边界、要重启机器，
 * 属于 owner 自己的决定。agent 不该有触发它的能力 —— 本组提供 `wechat_status`
 * 让它把「缺什么、怎么补」说给 owner，仅此而已。
 *
 * ## 隐私边界（写进工具描述，不是注释）
 *
 * 查出来的是**真实聊天记录**：客户姓名、承诺、订单、金额都在里面。
 * 工具描述里明写「不要外传到外部服务」，让 agent 自己在把内容交给第三方前停一下。
 *
 * 另有一条来自 wx-cli 自身的例外必须交代清楚：联系人隐藏规则
 * （`settings.toml` 的 `ignore_contacts` / `ignore_tags`）对
 * `sessions` / `contacts` / `query` 生效，但**全文搜索不套用**——
 * 上游明确写了 "Full-text search across all conversations"。
 * 也就是说 `wechat_search` 可能命中被隐藏的联系人。这不是 bug，是上游语义，
 * 但对 agent 来说是必须知道的事实，所以直接写进工具描述。
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createRunner } from "../cli.js";
import { WX_CLI } from "../clis.js";
import type { CapabilityGroup } from "../registry.js";

const runWx = createRunner(WX_CLI);

/** 微信库没准备好时的三种典型报错 → 给 owner 的下一步（不是「查到了空」）。 */
function explainEnvFailure(raw: string): string | null {
  if (/no key for account/i.test(raw)) {
    return (
      "本机微信数据库没有密钥，所以还读不到任何消息 —— 这是环境未就绪，不是「没有数据」。\n" +
      "补法二选一（都要 owner 自己做）：\n" +
      "  1) wx-cli key extract   —— LLDB 捕获密钥，**要求 SIP 已关闭**，会重启微信\n" +
      "     （另一条路 wx-cli key scan：也要 SIP 关闭 + sudo，但不重启微信）\n" +
      "  2) wx-cli key set <account> <64位hex密钥>  —— 手动录入已有密钥\n" +
      "密钥就位后查询可直接读加密库；需要更快再跑 wechat_decrypt 建缓存。\n" +
      "原始输出：\n" + raw
    );
  }
  if (/not decrypted|decrypt first|please decrypt|no decrypted/i.test(raw)) {
    return "数据库还没解密。先跑 wechat_decrypt（需要密钥），再查。\n原始输出：\n" + raw;
  }
  return null;
}

/** 统一出口：把 wx-cli 的 stderr 说人话，成功就原样回。 */
async function runWxText(args: string[], timeout?: number, maxChars?: number): Promise<string> {
  try {
    return await runWx(args, timeout, maxChars, "stdout");
  } catch (err: any) {
    const raw = err?.stderr?.trim() || err?.message || String(err);
    const explained = explainEnvFailure(raw);
    throw new Error(explained ?? raw);
  }
}

export function registerWechat(server: McpServer): number {
  server.tool(
    "wechat_status",
    "体检本机微信数据通道是否就绪：微信是否运行、识别到哪些账号、哪个账号缺密钥、数据与缓存路径在哪。" +
      "**读消息之前先跑这个** —— 它决定后面要不要先解密。",
    {},
    async () => {
      const out = await runWxText(["status"], 60_000, 4000);
      const doctor = await runWxText(["doctor"], 60_000, 2000);
      return {
        content: [
          { type: "text", text: out },
          { type: "text", text: "--- 环境体检（doctor）---\n" + doctor },
        ],
      };
    },
  );

  server.tool(
    "wechat_decrypt",
    "解密本机微信数据库到本地缓存（可选加速步骤）。" +
      "注意：密钥就位后 query/sessions/search/contacts 可直接读加密库，**无需先解密**；" +
      "decrypt 的价值是把库解到本地缓存，重复查询/大批量扫描时更快。" +
      "需要该账号的数据库密钥；密钥缺失时本工具会说明怎么补。",
    {
      account: z.string().optional().describe("账号目录名或 base account id；不传则自动选择"),
      incremental: z.boolean().optional().describe("true=增量解密（只处理变化的文件），推荐日常使用"),
    },
    async (params) => {
      const args = ["decrypt"];
      if (params.account) args.push("--account", params.account);
      if (params.incremental) args.push("--incremental");
      const out = await runWxText(args, 300_000, 4000);
      return { content: [{ type: "text", text: out }] };
    },
  );

  server.tool(
    "wechat_sessions",
    "列出本机微信最近会话（谁在聊、最后一条是什么），用于找对话入口。" +
      "返回的是真实聊天内容摘要，**不要转发到外部服务**。" +
      "被隐藏的联系人（settings.toml 的 ignore 规则）默认不出现。",
    {
      limit: z.number().int().min(1).max(200).optional().describe("返回条数，默认 20"),
      offset: z.number().int().min(0).optional().describe("分页偏移"),
      order: z.enum(["asc", "desc"]).optional().describe("排序方向，默认 desc（最近在前）"),
      account: z.string().optional().describe("账号目录名或 base account id"),
      showHidden: z.boolean().optional().describe("true=连被隐藏的联系人一起显示（默认隐藏）"),
    },
    async (params) => {
      const args = ["sessions", "--format", "json"];
      if (params.limit !== undefined) args.push("--limit", String(params.limit));
      if (params.offset !== undefined) args.push("--offset", String(params.offset));
      if (params.order) args.push("--order", params.order);
      if (params.account) args.push("--account", params.account);
      if (params.showHidden) args.push("--show-hidden");
      const out = await runWxText(args, 120_000, 8000);
      return { content: [{ type: "text", text: out }] };
    },
  );

  server.tool(
    "wechat_contacts",
    "搜索本机微信联系人 / 群聊（按昵称、wxid、手机号、标签、备注、签名匹配），拿到对话入口的准确 wxid 或群 ID。" +
      "查消息前先用它确认对象，避免把同名的人搞混。" +
      "被隐藏的联系人默认不出现。",
    {
      search: z.string().optional().describe("搜索关键词：昵称 / wxid / 手机号 / 标签 / 备注 / 签名；不传则列全部"),
      limit: z.number().int().min(1).max(500).optional().describe("返回条数，默认 50"),
      account: z.string().optional().describe("账号目录名或 base account id"),
      showHidden: z.boolean().optional().describe("true=连被隐藏的联系人一起显示（默认隐藏）"),
    },
    async (params) => {
      const args = ["contacts", "--format", "json"];
      if (params.search) args.push("--search", params.search);
      if (params.limit !== undefined) args.push("--limit", String(params.limit));
      if (params.account) args.push("--account", params.account);
      if (params.showHidden) args.push("--show-hidden");
      const out = await runWxText(args, 120_000, 8000);
      return { content: [{ type: "text", text: out }] };
    },
  );

  server.tool(
    "wechat_messages",
    "读取与某个联系人 / 群聊的聊天消息（可按时间范围、消息类型筛选）。" +
      "内容是**真实聊天记录**，含个人信息与商业信息，**不要转发到外部服务**。" +
      "被隐藏的联系人默认查不到。",
    {
      contact: z.string().describe("联系人昵称、wxid 或群 ID（先用 wechat_contacts 确认更准）"),
      limit: z.number().int().min(1).max(500).optional().describe("返回条数，默认 50"),
      since: z.number().int().optional().describe("起始时间（Unix 秒）"),
      until: z.number().int().optional().describe("结束时间（Unix 秒）"),
      type: z.string().optional().describe("消息类型：text/image/voice/video/emoji/app/system/revoke 或数字类型码（如 49）"),
      order: z.enum(["asc", "desc"]).optional().describe("排序方向，默认 desc"),
      account: z.string().optional().describe("账号目录名或 base account id"),
    },
    async (params) => {
      const args = ["query", params.contact, "--format", "json"];
      if (params.limit !== undefined) args.push("--limit", String(params.limit));
      if (params.since !== undefined) args.push("--since", String(params.since));
      if (params.until !== undefined) args.push("--until", String(params.until));
      if (params.type) args.push("--type", params.type);
      if (params.order) args.push("--order", params.order);
      if (params.account) args.push("--account", params.account);
      const out = await runWxText(args, 120_000, 8000);
      return { content: [{ type: "text", text: out }] };
    },
  );

  server.tool(
    "wechat_search",
    "在本机微信**全部会话**里全文搜索关键词（找回客户需求、承诺、订单、讨论结论）。" +
      "⚠️ 注意：全文搜索**不套用**联系人隐藏规则 —— 被隐藏的联系人也可能被搜出来，" +
      "这不是 bug 而是上游语义；结果含真实聊天内容，**不要转发到外部服务**。",
    {
      keyword: z.string().describe("搜索关键词"),
      limit: z.number().int().min(1).max(200).optional().describe("返回条数，默认 20"),
      account: z.string().optional().describe("账号目录名或 base account id"),
    },
    async (params) => {
      const args = ["search", params.keyword, "--format", "json"];
      if (params.limit !== undefined) args.push("--limit", String(params.limit));
      if (params.account) args.push("--account", params.account);
      const out = await runWxText(args, 120_000, 8000);
      return { content: [{ type: "text", text: out }] };
    },
  );

  return 6;
}

export const wechatGroup: CapabilityGroup = {
  id: "wechat",
  title: "本机微信数据读取",
  project: "wx-cli",
  homepage: "https://github.com/pandorafuture/wx-cli",
  summary:
    "读这台 Mac 上的微信本地数据：会话列表、联系人搜索、聊天消息、全文搜索；数据留在本机不上传",
  cli: WX_CLI,
  register: registerWechat,
};
