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

async function start(){
  $('#app').innerHTML = `<header><img class="logo-s" src="icons/logo-chave.svg" alt="Chave"><select id="sec" onchange="show(this.value)">
    ${ORDEN.map(k => `<option value="${k}">${T[k].t}</option>`).join('')}<option value="copias">Copia de seguridad</option></select>
    <button onclick="salir()">Salir</button></header><p id="msg"></p><main id="main">Cargando…</main>`;
  await loadAll();
  show(cur);
}
function show(t){ cur = t; $('#sec').value = t; if (t === 'copias') return vistaCopias(); listar(); }

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
    ${rows.map((r, i) => `<tr><td class="ac">${cur === 'partidos' ? `<button class="ic pri" onclick="abrir(${r.id})">Mesas</button>` : ''}<button class="ic" onclick="abrirForm(${i})" aria-label="Editar">✏️</button><button class="ic del" onclick="borrar(${i})" aria-label="Borrar">🗑️</button></td>
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
}

async function guardar(){
  const o = {};
  for (const [k,, ty] of T[cur].f) {
    const e = $('#f_' + k); let v = ty === 'b' ? e.checked : e.value;
    if (v === '') v = null;
    else if (ty === 'n' || ty.startsWith('r:')) v = Number(v);
    else if (ty === 'dt') v = new Date(v).toISOString();
    o[k] = v;
  }
  const match = edit && Object.fromEntries(pkOf(cur).map(k => [k, edit[k]]));
  const { data, error } = edit ? await sb.from(cur).update(o).match(match) : await sb.from(cur).insert(o).select();
  if (error) return msg('Error: ' + error.message);
  cerrar(); await loadTable(cur);
  if (cur === 'partidos' && !edit && data && data[0]) return abrir(data[0].id);   // tras crear un partido, ir directo a sus mesas
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
