import { emailConfigured, issueReportEmailToken } from './report-email.js';
import { validateSubmission, buildAnalysis, buildReport } from './report.js';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function handleReport({request,env}, fetcher=fetch) {
  if(env.TESTING_PAUSED === 'true')return json({error:'테스트와 보고서 생성이 잠시 중지되었습니다.'},503);
  if(env.REPORTS_PAUSED === 'true')return json({error:'보고서 생성이 잠시 중지되었습니다.'},503);
  if(request.method!=='POST')return json({error:'POST required'},405);
  const origin=request.headers.get('Origin');
  if(origin && origin!==new URL(request.url).origin)return json({error:'Invalid origin'},403);
  if(!request.headers.get('Content-Type')?.includes('application/json'))return json({error:'JSON required'},415);
  // Read with a hard limit even if Content-Length is absent or spoofed.
  const reader=request.body?.getReader();
  if(!reader)return json({error:'Missing body'},400);
  let size=0,chunks=[];
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>12000){await reader.cancel();return json({error:'Request too large'},413);}chunks.push(value);}
  let data;
  try { const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}const raw=JSON.parse(new TextDecoder().decode(bytes)); if(raw?.adultConfirmed!==true)return json({error:"본인은 만 18세 이상임을 확인해 주세요."},400); data=validateSubmission(raw); }
  catch{return json({error:'응답 30개, 문항별 시간, 언어 및 전송 동의를 확인해 주세요.'},400);}
  const analysis=buildAnalysis(data);
  const report=buildReport(analysis);
  const emailToken = emailConfigured(env) ? await issueReportEmailToken({report,result:analysis.result,language:data.language},env.REPORT_EMAIL_SECRET) : null;
  return json({result:analysis.result,domains:analysis.domains,report,emailToken});
}
