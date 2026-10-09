/* Time Tracker service worker.
   Online: loads the newest files and refreshes the saved copy.
   Offline (or very slow connection): opens the saved copy. */
var CACHE = 'timetracker-v1';
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
    caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); })
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

    fetch(req).then(function (res) {
      clearTimeout(timer);
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      if (!settled) { settled = true; resolve(res); }
    }).catch(function () {
      clearTimeout(timer);
      caches.match(req, { ignoreSearch: true }).then(function (hit) {
        return hit || caches.match('./index.html');
      }).then(function (hit) {
        if (!settled) { settled = true; resolve(hit || Response.error()); }
      });
    });
  }));
});
