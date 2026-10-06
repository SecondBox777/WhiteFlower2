import { validReport } from './report.js';

const encoder = new TextEncoder();
const json = (body, status=200) => Response.json(body, {status, headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const encode = bytes => {
  let binary='';
  for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
};
const decode = text => Uint8Array.from(atob(text.replaceAll('-','+').replaceAll('_','/')), c=>c.charCodeAt(0));
const key = secret => crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
export const emailConfigured = env => ['RESEND_API_KEY','RESEND_FROM','REPORT_EMAIL_SECRET'].every(name=>env[name]?.trim());

// Only server-generated report content may be sent. Token expires in 30 minutes.
export async function issueReportEmailToken({report,result,language}, secret, now=Date.now()) {
  const payload = encode(encoder.encode(JSON.stringify({report,result,language,id:crypto.randomUUID(),expires:now+30*60*1000})));
  const signature = encode(new Uint8Array(await crypto.subtle.sign('HMAC',await key(secret),encoder.encode(payload))));
  return `${payload}.${signature}`;
}
export async function verifyReportEmailToken(token, secret, now=Date.now()) {
  try {
    const parts = token.split('.');
    if(parts.length!==2 || !await crypto.subtle.verify('HMAC',await key(secret),decode(parts[1]),encoder.encode(parts[0])))return null;
    const data = JSON.parse(new TextDecoder().decode(decode(parts[0])));
    return data.expires>now && data.expires<=now+30*60*1000 && typeof data.id==='string' &&
      ['ko','en'].includes(data.language) && validReport(data.report) &&
      ['iq','score','correct'].every(name=>Number.isFinite(data.result?.[name])) ? data : null;
  } catch {return null;}
}
export { renderReportDocument as renderReportEmail } from '../report-content.js';
import { renderReportDocument as renderReportEmail } from '../report-content.js';

export async function handleReportEmail({request,env}, fetcher=fetch) {
  if(env.TESTING_PAUSED==='true'||env.REPORTS_PAUSED==='true')return json({error:'AI 보고서 생성과 이메일 발송이 잠시 중지되었습니다.'},503);
  if(request.method!=='POST')return json({error:'POST required'},405);
  const origin=request.headers.get('Origin');
  if(origin&&origin!==new URL(request.url).origin)return json({error:'Invalid origin'},403);
  if(!request.headers.get('Content-Type')?.includes('application/json'))return json({error:'JSON required'},415);
  const reader=request.body?.getReader();
  if(!reader)return json({error:'Missing body'},400);
  let size=0;const chunks=[];
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>200000){await reader.cancel();return json({error:'Request too large'},413);}chunks.push(value);}
  let body;
  try {const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}body=JSON.parse(new TextDecoder().decode(bytes));}catch{return json({error:'이메일 요청 형식을 확인해 주세요.'},400);}
  if(body?.adultConfirmed!==true)return json({error:'본인은 만 18세 이상임을 확인해 주세요.'},400);
  const email=typeof body?.email==='string'?body.email.trim():'';
  if(email.length>254||!/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(email)||body.consent!==true||typeof body.token!=='string')return json({error:'유효한 이메일 주소와 발송 동의를 확인해 주세요.'},400);
  if(!emailConfigured(env))return json({error:'이메일 발송 설정이 준비되지 않았습니다. 관리자에게 문의해 주세요.'},503);
  const data=await verifyReportEmailToken(body.token,env.REPORT_EMAIL_SECRET);
  if(!data)return json({code:'invalid_report_token',error:'보고서 발송 유효시간이 지났거나 유효하지 않은 보고서입니다. 테스트 결과에서 새 보고서를 생성해 주세요.'},400);
  try {
    const response=await fetcher('https://api.resend.com/emails',{
      method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`report/${data.id}`},
      signal:AbortSignal.timeout(15000),
      body:JSON.stringify({from:env.RESEND_FROM,to:[email],...renderReportEmail(data)})
    });
    if(!response.ok)return json({error:response.status===409?'이미 다른 주소로 발송되었거나 발송 처리 중입니다. 처음 입력한 주소로 잠시 후 다시 시도해 주세요.':response.status===429?'이메일 요청이 많습니다. 잠시 후 다시 시도해 주세요.':'이메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.'},response.status===429?429:response.status===409?409:502);
    const sent=await response.json();
    if(typeof sent.id!=='string'||!sent.id)return json({error:'이메일 발송 응답을 확인할 수 없습니다.'},502);
    return json({id:sent.id,message:'이메일 발송 요청이 접수되었습니다. 받은편지함과 스팸함을 확인해 주세요.'});
  }catch{return json({error:'이메일 발송 응답을 확인하지 못했습니다. 같은 주소로 다시 시도해 주세요.'},502);}
}
