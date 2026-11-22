# Fliesenreich

Bau-/Management-Spiel mit Tiles. Die Inselgrafik `assets/game-background.jpg` bildet den Bildschirmhintergrund. Die zweidimensionalen Tiles erhalten durch Schattierung und die Illustrationen aus `assets/card-art.svg` einen leichten Tiefeneffekt. Eigene PNGs als `assets/tiles/<id>.png` ablegen (z. B. `wald.png`), um einzelne Tiles zu ersetzen.

## Spielfeld

Das Spielfeld startet mit 8×8 Feldern, einem Workshop, einem benachbarten Wachturm, zwei Banditencamps und 12 zufälligen Gras-, Erde- oder Wasser-Tiles. Die übrigen drei Felder direkt neben dem Workshop bleiben frei. Im Baumodus markieren hellgrüne Felder mit einem weißen Plus die freien Plätze, die seitlich an ein vorhandenes Tile grenzen; dort können Karten unabhängig von ihrem Typ platziert werden. Boni zählen für passende Nachbarn einschließlich diagonaler Felder.

Im Shop kann das Spielfeld einmalig für 30 Gold auf 16×16 erweitert werden; dabei entstehen 36 zufällige Tiles und zwei Banditencamps ausschließlich auf der neuen Fläche. Die freien Felder der generierten Fläche bleiben zusammenhängend.

Mit **Neues Spiel** lässt sich nach einer Bestätigung der aktuelle Spielstand zurücksetzen und eine neue Welt erzeugen. Das Raster erscheint automatisch beim Platzieren; mit **▦ Grid** lässt es sich auch außerhalb des Baumodus ein- und ausblenden. Die Einstellung gilt für die aktuelle Spielsitzung.

Die anklickbare Kartenvorschau oben rechts zieht die nächste Karte aus dem Deck; einen separaten Next-Button gibt es nicht. Beim normalen Platzieren setzt der erste Klick auf ein grünes Feld eine Vorschau und markiert die davon beeinflussten Tiles. Grün markiert werden Tiles mit einem tatsächlichen Produktions- oder Workshop-Buff; die Vorschau nennt den jeweiligen Bonus. Ein zweiter Klick auf dasselbe Feld platziert die Karte; ein Klick auf ein anderes grünes Feld verschiebt die Vorschau. Das Inventar zeigt die Karten in Ziehreihenfolge mit eigenen Illustrationen und Seltenheit; die Kartengrafiken liegen in `assets/card-art.svg`. Bei leerem Deck zeigt die Vorschau „Deck leer“.

Auf schmalen Bildschirmen zeigt die obere Leiste nur die Ressourcen und den Banditen-Timer. Häufige Ansichten liegen in einer einklappbaren Icon-Leiste links; der Pfeil öffnet und schließt sie. Raster, Schutz, Shop, neues Spiel und Mischen sind als kompakte Aktionsleiste unten links angeordnet. Fertige Packs und untätige Workshops sitzen unten rechts nebeneinander; die Herstellungsübersicht öffnet sich vom rechten Bildschirmrand. Die Aktionsbuttons verwenden ein gedecktes Salbeigrün.

Neue Spiele starten zum Testen mit 100 Gold, je 8 Holz und Korn sowie 12 Karten, darunter ein Holzlager. Bestehende Spielstände behalten ihre Welt und erhalten einmalig eine Wachturm-Karte am Deckanfang sowie eine Banditen-Niete am Deckende. Ältere Spielstände ohne Rohstoffe erhalten zusätzlich Startrohstoffe und bei Bedarf eine Workshop-Karte.

## Produktion und Workshops

Alle 10 Sekunden erzeugen Wald und Holzfäller je 1 Holz, Feld und Windmühle je 1 Korn. Jeder benachbarte Wald erhöht die Holzfäller-Produktion um 1, jedes Feld die einer Windmühle um 1. Ein Haus/Haus-Paar erzeugt 1 Gold und ein Haus/Taverne-Paar 2 Gold pro Intervall; jedes Paar zählt einmal. Produktion und Workshop-Timer laufen auch bei geschlossenem Spiel anhand der vergangenen Zeit weiter.

Beim Antippen eines Tiles bleiben es und seine direkten Bonus-Partner hervorgehoben; andere Tiles werden deutlich ausgegraut. Die Detailansicht zeigt den aktuellen Ertrag mit Basis und Nachbarschaftsbonus sowie bei Workshops die gebufften Herstellungszeiten. Gold-Erträge beziehen sich auf die gemeinsamen Paare und zählen nicht doppelt.

