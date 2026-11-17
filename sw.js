// App-shell cache so ORION opens instantly (and shows "Offline" instead of a blank page).
// Bump VERSION whenever you deploy changed files.
const VERSION = 'orion-v32';
const SHELL = ['./', 'index.html', 'css/app.css', 'js/app.js', 'js/graph.js', 'js/business.js', 'js/logo.js', 'js/intro.js', 'js/orbit.js', 'js/lab.js', 'js/leo-client.js', 'js/config.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Network first for the shell (fresh deploys win), cache as fallback. Never touch ORION API traffic.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html')))
  );
});
