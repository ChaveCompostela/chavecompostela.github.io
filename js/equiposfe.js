// Equipos: clubs de cada liga (feminina/masculina), coa lista de xogadores despregable.
// A liga de cada club vén do campo "Categoría" que se lle asigna no panel de administración.
// Só lectura: esta app non crea, edita nin borra nada.

function tarxetaEquipo(club, xogadores){
  const iconaPeso = `<svg class="peso-icon" viewBox="0 0 26 12" width="22" height="10" fill="currentColor" aria-hidden="true">
    <path fill-rule="evenodd" clip-rule="evenodd" d="M6 12A6 6 0 1 0 6 0a6 6 0 0 0 0 12Zm0-3a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z"/>
    <path fill-rule="evenodd" clip-rule="evenodd" d="M20 12a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm0-3a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z"/>
  </svg>`;
  const nomes = xogadores
    .sort((a, b) => (a.nombre + (a.apellidos || '')).localeCompare(b.nombre + (b.apellidos || '')))
    .map(j => `<li class="equipo-xogador">${iconaPeso}<span>${escFe(j.nombre)} ${escFe(j.apellidos || '')}</span></li>`).join('');
  return `<div class="equipo-card">
    <button class="equipo-fila" aria-expanded="false">
      <div class="equipo-info">
        <h3 class="equipo-nome">${escFe(club.nombre)}</h3>
        ${club.localidad ? `<span class="equipo-localidade">${escFe(club.localidad)}</span>` : ''}
      </div>
      <svg class="equipo-chevron" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
    </button>
    <ul class="equipo-xogadores" hidden>
      ${nomes || '<li class="equipo-xogador equipo-baleiro">Sen xogadores rexistrados.</li>'}
    </ul>
  </div>`;
}

function pintarEquipos(cont, clubs, xogadoresPorClub){
  if (!clubs.length) { cont.innerHTML = '<p class="baleiro">Aínda non hai equipos publicados.</p>'; return; }
  cont.innerHTML = clubs
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map(c => tarxetaEquipo(c, xogadoresPorClub.filter(j => j.id_club === c.id)))
    .join('');
}

// Abrir/pechar a lista de xogadores dun equipo, de forma independente en cada tarxeta
document.addEventListener('click', e => {
  const fila = e.target.closest('.equipo-fila');
  if (!fila) return;
  const lista = fila.nextElementSibling;
  const aberto = fila.getAttribute('aria-expanded') === 'true';
  fila.setAttribute('aria-expanded', String(!aberto));
  lista.hidden = aberto;
});

async function cargarEquipos(){
  const contFem = document.getElementById('equipos-feminina');
  const contMasc = document.getElementById('equipos-masculina');
  if (ERR_CONFIG_FE) {
    contFem.innerHTML = contMasc.innerHTML = `<p class="erro">${escFe(ERR_CONFIG_FE)}</p>`;
    return;
  }
  try {
    const [{ data: clubs, error: e1 }, { data: categorias, error: e2 }, { data: xogadores, error: e3 }] = await Promise.all([
      sbfe.from('clubs').select('*').eq('activo', true),
      sbfe.from('categorias').select('*'),
      sbfe.from('jugadores').select('id,nombre,apellidos,id_club').eq('activo', true),
    ]);
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);
    if (e3) throw new Error(e3.message);

    const idFem = categorias.find(c => c.nombre === 'femenina')?.id;
    const idMasc = categorias.find(c => c.nombre === 'masculina')?.id;
    pintarEquipos(contFem, clubs.filter(c => c.id_categoria === idFem), xogadores);
    pintarEquipos(contMasc, clubs.filter(c => c.id_categoria === idMasc), xogadores);
  } catch (e) {
    const msg = `<p class="erro">Non se puideron cargar os equipos: ${escFe(e.message)}</p>`;
    contFem.innerHTML = contMasc.innerHTML = msg;
  }
}

document.addEventListener('DOMContentLoaded', cargarEquipos);
