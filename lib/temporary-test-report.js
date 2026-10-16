// TEMPORARY TEST FEATURE: independent of the paid report routes. See docs/temporary-test-report.md.
import { readPaymentBody } from './payment.js';
import { validateSubmission, buildAnalysis, buildReport } from './report.js';
import { emailConfigured, validEmail, deliverReportEmail } from './report-email.js';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function handleTemporaryTestReport({request,env},fetcher=fetch) {
 if(env.TEMPORARY_TEST_REPORT_ENABLED!=='true')return json({error:'API endpoint not found'},404);
 if(env.TESTING_PAUSED==='true'||env.REPORTS_PAUSED==='true')return json({error:'테스트와 보고서 기능이 잠시 중지되었습니다.'},503);
 if(request.method!=='POST')return json({error:'POST required'},405);
 const origin=request.headers.get('Origin');
 if(origin&&origin!==new URL(request.url).origin||request.headers.get('Sec-Fetch-Site')==='cross-site')return json({error:'Invalid origin'},403);
 let raw;
 try {raw=await readPaymentBody(request);}catch(error){return json({error:'테스트 응답을 확인해 주세요.'},error.message==='Request too large'?413:error.message==='JSON required'?415:400);}
 if(raw?.adultConfirmed!==true)return json({error:'만 18세 이상임을 확인해 주세요.'},400);
 const email=typeof raw.email==='string'?raw.email.trim():'';
 if(!validEmail(email))return json({error:'리포트를 받을 이메일 주소를 입력해 주세요.'},400);
 let submission;
 try {submission=validateSubmission(raw);}catch{return json({error:'테스트 응답을 확인해 주세요.'},400);}
 if(!emailConfigured(env))return json({error:'리포트 서비스 준비 중입니다. 잠시 후 다시 이용해 주세요.'},503);
 const analysis=buildAnalysis(submission),report=buildReport(analysis);
 // Same submission and recipient reuse the provider key, including ambiguous network retries.
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([submission,email])));
 const id=`temporary-test-${Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')}`;
 const delivery=await deliverReportEmail({id,report,result:analysis.result,language:submission.language},email,env,fetcher);
 return json({result:analysis.result,report,emailDelivery:{status:delivery.ok?'sent':'failed'}});
}
