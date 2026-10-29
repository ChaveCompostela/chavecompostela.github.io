// Marcador: cargar unha partida real (dun partido xa creado) para anotala, e enviar o
// resultado a "resultados_pendientes" para que se valide dende o panel de administración.
// Protexido por unha clave compartida (non é un login de usuario). Reutiliza
// cargarDatosPartidos/nomeXogadorP/nomeParellaP de partidosfe.js e tempadaActual de calendariofe.js.

let claveMarcador = null;
let datosCargaMarcador = null;
let partidaCargada = null;   // { idEnfrentamiento, xogadores: { a1,a2,b1,b2 } }

const $mk = sel => document.querySelector(sel);

// Que se ve en cada paso do Marcador cando se carga unha partida:
//  libre → marcadores normais · clave → só o contrasinal · carga → só os desplegables de partido e partida ·
//  modo → só os 3 botóns (Anotar partida / en directo / Deixar de anotar) · anotar → marcador + Enviar resultado / Editar acta
function mkVista(estado){
  const v = $mk('#vista-marcador');
  v.classList.toggle('mk-ocultar-campo', estado !== 'libre' && estado !== 'anotar');
  $mk('#mk-clave-panel').hidden = estado !== 'clave';
  $mk('#mk-carga-panel').hidden = estado !== 'carga';
  $mk('#mk-enviar-panel').hidden = estado !== 'modo';
  $mk('#mk-acciones').hidden = estado !== 'anotar';
  if (estado !== 'anotar') $mk('#mk-acta-panel').hidden = true;
  $mk('#mk-cargar').hidden = estado !== 'libre';
  const marcadorVisible = estado === 'libre' || estado === 'anotar';
  $mk('#mk-full').hidden = !marcadorVisible;      // pantalla completa e reiniciar só con marcador visible
  $mk('#mk-reset').hidden = !marcadorVisible;
}
ACTA_IDIOMA = 'gl';   // os mensaxes da acta (actapdf.js) saen en galego

// Mensaxes de erro do servidor (a base de datos devólveos en castelán)
const erroGl = m => String(m)
  .replace('Clave incorrecta', 'Contrasinal incorrecto')
  .replace('No hay un resultado pendiente para esa partida', 'Non hai un resultado pendente para esa partida');

// ---------- Botón "Cargar partido": pide a clave (en asteriscos) e, se é correcta, mostra os desplegables ----------
$mk('#mk-cargar').addEventListener('click', () => {
  $mk('#mk-clave-input').value = '';
  $mk('#mk-clave-msg').hidden = true;
  mkVista('clave');                         // desaparece o marcador: só se pide o contrasinal
  $mk('#mk-clave-input').focus();
});

$mk('#mk-clave-cancelar').addEventListener('click', () => mkVista('libre'));

$mk('#mk-clave-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') $mk('#mk-clave-aceptar').click();
});

