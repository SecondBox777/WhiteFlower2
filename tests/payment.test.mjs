import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
import {PaymentSession,PRODUCT_ID,paidCheckout,readPaymentBody,polarRequest} from '../lib/payment.js';
import {scoringItems} from '../scoring.js';

const sessionId='12345678-1234-4123-8123-123456789012';
const submission=()=>({answers:scoringItems.map(q=>'ABCD'.indexOf(q.answer)),seconds:scoringItems.map(q=>q.referenceSeconds),expiredIndex:null,language:'ko',consent:true,adultConfirmed:true});
const env={POLAR_ENVIRONMENT:'sandbox',POLAR_ACCESS_TOKEN:'private-polar',OPENAI_API_KEY:'private-ai',OPENAI_MODEL:'test-model',RESEND_API_KEY:'test-resend',RESEND_FROM:'Mindscope <reports@example.com>',REPORT_EMAIL_SECRET:'a-test-secret-that-is-at-least-32-characters'};
const request=(path,body=path==='/api/checkout'?{...submission(),email:'reader@example.com'}:submission(),headers={})=>new Request(`https://example.com${path}`,{method:'POST',headers:{'Content-Type':'application/json','X-Mindscope-Session':sessionId,...headers},body:JSON.stringify(body)});
function fixture() {
  const values=new Map(); let alarm=null;
  const state={storage:{get:async key=>values.get(key),put:async(key,value)=>values.set(key,value),setAlarm:async when=>{alarm=when;},deleteAll:async()=>values.clear()}};
  return {object:new PaymentSession(state,env),values,state,get alarm(){return alarm;}};
}
function record() { return {sessionId,checkoutId:'checkout-1',productId:PRODUCT_ID,submission:submission(),createdAt:Date.now()}; }
function order(extra={}) {return {id:'order-1',checkout_id:'checkout-1',product_id:PRODUCT_ID,metadata:{mindscope_session:sessionId},paid:true,status:'paid',net_amount:900,refunded_amount:0,...extra};}
function polarData(url) {const path=new URL(url).pathname;return path.includes('/orders/')?{items:[order()]}:path.includes('/refunds/')?{items:[]}:checkout();}
function checkout(status='succeeded') { return {id:'checkout-1',status,product_id:PRODUCT_ID,metadata:{mindscope_session:sessionId},url:'https://sandbox.polar.sh/checkout/test'}; }

