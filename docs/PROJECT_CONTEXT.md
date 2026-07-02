# Projektkontext

Stand: 2026-07-02

## Ziel

Dieses Repository enthält Schwätzometer, einen browserbasierten technischen MVP zur Anzeige von Gesprächsanteilen in einem laufenden Gespräch.

Die App läuft lokal im Browser, verwendet Mikrofon-Audio, bildet temporäre Sprecherprofile aus `Stimme kennenlernen` und zeigt danach an, wer ungefähr welchen Redeanteil hat. Sie nutzt Sherpa-ONNX Browser-WASM, ergänzt in Stufe 2 lokale Session-Embeddings für den Profilvergleich und transkribiert nicht.

## Anforderungen

- Vollständig lokal im Browser.
- Mikrofoninput über WebAudio und `getUserMedia`.
- 1 bis 7 Teilnehmer.
- Namen werden per Tastatur eingegeben, damit keine Spracherkennung nötig ist.
- Jede Person hat eine feste Farbe; Namen und Sprechpegel nutzen diese Farbe.
- Pro Teilnehmer adaptive Phase `Stimme kennenlernen`: mindestens 10 Sekunden, maximal 30 Sekunden.
- Speaker-Profile nur im Arbeitsspeicher der aktuellen Session.
- Profilvergleich in Stufe 2 über lokale Audio-Embeddings plus Sherpa-Diarization-Scores.
- Keine Transkription.
- Kein Audio-Upload.
- Keine Cloud-APIs.
- Keine persistente Speicherung in Version 1.
- VAD zum Ignorieren von Stille.
- Kurze Analysefenster von etwa 1 bis 2 Sekunden.
- Vergleich jedes Sprachfensters gegen eingeschriebene Sprecher.
- Anzeige von aktuellem Sprecher, Scores, Unknown-State, Redezeit, Timeline, Pie Chart und Balkendiagramm.
- Debugpanel mit Sample Rate, Modelstatus, Latenz, VAD, Rohscores.
- Speaker Engine hinter einem Interface isolieren, damit die Logik später nach Android/iOS verschoben werden kann.

## Produktidee

Zu Beginn legt die moderierende Person mindestens eine Person an und tippt den Namen ein. Während der Vorstellungsrunde können weitere Personen ergänzt werden, bis maximal 7 Teilnehmer in der Session sind. Danach führt die App durch `Stimme kennenlernen`: Jede Person spricht so lange zur Stimmprobe, bis Pegel, verwertbare Stimme und Abwechslung reichen, mindestens 10 Sekunden und maximal 30 Sekunden. Daraus entsteht ein temporäres Sprecherprofil.

Nach `Stimme kennenlernen` startet die Zeitmessung über den Button `Zuhören und Zeiten ermitteln`. Derselbe Button stoppt das Zuhören wieder, damit Zeiten eingefroren bleiben oder das Gespräch beendet werden kann. Die App ignoriert Stille und zählt erkannte Sprachfenster; unsichere Sprachfenster werden als `Unknown` mitgezählt.

Die Oberfläche enthält eine kurze Ablaufhilfe und einen Hinzufügen-Button, der während der Vorstellungs-/Stimme-kennenlernen-Phase nutzbar bleibt.

## Nicht-Ziele in Version 1

- Keine Speech-to-Text-Transkription.
- Keine Speicherung von Audio oder Profilen auf Platte.
- Keine Cloud-Modelle.
- Keine Benutzerkonten.
- Keine Meeting-Integration.
- Keine rechtssichere oder medizinisch/arbeitsrechtlich belastbare Sprecheridentifikation.

## Datenschutz- und Sicherheitslinie

Audio bleibt lokal im Browserprozess. Die App enthält keine Upload-Logik, keine Server-API für Audio und keine persistenten Sprecherprofile. Der lokale Node-Server dient nur zum Ausliefern statischer Dateien und der Sherpa-WASM-Artefakte.
