// Marcador: ferramenta de anotación en directo. Todo vive en memoria (non usa Supabase),
// así que ao recargar a páxina os marcadores volven ao seu valor inicial.
// Destaca en verde o equipo con máis puntos e o xogador con máis chaves,
// sempre entre os visibles, sen empate e con valor > 0.

const clamp0 = n => (n < 0 ? 0 : n);

// ---------- Rexistro das tiradas para a acta ----------
// Só actúa cando hai unha partida real cargada (ACTA.activa) e só nos equipos A e B. Todo vai nun único
// rexistro cronolóxico (ACTA.log) do que se deducen as secuencias (actaDerivar).
// Regras do xogo:
//  · En cada tirada só puntúa unha parella (a outra fai 0): cada pulsación de puntos é unha tirada e engade
//    n ao que puntúa e 0 ao outro. «-n» quita a última tirada de n puntos do equipo (ou resta n á última maior).
//  · ORDE: primeiro os puntos e despois as chaves. Cada chave vai á última tirada rexistrada, así se sabe a que
//    tirada pertence (subíndice na acta).
//  · Chaves matadas: se os dous bandos dan á chave na mesma tirada, anúlanse (8-8, 16-8, 16-16): as chaves
//    cóntanse a cada xogador pero non hai eses puntos, e na acta saen en VERMELLO (a parte anulada).
//    Combinacións posibles (puntos · chaves do que puntúa-do outro): 1·1-1, 8·2-1 e 0·2-2 (ninguén puntúa).
//  · O marcador pregunta cando as chaves non cadran cos puntos (actaClasificar): se se marcan chaves sen puntos,
//    ou chaves a ambos bandos, por se son chaves matadas ou un erro; e avisa ao pasar a outra tirada se a
//    anterior quedou sen cadrar (p. ex. 8 puntos sen chave).
//  · ACTA.base garda o xa escrito (retomado da base de datos ou editado no panel da acta).
const ACTA = { activa: false, base: null, log: [], desaxuste: false };

function actaReiniciar(){
  ACTA.base = { a: [], b: [], ch: { a1: [], a2: [], b1: [], b2: [] } };
  ACTA.log = [];
  ACTA.desaxuste = false;
}
actaReiniciar();

// Fixa as tiradas tal cal (retomadas ou editadas): substitúe todo o rexistro.
// pa/pb: [n, ...] · ch: { a1: [{n, t, r}], ... }
function actaFixar(pa, pb, ch){
  ACTA.base = { a: pa.slice(), b: pb.slice(), ch: { a1: [], a2: [], b1: [], b2: [], ...Object.fromEntries(Object.entries(ch || {}).map(([k, v]) => [k, v.map(e => ({ ...e }))])) } };
  ACTA.log = [];
}

const actaTiradaActual = () => { for (let i = ACTA.log.length - 1; i >= 0; i--) if (ACTA.log[i].k === 'p') return ACTA.log[i]; return null; };

// Chaves de cada bando (a, b) rexistradas nunha tirada, máis as que se queren probar
function actaConteo(p, extra){
  const c = { a: 0, b: 0 };
  ACTA.log.forEach(ev => { if (ev.k === 'c' && ev.p === p) c[ev.clave[0]]++; });
  (extra || []).forEach(cl => { c[cl[0]]++; });
  return c;
}
// Clasifica unha tirada segundo os seus puntos e chaves (ver actaClasificar)
function actaEstadoTirada(p, extra){
  const c = actaConteo(p, extra);
  if (!p || p.eq == null || p.n === 0) return { c, cls: actaClasificar(0, c.a, c.b) };
  return { c, cls: actaClasificar(p.n, c[p.eq], c[p.eq === 'a' ? 'b' : 'a']) };
}

