# GitHub Pages Preview

Stand: 2026-06-28

## Ziel

Schwaetzometer wird nur ueber GitHub bereitgestellt. Die Preview soll als GitHub-Pages-Seite laufen und alle noetigen statischen Dateien enthalten:

- `index.html`
- `src/`
- `vendor/sherpa-onnx/`
- `coi-serviceworker.js`
- Projektdokumentation

Audio wird dabei nicht zu GitHub hochgeladen. Mikrofon, VAD, Sherpa-ONNX-WASM, Sprecherprofile, Scores und Diagramme laufen im Browser der Person, die die Seite oeffnet.

## Deployment

`.github/workflows/pages.yml` nutzt den offiziellen GitHub-Actions-Weg fuer Pages:

1. Checkout.
2. Node-Syntaxcheck mit `npm run check`.
3. Statische Dateien nach `_site/` kopieren.
4. Pages-Artefakt hochladen.
5. Nach GitHub Pages deployen.

Nach einem Push auf `main` sollte GitHub Actions die Preview bauen.

## COOP/COEP und GitHub Pages

Sherpa-ONNX-WASM nutzt `SharedArrayBuffer`. Browser erlauben das nur, wenn die Seite cross-origin-isolated ist. Lokal erledigt das `server.mjs` ueber echte HTTP-Header:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

GitHub Pages erlaubt diese Header nicht als normale Projektkonfiguration. Deshalb registriert `src/coi.js` auf der Pages-Seite einen Service Worker. `coi-serviceworker.js` liefert die Seitenressourcen danach mit den noetigen COOP/COEP-Headern aus und laedt die Seite einmal neu.

## Pruefung

Nach dem Deployment die GitHub-Pages-URL oeffnen und in der Browser-Konsole pruefen:

```js
crossOriginIsolated === true
```

Zusaetzlich muss im Debug-Panel stehen:

```text
Sherpa-ONNX Browser-WASM bereit
```

Wenn `crossOriginIsolated` false bleibt, kann die UI zwar laden, aber die echte Sherpa-Engine startet nicht.
