import { TILES, RARITY, TICK_MS } from './config.js';
import { newState, spawnTile, moveTargets, moveTile, tick, sellAll, nextCost, tileAt, buffCount, hasUnplaced, placeTile } from './logic.js';

const SAVE_KEY = 'fliesenreich-save-v1';
const TILE = 96;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);

let state = load() || newState();
let cam = { x: TILE / 2, y: TILE / 2, zoom: 1 };
let selected = null;   // Tile
let targets = [];      // mögliche Zielfelder
let pending = null;    // gewähltes Ziel
let dpr = 1;

const images = {};
for (const id of Object.keys(TILES)) {
  const img = new Image();
  img.onload = () => { images[id] = img; };
  img.src = `assets/tiles/${id}.png`;
}

function load() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return null; }
}
function save() { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }

function resize() {
  dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
}
addEventListener('resize', resize);
resize();

const toWorld = (sx, sy) => ({
  x: (sx - innerWidth / 2) / cam.zoom + cam.x,
  y: (sy - innerHeight / 2) / cam.zoom + cam.y,
});
const toCell = (sx, sy) => {
  const w = toWorld(sx, sy);
  return { x: Math.floor(w.x / TILE), y: Math.floor(w.y / TILE) };
};

// ---------- Eingabe: Drag, Pinch, Tippen ----------
const pointers = new Map();
let dragMoved = 0, pinchDist = 0;

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  dragMoved = 0;
  if (pointers.size === 2) pinchDist = pointerDistance();
});
canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX; p.y = e.clientY;
  dragMoved += Math.abs(dx) + Math.abs(dy);
  if (pointers.size === 1) {
    cam.x -= dx / cam.zoom;
    cam.y -= dy / cam.zoom;
  } else if (pointers.size === 2) {
    const d = pointerDistance();
    if (pinchDist) setZoom(cam.zoom * d / pinchDist);
    pinchDist = d;
  }
});
canvas.addEventListener('pointerup', (e) => {
  const wasSingle = pointers.size === 1;
  pointers.delete(e.pointerId);
  if (wasSingle && dragMoved < 10) onTap(e.clientX, e.clientY);
});
canvas.addEventListener('pointercancel', (e) => pointers.delete(e.pointerId));
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  setZoom(cam.zoom * (e.deltaY < 0 ? 1.1 : 0.9));
}, { passive: false });

function pointerDistance() {
  const [a, b] = [...pointers.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function setZoom(z) { cam.zoom = Math.min(2.5, Math.max(0.4, z)); }

function onTap(sx, sy) {
  const c = toCell(sx, sy);
  const target = targets.find(t => t.x === c.x && t.y === c.y);
  if (selected && target) { pending = target; updatePanel(); return; }
  const tile = tileAt(state, c.x, c.y);
  if (tile) { select(tile); } else { deselect(); }
}

function select(tile) {
  selected = tile;
  pending = null;
  targets = moveTargets(state, tile);
  updatePanel();
}
function deselect() {
  selected = null; pending = null; targets = [];
  updatePanel();
}

// ---------- UI ----------
function updatePanel() {
  const panel = $('panel');
  if (!selected) { panel.classList.add('hidden'); return; }
  panel.classList.remove('hidden');
  const def = TILES[selected.type];
  const max = RARITY[def.rarity].maxMoves;
  let info = `<b>${def.icon} ${def.name}</b> (${RARITY[def.rarity].name})`;
  if (selected.unplaced) info += ` – Moves: ${selected.movesLeft}/${max}`;
  const buffs = buffCount(state, selected);
  if (def.buffedBy) info += ` – Buffs: ${buffs}`;
  if (pending) info += `<br>Kosten: ${pending.cost} Move → danach ${selected.movesLeft - pending.cost} übrig`;
  else if (selected.unplaced) info += targets.length ? '<br>Grünes Feld antippen zum Verschieben oder hier Place drücken' : '<br>Kein Zielfeld möglich – Place drücken';
  $('panel-info').innerHTML = info;
  $('btn-place').style.display = selected.unplaced ? '' : 'none';
}

function updateHud() {
  for (const r of ['gold', 'wood', 'grain']) $('r-' + r).textContent = Math.floor(state[r]);
  const cost = nextCost(state);
  $('btn-next').textContent = `Next (${cost} 🪙)`;
  $('btn-next').disabled = state.gold < cost || hasUnplaced(state);
  $('btn-sell').disabled = state.wood + state.grain < 1;
}

let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1500);
}

