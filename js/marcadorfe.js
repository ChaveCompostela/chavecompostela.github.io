// Marcador: ferramenta de anotación en directo. Todo vive en memoria (non usa Supabase),
// así que ao recargar a páxina os marcadores volven ao seu valor inicial.
// Destaca en verde o equipo con máis puntos e o xogador con máis chaves,
// sempre entre os visibles, sen empate e con valor > 0.

const clamp0 = n => (n < 0 ? 0 : n);

// ---------- Rexistro das tiradas para a acta ----------
// Só actúa cando hai unha partida real cargada (ACTA.activa) e só nos equipos A e B.
// Unha TIRADA péchase soa cando pasan ACTA_SEGUNDOS segundos sen anotar nada (ou co botón «Seguinte tirada»).
// Dentro dunha tirada anótase en calquera orde (puntos e chaves, de calquera equipo). Ao pecharse avalíase:
//  · en cada tirada só puntúa un equipo (a suma dos seus puntos), e cada equipo lanza un xogador con 2 pesos;
//  · combinacións posibles (puntos · chaves do que puntúa-do outro): 1 ou 2 · 0-0 · 8 ou 9 · 1-0 · 16 · 2-0 ·
//    e, con chaves matadas (as chaves dos dous bandos anúlanse na mesma tirada): 1·1-1, 8·2-1 e 0·2-2;
//  · se é normal, pasa á seguinte tirada sen preguntar; se hai chaves matadas ou algo non cadra, avisa e permite
//    corrixir (a tirada segue aberta) ou dala por boa e pasar á seguinte.
// As chaves matadas contan para o total de cada xogador e saen en VERMELLO na acta (a parte anulada).
// «-n» quita puntos / «-1» quita unha chave da tirada aberta; se esta está baleira, reabre a anterior.
const ACTA_SEGUNDOS = 10;
const ACTA = { activa: false, base: null, tiradas: [], actual: null, timer: null, reloxo: null, cerrando: false, desaxuste: false, fin: 0 };

const actaTiradaNova = () => ({ pa: 0, pb: 0, ch: { a1: 0, a2: 0, b1: 0, b2: 0 } });
const actaVacia = td => !td || (td.pa === 0 && td.pb === 0 && td.ch.a1 + td.ch.a2 + td.ch.b1 + td.ch.b2 === 0);
const actaNumeroTirada = () => Math.max(ACTA.base.a.length, ACTA.base.b.length) + ACTA.tiradas.length + 1;

function actaDetener(){
  clearTimeout(ACTA.timer); clearInterval(ACTA.reloxo);
  ACTA.timer = null; ACTA.reloxo = null;
}

function actaReiniciar(){
  actaDetener();
  ACTA.base = { a: [], b: [], ch: { a1: [], a2: [], b1: [], b2: [] } };
  ACTA.tiradas = [];
  ACTA.actual = actaTiradaNova();
  ACTA.cerrando = false;
  ACTA.desaxuste = false;
  actaPintarTirada();
}
actaReiniciar();

// Fixa as tiradas tal cal (retomadas ou editadas): substitúe todo o rexistro.
// pa/pb: [n, ...] · ch: { a1: [{n, t, r}], ... }
function actaFixar(pa, pb, ch){
  actaReiniciar();
  ACTA.base = { a: pa.slice(), b: pb.slice(), ch: { a1: [], a2: [], b1: [], b2: [], ...Object.fromEntries(Object.entries(ch || {}).map(([k, v]) => [k, v.map(e => ({ ...e }))])) } };
  actaPintarTirada();
}

