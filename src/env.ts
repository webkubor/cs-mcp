/**
 * 环境变量真源 —— 单独一个叶子模块，因为它们被三处读：
 * registry.ts（分组开关）、groups/browser.ts（浏览器身份）、index.ts（启动告警）。
 *
 * 放在这里而不是 registry.ts 里，是为了断掉 browser.ts → registry.ts 的
 * **运行时循环依赖**：registry.ts 要 import browserGroup，browser.ts 又要
 * import 类型。现在 browser.ts 那个 import 是 `import type`（编译期擦除），
 * 一旦改成要取值，就是真环。叶子模块没有这个问题。
 */

/** 分组开关：逗号分隔分组 id，支持 `-id` 排除、`all` 全开 */
export const GROUPS_ENV = "CS_MCP_GROUPS";

/**
 * 3.0.0 之前的旧变量名。**保留可读**，但不再是首选。
 *
 * 为什么必须留：变量名改名最危险的失效模式不是报错，是**静默回落**。
 * 旧变量被忽略 → 开关值变成空串 → `selectGroups` 判定 `byDefault = true`
 * → 回落成「装了 CLI 才启用」的探测式。原来写 `MUSEAV_MCP_GROUPS=all` 的人，
 * 那些本机没装 CLI 而被强开的分组会悄悄消失；写 `-museav` 的人，排除会
 * 悄悄失效 —— 而且此时 include/exclude 都空，连「不认识的 id」告警都不触发，
 * 全程零可见信号。所以旧名必须继续兜底，并明确告诉用户在迁。
 */
export const GROUPS_ENV_LEGACY = "MUSEAV_MCP_GROUPS";

/** MCP 驱动浏览器时的 lite-browser 身份（会话按 agent 隔离，见 groups/browser.ts） */
export const BROWSER_AGENT_ENV = "CS_MCP_BROWSER_AGENT";
export const BROWSER_AGENT_ENV_LEGACY = "MUSEAV_MCP_BROWSER_AGENT";

export interface GroupsSpec {
  /** 最终生效的开关值；两个变量都没设 = undefined（走探测式默认） */
  spec: string | undefined;
  /** 这个值是从哪个变量名读来的 */
  source: "current" | "legacy" | "default";
  /** 两个变量都设了且值不同 —— 以新名为准，这个标记出来让人自己收敛 */
  conflict: boolean;
}

/**
 * 读分组开关：新名优先，旧名兜底。
 *
 * 改名路上唯一**不能省**的一步（理由见 GROUPS_ENV_LEGACY）。冲突时不猜：
 * 按新名走，并报出来让人自己决定留哪个。
 */
export function resolveGroupsSpec(env: NodeJS.ProcessEnv = process.env): GroupsSpec {
  const cur = env[GROUPS_ENV];
  const legacy = env[GROUPS_ENV_LEGACY];
  const hasCur = cur !== undefined;
  const hasLegacy = legacy !== undefined;
  return {
    spec: hasCur ? cur : hasLegacy ? legacy : undefined,
    source: hasCur ? "current" : hasLegacy ? "legacy" : "default",
    // 只有「新名非空且与旧名不同」才算冲突：CS_MCP_GROUPS="" 是显式回到
    // 探测式默认，与旧名写着 all 是两回事，不该被当成一致。
    conflict: hasCur && hasLegacy && cur !== legacy,
  };
}
