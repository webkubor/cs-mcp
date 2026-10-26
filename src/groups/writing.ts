/**
 * 能力分组：writing —— 表达规范与去 AI 味门禁（开源项目 writing-standard-skills）
 *
 * 三个工具，直接内嵌原生扫描引擎与平台心智规则（零外部依赖，装上即用）：
 *   lint     静态门禁：机械扫描 Markdown，拦截假人过渡词、机械排比、高中作文腔与空洞鸡汤
 *   rubric   扣分清单：拉取小红书 / Twitter(X) / Reddit / 掘金 的「说说/短动态」扣分项与反模式
 *   compose  原子拼装：基于 5D 原子矩阵（谁×在哪×场景×口吻）生成零假人味的人设提示词与开场骨架
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFileSync, existsSync } from "node:fs";
import type { CapabilityGroup } from "../registry.js";

// ── 规则库与扣分清单数据 ─────────────────────────────────────────────────────────

const LINT_RULES = [
  {
    id: "ai-cliche-transitions",
    category: "假人过渡词",
    desc: "论文腔与机械过渡词，真人交流极少使用",
    pattern: /(?:总的来说|值得一提的是|毋庸置疑|不可否认|显而易见的是|众所周知|综上所述|正如前文所述)/g,
    hint: "直接说结论，或换成口语转折词（“其实”、“说白了”、“最离谱的是”）",
  },
  {
    id: "mechanical-parallelism",
    category: "机械排比",
    desc: "对称汇报八股腔，透着浓厚的翻译与假人感",
    pattern: /(?:不仅[\u4e00-\u9fa5]{1,20}更是|既是[\u4e00-\u9fa5]{1,20}也是|既能[\u4e00-\u9fa5]{1,20}又能|不仅能够[\u4e00-\u9fa5]{1,20}还能)/g,
    hint: "拆成两句口语短句，前后带明确因果或动作转折",
  },
  {
    id: "empty-flourish",
    category: "假大空高中作文修辞",
    desc: "毫无信息量的抒情堆砌与陈词滥调",
    pattern: /(?:犹如一幅.*画卷|宛如晨曦|在这个快节奏的.*时代|历史的长河|时光荏苒|岁月如梭)/g,
    hint: "换成具体的时间、地点、环境或微观感官事实细节",
  },
  {
    id: "pr-evasiveness",
    category: "公关推诿套话",
    desc: "事故通报与客诉中的空洞八股，极度激化矛盾",
    pattern: /(?:给您带来不便敬请谅解|深刻吸取教训|举一反三|深表歉意|不便之处敬请海涵)/g,
    hint: "删掉所有套话！直接陈述补偿方案与不可绕过的物理阻断机制",
  },
  {
    id: "hollow-ending",
    category: "空洞正能量升华",
    desc: "结尾强行鸡汤升华，破坏客观事实的粗粝感",
    pattern: /(?:愿我们.*(?:岁月|光芒|前行)|砥砺前行|未来可期|让我们携手共创)/g,
    hint: "说到客观事实或留一个具体互动问题就停，绝不强行升华",
  },
];

const RUBRICS = {
  xiaohongshu: {
    platform: "📕 小红书（图文笔记 / 说说）",
    rubric: [
      { item: "说明书冷漠开头", penalty: -20, why: "用户大拇指 0.3 秒划过，缺少情绪抓手，完播率腰斩", fix: "换成大情绪叹词、翻车现场或反常识自曝（“救命！当场愣住”）" },
      { item: "图文脱节（无滑滑卡引导）", penalty: -20, why: "小红书是滑滑卡心智，不写“P1/P2看这里”导致停留时长极短", fix: "正文段落显式呼应图片编号（“P1：翻车抓包现场”、“P3：一键配置截图”）" },
      { item: "营销烂梗与 AI 翻译腔", penalty: -20, why: "滥用“绝绝子/家人们谁懂/按头安利”，缺乏真实人感", fix: "使用生活口语短句，讲自己真实踩过的坑" },
      { item: "互动门槛过高（问开放大题）", penalty: -20, why: "读者懒得长篇大论打字，互动率为零致算法停止推流", fix: "改成具象单选题（“今晚测测你的电量：A. 100% 狂欢  B. 0% 变成液体猫饼”）" },
      { item: "标签滥贴狂魔（>10 个或纯蹭泛词）", penalty: -20, why: "触发反作弊算法降权，无法推给精准画像受众", fix: "严格控制在 ≤10 个话题，前 3 个必须是垂直精准词" },
      { item: "结尾强行正能量鸡汤升华", penalty: -20, why: "破坏邻家琐碎感，透出假人营销味", fix: "说到客观事实或留单选题就停，绝不作宏大人生总结" },
    ],
  },
  twitter: {
    platform: "🐦 Twitter / X（短推 / Thread）",
    rubric: [
      { item: "长篇铺垫废话（前两行无反常识）", penalty: -20, why: "信息流极速刷动，前 50 字抓不到认知反差直接划走", fix: "两行打碎认知：第一句抛痛点，第二句给颠覆性事实或数字对比" },
      { item: "大厂公关腔与中立“我们”", penalty: -20, why: "公关腔没人看，极客圈只认独立开发者第一人称“我”的粗粝感", fix: "讲个人的偏执、踩坑与真实测试，用“我”说话" },
      { item: "主推直接挂外链", penalty: -20, why: "X 平台算法对主推内包含的外链进行断崖式限流降权", fix: "主推放对比图或视频；链接与运行命令统一放在 Thread #1 首条回复" },
      { item: "空头预告（只画饼不给交付物）", penalty: -20, why: "极客圈不为悬念买单", fix: "发推必须带直接能跑的 curl、Demo 演示或 GitHub 链接" },
      { item: "正文中夹杂堆砌 Hashtag", penalty: -20, why: "视觉噪点极重，极度拉低专业信任度", fix: "正文坚决不带 Hashtag；若要带仅在末尾留 1 个精准社区大词" },
      { item: "发完即走（Post & Ghost）", penalty: -20, why: "前 1 小时的作者互动决定推文能否进入更大推荐池", fix: "发布后 30 分钟内守在评论区回应前 3 条技术疑问" },
    ],
  },
  reddit: {
    platform: "👽 Reddit（社区发帖 / Showoff）",
    rubric: [
      { item: "浓厚的自吹推销味（Shameless Self-Promotion）", penalty: -20, why: "违反板块 10:1 自推比，被踩到折叠并永久封禁", fix: "以遇到具体倒霉问题的开发者姿态自曝，展示自用工具的顺手开源" },
      { item: "缺少开门见山的 TL;DR", penalty: -20, why: "读者时间宝贵，前两屏不交代结论直接被踩", fix: "紧随标题给出 **TL;DR:** I built X because existing tools Y failed at..." },
      { item: "藏着掖着锁门槛（加 Waitlist/强迫注册/进群）", penalty: -20, why: "社区视为割韭菜，招致毁灭性恶评", fix: "必须带直接可用的 GitHub 源码、Docker 镜像或免登录 Live Demo" },
      { item: "浓厚 AI 礼貌腔（机械寒暄）", penalty: -20, why: "100% 触发反 Bot 警报，直接切入正题", fix: "砍掉客套，直接切入问题：Hey folks, got frustrated with..." },
      { item: "无视 Subreddit 专属版规群发", penalty: -20, why: "每个版规有严格的自推窗口期，违反秒封", fix: "按目标板块定制标题，只在允许自推的日子发帖" },
      { item: "发完即走不回技术挑刺", penalty: -20, why: "Reddit 最看重 OP 在评论区和大家探讨架构优劣与 bug 回应", fix: "在评论区真诚探讨架构优劣，有 bug 当场认" },
    ],
  },
  juejin: {
    platform: "⛏️ 掘金（沸点 / 技术短手记）",
    rubric: [
      { item: "纯抄文档搬运（无实战踩坑）", penalty: -20, why: "信息增量为零，读者直接划过或评论“日经水贴”", fix: "结合真实项目中的具体场景、踩坑环境（如 Node 版本、配置细节）展开" },
      { item: "纯吐槽无解法（无病呻吟）", penalty: -20, why: "负能量水帖，拉低技术社区专业氛围", fix: "吐槽必须带自动化脚本或解法：“被需求改崩了，怒写了个自动化脚本搞定……”" },
      { item: "提问或分享缺乏上下文与复现", penalty: -20, why: "无法定位问题，大概率沉帖", fix: "附带三件套：运行环境版本 + 最小复现代码 + 完整终端文本堆栈" },
      { item: "公众号/微信群硬引流", penalty: -20, why: "社区规则严打硬引流，会被反作弊系统禁言", fix: "源码直接贴 GitHub 链接或掘金代码片段（JCode），不搞暗号套路" },
      { item: "AI 答案机械甩评", penalty: -20, why: "教科书般“首先、其次、综上所述”，读者一眼识破", fix: "用个人经验口吻切入：“我也踩过这个坑，排查下来是……”" },
      { item: "浮夸标题党", penalty: -20, why: "点进去是基础语法，引起反感与负评", fix: "诚实命名：“聊聊平时容易忽略的几个 CSS 细节及避坑指南”" },
    ],
  },
};

// ── 核心工具注册 ─────────────────────────────────────────────────────────────

export function registerWriting(server: McpServer): number {
  server.tool(
    "writing_lint",
    "静态扫描 Markdown 文本或文件，机械拦截假人过渡词（总的来说/毋庸置疑）、机械排比（不仅...更是...）、" +
      "高中作文腔（犹如一幅画卷/宛如晨曦）与空洞正能量结尾。返回违规行号与修改建议。零外部依赖。",
    {
      text: z.string().optional().describe("要检查的 Markdown 文本内容（text 与 path 二选一）"),
      path: z.string().optional().describe("要检查的本地 Markdown 文件绝对路径（text 与 path 二选一）"),
    },
    async (params) => {
      let content = params.text;
      if (!content && params.path) {
        if (!existsSync(params.path)) {
          return { content: [{ type: "text", text: `❌ 文件不存在: ${params.path}` }] };
        }
        content = readFileSync(params.path, "utf8");
      }
      if (!content) {
        return { content: [{ type: "text", text: "❌ 必须提供 text 或 path 参数之一" }] };
      }

      const lines = content.split("\n");
      const violations: Array<{ line: number; category: string; matched: string; hint: string }> = [];
      let inCodeBlock = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
          inCodeBlock = !inCodeBlock;
          continue;
        }
        if (inCodeBlock) continue;
        if (trimmed.startsWith("❌") || trimmed.includes("Anti-pattern")) continue;

        for (const rule of LINT_RULES) {
          rule.pattern.lastIndex = 0;
          let match: RegExpExecArray | null;
          while ((match = rule.pattern.exec(line)) !== null) {
            // 忽略反引号内部的词
            const before = line.slice(0, match.index);
            const after = line.slice(match.index + match[0].length);
            const qBefore = (before.match(/`/g) || []).length;
            const qAfter = (after.match(/`/g) || []).length;
            if (qBefore % 2 === 1 && qAfter % 2 === 1) continue;

            violations.push({
              line: i + 1,
              category: rule.category,
              matched: match[0],
              hint: rule.hint,
            });
          }
        }
      }

      if (violations.length === 0) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ clean: true, message: "✅ 门禁通过！未检测到假人味或违规排比表达。" }, null, 2),
          }],
        };
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            clean: false,
            violationCount: violations.length,
            message: `❌ 检测到 ${violations.length} 处假人味与违规表达，请整改`,
            violations,
          }, null, 2),
        }],
      };
    },
  );

  server.tool(
    "writing_rubric",
    "获取指定平台（小红书 / Twitter / Reddit / 掘金）的说说型发帖扣分清单（Rubric）与致命反模式。" +
      "发布前逐条对照，每项扣 20 分，低于 80 分不得发布。",
    {
      platform: z.enum(["xiaohongshu", "twitter", "reddit", "juejin", "all"]).describe(
        "目标平台：xiaohongshu(小红书) | twitter(X) | reddit | juejin(掘金) | all(全部平台)",
      ),
    },
    async (params) => {
      if (params.platform === "all") {
        return { content: [{ type: "text", text: JSON.stringify(RUBRICS, null, 2) }] };
      }
      const data = RUBRICS[params.platform];
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "writing_compose",
    "基于 5D 原子表达组合矩阵（谁×在哪×为什么说×口吻），生成高信噪比、零 AI 假人味的提示词约束或内容骨架。",
    {
      persona: z.string().describe("角色原型：极客开发者(P1) / 生活观察者(P2) / 美学创作者(P3) / 开源协作者(P4) / 服务接待人(P5) / 架构师(P6)"),
      platform: z.string().describe("发布场域：网易云(M1) / 小红书(M2) / Twitter(M3) / GitHub(M4) / 公众号(M5) / Reddit(M6) / 掘金(M7)"),
      scenario: z.string().describe("场景意图：新工具发布(S1) / 客诉承接(S2) / 日常琐碎(S3) / 技术复盘(S4) / 事故通报(S6) / 架构RFC(S7) / 对上汇报(S8)"),
      tone: z.string().optional().describe("口吻调性：粗粝真实(T1) / 克制留白(T2) / 热烈唠嗑(T3) / 严谨平视(T4)，默认粗粝真实"),
      topic: z.string().describe("要表达的核心事实、成果或问题背景"),
    },
    async (params) => {
      const tone = params.tone || "粗粝真实（第一人称自曝，拒绝空洞鸡汤，事实说话）";
      const result = {
        matrix: {
          persona: params.persona,
          platform: params.platform,
          scenario: params.scenario,
          tone,
          topic: params.topic,
        },
        constraints: [
          "1. 绝不使用‘总的来说’、‘值得一提的是’、‘毋庸置疑’等论文腔过渡词；",
          "2. 绝不使用对称排比（‘不仅……更是……’），拆成带转折的生活短句；",
          "3. 严禁结尾强行正能量升华（‘愿我们都在岁月中发光’），说到客观事实就停；",
          "4. 契合目标平台受众心智与扣分红线（见 writing_rubric）；",
          "5. 结论先行，第一屏直击痛点与交付物。",
        ],
        skeletonGuide: `在 ${params.platform} 针对 ${params.topic} 创作时，以 ${params.persona} 的身份，采用 ${tone} 口吻。切入点务必从自身真实翻车或痛点展开，不卖弄关子，直接给出交付事实。`,
      };
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  return 3;
}

export const writingGroup: CapabilityGroup = {
  id: "writing",
  title: "表达规范与去 AI 味门禁",
  project: "writing-standard-skills",
  homepage: "https://github.com/webkubor/writing-standard-skills",
  summary: "静态检查去 AI 味、多平台说说扣分清单与 5D 原子矩阵人设合成（零外部依赖，装上即用）",
  register: registerWriting,
};
