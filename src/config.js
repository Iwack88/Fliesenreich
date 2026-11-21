// Alle Spielwerte an einer Stelle. Neue Tiles hier ergänzen.
// Grafik: optional assets/tiles/<id>.png ablegen, sonst wird Farbe + Emoji genutzt.

export const TICK_MS = 1000;
export const START_GOLD = 30;
export const NEXT_BASE_COST = 10;
export const NEXT_COST_STEP = 5;

export const RESOURCES = {
  gold:  { name: 'Gold',  icon: '🪙' },
  wood:  { name: 'Holz',  icon: '🪵', sellValue: 2 },
  grain: { name: 'Korn',  icon: '🌾', sellValue: 3 },
};

// Seltenheit bestimmt, wie oft ein Tile verschoben werden darf.
export const RARITY = {
  common:   { name: 'Gewöhnlich', maxMoves: 3 },
  uncommon: { name: 'Selten',     maxMoves: 2 },
  rare:     { name: 'Episch',     maxMoves: 1 },
};

// produces: Grundproduktion pro Tick (nur Gebäude, Landschafts-Tiles produzieren vorerst nichts).
// buffedBy: Nachbar-Tile (8 Felder rundherum) -> Bonus pro Nachbar.
export const TILES = {
  gras:         { name: 'Gras',        color: '#6bbf59', icon: '',   rarity: 'common',   weight: 30 },
  erde:         { name: 'Erde',        color: '#8a6a47', icon: '',   rarity: 'common',   weight: 15 },
  wasser:       { name: 'Wasser',      color: '#4a90d9', icon: '💧', rarity: 'common',   weight: 15 },
  wald:         { name: 'Wald',        color: '#2e7d32', icon: '🌲', rarity: 'common',   weight: 20 },
  feld:         { name: 'Feld',        color: '#d9c35a', icon: '🌱', rarity: 'common',   weight: 20 },
  holzfaeller:  { name: 'Holzfäller',  color: '#a1662f', icon: '🪓', rarity: 'uncommon', weight: 8,  produces: { wood: 0.2 },  buffedBy: { wald: 0.2 } },
  windmuehle:   { name: 'Windmühle',   color: '#c9b8a0', icon: '🌬️', rarity: 'uncommon', weight: 8,  produces: { grain: 0.2 }, buffedBy: { feld: 0.2 } },
};

export const START_TILE = 'gras';
