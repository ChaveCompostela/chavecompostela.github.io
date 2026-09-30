// Partidos: lista de partidos da tempada escollida, agrupados por xornada.
// Cada tarxeta mostra os dous clubs e, se o partido está finalizado, o resultado.
// Ao pulsar unha tarxeta ábrese o detalle: partidas (pareja vs pareja), marcador
// e chaves de cada xogador. Só lectura.
//
// Reutiliza escFe/horaFe/tituloDia/chaveDia (novasfe.js) e tempadaActual (calendariofe.js).

let tempadaEscollida = null;   // id da tempada amosada actualmente
let partidoAberto = null;      // id do partido en detalle, ou null na lista
let datosPartidos = null;      // caché da última carga (evita refacer fetch ao abrir/pechar)

// ---------- Utilidades ----------
const CATEGORIAS_PARTIDOS = { feminina: 'femenina', masculina: 'masculina' };

function contedorPartidos(liga){
  return document.getElementById('partidos-' + liga);
}

// Nome dun club a partir do id, ou 'Sen club'
function nomeClub(clubs, id){
  if (!id) return 'Sen club';
  return clubs.find(c => c.id === id)?.nombre || `Club #${id}`;
}

// Texto do resultado global do partido, só se está finalizado e ten ambos resultados
function resultadoGlobal(p){
  if (p.estado !== 'finalizado') return null;
  if (p.resultado_local == null || p.resultado_visitante == null) return null;
  return `${p.resultado_local} - ${p.resultado_visitante}`;
}

// ---------- Lista ----------
function tarxetaPartido(p, clubs, xornada){
  const res = resultadoGlobal(p);
  let cl = 'partido-equipo partido-local';
  let cv = 'partido-equipo partido-visitante';
  if (res && p.resultado_local !== p.resultado_visitante) {
    if (p.resultado_local > p.resultado_visitante) cl += ' partido-ganador';
    else cv += ' partido-ganador';
  }
  const marcador = res
    ? `<span class="partido-resultado">${escFe(res)}</span>`
    : `<span class="partido-resultado partido-pendente">-</span>`;
  const hora = p.fecha_hora ? horaFe(p.fecha_hora) : '';
  return `<button class="partido-tarxeta" data-partido="${p.id}">
    <div class="partido-fila">
      <span class="partido-hora">${escFe(hora)}</span>
      <span class="${cl}">${escFe(nomeClub(clubs, p.id_club_local))}</span>
      ${marcador}
      <span class="${cv}">${escFe(nomeClub(clubs, p.id_club_visitante))}</span>
    </div>
  </button>`;
}

function pintarLista(cont, xornadas, partidos, clubs){
  if (!xornadas.length || !partidos.length) {
    cont.innerHTML = '<p class="baleiro">Aínda non hai partidos nesta tempada.</p>';
    return;
  }
  let html = '';
  for (const x of xornadas.slice().sort((a, b) => a.numero - b.numero)) {
    const ps = partidos.filter(p => p.id_jornada === x.id);
    if (!ps.length) continue;
    html += `<h2 class="calendario-xornada">Xornada ${x.numero}</h2>`;
    const ordenados = ps.slice().sort((a, b) => {
      const fa = a.fecha_hora || '', fb = b.fecha_hora || '';
      if (!fa && !fb) return 0;
      if (!fa) return 1;
      if (!fb) return -1;
      return fa.localeCompare(fb);
    });
    html += ordenados.map(p => tarxetaPartido(p, clubs, x)).join('');
  }
  cont.innerHTML = html || '<p class="baleiro">Aínda non hai partidos nesta tempada.</p>';
}

