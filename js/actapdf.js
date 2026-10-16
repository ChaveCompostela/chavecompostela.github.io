// Generador compartido del PDF «Acta do encontro» de la liga feminina (una partida por encuentro).
// Lo usan el panel (acta.js) y el Marcador de la app pública. No depende de ningún dato global:
// recibe todo en un objeto.
//
//   generarActaPdf({
//     fecha, campo, local, visitante,            // textos de la cabecera
//     totalLocal, totalVisit,                    // resultado global por puntos (o null)
//     nombreArchivo,                             // sin extensión
//     partidas: [{
//       numero, jugadoresLocal: [n1, n2], jugadoresVisit: [n1, n2],
//       puntosLocal, puntosVisit,                // totales de la partida (o null)
//       tiradasLocal, tiradasVisit,              // '1+2+8+0' (o '' si no hay detalle)
//       chaves: [ {total, tiradas}, ×4 ]         // local1, local2, visitante1, visitante2
//     }]
//   })
// Una página por partida. Delegadas, firmas e incidencias quedan en blanco para rellenar a mano.
// jsPDF se descarga de cdnjs la primera vez que se pide un acta.

const ACTA_ROJO = [153, 0, 0];

function _actaCargarJsPdf(){
  return new Promise((ok, ko) => {
    if (window.jspdf) return ok();
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = ok;
    s.onerror = () => ko(new Error('No se pudo cargar la librería de PDF. Revisa la conexión a internet.'));
    document.head.append(s);
  });
}

async function _actaImagen(ruta){
  try {
    const blob = await (await fetch(ruta)).blob();
    return await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
  } catch (e) { return null; }
}

// Texto en una línea, reduciendo el cuerpo hasta que quepa en el ancho dado
function _actaTexto(doc, t, x, y, anchoMax, tam, opts){
  let s = tam;
  doc.setFontSize(s);
  while (s > 6 && doc.getTextWidth(t) > anchoMax) { s -= 0.5; doc.setFontSize(s); }
  doc.text(t, x, y, opts);
}

// Secuencia «1+2+8+0» en una caja: parte en líneas por los «+» y reduce el cuerpo hasta que quepa
function _actaSecuenciaCaja(doc, seq, x, y, w, h, tamMax){
  if (!seq) return;
  const tk = String(seq).split('+');
  doc.setFont('helvetica', 'normal');
  for (let s = tamMax; s >= 6; s -= 0.5) {
    doc.setFontSize(s);
    const lh = s * 0.41;
    const lineas = [];
    let cur = '';
    tk.forEach((t, i) => {
      const trozo = t + (i < tk.length - 1 ? '+' : '');
      if (cur && doc.getTextWidth(cur + trozo) > w) { lineas.push(cur); cur = trozo; } else cur += trozo;
    });
    if (cur) lineas.push(cur);
    if (lineas.length * lh <= h || s === 6) {
      lineas.forEach((l, k) => doc.text(l, x, y + lh * (k + 0.85)));
      return;
    }
  }
}

// Secuencia de chaves en las dos celdas apiladas de cada jugador: una línea si cabe; si no, se reparte en dos
function _actaSecuenciaCeldas(doc, seq, x, yTop, w, hCelda, tamMax){
  if (!seq) return;
  const tk = String(seq).split('+');
  const mitad = Math.ceil(tk.length / 2);
  const l1 = tk.length > 1 ? tk.slice(0, mitad).join('+') + '+' : seq;
  const l2 = tk.length > 1 ? tk.slice(mitad).join('+') : '';
  doc.setFont('helvetica', 'normal');
  for (let s = tamMax; s >= 6; s -= 0.5) {
    doc.setFontSize(s);
    if (doc.getTextWidth(String(seq)) <= w) { doc.text(String(seq), x, yTop + hCelda * 0.72); return; }
    if (l2 && doc.getTextWidth(l1) <= w && doc.getTextWidth(l2) <= w) {
      doc.text(l1, x, yTop + hCelda * 0.72);
      doc.text(l2, x, yTop + hCelda * 1.72);
      return;
    }
  }
  if (l2) { doc.text(l1, x, yTop + hCelda * 0.72); doc.text(l2, x, yTop + hCelda * 1.72); }
  else doc.text(String(seq), x, yTop + hCelda * 0.72);
}

// Texto de incidencias sobre las 4 líneas del formulario (la primera es más corta: va tras el rótulo)
function _actaEnvolver(doc, texto, anchos){
  const lineas = [];
  String(texto).split(/\r?\n/).forEach(par => {
    let cur = '';
    par.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).forEach(w => {
      const max = anchos[Math.min(lineas.length, anchos.length - 1)];
      if (cur && doc.getTextWidth(cur + ' ' + w) > max) { lineas.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
    });
    if (cur) lineas.push(cur);
  });
  return lineas;
}
function _actaIncidencias(doc, texto){
  const ys = [250.2, 260.7, 269.9, 279.2], xs = [76.5, 18.5, 18.5, 18.5], ws = [115, 173, 173, 173];
  doc.setFont('helvetica', 'normal');
  for (let s = 9; s >= 7; s -= 0.5) {
    doc.setFontSize(s);
    const lineas = _actaEnvolver(doc, texto, ws);
    if (lineas.length <= 4 || s === 7) {
      if (lineas.length > 4) lineas[3] = lineas[3].slice(0, -3) + '...';
      lineas.slice(0, 4).forEach((l, i) => doc.text(l, xs[i], ys[i]));
      return;
    }
  }
}

