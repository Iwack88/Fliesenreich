// Alle Spielwerte an einer Stelle. Neue Tiles hier ergänzen.
// Grafik: optional assets/tiles/<id>.png ablegen, sonst wird Farbe + Emoji genutzt.

export const START_GOLD = 100;
export const SHUFFLE_COST = 5; // Gold pro Shuffle
export const START_SIZE = 8;
export const EXPANDED_SIZE = 16;
export const EXPANSION_COST = 30;
// Spezial-Bauplätze: Anteil freier Felder und Mindestabstand zum Startbereich.
export const SPECIAL_SLOT_SHARE = 0.08;
export const SPECIAL_SLOT_CLEARANCE = 2;
export const LAND_TYPES = ['gras', 'erde', 'wasser', 'berge'];

// Start-Deck (Karten pro Typ, wird beim ersten Start gemischt).
export const START_DECK = { gras: 1, erde: 1, wasser: 1, berge: 1, wald: 2, feld: 2, holzfaeller: 1, windmuehle: 1, lagerhalle: 1, joker_loeschen: 1, joker_verwandeln: 1 };

export const BASE_CAPACITY = { gold: 300, holz: 100, korn: 100 };
export const RESOURCE_CHAINS = {
  holz: ['wald', 'holzfaeller', 'lagerhalle'],
  korn: ['feld', 'windmuehle', 'kornlager'],
  gold: ['haus', 'taverne', 'goldlager'],
};
export const STORAGE_BONUS = 50;
export const START_RESOURCES = { holz: 8, korn: 8 };
export const PRODUCTION_INTERVAL = 10000;
export const BANDIT_INTERVAL = 10 * 60 * 1000;
export const GUARD_RADIUS = 3;
// Produzenten benötigen passende Nachbarn; ohne diese laufen sie im Notbetrieb.
export const SUPPLY_CHAINS = {
  holzfaeller: { supplier: 'wald', resource: 'holz' },
  windmuehle: { supplier: 'feld', resource: 'korn' },
};
export const MIN_SUPPLIERS = 2;
export const SUPPLIER_OUTPUT = 2;
export const EMERGENCY_RATE = 0.25;
export const SHOP_INTERVAL = 5 * 60 * 1000;
export const SHOP_OFFER_COUNT = 4;
export const SHOP_DISCOUNT = 0.25;
export const SHOP_PRICES = { common: 80, uncommon: 200, rare: 400 };

// Jedes Pack enthält feste Landkarten, eine garantierte Wertkarte und mit extraChance eine zweite.
// Mit hazardChance ersetzt eine Banditen-Niete eine der Landkarten.
export const PACK_LAND_WEIGHTS = { gras: 3, erde: 3, wasser: 3, berge: 1 };
export const PACKS = {
  natur: {
    name: 'Landschafts-Pack', cost: { holz: 30, korn: 25 }, duration: 4 * 60000,
    land: 4, extraChance: 0.4, hazardChance: 0.1,
    weights: { wald: 32, feld: 32, haus: 14, lagerhalle: 6, kornlager: 6, goldlager: 3, werkzeugschmiede: 3, joker_schutz: 2, joker_banditenzeit: 1, joker_shop: 1 },
  },
  basis: {
    name: 'Entdecker-Pack', cost: { holz: 55, korn: 45 }, duration: 8 * 60000,
    land: 3, extraChance: 0.4, hazardChance: 0.1,
    weights: { holzfaeller: 18, windmuehle: 18, wald: 10, feld: 10, werkzeugschmiede: 8, workshop: 7, lagerhalle: 7, kornlager: 7, taverne: 5, joker_loeschen: 4, joker_verwandeln: 4, joker_schutz: 2 },
  },
  humancity: {
    name: 'HumanCity-Pack', cost: { holz: 75, korn: 55 }, duration: 12 * 60000,
    land: 3, extraChance: 0.4, hazardChance: 0.15,
    weights: { haus: 45, taverne: 22, wachturm: 15, goldlager: 10, joker_schutz: 4, joker_banditenzeit: 4 },
  },
  joker: {
    name: 'Joker-Pack', cost: { gold: 350 }, duration: 8 * 60000,
    land: 3, extraChance: 0.4, hazardChance: 0,
    weights: { joker_loeschen: 1, joker_verwandeln: 1, joker_schutz: 1, joker_banditenzeit: 1, joker_shop: 1 },
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
  berge:        { name: 'Berge',       color: '#8b9090', icon: '⛰️', rarity: 'common',   category: 'landschaft' },
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
  joker_shop: { name: 'Shop-Refresh-Joker', icon: '🔄', color: '#b88bdb', rarity: 'rare' },
};

export const HAZARDS = {
  banditen_niete: { name: 'Banditen-Niete', icon: '🏴', color: '#713d44', rarity: 'common' },
};

export const CARDS = { ...TILES, ...JOKERS, ...HAZARDS };

export const START_TILE = 'workshop';
