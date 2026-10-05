// Eiras: unha ficha por instalación (táboa "instalaciones"), co mesmo formato
// de tarxeta ca en Novas. Só lectura.

function tarxetaEira(i){
  const info = (i.localidad || i.num_pistas)
    ? `<div class="novas-info">
        <span class="novas-hora">${i.localidad ? escFe(i.localidad) : ''}</span>
        <span class="novas-lugar">${i.num_pistas ? escFe(i.num_pistas + (i.num_pistas === 1 ? ' pista' : ' pistas')) : ''}</span>
      </div>`
    : '';
  const ligazon = i.url_localizacion
    ? `<p class="novas-mapa-fila"><a class="novas-mapa" href="${escFe(i.url_localizacion)}" target="_blank" rel="noopener">📍 Ver localización</a></p>`
    : '';

  return `<article class="novas-card">
    <h3 class="novas-tit">${escFe(i.nombre)}</h3>
    ${info}
    ${i.direccion ? `<p class="novas-desc">${escFe(i.direccion)}</p>` : ''}
    ${i.notas ? `<p class="novas-desc">${escFe(i.notas)}</p>` : ''}
    ${ligazon}
  </article>`;
}

async function cargarEiras(){
  const cont = document.getElementById('eiras-lista');
  if (ERR_CONFIG_FE) { cont.innerHTML = `<p class="erro">${escFe(ERR_CONFIG_FE)}</p>`; return; }
  try {
    const { data: instalaciones, error } = await sbfe.from('instalaciones').select('*').order('nombre');
    if (error) throw new Error(error.message);
    if (!instalaciones.length) { cont.innerHTML = '<p class="baleiro">Aínda non hai instalacións publicadas.</p>'; return; }
    cont.innerHTML = instalaciones.map(tarxetaEira).join('');
  } catch (e) {
    cont.innerHTML = `<p class="erro">Non se puideron cargar as eiras: ${escFe(e.message)}</p>`;
  }
}

document.addEventListener('DOMContentLoaded', cargarEiras);
