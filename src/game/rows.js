// The game's lists are tables; the action list shows them as divs: a table becomes div.al, a row div.r, a cell div.c (its content in div.w).
// A row of one cell that only draws a line (the thin separators) becomes div.r.sep. Tables inside cells are converted too.
export function tableToDivs(root) {
  [...root.querySelectorAll('table')].reverse().forEach((t) => { // the innermost first
    const list = document.createElement('div');
    list.className = 'al';
    [...t.rows].forEach((tr) => {
      const r = document.createElement('div');
      r.className = 'r';
      if (tr.cells.length === 1 && tr.cells[0].hasAttribute('bgcolor')) r.classList.add('sep');
      [...tr.cells].forEach((td) => {
        const c = document.createElement('div');
        c.className = 'c';
        [...td.attributes].forEach((a) => { if (/^(id|title)$|^data-/.test(a.name)) c.setAttribute(a.name, a.value); });
        if (td.colSpan > 1 || tr.cells.length === 1) c.classList.add('full');
        const al = (td.getAttribute('align') || '').toLowerCase();
        if (al === 'right') c.classList.add('ra');
        if (al === 'center') c.classList.add('ca');
        if (td.getAttribute('bgcolor')) c.style.background = td.getAttribute('bgcolor');
        if (/^\d+$/.test(td.getAttribute('height') || '')) c.style.height = td.getAttribute('height') + 'px';
        const w = document.createElement('div');
        w.className = 'w';
        while (td.firstChild) w.appendChild(td.firstChild);
        c.append(w);
        r.append(c);
      });
      list.append(r);
    });
    t.replaceWith(list);
  });
}
