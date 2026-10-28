// Marcador: ferramenta de anotación en directo. Todo vive en memoria (non usa Supabase),
// así que ao recargar a páxina os marcadores volven ao seu valor inicial.
// Destaca en verde o equipo con máis puntos e o xogador con máis chaves,
// sempre entre os visibles, sen empate e con valor > 0.

const clamp0 = n => (n < 0 ? 0 : n);

// ---------- Rexistro das tiradas para a acta ----------
// Só actúa cando hai unha partida real cargada (ACTA.activa) e só nos equipos A e B.
// Unha TIRADA péchase soa cando pasan ACTA_SEGUNDOS segundos sen anotar nada (ou co botón «Seguinte tirada»).
// MARCADOR SIMPLIFICADO: os botóns de puntos son só +1, +2, −1 e −2 (puntos «a man», ma/mb). Os 8, 9 e 16 non se
// pulsan: saen das chaves. Cada chave dá 8 puntos ao seu equipo (2 chaves = 16) e as chaves do outro equipo na mesma
// tirada anúlanas: puntos de chaves = 8 · max(0, chaves propias − chaves do rival). Exemplos: A 1 chave → A +8;
// B tamén 1 → A −8 (quedan 0); A 2 e B 1 → A 8; A 2 e B 2 → 0. Os puntos finais da tirada son pa = ma + chaves, pb = mb + chaves.
// Dentro dunha tirada anótase en calquera orde. Ao pecharse avalíase:
//  · en cada tirada só puntúa un equipo e cada equipo lanza un xogador con 2 pesos;
//  · combinacións posibles (puntos · chaves do que puntúa-do outro): 1 ou 2 · 0-0 · 8 ou 9 · 1-0 · 16 · 2-0 ·
//    e, con chaves matadas (as chaves dos dous bandos anúlanse na mesma tirada): 1·1-1, 8·2-1 e 0·2-2;
//  · se é normal, pasa á seguinte tirada sen preguntar; se hai chaves matadas ou algo non cadra, avisa e permite
//    corrixir (a tirada segue aberta) ou dala por boa e pasar á seguinte.
// As chaves matadas contan para o total de cada xogador e saen en VERMELLO na acta (a parte anulada).
// «−n» quita puntos a man / «−1» quita unha chave da tirada aberta.
const ACTA_SEGUNDOS = 10;
const ACTA = { activa: false, base: null, tiradas: [], actual: null, timer: null, reloxo: null, cerrando: false, desaxuste: false, fin: 0, volvioAtras: false };

// ma/mb: puntos a man (1 ou 2) · pa/pb: puntos totais da tirada (a man + chaves), sempre calculados con actaSync
const actaTiradaNova = () => ({ ma: 0, mb: 0, pa: 0, pb: 0, ch: { a1: 0, a2: 0, b1: 0, b2: 0 } });
const actaVacia = td => !td || (td.pa === 0 && td.pb === 0 && td.ch.a1 + td.ch.a2 + td.ch.b1 + td.ch.b2 === 0);
const actaNumeroTirada = () => Math.max(ACTA.base.a.length, ACTA.base.b.length) + ACTA.tiradas.length + 1;

// Recalcula os puntos totais dunha tirada: puntos a man + 8 por cada chave que non anula o rival
function actaSync(td){
  const cA = td.ch.a1 + td.ch.a2, cB = td.ch.b1 + td.ch.b2;
  td.pa = (td.ma || 0) + 8 * Math.max(0, cA - cB);
  td.pb = (td.mb || 0) + 8 * Math.max(0, cB - cA);
  return td;
}

// Puntos totais de cada equipo segundo o rexistro (tiradas xa escritas + pechadas + aberta)
function actaTotales(){
  const suma = arr => arr.reduce((s, v) => s + v, 0);
  const pechadas = ACTA.tiradas.concat([ACTA.actual]);
  return {
    a: suma(ACTA.base.a) + suma(pechadas.map(t => t.pa)),
    b: suma(ACTA.base.b) + suma(pechadas.map(t => t.pb)),
  };
}
// Aplica aos marcadores da pantalla o que cambiou desde «antes» (soamente en directo)
function actaAplicarTotales(antes){
  const agora = actaTotales();
  [['a', agora.a - antes.a], ['b', agora.b - antes.b]].forEach(([k, d]) => {
    const el = document.querySelector(`#mk-${k} .marcador-puntos`);
    if (el && d) el.textContent = clamp0((Number(el.textContent) || 0) + d);
  });
}

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
  ACTA.volvioAtras = false;
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
// (actaEvaluarTirada ≠ 'invalida'). Só hai botóns de puntos +1/+2/−1/−2; as chaves suman os 8/16 soas.
// Exemplos: tras 1 chave dun equipo o +1 segue aberto (9 = chave + 1) pero o +2 péchase (10 non existe); se o rival
// tamén dá chave na mesma tirada (chaves matadas) o +2 péchase e o +1 segue; con 2 chaves non cabe ningún punto máis.
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

