// Sesión, navegación y CRUD genérico.
let cur = 'partidos', edit = null;

function loginView(){
  $('#app').innerHTML = `<img class="logo" src="icons/logo-chave.svg" alt="Chave">
    <h1 class="c">Liga de chave · Administración</h1>
    <form class="card" onsubmit="entrar(event)">
      <label>Correo<input id="em" type="email" value="compostelachave@gmail.com" autocomplete="username" required></label>
      <label>Contraseña<input id="pw" type="password" autocomplete="current-password" required></label>
      <button class="pri" style="width:100%">Entrar</button><p id="msg"></p></form>`;
}
async function entrar(e){
  e.preventDefault();
  const { error } = await sb.auth.signInWithPassword({ email: $('#em').value, password: $('#pw').value });
  if (error) return msg('No se pudo entrar: ' + error.message);
  start();
}
async function salir(){ await sb.auth.signOut(); loginView(); }

// Iconos de línea con estilo uniforme; heredan el color del texto
const ICONOS = {
  partidos:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  jornadas:'<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>',
  eventos:'<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  jugadores:'<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  clubs:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  parejas:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  instalaciones:'<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  temporadas:'<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  ligas:'<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
  enfrentamientos:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  enfrentamiento_parejas:'<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  chaves_enfrentamiento:'<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>',
  copias:'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
  pendientes:'<path d="M3 13h4l2 3h6l2-3h4"/><path d="M5 13 3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2l-2 6"/><path d="M3 13v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6"/>'
};
const icono = k => `<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[k]}</svg>`;
const MENU = ['pendientes','partidos','jornadas','eventos','jugadores','clubs','parejas','instalaciones','temporadas','ligas'];
const MENU_AVANZADO = ['enfrentamientos','enfrentamiento_parejas','chaves_enfrentamiento','copias'];
const NOMBRES_PROPIOS = { pendientes: 'Resultados pendientes', copias: 'Copia de seguridad' };
const nombreSeccion = k => NOMBRES_PROPIOS[k] || T[k].t.replace(' (avanzado)', '');

async function start(){
  $('#app').innerHTML = `<header><button class="inicio" onclick="vistaInicio()" aria-label="Inicio" title="Inicio"><img class="logo-s" src="icons/logo-chave.svg" alt=""></button>
    <span style="flex:1"></span><button onclick="salir()">Salir</button></header><p id="msg"></p><main id="main">Cargando…</main>`;
  await loadAll();
  vistaInicio();
}

// Confirmación visual: la tarjeta se resalta un instante antes de abrir la sección
function pulsar(b, k){
  if (b.classList.contains('sel')) return;
  b.classList.add('sel');
  setTimeout(() => show(k), 200);
}

function vistaInicio(){
  cur = null; msg('');
  const tarjeta = k => `<button class="tile" onclick="pulsar(this,'${k}')"><span class="ico">${icono(k)}</span>
    <b>${esc(nombreSeccion(k))}</b>${D[k] ? `<small>${D[k].length}</small>` : ''}</button>`;
  $('#main').innerHTML = `<h2 class="c">Liga de chave de Santiago</h2><p class="mut c">¿Qué quieres gestionar?</p><div class="rejilla">${MENU.map(tarjeta).join('')}</div>
    <h3>Avanzado</h3><div class="rejilla">${MENU_AVANZADO.map(tarjeta).join('')}</div>`;
}
function show(t){ cur = t; msg(''); if (t === 'copias') return vistaCopias(); if (t === 'pendientes') return vistaPendientes(); listar(); }

