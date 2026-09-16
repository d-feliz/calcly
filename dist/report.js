import { calculate, round } from './model.js';

const PAGE = { width: 595, height: 842, scale: 3 };
const colors = { ink: '#21372b', muted: '#69776b', green: '#c8f477', purple: '#a798d5',
  orange: '#e7b37e', line: '#e3e8e1', paper: '#fafbf7', white: '#ffffff' };
const money = n => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n);
const percent = n => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(n) + '%';

// The same local canvas drawing code is used by the browser and the PDF visual checks.
// Render one page at a time so lengthy expense lists don't retain large canvases.
export function* renderReportPages(state, { createCanvas = () => document.createElement('canvas'), now = new Date() } = {}) {
  const c = calculate(state);
  let canvas, ctx, pageNumber = 0;
  function box(x, y, w, h, fill = colors.white, radius = 10) {
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill();
  }
  function text(value, x, y, size = 11, color = colors.ink, weight = '400', align = 'left', maxWidth = 531) {
    ctx.font = `${weight} ${size}px Arial, sans-serif`;
    while (ctx.measureText(String(value)).width > maxWidth && size > 7) {
      size -= .5; ctx.font = `${weight} ${size}px Arial, sans-serif`;
    }
    ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(String(value), x, y);
  }
  function wrapped(value, width, size = 10) {
    ctx.font = `400 ${size}px Arial, sans-serif`;
    const lines = []; let line = '';
    for (const char of String(value)) {
      if (ctx.measureText(line + char).width > width && line) { lines.push(line); line = ''; }
      line += char;
    }
    if (line) lines.push(line);
    return lines;
  }
  function line(y, x = 48, end = 547) {
    ctx.strokeStyle = colors.line; ctx.lineWidth = .7;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(end, y); ctx.stroke();
  }
  function pair(label, value, x, y, width, size = 10) {
    text(label, x, y, size, colors.muted, '400', 'left', width * .62);
    text(value, x + width, y, size, colors.ink, '600', 'right', width * .38);
  }
  function newPage(title) {
    canvas = createCanvas(); canvas.width = PAGE.width * PAGE.scale; canvas.height = PAGE.height * PAGE.scale;
    ctx = canvas.getContext('2d'); ctx.scale(PAGE.scale, PAGE.scale); pageNumber++;
    box(0, 0, PAGE.width, PAGE.height, colors.paper, 0);
    box(32, 27, 29, 29, colors.green, 8); text('c', 40, 49, 26, colors.ink, '700');
    text('calcly.', 70, 49, 25, colors.ink, '700');
    text('REPORTE MENSUAL · 2026', 563, 38, 9, colors.muted, '600', 'right');
    text(`Generado el ${now.toLocaleDateString('es-ES')}`, 563, 54, 9, colors.muted, '400', 'right');
    text(title, 32, 94, 26, colors.ink, '600');
    line(801, 32, 563);
    text('Tus cifras se quedan en tu dispositivo.', 32, 819, 9, colors.muted);
    text(`calcly.  /  ${pageNumber}`, 563, 819, 9, colors.muted, '400', 'right');
  }

  newPage('Tu mes, con todos los números claros.');
  box(32, 116, 531, 144, colors.ink, 12);
  text('TU DINERO DISPONIBLE', 51, 141, 10, '#c9d6c3', '600');
  text(money(c.net), 51, 193, 43, colors.green, '600', 'left', 300);
  text('este mes, para ti.', 51, 215, 12, '#e0ead9');
  text('CUOTA + RESERVA DE IRPF', 543, 144, 9, '#c9d6c3', '400', 'right');
  text(money(c.contributions), 543, 172, 23, colors.white, '500', 'right', 182);
  text(c.contributionPercent === null ? 'Sin facturación: porcentaje no calculable' : `${percent(c.contributionPercent)} de tu facturación`, 543, 192, 11, '#c9d6c3', '400', 'right', 184);
  text(c.net < 0 ? 'Los gastos y la cuota superan tus ingresos.' : `Facturas ${money(state.income)}. Puedes usar ${money(c.net)}.`, 51, 240, 11, '#e0ead9', '400', 'left', 493);

  box(32, 275, 531, 88);
  text('01  FACTURACIÓN', 48, 296, 10, colors.muted, '600');
  pair('Media prevista para estimar tu cuota', money(state.averageIncome), 48, 320, 499, 12);
  pair('Facturación real de este mes · sin IVA', money(state.income), 48, 345, 499, 12);

  box(32, 378, 258, 160); box(305, 378, 258, 160);
  text('02  CUOTA DE AUTÓNOMO', 48, 401, 10, colors.muted, '600');
  pair('Tramo', c.bracket[4], 48, 424, 226);
  pair('Rendimiento previsto', money(c.returns), 48, 444, 226);
  pair('Base elegida', money(c.base), 48, 464, 226);
  text(`${money(c.base)} × 31,50%`, 48, 486, 10, colors.muted);
  text(money(c.fee), 274, 519, 23, '#8171aa', '600', 'right', 220);
  text('03  RESERVA DE IRPF', 321, 401, 10, colors.muted, '600');
  pair('Facturación de este mes', money(state.income), 321, 424, 226);
  pair('− Gastos, incluida cuota', money(round(c.expenses + c.fee)), 321, 444, 226);
  pair('= Beneficio antes de IRPF', money(c.profit), 321, 464, 226);
  text(`${money(Math.max(0, c.profit))} × ${percent(state.tax)}`, 321, 486, 10, colors.muted);
  text(money(c.tax), 547, 519, 23, '#a67545', '600', 'right', 220);

  box(32, 552, 531, 141);
  text('04  OTROS GASTOS', 48, 575, 10, colors.muted, '600');
  text(money(c.expenses), 547, 575, 14, colors.ink, '600', 'right');
  let expenseIndex = 0, y = 599;
  if (!state.expenses.length) text('No has añadido otros gastos deducibles este mes.', 48, y, 11, colors.muted);
  while (expenseIndex < state.expenses.length) {
    const expense = state.expenses[expenseIndex];
    const lines = wrapped(expense.name, 365, 11), height = Math.max(23, lines.length * 15 + 7);
    if (y + height > 675) break;
    lines.forEach((part, i) => text(part, 48, y + i * 15, 11));
    text(money(expense.amount), 547, y, 11, colors.ink, '500', 'right', 126);
    y += height; expenseIndex++;
  }
  if (expenseIndex < state.expenses.length) text(`Continúa en la página 2 · ${state.expenses.length - expenseIndex} gastos más`, 48, 681, 9, colors.muted);

  text('ASÍ CUADRA TU MES', 32, 717, 10, colors.muted, '600');
  text(`${money(state.income)} − ${money(c.fee)} − ${money(c.expenses)} − ${money(c.tax)} = ${money(c.net)}`, 32, 742, 14, colors.ink, '600', 'left', 531);
  text('Facturación − cuota − otros gastos − reserva de IRPF = disponible', 32, 760, 10, colors.muted);
  text('Estimación mensual. El 20% general del modelo 130 no es el tipo final de la renta.', 32, 783, 9, colors.muted);
  yield canvas;

  if (expenseIndex < state.expenses.length) {
    let carry = true;
    while (carry) {
      newPage('El detalle de tus gastos.');
      text('Gastos deducibles del mes, sin IVA recuperable.', 32, 118, 11, colors.muted);
      box(32, 137, 531, 36, '#edf3e6');
      text('CONCEPTO', 48, 160, 10, colors.muted, '600');
      text('IMPORTE MENSUAL', 547, 160, 10, colors.muted, '600', 'right');
      y = 196;
      while (expenseIndex < state.expenses.length) {
        const expense = state.expenses[expenseIndex];
        const lines = wrapped(expense.name, 365, 11), height = Math.max(28, lines.length * 15 + 12);
        if (y + height > 709) break;
        lines.forEach((part, i) => text(part, 48, y + i * 15, 11));
        text(money(expense.amount), 547, y, 11, colors.ink, '500', 'right', 126);
        line(y + height - 10); y += height; expenseIndex++;
      }
      pair('Total de otros gastos · todas las páginas', money(c.expenses), 48, 749, 499, 12);
      pair('Total deducible, incluida la cuota de autónomo', money(round(c.expenses + c.fee)), 48, 775, 499, 12);
      carry = expenseIndex < state.expenses.length;
      yield canvas;
    }
  }
}

