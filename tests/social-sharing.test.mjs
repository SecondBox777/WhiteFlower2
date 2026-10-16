import test from 'node:test';
import assert from 'node:assert/strict';
import { issueShareToken, verifyShareToken } from '../lib/share-token.js';
import { issueReportEmailToken } from '../lib/report-email.js';
import { handleShareCard, ReportShare } from '../lib/share-card.js';
import { shareMessage, shareCopy, serviceURL, services } from '../share-copy.js';
import { languages } from '../i18n.js';
import { buildAnalysis, buildReport } from '../lib/report.js';
import { scoringItems } from '../scoring.js';
import { handleTemporaryTestReport } from '../lib/temporary-test-report.js';
import worker from '../src/index.js';
const secret='test-share-secret-at-least-32-characters';
const data={language:'ko',result:{iq:100,score:40}};
function fixture(){
 const values=new Map();let alarm;
 const state={storage:{get:async key=>values.get(key),put:async(key,value)=>{if(typeof key==='string')values.set(key,value);else for(const [k,v] of Object.entries(key))values.set(k,v);},setAlarm:async value=>{alarm=value;},deleteAll:async()=>values.clear()}};
 const object=new ReportShare(state);
 return {values,state,object,get alarm(){return alarm;},env:{REPORT_EMAIL_SECRET:secret,REPORT_SHARES:{idFromName:id=>id,get:()=>({fetch:req=>object.fetch(req)})}}};
}
function png(size=200000,width=1000,height=1414){const bytes=new Uint8Array(size);bytes.set([137,80,78,71,13,10,26,10]);bytes.set(new TextEncoder().encode('IHDR'),12);const view=new DataView(bytes.buffer);view.setUint32(16,width);view.setUint32(20,height);return bytes;}
const upload=(token,body=png(),headers={})=>new Request('https://example.com/api/share-card',{method:'POST',headers:{'Content-Type':'image/png',Origin:'https://example.com',Authorization:`Bearer ${token}`,...headers},body});

test('share tokens are purpose-bound, expiring, tamper-proof and contain no email or answers',async()=>{
 const now=Date.now(),token=await issueShareToken(data,secret,now);
 const verified=await verifyShareToken(token,secret,now);assert.equal(verified.iq,100);assert.equal(verified.language,'ko');
 assert.equal(await verifyShareToken(token,secret,now+86400000),null);
 assert.equal(await verifyShareToken(token+'x',secret,now),null);assert.equal(await verifyShareToken(token,'wrong',now),null);
 const analysis=buildAnalysis({answers:scoringItems.map(q=>'ABCD'.indexOf(q.answer)),seconds:scoringItems.map(q=>q.referenceSeconds),expiredIndex:null,language:'ko'});
 const emailToken=await issueReportEmailToken({report:buildReport(analysis),result:analysis.result,language:'ko'},secret,now);
 assert.equal(await verifyShareToken(emailToken,secret,now),null);
 assert.ok(!JSON.stringify(verified).includes('email'));assert.ok(!JSON.stringify(verified).includes('answers'));
 assert.equal(await issueShareToken(data,''),null);
});

test('public card creation requires an authorized report, correct origin, PNG and bounded dimensions',async()=>{
 const f=fixture(),token=await issueShareToken(data,secret);
 for(const [request,status] of [
  [upload('invalid'),401],[upload(token,png(),{Origin:'https://foreign.example'}),403],
  [upload(token,png(),{'Sec-Fetch-Site':'cross-site'}),403],[upload(token,png(),{'Content-Type':'image/svg+xml'}),415],
  [upload(token,new Uint8Array(10)),400],[upload(token,png(40,1,1)),400],[upload(token,png(2*1024*1024+1)),413]
 ])assert.equal((await handleShareCard({request,env:f.env})).status,status);
 assert.equal(f.values.size,0);
 assert.equal((await handleShareCard({request:upload(token),env:{...f.env,REPORTS_PAUSED:'true'}})).status,503);
});

