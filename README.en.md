<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/cortexos-dev/.github/main/brand/mark-dark.svg">
    <img src="https://raw.githubusercontent.com/cortexos-dev/.github/main/brand/mark.svg" alt="CortexOS Logo" height="72">
  </picture>
</p>

<h1 align="center">cs-mcp</h1>

<p align="center">
  <strong>Open-source toolchain gateway for CortexOS: discovers capabilities from installed local CLIs and exposes them over MCP.</strong><br>
  Multiplexes CLI tools across open-source projects into capability groups.<br>
  Tools register only when their respective CLI is installed, without consuming model context for uninstalled tools.
</p>

<p align="center">
  <a href="https://github.com/cortexos-dev/cs-mcp/releases/latest"><img src="https://img.shields.io/github/v/release/cortexos-dev/cs-mcp?style=for-the-badge&color=3fb950&label=release" alt="release" /></a>
  <img src="https://img.shields.io/badge/transport-stdio-8957e5?style=for-the-badge" alt="stdio" />
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux-4d6bfe?style=for-the-badge" alt="platform" />
  <img src="https://img.shields.io/badge/license-MIT-777?style=for-the-badge" alt="MIT" />
</p>

<p align="center">
  <a href="README.md">中文</a> · <a href="CHANGELOG.md">Changelog</a>
</p>

---

## Architectural Scope: Separation from `cs mcp serve`

The system includes two components offering MCP channels, each with distinct responsibilities:

| Aspect | `cs mcp serve` (built into CortexOS) | **This repo, cs-mcp** |
|---|---|---|
| Implementation | Go, a `cs` subcommand | TypeScript, standalone binary (or run from source) |
| Server name | `cortexos` | `cs` |
| Scope | **System context**: rules, skills, knowledge search, CLI registry | **Toolchain multiplexing**: capabilities exposed by open-source CLIs |
| Source of truth | `cli-registry.json` + `docs/rules` + `skills` | Installed local CLIs |
| Tool discovery | Built-in read-only discovery tools | Dynamic probing based on installed CLIs |

Distinction principle: **Use `cs mcp serve` for CortexOS rules, skills, and system context; use cs-mcp to invoke image generation, Markdown typesetting, browser automation, and quality gate CLIs.**

> Note: Environments with shell access can call the `cs` CLI directly; cs-mcp primarily serves MCP-compatible AI clients requiring a standard interface.

## Why cs-mcp

| Need | Hand-rolled commands | SDK per tool | cs-mcp |
|---|:---:|:---:|:---:|
| Unified CLI capabilities | Fragmented command syntax | Multiple SDK protocols | Unified MCP interface |
| Client interoperability | Tied to local shell environment | Vendor-specific SDK APIs | Standard MCP client compatibility |
| Zero overhead for uninstalled tools | — | Often registered unconditionally | **Probing**: registered only when CLI is installed |
| Local file and media handling | Manual conversion and parsing | Base64 serialization overhead | Native filesystem paths |
| Toolchain maintenance | Ad-hoc invocation scripts | Frequent adapter updates | Upgrading the underlying CLI takes effect immediately |

**Layering principle: Capabilities reside in CLIs; cs-mcp only handles standardization and multiplexing.** Every tool is a thin wrapper over its respective CLI, avoiding duplicated business logic and ensuring complete parity with upstream CLI behavior.

Transport is stdio. Files are passed via **absolute paths**, and outputs are written back to disk and returned as paths, avoiding base64 encoding overhead for large files.

## Capability Groups