// ---- Botóns permitidos segundo o estado da tirada aberta (só con partida real cargada) ----
// Un botón actívase se, despois de premelo, a tirada aínda pode acabar nunha combinación válida
// (actaEvaluarTirada ≠ 'invalida'). Exemplos: tras +1 do local quedan bloqueados todos os + do local e todos os
// + e − do visitante (e os − do local salvo o −1), pero as chaves seguen para poder matar chaves; tras 9 puntos e
// 1 chave do que puntúa, bloqúeanse as chaves do outro equipo; tras +1 chave bloquéase o +2 do mesmo xogador.
// Todo se volve habilitar cando a tirada queda baleira (nova tirada ou corrixida ao momento).
// ---- Emparellamento dos xogadores, deducido do que xa pasou ----
// Cada equipo ten 2 xogadores e en cada tirada só lanza un por equipo; os xogadores xógase sempre contra o mesmo
// contrario (pode ser A1-B1/A2-B2 ou A1-B2/A2-B1: non se asume) e as tiradas ALTERNAN as dúas parellas: a parella
// que xoga nas tiradas impares non xoga nas pares. Así, o que deu chave na tirada t xoga nas tiradas coa
// mesma paridade que t; o seu compañeiro, nas da outra; e dous xogadores de equipos distintos con chaves en tiradas
// da mesma paridade (ou na mesma tirada, p. ex. chaves matadas) enfróntanse entre si.
// Devolve a paridade (0/1) da parella de cada xogador, ou null se aínda non se sabe.
function actaConocimiento(){
  const obs = { a1: new Set(), a2: new Set(), b1: new Set(), b2: new Set() };
  Object.keys(obs).forEach(k => ACTA.base.ch[k].forEach(e => { if (e.t != null) obs[k].add(e.t % 2); }));
  const desde = Math.max(ACTA.base.a.length, ACTA.base.b.length);
  ACTA.tiradas.forEach((td, i) => Object.keys(obs).forEach(k => { if (td.ch[k] > 0) obs[k].add((desde + i + 1) % 2); }));
  const cl = { a1: null, a2: null, b1: null, b2: null };
  for (const k of Object.keys(obs)) {
    if (obs[k].size > 1) return { a1: null, a2: null, b1: null, b2: null };   // incoherente: non se deduce nada
    if (obs[k].size === 1) cl[k] = [...obs[k]][0];
  }
  ['a', 'b'].forEach(eq => {                                               // o compañeiro xoga nas tiradas da outra paridade
    if (cl[eq + '1'] != null && cl[eq + '2'] == null) cl[eq + '2'] = 1 - cl[eq + '1'];
    if (cl[eq + '2'] != null && cl[eq + '1'] == null) cl[eq + '1'] = 1 - cl[eq + '2'];
  });
  return cl;
}

// Xogadores de cada equipo que poden participar na tirada aberta: {a: [1], b: [1, 2]}
//  · se un xogador xa deu chave nesta tirada, só el (o seu compañeiro non participa);
//  · se non, e se se sabe a paridade da súa parella, só o que xoga nesta tirada;
//  · se aínda non se sabe, os dous.
function actaParticipantes(td){
  const cl = actaConocimiento(), par = actaNumeroTirada() % 2;
  const S = { a: [1, 2], b: [1, 2] };
  ['a', 'b'].forEach(eq => {
    const con = [1, 2].filter(i => td.ch[eq + i] > 0);
    if (con.length === 1) S[eq] = con;
    else if (con.length === 0) {
      const dePar = [1, 2].filter(i => cl[eq + i] === par);
      if (dePar.length === 1) S[eq] = dePar;
    }
  });
  return S;
}

const ACTA_VALORES = [1, 2, 8, 9, 16];
function actaBotonsPermitidos(td){
  const vacia = actaVacia(td);
  const posible = mod => { const t2 = { pa: td.pa, pb: td.pb, ch: { ...td.ch } }; mod(t2); return actaEvaluarTirada(t2).cls !== 'invalida'; };
  const out = { puntos: { a: {}, b: {} }, chaves: {} };
  ['a', 'b'].forEach(eq => {
    const campo = eq === 'a' ? 'pa' : 'pb', outro = eq === 'a' ? 'pb' : 'pa';
    ACTA_VALORES.forEach(v => {
      out.puntos[eq][v] = td[campo] === 0 && td[outro] === 0 && posible(t2 => { t2[campo] += v; });
      out.puntos[eq][-v] = vacia ? true : (td[campo] > 0 && (v === td[campo] || !ACTA_VALORES.includes(td[campo])));
    });
  });
  Object.keys(td.ch).forEach(k => {
    out.chaves[k] = { 1: posible(t2 => { t2.ch[k] += 1; }), 2: posible(t2 => { t2.ch[k] += 2; }), '-1': vacia || td.ch[k] > 0 };
  });
  // Participantes na tirada (ver actaParticipantes): as chaves dos que non participan quedan bloqueadas
  const S = actaParticipantes(td);
  Object.keys(td.ch).forEach(k => {
    if (!S[k[0]].includes(Number(k[1]))) { out.chaves[k][1] = false; out.chaves[k][2] = false; }
  });
  return out;
}

function actaActualizarBotones(){
  if (typeof document === 'undefined' || !document.querySelectorAll) return;
  const todos = document.querySelectorAll('#vista-marcador [data-add], #vista-marcador .mk-chb');
  if (!ACTA.activa) { todos.forEach(b => { b.disabled = false; }); return; }
  const p = actaBotonsPermitidos(ACTA.actual);
  ['a', 'b'].forEach(eq => {
    document.querySelectorAll(`#mk-${eq} [data-add]`).forEach(b => { b.disabled = !p.puntos[eq][Number(b.dataset.add)]; });
    [...document.querySelectorAll(`#mk-${eq} .marcador-xog`)].forEach((fila, i) => {
      const k = eq + (i + 1);
      fila.querySelectorAll('.mk-chb').forEach(b => { b.disabled = !p.chaves[k][b.dataset.chaves]; });
    });
  });
}

