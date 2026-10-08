// Resultados pendientes: lo que llega desde el Marcador público (sin iniciar sesión)
// se guarda en "resultados_pendientes" a la espera de que alguien con permiso lo revise.
// Editar corrige el marcador o las chaves antes de validar; validar copia los datos a las
// tablas definitivas y recalcula el resultado del partido; descartar borra el pendiente
// sin aplicarlo.

let pendientesData = [];
let editandoPendienteId = null;

async function vistaPendientes(){
  $('#main').innerHTML = 'Cargando…';
  const { data, error } = await sb.from('resultados_pendientes').select('*').order('enviado_en', { ascending: true });
  if (error) { $('#main').innerHTML = `<p class="mut">Error: ${esc(error.message)}</p>`; return; }
  editandoPendienteId = null;
  pintarPendientes(data || []);
}

// Título en una sola línea: "Liga Masculina - Jornada 3 - Equipo A vs Equipo B - Partida 2".
// Un bando sin club se nombra con los nombres de pila de la pareja de esa partida (Laura&Carlota).
function contextoPendiente(idEnfrentamiento){
  const e = D.enfrentamientos.find(x => x.id === idEnfrentamiento);
  if (!e) return { titulo: `Partida #${idEnfrentamiento} (ya no existe)`, eps: [] };
  const eps = D.enfrentamiento_parejas.filter(x => x.id_enfrentamiento === idEnfrentamiento);
  const p = D.partidos.find(x => x.id === e.id_partido);
  if (!p) return { titulo: `Partida ${e.numero}`, idPartido: e.id_partido, eps };

  const jornada = D.jornadas.find(j => j.id === p.id_jornada);
  const liga = jornada && D.ligas.find(l => l.id === jornada.id_liga);
  const categoria = liga && D.categorias.find(c => c.id === liga.id_categoria);
  const nomeLiga = categoria?.nombre === 'femenina' ? 'Liga Femenina'
    : categoria?.nombre === 'masculina' ? 'Liga Masculina' : 'Liga';

  const primerNombre = id => (D.jugadores.find(j => j.id === id)?.nombre || '').split(' ')[0];
  const nomeBando = (idClub, lado) => {
    if (idClub) return lab('clubs', idClub);
    const ep = eps.find(x => x.lado === lado);
    const pa = ep && D.parejas.find(x => x.id === ep.id_pareja);
    return pa ? `${primerNombre(pa.id_jugador_a)}&${primerNombre(pa.id_jugador_b)}` : 'Sin equipo';
  };

  const titulo = `${nomeLiga} - Jornada ${jornada?.numero ?? '?'} - ` +
    `${nomeBando(p.id_club_local, 'local')} vs ${nomeBando(p.id_club_visitante, 'visitante')} - Partida ${e.numero}`;
  return { titulo, idPartido: e.id_partido, eps };
}

// Un partido se puede finalizar cuando TODAS sus partidas tienen resultado: ya guardado
// en las tablas definitivas o pendiente de validar. Si aún falta alguna, no hay botón.
function partidoListoParaFinalizar(idPartido){
  const p = D.partidos.find(x => x.id === idPartido);
  if (!p || p.estado === 'finalizado') return false;
  const partidas = D.enfrentamientos.filter(e => e.id_partido === idPartido);
  if (!partidas.length) return false;
  return partidas.every(e =>
    (e.marcador_local != null && e.marcador_visitante != null) ||
    pendientesData.some(f => f.id_enfrentamiento === e.id));
}

// El botón "Finalizar partido" solo sale en la tarjeta del último resultado pendiente
// de ese partido EN LLEGAR (el de enviado_en más reciente), no en la de mayor número de partida.
function esUltimoPendienteDelPartido(f, idPartido){
  const delPartido = pendientesData.filter(x => {
    const e = D.enfrentamientos.find(y => y.id === x.id_enfrentamiento);
    return e && e.id_partido === idPartido;
  });
  if (!delPartido.length) return false;
  const ultimo = delPartido.reduce((a, b) => {
    const ta = new Date(a.enviado_en).getTime(), tb = new Date(b.enviado_en).getTime();
    return tb > ta || (tb === ta && b.id > a.id) ? b : a;
  });
  return ultimo.id === f.id;
}

