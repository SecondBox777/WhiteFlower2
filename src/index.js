import { handleReport } from '../lib/analyze.js';
import { handleReportEmail } from '../lib/report-email.js';

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/api/email-report') return handleReportEmail({request,env});
    if (path === '/api/analyze' || path === '/api/report') {
      return handleReport({ request, env });
    }
    if (path.startsWith('/api/')) {
      return Response.json({ error: 'API endpoint not found' }, { status: 404 });
    }
    return env.ASSETS.fetch(request);
  }
};
