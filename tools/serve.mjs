// Serves dist/ on http://127.0.0.1:8765/ for local testing (CORS and private-network headers, no caching).
// In the game's page: localStorage.setItem('SSH_dev_base', 'http://127.0.0.1:8765/') makes the loader use it
// (remove the key to go back to the published version).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const types = { '.js': 'text/javascript', '.json': 'application/json', '.html': 'text/html', '.css': 'text/css', '.map': 'application/json', '.gif': 'image/gif', '.png': 'image/png', '.mp4': 'video/mp4' };
const port = +process.env.PORT || 8765;

http.createServer((req, res) => {
  const h = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Private-Network': 'true', 'Cache-Control': 'no-store' };
  if (req.method === 'OPTIONS') { res.writeHead(204, { ...h, 'Access-Control-Allow-Headers': '*' }); res.end(); return; }
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(dist, rel);
  if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404, h); res.end('not found'); return; }
  res.writeHead(200, { ...h, 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log('serving ' + dist + ' on http://127.0.0.1:' + port + '/'));
