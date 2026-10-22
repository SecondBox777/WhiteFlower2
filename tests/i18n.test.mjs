import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { languages, isLanguage, resolveLanguage, translate } from '../i18n.js';
import { translations } from '../translations.js';
import { reportCopy } from '../report-locales.js';
import { questionCopy, localizedQuestion } from '../question-locales.js';
import { questions } from '../questions.js';
import { scoringItems } from '../scoring.js';
import { validateSubmission, buildAnalysis, buildReport } from '../lib/report.js';
import { reportBlocks, renderReportDocument } from '../report-content.js';
import { renderReportEmail, issueReportEmailToken, verifyReportEmailToken } from '../lib/report-email.js';
import { replaceQuestionReferences } from '../lib/report-language.js';
import { PaymentSession, PRODUCT_ID } from '../lib/payment.js';
import worker from '../src/index.js';

const submission=language=>({answers:scoringItems.map(q=>'ABCD'.indexOf(q.answer)),seconds:scoringItems.map(q=>q.referenceSeconds),expiredIndex:null,language,consent:true,adultConfirmed:true});
const codes=Object.keys(languages);
const secret='test-only-secret-for-localized-reports';

test('language detection has a single allowlist and all translations are complete',()=>{
 assert.ok(codes.length<=18);assert.ok(codes.includes('ko')&&codes.includes('en'));
 for(const [source,entry] of Object.entries(translations))for(const code of codes.filter(x=>x!=='ko'))assert.ok(entry[code]?.trim(),`${code}: ${source}`);
 for(const [input,expected] of [['es-MX','es'],['fr-CA','fr'],['ko-KR','ko'],['ja-JP','ja'],['zh-TW','zh-CN'],['xx','en']])assert.equal(resolveLanguage(input),expected);
 for(const unsupported of ['xx','<script>','EN',null]) {
  assert.equal(isLanguage(unsupported),false);
  assert.throws(()=>validateSubmission(submission(unsupported)));
 }
});

test('server-translated landing text can switch back to Korean and another language',()=>{
 for(const source of ['개의 질문, 새로운 나의 발견.','개 문항','Mindscope는 어떤 서비스인가요?']) {
  for(const language of codes.filter(x=>x!=='ko')) {
   const rendered=translate(source,language);
   assert.equal(translate(rendered,'ko').trim(),source);
   assert.equal(translate(rendered,'ja').trim(),translate(source,'ja').trim());
  }
 }
});

