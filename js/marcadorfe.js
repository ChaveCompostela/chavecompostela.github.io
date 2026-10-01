// Marcador: ferramenta de anotación en directo. Todo vive en memoria (non usa Supabase),
// así que ao recargar a páxina os marcadores volven ao seu valor inicial. Só lectura do
// resto da app; isto é un contador independente para levar o partido sobre a marcha.

const clamp0 = n => (n < 0 ? 0 : n);

document.addEventListener('click', e => {
  // Botóns de sumar/restar puntos ao equipo (+1 +2 +8 +9 +16 / -1 -2 -8 -9 -16)
  const botonPuntos = e.target.closest('#vista-marcador [data-add]');
  if (botonPuntos) {
    const equipo = botonPuntos.closest('.marcador-equipo');
    const marcador = equipo.querySelector('.marcador-puntos');
    const actual = Number(marcador.textContent) || 0;
    marcador.textContent = clamp0(actual + Number(botonPuntos.dataset.add));
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
});

// Reiniciar: só pon a cero os números (puntos e chaves); os nomes escritos quédanse.
document.getElementById('mk-reset')?.addEventListener('click', () => {
  if (!confirm('¿Reiniciar todos os marcadores a cero?')) return;
  document.querySelectorAll('#vista-marcador .marcador-puntos, #vista-marcador .marcador-chaves')
    .forEach(el => { el.textContent = '0'; });
});
