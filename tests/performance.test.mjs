import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPerformance } from '../lib/performance.js';
import { itemMetadata } from '../lib/item-metadata.js';
import { buildAnalysis, validateSubmission, validReport } from '../lib/report.js';
import { scoringItems, scoreTest } from '../scoring.js';
const submission = () => ({answers:scoringItems.map(q=>'ABCD'.indexOf(q.answer)),seconds:scoringItems.map(q=>q.referenceSeconds),expiredIndex:null,language:'ko',consent:true});
const analysis = data => buildAnalysis(validateSubmission(data));

test('all reviewed items carry distinct task context and editorial difficulty', () => {
 assert.equal(itemMetadata.length,30);
 assert.equal(new Set(itemMetadata.map(q=>q.id)).size,30);
 for(const [i,q] of itemMetadata.entries()) {
  assert.equal(q.id,`Q${String(i+1).padStart(2,'0')}`);
  assert.ok(Number.isInteger(q.difficulty)&&q.difficulty>=1&&q.difficulty<=5);
  assert.ok(q.task_description.length>15&&q.skills.includes(q.primary_skill));
 }
 assert.equal(itemMetadata[8].subtype,'exclusive_overlay');
 assert.equal(itemMetadata[14].subtype,'common_term_cancellation');
 assert.equal(itemMetadata[26].subtype,'cube_zigzag_net');
});

test('relative timing and speed/accuracy styles reflect the same answer with different pace', () => {
 const data=submission();
 data.seconds[0]=scoringItems[0].referenceSeconds*.75;
 data.seconds[1]=scoringItems[1].referenceSeconds*1.25;
 data.seconds[2]=scoringItems[2].referenceSeconds*1.3;
 data.answers[3]=(data.answers[3]+1)%4;
 data.seconds[3]=scoringItems[3].referenceSeconds*.5;
 const out=analysis(data);
 assert.equal(out.items[0].response_style,'fast_correct');
 assert.equal(out.items[1].response_style,'typical_correct');
 assert.equal(out.items[2].response_style,'slow_correct');
 assert.equal(out.items[3].response_style,'fast_incorrect');
 assert.equal(out.items[3].relative_time_percent,-50);
 assert.deepEqual(out.performance.notable_items.fast_incorrect,['Q04']);
 assert.equal(out.performance.speed_accuracy.find(x=>x.style==='fast_incorrect').accuracy,0);
 assert.deepEqual(out.result,scoreTest(data.answers,data.seconds));
});

test('difficulty and subtype reveal different profiles despite identical correct count', () => {
 const easy=submission(),hard=submission();
 easy.answers=easy.answers.map((a,i)=>itemMetadata[i].difficulty<=2?a:(a+1)%4);
 const count=itemMetadata.filter(q=>q.difficulty<=2).length;
 const hardIds=new Set(itemMetadata.slice().sort((a,b)=>b.difficulty-a.difficulty).slice(0,count).map(q=>q.id));
 hard.answers=hard.answers.map((a,i)=>hardIds.has(itemMetadata[i].id)?a:(a+1)%4);
 const e=analysis(easy),h=analysis(hard);
 assert.equal(e.result.correct,h.result.correct); // Same number correct, with different complexity.
 assert.ok(h.performance.overall.difficulty_weighted_accuracy>e.performance.overall.difficulty_weighted_accuracy);
 assert.equal(e.performance.notable_items.hard_correct.length,0);
 assert.ok(h.performance.notable_items.hard_correct.includes('Q17'));
 assert.equal(h.performance.by_subtype.find(x=>x.subtype==='multistep_equality').accuracy,1);
});

test('excluded answers never contaminate accuracy, error time or notable errors', () => {
 const data=submission();
 data.answers[0]=(data.answers[0]+1)%4;data.seconds[0]=0;
 data.answers[1]=null;
 const out=analysis(data);
 assert.equal(out.performance.overall.valid_count,28);
 assert.equal(out.performance.overall.accuracy,1);
 assert.equal(out.performance.overall.incorrect_time_seconds,0);
 assert.deepEqual(out.performance.notable_items.easy_incorrect,[]);
 const empty=analysis({...data,answers:Array(30).fill(null),seconds:Array(30).fill(0)});
 assert.equal(empty.performance.overall.accuracy,null);
 assert.equal(empty.performance.overall.median_time_ratio,null);
 assert.equal(empty.performance.overall.difficulty_speed_efficiency,null);
 assert.deepEqual(empty.performance.matched_order,[]);
 assert.ok(!JSON.stringify(empty).includes('NaN'));
});

test('equal reference pace produces unit efficiency and matched comparisons are stratified', () => {
 const out=analysis(submission());
 assert.equal(out.performance.overall.difficulty_speed_efficiency,1);
 assert.equal(out.performance.overall.time_ratio_sd,0);
 assert.equal(out.performance.overall.median_time_ratio,1);
 assert.deepEqual(out.performance.matched_order,[]); // Current tasks do not provide adequate matched early/late samples.
 const matched=buildPerformance(out.items.map(q=>({...q,difficulty:3}))).matched_order;
 assert.equal(matched.length,3);
 for(const comparison of matched) {
  assert.ok(comparison.early.valid_count>=2&&comparison.late.valid_count>=2);
  assert.equal(comparison.accuracy_change,0);
  assert.equal(comparison.median_ratio_change,0);
  for(const id of [...comparison.early.item_ids,...comparison.late.item_ids]) {
   const q=out.items.find(q=>q.id===id);
   assert.equal(q.domain,comparison.domain);assert.equal(comparison.difficulty,3);
  }
 }
});

test('report permits five careers but caps strengths at two', () => {
 const finding={title:'Pattern',evidence:'Q01 and Q02',advice:'Separate rules'};
 const report={summary:'Summary',strengths:[finding,finding],improvement_areas:[],cognitive_characteristics:[],work_environments:[],careers:Array.from({length:5},()=>({field:'Software QA',reason:'Constraint checking',next_step:'Review a test case'})),limitations:'Preliminary'};
 assert.equal(validReport(report),true);
 assert.equal(validReport({...report,strengths:[finding,finding,finding]}),false);
});