// ---------- Detalle ----------
function partidaHtml(e, datos, liga){
  const { parejas, jugadores, chaves_enfrentamiento } = datos;
  const eps = datos.enfrentamiento_parejas.filter(x => x.id_enfrentamiento === e.id);

  const nomesPareja = idPareja => {
    const pa = parejas.find(x => x.id === idPareja);
    if (!pa) return '—';
    const a = jugadores.find(j => j.id === pa.id_jugador_a);
    const b = jugadores.find(j => j.id === pa.id_jugador_b);
    return [a, b].filter(Boolean).map(j => `${j.nombre} ${j.apellidos || ''}`.trim()).join(' + ');
  };

  const xogadoresLado = eps.filter(x => x.lado === 'local').flatMap(x => {
    const pa = parejas.find(y => y.id === x.id_pareja);
    return pa ? [pa.id_jugador_a, pa.id_jugador_b] : [];
  });

  const lado = l => {
    const titulo = l === 'local' ? 'Local' : 'Visitante';
    const ps = eps.filter(x => x.lado === l);
    if (!ps.length) return `<div class="partida-lado"><h4 class="partida-lado-tit">${titulo}</h4><div class="partida-xog">—</div></div>`;
    const xog = ps.flatMap(x => {
      const pa = parejas.find(y => y.id === x.id_pareja);
      if (!pa) return [];
      return [pa.id_jugador_a, pa.id_jugador_b].map(id => {
        const j = jugadores.find(y => y.id === id);
        const nome = j ? `${j.nombre} ${j.apellidos || ''}`.trim() : `Xogador #${id}`;
        const c = chaves_enfrentamiento.find(z => z.id_enfrentamiento === e.id && z.id_jugador === id);
        const chaves = c && c.chaves != null ? `${c.chaves} chaves` : '—';
        return `<div class="partida-xog"><span>${escFe(nome)}</span><span class="chaves">${escFe(chaves)}</span></div>`;
      });
    }).join('');
    return `<div class="partida-lado"><h4 class="partida-lado-tit">${titulo}</h4>${xog}</div>`;
  };

  const conMarcador = e.marcador_local != null && e.marcador_visitante != null;
  const marcador = conMarcador
    ? `<p class="partida-marcador">${e.marcador_local} - ${e.marcador_visitante}</p>` : '';

  return `<div class="partida-card">
    <h3 class="partida-tit">Partida ${e.numero}</h3>
    ${marcador}
    ${lado('local')}${lado('visitante')}
  </div>`;
}

function pintarDetalle(cont, partido, datos){
  const res = resultadoGlobal(partido);
  const partidas = datos.enfrentamientos
    .filter(e => e.id_partido === partido.id)
    .sort((a, b) => a.numero - b.numero);

  const hora = partido.fecha_hora ? `${tituloDia(partido.fecha_hora)} · ${horaFe(partido.fecha_hora)}` : 'Data por confirmar';
  const meta = escFe(hora);

  cont.innerHTML = `<button class="detalle-volver" data-volver>← Partidos</button>
    <div class="detalle-cab">
      <div class="detalle-enfront">
        <span class="detalle-club local">${escFe(nomeClub(datos.clubs, partido.id_club_local))}</span>
        <span class="detalle-marcador">${res ? escFe(res) : 'vs'}</span>
        <span class="detalle-club">${escFe(nomeClub(datos.clubs, partido.id_club_visitante))}</span>
      </div>
      <p class="detalle-meta">${meta}</p>
    </div>
    ${partidas.length ? partidas.map(e => partidaHtml(e, datos, datos.liga)).join('')
      : '<p class="baleiro">Aínda non hai partidas rexistradas neste partido.</p>'}`;
}

