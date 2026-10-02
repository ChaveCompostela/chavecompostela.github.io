// Clasificación: puntos por equipo e máximos/máximas chavistas.
// Con selector de temporada (igual que Partidos).
// Reutiliza escFe (novasfe.js) y tempadaActual (calendariofe.js). Só lectura.

const CATEGORIAS_CLAS = { feminina: 'femenina', masculina: 'masculina' };

let tempadaEscollidaClas = null;
let datosClas = null;

// ---------- Utilidades de render ----------
function filaEquipoClas(pos, nome, puntos){
  return `<div class="clas-fila">
    <span class="clas-pos">${pos}</span>
    <span class="clas-nome">${escFe(nome)}</span>
    <span class="clas-puntos">${puntos}</span>
  </div>`;
}

function filaChavista(pos, nome, club, chaves){
  return `<div class="clas-fila clas-fila-xog">
    <span class="clas-pos">${pos}</span>
    <div class="clas-info">
      <span class="clas-nome">${escFe(nome)}</span>
      ${club ? `<span class="clas-club">${escFe(club)}</span>` : ''}
    </div>
    <span class="clas-chaves">${chaves}</span>
  </div>`;
}

function pintarClasEquipos(cont, filas){
  if (!cont) return;
  if (!filas.length) { cont.innerHTML = '<p class="baleiro">Aínda non hai clasificación dispoñible.</p>'; return; }
  cont.innerHTML = `<div class="clas-cabeceira"><span>Posición</span><span>Equipo</span><span>Puntos</span></div>`
    + filas.map((f, i) => filaEquipoClas(i + 1, f.nome, f.puntos)).join('');
}

function pintarClasChavistas(cont, filas, etiqueta){
  if (!cont) return;
  if (!filas.length) { cont.innerHTML = '<p class="baleiro">Aínda non hai datos de chaves.</p>'; return; }
  cont.innerHTML = `<div class="clas-cabeceira"><span>Posición</span><span>${escFe(etiqueta)}</span><span>Chaves</span></div>`
    + filas.map((f, i) => filaChavista(i + 1, f.nome, f.club, f.chaves)).join('');
}

// ---------- Cálculos ----------
function puntosPorEquipo(partidosLiga, clubsLiga){
  const puntos = {};
  for (const p of partidosLiga) {
    if (p.id_club_local) puntos[p.id_club_local] = (puntos[p.id_club_local] || 0) + (p.resultado_local || 0);
    if (p.id_club_visitante) puntos[p.id_club_visitante] = (puntos[p.id_club_visitante] || 0) + (p.resultado_visitante || 0);
  }
  return clubsLiga
    .map(c => ({ nome: c.nombre, puntos: puntos[c.id] || 0 }))
    .sort((a, b) => b.puntos - a.puntos || a.nome.localeCompare(b.nome));
}

function chavesPorXogador(partidosLiga, enfrentamientos, chaves, xogadores, clubs){
  const idsPartidos = new Set(partidosLiga.map(p => p.id));
  const idsEnfrent = new Set(enfrentamientos.filter(e => idsPartidos.has(e.id_partido)).map(e => e.id));
  const totais = {};
  for (const c of chaves) {
    if (!idsEnfrent.has(c.id_enfrentamiento)) continue;
    totais[c.id_jugador] = (totais[c.id_jugador] || 0) + (c.chaves || 0);
  }
  return Object.entries(totais)
    .map(([idJog, total]) => {
      const j = xogadores.find(x => x.id === Number(idJog));
      if (!j) return null;
      const club = clubs.find(c => c.id === j.id_club)?.nombre || '';
      return { nome: `${j.nombre} ${j.apellidos || ''}`.trim(), club, chaves: total };
    })
    .filter(Boolean)
    .sort((a, b) => b.chaves - a.chaves || a.nome.localeCompare(b.nome));
}