test('all Korean page text and accessibility labels have translations',async()=>{
 const html=(await readFile(new URL('../index.html',import.meta.url),'utf8')).replace(/<head\b[\s\S]*?<\/head>/g,'').replace(/<script\b[\s\S]*?<\/script>/g,'').replace(/<select\b[\s\S]*?<\/select>/g,'').replace(/<a\b[^>]*hreflang="[^"]+"[^>]*>[\s\S]*?<\/a>/g,'');
 const chunks=[...[...html.matchAll(/>([^<>]+)</g)].map(m=>m[1]),...[...html.matchAll(/(?:aria-label|placeholder)="([^"]+)"/g)].map(m=>m[1])];
 for(const source of chunks.filter(s=>/[가-힣]/.test(s)&&!s.startsWith('Mindscope —')))for(const code of codes.filter(x=>x!=='ko'))assert.ok(!/[가-힣]/.test(translate(source,code)),`${code}: ${source}`);
});

test('all question instructions, weight assumptions and option D are localized without changing answer positions',()=>{
 for(const language of codes)for(const [index,q] of questions.entries()) {
  const localized=localizedQuestion(q,index,language),copy=questionCopy[language];
  assert.equal(localized.image,q.image);assert.equal(localized.options.length,4);
  assert.ok(localized.imageAlt.includes(String(index+1)));
  assert.equal(localized.prompt,index<10?copy.pattern:index<20?(index===10?copy.logic:copy.positive):copy.spatial);
  if(index>=10&&index<20)assert.ok(localized.options[3].includes(copy.unknown));
  if(language!=='ko')assert.ok(!/[가-힣]/.test(localized.prompt));
 }
});

test('screen, email and image content use the selected language with identical scoring',async()=>{
 let expected;
 for(const language of codes) {
  const analysis=buildAnalysis(validateSubmission(submission(language)));
  if(expected)assert.deepEqual(analysis.result,expected);expected=analysis.result;
  const report=buildReport(analysis),data={language,report,result:analysis.result},copy=reportCopy(language);
  assert.deepEqual(report.abilities.map(a=>a.title),copy.names);
  assert.equal(report.summary,copy.summary);assert.equal(report.limitations,copy.notice);
  const document=renderReportDocument(data);
  assert.deepEqual(document,renderReportEmail(data));
  assert.equal(document.text,reportBlocks(data).map(b=>b.text).join('\n\n'));
  assert.ok(document.html.includes(`lang="${language}"`));
  assert.ok(document.subject.includes(copy.title));
  if(language!=='ko') {
   assert.ok(!/[가-힣]/.test(document.text));
   assert.ok(analysis.ability_levels.every(a=>!/[가-힣]/.test(a.assessment)));
  }
  const token=await issueReportEmailToken(data,secret);
  const decoded=await verifyReportEmailToken(token,secret);
  assert.equal(decoded.language,language);assert.deepEqual(decoded.report,report);
  const references=replaceQuestionReferences({summary:'Q01, Q12, Q21'},language);
  assert.ok(!/Q\d/.test(references.summary));
  if(language!=='ko')assert.ok(!/[가-힣]/.test(references.summary));
 }
});

test('purchased language survives restoration, report caching and automatic email delivery',async t=>{
 const sessionId='12345678-1234-4123-8123-123456789012';
 const env={POLAR_ENVIRONMENT:'sandbox',POLAR_ACCESS_TOKEN:'test',RESEND_API_KEY:'test',RESEND_FROM:'reports@example.com',REPORT_EMAIL_SECRET:secret};
 let language,emails=[];
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  if(String(url).includes('resend.com')) { emails.push(JSON.parse(options.body));return Response.json({id:'mail'}); }
  const path=new URL(url).pathname;
  if(path.includes('/orders/'))return Response.json({items:[{id:'order-1',checkout_id:'checkout-1',product_id:PRODUCT_ID,metadata:{mindscope_session:sessionId},paid:true,status:'paid',net_amount:900,refunded_amount:0}]});
  if(path.includes('/refunds/'))return Response.json({items:[]});
  return Response.json({id:'checkout-1',status:'succeeded',product_id:PRODUCT_ID,metadata:{mindscope_session:sessionId}});
 });
 for(language of codes) {
  const values=new Map([['purchase',{sessionId,checkoutId:'checkout-1',productId:PRODUCT_ID,submission:submission(language),createdAt:Date.now(),email:'reader@example.com'}]]);
  const state={storage:{get:async key=>values.get(key),put:async(key,value)=>values.set(key,value),setAlarm:async()=>{}}};
  const object=new PaymentSession(state,env);
  const status=await (await object.fetch(new Request('https://example.com/api/payment/status'))).json();
  assert.equal(status.submission.language,language);
  const response=await object.fetch(new Request('https://example.com/api/report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({language:'xx'})}));
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.report.summary,reportCopy(language).summary);
  assert.ok(emails.at(-1).subject.includes(reportCopy(language).title));
  assert.ok(emails.at(-1).html.includes(`lang="${language}"`));
  const restarted=new PaymentSession(state,env);
  const cached=await (await restarted.fetch(new Request('https://example.com/api/report',{method:'POST'}))).json();
  assert.deepEqual(cached.report,data.report);
 }
 assert.equal(emails.length,codes.length);
});

test('public API errors use the requested language while keeping pause and payment guards',async()=>{
 for(const language of codes) {
  const request=new Request('https://example.com/api/checkout',{method:'POST',headers:{'X-Mindscope-Language':language}});
  const response=await worker.fetch(request,{TESTING_PAUSED:'true'});
  assert.equal(response.status,503);
  const body=await response.json();assert.equal(body.error,translate('테스트와 보고서 기능이 잠시 중지되었습니다.',language));
 }
});
