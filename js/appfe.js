// Esqueleto da aplicación: cambio de vista (pestañas inferiores + menú superior)
// e selector Feminina / Masculina dentro de cada apartado. Sen conexión a datos por agora.

const tabs = document.querySelectorAll('.tab');
const menuItems = document.querySelectorAll('.menu-item');
const vistas = document.querySelectorAll('.vista');
const btnMenu = document.getElementById('btn-menu');
const menu = document.getElementById('menu');
const menuFondo = document.getElementById('menu-fondo');

function amosarVista(nome){
  vistas.forEach(v => v.hidden = v.id !== 'vista-' + nome);
  tabs.forEach(t => t.classList.toggle('activa', t.dataset.vista === nome));
  document.getElementById('contido').scrollTop = 0;
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
btnMenu.addEventListener('click', () => menu.hidden ? abrirMenu() : pecharMenu());
menuFondo.addEventListener('click', pecharMenu);

// Selector Feminina / Masculina dentro de cada apartado (Partidos, Clasificación, Calendario, Equipos)
document.querySelectorAll('.vista-liga').forEach(vista => {
  const segs = vista.querySelectorAll('.seg');
  const paneis = vista.querySelectorAll('.panel-liga');
  segs.forEach(s => s.addEventListener('click', () => {
    segs.forEach(x => x.classList.toggle('activa', x === s));
    paneis.forEach(p => p.hidden = p.dataset.liga !== s.dataset.liga);
  }));
});
