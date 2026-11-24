# Fliesenreich

Bau-/Management-Spiel mit Tiles. Die Inselgrafik `assets/game-background.jpg` bildet den Bildschirmhintergrund. Die Tiles sind flach und quadratisch; Gras, Erde, Wasser und Berge zeigen Gelände statt Icons. Die übrigen Illustrationen werden zusammen mit den Kartengrafiken in `assets/card-art.svg` gepflegt. Eigene PNGs als `assets/tiles/<id>.png` ablegen (z. B. `wald.png`), um einzelne Tiles zu ersetzen.

## Spielfeld

Ein neues Spielfeld startet mit 8×8 Feldern, einem **Rathaus**, einem benachbarten Wachturm und 12 zufällig verteilten Landschafts-Tiles (Gras, Erde, Wasser, Berge). Sie können auch getrennt von anderen Tiles liegen; es entstehen keine Banditencamps. Bestehende Welten bleiben unverändert. Boni zählen für passende Nachbarn einschließlich diagonaler Felder.

Im Shop kann das Spielfeld einmalig für 30 Gold auf 16×16 erweitert werden; dabei entstehen im neuen Bereich 36 weitere zufällige Landschafts-Tiles, aber keine Banditencamps. Für jedes Landschafts-Tile beträgt die Chance auf Gras, Erde oder Wasser je 30 %, auf Berge 10 %.

Mit **Neues Spiel** lässt sich nach einer Bestätigung der aktuelle Spielstand zurücksetzen und eine neue Welt erzeugen. Das Raster erscheint automatisch beim Verschieben; mit **▦ Grid** lässt es sich jederzeit ein- und ausblenden. Die Einstellung gilt für die aktuelle Spielsitzung.

Die anklickbare Kartenvorschau oben rechts zieht die nächste Karte aus dem Deck; einen separaten Next-Button gibt es nicht. Unter der Kartenvorschau löscht **🗑️ Löschen** die nächste Karte endgültig und bringt 10 Gold (begrenzt durch die Lagerkapazität); Gras, Erde, Wasser, Berge sowie Banditen-Nieten und -camps sind davon ausgenommen. Jede Tile-Karte (Land und Gebäude) wird beim Ziehen automatisch auf einem zufälligen freien, seitlich an ein bestehendes Tile angrenzenden Feld platziert. Ist kein solches Feld frei, wird die Karte unverändert ans Deckende gelegt. Mit **🎯 Folgen** in der Werkzeugleiste springt die Kamera nach dem Erstellen eines Tiles automatisch zu ihm; die Option ist standardmäßig aus und bleibt im Browser gespeichert. Neue Gebäude werden direkt ausgewählt, damit man sie sofort verschieben kann. Das Inventar zeigt Karten in Ziehreihenfolge mit Illustration und Seltenheit.

Auf Mobilgeräten und im Browser zeigt die obere Leiste nur die Ressourcen und den Banditen-Timer. Häufige Ansichten liegen in einer einklappbaren Icon-Leiste links; der Pfeil öffnet und schließt sie. Raster, Schutz, Shop, neues Spiel und Mischen sind als kompakte Aktionsleiste unten links angeordnet. Fertige Packs und untätige Workshops sitzen unten rechts nebeneinander; die Herstellungsübersicht öffnet sich vom rechten Bildschirmrand.

Der **📖 Karten**-Browser im linken Menü zeigt alle Karten des Spiels nach Kategorien (Landschaft, Industrie, Siedlung, Verteidigung, Joker, Gefahren) im Kartenstil des Inventars, jeweils mit genauer Beschreibung, Pack-Vorkommen und Shop-Preis.

Mit **Filter** werden einzelne Tile-Typen oder Rohstoffketten hervorgehoben; andere Tiles werden wie bei einer Tile-Auswahl abgedunkelt. Die Ketten umfassen Forst, Holzfäller und Holzlager; Feld, Windmühle und Kornlager; Haus, Taverne und Goldlager; beziehungsweise Werkzeugschmiede und Workshop. Ein aktiver Filter wird am Button markiert und kann mit **✕** daneben sofort ausgeschaltet werden. Beim Platzieren oder Verwenden eines Jokers pausiert die Hervorhebung, damit die Zielfelder sichtbar bleiben; danach erscheint sie wieder. Der Filter gilt nur für die aktuelle Spielsitzung.

