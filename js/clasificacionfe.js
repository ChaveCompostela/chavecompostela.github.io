// Clasificación: puntos por equipo e máximos/máximas chavistas, só coa tempada en curso.
// Un partido cóntase como xogado cando ten resultado (resultado_local/resultado_visitante
// non nulos), igual có Calendario — non depende de que alguén cambie á man o Estado a "finalizado".
// Reutiliza escFe e tempadaActual (de novasfe.js/calendariofe.js). Só lectura.
//
// Puntos: en cada partido, cada equipo suma tantos puntos coma partidas gañou nel.
// Un partido finalizado 3-1 reparte 3 puntos ao que gañou 3 partidas e 1 ao que gañou 1.

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
  if (!filas.length) { cont.innerHTML = '<p class="baleiro">Aínda non hai clasificación dispoñible.</p>'; return; }
  cont.innerHTML = `<div class="clas-cabeceira"><span>Posición</span><span>Equipo</span><span>Puntos</span></div>`
    + filas.map((f, i) => filaEquipoClas(i + 1, f.nome, f.puntos)).join('');
}

function pintarClasChavistas(cont, filas, etiqueta){
  if (!filas.length) { cont.innerHTML = '<p class="baleiro">Aínda non hai datos de chaves.</p>'; return; }
  cont.innerHTML = `<div class="clas-cabeceira"><span>Posición</span><span>${escFe(etiqueta)}</span><span>Chaves</span></div>`
    + filas.map((f, i) => filaChavista(i + 1, f.nome, f.club, f.chaves)).join('');
}

function puntosPorEquipo(partidosLiga, clubsLiga){
  const puntos = {};
  for (const p of partidosLiga) {
    if (p.id_club_local) puntos[p.id_club_local] = (puntos[p.id_club_local] || 0) + p.resultado_local;
    if (p.id_club_visitante) puntos[p.id_club_visitante] = (puntos[p.id_club_visitante] || 0) + p.resultado_visitante;
  }
  return clubsLiga
    .map(c => ({ nome: c.nombre, puntos: puntos[c.id] || 0 }))
    .sort((a, b) => b.puntos - a.puntos || a.nome.localeCompare(b.nome));
}

function chavesPorXogador(partidosLiga, enfrentamentos, chaves, xogadores, clubs){
  const idsPartidos = new Set(partidosLiga.map(p => p.id));
  const idsEnfrent = new Set(enfrentamentos.filter(e => idsPartidos.has(e.id_partido)).map(e => e.id));
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

let datosClasificacion = null;
let tempadaEscollidaClas = null;

function encherSelectorTempadasClas(temporadas){
  const sel = document.getElementById('tempada-clasificacion');
  const actual = tempadaActual(temporadas);
  sel.innerHTML = temporadas.map(t => `<option value="${t.id}">${escFe(t.nombre)}</option>`).join('');
  tempadaEscollidaClas = actual?.id ?? (temporadas[0]?.id ?? null);
  if (tempadaEscollidaClas != null) sel.value = String(tempadaEscollidaClas);
}

function pintarClasificacion(){
  const d = datosClasificacion;
  const els = {
    feminina: { equipos: document.getElementById('clas-equipos-feminina'), chavistas: document.getElementById('clas-chavistas-feminina') },
    masculina: { equipos: document.getElementById('clas-equipos-masculina'), chavistas: document.getElementById('clas-chavistas-masculina') },
  };

  const partidosConResultado = d.partidos.filter(p => p.resultado_local != null && p.resultado_visitante != null);
  const idFem = d.categorias.find(c => c.nombre === 'femenina')?.id;
  const idMasc = d.categorias.find(c => c.nombre === 'masculina')?.id;
  const ligasTempada = d.ligas.filter(l => l.id_temporada === tempadaEscollidaClas);
  const ligasFem = new Set(ligasTempada.filter(l => l.id_categoria === idFem).map(l => l.id));
  const ligasMasc = new Set(ligasTempada.filter(l => l.id_categoria === idMasc).map(l => l.id));
  const xornFem = new Set(d.xornadas.filter(x => ligasFem.has(x.id_liga)).map(x => x.id));
  const xornMasc = new Set(d.xornadas.filter(x => ligasMasc.has(x.id_liga)).map(x => x.id));

  const partidosFem = partidosConResultado.filter(p => xornFem.has(p.id_jornada));
  const partidosMasc = partidosConResultado.filter(p => xornMasc.has(p.id_jornada));
  const clubsFem = d.clubs.filter(c => c.id_categoria === idFem);
  const clubsMasc = d.clubs.filter(c => c.id_categoria === idMasc);

  pintarClasEquipos(els.feminina.equipos, puntosPorEquipo(partidosFem, clubsFem));
  pintarClasEquipos(els.masculina.equipos, puntosPorEquipo(partidosMasc, clubsMasc));
  pintarClasChavistas(els.feminina.chavistas, chavesPorXogador(partidosFem, d.enfrentamentos, d.chaves, d.xogadores, d.clubs), 'Xogadora');
  pintarClasChavistas(els.masculina.chavistas, chavesPorXogador(partidosMasc, d.enfrentamentos, d.chaves, d.xogadores, d.clubs), 'Xogador');
}

async function cargarClasificacion(){
  const els = {
    feminina: { equipos: document.getElementById('clas-equipos-feminina'), chavistas: document.getElementById('clas-chavistas-feminina') },
    masculina: { equipos: document.getElementById('clas-equipos-masculina'), chavistas: document.getElementById('clas-chavistas-masculina') },
  };
  if (ERR_CONFIG_FE) {
    for (const l of Object.values(els)) l.equipos.innerHTML = l.chavistas.innerHTML = `<p class="erro">${escFe(ERR_CONFIG_FE)}</p>`;
    return;
  }
  try {
    const [
      { data: categorias, error: e1 }, { data: temporadas, error: e0 }, { data: ligas, error: e2 },
      { data: xornadas, error: e3 }, { data: partidos, error: e4 }, { data: clubs, error: e5 },
      { data: enfrentamentos, error: e6 }, { data: chaves, error: e7 }, { data: xogadores, error: e8 },
    ] = await Promise.all([
      sbfe.from('categorias').select('*'),
      sbfe.from('temporadas').select('*').order('fecha_inicio', { ascending: false }),
      sbfe.from('ligas').select('*'),
      sbfe.from('jornadas').select('*'),
      sbfe.from('partidos').select('*'),
      sbfe.from('clubs').select('*').eq('activo', true),
      sbfe.from('enfrentamientos').select('id,id_partido'),
      sbfe.from('chaves_enfrentamiento').select('*'),
      sbfe.from('jugadores').select('id,nombre,apellidos,id_club').eq('activo', true),
    ]);
    for (const err of [e0, e1, e2, e3, e4, e5, e6, e7, e8]) if (err) throw new Error(err.message);

    datosClasificacion = { categorias, temporadas, ligas, xornadas, partidos, clubs, enfrentamentos, chaves, xogadores };
    encherSelectorTempadasClas(temporadas);
    document.getElementById('tempada-clasificacion').addEventListener('change', ev => {
      tempadaEscollidaClas = Number(ev.target.value);
      pintarClasificacion();
    });
    pintarClasificacion();
  } catch (e) {
    const msg = `<p class="erro">Non se puido cargar a clasificación: ${escFe(e.message)}</p>`;
    for (const l of Object.values(els)) l.equipos.innerHTML = l.chavistas.innerHTML = msg;
  }
}

document.addEventListener('DOMContentLoaded', cargarClasificacion);
