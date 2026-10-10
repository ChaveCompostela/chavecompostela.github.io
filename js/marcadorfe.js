// Marcador: ferramenta de anotación en directo. Todo vive en memoria (non usa Supabase),
// así que ao recargar a páxina os marcadores volven ao seu valor inicial.
// Destaca en verde o equipo con máis puntos e o xogador con máis chaves,
// sempre entre os visibles, sen empate e con valor > 0.

const clamp0 = n => (n < 0 ? 0 : n);

// Equipos visibles (non ocultos)
function equiposVisibles(){
  const completa = document.getElementById('vista-marcador').classList.contains('mk-full');
  return [...document.querySelectorAll('#vista-marcador .marcador-equipo')]
    .filter(eq => !eq.hidden && !(completa && (eq.id === 'mk-c' || eq.id === 'mk-d')));   // en pantalla completa só se ven A e B
}

// Líder de puntos: entre os equipos visibles, o que teña máis puntos.
// Empate → ningún. Menos de 2 visibles → ningún. Máximo = 0 → ningún.
function actualizarLiderPuntos(){
  document.querySelectorAll('#vista-marcador .marcador-puntos.marcador-lider')
    .forEach(el => el.classList.remove('marcador-lider'));
  const equipos = equiposVisibles();
  if (equipos.length < 2) return;
  const datos = equipos.map(eq => ({
    el: eq.querySelector('.marcador-puntos'),
    puntos: Number(eq.querySelector('.marcador-puntos').textContent) || 0
  }));
  const max = Math.max(...datos.map(e => e.puntos));
  if (max <= 0) return;
  const lideres = datos.filter(e => e.puntos === max);
  if (lideres.length === 1) lideres[0].el.classList.add('marcador-lider');
}

// Líder de chaves: entre TODOS os xogadores visibles, o que teña máis chaves.
// Empate → ningún. Menos de 2 visibles → ningún. Máximo = 0 → ningún.
function actualizarLiderChaves(){
  document.querySelectorAll('#vista-marcador .marcador-chaves.marcador-lider')
    .forEach(el => el.classList.remove('marcador-lider'));
  const chaves = [];
  equiposVisibles().forEach(eq => {
    eq.querySelectorAll('.marcador-chaves').forEach(el => {
      chaves.push({ el, valor: Number(el.textContent) || 0 });
    });
  });
  if (chaves.length < 2) return;
  const max = Math.max(...chaves.map(c => c.valor));
  if (max <= 0) return;
  const lideres = chaves.filter(c => c.valor === max);
  if (lideres.length === 1) lideres[0].el.classList.add('marcador-lider');
}

function actualizarLideres(){
  actualizarLiderPuntos();
  actualizarLiderChaves();
}

document.addEventListener('click', e => {
  // Botóns de sumar/restar puntos ao equipo
  const botonPuntos = e.target.closest('#vista-marcador [data-add]');
  if (botonPuntos) {
    const equipo = botonPuntos.closest('.marcador-equipo');
    const marcador = equipo.querySelector('.marcador-puntos');
    const actual = Number(marcador.textContent) || 0;
    marcador.textContent = clamp0(actual + Number(botonPuntos.dataset.add));
    actualizarLideres();
    return;
  }

  // Botóns +1/-1 das chaves de cada xogador/a
  const botonChave = e.target.closest('#vista-marcador .mk-chb');
  if (botonChave) {
    const fila = botonChave.closest('.marcador-xog');
    const contador = fila.querySelector('.marcador-chaves');
    const actual = Number(contador.textContent) || 0;
    contador.textContent = clamp0(actual + Number(botonChave.dataset.chaves));
    actualizarLideres();
    return;
  }

  // Engadir equipo C ou D
  const addC = e.target.closest('#mk-add-c');
  if (addC) {
    const eq = document.getElementById('mk-c');
    if (eq) { eq.hidden = false; addC.hidden = true; }
    actualizarLideres();
    return;
  }
  const addD = e.target.closest('#mk-add-d');
  if (addD) {
    const eq = document.getElementById('mk-d');
    if (eq) { eq.hidden = false; addD.hidden = true; }
    actualizarLideres();
    return;
  }
});

// Reiniciar: pon a cero os números (puntos e chaves) de todos os equipos visibles.
document.getElementById('mk-reset')?.addEventListener('click', () => {
  if (!confirm('¿Reiniciar todos os marcadores a cero?')) return;
  document.querySelectorAll(
    '#vista-marcador .marcador-equipo:not([hidden]) .marcador-puntos, ' +
    '#vista-marcador .marcador-equipo:not([hidden]) .marcador-chaves'
  ).forEach(el => { el.textContent = '0'; });
  actualizarLideres();
});

// ---------- Pantalla completa: equipos A e B un ao carón do outro, con números grandes ----------
// Intenta tamén poñer o navegador en pantalla completa, bloquear a orientación en horizontal
// e manter a pantalla acesa; se o dispositivo non o permite (p. ex. iPhone), queda igualmente
// a vista ampliada, e basta xirar o móbil.
const vistaMk = document.getElementById('vista-marcador');
let bloqueoPantalla = null;

async function pedirBloqueoPantalla(){
  try { if (navigator.wakeLock) bloqueoPantalla = await navigator.wakeLock.request('screen'); } catch (e) {}
}

async function entrarPantallaCompleta(){
  vistaMk.classList.add('mk-full');
  try { if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); } catch (e) {}
  try { if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape'); } catch (e) {}
  await pedirBloqueoPantalla();
  actualizarLideres();
}

async function sairPantallaCompleta(){
  vistaMk.classList.remove('mk-full');
  try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) {}
  try { if (document.fullscreenElement) await document.exitFullscreen(); } catch (e) {}
  try { if (bloqueoPantalla) { await bloqueoPantalla.release(); bloqueoPantalla = null; } } catch (e) {}
  actualizarLideres();
}

document.getElementById('mk-full')?.addEventListener('click', entrarPantallaCompleta);
document.getElementById('mk-full-salir')?.addEventListener('click', sairPantallaCompleta);
// Se o usuario sae da pantalla completa do navegador (botón atrás / Esc), sae tamén a vista ampliada
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && vistaMk.classList.contains('mk-full')) sairPantallaCompleta();
});
// O bloqueo de pantalla acesa libérase ao ocultar a páxina: volve pedirse ao volver
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && vistaMk.classList.contains('mk-full') && !bloqueoPantalla) pedirBloqueoPantalla();
});
