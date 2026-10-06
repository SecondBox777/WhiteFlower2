import test from 'node:test';
import assert from 'node:assert/strict';
import { handleReport } from '../lib/analyze.js';
import { validateSubmission,buildAnalysis } from '../lib/report.js';
import { scoringItems } from '../scoring.js';
const submission=()=>({answers:scoringItems.map(q=>'ABCD'.indexOf(q.answer)),seconds:scoringItems.map(q=>q.referenceSeconds),expiredIndex:null,language:'ko',consent:true,adultConfirmed:true});
const report={summary:'Summary',problem_solving:[{title:'Strategy',evidence:'도형의 규칙을 찾는 문제',advice:'Practice'}],careers:[],cognitive_characteristics:[],limitations:'Synthetic only'};
const context=(data,env={OPENAI_API_KEY:'test-key',OPENAI_MODEL:'test-model'})=>({request:new Request('https://example.com/api/analyze',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://example.com'},body:JSON.stringify(data)}),env});
test('server computes domain statistics and sends anonymized data with strict schema',async()=>{
 const data=submission();data.score=999;data.email='private@example.com';
 const response=await handleReport(context(data),async(url,options)=>{
  assert.equal(url,'https://api.openai.com/v1/responses');
  const body=JSON.parse(options.body),input=JSON.parse(body.input);
  assert.equal(body.store,false);assert.equal(body.text.format.strict,true);
  assert.ok(Math.abs(input.result.score-95)<1e-10);assert.equal(input.items.length,30);assert.equal(input.domains.length,3);
  assert.equal(input.items[16].difficulty,5);assert.ok(input.items[16].task_description);
  assert.equal(input.items[0].time_ratio,1);assert.ok(input.performance.by_subtype.length>3);
  assert.ok(body.instructions.includes('상대 풀이시간'));
  assert.equal(body.max_output_tokens,6000);
  assert.equal(input.email,undefined);assert.equal(input.items[0].selected,'A');
  return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(report)}]}]});
 });assert.equal(response.status,200);const actual=(await response.json()).report;assert.deepEqual(actual.problem_solving,report.problem_solving);assert.equal(actual.cognitive_characteristics.length,3);assert.ok(actual.cognitive_characteristics.every(x=>x.assessment.includes('매우 뛰어납니다')));
});
test('invalid input and missing config never call OpenAI',async()=>{
 for(const data of [{...submission(),consent:false},{...submission(),answers:[0]},{...submission(),seconds:Array(30).fill(1800)},{...submission(),seconds:Array(30).fill(-1)},{...submission(),expiredIndex:0}]){
  const response=await handleReport(context(data),()=>{throw Error('Must not call');});assert.equal(response.status,400);
 }
 assert.equal((await handleReport(context(submission(),{}))).status,503);
 const ctx=context(submission());ctx.request=new Request(ctx.request,{headers:{'Content-Type':'application/json',Origin:'https://other.com'}});assert.equal((await handleReport(ctx)).status,403);
});
test('timeouts, refusals, malformed reports and upstream errors are recoverable',async()=>{
 for(const output of [{status:'incomplete'},{status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'No'}]}]},{status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{}'}]}]}])assert.equal((await handleReport(context(submission()),async()=>Response.json(output))).status,502);
 assert.equal((await handleReport(context(submission()),async()=>new Response('',{status:429}))).status,429);
 assert.equal((await handleReport(context(submission()),async()=>{throw Error('secret');})).status,502);
});
test('analysis preserves excluded-response reasons',()=>{
 const data=validateSubmission(submission());data.seconds[0]=0;data.answers[1]=null;
 const analysis=buildAnalysis(data);assert.equal(analysis.items[0].excluded,'too_fast');assert.equal(analysis.items[0].earned,0);assert.equal(analysis.items[1].excluded,'unanswered');
});

test('configuration errors identify missing bindings without exposing secrets', async () => {
 for (const [env, missing] of [[{OPENAI_MODEL:'gpt-6-sol'}, 'OPENAI_API_KEY'], [{OPENAI_API_KEY:'private-test-key'}, 'OPENAI_MODEL']]) {
  const response = await handleReport(context(submission(), env));
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.ok(body.error.includes(missing));
  assert.ok(!body.error.includes('private-test-key'));
 }
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