Neue Spiele starten zum Testen mit 100 Gold, je 8 Holz und Korn, 30 Werkzeugen sowie 9 Karten, darunter ein Holzlager. Gras, Erde, Wasser und Berge gibt es nicht mehr im Startdeck, in Packs oder im Shop. Bereits besessene Landschaftskarten auf der Hand oder im Deck bleiben erhalten und funktionieren weiterhin; alte Shopangebote dieser Karten entfallen. Bestehende Spielstände behalten ihre Welt und erhalten bei älteren Speicherständen einmalig eine Wachturm-Karte am Deckanfang sowie eine Banditen-Niete am Deckende. Ältere Spielstände ohne Rohstoffe erhalten zusätzlich Startrohstoffe und bei Bedarf eine Workshop-Karte.

## Seltenheit

Alle baubaren Tiles haben zunächst Common als Basis. Beim Erhalt einer Karte wird ihre Seltenheit einmalig ausgelost: Common 70 %, Uncommon 20 %, Rare 8 %, Epic 2 %. Sie bleibt beim Mischen, Ziehen, Platzieren und Speichern erhalten und erscheint im Deck, in der Kartenvorschau und als Ecke unten rechts am Tile: weiß, grün, blau bzw. lila. Joker und Banditen-Nieten werden nicht aufgewertet. Bereits vorhandene Tile-Karten und platzierte Tiles alter Spielstände bleiben Common; bei Verwandlung behält das Tile seine Seltenheit.

Die vier Stufen haben die Stärke 1 bis 4. Sie erhöhen die Leistung von Holzfällern, Windmühlen und Workshops sowie den Lagerplatz entsprechend. Forste, Felder und Werkzeugschmieden verbessern mit ihrer Seltenheit stattdessen den Ertrag des benachbarten Gebäudes. Für Gold-Paare zählt die höhere Seltenheit des Paars; der Radius bleibt unverändert. Gras, Erde, Wasser und Berge erhalten vorerst keine Funktion. Wachtürme erhöhen ihren Schutzradius je Stufe über Common um ein Feld.

**✨ Spezial-Bauplätze:** Etwa 8 % der freien Felder sind zufällig Spezial-Bauplätze; direkt um den Startbereich liegen keine. Beim Erweitern der Welt kommen im neuen Bereich weitere hinzu. Im Verschiebe-Modus sind sie golden (erreichbar) bzw. gestrichelt markiert. Ein dorthin verschobenes Tile steigt eine Seltenheitsstufe auf (Epic bleibt Epic), die Vorschau zeigt die Steigerung. Danach ist der Bauplatz verbraucht. Zufällig erscheinende Tiles meiden Spezial-Bauplätze, solange ein anderes Feld frei ist.

## Verschieben und Tauschen

Jedes Tile außer Banditencamps lässt sich jederzeit über **↔ Verschieben** im Tile-Info versetzen. Alternativ startet langes Drücken auf ein Tile (Finger oder Maustaste, ca. 0,5 s) direkt den Verschiebe-Modus; ein kurzer Klick wählt das Tile wie gewohnt aus. Ziele können überall auf einem erreichbaren freien Feld liegen, auch ohne benachbartes Tile; dabei dürfen Inseln getrennt oder verbunden werden. Tiles gleiten seitlich über freie Felder und können nicht über belegte Tiles springen. Der Preis ist die Länge des kürzesten freien Weges × Preis pro Feld (Common 10, Uncommon 15, Rare 20, Epic 30 Gold); unbezahlbare Ziele sind ausgegraut. Direkt benachbarte Tiles lassen sich für 50 Gold tauschen (🔁). Das erste Antippen eines Ziels zeigt Pfad, Kosten, Seltenheits-Upgrade und alle Auswirkungen auf die Produktion (grün = Gewinn, rot = Verlust); erneutes Antippen bestätigt, das Tile gleitet dann ans Ziel. Etwa sechs Sekunden lang kann der Zug mit **↩ Rückgängig** voll erstattet werden, sofern dabei keine Camps vertrieben wurden.

