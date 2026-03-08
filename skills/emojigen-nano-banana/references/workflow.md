# Workflow Reference

## Overview

This skill converts the original browser workflow into a file-based workflow:

1. Stage the input image into `/tmp` when it came from clipboard, chat paste, or an unstable location.
2. Resolve config.
3. Optionally suggest emotions, with local agent-generated emotions as the default path.
4. Run preflight.
5. Build one prompt for a 4x6 sticker sheet.
6. Generate a grid image from the reference image.
7. Slice the grid into square stickers.
8. Encode GIFs for animated mode or export PNGs for static mode.
9. Read `manifest.quality` and rerun if warnings indicate edge collisions or anchor drift.

## Environment variables

The CLI resolves credentials in this order:

### Gemini Developer API

- `GEMINI_API_KEY`
- `GOOGLE_API_KEY`
- `API_KEY`

### Vertex AI

Set all of:

- `GOOGLE_GENAI_USE_VERTEXAI=true`
- `GOOGLE_CLOUD_PROJECT`
- `GOOGLE_CLOUD_LOCATION`

Vertex AI also requires local ADC credentials such as `gcloud auth application-default login`.

## Model selection

Image model precedence:

1. `--image-model`
2. config `imageModel`
3. `NANO_BANANA_MODEL`
4. `EMOJIGEN_IMAGE_MODEL`
5. default `gemini-3-pro-image-preview`

Allowed image model values:

- `gemini-3-pro-image-preview`
- `gemini-3.1-flash-image-preview`
- `nano-banana-pro`
- `nano banana pro`
- `nano-banana-2`
- `nano banana 2`

Text model precedence:

1. `--text-model`
2. config `textModel`
3. `EMOJIGEN_TEXT_MODEL`
4. default empty, which means local agent-generated emotions

## CLI commands

### Stage source image

For clipboard images:

```bash
node skills/emojigen-nano-banana/scripts/emojigen.mjs stage-image \
  --from-clipboard
```

For copying a known source file into `/tmp`:

```bash
node skills/emojigen-nano-banana/scripts/emojigen.mjs stage-image \
  --input /abs/path/to/avatar.png
```

### Preflight

```bash
node skills/emojigen-nano-banana/scripts/emojigen.mjs preflight \
  --config skills/emojigen-nano-banana/assets/example-config.json \
  --reference /tmp/emojigen-input-123.png
```

### Suggest emotions

```bash
node skills/emojigen-nano-banana/scripts/emojigen.mjs suggest-emotions \
  --category "日常生活, 轻松愉快, 常用社交回复" \
  --count 4 \
  --out tmp/emotions.json
```

If `--text-model` is omitted and `textModel` is empty in config, the CLI generates the emotion list locally without calling Gemini.

### Build prompt only

```bash
node skills/emojigen-nano-banana/scripts/emojigen.mjs build-prompt \
  --config skills/emojigen-nano-banana/assets/example-config.json \
  --out tmp/prompt.txt
```

Use this for inspection, not as the final workflow. Do not stop after `build-prompt` and then call a raw model manually unless the built-in generation path is genuinely unavailable.

### Generate grid only

```bash
node skills/emojigen-nano-banana/scripts/emojigen.mjs generate-grid \
  --config skills/emojigen-nano-banana/assets/example-config.json \
  --reference /abs/path/to/avatar.png \
  --out tmp/grid.png
```

### Create GIFs from an existing grid

```bash
node skills/emojigen-nano-banana/scripts/emojigen.mjs make-assets \
  --config skills/emojigen-nano-banana/assets/example-config.json \
  --grid /abs/path/to/grid.png \
  --out-dir /tmp/emojigen-output \
  --deliver-dir /abs/path/to/workspace-output \
  --cleanup-temp
```

### End-to-end

```bash
node skills/emojigen-nano-banana/scripts/emojigen.mjs run \
  --config skills/emojigen-nano-banana/assets/example-config.json \
  --reference /abs/path/to/avatar.png \
  --out-dir /tmp/emojigen-run \
  --deliver-dir /abs/path/to/workspace-output \
  --cleanup-temp
```

## Output layout

`run` and `make-assets` write:

- `resolved-config.json`
- `prompt.txt` when available
- `grid.png` when generated through the CLI
- `stickers/`
- `manifest.json`

Generated image requests always use:

- `aspectRatio: "3:2"`
- `imageSize: "2K"`

Delivery and cleanup:

- `--deliver-dir` copies the finished folder into the working directory or client delivery location.
- `--cleanup-temp` removes skill-managed `/tmp/emojigen-*` paths after successful delivery.

Quality gate:

- `manifest.quality.status: "ok"` means no obvious crop/anchor issue was detected.
- `manifest.quality.status: "warn"` means at least one animated sequence is too close to the crop edge or drifts too much across frames.
- When quality is `warn`, tighten the prompt and rerun before delivery.

Animated mode writes:

- `stickers/<emotion>/frames/*.png`
- `stickers/<emotion>/<emotion>.gif`

Static mode writes:

- `stickers/<index>-<emotion>.png`

## Notes

- The workflow assumes a strict 4x6 grid because the original app relies on deterministic cell slicing.
- Static mode resolves to exactly 24 stickers. Animated mode only supports 1, 2, or 4 GIFs because those counts map cleanly onto the 24 cells.
- Square-safe composition is mandatory: the subject must stay centered inside each cell, and animated sequences should keep a stable body anchor so the cropped GIF does not jitter.
- Background removal uses corner-connected flood fill from the four corners. This is much safer than globally removing every similar color and reduces accidental transparency on faces or clothes.
- If `emotions` is an explicit empty array, the workflow treats that as "generate random emotions"; it does not silently replace them with default labels.
- Random emotion generation should not require a text model. Use a text model only when the user explicitly wants model-written emotion labels.
- Before generation, always rewrite `characterNotes` from the current input image. Reusing stale notes from another person is a guaranteed failure mode.
- If the user wants a different sheet geometry, this skill is the wrong starting point; say so and adjust the workflow deliberately.
