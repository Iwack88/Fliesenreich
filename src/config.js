// Alle Spielwerte an einer Stelle. Neue Tiles hier ergänzen.
// Grafik: optional assets/tiles/<id>.png ablegen, sonst wird Farbe + Emoji genutzt.

export const START_GOLD = 20;
export const SHUFFLE_COST = 5; // Gold pro Shuffle

// Start-Deck (Karten pro Tile-Typ, wird beim ersten Start gemischt).
export const START_DECK = { gras: 2, wald: 4, feld: 4, holzfaeller: 2, windmuehle: 2, wasser: 1, erde: 1 };

export const RARITY_ORDER = ['common', 'uncommon', 'rare'];

// Kartenpacks: Kosten in Gold, Anzahl Karten (Typ nach weight, begrenzt durch maxRarity).
export const PACKS = {
  natur: { name: 'Natur-Pack', cost: 8, cards: 5, maxRarity: 'common' },
  basis: { name: 'Basis-Pack', cost: 15, cards: 5, maxRarity: 'uncommon' },
};

export const GOLD_ICON = '🪙';

export const RARITY = {
  common:   { name: 'Gewöhnlich' },
  uncommon: { name: 'Selten' },
  rare:     { name: 'Episch' },
};

// gives: Gold-Bonus pro Nachbar-Typ (8 Felder rundherum). Wird einmal ausgezahlt, sobald das Paar entsteht
// (egal welches Tile zuerst lag). Gleiche Typen zählen als ein Paar (Feld an Feld = einmal +1);
// bei verschiedenen Typen werden die gives beider Seiten addiert.
export const TILES = {
  gras:         { name: 'Gras',        color: '#6bbf59', icon: '',   rarity: 'common',   weight: 30 },
  erde:         { name: 'Erde',        color: '#8a6a47', icon: '',   rarity: 'common',   weight: 15 },
  wasser:       { name: 'Wasser',      color: '#4a90d9', icon: '💧', rarity: 'common',   weight: 15 },
  wald:         { name: 'Wald',        color: '#2e7d32', icon: '🌲', rarity: 'common',   weight: 20, gives: { wald: 1 } },
  feld:         { name: 'Feld',        color: '#d9c35a', icon: '🌱', rarity: 'common',   weight: 20, gives: { feld: 1 } },
  holzfaeller:  { name: 'Holzfäller',  color: '#a1662f', icon: '🪓', rarity: 'uncommon', weight: 8,  gives: { wald: 2 } },
  windmuehle:   { name: 'Windmühle',   color: '#c9b8a0', icon: '🌬️', rarity: 'uncommon', weight: 8,  gives: { feld: 2 } },
};

export const START_TILE = 'gras';