## Produktion und Workshops

Das **🏛️ Rathaus** ist das Start-Tile und erzeugt ohne Nachbarn automatisch 1 Gold und 1 Werkzeug pro 10 Sekunden, damit auch bei schlechten Kartenziehungen immer Grundressourcen vorhanden sind. Es wird nicht gezogen, lässt sich nicht als Karte löschen, und der Lösch-/Verwandlungs-Joker verschont das letzte Rathaus. Ein Workshop ist für den Spielstart nicht mehr nötig und nur noch ein zusätzlicher Werkzeug-Produzent.

Forste, Felder und Werkzeugschmieden produzieren allein nichts. Ein Holzfäller braucht mindestens zwei benachbarte Forste, eine Windmühle mindestens zwei benachbarte Felder und ein Workshop mindestens zwei benachbarte Werkzeugschmieden; diagonale Nachbarn zählen. Ist ein Gebäude aktiv, erzeugt es alle 10 Sekunden je passendem Nachbarn 2 × seine Stärke, also bei Common 2 (Workshops: 🔨 Werkzeuge). Jede Seltenheitsstufe des Nachbarn über Common bringt +1. Mit null oder einem passenden Nachbarn läuft es im Notbetrieb mit 25 % der Mindestleistung, also bei Common 1 pro Intervall. Auf dem Spielfeld zeigt ⚠ mit Zahl den Notbetrieb; Tile-Info und Platzierungsvorschau zeigen Status und Ertragsänderung. Ein Common-Haus/Haus-Paar erzeugt 1 Gold und ein Common-Haus/Taverne-Paar 2 Gold pro Intervall; jedes Paar zählt einmal. Höhere Seltenheit verstärkt diese Werte wie oben beschrieben. Produktion und Herstellungsaufträge laufen auch bei geschlossenem Spiel anhand der vergangenen Zeit weiter.

Beim Antippen eines Tiles bleiben es und seine direkten Bonus-Partner hervorgehoben; andere Tiles werden deutlich ausgegraut. Die Detailansicht zeigt den aktuellen Ertrag mit Basis und Nachbarschaftsbonus sowie bei Workshops Schmiedestatus und Werkzeugertrag. Gold-Erträge beziehen sich auf die gemeinsamen Paare und zählen nicht doppelt.

**Warehouse** zeigt den Bestand aller Ressourcen (Gold, Holz, Korn und Werkzeuge). Das Grundlimit beträgt 300 Gold sowie je 100 Holz, Korn und Werkzeuge. Ein Holz-, Korn- oder Goldlager erhöht das Limit der jeweiligen Ressource je nach Seltenheit um 50, 100, 150 oder 200, unabhängig von seiner Position. Lager erhalten selbst keine Nachbarschaftsboni. Wird ein Lager gelöscht, verwandelt oder von Banditen übernommen, verfällt sofort der Bestand über dem neuen Limit; der Verlust wird angezeigt. Bisherige Lagerhallen und Karten werden zu Holzlagern. Vorhandenes Gold über dem neuen Limit bleibt bei der Umstellung erhalten, weitere Produktion wird erst wieder unterhalb des Limits gespeichert.

Beim Antippen einer Ressource im Warehouse erscheint der Gesamtertrag pro Tick (10 Sekunden), inklusive aller Nachbarschaftsboni und der noch verfügbaren Lagerkapazität. Die Ressourcen oben im Menü öffnen das Warehouse direkt mit der jeweiligen Ressource. Die Übersicht aktualisiert sich während sie geöffnet ist.

