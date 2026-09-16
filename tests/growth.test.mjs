import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateGrowth, MAX_INCREASE } from '../dist/growth.js';
import { round } from '../dist/model.js';

const state = { version: 2, year: 2026, averageIncome: 3000, income: 3000, base: null, tax: 20, expenses: [] };

test('€500 and €3000 increases leave €400 and €2400 with a 20% reserve', () => {
  for (const extra of [500, 3000]) {
    const result = calculateGrowth(state, extra);
    assert.equal(result.netIncrease, extra * .8);
    assert.equal(result.taxIncrease, extra * .2);
    assert.equal(result.retainedPercent, 80);
    assert.equal(result.after.base, result.before.base);
    assert.equal(result.after.fee, result.before.fee);
  }
});

test('uses the selected reserve, expenses and contribution base without mutating the scenario', () => {
  const custom = { ...state, tax: 14, base: 2000, expenses: [{ name: 'Gestoría', amount: 162 }] };
  const original = structuredClone(custom);
  const result = calculateGrowth(custom, 500);
  assert.equal(result.netIncrease, 430);
  assert.equal(result.taxIncrease, 70);
  assert.equal(result.after.fee, 630);
  assert.equal(result.after.expenses, 162);
  assert.equal(result.income, 3500);
  assert.deepEqual(custom, original);
});

test('losses are covered before an increase starts generating an IRPF reserve', () => {
  const loss = { ...state, income: 100, base: 2000, expenses: [{ name: 'Software', amount: 120 }] };
  const stillNegative = calculateGrowth(loss, 500);
  assert.equal(stillNegative.breakEvenIncrease, 650);
  assert.equal(stillNegative.netIncrease, 500);
  assert.equal(stillNegative.taxIncrease, 0);
  assert.equal(stillNegative.relativeIncrease, null);
  const positive = calculateGrowth(loss, 1000);
  assert.equal(positive.taxIncrease, 70);
  assert.equal(positive.netIncrease, 930);
  assert.equal(positive.after.net, 280);
});

test('break-even and zero increases have no phantom tax or divide-by-zero percentages', () => {
  const result = calculateGrowth({ ...state, income: 0 }, 0);
  assert.equal(result.netIncrease, 0);
  assert.equal(result.taxIncrease, 0);
  assert.equal(result.retainedPercent, null);
  assert.equal(result.relativeIncrease, null);
  const breakEven = calculateGrowth({ ...state, income: 0 }, result.before.fee);
  assert.equal(breakEven.after.net, 0);
  assert.equal(breakEven.taxIncrease, 0);
});

test('equal increases have equal absolute benefit but a bigger relative impact on lower incomes', () => {
  const low = calculateGrowth({ ...state, income: 1500 }, 500);
  const high = calculateGrowth({ ...state, income: 6000 }, 500);
  assert.equal(low.netIncrease, high.netIncrease);
  assert.ok(low.relativeIncrease > high.relativeIncrease);
});

test('incremental money reconciles at cent precision across all chart samples and reserve extremes', () => {
  for (const tax of [0, 14, 20, 23, 60]) {
    for (const income of [0, 150, 3000, 10000000]) {
      for (const extra of [0, .01, 123.45, 500, 3000, MAX_INCREASE]) {
        const result = calculateGrowth({ ...state, income, tax }, extra);
        assert.equal(round(result.netIncrease + result.taxIncrease), extra);
        assert.equal(result.after.fee, result.before.fee);
        assert.ok(result.taxIncrease >= 0);
        assert.ok(result.netIncrease >= 0);
      }
    }
  }
});

test('rejects negative, non-finite and out-of-range increases', () => {
  for (const extra of [-1, Infinity, NaN, MAX_INCREASE + .01, '500']) {
    assert.throws(() => calculateGrowth(state, extra), RangeError);
  }
});
