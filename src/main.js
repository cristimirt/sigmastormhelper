// Entry point of the bundle. The loader (the small userscript in Tampermonkey) imports this file and calls the default
// export: ctx = { build, base, manifest, gmInfo }. It must only run once per page; the loader makes sure of that.
import { decorateHeader, grabVars, refreshDur } from './banner.js';
import { SSH, dropEarly, dropEarlyM } from './core/constants.js';
import { loadData } from './core/data.js';
import { installImgFix } from './core/imgfix.js';
import { pageParts } from './core/page.js';
import { repairPage } from './core/repair.js';
import { S } from './core/state.js';
import { bind } from './game/events.js';
import { read, show } from './game/loading.js';
import { initLive } from './layout/live.js';
import { initLayout } from './layout/profile.js';
import { rememberScripts } from './layout/sidebars.js';
import { initArtifactShop } from './pages/artifactshop.js';
import { initBank } from './pages/bank.js';
import { initBlacksmith } from './pages/blacksmith.js';
import { initCrafting } from './pages/crafting.js';
import { behemothPage, initBehemoth } from './pages/behemoth.js';
import { initDoppler, isDoppler } from './pages/dopplerarray.js';
import { initEvolve } from './pages/evolve.js';
import { initFactionInv } from './pages/factioninv.js';
import { initGuildManage } from './pages/guildmanage.js';
import { initHellforge } from './pages/hellforge.js';
import { initHome } from './pages/home.js';
import { initInventing } from './pages/inventing.js';
import { initRecruit, isRecruit } from './pages/recruit.js';
import { initRelicList, isRelicList } from './pages/reliclist.js';
import { initRelic } from './pages/relic.js';
import { initQuest } from './pages/quest.js';
import { initShop } from './pages/shop.js';
import { initSettings, movePanels, trimTail } from './settings.js';
import { initRecipes } from './tooltips/blueprints.js';
import { serverOffset } from './tooltips/energy.js';
import { initTips } from './tooltips/tips.js';
import { installCsrf } from './core/net.js';

// The game's top bar asks for Open Sans from a server that does not allow it (the browser blocks it): the copy that comes with the helper
// is used for that name instead (it is declared after the game's, so it wins).
function ownFont() {
  if (!S.base || document.getElementById('ssh-font')) return;
  const st = document.createElement('style');
  st.id = 'ssh-font';
  st.textContent = "@font-face{font-family:'Open Sans';font-weight:400;font-style:normal;font-display:swap;src:url('" + S.base + "media/open_sans.woff') format('woff')}";
  (document.head || document.documentElement).appendChild(st);
}

async function init() {
  repairPage();
  if (!pageParts()) return;
  rememberScripts();
  ownFont();
  grabVars(document.documentElement.innerHTML);
  decorateHeader();
  movePanels();
  trimTail();
  initLayout();
  serverOffset();
  initTips();
  refreshDur(30000);
  initLive();
  if (/[?&]cmd=settings/.test(location.search)) { initSettings(); return; }
  if (/[?&]cmd=guild/.test(location.search) && /[?&]subcmd=inventory/.test(location.search) && /[?&]subcmd2=report/.test(location.search) && S.cfg.factionInv) { initFactionInv(); return; }
  if (document.querySelector('table[background*="latestnews_bg"]')) { initHome(); return; } // the Home page
  if (document.querySelector('form[id^="evolution-stat-"]')) { initEvolve(); return; } // the Evolve page
  if (document.querySelector('form[id^="mechanic-repair-"], form#mechanic-all')) { initBlacksmith(); return; } // the Blacksmith page
  if (document.getElementById('engineering-upgrade') || document.querySelector('td[data-engineering-id]')) { initHellforge(); return; } // the Engineering page
  if (document.getElementById('augmentation-selected')) { initCrafting(); return; } // the Item Augmentation page
  if (document.querySelector('td[background*="header_factionmanage"]')) { initGuildManage(); return; } // the Manage Faction page
  if (behemothPage()) { initBehemoth(behemothPage()); return; } // Behemoth Rewards / Behemoth Kills
  if (isDoppler()) { initDoppler(); return; } // the Doppler Array
  if (isRecruit()) { initRecruit(); return; } // the faction's recruitment page
  if (isRelicList()) { initRelicList(); return; } // the list of all artifacts
  if (document.getElementById('relic-capture')) { initRelic(); return; } // an artifact's page
  if (document.querySelector('.cf-body td[background*="header_shop"]') && document.querySelector('#tabs form[id^="shop-buy-"]')) { initShop(); return; } // a shop (opened with a POST: no cmd in the address)
  if (document.querySelector('form[id^="artifact-buy-"]')) { initArtifactShop(); return; } // the faction's Artifact Shop
  if (/[?&]cmd=bank/.test(location.search) || document.getElementById('deposit_amount')) { initBank(); return; } // also the page a deposit or an action-list button posts to
  if (/[?&]cmd=questbook/.test(location.search) && /[?&]subcmd=viewquest/.test(location.search)) { initQuest(); return; }
  // the blueprint list: by its address, or by its markup (opened from the map it is the answer to a POST, with no cmd in the address)
  if ((/[?&]cmd=inventing/.test(location.search) && !/[?&]subcmd=[^&]/.test(location.search)) || document.getElementById('assembly-move-blueprints')) { initRecipes(); initInventing(); return; }
  if (S.cfg.modernMap === false) { dropEarly(); return; } // the setting "Modern map" is off: the game's own map
  const info = read(document);
  if (!info.loc || !document.getElementById('mapDiv')) { dropEarly(); return; } // not the world page
  bind();
  if (!(await show(info))) {
    dropEarly();
    console.warn('[Sigmastorm Helper] could not load the area map');
  }
}

export default async function start(ctx) {
  installCsrf();
  installImgFix();
  S.build = (ctx && ctx.build) || 'dev';
  S.base = (ctx && ctx.base) || ''; // the site the bundle comes from: its media/ folder has pictures of the helper's own
  await loadData(ctx);
  // whatever happens, the page is shown again (the loader hides it while the Modern layout is built)
  const go = () => init().catch((e) => console.error('[Sigmastorm Helper]', e)).finally(dropEarlyM);
  SSH.init = init;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
  else go();
}
