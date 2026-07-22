/*
 * Service worker: cachea el shell de la app para que abra al instante
 * y funcione sin conexión (los datos siguen necesitando red).
 * Estrategia: network-first para HTML y API, cache-first para estáticos.
 */
const CACHE = "vaquita-v1";
const SHELL = [
	"/",
	"/css/main.css",
	"/js/api.js",
	"/js/components.js",
	"/js/views/login.js",
	"/js/views/grupos.js",
	"/js/views/grupo.js",
	"/js/views/ajustes.js",
	"/js/app.js",
	"/manifest.webmanifest",
	"/icons/icon.svg",
];

self.addEventListener("install", (e) => {
	e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
	self.skipWaiting();
});

self.addEventListener("activate", (e) => {
	e.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
		),
	);
	self.clients.claim();
});

self.addEventListener("fetch", (e) => {
	const url = new URL(e.request.url);
	if (e.request.method !== "GET" || url.pathname.startsWith("/api/")) return;

	e.respondWith(
		caches.match(e.request).then(
			(cached) =>
				cached ||
				fetch(e.request).then((res) => {
					if (res.ok && url.origin === location.origin) {
						const clone = res.clone();
						caches.open(CACHE).then((c) => c.put(e.request, clone));
					}
					return res;
				}),
		).catch(() => caches.match("/")),
	);
});