**Warehouse** zeigt den Bestand aller Ressourcen (Gold, Holz und Korn). Das Grundlimit beträgt 300 Gold sowie je 100 Holz und Korn. Ein Holz-, Korn- oder Goldlager erhöht das Limit der jeweiligen Ressource um 50, unabhängig von seiner Position. Lager erhalten selbst keine Nachbarschaftsboni. Wird ein Lager gelöscht, verwandelt oder von Banditen übernommen, verfällt sofort der Bestand über dem neuen Limit; der Verlust wird angezeigt. Bisherige Lagerhallen und Karten werden zu Holzlagern. Vorhandenes Gold über dem neuen Limit bleibt bei der Umstellung erhalten, weitere Produktion wird erst wieder unterhalb des Limits gespeichert.

Beim Antippen einer Ressource im Warehouse erscheint der Gesamtertrag pro Tick (10 Sekunden), inklusive aller Nachbarschaftsboni und der noch verfügbaren Lagerkapazität. Die Ressourcen oben im Menü öffnen das Warehouse direkt mit der jeweiligen Ressource. Die Übersicht aktualisiert sich während sie geöffnet ist.

Unter **Workshop** lassen sich alle Workshops finden und Packs herstellen: Landschaft kostet 20 Holz und 15 Korn und dauert 3 Minuten, Entdecker 35 Holz und 25 Korn und dauert 6 Minuten, **HumanCity** 50 Holz und 35 Korn und dauert 9 Minuten. Das **Joker-Pack** kostet 250 Gold und dauert 6 Minuten. Jede benachbarte Werkzeugschmiede verkürzt die Herstellungszeit um 20 %, höchstens um 60 %. Änderungen an den Schmieden wirken auch auf die verbleibende Zeit bereits laufender Produktionen. Ein Workshop produziert ein Pack gleichzeitig. Fertige Packs landen automatisch im **Inventar** und werden dort geöffnet; ihre Karten kommen ans Deckende. Der direkte Packverkauf im Shop bleibt deaktiviert, die Spielfelderweiterung ist dauerhaft verfügbar.

Die Workshop-Übersicht listet alle Workshops kompakt auf. Ein Antippen klappt die Pack-Auswahl des jeweiligen Workshops auf; **Anzeigen** springt zu ihm auf der Karte. Laufende Aufträge zeigen auch in der geschlossenen Liste Restzeit und Fortschritt. Bereits vor dieser Umstellung gestartete Aufträge behalten ihre bisherige Restzeit und Dauer. Bei älteren Aufträgen ohne gespeicherte Dauer bleibt der Fortschritt unbekannt, auch wenn eine Schmiede die Restzeit verändert.

Der Pfeil links öffnet eine Schnellübersicht aller laufenden Herstellungsaufträge mit Workshop-Position, Pack, Restzeit und Fortschritt. Sie aktualisiert sich automatisch und lässt sich mit dem Pfeil wieder schließen.

Ein Hammer am unteren Bildschirmrand zeigt die Anzahl untätiger Workshops und öffnet direkt die Auswahl des ersten freien Workshops. Sind alle beschäftigt oder keine vorhanden, verschwindet er; nach Abschluss eines Auftrags erscheint er wieder. In der Pack-Auswahl stehen die möglichen Karten mit Symbol, Name und Chance pro Karte. Farbige Kästchen kennzeichnen Karten ohne eigenes Symbol.

Ein Pack-Symbol links unten zeigt die Anzahl fertiger Packs und öffnet das Inventar. Sobald alle geöffnet sind, verschwindet es.

Das Landschafts-Pack enthält Gras, Erde, Wasser, Feld, Wald, Haus und Banditen-Nieten. Das Entdecker-Pack enthält zusätzlich Holzfäller, Windmühlen, Tavernen, Workshops und Joker. Das HumanCity-Pack enthält Gras, Erde, Wasser, Banditen-Nieten, Häuser, Tavernen und Wachtürme. Diese drei Packs können die drei Lagertypen, Werkzeugschmieden, Schutz-Joker und Banditenzeit-Joker enthalten und garantieren mindestens zwei Karten außer Gras, Erde, Wasser oder Banditen-Nieten. Das Joker-Pack enthält ausschließlich fünf zufällige Joker: Lösch-, Verwandlungs-, Schutz- und Banditenzeit-Joker, je 25 % pro Karte; Wiederholungen sind möglich. Die Übersicht zeigt die Chancen je zufälliger Karte; ein Turm ist nicht garantiert. Wenn keine platzierbaren Karten oder Packs vorhanden sind und die benötigten Rohstoffe nicht produziert werden können, bietet ein freier Workshop ein kostenloses Starthilfe-Pack mit Wald und Feld an.

