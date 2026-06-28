# Schwätzometer

Browser-basierter technischer MVP für lokale Sprecheranteil-Erkennung ohne Transkription.

## Eigenschaften

- Läuft lokal im Browser über `getUserMedia`, WebAudio und Sherpa-ONNX WebAssembly.
- Keine Cloud-APIs, kein Audio-Upload, keine Speech-to-Text-Verarbeitung.
- 1 bis 7 Teilnehmer.
- Namen werden per Tastatur eingegeben, nicht per Sprache erkannt.
- Jede Person hat eine feste Farbe; Namen und Sprechpegel nutzen diese Farbe.
- 20 Sekunden `Stimme kennenlernen` pro Teilnehmer.
- In-Memory-Sprecherprofile nur für die aktuelle Session.
- Button `Zuhören und Zeiten ermitteln` startet und stoppt die Zeitmessung.
- VAD ignoriert Stille.
- Anzeige von aktuellem Sprecher, Scores, Unknown-State, Redezeit, Timeline, Pie Chart, Balkendiagramm und Debug-Werten.

## Start

```powershell
npm start
```

Dann in Chrome oder Edge öffnen:

```text
http://127.0.0.1:5173
```

Falls Port `5173` belegt ist, nimmt der Server automatisch den nächsten freien Port.

## Sherpa-ONNX Browser-WASM

Die aktive Engine ist `SherpaOnnxWasmSpeakerEngine` in `src/audio/engine.js`.

Gebündelte Runtime-Dateien:

- `vendor/sherpa-onnx/sherpa-onnx-speaker-diarization.js`
- `vendor/sherpa-onnx/sherpa-onnx-wasm-main-speaker-diarization.js`
- `vendor/sherpa-onnx/sherpa-onnx-wasm-main-speaker-diarization.wasm`
- `vendor/sherpa-onnx/sherpa-onnx-wasm-main-speaker-diarization.data`

Quelle: offizieller Release `v1.13.3` aus `k2-fsa/sherpa-onnx`, Asset `sherpa-onnx-wasm-simd-v1.13.3-speaker-diarization.tar.bz2`.

Wichtig: Der Build benötigt `SharedArrayBuffer`. Deshalb muss die App über den lokalen Server oder einen HTTPS-Host mit COOP/COEP-Headern laufen. Direktes Öffnen der HTML-Datei reicht nicht.

## Projektdokumentation

- [Projektkontext](docs/PROJECT_CONTEXT.md)
- [Architektur](docs/ARCHITECTURE.md)
- [Sherpa Browser Build](docs/SHERPA_BROWSER_BUILD.md)
- [GitHub Pages Preview](docs/GITHUB_PAGES.md)
- [Entscheidungen](docs/DECISIONS.md)
- [Session-Metadaten](docs/SESSION_METADATA.md)
- [Wiederherstellung nach Neuaufsetzen](docs/RECOVERY.md)
- [Roadmap](docs/ROADMAP.md)
- [Agent-Handoff](AGENTS.md)

## Einschränkung

Die App testet jetzt das echte Sherpa-ONNX-Browsermodell. Die derzeitige Zuordnung nutzt die Diarization-Cluster von Sherpa als lokales Vergleichssignal gegen die 20-Sekunden-Stimmproben. Das ist ein technischer MVP, keine geprüfte Sprecherbiometrie.