test('stored PNG is byte-for-byte original, survives restart and exposes result-specific crawler metadata',async()=>{
 const f=fixture(),token=await issueShareToken(data,secret),image=png();
 const created=await handleShareCard({request:upload(token,image,{'X-Share-IQ':'999'}),env:f.env});
 assert.equal(created.status,200);const card=await created.json();assert.equal(card.width,1000);assert.equal(card.height,1414);
 assert.ok(f.alarm>Date.now());assert.ok(f.values.size>2);assert.ok([...f.values.values()].filter(x=>x instanceof Uint8Array).every(x=>x.length<=65536));
 const restarted=new ReportShare(f.state);
 const page=await restarted.fetch(new Request(card.url));const html=await page.text();
 assert.ok(html.includes('나의 IQ 스타일 점수는 100점입니다!'));assert.ok(!html.includes('999'));assert.ok(html.includes('property="og:image"'));assert.ok(html.includes(card.imageUrl));
 assert.match(page.headers.get('X-Robots-Tag'),/noindex/);assert.ok(!html.includes('<script'));assert.ok(!html.includes('blur('));
 const received=await restarted.fetch(new Request(card.imageUrl));assert.equal(received.headers.get('Content-Type'),'image/png');
 assert.deepEqual(new Uint8Array(await received.arrayBuffer()),image);
 assert.equal((await restarted.fetch(new Request(card.imageUrl,{method:'HEAD'}))).body,null);
 const retry=await handleShareCard({request:upload(token,png(50)),env:f.env});assert.deepEqual(await retry.json(),card);
});

test('shared links expire at seven days and alarms remove their storage',async t=>{
 const now=Date.now();t.mock.method(Date,'now',()=>now);
 const f=fixture(),token=await issueShareToken(data,secret);const card=await (await handleShareCard({request:upload(token),env:f.env})).json();
 assert.equal(f.alarm,now+7*86400000);
 Date.now.mock.mockImplementation(()=>now+7*86400000);
 assert.equal((await f.object.fetch(new Request(card.url))).status,404);
 assert.equal((await f.object.fetch(new Request(card.imageUrl))).status,404);
 await f.object.alarm();assert.equal(f.values.size,0);
});

test('all language captions include the score and Mindscope URL; service URLs encode user content',()=>{
 for(const language of Object.keys(languages)){
  const message=shareMessage(100,language);assert.ok(message.includes('100'));assert.ok(message.includes('https://mindscope.online/'));assert.ok(shareCopy(language).publicNote);
  if(language!=='ko')assert.ok(!/[가-힣]/.test(message));
  for(const [service] of services){const url=serviceURL(service,{message:message+' & <test>',url:'https://example.com/s/test',imageUrl:'https://example.com/s/test/result.png'});assert.ok(!url.includes('<test>'));}
 }
 assert.throws(()=>serviceURL('javascript:alert(1)',{message:'x',url:'https://example.com'}));
});

test('temporary reports issue share authorization without contacting any SNS automatically',async()=>{
 const submission={answers:scoringItems.map(q=>'ABCD'.indexOf(q.answer)),seconds:scoringItems.map(q=>q.referenceSeconds),expiredIndex:null,language:'en',adultConfirmed:true,consent:true,email:'private@example.com'};
 const env={TEMPORARY_TEST_REPORT_ENABLED:'true',RESEND_API_KEY:'test',RESEND_FROM:'reports@example.com',REPORT_EMAIL_SECRET:secret};
 const response=await handleTemporaryTestReport({request:new Request('https://example.com/api/test-report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(submission)}),env},async url=>{assert.equal(url,'https://api.resend.com/emails');return Response.json({id:'sent'});});
 const body=await response.json(),token=await verifyShareToken(body.shareToken,secret);assert.equal(token.iq,Math.round(body.result.iq));assert.equal(token.language,'en');
 const f=fixture();assert.equal((await worker.fetch(upload(body.shareToken),f.env)).status,200);
 for(const path of ['/api/report','/api/analyze'])assert.equal((await worker.fetch(new Request(`https://example.com${path}`,{method:'POST'}),{POLAR_ACCESS_TOKEN:'test',PAYMENT_SESSIONS:{}})).status,402);
});

test('public configuration exposes only a JavaScript app key and routes do not fall through to static hosting',async()=>{
 const response=await worker.fetch(new Request('https://example.com/api/share-config'),{KAKAO_JAVASCRIPT_KEY:'a'.repeat(32),REPORT_EMAIL_SECRET:secret,POLAR_ACCESS_TOKEN:'private'});
 assert.deepEqual(await response.json(),{kakaoJavaScriptKey:'a'.repeat(32)});
 const invalid=await worker.fetch(new Request('https://example.com/api/share-config'),{KAKAO_JAVASCRIPT_KEY:'invalid'});assert.deepEqual(await invalid.json(),{kakaoJavaScriptKey:null});
 assert.equal((await worker.fetch(new Request('https://example.com/s/bad'),fixture().env)).status,404);
});
