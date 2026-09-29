// Novas: amosa as entradas da táboa "eventos" de Supabase, a máis recente engadida primeiro.
// Só lectura: esta app non crea, edita nin borra nada.

const escFe = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function dataFe(iso){
  if (!iso) return '';
  const d = new Date(iso);
  const opts = { day:'numeric', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' };
  try { return d.toLocaleString('gl-ES', opts); } catch (e) { return d.toLocaleString('es-ES', opts); }
}

function tarxetaEvento(ev, nomeInstalacion){
  const cando = dataFe(ev.fecha_inicio) + (ev.fecha_fin ? ' – ' + dataFe(ev.fecha_fin) : '');
  const ligazon = ev.url_localizacion
    ? `<a class="novas-mapa" href="${escFe(ev.url_localizacion)}" target="_blank" rel="noopener">📍 Ver localización</a>` : '';
  return `<article class="novas-card">
    <h3 class="novas-tit">${escFe(ev.nombre)}</h3>
    <p class="novas-data">${escFe(cando)}</p>
    ${nomeInstalacion ? `<p class="novas-lugar">${escFe(nomeInstalacion)}</p>` : ''}
    ${ev.descripcion ? `<p class="novas-desc">${escFe(ev.descripcion)}</p>` : ''}
    ${ligazon}
  </article>`;
}

async function cargarNovas(){
  const cont = document.getElementById('novas-lista');
  if (ERR_CONFIG_FE) { cont.innerHTML = `<p class="erro">${escFe(ERR_CONFIG_FE)}</p>`; return; }
  try {
    const { data: eventos, error } = await sbfe.from('eventos').select('*').order('id', { ascending: false });
    if (error) throw new Error(error.message);
    if (!eventos.length) { cont.innerHTML = '<p class="baleiro">Aínda non hai novas publicadas.</p>'; return; }
    const { data: instalaciones } = await sbfe.from('instalaciones').select('id,nombre');
    const nomeInst = id => instalaciones?.find(i => i.id === id)?.nombre || '';
    cont.innerHTML = eventos.map(ev => tarxetaEvento(ev, nomeInst(ev.id_instalacion))).join('');
  } catch (e) {
    cont.innerHTML = `<p class="erro">Non se puideron cargar as novas: ${escFe(e.message)}</p>`;
  }
}

document.addEventListener('DOMContentLoaded', cargarNovas);
