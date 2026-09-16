import { calculate, round } from './model.js';

export const MAX_INCREASE = 10000;

// A one-month what-if: average income, selected contribution base and expenses stay fixed.
// Reuse the main calculation, including its loss handling and cent rounding.
export function calculateGrowth(state, increase) {
  if (!Number.isFinite(increase) || increase < 0 || increase > MAX_INCREASE) {
    throw new RangeError('El aumento debe estar entre 0 y 10.000 €.');
  }
  const extra = round(increase);
  const before = calculate(state);
  const income = round(state.income + extra);
  const after = calculate({ ...state, income, base: before.base });
  const netIncrease = round(after.net - before.net);
  const taxIncrease = round(after.contributions - before.contributions);
  return {
    extra, income, before, after, netIncrease, taxIncrease,
    retainedPercent: extra > 0 ? netIncrease / extra * 100 : null,
    relativeIncrease: before.net > 0 ? netIncrease / before.net * 100 : null,
    breakEvenIncrease: round(Math.max(0, -before.profit)),
  };
}

const $ = selector => document.querySelector(selector);
const money = value => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
const percent = value => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(value) + '%';
const signedMoney = value => (value > 0 ? '+' : '') + money(value);

function svgElement(tag, attributes = {}, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
  if (text !== undefined) node.textContent = text;
  return node;
}