// Pulsación de puntos (n > 0). Devolve true se se anota. Avisa se a tirada anterior quedou sen cadrar.
async function actaPuntoPulsado(eq, n){
  const p = actaTiradaActual();
  if (p && !p.ok) {
    const { c, cls } = actaEstadoTirada(p);
    if (cls === 'incompleta' || cls === 'invalida') {
      const op = await actaOpciones('A tirada anterior non cadra',
        `A última tirada leva ${p.n} puntos e chaves ${c.a}-${c.b} (local-visitante). Lembra: primeiro os puntos e despois as chaves; os 8, 9 e 16 puntos levan chave.`,
        ['Volver e corrixir', 'Seguir igualmente']);
      if (op === 0) return false;
      p.ok = true;
    }
  }
  ACTA.log.push({ k: 'p', eq, n });
  return true;
}

function actaPuntos(eq, n){            // n < 0: resta (desfai)
  const v = -n, L = ACTA.log;
  const quitar = i => {                // as chaves da tirada quitada pasan á anterior
    const ev = L[i];
    const previo = L.slice(0, i).reverse().find(x => x.k === 'p') || null;
    L.splice(i, 1);
    L.forEach(x => { if (x.k === 'c' && x.p === ev) x.p = previo; });
  };
  for (let i = L.length - 1; i >= 0; i--) if (L[i].k === 'p' && L[i].eq === eq && L[i].n === v) { quitar(i); return; }
  for (let i = L.length - 1; i >= 0; i--) if (L[i].k === 'p' && L[i].eq === eq && L[i].n > v) { L[i].n -= v; return; }
  const arr = ACTA.base[eq];
  let i = arr.lastIndexOf(v);
  if (i >= 0) { arr.splice(i, 1); ACTA.base[eq === 'a' ? 'b' : 'a'].splice(i, 1); return; }   // quita a tirada enteira
  ACTA.desaxuste = true;               // non hai nada que desfacer: as tiradas non cadrarán cos puntos
}

// Pulsación +1 de chave dun xogador (a1, a2, b1, b2). Devolve true se se anota; pregunta se non cadra.
async function actaChavePulsada(clave){
  let p = actaTiradaActual();
  if (p && p.ok) { ACTA.log.push({ k: 'c', clave, p }); return true; }
  const { c, cls } = p ? actaEstadoTirada(p, [clave]) : { c: { a: 0, b: 0 }, cls: 'invalida' };
  if (cls === 'normal' || cls === 'incompleta') { ACTA.log.push({ k: 'c', clave, p }); return true; }
  if (cls === 'matadas') {
    const op = await actaOpciones('Chaves matadas?',
      `A tirada leva ${p.n} puntos e chaves nos dous bandos (${c.a}-${c.b}). Se as chaves se anulan na mesma tirada non hai eses puntos e na acta saen en vermello.`,
      ['Si, chaves matadas', 'Foi un erro']);
    if (op !== 0) return false;
    p.ok = true; ACTA.log.push({ k: 'c', clave, p }); return true;
  }
  // non cadra: erro ou chaves matadas?
  const texto = p
    ? `Esta chave non cadra cos ${p.n} puntos da última tirada (chaves ${c.a}-${c.b} con ela). Se non marcaches puntos nesta tirada, pode ser unha tirada de chaves matadas sen puntos.`
    : 'Marcaches unha chave sen puntos nesta tirada. Pode ser un erro ou unha tirada de chaves matadas.';
  const ops = p ? ['Foi un erro (non anotar a chave)', 'Chaves matadas nesta tirada', 'Nova tirada sen puntos (chaves matadas)']
                : ['Foi un erro (non anotar a chave)', 'Nova tirada sen puntos (chaves matadas)'];
  const op = await actaOpciones('As chaves non cadran cos puntos', texto, ops);
  if (op === 0) return false;
  if (p && op === 1) { p.ok = true; ACTA.log.push({ k: 'c', clave, p }); return true; }
  const nueva = { k: 'p', eq: null, n: 0, ok: true };
  ACTA.log.push(nueva, { k: 'c', clave, p: nueva });
  return true;
}

function actaChaves(clave, delta){     // delta -1: quita a última chave anotada do xogador
  const L = ACTA.log;
  for (let i = L.length - 1; i >= 0; i--) if (L[i].k === 'c' && L[i].clave === clave) { L.splice(i, 1); return; }
  const arr = ACTA.base.ch[clave];
  if (!arr.length) { ACTA.desaxuste = true; return; }
  arr[arr.length - 1].n -= 1;
  if (arr[arr.length - 1].n <= 0) arr.pop();
}

