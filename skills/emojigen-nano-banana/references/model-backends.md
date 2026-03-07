# Model Backends

## Intent

Use Nano Banana style Gemini image editing for reference-image-to-sticker-sheet generation, while keeping backend selection explicit and reversible.

## Backend choice

Choose Gemini Developer API when:

- the user already has an API key,
- they want the simplest local setup,
- they are not tied to Google Cloud project policy.

Choose Vertex AI when:

- credentials must stay inside a GCP project,
- the user already uses ADC and project-level governance,
- quota and billing should route through Vertex AI.

## Current defaults for this skill

As of 2026-03-07:

- Default high-quality image model: `gemini-3-pro-image-preview` (`Nano Banana Pro`)
- Faster Nano Banana tier: `gemini-3.1-flash-image-preview` (`Nano Banana 2`)
- Default text path for emotion suggestions: local agent-generated wording, no Gemini text model required
- Forced image generation settings: `aspectRatio="3:2"` and `imageSize="2K"`

If the user explicitly says "use Nano Banana Pro", use `gemini-3-pro-image-preview`.
If the user explicitly says "use Nano Banana 2", use `gemini-3.1-flash-image-preview`.
If the user just says "Nano Banana", default to `Nano Banana Pro`.

## Credentials

### Gemini Developer API

Provide one of:

- `GEMINI_API_KEY`
- `GOOGLE_API_KEY`
- `API_KEY`

### Vertex AI

Provide:

- `GOOGLE_GENAI_USE_VERTEXAI=true`
- `GOOGLE_CLOUD_PROJECT=<project-id>`
- `GOOGLE_CLOUD_LOCATION=<location>`

Also ensure ADC is available. A common setup is:

```bash
gcloud auth application-default login
```

## Fallback policy

If Gemini access fails because the model is unavailable, billing is not enabled, or credentials are missing:

1. Preserve the skill's prompt-building step.
2. Tell the user which backend failed and why.
3. Use another image-capable tool only if the user allows it or the task clearly benefits from continuing.
4. Keep the output contract unchanged so `make-assets` can still finish the workflow.
