import { S } from '../core/state.js';
import { store } from '../core/storage.js';
import { bannerCss } from './header.js';
import { frameCss } from './frame.js';
import { sidebarCss } from './sidebars.js';
import { worldCss } from './worldpage.js';
import { quickCss } from '../game/quicklinks.js';

// Layout "orig" leaves the page alone. Layout "modern" builds the page again from the original markup with grid/flex.
// The original stays in the page, hidden, and is the source of truth: form controls in the new layout are proxies that
// click the original ones, and the game's own tooltip / click handlers are copied over. A theme only supplies pictures.
export const THEMES = {
  core: {
    name: 'Original Core',
    skin: 'https://cdn.sigmastorm.com/',
    img: { page: 'skin/large_content_bg.jpg', title: 'skin/yourprofile.jpg', foot: 'skin/large_content_footer.jpg', infoTop: 'skin/general_info.gif', infoBg: 'skin/general_info_bg.gif', infoBot: 'skin/long_bottom.gif', frameBg: 'inventory/profile_sub_bg.jpg', frameBot: 'inventory/profile_sub_bottom.jpg', slot: 'inventory/1x1mini.gif', fill: 'skin/skill_progress.gif' },
  },
};

S.layout = store.get('layout', 'orig') === 'modern' ? 'modern' : 'orig';

S.theme = THEMES[store.get('theme', 'core')] ? store.get('theme', 'core') : 'core';

export const onProfile = /[?&]cmd=profile/.test(location.search);

