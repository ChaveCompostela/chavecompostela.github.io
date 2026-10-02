// Marcador: cargar unha partida real (dun partido xa creado) para anotala, e enviar o
// resultado a "resultados_pendientes" para que se valide dende o panel de administración.
// Protexido por unha clave compartida (non é un login de usuario). Reutiliza
// cargarDatosPartidos/nomeXogadorP/nomeParellaP de partidosfe.js e tempadaActual de calendariofe.js.

let claveMarcador = null;
let datosCargaMarcador = null;
let partidaCargada = null;   // { idEnfrentamiento, xogadores: { a1,a2,b1,b2 } }

const $mk = sel => document.querySelector(sel);

// ---------- Botón "Cargar partido": pide a clave e, se é correcta, mostra os desplegables ----------
$mk('#mk-cargar').addEventListener('click', async () => {
  const clave = prompt('Contrasinal para anotar partidos:');
  if (!clave) return;
  try {
    const { data: ok, error } = await sbfe.rpc('comprobar_clave_marcador', { p_clave: clave });
    if (error) throw new Error(error.message);
    if (!ok) { alert('Contrasinal incorrecto.'); return; }
  } catch (e) {
    alert('Non se puido comprobar o contrasinal: ' + e.message);
    return;
  }
  claveMarcador = clave;
  await abrirPanelCarga();
});

async function abrirPanelCarga(){
  $mk('#mk-carga-panel').hidden = false;
  $mk('#mk-carga-msg').hidden = true;
  const selPartido = $mk('#mk-sel-partido');
  selPartido.innerHTML = '<option value="">Cargando…</option>';
  try {
    if (!datosCargaMarcador) datosCargaMarcador = await cargarDatosPartidos();
    const d = datosCargaMarcador;
    const tempada = tempadaActual(d.temporadas);
    const ligasTemp = d.ligas.filter(l => l.id_temporada === tempada?.id);
    const idsLigas = new Set(ligasTemp.map(l => l.id));
    const xornadas = d.xornadas.filter(x => idsLigas.has(x.id_liga));
    const idsXorn = new Set(xornadas.map(x => x.id));
    const nomeCat = idCat => d.categorias.find(c => c.id === idCat)?.nombre === 'femenina' ? 'Fem' : 'Masc';
    const catDaLiga = idLiga => d.ligas.find(l => l.id === idLiga)?.id_categoria;

    const partidos = d.partidos
      .filter(p => idsXorn.has(p.id_jornada))
      .sort((a, b) => (b.fecha_hora || '').localeCompare(a.fecha_hora || ''));

    if (!partidos.length) {
      selPartido.innerHTML = '<option value="">Non hai partidos nesta tempada</option>';
      return;
    }
    selPartido.innerHTML = '<option value="">— elixe un partido —</option>' + partidos.map(p => {
      const x = d.xornadas.find(j => j.id === p.id_jornada);
      const cat = nomeCat(catDaLiga(x?.id_liga));
      const data = p.fecha_hora ? ` · ${new Date(p.fecha_hora).toLocaleDateString('gl-ES')}` : '';
      return `<option value="${p.id}">X${x?.numero ?? '?'} (${cat}) · ${escFe(nomeClubP(d.clubs, p.id_club_local))} - ${escFe(nomeClubP(d.clubs, p.id_club_visitante))}${data}</option>`;
    }).join('');
  } catch (e) {
    selPartido.innerHTML = '<option value="">Erro ao cargar</option>';
    mostrarErroCarga('Non se puideron cargar os partidos: ' + e.message);
  }
}

function mostrarErroCarga(msg){
  const el = $mk('#mk-carga-msg');
  el.textContent = msg; el.hidden = false;
}

