// Avisos push das novas: rexistra o service worker e xestiona o botón do menú
// "Avisarme das novas" / "Desactivar avisos das novas".
// Garda a subscrición na táboa push_suscripciones (só inserción con clave anon).
// Depende de: configfe.js (sbfe, VAPID_PUBLIC_KEY_FE). pecharMenu vén de appfe.js.

(function () {
  const btn = document.getElementById('btn-avisos');
  const txt = document.getElementById('btn-avisos-txt');
  if (!btn) return;

  const soportado = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const configurado = typeof sbfe !== 'undefined' && sbfe
    && typeof VAPID_PUBLIC_KEY_FE === 'string' && VAPID_PUBLIC_KEY_FE && !VAPID_PUBLIC_KEY_FE.includes('TU-');
  if (!soportado || !configurado) return;   // o botón queda oculto

  const TXT_ACTIVAR = 'Avisarme das novas';
  const TXT_DESACTIVAR = 'Desactivar avisos das novas';

  function claveAUint8(b64) {
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  }

  let rexistro = null;
  const listo = navigator.serviceWorker.register('/sw.js').then(r => { rexistro = r; return r; });

  async function subscricionActual() {
    const r = rexistro || await listo;
    return r.pushManager.getSubscription();
  }

  async function actualizarBoton() {
    try {
      const sub = await subscricionActual();
      txt.textContent = sub && Notification.permission === 'granted' ? TXT_DESACTIVAR : TXT_ACTIVAR;
      btn.hidden = false;
    } catch (e) {
      btn.hidden = true;   // o service worker non se puido rexistrar: non se ofrece a opción
    }
  }

  async function activar() {
    if (Notification.permission === 'denied') {
      alert('As notificacións están bloqueadas para esta páxina. Actívaas nos axustes do navegador e volve intentalo.');
      return;
    }
    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') { alert('Non se activaron os avisos: non concedeches o permiso.'); return; }
    const r = rexistro || await listo;
    const sub = await r.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: claveAUint8(VAPID_PUBLIC_KEY_FE),
    });
    const j = sub.toJSON();
    const { error } = await sbfe.from('push_suscripciones')
      .insert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth });
    if (error && error.code !== '23505') {   // 23505 = xa estaba rexistrada: non é un erro
      await sub.unsubscribe();
      throw new Error(error.message);
    }
    alert('Listo! Recibirás un aviso cada vez que se publique unha nova.');
  }

  async function desactivar() {
    const sub = await subscricionActual();
    if (sub) await sub.unsubscribe();
    alert('Avisos desactivados.');
  }

  btn.addEventListener('click', async () => {
    if (typeof pecharMenu === 'function') pecharMenu();
    try {
      const sub = await subscricionActual();
      if (sub && Notification.permission === 'granted') await desactivar(); else await activar();
    } catch (e) {
      alert('Non se puido completar: ' + e.message);
    }
    actualizarBoton();
  });

  actualizarBoton();
})();
