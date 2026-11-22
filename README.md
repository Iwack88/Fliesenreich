# Fliesenreich

Bau-/Management-Spiel mit Tiles. Platzhalter-Grafiken: PNGs als `assets/tiles/<id>.png` ablegen (z. B. `wald.png`), sonst Farbe + Emoji.

## Spielfeld

Das Spielfeld startet mit 8×8 Feldern, einem Workshop in der Mitte und 12 zufälligen Gras-, Erde- oder Wasser-Tiles. Die vier Felder direkt neben dem Start-Tile bleiben frei. Grüne Felder sind frei und grenzen seitlich an ein vorhandenes Tile; dort können Karten unabhängig von ihrem Typ platziert werden. Boni zählen für passende Nachbarn einschließlich diagonaler Felder.

Im Shop kann das Spielfeld einmalig für 30 Gold auf 16×16 erweitert werden; dabei entstehen 36 zufällige Tiles ausschließlich auf der neuen Fläche. Die freien Felder der generierten Fläche bleiben zusammenhängend.

Mit **Neues Spiel** lässt sich nach einer Bestätigung der aktuelle Spielstand zurücksetzen und eine neue Welt erzeugen. Das Raster erscheint nur, solange eine Karte zum Platzieren gezogen ist.

Neue Spiele starten zum Testen mit 100 Gold, je 8 Holz und Korn sowie 12 Karten, darunter eine Lagerhalle. Bestehende Spielstände behalten ihre Welt und erhalten einmalig die Startrohstoffe sowie, falls nötig, eine Workshop-Karte am Deckanfang.

## Produktion und Workshops

Alle 10 Sekunden erzeugen Wald und Holzfäller je 1 Holz, Feld und Windmühle je 1 Korn. Jeder benachbarte Wald erhöht die Holzfäller-Produktion um 1, jedes Feld die einer Windmühle um 1. Ein Haus/Haus-Paar erzeugt 1 Gold und ein Haus/Taverne-Paar 2 Gold pro Intervall; jedes Paar zählt einmal. Holz und Korn sind jeweils auf 100 begrenzt. Produktion und Workshop-Timer laufen auch bei geschlossenem Spiel anhand der vergangenen Zeit weiter.

Unter **Workshop** lassen sich alle Workshops finden und Packs herstellen: Landschaft kostet 3 Holz und 2 Korn und dauert 30 Sekunden, Entdecker 6 Holz und 5 Korn und dauert 60 Sekunden. Jede benachbarte Lagerhalle verkürzt die Dauer bei Produktionsbeginn um 20 %, höchstens um 60 %. Ein Workshop produziert ein Pack gleichzeitig. Fertige Packs landen automatisch im **Inventar** und werden dort geöffnet; ihre Karten kommen ans Deckende. Der direkte Packverkauf im Shop ist deaktiviert, die Spielfelderweiterung bleibt verfügbar.

Das Landschafts-Pack enthält Gras, Erde, Wasser, Feld, Wald, Haus und Lagerhalle. Das Entdecker-Pack enthält zusätzlich Holzfäller, Windmühlen, Tavernen, Workshops und Joker. Beide Packs enthalten fünf Karten, mindestens zwei davon nicht Gras, Erde oder Wasser. Die Übersicht zeigt die Chancen je zufälliger Karte. Wenn keine platzierbaren Karten oder Packs vorhanden sind und die benötigten Rohstoffe nicht produziert werden können, bietet ein freier Workshop ein kostenloses Starthilfe-Pack mit Wald und Feld an.

## Joker

Ein neuer Spielstand enthält je einen Lösch- und Verwandlungsjoker; im Entdecker-Pack können beide ebenfalls vorkommen. Eine gezogene Jokerkarte wird durch Antippen eines vorhandenen Tiles verbraucht. Löschen entfernt das Tile ohne Rückzahlung. Verwandeln wählt zufällig einen anderen Typ aus allen Tile-Typen; neue Nachbarschaften wirken auf die zukünftige Produktion. Das letzte Tile, der letzte Workshop und beschäftigte Workshops sind geschützt. Joker können ans Deckende gelegt werden.