// Barra «Tirada N · pecha en X s» (só visible coa acta activa)
function actaPintarTirada(){
  actaActualizarBotones();
  const barra = document.getElementById('mk-tirada'), txt = document.getElementById('mk-tirada-txt');
  if (!barra || !txt) return;
  barra.hidden = !ACTA.activa;
  if (!ACTA.activa) return;
  const n = actaNumeroTirada();
  if (actaVacia(ACTA.actual)) { txt.textContent = `Tirada ${n} · sen anotacións`; return; }
  const seg = Math.max(0, Math.ceil((ACTA.fin - Date.now()) / 1000));
  txt.textContent = `Tirada ${n} · pecha en ${seg} s`;
}

// Cada anotación reinicia o reloxo da tirada aberta
function actaMarcar(){
  clearTimeout(ACTA.timer); clearInterval(ACTA.reloxo);
  if (actaVacia(ACTA.actual)) { ACTA.timer = null; ACTA.reloxo = null; actaPintarTirada(); return; }
  ACTA.fin = Date.now() + ACTA_SEGUNDOS * 1000;
  ACTA.timer = setTimeout(() => { actaCerrarTirada(); }, ACTA_SEGUNDOS * 1000);
  ACTA.reloxo = setInterval(actaPintarTirada, 250);
  actaPintarTirada();
}

function actaPuntoPulsado(eq, n){        // n > 0
  ACTA.actual[eq === 'a' ? 'pa' : 'pb'] += n;
  actaMarcar();
}
function actaChavePulsada(clave, n){     // +1 ou +2 chaves dun xogador (a1, a2, b1, b2)
  ACTA.actual.ch[clave] += n || 1;
  actaMarcar();
}

// Se a tirada aberta está baleira, reabre a anterior (para corrixila) e devólvea como tirada aberta
function actaReabrirAnterior(){
  if (!actaVacia(ACTA.actual) || !ACTA.tiradas.length) return false;
  ACTA.actual = ACTA.tiradas.pop();
  return true;
}

function actaPuntos(eq, n){              // n < 0: resta (desfai)
  const v = -n, campo = eq === 'a' ? 'pa' : 'pb';
  if (ACTA.actual[campo] < v) actaReabrirAnterior();
  if (ACTA.actual[campo] >= v) { ACTA.actual[campo] -= v; actaMarcar(); return; }
  const arr = ACTA.base[eq];             // tiradas xa escritas (retomadas ou editadas)
  const i = arr.lastIndexOf(v);
  if (i >= 0) { arr.splice(i, 1); ACTA.base[eq === 'a' ? 'b' : 'a'].splice(i, 1); actaPintarTirada(); return; }
  ACTA.desaxuste = true;                 // non hai nada que desfacer: as tiradas non cadrarán cos puntos
}

function actaChaves(clave, delta){       // delta -1: quita unha chave do xogador
  if (ACTA.actual.ch[clave] < 1) actaReabrirAnterior();
  if (ACTA.actual.ch[clave] >= 1) { ACTA.actual.ch[clave]--; actaMarcar(); return; }
  const arr = ACTA.base.ch[clave];
  if (!arr.length) { ACTA.desaxuste = true; return; }
  arr[arr.length - 1].n -= 1;
  if (arr[arr.length - 1].n <= 0) arr.pop();
}

// Describe en breve que falla nunha tirada (só o erro)
function actaMotivo(ev){
  if (ev.problemas.length) return ev.problemas.join(', ');
  const cS = ev.S === 'a' ? ev.cA : ev.cB;
  if (ev.n === 0) return `hai chaves (${ev.cA}-${ev.cB}) pero ningún punto`;
  if (ev.n === 8 || ev.n === 9) return cS < 1 ? `${ev.n} puntos sen ningunha chave do equipo que puntúa` : `chaves ${ev.cA}-${ev.cB} con ${ev.n} puntos`;
  if (ev.n === 16) return cS < 2 ? `16 puntos con só ${cS} chave${cS === 1 ? '' : 's'} do equipo que puntúa` : `chaves ${ev.cA}-${ev.cB} con 16 puntos`;
  if (ev.n === 1 || ev.n === 2) return `chaves ${ev.cA}-${ev.cB} con ${ev.n} punto${ev.n === 1 ? '' : 's'}`;
  return `${ev.n} puntos non é unha puntuación posible`;
}