| Group | Tier | Open-source project | Tools | What it does | Requires |
|---|---|:---:|---:|---|---|
| `museav` | **cloud** | [museav-cli](https://github.com/webkubor/museav-cli) | 17 | Image / video generation, local post-processing (matting, upscaling, watermark removal, compression), template & skill listings, asset upload, image→template, SCULPT prompt reversal, SkillHub publishing | `museav-cli` ≥ 3.9.0 |
| `vlm` | local | [mlx-vlm-kit](https://github.com/webkubor/mlx-vlm-kit) | 4 | Local offline vision: describe, ask, cover-check, reverse-prompt | `vlm` (Apple Silicon) |
| `contrast` | local | [contrast-guard](https://github.com/webkubor/contrast-guard) | 3 | Contrast gating: static colour-pair check, rendered measurement, baselines | `contrast-guard` |
| `facet` | local | [@webkubor/facet](https://github.com/webkubor/facet) | 2 | Typeset Markdown into PDF / long image / slide deck | `facet` |
| `reel` | local | [@kubor/reel-kit](https://github.com/webkubor/reel-kit) | 3 | Assets + per-line copy → vertical video (templates / transitions / BGM / optional voice-over) | `reel` + **ffmpeg** |
| `browser` | local | [ego-browser](https://lite.ego.app) | 13 | Real Chrome: open / snapshot / click / type / screenshot / JS eval + a **human hand-off protocol** + multi-agent session isolation | `ego-browser` |
| `scorecard` | local/cloud | [scorecard](https://github.com/webkubor/scorecard) | 3 | Open-source maturity & brand auditing: GitHub / npm / web 9-dimension checks + GEO visibility | `scorecard` |
| `writing` | local | [writing-standard-skills](https://github.com/webkubor/writing-standard-skills) | 3 | Anti-AI static linter, Xiaohongshu/X/Reddit/Juejin feed deduction rubrics, 5D atomic matrix composer | zero-dep (built-in) |
| `wechat` | local Mac | [wx-cli](https://github.com/pandorafuture/wx-cli) | 6 | Local WeChat sessions, contacts, messages and full-text search; database stays on this Mac | `wx-cli` + local WeChat database key |
| — | built in | this MCP | 1 | `groups_list`: every group, what to install, why one is off | none |

Among the capability groups, **`museav` is a cloud service** (requiring account login and network quota, with tools prefixed by `museav_`); `wechat` reads local WeChat data (restricted to private data on this machine); all other groups run offline local tools.
Core principle: **cs is core, museav is cloud capability extension.**

**The default strategy is probing**: a group's tools are registered only if its CLI is on `PATH`.
Tool schemas ship with *every* model request, and an aggregator only grows — users shouldn't pay tokens
for tools they never installed. Nothing disappears silently: `groups_list` is always available and tells
the agent what this MCP can do and what to install.

Force or trim groups with `CS_MCP_GROUPS`:

```bash
CS_MCP_GROUPS=all              # register everything (missing CLIs error only when called)
CS_MCP_GROUPS=facet,contrast   # only these
CS_MCP_GROUPS=-museav          # default set minus these
```

> The pre-3.0.0 name `MUSEAV_MCP_GROUPS` **still works** (new name wins; if both are set to different
> values the new one wins and a warning goes to stderr). It has to stay: ignoring the old variable
> **doesn't error** — it silently falls back to probing, so anyone who had written `all` just loses those
> forced-on groups with no signal at all.

## ⚡ Quickstart

**Install (one command — no Node, no npm needed):**

```bash
curl -fsSL https://raw.githubusercontent.com/cortexos-dev/cs-mcp/main/install.sh | bash
```

The installer prints its own version (`cs-mcp --version`) and how to wire it up:

```bash
claude mcp add cs -- ~/.local/bin/cs-mcp
```

> **Why not `npx -y cs-mcp`**: this gateway wraps museav-cli, mlx-vlm-kit,
> contrast-guard, facet, reel-kit and lite-browser — users already pay for six
> different install mechanisms (npm / pipx / brew / curl) to get the full set.
> If the gateway itself needs `npm i -g` or `npx -y`, that adds a Node + npm +
> registry-network hurdle in front of everything else, when the whole point of
> this layer is to *lower* the bar to one command. Most people never get past
> step one. (The `cs-mcp` package on npm was unpublished long ago and this repo
> no longer publishes to npm — the installer above is the only supported way.)

**Install whichever CLI you want a group for** — a group's tools appear only when its CLI is installed:

```bash
npm i -g museav-cli                    # the generation group
```

**From source** (working on this repo, or if you'd rather not download a binary):

```bash
git clone git@github.com:cortexos-dev/cs-mcp && cd cs-mcp
pnpm install && pnpm build
claude mcp add cs -- node "$PWD/dist/index.js"
```

> Windows has no one-liner yet — use WSL or the from-source path.

## Tools (43)

### `museav` group — MUSE AV generation backend (17)

| Tool | What it does | Login required |
|---|---|---|
| `museav_gen_background` | Generate backgrounds / images / video (via the backend) | ✅ yes |
| `museav_remove_bg` | Background removal (BiRefNet / ISNet / U2Net), outputs alpha PNG | no, runs locally |
| `museav_upscale_image` | Super-resolution (Real-ESRGAN + Vulkan GPU), 4x by default | no, runs locally |
| `museav_remove_watermark` | Watermark removal (LaMa inpainting), auto-detects, accepts a manual mask | no, runs locally |
| `museav_compress_image` | Compress (sharp); max edge / quality / format configurable | no, runs locally |
| `museav_list_templates` | List available image / text templates (prefer these over hardcoding a `template`) | ✅ yes |
| `museav_list_skills` | List available skills (prefer these over hardcoding a `skill` slug) | ✅ yes |
| `museav_list_video_templates` | List video templates (sibling to `museav_list_templates`; pairs with `museav_gen_background`'s `video=true` + `template`) | ✅ yes |
| `museav_list_models` | List models; `video=true` lists video tiers (feed straight into `museav_gen_background`'s `model`) | ✅ yes |
| `museav_balance` | Check upstream balance | ✅ yes |
| `museav_list_jobs` | List your generation jobs (result URLs, failure reasons) | ✅ yes |
| `museav_upload_asset` | Upload an asset and get a public direct link (use when a reference image needs a URL) | ✅ yes |
| `museav_image_to_template` | Image → template: read the image, invert text layers, parameterize | ✅ yes |
| `museav_reverse` | Reverse a SCULPT prompt from an image (backend API). **Complements** `vlm_reverse_prompt` | ✅ yes |
| `museav_skillhub_tags` | List SkillHub content tags (required when publishing; never hardcode) | ✅ yes |
| `museav_skillhub_whoami` | Check SkillHub login state (redacted) | ✅ yes |
| `museav_skillhub_publish` | Publish a local agent skill to SkillHub. **Dry-run by default**; pass `submit=true` to really submit | ✅ yes |

### `vlm` group — local vision (4)

`vlm_describe`, `vlm_ask`, `vlm_cover_check`, `vlm_reverse_prompt` — all offline, zero-cost, no login
(local Qwen3-VL). **Apple Silicon required.**

### `contrast` group — contrast gating (3)

`contrast_check` (static colour pairs), `contrast_init` (generate a config), `contrast_measure`
(rendered sizes / greys / motion, baselines). `check` answers "is it right", `measure` answers
"how much" — **ugly things usually look "right" one at a time**, so run both.

### `facet` group — Markdown typesetting (2)

`facet_templates` (list template names), `facet_build` (Markdown → PDF / long image / slides).

### `reel` group — vertical video assembly (3)

`reel_templates` (list layout templates), `reel_bgm` (BGM library: alias, duration, licence),
`reel_make` (assets + per-line copy → mp4).

Assets and copy are matched **in order**; when the counts differ the smaller side wins and the extra
items are reported explicitly — never silently dropped. Without `voice`, shot length comes from `perShot`
(no models needed); with it, a local Qwen3-TTS is used. **Requires ffmpeg on the system.**

`museav` produces the raw material (stills, silent clips); `reel` produces the publishable cut —
two halves of one pipeline.

## Prerequisites

```bash
npm i -g museav-cli        # museav group: generation / post-processing / assets / SkillHub (>= 3.9.0)
pipx install git+https://github.com/webkubor/mlx-vlm-kit.git   # vlm group
npm i -g contrast-guard    # contrast group
npm i -g github:webkubor/facet   # facet group (git-distributed, not updated on npm)
npm i -g github:webkubor/reel-kit   # reel group (git-distributed; plus: brew install ffmpeg)
curl -fsSL https://raw.githubusercontent.com/webkubor/lite-browser/main/install.sh | bash   # browser group
```

Install only what you need — an uninstalled group simply isn't registered, and nothing errors.

`museav_gen_background` additionally needs a backend apiKey (see the museav-cli README). Local tools download
model weights on first run (matting ~214MB, upscaling ~65MB, watermark removal ~200MB, vlm's
Qwen3-VL-4B about 2.9GB).

Point at executables outside the global PATH with `MUSEAV_BIN`, `MLX_VLM_BIN`, `CONTRAST_GUARD_BIN`,
`FACET_BIN`.

## Wiring it into an agent

See the [Chinese README](README.md#接到-agent-上) for the full Claude Code / DSH / any-MCP-client config
snippets, including how to pass `CS_MCP_GROUPS` through `env`.

## Local WeChat access (`wechat`, macOS only)

Install [wx-cli](https://github.com/pandorafuture/wx-cli) on the **same Mac** that runs cs-mcp.
The `wechat` group appears automatically when `wx-cli` is on `PATH`. Start with `wechat_status`.
You need a database key; upstream's `wx-cli key extract` requires disabling macOS SIP and restarting WeChat,
so cs-mcp deliberately does not expose that operation. Once a key is available, run `wechat_decrypt`
and then use `wechat_sessions`, `wechat_contacts`, `wechat_messages`, or `wechat_search`.
Search does **not** honour wx-cli's hidden-contact rules and may return hidden conversations.
Do not send chat contents to external services.

A local Hermes agent can use the same cs-mcp instance by adding this under `mcp_servers`
in `~/.hermes/config.yaml` and restarting its session:

```yaml
  cs:
    command: node
    args:
      - /absolute/path/to/cs-mcp/dist/index.js
```

## Not in yet (and why)

| Project | Why not |
|---|---|
| [kyvault](https://github.com/webkubor/kyvault) | A **secret store**; `get` prints plaintext. That class of capability never belongs in a public MCP |
| [voxflow](https://github.com/webkubor/voxflow) | Clear tool surface, heavy environment (local TTS models ~2.9GB) — better as its own group later |
| [trend-radar](https://github.com/webkubor/trend-radar) / [path-guard](https://github.com/webkubor/path-guard) / [deadcode-reaper-skill](https://github.com/webkubor/deadcode-reaper-skill) | Good capability, currently repo scripts or agent skills, waiting for standalone CLI packages |

**Adding a group** takes three steps: make sure the project's CLI is installable, add a `CliSpec` in
`src/clis.ts`, add a group file under `src/groups/` and list it in `src/registry.ts`. No business logic
goes into the MCP.

## Verification

```bash
node test-mcp.mjs      # boots the server, runs initialize + tools/list
                       # asserts: 55 tools, every name prefixed with its group id, old env name still works
```

`CS_MCP_GROUPS=all` is how the test boots: CI has no CLIs installed, so the default probing strategy
would register nothing and the tool set itself would go untested. The legacy name `MUSEAV_MCP_GROUPS`
gets a **second server boot** to prove it is equivalent — that rename's silent downgrade only shows on
this path.

## Notes

- Results are written to disk; tools return paths, so you can hand them straight to a browser or another tool.
- Tools marked "runs locally" need no login and never touch the backend.
- This package is a thin multiplexer — real behaviour lives in each project's CLI. File issues there.

## License

MIT
