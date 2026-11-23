# Fliesenreich

Bau-/Management-Spiel mit Tiles. Die Inselgrafik `assets/game-background.jpg` bildet den Bildschirmhintergrund. Die Tiles sind flach und quadratisch; Gras, Erde, Wasser und Berge zeigen Gelände statt Icons. Die übrigen Illustrationen werden zusammen mit den Kartengrafiken in `assets/card-art.svg` gepflegt. Eigene PNGs als `assets/tiles/<id>.png` ablegen (z. B. `wald.png`), um einzelne Tiles zu ersetzen.

## Spielfeld

Ein neues Spielfeld startet mit 8×8 Feldern, einem Workshop und einem benachbarten Wachturm; es werden keine weiteren Tiles oder Banditencamps erzeugt. Bestehende Spielstände bleiben unverändert. Im Baumodus markieren hellgrüne Felder mit einem weißen Plus freie Plätze, die seitlich an ein vorhandenes Tile grenzen. Boni zählen für passende Nachbarn einschließlich diagonaler Felder.

Im Shop kann das Spielfeld einmalig für 30 Gold auf 16×16 erweitert werden; dabei entstehen keine neuen Tiles oder Banditencamps.

Mit **Neues Spiel** lässt sich nach einer Bestätigung der aktuelle Spielstand zurücksetzen und eine neue Welt erzeugen. Das Raster erscheint automatisch beim Platzieren; mit **▦ Grid** lässt es sich auch außerhalb des Baumodus ein- und ausblenden. Die Einstellung gilt für die aktuelle Spielsitzung.

Die anklickbare Kartenvorschau oben rechts zieht die nächste Karte aus dem Deck; einen separaten Next-Button gibt es nicht. Landkarten (Gras, Erde, Wasser und Berge) werden beim Ziehen automatisch auf einem zufälligen freien, seitlich an ein bestehendes Tile angrenzenden Feld platziert. Ist kein solches Feld frei, wird die Karte unverändert ans Deckende gelegt. Andere platzierbare Karten werden weiterhin manuell gesetzt: Der erste Klick auf ein grünes Feld zeigt die Vorschau und markiert beeinflusste Tiles; ein zweiter Klick platziert sie. Das Inventar zeigt Karten in Ziehreihenfolge mit Illustration und Seltenheit.

Auf Mobilgeräten und im Browser zeigt die obere Leiste nur die Ressourcen und den Banditen-Timer. Häufige Ansichten liegen in einer einklappbaren Icon-Leiste links; der Pfeil öffnet und schließt sie. Raster, Schutz, Shop, neues Spiel und Mischen sind als kompakte Aktionsleiste unten links angeordnet. Fertige Packs und untätige Workshops sitzen unten rechts nebeneinander; die Herstellungsübersicht öffnet sich vom rechten Bildschirmrand.

Mit **Filter** werden einzelne Tile-Typen oder Rohstoffketten hervorgehoben; andere Tiles werden wie bei einer Tile-Auswahl abgedunkelt. Die Ketten umfassen Wald, Holzfäller und Holzlager; Feld, Windmühle und Kornlager; beziehungsweise Haus, Taverne und Goldlager. Ein aktiver Filter wird am Button markiert und kann mit **✕** daneben sofort ausgeschaltet werden. Beim Platzieren oder Verwenden eines Jokers pausiert die Hervorhebung, damit die Zielfelder sichtbar bleiben; danach erscheint sie wieder. Der Filter gilt nur für die aktuelle Spielsitzung.

Neue Spiele starten zum Testen mit 100 Gold, je 8 Holz und Korn sowie 13 Karten, darunter Berge und ein Holzlager. Bestehende Spielstände behalten ihre Welt und erhalten einmalig eine Wachturm-Karte am Deckanfang sowie eine Banditen-Niete am Deckende. Ältere Spielstände ohne Rohstoffe erhalten zusätzlich Startrohstoffe und bei Bedarf eine Workshop-Karte.

## Seltenheit

