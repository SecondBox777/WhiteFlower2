import test from 'node:test';
import assert from 'node:assert/strict';
import { handleTemporaryTestReport } from '../lib/temporary-test-report.js';
import { scoringItems } from '../scoring.js';
import { languages } from '../i18n.js';
import { reportCopy } from '../report-locales.js';
import worker from '../src/index.js';
const env={TEMPORARY_TEST_REPORT_ENABLED:'true',RESEND_API_KEY:'test-resend',RESEND_FROM:'reports@example.com',REPORT_EMAIL_SECRET:'test-only-secret-at-least-32-characters'};
const submission=language=>({answers:scoringItems.map(q=>'ABCD'.indexOf(q.answer)),seconds:scoringItems.map(q=>q.referenceSeconds),expiredIndex:null,language,adultConfirmed:true,consent:true,email:'reader@example.com'});
const context=(body=submission('ko'),bindings=env)=>({request:new Request('https://example.com/api/test-report',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://example.com'},body:JSON.stringify(body)}),env:bindings});
const noSend=()=>{throw Error('Must not contact any provider');};

test('temporary bypass requires its explicit flag and respects service pauses before body reads',async()=>{
 for(const flag of [undefined,'false']) {
  const ctx=context(undefined,{...env,TEMPORARY_TEST_REPORT_ENABLED:flag});
  assert.equal((await handleTemporaryTestReport(ctx,noSend)).status,404);assert.equal(ctx.request.bodyUsed,false);
 }
 for(const flag of ['TESTING_PAUSED','REPORTS_PAUSED']) {
  const ctx=context(undefined,{...env,[flag]:'true'});
  assert.equal((await handleTemporaryTestReport(ctx,noSend)).status,503);assert.equal(ctx.request.bodyUsed,false);
 }
});

test('temporary reports validate method, origin, size, adult consent, language and email',async()=>{
 assert.equal((await handleTemporaryTestReport({request:new Request('https://example.com/api/test-report'),env},noSend)).status,405);
 for(const headers of [{Origin:'https://foreign.example'},{'Sec-Fetch-Site':'cross-site'}]) {
  const ctx=context();ctx.request=new Request(ctx.request,{headers:{'Content-Type':'application/json',...headers}});
  assert.equal((await handleTemporaryTestReport(ctx,noSend)).status,403);
 }
 for(const change of [{adultConfirmed:false},{consent:false},{language:'xx'},{email:'bad'},{answers:[0]},{seconds:Array(30).fill(-1)}])assert.equal((await handleTemporaryTestReport(context({...submission('ko'),...change}),noSend)).status,400);
 for(const [body,type,status] of [['{','application/json',400],['x'.repeat(12001),'application/json',413],['{}','text/plain',415]]) {
  const request=new Request('https://example.com/api/test-report',{method:'POST',headers:{'Content-Type':type},body});
  assert.equal((await handleTemporaryTestReport({request,env},noSend)).status,status);
 }
 assert.equal((await handleTemporaryTestReport(context(undefined,{...env,RESEND_API_KEY:''}),noSend)).status,503);
});

test('temporary reports score on the server and email in every language without any payment or AI call',async()=>{
 for(const language of Object.keys(languages)) {
  let sends=0;
  const ctx=context({...submission(language),score:999,report:{summary:'forged'}});
  const response=await handleTemporaryTestReport(ctx,async(url,options)=>{
   assert.equal(url,'https://api.resend.com/emails');sends++;
   const body=JSON.parse(options.body);
   assert.deepEqual(body.to,['reader@example.com']);
   assert.ok(body.subject.includes(reportCopy(language).title));
   assert.ok(body.html.includes(`lang="${language}"`));
   assert.ok(body.text.includes(reportCopy(language).summary));
   assert.ok(!body.text.includes('forged'));
   return Response.json({id:'sent'});
  });
  assert.equal(response.status,200);const data=await response.json();
  assert.equal(data.emailDelivery.status,'sent');assert.equal(sends,1);
  assert.equal(data.report.summary,reportCopy(language).summary);
  assert.ok(Math.abs(data.result.score-95)<1e-10);
  assert.equal(data.paymentStatus,undefined);
 }
});

test('ambiguous delivery retries reuse the email key and failures still return the screen report',async()=>{
 const keys=[];
 for(const fail of [true,false]) {
  const response=await handleTemporaryTestReport(context(),async(url,options)=>{
   keys.push(options.headers['Idempotency-Key']);
   if(fail)throw Error('private-provider-details');
   return Response.json({id:'sent'});
  });
  assert.equal(response.status,200);const data=await response.json();
  assert.ok(data.report);assert.equal(data.emailDelivery.status,fail?'failed':'sent');
  assert.ok(!JSON.stringify(data).includes('private-provider-details'));
 }
 assert.equal(keys[0],keys[1]);assert.match(keys[0],/^report\/temporary-test-/);
 await handleTemporaryTestReport(context({...submission('ko'),email:'other@example.com'}),async(url,options)=>{assert.notEqual(options.headers['Idempotency-Key'],keys[0]);return Response.json({id:'sent'});});
});

test('enabling temporary reports does not bypass paid report routes',async()=>{
 for(const path of ['/api/report','/api/analyze']) {
  const response=await worker.fetch(new Request(`https://example.com${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(submission('ko'))}),{...env,POLAR_ACCESS_TOKEN:'test',PAYMENT_SESSIONS:{get:()=>{throw Error('No purchase');}}});
  assert.equal(response.status,402);
 }
 const disabled=await worker.fetch(context().request,{...env,TEMPORARY_TEST_REPORT_ENABLED:'false'});
 assert.equal(disabled.status,404);
});
