// Calendario: partidos de cada jornada (quién juega contra quién). Las partidas se montan después, dentro de cada partido.
let jid = null;

function abrirJornada(id){ jid = id; vistaJornada(); }

function vistaJornada(){
  const j = D.jornadas.find(x => x.id === jid);
  const ps = D.partidos.filter(p => p.id_jornada === jid)
    .sort((a, b) => (a.fecha_hora || '').localeCompare(b.fecha_hora || ''));
  const activos = D.clubs.filter(c => c.activo !== false);
  const usados = new Set(ps.flatMap(p => [p.id_club_local, p.id_club_visitante]).filter(Boolean));
  const libres = activos.filter(c => !usados.has(c.id)).map(c => c.nombre);
  const clubs = '<option value="">Sin club</option>' + activos.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('');
  const insts = '<option value="">—</option>' + D.instalaciones.map(i => `<option value="${i.id}">${esc(i.nombre)}</option>`).join('');
  const club = id => esc(id ? lab('clubs', id) : 'Sin club');
  const filas = ps.map(p => `<tr><td class="ac"><button class="ic pri" onclick="abrir(${p.id}, true)">Partidas</button>
      <button class="ic del" onclick="borrarPartidoJ(${p.id})" aria-label="Borrar">🗑️</button></td>
      <td>${club(p.id_club_local)}</td><td>${club(p.id_club_visitante)}</td>
      <td>${esc(fmt(p.fecha_hora, 'dt'))}</td><td>${esc(p.id_instalacion ? lab('instalaciones', p.id_instalacion) : '')}</td>
      <td>${D.enfrentamientos.filter(e => e.id_partido === p.id).length}</td></tr>`).join('');
  $('#main').innerHTML = `<button onclick="listar()">← Jornadas</button>
    <div class="bar"><h2>${esc(lab('jornadas', jid))}</h2></div>
    <p class="mut">${esc(fmt(j.fecha, 'd'))}</p>
    <div class="card"><h3>Añadir partido a la jornada</h3>
      <label>Club local<select id="jl">${clubs}</select></label>
      <label>Club visitante<select id="jv">${clubs}</select></label>
      <label>Fecha y hora (opcional)<input id="jf" type="datetime-local"></label>
      <label>Instalación (opcional)<select id="ji">${insts}</select></label>
      <button class="pri" style="width:100%" onclick="anadirPartidoJ()">+ Añadir partido</button></div>
    <h3>Partidos de la jornada (${ps.length})</h3>
    <div class="tw"><table><thead><tr><th></th><th>Local</th><th>Visitante</th><th>Fecha</th><th>Instalación</th><th>Partidas</th></tr></thead>
    <tbody>${filas || '<tr><td colspan="6" class="mut">Aún no hay partidos en esta jornada</td></tr>'}</tbody></table></div>
    ${libres.length ? `<p class="mut">Clubs sin partido en esta jornada: ${esc(libres.join(', '))}</p>` : ''}`;
}

async function anadirPartidoJ(){
  const l = $('#jl').value, v = $('#jv').value, f = $('#jf').value, i = $('#ji').value;
  if (l && l === v) return msg('El club local y el visitante no pueden ser el mismo.');
  const { error } = await sb.from('partidos').insert({
    id_jornada: jid, id_club_local: l ? +l : null, id_club_visitante: v ? +v : null,
    fecha_hora: f ? new Date(f).toISOString() : null, id_instalacion: i ? +i : null });
  if (error) return msg('Error: ' + error.message);
  msg(''); await loadTable('partidos'); vistaJornada();
}

async function borrarPartidoJ(id){
  if (!confirm('¿Borrar este partido? También se borrarán sus partidas y chaves.')) return;
  const { error } = await sb.from('partidos').delete().eq('id', id);
  if (error) return msg('Error: ' + error.message);
  await loadAll(); vistaJornada();
}
