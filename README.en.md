<h1 align="center">🧭 cs-mcp</h1>

<p align="center">
  <strong>The MCP server of CortexOS (the CS system) — one command that wires a personal toolchain into any AI agent.</strong><br>
  Strings the CLI capabilities of several open-source projects into one network: image generation, local vision,<br>
  contrast gating, Markdown typesetting… organised as <em>capability groups</em>. A group's tools appear only when its CLI is installed, so nothing you don't have eats your context.
</p>

<p align="center">
  <a href="https://github.com/webkubor/cs-mcp/releases/latest"><img src="https://img.shields.io/github/v/release/webkubor/cs-mcp?style=for-the-badge&color=3fb950&label=release" alt="release" /></a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux-4d6bfe?style=for-the-badge" alt="platform" />
  <img src="https://img.shields.io/badge/tools-49-4d6bfe?style=for-the-badge" alt="tools" />
  <img src="https://img.shields.io/badge/runtime_deps-0-5A9E6F?style=for-the-badge" alt="deps" />
  <img src="https://img.shields.io/badge/license-MIT-777?style=for-the-badge" alt="MIT" />
  <img src="https://img.shields.io/badge/transport-stdio-8957e5?style=for-the-badge" alt="stdio" />
</p>

<p align="center">
  <a href="README.md">中文</a> · <a href="CHANGELOG.md">Changelog</a>
</p>

---

## ⚠️ Not to be confused with `cs mcp serve`

There are **two** things called "the cs MCP". They complement each other; wiring up the wrong one gets you
a pile of tools you didn't ask for:

| | `cs mcp serve` (built into CortexOS) | **This repo, cs-mcp** |
|---|---|---|
| Form | Go, a `cs` subcommand | TypeScript, single self-contained binary (or run from source) |
| Server name | `cortexos` | `cs` |
| Covers | **System context**: rules / skills / knowledge search / CLI ledger / agent context | **Toolchain multiplexing**: the CLI capabilities of open-source projects |
| Source of truth | `cli-registry.json` + `docs/rules` + `skills` | each project's own CLI |
| Size | 11 read-only discovery tools | 49 tools across 8 capability groups |

One line: **"what rules and skills does the cs system have" → `cs mcp serve`; "generate an image, typeset
Markdown to PDF, drive a real browser, audit open-source projects, de-AI writing" → cs-mcp.**

> For the record: **agents generally don't need MCP at all.** Anything that can run Bash should just call
> the `cs` CLI — that's the main road, and it reaches remote machines where an MCP over stdio cannot.
> MCP's value is confined to clients that **can't run Bash**.

## 🎯 Why This

| Need | Hand-rolled commands | SDK per tool | cs-mcp |
|---|:---:|:---:|:---:|
| Generation, vision, gating and typesetting in one agent | ❌ Four dialects | ❌ Wire the protocol four times | ✅ One server covers all |
| Survives switching agents | ❌ Tied to one CLI | ⚠️ Every vendor differs | ✅ Anything that speaks MCP |
| Tools you don't have eating context | — | ❌ Always registered | ✅ **Probing**: registered only if installed |
| Large images / long docs in context | ❌ Handle manually | ❌ Write base64 plumbing | ✅ Absolute paths on disk |
| Adding new capability | Remember each command | ❌ Edit the MCP | ✅ Upgrade the CLI (the MCP only multiplexes) |

**The layering is strict: capability lives in the CLI, the MCP only multiplexes.** This repo implements
nothing of its own — every tool is a thin shell over some project's CLI. Upgrade the CLI and the new
capability shows up here immediately; nothing is re-implemented, so the two can never disagree.

Transport is stdio. Files are passed in as **absolute paths**, and results are written back to disk and
returned as paths — no base64.

## 🧩 Capability groups (this is the map)

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
| — | built in | this MCP | 1 | `groups_list`: every group, what to install, why one is off | none |

Exactly one of the eight is a **cloud** group: `museav` needs a login, a network, a balance and money.
The other seven are offline, deterministic computation. That split is readable straight off the tool names —
**all 17 cloud tools carry the `museav_` prefix.**

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
curl -fsSL https://raw.githubusercontent.com/webkubor/cs-mcp/main/install.sh | bash
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
> step one. (The `cs-mcp` package on npm is marked unmaintained and will not be
> updated.)

**Install whichever CLI you want a group for** — a group's tools appear only when its CLI is installed:

```bash
npm i -g museav-cli                    # the generation group
```

**From source** (working on this repo, or if you'd rather not download a binary):

```bash
git clone https://github.com/webkubor/cs-mcp && cd cs-mcp
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
npm i -g @webkubor/facet   # facet group
npm i -g @kubor/reel-kit   # reel group (plus: brew install ffmpeg)
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
                       # asserts: 49 tools, every name prefixed with its group id, old env name still works
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
