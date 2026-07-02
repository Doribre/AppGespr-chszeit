# Version 0.1 Snapshot

Stand: 2026-07-02, Europe/Berlin

Diese Datei beschreibt den Stand, der nach einem neu aufgesetzten PC aus GitHub wiederhergestellt werden soll.

## Repository

- GitHub: `https://github.com/Doribre/AppGespr-chszeit`
- Preview: `https://doribre.github.io/AppGespr-chszeit/`
- Branch: `main`
- Lokaler Zielordner auf diesem PC: `C:\Users\brendernb\Documents\GitHub\AppGesprächszeit`
- Projekt bleibt GitHub-only. Keine GitLab-Remote und keine GitLab-Preview.

## Produktstand

- Browser-MVP für lokale Redeanteil-Erkennung ohne Transkription.
- 1 bis 7 Teilnehmer pro Session.
- Namen werden per Tastatur eingegeben.
- Jede Person hat eine feste Farbe für Name, Pegel und Diagramme.
- `Stimme kennenlernen` ist adaptiv: mindestens 10 Sekunden, maximal 30 Sekunden.
- Die Einlernphase zeigt direkte Hinweise: lauter sprechen, weiter sprechen, verwertbare Stimme, Abwechslung und prüfbares Profil.
- `Zuhören und Zeiten ermitteln` startet und stoppt die Zeitmessung.
- Redeanteile werden als aktueller Sprecher, Scores, Timeline, Pie Chart und Balkendiagramm angezeigt.
- Debug zeigt Sample Rate, Modelstatus, Latenz, VAD, Scores und Profilvergleichswerte.

## Technischer Stand

- App läuft vollständig lokal im Browser.
- Mikrofonzugriff über `getUserMedia` und WebAudio.
- Aktive Engine: `SherpaOnnxWasmSpeakerEngine`.
- Aktive Sherpa-ONNX-Runtime:
  - `vendor/sherpa-onnx/sherpa-onnx-speaker-diarization.js`
  - `vendor/sherpa-onnx/sherpa-onnx-wasm-main-speaker-diarization.js`
  - `vendor/sherpa-onnx/sherpa-onnx-wasm-main-speaker-diarization.wasm`
  - `vendor/sherpa-onnx/sherpa-onnx-wasm-main-speaker-diarization.data`
- Stufe 2 kombiniert Sherpa-Diarization mit lokalen, nicht persistenten Session-Embeddings aus den Stimmproben.
- Lokaler Server `server.mjs` setzt COOP/COEP-Header für `SharedArrayBuffer`.
- GitHub Pages nutzt `src/coi.js` und `coi-serviceworker.js`, damit die Preview cross-origin-isolated laufen kann.

## Datenschutzlinie

- Keine Cloud-APIs.
- Kein Audio-Upload.
- Keine Speech-to-Text-Transkription.
- Keine gespeicherten Sprecherprofile.
- Keine versteckte Browser-Persistenz.
- Keine Tokens, Passwörter oder Mikrofonaufnahmen im Repository.

## Validierung

Vor dem Sichern dieses Stands wurde ausgeführt:

```powershell
npm run check
```

Der Node-Syntaxcheck war sauber. GitHub Actions `Deploy GitHub Pages` lief für den vorherigen Code-Stand erfolgreich durch. Nach jedem neuen Push sollte der Workflow erneut geprüft werden.

## Wiederaufnahme nach Neuaufsetzen

1. GitHub Desktop installieren und mit `Doribre` anmelden.
2. Repository `Doribre/AppGespr-chszeit` klonen.
3. Im Repository `npm run check` ausführen.
4. Lokal mit `npm start` starten.
5. In Chrome oder Edge `http://127.0.0.1:5173` öffnen.
6. In der Browser-Konsole prüfen:

```js
crossOriginIsolated === true
```

7. Auf der Preview prüfen, ob die Engine im Debug-Panel als Sherpa-ONNX Browser-WASM bereit angezeigt wird.

## Wichtige nächste Arbeiten

- Browser-Test der Pages-Preview nach vollständiger GitHub-Pages-Propagation.
- Echte Gesprächstests mit ähnlich klingenden Stimmen und Debugwerten.
- Schwellwerte für Unknown, Profilähnlichkeit und Hold-Verhalten anhand echter Sitzungen kalibrieren.
- Android-Version 0.1 nativ konzipieren, aber weiterhin ohne Transkription, Upload oder persistente Sprecherprofile.
