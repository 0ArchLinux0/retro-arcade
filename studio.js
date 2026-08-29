// ============================================================
// Studio — 4-quadrant debug/record harness for RETRO ARCADE
//
//   ┌───────────────┬───────────────┐
//   │ Q1 GAME       │ Q2 DASHBOARD  │
//   │  (iframe)     │  (metrics)    │
//   ├───────────────┼───────────────┤
//   │ Q3 FAST LOG   │ Q4 MONITOR    │
//   │  (event firehose) (sys + fps)│
//   └───────────────┴───────────────┘
//
// Run:  node studio.js [--port 8788] [--game cave]
// Record the whole thing:  ffmpeg -f avfoundation -i "1" ...
// ============================================================
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname);
const PORT = Number(process.argv[process.argv.indexOf('--port') + 1]) || 8788;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};

// ---------- tiny in-proc metrics ring ----------
const LOG_MAX = 400;
const logBuf = [];
function log(tag, msg) {
  const line = `${new Date().toISOString().slice(11, 23)} [${tag}] ${msg}`;
  logBuf.push(line);
  if (logBuf.length > LOG_MAX) logBuf.shift();
}

const boot = Date.now();
const metrics = {
  sessions: [],      // {game, score, ms, t}
  requests: 0,
  gameStarts: {},
  errors: 0
};

const server = http.createServer((req, res) => {
  metrics.requests++;
  let u = req.url.split('?')[0];
  if (u === '/') u = '/cinema.html';
  if (u === '/studio') u = '/studio.html';
  if (u === '/cinema') u = '/cinema.html';
  if (u === '/favicon.ico') { res.writeHead(204); res.end(); return; }

  // POST /api/log  {tag, msg}
  if (u === '/api/log' && req.method === 'POST') {
    let b = '';
    req.on('data', c => b += c);
    req.on('end', () => {
      try {
        const { tag, msg } = JSON.parse(b || '{}');
        log(tag || 'web', String(msg || ''));
      } catch { /* ignore */ }
      res.writeHead(204); res.end();
    });
    return;
  }

  // GET /api/tour-verify?game=id — light syntax+module check for cinema tour
  if (u.startsWith('/api/tour-verify')) {
    const g = new URL(req.url, 'http://x').searchParams.get('game') || '';
    const file = path.join(ROOT, 'js', 'games', `${g}.js`);
    try {
      fs.accessSync(file);
      require('child_process').execFileSync(process.execPath, ['--check', file], { timeout: 5000 });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, msg: 'syntax OK + module present' }));
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, msg: String(e.message || e).slice(0, 160) }));
    }
    return;
  }

  // GET /api/stream — SSE with fast synthetic telemetry + real events
  if (u === '/api/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });
    const send = ev => res.write(`data: ${JSON.stringify(ev)}\n\n`);
    send({ type: 'hello', pid: process.pid });

    const tick = setInterval(() => {
      // fast scrolling synthetic lines so the record looks ALIVE
      const tags = ['LOOP', 'PHYS', 'AUDIO', 'SPAWN', 'COLLIDE', 'META'];
      const tag = tags[Math.floor(Math.random() * tags.length)];
      const msgs = [
        `frame=${Math.floor(Math.random() * 99999)} dt=${(Math.random() * 20).toFixed(2)}ms`,
        `entity pool=${40 + Math.floor(Math.random() * 60)} active=${10 + Math.floor(Math.random() * 50)}`,
        `sfx queue depth=${Math.floor(Math.random() * 4)} bgm=playing`,
        `spawn wave#${Math.floor(Math.random() * 900)} difficulty=${(Math.random() * 9).toFixed(2)}`,
        `collision pass ${Math.floor(Math.random() * 90)} pairs resolved`,
        `coins=${Math.floor(Math.random() * 9999)} missions=3 achievements=${Math.floor(Math.random() * 7)}`
      ];
      send({
        type: 'log',
        tag,
        msg: msgs[Math.floor(Math.random() * msgs.length)],
        t: Date.now()
      });
    }, 120);          // ~8 lines/sec = satisfying scroll on video

    // slower dashboard metric updates
    const dash = setInterval(() => {
      send({
        type: 'metrics',
        uptime: Math.floor((Date.now() - boot) / 1000),
        mem: process.memoryUsage().heapUsed / 1048576,
        requests: metrics.requests,
        sessions: metrics.sessions.slice(-8),
        gameStarts: metrics.gameStarts,
        load: os.loadavg()[0],
        t: Date.now()
      });
    }, 700);

    req.on('close', () => { clearInterval(tick); clearInterval(dash); });
    return;
  }

  // static files from retro-arcade root
  const fp = path.join(ROOT, decodeURIComponent(u));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('nope'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  log('studio', `4-quadrant studio ready → http://localhost:${PORT}`);
  console.log(`
┌──────────────────────────────────────────────────────────┐
│  RETRO ARCADE STUDIO — 4-QUADRANT DEBUG MODE             │
├──────────────────────────────────────────────────────────┤
│  cinema   http://localhost:${PORT}/cinema.html\n│  studio   http://localhost:${PORT}/studio                          │
│  record   ffmpeg -f avfoundation -i "1:none" -pix_fmt    │
│           uyvy422 -vcodec libx264 -crf 18 out.mp4        │
│                                                          │
│  Q1 game iframe · Q2 dashboard · Q3 fast log · Q4 monitor│
└──────────────────────────────────────────────────────────┘
`);
});
