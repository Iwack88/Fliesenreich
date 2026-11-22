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

export const BASE_CAPACITY = { gold: 300, holz: 100, korn: 100 };
export const STORAGE_BONUS = 50;
export const START_RESOURCES = { holz: 8, korn: 8 };
export const PRODUCTION_INTERVAL = 10000;
export const BANDIT_INTERVAL = 10 * 60 * 1000;
export const START_BANDITS = 2;
export const EXPANSION_BANDITS = 2;
export const GUARD_RADIUS = 3;
export const SHOP_INTERVAL = 5 * 60 * 1000;
export const SHOP_DURATION = 60 * 1000;
export const SHOP_OFFER_COUNT = 4;
export const SHOP_DISCOUNT = 0.25;
export const SHOP_PRICES = { common: 80, uncommon: 200, rare: 400 };

// Zwei Karten pro Pack sind garantiert keine Grundkarten oder Nieten.
export const PACK_FILLER_TYPES = ['gras', 'erde', 'wasser', 'banditen_niete'];
export const PACK_MIN_SPECIAL = 2;

// Gewichte bestimmen die Ziehungen innerhalb des jeweiligen Kartenpools.
export const PACKS = {
  natur: {
    name: 'Landschafts-Pack', cost: { holz: 20, korn: 15 }, duration: 180000, cards: 5,
    weights: { gras: 26, erde: 25, wasser: 25, feld: 7, wald: 7, haus: 6, lagerhalle: 2, kornlager: 1, goldlager: 1, werkzeugschmiede: 2, banditen_niete: 2, joker_schutz: 1, joker_banditenzeit: 1 },
  },
  basis: {
    name: 'Entdecker-Pack', cost: { holz: 35, korn: 25 }, duration: 360000, cards: 5,
    weights: { gras: 20, erde: 24, wasser: 24, feld: 6, wald: 6, haus: 6, windmuehle: 2, holzfaeller: 2, taverne: 2, joker_loeschen: 1, joker_verwandeln: 1, workshop: 2, lagerhalle: 2, kornlager: 1, goldlager: 1, werkzeugschmiede: 2, banditen_niete: 2, joker_schutz: 1, joker_banditenzeit: 1 },
  },
  humancity: {
    name: 'HumanCity-Pack', cost: { holz: 50, korn: 35 }, duration: 540000, cards: 5,
    weights: { gras: 15, erde: 15, wasser: 15, banditen_niete: 5, haus: 30, taverne: 12, wachturm: 8, lagerhalle: 1, kornlager: 1, goldlager: 2, werkzeugschmiede: 2, joker_schutz: 1, joker_banditenzeit: 1 },
  },
  joker: {
    name: 'Joker-Pack', cost: { gold: 250 }, duration: 360000, cards: 5,
    weights: { joker_loeschen: 1, joker_verwandeln: 1, joker_schutz: 1, joker_banditenzeit: 1 },
  },
};

export const GOLD_ICON = '🪙';

export const RARITY = {
  common:   { name: 'Common', color: '#f5f2e9', weight: 70, strength: 1 },
  uncommon: { name: 'Uncommon', color: '#52b765', weight: 20, strength: 2 },
  rare:     { name: 'Rare', color: '#4b8ce8', weight: 8, strength: 3 },
  epic:     { name: 'Epic', color: '#a962dc', weight: 2, strength: 4 },
};

// gives beschreibt die Stärke benachbarter Paare (auch diagonal).
export const TILES = {
  gras:         { name: 'Gras',        color: '#6bbf59', icon: '',   rarity: 'common',   category: 'landschaft' },
  erde:         { name: 'Erde',        color: '#8a6a47', icon: '',   rarity: 'common',   category: 'landschaft' },
  wasser:       { name: 'Wasser',      color: '#4a90d9', icon: '💧', rarity: 'common',   category: 'landschaft' },
  wald:         { name: 'Wald',        color: '#2e7d32', icon: '🌲', rarity: 'common',   category: 'landschaft' },
  feld:         { name: 'Feld',        color: '#d9c35a', icon: '🌱', rarity: 'common',   category: 'landschaft' },
  holzfaeller:  { name: 'Holzfäller',  color: '#a1662f', icon: '🪓', rarity: 'common', shopTier: 'uncommon', category: 'industrie', gives: { wald: 1 } },
  windmuehle:   { name: 'Windmühle',   color: '#c9b8a0', icon: '🌬️', rarity: 'common', shopTier: 'uncommon', category: 'industrie', gives: { feld: 1 } },
  haus:         { name: 'Haus',        color: '#d3a97b', icon: '🏠', rarity: 'common',   category: 'siedlung', gives: { haus: 1 } },
  taverne:      { name: 'Taverne',     color: '#ad714a', icon: '🍺', rarity: 'common', shopTier: 'uncommon', category: 'siedlung', gives: { haus: 2 } },
  workshop:     { name: 'Workshop',    color: '#b67b50', icon: '🛠️', rarity: 'common', category: 'industrie' },
  lagerhalle:   { name: 'Holzlager',   color: '#9b8c76', icon: '🪵', rarity: 'common', shopTier: 'uncommon', category: 'industrie', storage: 'holz' },
  kornlager:    { name: 'Kornlager',   color: '#bda95c', icon: '🌾', rarity: 'common', shopTier: 'uncommon', category: 'industrie', storage: 'korn' },
  goldlager:    { name: 'Goldlager',   color: '#c69b39', icon: '🪙', rarity: 'common', shopTier: 'uncommon', category: 'industrie', storage: 'gold' },
  werkzeugschmiede: { name: 'Werkzeugschmiede', color: '#896960', icon: '⚒️', rarity: 'common', shopTier: 'uncommon', category: 'industrie' },
  wachturm:     { name: 'Wachturm',    color: '#a4b7c8', icon: '🗼', rarity: 'common', shopTier: 'uncommon', category: 'verteidigung' },
  banditen:     { name: 'Banditencamp', color: '#713d44', icon: '🏴', rarity: 'common', category: 'gefahr' },
};

export const JOKERS = {
  joker_loeschen: { name: 'Lösch-Joker', icon: '🗑️', color: '#b88bdb', rarity: 'rare' },
  joker_verwandeln: { name: 'Verwandlungs-Joker', icon: '✨', color: '#b88bdb', rarity: 'rare' },
  joker_schutz: { name: 'Schutz-Joker', icon: '🛡️', color: '#b88bdb', rarity: 'rare' },
  joker_banditenzeit: { name: 'Banditenzeit-Joker', icon: '⏳', color: '#b88bdb', rarity: 'rare' },
};

export const HAZARDS = {
  banditen_niete: { name: 'Banditen-Niete', icon: '🏴', color: '#713d44', rarity: 'common' },
};

export const CARDS = { ...TILES, ...JOKERS, ...HAZARDS };

export const START_TILE = 'workshop';
