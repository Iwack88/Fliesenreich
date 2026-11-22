# Fliesenreich

Bau-/Management-Spiel mit Tiles. Platzhalter-Grafiken: PNGs als `assets/tiles/<id>.png` ablegen (z. B. `wald.png`), sonst Farbe + Emoji.

## Spielfeld

Das Spielfeld startet mit 8×8 Feldern, einem Workshop, einem benachbarten Wachturm, zwei Banditencamps und 12 zufälligen Gras-, Erde- oder Wasser-Tiles. Die übrigen drei Felder direkt neben dem Workshop bleiben frei. Grüne Felder sind frei und grenzen seitlich an ein vorhandenes Tile; dort können Karten unabhängig von ihrem Typ platziert werden. Boni zählen für passende Nachbarn einschließlich diagonaler Felder.

Im Shop kann das Spielfeld einmalig für 30 Gold auf 16×16 erweitert werden; dabei entstehen 36 zufällige Tiles und zwei Banditencamps ausschließlich auf der neuen Fläche. Die freien Felder der generierten Fläche bleiben zusammenhängend.

Mit **Neues Spiel** lässt sich nach einer Bestätigung der aktuelle Spielstand zurücksetzen und eine neue Welt erzeugen. Das Raster erscheint nur, solange eine Karte zum Platzieren gezogen ist.

Neue Spiele starten zum Testen mit 100 Gold, je 8 Holz und Korn sowie 12 Karten, darunter eine Lagerhalle. Bestehende Spielstände behalten ihre Welt und erhalten einmalig eine Wachturm-Karte am Deckanfang sowie eine Banditen-Niete am Deckende. Ältere Spielstände ohne Rohstoffe erhalten zusätzlich Startrohstoffe und bei Bedarf eine Workshop-Karte.

## Produktion und Workshops

Alle 10 Sekunden erzeugen Wald und Holzfäller je 1 Holz, Feld und Windmühle je 1 Korn. Jeder benachbarte Wald erhöht die Holzfäller-Produktion um 1, jedes Feld die einer Windmühle um 1. Ein Haus/Haus-Paar erzeugt 1 Gold und ein Haus/Taverne-Paar 2 Gold pro Intervall; jedes Paar zählt einmal. Holz und Korn sind jeweils auf 100 begrenzt. Produktion und Workshop-Timer laufen auch bei geschlossenem Spiel anhand der vergangenen Zeit weiter.

Beim Antippen eines Tiles bleiben es und seine direkten Bonus-Partner hervorgehoben; andere Tiles werden deutlich ausgegraut. Die Detailansicht zeigt den aktuellen Ertrag mit Basis und Nachbarschaftsbonus sowie bei Workshops die gebufften Herstellungszeiten. Gold-Erträge beziehen sich auf die gemeinsamen Paare und zählen nicht doppelt.

**Warehouse** zeigt den Bestand aller Ressourcen (Gold, Holz und Korn). Beim Antippen einer Ressource erscheint der Gesamtertrag pro Tick (10 Sekunden), inklusive aller Nachbarschaftsboni. Bei Holz und Korn wird zusätzlich angezeigt, wie viel bei aktuellem Lagerstand noch ins Lager passt. Die Übersicht aktualisiert sich während sie geöffnet ist.

Unter **Workshop** lassen sich alle Workshops finden und Packs herstellen: Landschaft kostet 3 Holz und 2 Korn und dauert 30 Sekunden, Entdecker 6 Holz und 5 Korn und dauert 60 Sekunden, **HumanCity** 8 Holz und 6 Korn und dauert 90 Sekunden. Jede benachbarte Lagerhalle verkürzt die Herstellungszeit um 20 %, höchstens um 60 %. Änderungen an den Lagerhallen wirken auch auf die verbleibende Zeit bereits laufender Produktionen. Ein Workshop produziert ein Pack gleichzeitig. Fertige Packs landen automatisch im **Inventar** und werden dort geöffnet; ihre Karten kommen ans Deckende. Der direkte Packverkauf im Shop bleibt deaktiviert, die Spielfelderweiterung ist dauerhaft verfügbar.

Laufende Aufträge zeigen Restzeit und Fortschritt. Vor der Bonus-Aktualisierung gestartete Aufträge behalten zunächst ihre bisherige Restzeit; ein genauer Fortschritt ist für sie nicht verfügbar, da ihre ursprünglichen Lagerhallen nicht gespeichert wurden.

