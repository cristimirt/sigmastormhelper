// Words for the steps of a route. `step` is what the router returns: { from, edge, walk, cost }.
const coord = (x, y) => '(' + x + ',' + y + ')';
const isWalk = (kind) => kind === 'stairs' || kind === 'exit' || kind === 'portal';

// A world map is shown with its level in brackets, the way the game sorts its portal menu.
export function worldMap(router, name) {
  const a = router.byName[name];
  return a && a.kind === 'master' ? name + ' [' + a.level + ']' : name;
}

// Moves from where you stand to the tile the step starts on.
export function liveWalk(step, tile) {
  const e = step.edge;
  if (!isWalk(e.kind) || !tile || e.x == null) return 0;
  return Math.max(Math.abs(tile[0] - e.x), Math.abs(tile[1] - e.y));
}

export const startsOnTile = (step) => isWalk(step.edge.kind);

// The next step, shown big: { lead, main, sub }.
export function stepMain(router, step) {
  const e = step.edge;
  const wm = (n) => worldMap(router, n);
  if (e.kind === 'stairs') {
    return {
      lead: 'Take the stairs' + (e.x == null ? '' : ' at ' + coord(e.x, e.y)) + ' to',
      main: e.to,
      sub: e.ax == null ? '' : 'you arrive at ' + coord(e.ax, e.ay),
    };
  }
  if (e.kind === 'portal') return { lead: 'Take the portal at ' + coord(e.x, e.y) + ' to', main: wm(e.to), sub: e.name + ', world map' };
  if (e.kind === 'free') return { main: 'Teleport to ' + e.to, sub: 'from anywhere, costs 25 stamina, you arrive at ' + coord(e.ax, e.ay) };
  if (e.kind === 'exit') return { main: 'Leave to the ' + wm(e.to) + ' world map', sub: e.x == null ? '' : 'exit tile ' + coord(e.x, e.y) };
  if (e.kind === 'enter') return { main: 'Enter ' + e.to, sub: 'from the ' + wm(step.from) + ' world map' + (e.x == null ? '' : ', you appear at ' + coord(e.x, e.y)) };
  return { main: 'Cross to the ' + wm(e.to) + ' world map', sub: 'neighbouring world maps' };
}

// One line for a step further along the route.
export function stepShort(router, step) {
  const e = step.edge;
  const wm = (n) => worldMap(router, n);
  if (e.kind === 'stairs') return 'Stairs ' + (e.x == null ? '' : coord(e.x, e.y) + ' ') + '→ ' + e.to;
  if (e.kind === 'portal') return 'Portal ' + coord(e.x, e.y) + ' → ' + wm(e.to) + ' world map';
  if (e.kind === 'free') return 'Teleport → ' + e.to;
  if (e.kind === 'exit') return 'Leave to ' + wm(e.to) + ' world map';
  if (e.kind === 'enter') return 'Enter ' + e.to;
  return 'Cross to ' + wm(e.to) + ' world map';
}