Workshops produzieren keine Packs mehr, sondern **🔨 Werkzeuge** (siehe oben; neue Spiele starten mit 30). Unter **Workshop** werden daraus Herstellungsaufträge für Packs gestartet: Landschaft kostet 30 Werkzeuge, 30 Holz und 25 Korn und dauert 4 Minuten, Entdecker 50 Werkzeuge, 55 Holz und 45 Korn (8 Minuten), **HumanCity** 70 Werkzeuge, 75 Holz und 55 Korn (12 Minuten). Das **Joker-Pack** kostet 100 Werkzeuge und 350 Gold und dauert 8 Minuten. Aufträge laufen unabhängig von Anzahl und Seltenheit der Workshops parallel, höchstens 30 gleichzeitig; wer genug hat, startet mehrere (**Max** startet so viele wie bezahlbar). Fertige Packs landen automatisch im **Inventar** und werden dort geöffnet; ihre Karten kommen ans Deckende. Der direkte Packverkauf im Shop bleibt deaktiviert, die Spielfelderweiterung ist dauerhaft verfügbar.

Die Workshop-Übersicht zeigt Werkzeugbestand, Ertrag und laufende Aufträge, listet alle Workshops mit Schmiedestatus (**Anzeigen** springt zu ihnen auf der Karte) und darunter die Pack-Rezepte. Bereits laufende Aufträge älterer Spielstände wandern in die gemeinsame Warteschlange und behalten ihre Restzeit; Bestandsspiele erhalten einmalig 30 Werkzeuge.

Der Pfeil rechts öffnet eine Schnellübersicht aller laufenden Herstellungsaufträge mit Pack, Restzeit und Fortschritt. Sie aktualisiert sich automatisch und lässt sich mit dem Pfeil wieder schließen.

In der Pack-Auswahl stehen die möglichen Karten mit Symbol, Name und Chance pro Karte. Farbige Kästchen kennzeichnen Karten ohne eigenes Symbol.

Ein Pack-Symbol links unten zeigt die Anzahl fertiger Packs und öffnet das Inventar. Sobald alle geöffnet sind, verschwindet es.

Jedes normale Pack enthält zwei garantierte Wertkarten und höchstens eine dritte Karte: Mit 40 % Chance eine weitere Wertkarte, beim Landschafts- und Entdecker-Pack alternativ mit 10 %, beim HumanCity-Pack mit 15 % eine Banditen-Niete. Das Joker-Pack enthält keine Niete. Die übrige Chance ergibt keine dritte Karte. Gezielte Anschaffungen laufen über den Shop.

- **Landschafts-Pack:** Forst (32 %) und Feld (32 %), dazu Haus 14 %, Holz- und Kornlager je 6 %, Goldlager und Werkzeugschmiede je 3 %, Schutz-Joker 2 %, Banditenzeit- und Shop-Refresh-Joker je 1 %.
- **Entdecker-Pack:** Holzfäller und Windmühle je 18 %, Forst und Feld je 8 %, Werkzeugschmiede 8 %, Workshop, Holz- und Kornlager je 7 %, Taverne 5 %, Lösch-, Verwandlungs- und Freizug-Joker je 4 %, Schutz-Joker 2 %.
- **HumanCity-Pack:** Haus 45 %, Taverne 22 %, Wachturm 15 %, Goldlager 10 %, Schutz- und Banditenzeit-Joker je 4 %.
- **Joker-Pack:** Alle sechs Joker je ca. 17 %, ohne Banditen-Nieten.

Die Workshop-Übersicht zeigt die Chancen pro Wertkarte. Wenn keine platzierbaren Karten oder Packs vorhanden sind und die benötigten Rohstoffe nicht produziert werden können, bietet das Spiel ein kostenloses Starthilfe-Pack mit Holzfäller, Windmühle und einem Forst oder Feld an.

Der **Karten-Shop** ist dauerhaft offen und bietet sofort vier verschiedene zufällige Karten, inklusive Joker und Banditen-Nieten; Landschafts-Tiles und Banditencamps sind nicht erhältlich. Alle fünf aktiven Spielminuten wird das Angebot erneuert. Der Preis hängt weiterhin vom Kartentyp ab: regulär 80, 200 oder 400 Gold; mit 25 % Rabatt 60, 150 oder 300 Gold. Die Tile-Seltenheit wird erst beim Kauf ausgelost und verändert den Preis nicht. Jede angebotene Karte kann pro Angebot einmal gekauft werden und kommt ans Deckende. Angebote, Käufe und Restzeit werden gespeichert; bei geschlossenem oder unsichtbarem Spiel pausiert die Shop-Zeit.

