import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate, validate, brackets, round, FLAT_RATE_FEE } from '../dist/model.js';

const defaults = { version: 3, year: 2026, averageIncome: 3000, income: 3000, hasFlatRate: null, base: null, tax: 20, expenses: [] };
test('actual monthly invoices do not alter the bracket or chosen base', () => {
  const reference = calculate({ ...defaults, base: 2000 });
  const highMonth = calculate({ ...defaults, income: 6000, base: 2000 });
  assert.equal(highMonth.index, reference.index);
  assert.equal(highMonth.base, 2000);
  assert.equal(highMonth.fee, 630);
  assert.equal(highMonth.tax, 1074);
  assert.equal(highMonth.net, 4296);
});
test('average income alone selects the bracket', () => {
  const result = calculate({ ...defaults, averageIncome: 1000, income: 6000 });
  assert.equal(result.index, 2);
  assert.equal(result.base, 849.67);
  assert.equal(result.fee, 267.65);
});
test('expenses, contribution reserve and net reconcile to monthly invoices', () => {
  const state = { ...defaults, income: 4000, expenses: [{ name: 'Gestoría', amount: 100 }] };
  const result = calculate(state);
  assert.equal(result.returns, 2697);
  assert.equal(result.fee, 427.21);
  assert.equal(result.tax, 694.56);
  assert.equal(result.net, 2778.23);
  assert.equal(result.contributions, 1121.77);
  assert.equal(round(result.net + result.expenses + result.contributions), state.income);
  assert.equal(result.contributionPercent, result.contributions / state.income * 100);
});
test('zero invoices never produce an infinite percentage or negative tax reserve', () => {
  const result = calculate({ ...defaults, income: 0 });
  assert.equal(result.tax, 0);
  assert.equal(result.contributionPercent, null);
  assert.equal(result.net, -result.fee);
});
test('expense losses can exceed revenue; reserve stays zero and percentage is not clamped', () => {
  const result = calculate({ ...defaults, income: 100, expenses: [{ name: 'Alquiler', amount: 200 }] });
  assert.equal(result.tax, 0);
  assert.ok(result.net < 0);
  assert.ok(result.contributionPercent > 100);
});
test('all upper boundaries and the exclusive reduced/general boundary are correct', () => {
  brackets.forEach((bracket, i) => {
    if (!Number.isFinite(bracket[0])) return;
    const result = calculate({ ...defaults, averageIncome: bracket[0] / .93 });
    assert.equal(result.index, i === 2 ? 3 : i);
  });
});
test('legacy JSON migrates both incomes while preserving expenses and selected base', () => {
  const legacy = { version: 1, year: 2026, income: 3000, base: 2000, tax: 23, expenses: [{ name: 'Software', amount: 100 }] };
  assert.deepEqual(validate(legacy), { ...legacy, version: 3, averageIncome: 3000, hasFlatRate: null });
});
test('version 2 JSON keeps its incomes and leaves the flat rate question unanswered', () => {
  const previous = { version: 2, year: 2026, averageIncome: 2500, income: 4000, base: null, tax: 20, expenses: [] };
  assert.deepEqual(validate(previous), { ...previous, version: 3, hasFlatRate: null });
});
test('new JSON round trips distinct incomes without losing state', () => {
  const state = { ...defaults, income: 4500, base: 2000, expenses: [{ name: 'Gestoría', amount: 100 }] };
  assert.deepEqual(validate(JSON.parse(JSON.stringify(state))), state);
});
test('invalid JSON data is rejected before replacing the current progress', () => {
  for (const patch of [{ version: 4 }, { hasFlatRate: 'sí' }, { hasFlatRate: undefined }, { averageIncome: -1 }, { averageIncome: undefined }, { income: Infinity }, { tax: 70 }, { base: 99999 }, { expenses: [{ name: ' ', amount: 2 }] }]) {
    assert.throws(() => validate({ ...defaults, ...patch }));
  }
});
test('flat rate fixes the fee whatever the bracket or chosen base', () => {
  for (const averageIncome of [500, 3092, 9000]) {
    const result = calculate({ ...defaults, averageIncome, hasFlatRate: true, base: null });
    assert.equal(result.fee, FLAT_RATE_FEE);
  }
  assert.equal(calculate({ ...defaults, hasFlatRate: true, base: 2000 }).fee, FLAT_RATE_FEE);
});
test('flat rate fee is deducted before the IRPF reserve and reconciles to invoices', () => {
  const state = { ...defaults, hasFlatRate: true, income: 3000, expenses: [{ name: 'Gestoría', amount: 100 }] };
  const result = calculate(state);
  assert.equal(result.profit, 2811.36);
  assert.equal(result.tax, 562.27);
  assert.equal(result.net, 2249.09);
  assert.equal(round(result.net + result.expenses + result.contributions), state.income);
});
test('answering no or leaving the question unanswered uses the chosen base', () => {
  const unanswered = calculate({ ...defaults, base: 2000 });
  assert.equal(calculate({ ...defaults, hasFlatRate: false, base: 2000 }).fee, 630);
  assert.equal(unanswered.fee, 630);
});
test('flat rate answer round trips through JSON', () => {
  for (const hasFlatRate of [true, false]) {
    const state = { ...defaults, hasFlatRate };
    assert.deepEqual(validate(JSON.parse(JSON.stringify(state))), state);
  }
});
