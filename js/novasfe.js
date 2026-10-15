// Novas: amosa as entradas da táboa "eventos" de Supabase, agrupadas por día
// (o día máis recente primeiro). Dentro de cada grupo só se amosa a hora.
// Só lectura: esta app non crea, edita nin borra nada.

const escFe = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function chaveDia(iso){ const d = new Date(iso); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }

function tituloDia(iso){
  const d = new Date(iso);
  let t;
  try { t = d.toLocaleDateString('gl-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
  catch (e) { t = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function horaFe(iso){
  const d = new Date(iso);
  try { return d.toLocaleTimeString('gl-ES', { hour: '2-digit', minute: '2-digit', hour12: false }); }
  catch (e) { return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false }); }
}

function tarxetaEvento(ev, inst){
  // «Sin hora»: solo se sabe el día, así que non se amosa ningunha hora
  const hora = ev.sin_hora ? '' : horaFe(ev.fecha_inicio) + (ev.fecha_fin ? ' – ' + horaFe(ev.fecha_fin) : '');
  const nomeInstalacion = inst?.nombre || '';
  const url = ev.url_localizacion || '';
  const ligazon = url
    ? `<p class="novas-mapa-fila"><a class="novas-mapa" href="${escFe(url)}" target="_blank" rel="noopener">📍 Ver localización</a></p>` : '';

  return `<article class="novas-card">
    <h3 class="novas-tit">${escFe(ev.nombre)}</h3>
    ${(hora || nomeInstalacion) ? `<div class="novas-info">
      <span class="novas-hora">${escFe(hora)}</span>
      ${nomeInstalacion ? `<span class="novas-lugar">${escFe(nomeInstalacion)}</span>` : ''}
    </div>` : ''}
    ${ev.direccion ? `<p class="novas-dir">${escFe(ev.direccion)}</p>` : ''}
    ${ev.descripcion ? `<p class="novas-desc">${escFe(ev.descripcion)}</p>` : ''}
    ${ligazon}
  </article>`;
}

// ---------- Carga diferida: só Novas (a primeira pantalla) cárgase ao abrir ----------
// Os outros apartados rexístranse aquí e cárganse a primeira vez que se entra neles, ou en
// segundo plano cando Novas xa está pintada (así non compiten pola rede co que se ve primeiro).
const CARGAS_PENDIENTES = {};
const CARGAS_FEITAS = {};
function cargarVistaUnaVez(nome){
  if (CARGAS_FEITAS[nome] || !CARGAS_PENDIENTES[nome]) return;
  CARGAS_FEITAS[nome] = true;
  CARGAS_PENDIENTES[nome]();
}
function precargarOutrasVistas(){
  ['partidos', 'clasificacion', 'calendario', 'equipos', 'eiras']
    .forEach((nome, i) => setTimeout(() => cargarVistaUnaVez(nome), 600 * (i + 1)));
}

// ---------- Novas ----------
const CACHE_NOVAS = 'chave_novas_v1';   // última lista vista: móstrase ao instante mentres se actualiza

function pintarNovas(cont, eventos){
  if (!eventos.length) { cont.innerHTML = '<p class="baleiro">Aínda non hai novas publicadas.</p>'; return; }
  let html = '', diaAnterior = null;
  for (const ev of eventos) {
    const dia = chaveDia(ev.fecha_inicio);
    if (dia !== diaAnterior) { html += `<h2 class="novas-fecha">${escFe(tituloDia(ev.fecha_inicio))}</h2>`; diaAnterior = dia; }
    html += tarxetaEvento(ev, ev.instalaciones);
  }
  cont.innerHTML = html;
}

async function cargarNovas(){
  const cont = document.getElementById('novas-lista');
  if (ERR_CONFIG_FE) { cont.innerHTML = `<p class="erro">${escFe(ERR_CONFIG_FE)}</p>`; return; }

  // 1) O que se viu a última vez, ao instante
  let pintadoDeCache = false;
  try {
    const gardado = localStorage.getItem(CACHE_NOVAS);
    if (gardado) { pintarNovas(cont, JSON.parse(gardado)); pintadoDeCache = true; }
  } catch (e) {}

  // 2) Datos actuais: unha soa petición (a instalación vai incluída na mesma consulta)
  try {
    const { data: eventos, error } = await sbfe.from('eventos').select('*, instalaciones(nombre)')
      .order('fecha_inicio', { ascending: false });   // días de máis recente a máis antigo e, dentro de cada día, hora de maior a menor
    if (error) throw new Error(error.message);
    pintarNovas(cont, eventos);
    try { localStorage.setItem(CACHE_NOVAS, JSON.stringify(eventos)); } catch (e) {}
  } catch (e) {
    if (!pintadoDeCache) cont.innerHTML = `<p class="erro">Non se puideron cargar as novas: ${escFe(e.message)}</p>`;
  } finally {
    precargarOutrasVistas();
  }
}

document.addEventListener('DOMContentLoaded', cargarNovas);