$mk('#mk-clave-aceptar').addEventListener('click', async () => {
  const clave = $mk('#mk-clave-input').value.trim();
  const msg = $mk('#mk-clave-msg');
  if (!clave) { msg.textContent = 'Escribe o contrasinal.'; msg.hidden = false; return; }

  const boton = $mk('#mk-clave-aceptar');
  boton.disabled = true;
  try {
    const { data: ok, error } = await sbfe.rpc('comprobar_clave_marcador', { p_clave: clave });
    if (error) throw new Error(error.message);
    if (!ok) { msg.textContent = 'Contrasinal incorrecto.'; msg.hidden = false; return; }
  } catch (e) {
    msg.textContent = 'Non se puido comprobar o contrasinal: ' + e.message;
    msg.hidden = false;
    return;
  } finally {
    boton.disabled = false;
  }

  claveMarcador = clave;
  mkVista('carga');
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

    // Só os partidos da tempada en curso con DATA de xogo, con partidas creadas e que non estean
    // finalizados nin suspendidos (os que non teñen data non aparecen).
    const idsConPartidas = new Set(d.enfrentamientos.map(e => e.id_partido));
    const partidos = d.partidos
      .filter(p => p.fecha_hora && idsXorn.has(p.id_jornada) && p.estado !== 'finalizado' && p.estado !== 'suspendido' && idsConPartidas.has(p.id))
      .sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora));

    if (!partidos.length) {
      selPartido.innerHTML = '<option value="">Non hai partidos con data e partidas pendentes de xogar</option>';
      return;
    }
    selPartido.innerHTML = '<option value="">— elixe un partido —</option>' + partidos.map(p => {
      const x = d.xornadas.find(j => j.id === p.id_jornada);
      const cat = nomeCat(catDaLiga(x?.id_liga));
      const data = p.fecha_hora ? ` · ${new Date(p.fecha_hora).toLocaleDateString('gl-ES')}` : '';
      return `<option value="${p.id}">X${x?.numero ?? '?'} (${cat}) · ${escFe(nomeLadoPartido(p, 'local', d))} - ${escFe(nomeLadoPartido(p, 'visitante', d))}${data}</option>`;
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

$mk('#mk-carga-cancelar').addEventListener('click', () => mkVista('libre'));

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
  // Nome do bando: o club, se o ten; se non, o nome desta parella concreta xa cargada
  // (máis preciso aquí có xenérico nomeLadoPartido, porque xa sabemos exactamente quen xoga).
  const nomeBando = (idClub, pareja) => idClub ? nomeClubCal(d.clubs, idClub) : (nomeParellaCurta(pareja.id, d) || 'Sen equipo');
  const nomeLocalCargado = nomeBando(partido.id_club_local, parL);
  const nomeVisitanteCargado = nomeBando(partido.id_club_visitante, parV);

  // Agocha os equipos C/D (e os botóns de engadilos): unha partida real son sempre 2 bandos
  ['mk-c', 'mk-d', 'mk-add-c', 'mk-add-d'].forEach(id => { const el = document.getElementById(id); if (el) el.hidden = true; });

  configurarEquipoCargado('mk-a', nomeLocalCargado, [parL.id_jugador_a, parL.id_jugador_b], d, chaveDe, e.marcador_local);
  configurarEquipoCargado('mk-b', nomeVisitanteCargado, [parV.id_jugador_a, parV.id_jugador_b], d, chaveDe, e.marcador_visitante);

  partidaCargada = {
    idEnfrentamiento, idPartido: partido.id, numero: e.numero,
    nomeLocal: nomeLocalCargado, nomeVisitante: nomeVisitanteCargado,
    xog: { a1: parL.id_jugador_a, a2: parL.id_jugador_b, b1: parV.id_jugador_a, b2: parV.id_jugador_b },
  };

  mkVista('modo');
  $mk('#mk-enviar-info').textContent =
    `Partida ${e.numero} de ${nomeLocalCargado} - ${nomeVisitanteCargado}. Como a queres anotar?`;
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
// Envía o resultado e as chaves de cada xogador (e, con conActa, tamén as tiradas da acta).
// Devolve { ok, avisoActa }; se falla, amosa o erro e devolve { ok: false }.
async function enviarResultadoMarcador(conActa){
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
  try {
    const { error } = await sbfe.rpc('enviar_resultado_marcador', {
      p_id_enfrentamiento: partidaCargada.idEnfrentamiento,
      p_marcador_local: marcadorLocal,
      p_marcador_visitante: marcadorVisitante,
      p_chaves: chaves,
      p_clave: claveMarcador,
    });
    if (error) throw new Error(error.message);
    let avisoActa = '';
    if (conActa) {
      // Tiradas da acta (se falla, o resultado xa está enviado e pódense engadir despois dende o panel)
      try {
        actaLeerPanelSeAberto();
        const tiradasChaves = {};
        const der = actaDerivar();
        Object.entries(partidaCargada.xog).forEach(([k, id]) => { tiradasChaves[String(id)] = actaChavesTexto(der.chaves[k]); });
        const { error: errActa } = await sbfe.rpc('enviar_acta_marcador', {
          p_id_enfrentamiento: partidaCargada.idEnfrentamiento,
          p_puntos_local: der.puntos.a.join('+'),
          p_puntos_visitante: der.puntos.b.join('+'),
          p_tiradas_chaves: tiradasChaves,
          p_clave: claveMarcador,
        });
        if (errActa) throw new Error(errActa.message);
      } catch (errActa) {
        avisoActa = '\n\nAtención: as tiradas da acta non se puideron gardar (' + erroGl(errActa.message) + '). Pódense escribir despois no panel de administración.';
      }
    }
    return { ok: true, avisoActa };
  } catch (e) {
    alert('Non se puido enviar: ' + erroGl(e.message) + '\n\nSe o contrasinal caducou, vólvese pedir ao premer "Cargar partido" de novo.');
    claveMarcador = null;
    return { ok: false };
  }
}

// Se a partida xa tiña tiradas gardadas (p. ex. de antes), retómanse para a acta
function precargarActa(){
  const d = datosCargaMarcador;
  const e = d.enfrentamientos.find(x => x.id === partidaCargada.idEnfrentamiento);
  actaReiniciar();
  try {
    const ch = {};
    Object.entries(partidaCargada.xog).forEach(([k, id]) => {
      const c = d.chaves_enfrentamiento.find(z => z.id_enfrentamiento === e.id && z.id_jugador === id);
      ch[k] = actaParseChaves(c?.tiradas);
    });
    actaFixar(actaParseSecuencia(e.puntos_tiradas_local), actaParseSecuencia(e.puntos_tiradas_visitante), ch);
  } catch (err) { actaReiniciar(); }
}

// Anotar partida (manual: puntos e chaves finais editables directamente ou cos botóns) ou en directo (marcador intelixente)
function iniciarModo(modo){
  precargarActa();
  ACTA.activa = modo === 'directo';
  const editable = modo === 'manual';
  ['mk-a', 'mk-b'].forEach(id => document.getElementById(id).querySelectorAll('.marcador-puntos, .marcador-chaves').forEach(el => {
    if (editable) { el.setAttribute('contenteditable', 'true'); el.setAttribute('inputmode', 'numeric'); el.setAttribute('enterkeyhint', 'done'); }
    else { el.removeAttribute('contenteditable'); el.removeAttribute('inputmode'); el.removeAttribute('enterkeyhint'); }
  }));
  $mk('#vista-marcador').classList.toggle('mk-editable', editable);
  $mk('#vista-marcador').classList.toggle('mk-directo', modo === 'directo');   // en directo só hai +1/+2/−1/−2: os 8, 9 e 16 saen das chaves
  mkVista('anotar');
  if (modo === 'directo') precargarSonsChave();   // sons das chaves (icons/chave*.wav), listos para o primeiro toque
  actaPintarTirada();                    // barra «Tirada N · pecha en X s» (só en directo) e bloqueo de botóns
  if (typeof actualizarLideres === 'function') actualizarLideres();
}
$mk('#mk-modo-manual').addEventListener('click', () => iniciarModo('manual'));
$mk('#mk-modo-directo').addEventListener('click', () => iniciarModo('directo'));

// «Enviar resultado»: envía o resultado con todos os datos da partida (puntos, chaves e tiradas da acta) e sae ao marcador
$mk('#mk-enviar-confirmar').addEventListener('click', async () => {
  if (!partidaCargada) return;
  if (ACTA.activa && !(await actaCerrarTirada())) { alert('Corrixe a tirada aberta e volve premer «Enviar resultado».'); return; }
  if (puntosDe('a') + puntosDe('b') === 0 && !confirm('O marcador está a 0-0. Enviar o resultado igualmente?')) return;
  const btn = $mk('#mk-enviar-confirmar');
  btn.disabled = true; btn.textContent = 'Enviando…';
  const r = await enviarResultadoMarcador(true);
  btn.disabled = false; btn.textContent = 'Enviar resultado';
  if (!r.ok) return;
  alert('Resultado enviado. Quedará pendente de validación no panel de administración.' + r.avisoActa);
  rematarCargaPartida();
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
  ACTA.activa = false;
  actaReiniciar();
  document.querySelectorAll('#vista-marcador [contenteditable]').forEach(el => { el.removeAttribute('contenteditable'); el.removeAttribute('inputmode'); el.removeAttribute('enterkeyhint'); });
  $mk('#vista-marcador').classList.remove('mk-editable');
  $mk('#vista-marcador').classList.remove('mk-directo');
  $mk('#ak-inc-area').value = ''; $mk('#ak-inc-texto').hidden = true;
  mkVista('libre');
  if (typeof actualizarLideres === 'function') actualizarLideres();
}

// "Salir": se estabamos a cargar ou anotando unha partida real, sae dese modo e volve
// aos marcadores libres; se xa estabamos en modo libre, simplemente reinicia a páxina
// (os 4 equipos, non só os puntos) ao seu estado inicial.
$mk('#mk-salir').addEventListener('click', rematarCargaPartida);

// ---------- Acta: panel de tiradas (editable) y PDF ----------
const CLAVES_XOG = ['a1', 'a2', 'b1', 'b2'];
const puntosDe = k => Number(document.querySelector(`#mk-${k} .marcador-puntos`).textContent) || 0;
const chavesDe = k => Number(document.querySelector(`#mk-${k[0]} .marcador-xog:nth-of-type(${k[1]}) .marcador-chaves`)?.textContent) || 0;

function nomeXogActa(k){ return nomeXogadorP(partidaCargada.xog[k], datosCargaMarcador); }

// Despois de reiniciar o marcador: o panel da acta (se está aberto) amosa as tiradas baleiras e bórranse as incidencias escritas
function actaPanelReiniciado(){
  $mk('#ak-inc-area').value = '';
  $mk('#ak-inc-texto').hidden = true;
  if (partidaCargada && !$mk('#mk-acta-panel').hidden) actaAbrirPanel();
}

let actaPanelSucio = false;     // true se se escribiu algo nos campos do panel (non se pisan ao refrescar)
// O marcador cambiou: se o panel da acta está aberto, reflíctese (e revísase) ao momento
function actaPanelActualizar(){
  if (!partidaCargada || $mk('#mk-acta-panel').hidden) return;
  if (!actaPanelSucio) actaAbrirPanel(); else actaRevisarPanel();
}

function actaAbrirPanel(){
  if (!partidaCargada) return;
  actaPanelSucio = false;
  $mk('#ak-nl').textContent = '· ' + partidaCargada.nomeLocal;
  $mk('#ak-nv').textContent = '· ' + partidaCargada.nomeVisitante;
  const der = actaDerivar(), pd = der.puntos;
  $mk('#ak-pl').value = pd.a.join('+');
  $mk('#ak-pv').value = pd.b.join('+');
  $mk('#ak-chaves').innerHTML = CLAVES_XOG.map(k =>
    `<label>Chaves · ${escFe(nomeXogActa(k))}<input id="ak-ch-${k}" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="1@3+2@7" value="${escFe(actaChavesTexto(der.chaves[k]))}"></label>`).join('');
  $mk('#mk-acta-panel').hidden = false;
  actaRevisarPanel();
}

// Pasa o que hai nos campos do panel ás tiradas rexistradas (lanza erro se o formato non vale)
function actaLeerPanel(){
  const pl = actaParseSecuencia($mk('#ak-pl').value), pv = actaParseSecuencia($mk('#ak-pv').value);
  const ch = {};
  CLAVES_XOG.forEach(k => { ch[k] = actaParseChaves($mk('#ak-ch-' + k).value); });
  actaFixar(pl, pv, ch);
}
function actaLeerPanelSeAberto(){ if (!$mk('#mk-acta-panel').hidden) actaLeerPanel(); }

// Compara as tiradas cos puntos e as chaves que marca o marcador
function actaRevisarPanel(){
  const av = $mk('#ak-aviso');
  let pl, pv, ch = {};
  try {
    pl = actaParseSecuencia($mk('#ak-pl').value); pv = actaParseSecuencia($mk('#ak-pv').value);
    CLAVES_XOG.forEach(k => { ch[k] = actaParseChaves($mk('#ak-ch-' + k).value); });
  } catch (err) { av.textContent = err.message; av.classList.remove('ok'); av.hidden = false; return false; }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const hayChaves = CLAVES_XOG.some(k => ch[k].length);
  if (!pl.length && !pv.length && !hayChaves) {      // sen detalle de tiradas: na acta irán só os totais
    av.classList.add('ok');
    av.textContent = 'Sen detalle de tiradas: na acta irán só os totais de puntos e de chaves do marcador.';
    av.hidden = false;
    return true;
  }
  const dif = (pl.length && pv.length ? actaRevisarTiradas(pl, pv).map(cap) : []).concat(actaRevisarCoherencia(pl, pv, ch).map(cap));
  if (pl.length && actaSuma(pl) !== puntosDe('a')) dif.push(`Puntos local: as tiradas suman ${actaSuma(pl)} e o marcador é ${puntosDe('a')}`);
  if (pv.length && actaSuma(pv) !== puntosDe('b')) dif.push(`Puntos visitante: as tiradas suman ${actaSuma(pv)} e o marcador é ${puntosDe('b')}`);
  CLAVES_XOG.forEach(k => { if (ch[k].length && actaSumaChaves(ch[k]) !== chavesDe(k)) dif.push(`Chaves de ${nomeXogActa(k)}: as tiradas suman ${actaSumaChaves(ch[k])} e o marcador é ${chavesDe(k)}`); });
  av.classList.toggle('ok', !dif.length);
  av.textContent = dif.length ? 'Non cadra: ' + dif.join(' · ') : 'As tiradas cadran cos puntos e coas chaves ✓';
  av.hidden = false;
  return !dif.length;
}

// O botón «Acta» alterna: se o panel está pechado ábrese (pechando antes a tirada aberta) e se está aberto péchase
$mk('#mk-acta-abrir').addEventListener('click', async () => {
  if (!partidaCargada) return;
  if (!$mk('#mk-acta-panel').hidden) { actaPecharPanel(); return; }
  if (!(await actaCerrarTirada())) return;      // se hai que corrixir a tirada, queda aberta
  actaAbrirPanel();
});
$mk('#mk-tirada-cerrar').addEventListener('click', () => { actaCerrarTirada(); });
function actaPecharPanel(){
  try { actaLeerPanel(); } catch (err) { if (!confirm(err.message + '\n\nPechar igualmente sen gardar os cambios das tiradas?')) return; }
  $mk('#mk-acta-panel').hidden = true;
}
$mk('#ak-pechar').addEventListener('click', actaPecharPanel);
['#ak-pl', '#ak-pv'].forEach(s => $mk(s).addEventListener('input', () => { actaPanelSucio = true; actaRevisarPanel(); }));
$mk('#ak-chaves').addEventListener('input', () => { actaPanelSucio = true; actaRevisarPanel(); });

function fechaActaMk(p){
  if (!p.fecha_hora) return '';
  const d = new Date(p.fecha_hora), z = n => String(n).padStart(2, '0');
  const f = `${z(d.getDate())}/${z(d.getMonth() + 1)}/${d.getFullYear()}`;
  return p.sin_hora ? f : `${f} ${z(d.getHours())}:${z(d.getMinutes())}`;
}

function actaCategoriaMk(){
  const d = datosCargaMarcador;
  const partido = d.partidos.find(p => p.id === partidaCargada.idPartido);
  const xorn = d.xornadas.find(j => j.id === partido.id_jornada);
  const liga = d.ligas.find(l => l.id === xorn?.id_liga);
  return d.categorias.find(c => c.id === liga?.id_categoria)?.nombre;
}

// Botón «Incidencias»: amosa / agocha o cadro de texto (o que se escriba vai na acta)
$mk('#ak-inc-btn').addEventListener('click', () => {
  const caixa = $mk('#ak-inc-texto');
  caixa.hidden = !caixa.hidden;
  if (!caixa.hidden) $mk('#ak-inc-area').focus();
});

// «Xerar acta (PDF)»: comproba as tiradas e abre directamente o panel de firmas
$mk('#ak-pdf').addEventListener('click', () => {
  if (!partidaCargada) return;
  try { actaLeerPanel(); } catch (err) { alert(err.message); return; }
  if (!actaRevisarPanel() && !confirm('As tiradas non cadran. Seguir igualmente coa acta?')) return;
  xerarActaMarcador($mk('#ak-inc-area').value);
});

// ---- Datos da acta ----
// Liga masculina: o encontro ten 4 partidas que poden acabar en calquera orde. A acta leva as xogadas: a que está
// cargada (en directo), as enviadas e pendentes de validar (función leer_pendientes_partido) e as xa validadas.
const PARTIDAS_MASC = 4;

async function leerPendientesPartido(idPartido){
  try {
    const { data, error } = await sbfe.rpc('leer_pendientes_partido', { p_id_partido: idPartido, p_clave: claveMarcador });
    if (error) throw new Error(error.message);
    const por = {};
    (data || []).forEach(r => { por[r.r_id_enfrentamiento] = r; });
    return por;
  } catch (e) { return {}; }            // sen a función (aínda non instalada) só se usan as partidas validadas
}

function xogadoresDaPartida(e, d){
  const par = lado => { const x = d.enfrentamiento_parejas.find(y => y.id_enfrentamiento === e.id && y.lado === lado); return x ? d.parejas.find(y => y.id === x.id_pareja) : null; };
  const pl = par('local'), pv = par('visitante');
  return [pl?.id_jugador_a, pl?.id_jugador_b, pv?.id_jugador_a, pv?.id_jugador_b];
}

async function datosActaMasculina(partido, incidencias){
  const d = datosCargaMarcador;
  const pend = await leerPendientesPartido(partido.id);
  const nome = id => (id ? nomeXogadorP(id, d) : '');
  const der = actaDerivar();
  const partidas = [];
  d.enfrentamientos.filter(x => x.id_partido === partido.id).sort((a, b) => a.numero - b.numero).forEach(e => {
    const ids = xogadoresDaPartida(e, d);
    const p = { numero: e.numero, jugadoresLocal: [nome(ids[0]), nome(ids[1])], jugadoresVisit: [nome(ids[2]), nome(ids[3])] };
    if (e.id === partidaCargada.idEnfrentamiento) {                       // en directo
      if (!partidaActualXogada()) return;
      Object.assign(p, {
        puntosLocal: puntosDe('a'), puntosVisit: puntosDe('b'),
        tiradasLocal: der.puntos.a.join('+'), tiradasVisit: der.puntos.b.join('+'),
        chaves: CLAVES_XOG.map(k => ({ total: chavesDe(k), tiradas: actaChavesTexto(der.chaves[k]) })),
      });
    } else if (pend[e.id]) {                                              // enviada, pendente de validar
      const r = pend[e.id], porId = id => (r.r_chaves || []).find(c => c.id_jugador === id) || {};
      Object.assign(p, {
        puntosLocal: r.r_marcador_local, puntosVisit: r.r_marcador_visitante,
        tiradasLocal: r.r_puntos_tiradas_local || '', tiradasVisit: r.r_puntos_tiradas_visitante || '',
        chaves: ids.map(id => ({ total: porId(id).chaves || 0, tiradas: porId(id).tiradas || '' })),
      });
    } else if (e.marcador_local != null && e.marcador_visitante != null) {  // xa validada
      Object.assign(p, {
        puntosLocal: e.marcador_local, puntosVisit: e.marcador_visitante,
        tiradasLocal: e.puntos_tiradas_local || '', tiradasVisit: e.puntos_tiradas_visitante || '',
        chaves: ids.map(id => { const c = d.chaves_enfrentamiento.find(z => z.id_enfrentamiento === e.id && z.id_jugador === id); return { total: c ? c.chaves : 0, tiradas: c?.tiradas || '' }; }),
      });
    } else return;                                                        // sen xogar: queda en branco
    partidas.push(p);
  });
  return {
    liga: 'masculina',
    fecha: fechaActaMk(partido),
    campo: d.instalaciones?.find(i => i.id === partido.id_instalacion)?.nombre || '',
    local: partidaCargada.nomeLocal, visitante: partidaCargada.nomeVisitante,
    totalLocal: partidas.length ? partidas.reduce((s, p) => s + (p.puntosLocal || 0), 0) : null,
    totalVisit: partidas.length ? partidas.reduce((s, p) => s + (p.puntosVisit || 0), 0) : null,
    incidencias: String(incidencias || '').trim(),
    nombreArchivo: actaNombreArchivo(partidaCargada.nomeLocal, partidaCargada.nomeVisitante, partido.fecha_hora ? String(partido.fecha_hora).slice(0, 10) : ''),
    partidas,
  };
}

// A partida cargada conta como xogada se ten puntos ou tiradas
function partidaActualXogada(){
  const der = actaDerivar();
  return puntosDe('a') + puntosDe('b') > 0 || der.puntos.a.some(v => v > 0) || der.puntos.b.some(v => v > 0);
}

function datosActaFeminina(partido, incidencias){
  const d = datosCargaMarcador;
  const e = d.enfrentamientos.find(x => x.id === partidaCargada.idEnfrentamiento);
  const ptsL = puntosDe('a'), ptsV = puntosDe('b');
  const outras = d.enfrentamientos.filter(x => x.id_partido === partido.id && x.id !== e.id && x.marcador_local != null && x.marcador_visitante != null);
  const der = actaDerivar(), pd = der.puntos;
  return {
    fecha: fechaActaMk(partido),
    campo: d.instalaciones?.find(i => i.id === partido.id_instalacion)?.nombre || '',
    local: partidaCargada.nomeLocal, visitante: partidaCargada.nomeVisitante,
    totalLocal: outras.reduce((s, x) => s + x.marcador_local, ptsL),
    totalVisit: outras.reduce((s, x) => s + x.marcador_visitante, ptsV),
    incidencias: String(incidencias || '').trim(),
    nombreArchivo: actaNombreArchivo(partidaCargada.nomeLocal, partidaCargada.nomeVisitante, partido.fecha_hora ? String(partido.fecha_hora).slice(0, 10) : ''),
    partidas: [{
      numero: e.numero,
      jugadoresLocal: [nomeXogActa('a1'), nomeXogActa('a2')],
      jugadoresVisit: [nomeXogActa('b1'), nomeXogActa('b2')],
      puntosLocal: ptsL, puntosVisit: ptsV,
      tiradasLocal: pd.a.join('+'), tiradasVisit: pd.b.join('+'),
      chaves: CLAVES_XOG.map(k => ({ total: chavesDe(k), tiradas: actaChavesTexto(der.chaves[k]) })),
    }],
  };
}

// 2.º paso: xerar o PDF (cos puntos, as chaves e, se as houbo, as incidencias)
async function xerarActaMarcador(incidencias){
  const partido = datosCargaMarcador.partidos.find(p => p.id === partidaCargada.idPartido);
  const masc = actaCategoriaMk() === 'masculina';
  const btnPdf = $mk('#ak-pdf');
  btnPdf.disabled = true;
  let datos;
  try { datos = masc ? await datosActaMasculina(partido, incidencias) : datosActaFeminina(partido, incidencias); }
  finally { btnPdf.disabled = false; }

  // Aviso se non se xogaron todas as partidas do encontro (a acta xérase coas xogadas)
  const total = masc ? PARTIDAS_MASC : Math.max(1, datosCargaMarcador.enfrentamientos.filter(x => x.id_partido === partido.id).length);
  const xogadas = masc ? datos.partidas.length : (partidaActualXogada() ? 1 : 0);
  if (xogadas < total) {
    const op = await actaOpciones('Acta con partidas sen xogar',
      `Vaise xerar a acta con ${xogadas} ${xogadas === 1 ? 'partida' : 'partidas'} de ${total} xogadas.`, ['Continuar', 'Cancelar']);
    if (op !== 0) return;
  }

  // Panel de firmas (dous recuadros):
  //  · «Enviar resultado e xerar acta»: envía o resultado con todos os datos, xera a acta, móstraa para gardala e remata;
  //  · «Xerar acta»: xera a acta e móstraa para gardala, pero queda no marcador;
  //  · «Cancelar»: volve ao marcador para revisar ou corrixir.
  const f = await actaPedirFirmas('gl', true);
  if (!f || f.accion === 'cancelar') return;
  datos.firmas = { local: f.local, visitante: f.visitante };
  btnPdf.disabled = true;
  try {
    let aviso = '';
    if (f.accion === 'enviar') {
      const r = await enviarResultadoMarcador(true);
      if (!r.ok) return;                              // se falla o envío, non se xera nin se remata
      aviso = r.avisoActa;
    }
    try { await generarActaPdf(datos); }
    catch (err) { alert('Non se puido xerar a acta: ' + err.message); }
    if (f.accion === 'enviar') {
      alert('Resultado enviado. Quedará pendente de validación no panel de administración.' + aviso);
      rematarCargaPartida();
    }
  } finally { btnPdf.disabled = false; }
}

// ---- Anotar partida (manual): puntos e chaves finais editables directamente (tamén valen os botóns) ----
$mk('#vista-marcador').addEventListener('input', e => {
  const el = e.target.closest && e.target.closest('.marcador-puntos[contenteditable], .marcador-chaves[contenteditable]');
  if (!el) return;
  const limpio = el.textContent.replace(/\D/g, '').slice(0, 3);
  if (limpio !== el.textContent) {
    el.textContent = limpio;
    const r = document.createRange(); r.selectNodeContents(el); r.collapse(false);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  if (typeof actualizarLideres === 'function') actualizarLideres();
  actaPanelActualizar();
});
$mk('#vista-marcador').addEventListener('focusout', e => {
  const el = e.target.closest && e.target.closest('.marcador-puntos[contenteditable], .marcador-chaves[contenteditable]');
  if (!el) return;
  if (el.textContent.trim() === '') el.textContent = '0';
  if (typeof actualizarLideres === 'function') actualizarLideres();
  actaPanelActualizar();
});
$mk('#vista-marcador').addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.matches && e.target.matches('[contenteditable]')) { e.preventDefault(); e.target.blur(); }
});