$('btn-next').onclick = () => {
  const t = spawnTile(state);
  if (t) { cam.x = (t.x + 0.5) * TILE; cam.y = (t.y + 0.5) * TILE; select(t); save(); }
};
$('btn-sell').onclick = () => { toast(`+${sellAll(state)} 🪙`); save(); };
$('btn-place').onclick = () => {
  if (!selected || !selected.unplaced) return;
  if (pending) moveTile(state, selected, pending); else placeTile(selected);
  save();
  deselect();
};
$('btn-cancel').onclick = deselect;

// ---------- Zeichnen ----------
function drawTile(t, x, y, alpha = 1) {
  const def = TILES[t];
  ctx.globalAlpha = alpha;
  if (images[t]) {
    ctx.drawImage(images[t], x, y, TILE, TILE);
  } else {
    ctx.fillStyle = def.color;
    ctx.fillRect(x, y, TILE, TILE);
    if (def.icon) {
      ctx.font = `${TILE * 0.5}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#000';
      ctx.fillText(def.icon, x + TILE / 2, y + TILE / 2);
    }
  }
  ctx.strokeStyle = 'rgba(0,0,0,.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, TILE, TILE);
  ctx.globalAlpha = 1;
}

function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#1b2a1f';
  ctx.fillRect(0, 0, innerWidth, innerHeight);
  ctx.translate(innerWidth / 2, innerHeight / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);

  for (const t of Object.values(state.tiles)) {
    const moving = pending && t === selected;
    drawTile(t.type, t.x * TILE, t.y * TILE, moving ? 0.35 : 1);
    const buffs = buffCount(state, t);
    if (buffs) {
      ctx.fillStyle = '#ffd54f';
      ctx.font = `bold ${TILE * 0.22}px sans-serif`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(`+${buffs}`, t.x * TILE + 6, t.y * TILE + 4);
    }
    if (t.unplaced) {
      ctx.fillStyle = '#fff';
      ctx.font = `${TILE * 0.2}px sans-serif`;
      ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      ctx.fillText(`↔${t.movesLeft}`, (t.x + 1) * TILE - 6, (t.y + 1) * TILE - 4);
    }
  }

  for (const g of targets) {
    const isPending = pending === g;
    ctx.fillStyle = isPending ? 'rgba(255,255,255,.35)' : 'rgba(60,220,90,.45)';
    ctx.fillRect(g.x * TILE, g.y * TILE, TILE, TILE);
    ctx.strokeStyle = isPending ? '#fff' : '#3cdc5a';
    ctx.lineWidth = 3;
    ctx.strokeRect(g.x * TILE + 2, g.y * TILE + 2, TILE - 4, TILE - 4);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${TILE * 0.35}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(g.cost, (g.x + 0.5) * TILE, (g.y + 0.5) * TILE);
  }
  if (pending) drawTile(selected.type, pending.x * TILE, pending.y * TILE, 0.8);

  if (selected) {
    ctx.strokeStyle = '#ffeb3b';
    ctx.lineWidth = 4;
    ctx.strokeRect(selected.x * TILE, selected.y * TILE, TILE, TILE);
  }
}

function frame() {
  draw();
  updateHud();
  requestAnimationFrame(frame);
}

setInterval(() => { tick(state); save(); }, TICK_MS);
updatePanel();
frame();
