# Architektur

## Überblick

Die App ist eine statische Browser-App mit einem kleinen lokalen Node-Server.

```text
Browser UI
  -> WebAudio/getUserMedia
  -> SpeakerShareEngine interface
  -> SherpaOnnxWasmSpeakerEngine
  -> sherpa-onnx Browser-WASM Diarization
  -> UI-State: Sprecher, Scores, Zeiten, Timeline, Charts
```

## Dateien

- `index.html`: HTML-Shell und UI-Struktur.
- `src/app.js`: UI-State, Stimme-kennenlernen-Flow, Live-Flow, Rendering.
- `src/audio/engine.js`: Engine-Interface und `SherpaOnnxWasmSpeakerEngine`.
- `src/audio/vad.js`: Energie-VAD für UI- und Aufnahmefenster.
- `src/audio/features.js`: ältere lokale Feature-Helfer; nicht aktive Speaker-Engine.
- `src/charts.js`: Pie-Chart, Balkendiagramm und Zeitformatierung.
- `src/styles.css`: Layout und visuelle Gestaltung.
- `server.mjs`: lokaler HTTP-Server für `127.0.0.1` mit COOP/COEP.
- `vendor/sherpa-onnx/`: gebündelte Sherpa-ONNX Browser-WASM-Artefakte.

## Engine-Grenze

Die UI spricht nur mit `SpeakerShareEngine`.

Wichtige Methoden:

- `initialize()`
- `enrollParticipant(participant, samples, inputSampleRate)`
- `processAudio(samples, inputSampleRate)`
- `reset()`

Diese Grenze bleibt bewusst gesetzt. Eine native Android- oder iOS-Engine soll später dieselbe Form erfüllen können.

## Aktive Engine

Aktiv ist `SherpaOnnxWasmSpeakerEngine`.

Beim Start lädt sie:

- `sherpa-onnx-speaker-diarization.js`
- `sherpa-onnx-wasm-main-speaker-diarization.js`
- `sherpa-onnx-wasm-main-speaker-diarization.wasm`
- `sherpa-onnx-wasm-main-speaker-diarization.data`

Die `.data`-Datei enthält die Sherpa-Modelldateien `embedding.onnx` und `segmentation.onnx`. Die App lädt keine Audiodaten hoch und schreibt keine Sprecherprofile dauerhaft.

## Sprechervergleich

Die App transkribiert nicht. Sie nutzt Sherpa-Diarization lokal:

- Aufnahme wird auf 16 kHz gebracht.
- VAD entfernt Stille.
- Pro Person werden Sprachsamples aus `Stimme kennenlernen` gesammelt.
- Sherpa segmentiert kombinierte Probe- und Live-Fenster in Sprechercluster.
- Live-Fenster werden dem Profil zugeordnet, dessen Probe im gleichen Sherpa-Cluster liegt.
- Unsichere Fenster werden als `Unknown` gezählt.

Das ist ein MVP-Ansatz um das spätere Browsermodell real zu testen.

## Server

Der Server liefert nur statische Dateien aus. Er setzt:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`
- `Cache-Control: no-store`

Diese Header sind erforderlich, damit Browser `SharedArrayBuffer` für den Sherpa-WASM-Thread-Build freigeben.
