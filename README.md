# Fliesenreich

Bau-/Management-Spiel mit Tiles. Platzhalter-Grafiken: PNGs als `assets/tiles/<id>.png` ablegen (z. B. `wald.png`), sonst Farbe + Emoji.

## Sockel-Prototyp

Jede Karte wird selbst platziert. Grüne Felder liegen an mindestens einem freien Sockel, der zum Typ der Karte passt. Aktuell hat jedes Tile zwei Landschafts-Sockel, einen Industrie-Sockel und einen reservierten Sockel, deren Seiten zufällig bestimmt und im Spielstand gespeichert werden. Die übrigen angrenzenden Seiten müssen nicht passen. Boni zählen weiterhin für alle passenden Nachbarn einschließlich diagonaler Felder und werden einmal beim Platzieren ausgezahlt. Kann eine Karte nicht platziert werden, lässt sie sich ans Deckende legen.

Die Kategorien und Sockel stehen in `src/config.js`. Ein Tile-Typ kann mit `sockets` die Zusammensetzung der zufällig verteilten Standard-Sockel überschreiben.
