// Marcador: ferramenta de anotación en directo. Todo vive en memoria (non usa Supabase),
// así que ao recargar a páxina os marcadores volven ao seu valor inicial.
// Destaca en verde o equipo con máis puntos e o xogador con máis chaves,
// sempre entre os visibles, sen empate e con valor > 0.

const clamp0 = n => (n < 0 ? 0 : n);

// Equipos visibles (non ocultos)
function equiposVisibles(){
  return [...document.querySelectorAll('#vista-marcador .marcador-equipo')]
    .filter(eq => !eq.hidden);
}

// Líder de puntos: entre os equipos visibles, o que teña máis puntos.
// Empate → ningún. Menos de 2 visibles → ningún. Máximo = 0 → ningún.
function actualizarLiderPuntos(){
  document.querySelectorAll('#vista-marcador .marcador-puntos.marcador-lider')
    .forEach(el => el.classList.remove('marcador-lider'));
  const equipos = equiposVisibles();
  if (equipos.length < 2) return;
  const datos = equipos.map(eq => ({
    el: eq.querySelector('.marcador-puntos'),
    puntos: Number(eq.querySelector('.marcador-puntos').textContent) || 0
  }));
  const max = Math.max(...datos.map(e => e.puntos));
  if (max <= 0) return;
  const lideres = datos.filter(e => e.puntos === max);
  if (lideres.length === 1) lideres[0].el.classList.add('marcador-lider');
}

// Líder de chaves: entre TODOS os xogadores visibles, o que teña máis chaves.
// Empate → ningún. Menos de 2 visibles → ningún. Máximo = 0 → ningún.
function actualizarLiderChaves(){
  document.querySelectorAll('#vista-marcador .marcador-chaves.marcador-lider')
    .forEach(el => el.classList.remove('marcador-lider'));
  const chaves = [];
  equiposVisibles().forEach(eq => {
    eq.querySelectorAll('.marcador-chaves').forEach(el => {
      chaves.push({ el, valor: Number(el.textContent) || 0 });
    });
  });
  if (chaves.length < 2) return;
  const max = Math.max(...chaves.map(c => c.valor));
  if (max <= 0) return;
  const lideres = chaves.filter(c => c.valor === max);
  if (lideres.length === 1) lideres[0].el.classList.add('marcador-lider');
}

function actualizarLideres(){
  actualizarLiderPuntos();
  actualizarLiderChaves();
}

document.addEventListener('click', e => {
  // Botóns de sumar/restar puntos ao equipo
  const botonPuntos = e.target.closest('#vista-marcador [data-add]');
  if (botonPuntos) {
    const equipo = botonPuntos.closest('.marcador-equipo');
    const marcador = equipo.querySelector('.marcador-puntos');
    const actual = Number(marcador.textContent) || 0;
    marcador.textContent = clamp0(actual + Number(botonPuntos.dataset.add));
    actualizarLideres();
    return;
  }

  // Botóns +1/-1 das chaves de cada xogador/a
  const botonChave = e.target.closest('#vista-marcador .mk-chb');
  if (botonChave) {
    const fila = botonChave.closest('.marcador-xog');
    const contador = fila.querySelector('.marcador-chaves');
    const actual = Number(contador.textContent) || 0;
    contador.textContent = clamp0(actual + Number(botonChave.dataset.chaves));
    actualizarLideres();
    return;
  }

  // Engadir equipo C ou D
  const addC = e.target.closest('#mk-add-c');
  if (addC) {
    const eq = document.getElementById('mk-c');
    if (eq) { eq.hidden = false; addC.hidden = true; }
    actualizarLideres();
    return;
  }
  const addD = e.target.closest('#mk-add-d');
  if (addD) {
    const eq = document.getElementById('mk-d');
    if (eq) { eq.hidden = false; addD.hidden = true; }
    actualizarLideres();
    return;
  }
});

// Reiniciar: pon a cero os números (puntos e chaves) de todos os equipos visibles.
document.getElementById('mk-reset')?.addEventListener('click', () => {
  if (!confirm('¿Reiniciar todos os marcadores a cero?')) return;
  document.querySelectorAll(
    '#vista-marcador .marcador-equipo:not([hidden]) .marcador-puntos, ' +
    '#vista-marcador .marcador-equipo:not([hidden]) .marcador-chaves'
  ).forEach(el => { el.textContent = '0'; });
  actualizarLideres();
});