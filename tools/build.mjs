// Builds the site that GitHub Pages serves:
//   dist/manifest.json                      what is current: build number, the bundle, a hash per data file
//   dist/resources/prod/<build>/main.min.js the bundled script (immutable: a new build gets a new folder)
//   dist/data/*.json                        the static data, copied as is
//   dist/sigmastormhelper.user.js           the loader players install in Tampermonkey (rarely changes)
//   dist/index.html ...                     the install page (site/)
// Usage: node tools/build.mjs [--dev] [--check]   (BUILD_NUMBER comes from the CI run number)
import { build } from 'esbuild';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const dev = args.has('--dev');
const check = args.has('--check');
const buildNo = process.env.BUILD_NUMBER || 'dev';
const dist = path.join(root, 'dist');
const p = (...a) => path.join(root, ...a);

const fail = (msg) => { console.error('build failed: ' + msg); process.exit(1); };

// Tiny markdown to HTML for docs/changes.md: "### title" opens a collapsible group, "- item" / "  - item" are (nested)
// bullets, other lines are paragraphs; **bold** and `code` are understood.
function changesHtml(md) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s) => esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const out = [];
  let open = false;
  let depth = 0; // open <ul> levels inside the current group
  const closeLists = (to) => { while (depth > to) { out.push('</ul>'); depth--; } };
  for (const line of md.split('\n')) {
    if (/^## /.test(line)) continue;
    const h = line.match(/^### (.+)/);
    if (h) {
      closeLists(0);
      if (open) out.push('</details>');
      out.push('<details open><summary>' + inline(h[1]) + '</summary>');
      open = true;
      continue;
    }
    const li = line.match(/^( *)- (.+)/);
    if (li) {
      const lvl = li[1].length >= 2 ? 2 : 1;
      while (depth < lvl) { out.push('<ul>'); depth++; }
      closeLists(lvl);
      out.push('<li>' + inline(li[2]) + '</li>');
      continue;
    }
    if (line.trim()) { closeLists(0); out.push('<p>' + inline(line.trim()) + '</p>'); }
  }
  closeLists(0);
  if (open) out.push('</details>');
  return out.join('\n');
}

// 1. the bundle
const outDir = path.join(dist, 'resources', 'prod', buildNo);
const res = await build({
  entryPoints: [p('src/main.js')],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  minify: !dev,
  sourcemap: check ? false : 'external',
  legalComments: 'none',
  write: false,
  outfile: path.join(outDir, 'main.min.js'),
  logLevel: 'warning',
});
if (check) console.log('bundle ok (' + res.outputFiles[0].text.length + ' bytes)');

// 2. data: every file must be valid JSON; the manifest carries a hash per file
const data = {};
const dataFiles = fs.readdirSync(p('data')).filter((f) => f.endsWith('.json'));
for (const f of dataFiles) {
  const text = fs.readFileSync(p('data', f), 'utf8');
  try { JSON.parse(text); } catch (e) { fail('data/' + f + ' is not valid JSON: ' + e.message); }
  data[f.replace(/\.json$/, '')] = crypto.createHash('sha1').update(text).digest('hex').slice(0, 10);
}

// 3. the loader repeats the early-hide CSS of the world page (it runs before the bundle is loaded): keep both the same
const css = (file, re) => { const m = fs.readFileSync(p(file), 'utf8').match(re); return m && m[1]; };
const inSrc = css('src/core/constants.js', /HIDE_CSS = '([^']+)'/);
const inLoader = css('loader/sigmastormhelper.user.js', /HIDE_CSS = '([^']+)'/);
if (!inSrc || inSrc !== inLoader) fail('HIDE_CSS differs between src/core/constants.js and loader/sigmastormhelper.user.js');

if (check) { console.log('data ok:', Object.keys(data).join(', ')); process.exit(0); }

// 4. write the site
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
for (const o of res.outputFiles) {
  const rel = path.relative(path.join(root), o.path);
  fs.mkdirSync(path.dirname(o.path), { recursive: true });
  fs.writeFileSync(o.path, o.contents);
  console.log('wrote', rel.replace(/\\/g, '/'), o.contents.length + ' bytes');
}
fs.cpSync(p('data'), path.join(dist, 'data'), { recursive: true });
fs.copyFileSync(p('loader/sigmastormhelper.user.js'), path.join(dist, 'sigmastormhelper.user.js'));
fs.cpSync(p('site'), dist, { recursive: true, filter: (src) => !src.endsWith('.gif') }); // the GIFs are for the README; the page plays the MP4s
// the full list of changes (docs/changes.md, also pasted into the README) goes into the install page
const page = path.join(dist, 'index.html');
const html = fs.readFileSync(page, 'utf8');
if (!html.includes('<!-- CHANGES -->')) fail('site/index.html has no <!-- CHANGES --> placeholder');
fs.writeFileSync(page, html.replace('<!-- CHANGES -->', changesHtml(fs.readFileSync(p('docs/changes.md'), 'utf8'))));
fs.writeFileSync(path.join(dist, '.nojekyll'), '');
const manifest = { build: buildNo, main: 'resources/prod/' + buildNo + '/main.min.js', data, built: new Date().toISOString() };
fs.writeFileSync(path.join(dist, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
console.log('manifest:', JSON.stringify(manifest));
