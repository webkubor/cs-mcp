#!/usr/bin/env bash
# cs-mcp 安装脚本 —— 一条命令，把网关装到本机。
#
#   curl -fsSL https://raw.githubusercontent.com/webkubor/cs-mcp/main/install.sh | bash
#
# ## 为什么是这个形态
#
# cs-mcp 是「总网关」：底下包着 museav-cli、mlx-vlm-kit、contrast-guard、facet、
# reel-kit、lite-browser 一堆东西。用户为了用上全套能力，已经要付 6 种安装方式的
# 代价（npm / pipx / brew / curl）。如果网关自己还得 `npm i -g` 或 `npx -y`，
# 等于在最前面再加一道 Node + npm + registry 网络的门槛 —— 而它本该是
# **把门槛降到一条命令**的那一层。多数用户会卡在起手第一步。
#
# 所以：编译成单文件自包含二进制（内含 runtime），用户机器上什么都不用装。
# 装完直接 `cs-mcp --version` 自证装对了。
#
# ## 覆盖范围
#
#   macOS (arm64 / x64) · Linux (x64 / arm64)
#   Windows 走 PowerShell 那条（在 README 里），本脚本只管类 Unix。
set -euo pipefail

REPO="webkubor/cs-mcp"
BIN_NAME="cs-mcp"
INSTALL_DIR="${CS_MCP_INSTALL_DIR:-$HOME/.local/bin}"

say() { printf '%s\n' "$*"; }
die() { printf '✘ %s\n' "$*" >&2; exit 1; }

# ── 认平台 ────────────────────────────────────────────────────────────────
os="$(uname -s)"
case "$os" in
  Darwin) os_name="darwin" ;;
  Linux)  os_name="linux" ;;
  *) die "不支持的系统：$os。Windows 请看 README 里的 PowerShell 那条，或从源码跑。" ;;
esac

arch="$(uname -m)"
case "$arch" in
  arm64|aarch64) arch_name="arm64" ;;
  x86_64|amd64)  arch_name="x64" ;;
  *) die "不支持的 CPU 架构：$arch" ;;
esac

asset="${BIN_NAME}-${os_name}-${arch_name}"
url="https://github.com/${REPO}/releases/latest/download/${asset}"

say "→ ${os_name}/${arch_name} · 装到 ${INSTALL_DIR}"

# ── 下载 ──────────────────────────────────────────────────────────────────
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$url" -o "$tmp/$BIN_NAME" || die "下载失败：$url
    （可能这个平台还没有构建产物 —— 去 Releases 页看看有哪些，
      或按 README 的「从源码起」跑：git clone + pnpm install && pnpm build）"
elif command -v wget >/dev/null 2>&1; then
  wget -qO "$tmp/$BIN_NAME" "$url" || die "下载失败：$url"
else
  die "既没有 curl 也没有 wget，下载不了"
fi

chmod +x "$tmp/$BIN_NAME"

# ── 自证装对了 ────────────────────────────────────────────────────────────
# 装完必须能报出版本号。报不出来就不装 —— 一个跑不起来的网关留在 PATH 上，
# 比没装更坏：客户端会起进程、握手失败、报一句看不懂的错。
got_version="$("$tmp/$BIN_NAME" --version 2>/dev/null || true)"
[ -n "$got_version" ] || die "装下来的二进制跑不起来（--version 没输出）—— 先别让它进 PATH"

# ── 就位 ──────────────────────────────────────────────────────────────────
mkdir -p "$INSTALL_DIR"
target="${INSTALL_DIR}/${BIN_NAME}"
# 正在被跑着就换不掉：先删旧的（macOS/Linux 允许删掉正在执行的文件）
rm -f "$target" 2>/dev/null || true
mv "$tmp/$BIN_NAME" "$target"

say "✓ 已安装 ${target}（版本 ${got_version}）"

case ":${PATH}:" in
  *":${INSTALL_DIR}:"*) ;;
  *) say ""
     say "⚠️ ${INSTALL_DIR} 不在 PATH 里。接进 MCP 客户端要用绝对路径，或者把它加进 PATH："
     say ""
     say "    # ~/.zshrc 或 ~/.bashrc"
     say "    export PATH=\"${INSTALL_DIR}:\$PATH\""
     say "" ;;
esac

say ""
say "接下来，把它接进你的 MCP 客户端："
say ""
say "    claude mcp add cs -- ${target}"
say ""
say "（Cursor / Codex / Gemini 等同样支持 MCP 的客户端同理，填同一个命令）"
say ""
say "然后在 Agent 里说「用 museav 出一张图」，或先问「这个 MCP 有哪些能力分组」。"
