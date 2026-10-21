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

// Idioma de los mensajes: el panel usa castellano ('es') y la app pública gallego ('gl'; lo fija marcadorcargafe.js)
let ACTA_IDIOMA = 'es';
const _ACTA_TXT = {
  es: {
    pdfLib: () => 'No se pudo cargar la librería de PDF. Revisa la conexión a internet.',
    fmtPuntos: () => 'Formato no válido: usa números separados por «+», por ejemplo 1+2+8+0',
    fmtChaves: () => 'Formato no válido en las chaves: usa 1+2+1, con la tirada 1@3+2@7 (chaves@tirada) y una «r» para las chaves anuladas (1@3r)',
    tirNoCoinc: (a, b) => `las tiradas no coinciden: ${a} del local y ${b} del visitante`,
    tirDoble: (i, a, b) => `en la tirada ${i} puntúan los dos bandos (${a} y ${b})`,
    chavesNoCuadran: (i, n, a, b) => `tirada ${i}: ${n} puntos y chaves ${a}-${b} (¿chaves matadas o error?)`,
  },
  gl: {
    pdfLib: () => 'Non se puido cargar a librería de PDF. Comproba a conexión a internet.',
    fmtPuntos: () => 'Formato non válido: usa números separados por «+», por exemplo 1+2+8+0',
    fmtChaves: () => 'Formato non válido nas chaves: usa 1+2+1, coa tirada 1@3+2@7 (chaves@tirada) e unha «r» para as chaves anuladas (1@3r)',
    tirNoCoinc: (a, b) => `as tiradas non coinciden: ${a} do local e ${b} do visitante`,
    tirDoble: (i, a, b) => `na tirada ${i} puntúan os dous bandos (${a} e ${b})`,
    chavesNoCuadran: (i, n, a, b) => `tirada ${i}: ${n} puntos e chaves ${a}-${b} (chaves matadas ou erro?)`,
  },
};
const _actaT = (clave, ...args) => _ACTA_TXT[ACTA_IDIOMA][clave](...args);

function _actaCargarJsPdf(){
  return new Promise((ok, ko) => {
    if (window.jspdf) return ok();
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = ok;
    s.onerror = () => ko(new Error(_actaT('pdfLib')));
    document.head.append(s);
  });
}

async function _actaImagen(ruta){
  try {
    const blob = await (await fetch(ruta)).blob();
    return await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
  } catch (e) { return null; }
}

