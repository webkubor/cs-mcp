/**
 * 能力分组：browser —— 浏览器操控（开源项目 ego lite，命令 ego-browser）
 *
 * 真实 Chromium（ego lite 自带）+ 复用用户已登录的网站 + **人类交接协议**。
 * 撞到登录墙、验证码、扫码时，用 browser_await_human 把控制权交给人，人完成后 browser_resume 恢复。
 *
 * ## 实现方式
 *
 * 每个工具都是一段 `ego-browser nodejs -e <脚本>`。脚本在 Node 里跑，页面操作走 TaskSpace / Page API。
 * 身份隔离：每个 MCP 身份（env CS_MCP_BROWSER_AGENT，默认 `mcp`）对应一个固定名字的 TaskSpace（`mcp-<身份>`），
 * 所以同一身份的多次调用落在同一个 space 里，不同身份互不抢标签页。
 *
 * ## 刻意**不**暴露的能力
 *
 * 公开 MCP 意味着任何接入的客户端都能调这些工具，所以下面几类不进：
 *  · 任意 shell / 任意 Node 代码 —— 只接受固定脚本模板，调用方输入只进页面参数。
 *  · 裸 CDP —— 等同于把浏览器底层交出去。
 *  · Cookie 导出 / 凭据读取 —— 等同于交出登录凭据。
 *
 * ## 已知差异（相对旧的 lite-browser 分组）
 *
 * - `headless` / `reuse` / `profile` / `temp` 保留在参数里以兼容旧调用，但 ego-browser 没有这些选项，传了也忽略。
 *   登录态天然就是用户在 ego lite 里已登录的网站，不需要 reuse。
 * - 元素定位用 snapshot 给出的 `@编号`，或 `text=` / `loc=` / CSS 选择器，与 ego-browser 的 Page API 一致。
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createRunner } from "../cli.js";
import { BROWSER_CLI } from "../clis.js";
import { BROWSER_AGENT_ENV, BROWSER_AGENT_ENV_LEGACY } from "../env.js";
import type { CapabilityGroup } from "../registry.js";

const runEgo = createRunner(BROWSER_CLI);

/** MCP 自己的浏览器身份（见文件头）。旧名 MUSEAV_MCP_BROWSER_AGENT 仍兼容。 */
function agent(): string {
  return (
    process.env[BROWSER_AGENT_ENV]?.trim() ||
    process.env[BROWSER_AGENT_ENV_LEGACY]?.trim() ||
    "mcp"
  );
}

/** 身份对应的 TaskSpace 名字：同一身份始终是同一个 space。 */
function spaceName(): string {
  return `mcp-${agent()}`;
}

const q = (v: string) => JSON.stringify(v);

/** 固定模板：先拿到本身份的 TaskSpace 与 p1 页面，再接具体操作。 */
function script(body: string): string {
  return [
    `const task = await taskSpace(${q(spaceName())});`,
    `const page = task.page("p1");`,
    body,
  ].join("\n");
}

async function ego(body: string, timeoutMs?: number): Promise<string> {
  return runEgo(["nodejs", "-e", script(body)], timeoutMs);
}

const text = (out: string) => ({ content: [{ type: "text" as const, text: out }] });

