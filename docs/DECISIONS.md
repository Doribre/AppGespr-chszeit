# Technische Entscheidungen

Stand: 2026-06-28

## 1. Keine Cloud, keine Transkription

Die App verarbeitet Audio nur lokal. Es gibt keine Speech-to-Text-Logik und keine Netzwerkübertragung von Audio.

Grund: Die Kernanforderung ist Redeanteil-Erkennung ohne Transkription und ohne Upload.

## 2. Browser-MVP ohne Build-Tool

Das Projekt nutzt native ES-Module, CSS und einen kleinen Node-Server statt Vite/React.

Grund: Der Workspace war leer, und ein dependency-freier MVP ist leichter wiederherstellbar, prüfbar und lokal nutzbar.

## 3. Echte Sherpa-ONNX-Browser-Runtime

Die aktive Engine ist `SherpaOnnxWasmSpeakerEngine` mit dem offiziellen Browser-WASM-Release `sherpa-onnx-wasm-simd-v1.13.3-speaker-diarization`.

Grund: Wir wollen das Modell testen, das später auch in der App verwendet werden soll. Deshalb gibt es keinen versteckten Fingerprint-Fallback.

## 4. Engine-Interface bleibt stabil

Die Speaker-Logik ist hinter `SpeakerShareEngine` isoliert.

Grund: Die UI soll nicht an eine konkrete Runtime gebunden sein. Später kann eine native Android-/iOS-Engine dieselbe Schnittstelle erfüllen.

## 5. In-Memory-only Profile

Stimmprofile werden nur in JavaScript-Objekten gehalten.

Grund: Version 1 soll keine personenbezogenen Sprecherprofile dauerhaft speichern.

## 6. Sofortige Live-Anzeige

Zuhören und Zeitmessung können direkt nach klaren Stimmprofilen gestartet werden und zeigen Ergebnisse sofort an.

Grund: Eine verzögerte Anzeige war im Test verwirrend und hatte für den aktuellen MVP keinen praktischen Mehrwert.

## 7. GitHub-Dokumentation als Repository-Dateien

Projektkontext, Architektur, Entscheidungen, Handoff und Recovery werden als Markdown-Dateien im Repository gespeichert.

Grund: Wenn der PC neu aufgesetzt werden muss, können Code und Kontext über GitHub wiederhergestellt werden.

## 8. Live-Audio puffern statt verwerfen

Die Live-Steuerung sammelt neue Audio-Bloecke in einer Warteschlange, waehrend Sherpa-ONNX-WASM ein Fenster verarbeitet. Alte Rechenlaeufe sind ueber eine Sitzungs-ID entkoppelt, damit sie nach Stop/Neustart keine Zeiten mehr schreiben.

Grund: Sherpa-Diarization ist spuerbar langsamer als einfache Feature-Vergleiche. Ohne Warteschlange koennen Audio-Bloecke waehrend der Berechnung verloren gehen, wodurch die Anzeige traeger und die Zeitmessung ungenauer wird.

## 9. GitHub Pages Preview mit Service Worker

Die oeffentliche Preview wird nur ueber GitHub Pages bereitgestellt. Weil GitHub Pages COOP/COEP nicht als Projekt-Header konfigurieren laesst, registriert `src/coi.js` einen lokalen Service Worker. `coi-serviceworker.js` liefert die statischen Seitenressourcen danach mit den noetigen Cross-Origin-Isolation-Headern aus und laedt die Seite einmal neu.

Grund: Sherpa-ONNX-WASM benoetigt `SharedArrayBuffer`. Ohne Cross-Origin-Isolation laedt die UI zwar, aber die echte Engine startet nicht.
