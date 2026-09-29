// Equipos: clubs de cada liga (feminina/masculina), coa lista de xogadores despregable.
// A liga de cada club vén do campo "Categoría" que se lle asigna no panel de administración.
// Só lectura: esta app non crea, edita nin borra nada.

// Icona e título do despregable segundo a liga
const ICONA_XOGADOR = { feminina: 'icons/pesos13d.svg', masculina: 'icons/pesos23d.svg' };
const TITULO_XOGADORES = { feminina: 'Xogadoras do club', masculina: 'Xogadores do club' };

function tarxetaEquipo(club, xogadores, liga){
  const icona = ICONA_XOGADOR[liga];
  const nomes = xogadores
    .sort((a, b) => (a.nombre + (a.apellidos || '')).localeCompare(b.nombre + (b.apellidos || '')))
    .map(j => `<li class="equipo-xogador"><img class="peso-icon" src="${icona}" alt="" width="22" height="10">
      <span>${escFe(j.nombre)} ${escFe(j.apellidos || '')}</span></li>`).join('');
  return `<div class="equipo-card">
    <button class="equipo-fila" aria-expanded="false">
      <div class="equipo-info">
        <h3 class="equipo-nome">${escFe(club.nombre)}</h3>
        ${club.localidad ? `<span class="equipo-localidade">${escFe(club.localidad)}</span>` : ''}
      </div>
      <svg class="equipo-chevron" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
    </button>
    <div class="equipo-despregable" hidden>
      <h4 class="equipo-xog-titulo">${TITULO_XOGADORES[liga]}</h4>
      <ul class="equipo-xogadores">
        ${nomes || '<li class="equipo-xogador equipo-baleiro">Sen xogadores rexistrados.</li>'}
      </ul>
    </div>
  </div>`;
}

function pintarEquipos(cont, clubs, xogadoresPorClub, liga){
  if (!clubs.length) { cont.innerHTML = '<p class="baleiro">Aínda non hai equipos publicados.</p>'; return; }
  cont.innerHTML = clubs
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map(c => tarxetaEquipo(c, xogadoresPorClub.filter(j => j.id_club === c.id), liga))
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
    pintarEquipos(contFem, clubs.filter(c => c.id_categoria === idFem), xogadores, 'feminina');
    pintarEquipos(contMasc, clubs.filter(c => c.id_categoria === idMasc), xogadores, 'masculina');
  } catch (e) {
    const msg = `<p class="erro">Non se puideron cargar os equipos: ${escFe(e.message)}</p>`;
    contFem.innerHTML = contMasc.innerHTML = msg;
  }
}

document.addEventListener('DOMContentLoaded', cargarEquipos);