Alle baubaren Tiles haben zunächst Common als Basis. Beim Erhalt einer Karte wird ihre Seltenheit einmalig ausgelost: Common 70 %, Uncommon 20 %, Rare 8 %, Epic 2 %. Sie bleibt beim Mischen, Ziehen, Platzieren und Speichern erhalten und erscheint im Deck, in der Kartenvorschau und als Ecke unten rechts am Tile: weiß, grün, blau bzw. lila. Joker und Banditen-Nieten werden nicht aufgewertet. Bereits vorhandene Tile-Karten und platzierte Tiles alter Spielstände bleiben Common; bei Verwandlung behält das Tile seine Seltenheit.

Die vier Stufen erhöhen Grundproduktion und Lagerplatz auf das Ein-, Zwei-, Drei- bzw. Vierfache. Für Nachbarschaftsboni zählt die höhere Seltenheit des Paars; der Radius bleibt unverändert. Gras, Erde, Wasser und Berge erhalten vorerst keine Funktion. Eine Werkzeugschmiede beschleunigt je Stufe um 20 Prozentpunkte, insgesamt maximal 60 %. Workshops verkürzen ihre Herstellungszeit zusätzlich je Stufe über Common um 10 % der Zeit nach dem Schmiedebonus. Wachtürme erhöhen ihren Schutzradius je Stufe über Common um ein Feld.

## Produktion und Workshops

Alle 10 Sekunden erzeugen Common-Wald und -Holzfäller je 1 Holz, Common-Feld und -Windmühle je 1 Korn. Jeder benachbarte Common-Wald erhöht die Common-Holzfäller-Produktion um 1, jedes Common-Feld die einer Common-Windmühle um 1. Ein Common-Haus/Haus-Paar erzeugt 1 Gold und ein Common-Haus/Taverne-Paar 2 Gold pro Intervall; jedes Paar zählt einmal. Höhere Seltenheit verstärkt diese Werte wie oben beschrieben. Produktion und Workshop-Timer laufen auch bei geschlossenem Spiel anhand der vergangenen Zeit weiter.

Beim Antippen eines Tiles bleiben es und seine direkten Bonus-Partner hervorgehoben; andere Tiles werden deutlich ausgegraut. Die Detailansicht zeigt den aktuellen Ertrag mit Basis und Nachbarschaftsbonus sowie bei Workshops die gebufften Herstellungszeiten. Gold-Erträge beziehen sich auf die gemeinsamen Paare und zählen nicht doppelt.

**Warehouse** zeigt den Bestand aller Ressourcen (Gold, Holz und Korn). Das Grundlimit beträgt 300 Gold sowie je 100 Holz und Korn. Ein Holz-, Korn- oder Goldlager erhöht das Limit der jeweiligen Ressource je nach Seltenheit um 50, 100, 150 oder 200, unabhängig von seiner Position. Lager erhalten selbst keine Nachbarschaftsboni. Wird ein Lager gelöscht, verwandelt oder von Banditen übernommen, verfällt sofort der Bestand über dem neuen Limit; der Verlust wird angezeigt. Bisherige Lagerhallen und Karten werden zu Holzlagern. Vorhandenes Gold über dem neuen Limit bleibt bei der Umstellung erhalten, weitere Produktion wird erst wieder unterhalb des Limits gespeichert.

Beim Antippen einer Ressource im Warehouse erscheint der Gesamtertrag pro Tick (10 Sekunden), inklusive aller Nachbarschaftsboni und der noch verfügbaren Lagerkapazität. Die Ressourcen oben im Menü öffnen das Warehouse direkt mit der jeweiligen Ressource. Die Übersicht aktualisiert sich während sie geöffnet ist.

