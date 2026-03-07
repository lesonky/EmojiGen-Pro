# EmojiGen Pro Skill

[English Version](./README.md)

这个仓库现在包含两部分内容：

1. 原始的 `EmojiGen Pro` Vite 演示应用。
2. 一个可复用的 skill：[`skills/emojigen-nano-banana`](./skills/emojigen-nano-banana)，用于拼装 Prompt、生成 4x6 表情网格、裁切正方形贴纸并导出 GIF。

这个 skill 面向 AI agent 工作流，图像模型固定为：

- `Nano Banana Pro` -> `gemini-3-pro-image-preview`
- `Nano Banana 2` -> `gemini-3.1-flash-image-preview`
- 图像输出参数固定：`3:2`、`2K`

## Skill 能力

- 接收参考图。
- 生成严格的 4x6 表情网格 Prompt。
- 输出：
  - `24` 张静态表情，或
  - `1` / `2` / `4` 个动态 GIF 表情
- 将每个格子裁成正方形资产。
- 使用更安全的四角连通 flood-fill 去背景。
- 将最终产物交付到工作目录。
- 在交付完成后，按需清理 skill 自己创建的 `/tmp/emojigen-*` 临时目录。

## 快速开始

安装依赖：

```bash
npm install
```

一次性跑完整流程：

```bash
node skills/emojigen-nano-banana/scripts/emojigen.mjs run \
  --config skills/emojigen-nano-banana/assets/example-config.json \
  --reference /绝对路径/头像.png \
  --out-dir /tmp/emojigen-run \
  --deliver-dir /绝对路径/工作目录输出 \
  --cleanup-temp
```

## 推荐流程

建议按这个顺序执行：

1. 如果图片来自剪贴板或路径不稳定，先把图片暂存下来。
2. 运行 `preflight`，先确认后端可用，并补齐随机情绪词。
3. 使用 `run` 一次性生成，或者拆成 `build-prompt`、`generate-grid`、`make-assets` 分步执行。
4. 使用 `--deliver-dir` 将最终结果复制到工作目录。
5. 使用 `--cleanup-temp` 在交付后清理 skill 管理的 `/tmp/emojigen-*` 临时文件。

常用命令：

```bash
node skills/emojigen-nano-banana/scripts/emojigen.mjs stage-image --from-clipboard
node skills/emojigen-nano-banana/scripts/emojigen.mjs preflight --config /绝对路径/config.json --reference /绝对路径/image.png
node skills/emojigen-nano-banana/scripts/emojigen.mjs suggest-emotions --category "职场打工人, 加班, 摸鱼"
```

## 临时目录说明

这个 skill 会在 `/tmp/emojigen-*` 下写入中间产物。

- macOS 最终可能会清理 `/tmp`，但时间并不稳定。
- 对 agent 工作流来说，不应该依赖系统“未来某个时间”自动清理。
- 更稳妥的做法是：先用 `--deliver-dir` 交付到工作目录，再用 `--cleanup-temp` 清理临时数据。

## Demo

当前仓库内置了一套已交付的 demo，主题是“职场 4 动态表情包，皮克斯 3D 风格”，由真实照片生成：

- 网格图：[`demo-assets/2026-03-08-office-pixar/grid.png`](./demo-assets/2026-03-08-office-pixar/grid.png)
- GIF：
  - [`收到.gif`](./demo-assets/2026-03-08-office-pixar/stickers/收到/收到.gif)
  - [`摸鱼.gif`](./demo-assets/2026-03-08-office-pixar/stickers/摸鱼/摸鱼.gif)
  - [`裂开.gif`](./demo-assets/2026-03-08-office-pixar/stickers/裂开/裂开.gif)
  - [`先忙.gif`](./demo-assets/2026-03-08-office-pixar/stickers/先忙/先忙.gif)

### Demo 网格

![Demo Grid](./demo-assets/2026-03-08-office-pixar/grid.png)

### Demo GIF

| 表情 | 预览 |
| --- | --- |
| 收到 | ![收到](./demo-assets/2026-03-08-office-pixar/stickers/收到/收到.gif) |
| 摸鱼 | ![摸鱼](./demo-assets/2026-03-08-office-pixar/stickers/摸鱼/摸鱼.gif) |
| 裂开 | ![裂开](./demo-assets/2026-03-08-office-pixar/stickers/裂开/裂开.gif) |
| 先忙 | ![先忙](./demo-assets/2026-03-08-office-pixar/stickers/先忙/先忙.gif) |

## 仓库结构

```text
.
├── skills/emojigen-nano-banana/   # 可复用 skill
├── demo-assets/                   # 已交付的 demo 产物
├── components/                    # 原始 Vite demo 应用 UI
├── services/
└── utils/
```
