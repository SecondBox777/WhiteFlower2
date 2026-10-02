import test from 'node:test';
import assert from 'node:assert/strict';
import { replaceQuestionReferences } from '../lib/report-language.js';

test('accidental item IDs, lists and ranges become ordinary task descriptions throughout a report', () => {
 const input={summary:'Q01·Q04·Q05에서 강점',strengths:[{title:'Q17',evidence:'Q16–Q20 and Q21~30',advice:'Q29를 점검'}],careers:[{reason:'Q11, Q12가 근거'}]};
 const output=replaceQuestionReferences(input,'ko');
 assert.equal(output.summary,'도형의 규칙을 찾는 문제에서 강점');
 assert.equal(output.strengths[0].title,'논리적 추론을 요구하는 문제');
 assert.ok(output.strengths[0].evidence.includes('전개도를 접어 입체 모양을 판단하는 문제'));
 assert.ok(!/Q\d/i.test(JSON.stringify(output)));
 assert.equal(input.strengths[0].title,'Q17');
});
test('English reports also describe tasks without changing normal numbers', () => {
 const result=replaceQuestionReferences({summary:'Q01-Q10: 24% less time; 2 jobs.'},'en');
 assert.equal(result.summary,'visual pattern problems: 24% less time; 2 jobs.');
});
