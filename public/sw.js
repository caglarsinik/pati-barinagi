/*
 * Pati Barınağı service worker: tek dosya oyunu, manifest ve ikonları önbelleğe alır; çevrimdışı açılır.
 * Sürüm, kayıt URL'sindeki ?v= parametresinden gelir (src/pwa.ts GAME.version ile kaydeder): sürüm değişince
 * tarayıcı yeni bir service worker indirir, eski önbellek silinir, sayfa "Şimdi yenile" ile yeni sürüme geçer.
 */
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = `pati-${VERSION}`;
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon-180.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('pati-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const isPage = req.mode === 'navigate' || req.destination === 'document';
  if (isPage) {
    // Sayfa: ağ öncelikli (yeni sürüm hemen gelsin), ağ yoksa önbellekteki oyun.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }
  // Manifest, ikonlar vb.: önbellek öncelikli, yoksa ağdan alıp sakla.
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
