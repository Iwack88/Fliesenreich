// Alle Spielwerte an einer Stelle. Neue Tiles hier ergänzen.
// Grafik: optional assets/tiles/<id>.png ablegen, sonst wird Farbe + Emoji genutzt.

export const START_GOLD = 100;
export const SHUFFLE_COST = 5; // Gold pro Shuffle
export const START_SIZE = 8;
export const EXPANDED_SIZE = 16;
export const START_OBSTACLES = 12;
export const EXPANSION_OBSTACLES = 36;
export const EXPANSION_COST = 30;
export const OBSTACLE_TYPES = ['gras', 'erde', 'wasser'];

// Start-Deck (Karten pro Typ, wird beim ersten Start gemischt).
export const START_DECK = { gras: 1, erde: 1, wasser: 1, wald: 2, feld: 2, holzfaeller: 1, windmuehle: 1, lagerhalle: 1, joker_loeschen: 1, joker_verwandeln: 1 };

export const RESOURCE_CAP = 100;
export const START_RESOURCES = { holz: 8, korn: 8 };
export const PRODUCTION_INTERVAL = 10000;

// Zwei Karten pro Pack sind garantiert keine dieser Grundkarten.
export const PACK_FILLER_TYPES = ['gras', 'erde', 'wasser'];
export const PACK_MIN_SPECIAL = 2;

// Gewichte bestimmen die Ziehungen innerhalb des jeweiligen Kartenpools.
export const PACKS = {
  natur: {
    name: 'Landschafts-Pack', cost: { holz: 3, korn: 2 }, duration: 30000, cards: 5,
    weights: { gras: 28, erde: 25, wasser: 25, feld: 7, wald: 7, haus: 6, lagerhalle: 2 },
  },
  basis: {
    name: 'Entdecker-Pack', cost: { holz: 6, korn: 5 }, duration: 60000, cards: 5,
    weights: { gras: 22, erde: 24, wasser: 24, feld: 6, wald: 6, haus: 6, windmuehle: 2, holzfaeller: 2, taverne: 2, joker_loeschen: 1, joker_verwandeln: 1, workshop: 2, lagerhalle: 2 },
  },
};

export const GOLD_ICON = '🪙';

export const RARITY = {
  common:   { name: 'Gewöhnlich' },
  uncommon: { name: 'Selten' },
  rare:     { name: 'Episch' },
};

// gives beschreibt die Stärke benachbarter Paare (auch diagonal).
export const TILES = {
  gras:         { name: 'Gras',        color: '#6bbf59', icon: '',   rarity: 'common',   category: 'landschaft' },
  erde:         { name: 'Erde',        color: '#8a6a47', icon: '',   rarity: 'common',   category: 'landschaft' },
  wasser:       { name: 'Wasser',      color: '#4a90d9', icon: '💧', rarity: 'common',   category: 'landschaft' },
  wald:         { name: 'Wald',        color: '#2e7d32', icon: '🌲', rarity: 'common',   category: 'landschaft' },
  feld:         { name: 'Feld',        color: '#d9c35a', icon: '🌱', rarity: 'common',   category: 'landschaft' },
  holzfaeller:  { name: 'Holzfäller',  color: '#a1662f', icon: '🪓', rarity: 'uncommon', category: 'industrie', gives: { wald: 1 } },
  windmuehle:   { name: 'Windmühle',   color: '#c9b8a0', icon: '🌬️', rarity: 'uncommon', category: 'industrie', gives: { feld: 1 } },
  haus:         { name: 'Haus',        color: '#d3a97b', icon: '🏠', rarity: 'common',   category: 'siedlung', gives: { haus: 1 } },
  taverne:      { name: 'Taverne',     color: '#ad714a', icon: '🍺', rarity: 'uncommon', category: 'siedlung', gives: { haus: 2 } },
  workshop:     { name: 'Workshop',    color: '#b67b50', icon: '🛠️', rarity: 'common', category: 'industrie' },
  lagerhalle:   { name: 'Lagerhalle',  color: '#9b8c76', icon: '📦', rarity: 'uncommon', category: 'industrie' },
};

export const JOKERS = {
  joker_loeschen: { name: 'Lösch-Joker', icon: '🗑️', color: '#b88bdb', rarity: 'rare' },
  joker_verwandeln: { name: 'Verwandlungs-Joker', icon: '✨', color: '#b88bdb', rarity: 'rare' },
};

export const CARDS = { ...TILES, ...JOKERS };

export const START_TILE = 'workshop';
