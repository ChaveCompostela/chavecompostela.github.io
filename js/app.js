// Sesión, navegación y CRUD genérico.
let cur = 'partidos', edit = null;

function loginView(){
  $('#app').innerHTML = `<h1>Liga de chave · Administración</h1>
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
  $('#app').innerHTML = `<header><select id="sec" onchange="show(this.value)">
    ${ORDEN.map(k => `<option value="${k}">${T[k].t}</option>`).join('')}</select>
    <button onclick="salir()">Salir</button></header><p id="msg"></p><main id="main">Cargando…</main>`;
  await loadAll();
  show(cur);
}
function show(t){ cur = t; $('#sec').value = t; listar(); }

function listar(){
  const c = T[cur], rows = D[cur] || [];
  $('#main').innerHTML = `<div class="bar"><h2>${c.t} (${rows.length})</h2><button class="pri" onclick="abrirForm(null)">+ Nuevo</button></div>` +
    rows.map((r, i) => `<div class="card"><b>${esc(c.l(r))}</b>
      ${c.f.map(f => { const v = fmt(r[f[0]], f[2]); return v ? `<p class="mut">${esc(f[1])}: ${esc(v)}</p>` : ''; }).join('')}
      <div class="acc">${cur === 'partidos' ? `<button class="pri" onclick="abrir(${r.id})">Abrir mesas</button>` : ''}
      <button onclick="abrirForm(${i})">Editar</button><button class="del" onclick="borrar(${i})">Borrar</button></div></div>`).join('');
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
  const { error } = edit ? await sb.from(cur).update(o).match(match) : await sb.from(cur).insert(o);
  if (error) return msg('Error: ' + error.message);
  cerrar(); await loadTable(cur); listar();
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
