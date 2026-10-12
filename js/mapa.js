// Selector de ubicación (OpenStreetMap + Leaflet). Devuelve un enlace de Google Maps al campo indicado.
let MAPA = null, MARCA = null, PICK = null, DEST = null;

function abrirMapa(idCampo){
  if (typeof L === 'undefined') return msg('No se pudo cargar el mapa. Revisa la conexión a internet.');
  DEST = idCampo; PICK = null; MARCA = null;
  const m = $('#' + idCampo).value.match(/(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  const ini = m ? [+m[1], +m[2]] : [42.8805, -8.5457];   // Santiago de Compostela
  const o = document.createElement('div');
  o.id = 'mapa'; o.className = 'sheet'; o.style.zIndex = 20;
  o.innerHTML = `<div class="in">
    <div class="fila"><h2>Elige el sitio</h2><button onclick="cerrarMapa()">Cerrar</button></div>
    <div class="fila"><input id="mq" type="search" placeholder="Buscar dirección o lugar" onkeydown="if(event.key==='Enter')buscarLugar()">
      <button onclick="buscarLugar()">Buscar</button></div>
    <div id="mapbox"></div><p class="mut" id="mtxt">Toca el mapa para marcar el sitio</p>
    <div class="bar"><button onclick="miUbicacion()">Mi ubicación</button>
      <button class="pri" onclick="usarUbicacion()">Usar este sitio</button></div></div>`;
  document.body.append(o);
  MAPA = L.map('mapbox').setView(ini, m ? 16 : 13);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(MAPA);
  if (m) poner(ini);
  MAPA.on('click', e => poner([e.latlng.lat, e.latlng.lng]));
  setTimeout(() => MAPA && MAPA.invalidateSize(), 100);
}

function poner(ll){
  PICK = ll;
  if (MARCA) MARCA.setLatLng(ll); else MARCA = L.marker(ll).addTo(MAPA);
  $('#mtxt').textContent = 'Sitio marcado: ' + ll.map(n => n.toFixed(5)).join(', ');
}

async function buscarLugar(){
  const q = $('#mq').value.trim(); if (!q) return;
  try {
    const r = await (await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q))).json();
    if (!r.length) return ($('#mtxt').textContent = 'No se encontró ese lugar.');
    const ll = [+r[0].lat, +r[0].lon];
    MAPA.setView(ll, 17); poner(ll);
  } catch (e) { $('#mtxt').textContent = 'No se pudo buscar. Toca el mapa para marcar el sitio.'; }
}

function miUbicacion(){
  if (!navigator.geolocation) return ($('#mtxt').textContent = 'Tu dispositivo no permite obtener la ubicación.');
  navigator.geolocation.getCurrentPosition(
    p => { const ll = [p.coords.latitude, p.coords.longitude]; MAPA.setView(ll, 17); poner(ll); },
    () => { $('#mtxt').textContent = 'No se pudo obtener tu ubicación (revisa el permiso).'; });
}

// Dirección a partir de las coordenadas (geocodificación inversa de OpenStreetMap / Nominatim)
async function direccionDe(lat, lon){
  const u = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=gl,es&lat=${lat}&lon=${lon}`;
  const r = await (await fetch(u)).json();
  if (!r || r.error) return null;
  const a = r.address || {};
  const calle = a.road || a.pedestrian || a.footway || a.path || a.cycleway || a.hamlet || a.neighbourhood || '';
  const via = [calle, a.house_number].filter(Boolean).join(' ');
  const poblacion = a.city || a.town || a.village || a.municipality || a.hamlet || '';
  const resto = [a.postcode, poblacion].filter(Boolean).join(' ');
  const direccion = [via, resto].filter(Boolean).join(', ') || (r.display_name || '').split(',').slice(0, 3).join(',').trim();
  return { direccion, localidad: poblacion };
}

// Rellena Dirección (y Localidad, si estaba vacía) en el formulario que haya debajo del mapa.
// Si ya había una dirección distinta, pregunta antes de sustituirla.
function rellenarDireccion(info){
  const dir = $('#f_direccion');
  if (dir && info.direccion && dir.value.trim() !== info.direccion) {
    if (!dir.value.trim() || confirm('¿Sustituir la dirección actual por esta?\n\n' + info.direccion)) dir.value = info.direccion;
  }
  const loc = $('#f_localidad');
  if (loc && !loc.value.trim() && info.localidad) loc.value = info.localidad;
}

async function usarUbicacion(){
  if (!PICK) return ($('#mtxt').textContent = 'Toca primero el mapa para marcar el sitio.');
  const [lat, lon] = PICK;
  $('#' + DEST).value = `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lon.toFixed(6)}`;
  $('#mtxt').textContent = 'Buscando la dirección…';
  let info = null;
  try { info = await direccionDe(lat, lon); } catch (e) {}
  cerrarMapa();
  if (!info) return msg('Ubicación guardada, pero no se pudo obtener la dirección automáticamente: escríbela a mano.');
  rellenarDireccion(info);
}

function cerrarMapa(){ if (MAPA) { MAPA.remove(); MAPA = null; } $('#mapa')?.remove(); }
