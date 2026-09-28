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

function usarUbicacion(){
  if (!PICK) return ($('#mtxt').textContent = 'Toca primero el mapa para marcar el sitio.');
  $('#' + DEST).value = `https://www.google.com/maps/search/?api=1&query=${PICK[0].toFixed(6)},${PICK[1].toFixed(6)}`;
  cerrarMapa();
}

function cerrarMapa(){ if (MAPA) { MAPA.remove(); MAPA = null; } $('#mapa')?.remove(); }
