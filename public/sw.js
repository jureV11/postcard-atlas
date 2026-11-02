// Postcard Atlas service worker: shows push notifications and opens the app
// when one is tapped. It doesn't cache pages, so the site is always up to date;
// with no connection it shows a little "you're offline" page instead of the
// browser's error (this also lets Android install it as a proper app).

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const OFFLINE = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offline · Postcard Atlas</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f0e4;color:#2a2622;font:16px system-ui,sans-serif;text-align:center;padding:24px">
<div><div style="font-size:48px">📮</div><h1 style="font:600 24px Georgia,serif;margin:12px 0 6px">You're offline</h1>
<p style="color:#6f655a;margin:0 0 18px">Postcard Atlas needs the internet. Try again once you're back online.</p>
<button onclick="location.reload()" style="font:inherit;padding:10px 18px;border:0;border-radius:999px;background:#2a2622;color:#f6f0e4">Try again</button></div>`;

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return; // everything else goes straight to the network
  event.respondWith(
    fetch(event.request).catch(
      () => new Response(OFFLINE, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }),
    ),
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Postcard Atlas", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag,
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.startsWith(self.location.origin) && "focus" in w) {
          w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
