// 简单 MCP 协议测试客户端：spawn server，写入 initialize/tools/list，读取响应
//
// 断言的都是「人不会记得」的那类事：
//
// ① **每个工具名都必须以它所属分组的 id 开头**（`museav_*` / `vlm_*` / …），
//    唯一的例外是 `groups_list`。这条是 3.0.0 立下的命名规范 —— 加一组新能力时，
//    名字对不上会在 CI 就红，而不是等 agent 在工具列表里挑花眼。
//    前缀集合直接从 registry 的 GROUPS 推导，新增分组不用改这个文件。
//
// ② **工具总数与 README 一致。** 加了工具忘了改文档，在 CI 里变红，而不是等人发现。
//
// ③ **3.0.0 的旧变量名仍然生效。** 改名那次的真实失效模式不是报错，是**静默回落**
//    （见 src/env.ts）：变量被忽略 → 开关值空 → 悄悄退回「装了 CLI 才启用」，
//    连告警都不触发。所以兼容路径必须被测，不能靠人记得。
//
// 用 CS_MCP_GROUPS=all 起 server：CI 机器上什么 CLI 都没装，
// 走默认的探测策略会一个分组都不启用，那就测不到工具集本身了。
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const EXPECTED_TOOL_COUNT = 49;   // museav 17 + vlm 4 + contrast 3 + facet 2 + reel 3 + browser 13 + scorecard 3 + writing 3 + groups_list

// 3.0.0 之前的 17 个无前缀 museav 工具名。这些名字**不是**老用户的契约了 ——
// museav-mcp 已于 2026-10-05 从 npm 撤下、从未面向外部发布过，没有下游要保护。
// 留着这份名单只为把「老名字不许复活」钉死：它们一复活，就说明有人从旧
// 文件/旧分支搬代码过来只搬了一半前缀。
const UNPREFIXED_MUSEAV = [
  "gen_background", "remove_bg", "upscale_image", "remove_watermark", "compress_image",
  "list_templates", "list_skills", "list_jobs", "upload_asset", "image_to_template",
  "reverse", "list_models", "balance", "list_video_templates",
  "skillhub_tags", "skillhub_whoami", "skillhub_publish",
];

const META_TOOL = "groups_list";   // 发现面，不属于任何分组，唯一无前缀的例外

// 版本守卫的语义比较必须按数字逐段比。字符串比的话 "3.10.0" < "3.6.0"，
// 真出到 3.10 时会把新版本判成过旧、把所有工具锁死 —— 而那时离现在还很远，
// 没有断言的话没人会想起来。
{
  const { semverLt } = await import("./dist/semver.js");
  const cases = [
    ["3.5.0", "3.6.0", true],    // 旧版要拦
    ["3.6.0", "3.6.0", false],   // 相等放行
    ["3.6.1", "3.6.0", false],   // 新版放行
    ["3.10.0", "3.6.0", false],  // ← 字符串比会在这里错
    ["4.0.0", "3.6.0", false],
    ["2.9.9", "3.6.0", true],
  ];
  for (const [a, b, want] of cases) {
    if (semverLt(a, b) !== want) {
      console.error(`SEMVER_FAIL semverLt("${a}","${b}") 期望 ${want}`);
      process.exit(1);
    }
  }
  console.log(`SEMVER_OK ${cases.length} 条`);
}

// facet 的模板清单是从 CLI 报错里取的（它没有 list 命令）。这段解析踩过一次坑：
// Node 打栈时会**先打出错那一行的源码**，而那行里也写着 `Available: ${...}`，
// 于是「清单」变成了两段模板字面量垃圾 —— 而 MCP 会把它当模板名交给 agent。
// 没有这组断言，下次 Node 改栈格式还是同一个结果。
{
  const { parseAvailableTemplates } = await import("./dist/parse.js");
  // 真实形状：源码行在前，真正的 Error 行在后（2026-10-02 从 facet 实测抄下来的）
  const realCrash = [
    "file:///x/dist/args.js:41",
    '    throw new Error(`Unknown template "${value}". Available: ${templateNames.join(", ")}`);',
    "          ^",
    "",
    'Error: Unknown template "__list_templates__". Available: warm-handbook, resume-design-folio, talk',
    "    at toTemplateName (file:///x/dist/args.js:41:11)",
  ].join("\n");
  const got = parseAvailableTemplates(realCrash);
  const want = ["warm-handbook", "resume-design-folio", "talk"];
  if (JSON.stringify(got) !== JSON.stringify(want)) {
    console.error(`PARSE_FAIL 真实栈形状解析错：拿到 ${JSON.stringify(got)}`);
    process.exit(1);
  }
  if (parseAvailableTemplates("file:///x\n  throw new Error(`Available: ${a.join(', ')}`)\n  ^") !== null) {
    console.error("PARSE_FAIL 只有源码行时应当返回 null（不能把模板字面量当清单）");
    process.exit(1);
  }
  if (parseAvailableTemplates("完全没有可用信息") !== null) {
    console.error("PARSE_FAIL 认不出时应当返回 null，交给调用方把原话透出来");
    process.exit(1);
  }
  console.log("PARSE_OK facet 模板清单解析 3 条（含真实栈形状）");
}

