// Pantalla de partido completo: mesas, parejas de cada bando y chaves por jugador.
let pid = null;
const TABLAS_PARTIDO = ['enfrentamientos','enfrentamiento_parejas','chaves_enfrentamiento','parejas','jugadores'];

async function abrir(id){ pid = id; await refrescar(); }
async function refrescar(){ await Promise.all(TABLAS_PARTIDO.map(loadTable)); detalle(); }

function detalle(){
  const p = D.partidos.find(x => x.id === pid);
  const mesas = D.enfrentamientos.filter(e => e.id_partido === pid);
  $('#main').innerHTML = `<button onclick="listar()">← Partidos</button>
    <div class="bar"><h2>${esc(T.partidos.l(p))}</h2></div>
    <p class="mut">${esc(fmt(p.fecha_hora,'dt'))} · ${esc(p.estado)}</p>
    ${mesas.map(mesaHtml).join('')}
    <button class="pri" style="width:100%" onclick="nuevaMesa()">+ Añadir mesa</button>`;
}

function mesaHtml(e){
  const eps = D.enfrentamiento_parejas.filter(x => x.id_enfrentamiento === e.id);
  const opts = D.jugadores.map(j => `<option value="${j.id}">${esc(lab('jugadores', j.id))}</option>`).join('');
  const lado = l => {
    const ps = eps.filter(x => x.lado === l).map(x => {
      const pa = D.parejas.find(y => y.id === x.id_pareja);
      const js = [pa.id_jugador_a, pa.id_jugador_b].map(j => {
        const c = D.chaves_enfrentamiento.find(z => z.id_enfrentamiento === e.id && z.id_jugador === j);
        return `<label>${esc(lab('jugadores', j))} · chaves<input type="number" inputmode="numeric" min="0" value="${c ? c.chaves : ''}" onchange="setChaves(${e.id},${j},this.value)"></label>`;
      }).join('');
      return `<div class="pareja">${js}<button class="del" onclick="quitarPareja(${x.id})">Quitar pareja</button></div>`;
    }).join('');
    return `<h3>${l === 'local' ? 'Local' : 'Visitante'}</h3>${ps}
      <div class="add"><select id="a_${e.id}_${l}"><option value="">Jugador 1</option>${opts}</select>
      <select id="b_${e.id}_${l}"><option value="">Jugador 2</option>${opts}</select>
      <button onclick="addPareja(${e.id},'${l}')">+ Añadir pareja</button></div>`;
  };
  return `<div class="card"><div class="bar"><h2>Mesa ${e.numero}</h2>
    <button class="del" onclick="borrarMesa(${e.id})">Borrar mesa</button></div>${lado('local')}${lado('visitante')}</div>`;
}

async function nuevaMesa(){
  const n = Math.max(0, ...D.enfrentamientos.filter(e => e.id_partido === pid).map(e => e.numero)) + 1;
  const { error } = await sb.from('enfrentamientos').insert({ id_partido: pid, numero: n });
  if (error) return msg(error.message);
  msg(''); refrescar();
}
async function borrarMesa(id){
  if (!confirm('¿Borrar la mesa con sus parejas y chaves?')) return;
  const { error } = await sb.from('enfrentamientos').delete().eq('id', id);
  if (error) return msg(error.message);
  refrescar();
}
async function addPareja(e, l){
  let a = +$(`#a_${e}_${l}`).value, b = +$(`#b_${e}_${l}`).value;
  if (!a || !b || a === b) return msg('Elige dos jugadores distintos');
  if (a > b) { [a, b] = [b, a]; }
  let p = D.parejas.find(x => x.id_jugador_a === a && x.id_jugador_b === b);
  if (!p) {
    const r = await sb.from('parejas').insert({ id_jugador_a: a, id_jugador_b: b }).select().single();
    if (r.error) return msg(r.error.message);
    p = r.data;
  }
  const { error } = await sb.from('enfrentamiento_parejas').insert({ id_enfrentamiento: e, id_pareja: p.id, lado: l });
  if (error) return msg(error.message);
  msg(''); refrescar();
}
async function quitarPareja(id){
  if (!confirm('¿Quitar esta pareja de la mesa (y sus chaves)?')) return;
  const x = D.enfrentamiento_parejas.find(y => y.id === id), pa = D.parejas.find(y => y.id === x.id_pareja);
  await sb.from('chaves_enfrentamiento').delete().eq('id_enfrentamiento', x.id_enfrentamiento).in('id_jugador', [pa.id_jugador_a, pa.id_jugador_b]);
  const { error } = await sb.from('enfrentamiento_parejas').delete().eq('id', id);
  if (error) return msg(error.message);
  refrescar();
}
async function setChaves(e, j, v){
  const { error } = await sb.from('chaves_enfrentamiento')
    .upsert({ id_enfrentamiento: e, id_jugador: j, chaves: v === '' ? 0 : Number(v) }, { onConflict: 'id_enfrentamiento,id_jugador' });
  if (error) return msg(error.message);
  msg(''); loadTable('chaves_enfrentamiento');
}
