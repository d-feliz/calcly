import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateGrowth, growthPoints, MAX_INCOME } from '../dist/growth.js';
import { calculate, round } from '../dist/model.js';

const state = { version: 2, year: 2026, averageIncome: 3000, income: 3000, base: null, tax: 20, expenses: [] };

test('starts at the exact app result even with distinct average and monthly income', () => {
  const custom = { ...state, averageIncome: 2000, income: 4500, base: 1500 };
  const result = calculateGrowth(custom, custom.income);
  assert.deepEqual(result.after, calculate(custom));
  assert.equal(result.netIncrease, 0);
  assert.equal(result.taxIncrease, 0);
});
test('a sustained €500 increase crosses a bracket and includes the larger contribution', () => {
  const result = calculateGrowth(state, 3500);
  assert.equal(result.averageIncome, 3500);
  assert.equal(result.before.fee, 452.94);
  assert.equal(result.after.fee, 478.68);
  assert.equal(result.netIncrease, 379.41);
  assert.equal(result.taxIncrease, 120.59);
  assert.notEqual(result.after.index, result.before.index);
});
test('a sustained €3000 increase reflects every intervening bracket', () => {
  const result = calculateGrowth(state, 6000);
  assert.equal(result.after.fee, 545.59);
  assert.equal(result.after.net, 4363.53);
  assert.equal(result.netIncrease, 2325.88);
});
test('preserves chosen base when valid in the new bracket and does not mutate the app', () => {
  const custom = { ...state, tax: 14, base: 2000, expenses: [{ name: 'Gestoría', amount: 162 }] };
  const copy = structuredClone(custom);
  const result = calculateGrowth(custom, 3500);
  assert.equal(result.after.base, 2000);
  assert.equal(result.netIncrease, 430);
  assert.deepEqual(custom, copy);
});
test('reduced invoices clamp the forecast to zero and the base to the new limits', () => {
  const result = calculateGrowth({ ...state, averageIncome: 1000, income: 4500 }, 0);
  assert.equal(result.averageIncome, 0);
  assert.equal(result.after.index, 0);
  assert.equal(result.after.base, 718.94);
  assert.equal(result.after.tax, 0);
  assert.equal(result.after.net, -result.after.fee);
});
test('resetting after any simulation restores the original result', () => {
  const original = calculateGrowth(state, state.income);
  calculateGrowth(state, 9000);
  assert.deepEqual(calculateGrowth(state, state.income), original);
});
test('chart samples include the baseline and both sides of a contribution jump', () => {
  const points = growthPoints(state, 10000, 3500);
  assert.ok(points.some(point => point.income === state.income));
  assert.ok(points.some(point => point.income === 3500));
  assert.ok(points.some((point, index) => index && point.income - points[index - 1].income < .04 && point.after.fee > points[index - 1].after.fee));
  assert.ok(points.every(point => Number.isFinite(point.after.net)));
});
test('all forecasts reconcile and invalid values are rejected', () => {
  for (const tax of [0, 20, 60]) {
    for (const income of [0, 100, 3000, 6000, MAX_INCOME]) {
      const result = calculateGrowth({ ...state, tax }, income);
      assert.equal(round(result.netIncrease + result.taxIncrease), result.extra);
    }
  }
  for (const income of [-1, Infinity, NaN, MAX_INCOME + .01, '500']) {
    assert.throws(() => calculateGrowth(state, income), RangeError);
  }
});
