// Hide the original map and action list right away (before the page paints) on the world page,
// so the old map never flashes. Removed again if our own map cannot be built.
// The game's own map frame (first 3 rows after #mapDiv) and the zone title bar are replaced by our viewer.
export const HIDE_CSS = '#mapDiv,#actionDiv,#actionDiv+table,#mapDiv+table>tbody>tr:nth-child(-n+3),td[background*="coord_bg"]{display:none!important}';

export const dropEarly = () => { const e = document.getElementById('ssh-early'); if (e) e.remove(); };

export const SSH = (window.__ssh = {});

export const VERSION = '1.0';

export const TILE = 65; // size of one map tile in px (native)

export const PREFIX = 'SSH_';

export const ZOOM_MIN = 0.35;

export const ZOOM_MAX = 1.8;

export const dropEarlyM = () => { const e = document.getElementById('ssh-early-m'); if (e) e.remove(); };
