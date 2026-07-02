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

## 10. Tolerantere Live-Erkennung

Die Live-Erkennung nutzt jetzt einen rollenden 4-Sekunden-Kontext statt nur ein einzelnes 1.25-Sekunden-Fenster. Die Diarization wird in der Live-Erkennung auf die Anzahl der bekannten Profile geclustert. Kurze unsichere Fenster werden ueber eine Hysterese geglaettet: direkte Entscheidungen, tentative Entscheidungen und ein kurzer Hold auf den letzten stabilen Sprecher.

Grund: In echten Gespraechen sind Stimmen leiser, ueberlappen sich teilweise und der Abstand zum Mikrofon schwankt. Harte Einzel-Fenster-Entscheidungen erzeugten zu oft `Unknown` und dadurch zu selten aktualisierte Redeanteile.

## 11. Stoppen finalisiert die Warteschlange

Beim Stoppen der Zeitmessung werden bereits aufgenommene, aber noch nicht von Sherpa verarbeitete Audio-Bloecke nicht mehr verworfen. Die App zeigt `Zuhoeren wird beendet`, verarbeitet die Restwarteschlange und friert die Diagramme danach ein.

Grund: Sonst fehlten die letzten Sekunden eines Gespraechs in Tortengrafik, Balken und Timeline.

## 12. Stufe-2-Erkennung kombiniert Profil-Embeddings und Sherpa-Cluster

Die Live-Erkennung nutzt nicht mehr nur den Sherpa-Cluster-Treffer zwischen Profilprobe und Live-Fenster. Beim `Stimme kennenlernen` werden pro Person mehrere kurze lokale Audio-Embeddings im Arbeitsspeicher erzeugt. Im Live-Betrieb berechnet die Engine fuer den rollenden Sprachkontext ein neues Embedding, vergleicht es mit allen Profilen und kombiniert diesen Score mit dem Sherpa-Diarization-Score.

Grund: In echten Gespraechen erkannte die reine Cluster-Zuordnung passende Stimmen zu selten, besonders bei wechselndem Mikrofonabstand und aehnlichen Stimmen. Der zusaetzliche Profilvergleich gibt der App ein stabileres Sitzungssignal, ohne Transkription, Upload oder persistente Sprecherprofile einzufuehren.

Grenze: Der aktuelle Sherpa-Browser-Wrapper exponiert das interne `embedding.onnx` nicht als separate JavaScript-Speaker-Verification-API. Stufe 2 bleibt deshalb eine lokale Browser-Schicht ueber der offiziellen Sherpa-Diarization-Runtime.

## 13. Adaptive Stimme-kennenlernen-Phase

Die Stimmprobe ist nicht mehr fest auf 20 Sekunden gesetzt. Die UI sammelt mindestens 10 Sekunden Aufnahme, bewertet Pegel, verwertbare Stimme und unterschiedliche Sprachabschnitte, prüft bei guter Probe automatisch und stoppt spätestens nach 30 Sekunden.

Grund: Anwender sollen während des Einlernens direkt verstehen, was noch fehlt: lauter sprechen, weniger Pausen oder abwechslungsreichere Sätze. Gute Proben sind dadurch schneller fertig, schwierige Stimmen bekommen mehr Material, ohne dass Audio gespeichert oder hochgeladen wird.