Der **Karten-Shop** öffnet erstmals nach fünf aktiven Spielminuten und danach alle fünf Minuten für jeweils eine Minute. Jeder Sale bietet vier verschiedene zufällige Karten aus dem gesamten spielbaren Pool, inklusive Joker und Banditen-Nieten (keine direkt kaufbaren Banditencamps). Gewöhnliche Karten kosten regulär 80 Gold, seltene 200 und epische 400; mit 25 % Sale-Rabatt kosten sie 60, 150 und 300 Gold. Jede angebotene Karte kann pro Sale einmal gekauft werden und kommt ans Deckende. Angebote, Käufe und Restzeit werden gespeichert; bei geschlossenem oder unsichtbarem Spiel pausiert die Shop-Zeit. Der Shop-Button zeigt den Countdown an.

## Banditen und Wachtürme

Ein Wachturm schützt ein Quadrat von 7×7 Feldern um sich und vertreibt vorhandene Camps in diesem Bereich beim Platzieren. Der Schutzbereich erscheint beim Antippen des Turms und beim Platzieren einer Karte. Mit **🛡️ Schutz** lassen sich Schildsymbole auf allen geschützten Tiles ein- und ausblenden. Ein neu gestartetes Spiel hat zwei Camps außerhalb dieses Bereichs.

Alle zehn Minuten aktiver Spielzeit versucht jedes vorhandene Camp gleichzeitig, ein zufälliges benachbartes ungeschütztes Feld zu übernehmen; auch diagonale Nachbarn zählen. Bei der Zielwahl werden belegte Tiles bevorzugt, ansonsten wird ein freies Feld gewählt. Der Pfeil zeigt das Ziel vorab; beim Antippen des Camps wird das Zielfeld rot hervorgehoben. Wird auf einem freien Zielfeld vor dem Angriff gebaut, wird das neue Tile übernommen. Ist kein Ziel verfügbar, erscheint kein Pfeil. Wenn ein Ziel geschützt oder zum Camp wird, wählt das Camp ein neues. Camps greifen nicht gleichzeitig dasselbe Feld an. Auf dem Ziel entsteht ein neues Camp, das erst beim nächsten Durchgang selbst angreift. Übernommene Gebäude produzieren nicht mehr; laufende Workshop-Aufträge gehen verloren. Der gemeinsame Countdown steht oben im Spiel und pausiert, wenn das Spiel geschlossen oder der Tab ausgeblendet ist. Rohstoffproduktion und Workshop-Aufträge laufen weiterhin offline.

Eine gezogene Banditen-Niete erscheint sofort auf einem zufälligen ungeschützten freien Feld und die Kamera springt dorthin. Falls kein solches Feld frei ist, wird ein ungeschütztes Tile übernommen. Gibt es kein geeignetes Feld, wird die Niete ans Deckende gelegt. Wachtürme gibt es im HumanCity-Pack; Waffen sind noch nicht enthalten.

## Joker

Ein neuer Spielstand enthält je einen Lösch- und Verwandlungsjoker; im Entdecker-Pack können beide ebenfalls vorkommen. Löschen entfernt ein angetipptes Tile ohne Rückzahlung. Verwandeln wählt zufällig einen anderen Tile-Typ außer Banditencamps; neue Nachbarschaften wirken auf die zukünftige Produktion. Banditencamps, das letzte Tile, der letzte Workshop und beschäftigte Workshops sind vor diesen Jokern geschützt.

Der **Schutz-Joker** schützt ein angetipptes freies oder belegtes Feld dauerhaft vor Banditen, auch wenn dort später ein anderes Tile steht oder ein Wachturm entfernt wird. Er kann auch auf bereits durch einen Wachturm geschützte Felder angewendet werden, nicht aber auf Banditencamps oder bereits dauerhaft geschützte Felder. Ein goldenes Schild zeigt den dauerhaften Schutz, unabhängig vom Schutz-Anzeigeschalter. Banditen wählen gegebenenfalls sofort ein anderes Ziel. Ungültige Ziele verbrauchen keinen Joker; Joker können ans Deckende gelegt werden.

Der **Banditenzeit-Joker** wird sofort beim Ziehen verbraucht und setzt den globalen Banditen-Countdown auf zehn Minuten zurück. Bereits angekündigte Ziele bleiben erhalten; ein bereits ausgelöster Angriff wird nicht rückgängig gemacht. Die Kartenvorschau weist auf die sofortige Wirkung hin.