// 分组选择逻辑也要测：CI 里没有 CLI，默认策略的判据就是「探测到才启用」，
// 一旦哪天写成「永远全开」，工具 schema 的 token 成本会静默翻几倍。
{
  const { selectGroups, GROUPS } = await import("./dist/registry.js");
  const all = selectGroups("all");
  if (all.enabled.length !== GROUPS.length) {
    console.error(`GROUP_FAIL all 应当启用全部 ${GROUPS.length} 组，实际 ${all.enabled.length}`);
    process.exit(1);
  }
  const only = selectGroups("facet,contrast");
  const ids = only.enabled.map((g) => g.id).join(",");
  if (ids !== "contrast,facet") {
    console.error(`GROUP_FAIL 白名单应当只启用 contrast,facet，实际 ${ids}`);
    process.exit(1);
  }
  const minus = selectGroups("-museav,-vlm");
  if (minus.enabled.some((g) => g.id === "museav" || g.id === "vlm")) {
    console.error("GROUP_FAIL -museav,-vlm 没被排除掉");
    process.exit(1);
  }
  const typo = selectGroups("museav,vm1");
  if (typo.unknown.join(",") !== "vm1") {
    console.error(`GROUP_FAIL 拼错的 id 应当被报出来，实际 ${JSON.stringify(typo.unknown)}`);
    process.exit(1);
  }
  console.log(`GROUP_OK ${GROUPS.length} 组；白名单/排除/拼错三条都通过`);
}

// 改名那天的兼容路径：新名优先、旧名兜底、都设且不同时新名赢且标出冲突。
// 纯函数，直接喂假 env —— 不必真 spawn 两个 server 才知道结果。
{
  const { resolveGroupsSpec, GROUPS_ENV, GROUPS_ENV_LEGACY } = await import("./dist/env.js");
  const cases = [
    [{ [GROUPS_ENV]: "all" }, { spec: "all", source: "current", conflict: false }, "只用新名"],
    [{ [GROUPS_ENV_LEGACY]: "all" }, { spec: "all", source: "legacy", conflict: false }, "只用旧名要兜底"],
    [{ [GROUPS_ENV]: "facet", [GROUPS_ENV_LEGACY]: "all" },
      { spec: "facet", source: "current", conflict: true }, "冲突时新名赢且要报"],
    [{ [GROUPS_ENV]: "all", [GROUPS_ENV_LEGACY]: "all" },
      { spec: "all", source: "current", conflict: false }, "两个都是 all 不算冲突"],
    [{}, { spec: undefined, source: "default", conflict: false }, "都没设走探测式默认"],
    [{ [GROUPS_ENV]: "", [GROUPS_ENV_LEGACY]: "all" },
      { spec: "", source: "current", conflict: true }, "新名置空是显式回默认，算冲突"],
  ];
  for (const [env, want, why] of cases) {
    const got = resolveGroupsSpec(env);
    const ok = got.spec === want.spec && got.source === want.source && got.conflict === want.conflict;
    if (!ok) {
      console.error(`ENV_FAIL ${why}：期望 ${JSON.stringify(want)}，实际 ${JSON.stringify(got)}`);
      process.exit(1);
    }
  }
  console.log(`ENV_OK ${GROUPS_ENV} / 旧名兜底 / 冲突取舍 ${cases.length} 条`);
}

// 起一个 server，跑一轮 initialize + tools/list。
//
// CS_MCP_BIN=<path> 时起二进制而不是 node dist/index.js ——
// 单文件二进制是**主分发形态**，它必须过同一套协议冒烟：
// JSON-RPC 握手、initialize 应答、tools/list 列出工具，一个都不能少。
// 「node 那条能跑、二进制那条没跑过」等于二进制没被验过。
const BIN = process.env.CS_MCP_BIN;
function listTools(env) {
  return new Promise((resolve, reject) => {
    const child = BIN
      ? spawn(BIN, [], { cwd: dirname(fileURLToPath(import.meta.url)), env, stdio: ["pipe", "pipe", "inherit"] })
      : spawn("node", ["dist/index.js"], {
          cwd: dirname(fileURLToPath(import.meta.url)),
          env,
          stdio: ["pipe", "pipe", "inherit"],
        });
    const rl = createInterface({ input: child.stdout });
    const bail = setTimeout(() => {
      child.kill();
      reject(new Error("tools/list 超时"));
    }, 8000);
    rl.on("line", (line) => {
      let msg;
      try { msg = JSON.parse(line); } catch { return; }
      if (!msg.result || !msg.result.tools) return;
      clearTimeout(bail);
      const names = msg.result.tools.map((t) => t.name);
      child.kill();
      rl.close();
      resolve(names);
    });
    const send = (method, params) =>
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }) + "\n");
    send("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0" },
    });
    setTimeout(() => send("notifications/initialized", {}), 300);
    setTimeout(() => send("tools/list", {}), 600);
  });
}

