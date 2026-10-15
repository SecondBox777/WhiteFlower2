import { scoringItems } from '../scoring.js';
import { buildReport, buildAnalysis } from '../lib/report.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderReportDocument, reportBlocks } from '../report-content.js';
import { renderReportEmail } from '../lib/report-email.js';
import { wrapText } from '../report-export.js';
const data={language:'ko',result:{iq:124.47,score:64.52,correct:22},report:buildReport(buildAnalysis({answers:scoringItems.map(q=>'ABCD'.indexOf(q.answer)),seconds:scoringItems.map(q=>q.referenceSeconds),expiredIndex:null,language:'ko'}))};
data.report.summary += ' <script>alert(1)</script>';
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
