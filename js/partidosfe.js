// Partidos: lista de partidos da tempada escollida, agrupados por xornada.
// Cada partido é unha tarxeta plegable (mesmo patrón ca Equipos). Só se pode
// abrir se hai algo que mostrar: algún enfrentamento con marcador ou con chaves.
// Dentro ábrese a lista de partidas (pareja vs pareja), o marcador e as chaves
// de cada xogador. Só lectura.
//
// Depende de: novasfe.js (escFe, horaFe, tituloDia) e calendariofe.js (tempadaActual).

// Mapa clave interna (data-liga do HTML) → nome real na táboa "categorias"
const CATEGORIAS_PARTIDOS = { feminina: 'femenina', masculina: 'masculina' };

let tempadaEscollida = null;
let datosPartidos = null;

// ---------- Utilidades ----------
function contedorPartidos(liga){
  return document.getElementById('partidos-' + liga);
}

function nomeClubP(clubs, id){
  if (!id) return 'Sen club';
  return clubs.find(c => c.id === id)?.nombre || `Club #${id}`;
}

// Resultado global do partido: móstrase sempre que exista, sen importar o estado
function resultadoGlobalP(p){
  if (p.resultado_local == null || p.resultado_visitante == null) return null;
  return `${p.resultado_local} - ${p.resultado_visitante}`;
}

// Un partido é abrible se ten algún enfrentamento con marcador ou con chaves rexistradas
function partidoTenDatos(partidoId, datos){
  const enf = datos.enfrentamientos.filter(e => e.id_partido === partidoId);
  if (!enf.length) return false;
  return enf.some(e => {
    const tenMarcador = e.marcador_local != null || e.marcador_visitante != null;
    const tenChaves = datos.chaves_enfrentamiento.some(c => c.id_enfrentamiento === e.id && c.chaves != null);
    return tenMarcador || tenChaves;
  });
}

// ---------- Render: detalle dunha partida ----------
function nomeXogadorP(id, datos){
  const j = datos.jugadores.find(y => y.id === id);
  return j ? `${j.nombre} ${j.apellidos || ''}`.trim() : `Xogador #${id}`;
}

function nomeParellaP(idPareja, datos){
  const pa = datos.parejas.find(y => y.id === idPareja);
  if (!pa) return '—';
  return `${nomeXogadorP(pa.id_jugador_a, datos)} / ${nomeXogadorP(pa.id_jugador_b, datos)}`;
}

function partidaHtml(e, datos){
  const eps = datos.enfrentamiento_parejas.filter(x => x.id_enfrentamiento === e.id);

  // Nome da(s) parella(s) de cada lado (pode haber máis dunha no mesmo enfrentamento)
  const parellasLado = l => eps.filter(x => x.lado === l).map(x => nomeParellaP(x.id_pareja, datos));
  const parLocal = parellasLado('local').join(' · ') || 'Sen parella';
  const parVisit = parellasLado('visitante').join(' · ') || 'Sen parella';

  const lado = l => {
    const titulo = l === 'local' ? 'Local' : 'Visitante';
    const ps = eps.filter(x => x.lado === l);
    if (!ps.length) {
      return `<div class="partida-lado"><h4 class="partida-lado-tit">${titulo}</h4><div class="partida-xog">—</div></div>`;
    }
    const xog = ps.flatMap(x => {
      const pa = datos.parejas.find(y => y.id === x.id_pareja);
      if (!pa) return [];
      return [pa.id_jugador_a, pa.id_jugador_b].map(id => {
        const nome = nomeXogadorP(id, datos);
        const c = datos.chaves_enfrentamiento.find(z => z.id_enfrentamiento === e.id && z.id_jugador === id);
        const chaves = c && c.chaves != null ? `${c.chaves} chaves` : '—';
        return `<div class="partida-xog"><span>${escFe(nome)}</span><span class="chaves">${escFe(chaves)}</span></div>`;
      });
    }).join('');
    return `<div class="partida-lado"><h4 class="partida-lado-tit">${titulo}</h4>${xog}</div>`;
  };

  const conMarcador = e.marcador_local != null && e.marcador_visitante != null;
  const marcador = conMarcador ? resultadoConGanador(e.marcador_local, e.marcador_visitante) : '-';

  return `<div class="partida-card">
    <h3 class="partida-tit">Partida ${e.numero}</h3>
    <div class="partida-vs">
      <span class="partida-parella">${escFe(parLocal)}</span>
      <span class="partida-marcador">${marcador}</span>
      <span class="partida-parella">${escFe(parVisit)}</span>
    </div>
    ${lado('local')}${lado('visitante')}
  </div>`;
}

