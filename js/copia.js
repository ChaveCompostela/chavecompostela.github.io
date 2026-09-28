// Copia de seguridad y restauración de los datos de la liga (archivo .json).
// Orden pensado para respetar las claves foráneas al restaurar.
const COPIA_TABLAS = ['categorias','temporadas','clubs','ligas','jugadores','instalaciones','jornadas','eventos',
  'parejas','partidos','enfrentamientos','enfrentamiento_parejas','chaves_enfrentamiento','clasificacion_chaves'];
const COPIA_PK = { chaves_enfrentamiento: 'id_enfrentamiento,id_jugador', clasificacion_chaves: 'id_jornada,id_jugador' };
const info = t => { const e = $('#cmsg'); if (e) e.textContent = t; };

function vistaCopias(){
  $('#main').innerHTML = `<h2>Copia de seguridad</h2>
    <div class="card"><b>Descargar copia</b>
      <p class="mut">Guarda todos los datos de la liga en un archivo .json en este dispositivo.</p>
      <button class="pri" onclick="copiaSeguridad()">⬇️ Descargar copia</button></div>
    <div class="card"><b>Restaurar copia</b>
      <p class="mut">Elige un archivo de copia. Los datos se añaden o se actualizan; lo que ya existe y no está en el archivo no se borra.</p>
      <input type="file" id="fcopia" accept=".json,application/json"><div class="acc"><button onclick="restaurar()">⬆️ Restaurar</button></div></div>
    <p id="cmsg" class="mut"></p>`;
}

async function todasLasFilas(t){
  let out = [], d = 0;
  for (;;) {
    const { data, error } = await sb.from(t).select('*').range(d, d + 999);
    if (error) throw new Error(t + ': ' + error.message);
    out = out.concat(data);
    if (data.length < 1000) return out;
    d += 1000;
  }
}

async function copiaSeguridad(){
  try {
    const tablas = {};
    for (const t of COPIA_TABLAS) { info('Leyendo ' + t + '…'); tablas[t] = await todasLasFilas(t); }
    const blob = new Blob([JSON.stringify({ app: 'liga-chave', version: 1, fecha: new Date().toISOString(), tablas })], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'copia-liga-chave-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.append(a); a.click(); a.remove();
    info('Copia descargada ✔');
  } catch (e) { info('Error: ' + e.message); }
}

async function restaurar(){
  const f = $('#fcopia').files[0];
  if (!f) return info('Elige primero un archivo de copia.');
  if (!confirm('¿Restaurar esta copia? Se añadirán o actualizarán los datos del archivo.')) return;
  try {
    const c = JSON.parse(await f.text());
    if (c.app !== 'liga-chave') throw new Error('El archivo no es una copia de la liga de chave.');
    for (const t of COPIA_TABLAS) {
      const filas = c.tablas[t] || [];
      for (let i = 0; i < filas.length; i += 200) {
        info(`Restaurando ${t} (${Math.min(i + 200, filas.length)}/${filas.length})…`);
        const { error } = await sb.from(t).upsert(filas.slice(i, i + 200), { onConflict: COPIA_PK[t] || 'id' });
        if (error) throw new Error(t + ': ' + error.message);
      }
    }
    const { error } = await sb.rpc('reiniciar_secuencias');
    if (error) throw new Error('secuencias: ' + error.message);
    await loadAll();
    info('Restauración completada ✔');
  } catch (e) { info('Error: ' + e.message); }
}