// Embed high-resolution local canvas pages in a PDF without servers, CDNs or dependencies.
export function assemblePDF(images) {
  const encoder = new TextEncoder();
  const bytes = value => typeof value === 'string' ? encoder.encode(value) : value;
  const chunks = []; let length = 0;
  function append(value) { const data = bytes(value); chunks.push(data); length += data.length; }
  const count = 3 + images.length * 3, offsets = Array(count).fill(0);
  function object(id, body) { offsets[id] = length; append(`${id} 0 obj\n`); append(body); append('\nendobj\n'); }
  append('%PDF-1.4\n');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, `<< /Type /Pages /Count ${images.length} /Kids [${images.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] >>`);
  images.forEach((image, i) => {
    const pageId = 3 + i * 3, imageId = pageId + 1, contentId = pageId + 2;
    object(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Image ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    offsets[imageId] = length;
    append(`${imageId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${PAGE.width * PAGE.scale} /Height ${PAGE.height * PAGE.scale} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`);
    append(image); append('\nendstream\nendobj\n');
    const content = 'q 595 0 0 842 0 0 cm /Image Do Q';
    object(contentId, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });
  const xref = length;
  append(`xref\n0 ${count}\n0000000000 65535 f \n`);
  offsets.slice(1).forEach(offset => append(String(offset).padStart(10, '0') + ' 00000 n \n'));
  append(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(chunks, { type: 'application/pdf' });
}

export async function generateReport(state) {
  const images = [];
  for (const canvas of renderReportPages(state)) {
    const blob = await new Promise((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(Error('No se pudo generar la página del reporte.')), 'image/jpeg', .96));
    images.push(new Uint8Array(await blob.arrayBuffer()));
    canvas.width = 0; canvas.height = 0;
  }
  return assemblePDF(images);
}