export function setupGrowth(getState) {
  const modal = $('#growth-modal');
  const chart = $('#growth-chart');
  let increase = 500;

  function drawChart(state, comparison) {
    const width = Math.max(280, Math.round(chart.getBoundingClientRect().width));
    const height = width < 480 ? 235 : 250;
    const margin = { left: 55, right: 18, top: 16, bottom: 40 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    // A consistent horizon prevents the same increase looking bigger when the scale changes.
    const x = amount => margin.left + amount / MAX_INCREASE * plotWidth;
    const y = amount => margin.top + plotHeight - amount / MAX_INCREASE * plotHeight;
    const svg = svgElement('svg', {
      viewBox: `0 0 ${width} ${height}`, role: 'img',
      'aria-labelledby': 'growth-chart-title growth-chart-description',
    });
    svg.append(svgElement('title', { id: 'growth-chart-title' }, 'Facturación extra, dinero disponible extra y reserva de IRPF adicional'));
    svg.append(svgElement('desc', { id: 'growth-chart-description' }, `Comparación con tu mes actual, de 0 a ${money(MAX_INCREASE)} extra. Con ${money(comparison.extra)} más de facturación, tu disponible aumenta ${money(comparison.netIncrease)} y la reserva aumenta ${money(comparison.taxIncrease)}. La cuota se mantiene.`));
    const tickCount = width < 480 ? 2 : 4;
    const tickLabel = amount => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(amount / 1000) + (amount ? ' mil' : '');
    for (let i = 0; i <= tickCount; i++) {
      const amount = MAX_INCREASE * i / tickCount;
      svg.append(svgElement('line', { x1: margin.left, x2: width - margin.right, y1: y(amount), y2: y(amount), class: 'growth-grid-line' }));
      svg.append(svgElement('text', { x: margin.left - 9, y: y(amount) + 4, 'text-anchor': 'end', class: 'growth-axis-label' }, tickLabel(amount)));
      svg.append(svgElement('text', { x: x(amount), y: height - 18, 'text-anchor': i === tickCount ? 'end' : i === 0 ? 'start' : 'middle', class: 'growth-axis-label' }, tickLabel(amount)));
    }
    // Include the exact break-even point, where reserving IRPF starts, in the curves.
    const samples = new Set(Array.from({ length: 81 }, (_, index) => index * MAX_INCREASE / 80));
    samples.add(comparison.extra);
    if (comparison.breakEvenIncrease <= MAX_INCREASE) samples.add(comparison.breakEvenIncrease);
    const points = [...samples].sort((a, b) => a - b).map(extra => calculateGrowth(state, extra));
    const path = key => points.map((point, index) => `${index ? 'L' : 'M'}${x(point.extra)},${y(point[key])}`).join(' ');
    svg.append(svgElement('path', { d: `${path('netIncrease')} L${x(MAX_INCREASE)},${y(0)} L${x(0)},${y(0)} Z`, class: 'growth-net-area' }));
    svg.append(svgElement('path', { d: path('extra'), class: 'growth-gross-line' }));
    svg.append(svgElement('path', { d: path('netIncrease'), class: 'growth-net-line' }));
    svg.append(svgElement('path', { d: path('taxIncrease'), class: 'growth-tax-line' }));
    svg.append(svgElement('line', { x1: x(comparison.extra), x2: x(comparison.extra), y1: margin.top, y2: y(0), class: 'growth-selection-line' }));
    for (const [key, color] of [['extra', '#8a9685'], ['netIncrease', '#467237'], ['taxIncrease', '#bb763d']]) {
      svg.append(svgElement('circle', { cx: x(comparison.extra), cy: y(comparison[key]), r: 4.5, fill: color, stroke: '#fff', 'stroke-width': 2 }));
    }
    chart.replaceChildren(svg);
  }

  function render(syncAmount = true) {
    const state = getState();
    const c = calculateGrowth(state, increase);
    const set = (id, value) => $('#' + id).textContent = value;
    if (syncAmount) $('#growth-amount').value = increase;
    $('#growth-slider').value = increase;
    $('#growth-slider').style.setProperty('--fill', `${increase / MAX_INCREASE * 100}%`);
    $('#growth-slider').setAttribute('aria-valuetext', `${money(increase)} más de facturación`);
    modal.querySelectorAll('[data-increase]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.increase) === increase)));
    set('growth-net', signedMoney(c.netIncrease));
    set('growth-tax', signedMoney(c.taxIncrease));
    set('growth-retained', c.retainedPercent === null ? 'Elige un aumento para comparar.' : `Conservas el ${percent(c.retainedPercent)} del aumento.`);
    set('growth-tax-note', `Cuota sin cambios: ${money(c.before.fee)}.`);
    set('growth-income-before', money(state.income)); set('growth-income-after', money(c.income));
    set('growth-taxes-before', money(c.before.contributions)); set('growth-taxes-after', money(c.after.contributions));
    set('growth-net-before', money(c.before.net)); set('growth-net-after', money(c.after.net));
    set('growth-assumptions', `Cuota y gastos fijos · Reserva de IRPF: ${percent(state.tax)}`);
    let explanation;
    if (state.tax === 0) {
      explanation = 'Con una reserva del 0% y sin gastos nuevos, cada 100 € extra aumentan tu disponible en 100 €.';
    } else if (c.before.profit < 0) {
      explanation = `Los primeros ${money(c.breakEvenIncrease)} extra cubren tu pérdida actual sin aumentar la reserva. Después, de cada 100 € extra conservas ${money(100 - state.tax)}.`;
    } else {
      explanation = `Con tus ajustes, de cada 100 € extra conservas ${money(100 - state.tax)}, tanto si facturas poco como mucho. El mismo aumento representa un porcentaje mayor cuando partes de menos dinero disponible.`;
    }
    set('growth-explanation', explanation);
    if (increase === 0) set('growth-relative', 'Tu escenario actual, sin aumento.');
    else if (c.relativeIncrease !== null) set('growth-relative', `Tu dinero disponible crece un ${percent(c.relativeIncrease)} respecto a este mes.`);
    else if (c.after.net < 0) set('growth-relative', `Aún tendrías un saldo negativo de ${money(Math.abs(c.after.net))}.`);
    else if (c.after.net === 0) set('growth-relative', 'Con este aumento cubres exactamente tus gastos y cuota.');
    else set('growth-relative', `Pasas de ${money(c.before.net)} a ${money(c.after.net)} disponibles.`);
    drawChart(state, c);
  }

  $('#open-growth').onclick = () => {
    modal.showModal();
    render();
  };
  $('#growth-slider').addEventListener('input', event => { increase = Number(event.target.value); render(); });
  $('#growth-amount').addEventListener('input', event => {
    if (!event.target.validity.valid || event.target.value === '') return;
    increase = round(Number(event.target.value)); render(false);
  });
  $('#growth-amount').addEventListener('blur', () => $('#growth-amount').value = increase);
  modal.querySelectorAll('[data-increase]').forEach(button => {
    button.onclick = () => { increase = Number(button.dataset.increase); render(); };
  });
  // Updates the SVG's actual pixel dimensions, keeping axis labels readable on mobile.
  const observer = new ResizeObserver(() => { if (modal.open) render(false); });
  observer.observe(chart);
}
