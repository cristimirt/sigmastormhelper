// Line breaks (<br>) of the game's markup replaced by spacing: the content between breaks becomes a block of its own and a blank line (a break
// that follows another, or a block) becomes a margin under the block before it. Done for a copy of the game's markup, in blocks only (an
// element with text inside a line, like <b> or <a>, keeps its breaks). Leading breaks are dropped; at most two blank lines are kept.
//
//   unbreak(root);   // root and everything in it, changed in place

const BLOCKS = new Set(['DIV', 'CENTER', 'P', 'FORM', 'FIELDSET', 'LI', 'BLOCKQUOTE']);
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'PRE', 'SELECT', 'BUTTON', 'LABEL']);
const LINE = 1.2; // em, one blank line
const some = (nodes) => nodes.some((n) => (n.nodeType === 1 ? n.tagName !== 'BR' : /\S/.test(n.textContent)));

function one(el) {
  if (![...el.childNodes].some((n) => n.nodeType === 1 && n.tagName === 'BR')) return;
  const segs = [];
  let cur = [];
  [...el.childNodes].forEach((n) => {
    if (n.nodeType === 1 && n.tagName === 'BR') {
      if (some(cur)) { segs.push({ nodes: cur, gap: 0 }); cur = []; } else if (segs.length) segs[segs.length - 1].gap++;
    } else cur.push(n);
  });
  if (some(cur)) segs.push({ nodes: cur, gap: 0 });
  el.replaceChildren();
  segs.forEach((s) => {
    const nodes = s.nodes.filter((n, i, a) => !(n.nodeType === 3 && !/\S/.test(n.textContent) && (i === 0 || i === a.length - 1)));
    const solo = nodes.length === 1 && nodes[0].nodeType === 1 && (BLOCKS.has(nodes[0].tagName) || nodes[0].tagName === 'TABLE') ? nodes[0] : null;
    const box = solo || document.createElement('div');
    if (!solo) nodes.forEach((n) => box.append(n));
    if (s.gap) box.style.marginBottom = Math.min(s.gap, 2) * LINE + 'em';
    el.append(box);
  });
}

export function unbreak(root) {
  const walk = (el) => {
    if (SKIP.has(el.tagName)) return;
    [...el.children].forEach(walk);
    if (BLOCKS.has(el.tagName)) one(el);
  };
  walk(root);
  return root;
}
