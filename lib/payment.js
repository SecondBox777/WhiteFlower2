import { validateSubmission } from './report.js';
import { handleReport } from './analyze.js';
import { emailConfigured, issueReportEmailToken } from './report-email.js';

export const PRODUCT_ID = 'a2fae7e7-f650-4109-87f7-f1f46e46b9be';
const COOKIE = 'mindscope_purchase';
const RETENTION = 30 * 24 * 60 * 60 * 1000;
const json = (body, status = 200, headers = {}) => Response.json(body, {status, headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const paused = env => env.TESTING_PAUSED === 'true' || env.REPORTS_PAUSED === 'true';
export async function readPaymentBody(request) {
  if (!request.headers.get('Content-Type')?.includes('application/json')) throw Error('JSON required');
  const reader = request.body?.getReader();
  if (!reader) throw Error('Missing body');
  let size = 0; const chunks = [];
  while (true) {
    const {value,done} = await reader.read(); if (done) break;
    size += value.length;
    if (size > 12000) { await reader.cancel(); throw Error('Request too large'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function polarRequest(env, path, body, fetcher = fetch) {
  const base = env.POLAR_ENVIRONMENT === 'sandbox' ? 'https://sandbox-api.polar.sh' : 'https://api.polar.sh';
  const response = await fetcher(`${base}/v1${path}`, {
    method: body ? 'POST' : 'GET',
    headers:{Authorization:`Bearer ${env.POLAR_ACCESS_TOKEN}`,'Content-Type':'application/json'},
    ...(body ? {body:JSON.stringify(body)} : {}), signal:AbortSignal.timeout(15000)
  });
  if (!response.ok) throw Error('결제 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.');
  return response.json();
}
export function paidCheckout(checkout, record) {
  return checkout.id === record.checkoutId && checkout.status === 'succeeded' &&
    checkout.product_id === record.productId && checkout.metadata?.mindscope_session === record.sessionId;
}
export async function handlePayment({request,env}) {
  const path = new URL(request.url).pathname;
  if (paused(env)) return json({error:'테스트와 AI 보고서 기능이 잠시 중지되었습니다.'},503);
  const status = path === '/api/payment/status';
  if (request.method !== (status ? 'GET' : 'POST')) return json({error:status?'GET required':'POST required'},405);
  const origin = new URL(request.url).origin;
  if (request.headers.get('Origin') && request.headers.get('Origin') !== origin) return json({error:'Invalid origin'},403);
  if (request.headers.get('Sec-Fetch-Site') === 'cross-site') return json({error:'Invalid origin'},403);
  if (!env.POLAR_ACCESS_TOKEN || !env.PAYMENT_SESSIONS) return json({error:'결제 준비 중입니다. 잠시 후 다시 이용해 주세요.'},503);
  // Do not accept money if report generation cannot be configured.
  if (path === '/api/checkout' && (!env.OPENAI_API_KEY || !env.OPENAI_MODEL)) return json({error:'리포트 서비스 준비 중입니다. 잠시 후 다시 이용해 주세요.'},503);
  let id;
  if (path === '/api/checkout') id = crypto.randomUUID();
  else id = request.headers.get('Cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length+1);
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return json({error:'결제 내역이 없습니다.',status:'none'},status?200:402);
  const stub = env.PAYMENT_SESSIONS.get(env.PAYMENT_SESSIONS.idFromName(id));
  const headers = new Headers(request.headers);
  headers.set('X-Mindscope-Session',id);
  const response = await stub.fetch(new Request(request.url,{method:request.method,headers,body:request.body,duplex:'half'}));
  if (path !== '/api/checkout' || !response.ok) return response;
  const outgoing = new Response(response.body,response);
  outgoing.headers.set('Set-Cookie',`${COOKIE}=${id}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${RETENTION/1000}`);
  return outgoing;
}

// One durable object per purchase: saved answers, payment verification and cached report.
export class PaymentSession {
  constructor(state,env) { this.state=state; this.env=env; this.inflight=null; }
  async fetch(request) {
    try {
      const path = new URL(request.url).pathname;
      if (path === '/api/checkout') {
        const raw = await readPaymentBody(request);
        if (raw?.adultConfirmed !== true) return json({error:'만 18세 이상임을 확인해 주세요.'},400);
        let submission; try { submission=validateSubmission(raw); } catch { return json({error:'테스트 응답을 확인해 주세요.'},400); }
        const sessionId=request.headers.get('X-Mindscope-Session');
        const origin=new URL(request.url).origin;
        const productId=this.env.POLAR_PRODUCT_ID || PRODUCT_ID;
        const checkout=await polarRequest(this.env,'/checkouts/',{
          products:[productId], metadata:{mindscope_session:sessionId},
          success_url:`${origin}/?payment=return`, return_url:`${origin}/?payment=cancelled`, allow_trial:false
        });
        if (checkout.product?.is_recurring === true) return json({error:'1회 결제 상품 설정을 확인해 주세요.'},503);
        const checkoutUrl=new URL(checkout.url);
        const allowed=this.env.POLAR_ENVIRONMENT==='sandbox'?'sandbox.polar.sh':'polar.sh';
        if (checkoutUrl.protocol!=='https:' || checkoutUrl.hostname!==allowed || !checkout.id) throw Error('결제 주소를 확인할 수 없습니다.');
        await this.state.storage.put('purchase',{sessionId,checkoutId:checkout.id,productId,checkoutUrl:checkout.url,submission:{...submission,consent:true,adultConfirmed:true},createdAt:Date.now()});
        await this.state.storage.setAlarm(Date.now()+RETENTION);
        return json({url:checkout.url});
      }
      const record=await this.state.storage.get('purchase');
      if (!record || Date.now()-record.createdAt>RETENTION) return json({error:'결제 내역 보관 기간이 지났습니다.',status:'none'},410);
      const checkout=await polarRequest(this.env,`/checkouts/${encodeURIComponent(record.checkoutId)}`);
      const paid=paidCheckout(checkout,record);
      if (path === '/api/payment/status') return json({status:paid?'paid':checkout.status,submission:record.submission,checkoutUrl:['open','confirmed'].includes(checkout.status)?record.checkoutUrl:null});
      if (!paid) return json({error:'결제 완료를 확인한 후 리포트를 받을 수 있습니다.'},402);
      if (!this.inflight) {
        this.inflight=this.generate(record,request.url).finally(()=>{this.inflight=null;});
      }
      const output=await this.inflight;
      if (output.error) return json(output.body,output.status);
      const data={...output.body};
      // Refresh the short-lived email token without regenerating the purchased report.
      data.emailToken=emailConfigured(this.env)?await issueReportEmailToken({report:data.report,result:data.result,language:record.submission.language},this.env.REPORT_EMAIL_SECRET):null;
      return json(data);
    } catch (error) {
      if (error.message==='Request too large') return json({error:error.message},413);
      if (error.message==='JSON required') return json({error:error.message},415);
      if (error instanceof SyntaxError || error.message==='Missing body') return json({error:'요청 내용을 확인해 주세요.'},400);
      return json({error:'결제 확인 또는 리포트 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.'},502);
    }
  }
  async generate(record,url) {
    const cached=await this.state.storage.get('report');
    if (cached) return {body:cached};
    const response=await handleReport({request:new Request(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(record.submission)}),env:this.env});
    const body=await response.json();
    if (!response.ok) return {error:true,body,status:response.status};
    delete body.emailToken;
    await this.state.storage.put('report',body);
    return {body};
  }
  async alarm() { await this.state.storage.deleteAll(); }
}