$mk('#mk-sel-partido').addEventListener('change', e => {
  const selPartida = $mk('#mk-sel-partida');
  const btn = $mk('#mk-carga-confirmar');
  const idPartido = Number(e.target.value);
  if (!idPartido) {
    selPartida.innerHTML = '<option value="">— elixe antes un partido —</option>';
    selPartida.disabled = true; btn.disabled = true;
    return;
  }
  const d = datosCargaMarcador;
  const partidas = d.enfrentamientos.filter(x => x.id_partido === idPartido).sort((a, b) => a.numero - b.numero);
  if (!partidas.length) {
    selPartida.innerHTML = '<option value="">Este partido aínda non ten partidas creadas</option>';
    selPartida.disabled = true; btn.disabled = true;
    return;
  }
  selPartida.innerHTML = '<option value="">— elixe unha partida —</option>' + partidas.map(e => {
    const eps = d.enfrentamiento_parejas.filter(x => x.id_enfrentamiento === e.id);
    const pL = eps.find(x => x.lado === 'local'), pV = eps.find(x => x.lado === 'visitante');
    const nomeL = pL ? nomeParellaP(pL.id_pareja, d) : 'Sen parella';
    const nomeV = pV ? nomeParellaP(pV.id_pareja, d) : 'Sen parella';
    return `<option value="${e.id}">Partida ${e.numero} — ${escFe(nomeL)} / ${escFe(nomeV)}</option>`;
  }).join('');
  selPartida.disabled = false;
});

$mk('#mk-sel-partida').addEventListener('change', e => {
  $mk('#mk-carga-confirmar').disabled = !e.target.value;
});

$mk('#mk-carga-cancelar').addEventListener('click', () => {
  $mk('#mk-carga-panel').hidden = true;
});

// ---------- Confirmar carga: rechea os equipos A/B coa partida real (sen poder editar nomes) ----------
$mk('#mk-carga-confirmar').addEventListener('click', () => {
  const idEnfrentamiento = Number($mk('#mk-sel-partida').value);
  if (!idEnfrentamiento) return;
  const d = datosCargaMarcador;
  const e = d.enfrentamientos.find(x => x.id === idEnfrentamiento);
  const partido = d.partidos.find(p => p.id === e.id_partido);
  const eps = d.enfrentamiento_parejas.filter(x => x.id_enfrentamiento === e.id);
  const pL = eps.find(x => x.lado === 'local'), pV = eps.find(x => x.lado === 'visitante');
  const parL = pL ? d.parejas.find(x => x.id === pL.id_pareja) : null;
  const parV = pV ? d.parejas.find(x => x.id === pV.id_pareja) : null;
  if (!parL || !parV) { mostrarErroCarga('Esta partida non ten as dúas parellas asignadas aínda.'); return; }

  // Chaves xa gardadas (se o panel de administración xa anotara algo antes)
  const chaveDe = id => d.chaves_enfrentamiento.find(c => c.id_enfrentamiento === e.id && c.id_jugador === id)?.chaves || 0;

  // Agocha os equipos C/D (e os botóns de engadilos): unha partida real son sempre 2 bandos
  ['mk-c', 'mk-d', 'mk-add-c', 'mk-add-d'].forEach(id => { const el = document.getElementById(id); if (el) el.hidden = true; });

  configurarEquipoCargado('mk-a', nomeClubP(d.clubs, partido.id_club_local), [parL.id_jugador_a, parL.id_jugador_b], d, chaveDe, e.marcador_local);
  configurarEquipoCargado('mk-b', nomeClubP(d.clubs, partido.id_club_visitante), [parV.id_jugador_a, parV.id_jugador_b], d, chaveDe, e.marcador_visitante);

  partidaCargada = { idEnfrentamiento };

  $mk('#mk-carga-panel').hidden = true;
  $mk('#mk-enviar-panel').hidden = false;
  $mk('#mk-enviar-info').textContent =
    `Anotando a Partida ${e.numero} de ${nomeClubP(d.clubs, partido.id_club_local)} - ${nomeClubP(d.clubs, partido.id_club_visitante)}.`;
});

function configurarEquipoCargado(idEquipo, nomeClub, idsXogadores, d, chaveDe, marcadorXaGardado){
  const eq = document.getElementById(idEquipo);
  const nomeInput = eq.querySelector('.marcador-nome');
  nomeInput.value = nomeClub; nomeInput.readOnly = true;
  eq.querySelector('.marcador-puntos').textContent = marcadorXaGardado != null ? marcadorXaGardado : 0;

  const filasXog = eq.querySelectorAll('.marcador-xog');
  idsXogadores.forEach((idXog, i) => {
    const fila = filasXog[i];
    if (!fila) return;
    const j = d.jugadores.find(x => x.id === idXog);
    const nome = j ? `${j.nombre} ${j.apellidos || ''}`.trim() : `Xogador #${idXog}`;
    const inputNome = fila.querySelector('.marcador-xog-nome');
    inputNome.value = nome; inputNome.readOnly = true;
    fila.dataset.idJugador = idXog;
    fila.querySelector('.marcador-chaves').textContent = chaveDe(idXog);
  });
}