// ---------- Pintado por liga ----------
function pintarLigaClas(datos, liga){
  const els = {
    equipos: document.getElementById('clas-equipos-' + liga),
    chavistas: document.getElementById('clas-chavistas-' + liga),
  };
  if (!els.equipos) return;

  const nomeCat = CATEGORIAS_CLAS[liga];
  const idCat = datos.categorias.find(c => c.nombre === nomeCat)?.id;

  const ligasTemp = datos.ligas.filter(l =>
    l.id_temporada === tempadaEscollidaClas && l.id_categoria === idCat
  );
  const idsLigas = new Set(ligasTemp.map(l => l.id));

  const xornadas = datos.xornadas.filter(x => idsLigas.has(x.id_liga));
  const idsXorn = new Set(xornadas.map(x => x.id));

  const partidos = datos.partidos.filter(p =>
    idsXorn.has(p.id_jornada) &&
    p.resultado_local != null && p.resultado_visitante != null
  );

  const clubsLiga = datos.clubs.filter(c => c.id_categoria === idCat);
  const etiqueta = liga === 'femenina' ? 'Xogadora' : 'Xogador';

  pintarClasEquipos(els.equipos, puntosPorEquipo(partidos, clubsLiga));
  pintarClasChavistas(
    els.chavistas,
    chavesPorXogador(partidos, datos.enfrentamientos, datos.chaves, datos.jugadores, datos.clubs),
    etiqueta
  );
}

function pintarTodoClas(datos){
  pintarLigaClas(datos, 'feminina');
  pintarLigaClas(datos, 'masculina');
}

// ---------- Carga de datos ----------
async function cargarDatosClas(){
  const [
    { data: categorias, error: e1 },
    { data: temporadas, error: e0 },
    { data: ligas, error: e2 },
    { data: xornadas, error: e3 },
    { data: partidos, error: e4 },
    { data: clubs, error: e5 },
    { data: enfrentamientos, error: e6 },
    { data: chaves, error: e7 },
    { data: jugadores, error: e8 },
  ] = await Promise.all([
    sbfe.from('categorias').select('*'),
    sbfe.from('temporadas').select('*').order('fecha_inicio', { ascending: false }),
    sbfe.from('ligas').select('*'),
    sbfe.from('jornadas').select('*'),
    sbfe.from('partidos').select('*'),
    sbfe.from('clubs').select('id,nombre,id_categoria').eq('activo', true),
    sbfe.from('enfrentamientos').select('id,id_partido'),
    sbfe.from('chaves_enfrentamiento').select('*'),
    sbfe.from('jugadores').select('id,nombre,apellidos,id_club').eq('activo', true),
  ]);
  for (const err of [e0,e1,e2,e3,e4,e5,e6,e7,e8]) if (err) throw new Error(err.message);
  return { categorias, temporadas, ligas, xornadas, partidos, clubs, enfrentamientos, chaves, jugadores };
}

function encherSelectorTempadasClas(temporadas){
  const sel = document.getElementById('tempada-clasificacion');
  if (!sel) return;
  const actual = tempadaActual(temporadas);
  sel.innerHTML = temporadas.map(t =>
    `<option value="${t.id}">${escFe(t.nombre)}</option>`
  ).join('');
  tempadaEscollidaClas = actual?.id ?? (temporadas[0]?.id ?? null);
  if (tempadaEscollidaClas != null) sel.value = String(tempadaEscollidaClas);
}

// ---------- Arranque ----------
async function cargarClasificacion(){
  if (typeof ERR_CONFIG_FE !== 'undefined' && ERR_CONFIG_FE) {
    for (const l of ['feminina','masculina']) {
      const e = document.getElementById('clas-equipos-' + l);
      const c = document.getElementById('clas-chavistas-' + l);
      if (e) e.innerHTML = `<p class="erro">${escFe(ERR_CONFIG_FE)}</p>`;
      if (c) c.innerHTML = `<p class="erro">${escFe(ERR_CONFIG_FE)}</p>`;
    }
    return;
  }

  try {
    datosClas = await cargarDatosClas();
    encherSelectorTempadasClas(datosClas.temporadas);

    const sel = document.getElementById('tempada-clasificacion');
    if (sel) {
      sel.addEventListener('change', ev => {
        tempadaEscollidaClas = Number(ev.target.value);
        pintarTodoClas(datosClas);
      });
    }
    pintarTodoClas(datosClas);
  } catch (err) {
    const m = `<p class="erro">Non se puido cargar a clasificación: ${escFe(err.message)}</p>`;
    for (const l of ['feminina','masculina']) {
      const e = document.getElementById('clas-equipos-' + l);
      const c = document.getElementById('clas-chavistas-' + l);
      if (e) e.innerHTML = m;
      if (c) c.innerHTML = m;
    }
  }
}

document.addEventListener('DOMContentLoaded', cargarClasificacion);