## Banditen und Wachtürme

Ein Common-Wachturm schützt ein Quadrat von 7×7 Feldern um sich, Uncommon 9×9, Rare 11×11 und Epic 13×13. Er vertreibt vorhandene Camps in diesem Bereich beim Erscheinen und nach jedem Verschieben. Der Schutzbereich erscheint beim Antippen des Turms und im Verschiebe-Modus. Mit **🛡️ Schutz** lassen sich Schildsymbole auf allen geschützten Tiles ein- und ausblenden. Neue Spiele beginnen ohne Camps; Banditen-Nieten können später weiterhin Camps erzeugen.

Alle zehn Minuten aktiver Spielzeit versucht jedes vorhandene Camp gleichzeitig, ein zufälliges benachbartes ungeschütztes Feld zu übernehmen; auch diagonale Nachbarn zählen. Bei der Zielwahl werden belegte Tiles bevorzugt, ansonsten wird ein freies Feld gewählt. Der Pfeil zeigt das Ziel vorab; beim Antippen des Camps wird das Zielfeld rot hervorgehoben. Wird auf einem freien Zielfeld vor dem Angriff gebaut, wird das neue Tile übernommen. Ist kein Ziel verfügbar, erscheint kein Pfeil. Wenn ein Ziel geschützt oder zum Camp wird, wählt das Camp ein neues. Camps greifen nicht gleichzeitig dasselbe Feld an. Auf dem Ziel entsteht ein neues Camp, das erst beim nächsten Durchgang selbst angreift. Übernommene Gebäude produzieren nicht mehr. Der gemeinsame Countdown steht oben im Spiel und pausiert, wenn das Spiel geschlossen oder der Tab ausgeblendet ist. Rohstoffproduktion und Herstellungsaufträge laufen weiterhin offline.

Eine gezogene Banditen-Niete erscheint sofort auf einem zufälligen ungeschützten freien Feld und die Kamera springt dorthin. Falls kein solches Feld frei ist, wird ein ungeschütztes Tile übernommen. Gibt es kein geeignetes Feld, wird die Niete ans Deckende gelegt. Wachtürme gibt es im HumanCity-Pack; Waffen sind noch nicht enthalten.

## Joker

Ein neuer Spielstand enthält je einen Lösch- und Verwandlungsjoker; im Entdecker-Pack können beide ebenfalls vorkommen. Löschen entfernt ein angetipptes Tile ohne Rückzahlung. Verwandeln wählt zufällig einen anderen Tile-Typ außer Landschafts-Tiles und Banditencamps; neue Nachbarschaften wirken auf die zukünftige Produktion. Banditencamps, das letzte Tile und das letzte Rathaus sind vor diesen Jokern geschützt.

Der **Schutz-Joker** schützt ein angetipptes freies oder belegtes Feld dauerhaft vor Banditen, auch wenn dort später ein anderes Tile steht oder ein Wachturm entfernt wird. Er kann auch auf bereits durch einen Wachturm geschützte Felder angewendet werden, nicht aber auf Banditencamps oder bereits dauerhaft geschützte Felder. Ein goldenes Schild zeigt den dauerhaften Schutz, unabhängig vom Schutz-Anzeigeschalter. Banditen wählen gegebenenfalls sofort ein anderes Ziel. Ungültige Ziele verbrauchen keinen Joker; Joker können ans Deckende gelegt werden.

Der **Banditenzeit-Joker** wird sofort beim Ziehen verbraucht und setzt den globalen Banditen-Countdown auf zehn Minuten zurück. Bereits angekündigte Ziele bleiben erhalten; ein bereits ausgelöster Angriff wird nicht rückgängig gemacht. Die Kartenvorschau weist auf die sofortige Wirkung hin.

Der **Shop-Refresh-Joker** wird sofort beim Ziehen verbraucht, erneuert die vier Angebote und setzt den Shop-Timer auf fünf Minuten zurück.

Der **Freizug-Joker** wird sofort beim Ziehen verbraucht und gibt 5 Freizüge. Jeder Zug oder Tausch – egal wie weit – verbraucht dann zuerst einen Freizug statt Gold.
