// Pantalla de partido: cada partida enfrenta una pareja local contra una pareja visitante.
// Los desplegables de jugadores se filtran por el club de cada bando (o jugadores sin club).
let pid = null, origen = null;
const TABLAS_PARTIDO = ['enfrentamientos','enfrentamiento_parejas','chaves_enfrentamiento','parejas','jugadores'];

async function abrir(id, desdeJornada){ pid = id; origen = desdeJornada ? 'jornada' : null; await refrescar(); }
function volver(){ origen === 'jornada' ? vistaJornada() : listar(); }
async function refrescar(){ await Promise.all(TABLAS_PARTIDO.map(loadTable)); detalle(); }

const clubDe = l => { const p = D.partidos.find(x => x.id === pid); return l === 'local' ? p.id_club_local : p.id_club_visitante; };
const nombreLado = l => clubDe(l) ? lab('clubs', clubDe(l)) : 'Sin club';

function opciones(l, ph){
  const club = clubDe(l);
  const js = D.jugadores.filter(j => j.activo !== false && (club ? j.id_club === club : !j.id_club))
    .sort((a, b) => lab('jugadores', a.id).localeCompare(lab('jugadores', b.id)));
  return `<option value="">${ph}</option>` + js.map(j => `<option value="${j.id}">${esc(lab('jugadores', j.id))}</option>`).join('');
}
const sel = (id, l, ph) => `<select id="${id}">${opciones(l, ph)}</select>`;
const sinJugadores = l => D.jugadores.some(j => j.activo !== false && (clubDe(l) ? j.id_club === clubDe(l) : !j.id_club))
  ? '' : `<p class="err">No hay jugadores para «${esc(nombreLado(l))}». Añádelos en la sección Jugadores.</p>`;

function parejasLado(l){
  const club = clubDe(l) || null;
  return D.parejas.filter(p => clubPar(p) === club)
    .sort((x, y) => lab('parejas', x.id).localeCompare(lab('parejas', y.id)));
}
// Selector: pareja ya creada del club (o sin club) + opción de formar una nueva con dos jugadores
function selPareja(pre, l){
  return `<label>Pareja ya creada<select id="${pre}_p"><option value="">— elegir —</option>${parejasLado(l).map(p =>
      `<option value="${p.id}">${esc(lab('parejas', p.id))}</option>`).join('')}</select></label>
    <p class="mut">o forma una nueva:</p>
    <div class="add">${sel(pre + '_1', l, 'Jugador 1')}${sel(pre + '_2', l, 'Jugador 2')}</div>`;
}
function leerPareja(pre){
  const idp = +$('#' + pre + '_p').value;
  if (idp) { const p = D.parejas.find(x => x.id === idp); return { id: p.id, a: p.id_jugador_a, b: p.id_jugador_b }; }
  const a = +$('#' + pre + '_1').value, b = +$('#' + pre + '_2').value;
  return a && b && a !== b ? { a, b } : null;
}

function detalle(){
  const p = D.partidos.find(x => x.id === pid);
  const partidas = D.enfrentamientos.filter(e => e.id_partido === pid);
  $('#main').innerHTML = `<button onclick="volver()">← ${origen === 'jornada' ? 'Jornada' : 'Partidos'}</button>
    <div class="bar"><h2>${esc(nombreLado('local'))} vs ${esc(nombreLado('visitante'))}</h2></div>
    <p class="mut">${esc(fmt(p.fecha_hora, 'dt'))} · ${esc(p.estado)}</p>
    <h3 id="resultado">${resultadoTxt(p)}</h3>
    ${partidas.map(partidaHtml).join('')}
    <div class="card"><h3>Nueva partida: pareja contra pareja</h3>
      <b>Local · ${esc(nombreLado('local'))}</b>${sinJugadores('local')}
      ${selPareja('nl', 'local')}
      <hr><b>Visitante · ${esc(nombreLado('visitante'))}</b>${sinJugadores('visitante')}
      ${selPareja('nv', 'visitante')}
      <button class="pri" style="width:100%;margin-top:10px" onclick="crearPartida()">Crear partida</button></div>`;
}

function partidaHtml(e){
  const eps = D.enfrentamiento_parejas.filter(x => x.id_enfrentamiento === e.id);
  const parejaTxt = x => { const pa = D.parejas.find(y => y.id === x.id_pareja); return lab('jugadores', pa.id_jugador_a) + ' + ' + lab('jugadores', pa.id_jugador_b); };
  const nom = l => eps.filter(x => x.lado === l).map(parejaTxt).join(' / ') || '—';
  const lado = l => {
    const ps = eps.filter(x => x.lado === l).map(x => {
      const pa = D.parejas.find(y => y.id === x.id_pareja);
      const js = [pa.id_jugador_a, pa.id_jugador_b].map(j => {
        const c = D.chaves_enfrentamiento.find(z => z.id_enfrentamiento === e.id && z.id_jugador === j);
        return `<label>${esc(lab('jugadores', j))} · chaves<input type="number" inputmode="numeric" min="0" value="${c ? c.chaves : ''}" onchange="setChaves(${e.id},${j},this.value)"></label>`;
      }).join('');
      return `<div class="pareja">${js}<button class="del" onclick="quitarPareja(${x.id})">Quitar pareja</button></div>`;
    }).join('');
    return `<h3>${l === 'local' ? 'Local' : 'Visitante'} · ${esc(nombreLado(l))}</h3>${ps}
      <details><summary>+ Otra pareja de este bando</summary>${selPareja(`x${e.id}${l}`, l)}
      <button style="width:100%" onclick="addPareja(${e.id},'${l}')">Añadir pareja</button></details>`;
  };
  return `<div class="card"><div class="bar"><h2>Partida ${e.numero}</h2><button class="del" onclick="borrarPartida(${e.id})">Borrar partida</button></div>
    <p class="mut">${esc(nom('local'))} <b>vs</b> ${esc(nom('visitante'))}</p>${marcadorHtml(e)}${lado('local')}${lado('visitante')}</div>`;
}

