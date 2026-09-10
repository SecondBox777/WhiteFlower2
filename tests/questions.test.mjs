import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { questions, TOTAL_QUESTIONS } from '../questions.js';

test('ten supplied images followed by unscored placeholder slots', async () => {
  assert.ok([20, 30].includes(TOTAL_QUESTIONS));
  assert.equal(questions.length, TOTAL_QUESTIONS);
  assert.equal(new Set(questions.map(q => q.id)).size, TOTAL_QUESTIONS);
  for (const [index, q] of questions.entries()) {
    assert.equal(q.id, `Q${String(index + 1).padStart(2, '0')}`);
    assert.deepEqual(q.options, ['A', 'B', 'C', 'D']);
    assert.equal(q.answer, null);
    assert.equal(q.placeholder, index >= 10);
    if (index < 10) {
      assert.equal(q.image, `${q.id}.webp`);
      const image = await readFile(new URL(`../${q.image}`, import.meta.url));
      assert.equal(image.toString('ascii', 0, 4), 'RIFF');
      assert.equal(image.toString('ascii', 8, 12), 'WEBP');
      assert.ok(image.length < 100 * 1024, 'Question images must stay below 100 KiB');
    } else {
      assert.equal(q.image, undefined);
      assert.match(q.prompt, /PLACEHOLDER/);
    }
  }
});
