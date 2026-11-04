import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cycleDuration, weeklyTargets } from './trainingCycles.js';

test('legacy cycles remain four weeks and two-week cycles retain their duration', () => {
  assert.equal(cycleDuration({}), 4);
  assert.equal(cycleDuration({ durationWeeks: 4 }), 4);
  assert.equal(cycleDuration({ durationWeeks: 2 }), 2);
});

test('targets reach the goal on the final week of either duration', () => {
  assert.deepEqual(weeklyTargets(100, 130, 2), [100, 130]);
  assert.deepEqual(weeklyTargets(100, 130, 4), [100, 110, 120, 130]);
  assert.deepEqual(weeklyTargets('', 130, 2), [130, 130]);
  assert.deepEqual(weeklyTargets(150, 130, 2), [130, 130]);
  assert.equal(weeklyTargets(100, '', 2), null);
});
