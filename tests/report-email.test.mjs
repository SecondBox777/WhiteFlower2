import test from 'node:test';
import assert from 'node:assert/strict';
import { handleReportEmail, issueReportEmailToken, verifyReportEmailToken, renderReportEmail } from '../lib/report-email.js';
import { handleReport } from '../lib/analyze.js';
import { scoringItems } from '../scoring.js';

const secret='test-only-secret-longer-than-thirty-two-characters';
const env={RESEND_API_KEY:'test-resend-key',RESEND_FROM:'Mindscope <reports@example.com>',REPORT_EMAIL_SECRET:secret};
const data={result:{score:64.52,correct:22,iq:124.4787},language:'ko',report:{summary:'강점 <script>alert(1)</script>',problem_solving:[{title:'조건 비교',evidence:'조건 연결',advice:'비교 연습'}],cognitive_characteristics:[{title:'논리추론',assessment:'뛰어납니다',evidence:'정답 패턴'}],careers:[{field:'연구원',required_abilities:'분석 능력'}],limitations:'합성 모형의 예비 결과입니다.'}};
const context=(body,bindings=env)=>({request:new Request('https://example.com/api/email-report',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://example.com'},body:JSON.stringify(body)}),env:bindings});
const noSend=()=>{throw Error('Unexpected external API call');};

test('email tokens authenticate report and result and expire after thirty minutes',async()=>{
  const now=Date.now();const token=await issueReportEmailToken(data,secret,now);
  assert.deepEqual((await verifyReportEmailToken(token,secret,now)).report,data.report);
  assert.equal(await verifyReportEmailToken(token,secret,now+30*60*1000),null);
  assert.equal(await verifyReportEmailToken(token,'wrong-key',now),null);
  assert.equal(await verifyReportEmailToken(token+'x',secret,now),null);
  const [payload,signature]=token.split('.');
  assert.equal(await verifyReportEmailToken('A'+payload.slice(1)+'.'+signature,secret,now),null);
});
test('signed report is sent through Resend with stable per-report idempotency and escaped HTML',async()=>{
  const token=await issueReportEmailToken(data,secret);
  let idempotency;
  for(let i=0;i<2;i++){
    const response=await handleReportEmail(context({email:'reader@example.com',token,consent:true}),async(url,options)=>{
      assert.equal(url,'https://api.resend.com/emails');assert.equal(options.headers.Authorization,'Bearer test-resend-key');
      const body=JSON.parse(options.body);
      assert.equal(body.from,env.RESEND_FROM);assert.deepEqual(body.to,['reader@example.com']);
      assert.ok(!body.text.includes('124'));assert.ok(body.text.includes('64.52'));assert.ok(!body.text.includes('연구원'));
      assert.ok(!body.html.includes('<script>'));assert.ok(body.html.includes('&lt;script&gt;'));
      if(idempotency)assert.equal(options.headers['Idempotency-Key'],idempotency);
      idempotency=options.headers['Idempotency-Key'];
      return Response.json({id:'email-id'});
    });
    assert.equal(response.status,200);assert.equal((await response.json()).id,'email-id');
  }
});
test('pause, malformed requests, cross-origin, missing setup and invalid tokens never send email',async()=>{
  for(const flag of ['TESTING_PAUSED','REPORTS_PAUSED']){
    const ctx=context({}, {[flag]:'true'});
    assert.equal((await handleReportEmail(ctx,noSend)).status,503);assert.equal(ctx.request.bodyUsed,false);
  }
  for(const body of [{},{email:'bad',token:'x',consent:true},{email:'a@example.com,b@example.com',token:'x',consent:true},{email:'a@example.com',token:'x',consent:false},{email:'a@example.com',token:'x',consent:true}]){
    assert.equal((await handleReportEmail(context(body),noSend)).status,400);
  }
  assert.equal((await handleReportEmail(context({email:'a@example.com',token:'x',consent:true},{}),noSend)).status,503);
  const ctx=context({});ctx.request=new Request(ctx.request,{headers:{Origin:'https://other.com','Content-Type':'application/json'}});
  assert.equal((await handleReportEmail(ctx,noSend)).status,403);
  for(const [body,type,status] of [['{','application/json',400],['x'.repeat(200001),'application/json',413],['{}','text/plain',415]]){
    assert.equal((await handleReportEmail({request:new Request('https://example.com/api/email-report',{method:'POST',headers:{'Content-Type':type},body}),env},noSend)).status,status);
  }
});
test('Resend failures are recoverable and do not expose provider secrets',async()=>{
  const token=await issueReportEmailToken(data,secret);
  for(const [upstream,status] of [[401,502],[409,409],[429,429],[500,502]]){
    const response=await handleReportEmail(context({email:'reader@example.com',token,consent:true}),async()=>new Response('private-provider-details',{status:upstream}));
    assert.equal(response.status,status);assert.ok(!(await response.text()).includes('private-provider-details'));
  }
  assert.equal((await handleReportEmail(context({email:'reader@example.com',token,consent:true}),async()=>{throw Error('timeout');})).status,502);
  assert.equal((await handleReportEmail(context({email:'reader@example.com',token,consent:true}),async()=>Response.json({}))).status,502);
  assert.ok(renderReportEmail({...data,language:'en'}).subject.includes('Your AI report'));
});
test('OpenAI response issues email token without sending recipient email to OpenAI',async()=>{
  const submission={answers:scoringItems.map(q=>'ABCD'.indexOf(q.answer)),seconds:scoringItems.map(q=>q.referenceSeconds),expiredIndex:null,language:'ko',adultConfirmed:true,consent:true,email:'private@example.com'};
  const response=await handleReport({request:new Request('https://example.com/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(submission)}),env:{...env,OPENAI_API_KEY:'test-key',OPENAI_MODEL:'test-model'}},async(url,options)=>{
    assert.ok(!options.body.includes('private@example.com'));
    return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(data.report)}]}]});
  });
  assert.equal(response.status,200);
  const body=await response.json();const signed=await verifyReportEmailToken(body.emailToken,secret);
  assert.deepEqual(signed.report,body.report);assert.deepEqual(signed.result,body.result);
});
