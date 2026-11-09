// The kinds of creature the helper tells apart by the end of the name, and the colour of each (Action List, settings page).
export const CREATURE_TYPES = [
  { key: 'champion', label: 'Champion', suffix: '(Champion)', color: '#b57bff' },
  { key: 'elite', label: 'Elite', suffix: '(Elite)', color: '#ffd23f' },
  { key: 'hk', label: 'HK', suffix: '(HK)', color: '#ff5a5a' },
  { key: 'behemoth', label: 'Behemoth', suffix: '(Behemoth)', color: '#5aa9ff' },
];
// The kind of creature a name says it is ('' for a normal one).
export const typeOf = (name) => {
  const m = String(name).replace(/\s+/g, ' ').trim().match(/(?:\((Champion|Elite|HK|Behemoth)\)|(?:^|\s)(HK))$/i);
  return m ? (m[1] || m[2]).toLowerCase() : '';
};
export const hotkeyOn = (cfg, key) => !!cfg['hotkey' + ({ champion: 'Champion', elite: 'Elite', hk: 'HK', behemoth: 'Behemoth' }[key])];
export const TYPE_COLOR = Object.fromEntries(CREATURE_TYPES.map((t) => [t.key, t.color]));
