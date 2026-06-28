# Roadmap

## Nächster technischer Schritt

Echten Sherpa-Browserbetrieb stabilisieren:

- Browser-Ladetest in Chrome/Edge mit `crossOriginIsolated === true`.
- Enrollment-Qualität mit echten Sherpa-Clustern sichtbar machen.
- Schwellenwerte für `Unknown` und Profilähnlichkeit empirisch kalibrieren.
- Mehr-Audio-Dialog für sehr ähnliche Stimmen testen.
- Performance bei 1 bis 7 Personen messen.

## Kurzfristig

- UI-Zustände für Mikrofonfehler und Browser-Permissions verbessern.
- Ladefortschritt der 45-MB-`.data`-Datei sichtbarer machen.
- Timeline-Segmente mit Start-/Endzeit anzeigen.
- Unknown-Zeit separat anzeigen.
- Testdaten mit lokalen Audio-Samples ergänzen.

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
