// Clasificación: puntos por equipo e máximos/máximas chavistas, só coa tempada en curso.
// Un partido cóntase como xogado cando ten resultado (resultado_local/resultado_visitante
// non nulos), igual có Calendario — non depende de que alguén cambie á man o Estado a "finalizado".
// Reutiliza escFe e tempadaActual (de novasfe.js/calendariofe.js). Só lectura.
//
// Puntos: en cada partido, cada equipo suma tantos puntos coma partidas gañou nel.
// Un partido finalizado 3-1 reparte 3 puntos ao que gañou 3 partidas e 1 ao que gañou 1.
//
// Orde da clasificación: 1.º puntos totais · 2.º se empatan a puntos, o +/- acumulado
// (diferenza entre os puntos anotados e recibidos nas partidas de cada partido, sumada partido a partido:
// un +20 e despois un -10 deixan un +10) · 3.º se seguen empatados, orde alfabética.

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

// Puntos por "equipo": un club rexistrado, ou, se un bando non ten club, a parella que
// o representa (coma "Laura&Carlota"), usando o seu id de parella coma clave estable para
// que sume sempre na mesma fila aínda que xogue varios partidos. Os clubs da liga aparecen
// sempre, aínda con 0 puntos; as parellas sen club só aparecen se xa puntuaron algo.
// Ademais dos puntos vaise acumulando o +/- de cada equipo (desempate): en cada partido, a suma
// de (marcador propio - marcador rival) das súas partidas xogadas.
function puntosPorEquipo(partidosLiga, clubsLiga, datos){
  const puntos = {}, difs = {}, nomes = {};
  for (const c of clubsLiga) { puntos['c' + c.id] = 0; difs['c' + c.id] = 0; nomes['c' + c.id] = c.nombre; }

  const claveLado = (p, lado) => {
    const idClub = lado === 'local' ? p.id_club_local : p.id_club_visitante;
    if (idClub) return 'c' + idClub;
    const pa = parellaRepresentativa(p, lado, datos);
    return pa ? 'p' + pa.id : null;
  };

  // +/- do partido visto desde o bando local (o visitante leva o mesmo número co signo cambiado)
  const difLocal = p => (datos.enfrentamentos || [])
    .filter(e => e.id_partido === p.id && e.marcador_local != null && e.marcador_visitante != null)
    .reduce((s, e) => s + (e.marcador_local - e.marcador_visitante), 0);

  for (const p of partidosLiga) {
    const dif = difLocal(p);
    const kLocal = claveLado(p, 'local');
    if (kLocal) {
      puntos[kLocal] = (puntos[kLocal] || 0) + p.resultado_local;
      difs[kLocal] = (difs[kLocal] || 0) + dif;
      if (!(kLocal in nomes)) nomes[kLocal] = nomeLadoPartido(p, 'local', datos);
    }
    const kVisit = claveLado(p, 'visitante');
    if (kVisit) {
      puntos[kVisit] = (puntos[kVisit] || 0) + p.resultado_visitante;
      difs[kVisit] = (difs[kVisit] || 0) - dif;
      if (!(kVisit in nomes)) nomes[kVisit] = nomeLadoPartido(p, 'visitante', datos);
    }
  }

  return Object.keys(puntos)
    .map(k => ({ nome: nomes[k], puntos: puntos[k], dif: difs[k] || 0 }))
    .sort((a, b) => b.puntos - a.puntos || b.dif - a.dif || a.nome.localeCompare(b.nome));
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

  pintarClasEquipos(els.feminina.equipos, puntosPorEquipo(partidosFem, clubsFem, d));
  pintarClasEquipos(els.masculina.equipos, puntosPorEquipo(partidosMasc, clubsMasc, d));
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
      { data: enfrentamentos, error: e6 }, { data: chaves, error: e7 }, { data: xogadoresActivos, error: e8 },
      { data: enfrentamiento_parejas, error: e9 }, { data: parejas, error: e10 }, { data: todosXogadores, error: e11 },
    ] = await Promise.all([
      sbfe.from('categorias').select('*'),
      sbfe.from('temporadas').select('*').order('fecha_inicio', { ascending: false }),
      sbfe.from('ligas').select('*'),
      sbfe.from('jornadas').select('*'),
      sbfe.from('partidos').select('*'),
      sbfe.from('clubs').select('*').eq('activo', true),
      sbfe.from('enfrentamientos').select('id,id_partido,numero,marcador_local,marcador_visitante'),   // os marcadores serven para o +/- do desempate
      sbfe.from('chaves_enfrentamiento').select('*'),
      sbfe.from('jugadores').select('id,nombre,apellidos,id_club').eq('activo', true),
      sbfe.from('enfrentamiento_parejas').select('*'),
      sbfe.from('parejas').select('*'),
      sbfe.from('jugadores').select('id,nombre'),
    ]);
    for (const err of [e0, e1, e2, e3, e4, e5, e6, e7, e8, e9, e10, e11]) if (err) throw new Error(err.message);

    // xogadores: a lista completa (todosXogadores) fai falta para nomear as parellas sen club
    // aínda que algún dos seus membros estivese dado de baixa; a lista de activos (xogadores)
    // séguese a usar para os máximos chavistas, coma antes.
    datosClasificacion = {
      categorias, temporadas, ligas, xornadas, partidos, clubs, enfrentamentos, chaves,
      xogadores: xogadoresActivos, enfrentamiento_parejas, parejas, jugadores: todosXogadores,
    };
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

CARGAS_PENDIENTES.clasificacion = cargarClasificacion;   // cárgase a primeira vez que se entra (ver novasfe.js)
