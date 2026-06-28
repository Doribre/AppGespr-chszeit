# Wiederherstellung

Diese Datei beschreibt, wie das Projekt nach einem neu aufgesetzten PC wiederhergestellt werden kann.

## Voraussetzungen

- Node.js installieren.
- GitHub Desktop installieren.
- In GitHub Desktop mit dem GitHub-Konto anmelden.
- Repository `AppGesprächszeit` von GitHub klonen.
- Chrome oder Edge zum Testen verwenden.

## Wiederherstellung mit GitHub Desktop

1. GitHub Desktop öffnen.
2. `File` -> `Clone repository...`
3. Repository `Doribre/AppGesprächszeit` auswählen, falls es unter diesem Konto veröffentlicht wurde.
4. Lokalen Zielordner wählen, z. B.:

```text
C:\Users\brendernb\Documents\GitHub\AppGesprächszeit
```

5. `Clone` klicken.

## Start der App

Im Repositoryordner:

```powershell
npm start
```

Dann in Chrome oder Edge öffnen:

```text
http://127.0.0.1:5173
```

Wenn Port `5173` belegt ist, zeigt der Server im Terminal den tatsächlich verwendeten Port an.

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

Danach `npm run check` ausführen.
