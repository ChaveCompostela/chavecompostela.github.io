// Carga de datos da app pública FILTRADA POR TEMPADA.
// Supabase devolve como máximo 1000 filas por consulta; por iso (1) só se piden os datos da tempada
// que se vai amosar (ligas → xornadas → partidos → partidas → parellas e chaves) e (2) toda lectura vai
// paxinada. Ao empezar outra tempada, as ligas, xornadas e partidos novos comezan de cero.
// Depende de: configfe.js (sbfe). Só lectura.
//
//   cargarBaseFe()                      → { categorias, temporadas (a máis recente primeiro), clubs, instalaciones, jugadores }
//   cargarDatosTemporada(id, conChaves) → a base + { ligas, xornadas, partidos, enfrentamientos,
//                                          enfrentamiento_parejas, parejas, chaves_enfrentamiento }
// Os resultados gárdanse en memoria: volver á mesma tempada non repite as consultas.

const TROZO_IDS_FE = 100;   // ids por consulta ".in(...)" (para non facer a URL demasiado longa)

// Le TODAS as filas dunha consulta, de 1000 en 1000. «construir» devolve unha consulta nova en cada chamada.
async function leerPaxinadoFe(construir, orde){
  const ordes = Array.isArray(orde) ? orde : [orde];
  let todo = [];
  for (let desde = 0; ; desde += 1000) {
    let q = construir();
    ordes.forEach(c => { q = q.order(c); });
    const { data, error } = await q.range(desde, desde + 999);
    if (error) throw new Error(error.message);
    todo = todo.concat(data);
    if (data.length < 1000) return todo;
  }
}

const leerTaboaFe = (taboa, cols, orde = 'id') => leerPaxinadoFe(() => sbfe.from(taboa).select(cols), orde);

// Filas cuxo «campo» está entre os ids dados (en bloques de TROZO_IDS_FE)
async function leerPorIdsFe(taboa, cols, campo, ids, orde = 'id'){
  const unicos = [...new Set(ids)];
  const trozos = [];
  for (let i = 0; i < unicos.length; i += TROZO_IDS_FE) trozos.push(unicos.slice(i, i + TROZO_IDS_FE));
  const partes = await Promise.all(trozos.map(t => leerPaxinadoFe(() => sbfe.from(taboa).select(cols).in(campo, t), orde)));
  return partes.flat();
}

// ---------- Datos que non dependen da tempada (táboas pequenas) ----------
let baseFe = null;
function cargarBaseFe(){
  if (!baseFe) {
    baseFe = Promise.all([
      leerTaboaFe('categorias', '*'),
      leerTaboaFe('temporadas', '*'),
      leerTaboaFe('clubs', '*'),
      leerTaboaFe('instalaciones', 'id,nombre,url_localizacion'),
      leerTaboaFe('jugadores', 'id,nombre,apellidos,id_club,activo'),
    ]).then(([categorias, temporadas, clubs, instalaciones, jugadores]) => ({
      categorias,
      temporadas: temporadas.slice().sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio)),
      clubs, instalaciones, jugadores,
    })).catch(e => { baseFe = null; throw e; });   // se falla, a próxima vez volve intentalo
  }
  return baseFe;
}

// ---------- Datos dunha tempada ----------
const cacheNucleoFe = {}, cacheChavesFe = {};
const NUCLEO_VACIO_FE = { ligas: [], xornadas: [], partidos: [], enfrentamientos: [], enfrentamiento_parejas: [], parejas: [] };

function cargarNucleoTemporadaFe(idTemp){
  if (!cacheNucleoFe[idTemp]) {
    cacheNucleoFe[idTemp] = (async () => {
      const ligas = await leerPaxinadoFe(() => sbfe.from('ligas').select('*').eq('id_temporada', idTemp), 'id');
      const xornadas = await leerPorIdsFe('jornadas', '*', 'id_liga', ligas.map(l => l.id));
      const partidos = await leerPorIdsFe('partidos', '*', 'id_jornada', xornadas.map(x => x.id));
      const enfrentamientos = await leerPorIdsFe('enfrentamientos', '*', 'id_partido', partidos.map(p => p.id));
      const enfrentamiento_parejas = await leerPorIdsFe('enfrentamiento_parejas', '*', 'id_enfrentamiento', enfrentamientos.map(e => e.id));
      const parejas = await leerPorIdsFe('parejas', '*', 'id', enfrentamiento_parejas.map(x => x.id_pareja));
      return { ligas, xornadas, partidos, enfrentamientos, enfrentamiento_parejas, parejas };
    })().catch(e => { delete cacheNucleoFe[idTemp]; throw e; });
  }
  return cacheNucleoFe[idTemp];
}

function cargarChavesTemporadaFe(idTemp){
  if (!cacheChavesFe[idTemp]) {
    cacheChavesFe[idTemp] = (async () => {
      const nucleo = await cargarNucleoTemporadaFe(idTemp);
      return leerPorIdsFe('chaves_enfrentamiento', '*', 'id_enfrentamiento', nucleo.enfrentamientos.map(e => e.id), ['id_enfrentamiento', 'id_jugador']);
    })().catch(e => { delete cacheChavesFe[idTemp]; throw e; });
  }
  return cacheChavesFe[idTemp];
}

// idTemp null → tempada baleira (aínda non hai ningunha). conChaves: tamén as chaves de cada xogador.
async function cargarDatosTemporada(idTemp, conChaves){
  const base = await cargarBaseFe();
  if (idTemp == null) return { ...base, ...NUCLEO_VACIO_FE, chaves_enfrentamiento: [] };
  const nucleo = await cargarNucleoTemporadaFe(idTemp);
  const chaves_enfrentamiento = conChaves ? await cargarChavesTemporadaFe(idTemp) : [];
  return { ...base, ...nucleo, chaves_enfrentamiento };
}
