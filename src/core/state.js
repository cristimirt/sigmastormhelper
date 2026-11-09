import { SSH, ZOOM_MAX, ZOOM_MIN } from './constants.js';
import { store } from './storage.js';

export const S = {
  zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, store.get('zoom', 1))),
  loc: null, // { area, x, y }
  moves: [], // [{ x, y, href, cost, title }]
  areas: new Map(), // area name -> { cols, rows, cells: [{ bg, tip }] }
  areaUrl: null,
  busy: false,
  viewer: null,
  pan: { x: 0, y: 0 },
};

SSH.S = S;

export const CFG_DEFAULT = { modernMap: true, route: true, fastWalk: true, stopOnCreatures: false, creatureColors: true, hotkeyChampion: false, hotkeyElite: false, hotkeyHK: true, hotkeyBehemoth: false, stepDelay: 320, slide: true, bannerNums: true, durBar: true, gearCompare: true, movePanels: true, factionInv: true, pathfinder: true, live: true, stairMarks: true };

S.cfg = Object.assign({}, CFG_DEFAULT, store.get('cfg', {}));
if (S.cfg.noHkHotkey === true && !('hotkeyHK' in store.get('cfg', {}))) S.cfg.hotkeyHK = false; // the older setting "No attack hotkey for HK creatures"

S.learn = store.get('learn', null) || { tiles: {}, over: {} };

if (!S.learn.tiles) S.learn.tiles = {};

if (!S.learn.over) S.learn.over = {};
