import { digits } from '../core/util.js';
import { addSlider } from '../layout/slider.js';

// The Bank page: the game draws a slider under the deposit and the withdraw box with a script of its own (slider.js) whose pictures
// come from an http address, so the browser blocks them and the sliders are two empty grey bars. They are replaced by the helper's
// slider (layout/slider.js): 0 up to the Current Max Deposit for the deposit, 0 up to the Account Balance for the withdraw.


// The number in the row whose label starts with `label` (the label's cell is followed by the cell with the value).
function rowValue(label) {
  const td = [...document.querySelectorAll('td')].find((c) => c.textContent.replace(/ /g, ' ').trim().startsWith(label) && !c.querySelector('td'));
  const v = td && td.nextElementSibling;
  return v ? digits(v.textContent) : 0;
}

function under(box, max, gameBase) {
  const game = document.getElementById(gameBase);
  if (game) game.style.display = 'none';
  addSlider(box, { max, after: game || undefined });
}

// The game's own sliders may be written into the page after the helper has run (its scripts are run late), so hide them by style,
// not by looking for them once.
function hideGameSliders() {
  if (document.getElementById('ssh-bank-css')) return;
  const s = document.createElement('style');
  s.id = 'ssh-bank-css';
  s.textContent = '#sl0base,#sl1base{display:none!important}';
  document.head.append(s);
}

export function initBank() {
  hideGameSliders();
  const dep = document.getElementById('deposit_amount');
  const wd = document.getElementById('withdraw_amount');
  if (dep) under(dep, rowValue('Current Max Deposit'), 'sl0base');
  if (wd) under(wd, rowValue('Account Balance'), 'sl1base');
}
