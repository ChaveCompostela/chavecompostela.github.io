// Service worker de Chave Compostela: só recibe avisos push e móstraos coma notificación.
// Non garda nada en caché nin intercepta pedimentos.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Chave Compostela', {
    body: d.body || '',
    icon: '/icons/apple-touch-icon.png',
    tag: d.tag || undefined,              // un tag distinto por nova: non se pisan entre elas
    data: { url: d.url || '/' },
  }));
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
