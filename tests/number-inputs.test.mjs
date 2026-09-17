import { test } from 'node:test';
import assert from 'node:assert/strict';
import { incrementValue } from '../dist/number-inputs.js';

test('one-euro increments preserve cents without floating point drift', () => {
  assert.equal(incrementValue(3000.45, 1, 0, 10000000), 3001.45);
  assert.equal(incrementValue(3000.45, -1, 0, 10000000), 2999.45);
  assert.equal(incrementValue(.29, 1, 0, 10000000), 1.29);
});

test('increment controls respect expense minimum and upper limits', () => {
  assert.equal(incrementValue(.25, -1, .01, 10000000), .01);
  assert.equal(incrementValue(59.5, 1, 0, 60), 60);
});
