# Repository Instructions

This project is Schwätzometer, a local-first browser MVP for speaker-share detection without transcription.

Do not introduce cloud APIs, speech-to-text, audio upload, telemetry, persistent speaker profiles, or account systems unless the user explicitly changes the requirements.

The app must run locally in the browser using `getUserMedia`, WebAudio, and the bundled Sherpa-ONNX browser WebAssembly speaker-diarization runtime. Voice profiles are in-memory only for the current session.

Use the existing `SpeakerShareEngine` interface in `src/audio/engine.js` for speaker logic. Keep UI code independent from the concrete speaker model so a native mobile engine can later replace the browser runtime.

The active browser runtime is:

- `vendor/sherpa-onnx/sherpa-onnx-speaker-diarization.js`
- `vendor/sherpa-onnx/sherpa-onnx-wasm-main-speaker-diarization.js`
- `vendor/sherpa-onnx/sherpa-onnx-wasm-main-speaker-diarization.wasm`
- `vendor/sherpa-onnx/sherpa-onnx-wasm-main-speaker-diarization.data`

Do not use `sherpa-onnx-wasm-nodejs.*` for the browser app.

Validation:

```powershell
npm run check
```

Run:

```powershell
npm start
```

Open `http://127.0.0.1:5173` in Chrome or Edge. The app needs `SharedArrayBuffer`, so `crossOriginIsolated` must be true.

Important files:

- `README.md`
- `AGENTS.md`
- `docs/PROJECT_CONTEXT.md`
- `docs/ARCHITECTURE.md`
- `docs/SHERPA_BROWSER_BUILD.md`
- `docs/DECISIONS.md`
- `docs/SESSION_METADATA.md`
- `docs/RECOVERY.md`
- `docs/ROADMAP.md`