test('only succeeded checkouts bound to this product and purchase are accepted',()=>{
  assert.equal(paidCheckout(checkout(),record()),true);
  for(const status of ['open','confirmed','expired','failed']) assert.equal(paidCheckout(checkout(status),record()),false);
  for(const changed of [{id:'stolen-checkout'},{product_id:'other-product'},{metadata:{}},{metadata:{mindscope_session:'other-session'}}]) assert.equal(paidCheckout({...checkout(),...changed},record()),false);
});
test('both public report routes require a purchase and never fall back to free analysis',async()=>{
  for(const path of ['/api/report','/api/analyze']) {
    const response=await worker.fetch(request(path),{...env,PAYMENT_SESSIONS:{get:()=>{throw Error('No purchase should reach storage');}}});
    assert.equal(response.status,402);
  }
});
test('checkout guards reject foreign origins, missing configuration and unsupported methods',async()=>{
  assert.equal((await worker.fetch(request('/api/checkout',submission(),{Origin:'https://attacker.example'}),env)).status,403);
  assert.equal((await worker.fetch(request('/api/checkout'),env)).status,503);
  assert.equal((await worker.fetch(new Request('https://example.com/api/checkout'),env)).status,405);
  assert.equal((await worker.fetch(request('/api/checkout'),{...env,PAYMENT_SESSIONS:{},OPENAI_API_KEY:''})).status,503);
});
test('checkout stores validated answers and redirects only to the Polar product with a private cookie',async t=>{
  const f=fixture();
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    if (!url.endsWith('/checkouts/')) return Response.json({items:[]});
    assert.equal(url,'https://sandbox-api.polar.sh/v1/checkouts/');
    const body=JSON.parse(options.body);
    assert.deepEqual(body.products,[PRODUCT_ID]);assert.equal(body.allow_trial,false);
    assert.equal(body.success_url,'https://example.com/?payment=return');
    assert.equal(body.return_url,'https://example.com/?payment=cancelled');
    assert.equal(body.customer_email,'reader@example.com');
    assert.ok(!JSON.stringify(body).includes('answers'));
    return Response.json({...checkout('open'),metadata:body.metadata});
  });
  const bindings={idFromName:id=>id,get:()=>({fetch:req=>f.object.fetch(req)})};
  const response=await worker.fetch(request('/api/checkout'),{...env,PAYMENT_SESSIONS:bindings});
  assert.equal(response.status,200);
  assert.match(response.headers.get('Set-Cookie'),/HttpOnly; Secure; SameSite=Lax/);
  const stored=f.values.get('purchase');
  assert.deepEqual(stored.submission.answers,submission().answers);
  assert.ok(f.alarm>Date.now());assert.equal(stored.productId,PRODUCT_ID);assert.equal(stored.email,'reader@example.com');
});
test('checkout validation and unexpected provider URLs cannot produce a payable redirect',async t=>{
  const f=fixture();let calls=0;
  t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({...checkout('open'),url:'https://attacker.example/checkout'});});
  for(const body of [null,{...submission(),adultConfirmed:false},{...submission(),answers:[0]}]) assert.equal((await f.object.fetch(request('/api/checkout',body))).status,400);
  assert.equal(calls,0);
  assert.equal((await f.object.fetch(request('/api/checkout'))).status,502);
  assert.equal(f.values.has('purchase'),false);
});
test('unpaid or mismatched sessions cannot call OpenAI; failed lookups stay closed',async t=>{
  const f=fixture();f.values.set('purchase',record());let calls=0;
  const mock=t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json(checkout('confirmed'));});
  assert.equal((await f.object.fetch(request('/api/analyze'))).status,402);
  assert.equal(calls,1);
  mock.mock.mockImplementation(async()=>Response.json({...checkout(),product_id:'wrong'}));
  assert.equal((await f.object.fetch(request('/api/analyze'))).status,402);
  mock.mock.mockImplementation(async()=>new Response('private-provider-detail',{status:401}));
  const failure=await f.object.fetch(request('/api/analyze'));
  assert.equal(failure.status,502);assert.ok(!(await failure.text()).includes('private-provider-detail'));
});
test('return restores the saved submission and never trusts the success query as proof',async t=>{
  const f=fixture();f.values.set('purchase',record());
  t.mock.method(globalThis,'fetch',async()=>Response.json(checkout('open')));
  const response=await f.object.fetch(new Request('https://example.com/api/payment/status?payment=success'));
  const data=await response.json();assert.equal(data.status,'open');assert.deepEqual(data.submission,submission());
});
test('paid concurrent requests generate one report from saved answers and reuse it after object restart',async t=>{
  const f=fixture();f.values.set('purchase',record());let aiCalls=0;
  const report={summary:'Summary',problem_solving:[],careers:[],cognitive_characteristics:[],limitations:'Synthetic only'};
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    if(url.startsWith('https://sandbox-api.polar.sh/')) return Response.json(polarData(url));
    assert.equal(url,'https://api.openai.com/v1/responses');aiCalls++;
    const analysis=JSON.parse(JSON.parse(options.body).input);
    assert.equal(analysis.items[0].selected,'A');assert.equal(analysis.language,'ko');
    await new Promise(resolve=>setTimeout(resolve,10));
    return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(report)}]}]});
  });
  const incoming=()=>request('/api/analyze',{...submission(),answers:Array(30).fill(3),language:'en'});
  const responses=await Promise.all([f.object.fetch(incoming()),f.object.fetch(incoming())]);
  assert.ok(responses.every(r=>r.status===200));assert.equal(aiCalls,1);
  const restarted=new PaymentSession(f.state,env);
  assert.equal((await restarted.fetch(incoming())).status,200);assert.equal(aiCalls,1);
  f.values.set('purchase',{...record(),createdAt:Date.now()-31*24*60*60*1000});
  await restarted.alarm();assert.equal(f.values.size,0);
});
test('report provider failures allow retry without a second payment',async t=>{
  const f=fixture();f.values.set('purchase',record());let attempts=0;
  t.mock.method(globalThis,'fetch',async url=>{
    if(url.startsWith('https://sandbox-api.polar.sh/'))return Response.json(polarData(url));
    attempts++;return new Response('',{status:429});
  });
  assert.equal((await f.object.fetch(request('/api/analyze'))).status,429);
  assert.equal((await f.object.fetch(request('/api/analyze'))).status,429);
  assert.equal(attempts,2);assert.equal(f.values.has('report'),false);
});
test('bounded request reads and sandbox routing do not expose credentials',async()=>{
  await assert.rejects(readPaymentBody(request('/api/checkout','x'.repeat(12001))),/Request too large/);
  await assert.rejects(readPaymentBody(request('/api/checkout',{}, {'Content-Type':'text/plain'})),/JSON required/);
  await polarRequest({...env,POLAR_ENVIRONMENT:'sandbox'},'/checkouts/id',undefined,async url=>{assert.equal(url,'https://sandbox-api.polar.sh/v1/checkouts/id');return Response.json({});});
});

