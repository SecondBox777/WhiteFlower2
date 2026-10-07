import { validateSubmission } from './report.js';
import { handleReport } from './analyze.js';
import { emailConfigured, issueReportEmailToken, validEmail, deliverReportEmail } from './report-email.js';

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
  if (!['sandbox','production'].includes(env.POLAR_ENVIRONMENT)) throw Error('Polar environment required');
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
      if (paused(this.env)) return json({error:'리포트 서비스가 잠시 중지되었습니다.'},503);
      const path = new URL(request.url).pathname;
      if (path === '/api/checkout') {
        const raw = await readPaymentBody(request);
        if (raw?.adultConfirmed !== true) return json({error:'만 18세 이상임을 확인해 주세요.'},400);
        const email=typeof raw.email==='string'?raw.email.trim():'';
        if (!validEmail(email)) return json({error:'리포트를 받을 이메일 주소를 입력해 주세요.'},400);
        if (!emailConfigured(this.env)) return json({error:'이메일 발송 서비스 준비 중입니다. 잠시 후 다시 이용해 주세요.'},503);
        let submission; try { submission=validateSubmission(raw); } catch { return json({error:'테스트 응답을 확인해 주세요.'},400); }
        const sessionId=request.headers.get('X-Mindscope-Session');
        const origin=new URL(request.url).origin;
        const productId=this.env.POLAR_PRODUCT_ID || PRODUCT_ID;
        // Confirm required read permissions before redirecting a customer to pay.
        await Promise.all(['/orders/?limit=1','/refunds/?limit=1'].map(path=>polarRequest(this.env,path)));
        const checkout=await polarRequest(this.env,'/checkouts/',{
          products:[productId], customer_email:email, metadata:{mindscope_session:sessionId},
          success_url:`${origin}/?payment=return`, return_url:`${origin}/?payment=cancelled`, allow_trial:false
        });
        if (checkout.product?.is_recurring === true) return json({error:'1회 결제 상품 설정을 확인해 주세요.'},503);
        const checkoutUrl=new URL(checkout.url);
        const allowed=this.env.POLAR_ENVIRONMENT==='sandbox'?'sandbox.polar.sh':'polar.sh';
        if (checkoutUrl.protocol!=='https:' || checkoutUrl.hostname!==allowed || !checkout.id) throw Error('결제 주소를 확인할 수 없습니다.');
        await this.state.storage.put('purchase',{sessionId,checkoutId:checkout.id,productId,checkoutUrl:checkout.url,submission:{...submission,consent:true,adultConfirmed:true},email,createdAt:Date.now(),environment:this.env.POLAR_ENVIRONMENT});
        await this.state.storage.setAlarm(Date.now()+RETENTION);
        return json({url:checkout.url});
      }
      const record=await this.state.storage.get('purchase');
      if (!record || Date.now()-record.createdAt>RETENTION) return json({error:'결제 내역 보관 기간이 지났습니다.',status:'none'},410);
      if (record.environment && record.environment !== this.env.POLAR_ENVIRONMENT) return json({error:'다른 결제 환경의 구매입니다.',status:'none'},410);
      const verified=await this.verifyPurchase(record);
      if (path === '/api/payment/status') return json({status:verified.status,submission:record.submission,email:record.email || '',checkoutUrl:['open','confirmed'].includes(verified.status)?record.checkoutUrl:null});
      if (verified.status!=='paid') return json({error:this.statusMessage(verified.status),paymentStatus:verified.status},402);
      if (!record.email && request.body) {
        const raw=await readPaymentBody(request);
        const email=typeof raw.email==='string'?raw.email.trim():'';
        if (raw.email!==undefined) {
          if (!validEmail(email)) return json({error:'리포트를 받을 이메일 주소를 입력해 주세요.'},400);
          record.email=email;await this.state.storage.put('purchase',record);
        }
      }
      if (!this.inflight) {
        this.inflight=this.generate(record,request.url,verified.order).finally(()=>{this.inflight=null;});
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
  statusMessage(status) {
    return ({refunded:'환불이 완료되었습니다.',refund_pending:'리포트 제공에 실패하여 환불 처리 중입니다.',refund_failed:'자동 환불을 완료하지 못했습니다. 고객 지원에 문의해 주세요.',partially_refunded:'일부 환불된 구매입니다. 고객 지원에 문의해 주세요.',confirmed:'결제를 확인 중입니다. 잠시 후 다시 확인해 주세요.'})[status] || '결제 완료를 확인한 후 리포트를 받을 수 있습니다.';
  }
  async verifyPurchase(record) {
    const checkout=await polarRequest(this.env,`/checkouts/${encodeURIComponent(record.checkoutId)}`);
    if (!paidCheckout(checkout,record)) return {status:checkout.status==='succeeded'?'failed':checkout.status};
    const query=new URLSearchParams({'metadata[mindscope_session]':record.sessionId,product_id:record.productId,limit:'100'});
    const orders=await polarRequest(this.env,`/orders/?${query}`);
    const order=orders.items?.find(o=>o.checkout_id===record.checkoutId && o.product_id===record.productId && o.metadata?.mindscope_session===record.sessionId);
    if (!order || !order.paid) return {status:'confirmed'};
    if (!Number.isInteger(order.net_amount) || !Number.isInteger(order.refunded_amount) || order.net_amount<0 || order.refunded_amount<0) throw Error('Invalid order amounts');
    if (order.status==='refunded' || (order.net_amount>0 && order.refunded_amount>=order.net_amount)) return {status:'refunded',order};
    const refunds=await polarRequest(this.env,`/refunds/?order_id=${encodeURIComponent(order.id)}&limit=100`);
    const intent=await this.state.storage.get('refund');
    const matching=refunds.items?.filter(r=>r.order_id===order.id) || [];
    const ours=matching.find(r=>r.id===intent?.id || r.metadata?.mindscope_session===record.sessionId);
    if (ours) await this.state.storage.put('refund',{...intent,id:ours.id,status:ours.status});
    if (matching.some(r=>r.status==='pending')) return {status:'refund_pending',order};
    if (ours?.status==='succeeded') return {status:'refunded',order};
    if (order.refunded_amount>0) return {status:'partially_refunded',order};
    if (intent) return {status:['failed','canceled'].includes(ours?.status || intent.status)?'refund_failed':'refund_pending',order};
    if (order.status!=='paid') return {status:'confirmed'};
    return {status:'paid',order};
  }
  async startRefund(record,order) {
    const fresh=await this.verifyPurchase(record);
    if (fresh.status!=='paid') return {error:true,status:409,body:{error:this.statusMessage(fresh.status),paymentStatus:fresh.status}};
    order=fresh.order;
    // Persist intent BEFORE the network call. An ambiguous response must never trigger a second POST.
    if (await this.state.storage.get('refund')) return {error:true,status:409,body:{error:this.statusMessage('refund_pending'),paymentStatus:'refund_pending'}};
    if (order.net_amount===0) {
      await this.state.storage.put('refund',{status:'failed',orderId:order.id,noCharge:true});
      await this.state.storage.setAlarm(record.createdAt+RETENTION);
      return {error:true,status:409,body:{error:'리포트를 제공하지 못했습니다. 청구된 금액은 없습니다.',paymentStatus:'refund_failed'}};
    }
    await this.state.storage.put('refund',{status:'submitting',orderId:order.id,submittedAt:Date.now()});
    await this.state.storage.setAlarm(Date.now()+60000);
    try {
      const refund=await polarRequest(this.env,'/refunds/',{order_id:order.id,amount:order.net_amount-order.refunded_amount,reason:'service_disruption',metadata:{mindscope_session:record.sessionId},revoke_benefits:true});
      if (refund.order_id!==order.id || !refund.id) throw Error('Invalid refund');
      await this.state.storage.put('refund',{id:refund.id,orderId:order.id,status:refund.status});
      const status=refund.status==='succeeded'?'refunded':['failed','canceled'].includes(refund.status)?'refund_failed':'refund_pending';
      return {error:true,status:409,body:{error:this.statusMessage(status),paymentStatus:status}};
    } catch {
      return {error:true,status:409,body:{error:'환불 요청 결과를 확인 중입니다. 잠시 후 상태를 다시 확인해 주세요.',paymentStatus:'refund_pending'}};
    }
  }
  async generate(record,url,order) {
    const cached=await this.state.storage.get('report');
    if (cached) return {body:{...cached,emailDelivery:await this.sendAutomaticEmail(record,cached)}};
    const attempts=(await this.state.storage.get('attempts')) || 0;
    if (attempts>=3) return this.startRefund(record,order);
    await this.state.storage.put('attempts',attempts+1);
    await this.state.storage.put('reportUrl',url);
    await this.state.storage.setAlarm(Date.now()+120000);
    const response=await handleReport({request:new Request(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(record.submission)}),env:this.env});
    const body=await response.json();
    if (!response.ok) {
      if (attempts+1>=3) return this.startRefund(record,order);
      await this.state.storage.setAlarm(Date.now()+30000);
      return {error:true,body:{...body,error:'리포트 생성을 다시 시도 중입니다. 계속 실패하면 자동 환불됩니다.'},status:response.status};
    }
    delete body.emailToken;
    await this.state.storage.put('report',body);
    await this.state.storage.setAlarm(record.createdAt+RETENTION);
    return {body:{...body,emailDelivery:await this.sendAutomaticEmail(record,body)}};
  }
  async sendAutomaticEmail(record,report) {
    if (!record.email) return {status:'unavailable'};
    const delivery=await this.state.storage.get('emailDelivery');
    if (delivery?.status==='sent' || delivery?.status==='failed') return delivery;
    if (delivery && (delivery.attempts>=5 || Date.now()-delivery.startedAt>=23*60*60*1000)) {
      const failed={...delivery,status:'failed'};await this.state.storage.put('emailDelivery',failed);return failed;
    }
    const attempt={status:'pending',attempts:(delivery?.attempts || 0)+1,startedAt:delivery?.startedAt || Date.now()};
    await this.state.storage.put('emailDelivery',attempt);
    await this.state.storage.setAlarm(Date.now()+60000);
    const response=await deliverReportEmail({...report,language:record.submission.language,id:record.sessionId},record.email,this.env);
    const result=await response.json();
    if (response.ok) {
      const sent={...attempt,status:'sent',id:result.id};
      await this.state.storage.put('emailDelivery',sent);await this.state.storage.setAlarm(record.createdAt+RETENTION);return sent;
    }
    if (attempt.attempts>=5) {attempt.status='failed';await this.state.storage.put('emailDelivery',attempt);await this.state.storage.setAlarm(record.createdAt+RETENTION);}
    return attempt;
  }
  async alarm() {
    const record=await this.state.storage.get('purchase');
    if (!record || Date.now()-record.createdAt>=RETENTION) { await this.state.storage.deleteAll(); return; }
    if (paused(this.env)) { await this.state.storage.setAlarm(Date.now()+60000); return; }
    if (this.inflight) { await this.state.storage.setAlarm(Date.now()+120000); return; }
    const report=await this.state.storage.get('report');
    if (report && !await this.state.storage.get('refund')) {
      const verified=await this.verifyPurchase(record);
      if (verified.status==='paid') {
        const delivery=await this.sendAutomaticEmail(record,report);
        if (delivery.status==='pending') return;
      }
      await this.state.storage.setAlarm(record.createdAt+RETENTION); return;
    }
    if (!await this.state.storage.get('attempts')) { await this.state.storage.setAlarm(record.createdAt+RETENTION); return; }
    if (this.inflight) { await this.state.storage.setAlarm(Date.now()+120000); return; }
    // Recheck the order before retrying generation or reconciling an uncertain refund.
    const url=await this.state.storage.get('reportUrl');
    if (!url) { await this.state.storage.setAlarm(record.createdAt+RETENTION); return; }
    const response=await this.fetch(new Request(url,{method:'POST'}));
    const data=await response.json();
    if (['refunded','refund_failed','partially_refunded'].includes(data.paymentStatus)) await this.state.storage.setAlarm(record.createdAt+RETENTION);
    else if (!response.ok) await this.state.storage.setAlarm(Math.min(Date.now()+60000,record.createdAt+RETENTION));
  }
}
