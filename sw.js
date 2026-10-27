// 오프라인 플레이용 서비스 워커
// - 게임 화면(index.html): 인터넷이 되면 최신 버전을 받아 저장하고, 안 되면 저장된 버전으로 엽니다.
// - 아이콘·엠블럼·글꼴: 저장된 것이 있으면 바로 쓰고, 없으면 받아서 저장합니다.
const V = 'fl-v3';
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== V && k.startsWith('fl-')).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const timeout = ms => new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms));

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);

  if (r.mode === 'navigate' || (u.origin === location.origin && u.pathname.endsWith('/index.html'))) {
    e.respondWith((async () => {
      const c = await caches.open(V);
      try {
        const res = await Promise.race([fetch(r), timeout(3500)]);
        if (res && res.ok) c.put('./index.html', res.clone());
        return res;
      } catch (_) {
        return (await c.match('./index.html')) || (await c.match('./')) || Response.error();
      }
    })());
    return;
  }

  if (u.origin === location.origin || /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)) {
    e.respondWith((async () => {
      const c = await caches.open(V);
      const hit = await c.match(r);
      if (hit) {
        if (u.origin === location.origin) fetch(r).then(x => { if (x.ok) c.put(r, x) }).catch(() => {});
        return hit;
      }
      try {
        const res = await fetch(r);
        if (res.ok || res.type === 'opaque') c.put(r, res.clone());
        return res;
      } catch (_) {
        return Response.error();
      }
    })());
  }
});
