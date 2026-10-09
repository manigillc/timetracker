/* Time Tracker service worker.
   Online: loads the newest files and refreshes the saved copy.
   Offline (or very slow connection): opens the saved copy. */
var CACHE = 'timetracker-v3';
var FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (c) {
      // Save each file on its own so one missing file can't stop the whole install.
      return Promise.all(FILES.map(function (f) { return c.add(f).catch(function () {}); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(new Promise(function (resolve) {
    var settled = false;
    function answer(res) { if (!settled && res) { settled = true; resolve(res); } }

    // If the network takes more than 3 seconds, use the saved copy right away.
    var timer = setTimeout(function () {
      caches.match(req, { ignoreSearch: true }).then(answer);
    }, 3000);

    // 'no-cache' makes the browser check with GitHub every time instead of reusing a copy it fetched in the last 10 minutes.
    fetch(req, { cache: 'no-cache' }).then(function (res) {
      clearTimeout(timer);
      if (res && res.ok && !res.redirected) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      if (!settled) { settled = true; resolve(res); }
    }).catch(function () {
      clearTimeout(timer);
      caches.match(req, { ignoreSearch: true })
        .then(function (hit) { return hit || caches.match('./index.html'); })
        .then(function (hit) { return hit || caches.match('./'); })
        .then(function (hit) { if (!settled) { settled = true; resolve(hit || Response.error()); } });
    });
  }));
});
