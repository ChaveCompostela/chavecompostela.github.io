// Calendario: partidos de cada jornada (quién juega contra quién). Las partidas se montan después, dentro de cada partido.
let jid = null;

function abrirJornada(id){ jid = id; vistaJornada(); }

function vistaJornada(){
  const j = D.jornadas.find(x => x.id === jid);
  const liga = D.ligas.find(l => l.id === j.id_liga);
  const categoria = D.categorias.find(c => c.id === liga?.id_categoria);
  const nomeLiga = categoria?.nombre === 'femenina' ? 'Liga feminina' : categoria?.nombre === 'masculina' ? 'Liga masculina' : '';
  const ps = D.partidos.filter(p => p.id_jornada === jid)
    .sort((a, b) => (a.fecha_hora || '').localeCompare(b.fecha_hora || ''));
  // Solo se pueden elegir clubs de la categoría (femenina/masculina) de la liga a la que pertenece esta jornada.
  const activos = D.clubs.filter(c => c.activo !== false && c.id_categoria === liga?.id_categoria);
  const usados = new Set(ps.flatMap(p => [p.id_club_local, p.id_club_visitante]).filter(Boolean));
  const libres = activos.filter(c => !usados.has(c.id)).map(c => c.nombre);
  const clubs = '<option value="">Sin club</option>' + activos.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('');
  const insts = '<option value="">—</option>' + D.instalaciones.map(i => `<option value="${i.id}">${esc(i.nombre)}</option>`).join('');
  const club = id => esc(id ? lab('clubs', id) : 'Sin club');
  const filas = ps.map(p => `<tr><td class="ac"><button class="ic pri" onclick="abrir(${p.id}, true)">Partidas</button>
      <button class="ic del" onclick="borrarPartidoJ(${p.id})" aria-label="Borrar">🗑️</button></td>
      <td>${club(p.id_club_local)}</td><td>${club(p.id_club_visitante)}</td>
      <td>${esc(p.sin_hora && p.fecha_hora ? new Date(p.fecha_hora).toLocaleDateString('es-ES') : fmt(p.fecha_hora, 'dt'))}</td><td>${esc(p.id_instalacion ? lab('instalaciones', p.id_instalacion) : '')}</td>
      <td>${p.resultado_local != null && p.resultado_visitante != null ? p.resultado_local + ' - ' + p.resultado_visitante : ''}</td>
      <td>${D.enfrentamientos.filter(e => e.id_partido === p.id).length}</td></tr>`).join('');
  $('#main').innerHTML = `<button onclick="listar()">← Jornadas</button>
    <div class="bar"><h2>${esc(lab('jornadas', jid))}</h2></div>
    <p class="mut">${esc(fmt(j.fecha, 'd'))}${nomeLiga ? ' · ' + esc(nomeLiga) : ''}</p>
    <div class="card"><h3>Añadir partido a la jornada</h3>
      <label>Club local<select id="jl">${clubs}</select></label>
      <label>Club visitante<select id="jv">${clubs}</select></label>
      <label>Sin hora (solo fecha)<input id="jsh" type="checkbox" onchange="sinHoraJ()"></label>
      <label>Fecha y hora (opcional)<input id="jf" type="datetime-local"></label>
      <label>Instalación (opcional)<select id="ji">${insts}</select></label>
      ${!activos.length ? `<p class="mut">No hay clubs con la categoría "${esc(nomeLiga || 'de esta liga')}" asignada. Asígnasela en la sección Clubs.</p>` : ''}
      <button class="pri" style="width:100%" onclick="anadirPartidoJ()">+ Añadir partido</button></div>
    <h3>Partidos de la jornada (${ps.length})</h3>
    <div class="tw"><table><thead><tr><th></th><th>Local</th><th>Visitante</th><th>Fecha</th><th>Instalación</th><th>Resultado</th><th>Partidas</th></tr></thead>
    <tbody>${filas || '<tr><td colspan="7" class="mut">Aún no hay partidos en esta jornada</td></tr>'}</tbody></table></div>
    ${libres.length ? `<p class="mut">Clubs sin partido en esta jornada: ${esc(libres.join(', '))}</p>` : ''}`;
}

// «Sin hora»: el campo pasa a pedir solo la fecha (y vuelve a fecha y hora al desmarcar)
function sinHoraJ(){
  const e = $('#jf'), sin = $('#jsh').checked, v = e.value;
  if (sin) { e.type = 'date'; e.value = v ? v.slice(0, 10) : ''; }
  else { e.type = 'datetime-local'; e.value = v ? (v.length === 10 ? v + 'T00:00' : v) : ''; }
}

async function anadirPartidoJ(){
  const l = $('#jl').value, v = $('#jv').value, f = $('#jf').value, i = $('#ji').value;
  if (l && l === v) return msg('El club local y el visitante no pueden ser el mismo.');
  const { error } = await sb.from('partidos').insert({
    id_jornada: jid, id_club_local: l ? +l : null, id_club_visitante: v ? +v : null,
    fecha_hora: f ? (f.length === 10 ? f + 'T00:00:00' : f.length === 16 ? f + ':00' : f) : null,
    sin_hora: !!f && $('#jsh').checked, id_instalacion: i ? +i : null });
  if (error) return msg('Error: ' + error.message);
  msg(''); await loadTable('partidos'); vistaJornada();
}

async function borrarPartidoJ(id){
  if (!confirm('¿Borrar este partido? También se borrarán sus partidas y chaves.')) return;
  const { error } = await sb.from('partidos').delete().eq('id', id);
  if (error) return msg('Error: ' + error.message);
  await loadAll(); vistaJornada();
}
