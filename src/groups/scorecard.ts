/**
 * 能力分组：scorecard —— 开源项目成熟度与品牌质检（开源项目 scorecard）
 *
 * 三个工具，对应 CLI 的主要审计路径：
 *   audit    单目标审计：GitHub 仓库 / npm 包 / 网页可用性（9 维度质量与证据链）
 *   compare  双目标对比：对比两个环境或两个版本（A/B 测试或灰度对比）
 *   geo      品牌 GEO 审计：检测品牌在 AI 问答（ChatGPT/Claude 等）中的提及率与心智份额
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createRunner } from "../cli.js";
import { SCORECARD_CLI } from "../clis.js";
import type { CapabilityGroup } from "../registry.js";

const runScorecard = createRunner(SCORECARD_CLI);

export function registerScorecard(server: McpServer): number {
  server.tool(
    "scorecard_audit",
    "9 维度开源项目成熟度与合规质检：支持 GitHub 仓库、npm 包、或在线网页。" +
      "对齐 NIST SSDF、OpenSSF 等工程质量基线，输出逐项指标证据与整改清单。" +
      "默认输出结构化 JSON，方便 Agent 下钻与决策；也可选 markdown 报告格式。",
    {
      target: z.string().describe("审计目标：GitHub 仓库名（如 webkubor/reel-kit）、npm 包名（如 react）、或网页 URL"),
      type: z.enum(["github", "npm", "page"]).optional().describe("目标类型：github | npm | page；不传时自动根据 target 形状推断"),
      format: z.enum(["json", "markdown"]).optional().describe("输出格式：json（默认，Agent 结构化解析用）| markdown（人类长篇报告用）"),
      minScore: z.number().min(0).max(10).optional().describe("质量门禁分数底线（0~10 分），低于该分将标注未达标"),
      fresh: z.boolean().optional().describe("true=强制跳过 30 分钟缓存并重新审计（刚刚合入修复时必传，避免命中旧分）"),
      api: z.string().optional().describe("自建 Scorecard 服务端地址；不传使用官方默认服务"),
    },
    async (params) => {
      const args = [params.target];
      if (params.type) args.push("--type", params.type);
      if (params.format === "markdown") {
        args.push("--md");
      } else {
        args.push("--json");
      }
      if (params.minScore !== undefined) args.push("--min", String(params.minScore));
      if (params.fresh) args.push("--fresh");
      if (params.api) args.push("--api", params.api);

      const out = await runScorecard(args, 180_000, 8000);
      return { content: [{ type: "text", text: out }] };
    },
  );

  server.tool(
    "scorecard_compare",
    "对比两个目标的成熟度与指标差异（如对比测试环境与生产环境、或对比两个同类开源项目）。" +
      "输入目标类型必须一致。返回逐项指标的增减比对。",
    {
      targetA: z.string().describe("基准目标 A（如测试环境 URL、或前代项目）"),
      targetB: z.string().describe("对照目标 B（如生产环境 URL、或当前项目）"),
      type: z.enum(["github", "npm", "page"]).describe("目标类型：github | npm | page（两边必须一致）"),
      format: z.enum(["json", "markdown"]).optional().describe("输出格式：json（默认）| markdown"),
    },
    async (params) => {
      const args = [
        "--compare-a", params.targetA,
        "--compare-b", params.targetB,
        "--type", params.type,
      ];
      if (params.format === "markdown") {
        args.push("--md");
      } else {
        args.push("--json");
      }

      const out = await runScorecard(args, 180_000, 8000);
      return { content: [{ type: "text", text: out }] };
    },
  );

  server.tool(
    "scorecard_geo",
    "品牌 GEO 审计：检测品牌在 AI 搜索引擎与主流 LLM 问答中的心智份额与可见度。" +
      "通过输入核心品类问题，审计 AI 模型回答中对该品牌的提及频率、推荐位次与外链引用率。" +
      "注意：本工具每次执行均调用真实模型查询，耗时相对较长。",
    {
      brand: z.string().describe("品牌名（必填，如 museav）"),
      queries: z.array(z.string()).min(1).describe("用户在 AI 问答里常问的品类问题列表（如 ['有哪些好用的 AI 视频生成工具']）"),
      domain: z.string().optional().describe("品牌自有域名，用来判定 AI 回答中的引用链接（如 museav.com）"),
      competitors: z.array(z.string()).optional().describe("竞品品牌列表，用于量化品类内的市场份额对比"),
      provider: z.enum(["openai", "anthropic", "gemini", "perplexity", "offline"]).optional().describe("调用的模型厂商渠道，默认自动选择"),
    },
    async (params) => {
      const args = ["geo", "--brand", params.brand];
      for (const q of params.queries) {
        args.push("--q", q);
      }
      if (params.domain) args.push("--domain", params.domain);
      if (params.competitors && params.competitors.length > 0) {
        args.push("--competitors", params.competitors.join(","));
      }
      if (params.provider) args.push("--provider", params.provider);
      args.push("--json");

      const out = await runScorecard(args, 300_000, 8000);
      return { content: [{ type: "text", text: out }] };
    },
  );

  return 3;
}

export const scorecardGroup: CapabilityGroup = {
  id: "scorecard",
  title: "开源成熟度与品牌质检",
  project: "scorecard",
  homepage: "https://github.com/webkubor/scorecard",
  summary: "GitHub 仓库 / npm 包 / 网页可用性 9 维度工程质检与 AI GEO 品牌可见度审计",
  cli: SCORECARD_CLI,
  register: registerScorecard,
};