export function mCss() {
  const T = THEMES[S.theme];
  const u = (k) => 'url("' + T.skin + T.img[k] + '")';
  const P = '#ssh-prof ';
  const PB = ':is(#ssh-prof,#ssh-mm) '; // the backpack is also shown in a dialog (the world page)
  return 'html.ssh-modern [data-ssh-orig]{display:none!important}' + bannerCss() + frameCss(u('page')) + sidebarCss() + worldCss(u('page')) + quickCss() +
    P.trim() + '{display:none;width:640px;margin:0 auto;box-sizing:border-box;background:' + u('page') + ';font:8pt tahoma,sans-serif;color:#fff;}html.ssh-modern ' + P.trim() + '{display:block}' +
    P + '.pf-title{height:48px;background:' + u('title') + ' no-repeat center top}' +
    P + '.pf-foot{height:58px;background:' + (S.base ? 'url("' + S.base + 'media/large_content_footer.png")' : u('foot')) + ' no-repeat center top / 640px auto}' +
    P + '.pf-info{width:595px;margin:0 auto;background:' + u('infoBg') + '}' +
    P + '.pf-info .t{height:19px;background:' + u('infoTop') + ' no-repeat}' +
    P + '.pf-info .f{height:13px;background:' + u('infoBot') + ' no-repeat}' +
    P + '.pf-info .m{min-height:58px;display:flex;align-items:flex-end;justify-content:center;text-align:center}' +
    P + '.pf-cols{display:grid;grid-template-columns:295px 295px;column-gap:12px;justify-content:center;align-items:start}' +
    // the frame pictures are 295px wide (the game's 301px column repeated the 294px background, which drew a second border)
    P + '.col{background:' + u('frameBg') + ' repeat-y 0 0 / 295px 19px}' +
    P + '.hd{height:19px;background:var(--hd) no-repeat left top;display:flex;justify-content:flex-end;align-items:center;padding-right:12px;box-sizing:border-box}' +
    P + '.hx{font-size:8pt;white-space:nowrap}' +
    P + '.ft{height:22px;background:' + u('frameBot') + ' no-repeat}' +
    // statistics
    P + '.st{display:grid;grid-template-columns:74px 51px 6px 68px 52px;column-gap:2px;row-gap:2px;margin:5px 9px 0 15px;padding:2px 2px 2px 10px;box-sizing:border-box}' +
    P + '.st .k{font-size:8pt;height:15px;line-height:15px}' + P + '.st .v{height:15px;line-height:15px;white-space:nowrap}' +
    P + '.st .gap{grid-column:1/-1}' + P + '.st .e{grid-column:span 2}' +
    // enhancements / resistances
    P + '.bars{margin-top:5px;padding:2px;display:flex;flex-direction:column;gap:2px}' +
    P + '.bars .r{display:flex;align-items:center;justify-content:space-between}' +
    P + '.bars.enh .r{height:19px;padding:0 10px 0 14px}' + P + '.bars.res .r{height:21px;padding:0 6px 0 11px}' +
    P + '.bars .lb{display:flex;align-items:center;gap:4px}' + P + '.bars .lb img{display:block}' +
    P + '.bar{box-sizing:border-box;height:17px;border:1px solid #333;padding:2px 1px;overflow:hidden;flex:none}' +
    P + '.bar i{display:block;height:10px;background:' + u('fill') + ';background-size:100% 100%}' +
    // text sections
    P + '.tx{padding:5px 10px;min-height:19px;line-height:19px}' + P + '.tx.s-biography{padding:3px 17px 8px;min-height:0;line-height:normal}' + P + '.tx.s-enemies{padding:5px 15px;min-height:24px}' +
    P + '.deco{display:flex;flex-wrap:wrap;justify-content:center;padding:5px 0;box-sizing:border-box}' + P + '.deco>*{width:25%;padding:4px 0;text-align:center}' + P + '.deco img{display:block;margin:0 auto}' +
    P + '.ppl{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:5px 10px;min-height:26px;align-content:start}' + P + '.ppl .p{display:flex;align-items:center;justify-content:center;gap:4px}' +
    // inventory
    P + '.invw{padding:5px 0 0}' +
    P + '.inv{display:grid;grid-template-columns:61px 150px 45px;justify-content:space-between;width:280px;height:281px;margin:0 0 0 7px;padding:0 5px;box-sizing:border-box;background-repeat:no-repeat}' +
    P + '.lc{display:flex;flex-direction:column;align-items:center;gap:12px;margin-top:24px}' +
    P + '.doll{width:150px;height:250px;margin-top:12px;background-repeat:no-repeat}' +
    P + '.rc{display:flex;flex-direction:column;gap:10px;margin-top:7px}' +
    P + '.rc>:first-child{margin-bottom:-2px}' +
    P + '.slot{flex:none;box-sizing:border-box;width:45px;height:45px;display:flex;align-items:flex-start;justify-content:center}' + P + '.slot.big{width:61px;height:167px}' + P + '.slot.sm{height:47px}' +
    // backpack
    PB + '.bp{--z:1;position:relative;padding:8px 8px 10px}' +
    PB + '.bp.busy>*:not(.bp-msg){opacity:.45;pointer-events:none}' +
    PB + '.bp-msg{margin:0 0 6px;padding:3px 6px;text-align:center;background:rgba(0,0,0,.45);border:1px solid #3a3527;color:#7fe08a}' + PB + '.bp-msg.bad{color:#ff6b6b}' + PB + '.bp-msg[hidden]{display:none}' +
    PB + '.bp-f{display:flex;justify-content:center;gap:4px;text-align:center}' +
    PB + '.bp-f a{display:block;width:54px;padding:2px 0 3px;border:1px solid transparent;font-size:8pt;color:#d8cfbf}' + PB + '.bp-f a:hover{border-color:#5a5f5f}' + PB + '.bp-f a.on{border-color:#3a4a4a;background:rgba(159,224,255,.08)}' + PB + '.bp-f img{display:block;margin:0 auto 2px;width:30px;height:30px}' +
    PB + '.bp-g{display:grid;grid-template-columns:repeat(auto-fill,calc(47px * var(--z)));justify-content:center;gap:calc(8px * var(--z));margin-top:8px}' + PB + '.bp-none{grid-column:1/-1;text-align:center;opacity:.7}' +
    PB + '.bp-w{zoom:var(--z)}' +
    PB + '.bp-c{position:relative;box-sizing:border-box;width:47px;height:62px;padding:1px 0;text-align:center;background:#0D0905;border:1px solid #202122}' + PB + '.bp-c.sel{border-color:#9fe0ff}' + PB + '.bp-c img{display:block;margin:0 auto}' + PB + '.bp-c .cnt{font-size:8px;line-height:13px;color:#fff}' +
    PB + '.bp.sm .bp-c{height:47px}' + PB + '.bp.sm .bp-c .cnt{position:absolute;right:1px;bottom:1px;padding:0 2px;background:rgba(0,0,0,.72);font-size:calc(8px / var(--z));line-height:calc(10px / var(--z))}' + PB + '.bp.xs .bp-c .cnt .b{display:none}' +
    // checkbox drawn by hand: dark and see-through, solid on hover or when ticked
    PB + '.bp-ck{-webkit-appearance:none;appearance:none;position:absolute;top:2px;right:2px;width:11px;height:11px;margin:0;padding:0;cursor:pointer;z-index:2;box-sizing:border-box;background:rgba(0,0,0,.6) center / 9px 9px no-repeat;border:1px solid #8a9090;border-radius:2px;opacity:.45;transition:opacity .12s}' +
    PB + '.bp-ck:hover,' + PB + '.bp-ck:checked{opacity:1}' +
    PB + '.bp-ck:checked{background-color:#1f5f80;border-color:#9fe0ff;background-image:url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 10 10%27%3E%3Cpath d=%27M2 5.2l2 2L8 3%27 fill=%27none%27 stroke=%27white%27 stroke-width=%271.6%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27/%3E%3C/svg%3E")}' +
    PB + '.pg{margin-top:8px;text-align:center}' + PB + '.pg a{color:#ff0;font-weight:bold}' +
    PB + '.bp-act{margin-top:8px;padding:6px 4px;display:flex;flex-direction:column;align-items:center;gap:6px;background:rgba(0,0,0,.35);border:1px solid #3a3d3d}' + PB + '.bp-act[hidden]{display:none}' + PB + '.bp-act .r{display:flex;align-items:center;gap:6px}' + PB + '.bp-del{color:#ff8a80;border-color:#8a2a22}' +
    // header buttons (settings, refresh)
    PB + '.hb{display:flex;gap:4px;margin-right:8px}' + PB + '.hb button{width:16px;height:16px;padding:2px;box-sizing:border-box;background:rgba(0,0,0,.55);color:#d8cfbf;border:1px solid #5a5f5f;cursor:pointer;line-height:0}' + PB + '.hb button:hover{border-color:#9fe0ff;color:#fff}' + PB + '.hb svg{display:block;width:100%;height:100%}' + PB + '.hb .spin svg{animation:ssh-rotm .7s linear infinite}' + '@keyframes ssh-rotm{to{transform:rotate(360deg)}}' +
    // dialogs
    '#ssh-mm{position:fixed;left:0;top:0;right:0;bottom:0;z-index:9600;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center}' +
    '#ssh-mm .box{min-width:300px;max-width:92vw;background:#0b0e0e;border:1px solid #6a6f6f;color:#d8cfbf;font:12px Arial,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.8)}' +
    '#ssh-mm .ph{cursor:move;user-select:none;display:flex;justify-content:space-between;padding:6px 10px;background:#1b1f1f;border-bottom:1px solid #3a3d3d;font-weight:bold;color:#fff}#ssh-mm .x{cursor:pointer;padding:0 4px}' +
    '#ssh-mm .pb{padding:10px 12px;line-height:1.5}#ssh-mm .pf{display:flex;justify-content:flex-end;gap:8px;padding:8px 12px;border-top:1px solid #3a3d3d}' +
    '#ssh-mm .mm-h{font-weight:bold;color:#fff;margin-bottom:4px}#ssh-mm .mm-o{display:block;margin:2px 0;cursor:pointer}#ssh-mm .mm-th{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px;max-width:360px}#ssh-mm .mm-th img{width:36px;height:36px;background:#0D0905;border:1px solid #202122;object-fit:contain}' +
    '#ssh-mm .bp-del{color:#ff8a80;border-color:#8a2a22}#ssh-mm .mm-al table{max-width:100%;margin:2px 0}' +
    '#ssh-mm .cs{min-width:300px}#ssh-mm .cs.busy{opacity:.5;pointer-events:none}#ssh-mm .cb{position:relative;margin-bottom:8px}' +
    '#ssh-mm .cb-in{width:100%;box-sizing:border-box;height:22px;padding:2px 6px}' +
    '#ssh-mm .cb-list{position:absolute;left:0;right:0;top:100%;z-index:3;max-height:170px;overflow:auto;background:#0b0e0e;border:1px solid #6a6f6f;box-shadow:0 4px 12px rgba(0,0,0,.7)}' +
    '#ssh-mm .cb-list div{padding:3px 8px;cursor:pointer}#ssh-mm .cb-list div.hl,#ssh-mm .cb-list div:hover{background:#305a78;color:#fff}#ssh-mm .cb-list .none{opacity:.6;cursor:default;background:none}' +
    '#ssh-mm .cs-row{display:flex;gap:8px;align-items:center;margin:6px 0}#ssh-mm .cs-row[hidden],#ssh-mm .cs-ask[hidden],#ssh-mm .cs-msg[hidden]{display:none}#ssh-mm .cs-new .cs-name{flex:1;min-width:0;height:22px;padding:2px 6px;box-sizing:border-box}' +
    '#ssh-mm .cs-ask{margin:6px 0;padding:6px 8px;border:1px solid #8a2a22;background:rgba(138,42,34,.15)}#ssh-mm .cs-ask .q{color:#ffb3ad}' +
    '#ssh-mm .cs-msg{margin-top:8px;font-size:11px}#ssh-mm .cs-msg.ok{color:#7fe08a}#ssh-mm .cs-msg.bad{color:#ff6b6b}' +
    '#ssh-mm input[disabled]{opacity:.4;cursor:default}' +
    // components, buffs
    PB + '.comp{height:52px;box-sizing:border-box;padding:6px 8px 0}' + P.trim() + '.loading>.pf-info,' + P.trim() + '.loading>.pf-cols{opacity:.45;pointer-events:none}' + PB + '.comp.busy{opacity:.45;pointer-events:none}' + PB + '.cg{display:grid;grid-template-columns:repeat(10,1fr);gap:2px}' +
    PB + '.cs1{width:20px;height:22px;justify-self:center;display:flex;align-items:center;justify-content:center;background:' + u('slot') + '}' + PB + '.cs1 img{max-width:20px;max-height:20px}' +
    P + '.buffs{display:grid;grid-template-columns:repeat(auto-fit,minmax(60px,1fr));min-height:56px;box-sizing:border-box;padding:5px 8px;text-align:center}' +
    P + '.gen{padding:5px 8px}' +
    // layout switch, always on screen
    '#ssh-lay{position:fixed;left:8px;bottom:8px;z-index:9400;display:flex;gap:4px;align-items:center;padding:3px 4px;background:rgba(0,0,0,.78);border:1px solid #5a5f5f;font:11px Arial,sans-serif;color:#d8cfbf}' +
    '#ssh-lay button,#ssh-lay select{height:20px;box-sizing:border-box;padding:0 8px;background:#1b1f1f;color:#d8cfbf;border:1px solid #5a5f5f;font:11px Arial,sans-serif;cursor:pointer}' +
    '#ssh-lay button:hover,#ssh-lay select:hover{border-color:#9fe0ff;color:#fff}#ssh-lay button.on{background:#305a78;border-color:#9fe0ff;color:#fff}';
}
