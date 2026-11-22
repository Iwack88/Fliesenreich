# Fliesenreich

Bau-/Management-Spiel mit Tiles. Platzhalter-Grafiken: PNGs als `assets/tiles/<id>.png` ablegen (z. B. `wald.png`), sonst Farbe + Emoji.

## Spielfeld

Das Spielfeld startet mit 8×8 Feldern, einem Start-Tile und 12 zufälligen Gras-, Erde- oder Wasser-Tiles. Die vier Felder direkt neben dem Start-Tile bleiben frei. Grüne Felder sind frei und grenzen seitlich an ein vorhandenes Tile; dort können Karten unabhängig von ihrem Typ platziert werden. Boni zählen weiterhin für passende Nachbarn einschließlich diagonaler Felder und werden einmal beim Platzieren ausgezahlt.

Im Shop kann das Spielfeld einmalig für 30 Gold auf 16×16 erweitert werden; dabei entstehen 36 zufällige Tiles ausschließlich auf der neuen Fläche. Die freien Felder der generierten Fläche bleiben zusammenhängend. Zahlen und Kosten stehen in `src/config.js`. Für den Prototyp beginnt ein neuer Spielstand; der alte bleibt im Browser gespeichert.

Mit **Neues Spiel** lässt sich nach einer Bestätigung der aktuelle Spielstand zurücksetzen und eine neue Welt erzeugen. Das Raster erscheint nur, solange eine Karte zum Platzieren gezogen ist.

## Kartenpacks

Das Landschafts-Pack enthält Gras, Erde, Wasser, Feld und Wald. Das teurere Entdecker-Pack enthält zusätzlich selten Windmühlen und Holzfäller. Jedes Pack enthält fünf unabhängig gezogene Karten; die im Shop angegebenen Chancen gelten jeweils pro Karte, nicht pro Pack. Die Gewichte und Preise stehen in `src/config.js`.
