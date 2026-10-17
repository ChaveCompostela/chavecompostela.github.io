// Marcador: ferramenta de anotación en directo. Todo vive en memoria (non usa Supabase),
// así que ao recargar a páxina os marcadores volven ao seu valor inicial.
// Destaca en verde o equipo con máis puntos e o xogador con máis chaves,
// sempre entre os visibles, sen empate e con valor > 0.

const clamp0 = n => (n < 0 ? 0 : n);

// ---------- Rexistro das tiradas para a acta ----------
// Só actúa cando hai unha partida real cargada (ACTA.activa) e só nos equipos A e B. Todo vai nun único
// rexistro cronolóxico (ACTA.log) do que se deducen as secuencias (actaDerivar):
//  · Puntos: cada pulsación +1/+2/+8/+9/+16 é unha tirada, e en cada tirada só puntúa unha parella: a
//    outra fai 0. Así as dúas secuencias teñen sempre as mesmas tiradas (A=1+2+0, B=0+0+8).
//    Un «-n» quita a última tirada de n puntos do equipo (ou resta n á última maior): +1 e despois -1
//    non deixa nada na acta, e un +2 que era 0 desfaise con -2.
//  · Chaves: unha entrada por tirada con chaves, sen ceros, co número da tirada en que se fixeron
//    (1@3+2@7 → «1₃+2₇» na acta). Pulsacións seguidas do mesmo xogador (sen nada polo medio) son a mesma
//    tirada: 1+1 → 2. A tirada é a do punto veciño do mesmo equipo (de preferencia un de 8 ou máis, que
//    son os que levan chave); se non hai ningún veciño, a última tirada rexistrada.
//  · ACTA.base garda o xa escrito (retomado da base de datos ou editado no panel da acta).
const ACTA = { activa: false, base: null, log: [], desaxuste: false };

function actaReiniciar(){
  ACTA.base = { a: [], b: [], ch: { a1: [], a2: [], b1: [], b2: [] } };
  ACTA.log = [];
  ACTA.desaxuste = false;
}
actaReiniciar();

// Fixa as tiradas tal cal (retomadas ou editadas): substitúe todo o rexistro.
// pa/pb: [n, ...] · ch: { a1: [{n, t}], ... }
function actaFixar(pa, pb, ch){
  ACTA.base = { a: pa.slice(), b: pb.slice(), ch: { a1: [], a2: [], b1: [], b2: [], ...Object.fromEntries(Object.entries(ch || {}).map(([k, v]) => [k, v.map(e => ({ ...e }))])) } };
  ACTA.log = [];
}

function actaPuntos(eq, n){            // n > 0 suma, n < 0 resta
  if (n > 0) { ACTA.log.push({ k: 'p', eq, n }); return; }
  const v = -n, L = ACTA.log;
  for (let i = L.length - 1; i >= 0; i--) if (L[i].k === 'p' && L[i].eq === eq && L[i].n === v) { L.splice(i, 1); return; }
  for (let i = L.length - 1; i >= 0; i--) if (L[i].k === 'p' && L[i].eq === eq && L[i].n > v) { L[i].n -= v; return; }
  const arr = ACTA.base[eq];
  let i = arr.lastIndexOf(v);
  if (i >= 0) { arr.splice(i, 1); ACTA.base[eq === 'a' ? 'b' : 'a'].splice(i, 1); return; }   // quita a tirada enteira
  ACTA.desaxuste = true;               // non hai nada que desfacer: as tiradas non cadrarán cos puntos
}

function actaChaves(clave, delta){     // clave: a1, a2, b1, b2; delta: +1 / -1
  if (delta > 0) { ACTA.log.push({ k: 'c', clave }); return; }
  const L = ACTA.log;
  for (let i = L.length - 1; i >= 0; i--) if (L[i].k === 'c' && L[i].clave === clave) { L.splice(i, 1); return; }
  const arr = ACTA.base.ch[clave];
  if (!arr.length) { ACTA.desaxuste = true; return; }
  arr[arr.length - 1].n -= 1;
  if (arr[arr.length - 1].n <= 0) arr.pop();
}

// Deduce as secuencias finais: { puntos: {a: [...], b: [...]}, chaves: {a1: [{n, t}], ...} }
function actaDerivar(){
  const pa = ACTA.base.a.slice(), pb = ACTA.base.b.slice();
  const ch = {};
  Object.keys(ACTA.base.ch).forEach(k => { ch[k] = ACTA.base.ch[k].map(e => ({ ...e })); });
  const L = ACTA.log;
  let tir = Math.max(pa.length, pb.length);
  const tirDe = new Array(L.length).fill(null);
  L.forEach((ev, i) => {
    if (ev.k !== 'p') return;
    tir++; tirDe[i] = tir;
    (ev.eq === 'a' ? pa : pb).push(ev.n);
    (ev.eq === 'a' ? pb : pa).push(0);
  });
  let i = 0;
  while (i < L.length) {
    if (L[i].k !== 'c') { i++; continue; }
    let j = i;
    while (j + 1 < L.length && L[j + 1].k === 'c' && L[j + 1].clave === L[i].clave) j++;
    const clave = L[i].clave, eq = clave[0];
    const prev = i > 0 && L[i - 1].k === 'p' ? { ev: L[i - 1], t: tirDe[i - 1] } : null;
    const next = j + 1 < L.length && L[j + 1].k === 'p' ? { ev: L[j + 1], t: tirDe[j + 1] } : null;
    const mismo = x => !!x && x.ev.eq === eq, conChave = x => mismo(x) && x.ev.n >= 8;
    const elixido = [conChave(prev) && prev, conChave(next) && next, mismo(prev) && prev, mismo(next) && next, prev, next].find(Boolean);
    ch[clave].push({ n: j - i + 1, t: elixido ? elixido.t : (tir || null) });
    i = j + 1;
  }
  return { puntos: { a: pa, b: pb }, chaves: ch };
}

const claveEquipo = eq => (eq && eq.id === 'mk-a' ? 'a' : eq && eq.id === 'mk-b' ? 'b' : null);
function claveXogador(fila){
  const eq = fila.closest('.marcador-equipo');
  const k = claveEquipo(eq);
  return k ? k + ([...eq.querySelectorAll('.marcador-xog')].indexOf(fila) + 1) : null;
}

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
    if (ACTA.activa) { const k = claveEquipo(equipo); if (k) actaPuntos(k, Number(botonPuntos.dataset.add)); }
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
    if (ACTA.activa) { const k = claveXogador(fila); if (k) actaChaves(k, Number(botonChave.dataset.chaves)); }
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
  actaReiniciar();
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
