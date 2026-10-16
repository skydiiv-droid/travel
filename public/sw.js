// 앱 셸 캐시. 공유 자료(Firestore/Storage)는 항상 네트워크로 가져온다.
// 전략: 네트워크 우선(online이면 항상 최신 코드) + 실패 시 캐시 폴백(오프라인 대비).
const CACHE = "myshare-shell-v2";
const SHELL = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/manifest.webmanifest",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // 같은 오리진의 GET 요청만 처리. 나머지(Firebase API/Storage 등)는 통과.
  if (url.origin !== self.location.origin) return;
  if (e.request.method !== "GET") return;

  // 네트워크 우선: 성공하면 그 응답을 캐시에 갱신, 실패(오프라인)면 캐시에서.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