/** 造一份干净 env：只留指定的那一个开关变量，避免继承到宿主机的设置造成假绿/假红。 */
function envWith(vars) {
  const env = { ...process.env };
  for (const k of Object.keys(env)) {
    if (k === "CS_MCP_GROUPS" || k === "MUSEAV_MCP_GROUPS") delete env[k];
  }
  return { ...env, ...vars };
}

const { GROUPS } = await import("./dist/registry.js");
const prefixRe = new RegExp(`^(${GROUPS.map((g) => g.id).join("|")})_`);

const names = await listTools(envWith({ CS_MCP_GROUPS: "all" }));
console.log("TOOLS_LIST_OK count =", names.length);
for (const n of names) console.log("  -", n);

if (names.length !== EXPECTED_TOOL_COUNT) {
  console.error(
    `TOOLS_LIST_MISMATCH 期望 ${EXPECTED_TOOL_COUNT} 个，实际 ${names.length} 个 —— ` +
    `改了工具就同步改这个常量，以及 README 里写的数字`,
  );
  process.exit(1);
}

if (!names.includes(META_TOOL)) {
  console.error(`TOOLS_LIST_MISSING ${META_TOOL} 不见了 —— 它是唯一的发现面，永远注册`);
  process.exit(1);
}

// ① 命名规范：除 groups_list 外，每个工具名都得落在某个分组前缀下。
const unprefixed = names.filter((n) => n !== META_TOOL && !prefixRe.test(n));
if (unprefixed.length > 0) {
  console.error(
    `TOOL_NAME_FAIL ${unprefixed.length} 个工具名没带分组前缀：${unprefixed.join(", ")} —— ` +
    `约定是 <分组id>_<动作>，前缀取自 registry 的 GROUPS（${GROUPS.map((g) => g.id).join("/")}）`,
  );
  process.exit(1);
}
console.log(`NAME_OK ${names.length - 1} 个工具全部以所属分组 id 开头（${META_TOOL} 除外）`);

// 3.0.0 之前那 17 个无前缀名字不许复活
const revived = UNPREFIXED_MUSEAV.filter((t) => names.includes(t));
if (revived.length > 0) {
  console.error(
    `UNPREFIXED_REVIVED 无前缀的旧工具名回来了 ${revived.length} 个：${revived.join(", ")} —— ` +
    `3.0.0 起它们统一叫 museav_*；旧名没下游契约保护（包已 unpublish），留着只会让 agent 挑到两个同名入口`,
  );
  process.exit(1);
}
console.log(`UNPREFIXED_OK ${UNPREFIXED_MUSEAV.length} 个旧名均未复活`);

// 每个分组都得真的长出工具来（分组注册函数忘了调、或工具名前缀写错分组，都会被这条抓住）
for (const g of GROUPS) {
  const n = names.filter((x) => x.startsWith(`${g.id}_`)).length;
  if (n === 0) {
    console.error(`GROUP_EMPTY ${g.id} 一个工具都没长出来 —— 检查它 register() 与工具名前缀`);
    process.exit(1);
  }
}

// ③ 旧变量名仍生效：同一份工具集，一个工具都不能少。
// 这是改名那步唯一会「静默降级」而不报错的地方，所以真起一次 server 验。
const legacyNames = await listTools(envWith({ MUSEAV_MCP_GROUPS: "all" }));
const lostViaLegacy = names.filter((n) => !legacyNames.includes(n));
if (lostViaLegacy.length > 0 || legacyNames.length !== names.length) {
  console.error(
    `LEGACY_ENV_MISMATCH 用旧名 MUSEAV_MCP_GROUPS=all 起，工具集变了：` +
    `少了 ${lostViaLegacy.length} 个（${lostViaLegacy.slice(0, 5).join(", ")}…），` +
    `数量 ${names.length} → ${legacyNames.length}。旧名必须与新名等价 —— ` +
    `否则设了旧变量的人会静默退回探测式，连告警都没有`,
  );
  process.exit(1);
}
console.log(`LEGACY_ENV_OK 旧变量名起出同一份 ${legacyNames.length} 个工具`);

console.log("ALL_OK");
process.exit(0);
