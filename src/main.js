// Entry point of the bundle. The loader (the small userscript in Tampermonkey) imports this file and calls the default
// export: ctx = { build, base, manifest, gmInfo }. It must only run once per page; the loader makes sure of that.
import { decorateHeader, grabVars, refreshDur } from './banner.js';
import { SSH, dropEarly } from './core/constants.js';
import { loadData } from './core/data.js';
import { pageParts } from './core/page.js';
import { S } from './core/state.js';
import { bind } from './game/events.js';
import { read, show } from './game/loading.js';
import { initLayout } from './layout/profile.js';
import { initInventing } from './pages/inventing.js';
import { initSettings, movePanels, trimTail } from './settings.js';
import { initRecipes } from './tooltips/blueprints.js';
import { serverOffset } from './tooltips/energy.js';
import { initTips } from './tooltips/tips.js';

async function init() {
  if (!pageParts()) return;
  grabVars(document.documentElement.innerHTML);
  decorateHeader();
  movePanels();
  trimTail();
  initLayout();
  serverOffset();
  initTips();
  refreshDur(30000);
  if (/[?&]cmd=settings/.test(location.search)) { initSettings(); return; }
  if (/[?&]cmd=inventing/.test(location.search) && !/[?&]subcmd=[^&]/.test(location.search)) { initRecipes(); initInventing(); return; }
  const info = read(document);
  if (!info.loc || !document.getElementById('mapDiv')) { dropEarly(); return; } // not the world page
  bind();
  if (!(await show(info))) {
    dropEarly();
    console.warn('[Sigmastorm Helper] could not load the area map');
  }
}

export default async function start(ctx) {
  S.build = (ctx && ctx.build) || 'dev';
  S.base = (ctx && ctx.base) || ''; // the site the bundle comes from: its media/ folder has pictures of the helper's own
  await loadData(ctx);
  SSH.init = init;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}
