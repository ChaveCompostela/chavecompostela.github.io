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

// Nome dun bando (local/visitante) dun partido: o nome do club se o ten; se non, o
// nome da parella que o representa, coma "Laura&Carlota" (primeiro nome de cada xogadora/xogador).
// Cando o bando non ten club, tómase a parella da primeira partida (mesa) dese bando —
// é a mellor pista dispoñible, xa que as parellas sen club non quedan fixadas ao partido enteiro.
// Compartida entre Calendario, Partidos e Marcador.
function primeiroNomeXog(id, datos){
  const j = datos.jugadores?.find(x => x.id === id);
  return j ? j.nombre.split(' ')[0] : null;
}

function nomeParellaCurta(idPareja, datos){
  const pa = datos.parejas?.find(p => p.id === idPareja);
  if (!pa) return null;
  const n1 = primeiroNomeXog(pa.id_jugador_a, datos), n2 = primeiroNomeXog(pa.id_jugador_b, datos);
  return n1 && n2 ? `${n1}&${n2}` : null;
}

// A parella que representa un bando sen club: a da súa primeira partida (mesa).
// Devolve o obxecto pareja completo (para poder usar o seu id coma clave estable
// na clasificación) ou null se aínda non ten ningunha mesa asignada.
function parellaRepresentativa(partido, lado, datos){
  const mesas = (datos.enfrentamientos || [])
    .filter(e => e.id_partido === partido.id)
    .sort((a, b) => a.numero - b.numero);
  for (const m of mesas) {
    const ep = (datos.enfrentamiento_parejas || []).find(x => x.id_enfrentamiento === m.id && x.lado === lado);
    if (!ep) continue;
    const pa = (datos.parejas || []).find(p => p.id === ep.id_pareja);
    if (pa) return pa;
  }
  return null;
}

function nomeLadoPartido(partido, lado, datos){
  const idClub = lado === 'local' ? partido.id_club_local : partido.id_club_visitante;
  if (idClub) return nomeClubCal(datos.clubs, idClub);
  const pa = parellaRepresentativa(partido, lado, datos);
  return (pa && nomeParellaCurta(pa.id, datos)) || 'Sen equipo';
}

// Debuxa un resultado coa cifra do gañador destacada e a do perdedor nun gris máis tenue,
// para que se distingan ben. Nun empate, as dúas cifras quedan en negra forte (sen gañador
// nin perdedor). Compartida entre o Calendario e os Partidos (equipos e partidas).
function resultadoConGanador(numLocal, numVisitante){
  if (numLocal == null || numVisitante == null) return '-';
  let claseLocal = '', claseVisit = '';
  if (numLocal > numVisitante) { claseLocal = ' class="num-gan"'; claseVisit = ' class="num-perde"'; }
  else if (numVisitante > numLocal) { claseVisit = ' class="num-gan"'; claseLocal = ' class="num-perde"'; }
  return `<span${claseLocal}>${numLocal}</span> - <span${claseVisit}>${numVisitante}</span>`;
}

function filaPartido(p, datos){
  const hora = p.fecha_hora ? horaFe(p.fecha_hora) : '';
  const conResultado = p.resultado_local != null && p.resultado_visitante != null;
  const resultado = conResultado ? resultadoConGanador(p.resultado_local, p.resultado_visitante) : '-';
  const inst = (datos.instalaciones || []).find(i => i.id === p.id_instalacion);
  const lugar = inst
    ? (inst.url_localizacion
        ? `<a class="partido-lugar" href="${escFe(inst.url_localizacion)}" target="_blank" rel="noopener">${escFe(inst.nombre)} 📍</a>`
        : `<span class="partido-lugar">${escFe(inst.nombre)}</span>`)
    : '';

  return `<div class="partido-fila">
    <span class="partido-hora">${escFe(hora)}</span>
    <span class="partido-equipo partido-local">${escFe(nomeLadoPartido(p, 'local', datos))}</span>
    <span class="partido-resultado">${resultado}</span>
    <span class="partido-equipo partido-visitante">${escFe(nomeLadoPartido(p, 'visitante', datos))}</span>
    ${lugar}
  </div>`;
}

// A xornada á que facer scroll ao entrar: a primeira (pola súa orde) que teña algún
// partido con data de hoxe en diante. Se unha xornada aínda ten partidos pendentes
// (hoxe ou despois), gaña ela aínda que exista outra posterior xa pechada no calendario.
// Se todas as xornadas son xa pasadas, quédase na última.
function xornadaObxectivo(xornadas, partidos){
  if (!xornadas.length) return null;
  const hoxe = new Date(); hoxe.setHours(0, 0, 0, 0);
  const ordenadas = xornadas.slice().sort((a, b) => a.numero - b.numero);
  for (const x of ordenadas) {
    const temPendente = partidos.some(p => p.id_jornada === x.id && p.fecha_hora && new Date(p.fecha_hora) >= hoxe);
    if (temPendente) return x.id;
  }
  return ordenadas[ordenadas.length - 1].id;
}