// Logo de las actas: icons/escudo-axc.svg, dibujado en un canvas y pasado a PNG (jsPDF no admite SVG).
// Si falla, se usa icons/escudo-256.png.
async function _actaLogoSvg(){
  try {
    let svg = await (await fetch('icons/escudo-axc.svg')).text();
    svg = svg.replace(/<svg\b([^>]*)>/i, (m, attrs) => {
      const w = (attrs.match(/\swidth="([\d.]+)(?:px)?"/i) || [])[1], h = (attrs.match(/\sheight="([\d.]+)(?:px)?"/i) || [])[1];
      let limpio = attrs.replace(/\s(width|height)="[^"]*"/gi, '');
      if (!/\sviewBox=/i.test(limpio) && w && h) limpio += ` viewBox="0 0 ${w} ${h}"`;   // sin viewBox, que escale como el original
      return `<svg${limpio} width="512" height="512">`;
    });
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
    const cv = document.createElement('canvas');
    cv.width = cv.height = 512;
    cv.getContext('2d').drawImage(img, 0, 0, 512, 512);
    URL.revokeObjectURL(url);
    return cv.toDataURL('image/png');
  } catch (e) { return _actaImagen('icons/escudo-256.png'); }
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

// ---- Chaves de un jugador: «1₃+2₇+1₁₀=4» (chaves y, en subíndice, la tirada en que se hicieron; total en negrita) ----
// entries: [{n, t}] (t = número de tirada, o null si no se sabe). Se dibuja segmento a segmento porque la fuente
// estándar del PDF no tiene subíndices: el número de tirada va en cuerpo pequeño y desplazado hacia abajo.
function _actaSegChaves(entries, s, conTotal){
  const segs = [];
  entries.forEach((e, i) => {
    const col = e.r ? [200, 0, 0] : null;   // chave anulada (matada): en rojo
    segs.push({ t: String(e.n), s, b: entries.length === 1 && conTotal, c: col });
    if (e.t != null) segs.push({ t: String(e.t), s: s * 0.62, dy: s * 0.3528 * 0.2, c: col });
    if (i < entries.length - 1) segs.push({ t: '+', s });
  });
  return segs;
}
function _actaAnchoSegs(doc, segs){
  return segs.reduce((w, sg) => { doc.setFont('helvetica', sg.b ? 'bold' : 'normal'); doc.setFontSize(sg.s); return w + doc.getTextWidth(sg.t); }, 0);
}
function _actaDibujarSegs(doc, segs, x, y){
  segs.forEach(sg => {
    doc.setFont('helvetica', sg.b ? 'bold' : 'normal'); doc.setFontSize(sg.s);
    doc.setTextColor(...(sg.c || [0, 0, 0]));
    doc.text(sg.t, x, y + (sg.dy || 0));
    x += doc.getTextWidth(sg.t);
  });
  doc.setTextColor(0, 0, 0);
}
function _actaChavesCeldas(doc, ch, x, yTop, w, hCelda, tamMax){
  let entries = [];
  try { entries = actaParseChaves(ch && ch.tiradas); } catch (e) {}
  if (!entries.length && ch && ch.total > 0) entries = [{ n: ch.total, t: null }];   // sin detalle de tiradas: solo el total
  if (!entries.length) return;
  const total = entries.reduce((s, e) => s + e.n, 0);
  const cierre = s => (entries.length > 1 ? [{ t: '=', s }, { t: String(total), s, b: true }] : []);
  const y1 = yTop + hCelda * 0.72, y2 = yTop + hCelda * 1.72;
  const mitad = Math.ceil(entries.length / 2);
  for (let s = tamMax; s >= 6.5; s -= 0.5) {
    const una = _actaSegChaves(entries, s, true).concat(cierre(s));
    if (_actaAnchoSegs(doc, una) <= w) { _actaDibujarSegs(doc, una, x, y1); return; }
    if (entries.length > 1) {
      const l1 = _actaSegChaves(entries.slice(0, mitad), s, false).concat([{ t: '+', s }]);
      const l2 = _actaSegChaves(entries.slice(mitad), s, false).concat(cierre(s));
      if (_actaAnchoSegs(doc, l1) <= w && _actaAnchoSegs(doc, l2) <= w) { _actaDibujarSegs(doc, l1, x, y1); _actaDibujarSegs(doc, l2, x, y2); return; }
    }
  }
  const s = 6.5;
  if (entries.length > 1) {
    _actaDibujarSegs(doc, _actaSegChaves(entries.slice(0, mitad), s, false).concat([{ t: '+', s }]), x, y1);
    _actaDibujarSegs(doc, _actaSegChaves(entries.slice(mitad), s, false).concat(cierre(s)), x, y2);
  } else _actaDibujarSegs(doc, _actaSegChaves(entries, s, true), x, y1);
}

// Firmas de las delegadas/os (imágenes dibujadas a mano en el móvil), en el hueco sobre «Fdo:»
function _actaFirmas(doc, c, by, bh){
  [[c.firmas && c.firmas.local, 18.5], [c.firmas && c.firmas.visitante, 108.4]].forEach(([f, bx]) => {
    if (!f || !f.data) return;
    const bw = 84;
    const k = Math.min(bw / f.w, bh / f.h), w = f.w * k, h = f.h * k;
    try { doc.addImage(f.data, 'PNG', bx + (bw - w) / 2, by + (bh - h) / 2, w, h); } catch (err) {}
  });
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
function _actaIncidencias(doc, texto, cfg){
  const ys = (cfg && cfg.ys) || [250.2, 260.7, 269.9, 279.2], xs = (cfg && cfg.xs) || [76.5, 18.5, 18.5, 18.5], ws = (cfg && cfg.ws) || [115, 173, 173, 173];
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
  if (c.logo) { try { doc.addImage(c.logo, c.logoFmt || 'PNG', 22.4, 19.4, 19, 19); } catch (err) {} }
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
  // El equipo ganador (más puntos) va en negrita; en caso de empate, ninguno
  const gp = p.puntosLocal != null && p.puntosVisit != null ? Math.sign(p.puntosLocal - p.puntosVisit) : 0;
  doc.setFont('helvetica', gp > 0 ? 'bold' : 'normal'); _actaTexto(doc, num(p.puntosLocal), 92.5, 98, 19, 11, { align: 'center' });
  doc.setFont('helvetica', gp < 0 ? 'bold' : 'normal'); _actaTexto(doc, num(p.puntosVisit), 180, 98, 19, 11, { align: 'center' });

  // Resultado global
  rect(18, 107.8, 174.5, 9.1);
  neg('RESULTADO GLOBAL POR PUNTOS:', 22.6, 113.6, 9.5);
  neg('Local:', 96.1, 113.6, 9.5);
  linea(109.6, 114.8, 136, 114.8);
  neg('Visitante:', 141.3, 113.6, 9.5);
  linea(161.2, 114.8, 187.7, 114.8);
  const gg = c.totalLocal != null && c.totalVisit != null ? Math.sign(c.totalLocal - c.totalVisit) : 0;
  doc.setFont('helvetica', gg > 0 ? 'bold' : 'normal'); _actaTexto(doc, num(c.totalLocal), 122.8, 113.9, 24, 11, { align: 'center' });
  doc.setFont('helvetica', gg < 0 ? 'bold' : 'normal'); _actaTexto(doc, num(c.totalVisit), 174.4, 113.9, 24, 11, { align: 'center' });

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
    _actaChavesCeldas(doc, ch, 85.5, yTop, 32, 6.15, 9.5);
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

  _actaFirmas(doc, c, 208, 27);
}

// ---- Liga MASCULINA: acta de 2 páginas (4 partidas por encuentro, que pueden acabar en cualquier orden) ----
// Página 1: resultados generales (nombres y puntos de cada partida, resultado global, delegados, incidencias).
// Página 2: desglose de tiradas y chaves de cada partida. Medidas tomadas de la plantilla oficial.
const _MASC_BLOQUES = [56.9, 95.2, 133.6, 171.7];     // y de la cabecera de cada «n.ª PARTIDA» de la página 1
const _MASC_TABLAS = [27.5, 92.1, 156.7, 221.4];      // y de cada tabla «n.ª PARTIDA» de la página 2

function _actaHerr(doc){
  return {
    rect: (x, y, w, h) => doc.rect(x, y, w, h),
    linea: (x1, y1, x2, y2) => doc.line(x1, y1, x2, y2 ?? y1),
    neg: (t, x, y, tam, opts) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(tam); doc.text(t, x, y, opts); },
    dato: (t, x, y, ancho, tam, opts) => { doc.setFont('helvetica', 'normal'); _actaTexto(doc, String(t ?? ''), x, y, ancho, tam, opts); },
  };
}

function _actaPaginaMasc1(doc, c){
  const { rect, linea, neg, dato } = _actaHerr(doc);
  const P = {}; (c.partidas || []).forEach(p => { P[p.numero] = p; });
  const num = v => (v == null ? '' : String(v));
  doc.setDrawColor(...ACTA_ROJO); doc.setLineWidth(0.3); doc.setTextColor(0, 0, 0);

  // Cabecera
  rect(18.0, 15.9, 174.4, 25.7);
  if (c.logo) { try { doc.addImage(c.logo, c.logoFmt || 'PNG', 22.0, 18.8, 19.8, 19.8); } catch (err) {} }
  neg('ASOCIACIÓN DE XOGADORES DA CHAVE DE SANTIAGO', 46.0, 23.8, 13);
  neg('ACTA do encontro celebrado o día:', 46.0, 30.7, 10);
  linea(106.9, 31.35, 188.4, 31.35);
  dato(c.fecha, 108, 30.5, 79, 10);
  neg('Campo de xogo:', 46.0, 37.0, 10);
  linea(75.7, 37.75, 188.4, 37.75);
  dato(c.campo, 77, 36.9, 111, 10);

  // Equipos
  rect(18.1, 44.8, 174.1, 8.7);
  linea(105.1, 44.8, 105.1, 53.5);
  neg('Equipo Local:', 21.4, 50.5, 10);
  linea(46.8, 51.25, 101.8, 51.25);
  dato(c.local, 47.8, 50.4, 53, 10);
  neg('Equipo Visitante:', 108.3, 50.5, 10);
  linea(139.2, 51.25, 188.9, 51.25);
  dato(c.visitante, 140.2, 50.4, 48, 10);

  // Las 4 partidas (pueden estar sin jugar: quedan en blanco)
  _MASC_BLOQUES.forEach((y0, i) => {
    const n = i + 1, p = P[n] || {};
    rect(18.0, y0, 174.4, 6.1);
    neg(`${n}.ª PARTIDA`, 105.6, y0 + 4.0, 9.5, { align: 'center' });
    rect(18.0, y0 + 6.1, 174.4, 32.2);
    linea(105.1, y0 + 6.1, 105.1, y0 + 38.3);
    neg('Nome Xogadores', 61.8, y0 + 10.6, 8.5, { align: 'center' });
    neg('Nome Xogadores', 149.0, y0 + 10.6, 8.5, { align: 'center' });
    [[p.jugadoresLocal || [], 20.9, 102.4], [p.jugadoresVisit || [], 107.9, 189.4]].forEach(([js, x1, x2]) => {
      [y0 + 17.7, y0 + 25.1].forEach((y, k) => {
        linea(x1, y, x2);
        dato(js[k] || '', x1 + 0.7, y - 1, x2 - x1 - 1.4, 10);
      });
    });
    neg(`Puntos ${n}.ª Partida:`, 20.9, y0 + 33.6, 9);
    linea(82.5, y0 + 34.15, 102.3, y0 + 34.15);
    neg(`Puntos ${n}.ª Partida:`, 107.9, y0 + 33.6, 9);
    linea(169.6, y0 + 34.15, 189.4, y0 + 34.15);
    const g = p.puntosLocal != null && p.puntosVisit != null ? Math.sign(p.puntosLocal - p.puntosVisit) : 0;   // gana: negrita
    doc.setFont('helvetica', g > 0 ? 'bold' : 'normal'); _actaTexto(doc, num(p.puntosLocal), 92.4, y0 + 33.5, 19, 11, { align: 'center' });
    doc.setFont('helvetica', g < 0 ? 'bold' : 'normal'); _actaTexto(doc, num(p.puntosVisit), 179.5, y0 + 33.5, 19, 11, { align: 'center' });
  });

  // Resultado global
  rect(18.0, 213.5, 174.4, 9.5);
  neg('RESULTADO GLOBAL POR PUNTOS:', 23.0, 219.6, 10.5);
  neg('Local:', 96.3, 219.6, 10.5);
  linea(109.5, 220.55, 136.0, 220.55);
  neg('Visitante:', 141.3, 219.6, 10.5);
  linea(160.9, 220.55, 187.4, 220.55);
  const gg = c.totalLocal != null && c.totalVisit != null ? Math.sign(c.totalLocal - c.totalVisit) : 0;
  doc.setFont('helvetica', gg > 0 ? 'bold' : 'normal'); _actaTexto(doc, num(c.totalLocal), 122.8, 219.7, 24, 11, { align: 'center' });
  doc.setFont('helvetica', gg < 0 ? 'bold' : 'normal'); _actaTexto(doc, num(c.totalVisit), 174.2, 219.7, 24, 11, { align: 'center' });

  // Delegados, firmas e incidencias
  neg('Delegado equipo local:', 18.0, 231.2, 9.5);
  neg('Delegado equipo visitante:', 107.8, 231.2, 9.5);
  neg('Fdo:____________________', 18.0, 251.6, 9.5);
  neg('Fdo:____________________', 107.8, 251.6, 9.5);
  neg('INCIDENCIAS / OBSERVACIÓNS:', 18.0, 260.1, 10);
  linea(75.4, 260.75, 192.3, 260.75);
  [267.15, 275.05, 282.95].forEach(y => linea(18.0, y, 192.4, y));
  if (c.incidencias) _actaIncidencias(doc, c.incidencias, { ys: [259.6, 266.1, 274.0, 281.9], xs: [76.4, 18.6, 18.6, 18.6], ws: [115, 173, 173, 173] });
  _actaFirmas(doc, c, 233, 17.5);
}

function _actaPaginaMasc2(doc, c){
  const { rect, linea, neg, dato } = _actaHerr(doc);
  const P = {}; (c.partidas || []).forEach(p => { P[p.numero] = p; });
  doc.setDrawColor(...ACTA_ROJO); doc.setLineWidth(0.3); doc.setTextColor(0, 0, 0);
  rect(18.0, 15.9, 174.4, 7.9);
  neg('ANOTACIÓN INDIVIDUAL DE TIRADAS', 105.2, 21.2, 11, { align: 'center' });

  _MASC_TABLAS.forEach((T, i) => {
    const n = i + 1, p = P[n] || {};
    rect(18.0, T, 174.4, 60.6);
    rect(18.0, T, 174.4, 6.3);
    neg(`${n}.ª PARTIDA`, 105.6, T + 4.2, 9.5, { align: 'center' });
    rect(18.0, T + 6.4, 174.4, 5.6);                                   // fila de títulos
    neg('Equipo', 19.9, T + 10.1, 8.5);
    neg('Nome Xogadores', 39.5, T + 10.1, 8.5);
    neg('Chaves', 101.75, T + 10.1, 8.5, { align: 'center' });
    neg('Puntos', 155.6, T + 10.1, 8.5, { align: 'center' });
    [37.0, 84.1, 119.1].forEach(x => linea(x, T + 6.4, x, T + 60.6));  // columnas
    const filas = [T + 11.9, T + 24.1, T + 36.3, T + 48.4];             // arriba de cada jugador
    linea(18.0, T + 11.85, 192.4, T + 11.85);
    linea(37.3, T + 24.0, 119.3, T + 24.0);
    linea(18.0, T + 36.1, 192.4, T + 36.1);                              // separa local / visitante
    linea(37.3, T + 48.3, 119.3, T + 48.3);
    filas.forEach(y => linea(84.4, y + 5.85, 119.1, y + 5.85));          // dos casillas de chaves por jugador
    neg('Local', 19.9, T + 25.2, 8.5);
    neg('Visitante', 19.9, T + 49.2, 8.5);
    const nombres = [(p.jugadoresLocal || [])[0], (p.jugadoresLocal || [])[1], (p.jugadoresVisit || [])[0], (p.jugadoresVisit || [])[1]];
    filas.forEach((y, k) => {
      dato(nombres[k] ? `${(k % 2) + 1}. ${nombres[k]}` : `${(k % 2) + 1}.`, 39.5, y + 7.2, 44, 9.5);
      _actaChavesCeldas(doc, (p.chaves || [])[k] || {}, 85.6, y, 32, 6.0, 9);
    });
    _actaSecuenciaCaja(doc, p.tiradasLocal || (p.puntosLocal != null ? String(p.puntosLocal) : ''), 121, T + 12.6, 69.5, 22.6, 10);
    _actaSecuenciaCaja(doc, p.tiradasVisit || (p.puntosVisit != null ? String(p.puntosVisit) : ''), 121, T + 37.0, 69.5, 22.6, 10);
  });
}

async function generarActaPdf(c){
  await _actaCargarJsPdf();
  const masc = c.liga === 'masculina';
  if (!c.logo) {
    // Femenina: escudo-axc.svg (convertido a PNG). Masculina: escudo-axc.jpg. Si falla, el otro formato.
    if (masc) { c.logo = await _actaImagen('icons/escudo-axc.jpg'); c.logoFmt = 'JPEG'; }
    if (!c.logo) { c.logo = await _actaLogoSvg(); c.logoFmt = 'PNG'; }
  }
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
  if (masc) { _actaPaginaMasc1(doc, c); doc.addPage(); _actaPaginaMasc2(doc, c); }
  else c.partidas.forEach((p, i) => { if (i) doc.addPage(); _actaPagina(doc, c, p); });
  await _actaEntregar(doc, (c.nombreArchivo || 'acta') + '.pdf');
}

// Entrega el PDF: en el móvil abre la hoja de compartir (guardar en Archivos/Drive, enviar por WhatsApp…);
// si no está disponible, o en escritorio, lo descarga.
async function _actaEntregar(doc, nombre){
  try {
    const movil = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '') && navigator.canShare;
    if (movil && typeof doc.output === 'function' && typeof File !== 'undefined') {
      const file = new File([doc.output('blob')], nombre, { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: nombre }); return; }
    }
  } catch (e) { if (e && e.name === 'AbortError') return; }   // el usuario cerró la hoja de compartir: no se descarga
  doc.save(nombre);
}

