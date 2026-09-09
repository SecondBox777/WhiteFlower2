import test from 'node:test';
import assert from 'node:assert/strict';
import { questions } from '../questions.js';

test('20 complete questions, with five items in each cognitive category', () => {
  assert.equal(questions.length, 20);
  const counts = {};
  for (const q of questions) {
    counts[q.category] = (counts[q.category] || 0) + 1;
    assert.equal(q.options.length, 4);
    assert.equal(new Set(q.options).size, 4);
    assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4);
    assert.ok(q.title && q.explanation);
  }
  assert.equal(Object.keys(counts).length, 4);
  assert.deepEqual(Object.values(counts), [5, 5, 5, 5]);
});