test('three report failures automatically refund the verified net amount once and poll completion',async t=>{
 const f=fixture();f.values.set('purchase',record());let ai=0,posts=0,refund=null;
 t.mock.method(globalThis,'fetch',async(url,options)=>{
   if(url.startsWith('https://api.openai.com/')){ai++;return new Response('',{status:429});}
   if(new URL(url).pathname==='/v1/refunds/' && options.method==='POST'){
     posts++;const body=JSON.parse(options.body);assert.equal(body.order_id,'order-1');assert.equal(body.amount,900);assert.equal(body.reason,'service_disruption');
     refund={id:'refund-1',order_id:'order-1',status:'pending',metadata:body.metadata};return Response.json(refund);
   }
   if(new URL(url).pathname==='/v1/refunds/')return Response.json({items:refund?[refund]:[]});
   return Response.json(polarData(url));
 });
 assert.equal((await f.object.fetch(request('/api/analyze'))).status,429);
 await f.object.alarm();await f.object.alarm();assert.equal(ai,3);assert.equal(posts,1);
 const restarted=new PaymentSession(f.state,env);
 await restarted.alarm();assert.equal(posts,1);assert.equal(ai,3);
 refund.status='succeeded';
 const status=await restarted.fetch(new Request('https://example.com/api/payment/status'));
 assert.equal((await status.json()).status,'refunded');
 assert.equal((await restarted.fetch(request('/api/analyze'))).status,402);assert.equal(posts,1);
});
test('an ambiguous refund POST is reconciled after restart without posting a duplicate',async t=>{
 const f=fixture();f.values.set('purchase',record());f.values.set('attempts',3);let posts=0;
 t.mock.method(globalThis,'fetch',async(url,options)=>{
   if(new URL(url).pathname==='/v1/refunds/' && options.method==='POST'){posts++;throw Error('Connection lost after submission');}
   return Response.json(polarData(url));
 });
 const response=await f.object.fetch(request('/api/analyze'));assert.equal((await response.json()).paymentStatus,'refund_pending');
 const restarted=new PaymentSession(f.state,env);
 assert.equal((await restarted.fetch(request('/api/analyze'))).status,402);
 await restarted.alarm();assert.equal(posts,1);
});
test('refunded, unpaid and mismatched orders never generate reports or trigger refunds',async t=>{
 const f=fixture();f.values.set('purchase',record());let active=order({paid:false});
 t.mock.method(globalThis,'fetch',async(url,options)=>{
   assert.equal(options.method,'GET');assert.ok(!url.includes('openai'));
   if(new URL(url).pathname==='/v1/orders/')return Response.json({items:[active]});
   return Response.json(polarData(url));
 });
 for(const changed of [{paid:false},{checkout_id:'other'},{product_id:'other'},{metadata:{}},{status:'refunded',refunded_amount:900},{status:'partially_refunded',refunded_amount:100}]){
   active=order(changed);assert.equal((await f.object.fetch(request('/api/analyze'))).status,402);
 }
});
test('a successful retry cancels refund scheduling and preserves the paid report',async t=>{
 const f=fixture();f.values.set('purchase',record());let ai=0;
 const report={summary:'Summary',problem_solving:[],careers:[],cognitive_characteristics:[],limitations:'Synthetic only'};
 t.mock.method(globalThis,'fetch',async(url,options)=>{
   if(!url.includes('openai')){assert.equal(options.method,'GET');return Response.json(polarData(url));}
   if(++ai===1)return new Response('',{status:429});
   return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(report)}]}]});
 });
 await f.object.fetch(request('/api/analyze'));await f.object.alarm();await f.object.alarm();
 assert.equal(ai,2);assert.ok(f.values.has('report'));assert.equal(f.values.has('refund'),false);
});
test('missing order or refund read permission blocks checkout before a customer can pay',async t=>{
 const f=fixture();let created=0;
 t.mock.method(globalThis,'fetch',async(url,options)=>{if(options.method==='POST')created++;return new Response('',{status:403});});
 assert.equal((await f.object.fetch(request('/api/checkout'))).status,502);assert.equal(created,0);
});
test('unspecified environment fails closed and production is only used explicitly',async()=>{
 await assert.rejects(polarRequest({...env,POLAR_ENVIRONMENT:undefined},'/checkouts/id'),/environment/);
 await polarRequest({...env,POLAR_ENVIRONMENT:'production'},'/checkouts/id',undefined,async url=>{assert.equal(url,'https://api.polar.sh/v1/checkouts/id');return Response.json({});});
});