// Utilidades comunes a las dos apps ---------------------------------------------------------
// Chaves: «1+2+1» (chaves por tirada), con la tirada en que se hicieron «1@3+2@7» y, si la chave se anuló
// (chaves matadas: los dos bandos dan a la chave en la misma tirada), una «r» detrás: «1@3r» (sale en rojo en el acta)
function actaParseChaves(s){
  const x = String(s ?? '').replace(/\s+/g, '');
  if (!x) return [];
  if (!/^\d+(@\d+)?r?(\+\d+(@\d+)?r?)*$/.test(x)) throw new Error(_actaT('fmtChaves'));
  return x.split('+').map(p => { const m = p.match(/^(\d+)(?:@(\d+))?(r?)$/); return { n: Number(m[1]), t: m[2] == null ? null : Number(m[2]), r: m[3] === 'r' }; });
}
const actaChavesTexto = arr => arr.map(e => `${e.n}${e.t != null ? '@' + e.t : ''}${e.r ? 'r' : ''}`).join('+');
const actaSumaChaves = arr => arr.reduce((s, e) => s + e.n, 0);

// Combinaciones posibles en una tirada. n = puntos anotados; cS = chaves del bando que puntúa; cO = chaves del otro.
// Las chaves de los dos bandos en la misma tirada se anulan (8-8, 16-8, 16-16): por eso salen «matadas» y en rojo.
const _ACTA_FINALES = {
  0: { normal: [], matadas: [[2, 2]] },
  1: { normal: [[0, 0]], matadas: [[1, 1]] },
  2: { normal: [[0, 0]], matadas: [] },
  8: { normal: [[1, 0]], matadas: [[2, 1]] },
  9: { normal: [[1, 0]], matadas: [] },
  16: { normal: [[2, 0]], matadas: [] },
};
// 'normal' | 'matadas' (anulación posible) | 'incompleta' (puede completarse con más chaves) | 'invalida'
function actaClasificar(n, cS, cO){
  const f = _ACTA_FINALES[n];
  if (!f) return 'invalida';
  const igual = x => x[0] === cS && x[1] === cO;
  if (f.normal.some(igual)) return 'normal';
  if (f.matadas.some(igual)) return 'matadas';
  return [...f.normal, ...f.matadas].some(x => cS <= x[0] && cO <= x[1]) ? 'incompleta' : 'invalida';
}

