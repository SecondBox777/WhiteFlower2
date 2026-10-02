import test from 'node:test';
import assert from 'node:assert/strict';
import { scoringItems, speedFactor, scoreTest, TestClock } from '../scoring.js';
const correct = scoringItems.map(q => 'ABCD'.indexOf(q.answer));
test('supplied scoring totals, speed boundaries, and regression remain exact', () => {
  assert.equal(scoringItems.map(q => q.answer).join(''), 'ADBCACBACDCABCBBCADCBBCADCADBC');
  assert.equal(scoringItems.reduce((n,q) => n+q.points,0), 100);
  assert.equal(scoringItems.reduce((n,q) => n+q.referenceSeconds,0),1420);
  assert.deepEqual([.4,.400001,.65,.650001,1,1.000001,1.5,1.500001,2,2.000001].map(speedFactor),[1,.9,.9,.75,.75,.5,.5,.25,.25,0]);
  assert.equal(scoreTest(correct,Array(30).fill(0)).score,100);
  assert.ok(Math.abs(scoreTest(correct,scoringItems.map(q=>q.referenceSeconds*3)).score-80)<1e-10);
  assert.equal(scoreTest(Array(30).fill(null),Array(30).fill(0)).score,0);
  assert.ok(Math.abs(scoreTest(correct,scoringItems.map(q=>q.referenceSeconds)).score-95)<1e-10);
  assert.equal(scoreTest(correct,Array(30).fill(0),29).score,97);
  assert.equal(scoreTest(correct,Array(30).fill(0)).iq,79.76334234199149+0.6930466663250522*100);
});
test('clock accumulates revisits and caps time at the 30 minute deadline', () => {
 const clock=new TestClock(1000);
 clock.move(1,6000);clock.move(0,10000);clock.record(13000);
 assert.equal(clock.seconds[0],8);assert.equal(clock.seconds[1],4);
 clock.record(2000000);
 assert.equal(clock.remaining(2000000),0);
 assert.equal(clock.seconds.reduce((a,b)=>a+b,0),1800);
 clock.record(2100000);assert.equal(clock.seconds.reduce((a,b)=>a+b,0),1800);
});
