/**
 * 版本号 —— 真源是 package.json，本文件是它的编译期副本。
 *
 * ## 为什么不是运行时读 package.json
 *
 * cs-mcp 的分发形态是**一个自包含二进制 + 一条安装命令**（用户机器上不需要
 * Node，也不需要 npm）。编译产物里 import.meta.url 指向虚拟的 $bunfs 根目录，
 * 运行时读 ../package.json 必然 ENOENT —— server 直接起不来（实测过）。
 *
 * ## 为什么不是编译期 --define 注入
 *
 * 试过 bun build --define（1.4.0）：对普通标识符、对 process.env.* 成员表达式，
 * 注入全部静默失效，版本号会退化成 0.0.0 —— 比报错更难查。
 *
 * ## 那怎么保证不漂
 *
 * scripts/build-binary.mjs 在编译前断言本文件与 package.json 一致，不一致直接
 * 失败；发版门禁（scripts/version-sync-gate.mjs）也管版本 → 文档的同步。
 * 真源永远是 package.json，这里只是它的编译期快照。
 */
export const VERSION = "3.2.0";
