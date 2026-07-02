# Wiederherstellung

Diese Datei beschreibt, wie das Projekt nach einem neu aufgesetzten PC wiederhergestellt werden kann.

Stand: 2026-07-02

## Voraussetzungen

- Node.js installieren.
- GitHub Desktop installieren.
- In GitHub Desktop mit dem GitHub-Konto anmelden.
- Repository `Doribre/AppGespr-chszeit` von GitHub klonen.
- Chrome oder Edge zum Testen verwenden.

Öffentliche Preview:

```text
https://doribre.github.io/AppGespr-chszeit/
```

## Wiederherstellung mit GitHub Desktop

1. GitHub Desktop öffnen.
2. `File` -> `Clone repository...`
3. Repository `Doribre/AppGespr-chszeit` auswählen.
4. Lokalen Zielordner wählen, z. B.:

```text
C:\Users\brendernb\Documents\GitHub\AppGesprächszeit
```

5. `Clone` klicken.

## Start der App

Im Repositoryordner:

```powershell
npm run check
```

Danach:

```powershell
npm start
```

Dann in Chrome oder Edge öffnen:

```text
http://127.0.0.1:5173
```

Wenn Port `5173` belegt ist, zeigt der Server im Terminal den tatsächlich verwendeten Port an.

## Stand prüfen

Nach dem Klonen sollte `main` den aktuellen Stand enthalten. Die wichtigsten Dateien zur Orientierung:

- `docs/VERSION_0_1.md`: Snapshot der Version 0.1.
- `docs/SESSION_METADATA.md`: aktueller Projekt- und GitHub-Stand.
- `docs/GITHUB_PAGES.md`: Preview und COOP/COEP-Hinweise.

Prüfen, ob der Arbeitsbaum sauber ist:

```powershell
git status --short
```

Aktuelle Commits ansehen:

```powershell
git log --oneline -5
```

## Sherpa-Dateien

Die benötigten Sherpa-ONNX-Browserdateien liegen im Repository unter `vendor/sherpa-onnx/`. Nach dem Klonen muss kein Audio- oder Modell-Upload eingerichtet werden.

Die App benötigt `SharedArrayBuffer`. Wenn die Engine nicht bereit wird, im Browser prüfen:

```js
crossOriginIsolated
```

Der Wert muss `true` sein. Der lokale Server setzt dafür COOP/COEP-Header.

## Wichtige Dateien nach dem Klonen

- `README.md`: Einstieg.
- `docs/PROJECT_CONTEXT.md`: Produkt- und Anforderungskontext.
- `docs/ARCHITECTURE.md`: technische Struktur.
- `docs/SHERPA_BROWSER_BUILD.md`: Sherpa-ONNX-Browserartefakte.
- `docs/DECISIONS.md`: wichtige Entscheidungen.
- `docs/SESSION_METADATA.md`: Erstellungskontext und Stand.
- `docs/ROADMAP.md`: nächste sinnvolle Schritte.
- `AGENTS.md`: Handoff für zukünftige Agenten.
- `.github/copilot-instructions.md`: GitHub-Copilot-Kontext.

## Für zukünftige Codex-Sessions

Nach dem Klonen zuerst lesen:

1. `README.md`
2. `AGENTS.md`
3. `docs/PROJECT_CONTEXT.md`
4. `docs/ARCHITECTURE.md`
5. `docs/SHERPA_BROWSER_BUILD.md`
6. `docs/DECISIONS.md`
7. `docs/SESSION_METADATA.md`
8. `docs/VERSION_0_1.md`

Danach `npm run check` ausführen.