// Deduce as secuencias finais: { puntos: {a: [...], b: [...]}, chaves: {a1: [{n, t, r}], ...} }
// Chaves anuladas: nunha tirada con chaves dos dous bandos, min(chaves local, chaves visitante) de cada un son
// anuladas (r: true) e as demais normais.
function actaDerivar(){
  const pa = ACTA.base.a.slice(), pb = ACTA.base.b.slice();
  const ch = {};
  Object.keys(ACTA.base.ch).forEach(k => { ch[k] = ACTA.base.ch[k].map(e => ({ ...e })); });
  let tir = Math.max(pa.length, pb.length);
  const num = new Map();
  ACTA.log.forEach(ev => {
    if (ev.k !== 'p') return;
    num.set(ev, ++tir);
    (ev.eq === 'a' ? pa : pb).push(ev.eq == null ? 0 : ev.n);
    if (ev.eq == null) pa.push(0);
    else (ev.eq === 'a' ? pb : pa).push(0);
  });
  // ev.eq == null (tirada sen puntos): ámbalas dúas reciben 0
  const porTirada = new Map();
  ACTA.log.forEach(ev => {
    if (ev.k !== 'c') return;
    const t = ev.p ? num.get(ev.p) : (tir || null);
    if (!porTirada.has(t)) porTirada.set(t, { a1: 0, a2: 0, b1: 0, b2: 0 });
    porTirada.get(t)[ev.clave]++;
  });
  porTirada.forEach((cnt, t) => {
    const red = Math.min(cnt.a1 + cnt.a2, cnt.b1 + cnt.b2);
    ['a', 'b'].forEach(eq => {
      let resto = red;
      [eq + '1', eq + '2'].forEach(k => {
        const n = cnt[k]; if (!n) return;
        const r = Math.min(n, resto); resto -= r;
        if (r > 0) ch[k].push({ n: r, t, r: true });
        if (n - r > 0) ch[k].push({ n: n - r, t, r: false });
      });
    });
  });
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
    const delta = Number(botonPuntos.dataset.add);
    const k = ACTA.activa ? claveEquipo(equipo) : null;
    const aplicar = () => { marcador.textContent = clamp0((Number(marcador.textContent) || 0) + delta); actualizarLideres(); };
    if (k && delta > 0) { actaPuntoPulsado(k, delta).then(ok => { if (ok) aplicar(); }); return; }
    if (k) actaPuntos(k, delta);
    aplicar();
    return;
  }

  // Botóns +1/-1 das chaves de cada xogador/a
  const botonChave = e.target.closest('#vista-marcador .mk-chb');
  if (botonChave) {
    const fila = botonChave.closest('.marcador-xog');
    const contador = fila.querySelector('.marcador-chaves');
    const delta = Number(botonChave.dataset.chaves);
    const k = ACTA.activa ? claveXogador(fila) : null;
    const aplicar = () => { contador.textContent = clamp0((Number(contador.textContent) || 0) + delta); actualizarLideres(); };
    if (k && delta > 0) { actaChavePulsada(k).then(ok => { if (ok) aplicar(); }); return; }
    if (k) actaChaves(k, delta);
    aplicar();
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
  const conActa = ACTA.activa;
  if (!confirm(conActa ? 'Reiniciar todos os marcadores a cero? Tamén se borrarán as tiradas da acta.' : 'Reiniciar todos os marcadores a cero?')) return;
  document.querySelectorAll(
    '#vista-marcador .marcador-equipo:not([hidden]) .marcador-puntos, ' +
    '#vista-marcador .marcador-equipo:not([hidden]) .marcador-chaves'
  ).forEach(el => { el.textContent = '0'; });
  actaReiniciar();                      // tiradas de puntos e chaves da acta
  if (typeof actaPanelReiniciado === 'function') actaPanelReiniciado();   // panel da acta e incidencias
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