// ---------- Carga de datos ----------
async function cargarDatosPartidos(){
  const [
    { data: categorias, error: e1 }, { data: temporadas, error: e0 }, { data: ligas, error: e2 },
    { data: xornadas, error: e3 }, { data: partidos, error: e4 }, { data: clubs, error: e5 },
    { data: enfrentamientos, error: e6 }, { data: enfrentamiento_parejas, error: e7 },
    { data: chaves_enfrentamiento, error: e8 }, { data: parejas, error: e9 },
    { data: jugadores, error: e10 },
  ] = await Promise.all([
    sbfe.from('categorias').select('*'),
    sbfe.from('temporadas').select('*').order('fecha_inicio', { ascending: false }),
    sbfe.from('ligas').select('*'),
    sbfe.from('jornadas').select('*'),
    sbfe.from('partidos').select('*'),
    sbfe.from('clubs').select('id,nombre'),
    sbfe.from('enfrentamientos').select('*'),
    sbfe.from('enfrentamiento_parejas').select('*'),
    sbfe.from('chaves_enfrentamiento').select('*'),
    sbfe.from('parejas').select('*'),
    sbfe.from('jugadores').select('id,nombre,apellidos'),
  ]);
  for (const err of [e0, e1, e2, e3, e4, e5, e6, e7, e8, e9, e10]) if (err) throw new Error(err.message);
  return { categorias, temporadas, ligas, xornadas, partidos, clubs,
    enfrentamientos, enfrentamiento_parejas, chaves_enfrentamiento, parejas, jugadores };
}

// Enche o desplegable de tempadas e devolve a id seleccionada
function encherSelectorTempadas(temporadas){
  const sel = document.getElementById('tempada-partidos');
  const actual = tempadaActual(temporadas);
  sel.innerHTML = temporadas.map(t => `<option value="${t.id}" ${t.id === actual?.id ? 'selected' : ''}>${escFe(t.nombre)}</option>`).join('');
  tempadaEscollida = actual?.id ?? null;
}

function pintarLiga(datos, liga){
  const cont = contedorPartidos(liga);
  if (!cont) return;
  const idCat = datos.categorias.find(c => c.nombre === CATEGORIAS_PARTIDOS[liga])?.id;
  const ligasTemp = datos.ligas.filter(l => l.id_temporada === tempadaEscollida && l.id_categoria === idCat);
  const idsLigas = new Set(ligasTemp.map(l => l.id));
  const xornadas = datos.xornadas.filter(x => idsLigas.has(x.id_liga));
  const idsXorn = new Set(xornadas.map(x => x.id));
  const partidos = datos.partidos.filter(p => idsXorn.has(p.id_jornada));

  // O detalle non se pinta se non hai partido aberto ou pertence a outra liga
  if (partidoAberto) {
    const p = partidos.find(x => x.id === partidoAberto);
    if (p) return pintarDetalle(cont, p, { ...datos, liga });
    partidoAberto = null;
  }
  pintarLista(cont, xornadas, partidos, datos.clubs);
}

function pintarTodo(datos){
  pintarLiga(datos, 'feminina');
  pintarLiga(datos, 'masculina');
}

// ---------- Interacción ----------
function delegarClic(){
  document.getElementById('vista-partidos').addEventListener('click', e => {
    const botonVolver = e.target.closest('[data-volver]');
    if (botonVolver) {
      partidoAberto = null;
      if (datosPartidos) pintarTodo(datosPartidos);
      return;
    }
    const tarxeta = e.target.closest('[data-partido]');
    if (tarxeta && datosPartidos) {
      partidoAberto = Number(tarxeta.dataset.partido);
      pintarTodo(datosPartidos);
    }
  });
}

async function cargarPartidos(){
  if (ERR_CONFIG_FE) {
    for (const l of ['feminina','masculina']) {
      const c = contedorPartidos(l);
      if (c) c.innerHTML = `<p class="erro">${escFe(ERR_CONFIG_FE)}</p>`;
    }
    return;
  }
  try {
    datosPartidos = await cargarDatosPartidos();
    encherSelectorTempadas(datosPartidos.temporadas);
    document.getElementById('tempada-partidos').addEventListener('change', ev => {
      tempadaEscollida = Number(ev.target.value);
      partidoAberto = null;
      pintarTodo(datosPartidos);
    });
    delegarClic();
    pintarTodo(datosPartidos);
  } catch (err) {
    const m = `<p class="erro">Non se puideron cargar os partidos: ${escFe(err.message)}</p>`;
    for (const l of ['feminina','masculina']) {
      const c = contedorPartidos(l);
      if (c) c.innerHTML = m;
    }
  }
}

document.addEventListener('DOMContentLoaded', cargarPartidos);