function nomeParejaPendiente(idPareja){
  const pa = D.parejas.find(x => x.id === idPareja);
  if (!pa) return '—';
  return `${lab('jugadores', pa.id_jugador_a)} / ${lab('jugadores', pa.id_jugador_b)}`;
}

function tarjetaPendiente(f){
  const ctx = contextoPendiente(f.id_enfrentamiento);
  const parLocal = ctx.eps.filter(x => x.lado === 'local').map(x => nomeParejaPendiente(x.id_pareja)).join(' · ') || '—';
  const parVisit = ctx.eps.filter(x => x.lado === 'visitante').map(x => nomeParejaPendiente(x.id_pareja)).join(' · ') || '—';

  if (editandoPendienteId === f.id) {
    const camposChaves = (f.chaves || []).map(c =>
      `<label>${esc(lab('jugadores', c.id_jugador))} · chaves<input type="number" min="0" id="pend-ch-${f.id}-${c.id_jugador}" value="${esc(c.chaves)}"></label>`
    ).join('');
    return `<div class="card">
      <h3>${esc(ctx.titulo)}</h3>
      <p class="mut">${esc(parLocal)} vs ${esc(parVisit)}</p>
      <label>Marcador local<input type="number" min="0" id="pend-ml-${f.id}" value="${esc(f.marcador_local)}"></label>
      <label>Marcador visitante<input type="number" min="0" id="pend-mv-${f.id}" value="${esc(f.marcador_visitante)}"></label>
      ${camposChaves}
      <p class="mut" id="pend-err-${f.id}"></p>
      <div class="acc">
        <button class="pri" onclick="guardarEdicionPendiente(${f.id})">Guardar cambios</button>
        <button onclick="cancelarEdicionPendiente()">Cancelar</button>
      </div>
    </div>`;
  }

  const filasChaves = (f.chaves || [])
    .map(c => `<tr><td>${esc(lab('jugadores', c.id_jugador))}</td><td>${esc(c.chaves)}</td></tr>`).join('');
  return `<div class="card">
    <p class="mut">Enviado: ${esc(new Date(f.enviado_en).toLocaleString('es-ES'))}</p>
    <h3>${esc(ctx.titulo)}</h3>
    <p>${esc(parLocal)} &nbsp;<b>${esc(f.marcador_local)} - ${esc(f.marcador_visitante)}</b>&nbsp; ${esc(parVisit)}</p>
    ${filasChaves ? `<table><thead><tr><th>Jugador/a</th><th>Chaves</th></tr></thead><tbody>${filasChaves}</tbody></table>` : ''}
    <div class="acc">
      <button class="pri" onclick="validarPendiente(${f.id})">Validar</button>
      <button onclick="editarPendiente(${f.id})">Editar</button>
      <button class="del" onclick="descartarPendiente(${f.id})">Descartar</button>
      ${ctx.idPartido != null && partidoListoParaFinalizar(ctx.idPartido) && esUltimoPendienteDelPartido(f, ctx.idPartido)
        ? `<button class="pri" onclick="finalizarPartidoPendiente(${ctx.idPartido})">Finalizar partido</button>` : ''}
    </div>
  </div>`;
}

function pintarPendientes(filas){
  pendientesData = filas;
  if (!filas.length) {
    $('#main').innerHTML = `<h2>Resultados pendientes</h2><p class="mut">No hay resultados pendientes de validar.</p>`;
    return;
  }
  $('#main').innerHTML = `<h2>Resultados pendientes (${filas.length})</h2>` + filas.map(tarjetaPendiente).join('');
}

function editarPendiente(id){ editandoPendienteId = id; pintarPendientes(pendientesData); }
function cancelarEdicionPendiente(){ editandoPendienteId = null; pintarPendientes(pendientesData); }

async function guardarEdicionPendiente(id){
  const f = pendientesData.find(x => x.id === id);
  if (!f) return;
  const ml = Number($('#pend-ml-' + id).value);
  const mv = Number($('#pend-mv-' + id).value);
  const chaves = (f.chaves || []).map(c => ({
    id_jugador: c.id_jugador,
    chaves: Number($(`#pend-ch-${id}-${c.id_jugador}`).value) || 0,
  }));
  const { error } = await sb.from('resultados_pendientes')
    .update({ marcador_local: ml, marcador_visitante: mv, chaves })
    .eq('id', id);
  if (error) {
    const err = document.getElementById('pend-err-' + id);
    if (err) err.textContent = 'Error: ' + error.message;
    return;
  }
  await vistaPendientes();
}