// ---------- Enviar resultado ----------
$mk('#mk-enviar-confirmar').addEventListener('click', async () => {
  if (!partidaCargada) return;
  const chaves = [];
  ['mk-a', 'mk-b'].forEach(idEquipo => {
    document.getElementById(idEquipo).querySelectorAll('.marcador-xog[data-id-jugador]').forEach(fila => {
      chaves.push({
        id_jugador: Number(fila.dataset.idJugador),
        chaves: Number(fila.querySelector('.marcador-chaves').textContent) || 0,
      });
    });
  });
  const marcadorLocal = Number(document.querySelector('#mk-a .marcador-puntos').textContent) || 0;
  const marcadorVisitante = Number(document.querySelector('#mk-b .marcador-puntos').textContent) || 0;

  const btn = $mk('#mk-enviar-confirmar');
  btn.disabled = true; btn.textContent = 'Enviando…';
  try {
    const { error } = await sbfe.rpc('enviar_resultado_marcador', {
      p_id_enfrentamiento: partidaCargada.idEnfrentamiento,
      p_marcador_local: marcadorLocal,
      p_marcador_visitante: marcadorVisitante,
      p_chaves: chaves,
      p_clave: claveMarcador,
    });
    if (error) throw new Error(error.message);
    alert('Resultado enviado. Quedará pendente de validación no panel de administración.');
    rematarCargaPartida();
  } catch (e) {
    alert('Non se puido enviar: ' + e.message + '\n\nSe o contrasinal caducou, vólvese pedir ao premer "Cargar partido" de novo.');
    claveMarcador = null;
  } finally {
    btn.disabled = false; btn.textContent = 'Enviar resultado';
  }
});

$mk('#mk-enviar-cancelar').addEventListener('click', rematarCargaPartida);

// Volve ao modo libre: os 4 equipos quedan coma ao abrir a páxina (A e B editables e
// visibles, C e D ocultos e a cero), e péchase calquera panel de carga aberto.
function rematarCargaPartida(){
  ['mk-a', 'mk-b', 'mk-c', 'mk-d'].forEach((idEquipo, i) => {
    const eq = document.getElementById(idEquipo);
    if (!eq) return;
    const letra = 'ABCD'[i];
    const nomeInput = eq.querySelector('.marcador-nome');
    nomeInput.readOnly = false; nomeInput.value = 'Equipo ' + letra;
    eq.querySelector('.marcador-puntos').textContent = '0';
    eq.querySelectorAll('.marcador-xog').forEach((fila, j) => {
      delete fila.dataset.idJugador;
      const inputNome = fila.querySelector('.marcador-xog-nome');
      inputNome.readOnly = false; inputNome.value = `Xogador/a ${letra}${j + 1}`;
      fila.querySelector('.marcador-chaves').textContent = '0';
    });
  });
  // C e D sempre ocultos ao reiniciar; os seus botóns de "+ Engadir" volven estar dispoñibles.
  ['mk-c', 'mk-d'].forEach(id => { const el = document.getElementById(id); if (el) el.hidden = true; });
  ['mk-add-c', 'mk-add-d'].forEach(id => { const el = document.getElementById(id); if (el) el.hidden = false; });

  partidaCargada = null;
  $mk('#mk-carga-panel').hidden = true;
  $mk('#mk-enviar-panel').hidden = true;
  if (typeof actualizarLideres === 'function') actualizarLideres();
}

// "Salir": se estabamos a cargar ou anotando unha partida real, sae dese modo e volve
// aos marcadores libres; se xa estabamos en modo libre, simplemente reinicia a páxina
// (os 4 equipos, non só os puntos) ao seu estado inicial.
$mk('#mk-salir').addEventListener('click', rematarCargaPartida);