// Última tirada ya pechada (a única que se pode corrixir co «−» cando a tirada aberta está baleira)
function actaTiradaAnterior(){
  if (ACTA.tiradas.length) return ACTA.tiradas[ACTA.tiradas.length - 1];
  const n = Math.max(ACTA.base.a.length, ACTA.base.b.length);      // tiradas xa escritas (retomadas ou editadas)
  if (!n) return null;
  const ch = {};
  Object.keys(ACTA.base.ch).forEach(k => { ch[k] = ACTA.base.ch[k].filter(e => e.t === n).reduce((s, e) => s + e.n, 0); });
  return { pa: ACTA.base.a[n - 1] || 0, pb: ACTA.base.b[n - 1] || 0, ch };
}

function actaBotonsPermitidos(td){
  const posible = mod => {
    const t2 = { ma: td.ma, mb: td.mb, pa: 0, pb: 0, ch: { ...td.ch } };
    mod(t2); actaSync(t2);
    return actaEvaluarTirada(t2).cls !== 'invalida';
  };
  const out = { puntos: { a: {}, b: {} }, chaves: {} };
  ['a', 'b'].forEach(eq => {
    const campo = eq === 'a' ? 'ma' : 'mb';
    [1, 2, 8, 9, 16].forEach(v => { out.puntos[eq][v] = false; out.puntos[eq][-v] = false; });   // 8, 9 e 16 non se pulsan (ocúltanse)
    [1, 2].forEach(v => {
      out.puntos[eq][v] = td.ma === 0 && td.mb === 0 && posible(t2 => { t2[campo] += v; });      // só un equipo puntúa a man por tirada
      out.puntos[eq][-v] = td[campo] >= v;                                                         // «−» só corrixe o anotado a man na tirada aberta
    });
  });
  Object.keys(td.ch).forEach(k => {
    out.chaves[k] = { 1: posible(t2 => { t2.ch[k] += 1; }), 2: posible(t2 => { t2.ch[k] += 2; }), '-1': td.ch[k] > 0 };      // «−1» só se ese xogador deu chave nesta tirada
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
  const ant = document.getElementById('mk-tirada-anterior');
  if (ant) ant.disabled = ACTA.volvioAtras || !actaTiradaAnterior();   // só se pode volver unha tirada atrás
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

function actaPuntoPulsado(eq, n){        // n > 0: +1 ou +2 a man
  ACTA.actual[eq === 'a' ? 'ma' : 'mb'] += n;
  actaSync(ACTA.actual);
  actaMarcar();
}
function actaChavePulsada(clave, n){     // +1 ou +2 chaves dun xogador (a1, a2, b1, b2): suman/restan os 8 ou 16 soas
  ACTA.actual.ch[clave] += n || 1;
  actaSync(ACTA.actual);
  actaMarcar();
}

function actaPuntos(eq, n){              // n < 0: resta puntos a man da tirada ABERTA (a anterior corríxese con «Tirada anterior»)
  const v = -n, campo = eq === 'a' ? 'ma' : 'mb';
  if (ACTA.actual[campo] >= v) { ACTA.actual[campo] -= v; actaSync(ACTA.actual); actaMarcar(); return; }
  ACTA.desaxuste = true;                 // non hai nada que quitar nesta tirada
}

function actaChaves(clave, delta){       // delta -1: quita unha chave da tirada ABERTA
  if (ACTA.actual.ch[clave] >= 1) { ACTA.actual.ch[clave]--; actaSync(ACTA.actual); actaMarcar(); return; }
  ACTA.desaxuste = true;
}

// «Tirada anterior»: borra TODO o anotado na última tirada pechada (e o que haxa na aberta) para volver anotala
// desde cero, coa mesma lóxica de parellas e botóns (que só depende das tiradas anteriores). Só unha tirada atrás.
// Devolve o que se borrou {pa, pb, ch:{a1..b2}} para restalo dos contadores, ou null se non se pode.
function actaVolverAtras(){
  if (ACTA.volvioAtras || !actaTiradaAnterior()) return null;
  const actual = ACTA.actual;
  let ant;
  if (ACTA.tiradas.length) ant = ACTA.tiradas.pop();
  else {                                  // tiradas xa escritas (retomadas ou editadas): quítase a última
    const n = Math.max(ACTA.base.a.length, ACTA.base.b.length);
    ant = { pa: ACTA.base.a.length === n ? ACTA.base.a.pop() : 0, pb: ACTA.base.b.length === n ? ACTA.base.b.pop() : 0, ch: {} };
    Object.keys(ACTA.base.ch).forEach(k => {
      ant.ch[k] = ACTA.base.ch[k].filter(e => e.t === n).reduce((s, e) => s + e.n, 0);
      ACTA.base.ch[k] = ACTA.base.ch[k].filter(e => e.t !== n);
    });
  }
  const out = { pa: ant.pa + actual.pa, pb: ant.pb + actual.pb, ch: {} };
  Object.keys(actual.ch).forEach(k => { out.ch[k] = (ant.ch[k] || 0) + actual.ch[k]; });
  ACTA.actual = actaTiradaNova();
  ACTA.volvioAtras = true;
  actaDetener();
  actaPintarTirada();
  return out;
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

// Motivo do erro dunha tirada que non cadra (para o aviso)
function actaMotivo(ev){
  if (ev.problemas.length) return ev.problemas.join(', ');
  if (ev.cls === 'incompleta') return 'faltan puntos ou chaves para completar a tirada';
  return 'esa combinación de puntos e chaves non é posible';
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
    ACTA.volvioAtras = false;
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

// ---------- Sonido ao sumar chaves (só en «Anotar partida en directo») ----------
// Cada vez que se preme +1 ou +2 nas chaves dun xogador soa ao chou un dos tres sons de icons/.
const SONS_CHAVE = ['icons/chave.wav', 'icons/chave1.wav', 'icons/chave2.wav'];
let audiosChave = null;
function precargarSonsChave(){
  if (audiosChave) return;
  audiosChave = SONS_CHAVE.map(ruta => { const a = new Audio(ruta); a.preload = 'auto'; return a; });
}
function sonarChave(){
  try {
    precargarSonsChave();
    const a = audiosChave[Math.floor(Math.random() * audiosChave.length)];
    a.currentTime = 0;
    const p = a.play();
    if (p && p.catch) p.catch(() => {});      // sen permiso ou sen arquivo: non pasa nada
  } catch (e) {}
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
    if (k) {
      // En directo, os puntos do marcador deduciraos a tirada (puntos a man + chaves): aplícase só a diferenza
      const antes = actaTotales();
      if (delta > 0) actaPuntoPulsado(k, delta); else actaPuntos(k, delta);
      actaAplicarTotales(antes);
    } else {
      marcador.textContent = clamp0((Number(marcador.textContent) || 0) + delta);
    }
    actualizarLideres();
    if (typeof actaPanelActualizar === 'function') actaPanelActualizar();
    return;
  }

  // Botóns +1/-1 das chaves de cada xogador/a
  const botonChave = e.target.closest('#vista-marcador .mk-chb');
  if (botonChave) {
    const fila = botonChave.closest('.marcador-xog');
    const contador = fila.querySelector('.marcador-chaves');
    const delta = Number(botonChave.dataset.chaves);
    const k = ACTA.activa ? claveXogador(fila) : null;
    const antes = k ? actaTotales() : null;
    contador.textContent = clamp0((Number(contador.textContent) || 0) + delta);
    if (k) {
      if (delta > 0) actaChavePulsada(k, delta); else actaChaves(k, delta);
      if (delta > 0) sonarChave();            // +1 ou +2: soa un dos 3 sons de chave
      actaAplicarTotales(antes);              // as chaves suman (ou restan, se o rival tamén dá chave) os 8/16 puntos
    }
    actualizarLideres();
    if (typeof actaPanelActualizar === 'function') actaPanelActualizar();
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

// ---- Botón «Tirada anterior»: borra a última tirada pechada e déixaa baleira para anotala de novo ----
document.getElementById('mk-tirada-anterior')?.addEventListener('click', async () => {
  if (!ACTA.activa || ACTA.volvioAtras || !actaTiradaAnterior()) return;
  const hai = !actaVacia(ACTA.actual);
  const op = await actaOpciones('Tirada anterior',
    hai ? 'Borrarase todo o anotado na tirada anterior e tamén o da tirada actual, para anotala de novo desde o principio.'
        : 'Borrarase todo o anotado na tirada anterior para anotala de novo desde o principio.',
    ['Borrar e volver anotala', 'Cancelar']);
  if (op !== 0) return;
  const rem = actaVolverAtras();
  if (!rem) return;
  const resta = (el, n) => { if (el) el.textContent = clamp0((Number(el.textContent) || 0) - n); };
  resta(document.querySelector('#mk-a .marcador-puntos'), rem.pa);
  resta(document.querySelector('#mk-b .marcador-puntos'), rem.pb);
  ['a', 'b'].forEach(eq => [...document.querySelectorAll(`#mk-${eq} .marcador-xog`)].forEach((fila, i) => resta(fila.querySelector('.marcador-chaves'), rem.ch[eq + (i + 1)] || 0)));
  actualizarLideres();
  if (typeof actaPanelActualizar === 'function') actaPanelActualizar();
});