test('automatic email sends the saved recipient once and never shares it with OpenAI',async t=>{
 const f=fixture();f.values.set('purchase',{...record(),email:'reader@example.com'});let ai=0,sends=0;
 const report={summary:'Summary',problem_solving:[],careers:[],cognitive_characteristics:[],limitations:'Synthetic only'};
 t.mock.method(globalThis,'fetch',async(url,options)=>{
   if(url==='https://api.resend.com/emails'){
     sends++;assert.equal(options.headers['Idempotency-Key'],`report/${sessionId}`);assert.deepEqual(JSON.parse(options.body).to,['reader@example.com']);return Response.json({id:'email-1'});
   }
   if(url.includes('openai')){
     ai++;assert.ok(!options.body.includes('reader@example.com'));
     return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(report)}]}]});
   }
   return Response.json(polarData(url));
 });
 const result=await f.object.fetch(request('/api/analyze'));assert.equal((await result.json()).emailDelivery.status,'sent');
 const restarted=new PaymentSession(f.state,env);
 await restarted.fetch(request('/api/analyze'));await restarted.alarm();assert.equal(sends,1);assert.equal(ai,1);
});
test('email failures retry the saved report without regenerating or refunding it',async t=>{
 const f=fixture();f.values.set('purchase',{...record(),email:'reader@example.com'});let sends=0,ai=0;
 const report={summary:'Summary',problem_solving:[],careers:[],cognitive_characteristics:[],limitations:'Synthetic only'};
 t.mock.method(globalThis,'fetch',async(url,options)=>{
   if(url==='https://api.resend.com/emails')return ++sends===1?new Response('',{status:429}):Response.json({id:'email-2'});
   if(url.includes('openai')){ai++;return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(report)}]}]});}
   assert.equal(options.method,'GET');return Response.json(polarData(url));
 });
 const response=await f.object.fetch(request('/api/analyze'));assert.equal(response.status,200);assert.equal((await response.json()).emailDelivery.status,'pending');
 await f.object.alarm();assert.equal(f.values.get('emailDelivery').status,'sent');assert.equal(sends,2);assert.equal(ai,1);assert.equal(f.values.has('refund'),false);
});
test('checkout rejects missing or invalid email and missing delivery configuration before payment',async t=>{
 const f=fixture();let called=0;t.mock.method(globalThis,'fetch',async()=>{called++;throw Error('Unexpected provider call');});
 for(const email of [undefined,'','invalid','a@example.com,other@example.com'])assert.equal((await f.object.fetch(request('/api/checkout',{...submission(),email}))).status,400);
 f.object.env={...env,RESEND_API_KEY:''};assert.equal((await f.object.fetch(request('/api/checkout'))).status,503);assert.equal(called,0);
});
test('email retries stop before the provider idempotency window expires',async t=>{
 const f=fixture();f.values.set('purchase',{...record(),email:'reader@example.com'});f.values.set('emailDelivery',{status:'pending',attempts:1,startedAt:Date.now()-24*60*60*1000});
 t.mock.method(globalThis,'fetch',async()=>{throw Error('Must not resend after window');});
 assert.equal((await f.object.sendAutomaticEmail(f.values.get('purchase'),{})).status,'failed');
});

test('pause blocks checkout, payment restoration and background report/email/refund work',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;throw Error('Must not call providers while paused');});
 for(const flag of ['TESTING_PAUSED','REPORTS_PAUSED']) {
   const pausedEnv={...env,[flag]:'true'};
   for(const path of ['/api/checkout','/api/analyze','/api/report'])assert.equal((await worker.fetch(request(path),pausedEnv)).status,503);
   assert.equal((await worker.fetch(new Request('https://example.com/api/payment/status'),pausedEnv)).status,503);
   const f=fixture();f.object.env=pausedEnv;f.values.set('purchase',record());f.values.set('attempts',3);f.values.set('reportUrl','https://example.com/api/analyze');
   await f.object.alarm();assert.equal(f.values.has('refund'),false);assert.equal(f.values.has('emailDelivery'),false);
 }
 assert.equal(calls,0);
});