// Desprázase dentro do propio contedor (non da páxina enteira) ata a xornada indicada.
// Se o panel aínda está oculto (display:none), o cálculo dá 0 e non fai nada — por iso
// se volve chamar máis abaixo cando o panel pasa a estar visible.
function desprazarAXornada(cont, idXornada){
  if (idXornada == null) return;
  const el = cont.querySelector(`[data-xid="${idXornada}"]`);
  if (!el) return;
  const delta = el.getBoundingClientRect().top - cont.getBoundingClientRect().top;
  if (delta === 0 && cont.offsetParent === null) return;   // contedor oculto: nada que facer aínda
  cont.scrollTop = cont.scrollTop + delta - 8;
}

function pintarCalendario(cont, xornadas, partidos, datos){
  if (!xornadas.length) { cont.innerHTML = '<p class="baleiro">Aínda non hai xornadas publicadas.</p>'; return null; }

  let html = '';
  for (const x of xornadas.slice().sort((a, b) => a.numero - b.numero)) {
    html += `<h2 class="calendario-xornada" data-xid="${x.id}">Xornada ${x.numero}</h2>`;
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
      html += `<div class="partido-card">${lista.map(p => filaPartido(p, datos)).join('')}</div>`;
    }
  }
  cont.innerHTML = html;

  const idObxectivo = xornadaObxectivo(xornadas, partidos);
  desprazarAXornada(cont, idObxectivo);   // funciona xa se o panel está visible
  return idObxectivo;
}

async function cargarCalendario(){
  const contFem = document.getElementById('calendario-feminina');
  const contMasc = document.getElementById('calendario-masculina');
  if (ERR_CONFIG_FE) { contFem.innerHTML = contMasc.innerHTML = `<p class="erro">${escFe(ERR_CONFIG_FE)}</p>`; return; }
  try {
    const [
      { data: categorias, error: e1 }, { data: temporadas, error: e0 }, { data: ligas, error: e2 },
      { data: xornadas, error: e3 }, { data: partidos, error: e4 }, { data: clubs, error: e5 },
      { data: enfrentamientos, error: e6 }, { data: enfrentamiento_parejas, error: e7 },
      { data: parejas, error: e8 }, { data: jugadores, error: e9 }, { data: instalaciones, error: e10 },
    ] = await Promise.all([
      sbfe.from('categorias').select('*'),
      sbfe.from('temporadas').select('*'),
      sbfe.from('ligas').select('*'),
      sbfe.from('jornadas').select('*'),
      sbfe.from('partidos').select('*'),
      sbfe.from('clubs').select('id,nombre'),
      sbfe.from('enfrentamientos').select('id,id_partido,numero'),
      sbfe.from('enfrentamiento_parejas').select('*'),
      sbfe.from('parejas').select('*'),
      sbfe.from('jugadores').select('id,nombre'),
      sbfe.from('instalaciones').select('id,nombre,url_localizacion'),
    ]);
    for (const err of [e0, e1, e2, e3, e4, e5, e6, e7, e8, e9, e10]) if (err) throw new Error(err.message);

    const datos = { clubs, enfrentamientos, enfrentamiento_parejas, parejas, jugadores, instalaciones };
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

    const idObxFem = pintarCalendario(contFem, xornFem, partidos.filter(p => idsFem.has(p.id_jornada)), datos);
    const idObxMasc = pintarCalendario(contMasc, xornMasc, partidos.filter(p => idsMasc.has(p.id_jornada)), datos);

    // Ao entrar, só o panel visible (feminina, por defecto) puido desprazarse de verdade;
    // cando se cambia á outra liga, o seu panel acaba de facerse visible e hai que repetir
    // o cálculo nese intre (un pequeno atraso abonda para que xa estea despregado).
    document.querySelectorAll('#vista-calendario .seg').forEach(s => s.addEventListener('click', () => {
      setTimeout(() => {
        if (s.dataset.liga === 'feminina') desprazarAXornada(contFem, idObxFem);
        else desprazarAXornada(contMasc, idObxMasc);
      }, 0);
    }));
  } catch (e) {
    const msg = `<p class="erro">Non se puido cargar o calendario: ${escFe(e.message)}</p>`;
    contFem.innerHTML = contMasc.innerHTML = msg;
  }
}

document.addEventListener('DOMContentLoaded', cargarCalendario);
