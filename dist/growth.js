import { calculate, round, brackets } from './model.js';

export const MAX_INCOME = 10000000;

// A sustained change moves actual invoices and the annual monthly forecast together.
// Keep their original difference so resetting reproduces the app's exact scenario.
export function calculateGrowth(state, income) {
  if (!Number.isFinite(income) || income < 0 || income > MAX_INCOME) {
    throw new RangeError('La facturación debe estar entre 0 y 10.000.000 €.');
  }
  income = round(income);
  const before = calculate(state);
  const extra = round(income - state.income);
  const averageIncome = round(Math.max(0, state.averageIncome + extra));
  // The main calculator clamps the chosen base into the new bracket's bounds.
  // A minimum contribution rises when the new bracket's minimum exceeds it.
  const after = calculate({ ...state, income, averageIncome, base: before.base });
  return { income, extra, averageIncome, before, after,
    netIncrease: round(after.net - before.net),
    taxIncrease: round(after.contributions - before.contributions),
  };
}

export function growthPoints(state, maxIncome, selectedIncome) {
  const expenses = calculate(state).expenses;
  const values = new Set([0, state.income, selectedIncome, maxIncome]);
  for (let i = 0; i <= 100; i++) values.add(round(maxIncome * i / 100));
  // Include both sides of every bracket boundary; sparse samples smooth out the jumps.
  for (const [limit] of brackets) {
    if (!Number.isFinite(limit)) continue;
    const crossing = round(limit / .93 + expenses - state.averageIncome + state.income);
    for (const offset of [-.02, -.01, 0, .01, .02]) values.add(round(crossing + offset));
  }
  return [...values].filter(value => Number.isFinite(value) && value >= 0 && value <= maxIncome)
    .sort((a, b) => a - b).map(value => calculateGrowth(state, value));
}

const $ = selector => document.querySelector(selector);
const money = value => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
const signedMoney = value => (value > 0 ? '+' : '') + money(value);
function svgElement(tag, attributes = {}, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
  if (text !== undefined) node.textContent = text;
  return node;
}

