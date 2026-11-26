const CACHE_NAME = "bcb-management-shell-v2";

self.addEventListener("install", (event) => {
  // Do not precache the protected Preview URL during installation.
  // Vercel Shareable Links may reject requests that omit the share token.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("bcb-management-shell-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.includes("supabase")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(
              caches.open(CACHE_NAME).then((cache) => cache.put("/", copy)),
            );
          }
          return response;
        })
        .catch(async () => (await caches.match("/")) || Response.error()),
    );
  }
});


self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Big Collection BD", body: event.data?.text() || "নতুন Notification এসেছে।" };
  }
  const title = String(data.title || "Big Collection BD").slice(0, 80);
  const options = {
    body: String(data.body || "নতুন Notification এসেছে।").slice(0, 500),
    icon: "/app-icon.svg",
    badge: "/app-icon.svg",
    data: { url: data.url || "/" },
    tag: data.tag || undefined,
    renotify: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(self.location.origin) && "focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(targetUrl);
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(targetUrl);
  })());
});