Das Landschafts-Pack enthält Gras, Erde, Wasser, Feld, Wald, Haus, Lagerhalle und Banditen-Nieten. Das Entdecker-Pack enthält zusätzlich Holzfäller, Windmühlen, Tavernen, Workshops und Joker. Das HumanCity-Pack enthält Gras, Erde, Wasser, Banditen-Nieten, Häuser, Tavernen und Wachtürme. Alle drei Packs enthalten fünf Karten, mindestens zwei davon nicht Gras, Erde, Wasser oder Banditen-Nieten. Die Übersicht zeigt die Chancen je zufälliger Karte inklusive dieser Garantie: bei HumanCity 42 % Haus, 16,8 % Taverne und 11,2 % Wachturm; ein Turm ist nicht garantiert. Wenn keine platzierbaren Karten oder Packs vorhanden sind und die benötigten Rohstoffe nicht produziert werden können, bietet ein freier Workshop ein kostenloses Starthilfe-Pack mit Wald und Feld an.

Der **Karten-Shop** öffnet erstmals nach fünf aktiven Spielminuten und danach alle fünf Minuten für jeweils eine Minute. Jeder Sale bietet vier verschiedene zufällige Karten aus dem gesamten spielbaren Pool, inklusive Joker und Banditen-Nieten (keine direkt kaufbaren Banditencamps). Gewöhnliche Karten kosten regulär 80 Gold, seltene 200 und epische 400; mit 25 % Sale-Rabatt kosten sie 60, 150 und 300 Gold. Jede angebotene Karte kann pro Sale einmal gekauft werden und kommt ans Deckende. Angebote, Käufe und Restzeit werden gespeichert; bei geschlossenem oder unsichtbarem Spiel pausiert die Shop-Zeit. Der Shop-Button zeigt den Countdown an.

## Banditen und Wachtürme

Ein Wachturm schützt ein Quadrat von 7×7 Feldern um sich und vertreibt vorhandene Camps in diesem Bereich beim Platzieren. Der Schutzbereich erscheint beim Antippen des Turms und beim Platzieren einer Karte. Mit **🛡️ Schutz** lassen sich Schildsymbole auf allen geschützten Tiles ein- und ausblenden. Ein neu gestartetes Spiel hat zwei Camps außerhalb dieses Bereichs.

Alle fünf Minuten aktiver Spielzeit versucht jedes vorhandene Camp gleichzeitig, ein zufälliges benachbartes ungeschütztes Feld zu übernehmen; auch diagonale Nachbarn zählen. Bei der Zielwahl werden belegte Tiles bevorzugt, ansonsten wird ein freies Feld gewählt. Der Pfeil zeigt das Ziel vorab; wird auf einem freien Zielfeld vor dem Angriff gebaut, wird das neue Tile übernommen. Ist kein Ziel verfügbar, erscheint kein Pfeil. Wenn ein Ziel geschützt oder zum Camp wird, wählt das Camp ein neues. Camps greifen nicht gleichzeitig dasselbe Feld an. Auf dem Ziel entsteht ein neues Camp, das erst beim nächsten Durchgang selbst angreift. Übernommene Gebäude produzieren nicht mehr; laufende Workshop-Aufträge gehen verloren. Der gemeinsame Countdown steht oben im Spiel und pausiert, wenn das Spiel geschlossen oder der Tab ausgeblendet ist. Rohstoffproduktion und Workshop-Aufträge laufen weiterhin offline.

Eine gezogene Banditen-Niete erscheint sofort auf einem zufälligen ungeschützten freien Feld und die Kamera springt dorthin. Falls kein solches Feld frei ist, wird ein ungeschütztes Tile übernommen. Gibt es kein geeignetes Feld, wird die Niete ans Deckende gelegt. Wachturm-Packs und Waffen sind noch nicht enthalten.

## Joker

Ein neuer Spielstand enthält je einen Lösch- und Verwandlungsjoker; im Entdecker-Pack können beide ebenfalls vorkommen. Eine gezogene Jokerkarte wird durch Antippen eines vorhandenen Tiles verbraucht. Löschen entfernt das Tile ohne Rückzahlung. Verwandeln wählt zufällig einen anderen Tile-Typ außer Banditencamps; neue Nachbarschaften wirken auf die zukünftige Produktion. Banditencamps, das letzte Tile, der letzte Workshop und beschäftigte Workshops sind vor Jokern geschützt. Joker können ans Deckende gelegt werden.