// Avalía unha tirada: { cls: 'normal'|'matadas'|'incompleta'|'invalida', n, S, cA, cB, problemas }
function actaEvaluarTirada(td){
  const cA = td.ch.a1 + td.ch.a2, cB = td.ch.b1 + td.ch.b2;
  const problemas = [];
  if (td.pa > 0 && td.pb > 0) problemas.push('puntúan os dous equipos na mesma tirada');
  const n = Math.max(td.pa, td.pb), S = td.pa >= td.pb ? 'a' : 'b';
  let cls = n === 0 ? actaClasificar(0, cA, cB) : (S === 'a' ? actaClasificar(n, cA, cB) : actaClasificar(n, cB, cA));
  if (problemas.length) cls = 'invalida';
  return { cls, n, S, cA, cB, problemas };
}

// Pecha a tirada aberta. Devolve true se queda pechada (ou non había nada) e false se hai que corrixila.
async function actaCerrarTirada(){
  if (ACTA.cerrando) return false;
  actaDetener();
  const td = ACTA.actual;
  if (actaVacia(td)) { actaPintarTirada(); return true; }
  ACTA.cerrando = true;
  try {
    const ev = actaEvaluarTirada(td), num = actaNumeroTirada();
    if (ev.cls !== 'normal') {
      const pl = n => `${n} punto${n === 1 ? '' : 's'}`;
      const nome = td.pa > 0 && td.pb > 0 ? `${pl(td.pa)} do local e ${pl(td.pb)} do visitante`
        : ev.n ? `${pl(ev.n)} para o ${ev.S === 'a' ? 'local' : 'visitante'}` : '0 puntos';
      let op;
      if (ev.cls === 'matadas') {
        op = await actaOpciones('Chaves matadas',
          `Tirada ${num}: ${nome} e chaves ${ev.cA}-${ev.cB} (local-visitante). As chaves anúlanse e saen en vermello na acta. É correcto?`,
          ['Correcto, seguinte tirada', 'Corrixir']);
        op = op === 0 ? 1 : 0;           // 1 = dar por boa
      } else {
        op = await actaOpciones('A tirada non cadra',
          `Tirada ${num}: ${nome} e chaves ${ev.cA}-${ev.cB} (local-visitante). Erro: ${actaMotivo(ev)}.`,
          ['Corrixir', 'Correcto, seguinte tirada']);
      }
      if (op !== 1) { actaMarcar(); return false; }       // corrixir: a tirada segue aberta e volve a correr o tempo
    }
    ACTA.tiradas.push(td);
    ACTA.actual = actaTiradaNova();
    return true;
  } finally {
    ACTA.cerrando = false;
    actaPintarTirada();
  }
}

// Deduce as secuencias finais: { puntos: {a: [...], b: [...]}, chaves: {a1: [{n, t, r}], ...} }
// Inclúe a tirada aberta. Chaves anuladas: nunha tirada con chaves dos dous equipos, min(chaves local, chaves
// visitante) de cada un son anuladas (r: true) e as demais normais.
function actaDerivar(){
  const pa = ACTA.base.a.slice(), pb = ACTA.base.b.slice();
  const ch = {};
  Object.keys(ACTA.base.ch).forEach(k => { ch[k] = ACTA.base.ch[k].map(e => ({ ...e })); });
  let tir = Math.max(pa.length, pb.length);
  const todas = actaVacia(ACTA.actual) ? ACTA.tiradas : [...ACTA.tiradas, ACTA.actual];
  todas.forEach(td => {
    tir++;
    pa.push(td.pa); pb.push(td.pb);
    const red = Math.min(td.ch.a1 + td.ch.a2, td.ch.b1 + td.ch.b2);
    ['a', 'b'].forEach(eq => {
      let resto = red;
      [eq + '1', eq + '2'].forEach(k => {
        const n = td.ch[k]; if (!n) return;
        const r = Math.min(n, resto); resto -= r;
        if (r > 0) ch[k].push({ n: r, t: tir, r: true });
        if (n - r > 0) ch[k].push({ n: n - r, t: tir, r: false });
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
    marcador.textContent = clamp0((Number(marcador.textContent) || 0) + delta);
    const k = ACTA.activa ? claveEquipo(equipo) : null;
    if (k) { if (delta > 0) actaPuntoPulsado(k, delta); else actaPuntos(k, delta); }
    actualizarLideres();
    return;
  }

  // Botóns +1/-1 das chaves de cada xogador/a
  const botonChave = e.target.closest('#vista-marcador .mk-chb');
  if (botonChave) {
    const fila = botonChave.closest('.marcador-xog');
    const contador = fila.querySelector('.marcador-chaves');
    const delta = Number(botonChave.dataset.chaves);
    contador.textContent = clamp0((Number(contador.textContent) || 0) + delta);
    const k = ACTA.activa ? claveXogador(fila) : null;
    if (k) { if (delta > 0) actaChavePulsada(k, delta); else actaChaves(k, delta); }
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