async function parejaDe(a, b){
  if (a > b) { [a, b] = [b, a]; }
  const p = D.parejas.find(x => x.id_jugador_a === a && x.id_jugador_b === b);
  if (p) return p;
  const r = await sb.from('parejas').insert({ id_jugador_a: a, id_jugador_b: b }).select().single();
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

async function crearPartida(){
  const L = leerPareja('nl'), V = leerPareja('nv');
  if (!L || !V) return msg('En cada bando elige una pareja ya creada o forma una nueva con dos jugadores distintos.');
  if (new Set([L.a, L.b, V.a, V.b]).size < 4) return msg('Un jugador no puede aparecer dos veces en la misma partida.');
  let partida = null;
  try {
    const n = Math.max(0, ...D.enfrentamientos.filter(e => e.id_partido === pid).map(e => e.numero)) + 1;
    const r = await sb.from('enfrentamientos').insert({ id_partido: pid, numero: n }).select().single();
    if (r.error) throw new Error(r.error.message);
    partida = r.data;
    for (const [l, x] of [['local', L], ['visitante', V]]) {
      const id = x.id ?? (await parejaDe(x.a, x.b)).id;
      const { error } = await sb.from('enfrentamiento_parejas').insert({ id_enfrentamiento: partida.id, id_pareja: id, lado: l });
      if (error) throw new Error(error.message);
    }
    msg(''); refrescar();
  } catch (e) {
    if (partida) await sb.from('enfrentamientos').delete().eq('id', partida.id);
    msg('Error: ' + e.message);
  }
}

async function borrarPartida(id){
  if (!confirm('¿Borrar la partida con sus parejas y chaves?')) return;
  const { error } = await sb.from('enfrentamientos').delete().eq('id', id);
  if (error) return msg(error.message);
  refrescar();
}
async function addPareja(e, l){
  const x = leerPareja(`x${e}${l}`);
  if (!x) return msg('Elige una pareja ya creada o dos jugadores distintos.');
  try {
    const id = x.id ?? (await parejaDe(x.a, x.b)).id;
    const { error } = await sb.from('enfrentamiento_parejas').insert({ id_enfrentamiento: e, id_pareja: id, lado: l });
    if (error) throw new Error(error.message);
    msg(''); refrescar();
  } catch (err) { msg('Error: ' + err.message); }
}
async function quitarPareja(id){
  if (!confirm('¿Quitar esta pareja de la partida (y sus chaves)?')) return;
  const x = D.enfrentamiento_parejas.find(y => y.id === id), pa = D.parejas.find(y => y.id === x.id_pareja);
  await sb.from('chaves_enfrentamiento').delete().eq('id_enfrentamiento', x.id_enfrentamiento).in('id_jugador', [pa.id_jugador_a, pa.id_jugador_b]);
  const { error } = await sb.from('enfrentamiento_parejas').delete().eq('id', id);
  if (error) return msg(error.message);
  refrescar();
}
async function setChaves(e, j, v){
  const { error } = await sb.from('chaves_enfrentamiento')
    .upsert({ id_enfrentamiento: e, id_jugador: j, chaves: v === '' ? 0 : Number(v) }, { onConflict: 'id_enfrentamiento,id_jugador' });
  if (error) return msg(error.message);
  msg(''); loadTable('chaves_enfrentamiento');
}

// ---------- Marcador de cada partida y resultado final del partido ----------
const resultadoTxt = p => p.resultado_local != null && p.resultado_visitante != null
  ? `Resultado: ${p.resultado_local} - ${p.resultado_visitante}` : 'Resultado: pendiente';

function marcadorHtml(e){
  const v = x => x == null ? '' : x;
  return `<div class="add"><label>Marcador local<input id="ml_${e.id}" type="number" inputmode="numeric" min="0" value="${v(e.marcador_local)}" onchange="guardarMarcador(${e.id})"></label>
    <label>Marcador visitante<input id="mv_${e.id}" type="number" inputmode="numeric" min="0" value="${v(e.marcador_visitante)}" onchange="guardarMarcador(${e.id})"></label></div>`;
}

async function guardarMarcador(id){
  const num = sel => $(sel).value === '' ? null : Number($(sel).value);
  const { error } = await sb.from('enfrentamientos')
    .update({ marcador_local: num('#ml_' + id), marcador_visitante: num('#mv_' + id) }).eq('id', id);
  if (error) return msg(error.message);
  await loadTable('enfrentamientos');
  await recalcularResultado();
}

// El resultado (partidas ganadas por cada bando) se calcula con los marcadores; se puede corregir a mano editando el partido.
async function recalcularResultado(){
  const ps = D.enfrentamientos.filter(e => e.id_partido === pid && e.marcador_local != null && e.marcador_visitante != null);
  if (!ps.length) return;
  const rl = ps.filter(e => e.marcador_local > e.marcador_visitante).length;
  const rv = ps.filter(e => e.marcador_visitante > e.marcador_local).length;
  const { error } = await sb.from('partidos').update({ resultado_local: rl, resultado_visitante: rv }).eq('id', pid);
  if (error) return msg(error.message);
  await loadTable('partidos');
  const el = $('#resultado'); if (el) el.textContent = resultadoTxt(D.partidos.find(x => x.id === pid));
  msg('');
}
