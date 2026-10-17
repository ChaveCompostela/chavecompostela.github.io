// Esqueleto da aplicación: cambio de vista (pestañas inferiores + menú superior)
// e selector Feminina / Masculina dentro de cada apartado. Sen conexión a datos por agora.

const tabs = document.querySelectorAll('.tab');
const menuItems = document.querySelectorAll('.menu-item[data-vista]');
const vistas = document.querySelectorAll('.vista');
const btnMenu = document.getElementById('btn-menu');
const menu = document.getElementById('menu');
const menuFondo = document.getElementById('menu-fondo');
const btnLogo = document.getElementById('btn-logo');
const btnInfo = [document.getElementById('btn-titulo')];   // só o título abre o globo; o logo recarga a app
const globo = document.getElementById('globo');
const globoFondo = document.getElementById('globo-fondo');

function amosarVista(nome){
  vistas.forEach(v => v.hidden = v.id !== 'vista-' + nome);
  tabs.forEach(t => t.classList.toggle('activa', t.dataset.vista === nome));
  document.getElementById('contido').scrollTop = 0;
  cargarVistaUnaVez(nome);                      // carga o apartado a primeira vez que se abre (novasfe.js)
  if (nome === 'calendario' && typeof axustarScrollCalendario === 'function') axustarScrollCalendario();
}

tabs.forEach(t => t.addEventListener('click', () => amosarVista(t.dataset.vista)));

menuItems.forEach(m => m.addEventListener('click', () => {
  pecharMenu();
  amosarVista(m.dataset.vista);
  tabs.forEach(t => t.classList.remove('activa'));   // "Marcador" non é unha pestaña inferior
}));

function abrirMenu(){
  menu.hidden = false; menuFondo.hidden = false;
  btnMenu.setAttribute('aria-expanded', 'true');
}
function pecharMenu(){
  menu.hidden = true; menuFondo.hidden = true;
  btnMenu.setAttribute('aria-expanded', 'false');
}
btnMenu.addEventListener('click', () => {
  pecharGlobo();
  menu.hidden ? abrirMenu() : pecharMenu();
});
menuFondo.addEventListener('click', pecharMenu);

// Globo de información, ao premer no logo ou no título
function abrirGlobo(){
  globo.hidden = false; globoFondo.hidden = false;
  btnInfo.forEach(b => b.setAttribute('aria-expanded', 'true'));
}
function pecharGlobo(){
  globo.hidden = true; globoFondo.hidden = true;
  btnInfo.forEach(b => b.setAttribute('aria-expanded', 'false'));
}
btnInfo.forEach(b => b.addEventListener('click', () => {
  pecharMenu();
  globo.hidden ? abrirGlobo() : pecharGlobo();
}));
globoFondo.addEventListener('click', pecharGlobo);

// Selector Feminina / Masculina dentro de cada apartado (Partidos, Clasificación, Calendario, Equipos)
document.querySelectorAll('.vista-liga').forEach(vista => {
  const segs = vista.querySelectorAll('.seg');
  const paneis = vista.querySelectorAll('.panel-liga');
  segs.forEach(s => s.addEventListener('click', () => {
    segs.forEach(x => x.classList.toggle('activa', x === s));
    paneis.forEach(p => p.hidden = p.dataset.liga !== s.dataset.liga);
  }));
});

// Globo de novas na icona da app: ao abrir (ou volver a) a app dáse por vistas as novas:
// bórrase o globo, ponse a cero o contador que leva o service worker e péchanse os avisos pendentes.
async function limparGlobo(){
  try { if ('clearAppBadge' in navigator) await navigator.clearAppBadge(); } catch (e) {}
  try { const c = await caches.open('badge'); await c.put('/__novas', new Response('0')); } catch (e) {}
  try {
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
    if (reg) (await reg.getNotifications()).forEach(n => n.close());
  } catch (e) {}
}
limparGlobo();
document.addEventListener('visibilitychange', () => { if (!document.hidden) limparGlobo(); });

// O logo da esquina superior esquerda recarga a app. O Marcador vive só en memoria:
// se hai puntos ou chaves anotados, pídese confirmación antes de recargar.
btnLogo.addEventListener('click', () => {
  const hayMarcador = [...document.querySelectorAll('#vista-marcador .marcador-puntos, #vista-marcador .marcador-chaves')]
    .some(el => (el.textContent || '0').trim() !== '0');
  if (hayMarcador && !confirm('Hai un marcador en curso: se recargas, perderase. Recargar igualmente?')) return;
  location.reload();
});
