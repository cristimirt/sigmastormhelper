import { addSlider } from '../layout/slider.js';

// The Bank page: the game draws a slider under the deposit and the withdraw box with a script of its own (slider.js) whose pictures
// come from an http address, so the browser blocks them and the sliders are two empty grey bars. They are replaced by the helper's
// slider (layout/slider.js): 0 up to the Current Max Deposit for the deposit, 0 up to the Account Balance for the withdraw.

const num = (s) => +String(s || '').replace(/[^\d]/g, '') || 0;

// The number in the row whose label starts with `label` (the label's cell is followed by the cell with the value).
function rowValue(label) {
  const td = [...document.querySelectorAll('td')].find((c) => c.textContent.replace(/ /g, ' ').trim().startsWith(label) && !c.querySelector('td'));
  const v = td && td.nextElementSibling;
  return v ? num(v.textContent) : 0;
}

function under(box, max, gameBase) {
  const game = document.getElementById(gameBase);
  if (game) game.style.display = 'none';
  addSlider(box, { max, after: game || undefined });
}

export function initBank() {
  const dep = document.getElementById('deposit_amount');
  const wd = document.getElementById('withdraw_amount');
  if (dep) under(dep, rowValue('Current Max Deposit'), 'sl0base');
  if (wd) under(wd, rowValue('Account Balance'), 'sl1base');
}
