/* SPDX-License-Identifier: AGPL-3.0-or-later */
/* Runtime-cached PWA service worker. Hashed assets are immutable; the app
   shell falls back to the cached index when offline. */

const CACHE = "liangqi-shell-v1";
const scope = self.registration.scope;
const indexUrl = new URL("index.html", scope).toString();

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches
            .open(CACHE)
            .then((cache) => cache.add(indexUrl))
            .catch(() => undefined)
            .then(() => self.skipWaiting()),
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
            )
            .then(() => self.clients.claim()),
    );
});

self.addEventListener("fetch", (event) => {
    const request = event.request;
    if (request.method !== "GET") {
        return;
    }
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) {
        return;
    }

    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE).then((cache) => cache.put(indexUrl, copy));
                    }
                    return response;
                })
                .catch(() =>
                    caches
                        .match(indexUrl)
                        .then((cached) => cached ?? caches.match(scope)),
                ),
        );
        return;
    }

    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) {
                return cached;
            }
            return fetch(request).then((response) => {
                if (response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE).then((cache) => cache.put(request, copy));
                }
                return response;
            });
        }),
    );
});