Unter **Workshop** lassen sich alle Workshops finden und Packs herstellen: Landschaft kostet 20 Holz und 15 Korn und dauert 3 Minuten, Entdecker 35 Holz und 25 Korn und dauert 6 Minuten, **HumanCity** 50 Holz und 35 Korn und dauert 9 Minuten. Das **Joker-Pack** kostet 250 Gold und dauert 6 Minuten. Die genannten Zeiten gelten für Common-Workshops ohne Schmieden; Seltenheit und benachbarte Schmieden verkürzen sie wie oben beschrieben. Änderungen an den Schmieden wirken auch auf die verbleibende Zeit bereits laufender Produktionen. Ein Workshop produziert ein Pack gleichzeitig. Fertige Packs landen automatisch im **Inventar** und werden dort geöffnet; ihre Karten kommen ans Deckende. Der direkte Packverkauf im Shop bleibt deaktiviert, die Spielfelderweiterung ist dauerhaft verfügbar.

Die Workshop-Übersicht listet alle Workshops kompakt auf. Ein Antippen klappt die Pack-Auswahl des jeweiligen Workshops auf; **Anzeigen** springt zu ihm auf der Karte. Laufende Aufträge zeigen auch in der geschlossenen Liste Restzeit und Fortschritt. Bereits vor dieser Umstellung gestartete Aufträge behalten ihre bisherige Restzeit und Dauer. Bei älteren Aufträgen ohne gespeicherte Dauer bleibt der Fortschritt unbekannt, auch wenn eine Schmiede die Restzeit verändert.

Der Pfeil links öffnet eine Schnellübersicht aller laufenden Herstellungsaufträge mit Workshop-Position, Pack, Restzeit und Fortschritt. Sie aktualisiert sich automatisch und lässt sich mit dem Pfeil wieder schließen.

Ein Hammer am unteren Bildschirmrand zeigt die Anzahl untätiger Workshops und öffnet direkt die Auswahl des ersten freien Workshops. Sind alle beschäftigt oder keine vorhanden, verschwindet er; nach Abschluss eines Auftrags erscheint er wieder. In der Pack-Auswahl stehen die möglichen Karten mit Symbol, Name und Chance pro Karte. Farbige Kästchen kennzeichnen Karten ohne eigenes Symbol.

Ein Pack-Symbol links unten zeigt die Anzahl fertiger Packs und öffnet das Inventar. Sobald alle geöffnet sind, verschwindet es.

Das Landschafts-Pack enthält Gras, Erde, Wasser, Berge, Feld, Wald, Haus und Banditen-Nieten. Das Entdecker-Pack enthält zusätzlich Holzfäller, Windmühlen, Tavernen, Workshops und Joker. Das HumanCity-Pack enthält Gras, Erde, Wasser, Berge, Banditen-Nieten, Häuser, Tavernen und Wachtürme. Diese drei Packs können die drei Lagertypen, Werkzeugschmieden, Schutz-, Banditenzeit- und Shop-Refresh-Joker enthalten und garantieren mindestens zwei Karten außer Gras, Erde, Wasser, Berge oder Banditen-Nieten. Das Joker-Pack enthält ausschließlich fünf zufällige Joker: Lösch-, Verwandlungs-, Schutz-, Banditenzeit- und Shop-Refresh-Joker, je 20 % pro Karte; Wiederholungen sind möglich. Die Übersicht zeigt die Chancen je zufälliger Karte; ein Turm ist nicht garantiert. Wenn keine platzierbaren Karten oder Packs vorhanden sind und die benötigten Rohstoffe nicht produziert werden können, bietet ein freier Workshop ein kostenloses Starthilfe-Pack mit Wald und Feld an.

Der **Karten-Shop** ist dauerhaft offen und bietet sofort vier verschiedene zufällige Karten aus dem gesamten spielbaren Pool, inklusive Joker und Banditen-Nieten (keine direkt kaufbaren Banditencamps). Alle fünf aktiven Spielminuten wird das Angebot erneuert. Der Preis hängt weiterhin vom Kartentyp ab: regulär 80, 200 oder 400 Gold; mit 25 % Rabatt 60, 150 oder 300 Gold. Die Tile-Seltenheit wird erst beim Kauf ausgelost und verändert den Preis nicht. Jede angebotene Karte kann pro Angebot einmal gekauft werden und kommt ans Deckende. Angebote, Käufe und Restzeit werden gespeichert; bei geschlossenem oder unsichtbarem Spiel pausiert die Shop-Zeit.

