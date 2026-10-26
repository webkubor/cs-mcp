#!/usr/bin/env node
/**
 * build-binary —— 把 cs-mcp 编译成**单文件自包含可执行文件**。
 *
 * ## 为什么不用 npm 分发
 *
 * cs-mcp 是「总网关」：底下包着 museav-cli、mlx-vlm-kit、contrast-guard、facet、
 * reel-kit、lite-browser 一堆东西，用户已经要为装全套付 6 种安装方式的代价
 * （npm / pipx / brew / curl）。如果网关自己还要 `npm i -g` 或 `npx -y`，
 * 等于在最前面再加一道 Node + npm + registry 网络的门槛——而它本该是
 * **把门槛降到一条命令**的那一层。多数用户会卡在起手第一步。
 *
 * 所以分发形态定为：一个二进制 + 一条安装命令（install.sh 拉 GitHub Release
 * 的产物），用户机器上不需要 Node，也不需要 npm。
 *
 * ## 为什么用 bun 而不是 node --experimental-sea
 *
 *   · SEA 要 postject 改二进制，步骤多且脆；
 *   · bun build --compile 直接产出自包含可执行文件（含 runtime），跨平台目标
 *     一条命令就能出（--target=bun-windows-x64 等），CI 里矩阵化很省事；
 *   · 代价是产物体积大（~60MB，含 runtime）——对一个「装一次、用很久」的
 *     工具链网关，这个体积换掉一整条安装链路是划算的。
 *
 * ## 版本号为什么在编译期钉进去
 *
 * 编译产物里 import.meta.url 指向虚拟的 $bunfs 根目录，运行时读不到
 * ../package.json（ENOENT，server 直接起不来）。所以版本用 --define 注进去，
 * 运行时零文件依赖。
 *
 * 用法：
 *   node scripts/build-binary.mjs                     # 当前平台 → dist/cs-mcp
 *   node scripts/build-binary.mjs --target=bun-linux-x64 --out=dist/cs-mcp-linux-x64
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);

const target = typeof args.target === "string" ? args.target : "";
const outName = typeof args.out === "string"
  ? args.out
  : target
    ? `cs-mcp-${target.replace(/^bun-/, "")}`
    : "cs-mcp";
const outPath = join(ROOT, "dist", outName);

if (!existsSync(join(ROOT, "node_modules"))) {
  console.error("✘ 依赖没装 —— 先 pnpm install");
  process.exit(1);
}
mkdirSync(dirname(outPath), { recursive: true });

// 版本快照必须与 package.json 一致 —— src/version.ts 是编译期副本，漂了就说明
// 有人改了版本没同步。宁可在这里失败，也不要编出一个自称旧版的 server。
const versionSrc = readFileSync(join(ROOT, "src", "version.ts"), "utf8");
const snap = /export const VERSION\s*=\s*"([^"]+)"/.exec(versionSrc)?.[1];
if (snap !== pkg.version) {
  console.error(`✘ src/version.ts 是 ${snap}，package.json 是 ${pkg.version} —— 先同步（真源是 package.json）`);
  process.exit(1);
}

const bunArgs = [
  "build",
  "--compile",
  ...(target ? [`--target=${target}`] : []),
  "--outfile",
  outPath,
  join(ROOT, "src", "index.ts"),
];

console.log(`→ bun ${bunArgs.join(" ")}`);
execFileSync("bun", bunArgs, { stdio: "inherit" });
console.log(`✓ ${outPath}（version ${pkg.version}）`);
