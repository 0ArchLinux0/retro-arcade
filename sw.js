// Retro Arcade — minimal offline-first service worker
const CACHE = 'ra-v8';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/core.js',
  './js/audio.js',
  './js/lobby.js',
  './js/games/runner.js',
  './js/games/jumper.js',
  './js/games/shooter.js',
  './js/games/racing.js',
  './js/games/rpg.js',
  './js/games/worm.js',
  './js/games/blockfall.js',
  './js/games/brickbreak.js',
  './js/games/flappy.js',
  './js/games/stackup.js',
  './js/games/snake.js',
  './js/games/pong.js',
  './js/games/mergedrop.js',
  './js/games/minesweeper.js',
  './js/games/dodge.js',
  './js/games/cave.js',
  './js/meta.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Fonts: cache-first (immutable enough for this use).
  // Everything else: NETWORK-FIRST so deploys reach clients immediately;
  // cache is the offline fallback, never the source of truth.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request))
    );
    return;
  }
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() =>
      caches.match(e.request).then(hit =>
        hit || caches.match('./index.html'))
    )
  );
});
