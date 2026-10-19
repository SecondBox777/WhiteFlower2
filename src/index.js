import { handleShareCard } from '../lib/share-card.js';
export { ReportShare } from '../lib/share-card.js';
import { localizeResponse } from '../lib/localize-response.js';
import { handlePayment } from '../lib/payment.js';
export { PaymentSession } from '../lib/payment.js';
import { handleReportEmail } from '../lib/report-email.js';
import { isLanguage } from '../i18n.js';

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/index.html') {
      const url=new URL(request.url);url.pathname='/';
      return Response.redirect(url.href,308);
    }
    if (path === '/' && ['GET','HEAD'].includes(request.method)) {
      const url=new URL(request.url),requested=url.searchParams.get('lang');
      const language=isLanguage(requested)?requested:'ko';
      const assetUrl=new URL(`/_home/${language}.html`,url);
      const response=await env.ASSETS.fetch(new Request(assetUrl,request));
      const headers=new Headers(response.headers);
      headers.set('Content-Language',language);
      headers.set('Cache-Control','no-cache');
      return new Response(response.body,{status:response.status,headers});
    }
    if (path==='/api/share-card'||path==='/api/share-config'||path.startsWith('/s/')) return handleShareCard({request,env});
    if (path === '/api/email-report') return localizeResponse(await handleReportEmail({request,env}),request);
    if (['/api/checkout','/api/payment/status','/api/analyze','/api/report'].includes(path)) {
      return localizeResponse(await handlePayment({ request, env }),request);
    }
    if (path.startsWith('/api/')) {
      return Response.json({ error: 'API endpoint not found' }, { status: 404 });
    }
    return env.ASSETS.fetch(request);
  }
};