function _actaPagina(doc, c, p){
  const rect = (x, y, w, h) => doc.rect(x, y, w, h);
  const linea = (x1, y1, x2, y2) => doc.line(x1, y1, x2, y2 ?? y1);
  const neg = (t, x, y, tam, opts) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(tam); doc.text(t, x, y, opts); };
  const dato = (t, x, y, ancho, tam, opts) => { doc.setFont('helvetica', 'normal'); _actaTexto(doc, String(t ?? ''), x, y, ancho, tam, opts); };
  const num = v => (v == null ? '' : String(v));
  const n = p.numero;

  doc.setDrawColor(...ACTA_ROJO);
  doc.setLineWidth(0.3);
  doc.setTextColor(0, 0, 0);

  // Cabecera
  rect(18.3, 16, 174.7, 25.6);
  if (c.logo) { try { doc.addImage(c.logo, 'PNG', 22.4, 19.4, 19, 19); } catch (err) {} }
  neg('ASOCIACIÓN DE XOGADORAS DA CHAVE DE SANTIAGO', 46.5, 24.2, 13);
  neg('ACTA do encontro celebrado o día:', 46.5, 30.2, 9.5);
  linea(107.3, 31.5, 189, 31.5);
  dato(c.fecha, 108.5, 30.6, 79, 10);
  neg('Campo de xogo:', 46.5, 36.5, 9.5);
  linea(75.8, 38, 189, 38);
  dato(c.campo, 77, 37.1, 111, 10);

  // Equipos
  rect(18.3, 52.3, 174.7, 8.7);
  linea(105.5, 52.3, 105.5, 61);
  neg('Equipo Local:', 21.5, 57.7, 9.5);
  linea(47, 58.9, 102.3, 58.9);
  dato(c.local, 48, 57.9, 53, 10);
  neg('Equipo Visitante:', 108.7, 57.7, 9.5);
  linea(139.7, 58.9, 189.7, 58.9);
  dato(c.visitante, 140.5, 57.9, 48, 10);

  // Partida: nombres y puntos
  rect(18.3, 64.6, 174.7, 5.9);
  neg('PARTIDA', 105.65, 68.8, 9, { align: 'center' });
  rect(18.3, 70.5, 174.7, 32.5);
  linea(105.5, 70.5, 105.5, 103);
  neg('Nome Xogadoras', 61.9, 74.6, 8.5, { align: 'center' });
  neg('Nome Xogadoras', 149.2, 74.6, 8.5, { align: 'center' });
  [[p.jugadoresLocal || [], 20.8, 102.7], [p.jugadoresVisit || [], 108.2, 190.2]].forEach(([js, x1, x2]) => {
    [82.2, 89.7].forEach((y, i) => {
      linea(x1, y, x2);
      dato(js[i] || '', x1 + 0.7, y - 1, x2 - x1 - 1.4, 10);
    });
  });
  neg(`Puntos ${n}.ª Partida:`, 21, 97.3, 8.5);
  linea(82.4, 99, 102.7, 99);
  neg(`Puntos ${n}.ª Partida:`, 108.4, 97.3, 8.5);
  linea(170, 99, 190.2, 99);
  doc.setFont('helvetica', 'bold');
  _actaTexto(doc, num(p.puntosLocal), 92.5, 98, 19, 11, { align: 'center' });
  _actaTexto(doc, num(p.puntosVisit), 180, 98, 19, 11, { align: 'center' });

  // Resultado global
  rect(18, 107.8, 174.5, 9.1);
  neg('RESULTADO GLOBAL POR PUNTOS:', 22.6, 113.6, 9.5);
  neg('Local:', 96.1, 113.6, 9.5);
  linea(109.6, 114.8, 136, 114.8);
  neg('Visitante:', 141.3, 113.6, 9.5);
  linea(161.2, 114.8, 187.7, 114.8);
  doc.setFont('helvetica', 'bold');
  _actaTexto(doc, num(c.totalLocal), 122.8, 113.9, 24, 11, { align: 'center' });
  _actaTexto(doc, num(c.totalVisit), 174.4, 113.9, 24, 11, { align: 'center' });

  // Anotación individual de tiradas
  rect(17.6, 126, 174.6, 7.8);
  neg('ANOTACIÓN INDIVIDUAL DE TIRADAS', 104.9, 131.2, 10.5, { align: 'center' });
  rect(17.6, 137.7, 174.6, 5.7);
  neg('PARTIDA', 104.9, 141.8, 9, { align: 'center' });
  rect(17.6, 143.4, 174.6, 5.9);
  neg('Equipo', 18.7, 147.5, 8.5);
  neg('Nome Xogadoras', 38, 147.5, 8.5);
  neg('Chaves', 101.35, 147.5, 8.5, { align: 'center' });
  neg('Puntos', 155.5, 147.5, 8.5, { align: 'center' });
  rect(17.6, 149.3, 174.6, 48.9);
  [36.5, 83.8, 118.9].forEach(x => linea(x, 143.4, x, 198.2));
  linea(17.6, 173.7, 192.2, 173.7);
  [161.6, 185.95].forEach(y => linea(36.5, y, 118.9, y));
  [155.45, 167.65, 179.8, 192.1].forEach(y => linea(83.8, y, 118.9, y));
  neg('Local', 19, 162.5, 8.5);
  neg('Visitante', 19, 186.5, 8.5);
  const nombres = [(p.jugadoresLocal || [])[0], (p.jugadoresLocal || [])[1], (p.jugadoresVisit || [])[0], (p.jugadoresVisit || [])[1]];
  [[149.3, 155.7], [161.6, 167.8], [173.7, 180.1], [185.95, 192.2]].forEach(([yTop, yTxt], i) => {
    dato(nombres[i] ? `${(i % 2) + 1}. ${nombres[i]}` : `${(i % 2) + 1}.`, 38, yTxt, 44, 9.5);
    const ch = (p.chaves || [])[i] || {};
    _actaSecuenciaCeldas(doc, actaChavesConTotal(ch), 85.5, yTop, 32, 6.15, 9.5);
  });
  // Columna «Puntos»: tiradas de cada bando (sin detalle: solo el total)
  _actaSecuenciaCaja(doc, p.tiradasLocal || num(p.puntosLocal), 121, 150.3, 69.5, 22.6, 10);
  _actaSecuenciaCaja(doc, p.tiradasVisit || num(p.puntosVisit), 121, 174.7, 69.5, 22.6, 10);

  // Delegadas, firmas e incidencias (a mano)
  neg('Delegada equipo local:', 18, 205.8, 9);
  neg('Delegada equipo visitante:', 108.2, 205.8, 9);
  neg('Fdo:____________________', 18.5, 237.5, 9);
  neg('Fdo:____________________', 108.4, 239.2, 9);
  neg('INCIDENCIAS / OBSERVACIÓNS:', 18, 250.7, 9);
  linea(75.6, 251.2, 193.2, 251.2);
  [261.6, 270.8, 280.1].forEach(y => linea(18, y, 193.2, y));
  if (c.incidencias) _actaIncidencias(doc, c.incidencias);
}