// Revisa tiradas ya escritas: avisa de las que tienen puntos y chaves que no cuadran (y no llevan chaves anuladas)
function actaRevisarCoherencia(pa, pb, ch){
  const av = [];
  const largo = Math.max(pa.length, pb.length);
  for (let i = 0; i < largo; i++) {
    const t = i + 1, a = pa[i] || 0, b = pb[i] || 0;
    let cA = 0, cB = 0, hayRoja = false, hayTirada = false;
    Object.entries(ch || {}).forEach(([k, arr]) => arr.forEach(e => {
      if (e.t !== t) return;
      hayTirada = true; if (e.r) hayRoja = true;
      if (k[0] === 'a') cA += e.n; else cB += e.n;
    }));
    if (hayRoja) continue;
    const n = Math.max(a, b);
    const cls = n === 0 ? actaClasificar(0, cA, cB) : (a >= b ? actaClasificar(n, cA, cB) : actaClasificar(n, cB, cA));
    const hayChaves = cA + cB > 0;
    if ((cls === 'invalida' && hayChaves) || (cls === 'incompleta' && (hayChaves || n >= 8))) av.push(_actaT('chavesNoCuadran', t, n, cA, cB));
  }
  return av;
}

// Ventana con varias opciones; devuelve el índice elegido
function actaOpciones(titulo, texto, opciones){
  return new Promise(resolve => {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:400;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:14px';
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    ov.innerHTML = `<div style="background:#fff;color:#111;border-radius:14px;padding:16px;max-width:420px;width:100%;font:15px system-ui,-apple-system,sans-serif">
      <h3 style="margin:0 0 6px;font-size:17px">${esc(titulo)}</h3>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.4;color:#333">${esc(texto)}</p>
      <div style="display:flex;flex-direction:column;gap:8px">${opciones.map((o, i) => `<button type="button" data-i="${i}" style="font:inherit;font-size:14px;padding:11px 12px;border:1px solid ${i === 0 ? '#7a1f35' : '#bbb'};border-radius:10px;background:${i === 0 ? '#7a1f35' : '#f4f4f4'};color:${i === 0 ? '#fff' : '#111'};text-align:left">${esc(o)}</button>`).join('')}</div></div>`;
    document.body.append(ov);
    ov.addEventListener('click', ev => { const b = ev.target.closest('button'); if (!b) return; ov.remove(); resolve(Number(b.dataset.i)); });
  });
}

