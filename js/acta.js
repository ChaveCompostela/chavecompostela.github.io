// Acta do encontro (panel): genera el PDF de un partido con lo que haya guardado en la base de datos.
// De momento solo liga FEMININA (una partida por encuentro); la masculina tiene otro formulario.
// Usa actapdf.js (generador compartido) y los datos de D (datos.js).
// Si las tiradas no se anotaron en vivo, se pueden escribir a mano en la pantalla del partido
// (campos «Tiradas») y generar el acta después; sin tiradas, el acta lleva solo los totales.

const _pad2 = n => String(n).padStart(2, '0');

function _fechaActa(p){
  if (!p.fecha_hora) return '';
  const d = new Date(p.fecha_hora);
  const f = `${_pad2(d.getDate())}/${_pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
  return p.sin_hora ? f : `${f} ${_pad2(d.getHours())}:${_pad2(d.getMinutes())}`;
}

const _parejaDeLado = (e, lado) => {
  const ep = D.enfrentamiento_parejas.find(x => x.id_enfrentamiento === e.id && x.lado === lado);
  return ep ? D.parejas.find(x => x.id === ep.id_pareja) : null;
};

// Nombre del bando: el club; si no tiene, los nombres de pila de la pareja (Laura&Carlota)
function _nomeBandoActa(p, lado, partidas){
  const idClub = lado === 'local' ? p.id_club_local : p.id_club_visitante;
  if (idClub) return lab('clubs', idClub);
  const pn = id => (D.jugadores.find(j => j.id === id)?.nombre || '').split(' ')[0];
  for (const e of partidas) {
    const pa = _parejaDeLado(e, lado);
    if (pa) return `${pn(pa.id_jugador_a)}&${pn(pa.id_jugador_b)}`;
  }
  return 'Sen equipo';
}

// Convierte un partido de la base de datos en el objeto que espera generarActaPdf (o null si no se puede)
function datosActaDePartido(idPartido){
  const p = D.partidos.find(x => x.id === idPartido);
  if (!p) return null;
  const partidas = D.enfrentamientos.filter(e => e.id_partido === idPartido).sort((a, b) => a.numero - b.numero);
  if (!partidas.length) { alert('Este partido aún no tiene partidas: crea las partidas antes de generar el acta.'); return null; }
  const jornada = D.jornadas.find(j => j.id === p.id_jornada);
  const liga = jornada && D.ligas.find(l => l.id === jornada.id_liga);
  const cat = liga && D.categorias.find(k => k.id === liga.id_categoria);
  if (cat?.nombre === 'masculina') { alert('El acta de la liga masculina todavía no está disponible (tiene otro formulario).'); return null; }

  const nombre = id => (id ? lab('jugadores', id) : '');
  const jugadas = partidas.filter(e => e.marcador_local != null && e.marcador_visitante != null);
  const local = _nomeBandoActa(p, 'local', partidas), visitante = _nomeBandoActa(p, 'visitante', partidas);
  return {
    fecha: _fechaActa(p),
    campo: p.id_instalacion ? lab('instalaciones', p.id_instalacion) : '',
    local, visitante,
    totalLocal: jugadas.length ? jugadas.reduce((s, e) => s + e.marcador_local, 0) : null,
    totalVisit: jugadas.length ? jugadas.reduce((s, e) => s + e.marcador_visitante, 0) : null,
    nombreArchivo: actaNombreArchivo(local, visitante, p.fecha_hora ? String(p.fecha_hora).slice(0, 10) : ''),
    partidas: partidas.map(e => {
      const pl = _parejaDeLado(e, 'local'), pv = _parejaDeLado(e, 'visitante');
      const ids = [pl?.id_jugador_a, pl?.id_jugador_b, pv?.id_jugador_a, pv?.id_jugador_b];
      return {
        numero: e.numero,
        jugadoresLocal: [nombre(ids[0]), nombre(ids[1])],
        jugadoresVisit: [nombre(ids[2]), nombre(ids[3])],
        puntosLocal: e.marcador_local, puntosVisit: e.marcador_visitante,
        tiradasLocal: e.puntos_tiradas_local || '', tiradasVisit: e.puntos_tiradas_visitante || '',
        chaves: ids.map(id => {
          const c = id ? D.chaves_enfrentamiento.find(z => z.id_enfrentamiento === e.id && z.id_jugador === id) : null;
          return { total: c ? c.chaves : 0, tiradas: c?.tiradas || '' };
        }),
      };
    }),
  };
}

async function generarActa(idPartido){
  const datos = datosActaDePartido(idPartido);
  if (!datos) return;
  try { await generarActaPdf(datos); }
  catch (err) { alert('No se pudo generar el acta: ' + err.message); }
}