function detallePartidoHtml(partido, datos){
  const partidas = datos.enfrentamientos
    .filter(e => e.id_partido === partido.id)
    .sort((a, b) => a.numero - b.numero);
  if (!partidas.length) return '<p class="baleiro">Aínda non hai partidas rexistradas.</p>';
  return partidas.map(e => partidaHtml(e, datos)).join('');
}

// ---------- Render: tarxeta dun partido ----------
function tarxetaPartido(p, clubs, datos){
  const res = resultadoGlobalP(p);
  const abrible = partidoTenDatos(p.id, datos);

  const marcador = res
    ? `<span class="partido-resultado">${resultadoConGanador(p.resultado_local, p.resultado_visitante)}</span>`
    : `<span class="partido-resultado partido-pendente">-</span>`;
  const hora = p.fecha_hora ? horaFe(p.fecha_hora) : '';

  const chevron = `<svg class="partido-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;

  return `<div class="partido-card-partido">
    <button class="partido-fila-partido" aria-expanded="false" ${abrible ? '' : 'disabled'}>
      <span class="partido-hora">${escFe(hora)}</span>
      <span class="partido-equipo partido-local">${escFe(nomeClubP(clubs, p.id_club_local))}</span>
      ${marcador}
      <span class="partido-equipo partido-visitante">${escFe(nomeClubP(clubs, p.id_club_visitante))}</span>
      ${chevron}
    </button>
    <div class="partido-despregable" hidden>${detallePartidoHtml(p, datos)}</div>
  </div>`;
}

// ---------- Render: lista por xornada ----------
function pintarLista(cont, xornadas, partidos, datos){
  if (!xornadas.length || !partidos.length) {
    cont.innerHTML = '<p class="baleiro">Aínda non hai partidos nesta tempada.</p>';
    return;
  }
  let html = '';
  for (const x of xornadas.slice().sort((a, b) => b.numero - a.numero)) {
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
    html += ordenados.map(p => tarxetaPartido(p, datos.clubs, datos)).join('');
  }
  cont.innerHTML = html || '<p class="baleiro">Aínda non hai partidos nesta tempada.</p>';
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

function encherSelectorTempadas(temporadas){
  const sel = document.getElementById('tempada-partidos');
  const actual = tempadaActual(temporadas);
  sel.innerHTML = temporadas.map(t => `<option value="${t.id}">${escFe(t.nombre)}</option>`).join('');
  tempadaEscollida = actual?.id ?? (temporadas[0]?.id ?? null);
  if (tempadaEscollida != null) sel.value = String(tempadaEscollida);
}

function pintarLiga(datos, liga){
  const cont = contedorPartidos(liga);
  if (!cont) return;
  const nomeCat = CATEGORIAS_PARTIDOS[liga];                          // 'femenina' / 'masculina'
  const idCat = datos.categorias.find(c => c.nombre === nomeCat)?.id;
  const ligasTemp = datos.ligas.filter(l => l.id_temporada === tempadaEscollida && l.id_categoria === idCat);
  const idsLigas = new Set(ligasTemp.map(l => l.id));
  const xornadas = datos.xornadas.filter(x => idsLigas.has(x.id_liga));
  const idsXorn = new Set(xornadas.map(x => x.id));
  const partidos = datos.partidos.filter(p => idsXorn.has(p.id_jornada));
  pintarLista(cont, xornadas, partidos, datos);
}

function pintarTodo(datos){
  pintarLiga(datos, 'feminina');
  pintarLiga(datos, 'masculina');
}

// ---------- Acordeón: un único listener global (igual que Equipos) ----------
document.addEventListener('click', e => {
  const fila = e.target.closest('#vista-partidos .partido-fila-partido');
  if (!fila || fila.disabled) return;
  const desp = fila.nextElementSibling;
  if (!desp) return;
  const aberto = fila.getAttribute('aria-expanded') === 'true';
  fila.setAttribute('aria-expanded', String(!aberto));
  desp.hidden = aberto;
});

// ---------- Arranque ----------
async function cargarPartidos(){
  if (typeof ERR_CONFIG_FE !== 'undefined' && ERR_CONFIG_FE) {
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
      pintarTodo(datosPartidos);
    });
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
