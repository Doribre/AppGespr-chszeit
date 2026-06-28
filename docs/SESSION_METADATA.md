# Session-Metadaten

Stand: 2026-06-28, Europe/Berlin

## Projekt

- App-Name: Schwätzometer
- Lokaler Arbeitsordner während Erstellung: `C:\Users\brendernb\Documents\App Gesprächsanteile`
- Ziel-Repository auf dem PC: `C:\Users\brendernb\Documents\GitHub\AppGesprächszeit`
- Branch in GitHub Desktop: `main`
- GitHub-Desktop-Konto laut Screenshot: `Doribre`
- Projektziel: nur GitHub. Keine GitLab-Remote, keine GitLab-CI, keine GitLab-Preview fuer dieses Projekt.
- GitHub Pages wurde in den Repository-Settings auf `GitHub Actions` gestellt.

## Erstellt durch

Codex in einer lokalen Desktop-Session.

Wichtig: Codex hatte keinen direkten Zugriff auf GitHub-Credentials und hat keinen Push ausgeführt. Dateien werden in den lokalen GitHub-Desktop-Repositoryordner kopiert. Commit und Push sollen über GitHub Desktop erfolgen.

## Implementierter Stand

- Lokale Browser-App mit WebAudio und Sherpa-ONNX Browser-WASM.
- Offizielle Sherpa-Artefakte aus Release `v1.13.3` gebündelt.
- Keine Transkription, keine Cloud-APIs, kein Audio-Upload.
- 1 bis 7 Teilnehmer.
- Namen werden per Tastatur eingegeben.
- Sichtbare In-App-Kurzanleitung mit nächstem Schritt.
- Personen können während der Vorstellungs-/Stimme-kennenlernen-Phase weiter hinzugefügt werden.
- Teilnehmernamen und Sprechpegel sind farbcodiert.
- 20-Sekunden-Phase `Stimme kennenlernen` pro Profil.
- Lokale In-Memory-Profile.
- Zuhören/Zeitmessung mit VAD.
- Toggle-Button `Zuhören und Zeiten ermitteln` zum Starten/Stoppen der Zeitmessung.
- Live-Audio wird waehrend Sherpa-Rechenlaeufen gepuffert statt verworfen.
- Live-Analysefenster aktuell: 1.25 Sekunden.
- Current Speaker, Scores, Unknown-State.
- Accumulated speaking time.
- Timeline.
- Pie Chart.
- Balkendiagramm.
- Erhöhtes Debugpanel.
- Lokaler Node-Server mit COOP/COEP.
- GitHub-Pages-Workflow in `.github/workflows/pages.yml`.
- GitHub-Pages-Preview nutzt `src/coi.js` und `coi-serviceworker.js`, damit `crossOriginIsolated` auf GitHub Pages moeglich wird.
- Dokumentation und Handoff-Dateien.

## Sherpa-Artefakte

Gebündelt in `vendor/sherpa-onnx/`:

- `sherpa-onnx-speaker-diarization.js`
- `sherpa-onnx-wasm-main-speaker-diarization.js`
- `sherpa-onnx-wasm-main-speaker-diarization.wasm`
- `sherpa-onnx-wasm-main-speaker-diarization.data`

Quelle: `https://github.com/k2-fsa/sherpa-onnx/releases/tag/v1.13.3`

## Validierung

Ausgeführt:

```powershell
npm run check
```

Ergebnis: Node-Syntaxchecks waren sauber.

Noch nötig: Browser-Ladetest mit Mikrofonfreigabe in Chrome/Edge. Der Sherpa-Build benötigt `SharedArrayBuffer`; im Browser muss `crossOriginIsolated` wahr sein.

## Bekannte Einschränkungen

- Keine automatisierten Browser-/Mikrofontests.
- Keine persistente Session-Historie.
- Keine geprüfte produktive Sprecherbiometrie.
- Hosting außerhalb von `localhost` braucht HTTPS und COOP/COEP-Header.

## Keine gespeicherten Geheimnisse

Dieses Repository soll keine Tokens, Passwörter, Mikrofonaufnahmen oder Sprecherprofile enthalten.
