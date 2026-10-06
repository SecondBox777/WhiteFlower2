import test from 'node:test';
import assert from 'node:assert/strict';
import { renderReportDocument, reportBlocks } from '../report-content.js';
import { renderReportEmail } from '../lib/report-email.js';
import { wrapText } from '../report-export.js';
const data={language:'ko',result:{iq:124.47,score:64.52,correct:22},report:{summary:'강점 <script>alert(1)</script> & 비교',problem_solving:[{title:'문제 전략',evidence:'근거',advice:'방법'}],cognitive_characteristics:[{title:'논리',assessment:'내부 분류',evidence:'조건 비교'}],careers:[{field:'연구원',required_abilities:'분석 능력'}],limitations:'합성·예비 모형이며 임상 검사가 아닙니다.'}};
test('screen and email share the exact same escaped report document in both languages',()=>{
 for(const language of ['ko','en']) {
  const input={...data,language};
  const actual=renderReportDocument(input);
  assert.deepEqual(actual,renderReportEmail(input));
  assert.ok(!actual.html.includes('<script>'));
  assert.ok(actual.html.includes('&lt;script&gt;'));
  assert.ok(actual.text.includes('124'));
  assert.ok(actual.text.includes(data.report.limitations));
  const text=reportBlocks(input).map(x=>x.text).join('\n\n');
  assert.equal(text.replace(/\s+/g,' '),actual.text.replace(/\s+/g,' '));
 }
});
test('image wrapping preserves Korean, emoji and long words without clipping or splitting graphemes',()=>{
 const measure=text=>[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text)].length;
 for(const text of ['한글보고서내용이길어도전부저장합니다','A very long English paragraph with Supercalifragilisticexpialidocious','가족👨‍👩‍👧‍👦가족👨‍👩‍👧‍👦','첫 문단\n\n마지막 한계 안내']) {
  const lines=wrapText(text,measure,10);
  assert.ok(lines.every(line=>measure(line)<=10));
  assert.equal(lines.join('').replace(/\s/g,''),text.replace(/\s/g,''));
 }
 assert.deepEqual(wrapText('first\n\nlast',measure,10),['first','','last']);
});
