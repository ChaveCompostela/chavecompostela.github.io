// Marcador: ferramenta de anotación en directo. Todo vive en memoria (non usa Supabase),
// así que ao recargar a páxina os marcadores volven ao seu valor inicial.
// O equipo que vai gañando (máis puntos, sen empate) pinta os puntos en dourado.

const clamp0 = n => (n < 0 ? 0 : n);

// Recalcula o líder: entre os equipos VISIBLES, o que teña máis puntos.
// Se hai empate, ningún se destaca. Se hai menos de 2 visibles, ningún.
function actualizarLider(){
  const equipos = [...document.querySelectorAll('#vista-marcador .marcador-equipo')]
    .filter(eq => !eq.hidden);
  document.querySelectorAll('#vista-marcador .marcador-puntos.marcador-lider')
    .forEach(el => el.classList.remove('marcador-lider'));
  if (equipos.length < 2) return;
  const conPuntos = equipos.map(eq => ({
    el: eq.querySelector('.marcador-puntos'),
    puntos: Number(eq.querySelector('.marcador-puntos').textContent) || 0
  }));
  const max = Math.max(...conPuntos.map(e => e.puntos));
  const lideres = conPuntos.filter(e => e.puntos === max);
  if (lideres.length === 1 && max > 0) lideres[0].el.classList.add('marcador-lider');
}

document.addEventListener('click', e => {
  // Botóns de sumar/restar puntos ao equipo (+1 +2 +8 +9 +16 / -1 -2 -8 -9 -16)
  const botonPuntos = e.target.closest('#vista-marcador [data-add]');
  if (botonPuntos) {
    const equipo = botonPuntos.closest('.marcador-equipo');
    const marcador = equipo.querySelector('.marcador-puntos');
    const actual = Number(marcador.textContent) || 0;
    marcador.textContent = clamp0(actual + Number(botonPuntos.dataset.add));
    actualizarLider();
    return;
  }

  // Botóns +1/-1 das chaves de cada xogador/a
  const botonChave = e.target.closest('#vista-marcador .mk-chb');
  if (botonChave) {
    const fila = botonChave.closest('.marcador-xog');
    const contador = fila.querySelector('.marcador-chaves');
    const actual = Number(contador.textContent) || 0;
    contador.textContent = clamp0(actual + Number(botonChave.dataset.chaves));
    return;
  }

  // Engadir equipo C ou D: amosa o equipo e oculta o botón
  const addC = e.target.closest('#mk-add-c');
  if (addC) {
    const eq = document.getElementById('mk-c');
    if (eq) { eq.hidden = false; addC.hidden = true; }
    actualizarLider();
    return;
  }
  const addD = e.target.closest('#mk-add-d');
  if (addD) {
    const eq = document.getElementById('mk-d');
    if (eq) { eq.hidden = false; addD.hidden = true; }
    actualizarLider();
    return;
  }
});

// Reiniciar: pon a cero os números (puntos e chaves) de todos os equipos visibles.
// Os nomes escritos quédanse como están.
document.getElementById('mk-reset')?.addEventListener('click', () => {
  if (!confirm('¿Reiniciar todos os marcadores a cero?')) return;
  document.querySelectorAll(
    '#vista-marcador .marcador-equipo:not([hidden]) .marcador-puntos, ' +
    '#vista-marcador .marcador-equipo:not([hidden]) .marcador-chaves'
  ).forEach(el => { el.textContent = '0'; });
  actualizarLider();
});