export function registerBrowser(server: McpServer): number {
  server.tool(
    "browser_open",
    "在本身份的 TaskSpace 里打开网页（ego lite 的 Chromium，复用用户已登录的网站）。" +
      "返回 TaskSpace 编号与页面快照。后续 snapshot / click / type / screenshot 都作用在这个页面上。" +
      "撞到登录墙、验证码时用 browser_await_human → browser_resume 走交接协议。",
    {
      url: z.string().describe("要打开的地址"),
      headless: z.boolean().optional().describe("已忽略：ego-browser 没有无头开关"),
      reuse: z.boolean().optional().describe("已忽略：ego lite 天然复用用户已登录的网站"),
      profile: z.string().optional().describe("已忽略：ego-browser 不按 profile 切换"),
      temp: z.boolean().optional().describe("已忽略"),
    },
    async (params) => {
      const out = await ego(
        `await page.goto(${q(params.url)});
console.log(JSON.stringify({ taskSpaceId: task.spaceId, page: page.label, url: await page.url() }));
console.log(await page.snapshot());`,
      );
      return text(out);
    },
  );

  server.tool(
    "browser_snapshot",
    "提取当前页面的语义快照（可交互元素带 @编号，如 @1、@2…）。click / type 的 target 直接传这个编号，比 CSS 选择器稳。",
    {},
    async () => text(await ego(`console.log(await page.snapshot());`)),
  );

  server.tool(
    "browser_click",
    "点击元素。target 优先用 browser_snapshot 给的 @编号，也接受 text= / loc= / CSS 选择器。",
    {
      target: z.string().describe("@编号（推荐，见 browser_snapshot）或选择器"),
    },
    async (params) => text(await ego(`await page.click(${q(params.target)});\nconsole.log("clicked");`)),
  );

  server.tool(
    "browser_type",
    "在输入框里填入文本（替换原有内容）。",
    {
      target: z.string().describe("@编号（推荐）或选择器"),
      text: z.string().describe("要填入的内容"),
    },
    async (params) =>
      text(await ego(`await page.fill(${q(params.target)}, ${q(params.text)});\nconsole.log("filled");`)),
  );

  server.tool(
    "browser_press",
    "在当前焦点上按下按键（Enter / Tab / Escape / Backspace 等，Playwright 键名）。",
    {
      key: z.string().describe("键名，如 Enter、Tab、Escape、Backspace"),
    },
    async (params) => text(await ego(`await page.keyboard.press(${q(params.key)});\nconsole.log("pressed");`)),
  );

  server.tool(
    "browser_scroll",
    "滚动页面（默认向下 400px）。",
    {
      direction: z.enum(["up", "down"]).optional().describe("方向，默认 down"),
      px: z.number().optional().describe("像素，默认 400"),
    },
    async (params) => {
      const dy = (params.direction === "up" ? -1 : 1) * (params.px ?? 400);
      return text(await ego(`await page.mouse.wheel(0, ${dy});\nconsole.log("scrolled");`));
    },
  );

  server.tool(
    "browser_screenshot",
    "截图当前页面，返回保存路径（默认存到 /tmp）。",
    {
      path: z.string().optional().describe("保存路径；不传则落到 /tmp"),
    },
    async (params) => {
      const p = params.path ?? `/tmp/cs-mcp-browser-${Date.now()}.png`;
      return text(await ego(`await page.screenshot({ path: ${q(p)} });\nconsole.log(${q(p)});`));
    },
  );

  server.tool(
    "browser_eval",
    "在当前页面执行 JavaScript 并返回 JSON 结果 —— 读页面正文/结构化数据只能靠它（snapshot 只给可交互元素）。作用范围是这个页面，拿不到 shell。",
    {
      code: z.string().describe("要执行的 JS 表达式，如 document.body.innerText.slice(0,2000)"),
    },
    async (params) =>
      text(await ego(`const value = await page.evaluate(${q(params.code)});\nconsole.log(JSON.stringify(value ?? null));`)),
  );

  server.tool(
    "browser_status",
    "查本身份的 TaskSpace 状态：编号、归属（agent / user）、当前页面与 URL。卡住时先看它，别猜。",
    {
      json: z.boolean().optional().describe("已忽略：输出始终是 JSON"),
    },
    async () =>
      text(
        await ego(
          `console.log(JSON.stringify({ taskSpaceId: task.spaceId, name: task.name, ownership: task.ownership, page: page.label, url: await page.url() }));`,
        ),
      ),
  );

  server.tool(
    "browser_await_human",
    "**阻塞等待人类接管并完成登录、验证码或授权**。这是交接协议的中段：撞到登录墙 → 调它（会一直等）→ 人类在 ego lite 窗口里完成 → 再 browser_resume。" +
      "⚠️ 它会占住这次工具调用直到人类完成或超时（默认 300 秒），所以要先告诉用户「请你去浏览器里完成 X」，再调它。",
    {
      timeout: z.number().optional().describe("最长等待秒数，默认 300"),
      json: z.boolean().optional().describe("已忽略：输出始终是 JSON"),
    },
    async (params) => {
      const seconds = params.timeout ?? 300;
      const out = await ego(
        `let result;
try {
  await task.waitForControl({ timeout: ${seconds * 1000} });
  result = { controlled: true, taskSpaceId: task.spaceId };
} catch (err) {
  result = { controlled: false, timeout: true, taskSpaceId: task.spaceId, reason: String(err?.message ?? err).slice(0, 200) };
}
console.log(JSON.stringify(result));`,
        (seconds + 60) * 1000,
      );
      return text(out);
    },
  );

  server.tool(
    "browser_resume",
    "人类处理完后恢复本身份的 TaskSpace 归属给 agent。交接协议的最后一步。恢复后要再查真实会话或页面，resume 本身不证明已登录。",
    {},
    async () =>
      text(
        await ego(
          `await takeOverTaskSpace(task.spaceId);\nconsole.log(JSON.stringify({ resumed: true, taskSpaceId: task.spaceId }));`,
        ),
      ),
  );

  server.tool(
    "browser_close",
    "结束本身份的 TaskSpace 并关闭它打开的页面。用完就关。",
    {},
    async () => text(await ego(`await task.finish({ keep: [] });\nconsole.log(JSON.stringify({ closed: true }));`)),
  );

  server.tool(
    "browser_sessions",
    "列出所有 TaskSpace（编号、名字、归属）。排查「浏览器被谁占着」时用；只读，不会动别人的空间。",
    {},
    async () => text(await ego(`console.log(JSON.stringify(await listTaskSpaces()));`)),
  );

  return 13;
}

export const browserGroup: CapabilityGroup = {
  id: "browser",
  title: "浏览器操控",
  project: "ego-browser",
  homepage: "https://lite.ego.app",
  summary:
    "ego lite 的 Chromium 操控：打开/快照/点击/填写/按键/滚动/截图/执行 JS，加上**人类交接协议**" +
    "（await-human → resume），以及按身份隔离的 TaskSpace。复用用户已登录的网站。" +
    "没有官方 CLI 的服务（小红书 / 微信 / X）只能这么接。",
  cli: BROWSER_CLI,
  register: registerBrowser,
};
