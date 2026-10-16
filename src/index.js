import { localizeResponse } from '../lib/localize-response.js';
import { handlePayment } from '../lib/payment.js';
export { PaymentSession } from '../lib/payment.js';
import { handleReportEmail } from '../lib/report-email.js';

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
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
