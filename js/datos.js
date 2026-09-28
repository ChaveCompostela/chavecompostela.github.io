// Modelo de datos de la interfaz.
// c = columnas visibles en el listado (por defecto todas)
// Campos: [columna, etiqueta, tipo]  t=texto n=número d=fecha dt=fecha y hora u=url con mapa b=sí/no r:tabla=referencia e:a|b=opciones
const T = {
  temporadas:{t:'Temporadas',f:[['nombre','Nombre','t'],['fecha_inicio','Inicio','d'],['fecha_fin','Fin','d']],l:r=>r.nombre},
  categorias:{h:1,f:[],l:r=>r.nombre},
  ligas:{t:'Ligas',f:[['id_temporada','Temporada','r:temporadas'],['id_categoria','Categoría','r:categorias'],['nombre','Nombre','t']],l:r=>r.nombre},
  jornadas:{t:'Jornadas',f:[['id_liga','Liga','r:ligas'],['numero','Nº jornada','n'],['fecha','Fecha','d']],l:r=>`J${r.numero} · ${lab('ligas',r.id_liga)}`},
  clubs:{t:'Clubs',f:[['nombre','Nombre','t'],['localidad','Localidad','t'],['activo','Activo','b']],l:r=>r.nombre},
  jugadores:{t:'Jugadores',c:['nombre','apellidos','id_club'],f:[['nombre','Nombre','t'],['apellidos','Apellidos','t'],['id_club','Club (vacío = sin club)','r:clubs'],['activo','Activo','b']],l:r=>`${r.nombre} ${r.apellidos||''}`.trim()},
  instalaciones:{t:'Instalaciones',c:['nombre','localidad','num_pistas','url_localizacion'],f:[['nombre','Nombre','t'],['direccion','Dirección','t'],['localidad','Localidad','t'],['num_pistas','Nº pistas','n'],['id_club','Club','r:clubs'],['url_localizacion','URL localización','u']],l:r=>r.nombre},
  eventos:{t:'Eventos',c:['nombre','fecha_inicio','fecha_fin','id_instalacion','url_localizacion'],f:[['nombre','Nombre','t'],['descripcion','Descripción','t'],['fecha_inicio','Inicio','dt'],['fecha_fin','Fin','dt'],['id_instalacion','Instalación','r:instalaciones'],['url_localizacion','URL localización','u']],l:r=>r.nombre},
  parejas:{t:'Parejas',x:[['Club',r=>{const c=clubPar(r);return c?lab('clubs',c):'';}]],f:[['id_jugador_a','Jugador A','r:jugadores'],['id_jugador_b','Jugador B','r:jugadores']],l:r=>`${lab('jugadores',r.id_jugador_a)} + ${lab('jugadores',r.id_jugador_b)}`},
  partidos:{t:'Partidos',c:['fecha_hora','id_club_local','id_club_visitante','estado'],f:[['id_jornada','Jornada','r:jornadas'],['id_evento','Evento','r:eventos'],['id_instalacion','Instalación','r:instalaciones'],['fecha_hora','Fecha y hora','dt'],['id_club_local','Club local (vacío = sin club)','r:clubs'],['id_club_visitante','Club visitante (vacío = sin club)','r:clubs'],['estado','Estado','e:programado|en_juego|finalizado|suspendido']],
    l:r=>`#${r.id} · ${r.id_club_local?lab('clubs',r.id_club_local):'sin club'} vs ${r.id_club_visitante?lab('clubs',r.id_club_visitante):'sin club'}`},
  enfrentamientos:{t:'Mesas (avanzado)',f:[['id_partido','Partido','r:partidos'],['numero','Nº mesa','n']],l:r=>`${lab('partidos',r.id_partido)} · mesa ${r.numero}`},
  enfrentamiento_parejas:{t:'Parejas en mesa (avanzado)',f:[['id_enfrentamiento','Mesa','r:enfrentamientos'],['id_pareja','Pareja','r:parejas'],['lado','Lado','e:local|visitante']],l:r=>'#'+r.id},
  chaves_enfrentamiento:{t:'Chaves (avanzado)',pk:['id_enfrentamiento','id_jugador'],f:[['id_enfrentamiento','Mesa','r:enfrentamientos'],['id_jugador','Jugador','r:jugadores'],['chaves','Chaves','n']],l:r=>lab('jugadores',r.id_jugador)}
};
const ORDEN = ['partidos','eventos','jugadores','clubs','parejas','instalaciones','temporadas','ligas','jornadas','enfrentamientos','enfrentamiento_parejas','chaves_enfrentamiento'];

const D = {};
// Club de una pareja: el de sus jugadores si es el mismo club; si no (sin club u ocasional) → null
const clubPar = p => {
  const a = D.jugadores?.find(j => j.id === p.id_jugador_a), b = D.jugadores?.find(j => j.id === p.id_jugador_b);
  return a && b && a.id_club && a.id_club === b.id_club ? a.id_club : null;
};
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pkOf = t => T[t].pk || ['id'];
const msg = m => { const e = $('#smsg') || $('#msg'); if (e) e.textContent = m || ''; };

function lab(t, id){
  if (id == null) return '—';
  const r = (D[t] || []).find(x => x.id === id);
  return r ? T[t].l(r) : '#' + id;
}
function fmt(v, ty){
  if (v == null || v === '') return '';
  if (ty === 'b') return v ? 'Sí' : 'No';
  if (ty === 'dt') return new Date(v).toLocaleString('es-ES', {dateStyle:'short', timeStyle:'short'});
  if (ty.startsWith('r:')) return lab(ty.slice(2), v);
  return String(v);
}
function toLocal(v){
  const d = new Date(v), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
async function loadTable(t){
  const { data, error } = await sb.from(t).select('*').order(pkOf(t)[0]);
  if (error) return msg(error.message);
  D[t] = data;
}
const loadAll = () => Promise.all(Object.keys(T).map(loadTable));
