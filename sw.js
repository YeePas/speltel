const STATIC_CACHE = "spelteller-static-v11";
const RUNTIME_CACHE = "spelteller-runtime-v11";
const APP_SHELL = [
  "./",
  "./index.html",
  "./admin.html",
  "./offline.html",
  "./config.js",
  "./styles.css",
  "./app.js",
  "./admin.js",
  "./manifest.webmanifest",
  "./icons/icon-192.svg",
  "./icons/icon-512.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => ![STATIC_CACHE, RUNTIME_CACHE].includes(key)).map((key) => caches.delete(key))
      );

      if ("navigationPreload" in self.registration) {
        await self.registration.navigationPreload.enable();
      }

      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(event));
    return;
  }

  if (url.origin === self.location.origin) {
    if (shouldUseNetworkFirst(url)) {
      event.respondWith(networkFirst(request, STATIC_CACHE));
      return;
    }

    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (url.origin.includes("googleapis.com") || url.origin.includes("gstatic.com")) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
  }
});

async function handleNavigationRequest(event) {
  try {
    const preloadResponse = await event.preloadResponse;
    if (preloadResponse) {
      return preloadResponse;
    }

    const networkResponse = await fetch(event.request);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(event.request, networkResponse.clone());
    return networkResponse;
  } catch {
    const cachedResponse = await caches.match(event.request);
    return cachedResponse || caches.match("./index.html") || caches.match("./offline.html");
  }
}

async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    throw new Error("Network unavailable");
  }
}

function shouldUseNetworkFirst(url) {
  return ["/", "/index.html", "/admin.html", "/app.js", "/admin.js", "/styles.css", "/config.js"].includes(
    url.pathname
  );
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      cache.put(request, response.clone());
      return response;
    })
    .catch(() => cachedResponse);

  return cachedResponse || networkPromise;
}
