import test from 'node:test';
import assert from 'node:assert/strict';
import { handleReport } from '../lib/analyze.js';
import { validateSubmission,buildAnalysis } from '../lib/report.js';
import { scoringItems } from '../scoring.js';
const submission=()=>({answers:scoringItems.map(q=>'ABCD'.indexOf(q.answer)),seconds:scoringItems.map(q=>q.referenceSeconds),expiredIndex:null,language:'ko',consent:true});
const report={summary:'Summary',strengths:[{title:'Strength',evidence:'Q01',advice:'Practice'}],improvement_areas:[],careers:[],cognitive_characteristics:[],work_environments:[],limitations:'Synthetic only'};
const context=(data,env={OPENAI_API_KEY:'test-key',OPENAI_MODEL:'test-model'})=>({request:new Request('https://example.com/api/analyze',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://example.com'},body:JSON.stringify(data)}),env});
test('server computes domain statistics and sends anonymized data with strict schema',async()=>{
 const data=submission();data.score=999;data.email='private@example.com';
 const response=await handleReport(context(data),async(url,options)=>{
  assert.equal(url,'https://api.openai.com/v1/responses');
  const body=JSON.parse(options.body),input=JSON.parse(body.input);
  assert.equal(body.store,false);assert.equal(body.text.format.strict,true);
  assert.ok(Math.abs(input.result.score-95)<1e-10);assert.equal(input.items.length,30);assert.equal(input.domains.length,3);
  assert.equal(input.email,undefined);assert.equal(input.items[0].selected,'A');
  return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(report)}]}]});
 });assert.equal(response.status,200);assert.deepEqual((await response.json()).report,report);
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
