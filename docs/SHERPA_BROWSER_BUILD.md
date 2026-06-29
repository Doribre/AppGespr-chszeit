# Sherpa-ONNX Browser Build

Stand: 2026-06-29

## Aktiver Stand

Schwätzometer nutzt jetzt echte Sherpa-ONNX Browser-WASM-Artefakte für Speaker-Diarization.

Gebündelte Dateien:

- `vendor/sherpa-onnx/sherpa-onnx-speaker-diarization.js`
- `vendor/sherpa-onnx/sherpa-onnx-wasm-main-speaker-diarization.js`
- `vendor/sherpa-onnx/sherpa-onnx-wasm-main-speaker-diarization.wasm`
- `vendor/sherpa-onnx/sherpa-onnx-wasm-main-speaker-diarization.data`

Quelle:

- Repository: `https://github.com/k2-fsa/sherpa-onnx`
- Release: `v1.13.3`
- Asset: `sherpa-onnx-wasm-simd-v1.13.3-speaker-diarization.tar.bz2`
- Download-SHA256: `BD9645354E5EB7D261DC5B8227E46937615A53571250F3E7EA11D2AF4899E3AC`

## Nutzung in Stufe 2

Die App lädt weiterhin diese offizielle Browser-Diarization-Runtime. Der JavaScript-Wrapper stellt aktuell `createOfflineSpeakerDiarization` bereit, aber keine separate Speaker-Embedding- oder Speaker-Verification-API für `embedding.onnx`.

Deshalb nutzt Stufe 2 Sherpa-ONNX für die lokale Diarization und ergänzt darüber einen lokalen Browser-Profilvergleich: Aus `Stimme kennenlernen` entstehen mehrere Session-Embeddings pro Person, die nur im Arbeitsspeicher bleiben. Live-Fenster werden gegen diese Profile verglichen und mit dem Sherpa-Diarization-Score kombiniert.

## Warum nicht das npm-Node-WASM-Paket?

Das zuvor geprüfte npm-Paket enthielt `sherpa-onnx-wasm-nodejs.js/.wasm`. Diese Runtime ist für Node.js gebaut und bricht im Browser mit Node-Dateisystemannahmen ab. Deshalb wird sie nicht mehr verwendet.

## Browser-Voraussetzungen

Der Sherpa-Build nutzt WASM-Threads und benötigt `SharedArrayBuffer`.

Lokal funktioniert das über `npm start`, weil `server.mjs` diese Header setzt:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

Für Bereitstellung im Internet braucht der statische Host ebenfalls HTTPS und diese Header. GitHub-Dateivorschau reicht nicht. GitHub Pages ist dafür nur geeignet, wenn die benötigten Header zuverlässig gesetzt werden können; robuste Alternativen sind Hosts mit Header-Konfiguration.

## Datenschutz

Die Runtime-Dateien werden aus dem lokalen Server geladen. Mikrofon-Audio bleibt im Browser. Sprecherprofile bleiben im Arbeitsspeicher der aktuellen Sitzung.