export function setupGrowth(getState) {
  const modal = $('#growth-modal'), chart = $('#growth-chart');
  let income = 0, maxIncome = 10000;

  function drawChart(state, comparison) {
    const width = Math.max(280, Math.round(chart.getBoundingClientRect().width));
    const height = width < 480 ? 240 : 265;
    const margin = { left: 58, right: 18, top: 35, bottom: 35 };
    const points = growthPoints(state, maxIncome, income);
    const minY = Math.min(0, ...points.map(point => point.after.net));
    const maxY = Math.max(maxIncome, ...points.map(point => point.after.contributions));
    const x = amount => margin.left + amount / maxIncome * (width - margin.left - margin.right);
    const y = amount => margin.top + (maxY - amount) / (maxY - minY) * (height - margin.top - margin.bottom);
    const svg = svgElement('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-labelledby': 'growth-chart-title growth-chart-description' });
    svg.append(svgElement('title', { id: 'growth-chart-title' }, 'Facturación, disponible y cuota más reserva de IRPF, con cambios de tramo'));
    svg.append(svgElement('desc', { id: 'growth-chart-description' }, `Tu facturación actual es ${money(state.income)}. Con ${money(income)} de facturación simulada, tu disponible sería ${money(comparison.after.net)} y tu cuota más reserva ${money(comparison.after.contributions)}. Tramo ${comparison.after.bracket[4]}.`));
    const tickCount = width < 480 ? 2 : 4;
    const tickLabel = amount => new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 }).format(amount);
    for (let i = 0; i <= tickCount; i++) {
      const value = minY + (maxY - minY) * i / tickCount;
      svg.append(svgElement('line', { x1: margin.left, x2: width - margin.right, y1: y(value), y2: y(value), class: 'growth-grid-line' }));
      svg.append(svgElement('text', { x: margin.left - 8, y: y(value) + 4, 'text-anchor': 'end', class: 'growth-axis-label' }, tickLabel(value)));
      svg.append(svgElement('text', { x: x(maxIncome * i / tickCount), y: height - 12, 'text-anchor': i === tickCount ? 'end' : i === 0 ? 'start' : 'middle', class: 'growth-axis-label' }, tickLabel(maxIncome * i / tickCount)));
    }
    svg.append(svgElement('line', { x1: margin.left, x2: width - margin.right, y1: y(0), y2: y(0), class: 'growth-grid-line' }));
    const path = read => points.map((point, index) => `${index ? 'L' : 'M'}${x(point.income)},${y(read(point))}`).join(' ');
    svg.append(svgElement('path', { d: `${path(p => p.after.net)} L${x(maxIncome)},${y(0)} L${x(0)},${y(0)} Z`, class: 'growth-net-area' }));
    for (let i = 1; i < points.length; i++) {
      if (points[i].after.index === points[i - 1].after.index) continue;
      const boundary = points[i];
      const line = svgElement('line', { x1: x(boundary.income), x2: x(boundary.income), y1: margin.top, y2: height - margin.bottom, class: 'growth-bracket-line' });
      line.append(svgElement('title', {}, `Tramo ${boundary.after.bracket[4]}: ${money(boundary.income)} de facturación mensual`));
      svg.append(line);
    }
    svg.append(svgElement('path', { d: path(p => p.income), class: 'growth-gross-line' }));
    svg.append(svgElement('path', { d: path(p => p.after.net), class: 'growth-net-line' }));
    svg.append(svgElement('path', { d: path(p => p.after.contributions), class: 'growth-tax-line' }));
    // Always mark the original app value, even while exploring another scenario.
    svg.append(svgElement('line', { x1: x(state.income), x2: x(state.income), y1: margin.top - 8, y2: height - margin.bottom, class: 'growth-baseline' }));
    svg.append(svgElement('text', { x: Math.max(margin.left, Math.min(width - margin.right - 145, x(state.income) - 60)), y: 18, class: 'growth-base-label' }, `Actual: ${money(state.income)}`));
    if (income !== state.income) svg.append(svgElement('line', { x1: x(income), x2: x(income), y1: margin.top, y2: height - margin.bottom, class: 'growth-selection-line' }));
    for (const [value, color] of [[income, '#8a9685'], [comparison.after.net, '#467237'], [comparison.after.contributions, '#bb763d']]) {
      svg.append(svgElement('circle', { cx: x(income), cy: y(value), r: 4.5, fill: color, stroke: '#fff', 'stroke-width': 2 }));
    }
    chart.replaceChildren(svg);
  }

  function render(syncAmount = true) {
    const state = getState(), c = calculateGrowth(state, income);
    const set = (id, value) => $('#' + id).textContent = value;
    if (syncAmount) $('#growth-amount').value = income;
    maxIncome = Math.min(MAX_INCOME, Math.max(maxIncome, income));
    const slider = $('#growth-slider'); slider.max = maxIncome; slider.value = income;
    slider.style.setProperty('--fill', `${income / maxIncome * 100}%`);
    slider.setAttribute('aria-valuetext', money(income));
    $('#growth-reset').disabled = income === state.income;
    set('growth-limit', money(maxIncome));
    set('growth-net', money(c.after.net));
    set('growth-difference', c.extra === 0 ? 'Tu disponible actual.' : `${signedMoney(c.netIncrease)} respecto a tu disponible actual.`);
    set('growth-tax', money(c.after.contributions));
    set('growth-tax-note', `Cuota ${money(c.after.fee)} · Tramo ${c.after.bracket[4]}`);
    drawChart(state, c);
  }
  function reset() {
    const state = getState(); income = state.income;
    maxIncome = Math.min(MAX_INCOME, Math.max(10000, Math.ceil((income + 5000) / 1000) * 1000));
    render();
  }
  $('#open-growth').onclick = () => { modal.showModal(); reset(); };
  $('#growth-reset').onclick = reset;
  $('#growth-slider').addEventListener('input', event => { income = Number(event.target.value); render(); });
  $('#growth-amount').addEventListener('input', event => {
    if (!event.target.validity.valid || event.target.value === '') return;
    income = round(Number(event.target.value)); render(false);
  });
  $('#growth-amount').addEventListener('blur', () => $('#growth-amount').value = income);
  new ResizeObserver(() => { if (modal.open) render(false); }).observe(chart);
}