function celda(r, k, ty){
  const v = fmt(r[k], ty);
  if (ty === 'u') return /^https?:\/\//.test(v) ? `<a href="${esc(v)}" target="_blank" rel="noopener">📍 Ver</a>` : esc(v);
  return esc(v);
}
function listar(){
  const c = T[cur], rows = D[cur] || [];
  const cols = c.f.filter(f => !c.c || c.c.includes(f[0]));
  $('#main').innerHTML = `<div class="bar"><h2>${c.t} (${rows.length})</h2><button class="pri" onclick="abrirForm(null)">+ Nuevo</button></div>
    <div class="tw"><table><thead><tr><th></th>${cols.map(f => `<th>${esc(f[1].replace(/\s*\(.*\)/, ''))}</th>`).join('')}${(c.x || []).map(x => `<th>${esc(x[0])}</th>`).join('')}</tr></thead><tbody>
    ${rows.map((r, i) => `<tr><td class="ac">${cur === 'partidos' ? `<button class="ic pri" onclick="abrir(${r.id})">Partidas</button>` : ''}${cur === 'jornadas' ? `<button class="ic pri" onclick="abrirJornada(${r.id})">Partidos</button>` : ''}<button class="ic" onclick="abrirForm(${i})" aria-label="Editar">✏️</button><button class="ic del" onclick="borrar(${i})" aria-label="Borrar">🗑️</button></td>
    ${cols.map(f => `<td>${celda(r, f[0], f[2])}</td>`).join('')}${(c.x || []).map(x => `<td>${esc(x[1](r))}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${cols.length + (c.x || []).length + 1}" class="mut">Sin registros</td></tr>`}
    </tbody></table></div>`;
}

function sheet(h){
  let s = $('#sheet');
  if (!s) { s = document.createElement('div'); s.id = 'sheet'; s.className = 'sheet'; document.body.append(s); }
  s.innerHTML = `<div class="in">${h}</div>`;
  document.body.style.overflow = 'hidden';
}
function cerrar(){ $('#sheet')?.remove(); document.body.style.overflow = ''; }

function field([k, label, ty], v){
  const id = 'f_' + k;
  if (ty === 'b') return `<label>${label}<input id="${id}" type="checkbox" ${v ?? true ? 'checked' : ''}></label>`;
  if (ty.startsWith('r:')) { const t = ty.slice(2);
    return `<label>${label}<select id="${id}"><option value="">—</option>${(D[t] || []).map(r =>
      `<option value="${r.id}" ${r.id === v ? 'selected' : ''}>${esc(lab(t, r.id))}</option>`).join('')}</select></label>`; }
  if (ty.startsWith('e:')) return `<label>${label}<select id="${id}">${ty.slice(2).split('|').map(o =>
      `<option ${o === v ? 'selected' : ''}>${o}</option>`).join('')}</select></label>`;
  if (ty === 'u') return `<label>${label}<div class="fila"><input id="${id}" type="url" inputmode="url" placeholder="Escribe un enlace o elige en el mapa" value="${esc(v ?? '')}">
    <button type="button" onclick="abrirMapa('${id}')">📍 Mapa</button></div></label>`;
  const type = { t:'text', n:'number', d:'date', dt:'datetime-local' }[ty];
  const val = v == null ? '' : ty === 'dt' ? toLocal(v) : v;
  return `<label>${label}<input id="${id}" type="${type}" ${ty === 'n' ? 'inputmode="numeric"' : ''} value="${esc(val)}"></label>`;
}

function abrirForm(i){
  const c = T[cur]; edit = i == null ? null : D[cur][i];
  sheet(`<h2>${edit ? 'Editar' : 'Nuevo'} · ${c.t}</h2>${c.f.map(f => field(f, edit?.[f[0]])).join('')}
    <p class="err" id="smsg"></p>
    <div class="bar"><button onclick="cerrar()">Cancelar</button><button class="pri" onclick="guardar()">Guardar</button></div>`);
  if (cur === 'partidos') {
    $('#f_id_jornada').addEventListener('change', actualizarClubsPartido);
    actualizarClubsPartido();   // aplica el filtro también al editar un partido ya creado
  }
}

// En el formulario de Partidos: al elegir la jornada, los desplegables de club local/visitante
// solo muestran los clubs de la categoría (femenina/masculina) de la liga de esa jornada.
function clubsFiltradosPorJornada(idJornada, valorActual){
  const jornada = D.jornadas.find(j => j.id === Number(idJornada));
  const liga = jornada && D.ligas.find(l => l.id === jornada.id_liga);
  const idCategoria = liga?.id_categoria;
  let lista = idCategoria != null ? D.clubs.filter(c => c.id_categoria === idCategoria) : D.clubs.slice();
  // Si el valor ya guardado (al editar) no está en la lista filtrada, se mantiene para no perder el dato.
  if (valorActual && !lista.some(c => c.id === Number(valorActual))) {
    const extra = D.clubs.find(c => c.id === Number(valorActual));
    if (extra) lista = lista.concat(extra);
  }
  return lista;
}

function actualizarClubsPartido(){
  const idJornada = $('#f_id_jornada').value;
  for (const campo of ['id_club_local', 'id_club_visitante']) {
    const sel = $('#f_' + campo);
    if (!sel) continue;
    const valorActual = sel.value;
    const lista = idJornada ? clubsFiltradosPorJornada(idJornada, valorActual) : D.clubs.slice();
    sel.innerHTML = '<option value="">—</option>' + lista
      .sort((a, b) => lab('clubs', a.id).localeCompare(lab('clubs', b.id)))
      .map(c => `<option value="${c.id}" ${String(c.id) === valorActual ? 'selected' : ''}>${esc(lab('clubs', c.id))}</option>`).join('');
  }
}

async function guardar(){
  const o = {};
  for (const [k,, ty] of T[cur].f) {
    const e = $('#f_' + k); let v = ty === 'b' ? e.checked : e.value;
    if (v === '') v = null;
    else if (ty === 'n' || ty.startsWith('r:')) v = Number(v);
    else if (ty === 'dt') v = v.length === 16 ? v + ':00' : v;   // hora local tal cual (la columna es timestamp SIN zona horaria)
    o[k] = v;
  }
  const match = edit && Object.fromEntries(pkOf(cur).map(k => [k, edit[k]]));
  const { data, error } = edit ? await sb.from(cur).update(o).match(match) : await sb.from(cur).insert(o).select();
  if (error) return msg('Error: ' + error.message);
  cerrar(); await loadTable(cur);
  if (cur === 'partidos' && !edit && data && data[0]) return abrir(data[0].id);   // tras crear un partido, ir directo a sus partidas
  if (cur === 'jornadas' && !edit && data && data[0]) return abrirJornada(data[0].id);   // tras crear una jornada, ir directo a sus partidos
  listar();
}

async function borrar(i){
  const r = D[cur][i];
  if (!confirm('¿Borrar este registro? También se borrarán los datos que dependen de él.')) return;
  const { error } = await sb.from(cur).delete().match(Object.fromEntries(pkOf(cur).map(k => [k, r[k]])));
  if (error) return msg('Error: ' + error.message);
  await loadAll(); listar();
}

(async () => {
  if (ERR_CONFIG) {
    $('#app').innerHTML = `<h1>Liga de chave · Administración</h1><p class="err">${esc(ERR_CONFIG)}</p>`;
    return;
  }
  try {
    const { data: { session } } = await sb.auth.getSession();
    session ? start() : loginView();
  } catch (e) { loginView(); }
})();
