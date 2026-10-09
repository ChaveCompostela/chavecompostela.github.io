// Service worker de Chave Compostela: só recibe avisos push e móstraos coma notificación.
// Non garda contido en caché nin intercepta pedimentos; só garda un contador de novas sen ver
// (Cache 'badge') para o globo numérico da icona da app (Badging API).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// Suma unha nova ao contador e pinta o globo na icona (se o dispositivo o permite)
async function sumarGlobo(){
  try {
    const c = await caches.open('badge');
    const r = await c.match('/__novas');
    const n = (r ? parseInt(await r.text(), 10) || 0 : 0) + 1;
    await c.put('/__novas', new Response(String(n)));
    if ('setAppBadge' in self.navigator) await self.navigator.setAppBadge(n);
  } catch (err) { /* sen globo: non pasa nada */ }
}

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(Promise.all([sumarGlobo(), self.registration.showNotification(d.title || 'Chave Compostela', {
    body: d.body || '',
    icon: '/icons/apple-touch-icon.png',
    tag: d.tag || undefined,              // un tag distinto por nova: non se pisan entre elas
    data: { url: d.url || '/' },
  })]));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil((async () => {
    const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of abertas) {
      if ('focus' in c) return c.focus();
    }
    return self.clients.openWindow(url);
  })());
});