## Banditen und Wachtürme

Ein Common-Wachturm schützt ein Quadrat von 7×7 Feldern um sich, Uncommon 9×9, Rare 11×11 und Epic 13×13. Er vertreibt vorhandene Camps in diesem Bereich beim Platzieren. Der Schutzbereich erscheint beim Antippen des Turms und beim Platzieren einer Karte. Mit **🛡️ Schutz** lassen sich Schildsymbole auf allen geschützten Tiles ein- und ausblenden. Neue Spiele beginnen ohne Camps; Banditen-Nieten können später weiterhin Camps erzeugen.

Alle zehn Minuten aktiver Spielzeit versucht jedes vorhandene Camp gleichzeitig, ein zufälliges benachbartes ungeschütztes Feld zu übernehmen; auch diagonale Nachbarn zählen. Bei der Zielwahl werden belegte Tiles bevorzugt, ansonsten wird ein freies Feld gewählt. Der Pfeil zeigt das Ziel vorab; beim Antippen des Camps wird das Zielfeld rot hervorgehoben. Wird auf einem freien Zielfeld vor dem Angriff gebaut, wird das neue Tile übernommen. Ist kein Ziel verfügbar, erscheint kein Pfeil. Wenn ein Ziel geschützt oder zum Camp wird, wählt das Camp ein neues. Camps greifen nicht gleichzeitig dasselbe Feld an. Auf dem Ziel entsteht ein neues Camp, das erst beim nächsten Durchgang selbst angreift. Übernommene Gebäude produzieren nicht mehr; laufende Workshop-Aufträge gehen verloren. Der gemeinsame Countdown steht oben im Spiel und pausiert, wenn das Spiel geschlossen oder der Tab ausgeblendet ist. Rohstoffproduktion und Workshop-Aufträge laufen weiterhin offline.

Eine gezogene Banditen-Niete erscheint sofort auf einem zufälligen ungeschützten freien Feld und die Kamera springt dorthin. Falls kein solches Feld frei ist, wird ein ungeschütztes Tile übernommen. Gibt es kein geeignetes Feld, wird die Niete ans Deckende gelegt. Wachtürme gibt es im HumanCity-Pack; Waffen sind noch nicht enthalten.

## Joker

Ein neuer Spielstand enthält je einen Lösch- und Verwandlungsjoker; im Entdecker-Pack können beide ebenfalls vorkommen. Löschen entfernt ein angetipptes Tile ohne Rückzahlung. Verwandeln wählt zufällig einen anderen Tile-Typ außer Banditencamps; neue Nachbarschaften wirken auf die zukünftige Produktion. Banditencamps, das letzte Tile, der letzte Workshop und beschäftigte Workshops sind vor diesen Jokern geschützt.

Der **Schutz-Joker** schützt ein angetipptes freies oder belegtes Feld dauerhaft vor Banditen, auch wenn dort später ein anderes Tile steht oder ein Wachturm entfernt wird. Er kann auch auf bereits durch einen Wachturm geschützte Felder angewendet werden, nicht aber auf Banditencamps oder bereits dauerhaft geschützte Felder. Ein goldenes Schild zeigt den dauerhaften Schutz, unabhängig vom Schutz-Anzeigeschalter. Banditen wählen gegebenenfalls sofort ein anderes Ziel. Ungültige Ziele verbrauchen keinen Joker; Joker können ans Deckende gelegt werden.

Der **Banditenzeit-Joker** wird sofort beim Ziehen verbraucht und setzt den globalen Banditen-Countdown auf zehn Minuten zurück. Bereits angekündigte Ziele bleiben erhalten; ein bereits ausgelöster Angriff wird nicht rückgängig gemacht. Die Kartenvorschau weist auf die sofortige Wirkung hin.

Der **Shop-Refresh-Joker** wird sofort beim Ziehen verbraucht, erneuert die vier Angebote und setzt den Shop-Timer auf fünf Minuten zurück.