async function generarActaPdf(c){
  await _actaCargarJsPdf();
  c.logo = c.logo || await _actaImagen('icons/escudo-256.png');
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
  c.partidas.forEach((p, i) => { if (i) doc.addPage(); _actaPagina(doc, c, p); });
  doc.save((c.nombreArchivo || 'acta') + '.pdf');
}

// Utilidades comunes a las dos apps ---------------------------------------------------------
// Chaves de un jugador para el acta: «1+2+1+1=5» (varias tiradas) o «2» (una sola). Sin tiradas, solo el total; sin chaves, vacío.
function actaChavesConTotal(ch){
  const arr = ch && ch.tiradas ? String(ch.tiradas).split('+').map(Number).filter(n => !isNaN(n)) : [];
  if (arr.length > 1) return `${arr.join('+')}=${arr.reduce((s, v) => s + v, 0)}`;
  if (arr.length === 1) return String(arr[0]);
  return ch && ch.total > 0 ? String(ch.total) : '';
}
// Revisión de las tiradas de puntos: mismo número de tiradas en los dos bandos y puntos en un solo bando por tirada
function actaRevisarTiradas(a, b){
  const av = [];
  if (a.length !== b.length) av.push(`las tiradas no coinciden: ${a.length} del local y ${b.length} del visitante`);
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] > 0 && b[i] > 0) { av.push(`en la tirada ${i + 1} puntúan los dos bandos (${a[i]} y ${b[i]})`); break; }
  }
  return av;
}
// «1+2+8+0» → [1,2,8,0]; vacío → []; lanza un error si el formato no es válido
function actaParseSecuencia(s){
  const t = String(s ?? '').replace(/\s+/g, '');
  if (!t) return [];
  if (!/^\d+(\+\d+)*$/.test(t)) throw new Error('Formato no válido: usa números separados por «+», por ejemplo 1+2+8+0');
  return t.split('+').map(Number);
}
const actaSuma = arr => arr.reduce((s, v) => s + v, 0);
function actaNombreArchivo(local, visitante, fecha){
  const l = t => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `acta_${l(local)}_vs_${l(visitante)}_${fecha ? l(fecha) : 'sin_fecha'}`;
}