// Recalcula el resultado (partidas ganadas por cada bando) de un partido a partir
// de los marcadores de sus enfrentamientos, igual que hace el panel al anotar a mano.
async function recalcularResultadoPartido(idPartido){
  const { data: enfs, error } = await sb.from('enfrentamientos').select('*').eq('id_partido', idPartido);
  if (error || !enfs) return;
  const jugadas = enfs.filter(e => e.marcador_local != null && e.marcador_visitante != null);
  if (!jugadas.length) return;
  const rl = jugadas.filter(e => e.marcador_local > e.marcador_visitante).length;
  const rv = jugadas.filter(e => e.marcador_visitante > e.marcador_local).length;
  await sb.from('partidos').update({ resultado_local: rl, resultado_visitante: rv }).eq('id', idPartido);
}

// Copia un resultado pendiente a las tablas definitivas, recalcula el resultado del partido
// y lo quita de pendientes. Devuelve un texto de error, o null si todo fue bien.
async function aplicarPendiente(id){
  const { data: pend, error: e0 } = await sb.from('resultados_pendientes').select('*').eq('id', id).single();
  if (e0) return 'Error: ' + e0.message;

  const { error: e1 } = await sb.from('enfrentamientos')
    .update({ marcador_local: pend.marcador_local, marcador_visitante: pend.marcador_visitante })
    .eq('id', pend.id_enfrentamiento);
  if (e1) return 'Error al guardar el marcador: ' + e1.message;

  for (const c of (pend.chaves || [])) {
    const { error: e2 } = await sb.from('chaves_enfrentamiento')
      .upsert({ id_enfrentamiento: pend.id_enfrentamiento, id_jugador: c.id_jugador, chaves: c.chaves },
        { onConflict: 'id_enfrentamiento,id_jugador' });
    if (e2) return 'Error al guardar las chaves: ' + e2.message;
  }

  const enf = D.enfrentamientos.find(x => x.id === pend.id_enfrentamiento);
  if (enf) await recalcularResultadoPartido(enf.id_partido);

  const { error: e3 } = await sb.from('resultados_pendientes').delete().eq('id', id);
  if (e3) return 'Se validó, pero no se pudo quitar de pendientes: ' + e3.message;
  return null;
}

const recargarTrasValidar = () =>
  Promise.all([loadTable('enfrentamientos'), loadTable('chaves_enfrentamiento'), loadTable('partidos')]);

async function validarPendiente(id){
  if (!confirm('¿Validar este resultado y copiarlo a las tablas definitivas?')) return;
  msg('');
  const err = await aplicarPendiente(id);
  if (err) return msg(err);
  await recargarTrasValidar();
  vistaPendientes();
}

// Valida todos los resultados pendientes de ese partido y lo marca como finalizado.
async function finalizarPartidoPendiente(idPartido){
  const delPartido = pendientesData.filter(f => {
    const e = D.enfrentamientos.find(x => x.id === f.id_enfrentamiento);
    return e && e.id_partido === idPartido;
  });
  const aviso = delPartido.length === 1
    ? 'Se validará el resultado pendiente de este partido'
    : `Se validarán los ${delPartido.length} resultados pendientes de este partido`;
  if (!confirm(`${aviso} y el partido quedará marcado como finalizado. ¿Continuar?`)) return;

  msg('');
  for (const f of delPartido) {
    const err = await aplicarPendiente(f.id);
    if (err) return msg(err);
  }
  const { error } = await sb.from('partidos').update({ estado: 'finalizado' }).eq('id', idPartido);
  if (error) return msg('Se validaron los resultados, pero no se pudo finalizar el partido: ' + error.message);

  await recargarTrasValidar();
  vistaPendientes();
}

async function descartarPendiente(id){
  if (!confirm('¿Descartar este resultado sin aplicarlo? No se puede deshacer.')) return;
  const { error } = await sb.from('resultados_pendientes').delete().eq('id', id);
  if (error) return msg('Error: ' + error.message);
  vistaPendientes();
}
