// Serveur local sans dépendance : sert public/ et la fonction api/devis.js comme Vercel.
// Lancement :  npm start   (variables lues depuis .env.local si présent)
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, 'public'), PORT = +process.env.PORT || 3000;
try { for (const l of fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; } } catch (e) {}
const devis = require('./api/devis.js');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml' };
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/devis') {
    let body = ''; req.on('data', c => { body += c; if (body.length > 1e5) req.destroy(); });
    req.on('end', () => {
      try { req.body = body ? JSON.parse(body) : null; } catch (e) { req.body = null; }
      const r = { status(c) { res.statusCode = c; return r; }, setHeader: (k, v) => res.setHeader(k, v), json(j) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(j)); }, end() { res.end(); } };
      devis(req, r);
    });
    return;
  }
  let file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
  if (!file.startsWith(ROOT)) { res.statusCode = 403; return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('Introuvable'); }
  const stat = fs.statSync(file), type = TYPES[path.extname(file)] || 'application/octet-stream', range = req.headers.range;
  if (range && type === 'video/mp4') { // vidéos : lecture partielle (Safari)
    const [s, e] = range.replace('bytes=', '').split('-'); const start = +s, end = e ? +e : stat.size - 1;
    res.writeHead(206, { 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1, 'Content-Type': type });
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`NO LIMIT — http://localhost:${PORT}`));
