import { HIDE_CSS, TILE } from '../core/constants.js';
import { stairCss } from './stairs.js';

export function addStyle() {
  if (document.getElementById('ssh-style')) return;
  const st = document.createElement('style');
  st.id = 'ssh-style';
  const hide = HIDE_CSS;
  // the game's move status line ("Check move", "Reload World"): not wanted (its element stays in the page, the game's script uses it)
  st.textContent = hide + stairCss + '#world-movement-status{display:none!important}' +
    '#ssh-map{position:relative;width:100%;height:500px;overflow:hidden;box-sizing:border-box;background:#000;' +
    'border:1px solid #3a3d3d;margin:0 0 8px;user-select:none;-webkit-user-select:none;}' +
    '#ssh-map.ssh-dragging,#ssh-map.ssh-dragging *{cursor:grabbing;}#ssh-tip{position:fixed;z-index:9500;display:none;padding:5px 8px;background:#101414;color:#e8e8e8;border:1px solid #5a5f5f;font:11px Arial,sans-serif;pointer-events:none;box-shadow:0 2px 8px rgba(0,0,0,.6);}#ssh-tip img{display:block;margin-top:4px;max-width:100%;}' +
    '#ssh-map.ssh-dragging #ssh-world,#ssh-map.ssh-dragging #ssh-me,#ssh-map.ssh-zooming #ssh-world,#ssh-map.ssh-zooming #ssh-me{transition:none;}' +
    '#ssh-map.ssh-busy::after{content:"";position:absolute;left:0;top:0;right:0;bottom:0;z-index:4;}' +
    '#ssh-map.ssh-fast #ssh-world{transition:transform var(--ssh-step,250ms) linear;}#ssh-map.ssh-fast #ssh-me{transition:left var(--ssh-step,250ms) linear,top var(--ssh-step,250ms) linear;}' +
    '#ssh-world{position:absolute;left:0;top:0;transform-origin:0 0;transition:transform .28s ease-out;}' +
    // 1px bigger than the tile step, so zoomed tiles never leave hairline gaps; .f are the filler tiles outside the map
    '#ssh-world .t,#ssh-world .f{position:absolute;width:' + (TILE + 1) + 'px;height:' + (TILE + 1) + 'px;display:block;}#ssh-world .f{pointer-events:none;}' +
    // direction pad around the map frame (greyed out when the game does not allow that direction)
    '#ssh-pad button{position:absolute;z-index:5;width:26px;height:26px;padding:0;box-sizing:border-box;cursor:pointer;' +
    'background:rgba(0,0,0,.72);color:#d6f4ff;border:1px solid #5a5f5f;font:bold 15px/22px Arial,sans-serif;}' +
    '#ssh-pad button:hover:not(:disabled){border-color:#9fe0ff;background:rgba(40,70,90,.9);color:#fff;}' +
    '#ssh-pad button:disabled{opacity:.28;cursor:not-allowed;}' +
    // short message above the down arrow of the map, gone after 2 seconds
    '#ssh-toast{position:absolute;left:50%;bottom:38px;transform:translateX(-50%);z-index:6;max-width:80%;padding:3px 10px;pointer-events:none;transition:opacity .6s ease-out;' +
    'background:rgba(0,0,0,.82);color:#d6f4ff;border:1px solid #5a5f5f;font:bold 11px Arial,sans-serif;text-align:center;}' +
    '#ssh-toast.bad{color:#ff8a8a;border-color:#8a3a3a;}' +
    '#ssh-me{position:absolute;width:' + TILE + 'px;height:' + TILE + 'px;transition:left .28s ease-out,top .28s ease-out;' +
    'pointer-events:none;display:flex;align-items:center;justify-content:center;}' +
    '#ssh-me img{width:23px;height:23px;filter:drop-shadow(0 0 4px #fff);}' +
    '#ssh-pinfo{position:absolute;left:38px;top:67px;z-index:5;display:none;padding:2px 8px;background:rgba(0,0,0,.75);color:#7dff7d;border:1px solid #1d6a1d;font:bold 11px Arial,sans-serif;}' +
    '#ssh-path{position:absolute;left:0;top:0;pointer-events:none;overflow:visible;}' +
    '#ssh-pfbtn{position:absolute;right:112px;bottom:6px;z-index:5;height:22px;padding:0 8px;box-sizing:border-box;background:rgba(0,0,0,.75);color:#d8cfbf;border:1px solid #5a5f5f;font:bold 12px/20px Arial,sans-serif;cursor:pointer;}' +
    '#ssh-fpbtn{position:absolute;right:38px;bottom:6px;z-index:5;height:22px;padding:0 8px;box-sizing:border-box;background:rgba(0,0,0,.75);color:#d8cfbf;border:1px solid #5a5f5f;font:bold 12px/20px Arial,sans-serif;cursor:pointer;}' +
    '#ssh-fpbtn:hover,#ssh-pfbtn:hover{border-color:#9fe0ff;color:#fff;}#ssh-fpbtn.on,#ssh-pfbtn.on{border-color:#e8872a;color:#ffb36b;}' +
    '#ssh-fp .fp{position:absolute;width:12px;height:12px;border-radius:50%;background:#e8872a;border:1px solid #7a3d08;box-sizing:border-box;}' +
    '#ssh-zoom{position:absolute;left:38px;bottom:6px;display:flex;gap:4px;align-items:center;z-index:5;}' +
    '#ssh-zoom button,#ssh-zoom span{height:22px;min-width:24px;padding:0 6px;box-sizing:border-box;background:rgba(0,0,0,.75);' +
    'color:#d8cfbf;border:1px solid #5a5f5f;font:bold 12px/20px Arial,sans-serif;text-align:center;cursor:pointer;}' +
    '#ssh-zoom span{cursor:default;min-width:44px;}' +
    '#ssh-zoom button:hover{border-color:#9fe0ff;color:#fff;}' +
    // the Wiki and Guide buttons sit in the top row, next to the up-left arrow; the area name is one row lower, clear of every arrow
    '.ssh-lk{position:absolute;top:6px;z-index:5;width:22px;height:22px;box-sizing:border-box;background:rgba(0,0,0,.75);color:#d8cfbf;border:1px solid #5a5f5f;font:bold 12px/20px Arial,sans-serif;text-align:center;text-decoration:none;cursor:pointer;}' +
    '.ssh-lk:hover{border-color:#9fe0ff;color:#fff;}#ssh-wiki{left:38px}#ssh-guide{left:66px}#ssh-guide[hidden]{display:none}' +
    '#ssh-loc{position:absolute;left:38px;top:43px;z-index:5;padding:3px 8px;background:rgba(0,0,0,.75);color:#e8e8e8;' +
    'border:1px solid #5a5f5f;font:bold 12px Arial,sans-serif;white-space:nowrap;}' +
    // Path Finder panel (src/pathfinder/panel.js): same look as the Action List
    '#ssh-pf{position:absolute;z-index:1000;width:300px;max-width:calc(100% - 8px);box-sizing:border-box;background:rgba(8,10,10,.94);border:1px solid #5a5f5f;color:#d8cfbf;font:12px/1.35 Arial,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.6);}#ssh-pf[hidden]{display:none}' +
    '#ssh-pf .hd{padding:4px 8px;background:#1b1f1f;border-bottom:1px solid #3a3d3d;font-weight:bold;color:#fff;cursor:move;user-select:none;touch-action:none}#ssh-pf .x{float:right;cursor:pointer;color:#d8cfbf;font-size:18px;line-height:14px}#ssh-pf .x:hover{color:#fff}' +
    '#ssh-pf .md{display:flex;gap:4px;padding:6px 8px 0}#ssh-pf button{background:#2c3232;border:1px solid #5a5f5f;color:#d8d8d8;font:inherit;cursor:pointer;padding:2px 8px}#ssh-pf button:hover{border-color:#9fe0ff;color:#fff}#ssh-pf .md button{flex:1}#ssh-pf .md button.on{border-color:#e8872a;color:#ffb36b}' +
    '#ssh-pf .sr{position:relative;display:flex;gap:4px;padding:8px 8px 4px}#ssh-pf input{flex:1;min-width:0;box-sizing:border-box;padding:3px 6px;background:#000;border:1px solid #5a5f5f;color:#e8e8e8;font:inherit}' +
    '#ssh-pf .sg{position:absolute;left:8px;right:8px;top:100%;z-index:2;margin:0;padding:0;list-style:none;background:#0b0e0e;border:1px solid #5a5f5f;max-height:260px;overflow:auto}#ssh-pf .sg[hidden]{display:none}' +
    '#ssh-pf .sg li{display:flex;justify-content:space-between;gap:8px;padding:3px 8px;cursor:pointer}#ssh-pf .sg li span{color:#8b8b8b;white-space:nowrap}#ssh-pf .sg li.on,#ssh-pf .sg li:hover{background:#1f2626}' +
    '#ssh-pf .bd{padding:4px 8px 8px}#ssh-pf .m{padding:6px 2px;opacity:.8}#ssh-pf .er{color:#ff8a7a;opacity:1}#ssh-pf a{color:#9fe0ff}' +
    '#ssh-pf .ds span{color:#8b8b8b;margin-left:4px}#ssh-pf .ct{color:#9a9a9a;margin:4px 0 6px}#ssh-pf .dn{margin:8px 0 2px;padding:10px;text-align:center;font-size:16px;font-weight:bold;background:#16301a;border:1px solid #3f8a4a;color:#7fe08a}' +
    '#ssh-pf .nx{padding:8px 10px;background:#0f1414;border:2px solid #e8872a}#ssh-pf .in{font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:#8b8b8b}#ssh-pf .ld{color:#b8b0a0}#ssh-pf .bg{font-size:18px;font-weight:bold;line-height:1.2;margin:2px 0;color:#fff}#ssh-pf .sb{color:#b8b0a0}' +
    '#ssh-pf .nt{margin-top:4px;font-style:italic;color:#ff8a7a}#ssh-pf .aw{margin-top:6px;font-weight:bold;color:#ffb36b}#ssh-pf .aw.hr{color:#7fe08a}' +
    '#ssh-pf .rs{margin:8px 0 0;padding-left:22px;max-height:230px;overflow:auto;font-size:11px;color:#b8b0a0;scrollbar-width:thin;scrollbar-color:#2c3232 transparent}#ssh-pf .rs li{padding:2px 0;border-top:1px dotted #3a3d3d}#ssh-pf .rs li:first-child{border-top:0}#ssh-pf .rs span{display:block;font-size:10px;text-transform:uppercase;color:#7a7a7a}' +
    '#ssh-pf .ft{padding:4px 8px 6px;border-top:1px solid #3a3d3d;text-align:center;font-size:11px}' +
    '#ssh-al{position:absolute;z-index:1000;width:270px;max-height:340px;overflow:auto;background:rgba(8,10,10,.92);' +
    'border:1px solid #5a5f5f;color:#d8cfbf;font:11px Arial,sans-serif;box-shadow:0 3px 10px rgba(0,0,0,.6);}' +
    // a slim dark scroll bar without arrows (Firefox: the thin standard one)
    '#ssh-al::-webkit-scrollbar{width:5px}#ssh-al::-webkit-scrollbar-track{background:transparent}#ssh-al::-webkit-scrollbar-button{display:none;width:0;height:0}' +
    '#ssh-al::-webkit-scrollbar-thumb{background:#2c3232;border-radius:3px}#ssh-al::-webkit-scrollbar-thumb:hover{background:#454c4c}' +
    '@supports(-moz-appearance:none){#ssh-al{scrollbar-width:thin;scrollbar-color:#2c3232 transparent}}' +
    '#ssh-al .hd{padding:4px 8px;background:#1b1f1f;border-bottom:1px solid #3a3d3d;font-weight:bold;color:#fff;cursor:move;' +
    'user-select:none;-webkit-user-select:none;touch-action:none;}' +
    '#ssh-al .rf{float:right;margin-left:8px;cursor:pointer;color:#d8cfbf;font-size:14px;line-height:12px;user-select:none}#ssh-al .rf:hover{color:#fff}#ssh-al .rf.spin{display:inline-block;animation:ssh-rot .7s linear infinite}' +
    '#ssh-al a.ssh-bhk{position:relative;display:inline-block;line-height:0}#ssh-al a.ssh-bhk::after{content:"T";position:absolute;right:1px;bottom:0;font:bold 12px/12px Arial,sans-serif;color:#ffff40;-webkit-text-stroke:2px #000;paint-order:stroke fill;text-shadow:-2px -2px 0 #000,2px -2px 0 #000,-2px 2px 0 #000,2px 2px 0 #000,0 -2px 0 #000,0 2px 0 #000,-2px 0 0 #000,2px 0 0 #000,0 0 3px #000;pointer-events:none}#ssh-al .ssh-fight a.ssh-bhk::after{display:none}#ssh-al .bd{padding:4px 6px;}#ssh-al .al{width:100%;}#ssh-al .r{display:flex;align-items:stretch;}#ssh-al .c{display:flex;align-items:center;box-sizing:border-box;flex:none;padding:3px 2px;font:11px Arial,sans-serif;color:#d8cfbf;}' +
    '#ssh-al .c.full{flex:1 1 100%;min-width:0;}#ssh-al .r>.c:nth-child(2):not(:last-child){flex:1;min-width:0;}#ssh-al .r>.c:last-child:not(:first-child){margin-left:auto;}#ssh-al .c.ra{justify-content:flex-end;text-align:right;}#ssh-al .c.ca{justify-content:center;text-align:center;}' +
    '#ssh-al .ssh-ct{text-shadow:1px 1px 1px #000,-1px -1px 1px #000,1px -1px 1px #000,-1px 1px 1px #000,0 0 4px #000;}' + // a dark outline and glow, so the colour stands out
    '#ssh-al .r.sep>.c{padding:0;}#ssh-al .c>.w{min-width:0;}#ssh-al .c.full>.w{flex:1;min-width:0;}' +
    '@keyframes ssh-rot{to{transform:rotate(360deg)}}' +
    '.ssh-spin{display:inline-block;width:16px;height:16px;box-sizing:border-box;border:2px solid #4a5a5a;border-top-color:#9fe0ff;border-radius:50%;animation:ssh-rot .7s linear infinite;vertical-align:middle;}' +
    '#ssh-al .rs{padding:2px 2px 3px;line-height:1.45;}#ssh-al .rs .rt{font-weight:bold;font-size:12px;}#ssh-al .rs .win{color:#7fe08a;}#ssh-al .rs .lose{color:#ff6b6b;}' +
    '#ssh-al .rs .ln{font-weight:bold;}#ssh-al .rs .loot{margin-top:3px;}#ssh-al .rs .itm{cursor:help;font-weight:bold;}' +
    '#ssh-al .rs .gone{color:#8b8b8b;font-style:italic;margin-right:4px;}#ssh-al .rs .dx.arm{width:auto;padding:0 4px;background:#e0431a;}#ssh-al .rs .dx{display:inline-block;width:14px;height:14px;line-height:13px;text-align:center;background:#b3261e;color:#fff;font-weight:bold;font-size:11px;margin-right:4px;cursor:pointer;border:1px solid #6e1510;vertical-align:middle;text-decoration:none;}' +
    '#ssh-al .rs .rrow{display:flex;align-items:center;justify-content:space-between;gap:6px;}#ssh-al .rs .clog{flex:none;box-sizing:border-box;width:16px;height:16px;line-height:14px;text-align:center;background:#2c3232;border:1px solid #5a5f5f;color:#d8d8d8;cursor:pointer;font-size:10px;text-decoration:none;}' +
    '#ssh-al .rs .clog:hover{background:#3a4040;border-color:#8a9090;color:#fff;}' +
    '#ssh-ent{position:fixed;left:0;top:0;right:0;bottom:0;z-index:9500;background:rgba(0,0,0,.65);overflow:auto;display:flex;}' +
    '#ssh-ent .ehandle{position:absolute;left:0;top:0;right:54px;height:58px;z-index:1;cursor:move;}#ssh-ent .ebox{position:relative;width:640px;margin:auto;flex:none;}#ssh-ent .ebox>br{display:none;}' +
    '#ssh-ent .eclose{position:absolute;right:16px;top:12px;z-index:2;width:26px;height:26px;line-height:24px;text-align:center;background:#2a1d1a;border:1px solid #8a5a3a;color:#f3e2bd;font:bold 14px Arial,sans-serif;cursor:pointer;}' +
    '#ssh-ent .eclose:hover{border-color:#9fe0ff;color:#fff;}' +
    '#ssh-ent .ebody{display:flex;gap:12px;align-items:flex-start;padding:0 30px;}#ssh-ent .eleft{flex:none;width:208px;}#ssh-ent .eright{flex:none;width:350px;}' +
    '#ssh-ent .epic{border:1px solid #323236;padding:3px;text-align:center;margin-bottom:10px;}#ssh-ent .epic img{display:block;max-width:100%;margin:0 auto;}#ssh-ent .en{font:bold 16px Arial,sans-serif;color:#fff;padding-top:2px;}' +
    '#ssh-ent .ehead{height:54px;}#ssh-ent .efoot{height:54px;}#ssh-ent .esh{height:20px;margin:8px 0 4px;}' +
    '#ssh-ent .r4{display:grid;grid-template-columns:92px 1fr 66px 1fr;gap:3px 0;margin:2px 0;}#ssh-ent .rl{display:flex;justify-content:space-between;margin:2px 0;}#ssh-ent .rt{margin:2px 0;}' +
    '#ssh-ent .ebtns{text-align:center;padding:8px 0 4px;}' +
    '#ssh-ent .eeval{margin:8px 0 4px;padding:0 0 6px;background:rgba(0,0,0,.45);border:1px solid #3a3527;color:#d8cfbf;font:12px Arial,sans-serif;text-align:center;cursor:auto;}' +
    '#ssh-ent .eh{padding:3px;background:#5a4528;color:#f3e2bd;font-weight:bold;margin-bottom:6px;}' +
    '#ssh-ent .eg{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:2px 8px;padding:0 10px;text-align:right;}#ssh-ent .eg .ek{color:#bdb6aa;}#ssh-ent .eg .ev{text-align:left;}' +
    '#ssh-ent .ef{margin-top:6px;}#ssh-ent .em{color:#8b8b8b;font-size:11px;}' +
    '#ssh-ent .elog{margin-top:6px;padding-top:4px;border-top:1px solid #3a3527;font:11px/1.45 Arial,sans-serif;word-wrap:break-word;}#ssh-ent .elog .stat{display:block;margin:1px 0;color:#bdb6aa;}#ssh-ent .elog .stat span+span{display:block;color:#d8cfbf;}#ssh-ent .rs .rrow{display:block;}' +
    '#ssh-ent .eres{clear:both;box-sizing:border-box;width:0;min-width:100%;overflow-wrap:anywhere;cursor:auto;margin:16px 0 0;padding:6px;background:rgba(0,0,0,.5);border:1px solid #3a3527;color:#d8cfbf;font:12px Arial,sans-serif;text-align:left;}' +
    '#ssh-ent .rs{padding:3px 4px;line-height:1.45;}#ssh-ent .rs .ln{font-weight:bold;font-size:13px;}#ssh-ent .rs .loot{margin-top:4px;}#ssh-ent .rs .itm{cursor:help;font-weight:bold;}' +
    '#ssh-ent .rs .rrow{display:flex;align-items:center;justify-content:space-between;gap:6px;}' +
    '#ssh-ent .rs .clog{flex:none;box-sizing:border-box;width:16px;height:16px;line-height:14px;text-align:center;background:#2c3232;border:1px solid #5a5f5f;color:#d8d8d8;cursor:pointer;font-size:10px;text-decoration:none;}' +
    '#ssh-ent .rs .clog:hover{background:#3a4040;border-color:#8a9090;color:#fff;}' +
    '#ssh-pop{position:fixed;left:0;top:0;right:0;bottom:0;z-index:9600;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;}' +
    '#ssh-pop .box{width:420px;max-width:92vw;max-height:84vh;overflow:auto;background:#0b0e0e;border:1px solid #6a6f6f;color:#d8cfbf;font:12px Arial,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.8);}' +
    '#ssh-pop .ph{cursor:move;user-select:none;display:flex;justify-content:space-between;padding:6px 10px;background:#1b1f1f;border-bottom:1px solid #3a3d3d;font-weight:bold;color:#fff;}' +
    '#ssh-pop .ph span{cursor:pointer;padding:0 4px;}#ssh-pop .pb{padding:10px 12px;line-height:1.5;}' +
    '#ssh-pop .stat{display:flex;justify-content:space-between;margin:2px 0;color:#bdb6aa;}' +
    '#ssh-al .mech{margin:0 0 4px;padding:2px 2px 2px;line-height:1.5;}#ssh-al .mech .em{color:#8b8b8b;font-size:11px;}' +
    '#ssh-al .ssh-repair{display:inline-block;cursor:pointer;margin-right:4px;vertical-align:middle;line-height:0;}#ssh-al .ssh-repair img{display:inline-block;vertical-align:middle;}#ssh-al .ssh-repair[data-state="off"],#ssh-al .ssh-repair[data-state="none"],#ssh-al .ssh-repair[data-state="wait"]{opacity:.35;cursor:default;}' +
    '#ssh-al .bd a{color:#9fe0ff;}#ssh-al .none{padding:4px 2px;opacity:.75;}';
  document.head.appendChild(st);
}
