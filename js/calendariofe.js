// Calendario: xornadas e partidos de cada liga da tempada en curso, agrupados primeiro
// por xornada e despois por data dentro dela. Reutiliza escFe/horaFe/tituloDia/chaveDia de novasfe.js.
// Só lectura: esta app non crea, edita nin borra nada.

// A tempada en curso é a que inclúe hoxe entre a súa data de inicio e fin; se ningunha
// encaixa (fóra de tempada), tómase a última xa iniciada ou, no seu defecto, a próxima.
function tempadaActual(temporadas){
  if (!temporadas.length) return null;
  const hoxe = new Date().toISOString().slice(0, 10);
  const dentro = temporadas.find(t => t.fecha_inicio <= hoxe && hoxe <= t.fecha_fin);
  if (dentro) return dentro;
  const xaEmpezadas = temporadas.filter(t => t.fecha_inicio <= hoxe).sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio));
  if (xaEmpezadas.length) return xaEmpezadas[0];
  return temporadas.slice().sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio))[0];
}

function nomeClubCal(clubs, id){
  if (!id) return 'Sen club';
  return clubs.find(c => c.id === id)?.nombre || `Club #${id}`;
}

// Debuxa un resultado coa cifra do gañador destacada; a do perdedor queda coa cor normal
// (a mesma cós nomes). Nun empate, as dúas cifras quedan coa cor normal. Compartida entre
// o Calendario e os Partidos (equipos e partidas).
function resultadoConGanador(numLocal, numVisitante){
  if (numLocal == null || numVisitante == null) return '-';
  const claseLocal = numLocal > numVisitante ? ' class="num-gan"' : '';
  const claseVisit = numVisitante > numLocal ? ' class="num-gan"' : '';
  return `<span${claseLocal}>${numLocal}</span> - <span${claseVisit}>${numVisitante}</span>`;
}

function filaPartido(p, clubs){
  const hora = p.fecha_hora ? horaFe(p.fecha_hora) : '';
  const conResultado = p.resultado_local != null && p.resultado_visitante != null;
  const resultado = conResultado ? resultadoConGanador(p.resultado_local, p.resultado_visitante) : '-';

  return `<div class="partido-fila">
    <span class="partido-hora">${escFe(hora)}</span>
    <span class="partido-equipo partido-local">${escFe(nomeClubCal(clubs, p.id_club_local))}</span>
    <span class="partido-resultado">${resultado}</span>
    <span class="partido-equipo partido-visitante">${escFe(nomeClubCal(clubs, p.id_club_visitante))}</span>
  </div>`;
}

function pintarCalendario(cont, , partidos, clubs){
  if (!.length) { cont.innerHTML = '<p class="baleiro">Aínda non hai  publicadas.</p>'; return; }

  let html = '';
  for (const x of xornadas.slice().sort((a, b) => b.numero - a.numero))
    html += `<h2 class="calendario-xornada">Xornada ${x.numero}</h2>`;
    const ps = partidos.filter(p => p.id_jornada === x.id);
    if (!ps.length) { html += '<p class="baleiro">Aínda non hai partidos nesta xornada.</p>'; continue; }

    const grupos = {};
    for (const p of ps) {
      const chave = p.fecha_hora ? chaveDia(p.fecha_hora) : 'sen-data';
      (grupos[chave] = grupos[chave] || []).push(p);
    }
    const chaves = Object.keys(grupos).filter(k => k !== 'sen-data')
      .sort((a, b) => new Date(grupos[a][0].fecha_hora) - new Date(grupos[b][0].fecha_hora));
    if (grupos['sen-data']) chaves.push('sen-data');

    for (const chave of chaves) {
      const lista = grupos[chave].slice().sort((a, b) => (a.fecha_hora || '').localeCompare(b.fecha_hora || ''));
      const titulo = chave === 'sen-data' ? 'Data por confirmar' : tituloDia(lista[0].fecha_hora);
      html += `<h3 class="calendario-data">${escFe(titulo)}</h3>`;
      html += `<div class="partido-card">${lista.map(p => filaPartido(p, clubs)).join('')}</div>`;
    }
  }
  cont.innerHTML = html;
}

async function cargarCalendario(){
  const contFem = document.getElementById('calendario-feminina');
  const contMasc = document.getElementById('calendario-masculina');
  if (ERR_CONFIG_FE) { contFem.innerHTML = contMasc.innerHTML = `<p class="erro">${escFe(ERR_CONFIG_FE)}</p>`; return; }
  try {
    const [
      { data: categorias, error: e1 }, { data: temporadas, error: e0 }, { data: ligas, error: e2 },
      { data: xornadas, error: e3 }, { data: partidos, error: e4 }, { data: clubs, error: e5 },
    ] = await Promise.all([
      sbfe.from('categorias').select('*'),
      sbfe.from('temporadas').select('*'),
      sbfe.from('ligas').select('*'),
      sbfe.from('jornadas').select('*'),
      sbfe.from('partidos').select('*'),
      sbfe.from('clubs').select('id,nombre'),
    ]);
    if (e0) throw new Error(e0.message);
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);
    if (e3) throw new Error(e3.message);
    if (e4) throw new Error(e4.message);
    if (e5) throw new Error(e5.message);

    const tempada = tempadaActual(temporadas);
    const idFem = categorias.find(c => c.nombre === 'femenina')?.id;
    const idMasc = categorias.find(c => c.nombre === 'masculina')?.id;
    const ligasDaTempada = ligas.filter(l => l.id_temporada === tempada?.id);
    const ligasFem = new Set(ligasDaTempada.filter(l => l.id_categoria === idFem).map(l => l.id));
    const ligasMasc = new Set(ligasDaTempada.filter(l => l.id_categoria === idMasc).map(l => l.id));
    const xornFem = xornadas.filter(x => ligasFem.has(x.id_liga));
    const xornMasc = xornadas.filter(x => ligasMasc.has(x.id_liga));
    const idsFem = new Set(xornFem.map(x => x.id));
    const idsMasc = new Set(xornMasc.map(x => x.id));

    pintarCalendario(contFem, xornFem, partidos.filter(p => idsFem.has(p.id_jornada)), clubs);
    pintarCalendario(contMasc, xornMasc, partidos.filter(p => idsMasc.has(p.id_jornada)), clubs);
  } catch (e) {
    const msg = `<p class="erro">Non se puido cargar o calendario: ${escFe(e.message)}</p>`;
    contFem.innerHTML = contMasc.innerHTML = msg;
  }
}

document.addEventListener('DOMContentLoaded', cargarCalendario);
