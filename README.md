# Fliesenreich

Bau-/Management-Spiel mit Tiles. Platzhalter-Grafiken: PNGs als `assets/tiles/<id>.png` ablegen (z. B. `wald.png`), sonst Farbe + Emoji.

## Sockel-Prototyp

Jede Karte wird selbst platziert. Grüne Felder liegen an mindestens einem freien Sockel, der zum Typ der Karte passt. Aktuell haben alle Tiles oben und unten Landschafts-Sockel (L), rechts einen Industrie-Sockel (I) und links einen reservierten Sockel (–). Die übrigen angrenzenden Seiten müssen nicht passen. Boni zählen weiterhin für alle passenden Nachbarn einschließlich diagonaler Felder und werden einmal beim Platzieren ausgezahlt.

Die Kategorien und Sockel stehen in `src/config.js`. Ein Tile kann mit `sockets` die Standard-Sockel in der Reihenfolge oben, rechts, unten, links überschreiben.