// Revisión de las tiradas de puntos: mismo número de tiradas en los dos bandos y puntos en un solo bando por tirada
function actaRevisarTiradas(a, b){
  const av = [];
  if (a.length !== b.length) av.push(_actaT('tirNoCoinc', a.length, b.length));
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] > 0 && b[i] > 0) { av.push(_actaT('tirDoble', i + 1, a[i], b[i])); break; }
  }
  return av;
}
// «1+2+8+0» → [1,2,8,0]; vacío → []; lanza un error si el formato no es válido
function actaParseSecuencia(s){
  const t = String(s ?? '').replace(/\s+/g, '');
  if (!t) return [];
  if (!/^\d+(\+\d+)*$/.test(t)) throw new Error(_actaT('fmtPuntos'));
  return t.split('+').map(Number);
}
const actaSuma = arr => arr.reduce((s, v) => s + v, 0);
function actaNombreArchivo(local, visitante, fecha){
  const l = t => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `acta_${l(local)}_vs_${l(visitante)}_${fecha ? l(fecha) : 'sin_fecha'}`;
}

// ---- Panel de firmas: dos recuadros para firmar con el dedo o un lápiz táctil ----
// Sin conEnvio (panel de administración): botones «Generar acta firmada» / «Generar sin firmas» / «Cancelar»;
//   devuelve {local, visitante} (cada uno {data, w, h} o null si se dejó en blanco) o null si se cancela.
// Con conEnvio (Marcador): directamente «Enviar resultado con acta» / «Xerar acta» / «Cancelar»;
//   devuelve {accion: 'enviar'|'xerar'|'cancelar', local, visitante}.
function actaPedirFirmas(idioma, conEnvio){
  const T = idioma === 'gl'
    ? { titulo: 'Firmas', ayuda: 'Cada delegada pode asinar co dedo ou cun lapis táctil. Se non se asina, a acta xérase cos espazos en branco.', loc: 'Delegada equipo local', vis: 'Delegada equipo visitante', borrar: 'Borrar', firmada: 'Xerar acta firmada', sin: 'Xerar sen firmas', cancelar: 'Cancelar', enviar: 'Enviar resultado con acta', xerar: 'Pechar acta' }
    : { titulo: 'Firmas', ayuda: 'Cada delegada puede firmar con el dedo o con un lápiz táctil. Si no se firma, el acta se genera con los espacios en blanco.', loc: 'Delegada equipo local', vis: 'Delegada equipo visitante', borrar: 'Borrar', firmada: 'Generar acta firmada', sin: 'Generar sin firmas', cancelar: 'Cancelar', enviar: 'Enviar resultado con acta', xerar: 'Generar acta' };
  return new Promise(resolve => {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.6);display:flex;align-items:flex-start;justify-content:center;padding:10px;overflow:auto;-webkit-overflow-scrolling:touch';
    const btn = 'font:inherit;font-size:14px;padding:10px 14px;border:1px solid #bbb;border-radius:10px;background:#f4f4f4;color:#111';
    const pri = `${btn};background:#7a1f35;color:#fff;border-color:#7a1f35`;
    const botonesInicial = conEnvio
      ? `<button type="button" data-acc="enviar" style="${pri}">${T.enviar}</button><button type="button" data-acc="xerar" style="${btn}">${T.xerar}</button><button type="button" data-acc="cancelar" style="${btn}">${T.cancelar}</button>`
      : `<button type="button" data-acc="firmada" style="${pri}">${T.firmada}</button><button type="button" data-acc="sin" style="${btn}">${T.sin}</button><button type="button" data-acc="cancelar" style="${btn}">${T.cancelar}</button>`;
    ov.innerHTML = `<div style="background:#fff;color:#111;border-radius:14px;padding:14px;max-width:560px;width:100%;font:15px system-ui,-apple-system,sans-serif">
      <h3 style="margin:0 0 4px;font-size:18px">${T.titulo}</h3>
      <p style="margin:0 0 6px;font-size:13px;color:#555">${T.ayuda}</p>
      ${[T.loc, T.vis].map((tit, i) => `<div style="margin:10px 0"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><b style="font-size:14px">${tit}</b><button type="button" data-borrar="${i}" style="${btn};padding:6px 12px">${T.borrar}</button></div>
        <canvas data-firma="${i}" style="width:100%;height:150px;border:2px dashed #999;border-radius:10px;background:#fff;touch-action:none;display:block"></canvas></div>`).join('')}
      <div data-botones style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">${botonesInicial}</div></div>`;
    document.body.append(ov);
    const lienzos = [...ov.querySelectorAll('canvas')], tiene = [false, false];
    const dpr = window.devicePixelRatio || 1;
    lienzos.forEach((cv, i) => {
      const r = cv.getBoundingClientRect();
      cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
      const cx = cv.getContext('2d');
      cx.scale(dpr, dpr); cx.lineWidth = 2.4; cx.lineCap = 'round'; cx.lineJoin = 'round'; cx.strokeStyle = '#111';
      let dibujando = false;
      const pos = ev => { const q = cv.getBoundingClientRect(); return [ev.clientX - q.left, ev.clientY - q.top]; };
      cv.addEventListener('pointerdown', ev => { dibujando = true; cv.setPointerCapture(ev.pointerId); const [x, y] = pos(ev); cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x + 0.01, y + 0.01); cx.stroke(); tiene[i] = true; ev.preventDefault(); });
      cv.addEventListener('pointermove', ev => { if (!dibujando) return; const [x, y] = pos(ev); cx.lineTo(x, y); cx.stroke(); cx.beginPath(); cx.moveTo(x, y); ev.preventDefault(); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => cv.addEventListener(n, () => { dibujando = false; }));
    });
    const firma = i => (tiene[i] ? { data: lienzos[i].toDataURL('image/png'), w: lienzos[i].width, h: lienzos[i].height } : null);
    const cerrar = v => { ov.remove(); resolve(v); };
    ov.addEventListener('click', ev => {
      const b = ev.target.closest('button'); if (!b) return;
      if (b.dataset.borrar != null) { const i = Number(b.dataset.borrar), cv = lienzos[i]; cv.getContext('2d').clearRect(0, 0, cv.width / dpr, cv.height / dpr); tiene[i] = false; return; }
      const acc = b.dataset.acc;
      if (acc === 'cancelar') return cerrar(conEnvio ? { accion: 'cancelar', local: null, visitante: null } : null);
      if (acc === 'sin') return cerrar({ local: null, visitante: null });
      if (acc === 'firmada') return cerrar({ local: firma(0), visitante: firma(1) });
      cerrar({ accion: acc, local: firma(0), visitante: firma(1) });   // enviar | xerar
    });
  });
}
