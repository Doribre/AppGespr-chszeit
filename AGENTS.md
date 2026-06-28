# Agent Handoff

This repository is a local-first browser MVP for speaker-share detection without transcription.

## Prime Directive

Do not add cloud APIs, audio uploads, speech-to-text, persistent speaker profiles, or hidden storage unless the user explicitly changes the privacy requirements.

## Read First

1. `README.md`
2. `docs/PROJECT_CONTEXT.md`
3. `docs/ARCHITECTURE.md`
4. `docs/SHERPA_BROWSER_BUILD.md`
5. `docs/DECISIONS.md`
6. `docs/SESSION_METADATA.md`

## Build And Validation

Run:

```powershell
npm run check
```

Run locally:

```powershell
npm start
```

Open in Chrome or Edge:

```text
http://127.0.0.1:5173
```

The app needs `SharedArrayBuffer`, so the browser must report `crossOriginIsolated === true`.

## Code Map

- `src/app.js`: UI state and flow.
- `src/audio/engine.js`: `SpeakerShareEngine` and active `SherpaOnnxWasmSpeakerEngine`.
- `src/audio/vad.js`: local energy VAD for window filtering.
- `src/audio/features.js`: older local feature helpers; not the active speaker engine.
- `src/charts.js`: chart helpers.
- `src/styles.css`: UI styling.
- `server.mjs`: local static server with COOP/COEP headers.
- `vendor/sherpa-onnx/`: official Sherpa-ONNX browser WASM artifacts.

## Important Implementation Note

The active runtime is the official Sherpa-ONNX browser speaker-diarization build:

- `sherpa-onnx-wasm-main-speaker-diarization.js`
- `sherpa-onnx-wasm-main-speaker-diarization.wasm`
- `sherpa-onnx-wasm-main-speaker-diarization.data`

Do not replace it with `sherpa-onnx-wasm-nodejs.*`; that runtime is for Node.js and is not the browser path.

## GitHub Workflow

The repository is managed through GitHub Desktop. Avoid changing global Git configuration to work around local ownership issues. Prefer ordinary file edits in the repository, then let the user review, commit, and push via GitHub Desktop.
