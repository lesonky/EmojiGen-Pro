# EmojiGen Pro Skill

[中文说明](./README.zh-CN.md)

This repository now contains two related pieces:

1. The original `EmojiGen Pro` Vite demo app.
2. A reusable skill at [`skills/emojigen-nano-banana`](./skills/emojigen-nano-banana) for prompt assembly, 4x6 sheet generation, square slicing, and GIF export.

The skill is designed for AI agents and uses:

- `Nano Banana Pro` -> `gemini-3-pro-image-preview`
- `Nano Banana 2` -> `gemini-3.1-flash-image-preview`
- Fixed output settings: `3:2`, `2K`

## What the skill does

- Accepts a reference image.
- Builds a strict 4x6 sticker-sheet prompt.
- Generates either:
  - `24` static stickers, or
  - `1`, `2`, or `4` animated GIF stickers
- Crops each cell to a square asset.
- Removes background with a safer corner-connected flood-fill strategy.
- Delivers finished assets into a workspace directory.
- Optionally cleans up skill-managed `/tmp/emojigen-*` directories after delivery.

## Quick Start

Install dependencies:

```bash
npm install
```

Example end-to-end run:

```bash
node skills/emojigen-nano-banana/scripts/emojigen.mjs run \
  --config skills/emojigen-nano-banana/assets/example-config.json \
  --reference /abs/path/to/avatar.png \
  --out-dir /tmp/emojigen-run \
  --deliver-dir /abs/path/to/workspace-output \
  --cleanup-temp
```

## Workflow

Recommended sequence:

1. Stage the image if it came from clipboard or an unstable path.
2. Run `preflight` to resolve random emotions and verify Gemini / Vertex readiness.
3. Run `run` for a full generation, or split the steps into `build-prompt`, `generate-grid`, and `make-assets`.
4. Use `--deliver-dir` to copy final files into the workspace.
5. Use `--cleanup-temp` to remove skill-managed `/tmp/emojigen-*` paths after delivery.

Useful commands:

```bash
node skills/emojigen-nano-banana/scripts/emojigen.mjs stage-image --from-clipboard
node skills/emojigen-nano-banana/scripts/emojigen.mjs preflight --config /abs/path/to/config.json --reference /abs/path/to/image.png
node skills/emojigen-nano-banana/scripts/emojigen.mjs suggest-emotions --category "职场打工人, 加班, 摸鱼"
```

## Temporary Files

The skill writes transient files under `/tmp/emojigen-*`.

- macOS may eventually clear `/tmp`, but not immediately or predictably.
- For agent workflows, do not rely on system cleanup alone.
- Prefer `--deliver-dir` plus `--cleanup-temp` so outputs are copied into the working directory first and then temporary data is removed.

## Demo

The latest checked-in demo is a 4-GIF office-themed Pixar-style set generated from a real photo:

- Grid: [`demo-assets/2026-03-08-office-pixar/grid.png`](./demo-assets/2026-03-08-office-pixar/grid.png)
- GIFs:
  - [`收到.gif`](./demo-assets/2026-03-08-office-pixar/stickers/收到/收到.gif)
  - [`摸鱼.gif`](./demo-assets/2026-03-08-office-pixar/stickers/摸鱼/摸鱼.gif)
  - [`裂开.gif`](./demo-assets/2026-03-08-office-pixar/stickers/裂开/裂开.gif)
  - [`先忙.gif`](./demo-assets/2026-03-08-office-pixar/stickers/先忙/先忙.gif)

### Demo Grid

![Demo Grid](./demo-assets/2026-03-08-office-pixar/grid.png)

### Demo GIFs

| Emotion | Preview |
| --- | --- |
| 收到 | ![收到](./demo-assets/2026-03-08-office-pixar/stickers/收到/收到.gif) |
| 摸鱼 | ![摸鱼](./demo-assets/2026-03-08-office-pixar/stickers/摸鱼/摸鱼.gif) |
| 裂开 | ![裂开](./demo-assets/2026-03-08-office-pixar/stickers/裂开/裂开.gif) |
| 先忙 | ![先忙](./demo-assets/2026-03-08-office-pixar/stickers/先忙/先忙.gif) |

## Repository Structure

```text
.
├── skills/emojigen-nano-banana/   # reusable skill
├── demo-assets/                   # delivered demo outputs
├── components/                    # original Vite demo app UI
├── services/
└── utils/
```
