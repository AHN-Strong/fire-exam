// 오프라인 지원: 앱 파일은 캐시 우선 + 백그라운드 갱신. 앱 파일을 수정하면 VERSION을 올리세요.
const VERSION = "fire-exam-v4";
const SHELL = ["./", "index.html", "styles.css", "manifest.webmanifest", "js/config.js",
  "js/seed.js", "js/exam2025.js", "js/explain2025.js", "js/store.js", "js/charts.js", "js/ai.js", "js/app.js",
  "img/E2025-S1-22.png", "img/icon-192.png", "img/icon-512.png", "img/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return; // AI 호출 등은 캐시하지 않음
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const hit = await cache.match(req, { ignoreSearch: true });
    const net = fetch(req).then((r) => { if (r.ok) cache.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
