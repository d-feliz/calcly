import { calculate, brackets, validate, round } from './model.js';
import { generateReport } from './report.js';
import { setupGrowth } from './growth.js';
import { setupNumberInputs } from './number-inputs.js';

setupNumberInputs();

const $ = selector => document.querySelector(selector);
const money = value => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
const num = value => new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const percent = value => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(value) + '%';
let state = { version: 2, year: 2026, averageIncome: 3000, income: 3000, base: null, tax: 20, expenses: [] };
let current, toastTimer;

function toast(message) {
  $('#toast').textContent = message; $('#toast').style.display = 'block';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').style.display = 'none', 5000);
}
try {
  const saved = localStorage.getItem('calcly-state');
  if (saved) state = validate(JSON.parse(saved));
} catch { toast('No se pudo recuperar el progreso local. Puedes cargar un archivo guardado.'); }
function text(id, value) { $('#' + id).textContent = value; }

function render() {
  current = calculate(state); state.base = current.base;
  const c = current;
  const values = {
    'bracket-name': 'tramo ' + c.bracket[4],
    'base-value': money(c.base), 'base-min': money(c.bracket[1]), 'base-max': money(c.bracket[2]),
    'factor-base': money(c.base), fee: money(c.fee), 'expense-fee': money(c.fee),
    'tax-income': money(state.income), deductions: money(round(c.expenses + c.fee)),
    profit: money(c.profit), 'tax-factor': `${money(Math.max(0, c.profit))} × ${percent(state.tax)}`,
    'tax-total': money(c.tax), 'summary-net': money(c.net), 'summary-fee': money(c.fee),
    'summary-tax': money(c.tax), 'summary-expenses': money(c.expenses), 'contributions-total': money(c.contributions),
  };
  Object.entries(values).forEach(([id, value]) => text(id, value));
  $('#net').replaceChildren(document.createTextNode(num(c.net) + ' '));
  const currency = document.createElement('span'); currency.className = 'currency'; currency.textContent = '€'; $('#net').append(currency);
  text('result-sentence', `Facturas ${money(state.income)}, pero solo puedes usar ${money(c.net)} este mes.${c.net < 0 ? ' Tus gastos y cuota superan tus ingresos.' : ''}`);
  text('contributions-sentence', c.contributionPercent === null ? 'Sin facturación, el porcentaje no es calculable.' : `El ${percent(c.contributionPercent)} de lo que facturas este mes.`);
  const slider = $('#base'); slider.min = c.bracket[1]; slider.max = c.bracket[2]; slider.value = c.base;
  slider.setAttribute('aria-valuetext', money(c.base));
  slider.style.setProperty('--fill', `${(c.base - c.bracket[1]) / (c.bracket[2] - c.bracket[1]) * 100}%`);
  $('#brackets').replaceChildren();
  brackets.forEach((bracket, index) => {
    const row = document.createElement('tr');
    if (index === c.index) { row.className = 'active-tramo'; row.setAttribute('aria-label', 'Tu tramo: ' + bracket[4]); }
    [bracket[3], num(bracket[1]), num(bracket[2])].forEach(value => { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); });
    $('#brackets').append(row);
  });
  $('#expenses').replaceChildren();
  state.expenses.forEach((expense, index) => {
    const row = document.createElement('div'); row.className = 'expense-row';
    const name = document.createElement('span'); name.textContent = expense.name;
    const amount = document.createElement('strong'); amount.textContent = money(expense.amount);
    const remove = document.createElement('button'); remove.textContent = '×'; remove.setAttribute('aria-label', 'Eliminar ' + expense.name);
    remove.onclick = () => { updateReference(() => state.expenses.splice(index, 1)); $('#add-expense').focus(); };
    row.append(name, amount, remove); $('#expenses').append(row);
  });
  $('#allocation').replaceChildren();
  const amounts = [Math.max(c.net, 0), c.fee, c.tax, c.expenses], total = amounts.reduce((sum, amount) => sum + amount, 0);
  amounts.forEach((amount, index) => {
    const segment = document.createElement('span'); segment.className = ['green', 'purple', 'orange', 'gray'][index];
    segment.style.width = (total ? amount / total * 100 : 0) + '%'; $('#allocation').append(segment);
  });
  try { localStorage.setItem('calcly-state', JSON.stringify(state)); }
  catch { toast('El navegador no permite guardar aquí. Guarda tu progreso en un archivo.'); }
}
function sync() { $('#average-income').value = state.averageIncome; $('#income').value = state.income; $('#tax').value = state.tax; render(); }
function updateReference(change) {
  const previousIndex = current.index; change();
  // Keep the chosen base unless the reference moves into another bracket.
  if (calculate(state).index !== previousIndex) state.base = null;
  render();
}
for (const [id, key] of [['average-income', 'averageIncome'], ['income', 'income'], ['tax', 'tax']]) {
  const input = $('#' + id);
  input.addEventListener('input', () => {
    if (!input.validity.valid || input.value === '') return;
    const value = round(Number(input.value));
    if (key === 'averageIncome') updateReference(() => state.averageIncome = value);
    else { state[key] = value; render(); }
  });
  input.addEventListener('blur', () => input.value = state[key]);
}
$('#base').addEventListener('input', event => { state.base = Number(event.target.value); render(); });
$('#average').onclick = () => $('#average-modal').showModal();
$('#add-expense').onclick = () => {
  if (state.expenses.length >= 200) { toast('Puedes incluir hasta 200 gastos.'); return; }
  $('#expense-modal').showModal();
};
document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => button.closest('dialog').close());
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
}));
$('#average-form').onsubmit = event => {
  event.preventDefault(); const min = Number($('#minimum').value), max = Number($('#maximum').value);
  if (min > max) { text('average-error', 'El máximo debe ser igual o mayor que el mínimo.'); return; }
  text('average-error', ''); updateReference(() => state.averageIncome = round((min + max) / 2));
  $('#average-income').value = state.averageIncome; $('#average-modal').close();
  toast('Media prevista actualizada. La facturación de este mes se mantiene.');
};
$('#expense-form').onsubmit = event => {
  event.preventDefault(); const name = $('#expense-name').value.trim();
  if (!name) { $('#expense-name').setCustomValidity('Escribe un nombre para el gasto.'); $('#expense-name').reportValidity(); return; }
  updateReference(() => state.expenses.push({ name, amount: round(Number($('#expense-value').value)) }));
  $('#expense-modal').close(); event.target.reset();
};
$('#expense-name').oninput = event => event.target.setCustomValidity('');
$('#view-bracket').onclick = event => {
  event.preventDefault(); const reference = $('#bracket-reference'); reference.open = true;
  reference.querySelector('summary').focus({ preventScroll: true });
  reference.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
};
function download(blob, name) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
$('#export').onclick = () => {
  download(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), 'calcly-progreso-2026.json');
  toast('Progreso guardado. Usa «Cargar progreso» para recuperarlo.');
};
$('#import').onclick = () => $('#file').click();
$('#file').onchange = async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    if (file.size > 1000000) throw Error('El archivo supera el límite de 1 MB.');
    const imported = validate(JSON.parse(await file.text())); state = imported; sync(); toast('Progreso recuperado correctamente.');
  } catch (error) { toast(error instanceof SyntaxError ? 'El archivo no contiene JSON válido.' : error.message); }
  finally { event.target.value = ''; }
};
$('#pdf').onclick = async () => {
  const button = $('#pdf'), label = button.innerHTML; button.disabled = true; button.textContent = 'Generando reporte…';
  try {
    const snapshot = structuredClone(state);
    download(await generateReport(snapshot), 'calcly-reporte-2026.pdf'); toast('Reporte PDF generado en tu equipo.');
  } catch { toast('No se pudo generar el reporte. Inténtalo de nuevo.'); }
  finally { button.disabled = false; button.innerHTML = label; }
};
sync();
setupGrowth(() => state);
