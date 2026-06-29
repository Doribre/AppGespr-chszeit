# Roadmap

## Nächster technischer Schritt

Stufe-2-Erkennung empirisch kalibrieren:

- Browser-Ladetest in Chrome/Edge mit `crossOriginIsolated === true`.
- Testgespräche mit ähnlichen Stimmen sammeln, ohne Audio zu speichern.
- Debugwerte `embeddingRawScores`, `embeddingScores`, `diarizationScores` und `margin` während echter Gespräche beobachten.
- Schwellenwerte für `Unknown`, Profilähnlichkeit und `hold-last` empirisch kalibrieren.
- Mehr-Audio-Dialog für sehr ähnliche Stimmen testen.
- Performance bei 1 bis 7 Personen messen.

## Kurzfristig

- UI-Zustände für Mikrofonfehler und Browser-Permissions verbessern.
- Ladefortschritt der 45-MB-`.data`-Datei sichtbarer machen.
- Timeline-Segmente mit Start-/Endzeit anzeigen.
- Unknown-Zeit separat anzeigen.
- Testdaten mit lokalen Audio-Samples ergänzen.
- Prüfen, ob ein zukünftiger Sherpa-Browser-Build eine direkte Speaker-Embedding-/Verification-API bereitstellt.

## Mittelfristig

- Web Worker oder AudioWorklet für die Audiofenster-Verwaltung prüfen.
- Browser-Kompatibilität dokumentieren.
- Mobile-Browser-Layout prüfen.
- Export einer anonymisierten Session-Zusammenfassung ohne Audio.
- Hosting-Anleitung für HTTPS mit COOP/COEP ergänzen.

## Langfristig

- Native Android/iOS-Engine mit derselben Interface-Form.
- On-device Modellpakete.
- Bessere Sprecherdiarisierung und Overlap-Erkennung.
- Optional lokale Meeting-Protokoll-Metadaten ohne Transkription.
