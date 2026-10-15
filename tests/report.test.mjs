import test from 'node:test';
import assert from 'node:assert/strict';
import { handleReport } from '../lib/analyze.js';
import { validateSubmission,buildAnalysis,buildReport } from '../lib/report.js';
import { scoringItems } from '../scoring.js';
const submission=()=>({answers:scoringItems.map(q=>'ABCD'.indexOf(q.answer)),seconds:scoringItems.map(q=>q.referenceSeconds),expiredIndex:null,language:'ko',consent:true,adultConfirmed:true});
const report={summary:'Summary',problem_solving:[{title:'Strategy',evidence:'도형의 규칙을 찾는 문제',advice:'Practice'}],careers:[],cognitive_characteristics:[],limitations:'Synthetic only'};
const context=(data,env={OPENAI_API_KEY:'test-key',OPENAI_MODEL:'test-model'})=>({request:new Request('https://example.com/api/analyze',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://example.com'},body:JSON.stringify(data)}),env});
test('reports are deterministic, internally scored and never contact external AI',async()=>{
 const data=submission(); data.score=999;
 const response=await handleReport(context(data,{}),()=>{throw Error('No external requests');});
 assert.equal(response.status,200);
 const body=await response.json();
 assert.ok(Math.abs(body.result.score-95)<1e-10);
 assert.equal(body.report.abilities.length,3);assert.equal(body.report.items.length,30);
 assert.ok(body.report.abilities.every(a=>a.level===5));
 assert.equal(body.report.careers,undefined);assert.equal(body.report.problem_solving,undefined);
 assert.deepEqual((await (await handleReport(context(data,{}))).json()).report,body.report);
});
test('invalid submissions and cross-origin requests are rejected',async()=>{
 for(const data of [{...submission(),consent:false},{...submission(),answers:[0]},{...submission(),seconds:Array(30).fill(1800)},{...submission(),seconds:Array(30).fill(-1)},{...submission(),expiredIndex:0}]) assert.equal((await handleReport(context(data))).status,400);
 const ctx=context(submission());ctx.request=new Request(ctx.request,{headers:{'Content-Type':'application/json',Origin:'https://other.com'}});assert.equal((await handleReport(ctx)).status,403);
});
test('analysis preserves excluded-response reasons',()=>{
 const data=validateSubmission(submission());data.seconds[0]=0;data.answers[1]=null;
 const analysis=buildAnalysis(data);assert.equal(analysis.items[0].excluded,'too_fast');assert.equal(analysis.items[0].earned,0);assert.equal(analysis.items[1].excluded,'unanswered');
});

test('experimental submissions are marked as random integration data', () => {
 const data = validateSubmission({...submission(), experimental:true});
 assert.equal(buildAnalysis(data).experimental, true);
 assert.equal(buildAnalysis(validateSubmission(submission())).experimental, false);
 assert.throws(() => validateSubmission({...submission(), experimental:'true'}));
});

test('AI report requires explicit adult confirmation before external requests', async () => {
 for (const adultConfirmed of [undefined,false,'true',1]) {
  const response=await handleReport(context({...submission(),adultConfirmed}),()=>{throw Error('Must not call OpenAI');});
  assert.equal(response.status,400);
  assert.ok((await response.json()).error.includes('만 18세 이상'));
 }
});

test('bars respond to correct-answer pace and exclude invalid responses without population claims',()=>{
 const data=submission();
 const fast=buildReport(buildAnalysis({...data,seconds:data.seconds.map(s=>s*0.4)}));
 const slow=buildReport(buildAnalysis({...data,seconds:data.seconds.map(s=>s*1.6)}));
 assert.ok(fast.abilities.every((a,i)=>a.level>slow.abilities[i].level));
 const invalid=buildReport(buildAnalysis({...data,seconds:Array(30).fill(0)}));
 assert.ok(invalid.abilities.every(a=>a.level===0));
 assert.ok(invalid.items.every(q=>!q.correct && q.excluded==='too_fast'));
 assert.ok(fast.limitations.includes('백분위가 아닙니다'));
});
